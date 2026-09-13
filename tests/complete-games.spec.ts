import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialize, execute, assertConsistent } from './support/selfPlay.js';
import type { GameAction, GameState } from '../src/game/types.js';

test.use({ actionTimeout: 5_000, navigationTimeout: 15_000 });

test('a complete self-play game ends in White checkmate', async ({ page }) => {
  test.skip(!process.env.UI_STRESS, 'Opt-in completed-game replay');
  test.setTimeout(180_000);
  const { actions } = JSON.parse(readFileSync(new URL('../audit/hour-selfplay-2026-09-13/game-1.json', import.meta.url), 'utf8')) as { actions: GameAction[] };
  let state = await initialize(page);
  for (const action of actions) state = await execute(page, state, action);
  expect(state.outcome).toEqual({ winner: 'white', reason: 'checkmate' });
  await assertConsistent(page, state);
  await expect(page.getByTestId('chessboard')).toHaveAttribute('aria-label', 'Chessboard with white at the bottom. Game over.');
  await expect(page.locator('.hand-card[data-playable="true"]')).toHaveCount(0);

  await page.locator('cg-board').scrollIntoViewIfNeeded();
  const board = (await page.locator('cg-board').boundingBox())!;
  for (const file of [0, 1]) {
    const point = { x: board.x + (file + .5) * board.width / 8, y: board.y + 3.5 * board.height / 8 };
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  }
  await assertConsistent(page, state);

  const card = page.locator('.hand-card').last();
  const name = await card.locator('img').getAttribute('alt');
  await card.focus();
  await card.press('Enter');
  const reader = page.getByRole('dialog', { name: name!, exact: true });
  await expect(reader).toBeVisible();
  await page.getByRole('button', { name: 'Close card', exact: true }).click();
  await expect(reader).toHaveCount(0);
  await assertConsistent(page, state);
});

// Recorded completed games stay outside the fast default suite.
if (process.env.UI_COMPLETE_GAMES) {
  const { games } = JSON.parse(readFileSync(process.env.UI_COMPLETE_GAMES, 'utf8')) as {
    games: { seed: number; practice: string; variant?: string; actions: GameAction[]; outcome: GameState['outcome']; status: string }[];
  };
  for (const game of games.filter(game => game.status === 'completed' && game.outcome)) {
    test(`completed ${game.practice}, seed ${game.seed}`, async ({ page }, info) => {
      test.skip(!process.env.UI_STRESS, 'Opt-in completed-game campaign');
      test.setTimeout(300_000);
      let state = await initialize(page, game.practice, game.variant);
      for (const action of game.actions) state = await execute(page, state, action);
      expect(state.outcome).toEqual(game.outcome);
      await expect(page.locator('.hand-card[data-playable="true"]')).toHaveCount(0);
      await page.clock.resume();
      await page.bringToFront();
      await page.screenshot({ path: info.outputPath('completed-game.png'), fullPage: true, timeout: 5_000 });
      await info.attach('completed-game', { body: JSON.stringify({ seed: game.seed, practice: game.practice,
        actions: game.actions.length, outcome: state.outcome }), contentType: 'application/json' });
    });
  }
}
