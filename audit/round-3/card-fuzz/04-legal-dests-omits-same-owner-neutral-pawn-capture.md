# `legalDests` omits a same-owner neutral Pawn capture accepted by the reducer

- Severity: Medium
- Area: Neutrality, ordinary Pawn capture, No Quarter, public reducer API
- Current checkout: frozen shared checkout with the pre-existing uncommitted fixes

## Rule citation

`rules.md` §15.1 makes a neutral piece available to either side and valid for friendly- or enemy-piece effects. Section 22.9 lets No Quarter bind to the exact neutral identity captured by the preceding Regular Move. Independently of interpretation, the exported public APIs must agree on whether the same proposed Regular Move is legal.

## Expected

If direct `applyAction` accepts White's `d4xe5` capture of the White-origin neutral Knight, `legalDests(state).get('d4')` must include `e5`. This is the destination map used to expose legal Regular Moves.

## Actual

`legalDests` lists only `d5`, but direct `applyAction` accepts `d4xe5`, records `white-knight-e5` as captured, and then accepts No Quarter to make that exact neutral piece dead.

Controls isolate the owner/neutral combination:

- the same White-origin non-neutral target is omitted and rejected;
- a Black-origin neutral target on `e5` is both listed and accepted.

## Minimal reproduction and controls

Run from the repository root:

```sh
node --import tsx --input-type=module -e '
import assert from "node:assert/strict";
import { createGameState } from "./src/game/state.ts";
import { applyAction, legalDests } from "./src/game/reducer.ts";

const state = createGameState({
  fen: "7k/8/8/4N3/3P4/8/8/K7 w - - 0 1",
  hands: { white: ["no-quarter"], black: [] },
});
state.pieces.find(piece => piece.square === "e5").neutral = true;

assert.equal(legalDests(state).get("d4")?.includes("e5") ?? false, false);

const capture = applyAction(state, {
  type: "move",
  from: "d4",
  to: "e5",
});
assert(capture.ok);
assert.equal(capture.state.history.at(-1)?.capturedId, "white-knight-e5");

const noQuarter = applyAction(capture.state, {
  type: "playCard",
  cardId: "no-quarter",
});
assert(noQuarter.ok);
assert.equal(
  noQuarter.state.pieces.find(piece => piece.id === "white-knight-e5")?.zone,
  "dead",
);

const opponentOwned = createGameState({
  fen: "7k/8/8/4n3/3P4/8/8/K7 w - - 0 1",
});
opponentOwned.pieces.find(piece => piece.square === "e5").neutral = true;
assert.equal(legalDests(opponentOwned).get("d4")?.includes("e5"), true);
assert.equal(
  applyAction(opponentOwned, { type: "move", from: "d4", to: "e5" }).ok,
  true,
);
'
```

## Evidence and likely root

Observed results:

```text
same-owner neutral:    listed=false, moved=true,  No Quarter=true
same-owner nonneutral: listed=false, moved=false
opponent-owned neutral: listed=true, moved=true
```

The direct Pawn path explicitly accepts `target.neutral` at `src/game/reducer.ts:1525-1527`. `legalDests` begins with chessops destinations at `src/game/reducer.ts:107-119`, where the same-origin target is still friendly, then skips brute-force destination discovery for a non-neutral orientation-0 Pawn at `src/game/reducer.ts:153-166`. Filtering can validate a destination already present, but it never discovers `e5` in this case.
