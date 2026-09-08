# Coverage checkpoint 030

COVERAGE_030_DONE — two bounded groups passed, zero findings.

The parent-validated scaffold ran once, then exactly one independent adversarial group was added and the scaffold reran once. The added group independently reconstructed accepted-prefix card-play counts from the ledger and generated traces, checked all 80 reported card counts, bounded applied/fizzled outcomes by accepted plays, and checked the never-played list. It excludes every fixed iteration's offending action and all unreviewed suffixes.

Observed: 30 generated iterations, 3,091 accepted actions, 1,343 accepted moves, and 315 accepted card plays. All 80 card types were sampled; 74 were played and 73 applied. Never played: Abduction, Crusade, Legacy, Man of Straw, Mystic Shield, Split Knight.

Measured command wall times: initial execution 9.095 seconds; augmented rerun 0.107 seconds. Both exited successfully. This checkpoint checks accounting, not uniform reachable states or validation of all 80 cards. Sampling/dealing represent complete generated traces; validated play/outcome counts represent accepted prefixes only. Availability is state dependent; terminal candidates are conditioned out and mandatory rescue uses a randomized search. Six unplayed cards remain opportunity gaps; earlier generator fixes do not retroactively create coverage for them. No production files, test sources, or UI tests were read or changed. Temporary scaffold removed after execution.
