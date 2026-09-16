# 回報：T-001 systems-engineer（G4 結束架構審查）

| 欄位 | 內容 |
|---|---|
| 角色 | systems-engineer |
| 任務 | T-001 架構審查（分派單 §3「架構審查」；G4 → G4.5 關卡） |
| 日期 | 2026-09-15 |
| 結論 | **退件：需回 G4 修正**（3 項 Blocker） |
| 審查依據 | `CLAUDE.md` §3、`docs/spec/game-spec.md`（v0.1.1，含附錄 B、附錄 C）、`docs/spec/ADR-001-solver.md`、`docs/tickets/T-001/dispatch.md`、`docs/reports/T-001-S1.md`～`S9.md`、`T-001-S8e.md`、`T-001-arch-decisions.md`（D-1～D-22、K-1） |
| 審查範圍 | `src/engine/`、`src/solver/`、`src/ui/`、`src/data/`、`build/bundle.js`、產物 `index.html`；`tests/` 只抽查 |

## 1. 結論（3 行內）

- **需回 G4 修正，暫不進 G4.5。** engine／solver 的純度、同 seed 重放、`nodeLimit` 可重現、Blob Worker 零外連、零依賴都已實測通過；engine 測試 83／83 通過，build 兩次 byte-identical。
- 另外實測到 3 項 Blocker：B-1「建議解示範」按取消或求解失敗後畫面卡住（`demo-player.js` 呼叫已刪除的函式）；B-2 方塊不在初始朝向時，在方塊外點一下或拖曳，視角會跳回初始朝向；B-3 提示卡的關閉鈕只有 32×32 px，違反 CLAUDE.md §3 第 4 條。
- 另有 2 項 Major（資料開關無效、最佳紀錄只寫不讀）、9 項 Minor、8 項 Nit。Blocker 與 Major 修法都很小，建議同一輪修完，並補上目前漏掉這些問題的 UI 測試（§10）。

## 2. 變更檔案清單

| 檔案（相對路徑） | 動作 | 行數 ＋／－ | 備份檔 |
|---|---|---|---|
| `docs/reports/T-001-arch-review.md`（本檔） | 新增 | 全新 | — |

- 未修改 `src/`、`tests/`、`build/`、`docs/` 其他檔；未執行 git commit。
- `node build/bundle.js` 會覆寫根目錄的 `index.html`。重建後的 sha256 與審查前相同（`8981e987…a123ec`），所以沒有實際變更（見 §9 第 1 點）。
- 自驗腳本放在 session scratchpad（不在 repo 內）：`arch-repro.js`（Playwright 重現）、`arch-node.js`（Node 自驗）。

## 3. 測試證據（自跑）

| # | 指令 | 結果摘要 |
|---|---|---|
| 1 | `time node --test "tests/engine/**/*.test.js"` | `# tests 83`／`# pass 83`／`# fail 0`；實際經過時間 3 分 01 秒（`duration_ms 181247`）；exit 0 |
| 2 | `node build/bundle.js`（跑兩次，第二次加 `--out` 輸出到 scratch） | `350031 bytes；18 個模組、4 個資料檔；Worker 字串 82941 bytes、5 個模組；零外部資源`；兩次 sha256 都是 `8981e987e1f9f884309f3af6150e4a4614c6ee083f4f46ab15ad9f9690a123ec`（決定性成立；< 400 KB〔D-13〕；Worker < 100 KB） |
| 3 | `bash .claude/hooks/check-forbidden.sh; echo $?` | `0`；`forbidden-allowlist.txt` 為空檔（0 bytes），沒有人靠白名單繞過 |
| 4 | `grep -rnE 'Math\.random\|Date\|performance\|now\(\|localStorage\|…\|self\|globalThis\|postMessage\|importScripts\|XMLHttpRequest\|WebSocket\|Worker\|crypto\|process\.\|console\.' src/engine src/solver`（掃描字串比 hook 更多） | 除了 `require(...)`，只在 `src/solver/worker.js` 第 1、7、8、12、16、36、145 行的**註解**中出現「Worker」一詞，不是 API 呼叫；時鐘、儲存、DOM、網路、亂數 API 都是 0 筆 |
| 5 | `grep -oE "https?://…" index.html`；`grep -cE "<link\|@import\|url\(" index.html`；外部 `src=`；`fetch(`、`XMLHttpRequest`、`WebSocket`、`importScripts`、`sendBeacon`、`navigator.*`；`font-face`、`cdn`、`unpkg`、`jsdelivr` | 全部 0 筆；`Math.random` 在產物中 0 筆 |
| 6 | `grep -rnoE "Rubik\|最佳解\|最少步\|最短" src/data src/ui/*.{js,html,css}`；再掃 `index.html` | `src/data`、`src/ui`：0 筆。`index.html`：只命中 `src/solver/twophase.js` 的**程式註解與一則 Error 字串**（打包時一併帶入，見 Nit n-6），不是畫面文字；`Rubik` 全部 0 筆 |
| 7 | `grep -rn "localStorage\|sessionStorage\|indexedDB" src` | 只出現在 `src/ui/records.js`（第 24、27–29 行，都在 `try` 內）與 `src/ui/tutorial.js`（第 24–25、36–37 行，都在 `try` 內），**全部包在 try/catch** |
| 8 | Node 自驗 `arch-node.js nodes`，**另起兩個行程**各跑一次（seed 4242 的 25 個 random-state，`params.solver`） | 兩次雜湊相同：`f9587c62aecd1192db4a61ec3e18949509c00728`（`alg`、`nodes`、`complete` 全部相同） |
| 9 | Node 自驗 `arch-node.js replay`，兩個行程各跑一次（6 組、每組 60 個隨機 action，含真實求解器產生的 `HINT_READY`／`DEMO_READY`、`DEMO_STEP`、`SET_ORIENT`、`PAUSE`） | 兩次的 6 個最終 state 雜湊完全相同（`c121023c…`、`b5b98576…`、`355f2706…`、`51720849…`、`d9919f5d…`、`9d99ca64…`） |
| 10 | Node 自驗 `arch-node.js d12`（8 局，在 `HINT_REQUEST` 與結果之間插入 `ROTATE`） | 8／8 的 `hint.move` 等於「用請求當下的 orient 獨立重算」的結果，畫面記號也等於用目前 orient 換算後的結果（§6） |
| 11 | Node 自驗 `arch-node.js invalid` | 格式錯誤的記號會讓 `canApply` 回 true，`reduce` 卻拋出非 `REJECT` 的例外（Minor m-1） |
| 12 | Playwright 重現 `arch-repro.js`（Chromium 1194，`file://`，手機直向 390×844 與 iPad 橫向 1194×834 各跑一次） | B-1、B-2、B-3、m-2、K-1 在兩種視圖都重現，輸出見 §7 各項 |

