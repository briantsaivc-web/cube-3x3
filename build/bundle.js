#!/usr/bin/env node
"use strict";
/**
 * build/bundle.js：把 src/ 打包成單一 index.html（ADR-001 §2.4；規格 §9）。
 * - 只用 Node 內建 fs／path，零套件；不壓縮、不做 source map。
 * - 決定性：同樣的 src/ 產生 byte-identical 的 index.html（不寫時間戳）。
 * - 注入順序：<!-- INJECT:CSS -->（styles.css）→ <!-- INJECT:VERSION -->（window.GAME_VERSION，讀 package.json）→ <!-- INJECT:DATA -->（window.GAME_DATA）→ <!-- INJECT:JS -->（迷你模組註冊器＋各檔）。
 * - 版本號唯一來源是 package.json 的 version（release-manager 於 G6 維護），UI 不寫死版本字串。
 * - 檔案清單寫死於 FILES（S4 新增檔案必須同步改這裡，見分派單 X-4）。
 * - 輸出後自檢：無 http://、https://、<link、@import、外部 src=；檔案 < 300 KB。
 *
 * 用法：node build/bundle.js [--out <path>]（預設輸出到 repo 根目錄 index.html）
 */
var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var SRC = path.join(ROOT, "src");

/** 依賴順序：被 require 的檔先註冊（註冊器為惰性求值，順序其實無關，但依 ADR 固定）。 */
var FILES = [
  "engine/rng.js",
  "engine/selectors.js",
  "engine/ai.js",
  "engine/reducer.js",
  "engine/index.js",
  "ui/app.js"
];
var ENTRY = "ui/app.js";
var DATA_FILES = ["jobs", "assets", "tokens", "balance"];
var MAX_BYTES = 300 * 1024;

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

function build(outPath) {
  var template = read("ui/index.template.html");
  ["<!-- INJECT:CSS -->", "<!-- INJECT:VERSION -->", "<!-- INJECT:DATA -->", "<!-- INJECT:JS -->"].forEach(function (mark) {
    if (template.indexOf(mark) < 0) throw new Error("template 缺少標記 " + mark);
  });

  var css = read("ui/styles.css").replace(/<\/style/gi, "<\\/style");

  var version = String(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version || "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("package.json 的 version 不是 X.Y.Z 格式：" + JSON.stringify(version));
  var versionScript = "<script>\nwindow.GAME_VERSION = " + JSON.stringify(version) + ";\n</script>";

  var dataObj = {};
  DATA_FILES.forEach(function (name) { dataObj[name] = JSON.parse(read("data/" + name + ".json")); });
  var dataScript = "<script>\nwindow.GAME_DATA = " + safeScript(JSON.stringify(dataObj)) + ";\n</script>";

  var js = ["<script>", "(function () {", '"use strict";', REGISTRY];
  FILES.forEach(function (rel) {
    js.push("__define(" + JSON.stringify(rel) + ", function (module, exports, require) {");
    js.push(safeScript(read(rel)));
    js.push("});");
  });
  js.push("__require(" + JSON.stringify(ENTRY) + ");");
  js.push("})();");
  js.push("</script>");

  // 用函式替換：字串替換會把原始碼裡的 $&、$' 等當成特殊樣式，導致產物語法錯誤。
  var cssBlock = "<style>\n" + css + "\n</style>";
  var jsBlock = js.join("\n");
  var html = template
    .replace("<!-- INJECT:CSS -->", function () { return cssBlock; })
    .replace("<!-- INJECT:VERSION -->", function () { return versionScript; })
    .replace("<!-- INJECT:DATA -->", function () { return dataScript; })
    .replace("<!-- INJECT:JS -->", function () { return jsBlock; });

  var problems = check(html);
  if (problems.length) throw new Error("產物自檢失敗：\n- " + problems.join("\n- "));

  fs.writeFileSync(outPath, html, "utf8");
  return { bytes: Buffer.byteLength(html, "utf8"), files: FILES.length, data: DATA_FILES.length, version: version };
}

/** 零外部資源與大小檢查（規格 A-05、T-UI-04）。 */
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

if (require.main === module) {
  var out = path.join(ROOT, "index.html");
  var idx = process.argv.indexOf("--out");
  if (idx > 0 && process.argv[idx + 1]) out = path.resolve(process.argv[idx + 1]);
  try {
    var r = build(out);
    console.log("build 完成：" + path.relative(ROOT, out) + "（v" + r.version + "；" + r.bytes + " bytes；" + r.files + " 個模組、" + r.data + " 個資料檔；零外部資源）");
  } catch (e) {
    console.error("build 失敗：" + e.message);
    process.exit(1);
  }
}

module.exports = { build: build, check: check, FILES: FILES };
