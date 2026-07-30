// Cube Ring System - Ring constants and swipe detection
// Module:    RingSystem
// Version:   1.0.0
// API:       CubeRingSystem.RING_STICKERS, CubeRingSystem.resolveRingSwipe()
//            resolveRingSwipe(startFaceIdx, startRow, startCol, endFaceIdx, endRow, endCol)
// Depends:   None (pure JS)
// Changelog:
//   1.0.0 - Initial modular version. Extracted from cube-3d-view.js v2.11.4.
//           Contains RING_STICKERS, RING_FORWARD_IS_CW, FACE_IDX_TO_LETTER,
//           stickerId(), resolveRingSwipe()

(function() {
'use strict';

var RING_STICKERS = {
  U: ['F0','F1','F2','R0','R1','R2','B0','B1','B2','L0','L1','L2'],
  D: ['F6','F7','F8','R6','R7','R8','B6','B7','B8','L6','L7','L8'],
  L: ['F0','F3','F6','D0','D3','D6','B8','B5','B2','U0','U3','U6'],
  R: ['F2','F5','F8','D2','D5','D8','B6','B3','B0','U2','U5','U8'],
  F: ['L2','L5','L8','D0','D1','D2','R6','R3','R0','U8','U7','U6'],
  B: ['R2','R5','R8','D8','D7','D6','L6','L3','L0','U0','U1','U2'],
  S: ['F3','F4','F5','R3','R4','R5','B3','B4','B5','L3','L4','L5'],
  M: ['F1','F4','F7','D1','D4','D7','B7','B4','B1','U1','U4','U7'],
  E: ['L1','L4','L7','D3','D4','D5','R7','R4','R1','U5','U4','U3'],
};

var RING_FORWARD_IS_CW = {
  U: false, D: true,  L: true,  R: false,
  F: false, B: false, S: false, M: true,  E: true,
};

var FACE_IDX_TO_LETTER = ['U','D','F','B','L','R'];

function stickerId(faceIdx, row, col) {
  return FACE_IDX_TO_LETTER[faceIdx] + (row * 3 + col);
}

function resolveRingSwipe(startFaceIdx, startRow, startCol, endFaceIdx, endRow, endCol) {
  var startId = stickerId(startFaceIdx, startRow, startCol);
  var endId = stickerId(endFaceIdx, endRow, endCol);
  if (startId === endId) return null;

  for (var ringName in RING_STICKERS) {
    var stickers = RING_STICKERS[ringName];
    var si = stickers.indexOf(startId);
    var ei = stickers.indexOf(endId);
    if (si === -1 || ei === -1) continue;

    var len = stickers.length;
    var fwdSteps = (ei - si + len) % len;
    var bwdSteps = (si - ei + len) % len;
    var gap = Math.min(fwdSteps, bwdSteps);
    if (gap === 0 || gap > 4) return null;

    var goingForward = fwdSteps <= bwdSteps;
    var isCw = goingForward ? RING_FORWARD_IS_CW[ringName] : !RING_FORWARD_IS_CW[ringName];

    return { ring: ringName, turn: ringName, isCw: isCw, gap: gap };
  }
  return null;
}

window.CubeRingSystem = {
  RING_STICKERS: RING_STICKERS,
  RING_FORWARD_IS_CW: RING_FORWARD_IS_CW,
  FACE_IDX_TO_LETTER: FACE_IDX_TO_LETTER,
  stickerId: stickerId,
  resolveRingSwipe: resolveRingSwipe,
};

// Also expose standalone for direct call compatibility
window.resolveRingSwipe = resolveRingSwipe;

})();
