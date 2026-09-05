# A Coup Prince still constrains Regular Move legality as if royal

- Severity: High
- Cards: Coup
- Frozen commit: `dd88a8d4a092d2513a03b574e22f3309dc138bc8`

## Rule citation

`rules.md` §15.3 transfers all King protection and check rules to the marked replacement piece; the original King becomes a capturable Prince.

## Expected

With the former King on `e1` marked `royal: false` and the replacement Rook on `a1` marked `royal: true`, the Black Rook's attack on `e1` is an attack on the Prince, not check. White may make the unrelated Regular Move `b2-b3` because the actual royal piece on `a1` remains safe.

## Actual

`legalDests` omits the Pawn and `applyAction` rejects `b2-b3` as `ILLEGAL_MOVE`. The current-role King still drives chessops check-evasion constraints even though it is non-royal.

## Minimal reproduction

Save as `.audit-scratch/coup-prince-legality.ts` and run `../../node_modules/.bin/tsx .audit-scratch/coup-prince-legality.ts`:

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const state = createGameState({ fen: '4r2k/8/8/8/8/8/1P6/R3K3 w - - 0 1' });
state.pieces.find(piece => piece.square === 'e1')!.royal = false;
state.pieces.find(piece => piece.square === 'a1')!.royal = true;

const result = applyAction(state, { type: 'move', from: 'b2', to: 'b3' });
console.log(legalDests(state).get('b2'));
console.log(result.ok ? 'ok' : `${result.error.code}: ${result.error.message}`);

assert.notEqual(legalDests(state).get('b2')?.includes('b3'), true);
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
```

## Evidence

The frozen reducer prints no legal destination for `b2` and returns `ILLEGAL_MOVE`. The replacement royal on `a1` is not attacked; only the non-royal role-King on `e1` is attacked.

## Likely location

`src/game/reducer.ts:50-89` places current roles into chessops, whose legality context treats the role-King as royal. `movePiece` calls `position.isLegal` at lines 1268-1280 before its separate royal-aware safety check at lines 1336-1338.
