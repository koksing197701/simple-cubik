// Cube Buddy - App Logic
// Pure JS: rendering, game state, animations

// Face layout: cross net with 4 B cards
// Grid: 5 rows x 4 cols
// Row -1: [B top]
// Row  0: [U]
// Row  1: [L] [F] [R]
// Row  2: [D]
// Row  3: [B real]
// Col -1: [B left] (row 1)
// Col  3: [B right] (row 1)

// Face definitions: {faceIdx, row, col, mirror, swapRows}
const FACE_SPECS_CLASSIC = [
  // Standard faces
  { faceIdx: 0, row: 0, col: 1, mirror: false, swapRows: false }, // U
  { faceIdx: 4, row: 1, col: 0, mirror: false, swapRows: false }, // L
  { faceIdx: 2, row: 1, col: 1, mirror: false, swapRows: false }, // F
  { faceIdx: 5, row: 1, col: 2, mirror: false, swapRows: false }, // R
  { faceIdx: 1, row: 2, col: 1, mirror: false, swapRows: false }, // D
  // B cards - same face data (3), different visual mappings
  { faceIdx: 3, row: 3, col: 1, mirror: true,  swapRows: true  }, // B real (180° rot)
  { faceIdx: 3, row: -1, col: 1, mirror: true,  swapRows: true  }, // B top (180° rot)
  { faceIdx: 3, row: 1, col: -1, mirror: false, swapRows: false }, // B left (identity)
  { faceIdx: 3, row: 1, col: 3, mirror: false, swapRows: false }, // B right (identity)
];

// Focus view: only the 5 visible faces (no B cards) — bigger stickers, less clutter
const FACE_SPECS_FOCUS = [
  { faceIdx: 0, row: 0, col: 1, mirror: false, swapRows: false }, // U
  { faceIdx: 4, row: 1, col: 0, mirror: false, swapRows: false }, // L
  { faceIdx: 2, row: 1, col: 1, mirror: false, swapRows: false }, // F
  { faceIdx: 5, row: 1, col: 2, mirror: false, swapRows: false }, // R
  { faceIdx: 1, row: 2, col: 1, mirror: false, swapRows: false }, // D
];

// Cross view: 6 faces in true cross net — B at bottom, no extra B cards
//   Row  0: [U]
//   Row  1: [L][F][R]
//   Row  2: [D]
//   Row  3: [B]
const FACE_SPECS_CROSS = [
  { faceIdx: 0, row: 0, col: 1, mirror: false, swapRows: false }, // U
  { faceIdx: 4, row: 1, col: 0, mirror: false, swapRows: false }, // L
  { faceIdx: 2, row: 1, col: 1, mirror: false, swapRows: false }, // F
  { faceIdx: 5, row: 1, col: 2, mirror: false, swapRows: false }, // R
  { faceIdx: 1, row: 2, col: 1, mirror: false, swapRows: false }, // D
  { faceIdx: 3, row: 3, col: 1, mirror: true, swapRows: true }, // B (rows flipped, cols mirrored: B2,2 at top-left)
];

const FACE_BORDER_COLORS = ['#FAFAFA', '#FFD500', '#4CAF50', '#2196F3', '#FF7500', '#F44336'];
// Override for 2D sticker fill colors so 3D and 2D can differ
const FACE_COLORS_2D = [...FACE_COLORS];
FACE_COLORS_2D[4] = '#FF7500'; // Left - Orange (for 2D)

class CubeBuddyApp {
  constructor() {
    this.cube = new RubiksCube();
    this.moves = 0;
    this.showCelebration = false;
    this._viewMode = '3d';
    this._cube3d = null;
    this._focusMode = 'cross'; // 'focus'=5 faces, 'full'=9 faces w/ 4 B cards, 'cross'=6 face cross net

    this._history = [];
    this._snapshots = [];

    this._init();
  }

  _init() {
    this._cacheDom();
    this._setupPlay();
    this._loadFromLocalStorage();
    this._loadSnapshotsFromStorage();
    this._enterPlay();
  }

  _cacheDom() {
    this.cubeContainer = document.getElementById('cube-container');
    this.cube3dContainer = document.getElementById('cube-3d-container');
    this.moveCount = document.getElementById('move-count');
    this.mixBtn = document.getElementById('mix-btn');
    this.undoBtn = document.getElementById('undo-btn');
    this.solvedBadge = document.getElementById('solved-badge');
    this.snapshotContainer = document.getElementById('snapshot-container');

    this.celebrationOverlay = document.getElementById('celebration-overlay');
    this.celebMsg = document.getElementById('celeb-msg');
    this.okBtn = document.getElementById('ok-btn');
    this.confettiContainer = document.getElementById('confetti-container');

    this.fullBtn = document.getElementById('full-btn');
    this.focusBtn = document.getElementById('focus-btn');
    this.crossBtn = document.getElementById('cross-btn');
    this.controls2d = document.getElementById('controls-2d');
    this.cubeArea = document.getElementById('cube-area');
  }

  // ==================== PLAY ====================

  _enterPlay() {
    this.moveCount.textContent = this.moves;

    this._renderCube();
    this._updateControls();
    this._renderSnapshotSlots();
    this._updateUndoBtn();
    // Set initial view tab (3d)
    this._viewMode = '3d';
    this.cubeContainer.style.display = 'none';
    this.cube3dContainer.style.display = 'flex';
    this.faceButtons.style.display = 'flex';
    if (this.controls2d) this.controls2d.style.display = 'none';
    this._update3DFaceButtons();
    if (this.viewBtns) {
      for (const [id, btn] of Object.entries(this.viewBtns)) {
        btn.classList.toggle('active', id === '3d');
      }
    }
    this._init3D();

    // Default to cross mode
    if (this.crossBtn) this.crossBtn.classList.add('active');
    if (this.focusBtn) this.focusBtn.classList.remove('active');
    if (this.fullBtn) this.fullBtn.classList.remove('active');

    // Set up touch handling once
    if (!this._touchSetup) {
      this._setupCubeTouch();
      this._touchSetup = true;
    }
  }

