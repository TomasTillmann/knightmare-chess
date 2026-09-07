import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, boardFen, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, GameAction, GameState } from '../types.js';

const COLORS = ['white', 'black'] as const;
const ZONES = ['hand', 'deck', 'discard'] as const;

function cardInstances(state: GameState): CardInstance[] {
  const zoned = COLORS.flatMap(color => ZONES.flatMap(zone => state.players[color][zone]));
  const continuing = state.effects.flatMap(effect => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return [];
    const card = (effect as { card?: unknown }).card;
    return card && typeof card === 'object'
      && typeof (card as CardInstance).id === 'string'
      && typeof (card as CardInstance).cardId === 'string'
      ? [card as CardInstance]
      : [];
  });
  return [...zoned, ...continuing];
}

function assertInvariant(state: GameState, conservedCardIds = cardInstances(state).map(card => card.id)) {
  assert.equal(state.fen.split(' ')[0], boardFen(state));
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(state.pieces.every(piece => (piece.zone === 'board') === (piece.square !== null)));
  for (const color of COLORS) {
    assert.equal(board.filter(piece => piece.owner === color && piece.royal).length, 1);
  }
  const actualCards = cardInstances(state).map(card => card.id);
  assert.equal(new Set(actualCards).size, actualCards.length);
  assert.deepEqual([...actualCards].sort(), [...conservedCardIds].sort());
  assert.equal(state.turn.phase === 'afterMove', state.turn.moveMade);
  for (const event of state.history) {
    for (const capturedId of [event.capturedId, ...(event.capturedIds ?? [])].filter(Boolean)) {
      const captured = state.pieces.find(piece => piece.id === capturedId);
      assert.ok(captured && captured.zone !== 'board' && captured.square === null);
    }
  }
}

function transition(state: GameState, action: GameAction, expectedOk = true): GameState {
  const beforeState = structuredClone(state);
  const beforeAction = structuredClone(action);
  const conservedCards = cardInstances(state).map(card => card.id);
  assertInvariant(state, conservedCards);
  const actual = applyAction(state, action);
  const replay = applyAction(structuredClone(beforeState), structuredClone(beforeAction));
  assert.equal(actual.ok, expectedOk);
  assert.deepEqual(actual, replay);
  assert.deepEqual(state, beforeState);
  assert.deepEqual(action, beforeAction);
  assertInvariant(actual.state, conservedCards);
  if (!expectedOk) assert.deepEqual(actual.state, beforeState);
  return actual.state;
}

function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000);
}

test('seeded orientations and colors execute legal backward Dark Mirror captures', () => {
  const cases = [
    { orientation: 0, color: 'white', fen: '7k/8/8/8/3P4/2p5/8/K7 w - - 0 1', from: 'd4', to: 'c3' },
    { orientation: 90, color: 'black', fen: '7k/8/8/3p4/4P3/8/8/K7 b - - 0 1', from: 'd5', to: 'e4' },
    { orientation: 180, color: 'white', fen: '7k/8/8/2p5/3P4/8/8/K7 w - - 0 1', from: 'd4', to: 'c5' },
    { orientation: 270, color: 'black', fen: '7k/8/8/4p3/3P4/8/8/K7 b - - 0 1', from: 'e5', to: 'd4' },
  ] as const;
  const random = seeded(0xd4a4);
  for (const scenario of [...cases].sort(() => random() - 0.5)) {
    let state = createGameState({
      fen: scenario.fen,
      hands: { [scenario.color]: ['dark-mirror'] },
    });
    state.orientation = scenario.orientation;
    assert.deepEqual(cardPlayTargets(state, 'dark-mirror'), [[{ from: scenario.from, to: scenario.to }]]);
    state = transition(state, {
      type: 'playCard', cardId: 'dark-mirror', target: [{ from: scenario.from, to: scenario.to }],
    });
    assert.equal(state.pieces.find(piece => piece.square === scenario.to)?.owner, scenario.color);
    assert.equal(state.history.at(-1)?.capturedId?.startsWith(scenario.color === 'white' ? 'black-' : 'white-'), true);
  }
});

