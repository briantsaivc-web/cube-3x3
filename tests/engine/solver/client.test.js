// tests/engine/solver/client.test.js — src/ui/solver-client.js 單元測試（假 Worker、假時鐘）
//
// 依據：game-spec.md §7.5、§9.4–§9.6；ADR-001-solver.md §2.6；分派單 T-001 S6（client 情境清單）；
//       技術裁決 D-2、D-3、D-5。
// 分派單列出的情境與本檔測試的對照：
//   快取命中時不送 Worker 訊息            → C-02
//   照提示轉後下一個提示來自快取          → C-03、C-04（C-04 用真 Worker 協定走完整局）
//   solveTimeoutMs 逾時 terminate 並退回  → C-05
//   NODE_LIMIT 退回層先法                 → C-06
//   createWorker 丟例外 → mainThread      → C-07
//   initTimeoutMs 逾時 → failed           → C-09
//   取消後遲到的結果被丟棄                → C-10
//   S13／m-3（D-35）主執行緒路徑：例外 → INTERNAL（C-14）、failed 模式不同步丟出（C-15）、
//   主執行緒取消（C-16）、主執行緒 watchdog（C-17）
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..', '..');
var clientModule = require(path.join(ROOT, 'src/ui/solver-client.js'));
var engine = require(path.join(ROOT, 'src/engine/index.js'));
var twophase = require(path.join(ROOT, 'src/solver/twophase.js'));
var lbl = require(path.join(ROOT, 'src/solver/lbl.js'));
var workerModule = require(path.join(ROOT, 'src/solver/worker.js'));

var params = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/params.json'), 'utf8'));
var lblConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/lbl.json'), 'utf8'));
var DATA = { params: params, lbl: lblConfig };
var SP = params.solver;

// ---------------------------------------------------------------------------
// 測試輔助（本段專用）
// ---------------------------------------------------------------------------

// 假時鐘：只有呼叫 advance 時才前進
function makeClock() {
  var t = 1000;
  var seq = 0;
  var timers = [];
  var clock = {
    now: function () { return t; },
    setTimer: function (fn, ms) {
      var h = { id: ++seq, at: t + ms, fn: fn };
      timers.push(h);
      return h;
    },
    clearTimer: function (h) {
      var i = timers.indexOf(h);
      if (i >= 0) timers.splice(i, 1);
    },
    advance: function (ms) {
      var target = t + ms;
      for (;;) {
        var due = timers.filter(function (h) { return h.at <= target; });
        if (due.length === 0) break;
        due.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
        var h = due[0];
        timers.splice(timers.indexOf(h), 1);
        t = h.at;
        h.fn();
      }
      t = target;
    },
    pending: function () { return timers.length; }
  };
  return clock;
}

// 假 Worker 工廠：記錄送出的訊息，測試手動回覆
function makeWorkers() {
  var f = { created: [], throwOnCreate: false };
  f.create = function (handlers) {
    if (f.throwOnCreate) throw new Error('測試：無法建立 Worker');
    var w = {
      handlers: handlers,
      sent: [],
      terminated: false,
      postMessage: function (m) { w.sent.push(JSON.parse(JSON.stringify(m))); },
      terminate: function () { w.terminated = true; },
      reply: function (m) { handlers.onMessage(m); },
      last: function () { return w.sent[w.sent.length - 1]; }
    };
    f.created.push(w);
    return w;
  };
  f.latest = function () { return f.created[f.created.length - 1]; };
  return f;
}

function bootReady(w, clock, ms) {
  var init = w.sent[0];
  assert.equal(init.type, 'init');
  for (var k = 1; k <= 6; k++) w.reply({ type: 'progress', id: init.id, step: k, total: 6, label: 'x' });
  if (ms) clock.advance(ms);
  w.reply({ type: 'ready', id: init.id, tableBytes: 10939101 });
}

function makeClient(opts) {
  opts = opts || {};
  var clock = opts.clock || makeClock();
  var workers = opts.workers || makeWorkers();
  var statuses = [];
  var deps = {
    createWorker: opts.createWorker === null ? undefined : (opts.createWorker || workers.create),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now,
    engine: engine,
    params: opts.params || params,
    lblConfig: lblConfig,
    onStatus: function (s) { statuses.push(s); }
  };
  if (opts.solvers) deps.solvers = opts.solvers;
  var client = clientModule.createSolverClient(deps);
  return { client: client, clock: clock, workers: workers, statuses: statuses };
}

// 追蹤 Promise 是否已結束
function track(p) {
  var t = { done: false, value: undefined };
  p.then(function (v) { t.done = true; t.value = v; });
  return t;
}

function flush() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

function reduce(state, type, payload) {
  return engine.reduce(state, { type: type, payload: payload || {} }, DATA);
}

// 自由模式下以 view 記號轉出一個狀態（可先整顆轉）
function stateFrom(rotations, turns) {
  var s = engine.initialState();
  rotations.forEach(function (r) { s = reduce(s, 'ROTATE', { move: r }); });
  turns.forEach(function (m, i) { s = reduce(s, 'TURN', { move: m, at: i }); });
  return s;
}

function inverseSeq(moves) {
  return moves.slice().reverse().map(function (m) { return engine.inverse(m); });
}

// 送出 HINT_REQUEST 並向 client 請求提示
function askHint(client, state) {
  var s = reduce(state, 'HINT_REQUEST', { at: 0 });
  return { state: s, t: track(client.requestHint(s)) };
}

