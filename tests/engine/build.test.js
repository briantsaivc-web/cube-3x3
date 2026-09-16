// tests/engine/build.test.js — T-001 S7：build/bundle.js 打包測試
//
// 依據：game-spec.md §12.4（T-BUILD-01～T-BUILD-03）；ADR-001-solver.md §2.5；
//       分派單 T-001 S7 輸出契約。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var crypto = require('node:crypto');

var bundle = require('../../build/bundle.js');

var MAX_BYTES = bundle.MAX_BYTES;
var MAX_WORKER_BYTES = bundle.MAX_WORKER_BYTES;

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/** 從產物中取出 window.SOLVER_WORKER_SRC 的 JSON 字串並還原成原始碼（不依賴內部函式，直接掃產物本身）。 */
function extractWorkerSrc(html) {
  var m = /window\.SOLVER_WORKER_SRC\s*=\s*("(?:[^"\\]|\\.)*")\s*;/.exec(html);
  assert.ok(m, '產物中找不到 window.SOLVER_WORKER_SRC 賦值');
  return JSON.parse(m[1]);
}

// ---------------------------------------------------------------------------
// T-BUILD-01：npm run build 產生單一 index.html；連續兩次 byte-identical
// ---------------------------------------------------------------------------

test('T-BUILD-01：build() 產生單一 index.html；連續兩次 byte-identical（決定性）', function () {
  var out1 = path.join(os.tmpdir(), 'cube-3x3-build-test-1-' + process.pid + '.html');
  var out2 = path.join(os.tmpdir(), 'cube-3x3-build-test-2-' + process.pid + '.html');
  try {
    var r1 = bundle.build(out1);
    var r2 = bundle.build(out2);

    assert.equal(fs.existsSync(out1), true);
    assert.equal(fs.existsSync(out2), true);
    assert.equal(sha256(out1), sha256(out2), '兩次 build 產物的 sha256 應相同');
    assert.equal(r1.bytes, r2.bytes);
    assert.equal(r1.workerBytes, r2.workerBytes);
  } finally {
    fs.rmSync(out1, { force: true });
    fs.rmSync(out2, { force: true });
  }
});

// ---------------------------------------------------------------------------
// T-BUILD-02：無外連；主產物 < 400 KB（D-13）；SOLVER_WORKER_SRC 字串 < 100 KB
// ---------------------------------------------------------------------------

test('T-BUILD-02：產物無外連資源；主產物 < 400 KB（D-13）；Worker 字串 < 100 KB', function () {
  var out = path.join(os.tmpdir(), 'cube-3x3-build-test-3-' + process.pid + '.html');
  try {
    var r = bundle.build(out);
    var html = fs.readFileSync(out, 'utf8');

    // 主產物大小
    assert.equal(Buffer.byteLength(html, 'utf8'), r.bytes);
    assert.ok(r.bytes < MAX_BYTES, '主產物 ' + r.bytes + ' bytes 應 < ' + MAX_BYTES);

    // 無外連（HTML 標籤層）
    var shell = html
      .replace(/<script[\s\S]*?<\/script>/gi, '<script></script>')
      .replace(/<style[\s\S]*?<\/style>/gi, '<style></style>');
    assert.equal(/https?:\/\//i.test(shell), false, '標籤層不得出現 http:// 或 https://');
    assert.equal(/<link\b/i.test(shell), false, '不得出現 <link');
    assert.equal(/\bsrc\s*=\s*["'][^"']+["']/i.test(shell), false, '不得出現外部 src=');
    assert.equal(/@import/i.test(html), false, '不得出現 @import');

    // 程式碼層也不得出現網址（SVG 命名空間 URI 除外，本產物目前無 SVG，維持嚴格檢查）
    var codeHits = html.match(/https?:\/\/[^\s"')]+/gi) || [];
    codeHits = codeHits.filter(function (u) { return !/^https?:\/\/(www\.)?w3\.org\//i.test(u); });
    assert.deepEqual(codeHits, [], '原始碼不得出現網址');

    // Worker 字串大小
    var workerSrc = extractWorkerSrc(html);
    var workerBytes = Buffer.byteLength(workerSrc, 'utf8');
    assert.equal(workerBytes, r.workerBytes);
    assert.ok(workerBytes < MAX_WORKER_BYTES, 'Worker 字串 ' + workerBytes + ' bytes 應 < ' + MAX_WORKER_BYTES);
  } finally {
    fs.rmSync(out, { force: true });
  }
});

// ---------------------------------------------------------------------------
// T-BUILD-03：SOLVER_WORKER_SRC 可被 new Function 解析（語法正確），且不含 src/ui/ 模組
// ---------------------------------------------------------------------------

test('T-BUILD-03：SOLVER_WORKER_SRC 語法正確（new Function 可解析），且不含 src/ui/ 任何模組', function () {
  var out = path.join(os.tmpdir(), 'cube-3x3-build-test-4-' + process.pid + '.html');
  try {
    bundle.build(out);
    var html = fs.readFileSync(out, 'utf8');
    var workerSrc = extractWorkerSrc(html);

    // 語法正確：new Function 只解析不執行函式主體，因此不需要真的模擬 Worker 全域環境
    assert.doesNotThrow(function () {
      // eslint-disable-next-line no-new-func
      new Function(workerSrc);
    }, 'SOLVER_WORKER_SRC 應可被 new Function 解析');

    // 不含任何 src/ui/ 模組：檢查註冊清單與原始碼字面
    bundle.WORKER_FILES.forEach(function (rel) {
      assert.equal(rel.indexOf('ui/'), -1, 'WORKER_FILES 不得包含 ui/ 模組：' + rel);
    });
    assert.equal(/__define\(\s*"ui\//.test(workerSrc), false, 'Worker 原始碼不得出現 ui/ 模組的 __define');
    assert.equal(/require\(['"]\.\.\/ui\//.test(workerSrc), false, 'Worker 原始碼不得 require 任何 ui/ 模組');
  } finally {
    fs.rmSync(out, { force: true });
  }
});

// ---------------------------------------------------------------------------
// 檔案清單自檢：與分派單 T-001 S7 §3「輸出契約」逐一比對（守住 X-7 的清單）
// ---------------------------------------------------------------------------

test('build/bundle.js 檔案清單與分派單 T-001 S7 輸出契約一致', function () {
  assert.deepEqual(bundle.MAIN_FILES, [
    'engine/rng.js',
    'engine/cube.js',
    'engine/scramble.js',
    'engine/selectors.js',
    'engine/reducer.js',
    'engine/index.js',
    'solver/twophase.js',
    'solver/lbl.js',
    'ui/solver-client.js',
    'ui/notation.js',
    'ui/records.js',
    'ui/tutorial.js',
    'ui/cube-view.js',
    'ui/gesture.js',
    'ui/controls.js',
    'ui/hint-view.js',
    'ui/demo-player.js',
    'ui/app.js'
  ]);
  assert.deepEqual(bundle.WORKER_FILES, [
    'engine/rng.js',
    'engine/cube.js',
    'solver/twophase.js',
    'solver/lbl.js',
    'solver/worker.js'
  ]);
  assert.deepEqual(bundle.CSS_FILES, ['ui/styles.css', 'ui/demo.css', 'ui/overlay.css']);
  assert.deepEqual(bundle.DATA_FILES, ['texts', 'palette', 'params', 'lbl']);
});
