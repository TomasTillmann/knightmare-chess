import { Board } from 'chessops/board';
import { attacks } from 'chessops/attacks';
import { Castles, Chess, castlingSide, pseudoDests } from 'chessops/chess';
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

import { canBeEnPassantVictim } from './state.js';
import type {
  AnathemaTarget,
  ApplyResult,
  BoardOrientation,
  CardInstance,
  CardMove,
  Color,
  DoomsayerEffect,
  DoomsayerRole,
  EnPassantOpportunity,
  EvangelistsTarget,
  GameAction,
  GameErrorCode,
  GameState,
  HolyWarTarget,
  PacifismEffect,
  PieceState,
  Role,
  SiegeTarget,
  SquareName,
} from './types.js';

const SQUARE = /^[a-h][1-8]$/;
const CORNERS: readonly SquareName[] = ['a1', 'a8', 'h1', 'h8'];
const PROMOTIONS = new Set<Role>(['queen', 'rook', 'bishop', 'knight']);
const DOOMSAYER_ROLES = new Set<DoomsayerRole>(['pawn', 'knight', 'bishop', 'rook', 'queen']);
const FANATIC_FORWARD: Record<BoardOrientation, readonly [number, number]> = {
  0: [0, 1],
  90: [1, 0],
  180: [0, -1],
  270: [-1, 0],
};

function reject(state: GameState, code: GameErrorCode, message: string): ApplyResult {
  return { ok: false, state, error: { code, message } };
}

function effectRecord(effect: unknown): Record<string, unknown> | undefined {
  return effect !== null && typeof effect === 'object' && !Array.isArray(effect)
    ? effect as Record<string, unknown>
    : undefined;
}

function effectKind(effect: unknown): string | undefined {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  const kind = record?.type ?? record?.cardId ?? card?.cardId;
  return typeof kind === 'string' ? kind.toLowerCase().replace(/[^a-z]/g, '') : undefined;
}

export function isDoomsayerEffect(effect: unknown): effect is DoomsayerEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return effectKind(effect) === 'doomsayer'
    && card?.cardId === 'doomsayer'
    && typeof card.id === 'string'
    && (record?.owner === 'white' || record?.owner === 'black');
}

export function activeDoomsayers(state: GameState): DoomsayerEffect[] {
  return state.effects.filter(isDoomsayerEffect);
}

function targetMatchesPiece(target: unknown, piece: PieceState): boolean {
  return target === piece.id || target === piece.square;
}

function captureForbidden(state: GameState, piece: PieceState): boolean {
  const flags = piece as unknown as Record<string, unknown>;
  if (flags.pacifist === true) return true;
  return state.effects.some(effect => {
    const record = effectRecord(effect);
    if (!record || record.active === false || record.suspended === true) return false;
    const kind = effectKind(effect);
    if (kind === 'truce') return true;
    if (kind !== 'pacifism') return false;
    const targets = record.pieceIds;
    return targetMatchesPiece(record.pieceId ?? record.targetId ?? record.target, piece)
      || (Array.isArray(targets) && targets.some(target => targetMatchesPiece(target, piece)));
  });
}

function captureImmune(state: GameState, piece: PieceState): boolean {
  const flags = piece as unknown as Record<string, unknown>;
  if (captureForbidden(state, piece) || flags.captureImmune === true || flags.mysticShield === true) {
    return true;
  }
  return state.effects.some(effect => {
    const record = effectRecord(effect);
    if (!record || record.active === false || record.suspended === true) return false;
    const kind = effectKind(effect);
    if (kind !== 'mysticshield') return false;
    const targets = record.pieceIds;
    return targetMatchesPiece(record.pieceId ?? record.targetId ?? record.target, piece)
      || (Array.isArray(targets) && targets.some(target => targetMatchesPiece(target, piece)));
  });
}

export function doomsayerTargets(
  state: GameState,
  player: Color,
  role: DoomsayerRole,
): PieceState[] {
  return state.pieces.filter(piece =>
    piece.owner === player
    && piece.zone === 'board'
    && piece.square
    && !piece.royal
    && (piece.role === role || (!piece.promoted && piece.originalRole === role))
    && !captureImmune(state, piece),
  );
}

function setupFor(state: GameState, turn?: Color) {
  const setup = parseFen(state.fen).unwrap();
  const fenTurn = setup.turn;
  const board = Board.empty();
  for (const piece of state.pieces) {
    if (piece.zone !== 'board' || !piece.square) continue;
    board.set(parseSquare(piece.square), { color: piece.owner, role: piece.role });
  }
  const opportunity = state.enPassant.length === 1 ? state.enPassant[0] : undefined;
  const victim = opportunity ? enPassantVictim(state, opportunity) : undefined;
  setup.board = board;
  setup.epSquare = opportunity && victim && state.orientation === 0
    ? parseSquare(opportunity.target)
    : undefined;
  if (turn) setup.turn = turn;
  if (turn && turn !== fenTurn) setup.epSquare = undefined;
  if (setup.epSquare !== undefined) {
    const forward = setup.turn === 'white' ? 8 : -8;
    const pawn = setup.epSquare - forward;
    const validRank = setup.turn === 'white' ? 5 : 2;
    if (
      squareRank(setup.epSquare) !== validRank
      || board.has(setup.epSquare)
      || board.has(setup.epSquare + forward)
      || !board.pawn.has(pawn)
      || !board[opposite(setup.turn)].has(pawn)
      || !victim
      || victim.square !== makeSquare(pawn)
    ) setup.epSquare = undefined;
  }
  return setup;
}

// Self-consistent orthodox projection for chessops move generation. Knightmare
// check and legality stay on the GameState helpers below.
export function positionFor(state: GameState, turn: Color = state.turn.color): Chess {
  const setup = setupFor(state, turn);
  for (const square of setup.castlingRights) {
    const name = makeSquare(square);
    const rook = state.pieces.find(piece => piece.zone === 'board' && piece.square === name);
    if (
      !rook
      || rook.role !== 'rook'
      || rook.originalRole !== 'rook'
      || rook.id.slice(-2) !== name
    ) setup.castlingRights = setup.castlingRights.without(square);
  }
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

export function legalDests(
  state: GameState,
  allowAfterMoveRescue = true,
): Map<SquareName, SquareName[]> {
  if (state.turn.moveMade || state.outcome) return new Map();
  const position = positionFor(state);
  const dests = chessgroundDests(position);
  const moveIsLegal = (piece: PieceState, to: SquareName): boolean => {
    const promotions: Array<Role | undefined> = piece.role === 'pawn'
      && isPromotionSquare(state, piece.owner, to)
      ? [...PROMOTIONS]
      : [undefined];
    return promotions.some(promotion => movePiece(
      state,
      { type: 'move', from: piece.square!, to, ...(promotion ? { promotion } : {}) },
      allowAfterMoveRescue,
    ).ok);
  };
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
      if (!moveIsLegal(piece, opportunity.target)) continue;
      const targets = new Set(dests.get(piece.square) ?? []);
      targets.add(opportunity.target);
      dests.set(piece.square, [...targets]);
    }
  }
  const context = position.ctx();
  for (const piece of state.pieces) {
    if (
      piece.zone !== 'board'
      || !piece.square
      || piece.neutral
      || piece.owner !== state.turn.color
    ) continue;
    const targets = new Set(dests.get(piece.square) ?? []);
    for (const square of pseudoDests(position, parseSquare(piece.square), context)) {
      const to = makeSquare(square);
      if (moveIsLegal(piece, to)) targets.add(to);
    }
    if (piece.royal && piece.originalRole === 'king') {
      for (const side of ['a', 'h'] as const) {
        const rook = position.castles.rook[state.turn.color][side];
        for (const square of [kingCastlesTo(state.turn.color, side), rook]) {
          if (square === undefined) continue;
          const to = makeSquare(square);
          if (moveIsLegal(piece, to)) targets.add(to);
        }
      }
    }
    for (const target of state.pieces) {
      if (
        !target.neutral
        || target.owner !== piece.owner
        || target.zone !== 'board'
        || !target.square
        || !pieceAttacksSquare(state, piece, target.square, position.board.occupied)
      ) continue;
      if (moveIsLegal(piece, target.square)) targets.add(target.square);
    }
    if (targets.size) dests.set(piece.square, [...targets]);
  }
  for (const piece of state.pieces) {
    if (
      piece.zone !== 'board'
      || !piece.square
      || (piece.owner !== state.turn.color && !piece.neutral)
      || (!piece.neutral && piece.role !== 'pawn')
    ) continue;
    const targets = new Set(dests.get(piece.square) ?? []);
    for (let square = 0; square < 64; square += 1) {
      const to = makeSquare(square);
      if (to === piece.square) continue;
      if (moveIsLegal(piece, to)) targets.add(to);
    }
    if (targets.size) dests.set(piece.square, [...targets]);
  }
  for (const [from, targets] of dests) {
    const moving = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    const legal = moving ? targets.filter(to => moveIsLegal(moving, to)) : [];
    if (legal.length) dests.set(from, legal);
    else dests.delete(from);
  }
  return dests;
}

