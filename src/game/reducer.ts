import { Board } from 'chessops/board';
import { attacks } from 'chessops/attacks';
import { Castles, Chess, castlingSide } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { makeBoardFen, makeFen, parseFen } from 'chessops/fen';
import { SquareSet } from 'chessops/squareSet';
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
  AnathemaTarget,
  ApplyResult,
  BoardOrientation,
  CardMove,
  Color,
  EnPassantOpportunity,
  EvangelistsTarget,
  GameAction,
  GameErrorCode,
  GameState,
  HolyWarTarget,
  PieceState,
  Role,
  SiegeTarget,
  SquareName,
} from './types.js';

const SQUARE = /^[a-h][1-8]$/;
const CORNERS: readonly SquareName[] = ['a1', 'a8', 'h1', 'h8'];
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
  setup.epSquare = state.enPassant.length === 1 && state.orientation === 0
    ? parseSquare(state.enPassant[0].target)
    : undefined;
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
  const dests = chessgroundDests(position);
  for (const piece of state.pieces) {
    if (
      piece.zone !== 'board'
      || !piece.square
      || (piece.owner !== state.turn.color && !piece.neutral)
      || piece.role !== 'pawn'
    ) continue;
    for (const opportunity of state.enPassant) {
      const capture = enPassantCapture(state, piece.square, opportunity.target);
      if (!capture) continue;
      const result = resolveEnPassant(state, piece.id, capture.victim.id, opportunity.target);
      if (isKingInCheck(result, state.turn.color)) continue;
      const targets = new Set(dests.get(piece.square) ?? []);
      targets.add(opportunity.target);
      dests.set(piece.square, [...targets]);
    }
  }
  for (const [from, targets] of dests) {
    const moving = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    const legal = targets.filter(to => {
      const promotes = moving?.role === 'pawn' && (to.endsWith('1') || to.endsWith('8'));
      return movePiece(state, { type: 'move', from, to, ...(promotes ? { promotion: 'queen' } : {}) }).ok;
    });
    if (legal.length) dests.set(from, legal);
    else dests.delete(from);
  }
  return dests;
}

function turnView(state: GameState, color: Color): GameState {
  const view = structuredClone(state);
  view.turn = {
    color,
    phase: 'beforeMove',
    moveMade: false,
    cardPlays: { white: 0, black: 0 },
  };
  return view;
}

function hasLegalMove(state: GameState, color: Color): boolean {
  return [...legalDests(turnView(state, color)).values()].some(dests => dests.length > 0);
}

function isOrdinaryCheckmate(state: GameState, color: Color): boolean {
  return isKingInCheck(state, color) && !hasLegalMove(state, color);
}

function isOrdinaryStalemate(state: GameState, color: Color): boolean {
  return !isKingInCheck(state, color) && !hasLegalMove(state, color);
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

function pawnForward(state: GameState, owner: Color): readonly [number, number] {
  const [file, rank] = FANATIC_FORWARD[state.orientation];
  const direction = owner === 'white' ? 1 : -1;
  return [file * direction, rank * direction];
}

export function cowardiceDests(state: GameState, from: SquareName): SquareName[] {
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !pawn
    || (!pawn.neutral && pawn.owner === state.turn.color)
    || pawn.originalRole !== 'pawn'
    || pawn.promoted
  ) return [];

  const source = parseSquare(from);
  const [forwardFile, forwardRank] = pawnForward(state, pawn.owner);
  const board = setupFor(state).board;
  const destinations: SquareName[] = [];
  for (const distance of [1, 2]) {
    const file = squareFile(source) - forwardFile * distance;
    const rank = squareRank(source) - forwardRank * distance;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) break;
    const destination = rank * 8 + file;
    if (board.has(destination)) break;
    destinations.push(makeSquare(destination));
  }
  return destinations;
}

function onStartingSquare(state: GameState, owner: Color, square: SquareName): boolean {
  const [fileStep, rankStep] = pawnForward(state, owner);
  const squareIndex = parseSquare(square);
  if (fileStep === 1) return squareFile(squareIndex) === 1;
  if (fileStep === -1) return squareFile(squareIndex) === 6;
  if (rankStep === 1) return squareRank(squareIndex) === 1;
  return squareRank(squareIndex) === 6;
}

