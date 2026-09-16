# 審查包：T-001 魔術方塊 v0.1（第 3／4 批：UI 骨架（主程式、記號鍵、手勢、CSS 3D 方塊、求解器用戶端））

> 本檔可單獨貼給外部 AI。四批合計為本次變更的全部程式碼。

## 0. 審查提示詞（貼給外部 AI 時從這裡開始）

請你擔任獨立程式審查員，審查下面這份單頁網頁遊戲的程式碼變更。你和寫程式的人不是同一個人，也看不到他們的脈絡；看不懂的地方就是問題。

請遵守以下規則：

1. **每個問題都要附四項**：嚴重度（Blocker／Major／Minor）、位置（檔案:行號，依附上的行號）、失敗情境（什麼輸入或操作會出什麼錯）、建議修法（方向或小片段即可）。
2. **嚴重度定義**：Blocker＝無法進行遊戲、state 損毀、同 seed 結果不一致、違反下方任一條架構原則；Major＝功能可用但規則或判定明顯錯誤；Minor＝可維護性、命名、文案。
3. **不確定是不是問題的，另列「疑似」清單**，不要混進 bug 清單。沒有重現步驟的發現只能列「疑似」。
4. **不要重寫整份程式，只給意見。** 不要輸出完整檔案的替換版本；修法建議以文字描述或十行以內的片段為限。
5. 請逐條對照第 1 節的架構原則檢查，違反的要指出是哪一條。
6. 已知問題（第 5 節）是我們已經知道、刻意暫不處理的，不必重複回報；若你認為它比我們描述的更嚴重，可以另外說明。
7. 請用第 6 節的表格格式回覆，繁體中文。

**本批是第 3／4 批，其他批次的檔案不在這裡，若問題牽涉其他批次，請在「疑似」清單註明。**

---

## 1. 專案背景（從 CLAUDE.md 第 1、3 節摘要）

- 類型：經典三階魔術方塊（3x3x3）單頁網頁遊戲；定位是讓手邊沒有實體方塊的人可以玩，也可以看電腦怎麼解（學習用）
- 玩法：單人自由練習（打亂、轉動、撤銷／重做、重設、計時、步數）＋提示下一步＋看電腦解（建議解示範、層先法分段示範）；無連線、無帳號、無金流
- 計步：QTM（外層 90°＝1 步、180°＝2 步；中層 M/E/S 90°＝2 步、180°＝4 步；整顆旋轉與拖曳視角＝0 步）
- 3D：CSS 3D transforms；求解器自寫，於 Web Worker 執行（Worker 程式以 Blob 由同一檔案產生）；畫面稱「建議解」，不得稱「最佳解」
- 交付：單一 `index.html`（由 `build/` 打包 `src/`），零依賴、可離線；平台：iPad 橫向、手機直向，觸控優先；語言：繁體中文

架構原則（違反即 Blocker）：
1. 狀態只能透過 action 前進；engine 層是純函數，不讀時間、DOM、網路、計時器、全域變數。（本案另規定 `src/solver/` 同樣不得讀時鐘，以搜尋節點上限控制搜尋長度）
2. 所有隨機數來自 seeded RNG；不得使用 `Math.random()`；同 seed ＋ 同 action 序列必須可重放。
3. 參數資料驅動；數值、機率、內容放 `src/data/` JSON，程式碼裡寫死的平衡數字就是 bug。
4. 觸控優先；可點元素最小 44×44 px；不依賴 hover、右鍵、鍵盤。
5. 零依賴；不載入 CDN、不外連字型、不用第三方套件。

## 2. 本次任務摘要

- 目標：使用者在 iPad／手機上打開單一 `index.html`，可以打亂、用手勢或記號鍵轉方塊、撤銷／重做／重設、看計時與 QTM 步數；卡住時看下一步提示，或看電腦用建議解與層先法逐步示範；全程斷網可用。
- 驗收條件：自動測試全部通過（見第 4 節）；以下項目由人工在實機驗收（尚未進行）：iPad／手機實機顯示與建表時間、手勢手感、零基礎者能否跟著教學學會層先法。
- 本批檔案在整體中的角色：src/ui/ 是畫面層，只呈現 engine 的 state 並送出 action：app.js 建 store 與輸入佇列；cube-view.js 以 CSS 3D 畫方塊；controls.js 是記號鍵與操作列；gesture.js 是觸控手勢；notation.js 產生記號的白話說明；solver-client.js 管理 Worker、逾時、快取與退回。
- 四批的檔案分配：第 1 批 `src/engine/rng.js`、`src/engine/cube.js`、`src/engine/scramble.js`、`src/engine/selectors.js`、`src/engine/reducer.js`、`src/engine/index.js`、`src/data/texts.json`、`src/data/palette.json`、`src/data/params.json`、`src/data/lbl.json`；第 2 批 `src/solver/twophase.js`、`src/solver/lbl.js`、`src/solver/worker.js`；第 3 批 `src/ui/app.js`、`src/ui/controls.js`、`src/ui/gesture.js`、`src/ui/cube-view.js`、`src/ui/notation.js`、`src/ui/solver-client.js`、`src/ui/index.template.html`、`src/ui/styles.css`；第 4 批 `src/ui/demo-player.js`、`src/ui/hint-view.js`、`src/ui/tutorial.js`、`src/ui/records.js`、`src/ui/demo.css`、`src/ui/overlay.css`、`build/bundle.js`。

## 3. 變更檔案的完整程式碼（有行號，全部為新增檔案）

本批包含：`src/ui/app.js`、`src/ui/controls.js`、`src/ui/gesture.js`、`src/ui/cube-view.js`、`src/ui/notation.js`、`src/ui/solver-client.js`、`src/ui/index.template.html`、`src/ui/styles.css`。

### 3.1 `src/ui/app.js`（新增，414 行）

```js
  1  // src/ui/app.js — UI 進入點：建立 store、solver-client、ctx，依序掛載各模組
  2  //
  3  // 依據：game-spec.md §9（示範播放器與互動 UI 契約）、§5（seed 產生）、§6.2（PAUSE）、
  4  //       §12.5 測試掛鉤；分派單 T-001 S8a 輸出契約、X-8（ctx 介面先行）。
  5  //
  6  // ctx 介面完整說明見 docs/reports/T-001-S8a.md「介面契約」一節；S8b～S8d 只透過
  7  // mount(ctx) 接入，不得修改本檔與 index.template.html（X-8）。
  8  'use strict';
  9  
 10  var engine = require('../engine/index.js');
 11  var notation = require('./notation.js');
 12  var cubeView = require('./cube-view.js');
 13  var controls = require('./controls.js');
 14  var gesture = require('./gesture.js');
 15  var hintView = require('./hint-view.js');
 16  var demoPlayer = require('./demo-player.js');
 17  var records = require('./records.js');
 18  var tutorial = require('./tutorial.js');
 19  var solverClientModule = require('./solver-client.js');
 20  
 21  function nowMs() {
 22    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
 23    return Date.now();
 24  }
 25  
 26  function isRejectError(e) {
 27    return !!e && typeof e.message === 'string' && e.message.indexOf('REJECT:') === 0;
 28  }
 29  
 30  // D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
 31  function numOr(v, dflt) {
 32    return (typeof v === 'number' && isFinite(v)) ? v : dflt;
 33  }
 34  
 35  // 測試掛鉤用：把 patch 的欄位深層合併進 base（回傳新物件，不改 base）。
 36  function deepMerge(base, patch) {
 37    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
 38    var out = Object.assign({}, base);
 39    Object.keys(patch).forEach(function (k) {
 40      var b = base ? base[k] : undefined;
 41      out[k] = (b && typeof b === 'object' && !Array.isArray(b)) ? deepMerge(b, patch[k]) : patch[k];
 42    });
 43    return out;
 44  }
 45  
 46  /**
 47   * D-26：輸入佇列（記號鍵、手勢轉層、撤銷／重做、示範上一步／下一步／分段跳轉共用）。
 48   *
 49   * 動畫中的點擊不再丟棄，而是排隊依序執行（修 K-1）；取出時重新檢查 canApply；
 50   * clear() 以世代計數器讓「已經在播動畫、還沒送出」的那一步作廢（修 m-2：NEW_GAME／RESET／上鎖時）。
 51   *
 52   * task 介面：
 53   *   build()        → action 或 null（取出時呼叫一次；動畫結束後再呼叫一次取得新的 at）
 54   *   animate(action) → Promise（純畫面；不送 action）
 55   *   after(done)    （可省略）送出（done=true）或作廢（done=false）後呼叫
 56   *
 57   * deps：{ max, pollMs, setTimer(fn, ms), canApply(action), dispatch(action), isLocked(), isBlocked() }
 58   *   max       最多排隊幾個（不含正在播放的那一個）；超過的輸入丟棄
 59   *   isBlocked 其他來源的動畫或 hold() 進行中時回傳 true，佇列等待（每 pollMs 再試）
 60   */
 61  function createInputQueue(deps) {
 62    var items = [];
 63    var running = false;
 64    var generation = 0;
 65    var pollTimer = null;
 66    var holds = {};
 67  
 68    function held() { return Object.keys(holds).length > 0; }
 69  
 70    function clear() {
 71      generation++;
 72      var dropped = items;
 73      items = [];
 74      dropped.forEach(function (t) { if (typeof t.after === 'function') t.after(false); });
 75    }
 76  
 77    function schedulePoll() {
 78      if (pollTimer !== null) return;
 79      pollTimer = deps.setTimer(function () {
 80        pollTimer = null;
 81        pump();
 82      }, deps.pollMs);
 83    }
 84  
 85    function pump() {
 86      while (!running && items.length > 0) {
 87        if (deps.isLocked()) { clear(); return; }
 88        if (held() || deps.isBlocked()) { schedulePoll(); return; }
 89        var task = items.shift();
 90        var action = task.build();
 91        if (!action || !deps.canApply(action)) {
 92          if (typeof task.after === 'function') task.after(false);
 93          continue;
 94        }
 95        start(task, action);
 96      }
 97    }
 98  
 99    function start(task, action) {
100      running = true;
101      var gen = generation;
102      var p;
103      try {
104        p = Promise.resolve(task.animate(action));
105      } catch (e) {
106        p = Promise.reject(e);
107      }
108      p.then(function () { finish(task, gen, true); }, function () { finish(task, gen, false); });
109    }
110  
111    function finish(task, gen, animOk) {
112      running = false;
113      var done = false;
114      try {
115        if (animOk && gen === generation && !deps.isLocked()) {
116          var fresh = task.build(); // 取得動畫結束當下的 at
117          if (fresh && deps.canApply(fresh)) {
118            deps.dispatch(fresh);
119            done = true;
120          }
121        }
122      } finally {
123        if (typeof task.after === 'function') {
124          try { task.after(done); } catch (e) { /* 單一 UI 錯誤不影響佇列 */ }
125        }
126        pump();
127      }
128    }
129  
130    return {
131      enqueue: function (task) {
132        if (deps.isLocked()) return false;
133        if (items.length >= deps.max) return false;
134        items.push(task);
135        pump();
136        return true;
137      },
138      clear: clear,
139      busy: function () { return running || items.length > 0; },
140      size: function () { return items.length; },
141      hold: function (owner) { holds[owner] = true; },
142      release: function (owner) {
143        delete holds[owner];
144        pump();
145      }
146    };
147  }
148  
149  // 送出這些 action 時清空輸入佇列（D-26：NEW_GAME／RESET；另加示範與提示的開始／結束，
150  // 避免排隊中的轉動或示範單步套用到已經換掉的局面）。
151  var QUEUE_CLEAR_TYPES = { NEW_GAME: true, RESET: true, DEMO_REQUEST: true, DEMO_EXIT: true, HINT_REQUEST: true };
152  
153  /**
154   * 建立整個 UI（DOM、solver-client 就緒後才呼叫；供 boot() 使用，
155   * 也讓測試環境可以直接呼叫並注入假的 window／document）。
156   */
157  function createApp(win, doc) {
158    var GAME_DATA = win.GAME_DATA || { texts: {}, palette: {}, params: {}, lbl: {} };
159    var qs = new (win.URLSearchParams || URLSearchParams)(win.location.search);
160    var testMode = qs.get('test') === '1';
161  
162    var data = GAME_DATA;
163    if (testMode && qs.get('tutorial') === '0') {
164      data = Object.assign({}, GAME_DATA, {
165        params: Object.assign({}, GAME_DATA.params, {
166          tutorial: Object.assign({}, GAME_DATA.params.tutorial, { enabled: false })
167        })
168      });
169    }
170    // S11 測試掛鉤（只在 ?test=1 時生效）：paramsPatch=<JSON> 深層合併進 params，
171    // 例如 {"solver":{"firstNodeLimit":1000}} 讓建議解回 NODE_LIMIT、{"ui":{"turnAnimMs":0}} 關閉轉動動畫。
172    if (testMode && qs.get('paramsPatch')) {
173      var patch = null;
174      try { patch = JSON.parse(qs.get('paramsPatch')); } catch (e) { patch = null; }
175      if (patch && typeof patch === 'object') {
176        data = Object.assign({}, data, { params: deepMerge(data.params, patch) });
177      }
178    }
179    var params = data.params || {};
180  
181    var state = engine.initialState();
182    var listeners = [];
183  
184    function getState() { return state; }
185  
186    // n-4：被 REJECT 的 action 留在可關閉的除錯記錄（環狀緩衝），預設不輸出到 console。
187    var debugParams = params.debug || {};
188    var rejectLogSize = numOr(debugParams.rejectLogSize, 50);
189    var logRejectToConsole = debugParams.logRejectToConsole === true || (testMode && qs.get('debug') === '1');
190    var rejectLog = [];
191    function recordReject(action, e) {
192      if (rejectLogSize <= 0) return;
193      rejectLog.push({ type: action && action.type, reason: e.message });
194      while (rejectLog.length > rejectLogSize) rejectLog.shift();
195      if (logRejectToConsole && typeof console !== 'undefined' && typeof console.debug === 'function') {
196        console.debug('[cube3x3] ' + e.message);
197      }
198    }
199  
200    var queue = null; // 下方建立（需要 dispatch 與 ctx.anim）
201  
202    function dispatch(action) {
203      if (queue && action && QUEUE_CLEAR_TYPES[action.type]) queue.clear();
204      var next;
205      try {
206        next = engine.reduce(state, action, data);
207      } catch (e) {
208        if (isRejectError(e)) { recordReject(action, e); return; } // REJECT 只記錄不崩潰（分派單 S8a 輸出契約）
209        throw e;
210      }
211      state = next;
212      for (var i = 0; i < listeners.length; i++) listeners[i](state);
213    }
214  
215    function subscribe(fn) {
216      listeners.push(fn);
217      return function unsubscribe() {
218        var idx = listeners.indexOf(fn);
219        if (idx >= 0) listeners.splice(idx, 1);
220      };
221    }
222  
223    var root = doc.getElementById('app');
224  
225    function slot(name) {
226      return root.querySelector('[data-slot="' + name + '"]');
227    }
228  
229    // ---- ctx.panel：學習面板分頁與抽屜（UI 狀態，不進 engine state；X-3） ----
230    var panelState = {
231      tab: 'controls',
232      expanded: !!(data.params.layout && data.params.layout.drawerExpandedDefault)
233    };
234    var panelListeners = [];
235    var panel = {
236      selectTab: function (tab) {
237        if (tab !== 'controls' && tab !== 'demo') return;
238        if (panelState.tab === tab) return;
239        panelState.tab = tab;
240        panelListeners.forEach(function (fn) { fn(); });
241      },
242      currentTab: function () { return panelState.tab; },
243      expand: function (on) {
244        var next = !!on;
245        if (panelState.expanded === next) return;
246        panelState.expanded = next;
247        panelListeners.forEach(function (fn) { fn(); });
248      },
249      expanded: function () { return panelState.expanded; },
250      onChange: function (fn) { panelListeners.push(fn); }
251    };
252  
253    // ---- ctx.input：跨模組的輸入鎖（D-12；記號小教室、示範自動播放、手勢都要檢查）＋輸入佇列（D-26） ----
254    var locks = {};
255    function isLocked() { return Object.keys(locks).length > 0; }
256    var inputParams = params.input || {};
257    queue = createInputQueue({
258      max: numOr(inputParams.queueMax, 3),
259      pollMs: numOr(inputParams.queuePollMs, 16),
260      setTimer: function (fn, ms) { return win.setTimeout(fn, ms); },
261      canApply: function (action) { return engine.canApply(state, action, data); },
262      dispatch: function (action) { dispatch(action); },
263      isLocked: isLocked,
264      isBlocked: function () { return !!(ctx.anim && ctx.anim.busy()); }
265    });
266    var input = {
267      lock: function (owner) {
268        locks[owner] = true;
269        queue.clear(); // D-26：上鎖時清空佇列（含正在播動畫、尚未送出的那一步）
270      },
271      unlock: function (owner) {
272        delete locks[owner];
273      },
274      locked: isLocked,
275      // D-26：排入一個輸入（task 介面見 createInputQueue）；上鎖或佇列已滿時回傳 false（該輸入丟棄）
276      enqueue: function (task) { return queue.enqueue(task); },
277      clearQueue: function () { queue.clear(); },
278      // 沒有排隊中的輸入、也沒有任何動畫在播（手勢開始、提示、示範自動播放用）
279      idle: function () { return !queue.busy() && !(ctx.anim && ctx.anim.busy()); },
280      // 暫停佇列處理但不清空（拖曳轉視角期間用；放開、吸附完成後 release）
281      hold: function (owner) { queue.hold(owner); },
282      release: function (owner) { queue.release(owner); }
283    };
284  
285    var ctx = {
286      root: root,
287      data: data,
288      engine: engine,
289      notation: notation,
290      getState: getState,
291      dispatch: dispatch,
292      subscribe: subscribe,
293      panel: panel,
294      input: input,
295      slot: slot
296    };
297  
298    // ---- ctx.solver：包裝 solver-client（S6），S8c 只呼叫這幾個方法（X-9） ----
299    var solverListeners = [];
300    var solverStatus = { state: 'booting', step: 0, total: 6, initMs: null, notice: false };
301    var client = solverClientModule.createSolverClient({
302      engine: engine,
303      params: data.params,
304      lblConfig: data.lbl,
305      setTimer: function (fn, ms) { return win.setTimeout(fn, ms); },
306      clearTimer: function (h) { win.clearTimeout(h); },
307      now: function () { return Date.now(); },
308      onStatus: function (s) {
309        solverStatus = s;
310        solverListeners.forEach(function (fn) { fn(s); });
311      }
312    });
313    ctx.solver = {
314      start: client.start,
315      status: function () { return solverStatus; },
316      requestHint: client.requestHint,
317      requestDemo: client.requestDemo,
318      cancel: client.cancel,
319      onStatus: function (fn) { solverListeners.push(fn); },
320      // D-19：補上 solver-client.js 既有的失敗碼→文案鍵對照（純函式，不含快取／退回邏輯），
321      // 讓 S8c 的 hint-view.js 不必再自己複製一份同款對照表（見 docs/reports/T-001-S8c.md
322      // 「需要其他角色配合的事」）。
323      failureTextKey: client.failureTextKey
324    };
325  
326    // ---- ctx.view／ctx.anim：cube-view.js 建立（必須先掛，其餘模組的 mount 才可能用到） ----
327    cubeView.mount(ctx);
328  
329    // ---- §5：NEW_GAME 的 seed 只在 UI 層產生 ----
330    function randomSeed() {
331      try {
332        if (win.crypto && typeof win.crypto.getRandomValues === 'function') {
333          return win.crypto.getRandomValues(new Uint32Array(1))[0];
334        }
335      } catch (e) {
336        // 忽略，改用 Date.now 備援
337      }
338      return Date.now() >>> 0;
339    }
340  
341    // §11.4：打亂動畫（純視覺，逐一播放；播放中鎖住輸入）。state.home 在 NEW_GAME 當下
342    // 就已經是打亂後的結果，這裡只是用 previewTurn 把過程「重播」給玩家看，不改變任何 state。
343    function playScrambleAnim(scramble) {
344      if (!scramble.length || !ctx.view || typeof ctx.view.previewTurn !== 'function') return;
345      var ms = numOr(params.ui && params.ui.scrambleAnimMsPerMove, 60);
346      if (ms <= 0) return; // D-25：設為 0 表示關閉打亂動畫
347      input.lock('scramble-anim');
348      var cur = engine.SOLVED.slice();
349      var i = 0;
350      function step() {
351        if (i >= scramble.length) {
352          ctx.view.clearPreview();
353          input.unlock('scramble-anim');
354          return;
355        }
356        var mv = scramble[i++];
357        ctx.view.previewTurn(cur, mv, ms).then(function () {
358          cur = engine.applyMove(cur, mv);
359          step();
360        }, function () {
361          ctx.view.clearPreview();
362          input.unlock('scramble-anim');
363        });
364      }
365      step();
366    }
367  
368    ctx.newGame = function () {
369      dispatch({ type: 'NEW_GAME', payload: { seed: randomSeed(), at: nowMs() } });
370      playScrambleAnim(getState().scramble);
371    };
372  
373    // ---- 依序掛載各模組（S8b～S8d 目前為 S7 空殼；X-8：只能透過 ctx 與插槽） ----
374    [controls, gesture, hintView, demoPlayer, records, tutorial].forEach(function (mod) {
375      if (mod && typeof mod.mount === 'function') mod.mount(ctx);
376    });
377  
378    ctx.solver.start();
379  
380    doc.addEventListener('visibilitychange', function () {
381      if (doc.visibilityState === 'hidden') {
382        dispatch({ type: 'PAUSE', payload: { at: nowMs(), reason: 'hidden' } });
383      }
384    });
385  
386    if (testMode) {
387      win.__cubeTest = {
388        getState: function () { return JSON.parse(JSON.stringify(state)); },
389        dispatch: dispatch,
390        // S11：除錯記錄與佇列狀態（只在 ?test=1 時提供）
391        rejects: function () { return rejectLog.slice(); },
392        queueSize: function () { return queue.size(); },
393        inputIdle: function () { return input.idle(); },
394        inputLocked: function () { return input.locked(); }
395      };
396    }
397  
398    return ctx;
399  }
400  
401  function boot() {
402    if (typeof window === 'undefined' || typeof document === 'undefined') return;
403    createApp(window, document);
404  }
405  
406  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
407    if (document.readyState === 'loading') {
408      document.addEventListener('DOMContentLoaded', boot);
409    } else {
410      boot();
411    }
412  }
413  
414  module.exports = { boot: boot, createApp: createApp, createInputQueue: createInputQueue, numOr: numOr };
```

