// tests/engine/solver/lbl.test.js — 層先法產生器測試（T-LBL-01～T-LBL-10）
//
// 依據：game-spec.md §8、§12.3；分派單 T-001 S5。
// 樣本：
//   random  ─ 1,000 個 random-state（seed 20260915）。以本檔自建的 cubie 隨機產生與轉貼紙
//             （演算法與 spike randomCube／cubieToFacelets 相同，亂數用 engine 的 makeRng），
//             因此不依賴 src/solver/twophase.js（分派單 X-4）。
//   seq     ─ 1,000 個 40 記號隨機序列（36 記號任取，seed 31415）。
//   lastLayer ─ 前兩層已完成、頂層 62,208 種全列舉。
//   near    ─ 近復原 7,495 種（外層 ≤3 記號、36 記號 ≤2 記號、24 朝向的復原狀態）。
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const cube = require(path.join(ROOT, 'src/engine/cube.js'));
const { makeRng } = require(path.join(ROOT, 'src/engine/rng.js'));
const lbl = require(path.join(ROOT, 'src/solver/lbl.js'));
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/lbl.json'), 'utf8'));
const TEXTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/texts.json'), 'utf8'));

const SEGMENT_ORDER = ['hold', 'cross', 'corners', 'middle',
  'yellowCross', 'yellowFace', 'yellowCorners', 'yellowEdges'];

// ---------------------------------------------------------------------------
// 測試輔助：cubie 表示法 → 54 格色號（色號 0–5 ＝ U R F D L B）
// ---------------------------------------------------------------------------

const FACES = 'URFDLB';
const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

function normalOf(face) {
  return cube.STICKER_NRM[9 * FACES.indexOf(face) + 4];
}
function stickerIndex(pos, nrm) {
  for (let i = 0; i < 54; i++) {
    const p = cube.STICKER_POS[i];
    const n = cube.STICKER_NRM[i];
    if (p[0] === pos[0] && p[1] === pos[1] && p[2] === pos[2] &&
        n[0] === nrm[0] && n[1] === nrm[1] && n[2] === nrm[2]) return i;
  }
  throw new Error('找不到貼紙');
}
function pieceFacelets(name) {
  const pos = [0, 0, 0];
  for (const ch of name) {
    const n = normalOf(ch);
    pos[0] += n[0]; pos[1] += n[1]; pos[2] += n[2];
  }
  return name.split('').map((ch) => stickerIndex(pos, normalOf(ch)));
}
const CORNER_FACELET = CORNER_NAMES.map(pieceFacelets);
const EDGE_FACELET = EDGE_NAMES.map(pieceFacelets);

function newCubie() {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  };
}

// 慣例與 spike cubieToFacelets 相同：位置 p 的角塊 j、扭轉 o →
// 貼紙 CORNER_FACELET[p][(k + o) % 3] 為 CORNER_NAMES[j] 的第 k 個字母。
function cubieToStickers(c) {
  const out = new Array(54);
  for (let f = 0; f < 6; f++) out[9 * f + 4] = f;
  for (let p = 0; p < 8; p++) {
    const name = CORNER_NAMES[c.cp[p]];
    for (let k = 0; k < 3; k++) out[CORNER_FACELET[p][(k + c.co[p]) % 3]] = FACES.indexOf(name[k]);
  }
  for (let q = 0; q < 12; q++) {
    const name = EDGE_NAMES[c.ep[q]];
    for (let t = 0; t < 2; t++) out[EDGE_FACELET[q][(t + c.eo[q]) % 2]] = FACES.indexOf(name[t]);
  }
  return out;
}

function permParity(arr) {
  let par = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) par ^= 1;
  }
  return par;
}

// 均勻隨機合法狀態；亂數消耗順序與 spike randomCube 相同（同 seed 得同一批狀態）。
function randomCubie(rng) {
  const c = newCubie();
  const randInt = (n) => Math.floor(rng() * n);
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  };
  shuffle(c.cp);
  shuffle(c.ep);
  if (permParity(c.cp) !== permParity(c.ep)) { const t = c.ep[0]; c.ep[0] = c.ep[1]; c.ep[1] = t; }
  let s = 0;
  for (let i = 0; i < 7; i++) { c.co[i] = randInt(3); s += c.co[i]; }
  c.co[7] = (3 - (s % 3)) % 3;
  s = 0;
  for (let i = 0; i < 11; i++) { c.eo[i] = randInt(2); s += c.eo[i]; }
  c.eo[11] = s & 1;
  return c;
}

