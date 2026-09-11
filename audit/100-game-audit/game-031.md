# Game 031

Pre-action hypothesis: a Confabulation composite containing a pawn may reach the promotion rank without promoting; capture records its original components independently, allowing Resurrection to restore one component. One normal beforeMove sparse game will probe this lifecycle, using enumerated targets and legal destinations. Parent scaffold executed: four probes, zero findings.

Initial options: `{"fen":"1r6/P7/7k/1N6/8/8/8/7K w - - 0 1","hands":{"white":["confabulation","resurrection"]}}`. Initial structural check passed; neither king was checked. No phase, effects, history, or piece overrides. Exactly one game, no replay/reset.

Rule grounds: cards.md Confabulation explicitly prohibits confabulated Pawn promotion and grants either component's movements. Resurrection restores one captured non-King/non-Queen to a vacant starting square. Both catalog timings are beforeMove. Before action, predicted merger replacement move, unpromoted pawn at a8, independent captured components, and pawn-only Resurrection.

Enumerated Confabulation targets: `[[{"from":"b5","to":"a7"}]]`. Selected that returned target.

| # | Exact action | Actual result (all accepted) |
|---|---|---|
| 1 | `{"type":"playCard","cardId":"confabulation","target":[{"from":"b5","to":"a7"}]}` | White afterMove; pawn carrier a7, knight away; effect pieceIds pawn/knight. |
| 2 | `{"type":"endTurn"}` | Black beforeMove. |
| 3 | `{"type":"move","from":"h6","to":"g6"}` | Black king g6, afterMove. |
| 4 | `{"type":"endTurn"}` | White beforeMove. |
| 5 | `{"type":"move","from":"a7","to":"a8"}` | Pawn a8, role/originalRole pawn, promoted false; merger retained. |
| 6 | `{"type":"endTurn"}` | Black beforeMove. |
| 7 | `{"type":"move","from":"b8","to":"a8"}` | Rook a8; pawn and knight separately captured, square null, capturedBy black; effects empty. |
| 8 | `{"type":"endTurn"}` | White beforeMove. |
| 9 | `{"type":"playCard","cardId":"resurrection","target":{"pieceId":"white-pawn-a7","to":"a2"}}` | Pawn alone restored a2, promoted false; knight still captured; effects empty; white afterMove. |

Enumerated legal destinations immediately before moves: h6 `[g5,h5,g6,g7,h7]`; a7 `[a8,b8,b5,c6,c8]`; b8 `[b1,b2,b3,b4,b5,b6,b7,a8,c8,d8,e8,f8,g8,h8]`. No promotion declaration was needed for the composite's a7–a8 move.

Enumerated Resurrection targets immediately before action 9: `white-knight-b5` to b1/g1 and `white-pawn-a7` to a2/b2/c2/d2/e2/f2/g2/h2. The selected pawn/a2 target was returned by the API. Structural invariants passed after all nine accepted actions; no outcome was declared.

Results: 9 accepted, 0 rejected actions; one adversarial group; 0 findings. Measured game execution wall time 26 ms (scaffold separate: 4 probes, 0 findings). All semantic predictions matched. Limits: one finite directed path, no seeded continuation; does not establish general correctness or independently execute knight Resurrection.

GAME_031_DONE
