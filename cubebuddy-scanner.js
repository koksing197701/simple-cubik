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
