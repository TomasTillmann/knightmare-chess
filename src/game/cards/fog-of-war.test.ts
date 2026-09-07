import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? {} : result.error));
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, action.cardId);
  }
  return result.state;
}
const play = (state: GameState, cardId: string, target?: unknown) => act(state, { type: 'playCard', cardId, ...(target === undefined ? {} : { target }) });
const initial = () => createGameState({ hands: { white: ['pacifism', 'fog-of-war'], black: ['fog-of-war'] }, decks: { white: ['dubbing', 'pacifism'], black: ['pacifism', 'dubbing'] } });
const pacifism = () => play(initial(), 'pacifism', 'b1');
function rejected(state: GameState, action: GameAction) {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
}

test('Fog of War printed metadata', () => {
  const card = CARD_CATALOG['fog-of-war'];
  assert.ok(card);
  assert.equal(card.points, 10);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['afterOpponentCard']);
  assert.ok(card.image.endsWith('/KC19_card2.png'));
});
test('no response before a physical card', () => rejected(initial(), { type: 'playCard', cardId: 'fog-of-war' }));
test('no advertised targets outside a physical response window', () => assert.deepEqual(cardPlayTargets(initial(), 'fog-of-war'), []));
test('legal response takes no target', () => assert.deepEqual(cardPlayTargets(pacifism(), 'fog-of-war'), [undefined]));
for (const target of ['b1', [], {}, null]) test(`rejects target ${JSON.stringify(target)} atomically`, () => rejected(pacifism(), { type: 'playCard', cardId: 'fog-of-war', target }));
test('cancels a before-move continuing card and retains ordinary move', () => {
  const before = initial();
  const state = play(play(before, 'pacifism', 'b1'), 'fog-of-war');
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.effects, []);
  assert.equal(boardFen(state), boardFen(before));
  assert.equal(state.turn.moveMade, false);
  assert.equal(state.turn.phase, 'beforeMove');
  assert.ok(legalDests(state).get('e2')?.includes('e4'));
});
test('both physical cards discarded and replaced exactly once', () => {
  const before = initial();
  const state = play(play(before, 'pacifism', 'b1'), 'fog-of-war');
  for (const color of ['white', 'black'] as const) {
    assert.deepEqual(state.players[color].discard, [before.players[color].hand[0]]);
    assert.deepEqual(state.players[color].deck, before.players[color].deck.slice(1));
    assert.deepEqual(state.players[color].hand, [...before.players[color].hand.slice(1), before.players[color].deck[0]]);
    assert.equal(state.turn.cardPlays[color], 1);
  }
});
test('canceled player cannot use its replacement card', () => {
  const state = play(pacifism(), 'fog-of-war');
  rejected(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'a2', to: 'b4' }] });
});
test('unrelated ordinary move closes the card response', () => {
  const state = act(pacifism(), { type: 'move', from: 'e2', to: 'e4' });
  rejected(state, { type: 'playCard', cardId: 'fog-of-war' });
});
test('fabricated card history does not open a physical response', () => {
  const state = initial();
  state.history.push({ type: 'cardPlayed', player: 'white', cardId: 'pacifism', target: 'b1' });
  state.cardResponse = { player: 'white', historyLength: 1 };
  rejected(state, { type: 'playCard', cardId: 'fog-of-war' });
});
test('selects the opposing physical copy rather than the moving players own Fog', () => {
  const before = initial();
  const state = play(play(before, 'pacifism', 'b1'), 'fog-of-war');
  assert.ok(state.players.white.hand.some(c => c.id === before.players.white.hand[1]!.id));
  assert.equal(state.players.black.discard[0]?.id, before.players.black.hand[0]!.id);
});
test('cannot use the moving players Fog to cancel their own card', () => {
  const state = pacifism();
  rejected(state, { type: 'playCard', cardId: 'fog-of-war', cardInstanceId: state.players.white.hand.find(c => c.cardId === 'fog-of-war')!.id });
});
test('replacement cancellation restores pieces and exact FEN clocks', () => {
  const before = createGameState({ fen: '4k3/8/8/8/8/8/P7/4K3 w - - 17 9', hands: { white: ['dubbing'], black: ['fog-of-war'] } });
  const replaced = play(before, 'dubbing', [{ from: 'a2', to: 'b4' }]);
  assert.equal(replaced.turn.moveMade, true);
  assert.notEqual(boardFen(replaced), boardFen(before));
  const state = play(replaced, 'fog-of-war');
  assert.deepEqual(state.pieces, before.pieces);
  assert.equal(state.fen, before.fen);
  assert.equal(state.turn.moveMade, false);
  assert.equal(state.turn.phase, 'beforeMove');
  act(state, { type: 'move', from: 'a2', to: 'a4' });
});
test('after-move cancellation retains the completed independent move and en passant', () => {
  const before = createGameState({ hands: { white: ['mystic-shield'], black: ['fog-of-war'] } });
  const moved = act(before, { type: 'move', from: 'e2', to: 'e4' });
  const shielded = play(moved, 'mystic-shield', 'e4');
  const state = play(shielded, 'fog-of-war');
  assert.deepEqual(state.pieces, moved.pieces);
  assert.equal(state.fen, moved.fen);
  assert.deepEqual(state.enPassant, moved.enPassant);
  assert.deepEqual(state.effects, moved.effects);
  assert.deepEqual(state.shieldMove, moved.shieldMove);
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(legalDests(state).size, 0);
});
test('end turn closes the response window', () => {
  let state = act(pacifism(), { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  rejected(state, { type: 'playCard', cardId: 'fog-of-war' });
});
test('cancellation card restriction expires on following turns', () => {
  let state = play(pacifism(), 'fog-of-war');
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = play(state, 'pacifism', 'b8');
  assert.equal(state.turn.cardPlays.black, 1);
  state = act(state, { type: 'move', from: 'e7', to: 'e5' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.cardPlays.white, 0);
  state = play(state, 'dubbing', [{ from: 'a2', to: 'b4' }]);
  assert.equal(state.turn.cardPlays.white, 1);
});
