# Game 020 — Merciless followed by Bog

Pre-action hypothesis: after a rook uses Merciless for two straight displacements, Bog must consider the entire move and leave the rook one square from its turn-start square. Merciless stays spent (official FAQ p13). I will enumerate actual targets before playing each card and compare the resulting square with the turn origin.

Parent-validated scaffold rerun: 4 probes, zero findings. One independent game, maximum 20 actions; no replay.

## Result: inconclusive because of driver mistakes

Exact initialization: `createGameState({fen:"7k/8/8/8/8/8/R7/7K w - - 0 1",hands:{white:["merciless"],black:["bog"]}})`. Default beforeMove timing, no overrides. Initial and every subsequent structural `checkState` passed. Kings h1/h8 are safe and separated.

Authoritative grounds: cards.md Merciless/Bog, catalog timing afterMove/afterOpponentMove, and parent-retrieved [official FAQ p13](https://www.sjgames.com/knightmare/KnightmareChess_FAQ.pdf). Prior audit README contains no duplicate of this topic. No confirmed semantic finding is claimed.

Legal destinations initially: h1→g1,g2,h2; a2→a1,b2,c2,d2,e2,f2,g2,h2,a3,a4,a5,a6,a7,a8. After the first move Merciless targets were arrays containing `{from:"a4",to:destination}` for destinations a1,a2,a3,b4,c4,d4,e4,f4,g4,h4,a5,a6,a7,a8. The driver chose the first returned target (a1); this was a legal choice, but wrong for the intended monotonic path. Crucially Merciless executes that target immediately; it does not grant a subsequent public regular move.

| # | Exact action | Pre-action prediction | Actual |
|---|---|---|---|
|1|`{"type":"move","from":"a2","to":"a4"}`|Accepted, rook a4|Accepted, a4, white afterMove|
|2|`{"type":"playCard","cardId":"merciless","target":[{"from":"a4","to":"a1"}]}`|Accepted, extra rook move available|Accepted; rook immediately a1; Merciless discarded|
|3|`{"type":"move","from":"a4","to":"a6"}`|Accepted, rook a6|Rejected ILLEGAL_MOVE: regular move already made. `legalDests` was empty. Driver mistake.|
|4|`{"type":"playCard","cardId":"bog"}`|Accepted, rook a3, Merciless spent|Rejected INVALID_TIMING: Bog must immediately follow opponent move. Parent correction: white afterMove is the correct reaction window, but total rook displacement from a2 to a1 is only one square.|
|5|`{"type":"endTurn"}`|Accepted, black beforeMove|Accepted; rook a1|
|6|`{"type":"move","from":"h8","to":"g7"}`|Enumerated seeded move accepted|Accepted|
|7|`{"type":"endTurn"}`|Accepted normal completion|Accepted|
|8|`{"type":"move","from":"a1","to":"g1"}`|Enumerated seeded move accepted|Accepted; rook g1|

Bog target enumeration immediately before action 4 returned `[undefined]` (JSON logged `[null]`). Parent review correction: the attempt was in the correct afterOpponentMove window, during White's afterMove phase. A rejected action does not advance state or close that window. The original total-displacement hypothesis remains untested because the rook ended a1, only one square from its turn-start a2; the chosen path cannot establish that an eligible two-square combined displacement was rejected. No reset or replay was performed.

Executed: scaffold 4 probes, independent game 8 actions (6 accepted, 2 rejected), 1 adversarial group, 3 seeded continuation actions. LCG seed 200908, update `(Math.imul(seed,1664525)+1013904223)>>>0`, final seed 812234149; select flattened legal move at seed modulo count. Measured game wall time 23.31075 ms. No temporary harness was created. This finite path is neither a clean semantic audit nor proof of correctness.

GAME_020_DONE
