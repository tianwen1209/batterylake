/* BatteryLake AI assistant — public configuration.
 *
 * This file is served to every visitor, so only put a key here when the key is
 * restricted to this website's URL (Gemini keys can be limited to
 * "https://tianwen1209.github.io/*" under Website restrictions in Google
 * Cloud Console). Anything left empty is simply skipped.
 *
 * provider:
 *   'auto'         (default) Gemini if apiKey is set, else a custom endpoint if
 *                  set, else the free Pollinations model, else the built-in
 *                  knowledge base. Every option falls back to the knowledge
 *                  base when the remote model is unavailable.
 *   'gemini'       Google Gemini REST API called directly from the browser.
 *   'openai'       Any OpenAI-compatible /chat/completions endpoint (Groq,
 *                  OpenRouter, a Cloudflare Worker proxy, vLLM, Ollama, ...).
 *   'backend'      The bundled app.py backend (POST /api/chat, {message}).
 *   'worker'       A Cloudflare Worker proxy: POST {message} -> {text}; system
 *                  prompt and history are folded into the message.
 *   'pollinations' Free anonymous model at text.pollinations.ai (no key).
 *   'local'        Built-in knowledge base only, no network calls.
 */
window.BATTERYLAKE_AI_CONFIG = {
  // Gemini behind the team's Cloudflare Worker: the key lives in the Worker's
  // secrets and the Worker only accepts requests from this site's origin.
  provider: 'worker',
  apiKey: '',
  model: '',
  endpoint: 'https://tianwen-gemini-proxy.tianwen-4e0.workers.dev/chat',
  timeoutMs: 25000,
  // Optional direct raw-data upload for the Contribute page. Leave empty (the
  // page then asks for a download link). To enable, point it at a receiver
  // implementing the upload protocol: the Worker with an R2 bucket bound as
  // CONTRIB_BUCKET, or app.py (/upload/*) on your own HTTPS host.
  uploadEndpoint: ''
};
