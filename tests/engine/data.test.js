// T-001 S1：資料檔測試（src/data/texts.json、palette.json、params.json、lbl.json）
// 對應 game-spec.md §12.6 T-DATA-01～T-DATA-06、T-DATA-08～T-DATA-10（T-DATA-10 為 S11 新增）。
// T-DATA-07 需要 engine 與 notation.js，由 S8a 在 tests/engine/notation.test.js 負責，本檔不寫。
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "..", "src", "data");

function readJson(name) {
  const raw = fs.readFileSync(path.join(DATA_DIR, name), "utf8");
  return JSON.parse(raw);
}

const texts = readJson("texts.json");
const palette = readJson("palette.json");
const params = readJson("params.json");
const lbl = readJson("lbl.json");

// ---------------------------------------------------------------------------
// T-DATA-01：palette.stickers 6 筆、id 0–5、hex 互不相同
// ---------------------------------------------------------------------------
test("T-DATA-01: palette.stickers 有 6 筆，id 為 0..5，hex 互不相同", () => {
  assert.equal(Array.isArray(palette.stickers), true);
  assert.equal(palette.stickers.length, 6);

  const ids = palette.stickers.map((s) => s.id).slice().sort((a, b) => a - b);
  assert.deepEqual(ids, [0, 1, 2, 3, 4, 5]);

  const hexSet = new Set(palette.stickers.map((s) => s.hex));
  assert.equal(hexSet.size, 6, "hex 值必須互不相同");
});

