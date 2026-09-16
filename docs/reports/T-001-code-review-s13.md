# 回報：T-001 code-reviewer（S13 複審：G5 本版修正 D-35／D-36）

| 欄位 | 內容 |
|---|---|
| 角色 | code-reviewer（唯讀；本檔是唯一寫入的檔案） |
| 任務 | T-001 v0.1，S13 複審（QA Minor-1、上一輪 m-2、m-3；幕僚長 D-36） |
| 日期 | 2026-09-16 |
| 審查基準 | `git diff 91e8904..fb33b96 -- src tests`（9 個檔案，+808／−52；commit `fb33b96`） |
| 輸入文件 | CLAUDE.md §3、`docs/reports/T-001-code-review.md`（m-2、m-3）、`docs/reports/T-001-S13.md`、`docs/reports/T-001-arch-decisions.md`（D-35、D-36） |

---

## 1. 判定

# **通過**

- **Blocker 0、Major 0、Minor 3。** 上一輪的 m-2、m-3 都已修正，修法正確；新測試在修正前會失敗、修正後通過，確實測到問題。3 項 Minor 都不影響 engine state，也不違反 CLAUDE.md §3，不擋發布。
- 委託人指定的五個重點，結論如下（細節見 §3）：
  1. **收尾函式的涵蓋範圍**：`finally`／收尾函式在所有結束路徑都會執行。重複解除只會發生在同一個 owner（`'view-drag'`）上，而且 `release` 是冪等操作。「前一次吸附的遲到 release 解除了下一次拖曳的暫停」這個情況不會發生，因為吸附期間 `anim.busy()` 為 true，新手勢無法開始。
  2. **lostpointercapture 與文件層級監聽**：不會重複處理，也不會誤觸。正常放開時 session 已先清空；我也用 Chromium 觸控模擬實測過隱含 capture 的轉移，貼紙上不會出現 lostpointercapture。監聽器在頁面生命週期內只掛一次，沒有洩漏。
  3. **遲到結果**：主執行緒的逾時與取消都經過 `finish()` 的 `job.done` 防護，遲到的結果不會交給呼叫端，也就不會寫進 state。
  4. **取消備援**：hint-view／demo-player 的取消備援不會送出重複的 CANCELLED，也不會產生 REJECT。
  5. **新測試**：確實測到問題（見 §3.5），只有 D-36 的 11px 沒有被測試鎖住（m-2）。
- 我重跑了指定的 Node 測試：24/24 通過。`check-forbidden.sh` exit 0。依指示，沒有跑 UI 測試，也沒有跑 `node build/bundle.js`。

---

## 2. Findings（依嚴重度）

### Blocker
無。

### Major
無。

### Minor

**m-1　主執行緒 watchdog 只能救回「排程遺失」後的第一個 job；之後的請求既不會執行，也沒有 watchdog**

- 位置：`src/ui/solver-client.js:331-346`（`pumpMain` 在 `mainTimer !== null` 時直接 return，watchdog 只在這個函式的尾端登記）、`319-328`（`armMainWatch` 逾時後沒有處理卡住的 `mainTimer`）
- 問題：watchdog 要防的情境是「0 ms 的排程計時器一直沒有執行」。這時 `mainTimer` 會一直保持非 null。第一個 job 由 watchdog 退回後，下一次 `submit` 會呼叫 `drainQueue`，接著呼叫 `pumpMain`，但 `pumpMain` 在第一行就 return。結果是新 job 不會被排程，也不會登記 watchdog，Promise 永遠沒有結果。
- 失敗情境（實證，scratchpad `cr13/c.test.js` 的 CR13-A，沿用 C-17 的 `lossyClock`）：
  - 第一個提示在 `solveTimeoutMs` 後得到 `HINT_READY`（層先法），符合預期。
  - 第二個提示送出後，`clock.pending()=0`（沒有任何計時器）；時鐘再推進 10 倍 `solveTimeoutMs`，Promise 仍然沒有結果。
  - 只有按「取消」才能離開（`cancel()` 回傳 CANCELLED），所以不會卡死。前提是計時器真的遺失，實際機率很低；但這正是 watchdog 存在的理由，而檔頭註解寫「保護的是 job 排了程卻一直沒有結果」，會讓人以為每個 job 都有保護。
