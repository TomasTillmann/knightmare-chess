# Coverage 160 audit

`COVERAGE_160_AUDIT_DONE`: 242 probes, 2 groups, zero findings, 455 ms.
The fresh agent independently summed sampled-card counts across all 160 traces;
every catalog total matched the coverage report. All 80 cards were sampled,
played, and applied within the reviewed campaign. Reviewed valid prefixes contain
17,982 actions, 7,683 regular move commands, and 1,871 card plays. Offending
generated states and unreviewed suffixes are excluded from played/applied counts.

The parent verified complete catalog permutations in both decks, distinct seeds,
trace/review action correspondence, accepted-prefix boundaries, applied-card
totals, and the rejection-sampled uniform hand proposals and shuffled target order.
Uniform proposals over physical cards currently in hand do not imply uniform
accepted card counts or uniform reachable game states: timing, legal targets,
terminal-state conditioning, and mandatory rescue searches affect those counts.

Source SHA-256: `829124234ed00610cd15ff4f14f3839740c7e5fc01f829d22f130b0688a882e8`.
The successful fresh run completed its baseline at 05:32:46 UTC, patched at
05:33:02, and completed its added group at 05:33:10 on 2026-09-08. The parent
verified the source, file modification time, and journal before authorizing cleanup.
Two earlier attempts were interrupted: concurrent full-suite CPU contention
delayed one baseline, and a default-sandbox journal denial delayed the other.
The successful dispatch explicitly selected the authorized write permission.

Parent full engine gate through iteration 160: 5,158 passed, zero failed,
37.364 seconds. Typecheck passed. No UI tests were run.
