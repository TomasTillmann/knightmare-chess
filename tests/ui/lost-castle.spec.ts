import { expect, type Locator, type Page, test } from '@playwright/test';

const description = "Swap the positions of one of your Rooks and one of your opponent's Rooks.";
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

test('previews Lost Castle and enables it only instead of the regular move', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Lost Castle' });
  await expect(card).toBeEnabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Lost Castle' })).toBeDisabled();

  await card.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Lost Castle card' })).toHaveAttribute('src', /KC14_card3\.png$/);
  await expect(details.getByRole('heading', { name: 'Lost Castle' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('7 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeDisabled();
});

test('swaps the White a1 and Black a8 Rooks selected on the board', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Lost Castle' });
  await card.click();
  await clickSquare(page, 'a1');
  await expect(page.getByRole('status')).toHaveText('Choose Opponent Rook to swap with a1.');
  await clickSquare(page, 'a8');

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Lost Castle swapped a1 and a8.');
  await expect.poll(() => hasPiece(board, 'a1', 'piece.black.rook')).toBe(true);
  await expect.poll(() => hasPiece(board, 'a8', 'piece.white.rook')).toBe(true);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
});

test('supports the same Rook swap through keyboard controls', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await hand(page, 'White').getByRole('button', { name: 'Lost Castle' }).click();
  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Your Rook target' }).selectOption('a1');
  await page.getByRole('combobox', { name: 'Opponent Rook target' }).selectOption('a8');
  await page.getByRole('button', { name: 'Swap pieces' }).click();

  await expect(page.getByRole('status')).toHaveText('Lost Castle swapped a1 and a8.');
  await expect.poll(() => hasPiece(board, 'a1', 'piece.black.rook')).toBe(true);
  await expect.poll(() => hasPiece(board, 'a8', 'piece.white.rook')).toBe(true);
});
