import { expect, type Locator, type Page, test } from '@playwright/test';

const description =
  'Move one of your Pawns forward three squares, provided the path is clear. It may not capture on this move, or be captured en passant.';

const hand = (page: Page, color: 'White' | 'Black') =>
  page.getByRole('region', { name: `${color} hand` });

async function squareCenter(board: Locator, square: string) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Chessboard is not visible');
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const black = (await board.getAttribute('data-orientation')) === 'black';
  const x = black ? 7 - file : file;
  const y = black ? rank : 7 - rank;
  return { x: box.x + ((x + 0.5) * box.width) / 8, y: box.y + ((y + 0.5) * box.height) / 8 };
}

async function clickSquare(page: Page, square: string) {
  const board = page.getByTestId('chessboard');
  await expect(board).toBeVisible();
  const point = await squareCenter(board, square);
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
  return boxes.some(box =>
    point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows Fanatic in both hands and previews its printed rules', async ({ page }) => {
  const whiteCard = hand(page, 'White').getByRole('button', { name: 'Fanatic' });
  const blackCard = hand(page, 'Black').getByRole('button', { name: 'Fanatic' });

  await expect(whiteCard).toBeVisible();
  await expect(whiteCard).toBeEnabled();
  await expect(blackCard).toBeVisible();
  await expect(blackCard).toBeDisabled();

  await whiteCard.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Fanatic card' })).toHaveAttribute('src', /KC1_card4\.png$/);
  await expect(details.getByRole('heading', { name: 'Fanatic' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();

  await hand(page, 'White').getByRole('button', { name: 'Disintegration' }).focus();
  await whiteCard.hover();
  await expect(details.getByRole('heading', { name: 'Fanatic' })).toBeVisible();
});

test('disables Fanatic but keeps after-move cards available after a regular move', async ({ page }) => {
  await dragPiece(page, 'e2', 'e4');

  await expect(hand(page, 'White').getByRole('button', { name: 'Fanatic' })).toBeDisabled();
  await expect(hand(page, 'White').getByRole('button', { name: 'Disintegration' })).toBeEnabled();
});

test('moves a2 to a5 instead of a regular move and hands play to Black', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const whiteCard = hand(page, 'White').getByRole('button', { name: 'Fanatic' });

  await whiteCard.click();
  await expect(whiteCard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText('Choose one of your Pawns');
  await clickSquare(page, 'a2');

  await expect(page.getByRole('status')).toHaveText('Fanatic moved the Pawn three squares from a2.');
  await expect(whiteCard).toHaveCount(0);
  await expect.poll(() => hasPiece(board, 'a5', 'piece.white.pawn')).toBe(true);
  await expect.poll(() => hasPiece(board, 'a2', 'piece.white.pawn')).toBe(false);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();

  await dragPiece(page, 'e2', 'e4');
  await expect.poll(() => hasPiece(board, 'e2', 'piece.white.pawn')).toBe(true);
  await expect.poll(() => hasPiece(board, 'e4', 'piece.white.pawn')).toBe(false);

  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(endTurn).toBeEnabled();
  await endTurn.click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Fanatic' })).toBeEnabled();
});

test('keeps Disintegration playable beside Fanatic', async ({ page }) => {
  const whiteHand = hand(page, 'White');
  const disintegration = whiteHand.getByRole('button', { name: 'Disintegration' });
  const fanatic = whiteHand.getByRole('button', { name: 'Fanatic' });

  await disintegration.click();
  await clickSquare(page, 'a2');

  await expect(page.getByTestId('chessboard').locator('piece.white.pawn')).toHaveCount(7);
  await expect(disintegration).toHaveCount(0);
  await expect(fanatic).toBeVisible();
  await expect(fanatic).toBeDisabled();
});

test('keeps the stacked tablet board capped and centered', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  const box = await page.getByTestId('chessboard').boundingBox();
  if (!box) throw new Error('Chessboard is not visible');

  expect(box.width).toBeLessThanOrEqual(620);
  expect(Math.abs(box.x + box.width / 2 - 500)).toBeLessThanOrEqual(2);
  expect(box.y + box.height).toBeLessThan(850);
});
