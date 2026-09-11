# Game 073: Merciless castling rook and Bog

Pre-action hypothesis: after White castles queenside (Ke1-c1, Ra1-d1), Merciless may move the castling rook d1-h1 immediately. Black's Bog should pull that rook to b1, measuring the combined a1-h1 displacement, while leaving the king on c1. This is one normal beforeMove game, with at most 20 actions.

Scaffold executed successfully: 4 probes, zero findings.

## Setup and rule grounds

Exact `createGameState` options: `{"fen":"4k3/8/8/8/8/8/8/R3K3 w Q - 0 1","hands":{"white":["merciless"],"black":["bog"]},"decks":{"white":[],"black":[]}}`. Default normal beforeMove timing. Initial structural check passed; both kings were independently not in check. No state injection, reset, replay, harness, or test access occurred.

`rules.md` §21.3 explicitly permits the castling rook's extra Merciless move with king fixed. `cards.md` Bog stops a rook moving at least two squares after one square. The parent supplied the official FAQ ruling that Bog considers combined Merciless displacement; this report did not independently fetch that FAQ. Therefore the b1 destination conclusion depends on that supplied ruling, while the timing rejection itself is directly reproduced. Not a duplicate of findings in `audit/2026-09-08/README.md`.

## Single sequential game

Before action 1, legalDests enumerated e1-c1 (also castling alias e1-a1). After castling, Merciless targets were d1 to e1/f1/g1/h1/d2/d3/d4/d5/d6/d7/d8. Selected returned target `[{"from":"d1","to":"h1"}]`. Bog targets enumerated `[undefined]` (JSON output `[null]`); no target was sent.

| # | Exact action | Result and state evidence |
| --- | --- | --- |
| 1 | `{"type":"move","from":"e1","to":"c1"}` | Accepted; white king c1, physical rook white-rook-a1 d1; FEN `4k3/8/8/8/8/8/8/2KR4 b - - 1 1`. White afterMove, moveMade true. |
| 2 | `{"type":"playCard","cardId":"merciless","target":[{"from":"d1","to":"h1"}]}` | Accepted; rook h1, king c1; FEN `4k3/8/8/8/8/8/8/2K4R b - - 1 1`; white card allowance 1, black 0. Merciless event is cardPlayed with movement d1-h1, movedPieceId white-rook-a1, previousFen post-castling. |
| 3 | `{"type":"playCard","cardId":"bog"}` | **Unexpected rejection:** INVALID_TIMING, “Bog must immediately follow your opponent's move.” Digest unchanged. Rook remains h1 rather than expected b1; king c1 as expected. |
| 4 | `{"type":"move","from":"b1","to":"b2"}` | Rejected ILLEGAL_MOVE, “The regular move has already been made.” Digest unchanged. Limited probe: b1 is empty after rejected Bog, so this does not isolate third-move prevention independently. |
| 5 | `{"type":"endTurn"}` | Accepted; black beforeMove. |
| 6 | `{"type":"move","from":"e8","to":"d8"}` | Accepted; FEN `3k4/8/8/8/8/8/8/2K4R w - - 2 2`. |
| 7 | `{"type":"endTurn"}` | Accepted; white beforeMove. |
| 8 | `{"type":"move","from":"c1","to":"c2"}` | Accepted; FEN `3k4/8/8/8/8/8/2K5/7R b - - 3 2`. |
| 9 | `{"type":"endTurn"}` | Accepted; black beforeMove; same final FEN. |

Actions 6–9 are a bounded continuation of the same game, selecting from current legalDests using seed 73 and LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, index `seed % moves.length`. Structural checks passed after all seven accepted actions. Both rejections preserved input digests.

## Finding and limits

P2: Bog cannot react to a castling rook's Merciless move, despite its target enumeration exposing the targetless play. The reproduced error occurs before displacement resolution. `src/game/reducer.ts` playBog requires the reaction event to have type move; Merciless records cardPlayed, explaining the timing failure. The exact expected b1 rollback is based on the parent-provided FAQ interpretation and was not reached by the engine.

Executed counts: scaffold 4 probes; one independent game, 9 actions (7 accepted, 2 rejected), 1 timing finding. Measured single-game execution wall time 25.174 ms (command wall 0.0283 s). Assignment/report preparation took approximately one minute and exceeded the target 45-second turnaround. No temporary files were created. A finite path does not prove broader correctness.

GAME_073_DONE
