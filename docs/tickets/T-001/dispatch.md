# T-001 魔術方塊 v0.1 — G4 分派單

> 由 systems-engineer 填寫（2026-09-15；同日依 G3.5 拍板修訂）。本檔同時涵蓋 `docs/templates/任務單.md` 的必填區塊（目標、驗收、回報格式、交叉影響），本任務不另出 `ticket.md`。
> 狀態：**G3.5 已拍板，可全部開工**（2026-09-15：版型 C、記號教學、「建議解示範」、視角吸附、撤銷扣回步數；各段仍依 §1 的前置順序進行）
> 依據：`docs/spec/game-spec.md` **v0.1.1**（含附錄 C「G3.5 修訂對照表」）、`docs/ui/decision-log.md`、`docs/ui/v1-C.html`（選定版型，只讀）、`docs/spec/ADR-001-solver.md`、`docs/decision-log.md`、`CLAUDE.md`

---

## 0. 目標與驗收

- **一句話**：製作人在 iPad／手機上打開單一 `index.html`（版型 C：方塊＋學習面板），可以打亂、用手勢或記號鍵（附中文副標）轉方塊、撤銷／重做／重設、看計時與 QTM 步數；第一次開啟有教學與記號小教室；卡住時看下一步提示，或看電腦用「建議解示範」與層先法（分段暫停、公式附白話用途）逐步示範，每一步都有白話說明；全程斷網可用。
- **對應 Gate**：G4（製作），完成後交 systems-engineer 架構審查，再進 G4.5。
- **來源**：decision-log 2026-09-15 G0、G2、G3.5 全部拍板。
- **驗收**：`game-spec.md` §12 全部測試（T-ENG、T-SOL、T-LBL、T-BUILD、T-UI、T-DATA）通過；§12.7 M-01～M-05 由製作人本機驗。每段下方列出負責的測試。
- **回報**：每段寫 `docs/reports/T-001-S<n>.md`（依 `docs/templates/回報.md`）；對話中只放結論 3 行、檔案路徑、需製作人決定的事。
- **範圍外**：`game-spec.md` §0.2 N-1～N-9。

---

## 1. 分段總覽

| 段 | 名稱 | 負責 | 模型 | 前置 | 可並行 | 預估 session |
|---|---|---|---|---|---|---|
| S1 | 資料檔＋資料測試 | game-engineer | sonnet | 無 | 與 S2 並行 | 0.5 |
| S2 | engine 方塊模型（rng、cube、scramble） | game-engineer | sonnet | 無 | 與 S1 並行 | 1 |
| S3 | engine reducer＋selectors | game-engineer | sonnet | S1、S2 | 與 S4、S5 並行 | 1.5 |
| S4 | 兩階段求解器（spike 改寫） | game-engineer | **opus** | S2 | 與 S3、S5 並行 | 1 |
| S5 | 層先法產生器 | game-engineer | **opus** | S1、S2 | 與 S3、S4 並行 | 1.5 |
| S6 | Worker 與 solver-client | game-engineer | **opus** | S3、S4、S5 | 序列 | 1 |
| S7 | build 改寫＋UI 空殼檔 | game-engineer | sonnet | S6 | 序列 | 0.5 |
| S8a | UI 骨架：版型 C（學習面板、分頁、抽屜）、CSS 3D 方塊、面標籤、記號鍵（副標、分組、摺疊）、HUD、`notation.js`、測試掛鉤 | game-engineer | sonnet | S7（G3.5 已拍板） | 序列 | 2 |
| S8b | UI 手勢與轉視角 | game-engineer | sonnet | S8a | 與 S8c、S8d 並行 | 1 |
| S8c | UI 提示、示範分頁與播放器、白話說明、分段暫停卡片、求解器狀態 | game-engineer | sonnet | S8a | 與 S8b、S8d 並行 | 2 |
| S8d | UI 完成畫面、最佳紀錄、首次教學＋記號小教室、「記號說明」 | game-engineer | sonnet | S8a | 與 S8b、S8c 並行 | 1.5 |
| S9 | Playwright UI 測試 | game-engineer | sonnet | S8b、S8c、S8d | 序列 | 1.5 |
| — | 架構審查 | systems-engineer | opus | S1–S9 回報 | 序列 | 0.5 |
| S10 | 審查包（G4.5） | review-packager | haiku | 架構審查通過 | 序列 | 0.5 |

依賴圖：

```
S1 ─┬──────────► S3 ─┐
S2 ─┼──► S4 ─────────┼──► S6 ──► S7 ──► S8a ──┬─► S8b ─┐
    └──► S5 ◄── S1   │                        ├─► S8c ─┼─► S9 ──► 架構審查 ──► S10
                     │          (G3.5 已拍板)───┘ └─► S8d ─┘
```

合計約 15 session（推論，依第一款的實際節奏估計；G3.5 修訂使 S8a、S8c 各 +0.5、S8d +1、S9 +0.5）。

---

## 2. 共通規則（每段都適用）

- 動工前讀：`CLAUDE.md`、本分派單該段、`game-spec.md` 指定章節、`ADR-001-solver.md`。
- engine／solver 檔案不得出現 `check-forbidden.sh` 所列字串（**含註解**）；不得把字串加進 `.claude/hooks/forbidden-allowlist.txt`。
- 測試名稱以 `game-spec.md` §12 的編號字串原樣出現在測試檔裡。
- 測試放 `tests/engine/`（solver 相關放 `tests/engine/solver/`，才會被 `npm run test:engine` 的 `tests/engine/**/*.test.js` 找到）與 `tests/ui/`。
- 每段只用自己的測試輔助檔（例：`tests/engine/helpers-s3.js`），不共用、不修改別段的輔助檔。
- **不得修改** `package.json`、`CLAUDE.md`、`docs/`（自己的回報檔除外）、`.claude/`。
- 可參考 `scratch/g3-check/`（G3 驗證原型，不進版控）理解做法，但產品程式必須依規格重寫、加上完整測試；不得整檔複製。
- 同一問題錯兩次就停，回報 systems-engineer。

