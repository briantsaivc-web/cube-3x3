// tests/engine/invariants.test.js — T-001 S3：重放決定性與狀態不變式
//
// 依據：game-spec.md §3.5（不變式 INV-1～INV-6）、§12.1。
// 本檔負責：T-ENG-12、T-ENG-14。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var cube = require('../../src/engine/cube.js');
var reducer = require('../../src/engine/reducer.js');
var rngModule = require('../../src/engine/rng.js');
var paramsData = require('../../src/data/params.json');

var GAME_DATA = { params: paramsData };

// ---------------------------------------------------------------------------
// T-ENG-12：同 seed＋同 action 序列（含 at、提示、示範的 READY 內容）重放兩次，
// 最終 state deepStrictEqual。
// ---------------------------------------------------------------------------

// 用固定順序、但依實際執行到的 state（version、orient）動態組出下一個 action，
// 避免手動預算 version／orient 造成前置條件不合而被拒絕；因整個過程不含任何
// 非決定性來源，兩次呼叫必得完全相同的最終 state（T-ENG-12 的重點正是驗證這件事）。
function runFixedScenario() {
  var state = reducer.initialState();
  function apply(type, payload) {
    state = reducer.reduce(state, { type: type, payload: payload }, GAME_DATA);
  }

  apply('NEW_GAME', { seed: 20260915, at: 1000 });
  apply('TURN', { move: 'R', at: 1000 });
  apply('TURN', { move: 'U2', at: 1010 });
  apply('ROTATE', { move: 'y' });
  apply('TURN', { move: cube.toHome(state.orient, 'M'), at: 1020 });
  apply('UNDO', { at: 1030 });
  apply('REDO', { at: 1040 });
  apply('SET_ORIENT', { orient: 5 });
  apply('PAUSE', { at: 1050, reason: 'hidden' });
  apply('HINT_REQUEST', { at: 1060 });
  apply('HINT_READY', { version: state.version, tokens: ['y', 'R2'], source: 'suggest', planQtm: 18 });
  apply('TURN', { move: 'F', at: 1070 });
  apply('DEMO_REQUEST', { kind: 'lbl', at: 1080 });
  apply('DEMO_READY', {
    version: state.version,
    tokens: ['x', 'R', "U'", 'y2', 'F2'],
    segments: [
      { id: 'hold', start: 0, end: 1, qtm: 0, parts: [{ start: 0, end: 1, kind: 'rotate', formula: null }] },
      { id: 'cross', start: 1, end: 5, qtm: 4, parts: [{ start: 1, end: 5, kind: 'setup', formula: null }] }
    ]
  });
  apply('DEMO_STEP', { delta: 1, at: 1090 });
  apply('DEMO_STEP', { delta: 1, at: 1100 });
  apply('DEMO_STEP', { delta: -1, at: 1110 });
  apply('DEMO_SEEK', { cursor: 4, at: 1120 });
  apply('DEMO_EXIT', { at: 1130 });
  apply('PAUSE', { at: 1140, reason: 'lesson' });
  apply('RESET', { at: 1150 });

  return state;
}

test('T-ENG-12：同 seed＋同 action 序列（含 at、提示、示範的 READY 內容）重放兩次，最終 state deepStrictEqual', function () {
  var run1 = runFixedScenario();
  var run2 = runFixedScenario();
  assert.deepStrictEqual(run1, run2);
});

// ---------------------------------------------------------------------------
// T-ENG-14：隨機 1,000 個合法 action 序列，每步後不變式 INV-1～INV-6 成立
// ---------------------------------------------------------------------------

var TURN_MOVES = cube.MOVES.filter(function (m) { return cube.kind(m) !== 'rotation'; });
var ROTATION_MOVES = cube.MOVES.filter(function (m) { return cube.kind(m) === 'rotation'; });
var ACTION_TYPES = [
  'NEW_GAME', 'TURN', 'ROTATE', 'SET_ORIENT', 'UNDO', 'REDO', 'RESET', 'PAUSE',
  'HINT_REQUEST', 'HINT_READY', 'HINT_FAILED', 'HINT_CLEAR',
  'DEMO_REQUEST', 'DEMO_READY', 'DEMO_FAILED', 'DEMO_STEP', 'DEMO_SEEK', 'DEMO_EXIT'
];

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function randomHintTokens(rng) {
  var n = Math.floor(rng() * 3); // 0～2 個整顆旋轉
  var tokens = [];
  for (var i = 0; i < n; i++) tokens.push(pick(ROTATION_MOVES, rng));
  tokens.push(pick(TURN_MOVES, rng));
  return tokens;
}

function randomDemoTokens(rng) {
  var n = 2 + Math.floor(rng() * 8); // 2～9 個記號
  var tokens = [];
  for (var i = 0; i < n; i++) {
    tokens.push(rng() < 0.3 ? pick(ROTATION_MOVES, rng) : pick(TURN_MOVES, rng));
  }
  return tokens;
}

function trivialSegments(tokens) {
  return [{ id: 'all', start: 0, end: tokens.length, qtm: 0, parts: [] }];
}

