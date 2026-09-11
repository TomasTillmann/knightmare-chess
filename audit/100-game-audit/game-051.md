# Game 051: Winged Victory returns a Crab

Pre-action hypothesis: a Crab captured and immediately restored by Winged Victory on its owner's next turn must retain its recent Crab transformation under rules §10. The returned piece should retain forward diagonal movement; losing it would match the Hostage transformation-loss root family reported by game 027. (Corrected shorthand “sideways” to the authoritative forward diagonal movement before documenting results.)

Scaffold: parent-validated four-probe scaffold executed, zero findings.

## Finding: duplicate of game 027 transformation-loss family

Winged Victory returns the same physical Pawn immediately following capture, but Crab has already disappeared and does not return. This is the shared capture-expiry/restoration failure seen with Hostage in game 027, not a separate root family. Rules §10 line 224 preserves transformations rescued during capture or the immediately following move. Winged Victory ruling line 654 explicitly applies §10. Crab card grants forward one-square diagonal movement permanently. The returned piece rejects an empty forward diagonal and accepts a straight advance.

Initial options: `{"fen":"7k/8/8/8/1p6/2P5/8/K7 w - - 0 1","hands":{"white":["crab","winged-victory"]}}`. Normal beforeMove, initial checkState passed, both king-check queries false. Initial legalDests `[["a1",["b1","a2","b2"]],["c3",["b4","c4"]]]`.

Exact action/result sequence:

1. `{"type":"move","from":"a1","to":"a2"}` accepted, white afterMove.
2. `{"type":"playCard","cardId":"crab","target":"c3"}` accepted, effect bound to `white-pawn-c3`. Targets enumerated `["c3"]`; catalog afterMove timing verified.
3. `{"type":"endTurn"}` accepted, black beforeMove.
4. `{"type":"move","from":"b4","to":"c3"}` accepted. Capture legalDests `[["b4",["b3","c3"]],["h8",["g7","h7","g8"]]]`. Pawn captured by black; effects unexpectedly become empty.
5. `{"type":"endTurn"}` accepted, white beforeMove.
6. `{"type":"playCard","cardId":"winged-victory","target":{"pieceId":"white-pawn-c3","to":"e4"}}` accepted, white afterMove with moveMade true. Targets enumerated `[{"pieceId":"white-pawn-c3","to":"d4"},{"pieceId":"white-pawn-c3","to":"e4"},{"pieceId":"white-pawn-c3","to":"d5"},{"pieceId":"white-pawn-c3","to":"e5"}]`; selected returned target matching catalog beforeMove timing. Before applying, predicted restored Crab with e4-d5 accepted and e4-e5 rejected on its next available move. Actual same pawn returned e4, effects empty.
7. `{"type":"endTurn"}` accepted, black beforeMove.
8. `{"type":"move","from":"h8","to":"h7"}` accepted.
9. `{"type":"endTurn"}` accepted, white beforeMove. Returned legalDests `[["a2",["a1","b1","a3","b3"]],["e4",["e5"]]]`; expected Crab destinations d5/f5.
10. `{"type":"move","from":"e4","to":"d5"}` rejected `ILLEGAL_MOVE: That is not a legal chess move.` White remains beforeMove. Unexpected rejection directly demonstrates loss of Crab movement.
11. `{"type":"move","from":"e4","to":"e5"}` accepted, unexpectedly confirms normal Pawn movement.
12. `{"type":"endTurn"}` accepted.
13. `{"type":"move","from":"h7","to":"g8"}` accepted.
14. `{"type":"endTurn"}` accepted.
15. `{"type":"move","from":"a2","to":"b3"}` accepted.

Actions 12–15 are seeded continuation of the same game, seed 51; update `(Math.imul(seed,1664525)+1013904223)>>>0`, select `seed % moves.length` from flattened legalDests whenever moveMade is false, otherwise endTurn. checkState passed after every accepted action. No reset/replay. Exactly one independently designed adversarial game, 15 actions, 14 accepted and 1 rejected; measured game wall time 28.619 ms. Scaffold 4 probes, zero findings. Limited to immediate Crab restoration via Winged Victory; no delayed rescue or promotion tested.

GAME_051_DONE
