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
  ChallengeEffect,
  Color,
  ConfabulationEffect,
  CoupEffect,
  CrabEffect,
  CurseEffect,
  DoomsayerEffect,
  DoomsayerRole,
  DungeonEffect,
  EarthquakeDirection,
  EarthquakeTarget,
  EnPassantOpportunity,
  EvangelistsTarget,
  FatalAttractionEffect,
  ForbiddenCityEffect,
  FortificationEffect,
  GameAction,
  GameErrorCode,
  GameEffect,
  GameState,
  HolyWarTarget,
  ManTrapEffect,
  ManOfStrawTarget,
  PanicEffect,
  PacifismEffect,
  PieceState,
  PromotionDeclaration,
  PeaceTalksTarget,
  RetainedEffect,
  Role,
  SanctuaryTarget,
  SiegeTarget,
  SplitKnightTarget,
  SquareName,
  VendettaEffect,
} from './types.js';

const SQUARE = /^[a-h][1-8]$/;
const CORNERS: readonly SquareName[] = ['a1', 'a8', 'h1', 'h8'];
const CENTRAL_SQUARES: readonly SquareName[] = ['d4', 'e4', 'd5', 'e5'];
const FIGURE_DANCE_CORNERS = [
  ['a1', 'h1'],
  ['h1', 'h8'],
  ['h8', 'a8'],
  ['a8', 'a1'],
] as const;
const PROMOTIONS = new Set<Role>(['queen', 'rook', 'bishop', 'knight']);
const DOOMSAYER_ROLES = new Set<DoomsayerRole>(['pawn', 'knight', 'bishop', 'rook', 'queen', 'crab', 'prince']);

function chaosMovement(before: GameState, after: GameState, withPromotion = false): string {
  return before.pieces.flatMap(piece => {
    const moved = after.pieces.find(candidate => candidate.id === piece.id);
    // FAQ p.50 compares board state: an actual on-board promotion changes it.
    const promotion = withPromotion && moved?.zone === 'board' && moved.promoted && !piece.promoted ? `=${moved.role}` : '';
    return moved && (piece.square !== moved.square || piece.zone !== moved.zone)
      ? [`${piece.id}:${piece.square ?? piece.zone}:${moved.square ?? moved.zone}${promotion}`] : [];
  }).sort().join('|');
}

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

function effectCardMatches(card: Record<string, unknown> | undefined, kind: string): boolean {
  return card?.cardId === kind || card?.cardId === 'haunting-memories';
}

function discardEffectCard(state: GameState, effect: { owner: Color; card: CardInstance }): void {
  if (!effect.card.proxy && !state.players[effect.owner].discard.some(card => card.id === effect.card.id)) {
    state.players[effect.owner].discard.push(structuredClone(effect.card));
  }
}

export function isDoomsayerEffect(effect: unknown): effect is DoomsayerEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return effectKind(effect) === 'doomsayer'
    && effectCardMatches(card, 'doomsayer')
    && typeof card?.id === 'string'
    && (record?.owner === 'white' || record?.owner === 'black');
}

export function activeDoomsayers(state: GameState): DoomsayerEffect[] {
  return state.effects.filter(isDoomsayerEffect);
}

function isVendettaEffect(effect: unknown): effect is VendettaEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return effectKind(effect) === 'vendetta'
    && effectCardMatches(card, 'vendetta')
    && typeof card?.id === 'string'
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

function isChallengeEffect(effect: unknown): effect is ChallengeEffect {
  const record = effectRecord(effect);
  return record?.type === 'challenge'
    && (record.owner === 'white' || record.owner === 'black')
    && record.player === opposite(record.owner)
    && typeof record.pieceId === 'string';
}

function challengesFor(state: GameState, player = state.turn.color): ChallengeEffect[] {
  return state.effects.filter((effect): effect is ChallengeEffect =>
    isChallengeEffect(effect) && effect.player === player,
  );
}

function isDungeonEffect(effect: unknown): effect is DungeonEffect {
  const record = effectRecord(effect);
  return record?.type === 'dungeon'
    && (record.owner === 'white' || record.owner === 'black')
    && record.player === opposite(record.owner)
    && typeof record.pieceId === 'string';
}

function fatalAttractionAllowsMove(state: GameState, piece: PieceState): boolean {
  return hasRole(state, piece, 'king') || !state.effects.some(effect => {
    if (!isFatalAttractionEffect(effect) || effect.active === false || effect.suspended === true) return false;
    const magnet = boardCarrier(state, effect.pieceId);
    return magnet && adjacentSquares(magnet.square, boardCarrier(state, piece.id)?.square);
  });
}

function dungeonAllowsMove(state: GameState, piece: PieceState, player = state.turn.color, byCard = false): boolean {
  if (!fatalAttractionAllowsMove(state, piece)) return false;
  if (state.underElfHill?.some(entry => entry.returned
    && physicalPieces(state, piece).some(component => component.id === entry.pieceId))) return false;
  // A later card overrides regular Dungeon only for the movement it authorizes.
  return byCard || !state.effects.some(effect => isDungeonEffect(effect) && effect.player === player
    && physicalPieces(state, piece).some(component => component.id === effect.pieceId));
}

function clearChallenge(state: GameState, player: Color): void {
  state.effects = state.effects.filter(effect => !isChallengeEffect(effect) || effect.player !== player);
}

function challengeAllows(state: GameState, pieces: readonly PieceState[], player = state.turn.color): boolean {
  return challengesFor(state, player).every(effect => pieces.some(piece =>
    physicalPieces(state, piece).some(component => component.id === effect.pieceId),
  ));
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
    && effectCardMatches(card, 'confabulation')
    && typeof card?.id === 'string'
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
    role === 'king' ? component.royal
      : component.role === role || (!component.promoted && component.originalRole === role),
  );
}

function refreshNeutrality(state: GameState): void {
  for (const piece of state.pieces) {
    if (piece.neutralBeforeEffects === undefined) continue;
    piece.neutral = piece.neutralBeforeEffects;
    delete piece.neutralBeforeEffects;
  }
  const mark = (piece: PieceState) => {
    piece.neutralBeforeEffects ??= piece.neutral;
    piece.neutral = !physicalPieces(state, piece).some(component => component.royal || component.role === 'king'
      || component.role === 'queen' || (!component.promoted && ['king', 'queen'].includes(component.originalRole)));
  };
  for (const effect of state.effects) {
    if (!isRetainedContinuingEffect(effect) || effect.type !== 'neutrality') continue;
    const piece = state.pieces.find(candidate => candidate.id === effect.pieceId);
    if (piece) mark(piece);
  }
  for (const effect of state.effects) {
    if (!isConfabulationEffect(effect)) continue;
    const components = effect.pieceIds.flatMap(id => state.pieces.find(piece => piece.id === id) ?? []);
    const carrier = components.find(piece => piece.zone === 'board' && piece.square);
    if (carrier && components.some(piece => piece.neutral)) mark(carrier);
  }
}

function hasUnpromotedPawn(state: GameState, piece: PieceState): boolean {
  return physicalPieces(state, piece).some(component =>
    component.originalRole === 'pawn' && !component.promoted,
  );
}

function currentPly(state: GameState): number {
  const setup = parseFen(state.fen).unwrap();
  return (setup.fullmoves - 1) * 2 + (setup.turn === 'black' ? 1 : 0) - (state.turn.moveMade ? 1 : 0);
}

function recentlyCaptured(state: GameState, piece: PieceState): boolean {
  if (piece.capturedAtPly !== undefined) return currentPly(state) - piece.capturedAtPly <= 1;
  const captureIndex = state.history.reduce((last, event, index) =>
    event.capturedId === piece.id || event.capturedIds?.includes(piece.id) ? index : last, -1);
  return captureIndex >= 0 && !state.history.slice(captureIndex + 1).some(event => event.type === 'move');
}

function losePiece(state: GameState, piece: PieceState, zone: 'captured' | 'dead', captor = state.turn.color): string[] {
  const effect = confabulationForPiece(state, piece.id);
  const ids = effect?.pieceIds ?? [piece.id];
  for (const id of ids) {
    const component = state.pieces.find(candidate => candidate.id === id);
    if (component) {
      if (effect && !component.promoted) component.role = component.originalRole;
      if (zone === 'captured' && !component.promoted
        && (state.effects.some(candidate => isCrabEffect(candidate) && candidate.pieceId === component.id)
          || (component.role !== component.originalRole
            && Object.values(state.players).some(player => [...player.hand, ...player.deck, ...player.discard]
              .some(card => card.cardId === 'resurrection' || card.cardId === 'hostage'
                || (component.originalRole === 'pawn' && (card.cardId === 'winged-victory' || card.cardId === 'betrayal'))))))) {
        component.capturedAtPly = currentPly(state);
      }
      component.square = null;
      component.zone = zone;
      if (zone === 'captured') component.capturedBy = captor;
      else delete component.capturedBy;
    }
  }
  if (effect) {
    state.effects = state.effects.filter(candidate => candidate !== effect);
    discardEffectCard(state, effect);
  }
  state.effects = state.effects.filter(candidate => {
    if (!isRetainedContinuingEffect(candidate) || candidate.type !== 'neutrality'
      || typeof candidate.pieceId !== 'string' || !ids.includes(candidate.pieceId)) return true;
    discardEffectCard(state, candidate);
    return false;
  });
  refreshNeutrality(state);
  return [...ids];
}

function springManTraps(before: GameState, next: GameState): void {
  expireFatalAttractions(before, next);
  const effects = next.effects;
  const moved = next.pieces.filter(piece => piece.zone === 'board' && piece.square
    && physicalPieces(next, piece).some(component => {
      const previous = boardCarrier(before, component.id);
      return previous?.square && previous.square !== piece.square;
    }));
  const sprung = next.effects.flatMap((effect, index) => {
    if (!isRetainedContinuingEffect(effect) || effect.type !== 'man-trap'
      || effect.active === false || effect.suspended === true) return [];
    const piece = moved.find(candidate => candidate.square === effect.square
      && (candidate.owner !== effect.owner || candidate.neutral));
    return piece ? [{ effect, index, piece }] : [];
  });
  const lost: PieceState[] = [];
  for (const { effect, index, piece } of sprung) {
    // FAQ 40/46: Kings and Pacifists never set off a trap, regardless of play order.
    if (physicalPieces(next, piece).some(component => component.royal)
      || captureForbidden({ ...next, effects: effects.filter(candidate => effectKind(candidate) !== 'truce') }, piece)) continue;
    if (piece.zone === 'board'
      && !captureImmune({ ...next, effects: effects.filter((candidate, candidateIndex) =>
        candidateIndex > index || !['truce', 'pacifism', 'mysticshield'].includes(effectKind(candidate) ?? '')) }, piece)) {
      lost.push(...physicalPieces(next, piece));
      losePiece(next, piece, 'captured', effect.owner);
    }
    next.effects = next.effects.filter(candidate => candidate !== effect);
    discardEffectCard(next, effect);
  }
  if (lost.length) {
    syncFen(next, lost);
    const setup = setupFor(next);
    setup.halfmoves = 0;
    next.fen = makeFen(setup);
  }
}

function isFatalAttractionEffect(effect: GameEffect): effect is FatalAttractionEffect {
  return isRetainedContinuingEffect(effect) && effect.type === 'fatal-attraction'
    && typeof effect.pieceId === 'string';
}

function expireFatalAttractions(before: GameState, next: GameState): void {
  const effects = next.effects.filter(effect => {
    if (!isFatalAttractionEffect(effect)) return true;
    const previous = boardCarrier(before, effect.pieceId);
    const current = boardCarrier(next, effect.pieceId);
    const piece = next.pieces.find(candidate => candidate.id === effect.pieceId);
    if (piece && piece.zone !== 'dead' && piece.zone !== 'captured'
      && !(previous?.square && current?.square && previous.square !== current.square)) return true;
    discardEffectCard(next, effect);
    return false;
  });
  if (effects.length !== next.effects.length) next.effects = effects;
}

function resolveFatalAttractionSwap(before: GameState, next: GameState): boolean {
  // FAQ p.40: swaps count as movement. Check every participant before releasing any magnet.
  if (before.pieces.some(piece => {
    const after = boardCarrier(next, piece.id);
    return piece.zone === 'board' && piece.square && after?.square && piece.square !== after.square
      && !fatalAttractionAllowsMove(before, piece);
  })) return false;
  expireFatalAttractions(before, next);
  return true;
}

function isCrabEffect(effect: unknown): effect is CrabEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return effectKind(effect) === 'crab'
    && effectCardMatches(card, 'crab')
    && typeof card?.id === 'string'
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

function componentHasCrabMovement(state: GameState, pieceId: string): boolean {
  if (!componentHasCrabEffect(state, pieceId)) return false;
  const ids = confabulationForPiece(state, pieceId)?.pieceIds ?? [pieceId];
  // Apply FAQ p.20's Paladin -> Coup movement ruling to Crab under the
  // later-Continuing-Effect rule. Keep the physical Crab for cancellation.
  for (let index = state.effects.length - 1; index >= 0; index -= 1) {
    const effect = state.effects[index];
    const record = effectRecord(effect);
    if (record?.active === false || record?.suspended === true) continue;
    if (isCrabEffect(effect) && effect.pieceId === pieceId) return true;
    if (isRetainedContinuingEffect(effect) && effect.type === 'coup'
      && typeof effect.kingId === 'string' && ids.includes(effect.kingId)) return false;
  }
  return false;
}

function curseAllowsMove(state: GameState, piece: PieceState, from: SquareName, to: SquareName): boolean {
  const source = parseSquare(from);
  const destination = parseSquare(to);
  if (Math.max(Math.abs(squareFile(destination) - squareFile(source)), Math.abs(squareRank(destination) - squareRank(source))) <= 2) return true;
  const components = physicalPieces(state, piece);
  return !state.effects.some(effect => {
    const record = effectRecord(effect);
    return effectKind(effect) === 'curse' && record?.active !== false && record?.suspended !== true
      && components.some(candidate => candidate.id === record?.pieceId);
  });
}

function isForbiddenCityEffect(effect: unknown): effect is ForbiddenCityEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return record?.type === 'forbidden-city'
    && effectCardMatches(card, 'forbidden-city')
    && typeof card?.id === 'string'
    && (record.owner === 'white' || record.owner === 'black')
    && typeof record.square === 'string'
    && SQUARE.test(record.square);
}

function forbiddenCitySquares(state: GameState): Set<SquareName> {
  return new Set(state.effects.filter(isForbiddenCityEffect).map(effect => effect.square));
}

function adjacentSquares(from: unknown, to: unknown): boolean {
  if (typeof from !== 'string' || typeof to !== 'string' || !SQUARE.test(from) || !SQUARE.test(to)) return false;
  const source = parseSquare(from as SquareName);
  const destination = parseSquare(to as SquareName);
  return Math.max(Math.abs(squareFile(destination) - squareFile(source)), Math.abs(squareRank(destination) - squareRank(source))) === 1;
}

function isFortificationEffect(effect: unknown): effect is FortificationEffect {
  const record = effectRecord(effect);
  const card = effectRecord(record?.card);
  return record?.type === 'fortification'
    && effectCardMatches(card, 'fortification')
    && typeof card?.id === 'string'
    && (record.owner === 'white' || record.owner === 'black')
    && adjacentSquares(record.from, record.to);
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
  const walls = state.effects.filter(isFortificationEffect);
  let previous = from;
  for (
    let file = squareFile(source) + fileStep, rank = squareRank(source) + rankStep;
    previous !== to;
    file += fileStep, rank += rankStep
  ) {
    const square = makeSquare(rank * 8 + file);
    if (blocked.has(square) || walls.some(wall =>
      (wall.from === previous && wall.to === square) || (wall.to === previous && wall.from === square)
    )) return true;
    previous = square;
  }
  return false;
}

function targetMatchesPiece(target: unknown, piece: PieceState): boolean {
  return target === piece.id || target === piece.square;
}

function captureForbidden(state: GameState, piece: PieceState): boolean {
  const components = physicalPieces(state, piece);
  const royal = components.some(component => component.royal);
  if (!royal && components.some(component => (component as unknown as Record<string, unknown>).pacifist === true)) {
    return true;
  }
  return components.some(component => state.effects.some(effect => {
    const record = effectRecord(effect);
    if (!record || record.active === false || record.suspended === true) return false;
    const kind = effectKind(effect);
    if (kind === 'truce') return true;
    if (kind !== 'pacifism' || royal) return false;
    const targets = record.pieceIds;
    return targetMatchesPiece(record.pieceId ?? record.targetId ?? record.target, component)
      || (Array.isArray(targets) && targets.some(target => targetMatchesPiece(target, component)));
  }));
}

function captureImmune(state: GameState, piece: PieceState, captor = state.turn.color, prospectiveTurn = false): boolean {
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
    if (typeof record.player === 'string'
      && ((!prospectiveTurn && record.player === state.turn.color) || record.player === captor)) return false;
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
    (piece.owner === player || piece.neutral)
    && piece.zone === 'board'
    && piece.square
    && !hasRole(state, piece, 'king')
    && (role === 'crab' ? hasCrabEffect(state, piece.id)
      : role === 'prince' ? physicalPieces(state, piece).some(component => component.role === 'king' && !component.royal)
        : hasRole(state, piece, role))
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
  allowAfterMoveRescue: boolean | 'defer' = true,
  enforceVendetta = true,
  stopAfterFirst = false,
  capturesOnly = false,
): Map<SquareName, SquareName[]> {
  if (state.turn.moveMade || state.outcome || pendingElfReturn(state)) return new Map();
  if (enforceVendetta && activeVendettas(state).length) {
    const captures = vendettaCaptureDests(state, stopAfterFirst);
    if (captures.size) return captures;
  }
  const position = positionFor(state);
  const dests = chessgroundDests(position);
  const knownRescues: Extract<GameAction, { type: 'playCard' }>[] = [];
  const rescueSearch: typeof hasAfterMoveRescue = (next, movedPieces) =>
    hasAfterMoveRescue(next, movedPieces, knownRescues);
  const checkedMoves = new Map<string, boolean>();
  const moveIsLegal = (piece: PieceState, to: SquareName): boolean => {
    const key = `${piece.square}-${to}`;
    const checked = checkedMoves.get(key);
    if (checked !== undefined) return checked;
    if (capturesOnly && !vendettaVictim(state, piece.square!, to)) return false;
    const promotions: Array<Role | undefined> = !confabulationForPiece(state, piece.id)
      && (piece.role === 'pawn' || hasCrabEffect(state, piece.id))
      && isPromotionSquare(state, piece.owner, to)
      ? [...PROMOTIONS]
      : [undefined];
    const legal = promotions.some(promotion => movePiece(
      state,
      { type: 'move', from: piece.square!, to, ...(promotion ? { promotion } : {}) },
      allowAfterMoveRescue,
      false,
      false,
      rescueSearch,
    ).ok) || (!capturesOnly
      && Boolean(enPassantCapture(state, piece.square!, to))
      && movePiece(state, { type: 'move', from: piece.square!, to, enPassant: false },
        allowAfterMoveRescue, false, false, rescueSearch).ok);
    checkedMoves.set(key, legal);
    return legal;
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
      if (stopAfterFirst) return new Map([[piece.square, [opportunity.target]]]);
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
      if (moveIsLegal(piece, to)) {
        if (stopAfterFirst) return new Map([[piece.square, [to]]]);
        targets.add(to);
      }
    }
    if (piece.royal && piece.originalRole === 'king') {
      for (const side of ['a', 'h'] as const) {
        const rook = position.castles.rook[state.turn.color][side];
        for (const square of [kingCastlesTo(state.turn.color, side), rook]) {
          if (square === undefined) continue;
          const to = makeSquare(square);
          if (moveIsLegal(piece, to)) {
            if (stopAfterFirst) return new Map([[piece.square, [to]]]);
            targets.add(to);
          }
        }
      }
    }
    for (const target of state.pieces) {
      if (
        !target.neutral
        || target.owner !== piece.owner
        || target.zone !== 'board'
        || !target.square
        || !pieceAttacksSquare(state, piece, target.square, position.board.occupied, state.turn.color)
      ) continue;
      if (moveIsLegal(piece, target.square)) {
        if (stopAfterFirst) return new Map([[piece.square, [target.square]]]);
        targets.add(target.square);
      }
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
      if (moveIsLegal(piece, to)) {
        if (stopAfterFirst) return new Map([[piece.square, [to]]]);
        targets.add(to);
      }
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

function vendettaVictim(
  state: GameState,
  from: SquareName,
  to: SquareName,
  allowEnPassant = true,
): PieceState | undefined {
  return state.pieces.find(piece =>
    piece.zone === 'board'
    && piece.square === to
    && piece.owner === opposite(state.turn.color),
  ) ?? (() => {
    const capture = allowEnPassant ? enPassantCapture(state, from, to) : undefined;
    return capture?.victim.owner === opposite(state.turn.color) ? capture.victim : undefined;
  })();
}

function vendettaCaptureDests(state: GameState, stopAfterFirst = false): Map<SquareName, SquareName[]> {
  return legalDests(state, false, false, stopAfterFirst, true);
}

function expireVendettaIfBlocked(state: GameState): GameState {
  const active = activeVendettas(state);
  if (
    state.turn.phase !== 'beforeMove'
    || pendingElfReturn(state)
    || !active.length
    || vendettaCaptureDests(state, true).size
  ) return state;

  const next = structuredClone(state);
  const ids = new Set(active.map(effect => effect.card.id));
  next.effects = next.effects.filter(effect =>
    !isVendettaEffect(effect) || !ids.has(effect.card.id),
  );
  for (const effect of active) {
    discardEffectCard(next, effect);
  }
  return next;
}

function turnView(state: GameState, color: Color): GameState {
  const view = { ...state };
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
  return legalDests(turnView(state, color), false, true, true).size > 0;
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
    || !dungeonAllowsMove(state, pawn, state.turn.color, true)
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
    || captureForbidden(state, pawn)
  ) return [];

  const source = parseSquare(from);
  const vendettaRequired = activeVendettas(state).length > 0 && vendettaCaptureDests(state, true).size > 0;
  return [...new Set(physicalPieces(state, pawn).flatMap(component => {
    if (component.originalRole !== 'pawn' || component.promoted || componentHasCrabMovement(state, component.id)) return [];
    const [forwardFile, forwardRank] = pawnForward(state, component.owner);
    return [[forwardRank, -forwardFile], [-forwardRank, forwardFile]].flatMap(([sideFile, sideRank]) => {
      const file = squareFile(source) - forwardFile + sideFile;
      const rank = squareRank(source) - forwardRank + sideRank;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) return [];
      const to = makeSquare(rank * 8 + file);
      const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === to);
      return victim
        && (pawn.neutral || victim.neutral || victim.owner !== pawn.owner)
        && (!vendettaRequired || victim.owner === opposite(state.turn.color))
        && !hasRole(state, victim, 'king')
        && !captureImmune(state, victim)
        ? [to]
        : [];
    });
  }))].sort((left, right) => parseSquare(left) - parseSquare(right));
}

