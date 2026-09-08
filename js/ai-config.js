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
 *   'pollinations' Free anonymous model at text.pollinations.ai (no key).
 *   'local'        Built-in knowledge base only, no network calls.
 */
window.BATTERYLAKE_AI_CONFIG = {
  provider: 'gemini',
  // Free-tier Gemini key owned by the BatteryLake team. Google does not allow
  // website restrictions on Gemini keys, so it is public by design; the
  // project has no billing account, so abuse can only exhaust the daily quota
  // (the widget then falls back to the built-in knowledge base).
  apiKey: 'AQ.Ab8RN6L9uS2gJwr8e3lZ0xFL5mC7XHuWCRMD2VHfSBRGuj1xVw',
  model: 'gemini-flash-lite-latest',
  endpoint: '',
  timeoutMs: 20000
};
