// src/engine/reducer.js — 狀態機（reducer 模式）
//
// 依據：game-spec.md §3.4–§3.6（狀態模型）、§4（action 清單）、§6.1–§6.3（計時規則）。
//
// 設計原則（CLAUDE.md §3）：
//   - 純函數，不讀取時間、DOM、亂數或全域狀態；時間一律由 action 的 `at` 帶入。
//   - 不修改輸入 state（一律回傳新物件／新陣列）。
//   - `data` 只用到 `data.params.scramble.length`（分派單 S3 輸出契約）。
//   - 前置條件嚴格檢查（S11／m-1）：格式錯誤的記號、tokens、缺少 data 一律回 REJECT，
//     不讓 applyEffect 拋出非 REJECT 的例外，確保 canApply 與 reduce 判斷一致（T-ENG-22）。
'use strict';

var cube = require('./cube.js');
var scrambleModule = require('./scramble.js');

var SPEC_VERSION = '0.1.1';

// ---------------------------------------------------------------------------
// 1. 初始狀態（game-spec.md §3.5）
// ---------------------------------------------------------------------------

function initialState() {
  return {
    specVersion: SPEC_VERSION,
    seed: null,
    scramble: [],
    status: 'free',
    home: cube.SOLVED.slice(),
    start: cube.SOLVED.slice(),
    orient: 0,
    history: [],
    cursor: 0,
    version: 0,
    timer: { state: 'idle', accMs: 0, since: null },
    assist: { hint: false, demo: false },
    hint: null,
    demo: null,
    result: null
  };
}

// ---------------------------------------------------------------------------
// 2. 小工具
// ---------------------------------------------------------------------------

function isUint32(n) {
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
}

// 提示的 tokens 必須是「0 個以上整顆旋轉 ＋ 恰好 1 個轉動」（game-spec.md §4 HINT_READY）。
function isValidHintTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length < 1) return false;
  for (var i = 0; i < tokens.length; i++) {
    if (!cube.isMove(tokens[i])) return false;
  }
  for (var j = 0; j < tokens.length - 1; j++) {
    if (cube.kind(tokens[j]) !== 'rotation') return false;
  }
  return cube.kind(tokens[tokens.length - 1]) !== 'rotation';
}

// 示範的 tokens 必須是非空陣列，且每個元素都是合法記號（S11／m-1）。
// 非空的理由：DEMO_REQUEST 要求方塊未復原，合法的示範至少有一個轉動。
function isValidDemoTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length < 1) return false;
  for (var i = 0; i < tokens.length; i++) {
    if (!cube.isMove(tokens[i])) return false;
  }
  return true;
}

// NEW_GAME 需要 data.params.scramble.length（正整數），缺少時回 REJECT（S11／m-1）。
function hasScrambleParams(data) {
  return !!(data && data.params && data.params.scramble &&
    Number.isInteger(data.params.scramble.length) && data.params.scramble.length > 0);
}

// 本局淨步數（game-spec.md §2.2）：history[0…cursor) 每筆轉動的 qtmCost 總和。
function moveCountOf(state) {
  var sum = 0;
  for (var i = 0; i < state.cursor; i++) {
    sum += cube.qtmCost(state.history[i].m);
  }
  return sum;
}

// 計時器：開始或恢復（§6.2）。idle／paused → running，since = at，accMs 不變；
// 已經是 running 時維持不變。
function startOrResumeTimer(timer, at) {
  if (timer.state === 'running') return timer;
  return { state: 'running', accMs: timer.accMs, since: at };
}

// 計時器：暫停（§6.2）。只有 running 才會變化；at 早於 since 時該段計 0。
function pauseTimerAt(timer, at) {
  if (timer.state !== 'running') return timer;
  return { state: 'paused', accMs: timer.accMs + Math.max(0, at - timer.since), since: null };
}

// 計時器：完成時停止（§6.2）。若當時是 paused／idle，直接停止、accMs 不變。
function stopTimerAt(timer, at) {
  if (timer.state === 'running') {
    return { state: 'stopped', accMs: timer.accMs + Math.max(0, at - timer.since), since: null };
  }
  return { state: 'stopped', accMs: timer.accMs, since: null };
}

// 完成判定（§4 開頭）：每次 home 改變後，若 status === "playing" 且 isSolved(home)，
// 轉為 solved、停止計時、凍結 result。
function applyCompletion(state, at) {
  if (state.status === 'playing' && cube.isSolved(state.home)) {
    var timer = stopTimerAt(state.timer, at);
    var assist = state.assist.demo ? 'demo' : (state.assist.hint ? 'hint' : 'none');
    return Object.assign({}, state, {
      status: 'solved',
      timer: timer,
      result: { timeMs: timer.accMs, qtm: moveCountOf(state), assist: assist }
    });
  }
  return state;
}

