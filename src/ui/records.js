// src/ui/records.js — 完成畫面與本機最佳紀錄（game-spec.md §6.3、§6.4）
//
// 依分派單 T-001 S8d：本檔只呈現 state、讀寫 localStorage；不計算規則（是否過關、
// 步數、assist 種類一律取 engine 的 state.result／selectors.recordEligible）。
// 所有儲存存取一律包 try/catch（含「存取 window.localStorage 本身」就可能拋例外的情況，
// 例如某些瀏覽器隱私模式；不可用時不顯示紀錄、不報錯，遊戲照常，見 §6.4）。
'use strict';

function nowFormatTime(ms) {
  // 與 controls.js 的 formatTime 邏輯一致（各檔各自一份，避免互相 require，沿用 S8a 慣例）。
  var totalDeci = Math.floor(Math.max(0, ms) / 100);
  var m = Math.floor(totalDeci / 600);
  var s = Math.floor((totalDeci % 600) / 10);
  var d = totalDeci % 10;
  return m + ':' + (s < 10 ? '0' + s : String(s)) + '.' + d;
}

/**
 * 安全取得 localStorage（可能整個存取就拋例外，例如部分瀏覽器隱私模式）。
 * @returns {Storage|null}
 */
function safeGetStorage(win) {
  try {
    if (!win || !win.localStorage) return null;
    // 部分瀏覽器要「用一次」才會真的拋例外（單純讀屬性不會）。
    var probeKey = '__cube3x3_probe__';
    win.localStorage.setItem(probeKey, '1');
    win.localStorage.removeItem(probeKey);
    return win.localStorage;
  } catch (e) {
    return null;
  }
}