function fakeTwophase(solveResult) {
  var ready = false;
  var fake = {
    initCalls: 0,
    solveOpts: [],
    PROGRESS_LABELS: twophase.PROGRESS_LABELS,
    isReady: function () { return ready; },
    init: function (o, cb) {
      fake.initCalls++;
      for (var k = 1; k <= 6; k++) cb(k, 6, twophase.PROGRESS_LABELS[k - 1]);
      ready = true;
      return {};
    },
    fromStickerColors: twophase.fromStickerColors,
    solve: function (c, opts) {
      fake.solveOpts.push(opts);
      return solveResult;
    }
  };
  return fake;
}

// ---------------------------------------------------------------------------
// 測試
// ---------------------------------------------------------------------------

test('C-01 啟動：booting → building k/6 → ready；init 帶入 params.solver（D-3）；記錄建表時間', function () {
  var c = makeClient();
  assert.equal(c.client.status().state, 'booting');
  assert.equal(c.workers.created.length, 0, 'start 之前不建立 Worker');
  c.client.start();
  c.client.start(); // 重複呼叫無作用
  assert.equal(c.workers.created.length, 1);
  var w = c.workers.latest();
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].type, 'init');
  assert.deepEqual(w.sent[0].params, SP);
  assert.equal(c.client.status().state, 'booting');

  w.reply({ type: 'progress', id: w.sent[0].id, step: 1, total: 6, label: 'moveTables' });
  assert.deepEqual([c.client.status().state, c.client.status().step, c.client.status().total], ['building', 1, 6]);
  w.reply({ type: 'progress', id: w.sent[0].id, step: 3, total: 6, label: 'p1FS' });
  assert.equal(c.client.status().step, 3);
  c.clock.advance(1234);
  w.reply({ type: 'ready', id: w.sent[0].id, tableBytes: 10939101 });
  var st = c.client.status();
  assert.equal(st.state, 'ready');
  assert.equal(st.initMs, 1234);
  assert.equal(st.notice, false);
  assert.deepEqual(c.statuses.map(function (s) { return s.state; }), ['booting', 'building', 'building', 'ready']);
  assert.equal(c.clock.pending(), 0, 'ready 後不留 init watchdog');
  assert.deepEqual(clientModule.STATES, ['booting', 'building', 'ready', 'mainThread', 'failed']);
});

test('C-02 快取命中時不送 Worker 訊息（提示與建議解示範共用快取）', async function () {
  var c = makeClient();
  c.client.start();
  var w = c.workers.latest();
  bootReady(w, c.clock);

  var s0 = stateFrom([], ['R', 'U', 'F2']);
  var a = askHint(c.client, s0);
  var msg = w.last();
  assert.equal(msg.type, 'solve');
  assert.deepEqual(msg.stickers, engine.viewStickers(s0));
  assert.deepEqual(msg.opts, SP, 'solve 一律帶 params.solver（D-3）');
  assert.equal(c.clock.pending(), 1, '求解 watchdog 已啟動');
  w.reply({ type: 'result', id: msg.id, kind: 'solve', moves: ['F2', "U'", "R'"], qtm: 4, nodes: 10, complete: true });
  await flush();
  assert.ok(a.t.done);
  assert.deepEqual(a.t.value, {
    type: 'HINT_READY',
    payload: { version: a.state.version, tokens: ['F2'], source: 'suggest', planQtm: 4 }
  });
  assert.equal(c.clock.pending(), 0, '收到結果後清除 watchdog');
  var s1 = engine.reduce(a.state, a.t.value, DATA);
  assert.equal(engine.hintView(s1).move, 'F2');

  // 同一狀態再要一次提示：不送訊息
  var before = w.sent.length;
  var b = askHint(c.client, s1);
  await flush();
  assert.ok(b.t.done);
  assert.deepEqual(b.t.value.payload.tokens, ['F2']);
  assert.equal(w.sent.length, before);

  // 建議解示範也先查快取：不送訊息，tokens 為整條解
  var d = reduce(s0, 'DEMO_REQUEST', { kind: 'suggest', at: 0 });
  var dt = track(c.client.requestDemo(d, 'suggest'));
  await flush();
  assert.equal(w.sent.length, before);
  assert.deepEqual(dt.value, {
    type: 'DEMO_READY',
    payload: { version: d.version, tokens: ['F2', "U'", "R'"], segments: null }
  });
  var d1 = engine.reduce(d, dt.value, DATA);
  d1 = reduce(d1, 'DEMO_SEEK', { cursor: 3, at: 1 });
  assert.ok(engine.isSolvedNow(d1));
  assert.ok(c.client.cacheSize() >= 3);
});

