import { expect, test, type Page } from '@playwright/test';
import { assertConsistent, initialize } from './support/selfPlay.js';

const position = (page: Page) => page.locator('#board-position');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function point(page: Page, square: string) {
  await page.locator('cg-board').scrollIntoViewIfNeeded();
  const board = await page.locator('cg-board').boundingBox();
  if (!board) throw new Error('The chessboard is missing.');
  return {
    x: board.x + (square.charCodeAt(0) - 97 + .5) * board.width / 8,
    y: board.y + (8.5 - Number(square[1])) * board.height / 8,
  };
}

async function tapMove(page: Page, from: string, to: string) {
  for (const square of [from, to]) {
    const { x, y } = await point(page, square);
    await page.touchscreen.tap(x, y);
  }
}

async function drag(page: Page, from: string, to: string) {
  const start = await point(page, from);
  const end = await point(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

test('touch plays a card and both sides keep moving after resize and scroll', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch input is covered by the mobile project.');
  await page.goto('/?practice=hidden-passage');
  await page.getByRole('region', { name: 'white cards' }).getByRole('button', { name: /^Hidden Passage:/ }).tap({ position: { x: 18, y: 50 } });
  await button(page, 'Choose e4').tap();
  await button(page, 'Play card').tap();
  await expect(position(page)).toContainText('white king on e4');
  await button(page, 'End turn').tap();
  await tapMove(page, 'e7', 'e5');
  await expect(position(page)).toContainText('black pawn on e5');
  await button(page, 'End turn').tap();
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByRole('region', { name: 'white cards' }).scrollIntoViewIfNeeded();
  await tapMove(page, 'b1', 'c3');
  await expect(position(page)).toContainText('white knight on c3');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-orientation', 'white');
});

test('mouse dragging moves both sides and rejects an illegal destination', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse dragging is covered by the desktop project.');
  const initial = await initialize(page);
  await drag(page, 'e2', 'e5');
  await assertConsistent(page, initial);
  await drag(page, 'e2', 'e4');
  await expect(position(page)).toContainText('white pawn on e4');
  await button(page, 'End turn').click();
  await drag(page, 'e7', 'e5');
  await expect(position(page)).toContainText('black pawn on e5');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-orientation', 'white');
});
