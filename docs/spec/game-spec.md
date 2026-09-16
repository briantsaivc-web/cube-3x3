# 規格書：魔術方塊 v0.1（自由練習＋提示＋看電腦解）

- 撰寫角色：systems-engineer　- 日期：2026-09-15　- 規格版本：**v0.1.1**（v0.1 ＋ G3.5 拍板修訂）　- Gate：G3（G3.5 拍板後修訂）
- 依據（優先序由高到低）：`CLAUDE.md`、`docs/decision-log.md`（最新拍板；G3.5 六列為本次修訂的最高依據）、`docs/ui/decision-log.md`、`docs/ui/v1-C.html`（選定版型）、`docs/G0-kickoff.md` §10、`docs/design/game-design.md`（含 §11 spike 回填）、`docs/spike/solver-spike.md`、`docs/research/cube-games.md`
- 相關文件：`docs/spec/ADR-001-solver.md`（求解器架構）、`docs/tickets/T-001/dispatch.md`（G4 分派單）
- 驗證程式：`scratch/g3-check/`（本規格的公式、方向、手勢、節點上限都在這裡實測過；`scratch/` 不進版控，結果摘錄在附錄 A）
- G3.5 修訂（2026-09-15）：版型 C、記號教學、「建議解示範」定名、視角吸附、撤銷扣回步數。逐項對照見**附錄 C「G3.5 修訂對照表」**；本文中的「修訂 R-n」即指該表編號（與 §13 風險編號 RK-n 無關）。
- 數字的來源標示：**〔spike〕**＝`docs/spike/solver-spike.md`；**〔G3 實測〕**＝`scratch/g3-check/results-*.txt`（Node v22.22.2，本機）；**〔預設值，待 G5 調整〕**＝本規格暫定；**UNKNOWN**＝目前查不到。

---

## 0. 範圍

### 0.1 v0.1 要做（decision-log 2026-09-15 G0／G2／G3.5）

| # | 功能 | 本規格章節 |
|---|---|---|
| F-1 | 自由練習：打亂、轉動（手勢＋記號按鈕）、撤銷／重做、重設、計時、QTM 計步、復原判定 | §2–§6、§10 |
| F-2 | 提示：一次只顯示「下一步」 | §7.5、§4 |
| F-3 | 看電腦解 A：建議解示範（兩階段法、以 QTM 成本搜尋） | §7、§9 |
| F-4 | 看電腦解 B：層先法示範（分段、每段有名稱與一句說明；每段結束自動暫停並顯示「本段完成／下一段」卡片；公式附名稱與白話用途） | §8、§9.1、§10.4 |
| F-5 | 本機最佳紀錄（只存在 UI 層） | §6.4 |
| F-6 | 首次操作教學（5 步，文案見 `game-design.md` §6.5）＋**記號小教室**（7 步，可略過，可從「記號說明」重開） | §11.3 |
| F-7 | 記號學習輔助：記號鍵中文副標、中層鍵摺疊、整顆轉鍵分組、面標籤開關、提示與示範每一步的白話說明 | §2.4、§11.2 |
| F-8 | 版型 C 學習導向：iPad 橫向左方塊＋右學習面板（「操作」「示範」分頁）；手機直向面板為方塊下方抽屜 | §11.1 |

### 0.2 v0.1 不做

| # | 不做 | 出處 |
|---|---|---|
| N-1 | 限步挑戰 M2、互動式逐段教學 M4（示範以外的部分，例：讓玩家自己照著做、系統逐段檢查）、每日挑戰 M5、群論小教室 M6（含知識卡）。註：G3.5 新增的記號小教室（§11.3）與層先法分段暫停卡片（§9.1）屬 F-4／F-6，不屬於此項 | decision-log G0 v0.1 範圍、G2 看電腦解範圍 |
| N-2 | 2D 展開圖 | decision-log G2 |
| N-3 | 手動暫停鍵 | decision-log G2 |
| N-4 | 「最少步」「最佳解」字樣與真正最少步搜尋（`solveOptimalQTM`） | CLAUDE.md §1；spike §5.5 標為需製作人決定，v0.1 不做 |
| N-5 | 手動塗色輸入方塊、相機掃描 | 不在拍板範圍 |
| N-6 | 寬轉記號（r、Rw 等）、自訂配色 | 範圍控制 |
| N-7 | 存局面（重新整理頁面後接續上一局）；只存最佳紀錄與「看過教學」旗標（面標籤開關、中層摺疊、抽屜展開狀態都不存，§11） | 範圍控制 |
| N-8 | 連線、帳號、排行榜、音效 | CLAUDE.md §1 |
| N-9 | 任何「Rubik's」字樣與官方標誌 | decision-log G0 命名 |
| N-10 | **速解法與進階技巧**：CFOP（Cross／F2L／OLL／PLL）、Roux、ZZ 等速解法，公式大全、手指技巧、盲解；教學範圍**到層先法為止**，目標是讓零基礎的人能學會把方塊復原，不追求速度 | decision-log G3.5 教學目標 |

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
- 給玩家看的白話名稱（中文副標、白話說明、記號小教室）見 §2.4、§11.2、§11.3；中層 M／E／S 的白話名稱為「左右之間的中層」「上下之間的中層」「前後之間的中層」。
- 〔G3.5 修訂時以 `docs/spec/checks/cube-model.js` 補驗，供白話說明使用〕從正面看：`R` 讓前面右排往上、`R′` 往下；`U` 讓前面上排往左；`D` 讓前面下排往右；`L` 讓前面左排往下；`M` 讓前面中排（直）往下；`E` 讓前面中列（橫）往右；`S` 讓上面中列往右；`x` 讓前面轉到上面；`y` 讓前面轉到左邊；`z` 讓上面轉到右邊。
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
| 建議解示範 | `demo.kind = "suggest"` | 按鈕名稱（G3.5 拍板；取代舊稱） |
| 學習面板 | `learnPanel`（UI） | 版型 C 的面板：iPad 右側欄、手機方塊下方抽屜；分頁「操作」「示範」 |
| 記號小教室 | `notationLesson`（UI） | 首次教學中的記號介紹（7 步），可從「記號說明」重開 |
| 面標籤 | `faceLabels`（UI） | 在六個中心貼紙上顯示面代號（U/F/R…）與中文 |
| 白話說明 | `explainMove`（UI）、`describeMove`（engine） | 每個記號的一句中文解釋，例：「R：右層順時針轉 90°，算 1 步」 |
| 分段暫停卡片 | `segmentCard`（UI） | 層先法示範每段結束時的「本段完成／下一段要做」卡片 |

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
- **撤銷會扣回步數、重做會加回**（淨步數；G3.5 拍板採用，§14 第 3 題結案）。整顆旋轉不進 `history`，所以永遠不影響步數。
- 示範中逐步播放的轉動也會進 `history`（`src: "demo"`），所以也會計入本局步數；該局本來就不列紀錄（§6.3）。

### 2.3 提示與示範時的步數顯示

| 場合 | 顯示 | 例 |
|---|---|---|
| 提示 | 記號＋該步步數；來源是建議解時，另顯示「照建議解還要 N 步」；下一行為白話說明（§2.4） | `R2（2 步）· 照建議解還要 24 步`／`R2：右層轉半圈（180°），算 2 步` |
| 提示（來源是層先法，見 §9.6 退回） | 只顯示記號與該步步數，不顯示剩餘步數 | `F′（1 步）` |
| 建議解示範 | 標題顯示總步數；進度顯示「已示範 a／N 步」；記號列每個記號下方標該步步數 | `建議解：共 27 步` |
| 層先法示範 | 標題顯示總步數；分段清單每段顯示本段步數；整顆旋轉的記號標「整顆轉（不計步）」；公式段另顯示公式名稱與白話用途 | `層先法：共 176 步`／`白色十字 · 22 步` |
| 兩種示範的每一步 | 目前（下一個）記號的白話說明（§2.4） | `y：整顆方塊往左轉（跟 U 同方向），不算步數` |

- 「步」一律指 QTM；畫面第一次出現步數時附一句說明（文案鍵 `qtmNote`，§10.1）。
- 建議解的步數**不得**宣稱是「最少」「最短」「最佳」（CLAUDE.md §1）；只允許否定式說明（`texts.demo.notShortest`）。

### 2.4 白話說明（修訂 R-2d）

- 目的：讓不懂記號的玩家，在提示與兩種示範的**每一步**都看得懂「轉哪一層、往哪轉、算幾步」。
- 分工：
  - engine（`src/engine/cube.js`）提供純函數 `describeMove(move) → {move, base, kind, turn, qtm}`：`base` 為字母（`U`…`B`、`M` `E` `S`、`x` `y` `z`），`kind` 為 `outer｜slice｜rotation`，`turn` 為 `cw｜ccw｜half`，`qtm` 等於 `qtmCost(move)`。
  - UI（`src/ui/notation.js`，純函數、不碰 DOM，可在 Node 測試）提供 `explainMove(move, texts, engine) → string`、`keySubLabel(move, texts) → string`、`fillTemplate(template, vars) → string`。步數一律取 `describeMove` 的 `qtm`，UI 不自己算。
  - 文字模板放 `texts.json` 的 `notation.explain`（§10.1）；game-designer 可改文字，不可改鍵與佔位符名稱。
- 模板選擇規則：

| `kind` | `turn` | 模板鍵 | 結果例 |
|---|---|---|---|
| `outer` | `cw` | `quarter`（`{dir}` ＝ `dirCw`） | `R：右層順時針轉 90°，算 1 步` |
| `outer` | `ccw` | `quarter`（`{dir}` ＝ `dirCcw`） | `R′：右層逆時針轉 90°，算 1 步` |
| `outer` | `half` | `half` | `R2：右層轉半圈（180°），算 2 步` |
| `slice` | `cw` | `sliceQuarter`（`{ref}` ＝ `sliceRef[base]`） | `M：左右之間的中層照 L 的方向轉 90°，算 2 步` |
| `slice` | `ccw` | `sliceQuarter`（`{ref}` ＝ `sliceRef[base]` ＋ `′`） | `M′：左右之間的中層照 L′ 的方向轉 90°，算 2 步` |
| `slice` | `half` | `half` | `M2：左右之間的中層轉半圈（180°），算 4 步` |
| `rotation` | 任一 | `rotation`（`{name}` ＝ `rotationName[move]`） | `x：整顆方塊往上翻（跟 R 同方向），不算步數` |

- 佔位符：`{move}`（顯示用字串，`′`）、`{layer}`（`layerName[base]`）、`{dir}`、`{ref}`、`{qtm}`、`{name}`。
- 「順時針」一律指**正對那一面看**；說明中不另加「從正面看往哪裡」，那部分由記號小教室（§11.3）與層高亮負責。
- 顯示位置：提示浮層（記號下方一行）、示範面板（記號列上方一行，內容隨 `demo.cursor` 更新為「下一個要做的記號」；播到結尾時不顯示）、記號小教室每一步（示範轉動的那個記號）。

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
  "specVersion": "0.1.1",
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
| `specVersion` | string | `"0.1.1"` | 規格版本（G3.5 修訂後） |
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

