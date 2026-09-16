// src/ui/cube-view.js — 方塊 3D 畫面（CSS 3D transforms；game-spec.md §9.2、§9.3、§11.2、§11.3）
//
// 依分派單 T-001 S8a 輸出契約：本檔 mount(ctx) 建立 ctx.view 與 ctx.anim（見 docs/reports/T-001-S8a.md
// 的「介面契約」一節）。所有規則（哪個記號轉哪一層、轉幾格）一律呼叫 engine，本檔只負責畫面。
//
// 座標換算（engine → CSS）：engine 座標 x 右、y 上、z 朝玩家（右手系）；CSS 3D 座標 x 右、y 下、
// z 朝玩家。兩者只差 y 的正負號，換算：cssPos = (x, -y, z)。旋轉矩陣換算見 buildRotationMatrix()
// 註解。
'use strict';

var FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'];

// 記號基本字母的旋轉軸（engine 座標；與 game-spec.md §1.2 方向慣例一致：
// M 同 L、E 同 D、S 同 F；x 同 R、y 同 U、z 同 F）。純屬畫面幾何用，不影響任何規則判定。
var AXIS = {
  U: [0, 1, 0], D: [0, -1, 0], L: [-1, 0, 0], R: [1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
  M: [-1, 0, 0], E: [0, -1, 0], S: [0, 0, 1],
  x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1]
};

function turnOf(move) {
  if (move.length === 1) return 'cw';
  if (move.charAt(1) === '2') return 'half';
  return 'ccw';
}

// ---------------------------------------------------------------------------
// 3x3 矩陣工具（純數學，僅供本檔畫面計算使用）
// ---------------------------------------------------------------------------

function matIdentity() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

function matMultiply(a, b) {
  var out = new Array(9);
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) {
      var sum = 0;
      for (var k = 0; k < 3; k++) sum += a[r * 3 + k] * b[k * 3 + c];
      out[r * 3 + c] = sum;
    }
  }
  return out;
}

function matVec(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}

// 繞單位軸 axis 旋轉 angleDeg 度（右手定則，標準 Rodrigues 公式）。axis 與角度皆為呼叫端座標系。
function axisAngleMatrix(axis, angleDeg) {
  var rad = (angleDeg * Math.PI) / 180;
  var c = Math.cos(rad);
  var s = Math.sin(rad);
  var t = 1 - c;
  var x = axis[0], y = axis[1], z = axis[2];
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c
  ];
}

// engine 座標旋轉矩陣 → CSS 座標旋轉矩陣：R_css[i][j] = signs[i][j] * R_engine[i][j]，
// signs 在「恰有一個索引為 y（=1）」時為 -1，其餘為 +1（見檔頭註解的 y 反射推導）。
var CSS_SIGN = [1, -1, 1, -1, 1, -1, 1, -1, 1];
function engineMatToCss(m) {
  var out = new Array(9);
  for (var i = 0; i < 9; i++) out[i] = m[i] * CSS_SIGN[i];
  return out;
}

function rotationMatrixCss(base, turn) {
  var axisEngine = AXIS[base];
  var engineAngle = turn === 'half' ? 180 : (turn === 'cw' ? -90 : 90);
  var mEngine = axisAngleMatrix(axisEngine, engineAngle);
  return engineMatToCss(mEngine);
}

function matToMatrix3d(m) {
  // matrix3d 依欄（column-major）列出 4x4；旋轉矩陣的平移分量皆為 0。
  return 'matrix3d(' +
    m[0] + ',' + m[3] + ',' + m[6] + ',0,' +
    m[1] + ',' + m[4] + ',' + m[7] + ',0,' +
    m[2] + ',' + m[5] + ',' + m[8] + ',0,' +
    '0,0,0,1)';
}

function matTrace(m) {
  return m[0] + m[4] + m[8];
}

