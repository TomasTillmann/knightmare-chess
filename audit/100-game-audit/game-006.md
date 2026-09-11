# Game 006 — Forced March near promotion

Hypothesis before play: a Forced March sideways pawn move on rank seven must remain a pawn, and any forward move to the last rank must use the proper promotion rules. I will enumerate supported targets and challenge boundary handling, adding Crab/Earthquake only if legal within this one game.

Parent scaffold executed: four probes, zero findings. No engine or test changes.

## Outcome

No confirmed finding. Exactly one independent adversarial game, 17 actions: 14 accepted, three rejected. Game command measured 35 ms wall time. The rejected moves omitted a mandatory promotion choice, so they are not evidence of engine defects. Structural `checkState` passed after every accepted action; digest stayed unchanged on each rejection.

Exact initial `createGameState` options:

```json
{"fen":"8/6P1/1p6/5k2/8/8/1K6/8 w - - 0 1","hands":{"white":["crab","forced-march"],"black":["earthquake"]}}
```

Actions in order (move notation means `{type:"move",from,to}`; end means `{type:"endTurn"}`):

| # | Action | Actual |
|---|---|---|
| 1 | b2-b3 | Accepted; white King b3, pawn g7 unchanged |
| 2 | playCard crab, target `"g7"` | Accepted; Crab effect on white-pawn-g7 |
| 3 | end | Black beforeMove |
| 4 | f5-e5 | Accepted |
| 5 | playCard earthquake, target `{"direction":"clockwise","promotions":[]}` | Accepted; orientation 90, same piece coordinates |
| 6 | end | White beforeMove |
| 7 | playCard forced-march, target `[{"from":"g7","to":"g6"}]` | Accepted; pawn g6 remains unpromoted, Crab persists; move consumed |
| 8 | end | Black beforeMove |
| 9 | e5-f5 | Accepted |
| 10 | end | White beforeMove |
| 11 | g6-h5, promotion omitted | Rejected ILLEGAL_MOVE, “That is not a legal Crab move.” |
| 12 | g6-h7, promotion omitted | Same rejection |
| 13 | b3-c3 | Accepted |
| 14 | end | Black beforeMove |
| 15 | b6-a6, promotion omitted | Rejected ILLEGAL_MOVE, “That is not a legal chess move.” |
| 16 | f5-g4 | Accepted |
| 17 | end | White beforeMove |

Before each action, the command printed its prediction. Directed predictions were: King relocates normally; Crab transforms g7 without relocation; Earthquake changes movement axes and promotes any newly last-rank pawn; Forced March moves one square sideways relative to the rotated board and preserves Crab if no promotion occurs. These all matched. Enumerated Forced March targets were `[[{"from":"g7","to":"g6"}],[{"from":"g7","to":"g8"}]]`, correctly vertical in stored coordinates after rotation. Earthquake enumerated clockwise and counterclockwise, both with empty promotion lists.

Continuation used seed 908006 with `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting index `seed % moves.length` from `[...legalDests(s)].flatMap(([from,tos])=>tos.map(to=>({type:"move",from,to})))`; endTurn whenever moveMade. Its pre-action predictions assumed enumerated destinations were complete legal actions. That assumption was wrong for promotion: clockwise orientation makes h-file White's promotion edge and a-file Black's. Thus all three rejection cases are incomplete caller actions, not engine bugs. No rerun or reset was performed.

Rule grounds: cards.md Forced March moves pawns one square sideways; Crab moves/captures diagonally forward and promotes like a regular pawn; Earthquake rotates the board and promotes pawns on the new last rank. The combined effects behaved consistently along this path.

Final FEN `8/8/1p4P1/8/6k1/2K5/8/8 w - - 3 4`, orientation 90, white King c3, black King g4, black Pawn b6, white Crab g6, no outcome. Neither King is attacked by the remaining pawn geometry. No captures or piece losses occurred.

Limitations: promotion with an explicit choice was not exercised; alternate g7-g8 sideways target was enumerated but not played. One finite path cannot establish general correctness. Prior findings were checked; no duplicate claimed.

GAME_006_DONE
