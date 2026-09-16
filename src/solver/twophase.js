// src/solver/twophase.js — 三階魔術方塊兩階段求解器（產品版，clean-room）
//
// 來源：由 docs/spike/code/solver.js 改寫（T-001 S4），改寫要求見 game-spec.md §7.3、ADR-001 §2.2–§2.4。
// clean-room 註記：只參考公開的演算法說明文件（kociemba.org 兩階段法說明、Wikipedia），
// 未開啟、複製或改寫任何第三方求解器原始碼（CLAUDE.md §1）。
//
// 與 spike 的差異：
//   1. 不讀任何時鐘：停止條件只有搜尋節點數（nodeLimit、firstNodeLimit），同一輸入必得同一結果。
//   2. 只建 QTM 成本的表（metrics:['qtm']、twistFlip:true、cornerTable:false）；init 加 onProgress 回呼。
//   3. 移除最少步搜尋與其輔助函式（game-spec.md §0.2 N-4）；保留 randomCube、makeRng 供測試。
//   4. 改為 CommonJS（module.exports），不掛任何全域物件；不依賴 src/engine/（game-spec.md §7.1）。
//
// 名詞：
//   - 面序 URFDLB（0..5）；轉動編號 m = 3*面 + (次方-1)，次方 1=順時針 90°、2=180°、3=逆時針 90°。
//     MOVE_NAMES 的順序因此與 src/engine/cube.js 的 MOVES 前 18 個相同。
//   - 角塊位置 URF UFL ULB UBR DFR DLF DBL DRB；邊塊位置 UR UF UL UB DR DF DL DB FR FL BL BR。
//   - cubie 表示法為「位置 i 上放的是哪一塊（cp/ep）以及它的方向（co/eo）」。
//   - 54 格貼紙字串：U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9，每格填所屬面的字母。
//   - QTM：90° 算 1 步、180° 算 2 步（本檔只處理外層轉動）。
'use strict';

var FACES = 'URFDLB';
var N_MOVES = 18;
var MOVE_NAMES = [];
(function () {
  var suffix = ['', '2', "'"];
  for (var f = 0; f < 6; f++) for (var p = 0; p < 3; p++) MOVE_NAMES.push(FACES[f] + suffix[p]);
})();
var QTM_COST = new Int8Array(N_MOVES);
for (var mi = 0; mi < N_MOVES; mi++) QTM_COST[mi] = (mi % 3 === 1) ? 2 : 1;

// 搜尋參數的預設值：與 game-spec.md §7.4／§10.3 params.json 的 solver 區塊相同。
// 正式呼叫端（worker.js）應一律把 params.solver 傳進來；這裡的預設只是防止呼叫端漏傳時無限搜尋。
// 兩者一致性由 tests/engine/solver/twophase.test.js 比對。
var DEFAULT_SOLVE_OPTS = Object.freeze({
  metric: 'qtm',
  nodeLimit: 3000000,
  firstNodeLimit: 30000000,
  maxLength: 45,
  phase2Cap: 20
});
// 第二階段深度的理論上限（QTM）：phase2Cap 找不到解時以此重搜（spike §2.7）
var PHASE2_FULL = 36;
// 每搜尋幾個節點檢查一次停止條件（必須是 2 的冪次減 1 的遮罩；沿用 spike，改動會改變求解結果）
var CHECK_MASK = 1023;

// ---------------------------------------------------------------------------
// 1. 貼紙幾何：用 3D 座標推導 54 格的位置與轉動，避免手抄轉動表出錯
//    座標軸：x 向右（R）、y 向上（U）、z 向前（F）
// ---------------------------------------------------------------------------
var NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
// 每面展開圖的左上角座標、向右方向、向下方向（標準十字展開；與 game-spec.md §1.1 表格相同）
var FACE_GEOM = {
  U: { tl: [-1, 1, -1], r: [1, 0, 0], d: [0, 0, 1] },
  R: { tl: [1, 1, 1], r: [0, 0, -1], d: [0, -1, 0] },
  F: { tl: [-1, 1, 1], r: [1, 0, 0], d: [0, -1, 0] },
  D: { tl: [-1, -1, 1], r: [1, 0, 0], d: [0, 0, -1] },
  L: { tl: [-1, 1, -1], r: [0, 0, 1], d: [0, -1, 0] },
  B: { tl: [1, 1, -1], r: [-1, 0, 0], d: [0, -1, 0] }
};
var STICKER_POS = [];
var STICKER_NRM = [];
(function () {
  for (var f = 0; f < 6; f++) {
    var g = FACE_GEOM[FACES[f]];
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 3; col++) {
        STICKER_POS.push([
          g.tl[0] + col * g.r[0] + row * g.d[0],
          g.tl[1] + col * g.r[1] + row * g.d[1],
          g.tl[2] + col * g.r[2] + row * g.d[2]
        ]);
        STICKER_NRM.push(NORMAL[FACES[f]]);
      }
    }
  }
})();
function vecEq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function stickerIndex(pos, nrm) {
  for (var i = 0; i < 54; i++) if (vecEq(STICKER_POS[i], pos) && vecEq(STICKER_NRM[i], nrm)) return i;
  throw new Error('twophase：找不到貼紙');
}
// 繞單位軸 n 旋轉 -90°（從該面外側看為順時針）
function rotCw(v, n) {
  var c = cross(n, v), d = dot(n, v);
  return [-c[0] + n[0] * d, -c[1] + n[1] * d, -c[2] + n[2] * d];
}
// FACE_PERM[f][src] = dest：面 f 順時針 90° 後，src 格的貼紙移到 dest 格
var FACE_PERM = [];
(function () {
  for (var f = 0; f < 6; f++) {
    var n = NORMAL[FACES[f]];
    var perm = new Int8Array(54);
    for (var i = 0; i < 54; i++) {
      if (dot(STICKER_POS[i], n) === 1) perm[i] = stickerIndex(rotCw(STICKER_POS[i], n), rotCw(STICKER_NRM[i], n));
      else perm[i] = i;
    }
    FACE_PERM.push(perm);
  }
})();

var SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * 在貼紙層級套用一個外層轉動（測試與對照用）。
 * @param {string|Array} s - 54 格字串或陣列（陣列元素可為任意值）
 * @param {number} m - 轉動編號 0..17
 * @returns {string|Array} 與輸入同型別的新值（不修改輸入）
 */
function applyMoveFacelets(s, m) {
  var isStr = typeof s === 'string';
  var arr = isStr ? s.split('') : Array.prototype.slice.call(s);
  var f = (m / 3) | 0, pw = (m % 3) + 1;
  for (var k = 0; k < pw; k++) {
    var out = new Array(54);
    for (var i = 0; i < 54; i++) out[FACE_PERM[f][i]] = arr[i];
    arr = out;
  }
  return isStr ? arr.join('') : arr;
}

// ---------------------------------------------------------------------------
// 2. cubie 表示法與貼紙互轉
// ---------------------------------------------------------------------------
var CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
var EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
function cubiePos(name) {
  var p = [0, 0, 0];
  for (var k = 0; k < name.length; k++) {
    var n = NORMAL[name[k]];
    p[0] += n[0]; p[1] += n[1]; p[2] += n[2];
  }
  return p;
}
var CORNER_FACELET = CORNER_NAMES.map(function (nm) {
  var p = cubiePos(nm);
  return nm.split('').map(function (c) { return stickerIndex(p, NORMAL[c]); });
});
var EDGE_FACELET = EDGE_NAMES.map(function (nm) {
  var p = cubiePos(nm);
  return nm.split('').map(function (c) { return stickerIndex(p, NORMAL[c]); });
});

/** 已復原的 cubie 狀態（新物件） */
function newCube() {
  var c = { cp: new Int8Array(8), co: new Int8Array(8), ep: new Int8Array(12), eo: new Int8Array(12) };
  for (var i = 0; i < 8; i++) c.cp[i] = i;
  for (var j = 0; j < 12; j++) c.ep[j] = j;
  return c;
}
function copyCube(src, dst) {
  dst = dst || newCube();
  dst.cp.set(src.cp); dst.co.set(src.co); dst.ep.set(src.ep); dst.eo.set(src.eo);
  return dst;
}
function cubeEquals(a, b) {
  for (var i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (var j = 0; j < 12; j++) if (a.ep[j] !== b.ep[j] || a.eo[j] !== b.eo[j]) return false;
  return true;
}
/** cubie 狀態是否為復原狀態 */
function isSolved(c) {
  for (var i = 0; i < 8; i++) if (c.cp[i] !== i || c.co[i] !== 0) return false;
  for (var j = 0; j < 12; j++) if (c.ep[j] !== j || c.eo[j] !== 0) return false;
  return true;
}
// 乘法：先 a 後 b，結果寫入 out（out 不可與 a 相同物件）
function cornerMul(a, b, out) {
  for (var i = 0; i < 8; i++) {
    var s = b.cp[i];
    out.cp[i] = a.cp[s];
    out.co[i] = (a.co[s] + b.co[i]) % 3;
  }
}
function edgeMul(a, b, out) {
  for (var i = 0; i < 12; i++) {
    var s = b.ep[i];
    out.ep[i] = a.ep[s];
    out.eo[i] = (a.eo[s] + b.eo[i]) & 1;
  }
}
/** cubie 乘法：先 a 後 b，回傳新物件 */
function multiply(a, b) {
  var out = newCube();
  cornerMul(a, b, out); edgeMul(a, b, out);
  return out;
}

/**
 * 54 格字母字串 → cubie。字母代表「這格的顏色屬於哪一面的中心」。
 * 只做「能不能辨認出方塊」的檢查，合法性另由 verify() 判斷。
 * @returns {{cube:Object}|{error:string}} 錯誤碼：LENGTH、BAD_COLOR、CENTER、COLOR_COUNT、CORNER_UNKNOWN、EDGE_UNKNOWN
 */
function faceletsToCubie(s) {
  if (typeof s !== 'string' || s.length !== 54) return { error: 'LENGTH' };
  var count = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (var i = 0; i < 54; i++) {
    if (!Object.prototype.hasOwnProperty.call(count, s[i])) return { error: 'BAD_COLOR' };
    count[s[i]]++;
  }
  for (var f = 0; f < 6; f++) {
    if (s[9 * f + 4] !== FACES[f]) return { error: 'CENTER' };
    if (count[FACES[f]] !== 9) return { error: 'COLOR_COUNT' };
  }
  var c = newCube();
  for (var p = 0; p < 8; p++) {
    var fl = CORNER_FACELET[p], o;
    for (o = 0; o < 3; o++) if (s[fl[o]] === 'U' || s[fl[o]] === 'D') break;
    if (o === 3) return { error: 'CORNER_UNKNOWN' };
    var c1 = s[fl[(o + 1) % 3]], c2 = s[fl[(o + 2) % 3]], found = -1;
    for (var j = 0; j < 8; j++) {
      if (CORNER_NAMES[j][0] === s[fl[o]] && CORNER_NAMES[j][1] === c1 && CORNER_NAMES[j][2] === c2) { found = j; break; }
    }
    if (found < 0) return { error: 'CORNER_UNKNOWN' };
    c.cp[p] = found; c.co[p] = o;
  }
  for (var q = 0; q < 12; q++) {
    var ef = EDGE_FACELET[q], a = s[ef[0]], b = s[ef[1]], hit = -1;
    for (var k = 0; k < 12; k++) {
      if (EDGE_NAMES[k][0] === a && EDGE_NAMES[k][1] === b) { c.ep[q] = k; c.eo[q] = 0; hit = k; break; }
      if (EDGE_NAMES[k][0] === b && EDGE_NAMES[k][1] === a) { c.ep[q] = k; c.eo[q] = 1; hit = k; break; }
    }
    if (hit < 0) return { error: 'EDGE_UNKNOWN' };
  }
  return { cube: c };
}

/** cubie → 54 格字母字串 */
function cubieToFacelets(c) {
  var out = SOLVED_FACELETS.split('');
  for (var p = 0; p < 8; p++) {
    var j = c.cp[p], o = c.co[p];
    for (var k = 0; k < 3; k++) out[CORNER_FACELET[p][(k + o) % 3]] = CORNER_NAMES[j][k];
  }
  for (var q = 0; q < 12; q++) {
    var e = c.ep[q], eo = c.eo[q];
    for (var t = 0; t < 2; t++) out[EDGE_FACELET[q][(t + eo) % 2]] = EDGE_NAMES[e][t];
  }
  return out.join('');
}

function permParity(arr, n) {
  var par = 0;
  for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) if (arr[i] > arr[j]) par ^= 1;
  return par;
}

