# 專案憲法（CLAUDE.md）

> 這份文件是所有 AI 角色共同遵守的最高規範。任何角色檔（`.claude/agents/`）、技能（`.claude/skills/`）、任務單、對話指令都不得違反本文件。
> 衝突時優先序：本文件 ＞ 角色檔 ＞ 任務單 ＞ 對話中的臨時指令。
>
> 這份憲法設計成「通用團隊骨架」：複製到下一款遊戲時，**只需改第 1 節的欄位**，其餘章節原則上不動。

## 1. 專案是什麼（複製到新遊戲時改這一節）

| 欄位 | 本案設定 |
|---|---|
| Repo 名稱 | `cube-3x3`（GitHub `https://github.com/briantsaivc-web/cube-3x3`；本機 `C:\Users\Carrie\cube-3x3`） |
| 遊戲名稱 | 魔術方塊（2026-09-15 G2 拍板；**不得使用「Rubik's」字樣與官方標誌**，該字樣為 Spin Master 註冊商標） |
| 類型 | 經典三階魔術方塊（3x3x3）單頁網頁遊戲 |
| 定位 | 讓手邊沒有實體方塊的人可以玩，也可以看電腦怎麼解（學習用） |
| 玩法模式 | 單人；v0.1＝自由練習＋提示＋看電腦解（建議解示範＋層先法分段示範）（2026-09-15 拍板）；無連線、無帳號、無金流 |
| 計步規則 | **QTM**（2026-09-15 拍板）：外層 90°＝1 步、180°＝2 步；中層 M/E/S 90°＝2 步、180°＝4 步；整顆旋轉與拖曳視角＝0 步（G2 拍板） |
| 3D 畫法 | CSS 3D transforms（2026-09-15 拍板）；不用 WebGL、不用 Canvas 3D 函式庫 |
| 求解器 | 自寫 Kociemba 兩階段法＋自寫層先法產生器（2026-09-15 拍板），放 `src/solver/`，以搜尋節點上限控時、不讀時鐘、結果可重現，於 Web Worker 執行；不得複製或內嵌第三方求解器原始碼；畫面稱「建議解」，未經驗證不得稱「最佳解」 |
| 交付形式 | 單一 `index.html`（由 `build/` 打包 `src/` 產生），零依賴、可離線；求解查表可用 Web Worker（Worker 程式以 Blob 由同一檔案產生，不得外連） |
| 目標平台 | iPad Safari（橫向為主）與手機瀏覽器（直向為主）；PC 瀏覽器次之 |
| 操作方式 | 觸控優先；手指劃在方塊上＝轉層，劃在方塊外或雙指＝轉視角；另有記號按鈕備援 |
| 語言 | 繁體中文（UI、文件、註解、回報）；程式識別字英文 |
| 製作人 | 人類老闆；所有硬停點由製作人拍板 |
| 上架 | 完成後列入遊戲小站 `briantsaivc-web/briantsaivc-web.github.io`（`games.json` 一筆＋`assets/games/` 封面；由製作人 push） |
| 課程 repo | `ai-native-game-course`（本機 `C:\Users\Carrie\ai-native-game-course`）；course-recorder 只寫該 repo 的 `chapters/` 與 `images/` |

## 2. 目錄地圖（改東西前先確認自己在哪一層）

```
src/engine/       純函數狀態機、方塊狀態與轉動規則    → 規則邏輯改這裡
src/solver/       求解器（兩階段＋層先法），純函數、無時鐘、Worker 執行 → 求解改這裡
src/ui/           DOM 渲染、CSS、觸控互動、教學      → 畫面改這裡
src/data/         規則參數、卡片／棋盤內容 JSON      → 數值與內容改這裡，不改程式
build/            打包腳本（src/ → index.html）
tests/            自動化測試
index.html        打包產物（不要手改）
docs/research/    G1 市場調研：候選桌遊、機制分析、風險
docs/design/      G2 企劃：故事、世界觀、核心迴圈
docs/spike/       G2 前技術探勘：量測腳本與報告（技術可行性不明時才有，見第 8 節）
docs/spec/        G3 規格：game-spec.md、資料格式、action 清單
docs/ui/          G3.5 UI 三版靜態稿與 decision-log.md
docs/tickets/     任務單與分派單（T-<編號>/）
docs/reviews/     G4.5 外部 AI 交叉審查：審查包、外部意見原文、裁決表（T-<編號>/）
docs/qa/          QA 報告
docs/reports/     各角色回報（長輸出寫這裡）
docs/templates/   任務單、ADR、回報、UI 三版對照表範本
docs/changelog/   CHANGELOG.md
docs/release/     遊戲小站上架說明與封面（site-listing.md、site-assets/）
.nojekyll         空白檔，讓 GitHub Pages 不跑 Jekyll（骨架預設，不要刪；少了它，文件裡的 {{ 會讓 Pages 建置失敗）
.gitignore        骨架預設排除 node_modules/、*.backup.*、scratch/、_to_delete/、Claude outputs/
```