export function breakthroughDests(state: GameState, from: SquareName): SquareName[] {
  const carrier = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (!carrier || (carrier.owner !== state.turn.color && !carrier.neutral)
    || captureForbidden(state, carrier)) return [];
  const source = parseSquare(from);
  const occupied = setupFor(state).board.occupied;
  const required = activeVendettas(state).length > 0 && vendettaCaptureDests(state, true).size > 0;
  return [...new Set(physicalPieces(state, carrier).flatMap(pawn => {
    if (pawn.originalRole !== 'pawn' || pawn.promoted || componentHasCrabMovement(state, pawn.id)) return [];
    const [forwardFile, forwardRank] = pawnForward(state, pawn.owner);
    const forwardX = squareFile(source) + forwardFile;
    const forwardY = squareRank(source) + forwardRank;
    if (forwardX < 0 || forwardX > 7 || forwardY < 0 || forwardY > 7) return [];
    const forward = forwardY * 8 + forwardX;
    const capturesForward = physicalPieces(state, carrier).some(component =>
      component.role !== 'pawn'
      && attacks({ color: component.owner, role: component.role }, source, occupied).has(forward),
    );
    const offsets = capturesForward ? [[1, -1], [1, 1]]
      : onStartingSquare(state, pawn.owner, from) && !occupied.has(forward) ? [[1, 0], [2, 0]] : [[1, 0]];
    return offsets.flatMap(([distance, side]) => {
      const file = squareFile(source) + distance * forwardFile + side * forwardRank;
      const rank = squareRank(source) + distance * forwardRank - side * forwardFile;
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

function startingSquares(state: GameState, owner: Color, role: Role): SquareName[] {
  const rank = role === 'pawn' ? owner === 'white' ? 1 : 6 : owner === 'white' ? 0 : 7;
  return REBIRTH_FILES[role].map(file => makeSquare(state.orientation === 0
    ? rank * 8 + file
    : state.orientation === 90
      ? (7 - file) * 8 + rank
      : state.orientation === 180
        ? (7 - rank) * 8 + 7 - file
        : file * 8 + 7 - rank));
}

function rebirthDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  if (!piece || (!piece.neutral && piece.owner === state.turn.color)) return [];

  return [...new Set(physicalPieces(state, piece).flatMap(component => {
    return startingSquares(state, component.owner, component.promoted ? component.role : component.originalRole).flatMap(square => {
      if (square === from) return [];
      const occupant = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === square);
      return !occupant || (
        (occupant.owner === state.turn.color || occupant.neutral)
        && !hasRole(state, occupant, 'king')
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
  state: GameState,
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
      && !forbiddenCityBlocksMove(state, from, to, true)
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
      const options = madmanJumpOptions(state, occupied, from, used);
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
  return destinations.filter(to => curseAllowsMove(state, knight, from, to));
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
      component.role === 'pawn' || (!component.promoted && component.originalRole === 'pawn')
    )
  ) return [];

  const board = setupFor(state).board;
  return [...attacks({ color: piece.owner, role: 'queen' }, parseSquare(from), board.occupied).diff(board.occupied)]
    .map(makeSquare)
    .filter(to => !forbiddenCityBlocksMove(state, from, to) && curseAllowsMove(state, piece, from, to));
}

export function blessingDests(state: GameState, from: SquareName): SquareName[] {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from);
  if (!piece || (piece.owner !== state.turn.color && !piece.neutral)) return [];
  const board = setupFor(state).board;
  return [...attacks({ color: piece.owner, role: 'bishop' }, parseSquare(from), board.occupied).diff(board.occupied)]
    .map(makeSquare)
    .filter(to => !forbiddenCityBlocksMove(state, from, to) && curseAllowsMove(state, piece, from, to));
}

function doppelgangerCopy(state: GameState): PieceState | undefined {
  if (state.plotsExecution) {
    const id = state.plotsExecution.window.doppelgangerPieceId;
    return id ? boardCarrier(state, id) : undefined;
  }
  let movement: CardMove[] | undefined;
  let ordinaryMove = false;
  let movedPieceId: string | undefined;
  let player: Color | undefined;
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const event = state.history[index];
    const candidate = event.type === 'move' && event.from && event.to
      ? [{ from: event.from, to: event.to }]
      : event.movement;
    if (candidate?.length) {
      const recorded = state.doppelgangerMove?.historyLength === index + 1 ? state.doppelgangerMove : undefined;
      player = recorded?.player ?? event.player;
      if (player && player !== opposite(state.turn.color)) return undefined;
      movedPieceId = recorded?.pieceId ?? event.movedPieceId;
      movement = candidate;
      ordinaryMove = event.type === 'move';
      break;
    }
    if (
      (event.type === 'cardPlayed' || event.type === 'cardFizzled')
      && !event.preservePreviousMove
      && !(event.type === 'cardPlayed'
        && ['forbidden-city', 'fortification'].includes(event.copiedCardId ?? event.cardId ?? ''))
    ) return undefined;
  }
  if (movement?.length !== 1) return undefined;
  const copied = movedPieceId ? boardCarrier(state, movedPieceId) : state.pieces.find(candidate =>
    candidate.zone === 'board' && candidate.square === movement![0].to,
  );
  if (
    !copied
    || (!player && copied.owner !== opposite(state.turn.color))
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
  const copiedComponents = copied
    ? physicalPieces(state, copied)
    : [];
  if (
    !piece
    || (piece.owner !== state.turn.color && !piece.neutral)
    || physicalPieces(state, piece).every(component => component.role === 'pawn')
    || !copied
    || !copiedComponents.length
  ) return [];

  const board = setupFor(state).board;
  const source = parseSquare(from);
  return [...new Set(copiedComponents.flatMap(component => {
    const role = component.role;
    const crab = componentHasCrabMovement(state, component.id);
    const destinations: SquareName[] = [];
    if (crab) {
      const [fileStep, rankStep] = pawnForward(state, piece.owner);
      for (const side of [-1, 1]) {
        const file = squareFile(source) + fileStep + side * rankStep;
        const rank = squareRank(source) + rankStep + side * fileStep;
        if (file >= 0 && file <= 7 && rank >= 0 && rank <= 7 && !board.has(rank * 8 + file)) {
          destinations.push(makeSquare(rank * 8 + file));
        }
      }
    } else if (role === 'pawn') {
      const [fileStep, rankStep] = pawnForward(state, piece.owner);
      const maxDistance = onStartingSquare(state, piece.owner, from) ? 2 : 1;
      for (let distance = 1; distance <= maxDistance; distance += 1) {
        const file = squareFile(source) + fileStep * distance;
        const rank = squareRank(source) + rankStep * distance;
        if (file < 0 || file > 7 || rank < 0 || rank > 7 || board.has(rank * 8 + file)) break;
        destinations.push(makeSquare(rank * 8 + file));
      }
    } else {
      destinations.push(...[...attacks(
        { color: piece.owner, role }, source, board.occupied,
      ).diff(board.occupied)].map(makeSquare));
    }
    return destinations.filter(to => !forbiddenCityBlocksMove(state, from, to, role === 'knight' && !crab));
  }))].filter(to => curseAllowsMove(state, piece, from, to));
}

export function heresyDests(state: GameState, from: SquareName): SquareName[] {
  const bishop = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (!bishop || !hasRole(state, bishop, 'bishop') || !dungeonAllowsMove(state, bishop, state.turn.color, true)) return [];

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
  return emptyCorners.length === 1 ? emptyCorners.filter(to => curseAllowsMove(state, piece, from, to)) : [];
}

export function assassinDests(state: GameState, from: SquareName): SquareName[] {
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
  if (!mover || (mover.owner !== state.turn.color && !mover.neutral)) return [];

  const occupied = setupFor(state).board.occupied;
  return state.pieces.flatMap(victim =>
    victim.zone === 'board'
      && victim.square
      && !hasRole(state, victim, 'king')
      && (victim.owner === state.turn.color || victim.neutral)
      && pieceAttacksSquare(state, mover, victim.square, occupied, state.turn.color)
      ? [victim.square]
      : [],
  );
}

function revokeCastlingRights(
  setup: ReturnType<typeof setupFor>,
  movedPieces: readonly PieceState[],
): void {
  for (const piece of movedPieces) {
    if (piece.royal || piece.originalRole === 'king') {
      setup.castlingRights = setup.castlingRights.diff(SquareSet.backrank(piece.owner));
    } else if (piece.role === 'rook' || piece.originalRole === 'rook') {
      const origin = piece.id.slice(-2);
      const square = SQUARE.test(origin) ? origin as SquareName : piece.square;
      if (square) setup.castlingRights = setup.castlingRights.without(parseSquare(square));
    }
  }
}

function syncFen(state: GameState, movedPieces: readonly PieceState[] = []): void {
  refreshCoups(state);
  state.enPassant = state.enPassant.filter(opportunity => enPassantVictim(state, opportunity));
  const setup = setupFor(state);
  revokeCastlingRights(setup, movedPieces);
  state.fen = makeFen(setup);
}

function cardAllowanceUsed(state: GameState, player: Color): boolean {
  return Boolean(state.fogLocked?.includes(player))
    || state.turn.cardPlays[player] >= 1 && state.plotsExecution?.player !== player;
}

function cardPlayError(
  state: GameState,
  cardId: string,
  cardInstanceId?: unknown,
  color = state.turn.color,
): ApplyResult | undefined {
  if ((cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[color].hand.some(card => card.cardId === cardId
      && (cardInstanceId === undefined || card.id === cardInstanceId))) {
    return reject(state, 'CARD_NOT_IN_HAND', `${CARD_CATALOG[cardId].name} is not in your hand.`);
  }
  if (cardAllowanceUsed(state, color)) {
    return reject(state, 'CARD_ALREADY_PLAYED', 'Only one card may be played per turn.');
  }
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
  const allowanceIndex = state.plotsExecution?.allowanceIndex;
  if (allowanceIndex !== undefined && state.plotsExecution?.player === color) {
    state.plotsAllowances![allowanceIndex].remaining -= 1;
    for (const allowance of state.plotsAllowances!) {
      allowance.eligibleCards = allowance.eligibleCards.filter(id => id !== spent.id);
    }
  }
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
    || !(['rook', 'bishop', 'queen'] as const).some(role => hasRole(state, piece, role))
  ) return false;
  const source = parseSquare(from);
  const destination = parseSquare(to);
  const fileDelta = squareFile(destination) - squareFile(source);
  const rankDelta = squareRank(destination) - squareRank(source);
  const distance = Math.max(Math.abs(fileDelta), Math.abs(rankDelta));
  return distance >= 2 && (
    fileDelta === 0 || rankDelta === 0 || Math.abs(fileDelta) === Math.abs(rankDelta)
  );
}

function reactionEvent(state: GameState): GameState['history'][number] | undefined {
  if (state.riposteSkipped === state.turn.color) return undefined;
  if (state.plotsExecution) return state.plotsExecution.window.reaction;
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

function hostageCaptureEvent(state: GameState): GameState['history'][number] | undefined {
  const event = state.plotsExecution ? state.plotsExecution.window.capture : state.history.at(-1);
  if (event?.type !== 'move' && event?.type !== 'cardPlayed') return undefined;
  if (!event.capturedId && !event.capturedIds?.length) return undefined;
  if (event.type === 'move' && (state.turn.phase !== 'afterMove' || !state.turn.moveMade)) return undefined;
  if (event.type === 'cardPlayed' && !state.plotsExecution
    && state.cardResponse?.historyLength !== state.history.length) return undefined;
  return event;
}

function playLegacy(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const reactor = (['white', 'black'] as const).find(player =>
    typeof target === 'string' && state.players[player].discard.some(card => card.id === target));
  if (!reactor) return reject(state, 'INVALID_TARGET', 'Choose a physical card in your discard pile.');
  const error = cardPlayError(state, 'legacy', cardInstanceId, reactor);
  if (error) return error;
  const capture = state.plotsExecution ? state.plotsExecution.window.legacyCapture : state.legacyCapture;
  if (!capture || (!state.plotsExecution && capture.historyLength !== state.history.length)
    || !state.pieces.some(piece => piece.owner === reactor && piece.zone === 'captured'
      && capture.pieceIds.includes(piece.id)
      && (piece.promoted ? piece.role !== 'pawn' : piece.originalRole !== 'pawn'))) {
    return reject(state, 'INVALID_TIMING', 'Legacy immediately follows capture of your non-Pawn.');
  }
  const resolved = structuredClone(state);
  const player = resolved.players[reactor];
  const [retrieved] = player.discard.splice(player.discard.findIndex(card => card.id === target), 1);
  player.hand.push(retrieved);
  spendCard(resolved, 'legacy', cardInstanceId, true, reactor);
  resolved.history.push({ type: 'cardPlayed', cardId: 'legacy', player: reactor });
  return { ok: true, state: resolved };
}

function playRiposte(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const reactor = opposite(state.turn.color);
  if ((cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[reactor].hand.some(card => card.cardId === 'riposte'
      && (cardInstanceId === undefined || card.id === cardInstanceId))) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Riposte is not in your hand.');
  }
  if (cardAllowanceUsed(state, reactor)) return reject(state, 'CARD_ALREADY_PLAYED', 'The card allowance is already used.');
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Riposte takes no target.');
  const checkpoint = state.chaosCheckpoint;
  const event = reactionEvent(state);
  if (!checkpoint || checkpoint.card || checkpoint.before.turn.moveMade
    || state.turn.phase !== 'afterMove' || !state.turn.moveMade
    || (!state.plotsExecution && checkpoint.historyLength !== state.history.length)
    || event?.type !== 'move' || !event.capturedId || !event.from || !event.to
    || chaosMovement(checkpoint.before, state) !== checkpoint.movement) {
    return reject(state, 'INVALID_TIMING', 'Riposte immediately follows an opposing regular capture.');
  }
  const before = checkpoint.before;
  const attacker = before.pieces.find(piece => piece.zone === 'board' && piece.square === event.from);
  const victim = before.pieces.find(piece => piece.id === event.capturedId && piece.zone === 'board');
  if (!attacker || !victim || victim.owner !== reactor
    || !state.pieces.some(piece => piece.id === attacker.id && piece.zone === 'board' && piece.square === event.to)
    || !physicalPieces(before, victim).every(component => state.pieces.some(piece =>
      piece.id === component.id && piece.zone === 'captured' && piece.square === null))) {
    return reject(state, 'INVALID_TIMING', 'The original captured defender and attacker must still be available.');
  }
  const components = physicalPieces(before, attacker);
  if (components.some(piece => piece.royal || piece.role === 'king' || piece.role === 'queen'
    || (!piece.promoted && (piece.originalRole === 'king' || piece.originalRole === 'queen')))) {
    return reject(state, 'WRONG_ROLE', 'Riposte cannot capture Kings or Queens.');
  }
  if (captureImmune(before, attacker, reactor)) return reject(state, 'ILLEGAL_MOVE', 'The attacker is protected from capture.');
  let resolved = structuredClone(state);
  resolved.pieces = structuredClone(before.pieces);
  resolved.effects = structuredClone(before.effects);
  clearChallenge(resolved, state.turn.color);
  clearCompletedPanic(before, { ok: true, state: resolved });
  resolved.enPassant = [];
  const restored = parseFen(before.fen).unwrap();
  const completed = parseFen(state.fen).unwrap();
  restored.turn = completed.turn;
  restored.fullmoves = completed.fullmoves;
  resolved.fen = makeFen(restored);
  // Restored Continuing Effects retain their physical cards instead of their capture discards.
  for (const effect of resolved.effects) {
    const card = effectRecord(effectRecord(effect)?.card);
    if (typeof card?.id === 'string') {
      for (const player of ['white', 'black'] as const) {
        resolved.players[player].discard = resolved.players[player].discard.filter(entry => entry.id !== card.id);
      }
    }
  }
  const capturedIds = losePiece(resolved, resolved.pieces.find(piece => piece.id === attacker.id)!, 'captured', reactor);
  syncFen(resolved, components);
  const setup = setupFor(resolved);
  setup.halfmoves = 0;
  setup.epSquare = undefined;
  resolved.fen = makeFen(setup);
  const expired = expirePieceEffects({ ok: true, state: resolved });
  if (expired.ok) resolved = expired.state;
  if (!isOrdinaryCheckmate(turnView(state, state.turn.color), state.turn.color)
    && isOrdinaryCheckmate(turnView(resolved, state.turn.color), state.turn.color)) {
    return fizzleCard(state, 'riposte', 'DIRECT_MATE', cardInstanceId, false, reactor);
  }
  if (isKingInCheck(resolved, reactor)) return fizzleCard(state, 'riposte', 'SELF_CHECK', cardInstanceId, false, reactor);
  (resolved.riposteLostMoves ??= []).push(reactor);
  if (isKingInCheck(resolved, state.turn.color)) resolved.riposteCheckDeferred = state.turn.color;
  resolved.pendingRescue = null;
  delete resolved.shieldMove;
  spendCard(resolved, 'riposte', cardInstanceId, true, reactor);
  resolved.history.push({ type: 'cardPlayed', cardId: 'riposte', player: reactor, capturedId: attacker.id, capturedIds,
    preservePreviousMove: false });
  return { ok: true, state: resolved };
}

function playHostage(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const selection = effectRecord(target);
  if (!selection || Object.getPrototypeOf(target) !== Object.prototype
    || Reflect.ownKeys(selection).length !== 2 || !Object.hasOwn(selection, 'pieceId')
    || !Object.hasOwn(selection, 'pawn') || typeof selection.pieceId !== 'string'
    || typeof selection.pawn !== 'string' || !SQUARE.test(selection.pawn)) {
    return reject(state, 'INVALID_TARGET', 'Choose a captured pieceId and a Pawn square.');
  }
  const returned = state.pieces.find(piece => piece.id === selection.pieceId);
  if (!returned || returned.zone !== 'captured' || returned.square !== null || returned.royal) {
    return reject(state, 'INVALID_TARGET', 'Choose a captured nonroyal physical piece.');
  }
  const reactor = returned.owner;
  const error = cardPlayError(state, 'hostage', cardInstanceId, reactor);
  if (error) return error;
  const event = hostageCaptureEvent(state);
  const response = state.plotsExecution ? state.plotsExecution.window.cardResponse : state.cardResponse;
  const captor = event?.type === 'move' ? event.player ?? state.turn.color : event?.player ?? response?.player;
  if (!event || captor !== opposite(reactor)
    || (event.capturedId !== returned.id && !event.capturedIds?.includes(returned.id))) {
    return reject(state, 'INVALID_TIMING', 'Hostage immediately follows an opponent capture of that piece.');
  }
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === selection.pawn);
  if (!pawn) return reject(state, 'INVALID_TARGET', 'Choose an occupied Pawn square.');
  if (pawn.owner !== reactor && !pawn.neutral) return reject(state, 'WRONG_OWNER', 'Choose a Pawn you control.');
  if (!hasUnpromotedPawn(state, pawn)) return reject(state, 'WRONG_ROLE', 'Choose an unpromoted original Pawn.');
  const components = physicalPieces(state, pawn);
  if (components.some(piece => piece.royal) || captureImmune(state, pawn)
    || forbiddenCitySquares(state).has(pawn.square!)) {
    return reject(state, 'INVALID_TARGET', 'That Pawn cannot be exchanged.');
  }
  let resolved = structuredClone(state);
  const capturedIds = losePiece(resolved, resolved.pieces.find(piece => piece.id === pawn.id)!, 'captured', captor);
  restoreCapturedPawn(resolved, resolved.pieces.find(piece => piece.id === returned.id)!, pawn.square!);
  syncFen(resolved, components);
  const setup = setupFor(resolved);
  setup.halfmoves = 0;
  resolved.fen = makeFen(setup);
  const expired = expirePieceEffects({ ok: true, state: resolved });
  if (expired.ok) resolved = expired.state;
  if (!isOrdinaryCheckmate(state, captor) && isOrdinaryCheckmate(resolved, captor)) {
    return fizzleCard(state, 'hostage', 'DIRECT_MATE', cardInstanceId, false, reactor);
  }
  if (isKingInCheck(resolved, reactor) && (!isKingInCheck(state, reactor)
    || (reactor === state.turn.color && state.turn.moveMade))) {
    return fizzleCard(state, 'hostage', 'SELF_CHECK', cardInstanceId, false, reactor);
  }
  spendCard(resolved, 'hostage', cardInstanceId, true, reactor);
  resolved.history.push({ type: 'cardPlayed', cardId: 'hostage', player: reactor,
    target: { pieceId: returned.id, pawn: pawn.square! }, capturedId: pawn.id, capturedIds });
  return { ok: true, state: resolved };
}

function playBog(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const mover = state.turn.color;
  const reactor = opposite(mover);
  const error = cardPlayError(state, 'bog', cardInstanceId, reactor);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', "Bog must immediately follow your opponent's move.");
  }
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Bog does not take a target.');

  const latest = state.history.at(-1);
  const fireball = latest?.type === 'cardPlayed' && (latest.copiedCardId ?? latest.cardId) === 'fireball'
    && state.fogCheckpoint?.historyLength === state.history.length
    ? state.fogCheckpoint : undefined;
  const moved = fireball?.before ?? state;
  const event = reactionEvent(moved);
  const cardId = event?.copiedCardId ?? event?.cardId;
  const checkpoint = moved.chaosCheckpoint?.before;
  const additional = cardId === 'crusade' || cardId === 'merciless';
  const preceding = additional && checkpoint ? reactionEvent(checkpoint) : undefined;
  const castle = preceding?.castlingRook;
  const turnOrigin = castle
    ? `${castle.to[0] === 'd' ? 'a' : 'h'}${castle.to[1]}` as SquareName
    : preceding?.from;
  const movementCard = event?.type === 'cardPlayed'
    && ['masquerade', 'blessing', 'doppelganger', 'bombard', 'ghostwalk', 'crusade', 'merciless']
      .includes(cardId ?? '');
  const movement = movementCard ? event.movement ?? parseCardMoves(event.target, 1) : undefined;
  const move = event && { ...event,
    from: turnOrigin ?? movement?.[0]?.from ?? event.from,
    to: movement?.at(-1)?.to ?? event.to,
  };
  if ((!movementCard && move?.type !== 'move') || !move?.from || !move.to || move.promotion) {
    return reject(state, 'INVALID_TIMING', "Bog must immediately follow your opponent's move.");
  }
  const piece = moved.pieces.find(candidate =>
    candidate.zone === 'board' && candidate.square === move.to,
  );
  if (!piece || (piece.owner !== mover && !piece.neutral)
    || !(['rook', 'bishop', 'queen'] as const).some(role => hasRole(moved, piece, role))) {
    return reject(state, 'WRONG_ROLE', 'Bog follows only a Rook, Bishop, or Queen move.');
  }
  if (fireball && (latest?.target !== piece.square || !fireballPieces(moved).some(center => center.id === piece.id))) {
    return reject(state, 'INVALID_TIMING', 'The explosion must belong to the shortened move.');
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
    || !straight && !diagonal
  ) return reject(state, 'ILLEGAL_MOVE', 'The preceding move must travel at least two squares.');

  const step = Math.sign(rankDelta) * 8 + Math.sign(fileDelta);
  let first = makeSquare(from + step);
  if (cardId === 'ghostwalk') {
    while (first !== move.to && checkpoint?.pieces.some(candidate =>
      candidate.zone === 'board' && candidate.square === first)) {
      first = makeSquare(parseSquare(first) + step);
    }
  } else if (cardId === 'bombard' && checkpoint && (
    checkpoint.pieces.some(candidate => candidate.zone === 'board' && candidate.square === first)
    || forbiddenCitySquares(checkpoint).has(first)
  )) {
    first = makeSquare(parseSquare(first) + step);
  }
  const captured = move.capturedId && first !== move.to
    ? state.pieces.find(candidate => candidate.id === move.capturedId)
    : undefined;
  if (move.capturedId && first !== move.to && (!captured || captured.zone !== 'captured' || captured.square !== null)) {
    return reject(state, 'INVALID_TIMING', 'The preceding move cannot be reconstructed.');
  }

  let resolved = structuredClone(moved);
  if (fireball) {
    // Restore the validated pre-explosion state, retaining the actual physical card and its draw.
    spendCard(resolved, fireball.card.cardId, fireball.card.id, true, fireball.player);
    resolved.history = structuredClone(state.history);
  }
  const before = captured ? checkpoint : undefined;
  if (captured) {
    const victim = before?.pieces.find(candidate => candidate.id === captured.id);
    const components = before && victim ? physicalPieces(before, victim) : [];
    if (before && components.length) {
      resolved.pieces = structuredClone(before.pieces);
      resolved.effects = structuredClone(before.effects);
      clearChallenge(resolved, mover);
      clearCompletedPanic(before, { ok: true, state: resolved });
      // Retained cards return with their effects when the distant capture is undone.
      for (const effect of resolved.effects) {
        const card = effectRecord(effectRecord(effect)?.card);
        if (typeof card?.id !== 'string') continue;
        for (const player of ['white', 'black'] as const) {
          resolved.players[player].discard = resolved.players[player].discard.filter(entry => entry.id !== card.id);
        }
      }
    } else {
      const restored = resolved.pieces.find(candidate => candidate.id === captured.id)!;
      restored.square = move.to;
      restored.zone = 'board';
      delete restored.capturedBy;
    }
  }
  if (resolved.pieces.some(candidate => candidate.zone === 'board' && candidate.square === first
    && candidate.id !== piece.id) || forbiddenCitySquares(resolved).has(first)) {
    return reject(state, 'ILLEGAL_MOVE', 'The shortened move has no available destination.');
  }
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = first;
  if (additional && checkpoint) {
    const setup = parseFen(checkpoint.fen).unwrap();
    setup.halfmoves = Math.max(0, setup.halfmoves - 1);
    if (mover === 'black') setup.fullmoves = Math.max(1, setup.fullmoves - 1);
    resolved.fen = makeFen(setup);
  } else if (move.previousFen) resolved.fen = move.previousFen;
  else if (checkpoint) resolved.fen = checkpoint.fen;
  else {
    const setup = setupFor(resolved, mover);
    setup.turn = mover;
    setup.halfmoves = Math.max(0, setup.halfmoves - (captured ? 0 : 1));
    if (mover === 'black') setup.fullmoves = Math.max(1, setup.fullmoves - 1);
    resolved.fen = makeFen(setup);
  }
  const movedComponents = physicalPieces(moved, piece);
  completeReplacementMove(resolved, mover,
    movedComponents.some(component => resetsHalfmoveClock(component, Boolean(move.capturedId && first === move.to))),
    [], movedComponents);
  if (before) {
    springManTraps(before, resolved);
    if (resolved.shieldMove) resolved.shieldMove.capturedOpponent = resolved.pieces.some(candidate =>
      candidate.zone === 'captured' && boardCarrier(before, candidate.id)
      && (candidate.owner !== mover || candidate.neutral));
  }
  const explosion = fireball ? explodeFireball(resolved, resolved.pieces.find(candidate => candidate.id === piece.id)!) : undefined;
  if (explosion) resolved = explosion.state;
  if (
    (!isOrdinaryCheckmate(state, mover) && isOrdinaryCheckmate(resolved, mover))
    || (!isOrdinaryCheckmate(state, reactor) && isOrdinaryCheckmate(resolved, reactor))
  ) {
    return fizzleCard(state, 'bog', 'DIRECT_MATE', cardInstanceId, false, reactor);
  }
  if (isKingInCheck(resolved, mover) || isKingInCheck(resolved, reactor)) {
    return fizzleCard(state, 'bog', 'SELF_CHECK', cardInstanceId, false, reactor);
  }
  if (fireball) resolved.pendingRescue = null;
  resolved.outcome = null;
  spendCard(resolved, 'bog', cardInstanceId, true, reactor);
  resolved.history.push({ type: 'cardPlayed', cardId: 'bog', ...(explosion ? { capturedIds: explosion.capturedIds } : {}) });
  return { ok: true, state: resolved };
}

function revengePawn(piece: PieceState): boolean {
  return piece.role === 'pawn' || (!piece.promoted && piece.originalRole === 'pawn');
}

function revengePawns(state: GameState): PieceState[] {
  const move = reactionEvent(state);
  if (
    state.turn.phase !== 'afterMove'
    || !state.turn.moveMade
    || move?.type !== 'move'
    || !move.capturedId
  ) {
    return [];
  }
  const reactor = opposite(state.turn.color);
  const before = state.chaosCheckpoint?.historyLength === state.history.length
    ? state.chaosCheckpoint.before : undefined;
  return state.pieces.filter(piece =>
    (piece.id === move.capturedId || move.capturedIds?.includes(piece.id))
    && piece.zone === 'captured'
    && piece.square === null
    // Capture ends Neutrality, so retain control from this capture's snapshot.
    && (piece.owner === reactor || piece.neutral || (before && boardCarrier(before, piece.id)?.neutral)
      || state.plotsExecution?.window.revengePawnIds?.includes(piece.id))
    && revengePawn(piece),
  );
}

function revengeTargets(state: GameState): SquareName[] {
  if (!revengePawns(state).length) return [];
  const mover = state.turn.color;
  return state.pieces.flatMap(piece =>
    piece.zone === 'board'
      && piece.square
      && (piece.owner === mover || piece.neutral)
      && revengePawn(piece)
      && !hasRole(state, piece, 'king')
      && !captureImmune(state, piece)
      ? [piece.square]
      : [],
  );
}

function playRevenge(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const mover = state.turn.color;
  const reactor = opposite(mover);
  const error = cardPlayError(state, 'revenge', cardInstanceId, reactor);
  if (error) return error;
  if (!revengePawns(state).length) {
    return reject(state, 'INVALID_TIMING', 'Revenge immediately follows capture of a Pawn you control.');
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
  if (hasRole(state, pawn, 'king') || captureImmune(state, pawn)) {
    return reject(state, 'INVALID_TARGET', 'That Pawn cannot be captured.');
  }

  const resolved = structuredClone(state);
  losePiece(resolved, resolved.pieces.find(piece => piece.id === pawn.id)!, 'captured', reactor);
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
  let event = state.plotsExecution?.window.reaction ?? state.history.at(-1);
  if (event?.type === 'cardPlayed' && event.cardId === 'panic') {
    event = state.history.at(-2);
  }
  if (event?.type === 'move' && event.from && event.to) return [{ from: event.from, to: event.to }];
  if (event?.type === 'cardPlayed' && event.cardId === 'irresistible-force' && Array.isArray(event.target)) {
    return event.target as CardMove[];
  }
  const checkpoint = state.chaosCheckpoint;
  if (event?.type === 'cardPlayed' && ['charge', 'crusade', 'merciless'].includes(event.copiedCardId ?? event.cardId ?? '')
    && checkpoint && (state.plotsExecution || checkpoint.historyLength === state.history.length)
    && checkpoint.before.turn.color === state.turn.color && checkpoint.before.turn.moveMade) {
    // Keep both displacements; reactionEvent also resolves a Plots saved trigger.
    const preceding = reactionEvent(checkpoint.before);
    const first = preceding?.type === 'move' && preceding.from && preceding.to
      ? [{ from: preceding.from, to: preceding.to }] : [];
    return [...first, ...(event.movement ?? [])];
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
      && hasRole(state, piece, 'pawn')
      && !hasRole(state, piece, 'king')
      && !captureImmune(state, piece)
      ? [piece.square]
      : [],
  ).sort((left, right) => parseSquare(left) - parseSquare(right));
  return [undefined, ...pawns];
}

function playToll(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const mover = state.turn.color;
  const reactor = opposite(mover);
  const error = cardPlayError(state, 'toll', cardInstanceId, reactor);
  if (error) return error;
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
    if (!state.pieces.some(piece => piece.zone === 'board' && piece.square
      && (piece.owner === mover || piece.neutral) && hasRole(state, piece, 'pawn'))) {
      const resolved = structuredClone(state);
      spendCard(resolved, 'toll', selected.id, true, reactor);
      delete resolved.turnCheckpoint;
      resolved.history.push({ type: 'cardPlayed', cardId: 'toll', player: reactor });
      return { ok: true, state: resolved };
    }
    const checkpoint = state.turnCheckpoint;
    if (!checkpoint || !checkpoint.players[reactor].hand.some(card => card.id === selected.id)) {
      return reject(state, 'INVALID_TIMING', 'The canceled turn cannot be reconstructed.');
    }
    const canceled = structuredClone(checkpoint);
    delete canceled.turnCheckpoint;
    canceled.effects = canceled.effects.filter(effect =>
      !isPanicEffect(effect) || effect.player !== mover
    );
    canceled.players[reactor].hand.find(card => card.id === selected.id)!.cardId = selected.cardId;
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
  if (!hasRole(state, pawn, 'pawn')) return reject(state, 'WRONG_ROLE', 'Toll can target only a Pawn.');
  if (hasRole(state, pawn, 'king') || captureImmune(state, pawn)) {
    return reject(state, 'INVALID_TARGET', 'That Pawn cannot be captured.');
  }
  const resolved = structuredClone(state);
  losePiece(resolved, resolved.pieces.find(piece => piece.id === pawn.id)!, 'captured', reactor);
  resolved.fen = [boardFen(resolved), ...state.fen.split(' ').slice(1)].join(' ');
  const setup = parseFen(resolved.fen).unwrap();
  setup.halfmoves = 0;
  resolved.fen = makeFen(setup);
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
    if (!hasTurnEscape(state)) state.outcome = { winner: opposite(color), reason: 'checkmate' };
  } else if (isOrdinaryStalemate(state, color) && !hasTurnEscape(state)) {
    state.outcome = { reason: 'stalemate' };
  }
}

function pieceAttacksSquare(
  state: GameState,
  piece: PieceState,
  target: SquareName,
  occupied: SquareSet,
  controller = piece.owner,
): boolean {
  if (!dungeonAllowsMove(state, piece, controller)) return false;
  if (!challengeAllows(state, [piece], controller)) return false;
  const victim = state.pieces.find(candidate =>
    candidate.zone === 'board' && candidate.square === target && candidate.id !== piece.id,
  );
  if (victim && (captureForbidden(state, piece) || captureImmune(state, victim, controller))) return false;
  const source = parseSquare(piece.square!);
  const destination = parseSquare(target);
  return physicalPieces(state, piece).some(component => {
    if (!curseAllowsMove(state, piece, piece.square!, target)) return false;
    const crab = componentHasCrabMovement(state, component.id);
    const jumping = component.role === 'knight' && !crab;
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
  if (!curseAllowsMove(state, carrier, carrier.square, to)) return false;
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
  const crab = componentHasCrabMovement(state, component.id);
  if (forbiddenCityBlocksMove(state, carrier.square, to, component.role === 'knight' && !crab)) {
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
  if (!pieceAttacksSquare(state, attacker, royal.square!, setupFor(state).board.occupied, controller)) return false;
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === attacker.id)!.square = royal.square;
  for (const captured of physicalPieces(resolved, resolved.pieces.find(piece => piece.id === royal.id)!)) {
    captured.square = null;
    captured.zone = 'captured';
  }
  return !resolved.pieces.some(piece =>
    piece.royal
    && boardCarrier(resolved, piece.id)
    && (piece.owner === controller || (piece.id === attacker.id && piece.neutral))
    && isRoyalInCheck(resolved, piece)
  );
}

function isRoyalInCheck(state: GameState, piece: PieceState): boolean {
  const carrier = boardCarrier(state, piece.id);
  if (!carrier?.square) return false;
  piece = { ...piece, square: carrier.square };
  // Royal threats include the next opposing turn, when a newly played Shield protects its target.
  const hostileControllers: readonly Color[] = (piece.neutral
    ? ['white', 'black'] as const
    : [opposite(piece.owner)]).filter(hostile => !captureImmune(state, piece, hostile, true));
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
    piece => piece.owner === color && piece.royal && boardCarrier(state, piece.id),
  );
  if (!royals.length && state.underElfHill?.some(entry => entry.player === color && !entry.returned)) return false;
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
  if (state.effects.some(effect => isRetainedContinuingEffect(effect)
    && effect.type === 'coup' && effect.owner === color && effect.suspended)
    && !state.pieces.some(piece => piece.owner === color && piece.royal
      && (piece.zone === 'board' || piece.zone === 'away'))) return true;
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
    || state.pieces.some(piece => piece.zone === 'board' && piece.square === to)
    || forbiddenCityBlocksMove(state, from, to)
  ) return undefined;

  const source = parseSquare(from);
  const target = parseSquare(to);
  for (const pawn of physicalPieces(state, moving)) {
    if (pawn.originalRole !== 'pawn' || pawn.promoted || componentHasCrabMovement(state, pawn.id)) continue;
    const [forwardFile, forwardRank] = pawnForward(state, pawn.owner);
    const fileDelta = squareFile(target) - squareFile(source);
    const rankDelta = squareRank(target) - squareRank(source);
    const diagonal = Math.abs(fileDelta) + Math.abs(rankDelta) === 2
      && fileDelta * forwardFile + rankDelta * forwardRank === 1;
    if (!diagonal) continue;

    const victimSquare = makeSquare(
      (squareRank(target) - forwardRank) * 8 + squareFile(target) - forwardFile,
    );
    const victim = state.enPassant.flatMap(opportunity => {
      if (opportunity.target !== to) return [];
      const candidate = enPassantVictim(state, opportunity);
      return candidate?.square === victimSquare ? [candidate] : [];
    })[0];
    if (victim
      && !captureForbidden(state, moving)
      && !captureImmune(state, victim)
      && (moving.neutral || victim.neutral || victim.owner !== moving.owner)) return { moving, victim };
  }
  return undefined;
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
  const carrier = boardCarrier(state, royal.id);
  if (!carrier) return false;
  return state.enPassant.some(opportunity =>
    boardCarrier(state, opportunity.pawnId)?.id === carrier.id
    && state.pieces.some(attacker => {
      if (attacker.zone !== 'board' || !attacker.square) return false;
      const capture = enPassantCapture(state, attacker.square, opportunity.target, controller);
      if (capture?.victim.id !== carrier.id) return false;
      const resolved = resolveEnPassant(state, attacker.id, carrier.id, opportunity.target);
      return !resolved.pieces.some(piece =>
        piece.royal
        && boardCarrier(resolved, piece.id)
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
  const additionalMove = state.chaosForbidden?.player === color && state.chaosForbidden.additionalMove;
  setup.halfmoves = pawnMoved ? 0 : setup.halfmoves + (additionalMove ? 0 : 1);
  if (color === 'black' && !additionalMove) setup.fullmoves += 1;
  state.fen = makeFen(setup);
  state.enPassant = enPassant;
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
  clearChallenge(state, color);
}

function resetsHalfmoveClock(piece: PieceState, capture = false): boolean {
  return capture
    || piece.role === 'pawn'
    || (piece.originalRole === 'pawn' && !piece.promoted);
}

function fizzleCard(
  state: GameState,
  cardId: string,
  reason: 'DIRECT_MATE' | 'SELF_CHECK' | 'FORBIDDEN_CITY',
  cardInstanceId?: unknown,
  consumesMove = false,
  spendColor = state.turn.color,
): ApplyResult {
  const fizzled = structuredClone(state);
  spendCard(fizzled, cardId, cardInstanceId, true, spendColor);
  if (consumesMove) completeReplacementMove(fizzled, state.turn.color, false);
  fizzled.history.push({ type: 'cardFizzled', cardId, reason });
  return { ok: true, state: fizzled };
}

function finishMovementCard(
  state: GameState,
  resolved: GameState,
  event: GameState['history'][number] & { cardId: string },
  cardInstanceId: unknown,
  movedPieces: readonly PieceState[],
  consumesMove = false,
): ApplyResult {
  const color = state.turn.color;
  expireFatalAttractions(state, resolved);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, event.cardId, 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (moveLeavesRoyalInCheck(resolved, color, movedPieces)) {
    return fizzleCard(state, event.cardId, 'SELF_CHECK', cardInstanceId, consumesMove);
  }
  spendCard(resolved, event.cardId, cardInstanceId);
  resolved.history.push(event);
  return { ok: true, state: resolved };
}

function playConfabulation(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'confabulation', cardInstanceId);
  if (error) return error;
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
  refreshNeutrality(resolved);
  completeReplacementMove(
    resolved,
    color,
    resetsHalfmoveClock(mover),
    [],
    [mover],
  );
  expireFatalAttractions(state, resolved);
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
  const error = cardPlayError(state, 'disintegration', cardInstanceId);
  if (error) return error;
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
  if (hasRole(state, pawn, 'king')) return reject(state, 'INVALID_TARGET', 'A King can never be made dead.');

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
  const error = cardPlayError(state, 'fanatic', cardInstanceId);
  if (error) return error;
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

  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'fanatic', target: targetSquare },
    cardInstanceId, [pawn], !wasInCheck,
  );
}

function playMadman(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'madman', cardInstanceId);
  if (error) return error;
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
    const option = madmanJumpOptions(state, occupied, current, used).find(candidate =>
      candidate.move.from === move.from && candidate.move.to === move.to,
    );
    if (!option) return reject(state, 'ILLEGAL_MOVE', 'Each jump must cross a different piece and land on an empty square.');
    occupied.delete(current);
    occupied.set(move.to, pawn);
    used.add(option.jumpedId);
    current = move.to;
  }
  if (madmanJumpOptions(state, occupied, current, used).length) {
    return reject(state, 'ILLEGAL_MOVE', 'The Pawn must continue while another jump is available.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  const resolvedPawn = resolved.pieces.find(piece => piece.id === pawn.id)!;
  resolvedPawn.square = current;
  completeReplacementMove(resolved, color, true, [], [resolvedPawn]);
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'madman', target: moves },
    cardInstanceId, [resolvedPawn], !wasInCheck,
  );
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
  const error = cardPlayError(state, 'forced-march', cardInstanceId);
  if (error) return error;
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

  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'forced-march', target: moves },
    cardInstanceId, pawns, !wasInCheck,
  );
}

function playAnnexation(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'annexation', cardInstanceId);
  if (error) return error;
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
    doubleStepEnPassant(state, pawns[index], move.from, move.to),
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
  expireFatalAttractions(state, completed);
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
  const error = cardPlayError(state, 'guardian', cardInstanceId);
  if (error) return error;
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
  const enPassant = follower ? [] : physicalPieces(state, pawn).flatMap(component =>
    component.originalRole === 'pawn'
      ? doubleStepEnPassant(state, component, pawnMove.from, pawnMove.to)
      : [],
  );
  completeReplacementMove(resolved, color, true, enPassant, movedPieces);

  const canonicalMoves = followerMove ? [pawnMove, followerMove] : [pawnMove];
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'guardian', target: canonicalMoves },
    cardInstanceId, movedPieces, !wasInCheck,
  );
}

function playOnslaught(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'onslaught', cardInstanceId);
  if (error) return error;
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

  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'onslaught', target: moves },
    cardInstanceId, pawns, !wasInCheck,
  );
}

