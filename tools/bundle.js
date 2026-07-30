#!/usr/bin/env node
/**
 * Simple Cubik Bundler v2.8
 * Concatenates all modules + API wrapper into one distributable file.
 * Usage: node tools/bundle.js [--minify]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Load order matters — matching index.html script order
const FILES = [
  'modules/3d/ring-system.js',
  'modules/3d/renderer.js',
  'modules/3d/orbit-controller.js',
  'modules/3d/cube-mesh.js',
  'modules/3d/turn-animator.js',
  'modules/input/gesture-handler.js',
  'cube.js',
  'cube-3d-view.js',
  'cubebuddy-scanner.js',
  // app.js is NOT included — it's the demo app, not the library
];

// Domain lock — only allow these domains
const DOMAIN_LOCK = `
// ===== Domain Lock =====
(function() {
  var allowed = ['synthex.my', 'cubikbuddy.com', 'localhost', '127.0.0.1'];
  var host = window.location.hostname;
  var ok = false;
  for (var i = 0; i < allowed.length; i++) {
    if (host === allowed[i] || host.endsWith('.' + allowed[i])) { ok = true; break; }
  }
  if (!ok) {
    console.warn('Simple Cubik: unauthorized domain (' + host + ').');
    return;
  }
})();
`;

// ===== API Wrapper =====
const API_WRAPPER = `

// ===== SimpleCubik Public API =====
(function() {
'use strict';

// Check if core modules loaded
if (typeof RubiksCube === 'undefined') return;

function SimpleCubik(container, options) {
  if (!container) throw new Error('SimpleCubik: container element required');
  if (typeof container === 'string') container = document.querySelector(container);
  if (!container) throw new Error('SimpleCubik: container not found');

  options = options || {};
  this._callbacks = {};

  // Store container
  this._container = container;

  // Create cube state
  this._cube = new RubiksCube();

  // Store options
  this._view = options.view || '3d';
  this._onMove = options.onMove || null;
  this._onSolve = options.onSolve || null;

  // Init 3D view
  this._init3D();

  // Move counter
  this._moves = 0;
}

SimpleCubik.prototype._init3D = function() {
  var self = this;
  this._cube3d = new CubeBuddy3D({
    container: this._container,
    cube: this._cube,
    onTurn: function(move) {
      self._moves++;
      if (self._cube.isSolved) {
        if (self._callbacks.solve) self._callbacks.solve();
        if (self._onSolve) self._onSolve();
      }
      if (self._callbacks.move) self._callbacks.move(move, self._cube.state);
      if (self._onMove) self._onMove(move, self._cube.state);
    },
    onMovesChange: function(n) { self._moves = n; }
  });
};

/** Get current cube state as 54-element array (0-5 face indices) */
SimpleCubik.prototype.getState = function() {
  return this._cube.state.slice();
};

/** Restore cube state from 54-element array */
SimpleCubik.prototype.setState = function(stateArray) {
  if (!stateArray || stateArray.length !== 54) return;
  this._cube.state = stateArray;
  if (this._cube3d) this._cube3d.rebuild();
};

/** Get color of a specific sticker */
SimpleCubik.prototype.getColor = function(face, row, col) {
  var faceIdx = {U:0, D:1, F:2, B:3, L:4, R:5}[face];
  if (faceIdx === undefined) return null;
  var colors = ['#FAFAFA','#FFD500','#4CAF50','#2196F3','#FF6600','#F44336'];
  return colors[this._cube.getFaceletColor(faceIdx, row, col)];
};