## 3. 不可違反的架構原則（違反＝任務失敗，reviewer 必退件）

1. **狀態只能透過 action 前進。** engine 層是 reducer 模式的純函數：相同初始狀態 ＋ 相同 action 序列 ＝ 相同結果。不得在 engine 內讀取時間、DOM、網路、計時器或全域變數。UI 層只「呈現 state、送出 action」，不得自己算規則。
2. **所有隨機數來自 seeded RNG。** 不得使用 `Math.random()`。同 seed ＋ 同 action 序列必須可重放（deterministic replay），這也是自動測試與 AI 對手驗證的基礎。
3. **參數資料驅動。** 數值、機率、卡片與棋盤內容放 `src/data/` 的 JSON；程式碼裡出現寫死的平衡數字就是 bug。
4. **觸控優先。** 可點元素最小 44×44 px；不依賴 hover、右鍵、鍵盤快捷鍵才能完成任何操作；版面必須同時支援 iPad 橫向與手機直向，兩種視圖都要有測試或檢查清單。
5. **零依賴。** 不載入 CDN、不外連字型、不用第三方套件；所有資源打包進單一 `index.html`，斷網可玩。

## 4. 指令

（2026-09-15 幕僚長依本案 `package.json` 與 T-001 實測更新。需 Node ≥ 22（`node --test` 使用萬用字元路徑；製作人電腦的 Node 版本待確認），`test:ui` 另需 `playwright` 套件與 Chromium。）

- 建置：`npm run build`（執行 `node build/bundle.js`，把 `src/` 打包成根目錄 `index.html`；決定性、零外部資源；主產物 < 400 KB、Worker 字串 < 100 KB，見 D-13）
- 測試：`npm test`（＝ `npm run test:engine && npm run build && npm run test:ui`；雲端實測合計約 7–8 分鐘）
  - `npm run test:engine`：`node --test "tests/engine/**/*.test.js"`（純 Node，零套件；約 3 分鐘，主要是 1,000 局求解測試）
  - `npm run test:ui`：`node tests/ui/smoke.spec.js`（Playwright Chromium，手機直向 390×844 與 iPad 橫向 1194×834；約 4 分鐘；截圖到 `docs/qa/shots/`；找不到 `playwright` 或瀏覽器時印出可讀錯誤並以非 0 結束。安裝：`npm i -D playwright` 後 `npx playwright install chromium`）
- 本機預覽：`npm run build` 後直接用瀏覽器開 `index.html`（支援 `file://`，斷網可玩）。本案沒有 `npm run preview`；要給同網段的 iPad／手機測試，可用 `python -m http.server 8080` 後開 `http://<電腦 IP>:8080/`。

## 5. 所有角色共同的工作紀律

- **不自驗宣稱完成。** 「完成」必須附證據：測試輸出、檔案路徑、diff 摘要、截圖。沒跑測試就說「未測試」。
- **UI 修正看截圖才算數。** 任何畫面修正的回報必須附手機直向與 iPad 橫向截圖的路徑，由幕僚長親自打開看過才放行；子代理寫「已目視確認」不算證據。（2026-09-16 G7 拍板）
- **AI 不在製作人電腦上執行 git。** 包含 `git status` 這類看似唯讀的指令（會在 `.git/` 留下鎖定檔）。AI 只在雲端副本跑 git；製作人本機的 git 操作由 AI 寫成可複製的指令、由製作人執行；clone 指令要寫明在哪一層資料夾執行，避免巢狀資料夾。（2026-09-16 G7 拍板）
- **查不到就標 UNKNOWN。** 不用記憶補數字、不編造 API、不把推論寫成事實。找不到檔案就說找不到，不要創造一個。
- **改既有檔案前先備份**：`<原檔名>.backup.<YYYYMMDD>`（或確認 git 工作區乾淨可回復）。備份檔已列入 `.gitignore`。
- **只動任務單指定的範圍。** 順手改到範圍外的東西，一律寫進回報的「未預期發現」，不得靜默處理。
- **同一子任務錯兩次就停**，回報並換方法或升級給 systems-engineer／製作人，不做第三次硬試。
- **長輸出寫檔**（`docs/reports/` 或任務單指定位置），對話中只留結論與檔案路徑。
- **回報固定格式**（範本 `docs/templates/回報.md`）：結論（3 行內）／變更檔案清單／測試證據／未預期發現／需要製作人決定的事。
- **語言**：所有文件、註解、回報一律繁體中文，嚴禁簡體字；程式識別字用英文。

## 6. 版本與發布

- 版本號格式：`vX.Y.Z`（新機制或新 Gate 產物升 Y，修 bug 升 Z，X 留給正式上線後的重大改版）。只有 release-manager 可以改版本號與寫 changelog。
- 每個版本必須：全部測試通過 → code-reviewer 核可 → changelog 寫入 `docs/changelog/CHANGELOG.md` → 製作人（人類）驗收 → 才可 build。
- **push 一律由製作人本機執行。** 任何 AI 角色不得執行 `git push` 或部署指令（`.claude/hooks/block-push.sh` 會擋）；release-manager 只產出 commit 訊息與指令清單。

