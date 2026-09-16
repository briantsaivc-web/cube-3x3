// tests/engine/solver/worker.test.js — T-SOL-08：Worker 訊息協定（在 Node 直接呼叫 handleMessage）
//
// 依據：game-spec.md §9.5、§12.2 T-SOL-08；分派單 T-001 S6；技術裁決 D-3、D-5。
// 本檔的測試依序執行（node:test 同檔預設序列），第一個測試必須在 init 之前跑。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..', '..');
var worker = require(path.join(ROOT, 'src/solver/worker.js'));
var twophase = require(path.join(ROOT, 'src/solver/twophase.js'));
var lbl = require(path.join(ROOT, 'src/solver/lbl.js'));
var engine = require(path.join(ROOT, 'src/engine/index.js'));
var rngModule = require(path.join(ROOT, 'src/engine/rng.js'));

var params = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/params.json'), 'utf8'));
var lblConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/lbl.json'), 'utf8'));

// 同步收集回覆
function send(msg) {
  var out = [];
  worker.handleMessage(msg, function (m) { out.push(m); });
  return out;
}

// 以 seed 產生含中層與整顆旋轉的隨機 view 貼紙（36 記號任取）
function randomView(seed, n) {
  var rng = rngModule.makeRng(seed);
  var s = engine.SOLVED.slice();
  for (var i = 0; i < n; i++) {
    s = engine.applyMove(s, engine.MOVES[Math.floor(rng() * engine.MOVES.length)]);
  }
  return s;
}

// 單角扭轉（不可解）：把 URF 角的三格顏色循環移位（U9=8、R1=9、F3=20）
function twistedView() {
  var s = engine.SOLVED.slice();
  var t = s[8];
  s[8] = s[9];
  s[9] = s[20];
  s[20] = t;
  return s;
}

test('T-SOL-08：init 之前送 solve 回 NOT_READY；lbl 不需建表即可處理', function () {
  worker.resetForTest();
  var view = randomView(1, 30);
  if (!twophase.isReady()) {
    var r1 = send({ type: 'solve', id: 1, stickers: view });
    assert.equal(r1.length, 1);
    assert.equal(r1[0].type, 'error');
    assert.equal(r1[0].id, 1);
    assert.equal(r1[0].code, 'NOT_READY');
  }
  var r2 = send({ type: 'lbl', id: 2, stickers: view, config: lblConfig });
  assert.equal(r2.length, 1);
  assert.equal(r2[0].type, 'result');
  assert.equal(r2[0].kind, 'lbl');
  assert.equal(r2[0].id, 2);
});

test('T-SOL-08：init → 6 次 progress → ready（id 相符、tableBytes 10939101）', function () {
  var r0 = send({ type: 'init', id: 7 });
  assert.equal(r0.length, 1, '缺 params 應只回一則錯誤');
  assert.equal(r0[0].code, 'BAD_REQUEST');

  var out = send({ type: 'init', id: 8, params: params.solver });
  assert.equal(out.length, 7);
  var labels = [];
  for (var i = 0; i < 6; i++) {
    assert.equal(out[i].type, 'progress');
    assert.equal(out[i].id, 8);
    assert.equal(out[i].step, i + 1);
    assert.equal(out[i].total, 6);
    labels.push(out[i].label);
  }
  assert.deepEqual(labels, ['moveTables', 'p1TS', 'p1FS', 'p2CS', 'p2ES', 'p1TF']);
  assert.deepEqual(out[6], { type: 'ready', id: 8, tableBytes: 10939101 });

  // 重複 init：不重建，但協定相同
  var again = send({ type: 'init', id: 9, params: params.solver });
  assert.equal(again.length, 7);
  assert.equal(again[6].type, 'ready');
  assert.equal(again[6].id, 9);
});

