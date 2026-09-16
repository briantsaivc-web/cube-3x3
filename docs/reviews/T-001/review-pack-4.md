# 審查包：T-001 魔術方塊 v0.1（第 4／4 批：UI 學習功能（示範播放器、提示、首次教學、完成畫面）與打包腳本）

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

**本批是第 4／4 批，其他批次的檔案不在這裡，若問題牽涉其他批次，請在「疑似」清單註明。**

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
- 本批檔案在整體中的角色：demo-player.js 是「建議解示範／層先法示範」播放器（分段暫停卡片、白話說明）；hint-view.js 是提示；tutorial.js 是首次教學與「記號小教室」；records.js 是完成畫面與本機最佳紀錄；build/bundle.js 把 src/ 打包成單一 index.html 並產生 Worker 字串。
- 四批的檔案分配：第 1 批 `src/engine/rng.js`、`src/engine/cube.js`、`src/engine/scramble.js`、`src/engine/selectors.js`、`src/engine/reducer.js`、`src/engine/index.js`、`src/data/texts.json`、`src/data/palette.json`、`src/data/params.json`、`src/data/lbl.json`；第 2 批 `src/solver/twophase.js`、`src/solver/lbl.js`、`src/solver/worker.js`；第 3 批 `src/ui/app.js`、`src/ui/controls.js`、`src/ui/gesture.js`、`src/ui/cube-view.js`、`src/ui/notation.js`、`src/ui/solver-client.js`、`src/ui/index.template.html`、`src/ui/styles.css`；第 4 批 `src/ui/demo-player.js`、`src/ui/hint-view.js`、`src/ui/tutorial.js`、`src/ui/records.js`、`src/ui/demo.css`、`src/ui/overlay.css`、`build/bundle.js`。

## 3. 變更檔案的完整程式碼（有行號，全部為新增檔案）

本批包含：`src/ui/demo-player.js`、`src/ui/hint-view.js`、`src/ui/tutorial.js`、`src/ui/records.js`、`src/ui/demo.css`、`src/ui/overlay.css`、`build/bundle.js`。

### 3.1 `src/ui/demo-player.js`（新增，629 行）

