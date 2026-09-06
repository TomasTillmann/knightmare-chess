# Card movement highlights discard or revive the wrong transition

- Severity: Medium
- Area: Chessground `lastMove`, card movement, sequential history
- Audited state: current post-round-7 shared checkout; `src/` and tests remained read-only

## Contract and expected behavior

`rules.md` §8.2 makes a replacement card the move for its turn, while §20 defines the swaps and simultaneous multi-piece relocations as real board movement. The state-driven board marker introduced after the round-6 and round-7 audits must therefore describe the newest committed movement transition. If a transition cannot be represented faithfully, clearing the marker is accurate; retaining an unrelated older move is not.

For a two-piece simultaneous move, showing only one arbitrarily selected component also misstates which squares changed together.

## Actual behavior

The history-to-highlight projection recognizes an ordinary `move`, or only the final entry of a `cardPlayed` array. It ignores swap-object targets and Fanatic's string target, then continues searching into older history.

Two headless Google Chrome controls confirmed the resulting visible mismatches:

1. White moved `e2-e4`, then Holy War swapped `b1` and `c1`. After the successful swap and the status `Holy War swapped b1 and c1.`, the board still highlighted `e2` and `e4`.
2. White used Annexation to move `a2-a4` and `b2-b4` simultaneously. The board highlighted only `b2` and `b4`; `a2` and `a4` were omitted even though both moves are one atomic card transition.

Observed output:

```text
after regular:      e4, e2
after Holy War:     e4, e2
after Annexation:   b4, b2
```

## Reproduction

From the initial UI:

1. Drag `e2` to `e4`.
2. Select Holy War and choose `b1`, then `c1`.
3. Inspect `square.last-move`: it still occupies `e2` and `e4` although the pieces on `b1` and `c1` just exchanged places.
4. Reset, select Annexation, stage `a2-a4` and `b2-b4`, and play it.
5. Inspect `square.last-move`: only `b2` and `b4` are marked.

Both cards resolved successfully and their reducer histories were authoritative; only the board projection was wrong.

## Root hint

`src/ChessBoard.tsx` reverse-scans history with:

```ts
event.type === 'move'
  ? [{ from: event.from, to: event.to }]
  : event.type === 'cardPlayed' && Array.isArray(event.target)
    ? event.target.slice(-1)
    : []
```

The `slice(-1)` intentionally loses simultaneous moves, while object/string movement events are treated like non-movement cards and allow an older move to resurface. The projection needs to classify the latest card event by card movement semantics and either represent all changed squares or clear the marker.
