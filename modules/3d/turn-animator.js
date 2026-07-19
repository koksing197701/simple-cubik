// Turn Animator - Face rotation animation (snap turn)
// Module:    TurnAnimator
// Version:   1.0.0
// API:       constructor(cubeGroup, cubeState, callbacks)
//            doTurn(face, prime) — face letter + CW/CCW
//            isAnimating(), moves, resetMoves()
//            edgeAdjacency (getter)
// Depends:   THREE (global)
// Callbacks: { rebuild, onMovesChange, onTurn, onDebugLog, onDebugLogBottom }
// Changelog:
//   1.0.0 - Initial modular version. Extracted from cube-3d-view.js v2.11.4.
//           200ms ease-in-out snap animation. Layer-based cubie selection.
//           Designed so a drag-proportional variant can replace this module.

(function() {
'use strict';

function TurnAnimator(cubeGroup, cubeState, callbacks) {
  this.cubeGroup = cubeGroup;
  this.cubeState = cubeState; // object with .state (array) and .doMove(move)
  this.callbacks = callbacks || {};
  this._moves = 0;
  this._animating = false;

  this.AXIS_MAP = {
    'U': { axis: new THREE.Vector3(0, 1, 0), layerY: 1 },
    'D': { axis: new THREE.Vector3(0, -1, 0), layerY: -1 },
    'F': { axis: new THREE.Vector3(0, 0, 1), layerZ: 1 },
    'B': { axis: new THREE.Vector3(0, 0, -1), layerZ: -1 },
    'L': { axis: new THREE.Vector3(-1, 0, 0), layerX: -1 },
    'R': { axis: new THREE.Vector3(1, 0, 0), layerX: 1 },
  };

  this.SLICE_AXIS = {
    'S': { axis: new THREE.Vector3(0, 0, 1) },
    'M': { axis: new THREE.Vector3(1, 0, 0) },
    'E': { axis: new THREE.Vector3(0, -1, 0) },
  };
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

  // Create anim group
  var animGroup = new THREE.Group();
  this.cubeGroup.add(animGroup);

  // Find cubies on this layer
  var cubiesToMove = [];
  var children = this.cubeGroup.children;
  for (var i = children.length - 1; i >= 0; i--) {
    var child = children[i];
    if (child.userData && child.userData.isCubieGroup) {
      var pos = child.position;
      var match = false;
      if (info.layerY !== undefined && Math.abs(pos.y - info.layerY) < 0.01) match = true;
      if (info.layerZ !== undefined && Math.abs(pos.z - info.layerZ) < 0.01) match = true;
      if (info.layerX !== undefined && Math.abs(pos.x - info.layerX) < 0.01) match = true;
      if (match) {
        this.cubeGroup.remove(child);
        animGroup.add(child);
        cubiesToMove.push(child);
      }
    }
  }

  // If no cubies found, just snap
  if (cubiesToMove.length === 0) {
    this._animating = false;
    this.cubeGroup.remove(animGroup);
  }

  // Snap state immediately
  var stateBefore = this.cubeState.state.slice();
  this.cubeState.doMove(move);
  this._moves++;

  // Animate rotation
  var angle = isPrime ? -Math.PI / 2 : Math.PI / 2;
  var startTime = performance.now();
  var duration = 200;
  var self = this;

  function animateTurn(now) {
    var elapsed = now - startTime;
    var t = Math.min(elapsed / duration, 1);
    var ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    var currentAngle = angle * ease;
    animGroup.quaternion.setFromAxisAngle(info.axis, currentAngle);

    if (t < 1) {
      requestAnimationFrame(animateTurn);
    } else {
      // Complete — apply matrix and clean up
      animGroup.quaternion.setFromAxisAngle(info.axis, angle);
      animGroup.updateMatrixWorld(true);
      while (animGroup.children.length) {
        var c = animGroup.children[0];
        c.applyMatrix4(animGroup.matrix);
        animGroup.remove(c);
        c.position.x = Math.round(c.position.x / 0.01) * 0.01;
        c.position.y = Math.round(c.position.y / 0.01) * 0.01;
        c.position.z = Math.round(c.position.z / 0.01) * 0.01;
        self.cubeGroup.add(c);
      }
      self.cubeGroup.remove(animGroup);

      // Rebuild and callbacks
      if (self.callbacks.rebuild) self.callbacks.rebuild();
      self._animating = false;
      if (self.callbacks.onMovesChange) self.callbacks.onMovesChange(self._moves);
      if (self.callbacks.onTurn) self.callbacks.onTurn(move);

      // Debug color changes
      if (typeof self.callbacks.onDebugLogBottom === 'function') {
        var stateAfter = self.cubeState.state;
        var faceNames = ['U','D','F','B','L','R'];
        var colorNames = ['W','Y','G','B','O','R'];
        var changes = [];
        for (var si = 0; si < 54; si++) {
          if (stateBefore[si] !== stateAfter[si]) {
            var f = Math.floor(si / 9);
            var r = Math.floor((si % 9) / 3);
            var c = si % 3;
            changes.push(faceNames[f] + '(' + r + ',' + c + '):' + colorNames[stateBefore[si]] + '→' + colorNames[stateAfter[si]]);
          }
        }
        var msg = changes.length > 0 ? changes.join(' ') : 'no change';
        self.callbacks.onDebugLogBottom('[' + move + '] ' + msg);
      }
    }
  }

  requestAnimationFrame(animateTurn);
};

// Edge adjacency data (kept for fallback compatibility)
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
