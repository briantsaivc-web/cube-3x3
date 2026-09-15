// 量測腳本（Node）。用法：
//   node bench.js build            建表一次（冷啟動），印出各表時間與大小
//   node bench.js build-cold 3     另開 3 個子行程各冷啟動建表一次，取中位數
//   node bench.js solve N SEED     N 局 random-state，三種停止策略
//   node bench.js solveq N SEED    N 局 random-state，以 QTM 成本搜尋
//   node bench.js qtm N SEED       QTM 三種做法比較
//   node bench.js tf N SEED        第一階段有／無 twist×flip 表的比較（另開子行程）
//   node bench.js optimal MAXN K SEED CAPMS MINN  短打亂 QTM 最少步耗時（每深度 K 局）
//   node bench.js cap              第二階段深度上限取捨
//   node bench.js size             原始碼大小
'use strict';
const S = require('./solver.js');
const fs = require('fs');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const mode = process.argv[2];
const arg = (i, d) => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);

function stats(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  const sum = a.reduce((s, x) => s + x, 0);
  const pick = (p) => a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
  return { n: a.length, mean: +(sum / a.length).toFixed(3), p50: +pick(0.5).toFixed(3), p95: +pick(0.95).toFixed(3), max: +a[a.length - 1].toFixed(3), min: +a[0].toFixed(3) };
}
function hist(arr) {
  const h = {};
  for (const x of arr) h[x] = (h[x] || 0) + 1;
  return h;
}
function median(a) { const b = a.slice().sort((x, y) => x - y); return b[(b.length - 1) >> 1]; }

