import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState } from '../types.js';

const fen = '4k3/pp6/8/8/8/8/PPP5/4K3 w - - 0 1';
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

test('an invalid copy with no declaration preserves the complete state', () => {
  const state = createGameState({ fen, hands: { white: ['haunting-memories'] } });
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
});

function fanaticSource(owner: Color = 'white'): GameState {
  const opponent = owner === 'white' ? 'black' : 'white';
  let state = createGameState({ fen: '4k3/ppp5/8/8/8/8/PPP5/4K3 w - - 0 1', turn: owner,
    hands: { [owner]: ['fanatic', 'haunting-memories'], [opponent]: ['haunting-memories'] } });
  state = act(state, { type: 'playCard', cardId: 'fanatic', target: owner === 'white' ? 'a2' : 'a7' });
  return act(state, { type: 'endTurn' });
}

for (const owner of ['white', 'black'] as const) {
  test(`${owner} can copy its nonunique card through an opposing copy`, () => {
    let state = fanaticSource(owner);
    state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: owner === 'white' ? 'b7' : 'b2' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: owner === 'white' ? 'c2' : 'c7' });
    assert.equal(state.pieces.find(piece => piece.id === `${owner}-pawn-${owner === 'white' ? 'c2' : 'c7'}`)?.square,
      owner === 'white' ? 'c5' : 'c4');
    assert.equal(state.history.at(-1)?.copiedCardId, 'fanatic');
  });
}

test('a rejected declaration does not replace the source declaration', () => {
  let state = fanaticSource();
  const rejected = applyAction(state, { type: 'playCard', cardId: 'disintegration', target: 'a7' });
  assert.equal(rejected.ok, false);
  state = act(rejected.state, { type: 'playCard', cardId: 'haunting-memories', target: 'b7' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-b7')?.square, 'b4');
});

test('copy target failure preserves physical hands and successful history', () => {
  const state = fanaticSource();
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories', target: 'e8' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
});

test('a physical copied card stays Haunting Memories in discard', () => {
  let state = fanaticSource();
  const physical = structuredClone(state.players.black.hand[0]);
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: 'b7' });
  assert.deepEqual(state.players.black.discard, [physical]);
  assert.equal(state.players.white.discard[0]?.cardId, 'fanatic');
});

function guardianSource(owner: Color = 'white'): GameState {
  const opponent = owner === 'white' ? 'black' : 'white';
  let state = createGameState({
    fen: owner === 'white' ? '4k3/p4p2/8/7B/8/8/PP6/4K3 w - - 0 1' : '4k3/pp6/8/8/7b/8/P4P2/4K3 b - - 0 1',
    hands: { [owner]: ['guardian', 'haunting-memories'], [opponent]: ['haunting-memories'] },
  });
  state = act(state, { type: 'playCard', cardId: 'guardian', target: [{ from: owner === 'white' ? 'a2' : 'a7', to: owner === 'white' ? 'a3' : 'a6' }] });
  return act(state, { type: 'endTurn' });
}

for (const owner of ['white', 'black'] as const) {
  for (const fizzles of [false, true]) {
    test(`${owner} cannot copy its unique card through a ${fizzles ? 'fizzled' : 'successful'} opposing copy`, () => {
      let state = guardianSource(owner);
      const opponent = state.turn.color;
      const physical = structuredClone(state.players[opponent].hand[0]);
      state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: [{
        from: owner === 'white' ? (fizzles ? 'f7' : 'a7') : (fizzles ? 'f2' : 'a2'),
        to: owner === 'white' ? (fizzles ? 'f6' : 'a6') : (fizzles ? 'f3' : 'a3'),
      }] });
      assert.equal(state.history.at(-1)?.type, fizzles ? 'cardFizzled' : 'cardPlayed');
      assert.equal(state.history.at(-1)?.copiedCardId, 'guardian');
      assert.deepEqual(state.players[opponent].discard, [physical]);
      state = act(state, { type: 'endTurn' });
      const snapshot = structuredClone(state);
      const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories', target: [{
        from: owner === 'white' ? 'b2' : 'b7', to: owner === 'white' ? 'b3' : 'b6',
      }] });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, snapshot);
      assert.deepEqual(state, snapshot);
      assert.deepEqual(cardPlayTargets(state, 'haunting-memories'), []);
    });
  }

  test(`${owner} cannot directly copy its own unique Guardian`, () => {
    let state = guardianSource(owner);
    state = act(state, { type: 'move', from: owner === 'white' ? 'a7' : 'a2', to: owner === 'white' ? 'a6' : 'a3' });
    state = act(state, { type: 'endTurn' });
    const snapshot = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories', target: [{
      from: owner === 'white' ? 'b2' : 'b7', to: owner === 'white' ? 'b3' : 'b6',
    }] });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, snapshot);
  });
}

test('an opponent unique Guardian can be copied with its move target', () => {
  let state = guardianSource();
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: [{ from: 'a7', to: 'a6' }] });
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-a7')?.square, 'a6');
  assert.equal(state.turn.moveMade, true);
});

function twoPacifisms(): GameState {
  let state = createGameState({ fen, hands: { white: ['pacifism', 'peace-talks'], black: ['haunting-memories', 'haunting-memories'] } });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'a2' });
  state = act(state, { type: 'move', from: 'b2', to: 'b3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: 'a7' });
  return state;
}

test('a copied continuing effect retains its own physical card identity', () => {
  const state = twoPacifisms();
  assert.ok(state.effects.some(effect => {
    const value = effect as { owner: string; card: { id: string; cardId: string } };
    return value.owner === 'black' && value.card.id === 'black-hand-0-haunting-memories' && value.card.cardId === 'haunting-memories';
  }));
  assert.deepEqual(state.players.black.discard, []);
});

test('copied Peace Talks cancels the copied effect and discards physical identities', () => {
  let state = twoPacifisms();
  state = act(state, { type: 'move', from: 'b7', to: 'b6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b3', to: 'b4' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-pacifism' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b6', to: 'b5' });
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: 'black-hand-0-haunting-memories' });
  assert.deepEqual(state.effects, []);
  assert.deepEqual(state.players.black.discard.map(card => card.id).sort(), ['black-hand-0-haunting-memories', 'black-hand-1-haunting-memories']);
  assert.ok(state.players.black.discard.every(card => card.cardId === 'haunting-memories'));
});

test('copying a continuing card rejects its forbidden target without changing the source effect', () => {
  let state = createGameState({ fen, hands: { white: ['pacifism'], black: ['haunting-memories'] } });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'a2' });
  state = act(state, { type: 'move', from: 'b2', to: 'b3' });
  state = act(state, { type: 'endTurn' });
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories', target: 'e8' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
});

test('selecting one duplicate Haunting Memories spends exactly that physical instance', () => {
  let state = createGameState({ fen, hands: { white: ['fanatic'], black: ['haunting-memories', 'haunting-memories'] } });
  state = act(state, { type: 'playCard', cardId: 'fanatic', target: 'a2' });
  state = act(state, { type: 'endTurn' });
  const [retained, selected] = structuredClone(state.players.black.hand);
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: selected.id, target: 'b7' });
  assert.deepEqual(state.players.black.hand, [retained]);
  assert.deepEqual(state.players.black.discard, [selected]);
});

test('a copied immediate Vulture cannot bypass the already spent card allowance', () => {
  let state = createGameState({ fen, hands: { white: ['disintegration', 'haunting-memories'], black: ['vulture'] } });
  const source = structuredClone(state.players.white.hand[0]);
  state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'vulture' });
  assert.ok(state.players.black.hand.some(card => card.id === source.id && card.cardId === source.cardId));
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
});
