# Round 14 public API and sequence-fuzz audit: no bugs found

## Result

No new observable rule violation, exception, input mutation, nondeterminism, destination/execution disagreement, identity corruption, or state-invariant failure was confirmed in this bounded direct-engine audit of the current shared checkout.

## Quantified coverage

- Ran the complete engine regression suite: **1,069/1,069 tests passed**.
- Made **506,348 direct `applyAction()` calls**. Every sampled action was applied twice to the same input and produced a deeply equal result.
- Compared `legalDests()` with direct execution across **196,608 source/destination pairs** and **212,784 concrete move actions** over **48 deterministic random plies**, including all four promotion choices where applicable. There were zero listing/execution mismatches.
- Exercised **2,860 malformed-but-representable action cases** (5,720 replayed calls): nullish and primitive actions, unknown/symbol discriminators, incomplete moves, noncanonical/symbol/bigint coordinates and promotions, malformed/cyclic/null-prototype card targets, wrong card IDs and instances, and extra fields. Every case rejected without throwing or mutating its input.
- Independently checked **9,226 Assassin geometry/control observations** across all current piece roles, both controller relationships, neutral pieces, all four board orientations, and 32 evolving positions. Directly applied **307** advertised Assassin captures; every target resolved or rules-fizzled without a public-helper mismatch.
- Confirmed Assassin's required non-promotion behavior by moving a White Pawn from `g7` to `h8` while capturing its own Knight: the same physical Pawn remained `role: "pawn"`, `promoted: false`, and reset the halfmove clock. Also exercised successful own-piece captures for both colors, exact victim identity, card spending, and stale card/target replay rejection.
- Ran **80** mixed ordinary-move/card/end-turn transitions with five-card hands and replenishing decks, checking each transition and immediately replaying its now-stale action. Across the broader run, **129** stale move/card replays rejected atomically.
- Ran **288** deterministic neutral-royal check evaluations across both owners and all Pawn/Knight/Bishop/Rook/Queen/King attacker/blocker role combinations. No exception, recursion failure, or clone-dependent result appeared after the current neutral-controller changes.

## Invariants checked after every successful transition

- parseable six-field FEN and exact FEN-board/`PieceState`/`boardFen()` agreement;
- unique piece identities and occupied squares, coherent board/off-board zones, and no captured/dead royal;
- unique and conserved card-instance identities across hand, deck, and discard;
- coherent live en-passant victim references with empty targets;
- coherent pending-rescue phase/move metadata;
- JSON-compatible state, immutable reducer input, fresh successful output, and original-state identity on rejection; and
- constructible, non-mutating `positionFor()` projections.

## Rejected candidate

The first independent Assassin oracle draft treated a sliding piece as attacking its own source square. The engine correctly excluded that square; fixing the oracle's zero-distance case removed the mismatch. This was a harness defect, not a product finding.

No production source or test file was edited, and no commit or branch/worktree operation was performed.
