# Game 024 — Rebirth enemy rook

Pre-action hypothesis: Rebirth may place an enemy rook on its own home square occupied by the acting player's friendly piece, capturing that occupant without changing rook identity, and must not restore castling rights lost through a rook move. Scaffold executed: four probes, zero findings. This game will begin in normal beforeMove and use actual timing and returned targets.

Exact initial options: `{"fen":"4k2r/1B6/8/8/8/8/8/4K3 b k - 0 1","hands":{"white":["rebirth"]}}`. All other createGameState options default. Initial checkState passed; white and black isKingInCheck both false. One game only, no resets or replay.

Rule grounds: cards.md Rebirth permits an enemy piece to relocate to either original square for that piece type, including a friendly occupant which is captured. Catalog timing is afterMove. Ordinary castling rights lost by movement must remain lost. Public legalDests enumerated before each action; cardPlayTargets returned exactly `[[{"from":"h7","to":"a8"}],[{"from":"h7","to":"h8"}]]` at the actual afterMove timing, and the first returned target was chosen.

| # | Exact action | Pre-action expectation | Actual result |
|---|---|---|---|
| 1 | `{"type":"move","from":"h8","to":"h7"}` | Preserve rook identity, remove kingside right | Accepted; `4k3/1B5r/8/8/8/8/8/4K3 w - - 1 2` |
| 2 | `{"type":"endTurn"}` | White beforeMove | Accepted; same FEN, white beforeMove |
| 3 | `{"type":"move","from":"b7","to":"a8"}` | Bishop occupies black rook home | Accepted; `B3k3/7r/8/8/8/8/8/4K3 b - - 2 2` |
| 4 | `{"type":"playCard","cardId":"rebirth","target":[{"from":"h7","to":"a8"}]}` | Capture bishop, preserve rook identity, no restored castling | Accepted; `r3k3/8/8/8/8/8/8/4K3 b - - 0 2`; details below |
| 5 | `{"type":"endTurn"}` | Normal turn advance | Accepted; black beforeMove, same FEN |
| 6 | `{"type":"move","from":"e8","to":"d8"}` | Seeded legal move preserves invariants | Accepted; `r2k4/8/8/8/8/8/8/4K3 w - - 1 3` |
| 7 | `{"type":"endTurn"}` | Normal turn advance | Accepted; white beforeMove, same FEN |
| 8 | `{"type":"move","from":"e1","to":"d1"}` | Seeded legal move preserves invariants | Accepted; `r2k4/8/8/8/8/8/8/3K4 b - - 2 3` |

Critical actual state: `black-rook-h8` remains owner black, role/originalRole rook, unpromoted, nonroyal, nonneutral, zone board at a8. `white-bishop-b7` remains owner white, role/originalRole bishop, now zone captured with square null and capturedBy white. The card event records capturedId white-bishop-b7. Castling FEN remains `-`; subsequent black king legal destinations were d7/e7/f7/d8/f8, with no castle. White hand empty, exact card white-hand-0-rebirth discarded, white allowance 1, afterMove retained. CapturedBy white records the card actor; the rule text does not explicitly specify attribution, so this report does not infer a defect from that field.

Seeded continuation uses seed 24 and `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting flattened legalDests at seed modulo move count on each movement action. checkState passed after every accepted action. No outcome arose.

Counts: 8 accepted game actions, 0 rejected game actions, 4 scaffold probes, 0 findings. Measured complete game execution wall time: 24.761 ms. Agent phase approximately 45 seconds; scaffold ran on the second tool invocation after reading the protocol, a procedural first-call deviation (it nevertheless ran promptly). No temporary harness was created. No tests or production files were read or edited beyond public production APIs/catalog. This finite path does not cover transformations, royal relocation, or other card interactions and is not proof of correctness.

GAME_024_DONE
