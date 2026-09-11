# Game 029: Dark Mirror capture arriving on Man-Trap

Pre-action hypothesis: a white pawn using Dark Mirror to capture backward onto its last rank should resolve capture and any authorized promotion before Man-Trap arrival removes that same physical attacker. Verify captured defender and trapped attacker retain distinct identities. Enumerate actual card timing and destinations before selecting actions. One normal beforeMove game, at most 20 actions.

Before executing the game, corrected the rank premise: White moving backward b2-a1 reaches its home edge, not its promotion rank. Expected no promotion; both physical pieces become captured independently, and the trap expires. Dark Mirror card text authorizes backward capture, not promotion on the home rank. Man-Trap expressly preserves the arriving piece's capture (cards.md; rules.md §19.1).

Scaffold executed successfully: four probes, zero findings. Protocol deviation: scaffold ran on third tool invocation, after protocol discovery, rather than first. Only one game created; no replay, resets, or temporary harness.

Exact options: `{"fen":"7k/8/5n2/8/8/7K/1P6/r7 b - - 0 1","hands":{"black":["man-trap"],"white":["dark-mirror"]}}`. Defaults supply normal beforeMove timing and empty decks. Initial structural check passed; both Kings independently reported not in check.

Initial legal destinations: a1 → b1,c1,d1,e1,f1,g1,h1,a2,a3,a4,a5,a6,a7,a8; f6 → e4,g4,d5,h5,d7,h7,e8,g8; h8 → g7,h7,g8. Catalog timing: Man-Trap afterMove; Dark Mirror beforeMove.

| # | Exact action | Result |
|---|---|---|
| 1 | `{"type":"move","from":"f6","to":"d5"}` | Accepted; black afterMove. |
| 2 | `{"type":"playCard","cardId":"man-trap","target":"a1"}` | Accepted; a1 trap active. Enumerated targets were `["a1","d5","h8"]`. |
| 3 | `{"type":"endTurn"}` | Accepted; white beforeMove. |
| 4 | `{"type":"playCard","cardId":"dark-mirror","target":[{"from":"b2","to":"a1"}]}` | Accepted; sole enumerated target was `[{"from":"b2","to":"a1"}]`; white afterMove. |
| 5 | `{"type":"endTurn"}` | Accepted; black beforeMove. |
| 6 | `{"type":"move","from":"d5","to":"b6"}` | Accepted; black afterMove. |
| 7 | `{"type":"endTurn"}` | Accepted; white beforeMove. |
| 8 | `{"type":"move","from":"h3","to":"g2"}` | Accepted; white afterMove. |

Critical expected/actual matched: `black-rook-a1` ended captured by white, square null; `white-pawn-b2` ended captured by black, square null, role/originalRole pawn, promoted false. Effects became empty. Both identities and capture attribution persisted through continuation. No extra ordinary move was granted by Dark Mirror. Seeded continuation selected from actual legalDests with seed 29 and LCG `(imul(seed,1664525)+1013904223)>>>0`, index modulo move count. Structural checks passed initially and after all eight actions. Final board: white King g2, black Knight b6, black King h8; no outcome.

Eight accepted actions, zero rejected actions; one independently designed adversarial game; execution wall time 20.176 ms. No confirmed findings or duplicates. Limitation: verifies absence of false home-edge promotion; does not exercise an actual promotion, which backward movement cannot reach in this ordinary orientation. Finite clean path only. Overall setup/report exceeded the 45-second target.

GAME_029_DONE
