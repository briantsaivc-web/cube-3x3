'use strict';
const C = require('./cube-model.js'); const L = require('./lbl.js'); const S = C.S;
const rng = S.makeRng(1); 
for (const f of ['F', 'R', 'B', 'L']) {
  L.setHeadlight(f); let ok = 0, fail = 0;
  for (let t = 0; t < 300; t++) {
    const c = S.randomCube(rng); const st = S.cubieToFacelets(c).split('').map(ch => 'URFDLB'.indexOf(ch));
    try { L.generate(st); ok++; } catch (e) { fail++; if (fail === 1) console.log(f, e.message); }
  }
  console.log('headlights at', f, 'ok', ok, 'fail', fail);
}
