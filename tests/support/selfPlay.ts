import { expect, type Page } from '@playwright/test';
import { applyAction } from '../../src/game/reducer';
import { createDebugGame } from '../../src/debugGame';
import type { GameAction, GameState } from '../../src/game/types';

export async function initialize(page: Page, practice = ''): Promise<GameState> {
  await page.goto(`/?practice=${encodeURIComponent(practice)}`);
  return createDebugGame(practice);
}

export async function assertConsistent(page: Page, state: GameState) {
  await expect(page.locator('cg-board')).toBeVisible();
  expect(state.result ?? null).toBeDefined();
}

export async function execute(page: Page, state: GameState, action: GameAction): Promise<GameState> {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`Illegal model action: ${JSON.stringify(action)}`);
  await assertConsistent(page, result.state);
  return result.state;
}
