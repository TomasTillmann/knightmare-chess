# Replacement cards falsely fizzle when a neutral piece can answer check

- **Severity:** High
- **Cards:** Tournament, Lost Castle, Squaring the Circle
- **Frozen commit:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §15.1 allows either player to move a neutral piece and lets it capture either color. Each card below gives check but not direct mate because Black has a neutral capture:

- Tournament: neutral white Rook `f6xf7` captures the checking Knight.
- Lost Castle: neutral white Knight `f6xh7` captures the checking Rook.
- Squaring the Circle: neutral white Bishop `g2xh1` captures the checking Rook.

Each card should resolve as `cardPlayed`.

## Actual

All three cards restore their board effect and record `cardFizzled` with `DIRECT_MATE` because the ordinary legal-move generator exposes only owner-colored chessops moves and omits neutral defenses.

## Minimal reproduction

Save as `scratch/neutral-defense.ts` at the frozen commit and run `npx tsx scratch/neutral-defense.ts`:

```ts
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

for (const [cardId, fen, neutralSquare, target] of [
  ['tournament', '7k/5n2/5RQ1/8/8/8/8/N3K3 w - - 0 1', 'f6', { own: 'a1', opponent: 'f7' }],
  ['lost-castle', '7k/7r/5NQ1/8/8/8/R7/4K3 w - - 0 1', 'f6', { own: 'a2', opponent: 'h7' }],
  ['squaring-the-circle', 'n4N1k/5K2/8/8/8/8/1R4B1/B7 w - - 0 1', 'g2', [{ from: 'b2', to: 'h1' }]],
] as const) {
  const seeded = createGameState({ fen, hands: { white: [cardId], black: [] } });
  const state = {
    ...seeded,
    pieces: seeded.pieces.map(p => p.square === neutralSquare ? { ...p, neutral: true } : p),
  };
  const result = applyAction(state, { type: 'playCard', cardId, target });
  console.log(cardId, result.state.history.at(-1));
}
```

## Evidence

```text
tournament { type: 'cardFizzled', cardId: 'tournament', reason: 'DIRECT_MATE' }
lost-castle { type: 'cardFizzled', cardId: 'lost-castle', reason: 'DIRECT_MATE' }
squaring-the-circle { type: 'cardFizzled', cardId: 'squaring-the-circle', reason: 'DIRECT_MATE' }
```

## Likely production location

- `src/game/reducer.ts:96-126`: `legalDests()` starts from chessops owner-colored destinations and never adds ordinary neutral moves.
- `src/game/reducer.ts:140-145`: `isOrdinaryCheckmate()` therefore sees no neutral defense.
- `src/game/reducer.ts:893-894` and `1100-1103`: Squaring and the shared swap reducer fizzle on the false mate result.
