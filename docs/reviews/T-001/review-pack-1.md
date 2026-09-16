# 審查包：T-001 魔術方塊 v0.1（第 1／4 批：engine（狀態機、方塊模型、打亂）與資料檔）

> 本檔可單獨貼給外部 AI。四批合計為本次變更的全部程式碼。

## 0. 審查提示詞（貼給外部 AI 時從這裡開始）

請你擔任獨立程式審查員，審查下面這份單頁網頁遊戲的程式碼變更。你和寫程式的人不是同一個人，也看不到他們的脈絡；看不懂的地方就是問題。

請遵守以下規則：

1. **每個問題都要附四項**：嚴重度（Blocker／Major／Minor）、位置（檔案:行號，依附上的行號）、失敗情境（什麼輸入或操作會出什麼錯）、建議修法（方向或小片段即可）。
2. **嚴重度定義**：Blocker＝無法進行遊戲、state 損毀、同 seed 結果不一致、違反下方任一條架構原則；Major＝功能可用但規則或判定明顯錯誤；Minor＝可維護性、命名、文案。
3. **不確定是不是問題的，另列「疑似」清單**，不要混進 bug 清單。沒有重現步驟的發現只能列「疑似」。
4. **不要重寫整份程式，只給意見。** 不要輸出完整檔案的替換版本；修法建議以文字描述或十行以內的片段為限。
5. 請逐條對照第 1 節的架構原則檢查，違反的要指出是哪一條。
6. 已知問題（第 5 節）是我們已經知道、刻意暫不處理的，不必重複回報；若你認為它比我們描述的更嚴重，可以另外說明。
7. 請用第 6 節的表格格式回覆，繁體中文。

**本批是第 1／4 批，其他批次的檔案不在這裡，若問題牽涉其他批次，請在「疑似」清單註明。**

---

## 1. 專案背景（從 CLAUDE.md 第 1、3 節摘要）

- 類型：經典三階魔術方塊（3x3x3）單頁網頁遊戲；定位是讓手邊沒有實體方塊的人可以玩，也可以看電腦怎麼解（學習用）
- 玩法：單人自由練習（打亂、轉動、撤銷／重做、重設、計時、步數）＋提示下一步＋看電腦解（建議解示範、層先法分段示範）；無連線、無帳號、無金流
- 計步：QTM（外層 90°＝1 步、180°＝2 步；中層 M/E/S 90°＝2 步、180°＝4 步；整顆旋轉與拖曳視角＝0 步）
- 3D：CSS 3D transforms；求解器自寫，於 Web Worker 執行（Worker 程式以 Blob 由同一檔案產生）；畫面稱「建議解」，不得稱「最佳解」
- 交付：單一 `index.html`（由 `build/` 打包 `src/`），零依賴、可離線；平台：iPad 橫向、手機直向，觸控優先；語言：繁體中文

架構原則（違反即 Blocker）：
1. 狀態只能透過 action 前進；engine 層是純函數，不讀時間、DOM、網路、計時器、全域變數。（本案另規定 `src/solver/` 同樣不得讀時鐘，以搜尋節點上限控制搜尋長度）
2. 所有隨機數來自 seeded RNG；不得使用 `Math.random()`；同 seed ＋ 同 action 序列必須可重放。
3. 參數資料驅動；數值、機率、內容放 `src/data/` JSON，程式碼裡寫死的平衡數字就是 bug。
4. 觸控優先；可點元素最小 44×44 px；不依賴 hover、右鍵、鍵盤。
5. 零依賴；不載入 CDN、不外連字型、不用第三方套件。

## 2. 本次任務摘要

- 目標：使用者在 iPad／手機上打開單一 `index.html`，可以打亂、用手勢或記號鍵轉方塊、撤銷／重做／重設、看計時與 QTM 步數；卡住時看下一步提示，或看電腦用建議解與層先法逐步示範；全程斷網可用。
- 驗收條件：自動測試全部通過（見第 4 節）；以下項目由人工在實機驗收（尚未進行）：iPad／手機實機顯示與建表時間、手勢手感、零基礎者能否跟著教學學會層先法。
- 本批檔案在整體中的角色：src/engine/ 是純函數 reducer：方塊以 54 格貼紙＋24 種整顆朝向表示，所有規則（轉動、QTM 計步、撤銷、計時狀態、提示與示範狀態）都在這裡；src/data/ 是文案、配色、參數與層先法公式。
- 四批的檔案分配：第 1 批 `src/engine/rng.js`、`src/engine/cube.js`、`src/engine/scramble.js`、`src/engine/selectors.js`、`src/engine/reducer.js`、`src/engine/index.js`、`src/data/texts.json`、`src/data/palette.json`、`src/data/params.json`、`src/data/lbl.json`；第 2 批 `src/solver/twophase.js`、`src/solver/lbl.js`、`src/solver/worker.js`；第 3 批 `src/ui/app.js`、`src/ui/controls.js`、`src/ui/gesture.js`、`src/ui/cube-view.js`、`src/ui/notation.js`、`src/ui/solver-client.js`、`src/ui/index.template.html`、`src/ui/styles.css`；第 4 批 `src/ui/demo-player.js`、`src/ui/hint-view.js`、`src/ui/tutorial.js`、`src/ui/records.js`、`src/ui/demo.css`、`src/ui/overlay.css`、`build/bundle.js`。

## 3. 變更檔案的完整程式碼（有行號，全部為新增檔案）

本批包含：`src/engine/rng.js`、`src/engine/cube.js`、`src/engine/scramble.js`、`src/engine/selectors.js`、`src/engine/reducer.js`、`src/engine/index.js`、`src/data/texts.json`、`src/data/palette.json`、`src/data/params.json`、`src/data/lbl.json`。

### 3.1 `src/engine/rng.js`（新增，25 行）

```js
 1  // src/engine/rng.js — seeded RNG（xorshift32）
 2  //
 3  // 依據：game-spec.md §5「打亂規則」。演算法與 docs/spike/code/solver.js 的 makeRng 相同，
 4  // 純函數、無外部狀態；同 seed 必得同亂數序列。engine／solver 一律透過本檔取得亂數，
 5  // 不得使用瀏覽器內建的非決定性亂數函式（CLAUDE.md §3 第 2 條）。
 6  'use strict';
 7  
 8  /**
 9   * 建立一個 xorshift32 亂數產生器。
10   * @param {number} seed - 32 位元無號整數（0–4294967295）；0 時改用固定種子 0x9e3779b9。
11   * @returns {() => number} 每次呼叫回傳一個 [0, 1) 之間的浮點數。
12   */
13  function makeRng(seed) {
14    var state = (seed >>> 0) || 0x9e3779b9;
15    return function () {
16      state ^= state << 13;
17      state >>>= 0;
18      state ^= state >>> 17;
19      state ^= state << 5;
20      state >>>= 0;
21      return state / 4294967296;
22    };
23  }
24  
25  module.exports = { makeRng: makeRng };
```

### 3.2 `src/engine/cube.js`（新增，467 行）

