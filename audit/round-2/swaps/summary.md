# Round 2 swap-card audit summary

## Result

Four confirmed breakages were reproduced against the frozen authoritative checkout:

1. [`01-replacement-swaps-use-expired-en-passant-in-direct-mate-check.md`](./01-replacement-swaps-use-expired-en-passant-in-direct-mate-check.md) — expired en passant can legalize a direct-mate replacement swap.
2. [`02-fizzled-after-move-swap-hard-locks-temporary-check-turn.md`](./02-fizzled-after-move-swap-hard-locks-temporary-check-turn.md) — a failed promised swap rescue leaves no legal reducer transition.
3. [`03-neutral-swap-check-missing-from-public-position-and-board.md`](./03-neutral-swap-check-missing-from-public-position-and-board.md) — neutral swap check disagrees between reducer legality and the exported/UI position view.
4. [`04-after-move-swap-leaves-stale-en-passant-opportunity.md`](./04-after-move-swap-leaves-stale-en-passant-opportunity.md) — an after-move swap can leave FEN and `state.enPassant` inconsistent.

## Scenarios exercised

- Read the exact swap, checkmate, temporary-check, neutrality, Pawn, castling, FEN, and turn rules in `rules.md`, then traced the shared `playSwapCard`, target enumeration, royal-safety, direct-mate, move-rescue, fizzle, end-turn, FEN, and card-instance paths.
- Inspected production and unit/interaction/UI coverage for Holy War, Anathema, Evangelists, Tournament, Cathedral, Lost Castle, Siege, Holy Quest, and Treason.
- Verified after-move versus replacement timing; own, opponent, and neutral ownership; same-square/same-physical-piece rejection; current and original roles; promoted and royal identities; simultaneous exchange; non-capture semantics; and marker/identity preservation.
- Exercised direct check, direct mate, pre-existing mate, mate-versus-self-check priority, defender-controlled neutral replies, pinned neutral replies, temporary same-turn rescue, failed rescue rollback, and apparent-mate end-turn adjudication.
- Exercised castling revocation/preservation, old and newly created en-passant rights, FEN board/turn/castling/en-passant/halfmove/fullmove fields, exact duplicate card instances, draw/discard lifecycle, malformed targets, frozen-input immutability, and mixed/cross-card turns.
- Ran 36,954 direct public-reducer calls covering every canonical square pair plus representative malformed target shapes for all nine cards: zero exceptions. The relevant invalid calls were atomic.
- Ran `npm test`: 808 tests passed, 0 failed. Ran `npm run typecheck`: passed.

No fixes were made. No production, test, rules, configuration, package, or pre-existing audit file was modified.
