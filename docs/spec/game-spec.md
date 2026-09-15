# 規格書：魔術方塊 v0.1（自由練習＋提示＋看電腦解）

- 撰寫角色：systems-engineer　- 日期：2026-09-15　- 規格版本：v0.1　- Gate：G3
- 依據（優先序由高到低）：`CLAUDE.md`、`docs/decision-log.md`（最新拍板）、`docs/G0-kickoff.md` §10、`docs/design/game-design.md`（含 §11 spike 回填）、`docs/spike/solver-spike.md`、`docs/research/cube-games.md`
- 相關文件：`docs/spec/ADR-001-solver.md`（求解器架構）、`docs/tickets/T-001/dispatch.md`（G4 分派單）
- 驗證程式：`scratch/g3-check/`（本規格的公式、方向、手勢、節點上限都在這裡實測過；`scratch/` 不進版控，結果摘錄在附錄 A）
- 數字的來源標示：**〔spike〕**＝`docs/spike/solver-spike.md`；**〔G3 實測〕**＝`scratch/g3-check/results-*.txt`（Node v22.22.2，本機）；**〔預設值，待 G5 調整〕**＝本規格暫定；**UNKNOWN**＝目前查不到。

---

## 0. 範圍

### 0.1 v0.1 要做（decision-log 2026-09-15 G0／G2）

| # | 功能 | 本規格章節 |
|---|---|---|
| F-1 | 自由練習：打亂、轉動（手勢＋記號按鈕）、撤銷／重做、重設、計時、QTM 計步、復原判定 | §2–§6、§10 |
| F-2 | 提示：一次只顯示「下一步」 | §7.5、§4 |
| F-3 | 看電腦解 A：建議解示範（兩階段法、以 QTM 成本搜尋） | §7、§9 |
| F-4 | 看電腦解 B：層先法示範（分段、每段有名稱與一句說明） | §8、§9 |
| F-5 | 本機最佳紀錄（只存在 UI 層） | §6.4 |
| F-6 | 首次操作教學（3–5 步，文案見 `game-design.md` §6.5） | §11 |

### 0.2 v0.1 不做

| # | 不做 | 出處 |
|---|---|---|
| N-1 | 限步挑戰 M2、互動式逐段教學 M4（示範以外的部分）、每日挑戰 M5、群論小教室 M6（含知識卡） | decision-log G0 v0.1 範圍、G2 看電腦解範圍 |
| N-2 | 2D 展開圖 | decision-log G2 |
| N-3 | 手動暫停鍵 | decision-log G2 |
| N-4 | 「最少步」「最佳解」字樣與真正最少步搜尋（`solveOptimalQTM`） | CLAUDE.md §1；spike §5.5 標為需製作人決定，v0.1 不做 |
| N-5 | 手動塗色輸入方塊、相機掃描 | 不在拍板範圍 |
| N-6 | 寬轉記號（r、Rw 等）、自訂配色 | 範圍控制 |
| N-7 | 存局面（重新整理頁面後接續上一局）；只存最佳紀錄與「看過教學」旗標 | 範圍控制 |
| N-8 | 連線、帳號、排行榜、音效 | CLAUDE.md §1 |
| N-9 | 任何「Rubik's」字樣與官方標誌 | decision-log G0 命名 |

---

## 1. 名詞與記號

### 1.1 座標與面

- 座標軸：x 向右、y 向上、z 向前（朝向玩家）。與 spike `solver.js` 相同。
- 六個面：**U** 上、**D** 下、**L** 左、**R** 右、**F** 前、**B** 後。記號一律以「玩家目前看到的方塊」為準（本規格稱 **view 座標**，見 §3.2）。
- 54 格貼紙索引：面序 `U R F D L B`（0–5），每面 9 格，依十字展開圖「由左上到右下、逐列」編號；索引 ＝ `9 × 面序 ＋ (列 × 3 ＋ 欄)`。與 spike 的 54 格字串順序完全相同。各面的「右」「下」方向：

| 面 | 右方向 | 下方向 | 左上格座標 |
|---|---|---|---|
| U | +x | +z | (−1, 1, −1) |
| R | −z | −y | (1, 1, 1) |
| F | +x | −y | (−1, 1, 1) |
| D | +x | −z | (−1, −1, 1) |
| L | +z | −y | (−1, 1, −1) |
| B | −x | −y | (1, 1, −1) |

### 1.2 記號

| 記號 | 意義 | 方向定義 |
|---|---|---|
| `U` `D` `L` `R` `F` `B` | 該面那一層轉 90° | **正對該面看，順時針** |
| `X′` | 該層逆時針 90° | 同上的反方向 |
| `X2` | 該層轉 180° | 方向不影響結果 |
| `M` | L 與 R 之間的中層 | **與 L 同向**（業界慣例） |
| `E` | U 與 D 之間的中層 | **與 D 同向**（業界慣例） |
| `S` | F 與 B 之間的中層 | **與 F 同向**（業界慣例） |
| `x` | 整顆方塊 | 與 R 同向（業界慣例） |
| `y` | 整顆方塊 | 與 U 同向（業界慣例） |
| `z` | 整顆方塊 | 與 F 同向（業界慣例） |

- M/E/S 的方向慣例出處：`docs/research/cube-games.md` §B2、§E（speedsolving wiki、rubiks.fandom）。x/y/z 的方向慣例：調研文件沒有單獨列出，**本規格採業界慣例（推論）**，並以程式驗證內部一致（下表）。
- 共 36 個記號：外層 18（6 面 × 3）、中層 9、整顆 9。
- 字元：UI 顯示用 `′`（U+2032）；程式內部與資料檔一律用 ASCII `'`（例：`"R'"`）；解析時接受 `'`、`’`、`′` 三種。
- 已驗證的恆等式〔G3 實測，`check-model.js`〕：`M = R L′ x′`、`E = U D′ y′`、`S = F′ B z`、`x = R M′ L′`、`y = U E′ D′`、`z = F S B′`；方向抽查：M 把 U 面中欄帶到 F 面、E 把 F 面中排帶到 R 面、S 把 U 面中排帶到 R 面。

### 1.3 名詞表

| UI 用語 | 程式識別字 | 說明 |
|---|---|---|
| 打亂 | `scramble` | 本局開始時套用的記號序列 |
| 轉動 | `TURN` | 外層或中層轉動（會計步） |
| 轉視角／整顆轉 | `ROTATE`、`SET_ORIENT` | 只改 `orient`，不計步、不進撤銷紀錄 |
| 步數 | `moveCount`（selector） | QTM，見 §2 |
| 提示 | `hint` | 下一步（一個轉動） |
| 建議解 | `suggest` | 兩階段法以 QTM 成本搜尋的解；**不得**稱最佳解、最少步 |
| 層先法 | `lbl` | 初學者分段解法 |
| 示範 | `demo` | 逐步播放建議解或層先法 |
| 有提示 | `assist.hint` | 本局看過提示 |
| 示範局 | `assist.demo` | 本局看過示範（不列紀錄） |

---

## 2. QTM 計步

### 2.1 計步表（decision-log G0 計步規則、G2 中層計步）

| 動作 | 步數 |
|---|---|
| 外層 90°（`R`、`R′`…） | 1 |
| 外層 180°（`R2`…） | 2 |
| 中層 90°（`M`、`M′`、`E`、`E′`、`S`、`S′`） | 2 |
| 中層 180°（`M2`、`E2`、`S2`） | 4 |
| 整顆旋轉（`x` `y` `z` 的所有變化） | 0 |
| 拖曳視角（手勢） | 0 |

- 中層計法是本專案自訂慣例，不是官方標準（`game-design.md` §5.1）。
- 程式：`qtmCost(move) → 0|1|2|4`（`src/engine/cube.js`）。

### 2.2 本局步數

- `moveCount(state)` ＝ `history[0 … cursor)` 每筆轉動的 `qtmCost` 總和。
- **撤銷會扣回步數、重做會加回**（淨步數）。整顆旋轉不進 `history`，所以永遠不影響步數。
- 示範中逐步播放的轉動也會進 `history`（`src: "demo"`），所以也會計入本局步數；該局本來就不列紀錄（§6.3）。

### 2.3 提示與示範時的步數顯示

| 場合 | 顯示 | 例 |
|---|---|---|
| 提示 | 記號＋該步步數；來源是建議解時，另顯示「照建議解還要 N 步」 | `R2（2 步）· 照建議解還要 24 步` |
| 提示（來源是層先法，見 §9.6 退回） | 只顯示記號與該步步數，不顯示剩餘步數 | `F′（1 步）` |
| 建議解示範 | 標題顯示總步數；進度顯示「已示範 a／N 步」；記號列每個記號下方標該步步數 | `建議解：共 27 步` |
| 層先法示範 | 標題顯示總步數；分段清單每段顯示本段步數；整顆旋轉的記號標「整顆轉（不計步）」 | `層先法：共 176 步`／`白色十字 · 22 步` |

- 「步」一律指 QTM；畫面第一次出現步數時附一句說明（文案鍵 `qtmNote`，§10.1）。
- 建議解的步數**不得**宣稱是「最少」「最短」「最佳」（CLAUDE.md §1）；只允許否定式說明（`texts.demo.notShortest`）。

---

## 3. 狀態模型

### 3.1 為什麼用「貼紙＋朝向」

- engine 用 **54 格貼紙色號陣列**表示方塊，不用 cubie 表示法。理由：中層轉動與整顆旋轉都只是貼紙置換，復原判定（六面同色）與 UI 渲染直接可用。
- 求解器要的 cubie 表示法，由 `fromStickerColors`（spike 已有）在交給求解器前轉換（§3.4）。
- 所有轉動的貼紙置換都由 3D 幾何推導（x、y、z 座標＋每格法向量），不手抄轉動表；做法與 spike §1.1 相同，擴充到中層與整顆。

### 3.2 home 座標與 view 座標

- `home`：engine 內部固定座標系下的 54 格色號。`history` 裡的轉動都是 home 座標記號，所以撤銷不受視角改變影響。
- `orient`：0–23，代表 24 種整顆朝向之一。`orient = 0` 是開局朝向（白上、綠前）。
- **view 座標**＝玩家看到的方塊：`viewStickers = applyOrient(home, orient)`。UI 只渲染 view 貼紙；記號按鈕、手勢、提示、示範的記號都是 view 座標。
- 換算（皆為 `src/engine/cube.js` 的純函數）：
  - `toHome(orient, viewMove)`：玩家在 view 做 `viewMove`，等於在 home 做哪個記號。
  - `toView(orient, homeMove)`：反向。
  - `orientAfter(orient, rotation)`：做一次整顆旋轉後的新朝向。
- 24 種朝向的編號：以 `x`、`y`、`z`（依此順序）為生成元，從單位元做 BFS，依發現順序編 0–23。編號是資料契約，測試會鎖定（`T-ENG-08`）。
- 〔G3 實測〕24 種朝向皆不同；view 做 X 等於 home 做 `toHome(o, X)`（2,000 組）；外層只會換成外層、中層只會換成中層；整顆旋轉只改 `orient`（500 組）。

### 3.3 中心塊方位

- 中層轉動會移動中心塊（例：`M` 之後，home 的 U 位置不再是白色中心）。**engine 不修正、不追蹤中心**；中心塊就是一般貼紙。
- 中層轉動等於「兩個外層轉動＋一次整顆旋轉」（§1.2 恆等式），所以六個中心永遠維持合法的相對位置（24 種之一）。
- 顏色的「身分」固定：色號 0–5 ＝開局時所在的面 `U R F D L B`，也就是 0 白、1 紅、2 綠、3 黃、4 橙、5 藍（配色見 `palette.json`，§10.2）。

### 3.4 交給求解器前的正規化