test('C-03 照提示轉後，下一個提示來自快取；中途整顆轉也一致（view／home 換算）', async function () {
  var c = makeClient();
  c.client.start();
  var w = c.workers.latest();
  bootReady(w, c.clock);

  var turns = ['R', 'U', "F'", 'L2', 'D'];
  var s = stateFrom(['y', 'x'], turns); // orient ≠ 0
  assert.notEqual(s.orient, 0);
  var a = askHint(c.client, s);
  var msg = w.last();
  // 假 Worker 回覆正確的 view 解（在同一 orient 下反轉玩家的轉動）
  var plan = inverseSeq(turns);
  w.reply({ type: 'result', id: msg.id, kind: 'solve', moves: plan, qtm: 7, nodes: 1, complete: true });
  await flush();
  s = engine.reduce(a.state, a.t.value, DATA);
  var sentAfterFirst = w.sent.length;

  var rotations = [null, 'z', null, "y'", null];
  for (var i = 0; i < plan.length; i++) {
    var hv = engine.hintView(s);
    assert.ok(hv, '第 ' + i + ' 步應有提示');
    assert.equal(hv.source, 'suggest');
    if (rotations[i]) {
      s = reduce(s, 'ROTATE', { move: rotations[i] });
      hv = engine.hintView(s);
    }
    s = reduce(s, 'TURN', { move: hv.move, at: 10 + i });
    if (i === plan.length - 1) break;
    var n = askHint(c.client, s);
    await flush();
    assert.ok(n.t.done, '第 ' + (i + 1) + ' 個提示應立即由快取給出');
    assert.equal(n.t.value.type, 'HINT_READY');
    assert.equal(n.t.value.payload.source, 'suggest');
    // planQtm 為剩餘序列 QTM 總和（含本步）
    var rest = 0;
    plan.slice(i + 1).forEach(function (m) { rest += engine.qtmCost(m); });
    assert.equal(n.t.value.payload.planQtm, rest);
    s = engine.reduce(n.state, n.t.value, DATA);
  }
  assert.ok(engine.isSolvedNow(s), '照提示轉完應復原');
  assert.equal(w.sent.length, sentAfterFirst, '後續提示都沒有送 Worker 訊息');

  // D-2：已復原不送請求
  var solvedT = track(c.client.requestHint(s));
  var demoT = track(c.client.requestDemo(s, 'lbl'));
  await flush();
  assert.deepEqual(solvedT.value, { type: 'HINT_FAILED', payload: { version: s.version, code: 'ALREADY_SOLVED' } });
  assert.equal(demoT.value.type, 'DEMO_FAILED');
  assert.equal(demoT.value.payload.code, 'ALREADY_SOLVED');
  assert.equal(w.sent.length, sentAfterFirst);
  assert.equal(clientModule.failureTextKey('ALREADY_SOLVED'), null);
});

test('C-04 真實協定整合：打亂後照提示走完整局，只送一次 solve（Worker 以 handleMessage 橋接）', async function () {
  var workers = [];
  function bridge(handlers) {
    var dead = false;
    var w = {
      sent: [],
      postMessage: function (m) {
        var copy = JSON.parse(JSON.stringify(m));
        w.sent.push(copy);
        setImmediate(function () {
          workerModule.handleMessage(copy, function (r) {
            var rc = JSON.parse(JSON.stringify(r));
            setImmediate(function () { if (!dead) handlers.onMessage(rc); });
          });
        });
      },
      terminate: function () { dead = true; }
    };
    workers.push(w);
    return w;
  }
  var client = clientModule.createSolverClient({
    createWorker: bridge,
    setTimer: setTimeout,
    clearTimer: clearTimeout,
    now: function () { return Number(process.hrtime.bigint()) / 1e6; },
    engine: engine,
    params: params,
    lblConfig: lblConfig
  });
  client.start();
  var s = reduce(engine.initialState(), 'NEW_GAME', { seed: 20260915, at: 0 });
  s = reduce(s, 'ROTATE', { move: 'x' });
  // 建表完成前就要求提示：先排隊，ready 後才送
  var first = client.requestHint(s = reduce(s, 'HINT_REQUEST', { at: 1 }));
  var action = await first;
  assert.equal(client.status().state, 'ready');
  assert.equal(action.type, 'HINT_READY');
  s = engine.reduce(s, action, DATA);
  var planQtm = action.payload.planQtm;
  assert.ok(planQtm > 0 && planQtm <= 32, 'planQtm ' + planQtm);
  var steps = 0;
  while (!engine.isSolvedNow(s)) {
    var hv = engine.hintView(s);
    s = reduce(s, 'TURN', { move: hv.move, at: 2 + steps });
    steps++;
    if (steps % 4 === 0) s = reduce(s, 'ROTATE', { move: 'y' });
    if (engine.isSolvedNow(s)) break;
    s = reduce(s, 'HINT_REQUEST', { at: 2 + steps });
    s = engine.reduce(s, await client.requestHint(s), DATA);
  }
  assert.equal(s.status, 'solved');
  assert.equal(engine.moveCount(s), planQtm, '照建議解轉完的步數等於第一個提示的 planQtm');
  var solves = workers[0].sent.filter(function (m) { return m.type === 'solve'; });
  assert.equal(solves.length, 1, '整局只送一次 solve');
  assert.equal(workers.length, 1);
  console.log('# 整合：建表 ' + client.status().initMs.toFixed(1) + ' ms；照提示 ' + steps + ' 步、QTM ' + planQtm);
  client.dispose();
});

