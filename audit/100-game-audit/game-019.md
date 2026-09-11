# Game 019 — Bombard/Bog

Pre-action hypothesis: a rook Bombard jump over an adjacent piece followed by opponent Bog must stop the rook on the first square beyond that obstacle (official FAQ p13). One game, max 20 actions; no test sources or production modifications.

## Result: confirmed P2 official-rule discrepancy

Bog incorrectly rejects the immediate Bombard reaction with `INVALID_TIMING: Bog must immediately follow your opponent's move.` The rook remains a6 instead of stopping a3; the adjacent pawn remains a2. Not a duplicate of the prior 2026-09-08 README findings.

Grounds: cards.md Bombard permits a rook to jump one piece, Bog shortens a rook move. The [official FAQ p13](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf), retrieved and supplied by the parent, explicitly permits Bog against Bombard and treats the first square beyond an adjacent obstacle as the stopping square. Catalog timing is Bombard beforeMove and Bog afterOpponentMove. No intervening action preceded Bog.

Scaffold executed successfully: 4 probes, 0 findings. Protocol deviation: first tool call read PROTOCOL.md; scaffold ran in the second call, within the initial 15 seconds. No harness created.

Exact initial options:
```json
{"fen":"7k/8/8/8/8/8/P7/R6K w - - 0 1","hands":{"white":["bombard"],"black":["bog"]},"decks":{"white":[],"black":[]}}
```
Initial checkState passed; both kings independently returned false from isKingInCheck. Normal white beforeMove, moveMade false, card plays zero.

Bombard target enumeration returned one-element arrays from a1 to b1,c1,d1,e1,f1,g1,a3,a4,a5,a6,a7,a8. Selected returned target `[{"from":"a1","to":"a6"}]`. Bog enumeration returned `[undefined]` (JSON `[null]`); action omitted target accordingly. Immediately before Bog, printed prediction: accepted; rook a3; pawn a2 unchanged.

| # | Exact action JSON | Result / resulting FEN |
|---|---|---|
| 1 | `{"type":"playCard","cardId":"bombard","target":[{"from":"a1","to":"a6"}]}` | accepted; `7k/8/R7/8/8/8/P7/7K b - - 1 1`; white afterMove, moveMade true |
| 2 | `{"type":"playCard","cardId":"bog"}` | rejected INVALID_TIMING; FEN unchanged; rook a6 |
| 3 | `{"type":"endTurn"}` | accepted; same FEN; black beforeMove |
| 4 | `{"type":"move","from":"h8","to":"h7"}` | accepted; `8/7k/R7/8/8/8/P7/7K w - - 2 2` |
| 5 | `{"type":"endTurn"}` | accepted; same FEN; white beforeMove |
| 6 | `{"type":"move","from":"a6","to":"g6"}` | accepted; `8/7k/6R1/8/8/8/P7/7K b - - 3 2` |
| 7 | `{"type":"endTurn"}` | accepted; same FEN; black beforeMove |
| 8 | `{"type":"move","from":"h7","to":"g6"}` | accepted; rook captured; `8/8/6k1/8/8/8/P7/7K w - - 0 3` |

Continuation used legalDests enumeration, seed 19019, LCG `(1664525*seed+1013904223)>>>0`, move index seed modulo available moves. All accepted states passed checkState. One game, 8 actions: 7 accepted, 1 rejected. No resets or replays. Engine wall time 23.631ms; overall task approximately 35 seconds. Final digest `f7b51d1969a9cda3713c02124c764e750060e6ed52a0d3c171c65c726b1f2489`.

Limitations: one adjacent friendly-pawn obstacle, no destination capture; no claim about all Bombard/Bog geometries. No tests inspected or executed. Only this report written.

GAME_019_DONE