if (mode === 'build') {
  const cfg = process.argv[3] || 'full';
  const t0 = performance.now();
  const opt = cfg === 'lite' ? { metrics: ['htm'], twistFlip: false }
    : cfg === 'htm' ? { metrics: ['htm'], twistFlip: true }
      : cfg === 'qtm' ? { metrics: ['qtm'], twistFlip: true, cornerTable: true }
      : { metrics: ['htm', 'qtm'], twistFlip: true, cornerTable: true };
  const info = S.init(opt);
  const total = performance.now() - t0;
  const mem = process.memoryUsage();
  console.log(JSON.stringify({ cfg, totalMs: +total.toFixed(1), timing: Object.fromEntries(Object.entries(info.timing).map(([k, v]) => [k, +v.toFixed(1)])), moveTables: info.moveTables, pruneTables: info.pruneTables, maxDepth: info.maxDepth, rssMB: +(mem.rss / 1048576).toFixed(1), arrayBuffersMB: +(mem.arrayBuffers / 1048576).toFixed(1) }));
} else if (mode === 'build-cold') {
  const n = arg(3, 3);
  for (const cfg of ['lite', 'htm', 'qtm', 'full']) {
    const runs = [];
    for (let i = 0; i < n; i++) {
      const out = execFileSync(process.execPath, [__filename, 'build', cfg], { encoding: 'utf8' });
      const j = JSON.parse(out);
      runs.push(j);
      console.log('run', i + 1, cfg, JSON.stringify({ totalMs: j.totalMs, timing: j.timing }));
    }
    const sumBytes = (o) => Object.values(o).reduce((s, x) => s + x, 0);
    console.log('SUMMARY', cfg, JSON.stringify({ medianTotalMs: median(runs.map((r) => r.totalMs)), moveTableBytes: sumBytes(runs[0].moveTables), pruneTableBytes: sumBytes(runs[0].pruneTables), rssMB: runs[0].rssMB, arrayBuffersMB: runs[0].arrayBuffersMB }));
    if (cfg === 'full') console.log('TABLES', JSON.stringify({ moveTables: runs[0].moveTables, pruneTables: runs[0].pruneTables, maxDepth: runs[0].maxDepth }));
  }
} else if (mode === 'solve') {
  const N = arg(3, 1000), seed = arg(4, 20260915);
  S.init({ metrics: ['htm'], twistFlip: true });
  const policies = [
    { name: 'P0 第一組解即停', opts: { metric: 'htm', timeLimitMs: 0 } },
    { name: 'P1 目標≤21 HTM（上限 2000ms）', opts: { metric: 'htm', targetLength: 21, timeLimitMs: 2000 } },
    { name: 'P2 固定改進 100ms', opts: { metric: 'htm', timeLimitMs: 100 } }
  ];
  for (const p of policies) {
    const rng = S.makeRng(seed);
    const times = [], htm = [], qtm = [];
    let solved = 0, hitTarget = 0;
    for (let i = 0; i < N; i++) {
      const c = S.randomCube(rng);
      const r = S.solve(c, p.opts);
      if (!r.error && S.isSolved(S.applyMoves(c, r.moves))) solved++;
      times.push(r.timeMs); htm.push(r.htm); qtm.push(r.qtm);
      if (p.opts.targetLength && r.htm <= p.opts.targetLength) hitTarget++;
    }
    console.log('POLICY', p.name, JSON.stringify({ N, seed, solved, hitTarget: p.opts.targetLength ? hitTarget : undefined, timeMs: stats(times), htm: stats(htm), qtm: stats(qtm) }));
    console.log('  HTM 直方圖', JSON.stringify(hist(htm)));
    console.log('  QTM 直方圖', JSON.stringify(hist(qtm)));
  }
} else if (mode === 'solveq') {
  const N = arg(3, 1000), seed = arg(4, 20260915);
  S.init({ metrics: ['qtm'], twistFlip: true });
  const policies = [
    { name: 'Q0 QTM 第一組解即停', opts: { metric: 'qtm', timeLimitMs: 0 } },
    { name: 'Q1 QTM 固定改進 100ms', opts: { metric: 'qtm', timeLimitMs: 100 } }
  ];
  for (const p of policies) {
    const rng = S.makeRng(seed);
    const times = [], htm = [], qtm = [];
    let solved = 0, fallback = 0;
    for (let i = 0; i < N; i++) {
      const c = S.randomCube(rng);
      const r = S.solve(c, p.opts);
      if (!r.error && S.isSolved(S.applyMoves(c, r.moves))) solved++;
      if (r.fallback) fallback++;
      times.push(r.timeMs); htm.push(r.htm); qtm.push(r.qtm);
    }
    console.log('POLICY', p.name, JSON.stringify({ N, seed, solved, fallback, timeMs: stats(times), htm: stats(htm), qtm: stats(qtm) }));
    console.log('  HTM 直方圖', JSON.stringify(hist(htm)));
    console.log('  QTM 直方圖', JSON.stringify(hist(qtm)));
  }
} else if (mode === 'qtm') {
  const N = arg(3, 200), seed = arg(4, 31415), budget = arg(5, 100);
  S.init({ metrics: ['htm', 'qtm'], twistFlip: true });
  const rng = S.makeRng(seed);
  const A = [], B = [], C = [], Ah = [], Ch = [], firstA = [], firstC = [], tA = [], tC = [];
  let cBetter = 0, cWorse = 0, bBetter = 0;
  for (let i = 0; i < N; i++) {
    const c = S.randomCube(rng);
    const rh = S.solve(c, { metric: 'htm', timeLimitMs: budget });
    const rq = S.solve(c, { metric: 'qtm', timeLimitMs: budget });
    const bq = Math.min(...rh.found.map((f) => f.qtm));
    A.push(rh.qtm); Ah.push(rh.htm); B.push(bq); C.push(rq.qtm); Ch.push(rq.htm);
    firstA.push(rh.found[0].atMs); firstC.push(rq.found[0].atMs);
    tA.push(rh.timeMs); tC.push(rq.timeMs);
    if (rq.qtm < rh.qtm) cBetter++; else if (rq.qtm > rh.qtm) cWorse++;
    if (bq < rh.qtm) bBetter++;
    if (!S.isSolved(S.applyMoves(c, rq.moves))) throw new Error('QTM 解錯誤');
  }
  console.log(JSON.stringify({ N, seed, budgetMs: budget }));
  console.log('(a) HTM 搜尋 → 換算 QTM', JSON.stringify({ qtm: stats(A), htm: stats(Ah), firstSolutionMs: stats(firstA), timeMs: stats(tA) }));
  console.log('(b) HTM 搜尋過程各解中挑 QTM 最短', JSON.stringify({ qtm: stats(B), betterThanA: bBetter }));
  console.log('(c) 以 QTM 成本搜尋', JSON.stringify({ qtm: stats(C), htm: stats(Ch), firstSolutionMs: stats(firstC), timeMs: stats(tC), betterThanA: cBetter, worseThanA: cWorse }));
  console.log('  (a) QTM 直方圖', JSON.stringify(hist(A)));
  console.log('  (c) QTM 直方圖', JSON.stringify(hist(C)));
} else if (mode === 'tf') {
  const N = arg(3, 200), seed = arg(4, 2718);
  const cfg = process.argv[5];
  if (!cfg) {
    for (const c of ['lite', 'full']) process.stdout.write(execFileSync(process.execPath, [__filename, 'tf', N, seed, c], { encoding: 'utf8' }));
  } else {
    S.init({ metrics: ['htm'], twistFlip: cfg === 'full' });
    const rng = S.makeRng(seed);
    const t21 = [], first = [], htm = [];
    let hit = 0;
    for (let i = 0; i < N; i++) {
      const c = S.randomCube(rng);
      const r = S.solve(c, { metric: 'htm', targetLength: 21, timeLimitMs: 2000 });
      t21.push(r.timeMs); first.push(r.found[0].atMs); htm.push(r.htm);
      if (r.htm <= 21) hit++;
    }
    console.log('TF', cfg, JSON.stringify({ N, seed, hitTarget21: hit, timeToTarget21Ms: stats(t21), firstSolutionMs: stats(first), htm: stats(htm) }));
  }
} else if (mode === 'optimal') {
  const maxN = arg(3, 14), K = arg(4, 10), seed = arg(5, 1618), cap = arg(6, 20000), minN = arg(7, 1);
  S.init({ metrics: ['qtm'], twistFlip: true, cornerTable: true });
  const rng = S.makeRng(seed);
  for (let n = minN; n <= maxN; n++) {
    const times = [], lens = [], nodes = [];
    let timeouts = 0;
    for (let i = 0; i < K; i++) {
      const sc = S.randomQuarterScramble(rng, n);
      const c = S.applyMoves(S.newCube(), sc);
      const r = S.solveOptimalQTM(c, { maxDepth: n, hardTimeLimitMs: cap });
      if (r.error) { timeouts++; times.push(r.timeMs); continue; }
      if (!S.isSolved(S.applyMoves(c, r.moves))) throw new Error('最少步解錯誤');
      times.push(r.timeMs); lens.push(r.qtm); nodes.push(r.nodes);
    }
    console.log('DEPTH', n, JSON.stringify({ K, timeouts, timeMs: stats(times), optimalQtm: lens.length ? hist(lens) : {}, nodes: nodes.length ? stats(nodes) : null }));
    if (timeouts === K) break;
  }
} else if (mode === 'cap') {
  // 第二階段深度上限的取捨（明確指定 phase2Cap，不觸發自動退回）
  S.init({ metrics: ['htm', 'qtm'], twistFlip: true });
  for (const cap of [18, 14, 12, 10]) {
    const rng = S.makeRng(20260915);
    const t = [], h = [], t21 = [], h21 = [];
    for (let i = 0; i < 300; i++) {
      const c = S.randomCube(rng);
      const r = S.solve(c, { metric: 'htm', timeLimitMs: 0, phase2Cap: cap });
      t.push(r.timeMs); h.push(r.htm);
      const r2 = S.solve(c, { metric: 'htm', targetLength: 21, timeLimitMs: 2000, phase2Cap: cap });
      t21.push(r2.timeMs); h21.push(r2.htm);
    }
    console.log('HTM cap', cap, JSON.stringify({ N: 300, firstMs: stats(t), firstHtm: stats(h), target21Ms: stats(t21), target21Htm: stats(h21) }));
  }
  for (const cap of [36, 24, 20, 18, 16]) {
    const rng = S.makeRng(31415);
    const t = [], q = [], qb = [];
    for (let i = 0; i < 200; i++) {
      const c = S.randomCube(rng);
      const r = S.solve(c, { metric: 'qtm', timeLimitMs: 0, phase2Cap: cap });
      t.push(r.timeMs); q.push(r.qtm);
      const r2 = S.solve(c, { metric: 'qtm', timeLimitMs: 100, phase2Cap: cap });
      qb.push(r2.qtm);
    }
    console.log('QTM cap', cap, JSON.stringify({ N: 200, firstMs: stats(t), firstQtm: stats(q), budget100Qtm: stats(qb) }));
  }
} else if (mode === 'size') {
  for (const f of ['solver.js']) {
    const buf = fs.readFileSync(__dirname + '/' + f);
    console.log(f, JSON.stringify({ bytes: buf.length, gzipBytes: zlib.gzipSync(buf, { level: 9 }).length, lines: buf.toString().split('\n').length }));
  }
} else {
  console.log('未知模式');
  process.exit(1);
}
