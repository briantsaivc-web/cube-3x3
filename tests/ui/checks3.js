// tests/ui/checks3.js — S11：架構審查退件修正的 UI 回歸測試（T-UI-24～T-UI-28）
//
// 依 docs/reports/T-001-arch-review.md §10 與 T-001-arch-decisions.md D-23～D-27：
//   T-UI-24  B-1：示範等待中取消；建議解 NODE_LIMIT → 「改看層先法示範」出現並可進入
//   T-UI-25  B-2：非 0 朝向點一下不改朝向；連拖累加；吸附後畫面與 viewStickers 一致
//   T-UI-26  K-1／m-2（D-26）：快速連點 R 兩次得到兩步；打亂／重設與未送出的轉動競態；佇列上限；撤銷依序
//   T-UI-27  MJ-2（D-24）／m-6：完成畫面顯示本機最佳紀錄、儲存不可用時不顯示；「看看方塊」關閉遮罩
//   T-UI-28  MJ-1（D-25）：keypad.showSubLabels、faceLabels.forceOnInTutorial、turnAnimMs＝0、
//            scrambleAnimMsPerMove＝0 確實生效
// 參數覆寫用 ?test=1&paramsPatch=<JSON>（app.js 測試掛鉤，只在 test=1 時生效）。
'use strict';

var C = require('./checks.js');
var H = C.H;

function patchQs(patch) {
  return '&paramsPatch=' + encodeURIComponent(JSON.stringify(patch));
}

function formatTime(ms) {
  var totalDeci = Math.floor(Math.max(0, ms) / 100);
  var m = Math.floor(totalDeci / 600);
  var s = Math.floor((totalDeci % 600) / 10);
  var d = totalDeci % 10;
  return m + ':' + (s < 10 ? '0' + s : String(s)) + '.' + d;
}

async function readVisual(page) {
  return page.evaluate(function () {
    var w = document.querySelector('.cube-world');
    var colors = [];
    document.querySelectorAll('[data-sticker]').forEach(function (el) {
      colors[Number(el.dataset.sticker)] = getComputedStyle(el).backgroundColor;
    });
    return { transform: getComputedStyle(w).transform, colors: colors };
  });
}

function colorMismatch(env, state, visual) {
  var vs = env.engine.viewStickers(state);
  var bad = 0;
  for (var i = 0; i < 54; i++) {
    if (env.palette.stickers[vs[i]].hex.toLowerCase() !== H.rgbToHex(visual.colors[i])) bad++;
  }
  return bad;
}

function isIdentityTransform(t) {
  return t === 'none' || /^matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)$/.test(t) ||
    /^matrix3d\(1,\s*0,\s*0,\s*0,\s*0,\s*1,\s*0,\s*0,\s*0,\s*0,\s*1,\s*0,\s*0,\s*0,\s*0,\s*1\)$/.test(t);
}

// ---------------------------------------------------------------------------
// T-UI-24（B-1）
// ---------------------------------------------------------------------------

