# Long Jump can move an opponent-owned neutral royal onto an attacked square

- **Severity:** High
- **Card:** Long Jump
- **Frozen commit:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §13.8 explicitly says a selected royal's destination must be safe. Neutrality permits White to select the Black-owned neutral Knight, but it does not waive that royal-safety condition. The card should fizzle and restore the Knight when `h6` is attacked by the white Rook on `h1`.

## Actual

The reducer records `cardPlayed` and leaves the Black-owned neutral royal Knight on attacked `h6`. It tests only White's royals for self-check; because Black still has an ordinary reply, the separate direct-mate test does not stop the unsafe relocation.

## Minimal reproduction

Save as `scratch/unsafe-neutral-royal.ts` and run `npx tsx scratch/unsafe-neutral-royal.ts`:

```ts
import { parseSquare } from 'chessops/util';
import { applyAction, positionFor } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const seeded = createGameState({
  fen: '4k3/8/8/8/8/8/8/1n2K2R w - - 0 1',
  hands: { white: ['long-jump'], black: [] },
});
const before = {
  ...seeded,
  pieces: seeded.pieces.map(p => p.square === 'b1' ? { ...p, neutral: true, royal: true } : p),
};
const result = applyAction(before, {
  type: 'playCard', cardId: 'long-jump', target: [{ from: 'b1', to: 'h6' }],
});
const position = positionFor(result.state, 'black');
console.log(result.state.history.at(-1));
console.log(position.kingAttackers(parseSquare('h6'), 'white', position.board.occupied).nonEmpty());
```

## Evidence

```text
{ type: 'cardPlayed', cardId: 'long-jump', target: [ { from: 'b1', to: 'h6' } ] }
true
```

The second line proves `h6` is attacked by White in the committed position.

## Likely production location

- `src/game/reducer.ts:783-791`: after relocation, `playLongJump()` checks direct mate against the defender and calls `isKingInCheck(resolved, color)` only for the acting color.
- The selected piece's `royal` flag and owner are available at `src/game/reducer.ts:771-785`, but no safety check is made for an opponent-owned neutral royal.
