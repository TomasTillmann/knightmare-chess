import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState, type CreateGameOptions } from '../../src/game/state.js';
import type { GameAction, GameState } from '../../src/game/types.js';
const started = performance.now();
for (const [fen, color, from, to] of [
  ['k6B/pp6/8/8/8/8/8/4K2R w - - 0 1', 'white', 'h1', 'h8'],
  ['r2k4/8/8/8/8/8/6PP/b6K b - - 0 1', 'black', 'a8', 'a1'],
] as const) {
  const state = createGameState({ fen, hands: { [color]: ['confabulation'] } });
  const action = { type: 'playCard' as const, cardId: 'confabulation', target: [{ from, to }] };
  const result = applyAction(state, action);
  console.log(JSON.stringify({ group: 'confabulation-direct-mate', fen, action, ok: result.ok,
    effects: result.state.effects, history: result.state.history,
    findings: result.state.history.some(event => event.type === 'cardFizzled' && event.reason === 'DIRECT_MATE') ? 1 : 0 }));
}
function run(initial: CreateGameOptions, actions: GameAction[]): GameState {
  let state = createGameState(initial);
  for (const action of actions) {
    const before = JSON.stringify(state), result = applyAction(state, action);
    assert.equal(JSON.stringify(state), before, 'input immutable');
    assert.ok(result.ok, result.ok ? '' : `${JSON.stringify(action)}: ${result.error.message}`);
    state = result.state;
  }
  return state;
}
const earthquakeInitial = { fen: '8/3P4/k7/8/8/8/8/4K1N1 w - - 0 1',
  hands: { white: ['earthquake', 'dubbing'], black: ['peace-talks'] } };
const earthquakeActions: GameAction[] = [
  { type: 'move', from: 'g1', to: 'f3' },
  { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] } },
  { type: 'endTurn' }, { type: 'move', from: 'a6', to: 'a5' }, { type: 'endTurn' },
  { type: 'playCard', cardId: 'dubbing', target: [{ from: 'd7', to: 'f8' }] },
  { type: 'endTurn' }, { type: 'move', from: 'a5', to: 'a6' },
  { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-earthquake' }, { type: 'endTurn' },
];
const earthquake = run(earthquakeInitial, earthquakeActions);
console.log(JSON.stringify({ group: 'earthquake-reversal-promotion', initial: earthquakeInitial, actions: earthquakeActions,
  orientation: earthquake.orientation, pawn: earthquake.pieces.find(piece => piece.id === 'white-pawn-d7'), outcome: earthquake.outcome }));

const orphanInitial = { fen: '4k1n1/8/8/8/8/R7/8/1N2K3 w - - 0 1',
  hands: { white: ['confabulation', 'resurrection'], black: ['peace-talks'] } };
const orphanActions: GameAction[] = [
  { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'a3' }] },
  { type: 'endTurn' }, { type: 'move', from: 'g8', to: 'f6' },
  { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-confabulation' },
  { type: 'endTurn' }, { type: 'move', from: 'a3', to: 'a4' }, { type: 'endTurn' },
  { type: 'move', from: 'f6', to: 'g8' }, { type: 'endTurn' },
];
const orphan = run(orphanInitial, orphanActions);
console.log(JSON.stringify({ group: 'confabulation-orphan', initial: orphanInitial, actions: orphanActions,
  piece: orphan.pieces.find(piece => piece.id === 'white-knight-b1'), effects: orphan.effects, outcome: orphan.outcome }));

const protectedInitial = { fen: 'k2r4/8/8/8/8/8/N7/2B1K3 w - - 0 1',
  hands: { white: ['confabulation', 'coup'], black: ['peace-talks'] } };
const protectedActions: GameAction[] = [
  { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a2', to: 'c1' }] },
  { type: 'endTurn' }, { type: 'move', from: 'd8', to: 'd7' }, { type: 'endTurn' },
  { type: 'move', from: 'e1', to: 'f1' }, { type: 'playCard', cardId: 'coup', target: 'c1' },
  { type: 'endTurn' }, { type: 'move', from: 'd7', to: 'f7' }, { type: 'endTurn' },
  { type: 'move', from: 'c1', to: 'e3' }, { type: 'endTurn' }, { type: 'move', from: 'f7', to: 'f1' },
];
const protectedBefore = run(protectedInitial, protectedActions);
const cancellation = applyAction(protectedBefore, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-confabulation' });
console.log(JSON.stringify({ group: 'protected-confabulation-coup', initial: protectedInitial, actions: protectedActions,
  cancellation: cancellation.ok ? 'accepted' : cancellation.error, effects: cancellation.state.effects,
  prince: cancellation.state.pieces.find(piece => piece.id === 'white-king-e1') }));

const vultureInitial = { hands: { white: ['pacifism'], black: ['vulture'] }, decks: { black: ['fanatic', 'dubbing'] } };
const vultureBefore = run(vultureInitial, [{ type: 'playCard', cardId: 'pacifism', target: 'g1' }]);
const vulture = applyAction(vultureBefore, { type: 'playCard', cardId: 'vulture' });
console.log(JSON.stringify({ group: 'vulture-active-effect', initial: vultureInitial,
  actions: [{ type: 'playCard', cardId: 'pacifism', target: 'g1' }, { type: 'playCard', cardId: 'vulture' }],
  result: vulture.ok ? 'accepted' : vulture.error, effects: vulture.state.effects }));
console.log(JSON.stringify({ sentinel: 'KNOWN_FINDINGS_RECHECKED', groups: 6, ms: performance.now() - started }));
