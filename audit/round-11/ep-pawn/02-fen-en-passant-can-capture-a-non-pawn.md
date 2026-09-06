# A forged FEN en-passant field can capture a non-Pawn

- Severity: Medium
- Area: state construction, en-passant victim identity, forged-state robustness
- Audited state: current post-Round-10 uncommitted checkout; production and tests remained read-only

## Rule basis

En passant captures the Pawn that just made a qualifying two-square move; an arbitrary piece behind the target is never an en-passant victim. `rules.md` §13.1 extends which physical Pawns can acquire the right, but does not permit a piece with neither current nor original Pawn identity to be captured this way.

## Minimal reproduction

Construct a game through the public state factory using this syntactically accepted but semantically forged FEN:

```text
7k/8/8/8/3pR3/8/8/K7 b - e3 0 1
```

The piece behind `e3` is a White Rook on `e4`, not a Pawn. Nevertheless:

```text
createGameState(...).enPassant:
  [{ target: "e3", pawnId: "white-rook-e4" }]

positionFor(...).epSquare:
  undefined

legalDests(...).get("d4"):
  ["d3", "e3"]

applyAction(move d4-e3):
  success; capturedId = "white-rook-e4"
```

The custom en-passant path therefore overrides the stricter orthodox projection and removes the Rook from `e4` as though it were the passing Pawn.

## Unconfounded control

Replacing the Rook with a White Pawn in the otherwise identical FEN makes the same `d4-e3` action a valid en-passant capture, and both `positionFor()` and the explicit state agree on `e3`.

## Expected

The factory should not create an explicit opportunity unless the located victim has a Pawn-capable identity. At minimum, `enPassantCapture()` must not honor an opportunity whose victim has neither current nor original Pawn identity or is promoted. The invalid input may be normalized to `enPassant: []`; it must not grant a capture of a non-Pawn.

## Root hint

`createGameState()` derives `epPawn` by square alone. `enPassantCapture()` later validates target geometry and ownership but never validates the referenced victim's Pawn identity or promoted status. `setupFor()` independently detects the non-Pawn and clears only its chessops projection, causing the public APIs to disagree.
