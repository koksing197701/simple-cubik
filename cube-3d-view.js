// Cube Buddy 3D - Coordinator Module
// Version: 2.12.0
// Wires together modular 3D components: renderer, mesh, orbit, turn, ring system
// Depends on: CubeRenderer, CubeMesh, OrbitController, TurnAnimator, GestureHandler, CubeRingSystem

(function() {
'use strict';

var $3d;

$3d = function CubeBuddy3D(options) {
  options = options || {};
  this.container = options.container || document.getElementById('cube-3d-container');
  this.cube = options.cube || null;
  this.onTurn = options.onTurn || null;
  this.onMovesChange = options.onMovesChange || null;

  // --- Init sub-modules ---
  this.rendererMod = new CubeRenderer(this.container);
  this.meshMod = new CubeMesh({
    cube: this.cube,
    cubieSize: 0.70,
    gap: 0.78,
    stickerThickness: 0.04,
    coreSize: 0.70,
    coreColor: 0x111111
  });

  this.orbitCtrl = new OrbitController(this.rendererMod.cubeGroup, this.rendererMod.camera);

  var self = this;

  this.animator = new TurnAnimator(this.rendererMod.cubeGroup, this.cube, {
    rebuild: function() { self.rebuild(); },
    onMovesChange: function(n) { if (self.onMovesChange) self.onMovesChange(n); },
    onTurn: function(m) { if (self.onTurn) self.onTurn(m); },
    onDebugLog: function(msg) { if (self._debugLog) self._debugLog(msg); },
    onDebugLogBottom: function(msg) { if (typeof self._debugLogBottom === "function") self._debugLogBottom(msg); }
  });

  // --- Gesture handler ---
  this.gesture = new GestureHandler(
    this.rendererMod.renderer.domElement,
    function(x, y) { return self._getStickerAtPoint(x, y); },
    function() { return self.meshMod.cubieCores; },
    function() { return self.rendererMod.camera; }
  );

  this.gesture.onSwipe = function(data) {
    var result = resolveRingSwipe(
      data.startSticker.faceIdx, data.startSticker.row, data.startSticker.col,
      data.endSticker.faceIdx, data.endSticker.row, data.endSticker.col
    );
    if (result) {
      self.animator.doTurn(result.turn, result.isCw ? 0 : 1);
    } else if (data.endSticker && data.endSticker.faceIdx !== data.startSticker.faceIdx) {
      var letters = ['U','D','F','B','L','R'];
      var endLetter = letters[data.endSticker.faceIdx];
      var isDown = data.dy > 0, isRight = data.dx > 0;
      var prime = (endLetter === 'U' || endLetter === 'D') ? (isRight ? 0 : 1)
                : (endLetter === 'L' || endLetter === 'R') ? (isDown ? 0 : 1)
                : (Math.abs(data.dx) >= Math.abs(data.dy)) ? (isRight ? 0 : 1) : (isDown ? 1 : 0);
      self.animator.doTurn(endLetter, prime);
    }
  };

  this.gesture.onOrbit = function(data) {
    self.orbitCtrl.onDrag(data.dx, data.dy);
  };

  this.gesture.onTap = function(data) {
    self.animator.doTurn(data.face, 0);
  };

  this.gesture.onDoubleTap = function(data) {
    self.animator.doTurn(data.face, 1);
  };

  this.gesture.onDebugLog = function(msg) {
    if (self._debugLog) self._debugLog(msg);
  };

  // --- Debug (injected by app) ---
  this._debugLog = null;
  this._debugLogBottom = null;

  // --- Build initial cube ---
  if (this.cube) {
    this.meshMod.build(this.rendererMod.cubeGroup);
  }

  // Start render loop
  this.rendererMod.start();
};

$3d.prototype._getStickerAtPoint = function(clientX, clientY) {
  var rect = this.rendererMod.renderer.domElement.getBoundingClientRect();
  var mx = ((clientX - rect.left) / rect.width) * 2 - 1;
  var my = -((clientY - rect.top) / rect.height) * 2 + 1;
  var ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(mx, my), this.rendererMod.camera);

  // Try raycast first
  var hits = ray.intersectObjects(this.meshMod.stickerMeshes, false);
  if (hits.length > 0 && hits[0].object.userData.isSticker) {
    return hits[0].object;
  }

  // Projection fallback
  var w = rect.width, h = rect.height;
  var vec = new THREE.Vector3();
  var best = null, bestDist = 35;
  for (var i = 0; i < this.meshMod.stickerMeshes.length; i++) {
    var mesh = this.meshMod.stickerMeshes[i];
    if (!mesh.userData.isSticker) continue;
    mesh.getWorldPosition(vec);
    vec.project(this.rendererMod.camera);
    if (vec.z >= 1) continue;
    var sx = (vec.x * 0.5 + 0.5) * w;
    var sy = (-vec.y * 0.5 + 0.5) * h;
    var dx = sx - (clientX - rect.left);
    var dy = sy - (clientY - rect.top);
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < bestDist) { bestDist = dist; best = mesh; }
  }
  return best;
};

