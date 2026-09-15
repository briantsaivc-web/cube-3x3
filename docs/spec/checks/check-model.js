// G3 驗證：記號方向慣例、QTM 計步、朝向換算、手勢對應、正規化後交給 spike 求解器
'use strict';
const assert = require('node:assert/strict');
const C = require('./cube-model.js');
const S = C.S;
let pass = 0; const ok = (name) => { pass++; console.log('ok  ' + name); };
const eqArr = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const rng = S.makeRng(20260915); const ri = n => Math.floor(rng() * n);

// 1. 每個轉動 4 次＝原狀；X 與 X′ 互逆；X2 = X X
for (const b of 'URFDLBMESxyz') {
  let a = C.SOLVED.slice(); for (let k = 0; k < 4; k++) a = C.apply(a, b);
  assert.ok(eqArr(a, C.SOLVED));
  const r = rng; const sc = Array.from({ length: 20 }, () => C.NAMES[ri(36)]);
  const s0 = C.applyAll(C.SOLVED, sc);
  assert.ok(eqArr(C.apply(C.apply(s0, b), b + "'"), s0));
  assert.ok(eqArr(C.apply(C.apply(s0, b + "'"), b), s0));
  assert.ok(eqArr(C.apply(s0, b + '2'), C.apply(C.apply(s0, b), b)));
}
ok('36 個轉動：X⁴＝原狀、X·X′＝原狀、X2＝X·X');

// 2. 外層 18 個與 spike 的貼紙轉動完全一致
for (let m = 0; m < 18; m++) {
  const name = S.MOVE_NAMES[m];
  const letters = S.SOLVED_FACELETS.split('');
  const a = C.apply(letters, name).join('');
  assert.equal(a, S.applyMoveFacelets(S.SOLVED_FACELETS, m));
}
ok('外層 18 個轉動與 spike solver.js 的貼紙置換一致');

// 3. 慣例恆等式：M = R L′ x′、E = U D′ y′、S = F′ B z（同軸可交換）
const rs = C.applyAll(C.SOLVED, Array.from({ length: 25 }, () => C.NAMES[ri(36)]));
assert.ok(eqArr(C.apply(rs, 'M'), C.applyAll(rs, ['R', "L'", "x'"])));
assert.ok(eqArr(C.apply(rs, 'E'), C.applyAll(rs, ['U', "D'", "y'"])));
assert.ok(eqArr(C.apply(rs, 'S'), C.applyAll(rs, ["F'", 'B', 'z'])));
assert.ok(eqArr(C.apply(rs, 'x'), C.applyAll(rs, ['R', "M'", "L'"])));
assert.ok(eqArr(C.apply(rs, 'y'), C.applyAll(rs, ['U', "E'", "D'"])));
assert.ok(eqArr(C.apply(rs, 'z'), C.applyAll(rs, ['F', 'S', "B'"])));
ok("慣例恆等式：M=R L' x'、E=U D' y'、S=F' B z、x=R M' L'、y=U E' D'、z=F S B'");

// 4. 方向抽查：M 把 U 面中欄帶到 F 面（同 L：U→F）；E 把 F 面中排帶到 R 面（同 D）；S 把 U 面中排帶到 R 面（同 F）
{ const L = S.SOLVED_FACELETS.split('');
  const m = C.apply(L, 'M'); assert.equal(m[18 + 1], 'U'); assert.equal(m[18 + 4], 'U'); // F 面中欄上＝原 U
  const e = C.apply(L, 'E'); assert.equal(e[9 + 3], 'F'); // R 面中排＝原 F
  const s = C.apply(L, 'S'); assert.equal(s[9 + 1], 'U'); // R 面中欄＝原 U
  const l = C.apply(L, 'L'); assert.equal(l[18 + 0], 'U'); // 對照：L 也把 U 帶到 F
  const d = C.apply(L, 'D'); assert.equal(d[9 + 6], 'F'); // 對照：D 把 F 底排帶到 R
  const f = C.apply(L, 'F'); assert.equal(f[9 + 0], 'U'); // 對照：F 把 U 底排帶到 R
}
ok('方向抽查：M 同 L（U→F）、E 同 D（F→R）、S 同 F（U→R）');

// 5. QTM 計步表
const cost = {}; for (const n of C.NAMES) cost[n] = C.qtmCost(n);
assert.deepEqual([cost.R, cost.R2, cost["R'"], cost.M, cost.M2, cost["M'"], cost.x, cost.y2, cost["z'"]], [1, 2, 1, 2, 4, 2, 0, 0, 0]);
ok('QTM：外層 1/2、中層 2/4、整顆 0');

