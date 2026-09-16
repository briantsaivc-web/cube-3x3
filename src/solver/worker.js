// src/solver/worker.js — 求解器 Worker 的訊息處理（純邏輯，可在 Node 直接測試）
//
// 依據：game-spec.md §7.1、§9.5（訊息協定）、§9.6；ADR-001-solver.md §2.5；
//       分派單 T-001 S6、X-5、X-6；技術裁決 D-3、D-5（docs/reports/T-001-arch-decisions.md）。
//
// 分工：
//   - 本檔只匯出 handleMessage(msg, post)；不接 Worker 的全域訊息事件。
//     接上 Worker 入口的那一行由 build/bundle.js 產生（X-6），本目錄因此不含任何瀏覽器 API。
//   - 求解一律呼叫 twophase.js／lbl.js，不在本檔改寫求解器行為（X-5）。
//   - 不讀時鐘、不用亂數；逾時保護在 src/ui/solver-client.js（ADR-001 §2.4）。
//
// 協定（主執行緒 → Worker）：
//   {type:'init',  id, params:{nodeLimit, firstNodeLimit, maxLength, phase2Cap, ...}}
//   {type:'solve', id, stickers:int[54], opts?:{nodeLimit, firstNodeLimit, ...}}
//   {type:'lbl',   id, stickers:int[54], config:<lbl.json 全文>}
// 協定（Worker → 主執行緒）：
//   {type:'progress', id, step, total, label}      // init：建每張表後各一次，共 6 次
//   {type:'ready',    id, tableBytes}              // init 完成
//   {type:'result',   id, kind:'solve', moves:string[], qtm, nodes, complete}
//   {type:'result',   id, kind:'lbl', tokens, segments, qtm}
//   {type:'error',    id, code, detail}
'use strict';

var twophase = require('./twophase.js');
var lbl = require('./lbl.js');

// twophase.init 只接受這一組選項（game-spec.md §7.2；S4 回報 §7）。
var INIT_OPTIONS = Object.freeze({ metrics: ['qtm'], twistFlip: true, cornerTable: false });

// 從 params.solver 取出、轉交給 twophase.solve 的欄位（D-3：一律傳入 params.solver）。
var SOLVE_KEYS = ['metric', 'nodeLimit', 'firstNodeLimit', 'maxLength', 'phase2Cap'];

// §9.5 錯誤碼表中可由 lbl.js 原樣轉送的碼；其他碼依 D-5 視為非法狀態。
var LBL_CODES = { LBL_STUCK: true, INVALID_STATE: true, BAD_REQUEST: true };

// Worker 內的狀態：init 收到的求解參數；null 代表尚未 init。
var solveParams = null;

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isValidId(id) {
  return typeof id === 'number' && isFinite(id);
}

function pickSolveOpts(src, base) {
  var out = {};
  var i, k;
  if (base) {
    for (i = 0; i < SOLVE_KEYS.length; i++) {
      k = SOLVE_KEYS[i];
      if (base[k] !== undefined) out[k] = base[k];
    }
  }
  if (src) {
    for (i = 0; i < SOLVE_KEYS.length; i++) {
      k = SOLVE_KEYS[i];
      if (src[k] !== undefined) out[k] = src[k];
    }
  }
  return out;
}

function errorMsg(id, code, detail) {
  return { type: 'error', id: id, code: code, detail: detail === undefined ? null : String(detail) };
}

function handleInit(msg, post) {
  if (!isObject(msg.params)) {
    post(errorMsg(msg.id, 'BAD_REQUEST', 'params'));
    return;
  }
  var id = msg.id;
  var info = twophase.init(INIT_OPTIONS, function (step, total, label) {
    post({ type: 'progress', id: id, step: step, total: total, label: label });
  });
  solveParams = pickSolveOpts(msg.params, null);
  post({ type: 'ready', id: id, tableBytes: info.totalBytes });
}

