import { expect, type Locator, type Page, test } from '@playwright/test';

const description = 'Any number of your Pawns which can legally move may all move one square forward. None of them may make a capture.';
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

async function hasWhitePawn(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator('piece.white.pawn').evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews Onslaught and disables it after a regular move', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Onslaught' });
  await expect(card).toBeEnabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Onslaught' })).toBeDisabled();

  await card.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Onslaught card' })).toHaveAttribute('src', /KC12_card1\.png$/);
  await expect(details.getByRole('heading', { name: 'Onslaught' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('6 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeDisabled();
});

test('selects and advances three Pawns together from the board', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Onslaught' });
  await card.click();
  for (const file of ['a', 'c', 'e']) {
    await clickSquare(page, `${file}2`);
    await clickSquare(page, `${file}3`);
  }
  await page.getByRole('button', { name: 'Play Onslaught' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Onslaught moved 3 Pawns forward.');
  for (const file of ['a', 'c', 'e']) {
    await expect.poll(() => hasWhitePawn(board, `${file}3`)).toBe(true);
    await expect.poll(() => hasWhitePawn(board, `${file}2`)).toBe(false);
  }
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
});

test('cancels a board choice, then applies a keyboard-selected Pawn', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await hand(page, 'White').getByRole('button', { name: 'Onslaught' }).click();
  await clickSquare(page, 'h2');
  await clickSquare(page, 'h2');
  await expect(page.getByRole('status')).toHaveText('Pawn selection canceled. Choose a Pawn.');

  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Pawn source' }).selectOption('b2');
  await page.getByRole('combobox', { name: 'Pawn destination' }).selectOption('b3');
  await page.getByRole('button', { name: 'Add move' }).click();
  await page.getByRole('button', { name: 'Play Onslaught' }).click();

  await expect(page.getByRole('status')).toHaveText('Onslaught moved 1 Pawn forward.');
  await expect.poll(() => hasWhitePawn(board, 'b3')).toBe(true);
  await expect.poll(() => hasWhitePawn(board, 'b2')).toBe(false);
  await expect.poll(() => hasWhitePawn(board, 'h2')).toBe(true);
  await expect.poll(() => hasWhitePawn(board, 'h3')).toBe(false);
});
