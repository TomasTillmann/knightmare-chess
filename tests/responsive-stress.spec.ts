import { expect, test, type Page } from '@playwright/test';

test.skip(!process.env.UI_STRESS, 'Opt-in responsive audit: UI_STRESS=1');

const sizes = [[320, 568], [375, 667], [390, 844], [667, 375], [800, 600], [801, 600], [1024, 768]];
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function select(page: Page, name: string) {
  await page.getByRole('region', { name: 'white cards' }).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
}

async function geometry(page: Page) {
  await page.locator('cg-board').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const issues = await page.evaluate(() => {
    const board = document.querySelector('cg-board')!.getBoundingClientRect();
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    const intersects = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    const errors: string[] = [];
    if (Math.abs(board.width - board.height) > 1) errors.push('Board is not square');
    if (document.documentElement.scrollWidth > innerWidth + 1) errors.push('Page has horizontal overflow');
    const ranks = rect('coords.ranks'), files = rect('coords.files');
    if (!ranks || ranks.right > board.left + 1) errors.push('Ranks are inside the board');
    if (!files || files.top < board.bottom - 1) errors.push('Files are inside the board');
    for (const rank of document.querySelectorAll('coords.ranks coord')) {
      const box = rank.getBoundingClientRect();
      if (Math.abs(box.y + box.height / 2 - (board.top + (8.5 - Number(rank.textContent)) * board.height / 8)) > 1) errors.push(`Rank ${rank.textContent} does not align with its row`);
    }
    for (const file of document.querySelectorAll('coords.files coord')) {
      const box = file.getBoundingClientRect();
      if (Math.abs(box.x + box.width / 2 - (board.left + (file.textContent!.charCodeAt(0) - 96.5) * board.width / 8)) > 1) errors.push(`File ${file.textContent} does not align with its column`);
    }
    const overlay = rect('.board-targets');
    if (overlay && ['x', 'y', 'width', 'height'].some(key => Math.abs(overlay[key as keyof DOMRect] as number - (board[key as keyof DOMRect] as number)) > 1)) errors.push('Selection overlay differs from the chessboard');
    for (const card of document.querySelectorAll('.hand-card img')) {
      const box = card.getBoundingClientRect();
      const player = card.closest('[data-player]')?.getAttribute('data-player');
      if (box.left < -1 || box.right > innerWidth + 1 || box.top + scrollY < -1 || box.bottom + scrollY > document.documentElement.scrollHeight + 1) errors.push(`${player} hand is clipped`);
      if (intersects(box, board)) errors.push(`${player} hand covers the board`);
    }
    const effects = rect('.effects-tray');
    if (effects && intersects(effects, board)) errors.push('Effect tray covers the board');
    return errors;
  });
  expect(issues).toEqual([]);
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

for (const [width, height] of sizes) {
  test(`Effects, role choices and reader remain reachable at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?practice=doomsayer');
    await select(page, 'Doomsayer');
    if (width <= 800) {
      await button(page, 'Read card').click();
      const reader = page.getByRole('dialog', { name: 'Doomsayer', exact: true });
      await expect(reader).toBeVisible();
      const bounds = await reader.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
      await expect(button(page, 'Close card')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(reader).toHaveCount(0);
      await expect(button(page, 'Play card')).toBeEnabled();
    }
    await button(page, 'Play card').click();
    await button(page, 'Name a piece').click();
    await geometry(page);
    await page.screenshot({ path: testInfo.outputPath('role-choices.png'), fullPage: true });
    await button(page, 'Pawn').click();
    await button(page, 'Choose a7').click();
    await geometry(page);
    await button(page, 'Name piece').click();
    await expect(page.locator('#board-position')).not.toContainText('black pawn on a7');
    await geometry(page);
  });
}

test('Keyboard opens an unavailable card reader and returns to the same draft', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/?practice=hidden-passage');
  const unavailable = page.locator('[data-player="black"] .hand-card[data-playable="false"]').first();
  await unavailable.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(button(page, 'Close card')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(unavailable).toBeFocused();
  await select(page, 'Hidden Passage');
  await button(page, 'Choose e4').click();
  await button(page, 'Read card').click();
  await page.keyboard.press('Escape');
  await expect(button(page, 'Play card')).toBeEnabled();
  await button(page, 'Play card').click();
  await expect(page.locator('#board-position')).toContainText('white king on e4');
});

test('Ordinary move hit targets follow resizing and scroll between consecutive turns', async ({ page }) => {
  await page.goto('/?practice=hidden-passage');
  const turns = [
    { width: 320, height: 568, from: 'e2', to: 'e4', piece: 'white pawn' },
    { width: 801, height: 600, from: 'e7', to: 'e5', piece: 'black pawn' },
    { width: 667, height: 375, from: 'g1', to: 'f3', piece: 'white knight' },
    { width: 390, height: 844, from: 'b8', to: 'c6', piece: 'black knight' },
  ];
  for (const turn of turns) {
    await page.setViewportSize({ width: turn.width, height: turn.height });
    await page.locator('[data-player="white"]').scrollIntoViewIfNeeded();
    await page.locator('cg-board').scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const board = (await page.locator('cg-board').boundingBox())!;
    for (const square of [turn.from, turn.to]) await page.mouse.click(
      board.x + (square.charCodeAt(0) - 96.5) * board.width / 8,
      board.y + (8.5 - Number(square[1])) * board.height / 8,
    );
    await expect(page.locator('#board-position')).toContainText(`${turn.piece} on ${turn.to}`);
    await button(page, 'End turn').click();
  }
});
