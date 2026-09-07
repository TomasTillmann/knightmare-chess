import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFen } from 'chessops/fen';
import { makeSquare } from 'chessops/util';

import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import type { ForbiddenCityEffect, GameAction, GameState, SquareName } from '../types.js';

const SQUARE = /^[a-h][1-8]$/;

interface RunStats {
  transitions: number;
  probes: number;
}

function isForbiddenCity(effect: unknown): effect is ForbiddenCityEffect {
  return typeof effect === 'object' && effect !== null
    && (effect as { type?: unknown }).type === 'forbidden-city';
}

function validate(state: GameState): number {
  const before = JSON.stringify(state);
  const boardPieces = state.pieces.filter(piece => piece.zone === 'board');
  const squares = boardPieces.map(piece => piece.square);

  for (const piece of state.pieces) {
    assert.equal(piece.zone === 'board', piece.square !== null, `${piece.id}: square/zone mismatch`);
    if (piece.square !== null) assert.match(piece.square, SQUARE, `${piece.id}: non-canonical square`);
  }
  assert.equal(new Set(squares).size, squares.length, 'board squares must be unique');

  const parsed = parseFen(state.fen);
  assert.equal(parsed.isOk, true, 'FEN must parse');
  const setup = parsed.unwrap();
  const fenBoard = [...setup.board]
    .map(([square, piece]) => `${makeSquare(square)}:${piece.color}:${piece.role}`)
    .sort();
  const pieceBoard = boardPieces
    .map(piece => `${piece.square}:${piece.owner}:${piece.role}`)
    .sort();
  assert.deepEqual(fenBoard, pieceBoard, 'FEN and piece registry must agree');

  const markers = state.effects.filter(isForbiddenCity).map(effect => effect.square);
  for (const marker of markers) {
    assert.match(marker, SQUARE, 'marker square must be canonical');
    assert.equal(squares.includes(marker), false, `marker ${marker} must stay unoccupied`);
  }
  assert.equal(new Set(markers).size, markers.length, 'marker squares must be unique');

  let probes = 0;
  for (const [from, destinations] of legalDests(state)) {
    const piece = boardPieces.find(candidate => candidate.square === from);
    assert.ok(piece, `legal move origin ${from} must contain a piece`);
    for (const to of destinations) {
      probes += 1;
      assert.equal(markers.includes(to), false, `legal move ${from}-${to} lands on a marker`);
      if (piece.role === 'knight') continue;

      const fileDistance = to.charCodeAt(0) - from.charCodeAt(0);
      const rankDistance = Number(to[1]) - Number(from[1]);
      assert.ok(
        fileDistance === 0 || rankDistance === 0 || Math.abs(fileDistance) === Math.abs(rankDistance),
        `non-jumping move ${from}-${to} must have a straight path`,
      );
      const steps = Math.max(Math.abs(fileDistance), Math.abs(rankDistance));
      for (let step = 1; step < steps; step += 1) {
        const crossed = `${String.fromCharCode(from.charCodeAt(0) + Math.sign(fileDistance) * step)}${Number(from[1]) + Math.sign(rankDistance) * step}`;
        assert.equal(markers.includes(crossed as SquareName), false, `legal move ${from}-${to} crosses marker ${crossed}`);
      }
    }
  }
  assert.equal(JSON.stringify(state), before, 'public queries must not mutate state');
  return probes;
}

function accepted(state: GameState, action: GameAction, stats: RunStats): GameState {
  const before = JSON.stringify(state);
  const result = applyAction(state, action);
  assert.equal(JSON.stringify(state), before, `${action.type} mutated its input`);
  if (!result.ok) assert.fail(`${action.type} failed: ${result.error.code} ${result.error.message}`);
  stats.transitions += 1;
  stats.probes += validate(result.state);
  return result.state;
}

function run(seed: number): void {
  let random = seed >>> 0;
  const pick = <T>(values: readonly T[]): T => {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    return values[(random >>> 0) % values.length]!;
  };
  const stats: RunStats = { transitions: 0, probes: 0 };
  let state = createGameState({
    hands: { white: ['forbidden-city'], black: ['forbidden-city'] },
  });
  stats.probes += validate(state);

  let plies = 0;
  let noMoves = false;
  while (plies < 20 && !state.outcome) {
    const moves = [...legalDests(state)].flatMap(([from, destinations]) =>
      destinations.map(to => ({ from, to }))
    );
    if (moves.length === 0) {
      noMoves = true;
      break;
    }

    plies += 1;
    const move = pick(moves);
    state = accepted(state, { type: 'move', ...move }, stats);
    if (state.outcome) break;

    const card = state.players[state.turn.color].hand.find(instance => instance.cardId === 'forbidden-city');
    if (card) {
      const targetInput = JSON.stringify(state);
      const targets = cardPlayTargets(state, card.cardId);
      assert.equal(JSON.stringify(state), targetInput, 'cardPlayTargets mutated its input');
      assert.ok(targets.length > 0, 'Forbidden City must have a legal marker square after a move');
      assert.ok(targets.every(target => typeof target === 'string' && SQUARE.test(target)));
      state = accepted(state, {
        type: 'playCard',
        cardId: card.cardId,
        cardInstanceId: card.id,
        target: pick(targets),
      }, stats);
    }
    state = accepted(state, { type: 'endTurn' }, stats);
  }

  assert.ok(plies >= 20 || state.outcome !== null || noMoves, 'run stopped before 20 plies without a terminal state');
  assert.deepEqual(
    new Set(state.effects.filter(isForbiddenCity).map(effect => effect.owner)),
    new Set(['white', 'black']),
    'both players must place their marker',
  );
  console.log(`seed=${seed} plies=${plies} transitions=${stats.transitions} legal-probes=${stats.probes}`);
}

test('Forbidden City random regression seed 1', () => run(0x1234_5678));
test('Forbidden City random regression seed 2', () => run(0x2345_6789));
test('Forbidden City random regression seed 3', () => run(0x3456_789a));
test('Forbidden City random regression seed 4', () => run(0x4567_89ab));
test('Forbidden City random regression seed 5', () => run(0x5678_9abc));
