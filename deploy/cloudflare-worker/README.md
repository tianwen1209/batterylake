# Gemini proxy on Cloudflare Workers

The hosted site (GitHub Pages) cannot keep a secret, so the AI assistant talks
to Gemini through a small Cloudflare Worker that holds the API key and only
accepts requests from the BatteryLake origin. `worker.js` in this folder is the
reference implementation.

## Contract

`POST https://<worker>/chat` with JSON:

| field | type | notes |
|---|---|---|
| `question` | string | the user's latest message |
| `system` | string | optional system prompt (site context) |
| `history` | `[{role, content}]` | optional, last turns; `role` = `user` / `assistant` |
| `message` | string | legacy: one pre-built prompt (used when `question` is absent) |

Response: `{ "text": "...", "model": "gemini-flash-lite-latest" }`, or
`{ "error": "...", "detail": "..." }` with a 4xx/5xx status. The website
(`js/assistant.js`, provider `worker`) sends all four fields, so both this
Worker and a minimal `{message} -> {text}` Worker work.

## Deploy / update

1. https://dash.cloudflare.com → **Workers & Pages** → open the worker
   (`tianwen-gemini-proxy`) → **Edit code** → replace everything with
   `worker.js` → **Deploy**.
2. **Settings → Variables and Secrets** → add a **Secret** named
   `GEMINI_API_KEY` with the Gemini key (from https://aistudio.google.com/apikey).
3. Optional plain variables: `GEMINI_MODEL` (default `gemini-flash-lite-latest`,
   falls back to `gemini-flash-latest` and `gemini-3.5-flash-lite` on 429/503),
   `ALLOWED_ORIGINS` (comma separated; default allows
   `https://tianwen1209.github.io` plus `localhost` / `127.0.0.1` on ports 8000
   and 8767 for local testing).
4. Point the site at it in `js/ai-config.js`:

```js
provider: 'worker',
endpoint: 'https://tianwen-gemini-proxy.tianwen-4e0.workers.dev/chat',
```

## Quick test

```bash
curl -s -X POST https://tianwen-gemini-proxy.tianwen-4e0.workers.dev/chat \
  -H 'Content-Type: application/json' -H 'Origin: https://tianwen1209.github.io' \
  -d '{"question":"How many datasets are in BatteryLake?","system":"BatteryLake has 40 datasets."}'
```

Without the `Origin` header the Worker answers `403 Forbidden origin`, which is
the intended behaviour. Free-tier Gemini allows roughly 15 requests per minute;
bursts beyond that come back as `429` and the site falls back to its built-in
answers until the next request.

## Dataset contributions (raw-data upload)

The Contribute page uploads raw files straight from the browser into an R2
bucket through this Worker (chunked, 16 MiB parts, resumable per part).

1. Cloudflare dashboard → **R2** → Create bucket, e.g. `batterylake-contributions`.
2. Worker → **Settings → Bindings → Add → R2 bucket** → variable name
   `CONTRIB_BUCKET`, pick the bucket → Deploy (redeploy `worker.js` if it is
   older than this section).
3. Optional variable `MAX_UPLOAD_GB` (default 50) caps one file.

Objects land under `contributions/<ref_name>/raw_data/<file>` plus
`contributions/<ref_name>/submission.json` (metadata, notes, checklist, file
list). Until the binding exists `/upload/status` answers `enabled: false` and
the page asks for a download link instead. Free R2 tier: 10 GB storage;
beyond that about USD 0.015 per GB-month, no egress fees.

The same protocol is implemented by `app.py` (`/upload/*`, files under
`contributions/`), so a self-hosted receiver works too: set
`uploadEndpoint` in `js/ai-config.js` to `https://<your host>/upload`.
