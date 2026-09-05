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
