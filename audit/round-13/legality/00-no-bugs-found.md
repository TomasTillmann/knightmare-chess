# Round 13 legality audit: no new bugs found

## Result

No new rules breakage, exception, state corruption, alias disagreement, or destination/execution mismatch was confirmed in this bounded direct-engine pass against the current shared checkout.

## Quantified coverage

- Ran **95/95** focused regressions covering en passant, Cowardice, Chess960 castling, rescue aliases, Coup identity, neutral captures, neutral royals, pins, and authoritative legal destinations.
- Checked all **56** safe single-Rook Chess960 back-rank arrangements for White. The canonical King destination and registered-Rook alias were both listed, both accepted, and produced deeply identical states. The symmetric Black arrangements were included in the attack matrix below.
- Checked **10,752** deconfounded Chess960 attack cases across both colors, every King/Rook ordering, every off-back-rank Knight location, ordinary versus neutral attackers, both accepted aliases, and `legalDests`. Origin, every true transit square, and destination attacks matched an independent Knight-geometry/path oracle with **0 mismatches**.
- Checked **3,808** en-passant cases across both victim owners and all four orientations. The matrix varied every board location, both capture diagonals, first-/second-rank versus forged victim ranks, ordinary and transformed original Pawns, current-role Pawns with another original identity, promoted victims, and royal victims. `legalDests` and direct execution matched the independent victim/attacker geometry and identity oracle with **0 mismatches**.
- Checked **4,096** Cowardice geometry/control cases across both acting colors, both Pawn owners, all four orientations, neutral and non-neutral targets, transformed original Pawns, one- and two-square retreats, occupied intermediate squares, and occupied destinations. Destination enumeration and direct card resolution matched with **0 mismatches**.
- Checked **320** Coup-Prince capture cases across both colors, every adjacent King-movement square, every target owner/neutrality combination, and Pawn/Rook/Bishop/Knight/Queen targets. Same-owner neutral captures, opposing captures, friendly rejection, destination enumeration, and captured physical identity all matched with **0 mismatches**.

## High-risk interactions rechecked

- Valid, forged, occupied-target, transformed-victim, rotated, multiple-right, and royal-victim en-passant states; exact victim binding; opportunity expiry; and FEN projection boundaries.
- Cowardice preserving a live opportunity while rejecting both its occupied target and relocation of its live victim; unchanged clocks, turn, and castling state remain covered by focused regressions.
- Orthodox and Chess960 castling origin/transit/destination safety, stationary Kings, long King travel, physical-Rook identity, canonical/registered-Rook aliases, destination-only rescue, and ordinary/neutral attacks.
- Coup's non-royal Prince versus the marked royal, same-owner neutral capture, castling-right identity, and neutral-royal/controller pin cases, including one-controller and both-controller pins.

The first draft of the Chess960 attack oracle intentionally failed because its occupancy predicate accidentally compared only files and because a control King was already checked by a Rook. Those confounds were removed before counting results; the final quantified matrix above uses full square geometry and a non-royal opposing control King for neutral-attack legality.

No production source or test file was modified.
