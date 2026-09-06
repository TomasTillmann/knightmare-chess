# Round 12 state/cards audit: no new bugs found

## Result

No independent rule breakage, exception, rollback defect, state mutation, nondeterminism, card-conservation failure, or history/clock inconsistency was confirmed in this bounded pass against the current shared checkout.

## Coverage

- Traced all 19 implemented card resolvers and the shared reducer paths for timing, target validation, original/current identity, neutrality, simultaneous movement, replacement-versus-after-move resolution, direct-mate fizzle, self-check rollback, pending rescue, card spend/draw/discard, history, promotion, turn rollover, and move clocks.
- Ran the complete engine regression suite: **875/875 tests passed** across 85 suites.
- Probed four distinct replacement-move families with transformed current/original identities and FEN halfmove counters: Long Jump, Dubbing, Squaring the Circle, and Evangelists.
- The only candidate found during that matrix was rejected after checking the authoritative card-specific rulings: `rules.md` §13.8 explicitly makes Long Jump a non-Pawn clock move, while §13.9 and §13.10 reset Dubbing/Squaring only for an unpromoted **original** Pawn. The observed `12 -> 13` and `12 -> 0` controls therefore match the rules.
- Checked the successful/fizzled replacement paths against the existing shared `completeReplacementMove` clock behavior and confirmed that a fizzled effect advances the clock only when the replacement move is consumed, without falsely recording the staged piece relocation.
- A real-board upper-bound Onslaught target-enumeration probe with 16 Pawn-capable pieces completed an illegal self-check decision deterministically in 12 ms; no practical hang or state change was reproduced.

## Scope boundary

The dedicated Round 12 en-passant/state and Coup/castling auditors own those matrices, so their findings were not duplicated. UI/browser behavior was excluded by assignment. No production source, test, package, configuration, or earlier audit file was modified.
