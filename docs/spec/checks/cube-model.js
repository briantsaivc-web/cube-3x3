// G3 驗證用：貼紙層級方塊模型（外層 18＋中層 9＋整顆 9 轉動、24 種朝向、手勢對應）。
// 只供 G3 規格驗證，非產品程式；G4 需依規格重寫並補測試。
'use strict';
const S = require('../../spike/code/solver.js');
const POS = S.STICKER_POS, NRM = S.STICKER_NRM;
const FACES = 'URFDLB';
const N = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const neg = a => [-a[0], -a[1], -a[2]];
function idx(p, n) { for (let i = 0; i < 54; i++) if (eq(POS[i], p) && eq(NRM[i], n)) return i; throw new Error('no sticker'); }
function rotCw(v, a) { const c = cross(a, v), d = dot(a, v); return [-c[0] + a[0] * d, -c[1] + a[1] * d, -c[2] + a[2] * d]; }
// 基本轉動定義：軸（順時針＝從軸尖端往回看順時針）與層（p·軸 的值）
const BASE = {
  U: [N.U, [1]], R: [N.R, [1]], F: [N.F, [1]], D: [N.D, [1]], L: [N.L, [1]], B: [N.B, [1]],
  M: [N.L, [0]], E: [N.D, [0]], S: [N.F, [0]],          // 慣例：M 同 L、E 同 D、S 同 F
  x: [N.R, [-1, 0, 1]], y: [N.U, [-1, 0, 1]], z: [N.F, [-1, 0, 1]]  // 慣例：x 同 R、y 同 U、z 同 F
};
function quarterPerm(axis, layers) {
  const p = new Array(54);
  for (let i = 0; i < 54; i++) {
    p[i] = layers.includes(dot(POS[i], axis)) ? idx(rotCw(POS[i], axis), rotCw(NRM[i], axis)) : i;
  }
  return p;
}
const compose = (p, q) => p.map(v => q[v]); // 先 p 再 q：位置 i → p[i] → q[p[i]]
const PERM = {}; const NAMES = [];
for (const b of Object.keys(BASE)) {
  const q = quarterPerm(BASE[b][0], BASE[b][1]);
  PERM[b] = q; PERM[b + '2'] = compose(q, q); PERM[b + "'"] = compose(compose(q, q), q);
  NAMES.push(b, b + '2', b + "'");
}
const KIND = n => ('URFDLB'.includes(n[0]) ? 'outer' : 'MES'.includes(n[0]) ? 'slice' : 'rotation');
// QTM：外層 90°=1、180°=2；中層 90°=2、180°=4；整顆=0
function qtmCost(n) { const half = n.endsWith('2'); const k = KIND(n); return k === 'outer' ? (half ? 2 : 1) : k === 'slice' ? (half ? 4 : 2) : 0; }
function applyPerm(arr, p) { const out = new Array(54); for (let i = 0; i < 54; i++) out[p[i]] = arr[i]; return out; }
function apply(arr, name) { if (!PERM[name]) throw new Error('bad move ' + name); return applyPerm(arr, PERM[name]); }
function applyAll(arr, names) { return names.reduce(apply, arr); }
function inverse(name) { return name.endsWith('2') ? name : name.endsWith("'") ? name[0] : name + "'"; }
const SOLVED = Array.from({ length: 54 }, (_, i) => (i / 9) | 0); // 色號 0..5＝原本所屬面 URFDLB
function isSolved(a) { for (let f = 0; f < 6; f++) for (let k = 0; k < 9; k++) if (a[9 * f + k] !== a[9 * f + 4]) return false; return true; }
// 24 種朝向：以 x、y、z 由單位元 BFS 產生；ORIENT[k] 為貼紙置換（home→view）
const key = p => p.join(',');
const ORIENT = [Array.from({ length: 54 }, (_, i) => i)]; const OKEY = new Map([[key(ORIENT[0]), 0]]);
for (let h = 0; h < ORIENT.length; h++) for (const g of ['x', 'y', 'z']) {
  const c = compose(ORIENT[h], PERM[g]);
  if (!OKEY.has(key(c))) { OKEY.set(key(c), ORIENT.length); ORIENT.push(c); }
}
function orientAfter(o, rot) { return OKEY.get(key(compose(ORIENT[o], PERM[rot]))); }
function viewOf(home, o) { return applyPerm(home, ORIENT[o]); }
const PKEY = new Map(NAMES.map(n => [key(PERM[n]), n]));
function invPerm(p) { const q = new Array(54); p.forEach((v, i) => { q[v] = i; }); return q; }
// view 座標的轉動 → home 座標的轉動（不含整顆旋轉）
function toHome(o, viewMove) { const P = ORIENT[o]; const h = compose(compose(P, PERM[viewMove]), invPerm(P)); const n = PKEY.get(key(h)); if (!n) throw new Error('no home move'); return n; }
function toView(o, homeMove) { const P = ORIENT[o]; const v = compose(compose(invPerm(P), PERM[homeMove]), P); return PKEY.get(key(v)); }
// 手勢：view 座標中，起點貼紙 i、面內方向 d（±該面的右向量或下向量）→ view 轉動名
const FACE_AXES = S.STICKER_POS && (function () { // 每面的「右」「下」方向（與 54 格展開一致）
  const g = { U: [[1, 0, 0], [0, 0, 1]], R: [[0, 0, -1], [0, -1, 0]], F: [[1, 0, 0], [0, -1, 0]], D: [[1, 0, 0], [0, 0, -1]], L: [[0, 0, 1], [0, -1, 0]], B: [[-1, 0, 0], [0, -1, 0]] };
  return g;
})();
const SLICE_REF = [['M', N.L], ['E', N.D], ['S', N.F]];
function gestureToMove(i, d) {
  const n = NRM[i], p = POS[i];
  const w = cross(n, d); const k = dot(p, w);
  if (k === 1) return FACES[Object.values(N).findIndex(v => eq(v, w))] + "'";
  if (k === -1) return FACES[Object.values(N).findIndex(v => eq(v, neg(w)))];
  for (const [s, ref] of SLICE_REF) { if (eq(ref, w)) return s + "'"; if (eq(ref, neg(w))) return s; }
  throw new Error('gesture');
}
module.exports = { S, POS, NRM, FACES, N, PERM, NAMES, KIND, qtmCost, apply, applyAll, applyPerm, inverse, SOLVED, isSolved,
  ORIENT, orientAfter, viewOf, toHome, toView, FACE_AXES, gestureToMove, dot, cross, eq };
