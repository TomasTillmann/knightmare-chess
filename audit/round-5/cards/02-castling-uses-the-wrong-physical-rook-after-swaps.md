# Castling uses the wrong physical Rook after two swaps

- Severity: High
- Cards: Cathedral; interaction with ordinary castling and physical identity
- Audited state: current shared checkout; `src/` and `tests/` remained read-only

## Rule basis

`rules.md` §6 defines a swap as an exchange rather than an ordinary move, §10 carries state with the physical piece, and §20 says Cathedral preserves both physical identities. The castling rulings in §13.9–§13.10 and the existing audit fixes likewise attach each castling right to the eligible physical Rook. Moving the original `h1` Rook onto `a1` by swaps cannot make it the Rook authorized by the original `a1` right.

## Expected

After Cathedral first swaps the original `a1` Rook to `b2`, then swaps the original `h1` Rook onto `a1`, White must not be able to castle queenside. The physical Rook associated with that right remains on `b2`; the Rook on `a1` carries the other identity/right.

## Actual

`legalDests` lists `e1-c1`. The reducer accepts it, moves the King to `c1`, and moves `white-rook-h1` from `a1` to `d1`. The original `white-rook-a1` stays on `b2`. Castling availability is therefore being reassigned by current square rather than physical identity.

## Minimal reachable reproduction

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

let state = createGameState({
  fen: '4k3/6p1/8/8/8/8/1B4PP/R3K2R w KQ - 0 1',
  hands: { white: ['cathedral', 'cathedral'], black: [] },
});
const apply = (action: Parameters<typeof applyAction>[1]) => {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  state = result.state;
};

apply({ type: 'move', from: 'h2', to: 'h3' });
apply({ type: 'playCard', cardId: 'cathedral', target: { rook: 'a1', bishop: 'b2' } });
apply({ type: 'endTurn' });
apply({ type: 'move', from: 'g7', to: 'g6' });
apply({ type: 'endTurn' });
apply({ type: 'move', from: 'g2', to: 'g3' });
apply({ type: 'playCard', cardId: 'cathedral', target: { rook: 'h1', bishop: 'a1' } });
apply({ type: 'endTurn' });
apply({ type: 'move', from: 'g6', to: 'g5' });
apply({ type: 'endTurn' });

assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'b2');
assert.equal(state.pieces.find(piece => piece.id === 'white-rook-h1')?.square, 'a1');
assert.equal(legalDests(state).get('e1')?.includes('c1'), true);

apply({ type: 'move', from: 'e1', to: 'c1' });
assert.equal(state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'c1');
assert.equal(state.pieces.find(piece => piece.id === 'white-rook-h1')?.square, 'd1');
assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'b2');
```

## Likely root

The FEN castling bit is preserved by physical identity, but `positionFor` rebuilds `Castles` from the current board and those square bits. After the swaps, chessops associates the `a1` occupant with the queenside right even though it is `white-rook-h1`. `movePiece` then identifies and moves the castling Rook only by `rookFrom` square. The right's persisted identity and the Rook selected for execution are therefore disconnected.
