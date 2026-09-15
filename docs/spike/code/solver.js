/*
 * 三階魔術方塊：自寫兩階段求解器（spike，clean-room）
 *
 * 依據：只參考公開的演算法說明文件（kociemba.org 兩階段法說明、Wikipedia），
 * 未開啟、複製或改寫任何第三方求解器原始碼。
 *
 * 限制：ES2017 以內、零依賴；同一份檔案可在 Node（require）與瀏覽器／Web Worker（全域 CubeSolver）執行。
 *
 * 名詞：
 *   - 面序 URFDLB（0..5）；轉動編號 m = 3*面 + (次方-1)，次方 1=順時針 90°、2=180°、3=逆時針 90°。
 *   - 角塊位置 URF UFL ULB UBR DFR DLF DBL DRB；邊塊位置 UR UF UL UB DR DF DL DB FR FL BL BR。
 *   - cubie 表示法為「位置 i 上放的是哪一塊（cp/ep）以及它的方向（co/eo）」。
 *   - 54 格貼紙字串：U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9，每格填所屬面的字母。
 *   - HTM：每個外層轉動（含 180°）算 1 步；QTM：90° 算 1 步、180° 算 2 步。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CubeSolver = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var now = (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  var FACES = 'URFDLB';
  var N_MOVES = 18;
  var MOVE_NAMES = [];
  (function () {
    var suffix = ['', '2', "'"];
    for (var f = 0; f < 6; f++) for (var p = 0; p < 3; p++) MOVE_NAMES.push(FACES[f] + suffix[p]);
  })();
  var QTM_COST = new Int8Array(N_MOVES);
  var HTM_COST = new Int8Array(N_MOVES);
  for (var mi = 0; mi < N_MOVES; mi++) { HTM_COST[mi] = 1; QTM_COST[mi] = (mi % 3 === 1) ? 2 : 1; }

  // ---------------------------------------------------------------------------
  // 1. 貼紙幾何：用 3D 座標推導 54 格的位置與轉動，避免手抄轉動表出錯
  //    座標軸：x 向右（R）、y 向上（U）、z 向前（F）
  // ---------------------------------------------------------------------------
  var NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
  // 每面展開圖的左上角座標、向右方向、向下方向（標準十字展開）
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
      for (var row = 0; row < 3; row++) for (var col = 0; col < 3; col++) {
        STICKER_POS.push([g.tl[0] + col * g.r[0] + row * g.d[0], g.tl[1] + col * g.r[1] + row * g.d[1], g.tl[2] + col * g.r[2] + row * g.d[2]]);
        STICKER_NRM.push(NORMAL[FACES[f]]);
      }
    }
  })();
  function vecEq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function stickerIndex(pos, nrm) {
    for (var i = 0; i < 54; i++) if (vecEq(STICKER_POS[i], pos) && vecEq(STICKER_NRM[i], nrm)) return i;
    throw new Error('找不到貼紙');
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

  /** 在貼紙層級套用一個轉動（測試與對照用）。s 可為字串或陣列，回傳同型別。 */
  function applyMoveFacelets(s, m) {
    var arr = typeof s === 'string' ? s.split('') : s.slice();
    var f = (m / 3) | 0, pw = (m % 3) + 1;
    for (var k = 0; k < pw; k++) {
      var out = new Array(54);
      for (var i = 0; i < 54; i++) out[FACE_PERM[f][i]] = arr[i];
      arr = out;
    }
    return typeof s === 'string' ? arr.join('') : arr;
  }

  // ---------------------------------------------------------------------------
  // 2. cubie 表示法與貼紙互轉
  // ---------------------------------------------------------------------------
  var CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  var EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
  function cubiePos(name) {
    var p = [0, 0, 0];
    for (var k = 0; k < name.length; k++) { var n = NORMAL[name[k]]; p[0] += n[0]; p[1] += n[1]; p[2] += n[2]; }
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
  function multiply(a, b) {
    var out = newCube();
    cornerMul(a, b, out); edgeMul(a, b, out);
    return out;
  }

  /**
   * 54 格字母字串 → cubie。字母代表「這格的顏色屬於哪一面的中心」。
   * 回傳 { cube } 或 { error }（錯誤碼字串）。只做「能不能辨認出方塊」的檢查，合法性另由 verify() 判斷。
   */
  function faceletsToCubie(s) {
    if (typeof s !== 'string' || s.length !== 54) return { error: 'LENGTH' };
    var count = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
    for (var i = 0; i < 54; i++) {
      if (!(s[i] in count)) return { error: 'BAD_COLOR' };
      count[s[i]]++;
    }
    for (var f = 0; f < 6; f++) {
      if (s[9 * f + 4] !== FACES[f]) return { error: 'CENTER' };
      if (count[FACES[f]] !== 9) return { error: 'COLOR_COUNT' };
    }
    var c = newCube();
    for (var p = 0; p < 8; p++) {
      var fl = CORNER_FACELET[p], o = -1;
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

  /** 狀態合法性檢查；合法回傳 null，否則回傳錯誤碼。 */
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
   * 從貼紙顏色建立狀態（給 UI 用）。
   * colors：長度 54 的陣列，順序同 54 格字串（URFDLB，每面由左上到右下），值可為任意可比較的顏色標籤（如 'white'）。
   * 以六個中心格的顏色決定「哪個顏色屬於哪一面」。
   * 回傳 { ok:true, cube, facelets } 或 { ok:false, error }。
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
      if (r.error) throw new Error('轉動推導失敗：' + MOVE_NAMES[m]);
      MOVE_CUBE.push(r.cube);
    }
  })();

  function applyMove(c, m) { return multiply(c, MOVE_CUBE[m]); }
  function applyMoves(c, moves) {
    var cur = copyCube(c), tmp = newCube();
    for (var i = 0; i < moves.length; i++) {
      cornerMul(cur, MOVE_CUBE[moves[i]], tmp); edgeMul(cur, MOVE_CUBE[moves[i]], tmp);
      var t = cur; cur = tmp; tmp = t;
    }
    return cur;
  }
  function parseAlg(str) {
    var out = [];
    var toks = String(str).trim().split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      if (!toks[i]) continue;
      var idx = MOVE_NAMES.indexOf(toks[i].replace('’', "'"));
      if (idx < 0) throw new Error('無法解析轉動：' + toks[i]);
      out.push(idx);
    }
    return out;
  }
  function formatAlg(moves) { return Array.prototype.map.call(moves, function (m) { return MOVE_NAMES[m]; }).join(' '); }
  function htmLength(moves) { return moves.length; }
  function qtmLength(moves) { var s = 0; for (var i = 0; i < moves.length; i++) s += QTM_COST[moves[i]]; return s; }
  function invertAlg(moves) {
    var out = [];
    for (var i = moves.length - 1; i >= 0; i--) { var m = moves[i]; out.push(m - (m % 3) + (2 - (m % 3))); }
    return out;
  }

  // ---------------------------------------------------------------------------
  // 3. 可設 seed 的亂數（xorshift32；不使用 Math.random）與隨機狀態
  // ---------------------------------------------------------------------------
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
    for (var i = arr.length - 1; i > 0; i--) { var j = randInt(rng, i + 1); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  }
  /** 均勻隨機合法狀態（random-state） */
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
    for (var bk = 0; bk <= 12; bk++) BINOM[bn].push(bk > bn ? 0 : (bk === 0 || bk === bn) ? 1 : BINOM[bn - 1][bk - 1] + BINOM[bn - 1][bk]);
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
  function permRank(arr, off, n, base) {
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
  var tmpC = newCube();
  tmpC.ep.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  var SLICE_SOLVED = getSlice(tmpC);
  function getCornPerm(c) { return permRank(c.cp, 0, 8); }
  function getUDEdgePerm(c) { return permRank(c.ep, 0, 8); }   // 只在 G1 內有意義
  function getSlicePerm(c) { return permRank(c.ep, 8, 4); }    // 只在 G1 內有意義

  // 第二階段可用的 10 個轉動
  var P2_MOVES = [0, 1, 2, 9, 10, 11, 4, 13, 7, 16]; // U U2 U' D D2 D' R2 L2 F2 B2
  var IS_P2_MOVE = new Uint8Array(N_MOVES);
  P2_MOVES.forEach(function (m) { IS_P2_MOVE[m] = 1; });
  var QUARTER_MOVES = [0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17];

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
  var T = { built: false, metrics: {}, timing: {} };

  function buildMoveTables() {
    var t0 = now();
    var a = newCube(), b = newCube(), m, f, p, x, t;
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
    T.timing.moveTablesMs = now() - t0;
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
      if (!changed && depth > 40) throw new Error('剪枝表無法填滿');
    }
    return tab;
  }
  function buildPrune1(n, mv, s, cols, cost, start) { // 單一座標
    var one = new Uint16Array(1 * 1);
    return buildPrune(n, 1, mv, s, cols, one, 1, cols.map(function () { return 0; }), cost, start * 1);
  }

  function seq(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }

  function maxOf(tab) { var mx = 0; for (var i = 0; i < tab.length; i++) if (tab[i] > mx) mx = tab[i]; return mx; }

  /**
   * 建表。options:
   *   metrics: ['htm','qtm'] 要建哪幾種成本的剪枝表
   *   twistFlip: 是否建第三張第一階段表 twist×flip（4,478,976 bytes／每種成本）
   *   cornerTable: 是否建角塊排列全域表（最少步搜尋用，QTM）
   */
  function init(options) {
    options = options || {};
    var metrics = options.metrics || ['htm'];
    var useTF = options.twistFlip !== false;
    if (!T.twistMove) buildMoveTables();
    var all18 = seq(N_MOVES), p2idx = seq(10), zero18 = all18.map(function () { return 0; });
    for (var i = 0; i < metrics.length; i++) {
      var name = metrics[i];
      if (T.metrics[name] && (!useTF || T.metrics[name].p1TF)) continue;
      var cost = name === 'qtm' ? QTM_COST : HTM_COST;
      var cost18 = Array.prototype.slice.call(cost);
      var cost10 = P2_MOVES.map(function (m) { return cost[m]; });
      var M = T.metrics[name] || { name: name, cost: cost };
      var t0 = now();
      if (!M.p1TS) {
        M.p1TS = buildPrune(N_TWIST, N_SLICE, T.twistMove, N_MOVES, all18, T.sliceMove, N_MOVES, all18, cost18, SLICE_SOLVED);
        M.p1FS = buildPrune(N_FLIP, N_SLICE, T.flipMove, N_MOVES, all18, T.sliceMove, N_MOVES, all18, cost18, SLICE_SOLVED);
        var t1 = now();
        T.timing[name + '_p1_TS_FS_Ms'] = t1 - t0;
        M.p2CS = buildPrune(N_PERM8, N_PERM4, T.cpMove, N_MOVES, P2_MOVES, T.spMove, 10, p2idx, cost10, 0);
        M.p2ES = buildPrune(N_PERM8, N_PERM4, T.epMove, 10, p2idx, T.spMove, 10, p2idx, cost10, 0);
        T.timing[name + '_p2_Ms'] = now() - t1;
      }
      if (useTF && !M.p1TF) {
        var t2 = now();
        M.p1TF = buildPrune(N_TWIST, N_FLIP, T.twistMove, N_MOVES, all18, T.flipMove, N_MOVES, all18, cost18, 0);
        T.timing[name + '_p1_TF_Ms'] = now() - t2;
      }
      if (options.cornerTable && !M.cpFull) {
        var t3 = now();
        M.cpFull = buildPrune1(N_PERM8, T.cpMove, N_MOVES, all18, cost18, 0);
        T.timing[name + '_cp_Ms'] = now() - t3;
      }
      T.metrics[name] = M;
    }
    T.built = true;
    return tableInfo();
  }

  function tableInfo() {
    var info = { moveTables: {}, pruneTables: {}, timing: T.timing, maxDepth: {} };
    ['twistMove', 'flipMove', 'sliceMove', 'cpMove', 'epMove', 'spMove'].forEach(function (k) { if (T[k]) info.moveTables[k] = T[k].byteLength; });
    Object.keys(T.metrics).forEach(function (name) {
      var M = T.metrics[name];
      ['p1TS', 'p1FS', 'p1TF', 'p2CS', 'p2ES', 'cpFull'].forEach(function (k) {
        if (M[k]) { info.pruneTables[name + '.' + k] = M[k].byteLength; info.maxDepth[name + '.' + k] = maxOf(M[k]); }
      });
    });
    return info;
  }

  // ---------------------------------------------------------------------------
  // 6. 兩階段搜尋
  // ---------------------------------------------------------------------------
  /**
   * solve(cube, opts)
   *   metric: 'htm'（預設）或 'qtm'：搜尋時的成本與剪枝表
   *   maxLength: 可接受的最長解（以 metric 計），預設 htm 30／qtm 45
   *   targetLength: 找到長度 ≤ 此值即停止（預設 0＝一直改進到時間上限）
   *   timeLimitMs: 找到第一組解後，最多再花多久改進（預設 100）
   *   hardTimeLimitMs: 絕對上限；未找到任何解也停止（預設無）
   *   nodeLimit: 找到第一組解後的節點數上限（不讀時鐘的決定性預算；搭配 timeLimitMs: Infinity 使用；預設無）
   *   phase2Cap: 第二階段深度上限（預設 htm 12／qtm 20；若因此無解，自動以 18／36 重搜）
   * 回傳 { moves, htm, qtm, length, found:[{moves,htm,qtm,atMs}], nodes, timeMs, complete }
   *   complete=true 表示在 maxLength 內已窮盡兩階段搜尋（不代表全域最少步）
   */
  function solve(cube, opts) {
    opts = opts || {};
    var metric = opts.metric || 'htm';
    var M = T.metrics[metric];
    if (!M) throw new Error('尚未為 ' + metric + ' 建表，請先 init()');
    var err = verify(cube);
    if (err) return { error: err };
    var cost = M.cost;
    var maxLength = opts.maxLength != null ? opts.maxLength : (metric === 'htm' ? 30 : 45);
    var target = opts.targetLength || 0;
    var timeLimit = opts.timeLimitMs != null ? opts.timeLimitMs : 100;
    var hardLimit = opts.hardTimeLimitMs != null ? opts.hardTimeLimitMs : Infinity;
    var nodeLimit = opts.nodeLimit != null ? opts.nodeLimit : Infinity;
    // 第二階段深度上限：先用較小上限（量測後選定：HTM 12、QTM 20），找不到解再退回理論上限重搜
    var p2full = metric === 'htm' ? 18 : 36;
    var p2cap = opts.phase2Cap != null ? opts.phase2Cap : (metric === 'htm' ? 12 : 20);
    var p1TS = M.p1TS, p1FS = M.p1FS, p1TF = M.p1TF, p2CS = M.p2CS, p2ES = M.p2ES;
    var twistMove = T.twistMove, flipMove = T.flipMove, sliceMove = T.sliceMove;
    var cpMove = T.cpMove, epMove = T.epMove, spMove = T.spMove;

    var t0 = now();
    var best = maxLength + 1, bestMoves = null, found = [];
    var nodes = 0, aborted = false;
    var path1 = new Int8Array(64), path2 = new Int8Array(64), p2len = 0;
    var work = newCube(), tmp = newCube();

    function checkStop() {
      if (bestMoves !== null && nodes > nodeLimit) return true;
      var el = now() - t0;
      if (el > hardLimit) return true;
      return bestMoves !== null && el > timeLimit;
    }

    function p2(cp, ep, sp, g, bound, k, prev) {
      if ((++nodes & 1023) === 0 && checkStop()) { aborted = true; return false; }
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
          var len = 0;
          for (var d = 0; d < moves.length; d++) len += cost[moves[d]];
          if (len < best) {
            best = len; bestMoves = moves;
            found.push({ moves: moves, htm: moves.length, qtm: qtmLength(moves), atMs: now() - t0 });
          }
          return;
        }
        if (aborted) return;
      }
    }

    function p1(tw, fl, sl, g, bound, n) {
      if ((++nodes & 1023) === 0 && checkStop()) { aborted = true; return; }
      var h = p1TS[tw * 495 + sl], hh = p1FS[fl * 495 + sl];
      if (hh > h) h = hh;
      if (p1TF !== undefined) { hh = p1TF[tw * 2048 + fl]; if (hh > h) h = hh; }
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
        if (aborted || bound >= best || best <= target) return;
      }
    }

    var tw0 = getTwist(cube), fl0 = getFlip(cube), sl0 = getSlice(cube);
    var h0 = Math.max(p1TS[tw0 * 495 + sl0], p1FS[fl0 * 495 + sl0], p1TF ? p1TF[tw0 * 2048 + fl0] : 0);
    for (var bound = h0; bound < best && bound <= maxLength; bound++) {
      p1(tw0, fl0, sl0, 0, bound, 0);
      if (aborted || best <= target) break;
    }
    var timeMs = now() - t0;
    if (!bestMoves && !aborted && p2cap < p2full) {
      var retry = solve(cube, Object.assign({}, opts, {
        phase2Cap: p2full,
        hardTimeLimitMs: hardLimit === Infinity ? Infinity : Math.max(0, hardLimit - timeMs)
      }));
      retry.timeMs += timeMs; retry.nodes += nodes; retry.fallback = true;
      return retry;
    }
    if (!bestMoves) return { error: aborted ? 'TIMEOUT' : 'NO_SOLUTION', nodes: nodes, timeMs: timeMs };
    return {
      moves: bestMoves, alg: formatAlg(bestMoves), htm: bestMoves.length, qtm: qtmLength(bestMoves),
      length: best, found: found, nodes: nodes, timeMs: timeMs, complete: !aborted
    };
  }

  // ---------------------------------------------------------------------------
  // 7. QTM 真正最少步（短打亂用）：IDA*，只用 12 個 90° 轉動
  //    啟發 = 三個軸向（把方塊整顆轉向後）的第一階段 QTM 剪枝表最大值，以及角塊排列 QTM 表
  // ---------------------------------------------------------------------------
  // 整顆轉向：以貼紙幾何推導。ROT_FACE[r][f] = 面 f 轉向後變成的面
  var WHOLE_ROTS = [
    null,                 // 0：不轉
    { axis: [0, 0, 1] },  // 1：繞 F-B 軸，R/L 軸轉到 U/D 位置
    { axis: [1, 0, 0] }   // 2：繞 R-L 軸，F/B 軸轉到 U/D 位置
  ];
  var ROT_FACE = [[0, 1, 2, 3, 4, 5]];
  var ROT_STICKER = [null];
  (function () {
    for (var r = 1; r < WHOLE_ROTS.length; r++) {
      var ax = WHOLE_ROTS[r].axis, fm = [], sm = new Int8Array(54);
      for (var f = 0; f < 6; f++) {
        var nn = rotCw(NORMAL[FACES[f]], ax);
        for (var g = 0; g < 6; g++) if (vecEq(NORMAL[FACES[g]], nn)) fm.push(g);
      }
      for (var i = 0; i < 54; i++) sm[i] = stickerIndex(rotCw(STICKER_POS[i], ax), rotCw(STICKER_NRM[i], ax));
      ROT_FACE.push(fm); ROT_STICKER.push(sm);
    }
  })();
  function rotateMove(r, m) { return 3 * ROT_FACE[r][(m / 3) | 0] + (m % 3); }
  /** 整顆轉向後再依中心重新著色，得到共軛狀態（步數與原狀態相同） */
  function conjugate(c, r) {
    if (r === 0) return copyCube(c);
    var s = cubieToFacelets(c), out = new Array(54);
    for (var i = 0; i < 54; i++) out[ROT_STICKER[r][i]] = s[i];
    var res = fromStickerColors(out);
    if (!res.ok) throw new Error('共軛失敗：' + res.error);
    return res.cube;
  }

  /**
   * solveOptimalQTM(cube, opts)：回傳 QTM 最少步解。
   *   maxDepth（預設 20）、hardTimeLimitMs（預設無）
   * 回傳 { moves, qtm, nodes, timeMs } 或 { error:'TIMEOUT'|'NO_SOLUTION', depthReached }
   */
  function solveOptimalQTM(cube, opts) {
    opts = opts || {};
    var M = T.metrics.qtm;
    if (!M || !M.p1TF || !M.cpFull) throw new Error('請先 init({metrics:[\'qtm\'], twistFlip:true, cornerTable:true})');
    var err = verify(cube);
    if (err) return { error: err };
    var maxDepth = opts.maxDepth != null ? opts.maxDepth : 20;
    var hardLimit = opts.hardTimeLimitMs != null ? opts.hardTimeLimitMs : Infinity;
    var TS = M.p1TS, FS = M.p1FS, TF = M.p1TF, CPF = M.cpFull;
    var twistMove = T.twistMove, flipMove = T.flipMove, sliceMove = T.sliceMove, cpMove = T.cpMove;
    var t0 = now(), nodes = 0, aborted = false;
    // 三個軸向的座標
    var cubes = [0, 1, 2].map(function (r) { return conjugate(cube, r); });
    var tw = cubes.map(getTwist), fl = cubes.map(getFlip), sl = cubes.map(getSlice);
    var cp0 = getCornPerm(cube);
    // RM[r][m]：原轉動 m 在第 r 軸向座標系中對應的轉動
    var RM = [0, 1, 2].map(function (r) { var a = new Int8Array(18); for (var m = 0; m < 18; m++) a[m] = rotateMove(r, m); return a; });
    var RM1 = RM[1], RM2 = RM[2];
    var path = new Int8Array(64), solution = null;

    function hval(t0_, f0, s0, t1, f1, s1, t2, f2, s2, cp) {
      var h = CPF[cp], v;
      v = TS[t0_ * 495 + s0]; if (v > h) h = v;
      v = FS[f0 * 495 + s0]; if (v > h) h = v;
      v = TF[t0_ * 2048 + f0]; if (v > h) h = v;
      v = TS[t1 * 495 + s1]; if (v > h) h = v;
      v = FS[f1 * 495 + s1]; if (v > h) h = v;
      v = TF[t1 * 2048 + f1]; if (v > h) h = v;
      v = TS[t2 * 495 + s2]; if (v > h) h = v;
      v = FS[f2 * 495 + s2]; if (v > h) h = v;
      v = TF[t2 * 2048 + f2]; if (v > h) h = v;
      return h;
    }

    function allowed(m, n) {
      if (n === 0) return true;
      var pm = path[n - 1], f = (m / 3) | 0, pf = (pm / 3) | 0;
      var ppf = n >= 2 ? (path[n - 2] / 3) | 0 : -1;
      if (f === pf) {
        // 只允許 X X（代表 X2），不允許 X X'、X' X'、X X X
        return m === pm && (m % 3) === 0 && ppf !== f;
      }
      if (f % 3 === pf % 3) {
        if (f < pf) return false;
        if (ppf === f) return false;
      }
      return true;
    }

    function dfs(a0, b0, c0, a1, b1, c1, a2, b2, c2, cp, g, bound, n) {
      if ((++nodes & 1023) === 0 && now() - t0 > hardLimit) { aborted = true; return false; }
      var h = hval(a0, b0, c0, a1, b1, c1, a2, b2, c2, cp);
      if (h > bound - g) return false;
      if (h === 0 && g === bound) {
        var moves = Array.prototype.slice.call(path, 0, n);
        if (isSolved(applyMoves(cube, moves))) { solution = moves; return true; }
        return false;
      }
      if (g === bound) return false;
      for (var q = 0; q < 12; q++) {
        var m = QUARTER_MOVES[q];
        if (!allowed(m, n)) continue;
        path[n] = m;
        var m1 = RM1[m], m2 = RM2[m];
        if (dfs(twistMove[a0 * 18 + m], flipMove[b0 * 18 + m], sliceMove[c0 * 18 + m],
          twistMove[a1 * 18 + m1], flipMove[b1 * 18 + m1], sliceMove[c1 * 18 + m1],
          twistMove[a2 * 18 + m2], flipMove[b2 * 18 + m2], sliceMove[c2 * 18 + m2],
          cpMove[cp * 18 + m], g + 1, bound, n + 1)) return true;
        if (aborted) return false;
      }
      return false;
    }

    if (isSolved(cube)) return { moves: [], qtm: 0, nodes: 0, timeMs: now() - t0 };
    var h0 = hval(tw[0], fl[0], sl[0], tw[1], fl[1], sl[1], tw[2], fl[2], sl[2], cp0);
    var depthReached = h0 - 1;
    for (var bound = Math.max(h0, 1); bound <= maxDepth; bound++) {
      if (dfs(tw[0], fl[0], sl[0], tw[1], fl[1], sl[1], tw[2], fl[2], sl[2], cp0, 0, bound, 0)) break;
      if (aborted) break;
      depthReached = bound;
    }
    var timeMs = now() - t0;
    if (!solution) return { error: aborted ? 'TIMEOUT' : 'NO_SOLUTION', depthReached: depthReached, nodes: nodes, timeMs: timeMs };
    return { moves: solution, alg: formatAlg(solution), qtm: solution.length, nodes: nodes, timeMs: timeMs };
  }

  /** 以 12 個 90° 轉動產生長度 n 的打亂（避開明顯抵銷），回傳轉動陣列 */
  function randomQuarterScramble(rng, n) {
    var out = [];
    while (out.length < n) {
      var m = QUARTER_MOVES[randInt(rng, 12)];
      var k = out.length;
      if (k > 0) {
        var pm = out[k - 1], f = (m / 3) | 0, pf = (pm / 3) | 0;
        if (f === pf && m !== pm) continue;                            // X X'
        if (f === pf && k >= 2 && ((out[k - 2] / 3) | 0) === f) continue; // X X X
        if (f % 3 === pf % 3 && f !== pf && k >= 2 && ((out[k - 2] / 3) | 0) === f) continue; // X Y X（對面）
      }
      out.push(m);
    }
    return out;
  }

  return {
    FACES: FACES, MOVE_NAMES: MOVE_NAMES, SOLVED_FACELETS: SOLVED_FACELETS,
    CORNER_NAMES: CORNER_NAMES, EDGE_NAMES: EDGE_NAMES, CORNER_FACELET: CORNER_FACELET, EDGE_FACELET: EDGE_FACELET,
    STICKER_POS: STICKER_POS, STICKER_NRM: STICKER_NRM, MOVE_CUBE: MOVE_CUBE, QTM_COST: QTM_COST,
    newCube: newCube, copyCube: copyCube, cubeEquals: cubeEquals, isSolved: isSolved, multiply: multiply,
    applyMove: applyMove, applyMoves: applyMoves, applyMoveFacelets: applyMoveFacelets,
    faceletsToCubie: faceletsToCubie, cubieToFacelets: cubieToFacelets, fromStickerColors: fromStickerColors,
    verify: verify, parseAlg: parseAlg, formatAlg: formatAlg, invertAlg: invertAlg,
    htmLength: htmLength, qtmLength: qtmLength,
    makeRng: makeRng, randomCube: randomCube, randomQuarterScramble: randomQuarterScramble,
    getTwist: getTwist, getFlip: getFlip, getSlice: getSlice, getCornPerm: getCornPerm,
    getUDEdgePerm: getUDEdgePerm, getSlicePerm: getSlicePerm, SLICE_SOLVED: SLICE_SOLVED,
    conjugate: conjugate, rotateMove: rotateMove,
    init: init, tableInfo: tableInfo, solve: solve, solveOptimalQTM: solveOptimalQTM
  };
});
