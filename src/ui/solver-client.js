// src/ui/solver-client.js — 主執行緒端的求解器客戶端
//
// 依據：game-spec.md §7.5（計畫快取）、§9.4（求解器狀態）、§9.5（訊息協定）、§9.6（逾時與退回）；
//       ADR-001-solver.md §2.5、§2.6；分派單 T-001 S6、X-6、X-9；技術裁決 D-2、D-3、D-5。
//
// 職責（S8c 只呼叫 requestHint／requestDemo／cancel／status，不自行實作以下任何一項）：
//   - 建立 Worker、送 init、追蹤建表進度（booting → building → ready）。
//   - 請求佇列：Worker 內同時只有一個求解請求；建表完成前的請求先排隊。
//   - watchdog：initTimeoutMs、solveTimeoutMs（本檔在 UI 層，可以用時鐘，但一律透過注入的 deps）。
//   - 計畫快取（鍵＝home 貼紙字串，值＝剩下的 home 記號序列）。
//   - 退回：Worker 建不起來 → mainThread；建表逾時或出錯 → failed；
//           求解逾時或 NODE_LIMIT → 本次改用層先法（提示）或回報建議解不可用（建議解示範）。
//   - S13／m-3（D-35）：主執行緒路徑與 Worker 路徑一致——求解器或層先法丟例外時以 INTERNAL 結束；
//     主執行緒的 job 也有 solveTimeoutMs watchdog（逾時以 TIMEOUT 退回，與 Worker 路徑相同）；
//     requestHint／requestDemo 一律回傳 Promise，不會同步丟例外，所以等待卡的「取消」在所有路徑都有效。
//     注意：主執行緒上的計算是同步的，watchdog 無法中斷一次正在進行的計算；真正的計算量上限仍是
//     params.solver 的搜尋節點上限（NODE_LIMIT）。watchdog 保護的是「job 排了程卻一直沒有結果」的情形。
//
// deps（全部由外部注入，Node 測試可用假 Worker 與假時鐘）：
//   createWorker(handlers) → {postMessage(msg), terminate()}
//       handlers = {onMessage(data), onError(err)}；建不起來就丟例外（→ mainThread）。
//       省略時使用 defaultCreateWorker（瀏覽器：以 window.SOLVER_WORKER_SRC 建 Blob Worker）。
//   setTimer(fn, ms) → handle、clearTimer(handle)、now() → 毫秒
//   engine    src/engine/index.js（solverInput、isSolvedNow、viewStickers、toHome、toView、applyMove、qtmCost、kind）
//   params    GAME_DATA.params（本檔讀 params.solver；D-3：init 與 solve 一律傳入 params.solver）
//   lblConfig GAME_DATA.lbl（lbl.json 全文）
//   onStatus(status)  狀態改變時呼叫（可省略）
//   solvers   {twophase, lbl}（可省略；省略時 require 主 bundle 內的 solver 模組，供主執行緒退回使用）
//
// 回傳的 action 只有下列形式（UI 直接 dispatch；reducer 拒絕時丟棄即可）：
//   {type:'HINT_READY',  payload:{version, tokens, source, planQtm}}
//   {type:'HINT_FAILED', payload:{version, code}}
//   {type:'DEMO_READY',  payload:{version, tokens, segments}}
//   {type:'DEMO_FAILED', payload:{version, code}}
'use strict';

// 主 bundle 也包含 solver 模組（ADR-001 §2.6），供主執行緒退回與層先法退回使用
var defaultTwophase = require('../solver/twophase.js');
var defaultLbl = require('../solver/lbl.js');

var STATES = ['booting', 'building', 'ready', 'mainThread', 'failed'];

// 失敗碼 → 文案鍵（texts.json）。UI 依此顯示，不要自己依字串分支。
// 不在表內的碼依 D-5 一律視為非法狀態。
var FAILURE_TEXT_KEYS = {
  CANCELLED: null,
  ALREADY_SOLVED: null,
  NODE_LIMIT: 'demo.suggestUnavailable',
  TIMEOUT: 'demo.suggestUnavailable',
  SOLVER_FAILED: 'demo.suggestUnavailable',
  INVALID_STATE: 'error.invalidState',
  LBL_STUCK: 'error.generic',
  BAD_REQUEST: 'error.generic',
  NOT_READY: 'error.generic',
  INTERNAL: 'error.generic'
};

