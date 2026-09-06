# A transformed original Pawn's two-square forward move loses en passant

- Severity: Medium
- Area: transformed identity, ordinary Pawn rule, en passant
- Audited state: current post-round-8 uncommitted checkout; production and tests remained read-only

## Rule basis

`rules.md` §10 preserves both a transformed piece's original type and its current powers; effects naming the original type still apply. Section 13.1 allows any Pawn on its owner's first or second rank to make a clear two-square initial-style move and says any Pawn making that move can be captured en passant. The existing engine likewise treats an unpromoted transformed original Pawn as a Pawn for card eligibility and the halfmove clock.

Consequently, when an unpromoted original Pawn currently using Rook movement travels exactly two clear squares forward from its second owner rank, the physical move also satisfies the two-square Pawn rule and must carry its en-passant consequence.

## Reproduction

Create White to move from:

```text
7k/8/8/8/1p6/8/R7/7K w - - 0 1
```

Change only the piece on `a2` to `originalRole: "pawn", promoted: false`, retaining its current `role: "rook"`. Apply:

```ts
move a2-a4
endTurn
move b4-a3
```

Direct-engine output after `a2-a4`:

```text
move: ok
piece: role "rook", originalRole "pawn", promoted false
halfmove: 0
enPassant: []
fen ep field: -
```

After `endTurn`, `legalDests(b4)` contains only `b3`; direct `b4-a3` returns `ILLEGAL_MOVE`.

## Expected

The original Pawn identity should create `{ target: "a3", pawnId: <moved id> }`, and the adjacent Black Pawn should be able to capture it en passant on the immediate reply. A promoted original Pawn should remain excluded.

## Actual and impact

The move correctly resets the halfmove clock from Pawn identity, but drops the en-passant right because the current movement role is Rook. Legal consequences of the same physical piece therefore disagree about whether it is still a Pawn.

The same omission applies to another current role whose legal move can coincide with a clear two-square forward Pawn move, and at rotated orientations.

## Likely root

The ordinary-move branch creates an opportunity only under `moving.role === 'pawn'`. Unlike `resetsHalfmoveClock()`, it does not recognize `moving.originalRole === 'pawn' && !moving.promoted` before applying `doubleStepEnPassant()` to the actual displacement.
