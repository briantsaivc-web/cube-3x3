// src/solver/lbl.js — 層先法（初學者法）分段產生器
//
// 依據：game-spec.md §8（全部）、§7.2（介面）、§9.5（錯誤碼）；資料：src/data/lbl.json。
//
// 做法：在產生器內部的虛擬方塊（54 格貼紙色號）上，依 8 個分段的規則逐一
// 「看狀態 → 選公式 → 套用」，套用的每個記號都記下來並分成 segments／parts。
//
// 設計原則（CLAUDE.md §3）：
//   - 純函數：不讀時間、不用亂數、不碰瀏覽器 API；同輸入必得同輸出（T-LBL-06）。
//   - 幾何與轉動一律呼叫 src/engine/cube.js（分派單 X-2），本檔不另寫轉動表。
//   - 公式記號、首層顏色、頭燈面、迴圈上限都從 config（lbl.json）讀取，不寫死。
//   - 每個迴圈都有上限（config.guards），超過回 {error:'LBL_STUCK'}，不會無窮迴圈。
//   - 不 require twophase.js（分派單 X-4）。
'use strict';

var cube = require('../engine/cube.js');

// ---------------------------------------------------------------------------
// 1. 常數：分段順序、面序、塊的貼紙位置
// ---------------------------------------------------------------------------

// 8 段固定順序（§8.3）；config.segments 必須與此相同。
var SEGMENT_IDS = ['hold', 'cross', 'corners', 'middle',
  'yellowCross', 'yellowFace', 'yellowCorners', 'yellowEdges'];

// 產生器用到的公式 id（§8.4）；config.formulas 必須全部提供。
var FORMULA_IDS = ['crossDown', 'crossFlip', 'cornerDrop', 'cornerInsert',
  'edgeRight', 'edgeLeft', 'edgeKickOut', 'yellowCross', 'sune', 'aPerm', 'uPerm'];

// 迴圈上限的鍵（§10.4 guards）。
var GUARD_KEYS = ['cross', 'corners', 'cornerInsert', 'middle',
  'yellowCross', 'sune', 'aPerm', 'uPerm'];

// 面序 U R F D L B（§1.1）；貼紙索引 ＝ 9 × 面序 ＋ (列 × 3 ＋ 欄)。
var FACES = 'URFDLB';
var SIDE_FACES = ['F', 'R', 'B', 'L'];
var HEADLIGHT_FACES = SIDE_FACES;

function faceBase(face) {
  return 9 * FACES.indexOf(face);
}

function centerIndex(face) {
  return faceBase(face) + 4;
}

// 各面的法向量取自 engine 的中心貼紙法向量（不另寫幾何）。
function faceNormal(face) {
  return cube.STICKER_NRM[centerIndex(face)];
}

function sameVec(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// 以 engine 的貼紙位置表，找出「位於 pos、朝向 face」的貼紙索引。
function stickerAt(pos, face) {
  var n = faceNormal(face);
  for (var i = 0; i < 54; i++) {
    if (sameVec(cube.STICKER_POS[i], pos) && sameVec(cube.STICKER_NRM[i], n)) return i;
  }
  throw new Error('lbl: 找不到貼紙 ' + face);
}

// 塊的位置名稱 → 各字母對應面上的貼紙索引（順序與名稱字母相同）。
function pieceStickers(name) {
  var pos = [0, 0, 0];
  for (var k = 0; k < name.length; k++) {
    var n = faceNormal(name.charAt(k));
    pos = [pos[0] + n[0], pos[1] + n[1], pos[2] + n[2]];
  }
  return name.split('').map(function (face) { return stickerAt(pos, face); });
}

var EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
var CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];

var EDGE_STICKERS = {};
EDGE_NAMES.forEach(function (nm) { EDGE_STICKERS[nm] = pieceStickers(nm); });
var CORNER_STICKERS = {};
CORNER_NAMES.forEach(function (nm) { CORNER_STICKERS[nm] = pieceStickers(nm); });

