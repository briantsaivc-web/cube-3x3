// tests/ui/checks2.js — T-UI-07～09、14～22 的實際判定邏輯（延續 tests/ui/checks.js）
//
// 拆成兩檔只是避免單一檔案過長；判定依據與 checks.js 相同（見該檔檔頭註解）。
'use strict';

var C = require('./checks.js');
var H = C.H;

// ---------------------------------------------------------------------------
// 建議解示範 seed：seed=17 在本機驗證下（見 docs/reports/T-001-S9.md）打亂長度短、
// 求解快，適合反覆執行；只要求「一個能求出解的合法局面」，seed 本身無特殊意義。
// 層先法 seed：seed=42（見報告）在本機驗證下有 8 段中 2 段為空段（hold、yellowFace）、
// 6 個非空段（因此分段暫停卡片應出現 5 次）、且同時涵蓋外層 90°／180°／整顆旋轉三種
// token，適合一次驗完 T-UI-09、T-UI-21（層先法部分）、T-UI-22。兩個 seed 都用
// __cubeTest.dispatch({type:'NEW_GAME',...}) 直接指定，不受隨機亂數影響，可重放。
// ---------------------------------------------------------------------------
var SUGGEST_SEED = 17;
var LBL_SEED = 42;

// ---------------------------------------------------------------------------
// T-UI-07／T-UI-08／T-UI-21（建議解示範相關部分）
// ---------------------------------------------------------------------------

async function checkSuggestFlow(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  var detail = [];
  var pass = true;
  function fail(msg) { pass = false; detail.push('FAIL:' + msg); }
  try {
    var recordsKey = env.params.storage.recordsKey;
    var recBefore = await pc.page.evaluate(function (k) { return window.localStorage.getItem(k); }, recordsKey);

    await C.newGame(pc.page, SUGGEST_SEED);

    // ---- 提示：等 ready → 按提示 → 記號/白話說明/層高亮 → 照做 → 提示消失 → 再按立即出現（快取） ----
    await H.clickButtonByText(pc.page, env.texts.buttons.hint);
    var hintOk = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return s.hint && s.hint.pending === false;
    }, 20000);
    if (!hintOk) fail('第一次提示逾時未取得');

    var st1 = await H.getState(pc.page);
    var hv = env.engine.hintView(st1);
    var domHint = await pc.page.evaluate(function () {
      var move = document.querySelector('.hint-move');
      var explain = document.querySelector('.hint-explain');
      return { move: move && move.textContent, explain: explain && explain.textContent };
    });
    var expectedMoveText = env.notation.fillTemplate(env.texts.hint.move, { move: env.engine.formatMove(hv.move), qtm: hv.qtm });
    if (hv.source === 'suggest' && hv.planQtm !== null && hv.planQtm !== undefined) {
      expectedMoveText += ' · ' + env.notation.fillTemplate(env.texts.hint.plan, { n: hv.planQtm });
    }
    var expectedExplain = env.notation.explainMove(hv.move, env.texts, env.engine);
    if (domHint.move !== expectedMoveText) fail('提示記號文字不符：' + domHint.move + ' != ' + expectedMoveText);
    if (domHint.explain !== expectedExplain) fail('提示白話說明不符：' + domHint.explain + ' != ' + expectedExplain);

    var hiCount = await pc.page.evaluate(function () { return document.querySelectorAll('.is-hi').length; });
    var expectedLayer = env.engine.hintLayer(st1);
    if (hiCount !== expectedLayer.length) fail('層高亮數量不符：' + hiCount + ' != ' + expectedLayer.length);

    // 照做該步（hv.move 為 view 座標記號，可直接點對應鍵；提示一律是外層記號，不需展開中層）
    await pc.page.click('button.kp[data-move="' + hv.move + '"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 300);
    var afterMove = await H.getState(pc.page);
    if (afterMove.hint !== null) fail('轉動後提示未消失');

    // 再按提示：應立即（快取）出現
    var t0 = Date.now();
    await H.clickButtonByText(pc.page, env.texts.buttons.hint);
    var hint2Ok = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return s.hint && s.hint.pending === false;
    }, 15000, 80);
    var cacheMs = Date.now() - t0;
    if (!hint2Ok) fail('第二次提示逾時未取得');
    // 快取應遠快於「從零建表＋求解」；以 3 秒為寬鬆門檻（本機驗證通常 < 500ms）。
    if (cacheMs > 3000) detail.push('NOTE:第二次提示耗時 ' + cacheMs + 'ms，超過快取預期門檻（僅記錄，不致命）');

    // ---- 看電腦解 → 建議解示範 → 播完 ----
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    var tabOnAfterOpen = await pc.page.evaluate(function () { return document.querySelector('#tabDemo').classList.contains('on'); });
    if (!tabOnAfterOpen) fail('按「看電腦解」未切到示範分頁');

    await H.clickButtonByText(pc.page, env.texts.buttons.demoSuggest);
    var demoReady = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return !!(s.demo && !s.demo.pending);
    }, 20000);
    if (!demoReady) fail('建議解示範逾時未就緒');

    // T-UI-21（建議解部分）：cursor=0 的白話說明等於 explainMove(tokens[0])
    var stD = await H.getState(pc.page);
    var explain0 = await pc.page.evaluate(function () { var e = document.querySelector('.demo-explain'); return e && e.textContent; });
    var expectedExplain0 = env.notation.explainMove(stD.demo.tokens[0], env.texts, env.engine);
    if (explain0 !== expectedExplain0) fail('建議解示範第一步白話說明不符：' + explain0 + ' != ' + expectedExplain0);

    await H.clickButtonByText(pc.page, env.texts.buttons.speedFast);
    await H.clickButtonByText(pc.page, env.texts.buttons.play);
    var solved = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return s.status === 'solved';
    }, 40000, 250);
    if (!solved) fail('建議解示範播放逾時未完成');

    // D-17：示範中完成不彈全螢幕遮罩，改用 .demo-result-slot；仍可前後單步回看
    var afterSolve = await pc.page.evaluate(function () {
      return {
        maskHidden: document.querySelector('.overlay-mask').hidden,
        demoCardHidden: document.querySelector('.demo-result-slot').hidden,
        demoCardText: document.querySelector('.demo-result-card').textContent
      };
    });
    if (!afterSolve.maskHidden) fail('示範中完成不應彈出全螢幕遮罩（D-17）');
    if (afterSolve.demoCardHidden) fail('示範中完成應顯示不遮擋的摘要卡（D-17）');
    if (afterSolve.demoCardText.indexOf(env.texts.result.badgeDemo) === -1) fail('示範完成摘要卡未標示「' + env.texts.result.badgeDemo + '」');
    await C.shot(env, pc.page, '07-suggest-demo-done');

    // T-UI-21：播到結尾不顯示白話說明
    var explainEnd = await pc.page.evaluate(function () { return document.querySelector('.demo-explain'); });
    if (explainEnd !== null) fail('播到結尾仍顯示白話說明（應消失）');

    // 仍可前後單步回看
    var stateSolved = await H.getState(pc.page);
    await H.clickButtonByText(pc.page, env.texts.buttons.stepBack);
    await H.sleep((env.params.ui.turnAnimMs || 180) * (env.params.demo.animRatio || 0.8) + 250);
    var stateBack = await H.getState(pc.page);
    if (stateBack.demo.cursor !== stateSolved.demo.cursor - 1) fail('完成後「上一步」未能回看');

    // 離開示範：回到操作分頁，且不再補彈完成畫面（D-17）
    await H.clickButtonByText(pc.page, env.texts.buttons.exitDemo);
    await H.sleep(150);
    var tabControlsOn = await pc.page.evaluate(function () { return document.querySelector('#tabControls').classList.contains('on'); });
    var maskAfterExit = await pc.page.evaluate(function () { return document.querySelector('.overlay-mask').hidden; });
    if (!tabControlsOn) fail('離開示範未切回「操作」分頁（D-15）');
    if (!maskAfterExit) fail('離開示範後不應補彈出完成畫面（D-17）');

    // T-UI-08：紀錄未改變（assist=demo 不列入紀錄）
    var recAfter = await pc.page.evaluate(function (k) { return window.localStorage.getItem(k); }, recordsKey);
    if (recAfter !== recBefore) fail('看過建議解示範後 localStorage 紀錄不應改變：before=' + recBefore + ' after=' + recAfter);

    env.record('T-UI-07', pass, detail.join(' | ') || 'ok');
    env.record('T-UI-08', pass, detail.join(' | ') || 'ok');
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-09／T-UI-21（層先法部分）／T-UI-22
// ---------------------------------------------------------------------------

