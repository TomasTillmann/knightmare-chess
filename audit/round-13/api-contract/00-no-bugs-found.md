# Round 13 public engine/API contract audit: no new bugs found

## Result

No new public-contract breakage, exception, input mutation, nondeterminism, destination/execution disagreement, or state-synchronization defect was confirmed in this bounded pass against the current shared checkout.

## Coverage

- Compared `legalDests()` with direct `applyAction()` execution across **667,648 source/destination pairs** and **715,696 concrete move actions** (promotion choices expand the action count), covering three fixed positions and **160 deterministic random plies**. Every generated action was executed twice. There were **0 listing/execution mismatches**, **0 exceptions**, and **0 nondeterministic results**.
- Checked all four promotion roles wherever promotion was required, rejection when promotion was omitted or malformed, both castling destination forms exposed by the current position, replay of a just-completed move, and legal-move filtering after turn completion.
- Checked every result for unique piece identities and occupied squares, board/off-board square discipline, parseable FEN, exact FEN-board/`PieceState`/`boardFen()` agreement, live en-passant references, pending-rescue phase invariants, and unique card-instance identities.
- Exercised all **19 implemented cards** through **10,063 generated timing/target/instance probes** plus focused successful fixtures for Cowardice, Squaring the Circle, and No Quarter. Successful transitions preserved card identity/conservation, drew exactly once, rejected replay, and recorded movement matching surviving physical-piece relocations; rejections returned the original state object unchanged.
- Ran a mixed deterministic sequence for **52 completed turns**, including ordinary moves, replacement cards, after-move cards, rejected targets, card exhaustion, rollback/retry paths, and turn rollover. It made **18,567 bounded card attempts** and retained FEN, piece, history, and card-zone consistency throughout.
- Exercised nullish, primitive, incomplete, unknown, and malformed public actions. All rejected atomically without throwing or changing their input state.

## Scope boundary

Detailed card semantics, en-passant geometry, castling safety, neutral-control legality, and UI/browser behavior belonged to the other Round 13 auditors and were not duplicated beyond generalized public-contract properties. No production source, test, package, configuration, rule, or prior audit file was modified.
