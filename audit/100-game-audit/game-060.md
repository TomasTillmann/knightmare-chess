# Game 060 — Siege and Curse

Pre-action hypothesis: Siege's explicit non-move simultaneous swap permits a cursed rook to exchange with an own knight farther than one square, retains the rook's Curse identity marker, and removes its original castling right. A rejection caused by Curse may repeat game 026's non-move swap conflict family.

Scaffold: executed, four probes, zero findings. Target was absent before this patch.

## Setup and rule grounds

Baseline `33e03989fab9449d87b857fc5673f67d05841928`. Exact createGameState options: `{"fen":"4k3/p7/8/8/8/8/P4N2/1N2K2R b K - 0 1","hands":{"white":["siege"],"black":["curse"]}}`. Normal beforeMove state; no timing/effect/piece overrides. Initial checkState passed and both isKingInCheck calls returned false. Initial legalDests: a7→a5,a6; e8→d7,e7,f7,d8,f8.

cards.md Curse limits an opposing Queen/Bishop/Rook to one or two squares; Siege exchanges an own Knight and Rook. Both catalog timings are afterMove. rules.md:660 applies Holy War's after-move simultaneous swap procedure, preserving identities and markers without capture or movement geometry. The far swap prediction follows the local non-move interpretation, with the known game-026 interpretation conflict explicitly anticipated. The near-swap fallback prediction was acceptance with retained Curse. Before regular rook probes, predicted three-square rejection and two-square acceptance.

## Sequential actions

| # | Exact public action | Result |
|---|---|---|
| 1 | `{"type":"move","from":"a7","to":"a6"}` | Accepted |
| 2 | `{"type":"playCard","cardId":"curse","target":"h1"}` | Accepted; enumerated targets `["h1"]`; effect binds `white-rook-h1` |
| 3 | `{"type":"endTurn"}` | Accepted |
| 4 | `{"type":"move","from":"a2","to":"a3"}` | Accepted |
| 5 | `{"type":"playCard","cardId":"siege","target":{"knight":"b1","rook":"h1"}}` | Rejected `ILLEGAL_MOVE`, `Curse limits movement to one or two squares.` |
| 6 | `{"type":"playCard","cardId":"siege","target":{"knight":"f2","rook":"h1"}}` | Accepted; rook f2, knight h1, retained Curse |
| 7 | `{"type":"endTurn"}` | Accepted |
| 8 | `{"type":"move","from":"a6","to":"a5"}` | Accepted |
| 9 | `{"type":"endTurn"}` | Accepted |
| 10 | `{"type":"move","from":"f2","to":"f5"}` | Rejected `ILLEGAL_MOVE`, `Curse limits movement to one or two squares.` |
| 11 | `{"type":"move","from":"f2","to":"f4"}` | Accepted |
| 12 | `{"type":"endTurn"}` | Accepted |
| 13 | `{"type":"move","from":"e8","to":"d7"}` | Accepted; seeded continuation |
| 14 | `{"type":"endTurn"}` | Accepted |
| 15 | `{"type":"move","from":"f4","to":"d4"}` | Accepted; seeded continuation |
| 16 | `{"type":"endTurn"}` | Accepted |

Before action 5, cardPlayTargets returned exactly `[{"knight":"b1","rook":"h1"},{"knight":"f2","rook":"h1"}]`. Before action 6 targets were enumerated again and the f2/h1 target selected. Rejections preserved digest and did not spend Siege. Structural checkState passed after every accepted action.

After the successful swap FEN was `4k3/8/p7/8/8/P7/5R2/1N2K2N b H - 0 2`; castling field unexpectedly persisted as `H`, rather than the predicted removal. Actual later white legalDests excluded castling: b1→d2,c3; e1→d1,f1,d2,e2; h1→g3; f2→f1,d2,e2,g2,h2,f3,f4; a3→a4. After f2→f4 the FEN castling field became `-`. This is a recorded metadata observation only: no later return-to-home castling probe was executed, and the cited Siege section does not explicitly settle rights revocation. Do not count it as a confirmed gameplay bug.

Final FEN `8/3k4/8/p7/3R4/P7/8/1N2K2N b - - 3 4`. All seven identities remain on board; `white-rook-h1` at d4 still carries the sole Curse effect. No captures. Seed 60 continuation uses `seed=(Math.imul(seed,1664525)+1013904223)>>>0` and `seed % moves.length` on flattened public legalDests. Exactly one game, no reset/replay or harness created.

## Finding and limits

Siege repeats game 026's local-rule non-move-swap/Curse conflict family: a returned target is rejected for a six-file cursed-rook displacement. This is a duplicate family, not a new discovery; official Curse/swap adjudication remains as qualified in the campaign README. Near swap succeeds, preserves identity-bound Curse, and the next rook moves enforce two-square range. Prior 2026-09-08 README search for Curse/swap/Anathema/Siege returned no matches. No tests were inspected, edited, or run.

Executed four scaffold probes with zero findings; one independent game with 16 actions, 14 accepted and two rejected; two seeded continuation moves. Measured game execution wall time: 33.374917 ms; total agent/report time was not separately instrumented. Finite coverage does not prove correctness. Artwork was not independently opened; authoritative Markdown and catalog were used.

GAME_060_DONE
