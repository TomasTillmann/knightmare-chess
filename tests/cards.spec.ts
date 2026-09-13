import { expect, test } from '@playwright/test';
import { cardInteractions, matchingCardOptions } from '../src/cardInteractions.js';
import { createDebugGame, practiceCards } from '../src/debugGame.js';
import { CARD_CATALOG } from '../src/game/cards/catalog.js';
import { applyAction } from '../src/game/reducer.js';
import type { GameState } from '../src/game/types.js';

function snapshot(state: GameState) {
  return {
    board: state.pieces.filter(piece => piece.zone === 'board')
      .map(piece => `${piece.owner} ${piece.role} on ${piece.square}`).sort(),
    offBoard: state.pieces.filter(piece => piece.zone !== 'board')
      .map(piece => `${piece.owner} ${piece.role} ${piece.zone}`).sort(),
    effects: [...state.effects.map(effect => effect.type),
      ...(state.underElfHill ?? []).map(() => 'under-elf-hill')].sort(),
    hands: Object.fromEntries((['white', 'black'] as const).map(player => [player,
      state.players[player].hand.map(card => CARD_CATALOG[card.cardId].name)])),
  };
}

function practiceCase(id: string) {
  const state = createDebugGame(id);
  for (const player of ['white', 'black'] as const) {
    for (const card of state.players[player].hand.filter(card => card.cardId === id)) {
      const { options } = cardInteractions[id](state, card);
      for (const option of options) {
        const picked = option.picks.map(pick => pick.id);
        const chosen = matchingCardOptions(options, picked)
          .find(candidate => candidate.picks.length === picked.length);
        if (!chosen) continue;
        const result = applyAction(state, chosen.action);
        if (!result.ok || result.state.history.at(-1)?.type === 'cardFizzled') continue;
        return { player, picks: option.picks, expected: snapshot(result.state) };
      }
    }
  }
  throw new Error(`${CARD_CATALOG[id].name}: practice fixture has no selectable non-fizzled action`);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Every Knightmare card', () => {
  for (const id of practiceCards) {
    test(CARD_CATALOG[id].name, async ({ page }) => {
      const { player, picks, expected } = practiceCase(id);
      const name = CARD_CATALOG[id].name;
      const button = (label: string) => page.getByRole('button', { name: label, exact: true });
      await page.goto(`/?practice=${encodeURIComponent(id)}`);
      const hand = page.getByRole('region', { name: `${player} cards`, exact: true });
      await hand.getByRole('button', { name: new RegExp(`^${escape(name)}:`) })
        .click({ position: { x: 18, y: 50 } });
      for (const pick of picks) {
        await button(pick.square ? `Choose ${pick.square}` : pick.label).click();
      }
      await button('Play card').click();
      await expect(button('Play card'), `${name}: the selected card should finish playing`).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => {
        const pieces = (selector: string) => (document.querySelector(selector)?.textContent ?? '')
          .replace(/\.$/, '').split(', ').filter(Boolean).sort();
        return {
          board: pieces('#board-position'),
          offBoard: pieces('#off-board-position'),
          effects: Array.from(document.querySelectorAll('.effect-entry[data-effect]'))
            .map(element => element.getAttribute('data-effect'))
            .filter(type => type !== 'piece-status').sort(),
          hands: Object.fromEntries(['white', 'black'].map(color => [color,
            Array.from(document.querySelectorAll<HTMLImageElement>(`[data-player="${color}"] .hand-card img`))
              .map(image => image.alt)])),
        };
      }), { message: `${name}: rendered figures, hands, and effects should match the applied action` }).toEqual(expected);
      await expect(page.getByRole('status')).not.toHaveText(/cannot be played now|Card spent without effect/);
      const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
      expect(layout.content, `${name}: no horizontal overflow`).toBeLessThanOrEqual(layout.width + 1);
    });
  }
});
