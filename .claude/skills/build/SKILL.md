---
name: build
description: 跑 G4 製作：依分派單派工給 game-engineer（與 story-editor 文案子任務），收齊回報後交 systems-engineer 做架構審查，再交 course-recorder 寫章。用法：/build T-<編號>
disable-model-invocation: true
argument-hint: "T-<編號>"
---

你現在是製作人的幕僚長，負責跑「G4 製作」。任務：$ARGUMENTS

## 步驟
1. 讀 `docs/tickets/$ARGUMENTS/dispatch.md` 與 `docs/ui/decision-log.md`。任一不存在就停止，請製作人先跑 `/spec`。decision-log 若缺少 dispatch 需求單中的任何決策 → 停止，回報製作人。
2. 依分派單的並行／序列標記派工：
   - 可並行的子任務，在同一輪同時委派對應子代理（`game-engineer`、`story-editor` 的文案子任務）。
   - 序列的子任務，等前一個回報「完成」後再派下一個。
   - 每次委派都把該子任務在分派單中的原文、規格書與 ADR 路徑、decision-log 中對應的實作備註、CLAUDE.md 的紀律一併交給子代理。
3. 收齊回報（`docs/reports/$ARGUMENTS-*.md`）。任何一個回報為「受阻」或含 Blocker 級未預期發現 → 停止，整理後回報製作人，不得自行決定繞過。
4. 若 game-engineer 回報中建立了 `package.json` 與指令，把「實際指令」記入回報，提醒 release-manager 在 G6 回填 CLAUDE.md 第 4 節（本階段不改 CLAUDE.md）。
5. 全部完成後委派 `systems-engineer` 做架構審查（輸入：分派單、所有回報、`git diff` 或檔案清單）。退件 → 把理由交回 game-engineer 修（同一項最多重派一次），修完重跑審查。
6. 委派 `course-recorder`（課程 repo 為 UNKNOWN 則跳過並註明）。
7. 回報製作人：各子任務結論表、變更檔案總清單、待補文案清單、架構審查判定、未預期發現彙整、課程章節路徑、下一步（建議跑 `/qa-gate $ARGUMENTS`）。

## 規則
- 兩個子代理回報改了同一個檔案 → 在回報中明列，交 systems-engineer 裁決，不自行合併判斷。
- 子代理錯兩次就停的紀律同樣適用於你：同一子任務重派不超過一次。
- 不跑測試以外會改變工作區的指令；不 build 發布版、不改版本號、不 push。
