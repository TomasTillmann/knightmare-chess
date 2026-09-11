# Game 004 — Fanatic, Bog, Dark Mirror

Hypothesis before actions: Fanatic triple advances must not create ordinary en passant rights. Bog should constrain movement according to its printed rule even when Dark Mirror changes pawn direction. I will compare enumerated destinations and accepted moves against those expectations in one game only.

Parent scaffold executed: 4 probes, 0 findings. One game executed: 20 action probes, 13 accepted, 7 rejected; game command measured 55 ms. No confirmed bug. Intended card interaction is INCONCLUSIVE because I incorrectly supplied a move-array target to Fanatic despite its target enumeration returning square strings. No reset or replay was performed.

Rules consulted: cards.md Fanatic advances a pawn three squares without capture or en passant vulnerability; Bog truncates an opposing rook/bishop/queen move to one square; Dark Mirror enables one backwards pawn capture. The initial hypothesis about Bog constraining pawn direction was corrected by reading its actual text before play.

Exact initial options:
```json
{"fen":"1k6/8/7r/4p3/4p3/8/3P4/RK6 w - - 0 1","hands":{"white":["fanatic","bog","dark-mirror"],"black":[]}}
```

Fanatic target enumeration: `["a1","b1","d2","e4","e5","h6","b8"]`. Bog target enumeration at the attempted time: `[null]`. Dark Mirror enumeration: `[]`.

Sequential evidence (predictions were printed before every action):

| # | Action | Expected | Actual |
|---|---|---|---|
|1|playCard fanatic target `[{from:"d2",to:"d5"}]`|Pawn d5, no EP|Rejected INVALID_TARGET: choose occupied pawn square. Setup error.|
|2|endTurn|Black turn|Rejected INVALID_TIMING: regular move required.|
|3|move e5-d4|No Fanatic EP|Rejected ILLEGAL_MOVE: not under control; wrong turn, so inconclusive.|
|4|move h6-h3|Rook h3|Rejected ILLEGAL_MOVE: not under control.|
|5|playCard bog, no target|Rook stopped h5|Rejected CARD_NOT_IN_HAND for opponent responder; wrong timing.|
|6|endTurn|White turn|Rejected INVALID_TIMING.|
|7|playCard dark-mirror target `[{from:"d5",to:"e4"}]`|Backward pawn capture if timing allows|Rejected INVALID_TARGET: d5 empty.|
|8|move a1-a5|White rook a5|Accepted, matching.|
|9|endTurn|Black turn|Accepted.|
|10|move h6-h8|Black rook h8|Accepted, matching.|
|11|endTurn|White turn|Accepted.|
|12|move a5-a8|White rook a8 checks king b8|Accepted, matching.|
|13|endTurn|Black turn|Accepted.|
|14|move b8-b7|Black king b7 escapes check|Accepted, matching.|
|15|endTurn|White turn|Accepted.|
|16|move d2-d4|White pawn d4|Accepted, EP d3 linked to white-pawn-d2.|
|17|endTurn|Black turn, clear expired EP|Accepted, EP d3 retained correctly for Black opportunity; prediction needed correction.|
|18|move h8-h4|Black rook h4|Accepted, EP correctly expires.|
|19|endTurn|White turn|Accepted.|
|20|move a8-c8|White rook c8|Accepted, matching.|

Continuation used seed 904, updated with `seed=(Math.imul(seed,1664525)+1013904223)>>>0` and index `seed % moves.length` over flattened legalDests. All 13 accepted states passed checkState; all 7 rejected actions preserved digest. No semantic defect on this finite path. Final FEN: `2R5/1k6/8/4p3/3Pp2r/8/8/1K6 b - - 2 4`. Final digest: `f0a6863efa576cb0fe0f2491863825dd2de062eae50b7cd863e1da3b2f15a2d8`.

Limitations: no card was successfully played; exclusions and interactions were not actually exercised. Initial scaffold ran immediately after reading protocol rather than literally first tool call. Total agent wall time exceeded the 45-second target while persisting evidence; timed game itself was 55 ms. No temporary harness or code/test edits.

GAME_004_DONE
