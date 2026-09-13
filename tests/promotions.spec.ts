import { expect, test, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const position = (page: Page) => page.locator('#board-position');
const promoted = (page: Page) => page.locator('.effect-entry[data-effect="piece-status"]');

async function select(page: Page, name: string) {
  await page.getByRole('region', { name: 'white cards' }).getByRole('button', { name: new RegExp(`^${name}:`) })
    .click({ position: { x: 18, y: 50 } });
}

async function move(page: Page, from: string, to: string) {
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('The chessboard is missing.');
  for (const square of [from, to]) await page.mouse.click(
    board.x + (square.charCodeAt(0) - 97 + .5) * board.width / 8,
    board.y + (8.5 - Number(square[1])) * board.height / 8);
}

test.describe('Promotion choices', () => {
  test('ordinary Pawn can become a Knight', async ({ page }) => {
    await page.goto('/?variant=promotion');
    await move(page, 'e7', 'e8');
    await expect(page.locator('.choice-options button')).toHaveCount(4);
    await button(page, 'Knight · Move without capturing').click();
    await button(page, 'Move').click();
    await expect(position(page)).toContainText('white knight on e8');
    await expect(position(page)).not.toContainText('white pawn on e7');
    await expect(promoted(page)).toHaveCount(1);
  });

  test('Crab promotes after moving diagonally onto its last rank', async ({ page }) => {
    await page.goto('/?practice=crab&variant=crab-promotion');
    await expect(page.locator('.effect-entry[data-effect="crab"]')).toHaveCount(1);
    await move(page, 'e7', 'd8');
    await expect(page.locator('.choice-options button')).toHaveCount(4);
    await button(page, 'Bishop · Move without capturing').click();
    await button(page, 'Move').click();
    await expect(position(page)).toContainText('white bishop on d8');
    await expect(position(page)).not.toContainText('white pawn on e7');
    await expect(promoted(page)).toHaveCount(1);
    await expect(page.locator('.effect-entry[data-effect="crab"]')).toHaveCount(0);
  });

  test('Earthquake promotes the opponent before the acting player', async ({ page }) => {
    await page.goto('/?practice=earthquake&variant=earthquake-promotion');
    await select(page, 'Earthquake');
    await button(page, 'Counterclockwise').click();
    await expect(button(page, 'h4 → Knight')).toHaveCount(0);
    await button(page, 'a6 → Bishop').click();
    await button(page, 'h4 → Knight').click();
    await button(page, 'Play card').click();
    await expect(position(page)).toContainText('black bishop on a6');
    await expect(position(page)).toContainText('white knight on h4');
    await expect(promoted(page)).toHaveCount(2);
    await expect(page.locator('.effect-entry[data-effect="earthquake"]')).toHaveCount(1);
    await expect(page.locator('.effect-orientation')).toHaveText('Pawns: White right · Black left');
  });

  test('Figure Dance promotes the acting player before the opponent', async ({ page }) => {
    await page.goto('/?practice=figure-dance&variant=figure-dance-promotion');
    await select(page, 'Figure Dance');
    await expect(button(page, 'a1 → Knight')).toHaveCount(0);
    await button(page, 'h8 → Rook').click();
    await button(page, 'a1 → Knight').click();
    await button(page, 'Play card').click();
    await expect(position(page)).toContainText('white rook on h8');
    await expect(position(page)).toContainText('black knight on a1');
    await expect(position(page)).not.toContainText('white pawn on h1');
    await expect(position(page)).not.toContainText('black pawn on a8');
    await expect(promoted(page)).toHaveCount(2);
  });

  test('Peace Talks reverses Earthquake and promotes a newly eligible Pawn', async ({ page }) => {
    await page.goto('/?practice=peace-talks&variant=peace-talks-promotion');
    await expect(page.locator('.effect-entry[data-effect="earthquake"]')).toHaveCount(1);
    await expect(position(page)).toContainText('white pawn on c8');
    await select(page, 'Peace Talks');
    await button(page, 'Earthquake').click();
    await button(page, 'c8 → Bishop').click();
    await button(page, 'Play card').click();
    await expect(position(page)).toContainText('white bishop on c8');
    await expect(position(page)).not.toContainText('white pawn on c8');
    await expect(promoted(page)).toHaveCount(1);
    await expect(page.locator('.effect-entry[data-effect="earthquake"]')).toHaveCount(0);
    await expect(page.locator('.effect-orientation')).toHaveCount(0);
  });
});
