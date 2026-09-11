# Game 044

Result: clean bounded path; 13 accepted actions, 1 rejected action, no findings. Rules grounds: cards.md Confabulation allows movement like either component; Curse limits the marked physical piece to one or two squares. Catalog timing: Confabulation beforeMove, Curse afterMove.

Hypothesis: Curse remains on its physical component after Confabulation; the composite retains the union of the cursed rook's restricted movement and the bishop's unrestricted diagonals.

Scaffold executed: 4 probes, zero findings. Initial options: `{"fen":"7k/8/8/8/8/8/3B4/K2R4 b - - 0 1","hands":{"black":["curse"],"white":["confabulation"]},"decks":{"white":[],"black":[]}}`. Both Kings initially unchecked; checkState passed.

Actions 1–3 accepted: move h8→g8, play Curse d1 after enumerating `["d1","d2"]`, endTurn. Confabulation enumerated only `[[{"from":"d1","to":"d2"}]]`. Preliminary verbal prediction incorrectly described Bishop d2→d1; the actual enumerated legal merge is Rook d1→d2, which will be selected. Expected subsequent d2→g5 diagonal legal; d2→d5 orthogonal illegal; d2→d4 legal. Curse marker must keep pieceId white-rook-d1.

Saved exact continuation state:
```json
{"fen":"6k1/8/8/8/8/8/3B4/K2R4 w - - 1 2","pieces":[{"id":"white-king-a1","owner":"white","role":"king","originalRole":"king","square":"a1","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"white-rook-d1","owner":"white","role":"rook","originalRole":"rook","square":"d1","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"white-bishop-d2","owner":"white","role":"bishop","originalRole":"bishop","square":"d2","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-king-h8","owner":"black","role":"king","originalRole":"king","square":"g8","zone":"board","promoted":false,"royal":true,"neutral":false}],"players":{"white":{"hand":[{"id":"white-hand-0-confabulation","cardId":"confabulation"}],"deck":[],"discard":[]},"black":{"hand":[],"deck":[],"discard":[]}},"turn":{"color":"white","phase":"beforeMove","moveMade":false,"cardPlays":{"white":0,"black":0}},"effects":[{"type":"curse","owner":"black","card":{"id":"black-hand-0-curse","cardId":"curse"},"pieceId":"white-rook-d1"}],"history":[{"type":"move","from":"h8","to":"g8"},{"type":"cardPlayed","cardId":"curse","target":"d1","movement":[],"preservePreviousMove":true}],"orientation":0,"enPassant":[],"pendingRescue":null,"pendingDoomsayer":null,"outcome":null,"playedCards":[{"player":"black","cardInstanceId":"black-hand-0-curse"}]}
```

Continuation actions, in exact order (all accepted except #8):
4. playCard confabulation target `[{"from":"d1","to":"d2"}]` (re-enumerated before playing).
5. endTurn.
6. move g8→h8.
7. endTurn.
8. move d2→d5: rejected ILLEGAL_MOVE, as predicted.
9. move d2→g5: accepted, as predicted.
10. endTurn.
11. move h8→g8.
12. endTurn.
13. move a1→b2.
14. endTurn.

Before #8, legalDests was `[["a1",["b1","a2","b2"]],["d2",["c1","e1","c3","e3","b4","f4","a5","g5","h6","d1","b2","c2","e2","f2","d3","d4"]]]`. This confirms unrestricted bishop diagonals and two-square rook moves, with no longer rook moves. Final effects retained Curse `pieceId:"white-rook-d1"` and Confabulation `pieceIds:["white-bishop-d2","white-rook-d1"]`. checkState passed after every accepted action. Continuation #10–14 used seed 44, LCG `(1664525*seed+1013904223) mod 2^32`, enumerated public moves, and modulo selection.

Measured engine wall time: initial segment 9.399 ms; continuation 23.651 ms; total 33.050 ms (excludes tool and report overhead). One game only, loaded saved exact state for continuation; no reset/replay. Limits: king-capture/check boundaries and marker cancellation were not exercised; bounded clean evidence is not proof. No duplicate findings.

GAME_044_DONE