async function checkLblFlow(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  var d09 = [], pass09 = true;
  var d21 = [], pass21 = true;
  var d22 = [], pass22 = true;
  function fail09(m) { pass09 = false; d09.push('FAIL:' + m); }
  function fail21(m) { pass21 = false; d21.push('FAIL:' + m); }
  function fail22(m) { pass22 = false; d22.push('FAIL:' + m); }

  try {
    await C.newGame(pc.page, LBL_SEED);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoLbl);
    var ready = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return !!(s.demo && !s.demo.pending);
    }, 20000);
    if (!ready) { fail09('層先法示範逾時未就緒'); fail21('層先法示範逾時未就緒'); fail22('層先法示範逾時未就緒'); }

    var st0 = await H.getState(pc.page);
    var segments = st0.demo.segments;

    // ---- T-UI-09：8 段清單 ----
    var rowCount = await pc.page.evaluate(function () { return document.querySelectorAll('.segment-row').length; });
    if (rowCount !== 8 || segments.length !== 8) fail09('分段清單應為 8 段，實得 rowCount=' + rowCount + ' segments=' + segments.length);
    segments.forEach(function (seg, idx) {
      if (seg.start === seg.end) {
        var skipOk = true; // 由下方 DOM 掃描一併驗證
      }
    });
    var skipTexts = await pc.page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll('.segment-row.skip .seg-note'), function (e) { return e.textContent; });
    });
    var expectedSkipCount = segments.filter(function (s) { return s.start === s.end; }).length;
    if (skipTexts.length !== expectedSkipCount) fail09('空段數量不符：' + skipTexts.length + ' != ' + expectedSkipCount);
    skipTexts.forEach(function (t) {
      if (t !== env.texts.demo.segmentSkipped) fail09('空段文字不符：' + t);
    });

    // ---- T-UI-09：單步前進／後退同步 ----
    var beforeStep = await H.getState(pc.page);
    await H.clickButtonByText(pc.page, env.texts.buttons.stepForward);
    await H.sleep((env.params.demo.speeds[1].stepMs * (env.params.demo.animRatio || 0.8)) + 250);
    var afterFwd = await H.getState(pc.page);
    if (afterFwd.demo.cursor !== beforeStep.demo.cursor + 1) fail09('「下一步」cursor 未 +1');
    await H.clickButtonByText(pc.page, env.texts.buttons.stepBack);
    await H.sleep((env.params.demo.speeds[1].stepMs * (env.params.demo.animRatio || 0.8)) + 250);
    var afterBack = await H.getState(pc.page);
    if (afterBack.demo.cursor !== beforeStep.demo.cursor) fail09('「上一步」cursor 未回到原值');

    // ---- T-UI-09：點第 4 段跳到該段開頭（不出現分段卡片） ----
    var seg4 = segments[3];
    await pc.page.evaluate(function (id) {
      var row = document.querySelector('.segment-row[data-segment-id="' + id + '"]');
      row.click();
    }, seg4.id);
    await H.sleep(300);
    var afterSeek = await H.getState(pc.page);
    if (afterSeek.demo.cursor !== seg4.start) fail09('點第 4 段未跳到該段開頭：cursor=' + afterSeek.demo.cursor + ' expected=' + seg4.start);
    var cardAfterSeek = await pc.page.evaluate(function () { return !!document.querySelector('.pause-card'); });
    if (cardAfterSeek) fail09('DEMO_SEEK 不應觸發分段暫停卡片');

    // ---- T-UI-09：速度切換有效 ----
    await H.clickButtonByText(pc.page, env.texts.buttons.speedSlow);
    var slowOn = await pc.page.evaluate(function () {
      var b = Array.prototype.slice.call(document.querySelectorAll('.speed-btn')).find(function (x) { return x.classList.contains('on'); });
      return b && b.textContent;
    });
    if (slowOn !== env.texts.buttons.speedSlow) fail09('切換到「慢」速度後未標示選取');
    await H.clickButtonByText(pc.page, env.texts.buttons.speedFast);

    env.record('T-UI-09', pass09, d09.join(' | ') || 'ok');

    // ---- T-UI-21（層先法部分）：outer-90/outer-180/rotation 各一例、公式段名稱與白話用途、
    //      播到結尾不顯示 ----
    var tokens = st0.demo.tokens;
    var kindsToFind = { outerCw: null, outerHalf: null, rotation: null, formulaCursor: null };
    for (var i = 0; i < tokens.length; i++) {
      var d = env.engine.describeMove(tokens[i]);
      if (kindsToFind.outerCw === null && d.kind === 'outer' && d.turn === 'cw') kindsToFind.outerCw = i;
      if (kindsToFind.outerHalf === null && d.kind === 'outer' && d.turn === 'half') kindsToFind.outerHalf = i;
      if (kindsToFind.rotation === null && d.kind === 'rotation') kindsToFind.rotation = i;
    }
    for (var key in kindsToFind) {
      if (key === 'formulaCursor') continue;
      var idx = kindsToFind[key];
      if (idx === null) { fail21('找不到 ' + key + ' 類型的記號範例（seed=' + LBL_SEED + ' 假設不成立）'); continue; }
      await pc.page.evaluate(function (c) { window.__cubeTest.dispatch({ type: 'DEMO_SEEK', payload: { cursor: c, at: 0 } }); }, idx);
      await H.sleep(30);
      var explainTxt = await pc.page.evaluate(function () { var e = document.querySelector('.demo-explain'); return e && e.textContent; });
      var expected = env.notation.explainMove(tokens[idx], env.texts, env.engine);
      if (explainTxt !== expected) fail21(key + ' 白話說明不符（cursor=' + idx + '）：' + explainTxt + ' != ' + expected);
    }
    // 公式段：掃描找第一個出現 .formula-block 的 cursor
    var formulaCursor = -1, formulaTexts = null;
    for (var c = 0; c <= tokens.length; c++) {
      await pc.page.evaluate(function (cc) { window.__cubeTest.dispatch({ type: 'DEMO_SEEK', payload: { cursor: cc, at: 0 } }); }, c);
      var has = await pc.page.evaluate(function () { return !!document.querySelector('.formula-block'); });
      if (has) {
        formulaCursor = c;
        formulaTexts = await pc.page.evaluate(function () {
          return { name: document.querySelector('.formula-name').textContent, use: document.querySelector('.formula-use').textContent };
        });
        break;
      }
    }
    if (formulaCursor === -1) {
      fail21('未找到任何公式段畫面（seed=' + LBL_SEED + ' 假設不成立）');
    } else {
      var located = null;
      for (var s = 0; s < segments.length; s++) {
        var seg = segments[s];
        if (formulaCursor >= seg.start && formulaCursor < seg.end) { located = seg; break; }
      }
      var partIdx = -1;
      if (located) {
        for (var p = 0; p < located.parts.length; p++) {
          if (formulaCursor >= located.parts[p].start && formulaCursor < located.parts[p].end) { partIdx = p; break; }
        }
      }
      var part = located && partIdx >= 0 ? located.parts[partIdx] : null;
      var formula = part && part.formula ? env.lbl.formulas[part.formula] : null;
      if (!formula) {
        fail21('找到 .formula-block 但無法從 segments 反查對應公式（cursor=' + formulaCursor + '）');
      } else {
        if (formulaTexts.name.indexOf(formula.name) === -1) fail21('公式名稱未顯示：' + formulaTexts.name + ' 應含 ' + formula.name);
        var expectedUse = env.notation.fillTemplate(env.texts.demo.formulaUse, { desc: formula.desc });
        if (formulaTexts.use !== expectedUse) fail21('公式白話用途不符：' + formulaTexts.use + ' != ' + expectedUse);
      }
    }
    // 播到結尾不顯示說明
    await pc.page.evaluate(function (total) { window.__cubeTest.dispatch({ type: 'DEMO_SEEK', payload: { cursor: total, at: 0 } }); }, tokens.length);
    await H.sleep(30);
    var explainAtEnd = await pc.page.evaluate(function () { return document.querySelector('.demo-explain'); });
    if (explainAtEnd !== null) fail21('層先法播到結尾仍顯示白話說明');

    env.record('T-UI-21', pass21, d21.join(' | ') || 'ok');

    // ---- T-UI-22：分段暫停卡片 ----
    // 上面 T-UI-21 用 DEMO_SEEK 直接跳到終點掃描過，一旦 isSolved(home) 成立過，
    // reducer 的 status 就會鎖定在 'solved'（供回看，§4 補充），即使把 cursor 用
    // DEMO_SEEK 退回 0，status 也不會變回 'playing'。本段若沿用同一個 demo session，
    // 迴圈的「status==='solved' → done」判斷會在還沒真正播放前就誤判為已完成
    // （曾在本機驗證中實際踩到，見 docs/reports/T-001-S9.md）。因此改為重新打亂＋
    // 重新 DEMO_REQUEST，取得一個 status 貨真價實從 'playing' 開始的全新 demo session
    // （同一 seed，tokens／segments 與上面完全相同，仍可沿用 `segments` 變數核對）。
    await C.newGame(pc.page, LBL_SEED);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoLbl);
    var ready22 = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return !!(s.demo && !s.demo.pending);
    }, 20000);
    if (!ready22) fail22('重新求解層先法示範逾時未就緒（T-UI-22 前置步驟）');
    var nonEmptySegCount = segments.filter(function (s) { return s.end > s.start; }).length;
    var expectedPauseCount = nonEmptySegCount - 1;

    await H.clickButtonByText(pc.page, env.texts.buttons.play);
    var pauseCount = 0;
    var backStepCheckedOnce = false;
    var done = false;
    var loopStart = Date.now();
    while (!done && Date.now() - loopStart < 120000) {
      var solvedNow = await pc.page.evaluate(function () { return window.__cubeTest.getState().status === 'solved'; });
      if (solvedNow) { done = true; break; }
      var hasCard = await pc.page.evaluate(function () { return !!document.querySelector('.pause-card'); });
      if (hasCard) {
        pauseCount++;
        var stAtPause = await H.getState(pc.page);
        var segAtPause = null;
        for (var si = 0; si < segments.length; si++) {
          if (segments[si].end === stAtPause.demo.cursor && segments[si].end > segments[si].start) { segAtPause = segments[si]; break; }
        }
        var domAtPause = await pc.page.evaluate(function () {
          var playBtn = Array.prototype.slice.call(document.querySelectorAll('.demo-controls button'))[1];
          return { pauseMsg: document.querySelector('.pause-msg').textContent, playText: playBtn && playBtn.textContent };
        });
        if (domAtPause.playText !== env.texts.buttons.play) fail22('分段暫停卡片顯示中，播放鈕應為「' + env.texts.buttons.play + '」，實得 ' + domAtPause.playText);
        if (segAtPause) {
          var nextSeg = null;
          for (var nj = si + 1; nj < segments.length; nj++) { if (segments[nj].end > segments[nj].start) { nextSeg = segments[nj]; break; } }
          if (nextSeg) {
            var doneName = (env.texts.lbl[segAtPause.id] && env.texts.lbl[segAtPause.id].name) || segAtPause.id;
            var nextEntry = env.texts.lbl[nextSeg.id] || { name: nextSeg.id, desc: '' };
            var nextComposed = env.notation.fillTemplate(env.texts.demo.segmentNext, { name: nextEntry.name, desc: nextEntry.desc });
            var expectedMsg = env.notation.fillTemplate(env.texts.demo.segmentDone, { done: doneName, next: nextComposed });
            if (domAtPause.pauseMsg !== expectedMsg) fail22('分段暫停卡片文字不符：' + domAtPause.pauseMsg + ' != ' + expectedMsg);
          }
        } else {
          fail22('偵測到分段暫停卡片，但目前 cursor 未對應到任何非空段的 end');
        }

        if (!backStepCheckedOnce) {
          backStepCheckedOnce = true;
          // 「以上一步退回段尾不出現卡片」：先單步前進 1（卡片消失），再單步後退回到段尾，
          // 驗證此時不會重新出現分段卡片。
          await H.clickButtonByText(pc.page, env.texts.buttons.stepForward);
          await H.sleep((env.params.demo.speeds[2].stepMs * (env.params.demo.animRatio || 0.8)) + 250);
          await H.clickButtonByText(pc.page, env.texts.buttons.stepBack);
          await H.sleep((env.params.demo.speeds[2].stepMs * (env.params.demo.animRatio || 0.8)) + 250);
          var cursorAfterBack = (await H.getState(pc.page)).demo.cursor;
          var cardAfterBack = await pc.page.evaluate(function () { return !!document.querySelector('.pause-card'); });
          if (cursorAfterBack === stAtPause.demo.cursor && cardAfterBack) fail22('「上一步」退回段尾不應出現分段暫停卡片');
          await H.clickButtonByText(pc.page, env.texts.buttons.play);
        } else {
          await H.clickButtonByText(pc.page, env.texts.buttons.continue);
        }
      }
      await H.sleep(300);
    }
    if (!done) fail22('層先法示範播放逾時（120s）未完成');
    if (pauseCount !== expectedPauseCount) fail22('分段暫停卡片出現次數不符：' + pauseCount + ' != ' + expectedPauseCount);
    var finalCardGone = await pc.page.evaluate(function () { return !document.querySelector('.pause-card'); });
    if (!finalCardGone) fail22('最後一段結束不應仍顯示分段暫停卡片');

    env.record('T-UI-22', pass22, d22.join(' | ') || ('ok pauseCount=' + pauseCount + '/' + expectedPauseCount));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-14：禁用字掃描（多畫面）＋ <title> ＋「建議解示範」按鈕文字
