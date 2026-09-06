# A rescuable castle's registered-Rook alias is missing from legal destinations

- Severity: Medium
- Area: public move contract, castling aliases, after-move rescue
- Audited state: current shared checkout; `src/` and tests remained read-only

## Rule and contract basis

`rules.md` §11.6 allows a Regular Move to leave the acting King temporarily in check when a legal card on the same turn removes it. The reducer intentionally applies that ruling to a destination-only castling check. The established public contract accepts both ways Chessground can express castling: targeting the King's final square or targeting the registered physical Rook. Both aliases record the canonical King landing square.

## Expected

When a destination-only attacked castle has a real after-move rescue, `legalDests()` should expose both aliases that `applyAction()` accepts. For White kingside castling these are `e1-g1` and `e1-h1`; Black has the symmetric `e8-g8` and `e8-h8` aliases.

## Actual

The King-destination alias is listed, while the registered-Rook alias is absent. Calling `applyAction()` directly with either alias succeeds and produces the same pending-rescue state.

This prevents the UI's Rook-target gesture from expressing a move the authoritative reducer considers legal, and it creates a public API disagreement for identical castling semantics.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

const state = createGameState({
  fen: '4k3/8/8/8/8/8/7p/4K2R w K - 0 1',
  hands: { white: ['cowardice'], black: [] },
  decks: { white: [], black: [] },
});

const dests = legalDests(state).get('e1') ?? [];
assert.equal(dests.includes('g1'), true);
assert.equal(dests.includes('h1'), false); // expected true

for (const to of ['g1', 'h1'] as const) {
  const result = applyAction(state, { type: 'move', from: 'e1', to });
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(result.state.pendingRescue);
}
```

Moving the Black Pawn from `h2` to a non-attacking square makes chessops accept the castle normally and both aliases reappear, isolating the defect to reducer-legal castles that chessops did not seed.

## Evidence and likely root

`legalDests()` starts with chessops/Chessground candidates. It manually adds the canonical `c`/`g` King destination for a royal original King so the reducer can test local rescue rules, but it does not also add the registered physical Rook square. The final filter can validate only destinations already in that candidate set. Direct `movePiece()` has no such enumeration gap and accepts the Rook alias.

The root fix belongs in the shared castling-candidate augmentation: add each validated registered-Rook alias alongside its canonical King destination, then let the existing `moveIsLegal()` filter decide both.

## Bounded matrix

- White `e1-g1`/`e1-h1` with Cowardice rescue: King destination listed and accepted; Rook alias omitted but accepted.
- Black `e8-g8`/`e8-h8`: symmetric result.
- Safe orthodox and safe Chess960 castles: both aliases were listed and accepted in the checked controls.
- An unsafe destination with no eligible rescue: neither alias was accepted.

## Other scoped results

The Round 11 Coup fix held across 80 direct cases: both colors, five adjacent back-rank/second-rank squares, both stored target owners, and all four orientations. Every same-owner or opposite-owner neutral target was listed and captured without input mutation. Eight isolated controls also passed: non-neutral friendly targets and non-adjacent neutral targets were rejected, ordinary enemy targets were captured, and neutral royal targets remained uncapturable.

The focused existing Coup/castling/neutral-royal regression set passed 38/38 tests. Castling-right revocation/preservation for the Prince, actual royal, physical Rooks, ordinary captures, replacement moves, after-move swaps, and both colors matched the established rulings in those controls.

