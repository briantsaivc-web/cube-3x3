// tests/ui/dom-helpers.js — S9 Playwright 測試共用小工具（分派單 T-001 S9）
//
// 只放「與 Playwright page 互動」或「純資料轉換」的共用函式，不含任何 T-UI-* 判定邏輯
// （判定邏輯在 tests/ui/checks.js）。本檔不 require playwright 本身，只操作呼叫端傳入
// 的 page／browser 物件，避免在「找不到 playwright」時連這個輔助檔都載入失敗。
'use strict';

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * 輪詢直到 fn() 回傳 truthy 或逾時。回傳最後一次 fn() 的結果（逾時則為 false／最後一次結果）。
 */
async function waitFor(fn, timeoutMs, intervalMs) {
  timeoutMs = timeoutMs || 8000;
  intervalMs = intervalMs || 150;
  var start = Date.now();
  var last = false;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

/**
 * S11：等版面停止移動。手機直向開頁（或重新整理）時學習面板抽屜有約 250 ms 的 max-height 展開動畫
 * （styles.css），記號鍵在這段期間一路往上移；搭配 force:true 的點擊會點到舊位置（例如兩列鍵之間的
 * 空隙），造成偶發「按了沒反應」。實測見 docs/reports/T-001-S11.md。
 */
async function waitLayoutStable(page, selector, timeoutMs) {
  selector = selector || '#keypad';
  var last = null;
  var stableCount = 0;
  var start = Date.now();
  while (Date.now() - start < (timeoutMs || 3000)) {
    var rect = await page.evaluate(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return [Math.round(r.top), Math.round(r.height)].join(',');
    }, selector);
    if (rect !== null && rect === last) {
      stableCount++;
      if (stableCount >= 2) return true;
    } else {
      stableCount = 0;
    }
    last = rect;
    await sleep(60);
  }
  return false;
}

/** rgb(...)／rgba(...) 字串轉小寫 #rrggbb（比對 palette hex 用；忽略 alpha）。 */
function rgbToHex(rgb) {
  var m = String(rgb).match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  return '#' + m.slice(0, 3).map(function (v) {
    var n = Math.round(Number(v));
    return (n < 16 ? '0' : '') + n.toString(16);
  }).join('');
}

