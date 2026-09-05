# Swapping the en-passant victim away leaves a stale public opportunity

- Severity: Low
- Cards: Holy War (same after-move path is shared by Anathema, Cathedral, Siege, Holy Quest, and Treason)
- Authoritative checkout HEAD: `29ae7f671f1ce6e636b2112dd4f19ec19198677c` plus the pre-existing working-tree changes

## Rule citation

`rules.md` §13.1 limits en passant to ordinary timing and geometry. Section 20 allows Holy War to select a transformed original Bishop by its original identity and says the physical piece is exchanged simultaneously without capture.

## Expected

When an original Bishop currently acting as a Pawn double-steps `c2-c4` and Holy War then swaps that physical piece to `b1`, it is no longer behind the `c3` en-passant target. The serialized FEN, public `enPassant` collection, and generated legal destinations should agree that no en-passant opportunity remains geometrically possible.

## Actual

The FEN correctly changes its en-passant field to `-`, and Black receives no `c3` capture destination, but `state.enPassant` still advertises `{ target: 'c3', pawnId: 'white-bishop-c2' }` after the swap and after `endTurn`. The advertised victim is now on `b1`.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module <<'TS'
import assert from 'node:assert/strict';
import { applyAction, legalDests } from './src/game/reducer.ts';
import { createGameState } from './src/game/state.ts';

let state = createGameState({
  fen: '7k/8/8/8/8/8/2P5/1N2K3 w - - 0 1',
  hands: { white: ['holy-war'], black: [] },
});
const transformed = state.pieces.find(piece => piece.square === 'c2');
transformed.id = 'white-bishop-c2';
transformed.originalRole = 'bishop';

for (const action of [
  { type: 'move', from: 'c2', to: 'c4' },
  { type: 'playCard', cardId: 'holy-war', target: { knight: 'b1', bishop: 'c4' } },
  { type: 'endTurn' },
]) {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  state = result.state;
}

assert.equal(state.fen.split(' ')[3], '-');
assert.deepEqual(state.enPassant, [
  { target: 'c3', pawnId: 'white-bishop-c2' },
]);
assert.equal(state.pieces.find(piece => piece.id === 'white-bishop-c2').square, 'b1');
assert.equal([...legalDests(state).values()].flat().includes('c3'), false);
console.log(state.fen.split(' ')[3], state.enPassant);
TS
```

## Evidence

Observed output:

```text
- [ { target: 'c3', pawnId: 'white-bishop-c2' } ]
```

The reducer's FEN validator and legal-move path both reject the stale geometry, while the public state continues to expose it as an `EnPassantOpportunity`.

## Likely root

`setupFor` at `src/game/reducer.ts:50-75` sanitizes the local FEN setup when the recorded victim is no longer behind the target. `syncFen` at lines 377-381 writes that sanitized FEN but does not update `state.enPassant`. After-move swaps call only `syncFen` at line 1236, so the two public representations diverge.
