# A transformed original Pawn's regular move does not reset the halfmove clock

- Severity: Medium
- Area: transformations, ordinary moves, draw clock
- Audited commit: `2f0e4082eb991d8efbffe374100439ba4ad675e2`

## Rule basis

`rules.md` §10 preserves a transformed piece's original type in addition to its current powers. The concrete clock rulings in §13.9 and §13.10 consequently reset the halfmove clock when an unpromoted original Pawn moves even while using non-Pawn card geometry. Section 23 makes the Pawn/capture clock part of legally relevant state.

## Expected

When an unpromoted original Pawn currently transformed to Rook movement makes the regular move `a1-a2`, it remains the same physical Pawn and the halfmove clock must reset from `17` to `0`.

## Actual

The move succeeds and preserves `originalRole: 'pawn'`, but the resulting FEN increments the halfmove clock to `18`.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

const state = createGameState({
  fen: '7k/8/8/8/8/8/8/R3K3 w - - 17 9',
});
const transformedPawn = state.pieces.find(piece => piece.square === 'a1')!;
transformedPawn.originalRole = 'pawn';
transformedPawn.promoted = false;

const result = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
assert(result.ok);
assert.equal(result.state.pieces.find(piece => piece.id === transformedPawn.id)?.originalRole, 'pawn');
assert.equal(result.state.fen.split(' ')[4], '18'); // actual, should be '0'
```

## Root hint

The final ordinary-move branch delegates clock advancement to `position.play()`, whose board projection can see only the current `role: 'rook'`. Unlike `completeReplacementMove`, it never corrects the halfmove field from `PieceState.originalRole` and `promoted`. The already-used identity test `moving.originalRole === 'pawn' && !moving.promoted` should remain authoritative for this clock after a successful ordinary move.
