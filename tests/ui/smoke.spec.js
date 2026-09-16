#!/usr/bin/env node
// tests/ui/smoke.spec.js — T-001 S9：Playwright UI 測試進入點
//
// 依 CLAUDE.md §4：`npm run test:ui` = `node tests/ui/smoke.spec.js`；找不到 playwright 或
// 瀏覽器時印出可讀錯誤並以非 0 結束。手機直向 390×844 與 iPad 橫向 1194×834 各跑一次
// T-UI-01～T-UI-28（含 D-12「等提示時轉視角」；T-UI-24～28 為 S11 新增），截圖存 docs/qa/shots/。
// （T-UI-29、T-UI-30 是 UI 純邏輯的 Node 單元測試，在 tests/engine/ui-logic.test.js。）
//
// 依 docs/tickets/T-001/dispatch.md §3 S9：本檔不得修改 src/；缺測試掛鉤（window.__cubeTest）
// 或 DOM 選擇器時，回報而不是自己動手改 src/（見本檔各 check 的容錯與 docs/reports/T-001-S9.md）。
'use strict';

var path = require('path');
var fs = require('fs');

// ---------------------------------------------------------------------------
// 0) 找不到 playwright 套件本身：印可讀錯誤、非 0 結束（CLAUDE.md §4）
// ---------------------------------------------------------------------------
var chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  console.error('[test:ui] 找不到 playwright 套件，UI 測試無法執行。');
  console.error('[test:ui] 安裝：npm i -D playwright；瀏覽器：npx playwright install chromium');
  console.error('[test:ui] 雲端執行方式：NODE_PATH=<含 playwright 的 node_modules 路徑> node tests/ui/smoke.spec.js');
  console.error('[test:ui] 原始錯誤：' + e.message);
  process.exit(1);
}

var ROOT = path.resolve(__dirname, '..', '..');
var INDEX_PATH = path.join(ROOT, 'index.html');
var SHOTS_DIR = path.join(ROOT, 'docs', 'qa', 'shots');

if (!fs.existsSync(INDEX_PATH)) {
  console.error('[test:ui] 找不到 ' + INDEX_PATH + '，請先執行 npm run build（node build/bundle.js）。');
  process.exit(1);
}
try { fs.mkdirSync(SHOTS_DIR, { recursive: true }); } catch (e) { /* 已存在則忽略 */ }

var engine = require(path.join(ROOT, 'src', 'engine', 'index.js'));
var notation = require(path.join(ROOT, 'src', 'ui', 'notation.js'));
var texts = require(path.join(ROOT, 'src', 'data', 'texts.json'));
var params = require(path.join(ROOT, 'src', 'data', 'params.json'));
var palette = require(path.join(ROOT, 'src', 'data', 'palette.json'));
var lbl = require(path.join(ROOT, 'src', 'data', 'lbl.json'));

var checks1 = require('./checks.js');
var checks2 = require('./checks2.js');
var checks3 = require('./checks3.js'); // S11：架構審查退件修正的回歸測試（T-UI-24～T-UI-28）

var VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'ipad', width: 1194, height: 834 }
];

