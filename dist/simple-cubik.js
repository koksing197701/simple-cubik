// Simple Cubik v5.1 — Domain Locked: synthex.my, cubikbuddy.com

(function(){var a=['synthex.my','cubikbuddy.com','localhost','127.0.0.1'];var h=window.location.hostname;var o=false;for(var i=0;i<a.length;i++){if(h===a[i]||h.endsWith('.'+a[i])){o=true;break;}}if(!o){console.warn('Simple Cubik: unauthorized domain ('+h+').');return;}})();

// Cube Ring System - Ring constants and swipe detection
// Module:    RingSystem
// Version:   1.0.0
// API:       CubeRingSystem.RING_STICKERS, CubeRingSystem.resolveRingSwipe()
//            resolveRingSwipe(startFaceIdx, startRow, startCol, endFaceIdx, endRow, endCol)
// Depends:   None (pure JS)
// Changelog:
//   1.0.0 - Initial modular version. Extracted from cube-3d-view.js v2.11.4.
//           Contains RING_STICKERS, RING_FORWARD_IS_CW, FACE_IDX_TO_LETTER,
//           stickerId(), resolveRingSwipe()

(function() {
'use strict';

var RING_STICKERS = {
  U: ['F0','F1','F2','R0','R1','R2','B0','B1','B2','L0','L1','L2'],
  D: ['F6','F7','F8','R6','R7','R8','B6','B7','B8','L6','L7','L8'],
  L: ['F0','F3','F6','D0','D3','D6','B8','B5','B2','U0','U3','U6'],
  R: ['F2','F5','F8','D2','D5','D8','B6','B3','B0','U2','U5','U8'],
  F: ['L2','L5','L8','D0','D1','D2','R6','R3','R0','U8','U7','U6'],
  B: ['R2','R5','R8','D8','D7','D6','L6','L3','L0','U0','U1','U2'],
  S: ['F3','F4','F5','R3','R4','R5','B3','B4','B5','L3','L4','L5'],
  M: ['F1','F4','F7','D1','D4','D7','B7','B4','B1','U1','U4','U7'],
  E: ['L1','L4','L7','D3','D4','D5','R7','R4','R1','U5','U4','U3'],
};

var RING_FORWARD_IS_CW = {
  U: false, D: true,  L: true,  R: false,
  F: false, B: false, S: false, M: true,  E: true,
};

var FACE_IDX_TO_LETTER = ['U','D','F','B','L','R'];

function stickerId(faceIdx, row, col) {
  return FACE_IDX_TO_LETTER[faceIdx] + (row * 3 + col);
}

function resolveRingSwipe(startFaceIdx, startRow, startCol, endFaceIdx, endRow, endCol) {
  var startId = stickerId(startFaceIdx, startRow, startCol);
  var endId = stickerId(endFaceIdx, endRow, endCol);
  if (startId === endId) return null;

  for (var ringName in RING_STICKERS) {
    var stickers = RING_STICKERS[ringName];
    var si = stickers.indexOf(startId);
    var ei = stickers.indexOf(endId);
    if (si === -1 || ei === -1) continue;

    var len = stickers.length;
    var fwdSteps = (ei - si + len) % len;
    var bwdSteps = (si - ei + len) % len;
    var gap = Math.min(fwdSteps, bwdSteps);
    if (gap === 0 || gap > 4) return null;

    var goingForward = fwdSteps <= bwdSteps;
    var isCw = goingForward ? RING_FORWARD_IS_CW[ringName] : !RING_FORWARD_IS_CW[ringName];

    return { ring: ringName, turn: ringName, isCw: isCw, gap: gap };
  }
  return null;
}

window.CubeRingSystem = {
  RING_STICKERS: RING_STICKERS,
  RING_FORWARD_IS_CW: RING_FORWARD_IS_CW,
  FACE_IDX_TO_LETTER: FACE_IDX_TO_LETTER,
  stickerId: stickerId,
  resolveRingSwipe: resolveRingSwipe,
};

// Also expose standalone for direct call compatibility
window.resolveRingSwipe = resolveRingSwipe;

})();

// Cube Renderer - Three.js scene, camera, lighting, render loop
// Module:    CubeRenderer
// Version:   1.0.0
// API:       constructor(container)
//            start(), stop(), destroy()
//            setBackground(color)
//            Properties: scene, camera, renderer, cubeGroup
// Depends:   THREE (global)
// Changelog:
//   1.0.0 - Initial modular version. Extracted from cube-3d-view.js v2.11.4.
//           Scene, PerspectiveCamera, WebGLRenderer, Ambient+Hemisphere lights.

(function() {
'use strict';

function CubeRenderer(container) {
  this.container = container;
  this._running = false;
  this._animId = null;

  var w = container.clientWidth || 400;
  var h = container.clientHeight || 400;

  this.scene = new THREE.Scene();

  this.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
  this.camera.position.set(4.18, 3.14, 5.23);
  this.camera.lookAt(0, 0, 0);

  this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  this.renderer.setSize(w, h);
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  this.renderer.domElement.style.touchAction = 'none';
  container.appendChild(this.renderer.domElement);

  // Lighting
  var ambient = new THREE.AmbientLight(0xffffff, 1.0);
  this.scene.add(ambient);

  var hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.3);
  this.scene.add(hemi);

  // Cube group
  this.cubeGroup = new THREE.Group();
  this.scene.add(this.cubeGroup);

  // Resize handler
  var self = this;
  this._onResize = function() {
    var r = container.getBoundingClientRect();
    var cw = r.width || 400;
    var ch = r.height || 400;
    self.camera.aspect = cw / ch;
    self.camera.updateProjectionMatrix();
    self.renderer.setSize(cw, ch);
  };
  window.addEventListener('resize', this._onResize);
  window.addEventListener('orientationchange', function() { setTimeout(self._onResize, 300); });
}

CubeRenderer.prototype.setBackground = function(color) {
  this.scene.background = new THREE.Color(color);
};

CubeRenderer.prototype.start = function() {
  if (this._running) return;
  this._running = true;
  var self = this;
  function loop() {
    if (!self._running) return;
    self._animId = requestAnimationFrame(loop);
    self.renderer.render(self.scene, self.camera);
  }
  loop();
};

CubeRenderer.prototype.stop = function() {
  this._running = false;
  if (this._animId) {
    cancelAnimationFrame(this._animId);
    this._animId = null;
  }
};

CubeRenderer.prototype.destroy = function() {
  this.stop();
  window.removeEventListener('resize', this._onResize);
  if (this.renderer.domElement.parentNode) {
    this.renderer.domElement.remove();
  }
  // Dispose all geometries/materials
  this.scene.traverse(function(child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  });
  this.renderer.dispose();
};

window.CubeRenderer = CubeRenderer;

})();

