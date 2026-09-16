// tests/engine/reducer.test.js — T-001 S3：reducer 行為測試
//
// 依據：game-spec.md §4（action 清單）、§6（計時與紀錄）、§12.1（T-ENG-*）。
// 本檔負責：T-ENG-13、15、16、17、18、19、20、21、22、23、26。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var cube = require('../../src/engine/cube.js');
var reducer = require('../../src/engine/reducer.js');
var paramsData = require('../../src/data/params.json');

var GAME_DATA = { params: paramsData };
var SEED = 20260915;

function newGame(seed, at) {
  return reducer.reduce(reducer.initialState(), { type: 'NEW_GAME', payload: { seed: seed, at: at } }, GAME_DATA);
}

function turn(state, move, at) {
  return reducer.reduce(state, { type: 'TURN', payload: { move: move, at: at } }, GAME_DATA);
}

// 依序把 moves 當成 user 操作套用（每步 at 遞增）。
function turnAll(state, moves, startAt) {
  var at = startAt;
  moves.forEach(function (m) {
    state = turn(state, m, at);
    at += 10;
  });
  return state;
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  Object.getOwnPropertyNames(value).forEach(function (key) {
    deepFreeze(value[key]);
  });
  return Object.freeze(value);
}

function rejectReason(fn) {
  try {
    fn();
  } catch (e) {
    var m = /^REJECT:([^:]+):(.+)$/.exec(e.message);
    if (!m) throw new Error('拒絕訊息格式不符：' + e.message);
    return { type: m[1], reason: m[2] };
  }
  throw new Error('預期拋出 REJECT 但沒有拋出');
}

// ---------------------------------------------------------------------------
// T-ENG-13：reduce 不修改輸入（深度凍結後呼叫不拋錯）
// ---------------------------------------------------------------------------

test('T-ENG-13：reduce 不修改輸入（深度凍結後呼叫不拋錯）', function () {
  var state = newGame(SEED, 1000);
  var frozen = deepFreeze(JSON.parse(JSON.stringify(state)));
  var before = JSON.stringify(frozen);

  var next = reducer.reduce(frozen, { type: 'TURN', payload: { move: 'R', at: 2000 } }, GAME_DATA);

  assert.equal(JSON.stringify(frozen), before, '輸入 state 不應被修改');
  assert.notEqual(next, frozen, '應回傳新物件');
  assert.equal(next.cursor, 1);
});

// ---------------------------------------------------------------------------
// T-ENG-15：撤銷／重做
// ---------------------------------------------------------------------------

test('T-ENG-15：撤銷／重做：TURN 後 UNDO 回原狀；REDO 再套用；新 TURN 清掉可重做部分；cursor=0 時 UNDO 被拒絕', function () {
  var s0 = newGame(SEED, 1000);
  var s1 = turn(s0, 'R', 1000);
  var s2 = turn(s1, 'U', 1010);

  var undone = reducer.reduce(s2, { type: 'UNDO', payload: { at: 1020 } }, GAME_DATA);
  assert.deepEqual(undone.home, s1.home, 'UNDO 後應回到上一步的 home');
  assert.equal(undone.cursor, 1);
  assert.equal(undone.history.length, 2, 'history 保留，供 REDO');

  var redone = reducer.reduce(undone, { type: 'REDO', payload: { at: 1030 } }, GAME_DATA);
  assert.deepEqual(redone.home, s2.home, 'REDO 後應回到 UNDO 之前的 home');
  assert.equal(redone.cursor, 2);

  // 新 TURN 會清掉可重做部分（此處 undone.cursor=1、history.length=2）。
  var afterNewTurn = turn(undone, 'F', 1040);
  assert.equal(afterNewTurn.history.length, 2, '截斷後只剩 [R, F]');
  assert.equal(afterNewTurn.history[1].m, 'F');
  assert.equal(afterNewTurn.cursor, 2);

  // cursor = 0 時 UNDO 被拒絕。
  var r = rejectReason(function () {
    reducer.reduce(s0, { type: 'UNDO', payload: { at: 1050 } }, GAME_DATA);
  });
  assert.equal(r.type, 'UNDO');
  assert.equal(reducer.canApply(s0, { type: 'UNDO', payload: { at: 1050 } }, GAME_DATA), false);
});

