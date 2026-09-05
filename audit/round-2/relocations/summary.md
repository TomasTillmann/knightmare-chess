# Round 2 relocation/Pawn-card audit summary

## Confirmed breakages

1. [`01-replacement-mate-check-uses-expired-en-passant.md`](./01-replacement-mate-check-uses-expired-en-passant.md) — six replacement cards can commit a card-created checkmate because their mate probes use an en-passant right that the completed move expires.
2. [`02-no-quarter-rejects-neutral-en-passant-capture.md`](./02-no-quarter-rejects-neutral-en-passant-capture.md) — No Quarter rejects a legal neutral en-passant capture by comparing stored owners instead of neutral control/target eligibility.
3. [`03-disintegration-leaves-dead-en-passant-reference.md`](./03-disintegration-leaves-dead-en-passant-reference.md) — Disintegration leaves public en-passant metadata pointing to its dead target despite FEN and `positionFor` reporting no right.

## Scenarios exercised

- Exact timing and one-card allowance for Disintegration, Fanatic, Annexation, Forced March, Cowardice, Onslaught, No Quarter, Long Jump, Dubbing, and Squaring the Circle.
- Canonical/malformed targets, empty and occupied destinations, opponent ownership, both directions, one/many selections, duplicate sources/destinations, initial-position path validation, convergence, swaps, and simultaneous crossing cases.
- Original versus current Pawn/Knight identities, transformed unpromoted Pawns, promoted pieces, neutral control in both stored-owner directions, royal pieces, and opponent-owned neutral royals.
- Orientations `0`, `90`, `180`, and `270`, including rotated forward/sideways vectors, last-rank non-promotion, first/second owner-rank double steps, rotated Annexation en passant, and multiple independent Annexation rights.
- Check, direct-mate fizzle/rollback, self-check, in-check replacement escape, safe-turn move consumption, same-turn Cowardice/Disintegration rescue, and neutral defensive replies.
- Regular, promotion, and en-passant captures into No Quarter; stale history, exact captured identity, dead/captured zones, and cross-card Annexation → neutral en passant → No Quarter.
- Castling-right revocation by royal and original physical identity, halfmove/fullmove clocks, FEN/state synchronization, old-right expiry, card-instance selection/draw/discard, history, outcome, deep-frozen input, deterministic replay, and JSON-compatible state.
- Cross-card Fanatic/Forced March/Onslaught/Long Jump/Dubbing/Squaring mate probes with live versus already-cleared en-passant metadata, plus Disintegration of the just-double-stepped en-passant victim.

## Verification

The authoritative checkout's complete Node suite passes (`808` tests, `0` failures). Each finding above was separately reproduced through exported `createGameState`, `applyAction`, `legalDests`, and/or `positionFor` APIs without modifying production or tests.
