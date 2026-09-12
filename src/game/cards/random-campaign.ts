import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { activeDoomsayers, applyAction, cardPlayTargets, doomsayerTargets, legalDests, underElfHillReturnSquares } from '../reducer.js';
import { createGameState, type CreateGameOptions } from '../state.js';
import type { GameAction, GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

export interface RandomTrace {
  seed: number;
  maxMoves?: number;
  digestVersion?: 1 | 2 | 3;
  initial: CreateGameOptions;
  steps: Array<{ action: GameAction; expected: string }>;
  moves: number;
  finalFen: string;
  sampledCards: Record<string, number>;
  failure?: string;
}

// Versions 1 and 2 preserve historical reviewed snapshots; version 3 includes all metadata.
export const digest = (state: GameState, version: 1 | 2 | 3 = 3): string => createHash('sha256')
  .update(JSON.stringify(state, (key, value) => (version === 1 && key === 'capturedBy'
    || version < 3 && (key === 'doppelgangerPieceId' || key === 'doppelgangerMove')) ? undefined : value)).digest('hex');

const unresolved = (state: GameState): boolean => !state.outcome && !!(state.turn.moveMade
  || state.pendingRescue || state.pendingAbduction || state.pendingDoomsayer
  || state.underElfHill?.some(entry => entry.returning && !entry.returned));

function checkMoveBound(maxMoves: number): void {
  assert.ok(Number.isSafeInteger(maxMoves) && maxMoves >= 0, 'move bound must be a nonnegative safe integer');
}

export function maySampleCard(state: GameState, card: { id: string; cardId: string }, owner: 'white' | 'black'): boolean {
  const extra = state.plotsAllowances?.some(item => item.player === owner && item.remaining > 0 && item.eligibleCards.includes(card.id));
  if (state.turn.cardPlays[owner] && !extra) return false;
  if (extra) return true;
  // Legacy also reacts to captures during its owner's move (for example Man-Trap).
  if (card.cardId === 'legacy' && state.legacyCapture?.historyLength === state.history.length) return true;
  const timing = CARD_CATALOG[card.cardId]!.timing;
  return owner === state.turn.color && timing.includes(state.turn.phase)
    || owner !== state.turn.color && state.turn.moveMade && timing.includes('afterOpponentMove')
    || !!state.cardResponse && state.cardResponse.player !== owner && timing.includes('afterOpponentCard');
}

// These checks use physical piece records and ordinary chess, not reducer-generated expectations.
export function checkState(state: GameState): void {
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length, 'piece identities are unique');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length, 'one piece per square');
  for (const piece of state.pieces) {
    assert.equal(piece.zone === 'board', piece.square !== null, `${piece.id}: zone agrees with square`);
    if (piece.square) assert.match(piece.square, /^[a-h][1-8]$/);
    if (piece.capturedBy !== undefined) {
      assert.ok(piece.capturedBy === 'white' || piece.capturedBy === 'black', `${piece.id}: valid capture actor`);
      assert.equal(piece.zone, 'captured', `${piece.id}: capture actor only on captured pieces`);
    }
    if (piece.royal) assert.ok(piece.zone === 'board' || piece.zone === 'away', 'a King cannot be captured or dead');
  }
  for (const color of ['white', 'black'] as const) {
    assert.equal(state.pieces.filter(piece => piece.owner === color && piece.royal).length, 1, `${color}: one royal identity`);
  }
  const cards = [...state.players.white.hand, ...state.players.white.deck, ...state.players.white.discard,
    ...state.players.black.hand, ...state.players.black.deck, ...state.players.black.discard];
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length, 'a card cannot occupy two player zones');
  const fen = parseFen(state.fen).unwrap();
  // FEN advances when the move is made; turn.color retains the actor during reactions.
  if (state.turn.phase === 'beforeMove' && !state.turn.moveMade) {
    assert.equal(fen.turn, state.turn.color, 'before-move FEN must identify the next actor');
  }
  assert.equal(fen.board.occupied.size(), board.length, 'FEN piece count agrees with physical board');
  for (const piece of board) {
    const encoded = fen.board.get(parseSquare(piece.square!)!);
    assert.ok(encoded, `${piece.square}: missing from FEN`);
    assert.equal(encoded.role, piece.role, `${piece.square}: FEN role`);
    assert.equal(encoded.color, piece.owner, `${piece.square}: FEN owner`);
  }
}

