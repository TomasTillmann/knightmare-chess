# Evangelists retains castling rights after moving the royal piece

- Severity: Medium
- Cards: Evangelists
- Frozen commit: `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

Knightmare Chess uses standard chess as its foundation, and a royal piece that has moved permanently loses its castling rights. The rules make this identity-based requirement explicit for other replacement moves: moving a royal piece revokes both rights even when transformed away from King movement (`rules.md` lines 365 and 371). Evangelists moving the transformed White royal piece from `e1` to `c8` must therefore clear White's castling rights.

## Actual

Evangelists completes the replacement move while retaining both White castling rights. With the transformed royal absent from `e1`, chessops serializes the stale rights as `HA` rather than `KQ`, but they remain present instead of `-`.

## Minimal reproduction

Save as `audit-scratch/repro.ts` in the frozen worktree, then run `./node_modules/.bin/tsx audit-scratch/repro.ts`:

```ts
import assert from 'node:assert/strict';
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const before = createGameState({
  fen: '2b4k/8/8/8/8/8/8/R3B2R w KQ - 0 1',
  hands: { white: ['evangelists'], black: [] },
});
const royal = before.pieces.find(p => p.square === 'e1')!;
royal.originalRole = 'king';
royal.royal = true;
const result = applyAction(before, {
  type: 'playCard', cardId: 'evangelists', target: { own: 'e1', opponent: 'c8' },
});
assert(result.ok);
assert.equal(result.state.pieces.find(p => p.id === royal.id)?.square, 'c8');
assert.equal(result.state.fen.split(' ')[2], 'HA');
assert.notEqual(result.state.fen.split(' ')[2], '-');
```

## Evidence

The exact piece remains `royal: true`, moves from `e1` to `c8`, and the frozen reducer emits FEN castling field `HA`. Castling availability is legally relevant state under `rules.md` line 649.

## Likely production location

`src/game/reducer.ts:1096`: `completeReplacementMove(resolved, color, false)` is called without the `castlingMove` metadata used by Dubbing/Squaring the Circle, so `completeReplacementMove` cannot revoke royal movement rights.
