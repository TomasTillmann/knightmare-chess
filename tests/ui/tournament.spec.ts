import { expect, type Locator, type Page, test } from '@playwright/test';

const description = "Swap the positions of one of your Knights and one of your opponent's Knights.";
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

test('previews Tournament and enables it only instead of the regular move', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Tournament' });
  await expect(card).toBeEnabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Tournament' })).toBeDisabled();

  await card.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Tournament card' })).toHaveAttribute('src', /KC12_card3\.png$/);
  await expect(details.getByRole('heading', { name: 'Tournament' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('6 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeDisabled();
});

test('swaps the White b1 and Black b8 Knights selected on the board', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Tournament' });
  await card.click();
  await clickSquare(page, 'b1');
  await expect(page.getByRole('status')).toHaveText('Choose Opponent Knight to swap with b1.');
  await clickSquare(page, 'b8');

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Tournament swapped b1 and b8.');
  await expect.poll(() => hasPiece(board, 'b1', 'piece.black.knight')).toBe(true);
  await expect.poll(() => hasPiece(board, 'b8', 'piece.white.knight')).toBe(true);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
});

test('supports the same Knight swap through keyboard controls', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await hand(page, 'White').getByRole('button', { name: 'Tournament' }).click();
  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Your Knight target' }).selectOption('b1');
  await page.getByRole('combobox', { name: 'Opponent Knight target' }).selectOption('b8');
  await page.getByRole('button', { name: 'Swap pieces' }).click();

  await expect(page.getByRole('status')).toHaveText('Tournament swapped b1 and b8.');
  await expect.poll(() => hasPiece(board, 'b1', 'piece.black.knight')).toBe(true);
  await expect.poll(() => hasPiece(board, 'b8', 'piece.white.knight')).toBe(true);
});