function safeReadJson(storage, key) {
  try {
    var raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function safeWriteJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 讀到的紀錄格式是否合法（§6.4：v 不是 1 或欄位缺漏 → 當作沒有紀錄）。
 */
function isValidRecords(v) {
  return !!(
    v && v.v === 1 &&
    typeof v.solves === 'number' &&
    v.bestTime && typeof v.bestTime.ms === 'number' && typeof v.bestTime.qtm === 'number' &&
    v.bestMoves && typeof v.bestMoves.qtm === 'number' && typeof v.bestMoves.ms === 'number'
  );
}

function mount(ctx) {
  var texts = ctx.data.texts;
  var resultTexts = texts.result || {};
  var buttons = texts.buttons || {};
  var params = ctx.data.params || {};
  var storageParams = params.storage || {};
  var recordsKey = storageParams.recordsKey || 'cube3x3.records.v1';

  var win = (typeof window !== 'undefined') ? window : null;
  var storage = safeGetStorage(win);

  function readRecords() {
    if (!storage) return null;
    var v = safeReadJson(storage, recordsKey);
    return isValidRecords(v) ? v : null;
  }

  /**
   * 依 §6.4 規則更新紀錄；回傳是否為「新紀錄」（時間或步數任一項優於先前）。
   * 先前沒有合法紀錄（第一次完成、或格式不符）視為新紀錄。
   */
  function writeRecord(result) {
    var prev = readRecords();
    var isNew = !prev || result.timeMs < prev.bestTime.ms || result.qtm < prev.bestMoves.qtm;
    var next = prev || { v: 1, solves: 0, bestTime: null, bestMoves: null };
    next.v = 1;
    next.solves = (next.solves || 0) + 1;
    if (!next.bestTime || result.timeMs < next.bestTime.ms) {
      next.bestTime = { ms: result.timeMs, qtm: result.qtm };
    }
    if (!next.bestMoves || result.qtm < next.bestMoves.qtm) {
      next.bestMoves = { qtm: result.qtm, ms: result.timeMs };
    }
    if (storage) safeWriteJson(storage, recordsKey, next);
    return isNew;
  }

  // ---- 完成畫面 DOM（overlay 插槽；一次建立，之後只更新內容，§11.4） ----
  var overlaySlot = ctx.slot('overlay');
  var mask = document.createElement('div');
  mask.className = 'overlay-mask';
  mask.hidden = true;

  var card = document.createElement('div');
  card.className = 'overlay-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  var headline = document.createElement('p');
  headline.className = 'result-headline';

  var summary = document.createElement('p');
  summary.className = 'result-summary';

  var badgeRow = document.createElement('div');
  badgeRow.className = 'result-badges';

  var badgeAssist = document.createElement('span');
  badgeAssist.className = 'badge';
  badgeAssist.hidden = true;

  var badgeNew = document.createElement('span');
  badgeNew.className = 'badge badge-new';
  badgeNew.hidden = true;
  badgeNew.textContent = resultTexts.newRecord || '';

  badgeRow.appendChild(badgeAssist);
  badgeRow.appendChild(badgeNew);

  var note = document.createElement('p');
  note.className = 'result-note';
  note.hidden = true;

  // MJ-2（D-24）：完成畫面顯示本機最佳紀錄；儲存不可用或沒有合法紀錄時整行不顯示。
  var bestLine = document.createElement('p');
  bestLine.className = 'result-best';
  bestLine.hidden = true;

  var actions = document.createElement('div');
  actions.className = 'result-actions';
  var btnNewGame = document.createElement('button');
  btnNewGame.type = 'button';
  btnNewGame.className = 'ctl accent';
  btnNewGame.textContent = buttons.newGame || '';
  btnNewGame.addEventListener('click', function () {
    if (typeof ctx.newGame === 'function') ctx.newGame();
  });
  // m-6：「看看方塊」關閉遮罩，讓玩家查看復原後的方塊、按重設或整顆轉（§3.6）。
  // 關掉之後本局不再自動彈出，直到下一次離開 solved（NEW_GAME／RESET）。
  var btnViewCube = document.createElement('button');
  btnViewCube.type = 'button';
  btnViewCube.className = 'ctl result-view-cube';
  btnViewCube.textContent = buttons.viewCube || '';
  btnViewCube.addEventListener('click', function () {
    dismissedThisResult = true;
    hideResult();
  });
  actions.appendChild(btnViewCube);
  actions.appendChild(btnNewGame);

  card.appendChild(headline);
  card.appendChild(summary);
  card.appendChild(badgeRow);
  card.appendChild(note);
  card.appendChild(bestLine);
  card.appendChild(actions);
  mask.appendChild(card);
  overlaySlot.appendChild(mask);

  // ---- D-17：示範中（state.demo 非 null）方塊復原時的完成畫面 ----
  // 全螢幕 .overlay-mask 蓋住 #app 全部內容，含學習面板內的示範播放器（上一步／下一步／
  // 離開示範），違反 §9.1「結尾…仍可前後單步回看」。示範進行中改在方塊區（.cube-scene；
  // 介面契約見 docs/reports/T-001-S8a.md）上緣掛一張不遮擋操作的小卡片（比照 .hint-slot
  // 的作法：外層 pointer-events:none，卡片本身 pointer-events:auto），只顯示摘要文字，
  // 不重複「離開示範」等已存在於示範播放器的操作。
  // 離開示範（DEMO_EXIT）後不再補彈出全螢幕遮罩：玩家已經在示範中看過這張摘要卡，
  // 離開當下再跳出遮罩會是不在預期內的「重複彈出」，見 arch-decisions D-17。
  var cubeSceneEl = ctx.root.querySelector('.cube-scene');
  var demoCard = document.createElement('div');
  demoCard.className = 'demo-result-slot';
  demoCard.hidden = true;
  var demoCardInner = document.createElement('div');
  demoCardInner.className = 'demo-result-card';
  var demoHeadline = document.createElement('div');
  demoHeadline.className = 'demo-result-headline';
  var demoSummary = document.createElement('div');
  demoSummary.className = 'demo-result-summary';
  demoCardInner.appendChild(demoHeadline);
  demoCardInner.appendChild(demoSummary);
  demoCard.appendChild(demoCardInner);
  if (cubeSceneEl) cubeSceneEl.appendChild(demoCard);

  function showDemoResult(result) {
    if (!cubeSceneEl) return;
    demoHeadline.textContent = (resultTexts.solved || '') +
      (result.assist === 'demo' ? '（' + (resultTexts.badgeDemo || '') + '）' : '');
    demoSummary.textContent = ctx.notation.fillTemplate(resultTexts.summary || '', {
      time: nowFormatTime(result.timeMs),
      qtm: result.qtm
    });
    demoCard.hidden = false;
  }

  function hideDemoResult() {
    demoCard.hidden = true;
  }

  function renderBestLine() {
    var rec = readRecords(); // 儲存不可用時為 null
    if (!rec) {
      bestLine.hidden = true;
      bestLine.textContent = '';
      return;
    }
    bestLine.textContent = ctx.notation.fillTemplate(resultTexts.best || '', {
      label: (texts.hud && texts.hud.best) || '',
      time: nowFormatTime(rec.bestTime.ms),
      qtm: rec.bestMoves.qtm
    });
    bestLine.hidden = false;
  }

  function showResult(result, isNewRecord) {
    if (dismissedThisResult) return;
    if (result.assist === 'none') {
      headline.textContent = resultTexts.solved || '';
      badgeAssist.hidden = true;
      note.hidden = true;
      badgeNew.hidden = !isNewRecord;
    } else {
      headline.textContent = resultTexts.solved || '';
      badgeAssist.hidden = false;
      badgeAssist.classList.toggle('badge-demo', result.assist === 'demo');
      badgeAssist.textContent = result.assist === 'demo' ? (resultTexts.badgeDemo || '') : (resultTexts.badgeHint || '');
      badgeNew.hidden = true; // 用過提示／看過示範不列入紀錄，不會有新紀錄（§6.3）
      if (result.assist === 'demo') {
        note.hidden = false;
        note.textContent = resultTexts.demoNote || '';
      } else {
        note.hidden = true;
      }
    }
    var summaryText = ctx.notation.fillTemplate(resultTexts.summary || '', {
      time: nowFormatTime(result.timeMs),
      qtm: result.qtm
    });
    summary.textContent = summaryText;
    renderBestLine();
    mask.hidden = false;
  }

  function hideResult() {
    mask.hidden = true;
  }

  // ---- 訂閱 state：status → 'solved' 時顯示完成畫面；recordEligible 由 false 變 true 時寫入紀錄 ----
  // lastIsNewRecordForThisResult：同一局完成畫面可能因為其他事件（例如切分頁背景送 PAUSE）
  // 觸發多次 render，「是否新紀錄」只在剛完成那一刻算一次，之後重繪要沿用同一個值，
  // 不能每次都重算（新紀錄的判斷需要「寫入前」的舊紀錄，寫入後已經覆蓋，無法重算）。
  var prevStatus = ctx.getState().status;
  var prevEligible = ctx.engine.recordEligible(ctx.getState());
  var lastIsNewRecordForThisResult = false;
  // D-17：本局完成畫面若曾經在示範進行中顯示過（用不遮擋的卡片），離開示範後就不再
  // 補顯示全螢幕遮罩（避免「重複彈出」）。每次 NEW_GAME／RESET 離開 solved 狀態時重置。
  var resultShownDuringDemo = false;
  // m-6：本局完成畫面已被「看看方塊」關掉（離開 solved 時重置）。
  var dismissedThisResult = false;

  ctx.subscribe(function (state) {
    var eligible = ctx.engine.recordEligible(state);
    var justBecameEligible = eligible && !prevEligible;
    if (justBecameEligible && state.result) {
      lastIsNewRecordForThisResult = writeRecord(state.result);
    }
    var solved = state.status === 'solved' && !!state.result;
    var demoActive = state.demo !== null;
    if (solved && demoActive) {
      hideResult();
      resultShownDuringDemo = true;
      showDemoResult(state.result);
    } else if (solved && resultShownDuringDemo) {
      // 已在示範中看過摘要卡，離開示範後不再彈出全螢幕遮罩（D-17）。
      hideDemoResult();
    } else if (solved) {
      hideDemoResult();
      showResult(state.result, lastIsNewRecordForThisResult);
    } else {
      hideResult();
      hideDemoResult();
      if (prevStatus === 'solved') lastIsNewRecordForThisResult = false;
      resultShownDuringDemo = false;
      dismissedThisResult = false;
    }
    prevStatus = state.status;
    prevEligible = eligible;
  });

  if (prevStatus === 'solved' && ctx.getState().result) {
    if (ctx.getState().demo !== null) {
      resultShownDuringDemo = true;
      showDemoResult(ctx.getState().result);
    } else {
      showResult(ctx.getState().result, false);
    }
  }
}

module.exports = {
  mount: mount
};
