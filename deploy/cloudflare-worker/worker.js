/**
 * BatteryLake Gemini proxy — Cloudflare Worker
 *
 * Keeps the Gemini API key out of the public website. The site posts a chat
 * request here; the Worker checks the caller's origin, forwards the request
 * to the Gemini API with the secret key, and returns the answer.
 *
 * Contract (POST /chat, JSON):
 *   request : { question: string, system?: string,
 *               history?: [{role: "user"|"assistant", content: string}],
 *               message?: string }        // legacy: a single pre-built prompt
 *   response: { text: string, model: string }
 *             { error: string, detail?: string }   with a 4xx/5xx status
 *
 * Deploy:
 *   1. Cloudflare dashboard → Workers & Pages → your worker → Edit code →
 *      replace everything with this file → Deploy.
 *   2. Settings → Variables and Secrets → add secret GEMINI_API_KEY.
 *      Optional plain variables: GEMINI_MODEL (default gemini-flash-lite-latest),
 *      ALLOWED_ORIGINS (comma separated; default below).
 *   3. Dataset contributions (optional): create an R2 bucket (e.g.
 *      batterylake-contributions) and bind it to this Worker as
 *      CONTRIB_BUCKET (Settings → Bindings → R2 bucket). The Contribute page
 *      then uploads raw files straight into the bucket, chunked and
 *      resumable, under contributions/<ref_name>/raw_data/. Optional
 *      MAX_UPLOAD_GB (default 50) caps the size of one file.
 *
 * Upload contract (all under /upload, same origin check as /chat):
 *   GET  /upload/status                      -> {enabled, part_size, max_gb}
 *   POST /upload/init     {ref_name, file_name, size, content_type}
 *                                            -> {key, upload_id, part_size}
 *   PUT  /upload/part?key&upload_id&part=N   (bytes, all parts equal size) -> {etag}
 *   POST /upload/complete {key, upload_id, parts:[{part, etag}]} -> {key, size}
 *   POST /upload/abort    {key, upload_id}
 *   PUT  /upload/object?key                  (small JSON <= 10 MB) -> {key}
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://tianwen1209.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8767',
  'http://127.0.0.1:8767',
];
const DEFAULT_MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash-lite'];
const MAX_QUESTION_CHARS = 4000;
const MAX_SYSTEM_CHARS = 12000;
const MAX_HISTORY_TURNS = 8;
// Cloudflare's outbound fetch sometimes egresses through a region Gemini
// blocks ("User location is not supported"); a fresh attempt usually takes a
// different path, so retry those a few times before giving up.
const LOCATION_RETRIES = 3;

function allowedOrigins(env) {
  const raw = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return raw.length ? raw : DEFAULT_ALLOWED_ORIGINS;
}

const UPLOAD_PART_SIZE = 16 * 1024 * 1024;   // R2 multipart: >= 5 MiB, all parts equal except the last
const UPLOAD_OBJECT_MAX = 10 * 1024 * 1024;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(extraHeaders || {}) },
  });
}

function buildContents(payload) {
  const contents = [];
  const history = Array.isArray(payload.history) ? payload.history.slice(-MAX_HISTORY_TURNS) : [];
  for (const turn of history) {
    if (!turn || typeof turn.content !== 'string' || !turn.content.trim()) continue;
    contents.push({
      role: turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: turn.content.slice(0, MAX_QUESTION_CHARS) }],
    });
  }
  // Gemini requires the conversation to start with a user turn.
  while (contents.length && contents[0].role !== 'user') contents.shift();
  const question = typeof payload.question === 'string' && payload.question.trim()
    ? payload.question
    : (typeof payload.message === 'string' ? payload.message : '');
  if (!question.trim()) return null;
  contents.push({ role: 'user', parts: [{ text: question.slice(0, payload.question ? MAX_QUESTION_CHARS : MAX_SYSTEM_CHARS + MAX_QUESTION_CHARS) }] });
  return contents;
}

async function callGemini(env, model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || `Gemini HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const text = parts.map(p => p.text || '').join('').trim();
  if (!text) throw Object.assign(new Error('Gemini returned no text'), { status: 502 });
  return text;
}

function safeSegment(s, max) {
  return String(s || '').replace(/[^A-Za-z0-9_.\-]+/g, '_').replace(/^\.+/, '').slice(0, max || 120);
}
function safeRelPath(s) {
  return String(s || '').split(/[\\/]+/).filter(p => p && p !== '.' && p !== '..').map(p => safeSegment(p, 160)).join('/');
}
function contributionKey(refName, fileName) {
  const ref = safeSegment(refName, 120);
  const rel = safeRelPath(fileName);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.\-]{2,}$/.test(ref) || !rel) return null;
  return 'contributions/' + ref + '/raw_data/' + rel;
}

async function handleUpload(request, env, url, cors) {
  const sub = url.pathname.replace(/^\/upload\/?/, '');
  const maxGb = Number(env.MAX_UPLOAD_GB || 50);
  if (sub === 'status' && request.method === 'GET') {
    return json({ enabled: !!env.CONTRIB_BUCKET, part_size: UPLOAD_PART_SIZE, max_gb: maxGb }, 200, cors);
  }
  if (!env.CONTRIB_BUCKET) return json({ error: 'uploads_not_enabled' }, 503, cors);
  const bucket = env.CONTRIB_BUCKET;
  const q = url.searchParams;
  if (sub === 'init' && request.method === 'POST') {
    let body; try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400, cors); }
    const key = contributionKey(body.ref_name, body.file_name);
    const size = Number(body.size || 0);
    if (!key) return json({ error: 'Invalid ref_name or file_name' }, 400, cors);
    if (!(size >= 0) || size > maxGb * 1024 * 1024 * 1024) return json({ error: 'File exceeds ' + maxGb + ' GB' }, 413, cors);
    const mp = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: String(body.content_type || 'application/octet-stream').slice(0, 120) }, customMetadata: { original_name: String(body.file_name || '').slice(0, 200), declared_size: String(size) } });
    return json({ key, upload_id: mp.uploadId, part_size: UPLOAD_PART_SIZE }, 200, cors);
  }
  if (sub === 'part' && request.method === 'PUT') {
    const key = q.get('key'), uploadId = q.get('upload_id'), part = Number(q.get('part'));
    if (!key || !key.startsWith('contributions/') || !uploadId || !(part >= 1)) return json({ error: 'Missing key, upload_id or part' }, 400, cors);
    const mp = bucket.resumeMultipartUpload(key, uploadId);
    const p = await mp.uploadPart(part, request.body);
    return json({ etag: p.etag, part }, 200, cors);
  }
  if (sub === 'complete' && request.method === 'POST') {
    let body; try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400, cors); }
    if (!body.key || !String(body.key).startsWith('contributions/') || !body.upload_id || !Array.isArray(body.parts)) return json({ error: 'Missing key, upload_id or parts' }, 400, cors);
    const mp = bucket.resumeMultipartUpload(body.key, body.upload_id);
    const parts = body.parts.map(p => ({ partNumber: Number(p.part || p.partNumber), etag: String(p.etag || '') })).sort((a, b) => a.partNumber - b.partNumber);
    const obj = await mp.complete(parts);
    return json({ key: body.key, size: obj.size }, 200, cors);
  }
  if (sub === 'abort' && request.method === 'POST') {
    let body; try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400, cors); }
    if (body.key && body.upload_id) { try { await bucket.resumeMultipartUpload(body.key, body.upload_id).abort(); } catch (_) { /* already gone */ } }
    return json({ ok: true }, 200, cors);
  }
  if (sub === 'object' && request.method === 'PUT') {
    const key = q.get('key') || '';
    if (!/^contributions\/[A-Za-z0-9][A-Za-z0-9_.\-]{2,}\/[A-Za-z0-9_.\-\/]+\.json$/.test(key)) return json({ error: 'Invalid key' }, 400, cors);
    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > UPLOAD_OBJECT_MAX) return json({ error: 'Object too large' }, 413, cors);
    await bucket.put(key, request.body, { httpMetadata: { contentType: 'application/json' } });
    return json({ key }, 200, cors);
  }
  return json({ error: 'Not found' }, 404, cors);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = allowedOrigins(env);
    const originOk = allowed.includes(origin);
    const cors = originOk ? corsHeaders(origin) : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    }
    if (!originOk) return json({ error: 'Forbidden origin' }, 403);
    const url = new URL(request.url);
    if (url.pathname === '/upload' || url.pathname.startsWith('/upload/')) {
      try { return await handleUpload(request, env, url, cors); }
      catch (err) { return json({ error: 'Upload failed', detail: err && err.message ? err.message : String(err) }, 500, cors); }
    }
    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return json({ error: 'Not found' }, 404, cors);
    }
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY secret is not set' }, 503, cors);

    let payload;
    try { payload = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400, cors); }
    const contents = buildContents(payload || {});
    if (!contents) return json({ error: 'Invalid message' }, 400, cors);

    const body = {
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
    };
    if (typeof payload.system === 'string' && payload.system.trim()) {
      body.systemInstruction = { parts: [{ text: payload.system.slice(0, MAX_SYSTEM_CHARS) }] };
    }

    const models = [env.GEMINI_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i);
    let lastErr = null;
    for (const model of models) {
      let attempt = 0;
      while (true) {
        try {
          const text = await callGemini(env, model, body);
          return json({ text, model }, 200, cors);
        } catch (err) {
          lastErr = err;
          if (/location is not supported/i.test(err.message || '') && attempt < LOCATION_RETRIES) { attempt++; continue; }
          break;
        }
      }
      // Only fall through to the next model on capacity / rate problems.
      if (![429, 500, 503, 504].includes(lastErr.status)) break;
    }
    const status = lastErr && [400, 401, 403, 404, 429].includes(lastErr.status) ? lastErr.status : 502;
    return json({ error: 'Gemini API request failed', detail: lastErr ? lastErr.message : 'unknown' }, status, cors);
  },
};
