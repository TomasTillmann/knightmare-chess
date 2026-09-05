# A retained castling right can be used by the wrong physical Rook

- Severity: High
- Area: physical identity, castling, card-relocated Rooks
- Audited state: frozen shared checkout; production and tests were not changed

## Rule basis

`rules.md` §10 attaches persistent state to physical-piece identity rather than merely to a square. Sections 13.9 and 13.10 make castling revocation depend on the moved physical royal/Rook, and §23 makes castling availability legally relevant state. The already-fixed castling behavior consequently keeps White's queenside right attached to the original `a1` Rook when Cathedral swaps that Rook to `b2`.

That retained queenside right cannot later be exercised by a different physical Rook merely because that other Rook reaches `a1`. Squaring the Circle moving the original `h1` Rook revokes its own kingside right; it does not transfer the still-retained `a1` Rook's queenside right to the `h1` Rook.

## Reproduction

Run from the repository root:

```ts
import assert from 'node:assert/strict';
import { applyAction, legalDests } from '../../../src/game/reducer.js';
import { createGameState } from '../../../src/game/state.js';

let state = createGameState({
  fen: 'r3k2r/4p3/8/8/8/8/1BP5/R3K2R w KQkq - 0 1',
  hands: {
    white: ['cathedral', 'dubbing', 'squaring-the-circle'],
    black: [],
  },
});

const play = (action: Parameters<typeof applyAction>[1]) => {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  state = result.state;
};

play({ type: 'move', from: 'c2', to: 'c3' });
play({
  type: 'playCard', cardId: 'cathedral',
  target: { rook: 'a1', bishop: 'b2' },
});
play({ type: 'endTurn' });
play({ type: 'move', from: 'e7', to: 'e6' });
play({ type: 'endTurn' });
play({
  type: 'playCard', cardId: 'dubbing',
  target: [{ from: 'a1', to: 'c2' }],
});
play({ type: 'endTurn' });
play({ type: 'move', from: 'e6', to: 'e5' });
play({ type: 'endTurn' });
play({
  type: 'playCard', cardId: 'squaring-the-circle',
  target: [{ from: 'h1', to: 'a1' }],
});
play({ type: 'endTurn' });
play({ type: 'move', from: 'e5', to: 'e4' });
play({ type: 'endTurn' });

assert.equal(state.fen.split(' ')[2], 'Qkq');
assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'b2');
assert.equal(state.pieces.find(piece => piece.id === 'white-rook-h1')?.square, 'a1');

assert.equal(legalDests(state).get('e1')?.includes('c1'), true);
const castle = applyAction(state, { type: 'move', from: 'e1', to: 'c1' });
assert(castle.ok);
assert.equal(
  castle.state.pieces.find(piece => piece.id === 'white-rook-h1')?.square,
  'd1',
);
```

All actions in the setup are public, reducer-accepted actions. Immediately before castling, `Q` belongs to `white-rook-a1` on `b2`, while `a1` is occupied by `white-rook-h1`, whose `K` right was revoked when Squaring moved it. The engine nevertheless lists and accepts queenside castling and moves the wrong Rook to `d1`.

The registered-Rook alias `e1-a1` has the same result; this is not the round-four arbitrary-destination bug because both `c1` and `a1` are otherwise valid queenside-castling input forms.

## Expected

Queenside castling is unavailable until the physical `white-rook-a1` that owns the retained right is again in the required castling position. The unrelated `white-rook-h1` on `a1` must not satisfy that right.

## Actual

`legalDests` advertises `e1-c1`, `applyAction` accepts it, and the engine castles with `white-rook-h1`, moving that physical piece from `a1` to `d1` while `white-rook-a1` remains on `b2`.

## Root hint

`positionFor` reconstructs `Castles` from the FEN right and the current role/color occupant of `a1`. That projection loses the physical `PieceState.id` to which the retained right belongs. The castling path in `movePiece` then locates a Rook by square and current role only, so any same-color Rook can consume another Rook's retained right.