1. 取 `viewStickers(state)`（view 座標、54 個色號）。
2. `fromStickerColors(view)`：以**目前六個中心的顏色**決定「哪個顏色屬於哪一面」，轉成 54 格字母字串與 cubie，順便做合法性檢查（錯誤碼沿用 spike：`LENGTH`、`CENTER_DUPLICATE`、`BAD_COLOR`、`CORNER_UNKNOWN`、`EDGE_UNKNOWN`、`CORNER_TWIST`、`EDGE_FLIP`、`PARITY`、`CORNER_PERM_INVALID`、`EDGE_PERM_INVALID`）。
3. 求解器回傳的外層記號是 view 座標（請求當下的 `orient`）；engine 收到後用 `toHome(請求當下的 orient, 記號)` 換成 home。
- 不需要先把方塊「轉正」：以目前中心定義面即可，解完後六面同色、朝向不變。
- 〔G3 實測〕200 局含中層與整顆旋轉的隨機序列：`fromStickerColors` 全部合法，QTM 建議解套回後 200/200 復原。
- 正常遊玩不可能出現非法狀態；若出現（程式錯誤），UI 顯示 `texts.error.invalidState`，不崩潰。

### 3.5 state 欄位

完整 state 範例（開局後轉了 `R`、`U`，按了一次提示）：

```json
{
  "specVersion": "0.1",
  "seed": 20260915,
  "scramble": ["U'", "D'", "B", "L'", "F2"],
  "status": "playing",
  "home": [0, 0, 0, "…共 54 個色號"],
  "start": [0, 0, 0, "…共 54 個色號"],
  "orient": 0,
  "history": [{ "m": "R", "src": "user" }, { "m": "U", "src": "user" }],
  "cursor": 2,
  "version": 3,
  "timer": { "state": "paused", "accMs": 8123.4, "since": null },
  "assist": { "hint": false, "demo": false },
  "hint": { "pending": true, "version": 3, "orient": 0 },
  "demo": null,
  "result": null
}
```

（`scramble` 範例只列前 5 個；實際長度見 `params.scramble.length`。）

| 欄位 | 型別 | 初始值 | 說明 |
|---|---|---|---|
| `specVersion` | string | `"0.1"` | 規格版本 |
| `seed` | uint32 ｜ null | `null` | `NEW_GAME` 的 seed；`null`＝尚未打亂（自由模式） |
| `scramble` | string[] | `[]` | home 座標的打亂記號（開局時 `orient=0`，home＝view） |
| `status` | `"free"｜"playing"｜"solved"` | `"free"` | 見 §3.6 |
| `home` | int[54]（0–5） | 復原狀態 | home 座標貼紙 |
| `start` | int[54] | 復原狀態 | 本局打亂完成時的 `home`（`RESET` 用） |
| `orient` | int 0–23 | 0 | 目前朝向 |
| `history` | `{m, src}[]` | `[]` | `m`：home 座標外層／中層記號；`src`：`"user"｜"demo"` |
| `cursor` | int | 0 | `history[0…cursor)` 為已套用；之後為可重做 |
| `version` | int | 0 | 每次 `home` 改變就 +1；用來判斷非同步的求解結果是否過期 |
| `timer.state` | `"idle"｜"running"｜"paused"｜"stopped"` | `"idle"` | §6 |
| `timer.accMs` | number | 0 | 已累計毫秒 |
| `timer.since` | number ｜ null | null | 最近一次開始或恢復時的 `at` |
| `assist.hint` | boolean | false | 本局是否看過提示 |
| `assist.demo` | boolean | false | 本局是否看過示範 |
| `hint` | null ｜ `{pending:true, version, orient}` ｜ `{pending:false, move, source, planQtm}` | null | `move` 為 **home** 座標記號；`source`：`"suggest"｜"lbl"`；`planQtm`：建議解剩餘步數（來源 lbl 時為 null） |
| `demo` | null ｜ 見下 | null | 示範狀態 |
| `result` | null ｜ `{timeMs, qtm, assist}` | null | 復原當下凍結；`assist`：`"none"｜"hint"｜"demo"` |

`demo` 物件：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `kind` | `"suggest"｜"lbl"` | 示範種類 |
| `pending` | boolean | 等待求解結果中 |
| `version`、`orient` | int | 請求當下的 `state.version` 與 `orient` |
| `tokens` | string[] | 請求當下的 view 座標記號；層先法含整顆旋轉 |
| `segments` | Segment[] ｜ null | 層先法分段（§8.2）；建議解為 null |
| `cursor` | int | 已播放到第幾個記號（0…`tokens.length`） |
| `baseCursor` | int | `DEMO_READY` 當下的 `state.cursor`（示範開始前的撤銷位置） |

不變式（每個 action 之後都成立；`T-ENG-14`）：
- INV-1：`home` 等於 `start` 依序套用 `history[0…cursor)` 的結果。
- INV-2：`0 ≤ cursor ≤ history.length`。
- INV-3：`status === "solved"` 若且唯若 `result !== null`（自由模式不產生 `result`）。
- INV-4：`demo` 就緒（`pending === false`）時，`cursor − demo.baseCursor` 等於 `tokens[0…demo.cursor)` 中「轉動」（非整顆旋轉）的個數，且 `history[demo.baseCursor…cursor)` 的 `src` 皆為 `"demo"`、`history.length === cursor`。
- INV-5：`timer.state === "running"` 若且唯若 `timer.since !== null`。
- INV-6：`state` 可以 `JSON.stringify` 後還原成深度相等的物件（不得放 typed array、函式、`undefined`）。

### 3.6 狀態（status）

| status | 意義 | 可做 | 不可做 |
|---|---|---|---|
| `free` | 開啟頁面後尚未打亂；可隨意轉 | 轉動、整顆轉、撤銷／重做、重設（回到復原）、提示、示範、打亂 | 計時（永遠 idle）、產生 `result` |
| `playing` | 已打亂，尚未復原 | 全部 | — |
| `solved` | 本局已復原（`result` 已凍結） | 打亂（再來一局）、重設、整顆轉、示範中的單步前後 | 轉動、撤銷／重做、提示、開始新示範 |

- 自由模式下轉回復原狀態不會產生 `result`，也不顯示慶祝（UI 可顯示小字 `texts.free.solvedHint`）。

---

## 4. Action 清單（reducer）

通用規則：
- 介面：`reduce(state, action, data) → newState`（純函數，不修改輸入；`data` 為 `GAME_DATA`，目前只用到 `data.params.scramble`）；`canApply(state, action, data) → boolean`。
- 前置條件不成立時 `reduce` 拋出 `Error("REJECT:<TYPE>:<reason>")`，不回傳原 state（沿用第一款做法）。UI 用 `canApply` 決定按鈕是否可按，正常操作不會觸發。
- 與時間有關的 action 都帶 `at`（毫秒，UI 以 `performance.now()` 取得，**只在 UI 層讀時鐘**）。engine 只做加減，`at` 早於 `since` 時該段視為 0。
- 「完成判定」＝ 每次 `home` 改變後，若 `status === "playing"` 且 `isSolved(home)`：`status = "solved"`、計時停止（§6.2）、`result = {timeMs, qtm: moveCount, assist}`，`assist` 依序取 `demo` → `"demo"`、`hint` → `"hint"`、否則 `"none"`。
- RNG 只在 `NEW_GAME` 使用（§5）。

| Action | payload | 前置條件 | 狀態轉移 |
|---|---|---|---|
| `NEW_GAME` | `{seed, at}` | `seed` 為 0–4294967295 的整數（否則 `invalidSeed`） | 依 §5 產生打亂；`home = start =` 復原狀態套用打亂；`orient = 0`；`history = []`、`cursor = 0`；`status = "playing"`；`timer` 歸零為 idle；`assist` 全 false；`hint = demo = result = null`；`version += 1` |
| `TURN` | `{move, at}` | `status !== "solved"`；`demo === null`；`hint` 不是 pending；`move` 為外層或中層記號（整顆旋轉拒絕 `notATurn`） | `m = toHome(orient, move)`；`history` 截到 `cursor` 後推入 `{m, src:"user"}`；`cursor += 1`；`home` 套用 `m`；`version += 1`；`hint = null`；若 `status === "playing"`：計時開始或恢復（§6.2）；完成判定 |
| `ROTATE` | `{move}` | `move` 為整顆旋轉；`demo === null` | `orient = orientAfter(orient, move)`；其他不變（`hint` 保留，因為存的是 home 記號） |
| `SET_ORIENT` | `{orient}` | 0–23 的整數；`demo === null` | `orient = orient`（拖曳視角放開後吸附用，§9.3） |
| `UNDO` | `{at}` | `cursor > 0`；`status !== "solved"`；`demo === null`；`hint` 不是 pending | `cursor -= 1`；`home` 套用 `inverse(history[cursor].m)`；`version += 1`；`hint = null`；`playing` 時計時恢復 |
| `REDO` | `{at}` | `cursor < history.length`；其餘同 UNDO | `home` 套用 `history[cursor].m`；`cursor += 1`；`version += 1`；`hint = null`；`playing` 時計時恢復；完成判定 |
| `RESET` | `{at}` | 無 | `home = start`；`history = []`、`cursor = 0`；`status = seed === null ? "free" : "playing"`；`timer` 歸零為 idle；`hint = demo = result = null`；**`assist` 保留**（同一個打亂已看過的提示／示範仍算數）；`version += 1`；`orient` 不變 |
| `PAUSE` | `{at, reason}` | `reason` 為 `"hidden"`（目前唯一值） | 若計時中：暫停（§6.2）；否則不變（不拒絕） |
| `HINT_REQUEST` | `{at}` | `status !== "solved"`；`isSolved(home) === false`；`demo === null`；`hint` 不是 pending | `hint = {pending:true, version, orient}`；計時暫停 |
| `HINT_READY` | `{version, tokens, source, planQtm}` | `hint.pending`；`version === state.version`（否則 `stale`）；`tokens` 為「0 個以上整顆旋轉＋恰好 1 個轉動」 | 以 `hint.orient` 起算、依序套用 `tokens` 裡的整顆旋轉得到 `o′`，`move = toHome(o′, 最後那個轉動)`；`hint = {pending:false, move, source, planQtm}`；`assist.hint = true` |
| `HINT_FAILED` | `{version, code}` | `hint.pending` 且版本相符 | `hint = null`（UI 顯示錯誤文案） |
| `HINT_CLEAR` | `{}` | `hint` 已顯示 | `hint = null`（`assist.hint` 不變） |
| `DEMO_REQUEST` | `{kind, at}` | `kind` 為 `"suggest"｜"lbl"`；`status !== "solved"`；`isSolved(home) === false`；`demo === null`；`hint` 不是 pending | `demo = {kind, pending:true, version, orient, tokens:[], segments:null, cursor:0, baseCursor:0}`；`hint = null`；計時暫停 |
| `DEMO_READY` | `{version, tokens, segments}` | `demo.pending` 且版本相符；`kind === "lbl"` 時 `segments` 必填 | `demo.pending = false`；寫入 `tokens`、`segments`、`baseCursor = cursor`；`history` 截到 `cursor`（丟掉可重做部分）；**`assist.demo = true`**（看到完整解即算「看過示範」） |
| `DEMO_FAILED` | `{version, code}` | `demo.pending` 且版本相符 | `demo = null` |
| `DEMO_STEP` | `{delta, at}` | `demo` 已就緒；`delta` 為 +1 或 −1；`0 ≤ demo.cursor + delta ≤ tokens.length` | +1：`t = tokens[cursor]`；整顆旋轉 → `orient = orientAfter(orient, t)`；轉動 → `m = toHome(orient, t)`、`history` 截到 `cursor` 後推入 `{m, src:"demo"}`、套用、`version += 1`；`demo.cursor += 1`；完成判定。−1：`t = tokens[cursor − 1]`；整顆旋轉 → `orient = orientAfter(orient, inverse(t))`；轉動 → 彈出 `history` 最後一筆（必為 `src:"demo"`）並套用其反向、`version += 1`；`demo.cursor -= 1`。`status === "solved"` 時仍可前後單步（供回看），`result` 不變 |
| `DEMO_SEEK` | `{cursor, at}` | 同上，目標在範圍內 | 等同連續 `DEMO_STEP`，直到 `demo.cursor === cursor` |
| `DEMO_EXIT` | `{at}` | `demo !== null` | 若 `status === "solved"` 且方塊未復原（回看中）：先播到結尾；然後 `demo = null`。計時維持暫停，下一次 `TURN` 才恢復 |