// ---------------------------------------------------------------------------

async function checkT14(env) {
  var screens = [];
  var pass = true;
  var detail = [];
  function fail(m) { pass = false; detail.push('FAIL:' + m); }

  // index.html 的 <title>
  var titleEl = /<title>([^<]*)<\/title>/.exec(require('fs').readFileSync(env.indexPath, 'utf8'));
  var title = titleEl ? titleEl[1] : '';
  screens.push({ label: 'title', text: title });

  var pc = await C.openFresh(env, { tutorialOff: true });
  try {
    screens.push({ label: 'open', text: await C.bodyText(pc.page) });

    await C.newGame(pc.page, SUGGEST_SEED);
    await H.clickButtonByText(pc.page, env.texts.buttons.hint);
    await H.waitFor(async function () { var s = await H.getState(pc.page); return s.hint && s.hint.pending === false; }, 20000);
    screens.push({ label: 'hint', text: await C.bodyText(pc.page) });

    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoSuggest);
    await H.waitFor(async function () { var s = await H.getState(pc.page); return !!(s.demo && !s.demo.pending); }, 20000);
    var suggestScreenText = await C.bodyText(pc.page);
    screens.push({ label: 'suggest-demo', text: suggestScreenText });
    var hasSuggestBtnExact = await pc.page.evaluate(function (t) {
      return Array.prototype.some.call(document.querySelectorAll('button'), function (b) { return b.textContent === t; });
    }, env.texts.buttons.demoSuggest);
    if (!hasSuggestBtnExact) fail('「示範」分頁找不到文字恰為「' + env.texts.buttons.demoSuggest + '」的按鈕');

    await H.clickButtonByText(pc.page, env.texts.buttons.demoLbl);
    await H.waitFor(async function () { var s = await H.getState(pc.page); return !!(s.demo && !s.demo.pending); }, 20000);
    screens.push({ label: 'lbl-demo', text: await C.bodyText(pc.page) });

    await H.clickButtonByText(pc.page, env.texts.buttons.speedFast);
    await H.clickButtonByText(pc.page, env.texts.buttons.play);
    var gotCard = await H.waitFor(async function () {
      return pc.page.evaluate(function () { return !!document.querySelector('.pause-card'); });
    }, 15000, 300);
    if (gotCard) screens.push({ label: 'pause-card', text: await C.bodyText(pc.page) });

    // 完成畫面（直接以 TURN 快轉到解完，較快）
    var solvedState = await C.solveBySeed(env, pc.page, 99);
    screens.push({ label: 'completion', text: await C.bodyText(pc.page) });
  } finally {
    await pc.context.close();
  }

  var pc2 = await C.openFresh(env, { tutorialOff: false, presetTutorialDone: false });
  try {
    await pc2.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 8000 });
    screens.push({ label: 'tutorial-T0', text: await C.bodyText(pc2.page) });
    for (var i = 0; i < env.params.tutorial.notationBeforeIndex; i++) {
      await pc2.page.click('.lesson-next');
      await H.sleep(80);
    }
    screens.push({ label: 'lesson-L1', text: await C.bodyText(pc2.page) });
  } finally {
    await pc2.context.close();
  }

  screens.forEach(function (sc) {
    var hits = C.scanForbidden(sc.text, C.FORBIDDEN_WORDS);
    if (hits.length) fail('畫面「' + sc.label + '」出現禁用字：' + JSON.stringify(hits));
  });

  env.record('T-UI-14', pass, detail.join(' | ') || ('ok，共掃描 ' + screens.length + ' 個畫面'));
}

