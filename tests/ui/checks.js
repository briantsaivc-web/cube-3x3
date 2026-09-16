// tests/ui/checks.js — T-UI-01～T-UI-23（含 D-12「等提示時轉視角」）的實際判定邏輯
//
// 依 docs/tickets/T-001/dispatch.md §3 S9、docs/spec/game-spec.md §12.5（含附錄 C 修訂對照）、
// docs/reports/T-001-S8a.md～S8e.md 的介面契約撰寫。本檔只呼叫 window.__cubeTest（getState／
// dispatch）與 DOM，不 require、不修改 src/。
//
// 每個 check 函式收到共用的 env（見 tests/ui/smoke.spec.js 建立），呼叫 env.record(id, pass, detail)
// 回報結果；env 提供：browser、vp、INDEX、engine（純函數，只在 Node 端算期望值，不代表 UI 呼叫它）、
// notation、texts、params、palette、lbl、H（tests/ui/dom-helpers.js）。
'use strict';

var H = require('./dom-helpers.js');

// ---------------------------------------------------------------------------
// 共用小工具
// ---------------------------------------------------------------------------

function withTutorialDone(env) {
  // 依 game-spec.md §12.5 備註：除 T-UI-16／T-UI-20 外，各測試開頁前先寫入 tutorialKey，
  // 避免教學卡片擋住操作。
  var key = env.params.storage.tutorialKey;
  return function (page) {
    return page.addInitScript(function (k) {
      try { window.localStorage.setItem(k, JSON.stringify({ v: 1, done: true })); } catch (e) { /* 忽略 */ }
    }, key);
  };
}

async function openFresh(env, opts) {
  // opts: {tutorialOff:boolean, presetTutorialDone:boolean, extra:string, contextOpts}
  opts = opts || {};
  var pc = await H.newPage(env.browser, env.vp, opts.contextOpts);
  if (opts.presetTutorialDone !== false) {
    await withTutorialDone(env)(pc.page);
  }
  var qs = '?test=1' + (opts.tutorialOff ? '&tutorial=0' : '') + (opts.extra || '');
  await pc.page.goto(env.INDEX_BASE + qs);
  await pc.page.waitForSelector('#keypad', { timeout: 15000 });
  await H.waitLayoutStable(pc.page, '#keypad'); // S11：等抽屜展開動畫結束再操作
  return pc;
}

async function newGame(page, seed) {
  await page.evaluate(function (s) {
    window.__cubeTest.dispatch({ type: 'NEW_GAME', payload: { seed: s, at: 0 } });
  }, seed);
}

/** 依真實 TURN action 直接 dispatch（跳過動畫等待，供不測試互動本身、只需要「已完成」狀態的情境使用）。 */
async function fastForwardMoves(page, moves) {
  await page.evaluate(function (mv) {
    var t = 0;
    mv.forEach(function (m) {
      t += 50;
      window.__cubeTest.dispatch({ type: 'TURN', payload: { move: m, at: t } });
    });
  }, moves);
}

async function solveBySeed(env, page, seed) {
  await newGame(page, seed);
  var st0 = await H.getState(page);
  var reverse = st0.scramble.slice().reverse().map(function (m) { return env.engine.inverse(m); });
  await fastForwardMoves(page, reverse);
  return H.getState(page);
}

function scanForbidden(text, forbiddenList) {
  var hits = [];
  forbiddenList.forEach(function (w) {
    if (text.indexOf(w) !== -1) hits.push(w);
  });
  return hits;
}

var FORBIDDEN_WORDS = ['Rubik', '最佳解', '最少步', '最短']; // Rubik、最佳解、最少步、最短

async function bodyText(page) {
  return page.evaluate(function () { return document.body.innerText; });
}

// ---------------------------------------------------------------------------
// T-UI-01：開啟無 console error；方塊與記號鍵出現
// ---------------------------------------------------------------------------

