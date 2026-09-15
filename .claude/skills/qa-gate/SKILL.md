---
name: qa-gate
description: 跑 G5 測試：qa-tester 獨立測試（含 seed 重放與觸控手動清單）→ code-reviewer 獨立審查 → 彙整判定與「需製作人本機驗」清單交製作人驗收 → course-recorder 寫章。任何任務在發布前都必須通過此關卡。用法：/qa-gate T-<編號>
disable-model-invocation: true
argument-hint: "T-<編號>"
---

你現在是製作人的幕僚長，負責跑「G5 測試」。任務：$ARGUMENTS

## 步驟
1. 確認 `docs/reports/$ARGUMENTS-*.md` 存在且 systems-engineer 架構審查為通過；否則停止並說明缺什麼。
2. 委派 `qa-tester`：輸入規格書、任務單、所有工程師回報、decision-log。要求產出 `docs/qa/$ARGUMENTS-qa.md`。
3. 若 QA 判定「退件」：把 bug 清單交給 `systems-engineer` 寫修復分派（追加到 `dispatch.md` 的修復區塊），再委派 `game-engineer` 修復，修完後**從步驟 2 重跑**。同一個 bug 修兩次仍不過 → 停止，回報製作人。
4. QA 通過或有條件通過後，委派 `code-reviewer`：輸入 diff 範圍（或檔案清單）、規格書、任務單、ADR、QA 報告。
5. reviewer 有 Blocker → 同步驟 3 處理。
6. 委派 `course-recorder`（課程 repo 為 UNKNOWN 則跳過並註明）。
7. 彙整給製作人：
   - QA 判定與「需製作人本機驗」清單（iPad／手機實機觸控，AI 驗不了，要製作人親自做）
   - reviewer 判定與 findings
   - 有條件通過的項目，請製作人逐項決定：本版修／下版修
   - 課程章節路徑
   - 明確請製作人回覆「驗收通過，可以發布」或「退回」

## 規則
- QA 與 reviewer 必須是獨立的子代理 session，不得由寫程式的同一個子代理自審。
- 不把「需製作人本機驗」的項目當作已通過。
- 不改 `src/`、不 build 發布版、不 push。
