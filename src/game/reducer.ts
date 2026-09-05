import { Board } from 'chessops/board';
import { Castles, Chess, castlingSide } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { makeBoardFen, makeFen, parseFen } from 'chessops/fen';
import type { Move } from 'chessops/types';
import {
  kingCastlesTo,
  makeSquare,
  opposite,
  parseSquare,
  rookCastlesTo,
  squareRank,
} from 'chessops/util';

import type {
  ApplyResult,
  Color,
  GameAction,
  GameErrorCode,
  GameState,
  PieceState,
  Role,
  SquareName,
} from './types.js';

const SQUARE = /^[a-h][1-8]$/;
const PROMOTIONS = new Set<Role>(['queen', 'rook', 'bishop', 'knight']);

function reject(state: GameState, code: GameErrorCode, message: string): ApplyResult {
  return { ok: false, state, error: { code, message } };
}

function setupFor(state: GameState, turn?: Color) {
  const setup = parseFen(state.fen).unwrap();
  const fenTurn = setup.turn;
  const board = Board.empty();
  for (const piece of state.pieces) {
    if (piece.zone !== 'board' || !piece.square) continue;
    board.set(parseSquare(piece.square), { color: piece.owner, role: piece.role });
  }
  setup.board = board;
  if (turn) setup.turn = turn;
  if (turn && turn !== fenTurn) setup.epSquare = undefined;
  if (setup.epSquare !== undefined) {
    const forward = setup.turn === 'white' ? 8 : -8;
    const pawn = setup.epSquare - forward;
    const validRank = setup.turn === 'white' ? 5 : 2;
    if (
      squareRank(setup.epSquare) !== validRank
      || board.has(setup.epSquare + forward)
      || !board.pawn.has(pawn)
      || !board[opposite(setup.turn)].has(pawn)
    ) setup.epSquare = undefined;
  }
  return setup;
}

// Card play can create positions that legal chess history cannot, so validation is
// intentionally bypassed while chessops still supplies attack and move rules.
export function positionFor(state: GameState, turn: Color = state.turn.color): Chess {
  const setup = setupFor(state, turn);
  const position = Chess.default();
  position.board = setup.board.clone();
  position.turn = setup.turn;
  position.castles = Castles.fromSetup(setup);
  position.epSquare = setup.epSquare;
  position.halfmoves = setup.halfmoves;
  position.fullmoves = setup.fullmoves;
  return position;
}

export function boardFen(state: GameState): string {
  return makeBoardFen(setupFor(state).board);
}

export function legalDests(state: GameState): Map<SquareName, SquareName[]> {
  if (state.turn.moveMade || state.outcome) return new Map();
  const position = positionFor(state);
  const king = position.board.kingOf(opposite(position.turn));
  const dests = chessgroundDests(position);
  if (king !== undefined) {
    const kingSquare = makeSquare(king);
    for (const [from, targets] of dests) dests.set(from, targets.filter(target => target !== kingSquare));
  }
  return dests;
}

function syncFen(state: GameState): void {
  state.fen = makeFen(setupFor(state));
}

function spendCard(state: GameState, cardId: string): void {
  const color = state.turn.color;
  const player = state.players[color];
  const index = player.hand.findIndex(card => card.cardId === cardId);
  const [spent] = player.hand.splice(index, 1);
  player.discard.push(spent);
  const drawn = player.deck.shift();
  if (drawn) player.hand.push(drawn);
  state.turn.cardPlays[color] += 1;
}

function settleBlockedBeforeMove(state: GameState, color: Color): void {
  if (state.turn.phase !== 'beforeMove') return;
  const continuation = positionFor(state, color);
  if (continuation.isCheckmate()) {
    state.outcome = { winner: opposite(color), reason: 'checkmate' };
  } else if (continuation.isStalemate()) {
    state.outcome = { reason: 'stalemate' };
  }
}

function playDisintegration(state: GameState, target: unknown): ApplyResult {
  const color = state.turn.color;
  if (!state.players[color].hand.some(card => card.cardId === 'disintegration')) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Disintegration is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (
    (state.turn.phase === 'beforeMove' && state.turn.moveMade)
    || (state.turn.phase === 'afterMove' && !state.turn.moveMade)
  ) {
    return reject(state, 'INVALID_TIMING', 'Disintegration must be played before or after the move.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) {
    return reject(state, 'INVALID_TARGET', 'Choose a square occupied by one of your Pawns.');
  }
  const targetSquare = target as SquareName;

  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === targetSquare);
  if (!pawn) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (pawn.owner !== color && !pawn.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose one of your own Pawns.');
  }
  if (pawn.originalRole !== 'pawn' || pawn.promoted) {
    return reject(state, 'WRONG_ROLE', 'Disintegration can target only a Pawn.');
  }
  if (pawn.royal) return reject(state, 'INVALID_TARGET', 'A King can never be made dead.');

  const resolved = structuredClone(state);
  const resolvedPawn = resolved.pieces.find(piece => piece.id === pawn.id)!;
  resolvedPawn.square = null;
  resolvedPawn.zone = 'dead';
  syncFen(resolved);

  if (state.turn.phase === 'afterMove' && positionFor(resolved, color).isCheck()) {
    return reject(state, 'KING_IN_CHECK', 'Your King would be left in check.');
  }

  if (positionFor(resolved, opposite(color)).isCheckmate()) {
    const fizzled = structuredClone(state);
    spendCard(fizzled, 'disintegration');
    fizzled.history.push({ type: 'cardFizzled', cardId: 'disintegration', reason: 'DIRECT_MATE' });
    settleBlockedBeforeMove(fizzled, color);
    return { ok: true, state: fizzled };
  }

  spendCard(resolved, 'disintegration');
  resolved.history.push({ type: 'cardPlayed', cardId: 'disintegration', target: targetSquare });
  settleBlockedBeforeMove(resolved, color);
  return { ok: true, state: resolved };
}