// ---------------------------------------------------------------------------
// 3. 前置條件檢查（reduce 與 canApply 共用同一份邏輯，確保 T-ENG-22 一致）
// ---------------------------------------------------------------------------

function checkAction(state, action, data) {
  if (!action || typeof action.type !== 'string') return 'invalidAction';
  var payload = action.payload || {};
  switch (action.type) {
    case 'NEW_GAME':
      if (!isUint32(payload.seed)) return 'invalidSeed';
      if (!hasScrambleParams(data)) return 'missingData';
      return null;

    case 'TURN': {
      if (state.status === 'solved') return 'solved';
      if (state.demo !== null) return 'demoActive';
      if (state.hint && state.hint.pending) return 'hintPending';
      if (!cube.isMove(payload.move)) return 'notATurn';
      if (cube.kind(payload.move) === 'rotation') return 'notATurn';
      return null;
    }

    case 'ROTATE': {
      if (state.demo !== null) return 'demoActive';
      // S11／m-4：等提示期間不改朝向，讓「提示以請求當下的 orient 換算」成為結構性保證（D-12）。
      if (state.hint && state.hint.pending) return 'hintPending';
      if (!cube.isMove(payload.move)) return 'notARotation';
      if (cube.kind(payload.move) !== 'rotation') return 'notARotation';
      return null;
    }

    case 'SET_ORIENT': {
      if (state.demo !== null) return 'demoActive';
      if (state.hint && state.hint.pending) return 'hintPending'; // S11／m-4
      if (!(Number.isInteger(payload.orient) && payload.orient >= 0 && payload.orient < cube.ORIENT_COUNT)) {
        return 'invalidOrient';
      }
      return null;
    }

    case 'UNDO': {
      if (state.cursor <= 0) return 'noHistory';
      if (state.status === 'solved') return 'solved';
      if (state.demo !== null) return 'demoActive';
      if (state.hint && state.hint.pending) return 'hintPending';
      return null;
    }

    case 'REDO': {
      if (state.cursor >= state.history.length) return 'noRedo';
      if (state.status === 'solved') return 'solved';
      if (state.demo !== null) return 'demoActive';
      if (state.hint && state.hint.pending) return 'hintPending';
      return null;
    }

    case 'RESET':
      return null;

    case 'PAUSE':
      if (payload.reason !== 'hidden' && payload.reason !== 'lesson') return 'badReason';
      return null;

    case 'HINT_REQUEST': {
      if (state.status === 'solved') return 'solved';
      if (cube.isSolved(state.home)) return 'alreadySolved';
      if (state.demo !== null) return 'demoActive';
      if (state.hint && state.hint.pending) return 'hintPending';
      return null;
    }

    case 'HINT_READY': {
      if (!(state.hint && state.hint.pending)) return 'notPending';
      if (payload.version !== state.version) return 'stale';
      if (!isValidHintTokens(payload.tokens)) return 'invalidTokens';
      return null;
    }

    case 'HINT_FAILED': {
      if (!(state.hint && state.hint.pending)) return 'notPending';
      if (payload.version !== state.version) return 'stale';
      return null;
    }

    case 'HINT_CLEAR':
      if (!(state.hint && state.hint.pending === false)) return 'noHint';
      return null;

    case 'DEMO_REQUEST': {
      if (payload.kind !== 'suggest' && payload.kind !== 'lbl') return 'invalidKind';
      if (state.status === 'solved') return 'solved';
      if (cube.isSolved(state.home)) return 'alreadySolved';
      if (state.demo !== null) return 'demoActive';
      if (state.hint && state.hint.pending) return 'hintPending';
      return null;
    }

    case 'DEMO_READY': {
      if (!(state.demo && state.demo.pending)) return 'notPending';
      if (payload.version !== state.version) return 'stale';
      if (!isValidDemoTokens(payload.tokens)) return 'invalidTokens';
      if (state.demo.kind === 'lbl' && !payload.segments) return 'missingSegments';
      if (payload.segments !== undefined && payload.segments !== null && !Array.isArray(payload.segments)) {
        return 'invalidSegments';
      }
      return null;
    }

    case 'DEMO_FAILED': {
      if (!(state.demo && state.demo.pending)) return 'notPending';
      if (payload.version !== state.version) return 'stale';
      return null;
    }

    case 'DEMO_STEP': {
      if (!(state.demo && state.demo.pending === false)) return 'notReady';
      if (payload.delta !== 1 && payload.delta !== -1) return 'invalidDelta';
      var target = state.demo.cursor + payload.delta;
      if (target < 0 || target > state.demo.tokens.length) return 'outOfRange';
      return null;
    }

    case 'DEMO_SEEK': {
      if (!(state.demo && state.demo.pending === false)) return 'notReady';
      if (!(Number.isInteger(payload.cursor) && payload.cursor >= 0 && payload.cursor <= state.demo.tokens.length)) {
        return 'outOfRange';
      }
      return null;
    }

    case 'DEMO_EXIT':
      if (state.demo === null) return 'noDemo';
      return null;

    default:
      return 'unknownAction';
  }
}