function playLongJump(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'long-jump', cardInstanceId);
  if (error) return error;
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
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'long-jump', target: moves },
    cardInstanceId, [knight], !wasInCheck,
  );
}

function pendingElfReturn(state: GameState) {
  return state.underElfHill?.find(entry => entry.player === state.turn.color && entry.returning && !entry.returned);
}

function playUnderElfHill(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'under-elf-hill', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Under Elf Hill replaces the regular move.');
  }
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Under Elf Hill takes no target.');
  const king = state.pieces.find(piece => piece.owner === color && piece.royal && piece.zone === 'board' && piece.square);
  if (!king || !dungeonAllowsMove(state, king, color, true)) return reject(state, 'ILLEGAL_MOVE', 'Your King cannot leave the board.');
  const next = structuredClone(state);
  const departed = next.pieces.find(piece => piece.id === king.id)!;
  departed.zone = 'away';
  departed.square = null;
  (next.underElfHill ??= []).push({ pieceId: king.id, player: color, returning: false });
  completeReplacementMove(next, color, king.originalRole === 'pawn' && !king.promoted, [], [king]);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(next, defender)) {
    return fizzleCard(state, 'under-elf-hill', 'DIRECT_MATE', cardInstanceId, !isKingInCheck(state, color));
  }
  spendCard(next, 'under-elf-hill', cardInstanceId);
  next.history.push({ type: 'cardPlayed', cardId: 'under-elf-hill' });
  return { ok: true, state: next };
}

function placeElfKing(state: GameState, to: SquareName): GameState {
  const next = structuredClone(state);
  const entry = pendingElfReturn(next)!;
  const king = next.pieces.find(piece => piece.id === entry.pieceId)!;
  king.square = to;
  king.zone = 'board';
  entry.returned = true;
  syncFen(next);
  return next;
}

export function underElfHillReturnSquares(state: GameState): SquareName[] {
  const entry = pendingElfReturn(state);
  if (state.outcome || !entry || state.turn.phase !== 'beforeMove' || state.turn.moveMade) return [];
  const king = state.pieces.find(piece => piece.id === entry.pieceId && piece.zone === 'away');
  if (!king) return [];
  const board = setupFor(state).board;
  const forbidden = forbiddenCitySquares(state);
  const defender = opposite(state.turn.color);
  const alreadyMate = isOrdinaryCheckmate(state, defender);
  const choices: SquareName[] = [];
  for (let square = 0; square < 64; square += 1) {
    if (squareFile(square) !== 0 && squareFile(square) !== 7 && squareRank(square) !== 0 && squareRank(square) !== 7) continue;
    const to = makeSquare(square);
    if (board.has(square) || forbidden.has(to)) continue;
    const next = placeElfKing(state, to);
    if (isKingInCheck(withoutTruce(next), state.turn.color)
      || (!alreadyMate && isOrdinaryCheckmate(next, defender))) continue;
    choices.push(to);
  }
  return choices;
}

function returnElfKing(state: GameState, action: Extract<GameAction, { type: 'returnKing' }>): ApplyResult {
  if (!pendingElfReturn(state)) return reject(state, 'INVALID_TIMING', 'No King return is due.');
  if (Object.getPrototypeOf(action) !== Object.prototype || Reflect.ownKeys(action).length !== 2
    || typeof action.to !== 'string' || !SQUARE.test(action.to)
    || !underElfHillReturnSquares(state).includes(action.to as SquareName)) {
    return reject(state, 'INVALID_TARGET', 'Choose a safe vacant edge square.');
  }
  return { ok: true, state: adjudicateTurn(consumeRiposteMove(placeElfKing(state, action.to as SquareName))) };
}

function evilEyeVictims(state: GameState, attacker: PieceState): SquareName[] {
  if (!attacker.square || attacker.zone !== 'board'
    || (attacker.owner !== state.turn.color && !attacker.neutral)) return [];
  // FAQ26: judge a royal attacker's safety where it stays, not on the victim's square.
  const royal = physicalPieces(state, attacker).some(piece => piece.royal);
  const destinations = legalDests(state, royal ? 'defer' : false, !royal).get(attacker.square) ?? [];
  const victims = new Set<SquareName>();
  for (const destination of destinations) {
    const enPassant = enPassantCapture(state, attacker.square, destination);
    const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === destination)
      ?? (enPassant
        && movePiece(state, { type: 'move', from: attacker.square, to: destination, enPassant: true },
          royal ? 'defer' : false, !royal).ok
        ? enPassant.victim : undefined);
    if (victim?.square && victim.id !== attacker.id
      && (victim.neutral || victim.owner !== state.turn.color)
      && !physicalPieces(state, victim).some(piece => piece.royal)) victims.add(victim.square);
  }
  return [...victims];
}

function playEvilEye(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'evil-eye', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Evil Eye replaces the regular move.');
  }
  const selection = effectRecord(target);
  if (!selection || Object.getPrototypeOf(selection) !== Object.prototype || Reflect.ownKeys(selection).length !== 2
    || !Object.hasOwn(selection, 'attacker') || !Object.hasOwn(selection, 'victim')
    || typeof selection.attacker !== 'string' || !SQUARE.test(selection.attacker)
    || typeof selection.victim !== 'string' || !SQUARE.test(selection.victim)
    || selection.attacker === selection.victim) {
    return reject(state, 'INVALID_TARGET', 'Choose two distinct occupied attacker and victim squares.');
  }
  const attacker = state.pieces.find(piece => piece.zone === 'board' && piece.square === selection.attacker);
  const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === selection.victim);
  if (!attacker || !victim) return reject(state, 'INVALID_TARGET', 'Choose occupied attacker and victim squares.');
  if (attacker.owner !== color && !attacker.neutral) return reject(state, 'WRONG_OWNER', 'Choose an attacker you control.');
  if (!evilEyeVictims(state, attacker).includes(victim.square!)) {
    return reject(state, 'ILLEGAL_MOVE', 'The attacker must legally threaten the opposing victim.');
  }
  const removed = physicalPieces(state, victim);
  const resolved = structuredClone(state);
  const capturedIds = losePiece(resolved, resolved.pieces.find(piece => piece.id === victim.id)!, 'captured');
  completeReplacementMove(resolved, color, true, [], removed);
  const result: ApplyResult = { ok: true, state: resolved };
  expirePieceEffects(result);
  const defender = opposite(color);
  const consumesMove = !isKingInCheck(state, color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(result.state, defender)) {
    return fizzleCard(state, 'evil-eye', 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (isKingInCheck(result.state, color)) {
    return fizzleCard(state, 'evil-eye', 'SELF_CHECK', cardInstanceId, consumesMove);
  }
  spendCard(result.state, 'evil-eye', cardInstanceId);
  result.state.history.push({ type: 'cardPlayed', cardId: 'evil-eye',
    target: { attacker: attacker.square!, victim: victim.square! }, capturedId: victim.id, capturedIds });
  return result;
}

function splitKnightVictims(state: GameState, knight: PieceState): SquareName[] {
  if (!knight.square || knight.zone !== 'board'
    || (knight.owner !== state.turn.color && !knight.neutral)
    || !hasRole(state, knight, 'knight')
    || physicalPieces(state, knight).some(piece => piece.royal)) return [];
  const destinations = legalDests(state, false).get(knight.square) ?? [];
  return state.pieces.flatMap(victim => victim.zone === 'board' && victim.square
    && victim.id !== knight.id
    && (knight.neutral || victim.neutral || victim.owner !== knight.owner)
    && !physicalPieces(state, victim).some(piece => piece.royal)
    && destinations.includes(victim.square) ? [victim.square] : []);
}

function playSplitKnight(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'split-knight', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Split Knight replaces the regular move.');
  }
  const selection = effectRecord(target);
  if (!selection || typeof selection.knight !== 'string' || !SQUARE.test(selection.knight)
    || !Array.isArray(selection.targets) || selection.targets.length < 2
    || !selection.targets.every(square => typeof square === 'string' && SQUARE.test(square))
    || new Set(selection.targets).size !== selection.targets.length) {
    return reject(state, 'INVALID_TARGET', 'Choose a Knight and at least two distinct occupied opposing squares.');
  }
  const knight = state.pieces.find(piece => piece.zone === 'board' && piece.square === selection.knight);
  if (!knight) return reject(state, 'INVALID_TARGET', 'There is no Knight on that square.');
  if (knight.owner !== color && !knight.neutral) return reject(state, 'WRONG_OWNER', 'Choose a Knight you control.');
  if (!hasRole(state, knight, 'knight')) return reject(state, 'WRONG_ROLE', 'Choose a Knight.');
  const destinations = splitKnightVictims(state, knight);
  if (!selection.targets.every(square => destinations.includes(square))) {
    return reject(state, 'ILLEGAL_MOVE', 'Every selected piece must be a legal ordinary capture by the Knight.');
  }
  const victims = selection.targets.map(square => state.pieces.find(piece => piece.zone === 'board' && piece.square === square)!);
  const removed = [...victims, knight].flatMap(piece => physicalPieces(state, piece));
  const resolved = structuredClone(state);
  const capturedIds = [...victims, knight].flatMap(piece =>
    losePiece(resolved, resolved.pieces.find(candidate => candidate.id === piece.id)!, 'captured'));
  completeReplacementMove(resolved, color, true, [], removed);
  const result: ApplyResult = { ok: true, state: resolved };
  expirePieceEffects(result);
  const defender = opposite(color);
  const consumesMove = !isKingInCheck(state, color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(result.state, defender)) {
    return fizzleCard(state, 'split-knight', 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (isKingInCheck(result.state, color)) {
    return fizzleCard(state, 'split-knight', 'SELF_CHECK', cardInstanceId, consumesMove);
  }
  spendCard(result.state, 'split-knight', cardInstanceId);
  result.state.history.push({ type: 'cardPlayed', cardId: 'split-knight',
    target: { knight: knight.square!, targets: [...selection.targets] } as SplitKnightTarget, capturedIds });
  return result;
}

function playDubbing(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'dubbing', cardInstanceId);
  if (error) return error;
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
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'dubbing', target: moves },
    cardInstanceId, [piece], !wasInCheck,
  );
}

function playSlidingMoveCard(state: GameState, cardId: 'masquerade' | 'blessing', target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const name = CARD_CATALOG[cardId].name;
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
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
    component.role === 'pawn' || (!component.promoted && component.originalRole === 'pawn')
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
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId, target: moves },
    cardInstanceId, movedPieces, !wasInCheck,
  );
}

function playDoppelganger(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'doppelganger', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Doppelganger is played instead of the regular move.');
  }
  const copied = doppelgangerCopy(state);
  if (!copied) {
    return reject(state, 'INVALID_TIMING', 'There is no single previous move to copy.');
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
  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  completeReplacementMove(resolved, color, false, [], [piece]);
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'doppelganger', target: moves },
    cardInstanceId, [piece], !wasInCheck,
  );
}

function playHiddenPassage(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'hidden-passage', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Hidden Passage replaces the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key => key !== 'length' && key !== '0')
    || Object.getPrototypeOf((target as unknown[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')) {
    return reject(state, 'INVALID_TARGET', 'Choose one King and an empty square.');
  }
  const [move] = moves;
  const king = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!king) return reject(state, 'INVALID_TARGET', 'Choose an on-board King.');
  if (king.owner !== color) return reject(state, 'WRONG_OWNER', 'Choose your own King.');
  if (!king.royal) return reject(state, 'WRONG_ROLE', 'Choose your royal piece.');
  if (move.from === move.to || state.pieces.some(piece => piece.zone === 'board' && piece.square === move.to)
    || forbiddenCityBlocksMove(state, move.from, move.to, true)
    || !dungeonAllowsMove(state, king, color, true)
    || !curseAllowsMove(state, king, move.from, move.to)
    || !challengeAllows(state, [king])) {
    return reject(state, 'ILLEGAL_MOVE', 'Choose a different empty destination.');
  }
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === king.id)!.square = move.to;
  completeReplacementMove(resolved, color, king.originalRole === 'pawn' && !king.promoted, [], [king]);
  expireFatalAttractions(state, resolved);
  const consumesMove = !isKingInCheck(state, color);
  if (moveLeavesRoyalInCheck(resolved, color, [king])) return fizzleCard(state, 'hidden-passage', 'SELF_CHECK', cardInstanceId, consumesMove);
  if (!isOrdinaryCheckmate(state, opposite(color)) && isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'hidden-passage', 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  spendCard(resolved, 'hidden-passage', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'hidden-passage', target: moves });
  return { ok: true, state: resolved };
}

function playSquaringTheCircle(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'squaring-the-circle', cardInstanceId);
  if (error) return error;
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
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'squaring-the-circle', target: moves },
    cardInstanceId, [piece], !wasInCheck,
  );
}

function playAssassin(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'assassin', cardInstanceId);
  if (error) return error;
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
  if (hasRole(state, victim, 'king')) return reject(state, 'INVALID_TARGET', 'A King can never be captured.');
  if (!assassinDests(state, move.from).includes(move.to)) {
    return reject(state, 'ILLEGAL_MOVE', 'The selected piece cannot capture that piece normally.');
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === mover.id)!.square = move.to;
  losePiece(resolved, resolved.pieces.find(piece => piece.id === victim.id)!, 'captured');
  completeReplacementMove(resolved, color, true, [], [mover, victim]);
  return finishMovementCard(state, resolved, {
    type: 'cardPlayed',
    cardId: 'assassin',
    target: moves,
    capturedId: victim.id,
  }, cardInstanceId, [mover], !wasInCheck);
}

function playDarkMirror(state: GameState, target: unknown, cardInstanceId?: unknown, cardId = 'dark-mirror'): ApplyResult {
  const color = state.turn.color;
  const name = CARD_CATALOG[cardId].name;
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
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
  if (!physicalPieces(state, pawn).some(component => component.originalRole === 'pawn'
    && !component.promoted && !componentHasCrabMovement(state, component.id))) {
    return reject(state, 'INVALID_TARGET', `Crab prevents that Pawn from using ${name}.`);
  }
  const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.to);
  if (!victim) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (!pawn.neutral && !victim.neutral && victim.owner === pawn.owner) {
    return reject(state, 'WRONG_OWNER', 'The Pawn must capture an opponent piece.');
  }
  if (hasRole(state, victim, 'king')) return reject(state, 'INVALID_TARGET', 'A King can never be captured.');
  if (captureForbidden(state, pawn) || captureImmune(state, victim)) {
    return reject(state, 'INVALID_TARGET', 'That Pawn cannot capture or the target cannot be captured.');
  }
  if (
    cardId === 'breakthrough'
      ? !breakthroughDests(state, move.from).includes(move.to)
      : !darkMirrorDests(state, move.from).includes(move.to)
  ) {
    return reject(state, 'ILLEGAL_MOVE', `That is not a legal ${name} capture.`);
  }

  const wasInCheck = isKingInCheck(state, color);
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === pawn.id)!.square = move.to;
  const movedPieces = physicalPieces(state, pawn);
  const capturedPieces = physicalPieces(state, victim);
  const capturedIds = losePiece(resolved, resolved.pieces.find(piece => piece.id === victim.id)!, 'captured');
  completeReplacementMove(resolved, color, true, [], [...movedPieces, ...capturedPieces]);
  return finishMovementCard(state, resolved, {
    type: 'cardPlayed',
    cardId,
    target: moves,
    capturedId: victim.id,
    ...(capturedIds.length > 1 ? { capturedIds } : {}),
  }, cardInstanceId, movedPieces, !wasInCheck);
}

function playAbduction(state: GameState, target: unknown, cardInstanceId?: unknown, validateOnly = false): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'abduction', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade || state.pendingDoomsayer) {
    return reject(state, 'INVALID_TIMING', 'Abduction is played after the regular move.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose an occupied square.');
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === target);
  if (!piece) return reject(state, 'INVALID_TARGET', 'Choose a piece on the board.');
  if (piece.owner === color && !piece.neutral) return reject(state, 'WRONG_OWNER', 'Choose an opposing piece.');
  const components = physicalPieces(state, piece);
  if (components.some(component => component.royal)) return reject(state, 'WRONG_ROLE', 'Abduction cannot remove a King.');
  if (captureImmune(state, piece)) return reject(state, 'ILLEGAL_MOVE', 'That piece is protected from capture.');
  if (validateOnly) return { ok: true, state };
  const next = structuredClone(state);
  next.pendingAbduction = {
    phase: 'concealment', player: opposite(color), durationMs: 10000, pieceId: piece.id,
    requiresPieceId: components.length > 1 || state.effects.some(effect => {
      const record = effectRecord(effect);
      return components.some(component => targetMatchesPiece(record?.pieceId ?? record?.targetId ?? record?.target, component)
        || (Array.isArray(record?.pieceIds) && record.pieceIds.some(id => targetMatchesPiece(id, component))));
    }),
    before: structuredClone(state),
  };
  for (const component of physicalPieces(next, next.pieces.find(candidate => candidate.id === piece.id)!)) {
    component.zone = 'away';
    component.square = null;
  }
  // Removal is provisional: retain every FEN field except board occupancy.
  next.fen = [boardFen(next), ...state.fen.split(' ').slice(1)].join(' ');
  spendCard(next, 'abduction', cardInstanceId);
  next.history.push({ type: 'cardPlayed', cardId: 'abduction' });
  return { ok: true, state: next };
}

function resolveAbduction(state: GameState, correct: boolean): ApplyResult {
  const pending = state.pendingAbduction!;
  const before = pending.before;
  let next = structuredClone(state);
  next.pendingAbduction = null;
  next.pieces = structuredClone(before.pieces);
  next.fen = before.fen;
  next.enPassant = structuredClone(before.enPassant);
  const event = next.history.at(-1)!;
  const piece = next.pieces.find(candidate => candidate.id === pending.pieceId)!;
  event.target = piece.square!;
  if (!correct) {
    const components = structuredClone(physicalPieces(next, piece));
    event.capturedIds = losePiece(next, piece, 'captured');
    event.capturedId = piece.id;
    syncFen(next, components);
    const setup = setupFor(next);
    setup.halfmoves = 0;
    next.fen = makeFen(setup);
    next = (expirePieceEffects({ ok: true, state: next }) as { ok: true; state: GameState }).state;
    const defender = opposite(before.turn.color);
    const reason = !isOrdinaryCheckmate(before, defender) && isOrdinaryCheckmate(next, defender)
      ? 'DIRECT_MATE' : isKingInCheck(next, before.turn.color) ? 'SELF_CHECK' : undefined;
    if (reason) {
      const spent = structuredClone(state);
      spent.pendingAbduction = null;
      spent.pieces = structuredClone(before.pieces);
      spent.fen = before.fen;
      spent.enPassant = structuredClone(before.enPassant);
      spent.history[spent.history.length - 1] = { ...state.history.at(-1)!, type: 'cardFizzled', reason };
      next = spent;
    }
  }
  return recordCardTransition(before, settlePendingRescue(before, { ok: true, state: next }, event.cardId!));
}