---

## 3. 各段細目

### S1 資料檔＋資料測試（sonnet）

- **要寫的檔案**：`src/data/texts.json`、`src/data/palette.json`、`src/data/params.json`、`src/data/lbl.json`（皆新增）；`tests/engine/data.test.js`（新增）。
- **不可碰**：`src/engine/`、`src/solver/`、`src/ui/`、`build/`。
- **輸入**：`game-spec.md` §10.1–§10.4（內容逐字照抄，數值不得自改；含 G3.5 新增的 `texts.panel`／`keypad`／`notation`／`demo.*`、`palette.stickers[].labelInk`、`params.ui.snapAnimMs`／`baseViewDeg`、`params.layout`／`keypad`／`faceLabels`／`tutorial`、`params.demo.pauseAtSegmentEnd`、`lbl.json` 各公式的 `desc`）。
- **輸出契約**：四檔為合法 UTF-8 JSON；結構與規格範例完全相同。
- **測試**：`T-DATA-01`～`T-DATA-06`、`T-DATA-08`、`T-DATA-09`（`T-DATA-07` 需要 engine 與 `notation.js`，由 S8a 寫）。`T-DATA-05` 的簡體字表由本段建立（至少 40 個常見簡體字，**在測試檔中以 `\uXXXX` 跳脫寫法存放**，避免文件與原始碼出現簡體字；可用「這、個、們、說、設、計、時、數、據、級、轉、動、層、邊、塊、角、復、順、鐘、視、圖、顯、示、鍵、錄、紀、頁、確、認」等字的簡體寫法）。
- **回報**：`docs/reports/T-001-S1.md`。

### S2 engine 方塊模型（sonnet）

- **要寫的檔案**：`src/engine/rng.js`、`src/engine/cube.js`、`src/engine/scramble.js`（新增）；`tests/engine/cube.test.js`、`tests/engine/scramble.test.js`（新增）。
- **不可碰**：`src/data/`（本段不讀資料檔；`makeScramble` 以參數接收 `{length}`，測試內直接傳 `{length: 25}`）、`src/solver/`、`src/ui/`、`build/`。
- **輸入**：`game-spec.md` §1、§2.1、§2.4（`describeMove`）、§3.1–§3.3、§5、§9.2 第 3 點。
- **輸出契約**：
  - `rng.js`：`makeRng(seed) → () => number`（xorshift32，與 spike 相同）。
  - `cube.js`：`MOVES`（36 個記號，順序：外層 `U R F D L B` × `["", "2", "'"]`，接著 `M E S`，接著 `x y z`，各 × 同一組後綴）、`SOLVED`（int[54]）、`STICKER_POS`、`STICKER_NRM`、`FACE_AXES`、`applyMove(stickers, move)`、`applyMoves(stickers, moves)`、`inverse(move)`、`kind(move) → 'outer'|'slice'|'rotation'`、`qtmCost(move)`、`isSolved(stickers)`、`ORIENT_COUNT = 24`、`orientAfter(o, rotation)`、`applyOrient(home, o)`、`toHome(o, viewMove)`、`toView(o, homeMove)`、`layerStickers(move) → int[]`（該記號會移動的貼紙索引）、`gestureToMove(viewIndex, dir3)`、`parseMoves(str)`（接受 `'` `’` `′`）、`formatMove(move) → 顯示字串（′）`、**`describeMove(move) → {move, base, kind, turn:'cw'|'ccw'|'half', qtm}`**（G3.5 新增，`game-spec.md` §2.4）。所有函式純函數、回傳新陣列。
  - `scramble.js`：`makeScramble(seed, {length}) → string[]`；seed 不是 uint32 時拋錯。
- **測試**：`T-ENG-01`～`T-ENG-04`、`T-ENG-06`～`T-ENG-11`、`T-ENG-25`（`T-ENG-05` 由 S4 寫，因為要載入求解器）。
- **注意**：`T-ENG-08` 需要鎖定 24 朝向的編號；本段先實作、把實際值寫進測試，並在回報列出 `orientAfter(0,'x')`、`orientAfter(0,'y')`、`orientAfter(0,'z')` 的值，之後任何人都不得改變編號。
- **回報**：`docs/reports/T-001-S2.md`。

### S3 engine reducer＋selectors（sonnet）

- **要寫的檔案**：`src/engine/reducer.js`、`src/engine/selectors.js`、`src/engine/index.js`（新增）；`tests/engine/reducer.test.js`、`tests/engine/invariants.test.js`、`tests/engine/forbidden.test.js`（新增）。
- **不可碰**：`src/engine/cube.js`、`rng.js`、`scramble.js`（只能 `require`；需要新函式 → 回報 systems-engineer）、`src/data/`、`src/solver/`、`src/ui/`、`build/`。
- **輸入**：`game-spec.md` §3.4–§3.6、§4、§6.1–§6.3（G3.5：`specVersion` 為 `"0.1.1"`；`PAUSE` 的 `reason` 可為 `hidden` 或 `lesson`）。
- **輸出契約**：
  - `reducer.js`：`initialState() → state`、`reduce(state, action, data) → state`（`data` 只用到 `data.params.scramble`）、`canApply(state, action, data) → boolean`。
  - `selectors.js`：`game-spec.md` §4.1 全部。
  - `index.js`：匯出 reducer、selectors 與 `cube.js` 的公開函式（UI 與 solver-client 只從這裡 `require`）。
  - state 欄位與 §3.5 完全一致（不得多、不得少；`T-ENG-14` 檢查鍵集合）。