// 6. 復原判定：24 種朝向下的復原狀態都算復原；中層＋整顆組合回到同色也算
for (let o = 0; o < 24; o++) assert.ok(C.isSolved(C.viewOf(C.SOLVED, o)));
assert.ok(C.isSolved(C.applyAll(C.SOLVED, ['M', "R'", 'L']))); // = x' 的整顆轉動
assert.ok(!C.isSolved(C.applyAll(C.SOLVED, ['M'])));
ok('復原判定：24 朝向皆為復原；M R′ L（＝整顆 x′）為復原；單一 M 非復原');

// 7. view ↔ home 換算：在 view 做 X ＝ 在 home 做 toHome(o, X)
for (let t = 0; t < 2000; t++) {
  const o = ri(24); const vm = C.NAMES[ri(27)]; // 只取外層＋中層
  const hm = C.toHome(o, vm);
  assert.equal(C.KIND(hm), C.KIND(vm));
  assert.ok(eqArr(C.apply(C.viewOf(rs, o), vm), C.viewOf(C.apply(rs, hm), o)));
  assert.equal(C.toView(o, hm), vm);
}
ok('view↔home 轉動換算 2,000 組一致，且外層↔外層、中層↔中層');

// 8. 整顆旋轉只改朝向：viewOf(home, orientAfter(o, r)) = apply(viewOf(home, o), r)
for (let t = 0; t < 500; t++) {
  const o = ri(24); const r = C.NAMES[27 + ri(9)];
  assert.ok(eqArr(C.viewOf(rs, C.orientAfter(o, r)), C.apply(C.viewOf(rs, o), r)));
}
ok('整顆旋轉＝只改 orient，不動 home 貼紙（500 組）');

// 9. 手勢：54 格 × 4 方向，被按住的貼紙必往滑動方向移動，且同一層所有外層貼紙一致
let gcount = 0; const table = {};
for (let i = 0; i < 54; i++) {
  const f = C.FACES[(i / 9) | 0]; const [r, d] = C.FACE_AXES[f];
  for (const [label, dir] of [['右', r], ['左', r.map(v => -v)], ['下', d], ['上', d.map(v => -v)]]) {
    const mv = C.gestureToMove(i, dir);
    const tag = new Array(54).fill(0); tag[i] = 1;
    const after = C.apply(tag, mv); const j = after.indexOf(1);
    const disp = [0, 1, 2].map(k => (C.POS[j][k] + 0.5 * C.NRM[j][k]) - (C.POS[i][k] + 0.5 * C.NRM[i][k])); // 貼紙表面點位移
    assert.ok(C.dot(disp, dir) > 0, `貼紙 ${i} 往${label} 得 ${mv} 但位移不同向`);
    gcount++; if (i === 22 || i === 18 || i === 4) table[`${f}${i - 9 * ((i / 9) | 0) + 1} 往${label}`] = mv;
  }
}
ok('手勢對應：216 組（54 格×4 方向）貼紙位移皆與滑動方向同向');
console.log('    抽樣（F 面、U 面）：' + JSON.stringify(table));

// 10. 正規化：含中層與整顆旋轉的亂序 → 以目前中心定義面 → spike 求解（QTM）→ 套回（view 座標）→ 復原
S.init({ metrics: ['qtm'], twistFlip: true });
let solved = 0;
for (let t = 0; t < 200; t++) {
  const seq = Array.from({ length: 30 }, () => C.NAMES[ri(36)]);
  const home = C.applyAll(C.SOLVED, seq.filter(n => C.KIND(n) !== 'rotation'));
  let o = 0; for (const n of seq) if (C.KIND(n) === 'rotation') o = C.orientAfter(o, n);
  const view = C.viewOf(home, o);
  const r = S.fromStickerColors(view);
  assert.ok(r.ok, r.error);
  const sol = S.solve(r.cube, { metric: 'qtm', timeLimitMs: Infinity, nodeLimit: 200000 });
  const names = sol.moves.map(m => S.MOVE_NAMES[m]);
  // 在 view 做 → 換成 home 做，結果應為復原
  let h = home; for (const vm of names) h = C.apply(h, C.toHome(o, vm));
  assert.ok(C.isSolved(h)); solved++;
}
ok(`正規化：200 局含中層／整顆旋轉的狀態，fromStickerColors 皆合法，QTM 建議解套回後皆復原（${solved}/200）`);
console.log(`\n共 ${pass} 項通過`);
