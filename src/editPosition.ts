import { makeFen, parseFen } from 'chessops/fen';
import { SquareSet } from 'chessops/squareSet';
import { makeSquare, opposite } from 'chessops/util';
import { boardFen } from './game/reducer.js';
import type { Color, ConfabulationEffect, GameState, PieceState } from './game/types.js';

export function isIntactFusion(effect: ConfabulationEffect, pieces: PieceState[]): boolean {
  return pieces.some(piece => piece.id === effect.pieceIds[0] && (piece.zone === 'board' || piece.zone === 'away'))
    && pieces.some(piece => piece.id === effect.pieceIds[1] && piece.zone === 'away');
}

/** Reveal temporarily concealed pieces in the draft without changing the game. */
export function piecesForEditing(state: GameState): PieceState[] {
  return state.pieces.map(piece => {
    const before = state.pendingAbduction?.before.pieces.find(item => item.id === piece.id);
    return { ...(piece.zone === 'away' && before?.zone === 'board' ? before : piece) };
  });
}

/** Accept a manually corrected position as a settled point in the current game. */
export function applyBoardEdit(state: GameState, pieces: PieceState[], color: Color, moveMade: boolean): GameState {
  if (color === state.turn.color && moveMade === state.turn.moveMade
    && JSON.stringify(pieces) === JSON.stringify(state.pieces)) return state;

  const occupied = new Set<string>();
  const ids = new Set<string>();
  for (const piece of pieces) {
    if (ids.has(piece.id)) throw new Error('Each piece must have a unique identity.');
    ids.add(piece.id);
    if (piece.zone !== 'board') continue;
    if (!piece.square || !/^[a-h][1-8]$/.test(piece.square) || occupied.has(piece.square)) {
      throw new Error('Place each piece on a separate board square.');
    }
    occupied.add(piece.square);
  }
  const underElfHill = state.underElfHill?.filter(entry =>
    pieces.some(piece => piece.id === entry.pieceId && piece.zone === (entry.returned ? 'board' : 'away')));
  if (moveMade && underElfHill?.some(entry => entry.player === color && entry.returning && !entry.returned)) {
    throw new Error('Place the returning King on the board before marking the move complete.');
  }
  for (const owner of ['white', 'black'] as const) {
    if (!pieces.some(piece => piece.owner === owner && piece.royal
      && (piece.zone === 'board' || (piece.zone === 'away'
        && underElfHill?.some(entry => entry.pieceId === piece.id))))) {
      throw new Error(`Keep at least one royal piece for ${owner}.`);
    }
  }

  const brokenFusions = state.effects.filter(effect => effect.type === 'confabulation' && !isIntactFusion(effect, pieces));
  const next: GameState = {
    fen: state.fen,
    pieces: pieces.map(piece => ({ ...piece })),
    players: structuredClone(state.players),
    turn: { color, phase: moveMade ? 'afterMove' : 'beforeMove', moveMade,
      cardPlays: color === state.turn.color ? { ...state.turn.cardPlays } : { white: 0, black: 0 } },
    effects: state.effects.filter(effect => effect.type !== 'panic' && !brokenFusions.includes(effect)),
    history: [],
    orientation: state.orientation,
    enPassant: [],
    pendingRescue: null,
    pendingDoomsayer: null,
    outcome: null,
  };
  for (const effect of brokenFusions) {
    if ('card' in effect) next.players[effect.owner].discard.push({ ...effect.card });
  }
  if (state.riposteLostMoves) next.riposteLostMoves = [...state.riposteLostMoves];
  if (underElfHill?.length) next.underElfHill = underElfHill.map(entry => ({ ...entry }));
  const setup = parseFen(`${boardFen(next)} ${state.fen.split(' ').slice(1).join(' ')}`).unwrap();
  setup.turn = moveMade ? opposite(color) : color;
  // FEN has already advanced its move number after Black's completed move.
  const turnNumber = Math.max(1, setup.fullmoves - Number(state.turn.color === 'black' && state.turn.moveMade));
  setup.fullmoves = turnNumber + Number(color === 'black' && moveMade);
  setup.epSquare = undefined;
  setup.castlingRights = SquareSet.empty();
  const previous = parseFen(state.fen).unwrap();
  for (const square of previous.castlingRights) {
    const rook = state.pieces.find(piece => piece.zone === 'board' && piece.square === makeSquare(square));
    const king = state.pieces.find(piece => piece.zone === 'board' && piece.owner === rook?.owner
      && piece.role === 'king' && piece.square === (piece.owner === 'white' ? 'e1' : 'e8'));
    if (rook?.role === 'rook' && king && [rook, king].every(piece =>
      JSON.stringify(piece) === JSON.stringify(pieces.find(candidate => candidate.id === piece.id)))) {
      setup.castlingRights = setup.castlingRights.with(square);
    }
  }
  next.fen = makeFen(setup);
  return next;
}
