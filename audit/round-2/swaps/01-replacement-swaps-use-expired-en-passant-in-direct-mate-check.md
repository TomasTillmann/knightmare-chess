# Replacement swaps use an expired en-passant reply when judging direct mate

- Severity: High
- Cards: Evangelists, Tournament, Lost Castle
- Authoritative checkout HEAD: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the pre-existing working-tree changes

## Rule citation

`rules.md` §11.5 says a regular card must fail when the card itself creates board-state checkmate. Section 20 says Evangelists is a replacement move whose successful result clears any old en-passant opportunity; Tournament and Lost Castle use the same replacement-move procedure.

## Expected

Evangelists must evaluate the completed replacement state after the old `e6` en-passant opportunity expires. Swapping the White Bishop from `h2` to `a2` then gives the Black King on `g8` checkmate, so the card must fizzle as `DIRECT_MATE`, restore both Bishops, and still be spent.

## Actual

The direct-mate test sees the old en-passant opportunity before Evangelists clears it. It treats the neutral White Pawn's `f5-e6` en-passant move as a Black defense, records `cardPlayed`, then clears en passant. `endTurn` immediately declares White the winner by checkmate in the resulting position. The card has therefore directly created the mate that §11.5 forbids.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module <<'TS'
import assert from 'node:assert/strict';
import { applyAction } from './src/game/reducer.ts';
import { createGameState } from './src/game/state.ts';

let state = createGameState({
  fen: '6k1/4p3/5BKB/5P2/8/8/b6B/8 b - - 0 1',
  hands: { white: ['evangelists'], black: [] },
});
state.pieces.find(piece => piece.square === 'f5').neutral = true;

const apply = action => {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  state = result.state;
};

apply({ type: 'move', from: 'e7', to: 'e5' });
apply({ type: 'endTurn' });
assert.deepEqual(state.enPassant.map(right => right.target), ['e6']);

apply({
  type: 'playCard',
  cardId: 'evangelists',
  target: { own: 'h2', opponent: 'a2' },
});
assert.equal(state.history.at(-1).type, 'cardPlayed');
assert.deepEqual(state.enPassant, []);

apply({ type: 'endTurn' });
assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
console.log(state.history.at(-1), state.outcome);
TS
```

## Evidence

Observed output:

```text
{ type: 'cardPlayed', cardId: 'evangelists', target: { own: 'h2', opponent: 'a2' } }
{ winner: 'white', reason: 'checkmate' }
```

In the manually staged post-swap position, `legalDests(..., false)` returns only `f5-e6` while the old opportunity is present and returns no moves after it is removed. Running the same Evangelists action from an otherwise identical pre-card state with `enPassant: []` records `cardFizzled/DIRECT_MATE`.

## Likely root

`src/game/reducer.ts:1233-1246` swaps and serializes the pieces, performs `isOrdinaryCheckmate(resolved, defender)` at line 1239, and only afterward calls `completeReplacementMove` at line 1246. The latter is the operation that clears `state.enPassant`. All three replacement swaps share this ordering.
