// tests/engine/ui-logic.test.js — S11：UI 層純邏輯的 Node 單元測試
//
// 放在 tests/engine/ 底下只是為了讓 `node --test "tests/engine/**/*.test.js"` 一併執行；
// 受測對象是 src/ui/ 裡「不碰 DOM」的純邏輯：
//   T-UI-29：視角吸附幾何（cube-view.js 的 geometry；架構審查 B-2）
//   T-UI-30：輸入佇列（app.js 的 createInputQueue；D-26，修 K-1、m-2）
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var engine = require('../../src/engine/index.js');
var G = require('../../src/ui/cube-view.js').geometry;
var app = require('../../src/ui/app.js');

var IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mulVec(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ].map(function (x) { return Math.round(x) + 0; }); // + 0 把 -0 正規化成 0
}

function nearlyEqual(a, b) {
  for (var i = 0; i < 9; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return false;
  return true;
}

// ---------------------------------------------------------------------------
// T-UI-29：視角吸附幾何
// ---------------------------------------------------------------------------

test('T-UI-29：Q(o) 與 engine 朝向一致；從任一朝向點一下不改朝向；同方向連拖會累加；相對吸附終點正確', function () {
  var T = G.buildCameraRot(engine);
  assert.equal(T.length, engine.ORIENT_COUNT);

  // (1) Q(o)（換回 engine 座標）把 home 貼紙 i 的位置與法向量送到 view 位置 j（viewStickers[j] === i）
  var labels = [];
  for (var i = 0; i < 54; i++) labels.push(i);
  for (var o = 0; o < engine.ORIENT_COUNT; o++) {
    var qe = G.engineMatToCss(T[o]); // CSS 與 engine 只差 y 反射，同一個換算自己就是反函數
    var view = engine.applyOrient(labels, o);
    for (var j = 0; j < 54; j++) {
      var src = view[j];
      assert.deepEqual(mulVec(qe, engine.STICKER_POS[src]), Array.from(engine.STICKER_POS[j]), 'orient ' + o + ' 位置 ' + j);
      assert.deepEqual(mulVec(qe, engine.STICKER_NRM[src]), Array.from(engine.STICKER_NRM[j]), 'orient ' + o + ' 法向量 ' + j);
    }
  }

  // (2) 點一下（拖曳矩陣＝單位矩陣）：24 個朝向都不變（B-2 原本會跳回 0）
  for (var o2 = 0; o2 < engine.ORIENT_COUNT; o2++) {
    assert.equal(G.nearestOrientFromIn(T, o2, IDENTITY), o2, '從朝向 ' + o2 + ' 點一下不得改變朝向');
    assert.ok(nearlyEqual(G.relativeSnapMatrix(T, o2, o2), IDENTITY), '彈回原朝向的吸附終點應為單位矩陣');
  }

  // (3) 水平拖曳約 90°（CSS 繞 y 軸 +90°）：每一個朝向都等於做了一次 y′，連拖四次回到原朝向
  var yaw = G.axisAngleMatrix([0, 1, 0], 90);
  var pitch = G.axisAngleMatrix([1, 0, 0], 90);
  for (var o3 = 0; o3 < engine.ORIENT_COUNT; o3++) {
    assert.equal(G.nearestOrientFromIn(T, o3, yaw), engine.orientAfter(o3, "y'"), '水平拖曳（朝向 ' + o3 + '）');
    var cur = o3;
    var seen = [cur];
    for (var k = 0; k < 4; k++) {
      cur = G.nearestOrientFromIn(T, cur, yaw);
      seen.push(cur);
    }
    assert.equal(cur, o3, '同方向連拖四次應回到原朝向');
    assert.equal(new Set(seen.slice(0, 4)).size, 4, '連拖每次都要改變朝向（累加）');
    // 垂直拖曳約 90° 也要依目前朝向累加：等於某個 x 系列整顆轉
    var vp = G.nearestOrientFromIn(T, o3, pitch);
    assert.ok([engine.orientAfter(o3, 'x'), engine.orientAfter(o3, "x'")].indexOf(vp) !== -1, '垂直拖曳（朝向 ' + o3 + '）');
  }

  // (4) 小角度（< 45°）拖曳放開：彈回原朝向
  var small = G.matMultiply(G.axisAngleMatrix([1, 0, 0], 20), G.axisAngleMatrix([0, 1, 0], 30));
  for (var o4 = 0; o4 < engine.ORIENT_COUNT; o4++) {
    assert.equal(G.nearestOrientFromIn(T, o4, small), o4);
  }

  // (5) 相對吸附終點 · Q(from) ＝ Q(to)：動畫結束後畫面與「換成新朝向顏色、transform 歸零」一致
  for (var f = 0; f < engine.ORIENT_COUNT; f++) {
    for (var t = 0; t < engine.ORIENT_COUNT; t++) {
      assert.ok(nearlyEqual(G.matMultiply(G.relativeSnapMatrix(T, f, t), T[f]), T[t]), f + '→' + t);
    }
  }
});

// ---------------------------------------------------------------------------
// T-UI-30：輸入佇列
// ---------------------------------------------------------------------------

// 可手動推進的假時鐘與假動畫
function makeHarness(opts) {
  opts = opts || {};
  var timers = [];
  var now = 0;
  var dispatched = [];
  var h = {
    locked: false,
    blocked: false,
    rejectTypes: {},
    dispatched: dispatched,
    pendingAnims: [],
    setTimer: function (fn, ms) { timers.push({ at: now + ms, fn: fn }); return timers.length; },
    advance: async function (ms) {
      now += ms;
      var due = timers.filter(function (t) { return t.at <= now; });
      timers = timers.filter(function (t) { return t.at > now; });
      due.forEach(function (t) { t.fn(); });
      await flush();
    }
  };
  h.queue = app.createInputQueue({
    max: opts.max === undefined ? 3 : opts.max,
    pollMs: 16,
    setTimer: h.setTimer,
    canApply: function (a) { return !h.rejectTypes[a.type + ':' + (a.payload && a.payload.move)]; },
    dispatch: function (a) { dispatched.push(a.payload.move); },
    isLocked: function () { return h.locked; },
    isBlocked: function () { return h.blocked; }
  });
  h.press = function (move, after) {
    return h.queue.enqueue({
      build: function () { return { type: 'TURN', payload: { move: move } }; },
      animate: function () {
        return new Promise(function (resolve) { h.pendingAnims.push(resolve); });
      },
      after: after
    });
  };
  h.finishAnim = async function () {
    var r = h.pendingAnims.shift();
    assert.ok(r, '應有進行中的動畫');
    r();
    await flush();
  };
  return h;
}

function flush() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

test('T-UI-30：輸入佇列依序執行、上限 3、取出時重檢 canApply、clear／上鎖作廢未送出的那一步、hold 暫停不清空', async function () {
  // (1) K-1：動畫中連按兩次 R → 兩步都送出、依序
  var h = makeHarness();
  assert.equal(h.press('R'), true);
  assert.equal(h.press('R'), true);
  assert.equal(h.queue.busy(), true);
  await h.finishAnim();
  assert.deepEqual(h.dispatched, ['R']);
  await h.finishAnim();
  assert.deepEqual(h.dispatched, ['R', 'R']);
  assert.equal(h.queue.busy(), false);

  // (2) 上限：播放中 1 個＋排隊 3 個，第 5 個丟棄
  var h2 = makeHarness();
  var accepted = ['U', 'R', 'F', 'D', 'L'].map(function (m) { return h2.press(m); });
  assert.deepEqual(accepted, [true, true, true, true, false]);
  for (var i = 0; i < 4; i++) await h2.finishAnim();
  assert.deepEqual(h2.dispatched, ['U', 'R', 'F', 'D']);

  // (3) 取出時重檢 canApply：排隊中的 F 在取出前變成不可套用 → 不播動畫、不送出，後面的照常
  var h3 = makeHarness();
  var results = [];
  h3.press('U');
  h3.press('F', function (done) { results.push(done); });
  h3.press('B');
  h3.rejectTypes['TURN:F'] = true;
  await h3.finishAnim(); // U
  assert.equal(h3.pendingAnims.length, 1, 'F 被略過，直接開始播 B');
  await h3.finishAnim(); // B
  assert.deepEqual(h3.dispatched, ['U', 'B']);
  assert.deepEqual(results, [false]);

  // (4) m-2：動畫中 clear()（NEW_GAME／RESET）→ 正在播的那一步不送出，排隊的也作廢
  var h4 = makeHarness();
  h4.press('R');
  h4.press('U');
  h4.queue.clear();
  await h4.finishAnim();
  assert.deepEqual(h4.dispatched, []);
  assert.equal(h4.queue.busy(), false);
  h4.press('L'); // clear 之後的新輸入照常
  await h4.finishAnim();
  assert.deepEqual(h4.dispatched, ['L']);

  // (5) 動畫結束時已上鎖 → 不送出；上鎖期間不接受新輸入
  var h5 = makeHarness();
  h5.press('R');
  h5.locked = true;
  assert.equal(h5.press('U'), false);
  await h5.finishAnim();
  assert.deepEqual(h5.dispatched, []);

  // (6) 其他動畫進行中（isBlocked）或 hold：等待、不丟棄；放行後依序執行
  var h6 = makeHarness();
  h6.blocked = true;
  h6.press('R');
  assert.equal(h6.pendingAnims.length, 0, '被擋住時不開始播');
  await h6.advance(16);
  assert.equal(h6.pendingAnims.length, 0);
  h6.blocked = false;
  await h6.advance(16);
  assert.equal(h6.pendingAnims.length, 1, '放行後開始播');
  await h6.finishAnim();
  h6.queue.hold('view-drag');
  h6.press('U');
  await h6.advance(50);
  assert.equal(h6.pendingAnims.length, 0, 'hold 期間不開始播');
  assert.equal(h6.queue.size(), 1, 'hold 不清空佇列');
  h6.queue.release('view-drag');
  await flush();
  assert.equal(h6.pendingAnims.length, 1);
  await h6.finishAnim();
  assert.deepEqual(h6.dispatched, ['R', 'U']);

  // (7) animate 失敗（Promise reject）不送出，佇列繼續
  var h7 = makeHarness();
  h7.queue.enqueue({
    build: function () { return { type: 'TURN', payload: { move: 'X' } }; },
    animate: function () { return Promise.reject(new Error('boom')); }
  });
  h7.press('D');
  await flush();
  await h7.finishAnim();
  assert.deepEqual(h7.dispatched, ['D']);
});

test('T-UI-30（補充）：numOr 只在鍵缺少時套用預設值，0 為有效值（D-25）', function () {
  assert.equal(app.numOr(0, 180), 0);
  assert.equal(app.numOr(250, 180), 250);
  assert.equal(app.numOr(undefined, 180), 180);
  assert.equal(app.numOr(null, 180), 180);
  assert.equal(app.numOr('0', 180), 180);
  assert.equal(app.numOr(NaN, 180), 180);
});
