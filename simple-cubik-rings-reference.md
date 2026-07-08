# Simple Cubik — Complete Ring Definition Reference
## Date: July 8, 2026
## Coordinate System: Foo (x,y) where (0,0) = bottom-left, (2,2) = top-right of each face
## Author: Kok Sing Ng

---

## Convention

- **Tap center button**: Tap = CW turn, Double tap = CCW turn
- **Swipe forward along ring** (ring0→ring1→ring2→...): 1-4 cells distance = direction per table below
- **Swipe reverse** (...→ring2→ring1→ring0): 1-4 cells distance = opposite direction
- "Start from any cell in the ring group, end at any 1, 2, 3, or 4 cells after the start cell"

---

## 1. U-ring (turns U face)

| Property | Value |
|----------|-------|
| **Stickers** | F0, F1, F2, R0, R1, R2, B0, B1, B2, L0, L1, L2 |
| **Ring IDs** | U-ring0(F0), U-ring1(F1), U-ring2(F2), U-ring3(R0), U-ring4(R1), U-ring5(R2), U-ring6(B0), U-ring7(B1), U-ring8(B2), U-ring9(L0), U-ring10(L1), U-ring11(L2) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **U CCW** |
| Reverse | ring12→ring11→...→ring0 | **U CW** |

---

## 2. D-ring (turns D face)

| Property | Value |
|----------|-------|
| **Stickers** | F6, F7, F8, R6, R7, R8, B6, B7, B8, L6, L7, L8 |
| **Ring IDs** | D-ring0(F6), D-ring1(F7), D-ring2(F8), D-ring3(R6), D-ring4(R7), D-ring5(R8), D-ring6(B6), D-ring7(B7), D-ring8(B8), D-ring9(L6), D-ring10(L7), D-ring11(L8) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **D CW** |
| Reverse | ring12→ring11→...→ring0 | **D CCW** |

---

## 3. L-ring (turns L face)

| Property | Value |
|----------|-------|
| **Stickers** | F0, F3, F6, D0, D3, D6, B8, B5, B2, U0, U3, U6 |
| **Ring IDs** | L-ring0(F0), L-ring1(F3), L-ring2(F6), L-ring3(D0), L-ring4(D3), L-ring5(D6), L-ring6(B8), L-ring7(B5), L-ring8(B2), L-ring9(U0), L-ring10(U3), L-ring11(U6) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **L CW** |
| Reverse | ring12→ring11→...→ring0 | **L CCW** |

---

## 4. R-ring (turns R face)

| Property | Value |
|----------|-------|
| **Stickers** | F2, F5, F8, D2, D5, D8, B6, B3, B0, U2, U5, U8 |
| **Ring IDs** | R-ring0(F2), R-ring1(F5), R-ring2(F8), R-ring3(D2), R-ring4(D5), R-ring5(D8), R-ring6(B6), R-ring7(B3), R-ring8(B0), R-ring9(U2), R-ring10(U5), R-ring11(U8) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **R CCW** |
| Reverse | ring12→ring11→...→ring0 | **R CW** |

---

## 5. F-ring (turns F face)

| Property | Value |
|----------|-------|
| **Stickers** | L2, L5, L8, D0, D1, D2, R6, R3, R0, U8, U7, U6 |
| **Ring IDs** | F-ring0(L2), F-ring1(L5), F-ring2(L8), F-ring3(D0), F-ring4(D1), F-ring5(D2), F-ring6(R6), F-ring7(R3), F-ring8(R0), F-ring9(U8), F-ring10(U7), F-ring11(U6) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **F CCW** |
| Reverse | ring12→ring11→...→ring0 | **F CW** |

---

## 6. B-ring (turns B face)

| Property | Value |
|----------|-------|
| **Stickers** | R2, R5, R8, D8, D7, D6, L6, L3, L0, U0, U1, U2 |
| **Ring IDs** | B-ring0(R2), B-ring1(R5), B-ring2(R8), B-ring3(D8), B-ring4(D7), B-ring5(D6), B-ring6(L6), B-ring7(L3), B-ring8(L0), B-ring9(U0), B-ring10(U1), B-ring11(U2) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **B CCW** |
| Reverse | ring12→ring11→...→ring0 | **B CW** |

---

## 7. S-ring (middle standing slice — between F and B)

| Property | Value |
|----------|-------|
| **Stickers** | F3, F4, F5, R3, R4, R5, B3, B4, B5, L3, L4, L5 |
| **Ring IDs** | S-ring0(F3), S-ring1(F4), S-ring2(F5), S-ring3(R3), S-ring4(R4), S-ring5(R5), S-ring6(B3), S-ring7(B4), S-ring8(B5), S-ring9(L3), S-ring10(L4), S-ring11(L5) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **S CCW** |
| Reverse | ring12→ring11→...→ring0 | **S CW** |

---

## 8. M-ring (middle vertical slice — between L and R)

| Property | Value |
|----------|-------|
| **Stickers** | F1, F4, F7, D1, D4, D7, B7, B4, B1, U7, U4, U1 |
| **Ring IDs** | M-ring0(F1), M-ring1(F4), M-ring2(F7), M-ring3(D1), M-ring4(D4), M-ring5(D7), M-ring6(B7), M-ring7(B4), M-ring8(B1), M-ring9(U7), M-ring10(U4), M-ring11(U1) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **M CW** |
| Reverse | ring12→ring11→...→ring0 | **M CCW** |

---

## 9. E-ring (equatorial slice — between U and D)

| Property | Value |
|----------|-------|
| **Stickers** | L1, L4, L7, D3, D4, D5, R7, R4, R1, U5, U4, U3 |
| **Ring IDs** | E-ring0(L1), E-ring1(L4), E-ring2(L7), E-ring3(D3), E-ring4(D4), E-ring5(D5), E-ring6(R7), E-ring7(R4), E-ring8(R1), E-ring9(U5), E-ring10(U4), E-ring11(U3) |

| Swipe | Direction | Result |
|-------|-----------|--------|
| Forward | ring0→ring1→...→ring12 | **E CW** |
| Reverse | ring12→ring11→...→ring0 | **E CCW** |

---

## Summary Table

| # | Ring | Stickers | Forward | Reverse |
|---|------|----------|---------|---------|
| 1 | **U-ring** | F0,F1,F2, R0,R1,R2, B0,B1,B2, L0,L1,L2 | U CCW | U CW |
| 2 | **D-ring** | F6,F7,F8, R6,R7,R8, B6,B7,B8, L6,L7,L8 | D CW | D CCW |
| 3 | **L-ring** | F0,F3,F6, D0,D3,D6, B8,B5,B2, U0,U3,U6 | L CW | L CCW |
| 4 | **R-ring** | F2,F5,F8, D2,D5,D8, B6,B3,B0, U2,U5,U8 | R CCW | R CW |
| 5 | **F-ring** | L2,L5,L8, D0,D1,D2, R6,R3,R0, U8,U7,U6 | F CCW | F CW |
| 6 | **B-ring** | R2,R5,R8, D8,D7,D6, L6,L3,L0, U0,U1,U2 | B CCW | B CW |
| 7 | **S-ring** | F3,F4,F5, R3,R4,R5, B3,B4,B5, L3,L4,L5 | S CCW | S CW |
| 8 | **M-ring** | F1,F4,F7, D1,D4,D7, B7,B4,B1, U7,U4,U1 | M CW | M CCW |
| 9 | **E-ring** | L1,L4,L7, D3,D4,D5, R7,R4,R1, U5,U4,U3 | E CW | E CCW |