```js
  1  // src/ui/demo-player.js — 示範分頁與播放器（game-spec.md §9.1、§8、§2.3、§2.4）
  2  //
  3  // 依分派單 T-001 S8c 輸出契約：兩顆示範種類按鈕、播放器（播放/暫停/單步/速度/離開）、
  4  // 記號列＋白話說明＋層高亮、層先法 8 段清單與分段暫停卡片（修訂 R-2e）。
  5  // 本檔只呼叫 ctx.solver.requestDemo／cancel／status（X-9），不自行實作快取或退回；
  6  // D-15：DEMO_EXIT 後切回「操作」分頁由本檔負責（透過 ctx.panel）。
  7  // S11／B-1：失敗碼→文案鍵改呼叫 ctx.solver.failureTextKey（D-19 已刪除 hint-view.js 的
  8  // mapFailureCode）；求解結果一律「先 dispatch、再做畫面副作用」，副作用包 try/catch，
  9  // 單一 UI 錯誤不會讓 state.demo 永遠停在等待中。
 10  // S11／D-26：上一步／下一步／分段跳轉／自動播放一律排入 ctx.input 的輸入佇列（與記號鍵同一機制），
 11  // 動畫中按下不再被丟棄；取出時才依「當下」的 demo 進度決定要播哪個記號。
 12  'use strict';
 13  
 14  var hintView = require('./hint-view.js'); // 只借用其中的純函式 textByKey，同屬 S8c。
 15  
 16  function nowMs() {
 17    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
 18    return Date.now();
 19  }
 20  
 21  // D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
 22  function numOr(v, dflt) {
 23    return (typeof v === 'number' && isFinite(v)) ? v : dflt;
 24  }
 25  
 26  function formatAlg(alg, engine) {
 27    return alg.split(' ').map(function (m) { return engine.formatMove(m); }).join(' ');
 28  }
 29  
 30  var SPEED_LABEL_KEY = { slow: 'speedSlow', mid: 'speedMid', fast: 'speedFast' };
 31  
 32  function mount(ctx) {
 33    var doc = ctx.root.ownerDocument || document;
 34    var engine = ctx.engine;
 35    var notation = ctx.notation;
 36    var texts = ctx.data.texts;
 37    var params = ctx.data.params;
 38    var lbl = ctx.data.lbl;
 39    var lblTexts = texts.lbl;
 40  
 41    var container = doc.createElement('div');
 42    container.className = 'demo-root';
 43    ctx.slot('demo').appendChild(container);
 44  
 45    // ---- 本地 UI 狀態（不進 engine state，X-3） ----
 46    var speedIndex = 0;
 47    (function initSpeedIndex() {
 48      var speeds = (params.demo && params.demo.speeds) || [];
 49      var def = params.demo && params.demo.defaultSpeed;
 50      for (var i = 0; i < speeds.length; i++) {
 51        if (speeds[i].id === def) { speedIndex = i; return; }
 52      }
 53    })();
 54    var playing = false;
 55    var playTimer = null;
 56    var pauseCard = null; // {doneId, nextId}（修訂 R-2e，純 UI 狀態，不送 action、不改 demo）
 57    var demoFailureMsg = null;
 58    var demoFailureTimer = null;
 59    var highlighting = false;
 60    var wasDemoActive = false;
 61    var wasDemoReady = false; // 上一次 render 時示範已就緒（不是等待中）
 62    var pendingScrollChip = null;
 63  
 64    function currentSpeedMs() {
 65      var speeds = (params.demo && params.demo.speeds) || [{ stepMs: 500 }];
 66      return (speeds[speedIndex] || speeds[0]).stepMs;
 67    }
 68    function animMs() {
 69      return currentSpeedMs() * numOr(params.demo && params.demo.animRatio, 0.8);
 70    }
 71  
 72    function showDemoFailure(key) {
 73      demoFailureMsg = key;
 74      if (demoFailureTimer) clearTimeout(demoFailureTimer);
 75      // D-25：顯示時間改由 params.ui.demoErrorShowMs 決定
 76      demoFailureTimer = setTimeout(function () { demoFailureMsg = null; render(); },
 77        numOr(params.ui && params.ui.demoErrorShowMs, 6000));
 78    }
 79    function clearDemoFailure() {
 80      demoFailureMsg = null;
 81      if (demoFailureTimer) { clearTimeout(demoFailureTimer); demoFailureTimer = null; }
 82    }
 83  
 84    // ---- 播放控制 ----
 85    function stopPlayingInternal() {
 86      if (!playing) return;
 87      playing = false;
 88      if (playTimer) { clearInterval(playTimer); playTimer = null; }
 89    }
 90    function stopPlaying() {
 91      stopPlayingInternal();
 92      render();
 93    }
 94    function startPlaying() {
 95      var state = ctx.getState();
 96      var info = engine.demoInfo(state);
 97      if (!info || info.cursor >= info.total) return;
 98      if (ctx.input.locked()) return;
 99      if (playing) return;
100      playing = true;
101      playTimer = setInterval(tick, currentSpeedMs());
102      render();
103    }
104    function setSpeed(idx) {
105      speedIndex = idx;
106      if (playing) {
107        clearInterval(playTimer);
108        playTimer = setInterval(tick, currentSpeedMs());
109      }
110      render();
111    }
112  
113    // 找出「本段完成」的分段暫停卡片是否要出現（修訂 R-2e；只在往前單步／自動播放後檢查，
114    // DEMO_SEEK 與「上一步」不觸發，見呼叫端）。
115    function maybeTriggerPauseCard(state) {
116      var segments = state.demo.segments;
117      if (!segments) return false;
118      var cursor = state.demo.cursor;
119      var doneIndex = -1;
120      for (var i = 0; i < segments.length; i++) {
121        if (segments[i].end === cursor && segments[i].end > segments[i].start) { doneIndex = i; break; }
122      }
123      if (doneIndex === -1) return false;
124      var nextSeg = null;
125      for (var j = doneIndex + 1; j < segments.length; j++) {
126        if (segments[j].end > segments[j].start) { nextSeg = segments[j]; break; }
127      }
128      if (!nextSeg) return false; // 最後一個非空段結束＝復原，改顯示完成畫面，不出現卡片
129      pauseCard = { doneId: segments[doneIndex].id, nextId: nextSeg.id };
130      return true;
131    }
132  
133    // D-26：往前一步（排入輸入佇列）。取出時才讀「當下」的下一個記號來播動畫；
134    // onDone(result) 在送出（或作廢）後呼叫，result = {dispatched, reachedEnd, pauseCard}。
135    function enqueueStepForward(opts, onDone) {
136      return ctx.input.enqueue({
137        build: function () { return { type: 'DEMO_STEP', payload: { delta: 1, at: nowMs() } }; },
138        animate: function () {
139          var info = engine.demoInfo(ctx.getState());
140          var ms = animMs();
141          return info.nextIsRotation ? ctx.anim.rotate(info.nextToken, ms) : ctx.anim.turn(info.nextToken, ms);
142        },
143        after: function (dispatched) {
144          var result = { dispatched: dispatched, reachedEnd: false, pauseCard: false };
145          if (dispatched) {
146            var newState = ctx.getState();
147            var newInfo = engine.demoInfo(newState);
148            result.reachedEnd = !newInfo || newInfo.cursor >= newInfo.total;
149            if (opts.allowPauseCard && !result.reachedEnd && newState.demo && newState.demo.kind === 'lbl' &&
150                params.demo && params.demo.pauseAtSegmentEnd) {
151              result.pauseCard = maybeTriggerPauseCard(newState);
152            }
153          }
154          if (onDone) onDone(result);
155        }
156      });
157    }
158  
159    function enqueueStepBack() {
160      return ctx.input.enqueue({
161        build: function () { return { type: 'DEMO_STEP', payload: { delta: -1, at: nowMs() } }; },
162        animate: function () {
163          var state = ctx.getState();
164          var token = state.demo.tokens[state.demo.cursor - 1];
165          var inv = engine.inverse(token);
166          var ms = animMs();
167          return engine.kind(token) === 'rotation' ? ctx.anim.rotate(inv, ms) : ctx.anim.turn(inv, ms);
168        },
169        after: function () { render(); }
170      });
171    }
172  
173    function tick() {
174      if (ctx.input.locked()) { stopPlaying(); return; }
175      // 上一步還在播或還有排隊中的輸入：跳過這一拍（stepMs > 動畫時間，正常不會發生）
176      if (!ctx.input.idle()) return;
177      enqueueStepForward({ allowPauseCard: true }, function (result) {
178        if (!playing) { render(); return; }
179        if (!result.dispatched || result.reachedEnd || result.pauseCard) stopPlaying();
180        else render();
181      });
182    }
183  
184    function onPlayPauseClick() {
185      if (pauseCard) { pauseCard = null; startPlaying(); return; }
186      if (playing) stopPlaying(); else startPlaying();
187    }
188  
189    // 單步前進／後退：D-26 之後動畫中按下會排隊（佇列取出時重檢 canApply），不再丟棄。
190    // 「下一步」依規格 §9.1／R-2e 可能觸發分段暫停卡片（與原本行為相同）。
191    function onStepForward() {
192      pauseCard = null; // 卡片顯示中按「下一步」→卡片消失並單步
193      if (playing) stopPlayingInternal();
194      if (ctx.input.locked()) { render(); return; }
195      enqueueStepForward({ allowPauseCard: true }, function () { render(); });
196      render();
197    }
198  
199    function onStepBack() {
200      pauseCard = null; // 按「上一步」→卡片消失，且不觸發新卡片
201      if (playing) stopPlayingInternal();
202      if (ctx.input.locked()) { render(); return; }
203      enqueueStepBack();
204      render();
205    }
206  
207    function onSeek(target) {
208      pauseCard = null; // 點分段清單→卡片消失，不觸發新卡片
209      if (playing) stopPlayingInternal();
210      if (ctx.input.locked()) { render(); return; }
211      // 分段跳轉沒有動畫，但一樣排隊，確保在前面已排入的單步之後才執行（D-26）
212      ctx.input.enqueue({
213        build: function () { return { type: 'DEMO_SEEK', payload: { cursor: target, at: nowMs() } }; },
214        animate: function () { return null; },
215        after: function () { render(); }
216      });
217      render();
218    }
219  
220    function onExit() {
221      pauseCard = null;
222      stopPlayingInternal();
223      var state = ctx.getState();
224      var action = { type: 'DEMO_EXIT', payload: { at: nowMs() } };
225      if (!engine.canApply(state, action, ctx.data)) { render(); return; }
226      ctx.dispatch(action); // render() 會在 ctx.subscribe 觸發，並在其中偵測 demo→null 切回操作分頁（D-15）
227    }
228  
229    function canRequestKind(state, kind) {
230      if (state.demo === null) {
231        return engine.canApply(state, { type: 'DEMO_REQUEST', payload: { kind: kind, at: 0 } }, ctx.data);
232      }
233      if (state.demo.kind === kind) return true; // 目前種類本身一律視為可用（顯示為選取狀態）
234      return state.status !== 'solved'; // 已復原時不可切換種類
235    }
236  
237    function requestDemoKind(kind) {
238      var state = ctx.getState();
239      var action = { type: 'DEMO_REQUEST', payload: { kind: kind, at: nowMs() } };
240      if (!engine.canApply(state, action, ctx.data)) return;
241      ctx.dispatch(action);
242      // §11.1：DEMO_REQUEST 被送出→切到示範分頁（手機同時展開抽屜）。
243      ctx.panel.selectTab('demo');
244      ctx.panel.expand(true);
245      var newState = ctx.getState(); // 用「新的」state 呼叫 requestDemo（同 D-12 的精神）
246      ctx.solver.requestDemo(newState, kind).then(function (resultAction) {
247        // S11／B-1：先送出結果（DEMO_READY／DEMO_FAILED），確保 state.demo 一定離開等待中；
248        // 之後的畫面副作用（失敗訊息、重畫）即使出錯也不影響 state。
249        ctx.dispatch(resultAction);
250        try {
251          if (resultAction && resultAction.type === 'DEMO_FAILED') {
252            var code = resultAction.payload && resultAction.payload.code;
253            var key = ctx.solver.failureTextKey(code);
254            if (key) showDemoFailure(key);
255          }
256        } finally {
257          render();
258        }
259      });
260      render();
261    }
262  
263    function onPickKind(kind) {
264      pauseCard = null;
265      if (playing) stopPlayingInternal();
266      var state = ctx.getState();
267      if (state.demo !== null) {
268        if (state.demo.kind === kind) return; // 已經是這個種類，不做事
269        if (!canRequestKind(state, kind)) return; // 已復原時不可切換（X-16／9.1）
270        var exitAction = { type: 'DEMO_EXIT', payload: { at: nowMs() } };
271        if (!engine.canApply(state, exitAction, ctx.data)) return;
272        ctx.dispatch(exitAction); // 依序送 DEMO_EXIT、DEMO_REQUEST{kind}（從目前進度重新求解）
273      }
274      clearDemoFailure();
275      requestDemoKind(kind);
276    }
277  
278    // ---- render：各種畫面片段 ----
279  
280    function buildKindRow(state, status) {
281      var row = doc.createElement('div');
282      row.className = 'demo-kind-row';
283      var curKind = state.demo ? state.demo.kind : null;
284  
285      var suggestBtn = doc.createElement('button');
286      suggestBtn.type = 'button';
287      suggestBtn.className = 'ctl demo-kind-btn';
288      suggestBtn.textContent = texts.buttons.demoSuggest;
289      suggestBtn.classList.toggle('on', curKind === 'suggest');
290      suggestBtn.disabled = status.state === 'failed' || !canRequestKind(state, 'suggest');
291      suggestBtn.addEventListener('click', function () { onPickKind('suggest'); });
292  
293      var lblBtn = doc.createElement('button');
294      lblBtn.type = 'button';
295      lblBtn.className = 'ctl demo-kind-btn';
296      lblBtn.textContent = texts.buttons.demoLbl;
297      lblBtn.classList.toggle('on', curKind === 'lbl');
298      lblBtn.disabled = !canRequestKind(state, 'lbl');
299      lblBtn.addEventListener('click', function () { onPickKind('lbl'); });
300  
301      row.appendChild(suggestBtn);
302      row.appendChild(lblBtn);
303      return row;
304    }
305  
306    function buildWaitCard(status, defaultText) {
307      var waitText = defaultText;
308      if (status.state === 'building') waitText = texts.solver.preparing;
309      if (status.state === 'mainThread' && status.notice) waitText = texts.solver.mainThreadNotice;
310  
311      var card = doc.createElement('div');
312      card.className = 'wait-card';
313      var msg = doc.createElement('div');
314      msg.className = 'wait-msg';
315      msg.textContent = waitText;
316      card.appendChild(msg);
317  
318      if (status.state === 'building') {
319        var bar = doc.createElement('div');
320        bar.className = 'progress-bar';
321        var fill = doc.createElement('div');
322        fill.className = 'progress-fill';
323        fill.style.width = (status.total ? Math.round((status.step / status.total) * 100) : 0) + '%';
324        bar.appendChild(fill);
325        card.appendChild(bar);
326      }
327  
328      var cancelBtn = doc.createElement('button');
329      cancelBtn.type = 'button';
330      cancelBtn.className = 'ctl';
331      cancelBtn.textContent = texts.buttons.cancel;
332      cancelBtn.addEventListener('click', function () { ctx.solver.cancel(); });
333      card.appendChild(cancelBtn);
334      return card;
335    }
336  
337    function buildPauseCard() {
338      var doneName = (lblTexts[pauseCard.doneId] && lblTexts[pauseCard.doneId].name) || pauseCard.doneId;
339      var nextEntry = lblTexts[pauseCard.nextId] || { name: pauseCard.nextId, desc: '' };
340      var nextComposed = notation.fillTemplate(texts.demo.segmentNext, { name: nextEntry.name, desc: nextEntry.desc });
341      var msgText = notation.fillTemplate(texts.demo.segmentDone, { done: doneName, next: nextComposed });
342  
343      var card = doc.createElement('div');
344      card.className = 'pause-card';
345      var p = doc.createElement('div');
346      p.className = 'pause-msg';
347      p.textContent = msgText;
348      card.appendChild(p);
349      var contBtn = doc.createElement('button');
350      contBtn.type = 'button';
351      contBtn.className = 'ctl accent';
352      contBtn.textContent = texts.buttons.continue;
353      contBtn.addEventListener('click', function () { pauseCard = null; startPlaying(); });
354      card.appendChild(contBtn);
355      return card;
356    }
357  
358    function buildControlsRow(info) {
359      var row = doc.createElement('div');
360      row.className = 'demo-controls';
361  
362      var btnBack = doc.createElement('button');
363      btnBack.type = 'button'; btnBack.className = 'ctl';
364      btnBack.textContent = texts.buttons.stepBack;
365      btnBack.disabled = info.cursor <= 0;
366      btnBack.addEventListener('click', onStepBack);
367  
368      var btnPlay = doc.createElement('button');
369      btnPlay.type = 'button'; btnPlay.className = 'ctl accent';
370      btnPlay.textContent = playing ? texts.buttons.pause : texts.buttons.play;
371      btnPlay.disabled = !playing && info.cursor >= info.total;
372      btnPlay.addEventListener('click', onPlayPauseClick);
373  
374      var btnFwd = doc.createElement('button');
375      btnFwd.type = 'button'; btnFwd.className = 'ctl';
376      btnFwd.textContent = texts.buttons.stepForward;
377      btnFwd.disabled = info.cursor >= info.total;
378      btnFwd.addEventListener('click', onStepForward);
379  
380      var btnExit = doc.createElement('button');
381      btnExit.type = 'button'; btnExit.className = 'ctl';
382      btnExit.textContent = texts.buttons.exitDemo;
383      btnExit.addEventListener('click', onExit);
384  
385      row.appendChild(btnBack);
386      row.appendChild(btnPlay);
387      row.appendChild(btnFwd);
388      row.appendChild(btnExit);
389      return row;
390    }
391  
392    function buildSpeedRow() {
393      var row = doc.createElement('div');
394      row.className = 'demo-speed-row';
395      var speeds = (params.demo && params.demo.speeds) || [];
396      speeds.forEach(function (spd, idx) {
397        var btn = doc.createElement('button');
398        btn.type = 'button';
399        btn.className = 'ctl speed-btn';
400        btn.classList.toggle('on', idx === speedIndex);
401        btn.textContent = texts.buttons[SPEED_LABEL_KEY[spd.id]] || spd.id;
402        btn.addEventListener('click', function () { setSpeed(idx); });
403        row.appendChild(btn);
404      });
405      return row;
406    }
407  
408    function buildSegmentList(state, info) {
409      var wrap = doc.createElement('div');
410      wrap.className = 'segment-list';
411      state.demo.segments.forEach(function (seg, idx) {
412        var isEmpty = seg.start === seg.end;
413        var reached = state.demo.cursor >= seg.end;
414        var isCurrent = !isEmpty && idx === info.segmentIndex && !reached;
415        var isDone = !isEmpty && reached;
416  
417        var row = doc.createElement('div');
418        row.className = 'segment-row';
419        row.dataset.segmentId = seg.id;
420        row.tabIndex = 0;
421        row.setAttribute('role', 'button');
422  
423        var segTexts = lblTexts[seg.id] || { name: seg.id, desc: '' };
424        var nameEl = doc.createElement('div');
425        nameEl.className = 'seg-name';
426  
427        if (isEmpty) {
428          row.classList.add('skip');
429          nameEl.textContent = '✓ ' + segTexts.name;
430          row.appendChild(nameEl);
431          var skipNote = doc.createElement('div');
432          skipNote.className = 'seg-note';
433          skipNote.textContent = texts.demo.segmentSkipped;
434          row.appendChild(skipNote);
435        } else if (isDone) {
436          row.classList.add('done');
437          nameEl.textContent = '✓ ' + segTexts.name;
438          row.appendChild(nameEl);
439        } else if (isCurrent) {
440          row.classList.add('current');
441          nameEl.textContent = segTexts.name;
442          row.appendChild(nameEl);
443          var descEl = doc.createElement('div');
444          descEl.className = 'seg-desc';
445          descEl.textContent = segTexts.desc;
446          row.appendChild(descEl);
447          var stepsEl = doc.createElement('div');
448          stepsEl.className = 'seg-steps';
449          stepsEl.textContent = notation.fillTemplate(texts.demo.segmentSteps, { n: seg.qtm });
450          row.appendChild(stepsEl);
451  
452          if (info.partIndex >= 0) {
453            var part = seg.parts[info.partIndex];
454            if (part && part.kind === 'formula' && part.formula && lbl.formulas[part.formula]) {
455              var formula = lbl.formulas[part.formula];
456              var fBlock = doc.createElement('div');
457              fBlock.className = 'formula-block';
458              var fName = doc.createElement('div');
459              fName.className = 'formula-name';
460              fName.textContent = notation.fillTemplate(texts.demo.formula, {
461                name: formula.name,
462                alg: formatAlg(formula.alg, engine)
463              });
464              var fUse = doc.createElement('div');
465              fUse.className = 'formula-use';
466              fUse.textContent = notation.fillTemplate(texts.demo.formulaUse, { desc: formula.desc });
467              fBlock.appendChild(fName);
468              fBlock.appendChild(fUse);
469              row.appendChild(fBlock);
470            }
471          }
472        } else {
473          row.classList.add('future');
474          nameEl.textContent = segTexts.name;
475          row.appendChild(nameEl);
476        }
477  
478        row.addEventListener('click', function () { onSeek(seg.start); });
479        row.addEventListener('keydown', function (e) {
480          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeek(seg.start); }
481        });
482  
483        wrap.appendChild(row);
484      });
485      return wrap;
486    }
487  
488    function buildPlayer(state, info) {
489      var wrap = doc.createElement('div');
490      wrap.className = 'demo-player';
491  
492      var header = doc.createElement('div');
493      header.className = 'demo-header';
494      var titleTemplate = state.demo.kind === 'suggest' ? texts.demo.suggestTitle : texts.demo.lblTitle;
495      header.textContent = notation.fillTemplate(titleTemplate, { n: info.totalQtm });
496      wrap.appendChild(header);
497  
498      if (state.demo.kind === 'suggest') {
499        var note = doc.createElement('div');
500        note.className = 'demo-note demo-note-sub';
501        note.textContent = texts.demo.notShortest;
502        wrap.appendChild(note);
503      }
504  
505      var progress = doc.createElement('div');
506      progress.className = 'demo-progress';
507      progress.textContent = notation.fillTemplate(texts.demo.progress, { a: info.doneQtm, n: info.totalQtm });
508      wrap.appendChild(progress);
509  
510      if (info.cursor < info.total) {
511        var explain = doc.createElement('div');
512        explain.className = 'demo-explain';
513        explain.textContent = notation.explainMove(info.nextToken, texts, engine);
514        wrap.appendChild(explain);
515      }
516  
517      var scrollWrap = doc.createElement('div');
518      scrollWrap.className = 'token-scroll';
519      var tokenRow = doc.createElement('div');
520      tokenRow.className = 'token-row';
521      var nextChip = null;
522      state.demo.tokens.forEach(function (t, i) {
523        var chip = doc.createElement('div');
524        chip.className = 'token-chip';
525        if (i < info.cursor) chip.classList.add('done');
526        if (i === info.cursor) chip.classList.add('next');
527        var big = doc.createElement('div');
528        big.className = 'token-move';
529        big.textContent = engine.formatMove(t);
530        var small = doc.createElement('div');
531        small.className = 'token-step';
532        small.textContent = engine.kind(t) === 'rotation'
533          ? texts.demo.rotateLabel
534          : notation.fillTemplate(texts.demo.segmentSteps, { n: engine.qtmCost(t) });
535        chip.appendChild(big);
536        chip.appendChild(small);
537        tokenRow.appendChild(chip);
538        if (i === info.cursor) nextChip = chip;
539      });
540      scrollWrap.appendChild(tokenRow);
541      wrap.appendChild(scrollWrap);
542      pendingScrollChip = nextChip;
543  
544      if (pauseCard) wrap.appendChild(buildPauseCard());
545  
546      wrap.appendChild(buildControlsRow(info));
547      wrap.appendChild(buildSpeedRow());
548  
549      if (state.demo.kind === 'lbl') wrap.appendChild(buildSegmentList(state, info));
550  
551      return wrap;
552    }
553  
554    function render() {
555      var state = ctx.getState();
556      var status = ctx.solver.status();
557  
558      // demo 由非 null 變 null → 清高亮、清本地狀態；若先前示範已就緒（DEMO_EXIT、重設等）
559      // 才切回操作分頁（D-15）。S11：等待中被取消或求解失敗（DEMO_FAILED）時留在示範分頁，
560      // 否則失敗訊息與「改看層先法示範」會被藏在看不到的分頁裡（§9.6）。
561      var isDemoActive = state.demo !== null;
562      if (wasDemoActive && !isDemoActive) {
563        if (wasDemoReady) ctx.panel.selectTab('controls');
564        if (highlighting) { ctx.view.highlight([]); highlighting = false; }
565        pauseCard = null;
566        stopPlayingInternal();
567      }
568      wasDemoActive = isDemoActive;
569      wasDemoReady = isDemoActive && !state.demo.pending;
570  
571      container.innerHTML = '';
572      pendingScrollChip = null;
573      container.appendChild(buildKindRow(state, status));
574  
575      if (state.demo === null) {
576        var pick = doc.createElement('div');
577        pick.className = 'demo-pick';
578        var promptEl = doc.createElement('div');
579        promptEl.className = 'demo-note';
580        promptEl.textContent = texts.demo.pickPrompt;
581        pick.appendChild(promptEl);
582  
583        if (demoFailureMsg) {
584          var failCard = doc.createElement('div');
585          failCard.className = 'demo-note demo-error';
586          failCard.textContent = hintView.textByKey(texts, demoFailureMsg);
587          pick.appendChild(failCard);
588          if (demoFailureMsg === 'demo.suggestUnavailable') {
589            var tryBtn = doc.createElement('button');
590            tryBtn.type = 'button';
591            tryBtn.className = 'ctl';
592            tryBtn.textContent = texts.buttons.tryLbl;
593            tryBtn.addEventListener('click', function () { clearDemoFailure(); onPickKind('lbl'); });
594            pick.appendChild(tryBtn);
595          }
596        }
597        container.appendChild(pick);
598        if (highlighting) { ctx.view.highlight([]); highlighting = false; }
599        return;
600      }
601  
602      if (state.demo.pending) {
603        container.appendChild(buildWaitCard(status, texts.demo.solving));
604        if (highlighting) { ctx.view.highlight([]); highlighting = false; }
605        return;
606      }
607  
608      var info = engine.demoInfo(state);
609      container.appendChild(buildPlayer(state, info));
610      if (pendingScrollChip) {
611        pendingScrollChip.scrollIntoView({ block: 'nearest', inline: 'center' });
612        pendingScrollChip = null;
613      }
614  
615      if (info.cursor < info.total) {
616        ctx.view.highlight(engine.demoNextLayer(state));
617        highlighting = true;
618      } else if (highlighting) {
619        ctx.view.highlight([]);
620        highlighting = false;
621      }
622    }
623  
624    ctx.subscribe(render);
625    ctx.solver.onStatus(render);
626    render();
627  }
628  
629  module.exports = { mount: mount };
```

