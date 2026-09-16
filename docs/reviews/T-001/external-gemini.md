# 外部審查原文：Gemini（製作人於 2026-09-16 貼回；模型版本 UNKNOWN，製作人未註明）

> 以下為製作人貼回的原文結論部分，未改動。Gemini 以檔案工具逐段讀取 4 個審查包，並在製作人本機執行 `node --test "tests/engine/**/*.test.js"`（其回報 89 pass／0 fail）。工具操作紀錄（Viewed／Ran command 等約 150 行）未收錄。

**bug 清單**

| 編號 | 嚴重度 | 檔案:行號 | 問題（一句話） | 失敗情境 | 建議修法（方向） |
|---|---|---|---|---|---|
| E-1 | Major | `src/ui/cube-view.js:360-369` | `previewTurn` 遇到整顆旋轉記號（`x`、`y`、`z`）時仍呼叫局部層轉動的 `turn()`，導致動畫期間兩側中心塊未被納入旋轉層而懸空脫落。 | 使用者開啟新手教學或記號小教室第 6 步（`id: "rotation", demo: "x"`）時，方塊播放 `x` 示範動畫；因 `turn()` 呼叫 `engine.layerStickers('x')` 排除旋轉軸上的 R、L 中心貼紙，兩側中心塊留在原地不動，其餘 24 個 cubie 旋轉，造成方塊破圖分裂，動畫結束時才瞬間跳回。 | 在 `previewTurn` 內判斷 `engine.kind(viewMove) === 'rotation'`，若是整顆旋轉改呼叫 `rotateWholeCube(viewMove, ms)`（或 `ctx.anim.rotate`），而非 `turn(viewMove, ms)`。 |
| E-2 | Major | `src/ui/cube-view.js:364-369` | `previewTurn` 動畫尚未結束若呼叫 `clearPreview()`，非同步回呼仍會覆寫畫面貼紙，導致過期預覽貼紙殘留。 | 在新手教學、小教室或打亂動畫播放期間，若使用者在轉動動畫尚未完成時點擊「跳過教學」、「關閉」或快速點擊「下一步」，`clearPreview()` 會同步將貼紙重設為真實 state，但 `turn().then()` 回呼在動畫計時到達後無條件執行 `paint(previewStickers)`，導致方塊畫面被殘留的示範貼紙覆蓋，造成畫面與狀態脫節。 | 在 `previewTurn` 的 `.then()` 回呼開頭加入 `if (!previewActive) return;`，或利用世代計數器（generation ID）在取消或切換步驟時丟棄失效的回呼。 |
| E-3 | Minor | `src/ui/app.js:368-371` | `ctx.newGame()` 先 `dispatch(NEW_GAME)` 再啟動打亂動畫，導致方塊畫面瞬間閃爍打亂後的最終盤面。 | 使用者點擊「打亂」（或「再來一局」）時，`dispatch` 同步觸發 store subscriber 重繪（此時 `previewActive` 仍為 false），畫面立即閃現已完全打亂的盤面（1 幀），隨後 `playScrambleAnim` 才呼叫 `previewTurn` 將盤面切回已復原狀態並開始播放逐步打亂動畫。 | 在 `ctx.newGame` 中於 `dispatch` 前先呼叫 `previewTurn` 鎖定在 `engine.SOLVED` 盤面，或調整打亂動畫啟動時序，避免在預覽啟用前觸發已打亂盤面的渲染。 |

**疑似清單**

| 編號 | 檔案:行號 | 疑點 | 需要什麼資訊才能確認 |
|---|---|---|---|
| S-1 | `src/engine/reducer.js:276, 835-841` / `src/ui/controls.js:320` | 電腦示範播放期間（`demoStepForward`），每步皆以 `{ m, src: 'demo' }` 記入 `state.history` 並遞增 `cursor`，導致 HUD 狀態列的步數（`engine.moveCount(state)`）隨示範即時累加，初學者可能誤解示範步數計入個人本局步數。 | 規格書（`game-spec.md` §2.2 / §4.1）對「本局淨步數」的定義，是否預期 HUD 步數包含電腦示範步數，抑或 HUD 應只累加 `src === 'user'` 的步數。 |

**架構原則對照**：原則 1～5 皆「符合」（原文各附一句理由：engine 純函數、求解器以節點上限控時；全專案 0 處 `Math.random()`；參數抽離至 `src/data/` 並以 `numOr` 讀取；可互動元素皆 ≥44×44 px；單一 `index.html`、Worker 內嵌為 Blob URL）。

原文結語：已整合四批審查包之程式碼一次完成回覆；全套引擎與求解器自動測試 89 項全數通過。