// Orbit Controller - Camera orbit on empty-space drag
// Module:    OrbitController
// Version:   1.0.0
// API:       constructor(cubeGroup, camera)
//            onDrag(dx, dy), toggleInverted(), reset()
//            Property: isInverted (bool, read-only)
// Depends:   THREE (global)
// Changelog:
//   1.0.0 - Initial modular version. Extracted from cube-3d-view.js v2.11.4.
//           Quaternion-based orbit around camera up/right vectors.

(function() {
'use strict';

function OrbitController(cubeGroup, camera) {
  this.cubeGroup = cubeGroup;
  this.camera = camera;
  this._inverted = false;
}

Object.defineProperty(OrbitController.prototype, 'isInverted', {
  get: function() { return this._inverted; }
});

OrbitController.prototype.toggleInverted = function() {
  this._inverted = !this._inverted;
};

OrbitController.prototype.onDrag = function(dx, dy) {
  var inv = this._inverted ? -1 : 1;
  var worldUp = this.camera.up.clone();
  var camPos = this.camera.position.clone();
  var camForward = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camPos).normalize();
  var camRight = new THREE.Vector3().crossVectors(camForward, worldUp).normalize();
  var camUp = new THREE.Vector3().crossVectors(camRight, camForward).normalize();

  var SCALE = 0.012;
  var angleH = dx * SCALE * inv;
  var angleV = dy * SCALE * inv;
  var qH = new THREE.Quaternion().setFromAxisAngle(camUp, angleH);
  var qV = new THREE.Quaternion().setFromAxisAngle(camRight, angleV);

  this.cubeGroup.quaternion.premultiply(qH);
  this.cubeGroup.quaternion.premultiply(qV);
  this.cubeGroup.rotation.setFromQuaternion(this.cubeGroup.quaternion);
};

OrbitController.prototype.reset = function() {
  this.cubeGroup.quaternion.identity();
  this.cubeGroup.rotation.setFromQuaternion(this.cubeGroup.quaternion);
};

window.OrbitController = OrbitController;

})();

// Cube Mesh - Cubie, core, and sticker mesh creation/destruction
// Module:    CubeMesh
// Version:   1.0.0
// API:       constructor({cube, cubieSize, gap, stickerThickness, coreSize, coreColor})
//            build(cubeGroup) — creates 27 cubies with cores + 54-162 sticker meshes
//            destroy(cubeGroup) — removes and disposes all geometries
//            Properties: stickerMeshes[], cubieCores[]
// Depends:   THREE (global)
// Changelog:
//   1.0.0 - Initial modular version. Extracted from cube-3d-view.js v2.11.4.
//           Canvas texture with 12px roundRect corners. Core = cubieSize.

(function() {
'use strict';

// Polyfill roundRect for Three.js r128 (missing from Shape)
if (!THREE.Shape.prototype.roundRect) {
  THREE.Shape.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    var sx = x, sy = y;
    var ex = x + w, ey = y + h;
    this.moveTo(sx + r, sy);
    this.lineTo(ex - r, sy);
    this.quadraticCurveTo(ex, sy, ex, sy + r);
    this.lineTo(ex, ey - r);
    this.quadraticCurveTo(ex, ey, ex - r, ey);
    this.lineTo(sx + r, ey);
    this.quadraticCurveTo(sx, ey, sx, ey - r);
    this.lineTo(sx, sy + r);
    this.quadraticCurveTo(sx, sy, sx + r, sy);
    return this;
  };
}

function CubeMesh(options) {
  options = options || {};
  this.cube = options.cube || null;
  this.cubieSize = options.cubieSize || 0.70;
  this.gap = options.gap || 0.78;
  this.stickerThickness = options.stickerThickness || 0.04;
  this.coreSize = options.coreSize || this.cubieSize;
  this.coreColor = options.coreColor || 0x111111;

  this._stickerMeshes = [];
  this._cubieCores = [];

  this.faceGeo = new THREE.BoxGeometry(this.cubieSize, this.cubieSize, this.stickerThickness);
  this.coreMat = new THREE.MeshStandardMaterial({ color: this.coreColor, roughness: 0.9 });

  // Sticker texture colors
  this._colors = [
    0xffffff, // 0: White (U)
    0xffff00, // 1: Yellow (D)
    0x00ff00, // 2: Green (F)
    0x3366ff, // 3: Blue (B)
    0xff8800, // 4: Orange (L)
    0xff0000, // 5: Red (R)
    0x222222, // 6: internal (black)
  ];
}

Object.defineProperty(CubeMesh.prototype, 'stickerMeshes', {
  get: function() { return this._stickerMeshes; }
});
Object.defineProperty(CubeMesh.prototype, 'cubieCores', {
  get: function() { return this._cubieCores; }
});

CubeMesh.prototype._getStickerTexture = function(colorIdx) {
  var c = this._colors[colorIdx] || 0x222222;
  var canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
};

CubeMesh.prototype.build = function(cubeGroup) {
  var g = cubeGroup;
  this._stickerMeshes = [];
  this._cubieCores = [];

  if (!this.cube) return;

  var state = this.cube.state;
  var get = function(r, c, f) { return state[f * 9 + r * 3 + c]; };

  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      for (var z = -1; z <= 1; z++) {
        var cubie = new THREE.Group();
        cubie.userData = { isCubieGroup: true };
        cubie.position.set(x * this.gap, y * this.gap, z * this.gap);

        var core = new THREE.Mesh(
          new THREE.BoxGeometry(this.coreSize, this.coreSize, this.coreSize),
          this.coreMat
        );
        core.castShadow = true;
        core.userData = { isCore: true };
        cubie.add(core);
        this._cubieCores.push(core);

        var facelets = {
          'px': { f: 5, r: 1-y, c: 1-z, ext: x === 1 },
          'nx': { f: 4, r: 1-y, c: z+1, ext: x === -1 },
          'py': { f: 0, r: z+1, c: x+1, ext: y === 1 },
          'ny': { f: 1, r: 1-z, c: x+1, ext: y === -1 },
          'pz': { f: 2, r: 1-y, c: x+1, ext: z === 1 },
          'nz': { f: 3, r: 1-y, c: 1-x, ext: z === -1 },
        };

        var halfOffset = this.cubieSize / 2;
        var faceNormals = {
          'px': [ halfOffset, 0, 0], 'nx': [-halfOffset, 0, 0],
          'py': [ 0, halfOffset, 0], 'ny': [ 0,-halfOffset, 0],
          'pz': [ 0, 0, halfOffset], 'nz': [ 0, 0,-halfOffset],
        };

        for (var dir in facelets) {
          var fl = facelets[dir];
          if (!fl.ext) continue;
          var ci = get(fl.r, fl.c, fl.f);
          var n = faceNormals[dir];
          var lookTarget = new THREE.Vector3(n[0]*2, n[1]*2, n[2]*2);

          // Dark base frame (full size, 3D depth)
          var borderMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
          var baseSticker = new THREE.Mesh(
            new THREE.BoxGeometry(this.cubieSize, this.cubieSize, this.stickerThickness),
            borderMat
          );
          baseSticker.userData = { isSticker:true, isExternal:fl.ext, faceIdx:fl.f, row:fl.r, col:fl.c };
          baseSticker.position.set(n[0], n[1], n[2]);
          baseSticker.lookAt(lookTarget);
          cubie.add(baseSticker);
          this._stickerMeshes.push(baseSticker);

          // Colored face on top (92% size, 3D rounded rectangle via extrusion)
          var fs = this.cubieSize * 0.92;
          var shape = new THREE.Shape();
          var rr = fs * 0.18;  // round radius
          shape.roundRect(-fs/2, -fs/2, fs, fs, rr);
          var faceGeo = new THREE.ExtrudeGeometry(shape, { depth: this.stickerThickness, bevelEnabled: false });
          faceGeo.translate(0, 0, -this.stickerThickness / 2);
          faceGeo.computeVertexNormals();
          var faceSticker = new THREE.Mesh(
            faceGeo,
            new THREE.MeshStandardMaterial({ map: this._getStickerTexture(ci), roughness: 0.5, metalness: 0.1 })
          );
          faceSticker.userData = { isSticker:true, isExternal:fl.ext, faceIdx:fl.f, row:fl.r, col:fl.c };
          // Push forward by half thickness so it sits on the base surface
          var sign = (n[0]||n[1]||n[2]) > 0 ? 1 : -1;
          faceSticker.position.set(
            n[0] + (n[0]!==0?sign*this.stickerThickness*0.5:0),
            n[1] + (n[1]!==0?sign*this.stickerThickness*0.5:0),
            n[2] + (n[2]!==0?sign*this.stickerThickness*0.5:0)
          );
          faceSticker.lookAt(lookTarget);
          cubie.add(faceSticker);
          this._stickerMeshes.push(faceSticker);
        }
        g.add(cubie);
      }
    }
  }
};

