// src/ui/gesture.js — 觸控手勢與轉視角（game-spec.md §9.2、§9.3；分派單 T-001 S8b）
//
// 依 S8a 的介面契約（docs/reports/T-001-S8a.md）：本檔只透過 ctx 接入，不修改
// app.js、index.template.html 與其他 src/ui/ 檔；轉層一律呼叫 engine.gestureToMove，
// 方向判定使用 ctx.view.projectAxes；視角拖曳與吸附一律呼叫 ctx.view.setDragRotation／
// clearDrag／nearestOrientFrom／snapFrom／multiplyMatrix／axisAngleMatrix，不自己重算 3D 幾何。
// S11／B-2：吸附改用 nearestOrientFrom／snapFrom（計入拖曳開始時的朝向）；舊的
// nearestOrient／snapTo 只在朝向 0 時正確，本檔不再使用。
// S11／D-26：轉層的送出改走 ctx.input 的輸入佇列（與記號鍵同一機制）；但「開始」一個手勢
// 仍要求畫面靜止（ctx.input.idle()）：手指按下時要依畫面判斷碰到哪一張貼紙，動畫中的
// 小方塊位置正在變動，若允許排隊會轉錯層，所以動畫中的手勢照舊不接受。
//
// 手勢範圍：cube-view.js 建立的 `.cube-scene`（包住 `[data-cube-stage]`；D-18 之後
// `.hint-slot` 已是它的手足元素、不在裡面，見 S8a 介面契約）。styles.css 在 `.cube-scene`
// 設定 touch-action: none（§9.2 最後一點）；本檔只讀取這個既有 class 來掛事件監聽器，
// 不修改其 DOM 結構或內容。
'use strict';

// ---------------------------------------------------------------------------
// 小工具（僅供本檔使用的 2D 向量與時間函式；矩陣運算一律透過 ctx.view，不重算 3D 幾何）
// ---------------------------------------------------------------------------

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

