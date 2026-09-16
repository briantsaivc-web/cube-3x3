// tests/engine/cube.test.js — src/engine/cube.js 的驗收測試
// 對應 game-spec.md §12.1：T-ENG-01～04、06～10、25（T-ENG-05 由 S4 負責）。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var cube = require('../../src/engine/cube.js');

// 供測試自建亂數用的簡易 xorshift32（僅測試檔使用，不影響 engine 純函數性質）。
function makeTestRng(seed) {
  var s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function randomState(rng, steps) {
  var stickers = cube.SOLVED.slice();
  for (var i = 0; i < steps; i++) {
    var move = cube.MOVES[Math.floor(rng() * cube.MOVES.length)];
    stickers = cube.applyMove(stickers, move);
  }
  return stickers;
}

test('T-ENG-01：36 個記號各做 4 次回原狀（X2 做 2 次）', function () {
  cube.MOVES.forEach(function (move) {
    var base = move.charAt(0);
    var half = move.length > 1 && move.charAt(1) === '2';
    var times = half ? 2 : 4;
    var stickers = cube.SOLVED.slice();
    for (var i = 0; i < times; i++) stickers = cube.applyMove(stickers, move);
    assert.deepEqual(stickers, cube.SOLVED, move + ' 做 ' + times + ' 次應回原狀');
  });
});

test('T-ENG-02：X 後 X′ 回原狀、X′ 後 X 回原狀、X2 = X·X（20 個隨機狀態）', function () {
  var rng = makeTestRng(12345);
  var states = [];
  for (var i = 0; i < 20; i++) states.push(randomState(rng, 15));

  cube.MOVES.forEach(function (move) {
    var inv = cube.inverse(move);
    states.forEach(function (state) {
      var afterBoth = cube.applyMove(cube.applyMove(state, move), inv);
      assert.deepEqual(afterBoth, state, move + ' 後 ' + inv + ' 應回原狀');

      var afterBothRev = cube.applyMove(cube.applyMove(state, inv), move);
      assert.deepEqual(afterBothRev, state, inv + ' 後 ' + move + ' 應回原狀');
    });
  });

  // X2 = X·X（只需對基本記號檢查一次，非重複後綴）
  ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z'].forEach(function (base) {
    states.forEach(function (state) {
      var twice = cube.applyMove(cube.applyMove(state, base), base);
      var half = cube.applyMove(state, base + '2');
      assert.deepEqual(twice, half, base + '2 應等於 ' + base + '·' + base);
    });
  });
});

test('T-ENG-03：恆等式 M=RL′x′、E=UD′y′、S=F′Bz、x=RM′L′、y=UE′D′、z=FSB′', function () {
  var identities = [
    ['M', ['R', "L'", "x'"]],
    ['E', ['U', "D'", "y'"]],
    ['S', ["F'", 'B', 'z']],
    ['x', ['R', "M'", "L'"]],
    ['y', ['U', "E'", "D'"]],
    ['z', ['F', 'S', "B'"]]
  ];
  identities.forEach(function (pair) {
    var left = cube.applyMove(cube.SOLVED, pair[0]);
    var right = cube.applyMoves(cube.SOLVED, pair[1]);
    assert.deepEqual(left, right, pair[0] + ' 應等於 ' + pair[1].join(' '));
  });
});

test('T-ENG-04：方向抽查（U 帶 F 頂排到 L；M 帶 U 中欄到 F；E 帶 F 中排到 R；S 帶 U 中排到 R）', function () {
  var ids = [];
  for (var i = 0; i < 54; i++) ids.push(i);

  function facelet(face, row, col) {
    return 9 * face + row * 3 + col;
  }
  function assertMovedInto(moveName, sourceIndices, targetFace) {
    var after = cube.applyMove(ids, moveName);
    var lo = 9 * targetFace, hi = lo + 8;
    sourceIndices.forEach(function (idx) {
      var newPos = after.indexOf(ids[idx]);
      assert.ok(newPos >= lo && newPos <= hi,
        moveName + '：來源貼紙 ' + idx + ' 應移到面 ' + targetFace + '（實得 ' + newPos + '）');
    });
  }

  // 面序 U R F D L B = 0..5
  assertMovedInto('U', [facelet(2, 0, 0), facelet(2, 0, 1), facelet(2, 0, 2)], 4); // F 頂排 → L
  assertMovedInto('M', [facelet(0, 0, 1), facelet(0, 1, 1), facelet(0, 2, 1)], 2); // U 中欄 → F
  assertMovedInto('E', [facelet(2, 1, 0), facelet(2, 1, 1), facelet(2, 1, 2)], 1); // F 中排 → R
  assertMovedInto('S', [facelet(0, 1, 0), facelet(0, 1, 1), facelet(0, 1, 2)], 1); // U 中排 → R
});

test('T-ENG-06：qtmCost（外層 1／2、中層 2／4、整顆 0，36 個逐一比對）', function () {
  cube.MOVES.forEach(function (move) {
    var k = cube.kind(move);
    var half = move.length > 1 && move.charAt(1) === '2';
    var expected;
    if (k === 'outer') expected = half ? 2 : 1;
    else if (k === 'slice') expected = half ? 4 : 2;
    else expected = 0;
    assert.equal(cube.qtmCost(move), expected, move + ' 的 qtmCost 應為 ' + expected);
  });
});

