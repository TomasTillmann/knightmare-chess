# Game 068 — Treason and Coup royalty

Pre-action hypothesis: after Coup makes Black's knight royal, White's Treason swapping that knight and a Black rook must move the royal identity with the knight. If the new square is attacked, Black must answer the resulting check and cannot make an unrelated move.

Scaffold: SCAFFOLD_OK, four probes, zero findings. One game, maximum 20 public actions; no phase overrides.

## Executed game

Exact initial options:
```json
{"fen":"rn5k/7p/8/8/8/8/6P1/R6K b - - 0 1","hands":{"black":["coup"],"white":["treason"]},"decks":{"black":[],"white":[]}}
```
Initial phase was normal Black beforeMove, both kings safe. Initial and every accepted-state `checkState` passed. No game replay/reset or state overrides occurred.

Rule grounds: cards.md Coup retains the selected piece's standard movement while making it royal; Treason swaps an opponent Rook and Knight. rules.md §swaps says swaps exchange squares without capture; continuing markers follow physical identity; regular cards may give check without directly mating. Both catalog timings are afterMove. With no remaining saving card, Black must resolve check through a legal move.

| # | Exact public action | Result and critical evidence |
|---|---|---|
| 1 | move h7→h6 | Accepted; Black afterMove, neither king checked. |
| 2 | playCard coup, target `"b8"` | Accepted; selected from cardPlayTargets `["h6","b8"]`; physical `black-knight-b8` became royal at b8, standard role knight; h8 King demoted. |
| 3 | endTurn | Accepted; White beforeMove. |
| 4 | move g2→g3 | Accepted; White afterMove. |
| 5 | playCard treason, target `{"rook":"a8","knight":"b8"}` | Accepted; target enumeration returned exactly this object. Predicted before action: royal knight moves to a8 and is checked by a1 rook, with knight escape available. Actual: royal ID `black-knight-b8` at a8, role knight, Black check true; no outcome. |
| 6 | endTurn | Accepted; Black beforeMove, still checked. |
| 7 | move h6→h5 | Rejected ILLEGAL_MOVE; predicted rejection before action because it leaves royal a8 checked. Input digest unchanged. |
| 8 | move a8→b6 | Accepted; predicted escape before action; royal knight at b6, Black check false. |
| 9 | endTurn | Accepted; White beforeMove. |
| 10 | move a1→b1 | Accepted; Black royal b6 is checked along b-file. |
| 11 | endTurn | Accepted; Black beforeMove and checked. |
| 12 | move b6→a4 | Accepted; royal knight a4, Black check false. |
| 13 | endTurn | Accepted; White beforeMove. |
| 14 | move b1→d1 | Accepted; both royals safe, outcome null. |

Before action 7, legalDests returned exactly `[["a8",["b6","c7"]]]`, independently agreeing that the royal knight must evade. Actions 10–14 were the seeded continuation of this same game: seed 680908, unsigned LCG `(1664525*seed+1013904223)>>>0`, choose modulo flattened legalDests length on each move; endTurn after moveMade.

Result: **zero findings** on this finite path; royalty followed the physical knight through Treason and subsequent knight moves, and two checks were enforced. 14 actions: 13 accepted, 1 rejected. Runtime measured inside the single game process: **41.6115 ms**. Scaffold separately executed four probes, zero findings. No temporary harnesses were created. Prior audit README was checked; no duplicate finding applies.

Limitations: sparse board, one Coup and one Treason; no cancellation or mate explored. Finite clean path does not prove all interactions correct. Setup/report overhead exceeded the 45-second target; the game itself completed in the measured time above.

GAME_068_DONE