function checkTransition(before: GameState, action: GameAction, after: GameState): void {
  checkState(after);
  // Compare standard positions to chessops only when no variant state can override chess.
  const ordinary = before.orientation === 0 && before.effects.length === 0
    && !before.pendingRescue && !before.underElfHill?.length && !before.shieldMove
    && !before.riposteLostMoves?.length && !before.chaosForbidden
    && before.pieces.every(piece => !piece.neutral && piece.zone !== 'away'
      && piece.royal === (piece.role === 'king') && (piece.role === piece.originalRole || piece.promoted));
  if (action.type === 'move' && ordinary && !after.pendingRescue) {
    const position = Chess.fromSetup(parseFen(before.fen).unwrap());
    if (position.isOk) {
      const move = { from: parseSquare(action.from as string)!, to: parseSquare(action.to as string)!,
        ...(action.promotion ? { promotion: action.promotion as 'queen' } : {}) };
      assert.ok(position.value.isLegal(move), 'ordinary move must be independently legal');
      position.value.play(move);
      assert.equal(makeBoardFen(position.value.board), after.fen.split(' ')[0], 'ordinary chess board oracle');
    }
  }
}

export function rejectPendingCancellation(state: GameState, action: GameAction, rescue: GameAction[]): void {
  assert.ok(state.pendingRescue, 'the preceding move still requires its saving card');
  assert.equal(action.type, 'playCard');
  if (action.type !== 'playCard') return;
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false, 'FAQ p.16 requires the completed opposing turn');
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
  assert.deepEqual(result.state, before);
  assert.deepEqual(cardPlayTargets(state, action.cardId), []);
  assert.deepEqual(state, before);
  assert.ok(rescue.length, 'preserve an independently verified saving continuation');
  let saved = state;
  for (const next of rescue) {
    const result = applyAction(saved, next);
    assert.ok(result.ok, JSON.stringify(next));
    saved = result.state;
  }
  assert.equal(saved.pendingRescue, null);
  assert.ok(applyAction(saved, { type: 'endTurn' }).ok);
}

export function replayTrace(trace: RandomTrace, stopBefore?: number): GameState {
  assert.equal(trace.failure, undefined, trace.failure ?? 'trace generation failed');
  const maxMoves = trace.maxMoves ?? 50;
  checkMoveBound(maxMoves);
  const version = trace.digestVersion ?? 1;
  assert.ok(version === 1 || version === 2 || version === 3, 'unsupported trace digest version');
  let state = createGameState(trace.initial);
  checkState(state);
  for (const [index, step] of trace.steps.entries()) {
    // Preserve historical digests only through a source-verified legal prefix.
    if (index + 1 === stopBefore) return state;
    const original = digest(state);
    const result = applyAction(state, step.action);
    assert.equal(digest(state), original, `step ${index + 1}: input mutation`);
    assert.ok(result.ok, `step ${index + 1}: ${JSON.stringify(step.action)}`);
    checkTransition(state, step.action, result.state);
    assert.equal(digest(result.state, version), step.expected, `step ${index + 1}: reviewed state changed`);
    state = result.state;
  }
  assert.equal(state.fen, trace.finalFen);
  assert.equal(trace.moves, trace.steps.filter(step => step.action.type === 'move').length);
  assert.ok(trace.moves <= maxMoves, 'trace exceeds move bound');
  assert.ok(!unresolved(state), 'trace ends with unresolved turn or pending choice');
  return state;
}

