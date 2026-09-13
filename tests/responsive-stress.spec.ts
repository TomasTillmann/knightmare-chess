import { expect, test, type Page } from '@playwright/test';

test.skip(!process.env.UI_STRESS, 'Opt-in responsive audit: UI_STRESS=1');

const sizes = [[320, 568], [375, 667], [390, 844], [667, 375], [800, 600], [801, 600], [1024, 768]];
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function select(page: Page, name: string) {
  await page.getByRole('region', { name: 'white cards' }).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
}

async function geometry(page: Page) {
  const board = await page.locator('cg-board').boundingBox();
  expect(board).not.toBeNull();
  expect(Math.abs(board!.width - board!.height)).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('Hand, board and choices survive narrow and landscape resizing', async ({ page }) => {
  await page.goto('/?practice=hidden-passage');
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await select(page, 'Hidden Passage');
    await geometry(page);
    await button(page, 'Choose e4').click();
    await expect(button(page, 'Play card')).toBeEnabled();
    await button(page, 'Cancel').click();
  }
  await select(page, 'Hidden Passage');
  await button(page, 'Choose e4').click();
  await button(page, 'Play card').click();
  await expect(page.locator('#board-position')).toContainText('white king on e4');
});
