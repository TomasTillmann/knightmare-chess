import { test, expect } from '@playwright/test';
import { CARD_CATALOG } from '../src/game/cards/catalog.js';
import type { CardId } from '../src/game/types.js';
import { initialize, assertConsistent } from './support/selfPlay.js';

test('Card drafts survive backtracking and reading without changing the game', async ({ page }) => {
  test.skip(!process.env.UI_STRESS, 'Opt-in draft stress coverage');
  test.setTimeout(90_000);
  const cards: CardId[] = ['earthquake', 'figure-dance', 'fortification', 'rebirth', 'resurrection',
    'confabulation', 'peace-talks', 'plots-within-plots', 'chaos', 'doppelganger', 'bombard', 'haunting-memories'];
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  for (const cardId of cards) {
    await test.step(cardId, async () => {
      const state = await initialize(page, cardId);
      const card = page.locator('.hand-card[data-playable="true"]')
        .filter({ has: page.getByRole('img', { name: CARD_CATALOG[cardId].name, exact: true }) }).first();
      await card.focus();
      await card.press('Enter');
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      for (let step = 0; step < 3; step++) {
        const choices = page.locator('.square-target, .choice-options button');
        if (!await choices.count()) break;
        const choice = choices.first();
        const name = await choice.getAttribute('aria-label') ?? await choice.innerText();
        await choice.click();
        if (await button('Back').count()) {
          await button('Back').click();
          await button(name).click();
        }
      }
      const before = await page.getByRole('status').innerText();
      const picked = await page.locator('.selection-summary').allTextContents();
      const confirmation = await button('Play card').isEnabled();
      const unavailable = page.locator('.hand-card[data-playable="false"]').first();
      await unavailable.focus();
      await unavailable.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('status')).toHaveText(before);
      await expect(page.locator('.selection-summary')).toHaveText(picked);
      expect(await button('Play card').isEnabled()).toBe(confirmation);
      await button('Cancel').click();
      await assertConsistent(page, state);
    });
  }
});