補充：
- 示範期間 `orient` 必定跟著示範走（`ROTATE`／`SET_ORIENT` 被拒絕）；UI 允許拖曳時暫時傾斜畫面，但放開後彈回，不送 action（§9.3）。
- 求解結果是非同步的；任何讓 `home` 改變的 action 都會讓 `version` 前進，使過期結果被拒絕（`stale`），UI 收到拒絕就丟棄該結果。
- 本規格不新增存檔 action；重新整理頁面就是新的 `initialState()`。

### 4.1 selectors（`src/engine/selectors.js`，UI 只透過這些讀資料）

| selector | 回傳 |
|---|---|
| `viewStickers(state)` | int[54]，view 座標 |
| `moveCount(state)` | QTM 淨步數（§2.2） |
| `elapsedMs(state, nowAt)` | `accMs ＋ (running ? max(0, nowAt − since) : 0)` |
| `isSolvedNow(state)` | `isSolved(home)` |
| `canApply(state, action, data)` | boolean（與 `reduce` 前置條件一致） |
| `hintView(state)` | `{move: toView(orient, hint.move), qtm, planQtm, source}` ｜ null |
| `hintLayer(state)` | 提示那一層在 view 座標的貼紙索引陣列（高亮用） |
| `demoInfo(state)` | `{kind, cursor, total, totalQtm, doneQtm, nextToken, nextIsRotation, segmentIndex, partIndex}` |
| `demoNextLayer(state)` | 下一個記號會轉到的 view 貼紙索引；整顆旋轉回傳全部 54 格 |
| `recordEligible(state)` | `status === "solved" && seed !== null && result.assist === "none"` |
| `solverInput(state)` | `{stickers: viewStickers, version, orient}` |

---

## 5. 打亂規則

- 產生器：`src/engine/scramble.js` 的 `makeScramble(seed, params) → string[]`，純函數。
- 亂數：xorshift32，演算法與 spike `makeRng` 相同（seed 為 0 時改用 `0x9e3779b9`；每次回傳 `s / 2^32`）。RNG 在函式內以 seed 建立、用完即丟，**不存進 state**；同 seed 必得同打亂。
- 記號池：外層 18 個（`U U2 U′ … B′`），依 `MOVE_ORDER = U R F D L B` × `["", "2", "'"]` 的順序編號；每次取 `floor(rng() × 18)`。
- 長度：`params.scramble.length` ＝ **25 個記號**〔預設值，待 G5 調整；來源為調研建議「20～25 步」與企劃 §10 第 5 點〕。
- 避免抵消（重抽，不計入長度）：
  1. 與前一個記號同一面（例：`R` 後接 `R′`、`R2`）。
  2. 與前兩個記號同一軸（例：`U D U`、`R L R2`）。軸：U/D、R/L、F/B。
- 若打亂結果剛好是復原狀態：以同一個 RNG 繼續產生新的 25 個記號（整串重來），直到不是復原。〔G3 實測：seed 1–10,000 發生 0 次〕
- 打亂本身的 QTM 長度：26–43〔G3 實測，seed 1–10,000〕。UI 不顯示打亂的步數，只顯示記號字串。
- 畫面必須標示「非 WCA 官方打亂」（文案鍵 `scramble.notOfficial`）。本規則是 random-move 打亂，狀態分布不均勻；WCA 用 random-state（調研 §E）。
- seed 由 UI 產生：優先 `crypto.getRandomValues(new Uint32Array(1))[0]`，不可用時 `Date.now() >>> 0`；只在 UI 層。不得使用 `Math.random`。
- 例（seed=20260915）：`U′ D′ B L′ F2 B U2 F′ B′ D2 R2 U2 R2 U2 B′ F2 U′ D L′ D′ R′ L B2 U F′`〔G3 實測〕。G4 實作後此字串應完全相同（`T-ENG-11`）。

---

## 6. 計時與紀錄

### 6.1 原則

- engine 不讀時鐘；時間由 action 的 `at` 帶入（§4）。
- UI 每 100 ms 以 `elapsedMs(state, performance.now())` 更新顯示〔預設值，待 G5 調整：`params.ui.timerRefreshMs`〕。
- 沒有手動暫停鍵（decision-log G2）。

### 6.2 規則

| 事件 | 計時器變化 |
|---|---|
| `NEW_GAME`、`RESET` | 歸零，`idle` |
| 第一個 `TURN`（外層或中層）｜`playing` | `idle → running`，`since = at` |
| 整顆旋轉、拖曳視角 | 不影響（不開始、不恢復） |
| 分頁切走或 App 進背景（UI 監聽 `visibilitychange` 為 hidden → 送 `PAUSE {reason:"hidden"}`） | `running → paused`，`accMs += at − since` |
| 按提示（`HINT_REQUEST`） | `running → paused` |
| 要求示範（`DEMO_REQUEST`） | `running → paused` |
| 暫停後的下一個 `TURN`／`UNDO`／`REDO`（玩家主動操作） | `paused → running` |
| 回到分頁 | **不自動恢復**；等玩家下一個動作才恢復 |
| 完成判定成立 | `running → stopped`（`accMs += at − since`）；若當時是 `paused`／`idle`，直接 `stopped` |
| 示範單步（`DEMO_STEP`） | 不恢復（示範期間維持暫停） |

- 與 `game-design.md` §4 的對應：「按下提示時暫停」解讀為「從按下提示起暫停，到玩家下一個動作才恢復」（推論；企劃沒寫恢復時機）。
- 自由模式計時器永遠 `idle`。

### 6.3 提示與示範對紀錄的影響（decision-log G2「提示／自動復原與紀錄」A）

| 本局情況 | 完成畫面 | 更新最佳紀錄 |
|---|---|---|
| 沒用提示、沒看示範 | 時間＋步數；若破紀錄標「新紀錄」 | 是 |
| 用過提示（`assist.hint`） | 時間＋步數＋「有提示」徽章 | 否 |
| 看過示範（`assist.demo`，含只看了一下就離開） | 時間＋步數作為參考，標「示範」 | 否 |

- 「看過示範」的定義：`DEMO_READY` 成功（玩家已能看到完整解）。等待求解中取消不算。
- `RESET` 不清除 `assist`：同一個打亂看過的提示或示範仍算數。

### 6.4 本機最佳紀錄（只准 UI 層）

- 模組：`src/ui/records.js`。**engine 與 solver 不得讀寫瀏覽器儲存，連註解都不能出現相關 API 名稱**（`check-forbidden.sh` 會掃註解）。
- 儲存 API：`localStorage`；全部包在 `try/catch`；不可用（隱私模式、被停用）時：不顯示紀錄、不報錯、遊戲照常。
- 鍵與格式〔預設值；鍵名放 `params.storage`〕：

```json
// 鍵 "cube3x3.records.v1"
{ "v": 1, "solves": 12,
  "bestTime": { "ms": 95321, "qtm": 142 },
  "bestMoves": { "qtm": 118, "ms": 120330 } }
// 鍵 "cube3x3.tutorial.v1"
{ "v": 1, "done": true }
```

- 寫入時機：`recordEligible(state)` 由 false 變 true 的那一次（UI 比對前後 state）。`solves` +1；`timeMs` 較小則換 `bestTime`；`qtm` 較小則換 `bestMoves`（相同不換）。
- 讀到格式不符（`v` 不是 1 或欄位缺漏）：當作沒有紀錄，下次寫入時覆蓋。
- 不存日期、不存 seed、不存打亂內容（N-7）。

---

## 7. 求解器（`src/solver/`）

架構取捨見 `ADR-001-solver.md`。本節是介面契約。

### 7.1 檔案

| 檔案 | 內容 | 起點 |
|---|---|---|
| `src/solver/twophase.js` | 兩階段法：建表、`solve`、cubie／貼紙互轉、`verify`、`fromStickerColors` | 由 `docs/spike/code/solver.js` 改寫（見 7.3） |
| `src/solver/lbl.js` | 層先法產生器 `generateLbl` | 新寫；可參考 `scratch/g3-check/lbl.js`（原型，不可直接複製成產品，須依本規格重寫並補測試） |
| `src/solver/worker.js` | Worker 訊息處理：`handleMessage(msg, post)`（純邏輯、可在 Node 測試）；本檔不接 `self.onmessage`，由 `build/bundle.js` 產生的 Worker 入口接上 | 新寫 |

- 模組格式：CommonJS，與 engine 相同（由 `build/bundle.js` 的迷你註冊器載入）。
- `lbl.js` 可 `require("../engine/cube")`；`twophase.js` 不依賴 engine（保留 spike 的自給自足）。
- solver 目錄受 `check-forbidden.sh` 檢查：不得出現 `performance.now`、`Date.now`、`Math.random`、`setTimeout`、`window.`、`document.` 等字串，**包含註解**。

### 7.2 介面

```js
// twophase.js
init(options, onProgress)   // options: {metrics:['qtm'], twistFlip:true, cornerTable:false}
                            // onProgress(step, total, label)；label 依序為
                            // 'moveTables','p1TS','p1FS','p2CS','p2ES','p1TF'（total = 6）
tableInfo() → {moveBytes, pruneBytes, totalBytes}
solve(cube, opts) → {moves:int[], alg, qtm, nodes, complete} | {error, nodes}
  // opts: {metric:'qtm', nodeLimit, firstNodeLimit, maxLength, phase2Cap}
fromStickerColors(colors54) → {ok, cube, facelets} | {ok:false, error}
// lbl.js
generateLbl(viewStickers54, config) → {tokens:string[], segments:Segment[], qtm} | {error}
```

### 7.3 由 spike 改寫時必須做的事

1. **移除所有時鐘**：刪掉 `now()`（spike 第 23–25 行用到 `performance.now`／`Date.now`）、`timeLimitMs`、`hardTimeLimitMs`、`timeMs`、`atMs`、建表計時 `T.timing`。
2. **改寫 spike 第 312 行註解**：原文含 `Math.random` 字樣，會被 hook 擋下（例：改成「不使用內建亂數」）。
3. 新增 `firstNodeLimit`：找到第一組解之前的節點上限；超過就回 `{error:'NODE_LIMIT'}`。spike 的 `nodeLimit` 只在找到第一組解後生效，沒有這個上限就可能無限搜尋。
4. `nodeLimit` 的意義維持 spike 原樣：**整次搜尋累計的節點數**（含找到第一組解之前）；找到第一組解後，累計超過就停止並回傳目前最佳解。
5. `init` 加 `onProgress` 回呼；只建 QTM 表（`metrics:['qtm']`、`twistFlip:true`、`cornerTable:false`）。
6. 移除 `solveOptimalQTM`、`randomQuarterScramble`、`conjugate`、`rotateMove`（N-4；v0.2 若要再從 spike 取回）。保留 `randomCube`、`makeRng` 供測試。
7. 移除 UMD 包裝中的全域掛載，改為 CommonJS `module.exports`。
8. 保留 clean-room 註記（不得開啟或複製第三方求解器原始碼；CLAUDE.md §1）。

### 7.4 參數預設值（`src/data/params.json` → `solver`）

| 參數 | 預設值 | 依據 |
|---|---|---|
| `metric` | `"qtm"` | spike §3 建議 (c)；decision-log 計步 QTM |
| `nodeLimit` | **3,000,000** | 〔G3 實測，1,000 局 seed 20260915〕復原 1000/1000；QTM 平均 27.63、最大 32；Node 耗時平均 102.2 ms、最大 254.1 ms。與 spike「100 ms 預算」的平均 27.64／最大 32 相當，但結果可重現 |
| `firstNodeLimit` | **30,000,000** | 〔G3 實測〕同 1,000 局找到第一組解的節點數最大 3,355,198（p95 1,225,041）；取約 9 倍作為安全上限〔預設值，待 G5 調整〕 |
| `maxLength` | 45 | spike `solve` 的 QTM 預設值 |
| `phase2Cap` | 20（無解時自動以 36 重搜） | spike §2.7 |
| `twistFlip` | true | spike §2.6 |