- 未跑的項目：`npm run test:ui` 全套（S9 已連跑兩次、48／48 格通過，本次以 `arch-repro.js` 抽查）；真機 M-01～M-07 屬製作人本機驗收。

## 4. CLAUDE.md §3 五條逐條

| 原則 | 判定 | 證據與說明 |
|---|---|---|
| 1. 狀態只能透過 action 前進；engine 純函數；UI 不自己算規則 | **大致符合** | `reducer.js` 不改輸入，時間一律由 `at` 帶入（T-ENG-13、T-ENG-17）；不變式 INV-1～6 經 1,000 個隨機 action 驗證（T-ENG-14）；步數（`moveCount`）、復原判定（`status`／`result`／`recordEligible`）、提示座標（`hintView`、`hintLayer`）、示範進度（`demoInfo`、`demoNextLayer`）、轉哪一層（`layerStickers`、`gestureToMove`）、白話說明（`describeMove`）都取自 engine。**缺點**：UI 為了畫面自己判斷記號的轉向與旋轉軸（m-5）；`reduce` 與 `canApply` 對格式錯誤的記號判斷不一致（m-1）。 |
| 2. 隨機數來自 seeded RNG；同 seed 可重放 | **符合** | `src/` 與產物中 `Math.random` 都是 0 筆；打亂用 `rng.js`（xorshift32，T-ENG-11 鎖定範例字串）；seed 只在 `app.js` 第 156–165 行產生（先用 `crypto.getRandomValues`，不可用時才用 `Date.now`，符合 §5）；重放實測兩行程雜湊一致（§3 #9）。 |
| 3. 參數資料驅動 | **不符合（Major MJ-1）** | 求解、打亂、手勢、速度參數都讀 `params.json`；D-3 的 `DEFAULT_SOLVE_OPTS` 已裁決、也有測試比對。但 `keypad.showSubLabels`、`faceLabels.forceOnInTutorial` 兩個資料開關在程式中完全沒被讀到；`\|\| 180` 這類預設值會把資料檔中的 0 吞掉；4000／6000 ms 顯示時間與確認對話框文案寫死在程式裡。 |
| 4. 觸控優先（≥ 44 px、兩種視圖） | **不符合（Blocker B-3）** | T-UI-03 掃描的 6 個畫面都達標，但**提示卡顯示中**不在掃描範圍內。實測 `.hint-close` 為 32×32 px（兩種視圖都一樣）。兩種視圖的版面由 T-UI-15 驗證；手勢與記號鍵都能完成全部操作。 |
| 5. 零依賴、單一檔案、斷網可玩 | **符合** | `package.json` 只有 devDependencies 的 `playwright`（測試用）；產物沒有任何外連（§3 #5）；Worker 以 `new Blob([window.SOLVER_WORKER_SRC])` 產生（`solver-client.js` 第 66–92 行），入口那一行在 `build/bundle.js` 第 68–70 行；T-BUILD-02／03、T-UI-04（只有 2 個 `file://` 請求）都通過。 |

