import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const fixture = (fen = '7k/p7/8/8/3P3r/8/P7/K7 w - - 0 1'): GameState =>
  createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['man-trap'], black: ['no-quarter'] } });

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed', JSON.stringify(result.state.history.at(-1)));
  return result.state;
}
const move = (state: GameState, from: SquareName, to: SquareName) => act(state, { type: 'move', from, to });
const end = (state: GameState) => act(state, { type: 'endTurn' });
const play = (state: GameState, cardId: string, target?: unknown) => act(state, { type: 'playCard', cardId, target });
const traps = (state: GameState) => state.effects.filter(effect => (effect as { type?: string }).type === 'man-trap');
const piece = (state: GameState, id: string) => state.pieces.find(candidate => candidate.id === id)!;
const armed = (state = fixture()) => end(play(state, 'man-trap', 'd4'));

test('No Quarter retains the original opposing victim after the captor springs Man-Trap', () => {
  let state = move(armed(), 'h4', 'd4');
  assert.equal(piece(state, 'white-pawn-d4').zone, 'captured');
  assert.equal(piece(state, 'black-rook-h4').zone, 'captured');
  state = play(state, 'no-quarter');
  assert.equal(piece(state, 'white-pawn-d4').zone, 'dead');
  assert.equal(piece(state, 'black-rook-h4').zone, 'captured');
});

test('a delayed empty-square arrival cannot turn the trapped mover into a No Quarter victim', () => {
  let state = move(armed(), 'a7', 'a6');
  state = end(move(end(state), 'd4', 'd5'));
  state = move(state, 'h4', 'd4');
  assert.equal(piece(state, 'black-rook-h4').zone, 'captured');
  const result = applyAction(state, { type: 'playCard', cardId: 'no-quarter' });
  assert.equal(result.ok, false);
  assert.equal(piece(result.state, 'black-rook-h4').zone, 'captured');
});

test('No Quarter still applies to a King capture that consumes an otherwise harmless trap', () => {
  let state = armed(fixture('8/p7/8/4k3/3P4/8/P7/K7 w - - 0 1'));
  state = move(state, 'e5', 'd4');
  assert.equal(piece(state, 'black-king-e5').square, 'd4');
  assert.equal(traps(state).length, 0);
  state = play(state, 'no-quarter');
  assert.equal(piece(state, 'white-pawn-d4').zone, 'dead');
});

test('leaving the armed square preserves the fixed square until an enemy arrives', () => {
  let state = move(armed(), 'a7', 'a6');
  state = move(end(state), 'd4', 'd5');
  assert.equal(traps(state).length, 1);
  state = move(end(state), 'h4', 'd4');
  assert.equal(piece(state, 'white-pawn-d4').square, 'd5');
  assert.equal(piece(state, 'black-rook-h4').zone, 'captured');
});

test('an owner arrival does not consume the trap before the next opposing arrival', () => {
  let state = armed(fixture('7k/p7/8/8/3R3r/8/P7/K7 w - - 0 1'));
  state = end(move(state, 'a7', 'a6'));
  state = end(move(state, 'd4', 'd3'));
  state = end(move(state, 'a6', 'a5'));
  state = end(move(state, 'd3', 'd4'));
  assert.equal(traps(state).length, 1);
  state = move(state, 'h4', 'd4');
  assert.equal(piece(state, 'white-rook-d4').zone, 'captured');
  assert.equal(piece(state, 'black-rook-h4').zone, 'captured');
});

test('springing one of two different traps leaves the other square armed', () => {
  let state = createGameState({ fen: '7k/p7/8/8/2PP3r/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['man-trap', 'man-trap'] } });
  state = armed(state);
  state = end(move(state, 'a7', 'a6'));
  state = play(move(state, 'a2', 'a3'), 'man-trap', 'c4');
  state = move(end(state), 'h4', 'd4');
  assert.deepEqual(traps(state).map(effect => (effect as { square: string }).square), ['c4']);
  assert.equal(piece(state, 'white-pawn-c4').zone, 'board');
});

test('a merged opposing mover loses both physical components when it springs a trap', () => {
  let state = createGameState({ fen: '7k/p7/8/8/3P3n/7r/P7/K7 b - - 0 1', hands: { white: ['man-trap'], black: ['confabulation', 'no-quarter'] } });
  state = play(state, 'confabulation', [{ from: 'h3', to: 'h4' }]);
  state = end(state);
  state = end(play(move(state, 'a2', 'a3'), 'man-trap', 'd4'));
  state = move(state, 'h4', 'd4');
  assert.equal(piece(state, 'black-rook-h3').zone, 'captured');
  assert.equal(piece(state, 'black-knight-h4').zone, 'captured');
  state = play(state, 'no-quarter');
  assert.equal(piece(state, 'white-pawn-d4').zone, 'dead');
  assert.equal(piece(state, 'black-rook-h3').zone, 'captured');
  assert.equal(piece(state, 'black-knight-h4').zone, 'captured');
});

test('Anathema is not an arrival move even when it swaps an opposing Rook onto the trap', () => {
  let state = createGameState({ fen: '7k/p7/8/8/3B3r/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['man-trap', 'anathema'] } });
  piece(state, 'white-bishop-d4').neutral = true;
  state = armed(state);
  state = end(move(state, 'a7', 'a6'));
  state = play(move(state, 'a2', 'a3'), 'anathema', { bishop: 'd4', rook: 'h4' });
  assert.equal(piece(state, 'black-rook-h4').square, 'd4');
  assert.equal(piece(state, 'black-rook-h4').zone, 'board');
  assert.equal(traps(state).length, 1);
});

test('Siege preserves a trap when its non-capturing swap puts the opponent on its square', () => {
  let state = createGameState({ fen: '7k/p7/8/8/3N3r/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['man-trap'], black: ['siege'] } });
  piece(state, 'white-knight-d4').neutral = true;
  state = armed(state);
  state = play(move(state, 'a7', 'a6'), 'siege', { knight: 'd4', rook: 'h4' });
  assert.equal(piece(state, 'black-rook-h4').square, 'd4');
  assert.equal(piece(state, 'black-rook-h4').zone, 'board');
  assert.equal(traps(state).length, 1);
});
