# 審查包：T-001 魔術方塊 v0.1（第 2／4 批：求解器（兩階段法、層先法、Worker 協定））

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

**本批是第 2／4 批，其他批次的檔案不在這裡，若問題牽涉其他批次，請在「疑似」清單註明。**

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
- 本批檔案在整體中的角色：src/solver/ 是求解器：twophase.js 是自寫的 Kociemba 兩階段法（以 QTM 成本搜尋、搜尋節點上限控時、不讀時鐘），lbl.js 是層先法分段產生器（依 src/data/lbl.json 的公式），worker.js 是 Web Worker 的訊息處理（本身不綁 self.onmessage，由 build 包一層）。
- 四批的檔案分配：第 1 批 `src/engine/rng.js`、`src/engine/cube.js`、`src/engine/scramble.js`、`src/engine/selectors.js`、`src/engine/reducer.js`、`src/engine/index.js`、`src/data/texts.json`、`src/data/palette.json`、`src/data/params.json`、`src/data/lbl.json`；第 2 批 `src/solver/twophase.js`、`src/solver/lbl.js`、`src/solver/worker.js`；第 3 批 `src/ui/app.js`、`src/ui/controls.js`、`src/ui/gesture.js`、`src/ui/cube-view.js`、`src/ui/notation.js`、`src/ui/solver-client.js`、`src/ui/index.template.html`、`src/ui/styles.css`；第 4 批 `src/ui/demo-player.js`、`src/ui/hint-view.js`、`src/ui/tutorial.js`、`src/ui/records.js`、`src/ui/demo.css`、`src/ui/overlay.css`、`build/bundle.js`。

## 3. 變更檔案的完整程式碼（有行號，全部為新增檔案）

本批包含：`src/solver/twophase.js`、`src/solver/lbl.js`、`src/solver/worker.js`。

### 3.1 `src/solver/twophase.js`（新增，822 行）

