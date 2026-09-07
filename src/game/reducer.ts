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
import { CARD_CATALOG } from './cards/catalog.js';
import type {
  AnathemaTarget,
  ApplyResult,
  BoardOrientation,
  CardInstance,
  CardMove,
  Color,
  ConfabulationEffect,
  CrabEffect,
  DoomsayerEffect,
  DoomsayerRole,
  EarthquakeDirection,
  EarthquakeTarget,
  EnPassantOpportunity,
  EvangelistsTarget,
  ForbiddenCityEffect,
  GameAction,
  GameErrorCode,
  GameState,
  HolyWarTarget,
  PanicEffect,
  PacifismEffect,
  PieceState,
  PromotionDeclaration,
  Role,
  SiegeTarget,
  SquareName,
  VendettaEffect,
} from './types.js';

const SQUARE = /^[a-h][1-8]$/;
const CORNERS: readonly SquareName[] = ['a1', 'a8', 'h1', 'h8'];
const FIGURE_DANCE_CORNERS = [
  ['a1', 'h1'],
  ['h1', 'h8'],
  ['h8', 'a8'],
  ['a8', 'a1'],
] as const;
const PROMOTIONS = new Set<Role>(['queen', 'rook', 'bishop', 'knight']);
const DOOMSAYER_ROLES = new Set<DoomsayerRole>(['pawn', 'knight', 'bishop', 'rook', 'queen']);
const FANATIC_FORWARD: Record<BoardOrientation, readonly [number, number]> = {
  0: [0, 1],
  90: [1, 0],
  180: [0, -1],
  270: [-1, 0],
};
const REBIRTH_FILES: Record<Role, readonly number[]> = {
  pawn: [0, 1, 2, 3, 4, 5, 6, 7],
  rook: [0, 7],
  knight: [1, 6],
  bishop: [2, 5],
  queen: [3],
  king: [4],
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

function isVendettaEffect(effect: unknown): effect is VendettaEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return effectKind(effect) === 'vendetta'
    && card?.cardId === 'vendetta'
    && typeof card.id === 'string'
    && (record?.owner === 'white' || record?.owner === 'black');
}

function activeVendettas(state: GameState): VendettaEffect[] {
  return state.effects.filter(isVendettaEffect);
}

function isPanicEffect(effect: unknown): effect is PanicEffect {
  const record = effectRecord(effect);
  return Boolean(
    record
    && Object.getPrototypeOf(effect) === Object.prototype
    && Reflect.ownKeys(record).length === 4
    && record.type === 'panic'
    && (record.owner === 'white' || record.owner === 'black')
    && record.player === opposite(record.owner)
    && record.durationMs === 15000
  );
}

function clearCompletedPanic(before: GameState, result: ApplyResult): ApplyResult {
  if (
    !result.ok
    || (before.turn.moveMade && !before.pendingRescue)
    || !result.state.turn.moveMade
    || result.state.pendingRescue
  ) return result;
  result.state.effects = result.state.effects.filter(effect =>
    !isPanicEffect(effect) || effect.player !== before.turn.color
  );
  return result;
}

function isConfabulationEffect(effect: unknown): effect is ConfabulationEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return record?.type === 'confabulation'
    && card?.cardId === 'confabulation'
    && typeof card.id === 'string'
    && (record.owner === 'white' || record.owner === 'black')
    && Array.isArray(record.pieceIds)
    && record.pieceIds.length === 2
    && record.pieceIds.every(id => typeof id === 'string');
}

function confabulationForPiece(state: GameState, pieceId: string): ConfabulationEffect | undefined {
  return state.effects.find((effect): effect is ConfabulationEffect =>
    isConfabulationEffect(effect) && effect.pieceIds.includes(pieceId),
  );
}

function physicalPieces(state: GameState, piece: PieceState): PieceState[] {
  const effect = confabulationForPiece(state, piece.id);
  return effect
    ? effect.pieceIds.flatMap(id => state.pieces.find(candidate => candidate.id === id) ?? [])
    : [piece];
}

function boardCarrier(state: GameState, pieceId: string): PieceState | undefined {
  const piece = state.pieces.find(candidate => candidate.id === pieceId);
  if (piece?.zone === 'board' && piece.square) return piece;
  const effect = confabulationForPiece(state, pieceId);
  return effect?.pieceIds.flatMap(id => {
    const candidate = state.pieces.find(entry => entry.id === id);
    return candidate?.zone === 'board' && candidate.square ? [candidate] : [];
  })[0];
}

function hasRole(state: GameState, piece: PieceState, role: Role): boolean {
  return physicalPieces(state, piece).some(component =>
    component.role === role || (!component.promoted && component.originalRole === role),
  );
}

function hasUnpromotedPawn(state: GameState, piece: PieceState): boolean {
  return physicalPieces(state, piece).some(component =>
    component.originalRole === 'pawn' && !component.promoted,
  );
}

function losePiece(state: GameState, piece: PieceState, zone: 'captured' | 'dead'): string[] {
  const effect = confabulationForPiece(state, piece.id);
  const ids = effect?.pieceIds ?? [piece.id];
  for (const id of ids) {
    const component = state.pieces.find(candidate => candidate.id === id);
    if (component) {
      component.square = null;
      component.zone = zone;
    }
  }
  if (effect) {
    state.effects = state.effects.filter(candidate => candidate !== effect);
    if (!state.players[effect.owner].discard.some(card => card.id === effect.card.id)) {
      state.players[effect.owner].discard.push(effect.card);
    }
  }
  return [...ids];
}

function isCrabEffect(effect: unknown): effect is CrabEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return effectKind(effect) === 'crab'
    && card?.cardId === 'crab'
    && typeof card.id === 'string'
    && typeof record?.pieceId === 'string'
    && (record.owner === 'white' || record.owner === 'black');
}

function componentHasCrabEffect(state: GameState, pieceId: string): boolean {
  const piece = state.pieces.find(candidate => candidate.id === pieceId);
  return Boolean(
    piece?.originalRole === 'pawn'
    && !piece.promoted
    && state.effects.some(effect => {
      const record = effectRecord(effect);
      return isCrabEffect(effect)
        && effect.pieceId === pieceId
        && record?.active !== false
        && record?.suspended !== true;
    }),
  );
}

function hasCrabEffect(state: GameState, pieceId: string): boolean {
  const piece = state.pieces.find(candidate => candidate.id === pieceId);
  return Boolean(piece && physicalPieces(state, piece).some(component =>
    componentHasCrabEffect(state, component.id),
  ));
}

function isForbiddenCityEffect(effect: unknown): effect is ForbiddenCityEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return record?.type === 'forbidden-city'
    && card?.cardId === 'forbidden-city'
    && typeof card.id === 'string'
    && (record.owner === 'white' || record.owner === 'black')
    && typeof record.square === 'string'
    && SQUARE.test(record.square);
}

function forbiddenCitySquares(state: GameState): Set<SquareName> {
  return new Set(state.effects.filter(isForbiddenCityEffect).map(effect => effect.square));
}

function forbiddenCityBlocksMove(
  state: GameState,
  from: SquareName,
  to: SquareName,
  jumping = false,
): boolean {
  const blocked = forbiddenCitySquares(state);
  if (blocked.has(to)) return true;
  if (jumping) return false;
  const source = parseSquare(from);
  const destination = parseSquare(to);
  const fileDelta = squareFile(destination) - squareFile(source);
  const rankDelta = squareRank(destination) - squareRank(source);
  if (fileDelta !== 0 && rankDelta !== 0 && Math.abs(fileDelta) !== Math.abs(rankDelta)) return false;
  const fileStep = Math.sign(fileDelta);
  const rankStep = Math.sign(rankDelta);
  for (
    let file = squareFile(source) + fileStep, rank = squareRank(source) + rankStep;
    file !== squareFile(destination) || rank !== squareRank(destination);
    file += fileStep, rank += rankStep
  ) {
    if (blocked.has(makeSquare(rank * 8 + file))) return true;
  }
  return false;
}

function targetMatchesPiece(target: unknown, piece: PieceState): boolean {
  return target === piece.id || target === piece.square;
}

function captureForbidden(state: GameState, piece: PieceState): boolean {
  const components = physicalPieces(state, piece);
  if (components.some(component => (component as unknown as Record<string, unknown>).pacifist === true)) {
    return true;
  }
  return components.some(component => state.effects.some(effect => {
    const record = effectRecord(effect);
    if (!record || record.active === false || record.suspended === true) return false;
    const kind = effectKind(effect);
    if (kind === 'truce') return true;
    if (kind !== 'pacifism') return false;
    const targets = record.pieceIds;
    return targetMatchesPiece(record.pieceId ?? record.targetId ?? record.target, component)
      || (Array.isArray(targets) && targets.some(target => targetMatchesPiece(target, component)));
  }));
}

