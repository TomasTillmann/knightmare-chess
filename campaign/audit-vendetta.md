VENDETTA_AUDIT_CLEAN

Fresh engine-only audit after production commit ad95061. Baseline: 2 directed, 8 randomized, 2 multi-card probes; 0 findings; 264 ms. Added exactly one independent adversarial group: pinned e2 Pawn cannot capture d3 and expose its King to the e8 Rook, while e2-e3 remains legal. Final rerun: 3 directed, 8 randomized, 2 multi-card probes; 0 findings; 267 ms. Total executed: 25 probes across two runs. Measured execution-journal interval between completed runs: 18,824 ms; both runs completed within the 45-second audit window.

Execution evidence: audit-vendetta-runs.jsonl. Temporary scaffold deleted after the final rerun. No test sources or commits inspected; no production changes.
