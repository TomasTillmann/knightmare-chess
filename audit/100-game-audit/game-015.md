# Game 015 — Cowardice and pawn initial-rank eligibility

Pre-action hypothesis: Cowardice can return an original pawn to its starting rank; a subsequent legal two-square advance should expose the normal en-passant capture to an adjacent enemy pawn. The action must occur after a normal move and use an enumerated card target. No conclusion yet.

Scaffold executed successfully: 4 probes, zero findings.

## Executed game

Exact options: `{"fen":"7k/8/8/3pP3/8/8/8/KR6 w - - 0 1","hands":{"white":["cowardice"]},"decks":{"white":[],"black":[]}}`. Normal beforeMove initialization; initial checkState passed and both kings were independently reported unchecked. One game, no resets/replays. Catalog timing read: afterMove. Card text permits moving an opponent Pawn one or two squares backward through empty squares. Rules §13 expressly permits a two-square initial-style move from the owner's first or second rank even after previous movement, and normal en passant afterward.

Initial legal destinations: a1=[a2,b2], b1=[c1,d1,e1,f1,g1,h1,b2,b3,b4,b5,b6,b7,b8], e5=[e6]. After step 1, actual cardPlayTargets returned `[[{"from":"d5","to":"d6"}],[{"from":"d5","to":"d7"}]]`; selected the latter. After step 3 black destinations were d7=[d5,d6], h8=[g7,h7,g8]. After step 5 white destinations were a1=[b1,a2], b2=[b1,a2,c2,d2,e2,f2,g2,h2,b3,b4,b5,b6,b7,b8], e5=[d6,e6].

Predictions below were printed before each corresponding action. All actions accepted, with checkState passing after each.

| Step | Exact action | Prediction and observed result |
|---|---|---|
| 1 | `{"type":"move","from":"b1","to":"b2"}` | Legal; entered white afterMove. |
| 2 | `{"type":"playCard","cardId":"cowardice","target":[{"from":"d5","to":"d7"}]}` | Black pawn retreats to d7 and card creates no en-passant right; observed d7 pawn and empty rights. |
| 3 | `{"type":"endTurn"}` | Black beforeMove; observed. |
| 4 | `{"type":"move","from":"d7","to":"d5"}` | Two-square move allowed again and creates d6 en-passant right; observed `[{"target":"d6","pawnId":"black-pawn-d5"}]`. |
| 5 | `{"type":"endTurn"}` | White immediate en-passant opportunity retained; observed. |
| 6 | `{"type":"move","from":"e5","to":"d6"}` | White captures en passant; observed black-pawn-d5 square=null, zone=captured, capturedBy=white; white-pawn-e5 at d6, and rights cleared. |
| 7 | `{"type":"endTurn"}` | Completed move ends successfully. |
| 8 | `{"type":"move","from":"h8","to":"h7"}` | Enumerated seeded legal move succeeds. |
| 9 | `{"type":"endTurn"}` | Completed move ends successfully. |
| 10 | `{"type":"move","from":"b2","to":"e2"}` | Enumerated seeded legal move succeeds. |
| 11 | `{"type":"endTurn"}` | Completed move ends successfully. |
| 12 | `{"type":"move","from":"h7","to":"g6"}` | Enumerated seeded legal move succeeds. |
| 13 | `{"type":"endTurn"}` | Completed move ends successfully. |
| 14 | `{"type":"move","from":"e2","to":"e5"}` | Enumerated seeded legal move succeeds. |

Continuation seed 915; next seed `(Math.imul(seed,1664525)+1013904223)>>>0`, selected `seed % moves.length` from flattened public legalDests each move. Final FEN `8/8/3P2k1/4R3/8/8/8/K7 b - - 4 4`, outcome=null.

Executed 4 scaffold probes plus 14 game actions: 14 accepted, 0 rejected; zero findings. Measured game wall time 36ms. Total task approximately 40 seconds. Limitation: initial pawn at d5 was configured by legal FEN rather than reached through recorded normal pawn moves; its Cowardice movement itself is recorded and the explicit previously-moved eligibility path is exercised. No first-rank, transformed-pawn, blocked-path, or rotated-board coverage. Finite clean path is not proof of general correctness. Prior finding catalog reviewed; no duplicate or new finding.

GAME_015_DONE
