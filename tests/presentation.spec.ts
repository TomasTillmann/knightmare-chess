import { test, expect, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const hand = (page: Page, color = 'white') => page.getByRole('region', { name: `${color} cards` });
async function select(page: Page, name: string) {
  await hand(page).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
}

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
  await button(page, 'Exchange card').click();
  await button(page, 'Mystic Shield').click();
  await button(page, 'Exchange & end').click();
  await expect(hand(page).getByRole('button', { name: /^Mystic Shield:/ })).toHaveCount(0);
  await expect(hand(page).getByRole('button', { name: /^Annexation:/ })).toHaveCount(1);
  await expect(hand(page).getByRole('button')).toHaveCount(5);
  await expect(hand(page, 'black').locator('.hand')).toHaveAttribute('data-active', 'true');
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
