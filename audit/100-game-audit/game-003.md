# Game 003 — Coup and Doomsayer

Hypothesis: after Coup swaps royal identity, Doomsayer must never remove the newly royal piece, and must resolve its immediate opponent choice before normal continuation. Parent scaffold executed successfully (three invalid actions rejected without mutation). One independent game will probe royal capture classification.

## Result

No finding. Exactly one game, 20 actions (18 accepted, 2 rejected), 18 successful `checkState` calls. Independent group execution measured 30 ms. Total agent elapsed approximately 40 seconds. No harness created; no source or tests edited. Bounded coverage cannot establish universal correctness.

Rules: cards.md Doomsayer excludes King and offers immediate opponent naming; Coup makes the marked piece the new King while preserving its ordinary movement.

Exact createGameState options:
```json
{"fen":"4k3/7p/8/8/8/8/P7/1N2K3 w - - 0 1","hands":{"white":["coup"],"black":["doomsayer"]}}
```

Exact ordered action JSON (all accepted except indices 6 and 7):
```json
[
{"type":"move","from":"a2","to":"a3"},
{"type":"playCard","cardId":"coup","target":"b1"},
{"type":"endTurn"},
{"type":"move","from":"h7","to":"h6"},
{"type":"playCard","cardId":"doomsayer"},
{"type":"namePiece","speaker":"white","name":"knight","losses":[{"effectId":"black-hand-0-doomsayer","pieceId":"white-knight-b1"}]},
{"type":"endTurn"},
{"type":"namePiece","speaker":"white","name":"knight","losses":[]},
{"type":"endTurn"},
{"type":"namePiece","speaker":"white","name":"pawn","losses":[{"effectId":"black-hand-0-doomsayer","pieceId":"white-pawn-a2"}]},
{"type":"move","from":"b1","to":"c3"},
{"type":"endTurn"},
{"type":"move","from":"e8","to":"f8"},
{"type":"endTurn"},
{"type":"move","from":"e1","to":"d2"},
{"type":"endTurn"},
{"type":"move","from":"f8","to":"g7"},
{"type":"endTurn"},
{"type":"move","from":"d2","to":"c2"},
{"type":"endTurn"}
]
```

Predictions were logged before interpreting each reducer result: Coup makes b1 royal; immediate Doomsayer cannot capture it as a knight; endTurn is blocked until naming; naming knight with no losses succeeds because no ordinary knight remains; subsequent pawn naming captures a3 and consumes the effect. All matched. `doomsayerTargets(state,"white","knight")` returned `[]`. Action 6 returned INVALID_TARGET (That piece cannot be captured by Doomsayer); action 7 INVALID_TIMING (opponent must name or decline); both preserved the input digest.

Actions 11–20 were seeded legal continuation using seed 303, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, index modulo flattened legalDests length. Final position: royal white knight c3, nonroyal white Prince c2, black King g7, black pawn h6; white pawn captured by black. Black to move, beforeMove, no outcome. Every accepted state passed invariant validation. Limitations: no forced mate, promotion, cancellation, or Prince loss tested.

GAME_003_DONE