CubeMesh.prototype.destroy = function(cubeGroup) {
  var g = cubeGroup;
  var self = this;
  while (g.children.length) {
    var c = g.children[0];
    c.traverse(function(child) {
      if (child.geometry && child.geometry !== self.faceGeo) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
    g.remove(c);
  }
  this._stickerMeshes = [];
  this._cubieCores = [];
};

CubeMesh.prototype.updateStickerUserData = function() {
  var gap = this.gap;
  // facelets and formulas for mapping
  var faceData = {
    'px': { f: 5, r: function(gy,gz) { return 1-gy; }, c: function(gy,gz) { return 1-gz; } },
    'nx': { f: 4, r: function(gy,gz) { return 1-gy; }, c: function(gy,gz) { return gz+1; } },
    'py': { f: 0, r: function(gz,gx) { return gz+1; }, c: function(gz,gx) { return gx+1; } },
    'ny': { f: 1, r: function(gz,gx) { return 1-gz; }, c: function(gz,gx) { return gx+1; } },
    'pz': { f: 2, r: function(gy,gx) { return 1-gy; }, c: function(gy,gx) { return gx+1; } },
    'nz': { f: 3, r: function(gy,gx) { return 1-gy; }, c: function(gy,gx) { return 1-gx; } },
  };
  for (var i = 0; i < this._stickerMeshes.length; i++) {
    var mesh = this._stickerMeshes[i];
    var cubie = mesh.parent;
    if (!cubie) continue;

    var px = Math.round(cubie.position.x / 0.01) * 0.01;
    var py = Math.round(cubie.position.y / 0.01) * 0.01;
    var pz = Math.round(cubie.position.z / 0.01) * 0.01;

    // Determine face direction from sticker's WORLD position
    // Transform sticker local direction to world space via cubie quaternion
    var sp = mesh.position.clone();
    var worldDir = sp.clone().applyQuaternion(cubie.quaternion).normalize();
    var dir = '';
    if (Math.abs(worldDir.x) > 0.5) dir = worldDir.x > 0 ? 'px' : 'nx';
    else if (Math.abs(worldDir.y) > 0.5) dir = worldDir.y > 0 ? 'py' : 'ny';
    else if (Math.abs(worldDir.z) > 0.5) dir = worldDir.z > 0 ? 'pz' : 'nz';
    if (!dir) continue;

    var gx = Math.round(px / gap);
    var gy = Math.round(py / gap);
    var gz = Math.round(pz / gap);

    // Update external/internal flag
    var isExt = (dir === 'px' && gx === 1) || (dir === 'nx' && gx === -1) ||
                (dir === 'py' && gy === 1) || (dir === 'ny' && gy === -1) ||
                (dir === 'pz' && gz === 1) || (dir === 'nz' && gz === -1);
    mesh.userData.isExternal = isExt;

    var fd = faceData[dir];
    var row, col;
    if (dir === 'px' || dir === 'nx') {
      row = fd.r(gy, gz); col = fd.c(gy, gz);
    } else if (dir === 'py' || dir === 'ny') {
      row = fd.r(gz, gx); col = fd.c(gz, gx);
    } else {
      row = fd.r(gy, gx); col = fd.c(gy, gx);
    }
    mesh.userData.faceIdx = fd.f;
    mesh.userData.row = row;
    mesh.userData.col = col;
  }
};

window.CubeMesh = CubeMesh;

})();

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
    midLeft: { face: 'S', isSlice: true, dir: 'right' },
    midRight: { face: 'S', isSlice: true, dir: 'left' },
    midTop: { face: 'M', isSlice: true, dir: 'down' },
    midBottom: { face: 'M', isSlice: true, dir: 'up' },
  },
  3: { // B
    top: { face: 'U', isSlice: false },
    bottom: { face: 'D', isSlice: false },
    left: { face: 'R', isSlice: false, invert: true },
    right: { face: 'L', isSlice: false, invert: true },
    midLeft: { face: 'S', isSlice: true, dir: 'right' },
    midRight: { face: 'S', isSlice: true, dir: 'left' },
    midTop: { face: 'M', isSlice: true, dir: 'down', invert: true },
    midBottom: { face: 'M', isSlice: true, dir: 'up', invert: true },
  },
  0: { // U
    top: { face: 'B', isSlice: false },
    bottom: { face: 'F', isSlice: false },
    left: { face: 'L', isSlice: false },
    right: { face: 'R', isSlice: false },
    midLeft: { face: 'E', isSlice: true, dir: 'right' },
    midRight: { face: 'E', isSlice: true, dir: 'left' },
    midTop: { face: 'M', isSlice: true, dir: 'down' },
    midBottom: { face: 'M', isSlice: true, dir: 'up' },
  },
  1: { // D
    top: { face: 'F', isSlice: false },
    bottom: { face: 'B', isSlice: false },
    left: { face: 'L', isSlice: false },
    right: { face: 'R', isSlice: false },
    midLeft: { face: 'E', isSlice: true, dir: 'left' },
    midRight: { face: 'E', isSlice: true, dir: 'right' },
    midTop: { face: 'M', isSlice: true, dir: 'down' },
    midBottom: { face: 'M', isSlice: true, dir: 'up' },
  },
  4: { // L
    top: { face: 'U', isSlice: false },
    bottom: { face: 'D', isSlice: false },
    left: { face: 'B', isSlice: false },
    right: { face: 'F', isSlice: false },
    midLeft: { face: 'S', isSlice: true, dir: 'right' },
    midRight: { face: 'S', isSlice: true, dir: 'left' },
    midTop: { face: 'E', isSlice: true, dir: 'down' },
    midBottom: { face: 'E', isSlice: true, dir: 'up' },
  },
  5: { // R
    top: { face: 'U', isSlice: false },
    bottom: { face: 'D', isSlice: false },
    left: { face: 'F', isSlice: false },
    right: { face: 'B', isSlice: false },
    midLeft: { face: 'S', isSlice: true, dir: 'right' },
    midRight: { face: 'S', isSlice: true, dir: 'left' },
    midTop: { face: 'E', isSlice: true, dir: 'down', invert: true },
    midBottom: { face: 'E', isSlice: true, dir: 'up', invert: true },
  },
};