export function annexationDests(state: GameState, from: SquareName): SquareName[] {
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !pawn
    || (pawn.owner !== state.turn.color && !pawn.neutral)
    || pawn.originalRole !== 'pawn'
    || pawn.promoted
  ) return [];

  const square = parseSquare(from);
  const [fileStep, rankStep] = pawnForward(state, pawn.owner);
  const board = setupFor(state).board;
  const middleFile = squareFile(square) + fileStep;
  const middleRank = squareRank(square) + rankStep;
  const targetFile = squareFile(square) + fileStep * 2;
  const targetRank = squareRank(square) + rankStep * 2;
  if (
    middleFile < 0 || middleFile > 7 || middleRank < 0 || middleRank > 7
    || targetFile < 0 || targetFile > 7 || targetRank < 0 || targetRank > 7
  ) return [];
  const middle = middleRank * 8 + middleFile;
  const target = targetRank * 8 + targetFile;
  return board.has(middle) || board.has(target) ? [] : [makeSquare(target)];
}

export function onslaughtDests(state: GameState, from: SquareName): SquareName[] {
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !pawn
    || (pawn.owner !== state.turn.color && !pawn.neutral)
    || pawn.originalRole !== 'pawn'
    || pawn.promoted
  ) return [];

  const square = parseSquare(from);
  const [fileStep, rankStep] = pawnForward(state, pawn.owner);
  const file = squareFile(square) + fileStep;
  const rank = squareRank(square) + rankStep;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return [];
  const target = rank * 8 + file;
  return setupFor(state).board.has(target) ? [] : [makeSquare(target)];
}

export function longJumpDests(state: GameState, from: SquareName): SquareName[] {
  const knight = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !knight
    || (knight.owner !== state.turn.color && !knight.neutral)
    || (knight.role !== 'knight' && knight.originalRole !== 'knight')
  ) return [];

  const source = parseSquare(from);
  const sourceColor = (squareFile(source) + squareRank(source)) % 2;
  const board = setupFor(state).board;
  const destinations: SquareName[] = [];
  for (let square = 0; square < 64; square += 1) {
    if (
      !board.has(square)
      && (squareFile(square) + squareRank(square)) % 2 !== sourceColor
    ) destinations.push(makeSquare(square));
  }
  return destinations;
}

export function dubbingDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  if (!piece || (piece.owner !== state.turn.color && !piece.neutral)) return [];

  const board = setupFor(state).board;
  return [...attacks({ color: piece.owner, role: 'knight' }, parseSquare(from), board.occupied).diff(board.occupied)]
    .map(makeSquare);
}

export function squaringTheCircleDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  if (!piece || (piece.owner !== state.turn.color && !piece.neutral)) return [];

  const occupied = new Set(state.pieces.flatMap(candidate =>
    candidate.zone === 'board' && candidate.square ? [candidate.square] : [],
  ));
  const emptyCorners = CORNERS.filter(square => !occupied.has(square));
  return emptyCorners.length === 1 ? emptyCorners : [];
}

function revokeCastlingRights(
  setup: ReturnType<typeof setupFor>,
  movedPieces: readonly PieceState[],
): void {
  for (const piece of movedPieces) {
    if (piece.royal) {
      setup.castlingRights = setup.castlingRights.diff(SquareSet.backrank(piece.owner));
    } else if (piece.role === 'rook' || piece.originalRole === 'rook') {
      const origin = piece.id.slice(-2);
      const square = SQUARE.test(origin) ? origin as SquareName : piece.square;
      if (square) setup.castlingRights = setup.castlingRights.without(parseSquare(square));
    }
  }
}

function syncFen(state: GameState, movedPieces: readonly PieceState[] = []): void {
  const setup = setupFor(state);
  revokeCastlingRights(setup, movedPieces);
  state.fen = makeFen(setup);
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
  if (isOrdinaryCheckmate(state, color)) {
    state.outcome = { winner: opposite(color), reason: 'checkmate' };
  } else if (isOrdinaryStalemate(state, color)) {
    state.outcome = { reason: 'stalemate' };
  }
}

function isRoyalInCheck(state: GameState, piece: PieceState): boolean {
  if (piece.zone !== 'board' || !piece.square) return false;
  const position = positionFor(state, piece.owner);
  return position.kingAttackers(parseSquare(piece.square), opposite(piece.owner), position.board.occupied).nonEmpty()
    || state.pieces.some(neutral =>
      neutral.neutral
      && neutral.zone === 'board'
      && neutral.square
      && attacks(
        { color: neutral.owner, role: neutral.role },
        parseSquare(neutral.square),
        position.board.occupied,
      ).has(parseSquare(piece.square!)),
    );
}

function isKingInCheck(state: GameState, color: Color): boolean {
  const royals = state.pieces.filter(
    piece => piece.owner === color && piece.royal && piece.zone === 'board' && piece.square,
  );
  return royals.length
    ? royals.some(piece => isRoyalInCheck(state, piece))
    : positionFor(state, color).isCheck();
}

