// tests/ui/checks4.js — S12：G4.5 外部審查（Gemini）採納項與幕僚長自查項的 UI 回歸測試
//   T-UI-31  E-2：教學示範轉動進行中按「跳過教學」，之後畫面與 state 一致
//   T-UI-32  E-1：記號小教室示範整顆轉 x 時整個方塊一起轉（不得只轉局部層）
//   T-UI-33  N-1：按 y 鍵後，整顆旋轉動畫結束時不得出現反向回轉
// 依據：docs/reviews/T-001/triage.md、docs/reports/T-001-arch-decisions.md D-31～D-33。
'use strict';

var C = require('./checks.js');
var H = C.H;

async function paintedMismatch(env, page) {
  var info = await page.evaluate(function () {
    var colors = [];
    document.querySelectorAll('[data-sticker]').forEach(function (el) {
      colors[Number(el.dataset.sticker)] = getComputedStyle(el).backgroundColor;
    });
    return { colors: colors, state: window.__cubeTest.getState() };
  });
  var vs = env.engine.viewStickers(info.state);
  var n = 0;
  for (var i = 0; i < 54; i++) {
    var hex = H.rgbToHex(info.colors[i]);
    var want = String(env.palette.stickers[vs[i]].hex).toLowerCase();
    if (hex !== want) n++;
  }
  return n;
}

async function checkT31(env) {
  var pc = await C.openFresh(env, { presetTutorialDone: false });
  try {
    var t = env.params.tutorial;
    await pc.page.click('.lesson-next', { force: true });
    await H.sleep(200);
    await pc.page.click('.lesson-next', { force: true });
    await H.sleep(t.demoHoldMs + Math.floor(t.demoTurnMs / 2));
    await pc.page.click('.lesson-skip-all', { force: true });
    await H.sleep(t.demoTurnMs * 2 + t.demoHoldMs * 2);
    var n = await paintedMismatch(env, pc.page);
    env.record('T-UI-31', n === 0 && pc.errs.length === 0, 'mismatch=' + n + ' errs=' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }
}

async function checkT32(env) {
  var pc = await C.openFresh(env, {});
  try {
    var t = env.params.tutorial;
    await pc.page.click('[data-slot="lesson-button"] button', { force: true });
    await H.sleep(300);
    for (var i = 0; i < 5; i++) { await pc.page.click('.lesson-next', { force: true }); await H.sleep(150); }
    var stepOk = await pc.page.evaluate(function () { return /記號小教室\s*6／7/.test(document.body.innerText); });
    await H.sleep(t.demoHoldMs + Math.floor(t.demoTurnMs / 2));
    var mid = await pc.page.evaluate(function () {
      var inWrap = 0;
      document.querySelectorAll('[data-sticker]').forEach(function (el) { if (el.closest('.turn-wrapper')) inWrap++; });
      return { inWrap: inWrap, world: getComputedStyle(document.querySelector('.cube-world')).transform };
    });
    await H.sleep(t.demoTurnMs * 3 + t.demoHoldMs * 2);
    var n = await paintedMismatch(env, pc.page);
    var pass = stepOk && mid.inWrap === 0 && mid.world !== 'none' && pc.errs.length === 0;
    env.record('T-UI-32', pass, 'step6=' + stepOk + ' inWrap=' + mid.inWrap + ' worldRotating=' + (mid.world !== 'none') + ' afterMismatch(教學中預覽，僅記錄)=' + n);
  } finally {
    await pc.context.close();
  }
}

async function checkT33(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  try {
    await pc.page.evaluate(function () {
      window.__rot = [];
      var w = document.querySelector('.cube-world');
      var t0 = 0;
      function s() {
        window.__rot.push([performance.now() - t0, getComputedStyle(w).transform]);
        if (performance.now() - t0 < 900) requestAnimationFrame(s);
      }
      document.querySelector('button.kp[data-move="y"]').addEventListener('click', function () { t0 = performance.now(); requestAnimationFrame(s); }, true);
    });
    await pc.page.click('button.kp[data-move="y"]', { force: true });
    await H.sleep(1200);
    var ta = env.params.ui.turnAnimMs;
    var samples = await pc.page.evaluate(function () { return window.__rot; });
    var late = samples.filter(function (x) { return x[0] > ta + 60; });
    var bad = late.filter(function (x) { return x[1] !== 'none'; }).length;
    var st = await H.getState(pc.page);
    env.record('T-UI-33', late.length > 0 && bad === 0 && st.orient !== 0 && pc.errs.length === 0,
      'lateSamples=' + late.length + ' nonIdentityAfterEnd=' + bad + ' orient=' + st.orient);
  } finally {
    await pc.context.close();
  }
}

module.exports = { checkT31: checkT31, checkT32: checkT32, checkT33: checkT33 };
