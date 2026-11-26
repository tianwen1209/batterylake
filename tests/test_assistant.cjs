const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the public widget API with the production script, without a browser
// or network. Fake timers let us check cooldown expiry without a 90-second wait.
function widget(responses, privateMode = false) {
  function element() {
    return {
      textContent: '', innerHTML: '', value: '', style: {}, dataset: {}, listeners: {}, children: [],
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      append() {}, appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; }, addEventListener(type, fn) { this.listeners[type] = fn; }, setAttribute() {}, focus() {},
      querySelector() { return element(); }, querySelectorAll() { return []; }
    };
  }
  const elements = new Map();
  const timers = new Map();
  const requests = [];
  const storageWrites = [];
  const events = {};
  let now = 100000;
  let timerId = 0;
  const window = {
    addEventListener(type, fn) { events[type] = fn; },
    BATTERYLAKE_AI_CONFIG: { provider: 'worker', endpoint: 'https://proxy.example/chat', timeoutMs: 60000 },
    BatteryLakeKnowledge: { catalog: () => [], answer: () => ({ text: 'Catalog answer', source: 'kb' }), context: () => '', isChinese: q => /[\u3400-\u9fff]/.test(q) }
  };
  const context = {
    window, location: { hostname: 'example.com', origin: 'https://example.com' }, AbortController,
    Date: class extends Date { static now() { return now; } },
    console: { warn() {} },
    localStorage: { getItem() { return null; }, setItem(...args) { storageWrites.push(args); }, removeItem(...args) { storageWrites.push(args); } },
    document: {
      body: element(),
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      querySelectorAll() { return []; }, createElement: element
    },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      requests.push({ url, options, timerDelays: [...timers.values()].map(t => t.delay) });
      const response = await responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'unexpected model request');
      return { ok: response.status === 200, status: response.status, json: async () => response.body };
    }
  };
  if (privateMode) vm.runInNewContext(fs.readFileSync('js/assistant-actions.js', 'utf8'), context);
  if (privateMode) vm.runInNewContext(fs.readFileSync('js/assistant-private.js', 'utf8'), context);
  vm.runInNewContext(fs.readFileSync('js/assistant.js', 'utf8'), context);
  return {
    window, context, api: window.batteryTwinAI, requests, timers, storageWrites, events,
    element: id => elements.get(id),
    click: id => elements.get(id).listeners.click(),
    submit: id => elements.get(id).listeners.submit({ preventDefault() {} }),
    status: () => elements.get('aiChatStatusText').textContent,
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) { timers.delete(id); timer.fn(); }
      }
    }
  };
}
const ok = (model = 'gemini-flash-lite-latest') => ({ status: 200, body: { text: 'Model answer', model } });

test('connection is unverified until an actual answer and proxy timeout allows fallback models', async () => {
  const w = widget([ok()]);
  w.api.open();
  w.click('aiGuestMode');
  await Promise.resolve(); await Promise.resolve();
  assert.match(w.status(), /not verified/);
  assert.equal((await w.api.ask('Explain battery aging')).text, 'Model answer');
  assert.equal(w.status(), 'Connected · gemini-flash-lite-latest');
  assert.equal(JSON.parse(w.requests[0].options.body).question, 'Explain battery aging');
  assert.ok(w.requests[0].timerDelays.includes(60000));
});

test('429 uses explicit local fallback, never retries in background, and recovers on next question', async () => {
  const w = widget([{ status: 429, body: { error: 'quota exceeded' } }, ok('gemini-3.5-flash-lite')]);
  const first = await w.api.ask('Catalog counts?');
  assert.equal(first.source, 'kb');
  assert.match(first.text, /built-in site knowledge base/);
  assert.match(w.status(), /rate limited/);
  await w.api.ask('Which Gemini model are you?');
  assert.equal(w.requests.length, 1);
  w.advance(90051);
  assert.match(w.status(), /retry model on next message/);
  assert.equal(w.requests.length, 1, 'cooldown does not issue a hidden request');
  const recovered = await w.api.ask('Which Gemini model are you?');
  assert.equal(recovered.source, 'worker');
  assert.match(recovered.text, /gemini-3.5-flash-lite/);
  assert.equal(w.status(), 'Connected · gemini-3.5-flash-lite');
});

test('aborted requests report a timeout, and local answers never claim a Gemini identity', async () => {
  const timeout = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
  const w = widget([timeout]);
  const result = await w.api.ask('Which Gemini model are you?');
  assert.match(w.status(), /timed out/);
  assert.match(result.text, /No Gemini response was received/);
  assert.equal(result.source, 'kb');
  assert.doesNotMatch(w.status(), /retrying shortly|connected/i);
});