window.TurnAnimator = TurnAnimator;

})();

// Gesture Handler - Pointer events for 3D cube interaction
// Module:    GestureHandler
// Version:   1.0.0
// API:       constructor(domElement, getStickerAtPoint, getCubieCores, getCamera)
//            destroy()
//            Callbacks: onSwipe, onOrbit, onTap, onDoubleTap, onDebugLog
// Depends:   THREE (global), CubeMesh (for core hit test)
// Changelog:
//   1.0.0 - Initial modular version. Extracted from cube-3d-view.js v2.11.4.
//           Detects tap, double-tap (center sticker), swipe (ring-based), orbit.

(function() {
'use strict';

function GestureHandler(domElement, getStickerAtPoint, getCubieCores, getCamera) {
  this.domElement = domElement;
  this._getStickerAtPoint = getStickerAtPoint;
  this._getCubieCores = getCubieCores;
  this._getCamera = getCamera || null;

  this.onSwipe = null;     // callback({startSticker, endSticker, dx, dy})
  this.onOrbit = null;     // callback({dx, dy})
  this.onTap = null;       // callback({face})
  this.onDoubleTap = null; // callback({face})
  this.onDebugLog = null;  // callback(msg)

  this._lastPointer = { x: 0, y: 0 };
  this._pointerDown = { x: 0, y: 0 };
  this._isDragging = false;
  this._swipeFace = null;      // null | {} (orbit) | string (face letter)
  this._swipeSticker = null;   // null | {faceIdx, row, col}
  this._lastTapTime = 0;
  this._lastTapTimer = null;
  this._faceLetters = ['U','D','F','B','L','R'];
  this._SWIPE_THRESHOLD = 15;

  var self = this;
  this._onPointerDown = function(e) { self._handlePointerDown(e); };
  this._onPointerMove = function(e) { self._handlePointerMove(e); };
  this._onPointerUp = function(e) { self._handlePointerUp(e); };

  domElement.addEventListener('pointerdown', this._onPointerDown);
  domElement.addEventListener('pointermove', this._onPointerMove);
  domElement.addEventListener('pointerup', this._onPointerUp);
}

GestureHandler.prototype._debug = function(msg) {
  if (this.onDebugLog) this.onDebugLog(msg);
};

GestureHandler.prototype._handlePointerDown = function(e) {
  this._lastPointer = { x: e.clientX, y: e.clientY };
  this._pointerDown = { x: e.clientX, y: e.clientY };
  this._isDragging = false;
  this._swipeFace = null;
  this._swipeSticker = null;

  var hitMesh = this._getStickerAtPoint(e.clientX, e.clientY);
  if (hitMesh) {
    var ud = hitMesh.userData;
    this._swipeFace = this._faceLetters[ud.faceIdx] || '';
    this._swipeSticker = { faceIdx: ud.faceIdx, row: ud.row, col: ud.col };
    this._debug('HIT: ' + this._faceLetters[ud.faceIdx] + '(' + ud.row + ',' + ud.col + ') ext=' + ud.isExternal);
  } else {
    // Check core hit for orbit
    var cores = this._getCubieCores();
    if (cores && cores.length > 0 && this._getCamera) {
      var rect = this.domElement.getBoundingClientRect();
      var mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      var my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      var vec = new THREE.Vector2(mx, my);
      var ray = new THREE.Raycaster();
      ray.setFromCamera(vec, this._getCamera());
      var coreHits = ray.intersectObjects(cores, false);
      this._swipeFace = coreHits.length > 0 ? {} : null;
    } else {
      this._swipeFace = {};
    }
    this._debug('HIT: core (orbit mode)');
  }
};

GestureHandler.prototype._handlePointerMove = function(e) {
  if (e.buttons !== 1) return;
  var dx = e.clientX - this._lastPointer.x;
  var dy = e.clientY - this._lastPointer.y;

  if (!this._isDragging) {
    if (Math.sqrt(dx*dx + dy*dy) < 10) return;
    this._isDragging = true;
  }

  // If on a sticker, we'd do proportional drag here in the future
  if (this._swipeFace && typeof this._swipeFace === 'string') {
    this._lastPointer = { x: e.clientX, y: e.clientY };
    return; // placeholder for proportional drag
  }

  // Orbit mode
  if (this.onOrbit) {
    this.onOrbit({ dx: dx, dy: dy });
  }

  this._lastPointer = { x: e.clientX, y: e.clientY };
};

GestureHandler.prototype._handlePointerUp = function(e) {
  if (typeof this._swipeFace !== 'string') {
    this._isDragging = false;
    this._swipeFace = null;
    this._swipeSticker = null;
    return;
  }

  var now = Date.now();
  var tappedFace = this._swipeFace;
  var dx = e.clientX - this._pointerDown.x;
  var dy = e.clientY - this._pointerDown.y;
  var dist = Math.sqrt(dx*dx + dy*dy);

  // Swipe detection
  if (dist > this._SWIPE_THRESHOLD && this._swipeSticker) {
    var startSticker = this._swipeSticker;
    var hitMesh = this._getStickerAtPoint(e.clientX, e.clientY);

    if (hitMesh) {
      var eud = hitMesh.userData;
      var endSticker = { faceIdx: eud.faceIdx, row: eud.row, col: eud.col };

      if (this.onSwipe) {
        this.onSwipe({
          startSticker: startSticker,
          endSticker: endSticker,
          dx: dx,
          dy: dy
        });
      }
    }

    this._isDragging = false;
    this._swipeFace = null;
    this._swipeSticker = null;
    return;
  }

  // Tap — only center sticker
  if (this._swipeSticker && dist <= this._SWIPE_THRESHOLD) {
    var st = this._swipeSticker;
    if (st.row !== 1 || st.col !== 1) {
      this._debug('TAP blocked: not center (' + st.row + ',' + st.col + ')');
      this._isDragging = false;
      this._swipeFace = null;
      this._swipeSticker = null;
      return;
    }
  }

  // Double-tap handling
  var self = this;
  if (now - this._lastTapTime < 350) {
    if (this._lastTapTimer) clearTimeout(this._lastTapTimer);
    this._lastTapTime = 0;
    if (this.onDoubleTap) this.onDoubleTap({ face: tappedFace });
  } else {
    this._lastTapTime = now;
    if (this._lastTapTimer) clearTimeout(this._lastTapTimer);
    this._lastTapTimer = setTimeout(function() {
      if (self._lastTapTime !== 0) {
        if (self.onTap) self.onTap({ face: tappedFace });
        self._lastTapTime = 0;
        self._lastTapTimer = null;
      }
    }, 350);
  }

  this._isDragging = false;
  this._swipeFace = null;
  this._swipeSticker = null;
};

GestureHandler.prototype.destroy = function() {
  this.domElement.removeEventListener('pointerdown', this._onPointerDown);
  this.domElement.removeEventListener('pointermove', this._onPointerMove);
  this.domElement.removeEventListener('pointerup', this._onPointerUp);
  if (this._lastTapTimer) clearTimeout(this._lastTapTimer);
};

window.GestureHandler = GestureHandler;

})();