### 3.2 `src/ui/controls.js`（新增，337 行）

```js
  1  // src/ui/controls.js — 操作列、記號鍵盤、面標籤開關、學習面板分頁與抽屜手把
  2  // 依據：game-spec.md §9.2、§11.1、§11.2；分派單 T-001 S8a。
  3  //
  4  // 本檔只送 action／呼叫 ctx.view、ctx.anim、ctx.panel；不自行計算任何規則。
  5  'use strict';
  6  
  7  function nowMs() {
  8    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  9    return Date.now();
 10  }
 11  
 12  // D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值（各檔各自一份，沿用 S8a 慣例）。
 13  function numOr(v, dflt) {
 14    return (typeof v === 'number' && isFinite(v)) ? v : dflt;
 15  }
 16  
 17  function formatTime(ms) {
 18    var totalDeci = Math.floor(Math.max(0, ms) / 100);
 19    var m = Math.floor(totalDeci / 600);
 20    var s = Math.floor((totalDeci % 600) / 10);
 21    var d = totalDeci % 10;
 22    return m + ':' + (s < 10 ? '0' + s : String(s)) + '.' + d;
 23  }
 24  
 25  var OUTER_BASES = ['U', 'R', 'F', 'D', 'L', 'B'];
 26  var ROTATION_BASES = ['x', 'y', 'z'];
 27  var SLICE_BASES = ['M', 'E', 'S'];
 28  var ROW_SUFFIXES = ['', "'", '2']; // 依 §11.2：cw 列、ccw 列、half 列
 29  
 30  function mount(ctx) {
 31    var doc = ctx.root.ownerDocument || document;
 32    var engine = ctx.engine;
 33    var notation = ctx.notation;
 34    var texts = ctx.data.texts;
 35    var params = ctx.data.params;
 36    var buttons = texts.buttons;
 37  
 38    // ---- 操作列 ----
 39    var btnScramble = ctx.root.querySelector('#btnScramble');
 40    var btnUndo = ctx.root.querySelector('#btnUndo');
 41    var btnRedo = ctx.root.querySelector('#btnRedo');
 42    var btnReset = ctx.root.querySelector('#btnReset');
 43    var btnDemoOpen = ctx.root.querySelector('#btnDemoOpen');
 44  
 45    btnUndo.textContent = buttons.undo;
 46    btnRedo.textContent = buttons.redo;
 47    btnReset.textContent = buttons.reset;
 48    btnDemoOpen.textContent = buttons.demoOpen;
 49  
 50    function dispatchIfAllowed(action) {
 51      if (!engine.canApply(ctx.getState(), action, ctx.data)) return false;
 52      ctx.dispatch(action);
 53      return true;
 54    }
 55  
 56    // D-26：撤銷／重做也走輸入佇列，確保「按 R 之後馬上按撤銷」依序執行（沒有動畫）。
 57    function enqueueInstant(type) {
 58      if (ctx.input.locked()) return;
 59      ctx.input.enqueue({
 60        build: function () { return { type: type, payload: { at: nowMs() } }; },
 61        animate: function () { return null; }
 62      });
 63    }
 64  
 65    btnScramble.addEventListener('click', function () {
 66      var state = ctx.getState();
 67      if (state.status === 'playing' && state.cursor > 0) {
 68        var confirmMsg = (texts.confirm && texts.confirm.newGameInProgress) || '';
 69        var ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
 70          ? window.confirm(confirmMsg)
 71          : true;
 72        if (!ok) return;
 73      }
 74      if (typeof ctx.newGame === 'function') ctx.newGame();
 75    });
 76  
 77    btnUndo.addEventListener('click', function () { enqueueInstant('UNDO'); });
 78    btnRedo.addEventListener('click', function () { enqueueInstant('REDO'); });
 79    btnReset.addEventListener('click', function () {
 80      // RESET 立即送出；app.js 在送出 RESET 時清空輸入佇列（D-26），作廢尚未送出的轉動。
 81      dispatchIfAllowed({ type: 'RESET', payload: { at: nowMs() } });
 82    });
 83    btnDemoOpen.addEventListener('click', function () {
 84      // X-16：本鈕只切分頁、展開抽屜，不送 action。
 85      ctx.panel.selectTab('demo');
 86      ctx.panel.expand(true);
 87    });
 88  
 89    // ---- 記號鍵盤（§11.2） ----
 90    var keypad = ctx.root.querySelector('#keypad');
 91  
 92    // D-26：動畫中的點擊不再丟棄，改排入輸入佇列（上限 params.input.queueMax），
 93    // 取出時重檢 canApply；NEW_GAME／RESET／上鎖時整個佇列作廢（修 K-1、m-2）。
 94    function pressMove(move) {
 95      if (ctx.input.locked()) return;
 96      var isRotation = engine.kind(move) === 'rotation';
 97      ctx.input.enqueue({
 98        build: function () {
 99          return isRotation
100            ? { type: 'ROTATE', payload: { move: move } }
101            : { type: 'TURN', payload: { move: move, at: nowMs() } };
102        },
103        animate: function () {
104          var ms = numOr(params.ui && params.ui.turnAnimMs, 180);
105          return isRotation ? ctx.anim.rotate(move, ms) : ctx.anim.turn(move, ms);
106        }
107      });
108    }
109  
110    // D-25：keypad.showSubLabels 為 false 時不顯示中文副標（aria-label 仍含副標，維持無障礙名稱）。
111    var showSubLabels = !(params.keypad && params.keypad.showSubLabels === false);
112  
113    function makeKeyButton(move) {
114      var btn = doc.createElement('button');
115      btn.type = 'button';
116      btn.className = 'kp';
117      btn.dataset.move = move;
118      var big = doc.createElement('span');
119      big.className = 'kp-move';
120      big.textContent = engine.formatMove(move);
121      var sub = doc.createElement('span');
122      sub.className = 'kp-sub';
123      sub.textContent = notation.keySubLabel(move, texts);
124      btn.appendChild(big);
125      if (showSubLabels) btn.appendChild(sub);
126      btn.setAttribute('aria-label', notation.keyAriaLabel(move, texts, engine));
127      btn.addEventListener('click', function () { pressMove(move); });
128      return btn;
129    }
130  
131    function buildRows(bases, extraClass) {
132      var rows = doc.createElement('div');
133      rows.className = 'kp-rows';
134      ROW_SUFFIXES.forEach(function (suffix) {
135        var row = doc.createElement('div');
136        row.className = 'kp-row';
137        bases.forEach(function (base) {
138          var btn = makeKeyButton(base + suffix);
139          if (extraClass) btn.classList.add(extraClass);
140          row.appendChild(btn);
141        });
142        rows.appendChild(row);
143      });
144      return rows;
145    }
146  
147    function buildGroup(opts) {
148      var group = doc.createElement('div');
149      group.className = 'kp-group';
150      var caption;
151      if (opts.collapsible) {
152        caption = doc.createElement('button');
153        caption.type = 'button';
154        caption.className = 'kp-caption kp-caption-toggle';
155        caption.setAttribute('aria-expanded', String(!opts.collapsedDefault));
156        var body = buildRows(opts.bases, opts.extraClass);
157        body.hidden = !!opts.collapsedDefault;
158        caption.textContent = opts.captionText;
159        caption.addEventListener('click', function () {
160          var expanded = caption.getAttribute('aria-expanded') === 'true';
161          caption.setAttribute('aria-expanded', String(!expanded));
162          body.hidden = expanded;
163        });
164        group.appendChild(caption);
165        group.appendChild(body);
166      } else {
167        caption = doc.createElement('div');
168        caption.className = 'kp-caption';
169        caption.textContent = opts.captionText;
170        group.appendChild(caption);
171        group.appendChild(buildRows(opts.bases, opts.extraClass));
172      }
173      return group;
174    }
175  
176    var keypadTexts = texts.keypad;
177    keypad.appendChild(buildGroup({
178      captionText: keypadTexts.outer,
179      bases: OUTER_BASES,
180      collapsible: false
181    }));
182    keypad.appendChild(buildGroup({
183      captionText: keypadTexts.rotation,
184      bases: ROTATION_BASES,
185      collapsible: true,
186      collapsedDefault: !!(params.keypad && params.keypad.rotationCollapsedDefault),
187      extraClass: 'kp-rot'
188    }));
189    var sliceCaptionWrap = doc.createElement('div');
190    sliceCaptionWrap.className = 'kp-group';
191    var sliceToggle = doc.createElement('button');
192    sliceToggle.type = 'button';
193    sliceToggle.className = 'kp-caption kp-caption-toggle';
194    sliceToggle.textContent = buttons.sliceFold;
195    var sliceCollapsedDefault = !(params.keypad && params.keypad.sliceCollapsedDefault === false);
196    sliceToggle.setAttribute('aria-expanded', String(!sliceCollapsedDefault));
197    var sliceBody = buildRows(SLICE_BASES, 'kp-mid');
198    sliceBody.hidden = sliceCollapsedDefault;
199    sliceToggle.addEventListener('click', function () {
200      var expanded = sliceToggle.getAttribute('aria-expanded') === 'true';
201      sliceToggle.setAttribute('aria-expanded', String(!expanded));
202      sliceBody.hidden = expanded;
203    });
204    sliceCaptionWrap.appendChild(sliceToggle);
205    sliceCaptionWrap.appendChild(sliceBody);
206    keypad.appendChild(sliceCaptionWrap);
207  
208    // ---- 面標籤開關（§11.2） ----
209    // D-19：aria-checked 改訂閱 ctx.view.onFaceLabelsChange，不論是玩家親手點擊，
210    // 或 tutorial.js 呼叫 ctx.view.setFaceLabels() 強制開關，開關外觀都會自動同步
211    // （取代原本只在 click handler 裡才同步的作法）。
212    var faceLabelToggle = ctx.root.querySelector('#faceLabelToggle');
213    faceLabelToggle.textContent = buttons.faceLabels;
214    function syncFaceLabelSwitch(on) {
215      faceLabelToggle.setAttribute('aria-checked', String(!!on));
216    }
217    syncFaceLabelSwitch(ctx.view.faceLabels());
218    ctx.view.onFaceLabelsChange(syncFaceLabelSwitch);
219    faceLabelToggle.addEventListener('click', function () {
220      ctx.view.setFaceLabels(!ctx.view.faceLabels());
221    });
222  
223    // ---- 分頁（操作／示範） ----
224    var tabControls = ctx.root.querySelector('#tabControls');
225    var tabDemo = ctx.root.querySelector('#tabDemo');
226    var panelControls = ctx.root.querySelector('#panelControls');
227    var panelDemo = ctx.root.querySelector('#panelDemo');
228    tabControls.textContent = texts.panel.tabControls;
229    tabDemo.textContent = texts.panel.tabDemo;
230  
231    function syncTabs() {
232      var tab = ctx.panel.currentTab();
233      tabControls.classList.toggle('on', tab === 'controls');
234      tabDemo.classList.toggle('on', tab === 'demo');
235      tabControls.setAttribute('aria-selected', String(tab === 'controls'));
236      tabDemo.setAttribute('aria-selected', String(tab === 'demo'));
237      panelControls.hidden = tab !== 'controls';
238      panelDemo.hidden = tab !== 'demo';
239    }
240    tabControls.addEventListener('click', function () { ctx.panel.selectTab('controls'); });
241    tabDemo.addEventListener('click', function () { ctx.panel.selectTab('demo'); });
242  
243    // ---- 抽屜手把（手機直向；§11.1） ----
244    var learnDrawer = ctx.root.querySelector('#learnDrawer');
245    var handleTap = ctx.root.querySelector('#handleTap');
246    var drawerLabel = ctx.root.querySelector('#drawerLabel');
247    drawerLabel.textContent = texts.panel.title;
248  
249    function syncDrawer() {
250      var expanded = ctx.panel.expanded();
251      learnDrawer.classList.toggle('expanded', expanded);
252      handleTap.setAttribute('aria-expanded', String(expanded));
253    }
254    handleTap.addEventListener('click', function () {
255      ctx.panel.expand(!ctx.panel.expanded());
256    });
257    handleTap.setAttribute('role', 'button');
258    handleTap.tabIndex = 0;
259    handleTap.addEventListener('keydown', function (e) {
260      if (e.key === 'Enter' || e.key === ' ') {
261        e.preventDefault();
262        ctx.panel.expand(!ctx.panel.expanded());
263      }
264    });
265  
266    ctx.panel.onChange(function () {
267      syncTabs();
268      syncDrawer();
269    });
270    syncTabs();
271    syncDrawer();
272  
273    // ---- 打亂字串顯示 ----
274    var scrambleLine = ctx.root.querySelector('#scrambleLine');
275  
276    function updateScrambleLine(state) {
277      if (!scrambleLine) return;
278      if (!state.scramble || state.scramble.length === 0) {
279        scrambleLine.hidden = true;
280        return;
281      }
282      scrambleLine.hidden = false;
283      var alg = state.scramble.map(function (m) { return engine.formatMove(m); }).join(' ');
284      scrambleLine.innerHTML = '';
285      var line = doc.createElement('div');
286      line.textContent = notation.fillTemplate(texts.scramble.label, { alg: alg });
287      var note = doc.createElement('div');
288      note.className = 'scramble-note';
289      note.textContent = texts.scramble.notOfficial;
290      scrambleLine.appendChild(line);
291      scrambleLine.appendChild(note);
292    }
293  
294    // ---- HUD：時間、步數、有提示徽章（依 timerRefreshMs 更新） ----
295    var timerVal = ctx.root.querySelector('#timerVal');
296    var moveVal = ctx.root.querySelector('#moveVal');
297    var hintBadge = ctx.root.querySelector('#hintBadge');
298    var hudTimeLabel = ctx.root.querySelector('#hudTimeLabel');
299    var hudMovesLabel = ctx.root.querySelector('#hudMovesLabel');
300    hudTimeLabel.textContent = texts.hud.time;
301    hudMovesLabel.textContent = texts.hud.moves;
302    hintBadge.textContent = texts.result.badgeHint;
303  
304    // ---- D-19：texts.hud.qtmNote 在步數旁以可點的小說明呈現（≥44×44 可點元素） ----
305    var qtmNoteBtn = ctx.root.querySelector('#qtmNoteBtn');
306    var qtmNoteLine = ctx.root.querySelector('#qtmNoteLine');
307    if (qtmNoteBtn && qtmNoteLine) {
308      qtmNoteLine.textContent = texts.hud.qtmNote || '';
309      qtmNoteBtn.setAttribute('aria-label', texts.hud.qtmNote || '');
310      qtmNoteBtn.addEventListener('click', function () {
311        var open = qtmNoteLine.hidden;
312        qtmNoteLine.hidden = !open;
313        qtmNoteBtn.setAttribute('aria-expanded', String(open));
314      });
315    }
316  
317    function updateHud() {
318      var state = ctx.getState();
319      timerVal.textContent = formatTime(engine.elapsedMs(state, nowMs()));
320      moveVal.textContent = String(engine.moveCount(state));
321      hintBadge.hidden = !state.assist.hint;
322      btnUndo.disabled = !engine.canApply(state, { type: 'UNDO', payload: { at: nowMs() } }, ctx.data);
323      btnRedo.disabled = !engine.canApply(state, { type: 'REDO', payload: { at: nowMs() } }, ctx.data);
324      btnScramble.textContent = state.status === 'free' ? buttons.scramble : buttons.newGame;
325      updateScrambleLine(state);
326    }
327  
328    ctx.subscribe(updateHud);
329    updateHud();
330    var refreshMs = numOr(params.ui && params.ui.timerRefreshMs, 100);
331    setInterval(updateHud, refreshMs);
332  }
333  
334  module.exports = {
335    mount: mount,
336    formatTime: formatTime
337  };
```

