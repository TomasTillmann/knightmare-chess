import { test, expect, type Page } from '@playwright/test';

async function play(page: Page, id: string, name: string, squares: string[] = []) {
  await page.goto(`/?practice=${id}`);
  await page.locator('[data-player="white"]').getByRole('button', { name: `${name}:`, exact: false }).click({ position: { x: 18, y: 50 } });
  for (const square of squares) await page.getByRole('button', { name: `Choose ${square}`, exact: true }).click();
  await page.getByRole('button', { name: 'Play card', exact: true }).click();
}

async function move(page: Page, from: string, to: string) {
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('Missing chessboard');
  for (const square of [from, to]) await page.mouse.click(
    board.x + (square.charCodeAt(0) - 97 + .5) * board.width / 8,
    board.y + (8 - Number(square[1]) + .5) * board.height / 8,
  );
}

test('Doomsayer names a pawn or keeps the effect when declined', async ({ page }) => {
  await play(page, 'doomsayer', 'Doomsayer');
  await page.getByRole('button', { name: 'Name a piece', exact: true }).click();
  await page.getByRole('button', { name: 'Pawn', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a7', exact: true }).click();
  await page.getByRole('button', { name: 'Name piece', exact: true }).click();
  await expect(page.locator('#board-position')).not.toContainText('black pawn on a7');
  await expect(page.locator('#off-board-position')).toContainText('black pawn captured');
  await expect(page.locator('.effect-entry[data-effect="doomsayer"]')).toHaveCount(0);
  await play(page, 'doomsayer', 'Doomsayer');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(page.locator('.effect-entry[data-effect="doomsayer"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
});

test('Under Elf Hill returns the King before the next ordinary move', async ({ page }) => {
  await play(page, 'under-elf-hill', 'Under Elf Hill');
  await expect(page.locator('#board-position')).not.toContainText('white king on e1');
  await expect(page.locator('#off-board-position')).toContainText('white king away');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await move(page, 'e7', 'e5');
  await expect(page.locator('#board-position')).toContainText('black pawn on e5');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Return King', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose e1', exact: true }).click();
  await page.getByRole('button', { name: 'Return King', exact: true }).click();
  await expect(page.locator('#board-position')).toContainText('white king on e1');
  await expect(page.locator('#off-board-position')).not.toContainText('white king away');
  await move(page, 'e2', 'e4');
  await expect(page.locator('#board-position')).toContainText('white pawn on e4');
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
});

test('Panic forfeits an unanswered turn after fifteen seconds', async ({ page }) => {
  await page.clock.install();
  await play(page, 'panic', 'Panic');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await expect(page.getByRole('timer')).toContainText('Black to move');
  await expect(page.locator('[data-player="black"] .hand')).toHaveAttribute('data-active', 'true');
  await page.clock.fastForward(15000);
  await expect(page.locator('[data-player="white"] .hand')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('#board-position')).toContainText('black pawn on e7');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('.effect-entry[data-effect="panic"]')).toHaveCount(0);
});

test('A timely move clears Panic and cancels its deadline', async ({ page }) => {
  await page.clock.install();
  await play(page, 'panic', 'Panic');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await move(page, 'e7', 'e5');
  await expect(page.locator('#board-position')).toContainText('black pawn on e5');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('.effect-entry[data-effect="panic"]')).toHaveCount(0);
  await page.clock.fastForward(16000);
  await expect(page.locator('[data-player="black"] .hand')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
});

test('Abduction conceals the board and restores a correctly recalled pawn', async ({ page }) => {
  await page.clock.install();
  await play(page, 'abduction', 'Abduction', ['a7']);
  await expect(page.locator('.board-concealment')).toBeVisible();
  await expect(page.getByRole('timer')).toContainText('Look away');
  await page.clock.fastForward(10000);
  await expect(page.locator('.board-concealment')).toHaveCount(0);
  await expect(page.getByRole('timer')).toContainText('Recall');
  await page.getByRole('button', { name: 'Pawn', exact: true }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a7', exact: true }).click();
  await page.getByRole('button', { name: 'Answer', exact: true }).click();
  await expect(page.locator('#board-position')).toContainText('black pawn on a7');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('#off-board-position')).not.toContainText('black pawn captured');
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
});

test('Abduction captures the pawn when the recall deadline is missed', async ({ page }) => {
  await page.clock.install();
  await play(page, 'abduction', 'Abduction', ['a7']);
  await expect(page.locator('.board-concealment')).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(page.getByRole('timer')).toContainText('Recall');
  await page.clock.fastForward(10000);
  await expect(page.locator('#board-position')).not.toContainText('black pawn on a7');
  await expect(page.locator('#off-board-position')).toContainText('black pawn captured');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
});
