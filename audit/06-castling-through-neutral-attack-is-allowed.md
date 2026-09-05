# Castling is allowed through a square attacked by a neutral piece

- Severity: High
- Cards: Neutrality interaction with castling
- Frozen commit: `dd88a8d4a092d2513a03b574e22f3309dc138bc8`

## Rule citation

`rules.md` §15.1 says a neutral piece may be moved by either player and may check either King. Knightmare Chess otherwise uses standard chess (§1), where a King may not castle through an attacked square.

## Expected

The neutral White-owned Knight on `d2` attacks `f1` for Black. White's King on `e1` therefore cannot castle through `f1` to `g1`, even though neither `e1` nor `g1` is attacked.

## Actual

The reducer accepts `e1-g1`, moves the King to `g1` and the Rook to `f1`, and records a successful Regular Move.

## Minimal reproduction

Save as `.audit-scratch/neutral-castling-transit.ts` and run `../../node_modules/.bin/tsx .audit-scratch/neutral-castling-transit.ts`:

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const state = createGameState({ fen: '4k3/8/8/8/8/8/3N4/4K2R w K - 0 1' });
state.pieces.find(piece => piece.square === 'd2')!.neutral = true;

const result = applyAction(state, { type: 'move', from: 'e1', to: 'g1' });
console.log(legalDests(state).get('e1'));
console.log(result);

assert.equal(legalDests(state).get('e1')?.includes('g1'), true);
assert.equal(result.ok, true);
```

## Evidence

The frozen engine includes `g1` in the King's destinations and returns success. A Knight on `d2` attacks the transit square `f1`, and no pin or King-safety restriction prevents Black from controlling that neutral Knight.

## Likely location

`src/game/reducer.ts:50-57` stores the neutral Knight in chessops under its original White owner, so chessops' castling transit test does not see it as a Black attack. The custom neutral check at lines 321-339 is applied only to complete positions, after castling has already skipped over `f1`.
