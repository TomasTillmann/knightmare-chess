import { INITIAL_FEN, makeFen, parseFen } from 'chessops/fen';
import { makeSquare } from 'chessops/util';

import type { CardId, Color, GameState, PieceState, TurnPhase } from './types.js';

export interface CreateGameOptions {
  fen?: string;
  turn?: Color;
  phase?: TurnPhase;
  moveMade?: boolean;
  hands?: Partial<Record<Color, CardId[]>>;
  decks?: Partial<Record<Color, CardId[]>>;
  cardPlays?: Partial<Record<Color, number>>;
}

export function createGameState(options: CreateGameOptions = {}): GameState {
  const setup = parseFen(options.fen ?? INITIAL_FEN).unwrap();
  if (options.turn) setup.turn = options.turn;

  const pieces: PieceState[] = [...setup.board].map(([square, piece]) => ({
    id: `${piece.color}-${piece.role}-${makeSquare(square)}`,
    owner: piece.color,
    role: piece.role,
    originalRole: piece.role,
    square: makeSquare(square),
    zone: 'board',
    promoted: false,
    royal: piece.role === 'king',
    neutral: false,
  }));

  const cards = (color: Color, zone: 'hand' | 'deck', ids: CardId[] = []) =>
    ids.map((cardId, index) => ({ id: `${color}-${zone}-${index}-${cardId}`, cardId }));
  const epPawnSquare = setup.epSquare === undefined
    ? undefined
    : setup.epSquare - (setup.turn === 'white' ? 8 : -8);
  const epPawn = epPawnSquare === undefined
    ? undefined
    : pieces.find(piece => piece.square === makeSquare(epPawnSquare));

  return {
    fen: makeFen(setup),
    pieces,
    players: {
      white: {
        hand: cards('white', 'hand', [...(options.hands?.white ?? [])]),
        deck: cards('white', 'deck', [...(options.decks?.white ?? [])]),
        discard: [],
      },
      black: {
        hand: cards('black', 'hand', [...(options.hands?.black ?? [])]),
        deck: cards('black', 'deck', [...(options.decks?.black ?? [])]),
        discard: [],
      },
    },
    turn: {
      color: options.turn ?? setup.turn,
      phase: options.phase ?? 'beforeMove',
      moveMade: options.moveMade ?? false,
      cardPlays: {
        white: options.cardPlays?.white ?? 0,
        black: options.cardPlays?.black ?? 0,
      },
    },
    effects: [],
    history: [],
    orientation: 0,
    enPassant: setup.epSquare !== undefined && epPawn
      ? [{ target: makeSquare(setup.epSquare), pawnId: epPawn.id }]
      : [],
    outcome: null,
  };
}
