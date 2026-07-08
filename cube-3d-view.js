// Cube Buddy 3D - Three.js cube view module
// Version: 2.11.4
// Integrates with RubiksCube class from cube.js
// Provides 3D rendering + swipe/tap gestures

(function() {
'use strict';

// ─── Ring System Constants ───
// Each ring is an ordered array of 12 sticker IDs.
// The ring wraps around: ring[12] = ring[0].
// Sticker ID format: faceLetter + (row*3+col)
// Coordinate system: Foo (x,y) where (0,0)=bottom-left, (2,2)=top-right

const RING_STICKERS = {
  U: ['F0','F1','F2','R0','R1','R2','B0','B1','B2','L0','L1','L2'],
  D: ['F6','F7','F8','R6','R7','R8','B6','B7','B8','L6','L7','L8'],
  L: ['F0','F3','F6','D0','D3','D6','B8','B5','B2','U0','U3','U6'],
  R: ['F2','F5','F8','D2','D5','D8','B6','B3','B0','U2','U5','U8'],
  F: ['L2','L5','L8','D0','D1','D2','R6','R3','R0','U8','U7','U6'],
  B: ['R2','R5','R8','D8','D7','D6','L6','L3','L0','U0','U1','U2'],
  S: ['F3','F4','F5','R3','R4','R5','B3','B4','B5','L3','L4','L5'],
  M: ['F1','F4','F7','D1','D4','D7','B7','B4','B1','U7','U4','U1'],
  E: ['L1','L4','L7','D3','D4','D5','R7','R4','R1','U5','U4','U3'],
};

// Forward direction (ring[0]→ring[1]→...→ring[11]) determines CW/CCW per ring
// true = CW, false = CCW
const RING_FORWARD_IS_CW = {
  U: false, D: true,  L: true,  R: false,
  F: false, B: false, S: false, M: true,  E: true,
};

// Map faceIdx to face letter
const FACE_IDX_TO_LETTER = ['U','D','F','B','L','R'];

// Convert (faceIdx, row, col) to sticker ID like "F0", "U6"
function stickerId(faceIdx, row, col) {
  return FACE_IDX_TO_LETTER[faceIdx] + (row * 3 + col);
}

// Find which ring(s) both stickers belong to, and determine direction.
// Returns { ring, turn, isCw, gap } or null if no ring match.
function resolveRingSwipe(startFaceIdx, startRow, startCol, endFaceIdx, endRow, endCol) {
  const startId = stickerId(startFaceIdx, startRow, startCol);
  const endId = stickerId(endFaceIdx, endRow, endCol);

  if (startId === endId) return null; // No movement

  for (const [ringName, stickers] of Object.entries(RING_STICKERS)) {
    const si = stickers.indexOf(startId);
    const ei = stickers.indexOf(endId);
    if (si === -1 || ei === -1) continue;

    // Both stickers are in this ring — determine forward/backward distance
    const len = stickers.length; // 12
    const fwdSteps = (ei - si + len) % len; // 0..11
    const bwdSteps = (si - ei + len) % len;

    // Use the shorter path. If equal distance, let caller decide.
    const gap = Math.min(fwdSteps, bwdSteps);
    if (gap === 0) return null; // same sticker (shouldn't happen)
    if (gap > 4) return null;  // Too far — ignore

    const goingForward = fwdSteps <= bwdSteps;
    const isCw = goingForward ? RING_FORWARD_IS_CW[ringName] : !RING_FORWARD_IS_CW[ringName];

    return { ring: ringName, turn: ringName, isCw, gap };
  }

  return null; // No ring matched
}

class CubeBuddy3D {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('cube-3d-container');
    this.cube = options.cube || null;
    this.onTurn = options.onTurn || null; // callback(move)
    this.onMovesChange = options.onMovesChange || null;
    this._moves = 0;
    this._animating = false;

    this._initThree();
    this._initInput();
  }

  _initThree() {
    const container = this.container;
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 400;

    this.scene = new THREE.Scene();
    // Background set by app via _update3DBackground — reads from CSS var --cube-bg

    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    this.camera.position.set(4.18, 3.14, 5.23);
    this.camera.lookAt(0, 0, 0);

    this.spriteLabels = [];

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Ambient-only lighting — consistent colors from any angle, no shadow variation
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambient);

    // Very subtle hemisphere for slight depth — top is slightly brighter
    const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.4);
    this.scene.add(hemi);

    // Cube group
    this.cubieSize = 0.7;
    this.gap = 0.78;
    this.faceGeo = new THREE.BoxGeometry(this.cubieSize, this.cubieSize, 0.04);
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);
    this.stickerMeshes = [];
    this.cubieCores = [];

    // Orbit
    this.orbitInverted = false;
    this._lastPointer = { x: 0, y: 0 };
    this._pointerDown = { x: 0, y: 0 };
    this._isDragging = false;
    this._swipeFace = null;
    this._swipeSticker = null;
    this._lastTapTime = 0;
    this._lastTapTimer = null;

    // Resize
    this._onResize = () => {
      const r = container.getBoundingClientRect();
      const cw = r.width || 400;
      const ch = r.height || 400;
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', () => setTimeout(this._onResize, 300));

    // Start render loop
    this._running = true;
    this._animate();
  }

  _initInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    el.addEventListener('pointermove', (e) => this._onPointerMove(e));
    el.addEventListener('pointerup', (e) => this._onPointerUp(e));
  }

  _getStickerAtPoint(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(mx, my), this.camera);

    // Try raycast first (most accurate)
    const hits = ray.intersectObjects(this.stickerMeshes, false);
    if (hits.length > 0 && hits[0].object.userData.isSticker) {
      return hits[0].object;
    }

    // Raycast missed stickers — try projection fallback
    const w = rect.width, h = rect.height;
    const vec = new THREE.Vector3();

    // Also check if we hit core at all
    const coreHits = ray.intersectObjects(this.cubieCores, false);

    let best = null;
    let bestDist = 35;
    for (const mesh of this.stickerMeshes) {
      if (!mesh.userData.isSticker) continue;
      mesh.getWorldPosition(vec);
      vec.project(this.camera);
      if (vec.z >= 1) continue;
      const sx = (vec.x * 0.5 + 0.5) * w;
      const sy = (-vec.y * 0.5 + 0.5) * h;
      const dx = sx - (clientX - rect.left);
      const dy = sy - (clientY - rect.top);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = mesh;
      }
    }

    return best;
  }

  _onPointerDown(e) {
    this._lastPointer = { x: e.clientX, y: e.clientY };
    this._pointerDown = { x: e.clientX, y: e.clientY };
    this._isDragging = false;
    this._swipeFace = null;
    this._swipeSticker = null;

    if (!this.cube || this._animating) return;

    const hitMesh = this._getStickerAtPoint(e.clientX, e.clientY);
    if (hitMesh) {
      const ud = hitMesh.userData;
      this._swipeFace = FACE_LETTERS[ud.faceIdx] || '';
      this._swipeSticker = { faceIdx: ud.faceIdx, row: ud.row, col: ud.col };
      if (this._debugLog) this._debugLog(`HIT: ${['U','D','F','B','L','R'][ud.faceIdx]}(${ud.row},${ud.col}) ext=${ud.isExternal}`);
    } else {
      // Check if near cube core for orbit
      const rect = this.renderer.domElement.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(mx, my), this.camera);
      const coreHits = ray.intersectObjects(this.cubieCores, false);
      this._swipeFace = coreHits.length > 0 ? {} : null;
      if (this._debugLog) this._debugLog(coreHits.length > 0 ? 'HIT: core only' : 'MISS: no hit');
    }
  }

  _onPointerMove(e) {
    if (e.buttons !== 1) return;
    const dx = e.clientX - this._lastPointer.x;
    const dy = e.clientY - this._lastPointer.y;

    if (!this._isDragging) {
      if (Math.sqrt(dx*dx + dy*dy) < 10) return;
      this._isDragging = true;
    }

    if (this._swipeFace) { this._lastPointer = { x: e.clientX, y: e.clientY }; return; }

    const inv = this.orbitInverted ? -1 : 1;
    const worldUp = new THREE.Vector3(0, 1, 0);
    const camPos = this.camera.position.clone();
    const camForward = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camPos).normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, worldUp).normalize();
    const camUp = new THREE.Vector3().crossVectors(camRight, camForward).normalize();

    const SCALE = 0.012;
    const angleH = dx * SCALE * inv;
    const angleV = dy * SCALE * inv;
    const qH = new THREE.Quaternion().setFromAxisAngle(camUp, angleH);
    const qV = new THREE.Quaternion().setFromAxisAngle(camRight, angleV);

    this.cubeGroup.quaternion.premultiply(qH);
    this.cubeGroup.quaternion.premultiply(qV);
    this.cubeGroup.rotation.setFromQuaternion(this.cubeGroup.quaternion);

    this._lastPointer = { x: e.clientX, y: e.clientY };
  }

  _onPointerUp(e) {
    if (typeof this._swipeFace !== 'string') {
      this._isDragging = false;
      this._swipeFace = null;
      this._swipeSticker = null;
      return;
    }

    const now = Date.now();
    const tappedFace = this._swipeFace;
    const dx = e.clientX - this._pointerDown.x;
    const dy = e.clientY - this._pointerDown.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const SWIPE_THRESHOLD = 15;

    // ─── RING-BASED SWIPE DETECTION ───
    // Instead of per-face edge projection, use ring-based sticker matching.
    // Compare START sticker (from pointer down) with END sticker (from pointer up)
    // to determine which physical ring was crossed and the direction.

    if (dist > SWIPE_THRESHOLD && this._swipeSticker) {
      const { faceIdx, row, col } = this._swipeSticker;

      if (this._debugLog) {
        this._debugLog(`START: ${FACE_IDX_TO_LETTER[faceIdx]}(${row},${col})`);
      }

      // Resolve END sticker at pointer-up position
      const hitMesh = this._getStickerAtPoint(e.clientX, e.clientY);

      if (hitMesh) {
        const eud = hitMesh.userData;
        const endFace = eud.faceIdx;
        const endRow = eud.row;
        const endCol = eud.col;

        if (this._debugLog) {
          this._debugLog(`END: ${FACE_IDX_TO_LETTER[endFace]}(${endRow},${endCol})`);
        }

        // Try ring-based detection
        const ringResult = resolveRingSwipe(faceIdx, row, col, endFace, endRow, endCol);

        if (ringResult) {
          const { turn, isCw, gap, ring } = ringResult;
          if (this._debugLog) {
            this._debugLog(`RING: ${ring} gap=${gap} ${isCw ? 'CW' : 'CCW'} → ${turn}${isCw ? '' : "'"}`);
          }
          this._doTurn(turn, isCw ? 0 : 1);
          this._isDragging = false;
          this._swipeFace = null;
          this._swipeSticker = null;
          return;
        }

        // Fallback: if ring didn't match but we have a different face, try direct face turn
        if (endFace !== faceIdx) {
          const endLetter = FACE_IDX_TO_LETTER[endFace];
          if (this._debugLog) this._debugLog(`FALLBACK: direct face ${endLetter}`);
          // Use drag direction to determine prime
          const isHoriz = Math.abs(dx) >= Math.abs(dy);
          const isRight = dx > 0;
          const isDown = dy > 0;
          // Simple heuristic: horizontal right/left, vertical down/up
          let prime = 0;
          if (endFace === 0 || endFace === 1) { // U or D
            prime = isRight ? 0 : 1;
          } else if (endFace === 4 || endFace === 5) { // L or R
            prime = isDown ? 0 : 1;
          } else { // F or B
            prime = isHoriz ? (isRight ? 0 : 1) : (isDown ? 1 : 0);
          }
          if (this._debugLog) this._debugLog(`TURN: ${endLetter} ${prime ? 'CCW' : 'CW'}`);
          this._doTurn(endLetter, prime);
          this._isDragging = false;
          this._swipeFace = null;
          this._swipeSticker = null;
          return;
        }
      }
    }

    // Tap — only center sticker
    if (this._swipeSticker && dist <= SWIPE_THRESHOLD) {
      const { faceIdx, row, col } = this._swipeSticker;
      if (row !== 1 || col !== 1) {
        if (this._debugLog) this._debugLog(`TAP blocked: not center (${row},${col})`);
        this._isDragging = false;
        this._swipeFace = null;
        this._swipeSticker = null;
        return;
      }
    }

    // Double-tap handling
    if (now - this._lastTapTime < 350) {
      if (this._lastTapTimer) clearTimeout(this._lastTapTimer);
      this._lastTapTime = 0;
      this._doTurn(tappedFace, 1);
    } else {
      this._lastTapTime = now;
      if (this._lastTapTimer) clearTimeout(this._lastTapTimer);
      this._lastTapTimer = setTimeout(() => {
        if (this._lastTapTime !== 0) {
          this._doTurn(tappedFace, 0);
          this._lastTapTime = 0;
          this._lastTapTimer = null;
        }
      }, 350);
    }

    this._isDragging = false;
    this._swipeFace = null;
    this._swipeSticker = null;
  }

  _doTurn(face, prime) {
    if (!this.cube || this._animating) return;
    const move = prime ? face + "'" : face;

    // Snapshot state before move for color-change debug
    const stateBefore = this.cube.state.slice();

    this.cube.doMove(move);
    this._moves++;
    this.rebuild();
    if (this.onMovesChange) this.onMovesChange(this._moves);
    if (this.onTurn) this.onTurn(move);

    // Show color changes in bottom debug
    if (typeof this._debugLogBottom === 'function') {
      const stateAfter = this.cube.state;
      const faceNames = ['U','D','F','B','L','R'];
      const colorNames = ['W','Y','G','B','O','R'];
      const changes = [];
      for (let i = 0; i < 54; i++) {
        if (stateBefore[i] !== stateAfter[i]) {
          const f = Math.floor(i / 9);
          const r = Math.floor((i % 9) / 3);
          const c = i % 3;
          const fromC = colorNames[stateBefore[i]] || '?';
          const toC = colorNames[stateAfter[i]] || '?';
          changes.push(`${faceNames[f]}(${r},${c}):${fromC}→${toC}`);
        }
      }
      if (changes.length > 0) {
        this._debugLogBottom(`[${move}] ${changes.join(' ')}`);
      } else {
        this._debugLogBottom(`[${move}] no change`);
      }
    }
  }

  // Edge adjacency data (from verified debugging) — kept for fallback
  get edgeAdjacency() {
    return {
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
  }

  resetView() {
    // Reset to default camera view — no orbit drift preserved
    this.camera.position.set(4.18, 3.14, 5.23);
    this.camera.lookAt(0, 0, 0);
    this.cubeGroup.quaternion.identity();
    this.cubeGroup.rotation.setFromQuaternion(this.cubeGroup.quaternion);
  }

  rebuild() {
    // Clean up old sprite labels
    for (const entry of this.spriteLabels) {
      const s = entry.sprite;
      if (s.parent) s.parent.remove(s);
      if (s.material) s.material.dispose();
      if (s.material && s.material.map) s.material.map.dispose();
    }
    this.spriteLabels.length = 0;

    const g = this.cubeGroup;
    while (g.children.length) g.remove(g.children[0]);
    this.stickerMeshes.length = 0;
    this.cubieCores.length = 0;

    if (!this.cube) return;

    const state = this.cube.state;
    const get = (r, c, f) => state[f * 9 + r * 3 + c];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubie = new THREE.Group();
          cubie.position.set(x * this.gap, y * this.gap, z * this.gap);

          const core = new THREE.Mesh(
            new THREE.BoxGeometry(this.cubieSize, this.cubieSize, this.cubieSize),
            this.coreMat
          );
          core.castShadow = true;
          core.userData = { isCore: true };
          cubie.add(core);
          this.cubieCores.push(core);

          const facelets = {
            'px': { f: 5, r: 1-y, c: 1-z, dir: [ 1, 0, 0], ext: x === 1 },
            'nx': { f: 4, r: 1-y, c: z+1, dir: [-1, 0, 0], ext: x === -1 },
            'py': { f: 0, r: z+1, c: x+1, dir: [ 0, 1, 0], ext: y === 1 },
            'ny': { f: 1, r: 1-z, c: x+1, dir: [ 0,-1, 0], ext: y === -1 },
            'pz': { f: 2, r: 1-y, c: x+1, dir: [ 0, 0, 1], ext: z === 1 },
            'nz': { f: 3, r: 1-y, c: 1-x, dir: [ 0, 0,-1], ext: z === -1 },
          };

          for (const [dir, fl] of Object.entries(facelets)) {
            const ci = get(fl.r, fl.c, fl.f);
            const sticker = new THREE.Mesh(this.faceGeo, new THREE.MeshStandardMaterial({
              map: this._getStickerTexture(ci),
              roughness: 0.5,
              metalness: 0.1,
            }));
            sticker.userData = {
              isSticker: true,
              isExternal: fl.ext,
              faceIdx: fl.f,
              row: fl.r,
              col: fl.c,
            };
            sticker.castShadow = true;
            // Position sticker on the correct face
            const faceNormals = {
              'px': [ 0.5, 0, 0], 'nx': [-0.5, 0, 0],
              'py': [ 0, 0.5, 0], 'ny': [ 0,-0.5, 0],
              'pz': [ 0, 0, 0.5], 'nz': [ 0, 0,-0.5],
            };
            const n = faceNormals[dir];
            sticker.position.set(n[0], n[1], n[2]);
            const lookTarget = new THREE.Vector3(n[0]*2, n[1]*2, n[2]*2);
            sticker.lookAt(lookTarget);
            cubie.add(sticker);
            this.stickerMeshes.push(sticker);
          }
          this.cubeGroup.add(cubie);
        }
      }
    }
  }

  _getStickerTexture(colorIdx) {
    const colors = [
      0xffffff, // 0: White (U)
      0xffff00, // 1: Yellow (D)
      0x00ff00, // 2: Green (F)
      0x3366ff, // 3: Blue (B)
      0xff8800, // 4: Orange (L)
      0xff0000, // 5: Red (R)
      0x222222, // 6: internal (black)
    ];
    const c = colors[colorIdx] || 0x222222;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 64, 64);
    // Rounded-corner effect
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(0, r); ctx.lineTo(0, 64);
    ctx.lineTo(64, 64); ctx.lineTo(64, 0);
    ctx.lineTo(r, 0); ctx.arc(r, r, r, Math.PI * 1.5, Math.PI);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }

  focusFace(face) {
    // Animate camera to focus on a given face using face-normal orientation.
    // face: 'U', 'D', 'F', 'B', 'L', 'R'
    const faceNormals = {
      'U': new THREE.Vector3(0, 1, 0),
      'D': new THREE.Vector3(0, -1, 0),
      'F': new THREE.Vector3(0, 0, 1),
      'B': new THREE.Vector3(0, 0, -1),
      'L': new THREE.Vector3(-1, 0, 0),
      'R': new THREE.Vector3(1, 0, 0),
    };

    const n = faceNormals[face];
    if (!n) return;

    const camPos = n.clone().multiplyScalar(6);
    const lookAt = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(camPos);
    this.camera.lookAt(lookAt);
    this.cubeGroup.quaternion.identity();
    this.cubeGroup.rotation.setFromQuaternion(this.cubeGroup.quaternion);
  }

  _createLabelSprite(text) {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Semi-transparent dark background with visible border
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.roundRect(4, 4, size-8, size-8, 8);
    ctx.fill();
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(4, 4, size-8, size-8, 8);
    ctx.stroke();
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(text, size/2, size/2 + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: true });
    return new THREE.Sprite(mat);
  }

  _animate() {
    if (!this._running) return;
    requestAnimationFrame(() => this._animate());
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this._running = false;
    window.removeEventListener('resize', this._onResize);
    this.renderer.domElement.remove();
    this.renderer.dispose();
    while (this.cubeGroup.children.length) {
      const c = this.cubeGroup.children[0];
      c.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.cubeGroup.remove(c);
    }
  }

  resetMoves() {
    this._moves = 0;
  }
}

window.CubeBuddy3D = CubeBuddy3D;

})();