function captureImmune(state: GameState, piece: PieceState): boolean {
  const components = physicalPieces(state, piece);
  if (
    captureForbidden(state, piece)
    || components.some(component => {
      const flags = component as unknown as Record<string, unknown>;
      return flags.captureImmune === true || flags.mysticShield === true;
    })
  ) {
    return true;
  }
  return components.some(component => state.effects.some(effect => {
    const record = effectRecord(effect);
    if (!record || record.active === false || record.suspended === true) return false;
    const kind = effectKind(effect);
    if (kind !== 'mysticshield') return false;
    const targets = record.pieceIds;
    return targetMatchesPiece(record.pieceId ?? record.targetId ?? record.target, component)
      || (Array.isArray(targets) && targets.some(target => targetMatchesPiece(target, component)));
  }));
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
    && hasRole(state, piece, role)
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
  enforceVendetta = true,
): Map<SquareName, SquareName[]> {
  if (state.turn.moveMade || state.outcome) return new Map();
  const position = positionFor(state);
  const dests = chessgroundDests(position);
  const moveIsLegal = (piece: PieceState, to: SquareName): boolean => {
    const promotions: Array<Role | undefined> = !confabulationForPiece(state, piece.id)
      && (piece.role === 'pawn' || hasCrabEffect(state, piece.id))
      && isPromotionSquare(state, piece.owner, to)
      ? [...PROMOTIONS]
      : [undefined];
    return promotions.some(promotion => movePiece(
      state,
      { type: 'move', from: piece.square!, to, ...(promotion ? { promotion } : {}) },
      allowAfterMoveRescue,
      enforceVendetta,
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
      || (
        !piece.neutral
        && piece.role !== 'pawn'
        && !hasCrabEffect(state, piece.id)
        && !confabulationForPiece(state, piece.id)
      )
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
  if (enforceVendetta && activeVendettas(state).length) {
    const captures = vendettaCaptureDests(state);
    if (captures.size) return captures;
  }
  return dests;
}

function vendettaVictim(
  state: GameState,
  from: SquareName,
  to: SquareName,
): PieceState | undefined {
  return state.pieces.find(piece =>
    piece.zone === 'board'
    && piece.square === to
    && piece.owner === opposite(state.turn.color),
  ) ?? (() => {
    const capture = enPassantCapture(state, from, to);
    return capture?.victim.owner === opposite(state.turn.color) ? capture.victim : undefined;
  })();
}

function vendettaCaptureDests(state: GameState): Map<SquareName, SquareName[]> {
  const captures = new Map<SquareName, SquareName[]>();
  for (const [from, dests] of legalDests(state, false, false)) {
    const targets = dests.filter(to => vendettaVictim(state, from, to));
    if (targets.length) captures.set(from, targets);
  }
  return captures;
}

function expireVendettaIfBlocked(state: GameState): GameState {
  const active = activeVendettas(state);
  if (
    state.turn.phase !== 'beforeMove'
    || !active.length
    || vendettaCaptureDests(state).size
  ) return state;

  const next = structuredClone(state);
  const ids = new Set(active.map(effect => effect.card.id));
  next.effects = next.effects.filter(effect =>
    !isVendettaEffect(effect) || !ids.has(effect.card.id),
  );
  for (const effect of active) {
    if (!next.players[effect.owner].discard.some(card => card.id === effect.card.id)) {
      next.players[effect.owner].discard.push(effect.card);
    }
  }
  return next;
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
    || !hasUnpromotedPawn(state, pawn)
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

export function darkMirrorDests(state: GameState, from: SquareName): SquareName[] {
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (
    !pawn
    || (pawn.owner !== state.turn.color && !pawn.neutral)
    || !hasUnpromotedPawn(state, pawn)
    || hasCrabEffect(state, pawn.id)
    || captureForbidden(state, pawn)
  ) return [];

  const source = parseSquare(from);
  const [forwardFile, forwardRank] = pawnForward(state, pawn.owner);
  const vendettaRequired = activeVendettas(state).length > 0 && vendettaCaptureDests(state).size > 0;
  return [[forwardRank, -forwardFile], [-forwardRank, forwardFile]].flatMap(([sideFile, sideRank]) => {
    const file = squareFile(source) - forwardFile + sideFile;
    const rank = squareRank(source) - forwardRank + sideRank;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return [];
    const to = makeSquare(rank * 8 + file);
    const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === to);
    return victim
      && (pawn.neutral || victim.neutral || victim.owner !== pawn.owner)
      && (!vendettaRequired || victim.owner === opposite(state.turn.color))
      && !victim.royal
      && !captureImmune(state, victim)
      ? [to]
      : [];
  }).sort((left, right) => parseSquare(left) - parseSquare(right));
}

export function breakthroughDests(state: GameState, from: SquareName): SquareName[] {
  const carrier = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (!carrier || (carrier.owner !== state.turn.color && !carrier.neutral)
    || captureForbidden(state, carrier) || hasCrabEffect(state, carrier.id)) return [];
  const source = parseSquare(from);
  const occupied = setupFor(state).board.occupied;
  const required = activeVendettas(state).length > 0 && vendettaCaptureDests(state).size > 0;
  return [...new Set(physicalPieces(state, carrier).flatMap(pawn => {
    if (pawn.originalRole !== 'pawn' || pawn.promoted) return [];
    const [forwardFile, forwardRank] = pawnForward(state, pawn.owner);
    const forwardX = squareFile(source) + forwardFile;
    const forwardY = squareRank(source) + forwardRank;
    if (forwardX < 0 || forwardX > 7 || forwardY < 0 || forwardY > 7) return [];
    const forward = forwardY * 8 + forwardX;
    const capturesForward = physicalPieces(state, carrier).some(component =>
      component.role !== 'pawn'
      && attacks({ color: component.owner, role: component.role }, source, occupied).has(forward),
    );
    const sides = capturesForward ? [-1, 1] : [0];
    return sides.flatMap(side => {
      const file = squareFile(source) + forwardFile + side * forwardRank;
      const rank = squareRank(source) + forwardRank - side * forwardFile;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) return [];
      const to = makeSquare(rank * 8 + file);
      const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === to);
      return victim && (carrier.neutral || victim.neutral || carrier.owner !== victim.owner)
        && (!required || victim.owner === opposite(state.turn.color))
        && !physicalPieces(state, victim).some(piece => piece.royal)
        && !captureImmune(state, victim) && !forbiddenCityBlocksMove(state, from, to)
        ? [to] : [];
    });
  }))].sort((left, right) => parseSquare(left) - parseSquare(right));
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
    || !hasUnpromotedPawn(state, pawn)
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

function rebirthDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  if (!piece || (!piece.neutral && piece.owner === state.turn.color)) return [];

  return [...new Set(physicalPieces(state, piece).flatMap(component => {
    const rank = component.originalRole === 'pawn'
      ? component.owner === 'white' ? 1 : 6
      : component.owner === 'white' ? 0 : 7;
    return REBIRTH_FILES[component.originalRole].flatMap(file => {
      const square = makeSquare(state.orientation === 0
        ? rank * 8 + file
        : state.orientation === 90
          ? (7 - file) * 8 + rank
          : state.orientation === 180
            ? (7 - rank) * 8 + 7 - file
            : file * 8 + 7 - rank);
      if (square === from) return [];
      const occupant = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === square);
      return !occupant || (
        (occupant.owner === state.turn.color || occupant.neutral)
        && !occupant.royal
        && !captureImmune(state, occupant)
      ) ? [square] : [];
    });
  }))];
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
  const pawn = state.pieces.find(piece => piece.id === opportunity.pawnId);
  const victim = boardCarrier(state, opportunity.pawnId);
  if (
    !pawn
    || !victim?.square
    || !canBeEnPassantVictim({ ...pawn, zone: 'board', square: victim.square })
  ) return undefined;
  const target = parseSquare(opportunity.target);
  const square = parseSquare(victim.square);
  const [fileStep, rankStep] = pawnForward(state, pawn.owner);
  const homeDistance = pawnHomeDistance(state, pawn.owner, victim.square);
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
    || !hasUnpromotedPawn(state, pawn)
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
    || !hasUnpromotedPawn(state, pawn)
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
    || !hasUnpromotedPawn(state, pawn)
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
    && hasUnpromotedPawn(state, piece),
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
    || !hasRole(state, knight, 'knight')
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

export function masqueradeDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  if (
    !piece
    || (piece.owner !== state.turn.color && !piece.neutral)
    || physicalPieces(state, piece).every(component =>
      component.role === 'pawn' || component.originalRole === 'pawn'
    )
  ) return [];

  const board = setupFor(state).board;
  return [...attacks({ color: piece.owner, role: 'queen' }, parseSquare(from), board.occupied).diff(board.occupied)]
    .map(makeSquare)
    .filter(to => !forbiddenCityBlocksMove(state, from, to));
}

export function blessingDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  if (!piece || (piece.owner !== state.turn.color && !piece.neutral)) return [];
  const board = setupFor(state).board;
  return [...attacks({ color: piece.owner, role: 'bishop' }, parseSquare(from), board.occupied).diff(board.occupied)]
    .map(makeSquare)
    .filter(to => !forbiddenCityBlocksMove(state, from, to));
}

function doppelgangerCopy(state: GameState): PieceState | undefined {
  let movement: CardMove[] | undefined;
  let ordinaryMove = false;
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const event = state.history[index];
    const candidate = event.type === 'move' && event.from && event.to
      ? [{ from: event.from, to: event.to }]
      : event.movement;
    if (candidate?.length) {
      movement = candidate;
      ordinaryMove = event.type === 'move';
      break;
    }
    if (
      (event.type === 'cardPlayed' || event.type === 'cardFizzled')
      && !event.preservePreviousMove
    ) return undefined;
  }
  if (movement?.length !== 1) return undefined;
  const copied = state.pieces.find(candidate =>
    candidate.zone === 'board' && candidate.square === movement![0].to,
  );
  if (
    !copied
    || (ordinaryMove
      && copied.royal
      && copied.role === 'king'
      && Math.abs(squareFile(parseSquare(movement[0].to)) - squareFile(parseSquare(movement[0].from))) === 2)
  ) return undefined;
  return copied;
}

export function doppelgangerDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  const copied = doppelgangerCopy(state);
  const copiedRoles = copied
    ? physicalPieces(state, copied).map(component => component.role).filter(role => role !== 'pawn')
    : [];
  if (
    !piece
    || (piece.owner !== state.turn.color && !piece.neutral)
    || physicalPieces(state, piece).every(component => component.role === 'pawn')
    || !copied
    || !copiedRoles.length
  ) return [];

  const board = setupFor(state).board;
  return [...new Set(copiedRoles.flatMap(role => [...attacks(
    { color: piece.owner, role },
    parseSquare(from),
    board.occupied,
  ).diff(board.occupied)].map(makeSquare)))];
}

export function heresyDests(state: GameState, from: SquareName): SquareName[] {
  const bishop = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (!bishop || !hasRole(state, bishop, 'bishop')) return [];

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
  color = state.turn.color,
): CardInstance {
  const player = state.players[color];
  const index = player.hand.findIndex(
    card => card.cardId === cardId && (cardInstanceId === undefined || card.id === cardInstanceId),
  );
  const [spent] = player.hand.splice(index, 1);
  (state.playedCards ??= []).push({ player: color, cardInstanceId: spent.id });
  if (discard) player.discard.push(spent);
  const drawn = player.deck.shift();
  if (drawn) player.hand.push(drawn);
  state.turn.cardPlays[color] += 1;
  return spent;
}

function recordsBogRollback(
  state: GameState,
  piece: PieceState,
  from: SquareName,
  to: SquareName,
  promotion?: Role,
): boolean {
  if (
    promotion
    || !state.players[opposite(state.turn.color)].hand.some(card => card.cardId === 'bog')
    || !['rook', 'bishop', 'queen'].includes(piece.role)
  ) return false;
  const source = parseSquare(from);
  const destination = parseSquare(to);
  const fileDelta = squareFile(destination) - squareFile(source);
  const rankDelta = squareRank(destination) - squareRank(source);
  const distance = Math.max(Math.abs(fileDelta), Math.abs(rankDelta));
  return distance >= 2 && (
    piece.role === 'rook'
      ? fileDelta === 0 || rankDelta === 0
      : piece.role === 'bishop'
        ? Math.abs(fileDelta) === Math.abs(rankDelta)
        : (fileDelta === 0 || rankDelta === 0) || Math.abs(fileDelta) === Math.abs(rankDelta)
  );
}

function reactionEvent(state: GameState): GameState['history'][number] | undefined {
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const event = state.history[index];
    if (
      (event.type === 'cardPlayed' || event.type === 'cardFizzled')
      && event.preservePreviousMove
    ) continue;
    return event;
  }
  return undefined;
}

function playBog(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const mover = state.turn.color;
  const reactor = opposite(mover);
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[reactor].hand.some(card =>
      card.cardId === 'bog' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Bog is not in your hand.');
  if (state.turn.cardPlays[reactor] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', "Bog must immediately follow your opponent's move.");
  }
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Bog does not take a target.');

  const move = reactionEvent(state);
  if (move?.type !== 'move' || !move.from || !move.to || move.promotion) {
    return reject(state, 'INVALID_TIMING', "Bog must immediately follow your opponent's move.");
  }
  const piece = state.pieces.find(candidate =>
    candidate.zone === 'board' && candidate.square === move.to,
  );
  if (!piece || (piece.owner !== mover && !piece.neutral) || !['rook', 'bishop', 'queen'].includes(piece.role)) {
    return reject(state, 'WRONG_ROLE', 'Bog follows only a Rook, Bishop, or Queen move.');
  }
  const from = parseSquare(move.from);
  const to = parseSquare(move.to);
  const fileDelta = squareFile(to) - squareFile(from);
  const rankDelta = squareRank(to) - squareRank(from);
  const distance = Math.max(Math.abs(fileDelta), Math.abs(rankDelta));
  const straight = fileDelta === 0 || rankDelta === 0;
  const diagonal = Math.abs(fileDelta) === Math.abs(rankDelta);
  if (
    distance < 2
    || (piece.role === 'rook' ? !straight : piece.role === 'bishop' ? !diagonal : !straight && !diagonal)
  ) return reject(state, 'ILLEGAL_MOVE', 'The preceding move must travel at least two squares.');

  const first = makeSquare(
    (squareRank(from) + Math.sign(rankDelta)) * 8 + squareFile(from) + Math.sign(fileDelta),
  );
  const captured = move.capturedId
    ? state.pieces.find(candidate => candidate.id === move.capturedId)
    : undefined;
  if (move.capturedId && (!captured || captured.zone !== 'captured' || captured.square !== null)) {
    return reject(state, 'INVALID_TIMING', 'The preceding move cannot be reconstructed.');
  }

  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = first;
  if (captured) {
    const restored = resolved.pieces.find(candidate => candidate.id === captured.id)!;
    restored.square = move.to;
    restored.zone = 'board';
  }
  if (move.previousFen) resolved.fen = move.previousFen;
  else {
    const setup = setupFor(resolved, mover);
    setup.turn = mover;
    setup.halfmoves = Math.max(0, setup.halfmoves - (captured ? 0 : 1));
    if (mover === 'black') setup.fullmoves = Math.max(1, setup.fullmoves - 1);
    resolved.fen = makeFen(setup);
  }
  completeReplacementMove(resolved, mover, resetsHalfmoveClock(piece), [], [piece]);
  if (
    (!isOrdinaryCheckmate(state, mover) && isOrdinaryCheckmate(resolved, mover))
    || (!isOrdinaryCheckmate(state, reactor) && isOrdinaryCheckmate(resolved, reactor))
  ) {
    return fizzleCard(state, 'bog', 'DIRECT_MATE', cardInstanceId, false, reactor);
  }
  if (isKingInCheck(resolved, mover) || isKingInCheck(resolved, reactor)) {
    return fizzleCard(state, 'bog', 'SELF_CHECK', cardInstanceId, false, reactor);
  }
  resolved.outcome = null;
  spendCard(resolved, 'bog', cardInstanceId, true, reactor);
  resolved.history.push({ type: 'cardPlayed', cardId: 'bog' });
  return { ok: true, state: resolved };
}

function revengePawn(piece: PieceState): boolean {
  return piece.role === 'pawn' || (!piece.promoted && piece.originalRole === 'pawn');
}

function revengeTrigger(state: GameState): PieceState | undefined {
  const move = reactionEvent(state);
  if (
    state.turn.phase !== 'afterMove'
    || !state.turn.moveMade
    || (move?.type !== 'move' && (move?.type !== 'cardPlayed' || move.cardId !== 'dark-mirror'))
    || !move.capturedId
  ) {
    return undefined;
  }
  const reactor = opposite(state.turn.color);
  return state.pieces.find(piece =>
    piece.id === move.capturedId
    && piece.zone === 'captured'
    && piece.square === null
    && (piece.owner === reactor || piece.neutral)
    && revengePawn(piece),
  );
}

function revengeTargets(state: GameState): SquareName[] {
  if (!revengeTrigger(state)) return [];
  const mover = state.turn.color;
  return state.pieces.flatMap(piece =>
    piece.zone === 'board'
      && piece.square
      && (piece.owner === mover || piece.neutral)
      && revengePawn(piece)
      && !piece.royal
      && !captureImmune(state, piece)
      ? [piece.square]
      : [],
  );
}

function playRevenge(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const mover = state.turn.color;
  const reactor = opposite(mover);
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[reactor].hand.some(card =>
      card.cardId === 'revenge' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Revenge is not in your hand.');
  if (state.turn.cardPlays[reactor] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', "Revenge must immediately follow your opponent's capture.");
  }

  const move = reactionEvent(state);
  if (
    (move?.type !== 'move' && (move?.type !== 'cardPlayed' || move.cardId !== 'dark-mirror'))
    || !move.capturedId
  ) {
    return reject(state, 'INVALID_TIMING', "Revenge must immediately follow your opponent's capture.");
  }
  const triggeringPawn = state.pieces.find(piece => piece.id === move.capturedId);
  if (!triggeringPawn || triggeringPawn.zone !== 'captured' || triggeringPawn.square !== null) {
    return reject(state, 'INVALID_TIMING', 'The captured Pawn is no longer in the captured zone.');
  }
  if (triggeringPawn.owner !== reactor && !triggeringPawn.neutral) {
    return reject(state, 'WRONG_OWNER', 'The captured Pawn must be one you control.');
  }
  if (!revengePawn(triggeringPawn)) {
    return reject(state, 'WRONG_ROLE', 'Revenge follows only the capture of a Pawn.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) {
    return reject(state, 'INVALID_TARGET', "Choose one of your opponent's Pawns.");
  }
  const targetSquare = target as SquareName;
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === targetSquare);
  if (!pawn) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (pawn.owner !== mover && !pawn.neutral) {
    return reject(state, 'WRONG_OWNER', "Choose one of your opponent's Pawns.");
  }
  if (!revengePawn(pawn)) return reject(state, 'WRONG_ROLE', 'Revenge can target only a Pawn.');
  if (pawn.royal || captureImmune(state, pawn)) {
    return reject(state, 'INVALID_TARGET', 'That Pawn cannot be captured.');
  }

  const resolved = structuredClone(state);
  losePiece(resolved, resolved.pieces.find(piece => piece.id === pawn.id)!, 'captured');
  syncFen(resolved);
  resolved.fen = [resolved.fen.split(' ')[0], ...state.fen.split(' ').slice(1)].join(' ');
  resolved.enPassant = structuredClone(state.enPassant);
  if (!isOrdinaryCheckmate(state, mover) && isOrdinaryCheckmate(resolved, mover)) {
    return fizzleCard(state, 'revenge', 'DIRECT_MATE', cardInstanceId, false, reactor);
  }
  if (!isKingInCheck(state, reactor) && isKingInCheck(resolved, reactor)) {
    return fizzleCard(state, 'revenge', 'SELF_CHECK', cardInstanceId, false, reactor);
  }

  spendCard(resolved, 'revenge', cardInstanceId, true, reactor);
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'revenge',
    target: targetSquare,
    capturedId: pawn.id,
  });
  return { ok: true, state: resolved };
}