function cardMoveLeavesRoyalInCheck(
  state: GameState,
  color: Color,
  movedPieces: readonly PieceState[],
): boolean {
  if (isKingInCheck(state, color)) return true;
  return movedPieces.some(moved => {
    if (!moved.neutral || !moved.royal || moved.owner === color) return false;
    const royal = state.pieces.find(piece => piece.id === moved.id);
    return royal ? isRoyalInCheck(state, royal) : false;
  });
}

function enPassantCapture(state: GameState, from: SquareName, to: SquareName) {
  const moving = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  const opportunity = state.enPassant.find(candidate => candidate.target === to);
  const victim = opportunity
    ? state.pieces.find(piece => piece.id === opportunity.pawnId && piece.zone === 'board' && piece.square)
    : undefined;
  if (
    !moving
    || (moving.owner !== state.turn.color && !moving.neutral)
    || moving.role !== 'pawn'
    || !victim
    || (!moving.neutral && !victim.neutral && victim.owner === moving.owner)
    || victim.royal
    || state.pieces.some(piece => piece.zone === 'board' && piece.square === to)
  ) return undefined;

  const source = parseSquare(from);
  const target = parseSquare(to);
  const victimSquare = parseSquare(victim.square!);
  const [forwardFile, forwardRank] = pawnForward(state, moving.owner);
  const fileDelta = squareFile(target) - squareFile(source);
  const rankDelta = squareRank(target) - squareRank(source);
  const diagonal = Math.abs(fileDelta) + Math.abs(rankDelta) === 2
    && fileDelta * forwardFile + rankDelta * forwardRank === 1;
  const victimBehindTarget = squareFile(victimSquare) === squareFile(target) - forwardFile
    && squareRank(victimSquare) === squareRank(target) - forwardRank;
  return diagonal && victimBehindTarget ? { moving, victim } : undefined;
}

function resolveEnPassant(
  state: GameState,
  movingId: string,
  victimId: string,
  target: SquareName,
): GameState {
  const next = structuredClone(state);
  next.pieces.find(piece => piece.id === movingId)!.square = target;
  const victim = next.pieces.find(piece => piece.id === victimId)!;
  victim.square = null;
  victim.zone = 'captured';
  next.enPassant = [];
  return next;
}

function completeReplacementMove(
  state: GameState,
  color: Color,
  pawnMoved: boolean,
  enPassant: EnPassantOpportunity[] = [],
  movedPieces: readonly PieceState[] = [],
): void {
  const setup = setupFor(state);
  revokeCastlingRights(setup, movedPieces);
  setup.turn = opposite(color);
  setup.epSquare = enPassant.length === 1 && state.orientation === 0
    ? parseSquare(enPassant[0].target)
    : undefined;
  setup.halfmoves = pawnMoved ? 0 : setup.halfmoves + 1;
  if (color === 'black') setup.fullmoves += 1;
  state.fen = makeFen(setup);
  state.enPassant = enPassant;
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

  if (!isOrdinaryCheckmate(state, opposite(color)) && isOrdinaryCheckmate(resolved, opposite(color))) {
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

  if (isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'fanatic', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, [pawn])) {
    return fizzleCard(state, 'fanatic', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(resolved, color, true, [], [pawn]);
  spendCard(resolved, 'fanatic', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'fanatic', target: targetSquare });
  return { ok: true, state: resolved };
}

function parseCardMoves(target: unknown, maximum = 2): CardMove[] | undefined {
  if (!Array.isArray(target) || target.length < 1 || target.length > maximum) return undefined;
  const moves: CardMove[] = [];
  for (const candidate of target) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
    const { from, to } = candidate as Record<string, unknown>;
    if (typeof from !== 'string' || typeof to !== 'string' || !SQUARE.test(from) || !SQUARE.test(to)) {
      return undefined;
    }
    moves.push({ from: from as SquareName, to: to as SquareName });
  }
  return moves;
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
  const moves = parseCardMoves(target);
  if (!moves) return reject(state, 'INVALID_TARGET', 'Choose one or two valid Pawn moves.');
  if (new Set(moves.map(move => move.from)).size !== moves.length) {
    return reject(state, 'INVALID_TARGET', 'Choose each Pawn only once.');
  }
  if (new Set(moves.map(move => move.to)).size !== moves.length) {
    return reject(state, 'ILLEGAL_MOVE', 'Each Pawn needs a different destination.');
  }

  const pawns: PieceState[] = [];
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
    pawns.push(pawn);
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  moves.forEach((move, index) => {
    resolved.pieces.find(piece => piece.id === pawns[index].id)!.square = move.to;
  });

  if (isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'forced-march', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, pawns)) {
    return fizzleCard(state, 'forced-march', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(resolved, color, true, [], pawns);
  spendCard(resolved, 'forced-march', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'forced-march', target: moves });
  return { ok: true, state: resolved };
}