- **測試**：`T-ENG-12`～`T-ENG-24`、`T-ENG-26`。`T-ENG-24` 用 Node 讀檔掃描 `src/engine/` 與 `src/solver/`（正規表示式與 `check-forbidden.sh` 相同）。
- **回報**：`docs/reports/T-001-S3.md`。

### S4 兩階段求解器（opus）

- **要寫的檔案**：`src/solver/twophase.js`（新增，由 `docs/spike/code/solver.js` 改寫）；`tests/engine/solver/twophase.test.js`（新增）。
- **不可碰**：`docs/spike/`（唯讀）、`src/engine/`（只能 `require` 做測試對照）、`src/data/`、`src/ui/`、`build/`。
- **輸入**：`game-spec.md` §3.4、§7（尤其 §7.3 的 8 點）；`ADR-001-solver.md` §2.2–§2.4；`docs/spike/solver-spike.md`。
- **輸出契約**：`game-spec.md` §7.2 的 `init`、`tableInfo`、`solve`、`fromStickerColors`；另匯出 `verify`、`faceletsToCubie`、`cubieToFacelets`、`applyMoveFacelets`、`applyMoves`、`isSolved`、`newCube`、`randomCube`、`makeRng`、`MOVE_NAMES`、`qtmLength`（測試與層先法對照用）。`solve` 回傳的 `moves` 另提供字串版 `names`（例 `["R","U2","F'"]`）。
- **測試**：`T-ENG-05`、`T-SOL-01`～`T-SOL-07`、`T-SOL-09`、`T-SOL-10`。`T-SOL-03` 是 1,000 局、每局約 0.1 秒，可接受。
- **必須在回報附上**：`T-SOL-03` 的 QTM 直方圖與耗時；`T-SOL-10` 建表時間；確認 spike 第 23–25 行與第 312 行的處理方式。
- **回報**：`docs/reports/T-001-S4.md`。

### S5 層先法產生器（opus）

- **要寫的檔案**：`src/solver/lbl.js`（新增）；`tests/engine/solver/lbl.test.js`（新增）。
- **不可碰**：`src/data/lbl.json`（只讀；發現公式或 `guards` 有問題 → 回報，不自改）、`src/engine/`（只能 `require`）、`src/ui/`、`build/`。
- **輸入**：`game-spec.md` §8 全部；`src/data/lbl.json`；`src/data/texts.json` 的 `lbl`（只在測試中核對鍵）。
- **輸出契約**：`generateLbl(viewStickers, config) → {tokens, segments, qtm} | {error}`，格式見 §8.2；另匯出 `STAGE_CHECKS`（每段完成判定函式，供 `T-LBL-08`）。
- **測試**：`T-LBL-01`～`T-LBL-10`。`T-LBL-03`（62,208 種）與 `T-LBL-04`（7,495 種）在 G3 原型合計數秒內可跑完。
- **必須在回報附上**：`T-LBL-10` 的步數分布表，與 `game-spec.md` §8.5 對照（差異超過 10% 要說明原因）；各迴圈實際最大次數。
- **回報**：`docs/reports/T-001-S5.md`。

### S6 Worker 與 solver-client（opus）

- **要寫的檔案**：`src/solver/worker.js`、`src/ui/solver-client.js`（新增）；`tests/engine/solver/worker.test.js`、`tests/engine/solver/client.test.js`（新增）。
- **不可碰**：`src/solver/twophase.js`、`lbl.js`（只能 `require`；介面不合 → 回報）、`src/engine/`、`src/data/`、`build/`、其他 `src/ui/` 檔。
- **輸入**：`game-spec.md` §7.5、§9.4–§9.6；`ADR-001-solver.md` §2.5–§2.6。
- **輸出契約**：
  - `worker.js`：`handleMessage(msg, post)`；**本檔不接 `self.onmessage`**（由 S7 在 Worker 字串的入口包一層），因此可在 Node 直接測。
  - `solver-client.js`：`createSolverClient(deps) → client`，`deps = {createWorker, setTimer, clearTimer, now, engine, params, lblConfig, onStatus}`（全部由外部注入，讓 Node 測試可以用假 Worker 與假時鐘）。`client` 提供：`start()`、`status()`（`booting｜building｜ready｜mainThread｜failed`，含進度 k/6）、`requestHint(state) → Promise<READY 或 FAILED action>`、`requestDemo(state, kind) → Promise<action>`、`cancel()`。計畫快取、逾時、退回層先法都在這裡。
  - 預設的 `createWorker`（瀏覽器用）以 `window.SOLVER_WORKER_SRC` 建 Blob Worker；失敗時丟例外讓 client 轉 `mainThread`。
- **測試**：`T-SOL-08`；`client.test.js` 至少涵蓋：快取命中時不送 Worker 訊息、照提示轉後下一個提示來自快取、`solveTimeoutMs` 逾時會 `terminate` 並退回層先法、`NODE_LIMIT` 退回層先法、`createWorker` 丟例外 → `mainThread`、`initTimeoutMs` 逾時 → `failed`、取消後遲到的結果被丟棄。
- **回報**：`docs/reports/T-001-S6.md`。

### S7 build 改寫＋UI 空殼檔（sonnet）