/**
 * 失敗碼對應的文案鍵（'demo.suggestUnavailable'｜'error.invalidState'｜'error.generic'｜null）。
 * 'demo.suggestUnavailable' 表示應提供「改看層先法示範」按鈕（§9.6）。
 */
function failureTextKey(code) {
  if (Object.prototype.hasOwnProperty.call(FAILURE_TEXT_KEYS, code)) return FAILURE_TEXT_KEYS[code];
  return 'error.invalidState';
}

/**
 * 瀏覽器預設的 Worker 建立方式：以 window.SOLVER_WORKER_SRC 產生 Blob URL（ADR-001 §2.5）。
 * 任何一步不可用都丟例外，讓 client 轉 mainThread。
 */
function defaultCreateWorker(handlers) {
  var g = typeof window !== 'undefined' ? window : null;
  if (!g || typeof g.SOLVER_WORKER_SRC !== 'string' || typeof g.Worker !== 'function' ||
      typeof g.Blob !== 'function' || !g.URL || typeof g.URL.createObjectURL !== 'function') {
    throw new Error('solver-client：此環境無法建立 Worker');
  }
  var url = g.URL.createObjectURL(new g.Blob([g.SOLVER_WORKER_SRC], { type: 'text/javascript' }));
  var w;
  try {
    w = new g.Worker(url);
  } catch (e) {
    g.URL.revokeObjectURL(url);
    throw e;
  }
  // n-7：Worker 建立後就釋放 Blob URL，不必等到 terminate。保守起見在「Worker 第一次回訊息
  // （此時腳本已載入並開始執行）或出錯」時釋放，而不是 new Worker 之後立刻釋放：依 HTML 規格
  // 立刻釋放應該也可以，但 iPad Safari 的實際行為未實測（UNKNOWN），所以選擇較晚、較保守的時間點。
  var revoked = false;
  function revokeOnce() {
    if (revoked) return;
    revoked = true;
    g.URL.revokeObjectURL(url);
  }
  w.onmessage = function (e) {
    revokeOnce();
    handlers.onMessage(e.data);
  };
  w.onerror = function (e) {
    revokeOnce();
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    handlers.onError(e);
  };
  return {
    postMessage: function (msg) { w.postMessage(msg); },
    terminate: function () {
      w.terminate();
      revokeOnce();
    }
  };
}