var TOP_EDGE_SLOTS = ['UF', 'UR', 'UB', 'UL'];      // middle 段找頂層邊塊的順序
var MIDDLE_SLOTS = ['FR', 'FL', 'BL', 'BR'];        // middle 段找卡住邊塊的順序
var CORNER_TARGET_PAIRS = [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']];

// U 面的邊格與角格（U 面「右」＝+x、「下」＝+z，所以第 0 列在後面）。
var U_EDGE_CELLS = [1, 3, 5, 7];           // UB、UL、UR、UF 的 U 面貼紙
var U_CORNER_CELLS = [0, 2, 6, 8];         // ULB、UBR、UFL、URF 的 U 面貼紙
var U_BACK_EDGE = 1;
var U_LEFT_EDGE = 3;
var U_RIGHT_EDGE = 5;
var U_FRONT_EDGE = 7;
var U_FRONT_LEFT_CORNER = 6;
// UFL 角在 L 面上的貼紙（L 面第 3 格；§8.4 yellowFace 規則）。
var L_FRONT_TOP = CORNER_STICKERS.UFL[2];
// F 面左上角（yellowCorners 最後的 U 對齊用）。
var F_TOP_LEFT = faceBase('F');

// 整顆旋轉：hold 段依白色中心所在面決定（§8.4）。
var HOLD_ROTATION = { U: null, F: 'x', B: "x'", R: "z'", L: 'z', D: 'x2' };

// ---------------------------------------------------------------------------
// 2. 錯誤與小工具
// ---------------------------------------------------------------------------

// 產生器內部以例外中止，最外層轉成 {error}。
function LblError(code, detail) {
  this.code = code;
  this.detail = detail;
}

function fail(code, detail) {
  throw new LblError(code, detail);
}

// 轉動 n 次（0–3）對應的記號：0 → 不輸出、1 → X、2 → X2、3 → X'。
function turnTokens(base, n) {
  if (n === 0) return [];
  if (n === 1) return [base];
  if (n === 2) return [base + '2'];
  return [base + "'"];
}

// 記號的「轉動量」（1、2、3 個 90°）；用於合併相鄰同字母整顆旋轉。
function quarterCount(token) {
  if (token.length === 1) return 1;
  return token.charAt(1) === '2' ? 2 : 3;
}

// 合併相鄰的同字母整顆旋轉：y y' → 消掉；y y → y2；y2 y → y'（§8.1、T-LBL-07）。
function mergeRotations(tokens) {
  var out = [];
  tokens.forEach(function (t) {
    var last = out.length ? out[out.length - 1] : null;
    if (last !== null && last.charAt(0) === t.charAt(0)) {
      out.pop();
      var q = (quarterCount(last) + quarterCount(t)) % 4;
      out.push.apply(out, turnTokens(t.charAt(0), q));
    } else {
      out.push(t);
    }
  });
  return out;
}

function sumQtm(tokens, from, to) {
  var s = 0;
  for (var i = from; i < to; i++) s += cube.qtmCost(tokens[i]);
  return s;
}

// ---------------------------------------------------------------------------
// 3. 讀取方塊狀態的純函數（輸入 54 格色號）
// ---------------------------------------------------------------------------

function centerColor(st, face) {
  return st[centerIndex(face)];
}

function faceOfColor(st, color) {
  for (var f = 0; f < 6; f++) {
    if (st[9 * f + 4] === color) return FACES.charAt(f);
  }
  return null;
}

// 找邊塊 {c1, c2}：回傳所在位置名稱與方向（flip 0 ＝ c1 在名稱第一個字母的面上）。
function locateEdge(st, c1, c2) {
  for (var k = 0; k < EDGE_NAMES.length; k++) {
    var s = EDGE_STICKERS[EDGE_NAMES[k]];
    if (st[s[0]] === c1 && st[s[1]] === c2) return { slot: EDGE_NAMES[k], flip: 0 };
    if (st[s[0]] === c2 && st[s[1]] === c1) return { slot: EDGE_NAMES[k], flip: 1 };
  }
  return null;
}

// 找角塊（三色 colors，第一色為首層顏色）：回傳位置名稱與扭轉（首色在第幾個貼紙）。
function locateCorner(st, colors) {
  for (var k = 0; k < CORNER_NAMES.length; k++) {
    var s = CORNER_STICKERS[CORNER_NAMES[k]];
    var have = [st[s[0]], st[s[1]], st[s[2]]];
    if (colors.every(function (c) { return have.indexOf(c) !== -1; })) {
      return { slot: CORNER_NAMES[k], twist: have.indexOf(colors[0]) };
    }
  }
  return null;
}

// 該位置上的塊是否「每個貼紙都與所在面中心同色」（已歸位且方向正確）。
function pieceSolved(st, stickers, name) {
  for (var k = 0; k < name.length; k++) {
    if (st[stickers[k]] !== centerColor(st, name.charAt(k))) return false;
  }
  return true;
}

function edgeSolved(st, slot) {
  return pieceSolved(st, EDGE_STICKERS[slot], slot);
}

function cornerSolved(st, slot) {
  return pieceSolved(st, CORNER_STICKERS[slot], slot);
}

// 某面整面都是 color。
function faceAll(st, face, color) {
  var b = faceBase(face);
  for (var k = 0; k < 9; k++) if (st[b + k] !== color) return false;
  return true;
}

// 側面第 row 列（0 上、1 中、2 下）是否全與中心同色。
function sideRowSolved(st, face, row) {
  var b = faceBase(face);
  var c = st[b + 4];
  return st[b + 3 * row] === c && st[b + 3 * row + 1] === c && st[b + 3 * row + 2] === c;
}

// 前兩層完成（白色朝下）：D 面全為首層色、四個側面第 1、2 列與中心同色。
function firstTwoLayersDown(st, w) {
  if (!faceAll(st, 'D', w)) return false;
  return SIDE_FACES.every(function (f) {
    return sideRowSolved(st, f, 1) && sideRowSolved(st, f, 2);
  });
}

function uEdgesAre(st, color) {
  var b = faceBase('U');
  return U_EDGE_CELLS.every(function (k) { return st[b + k] === color; });
}

// 頭燈：側面上排左右兩角同色。
function headlightFaces(st) {
  return SIDE_FACES.filter(function (f) {
    var b = faceBase(f);
    return st[b] === st[b + 2];
  });
}

function topEdgeOk(st, face) {
  var b = faceBase(face);
  return st[b + 1] === st[b + 4];
}

// ---------------------------------------------------------------------------
// 4. 各段完成判定（§8.3；T-LBL-08 使用）
//    每個函式：(stickers54, config) → boolean；只看傳入狀態，不看產生過程。
// ---------------------------------------------------------------------------

function holdDone(st, config) {
  return centerColor(st, 'U') === config.firstLayerColor;
}

function crossDone(st, config) {
  if (!holdDone(st, config)) return false;
  return TOP_EDGE_SLOTS.every(function (slot) { return edgeSolved(st, slot); });
}

function cornersDone(st, config) {
  if (!crossDone(st, config)) return false;
  if (!faceAll(st, 'U', config.firstLayerColor)) return false;
  return SIDE_FACES.every(function (f) { return sideRowSolved(st, f, 0); });
}

function middleDone(st, config) {
  if (centerColor(st, 'D') !== config.firstLayerColor) return false;
  return firstTwoLayersDown(st, config.firstLayerColor);
}

function yellowCrossDone(st, config) {
  return middleDone(st, config) && uEdgesAre(st, centerColor(st, 'U'));
}

function yellowFaceDone(st, config) {
  return middleDone(st, config) && faceAll(st, 'U', centerColor(st, 'U'));
}

function yellowCornersDone(st, config) {
  if (!yellowFaceDone(st, config)) return false;
  return SIDE_FACES.every(function (f) {
    var b = faceBase(f);
    return st[b] === st[b + 4] && st[b + 2] === st[b + 4];
  });
}

function yellowEdgesDone(st) {
  return cube.isSolved(st);
}

var STAGE_CHECKS = {
  hold: holdDone,
  cross: crossDone,
  corners: cornersDone,
  middle: middleDone,
  yellowCross: yellowCrossDone,
  yellowFace: yellowFaceDone,
  yellowCorners: yellowCornersDone,
  yellowEdges: yellowEdgesDone
};

// ---------------------------------------------------------------------------
// 5. 輸入與設定檢查
// ---------------------------------------------------------------------------

function checkStickers(view) {
  if (!Array.isArray(view) || view.length !== 54) fail('INVALID_STATE', 'LENGTH');
  var count = [0, 0, 0, 0, 0, 0];
  for (var i = 0; i < 54; i++) {
    var c = view[i];
    if (!(Number.isInteger(c) && c >= 0 && c < 6)) fail('INVALID_STATE', 'BAD_COLOR');
    count[c]++;
  }
  if (count.some(function (n) { return n !== 9; })) fail('INVALID_STATE', 'BAD_COLOR');
  var seen = {};
  for (var f = 0; f < 6; f++) {
    var cc = view[9 * f + 4];
    if (seen[cc]) fail('INVALID_STATE', 'CENTER_DUPLICATE');
    seen[cc] = true;
  }
}

function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}

