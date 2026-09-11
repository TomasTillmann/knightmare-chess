# Game 023 — No Quarter and Hostage

Pre-action hypothesis: a legal en-passant capture qualifies for No Quarter; its off-destination victim becomes dead and cannot subsequently be returned by Hostage. Exactly one game, maximum 20 public actions. Scaffold executed: four probes, zero findings.

Protocol deviation: the initial narrow card filename glob accidentally included matching test filenames and excerpts in tool output. No test edits or execution occurred; this contamination limits independence and is disclosed.

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`. Rule grounds: cards.md No Quarter makes a piece captured without a card dead and prevents card returns; Hostage replaces an opponent-captured piece with one's Pawn. Catalog timing: No Quarter afterMove; Hostage afterOpponentMove/afterOpponentCard.

Exact initial options:
```json
{"fen":"7k/1p1p4/8/4P3/8/8/8/7K b - - 0 1","hands":{"white":["no-quarter"],"black":["hostage"]}}
```
Normal beforeMove state; checkState passed, both kings independently reported not checked. No overrides, resets, or replay.

Initial legalDests: b7→b5,b6; d7→d5,d6; h8→g7,h7,g8. After black's turn, white legalDests: h1→g1,g2,h2; e5→d6,e6. Predictions printed before actions: ordinary double advance and en passant accepted; No Quarter accepted and victim becomes dead; Hostage has no targets and rejects the previously valid substitution.

Exact sequential actions and observed results:

| # | Action JSON | Result |
|---|---|---|
|1|`{"type":"move","from":"d7","to":"d5"}`|Accepted; en-passant target d6, afterMove.|
|2|`{"type":"endTurn"}`|Accepted; white beforeMove.|
|3|`{"type":"move","from":"e5","to":"d6"}`|Accepted; black-pawn-d7 captured off destination, square null.|
|4|`{"type":"playCard","cardId":"no-quarter"}`|Accepted; victim dead, square null, white cardPlays 1.|
|5|`{"type":"playCard","cardId":"hostage","target":{"pieceId":"black-pawn-d7","pawn":"b7"}}`|Rejected INVALID_TARGET: Choose a captured nonroyal physical piece. Digest unchanged.|
|6|`{"type":"endTurn"}`|Accepted.|
|7|`{"type":"move","from":"h8","to":"g8"}`|Accepted.|
|8|`{"type":"endTurn"}`|Accepted.|
|9|`{"type":"move","from":"h1","to":"h2"}`|Accepted.|
|10|`{"type":"endTurn"}`|Accepted.|
|11|`{"type":"move","from":"g8","to":"g7"}`|Accepted.|
|12|`{"type":"endTurn"}`|Accepted.|
|13|`{"type":"move","from":"h2","to":"g1"}`|Accepted.|
|14|`{"type":"endTurn"}`|Accepted.|

Before #4, actual cardPlayTargets: Hostage `[{"pieceId":"black-pawn-d7","pawn":"b7"}]`; No Quarter `[undefined]` (JSON renders this array as `[null]`). Action #4 used returned target undefined, omitted by JSON serialization. After #4 Hostage targets were `[]`; #5 intentionally reused the actual formerly valid target.

Continuation selected enumerated moves using seed 230908, updated with `(Math.imul(seed,1664525)+1013904223)>>>0`, index modulo move count. Victim remained dead throughout. checkState passed after every accepted action. Final FEN `8/1p4k1/3P4/8/8/8/8/6K1 b - - 4 4`; final digest `65288f4095e8e2c1d814465d0e80da70d53d929b7fa155b94d33cb6e2b900f17`.

Executed: scaffold 4 probes, game 14 actions (13 accepted, 1 rejected), four seeded continuation plies. Measured game wall time 33.49 ms. No findings on this path; no duplicate prior finding. Full agent/report phase exceeded the 45-second target. This finite path does not prove all response-order combinations correct, and accidental test-output exposure limits audit independence. No temporary harness created.

GAME_023_DONE
