# Game 10 — Peace Talks and direct checkmate

Status: complete, zero findings. Parent-validated engine scaffold executed successfully.

Prediction: canceling Pacifism on h8 restores its rook attack and immediately checkmates Black. Because Peace Talks is a regular card, the cancellation must fizzle and spend the card under rules 11.1, 11.2, and 22.6.

Initial public state: `createGameState({fen:"k7/ppp5/8/8/8/8/8/4K1NR w - - 0 1",hands:{white:["pacifism","peace-talks"]}})`.

Executed actions, all accepted:

1. `{type:"playCard",cardId:"pacifism",target:"h1"}`
2. `{type:"move",from:"g1",to:"f3"}`
3. `{type:"endTurn"}`
4. `{type:"move",from:"c7",to:"c6"}`
5. `{type:"endTurn"}`
6. `{type:"move",from:"h1",to:"h8"}`
7. `{type:"playCard",cardId:"peace-talks",target:"white-hand-0-pacifism"}`
8. `{type:"endTurn"}`

Before action 7, the prediction above was printed before calling the reducer. Position: `k6R/pp6/2p5/8/8/5N2/8/4K3 b - - 1 2`; White afterMove, outcome null; Pacifism attached to `white-rook-h1`, now h8.

Actual action 7 matched the prediction: Peace Talks moved to White's discard, the white card-play count became 1, Pacifism remained active, and history appended `{type:"cardFizzled",cardId:"peace-talks",reason:"DIRECT_MATE",movement:[],preservePreviousMove:true}`. No piece moved and outcome remained null. Action 8 correctly yielded Black beforeMove with Pacifism still active and outcome null.

The presumed missing gate is not a bug in this exercised path: the public reducer enforces it. Parent supplied an independent chessops checkmate verification of the hypothetical board without Pacifism; the move counter differs by one halfmove from the supplied hypothetical FEN, which has no bearing on mate.

Validation: `checkState` before and after every action; prior input digest unchanged after every reducer call. Scaffold separately validated one rejected invalid-square move and unchanged input. Executed one directed two-card group, 8 accepted game actions, 0 rejected game actions, 1 scaffold rejection. No randomized group was added to this narrowly directed assignment. Game execution wall time: 20.511375 ms. Final digest: `80fc269091c7d5a2b3b542579ed8c7161775b2f15548aac5dcad94f6efeed31c`. No temporary harness files created, no engine or test files read or edited.

GAME_10_DONE accepted=8 rejected=0 scaffoldRejected=1 findings=0 wallMs=20.511375