function tollMovement(state: GameState): CardMove[] | undefined {
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return undefined;
  let event = state.history.at(-1);
  if (event?.type === 'cardPlayed' && event.cardId === 'panic') {
    event = state.history.at(-2);
  }
  if (event?.type === 'move' && event.from && event.to) return [{ from: event.from, to: event.to }];
  if (event?.type === 'cardPlayed' && event.cardId === 'irresistible-force' && Array.isArray(event.target)) {
    return event.target as CardMove[];
  }
  return event?.type === 'cardPlayed' && event.movement?.length ? event.movement : undefined;
}

function tollCrossedFrontier(state: GameState): boolean {
  const movement = tollMovement(state);
  if (!movement) return false;
  const [fileStep, rankStep] = pawnForward(state, state.turn.color);
  const progress = (square: SquareName): number => {
    const index = parseSquare(square);
    const coordinate = fileStep ? squareFile(index) : squareRank(index);
    const direction = fileStep || rankStep;
    return direction > 0 ? coordinate : 7 - coordinate;
  };
  return movement.some(move => progress(move.from) <= 3 && progress(move.to) >= 4);
}

function tollTargets(state: GameState): Array<SquareName | undefined> {
  if (!tollCrossedFrontier(state)) return [];
  const mover = state.turn.color;
  const pawns = state.pieces.flatMap(piece =>
    piece.zone === 'board'
      && piece.square
      && (piece.owner === mover || piece.neutral)
      && revengePawn(piece)
      && !piece.royal
      && !captureImmune(state, piece)
      ? [piece.square]
      : [],
  ).sort((left, right) => parseSquare(left) - parseSquare(right));
  return [undefined, ...pawns];
}

function playToll(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const mover = state.turn.color;
  const reactor = opposite(mover);
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[reactor].hand.some(card =>
      card.cardId === 'toll' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Toll is not in your hand.');
  if (state.turn.cardPlays[reactor] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (!tollCrossedFrontier(state)) {
    return reject(state, 'INVALID_TIMING', "Toll must immediately follow an opponent's move across the frontier.");
  }
  if (target === null || (target !== undefined && (typeof target !== 'string' || !SQUARE.test(target)))) {
    return reject(state, 'INVALID_TARGET', 'Choose an eligible Pawn or decline payment.');
  }

  const selected = state.players[reactor].hand.find(card =>
    card.cardId === 'toll' && (cardInstanceId === undefined || card.id === cardInstanceId),
  )!;
  if (target === undefined) {
    const checkpoint = state.turnCheckpoint;
    if (!checkpoint || !checkpoint.players[reactor].hand.some(card => card.id === selected.id)) {
      return reject(state, 'INVALID_TIMING', 'The canceled turn cannot be reconstructed.');
    }
    const canceled = structuredClone(checkpoint);
    delete canceled.turnCheckpoint;
    canceled.effects = canceled.effects.filter(effect =>
      !isPanicEffect(effect) || effect.player !== mover
    );
    spendCard(canceled, 'toll', selected.id, true, reactor);
    completeReplacementMove(canceled, mover, false);
    canceled.turn.cardPlays = { white: 1, black: 1 };
    canceled.history.push({
      type: 'cardPlayed',
      cardId: 'toll',
      player: reactor,
      preservePreviousMove: false,
    });
    canceled.pendingRescue = null;
    canceled.pendingDoomsayer = null;
    canceled.outcome = null;
    return { ok: true, state: canceled };
  }

  const square = target as SquareName;
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
  if (!pawn) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (pawn.owner !== mover && !pawn.neutral) {
    return reject(state, 'WRONG_OWNER', "Choose one of your opponent's Pawns.");
  }
  if (!revengePawn(pawn)) return reject(state, 'WRONG_ROLE', 'Toll can target only a Pawn.');
  if (pawn.royal || captureImmune(state, pawn)) {
    return reject(state, 'INVALID_TARGET', 'That Pawn cannot be captured.');
  }
  const resolved = structuredClone(state);
  losePiece(resolved, resolved.pieces.find(piece => piece.id === pawn.id)!, 'captured');
  resolved.fen = [boardFen(resolved), ...state.fen.split(' ').slice(1)].join(' ');
  resolved.enPassant = structuredClone(state.enPassant);
  if (!isOrdinaryCheckmate(state, mover) && isOrdinaryCheckmate(resolved, mover)) {
    const result = fizzleCard(state, 'toll', 'DIRECT_MATE', selected.id, false, reactor);
    if (result.ok) {
      result.state.history.at(-1)!.player = reactor;
      delete result.state.turnCheckpoint;
    }
    return result;
  }
  if (!isKingInCheck(state, reactor) && isKingInCheck(resolved, reactor)) {
    const result = fizzleCard(state, 'toll', 'SELF_CHECK', selected.id, false, reactor);
    if (result.ok) {
      result.state.history.at(-1)!.player = reactor;
      delete result.state.turnCheckpoint;
    }
    return result;
  }
  spendCard(resolved, 'toll', selected.id, true, reactor);
  delete resolved.turnCheckpoint;
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'toll',
    player: reactor,
    target: square,
    capturedId: pawn.id,
  });
  return { ok: true, state: resolved };
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
  return physicalPieces(state, piece).some(component => {
    const crab = componentHasCrabEffect(state, component.id);
    const jumping = component.role === 'knight';
    if (forbiddenCityBlocksMove(state, piece.square!, target, jumping)) return false;
    if (component.role === 'pawn' || crab) {
      const [forwardFile, forwardRank] = pawnForward(state, component.owner);
      const fileDelta = squareFile(destination) - squareFile(source);
      const rankDelta = squareRank(destination) - squareRank(source);
      return Math.abs(fileDelta) + Math.abs(rankDelta) === 2
        && fileDelta * forwardFile + rankDelta * forwardRank === 1;
    }
    return attacks(
      { color: component.owner, role: component.role },
      source,
      occupied,
    ).has(destination);
  });
}

function componentCanMove(
  state: GameState,
  carrier: PieceState,
  component: PieceState,
  to: SquareName,
  allowFriendly: boolean,
): boolean {
  if (!carrier.square || carrier.square === to) return false;
  const target = state.pieces.find(piece => piece.zone === 'board' && piece.square === to);
  if (
    target
    && !allowFriendly
    && !carrier.neutral
    && !target.neutral
    && target.owner === carrier.owner
  ) return false;

  const source = parseSquare(carrier.square);
  const destination = parseSquare(to);
  const crab = componentHasCrabEffect(state, component.id);
  if (forbiddenCityBlocksMove(state, carrier.square, to, component.role === 'knight')) {
    return false;
  }
  if (crab) {
    const [forwardFile, forwardRank] = pawnForward(state, component.owner);
    const fileDelta = squareFile(destination) - squareFile(source);
    const rankDelta = squareRank(destination) - squareRank(source);
    return Math.abs(fileDelta) + Math.abs(rankDelta) === 2
      && fileDelta * forwardFile + rankDelta * forwardRank === 1;
  }
  if (component.role !== 'pawn') {
    return attacks(
      { color: component.owner, role: component.role },
      source,
      setupFor(state).board.occupied,
    ).has(destination);
  }

  const [forwardFile, forwardRank] = pawnForward(state, component.owner);
  const fileDelta = squareFile(destination) - squareFile(source);
  const rankDelta = squareRank(destination) - squareRank(source);
  const diagonal = Math.abs(fileDelta) + Math.abs(rankDelta) === 2
    && fileDelta * forwardFile + rankDelta * forwardRank === 1;
  const forward = fileDelta === forwardFile && rankDelta === forwardRank;
  const doubleForward = fileDelta === forwardFile * 2 && rankDelta === forwardRank * 2;
  const middle = (squareRank(source) + forwardRank) * 8 + squareFile(source) + forwardFile;
  if (target) {
    if (allowFriendly && (forward || (
      doubleForward
      && onStartingSquare(state, component.owner, carrier.square)
      && !setupFor(state).board.has(middle)
    ))) return true;
    return diagonal && (allowFriendly || carrier.neutral || target.neutral || target.owner !== carrier.owner);
  }
  if (forward) return true;
  if (!doubleForward || !onStartingSquare(state, component.owner, carrier.square)) return false;
  return !setupFor(state).board.has(middle);
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
  state = withoutTruce(state);
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
    || !hasUnpromotedPawn(state, moving)
    || hasCrabEffect(state, moving.id)
    || state.pieces.some(piece => piece.zone === 'board' && piece.square === to)
  ) return undefined;

  const source = parseSquare(from);
  const target = parseSquare(to);
  const pawn = physicalPieces(state, moving).find(component =>
    component.originalRole === 'pawn' && !component.promoted,
  )!;
  const [forwardFile, forwardRank] = pawnForward(state, pawn.owner);
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
  losePiece(next, next.pieces.find(piece => piece.id === victimId)!, 'captured');
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
  spendColor = state.turn.color,
): ApplyResult {
  const fizzled = structuredClone(state);
  spendCard(fizzled, cardId, cardInstanceId, true, spendColor);
  if (consumesMove) completeReplacementMove(fizzled, state.turn.color, false);
  fizzled.history.push({ type: 'cardFizzled', cardId, reason });
  settleBlockedBeforeMove(fizzled, state.turn.color);
  return { ok: true, state: fizzled };
}

