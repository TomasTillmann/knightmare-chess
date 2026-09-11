# Game 039: Blessing pinned rook

Pre-action hypothesis: Blessing offers a rook diagonal movement to empty squares, but moving a rook pinned on its king's file must fail king safety while expending the card if the rules specify fizzle. Geometrically invalid orthogonal targets must not consume the card.

Parent-validated scaffold executed: 4 probes, zero findings.

## Initial options and grounds

`{"fen":"k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1","hands":{"white":["blessing"]},"decks":{"white":[],"black":[]}}`

Normal beforeMove initialization; structural check passed and both kings initially unchecked. Blessing text in cards.md specifies bishop-like diagonal movement without capture; catalog timing is beforeMove. Verified production public target schema is `[{from,to}]` before intentional invalid probes. The rook e2 shields king e1 from rook e8.

Initial legalDests: e1 → d1,f1,d2,f2; e2 → e3,e4,e5,e6,e7,e8. Actual cardPlayTargets: e1 → d2,f2,c3,g3,b4,h4,a5, each wrapped in the verified single-move array. Pinned rook targets were correctly absent; e2-f3 was deliberately submitted as an excluded king-safety probe.

## Sequential evidence

Predictions were emitted before each applyAction. Every accepted result passed checkState; rejected action preserved input digest.

| # | Exact action | Prediction and actual |
|---|---|---|
| 1 | `{"type":"playCard","cardId":"blessing","target":[{"from":"e2","to":"e3"}]}` | Expected geometry rejection; rejected ILLEGAL_MOVE, card retained, beforeMove unchanged. |
| 2 | `{"type":"playCard","cardId":"blessing","target":[{"from":"e2","to":"f3"}]}` | Expected SELF_CHECK fizzle and expenditure; accepted cardFizzled SELF_CHECK, movement [], rook remains e2, card in discard, white cardPlays=1, afterMove/moveMade=true. |
| 3 | `{"type":"endTurn"}` | Expected accepted turn completion; black beforeMove. |
| 4 | `{"type":"move","from":"e8","to":"g8"}` | Expected enumerated legal move accepted; accepted. |
| 5 | `{"type":"endTurn"}` | Expected accepted; white beforeMove. |
| 6 | `{"type":"move","from":"e1","to":"f1"}` | Expected enumerated legal move accepted; accepted. |
| 7 | `{"type":"endTurn"}` | Expected accepted; black beforeMove. |
| 8 | `{"type":"move","from":"g8","to":"d8"}` | Expected enumerated legal move accepted; accepted. |
| 9 | `{"type":"endTurn"}` | Expected accepted; white beforeMove. |
| 10 | `{"type":"move","from":"e2","to":"f2"}` | Expected enumerated legal move accepted; accepted. |

Seeded continuation uses seed 39, update `(Math.imul(seed,1664525)+1013904223)>>>0`, selects `legalMoves[seed % legalMoves.length]` in public enumeration order. Final FEN: `k2r4/8/8/8/8/8/5R2/5K2 b - - 5 3`.

Result: zero findings; 10 actions, 9 accepted, 1 rejected. Measured game execution wall time: 28.794708 ms. One game only, never recreated. Limitations: finite sparse position, no successful Blessing movement/capture-path coverage; card artwork not independently inspected. This path is not proof of correctness.

GAME_039_DONE