// ---------------------------------------------------------------------------
// 1) 找不到瀏覽器：chromium.launch() 會丟例外，包成可讀錯誤（CLAUDE.md §4）
// ---------------------------------------------------------------------------
async function launchBrowserOrExit() {
  try {
    return await chromium.launch();
  } catch (e) {
    console.error('[test:ui] 啟動 Chromium 失敗，可能是找不到已安裝的瀏覽器。');
    console.error('[test:ui] 安裝：npx playwright install chromium；或設定 PLAYWRIGHT_BROWSERS_PATH 指到已安裝的位置。');
    console.error('[test:ui] 原始錯誤：' + e.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 2) 依序執行 T-UI-01～T-UI-23、D-12（每個 check 內部各自開 context/page，互不干擾）
// ---------------------------------------------------------------------------
async function runViewport(browser, vp, results) {
  var env = {
    browser: browser,
    vp: vp,
    INDEX_BASE: 'file://' + INDEX_PATH,
    indexPath: INDEX_PATH,
    shotsDir: SHOTS_DIR,
    engine: engine,
    notation: notation,
    texts: texts,
    params: params,
    palette: palette,
    lbl: lbl,
    record: function (id, pass, detail) {
      results.push({ vp: vp.name, id: id, pass: !!pass, detail: detail || '' });
      console.log('[' + vp.name + '] ' + (pass ? 'PASS' : 'FAIL') + ' ' + id + (detail ? '  -- ' + detail : ''));
    }
  };

  // 依 dispatch 建議順序：先跑無互動依賴的基礎項，再跑會動用真求解器、較耗時的示範/教學情境，
  // 讓早期失敗能盡快浮現，不必等完整跑完才知道。任何一個 check 內部丟出未預期例外，都視為
  // 該 T-UI-* 失敗（catch 後仍記錄，不讓整個 runViewport 中斷，其餘測試繼續跑）。
  var steps = [
    ['T-UI-01', checks1.checkT01],
    ['T-UI-02', checks1.checkT02],
    ['T-UI-04', checks1.checkT04],
    ['T-UI-05', checks1.checkT05],
    ['T-UI-06', checks1.checkT06],
    ['D-12', checks1.checkD12],
    ['T-UI-11', checks1.checkT11],
    ['T-UI-12', checks1.checkT12],
    ['T-UI-13', checks1.checkT13],
    ['T-UI-18', checks2.checkT18],
    ['T-UI-19', checks2.checkT19],
    ['T-UI-20', checks2.checkT20],
    ['T-UI-23', checks1.checkT23],
    ['T-UI-10', checks1.checkT10],
    ['T-UI-15', checks2.checkT15],
    ['T-UI-16', checks2.checkT16],
    ['T-UI-17', checks2.checkT17],
    ['T-UI-03', checks1.checkT03],
    ['T-UI-07/08', checks2.checkSuggestFlow],
    ['T-UI-09/21/22', checks2.checkLblFlow],
    ['T-UI-14', checks2.checkT14],
    ['T-UI-24', checks3.checkT24],
    ['T-UI-25', checks3.checkT25],
    ['T-UI-26', checks3.checkT26],
    ['T-UI-27', checks3.checkT27],
    ['T-UI-28', checks3.checkT28]
  ];

  for (var i = 0; i < steps.length; i++) {
    var id = steps[i][0];
    var fn = steps[i][1];
    try {
      await fn(env);
    } catch (e) {
      env.record(id, false, '（測試腳本本身拋出例外）' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : e));
    }
  }
}

// ---------------------------------------------------------------------------
// 3) 主流程
// ---------------------------------------------------------------------------
async function main() {
  var t0 = Date.now();
  var browser = await launchBrowserOrExit();
  var results = [];
  try {
    for (var v = 0; v < VIEWPORTS.length; v++) {
      console.log('\n===== 視圖：' + VIEWPORTS[v].name + ' (' + VIEWPORTS[v].width + 'x' + VIEWPORTS[v].height + ') =====');
      await runViewport(browser, VIEWPORTS[v], results);
    }
  } finally {
    await browser.close();
  }

  var elapsedS = ((Date.now() - t0) / 1000).toFixed(1);

  // ---- 摘要 ----
  var byId = {};
  results.forEach(function (r) {
    byId[r.id] = byId[r.id] || {};
    byId[r.id][r.vp] = r;
  });
  var ids = Object.keys(byId);
  var totalFail = 0;
  console.log('\n===== 摘要（共 ' + ids.length + ' 項 × ' + VIEWPORTS.length + ' 視圖，耗時 ' + elapsedS + ' 秒）=====');
  ids.forEach(function (id) {
    var line = id + ':';
    VIEWPORTS.forEach(function (vp) {
      var r = byId[id][vp.name];
      var mark = r ? (r.pass ? 'PASS' : 'FAIL') : 'N/A';
      if (r && !r.pass) totalFail++;
      line += ' [' + vp.name + '=' + mark + ']';
    });
    console.log(line);
  });

  if (totalFail > 0) {
    console.log('\n共 ' + totalFail + ' 項失敗（詳細原因見上方逐項輸出）。');
    process.exit(1);
  } else {
    console.log('\n全部通過。');
    process.exit(0);
  }
}

main().catch(function (e) {
  console.error('[test:ui] 測試流程本身發生未預期例外：', e);
  process.exit(1);
});