async function checkT24(env) {
  var detail = [];
  var pass = true;
  function fail(m) { pass = false; detail.push('FAIL:' + m); }

  // A) 兩種示範：等待卡片出現的同一個事件迴圈內按「取消」（保證仍在等待中）→ demo 回到 null
  var pc = await C.openFresh(env, { tutorialOff: true });
  try {
    await C.newGame(pc.page, 42);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    var kinds = [['suggest', env.texts.buttons.demoSuggest], ['lbl', env.texts.buttons.demoLbl]];
    for (var i = 0; i < kinds.length; i++) {
      var r = await pc.page.evaluate(function (args) {
        var btn = Array.prototype.find.call(document.querySelectorAll('button'), function (b) { return b.textContent === args.label; });
        btn.click();
        var pendingBefore = window.__cubeTest.getState().demo;
        var cancel = Array.prototype.find.call(document.querySelectorAll('.wait-card button'), function (b) { return b.textContent === args.cancel; });
        if (!cancel) return { pendingBefore: pendingBefore, noCancel: true };
        cancel.click();
        return { pendingBefore: pendingBefore };
      }, { label: kinds[i][1], cancel: env.texts.buttons.cancel });
      if (r.noCancel) fail(kinds[i][0] + '：等待卡片沒有「取消」鈕');
      if (!(r.pendingBefore && r.pendingBefore.pending && r.pendingBefore.kind === kinds[i][0])) fail(kinds[i][0] + '：按下後應為等待中');
      var cleared = await H.waitFor(async function () { return (await H.getState(pc.page)).demo === null; }, 3000, 50);
      if (!cleared) fail(kinds[i][0] + '：取消後 demo 未回到 null（仍卡在等待中）');
      var waitCardGone = await pc.page.evaluate(function () { return !document.querySelector('#panelDemo .wait-card'); });
      if (!waitCardGone) fail(kinds[i][0] + '：取消後等待卡片仍在');
      var demoTabOn = await pc.page.evaluate(function () { return !document.querySelector('#panelDemo').hidden; });
      if (!demoTabOn) fail(kinds[i][0] + '：取消後應留在示範分頁（可以改選另一種示範）');
      var btnsEnabled = await pc.page.evaluate(function () {
        return Array.prototype.every.call(document.querySelectorAll('.demo-kind-btn'), function (b) { return !b.disabled; });
      });
      if (!btnsEnabled) fail(kinds[i][0] + '：取消後示範種類按鈕應可再按');
    }
    // 取消後可以照常轉動（沒有被等待狀態擋住）：切回「操作」分頁按 R
    await pc.page.click('#tabControls');
    await H.pressKeypadSequential(pc.page, ['R'], env.params.ui.turnAnimMs);
    // 真實時序：按下後等一下再取消（求解器仍在建表或計算中）
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoSuggest);
    await H.sleep(150);
    var st = await H.getState(pc.page);
    if (st.demo && st.demo.pending) {
      await H.clickButtonByText(pc.page, env.texts.buttons.cancel);
      var cleared2 = await H.waitFor(async function () { return (await H.getState(pc.page)).demo === null; }, 3000, 50);
      if (!cleared2) fail('延遲取消後 demo 未回到 null');
    } else {
      detail.push('NOTE:150ms 內求解已完成，延遲取消情境略過');
    }
    if (pc.errs.length) fail('取消流程出現頁面錯誤：' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }

  // B) 建議解 NODE_LIMIT（firstNodeLimit 設很小）→ 顯示「這次沒算出建議解」＋「改看層先法示範」→ 可以進入
  var pc2 = await C.openFresh(env, { tutorialOff: true, extra: patchQs({ solver: { firstNodeLimit: 1000 } }) });
  try {
    await C.newGame(pc2.page, 42);
    await H.clickButtonByText(pc2.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc2.page, env.texts.buttons.demoSuggest);
    // 失敗訊息與按鈕必須「看得到」（所在分頁沒有被隱藏），不是只存在於 DOM
    var shown = await H.waitFor(async function () {
      return pc2.page.evaluate(function (args) {
        function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
        var err = document.querySelector('.demo-error');
        var tryBtn = Array.prototype.find.call(document.querySelectorAll('button'), function (b) { return b.textContent === args.tryLbl; });
        return !!(err && err.textContent === args.msg && visible(err) && tryBtn && visible(tryBtn));
      }, { msg: env.texts.demo.suggestUnavailable, tryLbl: env.texts.buttons.tryLbl });
    }, 30000, 200);
    if (!shown) fail('NODE_LIMIT 後未出現「' + env.texts.demo.suggestUnavailable + '」與「' + env.texts.buttons.tryLbl + '」');
    var afterFail = await H.getState(pc2.page);
    if (afterFail.demo !== null) fail('NODE_LIMIT 後 demo 應為 null');
    if (afterFail.assist.demo) fail('求解失敗不算看過示範（assist.demo 應為 false）');
    var rejects = await pc2.page.evaluate(function () { return window.__cubeTest.rejects(); });
    await C.shot(env, pc2.page, '24-node-limit');
    if (shown) {
      await pc2.page.click('button:text-is("' + env.texts.buttons.tryLbl + '")'); // 真的點擊看得到的按鈕
      var lblReady = await H.waitFor(async function () {
        var s = await H.getState(pc2.page);
        return !!(s.demo && s.demo.kind === 'lbl' && !s.demo.pending);
      }, 20000);
      if (!lblReady) fail('按「' + env.texts.buttons.tryLbl + '」後層先法示範未就緒');
      var segRows = await pc2.page.evaluate(function () { return document.querySelectorAll('.segment-row').length; });
      if (segRows !== 8) fail('層先法分段清單應為 8 段，實得 ' + segRows);
    }
    if (pc2.errs.length) fail('NODE_LIMIT 流程出現頁面錯誤：' + JSON.stringify(pc2.errs));
    detail.push('rejects=' + rejects.length);
  } finally {
    await pc2.context.close();
  }

  env.record('T-UI-24', pass, detail.join(' | ') || 'ok');
}

