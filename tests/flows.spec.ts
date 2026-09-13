import { expect, test, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const hand = (page: Page, color = 'white') => page.getByRole('region', { name: `${color} cards` });
const setup = (page: Page, card: string) => page.goto(`/?practice=${card}`);
const play = (page: Page) => button(page, 'Play card').click();
const end = (page: Page) => button(page, 'End turn').click();
const position = (page: Page) => page.locator('#board-position');

async function select(page: Page, name: string, color = 'white') {
  await hand(page, color).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
}

async function pick(page: Page, ...squares: string[]) {
  for (const square of squares) await button(page, `Choose ${square}`).click();
}

async function move(page: Page, from: string, to: string, resultingPiece: string) {
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('The chessboard is missing.');
  for (const square of [from, to]) await page.mouse.click(
    board.x + (square.charCodeAt(0) - 97 + .5) * board.width / 8,
    board.y + (8.5 - Number(square[1])) * board.height / 8);
  await expect(position(page)).toContainText(`${resultingPiece} on ${to}`);
}

test('Hidden Passage cancels, commits, replenishes and resets', async ({ page }) => {
  await setup(page, 'hidden-passage');
  await select(page, 'Hidden Passage');
  await pick(page, 'e4');
  await button(page, 'Back').click();
  await expect(button(page, 'Play card')).toBeDisabled();
  await button(page, 'Cancel').click();
  await expect(position(page)).toContainText('white king on e1');
  await select(page, 'Hidden Passage');
  await pick(page, 'e4');
  await play(page);
  await expect(position(page)).toContainText('white king on e4');
  await expect(hand(page).getByRole('button', { name: /^Hidden Passage:/ })).toHaveCount(0);
  await expect(hand(page).getByRole('button')).toHaveCount(5);
  await end(page);
  await move(page, 'e7', 'e5', 'black pawn');
  await end(page);
  await page.reload();
  await expect(position(page)).toContainText('white king on e1');
  await expect(position(page)).toContainText('black pawn on e7');
});

test('Forced March allows one Pawn or two Pawns selected in either order', async ({ page }) => {
  await setup(page, 'forced-march');
  await select(page, 'Forced March');
  await pick(page, 'e3', 'f3');
  await expect(button(page, 'Play card')).toBeEnabled();
  await play(page);
  await expect(position(page)).toContainText('white pawn on f3');
  await expect(position(page)).toContainText('white pawn on d2');
  await expect(position(page)).not.toContainText('white pawn on e3');

  await setup(page, 'forced-march');
  await select(page, 'Forced March');
  await pick(page, 'e3', 'f3', 'd2', 'e2');
  await play(page);
  await expect(position(page)).toContainText('white pawn on f3');
  await expect(position(page)).toContainText('white pawn on e2');
  await expect(position(page)).not.toContainText('white pawn on d2');
  await expect(button(page, 'End turn')).toBeEnabled();
});

test('Resurrection returns the captured physical Pawn to its home square', async ({ page }) => {
  await setup(page, 'resurrection');
  await expect(page.locator('#off-board-position')).toContainText('white pawn captured');
  await select(page, 'Resurrection');
  await button(page, 'Pawn').click();
  await pick(page, 'e2');
  await play(page);
  await expect(position(page)).toContainText('white pawn on e2');
  await expect(page.locator('#off-board-position')).not.toContainText('white pawn captured');
  await expect(hand(page).getByRole('button', { name: /^Resurrection:/ })).toHaveCount(0);
});

test('Mystic Shield survives the opponent move and expires at the end of that turn', async ({ page }) => {
  await setup(page, 'mystic-shield');
  await select(page, 'Mystic Shield');
  await pick(page, 'e4');
  await play(page);
  const shield = page.locator('.piece-effect[data-effect="mystic-shield"]');
  await expect(shield).toHaveCount(1);
  await end(page);
  await expect(shield).toHaveCount(1);
  await move(page, 'd7', 'd5', 'black pawn');
  await expect(shield).toHaveCount(1);
  await end(page);
  await expect(shield).toHaveCount(0);
});

test('Curse persists across turns and Peace Talks removes it', async ({ page }) => {
  await setup(page, 'curse');
  await select(page, 'Curse');
  await pick(page, 'd8');
  await play(page);
  const curse = page.locator('.piece-effect[data-effect="curse"]');
  await expect(curse).toHaveCount(1);
  await end(page);
  await move(page, 'd7', 'd5', 'black pawn');
  await end(page);
  await expect(curse).toHaveCount(1);

  await setup(page, 'peace-talks');
  await expect(curse).toHaveCount(1);
  await select(page, 'Peace Talks', 'black');
  await button(page, 'Curse').click();
  await play(page);
  await expect(curse).toHaveCount(0);
  await expect(page.locator('.effects-tray')).toHaveCount(0);
});

test('Fog of War restores the King and allows a replacement regular move', async ({ page }) => {
  await setup(page, 'fog-of-war');
  await expect(position(page)).toContainText('white king on e4');
  await select(page, 'Fog of War', 'black');
  await play(page);
  await expect(position(page)).toContainText('white king on e1');
  await expect(position(page)).not.toContainText('white king on e4');
  await expect(hand(page, 'black').getByRole('button', { name: /^Fog of War:/ })).toHaveCount(0);
  await move(page, 'b1', 'c3', 'white knight');
  await expect(button(page, 'End turn')).toBeEnabled();
});