```js
  1  // src/engine/cube.js — 方塊模型：貼紙表示法、36 個記號、24 種朝向
  2  //
  3  // 依據：game-spec.md §1（名詞與記號）、§2.1（QTM 計步）、§2.4（白話說明）、
  4  // §3.1–§3.3（狀態模型）、§9.2 第 3 點（手勢對應）。
  5  //
  6  // 設計原則（CLAUDE.md §3）：
  7  //   - 純函數，不讀取時間、DOM、亂數或全域狀態；所有轉動的貼紙置換皆由 3D 幾何推導，
  8  //     不手抄轉動表。
  9  //   - 54 格貼紙以面序 U R F D L B（0–5）展開，每面 9 格由左上到右下逐列編號
 10  //     （索引 = 9 × 面序 + (列 × 3 + 欄)）。
 11  //   - 座標軸：x 向右（R 方向）、y 向上（U 方向）、z 向前（F 方向）。
 12  'use strict';
 13  
 14  // ---------------------------------------------------------------------------
 15  // 1. 向量工具（僅供本檔內部使用）
 16  // ---------------------------------------------------------------------------
 17  
 18  function dot(a, b) {
 19    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
 20  }
 21  
 22  function cross(a, b) {
 23    return [
 24      a[1] * b[2] - a[2] * b[1],
 25      a[2] * b[0] - a[0] * b[2],
 26      a[0] * b[1] - a[1] * b[0]
 27    ];
 28  }
 29  
 30  function vecEq(a, b) {
 31    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
 32  }
 33  
 34  function negate(a) {
 35    return [-a[0], -a[1], -a[2]];
 36  }
 37  
 38  // 繞單位軸 axis 把向量 v 旋轉 −90°（從軸尖端往回看為順時針），
 39  // 用來從「轉動前」推導「轉動後」的貼紙位置與法向量。
 40  function rotateCw(v, axis) {
 41    var c = cross(axis, v);
 42    var d = dot(axis, v);
 43    return [
 44      -c[0] + axis[0] * d,
 45      -c[1] + axis[1] * d,
 46      -c[2] + axis[2] * d
 47    ];
 48  }
 49  
 50  // ---------------------------------------------------------------------------
 51  // 2. 六個面的法向量與展開圖幾何（game-spec.md §1.1）
 52  // ---------------------------------------------------------------------------
 53  
 54  var FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'];
 55  
 56  var NORMAL = {
 57    U: [0, 1, 0],
 58    R: [1, 0, 0],
 59    F: [0, 0, 1],
 60    D: [0, -1, 0],
 61    L: [-1, 0, 0],
 62    B: [0, 0, -1]
 63  };
 64  
 65  // 每面展開圖的左上角座標、向右方向、向下方向（§1.1 表格）。
 66  var FACE_GEOM = {
 67    U: { topLeft: [-1, 1, -1], right: [1, 0, 0], down: [0, 0, 1] },
 68    R: { topLeft: [1, 1, 1], right: [0, 0, -1], down: [0, -1, 0] },
 69    F: { topLeft: [-1, 1, 1], right: [1, 0, 0], down: [0, -1, 0] },
 70    D: { topLeft: [-1, -1, 1], right: [1, 0, 0], down: [0, 0, -1] },
 71    L: { topLeft: [-1, 1, -1], right: [0, 0, 1], down: [0, -1, 0] },
 72    B: { topLeft: [1, 1, -1], right: [-1, 0, 0], down: [0, -1, 0] }
 73  };
 74  
 75  // 供 UI（手勢判定）使用：每面的「右」「下」方向向量。
 76  var FACE_AXES = {};
 77  FACE_LIST.forEach(function (face) {
 78    FACE_AXES[face] = { right: FACE_GEOM[face].right, down: FACE_GEOM[face].down };
 79  });
 80  
 81  // ---------------------------------------------------------------------------
 82  // 3. 54 格貼紙的位置與法向量
 83  // ---------------------------------------------------------------------------
 84  
 85  var STICKER_POS = [];
 86  var STICKER_NRM = [];
 87  FACE_LIST.forEach(function (face) {
 88    var g = FACE_GEOM[face];
 89    for (var row = 0; row < 3; row++) {
 90      for (var col = 0; col < 3; col++) {
 91        STICKER_POS.push([
 92          g.topLeft[0] + col * g.right[0] + row * g.down[0],
 93          g.topLeft[1] + col * g.right[1] + row * g.down[1],
 94          g.topLeft[2] + col * g.right[2] + row * g.down[2]
 95        ]);
 96        STICKER_NRM.push(NORMAL[face].slice());
 97      }
 98    }
 99  });
100  
101  function stickerIndexAt(pos, nrm) {
102    for (var i = 0; i < 54; i++) {
103      if (vecEq(STICKER_POS[i], pos) && vecEq(STICKER_NRM[i], nrm)) return i;
104    }
105    throw new Error('cube: 找不到對應貼紙位置');
106  }
107  
108  // ---------------------------------------------------------------------------
109  // 4. 36 個記號與其貼紙置換
110  // ---------------------------------------------------------------------------
111  
112  // 記號順序：外層 U R F D L B，接著中層 M E S，接著整顆 x y z；各 × 同一組後綴。
113  var BASE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z'];
114  var SUFFIXES = ['', '2', "'"];
115  
116  var MOVES = [];
117  BASE_ORDER.forEach(function (base) {
118    SUFFIXES.forEach(function (suffix) {
119      MOVES.push(base + suffix);
120    });
121  });
122  
123  // 合法記號集合（S11／m-1：kind、inverse、reducer 前置條件一律以此嚴格檢查，
124  // 不再只看第一個字元，避免 'R3'、'xx' 之類格式錯誤的字串被當成合法記號）。
125  var MOVE_SET = new Set(MOVES);
126  
127  function isMove(move) {
128    return typeof move === 'string' && MOVE_SET.has(move);
129  }
130  
131  // 每個基本記號的旋轉軸與會轉動的「層」（layers 為 dot(位置, 軸) 的值集合）：
132  //   外層：只轉 dot=1 的那一層；中層：只轉 dot=0 的那一層；整顆：三層都轉。
133  // 中層方向慣例（§1.2）：M 同 L、E 同 D、S 同 F；整顆慣例：x 同 R、y 同 U、z 同 F。
134  var BASE_DEF = {
135    U: { axis: NORMAL.U, layers: [1] },
136    R: { axis: NORMAL.R, layers: [1] },
137    F: { axis: NORMAL.F, layers: [1] },
138    D: { axis: NORMAL.D, layers: [1] },
139    L: { axis: NORMAL.L, layers: [1] },
140    B: { axis: NORMAL.B, layers: [1] },
141    M: { axis: NORMAL.L, layers: [0] },
142    E: { axis: NORMAL.D, layers: [0] },
143    S: { axis: NORMAL.F, layers: [0] },
144    x: { axis: NORMAL.R, layers: [-1, 0, 1] },
145    y: { axis: NORMAL.U, layers: [-1, 0, 1] },
146    z: { axis: NORMAL.F, layers: [-1, 0, 1] }
147  };
148  
149  // perm[i] ＝ 貼紙 i 轉動後會移動到的位置索引（applyPerm 用此定義套用）。
150  function buildQuarterPerm(def) {
151    var perm = new Array(54);
152    for (var i = 0; i < 54; i++) {
153      if (def.layers.indexOf(dot(STICKER_POS[i], def.axis)) !== -1) {
154        var newPos = rotateCw(STICKER_POS[i], def.axis);
155        var newNrm = rotateCw(STICKER_NRM[i], def.axis);
156        perm[i] = stickerIndexAt(newPos, newNrm);
157      } else {
158        perm[i] = i;
159      }
160    }
161    return perm;
162  }
163  
164  // 合成兩個置換：先套用 p、再套用 q（等於依序做兩個轉動）。
165  function composePerm(p, q) {
166    var out = new Array(p.length);
167    for (var i = 0; i < p.length; i++) out[i] = q[p[i]];
168    return out;
169  }
170  
171  function invertPerm(p) {
172    var inv = new Array(p.length);
173    for (var i = 0; i < p.length; i++) inv[p[i]] = i;
174    return inv;
175  }
176  
177  var MOVE_PERM = {};
178  BASE_ORDER.forEach(function (base) {
179    var quarter = buildQuarterPerm(BASE_DEF[base]);
180    var half = composePerm(quarter, quarter);
181    var reverse = composePerm(half, quarter);
182    MOVE_PERM[base] = quarter;
183    MOVE_PERM[base + '2'] = half;
184    MOVE_PERM[base + "'"] = reverse;
185  });
186  
187  // 置換 → 記號名稱的反查表（toHome／toView 用）。
188  var MOVE_BY_PERM = new Map();
189  MOVES.forEach(function (move) {
190    MOVE_BY_PERM.set(MOVE_PERM[move].join(','), move);
191  });
192  
193  // ---------------------------------------------------------------------------
194  // 5. 復原狀態與套用置換
195  // ---------------------------------------------------------------------------
196  
197  var SOLVED = [];
198  for (var si = 0; si < 54; si++) SOLVED.push(Math.floor(si / 9));
199  
200  function applyPerm(stickers, perm) {
201    var out = new Array(54);
202    for (var i = 0; i < 54; i++) out[perm[i]] = stickers[i];
203    return out;
204  }
205  
206  function applyMove(stickers, move) {
207    if (!isMove(move)) throw new Error('applyMove: 未知記號 ' + move);
208    var perm = MOVE_PERM[move];
209    return applyPerm(stickers, perm);
210  }
211  
212  function applyMoves(stickers, moves) {
213    return moves.reduce(function (acc, move) {
214      return applyMove(acc, move);
215    }, stickers);
216  }
217  
218  function isSolved(stickers) {
219    for (var f = 0; f < 6; f++) {
220      var center = stickers[9 * f + 4];
221      for (var k = 0; k < 9; k++) {
222        if (stickers[9 * f + k] !== center) return false;
223      }
224    }
225    return true;
226  }
227  
228  // ---------------------------------------------------------------------------
229  // 6. 記號種類、方向與 QTM 步數（§2.1、§2.4）
230  // ---------------------------------------------------------------------------
231  
232  var OUTER_BASES = ['U', 'R', 'F', 'D', 'L', 'B'];
233  var SLICE_BASES = ['M', 'E', 'S'];
234  var ROTATION_BASES = ['x', 'y', 'z'];
235  
236  function kind(move) {
237    if (!isMove(move)) throw new Error('kind: 未知記號 ' + move);
238    var base = move.charAt(0);
239    if (OUTER_BASES.indexOf(base) !== -1) return 'outer';
240    if (SLICE_BASES.indexOf(base) !== -1) return 'slice';
241    if (ROTATION_BASES.indexOf(base) !== -1) return 'rotation';
242    throw new Error('kind: 未知記號 ' + move);
243  }
244  
245  function isHalfTurn(move) {
246    return move.length > 1 && move.charAt(1) === '2';
247  }
248  
249  function qtmCost(move) {
250    var k = kind(move);
251    if (k === 'rotation') return 0;
252    var half = isHalfTurn(move);
253    if (k === 'outer') return half ? 2 : 1;
254    return half ? 4 : 2; // slice
255  }
256  
257  function inverse(move) {
258    if (!isMove(move)) throw new Error('inverse: 未知記號 ' + move);
259    var base = move.charAt(0);
260    if (move.length === 1) return base + "'";
261    if (move.charAt(1) === '2') return move;
262    return base; // 原本是 X' → 反向是 X
263  }
264  
265  function layerStickers(move) {
266    if (!isMove(move)) throw new Error('layerStickers: 未知記號 ' + move);
267    var perm = MOVE_PERM[move];
268    var out = [];
269    for (var i = 0; i < 54; i++) {
270      if (perm[i] !== i) out.push(i);
271    }
272    return out;
273  }
274  
275  // ---------------------------------------------------------------------------
276  // 7. 24 種朝向：以 x、y、z 為生成元 BFS，依發現順序編號 0–23（§3.2）
277  // ---------------------------------------------------------------------------
278  
279  var IDENTITY_PERM = [];
280  for (var ii = 0; ii < 54; ii++) IDENTITY_PERM.push(ii);
281  
282  var ORIENT = [IDENTITY_PERM];
283  var ORIENT_KEY = new Map();
284  ORIENT_KEY.set(IDENTITY_PERM.join(','), 0);
285  
286  var ORIENT_GENS = ['x', 'y', 'z'];
287  for (var h = 0; h < ORIENT.length; h++) {
288    for (var gi = 0; gi < ORIENT_GENS.length; gi++) {
289      var candidate = composePerm(ORIENT[h], MOVE_PERM[ORIENT_GENS[gi]]);
290      var ckey = candidate.join(',');
291      if (!ORIENT_KEY.has(ckey)) {
292        ORIENT_KEY.set(ckey, ORIENT.length);
293        ORIENT.push(candidate);
294      }
295    }
296  }
297  
298  // 幾何若正確必為 24；此為模組載入時的內部一致性檢查（非執行期輸入相依，仍是純函數模組）。
299  if (ORIENT.length !== 24) {
300    throw new Error('cube: 朝向數量應為 24，實得 ' + ORIENT.length);
301  }
302  
303  var ORIENT_COUNT = 24;
304  
305  function checkOrient(o) {
306    if (!(Number.isInteger(o) && o >= 0 && o < ORIENT_COUNT)) {
307      throw new Error('cube: orient 必須是 0–23 的整數，收到 ' + o);
308    }
309  }
310  
311  function applyOrient(home, o) {
312    checkOrient(o);
313    return applyPerm(home, ORIENT[o]);
314  }
315  
316  function orientAfter(o, rotation) {
317    checkOrient(o);
318    if (kind(rotation) !== 'rotation') {
319      throw new Error('orientAfter: rotation 必須是整顆旋轉記號，收到 ' + rotation);
320    }
321    var composed = composePerm(ORIENT[o], MOVE_PERM[rotation]);
322    var next = ORIENT_KEY.get(composed.join(','));
323    if (next === undefined) throw new Error('orientAfter: 找不到對應朝向');
324    return next;
325  }
326  
327  function toHome(orient, viewMove) {
328    checkOrient(orient);
329    if (!isMove(viewMove)) throw new Error('toHome: 未知記號 ' + viewMove);
330    var viewPerm = MOVE_PERM[viewMove];
331    var P = ORIENT[orient];
332    var composed = composePerm(composePerm(P, viewPerm), invertPerm(P));
333    var name = MOVE_BY_PERM.get(composed.join(','));
334    if (!name) throw new Error('toHome: 找不到對應的 home 記號');
335    return name;
336  }
337  
338  function toView(orient, homeMove) {
339    checkOrient(orient);
340    if (!isMove(homeMove)) throw new Error('toView: 未知記號 ' + homeMove);
341    var homePerm = MOVE_PERM[homeMove];
342    var P = ORIENT[orient];
343    var composed = composePerm(composePerm(invertPerm(P), homePerm), P);
344    var name = MOVE_BY_PERM.get(composed.join(','));
345    if (!name) throw new Error('toView: 找不到對應的 view 記號');
346    return name;
347  }
348  
349  // ---------------------------------------------------------------------------
350  // 8. 觸控手勢 → 記號（game-spec.md §9.2 第 3 點）
351  // ---------------------------------------------------------------------------
352  
353  function faceByNormal(v) {
354    for (var i = 0; i < FACE_LIST.length; i++) {
355      if (vecEq(NORMAL[FACE_LIST[i]], v)) return FACE_LIST[i];
356    }
357    throw new Error('gestureToMove: 找不到對應面');
358  }
359  
360  // 中層的參考法向量：M 參考 L、E 參考 D、S 參考 F（§1.2 方向慣例）。
361  var SLICE_REF = [
362    ['M', NORMAL.L],
363    ['E', NORMAL.D],
364    ['S', NORMAL.F]
365  ];
366  
367  function gestureToMove(viewIndex, dir3) {
368    if (!(Number.isInteger(viewIndex) && viewIndex >= 0 && viewIndex < 54)) {
369      throw new Error('gestureToMove: viewIndex 必須是 0–53 的整數');
370    }
371    var n = STICKER_NRM[viewIndex];
372    var p = STICKER_POS[viewIndex];
373    var w = cross(n, dir3);
374    var k = dot(p, w);
375    if (k === 1) return faceByNormal(w) + "'";
376    if (k === -1) return faceByNormal(negate(w));
377    for (var i = 0; i < SLICE_REF.length; i++) {
378      var letter = SLICE_REF[i][0];
379      var ref = SLICE_REF[i][1];
380      if (vecEq(ref, w)) return letter + "'";
381      if (vecEq(ref, negate(w))) return letter;
382    }
383    throw new Error('gestureToMove: 無法判定轉動方向');
384  }
385  
386  // ---------------------------------------------------------------------------
387  // 9. 記號字串解析與顯示（§1.2 字元規則）
388  // ---------------------------------------------------------------------------
389  
390  function parseMoves(str) {
391    if (typeof str !== 'string') throw new Error('parseMoves: 需要字串');
392    var trimmed = str.trim();
393    if (trimmed === '') return [];
394    var tokens = trimmed.split(/\s+/);
395    return tokens.map(function (token) {
396      var normalized = token.replace(/[’′]/g, "'"); // ’ 與 ′ 正規化為 '
397      if (!MOVE_SET.has(normalized)) throw new Error('parseMoves: 無效記號 ' + token);
398      return normalized;
399    });
400  }
401  
402  function formatMove(move) {
403    if (!MOVE_SET.has(move)) throw new Error('formatMove: 無效記號 ' + move);
404    return move.replace("'", '′');
405  }
406  
407  // ---------------------------------------------------------------------------
408  // 10. 白話說明用的結構化描述（§2.4，修訂 R-2d）
409  // ---------------------------------------------------------------------------
410  
411  function describeMove(move) {
412    if (!MOVE_SET.has(move)) throw new Error('describeMove: 無效記號 ' + move);
413    var base = move.charAt(0);
414    var moveKind = kind(move);
415    var turn;
416    if (move.length === 1) {
417      turn = 'cw';
418    } else if (move.charAt(1) === '2') {
419      turn = 'half';
420    } else {
421      turn = 'ccw';
422    }
423    return { move: move, base: base, kind: moveKind, turn: turn, qtm: qtmCost(move) };
424  }
425  
426  // ---------------------------------------------------------------------------
427  // 11. 匯出常數凍結（S11／m-1：呼叫端不得改動共用的常數陣列）
428  // ---------------------------------------------------------------------------
429  
430  function deepFreeze(value) {
431    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
432    Object.getOwnPropertyNames(value).forEach(function (key) {
433      deepFreeze(value[key]);
434    });
435    return Object.freeze(value);
436  }
437  
438  deepFreeze(MOVES);
439  deepFreeze(SOLVED);
440  deepFreeze(STICKER_POS);
441  deepFreeze(STICKER_NRM);
442  deepFreeze(FACE_AXES);
443  
444  module.exports = {
445    MOVES: MOVES,
446    isMove: isMove,
447    SOLVED: SOLVED,
448    STICKER_POS: STICKER_POS,
449    STICKER_NRM: STICKER_NRM,
450    FACE_AXES: FACE_AXES,
451    applyMove: applyMove,
452    applyMoves: applyMoves,
453    inverse: inverse,
454    kind: kind,
455    qtmCost: qtmCost,
456    isSolved: isSolved,
457    ORIENT_COUNT: ORIENT_COUNT,
458    orientAfter: orientAfter,
459    applyOrient: applyOrient,
460    toHome: toHome,
461    toView: toView,
462    layerStickers: layerStickers,
463    gestureToMove: gestureToMove,
464    parseMoves: parseMoves,
465    formatMove: formatMove,
466    describeMove: describeMove
467  };
```

