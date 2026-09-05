# Rotated non-neutral Pawns still attack in the unrotated direction

- Severity: High
- Area: ordinary Pawn moves, Earthquake orientation, check and mate
- Current checkout: frozen shared checkout with the pre-existing uncommitted fixes

## Rule citation

`rules.md` §13.3 says that Pawn "forward" and the last rank are properties of the current board orientation. Section 14.1 likewise says Earthquake rotates Pawn forward direction. Pawn capture attacks must therefore rotate with Pawn movement.

## Expected

At orientation `90`, White moves toward the h-file. A White Pawn on `d4` attacks `e3` and `e5`. Black's King may not move `f3-e3`.

## Actual

Both `legalDests` and `applyAction` allow `Kf3-e3`, and the committed position reports Black as not in check. The same position with the Pawn marked neutral correctly rejects the King move, proving that the rotated attack geometry exists only in the neutral-Pawn path.

The complete two-color/four-orientation matrix was also checked. Non-neutral White Pawns always reported the orientation-0 attacks, and non-neutral Black Pawns always reported the orientation-0 attacks, at orientations `90`, `180`, and `270`.

## Minimal reproduction and control

Run from the repository root:

```sh
node --import tsx --input-type=module -e '
import assert from "node:assert/strict";
import { createGameState } from "./src/game/state.ts";
import { applyAction, isKingInCheck, legalDests } from "./src/game/reducer.ts";

const make = (orientation, neutral = false) => {
  const state = createGameState({
    fen: "7K/8/8/8/3P4/5k2/8/8 b - - 0 1",
  });
  state.orientation = orientation;
  state.pieces.find(piece => piece.square === "d4").neutral = neutral;
  return state;
};

const rotated = make(90);
assert.equal(legalDests(rotated).get("f3")?.includes("e3"), true);
const accepted = applyAction(rotated, { type: "move", from: "f3", to: "e3" });
assert(accepted.ok);
assert.equal(isKingInCheck(accepted.state, "black"), false);

const neutralControl = applyAction(
  make(90, true),
  { type: "move", from: "f3", to: "e3" },
);
assert.equal(neutralControl.ok, false);
if (!neutralControl.ok) assert.equal(neutralControl.error.code, "ILLEGAL_MOVE");

const orientationZeroControl = applyAction(
  make(0),
  { type: "move", from: "f3", to: "e3" },
);
assert.equal(orientationZeroControl.ok, true);
'
```

## Evidence and likely root

The observed triples were:

```text
orientation 90 non-neutral: listed=true, accepted=true, check=false
orientation 90 neutral:     listed=false, accepted=false
orientation 0 non-neutral:  listed=true, accepted=true, check=false
```

`src/game/reducer.ts:417-428` applies `pawnForward(state, piece.owner)` to neutral Pawn attacks. In contrast, `isRoyalInCheck` at `src/game/reducer.ts:452-467` delegates every non-neutral attack to the unrotated chessops position. The rotated ordinary-move fix therefore changed Pawn movement without changing the attack authority used for King safety, castling, check, and mate.
