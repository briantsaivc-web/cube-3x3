// src/ui/tutorial.js — 首次教學、記號小教室、「記號說明」重開（game-spec.md §6.2、§11.2、§11.3）
//
// 依分派單 T-001 S8d：只呼叫 engine 的純函數（layerStickers／viewStickers／applyMove／
// inverse／describeMove 經由 notation.explainMove）與 ctx 提供的介面；不自行判斷記號種類、
// 步數或轉動規則。旗標存取一律包 try/catch，不可用時教學仍可完成，只是下次會再出現。
'use strict';

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

function delay(win, ms) {
  return new Promise(function (resolve) {
    (win && win.setTimeout ? win : (typeof window !== 'undefined' ? window : { setTimeout: setTimeout })).setTimeout(resolve, ms);
  });
}

/**
 * 讀教學旗標（§6.4：`{v:1, done:true}`；格式不符或存取失敗一律視為「未完成」）。
 */
function safeReadTutorialDone(win, key) {
  try {
    if (!win || !win.localStorage) return false;
    var raw = win.localStorage.getItem(key);
    if (!raw) return false;
    var obj = JSON.parse(raw);
    return !!(obj && obj.v === 1 && obj.done === true);
  } catch (e) {
    return false;
  }
}

function safeWriteTutorialDone(win, key) {
  try {
    if (!win || !win.localStorage) return;
    win.localStorage.setItem(key, JSON.stringify({ v: 1, done: true }));
  } catch (e) {
    // 忽略：寫入失敗不報錯，遊戲照常（§11.3：完成或跳過時寫入旗標，寫入失敗不算錯誤）
  }
}

/**
 * 組出完整 12 步（T0、T1、L1..L7、T2、T3、T4）；L 步文字取自 texts.notation.lesson（依 id 對應），
 * 示範記號與插入位置取自 params.tutorial（notationSteps、notationBeforeIndex），不寫死。
 * @returns {{all: Array, lessonOnly: Array}}
 */
function buildSteps(texts, tutorialParams) {
  var tutorialTexts = texts.tutorial || [];
  var tSteps = tutorialTexts.map(function (body) {
    return { kind: 'T', body: body };
  });
  var lessonTextById = {};
  (texts.notation && texts.notation.lesson || []).forEach(function (l) {
    lessonTextById[l.id] = l;
  });
  var notationSteps = tutorialParams.notationSteps || [];
  var lSteps = notationSteps.map(function (s) {
    var lt = lessonTextById[s.id] || { title: '', body: '' };
    return { kind: 'L', id: s.id, title: lt.title || '', body: lt.body || '', demo: s.demo };
  });
  var insertAt = typeof tutorialParams.notationBeforeIndex === 'number'
    ? tutorialParams.notationBeforeIndex
    : tSteps.length;
  insertAt = Math.max(0, Math.min(insertAt, tSteps.length));
  var all = tSteps.slice(0, insertAt).concat(lSteps).concat(tSteps.slice(insertAt));
  return { all: all, lessonOnly: lSteps };
}

