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

  this.renderer = new THREE.WebGLRenderer({ antialias: true });
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
