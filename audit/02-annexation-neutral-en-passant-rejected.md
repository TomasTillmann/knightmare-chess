# Annexation en-passant cannot be taken by an opponent-owned neutral Pawn

- **Severity:** High
- **Cards:** Annexation
- **Snapshot:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

Rules §13.5 preserves en-passant vulnerability for an Annexation double-step. Rules §15.1 says a neutral piece may be moved by either player and may capture either color. White can therefore Annex the neutral Black Pawn `e7-e5`; on Black's reply, Black controls the neutral White Pawn on `d5`, which may capture `e5` en passant via `d5xe6`.

## Actual

Annexation records the right, but `legalDests` omits `d5` and the direct reducer move is rejected as `ILLEGAL_MOVE` without changing state.

Observed output:

```text
right: [{ target: 'e6', pawnId: 'black-pawn-e7' }]
d5 destinations: undefined
move: ILLEGAL_MOVE
```

## Minimal reproduction

Save as `.audit-scratch/neutral-ep.ts` in the detached snapshot and run it with the repository's `tsx` binary.

```ts
import { applyAction, legalDests } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

let state = createGameState({
  fen: '7k/4p3/8/3P4/8/8/8/K7 w - - 0 1',
  hands: { white: ['annexation'], black: [] },
  decks: { white: [], black: [] },
});
state = {
  ...state,
  pieces: state.pieces.map(piece =>
    piece.square === 'e7' || piece.square === 'd5' ? { ...piece, neutral: true } : piece,
  ),
};
const annexed = applyAction(state, {
  type: 'playCard', cardId: 'annexation', target: [{ from: 'e7', to: 'e5' }],
});
if (!annexed.ok) throw new Error(annexed.error.code);
const reply = applyAction(annexed.state, { type: 'endTurn' });
if (!reply.ok) throw new Error(reply.error.code);
console.log(reply.state.enPassant);
console.log(legalDests(reply.state).get('d5'));
console.log(applyAction(reply.state, { type: 'move', from: 'd5', to: 'e6' }));
```

## Evidence and likely location

The explicit Annexation right is correctly created in `playAnnexation` (`src/game/reducer.ts:665-676`). It becomes unusable because `legalDests` ignores a neutral Pawn whose stored owner differs from the acting color (`src/game/reducer.ts:101-110`), and `enPassantCapture` independently requires `moving.owner === state.turn.color` (`src/game/reducer.ts:355`). Both checks conflict with neutral control.
