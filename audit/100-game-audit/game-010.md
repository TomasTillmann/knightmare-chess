# Game 010 — Madman and Forbidden City

Pre-action hypothesis: Madman's jumps may cross the central forbidden squares, but may not land there; promotion must occur only when a legal jump finishes on the last rank. I will inspect returned card targets and moves before choosing actions, and compare the transformed pawn's movement and promotion with the printed rule.

Parent scaffold executed: four probes, zero findings.

## Result

No confirmed state corruption. The initial promotion prediction was WRONG: rules.md §13.2 explicitly says a Pawn moved to its last rank by another means does not promote unless the card authorizes it. Madman does not authorize promotion. Keeping the pawn at c8 unpromoted is correct, and all jumped pieces survived.

Qualified target-enumeration discrepancy: `cardPlayTargets(state, "madman")` returned c4-e6-g8 although e6 had an active Forbidden City marker. Printed Forbidden City rules prohibit landing there, and production playMadman explicitly rejects routes landing there. I selected the alternative c4-a6-c8 route, so rejection of the advertised e6 route was not executed. This is a candidate legal-option inconsistency, not confirmed invalid accepted movement. It is not listed in the earlier audit summary.

The initial fixture FEN/turn mismatch is a driver setup limitation, excluded from findings. After Black moved, structural checks passed throughout. No reset/recreation occurred; the saved exact state continued in a second process. Seeded continuation: 1010, LCG 1664525/1013904223. Total 15 accepted actions, zero rejected; four scaffold probes. Continuation measured 46 ms; total agent phase approximately 110 seconds, exceeding the 45-second target. e6 stayed empty throughout. This finite path does not prove correctness.

## Sequential evidence

```text
BLACK_LEGAL [{"type":"move","from":"d5","to":"c4"},{"type":"move","from":"d5","to":"d4"},{"type":"move","from":"b7","to":"b6"},{"type":"move","from":"f7","to":"f5"},{"type":"move","from":"f7","to":"f6"},{"type":"move","from":"a8","to":"a7"},{"type":"move","from":"a8","to":"b8"}]
{"prediction":"legal black move preserves jump hurdles","action":{"type":"move","from":"a8","to":"a7"},"ok":true}
{"prediction":"white gets turn","action":{"type":"endTurn"},"ok":true}
MADMAN_TARGETS [[{"from":"c4","to":"a6"},{"from":"a6","to":"c8"}],[{"from":"c4","to":"e6"},{"from":"e6","to":"g8"}],[{"from":"b5","to":"d3"}]]
{"prediction":"c4-a6-c8 jump promotes; hurdles survive; e6 remains forbidden","action":{"type":"playCard","cardId":"madman","target":[{"from":"c4","to":"a6"},{"from":"a6","to":"c8"}]},"ok":true}
{"prediction":"turn advances","action":{"type":"endTurn"},"ok":true}
{"prediction":"legal move accepted; forbidden e6 stays empty","action":{"type":"move","from":"d5","to":"d4"},"ok":true}
{"prediction":"turn advances","action":{"type":"endTurn"},"ok":true}
{"prediction":"legal move accepted; forbidden e6 stays empty","action":{"type":"move","from":"h1","to":"g1"},"ok":true}
{"prediction":"turn advances","action":{"type":"endTurn"},"ok":true}
{"prediction":"legal move accepted; forbidden e6 stays empty","action":{"type":"move","from":"a7","to":"a8"},"ok":true}
{"prediction":"turn advances","action":{"type":"endTurn"},"ok":true}
{"prediction":"legal move accepted; forbidden e6 stays empty","action":{"type":"move","from":"g1","to":"h2"},"ok":true}
{"prediction":"turn advances","action":{"type":"endTurn"},"ok":true}
{"prediction":"legal move accepted; forbidden e6 stays empty","action":{"type":"move","from":"a8","to":"b8"},"ok":true}
COUNTS {"accepted":15,"rejected":0,"wallMs":46}

```

Final observed state:
```json
{"fen":"1kP5/1p3p2/8/1P6/3p4/8/7K/8 w - - 4 5","turn":{"color":"black","phase":"afterMove","moveMade":true,"cardPlays":{"white":0,"black":0}},"pieces":[{"id":"white-king-h1","owner":"white","role":"king","originalRole":"king","square":"h2","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"white-pawn-c4","owner":"white","role":"pawn","originalRole":"pawn","square":"c8","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-b5","owner":"white","role":"pawn","originalRole":"pawn","square":"b5","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-d5","owner":"black","role":"pawn","originalRole":"pawn","square":"d4","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-king-a8","owner":"black","role":"king","originalRole":"king","square":"b8","zone":"board","promoted":false,"royal":true,"neutral":false}],"effects":[{"type":"forbidden-city","owner":"white","card":{"id":"white-hand-0-forbidden-city","cardId":"forbidden-city"},"square":"e6"}]}
```



Initial options: `{"fen":"k7/1p3p2/8/1P1p4/2P5/8/8/7K w - - 0 1","phase":"afterMove","moveMade":true,"hands":{"white":["forbidden-city","madman"]}}`.

Setup limitation: afterMove fixture retained White in FEN despite its move being declared complete. Forbidden City e6 and endTurn were accepted, then structural validation noticed FEN/turn mismatch. This is an inconsistent custom fixture, not a confirmed engine defect. Continue exact resulting state; do not reset.

```json
{"fen":"k7/1p3p2/8/1P1p4/2P5/8/8/7K w - - 0 1","pieces":[{"id":"white-king-h1","owner":"white","role":"king","originalRole":"king","square":"h1","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"white-pawn-c4","owner":"white","role":"pawn","originalRole":"pawn","square":"c4","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-pawn-b5","owner":"white","role":"pawn","originalRole":"pawn","square":"b5","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-d5","owner":"black","role":"pawn","originalRole":"pawn","square":"d5","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-b7","owner":"black","role":"pawn","originalRole":"pawn","square":"b7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"f7","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-king-a8","owner":"black","role":"king","originalRole":"king","square":"a8","zone":"board","promoted":false,"royal":true,"neutral":false}],"players":{"white":{"hand":[{"id":"white-hand-1-madman","cardId":"madman"}],"deck":[],"discard":[]},"black":{"hand":[],"deck":[],"discard":[]}},"turn":{"color":"black","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},"effects":[{"type":"forbidden-city","owner":"white","card":{"id":"white-hand-0-forbidden-city","cardId":"forbidden-city"},"square":"e6"}],"history":[{"type":"cardPlayed","cardId":"forbidden-city","target":"e6"}],"orientation":0,"enPassant":[],"pendingRescue":null,"pendingDoomsayer":null,"outcome":null,"playedCards":[{"player":"white","cardInstanceId":"white-hand-0-forbidden-city"}]}
```

GAME_010_DONE
