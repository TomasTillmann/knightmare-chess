# Game 048 — Onslaught and Coup royal pawn

Pre-action hypothesis: Coup can make a pawn royal while preserving pawn movement; a subsequent Onslaught involving that pawn and another pawn must preserve royal safety, move both selected pawns once, and consume the ordinary move.

Scaffold executed: SCAFFOLD_OK probes=4 findings=0. One normal game planned; no source or test changes.

## Executed evidence

Exact initial options: `{"fen":"7k/8/8/8/7r/8/PP6/K7 w - - 0 1","hands":{"white":["coup","onslaught","onslaught"]}}`. No overrides. Initial `checkState` passed and both kings were unchecked. Initial legalDests: `[["a1",["b1"]],["a2",["a3","a4"]],["b2",["b3","b4"]]]`.

Rule grounds: cards.md Coup retains the chosen piece's standard move while making it royal; Onslaught permits any number of pawns one forward noncapturing step. Catalog timing is Coup afterMove and Onslaught beforeMove. Predictions below were printed before each action. Accepted actions each passed checkState; white remained unchecked throughout.

| # | Exact action | Prediction and actual result |
|---|---|---|
| 1 | `{"type":"move","from":"a1","to":"b1"}` | Accepted; white afterMove, moveMade true. |
| 2 | `{"type":"playCard","cardId":"coup","target":"b2"}` | Accepted; b2 retained pawn role and became royal, b1 lost royal status. One card used. |
| 3 | `{"type":"endTurn"}` | Accepted; black beforeMove. |
| 4 | `{"type":"move","from":"h8","to":"g8"}` | Accepted; black afterMove. |
| 5 | `{"type":"endTurn"}` | Accepted; white beforeMove. |
| 6 | `{"type":"playCard","cardId":"onslaught","target":[{"from":"a2","to":"a3"},{"from":"b2","to":"b3"}]}` | Accepted; both pawns advanced exactly once, b3 remained royal pawn, white afterMove/moveMade true/cardPlays.white 1. History movement contained exactly both steps, preservePreviousMove false. |
| 7 | `{"type":"move","from":"b3","to":"b4"}` | Rejected ILLEGAL_MOVE, 'The regular move has already been made.' Digest unchanged. |
| 8 | `{"type":"endTurn"}` | Accepted; black beforeMove. |
| 9 | `{"type":"move","from":"g8","to":"h8"}` | Accepted; rook remained h4, attacking b4. |
| 10 | `{"type":"endTurn"}` | Accepted; white beforeMove. |
| 11 | `{"type":"playCard","cardId":"onslaught","target":[{"from":"a3","to":"a4"},{"from":"b3","to":"b4"}]}` | Predicted royal safety fizzle. Accepted with cardFizzled SELF_CHECK: both pawns remained a3/b3, movement [], preservePreviousMove false. White afterMove/moveMade true/cardPlays.white 1. |

Before action 2, cardPlayTargets(coup) returned `["a2","b2"]`. Before action 6, Onslaught returned `[[{"from":"a2","to":"a3"}],[{"from":"b2","to":"b3"}],[{"from":"a2","to":"a3"},{"from":"b2","to":"b3"}]]`; selected its two-pawn target. Before action 11 it returned `[[{"from":"a3","to":"a4"}],[{"from":"b3","to":"b4"}],[{"from":"a3","to":"a4"},{"from":"b3","to":"b4"}]]`; selected its two-pawn target. Enumeration includes the unsafe target, which resolves through the engine's fizzle mechanism.

Executed: scaffold 4 probes, one independent adversarial game 11 actions (10 accepted, including one fizzle; 1 rejected), zero findings. Measured game wall time 20.389208 ms; scaffold shell time 0.051362125 s. No temporary harness files created. Limitations: finite directed path only, no seeded continuation, promotion or cancellation coverage. No reset or replay.

GAME_048_DONE