- G3.5 新增的 UI 狀態（學習面板分頁、抽屜展開、中層摺疊、面標籤開關、教學進度、分段暫停卡片）**都不進 engine state**，留在各 UI 模組內（§11；分派單 X-3）。

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
| `ROTATE` | `{move}` | `move` 為整顆旋轉；`demo === null`；`hint` 不是 pending（`hintPending`；S11 m-4） | `orient = orientAfter(orient, move)`；其他不變（`hint` 保留，因為存的是 home 記號） |
| `SET_ORIENT` | `{orient}` | 0–23 的整數；`demo === null`；`hint` 不是 pending（`hintPending`；S11 m-4） | `orient = orient`（拖曳視角放開後吸附用，§9.3；G3.5 拍板採用） |
| `UNDO` | `{at}` | `cursor > 0`；`status !== "solved"`；`demo === null`；`hint` 不是 pending | `cursor -= 1`；`home` 套用 `inverse(history[cursor].m)`；`version += 1`；`hint = null`；`playing` 時計時恢復 |
| `REDO` | `{at}` | `cursor < history.length`；其餘同 UNDO | `home` 套用 `history[cursor].m`；`cursor += 1`；`version += 1`；`hint = null`；`playing` 時計時恢復；完成判定 |
| `RESET` | `{at}` | 無 | `home = start`；`history = []`、`cursor = 0`；`status = seed === null ? "free" : "playing"`；`timer` 歸零為 idle；`hint = demo = result = null`；**`assist` 保留**（同一個打亂已看過的提示／示範仍算數）；`version += 1`；`orient` 不變 |
| `PAUSE` | `{at, reason}` | `reason` 為 `"hidden"`（分頁隱藏）或 `"lesson"`（打開記號小教室，§11.3；G3.5 新增）；其他值拒絕（`badReason`） | 若計時中：暫停（§6.2）；否則不變（不拒絕）；不改 `assist`、`hint`、`demo` |
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
- 等提示期間（`hint.pending`）`ROTATE`／`SET_ORIENT` 同樣被拒絕（`hintPending`），所以 `HINT_READY` 以 `hint.orient` 換算時，`orient` 必定仍等於請求當下的值（D-12 的結構性保證；S11 架構審查 m-4）。提示顯示後（`hint.pending === false`）照常可以轉視角。
- 求解結果是非同步的；任何讓 `home` 改變的 action 都會讓 `version` 前進，使過期結果被拒絕（`stale`），UI 收到拒絕就丟棄該結果。
- S11 新增的拒絕原因（D-29）：`NEW_GAME` 缺資料 → `missingData`；`DEMO_READY` 記號不合法 → `invalidTokens`、分段不合法 → `invalidSegments`；記號格式錯誤一律 REJECT（m-1）。UI 不得依拒絕字串分支（D-6）。
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
| 打開記號小教室（「記號說明」或首次教學，UI 送 `PAUSE {reason:"lesson"}`） | `running → paused`（不算使用提示，不影響紀錄資格） |
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
- 完成畫面另顯示本機最佳紀錄（`texts.hud.best`；D-24、D-29）：只要有紀錄就顯示（有輔助的局不更新紀錄），儲存不可用時不顯示；遮罩提供「看看方塊」關閉鈕（m-6）。
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

版型：G3.5 拍板 **C 學習導向**（`docs/ui/decision-log.md`；版面規則見 §11.1）。本節規定行為與必須呈現的資訊；示範相關畫面都放在學習面板的「示範」分頁。

### 9.1 示範播放器

| 項目 | 規格 |
|---|---|
| 進入 | 操作列的「看電腦解」只切到「示範」分頁（手機同時展開抽屜），不送 action；分頁內有「建議解示範」「層先法示範」兩顆按鈕 → `DEMO_REQUEST` → 等結果 → `DEMO_READY`；等待中顯示 §9.4 狀態。尚未開始示範時，分頁顯示兩顆按鈕與一句說明（`texts.demo.pickPrompt`） |
| 切換種類 | 示範中兩顆種類按鈕仍可見，目前種類為選取狀態；按另一種 → UI 依序送 `DEMO_EXIT`、`DEMO_REQUEST {kind}`（從目前進度重新求解）；`canApply` 為 false 時（例：已復原）按鈕不可按 |
| 播放／暫停 | UI 自己的計時器，每 `speeds[i].stepMs` 送一次 `DEMO_STEP {delta:+1}`；到結尾自動停 |
| 單步前後 | `DEMO_STEP {delta:±1}`；播放中按單步會先暫停 |
| 跳到某段（層先法） | 點分段清單 → `DEMO_SEEK {cursor: segment.start}` |
| 速度 | 3 檔：慢 900 ms、中 500 ms、快 250 ms（每個記號）〔預設值，待 G5 調整：`params.demo.speeds`〕；預設「中」；轉動動畫時間 ＝ `stepMs × 0.8` |
| 離開 | 「離開示範」→ `DEMO_EXIT`；方塊停在目前進度，玩家可自己接著轉 |
| 記號高亮 | 記號列顯示全部 `tokens`；已完成的變淡、下一個（`cursor`）加框高亮；列可捲動並自動捲到下一個 |
| 白話說明（修訂 R-2d） | 記號列上方一行顯示「下一個記號」的白話說明（§2.4），隨 `cursor` 更新；播到結尾不顯示 |
| 層高亮 | 播放前以 `demoNextLayer` 高亮下一個記號要轉的那一層（半透明描邊或提亮），轉完取消；整顆旋轉時顯示「整顆轉（不計步）」字樣 |
| 分段進度（層先法） | 8 段清單：已完成（打勾）、進行中（高亮，顯示名稱＋一句說明＋本段步數）、未開始；`start === end` 的段（本來就完成）顯示打勾與「已完成，略過」（`texts.demo.segmentSkipped`）；目前 part 為公式時顯示「公式名稱：記號」，下一行顯示該公式的白話用途（`lbl.json` 的 `desc`，文案鍵 `texts.demo.formulaUse`） |
| 分段暫停卡片（層先法，修訂 R-2e） | `params.demo.pauseAtSegmentEnd` 為 true 時：播放或「下一步」使 `demo.cursor` 到達某段的 `end`，且該段非空、後面還有非空段 → 停止自動播放，在示範分頁顯示卡片「本段完成：{done}；下一段要做：{next}」（`texts.demo.segmentDone`；`{done}`＝本段名稱，`{next}`＝下一個非空段的名稱＋一句說明）與「繼續」按鈕。按「繼續」→ 卡片消失並開始自動播放；卡片顯示中按「下一步」→ 卡片消失並單步；按「上一步」、點分段清單、離開示範 → 卡片消失。`DEMO_SEEK` 與「上一步」不觸發卡片。最後一個非空段結束＝方塊復原，改顯示完成畫面，不出現卡片。卡片是 UI 狀態，不送 action、不改 `demo` |
| 步數 | 依 §2.3 |
| 結尾 | 方塊復原：顯示完成畫面（§6.3 的「示範」版本），仍可前後單步回看 |

層先法總長約 95–236 QTM（§8.5），以「中」速約 1–2 分鐘（推論：記號數 × 0.5 秒），另加玩家在分段卡片停留的時間（最多 7 次暫停）。

- 教學範圍（修訂 R-2e）：示範只教到層先法（8 段、11 個公式）；不提供 CFOP 等速解法（§0.2 N-10）。

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
  - 理由：記號永遠對應畫面——`U` 一定是畫面上方那一面、`F` 一定是正面、`R` 一定是右面，提示與示範的記號才看得懂。（**G3.5 拍板採用**，§14 第 2 題結案。）
  - 吸附動畫：放開後以 `params.ui.snapAnimMs` 轉到最近的正朝向，動畫結束才送 `SET_ORIENT`；動畫中不接受新手勢。
  - 面標籤（§11.2）跟著吸附後的朝向更新，確保「上面就叫 U」。
