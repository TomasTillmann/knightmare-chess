import { expect, type Page } from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';
import { cardInteractions, matchingCardOptions, type CardInteraction, type CardPick } from '../../src/cardInteractions.js';
import { createDebugGame } from '../../src/debugGame.js';
import { doomsayerSelection, moveChoices, requiredSelection, type GameSelection } from '../../src/gameInteractions.js';
import { CARD_CATALOG } from '../../src/game/cards/catalog.js';
import { activeDoomsayers, applyAction, cardPlayTargets } from '../../src/game/reducer.js';
import type { GameAction, GameState, SquareName } from '../../src/game/types.js';

const sessions = new WeakMap<Page, { errors: string[]; time: number; touch: boolean }>();
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const title = (value: string) => value[0].toUpperCase() + value.slice(1);

export async function initialize(page: Page, practice = '', variant = ''): Promise<GameState> {
  let session = sessions.get(page);
  if (!session) {
    session = { errors: [], time: Date.UTC(2026, 0, 1), touch: await page.evaluate(() => navigator.maxTouchPoints > 0) };
    sessions.set(page, session);
    page.on('pageerror', error => session!.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') session!.errors.push(message.text()); });
    await page.clock.install({ time: session.time });
  }
  session.errors.length = 0;
  // Freeze Date-based game deadlines, while rAF and click stability keep running.
  await page.clock.setFixedTime(session.time);
  await page.goto(`/?${new URLSearchParams({ practice, variant })}`);
  const state = createDebugGame(practice, variant);
  await assertConsistent(page, state);
  return state;
}

export async function assertConsistent(page: Page, state: GameState): Promise<void> {
  const board = state.pieces.filter(piece => piece.zone === 'board')
    .map(piece => `${piece.owner} ${piece.role} on ${piece.square}`).sort();
  const expected = {
    board,
    offBoard: state.pieces.filter(piece => piece.zone !== 'board')
      .map(piece => `${piece.owner} ${piece.role} ${piece.zone}`).sort(),
    rendered: board,
    placementErrors: [] as string[],
    effects: [...state.effects.map(effect => effect.type), ...(state.underElfHill ?? []).map(() => 'under-elf-hill')].sort(),
    hands: Object.fromEntries((['white', 'black'] as const).map(color => [color, {
      active: state.turn.color === color && !state.outcome,
      cards: state.players[color].hand.map(card => ({ name: CARD_CATALOG[card.cardId].name,
        playable: Boolean(cardInteractions[card.cardId](state, card).options.length) })),
    }])),
  };
  await expect(page.locator('cg-board')).toBeVisible();
  await expect(page.locator('piece.anim, piece.fading')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const pieces = (selector: string) => (document.querySelector(selector)?.textContent ?? '')
      .replace(/\.$/, '').split(', ').filter(Boolean).sort();
    const board = document.querySelector('cg-board')!.getBoundingClientRect();
    const placementErrors: string[] = [];
    const rendered = Array.from(document.querySelectorAll('cg-board > piece:not(.ghost)')).map(piece => {
      const box = piece.getBoundingClientRect();
      const file = Math.round((box.x - board.x) / (board.width / 8));
      const rank = 8 - Math.round((box.y - board.y) / (board.height / 8));
      const color = piece.classList.contains('white') ? 'white' : 'black';
      const role = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].find(role => piece.classList.contains(role));
      const label = `${color} ${role} on ${'abcdefgh'[file]}${rank}`;
      const errors = [box.x - board.x - file * board.width / 8,
        box.y - board.y - (8 - rank) * board.height / 8,
        box.width - board.width / 8, box.height - board.height / 8];
      if (errors.some(error => Math.abs(error) > 1)) placementErrors.push(`${label}: ${errors.join(', ')}px`);
      return label;
    }).sort();
    return {
      board: pieces('#board-position'), offBoard: pieces('#off-board-position'), rendered, placementErrors,
      effects: Array.from(document.querySelectorAll('.effect-entry[data-effect]'))
        .map(element => element.getAttribute('data-effect')).filter(type => type !== 'piece-status').sort(),
      hands: Object.fromEntries(['white', 'black'].map(color => [color, {
        active: document.querySelector(`[data-player="${color}"] .hand`)?.getAttribute('data-active') === 'true',
        cards: Array.from(document.querySelectorAll(`[data-player="${color}"] .hand-card`))
          .map(card => ({ name: card.querySelector('img')!.alt, playable: card.getAttribute('data-playable') === 'true' })),
      }])),
    };
  }), { message: `UI/model mismatch after ${state.history.length} events (${state.turn.color} ${state.turn.phase})` }).toEqual(expected);
  await expect(page.getByTestId('chessboard')).toHaveAttribute('data-orientation', 'white');
  await expect(page.getByTestId('chessboard')).toHaveAttribute('aria-label',
    `Chessboard with white at the bottom. ${state.outcome ? 'Game over.' : `${title(state.turn.color)} to move.`}`);
  const required = requiredSelection(state);
  const canEnd = applyAction(state, { type: 'endTurn' }).ok && !required;
  await expect(button(page, 'End turn')).toHaveCount(canEnd ? 1 : 0);
  await expect(button(page, 'Exchange card')).toHaveCount(canEnd && state.turn.cardPlays[state.turn.color] === 0
    && state.players[state.turn.color].hand.length > 0 ? 1 : 0);
  if (required) {
    await expect(button(page, required.confirm!)).toBeDisabled();
    await expect(button(page, 'Cancel')).toHaveCount(0);
  } else {
    await expect(button(page, 'Play card')).toHaveCount(0);
    await expect(button(page, 'Name a piece')).toHaveCount(activeDoomsayers(state).length && !state.pendingAbduction && !state.outcome ? 1 : 0);
    await expect(button(page, 'Decline')).toHaveCount(state.pendingDoomsayer ? 1 : 0);
  }
  await expect(page.locator('.board-concealment')).toHaveCount(state.pendingAbduction?.phase === 'concealment' ? 1 : 0);
  if (state.outcome) await expect(page.getByRole('status')).toContainText(
    `${state.outcome.winner ? `${title(state.outcome.winner)} wins` : 'Draw'} · ${state.outcome.reason}`);
  expect(sessions.get(page)?.errors ?? [], 'Browser must remain free of uncaught errors').toEqual([]);
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(size.content, 'The table must not overflow horizontally').toBeLessThanOrEqual(size.width + 1);
}

