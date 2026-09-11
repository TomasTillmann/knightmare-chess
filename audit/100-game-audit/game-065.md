# Game 065 — Siege round-trip castling

Pre-action hypothesis: swapping the original h1 Rook away and back with two Siege plays under Plots Within Plots may preserve kingside castling metadata and permit a subsequent ordinary e1–g1 castle. Whether this is a defect depends on the local swap rules; this game will exercise the actual castle.

Scaffold executed: SCAFFOLD_OK probes=4 findings=0.

## Setup and result

Exact initial options: `{"fen":"4k3/p7/8/8/8/8/P4N2/4K2R w K - 0 1","hands":{"white":["plots-within-plots","siege","siege"]},"decks":{"white":[],"black":[]}}`. No phase, moveMade, or allowance overrides. Initial `checkState` passed and both `isKingInCheck` results were false. Exactly one game was created, never reset or replayed.

The ordinary castle **was accepted** after the original Rook was swapped away and back. This confirms the game-060 metadata observation has an actionable consequence, but is a **rules ambiguity, not a confirmed defect**: `rules.md` §20 describes Siege as a simultaneous swap preserving identity and markers, while Anathema explicitly calls the analogous operation a non-move. The general Swap rule does not address castling rights. In contrast, Man of Straw explicitly revokes the swapped King's rights (§22.5). Ordinary moved-Rook reasoning predicts rejection only if Siege displacement counts as movement for castling; that premise is not explicit locally. No stronger claim is justified by this path.

## Sequential action evidence

All actions were accepted; `checkState` passed after each. Each Siege target was selected from `cardPlayTargets` immediately before that play.

| # | Exact action | Actual result |
|---|---|---|
| 1 | `{"type":"move","from":"a2","to":"a3"}` | White afterMove; FEN `4k3/p7/8/8/8/P7/5N2/4K2R b K - 0 1` |
| 2 | `{"type":"playCard","cardId":"plots-within-plots"}` | White cardPlays=1; targets had returned `[{"player":"white"}]`; same FEN |
| 3 | `{"type":"playCard","cardId":"siege","target":{"knight":"f2","rook":"h1"}}` | Exactly the sole enumerated target; cardPlays=2; FEN `4k3/p7/8/8/8/P7/5R2/4K2N b H - 0 1` |
| 4 | `{"type":"playCard","cardId":"siege","target":{"knight":"h1","rook":"f2"}}` | Exactly the sole enumerated target; cardPlays=3; FEN `4k3/p7/8/8/8/P7/5N2/4K2R b K - 0 1` |
| 5 | `{"type":"endTurn"}` | Black beforeMove; allowances reset |
| 6 | `{"type":"move","from":"a7","to":"a6"}` | Listed legal Pawn destination; FEN `4k3/8/p7/8/8/P7/5N2/4K2R w K - 0 2` |
| 7 | `{"type":"endTurn"}` | White beforeMove |
| 8 | `{"type":"move","from":"e1","to":"g1"}` | Accepted actual castle, King g1 and original Rook f1; FEN `4k3/8/p7/8/8/P7/5N2/5RK1 b - - 1 2` |
| 9 | `{"type":"endTurn"}` | Black beforeMove |
| 10 | `{"type":"move","from":"e8","to":"e7"}` | Seeded legal continuation; FEN `8/4k3/p7/8/8/P7/5N2/5RK1 w - - 2 3` |
| 11 | `{"type":"endTurn"}` | White beforeMove; same final FEN |

Before action 8, `legalDests` for e1 was `["d1","f1","h1","d2","e2","g1"]`, including both ordinary castling representations. Actions 3–4 remained in the same White afterMove window. Their history entries recorded the two displacement segments with `preservePreviousMove:true`; no extra ordinary move occurred.

Continuation used seed 65, LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting `moves[seed % moves.length]` from the public Map flattening; afterMove steps used endTurn. Total: 11 accepted actions, 0 rejected, 4 scaffold probes, 0 structural findings. Measured game execution wall time: **33.423333 ms** (including initial validation, enumerations, and logging). Shell invocation completed in approximately 0.5 seconds; total assignment time was not instrumented. No test sources read, no tests run, no harness created, no non-report file modified.

Limitations: finite sparse-board path; castling semantics require explicit adjudication. This report extends game-060 rather than claiming an independent newly discovered family. Prior audit README was inspected; no prior confirmed matching defect established.

GAME_065_DONE
