// tests/engine/gesture.test.js — S13：src/ui/gesture.js 轉視角收尾的 Node 單元測試
//
// 放在 tests/engine/ 底下只是為了讓 `node --test "tests/engine/**/*.test.js"` 一併執行。
//   T-UI-34：轉視角期間暫停的輸入佇列（input.hold），在每一種結束路徑都會解除（code-review m-2；D-35）
//
// 重現來源：docs/reports/T-001-code-review.md m-2（reviewer 以合成事件重現：在方塊外 pointerdown、
// setPointerCapture 失敗、pointerup 落在舞台以外 → 按記號鍵 R 後 queueSize=1、cursor 不動）。
// 本檔用假的舞台／文件（只實作 addEventListener）、假的 ctx.view，搭配 app.js 真正的 createInputQueue
// 與真正的 engine，不需要瀏覽器；瀏覽器上的同一情境另見 tests/ui/checks5.js（T-UI-35）。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var engine = require(path.join(ROOT, 'src/engine/index.js'));
var gesture = require(path.join(ROOT, 'src/ui/gesture.js'));
var app = require(path.join(ROOT, 'src/ui/app.js'));
var params = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/params.json'), 'utf8'));
var lblConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/lbl.json'), 'utf8'));
var DATA = { params: params, lbl: lblConfig };
var IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// 只實作 addEventListener 的假事件目標；fire() 同步呼叫監聽器，例外直接往外丟（方便測試抓到）。
function makeTarget(extra) {
  var listeners = {};
  var t = {
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire: function (type, props) {
      var e = Object.assign({
        type: type, target: t, cancelable: false, pointerType: 'touch', button: 0, pointerId: 77,
        clientX: 10, clientY: 10, preventDefault: function () {}
      }, props || {});
      (listeners[type] || []).slice().forEach(function (fn) { fn(e); });
      return e;
    }
  };
  return Object.assign(t, extra || {});
}

function flush() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

/**
 * opts.snap()          → view.snapFrom 的回傳值（預設：已完成的 Promise）
 * opts.nearest         → view.nearestOrientFrom 的回傳值（預設：原朝向＝點一下）
 * opts.dispatchThrows  → ctx.dispatch 丟例外（只丟一次）
 */
function makeHarness(opts) {
  opts = opts || {};
  var state = engine.reduce(engine.initialState(), { type: 'NEW_GAME', payload: { seed: 3, at: 0 } }, DATA);
  var calls = { clearDrag: 0, snap: 0, dispatched: [] };
  var polls = [];
  var dispatchThrows = !!opts.dispatchThrows;

  function dispatch(action) {
    if (dispatchThrows) {
      dispatchThrows = false;
      throw new Error('測試：dispatch 失敗');
    }
    state = engine.reduce(state, action, DATA);
    calls.dispatched.push(action.type);
  }

  var queue = app.createInputQueue({
    max: 3,
    pollMs: 16,
    setTimer: function (fn) { polls.push(fn); return polls.length; },
    canApply: function (action) { return engine.canApply(state, action, DATA); },
    dispatch: dispatch,
    isLocked: function () { return false; },
    isBlocked: function () { return false; }
  });
  var input = {
    locked: function () { return false; },
    idle: function () { return !queue.busy(); },
    enqueue: function (task) { return queue.enqueue(task); },
    hold: function (owner) { queue.hold(owner); },
    release: function (owner) { queue.release(owner); }
  };

  var scene = makeTarget({
    // reviewer 的情境：合成事件的 pointerId 沒有對應的真實指標，setPointerCapture 丟例外
    setPointerCapture: function () { throw new Error('NotFoundError'); },
    hasPointerCapture: function () { return false; },
    releasePointerCapture: function () {}
  });
  var doc = makeTarget({ visibilityState: 'visible' });
  var root = {
    ownerDocument: doc,
    querySelector: function (sel) { return sel === '.cube-scene' ? scene : null; }
  };
  var view = {
    setDragRotation: function () {},
    clearDrag: function () { calls.clearDrag++; },
    nearestOrientFrom: function (from) { return opts.nearest === undefined ? from : opts.nearest; },
    snapFrom: function () {
      calls.snap++;
      return opts.snap ? opts.snap() : Promise.resolve();
    },
    highlight: function () {},
    projectAxes: function () { return { right: { x: 1, y: 0 }, down: { x: 0, y: 1 } }; },
    multiplyMatrix: function (a) { return a.slice(); },
    axisAngleMatrix: function () { return IDENTITY.slice(); }
  };
  var ctx = {
    root: root,
    engine: engine,
    view: view,
    anim: { turn: function () { return Promise.resolve(); } },
    input: input,
    data: DATA,
    getState: function () { return state; },
    dispatch: dispatch
  };
  gesture.mount(ctx);

  return {
    scene: scene,
    doc: doc,
    calls: calls,
    queue: queue,
    cursor: function () { return state.cursor; },
    // 在方塊外按下（target 沒有 closest → 不是貼紙 → 轉視角）
    downOutsideCube: function () { scene.fire('pointerdown'); },
    // 模擬記號鍵 R（與 controls.js 相同的 task 形式）
    pressR: function () {
      return queue.enqueue({
        build: function () { return { type: 'TURN', payload: { move: 'R', at: 100 } }; },
        animate: function () { return Promise.resolve(); }
      });
    },
    // 執行目前排定的輪詢（被 hold 時佇列每 pollMs 重試一次）
    runPolls: function () {
      var fns = polls;
      polls = [];
      fns.forEach(function (fn) { fn(); });
    },
    settle: async function () {
      for (var i = 0; i < 5; i++) {
        await flush();
        this.runPolls();
      }
      await flush();
    }
  };
}