- 基準視角：畫面上看得到 U、F、R 三面（斜上方俯視）；角度取 v1-C 靜態稿的值 `params.ui.baseViewDeg`（x −22°、y −34°）〔取自 `docs/ui/v1-C.html`，待 G5 調整〕。
- 記號鍵的 `x`、`y`、`z` 系列按鈕 → `ROTATE {move}`（鍵盤分組見 §11.2）。
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
- 等待卡片（v1-C 的 `solving-card`）顯示在方塊區中央，可以蓋住方塊（等待中本來就不能轉）；「記號說明」在等待中不可按（§11.3）。
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
    "hint": "提示", "demoOpen": "看電腦解", "demoSuggest": "建議解示範", "demoLbl": "層先法示範", "play": "播放", "pause": "暫停",
    "stepForward": "下一步", "stepBack": "上一步", "exitDemo": "離開示範", "cancel": "取消",
    "speedSlow": "慢", "speedMid": "中", "speedFast": "快", "tryLbl": "改看層先法示範",
    "continue": "繼續", "notationHelp": "記號說明", "faceLabels": "面標籤", "sliceFold": "中層（進階）",
    "tutPrev": "上一步", "tutNext": "下一步", "tutDone": "開始玩", "tutSkip": "跳過教學",
    "lessonSkip": "略過這段", "lessonReplay": "再看一次", "lessonClose": "關閉",
    "viewCube": "看看方塊" },
  "panel": { "title": "學習面板", "tabControls": "操作", "tabDemo": "示範" },
  "keypad": { "outer": "外層（U D L R F B）", "rotation": "整顆轉（x y z，不算步數）", "slice": "中層（M E S）" },
  "scramble": { "notOfficial": "非 WCA 官方打亂", "label": "打亂：{alg}" },
  "hud": { "time": "時間", "moves": "步數", "best": "最佳", "qtmNote": "步數以 QTM 計：90° 算 1 步、180° 算 2 步，中層加倍，整顆轉不算。" },
  "hint": { "prompt": "卡住了嗎？按一下「提示」，看下一步該怎麼轉。", "only": "提示只會告訴你下一步，剩下的還是靠你自己轉喔。", "next": "下一步：{move}",
    "move": "{move}（{qtm} 步）", "plan": "照建議解還要 {n} 步", "solving": "準備提示中，請稍等一下。" },
  "demo": { "suggestTitle": "建議解：共 {n} 步", "lblTitle": "層先法：共 {n} 步", "progress": "已示範 {a}／{n} 步",
    "rotateLabel": "整顆轉（不計步）", "segmentSteps": "{n} 步", "formula": "{name}：{alg}",
    "solving": "正在整理建議解，請稍候⋯", "suggestUnavailable": "這次沒算出建議解，可以改看層先法示範。",
    "notShortest": "建議解是電腦找到的一種解法，步數不一定是最少的。",
    "pickPrompt": "選一種示範：建議解步數較少但不好懂；層先法步數多，但每一段都有說明，適合初學。",
    "formulaUse": "用途：{desc}", "segmentSkipped": "已完成，略過",
    "segmentDone": "本段完成：{done}；下一段要做：{next}", "segmentNext": "{name}（{desc}）" },
  "result": { "solved": "太棒了！方塊復原了！", "summary": "完成！這局用了 {time}、{qtm} 步。",
    "newRecord": "新紀錄", "badgeHint": "有提示", "badgeDemo": "示範", "demoNote": "看過示範的這局不列入紀錄。",
    "best": "{label}：時間 {time}、步數 {qtm} 步" },
  "confirm": { "newGameInProgress": "再來一局？目前這一局還沒完成，會直接重新打亂。" },
  "free": { "solvedHint": "轉回原狀了。按「打亂」開始一局。" },
  "solver": { "preparing": "準備提示中，請稍等一下。", "mainThreadNotice": "這台裝置要在前景準備提示，畫面可能會停頓一下。",
    "failed": "建議解暫時無法使用，提示會改用層先法。" },
  "error": { "invalidState": "方塊狀態有誤，請按「重設」。", "generic": "出了點問題，請再試一次。" },
  "tutorial": [
    "用手指劃過方塊的一面，就能轉動那一層。試試看！",
    "劃在方塊外側的空白處，可以轉動整顆方塊，看看其他面。",
    "不想用手勢也沒關係，學習面板的「操作」分頁有 U D L R F B 等按鈕，每顆下面都有中文；忘了記號的意思，隨時按「記號說明」。",
    "準備好了嗎？按「打亂」，開始你的第一局。",
    "轉不出來的時候，隨時可以按「提示」看下一步。"
  ],
  "notation": {
    "lessonTitle": "記號小教室",
    "lessonProgress": "記號小教室 {k}／{n}",
    "tutorialProgress": "第 {k}／{n} 步",
    "faceName": { "U": "上", "D": "下", "L": "左", "R": "右", "F": "前", "B": "後",
      "M": "左右間", "E": "上下間", "S": "前後間" },
    "keySub": { "cw": "{face}", "ccw": "{face}・逆", "half": "{face}・半圈" },
    "rotationSub": { "x": "整顆上翻", "x'": "整顆下翻", "x2": "上下翻半圈",
      "y": "整顆左轉", "y'": "整顆右轉", "y2": "左右轉半圈",
      "z": "整顆右倒", "z'": "整顆左倒", "z2": "側倒半圈" },
    "explain": {
      "quarter": "{move}：{layer}{dir}轉 90°，算 {qtm} 步",
      "half": "{move}：{layer}轉半圈（180°），算 {qtm} 步",
      "sliceQuarter": "{move}：{layer}照 {ref} 的方向轉 90°，算 {qtm} 步",
      "rotation": "{move}：{name}，不算步數",
      "dirCw": "順時針", "dirCcw": "逆時針",
      "layerName": { "U": "上層", "D": "下層", "L": "左層", "R": "右層", "F": "前層", "B": "後層",
        "M": "左右之間的中層", "E": "上下之間的中層", "S": "前後之間的中層" },
      "sliceRef": { "M": "L", "E": "D", "S": "F" },
      "rotationName": {
        "x": "整顆方塊往上翻（跟 R 同方向）", "x'": "整顆方塊往下翻（跟 R′ 同方向）", "x2": "整顆方塊上下翻半圈",
        "y": "整顆方塊往左轉（跟 U 同方向）", "y'": "整顆方塊往右轉（跟 U′ 同方向）", "y2": "整顆方塊左右轉半圈",
        "z": "整顆方塊往右倒（跟 F 同方向）", "z'": "整顆方塊往左倒（跟 F′ 同方向）", "z2": "整顆方塊側倒半圈" }
    },
    "lesson": [
      { "id": "faces", "title": "六個面的代號",
        "body": "方塊的六個面各有一個英文代號：U 上、D 下、L 左、R 右、F 前（正對你的那一面）、B 後。代號是依「你現在看到的方塊」來叫：整顆轉過之後，朝上的那一面就叫 U。中心貼紙上的字母就是代號。" },
      { "id": "clockwise", "title": "順時針怎麼看",
        "body": "只寫一個字母，就是把那一層轉 90°，方向是「正對那一面看的順時針」。R 要正對右面看：從正面看起來，右邊那一排會往上走。" },
      { "id": "prime", "title": "′ 是逆時針",
        "body": "字母右上角有一撇 ′，就是反過來轉（逆時針）。R′ 從正面看，右邊那一排會往下走。" },
      { "id": "double", "title": "2 是轉半圈",
        "body": "字母後面有 2，就是同一層轉 180°（等於轉兩次 90°），往哪邊轉結果都一樣。" },
      { "id": "slice", "title": "外層和中層",
        "body": "U D L R F B 轉的都是最外面那一層，叫外層。夾在中間的叫中層：M 是左右之間的中層，方向跟 L 一樣；E 是上下之間的中層，方向跟 D 一樣；S 是前後之間的中層，方向跟 F 一樣。中層鍵平常收在「中層（進階）」摺疊區，初學用不到。" },
      { "id": "rotation", "title": "整顆轉 x y z",
        "body": "小寫的 x、y、z 是把整顆方塊換個角度拿，不會打亂方塊：x 跟 R 同方向、y 跟 U 同方向、z 跟 F 同方向。層先法示範會用它們先把方塊拿好。" },
      { "id": "qtm", "title": "步數怎麼算",
        "body": "這裡用 QTM 算步數：外層轉 90° 算 1 步、轉半圈算 2 步；中層轉 90° 算 2 步、半圈算 4 步；整顆轉和拖曳換視角都不算。撤銷會把步數扣回來。" }
    ]
  },
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

- 文案來源：按鈕、提示語、完成語、等待語、教學為 `game-design.md` §6 原文或其延伸；`demoSuggest`「建議解示範」為 G3.5 拍板名稱（§14 第 1 題結案）。`tutorial` 第 3 句因版型 C 改寫（按鈕不在「下方」而在學習面板）；`notation` 全部與 `demo.pickPrompt`、`demo.segmentDone` 等為 G3.5 新增初稿（systems-engineer 擬），game-designer 可潤飾文字，不可改鍵、`lesson` 的 `id` 與順序、模板中的佔位符名稱。
- `notation.lesson` 的 `id` 順序必須與 `params.tutorial.notationSteps` 相同（`T-DATA-06`）；每一步實際示範哪個記號由 params 決定，不寫在文案裡。
- `notation.faceName` 用於記號鍵副標（§11.2）與面標籤（§11.2）；`notation.explain` 用於白話說明（§2.4）。
- 等待文案不得承諾秒數（`game-design.md` §11）。
- 禁用字：`Rubik`、`最佳解`、`最少步`、`最短`（`T-UI-14` 掃描畫面文字、`T-DATA-09` 掃描 `texts.json`；G3.5 已拍板改名「建議解示範」，禁用字清單**維持含「最短」**）。

### 10.2 `palette.json`（配色；ui-designer 可調色值，不可改色號順序）

```json
{
  "stickers": [
    { "id": 0, "name": "白", "hex": "#FFFFFF", "labelInk": "#111111" },
    { "id": 1, "name": "紅", "hex": "#C41E3A", "labelInk": "#FFFFFF" },
    { "id": 2, "name": "綠", "hex": "#009E60", "labelInk": "#FFFFFF" },
    { "id": 3, "name": "黃", "hex": "#FFD500", "labelInk": "#111111" },
    { "id": 4, "name": "橙", "hex": "#FF5800", "labelInk": "#111111" },
    { "id": 5, "name": "藍", "hex": "#0051BA", "labelInk": "#FFFFFF" }
  ],
  "body": "#111111",
  "highlight": "#FFFFFF"
}
```

- 色號順序＝開局所在面 `U R F D L B`；白對黃、紅對橙、綠對藍、白上綠前時紅在右（西方配色，業界慣例，`game-design.md` §4）。
- 色值為初稿〔預設值，待 G5 調整〕；需確保色弱玩家可分辨紅橙（UNKNOWN，G5 檢查）。
- `labelInk`（G3.5 新增）：面標籤（§11.2）在該顏色貼紙上的文字顏色〔預設值，待 G5 檢查對比〕。

### 10.3 `params.json`（數值參數；全部〔預設值，待 G5 調整〕，除非另註）

```json
{
  "scramble": { "length": 25 },
  "solver": { "metric": "qtm", "nodeLimit": 3000000, "firstNodeLimit": 30000000, "maxLength": 45, "phase2Cap": 20,
    "initTimeoutMs": 20000, "solveTimeoutMs": 10000, "planCacheSize": 64 },
  "demo": { "speeds": [ { "id": "slow", "stepMs": 900 }, { "id": "mid", "stepMs": 500 }, { "id": "fast", "stepMs": 250 } ],
    "defaultSpeed": "mid", "animRatio": 0.8, "pauseAtSegmentEnd": true },
  "gesture": { "lockPx": 10, "commitPx": 30, "maxAxisAngleDeg": 30, "cameraDegPerPx": 0.5, "pitchLimitDeg": 80 },
  "ui": { "turnAnimMs": 180, "scrambleAnimMsPerMove": 60, "timerRefreshMs": 100, "minTouchPx": 44,
    "snapAnimMs": 200, "baseViewDeg": { "x": -22, "y": -34 }, "hintErrorShowMs": 4000, "demoErrorShowMs": 6000 },
  "input": { "queueMax": 3, "queuePollMs": 16 },
  "debug": { "rejectLogSize": 50, "logRejectToConsole": false },
  "layout": { "drawerExpandedDefault": true },
  "keypad": { "sliceCollapsedDefault": true, "rotationCollapsedDefault": false, "showSubLabels": true },
  "faceLabels": { "defaultOn": false, "forceOnInTutorial": true },
  "tutorial": {
    "enabled": true,
    "notationBeforeIndex": 2,
    "notationSteps": [
      { "id": "faces", "demo": "U" },
      { "id": "clockwise", "demo": "R" },
      { "id": "prime", "demo": "R'" },
      { "id": "double", "demo": "U2" },
      { "id": "slice", "demo": "M" },
      { "id": "rotation", "demo": "x" },
      { "id": "qtm", "demo": "R2" }
    ],
    "demoTurnMs": 600, "demoHoldMs": 700
  },
  "storage": { "recordsKey": "cube3x3.records.v1", "tutorialKey": "cube3x3.tutorial.v1" }
}
```

- `nodeLimit`、`firstNodeLimit` 有實測依據（§7.4）；`maxLength`、`phase2Cap` 沿用 spike；`minTouchPx` 為 CLAUDE.md §3.4 規定值。
- G3.5 新增欄位：

