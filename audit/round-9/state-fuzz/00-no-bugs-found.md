# Round 9 state/reducer fuzz audit: no new breakage found

## Result

No new rule, reducer-contract, crash, mutation, nondeterminism, or state-coherence breakage was confirmed in this bounded pass against the current uncommitted checkout.

## Completed coverage

- Seed: `0x9e3779b9`.
- `6,878` direct `applyAction` calls. Every action was applied twice to the same input and produced a deeply equal result.
- `243` successful transitions and `246` full invariant checks across ordinary random playouts and mixed card/move playouts.
- Every reducer call preserved its input state. Successful calls returned a new state; rejected calls returned the exact original state.
- Every successful state retained a parseable FEN whose board matched `PieceState`, unique physical piece IDs and occupied squares, coherent board/off-board zones, coherent turn/phase/FEN side-to-move, unique card-instance partitions, a valid one-card allowance, live geometrically consistent en-passant victims, and coherent pending-rescue metadata. `positionFor` remained constructible.
- Every destination sampled from `legalDests` was accepted by `applyAction`; immediate replay of the same move in the after-move phase was rejected; premature `endTurn` was rejected; completed safe moves could end normally.
- Mixed sequences exercised before-move cards, replacement-move cards, ordinary moves, after-move cards, card spend/draw/discard transitions, fizzle paths, and turn rollover.
- `2,900` malformed-but-type-cast action cases covered nullish and primitive actions, missing/unknown/symbol discriminators, incomplete moves, invalid and symbol-valued coordinates/promotions, absent/symbol card IDs, bigint/symbol/malformed/cyclic targets, malformed move arrays, and null-prototype target objects. None threw or mutated state.

The larger preliminary volume runs were stopped after showing no failures because nested checkmate/card-rescue enumeration made them disproportionately slow; the completed bounded seed retained the same assertions and covered every targeted invariant category.

No production source, test, rule, package, or configuration file was modified.