其他節點上限的量測（供 G5 調整參考）〔G3 實測，同一組 1,000 局，Node〕：

| nodeLimit | QTM 平均 | QTM 最大 | 耗時平均（ms） | 耗時最大（ms） |
|---|---|---|---|---|
| 0（第一組解即停） | 30.46 | 33 | 10.5 | 81.3 |
| 1,000,000 | 29.00 | 33 | 32.9 | 84.2 |
| **3,000,000** | **27.63** | **32** | **102.2** | **254.1** |
| 5,000,000 | 27.26 | 31 | 184.8 | 355.8 |
| 10,000,000 | 26.81 | 31 | 375.8 | 678.5 |

- 手機與 iPad 上的耗時：**UNKNOWN**（spike §6；待製作人實機量測）。
- 建表：只建 QTM 表時，spike 量到 Node 冷啟動中位數 1,027.2 ms、Chromium Worker 中位數 1,180 ms〔spike〕；本規格不建角塊全域表，型別陣列合計 **10,939,101 bytes**〔G3 實測：`init({metrics:['qtm'], twistFlip:true, cornerTable:false})` 的 `tableInfo` 加總；即 spike qtm 設定 10,979,421 bytes 減去 `cpFull` 40,320 bytes〕。

### 7.5 建議解與提示的流程

1. UI 取 `solverInput(state)`，先查 **計畫快取**（`src/ui/solver-client.js`）：鍵＝`home` 貼紙字串；值＝剩下的 home 記號序列。
2. 命中：直接送 `HINT_READY {tokens:[toView(orient, 快取第一個)], source:'suggest', planQtm}`（`planQtm` ＝ 剩餘序列 QTM 總和）。
3. 未命中：送 `solve` 給 Worker；收到結果後把整條解轉成 home 記號，沿著解的每一步把「該步之前的 home 字串 → 剩餘序列」全部存進快取（上限 `params.solver.planCacheSize` ＝ 64 條〔預設值〕，超過丟最舊的），再送 `HINT_READY`。
4. 玩家照提示轉 → 新 `home` 必在快取中 → 下一個提示立即出現，而且與上一條建議解一致（不會中途換解）。
5. 建議解示範也先查同一個快取。
- 因為 `nodeLimit` 不讀時鐘，同一個狀態不論快取與否，算出的解都相同（`T-SOL-04`）。

---

## 8. 層先法產生器（`src/solver/lbl.js`）

### 8.1 做法總覽

- 輸入：view 座標 54 格色號、`config`（來自 `src/data/lbl.json`）。
- 過程：在產生器內部的虛擬方塊上，依分段規則逐一「看狀態 → 選公式 → 套用」，套用的每個記號都記下來。
- 輸出記號是 view 座標，**包含整顆旋轉**（`x y z` 系列，0 步），讓玩家看到「先把方塊拿好再轉」。
- 首層顏色＝色號 0（白），末層＝其對面色號 3（黃），由 `lbl.json` 的 `firstLayerColor` 設定。
- 相鄰的同字母整顆旋轉必須合併（`y` `y′` → 消掉；`y` `y` → `y2`），只在同一分段、同一個 part 內合併〔G3 原型未合併，1,000 局出現 478 處，G4 必做，`T-LBL-07`〕。
- 決定性：不使用亂數，同輸入必得同輸出。

### 8.2 輸出格式

```json
{
  "tokens": ["x", "F2", "y", "R2", "D", "F2", "…"],
  "qtm": 176,
  "segments": [
    { "id": "hold", "start": 0, "end": 1, "qtm": 0,
      "parts": [ { "start": 0, "end": 1, "kind": "rotate", "formula": null } ] },
    { "id": "cross", "start": 1, "end": 20, "qtm": 22,
      "parts": [ { "start": 2, "end": 3, "kind": "setup", "formula": null },
                 { "start": 4, "end": 5, "kind": "formula", "formula": "crossDown" } ] }
  ]
}
```

- `segments` 固定 8 段、順序固定（下表），首尾相接並涵蓋全部 `tokens`；某段已完成時 `start === end`、`parts` 為空。
- `part.kind`：`rotate`（整顆旋轉）、`setup`（調整位置的單一轉動，例：轉 D 層對位）、`formula`（一次完整的公式套用，`formula` 為公式 id）。
- UI 以 `segments` 顯示分段進度、以 `parts` 顯示「正在做：公式名稱＋記號」。

### 8.3 分段定義

| # | id | 顯示名稱 | 一句說明（文案鍵 `lbl.<id>.desc`） | 完成判定（該段結束時必成立，`T-LBL-08`） |
|---|---|---|---|---|
| 0 | `hold` | 拿好方塊 | 先把白色中心轉到上面，我們從白色這一層開始。 | 白色中心在 U |
| 1 | `cross` | 白色十字 | 把四個白色邊塊放到上面，側面顏色也要對齊中心。 | U 面四個邊格為白，且四個邊塊側面各與該面中心同色 |
| 2 | `corners` | 白色角塊 | 把四個白色角塊放進上層，完成第一層。 | 上述之外，U 面四角為白且角塊兩側與中心同色（第一層完成） |
| 3 | `middle` | 中間層 | 把方塊翻過來讓白色朝下，再把四個中層邊塊放進去。 | 白色中心在 D；D 層與中層（FR、FL、BL、BR）全部歸位 |
| 4 | `yellowCross` | 黃色十字 | 在頂面做出黃色十字，這一步只看形狀、不管側面顏色。 | 前兩層不變；U 面四個邊格為黃 |
| 5 | `yellowFace` | 黃色頂面 | 把四個角也翻成黃色，讓整個頂面變成黃色。 | 前兩層不變；U 面 9 格全黃 |
| 6 | `yellowCorners` | 黃角歸位 | 把四個頂角換到正確位置，每一側兩個角的顏色要跟中心一樣。 | 前兩層不變；頂面全黃；四個頂角皆在正確位置（側面角格與該面中心同色） |
| 7 | `yellowEdges` | 黃邊歸位 | 最後把頂層邊塊換到正確位置，方塊就完成了。 | 六面同色 |

（分段名稱與說明為初稿，game-designer 可潤飾文案欄位，不得改 id 與判定。）

### 8.4 各段步驟與公式

公式皆為初學者常見公式；**正確性已用 `scratch/g3-check/` 模擬驗證**（見 8.6），出處為業界常見教學的通用寫法，本專案未逐一引用來源（標註：公式寫法未查證出處，效果已驗證）。

| 公式 id | 記號（`lbl.json`） | 顯示名稱 | 用在 |
|---|---|---|---|
| `crossDown` | `F2` | 白邊翻上來 | cross：白邊塊在 DF 且白色朝下 |
| `crossFlip` | `D R F' R'` | 白邊翻正 | cross：白邊塊在 DF 且白色朝前 |
| `cornerDrop` | `R' D' R` | 角塊拿下來 | corners：白角卡在頂層但位置或方向不對 |
| `cornerInsert` | `R' D' R D` | 角塊放上去（重複） | corners：白角在 DFR，重複到 UFR 歸位（最多 5 次） |
| `edgeRight` | `U R U' R' U' F' U F` | 中層邊放右邊 | middle：UF 邊塊要放進 FR |
| `edgeLeft` | `U' L' U L U F U' F'` | 中層邊放左邊 | middle：UF 邊塊要放進 FL |
| `edgeKickOut` | `U R U' R' U' F' U F` | 把卡住的邊塊換出來 | middle：錯的邊塊卡在 FR（與 edgeRight 同記號，名稱不同） |
| `yellowCross` | `F R U R' U' F'` | 黃十字公式 | yellowCross |
| `sune` | `R U R' U R U2 R'` | 小魚公式 | yellowFace |
| `aPerm` | `R' F R' B2 R F' R' B2 R2` | 換角公式 | yellowCorners（UFL 不動，其餘三角循環） |
| `uPerm` | `R2 U R U R' U' R' U' R' U R'` | 換邊公式 | yellowEdges（UB 不動，其餘三邊循環） |

各段規則（「D 調整」＝轉 D 層 0／1／2／3 次中最少的那一個，輸出 `D`、`D2`、`D′` 或不輸出；「U 調整」同理；「y 對位」＝輸出 `y`、`y2`、`y′` 或不輸出）：

- **hold**：白色中心在 F → `x`；B → `x′`；R → `z′`；L → `z`；D → `x2`；U → 不輸出。
- **cross**（白在上）：重複直到四邊完成——
  1. 取第一個未完成的側面（順序 F、R、B、L），y 對位把它轉到 F。
  2. 找白＋F 中心色的邊塊：
     - 在頂層（位置錯或方向錯）：轉所在側面 180°（`X2`），把它帶到底層。
     - 在中層：X 取邊塊位置名稱的第一個字母（FR、FL → F；BL、BR → B）；依序試 `X`、`X′`，選第一個能把它帶到底層的 `t`，輸出 `t D t⁻¹`（把頂層復原）。
  3. D 調整，讓它到 DF。
  4. 白色朝下 → `crossDown`；白色朝前 → `crossFlip`。
- **corners**（白在上）：重複直到四角完成——
  1. 取第一個未完成的目標槽（順序：F-R、R-B、B-L、L-F 兩側中心所夾的角），y 對位讓目標槽在 UFR。
  2. 找該角塊：若在頂層且不在 UFR → y 對位把它轉到 UFR、`cornerDrop`、再 y 轉回；若在 UFR 但方向錯 → `cornerDrop`。
  3. D 調整，讓它到 DFR。
  4. 重複 `cornerInsert` 直到 UFR 歸位（上限 5 次，超過回 `LBL_STUCK`）。
- **middle**：先輸出 `z2`（白色朝下、黃色朝上）。重複直到中層完成——
  1. 若頂層有「兩面都不是黃色」的邊塊：取第一個（順序 UF、UR、UB、UL），設其側面色為 s、頂面色為 t；y 對位讓 s 色中心在 F；U 調整讓它到 UF 且側面色在 F；t 等於 R 中心 → `edgeRight`，等於 L 中心 → `edgeLeft`。
  2. 否則（中層有錯的邊塊卡住）：取第一個錯的槽（順序 FR、FL、BL、BR），y 對位讓它在 FR，`edgeKickOut`。
- **yellowCross**：最多 3 次——看頂面四個邊格是黃的有幾個：4 → 完成；2 且成一直線 → U 調整讓線為左右向（UL–UR）；2 且成 L 形 → U 調整讓 L 在 UB–UL；0（只有中心點）→ 不調整；然後 `yellowCross`。
- **yellowFace**：重複直到頂面全黃（上限 6 次）——頂角朝上的黃色有 1 個 → U 調整讓它在 UFL；0 或 2 個 → U 調整讓 UFL 角的黃色朝左（L 面第 3 格，索引 38）；然後 `sune`。
- **yellowCorners**：重複直到四面都是「頭燈」（同側兩角同色）（上限 3 次）——恰有一面有頭燈 → U 調整讓那一面在 **B（後面）**；沒有頭燈 → 不調整；然後 `aPerm`。完成後 U 調整，讓 F 面左上角與 F 中心同色（頂角全部對齊）。
  - 頭燈必須在後面：〔G3 實測〕頭燈放 B 時 300/300 完成；放 F、R、L 時分別只完成 58、52、45 局。
- **yellowEdges**：重複直到四個頂邊都對（上限 3 次）——恰有一面的頂邊已對 → y 對位讓那一面在 B；沒有 → 不調整；然後 `uPerm`。（用 y 而不用 U，避免打亂已對齊的頂角。）

### 8.5 步數範圍

| 分段 | 平均 QTM | p95 | 最大 |
|---|---|---|---|
| hold | 0 | 0 | 0 |
| cross | 21.4 | 28 | 32 |
| corners | 51.4 | 73 | 90 |
| middle | 37.0 | 47 | 62 |
| yellowCross | 11.0 | 20 | 20 |
| yellowFace | 20.2 | 28 | 29 |
| yellowCorners | 13.6 | 26 | 27 |
| yellowEdges | 19.1 | 36 | 36 |
| **全部** | **173.6** | **207** | **232** |

