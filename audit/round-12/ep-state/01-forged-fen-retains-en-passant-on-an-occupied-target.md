# Forged FEN retains en passant on an occupied target

- Severity: Medium
- Area: state construction, orthodox projection, en-passant identity
- Audited state: current shared checkout after Round 11; production and tests remained read-only

## Rule basis

En passant lands on the empty square crossed by the Pawn and captures that specific Pawn from the adjacent square. `rules.md` §13.1 preserves ordinary en-passant timing and geometry. An occupied target therefore cannot simultaneously be a live en-passant target.

The state factory already normalizes a forged FEN whose alleged victim is not Pawn-capable. The same boundary should reject an occupied target instead of publishing mutually contradictory board and opportunity state.

## Minimal reproduction

Construct through the public factory:

```ts
const state = createGameState({
  fen: '7k/8/8/8/3pP3/4N3/8/K7 b - e3 0 1',
});
```

This position has the alleged White en-passant victim on `e4`, but a White Knight already occupies `e3`. Direct inspection gives:

```text
state.enPassant: [{ target: "e3", pawnId: "white-pawn-e4" }]
state.fen EP field: e3
positionFor(state).epSquare: e3
legalDests(state).get("d4"): ["d3", "e3"]
```

Applying `d4-e3` succeeds as an ordinary capture:

```text
capturedId: white-knight-e3
white-pawn-e4 zone: board
```

The move result is locally sensible for the occupied board, but it contradicts the simultaneously advertised opportunity naming `white-pawn-e4` as the victim.

## Controls

- Removing the Knight from `e3` makes the otherwise identical FEN a valid en-passant position; `d4-e3` then captures `white-pawn-e4`.
- Keeping the Knight but changing the FEN field to `-` correctly describes `d4-e3` as only an ordinary Knight capture.
- The focused 51-test en-passant regression set passed, so this is isolated to the still-unchecked semantic FEN boundary rather than a regression in normal generated play.

## Expected

`createGameState()` must normalize the FEN en-passant field to `-` and produce `enPassant: []` when the target square is occupied. `positionFor()` should likewise never project an explicit opportunity onto an occupied target.

## Root hint

`createGameState()` validates the inferred victim square, opposing owner, and Pawn-capable identity but never checks whether `setup.epSquare` itself is empty. `setupFor()` checks the victim and the old source square but has the same missing `board.has(setup.epSquare)` guard.

