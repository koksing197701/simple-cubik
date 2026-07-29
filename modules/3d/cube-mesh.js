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

window.CubeMesh = CubeMesh;

})();
