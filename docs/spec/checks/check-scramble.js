// G3 驗證：打亂規則（外層 18 記號、25 個、同面不相鄰、同軸不連三）— QTM 長度分布、不會是復原狀態、同 seed 相同
'use strict';
const assert = require('node:assert/strict');
const C = require('./cube-model.js'); const S = C.S;
const OUTER = C.NAMES.slice(0, 18); const AX = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
function scramble(seed, len) {
  const rng = S.makeRng(seed); const out = [];
  while (out.length < len) {
    const m = OUTER[Math.floor(rng() * 18)]; const k = out.length;
    if (k >= 1 && out[k - 1][0] === m[0]) continue;                                   // 同面相鄰
    if (k >= 2 && AX[out[k - 1][0]] === AX[m[0]] && AX[out[k - 2][0]] === AX[m[0]]) continue; // 同軸連三
    out.push(m);
  }
  return out;
}
const hist = {}; let solved = 0;
for (let s = 1; s <= 10000; s++) {
  const sc = scramble(s, 25);
  assert.deepEqual(sc, scramble(s, 25));
  const q = sc.reduce((a, m) => a + C.qtmCost(m), 0); hist[q] = (hist[q] || 0) + 1;
  if (C.isSolved(C.applyAll(C.SOLVED, sc))) solved++;
}
const qs = Object.keys(hist).map(Number);
console.log(`seed 1..10000、長度 25：同 seed 兩次相同；打亂後恰為復原 ${solved} 次；打亂本身 QTM 最小 ${Math.min(...qs)} 最大 ${Math.max(...qs)}`);
console.log('例 seed=20260915：' + scramble(20260915, 25).join(' '));
