// tests/engine/forbidden.test.js — T-001 S3：非決定性來源／DOM 依賴掃描
//
// 依據：game-spec.md §12.1 T-ENG-24；規則與 .claude/hooks/check-forbidden.sh 相同
// （含註解一併掃描）。掃描 src/engine/ 與 src/solver/ 底下所有 .js 檔。
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.join(__dirname, '..', '..');

// 與 .claude/hooks/check-forbidden.sh 相同的規則。
var FORBIDDEN_PATTERN = /Math\.random|Date\.now|new Date\(|performance\.now|localStorage|sessionStorage|document\.|window\.|navigator\.|fetch\(|setTimeout|setInterval|requestAnimationFrame/;

function listJsFiles(dir) {
  var out = [];
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(listJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  });
  return out;
}

function loadAllowlist() {
  var file = path.join(ROOT, '.claude', 'hooks', 'forbidden-allowlist.txt');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
}

test('T-ENG-24：掃描 src/engine/、src/solver/：無 check-forbidden.sh 所列字串（含註解）', function () {
  var allowlist = loadAllowlist();
  var dirs = [path.join(ROOT, 'src', 'engine'), path.join(ROOT, 'src', 'solver')];
  var hits = [];

  dirs.forEach(function (dir) {
    listJsFiles(dir).forEach(function (file) {
      var content = fs.readFileSync(file, 'utf8');
      content.split('\n').forEach(function (line, idx) {
        if (!FORBIDDEN_PATTERN.test(line)) return;
        var allowed = allowlist.some(function (pattern) { return line.indexOf(pattern) !== -1; });
        if (!allowed) {
          hits.push(path.relative(ROOT, file) + ':' + (idx + 1) + ': ' + line.trim());
        }
      });
    });
  });

  assert.deepEqual(hits, [], '發現非決定性來源或 DOM／計時器依賴：\n' + hits.join('\n'));
});