function randomPayload(type, state, rng, at) {
  switch (type) {
    case 'NEW_GAME':
      return { seed: Math.floor(rng() * 1000000), at: at };
    case 'TURN':
      return { move: pick(TURN_MOVES, rng), at: at };
    case 'ROTATE':
      return { move: pick(ROTATION_MOVES, rng) };
    case 'SET_ORIENT':
      return { orient: Math.floor(rng() * cube.ORIENT_COUNT) };
    case 'UNDO':
    case 'REDO':
    case 'RESET':
    case 'HINT_REQUEST':
    case 'DEMO_EXIT':
      return { at: at };
    case 'PAUSE':
      return { at: at, reason: rng() < 0.5 ? 'hidden' : 'lesson' };
    case 'HINT_READY':
      return {
        version: state.hint ? state.hint.version : -1,
        tokens: randomHintTokens(rng),
        source: rng() < 0.5 ? 'suggest' : 'lbl',
        planQtm: rng() < 0.5 ? Math.floor(rng() * 40) : null
      };
    case 'HINT_FAILED':
      return { version: state.hint ? state.hint.version : -1, code: 'timeout' };
    case 'HINT_CLEAR':
      return {};
    case 'DEMO_REQUEST':
      return { kind: rng() < 0.5 ? 'suggest' : 'lbl', at: at };
    case 'DEMO_READY': {
      var tokens = randomDemoTokens(rng);
      var kind = state.demo ? state.demo.kind : 'suggest';
      return {
        version: state.demo ? state.demo.version : -1,
        tokens: tokens,
        segments: kind === 'lbl' ? trivialSegments(tokens) : null
      };
    }
    case 'DEMO_FAILED':
      return { version: state.demo ? state.demo.version : -1, code: 'timeout' };
    case 'DEMO_STEP':
      return { delta: rng() < 0.5 ? 1 : -1, at: at };
    case 'DEMO_SEEK': {
      var max = state.demo ? state.demo.tokens.length : 0;
      return { cursor: Math.floor(rng() * (max + 1)), at: at };
    }
    default:
      return {};
  }
}

// state 欄位鍵集合須與 game-spec.md §3.5 完全一致：不得多、不得少。
var EXPECTED_STATE_KEYS = [
  'specVersion', 'seed', 'scramble', 'status', 'home', 'start', 'orient',
  'history', 'cursor', 'version', 'timer', 'assist', 'hint', 'demo', 'result'
].sort();

function checkStateKeys(state) {
  assert.deepEqual(Object.keys(state).sort(), EXPECTED_STATE_KEYS, 'state 欄位鍵集合須與 §3.5 完全一致');
}

function checkInvariants(state) {
  checkStateKeys(state);

  // INV-1：home 等於 start 依序套用 history[0…cursor) 的結果。
  var replayed = cube.applyMoves(state.start, state.history.slice(0, state.cursor).map(function (h) { return h.m; }));
  assert.deepEqual(state.home, replayed, 'INV-1');

  // INV-2：0 ≤ cursor ≤ history.length。
  assert.ok(state.cursor >= 0 && state.cursor <= state.history.length, 'INV-2');

  // INV-3：status === "solved" 若且唯若 result !== null。
  assert.equal(state.status === 'solved', state.result !== null, 'INV-3');

  // INV-4：demo 就緒時，cursor − demo.baseCursor 等於 tokens[0…demo.cursor) 中「轉動」的個數，
  // 且 history[demo.baseCursor…cursor) 的 src 皆為 "demo"、history.length === cursor。
  if (state.demo && state.demo.pending === false) {
    var demo = state.demo;
    var turnCount = 0;
    for (var i = 0; i < demo.cursor; i++) {
      if (cube.kind(demo.tokens[i]) !== 'rotation') turnCount++;
    }
    assert.equal(state.cursor - demo.baseCursor, turnCount, 'INV-4 步數對應');
    for (var j = demo.baseCursor; j < state.cursor; j++) {
      assert.equal(state.history[j].src, 'demo', 'INV-4 src');
    }
    assert.equal(state.history.length, state.cursor, 'INV-4 history.length===cursor');
  }

  // INV-5：timer.state === "running" 若且唯若 timer.since !== null。
  assert.equal(state.timer.state === 'running', state.timer.since !== null, 'INV-5');

  // INV-6：state 可以 JSON.stringify 後還原成深度相等的物件。
  assert.deepStrictEqual(JSON.parse(JSON.stringify(state)), state, 'INV-6');
}

test('T-ENG-14：隨機 1,000 個合法 action 序列，每步後不變式 INV-1～INV-6 成立', function () {
  var rng = rngModule.makeRng(424242);
  var state = reducer.initialState();
  checkInvariants(state);

  var applied = 0;
  var attempts = 0;
  var at = 1000;
  while (applied < 1000 && attempts < 200000) {
    attempts++;
    var type = pick(ACTION_TYPES, rng);
    at += 1 + Math.floor(rng() * 20);
    var action = { type: type, payload: randomPayload(type, state, rng, at) };
    if (!reducer.canApply(state, action, GAME_DATA)) continue;
    state = reducer.reduce(state, action, GAME_DATA);
    checkInvariants(state);
    applied++;
  }
  assert.equal(applied, 1000, '應完成 1,000 個合法 action（實際嘗試 ' + attempts + ' 次）');
});
