# G1 市場調研：經典三階魔術方塊（3x3x3）單頁網頁遊戲

調研日期：2026-09-15｜調研範圍：現有魔術方塊網頁/App、觸控操作模式、新手教學元素、瀏覽器內求解演算法可行性、WCA 官方打亂規範。

## 摘要（10 行內）

1. 現有線上方塊工具（Ruwix、Grubiks、rubiks-cube-solver.com、cubing.js/Twizzle、csTimer）功能高度重疊：3D 模擬、打亂、Kociemba 求解（≤20 步）、記號輸入、部分含計時與訓練工具，但**多無「限步挑戰」或「每日挑戰」等遊戲化設計**。
2. 熱門手機 App（Magic Cube Puzzle 3D、CubeX，皆 4.6 顆星、下載千萬級）評價高，主因是「求解＋教學一次滿足」，但玩家抱怨操作「比實體方塊 finicky（不精準）」與插入全螢幕廣告打斷打亂流程。
3. 觸控最大痛點是**「轉一層」與「轉整顆視角」互相誤觸**：實體 TouchCube 產品也曾因過度靈敏被媒體點名批評，須靠明確的手勢分流（單指劃在方塊面＝轉層、單指劃在背景/邊框或雙指＝轉視角）與加大誤觸容忍度解決。
4. 求解演算法方面，**Kociemba 兩階段法**是瀏覽器可行的唯一實用選項：JS 實作（cubejs、min2phase.js）在現代裝置上初始化僅約 0.2～5 秒、單次求解 <2 秒、可產生 ≤20～22 步的（近）最佳解；**Korf 最佳解（IDA*+PDB）**需 82MB 記憶體、單例最壞情況可能耗時數小時到數天（1997 年硬體），不適合手機單檔即時求解。
5. WCA 官方打亂採用「random-state scramble」（先隨機取一個合法狀態，再用求解器找出約 20 步的還原序列反過來當打亂），標準記號為 Singmaster notation（U D L R F B、M E S、' 與 2）。
6. 對本遊戲的建議（詳見第 6 節）：採 min2phase 風格的 Kociemba 求解＋Web Worker 做「提示/求解」，打亂用「隨機套用 20~25 步合法轉動」的近似 random-state 做法（非完全複刻 WCA 演算法），操作採「劃在方塊面＝轉層、劃在外部/雙指＝轉視角」，並加入 LBL 教學、限步挑戰等現有工具普遍缺乏的新手向遊戲化元素做差異化。

---

## A. 現有熱門線上/手機魔術方塊遊戲與模擬器

