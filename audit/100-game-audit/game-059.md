# Game 059: Sanctuary after Coup royal

Pre-action hypothesis: after Coup royal transfers royalty from White's king to a knight, Sanctuary should enumerate and execute the card-authorized castling geometry with a rook despite absent ordinary castling rights; royalty and turn accounting must remain consistent. I will verify exact card wording and choose an enumerated target in one normal beforeMove game.

## Execution

Scaffold executed first: `SCAFFOLD_OK probes=4 findings=0`. Exactly one independent game, no resets or replay, no temporary harness. Initial options:

```json
{"fen":"k7/8/8/8/8/8/1P6/K3N2R w - - 0 1","hands":{"white":["coup","sanctuary"]},"decks":{"white":[],"black":[]}}
```

Initial `checkState` passed; neither king checked. Initial `legalDests`: a1→b1,a2; e1→c2,g2,d3,f3; h1→f1,g1,h2,h3,h4,h5,h6,h7,h8; b2→b3,b4. No ordinary castling rights.

Rule grounds: cards.md Coup makes the chosen non-Rook/non-Queen piece the new King while retaining its normal movement; the old King becomes a capturable Prince. Sanctuary allows the King and Rook on a clear rank/file to castle regardless of history, with Rook beside King's starting square and King jumping over it. Catalog timing is Coup afterMove, Sanctuary beforeMove.

All predictions below were supplied before the corresponding `applyAction` call. All accepted resulting states passed `checkState`; both colors remained out of check throughout. Rejected actions preserved the input digest.

| # | Exact action | Prediction and actual result |
|---|---|---|
| 1 | `{"type":"move","from":"b2","to":"b3"}` | Accepted; White afterMove, moveMade true, zero card plays. |
| 2 | `{"type":"playCard","cardId":"coup","target":"e1"}` | Accepted; e1 remains knight and becomes royal; a1 king becomes nonroyal. White afterMove, one card play. Targets enumerated immediately beforehand: `["e1","b3"]`. |
| 3 | `{"type":"endTurn"}` | Accepted; Black beforeMove and card allowances reset. |
| 4 | `{"type":"move","from":"a8","to":"b8"}` | Accepted; Black afterMove. |
| 5 | `{"type":"endTurn"}` | Accepted; White beforeMove. |
| 6 | `{"type":"playCard","cardId":"sanctuary","target":{"king":"a1","rook":"h1"}}` | Rejected as predicted: WRONG_ROLE, “Choose your royal King and a Rook.” No card or move consumed. |
| 7 | `{"type":"playCard","cardId":"sanctuary","target":{"king":"e1","rook":"h1"}}` | Accepted; royal knight e1→g1 and rook h1→f1 immediately. White afterMove, moveMade true, one card play. |
| 8 | `{"type":"move","from":"g1","to":"e2"}` | Rejected as predicted: ILLEGAL_MOVE, “The regular move has already been made.” |
| 9 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 10 | `{"type":"move","from":"b8","to":"a8"}` | Accepted enumerated seeded move; Black afterMove. |
| 11 | `{"type":"endTurn"}` | Accepted; White beforeMove. |
| 12 | `{"type":"move","from":"f1","to":"d1"}` | Accepted enumerated seeded move; White afterMove. |

Before #6–7, Sanctuary targets were exactly `[{"king":"e1","rook":"h1"}]`; #7 selected that actual target. Seeded continuation used seed 59 and `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, choosing index `seed % moves.length` from flattened legalDests. #10 alternatives were b8→a7,b7,c7,a8,c8. #12 alternatives were a1→b1,a2,b2; f1→b1,c1,d1,e1,f2,f3,f4,f5,f6,f7,f8; g1→e2,f3,h3; b3→b4. The g1 destinations confirm retained Knight movement after Sanctuary.

Result: zero findings; 12 actions, 10 accepted and 2 rejected. Measured game wall time 25.392 ms (shell execution 0.024 s). Final FEN `k7/8/8/8/8/1P6/8/K2R2N1 b - - 4 3`; public turn is White afterMove pending endTurn, royalty remains on g1 Knight and a8 King. Existing finding index reviewed; no duplicate finding.

Limitations: one clear horizontal route, no attacked transit square, file geometry or capture of the Prince exercised. Finite clean path does not prove correctness. Protocol/scaffold and report executed without inspecting tests or changing production. Total setup/report time exceeded the 45-second target; engine game itself was bounded as above.

GAME_059_DONE