function playConfabulation(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'confabulation' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Confabulation is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Confabulation is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (
    !moves
    || moves.length !== 1
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key => key !== 'length' && key !== '0')
    || Object.getPrototypeOf((target as unknown[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')
  ) return reject(state, 'INVALID_TARGET', 'Choose exactly one plain move.');

  const [move] = moves;
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  const carrier = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.to);
  if (!mover || !carrier || mover.id === carrier.id) {
    return reject(state, 'INVALID_TARGET', 'Choose two occupied squares.');
  }
  if (
    (mover.owner !== color && !mover.neutral)
    || (carrier.owner !== color && !carrier.neutral)
  ) return reject(state, 'WRONG_OWNER', 'Choose two pieces you control.');
  if (mover.royal || carrier.royal || hasRole(state, mover, 'king') || hasRole(state, carrier, 'king')) {
    return reject(state, 'INVALID_TARGET', 'Kings cannot be confabulated.');
  }
  if (confabulationForPiece(state, mover.id) || confabulationForPiece(state, carrier.id)) {
    return reject(state, 'INVALID_TARGET', 'A confabulated piece cannot be merged again.');
  }
  if (!componentCanMove(state, mover, mover, move.to, true)) {
    return reject(state, 'ILLEGAL_MOVE', 'The moving component cannot legally reach that square.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  const resolvedMover = resolved.pieces.find(piece => piece.id === mover.id)!;
  resolvedMover.square = null;
  resolvedMover.zone = 'away';
  const card = spendCard(resolved, 'confabulation', cardInstanceId, false);
  resolved.effects.push({
    type: 'confabulation',
    owner: color,
    card,
    pieceIds: [carrier.id, mover.id],
  } satisfies ConfabulationEffect);
  completeReplacementMove(
    resolved,
    color,
    resetsHalfmoveClock(mover),
    [],
    [mover],
  );
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'confabulation', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [mover, carrier])) {
    return fizzleCard(state, 'confabulation', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'confabulation',
    target: moves,
    movement: moves,
    preservePreviousMove: false,
  });
  return { ok: true, state: resolved };
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
  if (!hasUnpromotedPawn(state, pawn)) {
    return reject(state, 'WRONG_ROLE', 'Disintegration can target only a Pawn.');
  }
  if (pawn.royal) return reject(state, 'INVALID_TARGET', 'A King can never be made dead.');

  const resolved = structuredClone(state);
  losePiece(resolved, resolved.pieces.find(piece => piece.id === pawn.id)!, 'dead');
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
  if (!hasUnpromotedPawn(state, pawn)) {
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
  if (forbiddenCityBlocksMove(state, targetSquare, makeSquare(path[2]))) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
  if (!hasUnpromotedPawn(state, pawn)) {
    return reject(state, 'WRONG_ROLE', 'Madman can target only an unpromoted original Pawn.');
  }
  if (moves.some(move => forbiddenCityBlocksMove(state, move.from, move.to, true))) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
    if (!hasUnpromotedPawn(state, pawn)) {
      return reject(state, 'WRONG_ROLE', 'Forced March can target only an unpromoted Pawn.');
    }
    if (forbiddenCityBlocksMove(state, move.from, move.to)) {
      return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
    if (!hasUnpromotedPawn(state, pawn)) {
      return reject(state, 'WRONG_ROLE', 'Annexation can target only an unpromoted Pawn.');
    }
    if (forbiddenCityBlocksMove(state, move.from, move.to)) {
      return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
    hasUnpromotedPawn(state, piece!) ? [index] : [],
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
  if (
    forbiddenCityBlocksMove(state, pawnMove.from, pawnMove.to)
    || (followerMove && forbiddenCityBlocksMove(state, followerMove.from, followerMove.to))
  ) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
    if (!hasUnpromotedPawn(state, pawn)) {
      return reject(state, 'WRONG_ROLE', 'Onslaught can target only an unpromoted Pawn.');
    }
    if (forbiddenCityBlocksMove(state, move.from, move.to)) {
      return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
  if (!hasRole(state, knight, 'knight')) {
    return reject(state, 'WRONG_ROLE', 'Long Jump can target only a Knight.');
  }
  if (!longJumpDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Choose an empty square of the opposite color.');
  }
  if (forbiddenCityBlocksMove(state, move.from, move.to, true)) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
  if (forbiddenCityBlocksMove(state, move.from, move.to, true)) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  completeReplacementMove(
    resolved,
    color,
    hasUnpromotedPawn(state, piece),
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

function playSlidingMoveCard(state: GameState, cardId: 'masquerade' | 'blessing', target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const name = CARD_CATALOG[cardId].name;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === cardId && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', `${name} is not in your hand.`);
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', `${name} is played instead of the regular move.`);
  }
  const moves = parseCardMoves(target, 1);
  if (
    !moves
    || moves.length !== 1
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key => key !== 'length' && key !== '0')
    || Object.getPrototypeOf((target as unknown[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')
  ) {
    return reject(state, 'INVALID_TARGET', 'Choose one valid piece move.');
  }
  const [move] = moves;
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === move.from);
  if (!piece) return reject(state, 'INVALID_TARGET', `There is no piece on ${move.from}.`);
  if (piece.owner !== color && !piece.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  }
  if (cardId === 'masquerade' && physicalPieces(state, piece).every(component =>
    component.role === 'pawn' || component.originalRole === 'pawn'
  )) {
    return reject(state, 'WRONG_ROLE', 'Masquerade cannot move a Pawn.');
  }
  if (forbiddenCityBlocksMove(state, move.from, move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
  }
  const destinations = cardId === 'blessing' ? blessingDests : masqueradeDests;
  if (!destinations(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', `Move the piece like a ${cardId === 'blessing' ? 'Bishop' : 'Queen'} to an empty square.`);
  }

  const wasInCheck = isKingInCheck(state, color);
  const movedPieces = physicalPieces(state, piece);
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  completeReplacementMove(
    resolved,
    color,
    hasUnpromotedPawn(state, piece),
    [],
    movedPieces,
  );
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, movedPieces)) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId, target: moves });
  return { ok: true, state: resolved };
}

function playDoppelganger(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'doppelganger' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Doppelganger is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Doppelganger is played instead of the regular move.');
  }
  const copied = doppelgangerCopy(state);
  if (!copied) {
    return reject(state, 'INVALID_TIMING', 'There is no single previous move to copy.');
  }
  if (physicalPieces(state, copied).every(component => component.role === 'pawn')) {
    return reject(state, 'WRONG_ROLE', 'Doppelganger cannot copy a Pawn.');
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
  if (physicalPieces(state, piece).every(component => component.role === 'pawn')) {
    return reject(state, 'WRONG_ROLE', 'Doppelganger cannot move a Pawn.');
  }
  if (!doppelgangerDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Copy the last moved piece to an empty square.');
  }
  const copiedGeometry = physicalPieces(state, copied).some(component =>
    component.role !== 'pawn'
    && !forbiddenCityBlocksMove(state, move.from, move.to, component.role === 'knight')
    && attacks(
      { color: piece.owner, role: component.role },
      parseSquare(move.from),
      setupFor(state).board.occupied,
    ).has(parseSquare(move.to)),
  );
  if (!copiedGeometry) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  completeReplacementMove(resolved, color, false, [], [piece]);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'doppelganger', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [piece])) {
    return fizzleCard(state, 'doppelganger', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, 'doppelganger', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'doppelganger', target: moves });
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
  if (forbiddenCityBlocksMove(state, move.from, move.to, true)) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  completeReplacementMove(
    resolved,
    color,
    hasUnpromotedPawn(state, piece),
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
  losePiece(resolved, resolved.pieces.find(piece => piece.id === victim.id)!, 'captured');
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

function playDarkMirror(state: GameState, target: unknown, cardInstanceId?: unknown, cardId = 'dark-mirror'): ApplyResult {
  const color = state.turn.color;
  const name = CARD_CATALOG[cardId].name;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === cardId && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', `${name} is not in your hand.`);
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', `${name} is played instead of the regular move.`);
  }
  const moves = parseCardMoves(target, 1);
  if (
    !moves
    || moves.length !== 1
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key =>
      key !== 'length' && (typeof key !== 'string' || key !== '0')
    )
    || Object.getPrototypeOf((target as unknown[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')
  ) return reject(state, 'INVALID_TARGET', 'Choose exactly one Pawn capture.');

  const [move] = moves;
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!pawn) return reject(state, 'INVALID_TARGET', `There is no piece on ${move.from}.`);
  if (pawn.owner !== color && !pawn.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a Pawn you control.');
  }
  if (!hasUnpromotedPawn(state, pawn)) {
    return reject(state, 'WRONG_ROLE', `${name} can move only an unpromoted original Pawn.`);
  }
  if (hasCrabEffect(state, pawn.id)) {
    return reject(state, 'INVALID_TARGET', `Crab prevents that Pawn from using ${name}.`);
  }
  const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.to);
  if (!victim) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (!pawn.neutral && !victim.neutral && victim.owner === pawn.owner) {
    return reject(state, 'WRONG_OWNER', 'The Pawn must capture an opponent piece.');
  }
  if (victim.royal) return reject(state, 'INVALID_TARGET', 'A King can never be captured.');
  const source = parseSquare(move.from);
  const destination = parseSquare(move.to);
  const [forwardFile, forwardRank] = pawnForward(state, pawn.owner);
  const fileDelta = squareFile(destination) - squareFile(source);
  const rankDelta = squareRank(destination) - squareRank(source);
  if (
    cardId === 'breakthrough'
      ? !breakthroughDests(state, move.from).includes(move.to)
      : Math.abs(fileDelta) + Math.abs(rankDelta) !== 2
        || fileDelta * forwardFile + rankDelta * forwardRank !== -1
  ) {
    return reject(state, 'ILLEGAL_MOVE', `That is not a legal ${name} capture.`);
  }
  if (captureForbidden(state, pawn) || captureImmune(state, victim)) {
    return reject(state, 'INVALID_TARGET', 'That Pawn cannot capture or the target cannot be captured.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === pawn.id)!.square = move.to;
  const resolvedPawn = resolved.pieces.find(piece => piece.id === pawn.id)!;
  losePiece(resolved, resolved.pieces.find(piece => piece.id === victim.id)!, 'captured');
  completeReplacementMove(resolved, color, true, [], [resolvedPawn, victim]);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [resolvedPawn])) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({
    type: 'cardPlayed',
    cardId,
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
  if (!hasUnpromotedPawn(state, pawn)) {
    return reject(state, 'WRONG_ROLE', 'Cowardice can target only an unpromoted original Pawn.');
  }
  if (!cowardiceDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Move the Pawn one or two clear squares backward.');
  }
  if (forbiddenCityBlocksMove(state, move.from, move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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

function playRebirth(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'rebirth' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Rebirth is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Rebirth is played after the regular move.');
  }
  if (
    !Array.isArray(target)
    || Object.getPrototypeOf(target) !== Array.prototype
    || target.length !== 1
    || Reflect.ownKeys(target).length !== 2
    || !Object.hasOwn(target, '0')
  ) return reject(state, 'INVALID_TARGET', 'Choose exactly one Rebirth move.');
  const candidate = target[0];
  if (
    !candidate
    || typeof candidate !== 'object'
    || Array.isArray(candidate)
    || Object.getPrototypeOf(candidate) !== Object.prototype
    || Reflect.ownKeys(candidate).length !== 2
    || !Object.hasOwn(candidate, 'from')
    || !Object.hasOwn(candidate, 'to')
  ) return reject(state, 'INVALID_TARGET', 'Choose exactly one from and to square.');
  const { from, to } = candidate as Record<string, unknown>;
  if (
    typeof from !== 'string'
    || typeof to !== 'string'
    || !SQUARE.test(from)
    || !SQUARE.test(to)
    || from === to
  ) return reject(state, 'INVALID_TARGET', 'Choose distinct valid from and to squares.');
  const move: CardMove = { from: from as SquareName, to: to as SquareName };
  const piece = state.pieces.find(entry => entry.zone === 'board' && entry.square === move.from);
  if (!piece) return reject(state, 'INVALID_TARGET', `There is no piece on ${move.from}.`);
  if (!piece.neutral && piece.owner === color) {
    return reject(state, 'WRONG_OWNER', "Choose one of your opponent's pieces.");
  }
  if (!rebirthDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Choose a legal unoccupied or friendly starting square.');
  }
  if (forbiddenCityBlocksMove(state, move.from, move.to, true)) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
  }

  const victim = state.pieces.find(entry => entry.zone === 'board' && entry.square === move.to);
  const resolved = structuredClone(state);
  resolved.pieces.find(entry => entry.id === piece.id)!.square = move.to;
  if (victim) {
    losePiece(resolved, resolved.pieces.find(entry => entry.id === victim.id)!, 'captured');
  }
  syncFen(resolved, [piece, ...(victim ? [victim] : [])]);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'rebirth', 'DIRECT_MATE', cardInstanceId);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [piece])) {
    return fizzleCard(state, 'rebirth', 'SELF_CHECK', cardInstanceId);
  }

  spendCard(resolved, 'rebirth', cardInstanceId);
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'rebirth',
    target: [move],
    ...(victim ? { capturedId: victim.id } : {}),
  });
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
      && hasRole(phase, piece, 'bishop')
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
      if (!hasRole(phase, bishop, 'bishop')) {
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
      if (forbiddenCityBlocksMove(phase, move.from, move.to)) {
        return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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

function figureDanceMoves(state: GameState) {
  return FIGURE_DANCE_CORNERS.flatMap(([from, to]) => {
    const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
    return piece ? [{ piece, from, to }] : [];
  });
}

function figureDancePromotionMoves(state: GameState) {
  const moves = figureDanceMoves(state);
  return [state.turn.color, opposite(state.turn.color)].flatMap(owner => moves.filter(({ piece, to }) =>
    piece.owner === owner
    && hasUnpromotedPawn(state, piece)
    && !confabulationForPiece(state, piece.id)
    && isPromotionSquare(state, owner, to),
  ));
}

function playFigureDance(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'figure-dance' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Figure Dance is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Figure Dance is played after the regular move.');
  }
  if (
    !Array.isArray(target)
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target).some(key =>
      key !== 'length'
      && (typeof key !== 'string' || !/^\d+$/.test(key) || Number(key) >= target.length)
    )
    || Array.from(target).some(declaration =>
      !declaration
      || typeof declaration !== 'object'
      || Array.isArray(declaration)
      || Object.getPrototypeOf(declaration) !== Object.prototype
      || Reflect.ownKeys(declaration).length !== 2
      || !Object.hasOwn(declaration, 'square')
      || !Object.hasOwn(declaration, 'role')
    )
  ) return reject(state, 'INVALID_TARGET', 'Declare every required Figure Dance promotion.');

  const parsed = target.map(declaration => {
    const { square, role } = declaration as Record<string, unknown>;
    return typeof square === 'string'
      && SQUARE.test(square)
      && typeof role === 'string'
      && PROMOTIONS.has(role as Role)
      ? { square: square as SquareName, role: role as PromotionDeclaration['role'] }
      : undefined;
  });
  const required = figureDancePromotionMoves(state);
  const requiredBySquare = new Map<SquareName, (typeof required)[number]>(
    required.map(move => [move.to, move]),
  );
  if (
    parsed.length !== required.length
    || parsed.some(declaration => !declaration || !requiredBySquare.has(declaration.square))
    || new Set(parsed.map(declaration => declaration?.square)).size !== parsed.length
  ) return reject(state, 'INVALID_TARGET', 'Declare every qualifying destination exactly once.');

  const promotions = parsed as PromotionDeclaration[];
  let opponentSeen = false;
  for (const declaration of promotions) {
    const owner = requiredBySquare.get(declaration.square)!.piece.owner;
    if (owner !== color) opponentSeen = true;
    else if (opponentSeen) {
      return reject(state, 'INVALID_TARGET', 'Declare the acting player\'s promotions first.');
    }
  }

  const moves = figureDanceMoves(state);
  if (moves.some(move => forbiddenCityBlocksMove(state, move.from, move.to))) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
  }
  const resolved = structuredClone(state);
  for (const { piece, to } of moves) {
    resolved.pieces.find(candidate => candidate.id === piece.id)!.square = to;
  }
  for (const declaration of promotions) {
    const promoted = resolved.pieces.find(candidate =>
      candidate.id === requiredBySquare.get(declaration.square)!.piece.id,
    )!;
    promoted.role = declaration.role;
    promoted.promoted = true;
  }
  syncFen(resolved, moves.map(move => move.piece));

  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'figure-dance', 'DIRECT_MATE', cardInstanceId);
  }
  if (moveLeavesRoyalInCheck(resolved, color, moves.map(move => move.piece))) {
    return fizzleCard(state, 'figure-dance', 'SELF_CHECK', cardInstanceId);
  }

  spendCard(resolved, 'figure-dance', cardInstanceId);
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'figure-dance',
    target: promotions,
  });
  return { ok: true, state: resolved };
}

