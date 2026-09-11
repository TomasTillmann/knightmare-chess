# Game 043 — dead position after final pawn capture

Pre-action hypothesis: from `7k/8/8/8/8/8/4p3/4K3 w - - 0 1`, White can legally capture e2 with its King. With both hands and decks empty and no Continuing Effects, bare Kings cannot produce mate. Under the ordinary-draw convention allowed by rules §2, a dead-position draw should result; §23 does not itself explicitly require dead-position adjudication, so failure will be classified as unsupported draw convention rather than an unqualified chess legality defect.

Parent-approved scaffold: executed successfully, four probes, zero findings.

## Exact setup and evidence

Baseline: `33e03989fab9449d87b857fc5673f67d05841928`.

```json
{"fen":"7k/8/8/8/8/8/4p3/4K3 w - - 0 1","hands":{"white":[],"black":[]},"decks":{"white":[],"black":[]}}
```

One normal `createGameState` initialization, with no phase/move/effect overrides. Initial `checkState` passed; both Kings independently checked with `isKingInCheck`: false/false. Kings e1/h8 are nonadjacent; black Pawn e2 attacks d1/f1, not e1. Initial legal destinations were e1→d2,e2,f2, confirming the selected capture is legal. Initial effects and both discard piles were empty. No card plays apply in this game.

| # | Exact action | Actual result | Resulting FEN |
|---|---|---|---|
| 1 | `{"type":"move","from":"e1","to":"e2"}` | Accepted; pawn `black-pawn-e2` captured, white King retains identity at e2; White afterMove; outcome null | `7k/8/8/8/8/8/4K3/8 b - - 0 1` |
| 2 | `{"type":"endTurn"}` | Accepted; Black beforeMove; outcome null; h8 destinations g7,h7,g8 | same |
| 3 | `{"type":"move","from":"h8","to":"g7"}` | Accepted; Black afterMove; outcome null | `8/6k1/8/8/8/8/4K3/8 w - - 1 2` |
| 4 | `{"type":"endTurn"}` | Accepted; White beforeMove; outcome null; e2 destinations d1,e1,f1,d2,f2,d3,e3,f3 | same |
| 5 | `{"type":"move","from":"e2","to":"d3"}` | Accepted; White afterMove; outcome null | `8/6k1/8/8/8/3K4/8/8 b - - 2 2` |
| 6 | `{"type":"endTurn"}` | Accepted; Black beforeMove; outcome null; g7 destinations f6,g6,h6,f7,h7,f8,g8,h8 | same |

Before actions 3–6, the driver explicitly predicted continuation under the observed null outcome, while the ordinary dead-position convention should already have terminated the game. Continuation selected actual enumerated legal moves using seed 43 and `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, then `moves[seed % moves.length]`. No game was replayed or reset. `checkState` passed initially and after all six actions. Final Kings were safe; effects stayed empty and hands/decks stayed empty.

## Result and limits

**Observed missing dead-position draw support; convention-qualified finding, not an unqualified move-legality bug.** Actual king capture and turn transition leave bare Kings with outcome null, and further ordinary moves are accepted. Under rules §2's ordinary-draw default, with §9's exhausted-card fallback and no effects, this position is dead: neither King can legally approach close enough to give check, so no mate can occur. However §2 expressly allows players to agree to only stalemate/mutual agreement; §23 specifies stalemate and repetition treatment but no dead-position policy. The public outcome type in `src/game/types.ts:311` supports only checkmate/stalemate. That narrower engine draw implementation explains the result; this audit cannot establish which optional draw convention the product promises. The fixture is not stalemate, since legal moves remain.

No equivalent finding appears in the prior `audit/2026-09-08/README.md`. No tests read or executed; an initial overly broad filename inventory displayed test filenames only, before the protocol's named-file search restriction was read. All subsequent reads were named production/rules/report files. Only this report was written; no harness file was created.

Counts: one independent adversarial game, six accepted actions, zero rejected actions, three actual Regular Moves, seven successful structural checks; scaffold separately four probes/zero findings. Measured game wall time: **14.535 ms**. Agent phase approximately 75 seconds, exceeding the 45-second target; scaffold/file checkpoints also not independently timestamped and cannot be certified. Finite path does not prove general correctness.

GAME_043_DONE
