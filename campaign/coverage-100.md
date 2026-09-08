# Coverage checkpoint 100

Accepted iterations 001–100 contain 11,124 valid actions, including 4,754 moves and 1,185 card plays. All 80 card types were sampled; 79 were played and applied. Split Knight remains unplayed, so this checkpoint does not establish its campaign interaction coverage.

The fresh audit reran the parent-validated scaffold (104 probes, one group, zero findings), added exactly one independent accounting group, and reran once: **287 probes, two groups, zero findings, 256 ms**. The added group independently reconstructed accepted action/move/card-play totals and all 80 initial-deal counts from raw traces and ledger prefixes. Journal: `coverage-100-runs.jsonl`. Audited scaffold SHA-256: `54cbc75f81c739a2b053dd68e6fae2a42eee947b41b84c2446a92a1409b49102`; parent verified it before deletion.

Fairness is limited to proposals: shuffled catalog decks use rejection-bounded Fisher–Yates, and ordinary card proposals select uniformly among physical cards in both hands. Accepted positions are not uniform. Timing and legal targets filter proposals; terminal outcomes before 50 moves are rejected; mandatory rescue searches a shuffled hand until a successful escape; available cards and targets depend on state. The generator also prioritizes card attempts probabilistically before falling back to moves. No weighting correction is asserted, and these counts are coverage evidence rather than an unbiased distribution over positions or card effects.

Raw iteration 091 retains its historical generator FEN-check failure. Its ledger records a reviewed 132-action prefix, fix commit `940be36`, and `audit-091.md`; the offending action is excluded from valid coverage. The raw failure and trace were preserved, and the audit explicitly checked that `coverage.failures` still reports that historical failure.

Parent checkpoint validation: 5,005 engine tests passed in 31.754 seconds and typecheck passed. No UI tests were run by this audit; no test or production files were changed.

Sentinel: `COVERAGE_100_AUDIT_DONE`.
