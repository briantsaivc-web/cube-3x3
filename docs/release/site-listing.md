# 魔術方塊：遊戲小站上架步驟（給製作人，純網頁操作，不需要本機 clone）

本文件只做一件事：把「魔術方塊」加進遊戲小站（`briantsaivc-web/briantsaivc-web.github.io`）。以下全部在 GitHub 網頁上點滑鼠完成。

> 前置提醒：`games.json` 裡的網址目前寫的是 `https://briantsaivc-web.github.io/cube-3x3/`（推測值）。請先確認 `cube-3x3` 這個 repo 已經在 Settings → Pages 開啟「Deploy from a branch / main / (root)」，打開網址確認遊戲能正常玩，再進行下面步驟。如果實際網址不同，請在步驟 ③ 貼上 JSON 前先修改 `url` 欄位。

## ① 上傳封面圖

1. 打開 `briantsaivc-web/briantsaivc-web.github.io` 這個 repo 的網頁。
2. 進入 `assets/games/` 資料夾。
3. 點右上角「Add file」→「Upload files」。
4. 把本資料夾裡的 `cube-3x3.svg` 拖進去上傳。
5. Commit message 填 `新增魔術方塊封面`，選「Commit directly to the main branch」，按 Commit changes。

封面檔案：本資料夾 `site-assets/cube-3x3.svg`（960×600，約 6 KB，深藍背景搭配原創插畫的三階魔術方塊，不含任何官方商標或文字）。

## ② 編輯 games.json，貼上這一筆

1. 回到 repo 根目錄，點開 `games.json`。
2. 點鉛筆圖示（Edit this file）。
3. 找到目前**最後一筆**物件（`id` 是 `ai-native-game-1` 的那一筆），在它結尾的 `}` 後面**加一個逗號 `,`**。
4. 換行，貼上下面這一整段 JSON（跟原本資料的縮排對齊即可，不要留在同一行）：

```json
{
  "id": "cube-3x3",
  "title": "魔術方塊",
  "category": "空間解謎",
  "description": "手邊沒有實體方塊，也能在瀏覽器裡轉一轉魔術方塊。提供提示、電腦的建議解法示範與記號小教室，陪你用層先法一步步練習。",
  "url": "https://briantsaivc-web.github.io/cube-3x3/",
  "cover": "assets/games/cube-3x3.svg",
  "coverAlt": "深藍背景中的原創三階魔術方塊插畫，六色貼紙錯落分布",
  "devices": ["phone", "tablet", "desktop"],
  "deviceLabel": "手機直向・平板橫向・電腦",
  "deviceNote": "瀏覽器自動測試已完成；手機與 iPad 實機操作體驗待驗證。",
  "accent": "violet",
  "order": 7,
  "published": true
}
```

5. 確認整份檔案還是合法的 JSON 陣列（最後一筆物件後面**不要**有逗號、最外層仍是 `[ ... ]`）。
6. Commit message 填 `上架魔術方塊`，選「Commit directly to the main branch」，按 Commit changes。

> 如果你之後才確認 `cube-3x3` 的實際 Pages 網址跟推測的不一樣，回到這個檔案再編輯一次，把 `url` 欄位改成正確網址，重新 commit 即可。

## ③ Commit 完成後

GitHub Pages 會自動重新發布，通常幾十秒到一兩分鐘內小站首頁就會多一張「魔術方塊」卡片。用手機和電腦瀏覽器各開一次首頁確認：

- 卡片封面正常顯示（原創方塊插畫，不是破圖）。
- 分類標籤顯示「空間解謎」，顏色是紫色（`violet`）。
- 點「開始遊戲」能連到魔術方塊網站。

如果卡片沒出現，最常見原因是步驟②的逗號漏加或多加，導致 `games.json` 不是合法 JSON——回去檢查一次逗號即可（可用線上 JSON 驗證工具貼上檢查）。
