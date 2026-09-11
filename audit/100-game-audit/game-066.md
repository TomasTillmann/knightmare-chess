# Game 066 — Plots Within Plots

Pre-action hypothesis: Plots Within Plots permits exactly two extra cards from the hand present when it resolves. Replacement draws must remain ineligible, and every card ID must remain unique across hand, deck, and discard.

Scaffold executed: four probes, zero findings. One independent game executed, 14 actions: 12 accepted, two rejected, zero findings. Measured game execution wall time: 71.429125 ms. Total assignment/report time was not instrumented; the 45-second overall target was exceeded. No harness was created, and no game was reset or replayed.

## Grounds and exact setup

`cards.md` Plots Within Plots allows two more cards legal at the opening moment; two moves are permitted when both cards replace a move. Catalog timing includes beforeMove, afterMove, afterOpponentMove, and afterOpponentCard. Hidden Passage is beforeMove and replaces the regular move, using `[{from,to}]`.

```json
{"fen":"7k/7r/8/8/8/8/R7/K7 w - - 0 1","hands":{"white":["plots-within-plots","hidden-passage","hidden-passage","hidden-passage"],"black":[]},"decks":{"white":["hidden-passage","hidden-passage","hidden-passage"],"black":[]}}
```

Created once with `createGameState(options)`; ordinary beforeMove defaults. Initial `checkState` passed; neither King was in check. For compact exact accounting, P means `white-hand-0-plots-within-plots`, H1/H2/H3 mean `white-hand-1-hidden-passage` / `white-hand-2-hidden-passage` / `white-hand-3-hidden-passage`, and D0/D1/D2 mean `white-deck-0-hidden-passage` / `white-deck-1-hidden-passage` / `white-deck-2-hidden-passage`.

## Sequential evidence

Predictions were emitted immediately before applying each action. Each accepted action was followed by `checkState`. Both rejected actions preserved the input digest. Every action retained exactly the initial seven unique physical IDs across both players' hands, decks, and discards; sorted IDs equaled the initial sorted IDs after all 14 actions.

`cardPlayTargets(s,"plots-within-plots")` returned exactly `[{"player":"white"}]`.

| # | Exact action | Prediction and actual result |
|---|---|---|
| 1 | `{"type":"playCard","cardId":"plots-within-plots","target":{"player":"white"}}` | Accept: remaining 2, eligible exactly H1/H2/H3; beforeMove, moveMade false; hand H1/H2/H3/D0, deck D1/D2, discard P. |
| 2 | `{"type":"playCard","cardId":"hidden-passage","cardInstanceId":"white-deck-0-hidden-passage","target":[{"from":"a1","to":"b1"}]}` | Reject replacement draw: `CARD_ALREADY_PLAYED`, `Only one card may be played per turn.` Remaining 2 and all state unchanged. |
| 3 | `{"type":"playCard","cardId":"hidden-passage","cardInstanceId":"white-hand-1-hidden-passage","target":[{"from":"a1","to":"b1"}]}` | Accept first extra; King b1, afterMove and moveMade true, remaining 1, eligible H2/H3; hand H2/H3/D0/D1, deck D2, discard P/H1. |
| 4 | `{"type":"playCard","cardId":"hidden-passage","cardInstanceId":"white-hand-2-hidden-passage","target":[{"from":"b1","to":"f8"}]}` | Accept second replacement move; King f8, afterMove and moveMade true, remaining 0, eligible H3; hand H3/D0/D1/D2, deck empty, discard P/H1/H2. |
| 5 | `{"type":"playCard","cardId":"hidden-passage","cardInstanceId":"white-hand-3-hidden-passage","target":[{"from":"f8","to":"b1"}]}` | Reject third original extra: same `CARD_ALREADY_PLAYED` error, all state unchanged. |
| 6 | `{"type":"endTurn"}` | Accept: Black beforeMove, moveMade false, both card counts zero, Plots allowance removed. |
| 7 | `{"type":"move","from":"h7","to":"g7"}` | Accept enumerated Black move. |
| 8 | `{"type":"endTurn"}` | Accept: White beforeMove. |
| 9 | `{"type":"move","from":"a2","to":"a6"}` | Accept enumerated White move. |
| 10 | `{"type":"endTurn"}` | Accept: Black beforeMove. |
| 11 | `{"type":"move","from":"g7","to":"g4"}` | Accept enumerated Black move. |
| 12 | `{"type":"endTurn"}` | Accept: White beforeMove. |
| 13 | `{"type":"move","from":"f8","to":"f7"}` | Accept enumerated White move. |
| 14 | `{"type":"endTurn"}` | Accept: Black beforeMove. |

Before #2/#3, Hidden Passage enumeration returned a1 to: b1,c1,d1,e1,f1,g1,b2,c2,d2,e2,f2,g2,a3,b3,c3,d3,e3,f3,g3,a4,b4,c4,d4,e4,f4,g4,a5,b5,c5,d5,e5,f5,g5,a6,b6,c6,d6,e6,f6,g6,a8,b8,c8,d8,e8,f8. Before #4 it returned b1 to the same ordered list with a1 replacing b1. Chosen accepted targets were respectively the first and last returned entries. After #4, enumeration returned `[]`; #5 intentionally probes exhausted allowance using the already validated public target schema.

Continuation used seed 66, recurrence `(seed*1664525+1013904223)>>>0`, and index `seed % moves.length` over flattened `legalDests` Map order. Seeds were 1123762873,1138232516,44151123,476513942; move counts 13,15,15,17; selected indices 12,11,3,15. These produced actions #7/#9/#11/#13. Their enumerated ordered alternatives were:

- #7: h7→h1,h2,h3,h4,h5,h6,a7,b7,c7,d7,e7,f7,g7.
- #9: a2→a1,b2,c2,d2,e2,f2,g2,h2,a3,a4,a5,a6,a7,a8; f8→e8.
- #11: g7→g1,g2,g3,g4,g5,g6,a7,b7,c7,d7,e7,f7,h7,g8; h8→h7.
- #13: a6→a1,a2,a3,a4,a5,b6,c6,d6,e6,f6,g6,h6,a7,a8; f8→e7,f7,e8.

Card zones remained H3/D0/D1/D2 in hand, empty deck, P/H1/H2 in discard through continuation. Accepted move actions entered afterMove with moveMade true; each following endTurn restored beforeMove for the opposite color. The game remained ongoing.

## Result and limitations

Zero semantic or structural findings on this finite path. Original-instance eligibility, rejection of a same-kind replacement draw, precisely two extra replacement moves, exhaustion against a third original card, and card conservation all matched predictions. Coverage excludes reaction timing, nested Plots, copy/retrieval effects, and interacting continuing effects. This finite clean game does not prove general correctness. Production Plots eligibility logic was inspected; no test sources were read or run.

GAME_066_DONE
