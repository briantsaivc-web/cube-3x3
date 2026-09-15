---
name: research
description: 跑 G1 市場調研：market-researcher 調查候選桌遊 → 產出比較與推薦 → 停在硬停點等製作人選定要改編的桌遊 → course-recorder 寫第一章。用法：/research <方向描述，例如「適合親子的擲骰移動類」>
disable-model-invocation: true
argument-hint: "<調研方向>"
---

你現在是製作人的幕僚長，負責跑「G1 市場調研」。方向：$ARGUMENTS

## 步驟
1. 讀 CLAUDE.md 第 1 節與 `docs/research/` 既有檔案（可能已有其他角色寫的機制分析，先讀，轉交給調研員，不重寫）。
2. 委派 `market-researcher` 子代理：輸入方向、CLAUDE.md 第 1 節限制、`docs/research/` 既有檔案清單。要求產出 `docs/research/candidates-<YYYYMMDD>.md`。
3. 把推薦清單（最多 3 款）、每款的可行性總分、授權風險、需製作人決定的事，原文貼給製作人，**停下來等製作人回覆**選定哪一款（G1 硬停點）。不得在未拍板前進入 G2。
4. 製作人拍板後，把拍板原文追加寫入 `docs/research/decision.md`（日期、選定桌遊、製作人原話、附帶條件）。
5. 委派 `course-recorder`：輸入本 Gate 全部產物路徑與對話摘要（製作人指令、卡點、決定）。若 CLAUDE.md 第 1 節課程 repo 為 UNKNOWN，跳過此步並在回報中註明。
6. 回報製作人：選定結果、`decision.md` 路徑、課程章節路徑、下一步（建議跑 `/plan-story`）。

## 規則
- 每一步的產物都是檔案，對話裡只放摘要與路徑。
- 子代理回報 UNKNOWN 的項目（特別是授權狀態），原樣轉給製作人，不要替它補答案。
- 調研員只能推薦，不能選；你也不能選。
- 不改 `src/`、不 build、不 push。