test('C-05 solveTimeoutMs 逾時：terminate、背景重建 Worker、本次提示退回層先法；建議解示範回 TIMEOUT', async function () {
  var c = makeClient();
  c.client.start();
  var w1 = c.workers.latest();
  bootReady(w1, c.clock);

  var s = stateFrom(['z'], ['R', 'U', 'F', 'L', 'B', 'D']);
  var a = askHint(c.client, s);
  var msg = w1.last();
  c.clock.advance(SP.solveTimeoutMs - 1);
  await flush();
  assert.equal(a.t.done, false, '門檻前不逾時');
  c.clock.advance(1);
  await flush();
  assert.ok(w1.terminated, '逾時後 terminate');
  assert.equal(c.workers.created.length, 2, '重建 Worker');
  var w2 = c.workers.latest();
  assert.equal(w2.sent[0].type, 'init');
  assert.equal(c.client.status().state, 'booting');
  assert.ok(a.t.done);
  var act = a.t.value;
  assert.equal(act.type, 'HINT_READY');
  assert.equal(act.payload.source, 'lbl');
  assert.equal(act.payload.planQtm, null);
  var expectTokens = [];
  var full = lbl.generateLbl(engine.viewStickers(s), lblConfig).tokens;
  for (var i = 0; i < full.length; i++) {
    expectTokens.push(full[i]);
    if (engine.kind(full[i]) !== 'rotation') break;
  }
  assert.deepEqual(act.payload.tokens, expectTokens);
  var s1 = engine.reduce(a.state, act, DATA); // reducer 接受
  assert.equal(s1.hint.source, 'lbl');

  // 舊 Worker 遲到的結果被忽略
  w1.reply({ type: 'result', id: msg.id, kind: 'solve', moves: ['R'], qtm: 1, nodes: 1, complete: true });
  assert.equal(c.client.cacheSize(), 0);

  // 重建期間的請求排隊，ready 後才送；watchdog 從送出時才開始算
  var d = reduce(s, 'DEMO_REQUEST', { kind: 'suggest', at: 0 });
  var dt = track(c.client.requestDemo(d, 'suggest'));
  c.clock.advance(SP.solveTimeoutMs + 5);
  bootReady(w2, c.clock);
  assert.equal(c.client.status().state, 'ready');
  assert.equal(w2.last().type, 'solve');
  await flush();
  assert.equal(dt.done, false);
  c.clock.advance(SP.solveTimeoutMs);
  await flush();
  assert.ok(w2.terminated);
  assert.deepEqual(dt.value, { type: 'DEMO_FAILED', payload: { version: d.version, code: 'TIMEOUT' } });
  assert.equal(c.client.failureTextKey('TIMEOUT'), 'demo.suggestUnavailable');

  // 層先法示範逾時：改在主執行緒產生
  var w3 = c.workers.latest();
  bootReady(w3, c.clock);
  var l = reduce(s, 'DEMO_REQUEST', { kind: 'lbl', at: 0 });
  var lt = track(c.client.requestDemo(l, 'lbl'));
  assert.equal(w3.last().type, 'lbl');
  assert.deepEqual(w3.last().config, lblConfig);
  c.clock.advance(SP.solveTimeoutMs);
  await flush();
  assert.equal(lt.value.type, 'DEMO_READY');
  var direct = lbl.generateLbl(engine.viewStickers(s), lblConfig);
  assert.deepEqual(lt.value.payload.tokens, direct.tokens);
  assert.deepEqual(lt.value.payload.segments, direct.segments);
  engine.reduce(l, lt.value, DATA);
  c.client.dispose();
});

test('C-06 NODE_LIMIT：提示退回層先法；建議解示範回 NODE_LIMIT；不重建 Worker', async function () {
  var c = makeClient();
  c.client.start();
  var w = c.workers.latest();
  bootReady(w, c.clock);
  var s = stateFrom([], ['R', 'U2', "B'", 'M', 'E']);

  var a = askHint(c.client, s);
  w.reply({ type: 'error', id: w.last().id, code: 'NODE_LIMIT', detail: '1024' });
  await flush();
  assert.equal(a.t.value.type, 'HINT_READY');
  assert.equal(a.t.value.payload.source, 'lbl');
  assert.equal(a.t.value.payload.planQtm, null);
  engine.reduce(a.state, a.t.value, DATA);
  assert.equal(w.terminated, false);
  assert.equal(c.workers.created.length, 1);
  assert.equal(c.clock.pending(), 0);

  var d = reduce(s, 'DEMO_REQUEST', { kind: 'suggest', at: 0 });
  var dt = track(c.client.requestDemo(d, 'suggest'));
  w.reply({ type: 'error', id: w.last().id, code: 'NODE_LIMIT', detail: '1024' });
  await flush();
  assert.deepEqual(dt.value, { type: 'DEMO_FAILED', payload: { version: d.version, code: 'NODE_LIMIT' } });
  assert.equal(clientModule.failureTextKey('NODE_LIMIT'), 'demo.suggestUnavailable');
  engine.reduce(d, dt.value, DATA);
  assert.equal(c.client.status().state, 'ready');
});

test('C-07 createWorker 丟例外 → mainThread：先顯示提示文案，下一輪才在主執行緒建表並求解', async function () {
  var workers = makeWorkers();
  workers.throwOnCreate = true;
  var turns = ['R', 'F', 'U'];
  var fake = fakeTwophase({ moves: [], names: inverseSeq(turns), alg: '', qtm: 3, nodes: 5, complete: true });
  var c = makeClient({ workers: workers, solvers: { twophase: fake, lbl: lbl } });
  c.client.start();
  var st = c.client.status();
  assert.equal(st.state, 'mainThread');
  assert.equal(st.notice, true, '尚未建表：UI 要先顯示 mainThreadNotice');
  assert.equal(workers.created.length, 0);

  var s = stateFrom([], turns);
  var a = askHint(c.client, s);
  await flush();
  assert.equal(a.t.done, false, '先讓 UI 有機會畫出提示，不同步建表');
  assert.equal(fake.initCalls, 0);
  c.clock.advance(0);
  await flush();
  assert.equal(fake.initCalls, 1);
  assert.equal(fake.solveOpts.length, 1);
  assert.deepEqual(fake.solveOpts[0], SP, '主執行緒 solve 也傳 params.solver（D-3）');
  assert.deepEqual(a.t.value.payload, { version: a.state.version, tokens: ["U'"], source: 'suggest', planQtm: 3 });
  assert.equal(c.client.status().notice, false);
  assert.ok(c.statuses.some(function (x) { return x.state === 'mainThread' && x.step === 6; }), '主執行緒建表也回報進度');

  // 第二次：已建表，不再 init；快取命中則連 solve 都不呼叫
  var s1 = reduce(engine.reduce(a.state, a.t.value, DATA), 'TURN', { move: "U'", at: 5 });
  var b = askHint(c.client, s1);
  await flush();
  assert.equal(b.t.value.payload.tokens[0], "F'");
  assert.equal(fake.initCalls, 1);
  assert.equal(fake.solveOpts.length, 1);

  // 主執行緒 NODE_LIMIT → 層先法；層先法示範直接在主執行緒產生
  fake.solve = function () { return { error: 'NODE_LIMIT', nodes: 9 }; };
  var s2 = stateFrom(['x'], ['L', 'D']);
  var h = askHint(c.client, s2);
  var l = reduce(stateFrom([], ['B']), 'DEMO_REQUEST', { kind: 'lbl', at: 0 });
  var lt = track(c.client.requestDemo(l, 'lbl')); // 取代上一個請求（上一個以 CANCELLED 結束）
  await flush();
  assert.equal(h.t.value.payload.code, 'CANCELLED');
  c.clock.advance(0);
  await flush();
  assert.equal(lt.value.type, 'DEMO_READY');
  var h2 = askHint(c.client, s2);
  c.clock.advance(0);
  await flush();
  assert.equal(h2.t.value.payload.source, 'lbl');
  engine.reduce(h2.state, h2.t.value, DATA);

  // 未注入 createWorker：Node 沒有 window，預設建立方式丟例外 → mainThread
  var d = makeClient({ createWorker: null });
  d.client.start();
  assert.equal(d.client.status().state, 'mainThread');
  assert.throws(function () { clientModule.defaultCreateWorker({}); });
});

