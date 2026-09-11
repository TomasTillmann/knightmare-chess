# Game 045 — Evangelists / Fatal Attraction

Pre-action hypothesis: Evangelists swaps physical bishops without an actual movement event; Fatal Attraction remains attached to its original physical bishop after the swap. A later actual move of that magnet ends the effect. The initial driver incorrectly also expected a remaining Regular Move after Evangelists; that assumption was rejected and is not an engine finding.

## Rules and timing

Rules §18.6 explicitly permits a non-move swap of immobilized pieces and preserves the magnet through that swap. Actual movement ends the magnet. Rules §20 (Evangelists paragraph) explicitly replaces the Regular Move and preserves identities and markers. Catalog timing: Fatal Attraction afterMove; Evangelists beforeMove. `cards.md` supplies both effect texts. The exact Evangelists replacement paragraph was checked after execution when the driver encountered its timing mistake.

## Setup and scaffold

Parent scaffold executed successfully: `SCAFFOLD_OK probes=4 findings=0`. The 15-second scaffold deadline was missed because the assignment omitted the protocol path and I requested it before reading it. Report hypothesis was patched promptly. Overall 45-second completion target was also missed; only engine-run time below was instrumented. No game was reset or replayed.

Exact `createGameState` options (normal beforeMove defaults):

```json
{"fen":"7k/p7/8/3b4/2B5/8/P6K/8 w - - 0 1","hands":{"white":["fatal-attraction"],"black":["evangelists"]}}
```

Initial `checkState` passed and both `isKingInCheck` values were false. No effects, histories, or piece states were injected. Fatal Attraction targets after action 1 were `["a3","h2","c4"]`. Evangelists targets before action 4 were `[{"own":"d5","opponent":"c4"}]`; both focal card targets were selected from these returned lists.

## Sequential actions and observations

| # | Exact action | Result |
|---|---|---|
| 1 | `{"type":"move","from":"a2","to":"a3"}` | Accepted; White afterMove. |
| 2 | `{"type":"playCard","cardId":"fatal-attraction","target":"c4"}` | Accepted; retained effect names `white-bishop-c4`. |
| 3 | `{"type":"endTurn"}` | Accepted; Black beforeMove; legalDests omits frozen d5 bishop entirely. |
| 4 | `{"type":"playCard","cardId":"evangelists","target":{"own":"d5","opponent":"c4"}}` | Accepted; `white-bishop-c4` now d5, `black-bishop-d5` now c4; same magnet marker retained; Black afterMove/moveMade. |
| 5 | `{"type":"move","from":"c4","to":"b3"}` | Rejected ILLEGAL_MOVE: Regular Move already made. Input digest unchanged. This does not prove post-swap immobilization. |
| 6 | `{"type":"move","from":"h8","to":"h7"}` | Rejected ILLEGAL_MOVE: Regular Move already made. Input digest unchanged. Driver timing mistake. |
| 7 | `{"type":"endTurn"}` | Accepted; White beforeMove; d5 legal destinations include e6. |
| 8 | `{"type":"move","from":"d5","to":"e6"}` | Accepted; effects becomes empty, as predicted for actual magnet movement. |
| 9 | `{"type":"endTurn"}` | Accepted; Black beforeMove; c4 legal destinations are f1,a2,e2,b3,d3,b5,d5,a6,e6. |
| 10 | `{"type":"move","from":"c4","to":"b3"}` | Accepted; formerly frozen physical bishop moves. |
| 11 | `{"type":"endTurn"}` | Accepted. |
| 12 | `{"type":"move","from":"e6","to":"c4"}` | Accepted, seeded continuation. |
| 13 | `{"type":"endTurn"}` | Accepted. |
| 14 | `{"type":"move","from":"b3","to":"a2"}` | Accepted, seeded continuation. |
| 15 | `{"type":"endTurn"}` | Accepted. |

Seeded continuation: seed 45; unsigned LCG `seed = (Math.imul(seed,1664525)+1013904223) >>> 0`; choose flattened legalDests entry at `seed % length`, end turns when moveMade. `checkState` passed after every accepted action. Final pieces: white pawn a3, king h2, bishop c4; black bishop a2, pawn a7, king h8; no effects.

## Result and limits

One game, 15 action probes: 13 accepted, 2 rejected; four separate saved-fixture scaffold probes. Instrumented game wall time **43.595 ms**. No confirmed engine finding. Prior audit README reviewed; no duplicate finding to report. Evidence supports immobilized-bishop swap permission, magnet physical-identity persistence, and termination on a later actual move. Post-swap immobilization itself was not directly isolated because actions 5–6 were attempted after the replacement move had completed. Finite coverage is not proof of correctness. Only this Markdown report was written; no tests read or run, no code/harness files written.

GAME_045_DONE
