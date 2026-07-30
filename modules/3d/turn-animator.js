// Turn Animator - Face rotation animation (quaternion-from-save, no reparenting)
// Module:    TurnAnimator
// Version:   2.0.0
// API:       constructor(cubeGroup, cubeState, callbacks)
//            doTurn(face, prime) — face letter + CW/CCW
//            isAnimating(), moves, resetMoves()
//            edgeAdjacency (getter)
// Depends:   THREE (global)
// Callbacks: { rebuild, onMovesChange, onTurn, onStickerUpdate, onDebugLog, onDebugLogBottom }
// Changelog:
//   2.0.0 - Clark-style quaternion-from-save rotation. No reparenting.
//           Dynamic gap detection. Cubic easing, 180ms. No rebuild after turn.
//   1.0.0 - Initial modular version. 200ms ease-in-out, temp group reparenting.

(function() {
'use strict';

function TurnAnimator(cubeGroup, cubeState, callbacks) {
  this.cubeGroup = cubeGroup;
  this.cubeState = cubeState;
  this.callbacks = callbacks || {};
  this._moves = 0;
  this._animating = false;

  this.AXIS_MAP = {
    'U': { axisVec: new THREE.Vector3(0, 1, 0), layerComp: 'y', layerVal: 1 },
    'D': { axisVec: new THREE.Vector3(0, 1, 0), layerComp: 'y', layerVal: -1 },
    'F': { axisVec: new THREE.Vector3(0, 0, 1), layerComp: 'z', layerVal: 1 },
    'B': { axisVec: new THREE.Vector3(0, 0, 1), layerComp: 'z', layerVal: -1 },
    'L': { axisVec: new THREE.Vector3(1, 0, 0), layerComp: 'x', layerVal: -1 },
    'R': { axisVec: new THREE.Vector3(1, 0, 0), layerComp: 'x', layerVal: 1 },
    'E': { axisVec: new THREE.Vector3(0, 0, 1), layerComp: 'z', layerVal: 0 },
    'M': { axisVec: new THREE.Vector3(1, 0, 0), layerComp: 'x', layerVal: 0 },
    'S': { axisVec: new THREE.Vector3(0, -1, 0), layerComp: 'y', layerVal: 0 },
  };

  this.FACE_SIGN = {
    'U': -1, 'D': 1,
    'F': -1, 'B': 1,
    'L': 1, 'R': -1,
    'E': 1, 'M': 1, 'S': 1,
  };

  this.SLICE_AXIS = {};
}

TurnAnimator.prototype.isAnimating = function() {
  return this._animating;
};

Object.defineProperty(TurnAnimator.prototype, 'moves', {
  get: function() { return this._moves; }
});

TurnAnimator.prototype.resetMoves = function() {
  this._moves = 0;
};

TurnAnimator.prototype.doTurn = function(face, prime) {
  if (!this.cubeState || this._animating) return;
  var move = prime ? face + "'" : face;
  var isPrime = !!prime;

  var info = this.AXIS_MAP[face] || this.SLICE_AXIS[face];
  if (!info) return;

  this._animating = true;
  var stateBefore = this.cubeState.state.slice();
  this.cubeState.doMove(move);
  this._moves++;

  // Slice moves — use same animation path (S/M/E now in AXIS_MAP)

  // Find cubies on this layer
  var layerCubies = [];
  var children = this.cubeGroup.children;
  var comp = info.layerComp;
  var target = info.layerVal;

  // Compute actual spacing from the scene
  var actualSpacing = 0.78;
  for (var si = 0; si < children.length; si++) {
    var ch = children[si];
    if (ch.userData && ch.userData.isCubieGroup) {
      var p = ch.position;
      actualSpacing = Math.abs(p.x) || Math.abs(p.y) || Math.abs(p.z) || 0.78;
      break;
    }
  }

  var expectedPos = target * actualSpacing;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.userData && child.userData.isCubieGroup) {
      var val = (comp === 'x') ? child.position.x : (comp === 'y') ? child.position.y : child.position.z;
      if (Math.abs(val - expectedPos) < 0.01) {
        layerCubies.push(child);
      }
    }
  }

  // If no cubies found, just update state via rebuild
  if (layerCubies.length === 0) {
    if (this.callbacks.rebuild) this.callbacks.rebuild();
    this._animating = false;
    if (this.callbacks.onMovesChange) this.callbacks.onMovesChange(this._moves);
    if (this.callbacks.onTurn) this.callbacks.onTurn(move);
    return;
  }

  // Save initial positions & quaternions (Clark-style)
  var initData = layerCubies.map(function(c) {
    return { cubie: c, pos: c.position.clone(), quat: c.quaternion.clone() };
  });

  var faceSign = this.FACE_SIGN[face] || 1;
  var CW = isPrime ? -1 : 1;
  var targetAngle = CW * faceSign * Math.PI / 2;
  var axisVec = info.axisVec;
  var duration = 180;
  var startTime = performance.now();
  var self = this;

  function tick(now) {
    var t = Math.min((now - startTime) / duration, 1);
    var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    var currentAngle = targetAngle * ease;
    var q = new THREE.Quaternion().setFromAxisAngle(axisVec, currentAngle);

    for (var j = 0; j < initData.length; j++) {
      var d = initData[j];
      d.cubie.position.copy(d.pos).applyQuaternion(q);
      d.cubie.quaternion.copy(q).multiply(d.quat);
    }

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      // Finalize at exact angle
      var qFinal = new THREE.Quaternion().setFromAxisAngle(axisVec, targetAngle);
      for (var k = 0; k < initData.length; k++) {
        var d2 = initData[k];
        d2.cubie.position.copy(d2.pos).applyQuaternion(qFinal);
        d2.cubie.quaternion.copy(qFinal).multiply(d2.quat);
      }
      // Snap to 2 decimal places
      for (var m = 0; m < initData.length; m++) {
        var c = initData[m].cubie;
        c.position.x = Math.round(c.position.x * 100) / 100;
        c.position.y = Math.round(c.position.y * 100) / 100;
        c.position.z = Math.round(c.position.z * 100) / 100;
      }

      self._animating = false;
      // No rebuild — cubies rotate physically, stickers move with them
      // Update sticker userData to match new positions
      if (self.callbacks.onStickerUpdate) self.callbacks.onStickerUpdate();
      if (self.callbacks.onMovesChange) self.callbacks.onMovesChange(self._moves);
      if (self.callbacks.onTurn) self.callbacks.onTurn(move);
    }
  }

  requestAnimationFrame(tick);
};

