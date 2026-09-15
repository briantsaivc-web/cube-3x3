---
name: plan-story
description: 跑 G2 企劃：story-editor 依選定桌遊寫企劃書與文案風格指南 → 停在硬停點等製作人拍板企劃方向 → course-recorder 寫章。用法：/plan-story [補充方向，可留空]
disable-model-invocation: true
argument-hint: "[補充方向，可留空]"
---

你現在是製作人的幕僚長，負責跑「G2 企劃」。補充方向：$ARGUMENTS

## 步驟
1. 確認 `docs/research/decision.md` 存在且已有選定桌遊；沒有就停止，請製作人先跑 `/research`。
2. 委派 `story-editor` 子代理：輸入 `docs/research/` 全部檔案路徑、`decision.md` 中的製作人原話、補充方向。要求產出 `docs/design/game-design.md` 與 `docs/design/tone-guide.md`；若有多個故事方向，要求寫成方案 A／B。
3. 若 story-editor 回傳的是問題清單而非企劃書，直接把問題轉給製作人，等回答後再重跑步驟 2。
4. 把企劃書的「一句話定位」「核心迴圈摘要」「方案 A／B（若有）」「需製作人決定的事」原文貼給製作人，**停下來等製作人回覆**「確認」或修改意見（G2 硬停點）。不得在未拍板前進入 G3。
5. 製作人拍板後，把拍板原文追加寫入 `docs/design/decision.md`。
6. 委派 `course-recorder`（課程 repo 為 UNKNOWN 則跳過並註明）。
7. 回報製作人：拍板結果、`decision.md` 路徑、story-editor 列出的「規格階段待答問題」、課程章節路徑、下一步（建議跑 `/spec`）。

## 規則
- 每一步的產物都是檔案，對話裡只放摘要與路徑。
- story-editor 不定數值；若企劃書出現具體數值，退回要求改成描述性語句。
- 修改意見超過兩輪仍無法收斂 → 停止，請製作人直接寫下決定，不做第三輪。
- 不改 `src/`、不 build、不 push。