test('C-08 Worker onerror → mainThread；進行中的請求改在主執行緒完成', async function () {
  var fake = fakeTwophase({ moves: [], names: ["R'"], alg: '', qtm: 1, nodes: 5, complete: true });
  var c = makeClient({ solvers: { twophase: fake, lbl: lbl } });
  c.client.start();
  var w = c.workers.latest();
  bootReady(w, c.clock);
  var s = stateFrom([], ['R']);
  var a = askHint(c.client, s);
  assert.equal(w.last().type, 'solve');
  w.handlers.onError(new Error('測試：Worker 當掉'));
  assert.ok(w.terminated);
  assert.equal(c.client.status().state, 'mainThread');
  // S13／m-3：主執行緒路徑也有 watchdog，所以剩「主執行緒排程＋主執行緒 watchdog」兩個；Worker 的 solve watchdog 已清除
  assert.equal(c.clock.pending(), 2, '只剩主執行緒排程與主執行緒 watchdog，Worker 的 solve watchdog 已清除');
  c.clock.advance(0);
  await flush();
  assert.deepEqual(a.t.value.payload.tokens, ["R'"]);
  assert.equal(c.clock.pending(), 0, 'S13：job 完成後主執行緒 watchdog 一併清除');
  // 已終止的 Worker 再送訊息或錯誤都不影響
  w.reply({ type: 'result', id: 99, kind: 'solve', moves: ['U'], qtm: 1, nodes: 1, complete: true });
  w.handlers.onError(new Error('再一次'));
  assert.equal(c.client.status().state, 'mainThread');
});

test('C-09 initTimeoutMs 逾時 → failed：提示改用層先法、建議解示範不可用、不重建 Worker', async function () {
  var c = makeClient();
  c.client.start();
  var w = c.workers.latest();
  w.reply({ type: 'progress', id: w.sent[0].id, step: 2, total: 6, label: 'p1TS' });
  var s = stateFrom(['y'], ['F', 'R2', 'D\'']);
  var a = askHint(c.client, s); // 建表中：排隊
  assert.equal(w.sent.length, 1, '建表完成前不送 solve');
  c.clock.advance(SP.initTimeoutMs - 1);
  await flush();
  assert.equal(c.client.status().state, 'building');
  assert.equal(a.t.done, false);
  c.clock.advance(1);
  await flush();
  assert.ok(w.terminated);
  assert.equal(c.client.status().state, 'failed');
  assert.equal(c.workers.created.length, 1);
  assert.equal(a.t.value.type, 'HINT_READY');
  assert.equal(a.t.value.payload.source, 'lbl');
  engine.reduce(a.state, a.t.value, DATA);

  var d = reduce(s, 'DEMO_REQUEST', { kind: 'suggest', at: 0 });
  var dt = track(c.client.requestDemo(d, 'suggest'));
  var l = reduce(s, 'DEMO_REQUEST', { kind: 'lbl', at: 0 });
  var lt = track(c.client.requestDemo(l, 'lbl'));
  await flush();
  assert.deepEqual(dt.value, { type: 'DEMO_FAILED', payload: { version: d.version, code: 'SOLVER_FAILED' } });
  assert.equal(clientModule.failureTextKey('SOLVER_FAILED'), 'demo.suggestUnavailable');
  assert.equal(lt.value.type, 'DEMO_READY');
  assert.equal(lt.value.payload.segments.length, 8);
  engine.reduce(l, lt.value, DATA);
  assert.equal(w.sent.length, 1);

  // 被終止的 Worker 遲到的 ready 被忽略
  w.reply({ type: 'ready', id: w.sent[0].id, tableBytes: 10939101 });
  assert.equal(c.client.status().state, 'failed');
  assert.equal(c.clock.pending(), 0);

  // init 回 error 也轉 failed
  var e = makeClient();
  e.client.start();
  var ew = e.workers.latest();
  ew.reply({ type: 'error', id: ew.sent[0].id, code: 'INTERNAL', detail: 'x' });
  assert.equal(e.client.status().state, 'failed');
  assert.ok(ew.terminated);
  assert.equal(e.clock.pending(), 0);
});

