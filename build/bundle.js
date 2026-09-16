#!/usr/bin/env node
"use strict";
/**
 * build/bundle.js：把 src/ 打包成單一 index.html（ADR-001 §2.4、§2.5；規格 §9、§12.4）。
 * - 只用 Node 內建 fs／path，零套件；不壓縮、不做 source map。
 * - 決定性：同樣的 src/ 產生 byte-identical 的 index.html（不寫時間戳）。
 * - 注入順序：
 *     <!-- INJECT:CSS -->    → styles.css、demo.css、overlay.css
 *     <!-- INJECT:VERSION --> → window.GAME_VERSION（讀 package.json）
 *     <!-- INJECT:DATA -->    → window.GAME_DATA（texts／palette／params／lbl）
 *     <!-- INJECT:WORKER -->  → window.SOLVER_WORKER_SRC（求解器 Worker 原始碼字串，ADR-001 §2.5）
 *     <!-- INJECT:JS -->      → 迷你模組註冊器＋主 bundle 各檔＋呼叫入口
 * - 版本號唯一來源是 package.json 的 version（release-manager 於 G6 維護），UI 不寫死版本字串。
 * - 主 bundle／Worker 字串各自的檔案清單寫死於 MAIN_FILES／WORKER_FILES（S7 分派單 §3；新增檔案須經
 *   systems-engineer 改分派單清單後才可同步改這裡，見 X-7）。
 * - Worker 只匯出 handleMessage(msg, post)（src/solver/worker.js），接上 self.onmessage 的那一行
 *   由本檔在 Worker 字串裡附加（X-6：build/ 不受 check-forbidden.sh 檢查，src/solver/ 因此保持
 *   沒有瀏覽器 API）。
 * - 輸出後自檢：主產物無 http://、https://、<link、外部 src=、@import；主產物 < 400 KB（D-13）；
 *   Worker 字串 < 100 KB 且語法正確（可被 new Function 解析）且不含任何 ui/ 模組。
 *
 * 用法：node build/bundle.js [--out <path>]（預設輸出到 repo 根目錄 index.html）
 */
var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var SRC = path.join(ROOT, "src");

/**
 * 主 bundle 的檔案清單與順序（分派單 T-001 S7 §3「輸出契約」寫死）。
 * 註冊器為惰性求值，實際載入順序其實無關，但依分派單固定寫法，方便對照。
 */
var MAIN_FILES = [
  "engine/rng.js",
  "engine/cube.js",
  "engine/scramble.js",
  "engine/selectors.js",
  "engine/reducer.js",
  "engine/index.js",
  "solver/twophase.js",
  "solver/lbl.js",
  "ui/solver-client.js",
  "ui/notation.js",
  "ui/records.js",
  "ui/tutorial.js",
  "ui/cube-view.js",
  "ui/gesture.js",
  "ui/controls.js",
  "ui/hint-view.js",
  "ui/demo-player.js",
  "ui/app.js"
];
var ENTRY = "ui/app.js";

/**
 * Worker 字串的檔案清單（分派單 §3 S7；ADR-001 §2.5）。不含任何 src/ui/ 模組（T-BUILD-03）。
 * 入口不是一般的 __require(ENTRY)：Worker 需要接上 self.onmessage，見 WORKER_ENTRY_LINE。
 */
var WORKER_FILES = [
  "engine/rng.js",
  "engine/cube.js",
  "solver/twophase.js",
  "solver/lbl.js",
  "solver/worker.js"
];
/** X-6：接上 Worker 全域事件的這一行由 build/ 產生，worker.js 本身只匯出 handleMessage。 */
var WORKER_ENTRY_LINE =
  'var h = __require("solver/worker.js"); ' +
  "self.onmessage = function (e) { h.handleMessage(e.data, function (m) { self.postMessage(m); }); };";

/** CSS 清單（分派單 §3 S7）。 */
var CSS_FILES = ["ui/styles.css", "ui/demo.css", "ui/overlay.css"];

/** 資料清單：注入為 window.GAME_DATA 的鍵，對應 src/data/<鍵>.json（分派單 §3 S7）。 */
var DATA_FILES = ["texts", "palette", "params", "lbl"];

var MAX_BYTES = 400 * 1024; // D-13：主執行緒退回需內含求解器，UI 預算不足，由 300 KB 放寬
var MAX_WORKER_BYTES = 100 * 1024;

function read(rel) { return fs.readFileSync(path.join(SRC, rel), "utf8"); }