// ---------------------------------------------------------------------------
// T-ENG-16：步數
// ---------------------------------------------------------------------------

test('T-ENG-16：步數：moveCount 為 QTM 淨步數；ROTATE 不變；UNDO 扣回', function () {
  var s0 = newGame(SEED, 1000);
  var s1 = turn(s0, 'R', 1000); // 1
  var s2 = turn(s1, 'U2', 1010); // +2 = 3
  var s3 = turn(s2, 'M', 1020); // +2 = 5
  assert.equal(reducer.moveCount(s3), 5);

  var rotated = reducer.reduce(s3, { type: 'ROTATE', payload: { move: 'y' } }, GAME_DATA);
  assert.equal(reducer.moveCount(rotated), 5, 'ROTATE 不計步、不影響淨步數');

  var undone = reducer.reduce(rotated, { type: 'UNDO', payload: { at: 1030 } }, GAME_DATA);
  assert.equal(reducer.moveCount(undone), 3, 'UNDO 扣回最後一步（M＝2 步）');
});

// ---------------------------------------------------------------------------
// T-ENG-17：計時
// ---------------------------------------------------------------------------

test('T-ENG-17：計時：第一個 TURN 開始；ROTATE 不開始；PAUSE（hidden／lesson）暫停；回來後下一個 TURN 才恢復；完成即停；elapsedMs 正確；at 倒退時該段計 0', function () {
  var s0 = newGame(SEED, 1000);
  assert.equal(s0.timer.state, 'idle');

  var rotated = reducer.reduce(s0, { type: 'ROTATE', payload: { move: 'y' } }, GAME_DATA);
  assert.equal(rotated.timer.state, 'idle', 'ROTATE 不開始計時');

  var s1 = turn(s0, 'R', 1000);
  assert.equal(s1.timer.state, 'running');
  assert.equal(s1.timer.since, 1000);

  var pausedHidden = reducer.reduce(s1, { type: 'PAUSE', payload: { at: 1500, reason: 'hidden' } }, GAME_DATA);
  assert.equal(pausedHidden.timer.state, 'paused');
  assert.equal(pausedHidden.timer.accMs, 500);
  assert.equal(pausedHidden.timer.since, null);

  var pausedLesson = reducer.reduce(s1, { type: 'PAUSE', payload: { at: 1500, reason: 'lesson' } }, GAME_DATA);
  assert.equal(pausedLesson.timer.state, 'paused');
  assert.equal(pausedLesson.timer.accMs, 500);

  // 回到分頁不自動恢復；下一個 TURN 才恢復。
  var stillPaused = reducer.reduce(pausedHidden, { type: 'ROTATE', payload: { move: 'x' } }, GAME_DATA);
  assert.equal(stillPaused.timer.state, 'paused');
  var resumed = turn(pausedHidden, 'U', 2000);
  assert.equal(resumed.timer.state, 'running');
  assert.equal(resumed.timer.since, 2000);
  assert.equal(resumed.timer.accMs, 500);

  // elapsedMs 正確：running 時累計 + (now - since)。
  var selectors = require('../../src/engine/selectors.js');
  assert.equal(selectors.elapsedMs(resumed, 2300), 800);
  assert.equal(selectors.elapsedMs(pausedHidden, 9999), 500, 'paused 時不再累加');

  // 完成即停：把方塊解回復原（用 scramble 的反向）。
  var solveMoves = s0.scramble.slice().reverse().map(cube.inverse);
  var solved = turnAll(s0, solveMoves, 3000);
  assert.equal(solved.status, 'solved');
  assert.equal(solved.timer.state, 'stopped');
  assert.equal(solved.timer.since, null);

  // at 倒退時該段計 0：running 狀態下用比 since 早的 at 觸發 PAUSE。
  var early = turn(s0, 'R', 5000); // since = 5000, running
  var backInTime = reducer.reduce(early, { type: 'PAUSE', payload: { at: 4000, reason: 'hidden' } }, GAME_DATA);
  assert.equal(backInTime.timer.accMs, 0, 'at 早於 since 的那一段視為 0');
});