function playAnnexation(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'annexation' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Annexation is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Annexation is played instead of the regular move.');
  }
  const moves = parseCardMoves(target);
  if (!moves) return reject(state, 'INVALID_TARGET', 'Choose one or two valid Pawn moves.');
  if (new Set(moves.map(move => move.from)).size !== moves.length) {
    return reject(state, 'INVALID_TARGET', 'Choose each Pawn only once.');
  }
  if (new Set(moves.map(move => move.to)).size !== moves.length) {
    return reject(state, 'ILLEGAL_MOVE', 'Each Pawn needs a different destination.');
  }

  const pawns: PieceState[] = [];
  for (const move of moves) {
    const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
    if (!pawn) return reject(state, 'INVALID_TARGET', `There is no Pawn on ${move.from}.`);
    if (pawn.owner !== color && !pawn.neutral) {
      return reject(state, 'WRONG_OWNER', 'Choose one of your own Pawns.');
    }
    if (pawn.originalRole !== 'pawn' || pawn.promoted) {
      return reject(state, 'WRONG_ROLE', 'Annexation can target only an unpromoted Pawn.');
    }
    if (!annexationDests(state, move.from).includes(move.to)) {
      return reject(state, 'ILLEGAL_MOVE', 'Each Pawn needs two clear forward squares.');
    }
    pawns.push(pawn);
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  moves.forEach((move, index) => {
    resolved.pieces.find(piece => piece.id === pawns[index].id)!.square = move.to;
  });

  const enPassant = moves.flatMap((move, index): EnPassantOpportunity[] => {
    const pawn = pawns[index];
    if (!onStartingSquare(state, pawn.owner, move.from)) return [];
    const from = parseSquare(move.from);
    const [fileStep, rankStep] = pawnForward(state, pawn.owner);
    return [{
      target: makeSquare((squareRank(from) + rankStep) * 8 + squareFile(from) + fileStep),
      pawnId: pawn.id,
    }];
  });
  const completed = structuredClone(resolved);
  completeReplacementMove(completed, color, true, enPassant, pawns);
  const defender = opposite(color);
  if (isOrdinaryCheckmate(completed, defender)) {
    return fizzleCard(state, 'annexation', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, pawns)) {
    return fizzleCard(state, 'annexation', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(completed, 'annexation', cardInstanceId);
  completed.history.push({ type: 'cardPlayed', cardId: 'annexation', target: moves });
  return { ok: true, state: completed };
}

function playOnslaught(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'onslaught' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Onslaught is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Onslaught is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, state.pieces.length);
  if (!moves) return reject(state, 'INVALID_TARGET', 'Choose one or more valid Pawn moves.');
  if (new Set(moves.map(move => move.from)).size !== moves.length) {
    return reject(state, 'INVALID_TARGET', 'Choose each Pawn only once.');
  }
  if (new Set(moves.map(move => move.to)).size !== moves.length) {
    return reject(state, 'ILLEGAL_MOVE', 'Each Pawn needs a different destination.');
  }

  const pawns: PieceState[] = [];
  for (const move of moves) {
    const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
    if (!pawn) return reject(state, 'INVALID_TARGET', `There is no Pawn on ${move.from}.`);
    if (pawn.owner !== color && !pawn.neutral) {
      return reject(state, 'WRONG_OWNER', 'Choose one of your own Pawns.');
    }
    if (pawn.originalRole !== 'pawn' || pawn.promoted) {
      return reject(state, 'WRONG_ROLE', 'Onslaught can target only an unpromoted Pawn.');
    }
    if (!onslaughtDests(state, move.from).includes(move.to)) {
      return reject(state, 'ILLEGAL_MOVE', 'Each Pawn must move one square forward to an empty square.');
    }
    pawns.push(pawn);
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  moves.forEach((move, index) => {
    resolved.pieces.find(piece => piece.id === pawns[index].id)!.square = move.to;
  });

  if (isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'onslaught', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, pawns)) {
    return fizzleCard(state, 'onslaught', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(resolved, color, true, [], pawns);
  spendCard(resolved, 'onslaught', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'onslaught', target: moves });
  return { ok: true, state: resolved };
}

function playLongJump(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'long-jump' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Long Jump is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Long Jump is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1) {
    return reject(state, 'INVALID_TARGET', 'Choose one valid Knight move.');
  }
  const [move] = moves;
  const knight = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!knight) return reject(state, 'INVALID_TARGET', `There is no Knight on ${move.from}.`);
  if (knight.owner !== color && !knight.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose one of your own Knights.');
  }
  if (knight.role !== 'knight' && knight.originalRole !== 'knight') {
    return reject(state, 'WRONG_ROLE', 'Long Jump can target only a Knight.');
  }
  if (!longJumpDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Choose an empty square of the opposite color.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === knight.id)!.square = move.to;
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'long-jump', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, [knight])) {
    return fizzleCard(state, 'long-jump', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(resolved, color, false, [], [knight]);
  spendCard(resolved, 'long-jump', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'long-jump', target: moves });
  return { ok: true, state: resolved };
}

