# Coverage audit through iteration 130

COVERAGE_130_AUDIT_DONE

- Baseline: 213 probes, 1 group, 0 findings; measured wall time 543 ms.
- Final single rerun: 473 probes, 2 groups, 0 findings; measured wall time 336 ms; completed 2026-09-08T03:56:26.339Z.
- Audited scaffold SHA-256: `ed963fef495cba040cb9b001c004d0073fa12117497f609beb5433d02b9db788`.
- Retained journal: `coverage-130-runs.jsonl` (earlier preparation entries retained).

The baseline joins every JSON action to its text row, verifies valid prefixes and all 80 catalog card tallies, and retains the historical iteration 091 failure alongside its documented fix. Totals are 14,607 valid actions, 6,239 moves, and 1,539 card plays. All 80 types were sampled; 79 were played and applied. Split Knight remains unplayed.

Exactly one independent adversarial group reconstructs the seeded PRNG and rejection-bounded Fisher–Yates shuffle without calling the generator. It checks exact hand and remaining deck order for both colors in all 130 traces, retaining the shared random stream between colors (260 additional probes).

Generator source review confirms rejection bounds avoid modulo bias in physical-hand proposals, sampling is recorded before eligibility filtering, and legal targets are traversed in shuffled order. Rescue paths shuffle the hand. These properties do not imply uniform accepted actions or game states: timing, legality, continuation checks, and fallback paths condition acceptance.

No engine, tooling, or test changes; no full or UI tests run by this audit. Parent verified the complete scaffold source, exact hash, both fresh journal runs, and this report. Temporary scaffold removed after acknowledgment; this report and the journal remain. Parent reports full engine validation passed 5,066/5,066 in 33.182 seconds and typecheck passed.
