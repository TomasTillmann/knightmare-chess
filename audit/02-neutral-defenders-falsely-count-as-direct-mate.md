# Neutral defenders are omitted from replacement-card direct-mate checks

- **Severity:** High
- **Cards:** Forced March, Annexation, Onslaught, Dubbing
- **Snapshot:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

Rules §15.1 says either player may move a neutral piece. Rules §11.2 and §11.5 require the direct-mate test to use the resulting board position. In the position below, Black controls the neutral White Rook on `g3` and can play `Rg7`, blocking the opened `a1-h8` diagonal. The card therefore gives check but does not create checkmate and must resolve normally.

## Actual

All four cards fizzle as `DIRECT_MATE`, restore the moved piece(s), spend the card, and consume the move.

Observed output:

```text
forced-march cardFizzled DIRECT_MATE
annexation cardFizzled DIRECT_MATE
onslaught cardFizzled DIRECT_MATE
dubbing cardFizzled DIRECT_MATE
```

## Minimal reproduction

Save as `.audit-scratch/neutral-defense.ts` in the detached snapshot and run:

```sh
./node_modules/.bin/tsx .worktrees/audit-pawn-replacements/.audit-scratch/neutral-defense.ts
```

```ts
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

const cases = [
  ['forced-march', '5N1k/5K2/8/8/8/6R1/1P6/B7 w - - 0 1', [{ from: 'b2', to: 'c2' }]],
  ['annexation', '5N1k/5K2/8/8/8/6R1/1P6/B7 w - - 0 1', [{ from: 'b2', to: 'b4' }]],
  ['onslaught', '5N1k/5K2/8/8/8/6R1/1P6/B7 w - - 0 1', [{ from: 'b2', to: 'b3' }]],
  ['dubbing', '5N1k/5K2/8/8/8/6R1/1R6/B7 w - - 0 1', [{ from: 'b2', to: 'c4' }]],
] as const;

for (const [cardId, fen, target] of cases) {
  const seeded = createGameState({
    fen,
    hands: { white: [cardId], black: [] },
    decks: { white: [], black: [] },
  });
  const state = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'g3' ? { ...piece, neutral: true } : piece),
  };
  const result = applyAction(state, { type: 'playCard', cardId, target });
  if (!result.ok) throw new Error(result.error.code);
  const event = result.state.history.at(-1)!;
  console.log(cardId, event.type, event.reason);
}
```

The `g3-g7` neutral Rook move is clear, blocks the Bishop, and leaves `h8` unattacked; it is a legal Black-controlled neutral defense.

## Evidence and likely location

`legalDests` starts from `chessgroundDests`, which only generates moves for pieces whose stored `owner` equals the side to move. Its custom loop also explicitly skips pieces when `piece.owner !== state.turn.color` and never admits `piece.neutral` (`src/game/reducer.ts:96-123`). `isOrdinaryCheckmate` consequently cannot see opponent-owned neutral defenders. Each card's direct-mate branch relies on that helper (`src/game/reducer.ts:605`, `678`, `737`, `834`).
