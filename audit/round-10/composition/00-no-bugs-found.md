# No composition bugs found

- Scope: neutral controllers, royal safety, check/checkmate adjudication, en passant, pending rescue, card timing, castling identity, and history
- Audited state: current post-Round-9 uncommitted checkout; production and tests remained read-only

## Adjudication

The initially reported neutral-royal "phantom check" was a false positive. Its reproduction placed adjacent Black royals on `e8` and `e7`. The ordinary Black King on `e8` therefore legally attacked the neutral royal on `e7`, independently making `isKingInCheck(state, 'black')` true. That real threat confounded the attempted `e7-e8` neutral-attacker probe.

An unconfounded control changed the piece on `e8` to a non-attacking Bishop, Knight, or Pawn while retaining the rest of the relevant setup. `isKingInCheck(state, 'black')` then returned false, demonstrating that the engine had already rejected the alleged illegal neutral capture. No product bug remains from this report.

## Bounded matrix coverage

Direct probes covered ordinary and Annexation two-steps for current Pawn and transformed original-Pawn identities across all four orientations, both owners, both neutral-control directions, first and second owner ranks, promoted exclusions, royal victims, pinned en-passant attackers, and two simultaneous en-passant opportunities. Normal legal captures and the Round 9 fixes remained intact.

Focused pending-rescue, replacement/after-move fizzle, No Quarter, castling-identity, and history regressions passed 53/53. The separate Cowardice live-victim expiry reported under `audit/round-10/rules-cards` was outside this scope and was not duplicated. No genuine composition bug was found.
