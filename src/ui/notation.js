// src/ui/notation.js — 記號輔助：白話說明與記號鍵中文副標（game-spec.md §2.4、§11.2）
//
// 依分派單 T-001 S8a 輸出契約：純函數、不得碰 DOM（可在 Node 直接 require 測試）。
// 步數與記號種類一律取 engine.describeMove()（explainMove 用）；keySubLabel 只靠字串本身
// 判斷 cw／ccw／half（外層與中層記號長度即可判斷，見 game-spec.md §1.2 記號規則），
// 不依賴 engine，符合分派單「keySubLabel(move, texts)」的簽章（不含 engine 參數）。
'use strict';

/**
 * 把模板字串裡的 {key} 換成 vars[key]（string(vars[key])）；vars 沒有的 key 原樣保留。
 * @param {string} template
 * @param {object} vars
 * @returns {string}
 */
function fillTemplate(template, vars) {
  if (typeof template !== 'string') throw new Error('fillTemplate: template 必須是字串');
  vars = vars || {};
  return template.replace(/\{(\w+)\}/g, function (whole, key) {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole;
  });
}

// 由記號字串本身判斷 turn（不依賴 engine）：長度 1 → cw；第二碼是 '2' → half；否則（結尾 '）→ ccw。
function turnOfMoveString(move) {
  if (move.length === 1) return 'cw';
  if (move.charAt(1) === '2') return 'half';
  return 'ccw';
}

/**
 * 記號鍵的中文副標（game-spec.md §11.2）。
 * @param {string} move - 記號字串（ASCII 撇號，例："R'"）
 * @param {object} texts - GAME_DATA.texts
 * @returns {string}
 */
function keySubLabel(move, texts) {
  var notation = texts.notation;
  if (notation.rotationSub && Object.prototype.hasOwnProperty.call(notation.rotationSub, move)) {
    return notation.rotationSub[move];
  }
  var base = move.charAt(0);
  var turn = turnOfMoveString(move);
  var face = notation.faceName[base];
  return fillTemplate(notation.keySub[turn], { face: face });
}

/**
 * 記號鍵的無障礙名稱：記號（′ 字元）＋空格＋副標（game-spec.md §11.2）。
 * @param {string} move
 * @param {object} texts
 * @param {object} engine - 需要 formatMove
 * @returns {string}
 */
function keyAriaLabel(move, texts, engine) {
  return engine.formatMove(move) + ' ' + keySubLabel(move, texts);
}

/**
 * 白話說明（game-spec.md §2.4）：一律用 engine.describeMove 取得 base／kind／turn／qtm，
 * 不自行判斷記號種類與步數。
 * @param {string} move
 * @param {object} texts - GAME_DATA.texts
 * @param {object} engine - src/engine/index.js（需要 describeMove、formatMove）
 * @returns {string}
 */
function explainMove(move, texts, engine) {
  var d = engine.describeMove(move);
  var explain = texts.notation.explain;
  var displayMove = engine.formatMove(move);
  var vars = { move: displayMove, qtm: d.qtm };
  var templateKey;
  if (d.kind === 'rotation') {
    templateKey = 'rotation';
    vars.name = explain.rotationName[d.move];
  } else if (d.turn === 'half') {
    templateKey = 'half';
    vars.layer = explain.layerName[d.base];
  } else if (d.kind === 'slice') {
    templateKey = 'sliceQuarter';
    vars.layer = explain.layerName[d.base];
    var ref = explain.sliceRef[d.base];
    vars.ref = d.turn === 'ccw' ? ref + '′' : ref; // ccw 附上 ′（U+2032）
  } else {
    templateKey = 'quarter';
    vars.layer = explain.layerName[d.base];
    vars.dir = d.turn === 'cw' ? explain.dirCw : explain.dirCcw;
  }
  return fillTemplate(explain[templateKey], vars);
}

module.exports = {
  fillTemplate: fillTemplate,
  keySubLabel: keySubLabel,
  keyAriaLabel: keyAriaLabel,
  explainMove: explainMove
};