function turnView(state: GameState, color: Color): GameState {
  const view = structuredClone(state);
  if (setupFor(state).turn !== color) view.enPassant = [];
  view.turn = {
    color,
    phase: 'beforeMove',
    moveMade: false,
    cardPlays: { white: 0, black: 0 },
  };
  return view;
}

function hasLegalMove(state: GameState, color: Color): boolean {
  return [...legalDests(turnView(state, color), false).values()].some(dests => dests.length > 0);
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

function doubleStepEnPassant(
  state: GameState,
  pawn: PieceState,
  from: SquareName,
  to: SquareName,
): EnPassantOpportunity[] {
  if (
    pawn.promoted
    || (pawn.role !== 'pawn' && pawn.originalRole !== 'pawn')
    || !onStartingSquare(state, pawn.owner, from)
  ) return [];
  const source = parseSquare(from);
  const target = parseSquare(to);
  const [fileStep, rankStep] = pawnForward(state, pawn.owner);
  if (
    squareFile(target) - squareFile(source) !== fileStep * 2
    || squareRank(target) - squareRank(source) !== rankStep * 2
  ) return [];
  const board = setupFor(state).board;
  const middle = (squareRank(source) + rankStep) * 8 + squareFile(source) + fileStep;
  if (board.has(middle) || board.has(target)) return [];
  return [{
    target: makeSquare(middle),
    pawnId: pawn.id,
  }];
}

function isEnPassantTarget(
  opportunities: readonly EnPassantOpportunity[],
  square: SquareName,
): boolean {
  return opportunities.some(opportunity => opportunity.target === square);
}

export function isPromotionSquare(state: GameState, owner: Color, square: SquareName): boolean {
  const [fileStep, rankStep] = pawnForward(state, owner);
  const index = parseSquare(square);
  const nextFile = squareFile(index) + fileStep;
  const nextRank = squareRank(index) + rankStep;
  return nextFile < 0 || nextFile > 7 || nextRank < 0 || nextRank > 7;
}

export function cowardiceDests(state: GameState, from: SquareName): SquareName[] {
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  const enPassant = state.enPassant.filter(opportunity => enPassantVictim(state, opportunity));
  if (
    !pawn
    || (!pawn.neutral && pawn.owner === state.turn.color)
    || pawn.originalRole !== 'pawn'
    || pawn.promoted
    || enPassant.some(opportunity => opportunity.pawnId === pawn.id)
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
    const square = makeSquare(destination);
    if (!isEnPassantTarget(enPassant, square)) destinations.push(square);
  }
  return destinations;
}

function pawnHomeDistance(state: GameState, owner: Color, square: SquareName): number {
  const [fileStep, rankStep] = pawnForward(state, owner);
  const squareIndex = parseSquare(square);
  const coordinate = fileStep ? squareFile(squareIndex) : squareRank(squareIndex);
  return (fileStep || rankStep) > 0 ? coordinate : 7 - coordinate;
}

function enPassantVictim(
  state: GameState,
  opportunity: EnPassantOpportunity,
): PieceState | undefined {
  if (
    !SQUARE.test(opportunity.target)
    || state.pieces.some(piece => piece.zone === 'board' && piece.square === opportunity.target)
  ) return undefined;
  const victim = state.pieces.find(piece =>
    piece.id === opportunity.pawnId
    && piece.zone === 'board'
    && piece.square
    && canBeEnPassantVictim(piece)
  );
  if (!victim?.square) return undefined;
  const target = parseSquare(opportunity.target);
  const square = parseSquare(victim.square);
  const [fileStep, rankStep] = pawnForward(state, victim.owner);
  const homeDistance = pawnHomeDistance(state, victim.owner, victim.square);
  return squareFile(square) === squareFile(target) + fileStep
    && squareRank(square) === squareRank(target) + rankStep
    && (homeDistance === 2 || homeDistance === 3)
    ? victim
    : undefined;
}

function onStartingSquare(state: GameState, owner: Color, square: SquareName): boolean {
  return pawnHomeDistance(state, owner, square) <= 1;
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

export function guardianDests(state: GameState, from: SquareName): SquareName[] {
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !pawn
    || (pawn.owner !== state.turn.color && !pawn.neutral)
    || pawn.originalRole !== 'pawn'
    || pawn.promoted
  ) return [];

  const source = parseSquare(from);
  const [fileStep, rankStep] = pawnForward(state, pawn.owner);
  const board = setupFor(state).board;
  const destinations: SquareName[] = [];
  for (const distance of [1, 2]) {
    if (distance === 2 && pawnHomeDistance(state, pawn.owner, from) !== 1) break;
    const file = squareFile(source) + fileStep * distance;
    const rank = squareRank(source) + rankStep * distance;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) break;
    const target = rank * 8 + file;
    if (board.has(target)) break;
    destinations.push(makeSquare(target));
  }
  return destinations;
}

function madmanJumpOptions(
  occupied: ReadonlyMap<SquareName, PieceState>,
  from: SquareName,
  used: ReadonlySet<string>,
): Array<{ move: CardMove; jumpedId: string }> {
  const source = parseSquare(from);
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]].flatMap(([fileStep, rankStep]) => {
    const middleFile = squareFile(source) + fileStep;
    const middleRank = squareRank(source) + rankStep;
    const targetFile = squareFile(source) + fileStep * 2;
    const targetRank = squareRank(source) + rankStep * 2;
    if (
      targetFile < 0 || targetFile > 7 || targetRank < 0 || targetRank > 7
      || middleFile < 0 || middleFile > 7 || middleRank < 0 || middleRank > 7
    ) return [];
    const middle = makeSquare(middleRank * 8 + middleFile);
    const to = makeSquare(targetRank * 8 + targetFile);
    const jumped = occupied.get(middle);
    return jumped && !used.has(jumped.id) && !occupied.has(to)
      ? [{ move: { from, to }, jumpedId: jumped.id }]
      : [];
  });
}

function madmanTargets(state: GameState): CardMove[][] {
  const pawns = state.pieces.filter(piece =>
    piece.zone === 'board'
    && piece.square
    && (piece.owner === state.turn.color || piece.neutral)
    && piece.originalRole === 'pawn'
    && !piece.promoted,
  );
  return pawns.flatMap(pawn => {
    const occupied = new Map(state.pieces.flatMap(piece =>
      piece.zone === 'board' && piece.square ? [[piece.square, piece] as const] : [],
    ));
    const routes: CardMove[][] = [];
    const visit = (from: SquareName, used: ReadonlySet<string>, path: CardMove[]): void => {
      const options = madmanJumpOptions(occupied, from, used);
      if (!options.length) {
        if (path.length) routes.push(path);
        return;
      }
      for (const { move, jumpedId } of options) {
        occupied.delete(from);
        occupied.set(move.to, pawn);
        visit(move.to, new Set([...used, jumpedId]), [...path, move]);
        occupied.delete(move.to);
        occupied.set(from, pawn);
      }
    };
    visit(pawn.square!, new Set(), []);
    return routes;
  });
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

export function heresyDests(state: GameState, from: SquareName): SquareName[] {
  const bishop = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (!bishop || (bishop.role !== 'bishop' && bishop.originalRole !== 'bishop')) return [];

  const source = parseSquare(from);
  const board = setupFor(state).board;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].flatMap(([fileStep, rankStep]) => {
    const file = squareFile(source) + fileStep;
    const rank = squareRank(source) + rankStep;
    const destination = rank * 8 + file;
    return file < 0 || file > 7 || rank < 0 || rank > 7 || board.has(destination)
      ? []
      : [makeSquare(destination)];
  });
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

export function assassinDests(state: GameState, from: SquareName): SquareName[] {
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (!mover || (mover.owner !== state.turn.color && !mover.neutral)) return [];

  const occupied = setupFor(state).board.occupied;
  return state.pieces.flatMap(victim =>
    victim.zone === 'board'
      && victim.square
      && !victim.royal
      && (victim.owner === state.turn.color || victim.neutral)
      && pieceAttacksSquare(state, mover, victim.square, occupied)
      ? [victim.square]
      : [],
  );
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
  state.enPassant = state.enPassant.filter(opportunity => enPassantVictim(state, opportunity));
  const setup = setupFor(state);
  revokeCastlingRights(setup, movedPieces);
  state.fen = makeFen(setup);
}

function spendCard(
  state: GameState,
  cardId: string,
  cardInstanceId?: unknown,
  discard = true,
): CardInstance {
  const color = state.turn.color;
  const player = state.players[color];
  const index = player.hand.findIndex(
    card => card.cardId === cardId && (cardInstanceId === undefined || card.id === cardInstanceId),
  );
  const [spent] = player.hand.splice(index, 1);
  if (discard) player.discard.push(spent);
  const drawn = player.deck.shift();
  if (drawn) player.hand.push(drawn);
  state.turn.cardPlays[color] += 1;
  return spent;
}

function settleBlockedBeforeMove(state: GameState, color: Color): void {
  if (state.turn.phase !== 'beforeMove') return;
  if (isOrdinaryCheckmate(state, color)) {
    state.outcome = { winner: opposite(color), reason: 'checkmate' };
  } else if (isOrdinaryStalemate(state, color)) {
    state.outcome = { reason: 'stalemate' };
  }
}

function pieceAttacksSquare(
  state: GameState,
  piece: PieceState,
  target: SquareName,
  occupied: SquareSet,
): boolean {
  const victim = state.pieces.find(candidate =>
    candidate.zone === 'board' && candidate.square === target && candidate.id !== piece.id,
  );
  if (victim && (captureForbidden(state, piece) || captureImmune(state, victim))) return false;
  const source = parseSquare(piece.square!);
  const destination = parseSquare(target);
  if (piece.role === 'pawn') {
    const [forwardFile, forwardRank] = pawnForward(state, piece.owner);
    const fileDelta = squareFile(destination) - squareFile(source);
    const rankDelta = squareRank(destination) - squareRank(source);
    return Math.abs(fileDelta) + Math.abs(rankDelta) === 2
      && fileDelta * forwardFile + rankDelta * forwardRank === 1;
  }
  return attacks(
    { color: piece.owner, role: piece.role },
    source,
    occupied,
  ).has(destination);
}

function legallyAttacksRoyal(
  state: GameState,
  attacker: PieceState,
  royal: PieceState,
  controller: Color,
): boolean {
  if (!pieceAttacksSquare(state, attacker, royal.square!, setupFor(state).board.occupied)) return false;
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === attacker.id)!.square = royal.square;
  const captured = resolved.pieces.find(piece => piece.id === royal.id)!;
  captured.square = null;
  captured.zone = 'captured';
  return !resolved.pieces.some(piece =>
    piece.royal
    && piece.zone === 'board'
    && piece.square
    && (piece.owner === controller || (piece.id === attacker.id && piece.neutral))
    && isRoyalInCheck(resolved, piece)
  );
}

