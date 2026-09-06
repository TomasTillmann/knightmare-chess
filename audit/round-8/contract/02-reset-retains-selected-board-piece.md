# Reset retains Chessground's selected source and destination actions

- Severity: Medium
- Area: Reset, Chessground selection synchronization, fresh-game integrity
- Audited state: current post-round-7 shared checkout; `src/` and tests remained read-only

## Contract and expected behavior

Reset replaces the current game and all in-progress UI interaction with a fresh initial state. A piece selected before Reset must not remain selected afterward, and a destination click in the new game must not complete an action that began in the discarded UI state.

## Actual behavior

Selecting the White Knight on `b1` shows its normal destination markers. Pressing **Reset** rebuilds the reducer state, but Chessground keeps `b1` selected and keeps the `a3`/`c3` destinations visible. Clicking `a3` immediately moves the Knight in the fresh game, without selecting a source after Reset.

This is more than a stale decoration: the pre-Reset interaction executes a successful post-Reset move.

## Automated Chrome reproduction

From the initial page:

1. Click `b1` once to select the Knight.
2. Confirm one `square.selected` at `b1` and two `square.move-dest` markers.
3. Press **Reset**.
4. Confirm the same selection and destination markers are still present.
5. Click `a3` once.

The headless Google Chrome probe observed:

```text
before Reset: selected b1 = true, destinations = 2
after Reset:  selected b1 = true, destinations = 2
after a3:     white Knight on a3 = true
status:       Move complete. You may play a card or end the turn.
```

The same root can retain a pointer selection across other React-driven state transitions that do not enter card-targeting mode.

## Root hint

`src/App.tsx` correctly clears its React selection fields in `reset()`, but Chessground owns a separate selected-square state. `src/ChessBoard.tsx` calls `ground.selectSquare(selectedTarget ?? null)` only while `targeting` is true. Ordinary state replacement and Reset update FEN/destinations without ever clearing Chessground's selected source. The board synchronization path needs to clear that native selection when the authoritative interaction has no selected square.
