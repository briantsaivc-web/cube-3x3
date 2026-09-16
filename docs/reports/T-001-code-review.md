# 回報：T-001 code-reviewer（G5 後段獨立程式審查）

| 欄位 | 內容 |
|---|---|
| 角色 | code-reviewer（唯讀；本檔是唯一寫入的檔案） |
| 任務 | T-001 魔術方塊 v0.1，G5 後段 |
| 日期 | 2026-09-16 |
| 審查基準 | `git diff 6950481..HEAD -- src tests build`（HEAD＝`2733b5e`；含 S11 `a6d0e85`、S12 `6b3b6d3`）＋指定檔案全檔抽查 |
| 輸入文件 | CLAUDE.md、`docs/spec/game-spec.md`、`docs/spec/ADR-001-solver.md`、`docs/tickets/T-001/dispatch.md`、`docs/reports/T-001-arch-review.md`、`T-001-arch-decisions.md`（D-1～D-34）、`T-001-S11.md`、`docs/reviews/T-001/triage.md`、`docs/qa/T-001-qa.md` |

---

## 1. 判定

# **通過**

- **Blocker 0、Major 0、Minor 5。** 5 項 Minor 都不會讓 engine state 出錯，也不違反 CLAUDE.md §3，不擋發布，建議列入 v0.2 或 G6 前由製作人決定是否順手修。
- CLAUDE.md §3 五條逐條核對都符合（見 §3）。S11 的輸入佇列與世代計數器、視角吸附、engine 前置條件，以及 S12 的 `previewGen` 和 `render()` transition 修正，都已逐行讀過，邏輯正確，測試也確實涵蓋原本的失敗情境。
- 我自己重跑了建置和快速測試（§4）：產物與根目錄 `index.html` 的 sha256 相同，快速測試 35/35 通過，`check-forbidden.sh` exit 0，工作區沒有被改動。

---

## 2. Findings（依嚴重度）

### Blocker
無。

### Major
無。

### Minor

**m-1　打亂動畫期間，「記號說明」與示範種類鈕仍可按下，教學示範和打亂動畫會同時播放**

- 位置：`src/ui/app.js:343-366`（`playScrambleAnim` 無法中途取消）、`src/ui/tutorial.js:399-409, 426-428`（`notationHelpDisabled` 只在 state 改變時重算）、`src/ui/demo-player.js:237-240`（`requestDemoKind` 沒有檢查 `ctx.input.locked()`）、`src/ui/cube-view.js:378-379`
- 問題：先送 `NEW_GAME`，後上鎖 `scramble-anim`。「記號說明」的 disabled 是在 dispatch 當下算的，那時還沒上鎖，而上鎖本身不會觸發重算，所以整段打亂動畫（25 步 × 60 ms，約 1.5 秒）期間按鈕都可以按。S12 的 `previewGen` 讓過期的回呼直接 return，但 return 的 Promise 仍然是 resolve，所以 `playScrambleAnim` 的鏈會繼續呼叫 `previewTurn`，和記號小教室的示範互相作廢。
- 失敗情境（實證，`scratchpad/cr-repro.js`，iPad 與手機兩種視圖結果相同）：
  - 按「打亂」後 200 ms 按「記號說明」：此時 `inputLocked()=true`，但按鈕 `disabled=false`。
  - 小教室在約 211 ms 打開，之後打亂的 60 ms 轉層仍持續到約 1,520 ms，共 76 個取樣幀是「小教室已開啟＋打亂動畫仍在播」。
  - 小教室第一段 U 示範從約 912 ms 開始，被打亂動畫蓋掉，玩家在「U 是轉上面」的卡片旁看到的是打亂的轉動。
  - 另一個實證（`scratchpad/cr-repro2.js`）：打亂後 100 ms 按「建議解示範」，`DEMO_REQUEST` 被接受，217 ms 就緒，當時仍在上鎖中。
  - 兩者最後畫面都會恢復一致（打亂結束時 `clearPreview()` 會呼叫 `render()`），state 沒有出錯，0 個 pageerror。