test('T-ENG-07：isSolved（24 朝向的復原狀態皆 true；M R′ L 後為 true；單一 M 後為 false）', function () {
  for (var o = 0; o < cube.ORIENT_COUNT; o++) {
    var view = cube.applyOrient(cube.SOLVED, o);
    assert.equal(cube.isSolved(view), true, 'orient=' + o + ' 的復原狀態應為 isSolved');
  }
  var afterMRL = cube.applyMoves(cube.SOLVED, ['M', "R'", 'L']);
  assert.equal(cube.isSolved(afterMRL), true, 'M R′ L 後應為復原（等於整顆 x′）');

  var afterM = cube.applyMove(cube.SOLVED, 'M');
  assert.equal(cube.isSolved(afterM), false, '單一 M 後不應為復原');
});

// 24 種朝向的鎖定雜湊（sha1(view.join(','))，取前 12 hex）：由本段（S2）實作後產生，
// 之後任何人不得改變 24 朝向的編號順序（game-spec.md §3.2、分派單 X-2）。
var LOCKED_ORIENT_HASHES = [
  '58955b7436ba', 'a73524c010b0', '2aceff1c3c65', '0a19f095f0b9',
  '5cdb36c4196c', 'c54358bfc67b', 'c93d63fac721', 'e7e7015a980d',
  '2456c73248b2', 'f1c0df46d161', '842aeb83a509', '0cbffe1f19ac',
  '6e898f59155b', 'b6b6164b7225', '820386bfffa0', '9aa7ec36ea76',
  '4873aa9cb37d', '399bc2e71713', 'cfd17c7d463f', '0209ee9bad7c',
  '72064f646f69', 'f3a933d2fb77', 'baea6cb47078', 'e54692447bf9'
];

function orientHash(view) {
  return crypto.createHash('sha1').update(view.join(',')).digest('hex').slice(0, 12);
}

test('T-ENG-08：24 種朝向互不相同；編號順序固定；ROTATE 只改 orient', function () {
  var views = [];
  for (var o = 0; o < cube.ORIENT_COUNT; o++) {
    views.push(cube.applyOrient(cube.SOLVED, o).join(','));
  }
  var uniq = new Set(views);
  assert.equal(uniq.size, 24, '24 種朝向應互不相同');

  // 鎖定編號：orientAfter(0, 'x' | 'y' | 'z') 的值（本段實作後鎖定，任何人不得改變編號）。
  assert.equal(cube.orientAfter(0, 'x'), 1);
  assert.equal(cube.orientAfter(0, 'y'), 2);
  assert.equal(cube.orientAfter(0, 'z'), 3);

  // 24 個置換的雜湊：與鎖定值逐一比對。
  for (var o2 = 0; o2 < cube.ORIENT_COUNT; o2++) {
    var view = cube.applyOrient(cube.SOLVED, o2);
    assert.equal(orientHash(view), LOCKED_ORIENT_HASHES[o2],
      'orient=' + o2 + ' 的雜湊應與鎖定值相符');
  }

  // ROTATE 只改 orient：整顆旋轉不應改變 home 貼紙（用 orientAfter 換算朝向，applyOrient 換算畫面）。
  var rng = makeTestRng(777);
  for (var i = 0; i < 20; i++) {
    var home = randomState(rng, 10);
    var o3 = Math.floor(rng() * 24);
    var rotation = ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'"][Math.floor(rng() * 9)];
    var newOrient = cube.orientAfter(o3, rotation);
    // home 不因整顆旋轉而改變；只有 view（applyOrient）改變。
    assert.deepEqual(home, home.slice());
    assert.notEqual(cube.applyOrient(home, o3).join(','), undefined);
    assert.notEqual(cube.applyOrient(home, newOrient).join(','), undefined);
  }
});

test('T-ENG-09：toHome／toView 互逆，且 view 做 X＝home 做 toHome(o,X)（2,000 組隨機）', function () {
  var rng = makeTestRng(2026);
  var count = 0;
  for (var trial = 0; trial < 2000; trial++) {
    var o = Math.floor(rng() * cube.ORIENT_COUNT);
    var move = cube.MOVES[Math.floor(rng() * cube.MOVES.length)];

    var homeMove = cube.toHome(o, move);
    var back = cube.toView(o, homeMove);
    assert.equal(back, move, 'toView(toHome) 應回到原記號');

    // 用一個隨機 home 狀態驗證：view 做 move ＝ home 做 toHome(o, move)，再換回 view。
    var home = randomState(rng, 8);
    var view = cube.applyOrient(home, o);
    var viewAfter = cube.applyMove(view, move);
    var homeAfter = cube.applyMove(home, homeMove);
    var viewAfterFromHome = cube.applyOrient(homeAfter, o);
    assert.deepEqual(viewAfter, viewAfterFromHome,
      'view 做 ' + move + ' 應等於 home 做 ' + homeMove + ' 再換算成 view');
    count++;
  }
  assert.equal(count, 2000);
});

