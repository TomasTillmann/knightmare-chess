# Game 017 — Dubbing promotion

Pre-action hypothesis (corrected before actions after reading rules §13.2 and Dubbing): Dubbing permits a pawn to land on its promotion rank by a knight move but does NOT promote there, because it does not authorize promotion. Pacifism should prohibit a capture by that move if active. Scaffold executed: four probes, zero findings. One normal beforeMove game will enumerate focal targets and continue the same game. Initial options: `{"fen":"7k/8/3P4/8/8/8/8/K7 w - - 0 1","hands":{"white":["pacifism","dubbing"]}}`. Initial checkState passed. Initial enumeration mistakenly used instance IDs; it is not focal-card evidence and is corrected on the same game before actions.

Both cards have catalog timing beforeMove. Correct Pacifism targets were `["d6"]`. Dubbing targets at action 6 were the one-element lists a2→c1/c3/b4 and d6→c4/e4/b5/f5/b7/f7/c8/e8. Selected returned `[{"from":"d6","to":"c8"}]`. Prediction before action 6: unpromoted pawn arrives c8, retains Pacifism, consumes the move. This matches rules §13.9: Knight geometry, no captures, no promotion, marker retention.

Exact sequential actions (all accepted, each followed by checkState):

1. `{"type":"playCard","cardId":"pacifism","target":"d6"}`
2. `{"type":"move","from":"a1","to":"a2"}`
3. `{"type":"endTurn"}`
4. `{"type":"move","from":"h8","to":"h7"}`
5. `{"type":"endTurn"}`
6. `{"type":"playCard","cardId":"dubbing","target":[{"from":"d6","to":"c8"}]}`
7. `{"type":"endTurn"}`
8. `{"type":"move","from":"h7","to":"g8"}`
9. `{"type":"endTurn"}`
10. `{"type":"move","from":"a2","to":"b1"}`
11. `{"type":"endTurn"}`
12. `{"type":"move","from":"g8","to":"h8"}`

Actions 7–12 continued the same game using seed 17, `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, indexing flattened legalDests by seed modulo move count. The sole game was serialized directly from its initial API output to continue in the second process; it was never recreated or reset.

Observed immediately after action 6: white-pawn-d6 remains owner white, role/originalRole pawn, square c8, board zone, promoted false, royal false, neutral false. Pacifism effect still refers to white-pawn-d6. Turn is white afterMove, moveMade true, cardPlays white 1. After continuation the same pawn and effect remain, final FEN `2P4k/8/8/8/8/8/8/1K6 w - - 3 4`.

Result: zero findings; 12 accepted / 0 rejected game actions, four separate baseline scaffold probes. Measured game-action process wall time 28 ms; overall agent turnaround exceeded 45-second target (approximately two minutes). Capture prohibition was not exercised because this sparse game offered no relevant occupied Knight destination; no claim about that behavior. Finite clean path is not proof of correctness. Prior findings reviewed; none reproduced. No temporary harnesses created.

GAME_017_DONE
