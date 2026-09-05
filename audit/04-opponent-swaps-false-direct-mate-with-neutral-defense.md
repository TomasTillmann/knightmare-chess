# Opponent-swap cards falsely fizzle when a neutral piece can defend

- Severity: High
- Cards: Anathema, Evangelists, Holy Quest, Treason
- Frozen commit: `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §15.1 permits either player to move a neutral piece and permits that piece to capture either color. After Anathema swaps `Bd1` with `Rb2`, Black can control the neutral White Knight on `c3` and play `Nc3xb1`, capturing the checking White Queen. The resulting position is not checkmate, so Anathema must resolve instead of fizzling.

## Actual

The reducer spends Anathema and records `cardFizzled/DIRECT_MATE`. Its shared mate search derives ordinary moves from chessops ownership and never adds moves for neutral pieces owned by the other color. All four named swap cards use this same direct-mate path.

## Minimal reproduction

Save as `audit-scratch/repro.ts` in the frozen worktree, then run `./node_modules/.bin/tsx audit-scratch/repro.ts`:

```ts
import assert from 'node:assert/strict';
import { applyAction, positionFor } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const before = createGameState({
  fen: '8/8/8/8/8/2N5/1r6/kQKb4 w - - 0 1',
  phase: 'afterMove', moveMade: true,
  hands: { white: ['anathema'], black: [] },
});
before.pieces.find(p => p.square === 'c3')!.neutral = true;
const result = applyAction(before, {
  type: 'playCard', cardId: 'anathema', target: { bishop: 'd1', rook: 'b2' },
});
assert(result.ok);
assert.deepEqual(result.state.history.at(-1), {
  type: 'cardFizzled', cardId: 'anathema', reason: 'DIRECT_MATE',
});

const defended = structuredClone(before);
const bishop = defended.pieces.find(p => p.square === 'd1')!;
const rook = defended.pieces.find(p => p.square === 'b2')!;
bishop.square = 'b2'; rook.square = 'd1';
const knight = defended.pieces.find(p => p.square === 'c3')!;
const queen = defended.pieces.find(p => p.square === 'b1')!;
knight.square = 'b1'; queen.square = null; queen.zone = 'captured';
assert.equal(positionFor(defended, 'black').isCheck(), false);
```

## Evidence

The frozen reducer records `DIRECT_MATE`, while the rules-authorized neutral `c3-b1` capture removes check. The existing 123 target tests all pass but contain no defender-owned-color mismatch for a neutral defensive move.

## Likely production location

`src/game/reducer.ts:96-145` (`legalDests`, `hasLegalMove`, `isOrdinaryCheckmate`) and the shared swap check at `src/game/reducer.ts:1090-1094`.
