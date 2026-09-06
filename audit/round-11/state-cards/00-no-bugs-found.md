# Round 11 state/cards audit: no new bugs found

## Result

No independent rule breakage, exception, input mutation, nondeterminism, rollback defect, or card-conservation failure was confirmed in this bounded pass against the current shared checkout.

## Coverage

- Traced the public reducer and all 19 catalogued card resolvers through timing, target parsing, current/original identity, neutral control, simultaneous validation, replacement-versus-after-move behavior, direct-mate and self-check fizzles, pending-rescue rollback, card spend/draw/discard, history, castling revocation, promotion exclusions, and FEN clocks.
- Ran the complete engine regression suite successfully with no failures.
- Made 798 direct malformed or adversarial `applyAction` calls across every catalogued card plus malformed move, card, end-turn, nullish, primitive, bigint, symbol, incomplete, non-canonical-square, and stale-shaped actions.
- Applied each direct action twice to the same input. Results were deeply deterministic; no call threw and no rejected call mutated its input.
- Rechecked multi-piece cards against initial-position atomicity: distinct identities and destinations, no use of vacated squares, preserved physical identity, and one card lifecycle transition per accepted or fizzled play.
- Rechecked replacement-card and after-move-card boundaries for move consumption, halfmove/fullmove behavior, en-passant clearing versus preservation, castling-history handling, and rollback state restoration.

## Scope boundary

The dedicated Round 11 en-passant/Pawn and neutral/royal auditors own those two matrices, so their findings were not duplicated here. UI/browser behavior was also intentionally excluded. No production or test file was modified.