### 3.3 `src/engine/scramble.js`（新增，57 行）

```js
 1  // src/engine/scramble.js — 打亂產生器（random-move，非 WCA 官方打亂）
 2  //
 3  // 依據：game-spec.md §5「打亂規則」。純函數：同 seed 必得同打亂字串；
 4  // RNG 於函式內建立、用完即丟，不存進 state（CLAUDE.md §3 第 2 條）。
 5  'use strict';
 6  
 7  var rngModule = require('./rng.js');
 8  var cube = require('./cube.js');
 9  
10  var makeRng = rngModule.makeRng;
11  
12  // 記號池：外層 18 個，依 MOVE_ORDER = U R F D L B × ["", "2", "'"] 的順序（即 MOVES 前 18 個）。
13  var OUTER_MOVES = cube.MOVES.slice(0, 18);
14  
15  // 同軸分組：U/D、R/L、F/B（用來檢查「同軸連三」）。
16  var AXIS_OF_BASE = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
17  
18  function isUint32(n) {
19    return Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
20  }
21  
22  // 產生一串長度為 length 的外層記號（避免同面相鄰、同軸連三），消耗傳入的 rng。
23  function generateOnce(rng, length) {
24    var out = [];
25    while (out.length < length) {
26      var candidate = OUTER_MOVES[Math.floor(rng() * 18)];
27      var base = candidate.charAt(0);
28      var k = out.length;
29      if (k >= 1 && out[k - 1].charAt(0) === base) continue; // 同面相鄰
30      if (k >= 2 && AXIS_OF_BASE[out[k - 1].charAt(0)] === AXIS_OF_BASE[base] &&
31          AXIS_OF_BASE[out[k - 2].charAt(0)] === AXIS_OF_BASE[base]) continue; // 同軸連三
32      out.push(candidate);
33    }
34    return out;
35  }
36  
37  /**
38   * 產生打亂記號序列（home 座標）。
39   * @param {number} seed - 0–4294967295 的整數；非 uint32 時拋錯。
40   * @param {{length: number}} params - `length` 為記號個數（§5：預設 25，由呼叫端傳入）。
41   * @returns {string[]}
42   */
43  function makeScramble(seed, params) {
44    if (!isUint32(seed)) throw new Error('makeScramble: seed 必須是 0–4294967295 的整數');
45    if (!params || !Number.isInteger(params.length) || params.length <= 0) {
46      throw new Error('makeScramble: params.length 必須是正整數');
47    }
48    var rng = makeRng(seed);
49    var moves;
50    do {
51      // 若打亂結果剛好是復原狀態：以同一個 RNG 繼續產生新的一整串（§5）。
52      moves = generateOnce(rng, params.length);
53    } while (cube.isSolved(cube.applyMoves(cube.SOLVED, moves)));
54    return moves;
55  }
56  
57  module.exports = { makeScramble: makeScramble };
```