function movePiece(state: GameState, action: Extract<GameAction, { type: 'move' }>): ApplyResult {
  if (state.turn.moveMade || state.turn.phase !== 'beforeMove') {
    return reject(state, 'ILLEGAL_MOVE', 'The regular move has already been made.');
  }
  if (
    typeof action.from !== 'string'
    || typeof action.to !== 'string'
    || !SQUARE.test(action.from)
    || !SQUARE.test(action.to)
  ) {
    return reject(state, 'ILLEGAL_MOVE', 'Move coordinates must be board squares.');
  }

  const fromName = action.from as SquareName;
  const toName = action.to as SquareName;
  const from = parseSquare(fromName);
  const to = parseSquare(toName);
  let promotion: Role | undefined;
  if (action.promotion !== undefined) {
    if (typeof action.promotion !== 'string' || !PROMOTIONS.has(action.promotion as Role)) {
      return reject(state, 'ILLEGAL_MOVE', 'Promotion must be queen, rook, bishop, or knight.');
    }
    promotion = action.promotion as Role;
  }

  const position = positionFor(state);
  const move: Move = { from, to, ...(promotion ? { promotion } : {}) };
  const targetPiece = position.board.get(to);
  if (targetPiece?.role === 'king' && targetPiece.color !== state.turn.color) {
    return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
  }
  // ponytail: orthodox move safety for now; stage moves only when the first same-turn rescue card lands.
  if (!position.isLegal(move)) return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');

  const moving = state.pieces.find(piece => piece.zone === 'board' && piece.square === fromName);
  if (!moving) return reject(state, 'ILLEGAL_MOVE', 'There is no movable piece on that square.');
  const castle = castlingSide(position, move);
  const rookFrom = castle ? position.castles.rook[state.turn.color][castle] : undefined;
  const capturedSquare =
    !castle && moving.role === 'pawn' && position.epSquare === to && !position.board.has(to)
      ? to + (state.turn.color === 'white' ? -8 : 8)
      : to;
  const captured = castle
    ? undefined
    : state.pieces.find(
        piece => piece.zone === 'board' && piece.square === makeSquare(capturedSquare) && piece.owner !== state.turn.color,
      );

  position.play(move);
  const next = structuredClone(state);
  const moved = next.pieces.find(piece => piece.id === moving.id)!;
  moved.square = makeSquare(castle ? kingCastlesTo(state.turn.color, castle) : to);
  if (promotion) {
    moved.role = promotion;
    moved.promoted = true;
  }
  if (captured) {
    const victim = next.pieces.find(piece => piece.id === captured.id)!;
    victim.square = null;
    victim.zone = 'captured';
  }
  if (castle && rookFrom !== undefined) {
    const rook = next.pieces.find(
      piece => piece.zone === 'board' && piece.square === makeSquare(rookFrom) && piece.role === 'rook',
    );
    if (rook) rook.square = makeSquare(rookCastlesTo(state.turn.color, castle));
  }
  next.fen = makeFen(position.toSetup());
  next.turn.phase = 'afterMove';
  next.turn.moveMade = true;
  next.history.push({ type: 'move', from: fromName, to: toName, ...(promotion ? { promotion } : {}) });
  return { ok: true, state: next };
}

function endTurn(state: GameState): ApplyResult {
  if (!state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Make the regular move before ending the turn.');
  if (positionFor(state, state.turn.color).isCheck()) {
    return reject(state, 'KING_IN_CHECK', 'Your King is still in check.');
  }

  const next = structuredClone(state);
  const nextColor = opposite(state.turn.color);
  next.turn = {
    color: nextColor,
    phase: 'beforeMove',
    moveMade: false,
    cardPlays: { white: 0, black: 0 },
  };
  const position = positionFor(next);
  // ponytail: one escape-capable card exists; switch to per-card enumerators when the second lands.
  const canEscapeWithCard = next.players[nextColor].hand.some(card => card.cardId === 'disintegration')
    && next.pieces.some(piece => {
      if (piece.zone !== 'board' || !piece.square) return false;
      const result = playDisintegration(next, piece.square);
      return result.ok && [...legalDests(result.state).values()].some(targets => targets.length > 0);
    });
  if (position.isCheckmate() && !canEscapeWithCard) {
    next.outcome = { winner: state.turn.color, reason: 'checkmate' };
  } else if (position.isStalemate() && !canEscapeWithCard) {
    next.outcome = { reason: 'stalemate' };
  }
  return { ok: true, state: next };
}

export function applyAction(state: GameState, action: GameAction): ApplyResult {
  if (state.outcome) return reject(state, 'GAME_OVER', 'The game is already over.');
  if (action.type === 'move') return movePiece(state, action);
  if (action.type === 'endTurn') return endTurn(state);
  if (action.cardId === 'disintegration') return playDisintegration(state, action.target);
  return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
}
