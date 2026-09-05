# Coup check highlighting marks the old Prince instead of the replacement royal

- Severity: Medium
- Cards: Coup interaction with the board check indicator

## Rule and expected result

`rules.md` §15.3 makes the original King a capturable Prince and transfers King status to the marked replacement piece. Check and checkmate apply to that marked `royal` piece, so the check indicator must mark its square rather than the old role-King square.

## Actual result

The reducer's exported `isKingInCheck` correctly detects that the replacement royal Pawn on `a2` is attacked. `ChessBoard` then reduces that result to the color `white` and passes it to Chessground. Chessground highlights the White piece whose ordinary role is `king`, so the visible check square is `e1`, occupied by the non-royal Prince. The actual royal on `a2` receives no highlight.

## Reproduction and control

Seed the mounted app with:

```ts
const state = createGameState({
  fen: 'r7/8/8/8/8/8/P7/4K2k w - - 0 1',
});
state.pieces.find(piece => piece.square === 'e1')!.royal = false;
state.pieces.find(piece => piece.square === 'a2')!.royal = true;
```

The Black Rook on `a8` attacks the replacement royal on `a2`; the Prince on `e1` is not attacked. The controls confirm the authoritative result:

```ts
assert.equal(isKingInCheck(state, 'white'), true);
assert.equal(applyAction(state, { type: 'move', from: 'e1', to: 'e2' }).ok, false);
```

A headless Playwright square lookup observed exactly one `square.check`, at `e1`; `a2` was not marked.

The existing neutral Holy War browser regression still correctly highlights an ordinary role-King on `h8`, so this failure is specific to Coup's separation of `role === 'king'` from `royal === true`.

## Production location

`src/ChessBoard.tsx:28-42` calculates only the checked color and supplies Chessground's color-only `check` option. It never marks the square of the authoritative `PieceState.royal` piece.
