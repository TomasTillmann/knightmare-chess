// Curse focused behavior tests, authored independently before implementation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, legalDests, isKingInCheck } from '../reducer.js';
import type { GameState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

function fixture(role = 'r', fen?: string): GameState {
  return createGameState({
    fen: fen ?? `7k/8/8/3${role}4/8/8/7P/K7 w - - 0 1`,
    phase: 'afterMove', moveMade: true, hands: { white: ['curse'] },
  });
}

function act(state: GameState, action: Parameters<typeof applyAction>[1]): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? 'action succeeds' : result.error.message);
  return result.state;
}

function curse(state = fixture()): GameState {
  const next = act(state, { type: 'playCard', cardId: 'curse', target: 'd5' });
  assert.equal(next.effects.length, state.effects.length + 1);
  return next;
}

function blackTurn(state: GameState): GameState {
  return act(state, { type: 'endTurn' });
}

test('Curse has the printed timing, value, uniqueness and continuing metadata', () => {
  const card = CARD_CATALOG.curse;
  assert.ok(card);
  assert.equal(card.points, 6);
  assert.equal(card.unique, false);
  assert.deepEqual(card.timing, ['afterMove']);
  assert.equal(card.continuing, true);
});

test('Curse enumerates only opposing Queens, Bishops and Rooks', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { white: ['curse'] } });
  assert.deepEqual(cardPlayTargets(state, 'curse').sort(), ['a8', 'c8', 'd8', 'f8', 'h8']);
});

test('Curse cannot be played before the Regular Move', () => {
  const state = fixture();
  state.turn.phase = 'beforeMove';
  state.turn.moveMade = false;
  const result = applyAction(state, { type: 'playCard', cardId: 'curse', target: 'd5' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
});

for (const [name, target] of [['empty', 'c6'], ['own pawn', 'h2'], ['king', 'h8'], ['malformed square', 'z9'], ['missing', undefined], ['move list', [{ from: 'd5', to: 'd4' }]]] as const) {
  test(`Curse rejects a ${name} target without changing input`, () => {
    const state = fixture();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'curse', target });
    assert.equal(result.ok, false);
    assert.deepEqual(state, before);
  });
}

for (const role of ['p', 'n']) {
  test(`Curse rejects an opposing ${role === 'p' ? 'Pawn' : 'Knight'}`, () => {
    const result = applyAction(fixture(role), { type: 'playCard', cardId: 'curse', target: 'd5' });
    assert.equal(result.ok, false);
  });
}

test('Curse cannot mark an owned Rook', () => {
  const state = fixture('r', '7k/8/8/3R4/8/8/7P/K7 w - - 0 1');
  const result = applyAction(state, { type: 'playCard', cardId: 'curse', target: 'd5' });
  assert.equal(result.ok, false);
});

const sliders = [
  { role: 'r', one: 'd4', two: 'd3', far: 'd2' },
  { role: 'b', one: 'c4', two: 'b3', far: 'a2' },
  { role: 'q', one: 'd4', two: 'd3', far: 'd2' },
] as const;

for (const { role, one, two, far } of sliders) {
  test(`Curse limits a ${role} to one or two squares and rejects longer moves`, () => {
    const state = fixture(role);
    const baseline = blackTurn(state);
    const beforeDests = legalDests(baseline).get('d5') ?? [];
    for (const square of [one, two, far]) assert.ok(beforeDests.includes(square), `fixture permits ${square}`);
    const marked = blackTurn(curse(state));
    const dests = legalDests(marked).get('d5') ?? [];
    assert.ok(dests.includes(one));
    assert.ok(dests.includes(two));
    assert.ok(!dests.includes(far));
    for (const to of [one, two]) assert.equal(applyAction(marked, { type: 'move', from: 'd5', to }).ok, true);
    assert.equal(applyAction(marked, { type: 'move', from: 'd5', to: far }).ok, false);
  });
}

for (const [distance, pawnRank, to, expected] of [[2, '3P4', 'd3', true], [3, '3P4', 'd2', false]] as const) {
  test(`A cursed Rook ${expected ? 'can' : 'cannot'} capture at distance ${distance}`, () => {
    const fen = distance === 2 ? `7k/8/8/3r4/8/${pawnRank}/8/K7 w - - 0 1` : `7k/8/8/3r4/8/8/${pawnRank}/K7 w - - 0 1`;
    const state = fixture('r', fen);
    assert.ok(legalDests(blackTurn(state)).get('d5')?.includes(to));
    const result = applyAction(blackTurn(curse(state)), { type: 'move', from: 'd5', to });
    assert.equal(result.ok, expected);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.owner === 'white' && piece.role === 'pawn')?.zone, 'captured');
  });
}

for (const role of ['r', 'b', 'q']) {
  test(`A cursed ${role} attacks two squares away but not three`, () => {
    const bishop = role === 'b';
    const king = bishop ? 'b2' : 'c2';
    const far = bishop ? 'a2' : 'd2';
    const near = bishop ? 'b3' : 'd3';
    const state = fixture(role, `7k/8/8/3${role}4/8/8/${bishop ? '1K6' : '2K5'}/8 w - - 0 1`);
    assert.equal(isKingInCheck(state, 'white'), false);
    let marked = blackTurn(curse(state));
    assert.ok(legalDests(marked).get('h8')?.includes('h7'));
    marked = act(marked, { type: 'move', from: 'h8', to: 'h7' });
    marked = act(marked, { type: 'endTurn' });
    const destinations = legalDests(marked).get(king as SquareName) ?? [];
    assert.ok(destinations.includes(far as SquareName), 'long ray no longer attacks');
    assert.ok(!destinations.includes(near as SquareName), 'short ray still attacks');
  });
}

test('Curse stays attached after its piece moves and a full turn passes', () => {
  let state = blackTurn(curse());
  state = act(state, { type: 'move', from: 'd5', to: 'd3' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a1')?.includes('b1'));
  state = act(state, { type: 'move', from: 'a1', to: 'b1' });
  state = act(state, { type: 'endTurn' });
  const dests = legalDests(state).get('d3') ?? [];
  assert.ok(dests.includes('d5'));
  assert.ok(!dests.includes('d6'));
  assert.equal(state.effects.length, 1);
});

test('Curse is retained beside the board and does not discard itself', () => {
  const state = curse();
  assert.equal(state.players.white.hand.some(card => card.cardId === 'curse'), false);
  assert.equal(state.players.white.discard.some(card => card.cardId === 'curse'), false);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
});

test('Successful Curse leaves its input unchanged and preserves piece identity', () => {
  const state = fixture();
  const before = structuredClone(state);
  const marked = curse(state);
  assert.deepEqual(state, before);
  assert.deepEqual(marked.pieces, state.pieces);
  assert.equal(marked.fen, state.fen);
});