// ---------------------------------------------------------------------------
// 4. 示範單步（DEMO_STEP／DEMO_SEEK／DEMO_EXIT 共用）
// ---------------------------------------------------------------------------

function demoStepForward(state, at) {
  var demo = state.demo;
  var t = demo.tokens[demo.cursor];
  if (cube.kind(t) === 'rotation') {
    return Object.assign({}, state, {
      orient: cube.orientAfter(state.orient, t),
      demo: Object.assign({}, demo, { cursor: demo.cursor + 1 })
    });
  }
  var m = cube.toHome(state.orient, t);
  var newHistory = state.history.slice(0, state.cursor).concat([{ m: m, src: 'demo' }]);
  var next = Object.assign({}, state, {
    history: newHistory,
    cursor: state.cursor + 1,
    home: cube.applyMove(state.home, m),
    version: state.version + 1,
    demo: Object.assign({}, demo, { cursor: demo.cursor + 1 })
  });
  return applyCompletion(next, at);
}

function demoStepBackward(state) {
  var demo = state.demo;
  var t = demo.tokens[demo.cursor - 1];
  if (cube.kind(t) === 'rotation') {
    return Object.assign({}, state, {
      orient: cube.orientAfter(state.orient, cube.inverse(t)),
      demo: Object.assign({}, demo, { cursor: demo.cursor - 1 })
    });
  }
  var lastEntry = state.history[state.history.length - 1]; // INV-4：必為 src:"demo"
  var newHistory = state.history.slice(0, state.history.length - 1);
  return Object.assign({}, state, {
    history: newHistory,
    cursor: state.cursor - 1,
    home: cube.applyMove(state.home, cube.inverse(lastEntry.m)),
    version: state.version + 1,
    demo: Object.assign({}, demo, { cursor: demo.cursor - 1 })
  });
}

// ---------------------------------------------------------------------------
// 5. 狀態轉移（僅在 checkAction 回傳 null 之後呼叫）
// ---------------------------------------------------------------------------

