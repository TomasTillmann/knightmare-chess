import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer.js';
import { parseFen } from 'chessops/fen';
import { makeSquare } from 'chessops/util';
import type { CardMove, GameAction, GameState, SquareName } from '../types.js';

const setup = (fen = '7k/8/8/8/8/8/8/KN6 w - - 0 1') => createGameState({ fen, hands: { white: ['charge'] } });
function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions must not mutate their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}
const move = (state: GameState, from: SquareName, to: SquareName) => act(state, { type: 'move', from, to });
const charge = (state: GameState, from: SquareName = 'c3', to: SquareName = 'd5') => ({
  type: 'playCard' as const, cardId: 'charge', cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === 'charge')!.id,
  target: [{ from, to }],
});
const ready = (state = setup()) => move(state, 'b1', 'c3');
function reject(state: GameState, action: GameAction) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(state, before);
  assert.deepEqual(result.state, before);
}
function marker(state: GameState, type: 'pacifism' | 'truce', square?: SquareName) {
  state.effects.push({ type, owner: 'black', card: { id: `effect-${type}`, cardId: type },
    ...(square ? { pieceId: state.pieces.find(piece => piece.square === square)!.id } : {}) } as Extract<GameState['effects'][number], { type: 'pacifism' | 'truce' }>);
}
test('Charge cannot be played before the regular move', () => {
  const state = setup();
  reject(state, charge(state, 'b1', 'c3'));
});
test('Charge follows a quiet Knight move with another move of that Knight', () => {
  const state = ready();
  const result = act(state, charge(state));
  assert.equal(result.pieces.find(piece => piece.id === 'white-knight-b1')?.square, 'd5');
  assert.equal(result.turn.cardPlays.white, 1);
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.players.white.discard.filter(card => card.cardId === 'charge').length, 1);
});
test('Charge respects an already spent card allowance', () => {
  const state = ready();
  state.turn.cardPlays.white = 1;
  reject(state, charge(state));
});
test('Charge does not permit another card that turn', () => {
  const initial = setup();
  initial.players.white.hand.push({ id: 'second-charge', cardId: 'charge' });
  const moved = ready(initial);
  const state = act(moved, charge(moved));
  reject(state, charge(state, 'd5', 'f6'));
});
test('Charge does not permit a third ordinary move', () => {
  const state = ready();
  const result = act(state, charge(state));
  reject(result, { type: 'move', from: 'd5', to: 'f6' });
  assert.equal(legalDests(result).size, 0);
});
test('Charge cannot follow a first-move capture', () => {
  const state = ready(setup('7k/8/8/8/8/2p5/8/KN6 w - - 0 1'));
  reject(state, charge(state));
});
test('Charge cannot substitute a different Knight', () => {
  const state = ready(setup('7k/8/8/8/8/8/8/KN4N1 w - - 0 1'));
  reject(state, charge(state, 'g1', 'f3'));
});
for (const type of ['pacifism', 'truce'] as const) {
  test(`Charge allows a quiet second move under ${type}`, () => {
    const initial = setup();
    marker(initial, type, type === 'pacifism' ? 'b1' : undefined);
    const state = ready(initial);
    const result = act(state, charge(state));
    assert.equal(result.pieces.find(piece => piece.id === 'white-knight-b1')?.square, 'd5');
    assert.equal(result.effects.length, 1);
  });
  test(`Charge cannot capture under ${type}`, () => {
    const initial = setup('7k/8/8/3p4/8/8/8/KN6 w - - 0 1');
    marker(initial, type, type === 'pacifism' ? 'b1' : undefined);
    const state = ready(initial);
    reject(state, charge(state));
  });
}
test('Charge cannot capture a Pacifist target', () => {
  const initial = setup('7k/8/8/3p4/8/8/8/KN6 w - - 0 1');
  marker(initial, 'pacifism', 'd5');
  const state = ready(initial);
  reject(state, charge(state));
});
for (const [square, permitted] of [['d5', false], ['c4', true]] as const) {
  test(`Charge ${permitted ? 'jumps over' : 'cannot enter'} Forbidden City at ${square}`, () => {
    const initial = setup();
    initial.effects.push({ type: 'forbidden-city', owner: 'black', card: { id: 'city', cardId: 'forbidden-city' }, square });
    const state = ready(initial);
    if (permitted) assert.equal(act(state, charge(state)).pieces.find(piece => piece.id === 'white-knight-b1')?.square, 'd5');
    else reject(state, charge(state));
  });
}
test('Challenge permits the selected Knight to finish its Charge', () => {
  const initial = setup();
  initial.effects.push({ type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-knight-b1' });
  const state = ready(initial);
  assert.equal(act(state, charge(state)).pieces.find(piece => piece.id === 'white-knight-b1')?.square, 'd5');
});
for (const identity of ['neutral', 'promoted', 'royal'] as const) {
  test(`Charge preserves ${identity} Knight identity`, () => {
    const initial = setup();
    const knight = initial.pieces.find(piece => piece.square === 'b1')!;
    if (identity === 'neutral') knight.neutral = true;
    else if (identity === 'promoted') { knight.originalRole = 'pawn'; knight.promoted = true; }
    else {
      initial.pieces.find(piece => piece.role === 'king' && piece.owner === 'white')!.royal = false;
      knight.royal = true;
    }
    const before = { ...knight };
    const state = ready(initial);
    const result = act(state, charge(state));
    assert.deepEqual(result.pieces.find(piece => piece.id === knight.id), { ...before, square: 'd5' });
  });
}
test('Charge fizzles when its second move exposes its own King', () => {
  const state = ready(setup('2r4k/8/8/8/8/8/8/1NK5 w - - 0 1'));
  assert.equal(isKingInCheck(state, 'white'), false);
  const result = act(state, charge(state));
  assert.deepEqual(result.pieces, state.pieces);
  assert.equal(result.players.white.discard.some(card => card.cardId === 'charge'), true);
  assert.equal(result.history.at(-1)?.reason, 'SELF_CHECK');
});
test('Charge fizzles when its second move directly checkmates', () => {
  const state = move(setup('6rk/6pp/8/1N6/8/8/8/K7 w - - 0 1'), 'b5', 'd6');
  const result = act(state, charge(state, 'd6', 'f7'));
  assert.deepEqual(result.pieces, state.pieces);
  assert.equal(result.players.white.discard.some(card => card.cardId === 'charge'), true);
  assert.equal(result.history.at(-1)?.reason, 'DIRECT_MATE');
});
test('Black Charge captures only on its second move', () => {
  const initial = createGameState({ fen: 'kn6/8/8/8/3P4/8/8/7K b - - 0 1', hands: { black: ['charge'] } });
  const state = move(initial, 'b8', 'c6');
  const result = act(state, charge(state, 'c6', 'd4'));
  assert.equal(result.pieces.find(piece => piece.id === 'black-knight-b8')?.square, 'd4');
  assert.equal(result.pieces.find(piece => piece.id === 'white-pawn-d4')?.zone, 'captured');
});

for (let seed = 1; seed <= 20; seed++) {
  test(`Charge seeded random legal-move integration ${seed}`, () => {
    let random = seed;
    const pick = (count: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % count; };
    let state = createGameState({ fen: 'r3k2r/ppp2ppp/8/8/8/8/PPP2PPP/RN2K2R w - - 0 1', hands: { white: ['charge'] } });
    const identities = state.pieces.map(({ square: _square, zone: _zone, capturedBy: _capturedBy, ...piece }) => piece);
    const cardIds = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard].map(card => card.id)).sort();
    const destinations: SquareName[] = ['a4', 'b5', 'd5', 'e4'];
    state = move(state, 'b1', 'c3');
    const destination = destinations[pick(destinations.length)];
    state = act(state, charge(state, 'c3', destination));
    assert.equal(state.pieces.find(piece => piece.id === 'white-knight-b1')?.square, destination, 'every seed must execute Charge successfully');
    let moves = 0;
    for (let ply = 0; ply < 4; ply++) {
      state = act(state, { type: 'endTurn' });
      const candidates: CardMove[] = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(candidates.length > 0);
      const selected = candidates[pick(candidates.length)];
      const mover = state.pieces.find(piece => piece.square === selected.from)!;
      const victim = state.pieces.find(piece => piece.zone === 'board' && piece.square === selected.to);
      const capturer = state.turn.color;
      state = act(state, { type: 'move', ...selected });
      if (victim) assert.equal(state.pieces.find(piece => piece.id === victim.id)?.capturedBy, capturer);
      moves++;
      assert.equal(state.pieces.find(piece => piece.id === mover.id)?.square, selected.to);
      assert.equal(isKingInCheck(state, state.turn.color), false);
      assert.deepEqual(state.pieces.map(({ square: _square, zone: _zone, capturedBy: _capturedBy, ...piece }) => piece), identities);
      assert.deepEqual(Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard].map(card => card.id)).sort(), cardIds);
      const board = state.pieces.filter(piece => piece.zone === 'board');
      assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
      const parsed = parseFen(boardFen(state)).unwrap().board;
      assert.deepEqual([...parsed].map(([square, piece]) => `${makeSquare(square)}:${piece.color}:${piece.role}`).sort(),
        board.map(piece => `${piece.square}:${piece.owner}:${piece.role}`).sort());
    }
    assert.equal(moves, 4);
  });
}