〔G3 實測，原型，1,000 個 random-state，seed 20260915；未合併整顆旋轉，合併不影響 QTM。含整顆旋轉的記號數最多 227 個。〕
- 另一組 1,000 局（含中層與整顆旋轉的隨機序列）最大 236 QTM；近復原狀態列舉中最長 233 QTM。
- **理論最大步數：UNKNOWN**。以上是樣本值，不是上限。G4 以正式實作重跑並記錄分布（`T-LBL-10`）。
- 各公式最多重複次數（全部樣本）：`cornerInsert` 5、`sune` 3、`aPerm` 2、`uPerm` 3。產生器以此作為迴圈上限（`lbl.json` 的 `guards`），超過回 `{error:'LBL_STUCK'}`。

### 8.6 「任何合法狀態都能完成」的保證與測法

保證的論證（推論）：
- cross、corners、middle 三段是「依目標塊所在位置分類處理」，每一類都有對應動作，而且動作不會破壞已完成的塊（公式影響範圍已用程式確認：`cornerInsert` 只動 UFR、D 層與 FR；`edgeRight` 只動頂層與 FR；`crossFlip` 只動 UF、D 層與 FL）。
- 後四段只和頂層狀態有關；頂層在「前兩層完成」下共有 62,208 種可能（4! × 3³ × 4! × 2³ ÷ 2），**已全部列舉驗證**。
- 每個迴圈都有上限，超過就回錯誤，不會無窮迴圈。

測法（G4 必做，`T-LBL-01`～`T-LBL-04`）：

| 測試 | 內容 | G3 原型結果 |
|---|---|---|
| random-state | 1,000 局，seed 20260915，`randomCube` 轉貼紙 | 1000/1000 |
| 含中層與整顆 | 1,000 局，每局 40 個記號（36 個記號任取），seed 31415 | 1000/1000 |
| 末層全列舉 | 前兩層已完成、頂層 62,208 種 | 62208/62208 |
| 近復原全列舉 | 外層 ≤3 記號全部組合、36 記號 ≤2 記號全部組合、24 朝向的復原狀態，共 7,495 個 | 7495/7495 |

---

## 9. 示範播放器與互動（UI 契約）

版型由 G3.5 三版決定（ui-designer），本節只規定行為與必須呈現的資訊。

### 9.1 示範播放器

| 項目 | 規格 |
|---|---|
| 進入 | 按「建議解示範」或「層先法示範」→ `DEMO_REQUEST` → 等結果 → `DEMO_READY`；等待中顯示 §9.4 狀態 |
| 播放／暫停 | UI 自己的計時器，每 `speeds[i].stepMs` 送一次 `DEMO_STEP {delta:+1}`；到結尾自動停 |
| 單步前後 | `DEMO_STEP {delta:±1}`；播放中按單步會先暫停 |
| 跳到某段（層先法） | 點分段清單 → `DEMO_SEEK {cursor: segment.start}` |
| 速度 | 3 檔：慢 900 ms、中 500 ms、快 250 ms（每個記號）〔預設值，待 G5 調整：`params.demo.speeds`〕；預設「中」；轉動動畫時間 ＝ `stepMs × 0.8` |
| 離開 | 「離開示範」→ `DEMO_EXIT`；方塊停在目前進度，玩家可自己接著轉 |
| 記號高亮 | 記號列顯示全部 `tokens`；已完成的變淡、下一個（`cursor`）加框高亮；列可捲動並自動捲到下一個 |
| 層高亮 | 播放前以 `demoNextLayer` 高亮下一個記號要轉的那一層（半透明描邊或提亮），轉完取消；整顆旋轉時顯示「整顆轉（不計步）」字樣 |
| 分段進度（層先法） | 8 段清單：已完成（打勾）、進行中（高亮，顯示名稱＋一句說明＋本段步數）、未開始；目前 part 為公式時顯示「公式名稱：記號」 |
| 步數 | 依 §2.3 |
| 結尾 | 方塊復原：顯示完成畫面（§6.3 的「示範」版本），仍可前後單步回看 |

層先法總長約 95–236 QTM（§8.5），以「中」速約 1–2 分鐘（推論：記號數 × 0.5 秒）。

### 9.2 觸控手勢（轉層）

依據：CLAUDE.md §1「手指劃在方塊上＝轉層，劃在方塊外或雙指＝轉視角」；調研 §B1。

1. **起點**：`pointerdown` 時以 DOM 命中判斷起點是否為某張貼紙（每張貼紙元素帶 `data-sticker = view 索引`）。是 → 進入「轉層候選」；否 → 進入「轉視角」（§9.3）。
2. **方向鎖定**：手指位移（螢幕座標）累計達 `lockPx` 時決定方向：
   - 取起點貼紙所在面的「右」「下」方向（§1.1 表），依目前畫面的 3D 投影換算成螢幕上的兩個方向向量 A、B（UI 由自己的 CSS 變換矩陣計算）。
   - 在 ±A、±B 四個方向中，選與位移夾角最小者；夾角大於 `maxAxisAngleDeg` → 判為模糊，**本次手勢作廢**（不轉、也不改成轉視角）。
   - 得到 3D 方向 d（該面的 ±右 或 ±下）。
3. **決定轉哪一層、哪個方向**（`gestureToMove(viewIndex, d)`，engine 純函數）：
   - n ＝ 起點貼紙法向量，p ＝ 所在小方塊中心座標，ω ＝ n × d，k ＝ p · ω。
   - k = +1 → 法向量為 ω 的那一面，**逆時針**（`X′`）。
   - k = −1 → 法向量為 −ω 的那一面，**順時針**（`X`）。
   - k = 0 → 中層：M（參考法向量 L＝−x）、E（D＝−y）、S（F＝+z）中與 ω 平行者；ω 等於參考法向量 → `X′`，等於其反向 → `X`。
   - 〔G3 實測〕54 格 × 4 方向共 216 組，被按住的貼紙都往手指方向移動。抽樣：F 面左上格（F1）往右 → `U′`、往左 → `U`、往下 → `L`、往上 → `L′`；F 面中心（F5）往右 → `E`、往下 → `M`；U 面中心（U5，往畫面前方＝下）→ `M`、往右 → `S`。
4. **確認或取消**：鎖定後 UI 可讓該層跟著手指轉（視覺，不改 state）；放開時沿鎖定方向的投影距離 ≥ `commitPx` → 送 `TURN {move}`，否則彈回、不送。
5. **雙指**：轉層候選期間出現第二指 → 取消轉層，改為轉視角。
6. 一次手勢只轉 90°；180° 需劃兩次或按記號鍵。
7. 動畫播放中（轉層、打亂、示範）不接受新的轉層手勢。

參數（`params.gesture`，全部為〔預設值，待 G5 調整〕）：

| 參數 | 預設 | 意義 |
|---|---|---|
| `lockPx` | 10 | 位移達此值才決定方向（誤觸死區） |
| `commitPx` | 30 | 放開時投影距離達此值才轉 |
| `maxAxisAngleDeg` | 30 | 位移與最近方向的夾角上限，超過作廢 |
| `cameraDegPerPx` | 0.5 | 轉視角時每 px 轉幾度 |
| `pitchLimitDeg` | 80 | 拖曳時上下傾斜的上限 |

- 版面需求：舞台設 `touch-action: none`；iPad Safari 需阻止雙指縮放頁面（`gesturestart` 預設行為），實際需要哪些處理為 **UNKNOWN**，G5 真機確認。

### 9.3 轉視角（拖曳與雙指）

- 單指起點不在貼紙上，或雙指：整顆方塊跟著手指自由旋轉（純視覺）。
- **放開時吸附**到 24 個正朝向中最接近的一個，送 `SET_ORIENT {orient}`；0 步、不進撤銷紀錄、不影響計時。
  - 理由：記號永遠對應畫面——`U` 一定是畫面上方那一面、`F` 一定是正面、`R` 一定是右面，提示與示範的記號才看得懂。（此為需製作人確認的互動決策，見 §14。）
- 基準視角：畫面上看得到 U、F、R 三面（斜上方俯視）；實際角度由 G3.5 決定。
- 記號鍵的 `x`、`y`、`z` 系列按鈕 → `ROTATE {move}`。
- 示範期間：允許拖曳暫時傾斜，放開後彈回原朝向，不送 action。

### 9.4 求解器狀態與等待

| 求解器狀態（UI） | 條件 | 提示／示範按鈕 | 顯示 |
|---|---|---|---|
| `booting` | 頁面載入，Worker 建立中 | 可按；按了進入等待 | — |
| `building` | 已送 `init`，收到 `progress` k/6 | 可按；按了進入等待 | 按下後顯示 `texts.solver.preparing`＋進度條（k/6） |
| `ready` | 收到 `ready` | 可按 | — |
| `mainThread` | Worker 無法建立，改在主執行緒 | 可按；第一次按下時顯示 `texts.solver.mainThreadNotice` 後才建表（畫面會停頓） | 見文案 |
| `failed` | 建表逾時或出錯 | 建議解示範不可按；提示與層先法示範可按（改用層先法） | `texts.solver.failed` |

- 頁面第一次畫完後就在背景送 `init`（spike §5.3 建議）。
- 等待期間（`hint.pending`／`demo.pending`）：轉動、撤銷、重做都不可按；可按「取消」→ UI 送 `HINT_FAILED`／`DEMO_FAILED`（`code:'CANCELLED'`），Worker 的結果回來時因已不 pending 而被丟棄。

### 9.5 Worker 訊息協定

主執行緒 → Worker：

```js
{ type: 'init',  id, params: { nodeLimit, firstNodeLimit, maxLength, phase2Cap } }
{ type: 'solve', id, stickers: [/* 54 個 view 色號 */], opts: { nodeLimit, firstNodeLimit } /* 可省略，用 init 的值 */ }
{ type: 'lbl',   id, stickers: [/* 54 */], config: { /* lbl.json 全文 */ } }
```

Worker → 主執行緒：

```js
{ type: 'progress', id, step: 3, total: 6, label: 'p1FS' }          // 回應 init，建每張表後各一次
{ type: 'ready',    id, tableBytes: 10939101 }                      // 回應 init
{ type: 'result',   id, kind: 'solve', moves: ["R", "U2", "F'"], qtm, nodes, complete }
{ type: 'result',   id, kind: 'lbl', tokens: [...], segments: [...], qtm }
{ type: 'error',    id, code, detail }
```

| 錯誤碼 | 意義 | UI 處理 |
|---|---|---|
| `NOT_READY` | 尚未 `init` 就送 `solve` | 先送 `init` 再重送（程式錯誤，正常不會發生：Worker 單執行緒，排在 `init` 之後的訊息會等建表完成） |
| `INVALID_STATE` | `fromStickerColors` 失敗（`detail` 為 spike 錯誤碼） | 顯示 `texts.error.invalidState` |
| `NODE_LIMIT` | 超過 `firstNodeLimit` 仍無解 | 退回層先法（§9.6） |
| `LBL_STUCK` | 層先法超過迴圈上限（不應發生） | 顯示 `texts.error.generic` |
| `BAD_REQUEST` | 未知 `type` 或欄位缺漏 | 同上 |
| `INTERNAL` | 其他例外 | 同上 |

- `id`：主執行緒遞增整數，Worker 原樣帶回；同時間只允許一個未完成請求（hint 或 demo），`init` 除外。
- `lbl` 不需要建表，但會排在 `init` 之後處理。
- Worker 原始碼由 `build/bundle.js` 打包成字串 `window.SOLVER_WORKER_SRC`（含迷你註冊器、`engine/cube.js`、`engine/rng.js`、`solver/*.js`），UI 以 `new Blob([src], {type:'text/javascript'})` → `URL.createObjectURL` → `new Worker(url)` 建立；**不得外連、不得另存檔案**（CLAUDE.md §1）。

### 9.6 逾時與退回