function applyEffect(state, action, data) {
  var payload = action.payload || {};
  switch (action.type) {
    case 'NEW_GAME': {
      var length = data.params.scramble.length;
      var scramble = scrambleModule.makeScramble(payload.seed, { length: length });
      var start = cube.applyMoves(cube.SOLVED, scramble);
      return {
        specVersion: state.specVersion,
        seed: payload.seed,
        scramble: scramble,
        status: 'playing',
        home: start.slice(),
        start: start.slice(),
        orient: 0,
        history: [],
        cursor: 0,
        version: state.version + 1,
        timer: { state: 'idle', accMs: 0, since: null },
        assist: { hint: false, demo: false },
        hint: null,
        demo: null,
        result: null
      };
    }

    case 'TURN': {
      var m = cube.toHome(state.orient, payload.move);
      var newHistory = state.history.slice(0, state.cursor).concat([{ m: m, src: 'user' }]);
      var newTimer = state.status === 'playing' ? startOrResumeTimer(state.timer, payload.at) : state.timer;
      var next = Object.assign({}, state, {
        history: newHistory,
        cursor: state.cursor + 1,
        home: cube.applyMove(state.home, m),
        version: state.version + 1,
        hint: null,
        timer: newTimer
      });
      return applyCompletion(next, payload.at);
    }

    case 'ROTATE':
      return Object.assign({}, state, { orient: cube.orientAfter(state.orient, payload.move) });

    case 'SET_ORIENT':
      return Object.assign({}, state, { orient: payload.orient });

    case 'UNDO': {
      var undoEntry = state.history[state.cursor - 1];
      var undoTimer = state.status === 'playing' ? startOrResumeTimer(state.timer, payload.at) : state.timer;
      var undoNext = Object.assign({}, state, {
        home: cube.applyMove(state.home, cube.inverse(undoEntry.m)),
        cursor: state.cursor - 1,
        version: state.version + 1,
        hint: null,
        timer: undoTimer
      });
      return applyCompletion(undoNext, payload.at);
    }

    case 'REDO': {
      var redoEntry = state.history[state.cursor];
      var redoTimer = state.status === 'playing' ? startOrResumeTimer(state.timer, payload.at) : state.timer;
      var redoNext = Object.assign({}, state, {
        home: cube.applyMove(state.home, redoEntry.m),
        cursor: state.cursor + 1,
        version: state.version + 1,
        hint: null,
        timer: redoTimer
      });
      return applyCompletion(redoNext, payload.at);
    }

    case 'RESET':
      return Object.assign({}, state, {
        home: state.start.slice(),
        history: [],
        cursor: 0,
        status: state.seed === null ? 'free' : 'playing',
        timer: { state: 'idle', accMs: 0, since: null },
        hint: null,
        demo: null,
        result: null,
        version: state.version + 1
      });

    case 'PAUSE':
      return Object.assign({}, state, { timer: pauseTimerAt(state.timer, payload.at) });

    case 'HINT_REQUEST':
      return Object.assign({}, state, {
        hint: { pending: true, version: state.version, orient: state.orient },
        timer: pauseTimerAt(state.timer, payload.at)
      });

    case 'HINT_READY': {
      var o = state.hint.orient;
      for (var i = 0; i < payload.tokens.length - 1; i++) {
        o = cube.orientAfter(o, payload.tokens[i]);
      }
      var lastToken = payload.tokens[payload.tokens.length - 1];
      var homeMove = cube.toHome(o, lastToken);
      return Object.assign({}, state, {
        hint: {
          pending: false,
          move: homeMove,
          source: payload.source,
          planQtm: payload.planQtm === undefined ? null : payload.planQtm
        },
        assist: Object.assign({}, state.assist, { hint: true })
      });
    }

    case 'HINT_FAILED':
      return Object.assign({}, state, { hint: null });

    case 'HINT_CLEAR':
      return Object.assign({}, state, { hint: null });

    case 'DEMO_REQUEST':
      return Object.assign({}, state, {
        demo: {
          kind: payload.kind,
          pending: true,
          version: state.version,
          orient: state.orient,
          tokens: [],
          segments: null,
          cursor: 0,
          baseCursor: 0
        },
        hint: null,
        timer: pauseTimerAt(state.timer, payload.at)
      });

    case 'DEMO_READY':
      return Object.assign({}, state, {
        demo: Object.assign({}, state.demo, {
          pending: false,
          tokens: payload.tokens,
          segments: payload.segments === undefined ? null : payload.segments,
          baseCursor: state.cursor
        }),
        history: state.history.slice(0, state.cursor),
        assist: Object.assign({}, state.assist, { demo: true })
      });

    case 'DEMO_FAILED':
      return Object.assign({}, state, { demo: null });

    case 'DEMO_STEP':
      return payload.delta === 1 ? demoStepForward(state, payload.at) : demoStepBackward(state);

    case 'DEMO_SEEK': {
      var cur = state;
      while (cur.demo.cursor < payload.cursor) cur = demoStepForward(cur, payload.at);
      while (cur.demo.cursor > payload.cursor) cur = demoStepBackward(cur);
      return cur;
    }

    case 'DEMO_EXIT': {
      var exitState = state;
      if (state.status === 'solved' && !cube.isSolved(state.home)) {
        while (exitState.demo.cursor < exitState.demo.tokens.length) {
          exitState = demoStepForward(exitState, payload.at);
        }
      }
      return Object.assign({}, exitState, { demo: null });
    }

    default:
      throw new Error('applyEffect: 未知 action ' + action.type);
  }
}

// ---------------------------------------------------------------------------
// 6. 對外介面
// ---------------------------------------------------------------------------

function reduce(state, action, data) {
  var reason = checkAction(state, action, data);
  if (reason !== null) {
    throw new Error('REJECT:' + (action && action.type) + ':' + reason);
  }
  return applyEffect(state, action, data);
}

function canApply(state, action, data) {
  try {
    return checkAction(state, action, data) === null;
  } catch (e) {
    return false;
  }
}

module.exports = {
  initialState: initialState,
  reduce: reduce,
  canApply: canApply,
  moveCount: moveCountOf
};
