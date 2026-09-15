// G3 驗證：不讀時鐘的節點上限（nodeLimit）對 QTM 建議解長度與耗時的影響（Node，單執行緒）
'use strict';
const S = require('../../spike/code/solver.js');
const t0 = process.hrtime.bigint();
S.init({ metrics: ['qtm'], twistFlip: true });
console.log('init(qtm, twistFlip) ms', Number(process.hrtime.bigint() - t0) / 1e6);
const N = +process.argv[2] || 1000, seed = +process.argv[3] || 20260915;
const limits = (process.argv[4] || '0,100000,300000,1000000,3000000').split(',').map(Number);
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
for (const lim of limits) {
  const rng = S.makeRng(seed);
  const q = [], ms = [], firstNodes = [], nodes = []; let ok = 0, fb = 0; const hist = {};
  for (let i = 0; i < N; i++) {
    const c = S.randomCube(rng);
    const a = process.hrtime.bigint();
    const r = S.solve(c, { metric: 'qtm', timeLimitMs: Infinity, nodeLimit: lim });
    ms.push(Number(process.hrtime.bigint() - a) / 1e6);
    if (r.error) { console.log('ERR', r.error); continue; }
    if (S.isSolved(S.applyMoves(c, r.moves))) ok++;
    if (r.fallback) fb++;
    q.push(r.qtm); hist[r.qtm] = (hist[r.qtm] || 0) + 1;
    firstNodes.push(r.found[0].atNodes); nodes.push(r.nodes);
  }
  console.log(`nodeLimit=${lim}: 復原 ${ok}/${N}；QTM 平均 ${avg(q).toFixed(2)} 最大 ${Math.max(...q)}；ms 平均 ${avg(ms).toFixed(1)} p95 ${pct(ms, .95).toFixed(1)} 最大 ${Math.max(...ms).toFixed(1)}；第一組解節點 平均 ${Math.round(avg(firstNodes))} p95 ${pct(firstNodes, .95)} 最大 ${Math.max(...firstNodes)}；總節點最大 ${Math.max(...nodes)}；退回重搜 ${fb}`);
  console.log('  QTM 直方圖 ' + JSON.stringify(hist));
}
