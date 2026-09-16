// src/ui/controls.js — 操作列、記號鍵盤、面標籤開關、學習面板分頁與抽屜手把
// 依據：game-spec.md §9.2、§11.1、§11.2；分派單 T-001 S8a。
//
// 本檔只送 action／呼叫 ctx.view、ctx.anim、ctx.panel；不自行計算任何規則。
'use strict';

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

// D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值（各檔各自一份，沿用 S8a 慣例）。
function numOr(v, dflt) {
  return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

function formatTime(ms) {
  var totalDeci = Math.floor(Math.max(0, ms) / 100);
  var m = Math.floor(totalDeci / 600);
  var s = Math.floor((totalDeci % 600) / 10);
  var d = totalDeci % 10;
  return m + ':' + (s < 10 ? '0' + s : String(s)) + '.' + d;
}

var OUTER_BASES = ['U', 'R', 'F', 'D', 'L', 'B'];
var ROTATION_BASES = ['x', 'y', 'z'];
var SLICE_BASES = ['M', 'E', 'S'];
var ROW_SUFFIXES = ['', "'", '2']; // 依 §11.2：cw 列、ccw 列、half 列

function mount(ctx) {
  var doc = ctx.root.ownerDocument || document;
  var engine = ctx.engine;
  var notation = ctx.notation;
  var texts = ctx.data.texts;
  var params = ctx.data.params;
  var buttons = texts.buttons;

  // ---- 操作列 ----
  var btnScramble = ctx.root.querySelector('#btnScramble');
  var btnUndo = ctx.root.querySelector('#btnUndo');
  var btnRedo = ctx.root.querySelector('#btnRedo');
  var btnReset = ctx.root.querySelector('#btnReset');
  var btnDemoOpen = ctx.root.querySelector('#btnDemoOpen');

  btnUndo.textContent = buttons.undo;
  btnRedo.textContent = buttons.redo;
  btnReset.textContent = buttons.reset;
  btnDemoOpen.textContent = buttons.demoOpen;

  function dispatchIfAllowed(action) {
    if (!engine.canApply(ctx.getState(), action, ctx.data)) return false;
    ctx.dispatch(action);
    return true;
  }

  // D-26：撤銷／重做也走輸入佇列，確保「按 R 之後馬上按撤銷」依序執行（沒有動畫）。
  function enqueueInstant(type) {
    if (ctx.input.locked()) return;
    ctx.input.enqueue({
      build: function () { return { type: type, payload: { at: nowMs() } }; },
      animate: function () { return null; }
    });
  }

  btnScramble.addEventListener('click', function () {
    var state = ctx.getState();
    if (state.status === 'playing' && state.cursor > 0) {
      var confirmMsg = (texts.confirm && texts.confirm.newGameInProgress) || '';
      var ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(confirmMsg)
        : true;
      if (!ok) return;
    }
    if (typeof ctx.newGame === 'function') ctx.newGame();
  });

  btnUndo.addEventListener('click', function () { enqueueInstant('UNDO'); });
  btnRedo.addEventListener('click', function () { enqueueInstant('REDO'); });
  btnReset.addEventListener('click', function () {
    // RESET 立即送出；app.js 在送出 RESET 時清空輸入佇列（D-26），作廢尚未送出的轉動。
    dispatchIfAllowed({ type: 'RESET', payload: { at: nowMs() } });
  });
  btnDemoOpen.addEventListener('click', function () {
    // X-16：本鈕只切分頁、展開抽屜，不送 action。
    ctx.panel.selectTab('demo');
    ctx.panel.expand(true);
  });

  // ---- 記號鍵盤（§11.2） ----
  var keypad = ctx.root.querySelector('#keypad');

  // D-26：動畫中的點擊不再丟棄，改排入輸入佇列（上限 params.input.queueMax），
  // 取出時重檢 canApply；NEW_GAME／RESET／上鎖時整個佇列作廢（修 K-1、m-2）。
  function pressMove(move) {
    if (ctx.input.locked()) return;
    var isRotation = engine.kind(move) === 'rotation';
    ctx.input.enqueue({
      build: function () {
        return isRotation
          ? { type: 'ROTATE', payload: { move: move } }
          : { type: 'TURN', payload: { move: move, at: nowMs() } };
      },
      animate: function () {
        var ms = numOr(params.ui && params.ui.turnAnimMs, 180);
        return isRotation ? ctx.anim.rotate(move, ms) : ctx.anim.turn(move, ms);
      }
    });
  }

  // D-25：keypad.showSubLabels 為 false 時不顯示中文副標（aria-label 仍含副標，維持無障礙名稱）。
  var showSubLabels = !(params.keypad && params.keypad.showSubLabels === false);

  function makeKeyButton(move) {
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'kp';
    btn.dataset.move = move;
    var big = doc.createElement('span');
    big.className = 'kp-move';
    big.textContent = engine.formatMove(move);
    var sub = doc.createElement('span');
    sub.className = 'kp-sub';
    sub.textContent = notation.keySubLabel(move, texts);
    btn.appendChild(big);
    if (showSubLabels) btn.appendChild(sub);
    btn.setAttribute('aria-label', notation.keyAriaLabel(move, texts, engine));
    btn.addEventListener('click', function () { pressMove(move); });
    return btn;
  }

  function buildRows(bases, extraClass) {
    var rows = doc.createElement('div');
    rows.className = 'kp-rows';
    ROW_SUFFIXES.forEach(function (suffix) {
      var row = doc.createElement('div');
      row.className = 'kp-row';
      bases.forEach(function (base) {
        var btn = makeKeyButton(base + suffix);
        if (extraClass) btn.classList.add(extraClass);
        row.appendChild(btn);
      });
      rows.appendChild(row);
    });
    return rows;
  }

  function buildGroup(opts) {
    var group = doc.createElement('div');
    group.className = 'kp-group';
    var caption;
    if (opts.collapsible) {
      caption = doc.createElement('button');
      caption.type = 'button';
      caption.className = 'kp-caption kp-caption-toggle';
      caption.setAttribute('aria-expanded', String(!opts.collapsedDefault));
      var body = buildRows(opts.bases, opts.extraClass);
      body.hidden = !!opts.collapsedDefault;
      caption.textContent = opts.captionText;
      caption.addEventListener('click', function () {
        var expanded = caption.getAttribute('aria-expanded') === 'true';
        caption.setAttribute('aria-expanded', String(!expanded));
        body.hidden = expanded;
      });
      group.appendChild(caption);
      group.appendChild(body);
    } else {
      caption = doc.createElement('div');
      caption.className = 'kp-caption';
      caption.textContent = opts.captionText;
      group.appendChild(caption);
      group.appendChild(buildRows(opts.bases, opts.extraClass));
    }
    return group;
  }

  var keypadTexts = texts.keypad;
  keypad.appendChild(buildGroup({
    captionText: keypadTexts.outer,
    bases: OUTER_BASES,
    collapsible: false
  }));
  keypad.appendChild(buildGroup({
    captionText: keypadTexts.rotation,
    bases: ROTATION_BASES,
    collapsible: true,
    collapsedDefault: !!(params.keypad && params.keypad.rotationCollapsedDefault),
    extraClass: 'kp-rot'
  }));
  var sliceCaptionWrap = doc.createElement('div');
  sliceCaptionWrap.className = 'kp-group';
  var sliceToggle = doc.createElement('button');
  sliceToggle.type = 'button';
  sliceToggle.className = 'kp-caption kp-caption-toggle';
  sliceToggle.textContent = buttons.sliceFold;
  var sliceCollapsedDefault = !(params.keypad && params.keypad.sliceCollapsedDefault === false);
  sliceToggle.setAttribute('aria-expanded', String(!sliceCollapsedDefault));
  var sliceBody = buildRows(SLICE_BASES, 'kp-mid');
  sliceBody.hidden = sliceCollapsedDefault;
  sliceToggle.addEventListener('click', function () {
    var expanded = sliceToggle.getAttribute('aria-expanded') === 'true';
    sliceToggle.setAttribute('aria-expanded', String(!expanded));
    sliceBody.hidden = expanded;
  });
  sliceCaptionWrap.appendChild(sliceToggle);
  sliceCaptionWrap.appendChild(sliceBody);
  keypad.appendChild(sliceCaptionWrap);

  // ---- 面標籤開關（§11.2） ----
  // D-19：aria-checked 改訂閱 ctx.view.onFaceLabelsChange，不論是玩家親手點擊，
  // 或 tutorial.js 呼叫 ctx.view.setFaceLabels() 強制開關，開關外觀都會自動同步
  // （取代原本只在 click handler 裡才同步的作法）。
  var faceLabelToggle = ctx.root.querySelector('#faceLabelToggle');
  faceLabelToggle.textContent = buttons.faceLabels;
  function syncFaceLabelSwitch(on) {
    faceLabelToggle.setAttribute('aria-checked', String(!!on));
  }
  syncFaceLabelSwitch(ctx.view.faceLabels());
  ctx.view.onFaceLabelsChange(syncFaceLabelSwitch);
  faceLabelToggle.addEventListener('click', function () {
    ctx.view.setFaceLabels(!ctx.view.faceLabels());
  });

  // ---- 分頁（操作／示範） ----
  var tabControls = ctx.root.querySelector('#tabControls');
  var tabDemo = ctx.root.querySelector('#tabDemo');
  var panelControls = ctx.root.querySelector('#panelControls');
  var panelDemo = ctx.root.querySelector('#panelDemo');
  tabControls.textContent = texts.panel.tabControls;
  tabDemo.textContent = texts.panel.tabDemo;

  function syncTabs() {
    var tab = ctx.panel.currentTab();
    tabControls.classList.toggle('on', tab === 'controls');
    tabDemo.classList.toggle('on', tab === 'demo');
    tabControls.setAttribute('aria-selected', String(tab === 'controls'));
    tabDemo.setAttribute('aria-selected', String(tab === 'demo'));
    panelControls.hidden = tab !== 'controls';
    panelDemo.hidden = tab !== 'demo';
  }
  tabControls.addEventListener('click', function () { ctx.panel.selectTab('controls'); });
  tabDemo.addEventListener('click', function () { ctx.panel.selectTab('demo'); });

  // ---- 抽屜手把（手機直向；§11.1） ----
  var learnDrawer = ctx.root.querySelector('#learnDrawer');
  var handleTap = ctx.root.querySelector('#handleTap');
  var drawerLabel = ctx.root.querySelector('#drawerLabel');
  drawerLabel.textContent = texts.panel.title;

  function syncDrawer() {
    var expanded = ctx.panel.expanded();
    learnDrawer.classList.toggle('expanded', expanded);
    handleTap.setAttribute('aria-expanded', String(expanded));
  }
  handleTap.addEventListener('click', function () {
    ctx.panel.expand(!ctx.panel.expanded());
  });
  handleTap.setAttribute('role', 'button');
  handleTap.tabIndex = 0;
  handleTap.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ctx.panel.expand(!ctx.panel.expanded());
    }
  });

  ctx.panel.onChange(function () {
    syncTabs();
    syncDrawer();
  });
  syncTabs();
  syncDrawer();

  // ---- 打亂字串顯示 ----
  var scrambleLine = ctx.root.querySelector('#scrambleLine');

  function updateScrambleLine(state) {
    if (!scrambleLine) return;
    if (!state.scramble || state.scramble.length === 0) {
      scrambleLine.hidden = true;
      return;
    }
    scrambleLine.hidden = false;
    var alg = state.scramble.map(function (m) { return engine.formatMove(m); }).join(' ');
    scrambleLine.innerHTML = '';
    var line = doc.createElement('div');
    line.textContent = notation.fillTemplate(texts.scramble.label, { alg: alg });
    var note = doc.createElement('div');
    note.className = 'scramble-note';
    note.textContent = texts.scramble.notOfficial;
    scrambleLine.appendChild(line);
    scrambleLine.appendChild(note);
  }

  // ---- HUD：時間、步數、有提示徽章（依 timerRefreshMs 更新） ----
  var timerVal = ctx.root.querySelector('#timerVal');
  var moveVal = ctx.root.querySelector('#moveVal');
  var hintBadge = ctx.root.querySelector('#hintBadge');
  var hudTimeLabel = ctx.root.querySelector('#hudTimeLabel');
  var hudMovesLabel = ctx.root.querySelector('#hudMovesLabel');
  hudTimeLabel.textContent = texts.hud.time;
  hudMovesLabel.textContent = texts.hud.moves;
  hintBadge.textContent = texts.result.badgeHint;

  // ---- D-19：texts.hud.qtmNote 在步數旁以可點的小說明呈現（≥44×44 可點元素） ----
  var qtmNoteBtn = ctx.root.querySelector('#qtmNoteBtn');
  var qtmNoteLine = ctx.root.querySelector('#qtmNoteLine');
  if (qtmNoteBtn && qtmNoteLine) {
    qtmNoteLine.textContent = texts.hud.qtmNote || '';
    qtmNoteBtn.setAttribute('aria-label', texts.hud.qtmNote || '');
    qtmNoteBtn.addEventListener('click', function () {
      var open = qtmNoteLine.hidden;
      qtmNoteLine.hidden = !open;
      qtmNoteBtn.setAttribute('aria-expanded', String(open));
    });
  }

  function updateHud() {
    var state = ctx.getState();
    timerVal.textContent = formatTime(engine.elapsedMs(state, nowMs()));
    moveVal.textContent = String(engine.moveCount(state));
    hintBadge.hidden = !state.assist.hint;
    btnUndo.disabled = !engine.canApply(state, { type: 'UNDO', payload: { at: nowMs() } }, ctx.data);
    btnRedo.disabled = !engine.canApply(state, { type: 'REDO', payload: { at: nowMs() } }, ctx.data);
    btnScramble.textContent = state.status === 'free' ? buttons.scramble : buttons.newGame;
    updateScrambleLine(state);
  }

  ctx.subscribe(updateHud);
  updateHud();
  var refreshMs = numOr(params.ui && params.ui.timerRefreshMs, 100);
  setInterval(updateHud, refreshMs);
}

module.exports = {
  mount: mount,
  formatTime: formatTime
};