function playDubbing(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'dubbing' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Dubbing is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Dubbing is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1) {
    return reject(state, 'INVALID_TARGET', 'Choose one valid piece move.');
  }
  const [move] = moves;
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === move.from);
  if (!piece) return reject(state, 'INVALID_TARGET', `There is no piece on ${move.from}.`);
  if (piece.owner !== color && !piece.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  }
  if (!dubbingDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Move the piece like a Knight to an empty square.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'dubbing', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, [piece])) {
    return fizzleCard(state, 'dubbing', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(
    resolved,
    color,
    piece.originalRole === 'pawn' && !piece.promoted,
    [],
    [piece],
  );
  spendCard(resolved, 'dubbing', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'dubbing', target: moves });
  return { ok: true, state: resolved };
}

function playSquaringTheCircle(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'squaring-the-circle' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Squaring the Circle is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Squaring the Circle is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1) {
    return reject(state, 'INVALID_TARGET', 'Choose one piece and the empty corner.');
  }
  const [move] = moves;
  const occupiedCorners = CORNERS.filter(square =>
    state.pieces.some(piece => piece.zone === 'board' && piece.square === square),
  );
  if (occupiedCorners.length !== 3) {
    return reject(state, 'ILLEGAL_MOVE', 'Exactly three of the four corners must be occupied.');
  }
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === move.from);
  if (!piece) return reject(state, 'INVALID_TARGET', `There is no piece on ${move.from}.`);
  if (piece.owner !== color && !piece.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  }
  if (!squaringTheCircleDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Move the piece to the sole empty corner.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'squaring-the-circle', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, [piece])) {
    return fizzleCard(state, 'squaring-the-circle', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  completeReplacementMove(
    resolved,
    color,
    piece.originalRole === 'pawn' && !piece.promoted,
    [],
    [piece],
  );
  spendCard(resolved, 'squaring-the-circle', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'squaring-the-circle', target: moves });
  return { ok: true, state: resolved };
}

function playCowardice(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'cowardice' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Cowardice is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Cowardice is played after the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1) {
    return reject(state, 'INVALID_TARGET', "Choose one valid opposing Pawn move.");
  }
  const [move] = moves;
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!pawn) return reject(state, 'INVALID_TARGET', `There is no Pawn on ${move.from}.`);
  if (!pawn.neutral && pawn.owner === color) {
    return reject(state, 'WRONG_OWNER', "Choose one of your opponent's Pawns.");
  }
  if (pawn.originalRole !== 'pawn' || pawn.promoted) {
    return reject(state, 'WRONG_ROLE', 'Cowardice can target only an unpromoted original Pawn.');
  }
  if (!cowardiceDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Move the Pawn one or two clear squares backward.');
  }

  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === pawn.id)!.square = move.to;
  syncFen(resolved);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'cowardice', 'DIRECT_MATE', cardInstanceId);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, [pawn])) {
    return fizzleCard(state, 'cowardice', 'SELF_CHECK', cardInstanceId);
  }

  spendCard(resolved, 'cowardice', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'cowardice', target: moves });
  return { ok: true, state: resolved };
}