| 欄位 | 意義 | 預設 | 來源 |
|---|---|---|---|
| `ui.snapAnimMs` | 拖曳放開後吸附動畫時間（§9.3） | 200 | 〔預設值，待 G5〕 |
| `ui.baseViewDeg` | 基準視角（§9.3） | x −22、y −34 | v1-C 靜態稿 |
| `demo.pauseAtSegmentEnd` | 層先法每段結束自動暫停並顯示卡片（§9.1） | true | 修訂 R-2e |
| `layout.drawerExpandedDefault` | 手機抽屜開頁時是否展開（§11.1） | true | v1-C 靜態稿 |
| `keypad.sliceCollapsedDefault` | 中層鍵開頁時收合（§11.2） | true | 修訂 R-2b |
| `keypad.rotationCollapsedDefault` | 整顆轉鍵開頁時收合（§11.2） | false | 本規格決定（理由見 §11.2） |
| `keypad.showSubLabels` | 記號鍵顯示中文副標 | true | 修訂 R-2b |
| `faceLabels.defaultOn` | 教學以外的面標籤預設 | false | 〔預設值，待 G5 觀察；§14 第 4 題〕 |
| `faceLabels.forceOnInTutorial` | 教學與記號小教室期間強制顯示面標籤 | true | 修訂 R-2c |
| `tutorial.enabled` | 是否在首次開啟時顯示教學（測試可覆寫） | true | — |
| `tutorial.notationBeforeIndex` | 記號小教室插在 `texts.tutorial[i]` 之前（0 起算；2 ＝ 第 2 句「轉視角」之後、第 3 句「記號按鈕」之前） | 2 | §11.3 |
| `tutorial.notationSteps` | 小教室各步的 `id` 與示範記號（程式內部寫法） | 7 步 | §11.3 |
| `tutorial.demoTurnMs`、`demoHoldMs` | 小教室示範轉動的動畫時間、轉完停留時間 | 600、700 | 〔預設值，待 G5〕 |

- S11（架構審查 MJ-1、D-25、D-26、n-4）新增欄位：

| 欄位 | 意義 | 預設 | 來源 |
|---|---|---|---|
| `ui.hintErrorShowMs` | 提示失敗訊息的顯示時間（原寫死在 `hint-view.js`） | 4000 | D-25〔預設值，待 G5〕 |
| `ui.demoErrorShowMs` | 示範失敗訊息（含「改看層先法示範」）的顯示時間（原寫死在 `demo-player.js`） | 6000 | D-25〔預設值，待 G5〕 |
| `input.queueMax` | 動畫進行中可排隊的輸入數（不含正在播放的那一個；超過的輸入丟棄） | 3 | D-26 |
| `input.queuePollMs` | 其他動畫（吸附、示範自動播放）進行中時，輸入佇列每隔多久再試一次 | 16 | D-26〔預設值，待 G5〕 |
| `debug.rejectLogSize` | 被 `REJECT` 的 action 保留在除錯記錄中的筆數（0＝不記錄） | 50 | 架構審查 n-4 |
| `debug.logRejectToConsole` | 是否把 `REJECT` 輸出到 `console.debug`（測試時也可用網址 `?test=1&debug=1` 開啟） | false | 架構審查 n-4 |

- 數值欄位的預設值只在「鍵缺少」時套用；資料檔填 0 是有效值（例：`ui.turnAnimMs: 0`、`ui.scrambleAnimMsPerMove: 0` 表示關閉該動畫）（D-25）。`keypad.showSubLabels` 為 false 時記號鍵不顯示中文副標（`aria-label` 仍含副標）；`faceLabels.forceOnInTutorial` 為 false 時教學與記號小教室期間不強制開啟面標籤（D-25）。
- S11 新增文案鍵（§10.1）：`buttons.viewCube`（完成畫面關閉遮罩、查看方塊；架構審查 m-6）、`result.best`（完成畫面的本機最佳紀錄，`{label}` 填 `hud.best`，`{time}` 為最佳時間、`{qtm}` 為最佳步數；D-24，儲存不可用或沒有紀錄時整行不顯示）、`confirm.newGameInProgress`（對局中按「再來一局」的確認文字，原寫死在 `controls.js`）。
- 這些欄位只影響 UI 呈現，不影響 engine 規則與求解結果；engine 仍只讀 `params.scramble`。

### 10.4 `lbl.json`（層先法設定；改公式必須重跑 `T-LBL-*`）

```json
{
  "firstLayerColor": 0,
  "segments": ["hold", "cross", "corners", "middle", "yellowCross", "yellowFace", "yellowCorners", "yellowEdges"],
  "formulas": {
    "crossDown":    { "alg": "F2",                            "name": "白邊翻上來",
                      "desc": "白色邊塊已經在正下方對好位置，前層轉半圈就把它送到上面。" },
    "crossFlip":    { "alg": "D R F' R'",                     "name": "白邊翻正",
                      "desc": "白色邊塊在下層但白色朝前時用，把它翻正再送上去。" },
    "cornerDrop":   { "alg": "R' D' R",                       "name": "角塊拿下來",
                      "desc": "把放錯位置或方向的白色角塊先拿到下層，等一下再重新放。" },
    "cornerInsert": { "alg": "R' D' R D",                     "name": "角塊放上去",
                      "desc": "白色角塊在右前下方時，重複做幾次，它就會轉進右前上方的正確位置。" },
    "edgeRight":    { "alg": "U R U' R' U' F' U F",           "name": "中層邊放右邊",
                      "desc": "把上層前面的邊塊放進右前方的中層位置。" },
    "edgeLeft":     { "alg": "U' L' U L U F U' F'",           "name": "中層邊放左邊",
                      "desc": "把上層前面的邊塊放進左前方的中層位置。" },
    "edgeKickOut":  { "alg": "U R U' R' U' F' U F",           "name": "把卡住的邊塊換出來",
                      "desc": "中層有邊塊放錯時，先把它換到上層，之後再放回正確位置。" },
    "yellowCross":  { "alg": "F R U R' U' F'",                "name": "黃十字公式",
                      "desc": "做一到三次，頂面就會出現黃色十字。" },
    "sune":         { "alg": "R U R' U R U2 R'",              "name": "小魚公式",
                      "desc": "把頂面角塊的黃色轉到上面，重複到整個頂面都是黃色。" },
    "aPerm":        { "alg": "R' F R' B2 R F' R' B2 R2",      "name": "換角公式",
                      "desc": "左前上方的角塊不動，其他三個頂角輪流換位置。" },
    "uPerm":        { "alg": "R2 U R U R' U' R' U' R' U R'",  "name": "換邊公式",
                      "desc": "後面的頂邊不動，其他三個頂邊輪流換位置。" }
  },
  "headlightFace": "B",
  "guards": { "cross": 8, "corners": 12, "cornerInsert": 5, "middle": 16, "yellowCross": 3, "sune": 6, "aPerm": 3, "uPerm": 3 }
}
```

- 公式與規則是綁在一起的（例：`aPerm` 必須配 `headlightFace: "B"`），不是任意可換的平衡數值；放在資料檔是為了讓 UI 顯示名稱與記號、並讓測試對帳。
- `desc`（G3.5 新增，修訂 R-2e）：一句白話用途，示範中與公式名稱一起顯示（§9.1）；屬文案欄位，game-designer 可潤飾，產生器不讀。
- `guards` 為迴圈上限；`cornerInsert`、`sune`、`aPerm`、`uPerm` 取 G3 實測最大值（5、3、2、3）再留餘裕（`sune` 6、`aPerm` 3）。

---

## 11. 其他 UI 規則

### 11.1 版型 C：學習導向（修訂 R-1）

依據：decision-log G3.5「UI 版型：C 學習導向」、`docs/ui/decision-log.md`、`docs/ui/v1-C.html`（位置、大小、配色以該稿為準；行為以本規格為準，分派單 X-15）。

| 區塊 | iPad 橫向（1194×834） | 手機直向（390×844） |
|---|---|---|
| 整體 | 左右兩欄：左欄約 60% 寬、右欄（學習面板）約 40% 寬，中間一條分隔線 | 單欄由上到下：狀態列 → 操作列 → 方塊區 → 學習面板抽屜 |
| 狀態列 | 左欄頂端：計時、QTM 步數、「有提示」徽章 | 最上方，同左 |
| 方塊區 | 左欄中間，占滿剩餘高度 | 占滿「抽屜以外」的剩餘高度 |
| 操作列 | 左欄底部：打亂、撤銷、重做、重設、提示、看電腦解 | 狀態列下方，同一組按鈕（可換行） |
| 學習面板 | 右欄全高，常駐顯示，沒有抽屜手把 | 方塊區下方的抽屜 |
| 面板頂列 | 「記號說明」按鈕、「面標籤」開關 | 抽屜手把列：「學習面板」字樣、目前分頁名稱、「記號說明」按鈕（收合時也看得到）；「面標籤」開關在分頁列右側 |
| 分頁 | 「操作」「示範」兩個分頁 | 同左 |
| 「操作」分頁 | 記號鍵盤（§11.2） | 同左，內容超出時面板內捲動 |
| 「示範」分頁 | 示範種類按鈕、示範播放器、分段清單、分段暫停卡片（§9.1） | 同左 |

規則：
- **版面切換**：以 CSS `@media (orientation: landscape)` 判斷，橫向用左右兩欄、直向用抽屜；PC 瀏覽器橫向視同 iPad。這是版面規則，不是平衡數值，可以寫在 `styles.css`。
- **抽屜是一般文件流**（`docs/ui/decision-log.md` 備註 3）：不得用 `position: absolute／fixed` 蓋在方塊上；展開時抽屜變高、方塊區隨之變矮（flex 壓縮），兩者的 boundingBox 不得重疊。展開時抽屜高度上限約為畫面 52%（v1-C 值）；收合時只剩手把列。開頁時是否展開：`params.layout.drawerExpandedDefault`。
- 抽屜手把列整列可點（≥ 44 px 高），點一下切換展開／收合；「記號說明」按鈕在手把列內，點它不會切換抽屜。
- **自動切換**：
  - 按操作列「看電腦解」、或 `DEMO_REQUEST` 被送出 → 切到「示範」分頁；手機同時展開抽屜。
  - `DEMO_EXIT` → 切回「操作」分頁。
  - 打開記號小教室（§11.3）→ 手機強制展開抽屜；小教室卡片顯示在學習面板內（取代分頁內容），關閉後回到原分頁。
- 分頁、抽屜、摺疊、面標籤都是 UI 狀態，不進 engine state、不寫入儲存（§0.2 N-7）。
- v1-C 靜態稿與本規格的差異（實作以本規格為準）：
  1. 稿中示範種類按鈕的舊名（`data-demo="shortest"`）→「建議解示範」（`suggest`）；「第 3／7 段」→ 8 段（§8.3）。
  2. 稿中分頁鈕 `.ctab`／`.dtab` 高 40 px、速度鈕 `.spd` 高 36 px、抽屜手把 30 px，**都要改成 ≥ 44 px**（CLAUDE.md §3.4、`T-UI-03`）。
  3. 稿的記號鍵盤沒有整顆轉 x y z 鍵，也沒有中文副標與摺疊；依 §11.2 補上。
  4. 稿的教學卡片置中並有遮罩；本規格的教學與記號小教室卡片放在學習面板內、不蓋方塊（§11.3），「求解中」與「完成」卡片可沿用置中遮罩。
  5. 稿以 `hidden` 屬性控制顯示，須有 `[hidden]{display:none!important}`；同頁不得有重複 `id`（稿中手機與 iPad 兩份 DOM 的 `id` 重複，是靜態稿的預覽寫法，產品只有一份 DOM）。

