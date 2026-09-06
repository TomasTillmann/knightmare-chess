import { expect, type Page, test } from '@playwright/test';

type Color = 'white' | 'black';
type Seed = {
  fen: string;
  hands: Record<Color, string[]>;
  actions?: unknown[];
  effects?: unknown[];
};

const FALSE_MATE_FEN = 'kr6/8/2K5/8/8/8/8/7R w - - 0 1';
const TRUE_MATE_FEN = 'kr6/2K5/8/8/8/8/8/7R w - - 0 1';
const hand = (page: Page, color: 'White' | 'Black') =>
  page.getByRole('region', { name: `${color} hand` });
const announcement = (page: Page) => page.getByRole('region', { name: 'Doomsayer announcement' });

async function seedGame(page: Page, seed: Seed) {
  await page.goto('/');
  await page.evaluate(async ({ seed, stateModule, reducerModule }) => {
    const { createGameState } = await import(stateModule) as {
      createGameState(options: unknown): any;
    };
    const { applyAction } = await import(reducerModule) as {
      applyAction(state: any, action: unknown): { ok: boolean; state: any; error?: { message: string } };
    };
    let state = createGameState({
      fen: seed.fen,
      hands: seed.hands,
      decks: { white: [], black: [] },
    });
    state.effects = [...(seed.effects ?? [])];
    for (const action of seed.actions ?? []) {
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

async function gameState(page: Page): Promise<any> {
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
    return structuredClone(app.memoizedState.memoizedState);
  });
}

function squareCenter(box: { x: number; y: number; width: number; height: number }, square: string) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return { x: box.x + ((file + 0.5) * box.width) / 8, y: box.y + ((7.5 - rank) * box.height) / 8 };
}

async function dragPiece(page: Page, from: string, to: string) {
  const board = page.getByTestId('chessboard');
  await board.evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }));
  const box = await board.boundingBox();
  if (!box) throw new Error('Chessboard is not visible');
  const start = squareCenter(box, from);
  const end = squareCenter(box, to);
  const viewport = page.viewportSize();
  if (!viewport || [start, end].some(({ x, y }) => x < 0 || x >= viewport.width || y < 0 || y >= viewport.height)) {
    throw new Error('Chess move coordinates are outside the viewport');
  }
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function namePiece(page: Page, role: string, pieceId: string, keyboard = false) {
  const panel = announcement(page);
  const speaker = panel.getByRole('combobox', { name: 'Speaker' });
  if (await speaker.count()) await speaker.selectOption(pieceId.startsWith('black-') ? 'black' : 'white');
  await panel.getByRole('combobox', { name: /piece name/i }).selectOption(role);
  await panel.getByRole('combobox', { name: /piece to lose/i }).selectOption(pieceId);
  const submit = panel.getByRole('button', { name: /name piece intentionally/i });
  if (keyboard) {
    await submit.focus();
    await page.keyboard.press('Enter');
  } else {
    await submit.click();
  }
}

test('immediate speech gates End turn, then keyboard resolution preserves the king escape', async ({ page }) => {
  await seedGame(page, {
    fen: FALSE_MATE_FEN,
    hands: { white: ['doomsayer'], black: [] },
  });
  await dragPiece(page, 'h1', 'a1');
  await hand(page, 'White').getByRole('button', { name: 'Doomsayer' }).click();
  await page.getByRole('button', { name: 'Play Doomsayer' }).click();

  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(endTurn).toBeDisabled();
  const pending = await gameState(page);
  await endTurn.press('Enter');
  await endTurn.press('Space');
  expect(await gameState(page)).toEqual(pending);

  await namePiece(page, 'rook', 'black-rook-b8', true);
  await expect(endTurn).toBeEnabled();
  expect((await gameState(page)).outcome).toBeNull();
  await endTurn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  await dragPiece(page, 'a8', 'b8');
  await expect.poll(async () => (await gameState(page)).turn.phase).toBe('afterMove');
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  const escaped = await gameState(page);
  expect(escaped.outcome).toBeNull();
  expect(escaped.turn).toMatchObject({ color: 'black', phase: 'afterMove', moveMade: true });
  expect(escaped.fen).toBe('1k6/8/2K5/8/8/8/8/R7 w - - 1 2');
  await expect(endTurn).toBeEnabled();
  await endTurn.click();
  await expect(page.getByText('White to move', { exact: true })).toBeVisible();
});

