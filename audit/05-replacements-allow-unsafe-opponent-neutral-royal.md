# Replacement cards can relocate an opponent-owned neutral royal onto an attacked square

- **Severity:** High
- **Cards:** Tournament, Lost Castle, Squaring the Circle
- **Frozen commit:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

Neutrality permits White to select the Black-owned neutral piece, but `rules.md` §15.1 requires both Kings' safety to be evaluated after every neutral move. The standard royal-safety rule therefore forbids relocating that royal onto a square attacked by White. The replacement effect should fizzle and restore the pieces.

## Actual

All three reducers record `cardPlayed` while the relocated Black-owned neutral royal is attacked by the white Rook on `h1` or `h6`. They check only the acting color's royals; a non-mating check against the defender does not fizzle.

## Minimal reproduction

Save as `scratch/unsafe-neutral-royal.ts` and run `npx tsx scratch/unsafe-neutral-royal.ts`:

```ts
import { parseSquare } from 'chessops/util';
import { applyAction, positionFor } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

for (const [cardId, fen, royalSquare, target, destination] of [
  ['tournament', '4k3/8/7N/8/8/8/8/1n2K2R w - - 0 1', 'b1', { own: 'h6', opponent: 'b1' }, 'h6'],
  ['lost-castle', '4k3/8/7R/8/8/8/8/1r2K2R w - - 0 1', 'b1', { own: 'h6', opponent: 'b1' }, 'h6'],
  ['squaring-the-circle', 'r3k2r/8/7R/8/8/8/4n3/R3K3 w - - 0 1', 'e2', [{ from: 'e2', to: 'h1' }], 'h1'],
] as const) {
  const seeded = createGameState({ fen, hands: { white: [cardId], black: [] } });
  const before = {
    ...seeded,
    pieces: seeded.pieces.map(p => p.square === royalSquare
      ? { ...p, neutral: true, royal: true }
      : p),
  };
  const result = applyAction(before, { type: 'playCard', cardId, target });
  if (!result.ok) throw result.error;
  const position = positionFor(result.state, 'black');
  console.log(cardId, result.state.history.at(-1)?.type,
    position.kingAttackers(parseSquare(destination), 'white', position.board.occupied).nonEmpty());
}
```

## Evidence

```text
tournament cardPlayed true
lost-castle cardPlayed true
squaring-the-circle cardPlayed true
```

`true` means the committed destination of the Black-owned neutral royal is attacked by White.

## Likely production location

- `src/game/reducer.ts:889-897`: Squaring checks direct mate against the defender but checks ordinary royal safety only with `isKingInCheck(resolved, color)` for the actor.
- `src/game/reducer.ts:1100-1106`: the shared Tournament/Lost Castle reducer has the same actor-only safety check.
- Both paths already retain `owner`, `neutral`, and `royal`, so the missing defender-owned selected-royal check can be made before commit.
