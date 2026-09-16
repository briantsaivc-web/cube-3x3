# 審查包產生器範例（取自 cube-3x3 G4.5，2026-09-16 G7 拍板納入骨架）
# 用途：把程式碼片段、檔案清單、已知問題從 repo 直接抽出來組成審查包，模型只寫說明文字。
# 新遊戲使用前要改：ROOT、BATCH（每包的標題、白話說明、檔案清單）、bg（專案背景摘要）。
# 本檔是範例，不在 build 與測試範圍內。
import os, re, subprocess
ROOT='/home/claude/cube-3x3'
tpl=open(f'{ROOT}/docs/templates/審查包.md',encoding='utf-8').read()
s0=tpl[tpl.index('## 0.'):tpl.index('## 1.')].rstrip().rstrip('-').rstrip()
BATCH={
1:('engine（狀態機、方塊模型、打亂）與資料檔','src/engine/ 是純函數 reducer：方塊以 54 格貼紙＋24 種整顆朝向表示，所有規則（轉動、QTM 計步、撤銷、計時狀態、提示與示範狀態）都在這裡；src/data/ 是文案、配色、參數與層先法公式。',
   ['src/engine/rng.js','src/engine/cube.js','src/engine/scramble.js','src/engine/selectors.js','src/engine/reducer.js','src/engine/index.js','src/data/texts.json','src/data/palette.json','src/data/params.json','src/data/lbl.json']),
2:('求解器（兩階段法、層先法、Worker 協定）','src/solver/ 是求解器：twophase.js 是自寫的 Kociemba 兩階段法（以 QTM 成本搜尋、搜尋節點上限控時、不讀時鐘），lbl.js 是層先法分段產生器（依 src/data/lbl.json 的公式），worker.js 是 Web Worker 的訊息處理（本身不綁 self.onmessage，由 build 包一層）。',
   ['src/solver/twophase.js','src/solver/lbl.js','src/solver/worker.js']),
3:('UI 骨架（主程式、記號鍵、手勢、CSS 3D 方塊、求解器用戶端）','src/ui/ 是畫面層，只呈現 engine 的 state 並送出 action：app.js 建 store 與輸入佇列；cube-view.js 以 CSS 3D 畫方塊；controls.js 是記號鍵與操作列；gesture.js 是觸控手勢；notation.js 產生記號的白話說明；solver-client.js 管理 Worker、逾時、快取與退回。',
   ['src/ui/app.js','src/ui/controls.js','src/ui/gesture.js','src/ui/cube-view.js','src/ui/notation.js','src/ui/solver-client.js','src/ui/index.template.html','src/ui/styles.css']),
4:('UI 學習功能（示範播放器、提示、首次教學、完成畫面）與打包腳本','demo-player.js 是「建議解示範／層先法示範」播放器（分段暫停卡片、白話說明）；hint-view.js 是提示；tutorial.js 是首次教學與「記號小教室」；records.js 是完成畫面與本機最佳紀錄；build/bundle.js 把 src/ 打包成單一 index.html 並產生 Worker 字串。',
   ['src/ui/demo-player.js','src/ui/hint-view.js','src/ui/tutorial.js','src/ui/records.js','src/ui/demo.css','src/ui/overlay.css','build/bundle.js']),
}
ALL=[f for b in BATCH.values() for f in b[2]]
bg='''## 1. 專案背景（從 CLAUDE.md 第 1、3 節摘要）

- 類型：經典三階魔術方塊（3x3x3）單頁網頁遊戲；定位是讓手邊沒有實體方塊的人可以玩，也可以看電腦怎麼解（學習用）
- 玩法：單人自由練習（打亂、轉動、撤銷／重做、重設、計時、步數）＋提示下一步＋看電腦解（建議解示範、層先法分段示範）；無連線、無帳號、無金流
- 計步：QTM（外層 90°＝1 步、180°＝2 步；中層 M/E/S 90°＝2 步、180°＝4 步；整顆旋轉與拖曳視角＝0 步）
- 3D：CSS 3D transforms；求解器自寫，於 Web Worker 執行（Worker 程式以 Blob 由同一檔案產生）；畫面稱「建議解」，不得稱「最佳解」
- 交付：單一 `index.html`（由 `build/` 打包 `src/`），零依賴、可離線；平台：iPad 橫向、手機直向，觸控優先；語言：繁體中文

架構原則（違反即 Blocker）：
1. 狀態只能透過 action 前進；engine 層是純函數，不讀時間、DOM、網路、計時器、全域變數。（本案另規定 `src/solver/` 同樣不得讀時鐘，以搜尋節點上限控制搜尋長度）
2. 所有隨機數來自 seeded RNG；不得使用 `Math.random()`；同 seed ＋ 同 action 序列必須可重放。
3. 參數資料驅動；數值、機率、內容放 `src/data/` JSON，程式碼裡寫死的平衡數字就是 bug。
4. 觸控優先；可點元素最小 44×44 px；不依賴 hover、右鍵、鍵盤。
5. 零依賴；不載入 CDN、不外連字型、不用第三方套件。
'''
def tests_section():
    rows=[]
    for f in sorted(os.listdir(f'{ROOT}/tests/engine'))+['solver/'+x for x in sorted(os.listdir(f'{ROOT}/tests/engine/solver'))]:
        p=f'{ROOT}/tests/engine/{f}'
        if not p.endswith('.test.js'): continue
        ids=sorted(set(re.findall(r'T-(?:ENG|SOL|LBL|BUILD|UI|DATA)-\d+',open(p,encoding='utf-8').read())),key=lambda s:(s.split('-')[1],int(s.split('-')[2])))
        rows.append(f'| `tests/engine/{f}` | {"、".join(ids) if ids else "solver-client 情境測試（C-01～C-13）"} | 通過 |')
    uid=sorted(set(re.findall(r'T-UI-\d+',open('/tmp/claude-0/-home-claude/91c81ae3-d6de-542f-ad9b-e455c81b8d2e/scratchpad/ui-chief.log',encoding='utf-8').read())),key=lambda s:int(s.split('-')[2]))
    rows.append(f'| `tests/ui/smoke.spec.js`（含 checks.js、checks2.js、checks3.js） | {"、".join(uid)}（手機 390×844 與 iPad 1194×834 各跑一次） | 通過 |')
    return '''## 4. 測試清單（全部批次共用）

| 測試檔 | 測試編號 | 最近一次結果 |
|---|---|---|
'''+'\n'.join(rows)+'''

測試指令：`node --test "tests/engine/**/*.test.js"`、`node build/bundle.js`、`node tests/ui/smoke.spec.js`；輸出摘要（2026-09-15）：

```
# pass 89
# fail 0
（engine，約 3 分 17 秒）
build 完成：index.html（371508 bytes；Worker 字串 84029 bytes；零外部資源）
T-UI-01～T-UI-28：[phone=PASS] [ipad=PASS]；全部通過。（UI，約 4 分 37 秒）
```

測試編號的定義在規格書（未附）；看不懂測試在驗什麼時，請列入「疑似」並說明需要什麼資訊。
'''
known='''## 5. 已知問題（不必重複回報）

| # | 來源 | 內容 | 目前處置 |
|---|---|---|---|
| 1 | 內部審查 | `src/ui/cube-view.js`、`notation.js`、`gesture.js`、`controls.js` 各自維護旋轉軸與轉向判斷，與 `src/engine/cube.js` 的定義重複；目前只影響動畫方向與鍵盤分組，最終狀態以 engine 為準 | 下版修 |
| 2 | 內部審查 | `src/ui/tutorial.js`、`records.js` 直接使用全域 `document`／`window`，未使用注入的文件物件 | 下版修 |
| 3 | 內部審查 | 部分固定符號（`<title>`、`?`、`×`、`✓`、全形括號）寫在程式或樣板中，未放進 `texts.json`；`texts.json`／`params.json` 有少數未使用的鍵 | 下版修 |
| 4 | 內部審查 | `src/solver/twophase.js` 的註解與一個內部錯誤訊息含「最少步」「最佳解」字樣（不會顯示在畫面上） | 刻意不處理 |
| 5 | 工程師回報 | 第一步轉動動畫進行中，「撤銷」鍵仍是停用狀態 | 待真機觀察 |
| 6 | 工程師回報 | 帶時間戳的 action 未檢查 `at` 是否為有效數字 | 下版修 |
| 7 | 尚未驗證 | iPad Safari 實機的 CSS 3D 顯示、Blob Worker 建立與建表時間（桌機 Chromium 約 1.2–1.4 秒） | 待真機測 |
| 8 | 尚未驗證 | 手勢手感（方向判定門檻 30°、最小滑動距離）尚未真人測試 | 待真機測 |
'''
tail=tpl[tpl.index('## 6.'):]
def fence(path):
    txt=open(f'{ROOT}/{path}',encoding='utf-8').read()
    lines=txt.split('\n')
    if lines and lines[-1]=='': lines=lines[:-1]
    w=len(str(len(lines)))
    body='\n'.join(f'{i+1:>{w}}  {l}' for i,l in enumerate(lines))
    fence='````' if '```' in txt else '```'
    ext=path.rsplit('.',1)[1]
    return len(lines), f'{fence}{ext}\n{body}\n{fence}'
