// G3 驗證：近復原狀態（外層 ≤3 記號全列舉、含中層與整顆的 ≤2 記號全列舉、24 朝向復原態）層先法皆可完成
'use strict';
const assert = require('node:assert/strict');
const C = require('./cube-model.js'); const L = require('./lbl.js');
L.setHeadlight('B');
let n = 0, maxQ = 0;
const test = st => { const g = L.generate(st); assert.ok(C.isSolved(C.applyAll(st, g.moves))); n++; maxQ = Math.max(maxQ, g.moves.reduce((a, m) => a + C.qtmCost(m), 0)); };
const OUT = C.NAMES.slice(0, 18);
test(C.SOLVED);
for (const a of OUT) { test(C.apply(C.SOLVED, a)); for (const b of OUT) { const s2 = C.applyAll(C.SOLVED, [a, b]); test(s2); for (const c of OUT) test(C.apply(s2, c)); } }
for (const a of C.NAMES) for (const b of C.NAMES) test(C.applyAll(C.SOLVED, [a, b]));
for (let o = 0; o < 24; o++) test(C.viewOf(C.SOLVED, o));
console.log(`近復原狀態 ${n} 個全部完成；其中最長 ${maxQ} QTM`);
