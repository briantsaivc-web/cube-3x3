// src/ui/app.js — UI 進入點：建立 store、solver-client、ctx，依序掛載各模組
//
// 依據：game-spec.md §9（示範播放器與互動 UI 契約）、§5（seed 產生）、§6.2（PAUSE）、
//       §12.5 測試掛鉤；分派單 T-001 S8a 輸出契約、X-8（ctx 介面先行）。
//
// ctx 介面完整說明見 docs/reports/T-001-S8a.md「介面契約」一節；S8b～S8d 只透過
// mount(ctx) 接入，不得修改本檔與 index.template.html（X-8）。
'use strict';

var engine = require('../engine/index.js');
var notation = require('./notation.js');
var cubeView = require('./cube-view.js');
var controls = require('./controls.js');
var gesture = require('./gesture.js');
var hintView = require('./hint-view.js');
var demoPlayer = require('./demo-player.js');
var records = require('./records.js');
var tutorial = require('./tutorial.js');
var solverClientModule = require('./solver-client.js');

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

function isRejectError(e) {
  return !!e && typeof e.message === 'string' && e.message.indexOf('REJECT:') === 0;
}

// D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
function numOr(v, dflt) {
  return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

// 測試掛鉤用：把 patch 的欄位深層合併進 base（回傳新物件，不改 base）。
function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  var out = Object.assign({}, base);
  Object.keys(patch).forEach(function (k) {
    var b = base ? base[k] : undefined;
    out[k] = (b && typeof b === 'object' && !Array.isArray(b)) ? deepMerge(b, patch[k]) : patch[k];
  });
  return out;
}

/**
 * D-26：輸入佇列（記號鍵、手勢轉層、撤銷／重做、示範上一步／下一步／分段跳轉共用）。
 *
 * 動畫中的點擊不再丟棄，而是排隊依序執行（修 K-1）；取出時重新檢查 canApply；
 * clear() 以世代計數器讓「已經在播動畫、還沒送出」的那一步作廢（修 m-2：NEW_GAME／RESET／上鎖時）。
 *
 * task 介面：
 *   build()        → action 或 null（取出時呼叫一次；動畫結束後再呼叫一次取得新的 at）
 *   animate(action) → Promise（純畫面；不送 action）
 *   after(done)    （可省略）送出（done=true）或作廢（done=false）後呼叫
 *
 * deps：{ max, pollMs, setTimer(fn, ms), canApply(action), dispatch(action), isLocked(), isBlocked() }
 *   max       最多排隊幾個（不含正在播放的那一個）；超過的輸入丟棄
 *   isBlocked 其他來源的動畫或 hold() 進行中時回傳 true，佇列等待（每 pollMs 再試）
 */
function createInputQueue(deps) {
  var items = [];
  var running = false;
  var generation = 0;
  var pollTimer = null;
  var holds = {};

  function held() { return Object.keys(holds).length > 0; }

  function clear() {
    generation++;
    var dropped = items;
    items = [];
    dropped.forEach(function (t) { if (typeof t.after === 'function') t.after(false); });
  }

  function schedulePoll() {
    if (pollTimer !== null) return;
    pollTimer = deps.setTimer(function () {
      pollTimer = null;
      pump();
    }, deps.pollMs);
  }

  function pump() {
    while (!running && items.length > 0) {
      if (deps.isLocked()) { clear(); return; }
      if (held() || deps.isBlocked()) { schedulePoll(); return; }
      var task = items.shift();
      var action = task.build();
      if (!action || !deps.canApply(action)) {
        if (typeof task.after === 'function') task.after(false);
        continue;
      }
      start(task, action);
    }
  }

  function start(task, action) {
    running = true;
    var gen = generation;
    var p;
    try {
      p = Promise.resolve(task.animate(action));
    } catch (e) {
      p = Promise.reject(e);
    }
    p.then(function () { finish(task, gen, true); }, function () { finish(task, gen, false); });
  }

  function finish(task, gen, animOk) {
    running = false;
    var done = false;
    try {
      if (animOk && gen === generation && !deps.isLocked()) {
        var fresh = task.build(); // 取得動畫結束當下的 at
        if (fresh && deps.canApply(fresh)) {
          deps.dispatch(fresh);
          done = true;
        }
      }
    } finally {
      if (typeof task.after === 'function') {
        try { task.after(done); } catch (e) { /* 單一 UI 錯誤不影響佇列 */ }
      }
      pump();
    }
  }

  return {
    enqueue: function (task) {
      if (deps.isLocked()) return false;
      if (items.length >= deps.max) return false;
      items.push(task);
      pump();
      return true;
    },
    clear: clear,
    busy: function () { return running || items.length > 0; },
    size: function () { return items.length; },
    hold: function (owner) { holds[owner] = true; },
    release: function (owner) {
      delete holds[owner];
      pump();
    }
  };
}

// 送出這些 action 時清空輸入佇列（D-26：NEW_GAME／RESET；另加示範與提示的開始／結束，
// 避免排隊中的轉動或示範單步套用到已經換掉的局面）。
var QUEUE_CLEAR_TYPES = { NEW_GAME: true, RESET: true, DEMO_REQUEST: true, DEMO_EXIT: true, HINT_REQUEST: true };