- 建議：方向有三個，擇一或併用。
  - 讓 `playScrambleAnim` 可以被中止：記錄自己的世代，`previewTurn` 回呼過期時停止後續步驟並解鎖。
  - `input.lock／unlock` 時通知訂閱者，讓「記號說明」重算 disabled。
  - `requestDemoKind`、`openLesson` 補上 `ctx.input.locked()` 的即時檢查。
  - 補一條「打亂動畫期間按記號說明、示範鈕」的 UI 測試。

**m-2　轉視角的佇列暫停（hold）只在吸附 Promise 的回呼裡解除；一旦收不到 pointerup，記號鍵也會跟著失效**

- 位置：`src/ui/gesture.js:210, 278`（`input.hold`）、`238-254`（只在 `.then` 內 `releaseViewHold`，沒有 `finally`）、`295-299`（`setPointerCapture` 失敗時靜默忽略）、`345-349`（沒有監聽 `lostpointercapture`）；`src/ui/app.js:88`（被 hold 時會一直輪詢）
- 問題：S11 讓轉視角期間暫停輸入佇列，所以 session 如果沒有正常結束，影響範圍就從「手勢失效」（S11 之前已存在）擴大到「記號鍵、撤銷、示範單步也全部失效」，只能重新整理頁面。
- 失敗情境（實證，`scratchpad/cr-repro.js` reproB，兩種視圖相同）：
  - 在方塊外送出 pointerdown（`pointerId` 未取得 capture，`setPointerCapture` 丟例外被吞掉），pointerup 落在舞台以外。
  - 接著按記號鍵 R，1.5 秒後 `cursor` 仍是 0、`queueSize=1`、`inputIdle=false`。
  - 真實觸控通常有隱含 capture，觸發機率低；但程式碼本身已預期 capture 可能失敗（註解寫「部分測試環境無此 API」）。另外，吸附回呼中的 `ctx.dispatch` 若拋出非 REJECT 例外，同樣會跳過 release。
- 建議：
  - `releaseViewHold` 改放在 `finally`。
  - 監聽 `lostpointercapture`，以及 `visibilitychange` 轉為 hidden 的時機，收尾 view session。
  - 或讓 hold 有上限時間（例如超過數秒未 release 就自動放行並 `clearDrag`）。

**m-3　主執行緒求解路徑沒有例外保護，也沒有 watchdog，與 Worker 路徑不一致**

- 位置：`src/ui/solver-client.js:263-289`（`solveOnMain`）、`300-310`（`pumpMain` 的 timer 回呼）、`523-529`（`mode==='failed'` 時 `submit` 同步呼叫 `lblOnMain`）
- 問題：Worker 路徑有 `handleMessage` 的 try/catch 轉 `INTERNAL`，也有 `solveTimeoutMs` watchdog。主執行緒路徑則有兩個缺口：
  - `twophase.solve`、`acceptSolve`、`lbl.generateLbl` 拋出例外時，job 永遠不會 resolve。
  - `failed` 模式下若同步拋例外，`requestHint／requestDemo` 會同步拋出。這時 `current` 還沒設定，等待卡的「取消」按了沒有作用，只能按「重設」或「打亂」才能離開 `hint.pending`／`demo.pending`（這段期間 TURN、UNDO、轉視角都會被拒絕）。
- 失敗情境（實證，`scratchpad/cr-solver.js`，Node）：
  - 注入 `createWorker` 拋錯（進入 mainThread）以及 `solve` 拋錯，timer 回呼丟出 `solver bug`，提示的 Promise 一直沒有結果，`status=mainThread`。
  - 呼叫 `cancel()` 後才得到 `HINT_FAILED/CANCELLED`。
  - 前提是求解器本身有 bug，而且裝置不能用 Worker，所以機率低。
- 建議：
  - `runOnMain`、`lblOnMain` 包 try/catch，例外時 `finish(job, failAction(job,'INTERNAL'))`，並在 finally 中繼續 `pumpMain()`。
  - `submit` 的同步分支改為回傳已 resolve 的失敗 action，不要直接拋出。

**m-4　`nearestOrient`／`snapTo` 已知只在朝向 0 時正確，卻仍留在 `ctx.view` 介面上**

- 位置：`src/ui/cube-view.js:418-423, 447-449, 477-478`
- 問題：B-2 的根因就是這兩個函式。S11 只加了註解「本案不再使用」，函式仍然匯出，日後維護者很容易再用錯。
- 失敗情境：新模組照舊契約呼叫 `snapTo(nearestOrient(m))`，從非 0 朝向拖曳時，會重現 B-2（點一下就跳回朝向 0）。
- 建議：v0.2 移除，或改成以 `fromOrient` 為必要參數的同名函式，並同步更新 S8a 介面契約。

