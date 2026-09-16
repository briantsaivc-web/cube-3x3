---
name: release
description: 跑 G6 發布：確認製作人已驗收 → release-manager 升版、寫 changelog、build、跑發布檢查清單、回填 CLAUDE.md 第 4 節指令 → 產出 commit 訊息與 git 指令交製作人本機 push（硬停點）→ 新遊戲跑上架小站清單（Pages → 網址確認 → 封面 → games.json → validate.py）→ course-recorder 寫章。用法：/release T-<編號>[,T-<編號>...]
disable-model-invocation: true
argument-hint: "T-<編號>[,T-<編號>...]"
---

你現在是製作人的幕僚長，負責跑「G6 發布」。包含任務：$ARGUMENTS

## 步驟
1. 逐一確認每個任務的 `docs/qa/T-*-qa.md` 與 code-reviewer 判定為通過（或有條件通過且製作人已逐項決定），並且製作人在本次對話中已明確說過「驗收通過，可以發布」。任一條件不滿足 → 停止並說明。
2. 委派 `release-manager`，輸入任務清單、各工程師回報中列出的實際 build／測試指令。
3. 把 release-manager 的檢查清單結果、changelog 摘要、建議 commit 訊息原文交給製作人。
4. 明確告訴製作人：**push 由製作人本機執行**（G6 硬停點）；列出指令清單（`git add`、`git commit -m`、`git push`）。**停下來等製作人回覆**已 push 或退回。
5. **上架遊戲小站**（新遊戲首次發布才做；順序不得顛倒）：
   1. 確認遊戲 repo 根目錄有空白 `.nojekyll`；沒有就先補進 commit 指令，由製作人 push。
   2. 請製作人到遊戲 repo 的 Settings → Pages 選「Deploy from a branch／`main`／`/(root)`」，等 Actions 的 pages-build-deployment 出現綠勾。
   3. 幕僚長用 WebFetch 開 `https://<帳號>.github.io/<repo>/?check=<任意字>`，確認頁面能開、`<title>` 等於遊戲名稱；打不開就停在這一步排查，**不得進入下一步**。
   4. `docs/release/site-listing.md` 第一段列出每個要搬的檔案：**製作人本機完整路徑 → 小站 repo 目的路徑**（封面放 `assets/games/`），並附 GitHub 上的下載網址。
   5. 製作人依序：放封面 → 改 `games.json` → 在小站 repo 跑 `validate.py` → 全部通過才 push。
   6. push 後幕僚長開小站首頁，確認新卡片的名稱、封面、連結三項都正常，結果寫進 `docs/reports/T-<編號>-release.md`。
6. 製作人回覆已 push 後，委派 `course-recorder`（課程 repo 為 UNKNOWN 則跳過並註明），並提醒製作人 G7 回顧：列出本輪各角色回報中的「未預期發現」彙整，作為下一輪改善清單寫入 `docs/reports/retro-<版本號>.md`。

## 規則
- 你和 release-manager 都不得執行 `git push`（hook 會擋；即使沒擋也不做）。
- 檢查清單任一項未打勾就不交付。
- 版本號只有 release-manager 可改；你不改。
- release-manager 若由便宜模型（haiku）執行，changelog、commit 訊息、上架說明交給製作人前，你要逐句對照來源檔（任務單、回報、裁決表、測試輸出），並打開它的驗證腳本確認真的操作過遊戲。