function rectsOverlap(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/** 依 page.title() 之外的方式，在頁面內建立錯誤收集器（pageerror／console.error）。 */
function attachErrorCapture(page) {
  var errs = [];
  page.on('pageerror', function (e) { errs.push('pageerror: ' + (e && e.message)); });
  page.on('console', function (msg) {
    if (msg.type() === 'error') errs.push('console.error: ' + msg.text());
  });
  return errs;
}

/**
 * 開一個新的 context+page，viewport 依 vp（{width,height}），預設 hasTouch:true
 * （§9.2 手勢用真實 PointerEvent，不依賴 hasTouch，但開著比較貼近真機）。
 */
async function newPage(browser, vp, extraOpts) {
  var context = await browser.newContext(Object.assign(
    { viewport: { width: vp.width, height: vp.height }, hasTouch: true },
    extraOpts || {}
  ));
  var page = await context.newPage();
  var errs = attachErrorCapture(page);
  return { context: context, page: page, errs: errs };
}

/** 點擊「文字內容恰好等於 text」的第一顆按鈕（比 CSS 選擇器更貼近玩家操作方式）。 */
function clickButtonByText(page, text) {
  return page.evaluate(function (t) {
    var els = Array.prototype.slice.call(document.querySelectorAll('button'));
    var el = els.find(function (b) { return b.textContent === t; });
    if (!el) throw new Error('找不到文字為「' + t + '」的按鈕');
    el.click();
  }, text);
}

function getState(page) {
  return page.evaluate(function () { return window.__cubeTest.getState(); });
}

function dispatchAction(page, action) {
  return page.evaluate(function (a) { window.__cubeTest.dispatch(a); }, action);
}

/**
 * 依序點按記號鍵（keypad）。（S11／D-26 之後動畫中的點擊會排入輸入佇列、不再丟棄；本函式
 * 「確認前進後才按下一個」的作法仍然適用，以下為 S9 當時的說明。）
 * src/ui/controls.js 的 pressMove() 在動畫 Promise resolve 後才
 * dispatch TURN／ROTATE，且 ctx.input.locked()／ctx.anim.busy() 期間的點擊會被直接忽略——
 * 若下一次點擊發生在動畫真正結束「之前」，該步會被靜默吞掉而非排隊等待。單純固定 sleep
 * （turnAnimMs＋緩衝）在系統負載較重（例如緊接在耗時的 engine 測試之後）時緩衝可能不夠，
 * 曾造成 T-UI-10 偶發性漏按一步（見 docs/reports/T-001-S9.md 未預期發現）。改為點擊後輪詢
 * __cubeTest.getState() 直到 cursor（TURN 會 +1）或 version（ROTATE 不進 history，但仍會
 * 改變 orient／version）真的前進為止，不受動畫實際耗時或系統負載影響。
 */
async function pressKeypadSequential(page, moves, turnAnimMs) {
  // 每步最多重按 3 次：偶爾（推測與瀏覽器當下重繪／事件排程有關，見 docs/reports/T-001-S9.md
  // 未預期發現）第一次點擊完全未觸發 pressMove()（version 全無變化，非動畫尚未跑完），
  // 光是拉長輪詢時間也等不到；每次重按前都先重新讀一次 state 確認仍未前進，避免真的只是
  // 動畫較慢時把同一步按兩次。
  var perAttemptMs = Math.max((turnAnimMs || 180) + 900, 1500);
  for (var i = 0; i < moves.length; i++) {
    var before = await getState(page);
    var sel = 'button.kp[data-move="' + moves[i] + '"]';
    var ok = false;
    for (var attempt = 0; attempt < 3 && !ok; attempt++) {
      var still = await getState(page);
      if (still.cursor !== before.cursor || still.version !== before.version || still.orient !== before.orient) { ok = true; break; }
      await page.click(sel, { force: true, timeout: 5000 });
      ok = await waitFor(async function () {
        var now = await getState(page);
        // S11：整顆轉（ROTATE）只改 orient、不改 version，所以也要看 orient
        return now.cursor !== before.cursor || now.version !== before.version || now.orient !== before.orient;
      }, perAttemptMs, 30);
    }
    if (!ok) {
      throw new Error('pressKeypadSequential：按 ' + moves[i] + '（第 ' + (i + 1) + ' 步）連按 3 次後仍未見狀態變化（cursor/version 未前進）');
    }
  }
}

/**
 * 用合成 PointerEvent 模擬一段手勢（down → 數個 move → up），對真正掛在 .cube-scene
 * 上的事件監聽器送真事件（沿用 S8b／S8e 已驗證過的手法，見 docs/reports/T-001-S8b.md）。
 * path 為 {x,y} 陣列，第一個是按下點，其餘為移動點；最後一個點也是放開點。
 */
async function firePointerPath(page, path, pointerType) {
  await page.evaluate(function (args) {
    function fire(type, x, y, id, pType) {
      var el = document.elementFromPoint(x, y) || document.querySelector('.cube-scene');
      var ev = new PointerEvent(type, {
        pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: pType
      });
      el.dispatchEvent(ev);
    }
    var id = Math.floor(Math.random() * 100000) + 1;
    var pts = args.path;
    var pType = args.pointerType || 'touch';
    fire('pointerdown', pts[0].x, pts[0].y, id, pType);
    for (var i = 1; i < pts.length; i++) fire('pointermove', pts[i].x, pts[i].y, id, pType);
    fire('pointerup', pts[pts.length - 1].x, pts[pts.length - 1].y, id, pType);
  }, { path: path, pointerType: pointerType || 'touch' });
}

/** 用 N 個等分中繼點組出一條「直線手勢路徑」，from/to 皆為 {x,y}。 */
function linePath(from, to, steps) {
  steps = steps || 8;
  var pts = [from];
  for (var i = 1; i <= steps; i++) {
    pts.push({ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps });
  }
  return pts;
}

async function stickerCenter(page, viewIndex) {
  return page.evaluate(function (idx) {
    var el = document.querySelector('[data-sticker="' + idx + '"]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, viewIndex);
}

/** `.cube-scene` 內、確定不落在任何 [data-sticker] 上的一個點（左上角內縮 10px）。 */
async function outsideCubePoint(page) {
  return page.evaluate(function () {
    var scene = document.querySelector('.cube-scene');
    var r = scene.getBoundingClientRect();
    return { x: r.left + 10, y: r.top + 10 };
  });
}

module.exports = {
  sleep: sleep,
  waitFor: waitFor,
  rgbToHex: rgbToHex,
  rectsOverlap: rectsOverlap,
  attachErrorCapture: attachErrorCapture,
  newPage: newPage,
  clickButtonByText: clickButtonByText,
  getState: getState,
  dispatchAction: dispatchAction,
  pressKeypadSequential: pressKeypadSequential,
  firePointerPath: firePointerPath,
  linePath: linePath,
  stickerCenter: stickerCenter,
  outsideCubePoint: outsideCubePoint,
  waitLayoutStable: waitLayoutStable
};
