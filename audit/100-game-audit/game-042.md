# Game 042 — Charge first-hop Man-Trap

Hypothesis: a knight captured by Man-Trap on its first Charge landing must stay captured; the second hop must not resurrect it. A friendly occupied trap square will be vacated by an ordinary public move before the opponent charges.

Rule grounds: cards.md Charge permits two consecutive Knight moves, first without capture; Man-Trap captures the next opposing piece ending a move on its square. Catalog timing for both cards is afterMove. Each landing resolves before the next move.

Initial options (normal beforeMove; checkState passed):
```json
{"fen":"7k/7p/8/5n2/3P4/8/8/K7 w - - 0 1","hands":{"white":["man-trap"],"black":["charge"]},"decks":{"white":[],"black":[]}}
```

Scaffold executed: SCAFFOLD_OK probes=4 findings=0.
Initial legalDests: a1→b1,a2,b2; d4→d5. Before black's critical move: f5→e3,g3,d4,h4,d6,e7,g7; h6→h5; h8→g7,h7,g8.

| # | Exact action | Result |
|---|---|---|
|1|`{"type":"move","from":"a1","to":"b1"}`|Accepted; white afterMove|
|2|`{"type":"playCard","cardId":"man-trap","target":"d4"}`|Accepted; enumerated targets [b1,d4]; d4 occupied by white pawn|
|3|`{"type":"endTurn"}`|Accepted; black beforeMove|
|4|`{"type":"move","from":"h7","to":"h6"}`|Accepted; black afterMove|
|5|`{"type":"endTurn"}`|Accepted; white beforeMove|
|6|`{"type":"move","from":"d4","to":"d5"}`|Accepted; trap d4 remains and is now empty|
|7|`{"type":"endTurn"}`|Accepted; black beforeMove|
|8|`{"type":"move","from":"f5","to":"d4"}`|Accepted quiet first Knight move; trap removed; knight captured by white, square null|
|9|`{"type":"playCard","cardId":"charge","target":[{"from":"d4","to":"f3"}]}`|Rejected INVALID_TARGET: Choose an occupied square. Charge targets enumerated immediately before = []; intentional unavailable-target probe using inspected public schema; digest unchanged|
|10|`{"type":"endTurn"}`|Accepted; white beforeMove|
|11|`{"type":"move","from":"b1","to":"c1"}`|Accepted; white afterMove|
|12|`{"type":"endTurn"}`|Accepted; black beforeMove|
|13|`{"type":"move","from":"h6","to":"h5"}`|Accepted; black afterMove|
|14|`{"type":"endTurn"}`|Accepted; white beforeMove|

Actions 11–14 are seeded continuation of the same game: seed 42, uint32 LCG (1664525×seed+1013904223), indexed into flattened legalDests for moves. checkState passed after every action. Final black-knight-f5 remains captured with square null and capturedBy white. Expected capture and blocked second hop both observed; no resurrection.

Executed one adversarial game, 14 actions: 13 accepted, 1 rejected. Game measured wall time 27.015 ms; inline process 0.9 seconds. Findings: 0. No game reset/replay, no harness files created. Limited to this finite path; not a general correctness proof.

GAME_042_DONE