test('permanent API failure stays visibly unavailable instead of saying Online', async () => {
  const w = widget([{ status: 403, body: { error: 'Forbidden origin' } }]);
  await w.api.ask('Hello');
  assert.equal(w.status(), 'Site knowledge · model unavailable');
  await w.api.ask('Hello again');
  assert.equal(w.requests.length, 1);
});

test('model identity uses response metadata and admits missing metadata', async () => {
  const w = widget([
    { status: 200, body: { text: 'I am an invented model', model: 'alias', modelVersion: 'actual-version' } },
    { status: 200, body: { text: 'I am an invented model' } }
  ]);
  assert.match((await w.api.ask('Which Gemini model are you?')).text, /actual-version/);
  const second = await w.api.ask('Which model are you using?');
  assert.match(second.text, /did not report a model version/);
  assert.doesNotMatch(second.text, /invented|actual-version/);
});


test('model recommendations are sent through rather than replaced by model identity', async () => {
  const w = widget([ok(), ok()]);
  assert.equal((await w.api.ask('Which models can you compare?')).text, 'Model answer');
  assert.equal((await w.api.ask('What model do you recommend?')).text, 'Model answer');
});


test('entry offers guest and private setup without making requests', async () => {
  const w = widget([]);
  w.api.open();
  assert.equal(w.requests.length, 0);
  w.click('aiOwnApiMode');
  assert.equal(w.element('aiEntryScreen').hidden, true);
  assert.equal(w.element('aiOwnApiScreen').hidden, false);
  assert.equal(w.element('aiGuestScreen').hidden, true);
  assert.equal(w.element('aiChatClear').hidden, true);
  assert.equal(w.element('aiChatStatus').hidden, true);
  assert.equal(w.requests.length, 0);
  w.click('aiEntryBack');
  assert.equal(w.element('aiEntryScreen').hidden, false);
  assert.equal(w.element('aiOwnApiScreen').hidden, true);
  w.click('aiGuestMode');
  assert.equal(w.element('aiGuestScreen').hidden, false);
  assert.equal(w.element('aiEntryScreen').hidden, true);
  assert.equal(w.element('aiChatClear').hidden, false);
  assert.equal(w.element('aiChatStatus').hidden, false);
  w.click('aiEntryBack');
  assert.equal(w.element('aiGuestScreen').hidden, true);
  assert.equal(w.element('aiEntryScreen').hidden, false);
});

const paired = { status: 200, body: { protocol: 'batterylake-local-v1', provider: 'provider.example', model: 'user-model', version: 3, transport: 'chat-completions' } };
const privateReply = text => ({ status: 200, body: { reply: text } });
async function pair(w) {
  w.click('aiOwnApiMode');
  w.element('aiPrivateToken').value = 'x'.repeat(43);
  await w.submit('aiPrivateConnectForm');
}

test('private chat sends only to loopback, omits guest history and never writes storage', async () => {
  const w = widget([paired, privateReply('<img src="https://evil.example/leak">'), privateReply('Second answer')], true);
  await pair(w);
  assert.equal(w.requests.length, 1, 'pairing makes no model probe');
  assert.equal(w.element('aiPrivateToken').value, '');
  assert.equal(w.element('aiPrivateSession').hidden, false);
  assert.match(w.element('aiPrivateStatus').textContent, /Send a message to verify/);
  assert.equal(w.element('aiPrivateConnectionState').textContent, 'Paired');
  await w.api.send('Private research');
  assert.equal(w.element('aiPrivateConnectionState').textContent, 'Connected');
  const body = JSON.parse(w.requests[1].options.body);
  assert.equal(body.messages.at(-1).content, 'Private research');
  assert.equal(body.messages.length, 2);
  const reply = w.element('aiPrivateMessages').children[1].children[0];
  assert.equal(reply.textContent, '<img src="https://evil.example/leak">');
  assert.equal(reply.innerHTML, '', 'model output is rendered as text');
  await w.api.ask('Follow-up');
  assert.equal(JSON.parse(w.requests[2].options.body).messages[1].content, 'Private research');
  for (const request of w.requests) {
    assert.match(request.url, /^http:\/\/127\.0\.0\.1:8765\/(status|chat)$/);
    assert.equal(request.options.credentials, 'omit');
    assert.equal(request.options.cache, 'no-store');
    assert.equal(request.options.redirect, 'error');
    assert.equal(request.options.referrerPolicy, 'no-referrer');
  }
  assert.equal(w.storageWrites.length, 0);
  assert.equal(w.api.provider(), 'own-api');
});