## 5. 重點項目逐條

| 重點 | 判定 | 證據 |
|---|---|---|
| engine／solver 無時鐘與瀏覽器 API（含註解） | 通過 | §3 #3、#4；T-ENG-24、T-SOL-04 |
| 同 seed 重放 | 通過 | T-ENG-12；§3 #9（含真實求解結果，兩個行程一致） |
| `nodeLimit` 可重現 | 通過 | 停止條件只有節點數，每 1,024 個節點檢查一次（`twophase.js` 第 45、650–657 行）；phase2Cap 重搜時節點數接續累計（第 767–772 行）；§3 #8 兩行程一致；T-SOL-03 直方圖與 G3 逐格相同 |
| Worker 以 Blob 產生、不外連 | 通過 | §4 第 5 條；`worker.js` 只匯出 `handleMessage`（X-6） |
| UI 未自行計算規則 | 大致通過 | §4 第 1 條；例外見 m-5（只影響畫面）、m-4 |
| 參數都在 `src/data/` | **未通過** | MJ-1 |
| 觸控 ≥ 44 px、兩種視圖 | **未通過** | B-3 |
| 零依賴 | 通過 | §4 第 5 條 |
| 畫面無「Rubik」「最佳解」「最少步」「最短」 | 通過 | §3 #6；T-UI-14（9 個畫面）、T-DATA-09 |
| localStorage 全部 try/catch | 通過 | §3 #7；T-UI-13（存取時拋例外仍能完成一局） |
| D-12 提示／轉視角順序 | 通過（有 1 項 Minor 建議） | §6 |
| K-1 影響評估 | 列 Minor，G4.5／G5 追蹤 | §8；§7 m-3 |

### 5.1 附錄 B（拍板對照表）逐列實作核對

| 附錄 B 列 | 實作狀態 |
|---|---|
| G0 CSS 3D | 符合（`cube-view.js` 使用 `preserve-3d` 與 `matrix3d`；iPad 破圖屬 M-01，UNKNOWN） |
| G0 求解器自己寫 | 符合（`twophase.js` 檔頭有 clean-room 註記；沒有第三方程式碼） |
| G0 v0.1＝M1＋M3 | 符合（沒有限步挑戰、每日挑戰、知識卡） |
| G0 QTM；建議解以 QTM 顯示 | 符合（`cube.qtmCost`；`twophase` 只建 QTM 表；T-ENG-06、T-SOL-03） |
| G0／G2 名稱「魔術方塊」、不得出現 Rubik's | 符合（`<title>`、`texts.title`；grep 0 筆） |
| G2 F-1～F-4 | **部分不符**：F-3 的失敗與取消流程卡住（B-1）；其餘符合 |
| G2 兩種示範都做；逐段互動教學留 v0.2 | 符合 |
| G2 中層 2／4 步 | 符合（T-ENG-06） |
| G2 提示標徽章；看過示範不列紀錄 | 符合（`recordEligible`、`records.js`；T-UI-08、T-UI-10） |
| G2 2D 展開圖、手動暫停鍵不做 | 符合 |
| G2 求解器在 `src/solver/`、節點上限、不讀時鐘、Worker | 符合（§5） |
| CLAUDE §1「建議解」命名 | 符合（`texts.demo.notShortest` 只用否定式說明） |
| CLAUDE §1 Worker 以 Blob 產生、不外連 | 符合 |
| CLAUDE §1 劃方塊轉層、方塊外或雙指轉視角、記號鍵備援 | **部分不符**：轉視角在非初始朝向時會出錯（B-2） |
| CLAUDE §3 五條 | **部分不符**：B-3、MJ-1（§4） |
| game-design §4 按提示或看示範時暫停計時 | 符合（T-ENG-17、T-ENG-18） |
| game-design §4 從第一個有效轉動開始計時 | 符合；有 1 個邊界競態（m-2） |
| game-design §11 等待文案不承諾秒數 | 符合 |
| spike §5 | 符合 |
| G3.5 版型 C | 符合（T-UI-15） |
| G3.5 記號教學 | 符合；`forceOnInTutorial` 沒有被讀取（MJ-1） |
| G3.5「建議解示範」命名 | 符合 |
| G3.5 拖曳放開後吸附 | **不符**：只有從朝向 0 開始時正確（B-2） |
| G3.5 撤銷扣回步數 | 符合（T-ENG-16、T-UI-02） |
| G3.5 層先法分段暫停卡片、公式用途 | 符合（T-UI-22、T-UI-21） |
| ui decision-log 備註 1～4 | 符合（`[hidden]` 規則、抽屜使用文件流、`id` 不重複） |

### 5.2 附錄 C（G3.5 修訂）逐項