// ---------------------------------------------------------------------------
// T-DATA-02：lbl.json 每個 alg 都能被解析且只含外層記號；segments 與 §8.3 一致
// ---------------------------------------------------------------------------
test("T-DATA-02: lbl.formulas 的 alg 只含外層記號；segments 與 §8.3 一致", () => {
  const OUTER_MOVE_RE = /^[UDLRFB]['2]?$/;

  assert.equal(typeof lbl.formulas, "object");
  const formulaKeys = Object.keys(lbl.formulas);
  assert.ok(formulaKeys.length > 0, "formulas 不可為空");

  for (const key of formulaKeys) {
    const alg = lbl.formulas[key].alg;
    assert.equal(typeof alg, "string", `${key}.alg 必須是字串`);
    const tokens = alg.trim().split(/\s+/).filter(Boolean);
    assert.ok(tokens.length > 0, `${key}.alg 不可為空字串`);
    for (const token of tokens) {
      assert.match(
        token,
        OUTER_MOVE_RE,
        `${key}.alg 的記號「${token}」必須是外層記號（U D L R F B 及其 ′／2 變化）`
      );
    }
  }

  // §8.3 分段順序：hold, cross, corners, middle, yellowCross, yellowFace, yellowCorners, yellowEdges
  const EXPECTED_SEGMENTS = [
    "hold",
    "cross",
    "corners",
    "middle",
    "yellowCross",
    "yellowFace",
    "yellowCorners",
    "yellowEdges",
  ];
  assert.deepEqual(lbl.segments, EXPECTED_SEGMENTS);
});

// ---------------------------------------------------------------------------
// T-DATA-03：texts.lbl 有 8 段且鍵與 lbl.segments 一致；tutorial 3–5 筆（目前 5 筆）
// ---------------------------------------------------------------------------
test("T-DATA-03: texts.lbl 8 段鍵與 lbl.segments 一致；texts.tutorial 3~5 筆", () => {
  assert.equal(typeof texts.lbl, "object");
  const lblTextKeys = Object.keys(texts.lbl);
  assert.equal(lblTextKeys.length, 8);
  assert.deepEqual(lblTextKeys.slice().sort(), lbl.segments.slice().sort());

  for (const key of lbl.segments) {
    assert.ok(texts.lbl[key], `texts.lbl.${key} 不可缺漏`);
    assert.equal(typeof texts.lbl[key].name, "string");
    assert.ok(texts.lbl[key].name.length > 0);
    assert.equal(typeof texts.lbl[key].desc, "string");
    assert.ok(texts.lbl[key].desc.length > 0);
  }

  assert.equal(Array.isArray(texts.tutorial), true);
  assert.ok(
    texts.tutorial.length >= 3 && texts.tutorial.length <= 5,
    `texts.tutorial 應有 3~5 筆，實際 ${texts.tutorial.length} 筆`
  );
  assert.equal(texts.tutorial.length, 5, "目前規格版本應為 5 筆");
});

// ---------------------------------------------------------------------------
// T-DATA-04：params 各數值欄位存在且為正數（baseViewDeg 可為負）；布林欄位為 boolean；
//            demo.defaultSpeed 存在於 speeds；tutorial.notationBeforeIndex 介於 0 與
//            texts.tutorial.length 之間
// ---------------------------------------------------------------------------
test("T-DATA-04: params 數值、布林欄位型別與範圍正確", () => {
  function assertPositive(value, label) {
    assert.equal(typeof value, "number", `${label} 應為數字`);
    assert.ok(value > 0, `${label} 應為正數，實際 ${value}`);
  }
  function assertBoolean(value, label) {
    assert.equal(typeof value, "boolean", `${label} 應為 boolean`);
  }

  // scramble
  assertPositive(params.scramble.length, "params.scramble.length");

  // solver（metric 為字串，不檢查正數；其餘皆為正數）
  assert.equal(params.solver.metric, "qtm");
  assertPositive(params.solver.nodeLimit, "params.solver.nodeLimit");
  assertPositive(params.solver.firstNodeLimit, "params.solver.firstNodeLimit");
  assertPositive(params.solver.maxLength, "params.solver.maxLength");
  assertPositive(params.solver.phase2Cap, "params.solver.phase2Cap");
  assertPositive(params.solver.initTimeoutMs, "params.solver.initTimeoutMs");
  assertPositive(params.solver.solveTimeoutMs, "params.solver.solveTimeoutMs");
  assertPositive(params.solver.planCacheSize, "params.solver.planCacheSize");

  // demo
  assert.equal(Array.isArray(params.demo.speeds), true);
  assert.ok(params.demo.speeds.length > 0);
  for (const speed of params.demo.speeds) {
    assert.equal(typeof speed.id, "string");
    assertPositive(speed.stepMs, `params.demo.speeds[${speed.id}].stepMs`);
  }
  const speedIds = params.demo.speeds.map((s) => s.id);
  assert.ok(
    speedIds.includes(params.demo.defaultSpeed),
    "params.demo.defaultSpeed 必須存在於 params.demo.speeds 中"
  );
  assertPositive(params.demo.animRatio, "params.demo.animRatio");
  assertBoolean(params.demo.pauseAtSegmentEnd, "params.demo.pauseAtSegmentEnd");

  // gesture
  assertPositive(params.gesture.lockPx, "params.gesture.lockPx");
  assertPositive(params.gesture.commitPx, "params.gesture.commitPx");
  assertPositive(params.gesture.maxAxisAngleDeg, "params.gesture.maxAxisAngleDeg");
  assertPositive(params.gesture.cameraDegPerPx, "params.gesture.cameraDegPerPx");
  assertPositive(params.gesture.pitchLimitDeg, "params.gesture.pitchLimitDeg");

  // ui（baseViewDeg 可為負，其餘為正）
  assertPositive(params.ui.turnAnimMs, "params.ui.turnAnimMs");
  assertPositive(params.ui.scrambleAnimMsPerMove, "params.ui.scrambleAnimMsPerMove");
  assertPositive(params.ui.timerRefreshMs, "params.ui.timerRefreshMs");
  assertPositive(params.ui.minTouchPx, "params.ui.minTouchPx");
  assertPositive(params.ui.snapAnimMs, "params.ui.snapAnimMs");
  assert.equal(typeof params.ui.baseViewDeg.x, "number");
  assert.equal(typeof params.ui.baseViewDeg.y, "number");

  // layout
  assertBoolean(params.layout.drawerExpandedDefault, "params.layout.drawerExpandedDefault");

  // keypad
  assertBoolean(params.keypad.sliceCollapsedDefault, "params.keypad.sliceCollapsedDefault");
  assertBoolean(params.keypad.rotationCollapsedDefault, "params.keypad.rotationCollapsedDefault");
  assertBoolean(params.keypad.showSubLabels, "params.keypad.showSubLabels");

  // faceLabels
  assertBoolean(params.faceLabels.defaultOn, "params.faceLabels.defaultOn");
  assertBoolean(params.faceLabels.forceOnInTutorial, "params.faceLabels.forceOnInTutorial");

  // tutorial
  assertBoolean(params.tutorial.enabled, "params.tutorial.enabled");
  assert.equal(typeof params.tutorial.notationBeforeIndex, "number");
  assert.ok(
    params.tutorial.notationBeforeIndex >= 0 &&
      params.tutorial.notationBeforeIndex <= texts.tutorial.length,
    "params.tutorial.notationBeforeIndex 必須介於 0 與 texts.tutorial.length 之間"
  );
  assertPositive(params.tutorial.demoTurnMs, "params.tutorial.demoTurnMs");
  assertPositive(params.tutorial.demoHoldMs, "params.tutorial.demoHoldMs");

  // S11（D-25、D-26、n-4）新增欄位
  assertPositive(params.ui.hintErrorShowMs, "params.ui.hintErrorShowMs");
  assertPositive(params.ui.demoErrorShowMs, "params.ui.demoErrorShowMs");
  assertPositive(params.input.queueMax, "params.input.queueMax");
  assert.ok(Number.isInteger(params.input.queueMax), "params.input.queueMax 應為整數");
  assertPositive(params.input.queuePollMs, "params.input.queuePollMs");
  assert.ok(Number.isInteger(params.debug.rejectLogSize) && params.debug.rejectLogSize >= 0,
    "params.debug.rejectLogSize 應為 0 以上的整數（0＝不記錄）");
  assertBoolean(params.debug.logRejectToConsole, "params.debug.logRejectToConsole");
});

// ---------------------------------------------------------------------------
// T-DATA-10（S11／MJ-1、D-25）：params 的每一個欄位都有程式在讀；S11 新增的文案鍵存在
// ---------------------------------------------------------------------------
test("T-DATA-10: params 每個欄位都被 src/ 程式讀取；S11 新增文案鍵存在且格式正確", () => {
  const SRC_DIR = path.join(__dirname, "..", "..", "src");
  const code = ["engine", "solver", "ui"].map((dir) => {
    const full = path.join(SRC_DIR, dir);
    return fs.readdirSync(full)
      .filter((f) => f.endsWith(".js"))
      .map((f) => fs.readFileSync(path.join(full, f), "utf8"))
      .join("\n");
  }).join("\n");

  // 已知例外（附理由）：minTouchPx 是 CLAUDE.md §3 第 4 條的規範值，CSS 直接寫 44px，
  // 由 T-UI-03 實測可點元素尺寸（架構審查 n-2，D-27 列 v0.2）。
  const ALLOW_UNREAD = new Set(["ui.minTouchPx"]);

  const unread = [];
  function walk(obj, prefix) {
    for (const key of Object.keys(obj)) {
      const full = prefix ? prefix + "." + key : key;
      const v = obj[key];
      const isLeaf = v === null || typeof v !== "object" || Array.isArray(v);
      if (!isLeaf) walk(v, full);
      // 葉節點與物件本身都要被讀到：以「.鍵名」或「'鍵名'」出現在程式中為準
      const read = code.includes("." + key) || code.includes("'" + key + "'") || code.includes('"' + key + '"');
      if (!read && !ALLOW_UNREAD.has(full)) unread.push(full);
    }
  }
  walk(params, "");
  assert.deepEqual(unread, [], "以下 params 欄位沒有任何程式讀取：" + unread.join("、"));

  // S11 新增文案鍵
  assert.equal(typeof texts.buttons.viewCube, "string");
  assert.ok(texts.buttons.viewCube.length > 0);
  assert.equal(typeof texts.confirm.newGameInProgress, "string");
  assert.ok(texts.confirm.newGameInProgress.length > 0);
  for (const ph of ["{label}", "{time}", "{qtm}"]) {
    assert.ok(texts.result.best.includes(ph), "texts.result.best 必須含 " + ph);
  }
  assert.equal(typeof texts.hud.best, "string", "最佳紀錄的標籤沿用既有鍵 texts.hud.best");
});

// ---------------------------------------------------------------------------
// T-DATA-05：全部 src/、docs/spec/ 無常見簡體字（字表放測試檔）
// ---------------------------------------------------------------------------
// 依分派單 §3 S1 段要求，字表以跳脫寫法存放，避免測試檔（連同註解）本身出現簡體字。
// 這裡不直接寫簡體字元，而是存 Unicode 碼位（十六進位），執行時才用
// String.fromCodePoint 還原成字元；每一行註解只寫對應的繁體字，方便對照。
// 至少 40 個常見簡體字，對應繁體依序為：
// 這個們說設計時數據級轉動層邊塊復順鐘視圖顯鍵錄紀頁確認與從應該學習現實讓還關開結
const SIMPLIFIED_CODE_POINTS = [
  0x8fd9, // 這
  0x4e2a, // 個
  0x4eec, // 們
  0x8bf4, // 說
  0x8bbe, // 設
  0x8ba1, // 計
  0x65f6, // 時
  0x6570, // 數
  0x636e, // 據
  0x7ea7, // 級
  0x8f6c, // 轉
  0x52a8, // 動
  0x5c42, // 層
  0x8fb9, // 邊
  0x5757, // 塊
  0x590d, // 復
  0x987a, // 順
  0x949f, // 鐘
  0x89c6, // 視
  0x56fe, // 圖
  0x663e, // 顯
  0x952e, // 鍵
  0x5f55, // 錄
  0x7eaa, // 紀
  0x9875, // 頁
  0x786e, // 確
  0x8ba4, // 認
  0x4e0e, // 與
  0x4ece, // 從
  0x5e94, // 應
  0x8be5, // 該
  0x5b66, // 學
  0x4e60, // 習
  0x73b0, // 現
  0x5b9e, // 實
  0x8ba9, // 讓
  0x8fd8, // 還
  0x5173, // 關
  0x5f00, // 開
  0x7ed3, // 結
];
const SIMPLIFIED_CHARS = SIMPLIFIED_CODE_POINTS.map((cp) => String.fromCodePoint(cp));

// 排除的路徑（相對於 repo 根目錄）：這些目錄本身是「簡體字掃描工具」，其原始碼
// 必須內含完整簡體字字集才能運作，掃到不代表文件內容有簡體字問題。
// docs/spec/checks/ 是 scratch/g3-check/（G3 驗證原型，依 CLAUDE.md／.gitignore 不進版控）
// 的重複副本，兩者內容幾乎一致；本段發現後列入回報「未預期發現」，不在 S1 範圍內修改
// docs/（依共通規則不可碰 docs/），僅在掃描時排除，避免這份非規格文字的工具檔誤判。
const EXCLUDED_RELATIVE_DIRS = [path.join("docs", "spec", "checks")];

function walkFiles(rootDir, repoRoot) {
  const result = [];
  if (!fs.existsSync(rootDir)) return result;
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const relative = path.relative(repoRoot, current);
    if (EXCLUDED_RELATIVE_DIRS.some((dir) => relative === dir || relative.startsWith(dir + path.sep))) {
      continue;
    }
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else if (stat.isFile()) {
      result.push(current);
    }
  }
  return result;
}