### 3.4 `src/engine/selectors.js`（新增，136 行）

```js
  1  // src/engine/selectors.js — UI 唯讀取數用的選取函式（game-spec.md §4.1）
  2  //
  3  // UI 只透過本檔讀取衍生資料，不得自己計算規則（CLAUDE.md §3 第 1 條）。
  4  'use strict';
  5  
  6  var cube = require('./cube.js');
  7  var reducer = require('./reducer.js');
  8  
  9  function viewStickers(state) {
 10    return cube.applyOrient(state.home, state.orient);
 11  }
 12  
 13  function moveCount(state) {
 14    return reducer.moveCount(state);
 15  }
 16  
 17  function elapsedMs(state, nowAt) {
 18    var running = state.timer.state === 'running';
 19    return state.timer.accMs + (running ? Math.max(0, nowAt - state.timer.since) : 0);
 20  }
 21  
 22  function isSolvedNow(state) {
 23    return cube.isSolved(state.home);
 24  }
 25  
 26  function canApply(state, action, data) {
 27    return reducer.canApply(state, action, data);
 28  }
 29  
 30  // 提示以 view 座標顯示；hint.move 存的是 home 座標記號，換算時用「請求當下的 orient」
 31  // 換算後的目前 orient（提示成立後 ROTATE 不清除提示，所以要用目前 orient 換算，見 T-ENG-18）。
 32  function hintView(state) {
 33    var hint = state.hint;
 34    if (!hint || hint.pending) return null;
 35    var move = cube.toView(state.orient, hint.move);
 36    return {
 37      move: move,
 38      qtm: cube.qtmCost(hint.move),
 39      planQtm: hint.planQtm,
 40      source: hint.source
 41    };
 42  }
 43  
 44  function hintLayer(state) {
 45    var hv = hintView(state);
 46    if (!hv) return [];
 47    return cube.layerStickers(hv.move);
 48  }
 49  
 50  // 找出 demo.cursor 目前落在哪個 segment／part（供 §8.2 分段進度顯示）。
 51  function locateSegment(segments, cursor) {
 52    if (!segments) return { segmentIndex: -1, partIndex: -1 };
 53    var segmentIndex = -1;
 54    for (var s = 0; s < segments.length; s++) {
 55      var seg = segments[s];
 56      if (cursor >= seg.start && cursor < seg.end) {
 57        segmentIndex = s;
 58        break;
 59      }
 60    }
 61    if (segmentIndex === -1 && segments.length > 0 && cursor >= segments[segments.length - 1].end) {
 62      segmentIndex = segments.length - 1; // 已播完，停在最後一段
 63    }
 64    var partIndex = -1;
 65    if (segmentIndex !== -1) {
 66      var parts = segments[segmentIndex].parts;
 67      for (var p = 0; p < parts.length; p++) {
 68        if (cursor >= parts[p].start && cursor < parts[p].end) {
 69          partIndex = p;
 70          break;
 71        }
 72      }
 73    }
 74    return { segmentIndex: segmentIndex, partIndex: partIndex };
 75  }
 76  
 77  function demoInfo(state) {
 78    var demo = state.demo;
 79    if (!demo) return null;
 80    var total = demo.tokens.length;
 81    var totalQtm = 0;
 82    var doneQtm = 0;
 83    for (var i = 0; i < total; i++) {
 84      var q = cube.kind(demo.tokens[i]) === 'rotation' ? 0 : cube.qtmCost(demo.tokens[i]);
 85      totalQtm += q;
 86      if (i < demo.cursor) doneQtm += q;
 87    }
 88    var nextToken = demo.cursor < total ? demo.tokens[demo.cursor] : null;
 89    var nextIsRotation = nextToken !== null && cube.kind(nextToken) === 'rotation';
 90    var located = locateSegment(demo.segments, demo.cursor);
 91    return {
 92      kind: demo.kind,
 93      cursor: demo.cursor,
 94      total: total,
 95      totalQtm: totalQtm,
 96      doneQtm: doneQtm,
 97      nextToken: nextToken,
 98      nextIsRotation: nextIsRotation,
 99      segmentIndex: located.segmentIndex,
100      partIndex: located.partIndex
101    };
102  }
103  
104  function demoNextLayer(state) {
105    var demo = state.demo;
106    if (!demo || demo.cursor >= demo.tokens.length) return [];
107    var t = demo.tokens[demo.cursor];
108    if (cube.kind(t) === 'rotation') {
109      var all = [];
110      for (var i = 0; i < 54; i++) all.push(i);
111      return all;
112    }
113    return cube.layerStickers(t);
114  }
115  
116  function recordEligible(state) {
117    return state.status === 'solved' && state.seed !== null && !!state.result && state.result.assist === 'none';
118  }
119  
120  function solverInput(state) {
121    return { stickers: viewStickers(state), version: state.version, orient: state.orient };
122  }
123  
124  module.exports = {
125    viewStickers: viewStickers,
126    moveCount: moveCount,
127    elapsedMs: elapsedMs,
128    isSolvedNow: isSolvedNow,
129    canApply: canApply,
130    hintView: hintView,
131    hintLayer: hintLayer,
132    demoInfo: demoInfo,
133    demoNextLayer: demoNextLayer,
134    recordEligible: recordEligible,
135    solverInput: solverInput
136  };
```

### 3.5 `src/engine/reducer.js`（新增，511 行）

