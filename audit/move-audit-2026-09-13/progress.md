# Move generator / move applier audit — 2026-09-13

- Started: 2026-09-13 01:23:44 UTC (03:23:44 Europe/Prague).
- Earliest completion: 2026-09-13 11:23:44 UTC (13:23:44 Europe/Prague).
- Scope: engine only; no production or UI edits, no UI tests.
- Allowed output: regression/characterization tests, temporary bounded probe harnesses, audit evidence and Markdown notes.
- Authority: rules.md and cards.md, with publisher FAQ controlling disputes. Unclear behavior is presumed correct and recorded without failing assertions.
- Existing dirty files at start: package-lock.json, package.json, src/App.tsx, src/BoardEffects.tsx, src/cardInteractions.ts, src/debugGame.ts, src/styles.css; untracked checks/all-cards.js, playwright.config.ts, src/gameInteractions.ts, tests/.
- Status: running. A clean probe group does not establish overall engine correctness.

## Evidence log

Initial inspection: public APIs are createGameState, legalDests, applyAction, cardPlayTargets, isKingInCheck and specialized card destination functions. Existing seeded generator is src/game/cards/random-campaign.ts. Publisher FAQ is already preserved at audit/ten-hour-2026-09-08/official-faq.txt.

- First targeted baseline: 15/15 existing engine tests pass (random campaign tools, forged EP geometry, castling identity), 619 ms.
- Pawn probe: 20 new adversarial cases, zero findings, parent rerun 225 ms including base.
- Castling probe: 20 new adversarial cases, zero findings, parent rerun 252 ms including base. Four originally malformed probe FENs were corrected before counting results; all now include both royal identities. Transit/start check is legal under publisher FAQ p.8.
- Campaign 9130100: 100 bounded random seeds × at most 50 moves started, with independent state invariants and deterministic replay. Candidate card counts are proposals, not successful plays.
- Full pre-existing engine suite exited successfully (node --import tsx --test src/game/cards/*.test.ts). Engine-only TypeScript check passed with TypeScript 7 CLI flags --ignoreConfig --types node. No UI tests ran.
- Rotation group: 16 cases (4 orientations × 2 pawn owners × neutral status), analytic forward direction and exhaustive destination agreement, zero findings; parent rerun 279 ms including base.
- Neutral group: first worker interrupted for missing 30-second patch checkpoint, replaced with a smaller exact fixture assignment. Replacement: 8 cases, exhaustive destinations, zero findings; parent rerun 256 ms including base.