| 修訂 | 實作 | 備註 |
|---|---|---|
| R-1 版型 C | 符合 | T-UI-15 |
| R-2a 記號小教室 | 符合 | T-UI-16、T-UI-17、T-ENG-26 |
| R-2b 副標、摺疊 | 大致符合 | `showSubLabels` 開關無效（MJ-1） |
| R-2c 面標籤 | 大致符合 | `forceOnInTutorial` 開關無效（MJ-1）；整顆轉高亮 52 格與規格寫的 54 格不同（m-9） |
| R-2d 白話說明 | 符合 | T-ENG-25、T-DATA-07、T-UI-21 |
| R-2e 分段暫停卡片、公式用途 | 符合 | T-UI-22 |
| R-3 建議解示範命名 | 符合 | T-UI-14、T-DATA-09 |
| R-4 視角吸附 | **不符** | B-2 |
| R-5 撤銷扣回 | 符合 | — |

### 5.3 ADR-001 對照

| ADR 決策 | 實作 | 備註 |
|---|---|---|
| 2.1 兩種求解器並存 | 符合 | `lbl.js` 沒有 require `twophase.js`（X-4） |
| 2.2 QTM 成本、只建 QTM 表 | 符合 | `checkInitOptions` 拒絕其他設定 |
| 2.3 表大小 10,939,101 bytes | 符合 | T-SOL-09 |
| 2.4 以節點數停止、不讀時鐘 | 符合 | §5；watchdog 放在 `solver-client.js`，由外部注入 `setTimer`／`now` |
| 2.5 Blob Worker、`handleMessage`、入口由 build 產生 | 符合 | — |
| 2.6 退回路徑 | 大致符合 | Worker 建不起來改走主執行緒（T-UI-12）、建表逾時轉 `failed`（C-09）、求解逾時重建 Worker（C-05）都有實作。**但「建議解示範改提供『改看層先法示範』」這條路徑因 B-1 實際上走不到**。ADR 對 NODE_LIMIT 仍寫「重建」，已由 D-9 改以規格為準，但 ADR 本文沒有更新（m-9） |
| 2.7 v0.1 不做最少步 | 符合 | `src/` 中 `solveOptimalQTM`、`randomQuarterScramble`、`timeLimitMs` 都是 0 筆 |

## 6. D-12（先送 HINT_REQUEST，再用新 state 求提示；等待中不轉視角）是否真的遵守

| 檢查點 | 結果 |
|---|---|
| `hint-view.js` 第 46–49 行 | 遵守：先 `dispatch(HINT_REQUEST)`，再用 `ctx.getState()` 的新 state 呼叫 `requestHint` |
| `demo-player.js` 第 214–220 行 | 遵守：`DEMO_REQUEST` 也是同樣順序（而且示範期間 reducer 本來就拒絕 `ROTATE`／`SET_ORIENT`） |
| `gesture.js` 第 86–93 行 | 遵守：`hint.pending` 時不接受任何手勢；S9 的 D-12 測試兩種視圖都通過 |
| `controls.js` 第 81–91 行（記號鍵 x／y／z） | **沒有攔截**：`hint.pending` 時 `canApply(ROTATE)` 為 true，按鍵照樣送出 `ROTATE`。D-12 的文字只點名 S8b，所以不算違反裁決 |
| 上一列的實際影響 | **無**。reducer 換算時用 `hint.orient`（`reducer.js` 第 400–405 行），`solver-client` 在送出請求當下就記住 orient（`solver-client.js` 第 494–499 行），兩者一致。§3 #10 實測 8／8 正確；其中 3 局（seed 3、5、8）若順序錯了，畫面會顯示不同的記號，可見正確的呼叫順序確實有差 |

- 結論：D-12 的核心順序已遵守，提示座標正確。建議把這條保證做成結構性的：由 reducer 在 `hint.pending` 時拒絕 `ROTATE`／`SET_ORIENT`，或在規格中寫明「等待中可以轉視角，換算以 `hint.orient` 為準」（m-4）。

## 7. 發現清單

### Blocker

**B-1　「建議解示範」取消後或求解失敗時畫面卡在等待中**
- 位置：`src/ui/demo-player.js` 第 223 行（`hintView.mapFailureCode(code)`）；第 9 行的註解也還寫著借用 `mapFailureCode`。
- 原因：S8e 依 D-19 從 `hint-view.js` 刪除了 `mapFailureCode`（該檔第 197–200 行現在只匯出 `mount`、`textByKey`），`demo-player.js` 沒有跟著改。只要結果是 `DEMO_FAILED`，`.then` 就會先拋出 TypeError，**`ctx.dispatch(resultAction)` 因此不會執行**，`state.demo` 會一直停在 `pending: true`。
- 重現（`arch-repro.js` r1，兩種視圖結果相同）：打亂 → 看電腦解 → 建議解示範 → 按「取消」。
  - 頁面錯誤：`pageerror: hintView.mapFailureCode is not a function`。
  - 取消 0.8 秒後與 3 秒後，`demo.pending` 都還是 `true`，等待卡片仍在；再按一次取消也沒有作用。
  - 這段期間轉動、撤銷、提示、記號說明都被擋住，只能按「重設」或「打亂」離開。