// 讀出產生器需要的設定；格式不符回 BAD_REQUEST。
function readConfig(config) {
  if (!config || typeof config !== 'object') fail('BAD_REQUEST', 'config');
  var fl = config.firstLayerColor;
  if (!(Number.isInteger(fl) && fl >= 0 && fl < 6)) fail('BAD_REQUEST', 'firstLayerColor');
  if (!Array.isArray(config.segments) || config.segments.join(',') !== SEGMENT_IDS.join(',')) {
    fail('BAD_REQUEST', 'segments');
  }
  if (HEADLIGHT_FACES.indexOf(config.headlightFace) === -1) fail('BAD_REQUEST', 'headlightFace');
  var guards = config.guards;
  if (!guards || typeof guards !== 'object') fail('BAD_REQUEST', 'guards');
  GUARD_KEYS.forEach(function (key) {
    if (!isPositiveInt(guards[key])) fail('BAD_REQUEST', 'guards.' + key);
  });
  var algs = {};
  FORMULA_IDS.forEach(function (id) {
    var f = config.formulas && config.formulas[id];
    if (!f || typeof f.alg !== 'string') fail('BAD_REQUEST', 'formulas.' + id);
    var moves;
    try {
      moves = cube.parseMoves(f.alg);
    } catch (e) {
      fail('BAD_REQUEST', 'formulas.' + id);
    }
    if (moves.length === 0) fail('BAD_REQUEST', 'formulas.' + id);
    algs[id] = moves;
  });
  return {
    firstLayerColor: fl,
    headlightFace: config.headlightFace,
    guards: guards,
    algs: algs
  };
}