// 共用斷言：佇列已放行、記號鍵 R 已送出
async function assertReleased(h, label) {
  await h.settle();
  assert.equal(h.queue.size(), 0, label + '：queueSize 應為 0（佇列已放行）');
  assert.equal(h.cursor(), 1, label + '：記號鍵 R 應已送出（cursor 0 → 1）');
}

test('T-UI-34a：reviewer 重現情境——capture 失敗、pointerup 落在舞台以外 → 佇列仍會放行，記號鍵 R 生效', async function () {
  var h = makeHarness();
  h.downOutsideCube();
  h.doc.fire('pointerup'); // 冒泡到文件層級，舞台本身收不到
  assert.equal(h.pressR(), true);
  await assertReleased(h, '文件層級 pointerup');
  assert.equal(h.calls.snap, 1, '走正常吸附流程');
});

test('T-UI-34b：lostpointercapture（沒有 pointerup）→ 彈回並放行', async function () {
  var h = makeHarness();
  h.downOutsideCube();
  h.pressR();
  await h.settle();
  assert.equal(h.queue.size(), 1, '轉視角中：佇列暫停，R 排隊等待');
  assert.equal(h.cursor(), 0);
  h.scene.fire('lostpointercapture');
  assert.ok(h.calls.clearDrag >= 1, '彈回原樣');
  await assertReleased(h, 'lostpointercapture');
});

test('T-UI-34c：pointercancel（舞台上或落在舞台外）→ 彈回並放行', async function () {
  var h = makeHarness();
  h.downOutsideCube();
  h.pressR();
  h.scene.fire('pointercancel');
  await assertReleased(h, '舞台上的 pointercancel');

  var h2 = makeHarness();
  h2.downOutsideCube();
  h2.pressR();
  h2.doc.fire('pointercancel');
  await assertReleased(h2, '文件層級的 pointercancel');
});

test('T-UI-34d：吸附動畫失敗（Promise 拒絕、或 snapFrom 同步丟例外）→ 仍會放行，pointerup 不往外丟例外', async function () {
  var h = makeHarness({ snap: function () { return Promise.reject(new Error('測試：吸附失敗')); } });
  h.downOutsideCube();
  h.pressR();
  h.scene.fire('pointerup');
  await assertReleased(h, '吸附 Promise 拒絕');
  assert.ok(h.calls.clearDrag >= 1);

  var h2 = makeHarness({ snap: function () { throw new Error('測試：吸附無法開始'); } });
  h2.downOutsideCube();
  h2.pressR();
  assert.doesNotThrow(function () { h2.scene.fire('pointerup'); });
  await assertReleased(h2, 'snapFrom 同步丟例外');
});

test('T-UI-34e：吸附完成後 dispatch(SET_ORIENT) 丟例外 → 仍會放行（原本只在回呼最後一行放行）', async function () {
  var h = makeHarness({ nearest: 1, dispatchThrows: true });
  h.downOutsideCube();
  h.scene.fire('pointermove', { clientX: 200, clientY: 10 });
  h.pressR();
  h.scene.fire('pointerup', { clientX: 200, clientY: 10 });
  await assertReleased(h, 'dispatch 丟例外');
  assert.ok(h.calls.clearDrag >= 1, 'dispatch 失敗時畫面改由 clearDrag 歸零');
});

test('T-UI-34f：頁面轉入背景（visibilitychange → hidden）→ 手勢作廢並放行', async function () {
  var h = makeHarness();
  h.downOutsideCube();
  h.pressR();
  h.doc.visibilityState = 'hidden';
  h.doc.fire('visibilitychange');
  await assertReleased(h, 'visibilitychange');
});

test('T-UI-34g：正常路徑不變——舞台 pointerup 冒泡到文件時只收尾一次；點一下不送 SET_ORIENT；拖到新朝向送一次', async function () {
  var h = makeHarness();
  h.downOutsideCube();
  h.pressR();
  h.scene.fire('pointerup');
  h.doc.fire('pointerup'); // 同一個事件冒泡到文件層級
  h.scene.fire('lostpointercapture'); // 正常放開後瀏覽器才送的 lostpointercapture
  assert.equal(h.calls.snap, 1, '只吸附一次');
  await assertReleased(h, '正常放開');
  assert.deepEqual(h.calls.dispatched, ['TURN'], '點一下（朝向不變）不送 SET_ORIENT');

  var h2 = makeHarness({ nearest: 5 });
  h2.downOutsideCube();
  h2.scene.fire('pointermove', { clientX: 200, clientY: 10 });
  h2.scene.fire('pointerup', { clientX: 200, clientY: 10 });
  h2.doc.fire('pointerup', { clientX: 200, clientY: 10 });
  await h2.settle();
  assert.deepEqual(h2.calls.dispatched, ['SET_ORIENT']);
  h2.pressR();
  await h2.settle();
  assert.equal(h2.cursor(), 1);
});
