// Cube Buddy - Rubik's Cube Model
// Face indices: 0=Up(white), 1=Down(yellow), 2=Front(green),
//               3=Back(blue), 4=Left(orange), 5=Right(red)
// Version: 2.11.3

const FACE_COLORS = [
  '#FAFAFA', // Up - White (brighter)
  '#FFD500', // Down - Yellow (more golden, distinct from orange)
  '#4CAF50', // Front - Green
  '#2196F3', // Back - Blue
  '#FF6600', // Left - Orange
  '#F44336', // Right - Red
];

const FACE_LETTERS = ['U', 'D', 'F', 'B', 'L', 'R'];
const FACE_COLORS_HEX = [0xffffff, 0xffd500, 0x4caf50, 0x2196f3, 0xff6600, 0xf44336];
const FACE_COLORS_RGB = {
  '#FAFAFA': { r: 0.98, g: 0.98, b: 0.98 },
  '#FFD500': { r: 1.0, g: 0.84, b: 0.0 },
  '#4CAF50': { r: 0.3, g: 0.69, b: 0.31 },
  '#2196F3': { r: 0.13, g: 0.59, b: 0.95 },
  '#FF6600': { r: 1.0, g: 0.4, b: 0.0 },
  '#F44336': { r: 0.96, g: 0.26, b: 0.21 },
};

class RubiksCube {
  constructor() {
    this._state = this._solvedState();
  }