### 3.2 `src/ui/hint-view.js`（新增，207 行）

```js
  1  // src/ui/hint-view.js — 提示按鈕、提示浮層、求解器狀態（game-spec.md §9.4、§2.3、§2.4）
  2  //
  3  // 依分派單 T-001 S8c 輸出契約：
  4  //   - 「提示」按鈕掛進 hint-button 插槽（X-16：按鈕本身與行為屬 S8c）。
  5  //   - 提示浮層（記號、步數、剩餘步數、白話說明）掛進 hint 插槽，層高亮呼叫 ctx.view.highlight。
  6  //   - 求解器狀態（目前只有「failed」需要常駐顯示，見 game-spec.md §9.4 表）掛進 solver-status 插槽；
  7  //     等待中的文案／進度條顯示在提示卡片內（跟著 hint.pending 出現，而不是全域常駐）。
  8  // 本檔只呼叫 ctx.solver.requestHint／cancel／status（X-9），不自行實作快取或退回。
  9  // D-12：先 dispatch HINT_REQUEST，再用「新的」state 呼叫 requestHint（避免提示座標用錯 orient）。
 10  // D-19：失敗碼→文案鍵的對照改直接呼叫 ctx.solver.failureTextKey（app.js 已把
 11  // solver-client.js 的同名純函式轉傳上來），移除本檔原本複製的 mapFailureCode()，
 12  // 避免兩份對照表日後各自漂移（見 docs/reports/T-001-S8c.md「需要其他角色配合的事」）。
 13  'use strict';
 14  
 15  function nowMs() {
 16    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
 17    return Date.now();
 18  }
 19  
 20  // D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
 21  function numOr(v, dflt) {
 22    return (typeof v === 'number' && isFinite(v)) ? v : dflt;
 23  }
 24  
 25  function textByKey(texts, key) {
 26    var parts = key.split('.');
 27    var v = texts;
 28    for (var i = 0; i < parts.length; i++) {
 29      if (v == null) return '';
 30      v = v[parts[i]];
 31    }
 32    return v || '';
 33  }
 34  
 35  function mount(ctx) {
 36    var doc = ctx.root.ownerDocument || document;
 37    var engine = ctx.engine;
 38    var notation = ctx.notation;
 39    var texts = ctx.data.texts;
 40    var uiParams = (ctx.data.params && ctx.data.params.ui) || {};
 41  
 42    // ---- 「提示」按鈕（hint-button 插槽；X-16） ----
 43    var btnHint = doc.createElement('button');
 44    btnHint.type = 'button';
 45    btnHint.className = 'ctl';
 46    btnHint.textContent = texts.buttons.hint;
 47    ctx.slot('hint-button').appendChild(btnHint);
 48  
 49    function requestHint() {
 50      var state = ctx.getState();
 51      var action = { type: 'HINT_REQUEST', payload: { at: nowMs() } };
 52      if (!engine.canApply(state, action, ctx.data)) return;
 53      ctx.dispatch(action); // D-12：先 dispatch
 54      var newState = ctx.getState(); // 再用新 state 呼叫 requestHint
 55      ctx.solver.requestHint(newState).then(function (resultAction) {
 56        if (resultAction && resultAction.type === 'HINT_FAILED') {
 57          var code = resultAction.payload && resultAction.payload.code;
 58          var key = ctx.solver.failureTextKey(code);
 59          if (key) showFailure(key);
 60        }
 61        ctx.dispatch(resultAction);
 62        render();
 63      });
 64      render();
 65    }
 66  
 67    btnHint.addEventListener('click', function () {
 68      // D-26：還有排隊中的輸入或動畫時不送提示（提示要以「目前畫面」的局面求解）。
 69      if (ctx.input.locked() || !ctx.input.idle()) return;
 70      requestHint();
 71    });
 72  
 73    // ---- 短暫的失敗訊息（UI 自己的狀態；hint 清空後仍要讓玩家看得到原因幾秒） ----
 74    var failureMsg = null;
 75    var failureTimer = null;
 76    function showFailure(key) {
 77      failureMsg = key;
 78      if (failureTimer) clearTimeout(failureTimer);
 79      failureTimer = setTimeout(function () {
 80        failureMsg = null;
 81        render();
 82      }, numOr(uiParams.hintErrorShowMs, 4000)); // D-25：顯示時間改由 params.ui.hintErrorShowMs 決定
 83    }
 84  
 85    // ---- 高亮：只在「我自己設過」的情況下才清除，避免跟 demo-player 互相覆蓋 ----
 86    var highlighting = false;
 87  
 88    // ---- render ----
 89    var hintSlotEl = ctx.slot('hint');
 90    var solverStatusEl = ctx.slot('solver-status');
 91  
 92    function render() {
 93      var state = ctx.getState();
 94      var hint = state.hint;
 95      var status = ctx.solver.status();
 96  
 97      btnHint.disabled = !engine.canApply(state, { type: 'HINT_REQUEST', payload: { at: nowMs() } }, ctx.data);
 98  
 99      // ---- solver-status 插槽：依 §9.4 表，只有 failed 需要常駐顯示 ----
100      solverStatusEl.innerHTML = '';
101      if (status.state === 'failed') {
102        var notice = doc.createElement('div');
103        notice.className = 'solver-notice';
104        notice.textContent = texts.solver.failed;
105        solverStatusEl.appendChild(notice);
106      }
107  
108      // ---- hint 插槽 ----
109      hintSlotEl.innerHTML = '';
110  
111      if (hint && hint.pending) {
112        var waitText = texts.hint.solving;
113        if (status.state === 'building') waitText = texts.solver.preparing;
114        if (status.state === 'mainThread' && status.notice) waitText = texts.solver.mainThreadNotice;
115  
116        var waitCard = doc.createElement('div');
117        waitCard.className = 'wait-card';
118        var msg = doc.createElement('div');
119        msg.className = 'wait-msg';
120        msg.textContent = waitText;
121        waitCard.appendChild(msg);
122  
123        if (status.state === 'building') {
124          var bar = doc.createElement('div');
125          bar.className = 'progress-bar';
126          var fill = doc.createElement('div');
127          fill.className = 'progress-fill';
128          fill.style.width = (status.total ? Math.round((status.step / status.total) * 100) : 0) + '%';
129          bar.appendChild(fill);
130          waitCard.appendChild(bar);
131        }
132  
133        var cancelBtn = doc.createElement('button');
134        cancelBtn.type = 'button';
135        cancelBtn.className = 'ctl';
136        cancelBtn.textContent = texts.buttons.cancel;
137        cancelBtn.addEventListener('click', function () { ctx.solver.cancel(); });
138        waitCard.appendChild(cancelBtn);
139  
140        hintSlotEl.appendChild(waitCard);
141  
142        if (highlighting) { ctx.view.highlight([]); highlighting = false; }
143      } else if (hint && hint.pending === false) {
144        var hv = engine.hintView(state);
145        var card = doc.createElement('div');
146        card.className = 'hint-card';
147  
148        var closeBtn = doc.createElement('button');
149        closeBtn.type = 'button';
150        closeBtn.className = 'hint-close';
151        closeBtn.setAttribute('aria-label', texts.buttons.cancel);
152        closeBtn.textContent = '×';
153        closeBtn.addEventListener('click', function () {
154          var clearAction = { type: 'HINT_CLEAR', payload: {} };
155          if (engine.canApply(ctx.getState(), clearAction, ctx.data)) ctx.dispatch(clearAction);
156        });
157        card.appendChild(closeBtn);
158  
159        var moveLine = doc.createElement('div');
160        moveLine.className = 'hint-move';
161        var moveText = notation.fillTemplate(texts.hint.move, { move: engine.formatMove(hv.move), qtm: hv.qtm });
162        if (hv.source === 'suggest' && hv.planQtm !== null && hv.planQtm !== undefined) {
163          moveText += ' · ' + notation.fillTemplate(texts.hint.plan, { n: hv.planQtm });
164        }
165        moveLine.textContent = moveText;
166        card.appendChild(moveLine);
167  
168        var explainLine = doc.createElement('div');
169        explainLine.className = 'hint-explain';
170        explainLine.textContent = notation.explainMove(hv.move, texts, engine);
171        card.appendChild(explainLine);
172  
173        var onlyLine = doc.createElement('div');
174        onlyLine.className = 'hint-note';
175        onlyLine.textContent = texts.hint.only;
176        card.appendChild(onlyLine);
177  
178        hintSlotEl.appendChild(card);
179  
180        ctx.view.highlight(engine.hintLayer(state));
181        highlighting = true;
182      } else {
183        if (highlighting) { ctx.view.highlight([]); highlighting = false; }
184        if (failureMsg) {
185          var errCard = doc.createElement('div');
186          errCard.className = 'hint-card hint-error';
187          errCard.textContent = textByKey(texts, failureMsg);
188          hintSlotEl.appendChild(errCard);
189        } else if (!hint && state.demo === null && state.status === 'playing') {
190          // 示範進行中或非對局狀態時不顯示「卡住了嗎」提示語，避免蓋住示範層高亮或干擾自由模式。
191          var prompt = doc.createElement('div');
192          prompt.className = 'hint-prompt';
193          prompt.textContent = texts.hint.prompt;
194          hintSlotEl.appendChild(prompt);
195        }
196      }
197    }
198  
199    ctx.subscribe(render);
200    ctx.solver.onStatus(render);
201    render();
202  }
203  
204  module.exports = {
205    mount: mount,
206    textByKey: textByKey
207  };
```

