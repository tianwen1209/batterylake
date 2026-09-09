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

function allowedOrigins(env) {
  const raw = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return raw.length ? raw : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      try {
        const text = await callGemini(env, model, body);
        return json({ text, model }, 200, cors);
      } catch (err) {
        lastErr = err;
        // Only fall through to the next model on capacity / rate problems.
        if (![429, 500, 503, 504].includes(err.status)) break;
      }
    }
    const status = lastErr && [400, 401, 403, 404, 429].includes(lastErr.status) ? lastErr.status : 502;
    return json({ error: 'Gemini API request failed', detail: lastErr ? lastErr.message : 'unknown' }, status, cors);
  },
};