function isRoyalInCheck(state: GameState, piece: PieceState): boolean {
  if (piece.zone !== 'board' || !piece.square) return false;
  const hostileControllers: readonly Color[] = piece.neutral
    ? ['white', 'black']
    : [opposite(piece.owner)];
  if (hostileControllers.some(hostile => isRoyalEnPassantThreatened(state, piece, hostile))) {
    return true;
  }
  const occupied = setupFor(state).board.occupied;
  const ordinaryAttack = state.pieces.some(attacker =>
    !attacker.neutral
    && hostileControllers.includes(attacker.owner)
    && attacker.zone === 'board'
    && attacker.square
    && (piece.neutral
      ? legallyAttacksRoyal(state, attacker, piece, attacker.owner)
      : pieceAttacksSquare(state, attacker, piece.square!, occupied))
  );
  return ordinaryAttack || state.pieces.some(neutral =>
    neutral.neutral
    && neutral.zone === 'board'
    && neutral.square
    && hostileControllers.some(hostile => legallyAttacksRoyal(state, neutral, piece, hostile)),
  );
}

export function isKingInCheck(state: GameState, color: Color): boolean {
  const royals = state.pieces.filter(
    piece => piece.owner === color && piece.royal && piece.zone === 'board' && piece.square,
  );
  return royals.length
    ? royals.some(piece => isRoyalInCheck(state, piece))
    : positionFor(state, color).isCheck();
}

function moveLeavesRoyalInCheck(
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

function enPassantCapture(
  state: GameState,
  from: SquareName,
  to: SquareName,
  controller: Color = state.turn.color,
) {
  const moving = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !moving
    || (moving.owner !== controller && !moving.neutral)
    || moving.role !== 'pawn'
    || state.pieces.some(piece => piece.zone === 'board' && piece.square === to)
  ) return undefined;

  const source = parseSquare(from);
  const target = parseSquare(to);
  const [forwardFile, forwardRank] = pawnForward(state, moving.owner);
  const fileDelta = squareFile(target) - squareFile(source);
  const rankDelta = squareRank(target) - squareRank(source);
  const diagonal = Math.abs(fileDelta) + Math.abs(rankDelta) === 2
    && fileDelta * forwardFile + rankDelta * forwardRank === 1;
  if (!diagonal) return undefined;

  const victimSquare = makeSquare(
    (squareRank(target) - forwardRank) * 8 + squareFile(target) - forwardFile,
  );
  const victim = state.enPassant.flatMap(opportunity => {
    if (opportunity.target !== to) return [];
    const candidate = enPassantVictim(state, opportunity);
    return candidate?.square === victimSquare ? [candidate] : [];
  })[0];
  return victim
    && !captureForbidden(state, moving)
    && !captureImmune(state, victim)
    && (moving.neutral || victim.neutral || victim.owner !== moving.owner)
    ? { moving, victim }
    : undefined;
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

function isRoyalEnPassantThreatened(
  state: GameState,
  royal: PieceState,
  controller: Color,
): boolean {
  if (setupFor(state).turn !== controller) return false;
  return state.enPassant.some(opportunity =>
    opportunity.pawnId === royal.id
    && state.pieces.some(attacker => {
      if (attacker.zone !== 'board' || !attacker.square) return false;
      const capture = enPassantCapture(state, attacker.square, opportunity.target, controller);
      if (capture?.victim.id !== royal.id) return false;
      const resolved = resolveEnPassant(state, attacker.id, royal.id, opportunity.target);
      return !resolved.pieces.some(piece =>
        piece.royal
        && piece.zone === 'board'
        && piece.square
        && (piece.owner === controller || (piece.id === attacker.id && piece.neutral))
        && isRoyalInCheck(resolved, piece)
      );
    })
  );
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
  setup.epSquare = enPassant.length === 1
    && state.orientation === 0
    && state.pieces.some(piece =>
      piece.id === enPassant[0].pawnId
      && piece.owner === color
      && piece.role === 'pawn'
    )
    ? parseSquare(enPassant[0].target)
    : undefined;
  setup.halfmoves = pawnMoved ? 0 : setup.halfmoves + 1;
  if (color === 'black') setup.fullmoves += 1;
  state.fen = makeFen(setup);
  state.enPassant = enPassant;
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
}

function resetsHalfmoveClock(piece: PieceState, capture = false): boolean {
  return capture
    || piece.role === 'pawn'
    || (piece.originalRole === 'pawn' && !piece.promoted);
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
  completeReplacementMove(resolved, color, true, [], [pawn]);

  if (isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'fanatic', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [pawn])) {
    return fizzleCard(state, 'fanatic', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, 'fanatic', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'fanatic', target: targetSquare });
  return { ok: true, state: resolved };
}

