// tests/ui/checks5.js — S13（G5 本版修正，D-35）的 UI 回歸測試
//   T-UI-35  m-2：轉視角的 session 沒有正常結束（capture 失敗、pointerup 落在舞台外；或只收到
//            lostpointercapture）時，佇列暫停仍會解除，記號鍵 R 照常生效（reviewer 的合成事件重現）
//   T-UI-36  QA Minor-1：36 顆記號鍵的中文副標——iPad 橫向字級 ≥ 12px；兩種視圖都不換行、不截字、
//            按鍵 ≥ 44×44
//   T-UI-37  m-3：畫面在等提示／等示範，但 solver-client 沒有對應的請求時，等待卡的「取消」仍然有效
// T-UI-34（gesture.js 各結束路徑的 Node 單元測試）在 tests/engine/gesture.test.js；
// m-3 的 client 單元測試（C-14～C-17）在 tests/engine/solver/client.test.js。
// 依據：docs/reports/T-001-code-review.md m-2、m-3；docs/qa/T-001-qa.md Minor-1；docs/reports/T-001-S13.md。
'use strict';

var fs = require('fs');
var C = require('./checks.js');
var H = C.H;

async function waitIdle(page) {
  return H.waitFor(function () {
    return page.evaluate(function () { return window.__cubeTest.inputIdle(); });
  }, 8000, 100);
}

// 在方塊外送出合成 pointerdown（pointerId 沒有對應的真實指標 → setPointerCapture 失敗），
// 接著執行 endFn 指定的結束方式，再按記號鍵 R，回傳前後的 cursor 與佇列狀態。
async function viewSessionThenR(page, endKind) {
  return page.evaluate(async function (kind) {
    var scene = document.querySelector('.cube-scene');
    var rc = scene.getBoundingClientRect();
    var x = rc.left + 8;
    var y = rc.top + 8; // 方塊外
    var target = document.elementFromPoint(x, y);
    function pe(type, el, px, py) {
      el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: px, clientY: py
      }));
    }
    pe('pointerdown', target, x, y);
    if (kind === 'upOutside') {
      pe('pointerup', document.body, x + 5, y + 5); // 沒有 capture 時舞台收不到
    } else if (kind === 'lostCapture') {
      pe('lostpointercapture', scene, x, y); // 沒有 pointerup，只收到 lostpointercapture
    }
    var before = window.__cubeTest.getState().cursor;
    document.querySelector('button.kp[data-move="R"]').click();
    await new Promise(function (res) { setTimeout(res, 1500); });
    return {
      targetInScene: scene.contains(target),
      onSticker: !!(target.closest && target.closest('[data-sticker]')),
      cursorBefore: before,
      cursorAfter: window.__cubeTest.getState().cursor,
      queueSize: window.__cubeTest.queueSize(),
      idle: window.__cubeTest.inputIdle()
    };
  }, endKind);
}