| 情況 | 門檻（`params.solver`） | 處理 |
|---|---|---|
| `new Worker` 丟例外或 `onerror` | — | 狀態改 `mainThread`：主執行緒直接呼叫 `twophase`／`lbl`（主 bundle 也包含 solver 模組） |
| 建表逾時 | `initTimeoutMs` ＝ 20,000〔預設值，待 G5 實機調整；spike 桌機約 1.2 秒〕 | `terminate()`，狀態改 `failed` |
| 單次求解逾時 | `solveTimeoutMs` ＝ 10,000〔預設值，待 G5〕 | `terminate()` 後重建 Worker（背景重新建表）；本次請求退回層先法 |
| `NODE_LIMIT` | — | 本次請求退回層先法 |

- **退回層先法**：主執行緒呼叫 `generateLbl`（〔G3 實測〕`check-lbl.js` 共 64,208 局、每局產生兩次以驗證決定性，連同驗證合計 4.8 秒（`time` 實際經過時間），平均每次產生不到 0.04 ms；多數為較短的末層案例，完整局面會較久；推論在手機上也不會造成明顯停頓，實機 UNKNOWN）。
  - 提示：取第一個「轉動」記號及其前面的整顆旋轉作為 `tokens` 送 `HINT_READY {source:'lbl', planQtm:null}`。
  - 建議解示範：送 `DEMO_FAILED`，顯示 `texts.demo.suggestUnavailable`，並提供「改看層先法示範」按鈕。

---

## 10. 資料檔（`src/data/*.json`）

engine 與 solver 不直接讀檔；UI 啟動時從 `window.GAME_DATA` 取出後，以參數傳入（engine：`makeScramble(seed, params.scramble)`；solver：Worker `init`／`lbl` 訊息）。

### 10.1 `texts.json`（文案；game-designer 可改文字，不可改鍵）

```json
{
  "title": "魔術方塊",
  "buttons": { "scramble": "打亂", "newGame": "再來一局", "undo": "撤銷", "redo": "重做", "reset": "重設",
    "hint": "提示", "demoSuggest": "建議解示範", "demoLbl": "層先法示範", "play": "播放", "pause": "暫停",
    "stepForward": "下一步", "stepBack": "上一步", "exitDemo": "離開示範", "cancel": "取消",
    "speedSlow": "慢", "speedMid": "中", "speedFast": "快", "tryLbl": "改看層先法示範" },
  "scramble": { "notOfficial": "非 WCA 官方打亂", "label": "打亂：{alg}" },
  "hud": { "time": "時間", "moves": "步數", "best": "最佳", "qtmNote": "步數以 QTM 計：90° 算 1 步、180° 算 2 步，中層加倍，整顆轉不算。" },
  "hint": { "prompt": "卡住了嗎？按一下「提示」，看下一步該怎麼轉。", "only": "提示只會告訴你下一步，剩下的還是靠你自己轉喔。",
    "move": "{move}（{qtm} 步）", "plan": "照建議解還要 {n} 步", "solving": "準備提示中，請稍等一下。" },
  "demo": { "suggestTitle": "建議解：共 {n} 步", "lblTitle": "層先法：共 {n} 步", "progress": "已示範 {a}／{n} 步",
    "rotateLabel": "整顆轉（不計步）", "segmentSteps": "{n} 步", "formula": "{name}：{alg}",
    "solving": "正在整理建議解，請稍候⋯", "suggestUnavailable": "這次沒算出建議解，可以改看層先法示範。",
    "notShortest": "建議解是電腦找到的一種解法，步數不一定是最少的。" },
  "result": { "solved": "太棒了！方塊復原了！", "summary": "完成！這局用了 {time}、{qtm} 步。",
    "newRecord": "新紀錄", "badgeHint": "有提示", "badgeDemo": "示範", "demoNote": "看過示範的這局不列入紀錄。" },
  "free": { "solvedHint": "轉回原狀了。按「打亂」開始一局。" },
  "solver": { "preparing": "準備提示中，請稍等一下。", "mainThreadNotice": "這台裝置要在前景準備提示，畫面可能會停頓一下。",
    "failed": "建議解暫時無法使用，提示會改用層先法。" },
  "error": { "invalidState": "方塊狀態有誤，請按「重設」。", "generic": "出了點問題，請再試一次。" },
  "tutorial": [
    "用手指劃過方塊的一面，就能轉動那一層。試試看！",
    "劃在方塊外側的空白處，可以轉動整顆方塊，看看其他面。",
    "找不到記號也沒關係，下方有 U D L R F B 等按鈕可以直接轉。",
    "準備好了嗎？按「打亂」，開始你的第一局。",
    "轉不出來的時候，隨時可以按「提示」看下一步。"
  ],
  "lbl": {
    "hold": { "name": "拿好方塊", "desc": "先把白色中心轉到上面，我們從白色這一層開始。" },
    "cross": { "name": "白色十字", "desc": "把四個白色邊塊放到上面，側面顏色也要對齊中心。" },
    "corners": { "name": "白色角塊", "desc": "把四個白色角塊放進上層，完成第一層。" },
    "middle": { "name": "中間層", "desc": "把方塊翻過來讓白色朝下，再把四個中層邊塊放進去。" },
    "yellowCross": { "name": "黃色十字", "desc": "在頂面做出黃色十字，這一步只看形狀、不管側面顏色。" },
    "yellowFace": { "name": "黃色頂面", "desc": "把四個角也翻成黃色，讓整個頂面變成黃色。" },
    "yellowCorners": { "name": "黃角歸位", "desc": "把四個頂角換到正確位置，每一側兩個角的顏色要跟中心一樣。" },
    "yellowEdges": { "name": "黃邊歸位", "desc": "最後把頂層邊塊換到正確位置，方塊就完成了。" }
  }
}
```

- 文案來源：按鈕、提示語、完成語、等待語、教學為 `game-design.md` §6 原文或其延伸；`demoSuggest` 的名稱待製作人決定（§14 第 1 題）。
- 等待文案不得承諾秒數（`game-design.md` §11）。
- 禁用字：`Rubik`、`最佳解`、`最少步`、`最短`（`T-UI-14` 掃描 `texts.json` 與畫面文字；§14 第 1 題若拍板保留「最短示範」，再調整此測試）。

### 10.2 `palette.json`（配色；ui-designer 可調色值，不可改色號順序）

```json
{
  "stickers": [
    { "id": 0, "name": "白", "hex": "#FFFFFF" },
    { "id": 1, "name": "紅", "hex": "#C41E3A" },
    { "id": 2, "name": "綠", "hex": "#009E60" },
    { "id": 3, "name": "黃", "hex": "#FFD500" },
    { "id": 4, "name": "橙", "hex": "#FF5800" },
    { "id": 5, "name": "藍", "hex": "#0051BA" }
  ],
  "body": "#111111",
  "highlight": "#FFFFFF"
}
```

- 色號順序＝開局所在面 `U R F D L B`；白對黃、紅對橙、綠對藍、白上綠前時紅在右（西方配色，業界慣例，`game-design.md` §4）。
- 色值為初稿〔預設值，待 G3.5／G5 調整〕；需確保色弱玩家可分辨紅橙（UNKNOWN，G5 檢查）。

### 10.3 `params.json`（數值參數；全部〔預設值，待 G5 調整〕，除非另註）

```json
{
  "scramble": { "length": 25 },
  "solver": { "metric": "qtm", "nodeLimit": 3000000, "firstNodeLimit": 30000000, "maxLength": 45, "phase2Cap": 20,
    "initTimeoutMs": 20000, "solveTimeoutMs": 10000, "planCacheSize": 64 },
  "demo": { "speeds": [ { "id": "slow", "stepMs": 900 }, { "id": "mid", "stepMs": 500 }, { "id": "fast", "stepMs": 250 } ],
    "defaultSpeed": "mid", "animRatio": 0.8 },
  "gesture": { "lockPx": 10, "commitPx": 30, "maxAxisAngleDeg": 30, "cameraDegPerPx": 0.5, "pitchLimitDeg": 80 },
  "ui": { "turnAnimMs": 180, "scrambleAnimMsPerMove": 60, "timerRefreshMs": 100, "minTouchPx": 44 },
  "storage": { "recordsKey": "cube3x3.records.v1", "tutorialKey": "cube3x3.tutorial.v1" }
}
```

- `nodeLimit`、`firstNodeLimit` 有實測依據（§7.4）；`maxLength`、`phase2Cap` 沿用 spike；`minTouchPx` 為 CLAUDE.md §3.4 規定值。

### 10.4 `lbl.json`（層先法設定；改公式必須重跑 `T-LBL-*`）

```json
{
  "firstLayerColor": 0,
  "segments": ["hold", "cross", "corners", "middle", "yellowCross", "yellowFace", "yellowCorners", "yellowEdges"],
  "formulas": {
    "crossDown":    { "alg": "F2",                            "name": "白邊翻上來" },
    "crossFlip":    { "alg": "D R F' R'",                     "name": "白邊翻正" },
    "cornerDrop":   { "alg": "R' D' R",                       "name": "角塊拿下來" },
    "cornerInsert": { "alg": "R' D' R D",                     "name": "角塊放上去" },
    "edgeRight":    { "alg": "U R U' R' U' F' U F",           "name": "中層邊放右邊" },
    "edgeLeft":     { "alg": "U' L' U L U F U' F'",           "name": "中層邊放左邊" },
    "edgeKickOut":  { "alg": "U R U' R' U' F' U F",           "name": "把卡住的邊塊換出來" },
    "yellowCross":  { "alg": "F R U R' U' F'",                "name": "黃十字公式" },
    "sune":         { "alg": "R U R' U R U2 R'",              "name": "小魚公式" },
    "aPerm":        { "alg": "R' F R' B2 R F' R' B2 R2",      "name": "換角公式" },
    "uPerm":        { "alg": "R2 U R U R' U' R' U' R' U R'",  "name": "換邊公式" }
  },
  "headlightFace": "B",
  "guards": { "cross": 8, "corners": 12, "cornerInsert": 5, "middle": 16, "yellowCross": 3, "sune": 6, "aPerm": 3, "uPerm": 3 }
}
```

- 公式與規則是綁在一起的（例：`aPerm` 必須配 `headlightFace: "B"`），不是任意可換的平衡數值；放在資料檔是為了讓 UI 顯示名稱與記號、並讓測試對帳。
- `guards` 為迴圈上限；`cornerInsert`、`sune`、`aPerm`、`uPerm` 取 G3 實測最大值（5、3、2、3）再留餘裕（`sune` 6、`aPerm` 3）。

---

## 11. 其他 UI 規則

- 記號按鈕（備援，CLAUDE.md §1）：36 個記號都要能用按鈕完成（外層 18、中層 9、整顆 9）；排列由 G3.5 決定；每顆 ≥ 44×44 px。按鈕即 view 座標記號。
- 打亂動畫：`NEW_GAME` 後 UI 以 `scrambleAnimMsPerMove` 逐一播放打亂（純視覺），播放中不接受轉動；畫面顯示打亂記號字串與「非 WCA 官方打亂」。
- 再來一局：局中（`playing` 且 `cursor > 0`）按下需二次確認（UI 自訂）。
- 首次教學：`tutorialKey` 不存在時顯示 `texts.tutorial`（3–5 步，可略過）；完成或略過後寫入旗標。
- 完成畫面：依 §6.3；顯示時間（`m:ss.s`）與步數；「再來一局」。
- 兩種視圖：手機直向 390×844、iPad 橫向 1194×834（CLAUDE.md §4）。
- UI 不得自行計算規則（步數、復原、合法性、轉哪一層）——一律呼叫 engine 的 selectors 與 `gestureToMove`。

---

## 12. 驗收測試清單

測試檔放 `tests/engine/`（含子目錄 `tests/engine/solver/`，以符合 `package.json` 的 `node --test "tests/engine/**/*.test.js"`）與 `tests/ui/`。測試名稱以下表字串原樣出現在測試檔中。