  _setupPlay() {
    this.mixBtn.addEventListener('click', () => this._scramble());
    this.centerBtn = document.getElementById('center-btn');
    if (this.centerBtn) this.centerBtn.addEventListener('click', () => this._alignFaces());
    this.scanBtn = document.getElementById('scan-btn');
    if (this.scanBtn) this.scanBtn.addEventListener('click', () => this._startScan());
    this.undoBtn.addEventListener('click', () => this._undo());
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetCube());
    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) debugBtn.addEventListener('click', () => this._toggleDebug());
    this.viewBtns = {
      '3d': document.getElementById('view-3d'),
      '2d': document.getElementById('view-2d'),
    };
    this.viewBtns['3d'].addEventListener('click', () => this._setView('3d'));
    this.viewBtns['2d'].addEventListener('click', () => this._setView('2d'));
    this.faceButtons = document.getElementById('face-buttons');
    this.okBtn.addEventListener('click', () => this._dismissCelebration());

    // Full / Focus / Cross buttons (2D mode selection)
    this.fullBtn.addEventListener('click', () => {
      if (this._focusMode !== 'full') {
        this._focusMode = 'full';
        this.fullBtn.classList.add('active');
        this.focusBtn.classList.remove('active');
        if (this.crossBtn) this.crossBtn.classList.remove('active');
        this._renderCube();
      }
    });
    this.focusBtn.addEventListener('click', () => {
      if (this._focusMode !== 'focus') {
        this._focusMode = 'focus';
        this.focusBtn.classList.add('active');
        this.fullBtn.classList.remove('active');
        if (this.crossBtn) this.crossBtn.classList.remove('active');
        this._renderCube();
      }
    });
    if (this.crossBtn) {
      this.crossBtn.addEventListener('click', () => {
        if (this._focusMode !== 'cross') {
          this._focusMode = 'cross';
          this.crossBtn.classList.add('active');
          this.fullBtn.classList.remove('active');
          this.focusBtn.classList.remove('active');
          this._renderCube();
        }
      });
    }
    this._setupTheme();
  }

  _setupTheme() {
    // Load saved theme
    let saved = localStorage.getItem('simplecubik_theme') || 'default';
    // Map old 'classic' to 'default' (classic was removed, replaced by amber/blue/green)
    if (saved === 'classic') saved = 'default';
    this._applyTheme(saved);

    // Theme button toggle menu
    const themeBtn = document.getElementById('theme-btn');
    const themeMenu = document.getElementById('theme-menu');
    const themeOptions = themeMenu.querySelectorAll('.theme-option');

    // Mark saved theme as active
    themeOptions.forEach(opt => {
      if (opt.dataset.theme === saved) opt.classList.add('active');
    });

    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeMenu.style.display = themeMenu.style.display === 'none' ? 'block' : 'none';
    });

    // Close menu when clicking elsewhere
    document.addEventListener('click', () => {
      themeMenu.style.display = 'none';
    });
    themeMenu.addEventListener('click', (e) => e.stopPropagation());

    // Theme selection
    themeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const theme = opt.dataset.theme;
        this._applyTheme(theme);
        localStorage.setItem('simplecubik_theme', theme);
        themeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        themeMenu.style.display = 'none';
      });
    });
  }

  _applyTheme(theme) {
    // Remove all theme classes
    document.body.classList.remove('theme-dark', 'theme-amber', 'theme-blue', 'theme-light', 'theme-purple');
    if (theme !== 'default') {
      document.body.classList.add(`theme-${theme}`);
    }
    // Update 3D scene background to match CSS variable
    if (this._cube3d) {
      this._update3DBackground();
    }
  }

  _update3DBackground() {
    if (!this._cube3d) return;
    const bg = getComputedStyle(document.body).getPropertyValue('--cube-bg').trim();
    if (bg) {
      this._cube3d.scene.background = new THREE.Color(bg);
    }
  }

  _scramble() {
    this.cube.scramble(8);
    this.moves = 0;
    this.showCelebration = false;
    this.solvedBadge.style.display = 'none';
    this._history = [];
    this._renderCube();
    this._updateControls();
    this._sync3D();
    this._saveToLocalStorage();
  }

  _setView(mode) {
    this._viewMode = mode;

    // Update tab buttons
    for (const [id, btn] of Object.entries(this.viewBtns)) {
      btn.classList.toggle('active', id === mode);
    }

    if (mode === '3d') {
      this.cubeContainer.style.display = 'none';
      this.cube3dContainer.style.display = 'flex';
      this.faceButtons.style.display = 'flex';
      this.controls2d.style.display = 'none';
      this._update3DFaceButtons();
      this._init3D();
    } else {
      this.cubeContainer.style.display = 'flex';
      this.cube3dContainer.style.display = 'none';
      this.faceButtons.style.display = 'none';
      this.controls2d.style.display = 'flex';
      this._renderCube();
    }
    this._updateControls();
  }

  // ==================== CUBE RENDERER ====================

  _init3D() {
    if (this._cube3d) {
      this._cube3d.rebuild();
      this._cube3d.moves = this.moves;
      this._ensure3DDebug();
      return;
    }
    // Check THREE is globally available from CDN script
    if (typeof THREE === 'undefined') {
      console.error('THREE not loaded');
      return;
    }
    this._cube3d = new CubeBuddy3D({
      container: this.cube3dContainer,
      cube: this.cube,
      onTurn: (move) => {
        // Save undo history when turning from 3D view
        this._pushHistory();
        this.moves++;
        this.moveCount.textContent = this.moves;
        if (this.cube.isSolved) {
          this._showCelebration();
        }
      },
      onMovesChange: (m) => {
        this.moveCount.textContent = m;
        if (this.cube.isSolved) {
          this._showCelebration();
        }
      },
    });
    this._cube3d.rebuild();
    this._cube3d.moves = this.moves;
    // Apply current theme background to 3D scene
    this._update3DBackground();
    // Connect debug if ON
    this._ensure3DDebug();
    // Set up face button snapshots for 3D
    this._update3DFaceButtons();
  }

  _destroy3D() {
    if (this._cube3d) {
      this._cube3d.destroy();
      this._cube3d = null;
    }
  }

  _update3DFaceButtons() {
    const colorNames = ['U','D','C','B','L','R'];
    const faceLabels = {
      'U': 'Up View',
      'D': 'Down View',
      'C': 'Center View',
      'B': 'Back View',
      'L': 'Left View',
      'R': 'Right View',
    };
    const self = this;
    // Fixed buttons: U/D/F/B/L/R always snap to that face — no color tracking
    for (let ci = 0; ci < 6; ci++) {
      const btn = document.querySelector(`.b${colorNames[ci]}`);
      if (btn) {
        btn.dataset.snapTarget = colorNames[ci];
        btn.onclick = () => {
          if (self._cube3d) {
            self._cube3d.snapToFace(colorNames[ci]);
            self._showCameraFlash(faceLabels[colorNames[ci]]);
          } else {
            // 2D mode: highlight the corresponding face
            const faces = self.cubeContainer.querySelectorAll('.cube-face');
            faces.forEach(f => f.classList.remove('highlighted'));
            // Map C (Center) to F (Front) index for 2D highlighting
            const letter = colorNames[ci] === 'C' ? 'F' : colorNames[ci];
            const targetIdx = FACE_LETTERS.indexOf(letter);
            faces.forEach(f => {
              if (parseInt(f.dataset.faceIdx) === targetIdx) {
                f.classList.add('highlighted');
              }
            });
          }
        };
      }
    }
    // Remove the doMove override that was updating button colors
    // (it's no longer needed since buttons are fixed)
  }

  _showCameraFlash(label) {
    const flash = document.getElementById('camera-flash');
    if (!flash) return;
    flash.textContent = label;
    flash.style.display = 'block';
    // Force reflow then fade in
    void flash.offsetWidth;
    flash.style.opacity = '1';
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => { flash.style.display = 'none'; }, 300);
    }, 2800);
  }

  _sync3D() {
    if (this._cube3d) {
      this._cube3d.rebuild();
      this._cube3d.moves = this.moves;
      this._update3DFaceButtons();
    }
  }

  _renderCube() {
    const container = this.cubeContainer;
    const rect = container.getBoundingClientRect();
    // Subtract CSS padding so faces don't overflow the content area
    const padL = parseInt(getComputedStyle(container).paddingLeft) || 0;
    const padR = parseInt(getComputedStyle(container).paddingRight) || 0;
    const padT = parseInt(getComputedStyle(container).paddingTop) || 0;
    const padB = parseInt(getComputedStyle(container).paddingBottom) || 0;
    const availW = rect.width - padL - padR;
    const availH = rect.height - padT - padB;

    if (availW <= 0 || availH <= 0) return;

    // Compute sticker size that fits the full 9-face cross net — bigger faces, less breathing room
    let faceSpecs, widthDivisor;
    if (this._focusMode === 'focus') {
      faceSpecs = FACE_SPECS_FOCUS;
      widthDivisor = 10.5;
    } else if (this._focusMode === 'cross') {
      faceSpecs = FACE_SPECS_CROSS;
      widthDivisor = 14; // 3 columns (L,F,R) + margins
    } else {
      faceSpecs = FACE_SPECS_CLASSIC;
      widthDivisor = 17;
    }
    // Compute row range for dynamic centering and height divisor
    const rows = faceSpecs.map(s => s.row);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const rawSize = Math.min(availW / widthDivisor, availH / ((maxRow - minRow + 1) * 3.3 + 0.3));
    const stickerSize = Math.floor(Math.min(rawSize, 110));
    if (stickerSize < 10) return;

    const gap = Math.max(1, Math.floor(stickerSize * 0.05));    // thin border between stickers
    const faceMargin = Math.floor(stickerSize * 0.2);          // space between faces — halved for tighter layout
    const borderExtra = Math.floor(stickerSize * 0.18);         // thinner border wrapping each face
    const stickerPitch = stickerSize + gap;
    const faceWidth = 2 * stickerPitch + stickerSize;
    const facePitch = faceWidth + faceMargin;

    // Clear previous
    container.innerHTML = '';

    // Wrap everything in a container
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.position = 'relative';

    const cx = availW / 2;
    // Calculate cy to vertically center all faces in the content area
    const midRow = (minRow + maxRow) / 2;
    const cy = availH / 2 - (midRow - 1) * facePitch;

    const pos = (row, col) => ({
      x: cx + (col - 1) * facePitch,
      y: cy + (row - 1) * facePitch,
    });

    // Render each face
    faceSpecs.forEach(spec => {
      const center = pos(spec.row, spec.col);
      this._drawFace(container, center.x, center.y, spec, stickerSize, stickerPitch, faceWidth, borderExtra);
    });

    // Center the net
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
  }

  _drawFace(container, cx, cy, spec, stickerSize, stickerPitch, faceWidth, borderExtra) {
    const { faceIdx, mirror, swapRows } = spec;

    // Face wrapper
    const faceEl = document.createElement('div');
    faceEl.className = 'cube-face';
    faceEl.style.left = `${cx - (faceWidth + borderExtra) / 2}px`;
    faceEl.style.top = `${cy - (faceWidth + borderExtra) / 2}px`;
    faceEl.style.width = `${faceWidth + borderExtra}px`;
    faceEl.style.height = `${faceWidth + borderExtra}px`;
    faceEl.style.gridGap = `${stickerPitch - stickerSize}px`;
    const borderWidth = Math.max(2, Math.floor(stickerSize * 0.08));
    faceEl.style.border = `${borderWidth}px solid ${FACE_BORDER_COLORS[faceIdx]}`;
    // Padding accounts for border inside border-box: pad = borderExtra/2 - borderWidth
    const padPx = Math.max(0, Math.floor(borderExtra / 2 - borderWidth));
    faceEl.style.padding = `${padPx}px`;
    faceEl.style.borderRadius = `${Math.floor(stickerSize * 0.28)}px`;
    faceEl.style.background = 'transparent';

    // Store face data for hit testing
    faceEl.dataset.faceIdx = faceIdx;
    faceEl.dataset.cx = cx;
    faceEl.dataset.cy = cy;
    const facePitch = faceWidth + (stickerSize * 0.5); // faceWidth + faceMargin
    faceEl.dataset.facePitch = facePitch;
    faceEl.dataset.mirror = mirror ? '1' : '0';
    faceEl.dataset.swapRows = swapRows ? '1' : '0';
    faceEl.style.position = 'absolute';

    // 3x3 sticker grid
    faceEl.style.display = 'grid';
    faceEl.style.gridTemplateColumns = 'repeat(3, 1fr)';
    faceEl.style.gridTemplateRows = 'repeat(3, 1fr)';
    faceEl.style.placeItems = 'center';

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const drawRow = swapRows ? (2 - row) : row;
        const drawCol = mirror ? (2 - col) : col;
        // Use actual cube state for ALL stickers (including centers) — matches 3D
        const colorIdx = this.cube.getFaceletColor(faceIdx, drawRow, drawCol);

        const sticker = document.createElement('div');
        sticker.className = 'sticker';
        sticker.style.width = `${stickerSize}px`;
        sticker.style.height = `${stickerSize}px`;
        sticker.style.borderRadius = `${Math.floor(stickerSize * 0.15)}px`;

        // Inner with background color
        const inner = document.createElement('div');
        inner.className = 'sticker-inner';
        inner.style.width = '100%';
        inner.style.height = '100%';
        inner.style.background = FACE_COLORS_2D[colorIdx];
        inner.style.borderRadius = `${Math.floor(stickerSize * 0.12)}px`;
        inner.style.boxShadow = 'inset 0 1px 2px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.3)';
        inner.style.display = 'flex';
        inner.style.alignItems = 'center';
        inner.style.justifyContent = 'center';

        // Center letter — follow the color, not the face identity
        if (row === 1 && col === 1) {
          const label = document.createElement('div');
          label.className = 'sticker-label';
          const isLight = colorIdx === 0 || colorIdx === 1;
          label.style.color = isLight ? '#000' : '#fff';
          label.style.fontWeight = '700';
          label.style.fontSize = `${Math.floor(stickerSize * 0.44)}px`;
          // Map actual color to the corresponding face letter
          const FACE_LABEL = ['U','D','C','B','L','R'];
          label.textContent = FACE_LABEL[faceIdx] || '?';
          inner.appendChild(label);
        } else if (this._debugShowIndex) {
          // Index debug number on non-center stickers
          const idxLabel = document.createElement('div');
          idxLabel.className = 'sticker-debug-idx';
          const drawRowIdx = drawRow;
          const drawColIdx = drawCol;
          const idx = faceIdx * 9 + drawRowIdx * 3 + drawColIdx;
          idxLabel.textContent = idx;
          idxLabel.style.color = 'rgba(0,255,0,0.8)';
          idxLabel.style.fontSize = `${Math.floor(stickerSize * 0.28)}px`;
          idxLabel.style.fontWeight = 'bold';
          idxLabel.style.fontFamily = 'monospace';
          idxLabel.style.textShadow = '0 0 4px rgba(0,0,0,0.9), 0 0 2px #000';
          idxLabel.style.pointerEvents = 'none';
          inner.appendChild(idxLabel);
        }

        sticker.appendChild(inner);
        faceEl.appendChild(sticker);
      }
    }

    container.appendChild(faceEl);
  }

  // ==================== TOUCH HANDLING ====================

  _setupCubeTouch() {
    // ResizeObserver re-renders cube on container resize / browser zoom
    this._resizeObserver = new ResizeObserver(() => {
      if (this._viewMode === '2d') {
        this._renderCube();
      }
    });
    this._resizeObserver.observe(this.cubeContainer);

    let touchStartX, touchStartY;
    let touchStartFace = null; // face index where touch started
    let touchStartEl = null; // face element where touch started
    let lastTapTime = 0;
    let tapPending = false;

    const handleTap = (x, y, isDoubleTap) => {
      const face = this._hitTestFace(x, y);
      if (face !== null) {
        // Only spin the face if tapping the center cell (1,1)
        const cellResult = this._resolveCell(x, y, face);
        if (cellResult && cellResult.cell.row === 1 && cellResult.cell.col === 1) {
          const move = ['U', 'D', 'F', 'B', 'L', 'R'][face];
          this._doMove(move, isDoubleTap);
        } else {
          this._debugLog(`2D TAP: non-center cell — ignored`);
        }
      }
    };

    const onPointerDown = (x, y) => {
      touchStartX = x;
      touchStartY = y;
      touchStartFace = this._hitTestFace(x, y); // which face the touch started on
      if (touchStartFace !== null) {
        // Resolve which cell (row,col) was touched within the face
        const cellResult = this._resolveCell(x, y, touchStartFace);
        if (cellResult) {
          const { cell, faceEl } = cellResult;
          touchStartEl = faceEl; // save element for swipe resolution
          // Convert cell coords to native face coords if swapRows/mirror are applied
          let displayRow = cell.row;
          let displayCol = cell.col;
          // Faces with swapRows+mirror need coordinate inversion:
          // Cross view B (single), Full view UB/DB (B top/B real)
          if (touchStartFace === 3) {
            // Check the actual face element's rendering spec
            if (faceEl && faceEl.dataset.swapRows === '1' && faceEl.dataset.mirror === '1') {
              displayRow = 2 - cell.row;
              displayCol = 2 - cell.col;
            }
          }
          this._debugLog(`2D DOWN: ${['U','D','F','B','L','R'][touchStartFace]}(${displayRow},${displayCol})`);
        } else {
          this._debugLog(`2D DOWN: ${['U','D','F','B','L','R'][touchStartFace]} at (${x.toFixed(0)},${y.toFixed(0)})`);
        }
      }
    };

    const onPointerUp = (x, y) => {
      if (touchStartX === undefined) return;

      const dx = x - touchStartX;
      const dy = y - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= 10 && touchStartFace !== null) {
        const dirLabel = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? '→' : '←') : (dy > 0 ? '↓' : '↑');
        this._debugLog(`2D SWIPE: ${['U','D','F','B','L','R'][touchStartFace]} ${dirLabel} dist=${dist.toFixed(0)}`);
      }

      if (dist < 10) {
        // It's a tap — check for double tap
        const now = Date.now();
        if (now - lastTapTime < 350) {
          // Double tap! Cancel the pending single tap
          if (tapPending) {
            clearTimeout(tapPending);
            tapPending = false;
          }
          handleTap(x, y, true);
          lastTapTime = 0;
        } else {
          // First tap — wait to see if it's a double tap
          lastTapTime = now;
          tapPending = setTimeout(() => {
            handleTap(x, y, false);
            tapPending = false;
            lastTapTime = 0;
          }, 400);
        }
      } else if (dist >= 10) {
        // Try row/column swipe on the starting face first
        const swipedFace = this._resolveSwipeOnFace(
          touchStartX, touchStartY,
          dx, dy, touchStartFace, touchStartEl
        );
        if (swipedFace) {
          this._debugLog(`2D → resolved: ${swipedFace}`);
          // Swipe direction determines CW vs CCW.
          // Each adjacent-face edge has a specific swipe direction that
          // turns the target face CW (based on physical cube geometry).
          const SWIPE_CW_DIR = {
            // F center → U/D/L/R
            2: { row0: 'left', row2: 'right', col0: 'down', col2: 'up' },
            // U → B/F/L/R
            0: { row0: 'left', row2: 'right', col0: 'down', col2: 'up' },
            // D → F/L/R/B
            1: { row0: 'left', row2: 'right', col0: 'down', col2: 'up' },
            // L → U/D/B/F
            4: { row0: 'left', row2: 'right', col0: 'down', col2: 'up' },
            // R → U/D/F/B
            5: { row0: 'left', row2: 'right', col0: 'down', col2: 'up' },
            // B → U/D/R/L (mirrored: col0=R, col2=L)
            3: { row0: 'left', row2: 'right', col0: 'down', col2: 'up' },
          };
          const isHorizontal = Math.abs(dx) >= Math.abs(dy);
          const swipeDir = isHorizontal
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
          // Determine which edge was used on the start face
          // Priority: for horizontal swipes → check row edges first
          //           for vertical swipes → check col edges first
          let targetEl = this._findFaceByPos(touchStartX, touchStartY, touchStartFace);
          let edgeKey = null;
          if (targetEl) {
            const r = targetEl.getBoundingClientRect();
            const style = getComputedStyle(targetEl);
            const padLeft = parseFloat(style.paddingLeft) || 0;
            const padTop = parseFloat(style.paddingTop) || 0;
            const borderLeft = parseFloat(style.borderLeftWidth) || 0;
            const borderTop = parseFloat(style.borderTopWidth) || 0;
            const insetX = padLeft + borderLeft;
            const insetY = padTop + borderTop;
            const innerW = Math.max(1, r.width - 2 * insetX);
            const innerH = Math.max(1, r.height - 2 * insetY);
            const localX = touchStartX - r.left - insetX;
            const localY = touchStartY - r.top - insetY;
            const cellW = innerW / 3;
            const cellH = innerH / 3;
            const col = Math.max(0, Math.min(2, Math.floor(localX / cellW)));
            const row = Math.max(0, Math.min(2, Math.floor(localY / cellH)));
            if (isHorizontal) {
              // Horizontal swipe → row edges matter most
              if (row === 0) edgeKey = 'row0';
              else if (row === 2) edgeKey = 'row2';
              else if (col === 0) edgeKey = 'col0';
              else if (col === 2) edgeKey = 'col2';
            } else {
              // Vertical swipe → col edges matter most
              if (col === 0) edgeKey = 'col0';
              else if (col === 2) edgeKey = 'col2';
              else if (row === 0) edgeKey = 'row0';
              else if (row === 2) edgeKey = 'row2';
            }
            // Middle column with vertical swipe or middle row with horizontal swipe → fall through to base rule
            if (edgeKey && ((isHorizontal && row === 1) || (!isHorizontal && col === 1))) edgeKey = null;
            // Restrict cells to specific swipe axes/directions to avoid ambiguity
            //   (0,0): right(→0,2) or down(→2,0) — not left or up
            //   (0,2): left(→0,0) or down(→2,2) — not right or up
            //   (2,0): right(→2,2) or up(→0,0) — not left or down
            //   (2,2): left(→2,0) or up(→0,2) — not right or down
            //   (0,1): down only
            //   (2,1): up only
            //   (1,0): right only
            //   (1,2): left only
            const forbidDir = targetEl ? {
              // corner cells: forbid the two outward directions
              '0,0': { 'right': false, 'left': true, 'down': false, 'up': true },
              '0,2': { 'left': false, 'right': true, 'down': false, 'up': true },
              '2,0': { 'right': false, 'left': true, 'up': false, 'down': true },
              '2,2': { 'left': false, 'right': true, 'up': false, 'down': true },
              // mid-edge cells: forbid the wrong axis
              '0,1': { 'down': false, 'up': true, 'left': true, 'right': true },
              '2,1': { 'up': false, 'down': true, 'left': true, 'right': true },
              '1,0': { 'right': false, 'left': true, 'down': true, 'up': true },
              '1,2': { 'left': false, 'right': true, 'down': true, 'up': true },
            }[row+','+col] : null;
            if (edgeKey !== null) {
              if (forbidDir && forbidDir[swipeDir]) edgeKey = null;
            }
            // If direction was forbidden, skip this swipe entirely (no base-rule fallback)
            if (forbidDir && forbidDir[swipeDir]) { swipedFace = null; }
            // Middle → turning the start face itself, use base rule
          }
          let isCcw;
          if (edgeKey && SWIPE_CW_DIR[touchStartFace]?.[edgeKey]) {
            // Adjacent face: CW = matching the lookup direction
            isCcw = swipeDir !== SWIPE_CW_DIR[touchStartFace][edgeKey];
            this._debugLog(`2D → dir: edgeKey=${edgeKey} swipeDir=${swipeDir} cwDir=${SWIPE_CW_DIR[touchStartFace][edgeKey]} baseCcw=${isCcw}`);
          } else {
            // Same face (middle row/col): base rule
            // left→right = CCW, right→left = CW
            // top→bottom = CW, bottom→top = CCW
            isCcw = isHorizontal ? swipeDir === 'right' : swipeDir !== 'down';
            this._debugLog(`2D → dir: base rule isCcw=${isCcw} isHoriz=${isHorizontal} swipeDir=${swipeDir}`);

            // R face is mirrored — invert direction for vertical middle-col swipes
            if (touchStartFace === 5 && !isHorizontal) isCcw = !isCcw;
            // D face — invert S slice direction (horizontal mid-row swipes)
            if (touchStartFace === 1 && isHorizontal) isCcw = !isCcw;
            // B face direction override
            if (touchStartFace === 3) {
              // LB/RB (mirror=0) have identity mapping — invert directions vs UB/DB (mirror=1, 180° rotated)
              const bMirror = targetEl && targetEl.dataset.mirror === '1';
              if (isHorizontal) {
                // U: right=CW, left=CCW. D: right=CCW, left=CW.
                // Invert E slice for UB/DB (mirror=1) only — LB/RB stay as-is
                isCcw = swipedFace === 'U' ? dx < 0 : dx > 0;
                if (bMirror) isCcw = !isCcw;
              } else {
                // L: down=CCW, up=CW. R: down=CW, up=CCW.
                // Invert M slice for LB/RB (identity mapping)
                isCcw = swipedFace === 'L' ? dy > 0 : dy < 0;
                if (!bMirror) isCcw = !isCcw;
              }
              this._debugLog(`2D → dir: B override face=${swipedFace} dy=${dy} mirror=${bMirror} finalCcw=${isCcw}`);
            }
          }
          this._doMove(swipedFace, isCcw); // true = 3 CW turns = 1 CCW
          this._debugLog(`2D → done: ${swipedFace} ${isCcw ? 'CCW' : 'CW'}`);
        }
      }

      touchStartX = undefined;
      touchStartY = undefined;
      touchStartFace = null;
      touchStartEl = null;
    };

    // Touch — set flag so we can ignore synthetic mouse events
    let fromTouch = false;
    let touchResetTimer = null;
    this.cubeContainer.addEventListener('touchstart', e => {
      fromTouch = true;
      clearTimeout(touchResetTimer);
      const t = e.touches[0];
      onPointerDown(t.clientX, t.clientY);
    }, { passive: true });

    this.cubeContainer.addEventListener('touchmove', e => {
      // Prevent default scrolling so vertical swipes aren't stolen by browser scroll
      if (e.touches.length === 1 && touchStartX !== undefined) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (Math.abs(dy) > 10 || Math.abs(dx) > 10) {
          e.preventDefault();
        }
      }
    }, { passive: false });

    this.cubeContainer.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      onPointerUp(t.clientX, t.clientY);
      clearTimeout(touchResetTimer);
      touchResetTimer = setTimeout(() => { fromTouch = false; }, 500);
    }, { passive: true });

    this.cubeContainer.addEventListener('touchcancel', e => {
      touchStartX = undefined;
      touchStartY = undefined;
      touchStartFace = null;
      touchStartEl = null;
      if (tapPending) {
        clearTimeout(tapPending);
        tapPending = false;
        lastTapTime = 0;
      }
    }, { passive: true });

    // Mouse — ignore if a touch event just fired (avoids double-fire on mobile)
    this.cubeContainer.addEventListener('mousedown', e => {
      if (fromTouch) return;
      onPointerDown(e.clientX, e.clientY);
    });
    this.cubeContainer.addEventListener('mouseup', e => {
      if (fromTouch) {
        fromTouch = false;
        return;
      }
      onPointerUp(e.clientX, e.clientY);
    });
  }

  // Resolve a swipe gesture on a face into an adjacent face turn.
  // Returns the move letter (e.g. 'U', 'R') or null.
  // Face adjacency in cross-net Focus layout:
  //   U is above F, D below F, L left of F, R right of F
  //   U connects to L/R at its sides
  //   D connects to L/R at its sides
  //   L connects to U/D at its top/bottom
  //   R connects to U/D at its top/bottom
  _resolveSwipeOnFace(startX, startY, dx, dy, startFace, startEl) {
    if (startFace === null) return null;

    // Use the pre-resolved face element when available, otherwise fallback to nearest-face search
    let targetEl = null;
    if (startEl && document.contains(startEl)) {
      targetEl = startEl;
    }
    if (!targetEl) {
      targetEl = this._findFaceByPos(startX, startY, startFace);
    }
    if (!targetEl) return null;

    const rect = targetEl.getBoundingClientRect();
    const isHorizontal = Math.abs(dx) >= Math.abs(dy);

    // Determine which row/column within the face the touch started on
    // Account for border/padding (border-box) so 3x3 grid aligns with stickers
    const style = getComputedStyle(targetEl);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padTop = parseFloat(style.paddingTop) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const insetX = padLeft + borderLeft;
    const insetY = padTop + borderTop;
    const innerW = Math.max(1, rect.width - 2 * insetX);
    const innerH = Math.max(1, rect.height - 2 * insetY);
    const localX = startX - rect.left - insetX;
    const localY = startY - rect.top - insetY;
    const cellW = innerW / 3;
    const cellH = innerH / 3;
    const touchCol = Math.floor(localX / cellW);
    const touchRow = Math.floor(localY / cellH);
    const col = Math.max(0, Math.min(2, touchCol));
    const row = Math.max(0, Math.min(2, touchRow));

    // Convert DOM cell coords to native face coords using the face element's mirror/swapRows
    const isMirror = targetEl.dataset.mirror === '1';
    const isSwapped = targetEl.dataset.swapRows === '1';
    const nativeRow = isSwapped ? (2 - row) : row;
    const nativeCol = isMirror ? (2 - col) : col;

    // Adjacency mapping for Focus view cross net layout:
    //          U (r0,c1)
    //     L(r1,c0) F(r1,c1) R(r1,c2)
    //          D (r2,c1)
    // Face indices: 0=U, 1=D, 2=F, 3=B, 4=L, 5=R
    const ADJACENT = {
      2: { // F center
        row0: 0, // top row → U
        row2: 1, // bottom row → D
        col0: 4, // left col → L
        col2: 5, // right col → R
      },
      0: { // U (top of net)
        row0: 3, // top row → B
        row2: 2, // bottom row → F
        col0: 4, // left col → L
        col2: 5, // right col → R
      },
      1: { // D (bottom of net)
        row0: 2, // top row → F
        row2: 3, // bottom row → B
        col0: 4, // left col → L
        col2: 5, // right col → R
      },
      4: { // L (left of net)
        row0: 0, // top row → U
        row2: 1, // bottom row → D
        col0: 3, // left col → B
        col2: 2, // right col → F
      },
      5: { // R (right of net)
        row0: 0, // top row → U
        row2: 1, // bottom row → D
        col0: 2, // left col → F
        col2: 3, // right col → B
      },
      3: { // B (back face) — cross net: B below D, L right, R left (mirrored)
        row0: 1, // top row → D
        col0: 5, // left col → R (B is mirrored: left edge = R)
        col2: 4, // right col → L (B is mirrored: right edge = L)
      },
    };

    const adj = ADJACENT[startFace];
    if (!adj) return ['U', 'D', 'F', 'B', 'L', 'R'][startFace];

    // LOGIC: The row/column of the touch tells us WHICH EDGE.
    // For horizontal swipes, the ROW matters (top/bottom edge).
    // For vertical swipes, the COLUMN matters (left/right edge).
    let targetFace = null;

    // B face (back) needs special handling: all B faces use same native coordinate mapping
    if (startFace === 3 && targetFace === null) {
      if (isHorizontal) {
        // Native row 0 (top): left→U, right→U
        // Native row 2 (bottom): left→D, right→D
        // col determines CW/CCW direction logic, not target face
        if (nativeRow === 0) {
          targetFace = 0; // U
        } else if (nativeRow === 2) {
          targetFace = 1; // D
        }
      } else {
        // Vertical: native col 0 = R, native col 2 = L (B face is back, reversed)
        if (nativeCol === 0) targetFace = 5; // R
        else if (nativeCol === 2) targetFace = 4; // L
      }
    }

    // B face position-specific adjacency — REMOVED, too complex with 4 B card positions
    // B face swipes fall through to standard ADJACENT (self-turn = B face turns)

    if (targetFace === null) {
      if (isHorizontal) {
        // Horizontal swipe: direction determines target
        if (dx > 0) {
          // Swiping right: if any edge on right side, turn right-face
          if (col === 2 && adj.col2 !== null) {
            targetFace = adj.col2;
          } else if (row === 0 && adj.row0 !== null) {
            targetFace = adj.row0;
          } else if (row === 2 && adj.row2 !== null) {
            targetFace = adj.row2;
          }
        } else {
          // Swiping left: if any edge on left side, turn left-face
          if (col === 0 && adj.col0 !== null) {
            targetFace = adj.col0;
          } else if (row === 0 && adj.row0 !== null) {
            targetFace = adj.row0;
          } else if (row === 2 && adj.row2 !== null) {
            targetFace = adj.row2;
          }
        }
      } else {
        // Vertical swipe: direction determines target
        if (dy > 0) {
          // Swiping down: if any edge on bottom, turn bottom-face
          if (row === 2 && adj.row2 !== null) {
            targetFace = adj.row2;
          } else if (col === 0 && adj.col0 !== null) {
            targetFace = adj.col0;
          } else if (col === 2 && adj.col2 !== null) {
            targetFace = adj.col2;
          }
        } else {
          // Swiping up: if any edge on top, turn top-face
          if (row === 0 && adj.row0 !== null) {
            targetFace = adj.row0;
          } else if (col === 0 && adj.col0 !== null) {
            targetFace = adj.col0;
          } else if (col === 2 && adj.col2 !== null) {
            targetFace = adj.col2;
          }
        }
      }
    }

    // Fallback: middle row/col → 2D slice support
    // Match 3D edgeAdjacency mapping (from cube-3d-view.js):
    //   F: midLeft/midRight=E, midTop/midBottom=M
    //   U: midLeft/midRight=S, midTop/midBottom=M
    //   D: midLeft/midRight=S, midTop/midBottom=M
    //   L: midLeft/midRight=E, midTop/midBottom=S
    //   R: midLeft/midRight=E, midTop/midBottom=S
    const MID_ROW_SLICE = { 0:'S', 1:'S', 2:'E', 3:'E', 4:'E', 5:'E' };
    const MID_COL_SLICE = { 0:'M', 1:'M', 2:'M', 3:'M', 4:'S', 5:'S' };
    const isRowMid = (row === 1);
    const isColMid = (col === 1);
    if (isRowMid && isHorizontal) {
      return MID_ROW_SLICE[startFace] || 'E';
    }
    if (isColMid && !isHorizontal) {
      return MID_COL_SLICE[startFace] || 'M';
    }

    return ['U', 'D', 'F', 'B', 'L', 'R'][targetFace];
  }

  // Find the closest face element by faceIdx from a given clientX/Y position
  // This is THE single source of truth — never use forEach+overwrite for faceIdx matching.
  _findFaceByPos(clientX, clientY, faceIdx) {
    const faces = this.cubeContainer.querySelectorAll('.cube-face');
    let best = null;
    let bestDist = Infinity;
    faces.forEach(el => {
      if (parseInt(el.dataset.faceIdx) === faceIdx) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
        if (dist < bestDist) { bestDist = dist; best = el; }
      }
    });
    return best;
  }

  _hitTestFace(clientX, clientY) {
    const rect = this.cubeContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Find nearest face center
    const faces = this.cubeContainer.querySelectorAll('.cube-face');
    let bestDist = Infinity;
    let bestFace = null;

    faces.forEach(el => {
      const cx = parseFloat(el.dataset.cx);
      const cy = parseFloat(el.dataset.cy);
      const pitch = parseFloat(el.dataset.facePitch);
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < pitch * 0.55 && dist < bestDist) {
        bestDist = dist;
        bestFace = parseInt(el.dataset.faceIdx);
      }
    });

    return bestFace;
  }

  _resolveCell(clientX, clientY, faceIdx) {
    // Find the face element closest to the click position
    const targetEl = this._findFaceByPos(clientX, clientY, faceIdx);
    if (!targetEl) return null;
    const rect = targetEl.getBoundingClientRect();
    const style = getComputedStyle(targetEl);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padTop = parseFloat(style.paddingTop) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const insetX = padLeft + borderLeft;
    const insetY = padTop + borderTop;
    const innerW = Math.max(1, rect.width - 2 * insetX);
    const innerH = Math.max(1, rect.height - 2 * insetY);
    const localX = clientX - rect.left - insetX;
    const localY = clientY - rect.top - insetY;
    const col = Math.max(0, Math.min(2, Math.floor(localX / (innerW / 3))));
    const row = Math.max(0, Math.min(2, Math.floor(localY / (innerH / 3))));
    return { cell: { row, col }, faceEl: targetEl };
  }

  _doMove(move, isDoubleTap = false) {
    // Save current state to undo history before applying move
    this._pushHistory();

    // Snapshot state before move for color-change debug
    const stateBefore = this.cube.state.slice();

    if (move === 'M' || move === 'E' || move === 'S') {
      // Slice moves: isDoubleTap=true means CCW (prime), false means CW
      if (isDoubleTap) {
        this.cube.doMove(move + "'");
      } else {
        this.cube.doMove(move);
      }
    } else {
      // Face moves
      if (isDoubleTap) {
        this.cube.turnFace(move);
        this.cube.turnFace(move);
        this.cube.turnFace(move);
      } else {
        this.cube.turnFace(move);
      }
    }

    this.moves++;
    this._renderCube();
    this._updateControls();
    this._sync3D();
    this._saveToLocalStorage();

    // Show color changes in bottom debug
    if (this._debugVisible) {
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

    // Check win
    if (this.cube.isSolved) {
      this._showCelebration();
    }
  }

  _updateControls() {
    this.moveCount.textContent = this.moves;

    if (this.cube.isSolved) {
      this.solvedBadge.style.display = 'inline-block';
    } else {
      this.solvedBadge.style.display = 'none';
    }
  }

  // ==================== CELEBRATION ====================

  _showCelebration() {
    this.celebMsg.textContent = '🎉🌟🎊🎈🎀✨🎇';
    this.celebrationOverlay.classList.add('active');
    this._spawnConfetti();
  }

  _dismissCelebration() {
    this.celebrationOverlay.classList.remove('active');
    this.confettiContainer.innerHTML = '';
  }

  _spawnConfetti() {
    const colors = ['#FF6B81', '#FFA502', '#2ED573', '#6C63FF', '#FFEB3B', '#FF4757', '#1E90FF', '#FF69B4'];
    const container = this.confettiContainer;
    container.innerHTML = '';

    for (let i = 0; i < 80; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${6 + Math.random() * 8}px`;
      piece.style.height = `${6 + Math.random() * 8}px`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.animationDuration = `${2 + Math.random() * 3}s`;
      piece.style.animationDelay = `${Math.random() * 2}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(piece);
    }
  }

  // ==================== UNDO HISTORY ====================

  _pushHistory() {
    this._history.push({
      state: [...this.cube._state],
      moves: this.moves,
    });
    // Keep max 5
    if (this._history.length > 5) {
      this._history.shift();
    }
    // Update undo button state
    this._updateUndoBtn();
  }

  _undo() {
    if (this._history.length === 0) return;
    const prev = this._history.pop();
    this.cube._state = [...prev.state];
    this.moves = prev.moves;
    this.showCelebration = false;
    this.solvedBadge.style.display = 'none';
    this._renderCube();
    this._updateControls();
    this._updateUndoBtn();
    this._sync3D();
  }

  _updateUndoBtn() {
    if (this.undoBtn) {
      this.undoBtn.disabled = this._history.length === 0;
      this.undoBtn.style.opacity = this._history.length === 0 ? '0.3' : '1';
    }
  }

  resetCube() {
    this.cube.reset();
    this.moves = 0;
    this._history = [];
    this.showCelebration = false;
    this.solvedBadge.style.display = 'none';
    this._renderCube();
    this._updateControls();
    this._sync3D();
    this._saveToLocalStorage();
  }

  // Rearrange face groups so each face's stickers match its center color
  // The snapshot of colors is preserved — only which face they belong to changes
  _alignFaces() {
    const s = this.cube._state;
    // Read current center of each face: centerOf[faceIdx] = colorIndex
    // E.g., if U face (idx 0) has center color 2 (green), centerOf[0] = 2
    const centerOf = [0,1,2,3,4,5].map(f => s[f * 9 + 4]);
    // Build face permutation: for each face, which face's stickers should go there
    // facePerm[targetFace] = sourceFace — the face whose stickers currently have the right center color
    // If U center is green (idx 2), then F face's stickers (which have green center) should go to U position
    const facePerm = new Array(6);
    for (let targetFace = 0; targetFace < 6; targetFace++) {
      // Which color should targetFace show? It should show its own center.
      const expectedColor = targetFace;
      // Which face currently has that color as its center?
      const sourceFace = centerOf.indexOf(expectedColor);
      facePerm[targetFace] = sourceFace;
    }
    // Apply permutation: move 9-sticker blocks to their new positions
    const oldState = [...s];
    for (let targetFace = 0; targetFace < 6; targetFace++) {
      const sourceFace = facePerm[targetFace];
      for (let i = 0; i < 9; i++) {
        s[targetFace * 9 + i] = oldState[sourceFace * 9 + i];
      }
    }
    this.moves = 0;
    this._history = [];
    this.showCelebration = false;
    this.solvedBadge.style.display = 'none';
    this._renderCube();
    this._updateControls();
    this._sync3D();
    this._saveToLocalStorage();
  }

  _toggleDebug() {
    if (typeof this._debugVisible === 'undefined') this._debugVisible = false;
    this._debugVisible = !this._debugVisible;
    this._debugShowIndex = this._debugVisible;
    const el = document.getElementById('debug-overlay');
    const el2 = document.getElementById('debug-overlay-bottom');
    if (el) {
      el.style.display = this._debugVisible ? 'block' : 'none';
      if (this._debugVisible) el.textContent = '🐛 Debug ON';
    }
    if (el2) {
      el2.style.display = this._debugVisible ? 'block' : 'none';
      if (this._debugVisible) el2.textContent = '';
    }
    const btn = document.getElementById('debug-btn');
    if (btn) btn.textContent = this._debugVisible ? '🐛ON' : '🐛';
    // Always try to connect debug to 3D cube whenever toggled
    this._setup3DDebug();
    // Clear logs on toggle
    if (!this._debugVisible) {
      if (el) el.textContent = '';
      if (el2) el2.textContent = '';
    }
    // Re-render 2D view to show/hide index numbers
    if (el2) this._renderCube();
  }

  _debugLog(msg) {
    if (!this._debugVisible) return;
    const el = document.getElementById('debug-overlay');
    if (el) {
      const lines = (el.textContent || '').split('\n');
      lines.push(msg);
      el.textContent = lines.slice(-5).join('\n');
    }
  }

  _debugLogBottom(msg) {
    if (!this._debugVisible) return;
    const el = document.getElementById('debug-overlay-bottom');
    if (el) {
      const lines = (el.textContent || '').split('\n');
      lines.push(msg);
      el.textContent = lines.slice(-6).join('\n');
    }
  }

  // Expose debug in 3D CubeBuddy3D instance
  _setup3DDebug() {
    if (!this._cube3d) return;
    const self = this;
    this._cube3d._debugLog = (msg) => self._debugLog(msg);
    this._cube3d._debugLogBottom = (msg) => self._debugLogBottom(msg);
  }

  // Also called when 3D view is first created
  _ensure3DDebug() {
    if (this._debugVisible && this._cube3d) {
      this._setup3DDebug();
    }
  }

  // ==================== SNAPSHOTS ====================

  _saveSnapshot(slotIndex) {
    if (slotIndex < 0 || slotIndex > 2) return;
    const name = prompt(`Name for snapshot ${slotIndex + 1}:`, `Snapshot ${slotIndex + 1}`);
    if (!name) return; // cancelled
    this._snapshots[slotIndex] = {
      name: name.substring(0, 16),
      state: [...this.cube._state],
      moves: this.moves,
    };
    this._renderSnapshotSlots();
    this._saveSnapshotsToStorage();
  }

  _loadSnapshot(slotIndex) {
    const snap = this._snapshots[slotIndex];
    if (!snap) return;
    this.cube._state = [...snap.state];
    this.moves = snap.moves;
    this.showCelebration = false;
    this.solvedBadge.style.display = 'none';
    this._renderCube();
    this._updateControls();
    this._sync3D();
  }

  _renderSnapshotSlots() {
    if (!this.snapshotContainer) return;
    this.snapshotContainer.innerHTML = '';
    // 3 snapshot slots
    for (let i = 0; i < 3; i++) {
      const snap = this._snapshots[i];
      const btn = document.createElement('button');
      btn.className = 'snapshot-btn';
      btn.innerHTML = snap
        ? `<span class="snap-name">${snap.name}</span><span class="snap-moves">${snap.moves}m</span>`
        : `<span class="snap-name">Slot ${i + 1}</span>`;
      btn.onclick = () => this._loadSnapshot(i);
      btn.oncontextmenu = (e) => { e.preventDefault(); this._saveSnapshot(i); };
      let pressTimer = null;
      btn.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          this._saveSnapshot(i);
          pressTimer = null;
        }, 500);
      });
      btn.addEventListener('touchend', () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      });
      btn.addEventListener('touchmove', () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      });
      this.snapshotContainer.appendChild(btn);
    }
  }

  // ==================== CAMERA SCAN ====================

  _startScan() {
    document.getElementById('scan-overlay').style.display = 'flex';
    this._scanFaces = new Array(6);
    this._scanCurrentFace = 0;
    this._scanDone = false;

    this._scanVideo = document.getElementById('scan-video');
    this._scanCaptureBtn = document.getElementById('scan-capture-btn');
    this._scanRetryBtn = document.getElementById('scan-retry-btn');
    this._scanContinueBtn = document.getElementById('scan-continue-btn');
    this._scanFinishBtn = document.getElementById('scan-finish-btn');
    this._scanFaceName = document.getElementById('scan-face-name');
    this._scanFaceLabel = document.getElementById('scan-face-label');
    this._scanInstructions = document.getElementById('scan-instructions');
    this._scanProgress = document.getElementById('scan-progress');
    this._scanNetPreview = document.getElementById('scan-net-preview');
    this._scanTitle = document.getElementById('scan-title');
    this._scanBackBtn = document.getElementById('scan-back-btn');
    this._scanCameraContainer = document.getElementById('scan-camera-container');
    this._scanActions = document.querySelector('.scan-actions');

    this._updateScanProgress();
    this._updateScanInstruction();
    this._setupScanButtons();
    this._openCamera();
  }

  _updateScanProgress() {
    const dots = this._scanProgress.querySelectorAll('.scan-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === this._scanCurrentFace);
      dot.classList.toggle('done', !!this._scanFaces[i]);
    });
  }

  _updateScanInstruction() {
    const faceIdx = this._scanCurrentFace;
    const faceNames = ['WHITE','YELLOW','GREEN','BLUE','ORANGE','RED'];
    this._scanFaceName.textContent = faceNames[faceIdx];
    this._scanFaceLabel.textContent = FACE_LABELS[faceIdx];
    this._scanTitle.textContent = `Face ${faceIdx + 1} of 6`;
    const camContainer = document.getElementById('scan-camera-container');
    let existingMsg = camContainer.querySelector('.scan-camera-hint');
    if (!existingMsg) {
      const hint = document.createElement('div');
      hint.className = 'scan-camera-hint';
      hint.style.cssText = 'position:absolute;bottom:80px;left:0;right:0;text-align:center;color:rgba(255,255,255,0.6);font-size:14px;background:rgba(0,0,0,0.5);padding:8px;z-index:10;pointer-events:none;';
      camContainer.appendChild(hint);
      existingMsg = hint;
    }
    // Orientation hints so captured faces align correctly in 3D/2D
    const orientationHints = [
      '⬜ U: White toward camera, Green on top, Red on left',
      '🟨 D: Yellow toward camera, Green on top, Orange on left',
      '🟩 F: Green toward camera, White on top, Orange on left',
      '🟦 B: Blue toward camera, White on top, Red on left',
      '🟧 L: Orange toward camera, White on top, Blue on left',
      '🟥 R: Red toward camera, White on top, Green on left',
    ];
    existingMsg.textContent = orientationHints[faceIdx] || '📸 Hold the cube face flat toward camera';

    // Also update the instruction text below camera window (orientation only, no duplicate face name)
    const hintParts = orientationHints[faceIdx].split(': ');
    if (hintParts.length > 1) {
      this._scanInstructions.innerHTML = `Hold your cube with the <strong>${faceNames[faceIdx]}</strong> face toward the camera — ${hintParts[1]}<br><span style="font-size:12px;opacity:0.6;">💡 Good lighting = better scan. Avoid shadows or dim light.</span>`;
    }
  }

  _setupScanButtons() {
    this._scanCaptureBtn.onclick = () => this._doCapture();
    this._scanRetryBtn.onclick = () => {
      this._scanCaptureBtn.style.display = '';
      this._scanRetryBtn.style.display = 'none';
      this._scanContinueBtn.style.display = 'none';
      this._scanFinishBtn.style.display = 'none';
      this._scanInstructions.style.display = '';
      const cc = document.getElementById('scan-center-color');
      if (cc) cc.style.display = 'none';
      this._clearScanGrid();
    };
    this._scanContinueBtn.onclick = () => {
      this._scanCurrentFace++;
      if (this._scanCurrentFace >= 6) {
        this._finishScan();
        return;
      }
      this._scanCaptureBtn.style.display = '';
      this._scanRetryBtn.style.display = 'none';
      this._scanContinueBtn.style.display = 'none';
      this._scanFinishBtn.style.display = 'none';
      this._scanInstructions.style.display = '';
      const cc = document.getElementById('scan-center-color');
      if (cc) cc.style.display = 'none';
      this._clearScanGrid();
      this._updateScanProgress();
      this._updateScanInstruction();
    };
    this._scanFinishBtn.onclick = () => this._finishScan();
    this._scanBackBtn.onclick = () => this._closeScan();
    const netBackBtn = document.getElementById('scan-net-back-btn');
    if (netBackBtn) netBackBtn.onclick = () => this._closeScan();
    document.getElementById('scan-cancel-btn').onclick = () => this._closeScan();
    document.getElementById('scan-import-btn').onclick = () => this._importScan();
  }

  async _openCamera() {
    this._scanStream = await startCamera(this._scanVideo);
    if (!this._scanStream) {
      this._scanInstructions.textContent = 'Camera access denied. Please allow camera permissions.';
      this._scanCaptureBtn.style.display = 'none';
    }
  }

  _closeCamera() {
    stopCamera(this._scanVideo);
  }

  _doCapture() {
    const grid = captureFace(this._scanVideo);
    this._scanFaces[this._scanCurrentFace] = grid;
    this._showCapturedColors(grid);
    this._scanInstructions.style.display = 'none';
    this._scanCaptureBtn.style.display = 'none';
    this._scanRetryBtn.style.display = '';
    this._scanContinueBtn.style.display = '';
    this._updateScanProgress();
    if (this._scanCurrentFace >= 5) {
      this._scanContinueBtn.style.display = 'none';
      this._scanFinishBtn.style.display = '';
    }
  }

  _showCapturedColors(grid) {
    const cells = document.querySelectorAll('#scan-face-guide .scan-grid-cell');
    const COLORS = ['#f0f0f0','#FFD700','#4CAF50','#2196F3','#FF9800','#F44336'];
    const COLOR_NAMES = ['White','Yellow','Green','Blue','Orange','Red'];
    cells.forEach((cell, i) => {
      if (i < 9 && grid[i] !== undefined) {
        cell.style.background = COLORS[grid[i]];
        cell.style.border = '2px solid rgba(255,255,255,0.7)';
        cell.style.opacity = '0.85';
      }
    });
    const centerIdx = 4;
    const centerColor = grid[centerIdx];
    const expectedFace = this._scanCurrentFace;
    const centerMatch = centerColor === expectedFace;
    const el = document.getElementById('scan-center-color');
    if (el) {
      el.style.display = 'flex';
      if (centerMatch) {
        el.style.color = '#6BCB77';
        el.innerHTML = '<span class="swatch" style="background:' + COLORS[centerColor] + '"></span> ' +
          '✅ ' + COLOR_NAMES[centerColor] + ' — correct!';
      } else {
        el.style.color = '#FF6B6B';
        el.innerHTML = '<span class="swatch" style="background:' + COLORS[centerColor] + '"></span> ' +
          '❌ Expected ' + COLOR_NAMES[expectedFace] + ' center, got ' + COLOR_NAMES[centerColor] + ' — tap Retry';
      }
    }
    if (!centerMatch) {
      this._scanContinueBtn.style.display = 'none';
      this._scanFinishBtn.style.display = 'none';
      this._scanRetryBtn.style.display = '';
    }
  }

  _clearScanGrid() {
    const cells = document.querySelectorAll('#scan-face-guide .scan-grid-cell');
    cells.forEach((cell) => {
      cell.style.background = '';
      cell.style.border = '';
      cell.style.opacity = '';
    });
  }

  _finishScan() {
    const capturedFaces = this._scanFaces.filter(f => f !== undefined && f !== null).length;
    if (capturedFaces < 4) {
      alert('Please scan at least 4 faces before finishing. You scanned ' + capturedFaces + ' of 6.');
      return;
    }
    this._closeCamera();
    const fullGrid = new Array(54);
    for (let face = 0; face < 6; face++) {
      if (this._scanFaces[face]) {
        for (let i = 0; i < 9; i++) {
          fullGrid[face * 9 + i] = this._scanFaces[face][i];
        }
      } else {
        for (let i = 0; i < 9; i++) {
          fullGrid[face * 9 + i] = (face + i) % 6;
        }
      }
    }
    const balanced = balanceColors(fullGrid);
    // Rotate B face 180° (upside-down from camera)
    const B = balanced.slice(27, 36);
    balanced[27] = B[8]; balanced[28] = B[7]; balanced[29] = B[6];
    balanced[30] = B[5]; balanced[31] = B[4]; balanced[32] = B[3];
    balanced[33] = B[2]; balanced[34] = B[1]; balanced[35] = B[0];

    // Show net preview for review
    this._scanTitle.textContent = 'Check & save!';
    this._scanNetPreview.style.display = 'flex';
    this._scanCameraContainer.style.display = 'none';
    this._scanInstructions.style.display = 'none';
    this._scanProgress.style.display = 'none';
    if (this._scanActions) this._scanActions.style.display = 'none';

    renderNetPreview(balanced, 'scan-net-grid', (updatedGrid) => {
      this._scanFinalGrid = updatedGrid;
    });
    this._scanFinalGrid = balanced;

    // Hide the original Import button, show save-to-slot + load buttons
    const importBtn = document.getElementById('scan-import-btn');
    const cancelBtn = document.getElementById('scan-cancel-btn');
    if (importBtn) importBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.textContent = 'Discard';

    // Add slot save/load buttons inside the net preview
    const netPreview = document.getElementById('scan-net-preview');
    let scanSlotRow = document.getElementById('scan-slot-row');
    if (!scanSlotRow) {
      scanSlotRow = document.createElement('div');
      scanSlotRow.id = 'scan-slot-row';
      scanSlotRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap;';
      netPreview.appendChild(scanSlotRow);
    }
    scanSlotRow.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const slotBtn = document.createElement('button');
      const label = this._snapshots[i] ? this._snapshots[i].name : `Slot ${i+1}`;
      slotBtn.textContent = `💾 Save to ${label}`;
      slotBtn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid var(--border-card);background:var(--bg-card);color:var(--text-main);font-size:13px;font-weight:600;cursor:pointer;touch-action:manipulation;';
      slotBtn.onclick = () => {
        this._snapshots[i] = {
          name: `Scan ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,
          state: [...this._scanFinalGrid],
          moves: 0,
        };
        this._renderSnapshotSlots();
        this._saveSnapshotsToStorage();
        // Prompt to load
        if (confirm(`Saved to ${this._snapshots[i].name}. Load it now?`)) {
          this._loadSnapshot(i);
          this._closeScan();
        }
      };
      scanSlotRow.appendChild(slotBtn);
    }
  }

  _importScan() {
    this.cube = new RubiksCube();
    this.cube.state = this._scanFinalGrid || this._scanFaces.flat();
    this._history = [];
    this.moves = 0;
    this._closeScan();
    this.solvedBadge.style.display = 'none';
    this._enterPlay();
  }

  _closeScan() {
    this._closeCamera();
    this._scanNetPreview.style.display = 'none';
    this._scanCameraContainer.style.display = '';
    this._scanInstructions.style.display = '';
    this._scanProgress.style.display = '';
    if (this._scanActions) this._scanActions.style.display = '';
    document.getElementById('scan-overlay').style.display = 'none';
  }

  // ==================== LOCAL STORAGE ====================

  _saveToLocalStorage() {
    try {
      localStorage.setItem('cubebuddy_state', JSON.stringify(this.cube._state));
      localStorage.setItem('cubebuddy_moves', String(this.moves));
    } catch (e) {
      // localStorage might be full or unavailable, silently ignore
    }
  }

  _loadFromLocalStorage() {
    try {
      const stateStr = localStorage.getItem('cubebuddy_state');
      const movesStr = localStorage.getItem('cubebuddy_moves');
      if (stateStr) {
        const state = JSON.parse(stateStr);
        if (Array.isArray(state) && state.length === 54) {
          this.cube._state = [...state];
          this.moves = movesStr ? parseInt(movesStr) || 0 : 0;
          return true;
        }
      }
    } catch (e) {
      // Ignore parse errors — just start fresh
    }
    return false;
  }

  _loadSnapshotsFromStorage() {
    try {
      const data = localStorage.getItem('cubebuddy_snapshots');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this._snapshots = parsed.slice(0, 3);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  _saveSnapshotsToStorage() {
    try {
      localStorage.setItem('cubebuddy_snapshots', JSON.stringify(this._snapshots));
    } catch (e) {
      // Ignore
    }
  }
}

// Start app — use direct creation so it works even if DOMContentLoaded already fired
let app;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { app = new CubeBuddyApp(); });
} else {
  app = new CubeBuddyApp();
}
