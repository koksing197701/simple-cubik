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
  var worldUp = new THREE.Vector3(0, 1, 0);
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