async function choose(page: Page, interaction: CardInteraction | GameSelection, ids: string[], initial: string[] = []) {
  const picked = [...initial];
  for (const id of ids) {
    const options = matchingCardOptions(interaction.options, picked);
    const resolved = 'resolve' in interaction ? interaction.resolve?.(picked) : undefined;
    const next: CardPick[] = resolved?.choices ?? [...new Map(options.flatMap(option => {
      const pick = option.picks[picked.length];
      return pick ? [[pick.id, pick] as const] : [];
    })).values()];
    const squares = next.filter(pick => pick.square), text = next.filter(pick => !pick.square);
    await expect(page.locator('.square-target')).toHaveCount(squares.length);
    await expect(page.locator('.choice-options button')).toHaveText(text.map(pick => pick.label));
    const pick = next.find(pick => pick.id === id);
    if (!pick) throw new Error(`No visible path for ${id} after ${JSON.stringify(picked)}`);
    if (pick.square) await button(page, `Choose ${pick.square}`).click();
    else await page.locator('.choice-options button').nth(text.indexOf(pick)).click();
    picked.push(id);
  }
}

export async function execute(page: Page, state: GameState, action: GameAction): Promise<GameState> {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`Illegal model action ${JSON.stringify(action)}: ${result.error.message}`);
  try {
    if (action.type === 'playCard') {
      const owner = (['white', 'black'] as const).find(color => state.players[color].hand.some(card =>
        card.cardId === action.cardId && (action.cardInstanceId ? card.id === action.cardInstanceId : applyAction(state,
          { ...action, cardInstanceId: card.id }).ok)));
      if (!owner) throw new Error('The physical card is missing from both hands');
      const index = state.players[owner].hand.findIndex(card => card.cardId === action.cardId
        && (!action.cardInstanceId || card.id === action.cardInstanceId));
      const card = state.players[owner].hand[index];
      const interaction = cardInteractions[card.cardId](state, card);
      const option = interaction.options.find(option => option.action.type === 'playCard' && isDeepStrictEqual(option.action.target, action.target))
        ?? interaction.options.find(option => { const candidate = applyAction(state, option.action);
          return candidate.ok && isDeepStrictEqual(candidate.state, result.state); });
      if (!option) throw new Error('A legal engine action has no UI selection path');
      const targets = cardPlayTargets(state, card.cardId);
      // Large multi-piece target sets already have exhaustive adapter tests; sample here to keep long games practical.
      const probes = targets.length <= 24 ? targets : [targets[0], targets[Math.floor(targets.length / 2)], targets.at(-1)];
      for (const target of probes) {
        const probe = applyAction(state, { type: 'playCard', cardId: card.cardId, cardInstanceId: card.id, target });
        if (probe.ok) expect(interaction.options.some(candidate => candidate.action.type === 'playCard'
          && isDeepStrictEqual(candidate.action.target, target)) || interaction.options.some(candidate => {
          const applied = applyAction(state, candidate.action); return applied.ok && isDeepStrictEqual(applied.state, probe.state);
        }), `Public target missing from ${card.cardId} UI: ${JSON.stringify(target)}`).toBe(true);
      }
      const physicalCard = page.locator(`[data-player="${owner}"] .hand-card`).nth(index);
      await physicalCard.scrollIntoViewIfNeeded();
      const position = await physicalCard.evaluate(card => {
        const bounds = card.getBoundingClientRect();
        for (const y of [.3, .5, .7]) for (const x of [.15, .3, .5, .7, .85]) {
          const point = { x: bounds.x + bounds.width * x, y: bounds.y + bounds.height * y };
          const exposed = [-3, 0, 3].every(dx => [-3, 0, 3].every(dy =>
            card.contains(document.elementFromPoint(point.x + dx, point.y + dy))));
          if (exposed) return { x: point.x - bounds.x, y: point.y - bounds.y };
        }
        return null;
      });
      if (!position) throw new Error(`Physical ${card.cardId} at hand index ${index} has no exposed 6px click area`);
      if (sessions.get(page)?.touch) await physicalCard.tap({ position });
      else await physicalCard.click({ position });
      await expect(physicalCard, 'The exact physical card clicked must be selected').toHaveAttribute('aria-pressed', 'true');
      await choose(page, interaction, option.picks.map(pick => pick.id));
      await button(page, 'Play card').click();
    } else if (action.type === 'move') {
      await page.locator('cg-board').scrollIntoViewIfNeeded();
      const board = await page.locator('cg-board').boundingBox();
      if (!board) throw new Error('The chessboard is missing');
      const options = moveChoices(state, action.from as SquareName, action.to as SquareName);
      for (const square of [String(action.from), String(action.to)]) {
        const x = board.x + (square.charCodeAt(0) - 97 + .5) * board.width / 8;
        const y = board.y + (8.5 - Number(square[1])) * board.height / 8;
        if (sessions.get(page)?.touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      }
      if (options.length > 1) {
        const option = options.find(option => { const candidate = applyAction(state, option.action);
          return candidate.ok && isDeepStrictEqual(candidate.state, result.state); });
        if (!option) throw new Error('The requested move has no promotion/en-passant choice');
        await choose(page, { prompts: [], options }, option.picks.map(pick => pick.id));
        await button(page, 'Move').click();
      }
    } else if (action.type === 'endTurn') {
      if (action.discardCardInstanceId) {
        await button(page, 'Exchange card').click();
        const index = state.players[state.turn.color].hand.findIndex(card => card.id === action.discardCardInstanceId);
        if (index < 0) throw new Error('The exchange card is missing');
        await page.locator('.choice-options button').nth(index).click();
        await button(page, 'Exchange & end').click();
      } else await button(page, 'End turn').click();
    } else if (action.type === 'returnKing') {
      await choose(page, requiredSelection(state)!, [String(action.to)]);
      await button(page, 'Return King').click();
    } else if (action.type === 'namePiece') {
      const selection = doomsayerSelection(state);
      await button(page, 'Name a piece').click();
      await choose(page, selection, [...(selection.picked.length ? [] : [action.speaker]), action.name,
        ...action.losses.map(loss => loss.pieceId)], selection.picked);
      await button(page, 'Name piece').click();
    } else if (action.type === 'declineDoomsayer') {
      await button(page, 'Decline').click();
    } else if (action.type === 'answerAbduction') {
      await choose(page, requiredSelection(state)!, [action.role, action.owner, action.square, ...(action.pieceId ? [action.pieceId] : [])]);
      await button(page, 'Answer').click();
    } else {
      const session = sessions.get(page);
      if (!session) throw new Error('Call initialize before advancing the game clock');
      const elapsed = action.type === 'panicTimeout' ? 15_000 : 10_000;
      session.time += elapsed;
      await page.clock.setFixedTime(session.time);
      await page.clock.fastForward(elapsed);
    }
    await assertConsistent(page, result.state);
    return result.state;
  } catch (error) {
    throw new Error(`UI action ${JSON.stringify(action)} after ${state.history.length} events: ${String(error)}`, { cause: error });
  }
}
