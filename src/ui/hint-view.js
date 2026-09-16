// src/ui/hint-view.js — 提示按鈕、提示浮層、求解器狀態（game-spec.md §9.4、§2.3、§2.4）
//
// 依分派單 T-001 S8c 輸出契約：
//   - 「提示」按鈕掛進 hint-button 插槽（X-16：按鈕本身與行為屬 S8c）。
//   - 提示浮層（記號、步數、剩餘步數、白話說明）掛進 hint 插槽，層高亮呼叫 ctx.view.highlight。
//   - 求解器狀態（目前只有「failed」需要常駐顯示，見 game-spec.md §9.4 表）掛進 solver-status 插槽；
//     等待中的文案／進度條顯示在提示卡片內（跟著 hint.pending 出現，而不是全域常駐）。
// 本檔只呼叫 ctx.solver.requestHint／cancel／status（X-9），不自行實作快取或退回。
// D-12：先 dispatch HINT_REQUEST，再用「新的」state 呼叫 requestHint（避免提示座標用錯 orient）。
// D-19：失敗碼→文案鍵的對照改直接呼叫 ctx.solver.failureTextKey（app.js 已把
// solver-client.js 的同名純函式轉傳上來），移除本檔原本複製的 mapFailureCode()，
// 避免兩份對照表日後各自漂移（見 docs/reports/T-001-S8c.md「需要其他角色配合的事」）。
'use strict';

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