```js
  1  // src/solver/twophase.js — 三階魔術方塊兩階段求解器（產品版，clean-room）
  2  //
  3  // 來源：由 docs/spike/code/solver.js 改寫（T-001 S4），改寫要求見 game-spec.md §7.3、ADR-001 §2.2–§2.4。
  4  // clean-room 註記：只參考公開的演算法說明文件（kociemba.org 兩階段法說明、Wikipedia），
  5  // 未開啟、複製或改寫任何第三方求解器原始碼（CLAUDE.md §1）。
  6  //
  7  // 與 spike 的差異：
  8  //   1. 不讀任何時鐘：停止條件只有搜尋節點數（nodeLimit、firstNodeLimit），同一輸入必得同一結果。
  9  //   2. 只建 QTM 成本的表（metrics:['qtm']、twistFlip:true、cornerTable:false）；init 加 onProgress 回呼。
 10  //   3. 移除最少步搜尋與其輔助函式（game-spec.md §0.2 N-4）；保留 randomCube、makeRng 供測試。
 11  //   4. 改為 CommonJS（module.exports），不掛任何全域物件；不依賴 src/engine/（game-spec.md §7.1）。
 12  //
 13  // 名詞：
 14  //   - 面序 URFDLB（0..5）；轉動編號 m = 3*面 + (次方-1)，次方 1=順時針 90°、2=180°、3=逆時針 90°。
 15  //     MOVE_NAMES 的順序因此與 src/engine/cube.js 的 MOVES 前 18 個相同。
 16  //   - 角塊位置 URF UFL ULB UBR DFR DLF DBL DRB；邊塊位置 UR UF UL UB DR DF DL DB FR FL BL BR。
 17  //   - cubie 表示法為「位置 i 上放的是哪一塊（cp/ep）以及它的方向（co/eo）」。
 18  //   - 54 格貼紙字串：U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9，每格填所屬面的字母。
 19  //   - QTM：90° 算 1 步、180° 算 2 步（本檔只處理外層轉動）。
 20  'use strict';
 21  
 22  var FACES = 'URFDLB';
 23  var N_MOVES = 18;
 24  var MOVE_NAMES = [];
 25  (function () {
 26    var suffix = ['', '2', "'"];
 27    for (var f = 0; f < 6; f++) for (var p = 0; p < 3; p++) MOVE_NAMES.push(FACES[f] + suffix[p]);
 28  })();
 29  var QTM_COST = new Int8Array(N_MOVES);
 30  for (var mi = 0; mi < N_MOVES; mi++) QTM_COST[mi] = (mi % 3 === 1) ? 2 : 1;
 31  
 32  // 搜尋參數的預設值：與 game-spec.md §7.4／§10.3 params.json 的 solver 區塊相同。
 33  // 正式呼叫端（worker.js）應一律把 params.solver 傳進來；這裡的預設只是防止呼叫端漏傳時無限搜尋。
 34  // 兩者一致性由 tests/engine/solver/twophase.test.js 比對。
 35  var DEFAULT_SOLVE_OPTS = Object.freeze({
 36    metric: 'qtm',
 37    nodeLimit: 3000000,
 38    firstNodeLimit: 30000000,
 39    maxLength: 45,
 40    phase2Cap: 20
 41  });
 42  // 第二階段深度的理論上限（QTM）：phase2Cap 找不到解時以此重搜（spike §2.7）
 43  var PHASE2_FULL = 36;
 44  // 每搜尋幾個節點檢查一次停止條件（必須是 2 的冪次減 1 的遮罩；沿用 spike，改動會改變求解結果）
 45  var CHECK_MASK = 1023;
 46  
 47  // ---------------------------------------------------------------------------
 48  // 1. 貼紙幾何：用 3D 座標推導 54 格的位置與轉動，避免手抄轉動表出錯
 49  //    座標軸：x 向右（R）、y 向上（U）、z 向前（F）
 50  // ---------------------------------------------------------------------------
 51  var NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
 52  // 每面展開圖的左上角座標、向右方向、向下方向（標準十字展開；與 game-spec.md §1.1 表格相同）
 53  var FACE_GEOM = {
 54    U: { tl: [-1, 1, -1], r: [1, 0, 0], d: [0, 0, 1] },
 55    R: { tl: [1, 1, 1], r: [0, 0, -1], d: [0, -1, 0] },
 56    F: { tl: [-1, 1, 1], r: [1, 0, 0], d: [0, -1, 0] },
 57    D: { tl: [-1, -1, 1], r: [1, 0, 0], d: [0, 0, -1] },
 58    L: { tl: [-1, 1, -1], r: [0, 0, 1], d: [0, -1, 0] },
 59    B: { tl: [1, 1, -1], r: [-1, 0, 0], d: [0, -1, 0] }
 60  };
 61  var STICKER_POS = [];
 62  var STICKER_NRM = [];
 63  (function () {
 64    for (var f = 0; f < 6; f++) {
 65      var g = FACE_GEOM[FACES[f]];
 66      for (var row = 0; row < 3; row++) {
 67        for (var col = 0; col < 3; col++) {
 68          STICKER_POS.push([
 69            g.tl[0] + col * g.r[0] + row * g.d[0],
 70            g.tl[1] + col * g.r[1] + row * g.d[1],
 71            g.tl[2] + col * g.r[2] + row * g.d[2]
 72          ]);
 73          STICKER_NRM.push(NORMAL[FACES[f]]);
 74        }
 75      }
 76    }
 77  })();
 78  function vecEq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
 79  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
 80  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
 81  function stickerIndex(pos, nrm) {
 82    for (var i = 0; i < 54; i++) if (vecEq(STICKER_POS[i], pos) && vecEq(STICKER_NRM[i], nrm)) return i;
 83    throw new Error('twophase：找不到貼紙');
 84  }
 85  // 繞單位軸 n 旋轉 -90°（從該面外側看為順時針）
 86  function rotCw(v, n) {
 87    var c = cross(n, v), d = dot(n, v);
 88    return [-c[0] + n[0] * d, -c[1] + n[1] * d, -c[2] + n[2] * d];
 89  }
 90  // FACE_PERM[f][src] = dest：面 f 順時針 90° 後，src 格的貼紙移到 dest 格
 91  var FACE_PERM = [];
 92  (function () {
 93    for (var f = 0; f < 6; f++) {
 94      var n = NORMAL[FACES[f]];
 95      var perm = new Int8Array(54);
 96      for (var i = 0; i < 54; i++) {
 97        if (dot(STICKER_POS[i], n) === 1) perm[i] = stickerIndex(rotCw(STICKER_POS[i], n), rotCw(STICKER_NRM[i], n));
 98        else perm[i] = i;
 99      }
100      FACE_PERM.push(perm);
101    }
102  })();
103  
104  var SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
105  
106  /**
107   * 在貼紙層級套用一個外層轉動（測試與對照用）。
108   * @param {string|Array} s - 54 格字串或陣列（陣列元素可為任意值）
109   * @param {number} m - 轉動編號 0..17
110   * @returns {string|Array} 與輸入同型別的新值（不修改輸入）
111   */
112  function applyMoveFacelets(s, m) {
113    var isStr = typeof s === 'string';
114    var arr = isStr ? s.split('') : Array.prototype.slice.call(s);
115    var f = (m / 3) | 0, pw = (m % 3) + 1;
116    for (var k = 0; k < pw; k++) {
117      var out = new Array(54);
118      for (var i = 0; i < 54; i++) out[FACE_PERM[f][i]] = arr[i];
119      arr = out;
120    }
121    return isStr ? arr.join('') : arr;
122  }
123  
124  // ---------------------------------------------------------------------------
125  // 2. cubie 表示法與貼紙互轉
126  // ---------------------------------------------------------------------------
127  var CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
128  var EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
129  function cubiePos(name) {
130    var p = [0, 0, 0];
131    for (var k = 0; k < name.length; k++) {
132      var n = NORMAL[name[k]];
133      p[0] += n[0]; p[1] += n[1]; p[2] += n[2];
134    }
135    return p;
136  }
137  var CORNER_FACELET = CORNER_NAMES.map(function (nm) {
138    var p = cubiePos(nm);
139    return nm.split('').map(function (c) { return stickerIndex(p, NORMAL[c]); });
140  });
141  var EDGE_FACELET = EDGE_NAMES.map(function (nm) {
142    var p = cubiePos(nm);
143    return nm.split('').map(function (c) { return stickerIndex(p, NORMAL[c]); });
144  });
145  
146  /** 已復原的 cubie 狀態（新物件） */
147  function newCube() {
148    var c = { cp: new Int8Array(8), co: new Int8Array(8), ep: new Int8Array(12), eo: new Int8Array(12) };
149    for (var i = 0; i < 8; i++) c.cp[i] = i;
150    for (var j = 0; j < 12; j++) c.ep[j] = j;
151    return c;
152  }
153  function copyCube(src, dst) {
154    dst = dst || newCube();
155    dst.cp.set(src.cp); dst.co.set(src.co); dst.ep.set(src.ep); dst.eo.set(src.eo);
156    return dst;
157  }
158  function cubeEquals(a, b) {
159    for (var i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
160    for (var j = 0; j < 12; j++) if (a.ep[j] !== b.ep[j] || a.eo[j] !== b.eo[j]) return false;
161    return true;
162  }
163  /** cubie 狀態是否為復原狀態 */
164  function isSolved(c) {
165    for (var i = 0; i < 8; i++) if (c.cp[i] !== i || c.co[i] !== 0) return false;
166    for (var j = 0; j < 12; j++) if (c.ep[j] !== j || c.eo[j] !== 0) return false;
167    return true;
168  }
169  // 乘法：先 a 後 b，結果寫入 out（out 不可與 a 相同物件）
170  function cornerMul(a, b, out) {
171    for (var i = 0; i < 8; i++) {
172      var s = b.cp[i];
173      out.cp[i] = a.cp[s];
174      out.co[i] = (a.co[s] + b.co[i]) % 3;
175    }
176  }
177  function edgeMul(a, b, out) {
178    for (var i = 0; i < 12; i++) {
179      var s = b.ep[i];
180      out.ep[i] = a.ep[s];
181      out.eo[i] = (a.eo[s] + b.eo[i]) & 1;
182    }
183  }
184  /** cubie 乘法：先 a 後 b，回傳新物件 */
185  function multiply(a, b) {
186    var out = newCube();
187    cornerMul(a, b, out); edgeMul(a, b, out);
188    return out;
189  }
190  
191  /**
192   * 54 格字母字串 → cubie。字母代表「這格的顏色屬於哪一面的中心」。
193   * 只做「能不能辨認出方塊」的檢查，合法性另由 verify() 判斷。
194   * @returns {{cube:Object}|{error:string}} 錯誤碼：LENGTH、BAD_COLOR、CENTER、COLOR_COUNT、CORNER_UNKNOWN、EDGE_UNKNOWN
195   */
196  function faceletsToCubie(s) {
197    if (typeof s !== 'string' || s.length !== 54) return { error: 'LENGTH' };
198    var count = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
199    for (var i = 0; i < 54; i++) {
200      if (!Object.prototype.hasOwnProperty.call(count, s[i])) return { error: 'BAD_COLOR' };
201      count[s[i]]++;
202    }
203    for (var f = 0; f < 6; f++) {
204      if (s[9 * f + 4] !== FACES[f]) return { error: 'CENTER' };
205      if (count[FACES[f]] !== 9) return { error: 'COLOR_COUNT' };
206    }
207    var c = newCube();
208    for (var p = 0; p < 8; p++) {
209      var fl = CORNER_FACELET[p], o;
210      for (o = 0; o < 3; o++) if (s[fl[o]] === 'U' || s[fl[o]] === 'D') break;
211      if (o === 3) return { error: 'CORNER_UNKNOWN' };
212      var c1 = s[fl[(o + 1) % 3]], c2 = s[fl[(o + 2) % 3]], found = -1;
213      for (var j = 0; j < 8; j++) {
214        if (CORNER_NAMES[j][0] === s[fl[o]] && CORNER_NAMES[j][1] === c1 && CORNER_NAMES[j][2] === c2) { found = j; break; }
215      }
216      if (found < 0) return { error: 'CORNER_UNKNOWN' };
217      c.cp[p] = found; c.co[p] = o;
218    }
219    for (var q = 0; q < 12; q++) {
220      var ef = EDGE_FACELET[q], a = s[ef[0]], b = s[ef[1]], hit = -1;
221      for (var k = 0; k < 12; k++) {
222        if (EDGE_NAMES[k][0] === a && EDGE_NAMES[k][1] === b) { c.ep[q] = k; c.eo[q] = 0; hit = k; break; }
223        if (EDGE_NAMES[k][0] === b && EDGE_NAMES[k][1] === a) { c.ep[q] = k; c.eo[q] = 1; hit = k; break; }
224      }
225      if (hit < 0) return { error: 'EDGE_UNKNOWN' };
226    }
227    return { cube: c };
228  }
229  
230  /** cubie → 54 格字母字串 */
231  function cubieToFacelets(c) {
232    var out = SOLVED_FACELETS.split('');
233    for (var p = 0; p < 8; p++) {
234      var j = c.cp[p], o = c.co[p];
235      for (var k = 0; k < 3; k++) out[CORNER_FACELET[p][(k + o) % 3]] = CORNER_NAMES[j][k];
236    }
237    for (var q = 0; q < 12; q++) {
238      var e = c.ep[q], eo = c.eo[q];
239      for (var t = 0; t < 2; t++) out[EDGE_FACELET[q][(t + eo) % 2]] = EDGE_NAMES[e][t];
240    }
241    return out.join('');
242  }
243  
244  function permParity(arr, n) {
245    var par = 0;
246    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) if (arr[i] > arr[j]) par ^= 1;
247    return par;
248  }
249  
250  /**
251   * 狀態合法性檢查。
252   * @returns {null|string} 合法回傳 null；否則回傳錯誤碼
253   *   CORNER_PERM_INVALID、CORNER_TWIST_INVALID、CORNER_TWIST、EDGE_PERM_INVALID、EDGE_FLIP_INVALID、EDGE_FLIP、PARITY
254   */
255  function verify(c) {
256    var seen = 0, i, sum = 0;
257    for (i = 0; i < 8; i++) {
258      if (c.cp[i] < 0 || c.cp[i] > 7) return 'CORNER_PERM_INVALID';
259      seen |= 1 << c.cp[i];
260      if (c.co[i] < 0 || c.co[i] > 2) return 'CORNER_TWIST_INVALID';
261      sum += c.co[i];
262    }
263    if (seen !== 0xff) return 'CORNER_PERM_INVALID';
264    if (sum % 3 !== 0) return 'CORNER_TWIST';
265    seen = 0; sum = 0;
266    for (i = 0; i < 12; i++) {
267      if (c.ep[i] < 0 || c.ep[i] > 11) return 'EDGE_PERM_INVALID';
268      seen |= 1 << c.ep[i];
269      if (c.eo[i] < 0 || c.eo[i] > 1) return 'EDGE_FLIP_INVALID';
270      sum += c.eo[i];
271    }
272    if (seen !== 0xfff) return 'EDGE_PERM_INVALID';
273    if (sum % 2 !== 0) return 'EDGE_FLIP';
274    if (permParity(c.cp, 8) !== permParity(c.ep, 12)) return 'PARITY';
275    return null;
276  }
277  
278  /**
279   * 從貼紙顏色建立狀態（game-spec.md §3.4 第 2 點）。
280   * colors：長度 54 的陣列，順序同 54 格字串，值可為任意可比較的顏色標籤（engine 用色號 0–5）。
281   * 以六個中心格的顏色決定「哪個顏色屬於哪一面」，並一併做合法性檢查。
282   * @returns {{ok:true, cube:Object, facelets:string}|{ok:false, error:string}}
283   */
284  function fromStickerColors(colors) {
285    if (!colors || colors.length !== 54) return { ok: false, error: 'LENGTH' };
286    var map = new Map();
287    for (var f = 0; f < 6; f++) {
288      var cc = colors[9 * f + 4];
289      if (map.has(cc)) return { ok: false, error: 'CENTER_DUPLICATE' };
290      map.set(cc, FACES[f]);
291    }
292    var s = '';
293    for (var i = 0; i < 54; i++) {
294      if (!map.has(colors[i])) return { ok: false, error: 'BAD_COLOR' };
295      s += map.get(colors[i]);
296    }
297    var r = faceletsToCubie(s);
298    if (r.error) return { ok: false, error: r.error };
299    var err = verify(r.cube);
300    if (err) return { ok: false, error: err };
301    return { ok: true, cube: r.cube, facelets: s };
302  }
303  
304  // 18 個轉動的 cubie 形式：由貼紙層級推導
305  var MOVE_CUBE = [];
306  (function () {
307    for (var m = 0; m < N_MOVES; m++) {
308      var r = faceletsToCubie(applyMoveFacelets(SOLVED_FACELETS, m));
309      if (r.error) throw new Error('twophase：轉動推導失敗 ' + MOVE_NAMES[m]);
310      MOVE_CUBE.push(r.cube);
311    }
312  })();
313  
314  /** 套用一個轉動（編號），回傳新物件 */
315  function applyMove(c, m) { return multiply(c, MOVE_CUBE[m]); }
316  /** 依序套用轉動編號陣列，回傳新物件（不修改輸入） */
317  function applyMoves(c, moves) {
318    var cur = copyCube(c), tmp = newCube();
319    for (var i = 0; i < moves.length; i++) {
320      cornerMul(cur, MOVE_CUBE[moves[i]], tmp); edgeMul(cur, MOVE_CUBE[moves[i]], tmp);
321      var t = cur; cur = tmp; tmp = t;
322    }
323    return cur;
324  }
325  /** 記號字串 → 轉動編號陣列；′ 接受 ' ’ ′ 三種寫法；只接受外層 18 個記號 */
326  function parseAlg(str) {
327    var out = [];
328    var toks = String(str).trim().split(/\s+/);
329    for (var i = 0; i < toks.length; i++) {
330      if (!toks[i]) continue;
331      var idx = MOVE_NAMES.indexOf(toks[i].replace(/[’′]/g, "'"));
332      if (idx < 0) throw new Error('twophase：無法解析轉動 ' + toks[i]);
333      out.push(idx);
334    }
335    return out;
336  }
337  /** 轉動編號陣列 → 記號字串陣列（ASCII '） */
338  function moveNames(moves) { return Array.prototype.map.call(moves, function (m) { return MOVE_NAMES[m]; }); }
339  /** 轉動編號陣列 → 以空白分隔的記號字串 */
340  function formatAlg(moves) { return moveNames(moves).join(' '); }
341  /** QTM 長度 */
342  function qtmLength(moves) {
343    var s = 0;
344    for (var i = 0; i < moves.length; i++) s += QTM_COST[moves[i]];
345    return s;
346  }
347  /** 反序列 */
348  function invertAlg(moves) {
349    var out = [];
350    for (var i = moves.length - 1; i >= 0; i--) {
351      var m = moves[i];
352      out.push(m - (m % 3) + (2 - (m % 3)));
353    }
354    return out;
355  }
356  
357  // ---------------------------------------------------------------------------
358  // 3. 可設 seed 的亂數（xorshift32，與 src/engine/rng.js 相同演算法；不使用內建亂數）與隨機狀態
359  // ---------------------------------------------------------------------------
360  /** 建立 xorshift32 亂數產生器；seed 為 0 時改用固定種子 0x9e3779b9 */
361  function makeRng(seed) {
362    var s = (seed >>> 0) || 0x9e3779b9;
363    return function () {
364      s ^= s << 13; s >>>= 0;
365      s ^= s >>> 17;
366      s ^= s << 5; s >>>= 0;
367      return s / 4294967296;
368    };
369  }
370  function randInt(rng, n) { return Math.floor(rng() * n); }
371  function shuffle(rng, arr) {
372    for (var i = arr.length - 1; i > 0; i--) {
373      var j = randInt(rng, i + 1);
374      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
375    }
376  }
377  /** 均勻隨機合法狀態（random-state）；亂數只來自傳入的 rng，呼叫次數與 spike 相同 */
378  function randomCube(rng) {
379    var c = newCube(), i, s = 0;
380    shuffle(rng, c.cp); shuffle(rng, c.ep);
381    if (permParity(c.cp, 8) !== permParity(c.ep, 12)) { var t = c.ep[0]; c.ep[0] = c.ep[1]; c.ep[1] = t; }
382    for (i = 0; i < 7; i++) { c.co[i] = randInt(rng, 3); s += c.co[i]; }
383    c.co[7] = (3 - s % 3) % 3;
384    s = 0;
385    for (i = 0; i < 11; i++) { c.eo[i] = randInt(rng, 2); s += c.eo[i]; }
386    c.eo[11] = s & 1;
387    return c;
388  }
389  
390  // ---------------------------------------------------------------------------
391  // 4. 座標
392  // ---------------------------------------------------------------------------
393  var N_TWIST = 2187, N_FLIP = 2048, N_SLICE = 495, N_PERM8 = 40320, N_PERM4 = 24;
394  var BINOM = [];
395  for (var bn = 0; bn <= 12; bn++) {
396    BINOM.push([]);
397    for (var bk = 0; bk <= 12; bk++) {
398      BINOM[bn].push(bk > bn ? 0 : (bk === 0 || bk === bn) ? 1 : BINOM[bn - 1][bk - 1] + BINOM[bn - 1][bk]);
399    }
400  }
401  function getTwist(c) { var t = 0; for (var i = 0; i < 7; i++) t = t * 3 + c.co[i]; return t; }
402  function setTwist(c, t) {
403    var s = 0;
404    for (var i = 6; i >= 0; i--) { c.co[i] = t % 3; s += c.co[i]; t = (t / 3) | 0; }
405    c.co[7] = (3 - s % 3) % 3;
406  }
407  function getFlip(c) { var t = 0; for (var i = 0; i < 11; i++) t = t * 2 + c.eo[i]; return t; }
408  function setFlip(c, t) {
409    var s = 0;
410    for (var i = 10; i >= 0; i--) { c.eo[i] = t & 1; s += c.eo[i]; t >>= 1; }
411    c.eo[11] = s & 1;
412  }
413  // 中層（UD-slice）四塊邊（編號 8..11）所在位置集合的組合編號 0..494
414  function getSlice(c) {
415    var r = 0, k = 0;
416    for (var i = 0; i < 12; i++) if (c.ep[i] >= 8) { k++; r += BINOM[i][k]; }
417    return r;
418  }
419  function setSlice(c, r) {
420    var occ = new Int8Array(12);
421    for (var k = 4; k >= 1; k--) {
422      var p = k - 1;
423      while (p + 1 <= 11 && BINOM[p + 1][k] <= r) p++;
424      r -= BINOM[p][k];
425      occ[p] = 1;
426    }
427    var a = 8, b = 0;
428    for (var i = 0; i < 12; i++) c.ep[i] = occ[i] ? a++ : b++;
429  }
430  // 排列的 Lehmer 編碼（arr[off..off+n-1]）
431  function permRank(arr, off, n) {
432    var r = 0;
433    for (var i = 0; i < n; i++) {
434      var cnt = 0, v = arr[off + i];
435      for (var j = i + 1; j < n; j++) if (arr[off + j] < v) cnt++;
436      r = r * (n - i) + cnt;
437    }
438    return r;
439  }
440  function permUnrank(r, arr, off, n, base) {
441    var digits = [], avail = [], i;
442    for (i = n - 1; i >= 0; i--) { digits[i] = r % (n - i); r = Math.floor(r / (n - i)); }
443    for (i = 0; i < n; i++) avail.push(base + i);
444    for (i = 0; i < n; i++) arr[off + i] = avail.splice(digits[i], 1)[0];
445  }
446  var SLICE_SOLVED = getSlice(newCube());
447  
448  // 第二階段可用的 10 個轉動：U U2 U' D D2 D' R2 L2 F2 B2
449  var P2_MOVES = [0, 1, 2, 9, 10, 11, 4, 13, 7, 16];
450  var IS_P2_MOVE = new Uint8Array(N_MOVES);
451  P2_MOVES.forEach(function (m) { IS_P2_MOVE[m] = 1; });
452  
453  // 冗餘剪枝：ALLOW[prev+1][m]；同面不連續；同軸（對面）只允許固定順序
454  var ALLOW = [];
455  (function () {
456    for (var pv = -1; pv < N_MOVES; pv++) {
457      var row = new Uint8Array(N_MOVES);
458      for (var m = 0; m < N_MOVES; m++) {
459        if (pv < 0) { row[m] = 1; continue; }
460        var f = (m / 3) | 0, pf = (pv / 3) | 0;
461        row[m] = (f === pf || (f % 3 === pf % 3 && f < pf)) ? 0 : 1;
462      }
463      ALLOW.push(row);
464    }
465  })();
466  
467  // ---------------------------------------------------------------------------
468  // 5. 移動表與剪枝表
469  // ---------------------------------------------------------------------------
470  // 模組內唯一的可變狀態：建好的表（建一次、之後唯讀；不影響求解結果的決定性）
471  var T = { twistMove: null, flipMove: null, sliceMove: null, cpMove: null, epMove: null, spMove: null, qtm: null };
472  
473  function buildMoveTables() {
474    var a = newCube(), b = newCube(), m, x, t;
475    var twistMove = new Uint16Array(N_TWIST * N_MOVES);
476    for (t = 0; t < N_TWIST; t++) {
477      setTwist(a, t);
478      for (m = 0; m < N_MOVES; m++) { cornerMul(a, MOVE_CUBE[m], b); twistMove[t * N_MOVES + m] = getTwist(b); }
479    }
480    var flipMove = new Uint16Array(N_FLIP * N_MOVES);
481    a = newCube();
482    for (t = 0; t < N_FLIP; t++) {
483      setFlip(a, t);
484      for (m = 0; m < N_MOVES; m++) { edgeMul(a, MOVE_CUBE[m], b); flipMove[t * N_MOVES + m] = getFlip(b); }
485    }
486    var sliceMove = new Uint16Array(N_SLICE * N_MOVES);
487    a = newCube();
488    for (t = 0; t < N_SLICE; t++) {
489      setSlice(a, t);
490      for (m = 0; m < N_MOVES; m++) { edgeMul(a, MOVE_CUBE[m], b); sliceMove[t * N_MOVES + m] = getSlice(b); }
491    }
492    var cpMove = new Uint16Array(N_PERM8 * N_MOVES);
493    a = newCube();
494    for (t = 0; t < N_PERM8; t++) {
495      permUnrank(t, a.cp, 0, 8, 0);
496      for (m = 0; m < N_MOVES; m++) { cornerMul(a, MOVE_CUBE[m], b); cpMove[t * N_MOVES + m] = permRank(b.cp, 0, 8); }
497    }
498    var epMove = new Uint16Array(N_PERM8 * 10);
499    a = newCube();
500    for (t = 0; t < N_PERM8; t++) {
501      permUnrank(t, a.ep, 0, 8, 0);
502      for (x = 0; x < 10; x++) { edgeMul(a, MOVE_CUBE[P2_MOVES[x]], b); epMove[t * 10 + x] = permRank(b.ep, 0, 8); }
503    }
504    var spMove = new Uint8Array(N_PERM4 * 10);
505    a = newCube();
506    for (t = 0; t < N_PERM4; t++) {
507      permUnrank(t, a.ep, 8, 4, 8);
508      for (x = 0; x < 10; x++) { edgeMul(a, MOVE_CUBE[P2_MOVES[x]], b); spMove[t * 10 + x] = permRank(b.ep, 8, 4); }
509    }
510    T.twistMove = twistMove; T.flipMove = flipMove; T.sliceMove = sliceMove;
511    T.cpMove = cpMove; T.epMove = epMove; T.spMove = spMove;
512  }
513  
514  /**
515   * 加權 BFS（成本 1 或 2）建剪枝表。表索引 = a*n2 + b。
516   * mv1/mv2：移動表；s1/s2：該表每列欄數；cols1/cols2：第 k 個轉動在該表的欄位；cost[k]：成本。
517   */
518  function buildPrune(n1, n2, mv1, s1, cols1, mv2, s2, cols2, cost, start) {
519    var total = n1 * n2;
520    var tab = new Int8Array(total).fill(-1);
521    var nk = cols1.length;
522    tab[start] = 0;
523    var filled = 1, depth = 0;
524    while (filled < total) {
525      var changed = false;
526      for (var a = 0; a < n1; a++) {
527        var base = a * n2;
528        for (var b = 0; b < n2; b++) {
529          if (tab[base + b] !== depth) continue;
530          for (var k = 0; k < nk; k++) {
531            var j = mv1[a * s1 + cols1[k]] * n2 + mv2[b * s2 + cols2[k]];
532            var nd = depth + cost[k];
533            var cur = tab[j];
534            if (cur === -1) { tab[j] = nd; filled++; changed = true; }
535            else if (cur > nd) { tab[j] = nd; changed = true; }
536          }
537        }
538      }
539      depth++;
540      if (!changed && depth > 40) throw new Error('twophase：剪枝表無法填滿');
541    }
542    return tab;
543  }
544  
545  function seq(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
546  
547  // init 的進度標籤（順序固定，game-spec.md §7.2）
548  var PROGRESS_LABELS = ['moveTables', 'p1TS', 'p1FS', 'p2CS', 'p2ES', 'p1TF'];
549  
550  function checkInitOptions(options) {
551    var o = options || {};
552    var metrics = o.metrics === undefined ? ['qtm'] : o.metrics;
553    if (!Array.isArray(metrics) || metrics.length !== 1 || metrics[0] !== 'qtm') {
554      throw new Error('twophase.init：只支援 metrics:[\'qtm\']');
555    }
556    if (o.twistFlip !== undefined && o.twistFlip !== true) {
557      throw new Error('twophase.init：只支援 twistFlip:true');
558    }
559    if (o.cornerTable !== undefined && o.cornerTable !== false) {
560      throw new Error('twophase.init：只支援 cornerTable:false（v0.1 不做最少步搜尋）');
561    }
562  }
563  
564  /**
565   * 建表（只建 QTM 成本所需的表）。重複呼叫不會重建，但仍會依序回報 6 次進度。
566   * @param {{metrics?:string[], twistFlip?:boolean, cornerTable?:boolean}} [options] - 只接受 {metrics:['qtm'], twistFlip:true, cornerTable:false}
567   * @param {(step:number, total:number, label:string) => void} [onProgress] - 每完成一步呼叫一次；label 依序為
568   *   'moveTables','p1TS','p1FS','p2CS','p2ES','p1TF'，total 為 6
569   * @returns {{moveBytes:number, pruneBytes:number, totalBytes:number}} 同 tableInfo()
570   */
571  function init(options, onProgress) {
572    checkInitOptions(options);
573    var total = PROGRESS_LABELS.length;
574    var step = 0;
575    function report() {
576      step++;
577      if (typeof onProgress === 'function') onProgress(step, total, PROGRESS_LABELS[step - 1]);
578    }
579    if (!T.twistMove) buildMoveTables();
580    report();
581    var M = T.qtm || { cost: QTM_COST, p1TS: null, p1FS: null, p2CS: null, p2ES: null, p1TF: null };
582    var all18 = seq(N_MOVES), p2idx = seq(10);
583    var cost18 = Array.prototype.slice.call(QTM_COST);
584    var cost10 = P2_MOVES.map(function (m) { return QTM_COST[m]; });
585    if (!M.p1TS) M.p1TS = buildPrune(N_TWIST, N_SLICE, T.twistMove, N_MOVES, all18, T.sliceMove, N_MOVES, all18, cost18, SLICE_SOLVED);
586    report();
587    if (!M.p1FS) M.p1FS = buildPrune(N_FLIP, N_SLICE, T.flipMove, N_MOVES, all18, T.sliceMove, N_MOVES, all18, cost18, SLICE_SOLVED);
588    report();
589    if (!M.p2CS) M.p2CS = buildPrune(N_PERM8, N_PERM4, T.cpMove, N_MOVES, P2_MOVES, T.spMove, 10, p2idx, cost10, 0);
590    report();
591    if (!M.p2ES) M.p2ES = buildPrune(N_PERM8, N_PERM4, T.epMove, 10, p2idx, T.spMove, 10, p2idx, cost10, 0);
592    report();
593    if (!M.p1TF) M.p1TF = buildPrune(N_TWIST, N_FLIP, T.twistMove, N_MOVES, all18, T.flipMove, N_MOVES, all18, cost18, 0);
594    T.qtm = M;
595    report();
596    return tableInfo();
597  }
598  
599  /**
600   * 已建立的型別陣列大小（bytes）。尚未 init 時各欄為 0。
601   * @returns {{moveBytes:number, pruneBytes:number, totalBytes:number}}
602   */
603  function tableInfo() {
604    var moveBytes = 0, pruneBytes = 0;
605    ['twistMove', 'flipMove', 'sliceMove', 'cpMove', 'epMove', 'spMove'].forEach(function (k) {
606      if (T[k]) moveBytes += T[k].byteLength;
607    });
608    if (T.qtm) {
609      ['p1TS', 'p1FS', 'p1TF', 'p2CS', 'p2ES'].forEach(function (k) {
610        if (T.qtm[k]) pruneBytes += T.qtm[k].byteLength;
611      });
612    }
613    return { moveBytes: moveBytes, pruneBytes: pruneBytes, totalBytes: moveBytes + pruneBytes };
614  }
615  
616  function isReady() {
617    return !!(T.qtm && T.qtm.p1TS && T.qtm.p1FS && T.qtm.p1TF && T.qtm.p2CS && T.qtm.p2ES);
618  }
619  
620  // ---------------------------------------------------------------------------
621  // 6. 兩階段搜尋（只以節點數停止）
622  // ---------------------------------------------------------------------------
623  
624  function pickLimit(v, dflt) {
625    return (typeof v === 'number' && v >= 0) ? v : dflt;
626  }
627  
628  /**
629   * 一輪兩階段 IDA* 搜尋（第二階段深度上限 p2cap）。
630   * nodeStart：本輪開始時已累計的節點數（phase2Cap 重搜時延續計數，使 nodeLimit 為整次求解的累計值）。
631   * 回傳 {moves|null, nodes, aborted, firstNodes}
632   */
633  function searchOnce(cube, cfg, p2cap, nodeStart) {
634    var M = T.qtm;
635    var cost = QTM_COST;
636    var maxLength = cfg.maxLength;
637    var nodeLimit = cfg.nodeLimit, firstNodeLimit = cfg.firstNodeLimit;
638    var p1TS = M.p1TS, p1FS = M.p1FS, p1TF = M.p1TF, p2CS = M.p2CS, p2ES = M.p2ES;
639    var twistMove = T.twistMove, flipMove = T.flipMove, sliceMove = T.sliceMove;
640    var cpMove = T.cpMove, epMove = T.epMove, spMove = T.spMove;
641  
642    var best = maxLength + 1, bestMoves = null, firstNodes = -1;
643    var nodes = nodeStart, aborted = false;
644    var path1 = new Int8Array(64), path2 = new Int8Array(64), p2len = 0;
645    var work = newCube(), tmp = newCube();
646  
647    // 停止條件（每 CHECK_MASK+1 個節點檢查一次）：
648    //   尚未找到解：累計節點 > firstNodeLimit → 中止（呼叫端回 NODE_LIMIT）
649    //   已找到解：累計節點 > nodeLimit → 中止，回傳目前最佳解
650    function shouldStop() {
651      if (bestMoves === null) return nodes > firstNodeLimit;
652      return nodes > nodeLimit;
653    }
654  
655    function p2(cp, ep, sp, g, bound, k, prev) {
656      if ((++nodes & CHECK_MASK) === 0 && shouldStop()) { aborted = true; return false; }
657      var h = p2CS[cp * 24 + sp], h2 = p2ES[ep * 24 + sp];
658      if (h2 > h) h = h2;
659      if (h === 0) { p2len = k; return true; }
660      if (h > bound - g) return false;
661      var allow = ALLOW[prev + 1];
662      for (var x = 0; x < 10; x++) {
663        var m = P2_MOVES[x];
664        if (!allow[m]) continue;
665        var ng = g + cost[m];
666        if (ng > bound) continue;
667        path2[k] = m;
668        if (p2(cpMove[cp * 18 + m], epMove[ep * 10 + x], spMove[sp * 10 + x], ng, bound, k + 1, m)) return true;
669        if (aborted) return false;
670      }
671      return false;
672    }
673  
674    function tryPhase2(g, n) {
675      copyCube(cube, work);
676      for (var i = 0; i < n; i++) {
677        cornerMul(work, MOVE_CUBE[path1[i]], tmp); edgeMul(work, MOVE_CUBE[path1[i]], tmp);
678        var t = work; work = tmp; tmp = t;
679      }
680      var cp = permRank(work.cp, 0, 8), ep = permRank(work.ep, 0, 8), sp = permRank(work.ep, 8, 4);
681      var budget = Math.min(best - 1 - g, p2cap);
682      var h = p2CS[cp * 24 + sp], h2 = p2ES[ep * 24 + sp];
683      if (h2 > h) h = h2;
684      if (h > budget) return;
685      var prev = n > 0 ? path1[n - 1] : -1;
686      for (var b = h; b <= budget; b++) {
687        if (p2(cp, ep, sp, 0, b, 0, prev)) {
688          var moves = [];
689          for (var a = 0; a < n; a++) moves.push(path1[a]);
690          for (var c = 0; c < p2len; c++) moves.push(path2[c]);
691          var len = qtmLength(moves);
692          if (len < best) {
693            if (bestMoves === null) firstNodes = nodes;
694            best = len; bestMoves = moves;
695          }
696          return;
697        }
698        if (aborted) return;
699      }
700    }
701  
702    function p1(tw, fl, sl, g, bound, n) {
703      if ((++nodes & CHECK_MASK) === 0 && shouldStop()) { aborted = true; return; }
704      var h = p1TS[tw * 495 + sl], hh = p1FS[fl * 495 + sl];
705      if (hh > h) h = hh;
706      hh = p1TF[tw * 2048 + fl];
707      if (hh > h) h = hh;
708      if (h > bound - g) return;
709      if (g === bound) {
710        // 已進入 G1；最後一步若本身是 G1 轉動，代表有更短的第一階段，略過
711        if (n > 0 && IS_P2_MOVE[path1[n - 1]]) return;
712        tryPhase2(g, n);
713        return;
714      }
715      var allow = ALLOW[n > 0 ? path1[n - 1] + 1 : 0];
716      for (var m = 0; m < 18; m++) {
717        if (!allow[m]) continue;
718        var ng = g + cost[m];
719        if (ng > bound) continue;
720        path1[n] = m;
721        p1(twistMove[tw * 18 + m], flipMove[fl * 18 + m], sliceMove[sl * 18 + m], ng, bound, n + 1);
722        if (aborted || bound >= best) return;
723      }
724    }
725  
726    var tw0 = getTwist(cube), fl0 = getFlip(cube), sl0 = getSlice(cube);
727    var h0 = Math.max(p1TS[tw0 * 495 + sl0], p1FS[fl0 * 495 + sl0], p1TF[tw0 * 2048 + fl0]);
728    for (var bound = h0; bound < best && bound <= maxLength; bound++) {
729      p1(tw0, fl0, sl0, 0, bound, 0);
730      if (aborted) break;
731    }
732    return { moves: bestMoves, nodes: nodes, aborted: aborted, firstNodes: firstNodes };
733  }
734  
735  /**
736   * 以 QTM 成本求建議解（不保證最少步；畫面只能稱「建議解」）。
737   * 純函數：不讀時鐘、不用亂數；同一狀態＋同一 opts 必得同一結果（需先 init）。
738   *
739   * @param {Object} cube - cubie 狀態 {cp, co, ep, eo}（不會被修改）
740   * @param {Object} [opts]
741   * @param {string} [opts.metric='qtm'] - 只支援 'qtm'
742   * @param {number} [opts.nodeLimit] - 整次求解累計節點上限（含找到第一組解之前）；找到第一組解後超過即停，回傳目前最佳解
743   * @param {number} [opts.firstNodeLimit] - 找到第一組解之前的節點上限；超過回 {error:'NODE_LIMIT'}
744   * @param {number} [opts.maxLength] - 可接受的最長解（QTM）
745   * @param {number} [opts.phase2Cap] - 第二階段深度上限；因此無解時自動以 36 重搜
746   *   （以上四個數值未傳時使用 DEFAULT_SOLVE_OPTS；正式呼叫端應傳入 params.solver）
747   * @returns {{moves:number[], names:string[], alg:string, qtm:number, nodes:number, complete:boolean,
748   *            firstNodes:number, fallback:boolean} | {error:string, nodes:number}}
749   *   complete=true 表示在 maxLength 內已窮盡兩階段搜尋（不代表全域最少步）。
750   *   error：verify() 的錯誤碼、'NODE_LIMIT'、'NO_SOLUTION'、'UNSUPPORTED_METRIC'、'NOT_INITIALIZED'
751   */
752  function solve(cube, opts) {
753    opts = opts || {};
754    var metric = opts.metric === undefined ? DEFAULT_SOLVE_OPTS.metric : opts.metric;
755    if (metric !== 'qtm') return { error: 'UNSUPPORTED_METRIC', nodes: 0 };
756    if (!isReady()) return { error: 'NOT_INITIALIZED', nodes: 0 };
757    var err = verify(cube);
758    if (err) return { error: err, nodes: 0 };
759    var cfg = {
760      nodeLimit: pickLimit(opts.nodeLimit, DEFAULT_SOLVE_OPTS.nodeLimit),
761      firstNodeLimit: pickLimit(opts.firstNodeLimit, DEFAULT_SOLVE_OPTS.firstNodeLimit),
762      maxLength: pickLimit(opts.maxLength, DEFAULT_SOLVE_OPTS.maxLength)
763    };
764    var p2cap = pickLimit(opts.phase2Cap, DEFAULT_SOLVE_OPTS.phase2Cap);
765  
766    var r = searchOnce(cube, cfg, p2cap, 0);
767    var fallback = false;
768    // 第二階段上限太小導致無解（且不是因節點上限中止）→ 以理論上限重搜，節點數延續累計
769    if (!r.moves && !r.aborted && p2cap < PHASE2_FULL) {
770      r = searchOnce(cube, cfg, PHASE2_FULL, r.nodes);
771      fallback = true;
772    }
773    if (!r.moves) return { error: r.aborted ? 'NODE_LIMIT' : 'NO_SOLUTION', nodes: r.nodes };
774    var names = moveNames(r.moves);
775    return {
776      moves: r.moves,
777      names: names,
778      alg: names.join(' '),
779      qtm: qtmLength(r.moves),
780      nodes: r.nodes,
781      complete: !r.aborted,
782      firstNodes: r.firstNodes,
783      fallback: fallback
784    };
785  }
786  
787  module.exports = {
788    // game-spec.md §7.2 介面
789    init: init,
790    tableInfo: tableInfo,
791    solve: solve,
792    fromStickerColors: fromStickerColors,
793    // 分派單 S4 指定的附加匯出（測試與層先法對照用）
794    verify: verify,
795    faceletsToCubie: faceletsToCubie,
796    cubieToFacelets: cubieToFacelets,
797    applyMoveFacelets: applyMoveFacelets,
798    applyMoves: applyMoves,
799    isSolved: isSolved,
800    newCube: newCube,
801    randomCube: randomCube,
802    makeRng: makeRng,
803    MOVE_NAMES: MOVE_NAMES,
804    qtmLength: qtmLength,
805    // 其他輔助（測試用）
806    DEFAULT_SOLVE_OPTS: DEFAULT_SOLVE_OPTS,
807    PROGRESS_LABELS: PROGRESS_LABELS,
808    FACES: FACES,
809    SOLVED_FACELETS: SOLVED_FACELETS,
810    CORNER_NAMES: CORNER_NAMES,
811    EDGE_NAMES: EDGE_NAMES,
812    QTM_COST: QTM_COST,
813    MOVE_CUBE: MOVE_CUBE,
814    applyMove: applyMove,
815    multiply: multiply,
816    copyCube: copyCube,
817    cubeEquals: cubeEquals,
818    parseAlg: parseAlg,
819    formatAlg: formatAlg,
820    invertAlg: invertAlg,
821    isReady: isReady
822  };
```

