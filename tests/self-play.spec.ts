import { expect, test } from '@playwright/test';
import { initialize, execute, assertConsistent } from './support/selfPlay.js';
import { practiceCards } from '../src/debugGame.js';
import { activeDoomsayers, applyAction, cardPlayTargets, doomsayerTargets, legalDests, underElfHillReturnSquares } from '../src/game/reducer.js';
import type { GameAction, GameState, DoomsayerRole } from '../src/game/types.js';

function random(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function actionFor(state: GameState, rng: () => number, openingCard?: string): GameAction | undefined {
  const pick = <T,>(values: T[]) => values[Math.floor(rng() * values.length)];
  const valid = (action: GameAction) => applyAction(state, action).ok;
  const namePiece = (speaker: 'white' | 'black'): GameAction => {
    const name = pick<DoomsayerRole>(['pawn', 'knight', 'bishop', 'rook', 'queen', 'crab', 'prince']);
    const pieces = doomsayerTargets(state, speaker, name).sort(() => rng() - .5);
    return { type: 'namePiece', speaker, name, losses: activeDoomsayers(state).slice(0, pieces.length)
      .map((effect, index) => ({ effectId: effect.card.id, pieceId: pieces[index].id })) };
  };
  const returns = underElfHillReturnSquares(state);
  if (returns.length) return { type: 'returnKing', to: pick(returns) };
  if (state.pendingAbduction) {
    const pending = state.pendingAbduction;
    if (pending.phase === 'concealment') return { type: 'revealAbduction' };
    if (rng() < .3) return { type: 'abductionTimeout' };
    const piece = pending.before.pieces.find(piece => piece.id === pending.pieceId)!;
    return { type: 'answerAbduction', player: pending.player, role: piece.role, owner: piece.owner,
      square: piece.square!, ...(pending.requiresPieceId ? { pieceId: piece.id } : {}) };
  }
  if (state.pendingDoomsayer) {
    const speaker = state.pendingDoomsayer.player;
    if (rng() < .5) return { type: 'declineDoomsayer', player: speaker };
    return namePiece(speaker);
  }
  if (!openingCard && !state.outcome && activeDoomsayers(state).length && rng() < .05) {
    const action = namePiece(pick(['white', 'black']));
    if (valid(action)) return action;
  }

  const cards: GameAction[] = [];
  for (const player of Object.values(state.players)) for (const card of player.hand) {
    const targets = cardPlayTargets(state, card.cardId);
    if (!targets.length) continue;
    // Sample targets before applying them; the UI still exposes the complete generated set.
    const start = Math.floor(rng() * targets.length);
    for (let offset = 0; offset < (card.cardId === openingCard ? targets.length : Math.min(targets.length, 12)); offset++) {
      const action: GameAction = { type: 'playCard', cardId: card.cardId, cardInstanceId: card.id,
        target: targets[(start + offset) % targets.length] };
      if (valid(action)) { cards.push(action); break; }
    }
  }
  const opening = cards.filter(action => action.type === 'playCard' && action.cardId === openingCard);
  if (openingCard) {
    if (!opening.length) throw new Error(`No legal opening action for ${openingCard}`);
    return pick(opening);
  }
  if (cards.length && (state.outcome || rng() < .62)) return pick(cards);
  if (state.outcome) return;
  if (state.effects.some(effect => effect.type === 'panic' && effect.player === state.turn.color)
    && !state.turn.moveMade && rng() < .1) return { type: 'panicTimeout' };

  const end: GameAction = { type: 'endTurn' };
  if (valid(end) && (state.turn.moveMade || rng() < .1)) {
    const discard = state.players[state.turn.color].hand;
    if (discard.length && !state.turn.cardPlays[state.turn.color] && rng() < .2) {
      const exchange: GameAction = { type: 'endTurn', discardCardInstanceId: pick(discard).id };
      if (valid(exchange)) return exchange;
    }
    return end;
  }
  const moves = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
  while (moves.length) {
    const { from, to } = moves.splice(Math.floor(rng() * moves.length), 1)[0];
    const roles = [undefined, 'queen', 'rook', 'bishop', 'knight'];
    const start = Math.floor(rng() * roles.length);
    for (let index = 0; index < roles.length; index++) {
      const promotion = roles[(start + index) % roles.length];
      const action: GameAction = { type: 'move', from, to, ...(promotion ? { promotion } : {}) };
      if (valid(action)) return action;
      if (valid({ ...action, enPassant: false })) return { ...action, enPassant: false };
    }
  }
  return cards.length ? pick(cards) : valid(end) ? end : undefined;
}

test.describe('Seeded UI self-play', () => {
  test.skip(!process.env.UI_STRESS, 'Opt-in long-game verification');
  test.use({ actionTimeout: 5_000, navigationTimeout: 15_000 });
  const baseSeed = Number(process.env.UI_SEED ?? 13092026);
  const gameCount = Number(process.env.UI_GAMES ?? 8);
  const steps = Number(process.env.UI_STEPS ?? 100);
  const requested = process.env.UI_CARDS?.split(',') ?? practiceCards;
  for (let game = 0; game < gameCount; game++) {
    const seed = baseSeed + game;
    const practice = requested[game % requested.length];
    test(`${practice || 'ordinary game'}, seed ${seed}`, async ({ page }, info) => {
      test.setTimeout(Number(process.env.UI_GAME_TIMEOUT ?? 300_000));
      const rng = random(seed);
      const actions: GameAction[] = [];
      const started = Date.now();
      let state = await initialize(page, practice);
      try {
        for (let step = 0; step < steps; step++) {
          if (process.env.UI_RESIZE && step % 13 === 0) {
            const sizes = info.project.name === 'mobile'
              ? [[375, 667], [320, 568], [667, 375], [390, 844]]
              : [[1440, 1080], [1024, 768], [801, 600], [1280, 720]];
            const [width, height] = sizes[(seed + step) % sizes.length];
            await page.setViewportSize({ width, height });
            await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight, visualViewport?.scale ?? 1]),
              { message: 'Coordinate input needs the requested mobile viewport to settle' }).toEqual([width, height, 1]);
          }
          if (process.env.UI_VERBOSE) console.log(`Planning ${seed} step ${step}, events ${state.history.length}`);
          const action = actionFor(state, rng, step === 0 && process.env.UI_OPENING === 'practice' ? practice : undefined);
          if (!action) {
            expect(state.outcome, `Game has no selectable action at step ${step}`).toBeTruthy();
            break;
          }
          actions.push(action);
          if (process.env.UI_VERBOSE) console.log(`Executing ${seed} step ${step}: ${JSON.stringify(action)}`);
          state = await execute(page, state, action);
        }
        await assertConsistent(page, state);
        if (process.env.UI_CAPTURE && game % 10 === 0) {
          await page.screenshot({ path: info.outputPath('final-table.png'), fullPage: true });
        }
      } finally {
        const evidence = { seed, practice, actions, elapsedMs: Date.now() - started,
          outcome: state.outcome, turn: state.turn, effects: state.effects.map(effect => effect.type) };
        await info.attach('self-play', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
        console.log(JSON.stringify({ seed, practice, actions: actions.length, elapsedMs: evidence.elapsedMs, outcome: state.outcome }));
      }
    });
  }
});
