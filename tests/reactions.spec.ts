import { expect, test, type Page } from '@playwright/test';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const hand = (page: Page, color: string) => page.getByRole('region', { name: `${color} cards` });
const position = (page: Page) => page.locator('#board-position');
const play = (page: Page) => button(page, 'Play card').click();

async function select(page: Page, name: string, color = 'white') {
  await hand(page, color).getByRole('button', { name: new RegExp(`^${name}:`) }).click({ position: { x: 18, y: 50 } });
}

async function move(page: Page, from: string, to: string, piece: string) {
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('The chessboard is missing.');
  for (const square of [from, to]) await page.mouse.click(
    board.x + (square.charCodeAt(0) - 97 + .5) * board.width / 8,
    board.y + (8.5 - Number(square[1])) * board.height / 8);
  await expect(position(page)).toContainText(`${piece} on ${to}`);
}

test('Chaos offers both returning and leaving the canceled movement card', async ({ page }) => {
  for (const takeBack of [true, false]) {
    await page.goto('/?practice=chaos');
    await button(page, 'End turn').click();
    await move(page, 'g8', 'f6', 'black knight');
    await button(page, 'End turn').click();
    await select(page, 'Hidden Passage');
    await button(page, 'Choose e3').click();
    await play(page);
    await expect(position(page)).toContainText('white king on e3');
    await select(page, 'Chaos', 'black');
    await expect(button(page, 'Take the card back')).toBeVisible();
    await expect(button(page, 'Leave the card played')).toBeVisible();
    await button(page, takeBack ? 'Take the card back' : 'Leave the card played').click();
    await play(page);
    await expect(position(page)).toContainText('white king on e1');
    await expect(position(page)).not.toContainText('white king on e3');
    await expect(hand(page, 'white').getByRole('button', { name: /^Hidden Passage:/ })).toHaveCount(takeBack ? 1 : 0);
    await expect(hand(page, 'black').getByRole('button', { name: /^Chaos:/ })).toHaveCount(0);
  }
});

test('Vulture puts the just-played card in the reacting hand', async ({ page }) => {
  await page.goto('/?practice=vulture');
  await expect(position(page)).toContainText('white king on e4');
  await select(page, 'Vulture', 'black');
  await play(page);
  await expect(hand(page, 'black').getByRole('button', { name: /^Hidden Passage:/ })).toHaveCount(1);
  await expect(hand(page, 'black').getByRole('button', { name: /^Vulture:/ })).toHaveCount(0);
  await expect(position(page)).toContainText('white king on e4');
});

test('Haunting Memories copies Disintegration while spending its own card', async ({ page }) => {
  await page.goto('/?practice=haunting-memories');
  await expect(page.locator('#off-board-position')).toContainText('black pawn dead');
  await select(page, 'Haunting Memories');
  await expect(hand(page, 'white').getByRole('button', { name: /^Haunting Memories:/ })).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Choose a2').click();
  await play(page);
  await expect(position(page)).not.toContainText('white pawn on a2');
  await expect(page.locator('#off-board-position')).toContainText('white pawn dead');
  await expect(page.locator('#off-board-position')).toContainText('black pawn dead');
  await expect(hand(page, 'white').getByRole('button', { name: /^Haunting Memories:/ })).toHaveCount(0);
  await expect(hand(page, 'white').getByRole('button', { name: /^Disintegration:/ })).toHaveCount(1);
  await move(page, 'g1', 'f3', 'white knight');
});

test('Guardian can leave the follower behind or bring it with the Pawn', async ({ page }) => {
  for (const follow of [false, true]) {
    await page.goto('/?practice=guardian');
    await select(page, 'Guardian');
    await button(page, 'Choose a2').click();
    await button(page, 'Choose a4').click();
    await expect(button(page, 'Play card')).toBeEnabled();
    await expect(button(page, 'Follow from a1 to a3')).toBeVisible();
    if (follow) await button(page, 'Follow from a1 to a3').click();
    await play(page);
    await expect(position(page)).toContainText('white pawn on a4');
    await expect(position(page)).toContainText(`white rook on ${follow ? 'a3' : 'a1'}`);
    await expect(position(page)).not.toContainText(`white rook on ${follow ? 'a1' : 'a3'}`);
    await expect(button(page, 'End turn')).toBeEnabled();
  }
});
