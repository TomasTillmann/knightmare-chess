# Game 025 — Toll refusal after card movement

Status: running. Hypothesis: refusing Toll after Guardian carries a white pawn from d4 to d5 restores the pawn and Guardian card, consumes Black's Toll, and forfeits White's turn. Forced March was considered before setup but discarded after reading its sideways-only rule. Scaffold executed: four probes, zero findings.

Completed: zero findings on this path. Exactly one game, 10 actions (9 accepted, 1 rejected), engine game wall time 17 ms. No reset/replay. Scaffold was executed on the second tool invocation rather than the protocol-required first invocation; this procedural deviation does not change game evidence.

Initial options: `{"fen":"7k/8/8/8/3P4/8/8/K7 w - - 0 1","hands":{"white":["guardian"],"black":["toll"]}}`. Default beforeMove phase; no turn/effect/history overrides. Initial checkState passed and neither king was checked; every accepted action passed checkState.

Rule grounds: cards.md Guardian replaces a regular move; Toll requires frontier crossing, permits pawn-payment refusal, returns the mover's card and cancels the turn without another move. Catalog timing read: Guardian beforeMove; Toll afterOpponentMove. Actual Guardian enumeration was `[[{"from":"d4","to":"d5"}]]`; selected that exact target. Toll enumeration after Guardian was `[undefined,"d5"]` (JSON printed undefined as null).

Predictions were logged before critical actions: Guardian moves pawn over frontier; refusal restores pawn/card and consumes Toll; another white move is rejected; endTurn gives Black the turn. All matched.

| # | Exact action | Result |
|---|---|---|
| 1 | `{"type":"playCard","cardId":"guardian","target":[{"from":"d4","to":"d5"}]}` | Accepted; d5 pawn; White afterMove, moveMade true; Guardian discarded. |
| 2 | `{"type":"playCard","cardId":"toll"}` | Accepted refusal; d4 restored; original Guardian instance white-hand-0-guardian restored to hand, White discard empty; Black Toll discarded; White afterMove, moveMade true, both cardPlays 1. FEN `7k/8/8/8/3P4/8/8/K7 b - - 1 1`. |
| 3 | `{"type":"move","from":"d4","to":"d5"}` | Rejected ILLEGAL_MOVE: regular move already made. Digest unchanged. |
| 4 | `{"type":"endTurn"}` | Accepted; Black beforeMove; allowances reset. |
| 5 | `{"type":"move","from":"h8","to":"g7"}` | Accepted. |
| 6 | `{"type":"endTurn"}` | Accepted; White active. |
| 7 | `{"type":"move","from":"d4","to":"d5"}` | Accepted on White's subsequent turn. |
| 8 | `{"type":"endTurn"}` | Accepted; Black active. |
| 9 | `{"type":"move","from":"g7","to":"g8"}` | Accepted. |
| 10 | `{"type":"endTurn"}` | Accepted; White beforeMove. |

Continuation selected from legalDests with seed 25 and unsigned LCG `seed = imul(seed,1664525)+1013904223`, modulo enumerated moves. Final FEN `6k1/8/8/3P4/8/8/8/K7 w - - 1 3`; Guardian remains in White hand and Toll in Black discard. No temporary harness created. Prior finding summary inspected; no duplicate finding. Limitations: this finite path covers refusal with a single Guardian pawn move, not follower restoration or every multi-piece card. No card artwork inspected.

GAME_025_DONE
