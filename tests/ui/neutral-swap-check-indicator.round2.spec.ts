import { expect, type Locator, type Page, test } from '@playwright/test';

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

async function hasAt(board: Locator, square: string, selector: string) {
  const point = await squareCenter(board, square);
  const boxes = await board.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  return boxes.some(box => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
}

type SeedOptions = {
  fen: string;
  hands?: { white: string[]; black: string[] };
  patches?: Record<string, { neutral?: boolean; royal?: boolean }>;
};

async function seedGame(page: Page, options: SeedOptions) {
  await page.goto('/');
  await page.evaluate(async ({ stateModule, options }) => {
    type SeedState = {
      pieces: Array<{ square: string | null; neutral: boolean; royal: boolean }>;
    };
    const { createGameState } = await import(stateModule) as {
      createGameState(options: unknown): SeedState;
    };
    const state = createGameState(options);
    for (const [square, patch] of Object.entries(options.patches ?? {})) {
      Object.assign(state.pieces.find(piece => piece.square === square)!, patch);
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
  }, { stateModule: '/src/game/state.ts', options });
}

test('Holy War visibly marks the royal checked by a neutral Bishop', async ({ page }) => {
  await seedGame(page, {
    fen: 'r6k/6N1/8/8/8/8/7P/b3K3 w - - 0 1',
    hands: { white: ['holy-war'], black: [] },
    patches: { a1: { neutral: true } },
  });
  const board = page.getByTestId('chessboard');
  await expect.poll(() => hasAt(board, 'a1', 'piece.black.bishop')).toBe(true);

  await dragPiece(page, 'h2', 'h3');
  await page.getByRole('region', { name: 'White hand' }).getByRole('button', { name: 'Holy War' }).click();
  await clickSquare(page, 'g7');
  await clickSquare(page, 'a1');
  await expect(page.getByRole('status')).toHaveText('Holy War swapped g7 and a1.');
  await expect.poll(() => hasAt(board, 'g7', 'piece.black.bishop')).toBe(true);

  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  await expect.poll(() => hasAt(board, 'h8', 'square.check')).toBe(true);
});

for (const interaction of ['click', 'drag'] as const) {
  test(`an opponent-colored neutral piece moves by ${interaction} while a non-neutral opponent piece stays blocked`, async ({ page }) => {
    await seedGame(page, {
      fen: '7k/8/8/8/8/8/4n2n/K7 w - - 0 1',
      patches: { e2: { neutral: true } },
    });
    const board = page.getByTestId('chessboard');

    await dragPiece(page, 'h2', 'f3');
    await expect.poll(() => hasAt(board, 'h2', 'piece.black.knight')).toBe(true);
    await expect.poll(() => hasAt(board, 'f3', 'piece.black.knight')).toBe(false);

    if (interaction === 'click') {
      await clickSquare(page, 'e2');
      await clickSquare(page, 'c3');
    } else {
      await dragPiece(page, 'e2', 'c3');
    }
    await expect.poll(() => hasAt(board, 'c3', 'piece.black.knight')).toBe(true);
    await expect.poll(() => hasAt(board, 'e2', 'piece.black.knight')).toBe(false);
  });
}

test('Coup check highlighting marks the actual royal instead of the Prince', async ({ page }) => {
  await seedGame(page, {
    fen: '1r5k/8/8/8/8/8/1P6/4K3 w - - 0 1',
    patches: { e1: { royal: false }, b2: { royal: true } },
  });
  const board = page.getByTestId('chessboard');

  await expect.poll(() => hasAt(board, 'b2', 'square.check')).toBe(true);
  await expect.poll(() => hasAt(board, 'e1', 'square.check')).toBe(false);
});