// D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
function numOr(v, dflt) {
  return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

function textByKey(texts, key) {
  var parts = key.split('.');
  var v = texts;
  for (var i = 0; i < parts.length; i++) {
    if (v == null) return '';
    v = v[parts[i]];
  }
  return v || '';
}

function mount(ctx) {
  var doc = ctx.root.ownerDocument || document;
  var engine = ctx.engine;
  var notation = ctx.notation;
  var texts = ctx.data.texts;
  var uiParams = (ctx.data.params && ctx.data.params.ui) || {};

  // ---- 「提示」按鈕（hint-button 插槽；X-16） ----
  var btnHint = doc.createElement('button');
  btnHint.type = 'button';
  btnHint.className = 'ctl';
  btnHint.textContent = texts.buttons.hint;
  ctx.slot('hint-button').appendChild(btnHint);

  function requestHint() {
    var state = ctx.getState();
    var action = { type: 'HINT_REQUEST', payload: { at: nowMs() } };
    if (!engine.canApply(state, action, ctx.data)) return;
    ctx.dispatch(action); // D-12：先 dispatch
    var newState = ctx.getState(); // 再用新 state 呼叫 requestHint
    ctx.solver.requestHint(newState).then(function (resultAction) {
      if (resultAction && resultAction.type === 'HINT_FAILED') {
        var code = resultAction.payload && resultAction.payload.code;
        var key = ctx.solver.failureTextKey(code);
        if (key) showFailure(key);
      }
      ctx.dispatch(resultAction);
      render();
    });
    render();
  }

  btnHint.addEventListener('click', function () {
    // D-26：還有排隊中的輸入或動畫時不送提示（提示要以「目前畫面」的局面求解）。
    if (ctx.input.locked() || !ctx.input.idle()) return;
    requestHint();
  });

  // ---- 短暫的失敗訊息（UI 自己的狀態；hint 清空後仍要讓玩家看得到原因幾秒） ----
  var failureMsg = null;
  var failureTimer = null;
  function showFailure(key) {
    failureMsg = key;
    if (failureTimer) clearTimeout(failureTimer);
    failureTimer = setTimeout(function () {
      failureMsg = null;
      render();
    }, numOr(uiParams.hintErrorShowMs, 4000)); // D-25：顯示時間改由 params.ui.hintErrorShowMs 決定
  }

  // ---- 高亮：只在「我自己設過」的情況下才清除，避免跟 demo-player 互相覆蓋 ----
  var highlighting = false;

  // ---- render ----
  var hintSlotEl = ctx.slot('hint');
  var solverStatusEl = ctx.slot('solver-status');

  function render() {
    var state = ctx.getState();
    var hint = state.hint;
    var status = ctx.solver.status();

    btnHint.disabled = !engine.canApply(state, { type: 'HINT_REQUEST', payload: { at: nowMs() } }, ctx.data);

    // ---- solver-status 插槽：依 §9.4 表，只有 failed 需要常駐顯示 ----
    solverStatusEl.innerHTML = '';
    if (status.state === 'failed') {
      var notice = doc.createElement('div');
      notice.className = 'solver-notice';
      notice.textContent = texts.solver.failed;
      solverStatusEl.appendChild(notice);
    }

    // ---- hint 插槽 ----
    hintSlotEl.innerHTML = '';

    if (hint && hint.pending) {
      var waitText = texts.hint.solving;
      if (status.state === 'building') waitText = texts.solver.preparing;
      if (status.state === 'mainThread' && status.notice) waitText = texts.solver.mainThreadNotice;

      var waitCard = doc.createElement('div');
      waitCard.className = 'wait-card';
      var msg = doc.createElement('div');
      msg.className = 'wait-msg';
      msg.textContent = waitText;
      waitCard.appendChild(msg);

      if (status.state === 'building') {
        var bar = doc.createElement('div');
        bar.className = 'progress-bar';
        var fill = doc.createElement('div');
        fill.className = 'progress-fill';
        fill.style.width = (status.total ? Math.round((status.step / status.total) * 100) : 0) + '%';
        bar.appendChild(fill);
        waitCard.appendChild(bar);
      }

      var cancelBtn = doc.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'ctl';
      cancelBtn.textContent = texts.buttons.cancel;
      // S13／m-3（D-35）：client 已沒有等待中的請求（例如先前的結果因例外沒送出）但畫面仍在等待時，
      // 直接以 CANCELLED 結束等待，確保「取消」在所有路徑都有效；client 有請求時行為不變。
      cancelBtn.addEventListener('click', function () {
        if (ctx.solver.cancel()) return;
        var st = ctx.getState();
        var fail = { type: 'HINT_FAILED', payload: { version: st.version, code: 'CANCELLED' } };
        if (engine.canApply(st, fail, ctx.data)) ctx.dispatch(fail);
        render();
      });
      waitCard.appendChild(cancelBtn);

      hintSlotEl.appendChild(waitCard);

      if (highlighting) { ctx.view.highlight([]); highlighting = false; }
    } else if (hint && hint.pending === false) {
      var hv = engine.hintView(state);
      var card = doc.createElement('div');
      card.className = 'hint-card';

      var closeBtn = doc.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'hint-close';
      closeBtn.setAttribute('aria-label', texts.buttons.cancel);
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', function () {
        var clearAction = { type: 'HINT_CLEAR', payload: {} };
        if (engine.canApply(ctx.getState(), clearAction, ctx.data)) ctx.dispatch(clearAction);
      });
      card.appendChild(closeBtn);

      var moveLine = doc.createElement('div');
      moveLine.className = 'hint-move';
      var moveText = notation.fillTemplate(texts.hint.move, { move: engine.formatMove(hv.move), qtm: hv.qtm });
      if (hv.source === 'suggest' && hv.planQtm !== null && hv.planQtm !== undefined) {
        moveText += ' · ' + notation.fillTemplate(texts.hint.plan, { n: hv.planQtm });
      }
      moveLine.textContent = moveText;
      card.appendChild(moveLine);

      var explainLine = doc.createElement('div');
      explainLine.className = 'hint-explain';
      explainLine.textContent = notation.explainMove(hv.move, texts, engine);
      card.appendChild(explainLine);

      var onlyLine = doc.createElement('div');
      onlyLine.className = 'hint-note';
      onlyLine.textContent = texts.hint.only;
      card.appendChild(onlyLine);

      hintSlotEl.appendChild(card);

      ctx.view.highlight(engine.hintLayer(state));
      highlighting = true;
    } else {
      if (highlighting) { ctx.view.highlight([]); highlighting = false; }
      if (failureMsg) {
        var errCard = doc.createElement('div');
        errCard.className = 'hint-card hint-error';
        errCard.textContent = textByKey(texts, failureMsg);
        hintSlotEl.appendChild(errCard);
      } else if (!hint && state.demo === null && state.status === 'playing') {
        // 示範進行中或非對局狀態時不顯示「卡住了嗎」提示語，避免蓋住示範層高亮或干擾自由模式。
        var prompt = doc.createElement('div');
        prompt.className = 'hint-prompt';
        prompt.textContent = texts.hint.prompt;
        hintSlotEl.appendChild(prompt);
      }
    }
  }

  ctx.subscribe(render);
  ctx.solver.onStatus(render);
  render();
}

module.exports = {
  mount: mount,
  textByKey: textByKey
};