test('C-10 取消後遲到的結果被丟棄；取消的建議解仍進快取；新請求等舊請求結束才送', async function () {
  var c = makeClient();
  c.client.start();
  var w = c.workers.latest();
  bootReady(w, c.clock);
  var turns = ['R', 'U'];
  var s = stateFrom([], turns);
  var a = askHint(c.client, s);
  var msg = w.last();

  var cancelAction = c.client.cancel();
  assert.deepEqual(cancelAction, { type: 'HINT_FAILED', payload: { version: a.state.version, code: 'CANCELLED' } });
  await flush();
  assert.deepEqual(a.t.value, cancelAction, '等待中的 Promise 以 CANCELLED 結束');
  assert.equal(c.client.cancel(), null, '沒有等待中的請求');
  assert.equal(clientModule.failureTextKey('CANCELLED'), null);
  var sc = engine.reduce(a.state, cancelAction, DATA); // UI 照常 dispatch
  assert.equal(sc.hint, null);

  // 取消後玩家轉了一步，再要提示：舊請求還在 Worker 內，新請求先排隊
  var s2 = stateFrom([], ['R', 'U', 'F']);
  var b = askHint(c.client, s2);
  assert.equal(w.sent.length, 2, '舊請求未結束前不送新請求');

  // 遲到的結果：不交給任何呼叫端，但存進快取
  w.reply({ type: 'result', id: msg.id, kind: 'solve', moves: inverseSeq(turns), qtm: 2, nodes: 1, complete: true });
  await flush();
  assert.equal(a.t.value.payload.code, 'CANCELLED', '已結束的 Promise 不變');
  assert.equal(b.t.done, false, '遲到的結果不會交給新請求');
  assert.equal(w.sent.length, 3, '舊請求結束後才送新請求');
  assert.deepEqual(w.last().stickers, engine.viewStickers(s2));
  var sAgain = askHint(c.client, sc);
  await flush();
  assert.equal(b.t.value.payload.code, 'CANCELLED', '新請求被下一個請求取代');
  assert.deepEqual(sAgain.t.value.payload.tokens, ["U'"], '取消的建議解已在快取');

  // 重複或錯誤 id 的回覆被忽略
  w.reply({ type: 'result', id: msg.id, kind: 'solve', moves: ['B'], qtm: 1, nodes: 1, complete: true });
  w.reply({ type: 'result', id: 12345, kind: 'solve', moves: ['B'], qtm: 1, nodes: 1, complete: true });

  // 建表中取消：排隊的請求被移除，ready 後不送
  var e = makeClient();
  e.client.start();
  var ew = e.workers.latest();
  var q = askHint(e.client, s);
  e.client.cancel();
  bootReady(ew, e.clock);
  assert.equal(ew.sent.length, 1);
  await flush();
  assert.equal(q.t.value.payload.code, 'CANCELLED');
  e.client.dispose();
  assert.ok(ew.terminated);
});

test('C-11 錯誤碼處理：INVALID_STATE、LBL_STUCK 原樣；未知碼與非法回覆視為非法狀態（D-5）；NOT_READY 重建後重送一次', async function () {
  var c = makeClient();
  c.client.start();
  var w = c.workers.latest();
  bootReady(w, c.clock);
  var s = stateFrom([], ['R']);

  var a = askHint(c.client, s);
  w.reply({ type: 'error', id: w.last().id, code: 'INVALID_STATE', detail: 'CORNER_TWIST' });
  await flush();
  assert.equal(a.t.value.payload.code, 'INVALID_STATE');
  assert.equal(clientModule.failureTextKey('INVALID_STATE'), 'error.invalidState');

  var l = reduce(s, 'DEMO_REQUEST', { kind: 'lbl', at: 0 });
  var lt = track(c.client.requestDemo(l, 'lbl'));
  w.reply({ type: 'error', id: w.last().id, code: 'LBL_STUCK', detail: 'check:cross' });
  await flush();
  assert.deepEqual(lt.value, { type: 'DEMO_FAILED', payload: { version: l.version, code: 'LBL_STUCK' } });
  assert.equal(clientModule.failureTextKey('LBL_STUCK'), 'error.generic');

  var u = askHint(c.client, s);
  w.reply({ type: 'error', id: w.last().id, code: 'COLOR_COUNT', detail: null });
  await flush();
  assert.equal(u.t.value.payload.code, 'INVALID_STATE');
  assert.equal(clientModule.failureTextKey('COLOR_COUNT'), 'error.invalidState');
  assert.equal(clientModule.failureTextKey(undefined), 'error.invalidState');

  var m = askHint(c.client, s);
  w.reply({ type: 'result', id: w.last().id, kind: 'solve', moves: 'R', qtm: 1, nodes: 1, complete: true });
  await flush();
  assert.equal(m.t.value.payload.code, 'INTERNAL', '格式不符的回覆不讓呼叫端永遠等待');

  var bad = track(c.client.requestDemo(s, 'optimal'));
  await flush();
  assert.equal(bad.value.payload.code, 'BAD_REQUEST');

  // NOT_READY：重建 Worker 並重送一次；第二次仍 NOT_READY 就回報
  var n = askHint(c.client, s);
  w.reply({ type: 'error', id: w.last().id, code: 'NOT_READY', detail: null });
  assert.ok(w.terminated);
  var w2 = c.workers.latest();
  assert.notEqual(w2, w);
  bootReady(w2, c.clock);
  assert.equal(w2.last().type, 'solve');
  w2.reply({ type: 'error', id: w2.last().id, code: 'NOT_READY', detail: null });
  await flush();
  assert.equal(n.t.value.payload.code, 'NOT_READY');
  assert.equal(c.workers.created.length, 2);
});

