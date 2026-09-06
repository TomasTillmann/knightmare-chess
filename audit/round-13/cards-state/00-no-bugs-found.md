# Round 13 cards/state audit: no new bugs found

## Result

No independent rules breakage, exception, state mutation, nondeterminism, card-conservation failure, or rollback/history/clock inconsistency was confirmed in this bounded pass against the current shared checkout.

## Coverage

- Traced the public reducer and all **19 currently catalogued card resolvers** (the checkout contains 19, despite the assignment's “20” shorthand) through timing, target and identity validation, simultaneous atomicity, replacement-versus-after-move semantics, direct-mate and self-check fizzles, pending-rescue rollback, promotion exclusions, card spend/draw/discard, history, and FEN clocks.
- Ran the complete engine regression suite: **972/972 tests passed**.
- Ran **456** additional malformed/adversarial card calls across all 19 cards using nullish, primitive, bigint, symbol, non-square, incomplete, duplicate-source, array, object, and null-prototype targets. Every call was repeated against the same input: **0 exceptions, 0 input mutations, and 0 nondeterministic results**.
- Rechecked the recent card-transition history path for successful moves, multi-piece swaps, nonmovement effects, fizzles, and pending-rescue rollback; movement is derived only from surviving physical identities and rollback fizzles do not preserve the rejected regular-move highlight.
- Rechecked clocks and turn state at the shared roots: replacement moves advance exactly once, after-move cards do not advance again, Pawn-identity reset rules are card-specific, consumed replacement fizzles advance without committing their staged relocation, and Black replacement turns increment the fullmove number once.
- Rechecked card conservation at the shared `spendCard` path: exact selected duplicates are discarded, the top deck instance is drawn once, an empty deck is not reshuffled, rejected actions do not spend, and successful/fizzled actions consume one allowance.

## Scope boundary

Detailed en-passant, castling, neutral-control, and UI/browser matrices belonged to the other Round 13 auditors and were not duplicated. Previously reported behavior was not filed again. No production source or test file was modified.
