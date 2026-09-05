# An ordinary Coup Prince move erases the actual royal's castling state

- Severity: Medium
- Area: Coup identity, ordinary moves, castling and FEN history
- Current checkout: frozen shared checkout with the pre-existing uncommitted fixes

## Rule citation

`rules.md` §15.3 transfers King status from the original King to the marked replacement; the original becomes a capturable Prince. Section 23 makes King/Prince identity and castling availability independently relevant state. The card-specific rulings in §13.9 and §13.10 likewise revoke rights when the physical **royal** moves, not when an unrelated piece merely has King movement geometry.

## Expected

With `e1.royal = false` and the Pawn on `b2` marked as the new King, the Prince's ordinary one-square move `e1-e2` must not change the actual royal's untouched `KQ` castling state.

## Actual

The legal Prince move succeeds but changes the FEN castling field from `KQ` to `-`. As a control, moving the same non-royal Prince with Dubbing preserves the equivalent `HA` rights, showing that the identity-aware replacement-move path and the ordinary chessops path disagree.

## Minimal reproduction and control

Run from the repository root:

```sh
node --import tsx --input-type=module -e '
import assert from "node:assert/strict";
import { createGameState } from "./src/game/state.ts";
import { applyAction } from "./src/game/reducer.ts";

const make = () => {
  const state = createGameState({
    fen: "4k3/8/8/8/8/8/1P6/R3K2R w KQ - 7 4",
    hands: { white: ["dubbing"], black: [] },
  });
  state.pieces.find(piece => piece.square === "e1").royal = false;
  state.pieces.find(piece => piece.square === "b2").royal = true;
  return state;
};

const ordinary = applyAction(make(), {
  type: "move",
  from: "e1",
  to: "e2",
});
assert(ordinary.ok);
assert.equal(ordinary.state.fen.split(" ")[2], "-");

const dubbingControl = applyAction(make(), {
  type: "playCard",
  cardId: "dubbing",
  target: [{ from: "e1", to: "c2" }],
});
assert(dubbingControl.ok);
assert.notEqual(dubbingControl.state.fen.split(" ")[2], "-");
'
```

## Evidence and likely root

Observed castling fields:

```text
ordinary Prince e1-e2: -
Dubbing Prince e1-c2:  HA
```

`position.play(move)` at `src/game/reducer.ts:1625` clears castling because chessops keys that side effect to `role === 'king'`. The identity-aware `revokeCastlingRights` call that follows can remove rights for the true royal but cannot restore rights already erased by chessops for the non-royal Prince.