function earthquakeOrientation(
  orientation: BoardOrientation,
  direction: EarthquakeDirection,
): BoardOrientation {
  return ((orientation + (direction === 'clockwise' ? 90 : 270)) % 360) as BoardOrientation;
}

function earthquakePromotionPieces(
  state: GameState,
  direction: EarthquakeDirection,
): PieceState[] {
  const rotated = { ...state, orientation: earthquakeOrientation(state.orientation, direction) };
  return [opposite(state.turn.color), state.turn.color].flatMap(owner =>
    state.pieces
      .filter(piece =>
        piece.owner === owner
        && piece.zone === 'board'
        && piece.square
        && hasUnpromotedPawn(state, piece)
        && !confabulationForPiece(state, piece.id)
        && isPromotionSquare(rotated, owner, piece.square)
      )
      .sort((left, right) => parseSquare(left.square!) - parseSquare(right.square!)),
  );
}

function playEarthquake(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'earthquake' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Earthquake is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Earthquake is played after the regular move.');
  }
  if (
    !target
    || typeof target !== 'object'
    || Array.isArray(target)
    || Object.getPrototypeOf(target) !== Object.prototype
    || Reflect.ownKeys(target).length !== 2
    || !Object.hasOwn(target, 'direction')
    || !Object.hasOwn(target, 'promotions')
  ) return reject(state, 'INVALID_TARGET', 'Choose a direction and every required promotion.');

  const fields = target as Record<string, unknown>;
  const direction = fields.direction;
  const promotions = fields.promotions;
  if (
    (direction !== 'clockwise' && direction !== 'counterclockwise')
    || !Array.isArray(promotions)
    || Object.getPrototypeOf(promotions) !== Array.prototype
    || Reflect.ownKeys(promotions).some(key =>
      key !== 'length'
      && (typeof key !== 'string' || !/^\d+$/.test(key) || Number(key) >= promotions.length)
    )
    || Array.from(promotions).some(promotion =>
      !promotion
      || typeof promotion !== 'object'
      || Array.isArray(promotion)
      || Object.getPrototypeOf(promotion) !== Object.prototype
      || Reflect.ownKeys(promotion).length !== 2
      || !Object.hasOwn(promotion, 'square')
      || !Object.hasOwn(promotion, 'role')
    )
  ) return reject(state, 'INVALID_TARGET', 'Choose a direction and every required promotion.');

  const required = earthquakePromotionPieces(state, direction);
  const parsedPromotions = promotions.map(promotion => {
    const { square, role } = promotion as Record<string, unknown>;
    return typeof square === 'string' && SQUARE.test(square) && typeof role === 'string' && PROMOTIONS.has(role as Role)
      ? { square: square as SquareName, role: role as EarthquakeTarget['promotions'][number]['role'] }
      : undefined;
  });
  if (
    parsedPromotions.length !== required.length
    || parsedPromotions.some((promotion, index) =>
      !promotion || promotion.square !== required[index].square
    )
  ) return reject(state, 'INVALID_TARGET', 'Promote every qualifying Pawn, opponent first and in square order.');

  const canonicalTarget: EarthquakeTarget = {
    direction,
    promotions: parsedPromotions as EarthquakeTarget['promotions'],
  };
  const resolved = structuredClone(state);
  resolved.orientation = earthquakeOrientation(state.orientation, direction);
  required.forEach((piece, index) => {
    const promoted = resolved.pieces.find(candidate => candidate.id === piece.id)!;
    promoted.role = canonicalTarget.promotions[index].role;
    promoted.promoted = true;
  });
  resolved.enPassant = [];
  syncFen(resolved);

  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'earthquake', 'DIRECT_MATE', cardInstanceId);
  }
  if (moveLeavesRoyalInCheck(resolved, color, required)) {
    return fizzleCard(state, 'earthquake', 'SELF_CHECK', cardInstanceId);
  }

  const card = spendCard(resolved, 'earthquake', cardInstanceId, false);
  resolved.effects.push({ type: 'earthquake', owner: color, card, direction, target: canonicalTarget });
  resolved.history.push({ type: 'cardPlayed', cardId: 'earthquake', target: canonicalTarget });
  return { ok: true, state: resolved };
}

type RetainedEffect = Record<string, unknown> & {
  type: string;
  owner: Color;
  card: CardInstance;
};

function isRetainedContinuingEffect(effect: unknown): effect is RetainedEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  if (
    !record
    || Object.getPrototypeOf(effect) !== Object.prototype
    || !card
    || Object.getPrototypeOf(record.card) !== Object.prototype
    || (record.owner !== 'white' && record.owner !== 'black')
    || typeof record.type !== 'string'
    || typeof card.id !== 'string'
    || typeof card.cardId !== 'string'
    || record.type !== card.cardId
  ) return false;
  return !Object.hasOwn(CARD_CATALOG, card.cardId) || CARD_CATALOG[card.cardId].continuing !== false;
}

function peaceTalksTargets(state: GameState): string[] {
  const color = state.turn.color;
  if (
    state.outcome
    || state.turn.phase !== 'afterMove'
    || !state.turn.moveMade
    || state.turn.cardPlays[color] >= 1
    || !state.players[color].hand.some(card => card.cardId === 'peace-talks')
  ) return [];
  const counts = new Map<string, number>();
  for (const effect of state.effects) {
    const card = effectRecord(effectRecord(effect)?.card);
    if (typeof card?.id === 'string') counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
  }
  return state.effects.flatMap(effect =>
    isRetainedContinuingEffect(effect)
      && counts.get(effect.card.id) === 1
      && (effect.type !== 'earthquake'
        || effect.direction === 'clockwise'
        || effect.direction === 'counterclockwise')
      && (effect.type !== 'coup' || safeCoupPieces(state, effect) !== undefined)
      ? [effect.card.id]
      : [],
  );
}

function safeCoupPieces(state: GameState, effect: RetainedEffect): [PieceState, PieceState] | undefined {
  const prince = typeof effect.princeId === 'string'
    ? state.pieces.find(piece => piece.id === effect.princeId)
    : undefined;
  const king = typeof effect.kingId === 'string'
    ? state.pieces.find(piece => piece.id === effect.kingId)
    : undefined;
  const pieces = prince
    && king
    && prince !== king
    && prince.zone === 'board'
    && king.zone === 'board'
    && prince.square
    && king.square
    && SQUARE.test(prince.square)
    && SQUARE.test(king.square)
    ? [prince, king] as [PieceState, PieceState]
    : undefined;
  if (!pieces) return undefined;
  const [restoredPrince, demotedKing] = pieces;
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === restoredPrince.id)!.royal = true;
  resolved.pieces.find(piece => piece.id === demotedKing.id)!.royal = false;
  return isOrdinaryCheckmate(resolved, restoredPrince.owner) ? undefined : pieces;
}

function playPeaceTalks(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'peace-talks' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Peace Talks is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Peace Talks is played after the regular move.');
  }
  if (typeof target !== 'string' || !peaceTalksTargets(state).includes(target)) {
    return reject(state, 'INVALID_TARGET', 'Choose one retained Continuing Effect card.');
  }

  const effect = state.effects.find((candidate): candidate is RetainedEffect =>
    isRetainedContinuingEffect(candidate) && candidate.card.id === target,
  )!;
  const coupPieces = effect.type === 'coup' ? safeCoupPieces(state, effect) : undefined;

  const resolved = structuredClone(state);
  spendCard(resolved, 'peace-talks', cardInstanceId);
  resolved.effects = resolved.effects.filter(candidate =>
    !isRetainedContinuingEffect(candidate) || candidate.card.id !== target,
  );
  if (!(['white', 'black'] as const).some(owner =>
    ['hand', 'deck', 'discard'].some(pile =>
      resolved.players[owner][pile as keyof typeof resolved.players[typeof owner]].some(card => card.id === effect.card.id),
    )
  )) resolved.players[effect.owner].discard.push(structuredClone(effect.card));
  if (effect.type === 'doomsayer' && resolved.pendingDoomsayer?.cardInstanceId === effect.card.id) {
    resolved.pendingDoomsayer = null;
  }
  if (effect.type === 'earthquake') {
    resolved.orientation = earthquakeOrientation(
      state.orientation,
      effect.direction === 'clockwise' ? 'counterclockwise' : 'clockwise',
    );
  }
  if (coupPieces) {
    resolved.pieces.find(piece => piece.id === coupPieces[0].id)!.royal = true;
    resolved.pieces.find(piece => piece.id === coupPieces[1].id)!.royal = false;
  }
  resolved.history.push({ type: 'cardPlayed', cardId: 'peace-talks' });
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
    !hasRole(state, firstPiece, config.firstRole)
    || !hasRole(state, secondPiece, config.secondRole)
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