- **要寫的檔案**：`build/bundle.js`（改寫；先備份 `build/bundle.js.backup.<YYYYMMDD>`）；`tests/engine/build.test.js`（新增）；UI 空殼（僅在檔案不存在時建立，內容為最小可運作版本）：`src/ui/index.template.html`、`src/ui/styles.css`、`src/ui/demo.css`、`src/ui/overlay.css`、`src/ui/app.js`、`src/ui/cube-view.js`、`src/ui/controls.js`、`src/ui/gesture.js`、`src/ui/hint-view.js`、`src/ui/demo-player.js`、`src/ui/records.js`、`src/ui/tutorial.js`、`src/ui/notation.js`（G3.5 新增；空殼為 `module.exports = {};`，其餘 JS 空殼為 `module.exports = { mount: function (ctx) {} };`，`app.js` 空殼只 `require` 各模組並呼叫 `mount`）。
- **不可碰**：`src/engine/`、`src/solver/`、`src/data/`、`src/ui/solver-client.js`、`package.json`。`notation.js` 不得放進 Worker 字串（T-BUILD-03：Worker 不含任何 `src/ui/` 模組）。
- **輸入**：`game-spec.md` §9.5 最後一點、§12.4；`ADR-001-solver.md` §2.5；現有 `build/bundle.js`（第一款遊戲的版本，保留其註冊器、`safeScript`、`check()` 的做法）。
- **輸出契約**：
  - 主 bundle 檔案清單（寫死，依此順序）：`engine/rng.js`、`engine/cube.js`、`engine/scramble.js`、`engine/selectors.js`、`engine/reducer.js`、`engine/index.js`、`solver/twophase.js`、`solver/lbl.js`、`ui/solver-client.js`、`ui/notation.js`、`ui/records.js`、`ui/tutorial.js`、`ui/cube-view.js`、`ui/gesture.js`、`ui/controls.js`、`ui/hint-view.js`、`ui/demo-player.js`、`ui/app.js`；入口 `ui/app.js`。
  - Worker 字串檔案清單：`engine/rng.js`、`engine/cube.js`、`solver/twophase.js`、`solver/lbl.js`、`solver/worker.js`；入口由 bundle 產生：`var h = __require("solver/worker.js"); self.onmessage = function (e) { h.handleMessage(e.data, function (m) { self.postMessage(m); }); };`（此段在 `build/`，不受 hook 檢查）。
  - CSS 清單：`ui/styles.css`、`ui/demo.css`、`ui/overlay.css`。資料清單：`texts`、`palette`、`params`、`lbl`（注入為 `window.GAME_DATA`）。
  - template 標記：`<!-- INJECT:CSS -->`、`<!-- INJECT:VERSION -->`、`<!-- INJECT:DATA -->`、`<!-- INJECT:WORKER -->`（輸出 `window.SOLVER_WORKER_SRC = "<JSON 字串>";`）、`<!-- INJECT:JS -->`。
  - 自檢：沿用 `check()`；上限改為產物 < 300 KB、Worker 字串 < 100 KB；決定性輸出。
- **測試**：`T-BUILD-01`～`T-BUILD-03`。
- **回報**：`docs/reports/T-001-S7.md`（附產物大小與 Worker 字串大小）。

### S8a UI 骨架（sonnet；G3.5 已拍板，S7 完成即可開工）