### 11.2 記號鍵盤、中文副標、面標籤（修訂 R-2b、R-2c）

- 36 個記號都要能用按鈕完成（外層 18、中層 9、整顆 9；CLAUDE.md §1 備援、§3.4 不依賴手勢）；按鈕即 view 座標記號；每顆 ≥ 44×44 px。
- 分成三組，順序固定：

| 組 | 標題（`texts.keypad`） | 內容 | 開頁時 |
|---|---|---|---|
| 1 | 外層（U D L R F B） | 3 列 × 6 顆：`X`、`X′`、`X2` | 展開（不可收合） |
| 2 | 整顆轉（x y z，不算步數） | 3 列 × 3 顆：`x y z`、`x′ y′ z′`、`x2 y2 z2`；外觀與外層鍵不同（淺灰底、虛線框），明示不計步 | 展開（`params.keypad.rotationCollapsedDefault` ＝ false；可收合） |
| 3 | 中層（M E S） | 3 列 × 3 顆（v1-C 的藍色中層樣式） | **收合**（`params.keypad.sliceCollapsedDefault` ＝ true）；以一顆「中層（進階）」摺疊鈕（`aria-expanded`）展開／收合 |

- **整顆轉 x y z 的呈現方式（本規格決定）**：放在外層之後、中層之前，預設展開。理由：
  1. 沒有這組鍵，就只能用拖曳手勢看方塊的背面與底面，違反「不依賴手勢才能完成操作」（CLAUDE.md §3.4）。
  2. 層先法示範的記號列會出現 x／y／z（§8.1），初學者需要常看到它們；記號小教室也有一步專門介紹（§11.3）。
  3. 整顆轉不計步、不進撤銷紀錄、不會把方塊轉亂，初學者按錯也沒有代價；中層則會計 2 步且會移動中心塊，才需要收起來。
  4. 手機直向放不下時，面板內捲動即可（外層在最上面，最常用的鍵不用捲）。
- 摺疊狀態只存在記憶體；重新整理回到預設。提示與建議解只會出現外層記號、層先法只會出現外層與整顆轉（§7、§8），所以中層收合不會讓玩家照不到提示或示範。
- **中文副標**（`params.keypad.showSubLabels`）：每顆鍵上方為記號（大字，`formatMove`），下方為副標（小字），由 `notation.keySubLabel(move, texts)` 產生：
  - 外層與中層：`keySub.cw／ccw／half` 套上 `faceName[字母]`。
  - 整顆轉：直接取 `rotationSub[move]`。

| 記號 | 副標 | 記號 | 副標 | 記號 | 副標 |
|---|---|---|---|---|---|
| `U` `U′` `U2` | 上／上・逆／上・半圈 | `D` `D′` `D2` | 下／下・逆／下・半圈 | `L` `L′` `L2` | 左／左・逆／左・半圈 |
| `R` `R′` `R2` | 右／右・逆／右・半圈 | `F` `F′` `F2` | 前／前・逆／前・半圈 | `B` `B′` `B2` | 後／後・逆／後・半圈 |
| `M` `M′` `M2` | 左右間／左右間・逆／左右間・半圈 | `E` `E′` `E2` | 上下間／上下間・逆／上下間・半圈 | `S` `S′` `S2` | 前後間／前後間・逆／前後間・半圈 |
| `x` `x′` `x2` | 整顆上翻／整顆下翻／上下翻半圈 | `y` `y′` `y2` | 整顆左轉／整顆右轉／左右轉半圈 | `z` `z′` `z2` | 整顆右倒／整顆左倒／側倒半圈 |

- 鍵的無障礙名稱（`aria-label`）＝記號＋副標（例：「R′ 右・逆」）。
- **面標籤開關**（修訂 R-2c）：
  - 位置見 §11.1；外觀為開關（`role="switch"`、`aria-checked`），連同文字「面標籤」整塊 ≥ 44 px。
  - 開啟時，view 座標的六個中心貼紙（索引 4、13、22、31、40、49）顯示該位置的面代號（大字 `U R F D L B`）與中文（小字 `faceName`）；文字顏色取該貼紙顏色的 `palette.stickers[].labelInk`。
  - 代號**跟著位置、不跟著顏色**：整顆轉或拖曳吸附後重新渲染，朝上的中心永遠標 U。轉動動畫進行中，標籤跟著貼紙一起轉，動畫結束後依新位置重畫。中層轉動後中心顏色改變，標籤仍依位置。
  - 預設：教學與記號小教室期間強制開啟（`params.faceLabels.forceOnInTutorial`），結束後恢復成打開教學前的值；首次開頁、教學結束後的初始值為 `params.faceLabels.defaultOn`（false）。不寫入儲存。
  - 面標籤不影響手勢判定（標籤元素 `pointer-events: none`，命中仍是貼紙）。

### 11.3 首次教學與記號小教室（修訂 R-2a）

- 觸發：`params.tutorial.enabled` 為 true 且 `tutorialKey` 不存在時，頁面第一次畫完後顯示。完成或按「跳過教學」後寫入旗標（寫入失敗不報錯）。
- 流程（共 12 步；T＝`texts.tutorial[i]`，L＝記號小教室）：

```
T0 劃方塊轉層 → T1 劃外側轉視角 → [L1 … L7 記號小教室] → T2 記號按鈕與「記號說明」 → T3 按打亂 → T4 提示
```

（小教室插入位置由 `params.tutorial.notationBeforeIndex` 決定，預設 2。）
- 卡片位置：**學習面板內**（iPad 右欄；手機強制展開抽屜），不蓋住方塊區、不加全畫面遮罩，玩家要能同時看到卡片與方塊示範。
- 卡片內容：進度（T 步顯示 `tutorialProgress`「第 k／12 步」；L 步另顯示 `lessonProgress`「記號小教室 k／7」）、標題（L 步）、內文、白話說明（L 步，§2.4，對象為該步示範記號）、按鈕。
- 按鈕（皆 ≥ 44 px）：「上一步」（第一步不可按）、「下一步」（最後一步改為「開始玩」）、「跳過教學」（任何一步都有，結束整個教學並寫入旗標）；L 步另有「略過這段」（直接跳到小教室之後的第一個 T 步）與「再看一次」（重播本步示範）。
- T 步：與 G3 相同，玩家可以直接在方塊上試（此時 `status` 為 `free`，轉動照常送 `TURN`，不影響任何紀錄）。
- **L 步（記號小教室）**：

| 步 | `id` | 標題（初稿） | 示範記號（`params.tutorial.notationSteps`） | 要讓玩家看懂的事 |
|---|---|---|---|---|
| L1 | `faces` | 六個面的代號 | `U` | U 上、D 下、L 左、R 右、F 前、B 後；以「你目前看到的方塊」為準；面標籤就是代號 |
| L2 | `clockwise` | 順時針怎麼看 | `R` | 順時針＝正對那一面看的順時針；從正面看 R 的右排往上 |
| L3 | `prime` | ′ 是逆時針 | `R'` | `′`＝逆時針；R′ 的右排往下 |
| L4 | `double` | 2 是轉半圈 | `U2` | `2`＝轉 180°，方向不影響結果 |
| L5 | `slice` | 外層和中層 | `M` | 外層＝最外面一層；M 左右之間、方向同 L；E 上下之間、方向同 D；S 前後之間、方向同 F；中層鍵收在「中層（進階）」 |
| L6 | `rotation` | 整顆轉 x y z | `x` | x 同 R、y 同 U、z 同 F；整顆轉不算步數；層先法示範會用到 |
| L7 | `qtm` | 步數怎麼算 | `R2` | 外層 90°＝1、180°＝2；中層 90°＝2、180°＝4；整顆轉與拖曳＝0；撤銷扣回 |

- 每個 L 步的示範（**不改 engine state**）：
  1. 開啟面標籤（強制）、鎖住玩家輸入（`ctx.input.lock`；手勢與記號鍵不作用）。
  2. 以 `engine.layerStickers(記號)` 高亮該層（整顆轉高亮全部 54 格），停 `demoHoldMs`。
  3. 以「目前的 view 貼紙」為底，做預覽動畫轉過去（`demoTurnMs`），停 `demoHoldMs`，再以反向記號轉回來；畫面最後回到原樣。預覽只改畫面，**不送 `TURN`／`ROTATE`**，`home`、`history`、`orient`、步數、`version` 都不變（`T-UI-16`）。
  4. 取消高亮。離開 L 步（下一步、上一步、略過、跳過、關閉）時立刻停止動畫、清除預覽與高亮並解鎖。
- **從「記號說明」重開**（任何時候，除了下列不可按的情況）：
  - 只顯示 L1～L7；按鈕為「上一步」「下一步」（最後一步改為「關閉」）「再看一次」「關閉」；不寫旗標。
  - 打開時：若 `timer.state === "running"`，送 `PAUSE {reason:"lesson"}`（下一個 `TURN`／`UNDO`／`REDO` 才恢復，§6.2）；若示範正在自動播放，示範暫停（示範播放器看到 `ctx.input.locked()` 就停）。
  - 不算使用提示：`assist` 不變，紀錄資格不受影響。
  - 不可按：`hint.pending`、`demo.pending`、打亂動畫或轉動動畫進行中（按鈕 disabled）。
  - 關閉後：面標籤恢復原值、回到原分頁、解鎖輸入。
- 模組：`src/ui/tutorial.js`（教學與小教室）；「記號說明」按鈕也由它渲染到面板頂列的插槽（分派單 S8d）。

### 11.4 其他

