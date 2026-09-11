import { applyAction, cardPlayTargets } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
const state = createGameState({ fen: '4r2k/8/8/4n3/3K4/8/8/8 w - - 0 1', hands: { white: ['evil-eye'] } });
const action = { type: 'playCard' as const, cardId: 'evil-eye', target: { attacker: 'd4', victim: 'e5' } };
const started = performance.now(), result = applyAction(state, action);
console.log(JSON.stringify({ sentinel: 'EVIL_EYE_ROYAL_DONE', fen: state.fen, action,
  offered: cardPlayTargets(state, 'evil-eye'), result: result.ok ? result.state.history.at(-1) : result.error,
  expected: 'FAQ26 permits stationary King capture of adjacent protected Knight', ms: performance.now() - started }));
