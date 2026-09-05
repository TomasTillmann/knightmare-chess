import { expect, type Locator, type Page, test } from '@playwright/test';

const description =
  'Remove one of your own Pawns from the chessboard, and set it aside. It is now dead, and cannot be brought back into play with another card.';

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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows a Chessground board and both visible self-play hands', async ({ page }) => {
  await expect(page.getByTestId('chessboard').locator('cg-board')).toBeVisible();
  await expect(hand(page, 'White').getByRole('button', { name: /Disintegration/i })).toBeVisible();
  await expect(hand(page, 'Black').getByRole('button', { name: /Disintegration/i })).toBeVisible();
});

test('plays Disintegration on a friendly pawn and spends the card', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: /Disintegration/i });

  await card.click();
  await clickSquare(page, 'a2');

  await expect(board.locator('piece.white.pawn')).toHaveCount(7);
  await expect(card).toHaveCount(0);
});

test('rejects an enemy target without changing the board or hand', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: /Disintegration/i });

  await card.click();
  await clickSquare(page, 'a7');

  await expect(page.getByRole('alert')).toContainText('Choose one of your own Pawns');
  await expect(board.locator('piece.white.pawn')).toHaveCount(8);
  await expect(board.locator('piece.black.pawn')).toHaveCount(8);
  await expect(card).toBeVisible();
});

test('ends a legal move, switches sides, and lets the opponent play the card', async ({ page }) => {
  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(endTurn).toBeDisabled();

  await dragPiece(page, 'e2', 'e4');
  await expect(endTurn).toBeEnabled();
  await endTurn.click();
  await expect(page.getByText(/Black to move/i)).toBeVisible();

  const blackCard = hand(page, 'Black').getByRole('button', { name: /Disintegration/i });
  await blackCard.click();
  await clickSquare(page, 'a7');
  await expect(page.getByTestId('chessboard').locator('piece.black.pawn')).toHaveCount(7);
  await expect(blackCard).toHaveCount(0);
});

test('shows the full card artwork and rules on hover and keyboard focus', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: /Disintegration/i });
  const details = page.getByRole('region', { name: 'Card details' });

  await card.hover();
  await expect(details.getByRole('img', { name: 'Disintegration card' })).toHaveAttribute(
    'src',
    /KC1_card2\.png$/,
  );
  await expect(details).toHaveText(new RegExp(description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  await page.mouse.move(0, 0);
  await card.focus();
  await expect(details.getByRole('img', { name: 'Disintegration card' })).toBeVisible();
  await expect(details).toContainText('cannot be brought back into play');
});

test('plays and deselects Disintegration with keyboard controls', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Disintegration' });
  await card.focus();

  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('status')).toContainText('Card deselected');
  await page.keyboard.press('Enter');

  const summary = page.getByText('Keyboard controls', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  const target = page.getByRole('combobox', { name: 'Pawn target' });
  await target.focus();
  await page.keyboard.type('a2');
  await expect(target).toHaveValue('a2');
  await page.getByRole('button', { name: 'Play card' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('chessboard').locator('piece.white.pawn')).toHaveCount(7);
  await expect(card).toHaveCount(0);
});

test('keeps cards full-width in narrow scrolling hands', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(hand(page, 'White').getByRole('button', { name: 'Disintegration' })).toHaveCSS('flex-shrink', '0');
});

test('keeps a full desktop hand beside the board with vertical scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const card = hand(page, 'White').getByRole('button', { name: 'Disintegration' });
  await card.evaluate(node => {
    for (let index = 1; index < 5; index += 1) node.parentElement!.append(node.cloneNode(true));
  });
  const metrics = await hand(page, 'White').evaluate(node => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
});
