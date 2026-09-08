# Coverage audit through iteration 40

COVERAGE_040_CLEAN — two executed groups, zero findings. Fresh auditor reran the parent scaffold (123 ms), added exactly one independent adversarial group, and reran once (118 ms). Journal timestamps span 19.264 seconds between auditor executions.

The independent group reconstructed all 80 per-card played counts and 1,835 valid moves directly from the 40 reviewed trace prefixes, excluding each fixed iteration's offending action and suffix. Totals agree: 4,227 valid actions, 426 card plays, 80 sampled card types, 78 played, 77 applied. Man of Straw and Split Knight remain unplayed.

Sampler inspection confirms uniform proposals over the combined hand and then the returned target list in ordinary sampling. Timing, target availability, legality, terminal-state exclusion, and mandatory rescue search condition accepted plays. Neither accepted card plays nor reachable game states are uniformly distributed. Sampling/dealing counts include generated traces; played/applied counts include only valid reviewed prefixes. Coverage does not establish every card's targets, timings, interactions, or unsupported paths as exercised.

Tooling: one read initially used the wrong coverage path; corrected to campaign/coverage.ts. No engine suites, UI tests, production edits, or commits were performed. Temporary audit scaffold removed after execution; the run journal remains for verification.