// ---------------------------------------------------------------------------
// 6. 產生器本體
// ---------------------------------------------------------------------------

function newLoopStats() {
  var s = {};
  GUARD_KEYS.forEach(function (k) { s[k] = 0; });
  return s;
}

function runGenerator(view, config) {
  checkStickers(view);
  var cfg = readConfig(config);
  var W = cfg.firstLayerColor;
  var guards = cfg.guards;
  var algs = cfg.algs;

  var st = view.slice();       // 虛擬方塊（目前的 view 狀態）
  var tokens = [];
  var segments = [];
  var seg = null;
  var loops = newLoopStats();  // 本局各迴圈的實際次數（每段／每角取最大）

  function applyToken(t) {
    st = cube.applyMove(st, t);
    tokens.push(t);
  }

  // 輸出一組記號成為一個 part。
  //   rotate：若上一個 part 也是 rotate 且緊接在後，併進同一個 part 再合併同字母旋轉。
  //   setup：每個記號各自成一個 part（§8.2「單一轉動」）。
  //   formula：整條公式一個 part。
  function emit(list, kind, formulaId) {
    if (list.length === 0) return;
    if (kind === 'setup') {
      list.forEach(function (t) {
        var start = tokens.length;
        applyToken(t);
        seg.parts.push({ start: start, end: tokens.length, kind: 'setup', formula: null });
      });
      return;
    }
    if (kind === 'rotate') {
      var last = seg.parts.length ? seg.parts[seg.parts.length - 1] : null;
      var start = tokens.length;
      list.forEach(applyToken);
      if (last && last.kind === 'rotate' && last.end === start) {
        // 狀態已照原記號套用；合併只改寫記號，不改變結果（同字母旋轉可交換合併）。
        var merged = mergeRotations(tokens.slice(last.start));
        tokens.length = last.start;
        merged.forEach(function (t) { tokens.push(t); });
        last.end = tokens.length;
        if (last.end === last.start) seg.parts.pop();
      } else {
        var mergedNew = mergeRotations(tokens.slice(start));
        tokens.length = start;
        mergedNew.forEach(function (t) { tokens.push(t); });
        if (tokens.length > start) {
          seg.parts.push({ start: start, end: tokens.length, kind: 'rotate', formula: null });
        }
      }
      return;
    }
    var fStart = tokens.length;
    list.forEach(applyToken);
    seg.parts.push({ start: fStart, end: tokens.length, kind: 'formula', formula: formulaId });
  }

  function formula(id) {
    emit(algs[id], 'formula', id);
  }

  // 找出 base 轉 0–3 次中，最少幾次能讓 pred 成立；都不成立 → LBL_STUCK。
  function turnsUntil(base, pred) {
    var b = st;
    for (var n = 0; n < 4; n++) {
      if (pred(b)) return n;
      b = cube.applyMove(b, base);
    }
    return fail('LBL_STUCK', 'turnsUntil ' + base);
  }

  function adjust(base, pred, kind) {
    emit(turnTokens(base, turnsUntil(base, pred)), kind);
  }

  function mustEdge(s, c1, c2) {
    var e = locateEdge(s, c1, c2);
    if (!e) fail('INVALID_STATE', 'EDGE_UNKNOWN');
    return e;
  }

  function mustCorner(s, colors) {
    var c = locateCorner(s, colors);
    if (!c) fail('INVALID_STATE', 'CORNER_UNKNOWN');
    return c;
  }

  function begin(id) {
    seg = { id: id, start: tokens.length, end: tokens.length, qtm: 0, parts: [] };
    segments.push(seg);
  }

  function end() {
    seg.end = tokens.length;
    seg.qtm = sumQtm(tokens, seg.start, seg.end);
    if (!STAGE_CHECKS[seg.id](st, cfg)) fail('LBL_STUCK', 'check:' + seg.id);
  }

  // ---- 0 hold：白色中心轉到上面 ----
  begin('hold');
  var whiteFace = faceOfColor(st, W);
  if (whiteFace === null) fail('INVALID_STATE', 'BAD_COLOR');
  if (HOLD_ROTATION[whiteFace]) emit([HOLD_ROTATION[whiteFace]], 'rotate');
  end();

  // ---- 1 cross：白色十字（白在上）----
  begin('cross');
  (function () {
    function sideDone(s, side) {
      var e = mustEdge(s, W, centerColor(s, side));
      return e.slot === 'U' + side && e.flip === 0;
    }
    function allDone() {
      return SIDE_FACES.every(function (side) { return sideDone(st, side); });
    }
    var iter = 0;
    while (!allDone()) {
      if (iter >= guards.cross) fail('LBL_STUCK', 'cross');
      iter++;
      var side = SIDE_FACES.filter(function (f) { return !sideDone(st, f); })[0];
      var target = centerColor(st, side);
      // 1. y 對位：把該側面轉到 F。
      adjust('y', function (b) { return centerColor(b, 'F') === target; }, 'rotate');
      var fc = centerColor(st, 'F');
      var e = mustEdge(st, W, fc);
      if (e.slot.charAt(0) === 'U') {
        // 2a. 在頂層（位置或方向錯）：轉所在側面 180°，帶到底層。
        emit([e.slot.charAt(1) + '2'], 'setup');
      } else if (e.slot.charAt(0) !== 'D') {
        // 2b. 在中層：X 取位置名稱第一個字母，試 X、X'，選第一個能帶到底層的 t，輸出 t D t⁻¹。
        var x = e.slot.charAt(0);
        var t = [x, x + "'"].filter(function (m) {
          return mustEdge(cube.applyMove(st, m), W, fc).slot.charAt(0) === 'D';
        })[0];
        if (!t) fail('LBL_STUCK', 'cross');
        emit([t, 'D', cube.inverse(t)], 'setup');
      }
      // 3. D 調整，讓它到 DF。
      adjust('D', function (b) { return mustEdge(b, W, fc).slot === 'DF'; }, 'setup');
      // 4. 白色朝下 → crossDown；白色朝前 → crossFlip。
      if (st[EDGE_STICKERS.DF[0]] === W) formula('crossDown');
      else formula('crossFlip');
    }
    loops.cross = iter;
  })();
  end();

  // ---- 2 corners：白色角塊（白在上）----
  begin('corners');
  (function () {
    function targetColors(s, pair) {
      return [W, centerColor(s, pair[0]), centerColor(s, pair[1])];
    }
    // 某目標角（三色）是否已在頂層正確位置。
    function targetSolved(s, colors) {
      var c = mustCorner(s, colors);
      return c.slot.charAt(0) === 'U' && c.twist === 0 && cornerSolved(s, c.slot);
    }
    function firstTodo() {
      for (var i = 0; i < CORNER_TARGET_PAIRS.length; i++) {
        var cs = targetColors(st, CORNER_TARGET_PAIRS[i]);
        if (!targetSolved(st, cs)) return cs;
      }
      return null;
    }
    var iter = 0;
    var cs = firstTodo();
    while (cs) {
      if (iter >= guards.corners) fail('LBL_STUCK', 'corners');
      iter++;
      // 1. y 對位：目標槽（兩側中心 cs[1]、cs[2]）轉到 UFR。
      adjust('y', function (b) {
        return centerColor(b, 'F') === cs[1] && centerColor(b, 'R') === cs[2];
      }, 'rotate');
      // 2. 角塊在頂層：不在 UFR → y 帶過去、拿下來、y 轉回；在 UFR 但方向錯 → 拿下來。
      var c = mustCorner(st, cs);
      if (c.slot.charAt(0) === 'U') {
        if (c.slot !== 'URF') {
          var k = turnsUntil('y', function (b) { return mustCorner(b, cs).slot === 'URF'; });
          emit(turnTokens('y', k), 'rotate');
          formula('cornerDrop');
          emit(turnTokens('y', (4 - k) % 4), 'rotate');
        } else {
          formula('cornerDrop');
        }
      }
      // 3. D 調整，讓它到 DFR。
      adjust('D', function (b) { return mustCorner(b, cs).slot === 'DFR'; }, 'setup');
      // 4. 重複 cornerInsert 直到 UFR 歸位（上限 guards.cornerInsert）。
      var n = 0;
      while (!(function () {
        var r = mustCorner(st, cs);
        return r.slot === 'URF' && r.twist === 0;
      })()) {
        if (n >= guards.cornerInsert) fail('LBL_STUCK', 'cornerInsert');
        n++;
        formula('cornerInsert');
      }
      if (n > loops.cornerInsert) loops.cornerInsert = n;
      cs = firstTodo();
    }
    loops.corners = iter;
  })();
  end();

  // ---- 3 middle：翻面（白朝下）＋中層邊塊 ----
  begin('middle');
  emit(['z2'], 'rotate');
  (function () {
    var Y = centerColor(st, 'U');
    function allDone() {
      return MIDDLE_SLOTS.every(function (slot) { return edgeSolved(st, slot); });
    }
    var iter = 0;
    while (!allDone()) {
      if (iter >= guards.middle) fail('LBL_STUCK', 'middle');
      iter++;
      var uSlot = TOP_EDGE_SLOTS.filter(function (slot) {
        var s = EDGE_STICKERS[slot];
        return st[s[0]] !== Y && st[s[1]] !== Y;
      })[0];
      if (uSlot) {
        // 1. 頂層有不含黃色的邊塊：y 對位讓側面色中心在 F，U 調整讓它到 UF，再依頂面色選公式。
        var us = EDGE_STICKERS[uSlot];
        var top = st[us[0]];
        var side = st[us[1]];
        adjust('y', function (b) { return centerColor(b, 'F') === side; }, 'rotate');
        adjust('U', function (b) {
          var uf = EDGE_STICKERS.UF;
          return b[uf[0]] === top && b[uf[1]] === side;
        }, 'setup');
        if (top === centerColor(st, 'R')) formula('edgeRight');
        else if (top === centerColor(st, 'L')) formula('edgeLeft');
        else fail('LBL_STUCK', 'middle');
      } else {
        // 2. 中層有錯的邊塊卡住：y 對位讓第一個錯的槽在 FR，edgeKickOut。
        var bad = MIDDLE_SLOTS.filter(function (slot) { return !edgeSolved(st, slot); })[0];
        var bs = EDGE_STICKERS[bad];
        var p = st[bs[0]];
        var q = st[bs[1]];
        // y 旋轉會交換邊塊兩個貼紙所在的面，因此以「兩色集合」比對。
        adjust('y', function (b) {
          var fr = EDGE_STICKERS.FR;
          return (b[fr[0]] === p && b[fr[1]] === q) || (b[fr[0]] === q && b[fr[1]] === p);
        }, 'rotate');
        formula('edgeKickOut');
      }
    }
    loops.middle = iter;
  })();
  end();

  // ---- 4 yellowCross：黃色十字 ----
  begin('yellowCross');
  (function () {
    var ub = faceBase('U');
    var Y = centerColor(st, 'U');
    function up(b, k) { return b[ub + k] === Y; }
    var n = 0;
    while (!uEdgesAre(st, Y)) {
      if (n >= guards.yellowCross) fail('LBL_STUCK', 'yellowCross');
      n++;
      var count = U_EDGE_CELLS.filter(function (k) { return up(st, k); }).length;
      if (count === 2) {
        var line = (up(st, U_LEFT_EDGE) && up(st, U_RIGHT_EDGE)) ||
          (up(st, U_BACK_EDGE) && up(st, U_FRONT_EDGE));
        if (line) {
          // 一直線：U 調整讓線為左右向（UL–UR）。
          adjust('U', function (b) { return up(b, U_LEFT_EDGE) && up(b, U_RIGHT_EDGE); }, 'setup');
        } else {
          // L 形：U 調整讓 L 在 UB–UL。
          adjust('U', function (b) { return up(b, U_BACK_EDGE) && up(b, U_LEFT_EDGE); }, 'setup');
        }
      }
      formula('yellowCross');
    }
    loops.yellowCross = n;
  })();
  end();

  // ---- 5 yellowFace：黃色頂面（小魚公式）----
  begin('yellowFace');
  (function () {
    var ub = faceBase('U');
    var Y = centerColor(st, 'U');
    function cornersUp(b) {
      return U_CORNER_CELLS.filter(function (k) { return b[ub + k] === Y; }).length;
    }
    var n = 0;
    while (cornersUp(st) !== U_CORNER_CELLS.length) {
      if (n >= guards.sune) fail('LBL_STUCK', 'sune');
      n++;
      if (cornersUp(st) === 1) {
        // 恰一個角黃色朝上：U 調整讓它在 UFL。
        adjust('U', function (b) { return b[ub + U_FRONT_LEFT_CORNER] === Y; }, 'setup');
      } else {
        // 0 或 2 個：U 調整讓 UFL 角的黃色朝左。
        adjust('U', function (b) { return b[L_FRONT_TOP] === Y; }, 'setup');
      }
      formula('sune');
    }
    loops.sune = n;
  })();
  end();

  // ---- 6 yellowCorners：黃角歸位（頭燈放在 headlightFace）----
  begin('yellowCorners');
  (function () {
    var n = 0;
    while (headlightFaces(st).length !== SIDE_FACES.length) {
      if (n >= guards.aPerm) fail('LBL_STUCK', 'aPerm');
      n++;
      if (headlightFaces(st).length === 1) {
        adjust('U', function (b) {
          var h = headlightFaces(b);
          return h.length === 1 && h[0] === cfg.headlightFace;
        }, 'setup');
      }
      formula('aPerm');
    }
    loops.aPerm = n;
    // 完成後 U 調整：F 面左上角與 F 中心同色（頂角全部對齊）。
    adjust('U', function (b) { return b[F_TOP_LEFT] === centerColor(b, 'F'); }, 'setup');
  })();
  end();

  // ---- 7 yellowEdges：黃邊歸位（用 y 對位，不動已對齊的頂角）----
  begin('yellowEdges');
  (function () {
    function allOk(b) {
      return SIDE_FACES.every(function (f) { return topEdgeOk(b, f); });
    }
    var n = 0;
    while (!allOk(st)) {
      if (n >= guards.uPerm) fail('LBL_STUCK', 'uPerm');
      n++;
      var good = SIDE_FACES.filter(function (f) { return topEdgeOk(st, f); });
      if (good.length === 1) {
        adjust('y', function (b) { return topEdgeOk(b, 'B'); }, 'rotate');
      }
      formula('uPerm');
    }
    loops.uPerm = n;
  })();
  end();

  return {
    result: { tokens: tokens, segments: segments, qtm: sumQtm(tokens, 0, tokens.length) },
    loops: loops
  };
}