function playForbiddenCity(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if ((cardInstanceId !== undefined && typeof cardInstanceId !== 'string') || !state.players[color].hand.some(card => card.cardId === 'forbidden-city' && (cardInstanceId === undefined || card.id === cardInstanceId))) return reject(state, 'CARD_NOT_IN_HAND', 'Forbidden City is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Forbidden City is played after the regular move.');
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose an unoccupied square.');
  const square = target as SquareName;
  if (state.pieces.some(piece => piece.zone === 'board' && piece.square === square) || forbiddenCitySquares(state).has(square)) return reject(state, 'INVALID_TARGET', 'Choose an unoccupied, unmarked square.');
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'forbidden-city', cardInstanceId, false);
  resolved.effects.push({ type: 'forbidden-city', owner: color, card, square } satisfies ForbiddenCityEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'forbidden-city', target: square });
  return { ok: true, state: resolved };
}

function playCrab(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'crab' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Crab is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Crab is played after the regular move.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) {
    return reject(state, 'INVALID_TARGET', 'Choose one of your Pawns.');
  }
  const targetSquare = target as SquareName;
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === targetSquare);
  if (!pawn) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (pawn.owner !== color && !pawn.neutral) return reject(state, 'WRONG_OWNER', 'Choose one of your own Pawns.');
  if (!hasUnpromotedPawn(state, pawn)) {
    return reject(state, 'WRONG_ROLE', 'Crab can target only an unpromoted Pawn.');
  }

  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'crab', cardInstanceId, false);
  const pawnComponent = physicalPieces(state, pawn).find(component =>
    component.originalRole === 'pawn' && !component.promoted,
  )!;
  resolved.effects.push({ type: 'crab', owner: color, card, pieceId: pawnComponent.id } satisfies CrabEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'crab', target: targetSquare });
  return { ok: true, state: resolved };
}

function playVendetta(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'vendetta' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Vendetta is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Vendetta is played after the regular move.');
  }
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Vendetta does not take a target.');

  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'vendetta', cardInstanceId, false);
  resolved.effects.push({ type: 'vendetta', owner: color, card } satisfies VendettaEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'vendetta' });
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
  for (const id of move?.capturedIds ?? [captured.id]) {
    const piece = resolved.pieces.find(candidate => candidate.id === id);
    if (piece?.zone === 'captured') piece.zone = 'dead';
  }
  spendCard(resolved, 'no-quarter', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'no-quarter' });
  return { ok: true, state: resolved };
}

function playPanic(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'panic' && (cardInstanceId === undefined || card.id === cardInstanceId)
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Panic is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Panic is played after your move.');
  }
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Panic does not take a target.');

  const resolved = structuredClone(state);
  spendCard(resolved, 'panic', cardInstanceId);
  resolved.effects.push({
    type: 'panic',
    owner: color,
    player: opposite(color),
    durationMs: 15000,
  } satisfies PanicEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'panic' });
  return { ok: true, state: resolved };
}

function playGhostwalk(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'ghostwalk' && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Ghostwalk is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Ghostwalk is played instead of the regular move.');
  }

  const moves = parseCardMoves(target, 1);
  if (
    !moves
    || moves.length !== 1
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key => key !== 'length' && key !== '0')
    || Object.getPrototypeOf((target as unknown[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')
  ) return reject(state, 'INVALID_TARGET', 'Choose exactly one plain move.');

  const [move] = moves;
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!mover) return reject(state, 'INVALID_TARGET', 'Choose a piece on the board.');
  if (mover.owner !== color && !mover.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  }
  const components = physicalPieces(state, mover);
  if (mover.royal || components.some(component => component.royal)) {
    return reject(state, 'WRONG_ROLE', 'Ghostwalk cannot move a royal piece.');
  }
  if (!(['pawn', 'bishop', 'rook', 'queen'] as const).some(role => hasRole(state, mover, role))) {
    return reject(state, 'WRONG_ROLE', 'Choose a Pawn, Bishop, Rook, or Queen.');
  }
  if (state.pieces.some(piece => piece.zone === 'board' && piece.square === move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'Ghostwalk must end on an empty square.');
  }

  const pathState = structuredClone(state);
  for (const piece of pathState.pieces) {
    if (
      piece.id !== mover.id
      && piece.zone === 'board'
      && (piece.owner === color || piece.neutral)
    ) {
      piece.zone = 'away';
      piece.square = null;
    }
  }
  const pathMover = pathState.pieces.find(piece => piece.id === mover.id)!;
  if (!physicalPieces(pathState, pathMover).some(component =>
    componentCanMove(pathState, pathMover, component, move.to, false),
  )) return reject(state, 'ILLEGAL_MOVE', 'That is not a legal Ghostwalk move.');

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === mover.id)!.square = move.to;
  const enPassant = physicalPieces(pathState, pathMover).flatMap(component =>
    component.originalRole === 'pawn' && !component.promoted
      ? doubleStepEnPassant(pathState, component, move.from, move.to)
      : [],
  ).filter(opportunity => !state.pieces.some(piece =>
    piece.zone === 'board' && piece.square === opportunity.target,
  ));
  completeReplacementMove(
    resolved,
    color,
    hasUnpromotedPawn(state, mover),
    enPassant,
    components,
  );
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'ghostwalk', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, components)) {
    return fizzleCard(state, 'ghostwalk', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, 'ghostwalk', cardInstanceId);
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'ghostwalk',
    target: moves,
    movement: moves,
    preservePreviousMove: false,
  });
  return { ok: true, state: resolved };
}

function playIrresistibleForce(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if (
    (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card =>
      card.cardId === 'irresistible-force'
      && (cardInstanceId === undefined || card.id === cardInstanceId),
    )
  ) return reject(state, 'CARD_NOT_IN_HAND', 'Irresistible Force is not in your hand.');
  if (state.turn.cardPlays[color] >= 1) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Irresistible Force is played instead of the regular move.');
  }

  const moves = parseCardMoves(target, 1);
  if (
    !moves
    || moves.length !== 1
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key => key !== 'length' && key !== '0')
    || Object.getPrototypeOf((target as unknown[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')
  ) return reject(state, 'INVALID_TARGET', 'Choose exactly one plain move.');

  const [move] = moves;
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!mover) return reject(state, 'INVALID_TARGET', 'Choose a piece on the board.');
  if (mover.owner !== color && !mover.neutral) {
    return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  }
  const source = parseSquare(move.from);
  const pawn = physicalPieces(state, mover).find(component => {
    if (component.originalRole !== 'pawn' || component.promoted) return false;
    const [fileStep, rankStep] = pawnForward(state, component.owner);
    return squareFile(parseSquare(move.to)) - squareFile(source) === fileStep
      && squareRank(parseSquare(move.to)) - squareRank(source) === rankStep;
  });
  if (!pawn) return reject(state, 'WRONG_ROLE', 'Move an unpromoted original Pawn one square in front.');
  const first = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.to);
  if (!first) return reject(state, 'INVALID_TARGET', 'The square in front of the Pawn must be occupied.');

  const [fileStep, rankStep] = pawnForward(state, pawn.owner);
  const chain = [mover];
  let terminalOffBoard = false;
  for (let carrier = first; carrier;) {
    if (physicalPieces(state, carrier).some(component =>
      component.royal || component.role === 'king' || component.originalRole === 'king'
    )) return reject(state, 'INVALID_TARGET', 'A King cannot be pushed.');
    chain.push(carrier);
    const square = parseSquare(carrier.square!);
    const file = squareFile(square) + fileStep;
    const rank = squareRank(square) + rankStep;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) {
      terminalOffBoard = true;
      break;
    }
    const next = makeSquare(rank * 8 + file);
    carrier = state.pieces.find(piece => piece.zone === 'board' && piece.square === next)!;
    if (!carrier) break;
  }

  for (const carrier of chain) {
    const square = parseSquare(carrier.square!);
    const file = squareFile(square) + fileStep;
    const rank = squareRank(square) + rankStep;
    if (
      file >= 0 && file <= 7 && rank >= 0 && rank <= 7
      && forbiddenCityBlocksMove(state, carrier.square!, makeSquare(rank * 8 + file))
    ) return reject(state, 'ILLEGAL_MOVE', 'That push is blocked by Forbidden City.');
  }
  const terminal = terminalOffBoard ? chain.at(-1)! : undefined;
  if (terminal && (captureForbidden(state, mover) || captureImmune(state, terminal))) {
    return reject(state, 'INVALID_TARGET', 'The last piece cannot be taken.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const movedPieces = chain.flatMap(carrier => physicalPieces(state, carrier));
  const resolved = structuredClone(state);
  let capturedIds: string[] = [];
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const carrier = resolved.pieces.find(piece => piece.id === chain[index].id)!;
    const square = parseSquare(chain[index].square!);
    const file = squareFile(square) + fileStep;
    const rank = squareRank(square) + rankStep;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) {
      capturedIds = losePiece(resolved, carrier, 'captured');
    } else {
      carrier.square = makeSquare(rank * 8 + file);
    }
  }
  completeReplacementMove(resolved, color, true, [], movedPieces);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'irresistible-force', 'DIRECT_MATE', cardInstanceId, !wasInCheck);
  }
  if (moveLeavesRoyalInCheck(resolved, color, movedPieces)) {
    return fizzleCard(state, 'irresistible-force', 'SELF_CHECK', cardInstanceId, !wasInCheck);
  }

  spendCard(resolved, 'irresistible-force', cardInstanceId);
  resolved.history.push({
    type: 'cardPlayed',
    cardId: 'irresistible-force',
    target: moves,
    ...(terminal ? { capturedId: terminal.id } : {}),
    ...(capturedIds.length > 1 ? { capturedIds } : {}),
    preservePreviousMove: false,
  });
  return { ok: true, state: resolved };
}

function playTruce(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  if ((cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card => card.cardId === 'truce'
      && (cardInstanceId === undefined || card.id === cardInstanceId))) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Truce is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Truce is played after the regular move.');
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Truce does not take a target.');
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'truce', cardInstanceId, false);
  resolved.effects.push({ type: 'truce', owner: color, card });
  resolved.history.push({ type: 'cardPlayed', cardId: 'truce' });
  return { ok: true, state: resolved };
}

function playVulture(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const response = state.cardResponse;
  if (!response || response.historyLength !== state.history.length) {
    return reject(state, 'INVALID_TIMING', 'Vulture immediately follows an opponent card.');
  }
  const color = opposite(response.player);
  if ((cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card => card.cardId === 'vulture'
      && (cardInstanceId === undefined || card.id === cardInstanceId))) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Vulture is not in your hand.');
  }
  if (state.turn.cardPlays[color] >= 1) return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Vulture does not take a target.');
  const discard = state.players[response.player].discard;
  const played = state.playedCards?.slice().reverse().find(entry => entry.player === response.player
    && discard.some(card => card.id === entry.cardInstanceId));
  if (!played) return reject(state, 'INVALID_TARGET', 'There is no eligible played card to take.');
  const resolved = structuredClone(state);
  const opponentDiscard = resolved.players[response.player].discard;
  const [taken] = opponentDiscard.splice(opponentDiscard.findIndex(card => card.id === played.cardInstanceId), 1);
  const player = resolved.players[color];
  const cost = player.deck.shift();
  if (cost) player.discard.push(cost);
  spendCard(resolved, 'vulture', cardInstanceId, true, color);
  player.hand.push(taken);
  resolved.history.push({ type: 'cardPlayed', cardId: 'vulture', player: color });
  return { ok: true, state: resolved };
}

