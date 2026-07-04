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
function matchColor(r, g, b, centerHue) {
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

  // === White detection ===
  const rgbDiff = max * 255 - min * 255;
  if (rgbDiff < 35 && v > 0.7) return 0; // White
  if (s < 0.25) {
    if (v > 0.5) return 0; // White
    return 0;
  }

  // === Dynamic orange/red boundary using center hue reference ===
  // If we have a center hue reference, use it to shift the orange/red split
  if (centerHue !== undefined && (h >= 10 && h < 55)) {
    // Determine the orange-red split point based on where the center landed
    // Under warm light, both orange and red shift toward higher hue
    // Center should be white (hue=0), so centerHue tells us the lighting shift
    const hueShift = centerHue; // how much the lighting shifted hues
    // Adjust the orange/red boundary: normally at 20, shift it by the lighting
    const boundary = 20 + Math.max(0, hueShift * 0.3);
    if (h >= boundary && h < 50) return 4; // Orange
    if ((h >= 10 && h < boundary) || h >= 340) return 5; // Red
    // If between 50-55, use saturation tiebreak
    if (h >= 50) return s > 0.55 ? 5 : 4;
  }

  // === Standard matching (no calibration or non-orange/red hues) ===
  // Yellow: 40-80
  if (h >= 40 && h < 80) {
    // If centerHue is warm, widen yellow detection toward green
    if (centerHue !== undefined && h >= 75) return s > 0.5 ? 1 : 2;
    return 1;
  }

  // Green: 85-170
  if (h >= 85 && h < 170) return 2; // Green

  // Blue: 185-265
  if (h >= 185 && h < 265) return 3; // Blue

  // Orange: 20-50 (without calibration)
  if (h >= 20 && h < 50) return 4; // Orange

  // Red: 0-20 or 330-360
  if ((h >= 0 && h < 20) || h >= 330) return 5; // Red

  // Fallback
  if (h >= 170 && h < 185) return 2;
  if (h >= 265 && h < 330) return 3;
  if (h >= 50 && h < 85) return 1;

  return 5;
}

/**
 * Auto white-balance a canvas region: scale RGB so bright areas approach true white.
 * This corrects for warm/cool lighting before color matching.
 */
function autoWhiteBalance(ctx, w, h) {
  // Sample the image to find the brightest pixel (assumed to be white)
  const data = ctx.getImageData(0, 0, w, h).data;
  let maxR = 0, maxG = 0, maxB = 0;
  // Use top percentile to avoid single hot pixels
  const pixels = [];
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i+1], b = data[i+2];
    pixels.push({ r, g, b, lum: r + g + b });
  }
  pixels.sort((a, b) => b.lum - a.lum);
  // Take top 2% brightest pixels
  const topCount = Math.max(3, Math.floor(pixels.length * 0.02));
  let sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < topCount; i++) {
    sumR += pixels[i].r;
    sumG += pixels[i].g;
    sumB += pixels[i].b;
  }
  maxR = sumR / topCount;
  maxG = sumG / topCount;
  maxB = sumB / topCount;

  // Scale factors — bring brightest pixel to 240 (not pure 255 to avoid overexposure)
  const target = 240;
  const scaleR = maxR > 20 ? target / maxR : 1;
  const scaleG = maxG > 20 ? target / maxG : 1;
  const scaleB = maxB > 20 ? target / maxB : 1;

  // Apply to the whole canvas
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = Math.min(255, d[i]   * scaleR);
    d[i+1] = Math.min(255, d[i+1] * scaleG);
    d[i+2] = Math.min(255, d[i+2] * scaleB);
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Sample the 3x3 grid from a canvas at given center and spacing.
 * Uses multi-point sampling (5 points per cell: center + 4 corners) with voting
 * for better accuracy against glare and lighting.
 * Returns a flat 9-element array of face indices (0-5).
 */
function sampleGrid(ctx, cx, cy, spacing, centerHue) {
  const grid = [];
  const sampleRadius = Math.max(3, Math.floor(spacing * 0.2));
  const offsets = [
    [0, 0],           // center
    [-0.4, -0.4],     // top-left
    [0.4, -0.4],      // top-right
    [-0.4, 0.4],      // bottom-left
    [0.4, 0.4],       // bottom-right
  ];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = cx + (col - 1) * spacing;
      const y = cy + (row - 1) * spacing;

      // Multi-point sampling: vote among 5 sample points (center + 4 corners)
      const votes = [];
      for (const [ox, oy] of offsets) {
        const sx = Math.round(x + ox * spacing);
        const sy = Math.round(y + oy * spacing);
        const pixelData = ctx.getImageData(
          Math.round(sx - sampleRadius/2),
          Math.round(sy - sampleRadius/2),
          sampleRadius, sampleRadius
        ).data;

        let vr = 0, vg = 0, vb = 0, vcount = 0;
        for (let i = 0; i < pixelData.length; i += 4) {
          vr += pixelData[i];
          vg += pixelData[i+1];
          vb += pixelData[i+2];
          vcount++;
        }
        if (vcount > 0) {
          vr /= vcount; vg /= vcount; vb /= vcount;
        }
        votes.push(matchColor(vr, vg, vb, centerHue));
      }

      // Pick the most common vote (mode), fallback to center if tie
      votes.sort();
      let bestFace = votes[0], bestCount = 1, current = votes[0], currentCount = 1;
      for (let v = 1; v < votes.length; v++) {
        if (votes[v] === current) {
          currentCount++;
        } else {
          if (currentCount > bestCount) {
            bestCount = currentCount;
            bestFace = current;
          }
          current = votes[v];
          currentCount = 1;
        }
      }
      if (currentCount > bestCount) bestFace = current;
      grid.push(bestFace);
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

  // Apply white balance to correct lighting before sampling
  autoWhiteBalance(ctx, w, h);

  // Capture the central region (where the 3x3 grid is)
  // Scale: assume the face occupies about 60% of the frame
  const faceSize = Math.min(w, h) * 0.45;
  const cx = w / 2;
  const cy = h / 2;
  const spacing = faceSize / 3;

  // Sample the center cell first to get its hue for calibration
  // The center should be a saturated color (the face being scanned)
  // Its hue tells us how the lighting shifted colors
  const centerPixel = ctx.getImageData(Math.round(cx), Math.round(cy), 1, 1).data;
  const cr = centerPixel[0], cg = centerPixel[1], cb = centerPixel[2];
  // Compute center hue for dynamic orange/red boundary adjustment
  const cmax = Math.max(cr, cg, cb) / 255;
  const cmin = Math.min(cr, cg, cb) / 255;
  const cdelta = cmax - cmin;
  let centerHue = undefined;
  if (cdelta > 0.01) {
    const crr = cr/255, cgg = cg/255, cbb = cb/255;
    let ch = 0;
    if (cmax === crr) ch = 60 * (((cgg - cbb) / cdelta) % 6);
    else if (cmax === cgg) ch = 60 * (((cbb - crr) / cdelta) + 2);
    else ch = 60 * (((crr - cgg) / cdelta) + 4);
    if (ch < 0) ch += 360;
    centerHue = ch;
  }

  const grid = sampleGrid(ctx, cx, cy, spacing, centerHue);
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