- 影響範圍：所有 `DEMO_FAILED` 都會卡住，包括 `CANCELLED`、`NODE_LIMIT`、`TIMEOUT`、`SOLVER_FAILED`、`INVALID_STATE`、`INTERNAL`。§9.4 的「取消」與 §9.6 的「這次沒算出建議解＋改看層先法示範」按鈕實際上都無法使用；層先法示範的取消也一樣。
- 漏測原因：S8e 的回歸腳本與 S9 的 T-UI-07／09 都沒有走失敗或取消的路徑。
- 建議修法：
  1. 改成 `ctx.solver.failureTextKey(code)`，刪掉 `require('./hint-view.js')` 對 `mapFailureCode` 的依賴（`textByKey` 可保留）。
  2. 先 `dispatch(resultAction)` 再處理畫面副作用，或把副作用包進 try/catch，確保單一 UI 錯誤不會讓 state 永遠停在等待中。
  3. 補 UI 測試：示範等待中按取消 → `demo === null`；用測試掛鉤讓 Worker 回 `NODE_LIMIT` → 出現「改看層先法示範」且可以按。

**B-2　方塊不在初始朝向時，轉視角的吸附結果錯誤（點一下方塊外就跳回初始朝向）**
- 位置：`src/ui/gesture.js` 第 190、225 行（拖曳矩陣每次都從單位矩陣開始，吸附時直接拿它比對 24 種朝向）；`src/ui/cube-view.js` 第 361–396 行（`nearestOrient`、`snapTo` 只接受「相對朝向 0」的絕對矩陣）。
- 原因：畫面平常是用貼紙顏色置換來表現目前朝向，`.cube-world` 永遠是單位矩陣（S8a「運作原理提醒」）。所以拖曳矩陣 D 代表的是「相對目前朝向」的旋轉，正確目標應該由 D 與目前朝向合成後再找最近的朝向；現行程式卻把 D 當成相對朝向 0 的絕對旋轉。S8b 回報「未預期發現」第 4 點已經懷疑過這件事，但沒有驗證。
- 重現（`arch-repro.js` r2，兩種視圖結果相同）：
  - 按記號鍵 `y` 後 orient 為 2；在方塊外點一下（沒有位移）→ orient 變成 **0**。
  - orient 0 時水平拖曳約 90° → orient 18；再做一次同樣的拖曳 → orient **仍是 18**，連續拖曳不會累加。
- 影響：違反 §9.3 與 R-4；觸控平台上的主要互動會出現畫面跳動，玩家無法靠連續拖曳看到其他面。T-UI-06、T-UI-23 都從朝向 0 開始測，所以沒有抓到。
- 建議修法（**推論，需以測試確認矩陣相乘的順序**）：
  - `cube-view.js` 在 BFS 中定義了 `CAMERA_ROT[orientAfter(o, r)] = R(r)·CAMERA_ROT[o]`，所以從朝向 o 拖曳 D 之後，目標應為 `o′ = nearestOrient(D·CAMERA_ROT[o])`。
  - 吸附動畫的終點應為相對矩陣 `CAMERA_ROT[o′]·CAMERA_ROT[o]ᵀ`，不是 `CAMERA_ROT[o′]`。
  - 做法：在 `ctx.view` 增加 `nearestOrientFrom(orient, D)` 與「相對吸附」的介面（屬 S8a 範圍的小修，X-8）。
  - 補 UI 測試：按 `y` 後在方塊外點一下，orient 不變；同方向連拖兩次，orient 依序改變，每次都驗證 54 格顏色與 `viewStickers` 一致。

**B-3　提示卡的關閉鈕 32×32 px（CLAUDE.md §3 第 4 條要求 ≥ 44×44）**
- 位置：`src/ui/demo.css` 第 34–38 行（`.hint-close { min-width: 32px; min-height: 32px; }`）；按鈕在 `hint-view.js` 第 141–150 行建立。
- 重現（`arch-repro.js` r3）：送出 `HINT_REQUEST`／`HINT_READY` 讓提示卡出現後，掃描全頁可見的可點元素。兩種視圖都只有 `hint-close` 不達標，實測 **32×32**。
- 漏測原因：T-UI-03 的 6 個掃描畫面沒有包含「提示卡顯示中」。
- 建議修法：改成 `min-width:44px; min-height:44px`（視覺上可以保留小的 ×，把點擊範圍放大），T-UI-03 補掃「提示卡顯示中」與「等待卡片顯示中」。

### Major

