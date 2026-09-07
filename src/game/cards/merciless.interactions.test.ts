import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions do not mutate their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown): GameState {
  const next = act(state, { type: 'playCard', cardId, target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed', `${cardId} must resolve successfully`);
  assert.equal(next.history.at(-1)?.cardId, cardId);
  return next;
}

for (const color of ['white', 'black'] as const) {
  for (const file of 'bcdefgh') {
    test(`Merciless ${color} quiet rook continuation to ${file}`, () => {
      const from = color === 'white' ? 'a1' : 'a8';
      const middle = color === 'white' ? 'a3' : 'a6';
      const to = `${file}${color === 'white' ? 3 : 6}` as SquareName;
      let state = createGameState({
        fen: color === 'white' ? '7k/8/8/8/8/8/8/R6K w - - 7 3' : 'r6k/8/8/8/8/8/8/7K b - - 7 3',
        hands: { [color]: ['merciless'] }, decks: { [color]: ['pacifism'] },
      });
      const id = state.pieces.find(piece => piece.square === from)!.id;
      state = act(state, { type: 'move', from, to: middle });
      const clocks = state.fen.split(' ').slice(4);
      state = play(state, 'merciless', [{ from: middle, to }]);
      assert.equal(state.pieces.find(piece => piece.id === id)?.square, to);
      assert.deepEqual(state.fen.split(' ').slice(4), clocks);
      assert.equal(state.turn.phase, 'afterMove');
      assert.equal(state.turn.moveMade, true);
      assert.equal(state.players[color].discard.filter(card => card.cardId === 'merciless').length, 1);
      assert.equal(state.players[color].hand[0]?.cardId, 'pacifism');
      assert.equal(applyAction(state, { type: 'move', from: to, to: middle }).ok, false);
    });
  }
}

test('Merciless follows the physical rook relocated by actual castling', () => {
  let state = createGameState({ fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', hands: { white: ['merciless'] } });
  const rookId = state.pieces.find(piece => piece.square === 'h1')!.id;
  state = act(state, { type: 'move', from: 'e1', to: 'g1' });
  state = play(state, 'merciless', [{ from: 'f1', to: 'f4' }]);
  assert.equal(state.pieces.find(piece => piece.id === rookId)?.square, 'f4');
  assert.equal(state.pieces.find(piece => piece.royal && piece.owner === 'white')?.square, 'g1');
});

test('Merciless respects an actual Pacifism marker after intervening turns', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/2p5/8/R6K w - - 7 3', hands: { white: ['pacifism', 'merciless'] } });
  state = play(state, 'pacifism', 'a1');
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a3', to: 'c3' }] }).ok, false);
  assert.deepEqual(state, before);
  state = play(state, 'merciless', [{ from: 'a3', to: 'b3' }]);
  assert.equal(state.pieces.find(piece => piece.square === 'b3')?.role, 'rook');
});

test('Merciless moves an actual Confabulation Pawn carrier with its Rook component', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/P7/8/R6K w - - 7 3', hands: { white: ['confabulation', 'merciless'] } });
  const rook = state.pieces.find(piece => piece.square === 'a1')!.id;
  const pawn = state.pieces.find(piece => piece.square === 'a3')!.id;
  state = play(state, 'confabulation', [{ from: 'a1', to: 'a3' }]);
  const effects = structuredClone(state.effects);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a3', to: 'c3' });
  state = play(state, 'merciless', [{ from: 'c3', to: 'd3' }]);
  assert.equal(state.pieces.find(piece => piece.id === pawn)?.square, 'd3');
  assert.equal(state.pieces.find(piece => piece.id === rook)?.zone, 'away');
  assert.deepEqual(state.effects, effects);
});

test('Merciless follows a Regular Move that expires actual Fatal Attraction', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 7 3', hands: { white: ['fatal-attraction', 'merciless'] } });
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  state = play(state, 'fatal-attraction', 'a1');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a3' });
  assert.equal(state.effects.length, 0);
  state = play(state, 'merciless', [{ from: 'a3', to: 'c3' }]);
  assert.equal(state.pieces.find(piece => piece.square === 'c3')?.role, 'rook');
  assert.equal(state.players.white.discard.filter(card => card.cardId === 'fatal-attraction').length, 1);
});

test('Merciless preserves the Plots Within Plots trigger through actual Fatal Attraction', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 7 3', hands: { white: ['plots-within-plots', 'fatal-attraction', 'merciless'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a3' });
  state = play(state, 'plots-within-plots');
  state = play(state, 'fatal-attraction', 'a3');
  state = play(state, 'merciless', [{ from: 'a3', to: 'c3' }]);
  assert.equal(state.pieces.find(piece => piece.square === 'c3')?.role, 'rook');
  assert.equal(state.effects.length, 0);
  assert.equal(state.turn.cardPlays.white, 3);
  assert.equal(state.players.white.discard.filter(card => card.cardId === 'fatal-attraction').length, 1);
});

test('Merciless cannot use a quiet Rook relocation made by actual Dubbing', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 7 3', hands: { white: ['plots-within-plots', 'dubbing', 'merciless'] } });
  state = play(state, 'plots-within-plots');
  state = play(state, 'dubbing', [{ from: 'a1', to: 'c2' }]);
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'merciless', target: [{ from: 'c2', to: 'c3' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(state, before);
});

for (let seed = 1; seed <= 20; seed += 1) {
  test(`Merciless seeded legal continuation ${seed}`, () => {
    let state = createGameState({
      fen: '7k/8/8/8/8/8/8/R6K w - - 7 3', hands: { white: ['merciless'] },
    });
    const ids = state.pieces.map(piece => piece.id).sort();
    state = act(state, { type: 'move', from: 'a1', to: 'a3' });
    state = play(state, 'merciless', [{ from: 'a3', to: 'c3' }]);
    let random = seed;
    for (let ply = 0; ply < 4; ply += 1) {
      if (state.turn.moveMade) state = act(state, { type: 'endTurn' });
      const choices = [...legalDests(state, false)].flatMap(([from, destinations]) =>
        destinations.map(to => ({ from, to })));
      assert.ok(choices.length, 'continuation has a legal move');
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = choices[random % choices.length];
      const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === move.from)!;
      const mover: Color = state.turn.color;
      const promotion = piece.role === 'pawn' && isPromotionSquare(state, piece.owner, move.to) ? 'queen' as const : undefined;
      state = act(state, { type: 'move', ...move, ...(promotion ? { promotion } : {}) });
      assert.deepEqual(state.pieces.map(candidate => candidate.id).sort(), ids);
      const squares = state.pieces.filter(candidate => candidate.zone === 'board').map(candidate => candidate.square);
      assert.equal(new Set(squares).size, squares.length);
      for (const candidate of state.pieces) {
        assert.equal(candidate.square !== null, candidate.zone === 'board');
        if (candidate.square !== null) assert.match(candidate.square, /^[a-h][1-8]$/);
      }
      assert.equal(boardFen(state).split(' ')[0], state.fen.split(' ')[0]);
      assert.equal(isKingInCheck(state, mover), false);
    }
  });
}