test('private provider failures do not echo upstream details or use a guest fallback', async () => {
  const w = widget([paired, { status: 502, body: { error: 'SECRET KEY or PROMPT' } }], true);
  await pair(w);
  await w.api.send('Confidential question');
  assert.match(w.element('aiPrivateStatus').textContent, /Provider request failed/);
  assert.doesNotMatch(w.element('aiPrivateStatus').textContent, /SECRET|PROMPT/);
  assert.equal(w.requests.length, 2);
  assert.equal(w.storageWrites.length, 0);
  assert.equal(w.api.provider(), 'own-api');
});

test('private diagnostics use only allowlisted categories and never display upstream error text', async () => {
  for (const [code, expected] of [
    ['provider_auth', /denied access/], ['provider_quota', /quota or rate limit/],
    ['provider_request', /does not necessarily mean a format error/], ['provider_tls', /TLS/],
    ['provider_key_invalid', /Google rejected the API key/], ['provider_billing', /free-tier eligibility/],
    ['provider_precondition', /FAILED_PRECONDITION/], ['provider_region', /unavailable from this location/],
    ['provider_parameter_store', /store parameter/],
    ['provider_response', /empty or unsupported response/],
    ['SECRET_KEY_PRIVATE_PROMPT', /Provider request failed/], ['toString', /Provider request failed/]
  ]) {
    const w = widget([paired, { status: 502, body: { code, error: 'SECRET_ERROR_BODY' } }], true);
    await pair(w);
    await w.api.send('Private question');
    assert.match(w.element('aiPrivateStatus').textContent, expected);
    assert.doesNotMatch(w.element('aiPrivateStatus').textContent, /SECRET|PRIVATE_PROMPT/);
    assert.equal(w.requests.length, 2, 'diagnostics never retry or invoke guest');
    assert.equal(w.storageWrites.length, 0);
  }
});

test('old connectors fail visibly before any private question is sent', async () => {
  const w = widget([{ status: 200, body: { ...paired.body, version: 2 } }], true);
  await pair(w);
  assert.match(w.element('aiPrivateStatus').textContent, /Outdated connector/);
  await w.api.send('Private question');
  assert.equal(w.requests.length, 1);
  assert.equal(w.element('aiPrivateSession').hidden, true);
});

test('private clear aborts pending requests, drops late responses and discards context', async () => {
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const w = widget([paired, pending, privateReply('Fresh')], true);
  await pair(w);
  const sending = w.api.send('Old question');
  const signal = w.requests[1].options.signal;
  w.click('aiPrivateClear');
  assert.equal(signal.aborted, true);
  resolve(privateReply('Late confidential reply'));
  await sending;
  assert.equal(w.element('aiPrivateMessages').children.length, 0);
  await w.api.send('New question');
  assert.equal(JSON.parse(w.requests[2].options.body).messages.length, 2);
});

test('disconnect, close, back and page exit discard private pairing and messages', async () => {
  for (const leave of [w => w.click('aiPrivateDisconnect'), w => w.click('aiChatClose'), w => w.click('aiEntryBack'), w => w.events.pagehide()]) {
    const w = widget([paired, privateReply('Private answer')], true);
    await pair(w);
    await w.api.send('Private question');
    leave(w);
    assert.equal(w.element('aiPrivateMessages').children.length, 0);
    assert.equal(w.element('aiPrivateSession').hidden, true);
    assert.equal(w.element('aiPrivateToken').value, '');
    assert.equal(w.storageWrites.length, 0);
  }
});

test('failed pairing and API keys in the pairing field cause no provider request', async () => {
  const w = widget([{ status: 401, body: {} }], true);
  w.click('aiOwnApiMode');
  w.element('aiPrivateToken').value = 'sk-not-a-pairing-code';
  await w.submit('aiPrivateConnectForm');
  assert.equal(w.requests.length, 0);
  assert.equal(w.element('aiPrivateToken').value, '');
  await pair(w);
  assert.match(w.element('aiPrivateStatus').textContent, /Pairing code rejected/);
  await w.api.send('Secret question');
  assert.equal(w.requests.length, 1);
});

test('private exit preserves guest mode and never sends private context to the guest proxy', async () => {
  const w = widget([paired, privateReply('Private answer'), ok()], true);
  await pair(w);
  await w.api.send('CONFIDENTIAL_PRIVATE');
  w.click('aiEntryBack');
  w.click('aiGuestMode');
  await w.api.send('Public catalog question');
  assert.equal(w.requests[2].url, 'https://proxy.example/chat');
  assert.doesNotMatch(w.requests[2].options.body, /CONFIDENTIAL_PRIVATE|Private answer/);
  assert.ok(w.storageWrites.length > 0, 'guest history behavior is preserved');
});