**MJ-1　資料開關無效、預設值吞掉 0、數值與文案寫死（違反 CLAUDE.md §3 第 3 條）**
- `params.keypad.showSubLabels`：在 `src/` 中沒有任何地方讀取。`controls.js` 第 101–104 行一律顯示副標，資料檔改成 `false` 不會有效果。
- `params.faceLabels.forceOnInTutorial`：沒有任何地方讀取。`tutorial.js` 第 376、389 行一律強制開啟面標籤（分派單 S8d 要求依此參數決定）。
- 用 `||` 設預設值，資料檔填 0 會被當成沒填：
  - `controls.js` 第 88 行（`turnAnimMs || 180`）、第 310 行（`|| 100`）；
  - `app.js` 第 171 行（`scrambleAnimMsPerMove || 60`）；
  - `gesture.js` 第 71–72 行；
  - `demo-player.js` 第 58 行（`animRatio || 0.8`）。
  - 例如把 `turnAnimMs` 或 `scrambleAnimMsPerMove` 設成 0 想關掉動畫，實際仍是 180／60 ms。
- 寫死在程式裡的數值：`hint-view.js` 第 75 行 4000 ms、`demo-player.js` 第 64 行 6000 ms（失敗訊息的顯示時間）。
- 寫死在程式裡的文案：`controls.js` 第 54 行「？目前這一局還沒完成，會直接重新打亂。」不在 `texts.json`，game-designer 無法修改。
- 建議修法：
  - 兩個開關接上程式，或由 systems-engineer 從規格刪除（需要裁決，§11）；
  - 預設值改用 `typeof v === 'number' ? v : 預設`；
  - 兩個顯示時間移到 `params.ui`，確認文案移到 `texts.buttons` 或新增 `texts.confirm`（需先修訂規格 §10）；
  - `T-DATA-04` 或新增測試：確認 `params` 中每個鍵都有程式在讀。

**MJ-2　本機最佳紀錄只寫不讀（F-5 的目的沒有達成）**
- 位置：`src/ui/records.js` 第 87–101 行只寫入 `cube3x3.records.v1`；`texts.hud.best`（「最佳」）在 `src/ui/` 中沒有任何引用。畫面上從來不顯示最佳時間或最佳步數，只有破紀錄時出現「新紀錄」徽章。
- 依據：`game-design.md` 第 29 行要讓玩家「自己跟自己比」；§6.4「不可用時：不顯示紀錄」也意味著正常情況要顯示。
- 規格缺漏：§11.1 狀態列與 §6.3 完成畫面都沒有寫明最佳紀錄要顯示在哪裡，屬 systems-engineer 的缺漏。
- 建議：在完成畫面加一行「最佳：m:ss.s／N 步」（或放在狀態列）。規格修訂需要製作人確認位置（§11）。

### Minor（9 項）