/**
 * 建立整個 UI（DOM、solver-client 就緒後才呼叫；供 boot() 使用，
 * 也讓測試環境可以直接呼叫並注入假的 window／document）。
 */
function createApp(win, doc) {
  var GAME_DATA = win.GAME_DATA || { texts: {}, palette: {}, params: {}, lbl: {} };
  var qs = new (win.URLSearchParams || URLSearchParams)(win.location.search);
  var testMode = qs.get('test') === '1';

  var data = GAME_DATA;
  if (testMode && qs.get('tutorial') === '0') {
    data = Object.assign({}, GAME_DATA, {
      params: Object.assign({}, GAME_DATA.params, {
        tutorial: Object.assign({}, GAME_DATA.params.tutorial, { enabled: false })
      })
    });
  }
  // S11 測試掛鉤（只在 ?test=1 時生效）：paramsPatch=<JSON> 深層合併進 params，
  // 例如 {"solver":{"firstNodeLimit":1000}} 讓建議解回 NODE_LIMIT、{"ui":{"turnAnimMs":0}} 關閉轉動動畫。
  if (testMode && qs.get('paramsPatch')) {
    var patch = null;
    try { patch = JSON.parse(qs.get('paramsPatch')); } catch (e) { patch = null; }
    if (patch && typeof patch === 'object') {
      data = Object.assign({}, data, { params: deepMerge(data.params, patch) });
    }
  }
  var params = data.params || {};

  var state = engine.initialState();
  var listeners = [];

  function getState() { return state; }

  // n-4：被 REJECT 的 action 留在可關閉的除錯記錄（環狀緩衝），預設不輸出到 console。
  var debugParams = params.debug || {};
  var rejectLogSize = numOr(debugParams.rejectLogSize, 50);
  var logRejectToConsole = debugParams.logRejectToConsole === true || (testMode && qs.get('debug') === '1');
  var rejectLog = [];
  function recordReject(action, e) {
    if (rejectLogSize <= 0) return;
    rejectLog.push({ type: action && action.type, reason: e.message });
    while (rejectLog.length > rejectLogSize) rejectLog.shift();
    if (logRejectToConsole && typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[cube3x3] ' + e.message);
    }
  }

  var queue = null; // 下方建立（需要 dispatch 與 ctx.anim）

  function dispatch(action) {
    if (queue && action && QUEUE_CLEAR_TYPES[action.type]) queue.clear();
    var next;
    try {
      next = engine.reduce(state, action, data);
    } catch (e) {
      if (isRejectError(e)) { recordReject(action, e); return; } // REJECT 只記錄不崩潰（分派單 S8a 輸出契約）
      throw e;
    }
    state = next;
    for (var i = 0; i < listeners.length; i++) listeners[i](state);
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      var idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  var root = doc.getElementById('app');

  function slot(name) {
    return root.querySelector('[data-slot="' + name + '"]');
  }

  // ---- ctx.panel：學習面板分頁與抽屜（UI 狀態，不進 engine state；X-3） ----
  var panelState = {
    tab: 'controls',
    expanded: !!(data.params.layout && data.params.layout.drawerExpandedDefault)
  };
  var panelListeners = [];
  var panel = {
    selectTab: function (tab) {
      if (tab !== 'controls' && tab !== 'demo') return;
      if (panelState.tab === tab) return;
      panelState.tab = tab;
      panelListeners.forEach(function (fn) { fn(); });
    },
    currentTab: function () { return panelState.tab; },
    expand: function (on) {
      var next = !!on;
      if (panelState.expanded === next) return;
      panelState.expanded = next;
      panelListeners.forEach(function (fn) { fn(); });
    },
    expanded: function () { return panelState.expanded; },
    onChange: function (fn) { panelListeners.push(fn); }
  };

  // ---- ctx.input：跨模組的輸入鎖（D-12；記號小教室、示範自動播放、手勢都要檢查）＋輸入佇列（D-26） ----
  var locks = {};
  function isLocked() { return Object.keys(locks).length > 0; }
  var inputParams = params.input || {};
  queue = createInputQueue({
    max: numOr(inputParams.queueMax, 3),
    pollMs: numOr(inputParams.queuePollMs, 16),
    setTimer: function (fn, ms) { return win.setTimeout(fn, ms); },
    canApply: function (action) { return engine.canApply(state, action, data); },
    dispatch: function (action) { dispatch(action); },
    isLocked: isLocked,
    isBlocked: function () { return !!(ctx.anim && ctx.anim.busy()); }
  });
  var input = {
    lock: function (owner) {
      locks[owner] = true;
      queue.clear(); // D-26：上鎖時清空佇列（含正在播動畫、尚未送出的那一步）
    },
    unlock: function (owner) {
      delete locks[owner];
    },
    locked: isLocked,
    // D-26：排入一個輸入（task 介面見 createInputQueue）；上鎖或佇列已滿時回傳 false（該輸入丟棄）
    enqueue: function (task) { return queue.enqueue(task); },
    clearQueue: function () { queue.clear(); },
    // 沒有排隊中的輸入、也沒有任何動畫在播（手勢開始、提示、示範自動播放用）
    idle: function () { return !queue.busy() && !(ctx.anim && ctx.anim.busy()); },
    // 暫停佇列處理但不清空（拖曳轉視角期間用；放開、吸附完成後 release）
    hold: function (owner) { queue.hold(owner); },
    release: function (owner) { queue.release(owner); }
  };

  var ctx = {
    root: root,
    data: data,
    engine: engine,
    notation: notation,
    getState: getState,
    dispatch: dispatch,
    subscribe: subscribe,
    panel: panel,
    input: input,
    slot: slot
  };

  // ---- ctx.solver：包裝 solver-client（S6），S8c 只呼叫這幾個方法（X-9） ----
  var solverListeners = [];
  var solverStatus = { state: 'booting', step: 0, total: 6, initMs: null, notice: false };
  var client = solverClientModule.createSolverClient({
    engine: engine,
    params: data.params,
    lblConfig: data.lbl,
    setTimer: function (fn, ms) { return win.setTimeout(fn, ms); },
    clearTimer: function (h) { win.clearTimeout(h); },
    now: function () { return Date.now(); },
    onStatus: function (s) {
      solverStatus = s;
      solverListeners.forEach(function (fn) { fn(s); });
    }
  });
  ctx.solver = {
    start: client.start,
    status: function () { return solverStatus; },
    requestHint: client.requestHint,
    requestDemo: client.requestDemo,
    cancel: client.cancel,
    onStatus: function (fn) { solverListeners.push(fn); },
    // D-19：補上 solver-client.js 既有的失敗碼→文案鍵對照（純函式，不含快取／退回邏輯），
    // 讓 S8c 的 hint-view.js 不必再自己複製一份同款對照表（見 docs/reports/T-001-S8c.md
    // 「需要其他角色配合的事」）。
    failureTextKey: client.failureTextKey
  };

  // ---- ctx.view／ctx.anim：cube-view.js 建立（必須先掛，其餘模組的 mount 才可能用到） ----
  cubeView.mount(ctx);

  // ---- §5：NEW_GAME 的 seed 只在 UI 層產生 ----
  function randomSeed() {
    try {
      if (win.crypto && typeof win.crypto.getRandomValues === 'function') {
        return win.crypto.getRandomValues(new Uint32Array(1))[0];
      }
    } catch (e) {
      // 忽略，改用 Date.now 備援
    }
    return Date.now() >>> 0;
  }

  // §11.4：打亂動畫（純視覺，逐一播放；播放中鎖住輸入）。state.home 在 NEW_GAME 當下
  // 就已經是打亂後的結果，這裡只是用 previewTurn 把過程「重播」給玩家看，不改變任何 state。
  function playScrambleAnim(scramble) {
    if (!scramble.length || !ctx.view || typeof ctx.view.previewTurn !== 'function') return;
    var ms = numOr(params.ui && params.ui.scrambleAnimMsPerMove, 60);
    if (ms <= 0) return; // D-25：設為 0 表示關閉打亂動畫
    input.lock('scramble-anim');
    var cur = engine.SOLVED.slice();
    var i = 0;
    function step() {
      if (i >= scramble.length) {
        ctx.view.clearPreview();
        input.unlock('scramble-anim');
        return;
      }
      var mv = scramble[i++];
      ctx.view.previewTurn(cur, mv, ms).then(function () {
        cur = engine.applyMove(cur, mv);
        step();
      }, function () {
        ctx.view.clearPreview();
        input.unlock('scramble-anim');
      });
    }
    step();
  }

  ctx.newGame = function () {
    dispatch({ type: 'NEW_GAME', payload: { seed: randomSeed(), at: nowMs() } });
    playScrambleAnim(getState().scramble);
  };

  // ---- 依序掛載各模組（S8b～S8d 目前為 S7 空殼；X-8：只能透過 ctx 與插槽） ----
  [controls, gesture, hintView, demoPlayer, records, tutorial].forEach(function (mod) {
    if (mod && typeof mod.mount === 'function') mod.mount(ctx);
  });

  ctx.solver.start();

  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'hidden') {
      dispatch({ type: 'PAUSE', payload: { at: nowMs(), reason: 'hidden' } });
    }
  });

  if (testMode) {
    win.__cubeTest = {
      getState: function () { return JSON.parse(JSON.stringify(state)); },
      dispatch: dispatch,
      // S11：除錯記錄與佇列狀態（只在 ?test=1 時提供）
      rejects: function () { return rejectLog.slice(); },
      queueSize: function () { return queue.size(); },
      inputIdle: function () { return input.idle(); },
      inputLocked: function () { return input.locked(); }
    };
  }

  return ctx;
}

function boot() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  createApp(window, document);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

module.exports = { boot: boot, createApp: createApp, createInputQueue: createInputQueue, numOr: numOr };
