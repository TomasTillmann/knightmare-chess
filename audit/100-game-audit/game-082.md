# Game 082 — Riposte after en passant

Preaction hypothesis: after an ordinary en passant capture, Riposte restores the captured pawn on its original occupied square, captures the attacking pawn, expires en passant availability, and applies its next-move forfeiture while preserving normal card timing. A minimal game with a real double push and en passant capture will test these transitions; finite clean evidence is not proof.

## Execution

Parent scaffold executed successfully: 4 probes, 0 findings. One independent game executed once through public APIs; no reset, replay, tests, production edits, or temporary harness. Initial `checkState` passed; both kings were independently checked with `isKingInCheck` and returned false. Structural checks passed after every accepted action; both rejected actions preserved the input digest.

Exact createGameState options:

```json
{"fen":"7k/3p4/8/4P3/8/8/8/K7 b - - 0 1","hands":{"black":["riposte","peace-talks","charge"]},"decks":{"black":["riposte"]}}
```

Rules: cards.md Riposte and rules.md §18.4 require ordinary opposing capture, original occupied victim square for en passant, attacker capture, cleared en passant, one lost next Regular Move, reset card allowance, and eventual normal move availability. Catalog timing was inspected: Riposte `afterOpponentMove`; Peace Talks and Charge `afterMove`.

Predictions below were printed before each action. `endTurn` has no additional payload; card plays omitted target because Riposte's enumerated target was `undefined`.

| # | Exact action | Prediction and actual result |
|---|---|---|
| 1 | move d7 d5 | Accepted as predicted. EP d6, victim identity black-pawn-d7 now d5; FEN `7k/8/8/3pP3/8/8/8/K7 w - d6 0 2`. |
| 2 | endTurn | Accepted; white beforeMove, EP retained. |
| 3 | move e5 d6 | Accepted ordinary EP; black-pawn-d7 captured, white-pawn-e5 on d6; FEN `7k/8/3P4/8/8/8/8/K7 b - - 0 2`. |
| 4 | playCard riposte | Accepted as predicted: black-pawn-d7 restored to d5; white-pawn-e5 captured with null square; d6 empty; EP empty. White remains afterMove with moveMade true. FEN `7k/8/8/3p4/8/8/8/K7 b - - 0 2`; pending lost moves `["black"]`. |
| 5 | endTurn | Accepted; black automatically afterMove/moveMade true, skipped black, lost-move queue absent, allowance reset to zero; FEN `7k/8/8/3p4/8/8/8/K7 w - - 1 3`. |
| 6 | move d5 d4 | Rejected as predicted: ILLEGAL_MOVE, regular move already made. |
| 7 | playCard charge | Rejected INVALID_TIMING: forfeited regular move cannot be replaced or extended. Prediction called Charge an instead-of-move card imprecisely; its actual catalog timing is afterMove and this verifies extension prohibition only. |
| 8 | endTurn | Accepted; white beforeMove. |
| 9 | move a1 b1 | Seed-selected legal move accepted; FEN `7k/8/8/3p4/8/8/8/1K6 b - - 2 3`. |
| 10 | endTurn | Accepted; black beforeMove/moveMade false, confirming penalty expired. |
| 11 | move d5 d4 | Seed-selected legal move accepted; same move rejected in action 6 now succeeds; FEN `7k/8/8/8/3p4/8/8/1K6 w - - 0 4`. |
| 12 | endTurn | Accepted; white beforeMove, same final FEN. |

Legal destinations were enumerated before double push (`d7→d5,d6`, `h8→g7,h7,g8`) and EP (`a1→b1,a2,b2`, `e5→d6,e6`). Before action 4, `cardPlayTargets(riposte)` returned `[undefined]`, and that exact target was selected. During forfeiture legalDests was empty; Peace Talks, Charge and Riposte targets were all empty. Peace Talks had no Continuing Effect to remove, so successful afterMove card use was not exercised. Action 7 deliberately omitted a Charge target and was rejected at timing before target validation; it does not establish otherwise-valid Charge target behavior.

Only physical `black-hand-0-riposte` was discarded; `black-deck-0-riposte` entered hand once. Peace Talks and Charge remained in hand. Both card counts reset to zero on the skipped black turn.

Seeded continuation: seed 82, recurrence `(imul(seed,1664525)+1013904223)>>>0`; outputs 1150395273 and 3076380500 selected index zero from respective legal action lists `[a1b1,a1a2,a1b2]` and `[d5d4,h8g7,h8h7,h8g8]`.

Result: 12 actions, 10 accepted, 2 rejected; 25 ms measured game execution. No finding on the exercised path. Limitations: no successful afterMove card action, no valid-target instead-of-move card probe, no direct-mate/fizzle/compound interactions, and no independent trigger-history assertion. No relation to prior confirmed finding families. Finite clean evidence is not proof.

GAME_082_DONE
