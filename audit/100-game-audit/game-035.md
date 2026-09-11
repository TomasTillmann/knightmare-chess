# Game 035 — Panic timeout under bishop check

Pre-action hypothesis: after Black creates diagonal bishop check and plays Panic, timeout while White has legal escapes may grant Black another move while White remains checked. This would duplicate the unresolved §11.6 versus Panic lost-turn interpretation in prior game-04, rather than establish a new confirmed bug. Independently vary the attack to a bishop and then use a seeded same-game continuation.

Initial planned options: `{fen:"k7/8/8/8/2b5/8/8/4K2R b - - 0 1",hands:{black:["panic"]}}`. No setup timing overrides.

## Result: inconclusive checked-timeout hypothesis; clean safe-timeout path

The actual setup matched those options, and initial `checkState` passed with neither king checked. The chosen legal bishop move c4-b5 did **not** check e1. This is an audit-driver geometry mistake, not an engine finding. No reset or replay was performed. Therefore this game does not independently reproduce the prior game-04 ambiguity; that prior report remains an unconfirmed duplicate candidate only.

The authoritative Panic text in cards.md and §18.5 says the opponent loses their turn after expiry. Catalog timing is afterMove. §11.6 requires check cured before turn end for a move leaving the king checked, but the relation to timeout was not exercised here. Prediction for the actual safe path: timeout should consume White's turn, clear Panic, and permit Black to move; this matched observations.

Scaffold executed successfully: 4 probes, 0 findings. `cardPlayTargets` was enumerated immediately before Panic and returned `[undefined]` (JSON output `[null]`); that returned value was supplied. Initial legal destinations included c4-b5. Every accepted state passed `checkState`, and each original input digest remained unchanged.

| # | Exact action | Result | Resulting turn | FEN |
|---|---|---|---|---|
| 1 | move c4-b5 | accepted | Black afterMove | k7/8/8/1b6/8/8/8/4K2R w - - 1 2 |
| 2 | playCard panic, target undefined | accepted | Black afterMove | k7/8/8/1b6/8/8/8/4K2R w - - 1 2 |
| 3 | endTurn | accepted | White beforeMove | k7/8/8/1b6/8/8/8/4K2R w - - 1 2 |
| 4 | panicTimeout | accepted | Black beforeMove | k7/8/8/1b6/8/8/8/4K2R b - - 2 2 |
| 5 | move b5-d3 | accepted | Black afterMove | k7/8/8/8/8/3b4/8/4K2R w - - 3 3 |
| 6 | endTurn | accepted | White beforeMove | k7/8/8/8/8/3b4/8/4K2R w - - 3 3 |
| 7 | move e1-d2 | accepted | White afterMove | k7/8/8/8/8/3b4/3K4/7R b - - 4 3 |
| 8 | endTurn | accepted | Black beforeMove | k7/8/8/8/8/3b4/3K4/7R b - - 4 3 |

Both kings remained safe and outcome remained null after all eight actions. White's pre-timeout destinations were e1:[d1,d2,f2], h1:[f1,g1,h2,h3,h4,h5,h6,h7,h8]. After timeout Black had b5:[f1,e2,d3,a4,c4,a6,c6,d7,e8], a8:[a7,b7,b8]. Continuation used seed 35, unsigned LCG `seed=(Math.imul(seed,1664525)+1013904223)>>>0`, choosing `seed % moves.length` from flattened legalDests, with endTurn after each move.

Counts: exactly one game, 8 actions accepted, 0 rejected; 4 directed actions and 4 continuation actions (2 seeded moves). Game command measured 26.354 ms; scaffold command tool wall time 0.0165 s. No harness files created. Finite path only; checked-timeout behavior remains untested by this game.

GAME_035_DONE