// ---------------------------------------------------------------------------
// 7. 對外介面
// ---------------------------------------------------------------------------

/**
 * 產生層先法示範序列（§8.2）。
 * @param {number[]} viewStickers - view 座標 54 格色號（0–5）。
 * @param {object} config - src/data/lbl.json 全文。
 * @returns {{tokens: string[], segments: object[], qtm: number} | {error: string, detail: string}}
 *   錯誤碼：INVALID_STATE（輸入不是合法貼紙）、BAD_REQUEST（設定格式錯誤）、
 *   LBL_STUCK（超過迴圈上限或分段判定不成立）。
 */
function generateLbl(viewStickers, config) {
  var out = generateLblDetailed(viewStickers, config);
  return out.error ? out : out.result;
}

/**
 * 同 generateLbl，另回傳本局各迴圈的實際次數（測試與診斷用；UI 與 Worker 不需要）。
 * @returns {{result: object, loops: object} | {error: string, detail: string}}
 */
function generateLblDetailed(viewStickers, config) {
  try {
    return runGenerator(viewStickers, config);
  } catch (e) {
    if (e instanceof LblError) return { error: e.code, detail: e.detail };
    throw e;
  }
}

module.exports = {
  generateLbl: generateLbl,
  generateLblDetailed: generateLblDetailed,
  STAGE_CHECKS: STAGE_CHECKS,
  SEGMENT_IDS: SEGMENT_IDS,
  GUARD_KEYS: GUARD_KEYS
};