const SWAP_CARDS = {
  'holy-war': {
    name: 'Holy War', firstField: 'knight', firstRole: 'knight', firstOwner: 'own',
    secondField: 'bishop', secondRole: 'bishop', secondOwner: 'own', replacesMove: false,
  },
  anathema: {
    name: 'Anathema', firstField: 'bishop', firstRole: 'bishop', firstOwner: 'opponent',
    secondField: 'rook', secondRole: 'rook', secondOwner: 'opponent', replacesMove: false,
  },
  'holy-quest': {
    name: 'Holy Quest', firstField: 'bishop', firstRole: 'bishop', firstOwner: 'opponent',
    secondField: 'knight', secondRole: 'knight', secondOwner: 'opponent', replacesMove: false,
  },
  treason: {
    name: 'Treason', firstField: 'rook', firstRole: 'rook', firstOwner: 'opponent',
    secondField: 'knight', secondRole: 'knight', secondOwner: 'opponent', replacesMove: false,
  },
  cathedral: {
    name: 'Cathedral', firstField: 'rook', firstRole: 'rook', firstOwner: 'own',
    secondField: 'bishop', secondRole: 'bishop', secondOwner: 'own', replacesMove: false,
  },
  siege: {
    name: 'Siege', firstField: 'knight', firstRole: 'knight', firstOwner: 'own',
    secondField: 'rook', secondRole: 'rook', secondOwner: 'own', replacesMove: false,
  },
  evangelists: {
    name: 'Evangelists', firstField: 'own', firstRole: 'bishop', firstOwner: 'own',
    secondField: 'opponent', secondRole: 'bishop', secondOwner: 'opponent', replacesMove: true,
  },
  tournament: {
    name: 'Tournament', firstField: 'own', firstRole: 'knight', firstOwner: 'own',
    secondField: 'opponent', secondRole: 'knight', secondOwner: 'opponent', replacesMove: true,
  },
  'lost-castle': {
    name: 'Lost Castle', firstField: 'own', firstRole: 'rook', firstOwner: 'own',
    secondField: 'opponent', secondRole: 'rook', secondOwner: 'opponent', replacesMove: true,
  },
} as const;

type SwapCardId = keyof typeof SWAP_CARDS;

function playSwapCard(
  state: GameState,
  cardId: SwapCardId,
  target: unknown,
  cardInstanceId?: unknown,
): ApplyResult {
  const color = state.turn.color;
  const config = SWAP_CARDS[cardId];
  const firstName = config.firstRole[0].toUpperCase() + config.firstRole.slice(1);
  const secondName = config.secondRole[0].toUpperCase() + config.secondRole.slice(1);
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === cardId && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', `${config.name} is not in your hand.`);
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (
    config.replacesMove
      ? state.turn.phase !== 'beforeMove' || state.turn.moveMade
      : state.turn.phase !== 'afterMove' || !state.turn.moveMade
  ) {
    return reject(
      state,
      'INVALID_TIMING',
      config.replacesMove
        ? `${config.name} is played instead of the regular move.`
        : `${config.name} is played after the regular move.`,
    );
  }
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return reject(state, 'INVALID_TARGET', `Choose one ${firstName} and one ${secondName}.`);
  }
  const fields = target as Record<string, unknown>;
  const firstSquare = fields[config.firstField];
  const secondSquare = fields[config.secondField];
  if (
    typeof firstSquare !== 'string'
    || typeof secondSquare !== 'string'
    || !SQUARE.test(firstSquare)
    || !SQUARE.test(secondSquare)
    || firstSquare === secondSquare
  ) {
    return reject(state, 'INVALID_TARGET', `Choose distinct ${firstName} and ${secondName} squares.`);
  }
  const parsedTarget: HolyWarTarget | AnathemaTarget | SiegeTarget | EvangelistsTarget = cardId === 'holy-war'
    ? { knight: firstSquare as SquareName, bishop: secondSquare as SquareName }
    : cardId === 'anathema'
      ? { bishop: firstSquare as SquareName, rook: secondSquare as SquareName }
      : cardId === 'holy-quest'
        ? { bishop: firstSquare as SquareName, knight: secondSquare as SquareName }
        : cardId === 'treason'
          ? { rook: firstSquare as SquareName, knight: secondSquare as SquareName }
          : cardId === 'cathedral'
            ? { rook: firstSquare as SquareName, bishop: secondSquare as SquareName }
            : cardId === 'siege'
              ? { knight: firstSquare as SquareName, rook: secondSquare as SquareName }
              : { own: firstSquare as SquareName, opponent: secondSquare as SquareName };
  const firstPiece = state.pieces.find(
    piece => piece.zone === 'board' && piece.square === firstSquare,
  );
  const secondPiece = state.pieces.find(
    piece => piece.zone === 'board' && piece.square === secondSquare,
  );
  if (!firstPiece || !secondPiece) {
    return reject(state, 'INVALID_TARGET', 'Both selected squares must contain pieces.');
  }
  const validOwner = (piece: PieceState, owner: 'own' | 'opponent') => piece.neutral
    || (owner === 'own' ? piece.owner === color : piece.owner !== color);
  if (
    !validOwner(firstPiece, config.firstOwner)
    || !validOwner(secondPiece, config.secondOwner)
  ) {
    return reject(
      state,
      'WRONG_OWNER',
      cardId === 'holy-war' || cardId === 'cathedral' || cardId === 'siege'
        ? 'Choose pieces you control.'
        : cardId === 'anathema' || cardId === 'holy-quest' || cardId === 'treason'
          ? 'Choose pieces belonging to your opponent.'
          : `Choose one of your ${firstName}s and one of your opponent's ${secondName}s.`,
    );
  }
  if (
    (firstPiece.role !== config.firstRole && firstPiece.originalRole !== config.firstRole)
    || (secondPiece.role !== config.secondRole && secondPiece.originalRole !== config.secondRole)
  ) {
    return reject(state, 'WRONG_ROLE', `Choose a ${firstName} and a ${secondName}.`);
  }

  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === firstPiece.id)!.square = secondSquare as SquareName;
  resolved.pieces.find(piece => piece.id === secondPiece.id)!.square = firstSquare as SquareName;
  syncFen(resolved, config.replacesMove ? [firstPiece, secondPiece] : []);
  const defender = opposite(color);
  const consumesMove = config.replacesMove && !isKingInCheck(state, color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (cardMoveLeavesRoyalInCheck(resolved, color, [firstPiece, secondPiece])) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId, consumesMove);
  }

  if (config.replacesMove) completeReplacementMove(resolved, color, false);
  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId, target: parsedTarget });
  return { ok: true, state: resolved };
}

