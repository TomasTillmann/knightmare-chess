# Same-origin pieces do not threaten a neutral royal

- Severity: High
- Area: Neutrality, royal safety, all card relocations
- Audited state: current shared checkout; `src/` and `tests/` remained read-only

## Rule basis

`rules.md` §15.1 makes a neutral piece valid on both sides of the friendly/enemy distinction and requires royal safety after a neutral move. The established ordinary-move behavior also lets a piece capture a neutral target with the same stored owner. A neutral piece carrying King status therefore cannot be moved onto a square where a same-origin ordinary piece could capture it.

## Expected

White may control the Black-origin neutral royal Knight on `b1` and use Long Jump to propose `b1-h6`. The Black Rook on `h8` attacks `h6`; stored Black ownership does not make the neutral royal friendly or immune to that Rook. Long Jump must fizzle with `SELF_CHECK`, restore the Knight to `b1`, and spend the card.

## Actual

Long Jump records `cardPlayed`, leaves the neutral royal on `h6`, and `isKingInCheck(result.state, 'black')` reports `false`. Changing only the attacking Rook to White makes the existing neutral-royal safety path fizzle, so the failure is specifically the same-origin attacker case omitted by the owner-based check test.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

const state = createGameState({
  fen: '4k2r/8/8/8/8/8/8/1n2K3 w - - 0 1',
  hands: { white: ['long-jump'], black: [] },
});
state.pieces.find(piece => piece.square === 'e8')!.royal = false;
const knight = state.pieces.find(piece => piece.square === 'b1')!;
knight.neutral = true;
knight.royal = true;

const result = applyAction(state, {
  type: 'playCard',
  cardId: 'long-jump',
  target: [{ from: 'b1', to: 'h6' }],
});

assert(result.ok);
assert.deepEqual(result.state.history.at(-1), {
  type: 'cardPlayed',
  cardId: 'long-jump',
  target: [{ from: 'b1', to: 'h6' }],
});
assert.equal(isKingInCheck(result.state, 'black'), false);
assert.equal(result.state.pieces.find(piece => piece.id === knight.id)?.square, 'h6');
```

## Likely root

`isRoyalInCheck` in `src/game/reducer.ts` recognizes an ordinary attacker only when `attacker.owner === opposite(piece.owner)`. That is correct for an ordinary royal, but not for a neutral royal, which is capturable from either stored color. Every replacement/after-move card ultimately relies on this shared helper through `moveLeavesRoyalInCheck`, so the defect is not Long-Jump-specific.
