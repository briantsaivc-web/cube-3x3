// src/engine/scramble.js — 打亂產生器（random-move，非 WCA 官方打亂）
//
// 依據：game-spec.md §5「打亂規則」。純函數：同 seed 必得同打亂字串；
// RNG 於函式內建立、用完即丟，不存進 state（CLAUDE.md §3 第 2 條）。
'use strict';

var rngModule = require('./rng.js');
var cube = require('./cube.js');

var makeRng = rngModule.makeRng;

// 記號池：外層 18 個，依 MOVE_ORDER = U R F D L B × ["", "2", "'"] 的順序（即 MOVES 前 18 個）。
var OUTER_MOVES = cube.MOVES.slice(0, 18);

// 同軸分組：U/D、R/L、F/B（用來檢查「同軸連三」）。
var AXIS_OF_BASE = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

function isUint32(n) {
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
}

// 產生一串長度為 length 的外層記號（避免同面相鄰、同軸連三），消耗傳入的 rng。
function generateOnce(rng, length) {
  var out = [];
  while (out.length < length) {
    var candidate = OUTER_MOVES[Math.floor(rng() * 18)];
    var base = candidate.charAt(0);
    var k = out.length;
    if (k >= 1 && out[k - 1].charAt(0) === base) continue; // 同面相鄰
    if (k >= 2 && AXIS_OF_BASE[out[k - 1].charAt(0)] === AXIS_OF_BASE[base] &&
        AXIS_OF_BASE[out[k - 2].charAt(0)] === AXIS_OF_BASE[base]) continue; // 同軸連三
    out.push(candidate);
  }
  return out;
}

/**
 * 產生打亂記號序列（home 座標）。
 * @param {number} seed - 0–4294967295 的整數；非 uint32 時拋錯。
 * @param {{length: number}} params - `length` 為記號個數（§5：預設 25，由呼叫端傳入）。
 * @returns {string[]}
 */
function makeScramble(seed, params) {
  if (!isUint32(seed)) throw new Error('makeScramble: seed 必須是 0–4294967295 的整數');
  if (!params || !Number.isInteger(params.length) || params.length <= 0) {
    throw new Error('makeScramble: params.length 必須是正整數');
  }
  var rng = makeRng(seed);
  var moves;
  do {
    // 若打亂結果剛好是復原狀態：以同一個 RNG 繼續產生新的一整串（§5）。
    moves = generateOnce(rng, params.length);
  } while (cube.isSolved(cube.applyMoves(cube.SOLVED, moves)));
  return moves;
}

module.exports = { makeScramble: makeScramble };
