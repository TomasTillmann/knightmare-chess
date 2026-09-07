import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

const fen = '7k/6n1/8/8/8/8/1P4P1/2B1K3 w - - 7 3';
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}
function initial() {
  return createGameState({ fen, hands: { white: ['crusade', 'crusade'] }, decks: { white: ['crusade'] } });
}
function ready(state = initial()) {
  return act(state, { type: 'move', from: 'c1', to: 'd2' });
}
function played(state: GameState, target: unknown = [{ from: 'd2', to: 'e3' }], cardInstanceId?: string) {
  const next = act(state, { type: 'playCard', cardId: 'crusade', cardInstanceId, target });
  assert.equal(next.history.filter(event => event.cardId === 'crusade').at(-1)?.type, 'cardPlayed');
  return next;
}

test('Crusade spends the selected physical copy and draws once', () => {
  const state = ready();
  const [retained, spent] = state.players.white.hand;
  const drawn = state.players.white.deck[0];
  const next = played(state, undefined, spent.id);
  assert.deepEqual(next.players.white.discard, [spent]);
  assert.deepEqual(next.players.white.hand, [retained, drawn]);
  assert.equal(next.players.white.deck.length, 0);
});

test('Crusade target enumeration offers a playable move by the moved Bishop', () => {
  const state = ready();
  const target = [{ from: 'd2', to: 'e3' }];
  assert.ok(cardPlayTargets(state, 'crusade').some(value => JSON.stringify(value) === JSON.stringify(target)));
  assert.equal(played(state, target).pieces.find(piece => piece.id === 'white-bishop-c1')?.square, 'e3');
});

test('Crusade rejects malformed or multiple moves without consuming a copy', () => {
  for (const target of [null, {}, { from: 'd2', to: 'e3' }, [], [{ from: 'd2' }], [{ from: 'd2', to: 'z9' }], [{ from: 'd2', to: 'e3' }, { from: 'e3', to: 'f4' }]]) {
    const state = ready();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'crusade', target });
    assert.equal(result.ok, false, JSON.stringify(target));
    assert.deepEqual(state, before);
    assert.deepEqual(result.state, before);
  }
});

test('Crusade cannot name a physical copy outside the hand', () => {
  const state = ready();
  const result = applyAction(state, { type: 'playCard', cardId: 'crusade', cardInstanceId: state.players.white.deck[0].id, target: [{ from: 'd2', to: 'e3' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Crusade follows a neutral Bishop despite its opposing original owner', () => {
  const state = createGameState({ fen: fen.replace('2B1K3', '2b1K3'), hands: { white: ['crusade'] } });
  const bishop = state.pieces.find(piece => piece.square === 'c1')!;
  bishop.neutral = true;
  const next = played(ready(state));
  const moved = next.pieces.find(piece => piece.id === bishop.id)!;
  assert.equal(moved.square, 'e3');
  assert.equal(moved.owner, 'black');
  assert.equal(moved.neutral, true);
});

test('Crusade preserves original Bishop eligibility and uses its transformed powers', () => {
  const state = createGameState({ fen: fen.replace('2B1K3', '2N1K3'), hands: { white: ['crusade'] } });
  const bishop = state.pieces.find(piece => piece.square === 'c1')!;
  bishop.originalRole = 'bishop';
  const afterMove = act(state, { type: 'move', from: 'c1', to: 'd3' });
  const next = played(afterMove, [{ from: 'd3', to: 'e5' }]);
  const moved = next.pieces.find(piece => piece.id === bishop.id)!;
  assert.equal(moved.square, 'e5');
  assert.equal(moved.role, 'knight');
  assert.equal(moved.originalRole, 'bishop');
});

test('Crusade cannot reuse a previous turn Bishop move after a Pawn move', () => {
  let state = ready();
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b2', to: 'b3' });
  assert.deepEqual(cardPlayTargets(state, 'crusade'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'crusade', target: [{ from: 'd2', to: 'e3' }] }).ok, false);
});

test('A replacement card movement does not create a Crusade trigger', () => {
  let state = createGameState({ fen, hands: { white: ['dubbing', 'crusade'] } });
  state = act(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'c1', to: 'd3' }] });
  assert.equal(state.history.filter(event => event.cardId === 'dubbing').at(-1)?.type, 'cardPlayed');
  assert.deepEqual(cardPlayTargets(state, 'crusade'), []);
});

test('Crusade captures on its second move and resets only the halfmove clock', () => {
  const state = createGameState({ fen: '7k/6n1/8/8/5n2/8/1P4P1/2B1K3 w - - 7 3', hands: { white: ['crusade'] } });
  const victim = state.pieces.find(piece => piece.square === 'f4')!;
  const first = ready(state);
  const next = played(first, [{ from: 'd2', to: 'f4' }]);
  assert.equal(next.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(next.pieces.find(piece => piece.id === victim.id)?.square, null);
  assert.equal(next.fen.split(' ')[4], '0');
  assert.equal(next.fen.split(' ')[5], first.fen.split(' ')[5]);
  assert.equal(next.turn.phase, 'afterMove');
  assert.equal(next.turn.moveMade, true);
});

test('Crusade never authorizes a third ordinary move or increments a quiet clock twice', () => {
  const state = ready();
  const next = played(state);
  assert.equal(next.fen.split(' ')[4], state.fen.split(' ')[4]);
  assert.equal(next.fen.split(' ')[5], state.fen.split(' ')[5]);
  const third = applyAction(next, { type: 'move', from: 'e3', to: 'f4' });
  assert.equal(third.ok, false);
  assert.equal(boardFen(third.state), boardFen(next));
});