### 3.3 `src/ui/gesture.js`（新增，354 行）

```js
  1  // src/ui/gesture.js — 觸控手勢與轉視角（game-spec.md §9.2、§9.3；分派單 T-001 S8b）
  2  //
  3  // 依 S8a 的介面契約（docs/reports/T-001-S8a.md）：本檔只透過 ctx 接入，不修改
  4  // app.js、index.template.html 與其他 src/ui/ 檔；轉層一律呼叫 engine.gestureToMove，
  5  // 方向判定使用 ctx.view.projectAxes；視角拖曳與吸附一律呼叫 ctx.view.setDragRotation／
  6  // clearDrag／nearestOrientFrom／snapFrom／multiplyMatrix／axisAngleMatrix，不自己重算 3D 幾何。
  7  // S11／B-2：吸附改用 nearestOrientFrom／snapFrom（計入拖曳開始時的朝向）；舊的
  8  // nearestOrient／snapTo 只在朝向 0 時正確，本檔不再使用。
  9  // S11／D-26：轉層的送出改走 ctx.input 的輸入佇列（與記號鍵同一機制）；但「開始」一個手勢
 10  // 仍要求畫面靜止（ctx.input.idle()）：手指按下時要依畫面判斷碰到哪一張貼紙，動畫中的
 11  // 小方塊位置正在變動，若允許排隊會轉錯層，所以動畫中的手勢照舊不接受。
 12  //
 13  // 手勢範圍：cube-view.js 建立的 `.cube-scene`（包住 `[data-cube-stage]`；D-18 之後
 14  // `.hint-slot` 已是它的手足元素、不在裡面，見 S8a 介面契約）。styles.css 在 `.cube-scene`
 15  // 設定 touch-action: none（§9.2 最後一點）；本檔只讀取這個既有 class 來掛事件監聽器，
 16  // 不修改其 DOM 結構或內容。
 17  'use strict';
 18  
 19  // ---------------------------------------------------------------------------
 20  // 小工具（僅供本檔使用的 2D 向量與時間函式；矩陣運算一律透過 ctx.view，不重算 3D 幾何）
 21  // ---------------------------------------------------------------------------
 22  
 23  function nowMs() {
 24    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
 25    return Date.now();
 26  }
 27  
 28  // D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
 29  function numOr(v, dflt) {
 30    return (typeof v === 'number' && isFinite(v)) ? v : dflt;
 31  }
 32  
 33  function clamp(v, lo, hi) {
 34    return Math.min(hi, Math.max(lo, v));
 35  }
 36  
 37  function vecLen(x, y) {
 38    return Math.sqrt(x * x + y * y);
 39  }
 40  
 41  function vecNorm(x, y) {
 42    var len = vecLen(x, y);
 43    if (len < 1e-9) return { x: 0, y: 0 };
 44    return { x: x / len, y: y / len };
 45  }
 46  
 47  function vecNeg(v) {
 48    return { x: -v.x, y: -v.y };
 49  }
 50  
 51  function vecDot(a, b) {
 52    return a.x * b.x + a.y * b.y;
 53  }
 54  
 55  var IDENTITY_MATRIX = [1, 0, 0, 0, 1, 0, 0, 0, 1];
 56  
 57  // engine 座標的面右／下方向（3D）取負：用來組出「反方向」候選（gestureToMove 的 dir3）。
 58  function neg3(v) {
 59    return [-v[0], -v[1], -v[2]];
 60  }
 61  
 62  // ---------------------------------------------------------------------------
 63  // mount
 64  // ---------------------------------------------------------------------------
 65  
 66  function mount(ctx) {
 67    var doc = ctx.root.ownerDocument || document;
 68    var engine = ctx.engine;
 69    var view = ctx.view;
 70    var anim = ctx.anim;
 71    var input = ctx.input;
 72    var data = ctx.data || {};
 73    var params = data.params || {};
 74    var gp = params.gesture || {};
 75    var LOCK_PX = typeof gp.lockPx === 'number' ? gp.lockPx : 10;
 76    var COMMIT_PX = typeof gp.commitPx === 'number' ? gp.commitPx : 30;
 77    var MAX_AXIS_ANGLE_DEG = typeof gp.maxAxisAngleDeg === 'number' ? gp.maxAxisAngleDeg : 30;
 78    var CAMERA_DEG_PER_PX = typeof gp.cameraDegPerPx === 'number' ? gp.cameraDegPerPx : 0.5;
 79    var PITCH_LIMIT_DEG = typeof gp.pitchLimitDeg === 'number' ? gp.pitchLimitDeg : 80;
 80    // D-25：只在鍵缺少時套用預設值（0 為有效值，代表關閉動畫）。
 81    var TURN_ANIM_MS = numOr(params.ui && params.ui.turnAnimMs, 180);
 82    var SNAP_ANIM_MS = numOr(params.ui && params.ui.snapAnimMs, 200);
 83    var VIEW_HOLD = 'view-drag';
 84    var MAX_AXIS_COS = Math.cos((MAX_AXIS_ANGLE_DEG * Math.PI) / 180);
 85  
 86    var scene = ctx.root.querySelector('.cube-scene') || ctx.root.querySelector('[data-cube-stage]');
 87    if (!scene) return; // 找不到舞台就不掛手勢（不應發生；S8a 契約保證有這個容器）
 88  
 89    // ---- session：目前進行中的手勢（最多一組；第二指只影響已存在的 session） ----
 90    var session = null; // { mode:'turn'|'view', pointerId, ... }
 91  
 92    function faceLetterOf(viewIndex) {
 93      // 54 格貼紙依面序 U R F D L B 展開，每面 9 格（game-spec.md §1.1；cube.js 檔頭註解）。
 94      return ['U', 'R', 'F', 'D', 'L', 'B'][Math.floor(viewIndex / 9)];
 95    }
 96  
 97    function canGestureStart() {
 98      if (input.locked() || !input.idle()) return false;
 99      var state = ctx.getState();
100      // D-12：等提示期間不送 ROTATE／SET_ORIENT，這裡索性連手勢都不接受（等待卡片本來就
101      // 會蓋住方塊，這裡是防呆備援，避免 hint-view.js 尚未上鎖時的競態）。
102      if (state.hint && state.hint.pending) return false;
103      return true;
104    }
105  
106    function releaseCapture(el, pointerId) {
107      try {
108        if (el.hasPointerCapture && el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
109      } catch (e) {
110        // 部分測試環境（jsdom／無真實 Pointer Capture 實作）呼叫這兩個方法可能丟例外，忽略即可。
111      }
112    }
113  
114    function endSession() {
115      if (!session) return;
116      if (session.mode === 'turn') view.highlight([]);
117      releaseCapture(scene, session.pointerId);
118      session = null;
119    }
120  
121    // 轉視角期間暫停輸入佇列（不清空），吸附完成後才放行，避免記號鍵的整顆轉動畫與拖曳互搶 transform。
122    function releaseViewHold() {
123      input.release(VIEW_HOLD);
124    }
125  
126    // -------------------------------------------------------------------------
127    // 轉層（§9.2）
128    // -------------------------------------------------------------------------
129  
130    function startTurnSession(e, stickerEl) {
131      var viewIndex = Number(stickerEl.dataset.sticker);
132      session = {
133        mode: 'turn',
134        pointerId: e.pointerId,
135        viewIndex: viewIndex,
136        axes: view.projectAxes(viewIndex),
137        startX: e.clientX,
138        startY: e.clientY,
139        curX: e.clientX,
140        curY: e.clientY,
141        locked: false,
142        axisVec: null, // 鎖定後的螢幕方向單位向量（含正負號）
143        viewMove: null
144      };
145    }
146  
147    function lockTurnDirection() {
148      var axes = session.axes;
149      var candidates = [
150        { vec: vecNorm(axes.right.x, axes.right.y), dir3: engine.FACE_AXES[faceLetterOf(session.viewIndex)].right },
151        { vec: vecNeg(vecNorm(axes.right.x, axes.right.y)), dir3: neg3(engine.FACE_AXES[faceLetterOf(session.viewIndex)].right) },
152        { vec: vecNorm(axes.down.x, axes.down.y), dir3: engine.FACE_AXES[faceLetterOf(session.viewIndex)].down },
153        { vec: vecNeg(vecNorm(axes.down.x, axes.down.y)), dir3: neg3(engine.FACE_AXES[faceLetterOf(session.viewIndex)].down) }
154      ];
155      var dragVec = vecNorm(session.curX - session.startX, session.curY - session.startY);
156      var best = null;
157      var bestCos = -Infinity;
158      for (var i = 0; i < candidates.length; i++) {
159        var c = vecDot(candidates[i].vec, dragVec);
160        if (c > bestCos) {
161          bestCos = c;
162          best = candidates[i];
163        }
164      }
165      if (!best || bestCos < MAX_AXIS_COS) {
166        // §9.2 第 2 點：夾角超過門檻 → 本次手勢作廢（不轉、也不改成轉視角）。
167        endSession();
168        return;
169      }
170      var viewMove;
171      try {
172        viewMove = engine.gestureToMove(session.viewIndex, best.dir3);
173      } catch (err) {
174        endSession();
175        return;
176      }
177      session.locked = true;
178      session.axisVec = best.vec;
179      session.viewMove = viewMove;
180      view.highlight(engine.layerStickers(viewMove));
181    }
182  
183    function commitTurnIfNeeded() {
184      if (!session.locked) return;
185      var dx = session.curX - session.startX;
186      var dy = session.curY - session.startY;
187      var proj = dx * session.axisVec.x + dy * session.axisVec.y;
188      if (proj < COMMIT_PX) return; // 未達門檻：彈回（不轉、不送 action）
189      var move = session.viewMove;
190      input.enqueue({
191        build: function () { return { type: 'TURN', payload: { move: move, at: nowMs() } }; },
192        animate: function () { return anim.turn(move, TURN_ANIM_MS); }
193      });
194    }
195  
196    // -------------------------------------------------------------------------
197    // 轉視角（§9.3）
198    // -------------------------------------------------------------------------
199  
200    function startViewSession(e) {
201      session = {
202        mode: 'view',
203        pointerId: e.pointerId,
204        curX: e.clientX,
205        curY: e.clientY,
206        matrix: IDENTITY_MATRIX.slice(),
207        accumPitch: 0,
208        fromOrient: ctx.getState().orient // S11／B-2：拖曳矩陣疊加在這個朝向的畫面之上
209      };
210      input.hold(VIEW_HOLD);
211      view.setDragRotation(session.matrix);
212    }
213  
214    function updateViewDrag(e) {
215      var dx = e.clientX - session.curX;
216      var dy = e.clientY - session.curY;
217      session.curX = e.clientX;
218      session.curY = e.clientY;
219      var yawDeg = dx * CAMERA_DEG_PER_PX;
220      var rawPitch = dy * CAMERA_DEG_PER_PX;
221      var nextAccum = clamp(session.accumPitch + rawPitch, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
222      var pitchDeg = nextAccum - session.accumPitch;
223      session.accumPitch = nextAccum;
224      var yawM = view.axisAngleMatrix([0, 1, 0], yawDeg);
225      var pitchM = view.axisAngleMatrix([1, 0, 0], pitchDeg);
226      var incr = view.multiplyMatrix(pitchM, yawM);
227      session.matrix = view.multiplyMatrix(incr, session.matrix);
228      view.setDragRotation(session.matrix);
229    }
230  
231    function finishViewSession() {
232      var state = ctx.getState();
233      var fromOrient = session.fromOrient;
234      if (state.demo !== null || state.orient !== fromOrient) {
235        // 示範中：拖曳只傾斜，放開彈回原朝向、不送 action（§9.3 最後一點、§4 補充）。
236        // snapFrom(o, o) 的終點是單位矩陣＝「這次拖曳開始前的樣子」；結束後 clearDrag() 讓
237        // transform 精確歸零。（拖曳期間朝向若被其他來源改掉，也同樣只彈回、不送 action。）
238        view.snapFrom(fromOrient, fromOrient, SNAP_ANIM_MS).then(function () {
239          view.clearDrag();
240          releaseViewHold();
241        });
242        return;
243      }
244      // S11／B-2：目標朝向＝「拖曳矩陣 · 目前朝向」最接近的朝向；點一下（矩陣為單位）時就是原朝向。
245      var targetOrient = view.nearestOrientFrom(fromOrient, session.matrix);
246      view.snapFrom(fromOrient, targetOrient, SNAP_ANIM_MS).then(function () {
247        var action = { type: 'SET_ORIENT', payload: { orient: targetOrient } };
248        if (targetOrient !== fromOrient && engine.canApply(ctx.getState(), action, ctx.data)) {
249          ctx.dispatch(action); // render() 會把 transform 歸零並改用新朝向的顏色
250        } else {
251          view.clearDrag();
252        }
253        releaseViewHold();
254      });
255    }
256  
257    // -------------------------------------------------------------------------
258    // 第二指：轉層候選期間出現第二指 → 取消轉層、改為轉視角（§9.2 第 5 點）
259    // -------------------------------------------------------------------------
260  
261    function handleSecondPointer(e) {
262      if (!session) return;
263      if (session.pointerId === e.pointerId) return; // 同一指，不是第二指
264      if (session.mode !== 'turn') return; // 已經是轉視角，不需處理
265      var lastX = session.curX;
266      var lastY = session.curY;
267      var originalPointerId = session.pointerId;
268      view.highlight([]);
269      session = {
270        mode: 'view',
271        pointerId: originalPointerId, // 繼續追蹤原本那一指（已 setPointerCapture）
272        curX: lastX,
273        curY: lastY,
274        matrix: IDENTITY_MATRIX.slice(),
275        accumPitch: 0,
276        fromOrient: ctx.getState().orient // S11／B-2
277      };
278      input.hold(VIEW_HOLD);
279      view.setDragRotation(session.matrix);
280    }
281  
282    // -------------------------------------------------------------------------
283    // 事件掛載
284    // -------------------------------------------------------------------------
285  
286    function onScenePointerDown(e) {
287      if (e.pointerType === 'mouse' && e.button !== 0) return;
288      if (session) {
289        handleSecondPointer(e);
290        return;
291      }
292      if (!canGestureStart()) return;
293      var stickerEl = e.target && e.target.closest ? e.target.closest('[data-sticker]') : null;
294      if (e.cancelable) e.preventDefault();
295      try {
296        scene.setPointerCapture(e.pointerId);
297      } catch (err) {
298        // 忽略（部分測試環境無此 API）
299      }
300      if (stickerEl) {
301        startTurnSession(e, stickerEl);
302      } else {
303        startViewSession(e);
304      }
305    }
306  
307    function onPointerMove(e) {
308      if (!session || session.pointerId !== e.pointerId) return;
309      if (session.mode === 'turn') {
310        session.curX = e.clientX;
311        session.curY = e.clientY;
312        if (!session.locked) {
313          var dist = vecLen(session.curX - session.startX, session.curY - session.startY);
314          if (dist >= LOCK_PX) lockTurnDirection();
315        }
316      } else if (session.mode === 'view') {
317        updateViewDrag(e);
318      }
319    }
320  
321    function onPointerUp(e) {
322      if (!session || session.pointerId !== e.pointerId) return;
323      if (session.mode === 'turn') {
324        commitTurnIfNeeded();
325      } else if (session.mode === 'view') {
326        finishViewSession();
327      }
328      endSession();
329    }
330  
331    function onPointerCancel(e) {
332      if (!session || session.pointerId !== e.pointerId) return;
333      if (session.mode === 'view') {
334        view.clearDrag();
335        releaseViewHold();
336      }
337      endSession();
338    }
339  
340    // 文件層級：偵測「第二指落在舞台之外」的雙指情形（§9.2 第 5 點沒有限定第二指的落點）。
341    function onDocPointerDown(e) {
342      if (session && session.pointerId !== e.pointerId) handleSecondPointer(e);
343    }
344  
345    scene.addEventListener('pointerdown', onScenePointerDown);
346    scene.addEventListener('pointermove', onPointerMove);
347    scene.addEventListener('pointerup', onPointerUp);
348    scene.addEventListener('pointercancel', onPointerCancel);
349    doc.addEventListener('pointerdown', onDocPointerDown);
350  }
351  
352  module.exports = {
353    mount: mount
354  };
```

