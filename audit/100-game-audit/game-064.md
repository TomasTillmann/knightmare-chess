# Game 064 — Bombard obstruction count

Pre-action hypothesis: Bombard permits a rook to cross one obstructing piece or one Fortification, but rejects crossing an adjacent piece and Fortification together because they are two obstructions. One normal beforeMove game will establish the Fortification through public actions, inspect returned Bombard targets, then probe the double and single obstruction paths. No game actions executed yet.

## Executed evidence

Scaffold executed first: `SCAFFOLD_OK probes=4 findings=0`.
Authoritative grounds: cards.md Bombard permits jumping one piece or obstruction, leaving it intact; Fortification permits a jumping card to cross its boundary. Catalog timing: Bombard beforeMove; Fortification afterMove.

Exact initial options: `{"fen":"7k/8/8/8/8/8/P7/R6K w - - 0 1","hands":{"white":["fortification","bombard","bombard"]}}`. Normal defaults only. Initial checkState passed; both kings were not in check. Every subsequent state passed checkState.

Initial legalDests: a1→b1,c1,d1,e1,f1,g1; h1→g1,g2,h2; a2→a3,a4.

| # | Exact action | Prediction and actual |
|---|---|---|
|1|`{"type":"move","from":"h1","to":"g1"}`|Accepted; white afterMove.|
|2|`{"type":"playCard","cardId":"fortification","target":{"from":"a3","to":"a4"}}`|Accepted; persistent wall created. Selected from 210 returned Fortification targets.|
|3|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|4|`{"type":"move","from":"h8","to":"g8"}`|Accepted; black afterMove.|
|5|`{"type":"endTurn"}`|Accepted; white beforeMove.|
|6|`{"type":"playCard","cardId":"bombard","target":[{"from":"a1","to":"a4"}]}`|Expected rejection for pawn a2 plus wall a3–a4; rejected ILLEGAL_MOVE: Bombard can jump only one piece or obstruction. Digest unchanged.|
|7|`{"type":"playCard","cardId":"bombard","target":[{"from":"a1","to":"a3"}]}`|Expected one-piece jump; accepted and rook immediately at a3, white afterMove with moveMade=true.|
|8|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|9|`{"type":"move","from":"g8","to":"f8"}`|Expected legal seeded continuation; accepted.|
|10|`{"type":"endTurn"}`|Accepted; white beforeMove.|
|11|`{"type":"playCard","cardId":"bombard","target":[{"from":"a3","to":"a5"}]}`|Expected one-wall jump; accepted and rook immediately at a5, white afterMove with moveMade=true.|

Before #6, Bombard returned a1→b1,c1,d1,e1,f1,h1,a3 (each as a one-element move array); double-obstruction a4 absent and selected #7 present. Before #11 it returned a3→a1,b3,c3,d3,e3,f3,g3,h3,a4,a5,a6,a7,a8; selected a5 present. Pawn a2 and wall a3–a4 remained intact after both successful jumps.

Seeded continuation: seed 64; `(Math.imul(seed,1664525)+1013904223)>>>0` = 1120433823; index modulo 5 = 3 in returned black king targets f7,g7,h7,f8,h8, selecting f8.

Results: exactly one game; 11 actions, 10 accepted, 1 rejected; 31.346375 ms measured game execution, scaffold four probes with zero findings. No mismatches. No temporary harnesses created.

Limitations: this finite path uses a pawn on a2 and wall a3–a4, with a3 between the piece and wall; it does not establish the stricter case of a wall directly incident to the occupied a2 square. No capture or multiple-wall cases executed. A finite clean path is not proof of correctness.

GAME_064_DONE
