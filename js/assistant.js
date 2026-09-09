/* BatteryLake AI assistant widget.
 *
 * Answer sources, tried in order (see js/ai-config.js):
 *   1. a remote language model — Gemini (browser key), any OpenAI-compatible
 *      endpoint, the bundled app.py backend, or the free Pollinations model;
 *   2. the built-in knowledge base (js/assistant-knowledge.js), which also
 *      supplies grounding context to the remote model and is the fallback
 *      whenever the remote model is unavailable.
 */
(function setupAIChat() {
  const panel = document.getElementById('aiChatPanel');
  const toggle = document.getElementById('aiChatToggle');
  const close = document.getElementById('aiChatClose');
  const clearBtn = document.getElementById('aiChatClear');
  const form = document.getElementById('aiChatForm');
  const input = document.getElementById('aiChatInput');
  const messages = document.getElementById('aiChatMessages');
  const subtitleEl = document.getElementById('aiChatSubtitle');
  const statusTextEl = document.getElementById('aiChatStatusText');
  const statusDot = panel ? panel.querySelector('.ai-chat-status-dot') : null;
  if (!panel || !toggle || !form || !input || !messages) return;
  const sendButton = form.querySelector('button[type="submit"]');
  const suggestions = document.querySelectorAll('.ai-suggestion');
  const suggestionMenu = panel.querySelector('.ai-chat-suggestions');
  const modeButtons = panel.querySelectorAll('[data-ai-mode]');
  const modeToolbar = document.getElementById('aiModeToolbar');
  const modeOptions = document.getElementById('aiModeOptions');
  const modeCollapse = document.getElementById('aiModeCollapse');
  const modeSummary = document.getElementById('aiModeSummary');
  const agentMessages = document.getElementById('aiAgentMessages');
  let activeMode = 'chat';
  let sending = false;
  const STORAGE_KEY = 'batteryLakeAiChatHistoryV2';
  const KB = window.BatteryLakeKnowledge || null;
  const CONFIG = Object.assign({ provider: 'auto', apiKey: '', model: '', endpoint: '', timeoutMs: 20000 }, window.BATTERYLAKE_AI_CONFIG || {});
  const IS_LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
  const LOCAL_BACKEND_URL = 'http://127.0.0.1:8000/api/chat';

  const batteryBotIcon = `
    <svg class="ai-battery-bot" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="11" y="9" width="26" height="30" rx="7" fill="#ffffff" stroke="#bfdbfe" stroke-width="1.5"/>
      <rect x="19" y="5" width="10" height="5" rx="2" fill="#93c5fd"/>
      <rect x="15" y="14" width="18" height="16" rx="4" fill="#dbeafe"/>
      <rect x="18" y="25" width="12" height="8" rx="3" fill="#22c55e"/>
      <circle cx="20" cy="21" r="2" fill="#1d4ed8"/>
      <circle cx="28" cy="21" r="2" fill="#1d4ed8"/>
      <path d="M21 27h6" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M11 22H6M37 22h5M17 39l-3 4M31 39l3 4" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;

  const SHOW_SOURCE_TAGS = false;
  const welcomeText = 'Hi! I answer questions about BatteryLake: catalog numbers, individual datasets, the processing skill, status.json, benchmarks and citation. Ask in English or 中文.';

  /* ── state ─────────────────────────────────────────────────────── */
  const state = {
    provider: null,          // resolved provider id
    ready: false,
    probing: null,           // promise while probing a remote provider
    dead: new Set(),         // providers that failed permanently this session
    cooldownUntil: {},       // provider -> timestamp until which it is skipped
    history: []              // [{role:'user'|'assistant', text}]
  };

  /* ── history (localStorage) ────────────────────────────────────── */
  function readHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(history) ? history : [];
    } catch (_) {
      return [];
    }
  }
  function writeHistory(history) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-80))); } catch (_) { /* storage may be unavailable */ }
  }
  function saveMessage(text, type, time, source) {
    const history = readHistory();
    history.push({ text, type, time, source: source || '' });
    writeHistory(history);
    state.history.push({ role: type === 'user' ? 'user' : 'assistant', text });
    if (state.history.length > 12) state.history = state.history.slice(-12);
  }

  /* ── rendering ─────────────────────────────────────────────────── */
  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderInline(text) {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, (_, code) => '<code>' + code + '</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      if (/^dataset:/.test(href)) return '<a href="#datasets" data-dataset="' + escapeHtml(href.slice(8)) + '">' + label + '</a>';
      if (/^#[a-z][\w-]*$/i.test(href)) return '<a href="' + href + '" data-page="' + href.slice(1) + '">' + label + '</a>';
      if (/^(https?:\/\/|skill\/|assets\/|docs\/)/.test(href)) return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">' + label + '</a>';
      return label;
    });
    return html;
  }
  /* Tiny markdown subset: paragraphs, "- " bullets, **bold**, `code`, links. */
  function renderMarkdownLite(text) {
    const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/);
    return blocks.map(block => {
      const lines = block.split('\n');
      const out = [];
      let list = [];
      const flushList = () => { if (list.length) { out.push('<ul>' + list.map(l => '<li>' + renderInline(l) + '</li>').join('') + '</ul>'); list = []; } };
      let para = [];
      const flushPara = () => { if (para.length) { out.push('<p>' + para.map(renderInline).join('<br>') + '</p>'); para = []; } };
      lines.forEach(line => {
        const m = line.match(/^\s*[-*•]\s+(.*)$/);
        if (m) { flushPara(); list.push(m[1]); }
        else if (line.trim()) { flushList(); para.push(line); }
      });
      flushList(); flushPara();
      return out.join('');
    }).join('');
  }

  function formatMessageTime(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return date.toLocaleString('en-US', sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /* Sender name shown above every assistant bubble: which source produced the answer. */
  function senderName(source) {
    switch (source) {
      case 'gemini': case 'worker': return 'Gemini';
      case 'openai': return 'Model';
      case 'backend': return 'Local backend';
      case 'pollinations': return 'Free model';
      case 'kb': case 'dataset': case 'fallback': case 'local': return 'Site knowledge';
      case 'agent-model': return 'Agent · Gemini';
      case 'agent-rules': return 'Agent · rules';
      default: return '';
    }
  }
  function senderClass(source) {
    return /^(gemini|worker|openai|backend|pollinations|agent-model)$/.test(source || '') ? 'is-model' : 'is-site';
  }

  /* Per-message source tags are not shown (the sender name above the bubble covers it). */
  function sourceLabel(source) {
    if (!SHOW_SOURCE_TAGS) return '';
    switch (source) {
      case 'gemini': return 'Gemini';
      case 'openai': return 'Model';
      case 'backend': return 'Local backend';
      case 'pollinations': return 'Free model';
      case 'kb': case 'dataset': case 'fallback': case 'local': return 'Built-in knowledge';
      default: return '';
    }
  }

  function addMessage(text, type, options = {}) {
    const time = options.time || new Date().toISOString();
    const item = document.createElement('div');
    item.className = `ai-msg ai-msg-${type}`;
    const bubble = document.createElement('span');
    bubble.className = 'ai-msg-bubble';
    let sender = null;
    if (type === 'bot') {
      sender = document.createElement('span');
      sender.className = 'ai-msg-sender';
      const name = senderName(options.source);
      sender.textContent = name;
      sender.hidden = !name;
      sender.classList.add(senderClass(options.source));
      bubble.appendChild(sender);
    }
    const content = document.createElement('span');
    content.className = 'ai-msg-text';
    if (type === 'bot') { content.classList.add('is-rich'); content.innerHTML = renderMarkdownLite(text); }
    else content.textContent = text;
    const meta = document.createElement('span');
    meta.className = 'ai-msg-meta';
    const src = sourceLabel(options.source);
    if (type === 'bot' && src) {
      const tag = document.createElement('span');
      tag.className = 'ai-msg-source';
      tag.textContent = src;
      meta.appendChild(tag);
    }
    const timestamp = document.createElement('span');
    timestamp.className = 'ai-msg-time';
    timestamp.textContent = formatMessageTime(time);
    meta.appendChild(timestamp);
    bubble.append(content, meta);
    if (type === 'bot') {
      const avatar = document.createElement('span');
      avatar.className = 'ai-msg-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.innerHTML = batteryBotIcon;
      item.append(avatar, bubble);
    } else {
      item.appendChild(bubble);
    }
    const container = options.container || messages;
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
    return { text: content, meta, bubble, sender };
  }

  function setPanelOpen(isOpen) {
    panel.classList.toggle('open', isOpen);
    document.body.classList.toggle('ai-panel-open', isOpen);
    if (isOpen) { input.focus(); void ensureProvider(); }
  }
  const AGENT_WELCOME = 'Agent mode: tell me what to do on the site and I will do it — open a dataset or its quality report, filter the catalog, download the processing skill, switch pages or theme, or start a dataset contribution.\n\nExample: "I want to contribute a dataset: 24 NMC 21700 cells from NTU, 2025, 1C/1C at 25 °C, 4.0 Ah, CC BY" fills the contribution form; then "what is still missing?" and "submit my contribution" finish it. Try the suggestions below.';
  const CHAT_SUGGESTIONS = [
    ['Catalog numbers', 'How many datasets, cells and cycles are in BatteryLake?'],
    ['LFP datasets', 'Which datasets are LFP?'],
    ['Install the skill', 'How do I install and run the batterylake-processing skill?'],
    ['How to contribute', 'How do I contribute my own dataset to BatteryLake?']
  ];
  const AGENT_SUGGESTIONS = [
    ['Open dataset_21 report', 'Open the quality report of dataset_21'],
    ['Filter LFP pouch', 'Filter the catalog to LFP pouch datasets'],
    ['Download the skill', 'Download the processing skill'],
    ['Contribute a dataset', 'I want to contribute a dataset: 24 NMC 21700 cells from NTU, 2025, 1C/1C at 25 °C, 4.0 Ah, license CC BY — fill the form and tell me what is still missing']
  ];
  function renderSuggestions(list) {
    if (!suggestionMenu) return;
    suggestionMenu.innerHTML = list.map(([label, prompt]) => `<button class="ai-suggestion" type="button" data-prompt="${prompt.replace(/"/g, '&quot;')}">${label}</button>`).join('');
    suggestionMenu.querySelectorAll('.ai-suggestion').forEach(button => {
      button.addEventListener('click', () => { setPanelOpen(true); sendMessage(button.dataset.prompt || button.textContent); });
    });
  }
  function setMode(mode) {
    activeMode = mode === 'agent' ? 'agent' : 'chat';
    const isAgent = activeMode === 'agent';
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.aiMode === activeMode)));
    modeSummary.textContent = isAgent ? 'Agent mode' : 'Chat mode';
    messages.hidden = isAgent;
    agentMessages.hidden = !isAgent;
    input.placeholder = isAgent ? 'Tell me what to do, e.g. "open dataset_21 quality report"' : 'Ask a question...';
    renderSuggestions(isAgent ? AGENT_SUGGESTIONS : CHAT_SUGGESTIONS);
    if (isAgent && !agentMessages.childElementCount) {
      addMessage(AGENT_WELCOME, 'bot', { container: agentMessages, source: 'agent-rules' });
    }
    applyProviderStatus();
    if (!isAgent) messages.scrollTop = messages.scrollHeight;
    else agentMessages.scrollTop = agentMessages.scrollHeight;
    resizeInput();
    if (panel.classList.contains('open')) { input.focus(); void ensureProvider(); }
  }
  function setTyping(el) {
    el.innerHTML = '<span class="ai-typing" aria-label="Thinking"><span></span><span></span><span></span></span>';
  }
  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 116) + 'px';
  }
  function setStatus(mode, subtitle, statusText) {
    if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;
    if (statusTextEl && statusText) statusTextEl.textContent = statusText;
    if (statusDot) {
      statusDot.classList.remove('is-online', 'is-busy', 'is-offline');
      statusDot.classList.add(mode === 'online' ? 'is-online' : mode === 'busy' ? 'is-busy' : 'is-offline');
    }
  }

  function showWelcome() {
    messages.innerHTML = '';
    addMessage(welcomeText, 'bot', { source: 'kb' });
  }
  function restoreHistory() {
    const history = readHistory();
    if (!history.length) { showWelcome(); return; }
    messages.innerHTML = '';
    history.forEach(entry => {
      if (!entry || !entry.text || !entry.type) return;
      addMessage(entry.text, entry.type, { time: entry.time, source: entry.source });
      state.history.push({ role: entry.type === 'user' ? 'user' : 'assistant', text: entry.text });
    });
    state.history = state.history.slice(-12);
  }
  function clearConversation() {
    if (activeMode === 'agent') {
      agent.history = [];
      agentMessages.innerHTML = '';
      addMessage(AGENT_WELCOME, 'bot', { container: agentMessages, source: 'agent-rules' });
      input.focus();
      return;
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    state.history = [];
    showWelcome();
    input.focus();
  }

  /* ── providers ─────────────────────────────────────────────────── */
  function fetchWithTimeout(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms || CONFIG.timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal })).finally(() => clearTimeout(timer));
  }
  // Agent mode swaps the prompt and the conversation history while a request runs.
  let promptOverride = null;
  let historyOverride = null;
  let timeoutOverride = 0;       // ms; agent planning allows a slower answer
  function systemPrompt(question) {
    if (promptOverride) return promptOverride(question);
    const prevUser = state.history.filter(m => m.role === 'user').slice(-1)[0];
    const ctx = KB ? KB.context(question, prevUser ? prevUser.text : '') : '';
    const zh = KB && typeof KB.isChinese === 'function' ? KB.isChinese(question) : /[\u3400-\u9fff]/.test(question);
    return [
      'You are the BatteryLake AI Assistant embedded in the BatteryLake website (battery aging datasets, SOH/RUL benchmarking).',
      zh ? 'The user wrote in Chinese: answer in Chinese (简体中文).' : 'The user wrote in English: answer in English only.',
      'Quote numbers exactly as given in the context (e.g. 55,300 cycles), never rescale them.',
      'Be concise: at most about 150 words, plain sentences or short "- " bullet lists; no headings, no tables.',
      'Plain text only: no LaTeX or math markup (write LiFePO4, NMC811, 80% SOH), no HTML.',
      'For facts about BatteryLake itself (datasets, numbers, pages, workflow) rely on the site context below; if it does not cover a BatteryLake detail, say so and point to the relevant page.',
      'For general battery science or machine-learning questions (chemistries, aging mechanisms, SOH/RUL methods, protocols), answer from your own knowledge like a helpful battery researcher.',
      'When you mention a page, link it in markdown using its hash, e.g. [Datasets](#datasets), [Preprocessing](#preprocessing). Link datasets as [Name](dataset:dataset_id).',
      '',
      '=== Site context ===',
      ctx
    ].join('\n');
  }
  function historyMessages() {
    const src = historyOverride ? historyOverride() : state.history;
    return src.slice(-8).map(m => ({ role: m.role, content: m.text }));
  }

  const GEMINI_FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function isTransient(status, message) {
    // "User location is not supported" comes from a Cloudflare edge egressing via a
    // region Gemini blocks; the next request usually lands elsewhere, so retry.
    return status === 429 || status === 503 || status === 500 || status === 502 || status === 504 || /high demand|overloaded|temporar|quota|rate|location is not supported|failed to fetch|networkerror|load failed|aborted/i.test(message || '');
  }

  async function askGeminiModel(question, model) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(CONFIG.apiKey);
    const contents = historyMessages().map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
    contents.push({ role: 'user', parts: [{ text: question }] });
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(question) }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 600 } })
    }, timeoutOverride || 15000);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data.error && data.error.message) || ('Gemini HTTP ' + res.status));
      err.status = res.status;
      err.transient = isTransient(res.status, err.message);
      throw err;
    }
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned no text');
    return text;
  }

  /* Try the configured model, then the fallback models; retry transient
     "high demand" / rate-limit answers once before giving up. */
  async function askGemini(question) {
    const models = [CONFIG.model].concat(GEMINI_FALLBACK_MODELS).filter((m, i, a) => m && a.indexOf(m) === i);
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const model of models) {
        try {
          return await askGeminiModel(question, model);
        } catch (err) {
          lastErr = err;
          if (err.name === 'AbortError') { err.transient = true; continue; }
          if (!err.transient) throw err;       // bad key, blocked model, etc.: no point retrying
        }
      }
      await sleep(1200);
    }
    throw lastErr || new Error('Gemini unavailable');
  }

  async function askOpenAI(question, url, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (CONFIG.apiKey && !opts.anonymous) headers.Authorization = 'Bearer ' + CONFIG.apiKey;
    let msgs;
    if (opts.foldSystem) {
      // Some free endpoints reject the system role; fold instructions into the first user turn.
      const hist = historyMessages();
      msgs = hist.length ? [{ role: 'user', content: systemPrompt(question) + '\n\n(Conversation continues below.)' }, { role: 'assistant', content: 'Understood.' }].concat(hist) : [];
      msgs.push({ role: 'user', content: (hist.length ? '' : systemPrompt(question) + '\n\n=== User message ===\n') + question });
    } else {
      msgs = [{ role: 'system', content: systemPrompt(question) }].concat(historyMessages(), [{ role: 'user', content: question }]);
    }
    const body = { model: opts.model || CONFIG.model || undefined, messages: msgs, temperature: 0.3, max_tokens: 600 };
    if (!body.model) delete body.model;
    const res = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, opts.timeoutMs);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && (data.error.message || data.error)) || ('HTTP ' + res.status));
    const text = (((data.choices || [])[0] || {}).message || {}).content || data.reply || '';
    if (!String(text).trim()) throw new Error('Empty model response');
    return String(text).trim();
  }

  async function askBackend(question, url) {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, context: KB ? KB.context(question) : '', history: historyMessages() })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Backend HTTP ' + res.status));
    const text = data.reply || data.response || data.message || '';
    if (!String(text).trim()) throw new Error('Empty backend response');
    return String(text).trim();
  }

  /* Cloudflare Worker proxy (keeps the Gemini key server-side). Contract:
     POST {message: string} -> {text: string}. It takes no system prompt or
     history, so both are folded into the single message. */
  async function askWorker(question, url) {
    // The minimal Worker rejects very long messages, so keep the folded prompt
    // under ~3900 characters: drop old history first, then trim the context.
    const LIMIT = 3900;   // the minimal Worker rejects messages above ~4000 characters
    let hist = historyMessages();
    let system = systemPrompt(question);
    const build = () => {
      const convo = hist.map(m => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content.slice(0, 600)).join('\n');
      return system + '\n\n=== Conversation ===\n' + (convo ? convo + '\n' : '') + 'User: ' + question.slice(0, 1500) + '\nAssistant:';
    };
    let message = build();
    while (message.length > LIMIT && hist.length) { hist = hist.slice(1); message = build(); }
    if (message.length > LIMIT) { system = system.slice(0, Math.max(800, system.length - (message.length - LIMIT))); message = build(); }
    // `message` is the whole prompt for the minimal Worker; a Worker built from
    // deploy/cloudflare-worker/worker.js prefers question + system + history.
    const payload = JSON.stringify({ message, question, system: systemPrompt(question), history: hist });
    // A Cloudflare edge occasionally egresses through a region Gemini blocks
    // ("User location is not supported"); a new request usually succeeds.
    for (let attempt = 0; ; attempt++) {
      const res = await fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }, timeoutOverride || 25000);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = data.text || data.reply || data.response || '';
        if (!String(text).trim()) throw new Error('Empty proxy response');
        return String(text).trim();
      }
      const err = new Error((data.error || ('Proxy HTTP ' + res.status)) + (data.detail ? ': ' + data.detail : ''));
      err.status = res.status;
      err.transient = isTransient(res.status, err.message);
      if (/location is not supported/i.test(err.message) && attempt < 2) continue;
      throw err;
    }
  }

  function askRemote(provider, question) {
    switch (provider) {
      case 'gemini': return askGemini(question);
      case 'worker': return askWorker(question, CONFIG.endpoint);
      case 'openai': return askOpenAI(question, CONFIG.endpoint);
      case 'backend': return askBackend(question, CONFIG.endpoint || LOCAL_BACKEND_URL);
      case 'pollinations': return askOpenAI(question, POLLINATIONS_URL, { anonymous: true, foldSystem: true, model: 'openai', timeoutMs: 15000 });
      default: return Promise.reject(new Error('No remote provider'));
    }
  }

  const PROVIDER_LABELS = {
    gemini: { subtitle: 'Gemini · free tier', status: 'Model connected' },
    worker: { subtitle: 'Gemini · via proxy', status: 'Model connected' },
    openai: { subtitle: 'Custom model endpoint', status: 'Model connected' },
    backend: { subtitle: 'Local app.py backend', status: 'Backend connected' },
    pollinations: { subtitle: 'Free model · Pollinations', status: 'Model connected' },
    local: { subtitle: 'BatteryLake assistant', status: 'Online' }
  };

  function candidateProviders() {
    const p = String(CONFIG.provider || 'auto').toLowerCase();
    if (p !== 'auto') return [p];
    const list = [];
    if (CONFIG.apiKey && (!CONFIG.endpoint || /gemini/i.test(CONFIG.model))) list.push('gemini');
    if (CONFIG.endpoint) list.push(/\/api\/chat$/.test(CONFIG.endpoint) ? 'backend' : /workers\.dev|\/chat$/.test(CONFIG.endpoint) ? 'worker' : 'openai');
    if (IS_LOCALHOST) list.push('backend');
    list.push('pollinations');
    return list;
  }

  /* Probe remote providers once per session with a throw-away request so a
     dead service never delays the first real answer. */
  async function probe(provider) {
    if (provider === 'local') return true;
    if (provider === 'backend') {
      const res = await fetchWithTimeout(CONFIG.endpoint || LOCAL_BACKEND_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'ping' })
      }, 4000);
      return res.ok;
    }
    if (provider === 'pollinations') {
      const nonce = Math.random().toString(36).slice(2, 8);
      const res = await fetchWithTimeout(POLLINATIONS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: 'Reply with the word OK. (' + nonce + ')' }] })
      }, 12000);
      return res.ok;
    }
    // Gemini / OpenAI / worker proxy: a configured key or endpoint is trusted until a real call fails.
    return provider === 'gemini' ? !!CONFIG.apiKey : !!CONFIG.endpoint;
  }

  function ensureProvider() {
    if (state.ready) return Promise.resolve(state.provider);
    if (state.probing) return state.probing;
    setStatus('busy', PROVIDER_LABELS.local.subtitle, 'Connecting…');
    state.probing = (async () => {
      for (const provider of candidateProviders()) {
        if (provider === 'local') break;
        try {
          if (await probe(provider)) { state.provider = provider; break; }
        } catch (_) { /* fall through */ }
        state.dead.add(provider);
      }
      if (!state.provider) state.provider = 'local';
      state.ready = true;
      applyProviderStatus();
      return state.provider;
    })();
    return state.probing;
  }
  function applyProviderStatus() {
    const active = remoteAvailable(state.provider) ? state.provider : 'local';
    let l = PROVIDER_LABELS[active] || PROVIDER_LABELS.local;
    if (activeMode === 'agent') l = { subtitle: 'Agent · ' + (active === 'local' ? 'rule-based planner' : 'Gemini plans the actions'), status: l.status };
    if (active === 'local' && state.provider !== 'local' && state.cooldownUntil[state.provider] > Date.now()) {
      setStatus('busy', l.subtitle, 'Model busy · retrying shortly');
      return;
    }
    setStatus('online', l.subtitle, l.status);
  }
  /* A failed remote call parks the provider for a cooldown instead of the whole
     session, so a temporary "high demand" answer does not disable the model. */
  const COOLDOWN_MS = 90000;
  const SHORT_COOLDOWN_MS = 15000;   // location / capacity blips clear quickly
  function demoteProvider(reason, transient) {
    console.warn('AI assistant: ' + state.provider + ' unavailable (' + reason + '); using built-in knowledge base' + (transient ? ' for a while.' : '.'));
    const brief = /location is not supported|high demand|overloaded/i.test(reason || '');
    if (transient) state.cooldownUntil[state.provider] = Date.now() + (brief ? SHORT_COOLDOWN_MS : COOLDOWN_MS);
    else state.dead.add(state.provider);
    applyProviderStatus();
  }
  function remoteAvailable(provider) {
    if (!provider || provider === 'local' || state.dead.has(provider)) return false;
    return !(state.cooldownUntil[provider] > Date.now());
  }

  /* ── answering ─────────────────────────────────────────────────── */
  function localAnswer(question) {
    if (KB) return KB.answer(question);
    return { text: 'The assistant knowledge base failed to load. Please refresh the page.', source: 'fallback' };
  }

  async function answer(question) {
    // Do not wait more than a moment for the initial probe; the knowledge base can answer immediately.
    await Promise.race([ensureProvider(), new Promise(resolve => setTimeout(resolve, 1500))]);
    const provider = state.ready ? state.provider : 'local';
    if (!remoteAvailable(provider)) return localAnswer(question);
    try {
      const text = await askRemote(provider, question);
      if (state.cooldownUntil[provider]) { delete state.cooldownUntil[provider]; applyProviderStatus(); }
      return { text, source: provider };
    } catch (err) {
      const msg = err && err.message ? err.message : 'error';
      demoteProvider(msg, !!(err && (err.transient || err.name === 'AbortError')) || isTransient(err && err.status, msg));
      return localAnswer(question);
    }
  }

  /* ── Agent mode ────────────────────────────────────────────────── */
  const ACTIONS = window.BatteryLakeActions || null;
  const agent = { history: [] };   // [{role, text}] for the planner

  async function planAgent(command) {
    if (!ACTIONS) return { actions: [], reply: 'Agent tools failed to load. Please refresh the page.', source: 'agent-rules' };
    await Promise.race([ensureProvider(), new Promise(resolve => setTimeout(resolve, 1500))]);
    const provider = state.ready ? state.provider : 'local';
    if (remoteAvailable(provider)) {
      promptOverride = ACTIONS.plannerPrompt;
      historyOverride = () => agent.history;
      timeoutOverride = 45000;
      try {
        const text = await askRemote(provider, command);
        const plan = ACTIONS.parsePlan(text);
        if (plan) return Object.assign(plan, { source: 'agent-model' });
        console.warn('AI agent: model reply was not a plan, using rules:', String(text).slice(0, 200));
      } catch (err) {
        const msg = err && err.message ? err.message : 'error';
        demoteProvider(msg, !!(err && (err.transient || err.name === 'AbortError')) || isTransient(err && err.status, msg));
      } finally {
        promptOverride = null;
        historyOverride = null;
        timeoutOverride = 0;
      }
    }
    return Object.assign(ACTIONS.planLocally(command), { source: 'agent-rules' });
  }

  function renderAgentResult(el, plan, results) {
    const zh = KB && KB.isChinese ? KB.isChinese(plan.reply || '') : false;
    let html = plan.reply ? renderMarkdownLite(plan.reply) : '';
    if (results.length) {
      html += '<ul class="ai-actions">' + results.map(r =>
        `<li class="ai-action ${r.ok ? 'ok' : 'fail'}"><span class="ai-action-icon" aria-hidden="true">${r.ok ? '✓' : '!'}</span><span>${renderInline(r.summary || r.tool)}</span></li>`
      ).join('') + '</ul>';
    } else if (!plan.reply) {
      html = renderMarkdownLite(zh ? '没有可执行的操作。' : 'Nothing to do.');
    }
    el.innerHTML = html;
  }

  async function runAgentCommand(command) {
    const userTime = new Date().toISOString();
    addMessage(command, 'user', { time: userTime, container: agentMessages });
    agent.history.push({ role: 'user', text: command });
    const loading = addMessage('', 'bot', { container: agentMessages });
    setTyping(loading.text);
    let plan;
    try {
      plan = await planAgent(command);
    } catch (err) {
      plan = { actions: [], reply: 'Planning failed: ' + (err && err.message ? err.message : 'unknown error'), source: 'agent-rules' };
    }
    let results = [];
    try { results = await ACTIONS.execute(plan.actions); } catch (err) { results = [{ ok: false, summary: (err && err.message) || 'failed' }]; }
    renderAgentResult(loading.text, plan, results);
    if (loading.sender) {
      const name = senderName(plan.source);
      loading.sender.textContent = name;
      loading.sender.hidden = !name;
      loading.sender.classList.remove('is-model', 'is-site');
      loading.sender.classList.add(senderClass(plan.source));
    }
    const transcript = (plan.reply || '') + (results.length ? '\n' + results.map(r => (r.ok ? 'done: ' : 'failed: ') + r.tool + ' ' + JSON.stringify(r.args || {})).join('\n') : '');
    agent.history.push({ role: 'assistant', text: transcript.slice(0, 1200) });
    if (agent.history.length > 10) agent.history = agent.history.slice(-10);
    agentMessages.scrollTop = agentMessages.scrollHeight;
    if (results.some(r => r.ok && r.navigated) && window.innerWidth <= 760) setPanelOpen(false);
  }

  async function sendMessage(message) {
    if (sending) return;
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    if (activeMode === 'agent') {
      sending = true;
      input.value = '';
      resizeInput();
      input.disabled = true;
      sendButton.disabled = true;
      try { await runAgentCommand(cleanMessage); }
      finally { sending = false; input.disabled = false; sendButton.disabled = false; if (panel.classList.contains('open')) input.focus(); }
      return;
    }
    sending = true;
    const userTime = new Date().toISOString();
    addMessage(cleanMessage, 'user', { time: userTime });
    saveMessage(cleanMessage, 'user', userTime);
    input.value = '';
    resizeInput();
    input.disabled = true;
    sendButton.disabled = true;
    const loadingTime = new Date().toISOString();
    const loading = addMessage('', 'bot', { time: loadingTime });
    setTyping(loading.text);
    try {
      const result = await answer(cleanMessage);
      loading.text.innerHTML = renderMarkdownLite(result.text);
      if (loading.sender) {
        const name = senderName(result.source);
        loading.sender.textContent = name;
        loading.sender.hidden = !name;
        loading.sender.classList.remove('is-model', 'is-site');
        loading.sender.classList.add(senderClass(result.source));
      }
      const src = sourceLabel(result.source);
      if (src) {
        const tag = document.createElement('span');
        tag.className = 'ai-msg-source';
        tag.textContent = src;
        loading.meta.prepend(tag);
      }
      saveMessage(result.text, 'bot', loadingTime, result.source);
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      const fallback = 'Something went wrong while answering. Please try again.';
      loading.text.textContent = fallback;
      saveMessage(fallback, 'bot', loadingTime, 'fallback');
    } finally {
      sending = false;
      input.disabled = false;
      sendButton.disabled = false;
      if (panel.classList.contains('open')) input.focus();
    }
  }

  /* ── events ────────────────────────────────────────────────────── */
  modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.aiMode)));
  modeCollapse.addEventListener('click', () => {
    const collapsed = modeCollapse.getAttribute('aria-expanded') === 'true';
    modeOptions.hidden = collapsed;
    modeSummary.hidden = !collapsed;
    modeToolbar.classList.toggle('is-collapsed', collapsed);
    modeCollapse.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expand mode selector' : 'Collapse mode selector';
    modeCollapse.setAttribute('aria-label', label);
    modeCollapse.title = label;
  });
  toggle.addEventListener('click', () => setPanelOpen(!panel.classList.contains('open')));
  if (close) close.addEventListener('click', () => setPanelOpen(false));
  if (clearBtn) clearBtn.addEventListener('click', clearConversation);
  input.addEventListener('input', resizeInput);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  suggestions.forEach(button => {
    button.addEventListener('click', () => {
      setPanelOpen(true);
      sendMessage(button.dataset.prompt || button.textContent);
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });
  // In-page links inside answers: route through the SPA instead of reloading.
  messages.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    const page = link.dataset.page;
    const datasetId = link.dataset.dataset;
    if (datasetId) {
      event.preventDefault();
      if (typeof window.showPage === 'function') window.showPage('datasets');
      if (typeof window.openDatasetModal === 'function') window.openDatasetModal(datasetId);
      else if (typeof openDatasetModal === 'function') openDatasetModal(datasetId);
      if (window.innerWidth <= 760) setPanelOpen(false);
      return;
    }
    if (page) {
      event.preventDefault();
      if (typeof window.showPage === 'function') window.showPage(page);
      else location.hash = '#' + page;
      if (window.innerWidth <= 760) setPanelOpen(false);
    }
  });

  window.batteryTwinAI = {
    open() { setPanelOpen(true); },
    addBotNote(text) {
      setMode('chat');
      setPanelOpen(true);
      const time = new Date().toISOString();
      addMessage(text, 'bot', { time, source: 'kb' });
      saveMessage(text, 'bot', time, 'kb');
    },
    send(message) { setMode('chat'); setPanelOpen(true); return sendMessage(message); },
    act(command) { setMode('agent'); setPanelOpen(true); return sendMessage(String(command || '')); },
    mode() { return activeMode; },
    ask(message) { return answer(String(message || '')); },
    provider() { return state.provider; }
  };
  window.BatteryLakeAssistant = window.batteryTwinAI;

  setStatus('online', PROVIDER_LABELS.local.subtitle, PROVIDER_LABELS.local.status);
  renderSuggestions(CHAT_SUGGESTIONS);
  restoreHistory();
})();