### 3.4 `src/ui/cube-view.js`（新增，494 行）

```js
  1  // src/ui/cube-view.js — 方塊 3D 畫面（CSS 3D transforms；game-spec.md §9.2、§9.3、§11.2、§11.3）
  2  //
  3  // 依分派單 T-001 S8a 輸出契約：本檔 mount(ctx) 建立 ctx.view 與 ctx.anim（見 docs/reports/T-001-S8a.md
  4  // 的「介面契約」一節）。所有規則（哪個記號轉哪一層、轉幾格）一律呼叫 engine，本檔只負責畫面。
  5  //
  6  // 座標換算（engine → CSS）：engine 座標 x 右、y 上、z 朝玩家（右手系）；CSS 3D 座標 x 右、y 下、
  7  // z 朝玩家。兩者只差 y 的正負號，換算：cssPos = (x, -y, z)。旋轉矩陣換算見 buildRotationMatrix()
  8  // 註解。
  9  'use strict';
 10  
 11  var FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'];
 12  
 13  // 記號基本字母的旋轉軸（engine 座標；與 game-spec.md §1.2 方向慣例一致：
 14  // M 同 L、E 同 D、S 同 F；x 同 R、y 同 U、z 同 F）。純屬畫面幾何用，不影響任何規則判定。
 15  var AXIS = {
 16    U: [0, 1, 0], D: [0, -1, 0], L: [-1, 0, 0], R: [1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
 17    M: [-1, 0, 0], E: [0, -1, 0], S: [0, 0, 1],
 18    x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1]
 19  };
 20  
 21  function turnOf(move) {
 22    if (move.length === 1) return 'cw';
 23    if (move.charAt(1) === '2') return 'half';
 24    return 'ccw';
 25  }
 26  
 27  // ---------------------------------------------------------------------------
 28  // 3x3 矩陣工具（純數學，僅供本檔畫面計算使用）
 29  // ---------------------------------------------------------------------------
 30  
 31  function matIdentity() {
 32    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
 33  }
 34  
 35  function matMultiply(a, b) {
 36    var out = new Array(9);
 37    for (var r = 0; r < 3; r++) {
 38      for (var c = 0; c < 3; c++) {
 39        var sum = 0;
 40        for (var k = 0; k < 3; k++) sum += a[r * 3 + k] * b[k * 3 + c];
 41        out[r * 3 + c] = sum;
 42      }
 43    }
 44    return out;
 45  }
 46  
 47  function matVec(m, v) {
 48    return [
 49      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
 50      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
 51      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
 52    ];
 53  }
 54  
 55  // 繞單位軸 axis 旋轉 angleDeg 度（右手定則，標準 Rodrigues 公式）。axis 與角度皆為呼叫端座標系。
 56  function axisAngleMatrix(axis, angleDeg) {
 57    var rad = (angleDeg * Math.PI) / 180;
 58    var c = Math.cos(rad);
 59    var s = Math.sin(rad);
 60    var t = 1 - c;
 61    var x = axis[0], y = axis[1], z = axis[2];
 62    return [
 63      t * x * x + c, t * x * y - s * z, t * x * z + s * y,
 64      t * x * y + s * z, t * y * y + c, t * y * z - s * x,
 65      t * x * z - s * y, t * y * z + s * x, t * z * z + c
 66    ];
 67  }
 68  
 69  // engine 座標旋轉矩陣 → CSS 座標旋轉矩陣：R_css[i][j] = signs[i][j] * R_engine[i][j]，
 70  // signs 在「恰有一個索引為 y（=1）」時為 -1，其餘為 +1（見檔頭註解的 y 反射推導）。
 71  var CSS_SIGN = [1, -1, 1, -1, 1, -1, 1, -1, 1];
 72  function engineMatToCss(m) {
 73    var out = new Array(9);
 74    for (var i = 0; i < 9; i++) out[i] = m[i] * CSS_SIGN[i];
 75    return out;
 76  }
 77  
 78  function rotationMatrixCss(base, turn) {
 79    var axisEngine = AXIS[base];
 80    var engineAngle = turn === 'half' ? 180 : (turn === 'cw' ? -90 : 90);
 81    var mEngine = axisAngleMatrix(axisEngine, engineAngle);
 82    return engineMatToCss(mEngine);
 83  }
 84  
 85  function matToMatrix3d(m) {
 86    // matrix3d 依欄（column-major）列出 4x4；旋轉矩陣的平移分量皆為 0。
 87    return 'matrix3d(' +
 88      m[0] + ',' + m[3] + ',' + m[6] + ',0,' +
 89      m[1] + ',' + m[4] + ',' + m[7] + ',0,' +
 90      m[2] + ',' + m[5] + ',' + m[8] + ',0,' +
 91      '0,0,0,1)';
 92  }
 93  
 94  function matTrace(m) {
 95    return m[0] + m[4] + m[8];
 96  }
 97  
 98  function matTranspose(m) {
 99    return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
100  }
101  
102  // ---------------------------------------------------------------------------
103  // 朝向與相機矩陣（純數學，不碰 DOM；S11／B-2 起抽成模組層函式，供 Node 測試直接驗證）
104  // ---------------------------------------------------------------------------
105  
106  // CAMERA_ROT[orient]：與 engine 的 24 種朝向一一對應的 CSS 旋轉矩陣 Q(o)，意義是
107  // 「朝向 o 的畫面（view 座標貼紙畫在單位矩陣位置）」等於「home 方塊整顆套用 Q(o)」。
108  // 以 engine.orientAfter 做同構 BFS：Q(orientAfter(o, rot)) = R_css(rot) · Q(o)。
109  function buildCameraRot(engine) {
110    var table = new Array(engine.ORIENT_COUNT);
111    var visited = new Array(engine.ORIENT_COUNT).fill(false);
112    table[0] = matIdentity();
113    visited[0] = true;
114    var queue = [0];
115    var gens = ['x', 'y', 'z'];
116    while (queue.length) {
117      var o = queue.shift();
118      for (var g = 0; g < gens.length; g++) {
119        var rot = gens[g];
120        var next = engine.orientAfter(o, rot);
121        if (!visited[next]) {
122          visited[next] = true;
123          table[next] = matMultiply(rotationMatrixCss(rot, 'cw'), table[o]);
124          queue.push(next);
125        }
126      }
127    }
128    return table;
129  }
130  
131  // 與 matrix 夾角最小的朝向（trace(Q(o)ᵀ · matrix) 越大代表夾角越小，標準旋轉距離度量）。
132  function nearestOrientIn(table, matrix) {
133    var best = 0;
134    var bestScore = -Infinity;
135    for (var o = 0; o < table.length; o++) {
136      var score = matTrace(matMultiply(matTranspose(table[o]), matrix));
137      if (score > bestScore) {
138        bestScore = score;
139        best = o;
140      }
141    }
142    return best;
143  }
144  
145  // S11／B-2：拖曳矩陣 D 是「疊加在目前畫面（朝向 fromOrient）之上」的暫時旋轉，
146  // 畫面上看到的是 D · Q(fromOrient) · home，所以放開後的目標朝向要用兩者合成後再找最近的。
147  function nearestOrientFromIn(table, fromOrient, dragMatrix) {
148    return nearestOrientIn(table, matMultiply(dragMatrix, table[fromOrient]));
149  }
150  
151  // S11／B-2：吸附動畫的終點（相對矩陣）。畫面仍用 fromOrient 的顏色畫在單位矩陣位置，
152  // 套上 Q(to) · Q(from)ᵀ 之後就等於「朝向 to 的畫面」，動畫結束送 SET_ORIENT 後
153  // render() 把 transform 歸零、改用 to 的顏色，前後畫面一致、不會跳動。
154  function relativeSnapMatrix(table, fromOrient, toOrient) {
155    return matMultiply(table[toOrient], matTranspose(table[fromOrient]));
156  }
157  
158  // ---------------------------------------------------------------------------
159  // mount
160  // ---------------------------------------------------------------------------
161  
162  function mount(ctx) {
163    var doc = ctx.root.ownerDocument || document;
164    var engine = ctx.engine;
165    var data = ctx.data || {};
166    var params = data.params || {};
167    var palette = data.palette || { stickers: [] };
168    var baseDeg = (params.ui && params.ui.baseViewDeg) || { x: -22, y: -34 };
169  
170    var stage = ctx.root.querySelector('[data-cube-stage]');
171    if (!stage) throw new Error('cube-view: 找不到 [data-cube-stage] 容器');
172    stage.innerHTML = '';
173  
174    var cube3d = doc.createElement('div');
175    cube3d.className = 'cube3d';
176    cube3d.style.transform = 'rotateX(' + baseDeg.x + 'deg) rotateY(' + baseDeg.y + 'deg)';
177    stage.appendChild(cube3d);
178  
179    var cubeWorld = doc.createElement('div');
180    cubeWorld.className = 'cube-world';
181    cube3d.appendChild(cubeWorld);
182  
183    // ---- 幾何建構：54 張貼紙 → 26 個小方塊（cubie）div，各自最多 3 張 face div ----
184    var faceEls = new Array(54);
185    var cubieByKey = {}; // "x,y,z"（CSS 座標）→ cubie div
186  
187    function cssPosOf(i) {
188      var p = engine.STICKER_POS[i];
189      return [p[0], -p[1], p[2]];
190    }
191  
192    for (var i = 0; i < 54; i++) {
193      var pos = cssPosOf(i);
194      var key = pos.join(',');
195      var cubie = cubieByKey[key];
196      if (!cubie) {
197        cubie = doc.createElement('div');
198        cubie.className = 'cubie';
199        cubie.style.setProperty('--gx', pos[0]);
200        cubie.style.setProperty('--gy', pos[1]);
201        cubie.style.setProperty('--gz', pos[2]);
202        cubeWorld.appendChild(cubie);
203        cubieByKey[key] = cubie;
204      }
205      var letter = FACE_LIST[Math.floor(i / 9)];
206      var face = doc.createElement('div');
207      face.className = 'face f-' + letter;
208      face.dataset.sticker = String(i);
209      var label = doc.createElement('span');
210      label.className = 'face-label';
211      label.hidden = true;
212      face.appendChild(label);
213      cubie.appendChild(face);
214      faceEls[i] = face;
215    }
216  
217    var CENTER_LETTER = { 4: 'U', 13: 'R', 22: 'F', 31: 'D', 40: 'L', 49: 'B' };
218    var CENTER_CN = (data.texts && data.texts.notation && data.texts.notation.faceName) || {};
219    Object.keys(CENTER_LETTER).forEach(function (idxStr) {
220      var idx = Number(idxStr);
221      var letter = CENTER_LETTER[idx];
222      var label = faceEls[idx].querySelector('.face-label');
223      label.innerHTML = '<b>' + letter + '</b><i>' + (CENTER_CN[letter] || '') + '</i>';
224    });
225  
226    // ---- 上色 ----
227    function paletteHex(colorId) {
228      var s = palette.stickers[colorId];
229      return s ? s.hex : '#888';
230    }
231    function paletteInk(colorId) {
232      var s = palette.stickers[colorId];
233      return s && s.labelInk ? s.labelInk : '#000';
234    }
235  
236    function paint(stickers) {
237      for (var idx = 0; idx < 54; idx++) {
238        var colorId = stickers[idx];
239        faceEls[idx].style.background = paletteHex(colorId);
240        if (CENTER_LETTER[idx]) {
241          faceEls[idx].querySelector('.face-label').style.color = paletteInk(colorId);
242        }
243      }
244    }
245  
246    // ---- 面標籤開關（§11.2） ----
247    var faceLabelsOn = !!(params.faceLabels && params.faceLabels.defaultOn);
248    // D-19：面標籤變更通知（供 controls.js／tutorial.js 同步 #faceLabelToggle 的
249    // aria-checked，取代 tutorial.js 原本直接改該按鈕屬性的繞道，見
250    // docs/reports/T-001-S8d.md「未預期發現」第 2 點）。
251    var faceLabelListeners = [];
252    function applyFaceLabelVisibility() {
253      Object.keys(CENTER_LETTER).forEach(function (idxStr) {
254        faceEls[Number(idxStr)].querySelector('.face-label').hidden = !faceLabelsOn;
255      });
256    }
257    applyFaceLabelVisibility();
258  
259    // ---- 高亮（提示層、示範層、教學層；§9.1、§9.2、§11.3） ----
260    var highlighted = [];
261    function applyHighlight(indices) {
262      highlighted.forEach(function (idx) { faceEls[idx].classList.remove('is-hi'); });
263      highlighted = (indices || []).slice();
264      highlighted.forEach(function (idx) { faceEls[idx].classList.add('is-hi'); });
265    }
266  
267    // ---- 暫留動畫（turn/rotate 結束後，等下一次 render() 才收尾，避免顏色與轉場出現閃爍） ----
268    var pendingLayerWrapper = null; // {wrapper, cubies:[{el,parent}]}
269  
270    function teardownPendingLayer() {
271      if (!pendingLayerWrapper) return;
272      var w = pendingLayerWrapper;
273      pendingLayerWrapper = null;
274      w.cubies.forEach(function (rec) {
275        rec.el.style.transform = '';
276        cubeWorld.appendChild(rec.el);
277      });
278      if (w.wrapper.parentNode) w.wrapper.parentNode.removeChild(w.wrapper);
279    }
280  
281    // ---- 預覽（previewTurn／clearPreview；§11.3，供記號小教室與打亂動畫使用；不碰 state） ----
282    var previewActive = false;
283    var previewStickers = null;
284  
285    function currentPaintSource() {
286      if (previewActive && previewStickers) return previewStickers;
287      return engine.viewStickers(ctx.getState());
288    }
289  
290    var dragging = false;
291  
292    function render() {
293      teardownPendingLayer();
294      if (!dragging) cubeWorld.style.transform = '';
295      paint(currentPaintSource());
296    }
297  
298    ctx.subscribe(render);
299    render();
300  
301    // ---- 動畫：turn（局部層轉動）、rotate（整顆旋轉）；ctx.anim 供 S8b 手勢、S8c 示範、S8a 記號鍵共用 ----
302    var busyCount = 0;
303  
304    function withBusy(promise) {
305      busyCount++;
306      return promise.then(
307        function (v) { busyCount--; return v; },
308        function (e) { busyCount--; throw e; }
309      );
310    }
311  
312    function animateGroup(cubieEls, cssMatrix, ms) {
313      teardownPendingLayer();
314      var wrapper = doc.createElement('div');
315      wrapper.className = 'turn-wrapper';
316      cubeWorld.appendChild(wrapper);
317      var recs = cubieEls.map(function (el) {
318        var parent = el.parentNode;
319        wrapper.appendChild(el);
320        return { el: el, parent: parent };
321      });
322      wrapper.style.transition = 'none';
323      wrapper.style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
324      // 強制 reflow，確保下一行的 transition 生效
325      // eslint-disable-next-line no-unused-expressions
326      wrapper.offsetHeight;
327      wrapper.style.transition = 'transform ' + ms + 'ms linear';
328      wrapper.style.transform = cssMatrix;
329      pendingLayerWrapper = { wrapper: wrapper, cubies: recs };
330      return new Promise(function (resolve) {
331        setTimeout(resolve, ms);
332      });
333    }
334  
335    function turn(viewMove, ms) {
336      var indices = engine.layerStickers(viewMove);
337      var cubieEls = [];
338      indices.forEach(function (idx) {
339        var el = faceEls[idx].parentNode;
340        if (cubieEls.indexOf(el) === -1) cubieEls.push(el);
341      });
342      var base = viewMove.charAt(0);
343      var m = rotationMatrixCss(base, turnOf(viewMove));
344      return withBusy(animateGroup(cubieEls, matToMatrix3d(m), ms));
345    }
346  
347    function rotateWholeCube(rotation, ms) {
348      var base = rotation.charAt(0);
349      var m = rotationMatrixCss(base, turnOf(rotation));
350      teardownPendingLayer();
351      cubeWorld.style.transition = 'none';
352      cubeWorld.style.transform = '';
353      // eslint-disable-next-line no-unused-expressions
354      cubeWorld.offsetHeight;
355      cubeWorld.style.transition = 'transform ' + ms + 'ms linear';
356      cubeWorld.style.transform = matToMatrix3d(m);
357      return withBusy(new Promise(function (resolve) { setTimeout(resolve, ms); }));
358    }
359  
360    function previewTurn(baseStickers, viewMove, ms) {
361      previewActive = true;
362      previewStickers = baseStickers.slice();
363      paint(previewStickers);
364      return turn(viewMove, ms).then(function () {
365        previewStickers = engine.applyMove(baseStickers, viewMove);
366        teardownPendingLayer();
367        cubeWorld.style.transform = '';
368        paint(previewStickers);
369      });
370    }
371  
372    function clearPreview() {
373      previewActive = false;
374      previewStickers = null;
375      render();
376    }
377  
378    ctx.anim = {
379      turn: turn,
380      rotate: rotateWholeCube,
381      busy: function () { return busyCount > 0; }
382    };
383  
384    // ---- 拖曳轉視角與吸附（§9.3；提供給 S8b gesture.js 使用） ----
385    // CAMERA_ROT 的意義與建法見模組層 buildCameraRot()。
386    var CAMERA_ROT = buildCameraRot(engine);
387  
388    function setDragRotation(matrix) {
389      dragging = true;
390      cubeWorld.style.transition = 'none';
391      cubeWorld.style.transform = matToMatrix3d(matrix);
392    }
393  
394    function clearDrag() {
395      dragging = false;
396      cubeWorld.style.transition = '';
397      cubeWorld.style.transform = '';
398      render();
399    }
400  
401    // 注意：nearestOrient／snapTo 把矩陣當成「相對朝向 0」的絕對旋轉，只在目前朝向為 0
402    // 時才正確（架構審查 B-2）；轉視角請改用 nearestOrientFrom／snapFrom。保留舊介面是為了
403    // 相容 S8a 契約。
404    function nearestOrient(matrix) {
405      return nearestOrientIn(CAMERA_ROT, matrix);
406    }
407  
408    function nearestOrientFrom(fromOrient, dragMatrix) {
409      return nearestOrientFromIn(CAMERA_ROT, fromOrient, dragMatrix);
410    }
411  
412    function animateWorldTo(targetMatrix, ms) {
413      dragging = true;
414      cubeWorld.style.transition = 'none';
415      // 若目前沒有暫留任何 transform，視為單位矩陣起點。
416      var current = cubeWorld.style.transform || 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
417      cubeWorld.style.transform = current;
418      // eslint-disable-next-line no-unused-expressions
419      cubeWorld.offsetHeight;
420      cubeWorld.style.transition = 'transform ' + ms + 'ms ease-out';
421      cubeWorld.style.transform = matToMatrix3d(targetMatrix);
422      return withBusy(new Promise(function (resolve) {
423        setTimeout(function () {
424          dragging = false;
425          resolve();
426        }, ms);
427      }));
428    }
429  
430    function snapTo(orient, ms) {
431      return animateWorldTo(CAMERA_ROT[orient], ms);
432    }
433  
434    // S11／B-2：從目前朝向 fromOrient 的畫面，吸附到 toOrient（toOrient === fromOrient 時就是彈回原樣）。
435    function snapFrom(fromOrient, toOrient, ms) {
436      return animateWorldTo(relativeSnapMatrix(CAMERA_ROT, fromOrient, toOrient), ms);
437    }
438  
439    // ---- projectAxes（§9.2 第 2 點；供 S8b 手勢方向判定使用） ----
440    var ROT_X_BASE = axisAngleMatrix([1, 0, 0], baseDeg.x);
441    var ROT_Y_BASE = axisAngleMatrix([0, 1, 0], baseDeg.y);
442    var BASE_TILT_CSS = matMultiply(ROT_X_BASE, ROT_Y_BASE); // transform="rotateX(bx) rotateY(by)" 的合成矩陣
443  
444    function toScreen(vEngine) {
445      var vCss = [vEngine[0], -vEngine[1], vEngine[2]];
446      var r = matVec(BASE_TILT_CSS, vCss);
447      return { x: r[0], y: r[1] };
448    }
449  
450    function projectAxes(viewIndex) {
451      var letter = FACE_LIST[Math.floor(viewIndex / 9)];
452      var axes = engine.FACE_AXES[letter];
453      return { right: toScreen(axes.right), down: toScreen(axes.down) };
454    }
455  
456    ctx.view = {
457      projectAxes: projectAxes,
458      setDragRotation: setDragRotation,
459      clearDrag: clearDrag,
460      nearestOrient: nearestOrient,
461      snapTo: snapTo,
462      nearestOrientFrom: nearestOrientFrom, // S11／B-2
463      snapFrom: snapFrom, // S11／B-2
464      highlight: applyHighlight,
465      setFaceLabels: function (on) {
466        faceLabelsOn = !!on;
467        applyFaceLabelVisibility();
468        faceLabelListeners.forEach(function (fn) { fn(faceLabelsOn); });
469      },
470      faceLabels: function () { return faceLabelsOn; },
471      onFaceLabelsChange: function (fn) { faceLabelListeners.push(fn); },
472      previewTurn: previewTurn,
473      clearPreview: clearPreview,
474      // 額外提供的畫面工具（非規格必要契約，供 S8b/S8c/S8d 需要時取用；見 docs/reports/T-001-S8a.md）：
475      multiplyMatrix: matMultiply,
476      axisAngleMatrix: axisAngleMatrix
477    };
478  }
479  
480  module.exports = {
481    mount: mount,
482    // 純數學（不碰 DOM），供 Node 測試驗證朝向與吸附幾何（S11／B-2）
483    geometry: {
484      buildCameraRot: buildCameraRot,
485      nearestOrientIn: nearestOrientIn,
486      nearestOrientFromIn: nearestOrientFromIn,
487      relativeSnapMatrix: relativeSnapMatrix,
488      rotationMatrixCss: rotationMatrixCss,
489      engineMatToCss: engineMatToCss,
490      axisAngleMatrix: axisAngleMatrix,
491      matMultiply: matMultiply,
492      matTranspose: matTranspose
493    }
494  };
```

