import { expect, type Locator, type Page, test } from '@playwright/test';

const description = 'Move one of your Knights to any square whose color is different from the one it currently occupies. You cannot capture a piece with this move.';
const hand = (page: Page, color: 'White' | 'Black') =>
  page.getByRole('region', { name: `${color} hand` });

async function squareCenter(board: Locator, square: string) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Chessboard is not visible');
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return { x: box.x + ((file + 0.5) * box.width) / 8, y: box.y + ((7.5 - rank) * box.height) / 8 };
}

async function clickSquare(page: Page, square: string) {
  const point = await squareCenter(page.getByTestId('chessboard'), square);
  await page.mouse.click(point.x, point.y);
}

async function dragPiece(page: Page, from: string, to: string) {
  const board = page.getByTestId('chessboard');
  const start = await squareCenter(board, from);
  const end = await squareCenter(board, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function hasWhiteKnight(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator('piece.white.knight').evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

async function isLastMoveSquare(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  return board.locator('square.last-move').evaluateAll((squares, target) => squares.some(node => {
    const box = node.getBoundingClientRect();
    return target.x >= box.left && target.x <= box.right && target.y >= box.top && target.y <= box.bottom;
  }), point);
}

async function expectLastMove(board: Locator, ...squares: string[]) {
  await expect(board.locator('square.last-move')).toHaveCount(squares.length);
  for (const square of squares) {
    await expect.poll(() => isLastMoveSquare(board, square)).toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews Long Jump and disables it after a regular move', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Long Jump' });
  await expect(card).toBeEnabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Long Jump' })).toBeDisabled();

  await card.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Long Jump card' })).toHaveAttribute('src', /KC14_card2\.png$/);
  await expect(details.getByRole('heading', { name: 'Long Jump' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('7 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeDisabled();
});

test('moves the b1 Knight to a distant opposite-color square from the board', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Long Jump' });
  await card.click();
  await clickSquare(page, 'b1');
  await clickSquare(page, 'd4');
  await page.getByRole('button', { name: 'Play Long Jump' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Long Jump moved');
  await expect.poll(() => hasWhiteKnight(board, 'd4')).toBe(true);
  await expect.poll(() => hasWhiteKnight(board, 'b1')).toBe(false);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
});

test('cancels a board choice, then applies a keyboard-selected Long Jump', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await hand(page, 'White').getByRole('button', { name: 'Long Jump' }).click();
  await clickSquare(page, 'b1');
  await clickSquare(page, 'b1');
  await expect(page.getByRole('status')).toContainText('selection canceled');
  await expect(board.locator('square.last-move')).toHaveCount(0);

  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Knight source' }).selectOption('g1');
  await page.getByRole('combobox', { name: 'Knight destination' }).selectOption('c4');
  await page.getByRole('button', { name: 'Add move' }).click();
  await page.getByRole('button', { name: 'Play Long Jump' }).click();

  await expect(page.getByRole('status')).toContainText('Long Jump moved');
  await expect.poll(() => hasWhiteKnight(board, 'c4')).toBe(true);
  await expect.poll(() => hasWhiteKnight(board, 'g1')).toBe(false);
  await expect.poll(() => hasWhiteKnight(board, 'b1')).toBe(true);
});

test('highlights the exact pointer-move squares and Reset clears them', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await dragPiece(page, 'e2', 'e4');
  await expectLastMove(board, 'e2', 'e4');

  await page.getByRole('button', { name: /Reset/ }).click();

  await expect(board.locator('square.last-move')).toHaveCount(0);
  await expect.poll(() => hasWhiteKnight(board, 'b1')).toBe(true);
});

test('highlights the exact keyboard-move squares', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Move from' }).selectOption('e2');
  await page.getByRole('combobox', { name: 'Move to' }).selectOption('e4');
  await page.getByRole('button', { name: 'Make move' }).click();

  await expectLastMove(board, 'e2', 'e4');
});

test('replaces highlights for Long Jump and preserves them for non-movement cards', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await dragPiece(page, 'e2', 'e4');
  await hand(page, 'White').getByRole('button', { name: 'Disintegration' }).click();
  await clickSquare(page, 'a2');
  await expectLastMove(board, 'e2', 'e4');

  await page.getByRole('button', { name: 'End turn' }).click();
  await hand(page, 'Black').getByRole('button', { name: 'Long Jump' }).click();
  await clickSquare(page, 'b8');
  await clickSquare(page, 'd5');
  await page.getByRole('button', { name: 'Play Long Jump' }).click();
  await expectLastMove(board, 'b8', 'd5');
});

test('replaces the regular-move highlight with Cowardice movement', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await dragPiece(page, 'g1', 'f3');
  await page.getByRole('button', { name: 'End turn' }).click();
  await dragPiece(page, 'b8', 'c6');
  await page.getByRole('button', { name: 'End turn' }).click();
  await dragPiece(page, 'a2', 'a3');
  await hand(page, 'White').getByRole('button', { name: 'Cowardice' }).click();
  await clickSquare(page, 'b7');
  await clickSquare(page, 'b8');
  await page.getByRole('button', { name: 'Play Cowardice' }).click();
  await expectLastMove(board, 'b7', 'b8');
});

test('highlights all four squares moved by Annexation', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await hand(page, 'White').getByRole('button', { name: 'Annexation' }).click();
  await clickSquare(page, 'a2');
  await clickSquare(page, 'a4');
  await clickSquare(page, 'h2');
  await clickSquare(page, 'h4');
  await page.getByRole('button', { name: 'Play Annexation' }).click();

  await expectLastMove(board, 'a2', 'a4', 'h2', 'h4');
});

test('Holy War highlights only the swapped squares, replacing the regular move', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await dragPiece(page, 'e2', 'e4');
  await expectLastMove(board, 'e2', 'e4');
  await hand(page, 'White').getByRole('button', { name: 'Holy War' }).click();
  await clickSquare(page, 'b1');
  await clickSquare(page, 'c1');

  await expectLastMove(board, 'b1', 'c1');
});