- 建議：
  - watchdog 改在 job 放進佇列時登記（`submitInner` 或 `drainQueue`），不要依附在「這次有沒有新排程」上。
  - watchdog 觸發時，如果發現 `mainTimer` 還在（代表排程沒有執行），就清掉 `mainTimer` 並重新 `pumpMain()`。
  - C-17 在同一個 client 上補一段「第二個請求」的斷言。

**m-2　D-36（手機直向副標 11px）沒有被 UI 測試鎖住；360 寬與 1000–1099 寬只在 scratch 腳本量過**

- 位置：`tests/ui/checks5.js:112-113`（手機視圖的門檻是 `minFs >= 10`）、`tests/ui/smoke.spec.js:54-57`（只有 390×844、1194×834 兩種視圖）
- 問題：D-36 把手機直向改為 11px，但 T-UI-36 在手機上只要求 ≥10px。另外，D-36 的依據「360 寬不換行」和 S13 的「1024 寬 12px 不換行」，都只存在 `scratch/` 的量測腳本裡，沒有進版控測試。
- 失敗情境：
  - 有人把 `styles.css:202-205` 的 portrait 區塊刪掉，或把字級改回 10px，T-UI-36 仍然通過。
  - 日後調整 `.kp` 內距，導致 360 寬或 1024 寬換行，現有測試抓不到。
- 建議：
  - T-UI-36 的手機門檻改為 ≥11px（或直接斷言等於 D-36 的值）。
  - 用 `page.setViewportSize` 在同一個 check 內追加 360×780 與 1024×768 兩個寬度，只檢查「不換行、不截字、≥44×44」。這樣不必增加整套視圖。

**m-3　兩處註解與 D-36 矛盾，會誤導維護者**

- 位置：
  - `src/ui/styles.css:191-192`：S13 區塊寫「手機直向……維持 10px 不變」，但同檔 `202-205` 的 D-36 區塊已改為 11px。
  - `tests/ui/checks5.js:112`：寫「手機直向維持原字級」。
- 問題：讀者只讀第一段註解，會以為手機仍是 10px，而且放大就會換行。實際上，換行的條件是「原內距＋12px」，不是「任何放大」。
- 失敗情境：維護者依註解判斷「手機副標不能動」，或在排查手機字級時被誤導。
- 建議：把 S13 區塊的手機說明改為「手機直向見下方 D-36（11px＋內距 2px）」，並同步修改 checks5.js 的註解。

---

## 3. 逐項審查紀錄

### 3.1 R-m2：`src/ui/gesture.js`

各結束路徑是否都會放行佇列：

| 路徑 | 放行的位置 | 結果 |
|---|---|---|
| 正常放開、吸附成功 | `afterSnap` 的 `finally` | 放行 |
| `onSnapped` 內的 `dispatch` 丟例外 | `afterSnap` 的 catch 呼叫 `clearDrag`，再由 `finally` 放行；例外被吞掉，不會產生未處理的 rejection | 放行 |
| 吸附 Promise 被拒絕 | `abortViewDrag`（放行寫在 `finally`） | 放行 |
| `snapFrom`／`nearestOrientFrom`／`getState` 同步丟例外 | `finishViewSession` 的 catch 呼叫 `abortViewDrag` | 放行 |
| `onPointerUp` 本身意外中斷 | `finally` 先 `endSession`，再依 `!finished` 呼叫 `abortViewDrag` | 放行 |
| pointercancel（舞台或文件）、lostpointercapture、visibilitychange 轉為 hidden | `abortSession` 呼叫 `endSession`，再呼叫 `abortViewDrag` | 放行 |
| 轉層手勢被第二指改成轉視角 | 之後與一般轉視角相同 | 放行 |

