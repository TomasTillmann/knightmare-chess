# After-move swap preserves castling rights after moving the actual royal

- Severity: Medium
- Cards: Holy War, Anathema, Holy Quest, Treason, Cathedral, Siege
- Area: Coup royal identity, after-move swaps, physical castling rights
- Audited commit: `2f0e4082eb991d8efbffe374100439ba4ad675e2`

## Rule basis

`rules.md` §15.3 transfers King status to Coup's marked physical piece while it retains its ordinary movement. Sections 10 and 23 make physical identity and castling availability persistent state. The established ruling already enforced for replacement-move swaps is that moving the actual royal revokes both owner castling rights even when its current role is not King.

## Expected

In the reachable Coup state below, White's original `e1` King is the non-royal Prince and the `c1` Bishop is the marked King. White first makes `a2-a3`, then uses Holy War to swap that royal Bishop with the `b1` Knight. Moving the actual royal from `c1` to `b1` must remove White's `KQ` rights.

## Actual

Holy War succeeds and moves the exact royal Bishop, but the FEN still contains `KQ`. All after-move swap cards share this completion path; opponent-target swaps can likewise relocate a Coup royal without revoking its owner's rights.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

let state = createGameState({
  fen: '4k3/8/8/8/8/8/P7/RNB1K2R w KQ - 0 1',
  hands: { white: ['holy-war'], black: [] },
});
state.pieces.find(piece => piece.square === 'e1')!.royal = false;
const royal = state.pieces.find(piece => piece.square === 'c1')!;
royal.royal = true;

const moved = applyAction(state, { type: 'move', from: 'a2', to: 'a3' });
assert(moved.ok);
const swapped = applyAction(moved.state, {
  type: 'playCard',
  cardId: 'holy-war',
  target: { knight: 'b1', bishop: 'c1' },
});
assert(swapped.ok);
assert.equal(swapped.state.pieces.find(piece => piece.id === royal.id)?.square, 'b1');
assert.equal(swapped.state.fen.split(' ')[2], 'KQ'); // actual, should be '-'
```

## Root hint

`playSwapCard` passes both moved physical pieces to `completeReplacementMove` only for replacement-move cards. Its after-move branch calls `syncFen(resolved)` without `firstPiece` and `secondPiece`, so the shared identity-aware `revokeCastlingRights` helper never sees a royal moved by Holy War, Anathema, Holy Quest, Treason, Cathedral, or Siege. Passing the moved pieces through this existing shared path fixes the root without changing the intentional FEN clock/turn behavior of an after-move card.
