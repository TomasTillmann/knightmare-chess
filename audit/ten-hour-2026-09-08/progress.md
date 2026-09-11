# Ten-hour engine audit

- Active goal started: 2026-09-08 21:00:37 UTC; earliest finish: 2026-09-09 07:00:37 UTC (09:00:37 Prague).
- Scope: engine movement, card semantics and interactions, transactional state, independent directed and randomized checks. UI tests excluded.
- Baseline HEAD: 1b4d496. Existing uncommitted reducer and random-191 changes are preserved, not attributed to this audit.
- Initial reducer SHA-256: 9ea3925afe637d05457e72ff3f8ac60c97296d499896ca242643fd2b1e5aa52a.
- Existing random-191 test SHA-256: 4cab3dddcd79ce5bb81934f96e0ac0e5f9e5490817e2dce3c07d0bbdd68f5e9e.
- Known open findings are recorded in ../100-game-audit/FIXES.md; no global correctness claim is currently justified.
- Confidence: passing finite probes does not imply 99.9% probability of universal correctness. Statistical bounds, if given, must identify sampling population, independence assumptions, and observed failures.

## Execution log

- Initial inspection: source rules, card catalog, public engine APIs, previous audit findings, and working-tree changes inspected. No test or production edits made by this audit.
- Clock discontinuity: tools reported 2026-09-08 21:00:50 UTC, then after several calls and an environment date update 2026-09-09 08:29:06 UTC. The intervening elapsed wall time is not counted as executed audit work. No continuous ten-hour run is claimed.
- Parent movement scaffold validated: 2,685 assertions, zero findings, 759.9 ms. Coverage: opening move count, invalid geometry/ownership, en passant victim identity, all promotion roles, Crab plus Pacifism, 36 seeded ordinary plies comparing destinations and full FEN with chessops. That oracle shares a dependency with production and validates the adapter only. Initial Pacifism fixture selected an opposing Pawn; corrected before validation and not counted as an engine defect.
- Independent en-passant agent added two horizontal discovered-check fixtures, both colors: 2,691 total assertions, zero findings; parent independently reran in 752.3 ms. Temporary worker deleted.
- Two initial agents missed unchanged-hash checkpoints and were interrupted; their in-flight patches landed afterward. Parent validated their resulting castling (2,724 assertions) and malformed-input (2,715 assertions) scaffolds clean. Two smaller fresh replacements with lower reasoning effort also missed hash checkpoints; later in-flight outputs passed with 2,727 and 2,718 assertions respectively. These are disclosed protocol deviations. Baseline/final log artifacts were introduced for parent-verifiable execution. After repeated timing failures, no further identical multi-tool assignment will be used; next mechanism bundles baseline, patch, execution and evidence capture into one command.
- Targeted baseline Crab suites: 71/71 pass, 286.4 ms. Typecheck passed. Full engine suite at concurrency2 exited1 with one reported failed test: random-052 iteration052, capture-age/effect expectations around a captured Crab. No UI tests executed.
- Independent oracle setup: isolated uv python-chess1.11.2, no project dependency edits. Initial comparison exposed differing FEN serialization conventions (unusable en-passant square vs '-'), not differing legal moves; generator now requests legal en-passant FEN for expected outputs. This adjustment is explicit and does not remove checks for legal en-passant captures.