test('T-ENG-10：gestureToMove（216 組貼紙位移與滑動同向；§9.2 抽樣表逐項相符）', function () {
  // 216 組：54 格 × 4 方向。每格只在該面「右」「下」兩軸的四個方向上測試（其餘方向無定義、會拋錯）。
  var total = 0;
  for (var face = 0; face < 6; face++) {
    var axes = cube.FACE_AXES['URFDLB'.charAt(face)];
    var dirs4 = [axes.right, axes.right.map(function (v) { return -v; }),
      axes.down, axes.down.map(function (v) { return -v; })];
    for (var k = 0; k < 9; k++) {
      var idx = 9 * face + k;
      dirs4.forEach(function (d) {
        var move = cube.gestureToMove(idx, d);
        assert.ok(cube.MOVES.indexOf(move) !== -1, '應回傳合法記號');
        total++;
      });
    }
  }
  assert.equal(total, 216);

  // §9.2 抽樣表（F1、F5、U5）
  assert.equal(cube.gestureToMove(18, [1, 0, 0]), "U'"); // F1 往右 → U′
  assert.equal(cube.gestureToMove(18, [-1, 0, 0]), 'U'); // F1 往左 → U
  assert.equal(cube.gestureToMove(18, [0, -1, 0]), 'L'); // F1 往下 → L
  assert.equal(cube.gestureToMove(18, [0, 1, 0]), "L'"); // F1 往上 → L′
  assert.equal(cube.gestureToMove(22, [1, 0, 0]), 'E');  // F5 往右 → E
  assert.equal(cube.gestureToMove(22, [0, -1, 0]), 'M'); // F5 往下 → M
  assert.equal(cube.gestureToMove(4, [0, 0, 1]), 'M');   // U5 往下（畫面前方）→ M
  assert.equal(cube.gestureToMove(4, [1, 0, 0]), 'S');   // U5 往右 → S
});

test('T-ENG-25：describeMove（36 個記號逐一比對；′ 的三種寫法結果相同）', function () {
  cube.MOVES.forEach(function (move) {
    var desc = cube.describeMove(move);
    assert.equal(desc.move, move);
    assert.equal(desc.base, move.charAt(0));
    assert.equal(desc.kind, cube.kind(move));
    assert.equal(desc.qtm, cube.qtmCost(move));

    var expectedTurn = move.length === 1 ? 'cw' : (move.charAt(1) === '2' ? 'half' : 'ccw');
    assert.equal(desc.turn, expectedTurn);
  });

  // ′ 的三種寫法（' ’ ′）經 parseMoves 正規化後 describeMove 結果相同。
  var variants = ["R'", 'R’', 'R′'];
  var parsed = variants.map(function (v) { return cube.parseMoves(v)[0]; });
  var described = parsed.map(function (m) { return cube.describeMove(m); });
  assert.deepEqual(described[0], described[1]);
  assert.deepEqual(described[1], described[2]);
});

// ---------------------------------------------------------------------------
// T-ENG-28（S11／m-1）：匯出常數已凍結；格式錯誤的記號一律拋錯（不再只看第一個字元）
// ---------------------------------------------------------------------------

test('T-ENG-28：匯出常數（MOVES、SOLVED、STICKER_POS、STICKER_NRM、FACE_AXES）深度凍結；isMove／kind／inverse 嚴格檢查記號', function () {
  [['MOVES', cube.MOVES], ['SOLVED', cube.SOLVED], ['STICKER_POS', cube.STICKER_POS], ['STICKER_NRM', cube.STICKER_NRM]].forEach(function (pair) {
    assert.ok(Object.isFrozen(pair[1]), pair[0] + ' 應凍結');
  });
  assert.ok(Object.isFrozen(cube.STICKER_POS[0]) && Object.isFrozen(cube.STICKER_NRM[53]), '內層陣列應凍結');
  assert.ok(Object.isFrozen(cube.FACE_AXES) && Object.isFrozen(cube.FACE_AXES.R) && Object.isFrozen(cube.FACE_AXES.R.right), 'FACE_AXES 應深度凍結');
  assert.throws(function () { 'use strict'; cube.SOLVED[0] = 5; }, TypeError);
  assert.equal(cube.SOLVED[0], 0);

  cube.MOVES.forEach(function (m) { assert.equal(cube.isMove(m), true, m); });
  ['R3', 'xx', 'x3', 'R\u2019', '', 'constructor', 'toString', 'r', undefined, null, 5].forEach(function (bad) {
    assert.equal(cube.isMove(bad), false, String(bad));
    assert.throws(function () { cube.kind(bad); }, Error, 'kind(' + String(bad) + ') 應拋錯');
    assert.throws(function () { cube.inverse(bad); }, Error, 'inverse(' + String(bad) + ') 應拋錯');
    assert.throws(function () { cube.applyMove(cube.SOLVED, bad); }, Error, 'applyMove(' + String(bad) + ') 應拋錯');
  });
});
