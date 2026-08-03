/* ============================================================
 * Net2D — 2D cross-net view for Simple Cubik (module)
 * Renders a 6-face cross net (U / L-F-R-B / D) from cube state.
 * Tap sticker = turn face CW · double-tap = CCW
 * Swipe on edge sticker = adjacent-face ring turn (when enabled)
 * v2.0.0 — Jul 31 2026 (bundled into SimpleCubik .2 builds)
 * ============================================================ */
function Net2D(o) {
  this.container = o.container;
  this.cube = o.cube;                 // RubiksCube instance (has .state, .doMove)
  this.onTurn = o.onTurn;             // function(face, isCcw)
  this.swipeEnabled = o.swipeEnabled !== false;
  this.faceColors = ['#FAFAFA', '#FFD500', '#4CAF50', '#2196F3', '#FF6600', '#F44336'];
  this.FACE_LETTERS = ['U', 'D', 'F', 'B', 'L', 'R'];
  // state order: 0=U 1=D 2=F 3=B 4=L 5=R
  this.EDGE_TARGET = {
    0: { row0: 3, row2: 2, col0: 4, col2: 5 }, // U → B F L R
    1: { row0: 2, row2: 3, col0: 4, col2: 5 }, // D → F B L R
    2: { row0: 0, row2: 1, col0: 4, col2: 5 }, // F → U D L R
    3: { row0: 0, row2: 1, col0: 5, col2: 4 }, // B → U D R L (mirrored)
    4: { row0: 0, row2: 1, col0: 3, col2: 2 }, // L → U D B F
    5: { row0: 0, row2: 1, col0: 2, col2: 3 }  // R → U D F B
  };
  this.CW_DIR = { row0: 'left', row2: 'right', col0: 'down', col2: 'up' };
  this._lastTap = 0;
  this._tapTimer = null;
  this._touch = null;
  this._injectCss();
  this.build();
}

Net2D.prototype._injectCss = function() {
  if (Net2D._cssInjected) return;
  Net2D._cssInjected = true;
  var css = [
    '.sc-net{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:auto auto auto;gap:6px;width:100%;height:100%;align-items:center;justify-items:center;touch-action:none;user-select:none;-webkit-user-select:none;}',
    '.sc-face{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:3px;padding:4px;background:#222;border-radius:8px;width:clamp(64px,20vw,100px);aspect-ratio:1;box-sizing:border-box;}',
    '.sc-sticker{border-radius:4px;cursor:pointer;}',
    '.sc-u{grid-column:2;grid-row:1;}.sc-l{grid-column:1;grid-row:2;}.sc-f{grid-column:2;grid-row:2;}.sc-r{grid-column:3;grid-row:2;}.sc-b{grid-column:4;grid-row:2;}.sc-d{grid-column:2;grid-row:3;}'
  ].join('\n');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
};

Net2D.prototype.build = function() {
  var t = this;
  var root = document.createElement('div');
  root.className = 'sc-net';

  function makeFace(faceIdx, cls) {
    var faceEl = document.createElement('div');
    faceEl.className = 'sc-face ' + cls;
    for (var i = 0; i < 9; i++) {
      var s = document.createElement('div');
      s.className = 'sc-sticker';
      s.dataset.f = faceIdx;
      s.dataset.i = i;
      s.addEventListener('click', function() { t._onTap(parseInt(this.dataset.f, 10)); });
      // NO native 'dblclick' listener: _onTap's 300ms timer already handles
      // double-tap (1 CCW). A dblclick listener fired a SECOND CCW → double-tap
      // rotated 2 times instead of 1 backward (bug found Aug 3, 2D mode).
      s.addEventListener('touchstart', function(e) { t._onTouchStart(e, this); }, { passive: true });
      s.addEventListener('touchmove', function(e) { t._onTouchMove(e); }, { passive: true });
      s.addEventListener('touchend', function(e) { t._onTouchEnd(e); });
      faceEl.appendChild(s);
    }
    root.appendChild(faceEl);
    return faceEl;
  }

  this._u = makeFace(0, 'sc-u');
  this._l = makeFace(4, 'sc-l');
  this._f = makeFace(2, 'sc-f');
  this._r = makeFace(5, 'sc-r');
  this._b = makeFace(3, 'sc-b');
  this._d = makeFace(1, 'sc-d');
  this._stickers = root.querySelectorAll('.sc-sticker');
  this.container.appendChild(root);
  this.root = root;
};

