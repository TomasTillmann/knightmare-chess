import { test, expect, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const hand = (page: Page, color = 'white') => page.getByRole('region', { name: `${color} cards` });
async function select(page: Page, name: string) {
  await hand(page).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
}

test('Shrinking a phone viewport preserves scale and square hit targets', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile viewport scaling');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('cg-board')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight, visualViewport?.scale])).toEqual([375, 667, 1]);
  await page.locator('cg-board').scrollIntoViewIfNeeded();
  const board = (await page.locator('cg-board').boundingBox())!;
  for (const rank of [2, 4]) await page.touchscreen.tap(board.x + 7.5 * board.width / 8, board.y + (8.5 - rank) * board.height / 8);
  await expect(page.locator('#board-position')).toContainText('white pawn on h4');
});

test('Short landscape keeps usable squares and evenly aligned exterior files', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/?practice=hidden-passage');
  await expect(page.locator('cg-board')).toBeVisible();
  const layout = await page.evaluate(() => {
    const board = document.querySelector('cg-board')!.getBoundingClientRect();
    return {
      square: board.width / 8,
      files: [...document.querySelectorAll('coords.files coord')].map(file => {
        const box = file.getBoundingClientRect();
        return { outside: box.top >= board.bottom, offset: Math.abs(box.x + box.width / 2
          - (board.x + (file.textContent!.charCodeAt(0) - 96.5) * board.width / 8)) };
      }),
    };
  });
  expect(layout.square).toBeGreaterThanOrEqual(30);
  expect(layout.files).toHaveLength(8);
  for (const file of layout.files) {
    expect(file.outside).toBe(true);
    expect(file.offset).toBeLessThanOrEqual(1);
  }
});

test('An active effect previews its card and leaves mobile card selection unobstructed', async ({ page }, info) => {
  await page.goto('/?practice=curse');
  await select(page, 'Curse');
  await button(page, 'Choose d8').click();
  await button(page, 'Play card').click();
  const effect = page.locator('.effect-entry[data-effect="curse"]');
  if (info.project.name === 'mobile') await effect.tap();
  else await effect.focus();
  const preview = page.locator('.card-preview');
  await expect(preview.getByRole('img', { name: 'Curse', exact: true })).toBeVisible();
  await hand(page, 'black').getByRole('button', { name: /^Fog of War:/ }).click({ position: { x: 18, y: 50 } });
  await expect(button(page, 'Play card')).toBeEnabled();
  if (info.project.name === 'mobile') await expect(preview).toBeHidden();
  await button(page, 'Play card').click();
  await expect(effect).toHaveCount(0);
});

test('The selected card can be read and closed on mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile reading control');
  await page.goto('/?practice=hidden-passage');
  await select(page, 'Hidden Passage');
  await button(page, 'Read card').click();
  const reader = page.getByRole('dialog', { name: 'Hidden Passage', exact: true });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole('img', { name: 'Hidden Passage', exact: true })).toBeVisible();
  const bounds = await reader.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await button(page, 'Close card').click();
  await expect(reader).toHaveCount(0);
  await expect(button(page, 'Choose e4')).toBeVisible();
});

test('An unplayable card is readable by keyboard', async ({ page }) => {
  await page.goto('/?practice=hidden-passage');
  const card = hand(page, 'black').getByRole('button', { name: /^Fog of War:/ });
  await expect(card).toHaveAttribute('data-playable', 'false');
  await card.focus();
  await expect(card).toBeFocused();
  await card.press('Enter');
  const reader = page.getByRole('dialog', { name: 'Fog of War', exact: true });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole('img', { name: 'Fog of War', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await expect(page.locator('#board-position')).toContainText('white king on e1');
  await expect(page.locator('.board-targets')).toHaveCount(0);
});

test('Desktop hover shows the artwork and leaving restores the card back', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop hover preview');
  await page.goto('/?practice=hidden-passage');
  await page.mouse.move(0, 0);
  await expect(page.locator('.card-preview').getByRole('img', { name: 'Knightmare Chess card back', exact: true })).toBeVisible();
  await hand(page).getByRole('button', { name: /^Hidden Passage:/ }).hover({ position: { x: 18, y: 50 } });
  await expect(page.locator('.card-preview').getByRole('img', { name: 'Hidden Passage', exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator('.card-preview').getByRole('img', { name: 'Knightmare Chess card back', exact: true })).toBeVisible();
});

test('Exchanging a card replaces it and finishes the turn', async ({ page }) => {
  await page.goto('/?practice=mystic-shield');
  await expect(hand(page).locator('.hand')).toHaveCSS('opacity', '1');
  await expect(hand(page, 'black').locator('.hand')).toHaveCSS('opacity', '0.5');
  await button(page, 'Exchange card').click();
  await button(page, 'Mystic Shield').click();
  await button(page, 'Exchange & end').click();
  await expect(hand(page).getByRole('button', { name: /^Mystic Shield:/ })).toHaveCount(0);
  await expect(hand(page).getByRole('button', { name: /^Annexation:/ })).toHaveCount(1);
  await expect(hand(page).getByRole('button')).toHaveCount(5);
  await expect(hand(page, 'black').locator('.hand')).toHaveAttribute('data-active', 'true');
  await expect(hand(page).locator('.hand')).toHaveCSS('opacity', '0.5');
  await expect(hand(page, 'black').locator('.hand')).toHaveCSS('opacity', '1');
  await expect(page.locator('#board-position')).toContainText('white pawn on e4');
});

test('Plots Within Plots grants two additional playable cards', async ({ page }) => {
  await page.goto('/?practice=plots-within-plots');
  await select(page, 'Plots Within Plots');
  await button(page, 'Play card').click();
  await expect(page.getByText('White · 2 extra cards available', { exact: true })).toBeVisible();
  await select(page, 'Disintegration');
  await button(page, 'Choose e2').click();
  await button(page, 'Play card').click();
  await expect(page.locator('#board-position')).not.toContainText('white pawn on e2');
  await expect(page.locator('#off-board-position')).toContainText('white pawn dead');
  await expect(page.getByText('White · 1 extra cards available', { exact: true })).toBeVisible();
  await select(page, 'Fanatic');
  await button(page, 'Choose a2').click();
  await button(page, 'Play card').click();
  await expect(page.locator('#board-position')).toContainText('white pawn on a5');
  await expect(hand(page).getByRole('button', { name: /^Fanatic:/ })).toHaveCount(0);
  await expect(page.getByText(/extra cards available/)).toHaveCount(0);
  await expect(button(page, 'End turn')).toBeEnabled();
});
