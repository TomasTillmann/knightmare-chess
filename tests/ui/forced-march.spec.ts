import { expect, type Locator, type Page, test } from '@playwright/test';

const description = 'Move one or two of your Pawns sideways, in either direction, one square each.';
const hand = (page: Page, color: 'White' | 'Black') => page.getByRole('region', { name: `${color} hand` });

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

async function hasPiece(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator('piece.white.pawn').evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

async function finishMove(page: Page, from: string, to: string) {
  await dragPiece(page, from, to);
  await page.getByRole('button', { name: 'End turn' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows Forced March in both hands and previews its rules', async ({ page }) => {
  const whiteCard = hand(page, 'White').getByRole('button', { name: 'Forced March' });
  await expect(whiteCard).toBeEnabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Forced March' })).toBeDisabled();

  await whiteCard.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Forced March card' })).toHaveAttribute('src', /KC2_card2\.png$/);
  await expect(details.getByRole('heading', { name: 'Forced March' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();
});

test('prepares and commits a one-Pawn Forced March', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await finishMove(page, 'a2', 'a3');
  await finishMove(page, 'a7', 'a6');

  const card = hand(page, 'White').getByRole('button', { name: 'Forced March' });
  await card.click();
  await clickSquare(page, 'b2');
  await clickSquare(page, 'a2');
  await expect(page.getByRole('status')).toHaveText('One Pawn move ready. Play the card now, or choose one more Pawn.');
  await page.locator('.controls__buttons button', { hasText: 'Play (1/2)' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Forced March moved 1 Pawn sideways.');
  await expect.poll(() => hasPiece(board, 'a2')).toBe(true);
  await expect.poll(() => hasPiece(board, 'b2')).toBe(false);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
});

test('prepares and commits two Pawn moves together', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await finishMove(page, 'a2', 'a3');
  await finishMove(page, 'a7', 'a6');
  await finishMove(page, 'h2', 'h3');
  await finishMove(page, 'h7', 'h6');

  const card = hand(page, 'White').getByRole('button', { name: 'Forced March' });
  await card.click();
  await clickSquare(page, 'b2');
  await clickSquare(page, 'a2');
  await clickSquare(page, 'g2');
  await clickSquare(page, 'h2');
  await expect(page.getByRole('status')).toHaveText('Two Pawn moves ready. Play Forced March.');
  await page.locator('.controls__buttons button', { hasText: 'Play (2/2)' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Forced March moved 2 Pawns sideways.');
  await expect.poll(() => hasPiece(board, 'a2')).toBe(true);
  await expect.poll(() => hasPiece(board, 'h2')).toBe(true);
  await expect.poll(() => hasPiece(board, 'b2')).toBe(false);
  await expect.poll(() => hasPiece(board, 'g2')).toBe(false);
});