Net2D.prototype.render = function() {
  var state = this.cube.state;
  for (var i = 0; i < this._stickers.length; i++) {
    var s = this._stickers[i];
    var face = parseInt(s.dataset.f, 10);
    var idx = face * 9 + parseInt(s.dataset.i, 10);
    s.style.background = this.faceColors[state[idx]];
  }
};

Net2D.prototype.destroy = function() {
  if (this._tapTimer) clearTimeout(this._tapTimer);
  if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
  this.root = null;
  this._stickers = null;
};

// v5.2: runtime swipe toggle (Swipe Academy turns swipes on mid-game)
Net2D.prototype.setSwipe = function(on) {
  this.swipeEnabled = !!on;
};

// ─── Tap / double-tap (turn) ───
Net2D.prototype._onTap = function(face) {
  var t = this;
  var now = Date.now();
  if (now - t._lastTap < 300) {          // double tap → CCW
    if (t._tapTimer) { clearTimeout(t._tapTimer); t._tapTimer = null; }
    t._lastTap = 0;
    t.onTurn(t.FACE_LETTERS[face], true);
  } else {                                // single tap → CW (delay to allow double)
    t._lastTap = now;
    if (t._tapTimer) clearTimeout(t._tapTimer);
    t._tapTimer = setTimeout(function() { t._tapTimer = null; t.onTurn(t.FACE_LETTERS[face], false); }, 300);
  }
};

// ─── Swipe (adjacent-face turns, when enabled) ───
Net2D.prototype._onTouchStart = function(e, el) {
  var tch = e.touches[0];
  this._touch = {
    x: tch.clientX, y: tch.clientY,
    face: parseInt(el.dataset.f, 10),
    row: Math.floor(parseInt(el.dataset.i, 10) / 3),
    col: parseInt(el.dataset.i, 10) % 3,
    moved: false
  };
};

Net2D.prototype._onTouchMove = function(e) {
  if (!this._touch) return;
  var tch = e.touches[0];
  var dx = tch.clientX - this._touch.x;
  var dy = tch.clientY - this._touch.y;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
    this._touch.dx = dx; this._touch.dy = dy;
    this._touch.moved = true;
  }
};

Net2D.prototype._onTouchEnd = function(e) {
  var t = this;
  var touch = this._touch;
  this._touch = null;
  if (!touch) return;
  if (touch.moved && t.swipeEnabled) {
    var r = t.resolveSwipe(touch.face, touch.row, touch.col, touch.dx, touch.dy);
    if (r) t.onTurn(t.FACE_LETTERS[r.face], r.ccw);
  }
  // non-swipe touch → the browser fires a click → single/double tap logic handles it
};

Net2D.prototype.resolveSwipe = function(face, row, col, dx, dy) {
  var isHorizontal = Math.abs(dx) >= Math.abs(dy);
  var swipeDir = isHorizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  var edgeKey = null;
  if (isHorizontal) {
    if (row === 0) edgeKey = 'row0';
    else if (row === 2) edgeKey = 'row2';
    else if (col === 0) edgeKey = 'col0';
    else if (col === 2) edgeKey = 'col2';
  } else {
    if (col === 0) edgeKey = 'col0';
    else if (col === 2) edgeKey = 'col2';
    else if (row === 0) edgeKey = 'row0';
    else if (row === 2) edgeKey = 'row2';
  }
  // middle row/col with the orthogonal swipe → same-face base rule
  if (edgeKey && ((isHorizontal && row === 1) || (!isHorizontal && col === 1))) edgeKey = null;

  var isCcw;
  if (edgeKey && this.CW_DIR[edgeKey]) {
    var target = this.EDGE_TARGET[face] && this.EDGE_TARGET[face][edgeKey];
    if (target === undefined) return null;
    isCcw = swipeDir !== this.CW_DIR[edgeKey];
    return { face: target, ccw: isCcw };
  }
  // Base rule — turn the start face itself
  isCcw = isHorizontal ? swipeDir === 'right' : swipeDir !== 'down';
  if (face === 5 && !isHorizontal) isCcw = !isCcw; // R mirrored vertical
  if (face === 1 && isHorizontal) isCcw = !isCcw;  // D S-slice direction
  return { face: face, ccw: isCcw };
};