### 3.5 `src/ui/notation.js`（新增，96 行）

```js
 1  // src/ui/notation.js — 記號輔助：白話說明與記號鍵中文副標（game-spec.md §2.4、§11.2）
 2  //
 3  // 依分派單 T-001 S8a 輸出契約：純函數、不得碰 DOM（可在 Node 直接 require 測試）。
 4  // 步數與記號種類一律取 engine.describeMove()（explainMove 用）；keySubLabel 只靠字串本身
 5  // 判斷 cw／ccw／half（外層與中層記號長度即可判斷，見 game-spec.md §1.2 記號規則），
 6  // 不依賴 engine，符合分派單「keySubLabel(move, texts)」的簽章（不含 engine 參數）。
 7  'use strict';
 8  
 9  /**
10   * 把模板字串裡的 {key} 換成 vars[key]（string(vars[key])）；vars 沒有的 key 原樣保留。
11   * @param {string} template
12   * @param {object} vars
13   * @returns {string}
14   */
15  function fillTemplate(template, vars) {
16    if (typeof template !== 'string') throw new Error('fillTemplate: template 必須是字串');
17    vars = vars || {};
18    return template.replace(/\{(\w+)\}/g, function (whole, key) {
19      return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole;
20    });
21  }
22  
23  // 由記號字串本身判斷 turn（不依賴 engine）：長度 1 → cw；第二碼是 '2' → half；否則（結尾 '）→ ccw。
24  function turnOfMoveString(move) {
25    if (move.length === 1) return 'cw';
26    if (move.charAt(1) === '2') return 'half';
27    return 'ccw';
28  }
29  
30  /**
31   * 記號鍵的中文副標（game-spec.md §11.2）。
32   * @param {string} move - 記號字串（ASCII 撇號，例："R'"）
33   * @param {object} texts - GAME_DATA.texts
34   * @returns {string}
35   */
36  function keySubLabel(move, texts) {
37    var notation = texts.notation;
38    if (notation.rotationSub && Object.prototype.hasOwnProperty.call(notation.rotationSub, move)) {
39      return notation.rotationSub[move];
40    }
41    var base = move.charAt(0);
42    var turn = turnOfMoveString(move);
43    var face = notation.faceName[base];
44    return fillTemplate(notation.keySub[turn], { face: face });
45  }
46  
47  /**
48   * 記號鍵的無障礙名稱：記號（′ 字元）＋空格＋副標（game-spec.md §11.2）。
49   * @param {string} move
50   * @param {object} texts
51   * @param {object} engine - 需要 formatMove
52   * @returns {string}
53   */
54  function keyAriaLabel(move, texts, engine) {
55    return engine.formatMove(move) + ' ' + keySubLabel(move, texts);
56  }
57  
58  /**
59   * 白話說明（game-spec.md §2.4）：一律用 engine.describeMove 取得 base／kind／turn／qtm，
60   * 不自行判斷記號種類與步數。
61   * @param {string} move
62   * @param {object} texts - GAME_DATA.texts
63   * @param {object} engine - src/engine/index.js（需要 describeMove、formatMove）
64   * @returns {string}
65   */
66  function explainMove(move, texts, engine) {
67    var d = engine.describeMove(move);
68    var explain = texts.notation.explain;
69    var displayMove = engine.formatMove(move);
70    var vars = { move: displayMove, qtm: d.qtm };
71    var templateKey;
72    if (d.kind === 'rotation') {
73      templateKey = 'rotation';
74      vars.name = explain.rotationName[d.move];
75    } else if (d.turn === 'half') {
76      templateKey = 'half';
77      vars.layer = explain.layerName[d.base];
78    } else if (d.kind === 'slice') {
79      templateKey = 'sliceQuarter';
80      vars.layer = explain.layerName[d.base];
81      var ref = explain.sliceRef[d.base];
82      vars.ref = d.turn === 'ccw' ? ref + '′' : ref; // ccw 附上 ′（U+2032）
83    } else {
84      templateKey = 'quarter';
85      vars.layer = explain.layerName[d.base];
86      vars.dir = d.turn === 'cw' ? explain.dirCw : explain.dirCcw;
87    }
88    return fillTemplate(explain[templateKey], vars);
89  }
90  
91  module.exports = {
92    fillTemplate: fillTemplate,
93    keySubLabel: keySubLabel,
94    keyAriaLabel: keyAriaLabel,
95    explainMove: explainMove
96  };
```

