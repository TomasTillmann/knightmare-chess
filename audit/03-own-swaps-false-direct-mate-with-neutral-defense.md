# Own-piece swaps falsely fizzle when a neutral defender can answer check

- **Severity:** High
- **Cards:** Holy War, Cathedral, Siege
- **Frozen commit:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §15.1 says a neutral piece may be moved by either player and may capture either color. The direct-mate test must therefore include neutral-piece defenses. In each position below, the swap gives check but not mate:

- Holy War: Black can play the neutral white Rook `g6xg7`, capturing the checking Bishop.
- Cathedral: Black can play the neutral white Rook `g6xg7`, capturing the checking Bishop.
- Siege: Black can play the neutral white Bishop `g6xh7`, capturing the checking Rook.

The swap should resolve as `cardPlayed`.

## Actual

All three cards restore the pieces and record `cardFizzled` with reason `DIRECT_MATE`. The ordinary move reducer also rejects the neutral defense because chessops still treats the piece's recorded owner as its only controller.

## Minimal reproduction

Save as `scratch/neutral-defense.ts` in a detached worktree at the frozen commit, then run `npx tsx scratch/neutral-defense.ts`:

```ts
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

for (const [cardId, fen, neutralSquare, target] of [
  ['holy-war', '7k/6N1/5NR1/8/8/8/8/B3K3 w - - 0 1', 'g6', { knight: 'g7', bishop: 'a1' }],
  ['cathedral', '7k/6R1/5NR1/8/8/8/8/B3K3 w - - 0 1', 'g6', { rook: 'g7', bishop: 'a1' }],
  ['siege', '7k/5K1N/6B1/8/8/8/8/R7 w - - 0 1', 'g6', { knight: 'h7', rook: 'a1' }],
] as const) {
  const seeded = createGameState({
    fen, phase: 'afterMove', moveMade: true,
    hands: { white: [cardId], black: [] },
  });
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
holy-war { type: 'cardFizzled', cardId: 'holy-war', reason: 'DIRECT_MATE' }
cathedral { type: 'cardFizzled', cardId: 'cathedral', reason: 'DIRECT_MATE' }
siege { type: 'cardFizzled', cardId: 'siege', reason: 'DIRECT_MATE' }
```

The Holy War post-swap position was also staged directly as Black to move; `applyAction({ type: 'move', from: 'g6', to: 'g7' })` returned `ILLEGAL_MOVE` even though §15.1 makes that neutral capture legal.

## Likely production location

- `src/game/reducer.ts:96-126`: `legalDests()` starts from chessops owner-colored destinations and never adds ordinary moves for neutral pieces.
- `src/game/reducer.ts:140-145`: `isOrdinaryCheckmate()` therefore sees no neutral defense.
- `src/game/reducer.ts:1100-1103`: the shared swap reducer fizzles on that false checkmate result.
- `src/game/reducer.ts:1273-1284`: `movePiece()` relies on owner-colored `position.isLegal()` without a neutral-control path.
