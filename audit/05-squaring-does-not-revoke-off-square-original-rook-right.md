# Squaring the Circle fails to revoke a castling right for an original Rook moved off its start square

- **Severity:** Medium
- **Cards:** Cathedral → Tournament → Squaring the Circle
- **Frozen commit:** `391f94ba8e7145072fd41dd1799c612764b539b8`

## Expected

`rules.md` §13.10 explicitly says moving a current or original Rook with Squaring the Circle revokes the castling right associated with its starting square. Cathedral first swaps the original `a1` Rook to `b2` without changing its identity or the retained `A` castling right. When Squaring later moves that same physical Rook from `b2` to `h1`, White's `A` right must be removed.

## Actual

The successful Squaring play leaves `A` in FEN: `... b Akq - 2 2`. Castling revocation removes the move's current `from` square (`b2`) rather than the original Rook's castling-start square (`a1`), so the retained right survives.

## Minimal reproduction

Save as `scratch/off-square-rook.ts` and run `npx tsx scratch/off-square-rook.ts`:

```ts
import { applyAction } from '../src/game/reducer.js';
import { createGameState } from '../src/game/state.js';

let state = createGameState({
  fen: 'r3k2r/3n4/8/8/8/2N5/1B2P3/R3K3 w Qkq - 0 1',
  hands: { white: ['cathedral', 'squaring-the-circle'], black: ['tournament'] },
});
const act = (action: Parameters<typeof applyAction>[1]) => {
  const result = applyAction(state, action);
  if (!result.ok) throw result.error;
  state = result.state;
};

act({ type: 'move', from: 'e2', to: 'e3' });
act({ type: 'playCard', cardId: 'cathedral', target: { rook: 'a1', bishop: 'b2' } });
act({ type: 'endTurn' });
act({ type: 'playCard', cardId: 'tournament', target: { own: 'd7', opponent: 'c3' } });
act({ type: 'endTurn' });
console.log(state.pieces.find(p => p.id === 'white-rook-a1'));
act({ type: 'playCard', cardId: 'squaring-the-circle', target: [{ from: 'b2', to: 'h1' }] });
console.log(state.history.at(-1), state.fen);
```

## Evidence

```text
{ id: 'white-rook-a1', originalRole: 'rook', square: 'b2', ... }
{ type: 'cardPlayed', cardId: 'squaring-the-circle', ... }
r3k2r/3N4/8/8/8/2n1P3/8/B3K2R b Akq - 2 2
```

## Likely production location

- `src/game/reducer.ts:390-402`: `completeReplacementMove()` revokes a Rook right with `castlingRights.without(parseSquare(castlingMove.from))`.
- `src/game/reducer.ts:900-906`: Squaring passes only the current `from` square and piece; it does not resolve which retained castling-start right belongs to that original physical Rook.
