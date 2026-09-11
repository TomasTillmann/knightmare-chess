# Game 061 — Split Knight composite sacrifice

Pre-action hypothesis: after Confabulation merges a Knight and another friendly piece, Split Knight should sacrifice every component and capture multiple eligible knight-reachable enemies. A royal victim must remain unavailable. Exactly one normal beforeMove game will exercise this interaction.

Scaffold executed successfully: 4 probes, zero findings. One game completed: 10 actions, 9 accepted and 1 intentionally rejected; zero findings. Measured game execution wall time: 55.846 ms (entire inline process approximately 0.5 seconds). Overall reading/report time was not instrumented.

Rule grounds: cards.md Confabulation gives the merged piece both identities and susceptibility to cards; Split Knight captures at least two eligible opposing pieces and sacrifices its Knight. rules.md says removed pieces are normally captured and Kings cannot be captured. Catalog timing: both cards are beforeMove; the movement executes immediately.

Exact initial options:
```json
{"fen":"7k/p7/2p1p3/8/3R4/8/2N5/K7 w - - 0 1","hands":{"white":["confabulation","split-knight"],"black":[]},"decks":{"white":[],"black":[]}}
```
Initial checkState passed; neither King checked. No turn/phase/effect overrides. Initial legalDests: a1→b1,a2,b2; c2→e1,a3,e3,b4; d4→d1,d2,d3,a4,b4,c4,e4,f4,g4,h4,d5,d6,d7,d8.

Exact sequential actions and results (predictions printed before actions):

| # | Public action | Prediction and actual |
|---|---|---|
|1|`{"type":"playCard","cardId":"confabulation","target":[{"from":"c2","to":"d4"}]}`|Accepted as predicted: Knight becomes away component, rook carrier remains d4, Confabulation references both IDs, white afterMove/moveMade=true/cardPlays=1.|
|2|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|3|`{"type":"move","from":"h8","to":"g8"}`|Accepted quiet King move; black afterMove.|
|4|`{"type":"endTurn"}`|Accepted; white beforeMove with zero card allowance used.|
|5|`{"type":"playCard","cardId":"split-knight","target":{"knight":"d4","targets":["c6","g8"]}}`|Predicted rejection; actual ILLEGAL_MOVE: Every selected piece must be a legal ordinary capture by the Knight. Input digest unchanged; white remains beforeMove with zero allowance used.|
|6|`{"type":"playCard","cardId":"split-knight","target":{"knight":"d4","targets":["c6","e6"]}}`|Accepted: both enemy pawns and both composite components captured with square=null. Confabulation removed; zero away pieces. White afterMove/moveMade=true/cardPlays=1.|
|7|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|8|`{"type":"move","from":"g8","to":"h7"}`|Seeded enumerated legal move accepted.|
|9|`{"type":"endTurn"}`|Accepted; white beforeMove.|
|10|`{"type":"move","from":"a1","to":"b1"}`|Seeded enumerated legal move accepted.|

cardPlayTargets was called before both focal card plays on this same game. Confabulation returned exactly `[[{"from":"c2","to":"d4"}]]`; Split Knight returned exactly `[{"knight":"d4","targets":["c6","e6"]}]`; selected legal actions used those returned targets. Black legalDests before action 3: c6→c5; e6→e5; a7→a5,a6; h8→g7,h7,g8. Before Split Knight, d4 legalDests included both rook rays and c2,e2,b3,f3,b5,f5,c6,e6; the King had b1,a2,b2.

Semantic checkpoint after action 6 explicitly checked IDs white-knight-c2, white-rook-d4, black-pawn-c6, black-pawn-e6 all had captured zone, and no piece had away zone. No failures. Digest at that checkpoint: `1e425ca59e3b1f1ab400a44636945006d0acab495be621df120e21de8bff4c61`. Final board: white King b1, black King h7, black pawn a7; four captured pieces remain captured, effects empty, outcome null. checkState passed initially and after every accepted action.

Seeded continuation used seed 9061 with unsigned LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting index modulo flattened public legalDests count; four continuation actions included two endTurns and two moves. No resets, replay, second game, test reads or edits, or harness files.

Limitations: g8 is both royal and outside this composite's capture geometry; rejection does not independently establish royal-only exclusion. Immune victims, three-plus victims, and sacrificial self-check were not exercised. Finite clean path is not proof of correctness. No findings match prior known defects because there are no findings here.

GAME_061_DONE