test("T-DATA-05: src/ 與 docs/spec/ 全部檔案無常見簡體字", () => {
  assert.equal(SIMPLIFIED_CHARS.length >= 40, true, "簡體字表至少要有 40 個字");

  const repoRoot = path.join(__dirname, "..", "..");
  const targets = [
    path.join(repoRoot, "src"),
    path.join(repoRoot, "docs", "spec"),
  ];

  const offenders = [];
  for (const dir of targets) {
    for (const filePath of walkFiles(dir, repoRoot)) {
      let content;
      try {
        content = fs.readFileSync(filePath, "utf8");
      } catch (err) {
        continue; // 非文字檔（理論上不會出現在 src/、docs/spec/）
      }
      for (const ch of SIMPLIFIED_CHARS) {
        if (content.includes(ch)) {
          offenders.push(`${path.relative(repoRoot, filePath)} 含簡體字 U+${ch.codePointAt(0).toString(16).toUpperCase()}`);
        }
      }
    }
  }

  assert.deepEqual(offenders, [], `發現簡體字：\n${offenders.join("\n")}`);
});

// ---------------------------------------------------------------------------
// T-DATA-06：記號文案結構
// ---------------------------------------------------------------------------
test("T-DATA-06: 記號文案結構（faceName／rotationSub／keySub／lesson／notationSteps／buttons）", () => {
  // faceName 恰有 U D L R F B M E S 9 鍵
  const EXPECTED_FACE_NAMES = ["U", "D", "L", "R", "F", "B", "M", "E", "S"];
  const faceNameKeys = Object.keys(texts.notation.faceName);
  assert.equal(faceNameKeys.length, 9);
  assert.deepEqual(faceNameKeys.slice().sort(), EXPECTED_FACE_NAMES.slice().sort());

  // rotationSub 恰有 9 個整顆轉記號
  const rotationSubKeys = Object.keys(texts.notation.rotationSub);
  assert.equal(rotationSubKeys.length, 9);

  // keySub 有 cw／ccw／half 且都含 {face}
  const keySub = texts.notation.keySub;
  for (const kind of ["cw", "ccw", "half"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(keySub, kind), `keySub 缺 ${kind}`);
    assert.ok(keySub[kind].includes("{face}"), `keySub.${kind} 必須含 {face}`);
  }

  // notationSteps 的 id 順序
  const notationSteps = params.tutorial.notationSteps;
  assert.equal(Array.isArray(notationSteps), true);
  assert.equal(notationSteps.length, 7);

  // lesson 7 筆，id 依序等於 params.tutorial.notationSteps[].id，每筆 title、body 非空
  const lesson = texts.notation.lesson;
  assert.equal(Array.isArray(lesson), true);
  assert.equal(lesson.length, 7);
  const lessonIds = lesson.map((entry) => entry.id);
  const stepIds = notationSteps.map((step) => step.id);
  assert.deepEqual(lessonIds, stepIds);
  for (const entry of lesson) {
    assert.equal(typeof entry.title, "string");
    assert.ok(entry.title.length > 0, `lesson[${entry.id}].title 不可為空`);
    assert.equal(typeof entry.body, "string");
    assert.ok(entry.body.length > 0, `lesson[${entry.id}].body 不可為空`);
  }

  // 每個 notationSteps[].demo 恰為 1 個合法記號
  const MOVE_RE = /^[UDLRFBMESxyz]['2]?$/;
  for (const step of notationSteps) {
    assert.equal(typeof step.demo, "string");
    assert.match(step.demo, MOVE_RE, `notationSteps 的 demo「${step.demo}」必須是合法記號`);
  }

  // buttons 含指定鍵
  const requiredButtons = [
    "notationHelp",
    "faceLabels",
    "sliceFold",
    "continue",
    "lessonSkip",
    "lessonReplay",
  ];
  for (const key of requiredButtons) {
    assert.ok(Object.prototype.hasOwnProperty.call(texts.buttons, key), `buttons 缺 ${key}`);
  }
  assert.equal(texts.buttons.demoSuggest, "建議解示範");

  // palette.stickers 每筆有 labelInk
  for (const sticker of palette.stickers) {
    assert.equal(typeof sticker.labelInk, "string");
    assert.ok(sticker.labelInk.length > 0, `sticker id=${sticker.id} 缺 labelInk`);
  }
});

// ---------------------------------------------------------------------------
// T-DATA-08：層先法公式說明
// ---------------------------------------------------------------------------
test("T-DATA-08: lbl.json 11 個公式皆有 name／desc；texts.demo 模板含指定佔位符", () => {
  const formulaKeys = Object.keys(lbl.formulas);
  assert.equal(formulaKeys.length, 11);
  for (const key of formulaKeys) {
    const formula = lbl.formulas[key];
    assert.equal(typeof formula.name, "string");
    assert.ok(formula.name.length > 0, `formulas.${key}.name 不可為空`);
    assert.equal(typeof formula.desc, "string");
    assert.ok(formula.desc.length > 0, `formulas.${key}.desc 不可為空`);
  }

  assert.equal(typeof texts.demo.segmentDone, "string");
  assert.ok(texts.demo.segmentDone.includes("{done}"));
  assert.ok(texts.demo.segmentDone.includes("{next}"));

  assert.equal(typeof texts.demo.formulaUse, "string");
  assert.ok(texts.demo.formulaUse.includes("{desc}"));
});

// ---------------------------------------------------------------------------
// T-DATA-09：禁用字
// ---------------------------------------------------------------------------
test("T-DATA-09: texts.json 與 lbl.json 全部字串值都不含禁用字", () => {
  // 禁用字清單（game-spec.md §10.1）：必須含 Rubik、最佳解、最少步、最短。
  const FORBIDDEN_WORDS = ["Rubik", "最佳解", "最少步", "最短"];

  function collectStrings(value, acc) {
    if (typeof value === "string") {
      acc.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) collectStrings(item, acc);
    } else if (value && typeof value === "object") {
      for (const key of Object.keys(value)) collectStrings(value[key], acc);
    }
    return acc;
  }

  const offenders = [];
  for (const [label, doc] of [["texts.json", texts], ["lbl.json", lbl]]) {
    const strings = collectStrings(doc, []);
    for (const str of strings) {
      for (const word of FORBIDDEN_WORDS) {
        if (str.includes(word)) {
          offenders.push(`${label} 字串「${str}」含禁用字「${word}」`);
        }
      }
    }
  }

  assert.deepEqual(offenders, [], `發現禁用字：\n${offenders.join("\n")}`);
});
