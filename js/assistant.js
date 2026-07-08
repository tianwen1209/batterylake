(function setupAIChat() {
  const panel = document.getElementById('aiChatPanel');
  const toggle = document.getElementById('aiChatToggle');
  const close = document.getElementById('aiChatClose');
  const form = document.getElementById('aiChatForm');
  const input = document.getElementById('aiChatInput');
  const messages = document.getElementById('aiChatMessages');
  const sendButton = form.querySelector('button[type="submit"]');
  const suggestions = document.querySelectorAll('.ai-suggestion');
  const STORAGE_KEY = 'batteryTwinAiChatHistoryPlaceholderV1';
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

  function readHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(history) ? history : [];
    } catch (_) {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-80)));
    } catch (_) { /* local storage may be unavailable */ }
  }

  function saveMessage(text, type, time) {
    const history = readHistory();
    history.push({ text, type, time });
    writeHistory(history);
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

  function addMessage(text, type, options = {}) {
    const time = options.time || new Date().toISOString();
    const item = document.createElement('div');
    item.className = `ai-msg ai-msg-${type}`;
    if (type === 'bot') {
      const avatar = document.createElement('span');
      avatar.className = 'ai-msg-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.innerHTML = batteryBotIcon;
      const bubble = document.createElement('span');
      bubble.className = 'ai-msg-bubble';
      const content = document.createElement('span');
      content.className = 'ai-msg-text';
      content.textContent = text;
      const timestamp = document.createElement('span');
      timestamp.className = 'ai-msg-time';
      timestamp.textContent = formatMessageTime(time);
      bubble.append(content, timestamp);
      item.append(avatar, bubble);
    } else {
      const bubble = document.createElement('span');
      bubble.className = 'ai-msg-bubble';
      const content = document.createElement('span');
      content.className = 'ai-msg-text';
      content.textContent = text;
      const timestamp = document.createElement('span');
      timestamp.className = 'ai-msg-time';
      timestamp.textContent = formatMessageTime(time);
      bubble.append(content, timestamp);
      item.appendChild(bubble);
    }
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item.querySelector('.ai-msg-text');
  }

  function setPanelOpen(isOpen) {
    panel.classList.toggle('open', isOpen);
    // Body-level flag drives the push-layout + FAB-hide CSS so the panel
    // and the rest of the page layout always agree on open/closed state.
    document.body.classList.toggle('ai-panel-open', isOpen);
    if (isOpen) input.focus();
  }

  function setTyping(bubble) {
    bubble.innerHTML = '<span class="ai-typing" aria-label="Thinking"><span></span><span></span><span></span></span>';
  }

  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 116) + 'px';
  }

  function restoreHistory() {
    const history = readHistory();
    if (!history.length) {
      const welcomeTime = messages.querySelector('.ai-msg-time');
      if (welcomeTime) welcomeTime.textContent = formatMessageTime();
      return;
    }
    messages.innerHTML = '';
    history.forEach(entry => {
      if (!entry || !entry.text || !entry.type) return;
      addMessage(entry.text, entry.type, { time: entry.time });
    });
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
    setTyping(loading);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cleanMessage })
      });

      let reply = '';
      if (response.ok) {
        const data = await response.json();
        reply = data.reply || data.response || data.message || '[No AI response]';
      } else {
        let errorMsg = '';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || JSON.stringify(errorData);
        } catch {
          errorMsg = response.statusText || 'Unknown error';
        }
        reply = `AI backend error: ${errorMsg}`;
      }

      loading.textContent = reply;
      saveMessage(reply, 'bot', loadingTime);
    } catch (err) {
      const errorReply = `Failed to connect to AI backend: ${err.message}`;
      loading.textContent = errorReply;
      saveMessage(errorReply, 'bot', loadingTime);
    } finally {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  async function postChat(message) {
    const endpoints = [
      '/api/chat',
      'http://127.0.0.1:8000/api/chat',
      'http://localhost:8000/api/chat'
    ];
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
        if (!response.ok) throw new Error(data.error || `AI backend unavailable (${response.status})`);
        return data;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('All AI backend endpoints failed.');
  }

  toggle.addEventListener('click', () => setPanelOpen(!panel.classList.contains('open')));
  close.addEventListener('click', () => setPanelOpen(false));
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  window.batteryTwinAI = {
    open() {
      setPanelOpen(true);
    },
    addBotNote(text) {
      setPanelOpen(true);
      const time = new Date().toISOString();
      addMessage(text, 'bot', { time });
      saveMessage(text, 'bot', time);
    },
    send(message) {
      setPanelOpen(true);
      return sendMessage(message);
    }
  };

  restoreHistory();
})();