// Edge adjacency data
TurnAnimator.prototype.edgeAdjacency = {
  2: { // F
    top: { face: 'U', isSlice: false },
    bottom: { face: 'D', isSlice: false },
    left: { face: 'L', isSlice: false },
    right: { face: 'R', isSlice: false },
    midLeft: { face: 'E', isSlice: true, dir: 'right' },
    midRight: { face: 'E', isSlice: true, dir: 'left' },
    midTop: { face: 'M', isSlice: true, dir: 'down' },
    midBottom: { face: 'M', isSlice: true, dir: 'up' },
  },
  3: { // B
    top: { face: 'U', isSlice: false },
    bottom: { face: 'D', isSlice: false },
    left: { face: 'R', isSlice: false, invert: true },
    right: { face: 'L', isSlice: false, invert: true },
    midLeft: { face: 'E', isSlice: true, dir: 'right' },
    midRight: { face: 'E', isSlice: true, dir: 'left' },
    midTop: { face: 'M', isSlice: true, dir: 'down', invert: true },
    midBottom: { face: 'M', isSlice: true, dir: 'up', invert: true },
  },
  0: { // U
    top: { face: 'B', isSlice: false },
    bottom: { face: 'F', isSlice: false },
    left: { face: 'L', isSlice: false },
    right: { face: 'R', isSlice: false },
    midLeft: { face: 'S', isSlice: true, dir: 'right' },
    midRight: { face: 'S', isSlice: true, dir: 'left' },
    midTop: { face: 'M', isSlice: true, dir: 'down' },
    midBottom: { face: 'M', isSlice: true, dir: 'up' },
  },
  1: { // D
    top: { face: 'F', isSlice: false },
    bottom: { face: 'B', isSlice: false },
    left: { face: 'L', isSlice: false },
    right: { face: 'R', isSlice: false },
    midLeft: { face: 'S', isSlice: true, dir: 'left' },
    midRight: { face: 'S', isSlice: true, dir: 'right' },
    midTop: { face: 'M', isSlice: true, dir: 'down' },
    midBottom: { face: 'M', isSlice: true, dir: 'up' },
  },
  4: { // L
    top: { face: 'U', isSlice: false },
    bottom: { face: 'D', isSlice: false },
    left: { face: 'B', isSlice: false },
    right: { face: 'F', isSlice: false },
    midLeft: { face: 'E', isSlice: true, dir: 'right' },
    midRight: { face: 'E', isSlice: true, dir: 'left' },
    midTop: { face: 'S', isSlice: true, dir: 'down' },
    midBottom: { face: 'S', isSlice: true, dir: 'up' },
  },
  5: { // R
    top: { face: 'U', isSlice: false },
    bottom: { face: 'D', isSlice: false },
    left: { face: 'F', isSlice: false },
    right: { face: 'B', isSlice: false },
    midLeft: { face: 'E', isSlice: true, dir: 'right' },
    midRight: { face: 'E', isSlice: true, dir: 'left' },
    midTop: { face: 'S', isSlice: true, dir: 'down', invert: true },
    midBottom: { face: 'S', isSlice: true, dir: 'up', invert: true },
  },
};

window.TurnAnimator = TurnAnimator;

})();