/**
 * 狀態合法性檢查。
 * @returns {null|string} 合法回傳 null；否則回傳錯誤碼
 *   CORNER_PERM_INVALID、CORNER_TWIST_INVALID、CORNER_TWIST、EDGE_PERM_INVALID、EDGE_FLIP_INVALID、EDGE_FLIP、PARITY
 */
function verify(c) {
  var seen = 0, i, sum = 0;
  for (i = 0; i < 8; i++) {
    if (c.cp[i] < 0 || c.cp[i] > 7) return 'CORNER_PERM_INVALID';
    seen |= 1 << c.cp[i];
    if (c.co[i] < 0 || c.co[i] > 2) return 'CORNER_TWIST_INVALID';
    sum += c.co[i];
  }
  if (seen !== 0xff) return 'CORNER_PERM_INVALID';
  if (sum % 3 !== 0) return 'CORNER_TWIST';
  seen = 0; sum = 0;
  for (i = 0; i < 12; i++) {
    if (c.ep[i] < 0 || c.ep[i] > 11) return 'EDGE_PERM_INVALID';
    seen |= 1 << c.ep[i];
    if (c.eo[i] < 0 || c.eo[i] > 1) return 'EDGE_FLIP_INVALID';
    sum += c.eo[i];
  }
  if (seen !== 0xfff) return 'EDGE_PERM_INVALID';
  if (sum % 2 !== 0) return 'EDGE_FLIP';
  if (permParity(c.cp, 8) !== permParity(c.ep, 12)) return 'PARITY';
  return null;
}

/**
 * 從貼紙顏色建立狀態（game-spec.md §3.4 第 2 點）。
 * colors：長度 54 的陣列，順序同 54 格字串，值可為任意可比較的顏色標籤（engine 用色號 0–5）。
 * 以六個中心格的顏色決定「哪個顏色屬於哪一面」，並一併做合法性檢查。
 * @returns {{ok:true, cube:Object, facelets:string}|{ok:false, error:string}}
 */
function fromStickerColors(colors) {
  if (!colors || colors.length !== 54) return { ok: false, error: 'LENGTH' };
  var map = new Map();
  for (var f = 0; f < 6; f++) {
    var cc = colors[9 * f + 4];
    if (map.has(cc)) return { ok: false, error: 'CENTER_DUPLICATE' };
    map.set(cc, FACES[f]);
  }
  var s = '';
  for (var i = 0; i < 54; i++) {
    if (!map.has(colors[i])) return { ok: false, error: 'BAD_COLOR' };
    s += map.get(colors[i]);
  }
  var r = faceletsToCubie(s);
  if (r.error) return { ok: false, error: r.error };
  var err = verify(r.cube);
  if (err) return { ok: false, error: err };
  return { ok: true, cube: r.cube, facelets: s };
}

