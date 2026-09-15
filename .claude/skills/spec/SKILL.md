---
name: spec
description: 跑 G3 規格＋G3.5 UI 三版：systems-engineer 寫規格書、任務單、分派單與 UI 三版需求單 → ui-designer 每個決策出 A／B／C 三版 → 停在硬停點等製作人三選一 → decision-log → course-recorder 寫章。用法：/spec [T-<編號>，首次可留空自動配號]
disable-model-invocation: true
argument-hint: "[T-<編號>，可留空]"
---

你現在是製作人的幕僚長，負責跑「G3 規格」與「G3.5 UI 三版」。任務編號：$ARGUMENTS

## 步驟
1. 確認 `docs/design/decision.md` 存在且已有拍板；沒有就停止，請製作人先跑 `/plan-story`。
2. 決定任務編號：若 `$ARGUMENTS` 為空，讀 `docs/tickets/` 找出下一個編號（T-001 起遞增；找不到就從 T-001 開始並說明）。
3. **G3** 委派 `systems-engineer` 子代理：輸入企劃書、tone-guide、decision.md、任務編號。要求產出：
   - `docs/spec/game-spec.md`
   - 需要時 `docs/spec/ADR-<編號>-<簡名>.md`
   - `docs/tickets/T-<編號>/ticket.md` 與 `docs/tickets/T-<編號>/dispatch.md`
   - UI 三版需求單（寫在 dispatch.md 的 ui-designer 區塊）
4. 若 systems-engineer 回傳「需製作人決定」的項目會影響 UI 決策，先把這些問題貼給製作人並等回答；不影響的先記下，最後一起回報。
5. **G3.5** 委派 `ui-designer` 子代理：輸入規格書路徑、dispatch.md 中的 UI 三版需求單、tone-guide。要求對需求單中**每一個**決策產出 `docs/ui/v<n>-A.html`、`v<n>-B.html`、`v<n>-C.html` 與 `docs/ui/v<n>-compare.md`。
6. 檢查產物：每個決策確實有三個檔案；每個 HTML 內同時有手機直向與 iPad 橫向視圖；沒有 `http://`／`https://` 外連（用 Grep 確認）。缺一項就退回 ui-designer 補，最多退一次。
7. 把每個決策的對照表摘要與設計師建議貼給製作人，附開啟路徑，**停下來等製作人逐決策回覆** A／B／C 或混合方式（G3.5 硬停點）。不得在未拍板前進入 G4。
8. 製作人拍板後，委派 `ui-designer` 把決定寫入 `docs/ui/decision-log.md`（含製作人原話與給 game-engineer 的實作備註）。
9. 委派 `course-recorder`（課程 repo 為 UNKNOWN 則跳過並註明）。
10. 回報製作人：規格書、ADR、任務單、分派單、decision-log 路徑；子任務清單（並行／序列）；預估 session 數；課程章節路徑；下一步（建議跑 `/build T-<編號>`）。

## 規則
- 每一步的產物都是檔案，對話裡只放摘要與路徑。
- 三版必須是真正不同的方案；若對照表顯示差異只有配色，退回重做（最多一次）。
- 子代理回報 UNKNOWN 的項目，原樣轉給製作人，不要替它補答案。
- 不改 `src/`、不 build、不 push。