async function checkT35(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  try {
    await C.newGame(pc.page, 3);
    await waitIdle(pc.page);
    var a = await viewSessionThenR(pc.page, 'upOutside');
    await waitIdle(pc.page);
    var b = await viewSessionThenR(pc.page, 'lostCapture');
    function ok(r) {
      return r.targetInScene && !r.onSticker && r.cursorAfter === r.cursorBefore + 1 && r.queueSize === 0 && r.idle;
    }
    env.record('T-UI-35', ok(a) && ok(b) && pc.errs.length === 0,
      'upOutside=' + JSON.stringify(a) + ' lostCapture=' + JSON.stringify(b) + ' errs=' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }
}

async function checkT36(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  try {
    // 展開「整顆轉」與「中層（進階）」，36 顆鍵全部可見
    await pc.page.evaluate(function () {
      document.querySelectorAll('.kp-caption-toggle').forEach(function (t) {
        if (t.getAttribute('aria-expanded') !== 'true') t.click();
      });
    });
    await H.waitLayoutStable(pc.page, '#keypad');
    var keys = await pc.page.evaluate(function () {
      var out = [];
      document.querySelectorAll('button.kp').forEach(function (k) {
        var s = k.querySelector('.kp-sub');
        var kr = k.getBoundingClientRect();
        var sr = s.getBoundingClientRect();
        var range = document.createRange();
        range.selectNodeContents(s);
        var tops = {};
        Array.prototype.forEach.call(range.getClientRects(), function (r) { tops[Math.round(r.top)] = true; });
        out.push({
          move: k.dataset.move,
          text: s.textContent,
          fs: parseFloat(getComputedStyle(s).fontSize),
          w: kr.width,
          h: kr.height,
          lines: Object.keys(tops).length,
          clipped: sr.left < kr.left || sr.right > kr.right || sr.top < kr.top || sr.bottom > kr.bottom ||
            s.scrollWidth > s.clientWidth + 0.5 || k.scrollWidth > k.clientWidth + 0.5,
          visible: kr.width > 0 && kr.height > 0
        });
      });
      return out;
    });
    var bad = keys.filter(function (k) { return !k.visible || k.lines !== 1 || k.clipped || k.w < 44 || k.h < 44; });
    var sizes = {};
    keys.forEach(function (k) { sizes[k.fs] = true; });
    var minFs = Math.min.apply(null, keys.map(function (k) { return k.fs; }));
    // iPad 橫向（1194 寬）要求 ≥ 12px（D-35）；手機直向要求 ≥ 11px（D-36），且不換行、不截字、≥ 44×44。
    var fsOk = env.vp.name === 'ipad' ? minFs >= 12 : minFs >= 11;
    if (env.keypadShotsDir) {
      fs.mkdirSync(env.keypadShotsDir, { recursive: true });
      var kp = await pc.page.$('#keypad');
      await kp.screenshot({ path: require('path').join(env.keypadShotsDir, 'keypad-' + env.vp.name + '.png') });
    }
    env.record('T-UI-36', keys.length === 36 && bad.length === 0 && fsOk && pc.errs.length === 0,
      'keys=' + keys.length + ' fontSizes=' + Object.keys(sizes).join('/') + 'px minW=' +
      Math.min.apply(null, keys.map(function (k) { return Math.round(k.w * 10) / 10; })) + ' minH=' +
      Math.min.apply(null, keys.map(function (k) { return Math.round(k.h * 10) / 10; })) + ' bad=' + JSON.stringify(bad));
  } finally {
    await pc.context.close();
  }
}

async function checkT37(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  try {
    await C.newGame(pc.page, 5);
    await waitIdle(pc.page);
    // 繞過 hint-view／demo-player 直接送出請求：畫面進入等待中，但 solver-client 沒有對應的請求
    // （模擬「先前的請求因例外沒有結果」；cancel() 會回傳 null）
    var r = await pc.page.evaluate(async function () {
      function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
      function waitBtn() { return document.querySelector('.wait-card button'); }
      var out = {};
      window.__cubeTest.dispatch({ type: 'HINT_REQUEST', payload: { at: 1 } });
      await sleep(100);
      out.hintPendingBefore = !!(window.__cubeTest.getState().hint && window.__cubeTest.getState().hint.pending);
      var b1 = waitBtn();
      out.hintBtn = !!b1;
      if (b1) b1.click();
      await sleep(200);
      out.hintAfter = window.__cubeTest.getState().hint;

      window.__cubeTest.dispatch({ type: 'DEMO_REQUEST', payload: { kind: 'lbl', at: 2 } });
      await sleep(100);
      var d0 = window.__cubeTest.getState().demo;
      out.demoPendingBefore = !!(d0 && d0.pending);
      var b2 = waitBtn();
      out.demoBtn = !!b2;
      if (b2) b2.click();
      await sleep(200);
      out.demoAfter = window.__cubeTest.getState().demo;
      out.waitCardsLeft = document.querySelectorAll('.wait-card').length;
      return out;
    });
    var pass = r.hintPendingBefore && r.hintBtn && r.hintAfter === null &&
      r.demoPendingBefore && r.demoBtn && r.demoAfter === null && r.waitCardsLeft === 0 && pc.errs.length === 0;
    env.record('T-UI-37', pass, JSON.stringify(r) + ' errs=' + JSON.stringify(pc.errs));
  } finally {
    await pc.context.close();
  }
}

module.exports = { checkT35: checkT35, checkT36: checkT36, checkT37: checkT37 };
