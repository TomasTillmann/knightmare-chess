import { expect, type Locator, type Page, test } from '@playwright/test';

type Color = 'white' | 'black';
type Seed = {
  fen: string;
  hands: Record<Color, string[]>;
  actions?: unknown[];
};

const START_WHITE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const START_BLACK = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
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
      applyAction(state: any, action: unknown): { ok: boolean; state?: any; error?: { message: string } };
    };
    let state = createGameState({
      fen: seed.fen,
      hands: seed.hands,
      decks: { white: [], black: [] },
    });
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

async function squareCenter(board: Locator, square: string) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Chessboard is not visible');
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return { x: box.x + ((file + 0.5) * box.width) / 8, y: box.y + ((7.5 - rank) * box.height) / 8 };
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

async function seedLaterSpeech(
  page: Page,
  turn: Color,
) {
  const caster: Color = turn === 'white' ? 'black' : 'white';
  const move = caster === 'white'
    ? { type: 'move', from: 'e2', to: 'e4' }
    : { type: 'move', from: 'e7', to: 'e5' };
  const actions: unknown[] = [move, { type: 'playCard', cardId: 'doomsayer' }];
  actions.push({ type: 'declineDoomsayer', player: turn });
  actions.push({ type: 'endTurn' });
  await seedGame(page, {
    fen: caster === 'white' ? START_WHITE : START_BLACK,
    hands: {
      white: caster === 'white' ? ['doomsayer'] : [],
      black: caster === 'black' ? ['doomsayer'] : [],
    },
    actions,
  });
  await expect(page.getByText(`${turn === 'white' ? 'White' : 'Black'} to move`, { exact: true })).toBeVisible();
}

async function recordKnightSpeech(page: Page, speaker: Color, square: 'b1' | 'b8') {
  const panel = announcement(page);
  const speakerSelect = panel.getByRole('combobox', { name: /speaker/i });
  await expect(speakerSelect).toBeVisible({ timeout: 1_000 });
  await speakerSelect.selectOption(speaker);
  await panel.getByRole('combobox', { name: /piece (name|type)/i }).selectOption('knight');

  const victimId = `${speaker}-knight-${square}`;
  const victim = panel.getByRole('combobox', { name: /piece to lose|loss target/i });
  await expect(victim.locator(`option[value="${victimId}"]`)).toContainText(square);
  await victim.selectOption(victimId);
  await panel.getByRole('button', { name: /name|announce|pronounce/i }).click();

  const state = await gameState(page);
  expect(state.pieces.find((piece: any) => piece.id === victimId)).toMatchObject({ square: null, zone: 'captured' });
  await expect(page.getByRole('status')).toContainText(new RegExp(`${speaker}.*Knight.*${square}`, 'i'));
}

for (const fixture of [
  { turn: 'white', speaker: 'white', square: 'b1' },
  { turn: 'white', speaker: 'black', square: 'b8' },
  { turn: 'black', speaker: 'white', square: 'b1' },
  { turn: 'black', speaker: 'black', square: 'b8' },
] as const) {
  test(`records later ${fixture.speaker} speech during ${fixture.turn}'s turn`, async ({ page }) => {
    await seedLaterSpeech(page, fixture.turn);
    await recordKnightSpeech(page, fixture.speaker, fixture.square);
  });
}

test('the immediate window fixes the speaker to the offered opponent', async ({ page }) => {
  await seedGame(page, {
    fen: START_WHITE,
    hands: { white: ['doomsayer'], black: [] },
    actions: [
      { type: 'move', from: 'e2', to: 'e4' },
      { type: 'playCard', cardId: 'doomsayer' },
    ],
  });
  const panel = announcement(page);
  const speaker = panel.getByRole('combobox', { name: /speaker/i });
  if (await speaker.count()) {
    await expect(speaker).toHaveValue('black');
    await expect(speaker).toBeDisabled();
  }
  await expect(panel).toContainText(/Black.*name.*immediately/i);

  await panel.getByRole('combobox', { name: /piece (name|type)/i }).selectOption('knight');
  const victim = panel.getByRole('combobox', { name: /piece to lose|loss target/i });
  await expect(victim.locator('option[value="black-knight-b8"]')).toContainText('b8');
  await expect(victim.locator('option[value^="white-knight-"]')).toHaveCount(0);
  await victim.selectOption('black-knight-b8');
  await panel.getByRole('button', { name: /name|announce|pronounce/i }).click();
  expect((await gameState(page)).pieces.find((piece: any) => piece.id === 'black-knight-b8').zone).toBe('captured');
});

