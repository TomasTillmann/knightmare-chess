# Round 3 variant/core transaction audit summary

Frozen target: shared checkout at `7c7b7ccac35046b9b9eed5fa26ed89d7c75fe4d9` with its authoritative uncommitted changes. No production, test, rule, configuration, package, or prior-audit file was modified.

## Confirmed breakages

1. [`01-unrelated-move-erases-off-square-rook-castling-right.md`](./01-unrelated-move-erases-off-square-rook-castling-right.md) — an unrelated ordinary move erases a castling right still attached to an off-square physical Rook after Cathedral.
2. [`02-castling-into-check-cannot-use-after-move-rescue.md`](./02-castling-into-check-cannot-use-after-move-rescue.md) — a castle whose destination-only check has a legal same-turn Cowardice rescue is rejected before the pending-rescue transaction.
3. [`03-stalemate-search-ignores-legal-fizzled-replacement-turn.md`](./03-stalemate-search-ignores-legal-fizzled-replacement-turn.md) — stalemate is declared even though a legal replacement-card fizzle spends the card, consumes the move, and permits the turn to finish.
4. [`04-position-for-still-false-mates-with-neutral-defense.md`](./04-position-for-still-false-mates-with-neutral-defense.md) — `positionFor().isCheckmate()` ignores a legal neutral capture that `legalDests`, `applyAction`, and `endTurn` all recognize.
5. [`05-nullish-actions-throw-from-public-reducer.md`](./05-nullish-actions-throw-from-public-reducer.md) — nullish actions escape the public reducer as `TypeError` instead of an atomic rejection.

## Scenarios exercised

- Ran the complete Node suite: `818` tests passed, `0` failed. Ran `npm run typecheck`: passed.
- Rechecked the round-two roots and shared siblings: Coup Prince/royal movement and capture, physical castling identity, neutral checks and pinned attacks, all four promotion roles, replacement-card direct-mate ordering after en-passant expiry, exact No Quarter victim identity, and staged-self-check rollback.
- Exercised White and Black regular Pawn capture-promotions at orientations `90`, `180`, and `270`; every Queen, Rook, Bishop, and Knight choice succeeded, omission of promotion was rejected, and `legalDests` exposed the destination. Existing orientation-`0` coverage also passed.
- Exercised White and Black ordinary en-passant creation/capture at orientations `90`, `180`, and `270`, plus the suite's orientation-`0`, multiple-Annexation-right, neutral capturer/victim, expiry, victim-death, and victim-relocation cases.
- Exercised pending-rescue transactions for quiet moves, ordinary captures, en-passant captures, promotion captures, and castling. Successful Cowardice/Treason rescues, rejected cards, non-rescuing successful/fizzled cards, move/card history, exact piece restoration, FEN clocks, en-passant restoration, card discard/draw/allowance, JSON-compatible state, and outcome behavior were checked. The non-castling transaction paths completed or rolled back cleanly; the castling destination path is finding 2.
- Exercised replacement-card success, `SELF_CHECK` and `DIRECT_MATE` fizzles, safe-start versus in-check move consumption, apparent mate, stalemate, and card-aware end-turn adjudication. Finding 3 is the remaining reachable outcome-ordering disagreement.
- Exercised neutral moves and captures in both stored-owner directions, neutral pin legality, neutral check reporting, direct action/destination agreement, and exported-position check/mate behavior. Reducer legality agreed in the exercised cases; finding 4 is isolated to the exported chessops mate projection.
- Exercised No Quarter after ordinary, promotion, en-passant, and neutral en-passant captures, including stale/missing identities and pending-rescue rollback. No new reducer breakage was confirmed beyond the findings above.
- Exercised malformed move, promotion, card, target, instance, and action shapes. Structured malformed inputs rejected atomically; only the nullish public-action exception in finding 5 was confirmed.

No source or test fixes were made.
