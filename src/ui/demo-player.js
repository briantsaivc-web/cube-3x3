// src/ui/demo-player.js — 示範分頁與播放器（game-spec.md §9.1、§8、§2.3、§2.4）
//
// 依分派單 T-001 S8c 輸出契約：兩顆示範種類按鈕、播放器（播放/暫停/單步/速度/離開）、
// 記號列＋白話說明＋層高亮、層先法 8 段清單與分段暫停卡片（修訂 R-2e）。
// 本檔只呼叫 ctx.solver.requestDemo／cancel／status（X-9），不自行實作快取或退回；
// D-15：DEMO_EXIT 後切回「操作」分頁由本檔負責（透過 ctx.panel）。
// S11／B-1：失敗碼→文案鍵改呼叫 ctx.solver.failureTextKey（D-19 已刪除 hint-view.js 的
// mapFailureCode）；求解結果一律「先 dispatch、再做畫面副作用」，副作用包 try/catch，
// 單一 UI 錯誤不會讓 state.demo 永遠停在等待中。
// S11／D-26：上一步／下一步／分段跳轉／自動播放一律排入 ctx.input 的輸入佇列（與記號鍵同一機制），
// 動畫中按下不再被丟棄；取出時才依「當下」的 demo 進度決定要播哪個記號。
'use strict';

var hintView = require('./hint-view.js'); // 只借用其中的純函式 textByKey，同屬 S8c。

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

