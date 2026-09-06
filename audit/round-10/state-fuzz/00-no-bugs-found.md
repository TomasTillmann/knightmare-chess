# Round 10 state/reducer fuzz audit: no new breakage found

## Result

No new rule, reducer-contract, crash, mutation, nondeterminism, or state-coherence breakage was confirmed in this bounded pass against the current post-round-9 uncommitted checkout.

## Completed coverage

- Seed: `0x6a09e667`.
- `4,786` direct `applyAction` calls. Every action was applied twice to the same input and produced a deeply equal result.
- `1,242` successful transitions and `1,250` complete state-invariant checks.
- `417` destinations advertised by `legalDests` were checked through `applyAction`; every destination had an accepted promotion/non-promotion action as appropriate. Immediate stale move replays were rejected.
- Orthodox random playouts were compared move-by-move with chessops for legal destinations and resulting FEN. Board placement, turn, clocks, castling, and ordinary en-passant state remained identical.
- Mixed sequences covered `24` turns with before-move cards, replacement moves, ordinary moves, after-move cards, spending/drawing/discarding, fizzle paths, turn rollover, and legal-destination application.
- A `48`-case en-passant matrix covered all four orientations, both Pawn owners, current Pawn/Rook/Queen movement roles with original Pawn identity, and neutral/non-neutral control. Every committed double-step retained the correct victim identity and geometrically legal reply; capturable royal-Pawn double-steps were rejected.
- Metamorphic playouts confirmed that PieceState array order and unrelated off-board captured pieces do not change legal destinations. Recreating the same configured game state was deterministic.
- `660` malformed and forged-action cases covered nullish and primitive actions, missing/unknown/symbol discriminators, incomplete moves, invalid or symbol-valued coordinates/promotions/card IDs, bigint/symbol/cyclic/malformed targets, null-prototype targets, foreign card-instance IDs, and extra fields. None threw or mutated state.
- Every successful result retained a parseable FEN matching PieceState, unique physical piece IDs and occupied squares, coherent zones and turn/phase, card-instance conservation and uniqueness, royal conservation, coherent history length, valid pending-rescue metadata, and live empty-target en-passant opportunities with correct victim geometry.

The larger preliminary volume run was stopped after showing no failures because nested legal-move/card-rescue enumeration was disproportionately slow. The completed capped run retained every requested invariant category and produced the quantified results above.

No production source, test, rule, package, configuration, or earlier audit file was modified.
