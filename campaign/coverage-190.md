# Coverage 190 audit

`COVERAGE_190_AUDIT_DONE`: 432 probes, 4 groups, zero findings, 493 ms.
All 80 catalog cards were sampled, played, and applied in reviewed valid prefixes:
21,439 actions, 9,176 regular move commands, and 2,235 card plays.
Offending states and unreviewed suffixes are excluded from played/applied totals.

The parent checked distinct seeds, both catalog deck permutations, trace/review
correspondence, prefix boundaries, applied totals, rejection-sampled physical-hand
proposals, shuffled targets and terminal conditioning. Independent groups reconciled
each card's sampled counts, initial deals, and played/fizzled counts.

Proposals are uniform among physical cards in hand. Accepted cards and positions
are conditioned by legal timing/targets, mandatory rescue searches, and terminal
avoidance, including outcomes deferred until endTurn. They are not uniformly
distributed. Exercising every card does not exhaust its possible game states.

Two initial auditors narrowly missed the 15-second baseline deadline while their
journal-writing commands required escalation. Their landed groups were retained
and parent-validated. The parent changed baseline execution to read-only, removing
that write requirement. A fresh auditor dispatched at 07:10:33 UTC on 2026-09-08
executed the baseline at 07:10:37.726, patched at 07:10:57, and completed its one
expanded rerun at 07:11:01.174. Parent verified the source, modification time and
hash, then reran all 432 probes successfully in 552 ms and persisted the journal.

Final source SHA-256:
`378256f1668fc3df26e327f6620cd20980a4959e6d12da7b147bf04b12eee894`.
The temporary scaffold was approved for deletion after parent verification.

Parent full engine gate through 190: 5,240 passed, zero failed, 44.586 seconds.
Typecheck passed. Unfinished numbered iterations above 190 were excluded from that
engine gate. No UI tests ran.
