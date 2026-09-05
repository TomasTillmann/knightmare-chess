# No Quarter cannot follow a legal capture of a Coup Prince

- Severity: Medium
- Cards: No Quarter; interaction with Coup
- Frozen commit: `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

Under `rules.md` §15.3, Coup makes the original King a capturable Prince and transfers royal status to another piece. A Regular Move may therefore capture the non-royal role-King on `e8`; No Quarter should then bind to that exact enemy piece and change its captured zone to dead under §22.9.

## Actual

The reducer rejects the otherwise legal `Re2xe8` as `ILLEGAL_MOVE` solely because the target's current chess role is `king`, despite `royal: false`. No capture event is produced, so No Quarter cannot be played.

## Minimal reproduction

From the frozen detached worktree, save as `audit-scratch/repro.ts` and run:

```sh
./node_modules/.bin/tsx audit-scratch/repro.ts
```

```ts
import assert from 'node:assert/strict';
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const before = createGameState({
  fen: '4k3/p7/8/8/8/8/4R3/4K3 w - - 0 1',
  hands: { white: ['no-quarter'], black: [] },
});
before.pieces.find(p => p.square === 'e8')!.royal = false; // Coup Prince
before.pieces.find(p => p.square === 'a7')!.royal = true;  // replacement King
const capture = applyAction(before, { type: 'move', from: 'e2', to: 'e8' });
assert.equal(capture.ok, false);
if (!capture.ok) {
  assert.equal(capture.error.code, 'ILLEGAL_MOVE');
  assert.equal(capture.error.message, 'Kings are never captured.');
}
```

## Evidence

The target on `e8` is `{ role: 'king', royal: false }` and another Black piece is royal, but the reducer emits `Kings are never captured.` This contradicts `rules.md` line 429 and prevents the `rules.md` line 636 No Quarter trigger.

## Likely production location

`src/game/reducer.ts:1278-1281`: capture immunity is keyed to chess role rather than `PieceState.royal`. `playNoQuarter` at lines 1135-1156 would handle the exact captured identity, but never receives a legal predecessor state.
