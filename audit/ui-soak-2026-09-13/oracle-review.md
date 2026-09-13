# Self-play oracle review

Reviewed `tests/support/selfPlay.ts` and `tests/self-play.spec.ts` independently. No test or production changes.

The runner keeps a separate Node-side `GameState`, proposes actions through public engine APIs, applies each action with `applyAction`, and then performs the corresponding browser input. It compares actual rendered piece classes and bounding boxes against the resulting engine position, rather than only checking accessibility text. Ordered card names, active hands, effect types, fixed orientation, selected controls, game outcomes, browser errors, and horizontal overflow are checked after each action.

Limits visible in the code:

- This is a UI/engine consistency oracle, not independent verification of chess/card rules: both sides use the same engine and debug fixture constructor.
- Selection paths, required controls, and expected card playability reuse production UI adapters. `src/App.tsx` imports the same `cardInteractions`, `moveChoices`, and `requiredSelection` helpers as the driver. A shared adapter omission can escape those assertions; public engine target probes provide a partial cross-check only for cards actually selected.
- Card actions sample at most 12 targets per physical card, except the explicitly requested opening. For selected cards, target coverage checks are exhaustive only up to 24 targets, then probe first/middle/last.
- Effect comparison checks types/counts, not every rendered target, duration, label, or marker. Board comparison checks role/color/square, not physical piece identity; hand comparison checks ordered names, not hidden instance IDs.
- Date-based deadlines are frozen and advanced deliberately. Random Abduction answers are correct or time out; wrong guesses need the separate focused tests.
- Runs are bounded action sequences. Reaching the action cap without a terminal outcome passes; report them as games/sequences exercised, not all completed games.
- Mobile moves and physical-card selection use native touch. Choice buttons use Playwright clicks. Both projects use Google Chrome; the mobile project is emulation, not real-device Safari coverage. The runner checks horizontal overflow and piece placement, but does not independently certify every visual detail or assistive-technology behavior.
- Random choices are deliberately weighted toward cards and include curated practice openings. They are not uniform legal-action sampling. A seed is repeated across desktop and mobile, so report unique seeds separately from project runs.

No clear defect found in the assertion loop or the reviewed action/adapter linkage. This was a read-only code review, not an additional executed-game campaign. The oracle meaningfully catches rendered/UI divergence from the public engine; it does not prove exhaustive rules, hidden-state, visual, or interaction coverage.

Reviewed source SHA-256:

- `tests/support/selfPlay.ts`: `95ea1d1b5e5cc3c424732cefffb1a13c8082cbe379fb765b5e6d4d717cae5978`
- `tests/self-play.spec.ts`: `e739c8acfd0bae4e2ba3aa9408dd3750a7f5b4f5b7a087f4532b1362613ab48d`
- `playwright.config.ts`: `0e29d8163657026425a7efc19d6d9fc7517f919c60ffca1e80053dc057d1482f`

Subsequent parent verification found that Chrome mobile autoscaling could enlarge `innerWidth` along with overflowing content. The final driver compares overflow with `documentElement.clientWidth`, and the random suite checks requested viewport dimensions/scale before coordinate input. The original review hashes above intentionally remain unchanged; final repaired source hashes are recorded with the final replay. See `resize-failure-review.md` for the reproduced application defect and its regression.