test('keyboard flow clears a stale victim when the intentional speaker changes', async ({ page }) => {
  await seedLaterSpeech(page, 'black');
  const panel = announcement(page);
  const speaker = panel.getByRole('combobox', { name: /speaker/i });
  await expect(speaker).toBeVisible({ timeout: 1_000 });
  await speaker.focus();
  await speaker.selectOption('white');
  const role = panel.getByRole('combobox', { name: /piece (name|type)/i });
  await role.focus();
  await role.selectOption('knight');
  const victim = panel.getByRole('combobox', { name: /piece to lose|loss target/i });
  await victim.focus();
  await victim.selectOption('white-knight-b1');

  await speaker.selectOption('black');
  await expect(victim).toHaveValue('');
  await expect(victim.locator('option[value="white-knight-b1"]')).toHaveCount(0);
  await expect(victim.locator('option[value="black-knight-b8"]')).toContainText('b8');
  await victim.selectOption('black-knight-b8');
  const submit = panel.getByRole('button', { name: /name|announce|pronounce/i });
  await submit.focus();
  await page.keyboard.press('Enter');

  expect((await gameState(page)).pieces.find((piece: any) => piece.id === 'black-knight-b8').zone).toBe('captured');
});

test('later-speaker controls remain usable without clipping at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await seedLaterSpeech(page, 'white');
  const panel = announcement(page);
  const speaker = panel.getByRole('combobox', { name: /speaker/i });
  await expect(speaker).toBeVisible({ timeout: 1_000 });
  await speaker.selectOption('black');
  const role = panel.getByRole('combobox', { name: /piece (name|type)/i });
  await role.selectOption('knight');
  const victim = panel.getByRole('combobox', { name: /piece to lose|loss target/i });
  await victim.selectOption('black-knight-b8');
  const submit = panel.getByRole('button', { name: /name|announce|pronounce/i });

  for (const control of [speaker, role, victim, submit]) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await submit.click();
  expect((await gameState(page)).pieces.find((piece: any) => piece.id === 'black-knight-b8').zone).toBe('captured');
});

test('a rescue SELF_CHECK fizzle leaves no stale Doomsayer announcement', async ({ page }) => {
  await seedGame(page, {
    fen: 'k6r/8/8/8/1b6/8/P7/4K3 w - - 0 1',
    hands: { white: ['anathema', 'doomsayer'], black: [] },
  });
  await dragPiece(page, 'a2', 'a3');
  await expect(page.getByRole('status')).toContainText(/still in check.*rescue/i);
  await hand(page, 'White').getByRole('button', { name: 'Doomsayer' }).click();
  await page.getByRole('button', { name: 'Play Doomsayer' }).click();

  await expect(page.getByRole('status')).toContainText(/Doomsayer.*spent.*fizzle/i);
  await expect(announcement(page)).toHaveCount(0, { timeout: 1_000 });
  const state = await gameState(page);
  expect(state.pendingDoomsayer).toBeNull();
  expect(state.effects).toEqual([]);
  expect(state.players.white.discard).toEqual([
    { id: 'white-hand-1-doomsayer', cardId: 'doomsayer' },
  ]);
  expect(state.pieces.find((piece: any) => piece.id === 'white-pawn-a2')).toMatchObject({ square: 'a2', zone: 'board' });
});
