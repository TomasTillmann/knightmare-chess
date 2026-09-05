# An opposite-owner neutral double-step emits an impossible FEN en-passant field

- Severity: Low
- Area: public/debug FEN, Neutrality, en passant

## Rule basis and expected behavior

`rules.md` §§13.1, 13.5, and 15.1 allow the acting player to move a neutral Pawn owned by the other color and preserve a valid en-passant opportunity for the reply. The extended `GameState.enPassant` field can represent that situation, but orthodox FEN cannot: its side-to-move implies that the Pawn which just double-stepped belongs to the opposite side.

As the reducer already does for rotated and multiple simultaneous rights, the FEN projection should use `-` when the authoritative Knightmare right cannot be represented, while retaining the right in `GameState.enPassant`.

## Actual behavior

White can Annex the neutral Black Pawn `e7-e5`. The resulting state correctly retains `{ target: 'e6', pawnId: 'black-pawn-e7' }`, but emits `... b - e6 ...`: Black is both the side to move and the owner of the Pawn supposedly just double-stepped. `positionFor(state).epSquare` immediately rejects that FEN field as invalid and returns `undefined`, so the two public projections disagree.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, positionFor } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

const state = createGameState({
  fen: '7k/4p3/8/3P4/8/8/8/K7 w - - 0 1',
  hands: { white: ['annexation'], black: [] },
});
state.pieces.find(piece => piece.square === 'e7')!.neutral = true;

const result = applyAction(state, {
  type: 'playCard',
  cardId: 'annexation',
  target: [{ from: 'e7', to: 'e5' }],
});
assert(result.ok);
assert.equal(result.state.fen.split(' ')[1], 'b');
assert.equal(result.state.fen.split(' ')[3], 'e6');
assert.deepEqual(result.state.enPassant, [
  { target: 'e6', pawnId: 'black-pawn-e7' },
]);
assert.equal(positionFor(result.state).epSquare, undefined);
```

The mirrored case occurs when Black controls a neutral White Pawn. A regular double-step and Annexation both reach the same mismatch.

## Likely root

`completeReplacementMove` writes the sole orientation-0 opportunity into FEN based only on count and orientation (`src/game/reducer.ts:539-541`). It does not check that the moved Pawn's stored owner is the side opposite `setup.turn`. `setupFor` later performs that semantic validation and clears the projection, but the already-published `state.fen` remains contradictory.