### 3.6 `src/ui/solver-client.js`（新增，608 行）

```js
  1  // src/ui/solver-client.js — 主執行緒端的求解器客戶端
  2  //
  3  // 依據：game-spec.md §7.5（計畫快取）、§9.4（求解器狀態）、§9.5（訊息協定）、§9.6（逾時與退回）；
  4  //       ADR-001-solver.md §2.5、§2.6；分派單 T-001 S6、X-6、X-9；技術裁決 D-2、D-3、D-5。
  5  //
  6  // 職責（S8c 只呼叫 requestHint／requestDemo／cancel／status，不自行實作以下任何一項）：
  7  //   - 建立 Worker、送 init、追蹤建表進度（booting → building → ready）。
  8  //   - 請求佇列：Worker 內同時只有一個求解請求；建表完成前的請求先排隊。
  9  //   - watchdog：initTimeoutMs、solveTimeoutMs（本檔在 UI 層，可以用時鐘，但一律透過注入的 deps）。
 10  //   - 計畫快取（鍵＝home 貼紙字串，值＝剩下的 home 記號序列）。
 11  //   - 退回：Worker 建不起來 → mainThread；建表逾時或出錯 → failed；
 12  //           求解逾時或 NODE_LIMIT → 本次改用層先法（提示）或回報建議解不可用（建議解示範）。
 13  //
 14  // deps（全部由外部注入，Node 測試可用假 Worker 與假時鐘）：
 15  //   createWorker(handlers) → {postMessage(msg), terminate()}
 16  //       handlers = {onMessage(data), onError(err)}；建不起來就丟例外（→ mainThread）。
 17  //       省略時使用 defaultCreateWorker（瀏覽器：以 window.SOLVER_WORKER_SRC 建 Blob Worker）。
 18  //   setTimer(fn, ms) → handle、clearTimer(handle)、now() → 毫秒
 19  //   engine    src/engine/index.js（solverInput、isSolvedNow、viewStickers、toHome、toView、applyMove、qtmCost、kind）
 20  //   params    GAME_DATA.params（本檔讀 params.solver；D-3：init 與 solve 一律傳入 params.solver）
 21  //   lblConfig GAME_DATA.lbl（lbl.json 全文）
 22  //   onStatus(status)  狀態改變時呼叫（可省略）
 23  //   solvers   {twophase, lbl}（可省略；省略時 require 主 bundle 內的 solver 模組，供主執行緒退回使用）
 24  //
 25  // 回傳的 action 只有下列形式（UI 直接 dispatch；reducer 拒絕時丟棄即可）：
 26  //   {type:'HINT_READY',  payload:{version, tokens, source, planQtm}}
 27  //   {type:'HINT_FAILED', payload:{version, code}}
 28  //   {type:'DEMO_READY',  payload:{version, tokens, segments}}
 29  //   {type:'DEMO_FAILED', payload:{version, code}}
 30  'use strict';
 31  
 32  // 主 bundle 也包含 solver 模組（ADR-001 §2.6），供主執行緒退回與層先法退回使用
 33  var defaultTwophase = require('../solver/twophase.js');
 34  var defaultLbl = require('../solver/lbl.js');
 35  
 36  var STATES = ['booting', 'building', 'ready', 'mainThread', 'failed'];
 37  
 38  // 失敗碼 → 文案鍵（texts.json）。UI 依此顯示，不要自己依字串分支。
 39  // 不在表內的碼依 D-5 一律視為非法狀態。
 40  var FAILURE_TEXT_KEYS = {
 41    CANCELLED: null,
 42    ALREADY_SOLVED: null,
 43    NODE_LIMIT: 'demo.suggestUnavailable',
 44    TIMEOUT: 'demo.suggestUnavailable',
 45    SOLVER_FAILED: 'demo.suggestUnavailable',
 46    INVALID_STATE: 'error.invalidState',
 47    LBL_STUCK: 'error.generic',
 48    BAD_REQUEST: 'error.generic',
 49    NOT_READY: 'error.generic',
 50    INTERNAL: 'error.generic'
 51  };
 52  
 53  /**
 54   * 失敗碼對應的文案鍵（'demo.suggestUnavailable'｜'error.invalidState'｜'error.generic'｜null）。
 55   * 'demo.suggestUnavailable' 表示應提供「改看層先法示範」按鈕（§9.6）。
 56   */
 57  function failureTextKey(code) {
 58    if (Object.prototype.hasOwnProperty.call(FAILURE_TEXT_KEYS, code)) return FAILURE_TEXT_KEYS[code];
 59    return 'error.invalidState';
 60  }
 61  
 62  /**
 63   * 瀏覽器預設的 Worker 建立方式：以 window.SOLVER_WORKER_SRC 產生 Blob URL（ADR-001 §2.5）。
 64   * 任何一步不可用都丟例外，讓 client 轉 mainThread。
 65   */
 66  function defaultCreateWorker(handlers) {
 67    var g = typeof window !== 'undefined' ? window : null;
 68    if (!g || typeof g.SOLVER_WORKER_SRC !== 'string' || typeof g.Worker !== 'function' ||
 69        typeof g.Blob !== 'function' || !g.URL || typeof g.URL.createObjectURL !== 'function') {
 70      throw new Error('solver-client：此環境無法建立 Worker');
 71    }
 72    var url = g.URL.createObjectURL(new g.Blob([g.SOLVER_WORKER_SRC], { type: 'text/javascript' }));
 73    var w;
 74    try {
 75      w = new g.Worker(url);
 76    } catch (e) {
 77      g.URL.revokeObjectURL(url);
 78      throw e;
 79    }
 80    // n-7：Worker 建立後就釋放 Blob URL，不必等到 terminate。保守起見在「Worker 第一次回訊息
 81    // （此時腳本已載入並開始執行）或出錯」時釋放，而不是 new Worker 之後立刻釋放：依 HTML 規格
 82    // 立刻釋放應該也可以，但 iPad Safari 的實際行為未實測（UNKNOWN），所以選擇較晚、較保守的時間點。
 83    var revoked = false;
 84    function revokeOnce() {
 85      if (revoked) return;
 86      revoked = true;
 87      g.URL.revokeObjectURL(url);
 88    }
 89    w.onmessage = function (e) {
 90      revokeOnce();
 91      handlers.onMessage(e.data);
 92    };
 93    w.onerror = function (e) {
 94      revokeOnce();
 95      if (e && typeof e.preventDefault === 'function') e.preventDefault();
 96      handlers.onError(e);
 97    };
 98    return {
 99      postMessage: function (msg) { w.postMessage(msg); },
100      terminate: function () {
101        w.terminate();
102        revokeOnce();
103      }
104    };
105  }
106  
107  function createSolverClient(deps) {
108    if (!deps || !deps.engine || !deps.params || !deps.params.solver || !deps.lblConfig) {
109      throw new Error('solver-client：缺少 engine、params.solver 或 lblConfig');
110    }
111    if (typeof deps.setTimer !== 'function' || typeof deps.clearTimer !== 'function' || typeof deps.now !== 'function') {
112      throw new Error('solver-client：缺少 setTimer、clearTimer 或 now');
113    }
114    var engine = deps.engine;
115    var solverParams = deps.params.solver;
116    var lblConfig = deps.lblConfig;
117    var createWorker = deps.createWorker || defaultCreateWorker;
118    var setTimer = deps.setTimer;
119    var clearTimer = deps.clearTimer;
120    var now = deps.now;
121    var onStatus = typeof deps.onStatus === 'function' ? deps.onStatus : function () {};
122    var twophase = (deps.solvers && deps.solvers.twophase) || defaultTwophase;
123    var lbl = (deps.solvers && deps.solvers.lbl) || defaultLbl;
124    var TOTAL_STEPS = twophase.PROGRESS_LABELS ? twophase.PROGRESS_LABELS.length : 6;
125  
126    // ---- 內部狀態（UI 狀態，不進 engine state；X-3） ----
127    var started = false;
128    var mode = 'booting';
129    var step = 0;
130    var initMs = null;       // 建表耗時（Worker 或主執行緒；僅供顯示與實機量測）
131    var initStartAt = null;
132    var worker = null;       // 目前的 Worker 包裝；null 代表沒有
133    var initId = null;
134    var initTimer = null;
135    var nextId = 0;
136    var inFlight = null;     // {id, job, timer}：Worker 內唯一的求解請求
137    var queue = [];          // 等待送出的 job
138    var current = null;      // 呼叫端正在等待的 job（cancel 的對象）
139    var cache = new Map();   // home 字串 → 剩下的 home 記號序列
140    var mainTimer = null;    // 主執行緒模式下已排程的 job 計時器；null 代表沒有
141  
142    function statusObj() {
143      return {
144        state: mode,
145        step: step,
146        total: TOTAL_STEPS,
147        initMs: initMs,
148        // 主執行緒模式且尚未建表：第一次求解前 UI 要先顯示 texts.solver.mainThreadNotice
149        notice: mode === 'mainThread' && !twophase.isReady()
150      };
151    }
152  
153    function setMode(m, s) {
154      mode = m;
155      if (s !== undefined) step = s;
156      onStatus(statusObj());
157    }
158  
159    // ---- 計畫快取（§7.5） ----
160    function keyOf(stickers) {
161      return stickers.join('');
162    }
163  
164    function cachePut(key, value) {
165      if (cache.has(key)) cache.delete(key);
166      cache.set(key, value);
167      while (cache.size > solverParams.planCacheSize) {
168        cache.delete(cache.keys().next().value);
169      }
170    }
171  
172    function storePlan(home, homeMoves) {
173      var cur = home.slice();
174      for (var i = 0; i < homeMoves.length; i++) {
175        cachePut(keyOf(cur), homeMoves.slice(i));
176        cur = engine.applyMove(cur, homeMoves[i]);
177      }
178    }
179  
180    function planQtmOf(homeMoves) {
181      var sum = 0;
182      for (var i = 0; i < homeMoves.length; i++) sum += engine.qtmCost(homeMoves[i]);
183      return sum;
184    }
185  
186    // ---- action 產生 ----
187    function failAction(job, code) {
188      return {
189        type: job.req === 'hint' ? 'HINT_FAILED' : 'DEMO_FAILED',
190        payload: { version: job.version, code: code }
191      };
192    }
193  
194    function actionFromPlan(job, plan) {
195      if (job.req === 'hint') {
196        return {
197          type: 'HINT_READY',
198          payload: {
199            version: job.version,
200            tokens: [engine.toView(job.orient, plan[0])],
201            source: 'suggest',
202            planQtm: planQtmOf(plan)
203          }
204        };
205      }
206      return {
207        type: 'DEMO_READY',
208        payload: {
209          version: job.version,
210          tokens: plan.map(function (m) { return engine.toView(job.orient, m); }),
211          segments: null
212        }
213      };
214    }
215  
216    // 層先法結果 → action（提示：取第一個轉動及其前面的整顆旋轉；§9.6）
217    function actionFromLbl(job, r) {
218      if (job.req === 'hint') {
219        var tokens = [];
220        for (var i = 0; i < r.tokens.length; i++) {
221          tokens.push(r.tokens[i]);
222          if (engine.kind(r.tokens[i]) !== 'rotation') {
223            return {
224              type: 'HINT_READY',
225              payload: { version: job.version, tokens: tokens, source: 'lbl', planQtm: null }
226            };
227          }
228        }
229        return failAction(job, 'INTERNAL');
230      }
231      return {
232        type: 'DEMO_READY',
233        payload: { version: job.version, tokens: r.tokens.slice(), segments: r.segments }
234      };
235    }
236  
237    function finish(job, action) {
238      if (job.done) return;
239      job.done = true;
240      if (current === job) current = null;
241      job.resolve(action);
242    }
243  
244    // ---- 主執行緒上的計算 ----
245    function lblOnMain(job) {
246      var parsed = twophase.fromStickerColors(job.stickers);
247      if (!parsed.ok) return failAction(job, 'INVALID_STATE');
248      var r = lbl.generateLbl(job.stickers.slice(), lblConfig);
249      if (r.error) return failAction(job, r.error);
250      return actionFromLbl(job, r);
251    }
252  
253    // 建議解不可用時的退回（§9.6）：提示與層先法示範改在主執行緒跑層先法；建議解示範回報不可用
254    function fallback(job, code) {
255      if (job.done) return;
256      if (job.req === 'suggest') {
257        finish(job, failAction(job, code));
258        return;
259      }
260      finish(job, lblOnMain(job));
261    }
262  
263    function solveOnMain(job) {
264      var parsed = twophase.fromStickerColors(job.stickers);
265      if (!parsed.ok) {
266        finish(job, failAction(job, 'INVALID_STATE'));
267        return;
268      }
269      if (!twophase.isReady()) {
270        var t0 = now();
271        try {
272          twophase.init(null, function (k) { step = k; onStatus(statusObj()); });
273        } catch (e) {
274          setMode('failed');
275          fallback(job, 'SOLVER_FAILED');
276          drainQueue();
277          return;
278        }
279        initMs = now() - t0;
280        onStatus(statusObj());
281      }
282      var r = twophase.solve(parsed.cube, solverParams);
283      if (r.error) {
284        if (r.error === 'NODE_LIMIT') fallback(job, 'NODE_LIMIT');
285        else finish(job, failAction(job, 'INTERNAL'));
286        return;
287      }
288      acceptSolve(job, r.names);
289    }
290  
291    function runOnMain(job) {
292      if (job.req === 'lbl') {
293        finish(job, lblOnMain(job));
294      } else {
295        solveOnMain(job);
296      }
297    }
298  
299    // 主執行緒模式：一次排程一個 job，讓 UI 先有機會畫出等待卡片與提示文案
300    function pumpMain() {
301      if (mainTimer !== null) return;
302      while (queue.length > 0 && queue[0].done) queue.shift();
303      if (queue.length === 0) return;
304      mainTimer = setTimer(function () {
305        mainTimer = null;
306        var job = queue.shift();
307        if (job && !job.done) runOnMain(job);
308        pumpMain();
309      }, 0);
310    }
311  
312    function acceptSolve(job, viewMoves) {
313      if (!Array.isArray(viewMoves)) throw new Error('solver-client：moves 不是陣列');
314      var homeMoves = viewMoves.map(function (m) { return engine.toHome(job.orient, m); });
315      storePlan(job.home, homeMoves);
316      if (job.done) return; // 已取消：結果只進快取，不交給呼叫端
317      if (homeMoves.length === 0) {
318        finish(job, failAction(job, 'ALREADY_SOLVED'));
319        return;
320      }
321      finish(job, actionFromPlan(job, homeMoves));
322    }
323  
324    // ---- Worker ----
325    function killWorker() {
326      if (initTimer !== null) {
327        clearTimer(initTimer);
328        initTimer = null;
329      }
330      if (inFlight && inFlight.timer !== null) clearTimer(inFlight.timer);
331      var w = worker;
332      worker = null;
333      initId = null;
334      if (w) {
335        try {
336          w.terminate();
337        } catch (e) {
338          // 終止失敗不影響後續流程
339        }
340      }
341    }
342  
343    function boot() {
344      var w = null;
345      var handlers = {
346        onMessage: function (data) { if (w !== null && w === worker) onWorkerMessage(data); },
347        onError: function (err) { if (w !== null && w === worker) onWorkerError(err); }
348      };
349      try {
350        w = createWorker(handlers);
351        if (!w || typeof w.postMessage !== 'function') throw new Error('solver-client：createWorker 回傳值無效');
352      } catch (e) {
353        w = null;
354        toMainThread();
355        return;
356      }
357      worker = w;
358      initId = ++nextId;
359      step = 0;
360      setMode('booting', 0);
361      initStartAt = now();
362      initTimer = setTimer(onInitTimeout, solverParams.initTimeoutMs);
363      try {
364        w.postMessage({ type: 'init', id: initId, params: solverParams });
365      } catch (e) {
366        toMainThread();
367      }
368    }
369  
370    function toMainThread() {
371      var orphan = inFlight;
372      killWorker();
373      inFlight = null;
374      setMode('mainThread');
375      if (orphan && !orphan.job.done) queue.unshift(orphan.job);
376      pumpMain();
377    }
378  
379    function toFailed() {
380      killWorker();
381      inFlight = null;
382      setMode('failed');
383      drainQueue();
384    }
385  
386    function onInitTimeout() {
387      initTimer = null;
388      toFailed();
389    }
390  
391    function onWorkerError() {
392      toMainThread();
393    }
394  
395    // 依目前模式處理佇列
396    function drainQueue() {
397      if (mode === 'ready') {
398        pumpWorker();
399      } else if (mode === 'mainThread') {
400        pumpMain();
401      } else if (mode === 'failed') {
402        var jobs = queue;
403        queue = [];
404        for (var i = 0; i < jobs.length; i++) {
405          if (jobs[i].done) continue;
406          if (jobs[i].req === 'lbl') finish(jobs[i], lblOnMain(jobs[i]));
407          else fallback(jobs[i], 'SOLVER_FAILED');
408        }
409      }
410      // booting／building：等 ready 或 failed
411    }
412  
413    function pumpWorker() {
414      if (mode !== 'ready' || inFlight !== null || worker === null) return;
415      while (queue.length > 0 && queue[0].done) queue.shift();
416      if (queue.length === 0) return;
417      var job = queue.shift();
418      var id = ++nextId;
419      var msg = job.req === 'lbl'
420        ? { type: 'lbl', id: id, stickers: job.stickers, config: lblConfig }
421        : { type: 'solve', id: id, stickers: job.stickers, opts: solverParams };
422      inFlight = { id: id, job: job, timer: setTimer(onSolveTimeout, solverParams.solveTimeoutMs) };
423      try {
424        worker.postMessage(msg);
425      } catch (e) {
426        toMainThread();
427      }
428    }
429  
430    function onSolveTimeout() {
431      var job = inFlight ? inFlight.job : null;
432      if (inFlight) inFlight.timer = null;
433      inFlight = null;
434      // 終止並在背景重建 Worker（§9.6）；本次請求退回
435      killWorker();
436      if (job) fallback(job, 'TIMEOUT');
437      boot();
438    }
439  
440    function onWorkerMessage(data) {
441      if (!data || typeof data !== 'object') return;
442      if (initId !== null && data.id === initId) {
443        if (data.type === 'progress') {
444          setMode('building', data.step);
445        } else if (data.type === 'ready') {
446          clearTimer(initTimer);
447          initTimer = null;
448          initId = null;
449          initMs = now() - initStartAt;
450          setMode('ready', TOTAL_STEPS);
451          drainQueue();
452        } else if (data.type === 'error') {
453          toFailed();
454        }
455        return;
456      }
457      if (inFlight === null || data.id !== inFlight.id) return; // 過期的回覆
458      var job = inFlight.job;
459      if (inFlight.timer !== null) clearTimer(inFlight.timer);
460      inFlight = null;
461      try {
462        handleReply(job, data);
463      } catch (e) {
464        finish(job, failAction(job, 'INTERNAL')); // 回覆格式不符，不讓呼叫端永遠等待
465      }
466      pumpWorker();
467    }
468  
469    function handleReply(job, data) {
470      if (data.type === 'result' && data.kind === 'solve' && job.req !== 'lbl') {
471        acceptSolve(job, data.moves);
472        return;
473      }
474      if (data.type === 'result' && data.kind === 'lbl' && job.req === 'lbl') {
475        if (!job.done) finish(job, actionFromLbl(job, data));
476        return;
477      }
478      if (job.done) return;
479      if (data.type !== 'error') {
480        finish(job, failAction(job, 'INTERNAL'));
481        return;
482      }
483      if (data.code === 'NODE_LIMIT') {
484        fallback(job, 'NODE_LIMIT');
485      } else if (data.code === 'NOT_READY' && !job.retried) {
486        // 程式錯誤（§9.5）：重建 Worker 後重送一次
487        job.retried = true;
488        queue.unshift(job);
489        killWorker();
490        boot();
491      } else if (typeof data.code === 'string' && Object.prototype.hasOwnProperty.call(FAILURE_TEXT_KEYS, data.code)) {
492        finish(job, failAction(job, data.code));
493      } else {
494        finish(job, failAction(job, 'INVALID_STATE')); // D-5
495      }
496    }
497  
498    // ---- 對外介面 ----
499    function start() {
500      if (started) return;
501      started = true;
502      boot();
503    }
504  
505    function submit(state, req) {
506      if (current !== null) cancel();
507      var input = engine.solverInput(state);
508      var job = {
509        req: req,
510        stickers: input.stickers,
511        version: input.version,
512        orient: input.orient,
513        home: state.home.slice(),
514        done: false,
515        retried: false,
516        resolve: null
517      };
518      // D-2：已復原不送請求
519      if (engine.isSolvedNow(state)) return Promise.resolve(failAction(job, 'ALREADY_SOLVED'));
520      if (req !== 'lbl') {
521        var plan = cache.get(keyOf(job.home));
522        if (plan && plan.length > 0) return Promise.resolve(actionFromPlan(job, plan));
523        if (mode === 'failed') {
524          if (req === 'suggest') return Promise.resolve(failAction(job, 'SOLVER_FAILED'));
525          return Promise.resolve(lblOnMain(job));
526        }
527      } else if (mode === 'failed') {
528        return Promise.resolve(lblOnMain(job));
529      }
530      var p = new Promise(function (resolve) { job.resolve = resolve; });
531      current = job;
532      queue.push(job);
533      if (!started) start();
534      else drainQueue();
535      return p;
536    }
537  
538    /**
539     * 請求下一步提示。
540     * @param {object} state - engine state（通常是剛送出 HINT_REQUEST 之後的 state）
541     * @returns {Promise<object>} HINT_READY 或 HINT_FAILED action
542     */
543    function requestHint(state) {
544      return submit(state, 'hint');
545    }
546  
547    /**
548     * 請求示範。
549     * @param {object} state - engine state（通常是剛送出 DEMO_REQUEST 之後的 state）
550     * @param {'suggest'|'lbl'} kind
551     * @returns {Promise<object>} DEMO_READY 或 DEMO_FAILED action
552     */
553    function requestDemo(state, kind) {
554      if (kind !== 'suggest' && kind !== 'lbl') {
555        return Promise.resolve({ type: 'DEMO_FAILED', payload: { version: state.version, code: 'BAD_REQUEST' } });
556      }
557      return submit(state, kind);
558    }
559  
560    /**
561     * 取消目前等待中的請求：該請求的 Promise 立即以 code 'CANCELLED' 的 FAILED action 結束（UI 照常 dispatch），
562     * 之後 Worker 遲到的結果不再交給呼叫端（建議解仍會存進快取）。
563     * @returns {object|null} 產生的 FAILED action；沒有等待中的請求時為 null
564     */
565    function cancel() {
566      var job = current;
567      if (job === null || job.done) return null;
568      var action = failAction(job, 'CANCELLED');
569      var qi = queue.indexOf(job);
570      if (qi >= 0) queue.splice(qi, 1);
571      finish(job, action);
572      return action;
573    }
574  
575    function status() {
576      return statusObj();
577    }
578  
579    /** 終止 Worker、清除所有計時器（測試與頁面卸載用）。 */
580    function dispose() {
581      cancel();
582      killWorker();
583      if (mainTimer !== null) {
584        clearTimer(mainTimer);
585        mainTimer = null;
586      }
587      inFlight = null;
588      queue = [];
589    }
590  
591    return {
592      start: start,
593      status: status,
594      requestHint: requestHint,
595      requestDemo: requestDemo,
596      cancel: cancel,
597      dispose: dispose,
598      failureTextKey: failureTextKey,
599      cacheSize: function () { return cache.size; }
600    };
601  }
602  
603  module.exports = {
604    createSolverClient: createSolverClient,
605    defaultCreateWorker: defaultCreateWorker,
606    failureTextKey: failureTextKey,
607    STATES: STATES
608  };
```

