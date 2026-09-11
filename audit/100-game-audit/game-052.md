# Game 052 — Betrayal of a neutral Pawn

Pre-action hypothesis: after a real capture supplies White's replacement Pawn, White can use before-move Betrayal on a neutral Black Pawn in White's half. The returned Pawn must retain its original physical identity and White ownership; the victim must become dead, lose Neutrality, and remain ineligible for Resurrection. Betrayal must preserve White's regular move.

Parent scaffold executed: 4 probes, 0 findings.

Initial options (one creation, no overrides or resets):
```json
{"fen":"7k/8/8/1p6/2Pp4/8/8/K7 b - - 0 1","hands":{"white":["neutrality","betrayal"],"black":["resurrection"]},"decks":{"white":[],"black":[]}}
```
Initial `checkState` passed; neither King checked. Rules grounds: cards.md Betrayal says replace with own captured Pawn and victim cannot return; rules.md §§15.1–15.2 preserve original ownership and end Neutrality on death. §15.5 Resurrection excludes dead pieces. Catalog timing: Neutrality afterMove; Betrayal beforeMove.

Sequential evidence (all expected accepted unless explicitly rejected):

| # | Exact action | Actual result |
|---|---|---|
|1|`{"type":"move","from":"b5","to":"c4"}`|Accepted, White physical `white-pawn-c4` captured by Black, square null.|
|2|`{"type":"endTurn"}`|Accepted, White beforeMove.|
|3|`{"type":"move","from":"a1","to":"b1"}`|Accepted, White afterMove.|
|4|`{"type":"playCard","cardId":"neutrality","target":"d4"}`|Accepted, `black-pawn-d4` stays Black and same identity, becomes neutral.|
|5|`{"type":"endTurn"}`|Accepted, Black beforeMove.|
|6|`{"type":"move","from":"h8","to":"g8"}`|Accepted, Black afterMove.|
|7|`{"type":"endTurn"}`|Accepted, White beforeMove.|
|8|`{"type":"playCard","cardId":"betrayal","target":{"pieceId":"white-pawn-c4","to":"d4"}}`|Accepted; original donor on d4, White, unpromoted pawn; original victim dead with null square, Black owner, neutral false; effects empty. White beforeMove/moveMade false retained.|
|9|`{"type":"move","from":"d4","to":"d5"}`|Accepted, same returned physical Pawn moves forward for White.|
|10|`{"type":"endTurn"}`|Accepted, Black beforeMove.|
|11|`{"type":"playCard","cardId":"resurrection","target":{"pieceId":"black-pawn-d4","to":"d6"}}`|Expected rejection; actual `INVALID_TARGET`, “Choose a captured physical piece.” Digest unchanged.|
|12|`{"type":"move","from":"g8","to":"h7"}`|Accepted seeded continuation.|
|13|`{"type":"endTurn"}`|Accepted, White beforeMove.|
|14|`{"type":"move","from":"b1","to":"a2"}`|Accepted seeded continuation.|
|15|`{"type":"endTurn"}`|Accepted, Black beforeMove.|

Exact target enumerations before focal plays: Neutrality `["d4","c4"]`; Betrayal `[{"pieceId":"white-pawn-c4","to":"d4"},{"pieceId":"white-pawn-c4","to":"c4"}]`; Resurrection `[]`. Selected targets came from the first two returned lists; the last action intentionally probed dead-piece exclusion.

Legal destination enumeration before each regular move:
1. `d4:d3; b5:b4,c4; h8:g7,h7,g8`
3. `a1:b1,a2,b2`
6. `c4:c3; d4:d3; h8:g7,h7,g8`
9. `b1:a1,c1,a2,b2,c2; d4:d5`
12. `c4:c3; g8:f7,g7,h7,f8,h8`
14. `b1:a1,c1,a2,b2,c2; d5:d6`

Seeded continuation uses seed 52 and unsigned LCG `seed = (Math.imul(seed,1664525)+1013904223)>>>0`, then `seed % moves.length` over flattened enumeration. Seeds 1100459523 and 4274191238 selected actions 12 and 14.

Critical predictions were printed before their actions. All four post-Betrayal semantic checks were true: donor identity and owner retained; victim dead with original owner and neutrality removed; regular move preserved; Neutrality effect expired. `checkState` passed after every accepted action. Final victim remained dead after rejection and continuation; no outcome was triggered.

Result: 0 findings; 15 actions, 14 accepted and 1 expected rejection; 4 scaffold probes. Measured game wall time 33.53 ms. One bounded directed, multi-card game with two seeded moves. Limitation: finite clean path does not prove universal correctness; no captured neutral donor, rescue card, transformed pawn, or orientation variation exercised. No temporary harness files were created.

GAME_052_DONE