**m-5　兩處測試寫法較脆弱**

- 位置：`tests/engine/data.test.js:217`（T-DATA-10）、`tests/engine/reducer.test.js:437`（T-ENG-22）
- 問題：
  - T-DATA-10 以 `code.includes("." + key)` 判斷欄位有沒有被程式讀取。像 `length`、`enabled`、`defaultOn` 這類常見鍵名，即使完全沒被使用也會判定為「有讀」。S11 報告證明它抓得到 `showSubLabels`，但對常見名稱沒有鑑別力。
  - T-ENG-22 用寫死的 `samples.slice(19)` 區分「S11 新增樣本」。目前索引正確（已逐一核對：19 號是 `TURN 'R3'`），但只要前面插入一筆樣本，就會悄悄漏驗一筆，或把合法樣本誤判為失敗。
- 失敗情境：把 `params.scramble.length` 的讀取刪掉，T-DATA-10 仍然通過；在第 18 號之前插入一筆樣本，最後一筆格式錯誤的樣本就不再被逐項斷言。
- 建議：
  - T-DATA-10 改成比對完整路徑的最後兩段（例如 `scramble.length`），或改用存取追蹤（Proxy）實際載入各模組。
  - T-ENG-22 在每筆樣本上加標記（例如第三欄 `malformed:true`），不要依賴索引。

---

## 3. CLAUDE.md §3 五條逐條

| 原則 | 結論 | 依據 |
|---|---|---|
| 1 狀態只能透過 action 前進 | 符合 | engine 本輪只收緊前置條件（`isMove`、`hintPending`、`missingData`、`invalidTokens`、`invalidSegments`），`canApply` 與 `reduce` 共用 `checkAction`，T-ENG-22 新增 27 個樣本驗證兩者一致。UI 的輸入佇列只延後 dispatch、取出時重檢 `canApply`，沒有自行計算規則。 |
| 2 seeded RNG | 符合 | 本輪沒有新增任何亂數來源；`randomSeed()` 只在 UI 層產生 `NEW_GAME` 的 seed（§5 既定）。`check-forbidden.sh` exit 0。 |
| 3 資料驅動 | 符合 | 新增的 `hintErrorShowMs`、`demoErrorShowMs`、`input.*`、`debug.*` 都放在 `params.json`；程式裡的數字只作為 `numOr` 在鍵缺少時的後備值，且與資料檔一致（沿用 D-3／D-25 的裁決）。文案 `viewCube`、`result.best`、`confirm.newGameInProgress` 都在 `texts.json`。 |
| 4 觸控優先 | 符合 | `.hint-close` 已放大到 44×44；「看看方塊」使用 `.ctl`；QA T-UI-03 在兩種視圖掃描 10 個畫面，`bad=[]`。沒有新增任何只能靠 hover 或鍵盤完成的操作。iPad 字級 < 14 px 已由 QA Minor-1 記錄，不重複列。 |
| 5 零依賴 | 符合 | `build/` 本輪沒有變更；建置結果「零外部資源」；`src/` 中沒有任何外部網址。 |

確定性：佇列只影響 UI 層的時間與順序，`at` 仍由 UI 帶入（改在動畫結束、`build()` 被再次呼叫時取值）。engine、solver 沒有新增時鐘或物件迭代順序的依賴。`buildCameraRot` 的 BFS 順序固定，`nearestOrientIn` 同分時取第一個，結果是決定性的。

---

## 4. 我自己跑的證據

```
$ node build/bundle.js --out <scratchpad>/cr-index.html
build 完成：…cr-index.html（v0.0.0；372477 bytes；18 個模組、4 個資料檔；Worker 字串 84029 bytes、5 個模組；零外部資源）
$ sha256sum index.html <scratchpad>/cr-index.html
6fa3a005…8167f0f  index.html
6fa3a005…8167f0f  cr-index.html            ← 與 QA 報告記錄的雜湊相同

$ node --test tests/engine/ui-logic.test.js tests/engine/reducer.test.js tests/engine/cube.test.js tests/engine/data.test.js
# tests 35 / # pass 35 / # fail 0（0.46 秒）

$ bash .claude/hooks/check-forbidden.sh; echo exit=$?     → exit=0
$ git status --short                                      → （空；工作區未被改動）
```

