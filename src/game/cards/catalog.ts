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
};
