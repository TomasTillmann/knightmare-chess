# Game 077: Fog of War after Earthquake promotion

Pre-action hypothesis: after an ordinary White king move, Earthquake may rotate the board so White's h4 pawn immediately promotes. Black's immediate Fog of War should restore the pawn's role and prior flags and board orientation, retain the preceding ordinary king move, and spend both cards.

Scaffold: executed successfully, four probes, zero findings.

## Setup and oracle

Exactly one normal beforeMove game was initialized with `{"fen":"k7/8/8/8/7P/8/8/K7 w - - 0 1","hands":{"white":["earthquake"],"black":["fog-of-war"]},"decks":{"white":[],"black":[]}}`. Initial structural `checkState` passed and neither king was checked. No state injection, replay, reset, or test access occurred.

Cards.md Earthquake requires rotation-triggered last-rank promotion; Fog of War cancels the other card and discards both. Rules §14.1 keeps physical square coordinates fixed. Rules §7 cancellation restores reversible promotion consequences and §7 card accounting consumes both allowances. Since Earthquake follows the ordinary move, cancellation must preserve that completed move.

Initial legal destinations: `a1:[b1,a2,b2], h4:[h5]`. After the ordinary move, enumerated Earthquake targets were clockwise with h4 promotion to each of queen, rook, bishop, knight; counterclockwise with no promotions. Selected the actual returned clockwise/knight target. Immediately thereafter Fog targets were `[undefined]` (JSON output `[null]`).

## Sequential evidence

| # | Exact action | Observed result |
|---|---|---|
| 1 | `{"type":"move","from":"a1","to":"a2"}` | Accepted; White king a2, afterMove, moveMade true. |
| 2 | `{"type":"playCard","cardId":"earthquake","target":{"direction":"clockwise","promotions":[{"square":"h4","role":"knight"}]}}` | Accepted; orientation 90, same h4 physical pawn now knight, promoted true; White allowance 1. |
| 3 | `{"type":"playCard","cardId":"fog-of-war"}` | Accepted; orientation 0, h4 exactly equals original pawn object; White king remains a2; afterMove/moveMade true; both allowances 1; original Earthquake and Fog physical cards each in owner's discard, both hands empty. |
| 4 | `{"type":"move","from":"a2","to":"a3"}` | Rejected ILLEGAL_MOVE: regular move already made; digest unchanged. |
| 5 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 6 | `{"type":"move","from":"a8","to":"b8"}` | Accepted; Black king b8. |
| 7 | `{"type":"endTurn"}` | Accepted; White beforeMove. |
| 8 | `{"type":"move","from":"a2","to":"a3"}` | Accepted; White king a3 on its next turn. |
| 9 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |

Pawn restoration was checked by deep equality, including identity `white-pawn-h4`, owner white, role/originalRole pawn, square h4, zone board, promoted false, royal false, neutral false. Every accepted action passed structural checkState. Every stated critical expectation was enforced by assertions. Continuation used seed 77 and LCG `(1664525 * seed + 1013904223) >>> 0`, selecting the modulo-index legal move; it continued this same game.

Result: 9 game actions, 8 accepted, 1 rejected; four separate saved-fixture scaffold probes; zero findings. Measured game execution wall time 20.512625 ms. Limitation: one sparse clockwise/knight promotion cancellation path with empty replacement decks; finite clean execution is not proof of general correctness.

GAME_077_DONE
