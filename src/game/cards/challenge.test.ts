import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
const setup = () => createGameState({ fen: FEN, phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}

test('Challenge advertises and accepts a Queen-Knight composite as a Knight', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/3Q4/KN6 w - - 0 1', hands: { white: ['confabulation'], black: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'd2' }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  const advertised = cardPlayTargets(state, 'challenge').includes('d2');
  const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'd2' });
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  assert.equal(advertised, true);
});

for (const fixture of [
  { color: 'white', opponent: 'black', carrier: 'Queen', fen: '7k/8/8/8/8/8/3Q4/KN3N2 w - - 0 1', from: 'b1', to: 'd2', reply: ['h8', 'g8'], other: ['f1', 'h2'], moves: ['f3', 'd3'] },
  { color: 'white', opponent: 'black', carrier: 'Knight', fen: '7k/8/8/8/8/8/3N4/K2Q1N2 w - - 0 1', from: 'd1', to: 'd2', reply: ['h8', 'g8'], other: ['f1', 'h2'], moves: ['f3', 'd3'] },
  { color: 'black', opponent: 'white', carrier: 'Queen', fen: 'kn3n2/3q4/8/8/8/8/8/7K b - - 0 1', from: 'b8', to: 'd7', reply: ['h1', 'g1'], other: ['f8', 'h7'], moves: ['f6', 'd6'] },
  { color: 'black', opponent: 'white', carrier: 'Knight', fen: 'k2q1n2/3n4/8/8/8/8/8/7K b - - 0 1', from: 'd8', to: 'd7', reply: ['h1', 'g1'], other: ['f8', 'h7'], moves: ['f6', 'd6'] },
] as const) {
  test(`Challenge binds the physical ${fixture.color} composite with ${fixture.carrier} carrier`, () => {
    let state = createGameState({ fen: fixture.fen, hands: { [fixture.color]: ['confabulation'], [fixture.opponent]: ['challenge', 'challenge'] } });
    const carrier = state.pieces.find(piece => piece.square === fixture.to)!;
    const component = state.pieces.find(piece => piece.square === fixture.from)!;
    state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: fixture.from, to: fixture.to }] });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: fixture.reply[0], to: fixture.reply[1] });
    const before = structuredClone(state);
    const [retained, spent] = state.players[fixture.opponent].hand;
    assert.ok(legalDests(act(state, { type: 'endTurn' })).get(fixture.other[0])?.includes(fixture.other[1]), 'the other Knight could move without Challenge');
    assert.ok(cardPlayTargets(state, 'challenge').includes(fixture.to));
    const played = act(state, { type: 'playCard', cardId: 'challenge', cardInstanceId: spent!.id, target: fixture.to });
    assert.deepEqual(state, before);
    assert.deepEqual(played.pieces, before.pieces);
    assert.equal(played.fen, before.fen);
    assert.deepEqual(played.players[fixture.opponent].hand, [retained]);
    assert.deepEqual(played.players[fixture.opponent].discard, [spent]);
    assert.deepEqual(played.players[fixture.color], before.players[fixture.color]);
    assert.equal(played.turn.cardPlays[fixture.opponent], 1);
    assert.deepEqual(played.effects, [...before.effects, { type: 'challenge', owner: fixture.opponent, player: fixture.color, pieceId: carrier.id }]);
    assert.deepEqual(played.history, [...before.history, { type: 'cardPlayed', cardId: 'challenge', target: fixture.to, movement: [], preservePreviousMove: true }]);
    const challenged = act(played, { type: 'endTurn' });
    const snapshot = structuredClone(challenged);
    assert.deepEqual([...legalDests(challenged).keys()], [fixture.to]);
    const wrongPiece = applyAction(challenged, { type: 'move', from: fixture.other[0], to: fixture.other[1] });
    assert.equal(wrongPiece.ok, false, 'another Knight cannot satisfy the physical obligation');
    assert.deepEqual(wrongPiece.state, snapshot);
    for (const to of fixture.moves) {
      const moved = act(challenged, { type: 'move', from: fixture.to, to });
      assert.deepEqual(moved.pieces.find(piece => piece.id === carrier.id), { ...carrier, square: to });
      assert.deepEqual(moved.pieces.find(piece => piece.id === component.id), { ...component, zone: 'away', square: null });
      assert.deepEqual(moved.pieces.map(piece => piece.id), before.pieces.map(piece => piece.id));
      assert.deepEqual(moved.effects[0], before.effects[0]);
    }
    assert.deepEqual(act(challenged, { type: 'endTurn' }).pieces, challenged.pieces, 'forfeiture keeps both components');
    assert.deepEqual(challenged, snapshot);
  });
}

