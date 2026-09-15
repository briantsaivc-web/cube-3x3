// 求解正確性測試（node --test）：1,000 個固定 seed 隨機狀態必定復原
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../solver.js');

S.init({ metrics: ['htm', 'qtm'], twistFlip: true, cornerTable: true });

test('1,000 個 random-state（seed=20260915）HTM 兩階段求解後必定復原', (t) => {
  const rng = S.makeRng(20260915);
  let maxH = 0, maxQ = 0, sumH = 0, ok = 0;
  for (let i = 0; i < 1000; i++) {
    const c = S.randomCube(rng);
    const r = S.solve(c, { metric: 'htm', timeLimitMs: 10 });
    assert.ok(!r.error, '第 ' + i + ' 局失敗：' + r.error);
    assert.ok(S.isSolved(S.applyMoves(c, r.moves)), '第 ' + i + ' 局未復原');
    // 解中不得出現同面相鄰
    for (let k = 1; k < r.moves.length; k++) assert.notEqual(Math.floor(r.moves[k] / 3), Math.floor(r.moves[k - 1] / 3));
    ok++;
    sumH += r.htm;
    if (r.htm > maxH) maxH = r.htm;
    if (r.qtm > maxQ) maxQ = r.qtm;
  }
  assert.equal(ok, 1000);
  t.diagnostic('復原 ' + ok + '/1000；HTM 最長 ' + maxH + '、平均 ' + (sumH / 1000).toFixed(2) + '；該解換算 QTM 最長 ' + maxQ);
});

test('100 個 random-state 以 QTM 成本搜尋後必定復原', (t) => {
  const rng = S.makeRng(777);
  let maxQ = 0;
  for (let i = 0; i < 100; i++) {
    const c = S.randomCube(rng);
    const r = S.solve(c, { metric: 'qtm', timeLimitMs: 10 });
    assert.ok(!r.error, r.error);
    assert.ok(S.isSolved(S.applyMoves(c, r.moves)));
    assert.equal(r.length, r.qtm);
    if (r.qtm > maxQ) maxQ = r.qtm;
  }
  t.diagnostic('QTM 搜尋 100/100 復原；QTM 最長 ' + maxQ);
});

test('節點預算（不讀時鐘）結果可重現', (t) => {
  const rng = S.makeRng(55);
  let sumMs = 0, sumNodes = 0;
  for (let i = 0; i < 20; i++) {
    const c = S.randomCube(rng);
    const a = S.solve(c, { metric: 'qtm', timeLimitMs: Infinity, nodeLimit: 300000 });
    const b = S.solve(c, { metric: 'qtm', timeLimitMs: Infinity, nodeLimit: 300000 });
    assert.deepEqual(a.moves, b.moves);
    assert.ok(S.isSolved(S.applyMoves(c, a.moves)));
    sumMs += a.timeMs; sumNodes += a.nodes;
  }
  t.diagnostic('nodeLimit=300000：平均 ' + (sumMs / 20).toFixed(1) + ' ms、' + Math.round(sumNodes / 20) + ' 節點／局');
});

test('已解狀態回傳空解；非法狀態回傳錯誤碼', () => {
  const r = S.solve(S.newCube());
  assert.equal(r.moves.length, 0);
  const bad = S.newCube(); bad.eo[0] = 1;
  assert.equal(S.solve(bad).error, 'EDGE_FLIP');
});

test('短打亂 QTM 最少步：與暴力 BFS（深度 ≤ 5）結果一致', (t) => {
  // 以貼紙字串為鍵，BFS 出 QTM 距離 ≤ 5 的所有狀態
  const dist = new Map([[S.SOLVED_FACELETS, 0]]);
  let frontier = [S.SOLVED_FACELETS];
  const Q = [0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17];
  for (let d = 1; d <= 5; d++) {
    const next = [];
    for (const s of frontier) for (const m of Q) {
      const u = S.applyMoveFacelets(s, m);
      if (!dist.has(u)) { dist.set(u, d); next.push(u); }
    }
    frontier = next;
  }
  const rng = S.makeRng(4242);
  let checked = 0;
  for (let n = 1; n <= 7; n++) {
    for (let i = 0; i < 15; i++) {
      const sc = S.randomQuarterScramble(rng, n);
      const c = S.applyMoves(S.newCube(), sc);
      const r = S.solveOptimalQTM(c, { maxDepth: 12 });
      assert.ok(!r.error);
      assert.ok(S.isSolved(S.applyMoves(c, r.moves)));
      assert.ok(r.qtm <= n);
      const key = S.cubieToFacelets(c);
      if (dist.has(key)) { assert.equal(r.qtm, dist.get(key)); checked++; }
      else assert.ok(r.qtm >= 6, '不在 BFS≤5 內，最少步必須 ≥ 6');
    }
  }
  t.diagnostic('BFS 狀態數 ' + dist.size + '；與 BFS 逐一比對 ' + checked + ' 局');
});