function playCardUnchecked(state: GameState, cardId: string, target: unknown, cardInstanceId?: unknown): ApplyResult {
  if (cardId === 'vulture') return playVulture(state, target, cardInstanceId);
  if (cardId === 'truce') return playTruce(state, target, cardInstanceId);
  if (cardId === 'ghostwalk') return playGhostwalk(state, target, cardInstanceId);
  if (cardId === 'irresistible-force') return playIrresistibleForce(state, target, cardInstanceId);
  if (cardId === 'confabulation') return playConfabulation(state, target, cardInstanceId);
  if (cardId === 'bog') return playBog(state, target, cardInstanceId);
  if (cardId === 'revenge') return playRevenge(state, target, cardInstanceId);
  if (cardId === 'toll') return playToll(state, target, cardInstanceId);
  if (cardId === 'assassin') return playAssassin(state, target, cardInstanceId);
  if (cardId === 'dark-mirror') return playDarkMirror(state, target, cardInstanceId);
  if (cardId === 'breakthrough') return playDarkMirror(state, target, cardInstanceId, cardId);
  if (cardId === 'forbidden-city') return playForbiddenCity(state, target, cardInstanceId);
  if (cardId === 'disintegration') return playDisintegration(state, target, cardInstanceId);
  if (cardId === 'doomsayer') return playDoomsayer(state, target, cardInstanceId);
  if (cardId === 'pacifism') return playPacifism(state, target, cardInstanceId);
  if (cardId === 'crab') return playCrab(state, target, cardInstanceId);
  if (cardId === 'vendetta') return playVendetta(state, target, cardInstanceId);
  if (cardId === 'fanatic') return playFanatic(state, target, cardInstanceId);
  if (cardId === 'madman') return playMadman(state, target, cardInstanceId);
  if (cardId === 'annexation') return playAnnexation(state, target, cardInstanceId);
  if (cardId === 'guardian') return playGuardian(state, target, cardInstanceId);
  if (cardId === 'forced-march') return playForcedMarch(state, target, cardInstanceId);
  if (cardId === 'onslaught') return playOnslaught(state, target, cardInstanceId);
  if (cardId === 'long-jump') return playLongJump(state, target, cardInstanceId);
  if (cardId === 'dubbing') return playDubbing(state, target, cardInstanceId);
  if (cardId === 'masquerade' || cardId === 'blessing') return playSlidingMoveCard(state, cardId, target, cardInstanceId);
  if (cardId === 'doppelganger') return playDoppelganger(state, target, cardInstanceId);
  if (cardId === 'squaring-the-circle') return playSquaringTheCircle(state, target, cardInstanceId);
  if (cardId === 'cowardice') return playCowardice(state, target, cardInstanceId);
  if (cardId === 'rebirth') return playRebirth(state, target, cardInstanceId);
  if (cardId === 'heresy') return playHeresy(state, target, cardInstanceId);
  if (cardId === 'figure-dance') return playFigureDance(state, target, cardInstanceId);
  if (cardId === 'earthquake') return playEarthquake(state, target, cardInstanceId);
  if (cardId === 'peace-talks') return playPeaceTalks(state, target, cardInstanceId);
  if (cardId === 'no-quarter') return playNoQuarter(state, target, cardInstanceId);
  if (cardId === 'panic') return playPanic(state, target, cardInstanceId);
  if (cardId === 'holy-war' || cardId === 'anathema' || cardId === 'holy-quest' || cardId === 'treason' || cardId === 'cathedral' || cardId === 'siege' || cardId === 'evangelists' || cardId === 'tournament' || cardId === 'lost-castle') {
    return playSwapCard(state, cardId, target, cardInstanceId);
  }
  return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
}

function playCard(state: GameState, cardId: string, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const captureRequired = state.turn.phase === 'beforeMove'
    && activeVendettas(state).length > 0
    && vendettaCaptureDests(state).size > 0;
  const result = playCardUnchecked(state, cardId, target, cardInstanceId);
  const effectsBeforeExpiry = result.ok ? result.state.effects : undefined;
  expirePieceEffects(result);
  if (result.ok && result.state.history.at(-1)?.type === 'cardPlayed'
    && result.state.effects !== effectsBeforeExpiry
    && CARD_CATALOG[cardId]?.continuing === false) {
    const reaction = cardId === 'bog' || cardId === 'revenge' || cardId === 'toll';
    const actor = reaction ? opposite(state.turn.color) : state.turn.color;
    const defender = opposite(actor);
    const consumesMove = !state.turn.moveMade && result.state.turn.moveMade
      && !isKingInCheck(state, actor);
    const directMate = (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(result.state, defender))
      || (cardId === 'bog' && !isOrdinaryCheckmate(state, actor) && isOrdinaryCheckmate(result.state, actor));
    const selfCheck = (result.state.turn.moveMade && isKingInCheck(result.state, actor)
      && (!reaction || cardId === 'bog' || !isKingInCheck(state, actor)))
      || (cardId === 'bog' && isKingInCheck(result.state, defender));
    if (directMate || selfCheck) {
      const fizzled = fizzleCard(state, cardId, directMate ? 'DIRECT_MATE' : 'SELF_CHECK', cardInstanceId, consumesMove, actor);
      if (fizzled.ok && cardId === 'toll') {
        fizzled.state.history.at(-1)!.player = actor;
        delete fizzled.state.turnCheckpoint;
      }
      return fizzled;
    }
  }
  if (captureRequired && result.ok && result.state.turn.moveMade) {
    const event = result.state.history.at(-1);
    const victim = (event?.cardId === 'dark-mirror' || event?.cardId === 'breakthrough') && event.capturedId
      ? state.pieces.find(piece => piece.id === event.capturedId)
      : undefined;
    if (!victim || victim.owner !== opposite(state.turn.color)) {
      return reject(state, 'ILLEGAL_MOVE', 'Vendetta requires an available capture of an opponent piece.');
    }
  }
  return result;
}

