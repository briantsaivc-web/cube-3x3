// 方塊表示法、轉動、合法性檢查、貼紙互轉的測試（node --test）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../solver.js');

const ID = S.newCube();

test('每個轉動做 4 次（180° 做 2 次）等於原狀', () => {
  for (let m = 0; m < 18; m++) {
    const times = (m % 3 === 1) ? 2 : 4;
    let c = S.newCube();
    for (let k = 0; k < 4; k++) c = S.applyMove(c, m);
    assert.ok(S.isSolved(c), S.MOVE_NAMES[m] + ' 做 4 次未復原');
    let d = S.newCube();
    for (let k = 0; k < times; k++) d = S.applyMove(d, m);
    assert.ok(S.isSolved(d), S.MOVE_NAMES[m] + ' 做 ' + times + ' 次未復原');
    // 貼紙層級也要成立
    let s = S.SOLVED_FACELETS;
    for (let k = 0; k < 4; k++) s = S.applyMoveFacelets(s, m);
    assert.equal(s, S.SOLVED_FACELETS);
  }
});

test('X 與 X′ 互逆，X2 = X·X', () => {
  for (let f = 0; f < 6; f++) {
    const X = 3 * f, X2 = 3 * f + 1, Xi = 3 * f + 2;
    assert.ok(S.isSolved(S.multiply(S.MOVE_CUBE[X], S.MOVE_CUBE[Xi])), S.MOVE_NAMES[X] + ' 後接 ' + S.MOVE_NAMES[Xi]);
    assert.ok(S.isSolved(S.multiply(S.MOVE_CUBE[Xi], S.MOVE_CUBE[X])), S.MOVE_NAMES[Xi] + ' 後接 ' + S.MOVE_NAMES[X]);
    assert.ok(S.cubeEquals(S.multiply(S.MOVE_CUBE[X], S.MOVE_CUBE[X]), S.MOVE_CUBE[X2]));
    assert.ok(!S.isSolved(S.MOVE_CUBE[X]));
  }
});

test('U 轉動方向：前面頂排移到左面（從上方看順時針）', () => {
  const s = S.applyMoveFacelets(S.SOLVED_FACELETS, 0);
  assert.equal(s.slice(36, 39), 'FFF'); // L1..L3
  assert.equal(s.slice(18, 21), 'RRR'); // F1..F3
  assert.equal(s.slice(9, 12), 'BBB');  // R1..R3
});

test('角塊命名的三個面皆為同一旋向（順時針）', () => {
  const N = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
  const signs = S.CORNER_NAMES.map((nm) => {
    const [a, b, c] = nm.split('').map((x) => N[x]);
    const cr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return Math.sign(cr[0] * c[0] + cr[1] * c[1] + cr[2] * c[2]);
  });
  assert.ok(signs.every((x) => x === signs[0]));
});

test('cubie 乘法與貼紙層級轉動一致（隨機 500 組序列）', () => {
  const rng = S.makeRng(7);
  for (let i = 0; i < 500; i++) {
    const n = 1 + Math.floor(rng() * 30);
    const moves = [];
    for (let k = 0; k < n; k++) moves.push(Math.floor(rng() * 18));
    let s = S.SOLVED_FACELETS;
    for (const m of moves) s = S.applyMoveFacelets(s, m);
    const c = S.applyMoves(ID, moves);
    assert.equal(S.cubieToFacelets(c), s);
    const back = S.faceletsToCubie(s);
    assert.ok(!back.error);
    assert.ok(S.cubeEquals(back.cube, c));
    assert.equal(S.verify(c), null);
  }
});

test('合法性檢查：正例（隨機狀態與打亂）', () => {
  const rng = S.makeRng(99);
  for (let i = 0; i < 1000; i++) {
    const c = S.randomCube(rng);
    assert.equal(S.verify(c), null);
    const r = S.faceletsToCubie(S.cubieToFacelets(c));
    assert.ok(S.cubeEquals(r.cube, c));
  }
  assert.equal(S.verify(S.newCube()), null);
});

test('合法性檢查：反例（單角扭轉、單邊翻轉、兩塊互換、重複方塊）', () => {
  const twist = S.newCube(); twist.co[0] = 1;
  assert.equal(S.verify(twist), 'CORNER_TWIST');
  const flip = S.newCube(); flip.eo[3] = 1;
  assert.equal(S.verify(flip), 'EDGE_FLIP');
  const swapE = S.newCube(); swapE.ep[0] = 1; swapE.ep[1] = 0;
  assert.equal(S.verify(swapE), 'PARITY');
  const swapC = S.newCube(); swapC.cp[0] = 1; swapC.cp[1] = 0;
  assert.equal(S.verify(swapC), 'PARITY');
  const both = S.newCube(); both.cp[0] = 1; both.cp[1] = 0; both.ep[0] = 1; both.ep[1] = 0;
  assert.equal(S.verify(both), null, '角與邊各換一次，奇偶一致，應合法');
  const dupC = S.newCube(); dupC.cp[0] = 1;
  assert.equal(S.verify(dupC), 'CORNER_PERM_INVALID');
  const dupE = S.newCube(); dupE.ep[5] = 4;
  assert.equal(S.verify(dupE), 'EDGE_PERM_INVALID');
  const badCo = S.newCube(); badCo.co[0] = 3; badCo.co[1] = 0;
  assert.equal(S.verify(badCo), 'CORNER_TWIST_INVALID');
});

