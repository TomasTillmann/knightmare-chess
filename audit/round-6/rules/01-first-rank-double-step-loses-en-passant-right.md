# First-rank double-step loses its en-passant right

- Severity: High
- Area: ordinary Pawn movement, en passant, first-rank Knightmare rule
- Audited commit: `2f0e4082eb991d8efbffe374100439ba4ad675e2`

## Rule basis

`rules.md` §13.1 allows any Pawn on its owner's first **or** second rank to move two squares when the path is clear, and says any Pawn making that move can be captured en passant under the ordinary timing and geometry.

## Expected

After White moves `b1-b3`, the Black Pawn on `a3` must be able to capture the passing Pawn with `a3xb2 e.p.` on the immediate reply. The engine must retain an en-passant opportunity whose target is `b2` and victim is the physical White Pawn.

## Actual

The double-step is accepted, but the returned state has `enPassant: []` and FEN `-` in the en-passant field. After ending White's turn, `legalDests` offers only `a3-a2`, and direct `a3-b2` is rejected as `ILLEGAL_MOVE`.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

let state = createGameState({
  fen: '7k/8/8/8/8/p7/8/KP6 w - - 0 1',
});

const double = applyAction(state, { type: 'move', from: 'b1', to: 'b3' });
assert(double.ok);
assert.deepEqual(double.state.enPassant, []); // actual, should contain b2 / white-pawn-b1
assert.equal(double.state.fen.split(' ')[3], '-');

const ended = applyAction(double.state, { type: 'endTurn' });
assert(ended.ok);
assert.equal(legalDests(ended.state).get('a3')?.includes('b2') ?? false, false);
const capture = applyAction(ended.state, { type: 'move', from: 'a3', to: 'b2' });
assert.equal(capture.ok, false);
```

The symmetric Black first-rank case has the same root.

## Root hint

`movePiece` lets the unrotated first-rank double-step take the chessops path when `position.isLegal()` returns true. The later ordinary branch derives `state.enPassant` only from `position.epSquare`, but chessops does not publish a standard FEN en-passant square for this Knightmare-only starting rank. The custom Pawn branch already knows how to construct an `EnPassantOpportunity`; first-rank doubles need that same authoritative delta-based result even when chessops accepts the movement.
