# A successful replacement move leaves the previous turn's Regular Move highlighted

- Severity: Medium
- Area: Chessground state synchronization, replacement-move cards, repeated turns
- Audited state: current post-round-6 shared checkout (`2f0e4082eb991d8efbffe374100439ba4ad675e2` plus its existing uncommitted fixes)

## Rule and UI contract

`rules.md` §8.2 says a card may replace the Regular Move, and §13.8 makes a successful Long Jump the complete move for that turn. A last-move marker must therefore not continue identifying an unrelated Regular Move from the preceding turn after Long Jump has committed a different board transition.

The UI may either highlight the card movement (`b8` and `d5`) or clear a marker that only supports ordinary moves. Showing the earlier `e2-e4` transition as the latest move is false in both interpretations.

## Actual behavior

Starting from the demo game:

1. White makes `e2-e4` and ends the turn. The board correctly highlights `e2` and `e4`.
2. Black plays Long Jump instead of its move, relocating the Knight from `b8` to `d5`.
3. The Knight is visibly on `d5`, the status says `Long Jump moved the Knight from b8 to d5.`, and the state records that `cardPlayed` event last.
4. Chessground still highlights `e2` and `e4`; neither `b8` nor `d5` is highlighted.

Reset does clear the marker, and consecutive ordinary pointer/keyboard moves update it correctly. The defect is the transition from an earlier ordinary move to a later successful replacement-card move.

## Automated Chrome reproduction

```ts
await dragPiece(page, 'e2', 'e4');
await expectLastMove(board, 'e2', 'e4');
await page.getByRole('button', { name: 'End turn' }).click();

await blackHand.getByRole('button', { name: 'Long Jump' }).click();
await clickSquare(page, 'b8');
await clickSquare(page, 'd5');
await page.getByRole('button', { name: 'Play Long Jump' }).click();

await expect(page.getByRole('status')).toContainText('b8 to d5');
await expectPiece(board, 'piece.black.knight', 'd5');
await expectLastMove(board, 'e2', 'e4'); // stale: latest committed move was b8-d5
```

The assertion-based headless Google Chrome probe passed repeatedly and observed exactly two `square.last-move` elements at `e2` and `e4` after Long Jump.

## Root hint

`src/ChessBoard.tsx` derives the marker with a reverse search for any historical event whose type is `move`. It therefore skips the newer `cardPlayed` replacement-move event and resurrects the older Regular Move. The marker needs to follow the latest committed board transition, or deliberately clear when that transition cannot be represented by Chessground's two-square marker.

## Audit verification

- Complete engine suite: `855` passed, `0` failed.
- Complete Google Chrome Playwright suite: `74` passed, `0` failed.
- TypeScript check: passed.
- Also exercised Reset, promotion cancel-and-retry, neutral pointer/keyboard movement, Coup and neutral check markers, pending rescue, invalid card targets, malformed actions, and FEN/history agreement through the existing focused regressions and static contract inspection. No second new root was confirmed in this bounded pass.
- `src/` and `tests/` were not modified.