```js
  1  // src/engine/reducer.js — 狀態機（reducer 模式）
  2  //
  3  // 依據：game-spec.md §3.4–§3.6（狀態模型）、§4（action 清單）、§6.1–§6.3（計時規則）。
  4  //
  5  // 設計原則（CLAUDE.md §3）：
  6  //   - 純函數，不讀取時間、DOM、亂數或全域狀態；時間一律由 action 的 `at` 帶入。
  7  //   - 不修改輸入 state（一律回傳新物件／新陣列）。
  8  //   - `data` 只用到 `data.params.scramble.length`（分派單 S3 輸出契約）。
  9  //   - 前置條件嚴格檢查（S11／m-1）：格式錯誤的記號、tokens、缺少 data 一律回 REJECT，
 10  //     不讓 applyEffect 拋出非 REJECT 的例外，確保 canApply 與 reduce 判斷一致（T-ENG-22）。
 11  'use strict';
 12  
 13  var cube = require('./cube.js');
 14  var scrambleModule = require('./scramble.js');
 15  
 16  var SPEC_VERSION = '0.1.1';
 17  
 18  // ---------------------------------------------------------------------------
 19  // 1. 初始狀態（game-spec.md §3.5）
 20  // ---------------------------------------------------------------------------
 21  
 22  function initialState() {
 23    return {
 24      specVersion: SPEC_VERSION,
 25      seed: null,
 26      scramble: [],
 27      status: 'free',
 28      home: cube.SOLVED.slice(),
 29      start: cube.SOLVED.slice(),
 30      orient: 0,
 31      history: [],
 32      cursor: 0,
 33      version: 0,
 34      timer: { state: 'idle', accMs: 0, since: null },
 35      assist: { hint: false, demo: false },
 36      hint: null,
 37      demo: null,
 38      result: null
 39    };
 40  }
 41  
 42  // ---------------------------------------------------------------------------
 43  // 2. 小工具
 44  // ---------------------------------------------------------------------------
 45  
 46  function isUint32(n) {
 47    return Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
 48  }
 49  
 50  // 提示的 tokens 必須是「0 個以上整顆旋轉 ＋ 恰好 1 個轉動」（game-spec.md §4 HINT_READY）。
 51  function isValidHintTokens(tokens) {
 52    if (!Array.isArray(tokens) || tokens.length < 1) return false;
 53    for (var i = 0; i < tokens.length; i++) {
 54      if (!cube.isMove(tokens[i])) return false;
 55    }
 56    for (var j = 0; j < tokens.length - 1; j++) {
 57      if (cube.kind(tokens[j]) !== 'rotation') return false;
 58    }
 59    return cube.kind(tokens[tokens.length - 1]) !== 'rotation';
 60  }
 61  
 62  // 示範的 tokens 必須是非空陣列，且每個元素都是合法記號（S11／m-1）。
 63  // 非空的理由：DEMO_REQUEST 要求方塊未復原，合法的示範至少有一個轉動。
 64  function isValidDemoTokens(tokens) {
 65    if (!Array.isArray(tokens) || tokens.length < 1) return false;
 66    for (var i = 0; i < tokens.length; i++) {
 67      if (!cube.isMove(tokens[i])) return false;
 68    }
 69    return true;
 70  }
 71  
 72  // NEW_GAME 需要 data.params.scramble.length（正整數），缺少時回 REJECT（S11／m-1）。
 73  function hasScrambleParams(data) {
 74    return !!(data && data.params && data.params.scramble &&
 75      Number.isInteger(data.params.scramble.length) && data.params.scramble.length > 0);
 76  }
 77  
 78  // 本局淨步數（game-spec.md §2.2）：history[0…cursor) 每筆轉動的 qtmCost 總和。
 79  function moveCountOf(state) {
 80    var sum = 0;
 81    for (var i = 0; i < state.cursor; i++) {
 82      sum += cube.qtmCost(state.history[i].m);
 83    }
 84    return sum;
 85  }
 86  
 87  // 計時器：開始或恢復（§6.2）。idle／paused → running，since = at，accMs 不變；
 88  // 已經是 running 時維持不變。
 89  function startOrResumeTimer(timer, at) {
 90    if (timer.state === 'running') return timer;
 91    return { state: 'running', accMs: timer.accMs, since: at };
 92  }
 93  
 94  // 計時器：暫停（§6.2）。只有 running 才會變化；at 早於 since 時該段計 0。
 95  function pauseTimerAt(timer, at) {
 96    if (timer.state !== 'running') return timer;
 97    return { state: 'paused', accMs: timer.accMs + Math.max(0, at - timer.since), since: null };
 98  }
 99  
100  // 計時器：完成時停止（§6.2）。若當時是 paused／idle，直接停止、accMs 不變。
101  function stopTimerAt(timer, at) {
102    if (timer.state === 'running') {
103      return { state: 'stopped', accMs: timer.accMs + Math.max(0, at - timer.since), since: null };
104    }
105    return { state: 'stopped', accMs: timer.accMs, since: null };
106  }
107  
108  // 完成判定（§4 開頭）：每次 home 改變後，若 status === "playing" 且 isSolved(home)，
109  // 轉為 solved、停止計時、凍結 result。
110  function applyCompletion(state, at) {
111    if (state.status === 'playing' && cube.isSolved(state.home)) {
112      var timer = stopTimerAt(state.timer, at);
113      var assist = state.assist.demo ? 'demo' : (state.assist.hint ? 'hint' : 'none');
114      return Object.assign({}, state, {
115        status: 'solved',
116        timer: timer,
117        result: { timeMs: timer.accMs, qtm: moveCountOf(state), assist: assist }
118      });
119    }
120    return state;
121  }
122  
123  // ---------------------------------------------------------------------------
124  // 3. 前置條件檢查（reduce 與 canApply 共用同一份邏輯，確保 T-ENG-22 一致）
125  // ---------------------------------------------------------------------------
126  
127  function checkAction(state, action, data) {
128    if (!action || typeof action.type !== 'string') return 'invalidAction';
129    var payload = action.payload || {};
130    switch (action.type) {
131      case 'NEW_GAME':
132        if (!isUint32(payload.seed)) return 'invalidSeed';
133        if (!hasScrambleParams(data)) return 'missingData';
134        return null;
135  
136      case 'TURN': {
137        if (state.status === 'solved') return 'solved';
138        if (state.demo !== null) return 'demoActive';
139        if (state.hint && state.hint.pending) return 'hintPending';
140        if (!cube.isMove(payload.move)) return 'notATurn';
141        if (cube.kind(payload.move) === 'rotation') return 'notATurn';
142        return null;
143      }
144  
145      case 'ROTATE': {
146        if (state.demo !== null) return 'demoActive';
147        // S11／m-4：等提示期間不改朝向，讓「提示以請求當下的 orient 換算」成為結構性保證（D-12）。
148        if (state.hint && state.hint.pending) return 'hintPending';
149        if (!cube.isMove(payload.move)) return 'notARotation';
150        if (cube.kind(payload.move) !== 'rotation') return 'notARotation';
151        return null;
152      }
153  
154      case 'SET_ORIENT': {
155        if (state.demo !== null) return 'demoActive';
156        if (state.hint && state.hint.pending) return 'hintPending'; // S11／m-4
157        if (!(Number.isInteger(payload.orient) && payload.orient >= 0 && payload.orient < cube.ORIENT_COUNT)) {
158          return 'invalidOrient';
159        }
160        return null;
161      }
162  
163      case 'UNDO': {
164        if (state.cursor <= 0) return 'noHistory';
165        if (state.status === 'solved') return 'solved';
166        if (state.demo !== null) return 'demoActive';
167        if (state.hint && state.hint.pending) return 'hintPending';
168        return null;
169      }
170  
171      case 'REDO': {
172        if (state.cursor >= state.history.length) return 'noRedo';
173        if (state.status === 'solved') return 'solved';
174        if (state.demo !== null) return 'demoActive';
175        if (state.hint && state.hint.pending) return 'hintPending';
176        return null;
177      }
178  
179      case 'RESET':
180        return null;
181  
182      case 'PAUSE':
183        if (payload.reason !== 'hidden' && payload.reason !== 'lesson') return 'badReason';
184        return null;
185  
186      case 'HINT_REQUEST': {
187        if (state.status === 'solved') return 'solved';
188        if (cube.isSolved(state.home)) return 'alreadySolved';
189        if (state.demo !== null) return 'demoActive';
190        if (state.hint && state.hint.pending) return 'hintPending';
191        return null;
192      }
193  
194      case 'HINT_READY': {
195        if (!(state.hint && state.hint.pending)) return 'notPending';
196        if (payload.version !== state.version) return 'stale';
197        if (!isValidHintTokens(payload.tokens)) return 'invalidTokens';
198        return null;
199      }
200  
201      case 'HINT_FAILED': {
202        if (!(state.hint && state.hint.pending)) return 'notPending';
203        if (payload.version !== state.version) return 'stale';
204        return null;
205      }
206  
207      case 'HINT_CLEAR':
208        if (!(state.hint && state.hint.pending === false)) return 'noHint';
209        return null;
210  
211      case 'DEMO_REQUEST': {
212        if (payload.kind !== 'suggest' && payload.kind !== 'lbl') return 'invalidKind';
213        if (state.status === 'solved') return 'solved';
214        if (cube.isSolved(state.home)) return 'alreadySolved';
215        if (state.demo !== null) return 'demoActive';
216        if (state.hint && state.hint.pending) return 'hintPending';
217        return null;
218      }
219  
220      case 'DEMO_READY': {
221        if (!(state.demo && state.demo.pending)) return 'notPending';
222        if (payload.version !== state.version) return 'stale';
223        if (!isValidDemoTokens(payload.tokens)) return 'invalidTokens';
224        if (state.demo.kind === 'lbl' && !payload.segments) return 'missingSegments';
225        if (payload.segments !== undefined && payload.segments !== null && !Array.isArray(payload.segments)) {
226          return 'invalidSegments';
227        }
228        return null;
229      }
230  
231      case 'DEMO_FAILED': {
232        if (!(state.demo && state.demo.pending)) return 'notPending';
233        if (payload.version !== state.version) return 'stale';
234        return null;
235      }
236  
237      case 'DEMO_STEP': {
238        if (!(state.demo && state.demo.pending === false)) return 'notReady';
239        if (payload.delta !== 1 && payload.delta !== -1) return 'invalidDelta';
240        var target = state.demo.cursor + payload.delta;
241        if (target < 0 || target > state.demo.tokens.length) return 'outOfRange';
242        return null;
243      }
244  
245      case 'DEMO_SEEK': {
246        if (!(state.demo && state.demo.pending === false)) return 'notReady';
247        if (!(Number.isInteger(payload.cursor) && payload.cursor >= 0 && payload.cursor <= state.demo.tokens.length)) {
248          return 'outOfRange';
249        }
250        return null;
251      }
252  
253      case 'DEMO_EXIT':
254        if (state.demo === null) return 'noDemo';
255        return null;
256  
257      default:
258        return 'unknownAction';
259    }
260  }
261  
262  // ---------------------------------------------------------------------------
263  // 4. 示範單步（DEMO_STEP／DEMO_SEEK／DEMO_EXIT 共用）
264  // ---------------------------------------------------------------------------
265  
266  function demoStepForward(state, at) {
267    var demo = state.demo;
268    var t = demo.tokens[demo.cursor];
269    if (cube.kind(t) === 'rotation') {
270      return Object.assign({}, state, {
271        orient: cube.orientAfter(state.orient, t),
272        demo: Object.assign({}, demo, { cursor: demo.cursor + 1 })
273      });
274    }
275    var m = cube.toHome(state.orient, t);
276    var newHistory = state.history.slice(0, state.cursor).concat([{ m: m, src: 'demo' }]);
277    var next = Object.assign({}, state, {
278      history: newHistory,
279      cursor: state.cursor + 1,
280      home: cube.applyMove(state.home, m),
281      version: state.version + 1,
282      demo: Object.assign({}, demo, { cursor: demo.cursor + 1 })
283    });
284    return applyCompletion(next, at);
285  }
286  
287  function demoStepBackward(state) {
288    var demo = state.demo;
289    var t = demo.tokens[demo.cursor - 1];
290    if (cube.kind(t) === 'rotation') {
291      return Object.assign({}, state, {
292        orient: cube.orientAfter(state.orient, cube.inverse(t)),
293        demo: Object.assign({}, demo, { cursor: demo.cursor - 1 })
294      });
295    }
296    var lastEntry = state.history[state.history.length - 1]; // INV-4：必為 src:"demo"
297    var newHistory = state.history.slice(0, state.history.length - 1);
298    return Object.assign({}, state, {
299      history: newHistory,
300      cursor: state.cursor - 1,
301      home: cube.applyMove(state.home, cube.inverse(lastEntry.m)),
302      version: state.version + 1,
303      demo: Object.assign({}, demo, { cursor: demo.cursor - 1 })
304    });
305  }
306  
307  // ---------------------------------------------------------------------------
308  // 5. 狀態轉移（僅在 checkAction 回傳 null 之後呼叫）
309  // ---------------------------------------------------------------------------
310  
311  function applyEffect(state, action, data) {
312    var payload = action.payload || {};
313    switch (action.type) {
314      case 'NEW_GAME': {
315        var length = data.params.scramble.length;
316        var scramble = scrambleModule.makeScramble(payload.seed, { length: length });
317        var start = cube.applyMoves(cube.SOLVED, scramble);
318        return {
319          specVersion: state.specVersion,
320          seed: payload.seed,
321          scramble: scramble,
322          status: 'playing',
323          home: start.slice(),
324          start: start.slice(),
325          orient: 0,
326          history: [],
327          cursor: 0,
328          version: state.version + 1,
329          timer: { state: 'idle', accMs: 0, since: null },
330          assist: { hint: false, demo: false },
331          hint: null,
332          demo: null,
333          result: null
334        };
335      }
336  
337      case 'TURN': {
338        var m = cube.toHome(state.orient, payload.move);
339        var newHistory = state.history.slice(0, state.cursor).concat([{ m: m, src: 'user' }]);
340        var newTimer = state.status === 'playing' ? startOrResumeTimer(state.timer, payload.at) : state.timer;
341        var next = Object.assign({}, state, {
342          history: newHistory,
343          cursor: state.cursor + 1,
344          home: cube.applyMove(state.home, m),
345          version: state.version + 1,
346          hint: null,
347          timer: newTimer
348        });
349        return applyCompletion(next, payload.at);
350      }
351  
352      case 'ROTATE':
353        return Object.assign({}, state, { orient: cube.orientAfter(state.orient, payload.move) });
354  
355      case 'SET_ORIENT':
356        return Object.assign({}, state, { orient: payload.orient });
357  
358      case 'UNDO': {
359        var undoEntry = state.history[state.cursor - 1];
360        var undoTimer = state.status === 'playing' ? startOrResumeTimer(state.timer, payload.at) : state.timer;
361        var undoNext = Object.assign({}, state, {
362          home: cube.applyMove(state.home, cube.inverse(undoEntry.m)),
363          cursor: state.cursor - 1,
364          version: state.version + 1,
365          hint: null,
366          timer: undoTimer
367        });
368        return applyCompletion(undoNext, payload.at);
369      }
370  
371      case 'REDO': {
372        var redoEntry = state.history[state.cursor];
373        var redoTimer = state.status === 'playing' ? startOrResumeTimer(state.timer, payload.at) : state.timer;
374        var redoNext = Object.assign({}, state, {
375          home: cube.applyMove(state.home, redoEntry.m),
376          cursor: state.cursor + 1,
377          version: state.version + 1,
378          hint: null,
379          timer: redoTimer
380        });
381        return applyCompletion(redoNext, payload.at);
382      }
383  
384      case 'RESET':
385        return Object.assign({}, state, {
386          home: state.start.slice(),
387          history: [],
388          cursor: 0,
389          status: state.seed === null ? 'free' : 'playing',
390          timer: { state: 'idle', accMs: 0, since: null },
391          hint: null,
392          demo: null,
393          result: null,
394          version: state.version + 1
395        });
396  
397      case 'PAUSE':
398        return Object.assign({}, state, { timer: pauseTimerAt(state.timer, payload.at) });
399  
400      case 'HINT_REQUEST':
401        return Object.assign({}, state, {
402          hint: { pending: true, version: state.version, orient: state.orient },
403          timer: pauseTimerAt(state.timer, payload.at)
404        });
405  
406      case 'HINT_READY': {
407        var o = state.hint.orient;
408        for (var i = 0; i < payload.tokens.length - 1; i++) {
409          o = cube.orientAfter(o, payload.tokens[i]);
410        }
411        var lastToken = payload.tokens[payload.tokens.length - 1];
412        var homeMove = cube.toHome(o, lastToken);
413        return Object.assign({}, state, {
414          hint: {
415            pending: false,
416            move: homeMove,
417            source: payload.source,
418            planQtm: payload.planQtm === undefined ? null : payload.planQtm
419          },
420          assist: Object.assign({}, state.assist, { hint: true })
421        });
422      }
423  
424      case 'HINT_FAILED':
425        return Object.assign({}, state, { hint: null });
426  
427      case 'HINT_CLEAR':
428        return Object.assign({}, state, { hint: null });
429  
430      case 'DEMO_REQUEST':
431        return Object.assign({}, state, {
432          demo: {
433            kind: payload.kind,
434            pending: true,
435            version: state.version,
436            orient: state.orient,
437            tokens: [],
438            segments: null,
439            cursor: 0,
440            baseCursor: 0
441          },
442          hint: null,
443          timer: pauseTimerAt(state.timer, payload.at)
444        });
445  
446      case 'DEMO_READY':
447        return Object.assign({}, state, {
448          demo: Object.assign({}, state.demo, {
449            pending: false,
450            tokens: payload.tokens,
451            segments: payload.segments === undefined ? null : payload.segments,
452            baseCursor: state.cursor
453          }),
454          history: state.history.slice(0, state.cursor),
455          assist: Object.assign({}, state.assist, { demo: true })
456        });
457  
458      case 'DEMO_FAILED':
459        return Object.assign({}, state, { demo: null });
460  
461      case 'DEMO_STEP':
462        return payload.delta === 1 ? demoStepForward(state, payload.at) : demoStepBackward(state);
463  
464      case 'DEMO_SEEK': {
465        var cur = state;
466        while (cur.demo.cursor < payload.cursor) cur = demoStepForward(cur, payload.at);
467        while (cur.demo.cursor > payload.cursor) cur = demoStepBackward(cur);
468        return cur;
469      }
470  
471      case 'DEMO_EXIT': {
472        var exitState = state;
473        if (state.status === 'solved' && !cube.isSolved(state.home)) {
474          while (exitState.demo.cursor < exitState.demo.tokens.length) {
475            exitState = demoStepForward(exitState, payload.at);
476          }
477        }
478        return Object.assign({}, exitState, { demo: null });
479      }
480  
481      default:
482        throw new Error('applyEffect: 未知 action ' + action.type);
483    }
484  }
485  
486  // ---------------------------------------------------------------------------
487  // 6. 對外介面
488  // ---------------------------------------------------------------------------
489  
490  function reduce(state, action, data) {
491    var reason = checkAction(state, action, data);
492    if (reason !== null) {
493      throw new Error('REJECT:' + (action && action.type) + ':' + reason);
494    }
495    return applyEffect(state, action, data);
496  }
497  
498  function canApply(state, action, data) {
499    try {
500      return checkAction(state, action, data) === null;
501    } catch (e) {
502      return false;
503    }
504  }
505  
506  module.exports = {
507    initialState: initialState,
508    reduce: reduce,
509    canApply: canApply,
510    moveCount: moveCountOf
511  };
```