### 3.3 `src/ui/tutorial.js`（新增，441 行）

```js
  1  // src/ui/tutorial.js — 首次教學、記號小教室、「記號說明」重開（game-spec.md §6.2、§11.2、§11.3）
  2  //
  3  // 依分派單 T-001 S8d：只呼叫 engine 的純函數（layerStickers／viewStickers／applyMove／
  4  // inverse／describeMove 經由 notation.explainMove）與 ctx 提供的介面；不自行判斷記號種類、
  5  // 步數或轉動規則。旗標存取一律包 try/catch，不可用時教學仍可完成，只是下次會再出現。
  6  'use strict';
  7  
  8  function nowMs() {
  9    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
 10    return Date.now();
 11  }
 12  
 13  function delay(win, ms) {
 14    return new Promise(function (resolve) {
 15      (win && win.setTimeout ? win : (typeof window !== 'undefined' ? window : { setTimeout: setTimeout })).setTimeout(resolve, ms);
 16    });
 17  }
 18  
 19  /**
 20   * 讀教學旗標（§6.4：`{v:1, done:true}`；格式不符或存取失敗一律視為「未完成」）。
 21   */
 22  function safeReadTutorialDone(win, key) {
 23    try {
 24      if (!win || !win.localStorage) return false;
 25      var raw = win.localStorage.getItem(key);
 26      if (!raw) return false;
 27      var obj = JSON.parse(raw);
 28      return !!(obj && obj.v === 1 && obj.done === true);
 29    } catch (e) {
 30      return false;
 31    }
 32  }
 33  
 34  function safeWriteTutorialDone(win, key) {
 35    try {
 36      if (!win || !win.localStorage) return;
 37      win.localStorage.setItem(key, JSON.stringify({ v: 1, done: true }));
 38    } catch (e) {
 39      // 忽略：寫入失敗不報錯，遊戲照常（§11.3：完成或跳過時寫入旗標，寫入失敗不算錯誤）
 40    }
 41  }
 42  
 43  /**
 44   * 組出完整 12 步（T0、T1、L1..L7、T2、T3、T4）；L 步文字取自 texts.notation.lesson（依 id 對應），
 45   * 示範記號與插入位置取自 params.tutorial（notationSteps、notationBeforeIndex），不寫死。
 46   * @returns {{all: Array, lessonOnly: Array}}
 47   */
 48  function buildSteps(texts, tutorialParams) {
 49    var tutorialTexts = texts.tutorial || [];
 50    var tSteps = tutorialTexts.map(function (body) {
 51      return { kind: 'T', body: body };
 52    });
 53    var lessonTextById = {};
 54    (texts.notation && texts.notation.lesson || []).forEach(function (l) {
 55      lessonTextById[l.id] = l;
 56    });
 57    var notationSteps = tutorialParams.notationSteps || [];
 58    var lSteps = notationSteps.map(function (s) {
 59      var lt = lessonTextById[s.id] || { title: '', body: '' };
 60      return { kind: 'L', id: s.id, title: lt.title || '', body: lt.body || '', demo: s.demo };
 61    });
 62    var insertAt = typeof tutorialParams.notationBeforeIndex === 'number'
 63      ? tutorialParams.notationBeforeIndex
 64      : tSteps.length;
 65    insertAt = Math.max(0, Math.min(insertAt, tSteps.length));
 66    var all = tSteps.slice(0, insertAt).concat(lSteps).concat(tSteps.slice(insertAt));
 67    return { all: all, lessonOnly: lSteps };
 68  }
 69  
 70  function mount(ctx) {
 71    var texts = ctx.data.texts || {};
 72    var buttons = texts.buttons || {};
 73    var notationTexts = texts.notation || {};
 74    var params = ctx.data.params || {};
 75    var tutorialParams = params.tutorial || {};
 76    var storageParams = params.storage || {};
 77    var tutorialKey = storageParams.tutorialKey || 'cube3x3.tutorial.v1';
 78    var demoTurnMs = typeof tutorialParams.demoTurnMs === 'number' ? tutorialParams.demoTurnMs : 600;
 79    var demoHoldMs = typeof tutorialParams.demoHoldMs === 'number' ? tutorialParams.demoHoldMs : 700;
 80    // D-25：faceLabels.forceOnInTutorial 決定教學與記號小教室期間是否強制開啟面標籤
 81    // （鍵缺少時預設 true，與規格 §10.3 預設值相同）。
 82    var forceFaceLabels = !(params.faceLabels && params.faceLabels.forceOnInTutorial === false);
 83  
 84    var win = (typeof window !== 'undefined') ? window : null;
 85    var engine = ctx.engine;
 86    var notation = ctx.notation;
 87  
 88    var built = buildSteps(texts, tutorialParams);
 89    var allSteps = built.all; // 12 步（首次教學）
 90    var lessonOnlySteps = built.lessonOnly; // 7 步（記號說明重開）
 91  
 92    // ---- DOM：lesson-card 插槽（一次建立，之後只更新內容） ----
 93    var lessonEl = ctx.slot('lesson-card');
 94    var lessonButtonSlot = ctx.slot('lesson-button');
 95    var panelControlsEl = ctx.root.querySelector('#panelControls');
 96    var panelDemoEl = ctx.root.querySelector('#panelDemo');
 97    var ctabsEl = ctx.root.querySelector('.ctabs');
 98    var faceLabelToggleEl = ctx.root.querySelector('#faceLabelToggle');
 99  
100    var elMetaPrimary = document.createElement('div');
101    elMetaPrimary.className = 'lesson-meta lesson-meta-primary';
102    var elMetaSecondary = document.createElement('div');
103    elMetaSecondary.className = 'lesson-meta lesson-meta-secondary';
104    var elTitle = document.createElement('h3');
105    elTitle.className = 'lesson-title';
106    var elBody = document.createElement('p');
107    elBody.className = 'lesson-body';
108    var elExplain = document.createElement('p');
109    elExplain.className = 'lesson-explain';
110    var elActions = document.createElement('div');
111    elActions.className = 'lesson-actions';
112  
113    function makeBtn(cls) {
114      var b = document.createElement('button');
115      b.type = 'button';
116      b.className = 'ctl lesson-btn ' + cls;
117      return b;
118    }
119    var btnPrev = makeBtn('lesson-prev');
120    var btnSkipSection = makeBtn('lesson-skip-section');
121    var btnReplay = makeBtn('lesson-replay');
122    var btnNext = makeBtn('lesson-next accent');
123    var btnSkipAll = makeBtn('lesson-skip-all');
124    var btnClose = makeBtn('lesson-close');
125  
126    btnPrev.textContent = buttons.tutPrev || '';
127    btnSkipSection.textContent = buttons.lessonSkip || '';
128    btnReplay.textContent = buttons.lessonReplay || '';
129    btnSkipAll.textContent = buttons.tutSkip || '';
130    btnClose.textContent = buttons.lessonClose || '';
131  
132    [btnPrev, btnSkipSection, btnReplay, btnNext, btnSkipAll, btnClose].forEach(function (b) {
133      elActions.appendChild(b);
134    });
135    [elMetaPrimary, elMetaSecondary, elTitle, elBody, elExplain, elActions].forEach(function (el) {
136      lessonEl.appendChild(el);
137    });
138  
139    // ---- 「記號說明」按鈕（面板頂列／手把列插槽，§11.2、§11.3） ----
140    var btnNotationHelp = document.createElement('button');
141    btnNotationHelp.type = 'button';
142    btnNotationHelp.className = 'ctl notation-help-btn';
143    btnNotationHelp.textContent = buttons.notationHelp || '';
144    lessonButtonSlot.appendChild(btnNotationHelp);
145  
146    // ---- 狀態 ----
147    var mode = null; // null | 'onboarding' | 'lesson'
148    var stepIdx = 0;
149    var demoGen = 0; // 世代計數器：換步／關閉時 +1，讓進行中的 Promise 鏈不再繼續下一段
150    var savedFaceLabels = false;
151    var savedTab = 'controls';
152    var LOCK_OWNER = 'lesson';
153  
154    function currentSteps() {
155      return mode === 'onboarding' ? allSteps : lessonOnlySteps;
156    }
157  
158    // D-19：ctx.view 已補上 onFaceLabelsChange（cube-view.js／app.js），controls.js
159    // 訂閱後會自動同步 #faceLabelToggle 的 aria-checked，本檔呼叫 ctx.view.setFaceLabels()
160    // 即可，不必再自己直接操作該按鈕屬性（移除原本的 setFaceLabelsSynced() 繞道，
161    // 見 docs/reports/T-001-S8d.md「未預期發現」第 2 點）。
162  
163    function clearDemo() {
164      demoGen++;
165      if (ctx.view) {
166        ctx.view.highlight([]);
167        ctx.view.clearPreview();
168      }
169    }
170  
171    function playStepDemo() {
172      var s = currentSteps()[stepIdx];
173      if (!s || s.kind !== 'L' || !ctx.view) return;
174      var myGen = ++demoGen;
175      var move = s.demo;
176      var base = engine.viewStickers(ctx.getState());
177      ctx.view.highlight(engine.layerStickers(move));
178      delay(win, demoHoldMs).then(function () {
179        if (myGen !== demoGen) return null;
180        return ctx.view.previewTurn(base, move, demoTurnMs);
181      }).then(function () {
182        if (myGen !== demoGen) return null;
183        return delay(win, demoHoldMs);
184      }).then(function () {
185        if (myGen !== demoGen) return null;
186        var rotated = engine.applyMove(base, move);
187        var inv = engine.inverse(move);
188        return ctx.view.previewTurn(rotated, inv, demoTurnMs);
189      }).then(function () {
190        if (myGen !== demoGen) return;
191        ctx.view.highlight([]);
192      });
193    }
194  
195    function pauseTimerIfRunning() {
196      var st = ctx.getState();
197      if (st.timer && st.timer.state === 'running') {
198        ctx.dispatch({ type: 'PAUSE', payload: { at: nowMs(), reason: 'lesson' } });
199      }
200    }
201  
202    function applyStepSideEffects() {
203      clearDemo();
204      var s = currentSteps()[stepIdx];
205      if (s && s.kind === 'L') {
206        ctx.input.lock(LOCK_OWNER);
207        pauseTimerIfRunning();
208        playStepDemo();
209      } else {
210        ctx.input.unlock(LOCK_OWNER);
211      }
212    }
213  
214    // 只有「記號小教室」（L 步，無論在首次教學中或「記號說明」重開）才取代分頁內容
215    // （§11.1：「小教室卡片顯示在學習面板內（取代分頁內容）」，字面上只針對小教室）；
216    // 一般教學步（T0～T4）卡片與目前分頁內容並存（card 用 order:-1 排在最上面，
217    // 分頁內容留在下方可捲動），因為 T2 明確要玩家去看「操作」分頁的按鈕，
218    // 若整個教學期間都蓋住分頁內容，玩家會找不到 T2 說的鍵盤（見 S8d 回報「未預期發現」）。
219    function syncPanelVisibilityForStep() {
220      var s = currentSteps()[stepIdx];
221      var isLessonStep = !!(s && s.kind === 'L');
222      if (isLessonStep) {
223        panelControlsEl.hidden = true;
224        panelDemoEl.hidden = true;
225        if (ctabsEl) ctabsEl.hidden = true;
226      } else {
227        if (ctabsEl) ctabsEl.hidden = false;
228        var tab = ctx.panel.currentTab();
229        panelControlsEl.hidden = tab !== 'controls';
230        panelDemoEl.hidden = tab !== 'demo';
231      }
232    }
233  
234    function showLessonUI() {
235      lessonEl.hidden = false;
236      if (faceLabelToggleEl) faceLabelToggleEl.disabled = true;
237    }
238  
239    function hideLessonUI() {
240      lessonEl.hidden = true;
241      if (ctabsEl) ctabsEl.hidden = false;
242      var tab = ctx.panel.currentTab();
243      panelControlsEl.hidden = tab !== 'controls';
244      panelDemoEl.hidden = tab !== 'demo';
245      if (faceLabelToggleEl) faceLabelToggleEl.disabled = false;
246    }
247  
248    function renderStep() {
249      var steps = currentSteps();
250      var s = steps[stepIdx];
251      if (!s) return;
252  
253      if (mode === 'onboarding') {
254        var overallIdx = allSteps.indexOf(s);
255        elMetaPrimary.hidden = false;
256        elMetaPrimary.textContent = notation.fillTemplate(notationTexts.tutorialProgress || '', {
257          k: overallIdx + 1, n: allSteps.length
258        });
259        if (s.kind === 'L') {
260          var lessonIdx = lessonOnlySteps.indexOf(s);
261          elMetaSecondary.hidden = false;
262          elMetaSecondary.textContent = notation.fillTemplate(notationTexts.lessonProgress || '', {
263            k: lessonIdx + 1, n: lessonOnlySteps.length
264          });
265        } else {
266          elMetaSecondary.hidden = true;
267          elMetaSecondary.textContent = '';
268        }
269      } else {
270        elMetaPrimary.hidden = false;
271        elMetaPrimary.textContent = notation.fillTemplate(notationTexts.lessonProgress || '', {
272          k: stepIdx + 1, n: lessonOnlySteps.length
273        });
274        elMetaSecondary.hidden = true;
275        elMetaSecondary.textContent = '';
276      }
277  
278      if (s.kind === 'L') {
279        elTitle.hidden = false;
280        elTitle.textContent = s.title;
281        elExplain.hidden = false;
282        elExplain.textContent = notation.explainMove(s.demo, texts, engine);
283      } else {
284        elTitle.hidden = true;
285        elTitle.textContent = '';
286        elExplain.hidden = true;
287        elExplain.textContent = '';
288      }
289      elBody.textContent = s.body;
290  
291      var isFirst = stepIdx === 0;
292      var isLast = stepIdx === steps.length - 1;
293      btnPrev.disabled = isFirst;
294  
295      if (mode === 'onboarding') {
296        btnSkipAll.hidden = false;
297        btnClose.hidden = true;
298        btnNext.textContent = isLast ? (buttons.tutDone || '') : (buttons.tutNext || '');
299        btnSkipSection.hidden = s.kind !== 'L';
300        btnReplay.hidden = s.kind !== 'L';
301      } else {
302        btnSkipAll.hidden = true;
303        btnClose.hidden = false;
304        btnNext.textContent = isLast ? (buttons.lessonClose || '') : (buttons.tutNext || '');
305        btnSkipSection.hidden = true; // 記號說明重開只有 L 步，沒有「略過這段」的下一個 T 步可跳
306        btnReplay.hidden = false; // 記號說明重開全部是 L 步
307      }
308  
309      syncPanelVisibilityForStep();
310      applyStepSideEffects();
311    }
312  
313    function goNext() {
314      if (!mode) return;
315      var steps = currentSteps();
316      if (stepIdx >= steps.length - 1) {
317        finishCurrent();
318        return;
319      }
320      stepIdx++;
321      renderStep();
322    }
323  
324    function goPrev() {
325      if (!mode || stepIdx <= 0) return;
326      stepIdx--;
327      renderStep();
328    }
329  
330    function skipSection() {
331      if (mode !== 'onboarding') return;
332      var idx = stepIdx;
333      while (idx < allSteps.length && allSteps[idx].kind === 'L') idx++;
334      stepIdx = Math.min(idx, allSteps.length - 1);
335      renderStep();
336    }
337  
338    function replay() {
339      var s = currentSteps()[stepIdx];
340      if (!s || s.kind !== 'L') return;
341      clearDemo();
342      playStepDemo();
343    }
344  
345    function finishCurrent() {
346      if (mode === 'onboarding') {
347        safeWriteTutorialDone(win, tutorialKey);
348        endFlow();
349      } else if (mode === 'lesson') {
350        endFlow();
351      }
352    }
353  
354    function skipAll() {
355      if (mode !== 'onboarding') return;
356      safeWriteTutorialDone(win, tutorialKey);
357      endFlow();
358    }
359  
360    function closeLesson() {
361      if (mode !== 'lesson') return;
362      endFlow();
363    }
364  
365    function endFlow() {
366      clearDemo();
367      ctx.input.unlock(LOCK_OWNER);
368      if (ctx.view) ctx.view.setFaceLabels(savedFaceLabels);
369      if (mode === 'lesson') ctx.panel.selectTab(savedTab);
370      hideLessonUI();
371      mode = null;
372      updateNotationHelpDisabled();
373    }
374  
375    function startOnboarding() {
376      mode = 'onboarding';
377      stepIdx = 0;
378      savedFaceLabels = ctx.view ? ctx.view.faceLabels() : false;
379      if (ctx.view && forceFaceLabels) ctx.view.setFaceLabels(true);
380      ctx.panel.expand(true);
381      showLessonUI();
382      renderStep();
383      updateNotationHelpDisabled();
384    }
385  
386    function openLesson() {
387      if (mode !== null) return;
388      mode = 'lesson';
389      stepIdx = 0;
390      savedFaceLabels = ctx.view ? ctx.view.faceLabels() : false;
391      savedTab = ctx.panel.currentTab();
392      if (ctx.view && forceFaceLabels) ctx.view.setFaceLabels(true);
393      ctx.panel.expand(true);
394      showLessonUI();
395      renderStep();
396      updateNotationHelpDisabled();
397    }
398  
399    function notationHelpDisabled() {
400      if (mode !== null) return true;
401      var st = ctx.getState();
402      if (st.hint && st.hint.pending) return true;
403      if (st.demo && st.demo.pending) return true;
404      if (ctx.input.locked()) return true;
405      if (ctx.anim && ctx.anim.busy()) return true;
406      return false;
407    }
408  
409    function updateNotationHelpDisabled() {
410      var disabled = notationHelpDisabled();
411      btnNotationHelp.disabled = disabled;
412      btnNotationHelp.setAttribute('aria-disabled', String(disabled));
413    }
414  
415    btnPrev.addEventListener('click', goPrev);
416    btnNext.addEventListener('click', goNext);
417    btnSkipAll.addEventListener('click', skipAll);
418    btnClose.addEventListener('click', closeLesson);
419    btnSkipSection.addEventListener('click', skipSection);
420    btnReplay.addEventListener('click', replay);
421    btnNotationHelp.addEventListener('click', function () {
422      if (btnNotationHelp.disabled) return;
423      openLesson();
424    });
425  
426    ctx.subscribe(function () {
427      updateNotationHelpDisabled();
428    });
429    updateNotationHelpDisabled();
430  
431    // ---- 首次教學觸發（§11.3：enabled 為 true 且旗標不存在時，頁面畫完後顯示） ----
432    var tutorialEnabled = !!tutorialParams.enabled;
433    var alreadyDone = safeReadTutorialDone(win, tutorialKey);
434    if (tutorialEnabled && !alreadyDone) {
435      startOnboarding();
436    }
437  }
438  
439  module.exports = {
440    mount: mount
441  };
```

