#!/usr/bin/env node
/**
 * Simple Cubik Bundler v5.1.1
 * Concatenates library modules + API wrapper into one protected file.
 * Usage: node tools/bundle.js [--minify]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

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
  // app.js excluded — demo app, not library
];

const DOMAIN_LOCK = `
(function(){var a=['synthex.my','cubikbuddy.com','localhost','127.0.0.1'];var h=window.location.hostname;var o=false;for(var i=0;i<a.length;i++){if(h===a[i]||h.endsWith('.'+a[i])){o=true;break;}}if(!o){console.warn('Simple Cubik: unauthorized domain ('+h+').');return;}})();
`;

const API_WRAPPER = `
(function(){'use strict';if(typeof RubiksCube==='undefined')return;
function SimpleCubik(c,o){if(!c)throw new Error('SimpleCubik: container required');if(typeof c==='string')c=document.querySelector(c);if(!c)throw new Error('SimpleCubik: container not found');this._c=c;this._cube=new RubiksCube();this._cb={};this._m=0;this._init3D();}
SimpleCubik.prototype._init3D=function(){var t=this;this._v=new CubeBuddy3D({container:this._c,cube:this._cube,onTurn:function(m){t._m++;if(t._cube.isSolved){if(t._cb.solve)t._cb.solve();if(t._onSolve)t._onSolve();}if(t._cb.move)t._cb.move(m,t._cube.state);if(t._onMove)t._onMove(m,t._cube.state);},onMovesChange:function(n){t._m=n;}});};
SimpleCubik.prototype.getState=function(){return this._cube.state.slice();};
SimpleCubik.prototype.setState=function(s){if(!s||s.length!==54)return;this._cube.state=s;if(this._v)this._v.rebuild();};
SimpleCubik.prototype.getColor=function(f,r,c){var i={U:0,D:1,F:2,B:3,L:4,R:5}[f];if(i===undefined)return null;var cl=['#FAFAFA','#FFD500','#4CAF50','#2196F3','#FF6600','#F44336'];return cl[this._cube.getFaceletColor(i,r,c)];};
SimpleCubik.prototype.doMove=function(m){if(!m)return;var t=this;m.split(/\\s+/).forEach(function(x){if(!x)return;var f=x.replace(/'/,'');var p=x.includes("'");if(t._v&&t._v.animator&&!t._v.animator.isAnimating()){t._v.animator.doTurn(f,p?1:0);}else{t._cube.doMove(x);if(t._v)t._v.rebuild();}t._m++;if(t._cube.isSolved){if(t._cb.solve)t._cb.solve();if(t._onSolve)t._onSolve();}});};
SimpleCubik.prototype.mix=function(n){n=n||20;this._cube.scramble(n);if(this._v)this._v.rebuild();this._m=0;};
SimpleCubik.prototype.reset=function(){this._cube.reset();if(this._v)this._v.rebuild();this._m=0;};
SimpleCubik.prototype.on=function(e,c){this._cb[e]=c;};
SimpleCubik.prototype.off=function(e){delete this._cb[e];};
SimpleCubik.prototype.scan=function(){var b=document.getElementById('scan-btn');if(b)b.click();};
SimpleCubik.prototype.destroy=function(){if(this._v)this._v.destroy();this._c.innerHTML='';this._cb={};};
window.SimpleCubik=SimpleCubik;})();
`;

function build() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  var parts = [];
  parts.push('// Simple Cubik v5.1.1 — Domain Locked: synthex.my, cubikbuddy.com');
  parts.push(DOMAIN_LOCK);
  FILES.forEach(function(f) {
    var fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) { console.warn('Warning: ' + f + ' missing'); return; }
    parts.push(fs.readFileSync(fp, 'utf8'));
  });
  parts.push(API_WRAPPER);
  var output = parts.join('\n');
  var outPath = path.join(DIST, 'simple-cubik.js');
  fs.writeFileSync(outPath, output, 'utf8');
  console.log('✅ Bundled: ' + outPath + ' (' + (output.length/1024).toFixed(1) + ' KB)');

  // Minify
  try {
    require('child_process').execSync(
      'npx javascript-obfuscator ' + outPath + ' --output ' + path.join(DIST, 'simple-cubik.min.js'),
      { cwd: ROOT, timeout: 30000, stdio: 'pipe' }
    );
    console.log('✅ Minified: dist/simple-cubik.min.js');
    var minSize = fs.statSync(path.join(DIST, 'simple-cubik.min.js')).size;
    console.log('   Size: ' + (minSize/1024).toFixed(1) + ' KB');
  } catch(e) {
    console.log('⚠️  Obfuscator not available — copying unminified');
    fs.copyFileSync(outPath, path.join(DIST, 'simple-cubik.min.js'));
  }
}

build();