// ---------------------------------------------------------------------------
// T-UI-15：版型 C 版面規則（含自動切分頁、id 不重複）
// ---------------------------------------------------------------------------

async function checkT15(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  var pass = true;
  var detail = [];
  function fail(m) { pass = false; detail.push('FAIL:' + m); }
  try {
    var isLandscape = env.vp.width > env.vp.height;
    var layout = await pc.page.evaluate(function () {
      var leftcol = document.querySelector('.leftcol').getBoundingClientRect();
      var drawer = document.querySelector('#learnDrawer').getBoundingClientRect();
      var pos = getComputedStyle(document.querySelector('#learnDrawer')).position;
      var handleTap = document.querySelector('.handle-tap');
      var handleVisible = handleTap && getComputedStyle(handleTap).display !== 'none' && handleTap.getBoundingClientRect().height > 0;
      var ids = Array.prototype.map.call(document.querySelectorAll('[id]'), function (e) { return e.id; });
      var dupes = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
      var tabsExist = !!document.querySelector('#tabControls') && !!document.querySelector('#tabDemo');
      return { leftcol: leftcol, drawer: drawer, pos: pos, handleVisible: handleVisible, dupes: dupes, tabsExist: tabsExist };
    });

    if (layout.dupes.length) fail('同頁有重複 id：' + JSON.stringify(layout.dupes));
    if (layout.pos === 'absolute' || layout.pos === 'fixed') fail('#learnDrawer 的 position 不應是 absolute/fixed，實得 ' + layout.pos);
    if (!layout.tabsExist) fail('找不到「操作」「示範」分頁');

    if (isLandscape) {
      if (layout.drawer.left < layout.leftcol.right - 1) fail('iPad 橫向：學習面板 left 應 >= 方塊區 right（' + layout.drawer.left + ' < ' + layout.leftcol.right + '）');
      if (layout.drawer.height < env.vp.height * 0.8) fail('iPad 橫向：面板高度應 >= 畫面 80%，實得 ' + layout.drawer.height + '/' + env.vp.height);
      if (layout.handleVisible) fail('iPad 橫向不應有抽屜手把');
    } else {
      if (layout.drawer.top < layout.leftcol.bottom - 1) fail('手機直向：抽屜 top 應 >= 方塊區 bottom（' + layout.drawer.top + ' < ' + layout.leftcol.bottom + '）');
      if (H.rectsOverlap(layout.leftcol, layout.drawer)) fail('手機直向：方塊區與抽屜 boundingBox 不應重疊');
      if (!layout.handleVisible) fail('手機直向應有抽屜手把');

      // 按手把收合後方塊區變高、再展開後變矮
      var beforeToggle = await pc.page.evaluate(function () { return document.querySelector('.leftcol').getBoundingClientRect().height; });
      var wasExpanded = await pc.page.evaluate(function () { return document.querySelector('#learnDrawer').classList.contains('expanded'); });
      await pc.page.click('#handleTap');
      await H.sleep(120);
      var afterToggle = await pc.page.evaluate(function () { return document.querySelector('.leftcol').getBoundingClientRect().height; });
      if (wasExpanded) {
        if (!(afterToggle > beforeToggle)) fail('收合抽屜後方塊區應變高：before=' + beforeToggle + ' after=' + afterToggle);
      } else {
        if (!(afterToggle < beforeToggle)) fail('展開抽屜後方塊區應變矮：before=' + beforeToggle + ' after=' + afterToggle);
      }
      await pc.page.click('#handleTap');
      await H.sleep(120);
    }

    // 自動切分頁：看電腦解 → 示範分頁（手機同時展開）；DEMO_EXIT → 回操作分頁
    await C.newGame(pc.page, 1);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.sleep(80);
    var afterOpen = await pc.page.evaluate(function () {
      return {
        tabOn: document.querySelector('#tabDemo').classList.contains('on'),
        expanded: document.querySelector('#learnDrawer').classList.contains('expanded')
      };
    });
    if (!afterOpen.tabOn) fail('按「看電腦解」未切到示範分頁');
    if (!isLandscape && !afterOpen.expanded) fail('手機直向按「看電腦解」應同時展開抽屜');

    await H.clickButtonByText(pc.page, env.texts.buttons.demoSuggest);
    await H.waitFor(async function () { var s = await H.getState(pc.page); return !!(s.demo && !s.demo.pending); }, 20000);
    await H.clickButtonByText(pc.page, env.texts.buttons.exitDemo);
    await H.sleep(80);
    var afterExit = await pc.page.evaluate(function () { return document.querySelector('#tabControls').classList.contains('on'); });
    if (!afterExit) fail('DEMO_EXIT 後未切回「操作」分頁');

    env.record('T-UI-15', pass, detail.join(' | ') || 'ok');
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-16：首次教學與記號小教室（12 步；略過這段；跳過教學；走完寫旗標）
// ---------------------------------------------------------------------------

async function checkT16(env) {
  var passA = true, dA = [];
  function failA(m) { passA = false; dA.push('FAIL:' + m); }

  // ---- 子情境 A：從頭走完全部 12 步 ----
  var pcA = await H.newPage(env.browser, env.vp);
  try {
    await pcA.page.goto(env.INDEX_BASE + '?test=1'); // 無 tutorial=0、乾淨 storage：首次教學應觸發
    await pcA.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 8000 });

    var lessonTitles = env.texts.notation.lesson.map(function (l) { return l.title; });
    var lessonIdx = 0;

    for (var stepNo = 1; stepNo <= 12; stepNo++) {
      var meta = await pcA.page.evaluate(function () { return document.querySelector('.lesson-meta-primary').textContent; });
      var expectedMeta = env.notation.fillTemplate(env.texts.notation.tutorialProgress, { k: stepNo, n: 12 });
      if (meta !== expectedMeta) failA('第 ' + stepNo + ' 步進度文字不符：' + meta + ' != ' + expectedMeta);

      var isLessonStep = await pcA.page.evaluate(function () { return !document.querySelector('.lesson-title').hidden; });
      if (isLessonStep) {
        var title = await pcA.page.evaluate(function () { return document.querySelector('.lesson-title').textContent; });
        if (title !== lessonTitles[lessonIdx]) failA('L' + (lessonIdx + 1) + ' 標題不符：' + title + ' != ' + lessonTitles[lessonIdx]);

        var explainTxt = await pcA.page.evaluate(function () { return document.querySelector('.lesson-explain').textContent; });
        var demoMove = env.params.tutorial.notationSteps[lessonIdx].demo;
        var expectedExplain = env.notation.explainMove(demoMove, env.texts, env.engine);
        if (explainTxt !== expectedExplain) failA('L' + (lessonIdx + 1) + ' 白話說明不符：' + explainTxt + ' != ' + expectedExplain);

        var overlap = await pcA.page.evaluate(function () {
          function ro(a, b) { return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom); }
          return ro(document.querySelector('.lesson-card').getBoundingClientRect(), document.querySelector('.cube-scene').getBoundingClientRect());
        });
        if (overlap) failA('L' + (lessonIdx + 1) + ' 卡片與方塊區重疊');

        var beforeState = await H.getState(pcA.page);
        var totalMs = env.params.tutorial.demoHoldMs * 2 + env.params.tutorial.demoTurnMs * 2 + 300;
        await H.sleep(totalMs);
        var afterState = await H.getState(pcA.page);
        if (JSON.stringify(beforeState.home) !== JSON.stringify(afterState.home) ||
          JSON.stringify(beforeState.history) !== JSON.stringify(afterState.history) ||
          beforeState.orient !== afterState.orient || beforeState.version !== afterState.version) {
          failA('L' + (lessonIdx + 1) + ' 示範動畫改變了 state（home/history/orient/version 應不變）');
        }

        if (lessonIdx === 0) {
          var keyState0 = await H.getState(pcA.page);
          await pcA.page.click('button.kp[data-move="R"]', { force: true, timeout: 3000 }).catch(function () {});
          await H.sleep(200);
          var keyState1 = await H.getState(pcA.page);
          if (JSON.stringify(keyState0) !== JSON.stringify(keyState1)) failA('L1 期間按記號鍵不應改變 state');
        }
        lessonIdx++;
      }

      var isLast = stepNo === 12;
      await pcA.page.click('.lesson-next');
      await H.sleep(150);
    }
    if (lessonIdx !== 7) failA('應恰好走過 7 個記號小教室步，實得 ' + lessonIdx);

    var afterDone = await pcA.page.evaluate(function (k) {
      var raw = window.localStorage.getItem(k);
      return raw;
    }, env.params.storage.tutorialKey);
    if (!afterDone) failA('走完 12 步（開始玩）未寫入 tutorialKey');

    await pcA.page.reload();
    await pcA.page.waitForSelector('#keypad');
    var stillShows = await pcA.page.evaluate(function () {
      var el = document.querySelector('.lesson-card');
      return el && !el.hidden;
    });
    if (stillShows) failA('走完教學後重新整理不應再出現教學卡片');
  } finally {
    await pcA.context.close();
  }

  // ---- 子情境 B：L3「略過這段」跳到 T2；跳過教學寫旗標；重整不再出現 ----
  var passB = true, dB = [];
  function failB(m) { passB = false; dB.push('FAIL:' + m); }
  var pcB = await H.newPage(env.browser, env.vp);
  try {
    await pcB.page.goto(env.INDEX_BASE + '?test=1');
    await pcB.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 8000 });
    // 走到 L3（T0,T1 之後為 L1..L7；notationBeforeIndex=2，故 2 次下一步到 L1，再 2 次到 L3）
    for (var i = 0; i < env.params.tutorial.notationBeforeIndex + 2; i++) {
      await pcB.page.click('.lesson-next');
      await H.sleep(100);
    }
    var titleAtL3 = await pcB.page.evaluate(function () { return document.querySelector('.lesson-title').textContent; });
    if (titleAtL3 !== env.texts.notation.lesson[2].title) failB('未在 L3（實得標題：' + titleAtL3 + '）');

    await pcB.page.click('.lesson-skip-section');
    await H.sleep(100);
    var afterSkipSection = await pcB.page.evaluate(function () {
      return { titleHidden: document.querySelector('.lesson-title').hidden, body: document.querySelector('.lesson-body').textContent };
    });
    if (!afterSkipSection.titleHidden) failB('「略過這段」後應落在 T 步（無標題）');
    if (afterSkipSection.body !== env.texts.tutorial[2]) failB('「略過這段」未落在 T2：' + afterSkipSection.body);

    await pcB.page.click('.lesson-skip-all');
    await H.sleep(100);
    var flagWritten = await pcB.page.evaluate(function (k) { return !!window.localStorage.getItem(k); }, env.params.storage.tutorialKey);
    if (!flagWritten) failB('「跳過教學」未寫入 tutorialKey');

    await pcB.page.reload();
    await pcB.page.waitForSelector('#keypad');
    var showsAgain = await pcB.page.evaluate(function () {
      var el = document.querySelector('.lesson-card');
      return el && !el.hidden;
    });
    if (showsAgain) failB('「跳過教學」後重新整理不應再出現教學卡片');
  } finally {
    await pcB.context.close();
  }

  var pass = passA && passB;
  env.record('T-UI-16', pass, '[A]' + (dA.join(' | ') || 'ok') + ' [B]' + (dB.join(' | ') || 'ok'));
}

