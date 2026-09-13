import { CARD_CATALOG } from './game/cards/catalog.js';
import { applyAction } from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { GameAction, GameState, SquareName } from './game/types.js';

export const practiceCards = Object.values(CARD_CATALOG)
  .sort((a, b) => a.image.localeCompare(b.image, undefined, { numeric: true }))
  .map(card => card.id);

const practicePositions: Record<string, string> = {
  madman: '4k3/8/8/8/3p4/2P5/8/4K3 w - - 0 1',
  'squaring-the-circle': 'r3k3/8/8/8/8/8/4P3/R3K2R w - - 0 1',
  bog: '6k1/6p1/8/8/8/8/4P3/R3K3 w - - 0 1',
  cowardice: '4k3/8/8/3p4/8/8/4P3/4K3 w - - 0 1',
  rebirth: '4k3/8/8/3p4/8/8/4P3/4K3 w - - 0 1',
  toll: '4k3/8/8/8/4P3/8/P7/4K3 w - - 0 1',
  'dark-mirror': '4k3/8/8/4P3/3p4/8/8/4K3 w - - 0 1',
  'irresistible-force': '4k3/8/8/8/4p3/4P3/8/4K3 w - - 0 1',
  breakthrough: '4k3/8/8/8/4p3/4P3/8/4K3 w - - 0 1',
  masquerade: '4k3/8/8/8/8/8/4P3/1N2K3 w - - 0 1',
  'passing-in-the-night': '4k3/8/3p1p2/8/8/3P1P2/8/4K3 w - - 0 1',
  dungeon: '4k3/p7/8/8/8/8/4P3/4K3 w - - 0 1',
  sanctuary: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1',
  'split-knight': '4k3/8/2p1p3/8/3N4/8/8/4K3 w - - 0 1',
  'evil-eye': '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1',
  'man-of-straw': 'k3r3/8/8/8/8/8/P7/4K3 w - - 0 1',
  crusade: '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1',
  merciless: '6k1/6p1/8/8/8/8/4P3/R3K3 w - - 0 1',
};

const promotionPositions: Record<string, string> = {
  promotion: '6k1/4P3/8/8/8/8/8/1K6 w - - 0 1',
  'crab-promotion': 'k7/8/4P3/8/8/8/8/K7 w - - 0 1',
  'earthquake-promotion': '6k1/8/p7/8/7P/8/8/1K6 w - - 0 1',
  'figure-dance-promotion': 'p7/8/3k4/8/8/8/5K2/7P w - - 0 1',
  'peace-talks-promotion': '2r3k1/3P4/8/8/8/8/8/1K6 w - - 0 1',
};

// Deterministic local deals and short, real-engine setups for quick UI iteration.
export function createDebugGame(practice = '', variant = ''): GameState {
  const deal = (first: string, offset: number) => {
    const pool = [...practiceCards.slice(offset), ...practiceCards.slice(0, offset)];
    return [first, ...pool.filter(id => id !== first)].slice(0, 5);
  };
  const whiteFirst = practice === 'peace-talks' ? 'curse'
    : CARD_CATALOG[practice]?.timing.every(timing => timing.startsWith('afterOpponent')) ? 'hidden-passage'
      : practiceCards.includes(practice) ? practice : 'hidden-passage';
  const reaction = CARD_CATALOG[practice]?.timing.every(timing => timing.startsWith('afterOpponent'));
  const blackFirst = practice === 'peace-talks' || reaction ? practice
    : practice === 'haunting-memories' ? 'disintegration' : 'fog-of-war';
  const hands = { white: deal(whiteFirst, 0), black: deal(blackFirst, 5) };
  if (variant === 'peace-talks-promotion') {
    hands.white = deal('peace-talks', 0);
    hands.white[1] = 'earthquake';
  }
  const capture = ['no-quarter', 'revenge', 'hostage', 'riposte', 'legacy'].includes(practice);
  const fen = promotionPositions[variant] ?? (capture
    ? `4k3/p7/8/3${practice === 'legacy' ? 'n' : 'p'}4/4P3/8/P7/4K3 w - - 0 1`
    : practicePositions[practice]);
  let game = createGameState({ fen, hands, decks: {
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

  if (variant === 'promotion') return game;
  if (variant === 'crab-promotion') {
    move('e6', 'e7', false); card('crab', 'e7'); act({ type: 'endTurn' }); move('a8', 'b8');
    return game;
  }
  if (variant === 'earthquake-promotion') {
    move('b1', 'b2', false);
    return game;
  }
  if (variant === 'figure-dance-promotion') {
    move('f2', 'f3', false);
    return game;
  }
  if (variant === 'peace-talks-promotion') {
    move('b1', 'b2', false); card('earthquake', { direction: 'clockwise', promotions: [] });
    act({ type: 'endTurn' }); move('g8', 'g7'); move('d7', 'c8', false);
    return game;
  }

  if (capture) {
    if (practice === 'legacy') game.players.black.discard.push(game.players.black.deck.shift()!);
    move('e4', 'd5', false);
  } else if (practice === 'bog' || practice === 'merciless') {
    move('a1', 'a4', false);
  } else if (practice === 'toll') {
    move('e4', 'e5', false);
  } else if (practice === 'charge') {
    move('g1', 'f3', false);
  } else if (practice === 'crusade') {
    move('c1', 'e3', false);
  } else if (practice === 'doppelganger') {
    move('e2', 'e3'); move('g8', 'f6');
  } else if (practice === 'haunting-memories') {
    move('e2', 'e3'); move('e7', 'e6', false);
    card('disintegration', 'a7'); act({ type: 'endTurn' });
  } else if (practice === 'winged-victory' || practice === 'betrayal') {
    move('e2', 'e4'); move('d7', 'd5'); move('g1', 'f3'); move('d5', 'e4');
  } else if (practice === 'forced-march') {
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
  } else if (practice === 'fog-of-war' || practice === 'vulture') {
    card('hidden-passage', [{ from: 'e1', to: 'e4' }]);
  } else if (CARD_CATALOG[practice]?.timing.includes('afterMove')
    && !CARD_CATALOG[practice]?.timing.includes('beforeMove') || reaction) {
    move('e2', 'e4', false);
  }
  return game;
}