### 3.4 `src/ui/records.js`（新增，315 行）

```js
  1  // src/ui/records.js — 完成畫面與本機最佳紀錄（game-spec.md §6.3、§6.4）
  2  //
  3  // 依分派單 T-001 S8d：本檔只呈現 state、讀寫 localStorage；不計算規則（是否過關、
  4  // 步數、assist 種類一律取 engine 的 state.result／selectors.recordEligible）。
  5  // 所有儲存存取一律包 try/catch（含「存取 window.localStorage 本身」就可能拋例外的情況，
  6  // 例如某些瀏覽器隱私模式；不可用時不顯示紀錄、不報錯，遊戲照常，見 §6.4）。
  7  'use strict';
  8  
  9  function nowFormatTime(ms) {
 10    // 與 controls.js 的 formatTime 邏輯一致（各檔各自一份，避免互相 require，沿用 S8a 慣例）。
 11    var totalDeci = Math.floor(Math.max(0, ms) / 100);
 12    var m = Math.floor(totalDeci / 600);
 13    var s = Math.floor((totalDeci % 600) / 10);
 14    var d = totalDeci % 10;
 15    return m + ':' + (s < 10 ? '0' + s : String(s)) + '.' + d;
 16  }
 17  
 18  /**
 19   * 安全取得 localStorage（可能整個存取就拋例外，例如部分瀏覽器隱私模式）。
 20   * @returns {Storage|null}
 21   */
 22  function safeGetStorage(win) {
 23    try {
 24      if (!win || !win.localStorage) return null;
 25      // 部分瀏覽器要「用一次」才會真的拋例外（單純讀屬性不會）。
 26      var probeKey = '__cube3x3_probe__';
 27      win.localStorage.setItem(probeKey, '1');
 28      win.localStorage.removeItem(probeKey);
 29      return win.localStorage;
 30    } catch (e) {
 31      return null;
 32    }
 33  }
 34  
 35  function safeReadJson(storage, key) {
 36    try {
 37      var raw = storage.getItem(key);
 38      if (!raw) return null;
 39      return JSON.parse(raw);
 40    } catch (e) {
 41      return null;
 42    }
 43  }
 44  
 45  function safeWriteJson(storage, key, value) {
 46    try {
 47      storage.setItem(key, JSON.stringify(value));
 48      return true;
 49    } catch (e) {
 50      return false;
 51    }
 52  }
 53  
 54  /**
 55   * 讀到的紀錄格式是否合法（§6.4：v 不是 1 或欄位缺漏 → 當作沒有紀錄）。
 56   */
 57  function isValidRecords(v) {
 58    return !!(
 59      v && v.v === 1 &&
 60      typeof v.solves === 'number' &&
 61      v.bestTime && typeof v.bestTime.ms === 'number' && typeof v.bestTime.qtm === 'number' &&
 62      v.bestMoves && typeof v.bestMoves.qtm === 'number' && typeof v.bestMoves.ms === 'number'
 63    );
 64  }
 65  
 66  function mount(ctx) {
 67    var texts = ctx.data.texts;
 68    var resultTexts = texts.result || {};
 69    var buttons = texts.buttons || {};
 70    var params = ctx.data.params || {};
 71    var storageParams = params.storage || {};
 72    var recordsKey = storageParams.recordsKey || 'cube3x3.records.v1';
 73  
 74    var win = (typeof window !== 'undefined') ? window : null;
 75    var storage = safeGetStorage(win);
 76  
 77    function readRecords() {
 78      if (!storage) return null;
 79      var v = safeReadJson(storage, recordsKey);
 80      return isValidRecords(v) ? v : null;
 81    }
 82  
 83    /**
 84     * 依 §6.4 規則更新紀錄；回傳是否為「新紀錄」（時間或步數任一項優於先前）。
 85     * 先前沒有合法紀錄（第一次完成、或格式不符）視為新紀錄。
 86     */
 87    function writeRecord(result) {
 88      var prev = readRecords();
 89      var isNew = !prev || result.timeMs < prev.bestTime.ms || result.qtm < prev.bestMoves.qtm;
 90      var next = prev || { v: 1, solves: 0, bestTime: null, bestMoves: null };
 91      next.v = 1;
 92      next.solves = (next.solves || 0) + 1;
 93      if (!next.bestTime || result.timeMs < next.bestTime.ms) {
 94        next.bestTime = { ms: result.timeMs, qtm: result.qtm };
 95      }
 96      if (!next.bestMoves || result.qtm < next.bestMoves.qtm) {
 97        next.bestMoves = { qtm: result.qtm, ms: result.timeMs };
 98      }
 99      if (storage) safeWriteJson(storage, recordsKey, next);
100      return isNew;
101    }
102  
103    // ---- 完成畫面 DOM（overlay 插槽；一次建立，之後只更新內容，§11.4） ----
104    var overlaySlot = ctx.slot('overlay');
105    var mask = document.createElement('div');
106    mask.className = 'overlay-mask';
107    mask.hidden = true;
108  
109    var card = document.createElement('div');
110    card.className = 'overlay-card';
111    card.setAttribute('role', 'dialog');
112    card.setAttribute('aria-modal', 'true');
113  
114    var headline = document.createElement('p');
115    headline.className = 'result-headline';
116  
117    var summary = document.createElement('p');
118    summary.className = 'result-summary';
119  
120    var badgeRow = document.createElement('div');
121    badgeRow.className = 'result-badges';
122  
123    var badgeAssist = document.createElement('span');
124    badgeAssist.className = 'badge';
125    badgeAssist.hidden = true;
126  
127    var badgeNew = document.createElement('span');
128    badgeNew.className = 'badge badge-new';
129    badgeNew.hidden = true;
130    badgeNew.textContent = resultTexts.newRecord || '';
131  
132    badgeRow.appendChild(badgeAssist);
133    badgeRow.appendChild(badgeNew);
134  
135    var note = document.createElement('p');
136    note.className = 'result-note';
137    note.hidden = true;
138  
139    // MJ-2（D-24）：完成畫面顯示本機最佳紀錄；儲存不可用或沒有合法紀錄時整行不顯示。
140    var bestLine = document.createElement('p');
141    bestLine.className = 'result-best';
142    bestLine.hidden = true;
143  
144    var actions = document.createElement('div');
145    actions.className = 'result-actions';
146    var btnNewGame = document.createElement('button');
147    btnNewGame.type = 'button';
148    btnNewGame.className = 'ctl accent';
149    btnNewGame.textContent = buttons.newGame || '';
150    btnNewGame.addEventListener('click', function () {
151      if (typeof ctx.newGame === 'function') ctx.newGame();
152    });
153    // m-6：「看看方塊」關閉遮罩，讓玩家查看復原後的方塊、按重設或整顆轉（§3.6）。
154    // 關掉之後本局不再自動彈出，直到下一次離開 solved（NEW_GAME／RESET）。
155    var btnViewCube = document.createElement('button');
156    btnViewCube.type = 'button';
157    btnViewCube.className = 'ctl result-view-cube';
158    btnViewCube.textContent = buttons.viewCube || '';
159    btnViewCube.addEventListener('click', function () {
160      dismissedThisResult = true;
161      hideResult();
162    });
163    actions.appendChild(btnViewCube);
164    actions.appendChild(btnNewGame);
165  
166    card.appendChild(headline);
167    card.appendChild(summary);
168    card.appendChild(badgeRow);
169    card.appendChild(note);
170    card.appendChild(bestLine);
171    card.appendChild(actions);
172    mask.appendChild(card);
173    overlaySlot.appendChild(mask);
174  
175    // ---- D-17：示範中（state.demo 非 null）方塊復原時的完成畫面 ----
176    // 全螢幕 .overlay-mask 蓋住 #app 全部內容，含學習面板內的示範播放器（上一步／下一步／
177    // 離開示範），違反 §9.1「結尾…仍可前後單步回看」。示範進行中改在方塊區（.cube-scene；
178    // 介面契約見 docs/reports/T-001-S8a.md）上緣掛一張不遮擋操作的小卡片（比照 .hint-slot
179    // 的作法：外層 pointer-events:none，卡片本身 pointer-events:auto），只顯示摘要文字，
180    // 不重複「離開示範」等已存在於示範播放器的操作。
181    // 離開示範（DEMO_EXIT）後不再補彈出全螢幕遮罩：玩家已經在示範中看過這張摘要卡，
182    // 離開當下再跳出遮罩會是不在預期內的「重複彈出」，見 arch-decisions D-17。
183    var cubeSceneEl = ctx.root.querySelector('.cube-scene');
184    var demoCard = document.createElement('div');
185    demoCard.className = 'demo-result-slot';
186    demoCard.hidden = true;
187    var demoCardInner = document.createElement('div');
188    demoCardInner.className = 'demo-result-card';
189    var demoHeadline = document.createElement('div');
190    demoHeadline.className = 'demo-result-headline';
191    var demoSummary = document.createElement('div');
192    demoSummary.className = 'demo-result-summary';
193    demoCardInner.appendChild(demoHeadline);
194    demoCardInner.appendChild(demoSummary);
195    demoCard.appendChild(demoCardInner);
196    if (cubeSceneEl) cubeSceneEl.appendChild(demoCard);
197  
198    function showDemoResult(result) {
199      if (!cubeSceneEl) return;
200      demoHeadline.textContent = (resultTexts.solved || '') +
201        (result.assist === 'demo' ? '（' + (resultTexts.badgeDemo || '') + '）' : '');
202      demoSummary.textContent = ctx.notation.fillTemplate(resultTexts.summary || '', {
203        time: nowFormatTime(result.timeMs),
204        qtm: result.qtm
205      });
206      demoCard.hidden = false;
207    }
208  
209    function hideDemoResult() {
210      demoCard.hidden = true;
211    }
212  
213    function renderBestLine() {
214      var rec = readRecords(); // 儲存不可用時為 null
215      if (!rec) {
216        bestLine.hidden = true;
217        bestLine.textContent = '';
218        return;
219      }
220      bestLine.textContent = ctx.notation.fillTemplate(resultTexts.best || '', {
221        label: (texts.hud && texts.hud.best) || '',
222        time: nowFormatTime(rec.bestTime.ms),
223        qtm: rec.bestMoves.qtm
224      });
225      bestLine.hidden = false;
226    }
227  
228    function showResult(result, isNewRecord) {
229      if (dismissedThisResult) return;
230      if (result.assist === 'none') {
231        headline.textContent = resultTexts.solved || '';
232        badgeAssist.hidden = true;
233        note.hidden = true;
234        badgeNew.hidden = !isNewRecord;
235      } else {
236        headline.textContent = resultTexts.solved || '';
237        badgeAssist.hidden = false;
238        badgeAssist.classList.toggle('badge-demo', result.assist === 'demo');
239        badgeAssist.textContent = result.assist === 'demo' ? (resultTexts.badgeDemo || '') : (resultTexts.badgeHint || '');
240        badgeNew.hidden = true; // 用過提示／看過示範不列入紀錄，不會有新紀錄（§6.3）
241        if (result.assist === 'demo') {
242          note.hidden = false;
243          note.textContent = resultTexts.demoNote || '';
244        } else {
245          note.hidden = true;
246        }
247      }
248      var summaryText = ctx.notation.fillTemplate(resultTexts.summary || '', {
249        time: nowFormatTime(result.timeMs),
250        qtm: result.qtm
251      });
252      summary.textContent = summaryText;
253      renderBestLine();
254      mask.hidden = false;
255    }
256  
257    function hideResult() {
258      mask.hidden = true;
259    }
260  
261    // ---- 訂閱 state：status → 'solved' 時顯示完成畫面；recordEligible 由 false 變 true 時寫入紀錄 ----
262    // lastIsNewRecordForThisResult：同一局完成畫面可能因為其他事件（例如切分頁背景送 PAUSE）
263    // 觸發多次 render，「是否新紀錄」只在剛完成那一刻算一次，之後重繪要沿用同一個值，
264    // 不能每次都重算（新紀錄的判斷需要「寫入前」的舊紀錄，寫入後已經覆蓋，無法重算）。
265    var prevStatus = ctx.getState().status;
266    var prevEligible = ctx.engine.recordEligible(ctx.getState());
267    var lastIsNewRecordForThisResult = false;
268    // D-17：本局完成畫面若曾經在示範進行中顯示過（用不遮擋的卡片），離開示範後就不再
269    // 補顯示全螢幕遮罩（避免「重複彈出」）。每次 NEW_GAME／RESET 離開 solved 狀態時重置。
270    var resultShownDuringDemo = false;
271    // m-6：本局完成畫面已被「看看方塊」關掉（離開 solved 時重置）。
272    var dismissedThisResult = false;
273  
274    ctx.subscribe(function (state) {
275      var eligible = ctx.engine.recordEligible(state);
276      var justBecameEligible = eligible && !prevEligible;
277      if (justBecameEligible && state.result) {
278        lastIsNewRecordForThisResult = writeRecord(state.result);
279      }
280      var solved = state.status === 'solved' && !!state.result;
281      var demoActive = state.demo !== null;
282      if (solved && demoActive) {
283        hideResult();
284        resultShownDuringDemo = true;
285        showDemoResult(state.result);
286      } else if (solved && resultShownDuringDemo) {
287        // 已在示範中看過摘要卡，離開示範後不再彈出全螢幕遮罩（D-17）。
288        hideDemoResult();
289      } else if (solved) {
290        hideDemoResult();
291        showResult(state.result, lastIsNewRecordForThisResult);
292      } else {
293        hideResult();
294        hideDemoResult();
295        if (prevStatus === 'solved') lastIsNewRecordForThisResult = false;
296        resultShownDuringDemo = false;
297        dismissedThisResult = false;
298      }
299      prevStatus = state.status;
300      prevEligible = eligible;
301    });
302  
303    if (prevStatus === 'solved' && ctx.getState().result) {
304      if (ctx.getState().demo !== null) {
305        resultShownDuringDemo = true;
306        showDemoResult(ctx.getState().result);
307      } else {
308        showResult(ctx.getState().result, false);
309      }
310    }
311  }
312  
313  module.exports = {
314    mount: mount
315  };
```

