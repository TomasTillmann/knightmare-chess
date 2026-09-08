# Coverage 180 audit

`COVERAGE_180_AUDIT_DONE`: 263 probes, 3 groups, zero findings, 520 ms.
All 80 catalog cards were sampled, played, and applied in reviewed valid prefixes:
20,265 actions, 8,676 regular move commands, and 2,102 card plays.
Offending states and unreviewed suffixes are excluded from played/applied totals.

The parent checked distinct seeds, catalog permutations in both decks, trace/review
correspondence, accepted-prefix boundaries, applied-card totals, uniform rejection-
sampled physical-hand proposals, shuffled targets, and terminal conditioning.
Independent groups reconciled every sampled-card total and every initial-hand
deal count against the coverage report. All cards have positive counts.

Proposals are uniform among physical cards in hand. Accepted cards and reachable
positions are conditioned by legal timing/targets, mandatory rescue searches,
and terminal avoidance, including outcomes deferred until endTurn. They are not
uniformly distributed. Exercising all cards does not exhaust their possible states.

Source SHA-256: `24462363a958c27cd7f33b1826818e06ef2bedc263d295f8fc12aa7cceb22b28`.
The first fresh audit missed the 15-second baseline gate (18 seconds after dispatch).
Its late sampled-count patch was retained and validated by the parent. A new fresh
auditor added exactly one independent dealt-count group. Dispatch: 06:38:35 UTC on
2026-09-08; baseline completed 06:38:48, patch 06:38:57, final run 06:39:05.
Parent verified source, hash, modification time and retained journal before
authorizing deletion of the entire temporary scaffold.

Parent full engine gate through 180: 5,220 passed, zero failed, 43.054 seconds.
Typecheck passed. Unfinished numbered iterations above 180 were excluded from that
engine gate. No UI tests ran.
