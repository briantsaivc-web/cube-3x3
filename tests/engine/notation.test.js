// tests/engine/notation.test.js — T-DATA-07（game-spec.md §2.4、§11.2、§12.6；修訂 R-2d）
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');

var engine = require(path.join('..', '..', 'src', 'engine', 'index.js'));
var notation = require(path.join('..', '..', 'src', 'ui', 'notation.js'));
var texts = require(path.join('..', '..', 'src', 'data', 'texts.json'));

test('T-DATA-07：白話說明（explainMove）與記號鍵副標（keySubLabel）', function () {
  var sentences = [];

  engine.MOVES.forEach(function (move) {
    var s = notation.explainMove(move, texts, engine);
    sentences.push(s);

    // 不含未替換的 { 或 }
    assert.ok(s.indexOf('{') === -1 && s.indexOf('}') === -1, '未替換的模板佔位符：' + move + ' → ' + s);

    var d = engine.describeMove(move);

    // 句中步數等於 qtmCost
    assert.ok(s.indexOf('算 ' + d.qtm + ' 步') !== -1 || s.indexOf('不算步數') !== -1,
      '步數與 qtmCost 不符：' + move + ' → ' + s);

    if (d.kind === 'outer') {
      if (d.turn === 'cw') {
        assert.ok(s.indexOf('順時針') !== -1, 'outer cw 應含「順時針」：' + move + ' → ' + s);
      } else if (d.turn === 'ccw') {
        assert.ok(s.indexOf('逆時針') !== -1, 'outer ccw 應含「逆時針」：' + move + ' → ' + s);
      } else {
        assert.ok(s.indexOf('半圈') !== -1, 'outer half 應含「半圈」：' + move + ' → ' + s);
      }
    } else if (d.kind === 'slice') {
      if (d.turn === 'half') {
        assert.ok(s.indexOf('半圈') !== -1, 'slice half 應含「半圈」：' + move + ' → ' + s);
      } else {
        var sliceRef = { M: 'L', E: 'D', S: 'F' };
        assert.ok(s.indexOf('照 ' + sliceRef[d.base]) !== -1,
          'slice 90° 應含「照 ' + sliceRef[d.base] + '」：' + move + ' → ' + s);
      }
    } else {
      assert.strictEqual(d.kind, 'rotation');
      assert.ok(s.indexOf('不算步數') !== -1, 'rotation 應含「不算步數」：' + move + ' → ' + s);
    }
  });

  // 36 句互不相同
  assert.strictEqual(new Set(sentences).size, 36, '36 句白話說明應互不相同');

  // 指定範例
  assert.strictEqual(notation.explainMove('R', texts, engine), 'R：右層順時針轉 90°，算 1 步');
  assert.strictEqual(notation.explainMove("M'", texts, engine), 'M′：左右之間的中層照 L′ 的方向轉 90°，算 2 步');

  // keySubLabel：36 個結果等於 §11.2 表
  var expectedKeySub = {
    U: '上', "U'": '上・逆', U2: '上・半圈',
    D: '下', "D'": '下・逆', D2: '下・半圈',
    L: '左', "L'": '左・逆', L2: '左・半圈',
    R: '右', "R'": '右・逆', R2: '右・半圈',
    F: '前', "F'": '前・逆', F2: '前・半圈',
    B: '後', "B'": '後・逆', B2: '後・半圈',
    M: '左右間', "M'": '左右間・逆', M2: '左右間・半圈',
    E: '上下間', "E'": '上下間・逆', E2: '上下間・半圈',
    S: '前後間', "S'": '前後間・逆', S2: '前後間・半圈',
    x: '整顆上翻', "x'": '整顆下翻', x2: '上下翻半圈',
    y: '整顆左轉', "y'": '整顆右轉', y2: '左右轉半圈',
    z: '整顆右倒', "z'": '整顆左倒', z2: '側倒半圈'
  };
  engine.MOVES.forEach(function (move) {
    assert.strictEqual(notation.keySubLabel(move, texts), expectedKeySub[move], 'keySubLabel(' + move + ')');
  });

  // aria-label＝記號＋空格＋副標
  assert.strictEqual(notation.keyAriaLabel("R'", texts, engine), 'R′ 右・逆');
});

test('T-DATA-07：fillTemplate 基本行為', function () {
  var notationMod = notation;
  assert.strictEqual(notationMod.fillTemplate('{a}-{b}', { a: '1', b: 2 }), '1-2');
  assert.strictEqual(notationMod.fillTemplate('{a}-{c}', { a: '1' }), '1-{c}');
});