### 3.5 `src/ui/demo.css`（新增，125 行）

```css
  1  /* src/ui/demo.css — 提示浮層與示範分頁樣式（game-spec.md §9.1、§9.4、§2.3、§2.4） */
  2  /* 依分派單 T-001 S8c（X-7 空殼移交後由本段改寫）。
  3     共用類別沿用 src/ui/styles.css 既有的 .ctl（含 .accent）按鈕樣式（≥44×44px）；
  4     本檔只補提示／示範專屬的版面與顏色，不重複定義按鈕基礎樣式。 */
  5  
  6  /* ---- 提示浮層（hint 插槽；方塊區右上角） ---- */
  7  .hint-prompt {
  8    max-width: min(70vw, 240px);
  9    padding: 8px 12px;
 10    border-radius: 10px;
 11    background: rgba(255, 255, 255, .92);
 12    border: 1px solid #ddd;
 13    font-size: 12px;
 14    color: #777;
 15    box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
 16  }
 17  
 18  .hint-card, .wait-card {
 19    position: relative;
 20    max-width: min(78vw, 260px);
 21    padding: 10px 30px 10px 12px;
 22    border-radius: 12px;
 23    background: #fff;
 24    border: 1.5px solid #0a6cff;
 25    box-shadow: 0 4px 14px rgba(0, 0, 0, .14);
 26    font-size: 12.5px;
 27    line-height: 1.5;
 28  }
 29  
 30  .wait-card { border-color: #999; padding-right: 12px; text-align: center; }
 31  .wait-msg { color: #444; margin-bottom: 6px; }
 32  .wait-card .ctl { margin-top: 6px; width: 100%; }
 33  
 34  /* S11／B-3：可點範圍放大到 44×44（CLAUDE.md §3 第 4 條），視覺上仍是小的 ×；
 35     卡片右側內距同步加寬，避免 × 蓋住文字。 */
 36  .hint-card { padding-right: 44px; }
 37  .hint-close {
 38    position: absolute; top: 0; right: 0;
 39    min-width: 44px; min-height: 44px;
 40    border-radius: 999px; border: none; background: transparent;
 41    font-size: 18px; line-height: 1; color: #999; cursor: pointer;
 42  }
 43  .hint-move { font-size: 16px; font-weight: 700; color: #0a3b8f; margin-bottom: 4px; }
 44  .hint-explain { color: #333; margin-bottom: 6px; }
 45  .hint-note { font-size: 11px; color: #999; }
 46  .hint-error, .demo-error {
 47    border-color: #d0332f; color: #8a1f1c; background: #fdeceb;
 48  }
 49  
 50  .solver-notice {
 51    padding: 8px 10px; border-radius: 8px; margin-bottom: 8px;
 52    background: #fff3cd; color: #8a6100; border: 1px solid #f0c96a;
 53    font-size: 12.5px; line-height: 1.4;
 54  }
 55  
 56  .progress-bar {
 57    height: 6px; border-radius: 999px; background: #eee; overflow: hidden; margin-bottom: 6px;
 58  }
 59  .progress-fill { height: 100%; background: #0a6cff; transition: width .15s linear; }
 60  
 61  /* ---- 示範分頁 ---- */
 62  .demo-root { display: flex; flex-direction: column; gap: 10px; }
 63  
 64  .demo-kind-row { display: flex; gap: 8px; }
 65  .demo-kind-btn { flex: 1; font-size: 13px; }
 66  .demo-kind-btn.on { border-color: #0a6cff; background: #eaf2ff; color: #0a3b8f; font-weight: 700; }
 67  
 68  .demo-pick { display: flex; flex-direction: column; gap: 8px; }
 69  .demo-note { font-size: 12.5px; color: #555; line-height: 1.5; }
 70  .demo-note-sub { color: #888; font-size: 11.5px; }
 71  .demo-error { padding: 8px 10px; border-radius: 8px; border-width: 1px; border-style: solid; }
 72  
 73  .demo-player { display: flex; flex-direction: column; gap: 8px; }
 74  .demo-header { font-size: 15px; font-weight: 700; }
 75  .demo-progress { font-size: 12px; color: #777; font-variant-numeric: tabular-nums; }
 76  .demo-explain { font-size: 12.5px; color: #333; background: #f2f6ff; border-radius: 8px; padding: 6px 10px; }
 77  
 78  .token-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
 79  .token-row { display: flex; gap: 6px; padding: 2px; }
 80  .token-chip {
 81    flex: 0 0 auto; min-width: 40px; padding: 4px 6px; border-radius: 8px;
 82    border: 1.5px solid #ddd; text-align: center; opacity: .55;
 83  }
 84  .token-chip.done { opacity: .35; }
 85  .token-chip.next { opacity: 1; border-color: #0a6cff; background: #eaf2ff; box-shadow: 0 0 0 2px rgba(10, 108, 255, .18); }
 86  .token-move { font-size: 14px; font-weight: 700; }
 87  .token-step { font-size: 9.5px; color: #777; white-space: nowrap; }
 88  
 89  .pause-card {
 90    padding: 10px 12px; border-radius: 10px; background: #eaf2ff; border: 1.5px solid #0a6cff;
 91    display: flex; flex-direction: column; gap: 8px;
 92  }
 93  .pause-msg { font-size: 12.5px; color: #0a3b8f; line-height: 1.5; }
 94  
 95  .demo-controls { display: flex; gap: 6px; flex-wrap: wrap; }
 96  .demo-controls .ctl { flex: 1 1 auto; min-width: 44px; font-size: 12.5px; padding: 0 8px; }
 97  
 98  .demo-speed-row { display: flex; gap: 6px; }
 99  .speed-btn { flex: 1; font-size: 12.5px; }
100  .speed-btn.on { border-color: #0a6cff; background: #eaf2ff; color: #0a3b8f; font-weight: 700; }
101  
102  .segment-list { display: flex; flex-direction: column; gap: 6px; }
103  .segment-row {
104    min-height: 44px; padding: 8px 10px; border-radius: 10px; border: 1.5px solid #e2e2e2;
105    cursor: pointer; display: flex; flex-direction: column; gap: 3px; justify-content: center;
106  }
107  .segment-row.done { opacity: .6; }
108  .segment-row.skip { opacity: .5; }
109  .segment-row.current { border-color: #0a6cff; background: #f5f9ff; }
110  .segment-row.future { opacity: .55; }
111  .seg-name { font-size: 13px; font-weight: 700; }
112  .seg-desc { font-size: 11.5px; color: #555; line-height: 1.4; }
113  .seg-steps { font-size: 11px; color: #0a6cff; font-weight: 700; }
114  .seg-note { font-size: 11px; color: #999; }
115  
116  .formula-block {
117    margin-top: 4px; padding: 6px 8px; border-radius: 8px; background: #fff;
118    border: 1px dashed #0a6cff;
119  }
120  .formula-name { font-size: 12px; font-weight: 700; color: #0a3b8f; }
121  .formula-use { font-size: 11px; color: #666; margin-top: 2px; }
122  
123  @media (orientation: landscape) {
124    .hint-card, .wait-card, .hint-prompt { max-width: 220px; }
125  }
```