### 3.2 `src/solver/lbl.js`（新增，761 行）

```js
  1  // src/solver/lbl.js — 層先法（初學者法）分段產生器
  2  //
  3  // 依據：game-spec.md §8（全部）、§7.2（介面）、§9.5（錯誤碼）；資料：src/data/lbl.json。
  4  //
  5  // 做法：在產生器內部的虛擬方塊（54 格貼紙色號）上，依 8 個分段的規則逐一
  6  // 「看狀態 → 選公式 → 套用」，套用的每個記號都記下來並分成 segments／parts。
  7  //
  8  // 設計原則（CLAUDE.md §3）：
  9  //   - 純函數：不讀時間、不用亂數、不碰瀏覽器 API；同輸入必得同輸出（T-LBL-06）。
 10  //   - 幾何與轉動一律呼叫 src/engine/cube.js（分派單 X-2），本檔不另寫轉動表。
 11  //   - 公式記號、首層顏色、頭燈面、迴圈上限都從 config（lbl.json）讀取，不寫死。
 12  //   - 每個迴圈都有上限（config.guards），超過回 {error:'LBL_STUCK'}，不會無窮迴圈。
 13  //   - 不 require twophase.js（分派單 X-4）。
 14  'use strict';
 15  
 16  var cube = require('../engine/cube.js');
 17  
 18  // ---------------------------------------------------------------------------
 19  // 1. 常數：分段順序、面序、塊的貼紙位置
 20  // ---------------------------------------------------------------------------
 21  
 22  // 8 段固定順序（§8.3）；config.segments 必須與此相同。
 23  var SEGMENT_IDS = ['hold', 'cross', 'corners', 'middle',
 24    'yellowCross', 'yellowFace', 'yellowCorners', 'yellowEdges'];
 25  
 26  // 產生器用到的公式 id（§8.4）；config.formulas 必須全部提供。
 27  var FORMULA_IDS = ['crossDown', 'crossFlip', 'cornerDrop', 'cornerInsert',
 28    'edgeRight', 'edgeLeft', 'edgeKickOut', 'yellowCross', 'sune', 'aPerm', 'uPerm'];
 29  
 30  // 迴圈上限的鍵（§10.4 guards）。
 31  var GUARD_KEYS = ['cross', 'corners', 'cornerInsert', 'middle',
 32    'yellowCross', 'sune', 'aPerm', 'uPerm'];
 33  
 34  // 面序 U R F D L B（§1.1）；貼紙索引 ＝ 9 × 面序 ＋ (列 × 3 ＋ 欄)。
 35  var FACES = 'URFDLB';
 36  var SIDE_FACES = ['F', 'R', 'B', 'L'];
 37  var HEADLIGHT_FACES = SIDE_FACES;
 38  
 39  function faceBase(face) {
 40    return 9 * FACES.indexOf(face);
 41  }
 42  
 43  function centerIndex(face) {
 44    return faceBase(face) + 4;
 45  }
 46  
 47  // 各面的法向量取自 engine 的中心貼紙法向量（不另寫幾何）。
 48  function faceNormal(face) {
 49    return cube.STICKER_NRM[centerIndex(face)];
 50  }
 51  
 52  function sameVec(a, b) {
 53    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
 54  }
 55  
 56  // 以 engine 的貼紙位置表，找出「位於 pos、朝向 face」的貼紙索引。
 57  function stickerAt(pos, face) {
 58    var n = faceNormal(face);
 59    for (var i = 0; i < 54; i++) {
 60      if (sameVec(cube.STICKER_POS[i], pos) && sameVec(cube.STICKER_NRM[i], n)) return i;
 61    }
 62    throw new Error('lbl: 找不到貼紙 ' + face);
 63  }
 64  
 65  // 塊的位置名稱 → 各字母對應面上的貼紙索引（順序與名稱字母相同）。
 66  function pieceStickers(name) {
 67    var pos = [0, 0, 0];
 68    for (var k = 0; k < name.length; k++) {
 69      var n = faceNormal(name.charAt(k));
 70      pos = [pos[0] + n[0], pos[1] + n[1], pos[2] + n[2]];
 71    }
 72    return name.split('').map(function (face) { return stickerAt(pos, face); });
 73  }
 74  
 75  var EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
 76  var CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
 77  
 78  var EDGE_STICKERS = {};
 79  EDGE_NAMES.forEach(function (nm) { EDGE_STICKERS[nm] = pieceStickers(nm); });
 80  var CORNER_STICKERS = {};
 81  CORNER_NAMES.forEach(function (nm) { CORNER_STICKERS[nm] = pieceStickers(nm); });
 82  
 83  var TOP_EDGE_SLOTS = ['UF', 'UR', 'UB', 'UL'];      // middle 段找頂層邊塊的順序
 84  var MIDDLE_SLOTS = ['FR', 'FL', 'BL', 'BR'];        // middle 段找卡住邊塊的順序
 85  var CORNER_TARGET_PAIRS = [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']];
 86  
 87  // U 面的邊格與角格（U 面「右」＝+x、「下」＝+z，所以第 0 列在後面）。
 88  var U_EDGE_CELLS = [1, 3, 5, 7];           // UB、UL、UR、UF 的 U 面貼紙
 89  var U_CORNER_CELLS = [0, 2, 6, 8];         // ULB、UBR、UFL、URF 的 U 面貼紙
 90  var U_BACK_EDGE = 1;
 91  var U_LEFT_EDGE = 3;
 92  var U_RIGHT_EDGE = 5;
 93  var U_FRONT_EDGE = 7;
 94  var U_FRONT_LEFT_CORNER = 6;
 95  // UFL 角在 L 面上的貼紙（L 面第 3 格；§8.4 yellowFace 規則）。
 96  var L_FRONT_TOP = CORNER_STICKERS.UFL[2];
 97  // F 面左上角（yellowCorners 最後的 U 對齊用）。
 98  var F_TOP_LEFT = faceBase('F');
 99  
100  // 整顆旋轉：hold 段依白色中心所在面決定（§8.4）。
101  var HOLD_ROTATION = { U: null, F: 'x', B: "x'", R: "z'", L: 'z', D: 'x2' };
102  
103  // ---------------------------------------------------------------------------
104  // 2. 錯誤與小工具
105  // ---------------------------------------------------------------------------
106  
107  // 產生器內部以例外中止，最外層轉成 {error}。
108  function LblError(code, detail) {
109    this.code = code;
110    this.detail = detail;
111  }
112  
113  function fail(code, detail) {
114    throw new LblError(code, detail);
115  }
116  
117  // 轉動 n 次（0–3）對應的記號：0 → 不輸出、1 → X、2 → X2、3 → X'。
118  function turnTokens(base, n) {
119    if (n === 0) return [];
120    if (n === 1) return [base];
121    if (n === 2) return [base + '2'];
122    return [base + "'"];
123  }
124  
125  // 記號的「轉動量」（1、2、3 個 90°）；用於合併相鄰同字母整顆旋轉。
126  function quarterCount(token) {
127    if (token.length === 1) return 1;
128    return token.charAt(1) === '2' ? 2 : 3;
129  }
130  
131  // 合併相鄰的同字母整顆旋轉：y y' → 消掉；y y → y2；y2 y → y'（§8.1、T-LBL-07）。
132  function mergeRotations(tokens) {
133    var out = [];
134    tokens.forEach(function (t) {
135      var last = out.length ? out[out.length - 1] : null;
136      if (last !== null && last.charAt(0) === t.charAt(0)) {
137        out.pop();
138        var q = (quarterCount(last) + quarterCount(t)) % 4;
139        out.push.apply(out, turnTokens(t.charAt(0), q));
140      } else {
141        out.push(t);
142      }
143    });
144    return out;
145  }
146  
147  function sumQtm(tokens, from, to) {
148    var s = 0;
149    for (var i = from; i < to; i++) s += cube.qtmCost(tokens[i]);
150    return s;
151  }
152  
153  // ---------------------------------------------------------------------------
154  // 3. 讀取方塊狀態的純函數（輸入 54 格色號）
155  // ---------------------------------------------------------------------------
156  
157  function centerColor(st, face) {
158    return st[centerIndex(face)];
159  }
160  
161  function faceOfColor(st, color) {
162    for (var f = 0; f < 6; f++) {
163      if (st[9 * f + 4] === color) return FACES.charAt(f);
164    }
165    return null;
166  }
167  
168  // 找邊塊 {c1, c2}：回傳所在位置名稱與方向（flip 0 ＝ c1 在名稱第一個字母的面上）。
169  function locateEdge(st, c1, c2) {
170    for (var k = 0; k < EDGE_NAMES.length; k++) {
171      var s = EDGE_STICKERS[EDGE_NAMES[k]];
172      if (st[s[0]] === c1 && st[s[1]] === c2) return { slot: EDGE_NAMES[k], flip: 0 };
173      if (st[s[0]] === c2 && st[s[1]] === c1) return { slot: EDGE_NAMES[k], flip: 1 };
174    }
175    return null;
176  }
177  
178  // 找角塊（三色 colors，第一色為首層顏色）：回傳位置名稱與扭轉（首色在第幾個貼紙）。
179  function locateCorner(st, colors) {
180    for (var k = 0; k < CORNER_NAMES.length; k++) {
181      var s = CORNER_STICKERS[CORNER_NAMES[k]];
182      var have = [st[s[0]], st[s[1]], st[s[2]]];
183      if (colors.every(function (c) { return have.indexOf(c) !== -1; })) {
184        return { slot: CORNER_NAMES[k], twist: have.indexOf(colors[0]) };
185      }
186    }
187    return null;
188  }
189  
190  // 該位置上的塊是否「每個貼紙都與所在面中心同色」（已歸位且方向正確）。
191  function pieceSolved(st, stickers, name) {
192    for (var k = 0; k < name.length; k++) {
193      if (st[stickers[k]] !== centerColor(st, name.charAt(k))) return false;
194    }
195    return true;
196  }
197  
198  function edgeSolved(st, slot) {
199    return pieceSolved(st, EDGE_STICKERS[slot], slot);
200  }
201  
202  function cornerSolved(st, slot) {
203    return pieceSolved(st, CORNER_STICKERS[slot], slot);
204  }
205  
206  // 某面整面都是 color。
207  function faceAll(st, face, color) {
208    var b = faceBase(face);
209    for (var k = 0; k < 9; k++) if (st[b + k] !== color) return false;
210    return true;
211  }
212  
213  // 側面第 row 列（0 上、1 中、2 下）是否全與中心同色。
214  function sideRowSolved(st, face, row) {
215    var b = faceBase(face);
216    var c = st[b + 4];
217    return st[b + 3 * row] === c && st[b + 3 * row + 1] === c && st[b + 3 * row + 2] === c;
218  }
219  
220  // 前兩層完成（白色朝下）：D 面全為首層色、四個側面第 1、2 列與中心同色。
221  function firstTwoLayersDown(st, w) {
222    if (!faceAll(st, 'D', w)) return false;
223    return SIDE_FACES.every(function (f) {
224      return sideRowSolved(st, f, 1) && sideRowSolved(st, f, 2);
225    });
226  }
227  
228  function uEdgesAre(st, color) {
229    var b = faceBase('U');
230    return U_EDGE_CELLS.every(function (k) { return st[b + k] === color; });
231  }
232  
233  // 頭燈：側面上排左右兩角同色。
234  function headlightFaces(st) {
235    return SIDE_FACES.filter(function (f) {
236      var b = faceBase(f);
237      return st[b] === st[b + 2];
238    });
239  }
240  
241  function topEdgeOk(st, face) {
242    var b = faceBase(face);
243    return st[b + 1] === st[b + 4];
244  }
245  
246  // ---------------------------------------------------------------------------
247  // 4. 各段完成判定（§8.3；T-LBL-08 使用）
248  //    每個函式：(stickers54, config) → boolean；只看傳入狀態，不看產生過程。
249  // ---------------------------------------------------------------------------
250  
251  function holdDone(st, config) {
252    return centerColor(st, 'U') === config.firstLayerColor;
253  }
254  
255  function crossDone(st, config) {
256    if (!holdDone(st, config)) return false;
257    return TOP_EDGE_SLOTS.every(function (slot) { return edgeSolved(st, slot); });
258  }
259  
260  function cornersDone(st, config) {
261    if (!crossDone(st, config)) return false;
262    if (!faceAll(st, 'U', config.firstLayerColor)) return false;
263    return SIDE_FACES.every(function (f) { return sideRowSolved(st, f, 0); });
264  }
265  
266  function middleDone(st, config) {
267    if (centerColor(st, 'D') !== config.firstLayerColor) return false;
268    return firstTwoLayersDown(st, config.firstLayerColor);
269  }
270  
271  function yellowCrossDone(st, config) {
272    return middleDone(st, config) && uEdgesAre(st, centerColor(st, 'U'));
273  }
274  
275  function yellowFaceDone(st, config) {
276    return middleDone(st, config) && faceAll(st, 'U', centerColor(st, 'U'));
277  }
278  
279  function yellowCornersDone(st, config) {
280    if (!yellowFaceDone(st, config)) return false;
281    return SIDE_FACES.every(function (f) {
282      var b = faceBase(f);
283      return st[b] === st[b + 4] && st[b + 2] === st[b + 4];
284    });
285  }
286  
287  function yellowEdgesDone(st) {
288    return cube.isSolved(st);
289  }
290  
291  var STAGE_CHECKS = {
292    hold: holdDone,
293    cross: crossDone,
294    corners: cornersDone,
295    middle: middleDone,
296    yellowCross: yellowCrossDone,
297    yellowFace: yellowFaceDone,
298    yellowCorners: yellowCornersDone,
299    yellowEdges: yellowEdgesDone
300  };
301  
302  // ---------------------------------------------------------------------------
303  // 5. 輸入與設定檢查
304  // ---------------------------------------------------------------------------
305  
306  function checkStickers(view) {
307    if (!Array.isArray(view) || view.length !== 54) fail('INVALID_STATE', 'LENGTH');
308    var count = [0, 0, 0, 0, 0, 0];
309    for (var i = 0; i < 54; i++) {
310      var c = view[i];
311      if (!(Number.isInteger(c) && c >= 0 && c < 6)) fail('INVALID_STATE', 'BAD_COLOR');
312      count[c]++;
313    }
314    if (count.some(function (n) { return n !== 9; })) fail('INVALID_STATE', 'BAD_COLOR');
315    var seen = {};
316    for (var f = 0; f < 6; f++) {
317      var cc = view[9 * f + 4];
318      if (seen[cc]) fail('INVALID_STATE', 'CENTER_DUPLICATE');
319      seen[cc] = true;
320    }
321  }
322  
323  function isPositiveInt(n) {
324    return Number.isInteger(n) && n > 0;
325  }
326  
327  // 讀出產生器需要的設定；格式不符回 BAD_REQUEST。
328  function readConfig(config) {
329    if (!config || typeof config !== 'object') fail('BAD_REQUEST', 'config');
330    var fl = config.firstLayerColor;
331    if (!(Number.isInteger(fl) && fl >= 0 && fl < 6)) fail('BAD_REQUEST', 'firstLayerColor');
332    if (!Array.isArray(config.segments) || config.segments.join(',') !== SEGMENT_IDS.join(',')) {
333      fail('BAD_REQUEST', 'segments');
334    }
335    if (HEADLIGHT_FACES.indexOf(config.headlightFace) === -1) fail('BAD_REQUEST', 'headlightFace');
336    var guards = config.guards;
337    if (!guards || typeof guards !== 'object') fail('BAD_REQUEST', 'guards');
338    GUARD_KEYS.forEach(function (key) {
339      if (!isPositiveInt(guards[key])) fail('BAD_REQUEST', 'guards.' + key);
340    });
341    var algs = {};
342    FORMULA_IDS.forEach(function (id) {
343      var f = config.formulas && config.formulas[id];
344      if (!f || typeof f.alg !== 'string') fail('BAD_REQUEST', 'formulas.' + id);
345      var moves;
346      try {
347        moves = cube.parseMoves(f.alg);
348      } catch (e) {
349        fail('BAD_REQUEST', 'formulas.' + id);
350      }
351      if (moves.length === 0) fail('BAD_REQUEST', 'formulas.' + id);
352      algs[id] = moves;
353    });
354    return {
355      firstLayerColor: fl,
356      headlightFace: config.headlightFace,
357      guards: guards,
358      algs: algs
359    };
360  }
361  
362  // ---------------------------------------------------------------------------
363  // 6. 產生器本體
364  // ---------------------------------------------------------------------------
365  
366  function newLoopStats() {
367    var s = {};
368    GUARD_KEYS.forEach(function (k) { s[k] = 0; });
369    return s;
370  }
371  
372  function runGenerator(view, config) {
373    checkStickers(view);
374    var cfg = readConfig(config);
375    var W = cfg.firstLayerColor;
376    var guards = cfg.guards;
377    var algs = cfg.algs;
378  
379    var st = view.slice();       // 虛擬方塊（目前的 view 狀態）
380    var tokens = [];
381    var segments = [];
382    var seg = null;
383    var loops = newLoopStats();  // 本局各迴圈的實際次數（每段／每角取最大）
384  
385    function applyToken(t) {
386      st = cube.applyMove(st, t);
387      tokens.push(t);
388    }
389  
390    // 輸出一組記號成為一個 part。
391    //   rotate：若上一個 part 也是 rotate 且緊接在後，併進同一個 part 再合併同字母旋轉。
392    //   setup：每個記號各自成一個 part（§8.2「單一轉動」）。
393    //   formula：整條公式一個 part。
394    function emit(list, kind, formulaId) {
395      if (list.length === 0) return;
396      if (kind === 'setup') {
397        list.forEach(function (t) {
398          var start = tokens.length;
399          applyToken(t);
400          seg.parts.push({ start: start, end: tokens.length, kind: 'setup', formula: null });
401        });
402        return;
403      }
404      if (kind === 'rotate') {
405        var last = seg.parts.length ? seg.parts[seg.parts.length - 1] : null;
406        var start = tokens.length;
407        list.forEach(applyToken);
408        if (last && last.kind === 'rotate' && last.end === start) {
409          // 狀態已照原記號套用；合併只改寫記號，不改變結果（同字母旋轉可交換合併）。
410          var merged = mergeRotations(tokens.slice(last.start));
411          tokens.length = last.start;
412          merged.forEach(function (t) { tokens.push(t); });
413          last.end = tokens.length;
414          if (last.end === last.start) seg.parts.pop();
415        } else {
416          var mergedNew = mergeRotations(tokens.slice(start));
417          tokens.length = start;
418          mergedNew.forEach(function (t) { tokens.push(t); });
419          if (tokens.length > start) {
420            seg.parts.push({ start: start, end: tokens.length, kind: 'rotate', formula: null });
421          }
422        }
423        return;
424      }
425      var fStart = tokens.length;
426      list.forEach(applyToken);
427      seg.parts.push({ start: fStart, end: tokens.length, kind: 'formula', formula: formulaId });
428    }
429  
430    function formula(id) {
431      emit(algs[id], 'formula', id);
432    }
433  
434    // 找出 base 轉 0–3 次中，最少幾次能讓 pred 成立；都不成立 → LBL_STUCK。
435    function turnsUntil(base, pred) {
436      var b = st;
437      for (var n = 0; n < 4; n++) {
438        if (pred(b)) return n;
439        b = cube.applyMove(b, base);
440      }
441      return fail('LBL_STUCK', 'turnsUntil ' + base);
442    }
443  
444    function adjust(base, pred, kind) {
445      emit(turnTokens(base, turnsUntil(base, pred)), kind);
446    }
447  
448    function mustEdge(s, c1, c2) {
449      var e = locateEdge(s, c1, c2);
450      if (!e) fail('INVALID_STATE', 'EDGE_UNKNOWN');
451      return e;
452    }
453  
454    function mustCorner(s, colors) {
455      var c = locateCorner(s, colors);
456      if (!c) fail('INVALID_STATE', 'CORNER_UNKNOWN');
457      return c;
458    }
459  
460    function begin(id) {
461      seg = { id: id, start: tokens.length, end: tokens.length, qtm: 0, parts: [] };
462      segments.push(seg);
463    }
464  
465    function end() {
466      seg.end = tokens.length;
467      seg.qtm = sumQtm(tokens, seg.start, seg.end);
468      if (!STAGE_CHECKS[seg.id](st, cfg)) fail('LBL_STUCK', 'check:' + seg.id);
469    }
470  
471    // ---- 0 hold：白色中心轉到上面 ----
472    begin('hold');
473    var whiteFace = faceOfColor(st, W);
474    if (whiteFace === null) fail('INVALID_STATE', 'BAD_COLOR');
475    if (HOLD_ROTATION[whiteFace]) emit([HOLD_ROTATION[whiteFace]], 'rotate');
476    end();
477  
478    // ---- 1 cross：白色十字（白在上）----
479    begin('cross');
480    (function () {
481      function sideDone(s, side) {
482        var e = mustEdge(s, W, centerColor(s, side));
483        return e.slot === 'U' + side && e.flip === 0;
484      }
485      function allDone() {
486        return SIDE_FACES.every(function (side) { return sideDone(st, side); });
487      }
488      var iter = 0;
489      while (!allDone()) {
490        if (iter >= guards.cross) fail('LBL_STUCK', 'cross');
491        iter++;
492        var side = SIDE_FACES.filter(function (f) { return !sideDone(st, f); })[0];
493        var target = centerColor(st, side);
494        // 1. y 對位：把該側面轉到 F。
495        adjust('y', function (b) { return centerColor(b, 'F') === target; }, 'rotate');
496        var fc = centerColor(st, 'F');
497        var e = mustEdge(st, W, fc);
498        if (e.slot.charAt(0) === 'U') {
499          // 2a. 在頂層（位置或方向錯）：轉所在側面 180°，帶到底層。
500          emit([e.slot.charAt(1) + '2'], 'setup');
501        } else if (e.slot.charAt(0) !== 'D') {
502          // 2b. 在中層：X 取位置名稱第一個字母，試 X、X'，選第一個能帶到底層的 t，輸出 t D t⁻¹。
503          var x = e.slot.charAt(0);
504          var t = [x, x + "'"].filter(function (m) {
505            return mustEdge(cube.applyMove(st, m), W, fc).slot.charAt(0) === 'D';
506          })[0];
507          if (!t) fail('LBL_STUCK', 'cross');
508          emit([t, 'D', cube.inverse(t)], 'setup');
509        }
510        // 3. D 調整，讓它到 DF。
511        adjust('D', function (b) { return mustEdge(b, W, fc).slot === 'DF'; }, 'setup');
512        // 4. 白色朝下 → crossDown；白色朝前 → crossFlip。
513        if (st[EDGE_STICKERS.DF[0]] === W) formula('crossDown');
514        else formula('crossFlip');
515      }
516      loops.cross = iter;
517    })();
518    end();
519  
520    // ---- 2 corners：白色角塊（白在上）----
521    begin('corners');
522    (function () {
523      function targetColors(s, pair) {
524        return [W, centerColor(s, pair[0]), centerColor(s, pair[1])];
525      }
526      // 某目標角（三色）是否已在頂層正確位置。
527      function targetSolved(s, colors) {
528        var c = mustCorner(s, colors);
529        return c.slot.charAt(0) === 'U' && c.twist === 0 && cornerSolved(s, c.slot);
530      }
531      function firstTodo() {
532        for (var i = 0; i < CORNER_TARGET_PAIRS.length; i++) {
533          var cs = targetColors(st, CORNER_TARGET_PAIRS[i]);
534          if (!targetSolved(st, cs)) return cs;
535        }
536        return null;
537      }
538      var iter = 0;
539      var cs = firstTodo();
540      while (cs) {
541        if (iter >= guards.corners) fail('LBL_STUCK', 'corners');
542        iter++;
543        // 1. y 對位：目標槽（兩側中心 cs[1]、cs[2]）轉到 UFR。
544        adjust('y', function (b) {
545          return centerColor(b, 'F') === cs[1] && centerColor(b, 'R') === cs[2];
546        }, 'rotate');
547        // 2. 角塊在頂層：不在 UFR → y 帶過去、拿下來、y 轉回；在 UFR 但方向錯 → 拿下來。
548        var c = mustCorner(st, cs);
549        if (c.slot.charAt(0) === 'U') {
550          if (c.slot !== 'URF') {
551            var k = turnsUntil('y', function (b) { return mustCorner(b, cs).slot === 'URF'; });
552            emit(turnTokens('y', k), 'rotate');
553            formula('cornerDrop');
554            emit(turnTokens('y', (4 - k) % 4), 'rotate');
555          } else {
556            formula('cornerDrop');
557          }
558        }
559        // 3. D 調整，讓它到 DFR。
560        adjust('D', function (b) { return mustCorner(b, cs).slot === 'DFR'; }, 'setup');
561        // 4. 重複 cornerInsert 直到 UFR 歸位（上限 guards.cornerInsert）。
562        var n = 0;
563        while (!(function () {
564          var r = mustCorner(st, cs);
565          return r.slot === 'URF' && r.twist === 0;
566        })()) {
567          if (n >= guards.cornerInsert) fail('LBL_STUCK', 'cornerInsert');
568          n++;
569          formula('cornerInsert');
570        }
571        if (n > loops.cornerInsert) loops.cornerInsert = n;
572        cs = firstTodo();
573      }
574      loops.corners = iter;
575    })();
576    end();
577  
578    // ---- 3 middle：翻面（白朝下）＋中層邊塊 ----
579    begin('middle');
580    emit(['z2'], 'rotate');
581    (function () {
582      var Y = centerColor(st, 'U');
583      function allDone() {
584        return MIDDLE_SLOTS.every(function (slot) { return edgeSolved(st, slot); });
585      }
586      var iter = 0;
587      while (!allDone()) {
588        if (iter >= guards.middle) fail('LBL_STUCK', 'middle');
589        iter++;
590        var uSlot = TOP_EDGE_SLOTS.filter(function (slot) {
591          var s = EDGE_STICKERS[slot];
592          return st[s[0]] !== Y && st[s[1]] !== Y;
593        })[0];
594        if (uSlot) {
595          // 1. 頂層有不含黃色的邊塊：y 對位讓側面色中心在 F，U 調整讓它到 UF，再依頂面色選公式。
596          var us = EDGE_STICKERS[uSlot];
597          var top = st[us[0]];
598          var side = st[us[1]];
599          adjust('y', function (b) { return centerColor(b, 'F') === side; }, 'rotate');
600          adjust('U', function (b) {
601            var uf = EDGE_STICKERS.UF;
602            return b[uf[0]] === top && b[uf[1]] === side;
603          }, 'setup');
604          if (top === centerColor(st, 'R')) formula('edgeRight');
605          else if (top === centerColor(st, 'L')) formula('edgeLeft');
606          else fail('LBL_STUCK', 'middle');
607        } else {
608          // 2. 中層有錯的邊塊卡住：y 對位讓第一個錯的槽在 FR，edgeKickOut。
609          var bad = MIDDLE_SLOTS.filter(function (slot) { return !edgeSolved(st, slot); })[0];
610          var bs = EDGE_STICKERS[bad];
611          var p = st[bs[0]];
612          var q = st[bs[1]];
613          // y 旋轉會交換邊塊兩個貼紙所在的面，因此以「兩色集合」比對。
614          adjust('y', function (b) {
615            var fr = EDGE_STICKERS.FR;
616            return (b[fr[0]] === p && b[fr[1]] === q) || (b[fr[0]] === q && b[fr[1]] === p);
617          }, 'rotate');
618          formula('edgeKickOut');
619        }
620      }
621      loops.middle = iter;
622    })();
623    end();
624  
625    // ---- 4 yellowCross：黃色十字 ----
626    begin('yellowCross');
627    (function () {
628      var ub = faceBase('U');
629      var Y = centerColor(st, 'U');
630      function up(b, k) { return b[ub + k] === Y; }
631      var n = 0;
632      while (!uEdgesAre(st, Y)) {
633        if (n >= guards.yellowCross) fail('LBL_STUCK', 'yellowCross');
634        n++;
635        var count = U_EDGE_CELLS.filter(function (k) { return up(st, k); }).length;
636        if (count === 2) {
637          var line = (up(st, U_LEFT_EDGE) && up(st, U_RIGHT_EDGE)) ||
638            (up(st, U_BACK_EDGE) && up(st, U_FRONT_EDGE));
639          if (line) {
640            // 一直線：U 調整讓線為左右向（UL–UR）。
641            adjust('U', function (b) { return up(b, U_LEFT_EDGE) && up(b, U_RIGHT_EDGE); }, 'setup');
642          } else {
643            // L 形：U 調整讓 L 在 UB–UL。
644            adjust('U', function (b) { return up(b, U_BACK_EDGE) && up(b, U_LEFT_EDGE); }, 'setup');
645          }
646        }
647        formula('yellowCross');
648      }
649      loops.yellowCross = n;
650    })();
651    end();
652  
653    // ---- 5 yellowFace：黃色頂面（小魚公式）----
654    begin('yellowFace');
655    (function () {
656      var ub = faceBase('U');
657      var Y = centerColor(st, 'U');
658      function cornersUp(b) {
659        return U_CORNER_CELLS.filter(function (k) { return b[ub + k] === Y; }).length;
660      }
661      var n = 0;
662      while (cornersUp(st) !== U_CORNER_CELLS.length) {
663        if (n >= guards.sune) fail('LBL_STUCK', 'sune');
664        n++;
665        if (cornersUp(st) === 1) {
666          // 恰一個角黃色朝上：U 調整讓它在 UFL。
667          adjust('U', function (b) { return b[ub + U_FRONT_LEFT_CORNER] === Y; }, 'setup');
668        } else {
669          // 0 或 2 個：U 調整讓 UFL 角的黃色朝左。
670          adjust('U', function (b) { return b[L_FRONT_TOP] === Y; }, 'setup');
671        }
672        formula('sune');
673      }
674      loops.sune = n;
675    })();
676    end();
677  
678    // ---- 6 yellowCorners：黃角歸位（頭燈放在 headlightFace）----
679    begin('yellowCorners');
680    (function () {
681      var n = 0;
682      while (headlightFaces(st).length !== SIDE_FACES.length) {
683        if (n >= guards.aPerm) fail('LBL_STUCK', 'aPerm');
684        n++;
685        if (headlightFaces(st).length === 1) {
686          adjust('U', function (b) {
687            var h = headlightFaces(b);
688            return h.length === 1 && h[0] === cfg.headlightFace;
689          }, 'setup');
690        }
691        formula('aPerm');
692      }
693      loops.aPerm = n;
694      // 完成後 U 調整：F 面左上角與 F 中心同色（頂角全部對齊）。
695      adjust('U', function (b) { return b[F_TOP_LEFT] === centerColor(b, 'F'); }, 'setup');
696    })();
697    end();
698  
699    // ---- 7 yellowEdges：黃邊歸位（用 y 對位，不動已對齊的頂角）----
700    begin('yellowEdges');
701    (function () {
702      function allOk(b) {
703        return SIDE_FACES.every(function (f) { return topEdgeOk(b, f); });
704      }
705      var n = 0;
706      while (!allOk(st)) {
707        if (n >= guards.uPerm) fail('LBL_STUCK', 'uPerm');
708        n++;
709        var good = SIDE_FACES.filter(function (f) { return topEdgeOk(st, f); });
710        if (good.length === 1) {
711          adjust('y', function (b) { return topEdgeOk(b, 'B'); }, 'rotate');
712        }
713        formula('uPerm');
714      }
715      loops.uPerm = n;
716    })();
717    end();
718  
719    return {
720      result: { tokens: tokens, segments: segments, qtm: sumQtm(tokens, 0, tokens.length) },
721      loops: loops
722    };
723  }
724  
725  // ---------------------------------------------------------------------------
726  // 7. 對外介面
727  // ---------------------------------------------------------------------------
728  
729  /**
730   * 產生層先法示範序列（§8.2）。
731   * @param {number[]} viewStickers - view 座標 54 格色號（0–5）。
732   * @param {object} config - src/data/lbl.json 全文。
733   * @returns {{tokens: string[], segments: object[], qtm: number} | {error: string, detail: string}}
734   *   錯誤碼：INVALID_STATE（輸入不是合法貼紙）、BAD_REQUEST（設定格式錯誤）、
735   *   LBL_STUCK（超過迴圈上限或分段判定不成立）。
736   */
737  function generateLbl(viewStickers, config) {
738    var out = generateLblDetailed(viewStickers, config);
739    return out.error ? out : out.result;
740  }
741  
742  /**
743   * 同 generateLbl，另回傳本局各迴圈的實際次數（測試與診斷用；UI 與 Worker 不需要）。
744   * @returns {{result: object, loops: object} | {error: string, detail: string}}
745   */
746  function generateLblDetailed(viewStickers, config) {
747    try {
748      return runGenerator(viewStickers, config);
749    } catch (e) {
750      if (e instanceof LblError) return { error: e.code, detail: e.detail };
751      throw e;
752    }
753  }
754  
755  module.exports = {
756    generateLbl: generateLbl,
757    generateLblDetailed: generateLblDetailed,
758    STAGE_CHECKS: STAGE_CHECKS,
759    SEGMENT_IDS: SEGMENT_IDS,
760    GUARD_KEYS: GUARD_KEYS
761  };
```