function playMadman(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'madman' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Madman is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Madman is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, state.pieces.length);
  if (
    !moves
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key =>
      key !== 'length'
      && (typeof key !== 'string' || !/^\d+$/.test(key) || Number(key) >= moves.length)
    )
    || moves.some((move, index) => {
      const candidate = (target as Array<Record<string, unknown>>)[index];
      return Object.getPrototypeOf(candidate) !== Object.prototype
        || Reflect.ownKeys(candidate).length !== 2
        || !Object.hasOwn(candidate, 'from')
        || !Object.hasOwn(candidate, 'to');
    })
  ) return reject(state, 'INVALID_TARGET', 'Choose one complete sequence of Pawn jumps.');
  if (moves.some((move, index) => index > 0 && move.from !== moves[index - 1].to)) {
    return reject(state, 'INVALID_TARGET', 'Every jump must continue from the preceding landing square.');
  }

  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === moves[0].from);
  if (!pawn) return reject(state, 'INVALID_TARGET', `There is no Pawn on ${moves[0].from}.`);
  if (pawn.owner !== color && !pawn.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose one of your own Pawns.');
  }
  if (pawn.originalRole !== 'pawn' || pawn.promoted) {
    return reject(state, 'WRONG_ROLE', 'Madman can target only an unpromoted original Pawn.');
  }

  const occupied = new Map(state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square ? [[piece.square, piece] as const] : [],
  ));
  const used = new Set<string>();
  let current = pawn.square!;
  for (const move of moves) {
    const option = madmanJumpOptions(occupied, current, used).find(candidate =>
      candidate.move.from === move.from && candidate.move.to === move.to,
    );
    if (!option) return reject(state, 'ILLEGAL_MOVE', 'Each jump must cross a different piece and land on an empty square.');
    occupied.delete(current);
    occupied.set(move.to, pawn);
    used.add(option.jumpedId);
    current = move.to;
  }
  if (madmanJumpOptions(occupied, current, used).length) {
    return reject(state, 'ILLEGAL_MOVE', 'The Pawn must continue while another jump is available.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  const resolvedPawn = resolved.pieces.find(piece => piece.id === pawn.id)!;
  resolvedPawn.square = current;
  completeReplacementMove(resolved, color, true, [], [resolvedPawn]);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'madman', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [resolvedPawn])) {
    return fizzleCard(state, 'madman', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, 'madman', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'madman', target: moves });
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
  completeReplacementMove(resolved, color, true, [], pawns);

  if (isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'forced-march', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, pawns)) {
    return fizzleCard(state, 'forced-march', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

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

  const enPassant = moves.flatMap((move, index) =>
    pawnHomeDistance(state, pawns[index].owner, move.from) === 1
      ? doubleStepEnPassant(state, pawns[index], move.from, move.to)
      : [],
  );
  if (moves.some(move => isEnPassantTarget(enPassant, move.to))) {
    return reject(state, 'ILLEGAL_MOVE', "A Pawn cannot occupy another Pawn's en-passant target.");
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  moves.forEach((move, index) => {
    resolved.pieces.find(piece => piece.id === pawns[index].id)!.square = move.to;
  });
  const completed = structuredClone(resolved);
  completeReplacementMove(completed, color, true, enPassant, pawns);
  const defender = opposite(color);
  if (isOrdinaryCheckmate(completed, defender)) {
    return fizzleCard(state, 'annexation', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(completed, color, pawns)) {
    return fizzleCard(state, 'annexation', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(completed, 'annexation', cardInstanceId);
  completed.history.push({ type: 'cardPlayed', cardId: 'annexation', target: moves });
  return { ok: true, state: completed };
}

function playGuardian(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'guardian' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Guardian is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Guardian is played instead of the regular move.');
  }
  const moves = parseCardMoves(target);
  if (
    !moves
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key =>
      key !== 'length'
      && (typeof key !== 'string' || !/^\d+$/.test(key) || Number(key) >= moves.length)
    )
    || moves.some((move, index) => {
      const candidate = (target as Array<Record<string, unknown>>)[index];
      return Object.getPrototypeOf(candidate) !== Object.prototype
        || Reflect.ownKeys(candidate).length !== 2
        || !Object.hasOwn(candidate, 'from')
        || !Object.hasOwn(candidate, 'to');
    })
  ) {
    return reject(state, 'INVALID_TARGET', 'Choose one Pawn move and at most one follower move.');
  }
  if (
    new Set(moves.map(move => move.from)).size !== moves.length
  ) return reject(state, 'INVALID_TARGET', 'Choose each physical piece at most once.');
  if (
    moves.some(move => move.from === move.to)
    || new Set(moves.map(move => move.to)).size !== moves.length
  ) return reject(state, 'ILLEGAL_MOVE', 'Guardian movements must use distinct squares.');

  const pieces = moves.map(move =>
    state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from),
  );
  if (pieces.some(piece => !piece)) {
    return reject(state, 'INVALID_TARGET', 'Every selected source must contain a board piece.');
  }
  let pawnIndexes = pieces.flatMap((piece, index) =>
    piece!.originalRole === 'pawn' && !piece!.promoted ? [index] : [],
  );
  if (!pawnIndexes.length) {
    return reject(state, 'WRONG_ROLE', 'Guardian must lead with an unpromoted original Pawn.');
  }
  if (pawnIndexes.length > 1) {
    pawnIndexes = pawnIndexes.filter(index => {
      const pawnMove = moves[index];
      const followerMove = moves[1 - index];
      const source = parseSquare(pawnMove.from);
      const destination = parseSquare(pawnMove.to);
      const [fileStep, rankStep] = pawnForward(state, pieces[index]!.owner);
      return guardianDests(state, pawnMove.from).includes(pawnMove.to)
        && followerMove.from === makeSquare((squareRank(source) - rankStep) * 8 + squareFile(source) - fileStep)
        && followerMove.to === makeSquare((squareRank(destination) - rankStep) * 8 + squareFile(destination) - fileStep);
    });
  }
  if (pawnIndexes.length !== 1) {
    return reject(state, 'INVALID_TARGET', 'Choose exactly one Pawn movement.');
  }
  const pawnIndex = pawnIndexes[0];
  const pawn = pieces[pawnIndex]!;
  const pawnMove = moves[pawnIndex];
  if (pawn.owner !== color && !pawn.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose one of your own Pawns.');
  }
  if (!guardianDests(state, pawnMove.from).includes(pawnMove.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Move the Pawn one square forward, or two from its second rank.');
  }

  const followerIndex = moves.length === 2 ? 1 - pawnIndex : undefined;
  const follower = followerIndex === undefined ? undefined : pieces[followerIndex]!;
  const followerMove = followerIndex === undefined ? undefined : moves[followerIndex];
  if (followerMove) {
    const source = parseSquare(pawnMove.from);
    const destination = parseSquare(pawnMove.to);
    const [fileStep, rankStep] = pawnForward(state, pawn.owner);
    const expectedFrom = makeSquare(
      (squareRank(source) - rankStep) * 8 + squareFile(source) - fileStep,
    );
    const expectedTo = makeSquare(
      (squareRank(destination) - rankStep) * 8 + squareFile(destination) - fileStep,
    );
    if (followerMove.from !== expectedFrom) {
      return reject(state, 'INVALID_TARGET', 'The following piece must begin directly behind the Pawn.');
    }
    if (followerMove.to !== expectedTo) {
      return reject(state, 'ILLEGAL_MOVE', 'The following piece must remain directly behind the Pawn.');
    }
  }
  if (follower && follower.owner !== color && !follower.neutral) {
    return reject(state, 'WRONG_OWNER', 'The following piece must be under your control.');
  }
  const occupant = followerMove && state.pieces.find(piece =>
    piece.zone === 'board' && piece.square === followerMove.to,
  );
  if (occupant && occupant.id !== pawn.id) {
    return reject(state, 'ILLEGAL_MOVE', 'The following piece must move to an empty square.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === pawn.id)!.square = pawnMove.to;
  if (follower && followerMove) {
    resolved.pieces.find(piece => piece.id === follower.id)!.square = followerMove.to;
  }
  const movedPieces = follower ? [pawn, follower] : [pawn];
  completeReplacementMove(resolved, color, true, [], movedPieces);

  if (isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'guardian', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, movedPieces)) {
    return fizzleCard(state, 'guardian', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  const canonicalMoves = followerMove ? [pawnMove, followerMove] : [pawnMove];
  spendCard(resolved, 'guardian', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'guardian', target: canonicalMoves });
  return { ok: true, state: resolved };
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
  completeReplacementMove(resolved, color, true, [], pawns);

  if (isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'onslaught', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, pawns)) {
    return fizzleCard(state, 'onslaught', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

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
  completeReplacementMove(resolved, color, false, [], [knight]);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'long-jump', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [knight])) {
    return fizzleCard(state, 'long-jump', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

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
  completeReplacementMove(
    resolved,
    color,
    piece.originalRole === 'pawn' && !piece.promoted,
    [],
    [piece],
  );
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'dubbing', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [piece])) {
    return fizzleCard(state, 'dubbing', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

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
  completeReplacementMove(
    resolved,
    color,
    piece.originalRole === 'pawn' && !piece.promoted,
    [],
    [piece],
  );
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'squaring-the-circle', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [piece])) {
    return fizzleCard(state, 'squaring-the-circle', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, 'squaring-the-circle', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'squaring-the-circle', target: moves });
  return { ok: true, state: resolved };
}

function playAssassin(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'assassin' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Assassin is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Assassin is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1) {
    return reject(state, 'INVALID_TARGET', 'Choose one piece to capture another piece you control.');
  }
  const [move] = moves;
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!mover) return reject(state, 'INVALID_TARGET', `There is no piece on ${move.from}.`);
  if (mover.owner !== color && !mover.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  }
  const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.to);
  if (!victim || (victim.owner !== color && !victim.neutral)) {
    return reject(state, 'WRONG_OWNER', 'Choose another piece you control to capture.');
  }
  if (victim.royal) return reject(state, 'INVALID_TARGET', 'A King can never be captured.');
  if (!assassinDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'The selected piece cannot capture that piece normally.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === mover.id)!.square = move.to;
  const captured = resolved.pieces.find(piece => piece.id === victim.id)!;
  captured.square = null;
  captured.zone = 'captured';
  completeReplacementMove(resolved, color, true, [], [mover, victim]);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'assassin', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [mover])) {
    return fizzleCard(state, 'assassin', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, 'assassin', cardInstanceId);
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'assassin',
    target: moves,
    capturedId: victim.id,
  });
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
  if (moveLeavesRoyalInCheck(resolved, color, [pawn])) {
    return fizzleCard(state, 'cowardice', 'SELF_CHECK', cardInstanceId);
  }

  spendCard(resolved, 'cowardice', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'cowardice', target: moves });
  return { ok: true, state: resolved };
}

