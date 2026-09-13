import { test, expect, type Page } from '@playwright/test';

test.skip(!process.env.UI_STRESS, 'Extended deadline lifecycle checks');

async function start(page: Page, id: string, name: string, target?: string) {
  await page.clock.install();
  await page.goto(`/?practice=${id}`);
  await page.locator('[data-player="white"]').getByRole('button', { name: `${name}:`, exact: false }).click({ position: { x: 18, y: 50 } });
  if (target) await page.getByRole('button', { name: `Choose ${target}`, exact: true }).click();
  await page.getByRole('button', { name: 'Play card', exact: true }).click();
}

test('Panic keeps its original deadline through reading and canceling a card draft', async ({ page }) => {
  await start(page, 'panic', 'Panic');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await page.clock.fastForward(3000);
  const black = page.locator('[data-player="black"]');
  const unavailable = black.locator('.hand-card[data-playable="false"]').first();
  await unavailable.focus();
  await unavailable.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward(4000);
  await page.getByRole('button', { name: 'Close card', exact: true }).click();
  const playable = black.locator('.hand-card[data-playable="true"]').first();
  await playable.focus();
  await playable.press('Enter');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await page.clock.fastForward(3000);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.clock.fastForward(4000);
  await expect(black.locator('.hand')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('timer')).toBeVisible();
  await page.clock.fastForward(1000);
  await expect(page.locator('[data-player="white"] .hand')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('#board-position')).toContainText('black pawn on e7');
});

test('Abduction expires during a partially completed recall and removes its draft', async ({ page }) => {
  await start(page, 'abduction', 'Abduction', 'a7');
  await page.clock.fastForward(10000);
  await page.getByRole('button', { name: 'Pawn', exact: true }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose a7', exact: true })).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Card destinations' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
  await expect(page.locator('#off-board-position')).toContainText('black pawn captured');
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
});

test('A completed Abduction cannot time out during a later turn', async ({ page }) => {
  await start(page, 'abduction', 'Abduction', 'a7');
  await page.clock.fastForward(10000);
  await page.clock.fastForward(3000);
  await page.getByRole('button', { name: 'Pawn', exact: true }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a7', exact: true }).click();
  await page.getByRole('button', { name: 'Answer', exact: true }).click();
  await expect(page.locator('#board-position')).toContainText('black pawn on a7');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('Missing chessboard');
  for (const rank of [7, 5]) await page.mouse.click(board.x + 4.5 * board.width / 8, board.y + (8 - rank + .5) * board.height / 8);
  await expect(page.locator('#board-position')).toContainText('black pawn on e5');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  const position = await page.locator('#board-position').textContent();
  await page.clock.fastForward(30000);
  await expect(page.locator('#board-position')).toHaveText(position!);
  await expect(page.locator('#off-board-position')).not.toContainText('black pawn captured');
  await expect(page.locator('[data-player="white"] .hand')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
});

test('Fog of War cancels an Abduction recall and its stale deadline', async ({ page }) => {
  await start(page, 'abduction', 'Abduction', 'a7');
  await page.clock.fastForward(10000);
  await expect(page.getByRole('timer')).toContainText('Recall');
  const fog = page.locator('[data-player="black"]').getByRole('button', { name: 'Fog of War:', exact: false });
  await fog.focus();
  await fog.press('Enter');
  await page.getByRole('button', { name: 'Play card', exact: true }).click();
  await expect(page.locator('#board-position')).toContainText('black pawn on a7');
  await expect(page.getByRole('group', { name: 'Card destinations' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
  const position = await page.locator('#board-position').textContent();
  await page.clock.fastForward(20000);
  await expect(page.locator('#board-position')).toHaveText(position!);
  await expect(page.locator('#off-board-position')).not.toContainText('black pawn captured');
  await expect(page.getByRole('group', { name: 'Card destinations' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
});