report=[]
for n,(title,role,files) in BATCH.items():
    parts=[f'# 審查包：T-001 魔術方塊 v0.1（第 {n}／4 批：{title}）\n',
           '> 本檔可單獨貼給外部 AI。四批合計為本次變更的全部程式碼。\n',
           s0,'',f'**本批是第 {n}／4 批，其他批次的檔案不在這裡，若問題牽涉其他批次，請在「疑似」清單註明。**','','---','',bg,
           '## 2. 本次任務摘要\n',
           '- 目標：使用者在 iPad／手機上打開單一 `index.html`，可以打亂、用手勢或記號鍵轉方塊、撤銷／重做／重設、看計時與 QTM 步數；卡住時看下一步提示，或看電腦用建議解與層先法逐步示範；全程斷網可用。',
           '- 驗收條件：自動測試全部通過（見第 4 節）；以下項目由人工在實機驗收（尚未進行）：iPad／手機實機顯示與建表時間、手勢手感、零基礎者能否跟著教學學會層先法。',
           f'- 本批檔案在整體中的角色：{role}',
           '- 四批的檔案分配：'+'；'.join(f'第 {k} 批 '+'、'.join(f'`{x}`' for x in v[2]) for k,v in BATCH.items())+'。','',
           f'## 3. 變更檔案的完整程式碼（有行號，全部為新增檔案）\n\n本批包含：{"、".join(f"`{x}`" for x in files)}。\n']
    for i,f in enumerate(files,1):
        cnt,code=fence(f)
        wc=int(subprocess.check_output(['wc','-l',f'{ROOT}/{f}']).split()[0])
        report.append((n,f,cnt,wc))
        parts.append(f'### 3.{i} `{f}`（新增，{cnt} 行）\n\n{code}\n')
    parts+=[tests_section(),known,tail]
    out='\n'.join(parts)
    open(f'{ROOT}/docs/reviews/T-001/review-pack-{n}.md','w',encoding='utf-8').write(out)
    print(n, len(out.encode()), 'bytes')
for r in report: print(r, 'OK' if r[2] in (r[3], r[3]+1) else 'MISMATCH')
