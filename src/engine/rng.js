// src/engine/rng.js — seeded RNG（xorshift32）
//
// 依據：game-spec.md §5「打亂規則」。演算法與 docs/spike/code/solver.js 的 makeRng 相同，
// 純函數、無外部狀態；同 seed 必得同亂數序列。engine／solver 一律透過本檔取得亂數，
// 不得使用瀏覽器內建的非決定性亂數函式（CLAUDE.md §3 第 2 條）。
'use strict';

/**
 * 建立一個 xorshift32 亂數產生器。
 * @param {number} seed - 32 位元無號整數（0–4294967295）；0 時改用固定種子 0x9e3779b9。
 * @returns {() => number} 每次呼叫回傳一個 [0, 1) 之間的浮點數。
 */
function makeRng(seed) {
  var state = (seed >>> 0) || 0x9e3779b9;
  return function () {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

module.exports = { makeRng: makeRng };
