# Game 078 — Hidden Passage and Coup royal

Pre-action hypothesis: Hidden Passage may relocate a royal Pawn onto its last rank without promoting it. Coup royal must exclude a capturable candidate, preserve a valid selected Pawn's identity through relocation, and permit ordinary promotion later when reachable legally.

Scaffold: four probes, zero findings. One game only, maximum 20 public actions.

## Executed game

Exact `createGameState` options: `{"fen":"8/8/3P3k/8/8/8/8/KR6 w - - 0 1","hands":{"white":["coup","hidden-passage","hidden-passage"]}}`. No overrides or injected state. Initial `checkState` passed; both kings were unchecked. All accepted states passed `checkState`.

Grounds: cards.md Coup preserves the selected piece's standard movement while making it the King; the former King becomes a capturable Prince. Hidden Passage names the King and relocates it to an empty square. Catalog timing is Coup afterMove and Hidden Passage beforeMove. Rules §13.2 requires promotion after a normal Pawn move to the last rank, but prohibits promotion after other relocation unless the responsible card expressly authorizes it.

Initial legal destinations: a1→a2,b2; b1→c1,d1,e1,f1,g1,h1,b2,b3,b4,b5,b6,b7,b8; d6→d7. After action 1, `cardPlayTargets(coup)` returned exactly `["d6"]`. Before action 6, Hidden Passage targets all used source d6; destinations by rank: b1–h1; a2,c2–h2; a3–h3; a4–h4; a5–e5; a6,b6,c6,e6; a7–e7; a8–h8. No Prince source was returned. Before action 11, targets all used source d8, with destinations b1–h1; a2,c2–h2; a3–h3; a4–h4; a5–f5; a6–f6; a7–f7; a8,b8,c8,e8,f8,g8,h8. Both successful Hidden Passage targets were selected from these enumerations.

Predictions were supplied before each action in the executing driver. Table records exact sequential actions and observed outcomes; every action was predicted accepted except action 6.

| # | Public action | Actual |
|---|---|---|
| 1 | move b1→b2 | Accepted; white afterMove |
| 2 | playCard coup target `"d6"` | Accepted; Pawn royal=true, Prince royal=false |
| 3 | endTurn | Accepted; black beforeMove |
| 4 | move h6→g6 | Accepted |
| 5 | endTurn | Accepted; white beforeMove |
| 6 | playCard hidden-passage target `[{"from":"a1","to":"b1"}]` | Rejected WRONG_ROLE, “Choose your royal piece.”; input digest unchanged, allowance remains zero |
| 7 | playCard hidden-passage target `[{"from":"d6","to":"d8"}]` | Accepted; Pawn on d8, role=pawn, promoted=false, royal=true; replacement move consumed |
| 8 | endTurn | Accepted |
| 9 | move g6→h6 | Accepted |
| 10 | endTurn | Accepted |
| 11 | playCard hidden-passage target `[{"from":"d8","to":"d7"}]` | Accepted; Pawn on d7, role=pawn, promoted=false, royal=true |
| 12 | endTurn | Accepted |
| 13 | move h6→g6 | Accepted |
| 14 | endTurn | Accepted |
| 15 | move d7→d8 promotion queen | Accepted; role=queen, originalRole=pawn, promoted=true, royal=true |
| 16 | endTurn | Accepted |
| 17 | move g6→h5 | Accepted; seeded continuation |

Before ordinary promotion, legalDests included d7→d8, a1→b1,a2, and b2→b1,a2,c2,d2,e2,f2,g2,h2,b3,b4,b5,b6,b7,b8. Piece identity `white-pawn-d6` remained unchanged throughout. Prince `white-king-a1` remained nonroyal on a1. Seeded continuation used seed 78 and one LCG step `(Math.imul(seed,1664525)+1013904223)>>>0`, indexing the public legal move list modulo its length.

Result: zero findings, 17 actions (16 accepted, 1 intentionally rejected), outcome=null. Measured game wall time 39.692 ms. Scaffold independently completed four probes with zero findings. One finite game, no replay/reset, no test access or code changes; this does not prove all possible interactions. No duplicate finding to report.

GAME_078_DONE
