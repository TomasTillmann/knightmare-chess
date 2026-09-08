# Iteration 171: Forced March restricted-target validation

Corrected deterministic seed 860171 first failed at action 106. Both selected
Pawns, d3 and f3, were immobilized beside the e4 royal magnet. Forced March
incorrectly treated their proposed movement as a self-check fizzle, spending the
card and Regular Move. Rules §§13.6,18.6,24 require rejecting those restricted
targets before King-safety consequences, preserving the entire input state.
The first 105 valid actions contain 43 move commands and 14 card plays; the
remaining generated suffix is preserved but unreviewed.

Numbered red regression: `d3401ad`; focused red: `a64e855`; interaction red:
`421fa47`. Parent red gate: 29 tests, 13 passed and 16 failed, 1.784 seconds.
Production-only fix `58e676f` adds the existing movement-restriction guard to
shared `forcedMarchDests`, correcting both validation and target enumeration.
Parent green gate: 29 passed, zero failed, 1.642 seconds. Full engine suite
through 174: 5,208 passed, zero failed, 39.084 seconds. Typecheck passed.

`AUDIT_171_DONE`: 42 probes, 6 groups, 12 deterministic random moves, zero
findings, 41 ms. Coverage includes the original public checkpoint, Dungeon
immobility and expiry followed by a valid Forced March, ordinary continuations,
mirrored Black frozen targets, disabled/suspended attraction controls retaining
valid self-check fizzles, and integrated public target enumeration excluding
both frozen original Pawns without mutating its input.

Two earlier temporary audit attempts were stopped for deadline and fixture errors.
Their additions were corrected and independently validated by the parent. A new
auditor, using a smaller public-API consistency task and a different model under
the three-strike rule, completed its baseline at 06:18:54 UTC, patched at
06:19:05, and finished at 06:19:12 on 2026-09-08 (dispatch 06:18:45).
Parent verified source, file timestamps, and retained journal before cleanup.
Final source SHA-256:
`b25fa8c5e82a29c3ca509db5ed15ef63ab84997e8aa9fed9fbd88d20299bb045`.

The earlier legitimate 35-move checkmate sequence remains independently tested
in `171.stalled.json/.txt`; its sampler correction is documented separately in
`audit-terminal.md`. No engine-rule defect was attributed to that checkmate.