以下是容易出錯的地方，逐一確認過：

- **會不會重複解除別人的暫停**：
  - `hold` 在整個 `src/` 只有 gesture.js 使用，owner 固定是 `'view-drag'`，而 `release` 是 `delete` 加 `pump`，屬於冪等操作。
  - 重複 release 唯一可能造成傷害的時機，是「前一次吸附還沒結束，新的轉視角已經 hold」。這不會發生：`snapFrom` 經由 `withBusy` 讓 `anim.busy()` 維持 true，直到 busyCount 遞減；`afterSnap` 的回呼是串在同一個 Promise 後面的 microtask，中間不可能插入 pointer 事件（pointer 事件是 task）。在這段期間，`canGestureStart()` 因為 `input.idle()` 為 false 而拒絕新手勢。
  - `handleSecondPointer` 需要已存在的 session，而 pointerup 之後 session 已經是 null。
  - 在 `onPointerUp` 中，`finishViewSession` 內部的例外都已經被接住，`afterSnap` 是最後一行，所以 `finished=false` 與 `afterSnap` 已排程不會同時成立，不會出現兩條 release 路徑互相競爭。
- **會不會重複處理或誤觸**：
  - `endSession` 先把 session 設為 null，再 `releasePointerCapture`，所以同步或非同步到達的 lostpointercapture 都會被略過。
  - 舞台上的 pointerup 冒泡到文件層級時，session 已經是 null，文件層級的處理器直接略過。T-UI-34g 驗證了這點：吸附只發生一次。
  - 第二指的 up／cancel 事件因為 pointerId 不同而被略過。
- **lostpointercapture 是會冒泡的事件**：
  - 如果子元素（貼紙）持有 capture 後失去，事件會冒泡到舞台並中止手勢。我在 Chromium（Playwright chromium-1194，400×400 測試頁）以觸控模擬（CDP `Input.dispatchTouchEvent`）實測（scratchpad `cr13/probe.js`）：pointerdown 時貼紙的 `hasPointerCapture=true`（隱含 capture 還在 pending），經 `scene.setPointerCapture` 覆寫後，只有舞台收到 got／lost，貼紙沒有收到 lostpointercapture；滑鼠的結果相同。
  - WebKit 依規格同樣是「pending override 被覆寫」，理論上結果相同，但沒有實機驗證（見 §5）。目前 `src/` 沒有其他地方呼叫 `setPointerCapture`。
- **洩漏**：文件層級新增的 3 個監聽器，和原本的 `pointerdown` 一樣只在 `mount` 時掛一次，頁面生命週期內不會重複 mount，因此不構成洩漏。
- **行為變化**：沒有取得 capture、但放開位置落在舞台外的轉層手勢，現在會在文件層級正常送出轉動。這與有 capture 時的行為一致，屬於合理的修正。

### 3.2 R-m3：`src/ui/solver-client.js`

- `lblOnMain`、`runOnMain` 的 try/catch，以及 `pumpMain` 的 `finally`：求解器、層先法或 `acceptSolve` 丟例外時，一律以 INTERNAL 結束，後面的 job 照常處理。`solveOnMain` 內建表失敗轉 failed 的原有流程沒有被改壞。
- `submit` 包成外層 try/catch：job 建立前出錯，回傳 INTERNAL；建立後出錯，先從佇列移除，再 `finish(INTERNAL)`；已結束的 job 保留原本的結果；`current` 由 `finish` 清空。逐一檢查過各個可能丟例外的點（`solverInput`、快取查詢、`start`／`boot`、`pumpWorker` 的 `setTimer`、`pumpMain` 的 `setTimer`），都不會留下「Promise 永遠沒有結果、`current` 卻已清空」的狀態。
- **遲到結果**：watchdog 觸發後，`fallback` 呼叫 `finish`，把 `job.done` 設為 true；之後遲到的 0 ms 排程會被 `!job.done` 擋下。取消時，`finish` 清除 watchdog，已取消的 job 由 `pumpMain` 的 shift 略過。主執行緒上的計算是同步的，watchdog 不可能在計算途中觸發。reducer 另外還有 `version` 的 stale 檢查。結論：遲到的結果不會寫進 state。
- watchdog 只在 mainThread 模式下登記；mainThread 不會再切回 Worker，所以不會有「Worker 路徑的 job 身上還掛著主執行緒 watchdog」的情況。轉入 failed 時，`drainQueue` 呼叫 `finish`，一併清除 watchdog。`dispose` 也會清除。
- 缺口見 m-1。

