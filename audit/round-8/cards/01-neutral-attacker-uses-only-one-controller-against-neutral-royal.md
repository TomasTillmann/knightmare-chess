# A neutral attacker is tested under only one controller against a neutral royal

- Severity: High
- Area: Neutrality, royal safety, replacement/after-move cards
- Audited state: `2f0e4082eb991d8efbffe374100439ba4ad675e2` plus the current post-round-7 fixes

## Rule basis

`rules.md` §6 defines a threat as a capture the piece can legally make. Section 15.1 says a neutral piece may be moved by either player, may capture either color, and may check either King. The established neutral-royal ruling also makes a neutral royal capturable/threatened by pieces of either stored owner. Long Jump §13.8 requires a selected royal's destination to be safe.

When both the attacker and royal are neutral, the attack is therefore real if **either** player can legally control the attacker for the capture. A pin affecting one possible controller does not erase a legal capture available to the other controller.

## Expected

White uses Long Jump to move the Black-origin neutral royal Knight `b2-h5`. The neutral Bishop on `e2` attacks `h5`. White cannot control that Bishop for `e2xh5` because leaving `e2` exposes White's King on `e1` to the Black Rook on `e8`, but Black can control the same neutral Bishop and make that capture safely. The royal destination is attacked, so Long Jump must be spent as `cardFizzled/SELF_CHECK` and restore the Knight to `b2`.

## Actual

Long Jump records `cardPlayed` and commits the neutral royal to `h5`. `isKingInCheck(..., 'black')` reports false in the staged position. Controls with the target temporarily made non-royal prove that Black can make `Be2xh5`, while White's attempt is rejected by the pin.

## Minimal public reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e '
import assert from "node:assert/strict";
import { createGameState } from "./src/game/state.ts";
import { applyAction, isKingInCheck } from "./src/game/reducer.ts";

const state = createGameState({
  fen: "4r2k/8/8/8/8/8/1n2B3/4K3 w - - 0 1",
  hands: { white: ["long-jump"], black: [] },
});
state.pieces.find(piece => piece.square === "h8").royal = false;
state.pieces.find(piece => piece.square === "e2").neutral = true;
const royal = state.pieces.find(piece => piece.square === "b2");
royal.neutral = true;
royal.royal = true;

const result = applyAction(state, {
  type: "playCard",
  cardId: "long-jump",
  target: [{ from: "b2", to: "h5" }],
});
assert(result.ok);
assert.deepEqual(result.state.history.at(-1), {
  type: "cardPlayed",
  cardId: "long-jump",
  target: [{ from: "b2", to: "h5" }],
});
assert.equal(result.state.pieces.find(piece => piece.id === royal.id).square, "h5");
assert.equal(isKingInCheck(result.state, "black"), false);

const control = structuredClone(state);
control.pieces.find(piece => piece.id === royal.id).square = "h5";
control.pieces.find(piece => piece.id === royal.id).royal = false;
control.pieces.find(piece => piece.square === "h8").royal = true;
control.turn = {
  color: "black",
  phase: "beforeMove",
  moveMade: false,
  cardPlays: { white: 0, black: 0 },
};
assert.equal(applyAction(control, { type: "move", from: "e2", to: "h5" }).ok, true);
control.turn.color = "white";
assert.equal(applyAction(control, { type: "move", from: "e2", to: "h5" }).ok, false);
'
```

## Root hint

`isRoyalInCheck` sends every neutral attacker through `legallyAttacksRoyal` with only `opposite(piece.owner)` as controller (`src/game/reducer.ts:505-510`). That is sufficient for an ordinary royal, but not for a neutral royal, which can be captured under either player's control. The shared check should try both controllers only for the neutral-attacker/neutral-royal combination and accept the attack if either legal-capture simulation succeeds. This affects every card path that uses `moveLeavesRoyalInCheck` or direct-mate checking, not just Long Jump.