function permutations4() {
  const out = [];
  (function rec(a, k) {
    if (k === 4) { out.push(a.slice()); return; }
    for (let i = k; i < 4; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      rec(a, k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  })([0, 1, 2, 3], 0);
  return out;
}

// ---------------------------------------------------------------------------
// 樣本（惰性建立、只算一次）
// ---------------------------------------------------------------------------

function buildRandomViews() {
  const rng = makeRng(20260915);
  const views = [];
  for (let i = 0; i < 1000; i++) views.push(cubieToStickers(randomCubie(rng)));
  return views;
}

function buildSeqViews() {
  const rng = makeRng(31415);
  const views = [];
  for (let i = 0; i < 1000; i++) {
    const seq = [];
    for (let k = 0; k < 40; k++) seq.push(cube.MOVES[Math.floor(rng() * 36)]);
    views.push(cube.applyMoves(cube.SOLVED, seq));
  }
  return views;
}

// 前兩層（U 層白色與中層）已完成，D 層（位置 4–7 的角與邊）任意合法。
function buildLastLayerViews() {
  const perms = permutations4();
  const views = [];
  for (const cp of perms) {
    for (let co = 0; co < 27; co++) {
      for (const ep of perms) {
        if (permParity(cp) !== permParity(ep)) continue;
        for (let eo = 0; eo < 8; eo++) {
          const c = newCubie();
          const cos = [co % 3, Math.floor(co / 3) % 3, Math.floor(co / 9) % 3];
          cos.push((6 - cos[0] - cos[1] - cos[2]) % 3);
          const eos = [eo & 1, (eo >> 1) & 1, (eo >> 2) & 1];
          eos.push((eos[0] + eos[1] + eos[2]) & 1);
          for (let i = 0; i < 4; i++) {
            c.cp[4 + i] = 4 + cp[i]; c.co[4 + i] = cos[i];
            c.ep[4 + i] = 4 + ep[i]; c.eo[4 + i] = eos[i];
          }
          views.push(cubieToStickers(c));
        }
      }
    }
  }
  return views;
}

function buildNearViews() {
  const outer = cube.MOVES.slice(0, 18);
  const views = [cube.SOLVED.slice()];
  for (const a of outer) {
    const s1 = cube.applyMove(cube.SOLVED, a);
    views.push(s1);
    for (const b of outer) {
      const s2 = cube.applyMove(s1, b);
      views.push(s2);
      for (const c of outer) views.push(cube.applyMove(s2, c));
    }
  }
  for (const a of cube.MOVES) {
    for (const b of cube.MOVES) views.push(cube.applyMoves(cube.SOLVED, [a, b]));
  }
  for (let o = 0; o < 24; o++) views.push(cube.applyOrient(cube.SOLVED, o));
  return views;
}

const cache = {};
function sample(name) {
  if (!cache[name]) {
    const builders = { random: buildRandomViews, seq: buildSeqViews,
      lastLayer: buildLastLayerViews, near: buildNearViews };
    const views = builders[name]();
    const runs = views.map((view) => ({ view, out: lbl.generateLblDetailed(view, CONFIG) }));
    cache[name] = runs;
  }
  return cache[name];
}
const ALL_SETS = ['random', 'seq', 'lastLayer', 'near'];

// ---------------------------------------------------------------------------
// 檢查函式
// ---------------------------------------------------------------------------

function assertSolvedAll(name, expectedCount) {
  const runs = sample(name);
  assert.equal(runs.length, expectedCount, `${name} 樣本數`);
  let ok = 0;
  runs.forEach((r, i) => {
    assert.ok(!r.out.error, `${name}#${i} 回傳錯誤 ${r.out.error}:${r.out.detail}`);
    const end = cube.applyMoves(r.view, r.out.result.tokens);
    assert.ok(cube.isSolved(end), `${name}#${i} 套用後未復原`);
    ok++;
  });
  return ok;
}

const FORMULA_TOKENS = {};
for (const id of Object.keys(CONFIG.formulas)) {
  FORMULA_TOKENS[id] = cube.parseMoves(CONFIG.formulas[id].alg);
}

function checkStructure(res, tag) {
  const { tokens, segments } = res;
  assert.ok(Array.isArray(tokens), `${tag} tokens`);
  tokens.forEach((t) => assert.ok(cube.MOVES.includes(t), `${tag} 無效記號 ${t}`));
  assert.equal(segments.length, 8, `${tag} 段數`);
  assert.deepEqual(segments.map((s) => s.id), SEGMENT_ORDER, `${tag} 段順序`);
  let pos = 0;
  let total = 0;
  for (const seg of segments) {
    assert.equal(seg.start, pos, `${tag} ${seg.id} 未與前段相接`);
    assert.ok(seg.end >= seg.start, `${tag} ${seg.id} end < start`);
    const q = tokens.slice(seg.start, seg.end).reduce((a, m) => a + cube.qtmCost(m), 0);
    assert.equal(seg.qtm, q, `${tag} ${seg.id} qtm`);
    total += q;
    if (seg.start === seg.end) assert.equal(seg.parts.length, 0, `${tag} ${seg.id} 空段 parts 應為空`);
    let p = seg.start;
    for (const part of seg.parts) {
      assert.ok(part.start >= seg.start && part.end <= seg.end, `${tag} ${seg.id} part 超出段`);
      assert.equal(part.start, p, `${tag} ${seg.id} parts 未依序相接`);
      assert.ok(part.end > part.start, `${tag} ${seg.id} 空 part`);
      p = part.end;
      const toks = tokens.slice(part.start, part.end);
      if (part.kind === 'formula') {
        assert.ok(part.formula in CONFIG.formulas, `${tag} 未知公式 ${part.formula}`);
        assert.deepEqual(toks, FORMULA_TOKENS[part.formula], `${tag} 公式 ${part.formula} 記號不符`);
      } else if (part.kind === 'rotate') {
        assert.equal(part.formula, null);
        toks.forEach((t) => assert.equal(cube.kind(t), 'rotation', `${tag} rotate part 含 ${t}`));
      } else if (part.kind === 'setup') {
        assert.equal(part.formula, null);
        assert.equal(toks.length, 1, `${tag} setup part 應為單一轉動`);
        assert.equal(cube.kind(toks[0]), 'outer', `${tag} setup part 含 ${toks[0]}`);
      } else {
        assert.fail(`${tag} 未知 part.kind ${part.kind}`);
      }
    }
    assert.equal(p, seg.end, `${tag} ${seg.id} parts 未涵蓋整段`);
    pos = seg.end;
  }
  assert.equal(pos, tokens.length, `${tag} 分段未涵蓋全部記號`);
  assert.equal(res.qtm, total, `${tag} 總 qtm`);
}

// 相鄰同字母整顆旋轉：回傳 [{index, sameSegment}]
function adjacentRotations(res) {
  const segOf = new Array(res.tokens.length);
  res.segments.forEach((s, k) => { for (let i = s.start; i < s.end; i++) segOf[i] = k; });
  const hits = [];
  for (let i = 1; i < res.tokens.length; i++) {
    const a = res.tokens[i - 1];
    const b = res.tokens[i];
    if (cube.kind(a) === 'rotation' && a.charAt(0) === b.charAt(0)) {
      hits.push({ index: i, sameSegment: segOf[i - 1] === segOf[i], pair: a + ' ' + b,
        segs: res.segments[segOf[i - 1]].id + '→' + res.segments[segOf[i]].id });
    }
  }
  return hits;
}

function pct(values, p) {
  const b = values.slice().sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(p * b.length))];
}
function mean(values) {
  return values.reduce((a, v) => a + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// T-LBL-01～T-LBL-04：各類樣本 100% 復原
// ---------------------------------------------------------------------------

test('T-LBL-01：1,000 個 random-state（seed 20260915）100% 復原', () => {
  assert.equal(assertSolvedAll('random', 1000), 1000);
});

test('T-LBL-01 附帶：自建 random-state 與 twophase.randomCube 一致（twophase.js 存在且可用時才執行）', (t) => {
  const file = path.join(ROOT, 'src/solver/twophase.js');
  if (!fs.existsSync(file)) { t.skip('src/solver/twophase.js 不存在（S4 尚未完成）'); return; }
  let tp;
  try {
    tp = require(file);
  } catch (e) {
    t.skip('twophase.js 載入失敗：' + e.message);
    return;
  }
  if (typeof tp.randomCube !== 'function' || typeof tp.cubieToFacelets !== 'function' ||
      typeof tp.makeRng !== 'function') {
    t.skip('twophase.js 尚未匯出 randomCube／cubieToFacelets／makeRng');
    return;
  }
  const rng = tp.makeRng(20260915);
  const mine = sample('random');
  for (let i = 0; i < 1000; i++) {
    const f = tp.cubieToFacelets(tp.randomCube(rng));
    const colors = String(f).split('').map((ch) => FACES.indexOf(ch));
    assert.deepEqual(colors, mine[i].view, `random-state #${i} 與 twophase 不一致`);
  }
});

test('T-LBL-02：1,000 個 40 記號隨機序列（36 記號任取，seed 31415）100% 復原', () => {
  assert.equal(assertSolvedAll('seq', 1000), 1000);
});

test('T-LBL-03：末層全列舉 62,208 種 100% 復原', () => {
  assert.equal(assertSolvedAll('lastLayer', 62208), 62208);
  // 樣本本身：前兩層完成、互不相同
  const keys = new Set(sample('lastLayer').map((r) => r.view.join('')));
  assert.equal(keys.size, 62208);
});

test('T-LBL-04：近復原列舉 7,495 種 100% 復原', () => {
  assert.equal(assertSolvedAll('near', 7495), 7495);
});

// ---------------------------------------------------------------------------
// T-LBL-05：分段結構
// ---------------------------------------------------------------------------

test('T-LBL-05：分段結構（8 段、順序、首尾相接、parts 在段內、公式記號等於 lbl.json）', () => {
  // 匯出與資料檔對帳
  assert.deepEqual(lbl.SEGMENT_IDS, SEGMENT_ORDER);
  assert.deepEqual(CONFIG.segments, SEGMENT_ORDER);
  assert.deepEqual(Object.keys(lbl.STAGE_CHECKS), SEGMENT_ORDER);
  assert.deepEqual(Object.keys(TEXTS.lbl), SEGMENT_ORDER, 'texts.lbl 的鍵與分段 id 一致');
  for (const id of SEGMENT_ORDER) {
    assert.equal(typeof TEXTS.lbl[id].name, 'string');
    assert.equal(typeof TEXTS.lbl[id].desc, 'string');
  }
  const used = new Set();
  for (const set of ALL_SETS) {
    sample(set).forEach((r, i) => {
      checkStructure(r.out.result, `${set}#${i}`);
      r.out.result.segments.forEach((s) => s.parts.forEach((p) => { if (p.formula) used.add(p.formula); }));
    });
  }
  // 11 個公式都至少被用到一次（確認每條規則分支都有被測到）
  assert.deepEqual([...used].sort(), Object.keys(CONFIG.formulas).sort());
  // 已復原（白色朝上）：§8.4 middle 段一律先輸出 z2，所以只有 middle 段有一個 rotate part、qtm 0
  const solved = lbl.generateLbl(cube.SOLVED, CONFIG);
  assert.deepEqual(solved.tokens, ['z2']);
  assert.equal(solved.qtm, 0);
  solved.segments.forEach((s) => {
    if (s.id === 'middle') {
      assert.deepEqual([s.start, s.end, s.parts.length, s.parts[0].kind], [0, 1, 1, 'rotate']);
    } else {
      assert.equal(s.start, s.end);
      assert.deepEqual(s.parts, []);
    }
  });
  // 已復原且黃色朝上：hold 輸出 x2、middle 輸出 z2（皆 0 步；規則使然，見回報）
  const yellowUp = lbl.generateLbl(cube.applyMove(cube.SOLVED, 'x2'), CONFIG);
  assert.deepEqual(yellowUp.tokens, ['x2', 'z2']);
});

// ---------------------------------------------------------------------------
// T-LBL-06：決定性
// ---------------------------------------------------------------------------

test('T-LBL-06：同輸入兩次輸出完全相同（全部樣本），且不修改輸入陣列', () => {
  for (const set of ALL_SETS) {
    sample(set).forEach((r, i) => {
      const copy = r.view.slice();
      const again = lbl.generateLbl(copy, CONFIG);
      assert.deepEqual(again, r.out.result, `${set}#${i} 兩次輸出不同`);
      assert.deepEqual(copy, r.view, `${set}#${i} 輸入被修改`);
    });
  }
  // 設定物件也不得被修改
  const cfgCopy = JSON.parse(JSON.stringify(CONFIG));
  lbl.generateLbl(sample('random')[0].view, cfgCopy);
  assert.deepEqual(cfgCopy, CONFIG);
});

// ---------------------------------------------------------------------------
// T-LBL-07：相鄰同字母整顆旋轉
// ---------------------------------------------------------------------------

test('T-LBL-07：輸出中沒有相鄰的同字母整顆旋轉', (t) => {
  const crossSeg = {};
  for (const set of ALL_SETS) {
    sample(set).forEach((r, i) => {
      const hits = adjacentRotations(r.out.result);
      // 同一段內一律不得出現（§8.1 合併規則）
      hits.forEach((h) => assert.ok(!h.sameSegment, `${set}#${i} 段內相鄰 ${h.pair}`));
      if (set !== 'near') {
        assert.equal(hits.length, 0, `${set}#${i} 相鄰同字母整顆旋轉 ${JSON.stringify(hits)}`);
      } else {
        // 近復原樣本：§8.1 規定只在同段內合併；跨段（hold 的 z／z′ 緊接 middle 的 z2）
        // 只可能發生在 cross、corners 皆為空段時，列出次數供回報。
        hits.forEach((h) => {
          assert.equal(h.segs, 'hold→middle', `${set}#${i} 非預期的跨段相鄰 ${JSON.stringify(h)}`);
          crossSeg[h.pair] = (crossSeg[h.pair] || 0) + 1;
        });
      }
    });
  }
  t.diagnostic('近復原樣本跨段相鄰（hold→middle）：' + JSON.stringify(crossSeg));
});

// ---------------------------------------------------------------------------
// T-LBL-08：每段完成判定
// ---------------------------------------------------------------------------

test('T-LBL-08：每段結束時 §8.3 的完成判定成立（T-LBL-01、02 每一局；另含 03、04）', () => {
  for (const set of ALL_SETS) {
    sample(set).forEach((r, i) => {
      const res = r.out.result;
      let st = r.view;
      let pos = 0;
      for (const seg of res.segments) {
        st = cube.applyMoves(st, res.tokens.slice(pos, seg.end));
        pos = seg.end;
        assert.ok(lbl.STAGE_CHECKS[seg.id](st, CONFIG), `${set}#${i} ${seg.id} 結束時判定不成立`);
        // 空段表示進入該段時就已完成
        if (seg.start === seg.end) assert.ok(lbl.STAGE_CHECKS[seg.id](st, CONFIG));
      }
    });
  }
  // 判定函式本身的反例：打亂狀態下，除 hold 外都不成立
  const scrambled = sample('random')[0].view;
  const rotated = cube.applyOrient(cube.SOLVED, 1); // 整顆 x：白色不在 U
  for (const id of SEGMENT_ORDER.slice(1)) {
    assert.equal(lbl.STAGE_CHECKS[id](scrambled, CONFIG), false, `${id} 對打亂狀態應為 false`);
  }
  assert.equal(lbl.STAGE_CHECKS.hold(rotated, CONFIG), false);
  assert.equal(lbl.STAGE_CHECKS.cross(rotated, CONFIG), false);
  // 白色朝上的復原狀態：前三段成立、middle 之後（要求白色朝下）不成立
  assert.ok(lbl.STAGE_CHECKS.corners(cube.SOLVED, CONFIG));
  assert.equal(lbl.STAGE_CHECKS.middle(cube.SOLVED, CONFIG), false);
  const flipped = cube.applyMove(cube.SOLVED, 'z2');
  for (const id of SEGMENT_ORDER.slice(3)) assert.ok(lbl.STAGE_CHECKS[id](flipped, CONFIG), id);
  // 只差一個 U：yellowCross 與 yellowFace 成立、yellowCorners 與 yellowEdges 不成立
  const oneU = cube.applyMove(flipped, 'U');
  assert.ok(lbl.STAGE_CHECKS.yellowFace(oneU, CONFIG));
  assert.equal(lbl.STAGE_CHECKS.yellowCorners(oneU, CONFIG), false);
  assert.equal(lbl.STAGE_CHECKS.yellowEdges(oneU, CONFIG), false);
});

// ---------------------------------------------------------------------------
// T-LBL-09：迴圈上限與 LBL_STUCK
// ---------------------------------------------------------------------------

function withConfig(patch) {
  const c = JSON.parse(JSON.stringify(CONFIG));
  patch(c);
  return c;
}

test('T-LBL-09：各迴圈次數不超過 guards；故意改錯的設定觸發 LBL_STUCK，不得無窮迴圈', (t) => {
  // (1) 全部樣本的迴圈次數 ≤ guards
  const maxLoops = {};
  for (const k of lbl.GUARD_KEYS) maxLoops[k] = 0;
  for (const set of ALL_SETS) {
    sample(set).forEach((r) => {
      for (const k of lbl.GUARD_KEYS) {
        maxLoops[k] = Math.max(maxLoops[k], r.out.loops[k]);
        assert.ok(r.out.loops[k] <= CONFIG.guards[k], `${set} ${k} 超過 guards`);
      }
    });
  }
  assert.deepEqual(Object.keys(CONFIG.guards).sort(), lbl.GUARD_KEYS.slice().sort());
  t.diagnostic('各迴圈實際最大次數（四組樣本合計）：' + JSON.stringify(maxLoops));
  t.diagnostic('guards（lbl.json）：' + JSON.stringify(CONFIG.guards));

  // (2) headlightFace 改成 F：部分局面卡住並回 LBL_STUCK（§8.4：F 只完成少數）
  const views = sample('random').slice(0, 300).map((r) => r.view);
  const tally = {};
  for (const face of ['F', 'R', 'L', 'B']) {
    const cfg = withConfig((c) => { c.headlightFace = face; });
    let ok = 0;
    let stuck = 0;
    for (const v of views) {
      const out = lbl.generateLbl(v, cfg);
      if (out.error) {
        assert.equal(out.error, 'LBL_STUCK');
        stuck++;
      } else {
        assert.ok(cube.isSolved(cube.applyMoves(v, out.tokens)));
        ok++;
      }
    }
    tally[face] = { ok, stuck };
  }
  assert.ok(tally.F.stuck > 0, 'headlightFace F 應觸發 LBL_STUCK');
  assert.equal(tally.B.stuck, 0);
  t.diagnostic('頭燈面實驗（random-state 前 300 局）：' + JSON.stringify(tally));

  // (3) 把各 guard 調小到 1：有樣本會觸發 LBL_STUCK，且 detail 指出是哪個迴圈
  for (const key of lbl.GUARD_KEYS) {
    const cfg = withConfig((c) => { c.guards[key] = 1; });
    const need = sample('random').find((r) => r.out.loops[key] > 1);
    assert.ok(need, `找不到 ${key} 超過 1 次的樣本`);
    const out = lbl.generateLbl(need.view, cfg);
    assert.equal(out.error, 'LBL_STUCK', `${key}=1 應回 LBL_STUCK`);
    assert.equal(out.detail, key);
  }

  // (4) 不可解的貼紙（單角扭轉、單邊翻轉、兩邊互換）：回錯誤、不得無窮迴圈
  const bad = {
    twist: (c) => { c.co[0] = (c.co[0] + 1) % 3; },
    flip: (c) => { c.eo[0] ^= 1; },
    swapEdges: (c) => { const x = c.ep[0]; c.ep[0] = c.ep[1]; c.ep[1] = x; },
    swapCorners: (c) => { const x = c.cp[0]; c.cp[0] = c.cp[1]; c.cp[1] = x; }
  };
  const rng = makeRng(777);
  const badTally = {};
  for (const [name, mutate] of Object.entries(bad)) {
    badTally[name] = {};
    for (let i = 0; i < 200; i++) {
      const c = randomCubie(rng);
      mutate(c);
      const out = lbl.generateLbl(cubieToStickers(c), CONFIG);
      assert.ok(out.error === 'LBL_STUCK' || out.error === 'INVALID_STATE', `${name}#${i} 應回錯誤`);
      badTally[name][out.error + ':' + out.detail] = (badTally[name][out.error + ':' + out.detail] || 0) + 1;
    }
  }
  t.diagnostic('不可解狀態的錯誤分布（各 200 局）：' + JSON.stringify(badTally));

  // (5) 輸入格式錯誤 → INVALID_STATE；設定格式錯誤 → BAD_REQUEST
  const v0 = sample('random')[0].view;
  assert.equal(lbl.generateLbl(v0.slice(0, 53), CONFIG).error, 'INVALID_STATE');
  assert.equal(lbl.generateLbl(null, CONFIG).error, 'INVALID_STATE');
  assert.equal(lbl.generateLbl(v0.map((c, i) => (i === 0 ? 6 : c)), CONFIG).error, 'INVALID_STATE');
  const dupCenter = cube.SOLVED.slice();
  [dupCenter[4], dupCenter[9]] = [dupCenter[9], dupCenter[4]]; // U 中心與一格紅色互換：色數仍各 9，但 U、R 中心同色
  const dupOut = lbl.generateLbl(dupCenter, CONFIG);
  assert.equal(dupOut.error, 'INVALID_STATE');
  assert.equal(dupOut.detail, 'CENTER_DUPLICATE');
  const noEdge = cube.SOLVED.slice();
  [noEdge[7], noEdge[10]] = [noEdge[10], noEdge[7]]; // UF 的白格與 UR 的紅格互換 → 出現白白邊、找不到白紅邊
  const noEdgeOut = lbl.generateLbl(noEdge, CONFIG);
  assert.equal(noEdgeOut.error, 'INVALID_STATE');
  assert.equal(noEdgeOut.detail, 'EDGE_UNKNOWN');
  const flipUF = cube.SOLVED.slice();
  [flipUF[7], flipUF[19]] = [flipUF[19], flipUF[7]]; // UF 邊翻轉（色數合法、狀態不可解）
  assert.equal(lbl.generateLbl(flipUF, CONFIG).error, 'LBL_STUCK');
  assert.equal(lbl.generateLbl(v0, undefined).error, 'BAD_REQUEST');
  const badConfigs = [
    (c) => { delete c.formulas.sune; },
    (c) => { c.formulas.aPerm.alg = 'R Q'; },
    (c) => { c.formulas.uPerm.alg = ''; },
    (c) => { c.segments = c.segments.slice().reverse(); },
    (c) => { c.guards.middle = 0; },
    (c) => { delete c.guards.cross; },
    (c) => { c.headlightFace = 'U'; },
    (c) => { c.firstLayerColor = 6; }
  ];
  badConfigs.forEach((patch, i) => {
    assert.equal(lbl.generateLbl(v0, withConfig(patch)).error, 'BAD_REQUEST', `壞設定 #${i}`);
  });

  // (6) 首層改用其他顏色（firstLayerColor 3）也能完成
  const yellowFirst = withConfig((c) => { c.firstLayerColor = 3; });
  sample('random').slice(0, 200).forEach((r, i) => {
    const out = lbl.generateLbl(r.view, yellowFirst);
    assert.ok(!out.error, `firstLayerColor 3 #${i} ${out.error}`);
    assert.ok(cube.isSolved(cube.applyMoves(r.view, out.tokens)));
    assert.ok(lbl.STAGE_CHECKS.hold(cube.applyMoves(r.view, out.tokens.slice(0, out.segments[0].end)), yellowFirst));
  });
});

// ---------------------------------------------------------------------------
// T-LBL-10：步數分布（只輸出，不判定）
// ---------------------------------------------------------------------------

// game-spec.md §8.5（G3 原型，random-state 1,000 局 seed 20260915）
const SPEC_85 = {
  hold: [0, 0, 0], cross: [21.4, 28, 32], corners: [51.4, 73, 90], middle: [37.0, 47, 62],
  yellowCross: [11.0, 20, 20], yellowFace: [20.2, 28, 29], yellowCorners: [13.6, 26, 27],
  yellowEdges: [19.1, 36, 36], total: [173.6, 207, 232]
};

function diffPct(actual, expected) {
  if (expected === 0) return actual === 0 ? '0.0%' : '—';
  return ((actual - expected) / expected * 100).toFixed(1) + '%';
}

test('T-LBL-10：步數分布（總 QTM 與各段的平均、p95、最大）', (t) => {
  const labels = { random: 'random-state seed 20260915', seq: '40 記號序列 seed 31415',
    lastLayer: '末層全列舉', near: '近復原列舉' };
  for (const set of ALL_SETS) {
    const runs = sample(set).map((r) => r.out.result);
    const tot = runs.map((r) => r.qtm);
    const tok = runs.map((r) => r.tokens.length);
    const rot = runs.map((r) => r.tokens.filter((m) => cube.kind(m) === 'rotation').length);
    t.diagnostic(`[${labels[set]}] ${runs.length} 局：總 QTM 平均 ${mean(tot).toFixed(1)}、p50 ${pct(tot, 0.5)}、` +
      `p95 ${pct(tot, 0.95)}、最小 ${Math.min(...tot)}、最大 ${Math.max(...tot)}；` +
      `記號數（含整顆旋轉）最大 ${Math.max(...tok)}；整顆旋轉每局最多 ${Math.max(...rot)}、合計 ${rot.reduce((a, b) => a + b, 0)}`);
    SEGMENT_ORDER.forEach((id, k) => {
      const v = runs.map((r) => r.segments[k].qtm);
      let line = `  ${id.padEnd(14)} 平均 ${mean(v).toFixed(1).padStart(5)}  p95 ${String(pct(v, 0.95)).padStart(3)}  最大 ${String(Math.max(...v)).padStart(3)}`;
      if (set === 'random') {
        const s = SPEC_85[id];
        line += `  ｜§8.5 ${s[0]}/${s[1]}/${s[2]}  差 ${diffPct(mean(v), s[0])}/${diffPct(pct(v, 0.95), s[1])}/${diffPct(Math.max(...v), s[2])}`;
      }
      t.diagnostic(line);
    });
    if (set === 'random') {
      const s = SPEC_85.total;
      t.diagnostic(`  ${'total'.padEnd(14)} 平均 ${mean(tot).toFixed(1).padStart(5)}  p95 ${String(pct(tot, 0.95)).padStart(3)}  最大 ${String(Math.max(...tot)).padStart(3)}` +
        `  ｜§8.5 ${s[0]}/${s[1]}/${s[2]}  差 ${diffPct(mean(tot), s[0])}/${diffPct(pct(tot, 0.95), s[1])}/${diffPct(Math.max(...tot), s[2])}`);
    }
    // 相鄰同面外層轉動（非 T-LBL 要求；規則造成的可省步數，僅供參考）
    let sameFace = 0;
    runs.forEach((r) => {
      for (let i = 1; i < r.tokens.length; i++) {
        const a = r.tokens[i - 1];
        const b = r.tokens[i];
        if (cube.kind(a) === 'outer' && a.charAt(0) === b.charAt(0)) sameFace++;
      }
    });
    t.diagnostic(`  相鄰同面外層轉動（例 U2 U）合計 ${sameFace} 處`);
  }
  assert.ok(true);
});