// ---------------------------------------------------------------------------
// T-ENG-18：提示
// ---------------------------------------------------------------------------

test('T-ENG-18：提示：HINT_REQUEST 暫停計時；版本不符的 HINT_READY 被拒絕（stale）；成功後 assist.hint=true；TURN 清除提示；ROTATE 不清除且 hintView 隨朝向換算', function () {
  var s0 = newGame(SEED, 1000);
  var s1 = turn(s0, 'R', 1000); // running

  var requested = reducer.reduce(s1, { type: 'HINT_REQUEST', payload: { at: 1200 } }, GAME_DATA);
  assert.equal(requested.timer.state, 'paused');
  assert.equal(requested.hint.pending, true);
  assert.equal(requested.hint.version, s1.version);

  var staleErr = rejectReason(function () {
    reducer.reduce(requested, {
      type: 'HINT_READY',
      payload: { version: requested.version + 999, tokens: ['R'], source: 'suggest', planQtm: 10 }
    }, GAME_DATA);
  });
  assert.equal(staleErr.type, 'HINT_READY');
  assert.equal(staleErr.reason, 'stale');

  var ready = reducer.reduce(requested, {
    type: 'HINT_READY',
    payload: { version: requested.version, tokens: ['R'], source: 'suggest', planQtm: 24 }
  }, GAME_DATA);
  assert.equal(ready.assist.hint, true);
  assert.equal(ready.hint.pending, false);
  assert.equal(ready.hint.move, cube.toHome(requested.orient, 'R'));

  var selectors = require('../../src/engine/selectors.js');
  var viewBefore = selectors.hintView(ready).move;

  var turned = turn(ready, 'U', 1300);
  assert.equal(turned.hint, null, 'TURN 清除提示');

  var rotated = reducer.reduce(ready, { type: 'ROTATE', payload: { move: 'y' } }, GAME_DATA);
  assert.notEqual(rotated.hint, null, 'ROTATE 不清除提示');
  var viewAfter = selectors.hintView(rotated).move;
  assert.notEqual(viewAfter, viewBefore, 'hintView 應隨朝向重新換算');
});

// ---------------------------------------------------------------------------
// T-ENG-19：示範
// ---------------------------------------------------------------------------

