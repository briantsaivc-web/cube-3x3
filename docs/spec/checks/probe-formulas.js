// 探查候選公式的效果（貼紙置換循環），確認哪些塊被動到
'use strict';
const C = require('./cube-model.js');
const S = C.S;
const L = S.SOLVED_FACELETS.split('').map((c, i) => c + ((i % 9) + 1)); // 每格唯一標籤
function touched(alg) {
  const a = C.applyAll(L, alg.split(' '));
  const moved = []; a.forEach((v, i) => { if (v !== L[i]) moved.push(L[i] + '←' + v); });
  return moved;
}
const pieceSet = (alg) => {
  const a = C.applyAll(S.SOLVED_FACELETS.split('').map((c, i) => i), alg.split(' '));
  const E = S.EDGE_FACELET.map((f, k) => S.EDGE_NAMES[k]).filter((n, k) => S.EDGE_FACELET[k].some(i => a[i] !== i));
  const K = S.CORNER_NAMES.filter((n, k) => S.CORNER_FACELET[k].some(i => a[i] !== i));
  return { edges: E, corners: K };
};
for (const alg of ["R' F R' B2 R F' R' B2 R2", "R2 U R U R' U' R' U' R' U R'", "R U R' U R U2 R'", "F R U R' U' F'",
  "U R U' R' U' F' U F", "U' L' U L U F U' F'", "D R F' R'", "R' D' R D", "R' D' R"]) {
  console.log(alg.padEnd(32), JSON.stringify(pieceSet(alg)));
}