function playNoQuarter(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'no-quarter' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'No Quarter is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'No Quarter must immediately follow your capturing move.');
  }
  if (target !== undefined) {
    return reject(state, 'INVALID_TARGET', 'No Quarter does not take a target.');
  }

  const move = state.history.at(-1);
  const captured = move?.type === 'move' && move.capturedId
    ? state.pieces.find(piece => piece.id === move.capturedId)
    : undefined;
  const mover = move?.type === 'move' && move.to
    ? state.pieces.find(piece => piece.zone === 'board' && piece.square === move.to)
    : undefined;
  if (
    !captured
    || captured.zone !== 'captured'
    || captured.square !== null
    || captured.owner === color
    || !mover
    || mover.owner !== color
  ) {
    return reject(state, 'INVALID_TIMING', 'No Quarter must immediately follow your ordinary move capturing an enemy piece.');
  }

  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === captured.id)!.zone = 'dead';
  spendCard(resolved, 'no-quarter', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'no-quarter' });
  return { ok: true, state: resolved };
}

function playCard(state: GameState, cardId: string, target: unknown, cardInstanceId?: unknown): ApplyResult {
  if (cardId === 'disintegration') return playDisintegration(state, target, cardInstanceId);
  if (cardId === 'fanatic') return playFanatic(state, target, cardInstanceId);
  if (cardId === 'annexation') return playAnnexation(state, target, cardInstanceId);
  if (cardId === 'forced-march') return playForcedMarch(state, target, cardInstanceId);
  if (cardId === 'onslaught') return playOnslaught(state, target, cardInstanceId);
  if (cardId === 'long-jump') return playLongJump(state, target, cardInstanceId);
  if (cardId === 'dubbing') return playDubbing(state, target, cardInstanceId);
  if (cardId === 'squaring-the-circle') return playSquaringTheCircle(state, target, cardInstanceId);
  if (cardId === 'cowardice') return playCowardice(state, target, cardInstanceId);
  if (cardId === 'no-quarter') return playNoQuarter(state, target, cardInstanceId);
  if (cardId === 'holy-war' || cardId === 'anathema' || cardId === 'holy-quest' || cardId === 'treason' || cardId === 'cathedral' || cardId === 'siege' || cardId === 'evangelists' || cardId === 'tournament' || cardId === 'lost-castle') {
    return playSwapCard(state, cardId, target, cardInstanceId);
  }
  return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
}

