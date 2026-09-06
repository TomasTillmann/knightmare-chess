# Round 14 card/state audit: no confirmed bugs

## Result

No new rules breakage, inconsistent state transition, unexpected exception, input mutation, nondeterminism, target-enumeration mismatch, or card-lifecycle defect was confirmed in this bounded read-only pass against the current shared checkout.

## Coverage

- Traced all **20 implemented cards** against `rules.md` and the current reducer, including timing, ownership and neutral control, current/original role identity, captured versus dead zones, simultaneous swaps/moves, replacement versus after-move phases, card allowance, spend/draw/discard, history/movement highlights, clocks, castling rights, en-passant lifecycle, direct-mate rollback, self-check rollback, and end-turn escape adjudication.
- Ran **81,743** deterministic direct `applyAction` calls. **4,379** successful transitions passed FEN/`PieceState` board agreement, unique occupied-square and zone invariants, constructible `positionFor`, card-allowance bounds, input immutability, and repeat-result equality.
- Compared Assassin target enumeration with an independent movement/path oracle over **90,768** exhaustive empty-board role/orientation/source/destination combinations plus **12,000** seeded randomized transformed-role, original-role, promoted, neutral-owner, victim-owner, and blocker configurations.
- Verified Assassin's successful capture lifecycle: the victim becomes captured rather than dead; both physical identities and all non-location markers survive; last-rank Pawns do not promote; old en-passant rights clear; capture clocks, Black fullmove advancement, card spending/drawing, allowance, history `capturedId`, derived movement, and turn phase agree.
- Verified Assassin castling consequences for a moved royal, a moved off-square original Rook, a captured off-square original Rook, and the non-effect of capturing a promoted Pawn merely acting as a Rook on a castling-origin square.
- Verified safe-start self-check and direct-mate fizzles restore the complete board while spending the card and consuming the replacement move; an in-check failed attempt preserves the Regular Move; a successful King self-capture can escape check; and end-turn mate adjudication recognizes an Assassin escape from otherwise ordinary checkmate.
- Executed one independent successful transformed/neutral lifecycle for every implemented card, including exact card conservation and end-turn allowance reset, plus malformed target matrices across all 20 cards.
- Ran the complete engine regression suite: **1,069/1,069 tests passed**.

## Scope boundary

No UI interaction was used. No production or test file was edited, no worktree or branch was created, and no commit was made.
