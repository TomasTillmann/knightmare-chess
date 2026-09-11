# Game 016 — Doppelganger pawn imitation

Pre-action hypothesis: after an opponent's ordinary pawn move, a nonpawn can copy pawn movement to its far rank while keeping its role; a capture using that imitation must be unavailable. One game, maximum 20 actions; public engine APIs only. Scaffold executed: 4 probes, zero findings.

## Result: one local-rule discrepancy

The engine excludes every target after an opponent Pawn move, contrary to cards.md Doppelganger and rules.md §21, which exclude a Pawn **mover**, not the copied opponent Pawn. A direct attempt returned `WRONG_ROLE: Doppelganger cannot copy a Pawn.` This blanket exclusion prevents the expected quiet d7–d8 Knight move. The rejected attempted capture is not independently validated: rejection occurs at the earlier copied-role gate. Far-rank retention could not execute because target enumeration returned no targets. Not a duplicate of any finding listed in audit/2026-09-08/README.md. Artwork was not available under public; discrepancy is grounded in local rules and catalog text.

Exact initial options: `{"fen":"4r2k/1p1N4/8/8/8/8/P7/K7 b - - 0 1","hands":{"white":["doppelganger"]}}`. Default beforeMove; no setup overrides. Initial checkState passed; neither King checked. Catalog timing `beforeMove` was read before cardPlayTargets/play. Public target schema was verified as a one-element move array.

| # | Exact action | Prediction | Result |
|---|---|---|---|
|1|`{"type":"move","from":"b7","to":"b6"}`|Legal Pawn move|Accepted|
|2|`{"type":"endTurn"}`|White beforeMove|Accepted|
|3|`{"type":"playCard","cardId":"doppelganger","target":[{"from":"d7","to":"e8"}]}`|Reject capture|Rejected WRONG_ROLE, copied Pawn prohibited|
|4|`{"type":"move","from":"a1","to":"b2"}`|Enumerated legal continuation|Accepted|
|5|`{"type":"endTurn"}`|Turn transition|Accepted|
|6|`{"type":"move","from":"e8","to":"f8"}`|Enumerated legal continuation|Accepted|
|7|`{"type":"endTurn"}`|Turn transition|Accepted|
|8|`{"type":"move","from":"d7","to":"b8"}`|Enumerated legal continuation|Accepted|
|9|`{"type":"endTurn"}`|Turn transition|Accepted|

After action 2, actual `cardPlayTargets(s,"doppelganger")=[]`; expected it to include `[{"from":"d7","to":"d8"}]` (empty destination, Knight mimicking its own color's Pawn geometry). No guessed quiet target was played. `legalDests` was `[["a1",["b1","b2"]],["a2",["a3","a4"]],["d7",["c5","e5","b6","f6","b8","f8"]]]`. Knight remained d7 and unpromoted after rejection. Continuation used seed 160908, LCG `seed=(imul(seed,1664525)+1013904223)>>>0`, flattened legalDests selection `seed % moves.length`.

Counts: one game; 9 actions, 8 accepted, 1 rejected; checkState passed after every acceptance. One independently designed adversarial group. Game execution wall time 26 ms; scaffold execution also passed (4 probes, zero findings). Final FEN `1N3r1k/8/1p6/8/8/8/PK6/8 b - - 3 3`, outcome null. No reset, replay, test reads, or harness creation. Finite path does not establish general correctness. Total agent phase approximately 45 seconds.

GAME_016_DONE