test('T-ENG-19：示範：DEMO_READY 設 assist.demo；DEMO_STEP ±1 正確套用／還原（含整顆旋轉）；示範中 TURN、ROTATE 被拒絕；DEMO_EXIT 保留進度；播到結尾 → solved 且 result.assist="demo"；recordEligible 為 false', function () {
  var s0 = newGame(SEED, 1000);

  // 先驗證整顆旋轉的單步套用／還原（不影響 home／history）。
  var reqRot = reducer.reduce(s0, { type: 'DEMO_REQUEST', payload: { kind: 'suggest', at: 1100 } }, GAME_DATA);
  var readyRot = reducer.reduce(reqRot, {
    type: 'DEMO_READY',
    payload: { version: reqRot.version, tokens: ['y'], segments: null }
  }, GAME_DATA);
  assert.equal(readyRot.assist.demo, true);
  var fwd = reducer.reduce(readyRot, { type: 'DEMO_STEP', payload: { delta: 1, at: 1110 } }, GAME_DATA);
  assert.equal(fwd.orient, cube.orientAfter(s0.orient, 'y'));
  assert.equal(fwd.demo.cursor, 1);
  assert.deepEqual(fwd.home, readyRot.home, '整顆旋轉不改 home');
  assert.equal(fwd.history.length, readyRot.history.length, '整顆旋轉不進 history');
  var back = reducer.reduce(fwd, { type: 'DEMO_STEP', payload: { delta: -1, at: 1120 } }, GAME_DATA);
  assert.equal(back.orient, s0.orient);
  assert.equal(back.demo.cursor, 0);

  // 示範中 TURN、ROTATE 被拒絕。
  var rTurn = rejectReason(function () {
    reducer.reduce(readyRot, { type: 'TURN', payload: { move: 'R', at: 1130 } }, GAME_DATA);
  });
  assert.equal(rTurn.reason, 'demoActive');
  var rRotate = rejectReason(function () {
    reducer.reduce(readyRot, { type: 'ROTATE', payload: { move: 'x' } }, GAME_DATA);
  });
  assert.equal(rRotate.reason, 'demoActive');

  // 完整播放到底：用 scramble 的反向序列作為示範記號（純轉動，orient 全程為 0）。
  var solveTokens = s0.scramble.slice().reverse().map(cube.inverse);
  var demoReq = reducer.reduce(s0, { type: 'DEMO_REQUEST', payload: { kind: 'suggest', at: 2000 } }, GAME_DATA);
  var demoReady = reducer.reduce(demoReq, {
    type: 'DEMO_READY',
    payload: { version: demoReq.version, tokens: solveTokens, segments: null }
  }, GAME_DATA);
  assert.equal(demoReady.assist.demo, true);
  assert.equal(demoReady.demo.baseCursor, 0);

  // 先播兩步，DEMO_EXIT 應保留進度（home／cursor 不還原）。
  var mid1 = reducer.reduce(demoReady, { type: 'DEMO_STEP', payload: { delta: 1, at: 2010 } }, GAME_DATA);
  var mid2 = reducer.reduce(mid1, { type: 'DEMO_STEP', payload: { delta: 1, at: 2020 } }, GAME_DATA);
  var exitedEarly = reducer.reduce(mid2, { type: 'DEMO_EXIT', payload: { at: 2030 } }, GAME_DATA);
  assert.equal(exitedEarly.demo, null);
  assert.deepEqual(exitedEarly.home, mid2.home, 'DEMO_EXIT 保留進度，不還原方塊');
  assert.equal(exitedEarly.cursor, mid2.cursor);

  // 播到結尾：完成判定成立。
  var cur = demoReady;
  for (var i = 0; i < solveTokens.length; i++) {
    cur = reducer.reduce(cur, { type: 'DEMO_STEP', payload: { delta: 1, at: 2100 + i } }, GAME_DATA);
  }
  assert.equal(cur.status, 'solved');
  assert.equal(cur.result.assist, 'demo');
  assert.equal(cube.isSolved(cur.home), true);

  var selectors = require('../../src/engine/selectors.js');
  assert.equal(selectors.recordEligible(cur), false, '看過示範不算破紀錄資格');

  // 回看：往回一步（home 不再復原，但 status 仍是 solved），DEMO_EXIT 應快轉回結尾再離開。
  var steppedBack = reducer.reduce(cur, { type: 'DEMO_STEP', payload: { delta: -1, at: 2200 } }, GAME_DATA);
  assert.equal(steppedBack.status, 'solved', '回看中 status 不變');
  assert.equal(cube.isSolved(steppedBack.home), false, '回看時方塊暫時不是復原狀態');
  assert.deepEqual(steppedBack.result, cur.result, 'result 不變');

  var exitedAfterSolve = reducer.reduce(steppedBack, { type: 'DEMO_EXIT', payload: { at: 2300 } }, GAME_DATA);
  assert.equal(exitedAfterSolve.demo, null);
  assert.equal(cube.isSolved(exitedAfterSolve.home), true, 'DEMO_EXIT 應先播到結尾再離開');
  assert.deepEqual(exitedAfterSolve.result, cur.result);
});

// ---------------------------------------------------------------------------
// T-ENG-20：RESET
// ---------------------------------------------------------------------------