function playHeresy(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'heresy' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Heresy is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Heresy is played after the regular move.');
  }
  if (
    !Array.isArray(target)
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target).some(key =>
      key !== 'length'
      && (typeof key !== 'string' || !/^\d+$/.test(key) || Number(key) >= target.length)
    )
    || target.some(candidate =>
      !candidate
      || typeof candidate !== 'object'
      || Array.isArray(candidate)
      || Object.getPrototypeOf(candidate) !== Object.prototype
      || Reflect.ownKeys(candidate).length !== 2
      || !Object.hasOwn(candidate, 'from')
      || !Object.hasOwn(candidate, 'to')
    )
  ) return reject(state, 'INVALID_TARGET', 'Choose the complete ordered list of Bishop moves.');
  const moves = target.map(candidate => {
    const { from, to } = candidate as Record<string, unknown>;
    return typeof from === 'string' && typeof to === 'string' && SQUARE.test(from) && SQUARE.test(to)
      ? { from: from as SquareName, to: to as SquareName }
      : undefined;
  });
  if (moves.some(move => !move)) {
    return reject(state, 'INVALID_TARGET', 'Every Bishop move needs valid from and to squares.');
  }
  const parsedMoves = moves as CardMove[];
  if (new Set(parsedMoves.map(move => move.from)).size !== parsedMoves.length) {
    return reject(state, 'INVALID_TARGET', 'Every eligible Bishop must move exactly once.');
  }

  const resolved = structuredClone(state);
  const movedPieces: PieceState[] = [];
  const movedIds = new Set<string>();
  let offset = 0;
  for (const owner of [opposite(color), color]) {
    const phase = structuredClone(resolved);
    const eligible = phase.pieces.filter(piece =>
      piece.owner === owner
      && piece.zone === 'board'
      && piece.square
      && (piece.role === 'bishop' || piece.originalRole === 'bishop')
      && heresyDests(phase, piece.square).length,
    );
    if (eligible.some(piece => !parsedMoves.slice(offset).some(move => move.from === piece.square))) {
      return reject(state, 'INVALID_TARGET', 'Every eligible Bishop must move exactly once.');
    }
    const phaseMoves = parsedMoves.slice(offset, offset + eligible.length);
    if (phaseMoves.length !== eligible.length) {
      return reject(state, 'INVALID_TARGET', 'Every eligible Bishop must move exactly once.');
    }
    const bishops: PieceState[] = [];
    for (const move of phaseMoves) {
      const bishop = phase.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
      if (!bishop) return reject(state, 'INVALID_TARGET', `There is no Bishop on ${move.from}.`);
      if (bishop.role !== 'bishop' && bishop.originalRole !== 'bishop') {
        return reject(state, 'WRONG_ROLE', 'Heresy moves only Bishops.');
      }
      if (movedIds.has(bishop.id)) {
        return reject(state, 'INVALID_TARGET', 'Every physical Bishop may move only once.');
      }
      if (bishop.owner !== owner) {
        return reject(state, 'WRONG_OWNER', "Move the opponent's Bishops before your own.");
      }
      if (!heresyDests(phase, move.from).includes(move.to)) {
        return reject(state, 'ILLEGAL_MOVE', 'Each Bishop must move to an orthogonally adjacent empty square.');
      }
      bishops.push(bishop);
    }
    if (
      new Set(bishops.map(piece => piece.id)).size !== bishops.length
      || new Set(bishops.map(piece => piece.id)).size !== eligible.length
    ) return reject(state, 'INVALID_TARGET', 'Every eligible Bishop needs a distinct move and destination.');
    if (new Set(phaseMoves.map(move => move.to)).size !== phaseMoves.length) {
      return reject(state, 'ILLEGAL_MOVE', 'Bishops in one phase need distinct destinations.');
    }

    phaseMoves.forEach((move, index) => {
      resolved.pieces.find(piece => piece.id === bishops[index].id)!.square = move.to;
    });
    movedPieces.push(...bishops);
    bishops.forEach(bishop => movedIds.add(bishop.id));
    offset += phaseMoves.length;
  }
  if (offset !== parsedMoves.length) {
    return reject(state, 'INVALID_TARGET', 'Only eligible Bishops may be moved.');
  }

  resolved.enPassant = resolved.enPassant.filter(opportunity => !movedIds.has(opportunity.pawnId));
  syncFen(resolved, movedPieces);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'heresy', 'DIRECT_MATE', cardInstanceId);
  }
  if (moveLeavesRoyalInCheck(resolved, color, movedPieces)) {
    return fizzleCard(state, 'heresy', 'SELF_CHECK', cardInstanceId);
  }

  spendCard(resolved, 'heresy', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'heresy', target: parsedMoves });
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
  if (config.replacesMove) {
    completeReplacementMove(resolved, color, false, [], [firstPiece, secondPiece]);
  } else {
    syncFen(resolved);
  }
  const defender = opposite(color);
  const consumesMove = config.replacesMove && !isKingInCheck(state, color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [firstPiece, secondPiece])) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId, consumesMove);
  }

  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId, target: parsedTarget });
  return { ok: true, state: resolved };
}

function playDoomsayer(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'doomsayer' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Doomsayer is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Doomsayer is played after the regular move.');
  }
  if (target !== undefined) {
    return reject(state, 'INVALID_TARGET', 'Play Doomsayer first; the opponent names a piece separately.');
  }

  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'doomsayer', cardInstanceId, false);
  resolved.effects.push({
    type: 'doomsayer',
    owner: color,
    card,
  } satisfies DoomsayerEffect);
  resolved.pendingDoomsayer = { player: opposite(color), cardInstanceId: card.id };
  resolved.history.push({ type: 'cardPlayed', cardId: 'doomsayer' });
  return { ok: true, state: resolved };
}

function playPacifism(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'pacifism' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Pacifism is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Pacifism must be played before the regular move.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) {
    return reject(state, 'INVALID_TARGET', 'Choose one of your non-King pieces.');
  }
  const targetSquare = target as SquareName;
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === targetSquare);
  if (!piece) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (piece.owner !== color && !piece.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  }
  if (piece.royal) {
    return reject(state, 'INVALID_TARGET', 'A King cannot become a Pacifist.');
  }
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'pacifism', cardInstanceId, false);
  resolved.effects.push({ type: 'pacifism', owner: color, card, pieceId: piece.id } satisfies PacifismEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'pacifism', target: targetSquare });
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
    || (captured.owner === color && !captured.neutral)
    || !mover
    || (mover.owner !== color && !mover.neutral)
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
  if (cardId === 'assassin') return playAssassin(state, target, cardInstanceId);
  if (cardId === 'disintegration') return playDisintegration(state, target, cardInstanceId);
  if (cardId === 'doomsayer') return playDoomsayer(state, target, cardInstanceId);
  if (cardId === 'pacifism') return playPacifism(state, target, cardInstanceId);
  if (cardId === 'fanatic') return playFanatic(state, target, cardInstanceId);
  if (cardId === 'madman') return playMadman(state, target, cardInstanceId);
  if (cardId === 'annexation') return playAnnexation(state, target, cardInstanceId);
  if (cardId === 'guardian') return playGuardian(state, target, cardInstanceId);
  if (cardId === 'forced-march') return playForcedMarch(state, target, cardInstanceId);
  if (cardId === 'onslaught') return playOnslaught(state, target, cardInstanceId);
  if (cardId === 'long-jump') return playLongJump(state, target, cardInstanceId);
  if (cardId === 'dubbing') return playDubbing(state, target, cardInstanceId);
  if (cardId === 'squaring-the-circle') return playSquaringTheCircle(state, target, cardInstanceId);
  if (cardId === 'cowardice') return playCowardice(state, target, cardInstanceId);
  if (cardId === 'heresy') return playHeresy(state, target, cardInstanceId);
  if (cardId === 'no-quarter') return playNoQuarter(state, target, cardInstanceId);
  if (cardId === 'holy-war' || cardId === 'anathema' || cardId === 'holy-quest' || cardId === 'treason' || cardId === 'cathedral' || cardId === 'siege' || cardId === 'evangelists' || cardId === 'tournament' || cardId === 'lost-castle') {
    return playSwapCard(state, cardId, target, cardInstanceId);
  }
  return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
}

