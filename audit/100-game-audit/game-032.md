# Game 032 — Ghostwalk

Pre-action hypothesis: Ghostwalk permits a rook to traverse friendly pieces to an empty destination, but cannot land on an occupied square, capture, or cross enemy pieces or a Forbidden City. One normal beforeMove game will inspect returned targets and exercise the applicable limits. Parent scaffold executed successfully: four probes, zero findings.

Rules: cards.md Ghostwalk requires an otherwise legal move through friendly pieces, ending empty without capture. Forbidden City prohibits entry and traversal. Catalog timing: Ghostwalk beforeMove, Forbidden City afterMove.

Exact initial options: `{"fen":"7k/8/8/p7/P7/RP3p2/8/7K w - - 0 1","hands":{"white":["forbidden-city","ghostwalk"]}}`. No timing overrides. Initial checkState passed; both kings not in check.

Initial legalDests: `[["h1",["g1","h2"]],["a3",["a1","a2"]],["b3",["b4"]]]`.
Forbidden City target enumeration included selected `d3`: all empty squares except the moved king's g1. Ghostwalk enumeration before play was exactly `[[{"from":"a3","to":"a1"}],[{"from":"a3","to":"a2"}],[{"from":"a3","to":"c3"}],[{"from":"b3","to":"b4"}]]`. Ordinary legalDests at that moment: `[["g1",["f1","h1","f2","h2"]],["a3",["a1","a2"]],["b3",["b4"]]]`. Ghostwalk selected its returned `[{"from":"a3","to":"c3"}]` target.

| # | Exact action | Predicted / actual |
|---|---|---|
|1|`{"type":"move","from":"h1","to":"g1"}`|accept / accept|
|2|`{"type":"playCard","cardId":"forbidden-city","target":"d3"}`|accept / accept|
|3|`{"type":"endTurn"}`|accept / accept|
|4|`{"type":"move","from":"h8","to":"g8"}`|accept / accept|
|5|`{"type":"endTurn"}`|accept / accept|
|6|`{"type":"playCard","cardId":"ghostwalk","target":[{"from":"a3","to":"b3"}]}`|reject occupied friendly / ILLEGAL_MOVE empty-square requirement|
|7|`{"type":"playCard","cardId":"ghostwalk","target":[{"from":"a3","to":"a5"}]}`|reject capture / ILLEGAL_MOVE empty-square requirement|
|8|`{"type":"playCard","cardId":"ghostwalk","target":[{"from":"a3","to":"a6"}]}`|reject enemy traversal / ILLEGAL_MOVE|
|9|`{"type":"playCard","cardId":"ghostwalk","target":[{"from":"a3","to":"d3"}]}`|reject city entry / ILLEGAL_MOVE|
|10|`{"type":"playCard","cardId":"ghostwalk","target":[{"from":"a3","to":"e3"}]}`|reject city traversal / ILLEGAL_MOVE|
|11|`{"type":"playCard","cardId":"ghostwalk","target":[{"from":"a3","to":"f3"}]}`|reject capture / ILLEGAL_MOVE empty-square requirement|
|12|`{"type":"playCard","cardId":"ghostwalk","target":[{"from":"a3","to":"c3"}]}`|accept friendly traversal / accept|
|13|`{"type":"endTurn"}`|accept / accept|
|14|`{"type":"move","from":"g8","to":"h8"}`|accept / accept|
|15|`{"type":"endTurn"}`|accept / accept|
|16|`{"type":"move","from":"c3","to":"c7"}`|accept / accept|
|17|`{"type":"endTurn"}`|accept / accept|

Every rejection preserved the input digest. Every accepted state passed checkState. After Ghostwalk, rook occupied c3, friendly b3/a4 pawns and enemy f3/a5 pawns remained; d3 city persisted. White was afterMove with moveMade=true and one card play. Seeded continuation used seed 32, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, indexing enumerated public moves, with endTurn after each move.

Executed: one game, 17 actions, 11 accepted, 6 rejected; scaffold four probes. Findings: zero. Measured game wall time 46.35 ms. Limited to this rook geometry and a two-move seeded continuation; not proof of general correctness. No replay/reset or test reads.

GAME_032_DONE
