# Engine audit coverage

- Evidence: all 30 complete `.audit-scratch/*.json` traces present at verification time.
- Transitions: 1,500; card plays: 443.
- Catalog coverage: 27/27 card IDs; missing: none.
- Same-game unordered card-pair coverage: 351/351 (`27 choose 2`), 100%.
- Integrity: every trace completed its requested transition count; step counts and indexes matched; each initial/before/after/final state chain was contiguous; no unknown card ID appeared.

Reproduce with Node plus the repository's existing TypeScript loader: sort all `.audit-scratch/*.json`; parse each file; reject mismatched requested/completed/step counts, non-contiguous serialized state chains, bad indexes, or unknown card IDs; collect `playCard.cardId` values per trace; then compare observed IDs with `Object.keys(CARD_CATALOG)` and unordered within-trace pairs with all 351 catalog pairs.

COVERAGE_COMPLETE findings=0 ms=11900