test('T-ENG-20：RESET：回到 start、清空 history、計時 idle、assist 保留、orient 不變', function () {
  var s0 = newGame(SEED, 1000);
  var rotated = reducer.reduce(s0, { type: 'ROTATE', payload: { move: 'y' } }, GAME_DATA);
  var s1 = turn(rotated, cube.toHome(rotated.orient, 'R'), 1000);

  var requested = reducer.reduce(s1, { type: 'HINT_REQUEST', payload: { at: 1100 } }, GAME_DATA);
  var ready = reducer.reduce(requested, {
    type: 'HINT_READY',
    payload: { version: requested.version, tokens: ['R'], source: 'suggest', planQtm: 5 }
  }, GAME_DATA);
  assert.equal(ready.assist.hint, true);

  var reset = reducer.reduce(ready, { type: 'RESET', payload: { at: 1200 } }, GAME_DATA);
  assert.deepEqual(reset.home, reset.start);
  assert.deepEqual(reset.home, s0.home, '回到本局 start');
  assert.equal(reset.history.length, 0);
  assert.equal(reset.cursor, 0);
  assert.equal(reset.timer.state, 'idle');
  assert.equal(reset.timer.accMs, 0);
  assert.equal(reset.assist.hint, true, 'assist 保留');
  assert.equal(reset.orient, ready.orient, 'orient 不變');
  assert.equal(reset.status, 'playing', 'seed 不是 null 時回到 playing');
  assert.equal(reset.hint, null);
});

// ---------------------------------------------------------------------------
// T-ENG-21：solved 狀態的允許／拒絕清單
// ---------------------------------------------------------------------------

test('T-ENG-21：solved 狀態拒絕 TURN、UNDO、REDO、HINT_REQUEST、DEMO_REQUEST；接受 NEW_GAME、RESET、ROTATE', function () {
  var s0 = newGame(SEED, 1000);
  var solveMoves = s0.scramble.slice().reverse().map(cube.inverse);
  var solved = turnAll(s0, solveMoves, 3000);
  assert.equal(solved.status, 'solved');

  var rejectedActions = [
    { type: 'TURN', payload: { move: 'R', at: 9000 } },
    { type: 'UNDO', payload: { at: 9000 } },
    { type: 'REDO', payload: { at: 9000 } },
    { type: 'HINT_REQUEST', payload: { at: 9000 } },
    { type: 'DEMO_REQUEST', payload: { kind: 'suggest', at: 9000 } }
  ];
  rejectedActions.forEach(function (action) {
    assert.equal(reducer.canApply(solved, action, GAME_DATA), false, action.type + ' 應被拒絕');
    assert.throws(function () {
      reducer.reduce(solved, action, GAME_DATA);
    }, /^Error: REJECT:/, action.type + ' 應拋出 REJECT');
  });

  var acceptedActions = [
    { type: 'NEW_GAME', payload: { seed: SEED + 1, at: 9000 } },
    { type: 'RESET', payload: { at: 9000 } },
    { type: 'ROTATE', payload: { move: 'x' } }
  ];
  acceptedActions.forEach(function (action) {
    assert.equal(reducer.canApply(solved, action, GAME_DATA), true, action.type + ' 應被接受');
    assert.doesNotThrow(function () {
      reducer.reduce(solved, action, GAME_DATA);
    }, action.type + ' 不應拋出');
  });
});

// ---------------------------------------------------------------------------
// T-ENG-22：拒絕訊息格式與 canApply／reduce 一致性
// ---------------------------------------------------------------------------