### 3.3 `src/solver/worker.js`（新增，183 行）

```js
  1  // src/solver/worker.js — 求解器 Worker 的訊息處理（純邏輯，可在 Node 直接測試）
  2  //
  3  // 依據：game-spec.md §7.1、§9.5（訊息協定）、§9.6；ADR-001-solver.md §2.5；
  4  //       分派單 T-001 S6、X-5、X-6；技術裁決 D-3、D-5（docs/reports/T-001-arch-decisions.md）。
  5  //
  6  // 分工：
  7  //   - 本檔只匯出 handleMessage(msg, post)；不接 Worker 的全域訊息事件。
  8  //     接上 Worker 入口的那一行由 build/bundle.js 產生（X-6），本目錄因此不含任何瀏覽器 API。
  9  //   - 求解一律呼叫 twophase.js／lbl.js，不在本檔改寫求解器行為（X-5）。
 10  //   - 不讀時鐘、不用亂數；逾時保護在 src/ui/solver-client.js（ADR-001 §2.4）。
 11  //
 12  // 協定（主執行緒 → Worker）：
 13  //   {type:'init',  id, params:{nodeLimit, firstNodeLimit, maxLength, phase2Cap, ...}}
 14  //   {type:'solve', id, stickers:int[54], opts?:{nodeLimit, firstNodeLimit, ...}}
 15  //   {type:'lbl',   id, stickers:int[54], config:<lbl.json 全文>}
 16  // 協定（Worker → 主執行緒）：
 17  //   {type:'progress', id, step, total, label}      // init：建每張表後各一次，共 6 次
 18  //   {type:'ready',    id, tableBytes}              // init 完成
 19  //   {type:'result',   id, kind:'solve', moves:string[], qtm, nodes, complete}
 20  //   {type:'result',   id, kind:'lbl', tokens, segments, qtm}
 21  //   {type:'error',    id, code, detail}
 22  'use strict';
 23  
 24  var twophase = require('./twophase.js');
 25  var lbl = require('./lbl.js');
 26  
 27  // twophase.init 只接受這一組選項（game-spec.md §7.2；S4 回報 §7）。
 28  var INIT_OPTIONS = Object.freeze({ metrics: ['qtm'], twistFlip: true, cornerTable: false });
 29  
 30  // 從 params.solver 取出、轉交給 twophase.solve 的欄位（D-3：一律傳入 params.solver）。
 31  var SOLVE_KEYS = ['metric', 'nodeLimit', 'firstNodeLimit', 'maxLength', 'phase2Cap'];
 32  
 33  // §9.5 錯誤碼表中可由 lbl.js 原樣轉送的碼；其他碼依 D-5 視為非法狀態。
 34  var LBL_CODES = { LBL_STUCK: true, INVALID_STATE: true, BAD_REQUEST: true };
 35  
 36  // Worker 內的狀態：init 收到的求解參數；null 代表尚未 init。
 37  var solveParams = null;
 38  
 39  function isObject(v) {
 40    return v !== null && typeof v === 'object' && !Array.isArray(v);
 41  }
 42  
 43  function isValidId(id) {
 44    return typeof id === 'number' && isFinite(id);
 45  }
 46  
 47  function pickSolveOpts(src, base) {
 48    var out = {};
 49    var i, k;
 50    if (base) {
 51      for (i = 0; i < SOLVE_KEYS.length; i++) {
 52        k = SOLVE_KEYS[i];
 53        if (base[k] !== undefined) out[k] = base[k];
 54      }
 55    }
 56    if (src) {
 57      for (i = 0; i < SOLVE_KEYS.length; i++) {
 58        k = SOLVE_KEYS[i];
 59        if (src[k] !== undefined) out[k] = src[k];
 60      }
 61    }
 62    return out;
 63  }
 64  
 65  function errorMsg(id, code, detail) {
 66    return { type: 'error', id: id, code: code, detail: detail === undefined ? null : String(detail) };
 67  }
 68  
 69  function handleInit(msg, post) {
 70    if (!isObject(msg.params)) {
 71      post(errorMsg(msg.id, 'BAD_REQUEST', 'params'));
 72      return;
 73    }
 74    var id = msg.id;
 75    var info = twophase.init(INIT_OPTIONS, function (step, total, label) {
 76      post({ type: 'progress', id: id, step: step, total: total, label: label });
 77    });
 78    solveParams = pickSolveOpts(msg.params, null);
 79    post({ type: 'ready', id: id, tableBytes: info.totalBytes });
 80  }
 81  
 82  function handleSolve(msg, post) {
 83    if (!Array.isArray(msg.stickers) || (msg.opts !== undefined && !isObject(msg.opts))) {
 84      post(errorMsg(msg.id, 'BAD_REQUEST', 'stickers/opts'));
 85      return;
 86    }
 87    if (solveParams === null || !twophase.isReady()) {
 88      post(errorMsg(msg.id, 'NOT_READY', null));
 89      return;
 90    }
 91    var parsed = twophase.fromStickerColors(msg.stickers);
 92    if (!parsed.ok) {
 93      // D-5：fromStickerColors 的任何錯誤碼（含規格未列的 COLOR_COUNT）一律視為非法狀態
 94      post(errorMsg(msg.id, 'INVALID_STATE', parsed.error));
 95      return;
 96    }
 97    var r = twophase.solve(parsed.cube, pickSolveOpts(msg.opts, solveParams));
 98    if (r.error) {
 99      if (r.error === 'NODE_LIMIT') post(errorMsg(msg.id, 'NODE_LIMIT', r.nodes));
100      else if (r.error === 'NOT_INITIALIZED') post(errorMsg(msg.id, 'NOT_READY', null));
101      else if (r.error === 'UNSUPPORTED_METRIC') post(errorMsg(msg.id, 'BAD_REQUEST', r.error));
102      else post(errorMsg(msg.id, 'INTERNAL', r.error));
103      return;
104    }
105    post({
106      type: 'result',
107      id: msg.id,
108      kind: 'solve',
109      moves: r.names.slice(),
110      qtm: r.qtm,
111      nodes: r.nodes,
112      complete: r.complete
113    });
114  }
115  
116  function handleLbl(msg, post) {
117    if (!Array.isArray(msg.stickers) || !isObject(msg.config)) {
118      post(errorMsg(msg.id, 'BAD_REQUEST', 'stickers/config'));
119      return;
120    }
121    // 先用 fromStickerColors 驗證合法性（不需要建表），避免把不可解的狀態交給層先法
122    var parsed = twophase.fromStickerColors(msg.stickers);
123    if (!parsed.ok) {
124      post(errorMsg(msg.id, 'INVALID_STATE', parsed.error));
125      return;
126    }
127    var r = lbl.generateLbl(msg.stickers.slice(), msg.config);
128    if (r.error) {
129      if (LBL_CODES[r.error]) post(errorMsg(msg.id, r.error, r.detail));
130      else post(errorMsg(msg.id, 'INVALID_STATE', r.error));
131      return;
132    }
133    post({
134      type: 'result',
135      id: msg.id,
136      kind: 'lbl',
137      tokens: r.tokens,
138      segments: r.segments,
139      qtm: r.qtm
140    });
141  }
142  
143  /**
144   * 處理一則主執行緒訊息；所有回覆都經由 post 送出（同步呼叫）。
145   * 任何例外都轉成 {type:'error', code:'INTERNAL'}，不讓 Worker 崩潰。
146   * @param {object} msg - 見檔頭協定
147   * @param {(reply: object) => void} post - 送回主執行緒
148   */
149  function handleMessage(msg, post) {
150    var id = isObject(msg) ? msg.id : undefined;
151    try {
152      if (!isObject(msg) || !isValidId(msg.id)) {
153        post(errorMsg(id === undefined ? null : id, 'BAD_REQUEST', 'id'));
154        return;
155      }
156      switch (msg.type) {
157        case 'init':
158          handleInit(msg, post);
159          return;
160        case 'solve':
161          handleSolve(msg, post);
162          return;
163        case 'lbl':
164          handleLbl(msg, post);
165          return;
166        default:
167          post(errorMsg(msg.id, 'BAD_REQUEST', 'type:' + String(msg.type)));
168      }
169    } catch (e) {
170      post(errorMsg(id === undefined ? null : id, 'INTERNAL', e && e.message ? e.message : e));
171    }
172  }
173  
174  /** 測試用：清除 init 收到的參數（不會清除 twophase 已建好的表）。 */
175  function resetForTest() {
176    solveParams = null;
177  }
178  
179  module.exports = {
180    handleMessage: handleMessage,
181    INIT_OPTIONS: INIT_OPTIONS,
182    resetForTest: resetForTest
183  };
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
