# Staged Abduction sampling verification

Verified independently from `rules.md` §11.6/§19.2, `cards.md` Abduction, the public fixture, and production reducer APIs; no test sources or test commits were read.

The fixture has White's King on d3 provisionally exposed to Black's Rook on d6. `cardPlayTargets(state, 'abduction')` includes d6. Four accepted public actions establish the omission:

1. Play White's Abduction at d6: Rook is away, pending rescue remains, concealment opens.
2. Reveal Abduction: pending rescue remains, recall opens.
3. Abduction timeout: Rook is captured and pending rescue clears.
4. End turn: Black begins its normal turn.

Every resulting state passed the sampler's physical/FEN consistency check. This public proof executed in 28 ms. Rule §19.2 expressly defers King-safety adjudication until the memory outcome, matching `settlePendingRescue`'s pending-Abduction deferral.

Verdict: sampler omission, not an engine defect. Its rescue filter rejected every retained pending rescue, including legitimate mandatory intermediate choices. The minimal filter change accepts pending Abduction, Doomsayer, or King-return choices already serviced by the sampling loop; a retained rescue without one of these continuations is still rejected. Uniform hand proposals and shuffled target order are unchanged.

Validation: `npm run typecheck` passed. Supplied black-box command `node --import tsx --test src/game/cards/random-campaign-tools.test.ts` passed all 6 checks in 2.97 s. An initial fixed-index regression observation became stale when the sampling trace changed; the parent independently corrected that observation before this final rerun. No full suite, UI tests, engine reducer edits, or commits were performed.
