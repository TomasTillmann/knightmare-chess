# `positionFor` returns a `Chess` object whose check API disagrees with itself

- Severity: Medium
- Scope: Exported public helper

## Expected public contract

`positionFor` publicly returns a mutable chessops `Chess` position. Its `isCheck`, `ctx`, `isCheckmate`, `isLegal`, `play`, and `clone` methods must describe the same returned position. Knightmare royal and neutral overrides must not make one method report a different position from the others.

## Actual result

`positionFor` replaces only the instance's `isCheck` method with a closure over the original `GameState` and the original requested color. The rest of the returned `Chess` API still uses its own mutable board, current turn, ordinary role-King, and owner colors.

Two confirmed failures follow:

1. After callers use the returned object's normal `play` method, `isCheck()` remains frozen to the original `GameState`. A standard Fool's Mate position reports `isCheck() === false` and `isCheckmate() === true` simultaneously.
2. In a static Coup state, `isCheck()` reports the replacement royal in check, while `ctx().checkers` is empty and `isLegal()` accepts a Prince move that the authoritative reducer rejects because it leaves the replacement royal checked.

## Minimal reproductions

```ts
const position = positionFor(createGameState());
for (const [from, to] of [
  ['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4'],
] as const) {
  position.play({ from: parseSquare(from), to: parseSquare(to) });
}
assert.equal(position.isCheckmate(), true);
assert.equal(position.ctx().checkers.size(), 1);
assert.equal(position.isCheck(), false); // frozen to the untouched initial GameState
```

```ts
const state = createGameState({
  fen: 'r7/8/8/8/8/8/P7/4K2k w - - 0 1',
});
state.pieces.find(piece => piece.square === 'e1')!.royal = false;
state.pieces.find(piece => piece.square === 'a2')!.royal = true;

const position = positionFor(state, 'white');
assert.equal(position.isCheck(), true);
assert.equal(position.ctx().checkers.isEmpty(), true);
assert.equal(position.isLegal({ from: parseSquare('e1'), to: parseSquare('e2') }), true);
assert.equal(applyAction(state, { type: 'move', from: 'e1', to: 'e2' }).ok, false);
assert.equal(position.clone().isCheck(), false);
```

The standalone exported `isKingInCheck(state, color)` agrees with reducer legality in these controls; the failure is the hybrid `Chess` object returned by `positionFor`.

## Production location

`src/game/reducer.ts:92-95` assigns `position.isCheck = () => isKingInCheck(state, turn)` without adapting any other `Chess` method or preserving the override through `clone()`/`play()`.
