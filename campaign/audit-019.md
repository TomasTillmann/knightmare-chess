AUDIT_019_CLEAN

Fresh engine-only audit reran the validated scaffold, added exactly one independent adversarial group, then reran once. Both runs passed with zero findings.

Baseline: 2 directed, 8 randomized, 2 multi-card probes; measured harness wall time 805 ms.
Final: 5 directed, 8 randomized, 2 multi-card probes; measured harness wall time 949 ms.
Total executed by this auditor: 27 probes. Audit execution spanned approximately 23 seconds.

Independent group: replaying a consumed timeout must fail without mutating the post-timeout state, checked for both acting colors and with Truce continuing. Existing probes checked FEN actor/counters/en-passant, no fabricated piece movement, input immutability, card/deck preservation, history, and continuing effects.

No test sources, test commits, permanent fixtures, production edits, UI tests, or full-suite execution were used. Temporary probe harness deleted after successful execution.
