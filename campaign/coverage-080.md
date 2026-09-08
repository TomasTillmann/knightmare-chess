# Coverage audit after iteration 080

COVERAGE_080_DONE — zero findings in 165 executed probes across two groups; final measured runtime 862 ms. Fresh baseline rerun: 85 probes, one group, 446 ms. Exactly one independent adversarial group reconciled all 80 retained JSON action sequences against text rows, checked seeds and complete per-player decks, and recomputed validated prefix action/move/card totals, excluding offending actions and unreviewed suffixes.

Validated numbered coverage: 80 iterations, 8,847 actions, 3,811 ordinary moves, 921 card plays. All 80 card types were sampled; 79 were played and applied. Split Knight remains absent from validated numbered play/application coverage.

The sampler proposes a physical card uniformly from the combined hands using rejection-bounded integer sampling, before checking timing and target availability. Decks use Fisher–Yates with the same bounded sampler. Rescue handling searches shuffled cards. These mechanics avoid card-name proposal weighting; legal availability, terminal rejection, and rescue searches condition accepted actions. Reachable states and accepted card plays are not claimed to be uniform.

The parent separately diagnosed all 34 Split Knight target windows across six retained traces: 214 directed targets were accepted, applied, and nonterminal, with no sampler-filter exclusion. This audit reran one validated Split Knight fixture and deterministic randomized first-action probes. Directed checks contribute no numbered coverage.

Actual executed scaffold hashes and results are retained in `coverage-080-runs.jsonl`: baseline `28d1f7a673ce7efe056d6b12e97ad3da5515f4c36ea3add43bed3909fdee1fc8`; final `86ace12e39bfc8b01b5214a216a89a329629c6680a0821dbb1a9ef047f3adc19`. The temporary audit scaffold was removed after the final execution. No test sources were read; no production or numbered artifacts were changed.