| # | 位置 | 問題與證據 | 建議 |
|---|---|---|---|
| m-1 | `src/engine/reducer.js` 第 126–150、191–196、217–222、307–309 行；`cube.js` 第 228–234、418–440 行 | `kind()` 只看第一個字元，所以 `TURN 'R3'`、`TURN 'R’'`、`ROTATE 'xx'`、`HINT_READY ['R9']` 都會讓 `canApply` 回 true，`reduce` 卻拋出 `toHome: 未知記號`、`Cannot read properties of undefined` 等**非 REJECT** 的例外（§3 #11）。`DEMO_READY` 完全不檢查 tokens；`NEW_GAME` 沒帶 `data` 時拋 TypeError；匯出的 `SOLVED`、`MOVES` 等陣列沒有凍結。正常 UI 流程觸發不到，但不符合 §4「前置條件不成立 → REJECT」與 T-ENG-22 要求的一致性，而 app.js 對非 REJECT 例外會直接往外拋 | 前置條件改用 `MOVE_SET.has`（或讓 `describeMove` 不拋錯）檢查，`DEMO_READY` 逐一檢查 tokens，`NEW_GAME` 檢查 `data.params.scramble.length`，匯出常數以 `Object.freeze` 凍結；T-ENG-22 加入格式錯誤的輸入 |
| m-2 | `src/ui/controls.js` 第 81–91 行、`gesture.js` 第 173–177 行（先播動畫，播完才 dispatch，期間不再檢查）；`app.js` 第 193–196 行 | 按 `R` 後 180 ms 內按「打亂」，新局一開始就帶著 1 步 `R`，而且**計時已經開始**（`arch-repro.js` r4：`historyLen 1`、`timer running`，兩種視圖都一樣）。打亂動畫期間的鎖也擋不住這個已排好的 dispatch，最佳時間因此可能把動畫時間算進去 | 送出 `NEW_GAME`／`RESET` 時取消待送的動畫動作（世代計數器），或 dispatch 前重新檢查 `input.locked()` 與 `version` |
| m-3 | K-1：`controls.js` 第 82 行、`gesture.js` 第 87 行、`demo-player.js` 第 157、168 行 | 動畫期間的點擊一律丟棄。實測間隔 60 ms 連點 `R` 兩次，只轉了 1 次（r4 `k1`：`appliedTurns 1`）。影響評估見 §8 | 列入 G4.5 審查包與 G5 |
| m-4 | `src/ui/controls.js` 第 81–91 行 | 等待提示時，記號鍵 x／y／z 仍會送出 `ROTATE`。實測無害（§6），但 D-12 的保證靠的是「reducer 用 `hint.orient`」這個隱性前提 | reducer 在 `hint.pending` 時拒絕 `ROTATE`／`SET_ORIENT`，或在規格 §4 寫明 |
| m-5 | `src/ui/cube-view.js` 第 15–25、78–83 行；`notation.js` 第 24–28 行；`gesture.js` 第 81–84 行；`controls.js` 第 20–23 行 | UI 自己維護一份旋轉軸表與轉向判斷（`AXIS`、`turnOf`、`turnOfMoveString`、`faceLetterOf`），與 engine 的 `BASE_DEF`、`describeMove` 重複。目前只影響動畫方向與鍵盤分組，最終畫面仍以 engine 為準；但日後改 engine 慣例時容易兩邊不一致（§11.4 不得自行判斷「記號屬於哪一類」） | 轉向改用 `engine.describeMove(m).turn`；由 engine 匯出唯讀的旋轉軸表；面序改用 engine 匯出的常數 |
| m-6 | `src/ui/records.js` 第 104–156、196–221 行 | 無輔助完成時出現全螢幕遮罩，上面只有「再來一局」。玩家無法關閉遮罩查看復原後的方塊，也無法按「重設」或整顆轉（§3.6 規定 solved 狀態可以做這些） | 加上「關閉」或「看看方塊」按鈕（≥ 44 px） |
| m-7 | `tests/ui/`（S9） | 本次 3 項 Blocker 都落在測試沒涵蓋的地方：示範失敗與取消、從非初始朝向拖曳、提示卡的觸控尺寸 | 依 B-1～B-3 補測試；T-UI-03 的掃描畫面加入「提示卡」「等待卡」「完成遮罩」 |
| m-8 | `src/ui/tutorial.js` 第 97–141 行、`records.js` 第 105–179 行 | 直接使用全域 `document`／`window`，沒有用 `ctx.root.ownerDocument`，`createApp(win, doc)` 的注入設計因此不完整 | 改用 `ctx.root.ownerDocument` 與注入的 `win` |
| m-9 | 文件不同步：`docs/spec/ADR-001-solver.md` 第 76 行（NODE_LIMIT 仍寫「重建」）、第 108 行（仍寫 300 KB）；`CLAUDE.md` 第 62 行（仍寫 300 KB）、第 66 行（`npm run preview` 在 `package.json` 中不存在，X-12 仍未處理）；`game-spec.md` 第 1060 行（整顆轉「高亮全部 54 格」，但實作用 `layerStickers`，只有 52 格，見 S8d 第 4 點） | 會誤導 G4.5 的外部審查者 | 依 ADR 規則另開 ADR-001a（或補註）記錄 D-9、D-13；CLAUDE.md 由製作人改；規格 §11.3 用詞改成「高亮該記號會移動的貼紙」，或讓教學改用 `demoNextLayer` 的同款規則 |

### Nit（8 項）

| # | 位置 | 說明 |
|---|---|---|
| n-1 | `index.template.html` 第 27、38、76 行；`hint-view.js` 第 145 行；`demo-player.js` 第 398、406 行；`records.js` 第 184 行 | `<title>`、`?`、`aria-label="記號鍵盤"`、`×`、`✓ `、全形括號寫死在程式或樣板中（`<title>` 與 `texts.title` 內容相同） |
| n-2 | `src/data/texts.json`、`params.json` | 沒有被使用的鍵：`free.solvedHint`（規格寫「可」顯示）、`notation.lessonTitle`；`params.ui.minTouchPx`（CSS 直接寫 44px） |
| n-3 | `demo-player.js` 第 9 行、`gesture.js` 第 8 行 | 註解過時（仍提到 `mapFailureCode`；D-18 之後 `.hint-slot` 已不在 `.cube-scene` 裡面） |
| n-4 | `src/ui/app.js` 第 58 行 | 分派單寫 REJECT「只記錄不崩潰」，實作是完全不記錄就回傳，除錯時看不到被拒絕的 action |
| n-5 | `docs/spec/checks/` | 與 `scratch/g3-check/` 重複（S1 已提出，尚未處理） |
| n-6 | `src/solver/twophase.js`（第 10、649、736、742、749 行的註解，以及第 560 行 `checkInitOptions` 的 Error 字串） | 含「最少步」「最佳解」字樣，打包後會進入 `index.html`。T-UI-14 允許程式註解使用這些字，Error 內容也不會顯示在畫面上；外部審查者 grep 時可能誤判，記錄備查 |
| n-7 | `src/ui/solver-client.js` 第 72–91 行 | Blob URL 只在 `terminate` 時才釋放；Worker 建立後就可以 `revokeObjectURL` |
| n-8 | 流程 | S8e 修改了 S8a 的回報檔 `docs/reports/T-001-S8a.md`（有備份），超出「每段只寫自己的回報」的慣例 |