function abductionResponse(state: GameState, action: GameAction): ApplyResult {
  const pending = state.pendingAbduction;
  if (!pending) return reject(state, 'INVALID_TIMING', 'No Abduction challenge is pending.');
  if (Object.getPrototypeOf(action) !== Object.prototype) return reject(state, 'INVALID_TARGET', 'Use a plain action.');
  if (action.type === 'revealAbduction' || action.type === 'abductionTimeout') {
    if (Reflect.ownKeys(action).length !== 1) return reject(state, 'INVALID_TARGET', 'This timer action takes no payload.');
    if (action.type === 'revealAbduction') {
      if (pending.phase !== 'concealment') return reject(state, 'INVALID_TIMING', 'The recall window has already begun.');
      const next = structuredClone(state);
      next.pendingAbduction!.phase = 'recall';
      return { ok: true, state: next };
    }
    if (pending.phase !== 'recall') return reject(state, 'INVALID_TIMING', 'The recall window has not begun.');
    return resolveAbduction(state, false);
  }
  if (action.type !== 'answerAbduction' || pending.phase !== 'recall') {
    return reject(state, 'INVALID_TIMING', 'Wait for the Abduction recall window.');
  }
  const required = ['type', 'player', 'role', 'owner', 'square'];
  if (!required.every(key => Object.hasOwn(action, key))
    || Reflect.ownKeys(action).some(key => typeof key !== 'string' || (!required.includes(key) && key !== 'pieceId'))
    || (action.player !== 'white' && action.player !== 'black')
    || (action.owner !== 'white' && action.owner !== 'black')
    || !['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].includes(action.role)
    || typeof action.square !== 'string' || !SQUARE.test(action.square)
    || (Object.hasOwn(action, 'pieceId') && (typeof action.pieceId !== 'string' || !action.pieceId))) {
    return reject(state, 'INVALID_TARGET', 'Supply a player, role, owner, square, and optional physical piece ID.');
  }
  if (action.player !== pending.player) return reject(state, 'WRONG_OWNER', 'Only the opponent may answer Abduction.');
  const piece = pending.before.pieces.find(candidate => candidate.id === pending.pieceId)!;
  return resolveAbduction(state, action.role === piece.role && action.owner === piece.owner && action.square === piece.square
    && (action.pieceId === undefined ? !pending.requiresPieceId : action.pieceId === piece.id));
}

function playDungeon(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'dungeon', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Dungeon is played after the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1) return reject(state, 'INVALID_TARGET', 'Choose one opposing piece and an empty corner.');
  const [move] = moves;
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === move.from);
  if (!piece) return reject(state, 'INVALID_TARGET', 'Choose a piece on the board.');
  if (!piece.neutral && piece.owner === color) return reject(state, 'WRONG_OWNER', 'Choose an opposing piece.');
  const components = physicalPieces(state, piece);
  if (components.some(component => component.royal)) return reject(state, 'WRONG_ROLE', 'Dungeon cannot move a King.');
  if (!CORNERS.includes(move.to)
    || state.pieces.some(candidate => candidate.zone === 'board' && candidate.square === move.to)
    || forbiddenCityBlocksMove(state, move.from, move.to, true)
    || !curseAllowsMove(state, piece, move.from, move.to)
    || !dungeonAllowsMove(state, piece, color, true)) {
    return reject(state, 'ILLEGAL_MOVE', 'Choose a legal empty corner.');
  }
  const resolved = structuredClone(state);
  resolved.pieces.find(candidate => candidate.id === piece.id)!.square = move.to;
  resolved.effects.push({ type: 'dungeon', owner: color, player: opposite(color), pieceId: piece.id } satisfies DungeonEffect);
  syncFen(resolved, components);
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'dungeon', target: moves },
    cardInstanceId, components,
  );
}

function playCowardice(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'cowardice', cardInstanceId);
  if (error) return error;
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
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'cowardice', target: moves },
    cardInstanceId, [pawn],
  );
}

function playRebirth(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'rebirth', cardInstanceId);
  if (error) return error;
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
  if (victim) {
    const setup = setupFor(resolved);
    setup.halfmoves = 0;
    resolved.fen = makeFen(setup);
  }
  return finishMovementCard(state, resolved, {
    type: 'cardPlayed',
    cardId: 'rebirth',
    target: [move],
    ...(victim ? { capturedId: victim.id } : {}),
  }, cardInstanceId, [piece]);
}

function playHeresy(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'heresy', cardInstanceId);
  if (error) return error;
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
    || Array.from(target).some(candidate =>
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
    springManTraps(phase, resolved);
    movedPieces.push(...bishops);
    bishops.forEach(bishop => movedIds.add(bishop.id));
    offset += phaseMoves.length;
  }
  if (offset !== parsedMoves.length) {
    return reject(state, 'INVALID_TARGET', 'Only eligible Bishops may be moved.');
  }

  resolved.enPassant = resolved.enPassant.filter(opportunity => !movedIds.has(opportunity.pawnId));
  syncFen(resolved, movedPieces);
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'heresy', target: parsedMoves },
    cardInstanceId, movedPieces,
  );
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
  const error = cardPlayError(state, 'figure-dance', cardInstanceId);
  if (error) return error;
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

  return finishMovementCard(state, resolved, {
    type: 'cardPlayed',
    cardId: 'figure-dance',
    target: promotions,
  }, cardInstanceId, moves.map(move => move.piece));
}

function earthquakeOrientation(
  orientation: BoardOrientation,
  direction: EarthquakeDirection,
): BoardOrientation {
  // Board-attached squares; positive orientation is counterclockwise viewed from above.
  return ((orientation + (direction === 'clockwise' ? 270 : 90)) % 360) as BoardOrientation;
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

function earthquakePromotions(required: PieceState[], promotions: unknown): PromotionDeclaration[] | undefined {
  if (
    !Array.isArray(promotions)
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
  ) return undefined;

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
  ) return undefined;
  return parsedPromotions as PromotionDeclaration[];
}

function earthquakeTargets(state: GameState, direction: EarthquakeDirection): EarthquakeTarget[] {
  return earthquakePromotionPieces(state, direction).reduce<EarthquakeTarget[]>(
    (targets, piece) => targets.flatMap(target => [...PROMOTIONS].map(role => ({
      direction,
      promotions: [...target.promotions, { square: piece.square!, role: role as PromotionDeclaration['role'] }],
    }))),
    [{ direction, promotions: [] }],
  );
}

function playEarthquake(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'earthquake', cardInstanceId);
  if (error) return error;
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
  if (direction !== 'clockwise' && direction !== 'counterclockwise') {
    return reject(state, 'INVALID_TARGET', 'Choose a direction and every required promotion.');
  }
  const required = earthquakePromotionPieces(state, direction);
  const promotions = earthquakePromotions(required, fields.promotions);
  if (!promotions) return reject(state, 'INVALID_TARGET', 'Promote every qualifying Pawn, opponent first and in square order.');

  const canonicalTarget: EarthquakeTarget = {
    direction,
    promotions,
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

  if (moveLeavesRoyalInCheck(resolved, color, required)) {
    return fizzleCard(state, 'earthquake', 'SELF_CHECK', cardInstanceId);
  }

  const card = spendCard(resolved, 'earthquake', cardInstanceId, false);
  resolved.effects.push({ type: 'earthquake', owner: color, card, direction, target: canonicalTarget });
  resolved.history.push({ type: 'cardPlayed', cardId: 'earthquake', target: canonicalTarget });
  return { ok: true, state: resolved };
}

function isRetainedContinuingEffect(effect: GameEffect): effect is RetainedEffect {
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
    || !effectCardMatches(card, record.type)
  ) return false;
  return !Object.hasOwn(CARD_CATALOG, record.type) || CARD_CATALOG[record.type].continuing !== false;
}

function peaceTalksEffects(state: GameState, effect: RetainedEffect): RetainedEffect[] {
  const effectIndex = state.effects.indexOf(effect);
  return [effect, ...state.effects.filter((candidate, index): candidate is RetainedEffect =>
    isConfabulationEffect(effect)
      && isRetainedContinuingEffect(candidate)
      && ((candidate.type === 'coup'
        && typeof candidate.kingId === 'string'
        && effect.pieceIds.includes(candidate.kingId))
        || (index > effectIndex && 'pieceId' in candidate
          && typeof candidate.pieceId === 'string'
          && effect.pieceIds.includes(candidate.pieceId))),
  )];
}

function peaceTalksEffectIds(state: GameState): string[] {
  const color = state.turn.color;
  if (
    state.outcome
    || state.turn.phase !== 'afterMove'
    || !state.turn.moveMade
    || cardAllowanceUsed(state, color)
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
      && peaceTalksEffects(state, effect).every((candidate, _index, cancelled) =>
        candidate.type !== 'coup' || safeCoupPieces(state, candidate, cancelled) !== undefined,
      )
      ? [effect.card.id]
      : [],
  );
}

function peaceTalksTargets(state: GameState): (string | PeaceTalksTarget)[] {
  return peaceTalksEffectIds(state).flatMap<string | PeaceTalksTarget>(effectId => {
    const effect = state.effects.find((candidate): candidate is RetainedEffect =>
      isRetainedContinuingEffect(candidate) && candidate.card.id === effectId,
    )!;
    if (effect.type !== 'earthquake') return [effectId];
    return earthquakeTargets(state, effect.direction === 'clockwise' ? 'counterclockwise' : 'clockwise')
      .map(({ promotions }) => promotions.length ? { effectId, promotions } : effectId);
  });
}

function restoreCoupPieces(state: GameState, effect: CoupEffect, cancelled: RetainedEffect[]): void {
  if (cancelled.length && !cancelled.some(candidate =>
    candidate.type === 'coup' && candidate.owner === effect.owner && !candidate.suspended)) return;
  const coups = state.effects.filter((candidate): candidate is CoupEffect =>
    isRetainedContinuingEffect(candidate) && candidate.type === 'coup' && candidate.owner === effect.owner,
  );
  for (const coup of [...coups].reverse()) {
    if (coup.suspended) continue;
    const prince = state.pieces.find(piece => piece.id === coup.princeId);
    const king = state.pieces.find(piece => piece.id === coup.kingId);
    if (!prince || !king) continue;
    prince.royal = prince.zone === 'board' || prince.zone === 'away';
    if (prince.role === 'king' && typeof coup.princeRole === 'string') prince.role = coup.princeRole;
    king.royal = false;
  }
  // A captured Prince still anchors the succession; a retained Coup can crown its surviving replacement.
  let prince = state.pieces.find(piece => piece.owner === effect.owner && piece.royal)
    ?? state.pieces.find(piece => piece.id === (coups.find(coup => !coup.suspended) ?? coups[0])?.princeId);
  for (const coup of coups) {
    if (cancelled.some(candidate => candidate.card.id === coup.card.id)) continue;
    const king = state.pieces.find(piece => piece.id === coup.kingId);
    if (king && (hasRole(state, king, 'queen') || hasRole(state, king, 'rook'))) {
      coup.suspended = true;
      continue;
    }
    delete coup.suspended;
    if (!prince || !king) continue;
    coup.princeId = prince.id;
    coup.princeRole = prince.role;
    prince.royal = false;
    prince.role = 'king';
    king.royal = king.zone === 'board' || king.zone === 'away';
    prince = king;
  }
  state.fen = [boardFen(state), ...state.fen.split(' ').slice(1)].join(' ');
}

function refreshCoups(state: GameState): void {
  for (const owner of ['white', 'black'] as const) {
    const changed = state.effects.find((effect): effect is CoupEffect => {
      if (!isRetainedContinuingEffect(effect) || effect.type !== 'coup' || effect.owner !== owner) return false;
      const king = state.pieces.find(piece => piece.id === effect.kingId);
      return Boolean(king && (hasRole(state, king, 'queen') || hasRole(state, king, 'rook'))) !== Boolean(effect.suspended);
    });
    if (!changed) continue;
    restoreCoupPieces(state, changed, []);
  }
  refreshNeutrality(state);
}

function safeCoupPieces(state: GameState, effect: CoupEffect, cancelled: RetainedEffect[]): [PieceState, PieceState] | undefined {
  const prince = typeof effect.princeId === 'string'
    ? state.pieces.find(piece => piece.id === effect.princeId)
    : undefined;
  const king = typeof effect.kingId === 'string'
    ? state.pieces.find(piece => piece.id === effect.kingId)
    : undefined;
  const pieces = prince
    && king
    && prince !== king
    && (effect.suspended || (king.zone === 'board' && king.square && SQUARE.test(king.square))
      || (king.zone === 'away' && state.underElfHill?.some(entry => entry.pieceId === king.id && !entry.returned)))
    ? [prince, king] as [PieceState, PieceState]
    : undefined;
  if (!pieces) return undefined;
  const resolved = structuredClone(state);
  restoreCoupPieces(resolved, effect, cancelled);
  resolved.effects = resolved.effects.filter(candidate =>
    !isRetainedContinuingEffect(candidate) || !cancelled.some(removed => removed.card.id === candidate.card.id),
  );
  refreshNeutrality(resolved);
  return !resolved.pieces.some(piece => piece.owner === effect.owner && piece.royal
    && (piece.zone === 'board' || piece.zone === 'away'))
    || isOrdinaryCheckmate(resolved, pieces[0].owner) ? undefined : pieces;
}

function playPeaceTalks(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'peace-talks', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Peace Talks is played after the regular move.');
  }
  const fields = typeof target === 'string' ? undefined : effectRecord(target);
  if (typeof target !== 'string' && (!fields
    || Object.getPrototypeOf(target) !== Object.prototype
    || Reflect.ownKeys(fields).length !== 2
    || !Object.hasOwn(fields, 'effectId')
    || !Object.hasOwn(fields, 'promotions'))) {
    return reject(state, 'INVALID_TARGET', 'Choose one retained Continuing Effect card and its required promotions.');
  }
  const effectId = fields ? fields.effectId : target;
  if (typeof effectId !== 'string' || !peaceTalksEffectIds(state).includes(effectId)) {
    return reject(state, 'INVALID_TARGET', 'Choose one retained Continuing Effect card.');
  }

  const effect = state.effects.find((candidate): candidate is RetainedEffect =>
    isRetainedContinuingEffect(candidate) && candidate.card.id === effectId,
  )!;
  if (fields && effect.type !== 'earthquake') {
    return reject(state, 'INVALID_TARGET', 'Promotion declarations apply only to Earthquake cancellation.');
  }
  const direction = effect.type === 'earthquake' && effect.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
  const required = effect.type === 'earthquake' ? earthquakePromotionPieces(state, direction) : [];
  const promotions = earthquakePromotions(required, fields ? fields.promotions : []);
  if (!promotions) return reject(state, 'INVALID_TARGET', 'Promote every qualifying Pawn, opponent first and in square order.');
  const cancelled = peaceTalksEffects(state, effect);

  const resolved = structuredClone(state);
  spendCard(resolved, 'peace-talks', cardInstanceId);
  for (const owner of ['white', 'black'] as const) {
    const coup = cancelled.find((candidate): candidate is CoupEffect => candidate.type === 'coup' && candidate.owner === owner);
    if (coup) restoreCoupPieces(resolved, coup, cancelled);
  }
  resolved.effects = resolved.effects.filter(candidate =>
    !isRetainedContinuingEffect(candidate) || !cancelled.some(removed => removed.card.id === candidate.card.id),
  );
  if (isConfabulationEffect(effect)) {
    // FAQ 18 retains pre-merge attachments, without specifying an absent component's return placement.
    for (const marker of resolved.effects) {
      if (isRetainedContinuingEffect(marker) && (marker.type === 'pacifism' || marker.type === 'crab' || marker.type === 'curse')
        && typeof marker.pieceId === 'string' && effect.pieceIds.includes(marker.pieceId)
        && resolved.pieces.some(piece => piece.id === marker.pieceId && piece.zone === 'away')) {
        marker.confabulationEnded = true;
      }
    }
  }
  refreshNeutrality(resolved);
  for (const removed of cancelled) {
    if (!(['white', 'black'] as const).some(owner =>
      ['hand', 'deck', 'discard'].some(pile =>
        resolved.players[owner][pile as keyof typeof resolved.players[typeof owner]].some(card => card.id === removed.card.id),
      )
    )) discardEffectCard(resolved, removed);
  }
  if (effect.type === 'doomsayer' && resolved.pendingDoomsayer?.cardInstanceId === effect.card.id) {
    resolved.pendingDoomsayer = null;
  }
  if (effect.type === 'earthquake') {
    resolved.orientation = earthquakeOrientation(state.orientation, direction);
    required.forEach((piece, index) => {
      const promoted = resolved.pieces.find(candidate => candidate.id === piece.id)!;
      promoted.role = promotions[index].role;
      promoted.promoted = true;
    });
    if (required.length) syncFen(resolved);
  }
  resolved.history.push({ type: 'cardPlayed', cardId: 'peace-talks', ...(fields ? { target: { effectId, promotions } } : {}) });
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

function capturedBy(state: GameState, piece: PieceState): Color | undefined {
  if (piece.capturedBy) return piece.capturedBy;
  const event = [...state.history].reverse().find(entry => entry.capturedId === piece.id || entry.capturedIds?.includes(piece.id));
  if (event?.player) return (event.copiedCardId ?? event.cardId) === 'hostage' ? opposite(event.player) : event.player;
  if (event?.type !== 'cardPlayed') return undefined;
  // Older saved states did not store capture provenance. Recover an unambiguous card actor.
  const actors = new Set(state.playedCards?.flatMap(played => {
    const player = state.players[played.player];
    return [...player.hand, ...player.deck, ...player.discard].some(card =>
      card.id === played.cardInstanceId && card.cardId === event.cardId) ? [played.player] : [];
  }));
  return actors.size === 1 ? [...actors][0] : undefined;
}

function restoreCapturedPawn(state: GameState, pawn: PieceState, to: SquareName): void {
  if (!recentlyCaptured(state, pawn)) {
    if (!pawn.promoted) pawn.role = pawn.originalRole;
    state.effects = state.effects.filter(effect => {
      if (!isCrabEffect(effect) || effect.pieceId !== pawn.id) return true;
      discardEffectCard(state, effect);
      return false;
    });
  }
  delete pawn.capturedAtPly;
  delete pawn.capturedBy;
  pawn.zone = 'board';
  pawn.square = to;
}

function playBetrayal(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const cardId = 'betrayal';
  const color = state.turn.color;
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Betrayal is played before the regular move.');
  }
  const candidate = effectRecord(target);
  if (!candidate || Object.getPrototypeOf(target) !== Object.prototype
    || Reflect.ownKeys(candidate).length !== 2
    || !Object.hasOwn(candidate, 'pieceId') || !Object.hasOwn(candidate, 'to')
    || typeof candidate.pieceId !== 'string' || typeof candidate.to !== 'string' || !SQUARE.test(candidate.to)) {
    return reject(state, 'INVALID_TARGET', 'Choose one captured Pawn and one opposing Pawn square.');
  }
  const to = candidate.to as SquareName;
  const pawn = state.pieces.find(piece => piece.id === candidate.pieceId);
  const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === to);
  if (!pawn || pawn.zone !== 'captured' || pawn.square !== null || !victim) {
    return reject(state, 'INVALID_TARGET', 'Choose a captured Pawn and an occupied square.');
  }
  if (pawn.owner !== color || (!victim.neutral && victim.owner === color)) {
    return reject(state, 'WRONG_OWNER', 'Replace an opposing Pawn with one of your captured Pawns.');
  }
  if (pawn.originalRole !== 'pawn' || pawn.promoted || !hasUnpromotedPawn(state, victim)) {
    return reject(state, 'WRONG_ROLE', 'Choose unpromoted original Pawns.');
  }
  if (pawnHomeDistance(state, color, to) > 3 || physicalPieces(state, victim).some(piece => piece.royal)
    || forbiddenCitySquares(state).has(to)) {
    return reject(state, 'INVALID_TARGET', 'Choose a nonroyal Pawn on your half of the board.');
  }
  const resolved = structuredClone(state);
  const returned = resolved.pieces.find(piece => piece.id === pawn.id)!;
  const deadIds = losePiece(resolved, resolved.pieces.find(piece => piece.id === victim.id)!, 'dead');
  restoreCapturedPawn(resolved, returned, to);
  for (const effect of resolved.effects) {
    const record = effectRecord(effect);
    if (effectKind(effect) === 'pacifism' && typeof record?.pieceId === 'string' && deadIds.includes(record.pieceId)) {
      record.pieceId = returned.id;
    }
  }
  syncFen(resolved);
  if (!isOrdinaryCheckmate(state, opposite(color)) && isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId);
  }
  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId, target: { pieceId: pawn.id, to } });
  settleBlockedBeforeMove(resolved, color);
  return { ok: true, state: resolved };
}

function playWingedVictory(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const cardId = 'winged-victory';
  const color = state.turn.color;
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Winged Victory is played instead of the regular move.');
  }
  const candidate = effectRecord(target);
  if (!candidate || Object.getPrototypeOf(target) !== Object.prototype
    || Reflect.ownKeys(candidate).length !== 2
    || !Object.hasOwn(candidate, 'pieceId') || !Object.hasOwn(candidate, 'to')
    || typeof candidate.pieceId !== 'string' || typeof candidate.to !== 'string'
    || !CENTRAL_SQUARES.includes(candidate.to as SquareName)) {
    return reject(state, 'INVALID_TARGET', 'Choose one captured Pawn and one central square.');
  }
  const to = candidate.to as SquareName;
  const pawn = state.pieces.find(piece => piece.id === candidate.pieceId);
  if (!pawn || pawn.zone !== 'captured' || pawn.square !== null) {
    return reject(state, 'INVALID_TARGET', 'Choose a captured Pawn.');
  }
  if (pawn.owner !== color) return reject(state, 'WRONG_OWNER', 'Choose one of your captured Pawns.');
  if (pawn.originalRole !== 'pawn' || pawn.promoted) return reject(state, 'WRONG_ROLE', 'Choose an unpromoted original Pawn.');
  if (capturedBy(state, pawn) === color) {
    return reject(state, 'INVALID_TARGET', 'Choose a Pawn captured by your opponent.');
  }
  if (state.pieces.some(piece => piece.zone === 'board' && piece.square === to) || forbiddenCitySquares(state).has(to)) {
    return reject(state, 'INVALID_TARGET', 'Choose an empty, unmarked central square.');
  }
  const resolved = structuredClone(state);
  const returned = resolved.pieces.find(piece => piece.id === pawn.id)!;
  restoreCapturedPawn(resolved, returned, to);
  completeReplacementMove(resolved, color, true, [], [returned]);
  const consumesMove = !isKingInCheck(state, color);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [returned])) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId, consumesMove);
  }
  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId, target: { pieceId: pawn.id, to } });
  return { ok: true, state: resolved };
}

function playResurrection(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const cardId = 'resurrection';
  const color = state.turn.color;
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Resurrection is played instead of the regular move.');
  }
  const candidate = effectRecord(target);
  if (!candidate || Object.getPrototypeOf(target) !== Object.prototype
    || Reflect.ownKeys(candidate).length !== 2
    || !Object.hasOwn(candidate, 'pieceId') || !Object.hasOwn(candidate, 'to')
    || typeof candidate.pieceId !== 'string' || typeof candidate.to !== 'string' || !SQUARE.test(candidate.to)) {
    return reject(state, 'INVALID_TARGET', 'Choose one captured piece and one starting square.');
  }
  const to = candidate.to as SquareName;
  const piece = state.pieces.find(entry => entry.id === candidate.pieceId);
  if (!piece || piece.zone !== 'captured' || piece.square !== null) {
    return reject(state, 'INVALID_TARGET', 'Choose a captured physical piece.');
  }
  if (piece.owner !== color) return reject(state, 'WRONG_OWNER', 'Choose one of your captured pieces.');
  if (piece.royal || piece.role === 'king' || piece.originalRole === 'king'
    || piece.role === 'queen' || piece.originalRole === 'queen') {
    return reject(state, 'WRONG_ROLE', 'Kings, Queens, and royal pieces cannot be resurrected.');
  }
  if (!startingSquares(state, piece.owner, piece.promoted ? piece.role : piece.originalRole).includes(to)
    || state.pieces.some(entry => entry.zone === 'board' && entry.square === to)
    || forbiddenCitySquares(state).has(to)) {
    return reject(state, 'INVALID_TARGET', 'Choose an empty, unmarked starting square for that piece.');
  }
  const resolved = structuredClone(state);
  const returned = resolved.pieces.find(entry => entry.id === piece.id)!;
  restoreCapturedPawn(resolved, returned, to);
  completeReplacementMove(resolved, color, piece.originalRole === 'pawn' && !piece.promoted, [], [returned]);
  const consumesMove = !isKingInCheck(state, color);
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (moveLeavesRoyalInCheck(resolved, color, [returned])) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId, consumesMove);
  }
  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId, target: { pieceId: piece.id, to } });
  return { ok: true, state: resolved };
}

function playPassingInTheNight(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const cardId = 'passing-in-the-night';
  const color = state.turn.color;
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Passing in the Night is played instead of the regular move.');
  }
  const pairs = parseCardMoves(target);
  if (!pairs || new Set(pairs.flatMap(pair => [pair.from, pair.to])).size !== pairs.length * 2) {
    return reject(state, 'INVALID_TARGET', 'Choose one or two pairs of distinct Pawns.');
  }
  const pawns: PieceState[] = [];
  for (const pair of pairs) {
    const own = state.pieces.find(piece => piece.zone === 'board' && piece.square === pair.from);
    const opponent = state.pieces.find(piece => piece.zone === 'board' && piece.square === pair.to);
    if (!own || !opponent) return reject(state, 'INVALID_TARGET', 'Both squares must contain Pawns.');
    if ((!own.neutral && own.owner !== color) || (!opponent.neutral && opponent.owner === color)) {
      return reject(state, 'WRONG_OWNER', 'Each pair needs one of your Pawns and one opposing Pawn.');
    }
    if (!hasUnpromotedPawn(state, own) || !hasUnpromotedPawn(state, opponent)) {
      return reject(state, 'WRONG_ROLE', 'Choose only unpromoted original Pawns.');
    }
    pawns.push(own, opponent);
  }
  const resolved = structuredClone(state);
  pairs.forEach((pair, index) => {
    resolved.pieces.find(piece => piece.id === pawns[index * 2].id)!.square = pair.to;
    resolved.pieces.find(piece => piece.id === pawns[index * 2 + 1].id)!.square = pair.from;
  });
  if (!resolveFatalAttractionSwap(state, resolved)) return reject(state, 'ILLEGAL_MOVE', 'Fatal Attraction prevents swapping that piece.');
  completeReplacementMove(resolved, color, true, [], pawns);
  const defender = opposite(color);
  const consumesMove = !isKingInCheck(state, color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, consumesMove);
  }
  if (moveLeavesRoyalInCheck(resolved, color, pawns)) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId, consumesMove);
  }
  spendCard(resolved, cardId, cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId, target: pairs });
  return { ok: true, state: resolved };
}

function manOfStrawPawn(state: GameState, piece: PieceState): boolean {
  return (piece.owner === state.turn.color || Boolean(piece.neutral))
    && hasUnpromotedPawn(state, piece)
    && !physicalPieces(state, piece).some(component => component.royal);
}

function playManOfStraw(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'man-of-straw', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Man of Straw is played before the regular move.');
  }
  const fields = effectRecord(target);
  if (!fields || Object.getPrototypeOf(target) !== Object.prototype || Reflect.ownKeys(fields).length !== 2
    || typeof fields.king !== 'string' || !SQUARE.test(fields.king)
    || typeof fields.pawn !== 'string' || !SQUARE.test(fields.pawn) || fields.king === fields.pawn) {
    return reject(state, 'INVALID_TARGET', 'Choose distinct King and Pawn squares.');
  }
  const parsedTarget: ManOfStrawTarget = { king: fields.king as SquareName, pawn: fields.pawn as SquareName };
  const king = state.pieces.find(piece => piece.zone === 'board' && piece.square === parsedTarget.king);
  const pawn = state.pieces.find(piece => piece.zone === 'board' && piece.square === parsedTarget.pawn);
  if (!king || !pawn) return reject(state, 'INVALID_TARGET', 'Both selected squares must contain pieces.');
  if (king.owner !== color || (pawn.owner !== color && !pawn.neutral)) {
    return reject(state, 'WRONG_OWNER', 'Choose your King and a Pawn you control.');
  }
  if (!king.royal || !manOfStrawPawn(state, pawn)) {
    return reject(state, 'WRONG_ROLE', 'Choose a royal King and a nonroyal unpromoted original Pawn.');
  }
  if (!isRoyalInCheck(state, king)) return reject(state, 'INVALID_TIMING', 'The selected King must be in check.');
  const forbidden = forbiddenCitySquares(state);
  if (forbidden.has(parsedTarget.king) || forbidden.has(parsedTarget.pawn)) {
    return reject(state, 'ILLEGAL_MOVE', 'Forbidden City cannot receive either piece.');
  }
  let resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === king.id)!.square = parsedTarget.pawn;
  resolved.pieces.find(piece => piece.id === pawn.id)!.square = parsedTarget.king;
  if (!resolveFatalAttractionSwap(state, resolved)) return reject(state, 'ILLEGAL_MOVE', 'Fatal Attraction prevents swapping that piece.');
  const movedPieces = [...physicalPieces(state, king), ...physicalPieces(state, pawn)];
  syncFen(resolved, movedPieces);
  resolved = expirePieceEffects({ ok: true, state: resolved }).state;
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(resolved, defender)) {
    return fizzleCard(state, 'man-of-straw', 'DIRECT_MATE', cardInstanceId);
  }
  if (moveLeavesRoyalInCheck(resolved, color, movedPieces)) {
    return fizzleCard(state, 'man-of-straw', 'SELF_CHECK', cardInstanceId);
  }
  spendCard(resolved, 'man-of-straw', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'man-of-straw', target: parsedTarget });
  return { ok: true, state: resolved };
}

