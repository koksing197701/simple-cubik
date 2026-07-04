/* ============================================================
   CubeBuddy — Camera Scanner Module  v2.2.0
   Uses k-means clustering for lighting-adaptive color detection.
   ============================================================ */

/** Face order: U(0), D(1), F(2), B(3), L(4), R(5) */
const FACE_LABELS = ['U','D','F','B','L','R'];
const FACE_NAMES = ['WHITE','YELLOW','GREEN','BLUE','ORANGE','RED'];
const FACE_EMOJIS = ['⬜','🟨','🟩','🟦','🟧','🟥'];

/** Reference RGB centroids for standard Rubik's cube colors (for initialization) */
const REFERENCE_COLORS = [
  [220, 220, 220], // 0: White
  [255, 200, 0],   // 1: Yellow
  [0, 180, 0],     // 2: Green
  [0, 80, 255],    // 3: Blue
  [255, 120, 0],   // 4: Orange
  [200, 0, 0],     // 5: Red
];

/**
 * Euclidean distance squared between two RGB colors (for performance).
 */
function colorDistSq(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr*dr + dg*dg + db*db;
}

/**
 * Assign each pixel to the nearest centroid.
 * Returns an array of cluster indices.
 */
function assignClusters(pixels, centroids) {
  return pixels.map(p => {
    let best = 0, bestDist = colorDistSq(p, centroids[0]);
    for (let k = 1; k < centroids.length; k++) {
      const d = colorDistSq(p, centroids[k]);
      if (d < bestDist) { bestDist = d; best = k; }
    }
    return best;
  });
}

/**
 * Recompute centroids as the mean of all pixels assigned to each cluster.
 * Returns new centroids. If a cluster gets 0 pixels, keep its old centroid.
 */
function recomputeCentroids(pixels, assignments, k, oldCentroids) {
  const sums = Array.from({length: k}, () => [0, 0, 0]);
  const counts = new Array(k).fill(0);
  for (let i = 0; i < pixels.length; i++) {
    const c = assignments[i];
    sums[c][0] += pixels[i][0];
    sums[c][1] += pixels[i][1];
    sums[c][2] += pixels[i][2];
    counts[c]++;
  }
  const newCentroids = [];
  for (let c = 0; c < k; c++) {
    if (counts[c] > 0) {
      newCentroids.push([
        Math.round(sums[c][0] / counts[c]),
        Math.round(sums[c][1] / counts[c]),
        Math.round(sums[c][2] / counts[c]),
      ]);
    } else {
      newCentroids.push([...oldCentroids[c]]); // keep old
    }
  }
  return newCentroids;
}

/**
 * Run k-means clustering for up to maxIter iterations.
 * Stops early when assignments stabilize.
 */
function kMeans(pixels, k, initialCentroids, maxIter = 20) {
  let centroids = initialCentroids.map(c => [...c]);
  let prevAssignments = null;
  for (let iter = 0; iter < maxIter; iter++) {
    const assignments = assignClusters(pixels, centroids);
    if (prevAssignments && assignments.every((a, i) => a === prevAssignments[i])) {
      break; // converged
    }
    centroids = recomputeCentroids(pixels, assignments, k, centroids);
    prevAssignments = assignments;
  }
  return centroids;
}

/**
 * Detect colors using k-means clustering.
 * Takes raw pixel samples (one per sticker cell, averaged RGB).
 * Returns a 9-element array of face indices (0-5).
 *
 * How it works:
 * 1. Collect all 9 sticker RGB samples
 * 2. Run k-means with k=6 to find the 6 color clusters
 * 3. Match each cluster to a face color by comparing centroids to reference colors
 * 4. Assign each sticker cell to the face color of its nearest cluster
 */
function detectColors(stickerSamples) {
  // Run k-means with 6 clusters using reference colors as initialization
  const centroids = kMeans(stickerSamples, 6, REFERENCE_COLORS);

  // Compute hue and saturation for each centroid
  function rgbToHueSat(rgb) {
    const r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    const sat = max > 0.01 ? (max - min) / max : 0;
    if (delta < 0.01) return { h: -1, s: sat };
    let h = 0;
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
    if (h < 0) h += 360;
    return { h, s: sat };
  }

  const info = centroids.map(c => ({ c, ...rgbToHueSat(c) }));

  // Find white cluster (lowest saturation)
  let whiteIdx = 0;
  let minSat = Infinity;
  for (let i = 0; i < 6; i++) {
    if (info[i].s < minSat) { minSat = info[i].s; whiteIdx = i; }
  }

  // Remaining 5 clusters sorted by hue
  const colored = [0,1,2,3,4,5].filter(i => i !== whiteIdx)
    .sort((a, b) => info[a].h - info[b].h);

  // The 5 colored clusters in hue order map to [Red, Orange, Yellow, Green, Blue]
  // but we need to handle red's wrap-around (near 0° and 360°).
  // Check if the lowest-hue cluster is red (hue < 30) or orange (hue 20-50)
  const faceOrder = [5, 4, 1, 2, 3]; // Red, Orange, Yellow, Green, Blue

  // Build cluster-to-face mapping
  const clusterToFace = new Array(6);
  clusterToFace[whiteIdx] = 0; // White

  for (let i = 0; i < 5; i++) {
    clusterToFace[colored[i]] = faceOrder[i];
  }

  // Assign each sticker to its cluster's face color
  const assignments = assignClusters(stickerSamples, centroids);
  return assignments.map(c => clusterToFace[c]);
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
 * Returns an array of 9 raw RGB samples (each as [r,g,b]).
 * These are passed to detectColors() for k-means clustering.
 */
function sampleGrid(ctx, cx, cy, spacing) {
  const samples = [];
  const sampleRadius = Math.max(3, Math.floor(spacing * 0.2));

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = cx + (col - 1) * spacing;
      const y = cy + (row - 1) * spacing;

      // Average a small region at the cell center
      const pixelData = ctx.getImageData(
        Math.round(x - sampleRadius/2),
        Math.round(y - sampleRadius/2),
        sampleRadius, sampleRadius
      ).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < pixelData.length; i += 4) {
        r += pixelData[i];
        g += pixelData[i+1];
        b += pixelData[i+2];
        count++;
      }
      if (count > 0) {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
      }
      samples.push([r, g, b]);
    }
  }
  return samples;
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

  // Get raw RGB samples for all 9 sticker cells
  const samples = sampleGrid(ctx, cx, cy, spacing);
  // Use k-means clustering to detect colors adaptively
  const grid = detectColors(samples);
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