### 3.6 `src/ui/overlay.css`（新增，90 行）

```css
 1  /* src/ui/overlay.css — 完成畫面、最佳紀錄徽章、首次教學與記號小教室卡片樣式 */
 2  /* 依分派單 T-001 S8d（game-spec.md §6.3、§6.4、§11.3、§11.4）。 */
 3  /*
 4    本檔管的兩個插槽：
 5      [data-slot="overlay"]      置中卡片（完成畫面；遊戲畫面上方加半透明遮罩，§11.4）
 6      [data-slot="lesson-card"]  學習面板內的教學／記號小教室卡片（不加遮罩、不蓋方塊區，§11.3）
 7      [data-slot="lesson-button"] 面板頂列／手把列的「記號說明」按鈕（§11.2、§11.3）
 8  
 9    覆寫說明：`.lesson-card` 原本在 src/ui/styles.css（S8a）是 position:absolute 覆蓋整個
10    #learnDrawer（含手把列與分頁列），但 #learnDrawer 本身沒有設 position，會讓卡片以 #app
11    為定位基準蓋住整個畫面（含方塊區），違反「不蓋住方塊區」。本檔改用一般文件流（flex 子項），
12    並用 order 把卡片排在手把列之後、分頁列之前，不需要修改 styles.css／index.template.html
13    （僅有的兩個檔案 S8d 不可碰）。
14  
15    卡片與分頁內容的關係（§11.3）：只有記號小教室（L 步，無論在首次教學中或「記號說明」
16    重開）才由 tutorial.js 把 .ctabs／#panelControls／#panelDemo 設為 hidden、卡片獨佔面板；
17    一般教學步（T0～T4）卡片與目前分頁內容並存（卡片在上、分頁內容在下可捲動），因為 T2
18    明確要玩家去看「操作」分頁的按鈕，見 tutorial.js 的 syncPanelVisibilityForStep 與
19    S8d 回報「未預期發現」。
20  */
21  
22  /* ---- 完成畫面（overlay 插槽；置中卡片＋半透明遮罩，§11.4） ---- */
23  .overlay-mask {
24    position: absolute; inset: 0; z-index: 20;
25    display: flex; align-items: center; justify-content: center;
26    padding: 24px; background: rgba(20, 22, 26, .5);
27  }
28  .overlay-card {
29    width: min(92vw, 380px); max-height: 84vh; overflow-y: auto;
30    background: #fff; border-radius: 16px; padding: 22px 22px 20px;
31    box-shadow: 0 12px 32px rgba(0, 0, 0, .28);
32    display: flex; flex-direction: column; gap: 10px;
33  }
34  .result-headline { margin: 0; font-size: 19px; font-weight: 700; }
35  .result-summary { margin: 0; font-size: 15px; color: #333; line-height: 1.5; }
36  .result-badges { display: flex; flex-wrap: wrap; gap: 8px; }
37  .result-note { margin: 0; font-size: 12.5px; color: #888; line-height: 1.5; }
38  .result-actions { margin-top: 6px; display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
39  /* MJ-2（D-24）：完成畫面的本機最佳紀錄 */
40  .result-best { margin: 0; font-size: 13px; color: #555; line-height: 1.5; font-variant-numeric: tabular-nums; }
41  
42  /* 沿用 styles.css 的 .badge（提示徽章）外觀，另加兩個色調變化 */
43  .badge.badge-demo { background: #e7f0ff; color: #0a3b8f; border-color: #a9c8ff; }
44  .badge.badge-new { background: #e8f9ee; color: #106b3a; border-color: #8fdcae; }
45  
46  /* ---- D-17：示範中的完成摘要卡（掛在 .cube-scene 上緣，不遮擋示範播放器操作） ---- */
47  /* 比照 styles.css 的 .hint-slot 作法：外層 pointer-events:none，只有卡片本身可互動
48     （這裡卡片沒有按鈕，純資訊，但保留同款寫法以防日後加互動元素）。 */
49  .demo-result-slot {
50    position: absolute; left: 4%; right: 4%; top: 3%; z-index: 6;
51    display: flex; justify-content: center; pointer-events: none;
52  }
53  .demo-result-slot > * { pointer-events: auto; }
54  .demo-result-card {
55    max-width: min(86vw, 320px); padding: 8px 14px; border-radius: 10px;
56    background: rgba(255, 255, 255, .96); border: 1.5px solid #0a6cff;
57    box-shadow: 0 4px 14px rgba(0, 0, 0, .14); text-align: center;
58  }
59  .demo-result-headline { font-size: 13.5px; font-weight: 700; color: #0a3b8f; }
60  .demo-result-summary { font-size: 12px; color: #444; margin-top: 2px; }
61  
62  /* ---- 「記號說明」按鈕（lesson-button 插槽） ---- */
63  .notation-help-btn { white-space: nowrap; }
64  
65  /* ---- 教學／記號小教室卡片（lesson-card 插槽） ---- */
66  /* #learnDrawer 的手把列排最前面，卡片排在它之後、分頁列（預設 order:0）之前，
67     這樣卡片和分頁列並存時（一般教學步）卡片在上，鍵盤在下可捲動，不會互相蓋住。 */
68  #learnDrawer .drawer-handle { order: -2; }
69  .lesson-card {
70    position: static; z-index: auto; order: -1;
71    flex: 0 0 auto; max-height: 46vh; min-height: 0; overflow-y: auto;
72    background: #fff; padding: 14px 16px 16px;
73    display: flex; flex-direction: column; gap: 8px;
74    border-bottom: 1px solid #eee;
75  }
76  .lesson-meta { font-size: 12px; color: #888; }
77  .lesson-meta-primary { font-weight: 600; color: #666; }
78  .lesson-meta-secondary { color: #0a6cff; font-weight: 700; }
79  .lesson-title { margin: 2px 0 0; font-size: 16px; font-weight: 700; }
80  .lesson-body { margin: 0; font-size: 14px; line-height: 1.65; color: #222; }
81  .lesson-explain {
82    margin: 0; font-size: 13.5px; line-height: 1.6; color: #0a3b8f;
83    background: #eef3ff; border: 1px solid #cfe0ff; border-radius: 10px; padding: 10px 12px;
84  }
85  .lesson-actions {
86    margin-top: auto; padding-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;
87  }
88  .lesson-btn { flex: 0 0 auto; }
89  .lesson-next { order: 5; }
90  .lesson-skip-all, .lesson-close { order: 6; margin-left: auto; }
```

### 3.7 `build/bundle.js`（新增，238 行）

