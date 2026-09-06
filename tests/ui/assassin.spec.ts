import { expect, type Locator, type Page, test } from '@playwright/test';

const description = 'Move one of your pieces and capture another of your own pieces with it.';
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

async function hasPiece(board: Locator, color: 'white' | 'black', role: string, square: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator(`piece.${color}.${role}`).evaluateAll(pieces => pieces.map(piece => {
    const box = piece.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

async function isLastMoveSquare(board: Locator, square: string) {
  const point = await squareCenter(board, square);
  return board.locator('square.last-move').evaluateAll((nodes, target) => nodes.some(node => {
    const box = node.getBoundingClientRect();
    return target.x >= box.left && target.x <= box.right && target.y >= box.top && target.y <= box.bottom;
  }), point);
}

async function expectLastMove(board: Locator, ...squares: string[]) {
  await expect(board.locator('square.last-move')).toHaveCount(squares.length);
  for (const square of squares) await expect.poll(() => isLastMoveSquare(board, square)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows Assassin in both hands and previews its complete printed card', async ({ page }) => {
  const whiteCard = hand(page, 'White').getByRole('button', { name: 'Assassin' });
  const blackCard = hand(page, 'Black').getByRole('button', { name: 'Assassin' });
  await expect(whiteCard).toBeVisible();
  await expect(whiteCard).toBeEnabled();
  await expect(blackCard).toBeVisible();
  await expect(blackCard).toBeDisabled();

  await whiteCard.focus();
  const details = page.getByRole('region', { name: 'Card details' });
  await expect(details.getByRole('img', { name: 'Assassin card' })).toHaveAttribute('src', /KC1_card1\.png$/);
  await expect(details.getByRole('heading', { name: 'Assassin' })).toBeVisible();
  await expect(details.getByText('2 points', { exact: true })).toBeVisible();
  await expect(details.getByText(description, { exact: true })).toBeVisible();
  await expect(details.getByText('Play instead of your move', { exact: true })).toBeVisible();
});

test('cancels a selected attacker and rejects an empty capture target atomically', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Assassin' });
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');

  await clickSquare(page, 'b1');
  await clickSquare(page, 'b1');
  await expect(page.getByRole('status')).toContainText('selection canceled');

  await clickSquare(page, 'b1');
  await clickSquare(page, 'c3');
  await expect(page.getByRole('alert')).toContainText(/capture|control/i);
  await expect(card).toBeVisible();
  await expect.poll(() => hasPiece(board, 'white', 'knight', 'b1')).toBe(true);
  await expect.poll(() => hasPiece(board, 'white', 'pawn', 'd2')).toBe(true);
  await expect(board.locator('square.last-move')).toHaveCount(0);
});

test('captures the exact friendly piece and records the board, highlight, and card lifecycle', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const whiteHand = hand(page, 'White');
  const blackHand = hand(page, 'Black');
  const card = whiteHand.getByRole('button', { name: 'Assassin' });
  const blackCard = blackHand.getByRole('button', { name: 'Assassin' });
  const handCount = await whiteHand.getByRole('button').count();
  const blackHandCount = await blackHand.getByRole('button').count();

  await card.click();
  await clickSquare(page, 'b1');
  await clickSquare(page, 'd2');
  await page.getByRole('button', { name: 'Play Assassin' }).click();

  await expect(page.getByRole('status')).toContainText(/Assassin.*captur/i);
  await expect(card).toHaveCount(0);
  await expect(whiteHand.getByRole('button')).toHaveCount(handCount - 1);
  await expect(blackCard).toBeDisabled();
  await expect(board.locator('piece.white.pawn')).toHaveCount(7);
  await expect(board.locator('piece.white.knight')).toHaveCount(2);
  await expect.poll(() => hasPiece(board, 'white', 'knight', 'd2')).toBe(true);
  await expect.poll(() => hasPiece(board, 'white', 'knight', 'b1')).toBe(false);
  await expect.poll(() => hasPiece(board, 'white', 'pawn', 'd2')).toBe(false);
  await expectLastMove(board, 'b1', 'd2');
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End turn' })).toBeEnabled();

  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  await expect(blackCard).toBeEnabled();

  await blackCard.click();
  await clickSquare(page, 'b8');
  await clickSquare(page, 'd7');
  await page.getByRole('button', { name: 'Play Assassin' }).click();

  await expect(page.getByRole('status')).toContainText(/Assassin.*captur/i);
  await expect(blackCard).toHaveCount(0);
  await expect(blackHand.getByRole('button')).toHaveCount(blackHandCount - 1);
  await expect(board.locator('piece.black.pawn')).toHaveCount(7);
  await expect(board.locator('piece.black.knight')).toHaveCount(2);
  await expect.poll(() => hasPiece(board, 'black', 'knight', 'd7')).toBe(true);
  await expect.poll(() => hasPiece(board, 'black', 'knight', 'b8')).toBe(false);
  await expect.poll(() => hasPiece(board, 'black', 'pawn', 'd7')).toBe(false);
  await expectLastMove(board, 'b8', 'd7');
  await expect(page.getByText('after move', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End turn' })).toBeEnabled();

  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByText('White to move', { exact: true })).toBeVisible();
});

test('supports keyboard card selection and an accessible target chooser', async ({ page }) => {
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Assassin' });
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');

  const summary = page.getByText('Keyboard controls', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('combobox', { name: /Piece source|Attacker source/i }).selectOption('g1');
  await page.getByRole('combobox', { name: /Capture target|Piece destination/i }).selectOption('e2');
  await page.getByRole('button', { name: 'Add move' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Play Assassin' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status')).toContainText(/Assassin.*captur/i);
  await expect.poll(() => hasPiece(board, 'white', 'knight', 'e2')).toBe(true);
  await expect.poll(() => hasPiece(board, 'white', 'knight', 'g1')).toBe(false);
  await expect.poll(() => hasPiece(board, 'white', 'pawn', 'e2')).toBe(false);
  await expectLastMove(board, 'g1', 'e2');
});

test('keeps Assassin usable in the compact self-play layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Assassin' });
  await expect(board).toBeVisible();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('flex-shrink', '0');

  await card.click();
  await clickSquare(page, 'b1');
  await clickSquare(page, 'd2');
  await expect(page.getByRole('button', { name: 'Play Assassin' })).toBeVisible();
});
