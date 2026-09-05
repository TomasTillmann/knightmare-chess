# A pinned neutral piece gives check despite having no legal capture

- Severity: High
- Cards: Neutrality
- Frozen commit: `dd88a8d4a092d2513a03b574e22f3309dc138bc8`

## Rule citation

`rules.md` §6 defines a threat by legal capture capability. Section 15.1 says moving a neutral piece is illegal when it leaves the controlling player's own King in check.

## Expected

The neutral White-owned Knight on `e7` geometrically attacks the White King on `c8`, but only Black could control it for that capture. Moving `Ne7xc8` would uncover the White Rook's `e1-e8` attack on Black's King, so the capture is illegal and the Knight does not give check. White must be allowed to end the staged turn.

## Actual

`endTurn` rejects the state with `KING_IN_CHECK`. Neutral attacks are treated as unconditional geometry without testing whether the relevant controller can legally make the capture.

## Minimal reproduction

Save as `.audit-scratch/pinned-neutral-check.ts` and run `../../node_modules/.bin/tsx .audit-scratch/pinned-neutral-check.ts`:

```ts
import assert from 'node:assert/strict';
import { applyAction, positionFor } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const state = createGameState({
  fen: '2K1k3/4N3/8/8/8/8/8/4R3 w - - 0 1',
  phase: 'afterMove',
  moveMade: true,
});
state.pieces.find(piece => piece.square === 'e7')!.neutral = true;

const result = applyAction(state, { type: 'endTurn' });
console.log(result.ok ? 'ok' : `${result.error.code}: ${result.error.message}`);
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.error.code, 'KING_IN_CHECK');

const attemptedCapture = structuredClone(state);
attemptedCapture.pieces.find(piece => piece.square === 'e7')!.square = 'c8';
assert.equal(positionFor(attemptedCapture, 'black').isCheck(), true);
```

## Evidence

The frozen reducer returns `KING_IN_CHECK`. The final assertion confirms that vacating `e7` exposes Black's King on `e8` to the White Rook, so Black cannot legally perform the neutral capture on which the reported check depends.

## Likely location

`src/game/reducer.ts:321-339` adds every neutral piece's raw attack geometry to every royal-safety query without validating the controlling side's King safety. `endTurn` relies on that result at lines 1355-1359.