// Cube Buddy - Rubik's Cube Model
// Face indices: 0=Up(white), 1=Down(yellow), 2=Front(green),
//               3=Back(blue), 4=Left(orange), 5=Right(red)
// Version: 2.11.3

const FACE_COLORS = [
  '#FAFAFA', // Up - White (brighter)
  '#FFD500', // Down - Yellow (more golden, distinct from orange)
  '#4CAF50', // Front - Green
  '#2196F3', // Back - Blue
  '#FF6600', // Left - Orange
  '#F44336', // Right - Red
];

const FACE_LETTERS = ['U', 'D', 'F', 'B', 'L', 'R'];
const FACE_COLORS_HEX = [0xffffff, 0xffd500, 0x4caf50, 0x2196f3, 0xff6600, 0xf44336];
const FACE_COLORS_RGB = {
  '#FAFAFA': { r: 0.98, g: 0.98, b: 0.98 },
  '#FFD500': { r: 1.0, g: 0.84, b: 0.0 },
  '#4CAF50': { r: 0.3, g: 0.69, b: 0.31 },
  '#2196F3': { r: 0.13, g: 0.59, b: 0.95 },
  '#FF6600': { r: 1.0, g: 0.4, b: 0.0 },
  '#F44336': { r: 0.96, g: 0.26, b: 0.21 },
};

class RubiksCube {
  constructor() {
    this._state = this._solvedState();
  }