### 3.7 `src/ui/index.template.html`（新增，92 行）

```html
 1  <!doctype html>
 2  <!--
 3    src/ui/index.template.html — 打包用 HTML 樣板（版型 C：學習導向；game-spec.md §11.1）
 4    依分派單 T-001 S8a（X-7 空殼移交後由本段改寫，所有權見 docs/reports/T-001-S8a.md）。
 5    build/bundle.js 會依序把下面本檔內文出現的五個 INJECT 標記換成實際內容：
 6    CSS（styles.css、demo.css、overlay.css）、VERSION（window.GAME_VERSION）、
 7    DATA（window.GAME_DATA）、WORKER（window.SOLVER_WORKER_SRC）、
 8    JS（主 bundle：迷你模組註冊器＋ui/app.js 等）。
 9  
10    文字內容一律由 app.js／controls.js 等模組於掛載時從 window.GAME_DATA.texts 填入
11    （§11.4：UI 只呈現 state；文案集中在 texts.json，方便 game-designer 潤飾不必改本檔）。
12    只有一份 DOM（手機直向與 iPad 橫向共用，靠 CSS @media (orientation: landscape) 切版面），
13    同頁不得有重複 id（game-spec.md §11.1 差異第 5 點）。
14  
15    版面：
16      .shell            版型 C 的左右兩欄（橫向）／單欄（直向）容器
17        .leftcol          狀態列 → 方塊區 → 操作列
18        #learnDrawer      學習面板（iPad：右欄常駐；手機：方塊下方抽屜）
19      [data-slot=overlay] 完成畫面等置中卡片（S8d）
20  
21    插槽（分派單 §3 S8a）：data-slot="lesson-button|lesson-card|overlay|hint-button|hint|demo|solver-status"
22  -->
23  <html lang="zh-Hant">
24  <head>
25  <meta charset="utf-8">
26  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
27  <title>魔術方塊</title>
28  <!-- INJECT:CSS -->
29  </head>
30  <body>
31  <div id="app" class="app">
32    <div class="shell">
33      <div class="leftcol">
34        <div class="statusbar" id="statusbar">
35          <div class="stat"><span class="k" id="hudTimeLabel"></span><span class="v" id="timerVal">0:00.0</span></div>
36          <div class="stat">
37            <span class="k" id="hudMovesLabel"></span>
38            <span class="v-row"><span class="v" id="moveVal">0</span><button type="button" class="qtm-note-btn" id="qtmNoteBtn" aria-expanded="false">?</button></span>
39          </div>
40          <span class="badge" id="hintBadge" hidden></span>
41        </div>
42        <div class="qtm-note-line" id="qtmNoteLine" hidden></div>
43        <div class="cube-scene">
44          <div data-cube-stage class="cube-stage"></div>
45        </div>
46        <!-- D-18：手機直向時提示浮層搬到方塊區與操作列之間的一般文件流（絕不會蓋住
47             方塊），iPad 橫向則用 styles.css 的 landscape 媒體查詢改回貼在方塊右上角
48             （見 styles.css `.hint-slot` 的說明）。 -->
49        <div class="hint-slot" data-slot="hint"></div>
50        <div class="scramble-line" id="scrambleLine" hidden></div>
51        <div class="controlbar" id="controlbar">
52          <button class="ctl" type="button" id="btnScramble"></button>
53          <button class="ctl" type="button" id="btnUndo"></button>
54          <button class="ctl" type="button" id="btnRedo"></button>
55          <button class="ctl" type="button" id="btnReset"></button>
56          <span class="slot-inline" data-slot="hint-button"></span>
57          <button class="ctl accent" type="button" id="btnDemoOpen"></button>
58        </div>
59      </div>
60      <div class="drawer" id="learnDrawer">
61        <div class="drawer-handle">
62          <span class="handle-tap" id="handleTap">
63            <span class="drawer-label" id="drawerLabel"></span>
64            <span class="bar" aria-hidden="true"></span>
65          </span>
66          <span class="handle-tools">
67            <span class="slot-inline" data-slot="lesson-button"></span>
68            <button type="button" class="switch" id="faceLabelToggle" role="switch" aria-checked="false"></button>
69          </span>
70        </div>
71        <div class="ctabs" role="tablist">
72          <button type="button" class="ctab" id="tabControls" role="tab"></button>
73          <button type="button" class="ctab" id="tabDemo" role="tab"></button>
74        </div>
75        <div class="cpanel" id="panelControls" data-cpanel="controls" role="tabpanel">
76          <div class="keypad" id="keypad" aria-label="記號鍵盤"></div>
77        </div>
78        <div class="cpanel" id="panelDemo" data-cpanel="demo" role="tabpanel" hidden>
79          <div class="slot-block" data-slot="solver-status"></div>
80          <div class="slot-block" data-slot="demo"></div>
81        </div>
82        <div class="lesson-card" data-slot="lesson-card" hidden></div>
83      </div>
84    </div>
85    <div class="overlay-root" data-slot="overlay"></div>
86  </div>
87  <!-- INJECT:VERSION -->
88  <!-- INJECT:DATA -->
89  <!-- INJECT:WORKER -->
90  <!-- INJECT:JS -->
91  </body>
92  </html>
```

### 3.8 `src/ui/styles.css`（新增，220 行）

