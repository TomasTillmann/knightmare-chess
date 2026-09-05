# After-move opponent swaps cannot perform a legal same-turn check rescue

- Severity: High
- Cards: Anathema, Holy Quest, Treason
- Frozen commit: `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §11.6 allows a Regular Move to leave the acting King temporarily in check when a card on that same turn removes the check. White may play the unrelated `a2-a3` while checked by `Nf3`, then use Treason to swap Black's `Ra8` and `Nf3`; the Knight leaves the attack and the Rook on `f3` does not check `Ke1`, so the completed turn is legal.

## Actual

The reducer rejects `a2-a3` immediately as `ILLEGAL_MOVE`, preventing the after-move Treason window from opening. If the after-move state is staged directly, Treason resolves and the final King is safe. The same staging failure blocks equivalent Anathema and Holy Quest rescues.

## Minimal reproduction

Save as `audit-scratch/repro.ts` in the frozen worktree, then run `./node_modules/.bin/tsx audit-scratch/repro.ts`:

```ts
import assert from 'node:assert/strict';
import { applyAction, positionFor } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const before = createGameState({
  fen: 'r6k/8/8/8/8/5n2/P7/4K3 w - - 0 1',
  hands: { white: ['treason'], black: [] },
});
const move = applyAction(before, { type: 'move', from: 'a2', to: 'a3' });
assert.equal(move.ok, false);
if (!move.ok) assert.equal(move.error.code, 'ILLEGAL_MOVE');

const staged = createGameState({
  fen: 'r6k/8/8/8/8/P4n2/8/4K3 b - - 0 1',
  hands: { white: ['treason'], black: [] },
});
staged.turn = { color: 'white', phase: 'afterMove', moveMade: true,
  cardPlays: { white: 0, black: 0 } };
staged.history = [{ type: 'move', from: 'a2', to: 'a3' }];
assert.equal(positionFor(staged, 'white').isCheck(), true);
const rescued = applyAction(staged, {
  type: 'playCard', cardId: 'treason', target: { rook: 'a8', knight: 'f3' },
});
assert(rescued.ok);
assert.equal(positionFor(rescued.state, 'white').isCheck(), false);
```

## Evidence

The first reducer call emits `ILLEGAL_MOVE`; the directly staged Treason call records `cardPlayed` and changes White's check state from true to false. This is precisely the sequence authorized by `rules.md` line 269.

## Likely production location

`src/game/reducer.ts:1273-1285` and `1340-1342`: `movePiece` enforces immediate orthodox legality and King safety. The comment at line 1282 acknowledges that same-turn rescue staging is not implemented.