// D-25：數值參數只在「鍵缺少（不是數字）」時才套用預設值；0 是有效值。
function numOr(v, dflt) {
  return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function vecLen(x, y) {
  return Math.sqrt(x * x + y * y);
}

function vecNorm(x, y) {
  var len = vecLen(x, y);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

function vecNeg(v) {
  return { x: -v.x, y: -v.y };
}

function vecDot(a, b) {
  return a.x * b.x + a.y * b.y;
}

var IDENTITY_MATRIX = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// engine 座標的面右／下方向（3D）取負：用來組出「反方向」候選（gestureToMove 的 dir3）。
function neg3(v) {
  return [-v[0], -v[1], -v[2]];
}

// ---------------------------------------------------------------------------
// mount
// ---------------------------------------------------------------------------

function mount(ctx) {
  var doc = ctx.root.ownerDocument || document;
  var engine = ctx.engine;
  var view = ctx.view;
  var anim = ctx.anim;
  var input = ctx.input;
  var data = ctx.data || {};
  var params = data.params || {};
  var gp = params.gesture || {};
  var LOCK_PX = typeof gp.lockPx === 'number' ? gp.lockPx : 10;
  var COMMIT_PX = typeof gp.commitPx === 'number' ? gp.commitPx : 30;
  var MAX_AXIS_ANGLE_DEG = typeof gp.maxAxisAngleDeg === 'number' ? gp.maxAxisAngleDeg : 30;
  var CAMERA_DEG_PER_PX = typeof gp.cameraDegPerPx === 'number' ? gp.cameraDegPerPx : 0.5;
  var PITCH_LIMIT_DEG = typeof gp.pitchLimitDeg === 'number' ? gp.pitchLimitDeg : 80;
  // D-25：只在鍵缺少時套用預設值（0 為有效值，代表關閉動畫）。
  var TURN_ANIM_MS = numOr(params.ui && params.ui.turnAnimMs, 180);
  var SNAP_ANIM_MS = numOr(params.ui && params.ui.snapAnimMs, 200);
  var VIEW_HOLD = 'view-drag';
  var MAX_AXIS_COS = Math.cos((MAX_AXIS_ANGLE_DEG * Math.PI) / 180);

  var scene = ctx.root.querySelector('.cube-scene') || ctx.root.querySelector('[data-cube-stage]');
  if (!scene) return; // 找不到舞台就不掛手勢（不應發生；S8a 契約保證有這個容器）

  // ---- session：目前進行中的手勢（最多一組；第二指只影響已存在的 session） ----
  var session = null; // { mode:'turn'|'view', pointerId, ... }

  function faceLetterOf(viewIndex) {
    // 54 格貼紙依面序 U R F D L B 展開，每面 9 格（game-spec.md §1.1；cube.js 檔頭註解）。
    return ['U', 'R', 'F', 'D', 'L', 'B'][Math.floor(viewIndex / 9)];
  }

  function canGestureStart() {
    if (input.locked() || !input.idle()) return false;
    var state = ctx.getState();
    // D-12：等提示期間不送 ROTATE／SET_ORIENT，這裡索性連手勢都不接受（等待卡片本來就
    // 會蓋住方塊，這裡是防呆備援，避免 hint-view.js 尚未上鎖時的競態）。
    if (state.hint && state.hint.pending) return false;
    return true;
  }

  function releaseCapture(el, pointerId) {
    try {
      if (el.hasPointerCapture && el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    } catch (e) {
      // 部分測試環境（jsdom／無真實 Pointer Capture 實作）呼叫這兩個方法可能丟例外，忽略即可。
    }
  }

  function endSession() {
    if (!session) return;
    if (session.mode === 'turn') view.highlight([]);
    releaseCapture(scene, session.pointerId);
    session = null;
  }

  // 轉視角期間暫停輸入佇列（不清空），吸附完成後才放行，避免記號鍵的整顆轉動畫與拖曳互搶 transform。
  function releaseViewHold() {
    input.release(VIEW_HOLD);
  }

  // -------------------------------------------------------------------------
  // 轉層（§9.2）
  // -------------------------------------------------------------------------

  function startTurnSession(e, stickerEl) {
    var viewIndex = Number(stickerEl.dataset.sticker);
    session = {
      mode: 'turn',
      pointerId: e.pointerId,
      viewIndex: viewIndex,
      axes: view.projectAxes(viewIndex),
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      locked: false,
      axisVec: null, // 鎖定後的螢幕方向單位向量（含正負號）
      viewMove: null
    };
  }

  function lockTurnDirection() {
    var axes = session.axes;
    var candidates = [
      { vec: vecNorm(axes.right.x, axes.right.y), dir3: engine.FACE_AXES[faceLetterOf(session.viewIndex)].right },
      { vec: vecNeg(vecNorm(axes.right.x, axes.right.y)), dir3: neg3(engine.FACE_AXES[faceLetterOf(session.viewIndex)].right) },
      { vec: vecNorm(axes.down.x, axes.down.y), dir3: engine.FACE_AXES[faceLetterOf(session.viewIndex)].down },
      { vec: vecNeg(vecNorm(axes.down.x, axes.down.y)), dir3: neg3(engine.FACE_AXES[faceLetterOf(session.viewIndex)].down) }
    ];
    var dragVec = vecNorm(session.curX - session.startX, session.curY - session.startY);
    var best = null;
    var bestCos = -Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var c = vecDot(candidates[i].vec, dragVec);
      if (c > bestCos) {
        bestCos = c;
        best = candidates[i];
      }
    }
    if (!best || bestCos < MAX_AXIS_COS) {
      // §9.2 第 2 點：夾角超過門檻 → 本次手勢作廢（不轉、也不改成轉視角）。
      endSession();
      return;
    }
    var viewMove;
    try {
      viewMove = engine.gestureToMove(session.viewIndex, best.dir3);
    } catch (err) {
      endSession();
      return;
    }
    session.locked = true;
    session.axisVec = best.vec;
    session.viewMove = viewMove;
    view.highlight(engine.layerStickers(viewMove));
  }

  function commitTurnIfNeeded() {
    if (!session.locked) return;
    var dx = session.curX - session.startX;
    var dy = session.curY - session.startY;
    var proj = dx * session.axisVec.x + dy * session.axisVec.y;
    if (proj < COMMIT_PX) return; // 未達門檻：彈回（不轉、不送 action）
    var move = session.viewMove;
    input.enqueue({
      build: function () { return { type: 'TURN', payload: { move: move, at: nowMs() } }; },
      animate: function () { return anim.turn(move, TURN_ANIM_MS); }
    });
  }

  // -------------------------------------------------------------------------
  // 轉視角（§9.3）
  // -------------------------------------------------------------------------

  function startViewSession(e) {
    session = {
      mode: 'view',
      pointerId: e.pointerId,
      curX: e.clientX,
      curY: e.clientY,
      matrix: IDENTITY_MATRIX.slice(),
      accumPitch: 0,
      fromOrient: ctx.getState().orient // S11／B-2：拖曳矩陣疊加在這個朝向的畫面之上
    };
    input.hold(VIEW_HOLD);
    view.setDragRotation(session.matrix);
  }

  function updateViewDrag(e) {
    var dx = e.clientX - session.curX;
    var dy = e.clientY - session.curY;
    session.curX = e.clientX;
    session.curY = e.clientY;
    var yawDeg = dx * CAMERA_DEG_PER_PX;
    var rawPitch = dy * CAMERA_DEG_PER_PX;
    var nextAccum = clamp(session.accumPitch + rawPitch, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
    var pitchDeg = nextAccum - session.accumPitch;
    session.accumPitch = nextAccum;
    var yawM = view.axisAngleMatrix([0, 1, 0], yawDeg);
    var pitchM = view.axisAngleMatrix([1, 0, 0], pitchDeg);
    var incr = view.multiplyMatrix(pitchM, yawM);
    session.matrix = view.multiplyMatrix(incr, session.matrix);
    view.setDragRotation(session.matrix);
  }

  function finishViewSession() {
    var state = ctx.getState();
    var fromOrient = session.fromOrient;
    if (state.demo !== null || state.orient !== fromOrient) {
      // 示範中：拖曳只傾斜，放開彈回原朝向、不送 action（§9.3 最後一點、§4 補充）。
      // snapFrom(o, o) 的終點是單位矩陣＝「這次拖曳開始前的樣子」；結束後 clearDrag() 讓
      // transform 精確歸零。（拖曳期間朝向若被其他來源改掉，也同樣只彈回、不送 action。）
      view.snapFrom(fromOrient, fromOrient, SNAP_ANIM_MS).then(function () {
        view.clearDrag();
        releaseViewHold();
      });
      return;
    }
    // S11／B-2：目標朝向＝「拖曳矩陣 · 目前朝向」最接近的朝向；點一下（矩陣為單位）時就是原朝向。
    var targetOrient = view.nearestOrientFrom(fromOrient, session.matrix);
    view.snapFrom(fromOrient, targetOrient, SNAP_ANIM_MS).then(function () {
      var action = { type: 'SET_ORIENT', payload: { orient: targetOrient } };
      if (targetOrient !== fromOrient && engine.canApply(ctx.getState(), action, ctx.data)) {
        ctx.dispatch(action); // render() 會把 transform 歸零並改用新朝向的顏色
      } else {
        view.clearDrag();
      }
      releaseViewHold();
    });
  }

  // -------------------------------------------------------------------------
  // 第二指：轉層候選期間出現第二指 → 取消轉層、改為轉視角（§9.2 第 5 點）
  // -------------------------------------------------------------------------

  function handleSecondPointer(e) {
    if (!session) return;
    if (session.pointerId === e.pointerId) return; // 同一指，不是第二指
    if (session.mode !== 'turn') return; // 已經是轉視角，不需處理
    var lastX = session.curX;
    var lastY = session.curY;
    var originalPointerId = session.pointerId;
    view.highlight([]);
    session = {
      mode: 'view',
      pointerId: originalPointerId, // 繼續追蹤原本那一指（已 setPointerCapture）
      curX: lastX,
      curY: lastY,
      matrix: IDENTITY_MATRIX.slice(),
      accumPitch: 0,
      fromOrient: ctx.getState().orient // S11／B-2
    };
    input.hold(VIEW_HOLD);
    view.setDragRotation(session.matrix);
  }

  // -------------------------------------------------------------------------
  // 事件掛載
  // -------------------------------------------------------------------------

  function onScenePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (session) {
      handleSecondPointer(e);
      return;
    }
    if (!canGestureStart()) return;
    var stickerEl = e.target && e.target.closest ? e.target.closest('[data-sticker]') : null;
    if (e.cancelable) e.preventDefault();
    try {
      scene.setPointerCapture(e.pointerId);
    } catch (err) {
      // 忽略（部分測試環境無此 API）
    }
    if (stickerEl) {
      startTurnSession(e, stickerEl);
    } else {
      startViewSession(e);
    }
  }

  function onPointerMove(e) {
    if (!session || session.pointerId !== e.pointerId) return;
    if (session.mode === 'turn') {
      session.curX = e.clientX;
      session.curY = e.clientY;
      if (!session.locked) {
        var dist = vecLen(session.curX - session.startX, session.curY - session.startY);
        if (dist >= LOCK_PX) lockTurnDirection();
      }
    } else if (session.mode === 'view') {
      updateViewDrag(e);
    }
  }

  function onPointerUp(e) {
    if (!session || session.pointerId !== e.pointerId) return;
    if (session.mode === 'turn') {
      commitTurnIfNeeded();
    } else if (session.mode === 'view') {
      finishViewSession();
    }
    endSession();
  }

  function onPointerCancel(e) {
    if (!session || session.pointerId !== e.pointerId) return;
    if (session.mode === 'view') {
      view.clearDrag();
      releaseViewHold();
    }
    endSession();
  }

  // 文件層級：偵測「第二指落在舞台之外」的雙指情形（§9.2 第 5 點沒有限定第二指的落點）。
  function onDocPointerDown(e) {
    if (session && session.pointerId !== e.pointerId) handleSecondPointer(e);
  }

  scene.addEventListener('pointerdown', onScenePointerDown);
  scene.addEventListener('pointermove', onPointerMove);
  scene.addEventListener('pointerup', onPointerUp);
  scene.addEventListener('pointercancel', onPointerCancel);
  doc.addEventListener('pointerdown', onDocPointerDown);
}

module.exports = {
  mount: mount
};
