import { expect, type Locator, type Page, test } from '@playwright/test';

type Seed = {
  fen: string;
  hands: { white: string[]; black: string[] };
  neutral?: string[];
  orientation?: number;
  actions: unknown[];
};

const hand = (page: Page, color: 'White' | 'Black') =>
  page.getByRole('region', { name: `${color} hand` });

async function seedGame(page: Page, seed: Seed) {
  await page.goto('/');
  await page.evaluate(async ({ seed, stateModule, reducerModule }) => {
    const { createGameState } = await import(stateModule) as {
      createGameState(options: unknown): any;
    };
    const { applyAction } = await import(reducerModule) as {
      applyAction(state: any, action: unknown): { ok: boolean; state?: any; error?: { message: string } };
    };
    let state = createGameState({
      fen: seed.fen,
      hands: seed.hands,
      decks: { white: [], black: [] },
    });
    if (seed.orientation !== undefined) state.orientation = seed.orientation;
    for (const square of seed.neutral ?? []) {
      state.pieces.find((piece: any) => piece.square === square).neutral = true;
    }
    for (const action of seed.actions) {
      const result = applyAction(state, action);
      if (!result.ok) throw new Error(result.error?.message ?? 'Seed action failed');
      state = result.state;
    }

    const root = document.querySelector('#root') as HTMLElement;
    const key = Object.keys(root).find(name => name.startsWith('__reactContainer'))!;
    let app: any;
    const visit = (fiber: any) => {
      if (!fiber || app) return;
      if (fiber.memoizedState?.memoizedState?.pieces) app = fiber;
      visit(fiber.child);
      visit(fiber.sibling);
    };
    const container = (root as any)[key];
    visit(container);
    visit(container.alternate);
    if (!app) throw new Error('Mounted game state was not found');
    app.memoizedState.queue.dispatch(state);
  }, { seed, stateModule: '/src/game/state.ts', reducerModule: '/src/game/reducer.ts' });
}

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

async function gameStateJson(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#root') as HTMLElement;
    const key = Object.keys(root).find(name => name.startsWith('__reactContainer'))!;
    let app: any;
    const visit = (fiber: any) => {
      if (!fiber || app) return;
      if (fiber.memoizedState?.memoizedState?.pieces) app = fiber;
      visit(fiber.child);
      visit(fiber.sibling);
    };
    const container = (root as any)[key];
    visit(container);
    visit(container.alternate);
    if (!app) throw new Error('Mounted game state was not found');
    return JSON.stringify(app.memoizedState.memoizedState);
  });
}

async function pieceOccupiesSquare(board: Locator, selector: string, square: string) {
  const point = await squareCenter(board, square);
  return board.locator(selector).evaluateAll((pieces, target) => pieces.some(piece => {
    const box = piece.getBoundingClientRect();
    return target.x >= box.left && target.x <= box.right && target.y >= box.top && target.y <= box.bottom;
  }), point);
}

test('allows No Quarter after a neutral en-passant capture', async ({ page }) => {
  await seedGame(page, {
    fen: '7k/4p3/8/3P4/8/8/8/K7 w - - 0 1',
    hands: { white: ['annexation'], black: ['no-quarter'] },
    neutral: ['e7', 'd5'],
    actions: [
      { type: 'playCard', cardId: 'annexation', target: [{ from: 'e7', to: 'e5' }] },
      { type: 'endTurn' },
      { type: 'move', from: 'd5', to: 'e6' },
    ],
  });

  const card = hand(page, 'Black').getByRole('button', { name: 'No Quarter' });
  await expect(card).toBeEnabled();
  await card.click();
  await page.getByRole('button', { name: 'Play No Quarter' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(/No Quarter.*captured piece.*dead/i);
});

test('requires and completes an after-move rescue before ending the turn', async ({ page }) => {
  await seedGame(page, {
    fen: '4r2k/8/8/8/3p4/8/4B3/4K3 w - - 0 1',
    hands: { white: ['cowardice'], black: [] },
    orientation: 90,
    actions: [],
  });
  await dragPiece(page, 'e2', 'f3');

  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(page.getByRole('status')).toHaveText(
    'Your King is still in check. Play a rescue card before ending the turn.',
  );
  await expect(endTurn).toBeDisabled();

  const card = hand(page, 'White').getByRole('button', { name: 'Cowardice' });
  await card.click();
  await clickSquare(page, 'd4');
  await clickSquare(page, 'e4');
  await page.getByRole('button', { name: 'Play Cowardice' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Cowardice moved');
  await expect(endTurn).toBeEnabled();
  await endTurn.click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
});

test('promotes a rotated pawn on its orientation-specific last line', async ({ page }) => {
  await seedGame(page, {
    fen: 'k7/8/8/8/6P1/8/8/K7 w - - 0 1',
    hands: { white: [], black: [] },
    orientation: 90,
    actions: [],
  });

  const promotion = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.message()).toMatch(/promot/i);
    await dialog.accept('queen');
  });
  await dragPiece(page, 'g4', 'h4');
  await promotion;

  const board = page.getByTestId('chessboard');
  const point = await squareCenter(board, 'h4');
  await expect.poll(async () => board.locator('piece.white.queen').evaluateAll((pieces, target) =>
    pieces.some(piece => {
      const box = piece.getBoundingClientRect();
      return target.x >= box.left && target.x <= box.right && target.y >= box.top && target.y <= box.bottom;
    }), point)).toBe(true);
});

test('canceling promotion leaves the game unchanged and permits a valid retry', async ({ page }) => {
  await seedGame(page, {
    fen: 'k7/8/8/8/6P1/8/8/K7 w - - 0 1',
    hands: { white: ['disintegration'], black: [] },
    orientation: 90,
    actions: [],
  });

  const board = page.getByTestId('chessboard');
  const card = hand(page, 'White').getByRole('button', { name: 'Disintegration' });
  const before = await gameStateJson(page);

  const canceled = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
  await dragPiece(page, 'g4', 'h4');
  await canceled;

  await expect.poll(() => gameStateJson(page)).toBe(before);
  await expect(board.locator('square.last-move')).toHaveCount(0);
  await expect.poll(() => pieceOccupiesSquare(board, 'piece.white.pawn', 'g4')).toBe(true);
  await expect(page.getByText('White to move', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End turn' })).toBeDisabled();
  await expect(card).toBeEnabled();

  const promoted = page.waitForEvent('dialog').then(dialog => dialog.accept('queen'));
  await dragPiece(page, 'g4', 'h4');
  await promoted;
  await expect.poll(() => pieceOccupiesSquare(board, 'piece.white.queen', 'h4')).toBe(true);
});
