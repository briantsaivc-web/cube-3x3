// 瀏覽器參考值：Playwright Chromium（headless）中以 Blob URL 產生 Web Worker，量建表與求解時間。
// 用法：PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node bench-browser.js
'use strict';
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('找不到 playwright 套件：請在 scratch/spike-solver/ 內執行 npm i -D playwright');
  process.exit(1);
}
const solverSrc = fs.readFileSync(path.join(__dirname, 'solver.js'), 'utf8');

// Worker 內執行的量測程式（ES2017）
const workerBench = `
self.onmessage = function (ev) {
  var job = ev.data, S = self.CubeSolver, out = { job: job.kind };
  function st(a) {
    var b = a.slice().sort(function (x, y) { return x - y; });
    var sum = b.reduce(function (s, x) { return s + x; }, 0);
    function pick(p) { return b[Math.min(b.length - 1, Math.ceil(p * b.length) - 1)]; }
    return { n: b.length, mean: +(sum / b.length).toFixed(3), p50: +pick(0.5).toFixed(3), p95: +pick(0.95).toFixed(3), max: +b[b.length - 1].toFixed(3) };
  }
  var t0 = performance.now();
  var info = S.init(job.initOpts);
  out.initMs = +(performance.now() - t0).toFixed(1);
  out.timing = info.timing;
  if (job.solve) {
    job.solve.forEach(function (p) {
      var rng = S.makeRng(job.seed), times = [], len = [], htm = [], qtm = [], ok = 0;
      for (var i = 0; i < job.n; i++) {
        var c = S.randomCube(rng);
        var r = S.solve(c, p.opts);
        if (!r.error && S.isSolved(S.applyMoves(c, r.moves))) ok++;
        times.push(r.timeMs); htm.push(r.htm); qtm.push(r.qtm);
      }
      out[p.name] = { solved: ok, timeMs: st(times), htm: st(htm), qtm: st(qtm) };
    });
  }
  if (job.optimal) {
    var rng2 = S.makeRng(job.seed + 1);
    job.optimal.forEach(function (n) {
      var times = [], ok = 0;
      for (var i = 0; i < job.optimalK; i++) {
        var sc = S.randomQuarterScramble(rng2, n);
        var c = S.applyMoves(S.newCube(), sc);
        var r = S.solveOptimalQTM(c, { maxDepth: n, hardTimeLimitMs: 20000 });
        if (!r.error && S.isSolved(S.applyMoves(c, r.moves))) ok++;
        times.push(r.timeMs);
      }
      out['optimalDepth' + n] = { solved: ok, timeMs: st(times) };
    });
  }
  self.postMessage(out);
};
`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  console.log('browser', browser.version());
  const runJob = (job) => page.evaluate(({ src, job }) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = (e) => { resolve(e.data); w.terminate(); URL.revokeObjectURL(url); };
    w.onerror = (e) => reject(new Error(e.message));
    w.postMessage(job);
  }), { src: solverSrc + '\n' + workerBench, job });

  const qtmInit = { metrics: ['qtm'], twistFlip: true, cornerTable: true };
  // 1) 冷啟動建表 3 次（每次新 Worker）
  const inits = [];
  for (let i = 0; i < 3; i++) {
    const r = await runJob({ kind: 'init', initOpts: qtmInit });
    inits.push(r.initMs);
    console.log('INIT qtm-config run', i + 1, JSON.stringify(r));
  }
  for (let i = 0; i < 3; i++) {
    const r = await runJob({ kind: 'init', initOpts: { metrics: ['htm'], twistFlip: true } });
    console.log('INIT htm-config run', i + 1, JSON.stringify({ initMs: r.initMs }));
  }
  const med = inits.slice().sort((a, b) => a - b)[1];
  console.log('INIT qtm-config median', med);
  // 2) 100 局求解
  const r2 = await runJob({
    kind: 'solve', initOpts: qtmInit, seed: 20260915, n: 100,
    solve: [
      { name: 'QTM 第一組解即停', opts: { metric: 'qtm', timeLimitMs: 0 } },
      { name: 'QTM 固定改進 100ms', opts: { metric: 'qtm', timeLimitMs: 100 } }
    ],
    optimal: [12, 13, 14], optimalK: 10
  });
  console.log('SOLVE', JSON.stringify(r2, null, 1));
  const r3 = await runJob({
    kind: 'solve', initOpts: { metrics: ['htm'], twistFlip: true }, seed: 20260915, n: 100,
    solve: [
      { name: 'HTM 第一組解即停', opts: { metric: 'htm', timeLimitMs: 0 } },
      { name: 'HTM 目標≤21（上限 2000ms）', opts: { metric: 'htm', targetLength: 21, timeLimitMs: 2000 } }
    ]
  });
  console.log('SOLVE-HTM', JSON.stringify(r3, null, 1));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