async function checkT01(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  try {
    var faces = await pc.page.evaluate(function () { return document.querySelectorAll('[data-sticker]').length; });
    var keys = await pc.page.evaluate(function () { return document.querySelectorAll('button.kp').length; });
    var pass = faces === 54 && keys === 36 && pc.errs.length === 0;
    env.record('T-UI-01', pass, 'faces=' + faces + ' keys=' + keys + ' errs=' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-02：打亂→R→步數1→展開中層→M→步數3→撤銷→1→重做→3→y→仍3
// ---------------------------------------------------------------------------

async function checkT02(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  try {
    var engine = env.engine;
    await newGame(pc.page, 1); // seed 任意，只看步數變化，不看打亂內容
    async function moves() { return env.engine.moveCount(await H.getState(pc.page)); }

    await pc.page.click('button.kp[data-move="R"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 120);
    var m1 = await moves();

    // 展開「中層（進階）」
    await pc.page.click('.kp-caption-toggle:has-text("' + env.texts.buttons.sliceFold + '")');
    await H.sleep(80);
    var expandedAfterClick = await pc.page.evaluate(function () {
      var t = Array.prototype.slice.call(document.querySelectorAll('.kp-caption-toggle'))
        .find(function (b) { return b.textContent.indexOf('中層') !== -1; });
      return t ? t.getAttribute('aria-expanded') : null;
    });

    await pc.page.click('button.kp[data-move="M"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 120);
    var m2 = await moves();

    await pc.page.click('#btnUndo');
    await H.sleep(80);
    var m3 = await moves();

    await pc.page.click('#btnRedo');
    await H.sleep(80);
    var m4 = await moves();

    await pc.page.click('button.kp[data-move="y"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 120);
    var m5 = await moves();

    var pass = m1 === 1 && expandedAfterClick === 'true' && m2 === 3 && m3 === 1 && m4 === 3 && m5 === 3;
    env.record('T-UI-02', pass,
      'm1=' + m1 + ' expanded=' + expandedAfterClick + ' m2=' + m2 + ' m3=' + m3 + ' m4=' + m4 + ' m5(after y)=' + m5);
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-03：可見的 button/[role=button]/[role=switch]/[role=tab] boundingBox >= 44x44
// 分別在：開局、中層展開、示範中(含分段暫停卡片)、教學卡片、記號小教室卡片、手機抽屜收合；
// S11 起另掃：提示卡、提示等待卡、示範等待卡、完成遮罩（架構審查 B-3、m-7）
// ---------------------------------------------------------------------------

async function sizeScan(page, label) {
  return page.evaluate(function (lb) {
    var sel = 'button, [role="button"], [role="switch"], [role="tab"]';
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    var bad = [];
    els.forEach(function (el) {
      var style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return; // 不可見（hidden 屬性等）
      if (r.width < 44 || r.height < 44) {
        bad.push({ label: lb, tag: el.tagName, cls: el.className, id: el.id, w: r.width, h: r.height, text: (el.textContent || '').slice(0, 20) });
      }
    });
    return { total: els.length, bad: bad };
  }, label);
}

async function shot(env, page, label) {
  if (!env.shotsDir) return;
  try {
    await page.screenshot({ path: env.shotsDir + '/' + env.vp.name + '-' + label + '.png' });
  } catch (e) { /* 截圖失敗不影響測試判定，僅記錄於 console */ console.log('screenshot failed:', label, e.message); }
}

async function checkT03(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  var allBad = [];
  var totalScanned = 0;
  try {
    // 1) 開局
    var s1 = await sizeScan(pc.page, 'open');
    totalScanned += s1.total; allBad = allBad.concat(s1.bad);
    await shot(env, pc.page, '01-open');

    // 2) 中層展開
    await pc.page.click('.kp-caption-toggle:has-text("' + env.texts.buttons.sliceFold + '")');
    await H.sleep(80);
    var s2 = await sizeScan(pc.page, 'slice-expanded');
    totalScanned += s2.total; allBad = allBad.concat(s2.bad);
    await shot(env, pc.page, '02-slice-expanded');

    // 3) 示範中（含分段暫停卡片）：用 seed=42 走層先法示範，快速跑到第一張分段暫停卡片
    await newGame(pc.page, 42);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoLbl);
    await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return !!(s.demo && !s.demo.pending);
    }, 20000);
    await H.clickButtonByText(pc.page, env.texts.buttons.speedFast);
    await H.clickButtonByText(pc.page, env.texts.buttons.play);
    var gotCard = await H.waitFor(async function () {
      return pc.page.evaluate(function () { return !!document.querySelector('.pause-card'); });
    }, 15000, 300);
    var s3 = await sizeScan(pc.page, 'demo-pause-card');
    totalScanned += s3.total; allBad = allBad.concat(s3.bad);
    if (!gotCard) allBad.push({ label: 'demo-pause-card', note: '未觀察到分段暫停卡片（seed=42 假設不成立）' });
    await shot(env, pc.page, '03-demo-pause-card');

    // 4) 教學卡片（T0）與 5) 記號小教室卡片（L1）：另開新 context（需要乾淨的 tutorialKey）
    await pc.context.close();
  } finally {
    // no-op；context 已於上方視情況關閉
  }

  var pc2 = await openFresh(env, { tutorialOff: false, presetTutorialDone: false });
  try {
    await pc2.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 8000 });
    var s4 = await sizeScan(pc2.page, 'tutorial-T0');
    totalScanned += s4.total; allBad = allBad.concat(s4.bad);
    await shot(env, pc2.page, '04-tutorial-T0');

    for (var i = 0; i < env.params.tutorial.notationBeforeIndex; i++) {
      await pc2.page.click('.lesson-next');
      await H.sleep(80);
    }
    var s5 = await sizeScan(pc2.page, 'lesson-L1');
    totalScanned += s5.total; allBad = allBad.concat(s5.bad);
    await shot(env, pc2.page, '05-lesson-L1');
  } finally {
    await pc2.context.close();
  }

  // 6) 手機直向抽屜收合（僅手機視圖有意義；iPad 視圖略過，該視圖沒有抽屜手把）
  if (env.vp.width < env.vp.height) {
    var pc3 = await openFresh(env, { tutorialOff: true });
    try {
      if (await pc3.page.evaluate(function () { return document.querySelector('#learnDrawer').classList.contains('expanded'); })) {
        await pc3.page.click('#handleTap');
        await H.sleep(80);
      }
      var s6 = await sizeScan(pc3.page, 'drawer-collapsed');
      totalScanned += s6.total; allBad = allBad.concat(s6.bad);
      await shot(env, pc3.page, '06-drawer-collapsed');
    } finally {
      await pc3.context.close();
    }
  }

  // 7)～10)（S11／B-3、m-7）：提示卡、提示等待卡、示範等待卡、完成遮罩
  var pc4 = await openFresh(env, { tutorialOff: true });
  try {
    await newGame(pc4.page, 17);
    await pc4.page.evaluate(function () {
      var t = window.__cubeTest;
      t.dispatch({ type: 'HINT_REQUEST', payload: { at: 0 } });
      t.dispatch({ type: 'HINT_READY', payload: { version: t.getState().version, tokens: ['R'], source: 'lbl', planQtm: null } });
    });
    await H.sleep(80);
    var hasHintCard = await pc4.page.evaluate(function () { return !!document.querySelector('.hint-card .hint-close'); });
    if (!hasHintCard) allBad.push({ label: 'hint-card', note: '提示卡未出現' });
    var s7 = await sizeScan(pc4.page, 'hint-card');
    totalScanned += s7.total; allBad = allBad.concat(s7.bad);
    await shot(env, pc4.page, '07-hint-card');

    // 提示等待卡（只送 HINT_REQUEST、不送結果，停在等待中）
    await pc4.page.evaluate(function () {
      var t = window.__cubeTest;
      t.dispatch({ type: 'HINT_CLEAR', payload: {} });
      t.dispatch({ type: 'HINT_REQUEST', payload: { at: 0 } });
    });
    await H.sleep(80);
    var hasHintWait = await pc4.page.evaluate(function () { return !!document.querySelector('.hint-slot .wait-card button'); });
    if (!hasHintWait) allBad.push({ label: 'hint-wait-card', note: '提示等待卡未出現' });
    var s8 = await sizeScan(pc4.page, 'hint-wait-card');
    totalScanned += s8.total; allBad = allBad.concat(s8.bad);
    await pc4.page.evaluate(function () {
      var t = window.__cubeTest;
      t.dispatch({ type: 'HINT_FAILED', payload: { version: t.getState().version, code: 'CANCELLED' } });
    });

    // 示範等待卡（在示範分頁；只送 DEMO_REQUEST、不送結果）
    await H.clickButtonByText(pc4.page, env.texts.buttons.demoOpen);
    await pc4.page.evaluate(function () {
      window.__cubeTest.dispatch({ type: 'DEMO_REQUEST', payload: { kind: 'suggest', at: 0 } });
    });
    await H.sleep(80);
    var hasDemoWait = await pc4.page.evaluate(function () { return !!document.querySelector('#panelDemo .wait-card button'); });
    if (!hasDemoWait) allBad.push({ label: 'demo-wait-card', note: '示範等待卡未出現' });
    var s9 = await sizeScan(pc4.page, 'demo-wait-card');
    totalScanned += s9.total; allBad = allBad.concat(s9.bad);
    await shot(env, pc4.page, '08-demo-wait-card');
    await pc4.page.evaluate(function () {
      var t = window.__cubeTest;
      t.dispatch({ type: 'DEMO_FAILED', payload: { version: t.getState().version, code: 'CANCELLED' } });
    });

    // 完成遮罩
    await solveBySeed(env, pc4.page, 99);
    await H.sleep(120);
    var maskShown = await pc4.page.evaluate(function () { return !document.querySelector('.overlay-mask').hidden; });
    if (!maskShown) allBad.push({ label: 'result-overlay', note: '完成遮罩未出現' });
    var s10 = await sizeScan(pc4.page, 'result-overlay');
    totalScanned += s10.total; allBad = allBad.concat(s10.bad);
    await shot(env, pc4.page, '09-result-overlay');
  } finally {
    await pc4.context.close();
  }

  env.record('T-UI-03', allBad.length === 0, 'scanned=' + totalScanned + ' bad=' + JSON.stringify(allBad).slice(0, 1500));
}

// ---------------------------------------------------------------------------
// T-UI-04：零外部請求（載入與遊玩過程中）
// ---------------------------------------------------------------------------

async function checkT04(env) {
  var pc = await openFresh(env, { tutorialOff: true, contextOpts: {} });
  try {
    var reqs = [];
    pc.page.on('request', function (r) { reqs.push(r.url()); });
    // 已經 goto 過（openFresh 內），重新導覽一次以確保攔截從一開始就在（此時尚未 attach listener 的請求
    // 也順便再玩一輪：打亂、轉動、開提示、開示範）。
    await pc.page.reload();
    await pc.page.waitForSelector('#keypad');
    await newGame(pc.page, 1);
    await pc.page.click('button.kp[data-move="R"]', { force: true });
    await H.sleep(300);
    await H.clickButtonByText(pc.page, env.texts.buttons.hint);
    await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return s.hint && s.hint.pending === false;
    }, 20000);
    var external = reqs.filter(function (u) {
      return u.indexOf('file://') !== 0 && u.indexOf('blob:') !== 0 && u.indexOf('about:') !== 0 && u.indexOf('data:') !== 0;
    });
    env.record('T-UI-04', external.length === 0, 'total=' + reqs.length + ' external=' + JSON.stringify(external));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-05：F 面中心貼紙往右拖 60px → 步數 +2 且方塊狀態等於做了 E
// ---------------------------------------------------------------------------

async function checkT05(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  try {
    await newGame(pc.page, 7);
    var before = await H.getState(pc.page);
    var center = await H.stickerCenter(pc.page, 22); // F 面中心（F0..F8 = 索引 18..26，中心=22）
    await H.firePointerPath(pc.page, H.linePath(center, { x: center.x + 60, y: center.y }, 6));
    await H.sleep(400);
    var after = await H.getState(pc.page);
    var expectedHome = env.engine.applyMove(before.home, env.engine.toHome(before.orient, 'E'));
    var pass = env.engine.moveCount(after) - env.engine.moveCount(before) === env.engine.qtmCost('E') &&
      JSON.stringify(after.home) === JSON.stringify(expectedHome);
    env.record('T-UI-05', pass, 'moveCountDelta=' + (env.engine.moveCount(after) - env.engine.moveCount(before)) +
      ' homeMatches=' + (JSON.stringify(after.home) === JSON.stringify(expectedHome)));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-06：方塊外拖曳 → orient 改變、步數不變、計時不開始
// ---------------------------------------------------------------------------

async function checkT06(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  try {
    await newGame(pc.page, 7);
    var before = await H.getState(pc.page);
    var pt = await H.outsideCubePoint(pc.page);
    await H.firePointerPath(pc.page, H.linePath(pt, { x: pt.x + 150, y: pt.y + 80 }, 10));
    await H.sleep((env.params.ui.snapAnimMs || 200) + 400);
    var after = await H.getState(pc.page);
    var pass = after.orient !== before.orient &&
      env.engine.moveCount(after) === env.engine.moveCount(before) &&
      after.timer.state === 'idle';
    env.record('T-UI-06', pass, 'orientBefore=' + before.orient + ' orientAfter=' + after.orient +
      ' moves=' + env.engine.moveCount(after) + ' timer=' + after.timer.state);
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-23：斜向拖曳約 74px 後放開 → orient 為 0-23 整數、transform 等於基準視角（容差 1°）、
// 步數不變、計時未開始；示範中拖曳放開 → orient 不變、畫面彈回
// ---------------------------------------------------------------------------

async function checkT23(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  try {
    await newGame(pc.page, 3);
    var before = await H.getState(pc.page);
    var pt = await H.outsideCubePoint(pc.page);
    // dx=dy=52 → 位移量 ≈ 73.5px（斜向），符合「約 74 px」。
    await H.firePointerPath(pc.page, H.linePath(pt, { x: pt.x + 52, y: pt.y + 52 }, 8));
    await H.sleep((env.params.ui.snapAnimMs || 200) + 400);
    var after = await H.getState(pc.page);

    // 「transform 等於該朝向的基準視角」：架構上 orient 靠貼紙顏色置換表示（見
    // docs/reports/T-001-S8a.md「運作原理提醒」），吸附動畫結束、SET_ORIENT 派送後
    // render() 一定會把 .cube-world 重設回單位矩陣；因此本測試改為驗證兩件等價的事：
    // (a) .cube-world 確實歸零（吸附動畫正常收尾，不是卡在某個中途角度）；
    // (b) 畫面上 54 張貼紙的顏色，逐一等於 palette.stickers[engine.viewStickers(state)[i]].hex
    //     （視覺確實反映 orient 對應的朝向），兩者合起來即是「transform 等於該朝向基準視角」
    //     的可觀察等價條件（容差 1° 因此無意義：吸附後恆為精確的單位矩陣，0 誤差）。
    var visual = await pc.page.evaluate(function () {
      var w = document.querySelector('.cube-world');
      var t = getComputedStyle(w).transform;
      var els = document.querySelectorAll('[data-sticker]');
      var colors = [];
      els.forEach(function (el) { colors[Number(el.dataset.sticker)] = getComputedStyle(el).backgroundColor; });
      return { transform: t, colors: colors };
    });
    var vs = env.engine.viewStickers(after);
    var colorMismatch = 0;
    for (var i = 0; i < 54; i++) {
      var expectedHex = env.palette.stickers[vs[i]].hex.toLowerCase();
      var actualHex = H.rgbToHex(visual.colors[i]);
      if (expectedHex !== actualHex) colorMismatch++;
    }
    var identityTransform = visual.transform === 'none' || /^matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)$/.test(visual.transform);

    var passSnap = Number.isInteger(after.orient) && after.orient >= 0 && after.orient <= 23 &&
      identityTransform && colorMismatch === 0 &&
      env.engine.moveCount(after) === env.engine.moveCount(before) &&
      after.timer.state === 'idle';

    // 示範中拖曳：orient 不變、畫面彈回（不送 action）
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoSuggest);
    await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return !!(s.demo && !s.demo.pending);
    }, 20000);
    var beforeDemo = await H.getState(pc.page);
    var pt2 = await H.outsideCubePoint(pc.page);
    await H.firePointerPath(pc.page, H.linePath(pt2, { x: pt2.x + 120, y: pt2.y + 60 }, 8));
    await H.sleep((env.params.ui.snapAnimMs || 200) + 400);
    var afterDemo = await H.getState(pc.page);
    var passDuringDemo = afterDemo.orient === beforeDemo.orient;

    var pass = passSnap && passDuringDemo;
    env.record('T-UI-23', pass, 'orient=' + after.orient + ' identityTransform=' + identityTransform +
      ' colorMismatch=' + colorMismatch + ' timer=' + after.timer.state +
      ' duringDemo.orientBefore=' + beforeDemo.orient + ' duringDemo.orientAfter=' + afterDemo.orient);
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// D-12：等提示時轉視角——hint.pending 期間，方塊外拖曳不得改變 orient（不送 ROTATE/SET_ORIENT）
// ---------------------------------------------------------------------------

async function checkD12(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  try {
    await newGame(pc.page, 5);
    await pc.page.evaluate(function () {
      window.__cubeTest.dispatch({ type: 'HINT_REQUEST', payload: { at: 0 } });
    });
    var before = await H.getState(pc.page);
    var pass1 = before.hint && before.hint.pending === true;
    var pt = await H.outsideCubePoint(pc.page);
    await H.firePointerPath(pc.page, H.linePath(pt, { x: pt.x + 150, y: pt.y + 80 }, 10));
    await H.sleep((env.params.ui.snapAnimMs || 200) + 400);
    var after = await H.getState(pc.page);
    var pass = pass1 && after.orient === before.orient && after.hint && after.hint.pending === true;
    env.record('D-12（等提示時轉視角）', pass,
      'hintPendingBefore=' + pass1 + ' orientBefore=' + before.orient + ' orientAfter=' + after.orient +
      ' hintPendingAfter=' + (after.hint && after.hint.pending));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-11：分頁隱藏（覆寫 document.visibilityState 並觸發 visibilitychange）→ 計時暫停
// ---------------------------------------------------------------------------

async function checkT11(env) {
  var pc = await openFresh(env, { tutorialOff: true });
  try {
    await newGame(pc.page, 9);
    await pc.page.click('button.kp[data-move="R"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 300);
    var running = (await H.getState(pc.page)).timer.state === 'running';
    await H.sleep(200);
    await pc.page.evaluate(function () {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await H.sleep(100);
    var after = await H.getState(pc.page);
    var pass = running && after.timer.state === 'paused';
    env.record('T-UI-11', pass, 'wasRunning=' + running + ' afterState=' + after.timer.state);
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-12：載入前 window.Worker=undefined → 狀態 mainThread → 提示仍可得到
// ---------------------------------------------------------------------------

async function checkT12(env) {
  var pc = await H.newPage(env.browser, env.vp);
  try {
    await withTutorialDone(env)(pc.page);
    await pc.page.addInitScript(function () { window.Worker = undefined; });
    await pc.page.goto(env.INDEX_BASE + '?test=1&tutorial=0');
    await pc.page.waitForSelector('#keypad');
    var workerGone = await pc.page.evaluate(function () { return typeof window.Worker === 'undefined'; });
    await newGame(pc.page, 11);
    await H.clickButtonByText(pc.page, env.texts.buttons.hint);
    var ok = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return s.hint && s.hint.pending === false;
    }, 25000);
    var st = await H.getState(pc.page);
    var pass = workerGone && ok && st.hint && !!st.hint.move && pc.errs.length === 0;
    env.record('T-UI-12', pass, 'workerGone=' + workerGone + ' hintOk=' + ok +
      ' hintMove=' + (st.hint && st.hint.move) + ' errs=' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-13：localStorage 存取拋例外 → 遊戲可完成一局且無 console error
// （spec：改用 ?test=1&tutorial=0）
// ---------------------------------------------------------------------------

async function checkT13(env) {
  var pc = await H.newPage(env.browser, env.vp);
  try {
    await pc.page.addInitScript(function () {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: function () { throw new Error('storage disabled (T-UI-13 test)'); }
      });
    });
    await pc.page.goto(env.INDEX_BASE + '?test=1&tutorial=0');
    await pc.page.waitForSelector('#keypad');
    var after = await solveBySeed(env, pc.page, 13);
    var pass = after.status === 'solved' && pc.errs.length === 0;
    env.record('T-UI-13', pass, 'status=' + after.status + ' errs=' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-10：無輔助完成（依打亂反序反向輸入）→ 完成畫面無徽章 → 紀錄寫入；
// 途中打開並關閉一次「記號說明」→ 完成畫面仍無徽章、紀錄仍寫入
// ---------------------------------------------------------------------------

async function checkT10(env) {
  var pc = await openFresh(env, { tutorialOff: false, presetTutorialDone: true });
  try {
    var recordsKey = env.params.storage.recordsKey;
    var recBefore = await pc.page.evaluate(function (k) { return window.localStorage.getItem(k); }, recordsKey);

    await newGame(pc.page, 21);
    var st0 = await H.getState(pc.page);
    var reverse = st0.scramble.slice().reverse().map(function (m) { return env.engine.inverse(m); });
    var half = Math.floor(reverse.length / 2);

    await H.pressKeypadSequential(pc.page, reverse.slice(0, half), env.params.ui.turnAnimMs);

    // 途中打開並關閉一次「記號說明」
    await H.clickButtonByText(pc.page, env.texts.buttons.notationHelp);
    await pc.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 5000 });
    var midState = await H.getState(pc.page);
    await H.clickButtonByText(pc.page, env.texts.buttons.lessonClose);
    await H.sleep(100);

    await H.pressKeypadSequential(pc.page, reverse.slice(half), env.params.ui.turnAnimMs);
    await H.sleep(200);

    var after = await H.getState(pc.page);
    var overlayHidden = await pc.page.evaluate(function () { return document.querySelector('.overlay-mask').hidden; });
    var badgeAssistHidden = await pc.page.evaluate(function () {
      var b = document.querySelector('.result-badges .badge:not(.badge-new)');
      return b ? b.hidden : true;
    });
    var recAfter = await pc.page.evaluate(function (k) { return window.localStorage.getItem(k); }, recordsKey);

    var pass = after.status === 'solved' && after.result && after.result.assist === 'none' &&
      !overlayHidden && badgeAssistHidden && recAfter && recAfter !== recBefore &&
      midState.assist.hint === false && midState.assist.demo === false;
    env.record('T-UI-10', pass,
      'status=' + after.status + ' assist=' + (after.result && after.result.assist) +
      ' overlayHidden=' + overlayHidden + ' badgeAssistHidden=' + badgeAssistHidden +
      ' recordsChanged=' + (recAfter !== recBefore) + ' midAssistUnchanged=' +
      (midState.assist.hint === false && midState.assist.demo === false));
  } finally {
    await pc.context.close();
  }
}

module.exports = {
  H: H,
  openFresh: openFresh,
  newGame: newGame,
  fastForwardMoves: fastForwardMoves,
  solveBySeed: solveBySeed,
  scanForbidden: scanForbidden,
  FORBIDDEN_WORDS: FORBIDDEN_WORDS,
  bodyText: bodyText,
  withTutorialDone: withTutorialDone,
  sizeScan: sizeScan,
  shot: shot,
  checkT01: checkT01,
  checkT02: checkT02,
  checkT03: checkT03,
  checkT04: checkT04,
  checkT05: checkT05,
  checkT06: checkT06,
  checkT23: checkT23,
  checkD12: checkD12,
  checkT11: checkT11,
  checkT12: checkT12,
  checkT13: checkT13,
  checkT10: checkT10
};
