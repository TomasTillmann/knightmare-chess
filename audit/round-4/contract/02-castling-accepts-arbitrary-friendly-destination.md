# A castling King may target an arbitrary friendly piece and castle elsewhere

- Severity: High
- Area: public move API, castling, history coherence

## Rule basis and expected behavior

Knightmare Chess inherits ordinary castling except where a card overrides it (`rules.md` §1). A White kingside castle moves the King from `e1` to `g1` (or may use the Chessground-specific `h1` Rook gesture at the UI boundary). `e1-a2`, where `a2` contains an unrelated friendly Pawn, is neither a King move nor a castling destination and must be rejected.

`legalDests` and `applyAction` must also agree, and a recorded move destination must describe the resulting physical move.

## Actual behavior

With a clear kingside path and the `K` right, `legalDests` correctly omits `a2`, but direct `applyAction({ from: 'e1', to: 'a2' })` succeeds. The reducer leaves the Pawn on `a2`, castles the King to `g1` and Rook to `f1`, then records the false history event `{ from: 'e1', to: 'a2' }`.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

const state = createGameState({
  fen: '4k3/8/8/8/8/8/P7/4K2R w K - 0 1',
});

assert.equal(legalDests(state).get('e1')?.includes('a2') ?? false, false);
const result = applyAction(state, { type: 'move', from: 'e1', to: 'a2' });
assert(result.ok);
assert.equal(result.state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'g1');
assert.equal(result.state.pieces.find(piece => piece.id === 'white-rook-h1')?.square, 'f1');
assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-a2')?.square, 'a2');
assert.deepEqual(result.state.history.at(-1), { type: 'move', from: 'e1', to: 'a2' });
```

The same issue reproduces with any friendly occupied destination on the side associated with an available castling right.

## Likely root

`castlingSide(position, move)` is called at `src/game/reducer.ts:1492` before the destination is restricted to the real King/Rook castling squares. Chessops treats a King move onto any friendly occupied square as a castling-shaped input and normalizes it to that side's Rook. `position.isLegal(move)` at line 1497 therefore returns true for the normalized castle, bypassing the narrower fallback check at lines 1595-1601. The reducer then executes castling but records the unnormalized user destination at lines 1656-1661.
