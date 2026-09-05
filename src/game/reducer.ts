import { Board } from 'chessops/board';
import { attacks } from 'chessops/attacks';
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
  squareFile,
  squareRank,
} from 'chessops/util';

import type {
  ApplyResult,
  BoardOrientation,
  CardMove,
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
const FANATIC_FORWARD: Record<BoardOrientation, readonly [number, number]> = {
  0: [0, 1],
  90: [1, 0],
  180: [0, -1],
  270: [-1, 0],
};

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

export function forcedMarchDests(state: GameState, from: SquareName): SquareName[] {
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !pawn
    || (pawn.owner !== state.turn.color && !pawn.neutral)
    || pawn.originalRole !== 'pawn'
    || pawn.promoted
  ) return [];

  const square = parseSquare(from);
  const [forwardFile, forwardRank] = FANATIC_FORWARD[state.orientation];
  const board = setupFor(state).board;
  return [
    [forwardRank, -forwardFile],
    [-forwardRank, forwardFile],
  ].flatMap(([fileStep, rankStep]) => {
    const file = squareFile(square) + fileStep;
    const rank = squareRank(square) + rankStep;
    const destination = rank * 8 + file;
    return file < 0 || file > 7 || rank < 0 || rank > 7 || board.has(destination)
      ? []
      : [makeSquare(destination)];
  });
}

function syncFen(state: GameState): void {
  state.fen = makeFen(setupFor(state));
}

function spendCard(state: GameState, cardId: string, cardInstanceId?: unknown): void {
  const color = state.turn.color;
  const player = state.players[color];
  const index = player.hand.findIndex(
    card => card.cardId === cardId && (cardInstanceId === undefined || card.id === cardInstanceId),
  );
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

function isKingInCheck(state: GameState, color: Color): boolean {
  const position = positionFor(state, color);
  const royals = state.pieces.filter(
    piece => piece.owner === color && piece.royal && piece.zone === 'board' && piece.square,
  );
  if (!royals.length) return position.isCheck();
  return royals.some(piece =>
    position.kingAttackers(parseSquare(piece.square!), opposite(color), position.board.occupied).nonEmpty()
    || state.pieces.some(neutral =>
      neutral.neutral
      && neutral.zone === 'board'
      && neutral.square
      && attacks(
        { color: neutral.owner, role: neutral.role },
        parseSquare(neutral.square),
        position.board.occupied,
      ).has(parseSquare(piece.square!)),
    ),
  );
}

function completeReplacementMove(state: GameState, color: Color, pawnMoved: boolean): void {
  const setup = setupFor(state);
  setup.turn = opposite(color);
  setup.epSquare = undefined;
  setup.halfmoves = pawnMoved ? 0 : setup.halfmoves + 1;
  if (color === 'black') setup.fullmoves += 1;
  state.fen = makeFen(setup);
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
}

function fizzleCard(
  state: GameState,
  cardId: string,
  reason: 'DIRECT_MATE' | 'SELF_CHECK',
  cardInstanceId?: unknown,
  consumesMove = false,
): ApplyResult {
  const fizzled = structuredClone(state);
  spendCard(fizzled, cardId, cardInstanceId);
  if (consumesMove) completeReplacementMove(fizzled, state.turn.color, false);
  fizzled.history.push({ type: 'cardFizzled', cardId, reason });
  settleBlockedBeforeMove(fizzled, state.turn.color);
  return { ok: true, state: fizzled };
}

function playDisintegration(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'disintegration' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
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

  if (
    !positionFor(state, opposite(color)).isCheckmate()
    && positionFor(resolved, opposite(color)).isCheckmate()
  ) {
    return fizzleCard(state, 'disintegration', 'DIRECT_MATE', cardInstanceId);
  }

  if (state.turn.phase === 'afterMove' && isKingInCheck(resolved, color)) {
    return fizzleCard(state, 'disintegration', 'SELF_CHECK', cardInstanceId);
  }

  spendCard(resolved, 'disintegration', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'disintegration', target: targetSquare });
  settleBlockedBeforeMove(resolved, color);
  return { ok: true, state: resolved };
}