test('T-ENG-22：拒絕訊息格式為 REJECT:<TYPE>:<reason>；canApply 與 reduce 判斷一致（對所有 action 類型抽樣）', function () {
  var s0 = newGame(SEED, 1000);
  var s1 = turn(s0, 'R', 1000);
  var solveMoves = s0.scramble.slice().reverse().map(cube.inverse);
  var solved = turnAll(s0, solveMoves, 3000);
  var hintPending = reducer.reduce(s1, { type: 'HINT_REQUEST', payload: { at: 2 } }, GAME_DATA);
  var demoPending = reducer.reduce(s1, { type: 'DEMO_REQUEST', payload: { kind: 'suggest', at: 2 } }, GAME_DATA);
  var lblPending = reducer.reduce(s1, { type: 'DEMO_REQUEST', payload: { kind: 'lbl', at: 2 } }, GAME_DATA);

  var samples = [
    [s0, { type: 'NEW_GAME', payload: { seed: -1, at: 1 } }],
    [s0, { type: 'NEW_GAME', payload: { seed: SEED, at: 1 } }],
    [s0, { type: 'TURN', payload: { move: 'x', at: 1 } }],
    [s0, { type: 'TURN', payload: { move: 'R', at: 1 } }],
    [s1, { type: 'ROTATE', payload: { move: 'R' } }],
    [s1, { type: 'ROTATE', payload: { move: 'y' } }],
    [s1, { type: 'SET_ORIENT', payload: { orient: 99 } }],
    [s1, { type: 'SET_ORIENT', payload: { orient: 5 } }],
    [s0, { type: 'UNDO', payload: { at: 1 } }],
    [s1, { type: 'UNDO', payload: { at: 1 } }],
    [s1, { type: 'REDO', payload: { at: 1 } }],
    [s0, { type: 'PAUSE', payload: { at: 1, reason: 'other' } }],
    [s0, { type: 'PAUSE', payload: { at: 1, reason: 'hidden' } }],
    [solved, { type: 'HINT_REQUEST', payload: { at: 1 } }],
    [s1, { type: 'HINT_REQUEST', payload: { at: 1 } }],
    [s1, { type: 'HINT_READY', payload: { version: 999, tokens: ['R'], source: 'suggest', planQtm: 1 } }],
    [s0, { type: 'DEMO_REQUEST', payload: { kind: 'bogus', at: 1 } }],
    [s0, { type: 'DEMO_REQUEST', payload: { kind: 'suggest', at: 1 } }],
    [s0, { type: 'DEMO_EXIT', payload: { at: 1 } }],
    // S11／m-1：格式錯誤的輸入也必須回 REJECT，且 canApply 與 reduce 一致
    [s0, { type: 'TURN', payload: { move: 'R3', at: 1 } }],
    [s0, { type: 'TURN', payload: { move: 'R\u2019', at: 1 } }],
    [s0, { type: 'TURN', payload: { move: 'constructor', at: 1 } }],
    [s0, { type: 'TURN', payload: { move: 42, at: 1 } }],
    [s0, { type: 'TURN', payload: {} }],
    [s1, { type: 'ROTATE', payload: { move: 'xx' } }],
    [s1, { type: 'ROTATE', payload: { move: 'x3' } }],
    [s1, { type: 'ROTATE', payload: {} }],
    [s1, { type: 'SET_ORIENT', payload: { orient: 1.5 } }],
    [s1, { type: 'SET_ORIENT', payload: { orient: '3' } }],
    [hintPending, { type: 'HINT_READY', payload: { version: hintPending.version, tokens: ['R9'], source: 'lbl', planQtm: null } }],
    [hintPending, { type: 'HINT_READY', payload: { version: hintPending.version, tokens: ['xx', 'R'], source: 'lbl', planQtm: null } }],
    [hintPending, { type: 'HINT_READY', payload: { version: hintPending.version, tokens: 'R', source: 'lbl', planQtm: null } }],
    [hintPending, { type: 'HINT_READY', payload: { version: hintPending.version, tokens: ['x'], source: 'lbl', planQtm: null } }],
    [hintPending, { type: 'ROTATE', payload: { move: 'y' } }],
    [hintPending, { type: 'SET_ORIENT', payload: { orient: 3 } }],
    [demoPending, { type: 'DEMO_READY', payload: { version: demoPending.version } }],
    [demoPending, { type: 'DEMO_READY', payload: { version: demoPending.version, tokens: [] } }],
    [demoPending, { type: 'DEMO_READY', payload: { version: demoPending.version, tokens: ['R', 'Q'] } }],
    [demoPending, { type: 'DEMO_READY', payload: { version: demoPending.version, tokens: ['R'], segments: 5 } }],
    [demoPending, { type: 'DEMO_READY', payload: { version: demoPending.version, tokens: ['R'], segments: null } }],
    [lblPending, { type: 'DEMO_READY', payload: { version: lblPending.version, tokens: ['R'] } }],
    [s0, { type: 'NEW_GAME', payload: { seed: 1, at: 1 } }, null],
    [s0, { type: 'NEW_GAME', payload: { seed: 1, at: 1 } }, {}],
    [s0, { type: 'NEW_GAME', payload: { seed: 1, at: 1 } }, { params: { scramble: { length: 0 } } }],
    [s0, { type: 'BOGUS', payload: {} }],
    [s0, null]
  ];

  samples.forEach(function (pair) {
    var state = pair[0];
    var action = pair[1];
    var data = pair.length > 2 ? pair[2] : GAME_DATA;
    var can = reducer.canApply(state, action, data);
    var threw = false;
    var message = null;
    try {
      reducer.reduce(state, action, data);
    } catch (e) {
      threw = true;
      message = e.message;
    }
    assert.equal(can, !threw, (action && action.type) + ' canApply 與 reduce 應一致：' + JSON.stringify(action));
    if (threw) {
      assert.match(message, /^REJECT:[^:]+:[^:]+$/, '拒絕訊息格式應為 REJECT:<TYPE>:<reason>：' + message);
      assert.ok(message.indexOf('REJECT:' + (action && action.type) + ':') === 0, 'TYPE 應等於 action.type：' + message);
    }
  });

  // S11／m-1：格式錯誤的輸入一律是 REJECT（不是其他例外），逐項確認
  samples.slice(19).forEach(function (pair) {
    var data = pair.length > 2 ? pair[2] : GAME_DATA;
    var action = pair[1];
    if (action && action.type === 'DEMO_READY' && action.payload.segments === null && action.payload.tokens) return; // 合法樣本
    assert.throws(function () { reducer.reduce(pair[0], action, data); }, /^Error: REJECT:/,
      '格式錯誤的輸入應回 REJECT：' + JSON.stringify(action));
  });
});

