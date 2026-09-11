# Game 058 — Lost Castle and Man-Trap

Pre-action hypothesis: Lost Castle directly exchanges physical rooks without triggering an arrival capture. An active Man-Trap remains attached to its square after the exchange and can capture a subsequently arriving piece.

Scaffold executed: SCAFFOLD_OK probes=4 findings=0.

## One game and grounds

Exact createGameState options: `{"fen":"r7/7k/8/8/8/1n6/6PK/R7 w - - 0 1","hands":{"white":["man-trap"],"black":["lost-castle"]},"decks":{"white":[],"black":[]}}`. No phase/moveMade/cardPlays overrides. Initial checkState passed; both isKingInCheck calls returned false. Physical rook identities were white-rook-a1 and black-rook-a8.

Grounds: cards.md Man-Trap binds the occupied square and captures the next opposing piece ending a move there. Lost Castle exchanges a rook of each side. rules.md Swap defines exchange without capture or ordinary move legality. Catalog timing: Man-Trap afterMove, Lost Castle beforeMove. The hypothesis interprets exchange as distinct from an arrival move. Public targets were queried in the same game immediately before each card.

## Exact sequence

All twelve actions returned ok:true; every resulting state passed checkState. Predictions were printed before each action.

| # | Action JSON | Prediction and observed result |
|---|---|---|
| 1 | `{"type":"move","from":"g2","to":"g3"}` | Quiet move accepted; white afterMove. |
| 2 | `{"type":"playCard","cardId":"man-trap","target":"a1"}` | Trap created with owner white, square a1. Returned targets were `["a1","g3","h2"]`. |
| 3 | `{"type":"endTurn"}` | Black beforeMove. |
| 4 | `{"type":"playCard","cardId":"lost-castle","target":{"own":"a8","opponent":"a1"}}` | Selected sole returned target `[{"own":"a8","opponent":"a1"}]`. White physical rook moved to a8, black physical rook moved to a1; both remained board. Trap remained a1. Black afterMove, moveMade true, black cardPlays 1. |
| 5 | `{"type":"endTurn"}` | White beforeMove. |
| 6 | `{"type":"move","from":"h2","to":"h3"}` | Legal king wait, white afterMove. |
| 7 | `{"type":"endTurn"}` | Black beforeMove. |
| 8 | `{"type":"move","from":"a1","to":"b1"}` | Black rook departed trapped square unharmed. Trap remained a1. |
| 9 | `{"type":"endTurn"}` | White beforeMove. |
| 10 | `{"type":"move","from":"h3","to":"h4"}` | Legal king wait, white afterMove. |
| 11 | `{"type":"endTurn"}` | Black beforeMove. |
| 12 | `{"type":"move","from":"b3","to":"a1"}` | Knight arrived by ordinary move and was captured; trap removed. Final knight square null, zone captured, capturedBy white. Both rooks remained board at a8/b1. |

legalDests was enumerated before every regular move. Selected-origin destinations in order: g2 `[g3,g4]`; h2 `[g2,h3]`; a1 `[b1,c1,d1,e1,f1,g1,h1,a2,a3,a4,a5,a6,a7,a8]`; h3 `[g2,h2,g4,h4]`; b3 `[a1,c1,d2,d4,a5,c5]`. Each selected destination appeared in that enumeration.

## Result and limits

One directed multi-card group; 12 accepted actions, 0 rejected actions, 0 findings. The active trap stayed square-bound through the swap and later captured the arriving knight as predicted. Scaffold: 4 probes, 0 findings. Measured game execution wall time: 38 ms. No reset, replay, second game, or harness files. No tests read or run. No prior finding duplicated. No seeded continuation added: the same-game directed continuation completed the specific interaction within the action budget. Finite path coverage is not proof of correctness; King immunity and trap capture accompanying an ordinary capture were not exercised.

GAME_058_DONE
