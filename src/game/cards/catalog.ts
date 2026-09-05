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
  anathema: {
    id: 'anathema',
    name: 'Anathema',
    points: 5,
    unique: false,
    image: '/KC6_card4.png',
    description: 'Swap the positions of a Bishop and a Rook belonging to your opponent.',
    timing: ['afterMove'],
    continuing: false,
  },
  evangelists: {
    id: 'evangelists',
    name: 'Evangelists',
    points: 6,
    unique: false,
    image: '/KC11_card2.png',
    description: "Swap the positions of one of your Bishops and one of your opponent's Bishops.",
    timing: ['beforeMove'],
    continuing: false,
  },
  tournament: {
    id: 'tournament',
    name: 'Tournament',
    points: 6,
    unique: false,
    image: '/KC12_card3.png',
    description: "Swap the positions of one of your Knights and one of your opponent's Knights.",
    timing: ['beforeMove'],
    continuing: false,
  },
  cathedral: {
    id: 'cathedral',
    name: 'Cathedral',
    points: 7,
    unique: false,
    image: '/KC13_card2.png',
    description: 'Swap the positions of one of your Rooks and one of your Bishops.',
    timing: ['afterMove'],
    continuing: false,
  },
  'lost-castle': {
    id: 'lost-castle',
    name: 'Lost Castle',
    points: 7,
    unique: false,
    image: '/KC14_card3.png',
    description: "Swap the positions of one of your Rooks and one of your opponent's Rooks.",
    timing: ['beforeMove'],
    continuing: false,
  },
  siege: {
    id: 'siege',
    name: 'Siege',
    points: 7,
    unique: false,
    image: '/KC15_card1.png',
    description: 'Swap the positions of one of your Knights and one of your Rooks.',
    timing: ['afterMove'],
    continuing: false,
  },
  'holy-quest': {
    id: 'holy-quest',
    name: 'Holy Quest',
    points: 7,
    unique: false,
    image: '/KC14_card1.png',
    description: 'Swap the positions of a Bishop and a Knight belonging to your opponent.',
    timing: ['afterMove'],
    continuing: false,
  },
  treason: {
    id: 'treason',
    name: 'Treason',
    points: 8,
    unique: false,
    image: '/KC17_card1.png',
    description: 'Swap the positions of a Rook and a Knight belonging to your opponent.',
    timing: ['afterMove'],
    continuing: false,
  },
  onslaught: {
    id: 'onslaught',
    name: 'Onslaught',
    points: 6,
    unique: false,
    image: '/KC12_card1.png',
    description:
      'Any number of your Pawns which can legally move may all move one square forward. None of them may make a capture.',
    timing: ['beforeMove'],
    continuing: false,
  },
  'long-jump': {
    id: 'long-jump',
    name: 'Long Jump',
    points: 7,
    unique: false,
    image: '/KC14_card2.png',
    description:
      'Move one of your Knights to any square whose color is different from the one it currently occupies. You cannot capture a piece with this move.',
    timing: ['beforeMove'],
    continuing: false,
  },
  dubbing: {
    id: 'dubbing',
    name: 'Dubbing',
    points: 4,
    unique: false,
    image: '/KC5_card1.png',
    description:
      'For this turn, one of your pieces may move as if it were a Knight. You cannot capture a piece with this move.',
    timing: ['beforeMove'],
    continuing: false,
  },
};
