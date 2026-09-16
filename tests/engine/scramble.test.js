// tests/engine/scramble.test.js — src/engine/scramble.js 的驗收測試
// 對應 game-spec.md §12.1：T-ENG-11。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var cube = require('../../src/engine/cube.js');
var scramble = require('../../src/engine/scramble.js');

var AXIS_OF_BASE = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

test('T-ENG-11：打亂規則（同 seed 相同、範例字串、無同面相鄰、無同軸連三、長度、非復原、seed 檢查）', function () {
  // 同 seed 兩次相同
  var a = scramble.makeScramble(20260915, { length: 25 });
  var b = scramble.makeScramble(20260915, { length: 25 });
  assert.deepEqual(a, b, '同 seed 應產生相同打亂');

  // seed 20260915 等於 game-spec.md §5 範例字串
  var expected = "U' D' B L' F2 B U2 F' B' D2 R2 U2 R2 U2 B' F2 U' D L' D' R' L B2 U F'".split(' ');
  assert.deepEqual(a, expected, 'seed 20260915 應等於規格範例字串');

  // 長度＝參數
  assert.equal(a.length, 25);

  // 抽樣 500 個 seed：無同面相鄰、無同軸連三、長度正確、非復原
  for (var seed = 1; seed <= 500; seed++) {
    var moves = scramble.makeScramble(seed, { length: 25 });
    assert.equal(moves.length, 25, 'seed=' + seed + ' 長度應為 25');

    for (var i = 0; i < moves.length; i++) {
      if (i >= 1) {
        assert.notEqual(moves[i].charAt(0), moves[i - 1].charAt(0),
          'seed=' + seed + ' 第 ' + i + ' 個記號不應與前一個同面');
      }
      if (i >= 2) {
        var sameAxis = AXIS_OF_BASE[moves[i].charAt(0)] === AXIS_OF_BASE[moves[i - 1].charAt(0)] &&
          AXIS_OF_BASE[moves[i].charAt(0)] === AXIS_OF_BASE[moves[i - 2].charAt(0)];
        assert.equal(sameAxis, false, 'seed=' + seed + ' 第 ' + i + ' 個記號不應同軸連三');
      }
    }

    var applied = cube.applyMoves(cube.SOLVED, moves);
    assert.equal(cube.isSolved(applied), false, 'seed=' + seed + ' 的打亂不應剛好是復原狀態');
  }

  // seed 非 uint32 被拒絕
  assert.throws(function () { scramble.makeScramble(-1, { length: 25 }); });
  assert.throws(function () { scramble.makeScramble(1.5, { length: 25 }); });
  assert.throws(function () { scramble.makeScramble(0x100000000, { length: 25 }); });
  assert.throws(function () { scramble.makeScramble('20260915', { length: 25 }); });
  assert.throws(function () { scramble.makeScramble(NaN, { length: 25 }); });

  // seed 0 仍應可用（rng.js 對 0 有特別處理，不應拋錯）
  assert.doesNotThrow(function () { scramble.makeScramble(0, { length: 25 }); });
});
