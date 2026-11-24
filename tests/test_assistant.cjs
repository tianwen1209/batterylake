const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the public widget API with the production script, without a browser
// or network. Fake timers let us check cooldown expiry without a 90-second wait.
function widget(responses) {
  function element() {
    return {
      textContent: '', innerHTML: '', style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      append() {}, appendChild() {}, addEventListener() {}, setAttribute() {}, focus() {},
      querySelector() { return element(); }, querySelectorAll() { return []; }
    };
  }
  const elements = new Map();
  const timers = new Map();
  const requests = [];
  let now = 100000;
  let timerId = 0;
  const window = {
    BATTERYLAKE_AI_CONFIG: { provider: 'worker', endpoint: 'https://proxy.example/chat', timeoutMs: 60000 },
    BatteryLakeKnowledge: { answer: () => ({ text: 'Catalog answer', source: 'kb' }), context: () => '', isChinese: q => /[\u3400-\u9fff]/.test(q) }
  };
  const context = {
    window, location: { hostname: 'example.com' }, AbortController,
    Date: class extends Date { static now() { return now; } },
    console: { warn() {} },
    localStorage: { getItem() { return null; } },
    document: {
      body: element(),
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      querySelectorAll() { return []; }, createElement: element
    },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      requests.push({ url, options, timerDelays: [...timers.values()].map(t => t.delay) });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'unexpected model request');
      return { ok: response.status === 200, status: response.status, json: async () => response.body };
    }
  };
  vm.runInNewContext(fs.readFileSync('js/assistant.js', 'utf8'), context);
  return {
    api: window.batteryTwinAI, requests, timers,
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
  await w.api.ask('你是哪个gemini模型');
  assert.equal(w.requests.length, 1);
  w.advance(90051);
  assert.match(w.status(), /retry model on next message/);
  assert.equal(w.requests.length, 1, 'cooldown does not issue a hidden request');
  const recovered = await w.api.ask('你是哪个gemini模型');
  assert.equal(recovered.source, 'worker');
  assert.match(recovered.text, /gemini-3.5-flash-lite/);
  assert.equal(w.status(), 'Connected · gemini-3.5-flash-lite');
});

test('aborted requests report a timeout, and local answers never claim a Gemini identity', async () => {
  const timeout = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
  const w = widget([timeout]);
  const result = await w.api.ask('你是哪个gemini模型？');
  assert.match(w.status(), /timed out/);
  assert.match(result.text, /没有获得 Gemini 模型响应/);
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
  assert.equal((await w.api.ask('你推荐什么模型？')).text, 'Model answer');
});
