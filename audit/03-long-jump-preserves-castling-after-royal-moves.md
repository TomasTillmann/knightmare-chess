# Long Jump preserves castling rights after moving a royal piece

- **Severity:** Medium
- **Card:** Long Jump
- **Frozen commit:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

The rules define Long Jump as moving the selected physical piece and preserving its royal identity. Under §12's narrow-conflict rule, Long Jump overrides movement geometry but not the ordinary rule that a moved King loses castling rights. The same guide makes this consequence explicit for the adjacent replacement-move cards Dubbing (§13.9) and Squaring the Circle (§13.10). Moving a royal currently transformed into a Knight must revoke both of its owner's castling rights.

## Actual

After the royal moves from `e1` to `e2`, the resulting FEN still contains both white castling rights (`HA`). If the same physical piece is later restored to King form on `e1`, the reducer accepts `e1-g1` castling, proving the stale rights are operational rather than cosmetic.

## Minimal reproduction

Save as `scratch/long-jump-castling.ts` and run `npx tsx scratch/long-jump-castling.ts`:

```ts
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const seeded = createGameState({
  fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
  hands: { white: ['long-jump'], black: [] },
});
const before = {
  ...seeded,
  pieces: seeded.pieces.map(p => p.square === 'e1' ? { ...p, role: 'knight' as const } : p),
};
const jumped = applyAction(before, {
  type: 'playCard', cardId: 'long-jump', target: [{ from: 'e1', to: 'e2' }],
});
if (!jumped.ok) throw jumped.error;

const restored = {
  ...jumped.state,
  pieces: jumped.state.pieces.map(p => p.id === 'white-king-e1'
    ? { ...p, role: 'king' as const, square: 'e1' as const }
    : p),
  turn: { ...jumped.state.turn, color: 'white' as const, phase: 'beforeMove' as const, moveMade: false },
};
console.log(jumped.state.fen);
console.log(applyAction(restored, { type: 'move', from: 'e1', to: 'g1' }).ok);
```

## Evidence

```text
4k3/8/8/8/8/8/4N3/R6R b HA - 1 1
true
```

## Likely production location

- `src/game/reducer.ts:390-402`: `completeReplacementMove()` already supports revoking rights via `castlingMove`.
- `src/game/reducer.ts:794`: `playLongJump()` calls it as `completeReplacementMove(resolved, color, false)` and omits the selected piece/from-square metadata, so neither the royal nor current/original-Rook revocation branch can run.