- **前提**：`docs/ui/decision-log.md` 已拍板 C（2026-09-15）。若版型與 `game-spec.md` §9、§11 的行為規則矛盾 → 停下回報 systems-engineer，不自行取捨（`game-spec.md` §11.1 已列出已知差異，照規格做）。
- **要寫的檔案**：`src/ui/index.template.html`、`src/ui/styles.css`、`src/ui/app.js`、`src/ui/cube-view.js`、`src/ui/controls.js`、`src/ui/notation.js`（皆覆寫 S7 空殼）；`tests/engine/notation.test.js`（新增）。
- **不可碰**：`gesture.js`、`hint-view.js`、`demo-player.js`、`records.js`、`tutorial.js`、`demo.css`、`overlay.css`（屬 S8b–S8d）、`src/ui/solver-client.js`、`src/engine/`、`src/solver/`、`src/data/`、`build/`。
- **輸入**：`game-spec.md` §2.4、§3.2、§4.1、§6.1–§6.2、§9.3（基準視角、吸附動畫時間）、§9.4（狀態顯示的位置）、§11.1、§11.2、§11.4；`docs/ui/decision-log.md`；`docs/ui/v1-C.html`（版面、配色參考，只讀）。
- **輸出契約**：
  - `index.template.html`＋`styles.css`：版型 C（§11.1）——iPad 橫向左欄（狀態列、方塊區、操作列）＋右欄學習面板；手機直向單欄＋方塊下方抽屜（文件流，展開時壓縮方塊區）；面板頂列、分頁「操作」「示範」；只有一份 DOM、`id` 不重複；`[hidden]{display:none!important}`。提供下列**插槽**（空容器，`data-slot` 屬性），其他段只能把自己的元素掛進自己的插槽：
    - `data-slot="lesson-button"`（面板頂列／手機手把列）→ S8d
    - `data-slot="lesson-card"`（學習面板內，顯示時蓋住分頁內容）→ S8d
    - `data-slot="overlay"`（完成畫面等置中卡片）→ S8d
    - `data-slot="hint-button"`（操作列內「提示」按鈕的位置）→ S8c
    - `data-slot="hint"`（方塊區內的提示浮層）→ S8c
    - `data-slot="demo"`（「示範」分頁內容）→ S8c
    - `data-slot="solver-status"`（求解器狀態與等待卡片）→ S8c
  - `app.js`：建立 store（`getState`、`dispatch`、`subscribe`；`dispatch` 內呼叫 engine `reduce`，遇到 `REJECT` 只記錄不崩潰）、建立 `solver-client` 並 `start()`、組 `ctx = {root, data, engine, notation, getState, dispatch, subscribe, solver, anim, view, panel, input, slot}` 後依序呼叫各模組 `mount(ctx)`；監聽 `visibilitychange` 送 `PAUSE {reason:"hidden"}`；`NEW_GAME` 的 seed 產生（§5）；`?test=1` 時建立 `window.__cubeTest`（§12.5），並在 `?test=1&tutorial=0` 時把 `params.tutorial.enabled` 視為 false。
  - `ctx.anim`：`turn(viewMove, ms) → Promise`、`rotate(rotation, ms) → Promise`、`busy()`，供手勢與示範共用；動畫中其他輸入被擋。
  - `ctx.view`（`cube-view.js`）：以 CSS 3D 渲染 `viewStickers`；每張貼紙元素帶 `data-sticker`（view 索引）；基準視角取 `params.ui.baseViewDeg`；提供 `projectAxes(viewIndex) → {right:{x,y}, down:{x,y}}`、`setDragRotation(matrix)`、`clearDrag()`、`nearestOrient(matrix) → 0..23`、`snapTo(orient, ms) → Promise`、`highlight(indices)`、**`setFaceLabels(on)`、`faceLabels() → boolean`**（面標籤，§11.2）、**`previewTurn(baseStickers, viewMove, ms) → Promise`、`clearPreview()`**（只改畫面、不碰 state，供記號小教室，§11.3）。
  - `ctx.panel`：`selectTab('controls'|'demo')`、`currentTab()`、`expand(on)`（手機抽屜；iPad 無作用）、`expanded()`。操作列「看電腦解」由 S8a 處理：`selectTab('demo')`＋`expand(true)`；`subscribe` 偵測 `demo` 由非 null 變 null 時 `selectTab('controls')`。
  - `ctx.input`：`lock(owner)`、`unlock(owner)`、`locked() → boolean`（S8b 的手勢、S8a 的記號鍵、S8c 的自動播放都要檢查；S8d 的記號小教室使用）。
  - `ctx.slot(name) → Element`：取插槽。
  - `controls.js`：操作列（打亂、撤銷、重做、重設、看電腦解；「提示」按鈕只留 `hint-button` 插槽，由 S8c 渲染，見 X-16）；再來一局（局中二次確認）；時間（依 `timerRefreshMs` 更新）、步數、「有提示」徽章；打亂字串與「非 WCA 官方打亂」；**記號鍵盤三組**（外層、整顆轉、中層（進階）摺疊，§11.2；預設值讀 `params.keypad`）、每顆鍵的中文副標與 `aria-label`（呼叫 `notation.keySubLabel`）；**面標籤開關**（`ctx.view.setFaceLabels`）；抽屜手把。
  - `notation.js`（純函數、不碰 DOM，Node 可直接 `require`）：`fillTemplate(template, vars)`、`keySubLabel(move, texts)`、`explainMove(move, texts, engine)`（`game-spec.md` §2.4；步數只能取 `engine.describeMove`）。
  - 所有可點元素 ≥ 44×44 px（含分頁、手把、摺疊鈕、開關；v1-C 稿的 40／36／30 px 要放大）；兩種視圖。
- **測試**：`T-DATA-07`（寫在 `tests/engine/notation.test.js`）；Playwright 不在本段，回報附兩種視圖的截圖或 DOM 尺寸掃描結果。
- **回報**：`docs/reports/T-001-S8a.md`（含待補文案清單、插槽位置截圖）。

### S8b UI 手勢與轉視角（sonnet）

- **要寫的檔案**：`src/ui/gesture.js`。
- **不可碰**：S8b 以外的所有 `src/ui/` 檔（需要 `ctx` 新增能力 → 回報 S8a 負責人，經 systems-engineer 裁決）。
- **輸入**：`game-spec.md` §9.2、§9.3；`params.gesture`、`params.ui.snapAnimMs`。
- **輸出契約**：`mount(ctx)`；轉層一律呼叫 `engine.gestureToMove`，方向判定使用 `ctx.view.projectAxes`；放開後以 `ctx.view.snapTo(nearestOrient, params.ui.snapAnimMs)` 吸附，動畫結束後送 `SET_ORIENT`（G3.5 拍板採用吸附）；示範中拖曳只傾斜、放開彈回；雙指取消轉層；`ctx.input.locked()` 或 `ctx.anim.busy()` 時不接受任何手勢。
- **測試**：可在回報中附手動檢查表；自動測試由 S9 的 `T-UI-05`、`T-UI-06`、`T-UI-23` 負責（需要 S8a 的測試掛鉤）。
- **回報**：`docs/reports/T-001-S8b.md`。

### S8c UI 提示、示範分頁與播放器、白話說明、分段暫停卡片、求解器狀態（sonnet）

