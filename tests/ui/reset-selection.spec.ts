import { expect, type Locator, type Page, test } from '@playwright/test';

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

async function hasWhiteKnight(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  return board.locator('piece.white.knight').evaluateAll((pieces, target) => pieces.some(piece => {
    const box = piece.getBoundingClientRect();
    return target.x >= box.left && target.x <= box.right && target.y >= box.top && target.y <= box.bottom;
  }), point);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Reset clears ordinary selection before the next board click', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await clickSquare(page, 'b1');
  await expect(board.locator('square.selected')).toHaveCount(1);
  await expect(board.locator('square.move-dest')).toHaveCount(2);

  await page.getByRole('button', { name: /Reset/ }).click();
  await expect(board.locator('square.selected')).toHaveCount(0);
  await expect(board.locator('square.move-dest')).toHaveCount(0);

  await clickSquare(page, 'a3');
  await expect.poll(() => hasWhiteKnight(board, 'b1')).toBe(true);
  await expect.poll(() => hasWhiteKnight(board, 'a3')).toBe(false);

  await clickSquare(page, 'b1');
  await clickSquare(page, 'a3');
  await expect.poll(() => hasWhiteKnight(board, 'b1')).toBe(false);
  await expect.poll(() => hasWhiteKnight(board, 'a3')).toBe(true);
});

test('card target selection remains highlighted and functional', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await page.getByRole('region', { name: 'White hand' }).getByRole('button', { name: 'Long Jump' }).click();
  await clickSquare(page, 'b1');

  await expect(board.locator('square.selected')).toHaveCount(1);
  await clickSquare(page, 'd4');
  await page.getByRole('button', { name: 'Play Long Jump' }).click();
  await expect.poll(() => hasWhiteKnight(board, 'd4')).toBe(true);
});
