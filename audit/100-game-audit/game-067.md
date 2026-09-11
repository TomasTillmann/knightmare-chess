# Game 067: Resurrection of a captured promoted Pawn

Pre-action hypothesis: a white Pawn promoted to Knight, then captured, should be resurrectable on a Knight starting square (b1/g1); resurrection must retain its ID and Knight role/promotion. The game will use real promotion and capture moves from a normal beforeMove sparse position. Earthquake orientation variation is optional within the action budget.

## Executed setup and grounds

Scaffold executed first: `SCAFFOLD_OK probes=4 findings=0`. Report was absent before its first patch. Exactly one game was initialized, with no injected timing/effects/history:

```json
{"fen":"1r6/P7/7k/8/8/8/8/7K w - - 0 1","hands":{"white":["resurrection"],"black":["earthquake"]},"decks":{"white":[],"black":[]}}
```

Initial `checkState` passed; `isKingInCheck` returned false for both owners. White began beforeMove, moveMade=false, both card allowances zero. Rules §15.5 require promoted type starting squares, adjusted for orientation, permanent promotion and unchanged physical identity. Rules §14.1 require owner-relative orientation rotation. Catalog: Earthquake afterMove; Resurrection beforeMove (replacement move per rules).

## Action evidence

Predictions below were supplied to the inline driver before their action executed. Every accepted state passed `checkState`.

| # | Exact public action | Prediction and actual result |
|---|---|---|
| 1 | `{"type":"move","from":"a7","to":"a8","promotion":"knight"}` | Accepted as predicted; white-pawn-a7 becomes role=knight, originalRole=pawn, promoted=true, board a8. |
| 2 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 3 | `{"type":"move","from":"b8","to":"a8"}` | Accepted; same promoted Knight captured, square=null. |
| 4 | `{"type":"playCard","cardId":"earthquake","target":{"direction":"clockwise","promotions":[]}}` | Accepted after Black move; orientation=90; captured Knight unchanged. |
| 5 | `{"type":"endTurn"}` | Accepted; White beforeMove, legal Resurrection window. |
| 6 | `{"type":"playCard","cardId":"resurrection","target":{"pieceId":"white-pawn-a7","to":"d2"}}` | Predicted rejection; INVALID_TARGET, “Choose an empty, unmarked starting square for that piece.” Digest unchanged. |
| 7 | `{"type":"playCard","cardId":"resurrection","target":{"pieceId":"white-pawn-a7","to":"a7"}}` | Accepted; same identity/owner/originalRole/promotion, Knight at a7; move consumed, White afterMove and cardPlays.white=1. |
| 8 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 9 | `{"type":"move","from":"h6","to":"h7"}` | Enumerated seeded move accepted. |
| 10 | `{"type":"endTurn"}` | Accepted; White beforeMove. |
| 11 | `{"type":"move","from":"a7","to":"b5"}` | Enumerated seeded move accepted; resurrected piece continues using Knight movement. |
| 12 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 13 | `{"type":"move","from":"a8","to":"a7"}` | Enumerated seeded move accepted. |

Before action 1, legalDests included a7→a8/b8; before action 3, b8→a8 was enumerated. Before Earthquake, actual targets were `[{"direction":"clockwise","promotions":[]},{"direction":"counterclockwise","promotions":[]}]`; selected clockwise. Before Resurrection, actual targets were `[{"pieceId":"white-pawn-a7","to":"a7"},{"pieceId":"white-pawn-a7","to":"a2"}]`. These are the two white Knight starting locations after rotation; neither Pawn second-rank enumeration nor original promotion location was used. The invalid d2 probe tested a central non-start destination, not specifically a rotated Pawn starting square.

Continuation seed=67, update `seed=(Math.imul(seed,1664525)+1013904223)>>>0`; choose flattened legalDests action at seed modulo move count. Final FEN: `8/r6k/8/1N6/8/8/8/7K w - - 4 4`; Black afterMove, orientation=90, outcome=null. White promoted Knight remains white-pawn-a7 at b5, originalRole=pawn, promoted=true, royal=false, neutral=false. Resurrection discarded exactly once; Earthquake retained as an effect.

## Result

13 game actions: 12 accepted, 1 intentionally rejected. Four scaffold probes plus initial and all accepted-state structural validation passed. Zero findings. Measured game driver wall time: 27.455 ms (shell command 0.021 s reported separately). One game only; no replay/reset, tests, harness files, or production edits. No temporary harness existed to remove. Prior audit findings were checked; none reproduced. Scope is the promoted Knight branch, clockwise orientation and one returned square; promoted Rook, opposite rotation, direct mate, and additional marker interactions were not exercised. Finite clean play does not prove correctness. Overall reading/report turnaround exceeded the 45-second target.

GAME_067_DONE