| 產品 | 類型 | 功能 | 操作方式 | 受歡迎原因 | 玩家常見抱怨 | 來源 |
|---|---|---|---|---|---|---|
| Ruwix Online Cube Solver (rubiks-cube-solver.com / ruwix.com/cube-solver) | 網頁模擬器＋求解器 | 打亂、Solve（用「open-source Kociemba algorithm calculator」求 ≤20 步解）、逐步教學導引、算則輸入框、3D 視圖與展開視圖切換、可用相機掃描方塊 | 旋轉按鈕、鍵盤 FRULBD 輸入、滑動螢幕（swipe） | 免費、一站式（掃描→出解） | 該頁未明確列出計時器/undo/提示分級功能（頁面本身未提及） | [ruwix.com/cube-solver](https://ruwix.com/cube-solver/) |
| Grubiks Online Rubik's Cube (3x3x3) | 網頁模擬器＋求解器 | 求解器（Solvers 頁）＋線上方塊互動（「Drag to play!」） | 拖曳（drag）操作 3D 方塊 | 多種扭曲類拼圖集中一站（也有 10x10x10 等大型方塊模擬器） | 頁面對計時/提示/教學細節未詳列（來源頁未提供） | [grubiks.com/puzzles/rubiks-cube-3x3x3](https://www.grubiks.com/puzzles/rubiks-cube-3x3x3/) |
| cubing.js / Twizzle（cubing/cubing.js on GitHub） | 開源 JS 函式庫＋線上工具（twisty player 元件） | 3D/2D 方塊顯示與互動元件，可嵌入教學網站；支援多種扭曲拼圖 | 依實作而定（函式庫，非成品 App） | 開源、可程式化整合，速解圈（speedsolving community）廣泛用於製作教學動畫 | 屬函式庫非終端產品，無直接玩家評價可查 | [github.com/cubing/cubing.js](https://github.com/cubing/cubing.js/) |
| csTimer (cstimer.net) | 網頁版專業計時/訓練工具 | 支援「all WCA official events」的打亂、多重計時 session、平均/PB 統計、Cross/F2L/Roux/EOLine 等子步驟算則訓練器、虛擬方塊（鍵盤操作或藍牙智慧方塊連線）、過去解法的逐步重建（reconstruction） | 空白鍵長按啟動計時、鍵盤操控虛擬方塊、可連藍牙智慧方塊 | 速解圈公認最完整的免費計時/訓練工具，功能貼近 WCA 正式賽制（含 inspection 語音提示） | 來源頁未列出負評；功能導向速解玩家，對新手可能學習曲線較陡（推論） | [cstimer.net](https://cstimer.net/) |
| Magic Cube Puzzle 3D（Google Play, com.maximko.cuber） | 手機 App | 內建求解器＋提示與算則教學、2×2×2～20×20×20 多尺寸方塊、成就與排行榜、自由 3D 旋轉視角 | 觸控拖曳（「simple controls」自我宣稱） | 4.6★／23.5 萬則評論／1000 萬＋下載，功能全面 | 有評論指出操作「比實體方塊 finicky（不夠精準）」；每次重新打亂會被全螢幕廣告打斷約 30 秒 | [play.google.com/…com.maximko.cuber](https://play.google.com/store/apps/details?id=com.maximko.cuber&hl=en_IN) |
| CubeX – Solver, Timer, 3D Cube（Google Play, diozz.cubex） | 手機 App | Fridrich 求解器、Advanced Solver（採 Herbert Kociemba 兩階段演算法，最多 20 步）、Pattern Solver、手動輸入或相機掃描、計時器、虛擬方塊練習算則 | 觸控 3D 操作＋相機掃描輸入 | 4.6★／35.9 萬則評論／1000 萬＋下載；求解方式多元（含最佳化 20 步方案） | 有評論指出打亂功能設計繞路（要先存 pattern 再到 Pattern Solver 用）；相機輸入頁面偶有廣告 | [play.google.com/…diozz.cubex](https://play.google.com/store/apps/details?id=diozz.cubex&hl=en_IN) |
| The Cube App（iOS, id1247162314） | 手機 App（計時/訓練） | 計時器、多方塊支援（Square-1、Skewb、Pyraminx 等）、session 管理 | 依 App 內建（iOS 觸控） | 3.9★／152 則評分；功能貼近 csTimer 移植版 | 評論多集中在計時精準度／演算法完整度／UI 改版，**未見**觸控誤觸或視角控制相關抱怨（在可讀取到的評論範圍內） | [apps.apple.com/…the-cube-app](https://apps.apple.com/us/app/the-cube-app/id1247162314?see-all=reviews&platform=iphone) |
| Rubik's TouchCube（實體觸控產品，非網頁/App，列為觸控設計反面案例） | 實體電子方塊 | 觸控面板取代物理轉動，僅頂層可感應滑動 | 手指在頂層表面滑動（swipe） | 話題性強（官方授權電子產品） | NBC News 報導：觸控「過於靈敏」，玩手中轉動方塊找下一步時容易誤觸滑動已轉好的層；且僅頂層可操作，無法像實體方塊翻面操作其他層，需頻繁按 undo | [nbcnews.com/id/wbna32987005](https://www.nbcnews.com/id/wbna32987005) |

**觀察**：純網頁工具（Ruwix/Grubiks/cubing.js）偏重「求解器」定位，遊戲化程度低；手機 App（Magic Cube Puzzle 3D、CubeX）評分高但主要靠「一站式求解+教學」而非遊戲玩法本身；csTimer 是速解圈標準但對休閒新手偏硬核。觸控誤觸問題在實體 TouchCube 上已被媒體明確指出，是本遊戲操作設計必須優先解決的已知風險。

---

## B. 觸控操作設計模式

### B1. 「轉一層」vs「轉整顆視角」的區分方式

| 做法 | 說明 | 優點 | 缺點 | 來源 |
|---|---|---|---|---|
| 手勢分流：劃在方塊「貼紙/面」上＝轉層，劃在方塊外部背景或邊框＝轉視角 | 依觸點位置判斷意圖（打在方塊 3D 網格上 vs 打在空白區） | 直覺、單指即可、不需教學即可猜到 | 邊界地帶（方塊邊緣）誤判率高，尤其手指較粗或小螢幕 | 綜合設計原則（Material Design 手勢模式）[m1.material.io/patterns/gestures](https://m1.material.io/patterns/gestures.html)；未見魔術方塊專屬教學頁面明確描述此規則的官方來源，此為業界常見拖曳/相機分離模式的**推論延伸** |
| 單指＝轉層、雙指＝轉視角（camera） | 用手指數量分流意圖，是 3D 編輯器/遊戲常見慣例 | 意圖明確不易誤觸；符合許多 3D 建模/看圖 App 的既有直覺 | 手機上雙指操作對單手持機的玩家不友善（需要雙手） | UNKNOWN（查無專門描述魔術方塊 App 採此規則之公開文章；為 3D 互動 UI 通用慣例的推論） |
| 拖曳方向判斷：短距離、貼著方塊某一層平面的滑動＝轉層；長距離、跨越方塊輪廓的滑動＝轉視角（旋轉整顆） | 依滑動向量與起點是否落在可轉層的「有效握把區」判斷 | 可用單指完成全部操作，符合手機單手習慣 | 實作複雜，需要精準計算 3D 投影後的滑動方向對應到哪一層與轉動方向 | 此為業界常見 3D 方塊模擬器技術性做法之**推論**（cubing.js twisty player 等函式庫必然要處理此問題，但其原始碼內部手勢判斷細節未在本次調研中直接讀取到，列為來源不可得：函式庫原始碼行為需深入原始碼分析，非公開文件可查） |
| Suzy Cube（2D/3D 平台遊戲）touch 控制經驗：可拖曳搖桿跟隨手指移動、限制方向為 16 向而非全 360 度、輸入抽象化以降低精準度需求 | 通用行動裝置觸控設計文章，非方塊專屬，但原則可轉用：降低對精準角度/位置的依賴、方向snapping | 減少因手指誤差造成的誤觸/誤判 | 需要額外設計「吸附」邏輯，並可能犧牲部分操作自由度 | [gamedeveloper.com/design/lessons-from-suzy-cube](https://www.gamedeveloper.com/design/lessons-from-suzy-cube-mobile-controls-that-feel-great) |
| 實體 TouchCube 教訓：面板僅感應頂層滑動，靈敏度過高導致誤觸 | 反面案例：觸控面過度靈敏、且限制只能操作正對使用者的那一層 | — | 導致玩家挫折、依賴 undo | [nbcnews.com/id/wbna32987005](https://www.nbcnews.com/id/wbna32987005) |

### B2. 按鈕式 Singmaster 記號面板做法

- 標準記號：**U D L R F B**（六個面各轉 90°）；**' (prime)** 表示逆時針 90°；**2** 表示轉 180°。來源：[speedsolving.com/wiki/Singmaster_notation](https://www.speedsolving.com/wiki/index.php/Singmaster_notation)
- 切層記號（slice moves）：**M**（介於 L/R 中間層，方向依 L 定義）、**E**（介於 U/D 中間層，方向依 D 定義）、**S**（介於 F/B 中間層，方向依 F 定義），各自的 `'` 表示反方向。來源：[rubiks.fandom.com/wiki/Notation](https://rubiks.fandom.com/wiki/Notation)
- 桌面/滑鼠操作先例：KDE 內建方塊遊戲 Kubrick 支援用鍵盤直接輸入 Singmaster 記號（例如打 `R`、`F'`）操控方塊，並可用滑鼠右鍵手動旋轉視角；文件未明確描述其是否有圖形化按鈕面板（此點來源頁未提供，列為來源不可得：官方文件僅涵蓋鍵盤輸入段落，未涵蓋完整 UI 截圖說明）。來源：[docs.kde.org/.../singmaster-moves.html](https://docs.kde.org/stable_kf6/en/kubrick/kubrick/singmaster-moves.html)
- Ruwix 的線上求解器提供「旋轉按鈕＋鍵盤 FRULBD 輸入＋算則輸入框」，可視為按鈕式記號面板的實例（12 個基本面按鈕：F/F'/R/R'/U/U'/L/L'/B/B'/D/D'，是否含 2 轉未在頁面明確提及）。來源：[ruwix.com/cube-solver](https://ruwix.com/cube-solver/)

**建議面板設計（推論）**：12～18 顆按鈕（U U' U2 / D D' D2 / L L' L2 / R R' R2 / F F' F2 / B B' B2），作為觸控轉層的備援輸入（尤其平板橫向可放在畫面兩側），可完全避免手勢誤觸問題，但犧牲沉浸感；建議與拖曳手勢並存，讓新手可先用按鈕、熟練後改用手勢。

---

## C. 讓非高手也覺得好玩的元素

| 元素 | 先例 | 說明 | 來源 |
|---|---|---|---|
| 層先法（LBL）分步教學 | Ruwix「How To Solve The Rubik's Cube - Beginners Method」、Wikipedia Layer-by-layer method | LBL 標準拆為 7 個階段：①頂層十字 ②頂層四角 ③中層四邊 ④底層十字（定向） ⑤底層邊塊排列 ⑥底層角塊排列 ⑦底層角塊定向；相較 CFOP 等速解法，LBL 所需記憶的算則數量少很多，適合新手 | [ruwix.com/…beginners-method](https://ruwix.com/the-rubiks-cube/how-to-solve-the-rubiks-cube-beginners-method/)；[en.wikipedia.org/wiki/Layer-by-layer_method](https://en.wikipedia.org/wiki/Layer-by-layer_method) |
| 逐步提示/求解導引 | Ruwix Cube Solver「guide you through the steps to solve your cube」；Magic Cube Puzzle 3D「Get hints and learn how to solve using the algorithms」；CubeX 多重求解器（Fridrich/Advanced/Pattern） | 提示不是直接showcase最終解，而是逐步引導（每次只給下一步），降低挫折感 | [ruwix.com/cube-solver](https://ruwix.com/cube-solver/)；[play.google.com/…com.maximko.cuber](https://play.google.com/store/apps/details?id=com.maximko.cuber&hl=en_IN) |
| 成就/排行榜 | Magic Cube Puzzle 3D 明確標榜「Achievements and leaderboards」 | 遊戲化留存機制的既有先例 | [play.google.com/…com.maximko.cuber](https://play.google.com/store/apps/details?id=com.maximko.cuber&hl=en_IN) |
| 子步驟練習/訓練器 | csTimer 的 Cross/F2L/Roux/EOLine 等「algorithm trainer」可篩選特定 case 練習 | 把整套解法拆成可練習的小單元，是進階但可借用其「拆解＋單獨練習」概念給新手用（例如只練「十字」） | [cstimer.net](https://cstimer.net/) |
| 限步挑戰（Fewest Moves 精神） | WCA 官方賽事項目 FMC（Fewest Moves Challenge）：選手在時限內（通常 1 小時）尋找步數最少的解法，記錄單次或三次平均步數 | 這是「以最少步數還原」精神的官方先例，但**與題目所述「打亂 N 步後限 ≤N 步復原」的具體規則不同**——本次調研**查無**任何線上工具或 App 明確採用「打亂用了幾步、就限定玩家用同樣步數內復原」這種「打亂步數=挑戰步數上限」設計的公開案例 | FMC 教學文件：[fmcsolves.cubing.net/fmc_tutorial_ENG.pdf](https://fmcsolves.cubing.net/fmc_tutorial_ENG.pdf)；「打亂步數=復原步數上限」玩法：**查無紀錄**（多次搜尋 App Store／Google Play／獨立遊戲平台均未找到此規則的既有實作） |
| 每日挑戰（Daily Challenge） | **查無紀錄**：本次搜尋未找到魔術方塊 App／網站明確標榜「每日挑戰」（如每日固定打亂、每人挑戰同一盤面比較成績）的公開案例 | 多款益智/字謎類遊戲（如 Wordle）有此機制，但未見魔術方塊領域的直接先例 | 查無紀錄 |

**小結**：教學、提示、成就在現有生態中都有先例可循；但「打亂步數=復原步數上限」的限步挑戰與「每日挑戰」在魔術方塊這個品類中似乎是**市場空白**，若本遊戲加入，可作為差異化賣點（此為推論，非既有先例佐證的結論）。

---

## D. 求解演算法在瀏覽器的可行性

| 演算法 | 典型步數 | 運算/記憶體需求 | 瀏覽器可行性 | 開源 JS 實作與授權 | 來源 |
|---|---|---|---|---|---|
| **Kociemba 兩階段法（Two-Phase）** | 通常 ≤20 步（非保證最佳，實務上很接近最佳）；Ruwix 求解器宣稱「約 20 步或更少」；CubeX 的 Advanced Solver 標榜「最多 20 步」 | 需預先建置查表（table），初始化耗時視實作而定（見下）；求解本身極快 | **高度可行**，是目前所有網頁/App 求解器實際採用的方案 | `cs0x7f/min2phase`（C++/移植版）：雙授權 **GPLv3 或 MIT** 可選；官方文件指出「完整初始化約需 200ms，未完整初始化時求解速度會慢 5～10 倍」| min2phase：[github.com/cs0x7f/min2phase](https://github.com/cs0x7f/min2phase)；Ruwix：[ruwix.com/cube-solver](https://ruwix.com/cube-solver/)；CubeX：[play.google.com/…diozz.cubex](https://play.google.com/store/apps/details?id=diozz.cubex&hl=en_IN) |
| ├ `ldez/cubejs`（JS） | 保證 ≤22 步 | 首次「precalculation」（建表）**約需 4～5 秒**（現代電腦），之後單次求解約 **0.01～0.4 秒，偶爾到 2 秒**（較舊硬體可能更久） | 建表時間偏長，需搭配 Loading 畫面或背景執行緒 | **MIT License** | [github.com/ldez/cubejs](https://github.com/ldez/cubejs) |
| ├ `cubing/min2phase.js` | 官方 min2phase 精神：≤20 步等級 | 支援「可選的提前預先初始化」`min2phase.initialize()`；**預設自動使用 Web Worker**（現代瀏覽器皆支援），無 Worker 環境（如 Node.js）則退回主執行緒運算 | 內建 Web Worker 支援，最適合本遊戲「零依賴＋手機」場景 | 檔案內含 LICENSE.md，但本次讀取到的頁面片段**未顯示具體授權條款內容**（來源不可得：README 摘要未包含 LICENSE 檔全文，需另外開啟該檔） | [github.com/cubing/min2phase.js](https://github.com/cubing/min2phase.js) |
| **Korf 最佳解（IDA* + Pattern Database）** | 保證最佳（≤20 步，1997 論文證明的上界後來由 cube20.org 於 2010 正式證明 God's Number = 20） | Korf 原論文（1997）：角塊 PDB 42MB＋兩個邊塊 PDB 各 20MB，**合計 82MB 記憶體**；深度 16 搜尋平均需時「少於 4 小時」，深度 17 約「2 天」，深度 18 推估「少於 4 週」（皆為 1997 年代硬體，單一最壞情況實例） | **不適合**本遊戲：即便現代硬體可將上述時間大幅縮短，82MB 常駐記憶體＋單例最壞情況仍可能是秒級到分鐘級的不確定延遲，與「手機、零依賴單檔、即時互動」的需求衝突；證明 God's Number=20 這個更大規模的窮舉更耗費「約 35 CPU-年」（Google 捐贈算力），屬離線一次性數學證明工程，非單次求解演算法的日常運算量 | UNKNOWN（本次調研未找到成熟、授權明確、適合直接嵌入單頁的 JS Korf/PDB 完整實作） | Korf 1997 論文：[cdn.aaai.org/AAAI/1997/AAAI97-109.pdf](https://cdn.aaai.org/AAAI/1997/AAAI97-109.pdf)；God's Number=20：[cube20.org](https://www.cube20.org/) |
| **Thistlethwaite 演算法** | 平均約 **31 步**；窮舉顯示四階段最壞情況步數分別為 7/10/13/15，總和最多 **45 步** | 建立在群論的四個嵌套子群（G0⊃G1⊃G2⊃G3⊃G4）逐階段縮小搜尋空間，計算量遠低於 Korf | 可行但步數明顯多於 Kociemba，現代實作已較少單獨使用，多被 Kociemba 取代 | 有開源實作（如 `dfinnis/Rubik`、`itaysadeh/rubiks-cube-solver`），皆為 C++版本，**JS 版本與授權本次未逐一查證**（UNKNOWN） | [en.wikipedia.org/wiki/Optimal_solutions_for_the_Rubik's_Cube](https://en.wikipedia.org/wiki/Optimal_solutions_for_the_Rubik%27s_Cube) |
| **層先法（LBL）求解生成器** | 依方案不同，通常 **50～100+ 步**（非最佳化，但邏輯簡單、可直接對應教學步驟） | 運算量極低，幾乎不需要查表，最適合「教學模式」逐步示範 | 高度可行，且是本遊戲「新手教學」情境下唯一該用的求解模式（求最短步數的 Kociemba 解法對教學沒有意義，因為玩家看不懂為什麽這樣轉） | UNKNOWN（本次未找到現成、授權明確的 JS LBL 步驟生成器開源專案，多數 App 為自行實作且未開源） | 推論（基於 LBL 演算法結構本身的通用知識，無法額外提供步數統計來源） |

**對「零依賴、單檔、手機上求解」的具體建議（推論，非既有先例直接證明）**：
1. 用 Kociemba 兩階段（自行以 JS/TypeScript 重寫精簡版查表生成邏輯，打包進單一 `index.html`，避免外部 CDN），可達成「近最佳解（約 20～22 步）」，這是目前唯一被多個實務產品（Ruwix、CubeX、cubejs、min2phase）驗證過在瀏覽器可行的方案。
2. 查表初始化（依 cubejs 經驗約 4～5 秒／依 min2phase 經驗約 0.2 秒但需完整移植其優化）應放進 **Web Worker** 背景執行，避免卡住主執行緒與觸控互動（`min2phase.js` 已示範此模式）。
3. **不建議**在此專案中實作 Korf 最佳解：82MB 常駐表格對「單一 HTML 檔、離線可玩」的體積/記憶體目標是沈重負擔，且最壞情況運算時間不可控。
4. 教學模式應獨立於「求最短步數」的求解器，改用邏輯簡單的 LBL 步驟生成器（步數多但玩家看得懂每一步在做什麼）。

---

## E. WCA 官方打亂規範與記號標準

- **官方打亂軟體**：WCA 正式賽事規定必須使用官方指定的「TNoodle-WCA」程式產生打亂（Regulations 提及「Official competitions must always use a current version of the official scramble program」），且必須由賽事代表在本機下載執行（不可用公開網頁版），打亂序列須加密保存並隨成績一併提交。來源：[worldcubeassociation.org/regulations/scrambles](https://www.worldcubeassociation.org/regulations/scrambles/)
- **Random-state scramble（隨機狀態打亂）原則**：先隨機選取一個合法的方塊狀態，再用求解器找出該狀態的一個（通常約 20 步左右的）還原解，把這個解「反過來」當作打亂序列使用；這與單純「隨機挑選轉動」的 random-move 打亂不同，保證了打亂後的狀態在所有合法狀態中均勻分佈。歷史上 3x3x3 官方打亂由「Cube Explorer」工具產生（未在來源中明確標注是否直接基於 Kociemba 演算法，但 Cube Explorer 是同一位作者 Herbert Kociemba 所開發的求解/打亂工具，兩者理論基礎相通——此為合理推論，非逐字引用）。來源：[speedsolving.com/wiki/Scrambling](https://www.speedsolving.com/wiki/index.php/Scrambling)
- **打亂篩選規則**：TNoodle 依 WCA Regulation 4b3 對生成的打亂做篩選（例如避免出現過於簡單的圖案），細節條文本次未逐條展開查證。來源：[worldcubeassociation.org/regulations/scrambles](https://www.worldcubeassociation.org/regulations/scrambles/)
- **記號標準（Singmaster notation）**：U/D/L/R/F/B 六面基本轉動，`'` 逆時針、`2` 轉180°；M/E/S 三個中層切片轉動（M 隨 L 方向、E 隨 D 方向、S 隨 F 方向定義順時針）；小寫字母（u/d/l/r/f/b）代表「該面+相鄰中層」一起轉的寬轉（wide move）。來源：[speedsolving.com/wiki/Singmaster_notation](https://www.speedsolving.com/wiki/index.php/Singmaster_notation)；[rubiks.fandom.com/wiki/Notation](https://rubiks.fandom.com/wiki/Notation)
- **完整 WCA Regulations 全文（PDF）**（含更詳細條文，本次未逐條讀取全文）：[regulations.worldcubeassociation.org/wca-regulations-and-guidelines.merged.pdf](https://regulations.worldcubeassociation.org/wca-regulations-and-guidelines.merged.pdf)

**對本遊戲的建議（推論）**：本遊戲零依賴、單檔，不需要也不可能完整移植 TNoodle/官方級 random-state 演算法（其本身仰賴 Kociemba 求解器反向運算，運算量不小）。務實做法是採**「隨機套用 20～25 步合法轉動序列（並避免同層連續互相抵消的轉動）」**的 random-move 近似打亂，明確在遊戲內標示「此打亂非 WCA 官方認證等級」，避免誤導玩家；若要更嚴謹，可以自行實作的 Kociemba 求解器反推做出真正的 random-state 打亂（技術上可行，因為第 D 節已確認 Kociemba 求解在瀏覽器可行），只是複雜度與初始化成本較高。

---

## 對本遊戲的建議（彙整；均為推論，非既有先例直接證明的部分已個別標註）

1. **求解/提示引擎**：自製精簡版 Kociemba 兩階段求解器（JS，仿 min2phase 精神），查表建置放 Web Worker，目標「近最佳解 20～22 步」。（推論，依 D 節數據支持可行性）
2. **不做 Korf 最佳解**：記憶體與最壞情況時間不符合零依賴單檔手機遊戲的定位。（依 D 節 82MB / 數小時數據支持）
3. **打亂**：以「隨機套用 20～25 步合法轉動」近似 random-state 效果，並標示非官方認證；有餘力再升級為真正 random-state。（推論）
4. **觸控操作**：手勢分流「劃在方塊面＝轉層／劃在背景或方塊外緣＝轉整體視角」為主，並提供備援的 Singmaster 按鈕面板（U D L R F B + ' + 2，共 24 顆或精簡版 12 顆）供 iPad 橫向兩側放置；避免重蹈實體 TouchCube「過度靈敏、誤觸」的覆轍。（依 A、B 節先例與反例支持）
5. **新手引導**：內建 LBL 七階段教學（十字→頂角→中層→底十字→底邊→底角排列→底角定向），逐步提示而非一次給全解。（依 C 節 Wikipedia/Ruwix 先例支持）
6. **差異化玩法**：市場上「打亂步數=復原步數上限」的限步挑戰與「每日挑戰」皆查無先例，屬空白區塊，可作為本遊戲賣點。（依 C 節「查無紀錄」結論支持，屬機會推論而非既有驗證）
7. **成就系統**：可參考 Magic Cube Puzzle 3D 已驗證的「成就＋排行榜」模式，但排行榜若要離線單機呈現，僅能做本機最佳紀錄，不做跨玩家排行（因遊戲要求無連線、無帳號）。（推論，依限制條件調整）

---

## 來源清單

- [Ruwix – Online Rubik's Cube Solver](https://ruwix.com/cube-solver/)
- [Ruwix – How To Solve The Rubik's Cube - Beginners Method](https://ruwix.com/the-rubiks-cube/how-to-solve-the-rubiks-cube-beginners-method/)
- [Ruwix – CubeTimer](https://ruwix.com/online-rubiks-stopwatch-timer/)
- [Grubiks – Online Rubik's Cube (3x3x3)](https://www.grubiks.com/puzzles/rubiks-cube-3x3x3/)
- [Grubiks – Rubik's Cube Solver 3x3x3](https://www.grubiks.com/solvers/rubiks-cube-3x3x3/)
- [GitHub – cubing/cubing.js](https://github.com/cubing/cubing.js/)
- [cubing.js README](https://github.com/cubing/cubing.js/blob/main/README.md)
- [csTimer](https://cstimer.net/)
- [The Cube App – App Store reviews](https://apps.apple.com/us/app/the-cube-app/id1247162314?see-all=reviews&platform=iphone)
- [NBC News – Rubik's TouchCube is a little too sensitive](https://www.nbcnews.com/id/wbna32987005)
- [GitHub – cs0x7f/min2phase](https://github.com/cs0x7f/min2phase)
- [GitHub – ldez/cubejs](https://github.com/ldez/cubejs)
- [GitHub – cubing/min2phase.js](https://github.com/cubing/min2phase.js)
- [Google Play – Magic Cube Puzzle 3D](https://play.google.com/store/apps/details?id=com.maximko.cuber&hl=en_IN)
- [Google Play – CubeX Solver, Timer, 3D Cube](https://play.google.com/store/apps/details?id=diozz.cubex&hl=en_IN)
- [Wikipedia – Optimal solutions for the Rubik's Cube](https://en.wikipedia.org/wiki/Optimal_solutions_for_the_Rubik%27s_Cube)
- [Wikipedia – Layer-by-layer method](https://en.wikipedia.org/wiki/Layer-by-layer_method)
- [Korf 1997 – Finding Optimal Solutions to Rubik's Cube Using Pattern Databases (AAAI-97 PDF)](https://cdn.aaai.org/AAAI/1997/AAAI97-109.pdf)
- [cube20.org – God's Number is 20](https://www.cube20.org/)
- [WCA – Scrambles](https://www.worldcubeassociation.org/regulations/scrambles/)
- [WCA Regulations and Guidelines (merged PDF)](https://regulations.worldcubeassociation.org/wca-regulations-and-guidelines.merged.pdf)
- [Speedsolving Wiki – Scrambling](https://www.speedsolving.com/wiki/index.php/Scrambling)
- [Speedsolving Wiki – Singmaster notation](https://www.speedsolving.com/wiki/index.php/Singmaster_notation)
- [WikiCube (Fandom) – Notation](https://rubiks.fandom.com/wiki/Notation)
- [KDE Kubrick – Singmaster Moves](https://docs.kde.org/stable_kf6/en/kubrick/kubrick/singmaster-moves.html)
- [Game Developer – Lessons from Suzy Cube: Mobile Controls That Feel Great](https://www.gamedeveloper.com/design/lessons-from-suzy-cube-mobile-controls-that-feel-great)
- [Material Design (m1) – Gestures Patterns](https://m1.material.io/patterns/gestures.html)
- [FMC Tutorial PDF (fmcsolves.cubing.net)](https://fmcsolves.cubing.net/fmc_tutorial_ENG.pdf)

## UNKNOWN／來源不可得清單

1. **UNKNOWN** — Thistlethwaite 演算法的現成 JS 開源實作與其授權條款（僅查到 C++ 版本，未逐一查證是否有對應 JS 版本或授權）。
2. **UNKNOWN** — LBL（層先法）步驟生成器的現成開源 JS 專案與授權（多數 App 為自行實作且未開源，未找到可直接引用的專案）。
3. **UNKNOWN** — 成熟、授權明確、適合嵌入單頁 HTML 的 Korf/Pattern-Database 完整 JS 實作（本次調研未找到；且即使存在，依 D 節分析也不建議採用）。
4. **來源不可得（需深入原始碼，非公開文件可查）** — cubing.js twisty player 內部區分「轉層」與「轉視角」手勢的具體判斷邏輯細節；本次僅能以其他 3D 互動 UI 的通用設計原則做推論延伸，未直接讀取該函式庫原始碼內的手勢處理程式。
5. **來源不可得（README 摘要未含 LICENSE 全文）** — `cubing/min2phase.js` 的具體授權條款文字（頁面片段僅提及存在 LICENSE.md 檔案，未展示條款內容）。
6. **查無紀錄** — 「打亂用了 N 步、限定玩家用 ≤N 步復原」這種明確規則的既有魔術方塊 App/網站案例（多次搜尋 App Store、Google Play、獨立遊戲平台均未找到）。
7. **查無紀錄** — 魔術方塊領域「每日挑戰（Daily Challenge）」機制的既有公開案例。
8. **UNKNOWN** — Ruwix 求解器所用「open-source Kociemba algorithm calculator」的具體專案名稱與授權條款（頁面僅描述功能，未附上原始碼連結或授權聲明）。
9. **UNKNOWN** — WCA 現行是否仍使用「Cube Explorer」或已完全改用 TNoodle 內建、非 Cube Explorer 的隨機狀態演算法版本；來源（speedsolving wiki）內容標註於 2012 年，可能已過時，未找到更新的官方說明頁面明確更新此細節。
10. **UNKNOWN** — WCA Regulation 4b3（打亂篩選規則）的具體條文內容（僅查到條文編號被引用，未展開查證 PDF 全文對應章節）。