$3d.prototype.rebuild = function() {
  var g = this.rendererMod.cubeGroup;
  this.meshMod.destroy(g);
  if (this.cube) {
    this.meshMod.build(g);
  }
};

$3d.prototype.resetView = function() {
  this.rendererMod.camera.position.set(4.18, 3.14, 5.23);
  this.rendererMod.camera.lookAt(0, 0, 0);
  this.orbitCtrl.reset();
};

$3d.prototype.snapToFace = function(face) {
  if (face === "C") face = "F";
  this.focusFace(face);
};

$3d.prototype.focusFace = function(face) {
  var normals = {
    U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
    F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
    L: new THREE.Vector3(-1, 0, 0), R: new THREE.Vector3(1, 0, 0)
  };
  var n = normals[face];
  if (!n) return;
  var camPos = n.clone().multiplyScalar(6);
  this.rendererMod.camera.position.copy(camPos);
  this.rendererMod.camera.lookAt(0, 0, 0);
  this.orbitCtrl.reset();
};

$3d.prototype.toggleOrbitDir = function() {
  this.orbitCtrl.toggleInverted();
};

$3d.prototype._createLabelSprite = function(text) {
  var canvas = document.createElement('canvas');
  var size = 128;
  canvas.width = size; canvas.height = size;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath(); ctx.roundRect(4, 4, size-8, size-8, 8); ctx.fill();
  ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(4, 4, size-8, size-8, 8); ctx.stroke();
  ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f0'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText(text, size/2, size/2 + 1);
  var texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  var mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: true });
  return new THREE.Sprite(mat);
};

$3d.prototype.destroy = function() {
  this.rendererMod.stop();
  if (this.gesture) this.gesture.destroy();
  this.rendererMod.destroy();
  var g = this.rendererMod.cubeGroup;
  this.meshMod.destroy(g);
};

$3d.prototype.resetMoves = function() {
  this.animator.resetMoves();
};

// Backward compat properties for app.js
Object.defineProperty($3d.prototype, 'stickerMeshes', {
  get: function() { return this.meshMod.stickerMeshes; }
});
Object.defineProperty($3d.prototype, 'cubieCores', {
  get: function() { return this.meshMod.cubieCores; }
});
Object.defineProperty($3d.prototype, 'cubeGroup', {
  get: function() { return this.rendererMod.cubeGroup; }
});
Object.defineProperty($3d.prototype, 'camera', {
  get: function() { return this.rendererMod.camera; }
});
Object.defineProperty($3d.prototype, 'scene', {
  get: function() { return this.rendererMod.scene; }
});
Object.defineProperty($3d.prototype, 'renderer', {
  get: function() { return this.rendererMod.renderer; }
});
Object.defineProperty($3d.prototype, 'spriteLabels', {
  get: function() { return []; }
});

// Backward compat for app.js
Object.defineProperty($3d.prototype, 'moves', {
  get: function() { return this.animator ? this.animator.moves : 0; },
  set: function(v) { if (this.animator) this.animator._moves = v; }
});

window.CubeBuddy3D = $3d;

})();