- 打亂動畫：`NEW_GAME` 後 UI 以 `scrambleAnimMsPerMove` 逐一播放打亂（純視覺），播放中不接受轉動；畫面顯示打亂記號字串與「非 WCA 官方打亂」。
- 再來一局：局中（`playing` 且 `cursor > 0`）按下需二次確認（UI 自訂）。
- 完成畫面：依 §6.3；顯示時間（`m:ss.s`）與步數；「再來一局」。
- 兩種視圖：手機直向 390×844、iPad 橫向 1194×834（CLAUDE.md §4）。
- UI 不得自行計算規則（步數、復原、合法性、轉哪一層、記號屬於哪一類）——一律呼叫 engine 的 selectors、`gestureToMove`、`layerStickers`、`describeMove`。

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
| T-ENG-17 | 計時：第一個 `TURN` 開始；`ROTATE` 不開始；`PAUSE`（`hidden` 與 `lesson` 兩種）暫停；回來後下一個 `TURN` 才恢復；完成即停；`elapsedMs` 正確；`at` 倒退時該段計 0 |
| T-ENG-18 | 提示：`HINT_REQUEST` 暫停計時；版本不符的 `HINT_READY` 被拒絕（`stale`）；成功後 `assist.hint = true`；`TURN` 清除提示；`ROTATE` 不清除且 `hintView` 隨朝向換算 |
| T-ENG-19 | 示範：`DEMO_READY` 設 `assist.demo`；`DEMO_STEP ±1` 正確套用／還原（含整顆旋轉）；示範中 `TURN`、`ROTATE` 被拒絕；`DEMO_EXIT` 保留進度；播到結尾 → `solved` 且 `result.assist = "demo"`；`recordEligible` 為 false |
| T-ENG-20 | `RESET`：回到 `start`、清空 `history`、計時 idle、`assist` 保留、`orient` 不變 |
| T-ENG-21 | `solved` 狀態拒絕 `TURN`、`UNDO`、`REDO`、`HINT_REQUEST`、`DEMO_REQUEST`；接受 `NEW_GAME`、`RESET`、`ROTATE` |
| T-ENG-22 | 拒絕訊息格式為 `REJECT:<TYPE>:<reason>`；`canApply` 與 `reduce` 判斷一致（對所有 action 類型抽樣）；S11 起另含格式錯誤的輸入（`R3`、`xx`、非字串記號、`HINT_READY`／`DEMO_READY` 的非法 tokens、缺少 `data` 的 `NEW_GAME` 等），一律回 `REJECT` 而非其他例外 |
| T-ENG-23 | `recordEligible`：無輔助完成 true；有提示、示範、自由模式皆 false |
| T-ENG-24 | 掃描 `src/engine/`、`src/solver/`：無 `check-forbidden.sh` 所列字串（含註解） |
| T-ENG-25 | `describeMove`：36 個記號逐一比對 `base`、`kind`、`turn`；`qtm` 等於 `qtmCost`；`′` 的三種寫法（`'` `’` `′`）結果相同（修訂 R-2d） |
| T-ENG-26 | `PAUSE {reason:"lesson"}`：計時中→暫停、`assist`／`hint`／`demo`／`home`／`history`／`version` 不變、`recordEligible` 不受影響；`reason` 為其他值時拒絕（`REJECT:PAUSE:badReason`）（修訂 R-2a） |
| T-ENG-27 | `hint.pending` 期間 `ROTATE`、`SET_ORIENT` 被拒絕（`REJECT:<TYPE>:hintPending`）；提示就緒或失敗後照常接受（S11 m-4） |
| T-ENG-28 | 匯出常數（`MOVES`、`SOLVED`、`STICKER_POS`、`STICKER_NRM`、`FACE_AXES`）深度凍結；`isMove`／`kind`／`inverse`／`applyMove` 對 36 個記號以外的字串一律拋錯（S11 m-1） |

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
| T-BUILD-02 | 產物無 `http://`、`https://`、`<link`、外部 `src=`、`@import`；**檔案 < 400 KB**（D-13 由 300 KB 放寬）；**`SOLVER_WORKER_SRC` 字串 < 100 KB** |
| T-BUILD-03 | 產物中 `SOLVER_WORKER_SRC` 可被 `new Function` 解析（語法正確），且不含 `src/ui/` 的任何模組 |

大小上限的理由：spike `solver.js` 37,711 bytes 是目前已知最大的單一模組〔spike〕；層先法原型 10,346 bytes、貼紙模型原型 5,158 bytes〔G3 實測，含註解〕。Worker 字串約為 solver＋層先法＋cube＋rng＋註冊器，加上 JSON 字串跳脫，推論約 60–75 KB，取 100 KB 為上限。主 bundle 另含 solver 模組一份（主執行緒退回用），加上 UI、CSS、資料，推論約 200 KB，沿用 CLAUDE.md §4 與現有 `build/bundle.js` 的 300 KB 上限。

### 12.5 UI（`T-UI-*`；Playwright，手機直向 390×844 與 iPad 橫向 1194×834 各跑一次；AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-UI-01 | 開啟無 console error；方塊與記號鍵出現 |
| T-UI-02 | 打亂 → 按記號鍵 `R` → 步數 1 → 展開「中層（進階）」→ 按 `M` → 步數 3 → 撤銷 → **1（撤銷扣回步數，修訂 R-5）** → 重做 → 3 → 按 `y` → 仍為 3 |
| T-UI-03 | 所有可見的 `button`、`[role=button]`、`[role=switch]`、`[role=tab]` 的 boundingBox ≥ 44×44；分別在下列畫面各掃一次：開局、中層展開、示範中（含分段暫停卡片）、教學卡片、記號小教室卡片、手機抽屜收合；S11 起另掃：提示卡、提示等待卡、示範等待卡、完成遮罩（架構審查 B-3、m-7） |
| T-UI-04 | 產物無外連（同 T-BUILD-02），並以 Playwright 攔截所有網路請求：載入與遊玩過程中 0 個外部請求 |
| T-UI-05 | 手勢：在 F 面中心貼紙往右拖 60 px → 步數 +2 且方塊狀態等於做了 `E`（以測試掛鉤讀 state） |
| T-UI-06 | 在方塊外拖曳 → `orient` 改變、步數不變、計時不開始 |
| T-UI-07 | 提示：等 `ready` → 按提示 → 出現記號、白話說明與層高亮 → 照做 → 提示消失 → 再按提示立即出現（快取）→ 按「看電腦解」→「建議解示範」播完 → 完成畫面有「示範」 |
| T-UI-08 | 建議解示範播完：完成畫面標「示範」，`localStorage` 紀錄未改變 |
| T-UI-09 | 層先法示範：分段清單 8 段；單步前進／後退使方塊與記號高亮同步；點第 4 段跳到該段開頭（不出現分段卡片）；速度切換有效 |
| T-UI-10 | 無輔助完成：讀畫面上的打亂字串，按記號鍵依序輸入其反序反向 → 完成畫面無徽章 → 紀錄寫入 `cube3x3.records.v1`；途中打開並關閉一次「記號說明」，完成畫面仍無徽章、紀錄仍寫入 |
| T-UI-11 | 分頁隱藏（測試中以覆寫 `document.visibilityState` 並觸發 `visibilitychange`）→ 計時暫停 |
| T-UI-12 | 載入前把 `window.Worker` 設為 undefined → 狀態 `mainThread` → 提示仍可得到 |
| T-UI-13 | 載入前讓 `localStorage` 存取拋例外 → 遊戲可完成一局且無 console error |
| T-UI-14 | `texts.json` 全部字串、產物的 `<title>`，以及兩種視圖下開局、提示、兩種示範、分段暫停卡片、教學與記號小教室每一步、完成畫面時的 `document.body.innerText`，皆不含 `Rubik`、`最佳解`、`最少步`、`最短`（程式註解不在此限，但同樣不得出現 `Rubik`）；「示範」分頁中有文字恰為「建議解示範」的按鈕（修訂 R-3） |
| T-UI-15 | 版型 C（修訂 R-1）：iPad 橫向——學習面板在方塊區右側（面板 `left` ≥ 方塊區 `right`）、面板高度 ≥ 畫面 80%、沒有抽屜手把；手機直向——抽屜在方塊區下方（抽屜 `top` ≥ 方塊區 `bottom`）、兩者 boundingBox 不重疊；按手把收合後方塊區變高、再展開後變矮；抽屜的 computed `position` 不是 `absolute`／`fixed`；兩種視圖都有「操作」「示範」分頁；按「看電腦解」→ 切到「示範」分頁（手機同時展開）；`DEMO_EXIT` 後回到「操作」；全頁 `id` 不重複 |
| T-UI-16 | 首次教學與記號小教室（修訂 R-2a）：清空儲存後開頁 → 出現「第 1／12 步」；按「下一步」到小教室，7 步的標題依序等於 `texts.notation.lesson[].title`；每一步：卡片不與方塊區重疊、方塊區出現層高亮、面標籤開啟、卡片上的白話說明等於該步示範記號的 §2.4 結果、動畫結束後 `__cubeTest.getState()` 的 `home`、`history`、`orient`、`version` 與進入前相同、此時按記號鍵不改變 state；在 L3 按「略過這段」→ 跳到 T2（記號按鈕那一句）；「跳過教學」→ 卡片消失、`tutorialKey` 寫入；重新整理後不再出現；另開一次走完 12 步按「開始玩」同樣寫入旗標 |
| T-UI-17 | 「記號說明」重開（修訂 R-2a）：已有旗標 → 打亂、按 `R`（計時開始）→ 按「記號說明」→ 小教室 L1 出現、`timer.state === "paused"`、步數與 `assist` 不變 → 「關閉」→ 面標籤回到打開前的值、分頁回到原分頁 → 按 `U` 後計時恢復；手機直向抽屜收合時「記號說明」仍可見可按；等待提示（`hint.pending`）時「記號說明」為 disabled；示範自動播放中按「記號說明」→ 示範停止播放 |
| T-UI-18 | 記號鍵中文副標（修訂 R-2b）：36 顆記號鍵的副標文字逐一等於 §11.2 表（例：`R`→右、`R′`→右・逆、`R2`→右・半圈、`M`→左右間、`x`→整顆上翻）；`aria-label` 為「記號＋空格＋副標」 |
| T-UI-19 | 鍵盤分組與中層摺疊（修訂 R-2b）：開頁時外層 18 顆與整顆轉 9 顆可見、中層 9 顆不可見（不在版面上）且摺疊鈕 `aria-expanded="false"`；按摺疊鈕 → 9 顆可見可按、`aria-expanded="true"`；再按 → 收合；重新整理 → 回到收合；按整顆轉 `x` → `orient` 改變、步數不變 |
| T-UI-20 | 面標籤（修訂 R-2c）：教學結束後六個中心沒有代號；打開開關（`aria-checked="true"`）→ 六個中心依位置顯示 `U R F D L B` 與中文；按 `y` → 前面中心仍標 F，但貼紙顏色改變；按 `M` → 標籤仍依位置；轉視角拖曳放開後仍正確；關閉 → 代號消失；教學期間即使先前關閉也會顯示，教學結束後恢復關閉 |
| T-UI-21 | 白話說明（修訂 R-2d、R-2e）：提示浮層顯示的說明等於 `explainMove(提示記號)`；建議解示範與層先法示範每次「下一步」後，說明等於 `explainMove(下一個記號)`；層先法中至少驗到外層 90°、外層 180°、整顆轉各一例；層先法 part 為公式時顯示 `lbl.json` 該公式的 `name` 與 `desc`；播到結尾不顯示說明（中層說明由 T-DATA-07 覆蓋） |
| T-UI-22 | 分段暫停卡片（修訂 R-2e）：層先法示範以「快」速自動播放 → 每個非空且非最後的段落結尾自動停止，出現卡片，文字等於 `segmentDone` 套上本段名稱與下一個非空段的名稱＋說明，此時 `demo.cursor === segment.end` 且播放鈕為「播放」狀態；按「繼續」→ 卡片消失並繼續播放；卡片出現次數＝非空段數 − 1；最後一段結束出現完成畫面而非卡片；以「上一步」退回段尾不出現卡片；分段清單中空段顯示「已完成，略過」 |
| T-UI-23 | 視角吸附（修訂 R-4）：在方塊外斜向拖曳約 74 px（依 `cameraDegPerPx` 約 37°）後放開 → 等 `snapAnimMs` 後 `orient` 為 0–23 的整數、方塊的 transform 等於該朝向的基準視角（容差 1°）、步數不變、計時未開始；示範中拖曳放開 → `orient` 不變、畫面彈回 |

