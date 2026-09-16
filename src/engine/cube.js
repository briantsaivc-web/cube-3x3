// src/engine/cube.js — 方塊模型：貼紙表示法、36 個記號、24 種朝向
//
// 依據：game-spec.md §1（名詞與記號）、§2.1（QTM 計步）、§2.4（白話說明）、
// §3.1–§3.3（狀態模型）、§9.2 第 3 點（手勢對應）。
//
// 設計原則（CLAUDE.md §3）：
//   - 純函數，不讀取時間、DOM、亂數或全域狀態；所有轉動的貼紙置換皆由 3D 幾何推導，
//     不手抄轉動表。
//   - 54 格貼紙以面序 U R F D L B（0–5）展開，每面 9 格由左上到右下逐列編號
//     （索引 = 9 × 面序 + (列 × 3 + 欄)）。
//   - 座標軸：x 向右（R 方向）、y 向上（U 方向）、z 向前（F 方向）。
'use strict';

// ---------------------------------------------------------------------------
// 1. 向量工具（僅供本檔內部使用）
// ---------------------------------------------------------------------------

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function vecEq(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function negate(a) {
  return [-a[0], -a[1], -a[2]];
}

// 繞單位軸 axis 把向量 v 旋轉 −90°（從軸尖端往回看為順時針），
// 用來從「轉動前」推導「轉動後」的貼紙位置與法向量。
function rotateCw(v, axis) {
  var c = cross(axis, v);
  var d = dot(axis, v);
  return [
    -c[0] + axis[0] * d,
    -c[1] + axis[1] * d,
    -c[2] + axis[2] * d
  ];
}

// ---------------------------------------------------------------------------
// 2. 六個面的法向量與展開圖幾何（game-spec.md §1.1）
// ---------------------------------------------------------------------------

var FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'];

var NORMAL = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1]
};

// 每面展開圖的左上角座標、向右方向、向下方向（§1.1 表格）。
var FACE_GEOM = {
  U: { topLeft: [-1, 1, -1], right: [1, 0, 0], down: [0, 0, 1] },
  R: { topLeft: [1, 1, 1], right: [0, 0, -1], down: [0, -1, 0] },
  F: { topLeft: [-1, 1, 1], right: [1, 0, 0], down: [0, -1, 0] },
  D: { topLeft: [-1, -1, 1], right: [1, 0, 0], down: [0, 0, -1] },
  L: { topLeft: [-1, 1, -1], right: [0, 0, 1], down: [0, -1, 0] },
  B: { topLeft: [1, 1, -1], right: [-1, 0, 0], down: [0, -1, 0] }
};

// 供 UI（手勢判定）使用：每面的「右」「下」方向向量。
var FACE_AXES = {};
FACE_LIST.forEach(function (face) {
  FACE_AXES[face] = { right: FACE_GEOM[face].right, down: FACE_GEOM[face].down };
});

// ---------------------------------------------------------------------------
// 3. 54 格貼紙的位置與法向量
// ---------------------------------------------------------------------------

var STICKER_POS = [];
var STICKER_NRM = [];
FACE_LIST.forEach(function (face) {
  var g = FACE_GEOM[face];
  for (var row = 0; row < 3; row++) {
    for (var col = 0; col < 3; col++) {
      STICKER_POS.push([
        g.topLeft[0] + col * g.right[0] + row * g.down[0],
        g.topLeft[1] + col * g.right[1] + row * g.down[1],
        g.topLeft[2] + col * g.right[2] + row * g.down[2]
      ]);
      STICKER_NRM.push(NORMAL[face].slice());
    }
  }
});

function stickerIndexAt(pos, nrm) {
  for (var i = 0; i < 54; i++) {
    if (vecEq(STICKER_POS[i], pos) && vecEq(STICKER_NRM[i], nrm)) return i;
  }
  throw new Error('cube: 找不到對應貼紙位置');
}

// ---------------------------------------------------------------------------
// 4. 36 個記號與其貼紙置換
// ---------------------------------------------------------------------------

// 記號順序：外層 U R F D L B，接著中層 M E S，接著整顆 x y z；各 × 同一組後綴。
var BASE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z'];
var SUFFIXES = ['', '2', "'"];

var MOVES = [];
BASE_ORDER.forEach(function (base) {
  SUFFIXES.forEach(function (suffix) {
    MOVES.push(base + suffix);
  });
});

