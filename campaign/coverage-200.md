# Coverage 200 audit

`COVERAGE_200_AUDIT_DONE`: 282 probes, 2 groups, zero findings, 740 ms.
All 80 catalog cards were sampled, played, and applied in reviewed valid prefixes:
22,614 actions, 9,676 regular move commands, and 2,358 card plays.
Offending states and unreviewed suffixes are excluded from played/applied totals.

The parent checked distinct seeds, both catalog deck permutations, trace/review
correspondence, prefix boundaries, applied totals, rejection-sampled physical-hand
proposals, shuffled targets and terminal conditioning. The fresh independent group
reconciled every card's sampled total directly from the preserved traces.

Proposals are uniform among physical cards in hand. Accepted cards and positions
are conditioned by legal timing/targets, mandatory rescue searches, and terminal
avoidance, including outcomes deferred until endTurn. They are not uniformly
distributed. Exercising every card does not exhaust its possible game states.

Fresh auditor dispatched at 07:36:49 UTC on 2026-09-08. Its read-only baseline
completed at 07:36:53.179, patch at 07:37:10, and expanded rerun at 07:37:14.164.
Parent inspected the source, modification time and hash, then independently ran
all 282 probes successfully in 636 ms and persisted the journal at 07:37:30.810.

Final source SHA-256:
`9ba46d0d3964af8401a0ae19dc5c69bccd2c5b4d17bd1d5ef95534ae9f3293e4`.
The temporary scaffold was approved for deletion after parent verification.

Parent full engine gate through 200: 5,254 passed, zero failed, 50.722 seconds.
Typecheck passed. Numbered iterations above 200 were excluded from that engine
gate. No UI tests ran.
