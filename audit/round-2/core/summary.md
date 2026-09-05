# Round 2 core-engine adversarial audit summary

Frozen target: shared checkout at `29ae7f671f1ce6e636b2112dd4f19ec19198677c` with its authoritative uncommitted production/test changes. No production, test, rule, package, configuration, or prior-audit file was modified.

## Result

Five confirmed breakages:

1. [`01-fanatic-direct-mate-uses-expired-en-passant.md`](./01-fanatic-direct-mate-uses-expired-en-passant.md) — a stale en-passant defense lets Fanatic commit a forbidden direct mate.
2. [`02-coup-castling-follows-role-instead-of-royal-identity.md`](./02-coup-castling-follows-role-instead-of-royal-identity.md) — a Coup Prince can castle and the marked royal's regular move retains FEN castling rights.
3. [`03-neutral-underpromotion-is-omitted-and-false-mated.md`](./03-neutral-underpromotion-is-omitted-and-false-mated.md) — queen-only destination probing omits legal neutral underpromotions and declares false checkmate.
4. [`04-fizzled-card-can-strand-a-staged-self-check.md`](./04-fizzled-card-can-strand-a-staged-self-check.md) — a wrong card after conditional staging creates an unrecoverable in-check turn.
5. [`05-position-for-disagrees-with-neutral-check-authority.md`](./05-position-for-disagrees-with-neutral-check-authority.md) — exported check reporting disagrees with reducer legality for Neutrality/Coup state.

## Scenarios exercised

- Ran `npm test`: 808 tests passed, 0 failed.
- Ran `npm run typecheck`: passed.
- Ordinary chess: ownership, geometry, pinned self-check rejection, King non-capture, castling, check response, mate/stalemate transition, and `endTurn` gating.
- Coup/royal identity: Prince capture/movement, marked non-King royal safety, Prince castling, royal-move castling revocation, and FEN castling persistence.
- Neutrality: either-player control, both-color captures, checks against either King, pinned neutral attacks, neutral transit/destination attacks during castling, and public/private check disagreement.
- Castling: ordinary successful/illegal paths, neutral attacks on origin/transit/destination, stale rights after royal moves, and role-versus-royal identity.
- Pawn rules at orientations `0`, `90`, `180`, and `270`: forward moves, owner-relative direction, first/second-line double moves, blocked paths, diagonal captures, promotion lines, and rotated en passant.
- Promotion: Queen/Rook/Bishop/Knight action validation, mandatory/invalid promotion fields, neutral self-check differences among promotion roles, and underpromotion-only check escape.
- En passant: ordinary and rotated captures, neutral capturer/victim ownership, off-destination history identity, expiry after replacement moves, and direct-mate interaction.
- FEN/clocks/history: side-to-move, castling, en-passant, halfmove/fullmove fields, capture/promotion events, fizzle events, and input immutability on success/rejection.
- Apparent mate/direct mate/stalemate: neutral board replies, hidden-card escape search, replacement-card mate fizzle, false mate from incomplete destinations, and outcome immutability.
- Same-turn rescue: successful Cowardice/Treason staging, no-rescue rejection, fizzle after conditional staging, exhausted card allowance, and unrecoverable-state detection.
- Malformed actions: invalid/missing squares, invalid promotions, malformed card targets/instances, wrong timing/ownership/roles, extra attempts after move/card use, and finished-game rejection. Structured malformed actions rejected atomically in the exercised cases; no additional confirmed exception was found.

The five focused reproductions were rerun together in one assertion script; all controls passed and all five failures reproduced against the frozen checkout.