| T-UI-24 | 示範失敗與取消（架構審查 B-1）：兩種示範按下後在等待中按「取消」→ `demo === null`、等待卡片消失、仍在「示範」分頁、兩顆示範種類按鈕可再按、0 個頁面錯誤；以 `paramsPatch` 把 `solver.firstNodeLimit` 設為 1000 → 「建議解示範」回 `NODE_LIMIT` → 看得到 `demo.suggestUnavailable` 與「改看層先法示範」、`demo === null`、`assist.demo === false` → 按該鈕 → 層先法示範就緒（8 段） |
| T-UI-25 | 視角吸附計入目前朝向（架構審查 B-2）：按 `y` 後在方塊外點一下 → `orient` 不變；水平連拖兩次（各約 90°）→ `orient` 依序各等於一次 `y′`（累加）；從非 0 朝向垂直拖曳 → 等於一次 `x` 或 `x′`；小角度拖曳 → 不變；每次吸附後 transform 歸零且 54 格顏色等於 `viewStickers`；步數不變、計時未開始 |
| T-UI-26 | 輸入佇列（D-26；架構審查 K-1、m-2）：間隔 60 ms 連點 `R` 兩次 → 2 步；按 `R` 後 30 ms 內按「打亂」→ 新局 `history` 為空、計時 idle，打亂動畫結束後按 `U` 才開始計時；按 `R` 後 30 ms 內按「重設」→ 那一步作廢；同一瞬間點 6 次 → 套用 1＋`input.queueMax` 步；按 `U` 後立刻按「撤銷」→ 先做 `U` 再撤銷 |
| T-UI-27 | 本機最佳紀錄與「看看方塊」（D-24、架構審查 MJ-2、m-6）：無輔助完成 → 完成畫面顯示 `result.best`（值等於 `cube3x3.records.v1` 的 `bestTime.ms`、`bestMoves.qtm`）→ 按「看看方塊」→ 遮罩關閉、可整顆轉、不再自動跳出、可按重設 → 第二局完成 → 遮罩再出現、`solves` 為 2、最佳紀錄取較小者；`localStorage` 存取拋例外時完成畫面照常、最佳紀錄不顯示、0 個頁面錯誤 |
| T-UI-28 | 資料開關（D-25、架構審查 MJ-1）：`keypad.showSubLabels=false` → 沒有中文副標、`aria-label` 不變；`faceLabels.forceOnInTutorial=false` → 教學 T0 與小教室 L1 期間面標籤維持關閉；`ui.turnAnimMs=0`、`ui.scrambleAnimMsPerMove=0` → 打亂不播動畫也不上鎖、轉動動畫長度為 0 且按 `R` 立即套用 |
| T-UI-29 | （Node 單元測試，`tests/engine/ui-logic.test.js`）視角吸附幾何：24 個朝向的相機矩陣把 home 貼紙送到 `viewStickers` 的位置；任一朝向點一下不變；水平 90° 拖曳＝`y′` 且連拖四次回原朝向；垂直 90° 拖曳＝`x` 或 `x′`；小角度彈回；相對吸附終點 · Q(from) ＝ Q(to)（架構審查 B-2） |
| T-UI-30 | （Node 單元測試，同上）輸入佇列：依序執行、上限、取出時重檢 `canApply`、`clear()`／上鎖讓正在播動畫的那一步不送出、其他動畫或 `hold` 時等待不丟棄、動畫失敗不送出；數值預設值只在鍵缺少時套用（0 為有效值）（D-25、D-26） |

- 測試掛鉤：UI 在網址帶 `?test=1` 時提供 `window.__cubeTest = { getState(), dispatch(action) }`；正式使用不帶參數時不建立。S11 起另提供 `rejects()`（被拒絕的 action 記錄）、`queueSize()`、`inputIdle()`、`inputLocked()`，並支援網址參數 `paramsPatch=<JSON>`（深層合併進 `params`，只在 `test=1` 時生效；T-UI-24、T-UI-28 使用）。
- 教學旗標：除 `T-UI-16`、`T-UI-20`（教學段落）外，各測試開頁前先寫入 `tutorialKey`，避免教學卡片擋住操作；`T-UI-13`（儲存拋例外）改在網址加 `?test=1&tutorial=0`，UI 見到 `tutorial=0` 時視同 `params.tutorial.enabled = false`（只在 `test=1` 時生效）。

### 12.6 資料（`T-DATA-*`，AI 可自驗）

| 編號 | 內容 |
|---|---|
| T-DATA-01 | `palette.stickers` 6 筆、id 0–5、hex 互不相同 |
| T-DATA-02 | `lbl.json` 每個 `alg` 都能被解析且只含外層記號；`segments` 與 §8.3 一致 |
| T-DATA-03 | `texts.lbl` 有 8 段且鍵與 `lbl.segments` 一致；`tutorial` 3–5 筆（目前 5 筆） |
| T-DATA-04 | `params` 各數值欄位存在且為正數（`ui.baseViewDeg` 可為負）；布林欄位（`demo.pauseAtSegmentEnd`、`layout.*`、`keypad.*`、`faceLabels.*`、`tutorial.enabled`）為 boolean；`demo.defaultSpeed` 存在於 `speeds`；`tutorial.notationBeforeIndex` 介於 0 與 `texts.tutorial.length` 之間 |
| T-DATA-05 | 全部 `src/`、`docs/spec/` 無常見簡體字（字表放測試檔） |
| T-DATA-06 | 記號文案結構（修訂 R-2a、R-2b、R-2c）：`texts.notation.faceName` 恰有 `U D L R F B M E S` 9 鍵；`rotationSub` 恰有 9 個整顆轉記號；`keySub` 有 `cw`／`ccw`／`half` 且都含 `{face}`；`lesson` 7 筆，`id` 依序等於 `params.tutorial.notationSteps[].id`，每筆 `title`、`body` 非空；每個 `notationSteps[].demo` 恰為 1 個合法記號（以正規表示式 `^[UDLRFBMESxyz]['2]?$` 檢查，不依賴 engine，讓 S1 可與 S2 並行）；`buttons` 含 `notationHelp`、`faceLabels`、`sliceFold`、`continue`、`lessonSkip`、`lessonReplay`，且 `buttons.demoSuggest === "建議解示範"`；`palette.stickers` 每筆有 `labelInk` |
| T-DATA-07 | 白話說明（修訂 R-2d）：以 `describeMove` ＋ `notation.explainMove` 對 36 個記號產生說明：全部不含未替換的 `{`、`}`，36 句互不相同；外層非 `′` 非 `2` 含「順時針」、`′` 含「逆時針」、`2` 含「半圈」、中層 90° 含「照 L」「照 D」「照 F」（`′` 時為「照 L′」等）、整顆轉含「不算步數」；句中步數等於 `qtmCost`；`explainMove("R")` 恰為「R：右層順時針轉 90°，算 1 步」、`explainMove("M'")` 恰為「M′：左右之間的中層照 L′ 的方向轉 90°，算 2 步」；`keySubLabel` 36 個結果等於 §11.2 表 |
| T-DATA-08 | 層先法公式說明（修訂 R-2e）：`lbl.json` 11 個公式都有非空 `name` 與 `desc`；`texts.demo.segmentDone` 含 `{done}` 與 `{next}`；`texts.demo.formulaUse` 含 `{desc}` |
| T-DATA-09 | 禁用字（修訂 R-3）：測試檔的禁用字清單必須包含 `Rubik`、`最佳解`、`最少步`、`最短`（清單少任何一個即失敗）；`texts.json` 與 `lbl.json` 的全部字串值都不含清單中的字 |
| T-DATA-10 | 資料驅動（S11，架構審查 MJ-1、D-25）：`params.json` 的每一個欄位名稱都出現在 `src/engine`、`src/solver`、`src/ui` 的程式中（例外清單只有 `ui.minTouchPx`：CSS 直接寫 44px，由 T-UI-03 實測，架構審查 n-2 列 v0.2）；§10.3 的 S11 新增欄位型別正確（T-DATA-04 一併檢查）；`buttons.viewCube`、`confirm.newGameInProgress` 非空；`result.best` 含 `{label}`、`{time}`、`{qtm}` |

### 12.7 需製作人本機驗（M-*）

| 編號 | 內容 |
|---|---|
| M-01 | iPad Safari 橫向：CSS 3D 方塊無破圖、無面片閃爍（轉層、轉視角、示範時） |
| M-02 | iPhone／iPad 實機：建表時間與一次提示的等待時間（記錄秒數，供 G5 調 `initTimeoutMs`、`nodeLimit`） |
| M-03 | 手勢手感：轉層與轉視角是否誤觸；雙指是否觸發頁面縮放 |
| M-04 | 飛航模式下以 `file://` 或本機網址開啟可完整玩一局，提示與兩種示範可用 |
| M-05 | 手機直向單手可完成打亂、轉動、提示、示範 |
| M-06 | 手機直向抽屜展開時方塊是否仍看得清楚（v1-compare 指出 C 版手機方塊最小）；必要時記錄希望的抽屜高度 |
| M-07 | 請一位沒有魔術方塊基礎的人走一次首次教學與記號小教室，記錄是否看懂 U／′／2／中層，以及是否中途按「跳過」 |

---

## 13. 已知風險與 UNKNOWN

（G3.5 修訂時風險編號由 R-n 改為 **RK-n**，避免與「修訂 R-n」混淆；內容與順序不變。）