function playFanatic(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'fanatic' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Fanatic is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Fanatic is played instead of the regular move.');
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
    return reject(state, 'WRONG_ROLE', 'Fanatic can target only an unpromoted Pawn.');
  }

  const from = parseSquare(targetSquare);
  const [forwardFile, forwardRank] = FANATIC_FORWARD[state.orientation];
  const ownerDirection = pawn.owner === 'white' ? 1 : -1;
  const path = [1, 2, 3].map(distance => {
    const file = squareFile(from) + forwardFile * ownerDirection * distance;
    const rank = squareRank(from) + forwardRank * ownerDirection * distance;
    return file < 0 || file > 7 || rank < 0 || rank > 7 ? -1 : rank * 8 + file;
  });
  const board = setupFor(state).board;
  if (path.some(square => square < 0 || square > 63 || board.has(square))) {
    return reject(state, 'ILLEGAL_MOVE', 'The Pawn needs three clear forward squares.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  const resolvedPawn = resolved.pieces.find(piece => piece.id === pawn.id)!;
  resolvedPawn.square = makeSquare(path[2]);

  if (positionFor(resolved, opposite(color)).isCheckmate()) {
    return fizzleCard(state, 'fanatic', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (isKingInCheck(resolved, color)) {
    return fizzleCard(state, 'fanatic', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(resolved, color, true);
  spendCard(resolved, 'fanatic', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'fanatic', target: targetSquare });
  return { ok: true, state: resolved };
}

function playForcedMarch(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'forced-march' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Forced March is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Forced March is played instead of the regular move.');
  }
  if (!Array.isArray(target) || target.length < 1 || target.length > 2) {
    return reject(state, 'INVALID_TARGET', 'Choose one or two Pawn moves.');
  }

  const moves: CardMove[] = [];
  for (const candidate of target) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return reject(state, 'INVALID_TARGET', 'Each Pawn move needs a source and destination.');
    }
    const { from, to } = candidate as Record<string, unknown>;
    if (typeof from !== 'string' || typeof to !== 'string' || !SQUARE.test(from) || !SQUARE.test(to)) {
      return reject(state, 'INVALID_TARGET', 'Each Pawn move needs valid board squares.');
    }
    moves.push({ from: from as SquareName, to: to as SquareName });
  }
  if (new Set(moves.map(move => move.from)).size !== moves.length) {
    return reject(state, 'INVALID_TARGET', 'Choose each Pawn only once.');
  }
  if (new Set(moves.map(move => move.to)).size !== moves.length) {
    return reject(state, 'ILLEGAL_MOVE', 'Each Pawn needs a different destination.');
  }

  const pawnIds: string[] = [];
  for (const move of moves) {
    const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
    if (!pawn) return reject(state, 'INVALID_TARGET', `There is no Pawn on ${move.from}.`);
    if (pawn.owner !== color && !pawn.neutral) {
      return reject(state, 'WRONG_OWNER', 'Choose one of your own Pawns.');
    }
    if (pawn.originalRole !== 'pawn' || pawn.promoted) {
      return reject(state, 'WRONG_ROLE', 'Forced March can target only an unpromoted Pawn.');
    }
    if (!forcedMarchDests(state, move.from).includes(move.to)) {
      return reject(state, 'ILLEGAL_MOVE', 'Each Pawn must move sideways to an empty square.');
    }
    pawnIds.push(pawn.id);
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  moves.forEach((move, index) => {
    resolved.pieces.find(piece => piece.id === pawnIds[index])!.square = move.to;
  });

  if (positionFor(resolved, opposite(color)).isCheckmate()) {
    return fizzleCard(state, 'forced-march', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (isKingInCheck(resolved, color)) {
    return fizzleCard(state, 'forced-march', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(resolved, color, true);
  spendCard(resolved, 'forced-march', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'forced-march', target: moves });
  return { ok: true, state: resolved };
}

function playCard(state: GameState, cardId: string, target: unknown, cardInstanceId?: unknown): ApplyResult {
  if (cardId === 'disintegration') return playDisintegration(state, target, cardInstanceId);
  if (cardId === 'fanatic') return playFanatic(state, target, cardInstanceId);
  if (cardId === 'forced-march') return playForcedMarch(state, target, cardInstanceId);
  return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
}

function cardPlayTargets(state: GameState, cardId: string): unknown[] {
  if (cardId !== 'forced-march') {
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square ? [piece.square] : []);
  }

  const steps = state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square
      ? forcedMarchDests(state, piece.square).map(to => ({ from: piece.square!, to }))
      : [],
  );
  const targets: CardMove[][] = steps.map(step => [step]);
  for (let first = 0; first < steps.length; first += 1) {
    for (let second = first + 1; second < steps.length; second += 1) {
      if (steps[first].from !== steps[second].from && steps[first].to !== steps[second].to) {
        targets.push([steps[first], steps[second]]);
      }
    }
  }
  return targets;
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
  if (isKingInCheck(state, state.turn.color)) {
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
  const canEscapeWithCard = next.players[nextColor].hand.some(card =>
    cardPlayTargets(next, card.cardId).some(target => {
      const result = playCard(next, card.cardId, target, card.id);
      if (!result.ok || result.state.outcome) return false;
      if (result.state.history.at(-1)?.type !== 'cardPlayed') return false;
      if (result.state.turn.moveMade) return !isKingInCheck(result.state, nextColor);
      return [...legalDests(result.state).values()].some(targets => targets.length > 0);
    }),
  );
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
  return playCard(state, action.cardId, action.target, action.cardInstanceId);
}
