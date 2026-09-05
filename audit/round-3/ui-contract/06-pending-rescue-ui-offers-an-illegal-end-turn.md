# A pending rescue is presented as a completed move that may end the turn

- Severity: Medium
- Scope: Same-turn check rescue UI

## Rule and expected result

`rules.md` §11.6 permits a Regular Move to leave the acting King checked only conditionally: an eligible card on that same turn must remove the check before the turn ends. While `GameState.pendingRescue` is present, the UI should identify the required rescue and must not tell the player that the turn may end.

## Actual result

After the reducer conditionally stages such a move, the board correctly highlights the checked King and Cowardice remains playable. The surrounding turn UI nevertheless says `Move complete. You may play a card or end the turn.` and enables **End turn**.

Pressing **End turn** is then rejected with `Your King is still in check.`, but the button remains enabled and the false completion message is merely replaced by the error. The authoritative state never permitted the offered action.

## Reproduction and control

Seed the mounted app with:

```ts
const state = createGameState({
  fen: '4r2k/8/8/8/3p4/8/4B3/4K3 w - - 0 1',
  hands: { white: ['cowardice'], black: [] },
});
state.orientation = 90;
```

Drag `Be2-f3`. This temporarily opens the `e8-e1` Rook line, while Cowardice can still rescue by moving `d4-e4`. Playwright observed before pressing End turn:

```text
phase: after move
check highlights: 1
Cowardice enabled: true
End turn enabled: true
status: Move complete. You may play a card or end the turn.
```

After pressing End turn:

```text
alert: Your King is still in check.
phase: after move
End turn enabled: true
```

Reducer control confirms that the intended rescue succeeds and clears the obligation. A separate browser and reducer control also confirmed that playing a non-rescue card spends that card, rolls the conditional move back, restores all pieces/history, clears `pendingRescue`, and leaves a fresh Regular Move; that rollback lifecycle is not broken.

## Production location

`src/App.tsx:325-327` always emits the generic completed-move message, and `src/App.tsx:725-733` enables End turn from `turn.moveMade` alone. Neither condition considers `game.pendingRescue` or current royal check.