function playSanctuary(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'sanctuary', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Sanctuary is played instead of the regular move.');
  }
  const fields = effectRecord(target);
  if (typeof fields?.king !== 'string' || !SQUARE.test(fields.king)
    || typeof fields.rook !== 'string' || !SQUARE.test(fields.rook) || fields.king === fields.rook) {
    return reject(state, 'INVALID_TARGET', 'Choose distinct King and Rook squares.');
  }
  const parsedTarget: SanctuaryTarget = { king: fields.king as SquareName, rook: fields.rook as SquareName };
  const king = state.pieces.find(piece => piece.zone === 'board' && piece.square === parsedTarget.king);
  const rook = state.pieces.find(piece => piece.zone === 'board' && piece.square === parsedTarget.rook);
  if (!king || !rook) return reject(state, 'INVALID_TARGET', 'Both selected squares must contain pieces.');
  if (king.owner !== color || (rook.owner !== color && !rook.neutral)) {
    return reject(state, 'WRONG_OWNER', 'Choose your King and a Rook you control.');
  }
  if (!hasRole(state, king, 'king') || !hasRole(state, rook, 'rook')) {
    return reject(state, 'WRONG_ROLE', 'Choose your royal King and a Rook.');
  }
  const source = parseSquare(parsedTarget.king);
  const rookSource = parseSquare(parsedTarget.rook);
  const fileDelta = squareFile(rookSource) - squareFile(source);
  const rankDelta = squareRank(rookSource) - squareRank(source);
  if (fileDelta !== 0 && rankDelta !== 0) return reject(state, 'ILLEGAL_MOVE', 'The King and Rook must share a rank or file.');
  const fileStep = Math.sign(fileDelta);
  const rankStep = Math.sign(rankDelta);
  const kingFile = squareFile(source) + 2 * fileStep;
  const kingRank = squareRank(source) + 2 * rankStep;
  if (kingFile < 0 || kingFile > 7 || kingRank < 0 || kingRank > 7) {
    return reject(state, 'ILLEGAL_MOVE', 'Both destinations must be on the board.');
  }
  const step = fileStep + 8 * rankStep;
  const occupied = new Set(state.pieces.filter(piece => piece.zone === 'board' && piece.square
    && piece.id !== king.id && piece.id !== rook.id).map(piece => piece.square));
  for (let square = source + step; square !== rookSource; square += step) {
    if (occupied.has(makeSquare(square))) return reject(state, 'ILLEGAL_MOVE', 'Pieces block the route between the King and Rook.');
  }
  const moves = [
    { piece: king, from: parsedTarget.king, to: makeSquare(kingRank * 8 + kingFile), jumping: true },
    { piece: rook, from: parsedTarget.rook, to: makeSquare(source + step), jumping: false },
  ].filter(move => move.from !== move.to);
  for (const move of moves) {
    if (occupied.has(move.to) || forbiddenCityBlocksMove(state, move.from, move.to, move.jumping)
      || !curseAllowsMove(state, move.piece, move.from, move.to) || !dungeonAllowsMove(state, move.piece, color, true)) {
      return reject(state, 'ILLEGAL_MOVE', 'A destination or movement restriction blocks Sanctuary.');
    }
  }
  const movedPieces = moves.flatMap(move => physicalPieces(state, move.piece));
  const resolved = structuredClone(state);
  for (const move of moves) resolved.pieces.find(piece => piece.id === move.piece.id)!.square = move.to;
  completeReplacementMove(resolved, color,
    movedPieces.some(piece => piece.originalRole === 'pawn' && !piece.promoted), [], movedPieces);
  const consumesMove = !isKingInCheck(state, color);
  return finishMovementCard(
    state, resolved, { type: 'cardPlayed', cardId: 'sanctuary', target: parsedTarget },
    cardInstanceId, movedPieces, consumesMove,
  );
}

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
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
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
  if (!resolveFatalAttractionSwap(state, resolved)) return reject(state, 'ILLEGAL_MOVE', 'Fatal Attraction prevents swapping that piece.');
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
  const error = cardPlayError(state, 'doomsayer', cardInstanceId);
  if (error) return error;
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

function playFatalAttraction(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'fatal-attraction', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Fatal Attraction is played after the regular move.');
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose a piece on the board.');
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === target);
  if (!piece) return reject(state, 'INVALID_TARGET', 'Choose a piece on the board.');
  if (piece.owner !== color && !piece.neutral) return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'fatal-attraction', cardInstanceId, false);
  resolved.effects.push({ type: 'fatal-attraction', owner: color, card, pieceId: piece.id } satisfies FatalAttractionEffect);
  if (isKingInCheck(resolved, color)) return fizzleCard(state, 'fatal-attraction', 'SELF_CHECK', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'fatal-attraction', target: target as SquareName });
  return { ok: true, state: resolved };
}

function playNeutrality(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'neutrality', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Neutrality is played after the regular move.');
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose an opposing piece.');
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === target);
  if (!piece) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (piece.owner === color && !piece.neutral) return reject(state, 'WRONG_OWNER', 'Choose an opposing piece.');
  if (physicalPieces(state, piece).some(component => component.royal || component.role === 'king'
    || component.role === 'queen' || (!component.promoted && ['king', 'queen'].includes(component.originalRole)))) {
    return reject(state, 'WRONG_ROLE', 'Kings and Queens cannot become neutral.');
  }
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'neutrality', cardInstanceId, false);
  resolved.effects.push({ type: 'neutrality', owner: color, card, pieceId: piece.id });
  refreshNeutrality(resolved);
  if (isKingInCheck(resolved, color)) return fizzleCard(state, 'neutrality', 'SELF_CHECK', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'neutrality', target: target as SquareName });
  return { ok: true, state: resolved };
}

function playPacifism(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'pacifism', cardInstanceId);
  if (error) return error;
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

function playCurse(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'curse', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Curse is played after the regular move.');
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose an opposing Queen, Bishop, or Rook.');
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === target);
  if (!piece) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (piece.owner === color && !piece.neutral) return reject(state, 'WRONG_OWNER', 'Choose an opposing piece.');
  if (!(['queen', 'bishop', 'rook'] as const).some(role => hasRole(state, piece, role))) return reject(state, 'WRONG_ROLE', 'Choose a Queen, Bishop, or Rook.');
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'curse', cardInstanceId, false);
  resolved.effects.push({ type: 'curse', owner: color, card, pieceId: piece.id } satisfies CurseEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'curse', target: target as SquareName });
  return { ok: true, state: resolved };
}

function playManTrap(state: GameState, target: unknown, cardInstanceId?: unknown, validateOnly = false): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'man-trap', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Man-Trap is played after the regular move.');
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose a square occupied by your piece.');
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === target);
  if (!piece) return reject(state, 'INVALID_TARGET', 'The target square is empty.');
  if (piece.owner !== color && !piece.neutral) return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  if (validateOnly) return { ok: true, state };
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'man-trap', cardInstanceId, false);
  resolved.effects.push({ type: 'man-trap', owner: color, card, square: target as SquareName } satisfies ManTrapEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'man-trap' });
  return { ok: true, state: resolved };
}

function playForbiddenCity(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'forbidden-city', cardInstanceId);
  if (error) return error;
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

function playFortification(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'fortification', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Fortification is played after the regular move.');
  const edge = effectRecord(target);
  if (!edge || Object.getPrototypeOf(edge) !== Object.prototype || Reflect.ownKeys(edge).length !== 2
    || !Object.hasOwn(edge, 'from') || !Object.hasOwn(edge, 'to')
    || !adjacentSquares(edge.from, edge.to)) return reject(state, 'INVALID_TARGET', 'Choose two distinct adjacent squares.');
  const from = edge!.from as SquareName;
  const to = edge!.to as SquareName;
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'fortification', cardInstanceId, false);
  resolved.effects.push({ type: 'fortification', owner: color, card, from, to } satisfies FortificationEffect);
  resolved.history.push({ type: 'cardPlayed', cardId: 'fortification', target: { from, to } });
  return { ok: true, state: resolved };
}

function playCrab(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'crab', cardInstanceId);
  if (error) return error;
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
  const error = cardPlayError(state, 'vendetta', cardInstanceId);
  if (error) return error;
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
  const error = cardPlayError(state, 'no-quarter', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'No Quarter must immediately follow your capturing move.');
  }
  if (target !== undefined) {
    return reject(state, 'INVALID_TARGET', 'No Quarter does not take a target.');
  }

  const move = hostageCaptureEvent(state);
  const captured = move?.type === 'move' && move.capturedId
    ? state.pieces.find(piece => piece.id === move.capturedId)
    : undefined;
  const mover = move?.type === 'move' && move.to
    ? state.pieces.find(piece => move.movedPieceId
      ? piece.id === move.movedPieceId
        && ((piece.zone === 'board' && piece.square === move.to)
          || (piece.zone === 'captured' && piece.square === null))
      : piece.zone === 'board' && piece.square === move.to)
    : undefined;
  // Plots preserves who made the ordinary capture even if an extra removes or moves its capturer.
  const ownCapture = state.plotsExecution
    ? state.plotsExecution.window.shieldMove?.player === color
    : mover && (mover.owner === color || mover.neutral);
  if (
    !captured
    || captured.zone !== 'captured'
    || captured.square !== null
    || (captured.owner === color && !captured.neutral)
    || !ownCapture
  ) {
    return reject(state, 'INVALID_TIMING', 'No Quarter must immediately follow your ordinary move capturing an enemy piece.');
  }

  const resolved = structuredClone(state);
  for (const id of move?.capturedIds ?? [captured.id]) {
    const piece = resolved.pieces.find(candidate => candidate.id === id);
    if (piece?.zone === 'captured') {
      piece.zone = 'dead';
      delete piece.capturedBy;
    }
  }
  spendCard(resolved, 'no-quarter', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'no-quarter' });
  return { ok: true, state: resolved };
}

function additionalMovePiece(state: GameState, role: 'knight' | 'bishop' | 'rook'): PieceState | undefined {
  const move = reactionEvent(state);
  if (move?.type !== 'move' || move.capturedId || move.capturedIds?.length) return undefined;
  const castle = role === 'rook' ? move.castlingRook : undefined;
  if (!castle && move.movedRoles && !move.movedRoles.includes(role)) return undefined;
  const pieceId = castle?.pieceId ?? move.movedPieceId;
  return state.pieces.find(piece => (!pieceId || piece.id === pieceId)
    && piece.zone === 'board' && piece.square === (castle?.to ?? move.to)
    && (piece.owner === state.turn.color || piece.neutral)
    && hasRole(state, piece, role));
}

function preserveAdditionalMoveClocks(before: GameState, next: GameState): void {
  const setup = parseFen(next.fen).unwrap();
  const previousSetup = parseFen(before.fen).unwrap();
  setup.fullmoves = previousSetup.fullmoves;
  if (setup.halfmoves > 0) setup.halfmoves = previousSetup.halfmoves;
  next.fen = makeFen(setup);
}

function playAdditionalMove(state: GameState, cardId: 'charge' | 'crusade' | 'merciless', target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const role = cardId === 'charge' ? 'knight' : cardId === 'crusade' ? 'bishop' : 'rook';
  const name = CARD_CATALOG[cardId].name;
  const error = cardPlayError(state, cardId, cardInstanceId);
  if (error) return error;
  const previous = reactionEvent(state);
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade
    || previous?.type !== 'move' || previous.capturedId || previous.capturedIds?.length) {
    return reject(state, 'INVALID_TIMING', `${name} follows a quiet regular move by your ${role}.`);
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || (cardId === 'merciless' && (Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key => key !== 'length' && key !== '0')
    || Object.getPrototypeOf((target as object[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')))) {
    return reject(state, 'INVALID_TARGET', `Choose one valid ${role} move.`);
  }
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === moves[0].from);
  if (!mover) return reject(state, 'INVALID_TARGET', 'Choose an occupied square.');
  if (mover.owner !== color && !mover.neutral) return reject(state, 'WRONG_OWNER', `Choose your ${role}.`);
  if (!hasRole(state, mover, role)) return reject(state, 'WRONG_ROLE', `${name} requires a ${role}.`);
  if (additionalMovePiece(state, role)?.id !== mover.id) {
    return reject(state, 'INVALID_TARGET', `Move the same ${role} once more.`);
  }
  const view = turnView(state, color);
  const result = movePiece(view, { type: 'move', ...moves[0] }, 'defer', false, true);
  if (!result.ok) return reject(state, result.error.code, result.error.message);
  const resolved = result.state;
  if (!isOrdinaryCheckmate(state, opposite(color)) && isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId);
  }
  if (moveLeavesRoyalInCheck(resolved, color, physicalPieces(state, mover))) {
    return fizzleCard(state, cardId, 'SELF_CHECK', cardInstanceId);
  }
  resolved.turn = structuredClone(state.turn);
  preserveAdditionalMoveClocks(state, resolved);
  spendCard(resolved, cardId, cardInstanceId);
  Object.assign(resolved.history.at(-1)!, {
    type: 'cardPlayed', cardId, target: moves, preservePreviousMove: false,
  });
  return { ok: true, state: resolved };
}

function playCoup(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'coup', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Coup is played after your move.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose a board square.');
  const king = state.pieces.find(piece => piece.zone === 'board' && piece.square === target);
  if (!king) return reject(state, 'INVALID_TARGET', 'Choose an occupied square.');
  if (king.owner !== color && !king.neutral) return reject(state, 'WRONG_OWNER', 'Choose a piece you control.');
  if (king.royal || hasRole(state, king, 'rook') || hasRole(state, king, 'queen')
    || physicalPieces(state, king).some(piece => piece.originalRole === 'king')) {
    return reject(state, 'WRONG_ROLE', 'Choose a different piece, except a Rook or Queen.');
  }
  const prince = state.pieces.find(piece => piece.owner === color && piece.royal && piece.zone === 'board' && piece.square);
  if (!prince) return reject(state, 'INVALID_TARGET', 'Your King must be on the board.');
  const resolved = structuredClone(state);
  const demoted = resolved.pieces.find(piece => piece.id === prince.id)!;
  demoted.royal = false;
  demoted.role = 'king';
  resolved.pieces.find(piece => piece.id === king.id)!.royal = true;
  refreshNeutrality(resolved);
  if (king.owner === color && moveLeavesRoyalInCheck(resolved, color, [king])) {
    return fizzleCard(state, 'coup', 'SELF_CHECK', cardInstanceId);
  }
  resolved.fen = [boardFen(resolved), ...state.fen.split(' ').slice(1)].join(' ');
  const card = spendCard(resolved, 'coup', cardInstanceId, false);
  resolved.effects.push({ type: 'coup', owner: color, card, princeId: prince.id, kingId: king.id, princeRole: prince.role });
  if (king.owner !== color) resolved.outcome = { winner: opposite(color), reason: 'surrender' };
  resolved.history.push({ type: 'cardPlayed', cardId: 'coup', target: target as SquareName });
  return { ok: true, state: resolved };
}

function playChallenge(
  state: GameState,
  target: unknown,
  cardInstanceId?: unknown,
  opponentDests = () => legalDests(turnView(state, opposite(state.turn.color)), false),
): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'challenge', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Challenge is played after your move.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose a board square.');
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === target);
  if (!piece) return reject(state, 'INVALID_TARGET', 'Choose an occupied square.');
  if (piece.owner === color && !piece.neutral) return reject(state, 'WRONG_OWNER', 'Choose an opponent piece.');
  if (piece.royal || hasRole(state, piece, 'king') || physicalPieces(state, piece).every(component =>
    component.role === 'queen' || (!component.promoted && component.originalRole === 'queen'))) {
    return reject(state, 'WRONG_ROLE', 'Challenge cannot name a King or Queen.');
  }
  if (!opponentDests().get(piece.square!)?.length) {
    return reject(state, 'INVALID_TARGET', 'The challenged piece must have a legal move.');
  }
  const resolved = structuredClone(state);
  clearChallenge(resolved, opposite(color));
  resolved.effects.push({ type: 'challenge', owner: color, player: opposite(color), pieceId: piece.id } satisfies ChallengeEffect);
  if (!isOrdinaryCheckmate(state, opposite(color)) && isOrdinaryCheckmate(resolved, opposite(color))) {
    return fizzleCard(state, 'challenge', 'DIRECT_MATE', cardInstanceId);
  }
  if (isKingInCheck(resolved, color)) return fizzleCard(state, 'challenge', 'SELF_CHECK', cardInstanceId);
  spendCard(resolved, 'challenge', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'challenge', target: target as SquareName });
  return { ok: true, state: resolved };
}

function playPanic(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'panic', cardInstanceId);
  if (error) return error;
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

function playBombard(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'bombard', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'beforeMove' || state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Bombard is played instead of the regular move.');
  }
  const moves = parseCardMoves(target, 1);
  if (!moves || moves.length !== 1
    || Object.getPrototypeOf(target) !== Array.prototype
    || Reflect.ownKeys(target as unknown[]).some(key => key !== 'length' && key !== '0')
    || Object.getPrototypeOf((target as unknown[])[0]) !== Object.prototype
    || Reflect.ownKeys((target as object[])[0]).length !== 2
    || !Object.hasOwn((target as object[])[0], 'from')
    || !Object.hasOwn((target as object[])[0], 'to')) {
    return reject(state, 'INVALID_TARGET', 'Choose exactly one plain move.');
  }
  const [move] = moves;
  const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from);
  if (!mover) return reject(state, 'INVALID_TARGET', 'Choose a piece on the board.');
  if (mover.owner !== color && !mover.neutral) return reject(state, 'WRONG_OWNER', 'Choose a Rook you control.');
  if (!hasRole(state, mover, 'rook')) return reject(state, 'WRONG_ROLE', 'Choose a Rook.');
  const source = parseSquare(move.from);
  const destination = parseSquare(move.to);
  const fileDelta = squareFile(destination) - squareFile(source);
  const rankDelta = squareRank(destination) - squareRank(source);
  if (source === destination || (fileDelta !== 0 && rankDelta !== 0)
    || !curseAllowsMove(state, mover, move.from, move.to)
    || !dungeonAllowsMove(state, mover, color, true) || !challengeAllows(state, [mover])) {
    return reject(state, 'ILLEGAL_MOVE', 'Choose an allowed straight Rook move.');
  }
  const blocked = forbiddenCitySquares(state);
  if (blocked.has(move.to)) return reject(state, 'ILLEGAL_MOVE', 'A forbidden destination cannot be jumped.');
  const walls = state.effects.filter(isFortificationEffect);
  let obstructions = 0;
  let previous = move.from;
  const step = Math.sign(rankDelta) * 8 + Math.sign(fileDelta);
  for (let square = source + step; ; square += step) {
    const next = makeSquare(square);
    if (walls.some(wall => (wall.from === previous && wall.to === next)
      || (wall.to === previous && wall.from === next))) obstructions += 1;
    if (next !== move.to && (blocked.has(next)
      || state.pieces.some(piece => piece.zone === 'board' && piece.square === next))) obstructions += 1;
    if (obstructions > 1) return reject(state, 'ILLEGAL_MOVE', 'Bombard can jump only one piece or obstruction.');
    if (next === move.to) break;
    previous = next;
  }
  const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.to);
  if (victim && ((!mover.neutral && !victim.neutral && victim.owner === mover.owner)
    || hasRole(state, victim, 'king') || captureForbidden(state, mover) || captureImmune(state, victim))) {
    return reject(state, 'ILLEGAL_MOVE', 'That piece cannot be captured.');
  }
  const components = physicalPieces(state, mover);
  const captured = victim ? physicalPieces(state, victim) : [];
  const resolved = structuredClone(state);
  resolved.pieces.find(piece => piece.id === mover.id)!.square = move.to;
  const capturedIds = victim ? losePiece(resolved, resolved.pieces.find(piece => piece.id === victim.id)!, 'captured') : [];
  completeReplacementMove(resolved, color, hasUnpromotedPawn(state, mover) || Boolean(victim), [], [...components, ...captured]);
  const consumesMove = !isKingInCheck(state, color);
  return finishMovementCard(state, resolved, {
    type: 'cardPlayed', cardId: 'bombard', target: moves, movement: moves,
    preservePreviousMove: false, ...(victim ? { capturedId: victim.id, capturedIds } : {}),
  }, cardInstanceId, components, consumesMove);
}

function playGhostwalk(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'ghostwalk', cardInstanceId);
  if (error) return error;
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
  return finishMovementCard(state, resolved, {
    type: 'cardPlayed',
    cardId: 'ghostwalk',
    target: moves,
    movement: moves,
    preservePreviousMove: false,
  }, cardInstanceId, components, !wasInCheck);
}

function playIrresistibleForce(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'irresistible-force', cardInstanceId);
  if (error) return error;
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
    if (hasRole(state, carrier, 'king')) return reject(state, 'INVALID_TARGET', 'A King cannot be pushed.');
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

  let blockedByCity = false;
  for (const carrier of chain) {
    const square = parseSquare(carrier.square!);
    const file = squareFile(square) + fileStep;
    const rank = squareRank(square) + rankStep;
    if (
      file >= 0 && file <= 7 && rank >= 0 && rank <= 7
      && forbiddenCityBlocksMove(state, carrier.square!, makeSquare(rank * 8 + file))
    ) {
      if (!forbiddenCitySquares(state).has(makeSquare(rank * 8 + file))) {
        return reject(state, 'ILLEGAL_MOVE', 'That push is blocked by Fortification.');
      }
      blockedByCity = true;
    }
  }
  const terminal = terminalOffBoard ? chain.at(-1)! : undefined;
  if (terminal && (captureForbidden(state, mover) || captureImmune(state, terminal))) {
    return reject(state, 'INVALID_TARGET', 'The last piece cannot be taken.');
  }

  const wasInCheck = isKingInCheck(state, color);
  if (blockedByCity) {
    return fizzleCard(state, 'irresistible-force', 'FORBIDDEN_CITY', cardInstanceId, !wasInCheck);
  }
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
  return finishMovementCard(state, resolved, {
    type: 'cardPlayed',
    cardId: 'irresistible-force',
    target: moves,
    ...(terminal ? { capturedId: terminal.id } : {}),
    ...(capturedIds.length > 1 ? { capturedIds } : {}),
    preservePreviousMove: false,
  }, cardInstanceId, movedPieces, !wasInCheck);
}

function playTruce(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'truce', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Truce is played after the regular move.');
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Truce does not take a target.');
  const resolved = structuredClone(state);
  const card = spendCard(resolved, 'truce', cardInstanceId, false);
  resolved.effects.push({ type: 'truce', owner: color, card });
  resolved.history.push({ type: 'cardPlayed', cardId: 'truce' });
  return { ok: true, state: resolved };
}

function playVulture(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const response = state.plotsExecution ? state.plotsExecution.window.cardResponse : state.cardResponse;
  if (!response || (!state.plotsExecution && response.historyLength !== state.history.length)) {
    return reject(state, 'INVALID_TIMING', 'Vulture immediately follows an opponent card.');
  }
  const color = opposite(response.player);
  const error = cardPlayError(state, 'vulture', cardInstanceId, color);
  if (error) return error;
  if (target !== undefined) return reject(state, 'INVALID_TARGET', 'Vulture does not take a target.');
  const discard = state.players[response.player].discard;
  const played = state.playedCards?.slice().reverse().find(entry => entry.player === response.player);
  const discarded = discard.find(card => card.id === played?.cardInstanceId);
  const retained = state.effects.find((effect): effect is RetainedEffect =>
    isRetainedContinuingEffect(effect) && effect.owner === response.player
      && !effect.card.proxy && effect.card.id === played?.cardInstanceId);
  const taken = discarded ?? retained?.card;
  if (!taken) return reject(state, 'INVALID_TARGET', 'There is no eligible played card to take.');
  const resolved = structuredClone(state);
  if (discarded) {
    resolved.players[response.player].discard = resolved.players[response.player].discard.filter(card => card.id !== taken.id);
  } else {
    // FAQ 50: the card changes hands; its independently cancelable proxy stays in play.
    const effect = resolved.effects[state.effects.indexOf(retained!)] as RetainedEffect;
    effect.card = { ...taken, id: `vulture-proxy-${state.history.length}-${taken.id}`, proxy: true };
    if (resolved.pendingDoomsayer?.cardInstanceId === taken.id) {
      resolved.pendingDoomsayer.cardInstanceId = effect.card.id;
    }
  }
  const player = resolved.players[color];
  const cost = player.deck.shift();
  if (cost) player.discard.push(cost);
  spendCard(resolved, 'vulture', cardInstanceId, true, color);
  player.hand.push(structuredClone(taken));
  resolved.history.push({ type: 'cardPlayed', cardId: 'vulture', player: color });
  return { ok: true, state: resolved };
}

function hauntingCopy(state: GameState, cardInstanceId?: unknown, target?: unknown) {
  const previous = [...state.history].reverse().find(event => event.type === 'cardPlayed' || event.type === 'cardFizzled');
  const cardId = previous?.copiedCardId ?? previous?.cardId;
  if (!cardId || cardId === 'haunting-memories' || !Object.hasOwn(CARD_CATALOG, cardId)) return undefined;
  const legacyOwner = cardId === 'legacy' ? (['white', 'black'] as const).find(player =>
    state.players[player].discard.some(card => card.id === target)
      || (target === undefined && state.players[player].hand.some(card => card.cardId === 'haunting-memories'
        && (cardInstanceId === undefined || card.id === cardInstanceId)))) : undefined;
  const color = legacyOwner ?? ((cardId === 'vulture' || cardId === 'hostage' || cardId === 'fog-of-war') && state.cardResponse
    ? opposite(state.cardResponse.player)
    : ['bog', 'revenge', 'toll', 'chaos', 'knightmare', 'think-again', 'riposte'].includes(cardId) ? opposite(state.turn.color) : state.turn.color);
  const card = state.players[color].hand.find(candidate => candidate.cardId === 'haunting-memories'
    && (cardInstanceId === undefined || candidate.id === cardInstanceId));
  if (!card) return undefined;
  const played = state.playedCards?.at(-1);
  const deckOwner = previous?.deckOwner ?? (played?.cardInstanceId.startsWith('white-') ? 'white'
    : played?.cardInstanceId.startsWith('black-') ? 'black' : previous?.player ?? played?.player);
  if (CARD_CATALOG[cardId].unique && deckOwner === color) return undefined;
  const substituted = structuredClone(state);
  substituted.players[color].hand.find(candidate => candidate.id === card.id)!.cardId = cardId;
  return { substituted, cardId, card, color, deckOwner };
}

function playHauntingMemories(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const copy = hauntingCopy(state, cardInstanceId, target);
  if (!copy) return reject(state, 'INVALID_TARGET', 'There is no eligible last card to copy.');
  const result = playCard(copy.substituted, copy.cardId, target, copy.card.id);
  if (!result.ok) return { ...result, state };
  for (const color of ['white', 'black'] as const) {
    for (const zone of ['hand', 'deck', 'discard'] as const) {
      result.state.players[color][zone] = result.state.players[color][zone].map(card =>
        card.id === copy.card.id ? structuredClone(copy.card) : card);
    }
  }
  for (const effect of result.state.effects) {
    const record = effectRecord(effect);
    if (effectRecord(record?.card)?.id === copy.card.id) record!.card = structuredClone(copy.card);
  }
  const event = result.state.history.at(-1)!;
  event.cardId = 'haunting-memories';
  event.copiedCardId = copy.cardId;
  event.player = copy.color;
  if (CARD_CATALOG[copy.cardId].unique && copy.deckOwner) event.deckOwner = copy.deckOwner;
  return result;
}

function mysticShieldPieces(state: GameState): PieceState[] {
  const move = state.plotsExecution ? state.plotsExecution.window.shieldMove : state.shieldMove;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade || move?.player !== state.turn.color) return [];
  return [...new Map(move.pieceIds.flatMap(id => {
    const piece = boardCarrier(state, id);
    return piece ? [[piece.id, piece] as const] : [];
  })).values()];
}

function fireballPieces(state: GameState): PieceState[] {
  const move = state.plotsExecution ? state.plotsExecution.window.shieldMove : state.shieldMove;
  if (!move || move.capturedOpponent !== false) return [];
  return mysticShieldPieces(state).filter(piece =>
    !physicalPieces(state, piece).some(component => component.royal || component.role === 'king') && !captureImmune(state, piece));
}

function explodeFireball(state: GameState, center: PieceState): { state: GameState; capturedIds: string[] } {
  const square = parseSquare(center.square!)!;
  const victims = state.pieces.filter(piece => piece.zone === 'board' && piece.square
    && Math.abs(squareFile(parseSquare(piece.square)!) - squareFile(square)) <= 1
    && Math.abs(squareRank(parseSquare(piece.square)!) - squareRank(square)) <= 1
    && !physicalPieces(state, piece).some(component => component.royal || component.role === 'king')
    && !captureImmune(state, piece));
  const removed = victims.flatMap(piece => physicalPieces(state, piece));
  const resolved = structuredClone(state);
  const capturedIds = victims.flatMap(piece =>
    losePiece(resolved, resolved.pieces.find(candidate => candidate.id === piece.id)!, 'captured'));
  syncFen(resolved, removed);
  const setup = parseFen(resolved.fen).unwrap();
  setup.halfmoves = 0;
  resolved.fen = makeFen(setup);
  const result: ApplyResult = { ok: true, state: resolved };
  expirePieceEffects(result);
  return { state: result.state, capturedIds };
}

