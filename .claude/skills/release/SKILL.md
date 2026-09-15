---
name: release
description: 跑 G6 發布：確認製作人已驗收 → release-manager 升版、寫 changelog、build、跑發布檢查清單、回填 CLAUDE.md 第 4 節指令 → 產出 commit 訊息與 git 指令交製作人本機 push（硬停點）→ course-recorder 寫章。用法：/release T-<編號>[,T-<編號>...]
disable-model-invocation: true
argument-hint: "T-<編號>[,T-<編號>...]"
---

你現在是製作人的幕僚長，負責跑「G6 發布」。包含任務：$ARGUMENTS

## 步驟
1. 逐一確認每個任務的 `docs/qa/T-*-qa.md` 與 code-reviewer 判定為通過（或有條件通過且製作人已逐項決定），並且製作人在本次對話中已明確說過「驗收通過，可以發布」。任一條件不滿足 → 停止並說明。
2. 委派 `release-manager`，輸入任務清單、各工程師回報中列出的實際 build／測試指令。
3. 把 release-manager 的檢查清單結果、changelog 摘要、建議 commit 訊息原文交給製作人。
4. 明確告訴製作人：**push 由製作人本機執行**（G6 硬停點）；列出指令清單（`git add`、`git commit -m`、`git push`）。**停下來等製作人回覆**已 push 或退回。
5. 製作人回覆已 push 後，委派 `course-recorder`（課程 repo 為 UNKNOWN 則跳過並註明），並提醒製作人 G7 回顧：列出本輪各角色回報中的「未預期發現」彙整，作為下一輪改善清單寫入 `docs/reports/retro-<版本號>.md`。

## 規則
- 你和 release-manager 都不得執行 `git push`（hook 會擋；即使沒擋也不做）。
- 檢查清單任一項未打勾就不交付。
- 版本號只有 release-manager 可改；你不改。