### 12.1 engine（`T-ENG-*`，AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-ENG-01 | 36 個記號各做 4 次＝原狀（`X2` 做 2 次） |
| T-ENG-02 | 36 個記號：`X` 後 `X′`、`X′` 後 `X` 皆回原狀；`X2 = X·X`（在 20 個隨機狀態上） |
| T-ENG-03 | 恆等式 `M = R L′ x′`、`E = U D′ y′`、`S = F′ B z`、`x = R M′ L′`、`y = U E′ D′`、`z = F S B′` |
| T-ENG-04 | 方向抽查：U 把 F 頂排帶到 L；M 把 U 中欄帶到 F；E 把 F 中排帶到 R；S 把 U 中排帶到 R |
| T-ENG-05 | 外層 18 個記號的貼紙置換與 `solver/twophase.js` 的 `applyMoveFacelets` 完全一致 |
| T-ENG-06 | `qtmCost`：外層 1／2、中層 2／4、整顆 0（36 個逐一比對） |
| T-ENG-07 | `isSolved`：24 朝向的復原狀態皆 true；`M R′ L` 後為 true；單一 `M` 後為 false |
| T-ENG-08 | 24 種朝向互不相同；編號順序固定（鎖定 `orientAfter(0,'x')`、`orientAfter(0,'y')`、`orientAfter(0,'z')` 的值與 24 個置換的雜湊）；`ROTATE` 只改 `orient` |
| T-ENG-09 | `toHome`／`toView` 互逆，且「view 做 X」＝「home 做 `toHome(o,X)`」（2,000 組隨機） |
| T-ENG-10 | `gestureToMove`：216 組貼紙位移與滑動同向；§9.2 抽樣表逐項相符 |
| T-ENG-11 | 打亂：同 seed 兩次相同；seed 20260915 等於 §5 範例字串；無同面相鄰、無同軸連三；長度＝參數；非復原；seed 非 uint32 被拒絕 |
| T-ENG-12 | 同 seed＋同 action 序列（含 `at`、提示、示範的 READY 內容）重放兩次，最終 state `deepStrictEqual` |
| T-ENG-13 | `reduce` 不修改輸入（深度凍結後呼叫不拋錯） |
| T-ENG-14 | 隨機 1,000 個合法 action 序列，每步後不變式 INV-1～INV-6 成立 |
| T-ENG-15 | 撤銷／重做：`TURN` 後 `UNDO` 回原狀；`REDO` 再套用；新 `TURN` 清掉可重做部分；`cursor = 0` 時 `UNDO` 被拒絕 |
| T-ENG-16 | 步數：`moveCount` ＝ QTM 淨步數；`ROTATE` 不變；`UNDO` 扣回 |
| T-ENG-17 | 計時：第一個 `TURN` 開始；`ROTATE` 不開始；`PAUSE` 暫停；回來後下一個 `TURN` 才恢復；完成即停；`elapsedMs` 正確；`at` 倒退時該段計 0 |
| T-ENG-18 | 提示：`HINT_REQUEST` 暫停計時；版本不符的 `HINT_READY` 被拒絕（`stale`）；成功後 `assist.hint = true`；`TURN` 清除提示；`ROTATE` 不清除且 `hintView` 隨朝向換算 |
| T-ENG-19 | 示範：`DEMO_READY` 設 `assist.demo`；`DEMO_STEP ±1` 正確套用／還原（含整顆旋轉）；示範中 `TURN`、`ROTATE` 被拒絕；`DEMO_EXIT` 保留進度；播到結尾 → `solved` 且 `result.assist = "demo"`；`recordEligible` 為 false |
| T-ENG-20 | `RESET`：回到 `start`、清空 `history`、計時 idle、`assist` 保留、`orient` 不變 |
| T-ENG-21 | `solved` 狀態拒絕 `TURN`、`UNDO`、`REDO`、`HINT_REQUEST`、`DEMO_REQUEST`；接受 `NEW_GAME`、`RESET`、`ROTATE` |
| T-ENG-22 | 拒絕訊息格式為 `REJECT:<TYPE>:<reason>`；`canApply` 與 `reduce` 判斷一致（對所有 action 類型抽樣） |
| T-ENG-23 | `recordEligible`：無輔助完成 true；有提示、示範、自由模式皆 false |
| T-ENG-24 | 掃描 `src/engine/`、`src/solver/`：無 `check-forbidden.sh` 所列字串（含註解） |

### 12.2 求解器（`T-SOL-*`，AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-SOL-01 | cubie 乘法與貼紙轉動一致（隨機 500 組序列；沿用 spike 測試 5） |
| T-SOL-02 | `verify` 反例：單角扭轉、單邊翻轉、兩塊互換、重複方塊（沿用 spike 測試 7） |
| T-SOL-03 | **1,000 個 random-state（seed 20260915）以 `nodeLimit` 3,000,000 求解：100% 復原；QTM 最大 ≤ 32；平均 ≤ 27.7**（G3 實測 27.63／32），並輸出直方圖 |
| T-SOL-04 | 同一狀態求解兩次，`moves` 完全相同；原始碼無時鐘（併 T-ENG-24） |
| T-SOL-05 | `firstNodeLimit: 1000` 時對隨機狀態回 `NODE_LIMIT` |
| T-SOL-06 | 已復原狀態回空解；非法狀態回對應錯誤碼 |
| T-SOL-07 | 正規化：200 局含中層與整顆旋轉的隨機序列 → `viewStickers` → 求解 → 以 `toHome` 套回 → 復原 |
| T-SOL-08 | Worker 協定（在 Node 直接呼叫 `handleMessage`）：`init` → 6 次 `progress` → `ready`；`solve`／`lbl` 回 `result` 且 `id` 相符；未知 `type` 回 `BAD_REQUEST`；非法貼紙回 `INVALID_STATE` |
| T-SOL-09 | `tableInfo().totalBytes === 10939101`（若不同，回報實際值與原因，不得直接改測試） |
| T-SOL-10 | Node 建表時間記錄（僅輸出，不判定通過；超過 1,500 ms 印警告；spike 桌機 1,027.2 ms） |

### 12.3 層先法（`T-LBL-*`，AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-LBL-01 | 1,000 個 random-state（seed 20260915）100% 復原 |
| T-LBL-02 | 1,000 個 40 記號隨機序列（36 記號任取，seed 31415）100% 復原 |
| T-LBL-03 | 末層全列舉 62,208 種 100% 復原 |
| T-LBL-04 | 近復原列舉 7,495 種（§8.6）100% 復原 |
| T-LBL-05 | 分段結構：8 段、id 與順序正確、首尾相接、`parts` 在段內；`kind:"formula"` 的記號恰等於 `lbl.json` 該公式 |
| T-LBL-06 | 同輸入兩次輸出完全相同 |
| T-LBL-07 | 輸出中沒有相鄰的同字母整顆旋轉 |
| T-LBL-08 | 每段結束時 §8.3 的完成判定成立（T-LBL-01、02 的每一局） |
| T-LBL-09 | 各迴圈次數不超過 `guards`；以故意改錯的設定（例：`headlightFace:"F"`）觸發 `LBL_STUCK`，不得無窮迴圈 |
| T-LBL-10 | 輸出步數分布（總 QTM 與各段的平均、p95、最大）到測試診斷訊息，回報抄進 `docs/reports/` |

### 12.4 建置（`T-BUILD-*`，AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-BUILD-01 | `npm run build` 產生單一 `index.html`；連續兩次 byte-identical |
| T-BUILD-02 | 產物無 `http://`、`https://`、`<link`、外部 `src=`、`@import`；**檔案 < 300 KB**；**`SOLVER_WORKER_SRC` 字串 < 100 KB** |
| T-BUILD-03 | 產物中 `SOLVER_WORKER_SRC` 可被 `new Function` 解析（語法正確），且不含 `src/ui/` 的任何模組 |

大小上限的理由：spike `solver.js` 37,711 bytes 是目前已知最大的單一模組〔spike〕；層先法原型 10,346 bytes、貼紙模型原型 5,158 bytes〔G3 實測，含註解〕。Worker 字串約為 solver＋層先法＋cube＋rng＋註冊器，加上 JSON 字串跳脫，推論約 60–75 KB，取 100 KB 為上限。主 bundle 另含 solver 模組一份（主執行緒退回用），加上 UI、CSS、資料，推論約 200 KB，沿用 CLAUDE.md §4 與現有 `build/bundle.js` 的 300 KB 上限。

### 12.5 UI（`T-UI-*`；Playwright，手機直向 390×844 與 iPad 橫向 1194×834 各跑一次；AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-UI-01 | 開啟無 console error；方塊與記號鍵出現 |
| T-UI-02 | 打亂 → 按記號鍵 `R`、`M` → 步數顯示 1、3 → 撤銷 → 1 → 重做 → 3 |
| T-UI-03 | 所有 `button`、`[role=button]` 的 boundingBox ≥ 44×44 |
| T-UI-04 | 產物無外連（同 T-BUILD-02），並以 Playwright 攔截所有網路請求：載入與遊玩過程中 0 個外部請求 |
| T-UI-05 | 手勢：在 F 面中心貼紙往右拖 60 px → 步數 +2 且方塊狀態等於做了 `E`（以測試掛鉤讀 state） |
| T-UI-06 | 在方塊外拖曳 → `orient` 改變、步數不變、計時不開始 |
| T-UI-07 | 提示：等 `ready` → 按提示 → 出現記號與層高亮 → 照做 → 提示消失 → 再按提示立即出現（快取）→ 用建議解示範播完 → 完成畫面有「示範」 |
| T-UI-08 | 建議解示範播完：完成畫面標「示範」，`localStorage` 紀錄未改變 |
| T-UI-09 | 層先法示範：分段清單 8 段；單步前進／後退使方塊與記號高亮同步；點第 4 段跳到該段開頭；速度切換有效 |
| T-UI-10 | 無輔助完成：讀畫面上的打亂字串，按記號鍵依序輸入其反序反向 → 完成畫面無徽章 → 紀錄寫入 `cube3x3.records.v1` |
| T-UI-11 | 分頁隱藏（測試中以覆寫 `document.visibilityState` 並觸發 `visibilitychange`）→ 計時暫停 |
| T-UI-12 | 載入前把 `window.Worker` 設為 undefined → 狀態 `mainThread` → 提示仍可得到 |
| T-UI-13 | 載入前讓 `localStorage` 存取拋例外 → 遊戲可完成一局且無 console error |
| T-UI-14 | `texts.json` 全部字串、產物的 `<title>`，以及兩種視圖下開局、提示、兩種示範、完成畫面時的 `document.body.innerText`，皆不含 `Rubik`、`最佳解`、`最少步`、`最短`（程式註解不在此限，但同樣不得出現 `Rubik`） |

- 測試掛鉤：UI 在網址帶 `?test=1` 時提供 `window.__cubeTest = { getState(), dispatch(action) }`；正式使用不帶參數時不建立。

### 12.6 資料（`T-DATA-*`，AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-DATA-01 | `palette.stickers` 6 筆、id 0–5、hex 互不相同 |
| T-DATA-02 | `lbl.json` 每個 `alg` 都能被解析且只含外層記號；`segments` 與 §8.3 一致 |
| T-DATA-03 | `texts.lbl` 有 8 段且鍵與 `lbl.segments` 一致；`tutorial` 3–5 筆 |
| T-DATA-04 | `params` 各欄位存在且為正數；`demo.defaultSpeed` 存在於 `speeds` |
| T-DATA-05 | 全部 `src/`、`docs/spec/` 無常見簡體字（字表放測試檔） |

### 12.7 需製作人本機驗（M-*）

| 編號 | 內容 |
|---|---|
| M-01 | iPad Safari 橫向：CSS 3D 方塊無破圖、無面片閃爍（轉層、轉視角、示範時） |
| M-02 | iPhone／iPad 實機：建表時間與一次提示的等待時間（記錄秒數，供 G5 調 `initTimeoutMs`、`nodeLimit`） |
| M-03 | 手勢手感：轉層與轉視角是否誤觸；雙指是否觸發頁面縮放 |
| M-04 | 飛航模式下以 `file://` 或本機網址開啟可完整玩一局，提示與兩種示範可用 |
| M-05 | 手機直向單手可完成打亂、轉動、提示、示範 |

---

## 13. 已知風險與 UNKNOWN

