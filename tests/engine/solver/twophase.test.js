// tests/engine/solver/twophase.test.js — src/solver/twophase.js 的驗收測試（T-001 S4）
// 對應 game-spec.md §12：T-ENG-05、T-SOL-01～T-SOL-07、T-SOL-09、T-SOL-10（T-SOL-08 由 S6 負責）。
// 測試檔可以量測時間（只用於輸出耗時，不影響判定）；求解器本身不讀時鐘。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var crypto = require('node:crypto');
var childProcess = require('node:child_process');

var ROOT = path.join(__dirname, '..', '..', '..');
var SOLVER_PATH = path.join(ROOT, 'src', 'solver', 'twophase.js');
var S = require(SOLVER_PATH);
var cube = require('../../../src/engine/cube.js');

// 與 .claude/hooks/check-forbidden.sh 相同的正規表示式
var FORBIDDEN = /Math\.random|Date\.now|new Date\(|performance\.now|localStorage|sessionStorage|document\.|window\.|navigator\.|fetch\(|setTimeout|setInterval|requestAnimationFrame/;

// 與 game-spec.md §7.4／params.json 相同的求解參數
var SOLVE_OPTS = { metric: 'qtm', nodeLimit: 3000000, firstNodeLimit: 30000000, maxLength: 45, phase2Cap: 20 };

function msSince(t0) { return Number(process.hrtime.bigint() - t0) / 1e6; }

// ---- 建表（整個檔案只建一次），同時記錄時間與進度回呼 ----
var progressCalls = [];
var initT0 = process.hrtime.bigint();
var initInfo = S.init({ metrics: ['qtm'], twistFlip: true, cornerTable: false }, function (step, total, label) {
  progressCalls.push([step, total, label]);
});
var initMs = msSince(initT0);

// 貼紙字母字串 → engine 色號陣列（U R F D L B → 0..5）
function lettersToColors(s) {
  return s.split('').map(function (ch) { return S.FACES.indexOf(ch); });
}

// 在 engine 模型上模擬「玩家在 view 座標做一個記號」（與 reducer 的規則相同：整顆旋轉只改朝向）
function playViewMove(st, viewMove) {
  if (cube.kind(viewMove) === 'rotation') {
    return { home: st.home, orient: cube.orientAfter(st.orient, viewMove) };
  }
  return { home: cube.applyMove(st.home, cube.toHome(st.orient, viewMove)), orient: st.orient };
}

test('T-ENG-05：外層 18 個記號的貼紙置換與 solver/twophase.js 的 applyMoveFacelets 完全一致', function () {
  var identity = [];
  for (var i = 0; i < 54; i++) identity.push(i);
  assert.equal(S.MOVE_NAMES.length, 18);
  for (var m = 0; m < 18; m++) {
    var name = S.MOVE_NAMES[m];
    // 記號名稱與順序：engine MOVES 的前 18 個
    assert.equal(cube.MOVES[m], name, '第 ' + m + ' 個記號名稱不同');
    assert.equal(cube.kind(name), 'outer');
    // 置換本身（套在 0..53 上）
    assert.deepEqual(S.applyMoveFacelets(identity, m), cube.applyMove(identity, name), name + ' 置換不同');
    // 已復原狀態上的色號
    assert.deepEqual(S.applyMoveFacelets(cube.SOLVED.slice(), m), cube.applyMove(cube.SOLVED, name), name + ' 色號不同');
    // QTM 成本一致
    assert.equal(S.qtmLength([m]), cube.qtmCost(name), name + ' QTM 不同');
  }
  // 隨機 200 組外層序列：兩邊逐步套用結果相同
  var rng = S.makeRng(505);
  for (var k = 0; k < 200; k++) {
    var a = cube.SOLVED.slice(), b = cube.SOLVED.slice();
    for (var j = 0; j < 25; j++) {
      var mv = Math.floor(rng() * 18);
      a = S.applyMoveFacelets(a, mv);
      b = cube.applyMove(b, S.MOVE_NAMES[mv]);
    }
    assert.deepEqual(a, b);
  }
});

test('T-SOL-01：cubie 乘法與貼紙轉動一致（隨機 500 組序列）', function () {
  var ID = S.newCube();
  var rng = S.makeRng(7);
  for (var i = 0; i < 500; i++) {
    var n = 1 + Math.floor(rng() * 30);
    var moves = [];
    for (var k = 0; k < n; k++) moves.push(Math.floor(rng() * 18));
    var s = S.SOLVED_FACELETS;
    for (var j = 0; j < moves.length; j++) s = S.applyMoveFacelets(s, moves[j]);
    var c = S.applyMoves(ID, moves);
    assert.equal(S.cubieToFacelets(c), s);
    var back = S.faceletsToCubie(s);
    assert.ok(!back.error, back.error);
    assert.ok(S.cubeEquals(back.cube, c));
    assert.equal(S.verify(c), null);
  }
  // applyMoves 不修改輸入
  assert.ok(S.isSolved(ID));
  // 每個轉動做 4 次（180° 做 2 次）回原狀；X 與 X′ 互逆；X2 = X·X
  for (var m = 0; m < 18; m++) {
    var times = (m % 3 === 1) ? 2 : 4;
    var d = S.newCube();
    for (var t = 0; t < times; t++) d = S.applyMove(d, m);
    assert.ok(S.isSolved(d), S.MOVE_NAMES[m]);
    assert.ok(!S.isSolved(S.MOVE_CUBE[m]));
  }
  for (var f = 0; f < 6; f++) {
    var X = 3 * f, X2 = 3 * f + 1, Xi = 3 * f + 2;
    assert.ok(S.isSolved(S.multiply(S.MOVE_CUBE[X], S.MOVE_CUBE[Xi])));
    assert.ok(S.isSolved(S.multiply(S.MOVE_CUBE[Xi], S.MOVE_CUBE[X])));
    assert.ok(S.cubeEquals(S.multiply(S.MOVE_CUBE[X], S.MOVE_CUBE[X]), S.MOVE_CUBE[X2]));
  }
  // random-state 的合法性與互轉
  var rng2 = S.makeRng(99);
  for (var q = 0; q < 1000; q++) {
    var rc = S.randomCube(rng2);
    assert.equal(S.verify(rc), null);
    assert.ok(S.cubeEquals(S.faceletsToCubie(S.cubieToFacelets(rc)).cube, rc));
  }
});

test('T-SOL-02：verify 反例（單角扭轉、單邊翻轉、兩塊互換、重複方塊）', function () {
  assert.equal(S.verify(S.newCube()), null);
  var twist = S.newCube(); twist.co[0] = 1;
  assert.equal(S.verify(twist), 'CORNER_TWIST');
  var flip = S.newCube(); flip.eo[3] = 1;
  assert.equal(S.verify(flip), 'EDGE_FLIP');
  var swapE = S.newCube(); swapE.ep[0] = 1; swapE.ep[1] = 0;
  assert.equal(S.verify(swapE), 'PARITY');
  var swapC = S.newCube(); swapC.cp[0] = 1; swapC.cp[1] = 0;
  assert.equal(S.verify(swapC), 'PARITY');
  var both = S.newCube(); both.cp[0] = 1; both.cp[1] = 0; both.ep[0] = 1; both.ep[1] = 0;
  assert.equal(S.verify(both), null, '角與邊各換一次，奇偶一致，應合法');
  var dupC = S.newCube(); dupC.cp[0] = 1;
  assert.equal(S.verify(dupC), 'CORNER_PERM_INVALID');
  var dupE = S.newCube(); dupE.ep[5] = 4;
  assert.equal(S.verify(dupE), 'EDGE_PERM_INVALID');
  var badCo = S.newCube(); badCo.co[0] = 3; badCo.co[1] = 0;
  assert.equal(S.verify(badCo), 'CORNER_TWIST_INVALID');
  var badEo = S.newCube(); badEo.eo[0] = 2;
  assert.equal(S.verify(badEo), 'EDGE_FLIP_INVALID');
});

test('T-SOL-03：1,000 個 random-state（seed 20260915）以 nodeLimit 3,000,000 求解：100% 復原、QTM 最大 ≤ 32、平均 ≤ 27.7', function (t) {
  var rng = S.makeRng(20260915);
  var hist = {}, sum = 0, max = 0, ok = 0, fallback = 0;
  var times = [], firstNodes = [], maxNodes = 0;
  var digest = crypto.createHash('sha1');
  var t0 = process.hrtime.bigint();
  for (var i = 0; i < 1000; i++) {
    var c = S.randomCube(rng);
    var a = process.hrtime.bigint();
    var r = S.solve(c, SOLVE_OPTS);
    times.push(msSince(a));
    assert.ok(!r.error, '第 ' + i + ' 局失敗：' + r.error);
    assert.ok(S.isSolved(S.applyMoves(c, r.moves)), '第 ' + i + ' 局未復原');
    assert.equal(r.qtm, S.qtmLength(r.moves));
    assert.equal(r.alg, r.names.join(' '));
    assert.deepEqual(r.names, r.moves.map(function (m) { return S.MOVE_NAMES[m]; }));
    for (var k = 1; k < r.moves.length; k++) {
      assert.notEqual(Math.floor(r.moves[k] / 3), Math.floor(r.moves[k - 1] / 3), '第 ' + i + ' 局出現同面相鄰');
    }
    ok++;
    sum += r.qtm;
    if (r.qtm > max) max = r.qtm;
    hist[r.qtm] = (hist[r.qtm] || 0) + 1;
    if (r.fallback) fallback++;
    firstNodes.push(r.firstNodes);
    if (r.nodes > maxNodes) maxNodes = r.nodes;
    digest.update(r.alg + '\n');
  }
  var totalMs = msSince(t0);
  var avg = sum / 1000;
  times.sort(function (x, y) { return x - y; });
  firstNodes.sort(function (x, y) { return x - y; });
  var avgMs = times.reduce(function (x, y) { return x + y; }, 0) / times.length;
  var keys = Object.keys(hist).map(Number).sort(function (x, y) { return x - y; });
  t.diagnostic('復原 ' + ok + '/1000；QTM 平均 ' + avg.toFixed(2) + '、最大 ' + max + '；phase2Cap 重搜 ' + fallback + ' 局');
  t.diagnostic('QTM 直方圖 ' + JSON.stringify(hist));
  keys.forEach(function (q) {
    t.diagnostic('  ' + q + ' QTM ' + String(hist[q]).padStart(4) + ' ' + '*'.repeat(Math.ceil(hist[q] / 5)));
  });
  t.diagnostic('耗時（Node）：合計 ' + (totalMs / 1000).toFixed(1) + ' s；每局平均 ' + avgMs.toFixed(1) +
    ' ms、p95 ' + times[Math.floor(0.95 * times.length)].toFixed(1) + ' ms、最大 ' + times[times.length - 1].toFixed(1) + ' ms');
  t.diagnostic('第一組解節點：p95 ' + firstNodes[Math.floor(0.95 * firstNodes.length)] + '、最大 ' +
    firstNodes[firstNodes.length - 1] + '；總節點最大 ' + maxNodes);
  t.diagnostic('1,000 條解的 sha1 ' + digest.digest('hex'));
  assert.equal(ok, 1000);
  assert.ok(max <= 32, 'QTM 最大 ' + max + ' > 32');
  assert.ok(avg <= 27.7, 'QTM 平均 ' + avg + ' > 27.7');
  // 與 G3 實測（game-spec.md §7.4、docs/spec/checks/results-nodes.txt）的直方圖相同：確認改寫未改變搜尋行為
  assert.deepEqual(hist, { 22: 1, 23: 3, 24: 27, 25: 54, 26: 140, 27: 202, 28: 288, 29: 191, 30: 72, 31: 16, 32: 6 });
});

test('T-SOL-04：同一狀態求解兩次，moves 完全相同；原始碼無時鐘', function () {
  var rng = S.makeRng(55);
  for (var i = 0; i < 20; i++) {
    var c = S.randomCube(rng);
    var snapshot = S.cubieToFacelets(c);
    var a = S.solve(c, SOLVE_OPTS);
    var b = S.solve(c, SOLVE_OPTS);
    assert.deepStrictEqual(a, b);
    assert.deepStrictEqual(a.moves, b.moves);
    // solve 不修改輸入
    assert.equal(S.cubieToFacelets(c), snapshot);
    // 由貼紙重建的等價狀態也得到同一解
    var c2 = S.faceletsToCubie(snapshot).cube;
    assert.deepStrictEqual(S.solve(c2, SOLVE_OPTS), a);
  }
  // 另起一個 Node 行程（全新建表）求同一狀態，結果與本行程相同
  var script = 'var S=require(' + JSON.stringify(SOLVER_PATH) + ');S.init({metrics:["qtm"],twistFlip:true,cornerTable:false});' +
    'var r=S.solve(S.randomCube(S.makeRng(20260915)),' + JSON.stringify(SOLVE_OPTS) + ');' +
    'process.stdout.write(JSON.stringify(r));';
  var out = JSON.parse(childProcess.execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
  var local = S.solve(S.randomCube(S.makeRng(20260915)), SOLVE_OPTS);
  assert.deepStrictEqual(out, JSON.parse(JSON.stringify(local)));
  // 原始碼（含註解）不得出現 check-forbidden.sh 所列字串
  var src = fs.readFileSync(SOLVER_PATH, 'utf8').split('\n');
  src.forEach(function (line, idx) {
    assert.ok(!FORBIDDEN.test(line), 'twophase.js 第 ' + (idx + 1) + ' 行含禁用字串：' + line);
  });
});

test('T-SOL-05：firstNodeLimit: 1000 時對隨機狀態回 NODE_LIMIT', function () {
  var rng = S.makeRng(31337);
  for (var i = 0; i < 20; i++) {
    var c = S.randomCube(rng);
    var r = S.solve(c, { metric: 'qtm', nodeLimit: 3000000, firstNodeLimit: 1000, maxLength: 45, phase2Cap: 20 });
    assert.equal(r.error, 'NODE_LIMIT', '第 ' + i + ' 局');
    assert.equal(typeof r.nodes, 'number');
    assert.ok(r.nodes > 1000 && r.nodes <= 1024, '節點數 ' + r.nodes);
    assert.equal(r.moves, undefined);
  }
  // nodeLimit 只在找到第一組解之後生效：nodeLimit 0 仍回傳一組可復原的解
  var c0 = S.randomCube(S.makeRng(20260915));
  var r0 = S.solve(c0, { nodeLimit: 0, firstNodeLimit: 30000000 });
  assert.ok(!r0.error, r0.error);
  assert.ok(S.isSolved(S.applyMoves(c0, r0.moves)));
  assert.equal(r0.complete, false);
});

test('T-SOL-06：已復原狀態回空解；非法狀態回對應錯誤碼', function () {
  var r = S.solve(S.newCube(), SOLVE_OPTS);
  assert.deepEqual(r.moves, []);
  assert.deepEqual(r.names, []);
  assert.equal(r.alg, '');
  assert.equal(r.qtm, 0);
  assert.equal(r.complete, true);

  // solve 直接收到非法 cubie
  var cases = [
    ['CORNER_TWIST', function (c) { c.co[0] = 1; }],
    ['EDGE_FLIP', function (c) { c.eo[0] = 1; }],
    ['PARITY', function (c) { c.ep[0] = 1; c.ep[1] = 0; }],
    ['CORNER_PERM_INVALID', function (c) { c.cp[0] = 1; }],
    ['EDGE_PERM_INVALID', function (c) { c.ep[5] = 4; }]
  ];
  cases.forEach(function (cs) {
    var c = S.newCube(); cs[1](c);
    var res = S.solve(c, SOLVE_OPTS);
    assert.equal(res.error, cs[0]);
    assert.equal(res.nodes, 0);
  });

  // fromStickerColors：由 engine 色號（0..5）建立狀態，錯誤碼沿用 spike（game-spec.md §3.4）
  var solvedColors = cube.SOLVED.slice();
  var ok = S.fromStickerColors(solvedColors);
  assert.equal(ok.ok, true);
  assert.equal(ok.facelets, S.SOLVED_FACELETS);
  assert.ok(S.isSolved(ok.cube));
  assert.equal(S.solve(ok.cube, SOLVE_OPTS).moves.length, 0);

  assert.equal(S.fromStickerColors(solvedColors.slice(0, 53)).error, 'LENGTH');
  assert.equal(S.fromStickerColors(null).error, 'LENGTH');
  var dupCenter = solvedColors.slice(); dupCenter[13] = 0;
  assert.equal(S.fromStickerColors(dupCenter).error, 'CENTER_DUPLICATE');
  var badColor = solvedColors.slice(); badColor[0] = 9;
  assert.equal(S.fromStickerColors(badColor).error, 'BAD_COLOR');
  var cornerUnknown = S.SOLVED_FACELETS.split(''); cornerUnknown[0] = 'R'; cornerUnknown[9] = 'U';
  assert.equal(S.fromStickerColors(lettersToColors(cornerUnknown.join(''))).error, 'CORNER_UNKNOWN');
  var edgeUnknown = S.SOLVED_FACELETS.split(''); edgeUnknown[19] = 'D'; edgeUnknown[28] = 'F';
  assert.equal(S.fromStickerColors(lettersToColors(edgeUnknown.join(''))).error, 'EDGE_UNKNOWN');
  var colorCount = solvedColors.slice(); colorCount[0] = 1;
  assert.equal(S.fromStickerColors(colorCount).error, 'COLOR_COUNT');
  [['CORNER_TWIST', function (c) { c.co[0] = 1; c.co[1] = 2; c.co[2] = 1; }],
    ['EDGE_FLIP', function (c) { c.eo[3] = 1; }],
    ['PARITY', function (c) { c.ep[0] = 1; c.ep[1] = 0; }],
    ['PARITY', function (c) { c.cp[0] = 1; c.cp[1] = 0; }]
  ].forEach(function (cs) {
    var c = S.newCube(); cs[1](c);
    var res = S.fromStickerColors(lettersToColors(S.cubieToFacelets(c)));
    assert.equal(res.ok, false);
    assert.equal(res.error, cs[0]);
  });
  // 任意顏色標籤也可（以中心判定）
  var names = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
  var mv = S.parseAlg("R U R' U' F2 D L' B");
  var cc = S.applyMoves(S.newCube(), mv);
  var fr = S.fromStickerColors(S.cubieToFacelets(cc).split('').map(function (x) { return names[x]; }));
  assert.equal(fr.ok, true);
  assert.ok(S.cubeEquals(fr.cube, cc));

  // faceletsToCubie 的字串層錯誤碼
  assert.equal(S.faceletsToCubie(S.SOLVED_FACELETS.slice(1)).error, 'LENGTH');
  assert.equal(S.faceletsToCubie('X' + S.SOLVED_FACELETS.slice(1)).error, 'BAD_COLOR');
  var ctr = S.SOLVED_FACELETS.split(''); ctr[4] = 'R'; ctr[13] = 'U';
  assert.equal(S.faceletsToCubie(ctr.join('')).error, 'CENTER');
});

test('T-SOL-07：正規化：200 局含中層與整顆旋轉的隨機序列 → viewStickers → 求解 → 以 toHome 套回 → 復原', function (t) {
  var rng = S.makeRng(20260917);
  var sumQ = 0, maxQ = 0, slices = 0, rots = 0;
  for (var i = 0; i < 200; i++) {
    var st = { home: cube.SOLVED.slice(), orient: 0 };
    var len = 20 + Math.floor(rng() * 11);
    for (var k = 0; k < len; k++) {
      var mv = cube.MOVES[Math.floor(rng() * cube.MOVES.length)];
      if (cube.kind(mv) === 'slice') slices++;
      if (cube.kind(mv) === 'rotation') rots++;
      st = playViewMove(st, mv);
    }
    var view = cube.applyOrient(st.home, st.orient);
    var fr = S.fromStickerColors(view);
    assert.equal(fr.ok, true, '第 ' + i + ' 局非法：' + fr.error);
    var r = S.solve(fr.cube, SOLVE_OPTS);
    assert.ok(!r.error, '第 ' + i + ' 局求解失敗：' + r.error);
    var orientAtRequest = st.orient;
    r.names.forEach(function (name) {
      assert.equal(cube.kind(name), 'outer');
      st = playViewMove(st, name);
      assert.equal(st.orient, orientAtRequest, '外層轉動不應改變朝向');
    });
    // home 與 view 都復原（套回時等同於 home 做 toHome(請求當下的 orient, 記號)）
    assert.ok(cube.isSolved(st.home), '第 ' + i + ' 局 home 未復原');
    assert.ok(cube.isSolved(cube.applyOrient(st.home, st.orient)), '第 ' + i + ' 局 view 未復原');
    sumQ += r.qtm;
    if (r.qtm > maxQ) maxQ = r.qtm;
  }
  assert.ok(slices > 0 && rots > 0, '隨機序列必須含中層與整顆旋轉');
  t.diagnostic('200/200 復原；序列內中層 ' + slices + ' 次、整顆旋轉 ' + rots + ' 次；建議解 QTM 平均 ' +
    (sumQ / 200).toFixed(2) + '、最大 ' + maxQ);
});

test('T-SOL-09：tableInfo().totalBytes === 10939101', function (t) {
  var info = S.tableInfo();
  t.diagnostic('tableInfo ' + JSON.stringify(info));
  assert.deepEqual(Object.keys(info).sort(), ['moveBytes', 'pruneBytes', 'totalBytes']);
  assert.equal(info.totalBytes, 10939101);
  assert.equal(info.moveBytes + info.pruneBytes, info.totalBytes);
  assert.deepEqual(initInfo, info, 'init 的回傳值與 tableInfo() 相同');
});

test('T-SOL-10：Node 建表時間記錄（僅輸出，不判定通過）', function (t) {
  t.diagnostic('init({metrics:[\'qtm\'], twistFlip:true, cornerTable:false}) 冷啟動 ' + initMs.toFixed(1) + ' ms（spike 桌機 1,027.2 ms）');
  if (initMs > 1500) t.diagnostic('警告：建表時間 ' + initMs.toFixed(1) + ' ms 超過 1,500 ms');
  // 進度回呼：6 次、順序與標籤固定（game-spec.md §7.2）
  assert.deepEqual(progressCalls, [
    [1, 6, 'moveTables'], [2, 6, 'p1TS'], [3, 6, 'p1FS'], [4, 6, 'p2CS'], [5, 6, 'p2ES'], [6, 6, 'p1TF']
  ]);
  // 重複 init 不重建，但仍回報 6 次進度
  var again = [];
  var t0 = process.hrtime.bigint();
  S.init({ metrics: ['qtm'], twistFlip: true, cornerTable: false }, function (s, total, label) { again.push([s, total, label]); });
  t.diagnostic('第二次 init ' + msSince(t0).toFixed(1) + ' ms（不重建）');
  assert.deepEqual(again, progressCalls);
  S.init(); // options 與 onProgress 皆可省略
});

test('介面：init 選項檢查、未建表、參數預設值與 params.json 一致、記號解析', function () {
  // 只接受 QTM 設定
  assert.throws(function () { S.init({ metrics: ['htm'] }); });
  assert.throws(function () { S.init({ metrics: ['qtm', 'htm'] }); });
  assert.throws(function () { S.init({ twistFlip: false }); });
  assert.throws(function () { S.init({ cornerTable: true }); });
  // 不支援的成本
  assert.equal(S.solve(S.newCube(), { metric: 'htm' }).error, 'UNSUPPORTED_METRIC');
  // 未建表時回錯誤而不拋例外（另起行程）
  var script = 'var S=require(' + JSON.stringify(SOLVER_PATH) + ');' +
    'process.stdout.write(JSON.stringify([S.isReady(),S.tableInfo(),S.solve(S.newCube())]));';
  var out = JSON.parse(childProcess.execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
  assert.deepEqual(out, [false, { moveBytes: 0, pruneBytes: 0, totalBytes: 0 }, { error: 'NOT_INITIALIZED', nodes: 0 }]);
  assert.equal(S.isReady(), true);
  // maxLength 太短 → 兩輪搜尋皆無解 → NO_SOLUTION
  var nr = S.solve(S.randomCube(S.makeRng(1)), { maxLength: 5 });
  assert.equal(nr.error, 'NO_SOLUTION');
  // 預設值與 src/data/params.json（唯讀）一致
  var params = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'params.json'), 'utf8'));
  ['metric', 'nodeLimit', 'firstNodeLimit', 'maxLength', 'phase2Cap'].forEach(function (k) {
    assert.equal(S.DEFAULT_SOLVE_OPTS[k], params.solver[k], 'DEFAULT_SOLVE_OPTS.' + k);
    assert.equal(SOLVE_OPTS[k], params.solver[k], '測試用 SOLVE_OPTS.' + k);
  });
  assert.ok(Object.isFrozen(S.DEFAULT_SOLVE_OPTS));
  // 未傳 opts 時使用預設值，結果與明確傳入相同
  var c = S.randomCube(S.makeRng(77));
  assert.deepStrictEqual(S.solve(c), S.solve(c, SOLVE_OPTS));
  // 記號解析：′ 的三種寫法；反序列
  var m = S.parseAlg("R U2 F' D");
  assert.deepEqual(S.parseAlg('R U2 F’ D'), m);
  assert.deepEqual(S.parseAlg('R U2 F′ D'), m);
  assert.equal(S.formatAlg(m), "R U2 F' D");
  assert.equal(S.formatAlg(S.invertAlg(m)), "D' F U2 R'");
  assert.equal(S.qtmLength(m), 5);
  assert.throws(function () { S.parseAlg('M'); });
  // seeded RNG：同 seed 同結果，且與 src/engine/rng.js 相同
  var engineRng = require('../../../src/engine/rng.js');
  var a = S.makeRng(123), b = engineRng.makeRng(123), d = S.makeRng(124);
  var xa = [], xb = [], xd = [];
  for (var i = 0; i < 20; i++) { xa.push(a()); xb.push(b()); xd.push(d()); }
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, xd);
  assert.ok(S.cubeEquals(S.randomCube(S.makeRng(5)), S.randomCube(S.makeRng(5))));
  // 附加匯出齊全（分派單 S4 輸出契約）
  ['init', 'tableInfo', 'solve', 'fromStickerColors', 'verify', 'faceletsToCubie', 'cubieToFacelets',
    'applyMoveFacelets', 'applyMoves', 'isSolved', 'newCube', 'randomCube', 'makeRng', 'qtmLength'].forEach(function (k) {
    assert.equal(typeof S[k], 'function', k);
  });
  assert.ok(Array.isArray(S.MOVE_NAMES));
  // 已移除的 spike 函式（game-spec.md §7.3 第 6 點）
  ['solveOptimalQTM', 'randomQuarterScramble', 'conjugate', 'rotateMove'].forEach(function (k) {
    assert.equal(S[k], undefined, k + ' 應已移除');
  });
});
