# Game 053 — Coup promotion and Cathedral

Pre-action hypothesis: a pawn made royal by Coup should retain royalty if a legal regular promotion produces a rook; a later Cathedral swap with a bishop should preserve the royal role and check restrictions. Promotion will only be attempted if offered as a legal move. Initial report absent; parent scaffold executed before game construction.

Result: zero findings. Scaffold: 4 probes, zero findings. Exactly one independent game, 16 actions (15 accepted, 1 expected rejection), engine wall time 38.889292 ms. No reset/replay, test access, or harness creation.

Exact initial options: `{"fen":"k7/8/6P1/2r5/8/8/4B3/K7 w - - 0 1","hands":{"white":["coup","cathedral"]}}`. Default normal white beforeMove, no setup overrides. Initial checkState passed; both kings independently checked safe; outcome null.

Rule grounds: cards.md Coup retains the chosen piece's standard movement and makes it the new King; former King becomes capturable Prince. Cathedral swaps own Rook and Bishop. Catalog requires afterMove timing for both cards. Ordinary pawn promotion and royal self-check constraints remain applicable.

Initial legalDests: a1=[b1,a2,b2]; e2=[d1,f1,d3,f3,c4,g4,b5,h5,a6]; g6=[g7]. Before promotion, g7=[g8] with other destinations unchanged. Coup targets after action 1 were exactly [e2,g7]. Cathedral targets after action 6 were exactly [{rook:g8,bishop:e2}], and that returned object was used unchanged.

Each prediction below was recorded before applying the action. Every accepted resulting state passed checkState; rejection preserved digest. All results matched predictions.

| # | Exact action | Expected and actual |
|---|---|---|
| 1 | move g6→g7 | Accepted; white afterMove, both kings safe. |
| 2 | playCard coup target="g7" | Accepted; white-pawn-g6 royal pawn g7; white-king-a1 no longer royal. |
| 3 | endTurn | Accepted; black beforeMove. |
| 4 | move a8→b8 | Accepted; both royals safe. |
| 5 | endTurn | Accepted; white beforeMove. |
| 6 | move g7→g8 promotion="rook" | Accepted; same white-pawn-g6 ID royal rook g8; black b8 checked. |
| 7 | playCard cathedral target={"rook":"g8","bishop":"e2"} | Accepted; same royal rook now e2, bishop g8; both royals safe. |
| 8 | endTurn | Accepted; black beforeMove. |
| 9 | move c5→e5 | Accepted; white royal rook e2 checked. |
| 10 | endTurn | Accepted; checked white beforeMove, outcome null. |
| 11 | move g8→f7 | Rejected ILLEGAL_MOVE: That is not a legal chess move. Bishop move leaves royal rook checked; state unchanged. |
| 12 | move e2→d2 | Accepted; royal rook escapes; both royals safe. |
| 13 | endTurn | Accepted; black beforeMove. |
| 14 | move b8→c7 | Accepted seeded legal continuation; both royals safe. |
| 15 | endTurn | Accepted; white beforeMove. |
| 16 | move g8→h7 | Accepted seeded legal continuation; both royals safe. |

At checked white action 10, legalDests contained only e2=[a2,b2,c2,d2,f2,g2,h2,e5], excluding the attempted unrelated bishop move. Seeded continuation used seed 53, `seed=(1664525*seed+1013904223)>>>0`, selecting index `seed % moves.length` from flattened legalDests, and endTurn whenever moveMade. No promotion choice was omitted in the directed promotion.

Final FEN: `8/2k4B/8/4r3/8/8/3R4/K7 b - - 4 4`; white afterMove; royal white-pawn-g6 rook d2 and black-king-a8 king c7; both safe; outcome null.

Limitations: one finite path, two sampled continuation moves; no proof of exhaustive correctness or other promotion roles. This audited preservation and subsequent check enforcement; no direct unsafe Cathedral swap was attempted.

GAME_053_DONE
