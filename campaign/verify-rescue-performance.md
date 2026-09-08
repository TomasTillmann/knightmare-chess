Public engine trace: endTurn calls advanceTurn, which calls adjudicateTurn; legalDests can evaluate hasAfterMoveRescue while searching continuations. I will measure the supplied public state/action and inspect these shared callers before changing search order or duplicate work, preserving move-plus-card legality.

Independent finding: boolean mate/escape callers materialized the entire legal-destination map, invoking expensive move-plus-card rescue searches even after finding a valid continuation. Added exact first-success short-circuiting to legalDests and enabled it only for the existing boolean callers. Default destination enumeration and all move/card legality checks remain intact.

Measured public endTurn before: exceeded a 16,000 ms subprocess timeout. After: 509 ms, success with no outcome. Public continuation endTurn, Nc6-b4, Challenge a2, endTurn completed in 1,060 ms; the move created pendingRescue, Challenge cleared it, and play passed to White without an outcome.

Supplied black-box engine regression: 1 passed, 0 failed (688 ms test, 817 ms command). npm run typecheck passed. No test source, test commit, campaign iteration, permanent fixture, full suite, or UI test was read or run. No commits created. Parent remains responsible for full engine verification and fresh independent audit.