function playFireball(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'fireball', cardInstanceId);
  if (error) return error;
  const move = state.plotsExecution ? state.plotsExecution.window.shieldMove : state.shieldMove;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade || move?.player !== color
    || move.capturedOpponent !== false) {
    return reject(state, 'INVALID_TIMING', 'Fireball follows a move without an opposing capture.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose one occupied square.');
  const center = fireballPieces(state).find(piece => piece.square === target);
  if (!center) return reject(state, 'INVALID_TARGET', 'Choose an unprotected piece you just moved, except a King or Prince.');
  const explosion = explodeFireball(state, center);
  const result: ApplyResult = { ok: true, state: explosion.state };
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(turnView(state, defender), defender)
    && isOrdinaryCheckmate(turnView(result.state, defender), defender)) {
    return fizzleCard(state, 'fireball', 'DIRECT_MATE', cardInstanceId);
  }
  if (isKingInCheck(result.state, color)) return fizzleCard(state, 'fireball', 'SELF_CHECK', cardInstanceId);
  spendCard(result.state, 'fireball', cardInstanceId);
  result.state.history.push({ type: 'cardPlayed', cardId: 'fireball', target: center.square!, capturedIds: explosion.capturedIds, player: color });
  return result;
}

function playMysticShield(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const color = state.turn.color;
  const error = cardPlayError(state, 'mystic-shield', cardInstanceId);
  if (error) return error;
  if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) {
    return reject(state, 'INVALID_TIMING', 'Mystic Shield follows your move.');
  }
  if (typeof target !== 'string' || !SQUARE.test(target)) return reject(state, 'INVALID_TARGET', 'Choose one occupied square.');
  const piece = mysticShieldPieces(state).find(candidate => candidate.square === target);
  if (!piece) return reject(state, 'INVALID_TARGET', 'Choose a piece you just moved.');
  const move = state.plotsExecution ? state.plotsExecution.window.shieldMove : state.shieldMove;
  const pieceId = physicalPieces(state, piece).find(component => move!.pieceIds.includes(component.id))!.id;
  const resolved = structuredClone(state);
  resolved.effects.push({ type: 'mystic-shield', owner: color, player: color, pieceId });
  const defender = opposite(color);
  if (!isOrdinaryCheckmate(turnView(state, defender), defender)
    && isOrdinaryCheckmate(turnView(resolved, defender), defender)) {
    return fizzleCard(state, 'mystic-shield', 'DIRECT_MATE', cardInstanceId);
  }
  spendCard(resolved, 'mystic-shield', cardInstanceId);
  resolved.history.push({ type: 'cardPlayed', cardId: 'mystic-shield', target: piece.square!, player: color });
  return { ok: true, state: resolved };
}

function playChaos(state: GameState, target: unknown, cardInstanceId?: unknown, cardId = 'chaos'): ApplyResult {
  const player = opposite(state.turn.color);
  if ((cardInstanceId !== undefined && typeof cardInstanceId !== 'string')
    || !state.players[player].hand.some(card => card.cardId === cardId
      && (cardInstanceId === undefined || card.id === cardInstanceId))) {
    return reject(state, 'CARD_NOT_IN_HAND', `${CARD_CATALOG[cardId].name} is not in your hand.`);
  }
  if (cardAllowanceUsed(state, player)) return reject(state, 'CARD_ALREADY_PLAYED', 'The card allowance is already used.');
  // The existing card snapshot still holds the real move before an optional card.
  const afterCard = state.plotsExecution?.window.fogCheckpoint ?? state.fogCheckpoint;
  const optionalMove = afterCard?.player === state.turn.color && afterCard.before.turn.moveMade
    && afterCard.before.chaosCheckpoint?.historyLength === afterCard.before.history.length
    && state.history.slice(afterCard.historyLength).every(event =>
      (event.copiedCardId ?? event.cardId) === 'plots-within-plots')
    && !['plots-within-plots', 'fog-of-war'].includes(state.history[afterCard.historyLength - 1]?.copiedCardId
      ?? state.history[afterCard.historyLength - 1]?.cardId ?? '')
    ? afterCard.before.chaosCheckpoint : undefined;
  const checkpoint = state.chaosCheckpoint ?? (optionalMove && {
    ...optionalMove, card: optionalMove.card ?? afterCard!.card, historyLength: afterCard!.historyLength,
  });
  const optional = !state.chaosCheckpoint && optionalMove && !optionalMove.card ? afterCard!.before : undefined;
  if (!checkpoint || state.turn.phase !== 'afterMove' || !state.turn.moveMade || state.pendingRescue
    || (!state.plotsExecution && checkpoint.historyLength !== state.history.length)) {
    return reject(state, 'INVALID_TIMING', `${CARD_CATALOG[cardId].name} immediately follows an opposing move.`);
  }
  const choice = effectRecord(target);
  if (target !== undefined && (!choice || Object.getPrototypeOf(target) !== Object.prototype
    || Reflect.ownKeys(choice).length !== 1 || !Object.hasOwn(choice, 'returnCard')
    || typeof choice.returnCard !== 'boolean')) {
    return reject(state, 'INVALID_TARGET', 'Choose whether to return the responsible card.');
  }
  const resolved = structuredClone(checkpoint.before);
  // The responding player's independent cards, including Plots, survive the rollback.
  resolved.players[player] = structuredClone(state.players[player]);
  resolved.turn.cardPlays[player] = state.turn.cardPlays[player];
  resolved.playedCards = [
    ...(resolved.playedCards ?? []),
    ...(state.playedCards ?? []).slice(checkpoint.before.playedCards?.length ?? 0)
      .filter(card => card.player === player),
  ];
  const reactorAllowances = (state.plotsAllowances ?? []).filter(allowance => allowance.player === player);
  resolved.plotsAllowances = [
    ...(resolved.plotsAllowances ?? []).filter(allowance => allowance.player !== player),
    ...structuredClone(reactorAllowances),
  ];
  if (state.plotsExecution) {
    resolved.plotsExecution = structuredClone(state.plotsExecution);
    if (resolved.plotsExecution.allowanceIndex !== undefined) {
      resolved.plotsExecution.allowanceIndex = resolved.plotsAllowances.length - reactorAllowances.length
        + (state.plotsAllowances ?? []).slice(0, state.plotsExecution.allowanceIndex)
          .filter(allowance => allowance.player === player).length;
    }
  }
  if (optional && choice?.returnCard === false) {
    // FAQ p.37 cancels the move, not an optional card the mover chooses to keep.
    const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
    resolved.orientation = state.orientation;
    resolved.pendingDoomsayer = structuredClone(state.pendingDoomsayer);
    if (optional.orientation !== state.orientation || !same(optional.enPassant, state.enPassant)) {
      resolved.enPassant = structuredClone(state.enPassant);
    }
    resolved.effects = [
      ...resolved.effects.filter(effect => !optional.effects.some(previous => same(previous, effect))
        || state.effects.some(current => same(current, effect))),
      ...structuredClone(state.effects.filter(effect => !optional.effects.some(previous => same(previous, effect)))),
    ];
    for (const piece of resolved.pieces) {
      const previous = optional.pieces.find(candidate => candidate.id === piece.id);
      const current = state.pieces.find(candidate => candidate.id === piece.id);
      if (!previous || !current) continue;
      for (const key of new Set([...Object.keys(previous), ...Object.keys(current)]) as Set<keyof PieceState>) {
        if (same(previous[key], current[key])) continue;
        if (Object.hasOwn(current, key)) Object.assign(piece, { [key]: structuredClone(current[key]) });
        else Reflect.deleteProperty(piece, key);
      }
    }
    resolved.players[state.turn.color] = structuredClone(state.players[state.turn.color]);
    resolved.turn.cardPlays[state.turn.color] = state.turn.cardPlays[state.turn.color];
    resolved.playedCards.push(...structuredClone((state.playedCards ?? [])
      .slice(checkpoint.before.playedCards?.length ?? 0).filter(card => card.player === state.turn.color)));
    syncFen(resolved);
  } else if (checkpoint.card && choice?.returnCard === false) {
    const execution = resolved.plotsExecution;
    delete resolved.plotsExecution;
    const allowanceIndex = resolved.plotsAllowances.map((allowance, index) => ({ allowance, index })).reverse()
      .find(({ allowance }) => allowance.player === state.turn.color && allowance.remaining > 0
        && allowance.eligibleCards.includes(checkpoint.card!.id))?.index ?? -1;
    if (allowanceIndex >= 0) resolved.plotsExecution = {
      player: state.turn.color, allowanceIndex, window: resolved.plotsAllowances[allowanceIndex].window,
    };
    spendCard(resolved, checkpoint.card.cardId, checkpoint.card.id, true, state.turn.color);
    resolved.plotsExecution = execution;
  }
  for (const effect of resolved.effects) {
    const card = effectRecord(effectRecord(effect)?.card);
    if (typeof card?.id === 'string') resolved.players[player].discard = resolved.players[player].discard
      .filter(candidate => candidate.id !== card.id);
  }
  resolved.history.push(...state.history.slice(checkpoint.historyLength)
    .filter(event => event.player === player));
  resolved.turn.phase = 'beforeMove';
  resolved.turn.moveMade = false;
  resolved.outcome = null;
  const canceledMove = state.chaosCheckpoint ? state : afterCard!.before;
  resolved.chaosForbidden = { player: state.turn.color, movement: chaosMovement(checkpoint.before, canceledMove, true) };
  const canceledEvent = canceledMove.history[(canceledMove.chaosCheckpoint?.historyLength ?? checkpoint.historyLength) - 1];
  if (['charge', 'crusade', 'merciless'].includes(canceledEvent?.copiedCardId ?? canceledEvent?.cardId ?? '')
    || checkpoint.before.chaosForbidden?.additionalMove) {
    // Replacing an extra movement keeps the first Regular Move's clock advancement.
    resolved.chaosForbidden.additionalMove = true;
  }
  delete resolved.chaosCheckpoint;
  if (isOrdinaryCheckmate(resolved, state.turn.color)
    && !isOrdinaryCheckmate(state, state.turn.color)) {
    return fizzleCard(state, cardId, 'DIRECT_MATE', cardInstanceId, false, player);
  }
  spendCard(resolved, cardId, cardInstanceId, true, player);
  resolved.history.push({ type: 'cardPlayed', cardId, player });
  return { ok: true, state: resolved };
}

function fogCheckpoints(state: GameState): NonNullable<GameState['fogCheckpoint']>[] {
  let checkpoint = state.plotsExecution?.window.fogCheckpoint ?? state.fogCheckpoint;
  if (!checkpoint || (!state.plotsExecution && checkpoint.historyLength !== state.history.length)) return [];
  const checkpoints = [];
  while (checkpoint) {
    checkpoints.push(checkpoint);
    checkpoint = checkpoint.plots?.previous;
  }
  return checkpoints;
}

