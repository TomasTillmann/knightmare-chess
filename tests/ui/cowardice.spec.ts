import { expect, type Locator, type Page, test } from '@playwright/test';

const description = "Move one of your opponent's Pawns one or two squares backward. It may not enter or cross an occupied square.";
const hand = (page: Page, color: 'White' | 'Black') =>
  page.getByRole('region', { name: `${color} hand` });

async function squareCenter(board: Locator, square: string) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Chessboard is not visible');
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return { x: box.x + ((file + 0.5) * box.width) / 8, y: box.y + ((7.5 - rank) * box.height) / 8 };
}

async function clickSquare(page: Page, square: string) {
  const point = await squareCenter(page.getByTestId('chessboard'), square);
  await page.mouse.click(point.x, point.y);
}

async function dragPiece(page: Page, from: string, to: string) {
  const board = page.getByTestId('chessboard');
  const start = await squareCenter(board, from);
  const end = await squareCenter(board, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function hasBlackPawn(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator('piece.black.pawn').evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

async function finishMove(page: Page, from: string, to: string) {
  await dragPiece(page, from, to);
  await page.getByRole('button', { name: 'End turn' }).click();
}

async function prepareBackwardTarget(page: Page) {
  await finishMove(page, 'g1', 'f3');
  await finishMove(page, 'b8', 'c6');
  await dragPiece(page, 'a2', 'a3');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews Cowardice artwork, metadata, and after-move timing', async ({ page }) => {
  const card = hand(page, 'White').getByRole('button', { name: 'Cowardice' });
  await expect(card).toBeDisabled();
  await expect(hand(page, 'Black').getByRole('button', { name: 'Cowardice' })).toBeDisabled();

  await dragPiece(page, 'e2', 'e4');
  await expect(card).toBeEnabled();
  await card.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Cowardice card' })).toHaveAttribute('src', /KC4_card3\.png$/);
  await expect(details.getByRole('heading', { name: 'Cowardice' })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('4 points', { exact: true })).toBeVisible();
  await expect(details.getByText('Play after your move', { exact: true })).toBeVisible();
});

test('moves an opposing Pawn backward through the board flow and ends the turn', async ({ page }) => {
  await prepareBackwardTarget(page);
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Cowardice' });
  await card.click();
  await clickSquare(page, 'b7');
  await clickSquare(page, 'b8');
  await page.getByRole('button', { name: 'Play Cowardice' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Cowardice moved');
  await expect.poll(() => hasBlackPawn(board, 'b8')).toBe(true);
  await expect.poll(() => hasBlackPawn(board, 'b7')).toBe(false);
  await expect(page.getByText('after move', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
});

test('reports a wrong target, cancels selection, and supports keyboard controls', async ({ page }) => {
  await prepareBackwardTarget(page);
  const board = page.getByTestId('chessboard');
  await hand(page, 'White').getByRole('button', { name: 'Cowardice' }).click();

  await clickSquare(page, 'a3');
  await expect(page.getByRole('alert')).toContainText('opponent');
  await clickSquare(page, 'b7');
  await clickSquare(page, 'b7');
  await expect(page.getByRole('status')).toContainText('selection canceled');

  await page.getByText('Keyboard controls', { exact: true }).click();
  await page.getByRole('combobox', { name: /Pawn source/ }).selectOption('b7');
  await page.getByRole('combobox', { name: /Pawn destination/ }).selectOption('b8');
  await page.getByRole('button', { name: 'Add move' }).click();
  await page.getByRole('button', { name: 'Play Cowardice' }).click();

  await expect(page.getByRole('status')).toContainText('Cowardice moved');
  await expect.poll(() => hasBlackPawn(board, 'b8')).toBe(true);
  await expect.poll(() => hasBlackPawn(board, 'b7')).toBe(false);
});