- **要寫的檔案**：`src/ui/hint-view.js`、`src/ui/demo-player.js`、`src/ui/demo.css`。
- **不可碰**：其他 `src/ui/` 檔（`notation.js` 只能 `require`）。
- **輸入**：`game-spec.md` §2.3、§2.4、§7.5、§9.1、§9.4、§9.6、§11.1（自動切分頁）；`texts.hint`、`texts.demo`、`texts.solver`、`texts.lbl`、`texts.notation.explain`；`lbl.json` 的公式 `name`、`desc`；`params.demo`。
- **輸出契約**：
  - `hint-view.js`：「提示」按鈕（渲染到 `hint-button` 插槽；送 `HINT_REQUEST`，再 `await ctx.solver.requestHint(state)` 並 `dispatch` 結果）、提示浮層（`hint` 插槽：記號、步數、剩餘步數、**白話說明** `notation.explainMove`）與層高亮（`hintView`、`hintLayer`）、等待與取消、求解器狀態顯示（`solver-status` 插槽）。
  - `demo-player.js`（`demo` 插槽）：尚未示範時的說明與兩顆種類按鈕「建議解示範」「層先法示範」；示範中切換種類（`DEMO_EXIT`→`DEMO_REQUEST`）；播放／暫停／單步／速度／離開；記號列高亮與自動捲動；**白話說明**（下一個記號）；層高亮（`demoNextLayer`）；層先法 8 段清單（點擊 `DEMO_SEEK`；空段顯示「已完成，略過」）；公式段的名稱＋白話用途；**分段暫停卡片**（`params.demo.pauseAtSegmentEnd`；「繼續」按鈕）；步數顯示；播放計時器只在本檔；每次自動前進前檢查 `ctx.input.locked()`，鎖住就暫停。
  - 不負責切換分頁（由 S8a 依 state 處理）。
- **測試**：自動測試由 S9 的 `T-UI-07`～`T-UI-09`、`T-UI-12`、`T-UI-21`、`T-UI-22` 負責。
- **回報**：`docs/reports/T-001-S8c.md`。

### S8d UI 完成畫面、最佳紀錄、首次教學＋記號小教室（sonnet）

- **要寫的檔案**：`src/ui/records.js`、`src/ui/tutorial.js`、`src/ui/overlay.css`。
- **不可碰**：其他 `src/ui/` 檔（`notation.js` 只能 `require`）。
- **輸入**：`game-spec.md` §6.3、§6.4、§11.3、§11.4；`texts.result`、`texts.tutorial`、`texts.notation`、`texts.buttons`；`params.storage`、`params.tutorial`、`params.faceLabels`。
- **輸出契約**：
  - `records.js`（`overlay` 插槽）：訂閱 state，於 `recordEligible` 由 false 變 true 時寫入紀錄並顯示完成畫面；有提示／示範顯示徽章；所有儲存存取包 `try/catch`。
  - `tutorial.js`：
    - 首次教學（`params.tutorial.enabled` 且旗標不存在）：T0、T1、L1～L7、T2、T3、T4 共 12 步，卡片放 `lesson-card` 插槽（不蓋方塊）；上一步／下一步／開始玩／跳過教學；L 步另有略過這段、再看一次；完成或跳過時寫旗標（`try/catch`）。
    - L 步示範：`ctx.input.lock`、`ctx.view.setFaceLabels(true)`（依 `forceOnInTutorial`）、`ctx.view.highlight(engine.layerStickers(記號))`、`ctx.view.previewTurn` 轉過去再轉回（`demoTurnMs`、`demoHoldMs`）；卡片顯示 `notation.explainMove(記號)`；離開 L 步時清除預覽、高亮並解鎖。**不得送 `TURN`／`ROTATE`**。
    - 「記號說明」按鈕（`lesson-button` 插槽）：重開 L1～L7；打開時 `timer.state === "running"` 就送 `PAUSE {reason:"lesson"}`、手機 `ctx.panel.expand(true)`；`hint.pending`、`demo.pending`、`ctx.anim.busy()` 時 disabled；關閉後恢復面標籤原值與原分頁。
- **測試**：自動測試由 S9 的 `T-UI-10`、`T-UI-13`、`T-UI-16`、`T-UI-17`、`T-UI-20` 負責。
- **回報**：`docs/reports/T-001-S8d.md`。

### S9 Playwright UI 測試（sonnet）

- **要寫的檔案**：`tests/ui/smoke.spec.js`（`package.json` 的 `test:ui` 已指向此檔；本檔負責啟動 Chromium、跑兩種視圖），可另加 `tests/ui/*.js` 輔助檔。
- **不可碰**：`src/`、`build/`、`package.json`（缺測試掛鉤 → 回報）。
- **輸入**：`game-spec.md` §12.5（含附錄 C 修訂對照）；CLAUDE.md §4 的執行方式（找不到 Playwright 或瀏覽器時印可讀錯誤並以非 0 結束；截圖存 `docs/qa/shots/`）。
- **測試**：`T-UI-01`～`T-UI-23`（G3.5 新增 `T-UI-15`～`T-UI-23`，並修改 `T-UI-02`、`03`、`07`、`09`、`10`、`14`；除教學相關測試外，開頁前先寫入教學旗標，見 `game-spec.md` §12.5）。
- **回報**：`docs/reports/T-001-S9.md`（附 `npm test` 完整摘要）。

### 架構審查（systems-engineer，opus）

- 對照 CLAUDE.md §3 五條與 `game-spec.md` 附錄 B 逐條檢查；重點：engine／solver 無時鐘與瀏覽器 API、同 seed 重放、`nodeLimit` 可重現、Worker 不外連、UI 未自行計算規則、參數都在 `src/data/`。
- 回報：`docs/reports/T-001-arch-review.md`（通過／退件＋理由）。

### S10 審查包（review-packager，haiku；G4.5）

- 前提：架構審查通過。
- 要寫：`docs/reviews/T-001/review-pack.md`（依 `docs/templates/審查包.md`）；製作人貼回後的 `external-<AI名>.md`、`triage.md`。
- 審查提示詞須點名三個高風險點：（1）view／home 座標換算與撤銷是否一致；（2）求解器是否真的不讀時鐘、結果可重現；（3）層先法是否可能無窮迴圈。
- 不可碰：`src/`、`tests/`、`build/`、`docs/spec/`。

---

## 4. 交叉影響與裁決