export function generateTrace(
  seed: number,
  maxMovesOrProgress: number | ((step: number, moves: number, state: GameState) => void) = 50,
  progress?: (step: number, moves: number, state: GameState) => void,
): { trace: RandomTrace; review: string } {
  const maxMoves = typeof maxMovesOrProgress === 'number' ? maxMovesOrProgress : 50;
  if (typeof maxMovesOrProgress === 'function') progress = maxMovesOrProgress;
  checkMoveBound(maxMoves);
  let randomState = seed >>> 0;
  const random = () => {
    randomState += 0x6d2b79f5;
    let value = Math.imul(randomState ^ randomState >>> 15, randomState | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return (value ^ value >>> 14) >>> 0;
  };
  const bounded = (size: number): number => {
    const limit = 0x100000000 - 0x100000000 % size;
    let value: number;
    do { value = random(); } while (value >= limit);
    return value % size;
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = bounded(i + 1);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };
  const white = shuffle(Object.keys(CARD_CATALOG));
  const black = shuffle(Object.keys(CARD_CATALOG));
  const initial = { hands: { white: white.slice(0, 5), black: black.slice(0, 5) },
    decks: { white: white.slice(5), black: black.slice(5) } };
  let state = createGameState(initial);
  const trace: RandomTrace = { seed, maxMoves, digestVersion: 3, initial, steps: [], moves: 0, finalFen: state.fen, sampledCards: {} };
  const lines = [`Seed ${seed}; standard starting board; shuffled catalog house-variant decks (rules §4.3).`,
    'Each row must be independently reviewed against rules.md/cards.md; hashes alone are not an oracle.'];
  for (let index = 0; !state.outcome && (trace.moves < maxMoves || unresolved(state)); index++) {
    progress?.(index, trace.moves, state);
    const original = digest(state);
    let chosen: { action: GameAction; state: GameState } | undefined;
    const attempt = (action: GameAction): boolean => {
      const result = applyAction(state, action);
      assert.equal(digest(state), original, 'candidate evaluation mutated its input');
      if (!result.ok) return false;
      chosen = { action, state: result.state };
      return true;
    };
    const cards = (rescue = false) => {
      const hand = [...state.players.white.hand, ...state.players.black.hand];
      if (!hand.length) return false;
      for (const card of rescue ? shuffle(hand) : [hand[bounded(hand.length)]!]) {
      trace.sampledCards[card.cardId] = (trace.sampledCards[card.cardId] ?? 0) + 1;
      const owner = state.players.white.hand.includes(card) ? 'white' : 'black';
      if (!maySampleCard(state, card, owner)) continue;
      const targets = cardPlayTargets(state, card.cardId);
      if (!targets.length) continue;
      for (const target of shuffle(targets)) {
        const action: GameAction = { type: 'playCard', cardId: card.cardId, cardInstanceId: card.id,
          ...(target === undefined ? {} : { target }) };
        if (rescue) {
          const result = applyAction(state, action);
          if (!result.ok || result.state.pendingRescue && !result.state.pendingAbduction
            && !result.state.pendingDoomsayer
            && !result.state.underElfHill?.some(entry => entry.returning && !entry.returned)) continue;
        }
        if (attempt(action)) return true;
      }
      }
      return false;
    };
    const nameRandomPiece = (speaker: 'white' | 'black') => {
      const active = activeDoomsayers(state);
      if (!active.length) return false;
      const name = shuffle(['pawn', 'knight', 'bishop', 'rook', 'queen'] as const)[0]!;
      const pieces = shuffle(doomsayerTargets(state, speaker, name)).slice(0, active.length);
      return attempt({ type: 'namePiece', speaker, name,
        losses: pieces.map((piece, index) => ({ effectId: active[index]!.card.id, pieceId: piece.id })) });
    };
    if ((state.pendingAbduction || state.pendingDoomsayer) && state.cardResponse && bounded(3) !== 0 && cards()) {
      // An immediate opposing-card reaction may cancel the newly opened choice.
    } else if (state.pendingAbduction) {
      const pending = state.pendingAbduction;
      if (pending.phase === 'concealment') attempt({ type: 'revealAbduction' });
      else if (bounded(2)) {
        const piece = pending.before.pieces.find(piece => piece.id === pending.pieceId)!;
        attempt({ type: 'answerAbduction', player: pending.player, owner: piece.owner,
          role: piece.role, square: piece.square!, pieceId: piece.id });
      } else attempt({ type: 'abductionTimeout' });
    } else if (state.pendingDoomsayer) {
      if (bounded(2)) nameRandomPiece(state.pendingDoomsayer.player);
      if (!chosen) attempt({ type: 'declineDoomsayer', player: state.pendingDoomsayer.player });
    } else if (state.underElfHill?.some(entry => entry.returning && !entry.returned)) {
      for (const to of shuffle(underElfHillReturnSquares(state))) if (attempt({ type: 'returnKing', to })) break;
    } else if (state.pendingRescue) {
      cards(true);
    } else if (trace.moves >= maxMoves) {
      attempt({ type: 'endTurn' });
    } else {
      if (!state.turn.moveMade && state.effects.some(effect => {
        const item = effect as { type?: string; player?: string };
        return item.type === 'panic' && item.player === state.turn.color;
      }) && bounded(2)) attempt({ type: 'panicTimeout' });
      if (!chosen && activeDoomsayers(state).length && bounded(3) === 0) nameRandomPiece(state.turn.color);
      if (!chosen && bounded(3) !== 0) cards();
      if (!chosen && !state.turn.moveMade) {
        const moves = shuffle([...legalDests(state)].flatMap(([from, targets]) => targets.map(to => ({ from, to }))));
        for (const move of moves) {
          if (attempt({ type: 'move', ...move })) break;
          for (const promotion of shuffle(['queen', 'rook', 'bishop', 'knight'])) {
            if (attempt({ type: 'move', ...move, promotion })) break;
          }
          if (chosen) break;
        }
      }
      if (!chosen) attempt({ type: 'endTurn' });
      if (!chosen) cards();
      if (!chosen) {
        const active = activeDoomsayers(state);
        const combinations = <T>(items: T[], count: number): T[][] => count === 0 ? [[]]
          : items.flatMap((item, index) => combinations(items.slice(index + 1), count - 1).map(rest => [item, ...rest]));
        for (const name of shuffle(['pawn', 'knight', 'bishop', 'rook', 'queen'] as const)) {
          if (!active.length) break;
          const pieces = shuffle(doomsayerTargets(state, state.turn.color, name));
          for (const selected of combinations(pieces, Math.min(pieces.length, active.length))) {
            if (!selected.length) continue;
            if (attempt({ type: 'namePiece', speaker: state.turn.color, name,
              losses: selected.map((piece, index) => ({ effectId: active[index]!.card.id, pieceId: piece.id })) })) break;
          }
          if (chosen) break;
        }
      }
      if (!chosen) cards(true);
    }
    if (!chosen) { trace.failure = `No continuing action at step ${index + 1}; outcome=${JSON.stringify(state.outcome)}`; break; }
    const { action, state: after } = chosen;
    const delta = after.pieces.flatMap(piece => {
      const prior = state.pieces.find(item => item.id === piece.id);
      return JSON.stringify(prior) === JSON.stringify(piece) ? [] : [{ before: prior, after: piece }];
    });
    lines.push(JSON.stringify({ step: index + 1, move: trace.moves + (action.type === 'move' ? 1 : 0), action,
      fen: [state.fen, after.fen], turn: [state.turn, after.turn], pieces: delta,
      effects: [state.effects, after.effects], events: after.history.slice(Math.min(state.history.length, after.history.length - 1)),
      hands: (['white', 'black'] as const).map(color => ({ color,
        before: state.players[color].hand.map(card => card.cardId), after: after.players[color].hand.map(card => card.cardId),
        decks: [state.players[color].deck.length, after.players[color].deck.length],
        discard: after.players[color].discard.map(card => card.cardId) })),
      enPassant: after.enPassant, pendingRescue: !!after.pendingRescue,
      pendingAbduction: after.pendingAbduction && { phase: after.pendingAbduction.phase, pieceId: after.pendingAbduction.pieceId },
      underElfHill: after.underElfHill }));
    trace.steps.push({ action, expected: digest(after) });
    if (action.type === 'move') trace.moves++;
    try { checkTransition(state, action, after); } catch (error) { trace.failure = String(error); }
    state = after;
    if (trace.failure) break;
  }
  trace.finalFen = state.fen;
  lines.push(`FINAL ${JSON.stringify({ moves: trace.moves, fen: trace.finalFen, failure: trace.failure })}`);
  return { trace, review: lines.join('\n') + '\n' };
}