test('Challenge also accepts Queen composites through their Rook, Bishop, or Pawn component', () => {
  for (const symbol of ['R', 'B', 'P']) {
    let state = createGameState({ fen: `7k/8/8/8/8/8/3${symbol}4/K2Q4 w - - 0 1`, hands: { white: ['confabulation'], black: ['challenge'] } });
    state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'd1', to: 'd2' }] });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h8', to: 'g8' });
    assert.ok(cardPlayTargets(state, 'challenge').includes('d2'), symbol);
    assert.equal(act(state, { type: 'playCard', cardId: 'challenge', target: 'd2' }).history.at(-1)?.type, 'cardPlayed');
  }
});

test('Challenge still rejects pure Queens and Queen-Queen composites atomically', () => {
  for (const composite of [false, true]) {
    let state = createGameState({ fen: `7k/8/8/8/8/8/3Q4/K2${composite ? 'Q' : 'R'}4 w - - 0 1`, hands: { white: ['confabulation'], black: ['challenge'] } });
    state = act(state, composite
      ? { type: 'playCard', cardId: 'confabulation', target: [{ from: 'd1', to: 'd2' }] }
      : { type: 'move', from: 'a1', to: 'a2' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h8', to: 'g8' });
    const before = structuredClone(state);
    assert.ok(!cardPlayTargets(state, 'challenge').includes('d2'));
    const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'd2' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('Challenge still excludes a composite made royal by Coup', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/3B4/KN6 w - - 0 1', hands: { white: ['confabulation', 'coup'], black: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'd2' }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'd2' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g8', to: 'h8' });
  const before = structuredClone(state);
  assert.equal(state.pieces.find(piece => piece.square === 'd2')?.royal, true);
  assert.ok(!cardPlayTargets(state, 'challenge').includes('d2'));
  const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'd2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Challenge requires a legal move even for an eligible Queen-Knight composite', () => {
  let state = createGameState({ fen: '7k/8/8/8/3n4/8/5Q2/K6N w - - 0 1', hands: { white: ['confabulation'], black: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'h1', to: 'f2' }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd4', to: 'b3' });
  const before = structuredClone(state);
  const opponent = act(state, { type: 'endTurn' });
  assert.ok(!legalDests(opponent).has('f2'), 'neither component can answer the Knight check');
  assert.ok(legalDests(opponent).has('a1'), 'the opponent still has a legal King move');
  assert.ok(!cardPlayTargets(state, 'challenge').includes('f2'));
  const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'f2' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Challenge retains the public Coup Prince control', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/2P5/8/K7 w - - 0 1', hands: { white: ['coup'], black: ['challenge'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'c3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  assert.ok(cardPlayTargets(state, 'challenge').includes('a2'));
  state = act(state, { type: 'playCard', cardId: 'challenge', target: 'a2' });
  state = act(state, { type: 'endTurn' });
  assert.deepEqual([...legalDests(state).keys()], ['a2']);
  act(state, { type: 'move', from: 'a2', to: 'b2' });
});

test('Challenge preserves inputs and cards for malformed composite targets or card identities', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/3Q4/KN6 w - - 0 1', hands: { white: ['confabulation'], black: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'd2' }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  const before = structuredClone(state);
  for (const target of [null, { square: 'd2' }, ['d2'], 'b1', 'z9']) {
    const action: GameAction = { type: 'playCard', cardId: 'challenge', target };
    const input = structuredClone(action);
    const result = applyAction(state, action);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(action, input);
  }
  for (const cardInstanceId of ['missing', state.players.white.discard[0]?.id ?? 'white-card', 42]) {
    const result = applyAction(state, { type: 'playCard', cardId: 'challenge', cardInstanceId, target: 'd2' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'CARD_NOT_IN_HAND');
    assert.deepEqual(result.state, before);
  }
  assert.deepEqual(state, before);
});

test('FAQ16 still prohibits Riposte against a Queen-Knight composite capture', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/5p2/3Q4/KN6 w - - 0 1', hands: { white: ['confabulation'], black: ['riposte'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'd2' }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd2', to: 'f3' });
  const before = structuredClone(state);
  assert.deepEqual(cardPlayTargets(state, 'riposte'), []);
  const result = applyAction(state, { type: 'playCard', cardId: 'riposte' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'WRONG_ROLE');
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Challenge metadata matches its printed artwork', () => {
  const { name, points, unique, continuing, timing, image } = CARD_CATALOG.challenge;
  assert.deepEqual({ name, points, unique, continuing, timing, image }, {
    name: 'Challenge', points: 6, unique: false, continuing: false,
    timing: ['afterMove'], image: '/KC10_card2.png',
  });
});

test('Challenge can name an enemy pawn that can legally move', () => {
  const state = setup();
  assert.ok(cardPlayTargets(state, 'challenge').includes('e7'));
  act(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
});

test('Challenge constrains the next ordinary move to the named piece', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'black');
  assert.deepEqual([...legalDests(state).keys()], ['e7']);
  act(state, { type: 'move', from: 'e7', to: 'e5' });
});

for (const [role, piece] of [['pawn', 'p'], ['knight', 'n'], ['bishop', 'b'], ['rook', 'r']]) {
  test(`Challenge accepts a movable enemy ${role}`, () => {
    const state = createGameState({ fen: `4k3/4${piece}3/8/8/8/8/8/K7 w - - 0 1`, phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
    assert.ok(cardPlayTargets(state, 'challenge').includes('e7'));
    act(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
  });
}

for (const [label, target] of [['enemy King', 'e8'], ['enemy Queen', 'd8'], ['own pawn', 'e4'], ['empty square', 'e5'], ['invalid square', 'z9']]) {
  test(`Challenge rejects ${label} without spending the card`, () => {
    const state = setup();
    const before = structuredClone(state);
    assert.ok(!cardPlayTargets(state, 'challenge').includes(target));
    const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

for (const [label, fen, target] of [
  ['blocked pawn', '4k3/p7/p7/8/8/8/8/K7 w - - 0 1', 'a7'],
  ['absolutely pinned knight', '4k3/4n3/8/8/8/8/8/K3R3 w - - 0 1', 'e7'],
  ['knight that cannot answer check', 'n3k3/8/8/8/8/8/8/K3R3 w - - 0 1', 'a8'],
]) {
  test(`Challenge cannot name a ${label}`, () => {
    const state = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
    assert.ok(!cardPlayTargets(state, 'challenge').includes(target));
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target }).ok, false);
  });
}

test('Challenge cannot be played before the regular move', () => {
  const state = createGameState({ hands: { white: ['challenge'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Challenge is spent after a successful play', () => {
  const state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  assert.equal(state.players.white.hand.filter(card => card.cardId === 'challenge').length, 0);
  assert.equal(state.players.white.discard.filter(card => card.cardId === 'challenge').length, 1);
});

test('The challenged piece may capture on its required move', () => {
  let state = createGameState({ fen: '7k/4p3/3P4/8/8/8/8/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'e7', to: 'd6' });
  assert.ok(state.pieces.some(piece => piece.owner === 'black' && piece.square === 'd6' && piece.zone === 'board'));
  assert.ok(!state.pieces.some(piece => piece.owner === 'white' && piece.square === 'd6' && piece.zone === 'board'));
});

test('The opponent can forfeit the challenged turn without moving', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  const pieces = structuredClone(state.pieces);
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'white');
  assert.deepEqual(state.pieces, pieces);
});

test('Using the challenged piece releases the following turn', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'e7', to: 'e6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd2', to: 'd4' });
  state = act(state, { type: 'endTurn' });
  act(state, { type: 'move', from: 'g8', to: 'f6' });
});

test('Forfeiting the challenged turn releases the following turn', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd2', to: 'd4' });
  state = act(state, { type: 'endTurn' });
  act(state, { type: 'move', from: 'g8', to: 'f6' });
});

test('Black can challenge a movable White piece after moving', () => {
  let state = createGameState({ fen: FEN.replace(' w ', ' b '), turn: 'black', phase: 'afterMove', moveMade: true, hands: { black: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'challenge', target: 'g1' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'white');
  assert.deepEqual([...legalDests(state).keys()], ['g1']);
  act(state, { type: 'move', from: 'g1', to: 'f3' });
});
