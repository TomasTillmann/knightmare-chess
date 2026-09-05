# Non-Pawn Regular Moves cannot capture a same-owner neutral piece

- Severity: Medium
- Area: Neutrality, Regular Moves, `legalDests` / `applyAction`

## Rule basis and expected behavior

`rules.md` §15.1 makes a neutral piece available to both sides and treats it as both friendly and enemy for targeting. The already-authoritative Pawn path therefore permits a non-neutral Pawn to capture a neutral piece with the same stored owner. The same neutral target must be capturable by an otherwise legal Rook, Bishop, Knight, Queen, or King move; its historical `owner` must not turn it back into a friendly blocker for those roles.

In the position below, the White-origin Pawn on `a2` is neutral. White's Rook on `a1` must be able to capture it with `Ra1xa2`.

## Actual behavior

`legalDests(state).get('a1')` omits `a2`, and the direct `applyAction` call rejects the capture as `ILLEGAL_MOVE`. Changing only the mover to a Pawn makes the analogous same-owner neutral capture legal, so this is role-dependent Neutrality behavior rather than a general policy.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

const state = createGameState({
  fen: '7k/8/8/8/8/8/P7/R6K w - - 0 1',
});
state.pieces.find(piece => piece.square === 'a2')!.neutral = true;

assert.equal(legalDests(state).get('a1')?.includes('a2') ?? false, false);
const capture = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
assert.equal(capture.ok, false);
if (!capture.ok) assert.equal(capture.error.code, 'ILLEGAL_MOVE');
```

Observed Rook destinations were `b1, c1, d1, e1, f1, g1`; `a2` was absent.

## Likely root

The custom Pawn path explicitly accepts `target.neutral` (`src/game/reducer.ts:1519-1526`), and the custom neutral-mover path can capture either color (`src/game/reducer.ts:1561-1588`). A non-neutral non-Pawn instead relies on chessops `pseudoDests`, which removes every same-owner occupied square, and the captured-piece lookup at `src/game/reducer.ts:1621-1625` likewise recognizes only `owner !== turn.color`.
