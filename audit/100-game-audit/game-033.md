# Game 033 — Irresistible Force

Hypothesis: an edge push captures a nonroyal victim, cannot push a king off-board, and must respect a Pacifism-protected victim.

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Parent scaffold rerun: `SCAFFOLD_OK probes=4 findings=0`.

Exact initial options (one game, normal beforeMove defaults):
```json
{"fen":"b1k4N/n1n4n/P1P4P/8/8/6p1/8/4K3 w - - 0 1","hands":{"white":["pacifism","irresistible-force","irresistible-force"],"black":[]}}
```
`checkState` passed; both kings initially not in check. No injected effects or timing. Rule grounds: cards.md Irresistible Force says the edge piece is taken and a King cannot be pushed; Pacifism says its marked piece cannot be captured. Both cards' catalog timing is beforeMove.

Pre-action predictions were printed before each call. Public Pacifism targets were `["a6","c6","h6","h8"]`. After playing it, legalDests enumerated e1→d1/f1/d2/e2 and h8→g6/f7.

| # | Exact action | Prediction and actual |
|---|---|---|
|1|playCard pacifism, target `"h8"`|Accepted as expected, marker attached to white-knight-h8; beforeMove retained.|
|2|move e1→f1|Accepted as expected.|
|3|endTurn|Accepted; black beforeMove.|
|4|move g3→g2|Accepted as expected. This checks white's f1 King.|
|5|endTurn|Accepted; white beforeMove.|
|6|playCard irresistible-force, target `[{"from":"c6","to":"c7"}]`|Predicted King obstruction rejection; actual INVALID_TARGET, “A King cannot be pushed.”|
|7|playCard irresistible-force, target `[{"from":"h6","to":"h7"}]`|Predicted Pacifism edge-capture rejection; actual INVALID_TARGET, “The last piece cannot be taken.”|
|8|move f1→f2|Seeded enumerated legal move, accepted as predicted.|
|9|endTurn|Accepted as predicted.|
|10|move c8→d8|Seeded enumerated legal move, accepted as predicted.|
|11|endTurn|Accepted as predicted; white beforeMove.|

Before action 6, `cardPlayTargets(s,"irresistible-force")` returned `[]`. The intended a6→a7 edge-capture target was therefore not played. Explanation: g3→g2 checked f1, and that push cannot rescue the King. This is an audit-driver coverage limitation, not an engine finding. Rejection messages independently confirmed King obstruction and protected terminal victim handling. Rejected actions preserved the input digest. All accepted states passed checkState.

The four-action continuation used seed 33 and `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting `moves[seed%moves.length]` from flattened legalDests for each move. Exact final FEN: `b2k3N/n1n4n/P1P4P/8/8/8/5Kp1/8 w - - 2 3`.

Counts: 11 game actions, 9 accepted, 2 rejected; 4 separate saved-fixture scaffold probes; zero findings. Measured game wall time: 35 ms (command process 0.015 s reported by runner). Successful unprotected nonroyal edge capture remained unexecuted; no reset/replay or second game was attempted. Finite coverage does not establish general correctness.

GAME_033_DONE