function playFogOfWar(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const checkpoints = fogCheckpoints(state);
  const canceledCards = checkpoints[0]?.canceledCards ?? [];
  const available = checkpoints.filter(candidate => !canceledCards.includes(candidate.card.id));
  const selected = target === undefined ? available[0]
    : checkpoints.length > 1 ? available.find(candidate => candidate.card.id === target) : undefined;
  if (target !== undefined && !selected) return reject(state, 'INVALID_TARGET', 'Choose a physical card in the live Plots sequence.');
  if (!selected || canceledCards.includes(checkpoints.at(-1)!.card.id)) {
    return reject(state, 'INVALID_TIMING', 'Fog of War immediately follows an opposing card.');
  }
  const canceled = [...canceledCards, selected.card.id];
  const checkpoint = [...checkpoints].reverse().find(candidate => canceled.includes(candidate.card.id))!;
  const player = opposite(checkpoint.player);
  const card = state.players[player].hand.find(candidate => candidate.cardId === 'fog-of-war'
    && (cardInstanceId === undefined || candidate.id === cardInstanceId));
  if (!card || (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Fog of War is not in your hand.');
  }
  if (cardAllowanceUsed(state, player)) return reject(state, 'CARD_ALREADY_PLAYED', 'The card allowance is already used.');
  const pending = checkpoint.before.pendingRescue;
  const undoMove = Boolean(pending && isKingInCheck(checkpoint.before, checkpoint.before.turn.color));
  let resolved = structuredClone(undoMove && pending?.before ? pending.before : checkpoint.before);
  delete resolved.plotsExecution;
  const spendIndependent = (source: GameState, entry: NonNullable<GameState['playedCards']>[number]) => {
    const cards = resolved.players[entry.player];
    const independent = cards.hand.find(candidate => candidate.id === entry.cardInstanceId);
    if (!independent) return;
    // Unplayed deck cards in this responder's discard are Vulture costs, including copies.
    // Preserve them before the next ordinary draw; the canceled player's costs stay undone.
    const played = new Set(source.playedCards?.map(card => card.cardInstanceId));
    while (cards.deck[0] && !played.has(cards.deck[0].id)
      && source.players[entry.player].discard.some(card => card.id === cards.deck[0].id)) {
      cards.discard.push(cards.deck.shift()!);
    }
    spendCard(resolved, independent.cardId, independent.id, true, entry.player);
  };
  for (const entry of (checkpoint.before.playedCards ?? []).slice(resolved.playedCards?.length ?? 0)) {
    spendIndependent(checkpoint.before, entry);
  }
  const spendCanceled = (entry: NonNullable<GameState['fogCheckpoint']>) => {
    if (entry.plots && !undoMove) {
      const allowanceIndex = entry.plots.allowanceIndex;
      resolved.plotsExecution = { player: entry.player, allowanceIndex,
        window: resolved.plotsAllowances![allowanceIndex].window };
    }
    spendCard(resolved, entry.card.cardId, entry.card.id, true, entry.player);
    delete resolved.plotsExecution;
  };
  spendCanceled(checkpoint);
  // FAQ p.52 commits the third physical card; execute it again only if its target is still legal.
  const subsequent = checkpoints.slice(0, checkpoints.indexOf(checkpoint)).reverse();
  let replayed = 0;
  if (checkpoint.plots && !undoMove) {
    resolved.history.push(...structuredClone(state.history.slice(checkpoint.before.history.length, checkpoint.historyLength)));
    for (const later of subsequent) {
      if (!later.action) break;
      if (canceled.includes(later.card.id)) {
        spendCanceled(later);
        resolved.history.push(...structuredClone(state.history.slice(later.before.history.length, later.historyLength)));
        replayed += 1;
        continue;
      }
      let result = applyAction(resolved, later.action);
      for (const response of later.responses ?? []) {
        if (result.ok) result = applyAction(result.state, response);
      }
      if (!result.ok) {
        const allowance = resolved.plotsAllowances?.[later.plots!.allowanceIndex];
        if (allowance) allowance.eligibleCards = [later.card.id];
        break;
      }
      resolved = result.state;
      replayed += 1;
    }
  }
  // Reapply independent response expenditures without retaining the canceled card's transfers or costs.
  const laterPlays = (state.playedCards ?? []).slice((checkpoint.before.playedCards?.length ?? 0) + 1)
    .filter(entry => entry.player === player);
  for (const entry of laterPlays) {
    spendIndependent(state, entry);
  }
  const allowances = (state.plotsAllowances ?? []).filter(allowance => allowance.player === player);
  resolved.plotsAllowances = [
    ...(resolved.plotsAllowances ?? []).filter(allowance => allowance.player !== player),
    ...structuredClone(allowances),
  ];
  if (state.plotsExecution?.player === player) {
    resolved.plotsExecution = structuredClone(state.plotsExecution);
    if (state.plotsExecution.allowanceIndex !== undefined) {
      resolved.plotsExecution.allowanceIndex = resolved.plotsAllowances.length - allowances.length
        + (state.plotsAllowances ?? []).slice(0, state.plotsExecution.allowanceIndex)
          .filter(allowance => allowance.player === player).length;
    }
  }
  // Each reaction allowance retains the same live trio, including prior cancellations.
  for (const allowance of resolved.plotsAllowances) {
    const saved = allowance.window.fogCheckpoint;
    if (saved?.card.id === checkpoints[0].card.id && saved.historyLength === checkpoints[0].historyLength) {
      saved.canceledCards = canceled;
    }
  }
  if (resolved.plotsExecution?.window.fogCheckpoint) {
    resolved.plotsExecution.window.fogCheckpoint.canceledCards = canceled;
  }
  resolved.history = structuredClone(state.history.slice(0,
    subsequent.length > replayed ? (subsequent[replayed].before.history.length) : state.history.length));
  resolved.fogLocked = [...new Set([...(state.fogLocked ?? []), ...(!checkpoint.plots ? [checkpoint.player] : [])])];
  if (pending && undoMove) {
    resolved.fen = pending.fen;
    resolved.pieces = structuredClone(pending.pieces);
    resolved.enPassant = structuredClone(pending.enPassant);
    resolved.history = [
      ...structuredClone(pending.history ?? resolved.history.slice(0, pending.historyLength)),
      ...resolved.history.slice(pending.historyLength).filter(event => event.type === 'cardPlayed' || event.type === 'cardFizzled'),
    ];
    resolved.turn.phase = 'beforeMove';
    resolved.turn.moveMade = false;
    resolved.pendingRescue = null;
    resolved.fogLocked = ['white', 'black'];
    delete resolved.shieldMove;
    delete resolved.chaosCheckpoint;
  }
  if (isKingInCheck(resolved, resolved.turn.color)) resolved.fogLocked = ['white', 'black'];
  resolved.outcome = null;
  // Haunting Memories can substitute Fog's identity only in the current hand.
  const counter = resolved.players[player].hand.find(candidate => candidate.id === card.id);
  if (!counter) return reject(state, 'CARD_NOT_IN_HAND', 'The countering card is unavailable after cancellation.');
  counter.cardId = 'fog-of-war';
  spendCard(resolved, 'fog-of-war', card.id, true, player);
  resolved.history.push({ type: 'cardPlayed', cardId: 'fog-of-war', player });
  settleBlockedBeforeMove(resolved, resolved.turn.color);
  return { ok: true, state: resolved };
}

function playCardUnchecked(state: GameState, cardId: string, target: unknown, cardInstanceId?: unknown): ApplyResult {
  if (cardId === 'fireball') return playFireball(state, target, cardInstanceId);
  if (cardId === 'fog-of-war') return playFogOfWar(state, target, cardInstanceId);
  if (cardId === 'chaos' || cardId === 'knightmare' || cardId === 'think-again') return playChaos(state, target, cardInstanceId, cardId);
  if (cardId === 'neutrality') return playNeutrality(state, target, cardInstanceId);
  if (cardId === 'mystic-shield') return playMysticShield(state, target, cardInstanceId);
  if (cardId === 'man-of-straw') return playManOfStraw(state, target, cardInstanceId);
  if (cardId === 'plots-within-plots') return playPlotsWithinPlots(state, target, cardInstanceId);
  if (cardId === 'fatal-attraction') return playFatalAttraction(state, target, cardInstanceId);
  if (cardId === 'bombard') return playBombard(state, target, cardInstanceId);
  if (cardId === 'abduction') return playAbduction(state, target, cardInstanceId);
  if (cardId === 'hidden-passage') return playHiddenPassage(state, target, cardInstanceId);
  if (cardId === 'under-elf-hill') return playUnderElfHill(state, target, cardInstanceId);
  if (cardId === 'split-knight') return playSplitKnight(state, target, cardInstanceId);
  if (cardId === 'evil-eye') return playEvilEye(state, target, cardInstanceId);
  if (cardId === 'sanctuary') return playSanctuary(state, target, cardInstanceId);
  if (cardId === 'dungeon') return playDungeon(state, target, cardInstanceId);
  if (cardId === 'betrayal') return playBetrayal(state, target, cardInstanceId);
  if (cardId === 'winged-victory') return playWingedVictory(state, target, cardInstanceId);
  if (cardId === 'resurrection') return playResurrection(state, target, cardInstanceId);
  if (cardId === 'passing-in-the-night') return playPassingInTheNight(state, target, cardInstanceId);
  if (cardId === 'man-trap') return playManTrap(state, target, cardInstanceId);
  if (cardId === 'curse') return playCurse(state, target, cardInstanceId);
  if (cardId === 'coup') return playCoup(state, target, cardInstanceId);
  if (cardId === 'charge' || cardId === 'crusade' || cardId === 'merciless') return playAdditionalMove(state, cardId, target, cardInstanceId);
  if (cardId === 'challenge') return playChallenge(state, target, cardInstanceId);
  if (cardId === 'vulture') return playVulture(state, target, cardInstanceId);
  if (cardId === 'truce') return playTruce(state, target, cardInstanceId);
  if (cardId === 'ghostwalk') return playGhostwalk(state, target, cardInstanceId);
  if (cardId === 'irresistible-force') return playIrresistibleForce(state, target, cardInstanceId);
  if (cardId === 'confabulation') return playConfabulation(state, target, cardInstanceId);
  if (cardId === 'bog') return playBog(state, target, cardInstanceId);
  if (cardId === 'revenge') return playRevenge(state, target, cardInstanceId);
  if (cardId === 'hostage') return playHostage(state, target, cardInstanceId);
  if (cardId === 'toll') return playToll(state, target, cardInstanceId);
  if (cardId === 'assassin') return playAssassin(state, target, cardInstanceId);
  if (cardId === 'dark-mirror') return playDarkMirror(state, target, cardInstanceId);
  if (cardId === 'breakthrough') return playDarkMirror(state, target, cardInstanceId, cardId);
  if (cardId === 'forbidden-city') return playForbiddenCity(state, target, cardInstanceId);
  if (cardId === 'fortification') return playFortification(state, target, cardInstanceId);
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

function plotsPlayer(state: GameState, target: unknown): Color | undefined {
  if (target === undefined) return state.turn.color;
  const record = effectRecord(target);
  return record && Object.getPrototypeOf(target) === Object.prototype
    && Reflect.ownKeys(record).length === 1 && Object.hasOwn(record, 'player')
    && (record.player === 'white' || record.player === 'black') ? record.player : undefined;
}

function plotsWindow(state: GameState): NonNullable<GameState['plotsAllowances']>[number]['window'] {
  const revengePawnIds = revengePawns(state)
    .filter(piece => piece.owner !== opposite(state.turn.color) && !piece.neutral).map(piece => piece.id);
  const doppelgangerPieceId = ((['white', 'black'] as const).some(player =>
    state.players[player].hand.some(card => card.cardId === 'doppelganger'))
    || hauntingCopy(state)?.cardId === 'doppelganger') ? doppelgangerCopy(state)?.id : undefined;
  return structuredClone(state.plotsExecution?.window ?? {
    phase: state.turn.phase,
    moveMade: state.turn.moveMade,
    shieldMove: state.shieldMove,
    reaction: reactionEvent(state),
    ...(doppelgangerPieceId ? { doppelgangerPieceId } : {}),
    ...(revengePawnIds.length ? { revengePawnIds } : {}),
    capture: hostageCaptureEvent(state),
    legacyCapture: state.legacyCapture?.historyLength === state.history.length ? state.legacyCapture : undefined,
    cardResponse: state.cardResponse?.historyLength === state.history.length ? state.cardResponse : undefined,
    fogCheckpoint: state.fogCheckpoint?.historyLength === state.history.length ? state.fogCheckpoint : undefined,
  });
}

function plotsView(state: GameState, player: Color, window: ReturnType<typeof plotsWindow>, allowanceIndex?: number): GameState {
  return {
    ...state,
    turn: { ...state.turn, phase: window.phase, moveMade: window.moveMade },
    plotsExecution: { player, window, allowanceIndex },
  };
}

function canOpenPlots(state: GameState, player: Color): boolean {
  const window = plotsWindow(state);
  return !state.outcome && !state.pendingAbduction && !state.pendingDoomsayer && !pendingElfReturn(state)
    && !cardAllowanceUsed(state, player)
    && (player === state.turn.color
      || (window.cardResponse && window.cardResponse.player !== player)
      || (window.phase === 'afterMove' && window.moveMade
        && (window.reaction?.type === 'move' || Boolean(window.reaction?.movement?.length))));
}

function playPlotsWithinPlots(state: GameState, target: unknown, cardInstanceId?: unknown): ApplyResult {
  const player = plotsPlayer(state, target);
  if (!player) return reject(state, 'INVALID_TARGET', 'Choose a player or omit the target.');
  const card = state.players[player].hand.find(candidate => candidate.cardId === 'plots-within-plots'
    && (cardInstanceId === undefined || candidate.id === cardInstanceId));
  if (!card || (cardInstanceId !== undefined && typeof cardInstanceId !== 'string')) {
    return reject(state, 'CARD_NOT_IN_HAND', 'Plots Within Plots is not in your hand.');
  }
  if (cardAllowanceUsed(state, player)) return reject(state, 'CARD_ALREADY_PLAYED', 'The card allowance is already used.');
  if (!canOpenPlots(state, player)) return reject(state, 'INVALID_TIMING', 'There is no available card window.');
  const window = plotsWindow(state);
  const eligible = plotsView(state, player, window);
  const eligibleCards = state.players[player].hand.filter(candidate => {
    if (candidate.id === card.id) return false;
    if (candidate.cardId === 'plots-within-plots') return true;
    if (candidate.cardId === 'haunting-memories' && hauntingCopy(eligible, candidate.id)?.cardId === 'plots-within-plots') return true;
    return cardPlayTargetsUnchecked(eligible, candidate.cardId).some(choice => {
      const result = playCardCore(eligible, candidate.cardId, choice, candidate.id);
      return result.ok && result.state.playedCards?.at(-1)?.player === player;
    });
  }).map(candidate => candidate.id);
  const resolved = structuredClone(state);
  spendCard(resolved, 'plots-within-plots', card.id, true, player);
  (resolved.plotsAllowances ??= []).push({ player, remaining: 2, eligibleCards, window });
  resolved.history.push({ type: 'cardPlayed', cardId: 'plots-within-plots', player, preservePreviousMove: true });
  return { ok: true, state: resolved };
}

function playCard(state: GameState, cardId: string, target: unknown, cardInstanceId?: unknown): ApplyResult {
  if (state.plotsExecution) return playCardCore(state, cardId, target, cardInstanceId);
  const eligible = (state.plotsAllowances ?? []).map((allowance, index) => ({ allowance, index })).reverse();
  for (const { allowance, index } of eligible) {
    if (allowance.remaining <= 0) continue;
    if (cardId === 'plots-within-plots' && plotsPlayer(state, target) !== allowance.player) continue;
    const card = state.players[allowance.player].hand.find(candidate => candidate.cardId === cardId
      && (cardInstanceId === undefined || candidate.id === cardInstanceId) && allowance.eligibleCards.includes(candidate.id));
    if (!card) continue;
    if (state.pendingDoomsayer && cardId !== 'fog-of-war') return reject(state, 'INVALID_TIMING', 'Resolve the immediate choice first.');
    const view = plotsView(state, allowance.player, allowance.window, index);
    const result = playCardCore(view, cardId, target, card.id);
    if (!result.ok) return { ...result, state };
    if (result.state.playedCards?.at(-1)?.player !== allowance.player) {
      return reject(state, 'WRONG_OWNER', 'The additional play belongs to the Plots player.');
    }
    if (state.turn.moveMade && !['chaos', 'knightmare', 'think-again', 'fog-of-war'].includes(result.state.history.at(-1)?.copiedCardId ?? result.state.history.at(-1)?.cardId ?? '')) {
      result.state.turn.moveMade = true;
      result.state.turn.phase = 'afterMove';
    }
    delete result.state.plotsExecution;
    return result;
  }
  return playCardCore(state, cardId, target, cardInstanceId);
}

function playCardCore(state: GameState, cardId: string, target: unknown, cardInstanceId?: unknown): ApplyResult {
  if (state.riposteSkipped === state.turn.color && (['charge', 'crusade', 'merciless'].includes(cardId)
    || CARD_CATALOG[cardId]?.timing.length === 1 && CARD_CATALOG[cardId].timing[0] === 'beforeMove')) {
    return reject(state, 'INVALID_TIMING', 'The forfeited regular move cannot be replaced or extended.');
  }
  if (cardId === 'riposte') return playRiposte(state, target, cardInstanceId);
  if (cardId === 'legacy') return playLegacy(state, target, cardInstanceId);
  if (cardId === 'fog-of-war') return playFogOfWar(state, target, cardInstanceId);
  if (pendingElfReturn(state)) return reject(state, 'INVALID_TIMING', 'Return your King before playing a card.');
  if (cardId === 'haunting-memories') return playHauntingMemories(state, target, cardInstanceId);
  if (cardId === 'chaos' || cardId === 'knightmare' || cardId === 'think-again') return playChaos(state, target, cardInstanceId, cardId);
  const captureRequired = state.turn.phase === 'beforeMove'
    && activeVendettas(state).length > 0
    && vendettaCaptureDests(state, true).size > 0;
  const result = playCardUnchecked(state, cardId, target, cardInstanceId);
  // Heresy checks movement against each phase, after the opponent's magnets can expire.
  if (result.ok && cardId !== 'man-of-straw' && cardId !== 'passing-in-the-night' && cardId !== 'heresy' && !Object.hasOwn(SWAP_CARDS, cardId)
    && state.pieces.some(piece => {
      const after = boardCarrier(result.state, piece.id);
      return piece.zone === 'board' && piece.square && after?.square && after.square !== piece.square
        && !dungeonAllowsMove(state, piece, state.turn.color, true);
    })) return reject(state, 'ILLEGAL_MOVE', 'Dungeon prevents moving that piece this turn.');
  if (result.ok && cardId !== 'man-of-straw' && cardId !== 'passing-in-the-night' && CARD_CATALOG[cardId]?.continuing === false && state.pieces.some(piece => {
    const after = boardCarrier(result.state, piece.id);
    return piece.zone === 'board' && piece.square && after?.square
      && !curseAllowsMove(state, piece, piece.square, after.square);
  })) return reject(state, 'ILLEGAL_MOVE', 'Curse limits movement to one or two squares.');
  if (result.ok && !state.turn.moveMade && result.state.turn.moveMade) {
    const used = state.pieces.filter(piece => {
      const after = result.state.pieces.find(candidate => candidate.id === piece.id);
      return after && (after.square !== piece.square || after.zone !== piece.zone
        || (cardId === 'evil-eye' && piece.square === effectRecord(target)?.attacker));
    });
    if (!challengeAllows(state, used)) {
      return reject(state, 'ILLEGAL_MOVE', 'Challenge requires using the named piece.');
    }
  }
  const effectsBeforeExpiry = result.ok ? result.state.effects : undefined;
  if (result.ok && result.state.history.at(-1)?.type === 'cardPlayed'
    && cardId !== 'man-of-straw' && cardId !== 'passing-in-the-night' && !Object.hasOwn(SWAP_CARDS, cardId)) springManTraps(state, result.state);
  expirePieceEffects(result);
  if (result.ok && !(cardId === 'coup' && result.state.outcome?.reason === 'surrender')
    && (['white', 'black'] as const).some(owner =>
      state.pieces.some(piece => piece.owner === owner && piece.royal
        && (piece.zone === 'board' || piece.zone === 'away'))
      && !result.state.pieces.some(piece => piece.owner === owner && piece.royal
        && (piece.zone === 'board' || piece.zone === 'away')))) {
    return reject(state, 'ILLEGAL_MOVE', 'A card cannot eliminate a player’s last King.');
  }
  // A staged rescue is still unfinished; otherwise FAQ p.4 protects the mover too.
  const completedTurnReaction = (cardId === 'hostage' || cardId === 'revenge')
    && state.turn.moveMade && !state.pendingRescue;
  if (result.ok && result.state.history.at(-1)?.type === 'cardPlayed'
    && (cardId === 'toll' || completedTurnReaction || result.state.effects !== effectsBeforeExpiry
      || state.effects.some(isFatalAttractionEffect))
    && CARD_CATALOG[cardId]?.continuing === false && (cardId !== 'hostage' || completedTurnReaction)
    && cardId !== 'plots-within-plots') {
    const actor = result.state.playedCards?.at(-1)?.player ?? state.turn.color;
    const reaction = actor !== state.turn.color;
    const defender = opposite(actor);
    const consumesMove = !state.turn.moveMade && result.state.turn.moveMade
      && !isKingInCheck(state, actor);
    const directMate = (!isOrdinaryCheckmate(state, defender) && isOrdinaryCheckmate(result.state, defender))
      || (cardId === 'bog' && !isOrdinaryCheckmate(state, actor) && isOrdinaryCheckmate(result.state, actor));
    const selfCheck = (result.state.turn.moveMade && isKingInCheck(result.state, actor)
      && (!reaction || cardId === 'bog' || !isKingInCheck(state, actor)))
      || ((cardId === 'bog' || cardId === 'toll') && isKingInCheck(result.state, defender))
      || (completedTurnReaction && isKingInCheck(result.state, state.turn.color));
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
    const victim = event?.cardId === 'split-knight' || event?.cardId === 'evil-eye'
      ? state.pieces.find(piece => event.capturedIds?.includes(piece.id) && piece.owner === opposite(state.turn.color))
      : (event?.cardId === 'dark-mirror' || event?.cardId === 'breakthrough' || event?.cardId === 'bombard' || event?.cardId === 'irresistible-force') && event.capturedId
      ? state.pieces.find(piece => piece.id === event.capturedId)
      : undefined;
    if (!victim || victim.owner !== opposite(state.turn.color)) {
      return reject(state, 'ILLEGAL_MOVE', 'Vendetta requires an available capture of an opponent piece.');
    }
  }
  if (result.ok && state.chaosForbidden?.player === state.turn.color
    && chaosMovement(state, result.state, true) === state.chaosForbidden.movement) {
    return reject(state, 'ILLEGAL_MOVE', 'Chaos requires a different move.');
  }
  return result;
}

export function cardPlayTargets(state: GameState, cardId: string): unknown[] {
  if ((state.outcome || state.pendingAbduction || pendingElfReturn(state)) && cardId !== 'fog-of-war') return [];
  if (state.plotsExecution) return cardPlayTargetsUnchecked(state, cardId);
  const targets = new Map(cardPlayTargetsUnchecked(state, cardId).map(target => [JSON.stringify(target), target]));
  for (const allowance of state.plotsAllowances ?? []) {
    if (allowance.remaining <= 0 || state.pendingDoomsayer) continue;
    const card = state.players[allowance.player].hand.find(candidate => candidate.cardId === cardId
      && allowance.eligibleCards.includes(candidate.id));
    if (!card) continue;
    const view = plotsView(state, allowance.player, allowance.window);
    for (const target of cardPlayTargetsUnchecked(view, cardId)) {
      const key = JSON.stringify(target);
      if (targets.has(key) || playCard(state, cardId, target, card.id).ok) targets.set(key, target);
    }
  }
  return [...targets.values()]
    .filter(target => !state.chaosForbidden || playCard(state, cardId, target).ok);
}

function cardPlayTargetsUnchecked(state: GameState, cardId: string): unknown[] {
  if (['masquerade', 'blessing', 'doppelganger'].includes(cardId)
    && (state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color))) return [];
  if (cardId === 'riposte') {
    const result = playRiposte(state, undefined);
    return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [undefined] : [];
  }
  if (cardId === 'legacy') return (['white', 'black'] as const).flatMap(player =>
    state.players[player].discard.filter(card => playLegacy(state, card.id).ok).map(card => card.id));
  if (cardId === 'fog-of-war') {
    const checkpoints = fogCheckpoints(state);
    return [undefined, ...(checkpoints.length > 1 ? checkpoints.map(checkpoint => checkpoint.card.id) : [])]
      .filter(target => playFogOfWar(state, target).ok);
  }
  if (state.pendingAbduction) return [];
  if (cardId === 'fireball') return fireballPieces(state).flatMap(piece => {
    const result = playFireball(state, piece.square);
    return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [piece.square!] : [];
  });
  if (cardId === 'chaos' || cardId === 'knightmare' || cardId === 'think-again') {
    const result = playChaos(state, undefined, undefined, cardId);
    return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [undefined] : [];
  }
  if (cardId === 'mystic-shield') return mysticShieldPieces(state).flatMap(piece => {
    const result = playMysticShield(state, piece.square);
    return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [piece.square!] : [];
  });
  if (cardId === 'man-of-straw') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    return state.pieces.filter(king => king.zone === 'board' && king.square
      && king.owner === state.turn.color && king.royal && isRoyalInCheck(state, king))
      .flatMap(king => state.pieces.filter(pawn => pawn.zone === 'board' && pawn.square && manOfStrawPawn(state, pawn))
        .map(pawn => ({ king: king.square!, pawn: pawn.square! })))
      .filter(target => {
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      });
  }
  if (cardId === 'hostage') {
    const event = hostageCaptureEvent(state);
    if (!event) return [];
    return [...new Set([...(event.capturedIds ?? []), ...(event.capturedId ? [event.capturedId] : [])])]
      .flatMap(pieceId => state.pieces.flatMap(pawn => {
        const target = { pieceId, pawn: pawn.square };
        if (pawn.zone !== 'board' || !pawn.square || !hasUnpromotedPawn(state, pawn)) return [];
        const result = playHostage(state, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [target] : [];
      }));
  }
  if (cardId === 'plots-within-plots') return (['white', 'black'] as const).flatMap(player =>
    state.players[player].hand.some(card => card.cardId === cardId) && canOpenPlots(state, player) ? [{ player }] : []);
  if (cardId === 'neutrality') {
    if (state.outcome || pendingElfReturn(state)) return [];
    return state.pieces.flatMap(piece => {
      if (piece.zone !== 'board' || !piece.square) return [];
      const result = playNeutrality(state, piece.square);
      return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [piece.square] : [];
    });
  }
  if (cardId === 'fatal-attraction') {
    if (state.outcome || pendingElfReturn(state)) return [];
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square
      && playFatalAttraction(state, piece.square).ok ? [piece.square] : []);
  }
  if (cardId === 'abduction') {
    if (state.outcome) return [];
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square
      && playAbduction(state, piece.square, undefined, true).ok ? [piece.square] : []);
  }
  if (pendingElfReturn(state)) return [];
  if (cardId === 'hidden-passage') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    return state.pieces.filter(piece => piece.zone === 'board' && piece.square
      && piece.owner === state.turn.color && piece.royal).flatMap(king =>
      Array.from({ length: 64 }, (_, square) => [{ from: king.square!, to: makeSquare(square) }])
        .filter(target => {
          const result = playCard(state, cardId, target);
          return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
        }));
  }
  if (cardId === 'under-elf-hill') {
    if (state.outcome) return [];
    const result = playCard(state, cardId, undefined);
    return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [undefined] : [];
  }
  if (cardId === 'evil-eye') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    return state.pieces.flatMap(attacker => evilEyeVictims(state, attacker)
      .map(victim => ({ attacker: attacker.square!, victim })).filter(target => {
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      }));
  }
  if (cardId === 'split-knight') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    return state.pieces.flatMap(knight => {
      const victims = splitKnightVictims(state, knight);
      const selections = Array.from({ length: Math.max(0, victims.length - 1) }, (_, index) =>
        combinations(victims, index + 2)).flat();
      return selections.map(targets => ({ knight: knight.square!, targets })).filter(target => {
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      });
    });
  }
  if (cardId === 'sanctuary') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    const pieces = state.pieces.filter(piece => piece.zone === 'board' && piece.square);
    return pieces.filter(piece => piece.owner === state.turn.color && hasRole(state, piece, 'king'))
      .flatMap(king => pieces.filter(rook => rook.id !== king.id
        && (rook.owner === state.turn.color || rook.neutral) && hasRole(state, rook, 'rook'))
        .map(rook => ({ king: king.square!, rook: rook.square! })))
      .filter(target => {
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      });
  }
  if (cardId === 'fortification') {
    if (state.outcome || state.turn.phase !== 'afterMove' || !state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    const targets: CardMove[] = [];
    const squares = Array.from({ length: 64 }, (_, square) => makeSquare(square)).sort();
    for (let from = 0; from < 64; from += 1) {
      for (let to = from + 1; to < 64; to += 1) {
        if (adjacentSquares(squares[from], squares[to])) targets.push({ from: squares[from], to: squares[to] });
      }
    }
    return targets;
  }
  if (cardId === 'dungeon') {
    if (state.outcome || state.turn.phase !== 'afterMove' || !state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square
      && (piece.neutral || piece.owner !== state.turn.color)
      ? CORNERS.map(to => [{ from: piece.square!, to }]).filter(target => {
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      }) : []);
  }
  if (cardId === 'resurrection') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    return state.pieces.filter(piece => piece.zone === 'captured' && piece.owner === state.turn.color)
      .flatMap(piece => startingSquares(state, piece.owner, piece.promoted ? piece.role : piece.originalRole)
        .map(to => ({ pieceId: piece.id, to })))
      .filter(target => {
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      });
  }
  if (cardId === 'winged-victory' || cardId === 'betrayal') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    const destinations = cardId === 'winged-victory' ? CENTRAL_SQUARES : state.pieces.flatMap(piece =>
      piece.zone === 'board' && piece.square && (piece.neutral || piece.owner !== state.turn.color)
      && hasUnpromotedPawn(state, piece) && pawnHomeDistance(state, state.turn.color, piece.square) <= 3
        ? [piece.square] : []);
    return state.pieces.filter(piece => piece.zone === 'captured' && piece.square === null
      && piece.owner === state.turn.color && piece.originalRole === 'pawn' && !piece.promoted)
      .flatMap(piece => destinations.map(to => ({ pieceId: piece.id, to })))
      .filter(target => {
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      });
  }
  if (cardId === 'passing-in-the-night') {
    if (state.outcome || state.turn.phase !== 'beforeMove' || state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)
      || !state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return [];
    if (activeVendettas(state).length && vendettaCaptureDests(state, true).size) return [];
    const pawns = state.pieces.filter(piece =>
      piece.zone === 'board' && piece.square && hasUnpromotedPawn(state, piece),
    );
    const pairs = pawns.filter(piece => piece.neutral || piece.owner === state.turn.color)
      .flatMap(own => pawns.filter(piece =>
        piece.id !== own.id && (piece.neutral || piece.owner !== state.turn.color),
      ).map(opponent => ({ from: own.square!, to: opponent.square! })));
    const targets: CardMove[][] = pairs.map(pair => [pair]);
    for (let first = 0; first < pairs.length; first += 1) {
      for (let second = first + 1; second < pairs.length; second += 1) {
        const pair = [pairs[first], pairs[second]];
        if (new Set(pair.flatMap(move => [move.from, move.to])).size === 4) targets.push(pair);
      }
    }
    return targets.filter(target => {
      const result = playCard(state, cardId, target);
      return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
    });
  }
  if (cardId === 'man-trap') return state.outcome ? [] : state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square && playManTrap(state, piece.square, undefined, true).ok ? [piece.square] : []);
  if (cardId === 'haunting-memories') {
    if (state.outcome) return [];
    return (['white', 'black'] as const).flatMap(player => state.players[player].hand.flatMap(card => {
      if (card.cardId !== cardId) return [];
      const copy = hauntingCopy(state, card.id);
      return copy ? cardPlayTargets(copy.substituted, copy.cardId).filter(target => {
        const result = playCard(state, cardId, target, copy.card.id);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      }) : [];
    }));
  }
  if (cardId === 'curse') return state.outcome ? [] : state.pieces.flatMap(piece => {
    if (piece.zone !== 'board' || !piece.square) return [];
    return playCurse(state, piece.square).ok ? [piece.square] : [];
  });
  if (cardId === 'coup') {
    if (state.outcome) return [];
    return state.pieces.flatMap(piece => {
      if (piece.zone !== 'board' || !piece.square) return [];
      const result = playCoup(state, piece.square);
      return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [piece.square] : [];
    });
  }
  if (cardId === 'charge' || cardId === 'crusade' || cardId === 'merciless') {
    if (state.turn.phase !== 'afterMove' || !state.turn.moveMade
      || cardAllowanceUsed(state, state.turn.color)) return [];
    const mover = additionalMovePiece(state, cardId === 'charge' ? 'knight' : cardId === 'crusade' ? 'bishop' : 'rook');
    if (state.outcome || !mover?.square) return [];
    const view = turnView(state, state.turn.color);
    return Array.from({ length: 64 }, (_, square) => [{ from: mover.square!, to: makeSquare(square) }])
      .filter(target => {
        // A self-checking extra move cannot be a target, whatever its fizzle reason.
        const moved = movePiece(view, { type: 'move', ...target[0] }, 'defer', false, true);
        if (!moved.ok || moveLeavesRoyalInCheck(moved.state, state.turn.color, physicalPieces(state, mover))) return false;
        const result = playCard(state, cardId, target);
        return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
      });
  }
  if (cardId === 'challenge') {
    if (state.outcome) return [];
    let dests: Map<SquareName, SquareName[]> | undefined;
    const opponentDests = () => dests ??= legalDests(turnView(state, opposite(state.turn.color)), false);
    return state.pieces.flatMap(piece => {
      if (piece.zone !== 'board' || !piece.square) return [];
      const result = playChallenge(state, piece.square, undefined, opponentDests);
      return result.ok && result.state.history.at(-1)?.type === 'cardPlayed' ? [piece.square] : [];
    });
  }
  if (cardId === 'breakthrough') {
    return state.pieces.flatMap(piece => piece.zone === 'board' && piece.square
      ? breakthroughDests(state, piece.square).map(to => [{ from: piece.square!, to }]) : []);
  }
  if (cardId === 'vulture') return !state.outcome && playVulture(state, undefined).ok ? [undefined] : [];
  if (cardId === 'truce') return !state.outcome && playTruce(state, undefined).ok ? [undefined] : [];
  if (cardId === 'panic') {
    if (state.outcome) return [];
    const result = applyActionCore(state, { type: 'playCard', cardId: 'panic' });
    const event = result.ok ? result.state.history.at(-1) : undefined;
    return event?.type === 'cardPlayed' && event.cardId === 'panic' ? [undefined] : [];
  }
  if (cardId === 'ghostwalk' || cardId === 'bombard') {
    if (state.outcome) return [];
    return state.pieces.flatMap(piece => {
      if (piece.zone !== 'board' || !piece.square) return [];
      if (cardId === 'bombard' && ((piece.owner !== state.turn.color && !piece.neutral)
        || !hasRole(state, piece, 'rook'))) return [];
      return Array.from({ length: 64 }, (_, square) => [{
        from: piece.square!,
        to: makeSquare(square),
      }]).filter(target => {
        const result = playCard(state, cardId, target);
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
    if (state.turn.phase !== 'afterMove' || !state.turn.moveMade) return [];
    return (['clockwise', 'counterclockwise'] as const).flatMap(direction => earthquakeTargets(state, direction));
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
    const candidates = state.pieces.filter(piece => piece.zone === 'board' && piece.square
      && fatalAttractionAllowsMove(state, piece));
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
      springManTraps(state, afterOpponent);
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
  if (cardId === 'long-jump' || cardId === 'dubbing') {
    return steps.map(step => [step]).filter(target => {
      const result = playCard(state, cardId, target);
      return result.ok && result.state.history.at(-1)?.type === 'cardPlayed';
    });
  }
  if (cardId === 'assassin' || cardId === 'dark-mirror' || cardId === 'masquerade' || cardId === 'doppelganger' || cardId === 'squaring-the-circle' || cardId === 'cowardice') {
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
    return reject(state, 'INVALID_TARGET', 'Name pawn, knight, bishop, rook, queen, crab, or prince — never king.');
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
  if (selected.some(piece => piece.owner !== speaker && !piece.neutral)) {
    return reject(state, 'WRONG_OWNER', 'The named player can lose only an owned or neutral piece.');
  }
  if (selected.some(piece => hasRole(state, piece, 'king') || captureImmune(state, piece))) {
    return reject(state, 'INVALID_TARGET', 'That piece cannot be captured by Doomsayer.');
  }
  if (selected.some(piece => !candidates.includes(piece))) {
    return reject(state, 'WRONG_ROLE', 'Every loss must match the spoken piece type.');
  }
  if (mappings.length !== required) {
    return reject(
      state,
      'INVALID_TARGET',
      required
        ? `Choose ${required} eligible ${titleForRole(role)}${required === 1 ? '' : 's'} to lose.`
        : `No eligible ${titleForRole(role)} can be lost; do not choose a piece.`,
    );
  }

  const consumed = active.slice(0, required);
  const consumedIds = new Set(consumed.map(effect => effect.card.id));
  const resolved = structuredClone(state);
  const capturedIds = selected.flatMap((piece, index) =>
    losePiece(resolved, resolved.pieces.find(candidate => candidate.id === piece.id)!, 'captured', consumed[index].owner),
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
    discardEffectCard(resolved, effect);
  }
  resolved.pendingDoomsayer = null;
  resolved.history.push({
    type: 'pieceNamed',
    speaker,
    name: role as DoomsayerRole,
    capturedIds,
    resolvedEffectIds: consumed.map(effect => effect.card.id),
  });

  if (state.pendingDoomsayer && state.pendingRescue) {
    return recordCardTransition(state, settlePendingRescue(state, { ok: true, state: resolved },
      active.find(effect => effect.card.id === state.pendingDoomsayer!.cardInstanceId)!.card.cardId));
  }

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
      checkpoint.effects = structuredClone(pending.before?.effects ?? checkpoint.effects)
        .filter(effect => !isDoomsayerEffect(effect) || !consumedIds.has(effect.card.id));
      const checkpointLosses = selected.flatMap((piece, index) => {
        const loss = checkpoint.pieces.find(candidate => candidate.id === piece.id);
        if (!loss) return [];
        return losePiece(checkpoint, loss, 'captured', consumed[index].owner).flatMap(id =>
          checkpoint.pieces.find(candidate => candidate.id === id) ?? [],
        );
      });
      syncFen(checkpoint, checkpointLosses);
      const setup = setupFor(checkpoint);
      setup.halfmoves = 0;
      pending.fen = makeFen(setup);
      pending.pieces = checkpoint.pieces;
      pending.enPassant = checkpoint.enPassant;
      if (pending.before) pending.before.effects = checkpoint.effects;
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
  if (!state.pendingRescue) return { ok: true, state: resolved };
  return recordCardTransition(state, settlePendingRescue(state, { ok: true, state: resolved },
    activeDoomsayers(state).find(effect => effect.card.id === state.pendingDoomsayer!.cardInstanceId)!.card.cardId));
}

function hasAfterMoveRescue(
  state: GameState,
  movedPieces: readonly PieceState[],
  knownRescues?: Extract<GameAction, { type: 'playCard' }>[],
): boolean {
  const color = state.turn.color;
  if (cardAllowanceUsed(state, color)
    && !state.plotsAllowances?.some(allowance => allowance.player === color && allowance.remaining > 0)) return false;
  const rescues = (cardId: string, target: unknown, cardInstanceId?: unknown) => {
    const result = playCard(state, cardId, target, cardInstanceId);
    return result.ok
      && result.state.history.at(-1)?.type === 'cardPlayed'
      && (!moveLeavesRoyalInCheck(result.state, color, movedPieces)
        || Boolean(result.state.pendingDoomsayer) && hasDoomsayerEscape(result.state, new Set(), movedPieces)
        || (result.state.history.at(-1)?.copiedCardId ?? cardId) === 'plots-within-plots'
          && hasAfterMoveRescue(result.state, movedPieces));
  };
  // Hints belong to one legalDests query. Revalidate the whole action on each
  // candidate board; a stale target falls back to the complete rescue search.
  if (knownRescues?.some(card => rescues(card.cardId, card.target, card.cardInstanceId))) return true;
  return state.players[color].hand.some(card =>
    // Man-Trap only marks a future capture; it cannot remove the current check.
    card.cardId !== 'man-trap' && cardPlayTargets(state, card.cardId).some(target => {
      if (!rescues(card.cardId, target, card.id)) return false;
      knownRescues?.push({ type: 'playCard', cardId: card.cardId, cardInstanceId: card.id, target });
      return true;
    }),
  );
}

function finishRegularMove(
  before: GameState,
  next: GameState,
  movedPieces: readonly PieceState[],
  allowAfterMoveRescue: boolean | 'defer',
  byCard = false,
  rescueSearch: typeof hasAfterMoveRescue = hasAfterMoveRescue,
): ApplyResult {
  refreshCoups(next);
  if (before.pieces.some(piece => {
    const after = boardCarrier(next, piece.id);
    return piece.zone === 'board' && piece.square && after?.square && after.square !== piece.square
      && !dungeonAllowsMove(before, piece, before.turn.color, byCard);
  })) return reject(before, 'ILLEGAL_MOVE', 'Dungeon prevents moving that piece this turn.');
  const event = next.history.at(-1)!;
  next.doppelgangerMove = {
    player: before.turn.color, pieceId: movedPieces[0].id, historyLength: next.history.length,
  };
  next.shieldMove = {
    player: before.turn.color,
    pieceIds: before.pieces.filter(piece => {
      const after = boardCarrier(next, piece.id);
      return piece.zone === 'board' && piece.square && after?.square !== piece.square
        && (piece.owner === before.turn.color || piece.neutral) && after;
    }).flatMap(piece => physicalPieces(before, piece).map(component => component.id)),
  };
  if (event.capturedId) {
    const victim = before.pieces.find(piece => piece.id === event.capturedId);
    const components = victim ? physicalPieces(before, victim) : [];
    if (components.length > 1) event.capturedIds = components.map(piece => piece.id);
  }
  springManTraps(before, next);
  next.shieldMove.capturedOpponent = next.pieces.some(piece => piece.zone === 'captured'
    && boardCarrier(before, piece.id) && (piece.owner !== before.turn.color || piece.neutral));
  if (before.chaosForbidden?.player === before.turn.color
    && chaosMovement(before, next, true) === before.chaosForbidden.movement) {
    return reject(before, 'ILLEGAL_MOVE', 'Chaos requires a different move.');
  }
  if (before.chaosForbidden?.player === before.turn.color && before.chaosForbidden.additionalMove) {
    preserveAdditionalMoveClocks(before, next);
  }
  if (event.capturedId && next.pieces.some(piece => piece.id === movedPieces[0].id
    && piece.zone === 'captured')) event.movedPieceId = movedPieces[0].id;
  if (before.players[before.turn.color].hand.some(card => card.cardId === 'charge' || card.cardId === 'crusade' || card.cardId === 'merciless')
    || ['charge', 'crusade', 'merciless'].includes(hauntingCopy(before)?.cardId ?? '')) {
    event.movedPieceId = movedPieces[0].id;
    event.movedRoles = [...new Set(movedPieces.flatMap(piece =>
      piece.promoted ? [piece.role] : [piece.role, piece.originalRole]))];
  }
  if (!challengeAllows(before, movedPieces)) return reject(before, 'ILLEGAL_MOVE', 'Challenge requires moving the named piece.');
  clearChallenge(next, before.turn.color);
  if (allowAfterMoveRescue === 'defer') return { ok: true, state: next };
  if (!moveLeavesRoyalInCheck(next, before.turn.color, movedPieces)) {
    return { ok: true, state: next };
  }
  if (!allowAfterMoveRescue || !rescueSearch(next, movedPieces)) {
    return reject(before, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }
  next.pendingRescue = {
    before: structuredClone(before),
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
  allowAfterMoveRescue: boolean | 'defer' = true,
  enforceVendetta = true,
  byCard = false,
  rescueSearch: typeof hasAfterMoveRescue = hasAfterMoveRescue,
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
  if (action.enPassant !== undefined && typeof action.enPassant !== 'boolean') {
    return reject(state, 'ILLEGAL_MOVE', 'The en-passant selection must be boolean.');
  }
  const selectedEnPassant = action.enPassant === false ? undefined : enPassantCapture(state, fromName, toName);
  if (action.enPassant === true && !selectedEnPassant) {
    return reject(state, 'ILLEGAL_MOVE', 'That en-passant capture is not available.');
  }
  if (
    enforceVendetta
    && activeVendettas(state).length
    && vendettaCaptureDests(state, true).size
    && !vendettaVictim(state, fromName, toName, action.enPassant !== false)
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
  if (!dungeonAllowsMove(state, moving, state.turn.color, byCard)) return reject(state, 'ILLEGAL_MOVE', 'Dungeon prevents moving that piece this turn.');
  if (moving.owner !== state.turn.color && !moving.neutral) {
    return reject(state, 'ILLEGAL_MOVE', 'That piece is not under your control.');
  }
  const confabulation = confabulationForPiece(state, moving.id);
  if (!confabulation && !curseAllowsMove(state, moving, fromName, toName)) {
    return reject(state, 'ILLEGAL_MOVE', 'Curse limits movement to one or two squares.');
  }
  if (confabulation) {
    const occupant = state.pieces.find(piece => piece.zone === 'board' && piece.square === toName);
    const enPassantCaptureResult = selectedEnPassant;
    const target = occupant ?? enPassantCaptureResult?.victim;
    if (promotion !== undefined) return reject(state, 'ILLEGAL_MOVE', 'Confabulated pieces cannot promote.');
    if (target && hasRole(state, target, 'king')) return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
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
      ...(recordsBogRollback(state, moving, fromName, toName) ? { previousFen: state.fen } : {}),
    });
    return finishRegularMove(state, next, movedComponents, allowAfterMoveRescue, byCard, rescueSearch);
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
  const routeTo = castle ? makeSquare(kingCastlesTo(state.turn.color, castle)) : toName;
  if (forbiddenCityBlocksMove(state, fromName, routeTo, moving.role === 'knight' && !componentHasCrabMovement(state, moving.id))) {
    return reject(state, 'ILLEGAL_MOVE', 'That route is blocked by Forbidden City.');
  }
  const customEnPassant = selectedEnPassant;
  if (action.enPassant === false && enPassantCapture(state, fromName, toName)
    && !componentCanMove(state, moving, moving, toName, false)) {
    return reject(state, 'ILLEGAL_MOVE', 'That piece cannot move there without capturing en passant.');
  }
  const target = state.pieces.find(piece => piece.zone === 'board' && piece.square === toName);
  const enPassant = doubleStepEnPassant(state, moving, fromName, toName);
  if (
    (target && target.id !== moving.id && hasRole(state, target, 'king'))
    || (customEnPassant && hasRole(state, customEnPassant.victim, 'king'))
  ) {
    return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
  }

  if (componentHasCrabMovement(state, moving.id)) {
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
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue, byCard, rescueSearch);
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
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue, byCard, rescueSearch);
  }

  if (castlingSide(position, move) && !moving.royal && !target?.neutral) {
    return reject(state, 'ILLEGAL_MOVE', 'That is not a legal chess move.');
  }

  const rookFrom = castle ? position.castles.rook[state.turn.color][castle] : undefined;
  const castlingRook = rookFrom === undefined ? undefined : state.pieces.find(piece => piece.zone === 'board' && piece.square === makeSquare(rookFrom));
  if (castle && castlingRook && !curseAllowsMove(state, castlingRook, castlingRook.square!, makeSquare(rookCastlesTo(state.turn.color, castle)))) {
    return reject(state, 'ILLEGAL_MOVE', 'Curse limits the castling Rook to two squares.');
  }
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
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue, byCard, rescueSearch);
  }

  if ((moving.neutral || target?.neutral) && !orthodox) {
    const board = setupFor(state).board;
    if (
      promotion !== undefined
      || !pieceAttacksSquare(state, moving, toName, board.occupied, state.turn.color)
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
    return finishRegularMove(state, next, [moving], allowAfterMoveRescue, byCard, rescueSearch);
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

  const capturedSquare =
    !castle && moving.role === 'pawn' && position.epSquare === to && !position.board.has(to)
      ? to + (state.turn.color === 'white' ? -8 : 8)
      : to;
  const captured = castle
    ? undefined
    : state.pieces.find(
        piece => piece.zone === 'board' && piece.square === makeSquare(capturedSquare) && piece.owner !== state.turn.color,
      );
  if (captured && hasRole(state, captured, 'king')) return reject(state, 'ILLEGAL_MOVE', 'Kings are never captured.');
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
    ...(castle && castlingRook && (state.players[state.turn.color].hand.some(card => card.cardId === 'merciless')
      || hauntingCopy(state)?.cardId === 'merciless') ? {
      castlingRook: { pieceId: castlingRook.id, to: makeSquare(rookCastlesTo(state.turn.color, castle)) },
    } : {}),
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
  return finishRegularMove(state, next, [moving], allowAfterMoveRescue, byCard, rescueSearch);
}

function settlePendingRescue(
  beforeCard: GameState,
  result: ApplyResult,
  cardId: string,
): ApplyResult {
  if (cardId === 'fog-of-war' || result.ok && result.state.history.at(-1)?.copiedCardId === 'fog-of-war') return result;
  if (cardId === 'hostage' || cardId === 'riposte' || result.ok && result.state.history.at(-1)?.copiedCardId === 'riposte') {
    if (result.ok && !isKingInCheck(result.state, beforeCard.turn.color)) result.state.pendingRescue = null;
    return result;
  }
  const pending = beforeCard.pendingRescue;
  if (!pending || !result.ok || !result.state.pendingRescue || result.state.pendingAbduction
    || result.state.pendingDoomsayer) return result;
  const movedPieces = pending.movedPieceIds.flatMap(id => {
    const piece = result.state.pieces.find(candidate => candidate.id === id);
    return piece ? [piece] : [];
  });
  if (!moveLeavesRoyalInCheck(result.state, beforeCard.turn.color, movedPieces)) {
    result.state.pendingRescue = null;
    return result;
  }
  if ((result.state.playedCards?.at(-1)?.player !== beforeCard.turn.color
      || (result.state.history.at(-1)?.copiedCardId ?? cardId) === 'plots-within-plots')
    && hasAfterMoveRescue(result.state, movedPieces)) return result;

  const recorded = result.state.history.at(-1);
  const cardEvent = recorded?.type === 'cardFizzled'
    ? recorded
    : { type: 'cardFizzled' as const, cardId, reason: 'SELF_CHECK' as const,
      ...(beforeCard.pendingDoomsayer && cardId === 'haunting-memories' ? { copiedCardId: 'doomsayer' } : {}) };
  const spent = result.state.playedCards?.at(-1);
  const spentCard = spent && (beforeCard.players[spent.player].hand.find(card => card.id === spent.cardInstanceId)
    ?? activeDoomsayers(beforeCard).find(effect => effect.card.id === spent.cardInstanceId)?.card);
  if (spentCard && !spentCard.proxy && !result.state.players[spent.player].discard.some(card => card.id === spentCard.id)) {
    result.state.players[spent.player].discard.push(spentCard);
  }
  result.state.effects = structuredClone(pending.before?.effects ?? beforeCard.effects);
  for (const effect of result.state.effects) {
    if (!isRetainedContinuingEffect(effect)) continue;
    result.state.players[effect.owner].discard = result.state.players[effect.owner].discard
      .filter(card => card.id !== effect.card.id);
  }
  result.state.pendingDoomsayer = null;
  result.state.plotsAllowances = result.state.plotsAllowances?.slice(0, beforeCard.plotsAllowances?.length ?? 0);
  result.state.fen = pending.fen;
  result.state.pieces = structuredClone(pending.pieces);
  result.state.enPassant = structuredClone(pending.enPassant);
  result.state.chaosForbidden = structuredClone(pending.before?.chaosForbidden);
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
  const effectiveCardId = event.copiedCardId ?? event.cardId;
  if (event.type === 'cardPlayed' && effectiveCardId
    && ((!before.turn.moveMade && result.state.turn.moveMade)
      || ['charge', 'crusade', 'merciless'].includes(effectiveCardId))) {
    result.state.shieldMove = {
      player: before.turn.color,
      capturedOpponent: result.state.pieces.some(piece => piece.zone === 'captured'
        && boardCarrier(before, piece.id) && (piece.owner !== before.turn.color || piece.neutral)),
      pieceIds: Object.hasOwn(SWAP_CARDS, effectiveCardId)
        || ['passing-in-the-night', 'man-of-straw'].includes(effectiveCardId) ? []
        : before.pieces.filter(piece => {
          const after = boardCarrier(result.state, piece.id);
          return piece.zone === 'board' && piece.square && after && after.square !== piece.square
            && (piece.owner === before.turn.color || piece.neutral);
        }).flatMap(piece => physicalPieces(before, piece).map(component => component.id)),
    };
  }
  if (played) result.state.cardResponse = { player: played.player, historyLength: result.state.history.length };
  if (event.type === 'cardPlayed') {
    const captured = result.state.pieces.filter(piece => piece.zone === 'captured'
      && boardCarrier(before, piece.id));
    if (captured.some(piece => piece.id !== event.capturedId && !event.capturedIds?.includes(piece.id))) {
      event.capturedIds = [...new Set([...(event.capturedIds ?? []), ...captured.map(piece => piece.id)])];
    }
  }
  if (event.type === 'cardPlayed' && (effectiveCardId === 'forbidden-city' || effectiveCardId === 'fortification' || effectiveCardId === 'confabulation')) {
    return result;
  }
  if (event.type === 'cardPlayed' && (effectiveCardId === 'man-of-straw'
    || (effectiveCardId === 'toll' && event.preservePreviousMove === false))) {
    event.movement = [];
    if (effectiveCardId === 'man-of-straw') event.preservePreviousMove = false;
    return result;
  }

  const origins = new Map(before.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square ? [[piece.id, piece.square] as const] : [],
  ));
  event.movement = event.type === 'cardPlayed'
    ? effectiveCardId === 'heresy' && Array.isArray(event.target)
      ? structuredClone(event.target) as CardMove[]
      : result.state.pieces.flatMap(piece => {
        const from = origins.get(piece.id);
        return from && piece.zone === 'board' && piece.square && piece.square !== from
          ? [{ from, to: piece.square }]
          : [];
      })
    : [];
  event.preservePreviousMove ??= before.turn.phase === 'afterMove'
    && before.turn.moveMade
    && !(before.pendingRescue && event.type === 'cardFizzled');
  if (event.movement.length === 1) {
    const moved = before.pieces.find(piece => piece.zone === 'board' && piece.square === event.movement![0].from);
    if (moved) result.state.doppelgangerMove = {
      player: event.player ?? before.turn.color, pieceId: moved.id, historyLength: result.state.history.length,
    };
  }
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
    discardEffectCard(resolved, effect);
  }
  if (stalemate) {
    const setup = setupFor(resolved);
    setup.halfmoves = 0;
    resolved.fen = makeFen(setup);
  }
  return resolved;
}

function expirePieceEffects(result: ApplyResult): ApplyResult {
  if (!result.ok || result.state.pendingAbduction) return result;
  result.state.effects = result.state.effects.filter(effect => {
    const record = effectRecord(effect);
    return effectKind(effect) !== 'mysticshield' || typeof record?.player !== 'string'
      || (typeof record.pieceId === 'string' && Boolean(boardCarrier(result.state, record.pieceId)));
  });
  expireFatalAttractions(result.state, result.state);
  result.state = expireTruce(result.state);
  result.state = expireVendettaIfBlocked(result.state);
  const expired = result.state.effects.filter((effect): effect is PacifismEffect | CrabEffect | CurseEffect => {
    const record = effectRecord(effect);
    const card = effectRecord(record?.card);
    const kind = effectKind(effect);
    if (
      (kind !== 'pacifism' && kind !== 'crab' && kind !== 'curse')
      || typeof record?.pieceId !== 'string'
      || (record.owner !== 'white' && record.owner !== 'black')
      || !effectCardMatches(card, kind)
      || typeof card?.id !== 'string'
    ) return false;
    const piece = result.state.pieces.find(candidate => candidate.id === record.pieceId);
    const compositeOnBoard = piece
      ? physicalPieces(result.state, piece).some(component => component.zone === 'board' && component.square)
      : false;
    const temporarilyAway = piece?.zone === 'away'
      && physicalPieces(result.state, piece).some(component =>
        result.state.underElfHill?.some(entry => entry.pieceId === component.id && !entry.returned));
    const awaitingRescue = kind === 'crab' && piece?.zone === 'captured' && recentlyCaptured(result.state, piece);
    const cancelledMergeTarget = piece?.zone === 'away' && record.confabulationEnded === true;
    return !piece || (!compositeOnBoard && !temporarilyAway && !awaitingRescue && !cancelledMergeTarget)
      || (kind === 'crab' && piece.promoted);
  });
  if (!expired.length) return result;
  const cardIds = new Set(expired.map(effect => effect.card.id));
  result.state.effects = result.state.effects.filter(effect => {
    const card = effectRecord(effectRecord(effect)?.card);
    return typeof card?.id !== 'string' || !cardIds.has(card.id);
  });
  for (const effect of expired) {
    discardEffectCard(result.state, effect);
  }
  result.state = expireTruce(result.state);
  return result;
}

function hasBoardOrCardEscape(state: GameState, allowCardContinuation = false): boolean {
  const color = state.turn.color;
  return legalDests(state, allowCardContinuation || isKingInCheck(state, color), true, true).size > 0
    || state.players[color].hand.some(card =>
      cardPlayTargets(state, card.cardId).some(target => {
        const result = playCard(state, card.cardId, target, card.id);
        if (!result.ok) return false;
        if (allowCardContinuation) return true;
        if (result.state.outcome) return false;
        if (result.state.turn.moveMade) return !isKingInCheck(result.state, color)
          || Boolean(result.state.pendingDoomsayer) && hasDoomsayerEscape(result.state);
        if (result.state.history.at(-1)?.type !== 'cardPlayed') return false;
        return legalDests(result.state, true, true, true).size > 0;
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

function hasDoomsayerEscape(state: GameState, seen = new Set<string>(), movedPieces: readonly PieceState[] = []): boolean {
  const active = activeDoomsayers(state);
  if (!active.length) return false;
  const signature = `${active.map(effect => effect.card.id).join(',')}|${state.pieces
    .filter(piece => piece.zone === 'board' && piece.square)
    .map(piece => `${piece.id}:${piece.square}`)
    .join(',')}`;
  if (seen.has(signature)) return false;
  seen.add(signature);

  for (const role of DOOMSAYER_ROLES) {
    const candidates = doomsayerTargets(state, state.pendingDoomsayer?.player ?? state.turn.color, role);
    const required = Math.min(active.length, candidates.length);
    if (!required) continue;
    for (const losses of combinations(candidates, required)) {
      const resolved = structuredClone(state);
      for (const [index, piece] of losses.entries()) {
        losePiece(resolved, resolved.pieces.find(candidate => candidate.id === piece.id)!, 'captured', active[index].owner);
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
      if (state.pendingDoomsayer) {
        if (!moveLeavesRoyalInCheck(resolved, state.turn.color, movedPieces)) return true;
        continue;
      }
      if (hasBoardOrCardEscape(resolved) || hasDoomsayerEscape(resolved, seen)) return true;
    }
  }
  return false;
}

function canSkipRegularMove(state: GameState): boolean {
  return Boolean(challengesFor(state).length || state.underElfHill?.some(entry =>
    entry.player === state.turn.color && entry.returned) && !hasLegalMove(state, state.turn.color));
}

function hasTurnEscape(state: GameState, allowCardContinuation = false): boolean {
  if (canSkipRegularMove(state) && !isKingInCheck(state, state.turn.color)) return true;
  return hasBoardOrCardEscape(state, allowCardContinuation) || hasDoomsayerEscape(state);
}

function adjudicateTurn(state: GameState): GameState {
  const color = state.turn.color;
  let next = expireVendettaIfBlocked(state);
  next = expireTruce(next);
  if (withoutTruce(next) !== next && isOrdinaryStalemate(next, color) && !hasTurnEscape(next)) {
    next = expireTruce(next, true);
  }
  const canEscape = hasTurnEscape(next);
  if (isKingInCheck(next, color) && !canEscape) {
    next.outcome = { winner: opposite(color), reason: 'checkmate' };
  } else if (isOrdinaryStalemate(next, color) && !canEscape) {
    next.outcome = { reason: 'stalemate' };
  }
  return next;
}

function consumeRiposteMove(state: GameState): GameState {
  const index = state.riposteLostMoves?.indexOf(state.turn.color) ?? -1;
  if (index < 0 || state.turn.moveMade || pendingElfReturn(state) || state.pendingDoomsayer) return state;
  state.riposteLostMoves!.splice(index, 1);
  if (!state.riposteLostMoves!.length) delete state.riposteLostMoves;
  completeReplacementMove(state, state.turn.color, false);
  state.riposteSkipped = state.turn.color;
  delete state.shieldMove;
  delete state.legacyCapture;
  state.effects = state.effects.filter(effect => !isPanicEffect(effect) || effect.player !== state.turn.color);
  return state;
}

function advanceTurn(state: GameState, discardCardInstanceId?: string): ApplyResult {
  let next = structuredClone(state);
  if (discardCardInstanceId !== undefined) {
    const player = next.players[state.turn.color];
    const index = player.hand.findIndex(card => card.id === discardCardInstanceId);
    player.discard.push(...player.hand.splice(index, 1));
    const drawn = player.deck.shift();
    if (drawn) player.hand.push(drawn);
  }
  delete next.riposteSkipped;
  delete next.riposteCheckDeferred;
  delete next.fogCheckpoint;
  delete next.fogLocked;
  delete next.chaosCheckpoint;
  delete next.chaosForbidden;
  delete next.shieldMove;
  next.effects = next.effects.filter(effect => {
    const record = effectRecord(effect);
    return effectKind(effect) !== 'mysticshield' || typeof record?.player !== 'string'
      || record.player === state.turn.color;
  });
  delete next.plotsAllowances;
  delete next.plotsExecution;
  if (next.underElfHill) {
    next.underElfHill = next.underElfHill.filter(entry => !entry.returned || entry.player !== state.turn.color);
    for (const entry of next.underElfHill) {
      if (entry.player === opposite(state.turn.color)) entry.returning = true;
    }
  }
  next.effects = next.effects.filter(effect => !isDungeonEffect(effect) || effect.player !== state.turn.color);
  clearChallenge(next, state.turn.color);
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
  if (pendingElfReturn(next)) {
    if (!underElfHillReturnSquares(next).length) next.outcome = { reason: 'stalemate' };
    return { ok: true, state: next };
  }
  return { ok: true, state: adjudicateTurn(consumeRiposteMove(next)) };
}

function endTurn(state: GameState, discardCardInstanceId?: string): ApplyResult {
  if (discardCardInstanceId !== undefined) {
    if (typeof discardCardInstanceId !== 'string'
      || state.players[state.turn.color].hand.filter(card => card.id === discardCardInstanceId).length !== 1) {
      return reject(state, 'CARD_NOT_IN_HAND', 'Choose one physical card in your own hand to discard.');
    }
    if (state.turn.cardPlays[state.turn.color] > 0) {
      return reject(state, 'CARD_ALREADY_PLAYED', 'Ordinary discard requires an own turn with no card played.');
    }
  }
  if (state.pendingRescue && !state.pieces.some(piece => piece.owner === state.turn.color && piece.royal
    && (piece.zone === 'board' || piece.zone === 'away'))) {
    return reject(state, 'KING_IN_CHECK', 'Restore your King before ending the turn.');
  }
  if (!state.turn.moveMade && canSkipRegularMove(state) && !state.pendingDoomsayer) {
    if (isKingInCheck(state, state.turn.color)) return reject(state, 'KING_IN_CHECK', 'Your King is still in check.');
    const skipped = structuredClone(state);
    skipped.enPassant = [];
    const setup = setupFor(skipped);
    setup.epSquare = undefined;
    setup.turn = opposite(state.turn.color);
    setup.halfmoves += 1;
    if (state.turn.color === 'black') setup.fullmoves += 1;
    skipped.fen = makeFen(setup);
    return advanceTurn(skipped, discardCardInstanceId);
  }
  if (!state.turn.moveMade) return reject(state, 'INVALID_TIMING', 'Make the regular move before ending the turn.');
  if (state.pendingDoomsayer) {
    return reject(state, 'INVALID_TIMING', 'The opponent must name a piece or decline Doomsayer before the turn can end.');
  }
  if (state.riposteCheckDeferred !== state.turn.color && isKingInCheck(state, state.turn.color)) {
    return reject(state, 'KING_IN_CHECK', 'Your King is still in check.');
  }
  return advanceTurn(state, discardCardInstanceId);
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
  completeReplacementMove(resolved, state.turn.color, false);
  return advanceTurn(resolved);
}

function rememberTurnStart(before: GameState, result: ApplyResult): ApplyResult {
  if (
    result.ok
    && !before.turnCheckpoint
    && before.turn.phase === 'beforeMove'
    && !before.turn.moveMade
    && (before.players[opposite(before.turn.color)].hand.some(card => card.cardId === 'toll')
      || (before.players[opposite(before.turn.color)].hand.some(card => card.cardId === 'haunting-memories')
        && (() => {
          const previous = [...before.history].reverse().find(event => event.type === 'cardPlayed' || event.type === 'cardFizzled');
          return (previous?.copiedCardId ?? previous?.cardId) === 'toll';
        })()))
  ) {
    const checkpoint = structuredClone(before);
    delete checkpoint.turnCheckpoint;
    result.state.turnCheckpoint = checkpoint;
  }
  return result;
}

export function applyAction(state: GameState, action: GameAction | null | undefined): ApplyResult {
  const result = applyActionCore(state, action);
  // A rejected discard must also roll back any lazy effect expiry in dispatch.
  if (!result.ok && action?.type === 'endTurn' && action.discardCardInstanceId !== undefined) {
    return { ...result, state };
  }
  if (!result.ok || !action) return result;
  const event = result.state.history.at(-1);
  const cardId = event?.copiedCardId ?? event?.cardId;
  // Candidate fizzles cannot escape check; settle only the completed public action.
  if (action.type === 'playCard' && event?.type === 'cardFizzled' && cardId !== 'hostage') {
    settleBlockedBeforeMove(result.state, result.state.turn.color);
  }
  const captured = result.state.pieces.filter(piece => piece.zone === 'captured'
    && (boardCarrier(state, piece.id)
      || state.pendingAbduction?.before.pieces.some(before => before.id === piece.id && before.zone === 'board')));
  delete result.state.legacyCapture;
  if (captured.length && action.type !== 'endTurn') {
    result.state.legacyCapture = { historyLength: result.state.history.length, pieceIds: captured.map(piece => piece.id) };
  }
  if (action.type === 'playCard') {
    const played = result.state.playedCards?.at(-1);
    const card = played && state.players[played.player].hand.find(candidate => candidate.id === played.cardInstanceId);
    if (played && card) {
      const before = structuredClone({ ...state, fogCheckpoint: undefined });
      delete before.fogCheckpoint;
      result.state.fogCheckpoint = { before, player: played.player, card: structuredClone(card), historyLength: result.state.history.length };
      const checkpoint = result.state.fogCheckpoint;
      const allowanceIndex = (state.plotsAllowances ?? []).map((allowance, index) => ({ allowance, index })).reverse()
        .find(({ allowance }) => allowance.player === played.player
          && allowance.remaining > 0 && allowance.eligibleCards.includes(card.id))?.index ?? -1;
      if (allowanceIndex >= 0) {
        const belongsToPlots = (previous: GameState['fogCheckpoint']) => {
          const previousEvent = previous && state.history[previous.historyLength - 1];
          return previous?.player === played.player
            && (previous.plots?.allowanceIndex === allowanceIndex
              || ((previousEvent?.copiedCardId ?? previousEvent?.cardId) === 'plots-within-plots'
                && (previous.before.plotsAllowances?.length ?? 0) === allowanceIndex));
        };
        const responseWindows = (result.state.plotsAllowances ?? []).filter(allowance =>
          allowance.player !== played.player && allowance.remaining > 0 && belongsToPlots(allowance.window.fogCheckpoint));
        const saved = responseWindows[0]?.window.fogCheckpoint;
        const previous = state.fogCheckpoint?.historyLength === state.history.length && belongsToPlots(state.fogCheckpoint)
          ? state.fogCheckpoint : saved;
        checkpoint.action = structuredClone({ ...action, cardInstanceId: card.id });
        checkpoint.plots = { allowanceIndex };
        if (previous) checkpoint.plots.previous = structuredClone(previous);
        if (saved?.canceledCards) checkpoint.canceledCards = [...saved.canceledCards];
        for (const allowance of responseWindows) allowance.window.fogCheckpoint = structuredClone(checkpoint);
      }
    }
  } else if (!['revealAbduction', 'answerAbduction', 'abductionTimeout'].includes(action.type)) {
    delete result.state.fogCheckpoint;
  } else if (result.state.fogCheckpoint?.plots) {
    (result.state.fogCheckpoint.responses ??= []).push(structuredClone(action));
  }
  let next = result.state;
  // A safe replacement stays open for any playable card or a move requiring rescue.
  if (action.type === 'playCard' && next.chaosForbidden?.player === next.turn.color && !next.turn.moveMade
    && !next.outcome && !next.pendingRescue && !next.pendingAbduction && !next.pendingDoomsayer
    && !pendingElfReturn(next) && !isKingInCheck(next, next.turn.color) && !hasTurnEscape(next, true)) {
    result.state = next = expireTruce(next, true);
    if (!hasTurnEscape(next, true)) next.outcome = { reason: 'stalemate' };
  }
  if ((cardId === 'chaos' || cardId === 'knightmare' || cardId === 'think-again') && action.type === 'playCard') return result;
  const movement = chaosMovement(state, result.state);
  const moved = action.type === 'move' || (action.type === 'playCard' && event?.type === 'cardPlayed'
    && ((!state.turn.moveMade && result.state.turn.moveMade)
      || ['charge', 'crusade', 'merciless'].includes(cardId ?? '')
      || (Boolean(state.plotsAllowances?.length) && CARD_CATALOG[cardId ?? '']?.timing.includes('beforeMove')
        && result.state.turn.moveMade && Boolean(movement))));
  if (moved) {
    delete result.state.chaosForbidden;
    const before = structuredClone({ ...state, chaosCheckpoint: undefined });
    delete before.chaosCheckpoint;
    if (before.turnCheckpoint) delete before.turnCheckpoint.chaosCheckpoint;
    const played = action.type === 'playCard' ? result.state.playedCards?.at(-1) : undefined;
    const card = played ? state.players[played.player].hand.find(candidate => candidate.id === played.cardInstanceId) : undefined;
    result.state.chaosCheckpoint = { before, movement, historyLength: result.state.history.length, card };
  } else if (cardId !== 'plots-within-plots' || action.type !== 'playCard') {
    delete result.state.chaosCheckpoint;
  }
  // Resolve exhausted escape resources only after a real own-turn card and any staged-move rollback.
  if (action.type === 'playCard' && next.playedCards?.at(-1)?.player === next.turn.color
    && !next.outcome && !next.pendingRescue && !next.pendingAbduction && !next.pendingDoomsayer
    && !pendingElfReturn(next)
    && (isKingInCheck(next, next.turn.color)
      || !next.turn.moveMade && next.chaosForbidden?.player !== next.turn.color)) {
    result.state = adjudicateTurn(next);
  }
  return result;
}

function applyActionCore(state: GameState, action: GameAction | null | undefined): ApplyResult {
  const fog = action?.type === 'playCard' && (action.cardId === 'fog-of-war'
    || action.cardId === 'haunting-memories' && hauntingCopy(state, action.cardInstanceId)?.cardId === 'fog-of-war');
  if (state.outcome && !fog) return reject(state, 'GAME_OVER', 'The game is already over.');
  if (!action) return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
  if (['revealAbduction', 'answerAbduction', 'abductionTimeout'].includes(action.type)) return abductionResponse(state, action);
  if (state.pendingAbduction && !fog) return reject(state, 'INVALID_TIMING', 'Resolve Abduction before taking another action.');
  if (action.type === 'returnKing') return returnElfKing(state, action);
  if (pendingElfReturn(state)) return reject(state, 'INVALID_TIMING', 'Return your King before taking another action.');
  if (action.type === 'panicTimeout') {
    if (Object.getPrototypeOf(action) !== Object.prototype || Reflect.ownKeys(action).length !== 1) {
      return reject(state, 'INVALID_TARGET', 'panicTimeout does not take a payload.');
    }
    return expirePieceEffects(panicTimeout(state));
  }
  if (action.type === 'playCard' && (action.cardId === 'legacy'
    || action.cardId === 'haunting-memories'
      && hauntingCopy(state, action.cardInstanceId, action.target)?.cardId === 'legacy')) {
    return recordCardTransition(state, playCard(state, action.cardId, action.target, action.cardInstanceId));
  }
  state = expireVendettaIfBlocked(state);
  if (action.type === 'move') {
    const view = { ...state };
    delete view.plotsAllowances;
    const result = expirePieceEffects(clearCompletedPanic(view, rememberTurnStart(view, movePiece(view, action))));
    return result.ok ? result : { ...result, state };
  }
  if (action.type === 'namePiece') return expirePieceEffects(clearCompletedPanic(state, rememberTurnStart(state, namePiece(state, action))));
  if ((['pronouncePiece', 'pieceName', 'pronouncePieceName', 'pieceNamed'] as unknown[]).includes(action.type)) {
    return reject(state, 'INVALID_TARGET', 'Use the canonical namePiece action.');
  }
  if (action.type === 'declineDoomsayer') {
    return expirePieceEffects(clearCompletedPanic(state, rememberTurnStart(state, declineDoomsayer(state, action))));
  }
  if (action.type === 'endTurn') return expirePieceEffects(endTurn(state, action.discardCardInstanceId));
  if (action.type !== 'playCard') return reject(state, 'CARD_NOT_IN_HAND', 'That card is not implemented.');
  return expirePieceEffects(clearCompletedPanic(state, rememberTurnStart(state, recordCardTransition(state, settlePendingRescue(
    state,
    playCard(state, action.cardId, action.target, action.cardInstanceId),
    action.cardId,
  )))));
}