- 沒有重跑完整的 `test:engine`（約 3 分鐘，主要是 1,000 局求解）和完整的 `test:ui`。這兩項 QA 報告已經獨立重跑並通過，本審查不重做 QA 的工作。
- 重現腳本（都在 scratchpad，不進版控）：`cr-repro.js`（m-1、m-2）、`cr-repro2.js`（m-1 的示範鈕部分）、`cr-solver.js`（m-3）。以 `NODE_PATH=scratch/spike-solver/node_modules` 在 Playwright Chromium 上執行，使用 1194×834 與 390×844 兩種視圖。

---

## 5. 審查範圍

### 5.1 重點 diff（逐行讀過）

`git diff 6950481..HEAD -- src tests build` 共 26 個檔案，+1829／−203：

- **engine**：`src/engine/cube.js`（`isMove`、各函式嚴格檢查、`deepFreeze`）、`src/engine/reducer.js`（`isValidHintTokens`、`isValidDemoTokens`、`hasScrambleParams`、`hintPending`）。
- **UI 核心**：
  - `src/ui/app.js`：`createInputQueue`（世代計數器、`hold`／`release`、`finish` 的 try/finally）、`QUEUE_CLEAR_TYPES`、`paramsPatch`、REJECT 環狀記錄。
  - `src/ui/gesture.js`：`fromOrient`、`snapFrom`、hold，以及手勢的送出改走佇列。
  - `src/ui/cube-view.js`：`buildCameraRot`、`nearestOrientFromIn`、`relativeSnapMatrix`、`previewGen`、`previewTurn` 對整顆旋轉的處理、`render()` 的 transition 修正。
- **UI 其他**：
  - `src/ui/controls.js`、`demo-player.js`：`enqueueStepForward`／`enqueueStepBack`、B-1 先 dispatch 再處理副作用、`wasDemoReady`。
  - `src/ui/hint-view.js`、`records.js`（最佳紀錄、「看看方塊」）、`solver-client.js`（`revokeOnce`）、`tutorial.js`。
  - CSS：`demo.css`、`overlay.css`；資料：`params.json`、`texts.json`。
- **測試**：`tests/engine/ui-logic.test.js`（T-UI-29、T-UI-30）、`reducer.test.js`、`cube.test.js`、`data.test.js`、`tests/ui/checks3.js`（T-UI-24～28）、`checks4.js`（T-UI-31～33）、`checks.js`、`checks2.js`、`dom-helpers.js`、`smoke.spec.js`；`triage-g45.js` 只看了用途，它不列入 smoke。
- `build/` 在這個範圍內沒有變更。

### 5.2 全檔抽查（錯誤處理與逾時路徑）

- `src/engine/`：`reducer.js` 全檔、`cube.js` 的 §5～§11。
- `src/solver/worker.js` 全檔：`handleMessage` 的 try/catch、init 失敗回 `INTERNAL`、`NOT_INITIALIZED` 對應 `NOT_READY`。
- `src/ui/solver-client.js` 全檔，包含以下路徑：
  - `boot`、`toMainThread`、`toFailed`
  - `onInitTimeout`、`onSolveTimeout`（重建 Worker 並退回）
  - `NOT_READY` 重送一次、`handleReply` 的格式錯誤處理
  - `cancel`、`dispose`、計畫快取

### 5.3 重點項目結論

- **輸入佇列**：
  - `clear()` 會遞增世代，讓正在播放、尚未送出的那一步作廢，排隊中的項目也會呼叫 `after(false)`。
  - `finish()` 在 finally 中呼叫 `after` 並繼續 `pump`。
  - 取出時與動畫結束後各檢查一次 `canApply`。
  - 上鎖時的清空，都伴隨一次 `render()`（`clearDemo` 會呼叫 `clearPreview`，`NEW_GAME` 則由 dispatch 觸發），所以不會留下沒送出卻已轉開的畫面。
  - T-UI-30 以假時鐘涵蓋依序執行、上限、重檢、`clear`、上鎖、`hold`、reject 七種情況。