```js
  1  #!/usr/bin/env node
  2  "use strict";
  3  /**
  4   * build/bundle.js：把 src/ 打包成單一 index.html（ADR-001 §2.4、§2.5；規格 §9、§12.4）。
  5   * - 只用 Node 內建 fs／path，零套件；不壓縮、不做 source map。
  6   * - 決定性：同樣的 src/ 產生 byte-identical 的 index.html（不寫時間戳）。
  7   * - 注入順序：
  8   *     <!-- INJECT:CSS -->    → styles.css、demo.css、overlay.css
  9   *     <!-- INJECT:VERSION --> → window.GAME_VERSION（讀 package.json）
 10   *     <!-- INJECT:DATA -->    → window.GAME_DATA（texts／palette／params／lbl）
 11   *     <!-- INJECT:WORKER -->  → window.SOLVER_WORKER_SRC（求解器 Worker 原始碼字串，ADR-001 §2.5）
 12   *     <!-- INJECT:JS -->      → 迷你模組註冊器＋主 bundle 各檔＋呼叫入口
 13   * - 版本號唯一來源是 package.json 的 version（release-manager 於 G6 維護），UI 不寫死版本字串。
 14   * - 主 bundle／Worker 字串各自的檔案清單寫死於 MAIN_FILES／WORKER_FILES（S7 分派單 §3；新增檔案須經
 15   *   systems-engineer 改分派單清單後才可同步改這裡，見 X-7）。
 16   * - Worker 只匯出 handleMessage(msg, post)（src/solver/worker.js），接上 self.onmessage 的那一行
 17   *   由本檔在 Worker 字串裡附加（X-6：build/ 不受 check-forbidden.sh 檢查，src/solver/ 因此保持
 18   *   沒有瀏覽器 API）。
 19   * - 輸出後自檢：主產物無 http://、https://、<link、外部 src=、@import；主產物 < 400 KB（D-13）；
 20   *   Worker 字串 < 100 KB 且語法正確（可被 new Function 解析）且不含任何 ui/ 模組。
 21   *
 22   * 用法：node build/bundle.js [--out <path>]（預設輸出到 repo 根目錄 index.html）
 23   */
 24  var fs = require("fs");
 25  var path = require("path");
 26  
 27  var ROOT = path.resolve(__dirname, "..");
 28  var SRC = path.join(ROOT, "src");
 29  
 30  /**
 31   * 主 bundle 的檔案清單與順序（分派單 T-001 S7 §3「輸出契約」寫死）。
 32   * 註冊器為惰性求值，實際載入順序其實無關，但依分派單固定寫法，方便對照。
 33   */
 34  var MAIN_FILES = [
 35    "engine/rng.js",
 36    "engine/cube.js",
 37    "engine/scramble.js",
 38    "engine/selectors.js",
 39    "engine/reducer.js",
 40    "engine/index.js",
 41    "solver/twophase.js",
 42    "solver/lbl.js",
 43    "ui/solver-client.js",
 44    "ui/notation.js",
 45    "ui/records.js",
 46    "ui/tutorial.js",
 47    "ui/cube-view.js",
 48    "ui/gesture.js",
 49    "ui/controls.js",
 50    "ui/hint-view.js",
 51    "ui/demo-player.js",
 52    "ui/app.js"
 53  ];
 54  var ENTRY = "ui/app.js";
 55  
 56  /**
 57   * Worker 字串的檔案清單（分派單 §3 S7；ADR-001 §2.5）。不含任何 src/ui/ 模組（T-BUILD-03）。
 58   * 入口不是一般的 __require(ENTRY)：Worker 需要接上 self.onmessage，見 WORKER_ENTRY_LINE。
 59   */
 60  var WORKER_FILES = [
 61    "engine/rng.js",
 62    "engine/cube.js",
 63    "solver/twophase.js",
 64    "solver/lbl.js",
 65    "solver/worker.js"
 66  ];
 67  /** X-6：接上 Worker 全域事件的這一行由 build/ 產生，worker.js 本身只匯出 handleMessage。 */
 68  var WORKER_ENTRY_LINE =
 69    'var h = __require("solver/worker.js"); ' +
 70    "self.onmessage = function (e) { h.handleMessage(e.data, function (m) { self.postMessage(m); }); };";
 71  
 72  /** CSS 清單（分派單 §3 S7）。 */
 73  var CSS_FILES = ["ui/styles.css", "ui/demo.css", "ui/overlay.css"];
 74  
 75  /** 資料清單：注入為 window.GAME_DATA 的鍵，對應 src/data/<鍵>.json（分派單 §3 S7）。 */
 76  var DATA_FILES = ["texts", "palette", "params", "lbl"];
 77  
 78  var MAX_BYTES = 400 * 1024; // D-13：主執行緒退回需內含求解器，UI 預算不足，由 300 KB 放寬
 79  var MAX_WORKER_BYTES = 100 * 1024;
 80  
 81  function read(rel) { return fs.readFileSync(path.join(SRC, rel), "utf8"); }
 82  
 83  /** 迷你 CommonJS 註冊器（瀏覽器端）；require 只支援相對路徑與 ./x、../x、x/index.js。 */
 84  var REGISTRY = [
 85    "var __mods = {}, __cache = {};",
 86    "function __define(k, f) { __mods[k] = f; }",
 87    "function __resolve(from, req) {",
 88    "  var base = from.split('/'); base.pop();",
 89    "  var parts = req.split('/');",
 90    "  for (var i = 0; i < parts.length; i++) {",
 91    "    if (parts[i] === '.' || parts[i] === '') continue;",
 92    "    if (parts[i] === '..') base.pop(); else base.push(parts[i]);",
 93    "  }",
 94    "  var k = base.join('/');",
 95    "  if (__mods[k]) return k;",
 96    "  if (__mods[k + '.js']) return k + '.js';",
 97    "  if (__mods[k + '/index.js']) return k + '/index.js';",
 98    "  throw new Error('module not found: ' + req + ' (from ' + from + ')');",
 99    "}",
100    "function __require(k) {",
101    "  if (__cache[k]) return __cache[k].exports;",
102    "  var m = { exports: {} }; __cache[k] = m;",
103    "  __mods[k](m, m.exports, function (req) { return __require(__resolve(k, req)); });",
104    "  return m.exports;",
105    "}"
106  ].join("\n");
107  
108  /** 讓字串可安全放進 <script>：避免 </script> 提前結束。 */
109  function safeScript(s) { return s.replace(/<\/script/gi, "<\\/script"); }
110  
111  /** 把一組模組檔包成「註冊器＋__define×N＋entryLine」的一段原始碼（不含 <script> 標籤）。 */
112  function buildModuleSource(files, entryLine) {
113    var parts = ["(function () {", '"use strict";', REGISTRY];
114    files.forEach(function (rel) {
115      parts.push("__define(" + JSON.stringify(rel) + ", function (module, exports, require) {");
116      parts.push(read(rel));
117      parts.push("});");
118    });
119    parts.push(entryLine);
120    parts.push("})();");
121    return parts.join("\n");
122  }
123  
124  function build(outPath) {
125    var template = read("ui/index.template.html");
126    var MARKS = ["<!-- INJECT:CSS -->", "<!-- INJECT:VERSION -->", "<!-- INJECT:DATA -->", "<!-- INJECT:WORKER -->", "<!-- INJECT:JS -->"];
127    MARKS.forEach(function (mark) {
128      if (template.indexOf(mark) < 0) throw new Error("template 缺少標記 " + mark);
129    });
130  
131    var css = CSS_FILES.map(function (rel) { return read(rel); }).join("\n").replace(/<\/style/gi, "<\\/style");
132    var cssBlock = "<style>\n" + css + "\n</style>";
133  
134    var version = String(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version || "");
135    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("package.json 的 version 不是 X.Y.Z 格式：" + JSON.stringify(version));
136    var versionScript = "<script>\nwindow.GAME_VERSION = " + JSON.stringify(version) + ";\n</script>";
137  
138    var dataObj = {};
139    DATA_FILES.forEach(function (name) { dataObj[name] = JSON.parse(read("data/" + name + ".json")); });
140    var dataScript = "<script>\nwindow.GAME_DATA = " + safeScript(JSON.stringify(dataObj)) + ";\n</script>";
141  
142    // Worker 原始碼：獨立的一段 IIFE，之後整段當成字串塞進 window.SOLVER_WORKER_SRC（ADR-001 §2.5）。
143    var workerSrc = buildModuleSource(WORKER_FILES, WORKER_ENTRY_LINE);
144    var workerBytes = Buffer.byteLength(workerSrc, "utf8");
145    var workerScript = "<script>\nwindow.SOLVER_WORKER_SRC = " + safeScript(JSON.stringify(workerSrc)) + ";\n</script>";
146  
147    // 主 bundle：同一支迷你註冊器（獨立作用域），載入 MAIN_FILES 後呼叫入口 ui/app.js。
148    var jsBody = buildModuleSource(MAIN_FILES, "__require(" + JSON.stringify(ENTRY) + ");");
149    var jsBlock = "<script>\n" + safeScript(jsBody) + "\n</script>";
150  
151    // 用函式替換：字串替換會把原始碼裡的 $&、$' 等當成特殊樣式，導致產物語法錯誤。
152    var html = template
153      .replace("<!-- INJECT:CSS -->", function () { return cssBlock; })
154      .replace("<!-- INJECT:VERSION -->", function () { return versionScript; })
155      .replace("<!-- INJECT:DATA -->", function () { return dataScript; })
156      .replace("<!-- INJECT:WORKER -->", function () { return workerScript; })
157      .replace("<!-- INJECT:JS -->", function () { return jsBlock; });
158  
159    var problems = check(html).concat(checkWorker(workerSrc, workerBytes));
160    if (problems.length) throw new Error("產物自檢失敗：\n- " + problems.join("\n- "));
161  
162    fs.writeFileSync(outPath, html, "utf8");
163    return {
164      bytes: Buffer.byteLength(html, "utf8"),
165      workerBytes: workerBytes,
166      files: MAIN_FILES.length,
167      workerFiles: WORKER_FILES.length,
168      data: DATA_FILES.length,
169      version: version
170    };
171  }
172  
173  /** 零外部資源與大小檢查（規格 A-05、T-BUILD-02、T-UI-04）。 */
174  function check(html) {
175    var problems = [];
176    // 只掃描 HTML 標籤層級的外連（JS／CSS 原始碼裡的字串不算資源引用），故先移除 <script>／<style> 內容再掃。
177    var shell = html.replace(/<script[\s\S]*?<\/script>/gi, "<script></script>").replace(/<style[\s\S]*?<\/style>/gi, "<style></style>");
178    if (/https?:\/\//i.test(shell)) problems.push("HTML 標籤層出現 http:// 或 https://");
179    if (/<link\b/i.test(shell)) problems.push("出現 <link");
180    if (/\bsrc\s*=\s*["'][^"']+["']/i.test(shell)) problems.push("出現外部 src=");
181    if (/@import/i.test(html)) problems.push("出現 @import");
182    if (/url\(\s*["']?https?:/i.test(html)) problems.push("CSS 出現外部 url(http…)");
183    // 程式碼層也不得引用網址（憲法第 3 節第 5 條：斷網可玩）。
184    var codeHits = html.match(/https?:\/\/[^\s"')]+/gi) || [];
185    codeHits = codeHits.filter(function (u) { return !/^https?:\/\/(www\.)?w3\.org\//i.test(u); }); // SVG 命名空間 URI 不是資源
186    if (codeHits.length) problems.push("原始碼出現網址：" + codeHits.slice(0, 3).join(", "));
187    var bytes = Buffer.byteLength(html, "utf8");
188    if (bytes >= MAX_BYTES) problems.push("檔案 " + bytes + " bytes ≥ " + MAX_BYTES);
189    return problems;
190  }
191  
192  /** Worker 字串自檢（T-BUILD-02、T-BUILD-03）：大小上限、語法正確、不含 ui/ 模組。 */
193  function checkWorker(workerSrc, workerBytes) {
194    var problems = [];
195    if (workerBytes >= MAX_WORKER_BYTES) problems.push("Worker 字串 " + workerBytes + " bytes ≥ " + MAX_WORKER_BYTES);
196    var hasUiModule = WORKER_FILES.some(function (rel) { return rel.indexOf("ui/") === 0; });
197    if (hasUiModule) problems.push("WORKER_FILES 不得包含 src/ui/ 模組：" + WORKER_FILES.filter(function (rel) { return rel.indexOf("ui/") === 0; }).join(", "));
198    try {
199      // 只檢查語法（Function 建構子不會執行函式主體），對應 T-BUILD-03「可被 new Function 解析」。
200      /* eslint-disable no-new-func */
201      new Function(workerSrc);
202    } catch (e) {
203      problems.push("Worker 字串語法錯誤：" + (e && e.message ? e.message : e));
204    }
205    return problems;
206  }
207  
208  if (require.main === module) {
209    var out = path.join(ROOT, "index.html");
210    var idx = process.argv.indexOf("--out");
211    if (idx > 0 && process.argv[idx + 1]) out = path.resolve(process.argv[idx + 1]);
212    try {
213      var r = build(out);
214      console.log(
215        "build 完成：" + path.relative(ROOT, out) + "（v" + r.version + "；" + r.bytes + " bytes；" +
216        r.files + " 個模組、" + r.data + " 個資料檔；Worker 字串 " + r.workerBytes + " bytes、" +
217        r.workerFiles + " 個模組；零外部資源）"
218      );
219    } catch (e) {
220      console.error("build 失敗：" + e.message);
221      process.exit(1);
222    }
223  }
224  
225  module.exports = {
226    build: build,
227    check: check,
228    checkWorker: checkWorker,
229    MAIN_FILES: MAIN_FILES,
230    WORKER_FILES: WORKER_FILES,
231    WORKER_ENTRY_LINE: WORKER_ENTRY_LINE,
232    CSS_FILES: CSS_FILES,
233    DATA_FILES: DATA_FILES,
234    MAX_BYTES: MAX_BYTES,
235    MAX_WORKER_BYTES: MAX_WORKER_BYTES,
236    // 沿用舊名 FILES，避免其他人誤 require 舊介面時直接壞掉（本段沒有其他人在用；保留以防萬一）。
237    FILES: MAIN_FILES
238  };
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
