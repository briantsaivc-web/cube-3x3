// G3 驗證：層先法（初學者法）分段產生器原型。輸入 view 座標 54 格色號；輸出轉動（含整顆旋轉）與分段。
// 只供規格驗證；G4 需依規格重寫。
'use strict';
const C = require('./cube-model.js');
const S = C.S;
const EF = S.EDGE_FACELET, CF = S.CORNER_FACELET; // 邊塊 12、角塊 8 的貼紙索引（URFDLB 順序）
const EN = S.EDGE_NAMES, CN = S.CORNER_NAMES;
const FORMULA = {
  crossFlip: "D R F' R'",          // 白十字：DF 的白邊塊白色朝前時
  cornerDrop: "R' D' R",           // 白角：把卡在頂層錯位的角塊拿到底層
  cornerInsert: "R' D' R D",       // 白角：重複直到 UFR 角歸位（最多 5 次）
  edgeRight: "U R U' R' U' F' U F",// 中層：頂層前邊塊放進右前
  edgeLeft: "U' L' U L U F U' F'", // 中層：頂層前邊塊放進左前
  yellowCross: "F R U R' U' F'",   // 黃十字
  sune: "R U R' U R U2 R'",        // 黃面
  aPerm: "R' F R' B2 R F' R' B2 R2", // 黃角歸位（角塊三循環）
  uPerm: "R2 U R U R' U' R' U' R' U R'" // 黃邊歸位（邊塊三循環，後邊不動）
};
const FACE_IDX = f => 'URFDLB'.indexOf(f);
function makeGen(stickers) {
  let a = stickers.slice();
  const moves = [], segments = []; let seg = null;
  const center = f => a[9 * FACE_IDX(f) + 4];
  function emit(list, kind, formulaId) {
    const toks = typeof list === 'string' ? list.split(' ').filter(Boolean) : list;
    if (!toks.length) return;
    seg.parts.push({ start: moves.length, end: moves.length + toks.length, kind, formula: formulaId || null });
    for (const t of toks) { a = C.apply(a, t); moves.push(t); }
  }
  function begin(id) { seg = { id, start: moves.length, parts: [] }; segments.push(seg); }
  function end() { seg.end = moves.length; seg.qtm = moves.slice(seg.start, seg.end).reduce((s, m) => s + C.qtmCost(m), 0); }
  const findEdge = (c1, c2) => { for (let k = 0; k < 12; k++) { const [i, j] = EF[k]; if (a[i] === c1 && a[j] === c2) return { k, flip: 0 }; if (a[i] === c2 && a[j] === c1) return { k, flip: 1 }; } throw new Error('edge'); };
  const findCorner = (cs) => { for (let k = 0; k < 8; k++) { const col = CF[k].map(i => a[i]); if (cs.every(c => col.includes(c))) return { k, twist: col.indexOf(cs[0]) }; } throw new Error('corner'); };
  const adj = (face, n) => (n === 0 ? [] : [n === 1 ? face : n === 2 ? face + '2' : face + "'"]);
  // 找出要幾次 face 轉動才能讓 pred 成立（0..3）
  function turnsUntil(face, pred) { let b = a; for (let n = 0; n < 4; n++) { if (pred(b)) return n; b = C.apply(b, face); } throw new Error('turnsUntil ' + face); }
  const W = 0; // 首層顏色（色號 0＝初始 U 面白色；資料檔可改）
  const oppositeOf = c => [3, 4, 5, 0, 1, 2][c];
  // ---- 0 拿好方塊：白色中心到上面
  begin('hold');
  { const f = 'URFDLB'[[0, 1, 2, 3, 4, 5].find(k => a[9 * k + 4] === W)];
    emit({ U: [], F: ['x'], B: ["x'"], R: ["z'"], L: ['z'], D: ['x2'] }[f], 'rotate'); }
  end();
  // ---- 1 白十字（頂面）
  begin('cross');
  const crossDone = side => { const r = findEdge(W, center(side)); return r.k === EN.indexOf('U' + side) && r.flip === 0; };
  for (let guard = 0; guard < 8 && !['F', 'R', 'B', 'L'].every(crossDone); guard++) {
    const side = ['F', 'R', 'B', 'L'].find(s => !crossDone(s));
    emit({ F: [], R: ['y'], B: ['y2'], L: ["y'"] }[side], 'rotate');
    const Fc = center('F');
    let e = findEdge(W, Fc);
    const nm = EN[e.k];
    if (nm[0] === 'U') { emit([nm[1] + '2'], 'setup'); }             // 頂層錯位或翻轉：先轉到底層
    else if (nm[0] !== 'D') {                                         // 中層：用所在面帶到底層，轉開底層，再轉回
      const X = nm[0]; const t = [X, X + "'"].find(t => { const b = C.apply(a, t); const tag = b; return EN[findEdgeIn(b, W, Fc).k][0] === 'D'; });
      emit([t, 'D', C.inverse(t)], 'setup');
    }
    e = findEdge(W, Fc);
    emit(adj('D', turnsUntil('D', b => findEdgeIn(b, W, Fc).k === EN.indexOf('DF'))), 'setup');
    e = findEdge(W, Fc);
    if (a[EF[EN.indexOf('DF')][0]] === W) emit('F2', 'formula', 'crossDown'); // 白色朝下
    else emit(FORMULA.crossFlip, 'formula', 'crossFlip');
    if (!crossDone('F')) throw new Error('cross fail');
  }
  end();
  function findEdgeIn(b, c1, c2) { const s = a; a = b; try { return findEdge(c1, c2); } finally { a = s; } }
  function findCornerIn(b, cs) { const s = a; a = b; try { return findCorner(cs); } finally { a = s; } }
  // ---- 2 白角（頂面）
  begin('corners');
  const cornerAt = (slot, cs) => { const r = findCorner(cs); return r.k === CN.indexOf(slot) && r.twist === 0; };
  const sideCols = { UFR: ['F', 'R'], URB: 0 };
  const targets = () => [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']].map(([p, q]) => [W, center(p), center(q)]);
  const cornerSolved = cs => { const r = findCorner(cs); const slot = CN[r.k]; const col = CF[r.k].map(i => a[i]);
    return slot[0] === 'U' && r.twist === 0 && CF[r.k].slice(1).every((i, n) => a[i] === center(slot[n + 1])); };
  for (let guard = 0; guard < 12; guard++) {
    const todo = targets().filter(cs => !cornerSolved(cs));
    if (!todo.length) break;
    const cs = todo[0];
    // 目標槽轉到右前上（UFR）：找 y 次數使 F、R 中心為 cs[1]、cs[2]
    const ny = turnsUntil('y', b => b[9 * 2 + 4] === cs[1] && b[9 * 1 + 4] === cs[2]);
    emit(adj('y', ny), 'rotate');
    let r = findCorner(cs);
    if (CN[r.k][0] === 'U') {
      if (CN[r.k] !== 'URF') { // 錯位的頂層角：轉到右前，拿下來，再轉回
        const k2 = turnsUntil('y', b => findCornerIn(b, cs).k === CN.indexOf('URF'));
        emit(adj('y', k2), 'rotate'); emit(FORMULA.cornerDrop, 'formula', 'cornerDrop'); emit(adj('y', (4 - k2) % 4), 'rotate');
      } else emit(FORMULA.cornerDrop, 'formula', 'cornerDrop');
    }
    emit(adj('D', turnsUntil('D', b => findCornerIn(b, cs).k === CN.indexOf('DFR'))), 'setup');
    let n = 0;
    while (!(findCorner(cs).k === CN.indexOf('URF') && findCorner(cs).twist === 0)) { emit(FORMULA.cornerInsert, 'formula', 'cornerInsert'); if (++n > 5) throw new Error('corner loop'); }
    stats.maxCornerRepeat = Math.max(stats.maxCornerRepeat, n);
  }
  if (!targets().every(cornerSolved)) throw new Error('corners fail');
  end();
  // ---- 3 翻面＋中層
  begin('middle');
  emit(['z2'], 'rotate');
  const Y = center('U');
  const midSlots = ['FR', 'FL', 'BL', 'BR'];
  const midSolved = () => midSlots.every(s => { const i = EF[EN.indexOf(s)]; return a[i[0]] === center(s[0]) && a[i[1]] === center(s[1]); });
  for (let guard = 0; guard < 16 && !midSolved(); guard++) {
    const uEdge = ['UF', 'UR', 'UB', 'UL'].find(s => { const [i, j] = EF[EN.indexOf(s)]; return a[i] !== Y && a[j] !== Y; });
    if (uEdge) {
      const [i, j] = EF[EN.indexOf(uEdge)]; const top = a[i], side = a[j];
      emit(adj('y', turnsUntil('y', b => b[9 * 2 + 4] === side)), 'rotate');
      emit(adj('U', turnsUntil('U', b => { const [p, q] = EF[EN.indexOf('UF')]; return b[p] === top && b[q] === side; })), 'setup');
      if (top === center('R')) emit(FORMULA.edgeRight, 'formula', 'edgeRight');
      else if (top === center('L')) emit(FORMULA.edgeLeft, 'formula', 'edgeLeft');
      else throw new Error('middle top color');
    } else {
      const bad = midSlots.find(s => { const q = EF[EN.indexOf(s)]; return !(a[q[0]] === center(s[0]) && a[q[1]] === center(s[1])); });
      emit(adj('y', { FR: 0, BR: 1, BL: 2, FL: 3 }[bad]), 'rotate');
      emit(FORMULA.edgeRight, 'formula', 'edgeKickOut');
    }
  }
  if (!midSolved()) throw new Error('middle fail');
  end();
  // ---- 4 黃十字
  begin('yellowCross');
  const up = i => a[i] === Y;
  for (let guard = 0; guard < 4; guard++) {
    const e = [1, 3, 5, 7].filter(up);
    if (e.length === 4) break;
    if (e.length === 2) {
      const line = (up(3) && up(5)) || (up(1) && up(7));
      if (line) emit(adj('U', up(3) ? 0 : 1), 'setup');
      else emit(adj('U', turnsUntil('U', b => b[1] === Y && b[3] === Y)), 'setup');
    }
    emit(FORMULA.yellowCross, 'formula', 'yellowCross');
    if (guard === 3) throw new Error('yellow cross');
  }
  end();
  // ---- 5 黃面（頂角朝向）
  begin('yellowFace');
  let sunes = 0;
  while (![0, 2, 6, 8].every(up)) {
    const n = [0, 2, 6, 8].filter(up).length;
    if (n === 1) emit(adj('U', turnsUntil('U', b => b[6] === Y)), 'setup');
    else emit(adj('U', turnsUntil('U', b => b[38] === Y)), 'setup'); // L3＝左前上角的左面貼紙
    emit(FORMULA.sune, 'formula', 'sune');
    if (++sunes > 6) throw new Error('sune loop');
  }
  stats.maxSune = Math.max(stats.maxSune, sunes);
  end();
  // ---- 6 黃角歸位
  begin('yellowCorners');
  const sideTop = f => { const b = 9 * FACE_IDX(f); return [a[b], a[b + 2]]; }; // 側面上排左右兩格（角）
  const lights = () => ['F', 'R', 'B', 'L'].filter(f => { const [p, q] = sideTop(f); return p === q; });
  let ap = 0;
  while (lights().length !== 4) {
    if (lights().length === 1) emit(adj('U', turnsUntil('U', b => { const s = a; a = b; try { return lights()[0] === HEADLIGHT_FACE; } finally { a = s; } })), 'setup');
    emit(FORMULA.aPerm, 'formula', 'aPerm');
    if (++ap > 3) throw new Error('aPerm loop');
  }
  stats.maxAPerm = Math.max(stats.maxAPerm, ap);
  emit(adj('U', turnsUntil('U', b => b[18] === b[22])), 'setup'); // 對齊：F 面左上角＝F 中心
  end();
  // ---- 7 黃邊歸位
  begin('yellowEdges');
  const edgeOk = f => { const b = 9 * FACE_IDX(f); return a[b + 1] === a[b + 4]; };
  let up2 = 0;
  while (!['F', 'R', 'B', 'L'].every(edgeOk)) {
    const good = ['F', 'R', 'B', 'L'].filter(edgeOk);
    if (good.length === 1) emit(adj('y', { B: 0, L: 1, F: 2, R: 3 }[good[0]]), 'rotate');
    emit(FORMULA.uPerm, 'formula', 'uPerm');
    if (++up2 > 3) throw new Error('uPerm loop');
  }
  stats.maxUPerm = Math.max(stats.maxUPerm, up2);
  end();
  if (!C.isSolved(a)) throw new Error('not solved');
  return { moves: mergeRotations(moves, segments), segments, final: a };
}
let HEADLIGHT_FACE = 'B';
const stats = { maxCornerRepeat: 0, maxSune: 0, maxAPerm: 0, maxUPerm: 0 };
function mergeRotations(moves) { return moves; } // 原型不合併（分段索引保持不變）
module.exports = { generate: makeGen, FORMULA, stats, setHeadlight: f => { HEADLIGHT_FACE = f; } };