### 3.6 `src/engine/index.js`（新增，21 行）

```js
 1  // src/engine/index.js — engine 對外單一入口
 2  //
 3  // 依分派單 T-001 §3 S3 輸出契約：UI 與 solver-client 只從這裡 require，
 4  // 不得直接 require src/engine/ 底下其他檔案。
 5  'use strict';
 6  
 7  var cube = require('./cube.js');
 8  var reducer = require('./reducer.js');
 9  var selectors = require('./selectors.js');
10  
11  module.exports = Object.assign(
12    {},
13    cube,
14    reducer,
15    selectors,
16    {
17      cube: cube,
18      reducer: reducer,
19      selectors: selectors
20    }
21  );
```

### 3.7 `src/data/texts.json`（新增，90 行）

```json
 1  {
 2    "title": "魔術方塊",
 3    "buttons": { "scramble": "打亂", "newGame": "再來一局", "undo": "撤銷", "redo": "重做", "reset": "重設",
 4      "hint": "提示", "demoOpen": "看電腦解", "demoSuggest": "建議解示範", "demoLbl": "層先法示範", "play": "播放", "pause": "暫停",
 5      "stepForward": "下一步", "stepBack": "上一步", "exitDemo": "離開示範", "cancel": "取消",
 6      "speedSlow": "慢", "speedMid": "中", "speedFast": "快", "tryLbl": "改看層先法示範",
 7      "continue": "繼續", "notationHelp": "記號說明", "faceLabels": "面標籤", "sliceFold": "中層（進階）",
 8      "tutPrev": "上一步", "tutNext": "下一步", "tutDone": "開始玩", "tutSkip": "跳過教學",
 9      "lessonSkip": "略過這段", "lessonReplay": "再看一次", "lessonClose": "關閉",
10      "viewCube": "看看方塊" },
11    "panel": { "title": "學習面板", "tabControls": "操作", "tabDemo": "示範" },
12    "keypad": { "outer": "外層（U D L R F B）", "rotation": "整顆轉（x y z，不算步數）", "slice": "中層（M E S）" },
13    "scramble": { "notOfficial": "非 WCA 官方打亂", "label": "打亂：{alg}" },
14    "hud": { "time": "時間", "moves": "步數", "best": "最佳", "qtmNote": "步數以 QTM 計：90° 算 1 步、180° 算 2 步，中層加倍，整顆轉不算。" },
15    "hint": { "prompt": "卡住了嗎？按一下「提示」，看下一步該怎麼轉。", "only": "提示只會告訴你下一步，剩下的還是靠你自己轉喔。", "next": "下一步：{move}",
16      "move": "{move}（{qtm} 步）", "plan": "照建議解還要 {n} 步", "solving": "準備提示中，請稍等一下。" },
17    "demo": { "suggestTitle": "建議解：共 {n} 步", "lblTitle": "層先法：共 {n} 步", "progress": "已示範 {a}／{n} 步",
18      "rotateLabel": "整顆轉（不計步）", "segmentSteps": "{n} 步", "formula": "{name}：{alg}",
19      "solving": "正在整理建議解，請稍候⋯", "suggestUnavailable": "這次沒算出建議解，可以改看層先法示範。",
20      "notShortest": "建議解是電腦找到的一種解法，步數不一定是最少的。",
21      "pickPrompt": "選一種示範：建議解步數較少但不好懂；層先法步數多，但每一段都有說明，適合初學。",
22      "formulaUse": "用途：{desc}", "segmentSkipped": "已完成，略過",
23      "segmentDone": "本段完成：{done}；下一段要做：{next}", "segmentNext": "{name}（{desc}）" },
24    "result": { "solved": "太棒了！方塊復原了！", "summary": "完成！這局用了 {time}、{qtm} 步。",
25      "newRecord": "新紀錄", "badgeHint": "有提示", "badgeDemo": "示範", "demoNote": "看過示範的這局不列入紀錄。",
26      "best": "{label}：時間 {time}、步數 {qtm} 步" },
27    "confirm": { "newGameInProgress": "再來一局？目前這一局還沒完成，會直接重新打亂。" },
28    "free": { "solvedHint": "轉回原狀了。按「打亂」開始一局。" },
29    "solver": { "preparing": "準備提示中，請稍等一下。", "mainThreadNotice": "這台裝置要在前景準備提示，畫面可能會停頓一下。",
30      "failed": "建議解暫時無法使用，提示會改用層先法。" },
31    "error": { "invalidState": "方塊狀態有誤，請按「重設」。", "generic": "出了點問題，請再試一次。" },
32    "tutorial": [
33      "用手指劃過方塊的一面，就能轉動那一層。試試看！",
34      "劃在方塊外側的空白處，可以轉動整顆方塊，看看其他面。",
35      "不想用手勢也沒關係，學習面板的「操作」分頁有 U D L R F B 等按鈕，每顆下面都有中文；忘了記號的意思，隨時按「記號說明」。",
36      "準備好了嗎？按「打亂」，開始你的第一局。",
37      "轉不出來的時候，隨時可以按「提示」看下一步。"
38    ],
39    "notation": {
40      "lessonTitle": "記號小教室",
41      "lessonProgress": "記號小教室 {k}／{n}",
42      "tutorialProgress": "第 {k}／{n} 步",
43      "faceName": { "U": "上", "D": "下", "L": "左", "R": "右", "F": "前", "B": "後",
44        "M": "左右間", "E": "上下間", "S": "前後間" },
45      "keySub": { "cw": "{face}", "ccw": "{face}・逆", "half": "{face}・半圈" },
46      "rotationSub": { "x": "整顆上翻", "x'": "整顆下翻", "x2": "上下翻半圈",
47        "y": "整顆左轉", "y'": "整顆右轉", "y2": "左右轉半圈",
48        "z": "整顆右倒", "z'": "整顆左倒", "z2": "側倒半圈" },
49      "explain": {
50        "quarter": "{move}：{layer}{dir}轉 90°，算 {qtm} 步",
51        "half": "{move}：{layer}轉半圈（180°），算 {qtm} 步",
52        "sliceQuarter": "{move}：{layer}照 {ref} 的方向轉 90°，算 {qtm} 步",
53        "rotation": "{move}：{name}，不算步數",
54        "dirCw": "順時針", "dirCcw": "逆時針",
55        "layerName": { "U": "上層", "D": "下層", "L": "左層", "R": "右層", "F": "前層", "B": "後層",
56          "M": "左右之間的中層", "E": "上下之間的中層", "S": "前後之間的中層" },
57        "sliceRef": { "M": "L", "E": "D", "S": "F" },
58        "rotationName": {
59          "x": "整顆方塊往上翻（跟 R 同方向）", "x'": "整顆方塊往下翻（跟 R′ 同方向）", "x2": "整顆方塊上下翻半圈",
60          "y": "整顆方塊往左轉（跟 U 同方向）", "y'": "整顆方塊往右轉（跟 U′ 同方向）", "y2": "整顆方塊左右轉半圈",
61          "z": "整顆方塊往右倒（跟 F 同方向）", "z'": "整顆方塊往左倒（跟 F′ 同方向）", "z2": "整顆方塊側倒半圈" }
62      },
63      "lesson": [
64        { "id": "faces", "title": "六個面的代號",
65          "body": "方塊的六個面各有一個英文代號：U 上、D 下、L 左、R 右、F 前（正對你的那一面）、B 後。代號是依「你現在看到的方塊」來叫：整顆轉過之後，朝上的那一面就叫 U。中心貼紙上的字母就是代號。" },
66        { "id": "clockwise", "title": "順時針怎麼看",
67          "body": "只寫一個字母，就是把那一層轉 90°，方向是「正對那一面看的順時針」。R 要正對右面看：從正面看起來，右邊那一排會往上走。" },
68        { "id": "prime", "title": "′ 是逆時針",
69          "body": "字母右上角有一撇 ′，就是反過來轉（逆時針）。R′ 從正面看，右邊那一排會往下走。" },
70        { "id": "double", "title": "2 是轉半圈",
71          "body": "字母後面有 2，就是同一層轉 180°（等於轉兩次 90°），往哪邊轉結果都一樣。" },
72        { "id": "slice", "title": "外層和中層",
73          "body": "U D L R F B 轉的都是最外面那一層，叫外層。夾在中間的叫中層：M 是左右之間的中層，方向跟 L 一樣；E 是上下之間的中層，方向跟 D 一樣；S 是前後之間的中層，方向跟 F 一樣。中層鍵平常收在「中層（進階）」摺疊區，初學用不到。" },
74        { "id": "rotation", "title": "整顆轉 x y z",
75          "body": "小寫的 x、y、z 是把整顆方塊換個角度拿，不會打亂方塊：x 跟 R 同方向、y 跟 U 同方向、z 跟 F 同方向。層先法示範會用它們先把方塊拿好。" },
76        { "id": "qtm", "title": "步數怎麼算",
77          "body": "這裡用 QTM 算步數：外層轉 90° 算 1 步、轉半圈算 2 步；中層轉 90° 算 2 步、半圈算 4 步；整顆轉和拖曳換視角都不算。撤銷會把步數扣回來。" }
78      ]
79    },
80    "lbl": {
81      "hold": { "name": "拿好方塊", "desc": "先把白色中心轉到上面，我們從白色這一層開始。" },
82      "cross": { "name": "白色十字", "desc": "把四個白色邊塊放到上面，側面顏色也要對齊中心。" },
83      "corners": { "name": "白色角塊", "desc": "把四個白色角塊放進上層，完成第一層。" },
84      "middle": { "name": "中間層", "desc": "把方塊翻過來讓白色朝下，再把四個中層邊塊放進去。" },
85      "yellowCross": { "name": "黃色十字", "desc": "在頂面做出黃色十字，這一步只看形狀、不管側面顏色。" },
86      "yellowFace": { "name": "黃色頂面", "desc": "把四個角也翻成黃色，讓整個頂面變成黃色。" },
87      "yellowCorners": { "name": "黃角歸位", "desc": "把四個頂角換到正確位置，每一側兩個角的顏色要跟中心一樣。" },
88      "yellowEdges": { "name": "黃邊歸位", "desc": "最後把頂層邊塊換到正確位置，方塊就完成了。" }
89    }
90  }
```