// ---------------------------------------------------------------------------
// T-UI-25（B-2）
// ---------------------------------------------------------------------------

async function checkT25(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  var detail = [];
  var pass = true;
  function fail(m) { pass = false; detail.push('FAIL:' + m); }
  var settle = (env.params.ui.snapAnimMs || 200) + 400;
  try {
    var engine = env.engine;
    await C.newGame(pc.page, 7);
    await H.pressKeypadSequential(pc.page, ['y'], env.params.ui.turnAnimMs);
    var s0 = await H.getState(pc.page);
    if (s0.orient === 0) fail('按 y 後朝向應不是 0');
    var pt = await H.outsideCubePoint(pc.page);

    // 點一下（不移動）
    await H.firePointerPath(pc.page, [pt]);
    await H.sleep(settle);
    var s1 = await H.getState(pc.page);
    if (s1.orient !== s0.orient) fail('非 0 朝向點一下不應改變 orient：' + s0.orient + '→' + s1.orient);
    var v1 = await readVisual(pc.page);
    if (!isIdentityTransform(v1.transform)) fail('點一下後 transform 應歸零：' + v1.transform);
    if (colorMismatch(env, s1, v1)) fail('點一下後畫面與 viewStickers 不一致');

    // 水平連拖兩次（每次約 90°）：依目前朝向累加，各等於一次 y′
    var orients = [s1.orient];
    for (var k = 0; k < 2; k++) {
      await H.firePointerPath(pc.page, H.linePath(pt, { x: pt.x + 180, y: pt.y }, 12));
      await H.sleep(settle);
      var sk = await H.getState(pc.page);
      var expected = engine.orientAfter(orients[orients.length - 1], "y'");
      if (sk.orient !== expected) fail('第 ' + (k + 1) + ' 次水平拖曳：orient=' + sk.orient + '，應為 ' + expected);
      var vk = await readVisual(pc.page);
      if (!isIdentityTransform(vk.transform)) fail('第 ' + (k + 1) + ' 次拖曳後 transform 應歸零：' + vk.transform);
      var mm = colorMismatch(env, sk, vk);
      if (mm) fail('第 ' + (k + 1) + ' 次拖曳後有 ' + mm + ' 格顏色與 viewStickers 不一致');
      orients.push(sk.orient);
    }
    if (orients[1] === orients[0] || orients[2] === orients[1]) fail('連拖兩次沒有累加：' + orients.join('→'));

    // 垂直拖曳（從非 0 朝向）：等於一次 x 或 x′
    var before = await H.getState(pc.page);
    await H.firePointerPath(pc.page, H.linePath(pt, { x: pt.x, y: pt.y + 170 }, 12));
    await H.sleep(settle);
    var after = await H.getState(pc.page);
    var okV = [engine.orientAfter(before.orient, 'x'), engine.orientAfter(before.orient, "x'")].indexOf(after.orient) !== -1;
    if (!okV) fail('垂直拖曳：orient ' + before.orient + '→' + after.orient + ' 不是 x／x′');
    var vv = await readVisual(pc.page);
    if (colorMismatch(env, after, vv)) fail('垂直拖曳後畫面與 viewStickers 不一致');

    // 小角度拖曳放開：彈回、不改朝向
    await H.firePointerPath(pc.page, H.linePath(pt, { x: pt.x + 40, y: pt.y + 20 }, 6));
    await H.sleep(settle);
    var small = await H.getState(pc.page);
    if (small.orient !== after.orient) fail('小角度拖曳不應改朝向：' + after.orient + '→' + small.orient);

    if (engine.moveCount(small) !== 0 || small.timer.state !== 'idle') fail('轉視角不應計步或開始計時');
    if (pc.errs.length) fail('頁面錯誤：' + JSON.stringify(pc.errs));
    detail.push('orients=' + orients.join('→') + ' vertical=' + before.orient + '→' + after.orient);
  } finally {
    await pc.context.close();
  }
  env.record('T-UI-25', pass, detail.join(' | '));
}

