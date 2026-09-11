# Game 076 — Chaos after ordinary castling

Pre-action hypothesis: after white castles, black's Chaos should restore the white king and rook to their original squares and restore castling rights. White must choose a genuinely different replacement: an alternate king-to-rook castling alias must not bypass Chaos's repeat prohibition. After a legal replacement and a black reply, castling should remain available if its ordinary conditions hold.

Parent-validated scaffold executed: four probes, zero findings. Exactly one independently designed game executed; no reset/replay. No source/test/harness changes.

## Setup and rule grounds

Exact `createGameState` options:

```json
{"fen":"r3k2r/ppp2ppp/8/8/8/8/PPP2PPP/R3K2R w KQkq - 0 1","hands":{"white":[],"black":["chaos"]},"decks":{"white":[],"black":[]}}
```

Normal beforeMove setup; initial `checkState` passed and `isKingInCheck` returned false for both kings. `cards.md` Chaos cancels the opponent's move and requires a different move; catalog timing is `afterOpponentMove`. Read existing audit findings: no duplicate of this scenario identified. No artwork inspection was needed to resolve the unambiguous cancellation text.

Initial king destinations were `[a1,d1,f1,h1,d2,e2,c1,g1]`. After rollback they were `[a1,d1,f1,d2,e2,c1]`, excluding both kingside aliases. On White's next turn they were again `[a1,d1,f1,h1,d2,e2,c1,g1]`. Full legal destination maps were enumerated at these three points. Immediately before Chaos, `cardPlayTargets` returned one undefined no-target choice (serialized as `[null]`); that returned choice was supplied.

## Sequential pre-action predictions and results

Every prediction below was printed before applying the action. Every accepted result passed `checkState`; both rejected actions preserved the input digest.

| # | Exact action | Prediction | Actual |
|---|---|---|---|
| 1 | `move e1 g1` | Ordinary castle accepted, king g1/rook f1, revoke White rights | Accepted; FEN `r3k2r/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 b kq - 1 1`; White afterMove |
| 2 | `playCard chaos` with returned undefined target | Cancel whole castle; king e1/rook h1 and KQ rights restored | Accepted; initial FEN restored exactly; White beforeMove; black cardPlays=1; Chaos discarded |
| 3 | `move e1 h1` | Alternate alias must reject repeating castle | Rejected `ILLEGAL_MOVE: Chaos requires a different move.` |
| 4 | `move e1 g1` | Original spelling must reject | Rejected same error; replacement window remains open |
| 5 | `move a2 a3` | Different replacement accepted | Accepted; FEN `r3k2r/ppp2ppp/8/8/8/P7/1PP2PPP/R3K2R b KQkq - 0 1` |
| 6 | `endTurn` | White ends replacement turn | Accepted; Black beforeMove, card allowance reset to 0 |
| 7 | `move a7 a6` | Black quiet reply accepted | Accepted; FEN `r3k2r/1pp2ppp/p7/8/8/P7/1PP2PPP/R3K2R w KQkq - 0 2` |
| 8 | `endTurn` | Black ends turn | Accepted; White beforeMove |
| 9 | `move e1 h1` | Later castle accepted using restored rights | Accepted; king g1/rook f1; FEN `r3k2r/1pp2ppp/p7/8/8/P7/1PP2PPP/R4RK1 b kq - 1 2` |
| 10 | `endTurn` | Finish castling turn | Accepted; Black beforeMove |
| 11 | `move c7 c5` | Enumerated seeded move accepted | Accepted; FEN `r3k2r/1p3ppp/p7/2p5/8/P7/1PP2PPP/R4RK1 w kq - 0 3` |
| 12 | `endTurn` | Seeded continuation endTurn accepted | Accepted; White beforeMove |
| 13 | `move g1 h1` | Enumerated seeded move accepted | Accepted; FEN `r3k2r/1p3ppp/p7/2p5/8/P7/1PP2PPP/R4R1K b kq - 1 3` |
| 14 | `endTurn` | Seeded continuation endTurn accepted | Accepted; Black beforeMove |

Seeded continuation used seed 760908, `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting `legalDests` flattened move at index `seed % moves.length`. Values 548940603 / 25 moves chose c7-c5; 2143659870 / 21 moves chose g1-h1. End turns do not advance the seed.

Result: **zero findings**, 14 actions (12 accepted, 2 rejected). Independent game measured wall time **109.238333 ms**. Scaffold separately ran four probes with zero findings. Finite path only; queenside cancellation, transformed pieces, other reactions, and multi-card combinations remain untested. No temporary harness was created. Setup/reporting exceeded the 45-second target; the bounded game itself did not.

GAME_076_DONE
