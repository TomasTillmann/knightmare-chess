# A retained castling right can be used by the wrong physical Rook

- Severity: High
- Area: castling identity, swap cards, legal destinations, history
- Audited state: frozen shared checkout; `src/` and `tests/` remained read-only

## Rule basis and expected behavior

`rules.md` §10 attaches persistent state to the physical piece rather than merely its square. Sections 13.9, 13.10, and 23 likewise make the physical Rook identity and castling availability legally relevant. The round-three ruling intentionally preserves an `a1` Rook's castling right while an after-move swap places that physical Rook off its home square, so the right can become usable again only when that same eligible Rook returns.

A different Rook occupying `a1` is not the unmoved physical Rook to which the retained right belongs and cannot be used for queenside castling.

## Actual behavior

After two legal Cathedral swaps, the original `white-rook-a1` is on `b2` while `white-rook-h1` occupies `a1`. The retained queenside right is then exposed as both `e1-c1` and its Chessground Rook alias. The reducer accepts `e1-c1`, moves the wrong physical Rook from `a1` to `d1`, and leaves the eligible `white-rook-a1` untouched on `b2`.

## Reachable reproduction

Run from the repository root:

```ts
import assert from 'node:assert/strict';
import { createGameState } from './src/game/state.ts';
import { applyAction, legalDests } from './src/game/reducer.ts';

let state = createGameState({
  fen: '4k3/pp6/8/8/8/8/1BPP4/R3K2R w Q - 0 1',
  hands: { white: ['cathedral', 'cathedral'], black: [] },
});
const apply = (action: Parameters<typeof applyAction>[1]) => {
  const result = applyAction(state, action);
  assert(result.ok, result.ok ? undefined : result.error.message);
  state = result.state;
};

apply({ type: 'move', from: 'c2', to: 'c3' });
apply({
  type: 'playCard', cardId: 'cathedral',
  cardInstanceId: state.players.white.hand[0].id,
  target: { rook: 'a1', bishop: 'b2' },
});
apply({ type: 'endTurn' });
apply({ type: 'move', from: 'a7', to: 'a6' });
apply({ type: 'endTurn' });
apply({ type: 'move', from: 'd2', to: 'd3' });
apply({
  type: 'playCard', cardId: 'cathedral',
  target: { rook: 'h1', bishop: 'a1' },
});
apply({ type: 'endTurn' });
apply({ type: 'move', from: 'b7', to: 'b6' });
apply({ type: 'endTurn' });

assert.equal(state.pieces.find(p => p.id === 'white-rook-a1')?.square, 'b2');
assert.equal(state.pieces.find(p => p.id === 'white-rook-h1')?.square, 'a1');
assert.equal(legalDests(state).get('e1')?.includes('c1'), true);

apply({ type: 'move', from: 'e1', to: 'c1' });
assert.equal(state.pieces.find(p => p.id === 'white-rook-a1')?.square, 'b2');
assert.equal(state.pieces.find(p => p.id === 'white-rook-h1')?.square, 'd1');
assert.deepEqual(state.history.at(-1), { type: 'move', from: 'e1', to: 'c1' });
```

## Expected versus actual

- Expected: `legalDests` omits `c1`, and direct `applyAction(e1-c1)` rejects atomically until `white-rook-a1` itself returns to `a1`.
- Actual: both discovery and execution accept the castle and move `white-rook-h1` as its Rook.

## Root hint

`positionFor` and the castling branch in `movePiece` reconstruct castling eligibility from the FEN right plus a current-role Rook on the home square. They never verify that the home-square piece's physical ID corresponds to the retained right's original square. The identity check belongs in the shared castling candidate/execution path so both `legalDests` and direct actions agree.