### 3.3 取消備援：`src/ui/hint-view.js`、`src/ui/demo-player.js`

- `cancel()` 回傳非 null 時，UI 直接 return，由原本請求的 `.then` 送出那一個 CANCELLED。回傳 null 時，client 已經沒有未結束的 job：
  - 快取命中、ALREADY_SOLVED、failed 模式、`submit` 例外這幾條路徑，回傳的都是已 resolve 的 Promise，對應的 `.then` 在 microtask 中執行，早於下一次點擊（task）；
  - 其餘情況則是 job 已經 `finish`。

  所以不會有第二個 CANCELLED 或結果晚到。
- 備援的 dispatch 前會先檢查 `canApply`，所以不會產生 REJECT。
- reducer 在等待中會拒絕 RESET、NEW_GAME、TURN，而 HINT_REQUEST 與 DEMO_REQUEST 互斥，所以不會出現「client 的 `current` 屬於另一種請求或舊版本」的情況，導致取消錯對象。
- 可以真正走到備援的情境，就是 S13 報告 §4-6 提到的：hint-view 的 `showFailure` 在 dispatch 之前丟例外。

### 3.4 CSS（Q-1、D-36）：`src/ui/styles.css`

- 只改了字級與左右內距，`min-width`／`min-height: 44px` 沒有變。兩段 landscape media query 的先後順序正確（≥1100 的規則寫在後面，會覆蓋 ≥1000 的規則）。portrait 區塊也會套用到 iPad 直向，那個版面的鍵很寬，沒有問題。
- 沒有外部資源，也沒有 hover 依賴。註解矛盾的問題見 m-3。

### 3.5 測試品質

- `tests/engine/gesture.test.js`（T-UI-34a～g）：使用真正的 `createInputQueue` 與 engine，以 cursor 從 0 變成 1、`queueSize` 變成 0 作為斷言，確實驗證了「佇列有放行」，而不只是「沒有丟例外」。T-UI-34b 先斷言暫停期間 `queueSize=1`，排除了「本來就沒有暫停」的假陽性。S13 報告 §3.3 列出修正前有 6 項會失敗，與程式碼的對應關係吻合。
  - 限制：假事件目標不會冒泡，所以沒有涵蓋「子元素的 lostpointercapture 冒泡到舞台」的情境（我已用 Chromium 另外驗證，見 §3.1）。
- `client.test.js`（C-14～C-17、C-08）：涵蓋了上一輪 m-3 的重現情境、failed 模式的同步例外、主執行緒取消、watchdog。C-16 也斷言了 watchdog 會被清除。缺口是 C-17 沒有測同一個 client 的第二個請求（m-1）。
- `tests/ui/checks5.js`（T-UI-35～37）：
  - T-UI-35 以合成事件重現上一輪的 reproB，並斷言 R 生效。
  - T-UI-37 直接 dispatch 請求，讓 `cancel()` 回傳 null，確實走到備援分支。
  - T-UI-36 的門檻問題見 m-2。
- 執行結果（本輪自跑）：`node --test tests/engine/gesture.test.js tests/engine/solver/client.test.js` 共 24 項，24 項通過，0 項失敗。