  _solvedState() {
    const state = new Array(54);
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < 9; i++) {
        state[face * 9 + i] = face;
      }
    }
    return state;
  }

  get state() {
    return [...this._state];
  }

  set state(s) {
    this._state = [...s];
  }

  get isSolved() {
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < 9; i++) {
        if (this._state[face * 9 + i] !== face) return false;
      }
    }
    return true;
  }

  getFaceletColor(face, row, col) {
    return this._state[face * 9 + row * 3 + col];
  }

  _rotateFaceCW(face) {
    const offset = face * 9;
    const old = [...this._state];
    this._state[offset + 0] = old[offset + 6];
    this._state[offset + 1] = old[offset + 3];
    this._state[offset + 2] = old[offset + 0];
    this._state[offset + 3] = old[offset + 7];
    this._state[offset + 4] = old[offset + 4];
    this._state[offset + 5] = old[offset + 1];
    this._state[offset + 6] = old[offset + 8];
    this._state[offset + 7] = old[offset + 5];
    this._state[offset + 8] = old[offset + 2];
  }

  // === VERIFIED TURN FUNCTIONS (v2.6.2) ===
  // U CW: F row2 → R col2 reversed → B row2 → L col2 reversed → F row2
  turnU() {
    this._rotateFaceCW(0);
    const s = [...this._state];
    this._state[45]=s[27]; this._state[46]=s[28]; this._state[47]=s[29];
    this._state[18]=s[45]; this._state[19]=s[46]; this._state[20]=s[47];
    this._state[36]=s[18]; this._state[37]=s[19]; this._state[38]=s[20];
    this._state[27]=s[36]; this._state[28]=s[37]; this._state[29]=s[38];
  }

  turnUprime() { for (let i = 0; i < 3; i++) this.turnU(); }

  // D CW: F row0 → L col2 → B row0 → R col0 → F row0
  turnD() {
    this._rotateFaceCW(1);
    const s = [...this._state];
    this._state[51]=s[24]; this._state[52]=s[25]; this._state[53]=s[26];
    this._state[33]=s[51]; this._state[34]=s[52]; this._state[35]=s[53];
    this._state[42]=s[33]; this._state[43]=s[34]; this._state[44]=s[35];
    this._state[24]=s[42]; this._state[25]=s[43]; this._state[26]=s[44];
  }

  turnDprime() { for (let i = 0; i < 3; i++) this.turnD(); }

  // F CW: U row2 (reversed) → R col0 → D row0 (reversed) → L col2 → U row2
  turnF() {
    this._rotateFaceCW(2);
    const s = [...this._state];
    this._state[45]=s[6];  this._state[48]=s[7];  this._state[51]=s[8];
    this._state[9]=s[51];  this._state[10]=s[48]; this._state[11]=s[45];
    this._state[38]=s[9];  this._state[41]=s[10]; this._state[44]=s[11];
    this._state[6]=s[44];  this._state[7]=s[41];  this._state[8]=s[38];
  }

  turnFprime() { for (let i = 0; i < 3; i++) this.turnF(); }

  // B CW: U row0 → L col0 → D row2 → R col2 → U row0 (all reversed for perpendicular axes)
  turnB() {
    this._rotateFaceCW(3);
    const s = [...this._state];
    this._state[42]=s[0]; this._state[39]=s[1]; this._state[36]=s[2];
    this._state[15]=s[36]; this._state[16]=s[39]; this._state[17]=s[42];
    this._state[53]=s[15]; this._state[50]=s[16]; this._state[47]=s[17];
    this._state[2]=s[53];  this._state[1]=s[50];  this._state[0]=s[47];
  }

  turnBprime() { for (let i = 0; i < 3; i++) this.turnB(); }

  // L CW: U col0 → F col0 → D col0 → B col2 → U col0
  turnL() {
    this._rotateFaceCW(4);
    const s = [...this._state];
    this._state[18]=s[0];  this._state[21]=s[3];  this._state[24]=s[6];
    this._state[9]=s[18];  this._state[12]=s[21]; this._state[15]=s[24];
    this._state[35]=s[9];  this._state[32]=s[12]; this._state[29]=s[15];
    this._state[0]=s[35];  this._state[3]=s[32];  this._state[6]=s[29];
  }

  turnLprime() { for (let i = 0; i < 3; i++) this.turnL(); }

  // R CW: U col2 → B col0 → D col2 → F col2 → U col2
  turnR() {
    this._rotateFaceCW(5);
    const s = [...this._state];
    this._state[2]=s[20];  this._state[5]=s[23];  this._state[8]=s[26];
    this._state[33]=s[2];  this._state[30]=s[5];  this._state[27]=s[8];
    this._state[11]=s[33]; this._state[14]=s[30]; this._state[17]=s[27];
    this._state[20]=s[11]; this._state[23]=s[14]; this._state[26]=s[17];
  }

  turnRprime() { for (let i = 0; i < 3; i++) this.turnR(); }

  // S CW — moves S-ring stickers (F3,R3,B3,L3)
  // LEFT swipe: 30→48→21→39→30, 31→49→22→40→31, 32→50→23→41→32
  turnSCW() {
    const s = [...this._state];
    this._state[48]=s[30]; this._state[21]=s[48];
    this._state[39]=s[21]; this._state[30]=s[39];
    this._state[49]=s[31]; this._state[22]=s[49];
    this._state[40]=s[22]; this._state[31]=s[40];
    this._state[50]=s[32]; this._state[23]=s[50];
    this._state[41]=s[23]; this._state[32]=s[41];
  }

  // S CCW
  turnSCCW() {
    const s = [...this._state];
    // RIGHT swipe: 30→39→21→48→30, 31→40→22→49→31, 32→41→23→50→32
    this._state[39]=s[30]; this._state[21]=s[39];
    this._state[48]=s[21]; this._state[30]=s[48];
    this._state[40]=s[31]; this._state[22]=s[40];
    this._state[49]=s[22]; this._state[31]=s[49];
    this._state[41]=s[32]; this._state[23]=s[41];
    this._state[50]=s[23]; this._state[32]=s[50];
  }

  // M CW: U col1 → F col1 → D col1 → B col1 reversed → U col1
  // U[1,7], F[19,25], D[10,16], B[28,34]
  // Centers: U(4)→F(22)→D(13)→B(31)→U(4)
  turnMCW() {
    const s = [...this._state];
    this._state[19]=s[1];  this._state[25]=s[7];
    this._state[10]=s[19]; this._state[16]=s[25];
    this._state[34]=s[10]; this._state[28]=s[16];
    this._state[1]=s[34];  this._state[7]=s[28];
    // Centers float with the slice
    this._state[22]=s[4];  // F center ← old U center
    this._state[13]=s[22]; // D center ← old F center
    this._state[31]=s[13]; // B center ← old D center
    this._state[4]=s[31];  // U center ← old B center
  }

  // M CCW: reverse — 1←19←10←34←1, 7←25←16←28←7
  // Centers: U(4)←F(22)←D(13)←B(31)←U(4)
  turnMCCW() {
    const s = [...this._state];
    this._state[1]=s[19];  this._state[19]=s[10];
    this._state[10]=s[34]; this._state[34]=s[1];
    this._state[7]=s[25];  this._state[25]=s[16];
    this._state[16]=s[28]; this._state[28]=s[7];
    // Centers float with the slice (reverse)
    this._state[4]=s[22];  // U center ← old F center
    this._state[22]=s[13]; // F center ← old D center
    this._state[13]=s[31]; // D center ← old B center
    this._state[31]=s[4];  // B center ← old U center
  }

  // E CW — moves E-ring stickers (U3,L7,D5,R1)
  // LEFT swipe: 3→43→14→46→3, 4→40→13→49→4, 5→37→12→52→5
  turnECW() {
    const s = [...this._state];
    this._state[43]=s[3];  this._state[14]=s[43];
    this._state[46]=s[14]; this._state[3]=s[46];
    this._state[40]=s[4];  this._state[13]=s[40];
    this._state[49]=s[13]; this._state[4]=s[49];
    this._state[37]=s[5];  this._state[12]=s[37];
    this._state[52]=s[12]; this._state[5]=s[52];
  }

  // E CCW
  turnECCW() {
    const s = [...this._state];
    // RIGHT swipe: 3→46→14→43→3, 4→49→13→40→4, 5→52→12→37→5
    this._state[46]=s[3];  this._state[14]=s[46];
    this._state[43]=s[14]; this._state[3]=s[43];
    this._state[49]=s[4];  this._state[13]=s[49];
    this._state[40]=s[13]; this._state[4]=s[40];
    this._state[52]=s[5];  this._state[12]=s[52];
    this._state[37]=s[12]; this._state[5]=s[37];
  }

  // === HIGH-LEVEL MOVE ===
  doMove(move) {
    const m = move.toUpperCase().replace("'","");
    const prime = move.includes("'");
    const n = prime ? 3 : 1;

    // Slice moves
    if (m === 'E') { if (prime) { this.turnECCW(); return; } this.turnECW(); return; }
    if (m === 'M') { for (let i = 0; i < n; i++) this.turnMCW(); return; }
    if (m === 'S') { for (let i = 0; i < n; i++) this.turnSCW(); return; }

    // Face moves via turnFace
    this.turnFace(move);
  }

  reset() {
    this._state = this._solvedState();
  }

  turnFace(move) {
    switch (move.toUpperCase()) {
      case 'U': this.turnU(); break;
      case "U'": this.turnUprime(); break;
      case 'D': this.turnD(); break;
      case "D'": this.turnDprime(); break;
      case 'F': this.turnF(); break;
      case "F'": this.turnFprime(); break;
      case 'B': this.turnB(); break;
      case "B'": this.turnBprime(); break;
      case 'L': this.turnL(); break;
      case "L'": this.turnLprime(); break;
      case 'R': this.turnR(); break;
      case "R'": this.turnRprime(); break;
    }
  }

  scramble(moves = 12) {
    const movesList = ['U', "U'", 'D', "D'", 'F', "F'", 'B', "B'", 'L', "L'", 'R', "R'"];
    let lastMove = '';
    let lastAxis = '';
    const axes = { 'U':'y', 'D':'y', 'F':'z', 'B':'z', 'L':'x', 'R':'x' };
    for (let i = 0; i < moves; i++) {
      let move;
      let attempts = 0;
      do {
        move = movesList[Math.floor(Math.random() * movesList.length)];
        attempts++;
        // Prevent: same face (U then U'), same axis (U then D), keep trying
        const badSameFace = lastMove && move[0] === lastMove[0];
        const badSameAxis = lastAxis && axes[move[0]] === lastAxis;
        if (!badSameFace && !badSameAxis) break;
      } while (attempts < 50);
      this.doMove(move);
      lastMove = move;
      lastAxis = axes[move[0]];
    }
  }
}

