# Coverage checkpoint 110

Accepted iterations 001–110 contain 12,264 valid actions, including 5,254 moves and 1,289 card plays. All 80 card types were sampled; 79 were played and applied. Split Knight remains unplayed in numbered traces; its earlier legal-target diagnostics passed, and proposal weights remain unchanged.

The fresh audit reran the parent-validated scaffold (114 probes, one group, zero findings), added exactly one independent accounting group, and reran once: **305 probes, two groups, zero findings, 369 ms**. That group joined every raw JSON action to its TXT outcome and independently reconstructed valid-prefix totals plus all 80 per-card played/applied/fizzled counts, excluding fixed offending actions and unreviewed suffixes. Baseline-to-final journal time was 24.358 seconds. Journal: `coverage-110-runs.jsonl`; its earlier 107-iteration entry records scaffold preparation.

Parent verified the full added source, journal and SHA-256 `4efe88eb73661e6f94870e85a39d4c560d237180893de59f7321074602a3cc27` before authorizing temporary-scaffold deletion. Raw iteration 091 still records its historical generator failure; the audit verified its 132-action fixed ledger entry, production commit `940be36`, and `audit-091.md` without erasing the failure.

Fairness applies to proposals: catalog decks use rejection-bounded Fisher–Yates, and ordinary proposals choose uniformly among physical cards in both hands. Accepted positions are not uniform: timing, targets, terminal avoidance, available hands and shuffled mandatory rescue searches condition them. Counts establish observed coverage, not an unbiased distribution over reachable positions or card effects.

Parent checkpoint validation: **5,019 engine tests passed**, zero failures, 31.099 seconds; typecheck passed. No UI tests ran. Iteration 110 used a fresh replacement agent after the original missed its initial patch checkpoint; the replacement made a verified update and completed the review.

Sentinel: `COVERAGE_110_AUDIT_DONE`.
