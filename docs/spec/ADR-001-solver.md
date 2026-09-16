# ADR-001 求解器架構（兩階段建議解＋層先法產生器）

> 架構決策紀錄。一個 ADR 只記一個決策；被推翻時不改本檔，另開新檔並互相連結。

| 欄位 | 內容 |
|---|---|
| 狀態 | 已採納（G3） |
| 日期 | 2026-09-15 |
| 相關任務 | T-001（`docs/tickets/T-001/dispatch.md` S4、S5、S6、S7） |
| 製作人核准 | 大方向已核准：2026-09-15 G0「求解器：自己寫」、G2「兩種示範都做」「求解器放 `src/solver/`，以搜尋節點上限控時、不讀時鐘、可重現；在 Web Worker 執行」。本檔的細部取捨（QTM 成本、無對稱縮減、節點上限數值、Blob Worker、主執行緒退回）不需另外核准；建議解按鈕名稱已於 G3.5 拍板（見 §6） |
| 依據 | `docs/spike/solver-spike.md`（量測）、`scratch/g3-check/`（G3 補測）、`docs/spec/game-spec.md` §7–§9 |

## 1. 背景

- v0.1 要讓玩家「看電腦怎麼解」，兩種：建議解示範（短，但人看不懂為什麼）與層先法示範（長，但每段有名稱與說明）。提示（下一步）也需要一個解。
- 限制：
  - 單一 `index.html`、零依賴、斷網可玩（CLAUDE.md §1、§3 第 5 條）。
  - 手機與 iPad 瀏覽器；建表不能卡住畫面。
  - 結果必須可重現（CLAUDE.md §3 第 1、2 條；decision-log G2：不讀時鐘）。
  - 計步為 QTM（decision-log G0）。
  - 畫面只能稱「建議解」（CLAUDE.md §1）。
- spike 已證明自寫兩階段法可行：1,000 局全復原；只建 QTM 表時 Node 建表中位數 1,027.2 ms、Chromium Worker 1,180 ms；原始碼 37,711 bytes。
- 受影響的原則：CLAUDE.md §3 第 1 條（不讀時鐘）、第 2 條（可重放）、第 5 條（零依賴、Worker 不外連）。

## 2. 決策

### 2.1 兩種求解器並存

| 用途 | 求解器 | 檔案 |
|---|---|---|
| 提示、建議解示範 | 兩階段法（Kociemba 兩階段的自寫版，由 spike 改寫） | `src/solver/twophase.js` |
| 層先法示範；建議解不可用時的提示退回 | 規則式層先法產生器（初學者公式） | `src/solver/lbl.js` |

- 層先法不用搜尋，靠「看狀態 → 套公式」；8 段、11 個公式；G3 原型通過 random-state 1,000 局、含中層與整顆旋轉 1,000 局、末層全列舉 62,208 種、近復原列舉 7,495 種（`game-spec.md` §8.6）。

### 2.2 以 QTM 成本搜尋

- 剪枝表以 QTM 成本（90°＝1、180°＝2）建立，搜尋也以 QTM 計長度（spike §3 做法 (c)）。
- 只建 QTM 一套表；不建 HTM 表、不建角塊全域表（`cornerTable:false`，那是最少步搜尋才需要的）。

### 2.3 無對稱縮減，三張第一階段表取最大值

- 第一階段：twist×slice、flip×slice、twist×flip 三張表取最大值；第二階段：cornPerm×slicePerm、udEdgePerm×slicePerm。
- 型別陣列合計 10,939,101 bytes（G3 實測）。

### 2.4 以節點數控制，不讀時鐘

- `solve` 的停止條件只有節點數：
  - `nodeLimit` ＝ 3,000,000：整次搜尋累計節點；找到第一組解後超過即停，回傳目前最佳解。
  - `firstNodeLimit` ＝ 30,000,000：找到第一組解之前的安全上限；超過回 `NODE_LIMIT`。
- G3 實測（1,000 局，seed 20260915，Node）：`nodeLimit` 3,000,000 → 復原 1000/1000、QTM 平均 27.63、最大 32、耗時平均 102.2 ms、最大 254.1 ms；第一組解最多用了 3,355,198 個節點。
- 求解器原始碼不得出現任何時鐘 API（spike 第 23–25 行的 `performance.now`／`Date.now` 與第 312 行註解的 `Math.random` 字樣都要移除）。
- 逾時保護放在 UI 層（`solver-client.js` 的 watchdog 可以讀時鐘），不放在求解器內。

