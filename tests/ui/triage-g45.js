// tests/ui/triage-g45.js — G4.5 外部審查（Gemini）實證裁決用腳本，不列入 smoke.spec.js。
// 用法：node tests/ui/triage-g45.js（需 playwright；雲端以 NODE_PATH 指向既有 node_modules）
'use strict';
var path = require('path');
var chromium;
try { chromium = require('playwright').chromium; } catch (e) { console.error('找不到 playwright：' + e.message); process.exit(2); }
var engine = require('../../src/engine');
var palette = require('../../src/data/palette.json');
var params = require('../../src/data/params.json');
var INDEX = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var HEX2ID = {};
palette.stickers.forEach(function (s) { HEX2ID[s.hex.toLowerCase()] = s.id; });

async function painted(page) {
  var rgbs = await page.evaluate(function () {
    var out = [];
    document.querySelectorAll('[data-sticker]').forEach(function (el) {
      out[+el.getAttribute('data-sticker')] = getComputedStyle(el).backgroundColor;
    });
    return out;
  });
  return rgbs.map(function (rgb) {
    var m = rgb.match(/\d+/g).slice(0, 3).map(Number);
    var hex = '#' + m.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    return HEX2ID[hex];
  });
}
async function expected(page) {
  var st = await page.evaluate(function () { return window.__cubeTest.getState(); });
  return engine.viewStickers(st);
}
function diffCount(a, b) { var n = 0; for (var i = 0; i < 54; i++) if (a[i] !== b[i]) n++; return n; }

async function open(browser, vp, tutorialDone) {
  var ctx = await browser.newContext({ viewport: vp, hasTouch: true });
  var page = await ctx.newPage();
  var errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (tutorialDone) {
    await page.addInitScript(function (k) {
      try { localStorage.setItem(k, JSON.stringify({ v: 1, done: true })); } catch (e) { /* 忽略 */ }
    }, params.storage.tutorialKey);
  }
  await page.goto(INDEX + '?test=1');
  await page.waitForSelector('#keypad');
  await sleep(600);
  return { ctx: ctx, page: page, errs: errs };
}

async function run() {
  var browser = await chromium.launch();
  var vp = { width: 1194, height: 834 };
  var out = {};
  var hold = params.tutorial.demoHoldMs, turnMs = params.tutorial.demoTurnMs;

  // E-2：教學示範轉動進行中按「跳過教學」，之後畫面是否仍與 state 一致
  var o = await open(browser, vp, false);
  await o.page.click('.lesson-next', { force: true }).catch(function () {});
  await sleep(200);
  await o.page.click('.lesson-next', { force: true }).catch(function () {});
  var stepText = await o.page.evaluate(function () { return document.body.innerText.match(/記號小教室\s*\d+／\d+/); });
  await sleep(hold + Math.floor(turnMs / 2));
  await o.page.click('.lesson-skip-all', { force: true });
  await sleep(turnMs * 2 + hold * 2);
  var p1 = await painted(o.page), e1 = await expected(o.page);
  out.E2 = { lessonStep: stepText && stepText[0], mismatchedStickersAfterSkip: diffCount(p1, e1), errs: o.errs.slice() };
  // 之後玩家按 R，畫面是否恢復一致
  await o.page.click('button.kp[data-move="R"]', { force: true });
  await sleep(600);
  out.E2.mismatchAfterPressingR = diffCount(await painted(o.page), await expected(o.page));
  await o.ctx.close();

  // E-1：記號小教室第 6 步（x）動畫中，R／L 中心貼紙是否被納入轉動群組
  o = await open(browser, vp, true);
  await o.page.click('.lesson-open-btn, [data-slot="lesson-button"] button', { force: true });
  await sleep(300);
  for (var i = 0; i < 5; i++) { await o.page.click('.lesson-next', { force: true }); await sleep(150); }
  var st6 = await o.page.evaluate(function () { return document.body.innerText.match(/記號小教室\s*\d+／\d+/); });
  await sleep(hold + Math.floor(turnMs / 2));
  out.E1 = await o.page.evaluate(function () {
    function inWrap(i) { var el = document.querySelector('[data-sticker="' + i + '"]'); return !!(el && el.closest('.turn-wrapper')); }
    var moving = 0; document.querySelectorAll('[data-sticker]').forEach(function (el) { if (el.closest('.turn-wrapper')) moving++; });
    return { stickersInTurnGroup: moving, rCenterInGroup: inWrap(13), lCenterInGroup: inWrap(40), fCenterInGroup: inWrap(22) };
  });
  out.E1.lessonStep = st6 && st6[0];
  await o.page.screenshot({ path: path.resolve(__dirname, '..', '..', 'docs', 'reviews', 'T-001', 'triage-e1-x-midturn.png') });
  out.E1.errs = o.errs.slice();
  await o.ctx.close();

  // E-3：按「打亂」後的每一個畫格，是否曾出現「完整打亂後」的盤面
  o = await open(browser, vp, true);
  await o.page.evaluate(function () {
    window.__frames = [];
    var t0 = performance.now();
    function snap() {
      var arr = [];
      document.querySelectorAll('[data-sticker]').forEach(function (el) { arr[+el.getAttribute('data-sticker')] = el.style.background || el.style.backgroundColor; });
      window.__frames.push(arr.join('|'));
      if (performance.now() - t0 < 400) requestAnimationFrame(snap);
    }
    document.getElementById('btnScramble').addEventListener('click', function () { t0 = performance.now(); requestAnimationFrame(snap); }, true);
  });
  await o.page.click('#btnScramble', { force: true });
  await sleep(params.ui.scrambleAnimMsPerMove * 30 + 800);
  var fin = await o.page.evaluate(function () {
    var arr = [];
    document.querySelectorAll('[data-sticker]').forEach(function (el) { arr[+el.getAttribute('data-sticker')] = el.style.background || el.style.backgroundColor; });
    return { final: arr.join('|'), frames: window.__frames };
  });
  var firstMatch = fin.frames.indexOf(fin.final);
  out.E3 = { framesCaptured: fin.frames.length, firstFrameEqualsFinalScrambled: fin.frames[0] === fin.final, anyEarlyFrameEqualsFinal: firstMatch >= 0 && firstMatch < 3, firstMatchIndex: firstMatch, errs: o.errs.slice() };
  await o.ctx.close();

  // S-1：示範播放時 HUD 步數是否增加（規格 §2.2 明定會計入）
  o = await open(browser, vp, true);
  await o.page.evaluate(function () { window.__cubeTest.dispatch({ type: 'NEW_GAME', payload: { seed: 7, at: 0 } }); });
  await sleep(2500);
  var before = await o.page.evaluate(function () { return document.getElementById('moveVal').textContent; });
  out.S1 = { hudBeforeDemo: before };
  await o.ctx.close();

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
}
run().catch(function (e) { console.error(e); process.exit(1); });