test('declining only closes the immediate window and preserves the later Doomsayer escape', async ({ page }) => {
  await seedGame(page, {
    fen: FALSE_MATE_FEN,
    hands: { white: ['doomsayer'], black: [] },
    actions: [
      { type: 'move', from: 'h1', to: 'a1' },
      { type: 'playCard', cardId: 'doomsayer' },
    ],
  });
  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(endTurn).toBeDisabled();
  await announcement(page).getByRole('button', { name: 'Decline immediate option' }).click();
  await expect(endTurn).toBeEnabled();
  let state = await gameState(page);
  expect(state.pendingDoomsayer).toBeNull();
  expect(state.effects).toHaveLength(1);
  await endTurn.click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
  state = await gameState(page);
  expect(state.outcome).toBeNull();
  expect(state.effects).toHaveLength(1);

  await namePiece(page, 'rook', 'black-rook-b8');
  state = await gameState(page);
  expect(state.pieces.find((candidate: any) => candidate.id === 'black-rook-b8')).toMatchObject({
    square: null, zone: 'captured',
  });
  expect(state.effects).toEqual([]);
  expect(state.players.white.discard).toEqual([{ id: 'white-hand-0-doomsayer', cardId: 'doomsayer' }]);
  expect(state.outcome).toBeNull();

  await dragPiece(page, 'a8', 'b8');
  await expect.poll(async () => (await gameState(page)).turn.phase).toBe('afterMove');
  state = await gameState(page);
  expect(state.fen).toBe('1k6/8/2K5/8/8/8/8/R7 w - - 1 2');
  expect(state.outcome).toBeNull();
});

test('declining still permits mate when the continuing effect cannot create a legal move', async ({ page }) => {
  await seedGame(page, {
    fen: TRUE_MATE_FEN,
    hands: { white: ['doomsayer'], black: [] },
    actions: [
      { type: 'move', from: 'h1', to: 'a1' },
      { type: 'playCard', cardId: 'doomsayer' },
      { type: 'declineDoomsayer', player: 'black' },
    ],
  });
  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(endTurn).toBeEnabled();
  const declined = await gameState(page);
  expect(declined.pendingDoomsayer).toBeNull();
  expect(declined.effects).toHaveLength(1);
  await endTurn.click();
  await expect(page.getByText('White wins by checkmate', { exact: true })).toBeVisible();
  const state = await gameState(page);
  expect(state.effects).toHaveLength(1);
  expect(state.players.white.discard).toEqual([]);
});

test('speech that cures staged check clears the rescue UI and unlocks End turn', async ({ page }) => {
  const oldId = 'black-effect-doomsayer';
  await seedGame(page, {
    fen: '4k3/8/8/8/8/8/P2p4/4K3 w - - 0 1',
    hands: { white: ['cowardice'], black: [] },
    effects: [{ type: 'doomsayer', owner: 'black', card: { id: oldId, cardId: 'doomsayer' } }],
  });
  await dragPiece(page, 'a2', 'a3');
  await expect(page.getByRole('status')).toContainText(/still in check.*rescue/i);

  await namePiece(page, 'pawn', 'black-pawn-d2');

  const state = await gameState(page);
  expect(state.pendingRescue).toBeNull();
  expect(state.pieces.find((candidate: any) => candidate.id === 'black-pawn-d2')).toMatchObject({
    square: null, zone: 'captured',
  });
  expect(state.players.black.discard).toEqual([{ id: oldId, cardId: 'doomsayer' }]);
  await expect(announcement(page)).toHaveCount(0);
  await expect(page.getByRole('status')).not.toContainText(/still in check|rescue card/i);
  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(endTurn).toBeEnabled();
  await endTurn.click();
  await expect(page.getByText('Black to move', { exact: true })).toBeVisible();
});

