# Game 014 — Bog slider capture

Pre-action hypothesis: Bog responding to a rook capture over multiple squares should restore the captured piece and stop the rook one square from its starting square. A Man-Trap at the original capture destination must not continue to capture a rook whose move is replaced by Bog. Scaffold executed: four probes, zero findings.

## Executed game

Exact createGameState options: `{"fen":"7k/8/8/n7/8/8/8/R6K b - - 0 1","hands":{"black":["man-trap","bog"]}}`. Default beforeMove setup. Initial checkState passed; isKingInCheck false for both colors.

Authoritative grounds: cards.md Bog stops an opponent Rook/Bishop/Queen after one square instead of its planned move of at least two squares. Man-Trap and rules.md §19.1 capture the next opposing piece ending its move on the selected square, preserving its capture. Catalog timings: Man-Trap afterMove, Bog afterOpponentMove.

| # | Exact action | Actual result |
|---|---|---|
|1|`{"type":"move","from":"h8","to":"g8"}`|Accepted; black king g8.|
|2|`{"type":"playCard","cardId":"man-trap","target":"a5"}`|Accepted; black trap a5.|
|3|`{"type":"endTurn"}`|Accepted; white beforeMove; card allowances reset.|
|4|`{"type":"move","from":"a1","to":"a5"}`|Accepted; black knight captured by white; white rook captured by black; trap consumed.|
|5|`{"type":"playCard","cardId":"bog"}`|Rejected WRONG_ROLE: `Bog follows only a Rook, Bishop, or Queen move.` Both pieces remain captured.|
|6|`{"type":"endTurn"}`|Accepted; black beforeMove.|
|7|`{"type":"move","from":"g8","to":"f8"}`|Accepted.|
|8|`{"type":"endTurn"}`|Accepted.|
|9|`{"type":"move","from":"h1","to":"g2"}`|Accepted.|
|10|`{"type":"endTurn"}`|Accepted.|
|11|`{"type":"move","from":"f8","to":"g8"}`|Accepted.|

Before action 2, cardPlayTargets(man-trap) returned `["a5","g8"]`; selected a5. Before action 4, legalDests returned `[["a1",["b1","c1","d1","e1","f1","g1","a2","a3","a4","a5"]],["h1",["g1","g2","h2"]]]`. Before action 5, cardPlayTargets(bog) returned `[undefined]` (JSON encoded `[null]`); selected that returned no-target choice. Thus the omitted JSON target is intentional and conforms to the public target enumeration.

## Finding

P2 candidate: Bog rejects a qualifying rook move after Man-Trap captures the mover, with a misleading WRONG_ROLE error even though history identifies `movedPieceId: white-rook-a1` and the captured piece retains role rook. Expected Bog to leave rook a2 and restore knight a5 (and trap a5, since the revised move does not land there). Actual rook and knight both remain captured, Bog remains in hand. Rule text imposes no requirement that the qualifying mover survive a move-triggered effect; final classification depends on response-order interpretation. This does not match a prior finding in audit/2026-09-08/README.md.

Continuation used seed 14014, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, legal move index `seed%moves.length`, six actions in this same game. No reset/replay. Final FEN `6k1/8/8/8/8/8/6K1/8 w - - 3 4`; black afterMove. All accepted states passed checkState.

Counts: scaffold 4 probes, 0 findings; independent group 1 game, 11 actions, 10 accepted, 1 rejected, 1 candidate finding. Measured game wall time 18.443 ms; total task approximately 40 seconds. No temporary harness files were created. Only this report was written. Promotion not exercised; no general correctness claim.

GAME_014_DONE
