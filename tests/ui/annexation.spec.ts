import { expect, type Locator, type Page, test } from '@playwright/test';

const description =
  'Move one or two of your Pawns forward, two squares each. Neither one may make a capture. A Pawn which was on its starting square may still be captured en passant after this move, if an enemy Pawn is in position to do so.';
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

async function hasWhitePawn(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator('piece.white.pawn').evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box =>
    point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows Annexation in both hands and previews its printed rules', async ({ page }) => {
  const whiteCard = hand(page, 'White').getByRole('button', { name: 'Annexation' });
  await expect(whiteCard).toBeEnabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Annexation' })).toBeDisabled();

  await whiteCard.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Annexation card' })).toHaveAttribute('src', /KC2_card1\.png$/);
  await expect(details.getByRole('heading', { name: 'Annexation' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('3 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();
});

test('prepares and commits one two-square Pawn advance', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Annexation' });
  await card.click();
  await clickSquare(page, 'a2');
  await expect(page.getByRole('status')).toHaveText('Pawn a2 selected. Choose its two-square forward destination.');
  await clickSquare(page, 'a4');
  await expect(page.getByRole('status')).toHaveText('One Pawn move ready. Play the card now, or choose one more Pawn.');
  await page.getByRole('button', { name: 'Play Annexation' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Annexation moved 1 Pawn forward.');
  await expect.poll(() => hasWhitePawn(board, 'a4')).toBe(true);
  await expect.poll(() => hasWhitePawn(board, 'a2')).toBe(false);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
});

test('prepares and commits two Pawn advances atomically', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Annexation' });
  await card.click();
  await clickSquare(page, 'a2');
  await clickSquare(page, 'a4');
  await clickSquare(page, 'h2');
  await clickSquare(page, 'h4');
  await expect(page.getByRole('status')).toHaveText('Two Pawn moves ready. Play Annexation.');
  await page.getByRole('button', { name: 'Play Annexation' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Annexation moved 2 Pawns forward.');
  await expect.poll(() => hasWhitePawn(board, 'a4')).toBe(true);
  await expect.poll(() => hasWhitePawn(board, 'h4')).toBe(true);
  await expect.poll(() => hasWhitePawn(board, 'a2')).toBe(false);
  await expect.poll(() => hasWhitePawn(board, 'h2')).toBe(false);
});
