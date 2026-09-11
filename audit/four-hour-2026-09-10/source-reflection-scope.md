# Rank reflection and color swap: source scope

Source-only review of `rules.md` and `cards.md`; no production or test source inspected or executed.

Proposed transformation: preserve files, map rank r to 9-r, exchange White and Black, negate board orientation modulo 360, and exchange Earthquake clockwise/counterclockwise declarations. Figure Dance prefixes are excluded because its fixed counterclockwise motion is handed.

## Result

No additional explicitly handed or absolute-player-color move rule was found in the narrowly reviewed source passages. The proposed domain is a reasonable metamorphic audit domain with the stated exclusions and transformations; this is not a universal symmetry proof and does not validate the implementation of the transformer.

## Explicit source constraints

- `cards.md:71`, `rules.md:397-409`, and `rules.md:923-929`: Earthquake permits either direction; orientation determines each owner's forward direction, starting lines, and frontier. Exchange its declared direction and negate orientation. Fixed coordinates stay attached to squares, so piece, wall, trap, and recorded-move coordinates must all be reflected consistently.
- `cards.md:75` and `rules.md:411-415`: Figure Dance specifies counterclockwise only. A reflection changes handedness and cannot preserve that unchanged card effect. Excluding the first action that makes it available and all later prefixes avoids both its use and its effect on available rescue resources. Initial history must also exclude prior Figure Dance plays that copying or cancellation can restore.
- `rules.md:317`: generic simultaneous promotions use the moving player first. `cards.md:71` and `rules.md:407`: Earthquake and its Peace Talks reversal instead use the opponent first; Peace Talks additionally requires each owner's fixed-square order. Swap player identities while preserving these actor-relative priorities, and rebuild the required per-owner square ordering after reflection.
- `cards.md:31` and `rules.md:669`: Heresy makes the opponent move Bishops first. This is an actor-relative sequence, not a White-first rule. Do not replace it with simultaneous resolution or sort the two players together.
- `rules.md:271-281`: temporarily unsafe moves require a saving card before turn completion; after-move cards are evaluated against the resulting King safety. Reflection does not justify omitting mandatory rescue state, timing, or hand availability from the comparison.
- `rules.md:492` and `rules.md:929`: return squares are owner-relative under orientation; ordinary castling retains its physical King/Rook cells and rights. Reflect original/start-square identities and exchange rights owners as well as current positions. Preserving files preserves ordinary King-side versus Queen-side identity.
- `rules.md:64`: White-first is recommended, but the first player may be agreed separately. A reflected Black-to-move initial state is not forbidden by this source. Fullmove encoding is explicitly Black-dependent in several detailed card rules, for example `rules.md:371`, so its exclusion is necessary.

## Inferred limits and other checked cases

- Rank reflection exchanges light and dark board squares. Long Jump requires the opposite square color (`rules.md:359`) and Heresy changes square color (`cards.md:31`); both are relations preserved when both endpoints' colors exchange. Neither source requires an absolute light-only or dark-only destination.
- Winged Victory's fixed central set (`rules.md:682`, `cards.md:191`) maps to itself. Owner-relative forward/backward/sideways motion and the Toll frontier also map consistently when colors and orientation are transformed together.
- Excluding only the presentation order of simultaneous discards is a qualified comparison choice, not a source proof that all discard order is irrelevant. Legacy explicitly preserves the relative order of unselected discard entries (`rules.md:830`), and subsequent card eligibility or retrieval must still be compared by the relevant physical identities and timing. Never globally sort away sequential discard differences.
- This source-only review does not inspect production APIs, test sources, transformer code, or executed traces. It cannot establish exhaustive engine symmetry or convert a passing campaign into a numerical correctness probability.

Review completed 2026-09-10 10:03 UTC; no engine probes executed (source-only responsibility).
