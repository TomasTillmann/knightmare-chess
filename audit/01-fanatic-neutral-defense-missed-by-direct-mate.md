# Fanatic falsely fizzles when a neutral piece can answer the check

- Severity: High
- Cards: Fanatic (shared direct-mate machinery also used by Disintegration and Cowardice)
- Frozen commit: `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §15.1 says either player may move a neutral piece and that it may capture either color. After `d4-d7` opens the Bishop's diagonal to `h8`, Black can control the neutral White Knight on `c2` and play `c2-a1`, capturing the checking Bishop. The position is therefore not checkmate, so Fanatic must resolve.

## Actual

Fanatic is spent and recorded as a `DIRECT_MATE` fizzle. The direct-mate search delegates to `legalDests`, which seeds moves from chessops ownership and never adds ordinary moves for neutral pieces owned by the other color.

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
  fen: '7k/8/6Q1/8/3P4/8/2N5/B3K3 w - - 0 1',
  hands: { white: ['fanatic'], black: [] },
});
before.pieces.find(p => p.square === 'c2')!.neutral = true;
const result = applyAction(before, { type: 'playCard', cardId: 'fanatic', target: 'd4' });
assert(result.ok);
assert.deepEqual(result.state.history.at(-1), {
  type: 'cardFizzled', cardId: 'fanatic', reason: 'DIRECT_MATE',
});

const saved = structuredClone(before);
saved.pieces.find(p => p.square === 'd4')!.square = 'd7';
const knight = saved.pieces.find(p => p.square === 'c2')!;
const bishop = saved.pieces.find(p => p.square === 'a1')!;
knight.square = 'a1';
bishop.square = null;
bishop.zone = 'captured';
assert.equal(positionFor(saved, 'black').isCheck(), false);
```

## Evidence

The reproduction prints/observes `cardFizzled/DIRECT_MATE`, while the legal neutral `c2-a1` response removes check. This contradicts `rules.md` lines 417-421 and the direct-mate definition at lines 262-265.

## Likely production location

`src/game/reducer.ts:96-145`: `legalDests`/`hasLegalMove` derive ordinary moves from chessops colors and only special-case en passant; neutral pieces controlled by the non-owner are omitted.