test('T-SOL-08：solve 回 result（id 相符、moves 為字串且可復原、同輸入結果相同）', function () {
  for (var k = 0; k < 5; k++) {
    var view = randomView(100 + k, 40);
    var id = 20 + k;
    var out = send({ type: 'solve', id: id, stickers: view });
    assert.equal(out.length, 1);
    var r = out[0];
    assert.equal(r.type, 'result');
    assert.equal(r.kind, 'solve');
    assert.equal(r.id, id);
    assert.ok(Array.isArray(r.moves));
    r.moves.forEach(function (m) { assert.equal(typeof m, 'string'); });
    assert.ok(engine.isSolved(engine.applyMoves(view, r.moves)), '解套回 view 後應復原');
    var q = 0;
    r.moves.forEach(function (m) { q += engine.qtmCost(m); });
    assert.equal(r.qtm, q);
    assert.ok(r.qtm <= params.solver.maxLength);
    assert.equal(typeof r.nodes, 'number');
    assert.equal(typeof r.complete, 'boolean');
    // 可重現：同輸入再送一次（id 不同），moves 完全相同
    var again = send({ type: 'solve', id: id + 100, stickers: view });
    assert.equal(again[0].id, id + 100);
    assert.deepEqual(again[0].moves, r.moves);
    assert.equal(again[0].nodes, r.nodes);
  }
  // 已復原：空解
  var solved = send({ type: 'solve', id: 40, stickers: engine.SOLVED.slice() });
  assert.equal(solved[0].type, 'result');
  assert.deepEqual(solved[0].moves, []);
});

test('T-SOL-08：solve 的參數來自 init 的 params.solver（D-3），opts 可覆寫', function () {
  var view = randomView(555, 40);
  // opts 覆寫 firstNodeLimit → NODE_LIMIT
  var r1 = send({ type: 'solve', id: 50, stickers: view, opts: { firstNodeLimit: 1000 } });
  assert.equal(r1[0].type, 'error');
  assert.equal(r1[0].id, 50);
  assert.equal(r1[0].code, 'NODE_LIMIT');

  // 以較小的 firstNodeLimit 重新 init，之後不帶 opts 的 solve 也應回 NODE_LIMIT
  var small = Object.assign({}, params.solver, { firstNodeLimit: 1000 });
  send({ type: 'init', id: 51, params: small });
  var r2 = send({ type: 'solve', id: 52, stickers: view });
  assert.equal(r2[0].code, 'NODE_LIMIT');

  // 還原為資料檔的參數；結果與直接呼叫 twophase.solve(cube, params.solver) 相同
  send({ type: 'init', id: 53, params: params.solver });
  var r3 = send({ type: 'solve', id: 54, stickers: view });
  var direct = twophase.solve(twophase.fromStickerColors(view).cube, params.solver);
  assert.deepEqual(r3[0].moves, direct.names);
  assert.equal(r3[0].nodes, direct.nodes);
});

test('T-SOL-08：lbl 回 result（id 相符、格式與 generateLbl 相同、可復原）', function () {
  for (var k = 0; k < 5; k++) {
    var view = randomView(200 + k, 40);
    var out = send({ type: 'lbl', id: 60 + k, stickers: view, config: lblConfig });
    assert.equal(out.length, 1);
    var r = out[0];
    assert.equal(r.type, 'result');
    assert.equal(r.kind, 'lbl');
    assert.equal(r.id, 60 + k);
    var direct = lbl.generateLbl(view, lblConfig);
    assert.deepEqual(r.tokens, direct.tokens);
    assert.deepEqual(r.segments, direct.segments);
    assert.equal(r.qtm, direct.qtm);
    assert.equal(r.segments.length, 8);
    assert.ok(engine.isSolved(engine.applyMoves(view, r.tokens)));
  }
});