/** Execute one or more moves (space-separated) */
SimpleCubik.prototype.doMove = function(moves) {
  if (!moves) return;
  var self = this;
  moves.split(/\s+/).forEach(function(m) {
    if (!m) return;
    var face = m.replace(/'/, '');
    var prime = m.includes("'");
    if (self._cube3d && self._cube3d.animator && !self._cube3d.animator.isAnimating()) {
      self._cube3d.animator.doTurn(face, prime ? 1 : 0);
    } else {
      self._cube.doMove(m);
      if (self._cube3d) self._cube3d.rebuild();
    }
    self._moves++;
    if (self._cube.isSolved) {
      if (self._callbacks.solve) self._callbacks.solve();
      if (self._onSolve) self._onSolve();
    }
  });
};

/** Scramble the cube */
SimpleCubik.prototype.mix = function(count) {
  count = count || 20;
  this._cube.scramble(count);
  if (this._cube3d) this._cube3d.rebuild();
  this._moves = 0;
};

/** Reset to solved state */
SimpleCubik.prototype.reset = function() {
  this._cube.reset();
  if (this._cube3d) this._cube3d.rebuild();
  this._moves = 0;
};

/** Event listener */
SimpleCubik.prototype.on = function(event, callback) {
  this._callbacks[event] = callback;
};

/** Remove event listener */
SimpleCubik.prototype.off = function(event) {
  delete this._callbacks[event];
};

/** Open camera scanner */
SimpleCubik.prototype.scan = function() {
  var btn = document.getElementById('scan-btn');
  if (btn) btn.click();
};

/** Clean up */
SimpleCubik.prototype.destroy = function() {
  if (this._cube3d) this._cube3d.destroy();
  this._container.innerHTML = '';
  this._callbacks = {};
};

window.SimpleCubik = SimpleCubik;

})();
`;

// ===== Build =====
function build() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  var parts = [];
  parts.push('// Simple Cubik v2.8');
  parts.push('// (c) ' + new Date().getFullYear() + ' Kok Sing Ng. All rights reserved.');
  parts.push('// Domain-locked: synthex.my, cubikbuddy.com');
  parts.push('');
  parts.push(DOMAIN_LOCK);

  FILES.forEach(function(f) {
    var filePath = path.join(ROOT, f);
    if (!fs.existsSync(filePath)) {
      console.warn('Warning: ' + f + ' not found, skipping');
      return;
    }
    var content = fs.readFileSync(filePath, 'utf8');
    parts.push('// ===== ' + f + ' =====');
    parts.push(content);
  });

  parts.push(API_WRAPPER);

  var output = parts.join('\n');
  var outPath = path.join(DIST, 'simple-cubik.js');
  fs.writeFileSync(outPath, output, 'utf8');
  console.log('✅ Bundled: ' + outPath + ' (' + (output.length / 1024).toFixed(1) + ' KB)');

  // Minify if --minify flag
  if (process.argv.includes('--minify')) {
    try {
      var result = require('child_process').execSync(
        'npx javascript-obfuscator ' + outPath + ' --output ' + path.join(DIST, 'simple-cubik.min.js'),
        { cwd: ROOT, timeout: 30000 }
      );
      console.log('✅ Minified: dist/simple-cubik.min.js');
    } catch(e) {
      console.log('⚠️  Minify skipped (install javascript-obfuscator: npm install -g javascript-obfuscator)');
      // Simple minify fallback: basic compression
      var min = output.replace(/\s+/g, ' ').replace(/\s*([{}();,=+\-*/])\s*/g, '$1');
      fs.writeFileSync(path.join(DIST, 'simple-cubik.min.js'), min, 'utf8');
      console.log('✅ Basic minify fallback: dist/simple-cubik.min.js (' + (min.length / 1024).toFixed(1) + ' KB)');
    }
  }

  // Create example page (only if bundle succeeds)
  var example = '<!DOCTYPE html><html><head><title>Simple Cubik Demo</title><style>body{margin:0;background:#1a1a2e;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;flex-direction:column;color:#fff}#cube-area{width:400px;height:400px}.controls{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:center}button{padding:6px 14px;border-radius:6px;border:1px solid #444;background:#333;color:#fff;cursor:pointer;font-size:14px}button:hover{background:#555}.info{text-align:center;margin-bottom:12px;font-size:14px;color:#aaa}</style></head><body><div class="info">Simple Cubik v2.8 — Modular API</div><div id="cube-area"></div><div class="controls"><button onclick="cube.mix(12)">🔀 Mix</button><button onclick="cube.reset()">🔄 Reset</button><button onclick="cube.doMove(\'S\')">S+</button><button onclick="cube.doMove(\"S\'\")">S-</button><button onclick="alert(JSON.stringify(cube.getState().slice(0,9)))">Log State</button></div><script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script><script src="simple-cubik.js"><\/script><script>var cube=new SimpleCubik("#cube-area",{view:"3d"});console.log("Simple Cubik v2.8 ready");window.cube=cube;<\/script></body></html>';
  var examplePath = path.join(DIST, 'index.html');
  fs.writeFileSync(examplePath, example, 'utf8');
  console.log('✅ Example page: ' + examplePath);
}

build();