### 3.8 `src/data/palette.json`（新增，12 行）

```json
 1  {
 2    "stickers": [
 3      { "id": 0, "name": "白", "hex": "#FFFFFF", "labelInk": "#111111" },
 4      { "id": 1, "name": "紅", "hex": "#C41E3A", "labelInk": "#FFFFFF" },
 5      { "id": 2, "name": "綠", "hex": "#009E60", "labelInk": "#FFFFFF" },
 6      { "id": 3, "name": "黃", "hex": "#FFD500", "labelInk": "#111111" },
 7      { "id": 4, "name": "橙", "hex": "#FF5800", "labelInk": "#111111" },
 8      { "id": 5, "name": "藍", "hex": "#0051BA", "labelInk": "#FFFFFF" }
 9    ],
10    "body": "#111111",
11    "highlight": "#FFFFFF"
12  }
```

### 3.9 `src/data/params.json`（新增，30 行）

```json
 1  {
 2    "scramble": { "length": 25 },
 3    "solver": { "metric": "qtm", "nodeLimit": 3000000, "firstNodeLimit": 30000000, "maxLength": 45, "phase2Cap": 20,
 4      "initTimeoutMs": 20000, "solveTimeoutMs": 10000, "planCacheSize": 64 },
 5    "demo": { "speeds": [ { "id": "slow", "stepMs": 900 }, { "id": "mid", "stepMs": 500 }, { "id": "fast", "stepMs": 250 } ],
 6      "defaultSpeed": "mid", "animRatio": 0.8, "pauseAtSegmentEnd": true },
 7    "gesture": { "lockPx": 10, "commitPx": 30, "maxAxisAngleDeg": 30, "cameraDegPerPx": 0.5, "pitchLimitDeg": 80 },
 8    "ui": { "turnAnimMs": 180, "scrambleAnimMsPerMove": 60, "timerRefreshMs": 100, "minTouchPx": 44,
 9      "snapAnimMs": 200, "baseViewDeg": { "x": -22, "y": -34 }, "hintErrorShowMs": 4000, "demoErrorShowMs": 6000 },
10    "input": { "queueMax": 3, "queuePollMs": 16 },
11    "debug": { "rejectLogSize": 50, "logRejectToConsole": false },
12    "layout": { "drawerExpandedDefault": true },
13    "keypad": { "sliceCollapsedDefault": true, "rotationCollapsedDefault": false, "showSubLabels": true },
14    "faceLabels": { "defaultOn": false, "forceOnInTutorial": true },
15    "tutorial": {
16      "enabled": true,
17      "notationBeforeIndex": 2,
18      "notationSteps": [
19        { "id": "faces", "demo": "U" },
20        { "id": "clockwise", "demo": "R" },
21        { "id": "prime", "demo": "R'" },
22        { "id": "double", "demo": "U2" },
23        { "id": "slice", "demo": "M" },
24        { "id": "rotation", "demo": "x" },
25        { "id": "qtm", "demo": "R2" }
26      ],
27      "demoTurnMs": 600, "demoHoldMs": 700
28    },
29    "storage": { "recordsKey": "cube3x3.records.v1", "tutorialKey": "cube3x3.tutorial.v1" }
30  }
```