/** 迷你 CommonJS 註冊器（瀏覽器端）；require 只支援相對路徑與 ./x、../x、x/index.js。 */
var REGISTRY = [
  "var __mods = {}, __cache = {};",
  "function __define(k, f) { __mods[k] = f; }",
  "function __resolve(from, req) {",
  "  var base = from.split('/'); base.pop();",
  "  var parts = req.split('/');",
  "  for (var i = 0; i < parts.length; i++) {",
  "    if (parts[i] === '.' || parts[i] === '') continue;",
  "    if (parts[i] === '..') base.pop(); else base.push(parts[i]);",
  "  }",
  "  var k = base.join('/');",
  "  if (__mods[k]) return k;",
  "  if (__mods[k + '.js']) return k + '.js';",
  "  if (__mods[k + '/index.js']) return k + '/index.js';",
  "  throw new Error('module not found: ' + req + ' (from ' + from + ')');",
  "}",
  "function __require(k) {",
  "  if (__cache[k]) return __cache[k].exports;",
  "  var m = { exports: {} }; __cache[k] = m;",
  "  __mods[k](m, m.exports, function (req) { return __require(__resolve(k, req)); });",
  "  return m.exports;",
  "}"
].join("\n");

/** 讓字串可安全放進 <script>：避免 </script> 提前結束。 */
function safeScript(s) { return s.replace(/<\/script/gi, "<\\/script"); }

/** 把一組模組檔包成「註冊器＋__define×N＋entryLine」的一段原始碼（不含 <script> 標籤）。 */
function buildModuleSource(files, entryLine) {
  var parts = ["(function () {", '"use strict";', REGISTRY];
  files.forEach(function (rel) {
    parts.push("__define(" + JSON.stringify(rel) + ", function (module, exports, require) {");
    parts.push(read(rel));
    parts.push("});");
  });
  parts.push(entryLine);
  parts.push("})();");
  return parts.join("\n");
}

