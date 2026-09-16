# 回報：T-001 release-manager（G6 v0.1.0 發布準備）

| 欄位 | 內容 |
|---|---|
| 角色 | release-manager |
| 任務 | T-001 魔術方塊 v0.1.0 發布準備（G6） |
| 日期 | 2026-09-16 |
| 版本號 | v0.1.0 |
| 包含的任務單 | T-001（單一任務單） |

---

## 1. 版本號變更

| 位置 | 變更內容 |
|---|---|
| `package.json` | `0.0.0` → `0.1.0` |
| `index.html`（由 build 產生） | `v0.0.0` → `v0.1.0`（寫入 `window.GAME_VERSION`） |

**grep 確認**：原始碼內無其他出現版本號的位置（歷史 build 輸出在 `docs/reports/` 不變更）。

---

## 2. Build 與測試結果

### 2.1 檢查清單逐項

| 項目 | 結果 | 證據 |
|---|---|---|
| `check-forbidden.sh` | PASS | exit code 0 |
| engine 測試（`node --test "tests/engine/**/*.test.js"`） | 100/100 PASS | 耗時 152.5 秒；含 1,000 局隨機狀態建議解 100% 復原 |
| build 決定性 | PASS | 跑兩次 sha256 相同：`8e8bf30702d2344690a158d2d868802c9b4ea549b2f6ffd877a22ff7785017b3` |
| UI 測試（兩視圖 × 35 項） | 70/70 PASS | 手機 390×844、iPad 1194×834 各 35 項全過；耗時 298.2 秒 |
| build 產物大小 | PASS | 381,059 bytes（< 400 KB 上限） |
| Worker 字串大小 | PASS | 84,029 bytes（< 100 KB 上限） |
| 版本號一致 | PASS | `package.json` 與 `index.html` 內 `window.GAME_VERSION` 皆為 v0.1.0 |
| CHANGELOG 已寫 | PASS | `docs/changelog/CHANGELOG.md` |
| index.html 無 http/https 外連 | PASS | `grep -oE "https?://…" index.html` 0 筆；離線測試 0 個外部請求 |
| 無「【文案待補】」或 TODO 佔位 | PASS | grep src/ 與 index.html 結果為 0 |
| 備份檔與靜態稿未被打包 | PASS | build 輸出列「18 個模組、4 個資料檔」；無 `.backup.*` 或 `docs/ui/*.html` 進版 |
| index.html 離線可玩 | PASS（幕僚長重驗） | release-manager 原腳本只檢查版本與載入，未做操作；幕僚長另寫 `scratch/g6/offline-play.js`：離線＋`file://`，手機與 iPad 各完成打亂（25 步）→R→撤銷（盤面還原）→提示（得到下一步），0 個 JS 錯誤、0 個外部請求 |

### 2.2 Build 產物

| 屬性 | 值 |
|---|---|
| 檔名 | `index.html` |
| 大小 | 381,059 bytes（約 372 KB） |
| SHA256 | `8e8bf30702d2344690a158d2d868802c9b4ea549b2f6ffd877a22ff7785017b3` |
| 決定性 | ✓ 連跑兩次產物相同 |
| 資源 | 18 個源碼模組 + 4 個資料檔（JSON）+ Worker 1 個；零外部資源 |
| Worker 字串 | 84,029 bytes（5 個模組） |

---

## 3. 幕僚長核對註記

- release-manager（haiku）初稿的 CHANGELOG 與 commit 訊息有與來源不符之處（例：把建議解寫成「最短路線」，違反「不得稱最短」規則；自行編造「72 種基本記號」「Android Chrome 實測」等項目；把已修的 S13 審查 m-3 列為未修）。幕僚長已依來源重寫 `docs/changelog/CHANGELOG.md` 與下方 commit 訊息；初稿保留於 `scratch/g6/`（不進版控）。

## 4. 建議的 commit 訊息

```
魔術方塊 v0.1.0（T-001）：第一個可玩版
自由練習、提示、建議解示範、層先法分段示範、記號小教室；G4.5 外部審查與 G5 QA 修正完成
```

## 5. 製作人要執行的指令（Windows 命令提示字元）

```
cd C:\Users\Carrie\cube-3x3
git add -A
git commit -m "魔術方塊 v0.1.0（T-001）：第一個可玩版" -m "自由練習、提示、建議解示範、層先法分段示範、記號小教室；G4.5 外部審查與 G5 QA 修正完成"
git tag v0.1.0
git push
git push origin v0.1.0
```

push 前請先刪除 `_to_delete` 資料夾（已列入 .gitignore，不刪也不會被推上去）。

## 6. 開啟 GitHub Pages（只需做一次）

1. 開 https://github.com/briantsaivc-web/cube-3x3 → **Settings** → 左側 **Pages**。
2. **Build and deployment** → Source 選 **Deploy from a branch**；Branch 選 **main**、資料夾選 **/ (root)** → **Save**。
3. 等 1～2 分鐘，頁面上方會出現網址（預期為 https://briantsaivc-web.github.io/cube-3x3/ ，以 GitHub 顯示的為準）。
4. 用手機打開該網址確認能玩，再做第 7 節。

## 7. 上架遊戲小站

依 `docs/release/site-listing.md` 在 GitHub 網頁上操作：上傳 `docs/release/site-assets/cube-3x3.svg` 到小站的 `assets/games/`，在 `games.json` 最後加入 `docs/release/site-assets/games-entry.json` 那一筆（前一筆結尾補逗號）；若第 6 節顯示的網址不同，先改 `url` 再 commit。

## 8. 變更檔案清單

| 檔案 | 動作 |
|---|---|
| `package.json` | version 0.0.0 → 0.1.0 |
| `index.html` | build 產生（v0.1.0，381,059 bytes，sha256 `8e8bf307…17b3`） |
| `docs/changelog/CHANGELOG.md` | 新增（幕僚長重寫） |
| `docs/reports/T-001-release.md` | 新增 |

## 9. 未預期發現

- release-manager 初稿內容失真（見第 3 節）→ 已列入課程素材與 G7 改善清單：「發布文件由便宜模型起草後，必須逐句對照來源」。
