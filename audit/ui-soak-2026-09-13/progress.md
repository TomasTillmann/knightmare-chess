# Extended UI verification

- Checkpoint: `f53f9af` (signed successfully before audit).
- Verification started: 2026-09-13 01:36:01 UTC.
- Earliest completion: 2026-09-13 04:36:01 UTC (three hours of active verification).
- Scope: actual Chrome self-play, reproducible random multi-turn games, card combinations, desktop/mobile geometry and engine/UI consistency.
- Engine production stays unchanged. Confirmed engine faults receive failing regressions; UI faults are repaired and replayed.
- Long stress runs remain opt-in; fixed regressions stay in the ordinary Playwright suite.

## Work queue

- [ ] Add a real-UI self-play driver with independent engine and rendered-piece checks.
- [ ] Exercise randomized games from every card's practice state, preserving seeds and action traces.
- [ ] Verify multi-card effects, rollback/reactions, promotion and required-choice lifecycles across turns.
- [ ] Verify layout and targeting through narrow screens, resize, scrolling and touch/keyboard use.
- [ ] Reduce failures to deterministic regressions and rerun repaired cases.
- [ ] Repeat long games with fresh seeds after repairs; record measured coverage and runtime.
- [ ] Final visual review, build, quick-suite run and commit/push.

## Evidence

Baseline: 212 Playwright checks passed, two platform-specific skips; production build passed. Baseline tests primarily exercised individual cards and selected fixed flows, not long random games.
