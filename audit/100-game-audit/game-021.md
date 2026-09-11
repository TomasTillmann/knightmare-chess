# Game 021 — Doppelganger quiet Pawn imitation

Pre-action hypothesis: after Black quietly advances a Pawn, White's Knight on d4 can use Doppelganger to advance quietly to d5, since only a moving Pawn is excluded by the card. A blanket WRONG_ROLE rejection would incorrectly exclude copying the opponent Pawn. Fresh position; one game only, maximum 15 actions.

## Confirmed: legal quiet Pawn imitation rejected

cards.md Doppelganger and rules.md §21 exclude a Pawn mover, not copying a Pawn. Parent inspected artwork `final_cards/KC4_card4.png` and supplied the same interpretation. On the empty d5 square, White's Knight should be able to imitate a White Pawn's quiet advance after Black moved g7–g6. Targets instead were empty and the explicitly submitted quiet move returned `WRONG_ROLE: Doppelganger cannot copy a Pawn.` This independently confirms the same family as game-016, whose direct attempt was a capture. Not a duplicate of the older audit/2026-09-08 findings.

Exact options: `{"fen":"7k/6p1/8/8/3N4/8/P7/K7 b - - 0 1","hands":{"white":["doppelganger"]}}`. Default normal beforeMove. Initial checkState passed; both Kings independently tested not in check. Catalog timing beforeMove read before enumeration. Handler `parseCardMoves(target, 1)` confirmed one-element move-array schema before direct probe.

| # | Exact action | Prediction | Actual |
|---|---|---|---|
|1|`{"type":"move","from":"g7","to":"g6"}`|Legal Pawn advance|Accepted|
|2|`{"type":"endTurn"}`|White beforeMove|Accepted|
|3|`{"type":"playCard","cardId":"doppelganger","target":[{"from":"d4","to":"d5"}]}`|Allowed quiet Knight imitation of Pawn|Rejected WRONG_ROLE|
|4|`{"type":"move","from":"d4","to":"e6"}`|Enumerated legal continuation|Accepted|
|5|`{"type":"endTurn"}`|Turn transition|Accepted|
|6|`{"type":"move","from":"h8","to":"g8"}`|Enumerated legal continuation|Accepted|
|7|`{"type":"endTurn"}`|Turn transition|Accepted|

After action 2, `cardPlayTargets(s,"doppelganger")=[]`; expected inclusion of `[{"from":"d4","to":"d5"}]`. Actual legalDests: `[["a1",["b1","b2"]],["a2",["a3","a4"]],["d4",["c2","e2","b3","f3","b5","f5","c6","e6"]]]`. Continuation seed 210908, LCG `seed=(imul(seed,1664525)+1013904223)>>>0`, selected flattened legalDests at seed modulo count.

Counts: one game, one adversarial group, seven actions, six accepted, one rejected; checkState passed after each acceptance and rejected-action digest remained unchanged. Game execution measured 21.344292 ms; total agent phase approximately 65 seconds (45-second target exceeded). Scaffold: four probes, zero findings, executed immediately after protocol read rather than in the first tool invocation. No reset/replay, harness edits, or production changes. A broad production-directory rg inadvertently returned test-source matches; they were not used for scenario or expectation and no test file was opened. This is a protocol deviation. Final FEN `6k1/8/4N1p1/8/8/8/P7/K7 w - - 2 3`, outcome null. Finite path does not prove general correctness.

GAME_021_DONE
