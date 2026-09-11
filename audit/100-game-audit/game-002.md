# Game 002 — Dead-piece irreversibility

Scaffold passed: three rejected malformed actions, unchanged state digest.
Hypothesis: Disintegration makes its Pawn dead, not captured; neither Hostage nor Resurrection can return it. One sparse-position game, at most 20 actions; no code or test edits.

## Result

No engine defect found. Disintegration put `white-pawn-a2` in `dead` with null square. Hostage immediately rejected it with `INVALID_TARGET: Choose a captured nonroyal physical piece.` After one move by each side, Resurrection offered no targets and rejected explicit revival with `INVALID_TARGET: Choose a captured physical piece.` Both rejections preserved the digest. This matches cards.md Disintegration and rules.md §15.5, §22.11. `checkState` passed after all 15 actions.

Exact setup:
```json
{"fen":"4k3/7p/8/8/8/8/PP6/4K3 w - - 0 1","hands":{"white":["disintegration","resurrection","hostage"],"black":["hostage"]}}
```

Exact directed actions, predicted before execution: success/dead Pawn; rejection; success; success; success; success; rejection, respectively. All matched.
```json
[
{"type":"playCard","cardId":"disintegration","target":"a2"},
{"type":"playCard","cardId":"hostage","target":{"pieceId":"white-pawn-a2","pawn":"b2"}},
{"type":"move","from":"b2","to":"b3"},
{"type":"endTurn"},
{"type":"move","from":"h7","to":"h6"},
{"type":"endTurn"},
{"type":"playCard","cardId":"resurrection","target":{"pieceId":"white-pawn-a2","to":"a2"}}
]
```

Final FEN: `4k3/8/7p/8/8/1P6/8/4K3 w - - 0 2`; White beforeMove, moveMade false, both card counts zero. Dead Pawn retained its owner/original role/identity, unpromoted/nonroyal/nonneutral.

Limitation: seeded continuation (seed 2026090802, LCG 1664525/1013904223) incorrectly treated legalDests' Map entries as destination squares. Eight attempted continuation actions therefore exercised malformed-input rejection, not legal play. They all returned `ILLEGAL_MOVE: Move coordinates must be board squares.` with unchanged digest. This was an audit-driver error, not an engine bug; game was not restarted.

Exact malformed continuation actions:
```json
[
{"type":"move","from":"e1","to":["b3",["b4"]]},
{"type":"move","from":"e1","to":["e1",["d1","f1","d2","e2","f2"]]},
{"type":"move","from":"b3","to":["b3",["b4"]]},
{"type":"move","from":"b3","to":["e1",["d1","f1","d2","e2","f2"]]},
{"type":"move","from":"e1","to":["b3",["b4"]]},
{"type":"move","from":"e1","to":["e1",["d1","f1","d2","e2","f2"]]},
{"type":"move","from":"b3","to":["b3",["b4"]]},
{"type":"move","from":"b3","to":["e1",["d1","f1","d2","e2","f2"]]}
]
```

Counts: one game; one adversarial group; 15 action attempts (5 accepted, 10 rejected); 15 invariant checks; three independent baseline scaffold rejections. Measured probe wall time: 41 ms. No temporary harness files created.

GAME_002_DONE
