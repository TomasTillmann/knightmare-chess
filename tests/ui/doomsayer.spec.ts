import { expect, type Locator, type Page, test } from '@playwright/test';

const description =
  'The next player who pronounces the name of a piece, except "King," loses one piece of that type. If he doesn\'t own a piece of that type, this card remains in effect. When you play this card, your opponent has the option to name a piece immediately.';
const hand = (page: Page, color: 'White' | 'Black') =>
  page.getByRole('region', { name: `${color} hand` });
const announcement = (page: Page) => page.getByRole('region', { name: 'Doomsayer announcement' });

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

async function activateDoomsayer(page: Page) {
  await dragPiece(page, 'e2', 'e4');
  const card = hand(page, 'White').getByRole('button', { name: 'Doomsayer' });
  await card.click();
  await page.getByRole('button', { name: 'Play Doomsayer' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows the physical card, complete rules, points, timing, and continuing label', async ({ page }) => {
  const whiteCard = hand(page, 'White').getByRole('button', { name: 'Doomsayer' });
  const blackCard = hand(page, 'Black').getByRole('button', { name: 'Doomsayer' });
  await expect(whiteCard).toBeVisible();
  await expect(whiteCard).toHaveAttribute('aria-disabled', 'true');
  await expect(blackCard).toBeVisible();
  await expect(blackCard).toHaveAttribute('aria-disabled', 'true');

  await whiteCard.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Doomsayer card' })).toHaveAttribute('src', /KC1_card3\.png$/);
  await expect(details.getByRole('heading', { name: 'Doomsayer' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('2 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play after your move', { exact: true })).toBeVisible();
  await expect(details.getByText('Continuing Effect', { exact: true })).toBeVisible();

  await dragPiece(page, 'e2', 'e4');
  await expect(whiteCard).toHaveAttribute('aria-disabled', 'false');
});

test('plays targetlessly and exposes an immediate announcement without ending the move', async ({ page }) => {
  const whiteHand = hand(page, 'White');
  const card = whiteHand.getByRole('button', { name: 'Doomsayer' });
  const handCount = await whiteHand.getByRole('button').count();
  await dragPiece(page, 'e2', 'e4');
  await card.click();

  await expect(page.getByRole('button', { name: 'Play Doomsayer' })).toBeEnabled();
  await expect(page.locator('.board-frame')).not.toHaveClass(/board-frame--targeting/);
  await page.getByRole('button', { name: 'Play Doomsayer' }).click();

  await expect(card).toHaveCount(0);
  await expect(whiteHand.getByRole('button')).toHaveCount(handCount - 1);
  await expect(page.getByRole('region', { name: 'Active effects' }).getByText('Doomsayer', { exact: true })).toBeVisible();
  await expect(announcement(page)).toContainText(/Black.*name.*immediately/i);
  await expect(page.getByRole('button', { name: 'End turn' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText(/Doomsayer.*active/i);
});

test('lets the opponent choose the exact named piece and announces the loss', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  await activateDoomsayer(page);
  const panel = announcement(page);
  await panel.getByRole('combobox', { name: /piece (name|type)/i }).selectOption('queen');
  const victim = panel.getByRole('combobox', { name: /piece to lose|loss target/i });
  await expect(victim.locator('option')).toHaveCount(2);
  await victim.selectOption('d8');
  await panel.getByRole('button', { name: /name|announce|pronounce/i }).click();

  await expect(board.locator('piece.black.queen')).toHaveCount(0);
  await expect(board.locator('piece.white.queen')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText(/Black.*Queen.*d8.*lost|Queen.*d8.*captured/i);
  await expect(page.getByRole('region', { name: 'Active effects' }).getByText('Doomsayer', { exact: true })).toHaveCount(0);
  await expect(announcement(page)).toHaveCount(0);
});

test('clears a stale victim when the named type changes and then recovers', async ({ page }) => {
  await activateDoomsayer(page);
  const panel = announcement(page);
  const role = panel.getByRole('combobox', { name: /piece (name|type)/i });
  const victim = panel.getByRole('combobox', { name: /piece to lose|loss target/i });
  const submit = panel.getByRole('button', { name: /name|announce|pronounce/i });

  await role.selectOption('queen');
  await victim.selectOption('d8');
  await expect(submit).toBeEnabled();
  await role.selectOption('rook');
  await expect(victim).toHaveValue('');
  await expect(submit).toBeDisabled();
  await victim.selectOption('a8');
  await submit.click();

  await expect(page.getByTestId('chessboard').locator('piece.black.rook')).toHaveCount(1);
  await expect(page.getByTestId('chessboard').locator('piece.black.queen')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('keeps a declined effect through End turn and unrelated named-card play', async ({ page }) => {
  await activateDoomsayer(page);
  await announcement(page).getByRole('button', { name: 'Decline immediate option' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  await expect(announcement(page)).toContainText(/Black.*name/i);

  const disintegration = hand(page, 'Black').getByRole('button', { name: 'Disintegration' });
  await disintegration.click();
  await clickSquare(page, 'a7');

  await expect(page.getByTestId('chessboard').locator('piece.black.pawn')).toHaveCount(7);
  await expect(page.getByRole('region', { name: 'Active effects' }).getByText('Doomsayer', { exact: true })).toBeVisible();
  await expect(announcement(page)).toBeVisible();
});

test('supports the entire play and announcement flow from the keyboard', async ({ page }) => {
  await dragPiece(page, 'e2', 'e4');
  const card = hand(page, 'White').getByRole('button', { name: 'Doomsayer' });
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play Doomsayer' }).focus();
  await page.keyboard.press('Enter');

  const panel = announcement(page);
  const role = panel.getByRole('combobox', { name: /piece (name|type)/i });
  await role.focus();
  await role.selectOption('knight');
  const victim = panel.getByRole('combobox', { name: /piece to lose|loss target/i });
  await victim.focus();
  await victim.selectOption('b8');
  const submit = panel.getByRole('button', { name: /name|announce|pronounce/i });
  await submit.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('chessboard').locator('piece.black.knight')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText(/Knight.*b8/i);
});

test('keeps card and announcement controls usable in the compact layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const card = hand(page, 'White').getByRole('button', { name: 'Doomsayer' });
  await expect(page.getByTestId('chessboard')).toBeVisible();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('flex-shrink', '0');

  await activateDoomsayer(page);
  const panel = announcement(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('combobox', { name: /piece (name|type)/i })).toBeVisible();
  await expect(panel.getByRole('button', { name: /name|announce|pronounce/i })).toBeVisible();
});