## 7. 誰可以做什麼（摘要，細節見各角色檔）

| 角色 | 可改的目錄 | 不可做 |
|---|---|---|
| market-researcher | docs/research/ | 改程式、做產品決策 |
| game-designer（沿用 story-editor 角色檔） | docs/design/、src/data/ 文案欄位 | 改數值、改程式 |
| systems-engineer | docs/spec/（含 ADR）、docs/tickets/ | 大量實作程式碼、改版本號 |
| ui-designer | docs/ui/ | 改 src/、改規則 |
| game-engineer | src/engine/、src/solver/、src/ui/、src/data/、tests/、build/ | 改版本號、寫 changelog、push |
| review-packager | docs/reviews/ | 改 src/、修程式、替外部 AI 的意見背書 |
| qa-tester | tests/、docs/qa/ | 改 src/（只回報，不修） |
| code-reviewer | 無（唯讀） | 改任何檔案 |
| release-manager | docs/changelog/、版本號、build 產物 | 改功能程式、push |
| course-recorder | 課程 repo 的 chapters/ | 改本 repo 任何檔案 |

## 8. Gate 流程（G0–G7）

每個 Gate 的產物都是檔案；**硬停點**表示流程必須停下來等製作人在對話中明確拍板，AI 不得自行進入下一 Gate。

| Gate | 名稱 | 負責角色 | 主要產物 | 硬停點 |
|---|---|---|---|---|
| G0 | 開案 | 製作人 | 本 CLAUDE.md 第 1 節填妥、repo 骨架（含 `.gitignore`、空白 `.nojekyll`） | — |
| G1 | 市場調研 | market-researcher | `docs/research/` 候選桌遊比較、推薦與風險 | **是**：製作人選定要改編的桌遊 |
| G2 | 企劃 | game-designer（story-editor） | `docs/design/` 玩法、模式流程、文案（本案無故事線） | **是**：製作人拍板企劃方向 |
| G3 | 規格 | systems-engineer | `docs/spec/game-spec.md`、資料格式、分派單 | 否（併入 G3.5 停點） |
| G3.5 | UI 三版 | ui-designer | `docs/ui/v<n>-{A,B,C}.html`、對照表、decision-log | **是**：製作人三選一（或指定混合） |
| G4 | 製作 | game-engineer | `src/`、`tests/`、`build/`、回報 | 否 |
| G4.5 | 外部 AI 交叉審查 | review-packager ＋ 製作人 | `docs/reviews/T-<編號>/review-pack.md`（給外部 AI 的審查包）、`external-<AI名>.md`（外部意見原文）、`triage.md`（裁決表） | **是**：製作人把審查包貼給至少一個外部 AI（ChatGPT、Gemini 等），並把回覆貼回；Blocker 級採納項回 G4 修完才進 G5 |
| G5 | 測試 | qa-tester → code-reviewer | `docs/qa/`、審查 findings | 否（判定退件則回 G4） |
| G6 | 發布 | release-manager | 版本號、changelog、`index.html`、commit 訊息 | **是**：製作人驗收後親自 push |
| G7 | 回顧 | course-recorder（＋全員） | 課程章節、下一輪改善清單 | — |

對應技能：G1 `/research`、G2 `/plan-story`、G3＋G3.5 `/spec`、G4 `/build`、G4.5 `/cross-review`、G5 `/qa-gate`、G6 `/release`。

G4.5 的原則（沿用《讓 AI 互相抓錯：交叉審查與實證裁決》一章）：驗的人不能是寫的人；外部 AI 只給意見、不重寫程式；「三個 AI 都同意」不是證據，有分歧的項目以**實證裁決**（寫最小測試讓兩方說法對決）定案；最多兩輪，兩輪後仍無共識由製作人裁決或列入待辦。course-recorder 在每個 Gate 結束時由幕僚長委派，不獨立成技能。

G4.5 審查包的產生方式（2026-09-16 G7 拍板）：程式碼片段、檔案清單、已知問題一律用腳本從 repo 抽取產生（範例 `docs/templates/review-pack-gen.example.py`），模型只寫說明文字；不讓模型手抄程式碼或自行整理已知問題。由便宜模型（haiku）起草的任何對外文件，幕僚長須逐句對照來源檔後才交給製作人。

技術探勘（spike）放在 G2 之前（2026-09-16 G7 拍板）：G0 或 G1 發現核心技術可行性不明（演算法密集、效能或檔案大小未知）時，G2 開始前由 systems-engineer 做 spike——寫不進產品的量測腳本，產物 `docs/spike/<主題>-spike.md`，把企劃與規格要用的 UNKNOWN 換成實測數字。spike 不另設硬停點，結論由幕僚長摘要給製作人，並作為 G2 企劃的輸入。