test('non-rescuing Doomsayer rollback keeps speech capture, history, and both exact discards', async ({ page }) => {
  const oldId = 'black-effect-doomsayer';
  await seedGame(page, {
    fen: 'r3k3/8/8/8/8/8/P2p4/4K3 w - - 0 1',
    hands: { white: ['cowardice', 'doomsayer'], black: [] },
    effects: [{ type: 'doomsayer', owner: 'black', card: { id: oldId, cardId: 'doomsayer' } }],
  });
  await dragPiece(page, 'a2', 'a3');
  await namePiece(page, 'rook', 'black-rook-a8');
  const doomsayer = hand(page, 'White').getByRole('button', { name: 'Doomsayer' });
  await doomsayer.click();
  await page.getByRole('button', { name: 'Play Doomsayer' }).click();

  const state = await gameState(page);
  expect(state.fen).toBe('4k3/8/8/8/8/8/P2p4/4K3 w - - 0 1');
  expect(state.pieces.find((candidate: any) => candidate.id === 'black-rook-a8')).toMatchObject({
    square: null, zone: 'captured',
  });
  expect(state.history.map((event: any) => event.type)).toEqual(['pieceNamed', 'cardFizzled']);
  expect(state.history[0]).toMatchObject({ capturedIds: ['black-rook-a8'], resolvedEffectIds: [oldId] });
  expect(state.players.black.discard).toEqual([{ id: oldId, cardId: 'doomsayer' }]);
  expect(state.players.white.discard).toEqual([{ id: 'white-hand-1-doomsayer', cardId: 'doomsayer' }]);
  expect(state.effects).toEqual([]);
  expect(state.pendingRescue).toBeNull();
  expect(state.pendingDoomsayer).toBeNull();
  await expect(announcement(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(/Doomsayer.*spent.*fizzle/i);
});

for (const fixture of [
  { context: 'before-move', key: 'Enter', width: 1024 },
  { context: 'before-move', key: 'Space', width: 1024 },
  { context: 'pending-window', key: 'Enter', width: 320 },
  { context: 'pending-window', key: 'Space', width: 320 },
] as const) {
  test(`${fixture.context} disabled Doomsayer ignores ${fixture.key} exactly like click`, async ({ page }) => {
    await page.setViewportSize({ width: fixture.width, height: 800 });
    await seedGame(page, fixture.context === 'before-move'
      ? {
          fen: FALSE_MATE_FEN,
          hands: { white: ['doomsayer'], black: [] },
        }
      : {
          fen: FALSE_MATE_FEN,
          hands: { white: ['doomsayer', 'doomsayer'], black: [] },
          actions: [
            { type: 'move', from: 'h1', to: 'a1' },
            { type: 'playCard', cardId: 'doomsayer', cardInstanceId: 'white-hand-0-doomsayer' },
          ],
        });
    const card = hand(page, 'White').getByRole('button', { name: 'Doomsayer' });
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    const before = await gameState(page);
    const message = await page.locator('.message').textContent();

    await card.click({ force: true });
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Play Doomsayer' })).toHaveCount(0);
    expect(await gameState(page)).toEqual(before);
    expect(await page.locator('.message').textContent()).toBe(message);

    await card.focus();
    await page.keyboard.press(fixture.key);
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Play Doomsayer' })).toHaveCount(0);
    expect(await gameState(page)).toEqual(before);
    expect(await page.locator('.message').textContent()).toBe(message);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(fixture.width);
  });
}