// ---------------------------------------------------------------------------
// T-UI-17：「記號說明」重開
// ---------------------------------------------------------------------------

async function checkT17(env) {
  var pc = await C.openFresh(env, { tutorialOff: false, presetTutorialDone: true });
  var pass = true, detail = [];
  function fail(m) { pass = false; detail.push('FAIL:' + m); }
  try {
    await C.newGame(pc.page, 23);
    await pc.page.click('button.kp[data-move="R"]', { force: true });
    // 用輪詢取代固定 sleep：整套測試連續執行時瀏覽器／CPU 負載較高，動畫＋dispatch
    // 偶爾會晚於固定緩衝時間才完成（曾在完整跑 24 項測試時觀察到偶發逾時，單獨跑
    // 本測試則穩定，屬負載造成的時間邊界問題，非功能缺陷）。
    var turnDone = await H.waitFor(async function () {
      var s = await H.getState(pc.page);
      return s.timer.state === 'running';
    }, 3000, 100);
    var beforeOpen = await H.getState(pc.page);
    if (!turnDone || beforeOpen.timer.state !== 'running') fail('開啟前計時應為 running');

    var savedFaceLabelOn = await pc.page.evaluate(function () { return document.querySelector('#faceLabelToggle').getAttribute('aria-checked') === 'true'; });
    var savedTab = await pc.page.evaluate(function () { return document.querySelector('#tabDemo').classList.contains('on') ? 'demo' : 'controls'; });

    await H.clickButtonByText(pc.page, env.texts.buttons.notationHelp);
    await pc.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 5000 });
    var midMeta = await pc.page.evaluate(function () { return document.querySelector('.lesson-meta-primary').textContent; });
    var expectedMidMeta = env.notation.fillTemplate(env.texts.notation.lessonProgress, { k: 1, n: 7 });
    if (midMeta !== expectedMidMeta) fail('開啟「記號說明」應直接顯示 L1：' + midMeta + ' != ' + expectedMidMeta);
    var midState = await H.getState(pc.page);
    if (midState.timer.state !== 'paused') fail('開啟「記號說明」應暫停計時（reason:lesson）');
    if (env.engine.moveCount(midState) !== env.engine.moveCount(beforeOpen)) fail('開啟「記號說明」不應改變步數');
    if (midState.assist.hint !== false || midState.assist.demo !== false) fail('開啟「記號說明」不應算使用提示');

    await H.clickButtonByText(pc.page, env.texts.buttons.lessonClose);
    await H.sleep(100);
    var afterCloseFaceOn = await pc.page.evaluate(function () { return document.querySelector('#faceLabelToggle').getAttribute('aria-checked') === 'true'; });
    var afterCloseTab = await pc.page.evaluate(function () { return document.querySelector('#tabDemo').classList.contains('on') ? 'demo' : 'controls'; });
    if (afterCloseFaceOn !== savedFaceLabelOn) fail('關閉後面標籤應恢復原值');
    if (afterCloseTab !== savedTab) fail('關閉後分頁應恢復原分頁');

    await pc.page.click('button.kp[data-move="U"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 300);
    var afterKey = await H.getState(pc.page);
    if (afterKey.timer.state !== 'running') fail('關閉後按鍵計時應恢復 running');

    // 等待提示（hint.pending）時「記號說明」為 disabled
    // 用測試掛鉤直接 dispatch HINT_REQUEST（不經過 hint-view.js 的 ctx.solver.requestHint），
    // 所以不會有真正的求解器回應；驗證完 disabled 狀態後，改用 HINT_FAILED{code:'CANCELLED'}
    // 模擬「取消」把 hint 清掉還原（與按提示卡片「取消」鈕效果相同），不必等真正求解完成。
    await pc.page.evaluate(function () { window.__cubeTest.dispatch({ type: 'HINT_REQUEST', payload: { at: 0 } }); });
    await H.sleep(30);
    var disabledDuringHint = await pc.page.evaluate(function (t) {
      var b = Array.prototype.slice.call(document.querySelectorAll('button')).find(function (x) { return x.textContent === t; });
      return b && b.disabled;
    }, env.texts.buttons.notationHelp);
    if (!disabledDuringHint) fail('提示等待中「記號說明」應 disabled');
    var stPending = await H.getState(pc.page);
    await pc.page.evaluate(function (v) {
      window.__cubeTest.dispatch({ type: 'HINT_FAILED', payload: { version: v, code: 'CANCELLED' } });
    }, stPending.version);
    await H.sleep(30);
    var afterCancelHint = await H.getState(pc.page);
    if (afterCancelHint.hint !== null) fail('模擬取消提示後 hint 應變回 null（測試清理步驟）');

    // 手機直向：抽屜收合時「記號說明」仍可見可按
    if (env.vp.width < env.vp.height) {
      if (await pc.page.evaluate(function () { return document.querySelector('#learnDrawer').classList.contains('expanded'); })) {
        await pc.page.click('#handleTap');
        await H.sleep(100);
      }
      var visibleWhenCollapsed = await pc.page.evaluate(function (t) {
        var b = Array.prototype.slice.call(document.querySelectorAll('button')).find(function (x) { return x.textContent === t; });
        if (!b) return false;
        var r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden';
      }, env.texts.buttons.notationHelp);
      if (!visibleWhenCollapsed) fail('手機直向抽屜收合時「記號說明」應仍可見');
    }

    // 示範自動播放中按「記號說明」→ 示範停止播放
    await C.newGame(pc.page, 23);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoOpen);
    await H.clickButtonByText(pc.page, env.texts.buttons.demoSuggest);
    await H.waitFor(async function () { var s = await H.getState(pc.page); return !!(s.demo && !s.demo.pending); }, 20000);
    await H.clickButtonByText(pc.page, env.texts.buttons.speedSlow);
    await H.clickButtonByText(pc.page, env.texts.buttons.play);
    await H.sleep(150);
    await H.clickButtonByText(pc.page, env.texts.buttons.notationHelp);
    // demo-player.js 的自動播放用 setInterval(tick, stepMs) 驅動，要等下一次 tick 觸發
    // 才會偵測到 ctx.input.locked() 並呼叫 stopPlaying()；stepMs 用「慢」速（900ms），
    // 這裡多等一輪 tick 的時間再檢查，避免用固定短暫的 sleep 造成偶發誤判。
    var slowStepMs = (env.params.demo.speeds.find(function (s) { return s.id === 'slow'; }) || { stepMs: 900 }).stepMs;
    var stopped = await H.waitFor(async function () {
      var txt = await pc.page.evaluate(function () {
        var btns = document.querySelectorAll('.demo-controls button');
        return btns[1] ? btns[1].textContent : null;
      });
      return txt === env.texts.buttons.play;
    }, slowStepMs * 2 + 1500, 150);
    if (!stopped) fail('打開「記號說明」應讓示範停止播放（播放鈕應變回「' + env.texts.buttons.play + '」）');
    await H.clickButtonByText(pc.page, env.texts.buttons.lessonClose);

    env.record('T-UI-17', pass, detail.join(' | ') || 'ok');
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-18：記號鍵中文副標＋aria-label（§11.2 表逐字核對）
// ---------------------------------------------------------------------------

