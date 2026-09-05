# Disintegration leaves an en-passant opportunity pointing to a dead Pawn

- Severity: Medium
- Card: Disintegration

## Rule citation

`rules.md` §5 defines a dead piece as set aside, while §13.1 describes en passant as the timed capture of the Pawn that made the two-square move. Section 23 treats en-passant availability as legally relevant state. A dead, off-board Pawn cannot remain an available en-passant victim.

## Expected

After White moves `e2-e4` and then Disintegrates that same Pawn, the Pawn is dead and absent from the board. Its `e3` en-passant opportunity must be removed. The public `GameState.enPassant`, serialized FEN, and `positionFor` view should agree that no capture is available.

## Actual

The FEN and `positionFor` correctly expose no en-passant square, but `GameState.enPassant` retains `{ target: 'e3', pawnId: 'white-pawn-e2' }` through `endTurn`; that ID now resolves to a dead piece with `square: null`.

## Minimal reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, positionFor } from './src/game/reducer.ts';
import { createGameState } from './src/game/state.ts';

const applied = (state, action) => {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  return result.state;
};

let state = createGameState({
  fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
  hands: { white: ['disintegration'], black: [] },
});
state = applied(state, { type: 'move', from: 'e2', to: 'e4' });
state = applied(state, {
  type: 'playCard', cardId: 'disintegration', target: 'e4',
});
state = applied(state, { type: 'endTurn' });

assert.equal(state.fen.split(' ')[3], '-');
assert.equal(positionFor(state).epSquare, undefined);
assert.deepEqual(state.enPassant, [
  { target: 'e3', pawnId: 'white-pawn-e2' },
]);
assert.deepEqual(
  (({ square, zone }) => ({ square, zone }))(
    state.pieces.find(piece => piece.id === 'white-pawn-e2'),
  ),
  { square: null, zone: 'dead' },
);
```

Observed state:

```text
fen:         7k/8/8/8/8/8/8/7K b - - 0 1
enPassant:   [{ target: 'e3', pawnId: 'white-pawn-e2' }]
victim:      { square: null, zone: 'dead' }
position.ep: undefined
```

## Likely root

`src/game/reducer.ts:601–605` moves the Pawn to the dead zone and synchronizes FEN, but never removes opportunities whose `pawnId` is the dead piece. `syncFen` sanitizes only the serialized setup; it does not update `GameState.enPassant`.