function createSolverClient(deps) {
  if (!deps || !deps.engine || !deps.params || !deps.params.solver || !deps.lblConfig) {
    throw new Error('solver-client：缺少 engine、params.solver 或 lblConfig');
  }
  if (typeof deps.setTimer !== 'function' || typeof deps.clearTimer !== 'function' || typeof deps.now !== 'function') {
    throw new Error('solver-client：缺少 setTimer、clearTimer 或 now');
  }
  var engine = deps.engine;
  var solverParams = deps.params.solver;
  var lblConfig = deps.lblConfig;
  var createWorker = deps.createWorker || defaultCreateWorker;
  var setTimer = deps.setTimer;
  var clearTimer = deps.clearTimer;
  var now = deps.now;
  var onStatus = typeof deps.onStatus === 'function' ? deps.onStatus : function () {};
  var twophase = (deps.solvers && deps.solvers.twophase) || defaultTwophase;
  var lbl = (deps.solvers && deps.solvers.lbl) || defaultLbl;
  var TOTAL_STEPS = twophase.PROGRESS_LABELS ? twophase.PROGRESS_LABELS.length : 6;

  // ---- 內部狀態（UI 狀態，不進 engine state；X-3） ----
  var started = false;
  var mode = 'booting';
  var step = 0;
  var initMs = null;       // 建表耗時（Worker 或主執行緒；僅供顯示與實機量測）
  var initStartAt = null;
  var worker = null;       // 目前的 Worker 包裝；null 代表沒有
  var initId = null;
  var initTimer = null;
  var nextId = 0;
  var inFlight = null;     // {id, job, timer}：Worker 內唯一的求解請求
  var queue = [];          // 等待送出的 job
  var current = null;      // 呼叫端正在等待的 job（cancel 的對象）
  var cache = new Map();   // home 字串 → 剩下的 home 記號序列
  var mainTimer = null;    // 主執行緒模式下已排程的 job 計時器；null 代表沒有

  function statusObj() {
    return {
      state: mode,
      step: step,
      total: TOTAL_STEPS,
      initMs: initMs,
      // 主執行緒模式且尚未建表：第一次求解前 UI 要先顯示 texts.solver.mainThreadNotice
      notice: mode === 'mainThread' && !twophase.isReady()
    };
  }

  function setMode(m, s) {
    mode = m;
    if (s !== undefined) step = s;
    onStatus(statusObj());
  }

  // ---- 計畫快取（§7.5） ----
  function keyOf(stickers) {
    return stickers.join('');
  }

  function cachePut(key, value) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > solverParams.planCacheSize) {
      cache.delete(cache.keys().next().value);
    }
  }

  function storePlan(home, homeMoves) {
    var cur = home.slice();
    for (var i = 0; i < homeMoves.length; i++) {
      cachePut(keyOf(cur), homeMoves.slice(i));
      cur = engine.applyMove(cur, homeMoves[i]);
    }
  }

  function planQtmOf(homeMoves) {
    var sum = 0;
    for (var i = 0; i < homeMoves.length; i++) sum += engine.qtmCost(homeMoves[i]);
    return sum;
  }

  // ---- action 產生 ----
  function failAction(job, code) {
    return {
      type: job.req === 'hint' ? 'HINT_FAILED' : 'DEMO_FAILED',
      payload: { version: job.version, code: code }
    };
  }

  function actionFromPlan(job, plan) {
    if (job.req === 'hint') {
      return {
        type: 'HINT_READY',
        payload: {
          version: job.version,
          tokens: [engine.toView(job.orient, plan[0])],
          source: 'suggest',
          planQtm: planQtmOf(plan)
        }
      };
    }
    return {
      type: 'DEMO_READY',
      payload: {
        version: job.version,
        tokens: plan.map(function (m) { return engine.toView(job.orient, m); }),
        segments: null
      }
    };
  }

  // 層先法結果 → action（提示：取第一個轉動及其前面的整顆旋轉；§9.6）
  function actionFromLbl(job, r) {
    if (job.req === 'hint') {
      var tokens = [];
      for (var i = 0; i < r.tokens.length; i++) {
        tokens.push(r.tokens[i]);
        if (engine.kind(r.tokens[i]) !== 'rotation') {
          return {
            type: 'HINT_READY',
            payload: { version: job.version, tokens: tokens, source: 'lbl', planQtm: null }
          };
        }
      }
      return failAction(job, 'INTERNAL');
    }
    return {
      type: 'DEMO_READY',
      payload: { version: job.version, tokens: r.tokens.slice(), segments: r.segments }
    };
  }

  function finish(job, action) {
    if (job.done) return;
    job.done = true;
    if (job.mainWatch !== null && job.mainWatch !== undefined) {
      clearTimer(job.mainWatch);
      job.mainWatch = null;
    }
    if (current === job) current = null;
    job.resolve(action);
  }

  // ---- 主執行緒上的計算 ----
  // S13／m-3：一律回傳 action、不丟例外（例外視同 Worker 端的 INTERNAL）。
  function lblOnMain(job) {
    try {
      var parsed = twophase.fromStickerColors(job.stickers);
      if (!parsed.ok) return failAction(job, 'INVALID_STATE');
      var r = lbl.generateLbl(job.stickers.slice(), lblConfig);
      if (r.error) return failAction(job, r.error);
      return actionFromLbl(job, r);
    } catch (e) {
      return failAction(job, 'INTERNAL');
    }
  }

  // 建議解不可用時的退回（§9.6）：提示與層先法示範改在主執行緒跑層先法；建議解示範回報不可用
  function fallback(job, code) {
    if (job.done) return;
    if (job.req === 'suggest') {
      finish(job, failAction(job, code));
      return;
    }
    finish(job, lblOnMain(job));
  }

  function solveOnMain(job) {
    var parsed = twophase.fromStickerColors(job.stickers);
    if (!parsed.ok) {
      finish(job, failAction(job, 'INVALID_STATE'));
      return;
    }
    if (!twophase.isReady()) {
      var t0 = now();
      try {
        twophase.init(null, function (k) { step = k; onStatus(statusObj()); });
      } catch (e) {
        setMode('failed');
        fallback(job, 'SOLVER_FAILED');
        drainQueue();
        return;
      }
      initMs = now() - t0;
      onStatus(statusObj());
    }
    var r = twophase.solve(parsed.cube, solverParams);
    if (r.error) {
      if (r.error === 'NODE_LIMIT') fallback(job, 'NODE_LIMIT');
      else finish(job, failAction(job, 'INTERNAL'));
      return;
    }
    acceptSolve(job, r.names);
  }

  // S13／m-3：任何例外都以 INTERNAL 結束這個 job（與 Worker 路徑 onWorkerMessage 的 try/catch 一致）。
  function runOnMain(job) {
    try {
      if (job.req === 'lbl') {
        finish(job, lblOnMain(job));
      } else {
        solveOnMain(job);
      }
    } catch (e) {
      finish(job, failAction(job, 'INTERNAL'));
    }
  }

  // S13／m-3：主執行緒 job 的 watchdog（對應 Worker 路徑的 onSolveTimeout）。
  function armMainWatch(job) {
    if (job.done || (job.mainWatch !== null && job.mainWatch !== undefined)) return;
    job.mainWatch = setTimer(function () {
      job.mainWatch = null;
      if (job.done) return;
      var qi = queue.indexOf(job);
      if (qi >= 0) queue.splice(qi, 1);
      fallback(job, 'TIMEOUT');
    }, solverParams.solveTimeoutMs);
  }

  // 主執行緒模式：一次排程一個 job，讓 UI 先有機會畫出等待卡片與提示文案
  function pumpMain() {
    if (mainTimer !== null) return;
    while (queue.length > 0 && queue[0].done) queue.shift();
    if (queue.length === 0) return;
    mainTimer = setTimer(function () {
      mainTimer = null;
      try {
        var job = queue.shift();
        if (job && !job.done) runOnMain(job);
      } finally {
        pumpMain(); // S13／m-3：即使本輪出錯，也繼續處理後面的 job
      }
    }, 0);
    // 先登記排程、再登記 watchdog（真實計時器依時間排序，順序不影響；只是讓登記順序與預期執行順序一致）
    for (var i = 0; i < queue.length; i++) armMainWatch(queue[i]);
  }

  function acceptSolve(job, viewMoves) {
    if (!Array.isArray(viewMoves)) throw new Error('solver-client：moves 不是陣列');
    var homeMoves = viewMoves.map(function (m) { return engine.toHome(job.orient, m); });
    storePlan(job.home, homeMoves);
    if (job.done) return; // 已取消：結果只進快取，不交給呼叫端
    if (homeMoves.length === 0) {
      finish(job, failAction(job, 'ALREADY_SOLVED'));
      return;
    }
    finish(job, actionFromPlan(job, homeMoves));
  }

  // ---- Worker ----
  function killWorker() {
    if (initTimer !== null) {
      clearTimer(initTimer);
      initTimer = null;
    }
    if (inFlight && inFlight.timer !== null) clearTimer(inFlight.timer);
    var w = worker;
    worker = null;
    initId = null;
    if (w) {
      try {
        w.terminate();
      } catch (e) {
        // 終止失敗不影響後續流程
      }
    }
  }

  function boot() {
    var w = null;
    var handlers = {
      onMessage: function (data) { if (w !== null && w === worker) onWorkerMessage(data); },
      onError: function (err) { if (w !== null && w === worker) onWorkerError(err); }
    };
    try {
      w = createWorker(handlers);
      if (!w || typeof w.postMessage !== 'function') throw new Error('solver-client：createWorker 回傳值無效');
    } catch (e) {
      w = null;
      toMainThread();
      return;
    }
    worker = w;
    initId = ++nextId;
    step = 0;
    setMode('booting', 0);
    initStartAt = now();
    initTimer = setTimer(onInitTimeout, solverParams.initTimeoutMs);
    try {
      w.postMessage({ type: 'init', id: initId, params: solverParams });
    } catch (e) {
      toMainThread();
    }
  }

  function toMainThread() {
    var orphan = inFlight;
    killWorker();
    inFlight = null;
    setMode('mainThread');
    if (orphan && !orphan.job.done) queue.unshift(orphan.job);
    pumpMain();
  }

  function toFailed() {
    killWorker();
    inFlight = null;
    setMode('failed');
    drainQueue();
  }

  function onInitTimeout() {
    initTimer = null;
    toFailed();
  }

  function onWorkerError() {
    toMainThread();
  }

  // 依目前模式處理佇列
  function drainQueue() {
    if (mode === 'ready') {
      pumpWorker();
    } else if (mode === 'mainThread') {
      pumpMain();
    } else if (mode === 'failed') {
      var jobs = queue;
      queue = [];
      for (var i = 0; i < jobs.length; i++) {
        if (jobs[i].done) continue;
        if (jobs[i].req === 'lbl') finish(jobs[i], lblOnMain(jobs[i]));
        else fallback(jobs[i], 'SOLVER_FAILED');
      }
    }
    // booting／building：等 ready 或 failed
  }

  function pumpWorker() {
    if (mode !== 'ready' || inFlight !== null || worker === null) return;
    while (queue.length > 0 && queue[0].done) queue.shift();
    if (queue.length === 0) return;
    var job = queue.shift();
    var id = ++nextId;
    var msg = job.req === 'lbl'
      ? { type: 'lbl', id: id, stickers: job.stickers, config: lblConfig }
      : { type: 'solve', id: id, stickers: job.stickers, opts: solverParams };
    inFlight = { id: id, job: job, timer: setTimer(onSolveTimeout, solverParams.solveTimeoutMs) };
    try {
      worker.postMessage(msg);
    } catch (e) {
      toMainThread();
    }
  }

  function onSolveTimeout() {
    var job = inFlight ? inFlight.job : null;
    if (inFlight) inFlight.timer = null;
    inFlight = null;
    // 終止並在背景重建 Worker（§9.6）；本次請求退回
    killWorker();
    if (job) fallback(job, 'TIMEOUT');
    boot();
  }

  function onWorkerMessage(data) {
    if (!data || typeof data !== 'object') return;
    if (initId !== null && data.id === initId) {
      if (data.type === 'progress') {
        setMode('building', data.step);
      } else if (data.type === 'ready') {
        clearTimer(initTimer);
        initTimer = null;
        initId = null;
        initMs = now() - initStartAt;
        setMode('ready', TOTAL_STEPS);
        drainQueue();
      } else if (data.type === 'error') {
        toFailed();
      }
      return;
    }
    if (inFlight === null || data.id !== inFlight.id) return; // 過期的回覆
    var job = inFlight.job;
    if (inFlight.timer !== null) clearTimer(inFlight.timer);
    inFlight = null;
    try {
      handleReply(job, data);
    } catch (e) {
      finish(job, failAction(job, 'INTERNAL')); // 回覆格式不符，不讓呼叫端永遠等待
    }
    pumpWorker();
  }

  function handleReply(job, data) {
    if (data.type === 'result' && data.kind === 'solve' && job.req !== 'lbl') {
      acceptSolve(job, data.moves);
      return;
    }
    if (data.type === 'result' && data.kind === 'lbl' && job.req === 'lbl') {
      if (!job.done) finish(job, actionFromLbl(job, data));
      return;
    }
    if (job.done) return;
    if (data.type !== 'error') {
      finish(job, failAction(job, 'INTERNAL'));
      return;
    }
    if (data.code === 'NODE_LIMIT') {
      fallback(job, 'NODE_LIMIT');
    } else if (data.code === 'NOT_READY' && !job.retried) {
      // 程式錯誤（§9.5）：重建 Worker 後重送一次
      job.retried = true;
      queue.unshift(job);
      killWorker();
      boot();
    } else if (typeof data.code === 'string' && Object.prototype.hasOwnProperty.call(FAILURE_TEXT_KEYS, data.code)) {
      finish(job, failAction(job, data.code));
    } else {
      finish(job, failAction(job, 'INVALID_STATE')); // D-5
    }
  }

  // ---- 對外介面 ----
  function start() {
    if (started) return;
    started = true;
    boot();
  }

  // S13／m-3：submit 在任何情況都回傳 Promise、不同步丟例外；否則呼叫端（hint-view／demo-player）
  // 收不到結果，state 會停在等待中，而 current 尚未設定，「取消」也無從作用。
  // 例外發生在本次 job 建立之後：結束這個 job（INTERNAL；已結束則維持原結果）並回傳它的 Promise；
  // 發生在 job 建立之前：回傳 INTERNAL 的失敗 action。
  function submit(state, req) {
    var ref = { job: null };
    try {
      return submitInner(state, req, ref);
    } catch (e) {
      var job = ref.job;
      if (job === null) {
        return Promise.resolve(failAction({ req: req, version: state ? state.version : null }, 'INTERNAL'));
      }
      var qi = queue.indexOf(job);
      if (qi >= 0) queue.splice(qi, 1);
      if (job.promise === null) return Promise.resolve(failAction(job, 'INTERNAL'));
      finish(job, failAction(job, 'INTERNAL'));
      return job.promise;
    }
  }

  function submitInner(state, req, ref) {
    if (current !== null) cancel();
    var input = engine.solverInput(state);
    var job = {
      req: req,
      stickers: input.stickers,
      version: input.version,
      orient: input.orient,
      home: state.home.slice(),
      done: false,
      retried: false,
      resolve: null,
      promise: null,
      mainWatch: null
    };
    ref.job = job;
    // D-2：已復原不送請求
    if (engine.isSolvedNow(state)) return Promise.resolve(failAction(job, 'ALREADY_SOLVED'));
    if (req !== 'lbl') {
      var plan = cache.get(keyOf(job.home));
      if (plan && plan.length > 0) return Promise.resolve(actionFromPlan(job, plan));
      if (mode === 'failed') {
        if (req === 'suggest') return Promise.resolve(failAction(job, 'SOLVER_FAILED'));
        return Promise.resolve(lblOnMain(job));
      }
    } else if (mode === 'failed') {
      return Promise.resolve(lblOnMain(job));
    }
    var p = new Promise(function (resolve) { job.resolve = resolve; });
    job.promise = p;
    current = job;
    queue.push(job);
    if (!started) start();
    else drainQueue();
    return p;
  }

  /**
   * 請求下一步提示。
   * @param {object} state - engine state（通常是剛送出 HINT_REQUEST 之後的 state）
   * @returns {Promise<object>} HINT_READY 或 HINT_FAILED action
   */
  function requestHint(state) {
    return submit(state, 'hint');
  }

  /**
   * 請求示範。
   * @param {object} state - engine state（通常是剛送出 DEMO_REQUEST 之後的 state）
   * @param {'suggest'|'lbl'} kind
   * @returns {Promise<object>} DEMO_READY 或 DEMO_FAILED action
   */
  function requestDemo(state, kind) {
    if (kind !== 'suggest' && kind !== 'lbl') {
      return Promise.resolve({ type: 'DEMO_FAILED', payload: { version: state.version, code: 'BAD_REQUEST' } });
    }
    return submit(state, kind);
  }

  /**
   * 取消目前等待中的請求：該請求的 Promise 立即以 code 'CANCELLED' 的 FAILED action 結束（UI 照常 dispatch），
   * 之後 Worker 遲到的結果不再交給呼叫端（建議解仍會存進快取）。
   * @returns {object|null} 產生的 FAILED action；沒有等待中的請求時為 null
   */
  function cancel() {
    var job = current;
    if (job === null || job.done) return null;
    var action = failAction(job, 'CANCELLED');
    var qi = queue.indexOf(job);
    if (qi >= 0) queue.splice(qi, 1);
    finish(job, action);
    return action;
  }

  function status() {
    return statusObj();
  }

  /** 終止 Worker、清除所有計時器（測試與頁面卸載用）。 */
  function dispose() {
    cancel();
    killWorker();
    if (mainTimer !== null) {
      clearTimer(mainTimer);
      mainTimer = null;
    }
    inFlight = null;
    queue.forEach(function (job) {
      if (job.mainWatch !== null && job.mainWatch !== undefined) {
        clearTimer(job.mainWatch);
        job.mainWatch = null;
      }
    });
    queue = [];
  }

  return {
    start: start,
    status: status,
    requestHint: requestHint,
    requestDemo: requestDemo,
    cancel: cancel,
    dispose: dispose,
    failureTextKey: failureTextKey,
    cacheSize: function () { return cache.size; }
  };
}

module.exports = {
  createSolverClient: createSolverClient,
  defaultCreateWorker: defaultCreateWorker,
  failureTextKey: failureTextKey,
  STATES: STATES
};