// ---------------------------------------------------------------------------
// T-ENG-23：recordEligible
// ---------------------------------------------------------------------------

test('T-ENG-23：recordEligible：無輔助完成 true；有提示、示範、自由模式皆 false', function () {
  var selectors = require('../../src/engine/selectors.js');

  // 無輔助完成。
  var s0 = newGame(SEED, 1000);
  var solveMoves = s0.scramble.slice().reverse().map(cube.inverse);
  var cleanSolved = turnAll(s0, solveMoves, 3000);
  assert.equal(cleanSolved.status, 'solved');
  assert.equal(cleanSolved.result.assist, 'none');
  assert.equal(selectors.recordEligible(cleanSolved), true);

  // 有提示。
  var s1 = newGame(SEED, 1000);
  var moves2 = s1.scramble.slice().reverse().map(cube.inverse);
  var requested = reducer.reduce(s1, { type: 'HINT_REQUEST', payload: { at: 1100 } }, GAME_DATA);
  var ready = reducer.reduce(requested, {
    type: 'HINT_READY',
    payload: { version: requested.version, tokens: [moves2[0]], source: 'suggest', planQtm: moves2.length }
  }, GAME_DATA);
  var hintedSolved = turnAll(ready, moves2, 2000);
  assert.equal(hintedSolved.status, 'solved');
  assert.equal(hintedSolved.result.assist, 'hint');
  assert.equal(selectors.recordEligible(hintedSolved), false);

  // 看過示範。
  var s2 = newGame(SEED, 1000);
  var moves3 = s2.scramble.slice().reverse().map(cube.inverse);
  var demoReq = reducer.reduce(s2, { type: 'DEMO_REQUEST', payload: { kind: 'suggest', at: 1100 } }, GAME_DATA);
  var demoReady = reducer.reduce(demoReq, {
    type: 'DEMO_READY',
    payload: { version: demoReq.version, tokens: moves3, segments: null }
  }, GAME_DATA);
  var cur = demoReady;
  for (var i = 0; i < moves3.length; i++) {
    cur = reducer.reduce(cur, { type: 'DEMO_STEP', payload: { delta: 1, at: 2000 + i } }, GAME_DATA);
  }
  assert.equal(cur.status, 'solved');
  assert.equal(cur.result.assist, 'demo');
  assert.equal(selectors.recordEligible(cur), false);

  // 自由模式：轉回復原狀態不會產生 result。
  var free = reducer.initialState();
  var freeTurned = reducer.reduce(free, { type: 'TURN', payload: { move: 'R', at: 1000 } }, GAME_DATA);
  var freeBack = reducer.reduce(freeTurned, { type: 'TURN', payload: { move: "R'", at: 1010 } }, GAME_DATA);
  assert.equal(freeBack.status, 'free');
  assert.equal(freeBack.result, null);
  assert.equal(cube.isSolved(freeBack.home), true);
  assert.equal(selectors.recordEligible(freeBack), false);
});