### 3.10 `src/data/lbl.json`（新增，30 行）

```json
 1  {
 2    "firstLayerColor": 0,
 3    "segments": ["hold", "cross", "corners", "middle", "yellowCross", "yellowFace", "yellowCorners", "yellowEdges"],
 4    "formulas": {
 5      "crossDown":    { "alg": "F2",                            "name": "白邊翻上來",
 6                        "desc": "白色邊塊已經在正下方對好位置，前層轉半圈就把它送到上面。" },
 7      "crossFlip":    { "alg": "D R F' R'",                     "name": "白邊翻正",
 8                        "desc": "白色邊塊在下層但白色朝前時用，把它翻正再送上去。" },
 9      "cornerDrop":   { "alg": "R' D' R",                       "name": "角塊拿下來",
10                        "desc": "把放錯位置或方向的白色角塊先拿到下層，等一下再重新放。" },
11      "cornerInsert": { "alg": "R' D' R D",                     "name": "角塊放上去",
12                        "desc": "白色角塊在右前下方時，重複做幾次，它就會轉進右前上方的正確位置。" },
13      "edgeRight":    { "alg": "U R U' R' U' F' U F",           "name": "中層邊放右邊",
14                        "desc": "把上層前面的邊塊放進右前方的中層位置。" },
15      "edgeLeft":     { "alg": "U' L' U L U F U' F'",           "name": "中層邊放左邊",
16                        "desc": "把上層前面的邊塊放進左前方的中層位置。" },
17      "edgeKickOut":  { "alg": "U R U' R' U' F' U F",           "name": "把卡住的邊塊換出來",
18                        "desc": "中層有邊塊放錯時，先把它換到上層，之後再放回正確位置。" },
19      "yellowCross":  { "alg": "F R U R' U' F'",                "name": "黃十字公式",
20                        "desc": "做一到三次，頂面就會出現黃色十字。" },
21      "sune":         { "alg": "R U R' U R U2 R'",              "name": "小魚公式",
22                        "desc": "把頂面角塊的黃色轉到上面，重複到整個頂面都是黃色。" },
23      "aPerm":        { "alg": "R' F R' B2 R F' R' B2 R2",      "name": "換角公式",
24                        "desc": "左前上方的角塊不動，其他三個頂角輪流換位置。" },
25      "uPerm":        { "alg": "R2 U R U R' U' R' U' R' U R'",  "name": "換邊公式",
26                        "desc": "後面的頂邊不動，其他三個頂邊輪流換位置。" }
27    },
28    "headlightFace": "B",
29    "guards": { "cross": 8, "corners": 12, "cornerInsert": 5, "middle": 16, "yellowCross": 3, "sune": 6, "aPerm": 3, "uPerm": 3 }
30  }
```

## 4. 測試清單（全部批次共用）

| 測試檔 | 測試編號 | 最近一次結果 |
|---|---|---|
| `tests/engine/build.test.js` | T-BUILD-01、T-BUILD-02、T-BUILD-03 | 通過 |
| `tests/engine/cube.test.js` | T-ENG-01、T-ENG-02、T-ENG-03、T-ENG-04、T-ENG-05、T-ENG-06、T-ENG-07、T-ENG-08、T-ENG-09、T-ENG-10、T-ENG-25、T-ENG-28 | 通過 |
| `tests/engine/data.test.js` | T-DATA-01、T-DATA-02、T-DATA-03、T-DATA-04、T-DATA-05、T-DATA-06、T-DATA-07、T-DATA-08、T-DATA-09、T-DATA-10、T-UI-03 | 通過 |
| `tests/engine/forbidden.test.js` | T-ENG-24 | 通過 |
| `tests/engine/invariants.test.js` | T-ENG-12、T-ENG-14 | 通過 |
| `tests/engine/notation.test.js` | T-DATA-07 | 通過 |
| `tests/engine/reducer.test.js` | T-ENG-13、T-ENG-15、T-ENG-16、T-ENG-17、T-ENG-18、T-ENG-19、T-ENG-20、T-ENG-21、T-ENG-22、T-ENG-23、T-ENG-26、T-ENG-27 | 通過 |
| `tests/engine/scramble.test.js` | T-ENG-11 | 通過 |
| `tests/engine/ui-logic.test.js` | T-UI-29、T-UI-30 | 通過 |
| `tests/engine/solver/client.test.js` | solver-client 情境測試（C-01～C-13） | 通過 |
| `tests/engine/solver/lbl.test.js` | T-LBL-01、T-LBL-02、T-LBL-03、T-LBL-04、T-LBL-05、T-LBL-06、T-LBL-07、T-LBL-08、T-LBL-09、T-LBL-10 | 通過 |
| `tests/engine/solver/twophase.test.js` | T-ENG-05、T-SOL-01、T-SOL-02、T-SOL-03、T-SOL-04、T-SOL-05、T-SOL-06、T-SOL-07、T-SOL-08、T-SOL-09、T-SOL-10 | 通過 |
| `tests/engine/solver/worker.test.js` | T-SOL-08 | 通過 |
| `tests/ui/smoke.spec.js`（含 checks.js、checks2.js、checks3.js） | T-UI-01、T-UI-02、T-UI-03、T-UI-04、T-UI-05、T-UI-06、T-UI-07、T-UI-08、T-UI-09、T-UI-10、T-UI-11、T-UI-12、T-UI-13、T-UI-14、T-UI-15、T-UI-16、T-UI-17、T-UI-18、T-UI-19、T-UI-20、T-UI-21、T-UI-22、T-UI-23、T-UI-24、T-UI-25、T-UI-26、T-UI-27、T-UI-28（手機 390×844 與 iPad 1194×834 各跑一次） | 通過 |

測試指令：`node --test "tests/engine/**/*.test.js"`、`node build/bundle.js`、`node tests/ui/smoke.spec.js`；輸出摘要（2026-09-15）：

```
# pass 89
# fail 0
（engine，約 3 分 17 秒）
build 完成：index.html（371508 bytes；Worker 字串 84029 bytes；零外部資源）
T-UI-01～T-UI-28：[phone=PASS] [ipad=PASS]；全部通過。（UI，約 4 分 37 秒）
```

測試編號的定義在規格書（未附）；看不懂測試在驗什麼時，請列入「疑似」並說明需要什麼資訊。

## 5. 已知問題（不必重複回報）

| # | 來源 | 內容 | 目前處置 |
|---|---|---|---|
| 1 | 內部審查 | `src/ui/cube-view.js`、`notation.js`、`gesture.js`、`controls.js` 各自維護旋轉軸與轉向判斷，與 `src/engine/cube.js` 的定義重複；目前只影響動畫方向與鍵盤分組，最終狀態以 engine 為準 | 下版修 |
| 2 | 內部審查 | `src/ui/tutorial.js`、`records.js` 直接使用全域 `document`／`window`，未使用注入的文件物件 | 下版修 |
| 3 | 內部審查 | 部分固定符號（`<title>`、`?`、`×`、`✓`、全形括號）寫在程式或樣板中，未放進 `texts.json`；`texts.json`／`params.json` 有少數未使用的鍵 | 下版修 |
| 4 | 內部審查 | `src/solver/twophase.js` 的註解與一個內部錯誤訊息含「最少步」「最佳解」字樣（不會顯示在畫面上） | 刻意不處理 |
| 5 | 工程師回報 | 第一步轉動動畫進行中，「撤銷」鍵仍是停用狀態 | 待真機觀察 |
| 6 | 工程師回報 | 帶時間戳的 action 未檢查 `at` 是否為有效數字 | 下版修 |
| 7 | 尚未驗證 | iPad Safari 實機的 CSS 3D 顯示、Blob Worker 建立與建表時間（桌機 Chromium 約 1.2–1.4 秒） | 待真機測 |
| 8 | 尚未驗證 | 手勢手感（方向判定門檻 30°、最小滑動距離）尚未真人測試 | 待真機測 |

## 6. 請用這個格式回覆

**bug 清單**

| 編號 | 嚴重度 | 檔案:行號 | 問題（一句話） | 失敗情境 | 建議修法（方向） |
|---|---|---|---|---|---|
| E-1 | | | | | |

**疑似清單**（沒有重現步驟、或不確定是否為問題）

| 編號 | 檔案:行號 | 疑點 | 需要什麼資訊才能確認 |
|---|---|---|---|
| S-1 | | | |

**架構原則對照**：五條各寫「符合／違反（編號＋位置）／無法判斷」。

---

<多批時加：本批為第 n／N 批。若某問題需要其他批次的檔案才能確認，請在建議修法欄標「需跨批確認」。>
