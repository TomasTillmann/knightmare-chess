# Non-Pawn pieces cannot capture a same-origin neutral piece

- Severity: High
- Area: Neutrality, ordinary captures, checkmate replies

## Rule citation

`rules.md` §15.1 makes a neutral piece available to either player and valid on both sides of the friendly/enemy distinction. The round-three neutral-target fix already applies this to ordinary Pawn captures: a non-neutral Pawn may capture a neutral piece with the same stored owner. Neutral target semantics must not depend on the attacker's role.

## Expected

The White Knight on `a3` is neutral. White may therefore capture it with the White Rook on `a1`, just as the current Pawn path permits a same-owner neutral target. `legalDests` must list `a1-a3`, and the reducer must record the Knight as captured.

## Actual

`legalDests` stops the Rook at `a2`, and direct `applyAction` rejects `a1-a3` as `ILLEGAL_MOVE`. Changing only the attacker to a Pawn makes the equivalent same-owner neutral capture legal, so the result is role-dependent rather than a general Neutrality ruling. The omission can also remove a genuine neutral-capture defense from checkmate search.

## Minimal reproduction

Run from the repository root:

```sh
node --import tsx --input-type=module -e '
import assert from "node:assert/strict";
import { createGameState } from "./src/game/state.ts";
import { applyAction, legalDests } from "./src/game/reducer.ts";

const state = createGameState({
  fen: "7k/8/8/8/8/N7/8/R6K w - - 0 1",
});
state.pieces.find(piece => piece.square === "a3").neutral = true;

assert.equal(legalDests(state).get("a1")?.includes("a3") ?? false, false);
const result = applyAction(state, { type: "move", from: "a1", to: "a3" });
assert.equal(result.ok, false);
if (!result.ok) assert.equal(result.error.code, "ILLEGAL_MOVE");
'
```

Observed Rook destinations:

```text
b1 c1 d1 e1 f1 g1 a2
```

## Likely root

The custom Pawn branch in `src/game/reducer.ts` expressly accepts `target.neutral`, while the generic non-Pawn path still relies on chessops ownership. `pseudoDests` treats the same-owner neutral occupant as friendly, and the custom fallback is entered only when the **moving** piece is neutral. A single neutral-target capture rule is therefore missing from the shared ordinary-move path.
