import { expect, type Locator, type Page, test } from '@playwright/test';

const description =
  'Play this card after you capture any enemy piece without using a card. The captured piece is now dead and cannot be brought back into play with another card.';
const hand = (page: Page, color: 'White' | 'Black') =>
  page.getByRole('region', { name: `${color} hand` });

async function squareCenter(board: Locator, square: string) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Chessboard is not visible');
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return { x: box.x + ((file + 0.5) * box.width) / 8, y: box.y + ((7.5 - rank) * box.height) / 8 };
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

async function prepareCapture(page: Page) {
  await finishMove(page, 'e2', 'e4');
  await finishMove(page, 'd7', 'd5');
  await dragPiece(page, 'e4', 'd5');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews No Quarter artwork, points, printed text, and capture timing', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'No Quarter' });
  await expect(card).toBeDisabled();
  await card.hover();

  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'No Quarter card' })).toHaveAttribute('src', /KC5_card4\.png$/);
  await expect(details.getByRole('heading', { name: 'No Quarter' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('4 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play after an ordinary capture', { exact: true })).toBeVisible();
});

test('stays unavailable without a capture, then offers one accessible targetless Play control', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'No Quarter' });
  await expect(card).toBeDisabled();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeDisabled();
  await page.getByRole('button', { name: 'End turn' }).click();
  await finishMove(page, 'd7', 'd5');
  await dragPiece(page, 'e4', 'd5');

  await expect(card).toBeEnabled();
  await card.click();
  const play = page.getByRole('button', { name: 'Play No Quarter' });
  await expect(play).toBeEnabled();
  await expect(play).toHaveCount(1);
});

test('spends No Quarter on the exact ordinary-capture victim and ordinary play continues', async ({ page }) => {
  await prepareCapture(page);
  const whiteHand = hand(page, 'White');
  const card = whiteHand.getByRole('button', { name: 'No Quarter' });
  const handCount = await whiteHand.getByRole('button').count();
  const board = page.getByTestId('chessboard');
  await expect(board.locator('piece.black.pawn')).toHaveCount(7);

  await card.click();
  await page.getByRole('button', { name: 'Play No Quarter' }).click();

  await expect(card).toHaveCount(0);
  await expect(whiteHand.getByRole('button')).toHaveCount(handCount - 1);
  await expect(board.locator('piece.black.pawn')).toHaveCount(7);
  await expect(page.getByRole('status')).toContainText(/No Quarter.*captured piece.*dead/i);

  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  await dragPiece(page, 'g8', 'f6');
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Move complete');
});
