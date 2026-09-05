# Pawn replacement cards preserve castling rights after moving the royal piece

- **Severity:** Medium
- **Cards:** Forced March, Annexation, Onslaught
- **Snapshot:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

Knightmare Chess is standard chess except where cards override it (§1). A Pawn carrying King status remains royal (§13.6 explicitly calls this out for Forced March), and moving the royal piece must revoke both of its owner's castling rights. Dubbing §13.9 states the same royal-identity consequence explicitly. Moving the White royal Pawn in each case below should change `KQkq` to `kq`.

## Actual

All three moves succeed while the FEN castling field remains `KQkq`, so White can retain castling availability after its royal piece has moved.

Observed output:

```text
forced-march KQkq
annexation KQkq
onslaught KQkq
```

## Minimal reproduction

Save as `.audit-scratch/royal-castling.ts` in the detached snapshot and run it with the repository's `tsx` binary.

```ts
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

for (const [cardId, from, to] of [
  ['forced-march', 'a2', 'b2'],
  ['annexation', 'a2', 'a4'],
  ['onslaught', 'a2', 'a3'],
] as const) {
  const seeded = createGameState({
    fen: 'r3k2r/8/8/8/8/8/P7/R3K2R w KQkq - 0 1',
    hands: { white: [cardId], black: [] },
    decks: { white: [], black: [] },
  });
  const state = {
    ...seeded,
    pieces: seeded.pieces.map(piece =>
      piece.square === 'e1' ? { ...piece, royal: false }
        : piece.square === from ? { ...piece, royal: true }
        : piece,
    ),
  };
  const result = applyAction(state, {
    type: 'playCard', cardId, target: [{ from, to }],
  });
  if (!result.ok) throw new Error(result.error.code);
  console.log(cardId, result.state.fen.split(' ')[2]);
}
```

## Evidence and likely location

`completeReplacementMove` already has the correct royal-aware castling removal when it receives `castlingMove` (`src/game/reducer.ts:390-402`). Dubbing supplies that argument (`src/game/reducer.ts:841-847`). Forced March, Annexation, and Onslaught call the helper without the moved piece(s) (`src/game/reducer.ts:612`, `676`, `744`), so royal Pawn identity is never considered when serializing castling rights.