```css
  1  /* src/ui/styles.css — 主樣式：版型 C（學習導向）＋ CSS 3D 方塊（game-spec.md §9、§11） */
  2  /* 依分派單 T-001 S8a；視覺參考 docs/ui/v1-C.html（行為與尺寸以規格為準，見 §11.1 差異表）。 */
  3  
  4  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  5  html, body {
  6    margin: 0;
  7    height: 100%;
  8    background: #e7e7e4;
  9    color: #111;
 10    font-family: "PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei", "Heiti TC", sans-serif;
 11  }
 12  button { font-family: inherit; }
 13  [hidden] { display: none !important; }
 14  
 15  .app { position: relative; height: 100%; overflow: hidden; }
 16  .shell { display: flex; flex-direction: column; height: 100%; background: #fff; }
 17  .leftcol { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
 18  
 19  /* ---- 狀態列 ---- */
 20  .statusbar {
 21    flex: 0 0 auto;
 22    display: flex; align-items: center; gap: 18px;
 23    padding: 8px 14px; font-size: 13px;
 24    border-bottom: 1px solid #eee;
 25  }
 26  .statusbar .stat { display: flex; flex-direction: column; line-height: 1.25; }
 27  .statusbar .k { color: #777; font-size: 11px; }
 28  .statusbar .v { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; }
 29  /* ---- D-19：步數旁的 QTM 小說明（texts.hud.qtmNote），可點元素 ≥44×44 ---- */
 30  .statusbar .v-row { display: flex; align-items: center; gap: 4px; }
 31  .qtm-note-btn {
 32    min-width: 44px; min-height: 44px; padding: 0; border-radius: 999px;
 33    border: 1.5px solid #999; background: #fff; color: #666; font-size: 13px; font-weight: 700;
 34  }
 35  .qtm-note-btn[aria-expanded="true"] { border-color: #0a6cff; color: #0a6cff; background: #eef3ff; }
 36  .qtm-note-line {
 37    flex: 0 0 auto; padding: 6px 14px; font-size: 12px; color: #555; line-height: 1.5;
 38    background: #f2f6ff; border-bottom: 1px solid #dbe6ff;
 39  }
 40  .badge {
 41    display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px;
 42    border-radius: 999px; font-size: 12px; font-weight: 700;
 43    background: #fff3cd; color: #8a6100; border: 1px solid #f0c96a;
 44  }
 45  
 46  /* ---- 方塊 3D 舞台 ---- */
 47  .cube-scene {
 48    position: relative; flex: 1 1 auto; min-height: 0;
 49    display: flex; align-items: center; justify-content: center;
 50    perspective: 900px; touch-action: none; background: #f7f8fa;
 51  }
 52  .cube-stage { position: relative; width: 0; height: 0; }
 53  .cube3d { position: relative; width: 0; height: 0; transform-style: preserve-3d; }
 54  .cube-world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-style: preserve-3d; }
 55  
 56  .cube-scene { --cs: 34px; --gap: 2px; --step: calc(var(--cs) + var(--gap)); }
 57  @media (orientation: landscape) { .cube-scene { --cs: 46px; } }
 58  
 59  .cubie {
 60    position: absolute; width: var(--cs); height: var(--cs);
 61    left: calc(var(--cs) / -2); top: calc(var(--cs) / -2);
 62    transform-style: preserve-3d;
 63    transform: translate3d(calc(var(--gx) * var(--step)), calc(var(--gy) * var(--step)), calc(var(--gz) * var(--step)));
 64  }
 65  .face {
 66    position: absolute; width: var(--cs); height: var(--cs);
 67    border-radius: calc(var(--cs) * .14);
 68    box-shadow: inset 0 0 0 calc(var(--cs) * .07) rgba(0, 0, 0, .35);
 69    display: flex; align-items: center; justify-content: center;
 70    backface-visibility: hidden;
 71  }
 72  .f-F { transform: translateZ(calc(var(--cs) / 2)); }
 73  .f-B { transform: rotateY(180deg) translateZ(calc(var(--cs) / 2)); }
 74  .f-R { transform: rotateY(90deg) translateZ(calc(var(--cs) / 2)); }
 75  .f-L { transform: rotateY(-90deg) translateZ(calc(var(--cs) / 2)); }
 76  .f-U { transform: rotateX(90deg) translateZ(calc(var(--cs) / 2)); }
 77  .f-D { transform: rotateX(-90deg) translateZ(calc(var(--cs) / 2)); }
 78  .face.is-hi { box-shadow: inset 0 0 0 calc(var(--cs) * .16) #ffb300, 0 0 8px 2px rgba(255, 179, 0, .8); }
 79  
 80  .face-label {
 81    pointer-events: none; text-align: center; line-height: 1.1;
 82    font-size: calc(var(--cs) * .26); font-weight: 700; user-select: none;
 83  }
 84  .face-label b { display: block; font-size: calc(var(--cs) * .34); }
 85  .face-label i { display: block; font-style: normal; font-size: calc(var(--cs) * .2); opacity: .85; }
 86  /* D-20：U 面（頂面）用 rotateX(90deg) 折起，在固定基準視角（baseViewDeg x:-22°）下
 87     會讓標籤文字明顯歪斜（見 docs/reports/T-001-arch-decisions.md D-20）。基準視角是常數，
 88     所以用固定角度的 2D 反向旋轉即可讓文字保持從目前視角可讀；此值僅對應 baseViewDeg，
 89     若日後改動基準視角需要重新用截圖核對（見 T-001-S8e 回報）。其餘五面（F／R／D／L／B）
 90     在目前視角下皆可讀，不需要此修正。 */
 91  .f-U .face-label { transform: rotate(-25deg); }
 92  
 93  .turn-wrapper { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-style: preserve-3d; }
 94  
 95  /* D-18：提示浮層原本固定貼在 .cube-scene 內的右上角、寬度可達 78vw，手機直向時
 96     方塊區本來就矮（學習面板抽屜預設展開就占掉畫面 56vh），會整個蓋住方塊與層高亮
 97     （見 docs/reports/T-001-arch-decisions.md D-18）。改成：手機直向（本區塊，行動裝置
 98     優先）時 .hint-slot 是方塊區與操作列之間的一般文件流（index.template.html 已把它
 99     搬出 .cube-scene，改放在方塊區下緣、操作列上方），完全不會與方塊重疊，沒有提示時
100     內容清空、高度歸零，不佔版面；iPad 橫向（見下方 @media landscape）改回貼在方塊右上角
101     的浮層，維持原本設計（iPad 空間充裕，右上角浮層本來就沒有蓋住方塊的問題）。 */
102  .hint-slot {
103    flex: 0 0 auto; display: flex; justify-content: center; padding: 0 4%;
104    pointer-events: none;
105  }
106  .hint-slot > * { pointer-events: auto; margin: 4px 0; }
107  
108  .scramble-line {
109    flex: 0 0 auto; padding: 4px 14px; font-size: 12px; color: #555; line-height: 1.5;
110  }
111  .scramble-note { color: #999; }
112  
113  /* ---- 操作列 ---- */
114  .controlbar { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 12px; border-top: 1px solid #eee; }
115  .ctl {
116    min-width: 44px; min-height: 44px; padding: 0 12px; border-radius: 10px;
117    border: 1.5px solid #333; background: #fff; color: #111; font-size: 13.5px;
118  }
119  .ctl:disabled { opacity: .4; }
120  .ctl.accent { border-color: #0a6cff; color: #fff; background: #0a6cff; }
121  .slot-inline { display: inline-flex; }
122  
123  /* D-20：手機 390 寬時操作列（打亂／撤銷／重做／重設／提示／看電腦解，共 6 個控制項）
124     要一行放下，不能換行壓縮方塊區。縮小間距與左右內距，同時保持 min-height:44px
125     （CLAUDE.md §3.4 觸控熱區下限不可退讓）。400px 以下才套用，iPad 橫向不受影響。 */
126  @media (max-width: 400px) {
127    .controlbar { gap: 4px; padding: 8px 8px; flex-wrap: nowrap; }
128    .controlbar .ctl { padding: 0 6px; font-size: 12px; letter-spacing: -0.2px; }
129  }
130  
131  /* ---- 學習面板／抽屜（版型 C；game-spec.md §11.1） ---- */
132  /* 手機直向：一般文件流的抽屜，收合時只剩手把列（max-height 限制＋overflow hidden，
133     不使用 position:absolute／fixed，避免蓋住方塊區，見 decision-log 備註 3）。 */
134  .drawer {
135    flex: 0 0 auto; display: flex; flex-direction: column; min-height: 0; background: #fafbfc;
136    max-height: 30vh; overflow: hidden; transition: max-height .25s ease;
137  }
138  .drawer.expanded { max-height: 56vh; }
139  .drawer.expanded .cpanel { overflow-y: auto; }
140  .drawer:not(.expanded) .ctabs,
141  .drawer:not(.expanded) .cpanel { display: none; }
142  .drawer-handle { display: flex; align-items: stretch; min-height: 44px; border-top: 1px solid #e2e2e2; }
143  .handle-tap {
144    flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
145    min-height: 44px; cursor: pointer;
146  }
147  .handle-tap .drawer-label { font-size: 12px; color: #888; }
148  .handle-tap .bar { width: 40px; height: 5px; border-radius: 3px; background: #ccc; margin-top: 4px; }
149  .handle-tools { display: flex; align-items: center; gap: 8px; padding: 0 10px; }
150  
151  .switch {
152    min-height: 44px; min-width: 44px; padding: 0 12px; border-radius: 999px;
153    border: 1.5px solid #999; background: #fff; color: #555; font-size: 13px;
154  }
155  .switch[aria-checked="true"] { border-color: #0a6cff; color: #0a6cff; background: #eef3ff; font-weight: 700; }
156  
157  .ctabs { display: flex; gap: 8px; padding: 8px 12px 0; }
158  .ctab { flex: 1; min-height: 44px; border-radius: 10px; border: 1.5px solid #333; background: #fff; color: #111; font-size: 13.5px; }
159  .ctab.on { background: #111; color: #fff; }
160  
161  .cpanel { flex: 1 1 auto; overflow-y: auto; padding: 10px 12px 16px; min-height: 0; }
162  
163  .lesson-card {
164    position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: #fff;
165    padding: 14px 16px; overflow-y: auto; z-index: 3;
166  }
167  
168  /* ---- 記號鍵盤（game-spec.md §11.2） ---- */
169  .keypad { display: flex; flex-direction: column; gap: 10px; }
170  .kp-group { display: flex; flex-direction: column; }
171  .kp-caption { font-size: 12px; color: #777; margin-bottom: 4px; }
172  .kp-caption-toggle {
173    align-self: flex-start; min-height: 44px; padding: 0 10px; border-radius: 8px;
174    border: 1px solid #ccc; background: #f5f5f5; color: #555; font-size: 12px;
175  }
176  .kp-rows { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
177  .kp-row { display: flex; gap: 6px; }
178  .kp {
179    flex: 1; min-width: 44px; min-height: 44px; border-radius: 9px;
180    border: 1.5px solid #333; background: #fafafa; color: #111;
181    display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.15;
182  }
183  .kp-move { font-size: 15px; font-weight: 700; }
184  .kp-sub { font-size: 10px; color: #666; }
185  .kp.kp-mid { background: #eef3ff; border-color: #0a6cff; color: #0a3b8f; }
186  .kp.kp-rot { background: #f2f2f2; border-style: dashed; border-color: #999; color: #555; }
187  
188  /* ---- 插槽用容器 ---- */
189  .slot-block { margin-bottom: 10px; }
190  .overlay-root:empty { display: none; }
191  
192  /* ---- 版面切換：橫向（iPad）左右兩欄；直向（手機）抽屜 ---- */
193  @media (orientation: landscape) {
194    .shell { flex-direction: row; }
195    .leftcol { flex: 1 1 60%; min-width: 0; position: relative; }
196    /* D-18：iPad 橫向維持原本「貼在方塊右上角」的浮層設計（相對 .leftcol 定位，
197       視覺上落在方塊區右上角一帶；iPad 空間充裕，量測結果無重疊）。 */
198    .hint-slot {
199      position: absolute; right: 6%; top: 10%; left: auto; z-index: 5;
200      padding: 0; justify-content: flex-end;
201    }
202    .hint-slot > * { margin: 0; }
203    /* 幕僚長修正（2026-09-15）：橫向時抽屜固定展開、占滿整欄高度，只讓 .cpanel 捲動；
204       原本 .drawer.expanded 的 56vh 上限在橫向仍生效，面板被截在半高。 */
205    .drawer, .drawer.expanded {
206      flex: 1 1 40%; max-height: none; overflow: hidden;
207      border-left: 1px solid #e2e2e2; background: #fafbfc;
208    }
209    .drawer .handle-tap { display: none; }
210    .drawer .ctabs, .drawer:not(.expanded) .ctabs { display: flex; }
211    .drawer .cpanel, .drawer:not(.expanded) .cpanel { display: block; overflow-y: auto; }
212  }
213  
214  /* 幕僚長修正 D-18b（2026-09-15）：手機直向時方塊區保底高度，不被提示卡與抽屜擠扁；
215     改由抽屜讓出空間（抽屜可縮、內容區自行捲動）。橫向維持原本兩欄版面。 */
216  @media (orientation: portrait) {
217    .leftcol { flex: 1 0 auto; }
218    .cube-scene { flex: 1 0 auto; min-height: 210px; overflow: hidden; }
219    .drawer, .drawer.expanded { flex: 0 1 auto; }
220  }
```

## 4. 測試清單（全部批次共用）

| 測試檔 | 測試編號 | 最近一次結果 |
|---|---|---|
| `tests/engine/build.test.js` | T-BUILD-01、T-BUILD-02、T-BUILD-03 | 通過 |
| `tests/engine/cube.test.js` | T-ENG-01、T-ENG-02、T-ENG-03、T-ENG-04、T-ENG-05、T-ENG-06、T-ENG-07、T-ENG-08、T-ENG-09、T-ENG-10、T-ENG-25、T-ENG-28 | 通過 |
| `tests/engine/data.test.js` | T-DATA-01、T-DATA-02、T-DATA-03、T-DATA-04、T-DATA-05、T-DATA-06、T-DATA-07、T-DATA-08、T-DATA-09、T-DATA-10、T-UI-03 | 通過 |
| `tests/engine/forbidden.test.js` | T-ENG-24 | 通過 |
| `tests/engine/invariants.test.js` | T-ENG-12、T-ENG-14 | 通過 |
| `tests/engine/notation.test.js` | T-DATA-07 | 通過 |
| `tests/engine/reducer.test.js` | T-ENG-13、T-ENG-15、T-ENG-16、T-ENG-17、T-ENG-18、T-ENG-19、T-ENG-20、T-ENG-21、T-ENG-22、T-ENG-23、T-ENG-26、T-ENG-27 | 通過 |
| `tests/engine/scramble.test.js` | T-ENG-11 | 通過 |
| `tests/engine/ui-logic.test.js` | T-UI-29、T-UI-30 | 通過 |
| `tests/engine/solver/client.test.js` | solver-client 情境測試（C-01～C-13） | 通過 |
| `tests/engine/solver/lbl.test.js` | T-LBL-01、T-LBL-02、T-LBL-03、T-LBL-04、T-LBL-05、T-LBL-06、T-LBL-07、T-LBL-08、T-LBL-09、T-LBL-10 | 通過 |
| `tests/engine/solver/twophase.test.js` | T-ENG-05、T-SOL-01、T-SOL-02、T-SOL-03、T-SOL-04、T-SOL-05、T-SOL-06、T-SOL-07、T-SOL-08、T-SOL-09、T-SOL-10 | 通過 |
| `tests/engine/solver/worker.test.js` | T-SOL-08 | 通過 |
| `tests/ui/smoke.spec.js`（含 checks.js、checks2.js、checks3.js） | T-UI-01、T-UI-02、T-UI-03、T-UI-04、T-UI-05、T-UI-06、T-UI-07、T-UI-08、T-UI-09、T-UI-10、T-UI-11、T-UI-12、T-UI-13、T-UI-14、T-UI-15、T-UI-16、T-UI-17、T-UI-18、T-UI-19、T-UI-20、T-UI-21、T-UI-22、T-UI-23、T-UI-24、T-UI-25、T-UI-26、T-UI-27、T-UI-28（手機 390×844 與 iPad 1194×834 各跑一次） | 通過 |

測試指令：`node --test "tests/engine/**/*.test.js"`、`node build/bundle.js`、`node tests/ui/smoke.spec.js`；輸出摘要（2026-09-15）：

```
# pass 89
# fail 0
（engine，約 3 分 17 秒）
build 完成：index.html（371508 bytes；Worker 字串 84029 bytes；零外部資源）
T-UI-01～T-UI-28：[phone=PASS] [ipad=PASS]；全部通過。（UI，約 4 分 37 秒）
```

測試編號的定義在規格書（未附）；看不懂測試在驗什麼時，請列入「疑似」並說明需要什麼資訊。

## 5. 已知問題（不必重複回報）

| # | 來源 | 內容 | 目前處置 |
|---|---|---|---|
| 1 | 內部審查 | `src/ui/cube-view.js`、`notation.js`、`gesture.js`、`controls.js` 各自維護旋轉軸與轉向判斷，與 `src/engine/cube.js` 的定義重複；目前只影響動畫方向與鍵盤分組，最終狀態以 engine 為準 | 下版修 |
| 2 | 內部審查 | `src/ui/tutorial.js`、`records.js` 直接使用全域 `document`／`window`，未使用注入的文件物件 | 下版修 |
| 3 | 內部審查 | 部分固定符號（`<title>`、`?`、`×`、`✓`、全形括號）寫在程式或樣板中，未放進 `texts.json`；`texts.json`／`params.json` 有少數未使用的鍵 | 下版修 |
| 4 | 內部審查 | `src/solver/twophase.js` 的註解與一個內部錯誤訊息含「最少步」「最佳解」字樣（不會顯示在畫面上） | 刻意不處理 |
| 5 | 工程師回報 | 第一步轉動動畫進行中，「撤銷」鍵仍是停用狀態 | 待真機觀察 |
| 6 | 工程師回報 | 帶時間戳的 action 未檢查 `at` 是否為有效數字 | 下版修 |
| 7 | 尚未驗證 | iPad Safari 實機的 CSS 3D 顯示、Blob Worker 建立與建表時間（桌機 Chromium 約 1.2–1.4 秒） | 待真機測 |
| 8 | 尚未驗證 | 手勢手感（方向判定門檻 30°、最小滑動距離）尚未真人測試 | 待真機測 |

## 6. 請用這個格式回覆

**bug 清單**

| 編號 | 嚴重度 | 檔案:行號 | 問題（一句話） | 失敗情境 | 建議修法（方向） |
|---|---|---|---|---|---|
| E-1 | | | | | |

**疑似清單**（沒有重現步驟、或不確定是否為問題）

| 編號 | 檔案:行號 | 疑點 | 需要什麼資訊才能確認 |
|---|---|---|---|
| S-1 | | | |

**架構原則對照**：五條各寫「符合／違反（編號＋位置）／無法判斷」。

---

<多批時加：本批為第 n／N 批。若某問題需要其他批次的檔案才能確認，請在建議修法欄標「需跨批確認」。>