### 3.6 CLAUDE.md §3 逐條核對

1. **action 前進**：engine 沒有改動。UI 的備援一律先檢查 `canApply` 再 dispatch，沒有自行計算規則。符合。
2. **seeded RNG**：diff 中沒有 `Math.random`。符合。
3. **資料驅動**：watchdog 的時限讀自 `params.solver.solveTimeoutMs`。CSS 的字級與斷點屬於版面樣式，不是平衡數值。符合。
4. **觸控優先**：44×44 沒有變；新增的處理都是觸控與指標事件，沒有依賴 hover 或鍵盤。符合。
5. **零依賴**：沒有新增外部資源。`check-forbidden.sh` exit 0。符合。

---

## 4. 審查範圍

- `git diff 91e8904..fb33b96 -- src tests`，逐行讀過：
  - `src/ui/gesture.js`、`solver-client.js`、`hint-view.js`、`demo-player.js`、`styles.css`
  - `tests/engine/gesture.test.js`、`tests/engine/solver/client.test.js`、`tests/ui/checks5.js`、`tests/ui/smoke.spec.js`
- 為了判斷上下文，讀過的全檔或段落：
  - `gesture.js` 全檔
  - `solver-client.js` 第 60～675 行
  - `app.js` 的 `createInputQueue`、`dispatch`、`input` 物件
  - `cube-view.js` 的 `withBusy`、`animateWorldTo`、`snapFrom`、`clearDrag`
  - `reducer.js` 的 HINT／DEMO 前置條件
  - `hint-view.js` 的 `requestHint`、等待卡片
  - `demo-player.js` 的 `requestDemoKind`、`buildWaitCard`
- 執行過的指令（唯讀）：
  - `node --test tests/engine/gesture.test.js tests/engine/solver/client.test.js`：24/24 通過
  - `bash .claude/hooks/check-forbidden.sh`：exit 0
  - scratchpad 探針 `cr13/probe.js`（Chromium 觸控與滑鼠的 capture 事件順序）
  - scratchpad 探針 `cr13/c.test.js`（CR13-A，m-1 的重現）
- 沒有修改工作區；沒有 commit。

## 5. 未審查到的部分

- **UI 測試（T-UI-35～37，以及整套 35 項 × 2 視圖）**：依指示沒有跑，通過與否以 S13 報告與幕僚長 D-36 的紀錄為準。
- **建置**：沒有跑 `node build/bundle.js`，也沒有用 `--out` 建置，所以沒有核對產物大小與 sha256。
- **iPad Safari（WebKit）實機**：
  - 隱含 capture 被覆寫時，會不會對貼紙發出 lostpointercapture（會冒泡到舞台並中止手勢）。只依規格推論，並在 Chromium 驗證過。
  - PingFang TC 下副標的實際字寬。
  - 以上兩項都是 UNKNOWN，建議 QA 上實機時一併確認：在貼紙上轉層、在方塊外拖曳轉視角，都要能正常完成。
- `docs/`、`build/`、根目錄 `index.html`：不在本次 diff 範圍內。
- 上一輪的 m-1、m-4、m-5：依 D-35 延到下一版，本輪沒有複查。

## 6. 未預期發現

1. **手勢的強化建議**：lostpointercapture 會冒泡，建議 `onPointerAbort` 在處理 lostpointercapture 時只接受 `e.target === scene` 的事件，把「子元素失去 capture」的冒泡事件排除在外。目前的 Chromium 實測沒有觸發這個情況，所以不列為 finding。但如果 WebKit 的實作與規格不同，現在的寫法會讓每一次觸控手勢在開始後立刻被中止，而修法只需要一行。
2. `docs/reports/T-001-S13.md` 的 §2.1 與 §5 仍寫「手機維持 10px」，已被 D-36 取代。那是工程師的報告，不在本角色的修改範圍內，只在這裡記錄。