function cardPlayTargets(state: GameState, cardId: string): unknown[] {
  if (cardId === 'madman') return madmanTargets(state);
  if (cardId === 'pacifism') return state.pieces.flatMap(piece =>
    piece.zone === 'board'
      && piece.square
      && (piece.owner === state.turn.color || piece.neutral)
      && !piece.royal
      ? [piece.square]
      : [],
  );
  if (cardId === 'doomsayer' || cardId === 'no-quarter') return [undefined];
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
  if (cardId === 'guardian') {
    return state.pieces.flatMap(pawn => {
      if (pawn.zone !== 'board' || !pawn.square) return [];
      return guardianDests(state, pawn.square).flatMap(to => {
        const pawnMove = { from: pawn.square!, to };
        const source = parseSquare(pawn.square!);
        const destination = parseSquare(to);
        const [fileStep, rankStep] = pawnForward(state, pawn.owner);
        const followerFrom = makeSquare(
          (squareRank(source) - rankStep) * 8 + squareFile(source) - fileStep,
        );
        const followerTo = makeSquare(
          (squareRank(destination) - rankStep) * 8 + squareFile(destination) - fileStep,
        );
        const follower = state.pieces.find(piece =>
          piece.zone === 'board'
          && piece.square === followerFrom
          && (piece.owner === state.turn.color || piece.neutral),
        );
        return follower
          ? [[pawnMove], [pawnMove, { from: followerFrom, to: followerTo }]]
          : [[pawnMove]];
      });
    });
  }
  if (cardId === 'heresy') {
    const phasePlans = (phase: GameState, owner: Color): CardMove[][] => {
      const bishops = phase.pieces.filter(piece =>
        piece.owner === owner
        && piece.zone === 'board'
        && piece.square
        && (piece.role === 'bishop' || piece.originalRole === 'bishop')
        && heresyDests(phase, piece.square).length,
      );
      let plans: CardMove[][] = [[]];
      for (const bishop of bishops) {
        plans = plans.flatMap(plan => heresyDests(phase, bishop.square!).flatMap(to =>
          plan.some(move => move.to === to) ? [] : [[...plan, { from: bishop.square!, to }]],
        ));
      }
      return plans;
    };
    // ponytail: exhaustive plans are exponential; make this lazy if promoted-Bishop counts matter.
    return phasePlans(state, opposite(state.turn.color)).flatMap(opponentMoves => {
      const afterOpponent = structuredClone(state);
      for (const move of opponentMoves) {
        const bishop = afterOpponent.pieces.find(piece => piece.zone === 'board' && piece.square === move.from)!;
        bishop.square = move.to;
      }
      return phasePlans(afterOpponent, state.turn.color).map(ownMoves => [...opponentMoves, ...ownMoves]);
    });
  }
  if (cardId !== 'assassin' && cardId !== 'forced-march' && cardId !== 'annexation' && cardId !== 'onslaught' && cardId !== 'long-jump' && cardId !== 'dubbing' && cardId !== 'squaring-the-circle' && cardId !== 'cowardice') {
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square ? [piece.square] : []);
  }

  const steps = state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square
      ? (cardId === 'assassin'
          ? assassinDests
          : cardId === 'forced-march'
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
  if (cardId === 'assassin' || cardId === 'long-jump' || cardId === 'dubbing' || cardId === 'squaring-the-circle' || cardId === 'cowardice') {
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

function namePiece(
  state: GameState,
  action: Extract<GameAction, { type: 'namePiece' }>,
): ApplyResult {
  const fields = Object.keys(action);
  if (
    fields.length !== 4
    || !['type', 'speaker', 'name', 'losses'].every(field => Object.hasOwn(action, field))
  ) {
    return reject(state, 'INVALID_TARGET', 'Use only type, speaker, name, and losses.');
  }
  if (action.speaker !== 'white' && action.speaker !== 'black') {
    return reject(state, 'INVALID_TARGET', 'Choose which player intentionally named the piece.');
  }
  const speaker = action.speaker;
  if (state.pendingDoomsayer && speaker !== state.pendingDoomsayer.player) {
    return reject(state, 'WRONG_OWNER', 'Only the opponent may use Doomsayer\'s immediate option.');
  }
  const active = activeDoomsayers(state);
  if (!active.length) {
    return reject(state, 'INVALID_TIMING', 'No Doomsayer effect is active.');
  }

  const role = typeof action.name === 'string' ? action.name : '';
  if (!DOOMSAYER_ROLES.has(role as DoomsayerRole)) {
    return reject(state, 'INVALID_TARGET', 'Name pawn, knight, bishop, rook, or queen — never king.');
  }

  const candidates = doomsayerTargets(state, speaker, role as DoomsayerRole);
  const required = Math.min(active.length, candidates.length);
  if (!Array.isArray(action.losses)) {
    return reject(state, 'INVALID_TARGET', 'Losses must be an array.');
  }
  const losses = action.losses.map(loss => effectRecord(loss));
  if (losses.some(loss =>
    !loss
    || Object.keys(loss).length !== 2
    || !Object.hasOwn(loss, 'effectId')
    || !Object.hasOwn(loss, 'pieceId')
    || typeof loss.effectId !== 'string'
    || typeof loss.pieceId !== 'string'
  )) {
    return reject(state, 'INVALID_TARGET', 'Each loss must contain one effectId and one pieceId.');
  }
  const mappings = losses as Array<{ effectId: string; pieceId: string }>;
  if (
    new Set(mappings.map(loss => loss.effectId)).size !== mappings.length
    || mappings.some((loss, index) => loss.effectId !== active[index]?.card.id)
  ) {
    return reject(state, 'INVALID_TARGET', 'Doomsayer effects must be resolved once, in activation order.');
  }
  if (new Set(mappings.map(loss => loss.pieceId)).size !== mappings.length) {
    return reject(state, 'INVALID_TARGET', 'Choose each physical piece at most once.');
  }
  const selected = mappings.flatMap(loss => {
    const piece = state.pieces.find(candidate =>
      candidate.zone === 'board' && candidate.id === loss.pieceId,
    );
    return piece ? [piece] : [];
  });
  if (selected.length !== mappings.length) {
    return reject(state, 'INVALID_TARGET', 'Every loss must identify a physical board piece.');
  }
  if (selected.some(piece => piece.owner !== speaker)) {
    return reject(state, 'WRONG_OWNER', 'The named player can lose only an owned piece.');
  }
  if (selected.some(piece => piece.royal || captureImmune(state, piece))) {
    return reject(state, 'INVALID_TARGET', 'That piece cannot be captured by Doomsayer.');
  }
  if (selected.some(piece => piece.role !== role && (piece.promoted || piece.originalRole !== role))) {
    return reject(state, 'WRONG_ROLE', 'Every loss must match the spoken piece type.');
  }
  if (mappings.length !== required) {
    return reject(
      state,
      'INVALID_TARGET',
      required
        ? `Choose ${required} owned ${titleForRole(role)}${required === 1 ? '' : 's'} to lose.`
        : `No owned ${titleForRole(role)} can be lost; do not choose a piece.`,
    );
  }

  const consumed = active.slice(0, required);
  const consumedIds = new Set(consumed.map(effect => effect.card.id));
  const resolved = structuredClone(state);
  for (const piece of selected) {
    const captured = resolved.pieces.find(candidate => candidate.id === piece.id)!;
    captured.square = null;
    captured.zone = 'captured';
  }
  if (selected.length) {
    syncFen(resolved, selected);
    const setup = setupFor(resolved);
    setup.halfmoves = 0;
    resolved.fen = makeFen(setup);
  }
  resolved.effects = resolved.effects.filter(effect =>
    !isDoomsayerEffect(effect) || !consumedIds.has(effect.card.id),
  );
  for (const effect of consumed) {
    resolved.players[effect.owner].discard.push(effect.card);
  }
  resolved.pendingDoomsayer = null;
  resolved.history.push({
    type: 'pieceNamed',
    speaker,
    name: role as DoomsayerRole,
    capturedIds: selected.map(piece => piece.id),
    resolvedEffectIds: consumed.map(effect => effect.card.id),
  });

  if (resolved.pendingRescue) {
    const pending = resolved.pendingRescue;
    const speech = structuredClone(resolved.history.at(-1)!);
    pending.history = [...(pending.history ?? resolved.history.slice(0, pending.historyLength)), speech];
    const movedPieces = pending.movedPieceIds.flatMap(id => {
      const piece = resolved.pieces.find(candidate => candidate.id === id);
      return piece ? [piece] : [];
    });
    if (!moveLeavesRoyalInCheck(resolved, resolved.turn.color, movedPieces)) {
      resolved.pendingRescue = null;
    } else if (selected.length) {
      const checkpoint = structuredClone(resolved);
      checkpoint.fen = pending.fen;
      checkpoint.pieces = structuredClone(pending.pieces);
      checkpoint.enPassant = structuredClone(pending.enPassant);
      const checkpointLosses = selected.flatMap(piece => {
        const loss = checkpoint.pieces.find(candidate => candidate.id === piece.id);
        if (!loss) return [];
        loss.square = null;
        loss.zone = 'captured';
        return [loss];
      });
      syncFen(checkpoint, checkpointLosses);
      const setup = setupFor(checkpoint);
      setup.halfmoves = 0;
      pending.fen = makeFen(setup);
      pending.pieces = checkpoint.pieces;
      pending.enPassant = checkpoint.enPassant;
    }
  }

  const checked = isKingInCheck(resolved, resolved.turn.color);
  const escape = hasTurnEscape(resolved);
  if (checked && !escape) {
    resolved.outcome = { winner: opposite(resolved.turn.color), reason: 'checkmate' };
  } else if (resolved.turn.phase === 'beforeMove' && !checked && !escape) {
    resolved.outcome = { reason: 'stalemate' };
  }
  return { ok: true, state: resolved };
}

function titleForRole(role: string): string {
  return role[0].toUpperCase() + role.slice(1);
}

function declineDoomsayer(
  state: GameState,
  action: Extract<GameAction, { type: 'declineDoomsayer' }>,
): ApplyResult {
  if (!state.pendingDoomsayer) {
    return reject(state, 'INVALID_TIMING', 'There is no immediate Doomsayer option to decline.');
  }
  const player = action.player ?? action.color ?? state.pendingDoomsayer.player;
  if (player !== 'white' && player !== 'black') {
    return reject(state, 'WRONG_OWNER', 'Choose the responding player.');
  }
  if (player !== state.pendingDoomsayer.player) {
    return reject(state, 'WRONG_OWNER', 'Only the offered opponent may decline this option.');
  }
  const resolved = structuredClone(state);
  resolved.pendingDoomsayer = null;
  resolved.history.push({ type: 'doomsayerDeclined', player });
  return { ok: true, state: resolved };
}

function hasAfterMoveRescue(state: GameState, movedPieces: readonly PieceState[]): boolean {
  const color = state.turn.color;
  if (state.turn.cardPlays[color] >= 1) return false;
  return state.players[color].hand.some(card =>
    cardPlayTargets(state, card.cardId).some(target => {
      const result = playCard(state, card.cardId, target, card.id);
      return result.ok
        && result.state.history.at(-1)?.type === 'cardPlayed'
        && !moveLeavesRoyalInCheck(result.state, color, movedPieces);
    }),
  );
}

function finishRegularMove(
  before: GameState,
  next: GameState,
  movedPieces: readonly PieceState[],
  allowAfterMoveRescue: boolean,
): ApplyResult {
  if (!moveLeavesRoyalInCheck(next, before.turn.color, movedPieces)) {
    return { ok: true, state: next };
  }
  if (!allowAfterMoveRescue || !hasAfterMoveRescue(next, movedPieces)) {
    return reject(before, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }
  next.pendingRescue = {
    fen: before.fen,
    pieces: structuredClone(before.pieces),
    enPassant: structuredClone(before.enPassant),
    historyLength: before.history.length,
    movedPieceIds: movedPieces.map(piece => piece.id),
  };
  return { ok: true, state: next };
}

function movePiece(
  state: GameState,
  action: Extract<GameAction, { type: 'move' }>,
  allowAfterMoveRescue = true,
): ApplyResult {
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
  if (moving.owner !== state.turn.color && !moving.neutral) {
    return reject(state, 'ILLEGAL_MOVE', 'That piece is not under your control.');
  }
  const customEnPassant = enPassantCapture(state, fromName, toName);
  const target = state.pieces.find(piece => piece.zone === 'board' && piece.square === toName);
  const enPassant = doubleStepEnPassant(state, moving, fromName, toName);
  if (
    (target?.royal && target.id !== moving.id)
    || customEnPassant?.victim.royal
  ) {
    return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
  }

  if (customEnPassant) {
    const next = resolveEnPassant(state, moving.id, customEnPassant.victim.id, toName);
    if (Boolean(promotion) !== isPromotionSquare(state, moving.owner, toName)) {
      return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
    }
    if (promotion) {
      const moved = next.pieces.find(piece => piece.id === moving.id)!;
      moved.role = promotion;
      moved.promoted = true;
    }
    const setup = setupFor(next);
    revokeCastlingRights(setup, [moving, customEnPassant.victim]);
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
      ...(promotion ? { promotion } : {}),
    });
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue);
  }

  if (castlingSide(position, move) && !moving.royal && !target?.neutral) {
    return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }

  const castle = moving.owner === state.turn.color
    && moving.role === 'king'
    && moving.royal
    && moving.originalRole === 'king'
    ? (['a', 'h'] as const).find(side =>
        position.castles.rook[state.turn.color][side] === to
      ) ?? (['a', 'h'] as const).find(side => {
        const rook = position.castles.rook[state.turn.color][side];
        return rook !== undefined
          && to === kingCastlesTo(state.turn.color, side);
      })
    : undefined;
  const rookFrom = castle ? position.castles.rook[state.turn.color][castle] : undefined;
  if (target && target.owner === moving.owner && !moving.neutral && !target.neutral && !castle) {
    return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }
  if (!castle && target && (captureForbidden(state, moving) || captureImmune(state, target))) {
    return reject(state, 'ILLEGAL_MOVE', 'That piece cannot capture or be captured.');
  }
  const playedMove: Move = castle ? { from, to: rookFrom! } : move;
  let orthodox = target?.neutral && target.owner === moving.owner
    ? false
    : position.isLegal(playedMove);
  if (castle && moving.owner === state.turn.color && !orthodox) {
    const castlingPosition = position.clone();
    for (const neutral of state.pieces) {
      if (!neutral.neutral || neutral.zone !== 'board' || !neutral.square) continue;
      const square = parseSquare(neutral.square);
      const piece = castlingPosition.board.get(square);
      if (piece) castlingPosition.board.set(square, { ...piece, color: state.turn.color });
    }
    orthodox = castlingPosition.isLegal(playedMove);
  }
  if (moving.role === 'pawn' && (state.orientation !== 0 || !orthodox)) {
    const board = setupFor(state).board;
    const [forwardFile, forwardRank] = pawnForward(state, moving.owner);
    const fileDelta = squareFile(to) - squareFile(from);
    const rankDelta = squareRank(to) - squareRank(from);
    const forward = fileDelta === forwardFile && rankDelta === forwardRank;
    const doubleForward = fileDelta === forwardFile * 2 && rankDelta === forwardRank * 2;
    const middle = (squareRank(from) + forwardRank) * 8 + squareFile(from) + forwardFile;
    const diagonal = Math.abs(fileDelta) + Math.abs(rankDelta) === 2
      && fileDelta * forwardFile + rankDelta * forwardRank === 1;
    const canCapture = target
      && (moving.neutral || target.neutral || target.owner !== moving.owner);
    let legal = target ? Boolean(canCapture && diagonal) : forward || (
      doubleForward
      && onStartingSquare(state, moving.owner, fromName)
      && !board.has(middle)
    );
    legal &&= Boolean(promotion) === isPromotionSquare(state, moving.owner, toName);
    if (!legal) return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');

    const next = structuredClone(state);
    const moved = next.pieces.find(piece => piece.id === moving.id)!;
    moved.square = toName;
    if (promotion) {
      moved.role = promotion;
      moved.promoted = true;
    }
    if (target) {
      const victim = next.pieces.find(piece => piece.id === target.id)!;
      victim.square = null;
      victim.zone = 'captured';
    }
    completeReplacementMove(
      next,
      state.turn.color,
      resetsHalfmoveClock(moving, Boolean(target)),
      enPassant,
      [moving, ...(target ? [target] : [])],
    );
    next.history.push({
      type: 'move',
      from: fromName,
      to: toName,
      ...(promotion ? { promotion } : {}),
      ...(target ? { capturedId: target.id } : {}),
    });
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue);
  }

  if ((moving.neutral || target?.neutral) && !orthodox) {
    const board = setupFor(state).board;
    if (
      promotion !== undefined
      || !pieceAttacksSquare(state, moving, toName, board.occupied)
    ) return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');

    const next = structuredClone(state);
    next.pieces.find(piece => piece.id === moving.id)!.square = toName;
    if (target) {
      const victim = next.pieces.find(piece => piece.id === target.id)!;
      victim.square = null;
      victim.zone = 'captured';
    }
    completeReplacementMove(
      next,
      state.turn.color,
      resetsHalfmoveClock(moving, Boolean(target)),
      enPassant,
      [moving, ...(target ? [target] : [])],
    );
    next.history.push({
      type: 'move',
      from: fromName,
      to: toName,
      ...(target ? { capturedId: target.id } : {}),
    });
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue);
  }

  const promotes = moving.role === 'pawn' && SquareSet.backranks().has(to);
  const pseudoLegal = Boolean(promotion) === promotes
    && (
      pseudoDests(position, from, position.ctx()).has(to)
      || Boolean(
        castle
        && moving.owner === state.turn.color
        && rookFrom !== undefined
        && (to === kingCastlesTo(state.turn.color, castle) || to === rookFrom)
        && !position.castles.path[state.turn.color][castle].intersects(position.board.occupied)
      )
    );
  if (!orthodox && !pseudoLegal) {
    return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }

  if (castle) {
    const kingTo = kingCastlesTo(state.turn.color, castle);
    if (isRoyalInCheck(state, moving)) {
      return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
    }
    const step = Math.sign(kingTo - from);
    for (let transit = from + step; transit !== kingTo; transit += step) {
      const crossing = structuredClone(state);
      const crossingKing = crossing.pieces.find(piece => piece.id === moving.id)!;
      crossingKing.square = makeSquare(transit);
      if (isRoyalInCheck(crossing, crossingKing)) {
        return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
      }
    }
  }
  const capturedSquare =
    !castle && moving.role === 'pawn' && position.epSquare === to && !position.board.has(to)
      ? to + (state.turn.color === 'white' ? -8 : 8)
      : to;
  const captured = castle
    ? undefined
    : state.pieces.find(
        piece => piece.zone === 'board' && piece.square === makeSquare(capturedSquare) && piece.owner !== state.turn.color,
      );
  if (captured?.royal) return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
  if (captured && (captureForbidden(state, moving) || captureImmune(state, captured))) {
    return reject(state, 'ILLEGAL_MOVE', 'That piece cannot capture or be captured.');
  }

  const castlingRights = setupFor(state).castlingRights;
  const halfmoves = position.halfmoves;
  position.play(playedMove);
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
  const setup = position.toSetup();
  setup.castlingRights = castlingRights;
  setup.halfmoves = resetsHalfmoveClock(moving, Boolean(captured)) ? 0 : halfmoves + 1;
  revokeCastlingRights(setup, [moving, ...(captured ? [captured] : [])]);
  next.fen = makeFen(setup);
  next.enPassant = enPassant;
  next.turn.phase = 'afterMove';
  next.turn.moveMade = true;
  next.history.push({
    type: 'move',
    from: fromName,
    to: makeSquare(castle ? kingCastlesTo(state.turn.color, castle) : to),
    ...(promotion ? { promotion } : {}),
    ...(captured ? { capturedId: captured.id } : {}),
  });
  return finishRegularMove(state, next, [moving], allowAfterMoveRescue);
}