function matTranspose(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

// ---------------------------------------------------------------------------
// 朝向與相機矩陣（純數學，不碰 DOM；S11／B-2 起抽成模組層函式，供 Node 測試直接驗證）
// ---------------------------------------------------------------------------

// CAMERA_ROT[orient]：與 engine 的 24 種朝向一一對應的 CSS 旋轉矩陣 Q(o)，意義是
// 「朝向 o 的畫面（view 座標貼紙畫在單位矩陣位置）」等於「home 方塊整顆套用 Q(o)」。
// 以 engine.orientAfter 做同構 BFS：Q(orientAfter(o, rot)) = R_css(rot) · Q(o)。
function buildCameraRot(engine) {
  var table = new Array(engine.ORIENT_COUNT);
  var visited = new Array(engine.ORIENT_COUNT).fill(false);
  table[0] = matIdentity();
  visited[0] = true;
  var queue = [0];
  var gens = ['x', 'y', 'z'];
  while (queue.length) {
    var o = queue.shift();
    for (var g = 0; g < gens.length; g++) {
      var rot = gens[g];
      var next = engine.orientAfter(o, rot);
      if (!visited[next]) {
        visited[next] = true;
        table[next] = matMultiply(rotationMatrixCss(rot, 'cw'), table[o]);
        queue.push(next);
      }
    }
  }
  return table;
}

// 與 matrix 夾角最小的朝向（trace(Q(o)ᵀ · matrix) 越大代表夾角越小，標準旋轉距離度量）。
function nearestOrientIn(table, matrix) {
  var best = 0;
  var bestScore = -Infinity;
  for (var o = 0; o < table.length; o++) {
    var score = matTrace(matMultiply(matTranspose(table[o]), matrix));
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

// S11／B-2：拖曳矩陣 D 是「疊加在目前畫面（朝向 fromOrient）之上」的暫時旋轉，
// 畫面上看到的是 D · Q(fromOrient) · home，所以放開後的目標朝向要用兩者合成後再找最近的。
function nearestOrientFromIn(table, fromOrient, dragMatrix) {
  return nearestOrientIn(table, matMultiply(dragMatrix, table[fromOrient]));
}

// S11／B-2：吸附動畫的終點（相對矩陣）。畫面仍用 fromOrient 的顏色畫在單位矩陣位置，
// 套上 Q(to) · Q(from)ᵀ 之後就等於「朝向 to 的畫面」，動畫結束送 SET_ORIENT 後
// render() 把 transform 歸零、改用 to 的顏色，前後畫面一致、不會跳動。
function relativeSnapMatrix(table, fromOrient, toOrient) {
  return matMultiply(table[toOrient], matTranspose(table[fromOrient]));
}

// ---------------------------------------------------------------------------
// mount
// ---------------------------------------------------------------------------

function mount(ctx) {
  var doc = ctx.root.ownerDocument || document;
  var engine = ctx.engine;
  var data = ctx.data || {};
  var params = data.params || {};
  var palette = data.palette || { stickers: [] };
  var baseDeg = (params.ui && params.ui.baseViewDeg) || { x: -22, y: -34 };

  var stage = ctx.root.querySelector('[data-cube-stage]');
  if (!stage) throw new Error('cube-view: 找不到 [data-cube-stage] 容器');
  stage.innerHTML = '';

  var cube3d = doc.createElement('div');
  cube3d.className = 'cube3d';
  cube3d.style.transform = 'rotateX(' + baseDeg.x + 'deg) rotateY(' + baseDeg.y + 'deg)';
  stage.appendChild(cube3d);

  var cubeWorld = doc.createElement('div');
  cubeWorld.className = 'cube-world';
  cube3d.appendChild(cubeWorld);

  // ---- 幾何建構：54 張貼紙 → 26 個小方塊（cubie）div，各自最多 3 張 face div ----
  var faceEls = new Array(54);
  var cubieByKey = {}; // "x,y,z"（CSS 座標）→ cubie div

  function cssPosOf(i) {
    var p = engine.STICKER_POS[i];
    return [p[0], -p[1], p[2]];
  }

  for (var i = 0; i < 54; i++) {
    var pos = cssPosOf(i);
    var key = pos.join(',');
    var cubie = cubieByKey[key];
    if (!cubie) {
      cubie = doc.createElement('div');
      cubie.className = 'cubie';
      cubie.style.setProperty('--gx', pos[0]);
      cubie.style.setProperty('--gy', pos[1]);
      cubie.style.setProperty('--gz', pos[2]);
      cubeWorld.appendChild(cubie);
      cubieByKey[key] = cubie;
    }
    var letter = FACE_LIST[Math.floor(i / 9)];
    var face = doc.createElement('div');
    face.className = 'face f-' + letter;
    face.dataset.sticker = String(i);
    var label = doc.createElement('span');
    label.className = 'face-label';
    label.hidden = true;
    face.appendChild(label);
    cubie.appendChild(face);
    faceEls[i] = face;
  }

  var CENTER_LETTER = { 4: 'U', 13: 'R', 22: 'F', 31: 'D', 40: 'L', 49: 'B' };
  var CENTER_CN = (data.texts && data.texts.notation && data.texts.notation.faceName) || {};
  Object.keys(CENTER_LETTER).forEach(function (idxStr) {
    var idx = Number(idxStr);
    var letter = CENTER_LETTER[idx];
    var label = faceEls[idx].querySelector('.face-label');
    label.innerHTML = '<b>' + letter + '</b><i>' + (CENTER_CN[letter] || '') + '</i>';
  });

  // ---- 上色 ----
  function paletteHex(colorId) {
    var s = palette.stickers[colorId];
    return s ? s.hex : '#888';
  }
  function paletteInk(colorId) {
    var s = palette.stickers[colorId];
    return s && s.labelInk ? s.labelInk : '#000';
  }

  function paint(stickers) {
    for (var idx = 0; idx < 54; idx++) {
      var colorId = stickers[idx];
      faceEls[idx].style.background = paletteHex(colorId);
      if (CENTER_LETTER[idx]) {
        faceEls[idx].querySelector('.face-label').style.color = paletteInk(colorId);
      }
    }
  }

  // ---- 面標籤開關（§11.2） ----
  var faceLabelsOn = !!(params.faceLabels && params.faceLabels.defaultOn);
  // D-19：面標籤變更通知（供 controls.js／tutorial.js 同步 #faceLabelToggle 的
  // aria-checked，取代 tutorial.js 原本直接改該按鈕屬性的繞道，見
  // docs/reports/T-001-S8d.md「未預期發現」第 2 點）。
  var faceLabelListeners = [];
  function applyFaceLabelVisibility() {
    Object.keys(CENTER_LETTER).forEach(function (idxStr) {
      faceEls[Number(idxStr)].querySelector('.face-label').hidden = !faceLabelsOn;
    });
  }
  applyFaceLabelVisibility();

  // ---- 高亮（提示層、示範層、教學層；§9.1、§9.2、§11.3） ----
  var highlighted = [];
  function applyHighlight(indices) {
    highlighted.forEach(function (idx) { faceEls[idx].classList.remove('is-hi'); });
    highlighted = (indices || []).slice();
    highlighted.forEach(function (idx) { faceEls[idx].classList.add('is-hi'); });
  }

  // ---- 暫留動畫（turn/rotate 結束後，等下一次 render() 才收尾，避免顏色與轉場出現閃爍） ----
  var pendingLayerWrapper = null; // {wrapper, cubies:[{el,parent}]}

  function teardownPendingLayer() {
    if (!pendingLayerWrapper) return;
    var w = pendingLayerWrapper;
    pendingLayerWrapper = null;
    w.cubies.forEach(function (rec) {
      rec.el.style.transform = '';
      cubeWorld.appendChild(rec.el);
    });
    if (w.wrapper.parentNode) w.wrapper.parentNode.removeChild(w.wrapper);
  }

  // ---- 預覽（previewTurn／clearPreview；§11.3，供記號小教室與打亂動畫使用；不碰 state） ----
  var previewActive = false;
  var previewStickers = null;

  function currentPaintSource() {
    if (previewActive && previewStickers) return previewStickers;
    return engine.viewStickers(ctx.getState());
  }

  var dragging = false;

  function render() {
    teardownPendingLayer();
    if (!dragging) cubeWorld.style.transform = '';
    paint(currentPaintSource());
  }

  ctx.subscribe(render);
  render();

  // ---- 動畫：turn（局部層轉動）、rotate（整顆旋轉）；ctx.anim 供 S8b 手勢、S8c 示範、S8a 記號鍵共用 ----
  var busyCount = 0;

  function withBusy(promise) {
    busyCount++;
    return promise.then(
      function (v) { busyCount--; return v; },
      function (e) { busyCount--; throw e; }
    );
  }

  function animateGroup(cubieEls, cssMatrix, ms) {
    teardownPendingLayer();
    var wrapper = doc.createElement('div');
    wrapper.className = 'turn-wrapper';
    cubeWorld.appendChild(wrapper);
    var recs = cubieEls.map(function (el) {
      var parent = el.parentNode;
      wrapper.appendChild(el);
      return { el: el, parent: parent };
    });
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
    // 強制 reflow，確保下一行的 transition 生效
    // eslint-disable-next-line no-unused-expressions
    wrapper.offsetHeight;
    wrapper.style.transition = 'transform ' + ms + 'ms linear';
    wrapper.style.transform = cssMatrix;
    pendingLayerWrapper = { wrapper: wrapper, cubies: recs };
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function turn(viewMove, ms) {
    var indices = engine.layerStickers(viewMove);
    var cubieEls = [];
    indices.forEach(function (idx) {
      var el = faceEls[idx].parentNode;
      if (cubieEls.indexOf(el) === -1) cubieEls.push(el);
    });
    var base = viewMove.charAt(0);
    var m = rotationMatrixCss(base, turnOf(viewMove));
    return withBusy(animateGroup(cubieEls, matToMatrix3d(m), ms));
  }

  function rotateWholeCube(rotation, ms) {
    var base = rotation.charAt(0);
    var m = rotationMatrixCss(base, turnOf(rotation));
    teardownPendingLayer();
    cubeWorld.style.transition = 'none';
    cubeWorld.style.transform = '';
    // eslint-disable-next-line no-unused-expressions
    cubeWorld.offsetHeight;
    cubeWorld.style.transition = 'transform ' + ms + 'ms linear';
    cubeWorld.style.transform = matToMatrix3d(m);
    return withBusy(new Promise(function (resolve) { setTimeout(resolve, ms); }));
  }

  function previewTurn(baseStickers, viewMove, ms) {
    previewActive = true;
    previewStickers = baseStickers.slice();
    paint(previewStickers);
    return turn(viewMove, ms).then(function () {
      previewStickers = engine.applyMove(baseStickers, viewMove);
      teardownPendingLayer();
      cubeWorld.style.transform = '';
      paint(previewStickers);
    });
  }

  function clearPreview() {
    previewActive = false;
    previewStickers = null;
    render();
  }

  ctx.anim = {
    turn: turn,
    rotate: rotateWholeCube,
    busy: function () { return busyCount > 0; }
  };

  // ---- 拖曳轉視角與吸附（§9.3；提供給 S8b gesture.js 使用） ----
  // CAMERA_ROT 的意義與建法見模組層 buildCameraRot()。
  var CAMERA_ROT = buildCameraRot(engine);

  function setDragRotation(matrix) {
    dragging = true;
    cubeWorld.style.transition = 'none';
    cubeWorld.style.transform = matToMatrix3d(matrix);
  }

  function clearDrag() {
    dragging = false;
    cubeWorld.style.transition = '';
    cubeWorld.style.transform = '';
    render();
  }

  // 注意：nearestOrient／snapTo 把矩陣當成「相對朝向 0」的絕對旋轉，只在目前朝向為 0
  // 時才正確（架構審查 B-2）；轉視角請改用 nearestOrientFrom／snapFrom。保留舊介面是為了
  // 相容 S8a 契約。
  function nearestOrient(matrix) {
    return nearestOrientIn(CAMERA_ROT, matrix);
  }

  function nearestOrientFrom(fromOrient, dragMatrix) {
    return nearestOrientFromIn(CAMERA_ROT, fromOrient, dragMatrix);
  }

  function animateWorldTo(targetMatrix, ms) {
    dragging = true;
    cubeWorld.style.transition = 'none';
    // 若目前沒有暫留任何 transform，視為單位矩陣起點。
    var current = cubeWorld.style.transform || 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
    cubeWorld.style.transform = current;
    // eslint-disable-next-line no-unused-expressions
    cubeWorld.offsetHeight;
    cubeWorld.style.transition = 'transform ' + ms + 'ms ease-out';
    cubeWorld.style.transform = matToMatrix3d(targetMatrix);
    return withBusy(new Promise(function (resolve) {
      setTimeout(function () {
        dragging = false;
        resolve();
      }, ms);
    }));
  }

  function snapTo(orient, ms) {
    return animateWorldTo(CAMERA_ROT[orient], ms);
  }

  // S11／B-2：從目前朝向 fromOrient 的畫面，吸附到 toOrient（toOrient === fromOrient 時就是彈回原樣）。
  function snapFrom(fromOrient, toOrient, ms) {
    return animateWorldTo(relativeSnapMatrix(CAMERA_ROT, fromOrient, toOrient), ms);
  }

  // ---- projectAxes（§9.2 第 2 點；供 S8b 手勢方向判定使用） ----
  var ROT_X_BASE = axisAngleMatrix([1, 0, 0], baseDeg.x);
  var ROT_Y_BASE = axisAngleMatrix([0, 1, 0], baseDeg.y);
  var BASE_TILT_CSS = matMultiply(ROT_X_BASE, ROT_Y_BASE); // transform="rotateX(bx) rotateY(by)" 的合成矩陣

  function toScreen(vEngine) {
    var vCss = [vEngine[0], -vEngine[1], vEngine[2]];
    var r = matVec(BASE_TILT_CSS, vCss);
    return { x: r[0], y: r[1] };
  }

  function projectAxes(viewIndex) {
    var letter = FACE_LIST[Math.floor(viewIndex / 9)];
    var axes = engine.FACE_AXES[letter];
    return { right: toScreen(axes.right), down: toScreen(axes.down) };
  }

  ctx.view = {
    projectAxes: projectAxes,
    setDragRotation: setDragRotation,
    clearDrag: clearDrag,
    nearestOrient: nearestOrient,
    snapTo: snapTo,
    nearestOrientFrom: nearestOrientFrom, // S11／B-2
    snapFrom: snapFrom, // S11／B-2
    highlight: applyHighlight,
    setFaceLabels: function (on) {
      faceLabelsOn = !!on;
      applyFaceLabelVisibility();
      faceLabelListeners.forEach(function (fn) { fn(faceLabelsOn); });
    },
    faceLabels: function () { return faceLabelsOn; },
    onFaceLabelsChange: function (fn) { faceLabelListeners.push(fn); },
    previewTurn: previewTurn,
    clearPreview: clearPreview,
    // 額外提供的畫面工具（非規格必要契約，供 S8b/S8c/S8d 需要時取用；見 docs/reports/T-001-S8a.md）：
    multiplyMatrix: matMultiply,
    axisAngleMatrix: axisAngleMatrix
  };
}

module.exports = {
  mount: mount,
  // 純數學（不碰 DOM），供 Node 測試驗證朝向與吸附幾何（S11／B-2）
  geometry: {
    buildCameraRot: buildCameraRot,
    nearestOrientIn: nearestOrientIn,
    nearestOrientFromIn: nearestOrientFromIn,
    relativeSnapMatrix: relativeSnapMatrix,
    rotationMatrixCss: rotationMatrixCss,
    engineMatToCss: engineMatToCss,
    axisAngleMatrix: axisAngleMatrix,
    matMultiply: matMultiply,
    matTranspose: matTranspose
  }
};