function build(outPath) {
  var template = read("ui/index.template.html");
  var MARKS = ["<!-- INJECT:CSS -->", "<!-- INJECT:VERSION -->", "<!-- INJECT:DATA -->", "<!-- INJECT:WORKER -->", "<!-- INJECT:JS -->"];
  MARKS.forEach(function (mark) {
    if (template.indexOf(mark) < 0) throw new Error("template 缺少標記 " + mark);
  });

  var css = CSS_FILES.map(function (rel) { return read(rel); }).join("\n").replace(/<\/style/gi, "<\\/style");
  var cssBlock = "<style>\n" + css + "\n</style>";

  var version = String(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version || "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("package.json 的 version 不是 X.Y.Z 格式：" + JSON.stringify(version));
  var versionScript = "<script>\nwindow.GAME_VERSION = " + JSON.stringify(version) + ";\n</script>";

  var dataObj = {};
  DATA_FILES.forEach(function (name) { dataObj[name] = JSON.parse(read("data/" + name + ".json")); });
  var dataScript = "<script>\nwindow.GAME_DATA = " + safeScript(JSON.stringify(dataObj)) + ";\n</script>";

  // Worker 原始碼：獨立的一段 IIFE，之後整段當成字串塞進 window.SOLVER_WORKER_SRC（ADR-001 §2.5）。
  var workerSrc = buildModuleSource(WORKER_FILES, WORKER_ENTRY_LINE);
  var workerBytes = Buffer.byteLength(workerSrc, "utf8");
  var workerScript = "<script>\nwindow.SOLVER_WORKER_SRC = " + safeScript(JSON.stringify(workerSrc)) + ";\n</script>";

  // 主 bundle：同一支迷你註冊器（獨立作用域），載入 MAIN_FILES 後呼叫入口 ui/app.js。
  var jsBody = buildModuleSource(MAIN_FILES, "__require(" + JSON.stringify(ENTRY) + ");");
  var jsBlock = "<script>\n" + safeScript(jsBody) + "\n</script>";

  // 用函式替換：字串替換會把原始碼裡的 $&、$' 等當成特殊樣式，導致產物語法錯誤。
  var html = template
    .replace("<!-- INJECT:CSS -->", function () { return cssBlock; })
    .replace("<!-- INJECT:VERSION -->", function () { return versionScript; })
    .replace("<!-- INJECT:DATA -->", function () { return dataScript; })
    .replace("<!-- INJECT:WORKER -->", function () { return workerScript; })
    .replace("<!-- INJECT:JS -->", function () { return jsBlock; });

  var problems = check(html).concat(checkWorker(workerSrc, workerBytes));
  if (problems.length) throw new Error("產物自檢失敗：\n- " + problems.join("\n- "));

  fs.writeFileSync(outPath, html, "utf8");
  return {
    bytes: Buffer.byteLength(html, "utf8"),
    workerBytes: workerBytes,
    files: MAIN_FILES.length,
    workerFiles: WORKER_FILES.length,
    data: DATA_FILES.length,
    version: version
  };
}

/** 零外部資源與大小檢查（規格 A-05、T-BUILD-02、T-UI-04）。 */
function check(html) {
  var problems = [];
  // 只掃描 HTML 標籤層級的外連（JS／CSS 原始碼裡的字串不算資源引用），故先移除 <script>／<style> 內容再掃。
  var shell = html.replace(/<script[\s\S]*?<\/script>/gi, "<script></script>").replace(/<style[\s\S]*?<\/style>/gi, "<style></style>");
  if (/https?:\/\//i.test(shell)) problems.push("HTML 標籤層出現 http:// 或 https://");
  if (/<link\b/i.test(shell)) problems.push("出現 <link");
  if (/\bsrc\s*=\s*["'][^"']+["']/i.test(shell)) problems.push("出現外部 src=");
  if (/@import/i.test(html)) problems.push("出現 @import");
  if (/url\(\s*["']?https?:/i.test(html)) problems.push("CSS 出現外部 url(http…)");
  // 程式碼層也不得引用網址（憲法第 3 節第 5 條：斷網可玩）。
  var codeHits = html.match(/https?:\/\/[^\s"')]+/gi) || [];
  codeHits = codeHits.filter(function (u) { return !/^https?:\/\/(www\.)?w3\.org\//i.test(u); }); // SVG 命名空間 URI 不是資源
  if (codeHits.length) problems.push("原始碼出現網址：" + codeHits.slice(0, 3).join(", "));
  var bytes = Buffer.byteLength(html, "utf8");
  if (bytes >= MAX_BYTES) problems.push("檔案 " + bytes + " bytes ≥ " + MAX_BYTES);
  return problems;
}

/** Worker 字串自檢（T-BUILD-02、T-BUILD-03）：大小上限、語法正確、不含 ui/ 模組。 */
function checkWorker(workerSrc, workerBytes) {
  var problems = [];
  if (workerBytes >= MAX_WORKER_BYTES) problems.push("Worker 字串 " + workerBytes + " bytes ≥ " + MAX_WORKER_BYTES);
  var hasUiModule = WORKER_FILES.some(function (rel) { return rel.indexOf("ui/") === 0; });
  if (hasUiModule) problems.push("WORKER_FILES 不得包含 src/ui/ 模組：" + WORKER_FILES.filter(function (rel) { return rel.indexOf("ui/") === 0; }).join(", "));
  try {
    // 只檢查語法（Function 建構子不會執行函式主體），對應 T-BUILD-03「可被 new Function 解析」。
    /* eslint-disable no-new-func */
    new Function(workerSrc);
  } catch (e) {
    problems.push("Worker 字串語法錯誤：" + (e && e.message ? e.message : e));
  }
  return problems;
}

if (require.main === module) {
  var out = path.join(ROOT, "index.html");
  var idx = process.argv.indexOf("--out");
  if (idx > 0 && process.argv[idx + 1]) out = path.resolve(process.argv[idx + 1]);
  try {
    var r = build(out);
    console.log(
      "build 完成：" + path.relative(ROOT, out) + "（v" + r.version + "；" + r.bytes + " bytes；" +
      r.files + " 個模組、" + r.data + " 個資料檔；Worker 字串 " + r.workerBytes + " bytes、" +
      r.workerFiles + " 個模組；零外部資源）"
    );
  } catch (e) {
    console.error("build 失敗：" + e.message);
    process.exit(1);
  }
}

module.exports = {
  build: build,
  check: check,
  checkWorker: checkWorker,
  MAIN_FILES: MAIN_FILES,
  WORKER_FILES: WORKER_FILES,
  WORKER_ENTRY_LINE: WORKER_ENTRY_LINE,
  CSS_FILES: CSS_FILES,
  DATA_FILES: DATA_FILES,
  MAX_BYTES: MAX_BYTES,
  MAX_WORKER_BYTES: MAX_WORKER_BYTES,
  // 沿用舊名 FILES，避免其他人誤 require 舊介面時直接壞掉（本段沒有其他人在用；保留以防萬一）。
  FILES: MAIN_FILES
};
