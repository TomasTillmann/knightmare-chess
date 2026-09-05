# Replacement-card mate checks use an en-passant right the move expires

- Severity: High
- Cards: Fanatic, Forced March, Onslaught, Long Jump, Dubbing, Squaring the Circle

## Rule citation

`rules.md` §11.1 forbids a regular card from directly creating checkmate and requires the board effect to fail while the card is spent. Sections 13.4 and 13.7–13.10 say these replacement moves expire or clear old en-passant availability and require direct mate to be tested on the complete result. Forced March likewise consumes the Regular Move, so an unclaimed right expires under §13.5 before its complete result is tested under §13.6.

## Expected

Black's legal neutral-Pawn double step `e2-e4` gives White an en-passant opportunity. White passes it up by playing Forced March instead of moving, so that right must be gone when the complete `f4-g4` result is checked. The march opens `Bd2-h6`; Black then has no legal reply. Forced March directly creates mate and must restore the Pawn, spend the card, and record `cardFizzled/DIRECT_MATE`.

## Actual

The reducer records `cardPlayed`, then clears `enPassant`. Ending the turn declares White the winner by checkmate. Thus the card is committed because the mate probe counted `d4xe3 e.p.`, even though the committed replacement result has already expired that move.

Removing the old right immediately before the same card dispatch changes only the result from `cardPlayed` to `cardFizzled/DIRECT_MATE`.

## Minimal reproduction

Run from the repository root with `node --import tsx --input-type=module repro.mjs` after saving:

```ts
import assert from 'node:assert/strict';
import { applyAction } from './src/game/reducer.ts';
import { createGameState } from './src/game/state.ts';

const applied = (state, action) => {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  return result.state;
};

let state = createGameState({
  fen: '5N2/8/5K1k/8/3p1P2/6N1/3BP3/8 b - - 0 1',
  hands: { white: ['forced-march'], black: [] },
});
state.pieces.find(piece => piece.square === 'e2').neutral = true;

state = applied(state, { type: 'move', from: 'e2', to: 'e4' });
state = applied(state, { type: 'endTurn' });
assert.deepEqual(state.enPassant, [{ target: 'e3', pawnId: 'white-pawn-e2' }]);

const action = {
  type: 'playCard',
  cardId: 'forced-march',
  target: [{ from: 'f4', to: 'g4' }],
};
const withoutExpiredRight = applied({ ...state, enPassant: [] }, action);
assert.deepEqual(withoutExpiredRight.history.at(-1), {
  type: 'cardFizzled', cardId: 'forced-march', reason: 'DIRECT_MATE',
});

state = applied(state, action);
assert.equal(state.history.at(-1).type, 'cardPlayed');
assert.deepEqual(state.enPassant, []);
state = applied(state, { type: 'endTurn' });
assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
```

Observed differential:

```text
live old right: cardPlayed; final enPassant: []; endTurn: white/checkmate
right cleared before mate probe: cardFizzled/DIRECT_MATE
```

The same differential was reproduced directly for all six named cards: the old-right case records `cardPlayed`, the otherwise identical no-right case records `cardFizzled/DIRECT_MATE`, and every committed result has `enPassant: []`.

## Likely root

`src/game/reducer.ts:668`, `742`, `874`, `924`, `971`, and `1030` call `isOrdinaryCheckmate` on a staged clone that still contains the old `state.enPassant`. Only afterward do their success paths call `completeReplacementMove`, whose lines 531–549 replace `state.enPassant` with the final value. Annexation does not have this ordering error: lines 812–816 complete a separate clone before testing mate.
