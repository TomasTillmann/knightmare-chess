# Game 072 — Man of Straw after Coup royal

Pre-action hypothesis: after White transfers royalty to Nc3 using Coup royal and Black checks it with Rb8-c8, Man of Straw can exchange the checked royal knight with White Pa2 and preserve its royal status at a2. A legal swap must resolve check; subsequent play must retain the new royal identity.

Replacement note: the predecessor executed the scaffold but aborted before creating a game or report. This assignment runs exactly one new game, with no replay/reset.

Scaffold executed successfully: 4 probes, 0 findings. Independent adversarial group executed once: 10 accepted actions, 0 rejected, 0 findings; game command measured 28 ms. Approximately 45 seconds assignment-to-completion. No harness files created.

## Rules and setup

`cards.md` Coup: designated non-Rook/non-Queen becomes the King and keeps its standard move; original King becomes capturable Prince. Man of Straw swaps checked King with a Pawn if new square is safe. `rules.md:226` attaches markers to physical piece identity through relocation. Catalog timing: Coup afterMove, Man of Straw beforeMove.

Exact `createGameState` options:
```json
{"fen":"1r5k/8/8/8/8/2N5/P7/7K w - - 0 1","hands":{"white":["coup","man-of-straw"]}}
```
Default normal beforeMove phase, empty decks and Black hand. Initial `checkState` passed; both Kings independently reported not in check. Structural check passed after every accepted action.

## Sequential action evidence

| # | Exact action | Expected and actual |
|---|---|---|
| 1 | `{"type":"move","from":"h1","to":"h2"}` | Accepted; White afterMove, neither checked. |
| 2 | `{"type":"playCard","cardId":"coup","target":"c3"}` | Accepted; Nc3 royal=true, Kh2 royal=false. |
| 3 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 4 | `{"type":"move","from":"b8","to":"c8"}` | Accepted; White royal knight checked, Black safe. |
| 5 | `{"type":"endTurn"}` | Accepted; White beforeMove still checked. |
| 6 | `{"type":"playCard","cardId":"man-of-straw","target":{"king":"c3","pawn":"a2"}}` | Accepted; original knight now a2 and royal=true, original Pawn now c3 and royal=false, Prince still h2; both safe. White regular move remains available. |
| 7 | `{"type":"move","from":"c3","to":"c4"}` | Accepted; seeded continuation Pawn c4, both safe. |
| 8 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 9 | `{"type":"move","from":"c8","to":"g8"}` | Accepted; seeded continuation Rg8, both safe. |
| 10 | `{"type":"endTurn"}` | Accepted; White beforeMove. |

Predictions for king move/Coup, checking rook move, and safe royal swap were printed before applying their actions. Coup target enumeration was `["a2","c3"]`; Man of Straw enumeration was exactly `[{"king":"c3","pawn":"a2"}]`, selected directly. Initial legal destinations included h1→g1/g2/h2; Black rook before action 4 included b8→b1/b2/b3/b4/b5/b6/b7/a8/c8/d8/e8/f8/g8. After swap the royal Knight legal destinations were a2→c1/b4, preserving Knight movement.

Seeded continuation used seed 72, update `(Math.imul(seed,1664525)+1013904223)>>>0`, index modulo the public legal move list length. White move list: a2c1,a2b4,h2g1,h2h1,h2g2,h2g3,h2h3,c3c4. Black move list: c8c4,c8c5,c8c6,c8c7,c8a8,c8b8,c8d8,c8e8,c8f8,c8g8,h8g7,h8h7,h8g8. End turns consumed no random draw.

Final identity state: white-knight-c3 at a2 royal; white-king-h1 at h2 nonroyal; white-pawn-a2 at c4; black-rook-b8 at g8; black-king-h8 at h8 royal. Outcome remained null throughout.

Limitations: finite sparse-board path, no invalid-target or checkmate rescue probes, no exhaustive proof. One game only, no resets/replays, no test source access or production edits.

GAME_072_DONE