| 編號 | 段 | 會碰到的檔案／介面 | 裁決 |
|---|---|---|---|
| X-1 | S1 ↔ S3、S5、S6、S8* | `src/data/*.json` | **S1 獨占寫入**；其他段只讀。數值或公式有疑慮 → 回報 systems-engineer；改規格後由 S1 負責人改檔。game-designer 潤飾文案時只能改 `texts.json` 的值、不能改鍵，且須在 S1 回報完成之後。 |
| X-2 | S2 ↔ S3、S4、S5、S6 | `src/engine/cube.js` 的函式介面、24 朝向編號 | **S2 完成後凍結**。其他段需要新函式 → 回報 systems-engineer，由 S2 負責人補並補測試；不得在自己的檔案裡複製一份幾何程式碼（`twophase.js` 保留 spike 原有的幾何除外，兩者一致性由 `T-ENG-05` 保證）。 |
| X-3 | S3 ↔ S6、S8* | state 欄位、action 名稱與 payload、selectors | **以 `game-spec.md` §3.5、§4 為準**。UI 不得新增 state 欄位；UI 自己的狀態（動畫、播放中、速度、目前畫面）留在各 UI 模組內。缺 selector → 回報，由 S3 負責人加。 |
| X-4 | S4 ↔ S5 | 兩者都在 `src/solver/` | **隔離**：S4 只寫 `twophase.js`、S5 只寫 `lbl.js`；測試檔分開（`twophase.test.js`、`lbl.test.js`）。`lbl.js` 不 `require` `twophase.js`。 |
| X-5 | S4、S5 ↔ S6 | `init`／`solve`／`generateLbl` 的介面 | **序列**：S6 等 S4、S5 回報後才開工；介面不合 → 回報，不在 `worker.js` 裡改寫求解器行為。 |
| X-6 | S6 ↔ S7 | Worker 入口與 `SOLVER_WORKER_SRC` | **分工**：`worker.js` 只匯出 `handleMessage`；接 `self.onmessage` 的一行由 S7 在 `build/bundle.js` 產生。`solver-client.js` 的預設 `createWorker` 讀 `window.SOLVER_WORKER_SRC`（名稱固定）。 |
| X-7 | S7 ↔ S8a～S8d | `build/bundle.js` 檔案清單；UI 空殼檔 | **所有權轉移**：S7 建立空殼後，各 UI 檔所有權依本表移交（S8a：template、styles.css、app.js、cube-view.js、controls.js、**notation.js**；S8b：gesture.js；S8c：hint-view.js、demo-player.js、demo.css；S8d：records.js、tutorial.js、overlay.css）。完整清單見 §8。S7 之後不得再寫這些檔。任何段想新增 UI 檔 → 回報 systems-engineer，由 S7 負責人改清單。 |
| X-8 | S8a ↔ S8b、S8c、S8d | `app.js` 與 `ctx` 介面、template 插槽 | **介面先行**：S8b–S8d 只透過 `mount(ctx)` 接入，**不得修改 `app.js` 與 template**；只能把元素掛進分配給自己的 `data-slot`（S8a 段列表）；需要 `ctx` 新能力或新插槽 → 回報，由 S8a 負責人加（屬 S8a 範圍的小修）。三段各自的 CSS 檔分開，避免同檔衝突，因此可並行。 |
| X-9 | S8c ↔ S6 | `solver-client` 的行為（快取、退回） | S8c 只呼叫 `requestHint`／`requestDemo`／`cancel`／`status`，不自行實作快取或退回。 |
| X-10 | S9 ↔ S8* | 測試掛鉤 `window.__cubeTest`、DOM 選擇器 | S9 不得改 `src/`；缺掛鉤或選擇器 → 回報對應段。 |
| X-11 | S3 ↔ S2 | `tests/engine/` | 各段測試檔名互不重疊（見各段）；輔助檔各自一份。 |
| X-12 | 全部 | `package.json` | **無人修改**。現有 scripts 已足夠（`test:engine` 萬用字元涵蓋 `tests/engine/solver/`）。`CLAUDE.md` §4 提到的 `npm run preview` 在 `package.json` 不存在 → 已列入 systems-engineer 回報，等製作人決定，G4 不處理。 |
| X-13 | 全部 | `.claude/hooks/forbidden-allowlist.txt` | **無人修改**。被 hook 擋下 → 改寫程式（時間由 action 帶入、亂數由 seed 產生）。 |
| X-14 | 全部 ↔ systems-engineer | `docs/spec/game-spec.md` | 發現規格矛盾或缺漏 → 停下回報，由 systems-engineer 改規格（v0.1 → v0.1.1），不由工程師自行解讀。 |
| X-15 | S8a ↔ ui-designer | `docs/ui/decision-log.md` 的版型與 `game-spec.md` §9 行為 | 版型（位置、大小、配色）以 decision-log 為準；行為（action、計步、吸附、手勢判定、退回）以規格為準；兩者衝突 → 回報 systems-engineer。 |
| X-16 | S8a ↔ S8c | 操作列上的「提示」按鈕 | 按鈕的**位置**（操作列內的 `data-slot="hint-button"` 空位）屬 S8a；按鈕本身與行為屬 S8c（`hint-view.js` 渲染）。「看電腦解」按鈕整顆屬 S8a（只切分頁，不送 action）；「建議解示範」「層先法示範」兩顆屬 S8c。 |
| X-17 | S8a ↔ S8d | 「記號說明」按鈕、面標籤、輸入鎖 | 按鈕屬 S8d（掛 `lesson-button` 插槽）；面標籤開關 UI 與 `ctx.view.setFaceLabels` 屬 S8a，S8d 只呼叫；`ctx.input` 屬 S8a，S8d 只呼叫 `lock`／`unlock`。 |
| X-18 | S2 ↔ S8a | `describeMove` | S2 提供並凍結（X-2）；`notation.js` 只呼叫、不自行判斷記號種類與步數。 |