| # | 項目 | 狀態／處理 |
|---|---|---|
| R-1 | iPad Safari 的 CSS 3D（`preserve-3d`、背面、疊層）破圖 | **UNKNOWN**；G0 已列；M-01 真機驗 |
| R-2 | 手機實機建表時間、記憶體（型別陣列約 10.9 MB） | **UNKNOWN**（spike §6）；M-02；逾時門檻為預設值 |
| R-3 | iOS Safari 在 `file://` 下能否用 Blob URL 建 Worker | **UNKNOWN**；已規定退回主執行緒（§9.6、T-UI-12） |
| R-4 | spike `solver.js` 會被 hook 擋：第 312 行註解含 `Math.random`，**第 23–25 行另有 `performance.now` 與 `Date.now`** | G4 改寫時必須移除（§7.3 第 1、2 點） |
| R-5 | `nodeLimit` 3,000,000 在手機上的耗時 | **UNKNOWN**；桌機 Node 平均 102.2 ms、最大 254.1 ms〔G3 實測〕 |
| R-6 | 層先法示範很長（樣本最大 236 QTM）；近復原狀態也可能超過 200 步，教學體驗可能不佳 | 已知；理論上限 UNKNOWN；G5 觀察，v0.2 可考慮「只示範目前這一段」 |
| R-7 | 層先法公式寫法的出處未逐一查證 | 效果已用模擬驗證（§8.6）；文案不宣稱「官方公式」 |
| R-8 | 手勢參數全為預設值 | 待 G5；調研 §B1 指出邊界誤判是常見問題 |
| R-9 | 放開拖曳即吸附 24 朝向，可能讓想「斜看」的玩家覺得受限 | 需製作人確認（§14 第 2 題）；G5 觀察 |
| R-10 | random-move 打亂分布不均勻 | 已標「非 WCA 官方打亂」 |
| R-11 | `node --test` 帶萬用字元路徑需要較新的 Node（本機 v22.22.2 可用）；`CLAUDE.md` §4 寫「Node ≥ 18」 | 製作人本機 Node 版本 **UNKNOWN**；列入回報 |
| R-12 | 現有 `build/bundle.js` 是第一款遊戲的版本（檔案清單含 `jobs`、`assets` 等），不適用本案 | 分派單 S7 改寫 |
| R-13 | `′` 字元在 iOS 預設字型的顯示效果 | **UNKNOWN**；G3.5／G5 檢查 |
| R-14 | 紅橙配色在色弱玩家的辨識度 | **UNKNOWN**；G5 檢查 |
| R-15 | 快取的建議解與「重新求解」理論上可能不同（快取只在照提示轉時使用） | 已知；因 `nodeLimit` 可重現，同一狀態算出的解必相同，不影響正確性 |

---

## 14. 需要製作人決定的事（影響 UI，請於 G3.5 一併回覆）

1. **「最短示範」的按鈕名稱**：decision-log 寫「最短示範（建議解）」，但「最短」容易被理解為最少步，與 CLAUDE.md §1「未經驗證不得稱最佳解」同一精神衝突（兩階段法建議解平均 27.6 步，而 QTM 上帝之數 26 是任何狀態最少步數的上限，可見多數建議解都不是最短）。建議改為「**建議解示範**」（本規格暫用）；或保留「最短示範」並加註「不一定是最少步」。
2. **拖曳視角放開後是否吸附到正朝向**：建議吸附（記號 U／F／R 永遠對應畫面上、前、右，提示與示範才看得懂）；另一方案是自由角度（記號與畫面可能對不上，需另外在方塊上標字母）。
3. **撤銷是否扣回步數**：建議扣回（步數＝目前這條解法的長度，§2.2）；另一方案是「每一次操作都算，撤銷也算 1 次」（較接近實體方塊的真實手數）。

---

## 附錄 A：G3 驗證程式與結果摘錄（`scratch/g3-check/`）

| 檔案 | 用途 |
|---|---|
| `cube-model.js` | 貼紙模型原型：36 記號置換、24 朝向、`toHome`／`toView`、`gestureToMove`、`qtmCost`（引用 spike 求解器副本的幾何） |
| `check-model.js` → `results-model.txt` | 記號方向、恆等式、QTM、復原判定、朝向換算、手勢、正規化求解 |
| `lbl.js`、`find-headlight.js` → `results-headlight.txt` | 層先法原型；頭燈位置實驗 |
| `check-lbl.js`、`check-lbl-near.js` → `results-lbl.txt` | 層先法 random-state、含中層與整顆、末層全列舉、近復原列舉 |
| `probe-formulas.js` | 各公式影響哪些塊 |
| `check-scramble.js` → `results-scramble.txt` | 打亂規則 |
| `spike-solver-copy.js`、`bench-nodes.js` → `results-nodes.txt` | spike 求解器副本（僅加記錄第一組解的節點數）；節點上限量測 |

```
# results-model.txt
ok  36 個轉動：X⁴＝原狀、X·X′＝原狀、X2＝X·X
ok  外層 18 個轉動與 spike solver.js 的貼紙置換一致
ok  慣例恆等式：M=R L' x'、E=U D' y'、S=F' B z、x=R M' L'、y=U E' D'、z=F S B'
ok  方向抽查：M 同 L（U→F）、E 同 D（F→R）、S 同 F（U→R）
ok  QTM：外層 1/2、中層 2/4、整顆 0
ok  復原判定：24 朝向皆為復原；M R′ L（＝整顆 x′）為復原；單一 M 非復原
ok  view↔home 轉動換算 2,000 組一致，且外層↔外層、中層↔中層
ok  整顆旋轉＝只改 orient，不動 home 貼紙（500 組）
ok  手勢對應：216 組（54 格×4 方向）貼紙位移皆與滑動方向同向
    抽樣（F 面、U 面）：{"U5 往右":"S","U5 往左":"S'","U5 往下":"M","U5 往上":"M'","F1 往右":"U'","F1 往左":"U","F1 往下":"L","F1 往上":"L'","F5 往右":"E","F5 往左":"E'","F5 往下":"M","F5 往上":"M'"}
ok  正規化：200 局含中層／整顆旋轉的狀態，fromStickerColors 皆合法，QTM 建議解套回後皆復原（200/200）
共 10 項通過

# results-lbl.txt（節錄）
(a) random-state seed=20260915：1000 局全部復原；總 QTM 平均 173.6、p50 175、p95 207、最小 95、最大 232；記號數（含整顆旋轉）最大 227
(b) 40 記號隨機序列（含 M/E/S 與 x/y/z）seed=31415：1000 局全部復原；總 QTM 平均 173.3、p50 174、p95 209、最小 97、最大 236；記號數（含整顆旋轉）最大 237
(c) 末層全列舉 62208 種：62208 局全部復原；總 QTM 平均 63.3、p50 64、p95 87、最小 0、最大 112；記號數（含整顆旋轉）最大 98
公式重複次數上限（全部樣本）：{"maxCornerRepeat":5,"maxSune":3,"maxAPerm":2,"maxUPerm":3}
1000 局：整顆旋轉記號共 12243 個、每局最多 17 個；相鄰同字母整顆旋轉 478 處
近復原狀態 7495 個全部完成；其中最長 233 QTM
# find-headlight.js（各 300 局）
headlights at F ok 58 / R ok 52 / B ok 300 / L ok 45

# results-nodes.txt（節錄；1,000 局 seed 20260915，Node v22.22.2）
init(qtm, twistFlip) ms 1037.045834
tableBytes(qtm, twistFlip, no cornerTable) = 10939101
nodeLimit=0: 復原 1000/1000；QTM 平均 30.46 最大 33；ms 平均 10.5 p95 31.4 最大 81.3；第一組解節點 平均 397932 p95 1225041 最大 3355198
nodeLimit=3000000: 復原 1000/1000；QTM 平均 27.63 最大 32；ms 平均 102.2 p95 118.5 最大 254.1
nodeLimit=10000000: 復原 1000/1000；QTM 平均 26.81 最大 31；ms 平均 375.8 p95 439.0 最大 678.5

# results-scramble.txt
seed 1..10000、長度 25：同 seed 兩次相同；打亂後恰為復原 0 次；打亂本身 QTM 最小 26 最大 43
例 seed=20260915：U' D' B L' F2 B U2 F' B' D2 R2 U2 R2 U2 B' F2 U' D L' D' R' L B2 U F'
```

未驗證的項目：手勢在真實觸控螢幕上的手感、CSS 3D 投影換算、Worker 在 Safari 的行為、所有 UI 行為（皆待 G4／G5）。

---

## 附錄 B：拍板對照表（逐條自我檢查）

| 來源 | 拍板內容 | 本規格對應 | 結果 |
|---|---|---|---|
| decision-log G0 | Repo `cube-3x3` | 無涉 | 無矛盾 |
| decision-log G0 | 3D：CSS 3D | §9.2 以 DOM 命中判斷貼紙；M-01 | 一致 |
| decision-log G0 | 求解器自己寫（Kociemba 兩階段） | §7：由本案 spike（clean-room）改寫；不引入第三方 | 一致 |
| decision-log G0 | v0.1＝M1＋M3；M2、M4、M5、M6 列 v0.2 | §0.1、§0.2 N-1（M4 只提前「示範」部分，依 G2 拍板） | 一致 |
| decision-log G0 | 計步 QTM；建議解步數以 QTM 顯示 | §2；§7.4 以 QTM 成本搜尋 | 一致 |
| decision-log G0 | 通用詞「魔術方塊」，不得出現 Rubik's | §0.2 N-9；T-UI-14 | 一致 |
| decision-log G2 | 定位：沒有實體方塊也能玩、看電腦怎麼解 | §0.1 F-1～F-4 | 一致 |
| decision-log G2 | 兩種示範都做；互動式逐段教學留 v0.2 | §7、§8、§9.1；§0.2 N-1 | 一致 |
| decision-log G2 | 中層 90° 計 2 步（180° 計 4 步） | §2.1 | 一致 |
| decision-log G2 | 用提示標「有提示」；看過自動復原的那局不列紀錄 | §6.3（「看過」定義為 `DEMO_READY` 成功） | 一致（定義為本規格補充） |
| decision-log G2 | 遊戲名稱「魔術方塊」 | §10.1 `title` | 一致 |
| decision-log G2 | 2D 展開圖留 v0.2 | §0.2 N-2 | 一致 |
| decision-log G2 | 手動暫停鍵不做，只自動暫停 | §6.2 | 一致 |
| decision-log G2 | 求解器放 `src/solver/`，以節點上限控時、不讀時鐘、可重現、Web Worker 執行 | §7.1、§7.3、§7.4、§9.5 | 一致 |
| decision-log G2 | 本機資料夾 | 無涉 | 無矛盾 |
| decision-log G2 | 看電腦解的名稱「最短示範（建議解）」 | §10.1 暫用「建議解示範」 | **待製作人確認**（§14 第 1 題） |
| CLAUDE.md §1 | 畫面稱「建議解」，不得稱「最佳解」 | §2.3、§10.1、T-UI-14 | 一致 |
| CLAUDE.md §1 | Worker 以 Blob 由同一檔案產生，不得外連 | §9.5、T-BUILD-02/03 | 一致 |
| CLAUDE.md §1 | 劃在方塊上＝轉層；方塊外或雙指＝轉視角；記號按鈕備援 | §9.2、§9.3、§11 | 一致 |
| CLAUDE.md §3 | 純函數、seeded RNG、資料驅動、觸控優先、零依賴 | §4、§5、§10、§11、§12 | 一致 |
| game-design §4 | 按提示或自動復原時計時暫停 | §6.2（恢復時機為本規格補充：下一個動作） | 一致（補充） |
| game-design §4 | 計時從打亂完成後第一個有效轉動開始 | §6.2、§11 打亂動畫中不接受轉動 | 一致 |
| game-design §11 | 等待文案不承諾秒數；知識卡「最多 26 步」 | §10.1；知識卡不在 v0.1 | 一致 |
| spike §5 | QTM 成本搜尋、只建 QTM 表、求解器不放 engine、重放用節點上限 | §7 | 一致 |