// 合法記號集合（S11／m-1：kind、inverse、reducer 前置條件一律以此嚴格檢查，
// 不再只看第一個字元，避免 'R3'、'xx' 之類格式錯誤的字串被當成合法記號）。
var MOVE_SET = new Set(MOVES);

function isMove(move) {
  return typeof move === 'string' && MOVE_SET.has(move);
}

// 每個基本記號的旋轉軸與會轉動的「層」（layers 為 dot(位置, 軸) 的值集合）：
//   外層：只轉 dot=1 的那一層；中層：只轉 dot=0 的那一層；整顆：三層都轉。
// 中層方向慣例（§1.2）：M 同 L、E 同 D、S 同 F；整顆慣例：x 同 R、y 同 U、z 同 F。
var BASE_DEF = {
  U: { axis: NORMAL.U, layers: [1] },
  R: { axis: NORMAL.R, layers: [1] },
  F: { axis: NORMAL.F, layers: [1] },
  D: { axis: NORMAL.D, layers: [1] },
  L: { axis: NORMAL.L, layers: [1] },
  B: { axis: NORMAL.B, layers: [1] },
  M: { axis: NORMAL.L, layers: [0] },
  E: { axis: NORMAL.D, layers: [0] },
  S: { axis: NORMAL.F, layers: [0] },
  x: { axis: NORMAL.R, layers: [-1, 0, 1] },
  y: { axis: NORMAL.U, layers: [-1, 0, 1] },
  z: { axis: NORMAL.F, layers: [-1, 0, 1] }
};

// perm[i] ＝ 貼紙 i 轉動後會移動到的位置索引（applyPerm 用此定義套用）。
function buildQuarterPerm(def) {
  var perm = new Array(54);
  for (var i = 0; i < 54; i++) {
    if (def.layers.indexOf(dot(STICKER_POS[i], def.axis)) !== -1) {
      var newPos = rotateCw(STICKER_POS[i], def.axis);
      var newNrm = rotateCw(STICKER_NRM[i], def.axis);
      perm[i] = stickerIndexAt(newPos, newNrm);
    } else {
      perm[i] = i;
    }
  }
  return perm;
}

// 合成兩個置換：先套用 p、再套用 q（等於依序做兩個轉動）。
function composePerm(p, q) {
  var out = new Array(p.length);
  for (var i = 0; i < p.length; i++) out[i] = q[p[i]];
  return out;
}

function invertPerm(p) {
  var inv = new Array(p.length);
  for (var i = 0; i < p.length; i++) inv[p[i]] = i;
  return inv;
}

var MOVE_PERM = {};
BASE_ORDER.forEach(function (base) {
  var quarter = buildQuarterPerm(BASE_DEF[base]);
  var half = composePerm(quarter, quarter);
  var reverse = composePerm(half, quarter);
  MOVE_PERM[base] = quarter;
  MOVE_PERM[base + '2'] = half;
  MOVE_PERM[base + "'"] = reverse;
});

// 置換 → 記號名稱的反查表（toHome／toView 用）。
var MOVE_BY_PERM = new Map();
MOVES.forEach(function (move) {
  MOVE_BY_PERM.set(MOVE_PERM[move].join(','), move);
});

// ---------------------------------------------------------------------------
// 5. 復原狀態與套用置換
// ---------------------------------------------------------------------------

var SOLVED = [];
for (var si = 0; si < 54; si++) SOLVED.push(Math.floor(si / 9));

function applyPerm(stickers, perm) {
  var out = new Array(54);
  for (var i = 0; i < 54; i++) out[perm[i]] = stickers[i];
  return out;
}

function applyMove(stickers, move) {
  if (!isMove(move)) throw new Error('applyMove: 未知記號 ' + move);
  var perm = MOVE_PERM[move];
  return applyPerm(stickers, perm);
}

function applyMoves(stickers, moves) {
  return moves.reduce(function (acc, move) {
    return applyMove(acc, move);
  }, stickers);
}

