# Game 013 — Vendetta pinned captures

Pre-action hypothesis: Vendetta must expire when the opponent has only a geometric capture by a pinned piece, because a move exposing its King is not a legal capture. A quiet move should remain available. Scaffold executed successfully: 4 probes, zero findings.

Rules: cards.md Vendetta and rules.md §18.1 explicitly require legal captures, excluding captures that expose the King. Catalog timing checked: Vendetta is afterMove. No production or test files changed or tests read.

Exact setup: `{"fen":"4k3/4n3/2P5/8/8/8/8/K3R3 w - - 0 1","hands":{"white":["vendetta"]}}`. Default beforeMove; structural check passed and both initial Kings were not in check. The black Knight e7 geometrically attacks c6 but moving exposes King e8 to Rook e1.

Sequential action evidence (one game, no resets):

| # | Action | Actual |
|---|---|---|
| 1 | move a1-b1 | accepted; afterMove |
| 2 | playCard vendetta, selected first enumerated target | accepted; Vendetta effect installed |
| 3 | endTurn | accepted; Black beforeMove, Vendetta expired |
| 4 | move e7-c6 | rejected ILLEGAL_MOVE; board and turn unchanged |
| 5 | move e8-d8 | accepted; afterMove |
| 6 | endTurn | accepted; White beforeMove |
| 7 | move c6-c7 | accepted |
| 8 | endTurn | accepted |
| 9 | move d8-e8 | accepted |
| 10 | endTurn | accepted |

Before action 2, actual `cardPlayTargets(s,"vendetta")` serialized as `[null]` (first target is undefined and omitted by action JSON serialization). Before action 4, actual `legalDests` was `[["e8",["f7","d8","f8"]]]`; prediction recorded before actions 4–5: pinned capture rejected and quiet King move accepted. All predicted outcomes matched. Actions 7–10 were a bounded continuation using seed 13 and `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, selecting `seed % moves.length` from public legal destinations. Structural invariants checked after every accepted action.

Final FEN: `4k3/2P1n3/8/8/8/8/8/1K2R3 w - - 1 3`; White beforeMove, effects `[]`, outcome null. Executed 10 game actions: 9 accepted, 1 intentionally rejected; plus 4 scaffold probes. Game wall time: 22.48 ms. Findings: none. Limitations: one finite pinned-Knight path; Pacifism not exercised; no universal correctness claim. No temporary harness files created.

GAME_013_DONE
