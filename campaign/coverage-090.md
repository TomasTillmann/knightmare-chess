# Coverage audit through iteration 090

Result: clean, zero findings. Final bounded run executed 187 probes across two groups in 231 ms; baseline rerun executed 94 probes in 252 ms. Journal: `coverage-090-runs.jsonl`. Final scaffold SHA-256: `59fea73eb90a5631709e5632b7d10c6680ad604ce79d8701281c5120d47fb253`.

The independent adversarial group reconstructed valid-prefix accounting directly from all 90 trace JSON files, verified deck uniqueness for both players, and asserted the corrected boundaries explicitly: iteration 017 accepts 25 actions and iteration 090 accepts 80. Aggregate totals match: 9,908 valid actions, 4,256 regular moves, and 1,034 card plays. All 80 card types were sampled; 79 were played and applied. Split Knight remains unplayed and has no validated application coverage.

Generator inspection shows ordinary proposals choose uniformly among physical cards in both hands using rejection-bounded random indices; rescue proposals shuffle those physical cards. Legal availability, terminal-candidate exclusion, and mandatory rescue conditioning make accepted states and successful card plays nonuniform. These are stated limitations, not evidence of an additional proposal weighting defect. Dealt/sample counts include generated suffixes; played/applied counts exclude invalid actions and suffixes. No weighting change is warranted by this checkpoint.

A parse typo in the added audit group prevented its first attempted execution; it was corrected before the successful measured run. No engine or test changes were made.
