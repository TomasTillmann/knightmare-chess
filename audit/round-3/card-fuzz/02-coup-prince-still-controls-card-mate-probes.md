# A checked Coup Prince still suppresses legal defenses in card direct-mate probes

- Severity: High
- Cards: Long Jump; shared direct-mate machinery for board-changing cards
- Current checkout: frozen shared checkout with the pre-existing uncommitted fixes

## Rule citation

`rules.md` §15.3 says Coup makes the original King a capturable Prince and transfers all King/check/checkmate rules to the marked replacement while it keeps its ordinary movement. Sections 11.2 and 11.5 require a regular card to fizzle only when its resulting board state is actually checkmate.

## Expected

The role-King on `h8` is a non-royal Prince, so the orthodox mate against it is irrelevant. The Black Rook on `a8` is the actual royal piece. Long Jump `Na2-b6` checks that Rook, but `Ra8-b8` is a legal escape. Long Jump therefore gives check but not direct mate and must record `cardPlayed`.

## Actual

Long Jump is spent and recorded as `cardFizzled/DIRECT_MATE`. In the exact staged post-card position:

- `positionFor(state, 'black').isCheckmate()` returns `true`;
- public `legalDests(state)` includes `a8-b8`; and
- direct `applyAction({ type: 'move', from: 'a8', to: 'b8' })` succeeds.

The public reducer thus proves the defense legal while the card mate probe denies it.

## Minimal reproduction and control

Run from the repository root:

```sh
node --import tsx --input-type=module -e '
import assert from "node:assert/strict";
import { createGameState } from "./src/game/state.ts";
import { applyAction, legalDests, positionFor } from "./src/game/reducer.ts";

const before = createGameState({
  fen: "r6k/6Q1/5K2/8/8/8/N7/8 w - - 0 1",
  hands: { white: ["long-jump"], black: [] },
});
before.pieces.find(piece => piece.square === "h8").royal = false;
before.pieces.find(piece => piece.square === "a8").royal = true;

const card = applyAction(before, {
  type: "playCard",
  cardId: "long-jump",
  target: [{ from: "a2", to: "b6" }],
});
assert(card.ok);
assert.deepEqual(card.state.history.at(-1), {
  type: "cardFizzled",
  cardId: "long-jump",
  reason: "DIRECT_MATE",
});

const staged = structuredClone(before);
staged.pieces.find(piece => piece.square === "a2").square = "b6";
staged.turn = {
  color: "black",
  phase: "beforeMove",
  moveMade: false,
  cardPlays: { white: 0, black: 0 },
};
staged.fen = staged.fen.replace(" w ", " b ");

assert.equal(positionFor(staged, "black").isCheckmate(), true);
assert.equal(legalDests(staged).get("a8")?.includes("b8"), true);
assert.equal(
  applyAction(staged, { type: "move", from: "a8", to: "b8" }).ok,
  true,
);
'
```

## Evidence and likely root

The card event is exactly `cardFizzled/DIRECT_MATE`, while the staged control lists and accepts `a8-b8`.

`hasLegalMove` at `src/game/reducer.ts:188-194` calls `legalDests(..., false)`. That flag disables the pseudo-legal expansion at `src/game/reducer.ts:136-152` which was added to escape chessops' obsolete role-King constraints after Coup. Consequently the shared mate probe still sees the Prince on `h8` as the King and returns no moves, even though normal public legality correctly follows the royal Rook on `a8`.
