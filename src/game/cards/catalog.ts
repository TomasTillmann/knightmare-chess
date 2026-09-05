import type { CardId, TurnPhase } from '../types.js';

export interface CardDefinition {
  id: CardId;
  name: string;
  points: number;
  unique: boolean;
  image: string;
  description: string;
  timing: TurnPhase[];
  continuing: boolean;
}

export const CARD_CATALOG: Record<CardId, CardDefinition> = {
  disintegration: {
    id: 'disintegration',
    name: 'Disintegration',
    points: 2,
    unique: false,
    image: '/KC1_card2.png',
    description:
      'Remove one of your own Pawns from the chessboard, and set it aside. It is now *dead*, and cannot be brought back into play with another card.',
    timing: ['beforeMove', 'afterMove'],
    continuing: false,
  },
  fanatic: {
    id: 'fanatic',
    name: 'Fanatic',
    points: 2,
    unique: false,
    image: '/KC1_card4.png',
    description:
      'Move one of your Pawns forward three squares, provided the path is clear. It may not capture on this move, or be captured *en passant*.',
    timing: ['beforeMove'],
    continuing: false,
  },
  annexation: {
    id: 'annexation',
    name: 'Annexation',
    points: 3,
    unique: false,
    image: '/KC2_card1.png',
    description:
      'Move one or two of your Pawns forward, two squares each. Neither one may make a capture. A Pawn which was on its starting square may still be captured *en passant* after this move, if an enemy Pawn is in position to do so.',
    timing: ['beforeMove'],
    continuing: false,
  },
  'forced-march': {
    id: 'forced-march',
    name: 'Forced March',
    points: 3,
    unique: false,
    image: '/KC2_card2.png',
    description: 'Move one or two of your Pawns sideways, in either direction, one square each.',
    timing: ['beforeMove'],
    continuing: false,
  },
  'holy-war': {
    id: 'holy-war',
    name: 'Holy War',
    points: 3,
    unique: false,
    image: '/KC3_card1.png',
    description: 'Swap the positions of one of your Knights and one of your Bishops.',
    timing: ['afterMove'],
    continuing: false,
  },
};
