// src/engine/selectors.js — UI 唯讀取數用的選取函式（game-spec.md §4.1）
//
// UI 只透過本檔讀取衍生資料，不得自己計算規則（CLAUDE.md §3 第 1 條）。
'use strict';

var cube = require('./cube.js');
var reducer = require('./reducer.js');

function viewStickers(state) {
  return cube.applyOrient(state.home, state.orient);
}

function moveCount(state) {
  return reducer.moveCount(state);
}

function elapsedMs(state, nowAt) {
  var running = state.timer.state === 'running';
  return state.timer.accMs + (running ? Math.max(0, nowAt - state.timer.since) : 0);
}

function isSolvedNow(state) {
  return cube.isSolved(state.home);
}

function canApply(state, action, data) {
  return reducer.canApply(state, action, data);
}

// 提示以 view 座標顯示；hint.move 存的是 home 座標記號，換算時用「請求當下的 orient」
// 換算後的目前 orient（提示成立後 ROTATE 不清除提示，所以要用目前 orient 換算，見 T-ENG-18）。
function hintView(state) {
  var hint = state.hint;
  if (!hint || hint.pending) return null;
  var move = cube.toView(state.orient, hint.move);
  return {
    move: move,
    qtm: cube.qtmCost(hint.move),
    planQtm: hint.planQtm,
    source: hint.source
  };
}

function hintLayer(state) {
  var hv = hintView(state);
  if (!hv) return [];
  return cube.layerStickers(hv.move);
}

// 找出 demo.cursor 目前落在哪個 segment／part（供 §8.2 分段進度顯示）。
function locateSegment(segments, cursor) {
  if (!segments) return { segmentIndex: -1, partIndex: -1 };
  var segmentIndex = -1;
  for (var s = 0; s < segments.length; s++) {
    var seg = segments[s];
    if (cursor >= seg.start && cursor < seg.end) {
      segmentIndex = s;
      break;
    }
  }
  if (segmentIndex === -1 && segments.length > 0 && cursor >= segments[segments.length - 1].end) {
    segmentIndex = segments.length - 1; // 已播完，停在最後一段
  }
  var partIndex = -1;
  if (segmentIndex !== -1) {
    var parts = segments[segmentIndex].parts;
    for (var p = 0; p < parts.length; p++) {
      if (cursor >= parts[p].start && cursor < parts[p].end) {
        partIndex = p;
        break;
      }
    }
  }
  return { segmentIndex: segmentIndex, partIndex: partIndex };
}

function demoInfo(state) {
  var demo = state.demo;
  if (!demo) return null;
  var total = demo.tokens.length;
  var totalQtm = 0;
  var doneQtm = 0;
  for (var i = 0; i < total; i++) {
    var q = cube.kind(demo.tokens[i]) === 'rotation' ? 0 : cube.qtmCost(demo.tokens[i]);
    totalQtm += q;
    if (i < demo.cursor) doneQtm += q;
  }
  var nextToken = demo.cursor < total ? demo.tokens[demo.cursor] : null;
  var nextIsRotation = nextToken !== null && cube.kind(nextToken) === 'rotation';
  var located = locateSegment(demo.segments, demo.cursor);
  return {
    kind: demo.kind,
    cursor: demo.cursor,
    total: total,
    totalQtm: totalQtm,
    doneQtm: doneQtm,
    nextToken: nextToken,
    nextIsRotation: nextIsRotation,
    segmentIndex: located.segmentIndex,
    partIndex: located.partIndex
  };
}

function demoNextLayer(state) {
  var demo = state.demo;
  if (!demo || demo.cursor >= demo.tokens.length) return [];
  var t = demo.tokens[demo.cursor];
  if (cube.kind(t) === 'rotation') {
    var all = [];
    for (var i = 0; i < 54; i++) all.push(i);
    return all;
  }
  return cube.layerStickers(t);
}

function recordEligible(state) {
  return state.status === 'solved' && state.seed !== null && !!state.result && state.result.assist === 'none';
}

function solverInput(state) {
  return { stickers: viewStickers(state), version: state.version, orient: state.orient };
}

module.exports = {
  viewStickers: viewStickers,
  moveCount: moveCount,
  elapsedMs: elapsedMs,
  isSolvedNow: isSolvedNow,
  canApply: canApply,
  hintView: hintView,
  hintLayer: hintLayer,
  demoInfo: demoInfo,
  demoNextLayer: demoNextLayer,
  recordEligible: recordEligible,
  solverInput: solverInput
};