// 18 個轉動的 cubie 形式：由貼紙層級推導
var MOVE_CUBE = [];
(function () {
  for (var m = 0; m < N_MOVES; m++) {
    var r = faceletsToCubie(applyMoveFacelets(SOLVED_FACELETS, m));
    if (r.error) throw new Error('twophase：轉動推導失敗 ' + MOVE_NAMES[m]);
    MOVE_CUBE.push(r.cube);
  }
})();

/** 套用一個轉動（編號），回傳新物件 */
function applyMove(c, m) { return multiply(c, MOVE_CUBE[m]); }
/** 依序套用轉動編號陣列，回傳新物件（不修改輸入） */
function applyMoves(c, moves) {
  var cur = copyCube(c), tmp = newCube();
  for (var i = 0; i < moves.length; i++) {
    cornerMul(cur, MOVE_CUBE[moves[i]], tmp); edgeMul(cur, MOVE_CUBE[moves[i]], tmp);
    var t = cur; cur = tmp; tmp = t;
  }
  return cur;
}
/** 記號字串 → 轉動編號陣列；′ 接受 ' ’ ′ 三種寫法；只接受外層 18 個記號 */
function parseAlg(str) {
  var out = [];
  var toks = String(str).trim().split(/\s+/);
  for (var i = 0; i < toks.length; i++) {
    if (!toks[i]) continue;
    var idx = MOVE_NAMES.indexOf(toks[i].replace(/[’′]/g, "'"));
    if (idx < 0) throw new Error('twophase：無法解析轉動 ' + toks[i]);
    out.push(idx);
  }
  return out;
}
/** 轉動編號陣列 → 記號字串陣列（ASCII '） */
function moveNames(moves) { return Array.prototype.map.call(moves, function (m) { return MOVE_NAMES[m]; }); }
/** 轉動編號陣列 → 以空白分隔的記號字串 */
function formatAlg(moves) { return moveNames(moves).join(' '); }
/** QTM 長度 */
function qtmLength(moves) {
  var s = 0;
  for (var i = 0; i < moves.length; i++) s += QTM_COST[moves[i]];
  return s;
}
/** 反序列 */
function invertAlg(moves) {
  var out = [];
  for (var i = moves.length - 1; i >= 0; i--) {
    var m = moves[i];
    out.push(m - (m % 3) + (2 - (m % 3)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. 可設 seed 的亂數（xorshift32，與 src/engine/rng.js 相同演算法；不使用內建亂數）與隨機狀態
// ---------------------------------------------------------------------------
/** 建立 xorshift32 亂數產生器；seed 為 0 時改用固定種子 0x9e3779b9 */
function makeRng(seed) {
  var s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function randInt(rng, n) { return Math.floor(rng() * n); }
function shuffle(rng, arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = randInt(rng, i + 1);
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
}
/** 均勻隨機合法狀態（random-state）；亂數只來自傳入的 rng，呼叫次數與 spike 相同 */
function randomCube(rng) {
  var c = newCube(), i, s = 0;
  shuffle(rng, c.cp); shuffle(rng, c.ep);
  if (permParity(c.cp, 8) !== permParity(c.ep, 12)) { var t = c.ep[0]; c.ep[0] = c.ep[1]; c.ep[1] = t; }
  for (i = 0; i < 7; i++) { c.co[i] = randInt(rng, 3); s += c.co[i]; }
  c.co[7] = (3 - s % 3) % 3;
  s = 0;
  for (i = 0; i < 11; i++) { c.eo[i] = randInt(rng, 2); s += c.eo[i]; }
  c.eo[11] = s & 1;
  return c;
}

// ---------------------------------------------------------------------------
// 4. 座標
// ---------------------------------------------------------------------------
var N_TWIST = 2187, N_FLIP = 2048, N_SLICE = 495, N_PERM8 = 40320, N_PERM4 = 24;
var BINOM = [];
for (var bn = 0; bn <= 12; bn++) {
  BINOM.push([]);
  for (var bk = 0; bk <= 12; bk++) {
    BINOM[bn].push(bk > bn ? 0 : (bk === 0 || bk === bn) ? 1 : BINOM[bn - 1][bk - 1] + BINOM[bn - 1][bk]);
  }
}
function getTwist(c) { var t = 0; for (var i = 0; i < 7; i++) t = t * 3 + c.co[i]; return t; }
function setTwist(c, t) {
  var s = 0;
  for (var i = 6; i >= 0; i--) { c.co[i] = t % 3; s += c.co[i]; t = (t / 3) | 0; }
  c.co[7] = (3 - s % 3) % 3;
}
function getFlip(c) { var t = 0; for (var i = 0; i < 11; i++) t = t * 2 + c.eo[i]; return t; }
function setFlip(c, t) {
  var s = 0;
  for (var i = 10; i >= 0; i--) { c.eo[i] = t & 1; s += c.eo[i]; t >>= 1; }
  c.eo[11] = s & 1;
}
// 中層（UD-slice）四塊邊（編號 8..11）所在位置集合的組合編號 0..494
function getSlice(c) {
  var r = 0, k = 0;
  for (var i = 0; i < 12; i++) if (c.ep[i] >= 8) { k++; r += BINOM[i][k]; }
  return r;
}
function setSlice(c, r) {
  var occ = new Int8Array(12);
  for (var k = 4; k >= 1; k--) {
    var p = k - 1;
    while (p + 1 <= 11 && BINOM[p + 1][k] <= r) p++;
    r -= BINOM[p][k];
    occ[p] = 1;
  }
  var a = 8, b = 0;
  for (var i = 0; i < 12; i++) c.ep[i] = occ[i] ? a++ : b++;
}
// 排列的 Lehmer 編碼（arr[off..off+n-1]）
function permRank(arr, off, n) {
  var r = 0;
  for (var i = 0; i < n; i++) {
    var cnt = 0, v = arr[off + i];
    for (var j = i + 1; j < n; j++) if (arr[off + j] < v) cnt++;
    r = r * (n - i) + cnt;
  }
  return r;
}
function permUnrank(r, arr, off, n, base) {
  var digits = [], avail = [], i;
  for (i = n - 1; i >= 0; i--) { digits[i] = r % (n - i); r = Math.floor(r / (n - i)); }
  for (i = 0; i < n; i++) avail.push(base + i);
  for (i = 0; i < n; i++) arr[off + i] = avail.splice(digits[i], 1)[0];
}
var SLICE_SOLVED = getSlice(newCube());

// 第二階段可用的 10 個轉動：U U2 U' D D2 D' R2 L2 F2 B2
var P2_MOVES = [0, 1, 2, 9, 10, 11, 4, 13, 7, 16];
var IS_P2_MOVE = new Uint8Array(N_MOVES);
P2_MOVES.forEach(function (m) { IS_P2_MOVE[m] = 1; });

// 冗餘剪枝：ALLOW[prev+1][m]；同面不連續；同軸（對面）只允許固定順序
var ALLOW = [];
(function () {
  for (var pv = -1; pv < N_MOVES; pv++) {
    var row = new Uint8Array(N_MOVES);
    for (var m = 0; m < N_MOVES; m++) {
      if (pv < 0) { row[m] = 1; continue; }
      var f = (m / 3) | 0, pf = (pv / 3) | 0;
      row[m] = (f === pf || (f % 3 === pf % 3 && f < pf)) ? 0 : 1;
    }
    ALLOW.push(row);
  }
})();

// ---------------------------------------------------------------------------
// 5. 移動表與剪枝表
// ---------------------------------------------------------------------------
// 模組內唯一的可變狀態：建好的表（建一次、之後唯讀；不影響求解結果的決定性）
var T = { twistMove: null, flipMove: null, sliceMove: null, cpMove: null, epMove: null, spMove: null, qtm: null };

function buildMoveTables() {
  var a = newCube(), b = newCube(), m, x, t;
  var twistMove = new Uint16Array(N_TWIST * N_MOVES);
  for (t = 0; t < N_TWIST; t++) {
    setTwist(a, t);
    for (m = 0; m < N_MOVES; m++) { cornerMul(a, MOVE_CUBE[m], b); twistMove[t * N_MOVES + m] = getTwist(b); }
  }
  var flipMove = new Uint16Array(N_FLIP * N_MOVES);
  a = newCube();
  for (t = 0; t < N_FLIP; t++) {
    setFlip(a, t);
    for (m = 0; m < N_MOVES; m++) { edgeMul(a, MOVE_CUBE[m], b); flipMove[t * N_MOVES + m] = getFlip(b); }
  }
  var sliceMove = new Uint16Array(N_SLICE * N_MOVES);
  a = newCube();
  for (t = 0; t < N_SLICE; t++) {
    setSlice(a, t);
    for (m = 0; m < N_MOVES; m++) { edgeMul(a, MOVE_CUBE[m], b); sliceMove[t * N_MOVES + m] = getSlice(b); }
  }
  var cpMove = new Uint16Array(N_PERM8 * N_MOVES);
  a = newCube();
  for (t = 0; t < N_PERM8; t++) {
    permUnrank(t, a.cp, 0, 8, 0);
    for (m = 0; m < N_MOVES; m++) { cornerMul(a, MOVE_CUBE[m], b); cpMove[t * N_MOVES + m] = permRank(b.cp, 0, 8); }
  }
  var epMove = new Uint16Array(N_PERM8 * 10);
  a = newCube();
  for (t = 0; t < N_PERM8; t++) {
    permUnrank(t, a.ep, 0, 8, 0);
    for (x = 0; x < 10; x++) { edgeMul(a, MOVE_CUBE[P2_MOVES[x]], b); epMove[t * 10 + x] = permRank(b.ep, 0, 8); }
  }
  var spMove = new Uint8Array(N_PERM4 * 10);
  a = newCube();
  for (t = 0; t < N_PERM4; t++) {
    permUnrank(t, a.ep, 8, 4, 8);
    for (x = 0; x < 10; x++) { edgeMul(a, MOVE_CUBE[P2_MOVES[x]], b); spMove[t * 10 + x] = permRank(b.ep, 8, 4); }
  }
  T.twistMove = twistMove; T.flipMove = flipMove; T.sliceMove = sliceMove;
  T.cpMove = cpMove; T.epMove = epMove; T.spMove = spMove;
}

/**
 * 加權 BFS（成本 1 或 2）建剪枝表。表索引 = a*n2 + b。
 * mv1/mv2：移動表；s1/s2：該表每列欄數；cols1/cols2：第 k 個轉動在該表的欄位；cost[k]：成本。
 */
function buildPrune(n1, n2, mv1, s1, cols1, mv2, s2, cols2, cost, start) {
  var total = n1 * n2;
  var tab = new Int8Array(total).fill(-1);
  var nk = cols1.length;
  tab[start] = 0;
  var filled = 1, depth = 0;
  while (filled < total) {
    var changed = false;
    for (var a = 0; a < n1; a++) {
      var base = a * n2;
      for (var b = 0; b < n2; b++) {
        if (tab[base + b] !== depth) continue;
        for (var k = 0; k < nk; k++) {
          var j = mv1[a * s1 + cols1[k]] * n2 + mv2[b * s2 + cols2[k]];
          var nd = depth + cost[k];
          var cur = tab[j];
          if (cur === -1) { tab[j] = nd; filled++; changed = true; }
          else if (cur > nd) { tab[j] = nd; changed = true; }
        }
      }
    }
    depth++;
    if (!changed && depth > 40) throw new Error('twophase：剪枝表無法填滿');
  }
  return tab;
}

function seq(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }

// init 的進度標籤（順序固定，game-spec.md §7.2）
var PROGRESS_LABELS = ['moveTables', 'p1TS', 'p1FS', 'p2CS', 'p2ES', 'p1TF'];

function checkInitOptions(options) {
  var o = options || {};
  var metrics = o.metrics === undefined ? ['qtm'] : o.metrics;
  if (!Array.isArray(metrics) || metrics.length !== 1 || metrics[0] !== 'qtm') {
    throw new Error('twophase.init：只支援 metrics:[\'qtm\']');
  }
  if (o.twistFlip !== undefined && o.twistFlip !== true) {
    throw new Error('twophase.init：只支援 twistFlip:true');
  }
  if (o.cornerTable !== undefined && o.cornerTable !== false) {
    throw new Error('twophase.init：只支援 cornerTable:false（v0.1 不做最少步搜尋）');
  }
}

/**
 * 建表（只建 QTM 成本所需的表）。重複呼叫不會重建，但仍會依序回報 6 次進度。
 * @param {{metrics?:string[], twistFlip?:boolean, cornerTable?:boolean}} [options] - 只接受 {metrics:['qtm'], twistFlip:true, cornerTable:false}
 * @param {(step:number, total:number, label:string) => void} [onProgress] - 每完成一步呼叫一次；label 依序為
 *   'moveTables','p1TS','p1FS','p2CS','p2ES','p1TF'，total 為 6
 * @returns {{moveBytes:number, pruneBytes:number, totalBytes:number}} 同 tableInfo()
 */
function init(options, onProgress) {
  checkInitOptions(options);
  var total = PROGRESS_LABELS.length;
  var step = 0;
  function report() {
    step++;
    if (typeof onProgress === 'function') onProgress(step, total, PROGRESS_LABELS[step - 1]);
  }
  if (!T.twistMove) buildMoveTables();
  report();
  var M = T.qtm || { cost: QTM_COST, p1TS: null, p1FS: null, p2CS: null, p2ES: null, p1TF: null };
  var all18 = seq(N_MOVES), p2idx = seq(10);
  var cost18 = Array.prototype.slice.call(QTM_COST);
  var cost10 = P2_MOVES.map(function (m) { return QTM_COST[m]; });
  if (!M.p1TS) M.p1TS = buildPrune(N_TWIST, N_SLICE, T.twistMove, N_MOVES, all18, T.sliceMove, N_MOVES, all18, cost18, SLICE_SOLVED);
  report();
  if (!M.p1FS) M.p1FS = buildPrune(N_FLIP, N_SLICE, T.flipMove, N_MOVES, all18, T.sliceMove, N_MOVES, all18, cost18, SLICE_SOLVED);
  report();
  if (!M.p2CS) M.p2CS = buildPrune(N_PERM8, N_PERM4, T.cpMove, N_MOVES, P2_MOVES, T.spMove, 10, p2idx, cost10, 0);
  report();
  if (!M.p2ES) M.p2ES = buildPrune(N_PERM8, N_PERM4, T.epMove, 10, p2idx, T.spMove, 10, p2idx, cost10, 0);
  report();
  if (!M.p1TF) M.p1TF = buildPrune(N_TWIST, N_FLIP, T.twistMove, N_MOVES, all18, T.flipMove, N_MOVES, all18, cost18, 0);
  T.qtm = M;
  report();
  return tableInfo();
}

/**
 * 已建立的型別陣列大小（bytes）。尚未 init 時各欄為 0。
 * @returns {{moveBytes:number, pruneBytes:number, totalBytes:number}}
 */
function tableInfo() {
  var moveBytes = 0, pruneBytes = 0;
  ['twistMove', 'flipMove', 'sliceMove', 'cpMove', 'epMove', 'spMove'].forEach(function (k) {
    if (T[k]) moveBytes += T[k].byteLength;
  });
  if (T.qtm) {
    ['p1TS', 'p1FS', 'p1TF', 'p2CS', 'p2ES'].forEach(function (k) {
      if (T.qtm[k]) pruneBytes += T.qtm[k].byteLength;
    });
  }
  return { moveBytes: moveBytes, pruneBytes: pruneBytes, totalBytes: moveBytes + pruneBytes };
}

function isReady() {
  return !!(T.qtm && T.qtm.p1TS && T.qtm.p1FS && T.qtm.p1TF && T.qtm.p2CS && T.qtm.p2ES);
}

// ---------------------------------------------------------------------------
// 6. 兩階段搜尋（只以節點數停止）
// ---------------------------------------------------------------------------

function pickLimit(v, dflt) {
  return (typeof v === 'number' && v >= 0) ? v : dflt;
}

/**
 * 一輪兩階段 IDA* 搜尋（第二階段深度上限 p2cap）。
 * nodeStart：本輪開始時已累計的節點數（phase2Cap 重搜時延續計數，使 nodeLimit 為整次求解的累計值）。
 * 回傳 {moves|null, nodes, aborted, firstNodes}
 */
function searchOnce(cube, cfg, p2cap, nodeStart) {
  var M = T.qtm;
  var cost = QTM_COST;
  var maxLength = cfg.maxLength;
  var nodeLimit = cfg.nodeLimit, firstNodeLimit = cfg.firstNodeLimit;
  var p1TS = M.p1TS, p1FS = M.p1FS, p1TF = M.p1TF, p2CS = M.p2CS, p2ES = M.p2ES;
  var twistMove = T.twistMove, flipMove = T.flipMove, sliceMove = T.sliceMove;
  var cpMove = T.cpMove, epMove = T.epMove, spMove = T.spMove;

  var best = maxLength + 1, bestMoves = null, firstNodes = -1;
  var nodes = nodeStart, aborted = false;
  var path1 = new Int8Array(64), path2 = new Int8Array(64), p2len = 0;
  var work = newCube(), tmp = newCube();

  // 停止條件（每 CHECK_MASK+1 個節點檢查一次）：
  //   尚未找到解：累計節點 > firstNodeLimit → 中止（呼叫端回 NODE_LIMIT）
  //   已找到解：累計節點 > nodeLimit → 中止，回傳目前最佳解
  function shouldStop() {
    if (bestMoves === null) return nodes > firstNodeLimit;
    return nodes > nodeLimit;
  }

  function p2(cp, ep, sp, g, bound, k, prev) {
    if ((++nodes & CHECK_MASK) === 0 && shouldStop()) { aborted = true; return false; }
    var h = p2CS[cp * 24 + sp], h2 = p2ES[ep * 24 + sp];
    if (h2 > h) h = h2;
    if (h === 0) { p2len = k; return true; }
    if (h > bound - g) return false;
    var allow = ALLOW[prev + 1];
    for (var x = 0; x < 10; x++) {
      var m = P2_MOVES[x];
      if (!allow[m]) continue;
      var ng = g + cost[m];
      if (ng > bound) continue;
      path2[k] = m;
      if (p2(cpMove[cp * 18 + m], epMove[ep * 10 + x], spMove[sp * 10 + x], ng, bound, k + 1, m)) return true;
      if (aborted) return false;
    }
    return false;
  }

  function tryPhase2(g, n) {
    copyCube(cube, work);
    for (var i = 0; i < n; i++) {
      cornerMul(work, MOVE_CUBE[path1[i]], tmp); edgeMul(work, MOVE_CUBE[path1[i]], tmp);
      var t = work; work = tmp; tmp = t;
    }
    var cp = permRank(work.cp, 0, 8), ep = permRank(work.ep, 0, 8), sp = permRank(work.ep, 8, 4);
    var budget = Math.min(best - 1 - g, p2cap);
    var h = p2CS[cp * 24 + sp], h2 = p2ES[ep * 24 + sp];
    if (h2 > h) h = h2;
    if (h > budget) return;
    var prev = n > 0 ? path1[n - 1] : -1;
    for (var b = h; b <= budget; b++) {
      if (p2(cp, ep, sp, 0, b, 0, prev)) {
        var moves = [];
        for (var a = 0; a < n; a++) moves.push(path1[a]);
        for (var c = 0; c < p2len; c++) moves.push(path2[c]);
        var len = qtmLength(moves);
        if (len < best) {
          if (bestMoves === null) firstNodes = nodes;
          best = len; bestMoves = moves;
        }
        return;
      }
      if (aborted) return;
    }
  }

  function p1(tw, fl, sl, g, bound, n) {
    if ((++nodes & CHECK_MASK) === 0 && shouldStop()) { aborted = true; return; }
    var h = p1TS[tw * 495 + sl], hh = p1FS[fl * 495 + sl];
    if (hh > h) h = hh;
    hh = p1TF[tw * 2048 + fl];
    if (hh > h) h = hh;
    if (h > bound - g) return;
    if (g === bound) {
      // 已進入 G1；最後一步若本身是 G1 轉動，代表有更短的第一階段，略過
      if (n > 0 && IS_P2_MOVE[path1[n - 1]]) return;
      tryPhase2(g, n);
      return;
    }
    var allow = ALLOW[n > 0 ? path1[n - 1] + 1 : 0];
    for (var m = 0; m < 18; m++) {
      if (!allow[m]) continue;
      var ng = g + cost[m];
      if (ng > bound) continue;
      path1[n] = m;
      p1(twistMove[tw * 18 + m], flipMove[fl * 18 + m], sliceMove[sl * 18 + m], ng, bound, n + 1);
      if (aborted || bound >= best) return;
    }
  }

  var tw0 = getTwist(cube), fl0 = getFlip(cube), sl0 = getSlice(cube);
  var h0 = Math.max(p1TS[tw0 * 495 + sl0], p1FS[fl0 * 495 + sl0], p1TF[tw0 * 2048 + fl0]);
  for (var bound = h0; bound < best && bound <= maxLength; bound++) {
    p1(tw0, fl0, sl0, 0, bound, 0);
    if (aborted) break;
  }
  return { moves: bestMoves, nodes: nodes, aborted: aborted, firstNodes: firstNodes };
}

/**
 * 以 QTM 成本求建議解（不保證最少步；畫面只能稱「建議解」）。
 * 純函數：不讀時鐘、不用亂數；同一狀態＋同一 opts 必得同一結果（需先 init）。
 *
 * @param {Object} cube - cubie 狀態 {cp, co, ep, eo}（不會被修改）
 * @param {Object} [opts]
 * @param {string} [opts.metric='qtm'] - 只支援 'qtm'
 * @param {number} [opts.nodeLimit] - 整次求解累計節點上限（含找到第一組解之前）；找到第一組解後超過即停，回傳目前最佳解
 * @param {number} [opts.firstNodeLimit] - 找到第一組解之前的節點上限；超過回 {error:'NODE_LIMIT'}
 * @param {number} [opts.maxLength] - 可接受的最長解（QTM）
 * @param {number} [opts.phase2Cap] - 第二階段深度上限；因此無解時自動以 36 重搜
 *   （以上四個數值未傳時使用 DEFAULT_SOLVE_OPTS；正式呼叫端應傳入 params.solver）
 * @returns {{moves:number[], names:string[], alg:string, qtm:number, nodes:number, complete:boolean,
 *            firstNodes:number, fallback:boolean} | {error:string, nodes:number}}
 *   complete=true 表示在 maxLength 內已窮盡兩階段搜尋（不代表全域最少步）。
 *   error：verify() 的錯誤碼、'NODE_LIMIT'、'NO_SOLUTION'、'UNSUPPORTED_METRIC'、'NOT_INITIALIZED'
 */
function solve(cube, opts) {
  opts = opts || {};
  var metric = opts.metric === undefined ? DEFAULT_SOLVE_OPTS.metric : opts.metric;
  if (metric !== 'qtm') return { error: 'UNSUPPORTED_METRIC', nodes: 0 };
  if (!isReady()) return { error: 'NOT_INITIALIZED', nodes: 0 };
  var err = verify(cube);
  if (err) return { error: err, nodes: 0 };
  var cfg = {
    nodeLimit: pickLimit(opts.nodeLimit, DEFAULT_SOLVE_OPTS.nodeLimit),
    firstNodeLimit: pickLimit(opts.firstNodeLimit, DEFAULT_SOLVE_OPTS.firstNodeLimit),
    maxLength: pickLimit(opts.maxLength, DEFAULT_SOLVE_OPTS.maxLength)
  };
  var p2cap = pickLimit(opts.phase2Cap, DEFAULT_SOLVE_OPTS.phase2Cap);

  var r = searchOnce(cube, cfg, p2cap, 0);
  var fallback = false;
  // 第二階段上限太小導致無解（且不是因節點上限中止）→ 以理論上限重搜，節點數延續累計
  if (!r.moves && !r.aborted && p2cap < PHASE2_FULL) {
    r = searchOnce(cube, cfg, PHASE2_FULL, r.nodes);
    fallback = true;
  }
  if (!r.moves) return { error: r.aborted ? 'NODE_LIMIT' : 'NO_SOLUTION', nodes: r.nodes };
  var names = moveNames(r.moves);
  return {
    moves: r.moves,
    names: names,
    alg: names.join(' '),
    qtm: qtmLength(r.moves),
    nodes: r.nodes,
    complete: !r.aborted,
    firstNodes: r.firstNodes,
    fallback: fallback
  };
}

module.exports = {
  // game-spec.md §7.2 介面
  init: init,
  tableInfo: tableInfo,
  solve: solve,
  fromStickerColors: fromStickerColors,
  // 分派單 S4 指定的附加匯出（測試與層先法對照用）
  verify: verify,
  faceletsToCubie: faceletsToCubie,
  cubieToFacelets: cubieToFacelets,
  applyMoveFacelets: applyMoveFacelets,
  applyMoves: applyMoves,
  isSolved: isSolved,
  newCube: newCube,
  randomCube: randomCube,
  makeRng: makeRng,
  MOVE_NAMES: MOVE_NAMES,
  qtmLength: qtmLength,
  // 其他輔助（測試用）
  DEFAULT_SOLVE_OPTS: DEFAULT_SOLVE_OPTS,
  PROGRESS_LABELS: PROGRESS_LABELS,
  FACES: FACES,
  SOLVED_FACELETS: SOLVED_FACELETS,
  CORNER_NAMES: CORNER_NAMES,
  EDGE_NAMES: EDGE_NAMES,
  QTM_COST: QTM_COST,
  MOVE_CUBE: MOVE_CUBE,
  applyMove: applyMove,
  multiply: multiply,
  copyCube: copyCube,
  cubeEquals: cubeEquals,
  parseAlg: parseAlg,
  formatAlg: formatAlg,
  invertAlg: invertAlg,
  isReady: isReady
};
