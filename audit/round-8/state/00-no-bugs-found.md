# Round 8 state/reducer audit: no new breakage found

## Result

No new rule, reducer-contract, mutation, or state-coherence breakage was confirmed in this bounded pass against the current post-round-7 uncommitted checkout.

The two previously rejected interpretations were excluded rather than re-reported: ordinary first-rank double-step en passant is distinct from Annexation's printed starting-square condition, and after-move swaps do not inherit the castling revocation semantics of replacement-move swaps.

## Coverage

- Read the complete `rules.md`, all earlier audit groups through round 7, and the current reducer/state/type/catalog flow before probing.
- Ran the complete existing engine suite: `860` tests passed, `0` failed.
- Made `655,360` direct `applyAction` move calls across both colors, all four orientations, ordinary and patterned-neutral positions, every source/destination pair, and all four promotion roles. Results: `685` successful transitions, `0` exceptions, and `0` `legalDests`/`applyAction` disagreements. Every call preserved its input state.
- Made `1,052,016` direct card calls across all 19 implemented cards, both colors, all four orientations, before- and after-move phases, every canonical square target, every one-step card-move source/destination pair, and every swap-card square pair. Results: `1,104` successful transitions and `0` exceptions. Rejections and successes preserved their input states.
- Re-ran the canonical card matrix with invariants on every successful result: parseable six-field FEN, FEN/`PieceState` board agreement, unique occupied squares, zone/square agreement, phase/move-made agreement, valid card-instance partitioning, live en-passant victims, coherent pending-rescue state, and successful `positionFor` construction. All `1,104` successful results passed.
- Made `150,000` additional malformed public-action calls covering nullish and primitive actions, missing/unknown discriminators, incomplete moves, invalid coordinates, missing card IDs, symbol-valued fields, malformed targets, and malformed card-instance IDs. All returned structured rejections without exceptions or input mutation.
- Rechecked by code trace and focused regressions: explicit en-passant ownership during hypothetical defender turns; neutral royal and pinned-attack authority; registered physical-Rook castling; Coup Prince/royal separation; rotated Pawn attacks, movement, promotion and en passant; replacement-card direct-mate probes; pending-rescue rollback; halfmove/fullmove updates; card spend/draw/discard order; and checkmate/stalemate escape searches.

No production, test, rule, package, configuration, or earlier audit file was modified.
