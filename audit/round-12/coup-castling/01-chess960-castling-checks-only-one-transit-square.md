# Chess960 castling checks only one invented transit square

- Severity: High
- Area: Chess960 castling, check safety, neutral attacks, after-move rescue
- Audited state: current shared checkout; `src/` and tests remained read-only

## Rule basis

Knightmare Chess inherits ordinary chess unless a card overrides it (`rules.md` §1). Castling may not start in check or pass through an attacked square. Under the existing §11.6 implementation ruling, an attack on the **destination only** may temporarily remain when a real after-move card can rescue it. In Chess960, the King may traverse several squares, only one square, or no squares at all before reaching `c1`/`g1` (or `c8`/`g8`).

## Expected

- A King on `g1` castling queenside must not pass through an attacked `e1`.
- A King already on its final `g1` square may castle kingside by moving only the Rook; an attack on `f1`, where the Rook lands, is irrelevant to King safety.
- A King on `f1` castling to an attacked `g1` has no transit square; under the local rescue ruling it may stage the castle only when an eligible after-move card really removes that destination check.

Both the King-destination and registered-Rook target aliases must resolve identically.

## Actual

The reducer computes exactly one square with `from + (kingTo > from ? 1 : -1)` and treats that as the transit square for every castle.

- It accepts `g1-c1` and direct Rook-alias `g1-a1` through an attacked `e1`, for both ordinary and neutral attackers. The same failure reproduces for Black.
- It rejects the legal stationary-King castle `g1-h1` when only `f1` is attacked. The same failure reproduces for Black.
- By the same calculation, an adjacent King start such as `f1-g1` treats the destination itself as an absolute transit square, bypassing the established destination-only rescue procedure.

Accepted illegal castles move the King/Rook, advance clocks, clear castling rights, and record a successful move, so this is not a presentation-only defect.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

// Black Knight c2 attacks e1, a later square on the g1-c1 King path.
const throughCheck = createGameState({
  fen: 'k7/8/8/8/8/8/2n5/R5K1 w Q - 0 1',
});
assert.equal(legalDests(throughCheck).get('g1')?.includes('c1'), true);
assert.equal(applyAction(throughCheck, {
  type: 'move', from: 'g1', to: 'c1',
}).ok, true); // expected false
assert.equal(applyAction(throughCheck, {
  type: 'move', from: 'g1', to: 'a1',
}).ok, true); // expected false; registered-Rook alias

// Black Knight d2 attacks f1, but the g1 King is stationary in this castle.
const stationaryKing = createGameState({
  fen: 'k7/8/8/8/8/8/3n4/6KR w K - 0 1',
});
assert.equal(applyAction(stationaryKing, {
  type: 'move', from: 'g1', to: 'h1',
}).ok, false); // expected true
```

For the neutral-attacker controls, place the Black King on `h8` instead (`7k/8/8/8/8/8/2n5/R5K1 w Q - 0 1` for the transit case and `7k/8/8/8/8/8/3n4/6KR w K - 0 1` for the stationary case), then set the Knight to `neutral: true`; both failures persist. The original neutral fixture used `a8`, where the registered White Rook on `a1` already checked Black, so it was corrected to remove that controller-legality confound. Removing the attacker makes both castling sides succeed. Moving the attacker onto the origin or the actual first transit square is rejected, confirming that the defect is specifically the incomplete/incorrect King-path model rather than a general absence of check validation.

## Evidence and likely root

`movePiece()` delegates orthodox castling safety to chessops, but when chessops rejects a castle the reducer's rescue-compatible pseudo-castling path can admit it. The subsequent custom safety gate checks the origin plus only the arithmetically adjacent square. That is sufficient for orthodox `e1-g1`, but not for Chess960 King paths. It also invents a transit square when `from === kingTo` and conflates an adjacent destination with transit.

The smallest root fix is to derive the complete exclusive King transit path from the actual start and final squares, keep origin/transit absolute, and leave only the final square to `finishRegularMove()`'s existing rescue transaction.

## Bounded matrix

- White and Black long queenside castles from `g1`/`g8`: illegal passage through the later `e`-file transit square was accepted in 4/4 ordinary/neutral-controller cases.
- King-destination and registered-Rook aliases: both direct actions reproduced the same safety result.
- White and Black stationary kings on `g1`/`g8`: legal Rook-only castles were rejected in 2/2 cases when only `f1`/`f8` was attacked.
- Existing orthodox origin/transit/destination-rescue regressions remained green.