---

## 5. 未預期發現的處理

1. 範圍外的問題：寫進回報「未預期發現」，附路徑與一句話；不修。
2. 會影響 state 欄位、action、資料格式、24 朝向編號、RNG 呼叫方式、求解結果的發現：立即停下回報 systems-engineer。
3. 測試連續兩次失敗找不到原因：停下，附失敗輸出。
4. 需要任何新套件：一律拒絕，回報製作人。
5. 誤改範圍外檔案：還原，並在回報註明「曾誤改、已還原」。

---

## 6. 風險（對照 CLAUDE.md §3）

| 原則 | 可能踩到 | 防範 |
|---|---|---|
| 1 純函數 | 計時、動畫、求解逾時被寫進 engine／solver | 時間一律由 action 的 `at` 帶入；逾時只在 `solver-client`；`T-ENG-24` 與 hook |
| 2 seeded RNG | UI 產生 seed 時用錯 API；spike 註解含禁用字 | §5 規定 seed 來源；S4 必須改寫第 23–25、312 行 |
| 3 資料驅動 | 手勢門檻、速度、節點上限寫死在程式裡 | 全部在 `params.json`；審查時 grep 數字 |
| 4 觸控優先 | 36 顆記號鍵在手機直向放不下、雙指觸發頁面縮放、v1-C 稿有小於 44 px 的按鈕 | 版型 C 已拍板（中層收合、面板內捲動）；`T-UI-03` 多畫面掃描；M-03 |
| 5 零依賴 | Worker 另存成檔案、字型外連 | `T-BUILD-02/03`、`T-UI-04` |

---

## 7. 素材需求

| 素材 | 由誰產 | 狀態 |
|---|---|---|
| UI 文案（按鈕、提示、示範、完成、教學、層先法分段） | 初稿已在 `game-spec.md` §10.1（多數取自 `game-design.md` §6）；game-designer 可於 S1 之後潤飾 | 初稿已有 |
| 配色 | 初稿在 §10.2；ui-designer 可調色值 | 初稿已有 |
| 版型、按鈕排列 | ui-designer（G3.5） | **已拍板 C**（`docs/ui/v1-C.html`；與規格差異見 `game-spec.md` §11.1） |
| 記號小教室、中文副標、白話說明模板、公式白話用途（G3.5 新增） | 初稿由 systems-engineer 寫在 `game-spec.md` §10.1、§10.4、§11.3；game-designer 可於 S1 之後潤飾值（不改鍵、`id`、佔位符） | 初稿已有 |
| 圖片、音效 | 不需要 | — |

---

## 8. 檔案歸屬總表（G3.5 修訂後；每個檔案只有一個最終負責段）

| 檔案 | 最終負責段 | 備註 |
|---|---|---|
| `src/data/texts.json`、`palette.json`、`params.json`、`lbl.json` | S1 | X-1 |
| `tests/engine/data.test.js` | S1 | |
| `src/engine/rng.js`、`cube.js`、`scramble.js` | S2 | X-2（含 `describeMove`） |
| `tests/engine/cube.test.js`、`scramble.test.js` | S2 | |
| `src/engine/reducer.js`、`selectors.js`、`index.js` | S3 | |
| `tests/engine/reducer.test.js`、`invariants.test.js`、`forbidden.test.js` | S3 | |
| `src/solver/twophase.js` | S4 | |
| `tests/engine/solver/twophase.test.js` | S4 | |
| `src/solver/lbl.js` | S5 | |
| `tests/engine/solver/lbl.test.js` | S5 | |
| `src/solver/worker.js`、`src/ui/solver-client.js` | S6 | |
| `tests/engine/solver/worker.test.js`、`client.test.js` | S6 | |
| `build/bundle.js` | S7 | |
| `tests/engine/build.test.js` | S7 | |
| `src/ui/index.template.html`、`styles.css`、`app.js`、`cube-view.js`、`controls.js`、`notation.js` | S8a | S7 只建空殼後移交（X-7） |
| `tests/engine/notation.test.js` | S8a | G3.5 新增 |
| `src/ui/gesture.js` | S8b | S7 空殼後移交 |
| `src/ui/hint-view.js`、`demo-player.js`、`demo.css` | S8c | S7 空殼後移交 |
| `src/ui/records.js`、`tutorial.js`、`overlay.css` | S8d | S7 空殼後移交 |
| `tests/ui/smoke.spec.js`、`tests/ui/*.js` 輔助檔 | S9 | |
| `docs/reports/T-001-<段>.md` | 各段自己的一份 | |
| `docs/reports/T-001-arch-review.md` | 架構審查 | |
| `docs/reviews/T-001/*` | S10 | |

自檢（systems-engineer，2026-09-15）：把第 3 節各段「要寫的檔案」逐一列出比對，除了 S7 建立的 UI 空殼（依 X-7 移交、S7 之後不得再寫）以外，沒有任何檔案出現在兩個段；S8a～S8d 在同一時間可並行，彼此的檔案集合互不相交，共用的東西只透過 `ctx`、插槽與 `require notation.js`（唯讀）取得。

---

## 9. 需製作人決定的事

- G3.5 已回覆 `game-spec.md` §14 的三題（建議解示範的按鈕名稱、拖曳視角吸附、撤銷扣回步數），**皆已結案**，S1～S10 可依順序全部開工。
- 仍開放但不擋開工（有預設值）：`game-spec.md` §14 第 4 題（教學以外的面標籤預設，預設「關」）、第 5 題（互動式逐段教學是否仍留 v0.2，預設留 v0.2）。
