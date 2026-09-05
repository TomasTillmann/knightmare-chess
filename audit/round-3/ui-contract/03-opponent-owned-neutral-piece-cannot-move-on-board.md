# Opponent-owned neutral pieces cannot be selected on the board

- Severity: Medium
- Scope: Regular moves by neutral pieces

## Rule and expected result

`rules.md` §15.1 permits either player to move a neutral piece on that player's turn. A legal opponent-owned neutral piece should expose the same sources and destinations through the board and keyboard controls.

## Actual result

The exported `legalDests` helper and the keyboard control list moves for an opponent-owned neutral piece, but Chessground does not allow that piece to be selected or dragged. No destination markers appear and the board move does not fire.

The discrepancy depends only on stored ownership: the board config restricts movable pieces to `state.turn.color`, while the neutral piece is still rendered using its original owner color.

## Reproduction and control

Seed the mounted app with Black to move and make the White Rook neutral:

```ts
const state = createGameState({
  fen: '7k/8/8/8/8/8/8/R6K b - - 0 1',
});
state.pieces.find(piece => piece.square === 'a1')!.neutral = true;
```

Playwright observations:

```text
Click a1 on the board: 0 square.move-dest elements
Drag a1-a2: Rook remains on a1; no move event or status change
Keyboard Move-from options: includes a1
```

Public reducer control:

```ts
assert(legalDests(state).get('a1')?.includes('a2'));
assert.equal(applyAction(state, { type: 'move', from: 'a1', to: 'a2' }).ok, true);
```

This does not affect a neutral piece whose stored owner happens to match the acting color, which confirms the failure is the board ownership filter rather than move legality.

## Production location

`src/ChessBoard.tsx:43-51` passes `movable.color: state.turn.color` even though `legalDests(state)` can contain sources whose displayed/stored owner has the opposite color when `neutral` is true.
