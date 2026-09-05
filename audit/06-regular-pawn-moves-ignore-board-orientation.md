# Regular Pawn moves ignore the rotated board orientation

- Severity: High
- Cards: Earthquake interaction with every Regular Pawn move
- Frozen commit: `dd88a8d4a092d2513a03b574e22f3309dc138bc8`

## Rule citation

`rules.md` §13.3 says Pawn forward movement and promotion ranks rotate with the board. Section 14.1 likewise says Earthquake rotates Pawn direction.

## Expected

At orientation `90`, White's forward vector is toward the h-file. The White Pawn on `b4` may therefore make the Regular Move `b4-c4`, while the unrotated move `b4-b5` is illegal.

## Actual

`legalDests` omits `c4`, the reducer rejects `b4-c4`, and the reducer accepts `b4-b5`.

## Minimal reproduction

Save as `.audit-scratch/oriented-regular-pawn.ts` in a detached worktree at the frozen commit and run `../../node_modules/.bin/tsx .audit-scratch/oriented-regular-pawn.ts`:

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const state = createGameState({ fen: '7k/8/8/8/1P6/8/8/K7 w - - 0 1' });
state.orientation = 90;

console.log(legalDests(state).get('b4'));
console.log('rotated', applyAction(state, { type: 'move', from: 'b4', to: 'c4' }).ok);
console.log('unrotated', applyAction(state, { type: 'move', from: 'b4', to: 'b5' }).ok);

assert.equal(legalDests(state).get('b4')?.includes('c4'), false);
assert.equal(applyAction(state, { type: 'move', from: 'b4', to: 'c4' }).ok, false);
assert.equal(applyAction(state, { type: 'move', from: 'b4', to: 'b5' }).ok, true);
```

## Evidence

The confirmed reducer results are `rotated false` and `unrotated true`. The same state field is honored by the card-specific Pawn helpers, so this is specifically a Regular Move failure.

## Likely location

`src/game/reducer.ts:50-89` builds an orthodox chessops position without applying `GameState.orientation`; `legalDests` and `movePiece` then delegate Regular Move geometry to that unrotated position at lines 96-121 and 1268-1280.