test('private Agent uses own provider, executes production tools and returns real results in follow-ups', async () => {
  const plan = { actions: [{ tool: 'open_page', args: { page: 'quality' } }], reply: 'Opening quality.' };
  const w = widget([paired, privateReply(JSON.stringify(plan)), privateReply(JSON.stringify({ actions: [], reply: 'Done.' }))], true);
  const pages = [];
  w.window.showPage = page => pages.push(page);
  await pair(w);
  await w.api.act('Open quality');
  assert.deepEqual(pages, ['quality']);
  const body = JSON.parse(w.requests[1].options.body);
  assert.match(body.messages[0].content, /BatteryLake Agent/);
  assert.doesNotMatch(body.messages[0].content, /- submit_contribution/);
  assert.match(w.element('aiPrivateMessages').children[1].children[0].textContent, /✓ Opened/);
  await w.api.send('What happened?');
  assert.match(JSON.parse(w.requests[2].options.body).messages[2].content, /"ok":true/);
  assert.equal(w.storageWrites.length, 0);
  assert.ok(w.requests.every(request => request.url.startsWith('http://127.0.0.1:8765/')));
});

test('private Agent rejects forbidden, inherited and unknown tools and reports failures', async () => {
  const plan = { actions: [
    { tool: 'submit_contribution', args: {} }, { tool: 'set_theme', args: { theme: 'dark' } },
    { tool: 'constructor', args: {} }, { tool: 'open_page', args: { page: 'missing' } }
  ], reply: '' };
  const w = widget([paired, privateReply(JSON.stringify(plan))], true);
  await pair(w);
  await w.api.act('Try these actions');
  const text = w.element('aiPrivateMessages').children[1].children[0].textContent;
  assert.match(text, /Action unavailable.*submit_contribution/);
  assert.match(text, /Action unavailable.*set_theme/);
  assert.match(text, /Action unavailable.*constructor/);
  assert.match(text, /Unknown page/);
  assert.equal(w.storageWrites.length, 0);
});

test('private Agent never executes malformed plans or cancelled late plans', async () => {
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const w = widget([paired, privateReply('Not JSON'), pending], true);
  const pages = [];
  w.window.showPage = page => pages.push(page);
  await pair(w);
  w.click('aiPrivateAgentMode');
  await w.api.send('Open quality');
  assert.match(w.element('aiPrivateStatus').textContent, /valid Agent plan/);
  const sending = w.api.send('Open quality');
  w.click('aiPrivateClear');
  resolve(privateReply(JSON.stringify({ actions: [{ tool: 'open_page', args: { page: 'quality' } }], reply: '' })));
  await sending;
  assert.deepEqual(pages, []);
  assert.equal(w.element('aiPrivateMessages').children.length, 0);
});

test('switching private modes discards prior mode context and Chat cannot execute plans', async () => {
  const plan = JSON.stringify({ actions: [{ tool: 'open_page', args: { page: 'quality' } }], reply: 'Plan' });
  const w = widget([paired, privateReply(plan), privateReply(plan), privateReply('Chat answer')], true);
  const pages = [];
  w.window.showPage = page => pages.push(page);
  await pair(w);
  await w.api.send('Chat only');
  assert.deepEqual(pages, []);
  w.click('aiPrivateAgentMode');
  assert.equal(w.element('aiPrivateMessages').children.length, 0);
  await w.api.send('Open quality');
  assert.deepEqual(pages, ['quality']);
  assert.equal(JSON.parse(w.requests[2].options.body).messages.length, 2);
  w.click('aiPrivateChatMode');
  await w.api.send('Hello');
  const body = JSON.parse(w.requests[3].options.body);
  assert.equal(body.messages.length, 2);
  assert.match(body.messages[0].content, /cannot execute site actions/);
});


test('private clear stops the remaining steps of a running Agent plan', async () => {
  let resolve;
  const report = new Promise(r => { resolve = r; });
  const plan = { actions: [
    { tool: 'open_quality_report', args: { dataset_id: 'dataset_21' } },
    { tool: 'open_page', args: { page: 'models' } }
  ], reply: '' };
  const w = widget([paired, privateReply(JSON.stringify(plan))], true);
  w.window.BatteryLakeKnowledge.catalog = () => [{ id: 'dataset_21', name: 'Test' }];
  w.window.loadQualityReport = () => report;
  w.window.showDatasetQuality = () => {};
  const pages = [];
  w.window.showPage = page => pages.push(page);
  await pair(w);
  const sending = w.api.act('Open report then models');
  for (let i = 0; i < 12; i++) await Promise.resolve();
  w.click('aiPrivateClear');
  resolve({ overall: 0.9, gate: 'ready' });
  await sending;
  assert.deepEqual(pages, []);
  assert.equal(w.element('aiPrivateMessages').children.length, 0);
});
