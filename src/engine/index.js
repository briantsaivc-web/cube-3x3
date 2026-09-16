// src/engine/index.js — engine 對外單一入口
//
// 依分派單 T-001 §3 S3 輸出契約：UI 與 solver-client 只從這裡 require，
// 不得直接 require src/engine/ 底下其他檔案。
'use strict';

var cube = require('./cube.js');
var reducer = require('./reducer.js');
var selectors = require('./selectors.js');

module.exports = Object.assign(
  {},
  cube,
  reducer,
  selectors,
  {
    cube: cube,
    reducer: reducer,
    selectors: selectors
  }
);