| # | 項目 | 狀態／處理 |
|---|---|---|
| RK-1 | iPad Safari 的 CSS 3D（`preserve-3d`、背面、疊層）破圖 | **UNKNOWN**；G0 已列；M-01 真機驗 |
| RK-2 | 手機實機建表時間、記憶體（型別陣列約 10.9 MB） | **UNKNOWN**（spike §6）；M-02；逾時門檻為預設值 |
| RK-3 | iOS Safari 在 `file://` 下能否用 Blob URL 建 Worker | **UNKNOWN**；已規定退回主執行緒（§9.6、T-UI-12） |
| RK-4 | spike `solver.js` 會被 hook 擋：第 312 行註解含 `Math.random`，**第 23–25 行另有 `performance.now` 與 `Date.now`** | G4 改寫時必須移除（§7.3 第 1、2 點） |
| RK-5 | `nodeLimit` 3,000,000 在手機上的耗時 | **UNKNOWN**；桌機 Node 平均 102.2 ms、最大 254.1 ms〔G3 實測〕 |
| RK-6 | 層先法示範很長（樣本最大 236 QTM）；近復原狀態也可能超過 200 步，教學體驗可能不佳 | 已知；理論上限 UNKNOWN；G5 觀察，v0.2 可考慮「只示範目前這一段」 |
| RK-7 | 層先法公式寫法的出處未逐一查證 | 效果已用模擬驗證（§8.6）；文案不宣稱「官方公式」 |
| RK-8 | 手勢參數全為預設值 | 待 G5；調研 §B1 指出邊界誤判是常見問題 |
| RK-9 | 放開拖曳即吸附 24 朝向，可能讓想「斜看」的玩家覺得受限 | G3.5 已拍板採用吸附（§14 第 2 題結案）；G5 觀察 |
| RK-10 | random-move 打亂分布不均勻 | 已標「非 WCA 官方打亂」 |
| RK-11 | `node --test` 帶萬用字元路徑需要較新的 Node（本機 v22.22.2 可用）；`CLAUDE.md` §4 寫「Node ≥ 18」 | 製作人本機 Node 版本 **UNKNOWN**；列入回報 |
| RK-12 | 現有 `build/bundle.js` 是第一款遊戲的版本（檔案清單含 `jobs`、`assets` 等），不適用本案 | 分派單 S7 改寫 |
| RK-13 | `′` 字元在 iOS 預設字型的顯示效果 | **UNKNOWN**；G3.5／G5 檢查 |
| RK-14 | 紅橙配色在色弱玩家的辨識度 | **UNKNOWN**；G5 檢查 |
| RK-15 | 快取的建議解與「重新求解」理論上可能不同（快取只在照提示轉時使用） | 已知；因 `nodeLimit` 可重現，同一狀態算出的解必相同，不影響正確性 |
| RK-16 | 版型 C 在手機直向的方塊最小（v1-compare）；抽屜展開時可能看不清 | 抽屜為文件流、可收合；M-06 實機確認 |
| RK-17 | 首次教學由 5 步變成 12 步，玩家可能嫌長而跳過 | 每步都可「略過這段」或「跳過教學」，且可從「記號說明」重看；M-07 觀察 |
| RK-18 | v1-C 靜態稿有觸控目標小於 44 px（分頁 40、速度 36、手把 30） | §11.1 差異第 2 點；`T-UI-03` 多畫面掃描 |
| RK-19 | 面標籤跟著位置而不是顏色，玩家做完中層或整顆轉後可能以為標籤「跑掉」 | 小教室 L1 明說「以你目前看到的為準」；G5 觀察 |
| RK-20 | 中文副標與白話說明的方向用語（上翻、左轉、右倒）是本規格自擬，未經玩家測試 | 方向已用 `cube-model.js` 驗證（§1.2）；用語由 game-designer 潤飾、M-07 觀察 |

---

## 14. 需要製作人決定的事（G3.5 已回覆）

### 14.1 已結案（decision-log 2026-09-15 G3.5）

1. **【已結案】看電腦解 A（兩階段法）的按鈕名稱** → 製作人同意改為「**建議解示範**」，全面取代舊名（修訂 R-3）。規格、文案、測試都已改用新名；禁用字清單維持含「最短」（`T-UI-14`、`T-DATA-09`）。
   - 原題：decision-log G2 寫「最短示範（建議解）」，但「最短」容易被理解為最少步，與 CLAUDE.md §1 同一精神衝突（建議解平均 27.6 步，QTM 上帝之數 26）。
2. **【已結案】拖曳視角放開後是否吸附到正朝向** → 製作人：「要」（修訂 R-4）。§9.3 採吸附；`T-UI-23`。
3. **【已結案】撤銷是否扣回步數** → 製作人：「同意」扣回（修訂 R-5）。§2.2 淨步數；`T-ENG-16`、`T-UI-02`。

### 14.2 仍開放的問題（都有預設值，**不擋 G4 開工**）

4. **教學以外的面標籤預設**：本規格預設「關」（`params.faceLabels.defaultOn = false`），理由是製作人原話只要求「教學期間開啟」，且標籤會蓋住中心顏色。若希望初學者一直看到代號，改成 true 即可（只改資料檔）。建議 G5 看 M-07 結果再決定。
5. **互動式逐段教學（M4）是否仍留 v0.2**：G3.5 教學目標是「讓沒有基礎的人也能學會」。v0.1 提供記號小教室、白話說明、層先法分段示範與暫停卡片、公式用途，但沒有「玩家自己照著做、系統逐段檢查」的練習；依 G2 拍板，本規格仍把它留在 v0.2（§0.2 N-1）。若製作人認為 v0.1 就要有，需另開規格與分派段。

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
| decision-log G2 | 看電腦解的名稱（G2 原文用舊稱，附「建議解」） | 由 G3.5 改名取代，見下方 G3.5 列 | 已由 G3.5 結案 |
| CLAUDE.md §1 | 畫面稱「建議解」，不得稱「最佳解」 | §2.3、§10.1、T-UI-14 | 一致 |
| CLAUDE.md §1 | Worker 以 Blob 由同一檔案產生，不得外連 | §9.5、T-BUILD-02/03 | 一致 |
| CLAUDE.md §1 | 劃在方塊上＝轉層；方塊外或雙指＝轉視角；記號按鈕備援 | §9.2、§9.3、§11 | 一致 |
| CLAUDE.md §3 | 純函數、seeded RNG、資料驅動、觸控優先、零依賴 | §4、§5、§10、§11、§12 | 一致 |
| game-design §4 | 按提示或自動復原時計時暫停 | §6.2（恢復時機為本規格補充：下一個動作） | 一致（補充） |
| game-design §4 | 計時從打亂完成後第一個有效轉動開始 | §6.2、§11.4 打亂動畫中不接受轉動 | 一致 |
| game-design §11 | 等待文案不承諾秒數；知識卡「最多 26 步」 | §10.1；知識卡不在 v0.1 | 一致 |
| spike §5 | QTM 成本搜尋、只建 QTM 表、求解器不放 engine、重放用節點上限 | §7 | 一致 |
| decision-log G3.5 | UI 版型：C 學習導向（iPad 右側學習面板；手機直向為方塊下方抽屜；操作／示範分頁） | §11.1、§9.1；`T-UI-15` | 一致（修訂 R-1） |
| decision-log G3.5 | 記號教學：一般玩家不懂外層／中層、U D L R F B，需要在教學時介紹 | §11.3 記號小教室、§11.2 副標／摺疊／面標籤、§2.4 白話說明；`T-UI-16`～`T-UI-21`、`T-DATA-06`、`T-DATA-07` | 一致（修訂 R-2） |
| decision-log G3.5 | 示範按鈕名稱改為「建議解示範」，全面取代舊名 | §1.3、§10.1、§14 第 1 題；`T-UI-14`、`T-DATA-09` | 一致（修訂 R-3） |
| decision-log G3.5 | 拖曳視角放開後吸附正朝向：要 | §9.3、§4 `SET_ORIENT`；`T-UI-23` | 一致（修訂 R-4） |
| decision-log G3.5 | 撤銷扣回步數：同意 | §2.2；`T-ENG-16`、`T-UI-02` | 一致（修訂 R-5） |
| decision-log G3.5 | 教學目標：讓沒有基礎的人也能學會，不需要學到神人等級；教到層先法即止，CFOP 等速解法不在範圍 | §0.2 N-10、§9.1 教學範圍、§10.4 `desc`、§9.1 分段暫停卡片；`T-UI-22`、`T-DATA-08` | 一致（修訂 R-2e）；互動式逐段教學仍留 v0.2（§14 第 5 題，不擋開工） |
| `docs/ui/decision-log.md` 實作備註 1～4 | 改名與段數、`[hidden]` 規則、抽屜文件流、無重複 `id` | §11.1 規則與差異清單；`T-UI-15` | 一致 |

---

## 附錄 C：G3.5 修訂對照表（修訂編號 → 章節 → 測試）

| 修訂 | 內容 | 規格章節 | 測試 |
|---|---|---|---|
| R-1 | 版型 C：iPad 橫向左方塊＋右學習面板（「操作」「示範」分頁）；手機直向面板為方塊下方抽屜（文件流、展開時壓縮方塊區）；自動切分頁 | §0.1 F-8、§9（前言）、§9.1 進入／切換種類、§11.1 | T-UI-15、T-UI-03（多畫面掃描）、M-06 |
| R-2a | 記號小教室 7 步（六個面、順時針、′、2、外層與中層、整顆轉、QTM），每步實際示範並高亮；可略過；「記號說明」隨時重開；打開時暫停計時（`PAUSE {reason:"lesson"}`） | §0.1 F-6、§4 `PAUSE`、§6.2、§10.1 `notation.lesson`、§10.3 `tutorial`、§11.3 | T-UI-16、T-UI-17、T-UI-10、T-ENG-17、T-ENG-26、T-DATA-06、M-07 |
| R-2b | 記號鍵中文副標；中層鍵收在「中層（進階）」摺疊區；整顆轉 x y z 獨立一組、預設展開（理由見 §11.2） | §0.1 F-7、§10.1 `notation.faceName／keySub／rotationSub`、§10.3 `keypad`、§11.2 | T-UI-18、T-UI-19、T-UI-02、T-DATA-06、T-DATA-07 |
| R-2c | 面標籤開關：中心貼紙顯示面代號與中文，跟著位置；教學期間強制開啟 | §10.2 `labelInk`、§10.3 `faceLabels`、§11.2、§11.3 | T-UI-20、T-UI-16、T-DATA-06 |
| R-2d | 提示與兩種示範每一步顯示白話說明；模板在 `texts.json`；engine `describeMove`＋UI `notation.js` | §1.2、§2.3、§2.4、§9.1 白話說明、§10.1 `notation.explain` | T-ENG-25、T-DATA-07、T-UI-21、T-UI-07 |
| R-2e | 層先法每段結束自動暫停並顯示「本段完成／下一段要做」卡片；公式帶名稱＋白話用途；範圍到層先法為止（CFOP 列範圍外） | §0.1 F-4、§0.2 N-10、§9.1 分段暫停卡片／教學範圍、§10.1 `demo.segmentDone`、§10.3 `demo.pauseAtSegmentEnd`、§10.4 `desc` | T-UI-22、T-UI-21、T-UI-09、T-DATA-08 |
| R-3 | 看電腦解 A 的按鈕舊名全面改為「建議解示範」（§14 第 1 題結案；舊名見 decision-log G2 引文） | §1.3、§10.1、§14.1、附錄 B；ADR-001 §6 | T-UI-14、T-DATA-09、T-DATA-06 |
| R-4 | 拖曳視角放開後吸附正朝向：採用（§14 第 2 題結案） | §4 `SET_ORIENT`、§9.3、§10.3 `ui.snapAnimMs`／`baseViewDeg`、§13 RK-9 | T-UI-23、T-UI-06、T-ENG-08 |
| R-5 | 撤銷扣回步數：採用（§14 第 3 題結案） | §2.2、§4 `UNDO` | T-ENG-16、T-ENG-15、T-UI-02 |
| R-6 | §14 其餘未決題列出；附錄 B 補 G3.5 各列 | §14.2、附錄 B | —（文件修訂） |
