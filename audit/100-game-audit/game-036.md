# Game 036 — Peace Talks restores promotion edge

Hypothesis: reverting Earthquake after a pawn reaches its original promotion edge must require promotion; an unpromoted pawn there duplicates game 005.

Result: duplicate confirmed of `audit/2026-09-08/game-05.md`, not a new defect. Peace Talks restores orientation 0 but leaves white pawn e8 unpromoted, including after White's next completed move. Earthquake explicitly says reversal follows the same promotion rules. Even the generic Peace Talks correction deadline does not remove the pawn after that next move.

Scaffold executed successfully: 4 probes, zero findings. Exactly one new game, 12 accepted actions, 0 rejected; game wall time 24.47 ms. Initial and every accepted state passed checkState; both kings initially not checked. Timing was reached through regular moves only. No test/source changes or harness files. Setup/read phase exceeded the 45-second target; the scaffold was run after the initial report patch, not within the requested initial 15-second checkpoint.

Exact createGameState options:

```json
{"fen":"4n3/3P4/8/7k/8/8/K7/8 w - - 0 1","hands":{"white":["earthquake","peace-talks"],"black":[]},"decks":{"white":[],"black":[]}}
```

Pre-action prediction printed before sequence: clockwise Earthquake permits d7xe8 while sideways, and reversal must promote e8. Earthquake timing and Peace Talks timing are afterMove. Actual Earthquake targets after action 1: `[{"direction":"clockwise","promotions":[]},{"direction":"counterclockwise","promotions":[]}]`. Actual Peace Talks targets after action 6: `["white-hand-0-earthquake"]`. Selected returned targets exactly.

| # | Action | Observed |
|---|---|---|
| 1 | move a2-a3 | Accepted, White afterMove. |
| 2 | playCard earthquake target `{direction:"clockwise",promotions:[]}` | Accepted, orientation 90, d7 remains pawn. |
| 3 | endTurn | Accepted, Black beforeMove. |
| 4 | move h5-h4 | Accepted. |
| 5 | endTurn | Accepted, White beforeMove. |
| 6 | move d7-e8 | Accepted capture of black knight; e8 remains pawn correctly under orientation 90. |
| 7 | playCard peace-talks target `"white-hand-0-earthquake"` | Accepted, orientation 0, effects empty, e8 incorrectly remains pawn, promoted false. |
| 8 | endTurn | Accepted. |
| 9 | move h4-h5 | Accepted. |
| 10 | endTurn | Accepted. |
| 11 | move a3-b4 | Accepted; e8 pawn neither promoted nor removed. |
| 12 | endTurn | Accepted; same defect persists. |

legalDests before action 1: a2→a1,b1,b2,a3,b3; d7→d8,e8. Before action 4: h5→g4,h4,g5,g6,h6; e8→d6,f6,c7,g7. Before action 6: a3→a2,b2,b3,a4,b4; d7→e8,e7. Explicit promotion was correctly unnecessary for action 6 because the sideways promotion edge is file h. After action 7, independent geometry says rank 8 is White's promotion edge; `isPromotionSquare` also returned true for e8, but piece `white-pawn-d7` retained role pawn and promoted false.

Actions 8–12 are a seeded continuation of this same game: seed 36036, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, choosing flattened legalDests index seed modulo length, using endTurn whenever moveMade. Final FEN `4P3/8/8/7k/1K6/8/8/8 b - - 2 3`. No reset, replay, or second game. Finite path only; no coverage claim beyond this promotion-reversal sequence.

GAME_036_DONE
