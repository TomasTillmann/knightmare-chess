# Canceling the promotion dialog forces a Queen promotion

- Severity: Medium
- Area: board and keyboard UI, promotion choice

## Rule basis and expected behavior

`rules.md` §13.2 requires the player to choose Queen, Rook, Bishop, or Knight when a Regular Pawn move reaches its last line. Dismissing the browser's choice dialog supplies no choice, so the pending move must be canceled and the Pawn must remain on its source square.

## Actual behavior

Both the board and keyboard move controls treat a dismissed dialog as the string `queen`. Canceling a rotated White promotion `g4-h4` therefore completes the move, replaces the Pawn with a Queen on `h4`, and announces `Move complete`.

This was confirmed in headless Chrome against a seeded orientation-`90` state. After dismissing the dialog, the board contained `piece.white.queen` on `h4` and the reducer-backed status said `Move complete. You may play a card or end the turn.`

## Reproduction

Seed the mounted app with:

```ts
const state = createGameState({
  fen: 'k7/8/8/8/6P1/8/8/K7 w - - 0 1',
  hands: { white: [], black: [] },
});
state.orientation = 90;
```

Then:

1. Drag `g4` to `h4`, or choose the same move in Keyboard controls.
2. Press **Cancel** in the promotion dialog.
3. Observe a White Queen on `h4`, the after-move phase, and an enabled End-turn button.

Entering an invalid role such as `banana` is rejected and leaves the Pawn in place, confirming that the forced Queen is specific to dismissal rather than a general browser fallback.

## Likely root

`src/App.tsx:339-341` uses:

```ts
window.prompt(..., 'queen') ?? 'queen'
```

The null returned by **Cancel** is deliberately converted into `queen`, so the reducer never receives a cancellation.