  _solvedState() {
    const state = new Array(54);
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < 9; i++) {
        state[face * 9 + i] = face;
      }
    }
    return state;
  }

  get state() {
    return [...this._state];
  }

  set state(s) {
    this._state = [...s];
  }

  get isSolved() {
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < 9; i++) {
        if (this._state[face * 9 + i] !== face) return false;
      }
    }
    return true;
  }

  getFaceletColor(face, row, col) {
    return this._state[face * 9 + row * 3 + col];
  }

  _rotateFaceCW(face) {
    const offset = face * 9;
    const old = [...this._state];
    this._state[offset + 0] = old[offset + 6];
    this._state[offset + 1] = old[offset + 3];
    this._state[offset + 2] = old[offset + 0];
    this._state[offset + 3] = old[offset + 7];
    this._state[offset + 4] = old[offset + 4];
    this._state[offset + 5] = old[offset + 1];
    this._state[offset + 6] = old[offset + 8];
    this._state[offset + 7] = old[offset + 5];
    this._state[offset + 8] = old[offset + 2];
  }

  // === VERIFIED TURN FUNCTIONS (v2.6.2) ===
  // U CW: F row2 → R col2 reversed → B row2 → L col2 reversed → F row2
  turnU() {
    this._rotateFaceCW(0);
    const s = [...this._state];
    this._state[45]=s[27]; this._state[46]=s[28]; this._state[47]=s[29];
    this._state[18]=s[45]; this._state[19]=s[46]; this._state[20]=s[47];
    this._state[36]=s[18]; this._state[37]=s[19]; this._state[38]=s[20];
    this._state[27]=s[36]; this._state[28]=s[37]; this._state[29]=s[38];
  }

  turnUprime() { for (let i = 0; i < 3; i++) this.turnU(); }

  // D CW: F row0 → L col2 → B row0 → R col0 → F row0
  turnD() {
    this._rotateFaceCW(1);
    const s = [...this._state];
    this._state[51]=s[24]; this._state[52]=s[25]; this._state[53]=s[26];
    this._state[33]=s[51]; this._state[34]=s[52]; this._state[35]=s[53];
    this._state[42]=s[33]; this._state[43]=s[34]; this._state[44]=s[35];
    this._state[24]=s[42]; this._state[25]=s[43]; this._state[26]=s[44];
  }

  turnDprime() { for (let i = 0; i < 3; i++) this.turnD(); }

  // F CW: U row2 (reversed) → R col0 → D row0 (reversed) → L col2 → U row2
  turnF() {
    this._rotateFaceCW(2);
    const s = [...this._state];
    this._state[45]=s[6];  this._state[48]=s[7];  this._state[51]=s[8];
    this._state[9]=s[51];  this._state[10]=s[48]; this._state[11]=s[45];
    this._state[38]=s[9];  this._state[41]=s[10]; this._state[44]=s[11];
    this._state[6]=s[44];  this._state[7]=s[41];  this._state[8]=s[38];
  }

  turnFprime() { for (let i = 0; i < 3; i++) this.turnF(); }

  // B CW: U row0 → L col0 → D row2 → R col2 → U row0 (all reversed for perpendicular axes)
  turnB() {
    this._rotateFaceCW(3);
    const s = [...this._state];
    this._state[42]=s[0]; this._state[39]=s[1]; this._state[36]=s[2];
    this._state[15]=s[36]; this._state[16]=s[39]; this._state[17]=s[42];
    this._state[53]=s[15]; this._state[50]=s[16]; this._state[47]=s[17];
    this._state[2]=s[53];  this._state[1]=s[50];  this._state[0]=s[47];
  }

  turnBprime() { for (let i = 0; i < 3; i++) this.turnB(); }

  // L CW: U col0 → F col0 → D col0 → B col2 → U col0
  turnL() {
    this._rotateFaceCW(4);
    const s = [...this._state];
    this._state[18]=s[0];  this._state[21]=s[3];  this._state[24]=s[6];
    this._state[9]=s[18];  this._state[12]=s[21]; this._state[15]=s[24];
    this._state[35]=s[9];  this._state[32]=s[12]; this._state[29]=s[15];
    this._state[0]=s[35];  this._state[3]=s[32];  this._state[6]=s[29];
  }

  turnLprime() { for (let i = 0; i < 3; i++) this.turnL(); }

  // R CW: U col2 → B col0 → D col2 → F col2 → U col2
  turnR() {
    this._rotateFaceCW(5);
    const s = [...this._state];
    this._state[2]=s[20];  this._state[5]=s[23];  this._state[8]=s[26];
    this._state[33]=s[2];  this._state[30]=s[5];  this._state[27]=s[8];
    this._state[11]=s[33]; this._state[14]=s[30]; this._state[17]=s[27];
    this._state[20]=s[11]; this._state[23]=s[14]; this._state[26]=s[17];
  }

  turnRprime() { for (let i = 0; i < 3; i++) this.turnR(); }

  // E slice — Horizontal swipes on F/L/B/R middle row (BLCR S)
  // LEFT swipe: 30→48→21→39→30, 31→49→22→40→31, 32→50→23→41→32
  // RIGHT swipe: 30→39→21→48→30, 31→40→22→49→31, 32→41→23→50→32
  turnECW() {
    const s = [...this._state];
    // LEFT swipe: 30→48→21→39→30, 31→49→22→40→31, 32→50→23→41→32
    this._state[48]=s[30]; this._state[21]=s[48];
    this._state[39]=s[21]; this._state[30]=s[39];
    this._state[49]=s[31]; this._state[22]=s[49];
    this._state[40]=s[22]; this._state[31]=s[40];
    this._state[50]=s[32]; this._state[23]=s[50];
    this._state[41]=s[23]; this._state[32]=s[41];
  }

  turnECCW() {
    const s = [...this._state];
    // RIGHT swipe: 30→39→21→48→30, 31→40→22→49→31, 32→41→23→50→32
    this._state[39]=s[30]; this._state[21]=s[39];
    this._state[48]=s[21]; this._state[30]=s[48];
    this._state[40]=s[31]; this._state[22]=s[40];
    this._state[49]=s[22]; this._state[31]=s[49];
    this._state[41]=s[32]; this._state[23]=s[41];
    this._state[50]=s[23]; this._state[32]=s[50];
  }

  // M CW: U col1 → F col1 → D col1 → B col1 reversed → U col1
  // U[1,7], F[19,25], D[10,16], B[28,34]
  // Centers: U(4)→F(22)→D(13)→B(31)→U(4)
  turnMCW() {
    const s = [...this._state];
    this._state[19]=s[1];  this._state[25]=s[7];
    this._state[10]=s[19]; this._state[16]=s[25];
    this._state[34]=s[10]; this._state[28]=s[16];
    this._state[1]=s[34];  this._state[7]=s[28];
    // Centers float with the slice
    this._state[22]=s[4];  // F center ← old U center
    this._state[13]=s[22]; // D center ← old F center
    this._state[31]=s[13]; // B center ← old D center
    this._state[4]=s[31];  // U center ← old B center
  }

  // M CCW: reverse — 1←19←10←34←1, 7←25←16←28←7
  // Centers: U(4)←F(22)←D(13)←B(31)←U(4)
  turnMCCW() {
    const s = [...this._state];
    this._state[1]=s[19];  this._state[19]=s[10];
    this._state[10]=s[34]; this._state[34]=s[1];
    this._state[7]=s[25];  this._state[25]=s[16];
    this._state[16]=s[28]; this._state[28]=s[7];
    // Centers float with the slice (reverse)
    this._state[4]=s[22];  // U center ← old F center
    this._state[22]=s[13]; // F center ← old D center
    this._state[13]=s[31]; // D center ← old B center
    this._state[31]=s[4];  // B center ← old U center
  }

  // S slice — Horizontal swipes on U/D middle row (also L M↓ / R M↑)
  // LEFT swipe: 3→43→14→46→3, 4→40→13→49→4, 5→37→12→52→5
  // RIGHT swipe: 3→46→14→43→3, 4→49→13→40→4, 5→52→12→37→5
  turnSCW() {
    const s = [...this._state];
    // LEFT swipe: 3→43→14→46→3, 4→40→13→49→4, 5→37→12→52→5
    this._state[43]=s[3];  this._state[14]=s[43];
    this._state[46]=s[14]; this._state[3]=s[46];
    this._state[40]=s[4];  this._state[13]=s[40];
    this._state[49]=s[13]; this._state[4]=s[49];
    this._state[37]=s[5];  this._state[12]=s[37];
    this._state[52]=s[12]; this._state[5]=s[52];
  }

  turnSCCW() {
    const s = [...this._state];
    // RIGHT swipe: 3→46→14→43→3, 4→49→13→40→4, 5→52→12→37→5
    this._state[46]=s[3];  this._state[14]=s[46];
    this._state[43]=s[14]; this._state[3]=s[43];
    this._state[49]=s[4];  this._state[13]=s[49];
    this._state[40]=s[13]; this._state[4]=s[40];
    this._state[52]=s[5];  this._state[12]=s[52];
    this._state[37]=s[12]; this._state[5]=s[37];
  }

  // === HIGH-LEVEL MOVE ===
  doMove(move) {
    const m = move.toUpperCase().replace("'","");
    const prime = move.includes("'");
    const n = prime ? 3 : 1;

    // Slice moves
    // NOTE: turnECW/ECCW actually move S-ring stickers (F3,R3,B3,L3)
    //       turnSCW/SCCW actually move E-ring stickers (U3,L7,D5,R1)
    // So we call the correct function for each slice letter:
    if (m === 'E') { if (prime) { this.turnSCCW(); return; } this.turnSCW(); return; }
    if (m === 'M') { for (let i = 0; i < n; i++) this.turnMCW(); return; }
    if (m === 'S') { for (let i = 0; i < n; i++) this.turnECW(); return; }

    // Face moves via turnFace
    this.turnFace(move);
  }

  reset() {
    this._state = this._solvedState();
  }

  turnFace(move) {
    switch (move.toUpperCase()) {
      case 'U': this.turnU(); break;
      case "U'": this.turnUprime(); break;
      case 'D': this.turnD(); break;
      case "D'": this.turnDprime(); break;
      case 'F': this.turnF(); break;
      case "F'": this.turnFprime(); break;
      case 'B': this.turnB(); break;
      case "B'": this.turnBprime(); break;
      case 'L': this.turnL(); break;
      case "L'": this.turnLprime(); break;
      case 'R': this.turnR(); break;
      case "R'": this.turnRprime(); break;
    }
  }

  scramble(moves = 12) {
    const movesList = ['U', "U'", 'D', "D'", 'F', "F'", 'B', "B'", 'L', "L'", 'R', "R'"];
    let lastMove = '';
    let lastAxis = '';
    const axes = { 'U':'y', 'D':'y', 'F':'z', 'B':'z', 'L':'x', 'R':'x' };
    for (let i = 0; i < moves; i++) {
      let move;
      let attempts = 0;
      do {
        move = movesList[Math.floor(Math.random() * movesList.length)];
        attempts++;
        // Prevent: same face (U then U'), same axis (U then D), keep trying
        const badSameFace = lastMove && move[0] === lastMove[0];
        const badSameAxis = lastAxis && axes[move[0]] === lastAxis;
        if (!badSameFace && !badSameAxis) break;
      } while (attempts < 50);
      this.doMove(move);
      lastMove = move;
      lastAxis = axes[move[0]];
    }
  }
}

window.RubiksCube = RubiksCube;
window.FACE_COLORS = FACE_COLORS;
window.FACE_LETTERS = FACE_LETTERS;
window.FACE_COLORS_HEX = FACE_COLORS_HEX;
window.FACE_COLORS_RGB = FACE_COLORS_RGB;