function handleSolve(msg, post) {
  if (!Array.isArray(msg.stickers) || (msg.opts !== undefined && !isObject(msg.opts))) {
    post(errorMsg(msg.id, 'BAD_REQUEST', 'stickers/opts'));
    return;
  }
  if (solveParams === null || !twophase.isReady()) {
    post(errorMsg(msg.id, 'NOT_READY', null));
    return;
  }
  var parsed = twophase.fromStickerColors(msg.stickers);
  if (!parsed.ok) {
    // D-5：fromStickerColors 的任何錯誤碼（含規格未列的 COLOR_COUNT）一律視為非法狀態
    post(errorMsg(msg.id, 'INVALID_STATE', parsed.error));
    return;
  }
  var r = twophase.solve(parsed.cube, pickSolveOpts(msg.opts, solveParams));
  if (r.error) {
    if (r.error === 'NODE_LIMIT') post(errorMsg(msg.id, 'NODE_LIMIT', r.nodes));
    else if (r.error === 'NOT_INITIALIZED') post(errorMsg(msg.id, 'NOT_READY', null));
    else if (r.error === 'UNSUPPORTED_METRIC') post(errorMsg(msg.id, 'BAD_REQUEST', r.error));
    else post(errorMsg(msg.id, 'INTERNAL', r.error));
    return;
  }
  post({
    type: 'result',
    id: msg.id,
    kind: 'solve',
    moves: r.names.slice(),
    qtm: r.qtm,
    nodes: r.nodes,
    complete: r.complete
  });
}

function handleLbl(msg, post) {
  if (!Array.isArray(msg.stickers) || !isObject(msg.config)) {
    post(errorMsg(msg.id, 'BAD_REQUEST', 'stickers/config'));
    return;
  }
  // 先用 fromStickerColors 驗證合法性（不需要建表），避免把不可解的狀態交給層先法
  var parsed = twophase.fromStickerColors(msg.stickers);
  if (!parsed.ok) {
    post(errorMsg(msg.id, 'INVALID_STATE', parsed.error));
    return;
  }
  var r = lbl.generateLbl(msg.stickers.slice(), msg.config);
  if (r.error) {
    if (LBL_CODES[r.error]) post(errorMsg(msg.id, r.error, r.detail));
    else post(errorMsg(msg.id, 'INVALID_STATE', r.error));
    return;
  }
  post({
    type: 'result',
    id: msg.id,
    kind: 'lbl',
    tokens: r.tokens,
    segments: r.segments,
    qtm: r.qtm
  });
}

/**
 * 處理一則主執行緒訊息；所有回覆都經由 post 送出（同步呼叫）。
 * 任何例外都轉成 {type:'error', code:'INTERNAL'}，不讓 Worker 崩潰。
 * @param {object} msg - 見檔頭協定
 * @param {(reply: object) => void} post - 送回主執行緒
 */
function handleMessage(msg, post) {
  var id = isObject(msg) ? msg.id : undefined;
  try {
    if (!isObject(msg) || !isValidId(msg.id)) {
      post(errorMsg(id === undefined ? null : id, 'BAD_REQUEST', 'id'));
      return;
    }
    switch (msg.type) {
      case 'init':
        handleInit(msg, post);
        return;
      case 'solve':
        handleSolve(msg, post);
        return;
      case 'lbl':
        handleLbl(msg, post);
        return;
      default:
        post(errorMsg(msg.id, 'BAD_REQUEST', 'type:' + String(msg.type)));
    }
  } catch (e) {
    post(errorMsg(id === undefined ? null : id, 'INTERNAL', e && e.message ? e.message : e));
  }
}

/** 測試用：清除 init 收到的參數（不會清除 twophase 已建好的表）。 */
function resetForTest() {
  solveParams = null;
}

module.exports = {
  handleMessage: handleMessage,
  INIT_OPTIONS: INIT_OPTIONS,
  resetForTest: resetForTest
};