function settlePendingRescue(
  beforeCard: GameState,
  result: ApplyResult,
  cardId: string,
): ApplyResult {
  const pending = beforeCard.pendingRescue;
  if (!pending || !result.ok) return result;
  const movedPieces = pending.movedPieceIds.flatMap(id => {
    const piece = result.state.pieces.find(candidate => candidate.id === id);
    return piece ? [piece] : [];
  });
  if (!moveLeavesRoyalInCheck(result.state, beforeCard.turn.color, movedPieces)) {
    result.state.pendingRescue = null;
    return result;
  }

  const recorded = result.state.history.at(-1);
  const cardEvent = recorded?.type === 'cardFizzled'
    ? recorded
    : { type: 'cardFizzled' as const, cardId, reason: 'SELF_CHECK' as const };
  const previousDoomsayers = new Set(activeDoomsayers(beforeCard).map(effect => effect.card.id));
  const activatedDoomsayers = activeDoomsayers(result.state).filter(
    effect => !previousDoomsayers.has(effect.card.id),
  );
  if (activatedDoomsayers.length) {
    const activatedIds = new Set(activatedDoomsayers.map(effect => effect.card.id));
    result.state.effects = result.state.effects.filter(
      effect => !isDoomsayerEffect(effect) || !activatedIds.has(effect.card.id),
    );
    for (const effect of activatedDoomsayers) {
      if (!result.state.players[effect.owner].discard.some(card => card.id === effect.card.id)) {
        result.state.players[effect.owner].discard.push(effect.card);
      }
    }
    result.state.pendingDoomsayer = null;
  }
  result.state.fen = pending.fen;
  result.state.pieces = structuredClone(pending.pieces);
  result.state.enPassant = structuredClone(pending.enPassant);
  result.state.history = pending.history
    ? structuredClone(pending.history)
    : result.state.history.slice(0, pending.historyLength);
  result.state.history.push(cardEvent);
  result.state.turn.phase = 'beforeMove';
  result.state.turn.moveMade = false;
  result.state.pendingRescue = null;
  result.state.outcome = null;
  settleBlockedBeforeMove(result.state, beforeCard.turn.color);
  return result;
}

