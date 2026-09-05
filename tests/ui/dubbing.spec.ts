import { expect, type Locator, type Page, test } from '@playwright/test';

const description = 'For this turn, one of your pieces may move as if it were a Knight. You cannot capture a piece with this move.';
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

async function hasWhitePiece(board: Locator, role: string, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator(`piece.white.${role}`).evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews Dubbing artwork, metadata, and replacement timing', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Dubbing' });
  await expect(card).toBeEnabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Dubbing' })).toBeDisabled();

  await card.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Dubbing card' })).toHaveAttribute('src', /KC5_card1\.png$/);
  await expect(details.getByRole('heading', { name: 'Dubbing' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('4 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeDisabled();
});

test('moves a Pawn like a Knight through the board flow without capturing', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Dubbing' });
  await card.click();
  await clickSquare(page, 'e2');
  await clickSquare(page, 'f4');
  await page.getByRole('button', { name: 'Play Dubbing' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Dubbing moved');
  await expect.poll(() => hasWhitePiece(board, 'pawn', 'f4')).toBe(true);
  await expect.poll(() => hasWhitePiece(board, 'pawn', 'e2')).toBe(false);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
});

test('reports an occupied destination, cancels, then accepts keyboard controls', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await hand(page, 'White').getByRole('button', { name: 'Dubbing' }).click();
  await clickSquare(page, 'e2');
  await clickSquare(page, 'c1');
  await expect(page.getByRole('alert')).toContainText('empty');
  await clickSquare(page, 'e2');
  await expect(page.getByRole('status')).toContainText('selection canceled');

  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Piece source' }).selectOption('d1');
  await page.getByRole('combobox', { name: 'Piece destination' }).selectOption('c3');
  await page.getByRole('button', { name: 'Add move' }).click();
  await page.getByRole('button', { name: 'Play Dubbing' }).click();

  await expect(page.getByRole('status')).toContainText('Dubbing moved');
  await expect.poll(() => hasWhitePiece(board, 'queen', 'c3')).toBe(true);
  await expect.poll(() => hasWhitePiece(board, 'queen', 'd1')).toBe(false);
});