window.RubiksCube = RubiksCube;
window.FACE_COLORS = FACE_COLORS;
window.FACE_LETTERS = FACE_LETTERS;
window.FACE_COLORS_HEX = FACE_COLORS_HEX;
window.FACE_COLORS_RGB = FACE_COLORS_RGB;

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
    gap: 0.73,
    stickerThickness: 0.04,
    coreSize: 0.70,
    coreColor: 0x111111
  });

  this.orbitCtrl = new OrbitController(this.rendererMod.cubeGroup, this.rendererMod.camera);

  var self = this;

  this.animator = new TurnAnimator(this.rendererMod.cubeGroup, this.cube, {
    rebuild: function() { self.rebuild(); },
    onStickerUpdate: function() { self.meshMod.updateStickerUserData(); },
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
      var fn = ["U","D","F","B","L","R"];
      var dbg = "Ring: " + result.ring + " → " + result.turn + " " + (result.isCw ? "CW" : "CCW")
              + " | " + fn[data.startSticker.faceIdx] + "(" + data.startSticker.row + "," + data.startSticker.col + ")"
              + "→" + fn[data.endSticker.faceIdx] + "(" + data.endSticker.row + "," + data.endSticker.col + ")";
      var el = document.getElementById("debug-overlay");
      if (el) { el.textContent = dbg + "\n" + (el.textContent || "").slice(0,300); }
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

  // Expose for debugging
  window.__cube3d = this;

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
  for (var hi = 0; hi < hits.length; hi++) {
    if (hits[hi].object.userData.isSticker && hits[hi].object.userData.isExternal) {
      return hits[hi].object;
    }
  }

  // Projection fallback
  var w = rect.width, h = rect.height;
  var vec = new THREE.Vector3();
  var best = null, bestDist = 35;
  for (var i = 0; i < this.meshMod.stickerMeshes.length; i++) {
    var mesh = this.meshMod.stickerMeshes[i];
    if (!mesh.userData.isSticker || !mesh.userData.isExternal) continue;
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
  var camPos = n.clone().multiplyScalar(7.5);
  this.rendererMod.camera.position.copy(camPos);
  // Fix gimbal lock for U/D: rotate camera up axis
  if (face === 'U') this.rendererMod.camera.up.set(0, 0, -1);
  else if (face === 'D') this.rendererMod.camera.up.set(0, 0, 1);
  else this.rendererMod.camera.up.set(0, 1, 0);
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

/* ============================================================
   CubeBuddy Kids — Camera Scanner Module  v2.1.0
   Scan a real Rubik's Cube through camera, detect colors,
   and import the state into the app.
   ============================================================ */

/** Face order: U(0), D(1), F(2), B(3), L(4), R(5) */
const FACE_LABELS = ['U','D','F','B','L','R'];
const FACE_NAMES = ['WHITE','YELLOW','GREEN','BLUE','ORANGE','RED'];
const FACE_EMOJIS = ['⬜','🟨','🟩','🟦','🟧','🟥'];

/** Default RGB centers for each face color (used when no camera) */
const DEFAULT_COLORS = [
  [255,255,255], // 0: White
  [255,255,0],   // 1: Yellow
  [0,200,0],     // 2: Green
  [0,0,255],     // 3: Blue
  [255,165,0],   // 4: Orange
  [255,0,0],     // 5: Red
];

/**
 * Normalize a color to one of 6 face colors using HSV comparison.
 * Returns face index (0-5).
 */
function matchColor(r, g, b) {
  // Convert RGB to HSV
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta > 0.01) {
    if (max === rr) {
      h = 60 * (((gg - bb) / delta) % 6);
    } else if (max === gg) {
      h = 60 * (((bb - rr) / delta) + 2);
    } else {
      h = 60 * (((rr - gg) / delta) + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max > 0.01 ? delta / max : 0;
  const v = max;

  // HSV ranges for each face color (tuned for typical Rubik's cubes)
  // Hue is dominant, saturation helps separate white from pastels
  // Value (brightness) is ignored to handle glare — only hue+saturation matter

  // If saturation is very low, it's white or black/dark
  if (s < 0.2) {
    if (v > 0.5) return 0; // White
    // Could be dark (black sticker)
    return 0; // Default to white for very dark (user can fix)
  }

  // Yellow: hue 45-75
  if (h >= 40 && h < 80) return 1; // Yellow

  // Green: hue 85-160
  if (h >= 85 && h < 160) return 2; // Green

  // Blue: hue 180-260
  if (h >= 180 && h < 260) return 3; // Blue

  // Red: hue 0-20 or 330-360
  if ((h >= 0 && h < 20) || h >= 330) return 5; // Red

  // Orange: hue 20-40
  if (h >= 20 && h < 40) return 4; // Orange

  // Fallback — closest by hue
  if (h >= 160 && h < 180) return 2; // between green and blue → green
  if (h >= 260 && h < 330) return 3; // blue-ish
  if (h >= 40 && h < 85) return 1; // yellow-ish

  return 5; // default red
}

/**
 * Sample the 3x3 grid from a canvas at given center and spacing.
 * Returns a flat 9-element array of face indices (0-5).
 */
function sampleGrid(ctx, cx, cy, spacing) {
  const grid = [];
  const sampleSize = Math.max(4, Math.floor(spacing * 0.25));

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = cx + (col - 1) * spacing;
      const y = cy + (row - 1) * spacing;

      // Sample a small region and average
      const pixelData = ctx.getImageData(
        Math.round(x - sampleSize/2),
        Math.round(y - sampleSize/2),
        sampleSize, sampleSize
      ).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < pixelData.length; i += 4) {
        r += pixelData[i];
        g += pixelData[i+1];
        b += pixelData[i+2];
        count++;
      }
      if (count > 0) {
        r /= count;
        g /= count;
        b /= count;
      }

      const faceIdx = matchColor(r, g, b);
      grid.push(faceIdx);
    }
  }
  return grid;
}

/**
 * Balance colors so each of the 6 colors appears exactly 9 times.
 * This fixes systematic misreads by assuming a legal cube has 9 of each color.
 */
function balanceColors(grid) {
  // grid is a 54-element array of face indices (0-5)
  const counts = new Array(6).fill(0);
  for (let i = 0; i < 54; i++) {
    counts[grid[i]]++;
  }

  // Find which colors are over-represented and under-represented
  const over = [];
  const under = [];
  for (let i = 0; i < 6; i++) {
    if (counts[i] > 9) over.push(i);
    else if (counts[i] < 9) under.push(i);
  }

  // For each over-represented color, find cells to reassign
  const result = [...grid];
  for (const o of over) {
    const excess = counts[o] - 9;
    const candidates = [];
    for (let i = 0; i < 54; i++) {
      if (result[i] === o) candidates.push(i);
    }
    // Sort by "confidence" — prefer changing cells that were ambiguous
    // For simplicity, change the last `excess` ones
    for (let j = 0; j < excess; j++) {
      const idx = candidates[j % candidates.length];
      // Assign to the most under-represented color
      const bestUnder = under.reduce((a, b) =>
        (counts[a] || 0) < (counts[b] || 0) ? a : b
      );
      result[idx] = bestUnder;
      counts[o]--;
      counts[bestUnder] = (counts[bestUnder] || 0) + 1;
      if (counts[bestUnder] >= 9) {
        const bi = under.indexOf(bestUnder);
        if (bi >= 0) under.splice(bi, 1);
      }
    }
  }

  return result;
}

/**
 * Capture a single face from the video element.
 * Returns a 9-element array of face indices.
 */
function captureFace(videoElement) {
  const canvas = document.getElementById('scan-canvas');
  const videoRect = videoElement.getBoundingClientRect();
  const w = videoElement.videoWidth || 640;
  const h = videoElement.videoHeight || 480;

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, w, h);

  // Capture the central region (where the 3x3 grid is)
  // Scale: assume the face occupies about 60% of the frame
  const faceSize = Math.min(w, h) * 0.45;
  const cx = w / 2;
  const cy = h / 2;
  const spacing = faceSize / 3;

  const grid = sampleGrid(ctx, cx, cy, spacing);
  return grid;
}

/**
 * Start the camera feed.
 */
async function startCamera(videoElement) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' } // prefer back camera
    });
    videoElement.srcObject = stream;
    return stream;
  } catch (err) {
    console.error('Camera access denied:', err);
    return null;
  }
}

