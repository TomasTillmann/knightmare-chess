# Game 007: Guardian pawn movement and en passant

Pre-action hypothesis: when Guardian attaches a follower behind a pawn, a two-square pawn advance must carry that follower consistently; an opposing en-passant capture must respect Guardian protection. Legal-target enumeration will determine supported attachment shapes before any card action. No code changes.

Baseline scaffold executed: 4 probes, zero findings.

## Result: no confirmed defect

Authoritative cards.md Guardian text permits moving the pawn one or two squares and optionally bringing the piece behind it forward to remain directly behind. The follower shields the en-passant landing square. Catalog timing is beforeMove and this replaces the regular move.

Initial createGameState options: `{"fen":"7k/8/8/8/3p4/8/4P3/K3R3 w - - 0 1","hands":{"white":["guardian"]}}`.

Enumerated cardPlayTargets returned four legal alternatives: pawn e2-e3 alone, e2-e3 with rook e1-e2, e2-e4 alone, e2-e4 with rook e1-e3. Selected the existing fourth target `[{"from":"e2","to":"e4"},{"from":"e1","to":"e3"}]`.

Sequential actions, all accepted (each listed move/card followed by accepted endTurn):

1. Guardian selected target. Predicted e4 pawn/e3 rook, consumed move. Actual `7k/8/8/8/3pP3/4R3/8/K7 b - - 0 1`; white afterMove, moveMade true, enPassant empty.
2. Independent adversarial variation: black d4-e3. Prediction: normal capture of the rook on the occupied landing square, with e4 pawn surviving. Enumerated black legal moves included d4-d3/d4-e3. Actual rook captured by black, black pawn e3, white pawn e4; `7k/8/8/8/4P3/4p3/8/K7 w - - 0 2`.
3. White e4-e5. Predicted surviving pawn can advance; accepted and pawn e5.
4. Black h8-g8.
5. White a1-b1.
6. Black g8-h7.
7. White b1-a2.
8. Black h7-g6.
9. White a2-a1.

Last six moves were selected from each live legalDests Map using flattened index `(7007 + i*17) % legalCount`, i=0..5. Predicted each ordinary king relocation preserves all other pieces and structural validity; actual states agreed. Final FEN `8/8/6k1/4P3/8/4p3/8/K7 b - - 6 5`.

Counts: one game, 18 accepted actions, zero rejected actions, 18 successful checkState calls; baseline 4 probes/zero findings. Measured game runtime 33.799 ms. No reset, replay, temporary harness, production edits, or test reads. No duplicate findings. Blocked initial pawn paths, pins, and alternate follower roles remain unexercised; a finite clean path proves no universal correctness claim.

GAME_007_DONE
