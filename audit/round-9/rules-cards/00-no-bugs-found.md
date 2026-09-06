# Round 9 rules/cards audit: no bugs found

No independent rules breakage, exception, state corruption, or undefined card behavior was confirmed in this scope.

## Scope covered

- Compared `rules.md`, the final card artwork/text, and `CARD_CATALOG` for all 20 implemented cards: names, point values, uniqueness, artwork mapping, effect wording, timing, and regular-versus-continuing classification.
- Traced direct resolution for Disintegration; Fanatic; Annexation; Forced March; Onslaught; Long Jump; Dubbing; Squaring the Circle; Cowardice; No Quarter; and all nine swap cards (Holy War, Anathema, Evangelists, Tournament, Cathedral, Lost Castle, Siege, Holy Quest, and Treason).
- Checked printed timing gates, target counts and shapes, ownership/neutral control, current-versus-original identity, promotion eligibility, owner-relative orientation, non-capture requirements, simultaneous initial-position validation, identity preservation, direct-mate and self-check fizzles, card spending/drawing, move consumption, FEN clocks, castling-right handling, and en-passant creation/preservation/expiry.
- Inspected all direct-card and card-specific interaction regression cases to identify gaps without changing production or test files.

## Adversarial execution

- An independent empty-board geometry oracle checked 3,072 combinations across all 64 source squares, both piece owners, and all four board orientations for Forced March, Annexation, Onslaught, Cowardice, Long Jump, and Dubbing.
- An independent occupied-board/path oracle checked 193,792 combinations, including every blocker square for the same movement cards and all four empty-corner/source combinations for Squaring the Circle.
- The direct regression files for all 20 implemented cards completed successfully.
- Spot-checked transformed original pieces, promoted current-role pieces, neutral pieces controlled through either ownership relation, royal movers, simultaneous movers, replacement versus after-move clock behavior, and exact No Quarter victim binding.

## Non-findings deliberately rejected

- After-move swaps invalidating an en-passant record when they relocate the vulnerable physical Pawn is necessary to avoid a stale capture reference and is consistent with the existing explicit lifecycle ruling; it is not reported as a bug.
- The exponential target enumeration used internally for hypothetical Onslaught escape search was outside this direct-card rules scope and did not establish a rules failure in legal material bounds; it is not reported as a speculative performance issue.