- **視角吸附**：
  - 目標朝向＝`nearest(D·Q(from))`，吸附終點＝`Q(to)·Q(from)ᵀ`，與 `render()` 換成新朝向顏色、transform 歸零後的畫面一致。
  - 點一下（D＝單位矩陣）不送 action；`SET_ORIENT` 被拒絕時（例如拖曳期間開始等提示）以 `clearDrag` 彈回。
  - T-UI-29 對 24 個朝向 × 54 格位置與法向量，以及 24×24 組相對終點逐一驗證。
- **engine 前置條件**：原本可能拋出非 REJECT 例外的輸入（`R3`、`xx`、`constructor`、數字、缺欄位、`null` action、缺 data）都改回 `REJECT:<TYPE>:<reason>`；規格 §4 已補上新的 reason 碼（第 313、315 行）。
- **S12**：
  - `previewGen` 在 `clearPreview` 與每次新的 `previewTurn` 時遞增，過期的回呼不再重畫（E-2）。
  - 整顆旋轉改用 `rotateWholeCube`（E-1）。
  - `render()` 在沒有拖曳時先設 `transition:none`（N-1）。已確認 `.cube-world` 在 CSS 中沒有 transition 規則，所以 inline 的 `none` 不會蓋掉其他設計。
  - 唯一的副作用見 m-1：過期回呼 resolve 而不是 reject，呼叫端的鏈會繼續執行。

---

## 6. 未審查到的部分（明確列出）

- `src/solver/twophase.js`、`src/solver/lbl.js` 的演算法內部（本輪沒有變更；只看了對外的回傳錯誤碼）。
- `src/engine/scramble.js`、`selectors.js`、`rng.js`、`index.js`，以及 `cube.js` 的 §1～§4 幾何建構（本輪沒有變更）。
- `src/ui/notation.js`、`styles.css`、`index.template.html`；`records.js`、`tutorial.js`、`demo-player.js`、`controls.js` 中本輪沒有改到的部分，只讀了與 diff 相關的段落。
- `build/bundle.js`（範圍內沒有變更；只以 `--out` 驗證決定性）。
- 完整的 `npm run test:engine`（1,000 局求解）與 `npm run test:ui`（沿用 QA 報告的獨立重跑結果）。
- iPad Safari／iPhone 實機行為，例如隱含 pointer capture 是否可靠、CSS 3D 渲染（屬 M-01～M-07，AI 無法驗證）。
- `tests/ui/triage-g45.js` 的內容細節（不在 smoke 內）；`docs/qa/shots/` 截圖沒有逐張檢視。

---

## 7. 未預期發現

1. `src/` 與 `tests/` 裡有 20 多個 `.backup.*` 檔案（例如 `src/ui/app.js.backup.20260915s11`、`tests/engine/reducer.test.js.backup.20260915s11`）。`.gitignore` 已排除，`build/bundle.js` 使用寫死的 `MAIN_FILES` 清單，`node --test` 的萬用字元也只比對 `*.test.js`，所以目前不會被打包或執行。但 grep 時會出現重複命中，容易誤導之後的審查者（本次審查已用 `grep -v backup` 過濾）。建議 G6 前由 release-manager 決定是否清理。
2. `numOr` 在 `app.js`、`controls.js`、`gesture.js`、`demo-player.js`、`hint-view.js` 各有一份。這是 S11 刻意沿用的慣例（X-7：新增模組就要改 build），不列為 finding；v0.2 若調整 `MAIN_FILES`，可以抽成共用模組。
3. `params.ui.timerRefreshMs`、`input.queuePollMs` 改用 `numOr` 後，0 也會被接受，實際效果是 `setInterval(fn, 0)`／`setTimeout(fn, 0)` 的忙碌輪詢。目前 T-DATA-04 要求這兩個值為正數，所以資料檔不會出現 0；只是程式本身沒有下限保護。
4. `app.js:232` 的 `data.params.layout` 沒有經過 `params` 的後備值（其他地方都用 `params`）。`GAME_DATA` 缺少 `params` 時會拋 TypeError。這是 S8a 就存在的寫法，正常打包不會觸發。
5. 本次審查沒有修改任何 `src/`、`tests/`、`build/`、`index.html`，也沒有執行 commit；重現腳本和建置產物都放在 session 的 scratchpad。
