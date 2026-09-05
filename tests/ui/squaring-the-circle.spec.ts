import { expect, type Locator, type Page, test } from '@playwright/test';

const description = 'You may play this Card Only when three of the four corners of the chessboard are occupied. Move any one of your pieces to the empty corner.';
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

async function finishMove(page: Page, from: string, to: string) {
  await dragPiece(page, from, to);
  await page.getByRole('button', { name: 'End turn' }).click();
}

async function hasWhiteRook(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator('piece.white.rook').evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews exact Squaring the Circle artwork, metadata, text, and replacement timing while unplayable', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Squaring the Circle' });
  await expect(card).toBeDisabled();
  await card.hover();

  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Squaring the Circle card' })).toHaveAttribute('src', /KC3_card4\.png$/);
  await expect(details.getByRole('heading', { name: 'Squaring the Circle' })).toBeVisible();
  await expect(details.getByText('3 points', { exact: true })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();
});

test('the initial four occupied corners offer no Squaring move and execute nothing', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Squaring the Circle' });

  await expect(card).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play Squaring the Circle' })).toHaveCount(0);
  await expect.poll(() => hasWhiteRook(board, 'a1')).toBe(true);
  await expect.poll(() => hasWhiteRook(board, 'h1')).toBe(true);
  await expect(page.getByText('White to move', { exact: true })).toBeVisible();
});

test('self-play opens a corner, plays Squaring from the board, and hands the next turn to Black', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await finishMove(page, 'a2', 'a3');
  await finishMove(page, 'a7', 'a6');
  await finishMove(page, 'a1', 'a2');
  await finishMove(page, 'h7', 'h6');

  const whiteHand = hand(page, 'White');
  const card = whiteHand.getByRole('button', { name: 'Squaring the Circle' });
  const handCount = await whiteHand.getByRole('button').count();
  await expect(card).toBeEnabled();
  await card.click();
  await clickSquare(page, 'a2');
  await clickSquare(page, 'a1');
  await page.getByRole('button', { name: 'Play Squaring the Circle' }).click();

  await expect(card).toHaveCount(0);
  await expect(whiteHand.getByRole('button')).toHaveCount(handCount - 1);
  await expect(page.getByRole('status')).toContainText('Squaring the Circle moved');
  await expect.poll(() => hasWhiteRook(board, 'a1')).toBe(true);
  await expect.poll(() => hasWhiteRook(board, 'a2')).toBe(false);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
});