/**
 * Stop camera stream.
 */
function stopCamera(videoElement) {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(t => t.stop());
    videoElement.srcObject = null;
  }
}

/**
 * Render a 54-sticker net preview.
 * Each sticker is clickable to cycle through colors.
 */
function renderNetPreview(grid, containerId, onChanged) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // Create a 6x9 grid (each row is a face, 9 stickers per face)
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(9, 1fr)';
  container.style.gap = '3px';
  container.style.maxWidth = '360px';
  container.style.margin = '0 auto';

  const COLORS = [
    '#f0f0f0', // White
    '#FFD700', // Yellow
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#F44336', // Red
  ];

  const stickerEls = [];
  for (let i = 0; i < 54; i++) {
    const el = document.createElement('div');
    el.className = 'scan-sticker';
    el.style.background = COLORS[grid[i]] || '#333';
    el.dataset.index = i;
    el.addEventListener('click', () => {
      grid[i] = (grid[i] + 1) % 6;
      el.style.background = COLORS[grid[i]];
      if (onChanged) onChanged(grid);
    });
    container.appendChild(el);
    stickerEls.push(el);
  }
}


(function(){'use strict';if(typeof RubiksCube==='undefined')return;
function SimpleCubik(c,o){if(!c)throw new Error('SimpleCubik: container required');if(typeof c==='string')c=document.querySelector(c);if(!c)throw new Error('SimpleCubik: container not found');this._c=c;this._cube=new RubiksCube();this._cb={};this._m=0;this._init3D();}
SimpleCubik.prototype._init3D=function(){var t=this;this._v=new CubeBuddy3D({container:this._c,cube:this._cube,onTurn:function(m){t._m++;if(t._cube.isSolved){if(t._cb.solve)t._cb.solve();if(t._onSolve)t._onSolve();}if(t._cb.move)t._cb.move(m,t._cube.state);if(t._onMove)t._onMove(m,t._cube.state);},onMovesChange:function(n){t._m=n;}});};
SimpleCubik.prototype.getState=function(){return this._cube.state.slice();};
SimpleCubik.prototype.setState=function(s){if(!s||s.length!==54)return;this._cube.state=s;if(this._v)this._v.rebuild();};
SimpleCubik.prototype.getColor=function(f,r,c){var i={U:0,D:1,F:2,B:3,L:4,R:5}[f];if(i===undefined)return null;var cl=['#FAFAFA','#FFD500','#4CAF50','#2196F3','#FF6600','#F44336'];return cl[this._cube.getFaceletColor(i,r,c)];};
SimpleCubik.prototype.doMove=function(m){if(!m)return;var t=this;m.split(/\s+/).forEach(function(x){if(!x)return;var f=x.replace(/'/,'');var p=x.includes("'");if(t._v&&t._v.animator&&!t._v.animator.isAnimating()){t._v.animator.doTurn(f,p?1:0);}else{t._cube.doMove(x);if(t._v)t._v.rebuild();}t._m++;if(t._cube.isSolved){if(t._cb.solve)t._cb.solve();if(t._onSolve)t._onSolve();}});};
SimpleCubik.prototype.mix=function(n){n=n||20;this._cube.scramble(n);if(this._v)this._v.rebuild();this._m=0;};
SimpleCubik.prototype.reset=function(){this._cube.reset();if(this._v)this._v.rebuild();this._m=0;};
SimpleCubik.prototype.on=function(e,c){this._cb[e]=c;};
SimpleCubik.prototype.off=function(e){delete this._cb[e];};
SimpleCubik.prototype.scan=function(){var b=document.getElementById('scan-btn');if(b)b.click();};
SimpleCubik.prototype.destroy=function(){if(this._v)this._v.destroy();this._c.innerHTML='';this._cb={};};
window.SimpleCubik=SimpleCubik;})();