function cardPlayTargets(state: GameState, cardId: string): unknown[] {
  if (cardId === 'holy-war' || cardId === 'anathema' || cardId === 'holy-quest' || cardId === 'treason' || cardId === 'cathedral' || cardId === 'siege' || cardId === 'evangelists' || cardId === 'tournament' || cardId === 'lost-castle') {
    const config = SWAP_CARDS[cardId];
    const matchesOwner = (piece: PieceState, owner: 'own' | 'opponent') => piece.neutral
      || (owner === 'own' ? piece.owner === state.turn.color : piece.owner !== state.turn.color);
    const candidates = state.pieces.filter(piece => piece.zone === 'board' && piece.square);
    const firstPieces = candidates.filter(piece =>
      matchesOwner(piece, config.firstOwner)
      && (piece.role === config.firstRole || piece.originalRole === config.firstRole),
    );
    const secondPieces = candidates.filter(piece =>
      matchesOwner(piece, config.secondOwner)
      && (piece.role === config.secondRole || piece.originalRole === config.secondRole),
    );
    const targets: Array<HolyWarTarget | AnathemaTarget | SiegeTarget | EvangelistsTarget> = [];
    for (const first of firstPieces) {
      for (const second of secondPieces) {
        if (first.id === second.id) continue;
        if (cardId === 'holy-war') targets.push({ knight: first.square!, bishop: second.square! });
        else if (cardId === 'anathema') targets.push({ bishop: first.square!, rook: second.square! });
        else if (cardId === 'holy-quest') targets.push({ bishop: first.square!, knight: second.square! });
        else if (cardId === 'treason') targets.push({ rook: first.square!, knight: second.square! });
        else if (cardId === 'cathedral') targets.push({ rook: first.square!, bishop: second.square! });
        else if (cardId === 'siege') targets.push({ knight: first.square!, rook: second.square! });
        else targets.push({ own: first.square!, opponent: second.square! });
      }
    }
    return targets;
  }
  if (cardId !== 'forced-march' && cardId !== 'annexation' && cardId !== 'onslaught' && cardId !== 'long-jump' && cardId !== 'dubbing' && cardId !== 'squaring-the-circle' && cardId !== 'cowardice') {
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square ? [piece.square] : []);
  }

  const steps = state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square
      ? (cardId === 'forced-march'
          ? forcedMarchDests
          : cardId === 'annexation'
            ? annexationDests
            : cardId === 'onslaught'
              ? onslaughtDests
              : cardId === 'long-jump'
                ? longJumpDests
                : cardId === 'dubbing'
                  ? dubbingDests
                  : cardId === 'squaring-the-circle'
                    ? squaringTheCircleDests
                  : cowardiceDests)(state, piece.square)
          .map(to => ({ from: piece.square!, to }))
      : [],
  );
  if (cardId === 'long-jump' || cardId === 'dubbing' || cardId === 'squaring-the-circle' || cardId === 'cowardice') {
    return steps.map(step => [step]);
  }
  if (cardId === 'onslaught') {
    return steps.reduce<CardMove[][]>(
      (groups, step) => [...groups, [step], ...groups.map(group => [...group, step])],
      [],
    );
  }
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
  const moving = state.pieces.find(piece => piece.zone === 'board' && piece.square === fromName);
  if (!moving) return reject(state, 'ILLEGAL_MOVE', 'There is no movable piece on that square.');
  const customEnPassant = enPassantCapture(state, fromName, toName);
  if (state.pieces.some(piece =>
    piece.zone === 'board' && piece.square === toName && piece.owner !== state.turn.color && piece.royal,
  )) {
    return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
  }
  // ponytail: orthodox move safety for now; stage moves only when the first same-turn rescue card lands.
  if (!position.isLegal(move) && !customEnPassant) {
    return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }

  if (customEnPassant) {
    const next = resolveEnPassant(state, moving.id, customEnPassant.victim.id, toName);
    if (
      isKingInCheck(next, state.turn.color)
      || (moving.neutral && isKingInCheck(next, opposite(state.turn.color)))
    ) {
      return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
    }
    const setup = setupFor(next);
    setup.turn = opposite(state.turn.color);
    setup.epSquare = undefined;
    setup.halfmoves = 0;
    if (state.turn.color === 'black') setup.fullmoves += 1;
    next.fen = makeFen(setup);
    next.turn.phase = 'afterMove';
    next.turn.moveMade = true;
    next.history.push({
      type: 'move',
      from: fromName,
      to: toName,
      capturedId: customEnPassant.victim.id,
    });
    return { ok: true, state: next };
  }

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
  if (isKingInCheck(next, state.turn.color)) {
    return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }
  next.fen = makeFen(position.toSetup());
  next.enPassant = position.epSquare === undefined
    ? []
    : [{ target: makeSquare(position.epSquare), pawnId: moving.id }];
  next.turn.phase = 'afterMove';
  next.turn.moveMade = true;
  next.history.push({
    type: 'move',
    from: fromName,
    to: toName,
    ...(promotion ? { promotion } : {}),
    ...(captured ? { capturedId: captured.id } : {}),
  });
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
  const canEscapeWithCard = next.players[nextColor].hand.some(card =>
    cardPlayTargets(next, card.cardId).some(target => {
      const result = playCard(next, card.cardId, target, card.id);
      if (!result.ok || result.state.outcome) return false;
      if (result.state.history.at(-1)?.type !== 'cardPlayed') return false;
      if (result.state.turn.moveMade) return !isKingInCheck(result.state, nextColor);
      return [...legalDests(result.state).values()].some(targets => targets.length > 0);
    }),
  );
  if (isOrdinaryCheckmate(next, nextColor) && !canEscapeWithCard) {
    next.outcome = { winner: state.turn.color, reason: 'checkmate' };
  } else if (isOrdinaryStalemate(next, nextColor) && !canEscapeWithCard) {
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
