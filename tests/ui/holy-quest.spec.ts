import { expect, type Locator, type Page, test } from '@playwright/test';

const description = 'Swap the positions of a Bishop and a Knight belonging to your opponent.';
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

async function hasPiece(board: Locator, square: string, selector: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator(selector).evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews Holy Quest but enables it only after the regular move', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Holy Quest' });
  await expect(card).toBeDisabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Holy Quest' })).toBeDisabled();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeEnabled();
  await card.hover();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Holy Quest card' })).toHaveAttribute('src', /KC14_card1\.png$/);
  await expect(details.getByRole('heading', { name: 'Holy Quest' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('7 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play after your move', { exact: true })).toBeVisible();
});

test('swaps the Black c8 Bishop and b8 Knight selected on the board', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await dragPiece(page, 'e2', 'e4');
  const card = hand(page, 'White').getByRole('button', { name: 'Holy Quest' });
  await card.click();
  await clickSquare(page, 'c8');
  await expect(page.getByRole('status')).toHaveText('Choose a Knight to swap with c8.');
  await clickSquare(page, 'b8');

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Holy Quest swapped c8 and b8.');
  await expect.poll(() => hasPiece(board, 'b8', 'piece.black.bishop')).toBe(true);
  await expect.poll(() => hasPiece(board, 'c8', 'piece.black.knight')).toBe(true);
});

test('supports the same opposing-piece swap through keyboard controls', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await dragPiece(page, 'd2', 'd4');
  await hand(page, 'White').getByRole('button', { name: 'Holy Quest' }).click();
  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Bishop target' }).selectOption('c8');
  await page.getByRole('combobox', { name: 'Knight target' }).selectOption('b8');
  await page.getByRole('button', { name: 'Swap pieces' }).click();

  await expect(page.getByRole('status')).toHaveText('Holy Quest swapped c8 and b8.');
  await expect.poll(() => hasPiece(board, 'b8', 'piece.black.bishop')).toBe(true);
  await expect.poll(() => hasPiece(board, 'c8', 'piece.black.knight')).toBe(true);
});