export function cardPlayTargets(state: GameState, cardId: string): unknown[] {
  if (cardId === 'breakthrough') {
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square
      ? breakthroughDests(state, piece.square).map(to => [{ from: piece.square!, to }]) : []);
  }
  if (cardId === 'vulture') return !state.outcome && playVulture(state, undefined).ok ? [undefined] : [];
  if (cardId === 'truce') return !state.outcome && playTruce(state, undefined).ok ? [undefined] : [];
  if (cardId === 'panic') {
    if (state.outcome) return [];
    const result = applyAction(state, { type: 'playCard', cardId: 'panic' });
    const event = result.ok ? result.state.history.at(-1) : undefined;
    return event?.type === 'cardPlayed' && event.cardId === 'panic' ? [undefined] : [];
  }
  if (cardId === 'ghostwalk') {
    return state.pieces.flatMap(piece => {
      if (piece.zone !== 'board' || !piece.square) return [];
      return Array.from({ length: 64 }, (_, square) => [{
        from: piece.square!,
        to: makeSquare(square),
      }]).filter(target => {
        const result = playCard(state, 'ghostwalk', target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      });
    });
  }
  if (cardId === 'irresistible-force') {
    const targets = new Map<string, CardMove[]>();
    for (const piece of state.pieces) {
      if (
        piece.zone !== 'board'
        || !piece.square
        || (piece.owner !== state.turn.color && !piece.neutral)
      ) continue;
      for (const pawn of physicalPieces(state, piece)) {
        if (pawn.originalRole !== 'pawn' || pawn.promoted) continue;
        const source = parseSquare(piece.square);
        const [fileStep, rankStep] = pawnForward(state, pawn.owner);
        const file = squareFile(source) + fileStep;
        const rank = squareRank(source) + rankStep;
        if (file < 0 || file > 7 || rank < 0 || rank > 7) continue;
        const to = makeSquare(rank * 8 + file);
        if (!state.pieces.some(candidate => candidate.zone === 'board' && candidate.square === to)) continue;
        const target = [{ from: piece.square, to }];
        const result = playCard(state, 'irresistible-force', target);
        if (result.ok && result.state.history.at(-1)?.type === 'cardPlayed') {
          targets.set(`${piece.square}-${to}`, target);
        }
      }
    }
    return [...targets.values()];
  }
  if (cardId === 'confabulation') {
    const pieces = state.pieces.filter(piece =>
      piece.zone === 'board'
      && piece.square
      && (piece.owner === state.turn.color || piece.neutral)
      && !piece.royal
      && !hasRole(state, piece, 'king')
      && !confabulationForPiece(state, piece.id),
    );
    return pieces.flatMap(mover => pieces.flatMap(carrier => {
      if (mover.id === carrier.id || !componentCanMove(state, mover, mover, carrier.square!, true)) return [];
      const target = [{ from: mover.square!, to: carrier.square! }];
      const result = playConfabulation(state, target);
      return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [target] : [];
    }));
  }
  if (cardId === 'masquerade' || cardId === 'blessing') {
    if (state.outcome) return [];
    const destinations = cardId === 'blessing' ? blessingDests : masqueradeDests;
    return state.pieces.flatMap(piece =>
      piece.zone === 'board' && piece.square
        ? destinations(state, piece.square).flatMap(to => {
            const target = [{ from: piece.square!, to }];
            const result = playCard(state, cardId, target);
            return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [target] : [];
          })
        : [],
    );
  }
  if (cardId === 'forbidden-city') {
    const occupied = new Set(state.pieces.flatMap(piece =>
      piece.zone === 'board' && piece.square ? [piece.square] : [],
    ));
    const marked = forbiddenCitySquares(state);
    return Array.from({ length: 64 }, (_, square) => makeSquare(square))
      .filter(square => !occupied.has(square) && !marked.has(square));
  }
  if (cardId === 'toll') return tollTargets(state);
  if (cardId === 'revenge') return revengeTargets(state);
  if (cardId === 'rebirth') return state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square
      ? rebirthDests(state, piece.square).map(to => [{ from: piece.square!, to }])
      : [],
  );
  if (cardId === 'figure-dance') {
    return figureDancePromotionMoves(state).reduce<PromotionDeclaration[][]>(
      (targets, move) => targets.flatMap(target => [...PROMOTIONS].map(role => [...target, {
        square: move.to,
        role: role as PromotionDeclaration['role'],
      }])),
      [[]],
    );
  }
  if (cardId === 'earthquake') {
    return (['clockwise', 'counterclockwise'] as const).flatMap(direction => {
      const pieces = earthquakePromotionPieces(state, direction);
      return pieces.reduce<EarthquakeTarget[]>(
        (targets, piece) => targets.flatMap(target => [...PROMOTIONS].map(role => ({
          direction,
          promotions: [...target.promotions, {
            square: piece.square!,
            role: role as EarthquakeTarget['promotions'][number]['role'],
          }],
        }))),
        [{ direction, promotions: [] }],
      );
    });
  }
  if (cardId === 'peace-talks') return peaceTalksTargets(state);
  if (cardId === 'madman') return madmanTargets(state);
  if (cardId === 'pacifism') return state.pieces.flatMap(piece =>
    piece.zone === 'board'
      && piece.square
      && (piece.owner === state.turn.color || piece.neutral)
      && !piece.royal
      ? [piece.square]
      : [],
  );
  if (cardId === 'crab') return state.pieces.flatMap(piece =>
    piece.zone === 'board'
      && piece.square
      && (piece.owner === state.turn.color || piece.neutral)
      && hasUnpromotedPawn(state, piece)
      ? [piece.square]
      : [],
  );
  if (cardId === 'doomsayer' || cardId === 'no-quarter' || cardId === 'vendetta') return [undefined];
  if (cardId === 'bog') return [undefined];
  if (cardId === 'holy-war' || cardId === 'anathema' || cardId === 'holy-quest' || cardId === 'treason' || cardId === 'cathedral' || cardId === 'siege' || cardId === 'evangelists' || cardId === 'tournament' || cardId === 'lost-castle') {
    const config = SWAP_CARDS[cardId];
    const matchesOwner = (piece: PieceState, owner: 'own' | 'opponent') => piece.neutral
      || (owner === 'own' ? piece.owner === state.turn.color : piece.owner !== state.turn.color);
    const candidates = state.pieces.filter(piece => piece.zone === 'board' && piece.square);
    const firstPieces = candidates.filter(piece =>
      matchesOwner(piece, config.firstOwner)
      && hasRole(state, piece, config.firstRole),
    );
    const secondPieces = candidates.filter(piece =>
      matchesOwner(piece, config.secondOwner)
      && hasRole(state, piece, config.secondRole),
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
        && hasRole(phase, piece, 'bishop')
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
  if (cardId !== 'assassin' && cardId !== 'dark-mirror' && cardId !== 'forced-march' && cardId !== 'annexation' && cardId !== 'onslaught' && cardId !== 'long-jump' && cardId !== 'dubbing' && cardId !== 'masquerade' && cardId !== 'doppelganger' && cardId !== 'squaring-the-circle' && cardId !== 'cowardice') {
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square ? [piece.square] : []);
  }

  const steps = state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square
      ? (cardId === 'assassin'
          ? assassinDests
          : cardId === 'dark-mirror'
            ? darkMirrorDests
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
                  : cardId === 'masquerade'
                    ? masqueradeDests
                  : cardId === 'doppelganger'
                    ? doppelgangerDests
                  : cardId === 'squaring-the-circle'
                    ? squaringTheCircleDests
                  : cowardiceDests)(state, piece.square)
          .map(to => ({ from: piece.square!, to }))
      : [],
  );
  if (cardId === 'assassin' || cardId === 'dark-mirror' || cardId === 'long-jump' || cardId === 'dubbing' || cardId === 'masquerade' || cardId === 'doppelganger' || cardId === 'squaring-the-circle' || cardId === 'cowardice') {
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
    const piece = boardCarrier(state, loss.pieceId);
    return piece ? [piece] : [];
  });
  if (selected.length !== mappings.length) {
    return reject(state, 'INVALID_TARGET', 'Every loss must identify a physical board piece.');
  }
  if (new Set(selected.map(piece => piece.id)).size !== selected.length) {
    return reject(state, 'INVALID_TARGET', 'Choose each merged object at most once.');
  }
  if (selected.some(piece => piece.owner !== speaker)) {
    return reject(state, 'WRONG_OWNER', 'The named player can lose only an owned piece.');
  }
  if (selected.some(piece => piece.royal || captureImmune(state, piece))) {
    return reject(state, 'INVALID_TARGET', 'That piece cannot be captured by Doomsayer.');
  }
  if (selected.some(piece => !hasRole(state, piece, role as Role))) {
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
  const capturedIds = selected.flatMap(piece =>
    losePiece(resolved, resolved.pieces.find(candidate => candidate.id === piece.id)!, 'captured'),
  );
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
    capturedIds,
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
        return losePiece(checkpoint, loss, 'captured').flatMap(id =>
          checkpoint.pieces.find(candidate => candidate.id === id) ?? [],
        );
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
  enforceVendetta = true,
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
  if (
    enforceVendetta
    && activeVendettas(state).length
    && vendettaCaptureDests(state).size
    && !vendettaVictim(state, fromName, toName)
  ) return reject(state, 'ILLEGAL_MOVE', 'Vendetta requires an available capture.');
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
  const confabulation = confabulationForPiece(state, moving.id);
  if (confabulation) {
    const occupant = state.pieces.find(piece => piece.zone === 'board' && piece.square === toName);
    const enPassantCaptureResult = enPassantCapture(state, fromName, toName);
    const target = occupant ?? enPassantCaptureResult?.victim;
    if (promotion !== undefined) return reject(state, 'ILLEGAL_MOVE', 'Confabulated pieces cannot promote.');
    if (target?.royal) return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
    if (
      target
      && !moving.neutral
      && !target.neutral
      && target.owner === moving.owner
    ) return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
    if (target && (captureForbidden(state, moving) || captureImmune(state, target))) {
      return reject(state, 'ILLEGAL_MOVE', 'That piece cannot capture or be captured.');
    }
    if (
      !enPassantCaptureResult
      && !physicalPieces(state, moving).some(component =>
        componentCanMove(state, moving, component, toName, false),
      )
    ) return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');

    const next = structuredClone(state);
    next.pieces.find(piece => piece.id === moving.id)!.square = toName;
    const capturedIds = target
      ? losePiece(next, next.pieces.find(piece => piece.id === target.id)!, 'captured')
      : [];
    const movedComponents = physicalPieces(state, moving);
    const capturedComponents = target ? physicalPieces(state, target) : [];
    const enPassant = occupant ? [] : movedComponents.flatMap(component =>
      component.originalRole === 'pawn' && !component.promoted
        ? doubleStepEnPassant(state, component, fromName, toName)
        : [],
    );
    completeReplacementMove(
      next,
      state.turn.color,
      hasUnpromotedPawn(state, moving) || Boolean(target),
      enPassant,
      [...movedComponents, ...capturedComponents],
    );
    next.history.push({
      type: 'move',
      from: fromName,
      to: toName,
      ...(target ? { capturedId: target.id } : {}),
      ...(capturedIds.length > 1 ? { capturedIds } : {}),
    });
    return finishRegularMove(state, next, movedComponents, allowAfterMoveRescue);
  }
  if (forbiddenCityBlocksMove(state, fromName, toName, moving.role === 'knight')) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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

  if (hasCrabEffect(state, moving.id)) {
    if (target && target.owner === moving.owner && !moving.neutral && !target.neutral) {
      return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
    }
    if (target && (captureForbidden(state, moving) || captureImmune(state, target))) {
      return reject(state, 'ILLEGAL_MOVE', 'That piece cannot capture or be captured.');
    }
    const [forwardFile, forwardRank] = pawnForward(state, moving.owner);
    const fileDelta = squareFile(to) - squareFile(from);
    const rankDelta = squareRank(to) - squareRank(from);
    const diagonal = Math.abs(fileDelta) + Math.abs(rankDelta) === 2
      && fileDelta * forwardFile + rankDelta * forwardRank === 1;
    if (!diagonal || Boolean(promotion) !== isPromotionSquare(state, moving.owner, toName)) {
      return reject(state, 'ILLEGAL_MOVE', 'That is not a legal Crab move.');
    }

    const next = structuredClone(state);
    const moved = next.pieces.find(piece => piece.id === moving.id)!;
    moved.square = toName;
    if (promotion) {
      moved.role = promotion;
      moved.promoted = true;
    }
    if (target) {
      losePiece(next, next.pieces.find(piece => piece.id === target.id)!, 'captured');
    }
    completeReplacementMove(next, state.turn.color, true, [], [moving, ...(target ? [target] : [])]);
    next.history.push({
      type: 'move',
      from: fromName,
      to: toName,
      ...(promotion ? { promotion } : {}),
      ...(target ? { capturedId: target.id } : {}),
    });
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue);
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
      ...(recordsBogRollback(state, moving, fromName, toName, promotion) ? { previousFen: state.fen } : {}),
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
  if (
    castle
    && rookFrom !== undefined
    && forbiddenCityBlocksMove(
      state,
      makeSquare(rookFrom),
      makeSquare(rookCastlesTo(state.turn.color, castle)),
    )
  ) return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
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
      losePiece(next, next.pieces.find(piece => piece.id === target.id)!, 'captured');
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
      ...(recordsBogRollback(state, moving, fromName, toName, promotion) ? { previousFen: state.fen } : {}),
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
      losePiece(next, next.pieces.find(piece => piece.id === target.id)!, 'captured');
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
      ...(recordsBogRollback(state, moving, fromName, toName) ? { previousFen: state.fen } : {}),
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
    losePiece(next, next.pieces.find(piece => piece.id === captured.id)!, 'captured');
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
    ...(recordsBogRollback(
      state,
      moving,
      fromName,
      makeSquare(castle ? kingCastlesTo(state.turn.color, castle) : to),
      promotion,
    ) ? { previousFen: state.fen } : {}),
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
  const played = result.state.playedCards?.at(-1);
  if (played) result.state.cardResponse = { player: played.player, historyLength: result.state.history.length };
  if (event.type === 'cardPlayed' && (event.cardId === 'forbidden-city' || event.cardId === 'confabulation')) {
    return result;
  }
  if (event.type === 'cardPlayed' && event.cardId === 'toll' && event.preservePreviousMove === false) {
    event.movement = [];
    return result;
  }

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

function withoutTruce(state: GameState): GameState {
  const effects = state.effects.filter(effect => effectKind(effect) !== 'truce');
  return effects.length === state.effects.length ? state : { ...state, effects };
}

function expireTruce(state: GameState, stalemate = false): GameState {
  const unprotected = withoutTruce(state);
  if (unprotected === state || (!stalemate
    && !isKingInCheck(unprotected, 'white') && !isKingInCheck(unprotected, 'black'))) return state;
  const resolved = structuredClone(unprotected);
  for (const effect of state.effects) {
    if (effectKind(effect) !== 'truce' || !isRetainedContinuingEffect(effect)) continue;
    if (!resolved.players[effect.owner].discard.some(card => card.id === effect.card.id)) {
      resolved.players[effect.owner].discard.push(structuredClone(effect.card));
    }
  }
  if (stalemate) {
    const setup = setupFor(resolved);
    setup.halfmoves = 0;
    resolved.fen = makeFen(setup);
  }
  return resolved;
}

function expirePieceEffects(result: ApplyResult): ApplyResult {
  if (!result.ok) return result;
  result.state = expireTruce(result.state);
  result.state = expireVendettaIfBlocked(result.state);
  const expired = result.state.effects.filter((effect): effect is PacifismEffect | CrabEffect => {
    const record = effectRecord(effect);
    const card = effectRecord(record?.card);
    const kind = effectKind(effect);
    if (
      (kind !== 'pacifism' && kind !== 'crab')
      || typeof record?.pieceId !== 'string'
      || (record.owner !== 'white' && record.owner !== 'black')
      || card?.cardId !== kind
      || typeof card.id !== 'string'
    ) return false;
    const piece = result.state.pieces.find(candidate => candidate.id === record.pieceId);
    const compositeOnBoard = piece
      ? physicalPieces(result.state, piece).some(component => component.zone === 'board' && component.square)
      : false;
    return !piece || !compositeOnBoard || (kind === 'crab' && piece.promoted);
  });
  if (!expired.length) return result;
  const cardIds = new Set(expired.map(effect => effect.card.id));
  result.state.effects = result.state.effects.filter(effect => {
    const card = effectRecord(effectRecord(effect)?.card);
    return typeof card?.id !== 'string' || !cardIds.has(card.id);
  });
  for (const effect of expired) {
    if (!result.state.players[effect.owner].discard.some(card => card.id === effect.card.id)) {
      result.state.players[effect.owner].discard.push(effect.card);
    }
  }
  result.state = expireTruce(result.state);
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
        losePiece(resolved, resolved.pieces.find(candidate => candidate.id === piece.id)!, 'captured');
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

function advanceTurn(state: GameState): ApplyResult {
  let next = structuredClone(state);
  delete next.cardResponse;
  const nextColor = opposite(state.turn.color);
  next.turn = {
    color: nextColor,
    phase: 'beforeMove',
    moveMade: false,
    cardPlays: { white: 0, black: 0 },
  };
  next.pendingRescue = null;
  next.pendingDoomsayer = null;
  delete next.turnCheckpoint;
  next = expireVendettaIfBlocked(next);
  next = expireTruce(next);
  if (withoutTruce(next) !== next && isOrdinaryStalemate(next, nextColor) && !hasTurnEscape(next)) {
    next = expireTruce(next, true);
  }
  const canEscape = hasTurnEscape(next);
  if (isOrdinaryCheckmate(next, nextColor) && !canEscape) {
    next.outcome = { winner: state.turn.color, reason: 'checkmate' };
  } else if (isOrdinaryStalemate(next, nextColor) && !canEscape) {
    next.outcome = { reason: 'stalemate' };
  }
  return { ok: true, state: next };
}

function endTurn(state: GameState): ApplyResult {
  if (!state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Make the regular move before ending the turn.');
  if (state.pendingDoomsayer) {
    return reject(state, 'INVALID_TIMING', 'The opponent must name a piece or decline Doomsayer before the turn can end.');
  }
  const tollResponse = state.history.at(-1)?.cardId === 'toll'
    && state.history.at(-1)?.player === opposite(state.turn.color);
  if (!tollResponse && isKingInCheck(state, state.turn.color)) {
    return reject(state, 'KING_IN_CHECK', 'Your King is still in check.');
  }
  return advanceTurn(state);
}

function panicTimeout(state: GameState): ApplyResult {
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Panic can expire only before the timed move.');
  }
  const pending = state.effects.filter(effect =>
    isPanicEffect(effect) && effect.player === state.turn.color
  );
  if (!pending.length) return reject(state, 'INVALID_TIMING', 'There is no Panic timer for this player.');

  const resolved = structuredClone(state);
  resolved.effects = resolved.effects.filter(effect =>
    !isPanicEffect(effect) || effect.player !== state.turn.color
  );
  return advanceTurn(resolved);
}

function rememberTurnStart(before: GameState, result: ApplyResult): ApplyResult {
  if (
    result.ok
    && !before.turnCheckpoint
    && before.turn.phase === 'beforeMove'
    && !before.turn.moveMade
    && before.players[opposite(before.turn.color)].hand.some(card => card.cardId === 'toll')
  ) {
    const checkpoint = structuredClone(before);
    delete checkpoint.turnCheckpoint;
    result.state.turnCheckpoint = checkpoint;
  }
  return result;
}

export function applyAction(state: GameState, action: GameAction | null | undefined): ApplyResult {
  if (state.outcome) return reject(state, 'GAME_OVER', 'The game is already over.');
  if (!action) return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
  if (action.type === 'panicTimeout') {
    if (Object.getPrototypeOf(action) !== Object.prototype || Reflect.ownKeys(action).length !== 1) {
      return reject(state, 'INVALID_TARGET', 'panicTimeout does not take a payload.');
    }
    return expirePieceEffects(panicTimeout(state));
  }
  state = expireVendettaIfBlocked(state);
  if (action.type === 'move') return expirePieceEffects(clearCompletedPanic(state, rememberTurnStart(state, movePiece(state, action))));
  if (action.type === 'namePiece') return expirePieceEffects(clearCompletedPanic(state, rememberTurnStart(state, namePiece(state, action))));
  if ((['pronouncePiece', 'pieceName', 'pronouncePieceName', 'pieceNamed'] as unknown[]).includes(action.type)) {
    return reject(state, 'INVALID_TARGET', 'Use the canonical namePiece action.');
  }
  if (action.type === 'declineDoomsayer') {
    return expirePieceEffects(clearCompletedPanic(state, rememberTurnStart(state, declineDoomsayer(state, action))));
  }
  if (action.type === 'endTurn') return expirePieceEffects(endTurn(state));
  if (action.type !== 'playCard') return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
  return expirePieceEffects(clearCompletedPanic(state, rememberTurnStart(state, recordCardTransition(state, settlePendingRescue(
    state,
    playCard(state, action.cardId, action.target, action.cardInstanceId),
    action.cardId,
  )))));
}
