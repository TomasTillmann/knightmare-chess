# Game 07 — Earthquake delivering mate

Prediction before play: after Ng1-f3, clockwise Earthquake promotes h7 to a queen. Qh7 attacks Ka7 and b7; Rc8 controls a8/b8; black pawns a6/b6 block the remaining escapes. Earthquake is continuing, so rule 11.4 permits its mating effect. The suspected failure is a direct-mate fizzle despite that exception.

Initial configuration: `{"fen":"2R5/k6P/pp6/8/8/8/8/4K1N1 w - - 0 1","hands":{"white":["earthquake"]}}`.

## Confirmed bug — Continuing Earthquake incorrectly fizzles when it mates

**Severity:** high rule correctness; a legal winning card effect is discarded and both promotions and rotation are undone.

**Authority:** `rules.md:254-256` says a Continuing Effect can cause or help cause checkmate and is not discarded because the position is mate. `rules.md:391-399` requires all newly last-rank pawns to promote, opponent first. `cards.md:69-71` states the rotation and promotions. `src/game/cards/catalog.ts:769-778` identifies Earthquake as `continuing: true`.

**Exact reproduction:** create the initial configuration above, then execute:

```json
[
  {"type":"move","from":"g1","to":"f3"},
  {"type":"playCard","cardId":"earthquake","target":{"direction":"clockwise","promotions":[{"square":"a6","role":"rook"},{"square":"h7","role":"queen"}]}}
]
```

**Expected before the corrected card action:** orientation 90; black a6 promoted to rook; white h7 promoted to queen; retained Earthquake effect; Black in checkmate geometry. Qh7 attacks a7 and b7; Rc8 covers a8 and b8; a6/b6 occupied. Ra6 cannot interpose because its king on a7 and pawn on b6 block its routes. The rotated pawn b6 moves left, cannot reach the checking seventh rank, and therefore cannot save the king. White Ke1 remains safe. The opponent has no card hand.

**Observed immediately before card:** FEN `2R5/k6P/pp6/8/8/5N2/8/4K3 b - - 1 1`; orientation 0; white afterMove, moveMade true, both card counts 0; effects empty; both kings safe; white hand contains `white-hand-0-earthquake`, all other hands/decks/discards empty. a6 and h7 are unpromoted pawns. History is Ng1-f3.

**Observed after card:** `ok: true`, but history appends `{"type":"cardFizzled","cardId":"earthquake","reason":"DIRECT_MATE","movement":[],"preservePreviousMove":true}`. FEN and orientation stay unchanged. Both pawns stay unpromoted, both kings remain safe, outcome remains null, effects remain empty. White stays afterMove with moveMade true; white card count becomes 1. Earthquake goes to white discard; hand is empty. All other pieces remain Ke1, Nf3, Pb6, Ka7, Rc8. Thus the action is consumed while its legal effect is lost.

**Independent oracle:** `Chess.fromSetup(parseFen("2R5/k6Q/rp6/8/8/5N2/8/4K3 b - - 1 1").unwrap()).unwrap()` reports `isCheck() === true`, `isCheckmate() === true`, and empty legal destinations for a6, b6, a7. Pawn rotation cannot change the relevant line-blocking conclusion explained above. Suspected production cause is the unconditional `DIRECT_MATE` gate in `playEarthquake` at `src/game/reducer.ts:4160`; no source was edited.

## Prediction corrections and controls

- Parent-validated scaffold: read `campaign/fixtures/plots-rescue.json` `.state`; `checkState` passed; z9-a1 rejected with `ILLEGAL_MOVE`; original digest unchanged.
- Initial prediction omitted the required opponent a6 promotion. Engine correctly rejected the incomplete target as `INVALID_TARGET` without mutation.
- First corrected choice promoted a6 to knight. Independent analysis revealed Nc7 can interpose, so that branch is **not mate and not a bug**. Earthquake correctly retained its effect and promoted both pawns, Black was in check and outcome stayed null after endTurn.
- Same initial position was replayed with a6 rook instead to isolate mate. No unrelated game was started. Both corrected promotion choices were listed by `cardPlayTargets`.

Execution: one scenario with two declaration corrections/replays; 6 accepted actions total across runner executions (including replayed Ng1-f3), 3 rejected actions including scaffold and repeated incomplete declaration; structural `checkState` passed throughout. No randomized moves in this narrow probe. Measured wall time from initial report creation to final pre-save check: 77 seconds; exceeds requested 45-second bound due to correcting two prediction errors. No harness files created; no code or tests changed/read.

GAME_07_DONE — 1 confirmed finding.