### 2.5 在 Web Worker 執行，Worker 由同一檔案以 Blob 產生

```js
// build/bundle.js 產生（示意）
window.SOLVER_WORKER_SRC = "<迷你註冊器＋engine/cube.js＋engine/rng.js＋solver/twophase.js＋solver/lbl.js＋solver/worker.js>";
// src/ui/solver-client.js（示意）
var url = URL.createObjectURL(new Blob([window.SOLVER_WORKER_SRC], { type: 'text/javascript' }));
var worker = new Worker(url);
worker.postMessage({ type: 'init', id: 1, params: GAME_DATA.params.solver });
```

- 訊息協定：`init`／`solve`／`lbl` → `progress`／`ready`／`result`／`error`（`game-spec.md` §9.5）。
- `src/solver/worker.js` 只匯出可在 Node 測試的 `handleMessage(msg, post)`；接到 `self.onmessage` 的那一行由 `build/bundle.js` 產生在 Worker 字串的入口（`build/` 不受 hook 檢查，`src/solver/` 因此保持沒有瀏覽器 API）。
- 頁面第一次畫完就在背景建表。

### 2.6 退回路徑

| 情況 | 退回 |
|---|---|
| 無法建立 Worker | 主 bundle 也包含 solver 模組，改在主執行緒執行（第一次使用時建表，畫面會停頓，先顯示提示文案） |
| 建表逾時（`initTimeoutMs` 20,000） | 建議解不可用；提示改用層先法 |
| 單次求解逾時（`solveTimeoutMs` 10,000） | 終止並重建 Worker；本次提示改用層先法；建議解示範改為提供「改看層先法示範」 |
| `NODE_LIMIT` | **不重建 Worker**（查表仍有效，補註 D-9）；本次提示改用層先法；建議解示範改為提供「改看層先法示範」 |

逾時門檻皆為預設值，待 G5 實機調整。

### 2.7 v0.1 不做真正最少步

- spike 的 `solveOptimalQTM` 在 v0.1 移除（`game-spec.md` §0.2 N-4）。spike 量到深度 ≤ 14 QTM 時桌機 1 秒內可算完，保留給 v0.2 限步挑戰。

## 3. 替代方案

| 方案 | 優點 | 缺點 | 為何不選 |
|---|---|---|---|
| A. HTM 搜尋後換算 QTM（spike 做法 (a)） | 第一組解較快（平均 5.7 ms 對 11.6 ms） | 相同預算下 QTM 平均長約 1.9 步，最長 36 對 31（spike §3） | 本案只顯示 QTM |
| B. HTM 搜尋、從過程中的各解挑 QTM 最短（spike (b)） | 不必另建表 | 200 局只有 6 局變短（spike §3） | 幾乎沒有效益 |
| C. 同時建 HTM＋QTM 表 | 兩種都能用 | 建表 2,121.8 ms、記憶體約兩倍（spike §2.2） | 用不到 HTM |
| D. 對稱縮減的大表 | 第一階段啟發更準，容易更快找到短解 | 估計 35 MB 以上、建表數秒以上（spike §1.3，未實測）；程式複雜 | 手機記憶體與建表時間風險太高；目前的解長已足夠 |
| E. 以時間預算停止（spike 的 `timeLimitMs`） | 耗時穩定（約 100 ms） | 結果不可重現（spike 測試 14 兩次平均 21.17 與 21.18）；違反「不讀時鐘」拍板 | 違反 decision-log G2 與 CLAUDE.md §3 |
| F. 內嵌第三方求解器（cube.js、min2phase） | 省開發時間 | 違反零依賴；decision-log G0 已拍板自己寫 | 違反拍板 |
| G. Korf 最佳解（IDA*＋模式資料庫） | 可保證最少步 | 約 82 MB 表、最壞耗時不可控（調研 §D） | 不適合手機單檔 |
| H. Thistlethwaite 法 | 表小 | 平均約 31 步、最多 45 步（調研 §D），比兩階段長 | 兩階段已可行且較短 |
| I. 把建好的表直接嵌進 HTML | 不必建表 | 約 10.9 MB，遠超產物 300 KB 上限 | 檔案太大 |
| J. Worker 放成獨立 `.js` 檔 | 標準做法 | 違反單一 `index.html`；`file://` 下載入受限 | 違反 CLAUDE.md §1 |
| K. 在主執行緒建表（不用 Worker） | 最簡單 | 建表約 1 秒以上會卡住觸控（手機時間 UNKNOWN） | 只作為退回路徑 |
| L. 層先法也用搜尋（例：每段 IDA*） | 步數較短 | 每段仍需表或時間；步驟不再是「看得懂的公式」 | 違背「學習用」定位（decision-log G2） |
| M. 層先法不輸出整顆旋轉（全部換算成固定朝向的記號） | 記號較少、畫面不轉 | 公式會變成 `B′ U B` 等不常見寫法，玩家對不上教學 | 學習用途優先；整顆旋轉 0 步不影響計步 |