// ---------------------------------------------------------------------------
// T-UI-26（K-1、m-2；D-26）
// ---------------------------------------------------------------------------

async function checkT26(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  var detail = [];
  var pass = true;
  function fail(m) { pass = false; detail.push('FAIL:' + m); }
  var engine = env.engine;
  var animMs = env.params.ui.turnAnimMs;
  try {
    // A) K-1：間隔 60 ms 連點 R 兩次 → 兩步
    await C.newGame(pc.page, 9);
    var a0 = await H.getState(pc.page);
    await pc.page.evaluate(function () {
      document.querySelector('button.kp[data-move="R"]').click();
      setTimeout(function () { document.querySelector('button.kp[data-move="R"]').click(); }, 60);
    });
    await H.waitFor(async function () { return (await pc.page.evaluate(function () { return window.__cubeTest.inputIdle(); })); }, 3000, 50);
    var a1 = await H.getState(pc.page);
    var expectedA = engine.applyMoves(a0.home, ['R', 'R']);
    if (a1.cursor !== 2) fail('K-1：快速連點 R 兩次應得到 2 步，實得 ' + a1.cursor);
    if (JSON.stringify(a1.home) !== JSON.stringify(expectedA)) fail('K-1：方塊狀態應等於做了 R R');
    if (engine.moveCount(a1) !== 2) fail('K-1：步數應為 2');

    // B) m-2：按 R 後 30 ms 內按「打亂」→ 新局不帶那一步、計時未開始
    await C.newGame(pc.page, 9);
    await pc.page.evaluate(function () {
      document.querySelector('button.kp[data-move="R"]').click();
      setTimeout(function () { document.querySelector('#btnScramble').click(); }, 30);
    });
    await H.sleep(animMs + 200);
    var b1 = await H.getState(pc.page);
    if (b1.history.length !== 0) fail('m-2：打亂後的新局不應帶著舊的轉動（history=' + b1.history.length + '）');
    if (b1.timer.state !== 'idle') fail('m-2：打亂後計時不應開始（' + b1.timer.state + '）');
    if (JSON.stringify(b1.home) !== JSON.stringify(b1.start)) fail('m-2：新局 home 應等於 start');
    var unlocked = await H.waitFor(async function () {
      return pc.page.evaluate(function () { return !window.__cubeTest.inputLocked() && window.__cubeTest.inputIdle(); });
    }, 12000, 100);
    if (!unlocked) fail('m-2：打亂動畫應在時間內結束並解鎖');
    await pc.page.click('button.kp[data-move="U"]', { force: true });
    var appliedU = await H.waitFor(async function () { return (await H.getState(pc.page)).cursor === 1; }, 3000, 50);
    if (!appliedU) fail('m-2：打亂動畫結束後按 U 應正常套用');
    var b2 = await H.getState(pc.page);
    if (b2.timer.state !== 'running') fail('m-2：新局第一個轉動後才開始計時（' + b2.timer.state + '）');

    // C) 按 R 後 30 ms 內按「重設」→ 那一步作廢
    await C.newGame(pc.page, 9);
    await pc.page.evaluate(function () {
      document.querySelector('button.kp[data-move="R"]').click();
      setTimeout(function () { document.querySelector('#btnReset').click(); }, 30);
    });
    await H.sleep(animMs + 300);
    var c1 = await H.getState(pc.page);
    if (c1.history.length !== 0 || c1.timer.state !== 'idle' || JSON.stringify(c1.home) !== JSON.stringify(c1.start)) {
      fail('重設後尚未送出的轉動應作廢（history=' + c1.history.length + ' timer=' + c1.timer.state + '）');
    }

    // D) 佇列上限：同一瞬間點 R 六次 → 播放中 1 ＋ 排隊 queueMax
    await C.newGame(pc.page, 9);
    await pc.page.evaluate(function () {
      for (var i = 0; i < 6; i++) document.querySelector('button.kp[data-move="R"]').click();
    });
    await H.waitFor(async function () { return (await pc.page.evaluate(function () { return window.__cubeTest.inputIdle(); })); }, 5000, 50);
    var d1 = await H.getState(pc.page);
    var cap = 1 + env.params.input.queueMax;
    if (d1.cursor !== cap) fail('佇列上限：應套用 ' + cap + ' 步，實得 ' + d1.cursor);

    // E) 撤銷依序：R 已套用後，點 U 再立刻點撤銷 → 先做 U 再撤銷 U（結果＝只有 R）
    await C.newGame(pc.page, 9);
    var e0 = await H.getState(pc.page);
    await H.pressKeypadSequential(pc.page, ['R'], animMs);
    await pc.page.evaluate(function () {
      document.querySelector('button.kp[data-move="U"]').click();
      document.querySelector('#btnUndo').click();
    });
    await H.waitFor(async function () { return (await pc.page.evaluate(function () { return window.__cubeTest.inputIdle(); })); }, 3000, 50);
    var e1 = await H.getState(pc.page);
    var expectedE = engine.applyMoves(e0.home, ['R']);
    if (JSON.stringify(e1.home) !== JSON.stringify(expectedE) || e1.cursor !== 1 || e1.history.length !== 2) {
      fail('撤銷應在排隊中的 U 之後執行（cursor=' + e1.cursor + ' history=' + e1.history.length + '）');
    }

    if (pc.errs.length) fail('頁面錯誤：' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }
  env.record('T-UI-26', pass, detail.join(' | ') || 'ok');
}

// ---------------------------------------------------------------------------
// T-UI-27（MJ-2、m-6）
// ---------------------------------------------------------------------------

async function checkT27(env) {
  var detail = [];
  var pass = true;
  function fail(m) { pass = false; detail.push('FAIL:' + m); }
  var recordsKey = env.params.storage.recordsKey;

  var pc = await C.openFresh(env, { tutorialOff: true });
  try {
    var solved = await C.solveBySeed(env, pc.page, 21);
    await H.sleep(150);
    var rec = await pc.page.evaluate(function (k) { return JSON.parse(window.localStorage.getItem(k)); }, recordsKey);
    var ui = await pc.page.evaluate(function () {
      var b = document.querySelector('.result-best');
      return { maskHidden: document.querySelector('.overlay-mask').hidden, bestHidden: b ? b.hidden : true, bestText: b ? b.textContent : null };
    });
    if (solved.status !== 'solved' || ui.maskHidden) fail('無輔助完成應顯示完成畫面');
    if (!rec) fail('紀錄應寫入 ' + recordsKey);
    if (rec) {
      var expected = env.notation.fillTemplate(env.texts.result.best, {
        label: env.texts.hud.best, time: formatTime(rec.bestTime.ms), qtm: rec.bestMoves.qtm
      });
      if (ui.bestHidden) fail('完成畫面應顯示最佳紀錄');
      if (ui.bestText !== expected) fail('最佳紀錄文字不符：' + ui.bestText + ' != ' + expected);
      if (rec.bestMoves.qtm !== solved.result.qtm) fail('第一次完成的最佳步數應等於本局');
    }
    await C.shot(env, pc.page, '27-result-best');

    // m-6：「看看方塊」關閉遮罩 → 可以整顆轉、重設；遮罩不再自己跳出來
    await H.clickButtonByText(pc.page, env.texts.buttons.viewCube);
    await H.sleep(100);
    var hiddenAfterView = await pc.page.evaluate(function () { return document.querySelector('.overlay-mask').hidden; });
    if (!hiddenAfterView) fail('按「' + env.texts.buttons.viewCube + '」後遮罩應關閉');
    var o0 = (await H.getState(pc.page)).orient;
    await H.pressKeypadSequential(pc.page, ['x'], env.params.ui.turnAnimMs);
    var afterX = await H.getState(pc.page);
    if (afterX.orient === o0) fail('關閉遮罩後應可整顆轉');
    var stillHidden = await pc.page.evaluate(function () { return document.querySelector('.overlay-mask').hidden; });
    if (!stillHidden) fail('整顆轉後完成畫面不應再自動跳出');
    await C.shot(env, pc.page, '27-view-cube');
    await pc.page.click('#btnReset');
    await H.sleep(100);
    var afterReset = await H.getState(pc.page);
    if (afterReset.status !== 'playing') fail('關閉遮罩後應可按重設（status=' + afterReset.status + '）');

    // 第二局完成：遮罩再次出現，最佳紀錄仍與儲存一致
    var solved2 = await C.solveBySeed(env, pc.page, 5);
    await H.sleep(150);
    var rec2 = await pc.page.evaluate(function (k) { return JSON.parse(window.localStorage.getItem(k)); }, recordsKey);
    var ui2 = await pc.page.evaluate(function () {
      return { maskHidden: document.querySelector('.overlay-mask').hidden, bestText: document.querySelector('.result-best').textContent };
    });
    if (ui2.maskHidden) fail('下一局完成時完成畫面應再次出現');
    var expected2 = env.notation.fillTemplate(env.texts.result.best, {
      label: env.texts.hud.best, time: formatTime(rec2.bestTime.ms), qtm: rec2.bestMoves.qtm
    });
    if (ui2.bestText !== expected2) fail('第二局最佳紀錄文字不符：' + ui2.bestText + ' != ' + expected2);
    if (rec2.solves !== 2) fail('solves 應為 2，實得 ' + rec2.solves);
    if (rec2.bestMoves.qtm !== Math.min(solved.result.qtm, solved2.result.qtm)) fail('bestMoves 應取兩局較小者');
    if (pc.errs.length) fail('頁面錯誤：' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }

  // 儲存不可用：完成畫面照常，最佳紀錄不顯示
  var pc2 = await H.newPage(env.browser, env.vp);
  try {
    await pc2.page.addInitScript(function () {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: function () { throw new Error('storage disabled (T-UI-27 test)'); }
      });
    });
    await pc2.page.goto(env.INDEX_BASE + '?test=1&tutorial=0');
    await pc2.page.waitForSelector('#keypad');
    var s = await C.solveBySeed(env, pc2.page, 21);
    await H.sleep(150);
    var ui3 = await pc2.page.evaluate(function () {
      return { maskHidden: document.querySelector('.overlay-mask').hidden, bestHidden: document.querySelector('.result-best').hidden };
    });
    if (s.status !== 'solved' || ui3.maskHidden) fail('儲存不可用時仍應顯示完成畫面');
    if (!ui3.bestHidden) fail('儲存不可用時不應顯示最佳紀錄');
    if (pc2.errs.length) fail('儲存不可用時出現頁面錯誤：' + JSON.stringify(pc2.errs));
  } finally {
    await pc2.context.close();
  }
  env.record('T-UI-27', pass, detail.join(' | ') || 'ok');
}