test('T-SOL-08：未知 type 與欄位缺漏回 BAD_REQUEST', function () {
  var r1 = send({ type: 'optimal', id: 70 });
  assert.equal(r1.length, 1);
  assert.equal(r1[0].type, 'error');
  assert.equal(r1[0].id, 70);
  assert.equal(r1[0].code, 'BAD_REQUEST');

  assert.equal(send({ id: 71 })[0].code, 'BAD_REQUEST');
  assert.equal(send({ type: 'solve', id: 72 })[0].code, 'BAD_REQUEST');
  assert.equal(send({ type: 'solve', id: 73, stickers: engine.SOLVED.slice(), opts: 5 })[0].code, 'BAD_REQUEST');
  assert.equal(send({ type: 'lbl', id: 74, stickers: engine.SOLVED.slice() })[0].code, 'BAD_REQUEST');
  assert.equal(send({ type: 'init', id: 75, params: 'x' })[0].code, 'BAD_REQUEST');

  var noId = send({ type: 'solve', stickers: engine.SOLVED.slice() });
  assert.equal(noId[0].code, 'BAD_REQUEST');
  assert.equal(noId[0].id, null);
  assert.equal(send(null)[0].code, 'BAD_REQUEST');
  assert.equal(send('init')[0].code, 'BAD_REQUEST');

  // lbl 設定檔錯誤：generateLbl 的 BAD_REQUEST 原樣轉送
  var badCfg = JSON.parse(JSON.stringify(lblConfig));
  badCfg.headlightFace = 'U';
  var r2 = send({ type: 'lbl', id: 76, stickers: randomView(3, 30), config: badCfg });
  assert.equal(r2[0].code, 'BAD_REQUEST');
  assert.equal(r2[0].id, 76);
});

test('T-SOL-08：非法貼紙回 INVALID_STATE（solve 與 lbl；detail 為原錯誤碼；未列出的碼也一樣，D-5）', function () {
  var cases = [
    { stickers: engine.SOLVED.slice(0, 53), detail: 'LENGTH' },
    { stickers: twistedView(), detail: 'CORNER_TWIST' },
    { stickers: engine.SOLVED.map(function (c, i) { return i === 0 ? 9 : c; }), detail: 'BAD_COLOR' }
  ];
  // 規格 §3.4 未列出的碼：某顏色 10 格、另一顏色 8 格（中心不重複）
  var colorCount = engine.SOLVED.slice();
  colorCount[0] = 1;
  cases.push({ stickers: colorCount, detail: null });

  cases.forEach(function (c, i) {
    ['solve', 'lbl'].forEach(function (type, j) {
      var id = 80 + i * 2 + j;
      var msg = { type: type, id: id, stickers: c.stickers };
      if (type === 'lbl') msg.config = lblConfig;
      var out = send(msg);
      assert.equal(out.length, 1);
      assert.equal(out[0].type, 'error');
      assert.equal(out[0].id, id);
      assert.equal(out[0].code, 'INVALID_STATE', type + ' 案例 ' + i);
      if (c.detail) assert.equal(out[0].detail, c.detail);
      else assert.equal(typeof out[0].detail, 'string');
    });
  });
});

test('T-SOL-08：handleMessage 不修改輸入、例外轉成 INTERNAL', function () {
  var view = randomView(9, 30);
  var copy = view.slice();
  var cfgCopy = JSON.stringify(lblConfig);
  send({ type: 'solve', id: 90, stickers: view });
  send({ type: 'lbl', id: 91, stickers: view, config: lblConfig });
  assert.deepEqual(view, copy);
  assert.equal(JSON.stringify(lblConfig), cfgCopy);

  // post 本身丟例外時，handleMessage 仍會嘗試回報 INTERNAL，不向外拋出
  var calls = [];
  assert.doesNotThrow(function () {
    worker.handleMessage({ type: 'lbl', id: 92, stickers: view, config: lblConfig }, function (m) {
      calls.push(m);
      if (calls.length === 1) throw new Error('post 失敗');
    });
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].code, 'INTERNAL');
  assert.equal(calls[1].id, 92);
});

test('T-SOL-08：worker.js 原始碼（含註解）不含禁用字串、不接全域訊息事件', function () {
  var src = fs.readFileSync(path.join(ROOT, 'src/solver/worker.js'), 'utf8');
  var re = /Math\.random|Date\.now|new Date\(|performance\.now|localStorage|sessionStorage|document\.|window\.|navigator\.|fetch\(|setTimeout|setInterval|requestAnimationFrame/;
  src.split('\n').forEach(function (line, i) {
    assert.ok(!re.test(line), 'worker.js 第 ' + (i + 1) + ' 行含禁用字串：' + line);
  });
  assert.ok(!/self\s*\.|onmessage|postMessage\s*\(/.test(src), 'worker.js 不得接 Worker 全域事件');
  assert.deepEqual(Object.keys(worker).sort(), ['INIT_OPTIONS', 'handleMessage', 'resetForTest']);
});
