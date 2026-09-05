# Fanatic commits an opponent-owned neutral royal Pawn onto an attacked square

- Severity: High
- Cards: Fanatic
- Frozen commit: `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

Fanatic's rule says a Pawn carrying King status retains it and its destination must be safe. White may control Black's neutral royal Pawn, but moving it `a7-a4` onto the White Rook's open `h4-a4` attack must fail and spend the card.

## Actual

Fanatic commits the move and records `cardPlayed`. It tests direct mate for Black, but only tests ordinary check safety for the acting color (White), so a non-mating attack on Black's relocated royal piece is accepted.

## Minimal reproduction

From the frozen detached worktree, save as `audit-scratch/repro.ts` and run:

```sh
./node_modules/.bin/tsx audit-scratch/repro.ts
```

```ts
import assert from 'node:assert/strict';
import { attacks } from 'chessops/attacks';
import { parseSquare } from 'chessops/util';
import { applyAction, positionFor } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const before = createGameState({
  fen: '4k3/p7/8/8/7R/8/8/4K3 w - - 0 1',
  hands: { white: ['fanatic'], black: [] },
});
before.pieces.find(p => p.square === 'e8')!.royal = false;
const pawn = before.pieces.find(p => p.square === 'a7')!;
pawn.neutral = true;
pawn.royal = true;

const result = applyAction(before, { type: 'playCard', cardId: 'fanatic', target: 'a7' });
assert(result.ok);
assert.deepEqual(result.state.history.at(-1), {
  type: 'cardPlayed', cardId: 'fanatic', target: 'a7',
});
const position = positionFor(result.state, 'black');
assert(attacks({ color: 'white', role: 'rook' }, parseSquare('h4'), position.board.occupied)
  .has(parseSquare('a4')));
```

## Evidence

The exact royal Pawn reaches `a4` with `neutral: true` and `royal: true`; `a4` is attacked by the White Rook on `h4`, yet history records a successful Fanatic play. This contradicts `rules.md` line 321.

## Likely production location

`src/game/reducer.ts:526-540`: after staging Fanatic, line 531 only checks whether the opponent is checkmated, while line 534 checks non-mating King safety only for `color` (the acting player).
