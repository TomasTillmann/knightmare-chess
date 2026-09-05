# Round 5 public/UI contract audit summary

## Confirmed breakages

Three new roots were confirmed against the frozen shared checkout:

1. [`01-unknown-action-type-executes-card.md`](./01-unknown-action-type-executes-card.md) — an invalid action discriminator falls through to `playCard` and can execute a real card transition.
2. [`02-castling-uses-wrong-physical-rook.md`](./02-castling-uses-wrong-physical-rook.md) — a retained castling right follows any current-role Rook placed on the home square instead of the eligible physical Rook.
3. [`03-turn-override-retains-impossible-fen-en-passant.md`](./03-turn-override-retains-impossible-fen-en-passant.md) — `createGameState` can publish a stale FEN EP square which its own authoritative state and `positionFor` reject.

## Coverage

- Read the complete `rules.md`, every prior audit group, current reducer/state/types, App/ChessBoard synchronization paths, and the focused regression tests added through round 4.
- Ran the complete engine suite: `841` passed, `0` failed.
- Ran the complete Google Chrome Playwright suite: `72` passed, `0` failed.
- Ran TypeScript checking successfully.
- Rechecked Chessground accepted/rejected move synchronization, castling by King and Rook aliases, promotion detection at all orientation boundaries, promotion cancel-and-retry, neutral-piece movement, checked-royal highlighting, pending-rescue controls and rollback, `legalDests`/direct-action agreement, `positionFor` mutability/coherence, FEN/en-passant projection, history canonicalization, JSON-compatible state, and malformed action shapes.
- An additional automated headless Chrome castling probe completed a legal kingside castle and left the UI in the correct after-move state.

No source, test, rule, package, configuration, or previous audit file was changed.