test('貼紙字串錯誤碼', () => {
  const s = S.SOLVED_FACELETS;
  assert.equal(S.faceletsToCubie(s.slice(1)).error, 'LENGTH');
  assert.equal(S.faceletsToCubie('X' + s.slice(1)).error, 'BAD_COLOR');
  // 兩格互換顏色 → 數量仍 9 但出現不存在的角塊
  const arr = s.split(''); arr[0] = 'R'; arr[9] = 'U';
  assert.equal(S.faceletsToCubie(arr.join('')).error, 'CORNER_UNKNOWN');
  const arr2 = s.split(''); arr2[0] = 'R';
  assert.equal(S.faceletsToCubie(arr2.join('')).error, 'COLOR_COUNT');
  const arr3 = s.split(''); arr3[4] = 'R'; arr3[13] = 'U';
  assert.equal(S.faceletsToCubie(arr3.join('')).error, 'CENTER');
  // 角塊原地扭轉（貼紙可辨認，但不合法）
  const tw = S.newCube(); tw.co[0] = 1;
  const r = S.fromStickerColors(S.cubieToFacelets(tw).split(''));
  assert.equal(r.ok, false);
  assert.equal(r.error, 'CORNER_TWIST');
});

test('從貼紙顏色建立狀態：任意顏色名稱，依中心判定', () => {
  const color = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
  const moves = S.parseAlg("R U R' U' F2 D L' B");
  const c = S.applyMoves(S.newCube(), moves);
  const colors = S.cubieToFacelets(c).split('').map((x) => color[x]);
  const r = S.fromStickerColors(colors);
  assert.equal(r.ok, true);
  assert.ok(S.cubeEquals(r.cube, c));
  // 缺一個中心顏色
  const bad = colors.slice(); bad[13] = 'white';
  assert.equal(S.fromStickerColors(bad).error, 'CENTER_DUPLICATE');
  const bad2 = colors.slice(); bad2[0] = 'pink';
  assert.equal(S.fromStickerColors(bad2).error, 'BAD_COLOR');
  assert.equal(S.fromStickerColors(colors.slice(0, 53)).error, 'LENGTH');
});

test('座標：set/get 互逆，已解狀態座標', () => {
  const c = S.newCube();
  assert.equal(S.getTwist(c), 0);
  assert.equal(S.getFlip(c), 0);
  assert.equal(S.getCornPerm(c), 0);
  assert.equal(S.getUDEdgePerm(c), 0);
  assert.equal(S.getSlicePerm(c), 0);
  assert.equal(S.getSlice(c), S.SLICE_SOLVED);
});

test('seeded RNG：同 seed 同結果、不同 seed 不同結果', () => {
  const a = S.makeRng(123), b = S.makeRng(123), d = S.makeRng(124);
  const xa = [], xb = [], xd = [];
  for (let i = 0; i < 20; i++) { xa.push(a()); xb.push(b()); xd.push(d()); }
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, xd);
  const c1 = S.randomCube(S.makeRng(5)), c2 = S.randomCube(S.makeRng(5));
  assert.ok(S.cubeEquals(c1, c2));
});

test('整顆轉向共軛：conj(序列) 等於 轉向後的序列', () => {
  const rng = S.makeRng(11);
  for (let r = 1; r <= 2; r++) {
    // 轉向後 U/D 軸必須換成別的軸
    assert.notEqual(Math.floor(S.rotateMove(r, 0) / 3) % 3, 0);
    for (let i = 0; i < 100; i++) {
      const moves = [];
      for (let k = 0; k < 15; k++) moves.push(Math.floor(rng() * 18));
      const lhs = S.conjugate(S.applyMoves(S.newCube(), moves), r);
      const rhs = S.applyMoves(S.newCube(), moves.map((m) => S.rotateMove(r, m)));
      assert.ok(S.cubeEquals(lhs, rhs));
    }
  }
});

test('記號解析與反轉', () => {
  const m = S.parseAlg("R U2 F' D");
  assert.equal(S.formatAlg(m), "R U2 F' D");
  assert.equal(S.formatAlg(S.invertAlg(m)), "D' F U2 R'");
  assert.ok(S.isSolved(S.applyMoves(S.applyMoves(S.newCube(), m), S.invertAlg(m))));
  assert.equal(S.qtmLength(m), 5);
  assert.equal(S.htmLength(m), 4);
});