test('C-12 計畫快取上限 planCacheSize：超過丟最舊的', async function () {
  var small = JSON.parse(JSON.stringify(params));
  small.solver.planCacheSize = 3;
  var c = makeClient({ params: small });
  c.client.start();
  var w = c.workers.latest();
  bootReady(w, c.clock);
  var turns = ['R', 'U', 'F', 'L', 'D'];
  var s = stateFrom([], turns);
  var a = askHint(c.client, s);
  w.reply({ type: 'result', id: w.last().id, kind: 'solve', moves: inverseSeq(turns), qtm: 5, nodes: 1, complete: true });
  await flush();
  assert.equal(a.t.value.type, 'HINT_READY', '即使快取裝不下起點，也直接回傳本次結果');
  assert.deepEqual(a.t.value.payload.tokens, ["D'"]);
  assert.equal(c.client.cacheSize(), 3);
  // 最舊的（起點）已被丟掉：再要一次會送訊息
  var before = w.sent.length;
  askHint(c.client, s);
  assert.equal(w.sent.length, before + 1);
  // 較新的（剩 2 步的狀態）仍在
  c.client.cancel();
  var near = stateFrom([], ['R', 'U']);
  var n = askHint(c.client, near);
  await flush();
  assert.deepEqual(n.t.value.payload.tokens, ["U'"]);
  assert.equal(n.t.value.payload.planQtm, 2);
  assert.equal(c.client.cacheSize(), 3);
});

