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
