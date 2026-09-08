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

  const welcomeText = 'Hi! I answer questions about BatteryLake: catalog numbers, individual datasets, the processing skill, status.json, benchmarks and citation. Ask in English or 中文.';

  /* ── state ─────────────────────────────────────────────────────── */
  const state = {
    provider: null,          // resolved provider id
    ready: false,
    probing: null,           // promise while probing a remote provider
    dead: new Set(),         // providers that failed this session
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

  function sourceLabel(source) {
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
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return { text: content, meta, bubble };
  }

  function setPanelOpen(isOpen) {
    panel.classList.toggle('open', isOpen);
    document.body.classList.toggle('ai-panel-open', isOpen);
    if (isOpen) { input.focus(); void ensureProvider(); }
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
  function systemPrompt(question) {
    const ctx = KB ? KB.context(question) : '';
    return [
      'You are the BatteryLake AI Assistant embedded in the BatteryLake website (battery aging datasets, SOH/RUL benchmarking).',
      'Answer the user\'s latest message in the same language the user wrote it in (Chinese or English).',
      'Be concise: at most about 150 words, plain sentences or short "- " bullet lists; no headings, no tables.',
      'Use only the site context below for facts about BatteryLake; if the context does not cover something, say so and point to the relevant page. General battery knowledge is fine.',
      'When you mention a page, link it in markdown using its hash, e.g. [Datasets](#datasets), [Preprocessing](#preprocessing). Link datasets as [Name](dataset:dataset_id).',
      '',
      '=== Site context ===',
      ctx
    ].join('\n');
  }
  function historyMessages() {
    return state.history.slice(-8).map(m => ({ role: m.role, content: m.text }));
  }

  async function askGemini(question) {
    const model = CONFIG.model || 'gemini-2.5-flash-lite';
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(CONFIG.apiKey);
    const contents = historyMessages().map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
    contents.push({ role: 'user', parts: [{ text: question }] });
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(question) }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 600 } })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || ('Gemini HTTP ' + res.status));
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned no text');
    return text;
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

  function askRemote(provider, question) {
    switch (provider) {
      case 'gemini': return askGemini(question);
      case 'openai': return askOpenAI(question, CONFIG.endpoint);
      case 'backend': return askBackend(question, CONFIG.endpoint || LOCAL_BACKEND_URL);
      case 'pollinations': return askOpenAI(question, POLLINATIONS_URL, { anonymous: true, foldSystem: true, model: 'openai', timeoutMs: 15000 });
      default: return Promise.reject(new Error('No remote provider'));
    }
  }

  const PROVIDER_LABELS = {
    gemini: { subtitle: 'Gemini · free tier', status: 'Model connected' },
    openai: { subtitle: 'Custom model endpoint', status: 'Model connected' },
    backend: { subtitle: 'Local app.py backend', status: 'Backend connected' },
    pollinations: { subtitle: 'Free model · Pollinations', status: 'Model connected' },
    local: { subtitle: 'Built-in knowledge base', status: 'Ready · answers from site data' }
  };

  function candidateProviders() {
    const p = String(CONFIG.provider || 'auto').toLowerCase();
    if (p !== 'auto') return [p];
    const list = [];
    if (CONFIG.apiKey && (!CONFIG.endpoint || /gemini/i.test(CONFIG.model))) list.push('gemini');
    if (CONFIG.endpoint) list.push(/\/api\/chat$/.test(CONFIG.endpoint) ? 'backend' : 'openai');
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
    // Gemini / OpenAI: a configured key or endpoint is trusted until a real call fails.
    return provider === 'gemini' ? !!CONFIG.apiKey : !!CONFIG.endpoint;
  }

  function ensureProvider() {
    if (state.ready) return Promise.resolve(state.provider);
    if (state.probing) return state.probing;
    setStatus('busy', 'Connecting…', 'Checking model availability');
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
    const l = PROVIDER_LABELS[state.provider] || PROVIDER_LABELS.local;
    setStatus('online', l.subtitle, l.status);
  }
  function demoteProvider(reason) {
    state.dead.add(state.provider);
    console.warn('AI assistant: ' + state.provider + ' unavailable (' + reason + '); using built-in knowledge base.');
    state.provider = 'local';
    applyProviderStatus();
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
    if (provider === 'local' || state.dead.has(provider)) return localAnswer(question);
    try {
      const text = await askRemote(provider, question);
      return { text, source: provider };
    } catch (err) {
      demoteProvider(err && err.message ? err.message : 'error');
      return localAnswer(question);
    }
  }

  async function sendMessage(message) {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
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
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  /* ── events ────────────────────────────────────────────────────── */
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
      setPanelOpen(true);
      const time = new Date().toISOString();
      addMessage(text, 'bot', { time, source: 'kb' });
      saveMessage(text, 'bot', time, 'kb');
    },
    send(message) { setPanelOpen(true); return sendMessage(message); },
    ask(message) { return answer(String(message || '')); },
    provider() { return state.provider; }
  };
  window.BatteryLakeAssistant = window.batteryTwinAI;

  setStatus('online', PROVIDER_LABELS.local.subtitle, PROVIDER_LABELS.local.status);
  restoreHistory();
})();
