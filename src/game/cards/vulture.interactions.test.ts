import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  return result.state;
}
const play = (state: GameState, cardId: string, target?: unknown) => act(state, { type: 'playCard', cardId, target });
function disintegrate(afterMove = false): GameState {
  let state = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] } });
  if (afterMove) state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  return play(state, 'disintegration', 'a2');
}

test('Vulture takes Disintegration played before the move', () => {
  const state = play(disintegrate(), 'vulture');
  assert.ok(state.players.black.hand.some(card => card.id === 'white-hand-0-disintegration'));
});
test('Vulture takes Disintegration played after the move', () => {
  const state = play(disintegrate(true), 'vulture');
  assert.ok(state.players.black.hand.some(card => card.cardId === 'disintegration'));
});
test('Vulture takes Fanatic without reversing its replacement move', () => {
  const before = play(createGameState({ hands: { white: ['fanatic'], black: ['vulture'] } }), 'fanatic', 'a2');
  const after = play(before, 'vulture');
  assert.equal(boardFen(after), boardFen(before));
  assert.ok(after.players.black.hand.some(card => card.cardId === 'fanatic'));
});
test('Vulture can take a Bog response on its own turn', () => {
  let state = createGameState({ fen: '4k3/7p/8/8/8/8/8/R3K3 w - - 0 1', hands: { white: ['vulture'], black: ['bog'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  state = play(state, 'bog');
  const after = play(state, 'vulture');
  assert.ok(after.players.white.hand.some(card => card.id === 'black-hand-0-bog'));
  assert.equal(boardFen(after), boardFen(state));
});
test('Vulture can take Revenge while retaining its capture', () => {
  let state = createGameState({ fen: '4k3/7p/8/8/p7/8/1P6/R3K3 w - - 0 1', hands: { white: ['vulture'], black: ['revenge'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  state = play(state, 'revenge', 'b2');
  const after = play(state, 'vulture');
  assert.deepEqual(after.pieces, state.pieces);
  assert.ok(after.players.white.hand.some(card => card.cardId === 'revenge'));
});
test('Vulture preserves dead pieces and both Kings after Disintegration', () => {
  const before = disintegrate();
  const after = play(before, 'vulture');
  assert.deepEqual(after.pieces, before.pieces);
  assert.equal(isKingInCheck(after, 'white'), false);
  assert.equal(isKingInCheck(after, 'black'), false);
});
test('Vulture takes a fizzled Disintegration without mutating the input', () => {
  let before = createGameState({ fen: 'r6k/7p/8/8/8/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['disintegration'], black: ['vulture'] } });
  before = play(before, 'disintegration', 'a2');
  assert.equal(before.history.at(-1)?.type, 'cardFizzled');
  const snapshot = structuredClone(before);
  const after = play(before, 'vulture');
  assert.ok(after.players.black.hand.some(card => card.id === 'white-hand-0-disintegration'));
  assert.equal(boardFen(after), boardFen(before));
  assert.deepEqual(before, snapshot);
});
test('Vulture preserves the turn phase and consumes the reacting allowance', () => {
  const before = disintegrate(true);
  const after = play(before, 'vulture');
  assert.equal(after.turn.color, before.turn.color);
  assert.equal(after.turn.phase, before.turn.phase);
  assert.equal(after.turn.moveMade, before.turn.moveMade);
  assert.deepEqual(after.turn.cardPlays, { white: 1, black: 1 });
  assert.deepEqual(after.history.slice(0, before.history.length), before.history);
  assert.equal(after.history.at(-1)?.cardId, 'vulture');
});
test('Vulture charges the top undrawn card and draws the next replacement', () => {
  let state = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] }, decks: { black: ['fanatic', 'dubbing', 'bog'] } });
  state = play(play(state, 'disintegration', 'a2'), 'vulture');
  assert.deepEqual(state.players.black.deck.map(card => card.cardId), ['bog']);
  assert.ok(state.players.black.discard.some(card => card.id === 'black-deck-0-fanatic'));
  assert.ok(state.players.black.hand.some(card => card.id === 'black-deck-1-dubbing'));
});
test('FAQ 50: Vulture takes active Truce while a proxy stays in play', () => {
  let state = createGameState({ hands: { white: ['truce'], black: ['vulture'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = play(state, 'truce');
  const snapshot = structuredClone(state);
  const next = play(state, 'vulture');
  assert.deepEqual(next.players.black.hand, [{ id: 'white-hand-0-truce', cardId: 'truce' }]);
  assert.equal(next.effects.length, 1);
  assert.notEqual((next.effects[0] as { card: { id: string } }).card.id, 'white-hand-0-truce');
  assert.deepEqual(state, snapshot);
});
test('FAQ 50: Vulture takes active Pacifism while a proxy stays in play', () => {
  const state = play(createGameState({ hands: { white: ['pacifism'], black: ['vulture'] } }), 'pacifism', 'a2');
  const next = play(state, 'vulture');
  assert.deepEqual(next.players.black.hand, [{ id: 'white-hand-0-pacifism', cardId: 'pacifism' }]);
  assert.equal(next.effects.length, 1);
  assert.notEqual((next.effects[0] as { card: { id: string } }).card.id, 'white-hand-0-pacifism');
});
test('Peace Talks is taken rather than the continuing card it discarded', () => {
  let state = createGameState({ hands: { white: ['pacifism', 'vulture'], black: ['peace-talks'] } });
  state = play(state, 'pacifism', 'a2');
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'e7', to: 'e5' });
  const targets = cardPlayTargets(state, 'peace-talks');
  assert.equal(targets.length, 1);
  state = play(state, 'peace-talks', targets[0]);
  state = play(state, 'vulture');
  assert.ok(state.players.white.hand.some(card => card.id === 'black-hand-0-peace-talks'));
  assert.ok(state.players.white.discard.some(card => card.id === 'white-hand-0-pacifism'));
  assert.equal(state.effects.length, 0);
});
test('A regular move closes the response to Disintegration', () => {
  const state = act(disintegrate(), { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'vulture' }).ok, false);
});
test('Vulture retains the selected physical Disintegration among duplicate copies', () => {
  let state = createGameState({ hands: { white: ['disintegration', 'disintegration'], black: ['vulture'] } });
  state = act(state, { type: 'playCard', cardId: 'disintegration', cardInstanceId: 'white-hand-1-disintegration', target: 'a2' });
  state = play(state, 'vulture');
  assert.deepEqual(state.players.white.hand.map(card => card.id), ['white-hand-0-disintegration']);
  assert.deepEqual(state.players.black.hand.map(card => card.id), ['white-hand-1-disintegration']);
});
test('Vulture cannot be countered by a player who already used their card allowance', () => {
  let state = createGameState({ hands: { white: ['disintegration', 'vulture'], black: ['vulture'] } });
  state = play(play(state, 'disintegration', 'a2'), 'vulture');
  const snapshot = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'vulture' }).ok, false);
  assert.deepEqual(state, snapshot);
});
