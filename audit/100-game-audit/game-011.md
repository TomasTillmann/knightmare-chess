# Game 011 — Pacifism and Fireball

Pre-action hypothesis: Pacifism prevents captures but Fireball can still remove adjacent nonking pieces indirectly; adjacent kings must survive Fireball. One game will examine returned legal targets, immediate semantic effects, and bounded continuation.

Rule correction before any game action: rules.md § Pacifism explicitly protects against indirect Fireball capture and forbids selecting a Pacifist center. Revised prediction: Pacifist pawn e4 and black King e6 survive a d5 explosion; moving white knight and black rook e5 are captured.

Result: no finding. Parent scaffold executed successfully: 4 probes, zero findings. Exactly one independently designed adversarial game executed; 17 accepted actions, 0 rejected actions, structural check after every action, measured game execution 41 ms. No resets/replays. Catalog timing inspected: Pacifism beforeMove, Fireball afterMove.

Initial options: `{"fen":"8/p7/4k3/4r3/4P3/2N5/8/K7 w - - 0 1","hands":{"white":["pacifism","fireball"]}}`; default normal beforeMove state, empty decks. Pacifism target enumeration returned `["c3","e4"]`; selected e4. Fireball target enumeration after the knight move returned `["d5"]`; selected d5. All directed moves were checked against actual legalDests.

Sequential actions (all accepted):

1. playCard pacifism target e4: pawn retained with protection.
2. move a1 b1.
3. endTurn.
4. move a7 a6.
5. endTurn.
6. move c3 d5.
7. playCard fireball target d5: capturedIds exactly `["white-knight-c3","black-rook-e5"]`; pawn e4 and black King e6 retained on board, matching revised prediction. Result FEN `8/8/p3k3/8/4P3/8/8/1K6 b - - 0 2`.
8. endTurn.
9. move e6 f5.
10. endTurn.
11. move b1 b2.
12. endTurn.
13. move f5 f4.
14. endTurn.
15. move b2 c2.
16. endTurn.
17. move f4 g3.

Actions 8–17 used same-game seeded continuation, seed 11011, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting `moves[seed % moves.length]` from legalDests iteration order and ending turns when moveMade. Final FEN `8/8/p7/8/4P3/6k1/2K5/8 w - - 5 5`, outcome null. The black King moving onto f5 is consistent with the pacifist e4 pawn being unable to attack it.

Limitations: finite path; did not exercise a rejected Pacifist explosion center or promotion. No correctness proof or new confirmed bug. Prior-audit findings index inspected; none duplicated by this clean result.

GAME_011_DONE