function recordCardTransition(before: GameState, result: ApplyResult): ApplyResult {
  if (!result.ok) return result;
  const event = result.state.history.at(-1);
  if (event?.type !== 'cardPlayed' && event?.type !== 'cardFizzled') return result;

  const origins = new Map(before.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square ? [[piece.id, piece.square] as const] : [],
  ));
  event.movement = event.type === 'cardPlayed'
    ? event.cardId === 'heresy' && Array.isArray(event.target)
      ? structuredClone(event.target) as CardMove[]
      : result.state.pieces.flatMap(piece => {
        const from = origins.get(piece.id);
        return from && piece.zone === 'board' && piece.square && piece.square !== from
          ? [{ from, to: piece.square }]
          : [];
      })
    : [];
  event.preservePreviousMove = before.turn.phase === 'afterMove'
    && before.turn.moveMade
    && !(before.pendingRescue && event.type === 'cardFizzled');
  return result;
}

function expirePacifism(result: ApplyResult): ApplyResult {
  if (!result.ok) return result;
  const expired = result.state.effects.filter((effect): effect is PacifismEffect => {
    const record = effectRecord(effect);
    const card = effectRecord(record?.card);
    return effectKind(effect) === 'pacifism'
      && typeof record?.pieceId === 'string'
      && (record.owner === 'white' || record.owner === 'black')
      && card?.cardId === 'pacifism'
      && typeof card.id === 'string'
      && !result.state.pieces.some(piece => piece.id === record.pieceId && piece.zone === 'board');
  });
  if (!expired.length) return result;
  const cardIds = new Set(expired.map(effect => effect.card.id));
  result.state.effects = result.state.effects.filter(effect => {
    const record = effectRecord(effect);
    const card = effectRecord(record?.card);
    return effectKind(effect) !== 'pacifism' || typeof card?.id !== 'string' || !cardIds.has(card.id);
  });
  for (const effect of expired) {
    if (!result.state.players[effect.owner].discard.some(card => card.id === effect.card.id)) {
      result.state.players[effect.owner].discard.push(effect.card);
    }
  }
  return result;
}

function hasBoardOrCardEscape(state: GameState): boolean {
  const color = state.turn.color;
  return [...legalDests(state, isKingInCheck(state, color)).values()].some(dests => dests.length > 0)
    || state.players[color].hand.some(card =>
      cardPlayTargets(state, card.cardId).some(target => {
        const result = playCard(state, card.cardId, target, card.id);
        if (!result.ok || result.state.outcome) return false;
        if (result.state.turn.moveMade) return !isKingInCheck(result.state, color);
        if (result.state.history.at(-1)?.type !== 'cardPlayed') return false;
        return [...legalDests(result.state).values()].some(targets => targets.length > 0);
      }),
    );
}

function combinations<T>(values: readonly T[], count: number, start = 0): T[][] {
  if (!count) return [[]];
  const result: T[][] = [];
  for (let index = start; index <= values.length - count; index += 1) {
    for (const rest of combinations(values, count - 1, index + 1)) {
      result.push([values[index], ...rest]);
    }
  }
  return result;
}

function hasDoomsayerEscape(state: GameState, seen = new Set<string>()): boolean {
  const active = activeDoomsayers(state);
  if (!active.length) return false;
  const signature = `${active.map(effect => effect.card.id).join(',')}|${state.pieces
    .filter(piece => piece.zone === 'board' && piece.square)
    .map(piece => `${piece.id}:${piece.square}`)
    .join(',')}`;
  if (seen.has(signature)) return false;
  seen.add(signature);

  for (const role of DOOMSAYER_ROLES) {
    const candidates = doomsayerTargets(state, state.turn.color, role);
    const required = Math.min(active.length, candidates.length);
    if (!required) continue;
    for (const losses of combinations(candidates, required)) {
      const resolved = structuredClone(state);
      for (const piece of losses) {
        const captured = resolved.pieces.find(candidate => candidate.id === piece.id)!;
        captured.square = null;
        captured.zone = 'captured';
      }
      syncFen(resolved, losses);
      const setup = setupFor(resolved);
      setup.halfmoves = 0;
      resolved.fen = makeFen(setup);
      const consumedIds = new Set(active.slice(0, required).map(effect => effect.card.id));
      resolved.effects = resolved.effects.filter(effect =>
        !isDoomsayerEffect(effect) || !consumedIds.has(effect.card.id),
      );
      resolved.pendingDoomsayer = null;
      if (hasBoardOrCardEscape(resolved) || hasDoomsayerEscape(resolved, seen)) return true;
    }
  }
  return false;
}

function hasTurnEscape(state: GameState): boolean {
  return hasBoardOrCardEscape(state) || hasDoomsayerEscape(state);
}

function endTurn(state: GameState): ApplyResult {
  if (!state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Make the regular move before ending the turn.');
  if (state.pendingDoomsayer) {
    return reject(state, 'INVALID_TIMING', 'The opponent must name a piece or decline Doomsayer before the turn can end.');
  }
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
  next.pendingRescue = null;
  next.pendingDoomsayer = null;
  const canEscape = hasTurnEscape(next);
  if (isOrdinaryCheckmate(next, nextColor) && !canEscape) {
    next.outcome = { winner: state.turn.color, reason: 'checkmate' };
  } else if (isOrdinaryStalemate(next, nextColor) && !canEscape) {
    next.outcome = { reason: 'stalemate' };
  }
  return { ok: true, state: next };
}

export function applyAction(state: GameState, action: GameAction | null | undefined): ApplyResult {
  if (state.outcome) return reject(state, 'GAME_OVER', 'The game is already over.');
  if (!action) return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
  if (action.type === 'move') return expirePacifism(movePiece(state, action));
  if (action.type === 'namePiece') return expirePacifism(namePiece(state, action));
  if ((['pronouncePiece', 'pieceName', 'pronouncePieceName', 'pieceNamed'] as unknown[]).includes(action.type)) {
    return reject(state, 'INVALID_TARGET', 'Use the canonical namePiece action.');
  }
  if (action.type === 'declineDoomsayer') return expirePacifism(declineDoomsayer(state, action));
  if (action.type === 'endTurn') return expirePacifism(endTurn(state));
  if (action.type !== 'playCard') return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
  return expirePacifism(recordCardTransition(state, settlePendingRescue(
    state,
    playCard(state, action.cardId, action.target, action.cardInstanceId),
    action.cardId,
  )));
}
