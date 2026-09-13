import { expect, test, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const position = (page: Page) => page.locator('#board-position');
async function select(page: Page, name: string, color = 'white') {
  await page.getByRole('region', { name: `${color} cards` }).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
}
async function move(page: Page, from: string, to: string, piece: string) {
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('Missing board');
  for (const square of [from, to]) await page.mouse.click(board.x + (square.charCodeAt(0) - 96.5) * board.width / 8,
    board.y + (8.5 - Number(square[1])) * board.height / 8);
  await expect(position(page)).toContainText(`${piece} on ${to}`);
}

test('Fog rollback remains consistent after both players complete replacement turns', async ({ page }) => {
  await page.goto('/?practice=fog-of-war');
  await select(page, 'Fog of War', 'black');
  await button(page, 'Play card').click();
  await expect(position(page)).toContainText('white king on e1');
  await move(page, 'e2', 'e4', 'white pawn');
  await button(page, 'End turn').click();
  await move(page, 'e7', 'e5', 'black pawn');
  await button(page, 'End turn').click();
  await move(page, 'g1', 'f3', 'white knight');
  await expect(position(page)).toContainText('white king on e1');
  await expect(position(page)).toContainText('white pawn on e4');
  await expect(position(page)).toContainText('black pawn on e5');
  await expect(page.getByRole('region', { name: 'black cards' }).getByRole('button', { name: /^Fog of War:/ })).toHaveCount(0);
  await expect(button(page, 'End turn')).toBeEnabled();
});