// D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
function numOr(v, dflt) {
  return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

function formatAlg(alg, engine) {
  return alg.split(' ').map(function (m) { return engine.formatMove(m); }).join(' ');
}

var SPEED_LABEL_KEY = { slow: 'speedSlow', mid: 'speedMid', fast: 'speedFast' };

function mount(ctx) {
  var doc = ctx.root.ownerDocument || document;
  var engine = ctx.engine;
  var notation = ctx.notation;
  var texts = ctx.data.texts;
  var params = ctx.data.params;
  var lbl = ctx.data.lbl;
  var lblTexts = texts.lbl;

  var container = doc.createElement('div');
  container.className = 'demo-root';
  ctx.slot('demo').appendChild(container);

  // ---- 本地 UI 狀態（不進 engine state，X-3） ----
  var speedIndex = 0;
  (function initSpeedIndex() {
    var speeds = (params.demo && params.demo.speeds) || [];
    var def = params.demo && params.demo.defaultSpeed;
    for (var i = 0; i < speeds.length; i++) {
      if (speeds[i].id === def) { speedIndex = i; return; }
    }
  })();
  var playing = false;
  var playTimer = null;
  var pauseCard = null; // {doneId, nextId}（修訂 R-2e，純 UI 狀態，不送 action、不改 demo）
  var demoFailureMsg = null;
  var demoFailureTimer = null;
  var highlighting = false;
  var wasDemoActive = false;
  var wasDemoReady = false; // 上一次 render 時示範已就緒（不是等待中）
  var pendingScrollChip = null;

  function currentSpeedMs() {
    var speeds = (params.demo && params.demo.speeds) || [{ stepMs: 500 }];
    return (speeds[speedIndex] || speeds[0]).stepMs;
  }
  function animMs() {
    return currentSpeedMs() * numOr(params.demo && params.demo.animRatio, 0.8);
  }

  function showDemoFailure(key) {
    demoFailureMsg = key;
    if (demoFailureTimer) clearTimeout(demoFailureTimer);
    // D-25：顯示時間改由 params.ui.demoErrorShowMs 決定
    demoFailureTimer = setTimeout(function () { demoFailureMsg = null; render(); },
      numOr(params.ui && params.ui.demoErrorShowMs, 6000));
  }
  function clearDemoFailure() {
    demoFailureMsg = null;
    if (demoFailureTimer) { clearTimeout(demoFailureTimer); demoFailureTimer = null; }
  }

  // ---- 播放控制 ----
  function stopPlayingInternal() {
    if (!playing) return;
    playing = false;
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }
  function stopPlaying() {
    stopPlayingInternal();
    render();
  }
  function startPlaying() {
    var state = ctx.getState();
    var info = engine.demoInfo(state);
    if (!info || info.cursor >= info.total) return;
    if (ctx.input.locked()) return;
    if (playing) return;
    playing = true;
    playTimer = setInterval(tick, currentSpeedMs());
    render();
  }
  function setSpeed(idx) {
    speedIndex = idx;
    if (playing) {
      clearInterval(playTimer);
      playTimer = setInterval(tick, currentSpeedMs());
    }
    render();
  }

  // 找出「本段完成」的分段暫停卡片是否要出現（修訂 R-2e；只在往前單步／自動播放後檢查，
  // DEMO_SEEK 與「上一步」不觸發，見呼叫端）。
  function maybeTriggerPauseCard(state) {
    var segments = state.demo.segments;
    if (!segments) return false;
    var cursor = state.demo.cursor;
    var doneIndex = -1;
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].end === cursor && segments[i].end > segments[i].start) { doneIndex = i; break; }
    }
    if (doneIndex === -1) return false;
    var nextSeg = null;
    for (var j = doneIndex + 1; j < segments.length; j++) {
      if (segments[j].end > segments[j].start) { nextSeg = segments[j]; break; }
    }
    if (!nextSeg) return false; // 最後一個非空段結束＝復原，改顯示完成畫面，不出現卡片
    pauseCard = { doneId: segments[doneIndex].id, nextId: nextSeg.id };
    return true;
  }

  // D-26：往前一步（排入輸入佇列）。取出時才讀「當下」的下一個記號來播動畫；
  // onDone(result) 在送出（或作廢）後呼叫，result = {dispatched, reachedEnd, pauseCard}。
  function enqueueStepForward(opts, onDone) {
    return ctx.input.enqueue({
      build: function () { return { type: 'DEMO_STEP', payload: { delta: 1, at: nowMs() } }; },
      animate: function () {
        var info = engine.demoInfo(ctx.getState());
        var ms = animMs();
        return info.nextIsRotation ? ctx.anim.rotate(info.nextToken, ms) : ctx.anim.turn(info.nextToken, ms);
      },
      after: function (dispatched) {
        var result = { dispatched: dispatched, reachedEnd: false, pauseCard: false };
        if (dispatched) {
          var newState = ctx.getState();
          var newInfo = engine.demoInfo(newState);
          result.reachedEnd = !newInfo || newInfo.cursor >= newInfo.total;
          if (opts.allowPauseCard && !result.reachedEnd && newState.demo && newState.demo.kind === 'lbl' &&
              params.demo && params.demo.pauseAtSegmentEnd) {
            result.pauseCard = maybeTriggerPauseCard(newState);
          }
        }
        if (onDone) onDone(result);
      }
    });
  }

  function enqueueStepBack() {
    return ctx.input.enqueue({
      build: function () { return { type: 'DEMO_STEP', payload: { delta: -1, at: nowMs() } }; },
      animate: function () {
        var state = ctx.getState();
        var token = state.demo.tokens[state.demo.cursor - 1];
        var inv = engine.inverse(token);
        var ms = animMs();
        return engine.kind(token) === 'rotation' ? ctx.anim.rotate(inv, ms) : ctx.anim.turn(inv, ms);
      },
      after: function () { render(); }
    });
  }

  function tick() {
    if (ctx.input.locked()) { stopPlaying(); return; }
    // 上一步還在播或還有排隊中的輸入：跳過這一拍（stepMs > 動畫時間，正常不會發生）
    if (!ctx.input.idle()) return;
    enqueueStepForward({ allowPauseCard: true }, function (result) {
      if (!playing) { render(); return; }
      if (!result.dispatched || result.reachedEnd || result.pauseCard) stopPlaying();
      else render();
    });
  }

  function onPlayPauseClick() {
    if (pauseCard) { pauseCard = null; startPlaying(); return; }
    if (playing) stopPlaying(); else startPlaying();
  }

  // 單步前進／後退：D-26 之後動畫中按下會排隊（佇列取出時重檢 canApply），不再丟棄。
  // 「下一步」依規格 §9.1／R-2e 可能觸發分段暫停卡片（與原本行為相同）。
  function onStepForward() {
    pauseCard = null; // 卡片顯示中按「下一步」→卡片消失並單步
    if (playing) stopPlayingInternal();
    if (ctx.input.locked()) { render(); return; }
    enqueueStepForward({ allowPauseCard: true }, function () { render(); });
    render();
  }

  function onStepBack() {
    pauseCard = null; // 按「上一步」→卡片消失，且不觸發新卡片
    if (playing) stopPlayingInternal();
    if (ctx.input.locked()) { render(); return; }
    enqueueStepBack();
    render();
  }

  function onSeek(target) {
    pauseCard = null; // 點分段清單→卡片消失，不觸發新卡片
    if (playing) stopPlayingInternal();
    if (ctx.input.locked()) { render(); return; }
    // 分段跳轉沒有動畫，但一樣排隊，確保在前面已排入的單步之後才執行（D-26）
    ctx.input.enqueue({
      build: function () { return { type: 'DEMO_SEEK', payload: { cursor: target, at: nowMs() } }; },
      animate: function () { return null; },
      after: function () { render(); }
    });
    render();
  }

  function onExit() {
    pauseCard = null;
    stopPlayingInternal();
    var state = ctx.getState();
    var action = { type: 'DEMO_EXIT', payload: { at: nowMs() } };
    if (!engine.canApply(state, action, ctx.data)) { render(); return; }
    ctx.dispatch(action); // render() 會在 ctx.subscribe 觸發，並在其中偵測 demo→null 切回操作分頁（D-15）
  }

  function canRequestKind(state, kind) {
    if (state.demo === null) {
      return engine.canApply(state, { type: 'DEMO_REQUEST', payload: { kind: kind, at: 0 } }, ctx.data);
    }
    if (state.demo.kind === kind) return true; // 目前種類本身一律視為可用（顯示為選取狀態）
    return state.status !== 'solved'; // 已復原時不可切換種類
  }

  function requestDemoKind(kind) {
    var state = ctx.getState();
    var action = { type: 'DEMO_REQUEST', payload: { kind: kind, at: nowMs() } };
    if (!engine.canApply(state, action, ctx.data)) return;
    ctx.dispatch(action);
    // §11.1：DEMO_REQUEST 被送出→切到示範分頁（手機同時展開抽屜）。
    ctx.panel.selectTab('demo');
    ctx.panel.expand(true);
    var newState = ctx.getState(); // 用「新的」state 呼叫 requestDemo（同 D-12 的精神）
    ctx.solver.requestDemo(newState, kind).then(function (resultAction) {
      // S11／B-1：先送出結果（DEMO_READY／DEMO_FAILED），確保 state.demo 一定離開等待中；
      // 之後的畫面副作用（失敗訊息、重畫）即使出錯也不影響 state。
      ctx.dispatch(resultAction);
      try {
        if (resultAction && resultAction.type === 'DEMO_FAILED') {
          var code = resultAction.payload && resultAction.payload.code;
          var key = ctx.solver.failureTextKey(code);
          if (key) showDemoFailure(key);
        }
      } finally {
        render();
      }
    });
    render();
  }

  function onPickKind(kind) {
    pauseCard = null;
    if (playing) stopPlayingInternal();
    var state = ctx.getState();
    if (state.demo !== null) {
      if (state.demo.kind === kind) return; // 已經是這個種類，不做事
      if (!canRequestKind(state, kind)) return; // 已復原時不可切換（X-16／9.1）
      var exitAction = { type: 'DEMO_EXIT', payload: { at: nowMs() } };
      if (!engine.canApply(state, exitAction, ctx.data)) return;
      ctx.dispatch(exitAction); // 依序送 DEMO_EXIT、DEMO_REQUEST{kind}（從目前進度重新求解）
    }
    clearDemoFailure();
    requestDemoKind(kind);
  }

  // ---- render：各種畫面片段 ----

  function buildKindRow(state, status) {
    var row = doc.createElement('div');
    row.className = 'demo-kind-row';
    var curKind = state.demo ? state.demo.kind : null;

    var suggestBtn = doc.createElement('button');
    suggestBtn.type = 'button';
    suggestBtn.className = 'ctl demo-kind-btn';
    suggestBtn.textContent = texts.buttons.demoSuggest;
    suggestBtn.classList.toggle('on', curKind === 'suggest');
    suggestBtn.disabled = status.state === 'failed' || !canRequestKind(state, 'suggest');
    suggestBtn.addEventListener('click', function () { onPickKind('suggest'); });

    var lblBtn = doc.createElement('button');
    lblBtn.type = 'button';
    lblBtn.className = 'ctl demo-kind-btn';
    lblBtn.textContent = texts.buttons.demoLbl;
    lblBtn.classList.toggle('on', curKind === 'lbl');
    lblBtn.disabled = !canRequestKind(state, 'lbl');
    lblBtn.addEventListener('click', function () { onPickKind('lbl'); });

    row.appendChild(suggestBtn);
    row.appendChild(lblBtn);
    return row;
  }

  function buildWaitCard(status, defaultText) {
    var waitText = defaultText;
    if (status.state === 'building') waitText = texts.solver.preparing;
    if (status.state === 'mainThread' && status.notice) waitText = texts.solver.mainThreadNotice;

    var card = doc.createElement('div');
    card.className = 'wait-card';
    var msg = doc.createElement('div');
    msg.className = 'wait-msg';
    msg.textContent = waitText;
    card.appendChild(msg);

    if (status.state === 'building') {
      var bar = doc.createElement('div');
      bar.className = 'progress-bar';
      var fill = doc.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = (status.total ? Math.round((status.step / status.total) * 100) : 0) + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
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
      var fail = { type: 'DEMO_FAILED', payload: { version: st.version, code: 'CANCELLED' } };
      if (engine.canApply(st, fail, ctx.data)) ctx.dispatch(fail);
      render();
    });
    card.appendChild(cancelBtn);
    return card;
  }

  function buildPauseCard() {
    var doneName = (lblTexts[pauseCard.doneId] && lblTexts[pauseCard.doneId].name) || pauseCard.doneId;
    var nextEntry = lblTexts[pauseCard.nextId] || { name: pauseCard.nextId, desc: '' };
    var nextComposed = notation.fillTemplate(texts.demo.segmentNext, { name: nextEntry.name, desc: nextEntry.desc });
    var msgText = notation.fillTemplate(texts.demo.segmentDone, { done: doneName, next: nextComposed });

    var card = doc.createElement('div');
    card.className = 'pause-card';
    var p = doc.createElement('div');
    p.className = 'pause-msg';
    p.textContent = msgText;
    card.appendChild(p);
    var contBtn = doc.createElement('button');
    contBtn.type = 'button';
    contBtn.className = 'ctl accent';
    contBtn.textContent = texts.buttons.continue;
    contBtn.addEventListener('click', function () { pauseCard = null; startPlaying(); });
    card.appendChild(contBtn);
    return card;
  }

  function buildControlsRow(info) {
    var row = doc.createElement('div');
    row.className = 'demo-controls';

    var btnBack = doc.createElement('button');
    btnBack.type = 'button'; btnBack.className = 'ctl';
    btnBack.textContent = texts.buttons.stepBack;
    btnBack.disabled = info.cursor <= 0;
    btnBack.addEventListener('click', onStepBack);

    var btnPlay = doc.createElement('button');
    btnPlay.type = 'button'; btnPlay.className = 'ctl accent';
    btnPlay.textContent = playing ? texts.buttons.pause : texts.buttons.play;
    btnPlay.disabled = !playing && info.cursor >= info.total;
    btnPlay.addEventListener('click', onPlayPauseClick);

    var btnFwd = doc.createElement('button');
    btnFwd.type = 'button'; btnFwd.className = 'ctl';
    btnFwd.textContent = texts.buttons.stepForward;
    btnFwd.disabled = info.cursor >= info.total;
    btnFwd.addEventListener('click', onStepForward);

    var btnExit = doc.createElement('button');
    btnExit.type = 'button'; btnExit.className = 'ctl';
    btnExit.textContent = texts.buttons.exitDemo;
    btnExit.addEventListener('click', onExit);

    row.appendChild(btnBack);
    row.appendChild(btnPlay);
    row.appendChild(btnFwd);
    row.appendChild(btnExit);
    return row;
  }

  function buildSpeedRow() {
    var row = doc.createElement('div');
    row.className = 'demo-speed-row';
    var speeds = (params.demo && params.demo.speeds) || [];
    speeds.forEach(function (spd, idx) {
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'ctl speed-btn';
      btn.classList.toggle('on', idx === speedIndex);
      btn.textContent = texts.buttons[SPEED_LABEL_KEY[spd.id]] || spd.id;
      btn.addEventListener('click', function () { setSpeed(idx); });
      row.appendChild(btn);
    });
    return row;
  }

  function buildSegmentList(state, info) {
    var wrap = doc.createElement('div');
    wrap.className = 'segment-list';
    state.demo.segments.forEach(function (seg, idx) {
      var isEmpty = seg.start === seg.end;
      var reached = state.demo.cursor >= seg.end;
      var isCurrent = !isEmpty && idx === info.segmentIndex && !reached;
      var isDone = !isEmpty && reached;

      var row = doc.createElement('div');
      row.className = 'segment-row';
      row.dataset.segmentId = seg.id;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');

      var segTexts = lblTexts[seg.id] || { name: seg.id, desc: '' };
      var nameEl = doc.createElement('div');
      nameEl.className = 'seg-name';

      if (isEmpty) {
        row.classList.add('skip');
        nameEl.textContent = '✓ ' + segTexts.name;
        row.appendChild(nameEl);
        var skipNote = doc.createElement('div');
        skipNote.className = 'seg-note';
        skipNote.textContent = texts.demo.segmentSkipped;
        row.appendChild(skipNote);
      } else if (isDone) {
        row.classList.add('done');
        nameEl.textContent = '✓ ' + segTexts.name;
        row.appendChild(nameEl);
      } else if (isCurrent) {
        row.classList.add('current');
        nameEl.textContent = segTexts.name;
        row.appendChild(nameEl);
        var descEl = doc.createElement('div');
        descEl.className = 'seg-desc';
        descEl.textContent = segTexts.desc;
        row.appendChild(descEl);
        var stepsEl = doc.createElement('div');
        stepsEl.className = 'seg-steps';
        stepsEl.textContent = notation.fillTemplate(texts.demo.segmentSteps, { n: seg.qtm });
        row.appendChild(stepsEl);

        if (info.partIndex >= 0) {
          var part = seg.parts[info.partIndex];
          if (part && part.kind === 'formula' && part.formula && lbl.formulas[part.formula]) {
            var formula = lbl.formulas[part.formula];
            var fBlock = doc.createElement('div');
            fBlock.className = 'formula-block';
            var fName = doc.createElement('div');
            fName.className = 'formula-name';
            fName.textContent = notation.fillTemplate(texts.demo.formula, {
              name: formula.name,
              alg: formatAlg(formula.alg, engine)
            });
            var fUse = doc.createElement('div');
            fUse.className = 'formula-use';
            fUse.textContent = notation.fillTemplate(texts.demo.formulaUse, { desc: formula.desc });
            fBlock.appendChild(fName);
            fBlock.appendChild(fUse);
            row.appendChild(fBlock);
          }
        }
      } else {
        row.classList.add('future');
        nameEl.textContent = segTexts.name;
        row.appendChild(nameEl);
      }

      row.addEventListener('click', function () { onSeek(seg.start); });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeek(seg.start); }
      });

      wrap.appendChild(row);
    });
    return wrap;
  }

  function buildPlayer(state, info) {
    var wrap = doc.createElement('div');
    wrap.className = 'demo-player';

    var header = doc.createElement('div');
    header.className = 'demo-header';
    var titleTemplate = state.demo.kind === 'suggest' ? texts.demo.suggestTitle : texts.demo.lblTitle;
    header.textContent = notation.fillTemplate(titleTemplate, { n: info.totalQtm });
    wrap.appendChild(header);

    if (state.demo.kind === 'suggest') {
      var note = doc.createElement('div');
      note.className = 'demo-note demo-note-sub';
      note.textContent = texts.demo.notShortest;
      wrap.appendChild(note);
    }

    var progress = doc.createElement('div');
    progress.className = 'demo-progress';
    progress.textContent = notation.fillTemplate(texts.demo.progress, { a: info.doneQtm, n: info.totalQtm });
    wrap.appendChild(progress);

    if (info.cursor < info.total) {
      var explain = doc.createElement('div');
      explain.className = 'demo-explain';
      explain.textContent = notation.explainMove(info.nextToken, texts, engine);
      wrap.appendChild(explain);
    }

    var scrollWrap = doc.createElement('div');
    scrollWrap.className = 'token-scroll';
    var tokenRow = doc.createElement('div');
    tokenRow.className = 'token-row';
    var nextChip = null;
    state.demo.tokens.forEach(function (t, i) {
      var chip = doc.createElement('div');
      chip.className = 'token-chip';
      if (i < info.cursor) chip.classList.add('done');
      if (i === info.cursor) chip.classList.add('next');
      var big = doc.createElement('div');
      big.className = 'token-move';
      big.textContent = engine.formatMove(t);
      var small = doc.createElement('div');
      small.className = 'token-step';
      small.textContent = engine.kind(t) === 'rotation'
        ? texts.demo.rotateLabel
        : notation.fillTemplate(texts.demo.segmentSteps, { n: engine.qtmCost(t) });
      chip.appendChild(big);
      chip.appendChild(small);
      tokenRow.appendChild(chip);
      if (i === info.cursor) nextChip = chip;
    });
    scrollWrap.appendChild(tokenRow);
    wrap.appendChild(scrollWrap);
    pendingScrollChip = nextChip;

    if (pauseCard) wrap.appendChild(buildPauseCard());

    wrap.appendChild(buildControlsRow(info));
    wrap.appendChild(buildSpeedRow());

    if (state.demo.kind === 'lbl') wrap.appendChild(buildSegmentList(state, info));

    return wrap;
  }

  function render() {
    var state = ctx.getState();
    var status = ctx.solver.status();

    // demo 由非 null 變 null → 清高亮、清本地狀態；若先前示範已就緒（DEMO_EXIT、重設等）
    // 才切回操作分頁（D-15）。S11：等待中被取消或求解失敗（DEMO_FAILED）時留在示範分頁，
    // 否則失敗訊息與「改看層先法示範」會被藏在看不到的分頁裡（§9.6）。
    var isDemoActive = state.demo !== null;
    if (wasDemoActive && !isDemoActive) {
      if (wasDemoReady) ctx.panel.selectTab('controls');
      if (highlighting) { ctx.view.highlight([]); highlighting = false; }
      pauseCard = null;
      stopPlayingInternal();
    }
    wasDemoActive = isDemoActive;
    wasDemoReady = isDemoActive && !state.demo.pending;

    container.innerHTML = '';
    pendingScrollChip = null;
    container.appendChild(buildKindRow(state, status));

    if (state.demo === null) {
      var pick = doc.createElement('div');
      pick.className = 'demo-pick';
      var promptEl = doc.createElement('div');
      promptEl.className = 'demo-note';
      promptEl.textContent = texts.demo.pickPrompt;
      pick.appendChild(promptEl);

      if (demoFailureMsg) {
        var failCard = doc.createElement('div');
        failCard.className = 'demo-note demo-error';
        failCard.textContent = hintView.textByKey(texts, demoFailureMsg);
        pick.appendChild(failCard);
        if (demoFailureMsg === 'demo.suggestUnavailable') {
          var tryBtn = doc.createElement('button');
          tryBtn.type = 'button';
          tryBtn.className = 'ctl';
          tryBtn.textContent = texts.buttons.tryLbl;
          tryBtn.addEventListener('click', function () { clearDemoFailure(); onPickKind('lbl'); });
          pick.appendChild(tryBtn);
        }
      }
      container.appendChild(pick);
      if (highlighting) { ctx.view.highlight([]); highlighting = false; }
      return;
    }

    if (state.demo.pending) {
      container.appendChild(buildWaitCard(status, texts.demo.solving));
      if (highlighting) { ctx.view.highlight([]); highlighting = false; }
      return;
    }

    var info = engine.demoInfo(state);
    container.appendChild(buildPlayer(state, info));
    if (pendingScrollChip) {
      pendingScrollChip.scrollIntoView({ block: 'nearest', inline: 'center' });
      pendingScrollChip = null;
    }

    if (info.cursor < info.total) {
      ctx.view.highlight(engine.demoNextLayer(state));
      highlighting = true;
    } else if (highlighting) {
      ctx.view.highlight([]);
      highlighting = false;
    }
  }

  ctx.subscribe(render);
  ctx.solver.onStatus(render);
  render();
}

module.exports = { mount: mount };
