# Game 005 — Annexation and Chaos

Pre-action hypothesis: simultaneous two-square pawn advances under Annexation must expose every eligible pawn to en passant on the opponent's next move. After reading Chaos's actual card text, prediction corrected before play: Chaos cancels the move, restores both pawn locations and their original en-passant status, returns Annexation, and prohibits repeating that identical move. One game only; scaffold passed four probes with zero findings.

## Result

No defect found. Exactly one game, 16 action probes: 15 accepted, 1 expected rejection. Game execution measured 37 ms; structural invariants passed after every action. No replay, resets, tests, or code changes. Relevant rule grounds: `cards.md` Annexation allows one or two two-square pawn advances and en passant for pawns starting on their original squares; Chaos requires a different move and permits taking back the card.

## Reproduction and pre-action predictions

Initial `createGameState` options:

```json
{"fen":"7k/8/8/8/1p1p4/8/2P1P3/K7 w - - 0 1","hands":{"white":["annexation"],"black":["chaos"]},"decks":{"white":[],"black":[]}}
```

`cardPlayTargets` returned single c2-c4, single e2-e4, and the pair. The pair target is `[{"from":"c2","to":"c4"},{"from":"e2","to":"e4"}]`. Actions below are sequential in this single game. Predictions were printed before applying each critical action.

| # | Public action | Expected and observed result |
|---|---|---|
| 1 | playCard annexation, paired target | Both pawns advance. Two records: c3/white-pawn-c2 and e3/white-pawn-e2. White afterMove, moveMade true. |
| 2 | playCard chaos, no target (enumerator returned undefined) | Both pawns restored to c2/e2, enPassant empty, White beforeMove. Annexation returned to hand; Chaos discarded. |
| 3 | Repeat action 1 | Rejected ILLEGAL_MOVE: "Chaos requires a different move." Position and cards unchanged. |
| 4 | playCard annexation, `[{"from":"c2","to":"c4"}]` | Accepted different move. Only c3 en-passant record; e2 stays put. |
| 5 | endTurn | Black beforeMove, c3 en-passant retained. |
| 6 | move b4-c3 | Legal en-passant capture removes c4 pawn, leaves e2, clears en-passant records. |
| 7 | endTurn | White beforeMove. |
| 8 | move a1-b1 | Accepted; kings safe and captured pawn remains absent. |
| 9 | endTurn | Black beforeMove. |
| 10 | move h8-h7 | Accepted; kings safe and captured pawn remains absent. |
| 11 | endTurn | White beforeMove. |
| 12 | move b1-a2 | Accepted; kings safe and captured pawn remains absent. |
| 13 | endTurn | Black beforeMove. |
| 14 | move h7-g7 | Accepted; kings safe and captured pawn remains absent. |
| 15 | endTurn | White beforeMove. |
| 16 | move a2-a3 | Accepted; kings safe and captured pawn remains absent. |

Before action 6, `legalDests` included b4→b3,c3 and d4→c3,d3, independently confirming both black adjacent pawns may capture the sole exposed c4 pawn. Before action 6 FEN was `7k/8/8/8/1pPp4/8/4P3/K7 b - c3 0 1`; afterward `7k/8/8/8/3p4/2p5/4P3/K7 w - - 0 2`.

Actions 7–16 used seed 5005, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting `moves[seed % moves.length]` from flattened Map order, alternating endTurn as necessary. Final FEN: `8/6k1/8/8/3p4/K1p5/4P3/8 b - - 5 4`. No outcome and no effects; both played cards discarded exactly once.

Semantic review confirms two en-passant records were generated and cleanly rolled back; card ownership and move allowance restored; identical replay rejected while a different use of the same card worked; subsequent en-passant capture removed the correct pawn. Limitation: pair-generated rights were inspected but canceled before either could be exercised; later only the single-pawn right was exercised. This finite path does not prove correctness generally. No duplicate or new finding.

GAME_005_DONE
