# Game 037 — Truce check expiration

Hypothesis: after a legal quiet move and after-move Truce, captures are blocked until a quiet checking move expires Truce; a capture resolving check and subsequent ordinary play work normally.

Setup: `6rk/8/2B5/8/8/8/1R4P1/K7 w - - 0 1`; white Ka1 Rb2 Bc6 Pg2, black Kh8 Rg8. White beforeMove, moveMade=false; white hand `[truce]`; other hands and decks empty. No effects. Public createGameState/applyAction/legalDests/cardPlayTargets/isKingInCheck APIs; no test sources or persistent harness.

Predictions recorded before execution: Rb3 legal; Truce after move with undefined target legal; Rg2 capture blocked while Truce active; quiet Ra8+ expires Truce; Bxa8 resolves check; subsequent Kg7 legal.

| Action | Exact action and timing | Observed result |
|---|---|---|
| 1 | White beforeMove Rb2-b3 | Accepted; afterMove |
| 2 | White afterMove play truce, target omitted | Accepted; one retained effect; targets `[undefined]` |
| 3 | endTurn | Black beforeMove; Truce persists |
| 4 | Black Rg8xg2 | Rejected ILLEGAL_MOVE; g2 absent from legalDests; position unchanged |
| 5 | Black Rg8-a8+ | Accepted; white check true; Truce effect removed immediately |
| 6 | endTurn | White beforeMove in check |
| 7 | White Bc6xa8 | Accepted; a8 offered by legalDests; check false; black rook captured |
| 8 | endTurn | Black beforeMove |
| 9 | Black Kh8-g7 | Accepted ordinary move |
| 10 | endTurn | White beforeMove; game ongoing |

Final FEN: `B7/6k1/8/8/8/1R6/6P1/K7 w - - 1 3`. White discard contains Truce exactly once; effects empty; captured black-rook-g8 has capturedBy white; outcome null. All predictions matched; zero findings. Check-expiration branch covered; stalemate branch outside this single game's scope.

Executed: one uninterrupted game, 10 actions (9 accepted, 1 intentionally rejected), 21 ms measured engine wall time. Initial sandbox here-document failed before Node execution; rerun with authorized temporary-file access executed the game once. No resets, replay, or temporary harness files.

GAME_037_DONE