// ---------------------------------------------------------------------------
// T-UI-28（MJ-1；D-25）
// ---------------------------------------------------------------------------

async function checkT28(env) {
  var detail = [];
  var pass = true;
  function fail(m) { pass = false; detail.push('FAIL:' + m); }

  // A) keypad.showSubLabels=false → 沒有中文副標，aria-label 仍含副標
  var pc = await C.openFresh(env, { tutorialOff: true, extra: patchQs({ keypad: { showSubLabels: false } }) });
  try {
    var r = await pc.page.evaluate(function () {
      var r = document.querySelector('button.kp[data-move="R"]');
      return { subs: document.querySelectorAll('.kp-sub').length, keys: document.querySelectorAll('button.kp').length, aria: r.getAttribute('aria-label') };
    });
    if (r.subs !== 0) fail('showSubLabels=false 時不應有 .kp-sub（實得 ' + r.subs + '）');
    if (r.keys !== 36) fail('記號鍵應仍為 36 顆');
    var expectedAria = env.notation.keyAriaLabel('R', env.texts, env.engine);
    if (r.aria !== expectedAria) fail('aria-label 應維持「記號＋副標」：' + r.aria);
    await C.shot(env, pc.page, '28-no-sublabels');
  } finally {
    await pc.context.close();
  }

  // B) faceLabels.forceOnInTutorial=false → 教學與記號小教室期間面標籤不強制開啟
  var pc2 = await C.openFresh(env, {
    tutorialOff: false, presetTutorialDone: false, extra: patchQs({ faceLabels: { forceOnInTutorial: false } })
  });
  try {
    await pc2.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 8000 });
    var hiddenT0 = await pc2.page.evaluate(function () { return document.querySelector('[data-sticker="4"] .face-label').hidden; });
    for (var i = 0; i < env.params.tutorial.notationBeforeIndex; i++) {
      await pc2.page.click('.lesson-next');
      await H.sleep(80);
    }
    var hiddenL1 = await pc2.page.evaluate(function () { return document.querySelector('[data-sticker="4"] .face-label').hidden; });
    if (!hiddenT0 || !hiddenL1) fail('forceOnInTutorial=false 時教學期間面標籤應維持關閉（T0=' + hiddenT0 + ' L1=' + hiddenL1 + '）');
  } finally {
    await pc2.context.close();
  }

  // C) turnAnimMs=0、scrambleAnimMsPerMove=0 → 動畫確實關閉
  var pc3 = await C.openFresh(env, { tutorialOff: true, extra: patchQs({ ui: { turnAnimMs: 0, scrambleAnimMsPerMove: 0 } }) });
  try {
    var r3 = await pc3.page.evaluate(function () {
      document.querySelector('#btnScramble').click();
      var idleAfterScramble = window.__cubeTest.inputIdle();
      document.querySelector('button.kp[data-move="R"]').click();
      var wrapper = document.querySelector('.turn-wrapper');
      return { idleAfterScramble: idleAfterScramble, duration: wrapper ? wrapper.style.transitionDuration : null };
    });
    if (!r3.idleAfterScramble) fail('scrambleAnimMsPerMove=0 時打亂不應播動畫或上鎖');
    if (!(r3.duration === '0s' || r3.duration === '0ms')) fail('turnAnimMs=0 時轉動動畫長度應為 0（實得 ' + r3.duration + '）');
    var applied = await H.waitFor(async function () { return (await H.getState(pc3.page)).cursor === 1; }, 1000, 20);
    if (!applied) fail('turnAnimMs=0 時按 R 應立即套用');
    if (pc3.errs.length) fail('頁面錯誤：' + JSON.stringify(pc3.errs));
  } finally {
    await pc3.context.close();
  }
  env.record('T-UI-28', pass, detail.join(' | ') || 'ok');
}

module.exports = {
  checkT24: checkT24,
  checkT25: checkT25,
  checkT26: checkT26,
  checkT27: checkT27,
  checkT28: checkT28
};
