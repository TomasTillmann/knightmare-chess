# `legalDests` omits a destination-check castle that the reducer accepts

- Severity: High
- Area: Castling, same-turn rescue, public move discovery

## Rule citation

`rules.md` §11.6 permits a Regular Move to place or leave the acting King in check when a card on that same turn removes the check. The origin and transit restrictions of castling still apply, but a destination-only check may enter the pending-rescue transaction, as established by the round-three castling ruling.

## Expected

White starts safe on `e1` and crosses safe `f1`. The destination `g1` is attacked only by the Black Pawn on `h2`; Cowardice can immediately move that Pawn backward to `h3`, removing the check. The reducer now correctly accepts `e1-g1` and creates `pendingRescue`, so the public destination map must also include `g1`.

## Actual

Direct `applyAction` accepts the castle, moves the Rook to `f1`, and sets `pendingRescue`. `legalDests(state).get('e1')` nevertheless contains only ordinary one-square King moves and omits `g1`. Since the board and keyboard controls are driven by this map, the repaired legal sequence remains inaccessible through normal move discovery.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e '
import assert from "node:assert/strict";
import { createGameState } from "./src/game/state.ts";
import { applyAction, legalDests } from "./src/game/reducer.ts";

const state = createGameState({
  fen: "4k3/8/8/8/8/8/7p/4K2R w K - 0 1",
  hands: { white: ["cowardice"], black: [] },
});

assert.equal(legalDests(state).get("e1")?.includes("g1") ?? false, false);
const result = applyAction(state, { type: "move", from: "e1", to: "g1" });
assert(result.ok);
assert(result.state.pendingRescue);
assert.equal(result.state.pieces.find(piece => piece.square === "f1")?.role, "rook");
'
```

Observed destination map:

```text
e1: d1 f1 d2 e2 f2
```

## Likely root

`movePiece` has a manual pseudo-castling path that can now pass the final position through `finishRegularMove`. `legalDests`, however, seeds candidates from `chessgroundDests` and `pseudoDests`; both omit a castle whose destination is currently attacked. Its final legality filter can validate only candidates already present, so it never asks `movePiece` about `g1`.
