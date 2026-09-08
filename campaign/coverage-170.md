# Coverage 170 audit

`COVERAGE_170_AUDIT_DONE`: 252 probes, 2 groups, zero findings, 502 ms.
All 80 catalog cards were sampled, played, and applied in reviewed valid prefixes:
19,116 actions, 8,183 regular move commands, and 1,975 card plays.
Offending states and unreviewed suffixes are excluded from played/applied totals.

The parent checked distinct seeds, full catalog permutations in both decks,
trace/review correspondence, accepted-prefix boundaries, applied-card totals,
uniform rejection-sampled hand proposals, and shuffled targets. The fresh auditor
independently summed sampled-card counts across all 170 traces and matched every
catalog total to the report. Proposals are uniform among physical cards in hand;
accepted counts and reachable positions are conditioned by legal timing/targets,
terminal avoidance, and mandatory rescue searches, not uniformly distributed.

Source SHA-256: `fc80ceac09a2d3738c4498a4ec6618427b229f003eb58ba4540b404f005b4a3d`.
Fresh dispatch: 05:56:31 UTC on 2026-09-08; baseline completed 05:56:45,
real patch 05:56:57, final run 05:57:05. Parent verified source, hash, modification
time, and retained journal before authorizing temporary scaffold deletion.

Parent engine gate through 170: 5,173 passed, zero failed, 40.494 seconds.
Typecheck passed. Unfinished 171/172 and the separately committed red sampler
completion regression were excluded from that engine gate. No UI tests ran.
