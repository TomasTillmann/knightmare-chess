# Round 4 public/UI contract audit summary

## Confirmed breakages

1. [`01-non-pawn-cannot-capture-same-owner-neutral.md`](./01-non-pawn-cannot-capture-same-owner-neutral.md) — Neutrality capture semantics work for Pawns and neutral movers but fail for every non-neutral non-Pawn mover.
2. [`02-castling-accepts-arbitrary-friendly-destination.md`](./02-castling-accepts-arbitrary-friendly-destination.md) — the public reducer accepts an unlisted King move onto an arbitrary friendly piece, castles elsewhere, and records a false destination.
3. [`03-canceling-promotion-forces-a-queen.md`](./03-canceling-promotion-forces-a-queen.md) — dismissing the promotion dialog commits a Queen promotion instead of canceling the move.
4. [`04-opposite-owner-neutral-en-passant-invalid-fen.md`](./04-opposite-owner-neutral-en-passant-invalid-fen.md) — a valid Knightmare en-passant right is written as an impossible orthodox FEN field which `positionFor` immediately discards.

## Coverage

- Read the complete `rules.md`, all earlier audit groups, current reducer/state/types, App and ChessBoard contracts, catalog metadata, and relevant unit/UI regressions.
- Ran the complete engine suite: `836` passed, `0` failed.
- Ran the complete Chrome Playwright suite: `71` passed, `0` failed.
- Ran TypeScript checking successfully.
- Compared `legalDests` with direct `applyAction` results across 342,279 generated source/destination probes covering both colors, every orientation, neutral pieces, promotions, and reachable multi-ply states. All observed disagreements reduced to finding 02.
- Exercised malformed public actions, `positionFor` mutability/coherence, pending-rescue presentation and rollback, actual-royal check highlighting, opponent-owned neutral board selection, rotated promotions, No Quarter gates, card timing/target controls, castling aliases, and en-passant/FEN projections.
- Confirmed promotion cancellation and invalid-input controls in headless Google Chrome without modifying production or tests.

No production, test, rule, package, or existing audit file was changed.