test('seeded malformed and illegal Dark Mirror targets are atomic', () => {
  let state = createGameState({
    fen: '7k/8/8/8/3P4/2p5/8/K7 w - - 0 1',
    hands: { white: ['dark-mirror'] },
  });
  const malformed: unknown[] = [
    undefined, null, 0, '', 'c3', {}, [],
    { from: 'd4', to: 'c3' },
    [{ from: 'd4' }],
    [{ to: 'c3' }],
    [{ from: 'd4', to: 'c3', extra: true }],
    [{ from: 'd4', to: 'c3' }, { from: 'd4', to: 'e3' }],
  ];
  const random = seeded(0xbadc0de);
  const squares = ['a1', 'a8', 'b3', 'c4', 'd4', 'd5', 'e3', 'e5', 'h8'];
  for (let index = 0; index < 20; index += 1) {
    malformed.push([{
      from: squares[Math.floor(random() * squares.length)],
      to: squares[Math.floor(random() * squares.length)],
    }]);
  }
  for (const target of malformed) {
    if (JSON.stringify(target) === JSON.stringify([{ from: 'd4', to: 'c3' }])) continue;
    state = transition(state, { type: 'playCard', cardId: 'dark-mirror', target }, false);
  }
  assert.deepEqual(cardPlayTargets(state, 'dark-mirror'), [[{ from: 'd4', to: 'c3' }]]);
});

test('Dark Mirror capture opens the immediate opponent Revenge response', () => {
  let state = createGameState({
    fen: '7k/8/8/8/3PP3/2p5/8/K7 w - - 0 1',
    hands: { white: ['dark-mirror'], black: ['revenge'] },
  });
  state = transition(state, {
    type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'd4', to: 'c3' }],
  });
  assert.deepEqual(cardPlayTargets(state, 'revenge'), ['c3', 'e4']);
  state = transition(state, { type: 'playCard', cardId: 'revenge', target: 'e4' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e4')?.zone, 'captured');
  assert.deepEqual(state.history.slice(-2).map(event => event.cardId), ['dark-mirror', 'revenge']);
});

test('Pacifism and Crab persist across turns and each blocks its Pawn from Dark Mirror', () => {
  let state = createGameState({
    fen: '7k/8/8/8/2P1P1P1/1p1p1p2/8/K7 w - - 0 1',
    hands: { white: ['pacifism', 'crab', 'dark-mirror'] },
  });
  state = transition(state, { type: 'playCard', cardId: 'pacifism', target: 'c4' });
  state = transition(state, { type: 'move', from: 'a1', to: 'b1' });
  state = transition(state, { type: 'endTurn' });
  state = transition(state, { type: 'move', from: 'h8', to: 'g8' });
  state = transition(state, { type: 'endTurn' });
  state = transition(state, { type: 'move', from: 'b1', to: 'a1' });
  state = transition(state, { type: 'playCard', cardId: 'crab', target: 'e4' });
  state = transition(state, { type: 'endTurn' });
  state = transition(state, { type: 'move', from: 'g8', to: 'h8' });
  state = transition(state, { type: 'endTurn' });
  state = transition(state, {
    type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'c4', to: 'b3' }],
  }, false);
  state = transition(state, {
    type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'e4', to: 'd3' }],
  }, false);
  assert.deepEqual(cardPlayTargets(state, 'dark-mirror'), [[{ from: 'g4', to: 'f3' }]]);
  transition(state, {
    type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'g4', to: 'f3' }],
  });
});

test('replay is deterministic across mixed ordinary and card turns', () => {
  const actions: GameAction[] = [
    { type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'd4', to: 'c3' }] },
    { type: 'playCard', cardId: 'revenge', target: 'e4' },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'h7' },
    { type: 'endTurn' },
    { type: 'move', from: 'a1', to: 'b1' },
    { type: 'endTurn' },
  ];
  const replay = () => actions.reduce(
    (state, action) => transition(state, action),
    createGameState({
      fen: '7k/8/8/8/3PP3/2p5/8/K7 w - - 0 1',
      hands: { white: ['dark-mirror'], black: ['revenge'] },
    }),
  );
  assert.deepEqual(replay(), replay());
});