function mount(ctx) {
  var texts = ctx.data.texts || {};
  var buttons = texts.buttons || {};
  var notationTexts = texts.notation || {};
  var params = ctx.data.params || {};
  var tutorialParams = params.tutorial || {};
  var storageParams = params.storage || {};
  var tutorialKey = storageParams.tutorialKey || 'cube3x3.tutorial.v1';
  var demoTurnMs = typeof tutorialParams.demoTurnMs === 'number' ? tutorialParams.demoTurnMs : 600;
  var demoHoldMs = typeof tutorialParams.demoHoldMs === 'number' ? tutorialParams.demoHoldMs : 700;
  // D-25：faceLabels.forceOnInTutorial 決定教學與記號小教室期間是否強制開啟面標籤
  // （鍵缺少時預設 true，與規格 §10.3 預設值相同）。
  var forceFaceLabels = !(params.faceLabels && params.faceLabels.forceOnInTutorial === false);

  var win = (typeof window !== 'undefined') ? window : null;
  var engine = ctx.engine;
  var notation = ctx.notation;

  var built = buildSteps(texts, tutorialParams);
  var allSteps = built.all; // 12 步（首次教學）
  var lessonOnlySteps = built.lessonOnly; // 7 步（記號說明重開）

  // ---- DOM：lesson-card 插槽（一次建立，之後只更新內容） ----
  var lessonEl = ctx.slot('lesson-card');
  var lessonButtonSlot = ctx.slot('lesson-button');
  var panelControlsEl = ctx.root.querySelector('#panelControls');
  var panelDemoEl = ctx.root.querySelector('#panelDemo');
  var ctabsEl = ctx.root.querySelector('.ctabs');
  var faceLabelToggleEl = ctx.root.querySelector('#faceLabelToggle');

  var elMetaPrimary = document.createElement('div');
  elMetaPrimary.className = 'lesson-meta lesson-meta-primary';
  var elMetaSecondary = document.createElement('div');
  elMetaSecondary.className = 'lesson-meta lesson-meta-secondary';
  var elTitle = document.createElement('h3');
  elTitle.className = 'lesson-title';
  var elBody = document.createElement('p');
  elBody.className = 'lesson-body';
  var elExplain = document.createElement('p');
  elExplain.className = 'lesson-explain';
  var elActions = document.createElement('div');
  elActions.className = 'lesson-actions';

  function makeBtn(cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ctl lesson-btn ' + cls;
    return b;
  }
  var btnPrev = makeBtn('lesson-prev');
  var btnSkipSection = makeBtn('lesson-skip-section');
  var btnReplay = makeBtn('lesson-replay');
  var btnNext = makeBtn('lesson-next accent');
  var btnSkipAll = makeBtn('lesson-skip-all');
  var btnClose = makeBtn('lesson-close');

  btnPrev.textContent = buttons.tutPrev || '';
  btnSkipSection.textContent = buttons.lessonSkip || '';
  btnReplay.textContent = buttons.lessonReplay || '';
  btnSkipAll.textContent = buttons.tutSkip || '';
  btnClose.textContent = buttons.lessonClose || '';

  [btnPrev, btnSkipSection, btnReplay, btnNext, btnSkipAll, btnClose].forEach(function (b) {
    elActions.appendChild(b);
  });
  [elMetaPrimary, elMetaSecondary, elTitle, elBody, elExplain, elActions].forEach(function (el) {
    lessonEl.appendChild(el);
  });

  // ---- 「記號說明」按鈕（面板頂列／手把列插槽，§11.2、§11.3） ----
  var btnNotationHelp = document.createElement('button');
  btnNotationHelp.type = 'button';
  btnNotationHelp.className = 'ctl notation-help-btn';
  btnNotationHelp.textContent = buttons.notationHelp || '';
  lessonButtonSlot.appendChild(btnNotationHelp);

  // ---- 狀態 ----
  var mode = null; // null | 'onboarding' | 'lesson'
  var stepIdx = 0;
  var demoGen = 0; // 世代計數器：換步／關閉時 +1，讓進行中的 Promise 鏈不再繼續下一段
  var savedFaceLabels = false;
  var savedTab = 'controls';
  var LOCK_OWNER = 'lesson';

  function currentSteps() {
    return mode === 'onboarding' ? allSteps : lessonOnlySteps;
  }

  // D-19：ctx.view 已補上 onFaceLabelsChange（cube-view.js／app.js），controls.js
  // 訂閱後會自動同步 #faceLabelToggle 的 aria-checked，本檔呼叫 ctx.view.setFaceLabels()
  // 即可，不必再自己直接操作該按鈕屬性（移除原本的 setFaceLabelsSynced() 繞道，
  // 見 docs/reports/T-001-S8d.md「未預期發現」第 2 點）。

  function clearDemo() {
    demoGen++;
    if (ctx.view) {
      ctx.view.highlight([]);
      ctx.view.clearPreview();
    }
  }

  function playStepDemo() {
    var s = currentSteps()[stepIdx];
    if (!s || s.kind !== 'L' || !ctx.view) return;
    var myGen = ++demoGen;
    var move = s.demo;
    var base = engine.viewStickers(ctx.getState());
    ctx.view.highlight(engine.layerStickers(move));
    delay(win, demoHoldMs).then(function () {
      if (myGen !== demoGen) return null;
      return ctx.view.previewTurn(base, move, demoTurnMs);
    }).then(function () {
      if (myGen !== demoGen) return null;
      return delay(win, demoHoldMs);
    }).then(function () {
      if (myGen !== demoGen) return null;
      var rotated = engine.applyMove(base, move);
      var inv = engine.inverse(move);
      return ctx.view.previewTurn(rotated, inv, demoTurnMs);
    }).then(function () {
      if (myGen !== demoGen) return;
      ctx.view.highlight([]);
    });
  }

  function pauseTimerIfRunning() {
    var st = ctx.getState();
    if (st.timer && st.timer.state === 'running') {
      ctx.dispatch({ type: 'PAUSE', payload: { at: nowMs(), reason: 'lesson' } });
    }
  }

  function applyStepSideEffects() {
    clearDemo();
    var s = currentSteps()[stepIdx];
    if (s && s.kind === 'L') {
      ctx.input.lock(LOCK_OWNER);
      pauseTimerIfRunning();
      playStepDemo();
    } else {
      ctx.input.unlock(LOCK_OWNER);
    }
  }

  // 只有「記號小教室」（L 步，無論在首次教學中或「記號說明」重開）才取代分頁內容
  // （§11.1：「小教室卡片顯示在學習面板內（取代分頁內容）」，字面上只針對小教室）；
  // 一般教學步（T0～T4）卡片與目前分頁內容並存（card 用 order:-1 排在最上面，
  // 分頁內容留在下方可捲動），因為 T2 明確要玩家去看「操作」分頁的按鈕，
  // 若整個教學期間都蓋住分頁內容，玩家會找不到 T2 說的鍵盤（見 S8d 回報「未預期發現」）。
  function syncPanelVisibilityForStep() {
    var s = currentSteps()[stepIdx];
    var isLessonStep = !!(s && s.kind === 'L');
    if (isLessonStep) {
      panelControlsEl.hidden = true;
      panelDemoEl.hidden = true;
      if (ctabsEl) ctabsEl.hidden = true;
    } else {
      if (ctabsEl) ctabsEl.hidden = false;
      var tab = ctx.panel.currentTab();
      panelControlsEl.hidden = tab !== 'controls';
      panelDemoEl.hidden = tab !== 'demo';
    }
  }

  function showLessonUI() {
    lessonEl.hidden = false;
    if (faceLabelToggleEl) faceLabelToggleEl.disabled = true;
  }

  function hideLessonUI() {
    lessonEl.hidden = true;
    if (ctabsEl) ctabsEl.hidden = false;
    var tab = ctx.panel.currentTab();
    panelControlsEl.hidden = tab !== 'controls';
    panelDemoEl.hidden = tab !== 'demo';
    if (faceLabelToggleEl) faceLabelToggleEl.disabled = false;
  }

  function renderStep() {
    var steps = currentSteps();
    var s = steps[stepIdx];
    if (!s) return;

    if (mode === 'onboarding') {
      var overallIdx = allSteps.indexOf(s);
      elMetaPrimary.hidden = false;
      elMetaPrimary.textContent = notation.fillTemplate(notationTexts.tutorialProgress || '', {
        k: overallIdx + 1, n: allSteps.length
      });
      if (s.kind === 'L') {
        var lessonIdx = lessonOnlySteps.indexOf(s);
        elMetaSecondary.hidden = false;
        elMetaSecondary.textContent = notation.fillTemplate(notationTexts.lessonProgress || '', {
          k: lessonIdx + 1, n: lessonOnlySteps.length
        });
      } else {
        elMetaSecondary.hidden = true;
        elMetaSecondary.textContent = '';
      }
    } else {
      elMetaPrimary.hidden = false;
      elMetaPrimary.textContent = notation.fillTemplate(notationTexts.lessonProgress || '', {
        k: stepIdx + 1, n: lessonOnlySteps.length
      });
      elMetaSecondary.hidden = true;
      elMetaSecondary.textContent = '';
    }

    if (s.kind === 'L') {
      elTitle.hidden = false;
      elTitle.textContent = s.title;
      elExplain.hidden = false;
      elExplain.textContent = notation.explainMove(s.demo, texts, engine);
    } else {
      elTitle.hidden = true;
      elTitle.textContent = '';
      elExplain.hidden = true;
      elExplain.textContent = '';
    }
    elBody.textContent = s.body;

    var isFirst = stepIdx === 0;
    var isLast = stepIdx === steps.length - 1;
    btnPrev.disabled = isFirst;

    if (mode === 'onboarding') {
      btnSkipAll.hidden = false;
      btnClose.hidden = true;
      btnNext.textContent = isLast ? (buttons.tutDone || '') : (buttons.tutNext || '');
      btnSkipSection.hidden = s.kind !== 'L';
      btnReplay.hidden = s.kind !== 'L';
    } else {
      btnSkipAll.hidden = true;
      btnClose.hidden = false;
      btnNext.textContent = isLast ? (buttons.lessonClose || '') : (buttons.tutNext || '');
      btnSkipSection.hidden = true; // 記號說明重開只有 L 步，沒有「略過這段」的下一個 T 步可跳
      btnReplay.hidden = false; // 記號說明重開全部是 L 步
    }

    syncPanelVisibilityForStep();
    applyStepSideEffects();
  }

  function goNext() {
    if (!mode) return;
    var steps = currentSteps();
    if (stepIdx >= steps.length - 1) {
      finishCurrent();
      return;
    }
    stepIdx++;
    renderStep();
  }

  function goPrev() {
    if (!mode || stepIdx <= 0) return;
    stepIdx--;
    renderStep();
  }

  function skipSection() {
    if (mode !== 'onboarding') return;
    var idx = stepIdx;
    while (idx < allSteps.length && allSteps[idx].kind === 'L') idx++;
    stepIdx = Math.min(idx, allSteps.length - 1);
    renderStep();
  }

  function replay() {
    var s = currentSteps()[stepIdx];
    if (!s || s.kind !== 'L') return;
    clearDemo();
    playStepDemo();
  }

  function finishCurrent() {
    if (mode === 'onboarding') {
      safeWriteTutorialDone(win, tutorialKey);
      endFlow();
    } else if (mode === 'lesson') {
      endFlow();
    }
  }

  function skipAll() {
    if (mode !== 'onboarding') return;
    safeWriteTutorialDone(win, tutorialKey);
    endFlow();
  }

  function closeLesson() {
    if (mode !== 'lesson') return;
    endFlow();
  }

  function endFlow() {
    clearDemo();
    ctx.input.unlock(LOCK_OWNER);
    if (ctx.view) ctx.view.setFaceLabels(savedFaceLabels);
    if (mode === 'lesson') ctx.panel.selectTab(savedTab);
    hideLessonUI();
    mode = null;
    updateNotationHelpDisabled();
  }

  function startOnboarding() {
    mode = 'onboarding';
    stepIdx = 0;
    savedFaceLabels = ctx.view ? ctx.view.faceLabels() : false;
    if (ctx.view && forceFaceLabels) ctx.view.setFaceLabels(true);
    ctx.panel.expand(true);
    showLessonUI();
    renderStep();
    updateNotationHelpDisabled();
  }

  function openLesson() {
    if (mode !== null) return;
    mode = 'lesson';
    stepIdx = 0;
    savedFaceLabels = ctx.view ? ctx.view.faceLabels() : false;
    savedTab = ctx.panel.currentTab();
    if (ctx.view && forceFaceLabels) ctx.view.setFaceLabels(true);
    ctx.panel.expand(true);
    showLessonUI();
    renderStep();
    updateNotationHelpDisabled();
  }

  function notationHelpDisabled() {
    if (mode !== null) return true;
    var st = ctx.getState();
    if (st.hint && st.hint.pending) return true;
    if (st.demo && st.demo.pending) return true;
    if (ctx.input.locked()) return true;
    if (ctx.anim && ctx.anim.busy()) return true;
    return false;
  }

  function updateNotationHelpDisabled() {
    var disabled = notationHelpDisabled();
    btnNotationHelp.disabled = disabled;
    btnNotationHelp.setAttribute('aria-disabled', String(disabled));
  }

  btnPrev.addEventListener('click', goPrev);
  btnNext.addEventListener('click', goNext);
  btnSkipAll.addEventListener('click', skipAll);
  btnClose.addEventListener('click', closeLesson);
  btnSkipSection.addEventListener('click', skipSection);
  btnReplay.addEventListener('click', replay);
  btnNotationHelp.addEventListener('click', function () {
    if (btnNotationHelp.disabled) return;
    openLesson();
  });

  ctx.subscribe(function () {
    updateNotationHelpDisabled();
  });
  updateNotationHelpDisabled();

  // ---- 首次教學觸發（§11.3：enabled 為 true 且旗標不存在時，頁面畫完後顯示） ----
  var tutorialEnabled = !!tutorialParams.enabled;
  var alreadyDone = safeReadTutorialDone(win, tutorialKey);
  if (tutorialEnabled && !alreadyDone) {
    startOnboarding();
  }
}

module.exports = {
  mount: mount
};