test('C-13 solver-client.js 不直接讀時鐘或計時器（一律透過 deps），也不自行計算規則', function () {
  var src = fs.readFileSync(path.join(ROOT, 'src/ui/solver-client.js'), 'utf8');
  var re = /Math\.random|Date\.now|new Date\(|performance\.now|setTimeout|setInterval|requestAnimationFrame|localStorage/;
  src.split('\n').forEach(function (line, i) {
    assert.ok(!re.test(line), 'solver-client.js 第 ' + (i + 1) + ' 行：' + line);
  });
  assert.ok(src.indexOf('SOLVER_WORKER_SRC') >= 0, '預設 createWorker 讀 window.SOLVER_WORKER_SRC（X-6）');
  assert.throws(function () { clientModule.createSolverClient({ engine: engine, params: params, lblConfig: lblConfig }); });
  assert.throws(function () { clientModule.createSolverClient({}); });
});

// ---------------------------------------------------------------------------
// S13／m-3（D-35）：主執行緒路徑的例外保護、watchdog 與「取消」
// 重現來源：docs/reports/T-001-code-review.md m-3（reviewer 的 cr-solver.js：createWorker 丟例外
// 進入 mainThread，solve 丟 'solver bug' → timer 回呼丟出例外、提示 Promise 永遠沒有結果）。
// ---------------------------------------------------------------------------

function throwingLbl() {
  return Object.assign({}, lbl, { generateLbl: function () { throw new Error('測試：lbl bug'); } });
}

function mainThreadClient(fake, lblImpl, clock) {
  var workers = makeWorkers();
  workers.throwOnCreate = true;
  var c = makeClient({ workers: workers, clock: clock, solvers: { twophase: fake, lbl: lblImpl || lbl } });
  c.client.start();
  assert.equal(c.client.status().state, 'mainThread');
  return c;
}

test('C-14 主執行緒 solve／層先法丟例外 → 以 INTERNAL 結束（與 Worker 路徑一致），計時器回呼不丟出、後面的 job 照常處理', async function () {
  var fake = fakeTwophase(null);
  fake.solve = function () { throw new Error('solver bug'); };
  var c = mainThreadClient(fake, throwingLbl());

  // (1) 提示：reviewer 的重現情境
  var a = askHint(c.client, stateFrom([], ['R', 'U']));
  assert.doesNotThrow(function () { c.clock.advance(0); }, '計時器回呼不得把求解器例外往外丟');
  await flush();
  assert.equal(a.t.done, true, '提示的 Promise 必須有結果');
  assert.deepEqual(a.t.value, { type: 'HINT_FAILED', payload: { version: a.state.version, code: 'INTERNAL' } });
  assert.equal(clientModule.failureTextKey('INTERNAL'), 'error.generic', '沿用既有失敗碼與文案鍵，不新增文案');
  var after = engine.reduce(a.state, a.t.value, DATA);
  assert.equal(after.hint, null, 'HINT_FAILED 被 reducer 接受，離開等待中');
  assert.equal(c.client.status().state, 'mainThread', '與 Worker 路徑相同：單次例外不改變求解器狀態');
  assert.equal(c.clock.pending(), 0, '沒有殘留的排程或 watchdog');

  // (2) 建議解示範：同樣以 INTERNAL 結束
  var d = reduce(stateFrom([], ['F']), 'DEMO_REQUEST', { kind: 'suggest', at: 0 });
  var dt = track(c.client.requestDemo(d, 'suggest'));
  c.clock.advance(0);
  await flush();
  assert.deepEqual(dt.value, { type: 'DEMO_FAILED', payload: { version: d.version, code: 'INTERNAL' } });

  // (3) 層先法示範：generateLbl 丟例外 → INTERNAL
  var l = reduce(stateFrom([], ['B']), 'DEMO_REQUEST', { kind: 'lbl', at: 0 });
  var lt = track(c.client.requestDemo(l, 'lbl'));
  c.clock.advance(0);
  await flush();
  assert.deepEqual(lt.value, { type: 'DEMO_FAILED', payload: { version: l.version, code: 'INTERNAL' } });
  assert.equal(engine.reduce(l, lt.value, DATA).demo, null);

  // (4) solve 回傳格式不符（acceptSolve 丟例外）→ INTERNAL
  fake.solve = function () { return { moves: [], names: 'not-array', qtm: 0, nodes: 1, complete: true }; };
  var b = askHint(c.client, stateFrom([], ['L']));
  c.clock.advance(0);
  await flush();
  assert.equal(b.t.value.payload.code, 'INTERNAL');

  // (5) 修好之後，同一個 client 仍能正常求解（佇列沒有卡住）
  fake.solve = function () { return { moves: [], names: ["D'"], qtm: 1, nodes: 1, complete: true }; };
  var ok = askHint(c.client, stateFrom([], ['D']));
  c.clock.advance(0);
  await flush();
  assert.deepEqual(ok.t.value.payload.tokens, ["D'"]);
});

test('C-15 failed 模式：層先法同步丟例外時 requestHint／requestDemo 不同步丟出，改回傳 INTERNAL；state 可離開等待中', async function () {
  var c = makeClient({ solvers: { twophase: twophase, lbl: throwingLbl() } });
  c.client.start();
  c.clock.advance(SP.initTimeoutMs); // 建表逾時 → failed（同 C-09）
  assert.equal(c.client.status().state, 'failed');

  var s = reduce(stateFrom([], ['R']), 'HINT_REQUEST', { at: 0 });
  var p;
  assert.doesNotThrow(function () { p = c.client.requestHint(s); }, 'requestHint 不得同步丟例外');
  var h = track(p);
  await flush();
  assert.deepEqual(h.value, { type: 'HINT_FAILED', payload: { version: s.version, code: 'INTERNAL' } });
  assert.equal(engine.reduce(s, h.value, DATA).hint, null, '結果可被 dispatch，提示離開等待中（不必靠重設／打亂）');

  var l = reduce(stateFrom([], ['U']), 'DEMO_REQUEST', { kind: 'lbl', at: 0 });
  var lp;
  assert.doesNotThrow(function () { lp = c.client.requestDemo(l, 'lbl'); });
  var lt = track(lp);
  await flush();
  assert.deepEqual(lt.value, { type: 'DEMO_FAILED', payload: { version: l.version, code: 'INTERNAL' } });
  assert.equal(engine.reduce(l, lt.value, DATA).demo, null);

  // 建議解示範在 failed 模式本來就回 SOLVER_FAILED（不變）
  var g = reduce(stateFrom([], ['F']), 'DEMO_REQUEST', { kind: 'suggest', at: 0 });
  var gt = track(c.client.requestDemo(g, 'suggest'));
  await flush();
  assert.equal(gt.value.payload.code, 'SOLVER_FAILED');

  // 連 state 本身都讀不了（solverInput 丟例外）也只回傳失敗 action
  var bad;
  assert.doesNotThrow(function () { bad = c.client.requestHint({ version: 7 }); });
  var bt = track(bad);
  await flush();
  assert.deepEqual(bt.value, { type: 'HINT_FAILED', payload: { version: 7, code: 'INTERNAL' } });
  assert.equal(c.client.cancel(), null, '沒有殘留的等待中請求');
});

test('C-16 主執行緒路徑的「取消」：排程中取消立即以 CANCELLED 結束，之後不再求解；取消後可再請求', async function () {
  var fake = fakeTwophase({ moves: [], names: ["R'"], alg: '', qtm: 1, nodes: 5, complete: true });
  var c = mainThreadClient(fake);
  var a = askHint(c.client, stateFrom([], ['R']));
  var cancelled = c.client.cancel();
  assert.deepEqual(cancelled, { type: 'HINT_FAILED', payload: { version: a.state.version, code: 'CANCELLED' } });
  await flush();
  assert.deepEqual(a.t.value, cancelled);
  assert.equal(engine.reduce(a.state, cancelled, DATA).hint, null);
  c.clock.advance(SP.solveTimeoutMs * 2);
  await flush();
  assert.equal(fake.solveOpts.length, 0, '已取消的 job 不再求解');
  assert.equal(c.clock.pending(), 0, '取消時 watchdog 一併清除');

  var b = askHint(c.client, stateFrom([], ['R']));
  c.clock.advance(0);
  await flush();
  assert.deepEqual(b.t.value.payload.tokens, ["R'"]);
});

// 模擬「0 ms 的排程計時器一直沒被執行」（例如被瀏覽器延後或遺失）：只丟掉 0 ms 的計時器
function lossyClock() {
  var clock = makeClock();
  var realSet = clock.setTimer;
  clock.dropped = 0;
  clock.setTimer = function (fn, ms) {
    if (ms === 0) { clock.dropped++; return { lost: true }; }
    return realSet(fn, ms);
  };
  return clock;
}

test('C-17 主執行緒 watchdog：排程後遲遲沒有執行 → solveTimeoutMs 後提示退回層先法、建議解示範回 TIMEOUT', async function () {
  var clock = lossyClock();
  var fake = fakeTwophase({ moves: [], names: ["R'"], alg: '', qtm: 1, nodes: 5, complete: true });
  var c = mainThreadClient(fake, lbl, clock);

  var a = askHint(c.client, stateFrom([], ['R']));
  clock.advance(SP.solveTimeoutMs - 1);
  await flush();
  assert.equal(a.t.done, false);
  clock.advance(1);
  await flush();
  assert.ok(clock.dropped >= 1);
  assert.equal(a.t.value.type, 'HINT_READY', '逾時後提示改用層先法（與 Worker 路徑 C-05 相同）');
  assert.equal(a.t.value.payload.source, 'lbl');
  engine.reduce(a.state, a.t.value, DATA);
  assert.equal(fake.solveOpts.length, 0);

  var clock2 = lossyClock();
  var c2 = mainThreadClient(fakeTwophase(null), lbl, clock2);
  var d = reduce(stateFrom([], ['F']), 'DEMO_REQUEST', { kind: 'suggest', at: 0 });
  var dt = track(c2.client.requestDemo(d, 'suggest'));
  clock2.advance(SP.solveTimeoutMs);
  await flush();
  assert.deepEqual(dt.value, { type: 'DEMO_FAILED', payload: { version: d.version, code: 'TIMEOUT' } });
  assert.equal(clientModule.failureTextKey('TIMEOUT'), 'demo.suggestUnavailable');
  assert.equal(clock2.pending(), 0);
});
