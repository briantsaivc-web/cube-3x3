// G3 驗證：層先法產生器 —— (a) 1,000 random-state (b) 1,000 含中層／整顆旋轉的隨機序列 (c) 末層 62,208 種全列舉
'use strict';
const assert = require('node:assert/strict');
const C = require('./cube-model.js'); const L = require('./lbl.js'); const S = C.S;
L.setHeadlight('B');
const ids = s => s.split('').map(ch => 'URFDLB'.indexOf(ch));
function pct(arr, p) { const b = arr.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; }
function summarize(tag, runs) {
  const tot = runs.map(r => r.qtm), tok = runs.map(r => r.tokens);
  const stages = {};
  for (const r of runs) for (const s of r.segs) (stages[s.id] = stages[s.id] || []).push(s.qtm);
  console.log(`${tag}：${runs.length} 局全部復原；總 QTM 平均 ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(1)}、p50 ${pct(tot, .5)}、p95 ${pct(tot, .95)}、最小 ${Math.min(...tot)}、最大 ${Math.max(...tot)}；記號數（含整顆旋轉）最大 ${Math.max(...tok)}`);
  for (const [k, v] of Object.entries(stages)) console.log(`  ${k.padEnd(14)} 平均 ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1).padStart(5)}  p95 ${String(pct(v, .95)).padStart(3)}  最大 ${String(Math.max(...v)).padStart(3)}`);
}
function run(st) {
  const g = L.generate(st);
  const replay = C.applyAll(st, g.moves);
  assert.ok(C.isSolved(replay));
  // 分段首尾相接、涵蓋全部轉動
  let p = 0; for (const s of g.segments) { assert.equal(s.start, p); p = s.end; for (const q of s.parts) assert.ok(q.start >= s.start && q.end <= s.end); }
  assert.equal(p, g.moves.length);
  assert.equal(g.segments.map(s => s.id).join(','), 'hold,cross,corners,middle,yellowCross,yellowFace,yellowCorners,yellowEdges');
  const qtm = g.moves.reduce((a, m) => a + C.qtmCost(m), 0);
  // 決定性：同輸入兩次輸出相同
  assert.deepEqual(L.generate(st).moves, g.moves);
  return { qtm, tokens: g.moves.length, segs: g.segments };
}
// (a)
{ const rng = S.makeRng(20260915); const runs = [];
  for (let i = 0; i < 1000; i++) runs.push(run(ids(S.cubieToFacelets(S.randomCube(rng)))));
  summarize('(a) random-state seed=20260915', runs); }
// (b)
{ const rng = S.makeRng(31415); const ri = n => Math.floor(rng() * n); const runs = [];
  for (let i = 0; i < 1000; i++) { const seq = Array.from({ length: 40 }, () => C.NAMES[ri(36)]); runs.push(run(C.applyAll(C.SOLVED, seq))); }
  summarize('(b) 40 記號隨機序列（含 M/E/S 與 x/y/z）seed=31415', runs); }
// (c) 末層全列舉：U 層（白）與中層已復原，D 層（黃）任意合法
{ const perms = []; (function p(a, k) { if (k === 4) { perms.push(a.slice()); return; } for (let i = k; i < 4; i++) { [a[k], a[i]] = [a[i], a[k]]; p(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } })([0, 1, 2, 3], 0);
  const par = a => { let x = 0; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (a[i] > a[j]) x ^= 1; return x; };
  let n = 0; const runs = [];
  for (const cp of perms) for (let co = 0; co < 27; co++) for (const ep of perms) for (let eo = 0; eo < 8; eo++) {
    if (par(cp) !== par(ep)) continue;
    const c = S.newCube();
    const cos = [co % 3, ((co / 3) | 0) % 3, ((co / 9) | 0) % 3]; cos.push((6 - cos[0] - cos[1] - cos[2]) % 3);
    const eos = [eo & 1, (eo >> 1) & 1, (eo >> 2) & 1]; eos.push((eos[0] + eos[1] + eos[2]) & 1);
    for (let i = 0; i < 4; i++) { c.cp[4 + i] = 4 + cp[i]; c.co[4 + i] = cos[i]; c.ep[4 + i] = 4 + ep[i]; c.eo[4 + i] = eos[i]; }
    assert.equal(S.verify(c), null);
    runs.push(run(ids(S.cubieToFacelets(c)))); n++;
  }
  summarize(`(c) 末層全列舉 ${n} 種`, runs); }
console.log('公式重複次數上限（全部樣本）：' + JSON.stringify(L.stats));
