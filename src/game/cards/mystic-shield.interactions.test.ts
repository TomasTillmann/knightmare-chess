import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, legalDests, isKingInCheck, isPromotionSquare } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions do not mutate their input');
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}
function play(state: GameState, cardId: string, target?: unknown): GameState {
  const next = act(state, { type: 'playCard', cardId, target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, cardId);
  return next;
}

test('Mystic Shield blocks the indirect capture from Evil Eye', () => {
  let state = createGameState({ fen: fixtures[0][1], hands: { white: ['mystic-shield'], black: ['evil-eye'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(play(state, 'mystic-shield', 'e4'), { type: 'endTurn' });
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'evil-eye', target: { attacker: 'd5', victim: 'e4' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Mystic Shield leaves the en-passant opportunity recorded but forbids its capture', () => {
  let state = createGameState({ fen: '7k/8/8/8/3p4/8/4P3/7K w - - 7 3', hands: { white: ['mystic-shield'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(state.enPassant[0]?.target, 'e3');
  state = act(play(state, 'mystic-shield', 'e4'), { type: 'endTurn' });
  assert.equal(state.enPassant[0]?.target, 'e3');
  assert.ok(!legalDests(state, false).get('d4')?.includes('e3'));
  const result = applyAction(state, { type: 'move', from: 'd4', to: 'e3' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Mystic Shield permits Disintegration death during the protected opponent turn', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/4r3/7K w - - 7 3', hands: { white: ['mystic-shield'], black: ['disintegration'] } });
  const pawn = state.pieces.find(piece => piece.square === 'e2')!;
  pawn.neutral = true;
  pawn.originalRole = 'pawn';
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  const id = state.pieces.find(piece => piece.square === 'e4')!.id;
  state = play(state, 'mystic-shield', 'e4');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = play(state, 'disintegration', 'e4');
  assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'dead');
});

test('Mystic Shield protects both physical components until the opposing turn ends', () => {
  let state = createGameState({ fen: '7k/8/8/1p6/8/2N5/P7/7K w - - 7 3', hands: { white: ['confabulation', 'mystic-shield'] } });
  state = play(state, 'confabulation', [{ from: 'c3', to: 'a2' }]);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a4' });
  state = act(play(state, 'mystic-shield', 'a4'), { type: 'endTurn' });
  const rejected = applyAction(state, { type: 'move', from: 'b5', to: 'a4' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);
  state = act(state, { type: 'move', from: 'g8', to: 'h8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b5', to: 'a4' });
  for (const id of ['white-pawn-a2', 'white-knight-c3']) {
    assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'captured');
  }
});

test('Peace Talks cannot cancel temporary Mystic Shield', () => {
  let state = createGameState({ fen: fixtures[0][1], hands: { white: ['mystic-shield'], black: ['peace-talks'] } });
  const shieldId = state.players.white.hand[0]!.id;
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(play(state, 'mystic-shield', 'e4'), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target: shieldId });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
  assert.equal(state.players.black.hand[0]?.cardId, 'peace-talks');
});

for (const shieldFirst of [false, true]) {
  test(`Plots Within Plots preserves the shielded Rook identity with Merciless (shield first: ${shieldFirst})`, () => {
    let state = createGameState({ fen: '7k/8/8/1p6/8/8/8/R6K w - - 7 3', hands: { white: ['plots-within-plots', 'merciless', 'mystic-shield'] } });
    state = act(state, { type: 'move', from: 'a1', to: 'a3' });
    const id = state.pieces.find(piece => piece.square === 'a3')!.id;
    state = play(state, 'plots-within-plots');
    if (shieldFirst) state = play(state, 'mystic-shield', 'a3');
    state = play(state, 'merciless', [{ from: 'a3', to: 'a4' }]);
    if (!shieldFirst) state = play(state, 'mystic-shield', 'a4');
    assert.equal(state.pieces.find(piece => piece.id === id)?.square, 'a4');
    state = act(state, { type: 'endTurn' });
    const result = applyAction(state, { type: 'move', from: 'b5', to: 'a4' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

test('Revenge may capture the shielded mover before the opposing turn starts', () => {
  let state = createGameState({ fen: '7k/8/8/8/3p4/4P3/8/7K w - - 7 3', hands: { white: ['mystic-shield'], black: ['revenge'] } });
  state = act(state, { type: 'move', from: 'e3', to: 'd4' });
  const id = state.pieces.find(piece => piece.square === 'd4')!.id;
  state = play(state, 'mystic-shield', 'd4');
  state = play(state, 'revenge', 'd4');
  assert.equal(state.turn.color, 'white');
  assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'captured');
});

for (let seed = 1; seed <= 20; seed += 1) {
  test(`Mystic Shield seeded continuation ${seed}: four actual legal plies preserve invariants`, () => {
    let state = createGameState({ hands: { white: ['mystic-shield'] } });
    state = act(state, { type: 'move', from: 'e2', to: 'e4' });
    state = act(play(state, 'mystic-shield', 'e4'), { type: 'endTurn' });
    const identities = state.pieces.map(piece => piece.id).sort();
    let random = seed;
    for (let ply = 0; ply < 4; ply += 1) {
      const options = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(options.length > 0, `seed ${seed}, ply ${ply}: nonempty fixture`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const { from, to } = options[random % options.length]!;
      const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === from)!;
      const player = state.turn.color;
      const promotion = piece.role === 'pawn' && isPromotionSquare(state, piece.owner, to) ? 'queen' : undefined;
      state = act(state, { type: 'move', from, to, promotion });
      assert.equal(isKingInCheck(state, player), false);
      assert.deepEqual(state.pieces.map(candidate => candidate.id).sort(), identities);
      const occupied = state.pieces.filter(candidate => candidate.zone === 'board').map(candidate => candidate.square);
      assert.ok(occupied.every(square => square !== null));
      assert.equal(new Set(occupied).size, occupied.length);
      assert.ok(state.pieces.filter(candidate => candidate.zone !== 'board').every(candidate => candidate.square === null));
      assert.equal(boardFen(state), state.fen.split(' ')[0]);
      state = act(state, { type: 'endTurn' });
    }
  });
}
const fixtures = [
  ['Pawn', '7k/8/8/3p4/8/8/4P3/7K w - - 7 3', 'e2', 'e4', 'd5'],
  ['Knight', '7k/8/8/8/4p3/8/8/6NK w - - 7 3', 'g1', 'f3', 'e4'],
  ['Bishop', '7k/8/8/8/5p2/8/8/2B4K w - - 7 3', 'c1', 'e3', 'f4'],
  ['Rook', '7k/8/8/8/1p6/8/8/R6K w - - 7 3', 'a1', 'a3', 'b4'],
  ['Queen', '7k/8/8/8/4p3/8/8/3Q3K w - - 7 3', 'd1', 'd3', 'e4'],
] as const;
for (const [role, fen, from, to, captor] of fixtures) {
  const moved = () => act(createGameState({ fen, hands: { white: ['mystic-shield'] } }), { type: 'move', from, to });
  const protectedTurn = () => act(play(moved(), 'mystic-shield', to), { type: 'endTurn' });
  test(`Mystic Shield interaction: ${role} cannot be captured on the protected turn`, () => {
    const state = protectedTurn();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'move', from: captor, to });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
  test(`Mystic Shield interaction: ${role} can be captured after expiry`, () => {
    let state = act(protectedTurn(), { type: 'move', from: 'h8', to: 'g8' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h1', to: 'g1' });
    state = act(state, { type: 'endTurn' });
    const victim = state.pieces.find(piece => piece.square === to)!;
    state = act(state, { type: 'move', from: captor, to });
    assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  });
  test(`Mystic Shield interaction: ${role} identity, clocks and move status survive the card`, () => {
    const before = moved();
    const after = play(before, 'mystic-shield', to);
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, before.fen);
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.equal(after.turn.phase, before.turn.phase);
    assert.equal(after.turn.moveMade, before.turn.moveMade);
  });
}