## 8. K-1 影響評估（動畫中的點擊直接丟棄）

- **實測**：間隔 60 ms 連點兩次 `R`，只套用 1 次（r4 `k1`）；`turnAnimMs` 為 180 ms。手勢、示範的「上一步／下一步」也採用同一個「忙碌中就丟棄」規則。
- **對正確性的影響**：沒有。state 始終一致，步數、復原判定、提示座標都不受影響；被丟棄的點擊不會產生半套狀態。
- **對體驗的影響**：
  - 想快速按兩次 `R` 做出 180°，結果只轉 90°，而且畫面沒有任何提示；
  - 照著打亂字串或示範記號輸入時，容易悄悄少轉一步，對「學習用」定位的傷害比對速解玩家大；
  - S9 的 T-UI-10 必須加上重試才能穩定通過，這也從側面證明了這個問題。
- **相關缺陷**：m-2 與 K-1 是同一個設計（先播動畫、播完才 dispatch）造成的。修 K-1 時建議一起處理。
- **建議選項（交 G4.5 外部審查與 G5）**：
  - (a) 建立輸入佇列（上限約 2～3 個），取出時重新檢查 `canApply`，遇到 `NEW_GAME`／`RESET` 或上鎖時清空；
  - (b) 新輸入到來時，讓目前的動畫立即播完，再處理新輸入；
  - (c) 先 dispatch、再補播動畫。
- **嚴重度**：Minor，不擋 G4.5。建議在審查包列為必問題目。

## 9. 未預期發現

1. `node build/bundle.js` 會覆寫 repo 根目錄的 `index.html`（本次重建前後 sha256 相同，沒有實際變更）。之後的審查者若只想驗證決定性，可以只用 `--out <scratch 路徑>`。
2. B-1 是 S8e 整合修正（D-19）造成的回歸：刪除共用函式時沒有搜尋其他呼叫端，而 S8e 的「D-17 去 bypass 版」回歸腳本只走成功路徑。建議日後刪除任何匯出之前，先 `grep -rn <名稱> src tests`，並列入回報範本。
3. 環境描述寫「不是 git repository」，S9 回報也寫「執行環境無 git」，但 `git -C /home/claude/cube-3x3 status` 實際回報 `On branch main, nothing to commit, working tree clean`。本次只做了這一次唯讀查詢，沒有其他 git 操作。
4. 其他：
   - `docs/spec/checks/` 重複目錄（n-5）仍存在；
   - `src/ui/` 下有 8 個 `.backup.20260915*` 檔（已列入 `.gitignore`，不進 bundle，不影響產物）。

## 10. 回 G4 的修正範圍與回歸要求（建議）

| 項目 | 負責 | 驗收 |
|---|---|---|
| B-1 | S8c 範圍（`demo-player.js`） | 新增 UI 測試：示範等待中取消、Worker 回 `NODE_LIMIT` 時出現「改看層先法示範」並可進入層先法示範；兩種視圖都跑；0 個 pageerror |
| B-2 | S8a（`cube-view.js` 增加 `ctx.view` 能力）＋ S8b（`gesture.js`） | 新增 UI 測試：從非 0 朝向點一下，orient 不變；連續兩次拖曳會累加；吸附後 54 格顏色與 `viewStickers` 一致；原有 T-UI-06、T-UI-23 仍通過 |
| B-3 | S8c（`demo.css`） | T-UI-03 補掃「提示卡」「等待卡」，0 筆不合格 |
| MJ-1 | S8a／S8d；systems-engineer 先裁決兩個開關的去留與新增欄位 | 資料鍵都有程式讀取的測試；把 `turnAnimMs` 設為 0 時動畫確實關閉 |
| MJ-2 | systems-engineer 補規格 → S8d | 完成畫面（或狀態列）顯示最佳紀錄；儲存不可用時不顯示 |
| 其餘 Minor | 視時間處理；m-1、m-2 建議同一輪修 | — |
| 回歸 | game-engineer | `node --test "tests/engine/**/*.test.js"`、`node build/bundle.js`、`npm run test:ui` 各跑一次（UI 連跑兩次）；完成後送回 systems-engineer 複審 B-1～B-3 與 MJ-1～MJ-2 |

## 11. 需要製作人決定的事

1. **是否同意退回 G4 修正**（本審查建議：同意；3 項 Blocker 修法都很小，預估 0.5～1 session）。
2. **MJ-2 最佳紀錄的顯示位置**：(A) 只放完成畫面（建議）；(B) 狀態列常駐顯示「最佳」；(C) 兩處都放。
3. **MJ-1 兩個資料開關**（`keypad.showSubLabels`、`faceLabels.forceOnInTutorial`）：(A) 保留並把程式接上（建議）；(B) 從規格與資料檔刪除。
4. **K-1**：維持「交 G4.5 外部審查與 G5」即可，不擋本輪；若希望本輪一起修，建議採 §8 的選項 (a)。