function isSolved(stickers) {
  for (var f = 0; f < 6; f++) {
    var center = stickers[9 * f + 4];
    for (var k = 0; k < 9; k++) {
      if (stickers[9 * f + k] !== center) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 6. 記號種類、方向與 QTM 步數（§2.1、§2.4）
// ---------------------------------------------------------------------------

var OUTER_BASES = ['U', 'R', 'F', 'D', 'L', 'B'];
var SLICE_BASES = ['M', 'E', 'S'];
var ROTATION_BASES = ['x', 'y', 'z'];

function kind(move) {
  if (!isMove(move)) throw new Error('kind: 未知記號 ' + move);
  var base = move.charAt(0);
  if (OUTER_BASES.indexOf(base) !== -1) return 'outer';
  if (SLICE_BASES.indexOf(base) !== -1) return 'slice';
  if (ROTATION_BASES.indexOf(base) !== -1) return 'rotation';
  throw new Error('kind: 未知記號 ' + move);
}

function isHalfTurn(move) {
  return move.length > 1 && move.charAt(1) === '2';
}

function qtmCost(move) {
  var k = kind(move);
  if (k === 'rotation') return 0;
  var half = isHalfTurn(move);
  if (k === 'outer') return half ? 2 : 1;
  return half ? 4 : 2; // slice
}

function inverse(move) {
  if (!isMove(move)) throw new Error('inverse: 未知記號 ' + move);
  var base = move.charAt(0);
  if (move.length === 1) return base + "'";
  if (move.charAt(1) === '2') return move;
  return base; // 原本是 X' → 反向是 X
}

function layerStickers(move) {
  if (!isMove(move)) throw new Error('layerStickers: 未知記號 ' + move);
  var perm = MOVE_PERM[move];
  var out = [];
  for (var i = 0; i < 54; i++) {
    if (perm[i] !== i) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 7. 24 種朝向：以 x、y、z 為生成元 BFS，依發現順序編號 0–23（§3.2）
// ---------------------------------------------------------------------------

var IDENTITY_PERM = [];
for (var ii = 0; ii < 54; ii++) IDENTITY_PERM.push(ii);

var ORIENT = [IDENTITY_PERM];
var ORIENT_KEY = new Map();
ORIENT_KEY.set(IDENTITY_PERM.join(','), 0);

var ORIENT_GENS = ['x', 'y', 'z'];
for (var h = 0; h < ORIENT.length; h++) {
  for (var gi = 0; gi < ORIENT_GENS.length; gi++) {
    var candidate = composePerm(ORIENT[h], MOVE_PERM[ORIENT_GENS[gi]]);
    var ckey = candidate.join(',');
    if (!ORIENT_KEY.has(ckey)) {
      ORIENT_KEY.set(ckey, ORIENT.length);
      ORIENT.push(candidate);
    }
  }
}

// 幾何若正確必為 24；此為模組載入時的內部一致性檢查（非執行期輸入相依，仍是純函數模組）。
if (ORIENT.length !== 24) {
  throw new Error('cube: 朝向數量應為 24，實得 ' + ORIENT.length);
}

var ORIENT_COUNT = 24;

function checkOrient(o) {
  if (!(Number.isInteger(o) && o >= 0 && o < ORIENT_COUNT)) {
    throw new Error('cube: orient 必須是 0–23 的整數，收到 ' + o);
  }
}

function applyOrient(home, o) {
  checkOrient(o);
  return applyPerm(home, ORIENT[o]);
}

function orientAfter(o, rotation) {
  checkOrient(o);
  if (kind(rotation) !== 'rotation') {
    throw new Error('orientAfter: rotation 必須是整顆旋轉記號，收到 ' + rotation);
  }
  var composed = composePerm(ORIENT[o], MOVE_PERM[rotation]);
  var next = ORIENT_KEY.get(composed.join(','));
  if (next === undefined) throw new Error('orientAfter: 找不到對應朝向');
  return next;
}

function toHome(orient, viewMove) {
  checkOrient(orient);
  if (!isMove(viewMove)) throw new Error('toHome: 未知記號 ' + viewMove);
  var viewPerm = MOVE_PERM[viewMove];
  var P = ORIENT[orient];
  var composed = composePerm(composePerm(P, viewPerm), invertPerm(P));
  var name = MOVE_BY_PERM.get(composed.join(','));
  if (!name) throw new Error('toHome: 找不到對應的 home 記號');
  return name;
}

function toView(orient, homeMove) {
  checkOrient(orient);
  if (!isMove(homeMove)) throw new Error('toView: 未知記號 ' + homeMove);
  var homePerm = MOVE_PERM[homeMove];
  var P = ORIENT[orient];
  var composed = composePerm(composePerm(invertPerm(P), homePerm), P);
  var name = MOVE_BY_PERM.get(composed.join(','));
  if (!name) throw new Error('toView: 找不到對應的 view 記號');
  return name;
}

// ---------------------------------------------------------------------------
// 8. 觸控手勢 → 記號（game-spec.md §9.2 第 3 點）
// ---------------------------------------------------------------------------

function faceByNormal(v) {
  for (var i = 0; i < FACE_LIST.length; i++) {
    if (vecEq(NORMAL[FACE_LIST[i]], v)) return FACE_LIST[i];
  }
  throw new Error('gestureToMove: 找不到對應面');
}

// 中層的參考法向量：M 參考 L、E 參考 D、S 參考 F（§1.2 方向慣例）。
var SLICE_REF = [
  ['M', NORMAL.L],
  ['E', NORMAL.D],
  ['S', NORMAL.F]
];

function gestureToMove(viewIndex, dir3) {
  if (!(Number.isInteger(viewIndex) && viewIndex >= 0 && viewIndex < 54)) {
    throw new Error('gestureToMove: viewIndex 必須是 0–53 的整數');
  }
  var n = STICKER_NRM[viewIndex];
  var p = STICKER_POS[viewIndex];
  var w = cross(n, dir3);
  var k = dot(p, w);
  if (k === 1) return faceByNormal(w) + "'";
  if (k === -1) return faceByNormal(negate(w));
  for (var i = 0; i < SLICE_REF.length; i++) {
    var letter = SLICE_REF[i][0];
    var ref = SLICE_REF[i][1];
    if (vecEq(ref, w)) return letter + "'";
    if (vecEq(ref, negate(w))) return letter;
  }
  throw new Error('gestureToMove: 無法判定轉動方向');
}

// ---------------------------------------------------------------------------
// 9. 記號字串解析與顯示（§1.2 字元規則）
// ---------------------------------------------------------------------------

function parseMoves(str) {
  if (typeof str !== 'string') throw new Error('parseMoves: 需要字串');
  var trimmed = str.trim();
  if (trimmed === '') return [];
  var tokens = trimmed.split(/\s+/);
  return tokens.map(function (token) {
    var normalized = token.replace(/[’′]/g, "'"); // ’ 與 ′ 正規化為 '
    if (!MOVE_SET.has(normalized)) throw new Error('parseMoves: 無效記號 ' + token);
    return normalized;
  });
}

function formatMove(move) {
  if (!MOVE_SET.has(move)) throw new Error('formatMove: 無效記號 ' + move);
  return move.replace("'", '′');
}

// ---------------------------------------------------------------------------
// 10. 白話說明用的結構化描述（§2.4，修訂 R-2d）
// ---------------------------------------------------------------------------

function describeMove(move) {
  if (!MOVE_SET.has(move)) throw new Error('describeMove: 無效記號 ' + move);
  var base = move.charAt(0);
  var moveKind = kind(move);
  var turn;
  if (move.length === 1) {
    turn = 'cw';
  } else if (move.charAt(1) === '2') {
    turn = 'half';
  } else {
    turn = 'ccw';
  }
  return { move: move, base: base, kind: moveKind, turn: turn, qtm: qtmCost(move) };
}

// ---------------------------------------------------------------------------
// 11. 匯出常數凍結（S11／m-1：呼叫端不得改動共用的常數陣列）
// ---------------------------------------------------------------------------

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.getOwnPropertyNames(value).forEach(function (key) {
    deepFreeze(value[key]);
  });
  return Object.freeze(value);
}

deepFreeze(MOVES);
deepFreeze(SOLVED);
deepFreeze(STICKER_POS);
deepFreeze(STICKER_NRM);
deepFreeze(FACE_AXES);

module.exports = {
  MOVES: MOVES,
  isMove: isMove,
  SOLVED: SOLVED,
  STICKER_POS: STICKER_POS,
  STICKER_NRM: STICKER_NRM,
  FACE_AXES: FACE_AXES,
  applyMove: applyMove,
  applyMoves: applyMoves,
  inverse: inverse,
  kind: kind,
  qtmCost: qtmCost,
  isSolved: isSolved,
  ORIENT_COUNT: ORIENT_COUNT,
  orientAfter: orientAfter,
  applyOrient: applyOrient,
  toHome: toHome,
  toView: toView,
  layerStickers: layerStickers,
  gestureToMove: gestureToMove,
  parseMoves: parseMoves,
  formatMove: formatMove,
  describeMove: describeMove
};