// ---------------------------------------------------------------------------
// T-ENG-26：PAUSE reason "lesson"（修訂 R-2a）
// ---------------------------------------------------------------------------

test('T-ENG-26：PAUSE {reason:"lesson"}：計時中→暫停、assist／hint／demo／home／history／version 不變、recordEligible 不受影響；reason 為其他值時拒絕（REJECT:PAUSE:badReason）', function () {
  var s0 = newGame(SEED, 1000);
  var s1 = turn(s0, 'R', 1000); // running

  var paused = reducer.reduce(s1, { type: 'PAUSE', payload: { at: 1500, reason: 'lesson' } }, GAME_DATA);
  assert.equal(paused.timer.state, 'paused');
  assert.equal(paused.timer.accMs, 500);
  assert.deepEqual(paused.assist, s1.assist);
  assert.deepEqual(paused.hint, s1.hint);
  assert.deepEqual(paused.demo, s1.demo);
  assert.deepEqual(paused.home, s1.home);
  assert.deepEqual(paused.history, s1.history);
  assert.equal(paused.version, s1.version);

  var selectors = require('../../src/engine/selectors.js');
  assert.equal(selectors.recordEligible(paused), selectors.recordEligible(s1), 'recordEligible 不受影響');

  var r = rejectReason(function () {
    reducer.reduce(s1, { type: 'PAUSE', payload: { at: 1500, reason: 'coffee-break' } }, GAME_DATA);
  });
  assert.equal(r.type, 'PAUSE');
  assert.equal(r.reason, 'badReason');
});

// ---------------------------------------------------------------------------
// T-ENG-27（S11／m-4）：hint.pending 期間拒絕 ROTATE／SET_ORIENT（hintPending）；
// 提示就緒後照常接受，且 hintView 隨朝向換算（T-ENG-18 行為不變）
// ---------------------------------------------------------------------------

test('T-ENG-27：hint.pending 期間拒絕 ROTATE／SET_ORIENT（REJECT:<TYPE>:hintPending）；提示就緒或失敗後照常接受', function () {
  var s0 = newGame(SEED, 1000);
  var pending = reducer.reduce(s0, { type: 'HINT_REQUEST', payload: { at: 1001 } }, GAME_DATA);
  assert.throws(function () {
    reducer.reduce(pending, { type: 'ROTATE', payload: { move: 'y' } }, GAME_DATA);
  }, /^Error: REJECT:ROTATE:hintPending$/);
  assert.throws(function () {
    reducer.reduce(pending, { type: 'SET_ORIENT', payload: { orient: 5 } }, GAME_DATA);
  }, /^Error: REJECT:SET_ORIENT:hintPending$/);
  assert.equal(reducer.canApply(pending, { type: 'ROTATE', payload: { move: 'y' } }, GAME_DATA), false);
  assert.equal(reducer.canApply(pending, { type: 'SET_ORIENT', payload: { orient: 5 } }, GAME_DATA), false);

  var ready = reducer.reduce(pending, {
    type: 'HINT_READY', payload: { version: pending.version, tokens: ['R'], source: 'lbl', planQtm: null }
  }, GAME_DATA);
  var rotated = reducer.reduce(ready, { type: 'ROTATE', payload: { move: 'y' } }, GAME_DATA);
  assert.notEqual(rotated.orient, ready.orient, '提示就緒後可以轉視角');
  var set = reducer.reduce(ready, { type: 'SET_ORIENT', payload: { orient: 5 } }, GAME_DATA);
  assert.equal(set.orient, 5);

  var failed = reducer.reduce(pending, { type: 'HINT_FAILED', payload: { version: pending.version, code: 'CANCELLED' } }, GAME_DATA);
  assert.equal(reducer.canApply(failed, { type: 'ROTATE', payload: { move: 'x' } }, GAME_DATA), true, '提示失敗後可以轉視角');
});