## 4. 影響

- **engine**：不含求解器；只接收求解結果作為 action 內容（`HINT_READY`、`DEMO_READY`）。新增 `src/engine/cube.js` 的 `toHome`／`toView`／`orientAfter`，讓求解結果能在 view 與 home 座標間換算（`game-spec.md` §3.2）。
- **solver**：`twophase.js`（spike 改寫）、`lbl.js`（新寫，依賴 `engine/cube.js`）、`worker.js`。
- **ui**：`solver-client.js` 負責建立 Worker、請求佇列、watchdog、計畫快取、退回。
- **data**：`params.json` 的 `solver` 區塊；`lbl.json`。
- **build**：產生 `window.SOLVER_WORKER_SRC`；主 bundle 與 Worker 字串各含一份 solver；上限：產物 < 400 KB（補註 D-13，原訂 300 KB）、Worker 字串 < 100 KB。
- **tests**：`T-SOL-*`、`T-LBL-*`、`T-BUILD-02/03`、`T-UI-07/08/09/12`。
- **決定性**：有。同一狀態（含 `orient`）必得同一解，所以同 seed＋同 action 序列（`HINT_READY`／`DEMO_READY` 的內容由求解器產生）可以重放；測試另以固定內容的 READY action 重放 engine（`T-ENG-12`）。
- **觸控**：建表與求解在 Worker，不阻塞觸控；只有主執行緒退回時第一次建表會停頓。
- **零依賴**：無外部檔案、無網路；Worker 以 Blob URL 建立。

## 5. 驗證方式

| 決策 | 測試 |
|---|---|
| 2.1 兩種求解器都能完成任何合法狀態 | `T-SOL-03`、`T-SOL-07`、`T-LBL-01`～`T-LBL-04` |
| 2.2 QTM 成本、長度上限 | `T-SOL-03`（QTM 最大 ≤ 32、平均 ≤ 27.7） |
| 2.3 表大小 | `T-SOL-09`（10,939,101 bytes） |
| 2.4 不讀時鐘、可重現、安全上限 | `T-SOL-04`、`T-SOL-05`、`T-ENG-24` |
| 2.5 Worker 協定與 Blob | `T-SOL-08`、`T-BUILD-02`、`T-BUILD-03`、`T-UI-04` |
| 2.6 退回 | `T-UI-12`；逾時路徑以 `solver-client.js` 單元測試（注入假 Worker）驗證，列在分派單 S6 |
| 實機時間 | M-02（製作人本機） |

## 6. 未決事項

- 手機與 iPad 的建表時間、記憶體、`nodeLimit` 耗時：**UNKNOWN**（M-02）。
- iOS Safari 在 `file://` 下的 Blob Worker 行為：**UNKNOWN**（有主執行緒退回）。
- ~~建議解示範的按鈕名稱~~：**已結案**（decision-log 2026-09-15 G3.5：製作人同意定名「建議解示範」，全面取代 G2 舊稱；`game-spec.md` §14 第 1 題、附錄 C 修訂 R-3）。本項是文案決定，不影響本 ADR 的架構決策。
- 層先法理論最大步數：**UNKNOWN**（樣本最大 236 QTM）。
- v0.2 若加入真正最少步，需另開 ADR（表要加 `cornerTable`、UI 文案要能說「最少步」）。


## 補註（2026-09-15，G4 期間）

- D-9：`NODE_LIMIT` 不重建 Worker，以規格 §9.6 為準。
- D-13：主產物上限由 300 KB 放寬為 400 KB（主執行緒退回需內含求解器）。
- 完整裁決見 `docs/reports/T-001-arch-decisions.md`。
