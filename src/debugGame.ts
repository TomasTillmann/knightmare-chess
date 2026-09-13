import { cardInteractions } from './cardInteractions.js';
import { applyAction } from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { GameAction, GameState, SquareName } from './game/types.js';

export const practiceCards = Object.keys(cardInteractions);

// Deterministic local deals and short, real-engine setups for quick UI iteration.
export function createDebugGame(practice = ''): GameState {
  const deal = (first: string, offset: number) => {
    const pool = [...practiceCards.slice(offset), ...practiceCards.slice(0, offset)];
    return [first, ...pool.filter(id => id !== first)].slice(0, 5);
  };
  const whiteFirst = practice === 'peace-talks' ? 'curse'
    : practice === 'fog-of-war' ? 'hidden-passage'
      : practiceCards.includes(practice) ? practice : 'hidden-passage';
  const hands = { white: deal(whiteFirst, 0), black: deal(practice === 'peace-talks' ? practice : 'fog-of-war', 5) };
  let game = createGameState({ hands, decks: {
    white: practiceCards.filter(id => !hands.white.includes(id)),
    black: practiceCards.filter(id => !hands.black.includes(id)),
  } });
  const act = (action: GameAction) => {
    const result = applyAction(game, action);
    if (!result.ok) throw new Error(`Practice setup: ${result.error.message}`);
    game = result.state;
  };
  const move = (from: SquareName, to: SquareName, finish = true) => {
    act({ type: 'move', from, to });
    if (finish) act({ type: 'endTurn' });
  };
  const card = (cardId: string, target: unknown) => act({ type: 'playCard', cardId,
    cardInstanceId: game.players[game.turn.color].hand.find(card => card.cardId === cardId)!.id, target });

  if (practice === 'forced-march') {
    move('e2', 'e3'); move('e7', 'e6');
  } else if (practice === 'resurrection') {
    move('e2', 'e4'); move('d7', 'd5'); move('g1', 'f3'); move('d5', 'e4');
  } else if (practice === 'fireball') {
    move('e2', 'e3'); move('d7', 'd5'); move('f2', 'f3'); move('a7', 'a6'); move('e3', 'e4', false);
  } else if (['mystic-shield', 'curse', 'fortification', 'peace-talks'].includes(practice)) {
    move('e2', 'e4', false);
    if (practice === 'peace-talks') {
      card('curse', 'd8'); act({ type: 'endTurn' }); move('a7', 'a6', false);
    }
  } else if (practice === 'fog-of-war') {
    card('hidden-passage', [{ from: 'e1', to: 'e4' }]);
  }
  return game;
}
