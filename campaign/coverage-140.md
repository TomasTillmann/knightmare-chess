# Coverage audit through iteration 140

COVERAGE_140_AUDIT_DONE

Fresh audit baseline: 223 probes, one group, zero findings, 407 ms. Baseline SHA256: `a4bdd36bb4f1230434ecf659bb5dea716305ab7ab87cb48f82dfdad1673c0cac`.

Timing history: the first audit missed its startup gate. The second audit's 503-probe evidence below is valid, but its patch missed the 30-second gate. A fresh smaller audit reran that scaffold immediately (503 probes, two groups, zero findings, 569 ms), then added exactly one independent group to reconcile sampled-card counts across all 140 traces, validate catalog IDs and nonnegative integer counts, and compare all 80 totals. This fresh patch closes the patch timing gate; final execution evidence follows in the retained journal.

Prior audit: 503 probes, two groups, zero findings, 439 ms, completed at 2026-09-08T04:22:41.079Z. Scaffold SHA256: `66f481ee1e012784e7d3a40354c5fc91eb8b52f98ceb8f24f28632de14a5b94d`. Approximately 38 seconds elapsed from dispatch to its final sentinel, including tool overhead; its patch timing gate was missed as noted above.

Fresh final audit: 723 probes, three groups, zero findings, 448 ms, completed at 2026-09-08T04:24:42.877Z. Final scaffold SHA256: `310ae9c8d09ee1723614532e5c5aacb5ba0ffeb90897006440945fd0c393b238`. Approximately 36 seconds elapsed from fresh dispatch to final sentinel, including tool overhead. The new sampled-card group adds 140 trace-validation probes and 80 aggregate-comparison probes.

The single independent adversarial group reconstructed the seeded 32-bit PRNG and rejection-bounded Fisher–Yates shuffle for every one of 140 traces. It checked both ordered five-card hands and ordered 75-card decks for White then Black, consuming the same stream in that order: 280 additional probes.

Reviewed coverage contains 15,761 valid actions, 6,739 moves, and 1,644 card plays. All 80 catalog card types were sampled, played, and successfully applied; none remain unplayed. The existing fixed iteration 91 is counted only through its accepted prefix.

Fairness scope: ordinary proposals sample uniformly among physical cards in both hands before eligibility checks; rescue proposals traverse a shuffled hand. Acceptance is conditioned on timing, eligibility, target availability, reducer success, and continuation requirements, so accepted states and successful card plays are not uniformly distributed. The shuffle reconstruction verifies deterministic ordered initial deals against an independent implementation, not statistical uniformity of accepted gameplay or exhaustive card-interaction correctness.

No engine, tooling, or test sources were edited. No full engine suite or UI tests were run. Run records are retained in `coverage-140-runs.jsonl`; the temporary scaffold is removed after parent verification.