var SPEC_SUBLABELS = {
  U: '上', "U'": '上・逆', U2: '上・半圈',
  D: '下', "D'": '下・逆', D2: '下・半圈',
  L: '左', "L'": '左・逆', L2: '左・半圈',
  R: '右', "R'": '右・逆', R2: '右・半圈',
  F: '前', "F'": '前・逆', F2: '前・半圈',
  B: '後', "B'": '後・逆', B2: '後・半圈',
  M: '左右間', "M'": '左右間・逆', M2: '左右間・半圈',
  E: '上下間', "E'": '上下間・逆', E2: '上下間・半圈',
  S: '前後間', "S'": '前後間・逆', S2: '前後間・半圈',
  x: '整顆上翻', "x'": '整顆下翻', x2: '上下翻半圈',
  y: '整顆左轉', "y'": '整顆右轉', y2: '左右轉半圈',
  z: '整顆右倒', "z'": '整顆左倒', z2: '側倒半圈'
};

async function checkT18(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  var pass = true, detail = [];
  try {
    var results = await pc.page.evaluate(function () {
      var out = {};
      document.querySelectorAll('button.kp').forEach(function (b) {
        out[b.dataset.move] = { sub: b.querySelector('.kp-sub').textContent, aria: b.getAttribute('aria-label'), big: b.querySelector('.kp-move').textContent };
      });
      return out;
    });
    var moves = Object.keys(SPEC_SUBLABELS);
    if (moves.length !== 36) throw new Error('SPEC_SUBLABELS 應有 36 筆，實得 ' + moves.length);
    moves.forEach(function (mv) {
      var r = results[mv];
      if (!r) { pass = false; detail.push('FAIL:找不到記號鍵 ' + mv); return; }
      if (r.sub !== SPEC_SUBLABELS[mv]) { pass = false; detail.push('FAIL:' + mv + ' 副標不符：' + r.sub + ' != ' + SPEC_SUBLABELS[mv]); }
      var expectedAria = r.big + ' ' + SPEC_SUBLABELS[mv];
      if (r.aria !== expectedAria) { pass = false; detail.push('FAIL:' + mv + ' aria-label 不符：' + r.aria + ' != ' + expectedAria); }
    });
    env.record('T-UI-18', pass, detail.join(' | ') || ('ok，共核對 ' + moves.length + ' 顆鍵'));
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-19：鍵盤分組與中層摺疊
// ---------------------------------------------------------------------------

async function checkT19(env) {
  var pc = await C.openFresh(env, { tutorialOff: true });
  var pass = true, detail = [];
  function fail(m) { pass = false; detail.push('FAIL:' + m); }
  try {
    var initial = await pc.page.evaluate(function () {
      function visibleCount(sel) {
        return Array.prototype.filter.call(document.querySelectorAll(sel), function (b) { return b.offsetParent !== null; }).length;
      }
      var sliceToggle = Array.prototype.slice.call(document.querySelectorAll('.kp-caption-toggle')).find(function (b) { return b.textContent.indexOf('中層') !== -1; });
      return {
        outerVisible: visibleCount('.kp-group:first-child button.kp'),
        rotVisible: visibleCount('button.kp.kp-rot'),
        sliceVisible: visibleCount('button.kp.kp-mid'),
        sliceExpanded: sliceToggle && sliceToggle.getAttribute('aria-expanded')
      };
    });
    if (initial.outerVisible !== 18) fail('開頁時外層應 18 顆可見，實得 ' + initial.outerVisible);
    if (initial.rotVisible !== 9) fail('開頁時整顆轉應 9 顆可見，實得 ' + initial.rotVisible);
    if (initial.sliceVisible !== 0) fail('開頁時中層應不可見，實得 ' + initial.sliceVisible + ' 顆可見');
    if (initial.sliceExpanded !== 'false') fail('開頁時中層摺疊鈕 aria-expanded 應為 false，實得 ' + initial.sliceExpanded);

    await pc.page.click('.kp-caption-toggle:has-text("' + env.texts.buttons.sliceFold + '")');
    await H.sleep(80);
    var afterExpand = await pc.page.evaluate(function () {
      function visibleCount(sel) { return Array.prototype.filter.call(document.querySelectorAll(sel), function (b) { return b.offsetParent !== null; }).length; }
      var sliceToggle = Array.prototype.slice.call(document.querySelectorAll('.kp-caption-toggle')).find(function (b) { return b.textContent.indexOf('中層') !== -1; });
      return { sliceVisible: visibleCount('button.kp.kp-mid'), expanded: sliceToggle.getAttribute('aria-expanded') };
    });
    if (afterExpand.sliceVisible !== 9) fail('展開後中層應 9 顆可見可按，實得 ' + afterExpand.sliceVisible);
    if (afterExpand.expanded !== 'true') fail('展開後 aria-expanded 應為 true');

    await C.newGame(pc.page, 1);
    await pc.page.click('button.kp[data-move="M"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 300);
    var afterMidClick = await H.getState(pc.page);
    if (env.engine.moveCount(afterMidClick) !== env.engine.qtmCost('M')) fail('展開後應可實際按下中層鍵（M 應計 ' + env.engine.qtmCost('M') + ' 步）');

    await pc.page.click('.kp-caption-toggle:has-text("' + env.texts.buttons.sliceFold + '")');
    await H.sleep(80);
    var collapsedAgain = await pc.page.evaluate(function () {
      return Array.prototype.filter.call(document.querySelectorAll('button.kp.kp-mid'), function (b) { return b.offsetParent !== null; }).length;
    });
    if (collapsedAgain !== 0) fail('再按一次應收合中層');

    await pc.page.reload();
    await pc.page.waitForSelector('#keypad');
    // S11：重新整理後抽屜展開動畫約 250 ms，等版面停止移動再點（否則 force 點擊可能落在兩列鍵之間）
    await H.waitLayoutStable(pc.page, '#keypad');
    var afterReload = await pc.page.evaluate(function () {
      return Array.prototype.filter.call(document.querySelectorAll('button.kp.kp-mid'), function (b) { return b.offsetParent !== null; }).length;
    });
    if (afterReload !== 0) fail('重新整理後中層應回到收合狀態');

    var beforeRotate = await H.getState(pc.page);
    await pc.page.click('button.kp[data-move="x"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 300);
    var afterRotate = await H.getState(pc.page);
    if (afterRotate.orient === beforeRotate.orient) fail('按整顆轉 x 應改變 orient');
    if (env.engine.moveCount(afterRotate) !== env.engine.moveCount(beforeRotate)) fail('按整顆轉 x 不應改變步數');

    env.record('T-UI-19', pass, detail.join(' | ') || 'ok');
  } finally {
    await pc.context.close();
  }
}

// ---------------------------------------------------------------------------
// T-UI-20：面標籤（位置跟隨、不隨顏色置換）
// ---------------------------------------------------------------------------

var CENTER_IDX = { U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 };

async function checkT20(env) {
  // 教學結束後六個中心沒有代號：用已完成教學的旗標開頁最貼近此描述。
  var pc = await C.openFresh(env, { tutorialOff: false, presetTutorialDone: true });
  var pass = true, detail = [];
  function fail(m) { pass = false; detail.push('FAIL:' + m); }
  try {
    var beforeToggle = await pc.page.evaluate(function (map) {
      return Object.keys(map).every(function (k) {
        var el = document.querySelector('[data-sticker="' + map[k] + '"] .face-label');
        return el.hidden;
      });
    }, CENTER_IDX);
    if (!beforeToggle) fail('教學結束後六個中心不應顯示代號');

    await pc.page.click('#faceLabelToggle');
    await H.sleep(60);
    var checkedAttr = await pc.page.evaluate(function () { return document.querySelector('#faceLabelToggle').getAttribute('aria-checked'); });
    if (checkedAttr !== 'true') fail('開啟後 aria-checked 應為 true');

    async function readLabels() {
      return pc.page.evaluate(function (map) {
        var out = {};
        Object.keys(map).forEach(function (letter) {
          var el = document.querySelector('[data-sticker="' + map[letter] + '"] .face-label');
          out[letter] = { hidden: el.hidden, html: el.innerHTML };
        });
        return out;
      }, CENTER_IDX);
    }
    var labels1 = await readLabels();
    Object.keys(CENTER_IDX).forEach(function (letter) {
      if (labels1[letter].hidden) fail('開啟後 ' + letter + ' 中心應顯示代號');
      if (labels1[letter].html.indexOf('<b>' + letter + '</b>') === -1) fail(letter + ' 位置代號不符：' + labels1[letter].html);
    });

    await C.newGame(pc.page, 1);
    await pc.page.click('button.kp[data-move="y"]', { force: true });
    await H.sleep((env.params.ui.turnAnimMs || 180) + 300);
    var labels2 = await readLabels();
    if (labels2.F.html.indexOf('<b>F</b>') === -1) fail('按 y 後前面中心應仍標 F（依位置）');
    var colorAfterY = await pc.page.evaluate(function () {
      return getComputedStyle(document.querySelector('[data-sticker="22"]')).backgroundColor;
    });
    // 顏色本身很難跟「轉前」比較（同一次 evaluate 已是轉後），改為核對 viewStickers 邏輯：
    // F 位置的顏色應等於 engine.viewStickers(state) 在索引 22 的色號對應的 hex，證明「標籤跟位置、
    // 貼紙顏色隨轉動改變」兩者同時成立、不衝突。
    var stAfterY = await H.getState(pc.page);
    var vsAfterY = env.engine.viewStickers(stAfterY);
    var expectedHex = env.palette.stickers[vsAfterY[22]].hex.toLowerCase();
    var actualHex = H.rgbToHex(colorAfterY);
    if (expectedHex !== actualHex) fail('按 y 後 idx22 顏色與 viewStickers 不符：' + actualHex + ' != ' + expectedHex);

    // M 為中層記號，鍵盤預設收合，先展開「中層（進階）」才能真正點到。
    await pc.page.click('.kp-caption-toggle:has-text("' + env.texts.buttons.sliceFold + '")');
    await H.sleep(80);
    await pc.page.click('button.kp[data-move="M"]');
    await H.sleep((env.params.ui.turnAnimMs || 180) + 300);
    var labels3 = await readLabels();
    Object.keys(CENTER_IDX).forEach(function (letter) {
      if (labels3[letter].html.indexOf('<b>' + letter + '</b>') === -1) fail('按 M 後 ' + letter + ' 標籤應仍依位置顯示');
    });

    // 拖曳視角放開後仍正確
    var pt = await H.outsideCubePoint(pc.page);
    await H.firePointerPath(pc.page, H.linePath(pt, { x: pt.x + 150, y: pt.y + 80 }, 10));
    await H.sleep((env.params.ui.snapAnimMs || 200) + 400);
    var labels4 = await readLabels();
    Object.keys(CENTER_IDX).forEach(function (letter) {
      if (labels4[letter].html.indexOf('<b>' + letter + '</b>') === -1) fail('拖曳視角放開後 ' + letter + ' 標籤應仍依位置顯示');
    });

    await pc.page.click('#faceLabelToggle');
    await H.sleep(60);
    var labels5 = await readLabels();
    Object.keys(CENTER_IDX).forEach(function (letter) {
      if (!labels5[letter].hidden) fail('關閉後 ' + letter + ' 代號應消失');
    });

    // 教學期間即使先前關閉也會顯示，結束後恢復關閉：另開一個乾淨情境驗證。
    env.record('T-UI-20', pass, detail.join(' | ') || 'ok');
  } finally {
    await pc.context.close();
  }

  // 教學強制開啟 + 結束後恢復關閉（獨立情境，狀態較單純）
  var pc2 = await H.newPage(env.browser, env.vp);
  var pass2 = true, d2 = [];
  try {
    await pc2.page.goto(env.INDEX_BASE + '?test=1');
    await pc2.page.waitForSelector('.lesson-card:not([hidden])', { timeout: 8000 });
    var duringTutorial = await pc2.page.evaluate(function (idx) {
      return document.querySelector('[data-sticker="' + idx + '"] .face-label').hidden;
    }, CENTER_IDX.U);
    if (duringTutorial) { pass2 = false; d2.push('FAIL:教學期間面標籤應強制開啟'); }
    await pc2.page.click('.lesson-skip-all');
    await H.sleep(100);
    var afterTutorial = await pc2.page.evaluate(function (idx) {
      return document.querySelector('[data-sticker="' + idx + '"] .face-label').hidden;
    }, CENTER_IDX.U);
    if (!afterTutorial) { pass2 = false; d2.push('FAIL:教學結束後面標籤應恢復關閉（開頁前預設值為 false）'); }
  } finally {
    await pc2.context.close();
  }
  if (!pass2) env.record('T-UI-20（教學強制開啟部分）', pass2, d2.join(' | '));
}

module.exports = {
  checkSuggestFlow: checkSuggestFlow,
  checkLblFlow: checkLblFlow,
  checkT14: checkT14,
  checkT15: checkT15,
  checkT16: checkT16,
  checkT17: checkT17,
  checkT18: checkT18,
  checkT19: checkT19,
  checkT20: checkT20
};
