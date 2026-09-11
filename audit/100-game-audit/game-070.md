# Game 070: Evil Eye and en passant

Pre-action hypothesis (corrected before any game action after reading §22.10): Evil Eye uses the legal en-passant threat to capture the physical opposing Pawn on its occupied square, while leaving its attacking Pawn stationary. The empty en-passant destination must not identify the victim. Evil Eye must clear en-passant availability after success. If reachable in the same game, a neutral attacker may perform the same stationary capture.

Scaffold executed: SCAFFOLD_OK probes=4 findings=0.

Completed: no finding in one normal beforeMove game; no resets or replay. Baseline `33e03989fab9449d87b857fc5673f67d05841928`. No tests read, run, or edited. Only this report was written.

## Rules and setup

`rules.md` §22.10 explicitly treats a legal en-passant capture as a threat to the physical Pawn on its occupied square. Evil Eye removes only that victim and leaves the attacker stationary, consumes the Regular Move, clears en passant, and replaces its physical card once. §15.1 says Neutrality changes control while preserving identity, original pawn orientation, and valid en-passant opportunities. Catalog timing is `neutrality: afterMove`, `evil-eye: beforeMove`. `cards.md` Evil Eye agrees that the capturing piece stays stationary.

Exact createGameState options:

```json
{"fen":"7k/3p4/8/4P3/8/8/8/K7 b - - 0 1","hands":{"white":["evil-eye"],"black":["neutrality"]},"decks":{"white":["hostage"],"black":["hostage"]}}
```

Initial checkState passed and isKingInCheck returned false for both kings. Initial legalDests was `[["d7",["d5","d6"]],["h8",["g7","h7","g8"]]]`.

## Exact sequential actions and results

Predictions were emitted immediately before each action in the single inline driver. Every result passed checkState.

| # | Exact action JSON | Prediction and actual result |
|---|---|---|
| 1 | `{"type":"move","from":"d7","to":"d5"}` | Accepted. Physical `black-pawn-d7` moved to d5. EP `[{"target":"d6","pawnId":"black-pawn-d7"}]`; FEN `7k/8/8/3pP3/8/8/8/K7 w - d6 0 2`. Black afterMove. |
| 2 | `{"type":"playCard","cardId":"neutrality","target":"e5"}` | Accepted, selected from returned targets `["e5"]`. `white-pawn-e5` remained e5 with original white ownership and neutral=true. EP and FEN unchanged. Black cardPlays=1; drew `black-deck-0-hostage`, no discard. |
| 3 | `{"type":"endTurn"}` | Accepted. White beforeMove; EP unchanged. |
| 4 | `{"type":"playCard","cardId":"evil-eye","target":{"attacker":"e5","victim":"d6"}}` | Predicted rejection of empty EP destination. Rejected `INVALID_TARGET: Choose occupied attacker and victim squares.` Digest unchanged, card remained in hand, White beforeMove with cardPlays=0. |
| 5 | `{"type":"playCard","cardId":"evil-eye","target":{"attacker":"e5","victim":"d5"}}` | Accepted using the sole returned target. `black-pawn-d7` became zone=captured, square=null, capturedBy=white. Neutral `white-pawn-e5` stayed e5 with identity/neutrality intact. EP empty. FEN `7k/8/8/4P3/8/8/8/K7 b - - 0 2`. White afterMove, moveMade=true, cardPlays.white=1. |
| 6 | `{"type":"endTurn"}` | Accepted; Black beforeMove, same FEN. |
| 7 | `{"type":"move","from":"h8","to":"h7"}` | Accepted; FEN `8/7k/8/4P3/8/8/8/K7 w - - 1 3`. |
| 8 | `{"type":"endTurn"}` | Accepted; White beforeMove. |
| 9 | `{"type":"move","from":"a1","to":"b1"}` | Accepted; FEN `8/7k/8/4P3/8/8/8/1K6 b - - 2 3`. |
| 10 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |
| 11 | `{"type":"move","from":"h7","to":"g8"}` | Accepted; FEN `6k1/8/8/4P3/8/8/8/1K6 w - - 3 4`. |
| 12 | `{"type":"endTurn"}` | Accepted; White beforeMove. |
| 13 | `{"type":"move","from":"b1","to":"c2"}` | Accepted; FEN `6k1/8/8/4P3/8/8/2K5/8 b - - 4 4`. |
| 14 | `{"type":"endTurn"}` | Accepted; Black beforeMove. |

Immediately before Evil Eye, legalDests was `[["a1",["b1","a2","b2"]],["e5",["d6","e6"]]]` and cardPlayTargets was `[{"attacker":"e5","victim":"d5"}]`. Thus ordinary destination d6 and physical card victim d5 were distinguished correctly. The deliberate missing target had the documented `{attacker,victim}` schema.

Evil Eye history was exactly `{"type":"cardPlayed","cardId":"evil-eye","target":{"attacker":"e5","victim":"d5"},"capturedId":"black-pawn-d7","capturedIds":["black-pawn-d7"],"movement":[],"preservePreviousMove":false}`. White drew `white-deck-0-hostage` once, leaving deck empty, and discarded exactly `white-hand-0-evil-eye`. Neither king moved during the stationary capture. Neutrality remained active as observed through neutral=true on the attacker; its effect-object contents were not printed.

Continuation used seed 70, updated by `(Math.imul(seed,1664525)+1013904223)>>>0`, selecting index `seed % moves.length` from each fresh public legalDests enumeration. Four Regular Moves plus four endTurn actions passed; prediction was successful legal continuation with structural invariants preserved.

## Counts, time, limitations

Scaffold: 4 probes, zero findings. One independent adversarial group/game: 14 public actions, 13 accepted and 1 deliberately rejected, zero findings. Single-game driver measured 47.465 ms with performance.now; shell command wall time 52.749 ms. Setup/report latency was not separately instrumented, so total assignment completion within 45 seconds is not claimed. No temporary harness file existed.

Covered: Evil Eye using an actual double-step en-passant opportunity, physical victim identity, legal stationary neutral attacker, incorrect empty-square target rejection, card consumption/replacement, move consumption, EP clearing, and seeded continuation. No ordinary en-passant move was executed: Evil Eye consumed its legal threat as specified. No traps, composites, castling-right removal, direct mate, or pinned attackers were exercised. No findings overlap prior audit families. A finite clean path is not proof of correctness.

GAME_070_DONE
