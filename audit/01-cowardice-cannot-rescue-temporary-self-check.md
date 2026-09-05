# Cowardice cannot perform a legal same-turn self-check rescue

- Severity: High
- Cards: Cowardice
- Frozen commit: `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §11.6 expressly allows a Regular Move to temporarily leave the acting King in check when a card on the same turn removes that check. With orientation `90`, White may move `Be2-f3`, then use Cowardice to move Black's Pawn backward `d4-e4`, blocking the `e8-e1` Rook line before ending the turn.

## Actual

The reducer rejects `Be2-f3` immediately as `ILLEGAL_MOVE`, so the after-move Cowardice window is unreachable. If the intermediate after-move state is staged directly, Cowardice accepts `d4-e4` and the final White King is safe.

## Minimal reproduction

From the frozen detached worktree, save as `audit-scratch/repro.ts` and run:

```sh
./node_modules/.bin/tsx audit-scratch/repro.ts
```

```ts
import assert from 'node:assert/strict';
import { applyAction, positionFor } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const before = createGameState({
  fen: '4r2k/8/8/8/3p4/8/4B3/4K3 w - - 0 1',
  hands: { white: ['cowardice'], black: [] },
});
before.orientation = 90;
const move = applyAction(before, { type: 'move', from: 'e2', to: 'f3' });
assert.equal(move.ok, false);
if (!move.ok) assert.equal(move.error.code, 'ILLEGAL_MOVE');

const staged = createGameState({
  fen: '4r2k/8/8/8/3p4/5B2/8/4K3 b - - 1 1',
  hands: { white: ['cowardice'], black: [] },
});
staged.orientation = 90;
staged.turn = { color: 'white', phase: 'afterMove', moveMade: true,
  cardPlays: { white: 0, black: 0 } };
staged.history = [{ type: 'move', from: 'e2', to: 'f3' }];
assert.equal(positionFor(staged, 'white').isCheck(), true);
const rescued = applyAction(staged, {
  type: 'playCard', cardId: 'cowardice', target: [{ from: 'd4', to: 'e4' }],
});
assert(rescued.ok);
assert.equal(positionFor(rescued.state, 'white').isCheck(), false);
```

## Evidence

The first assertion observes `ILLEGAL_MOVE`; the directly staged second half resolves as `cardPlayed` and changes check from `true` to `false`. This is the exact sequence permitted by `rules.md` line 269.

## Likely production location

`src/game/reducer.ts:1273-1285` and `1340-1342`: `movePiece` requires immediate orthodox legality and immediate King safety. The source comment at line 1282 explicitly says same-turn rescue staging is not implemented.
