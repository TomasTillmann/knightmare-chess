import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
const fen = 'k2r4/8/8/8/8/8/N7/2B1K3 w - - 0 1';
let state = createGameState({ fen, hands: { white: ['confabulation', 'coup'], black: ['peace-talks'] } });
const actions: GameAction[] = [
  { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a2', to: 'c1' }] }, { type: 'endTurn' },
  { type: 'move', from: 'd8', to: 'd7' }, { type: 'endTurn' }, { type: 'move', from: 'e1', to: 'f1' },
  { type: 'playCard', cardId: 'coup', target: 'c1' }, { type: 'endTurn' }, { type: 'move', from: 'd7', to: 'd8' },
  { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-confabulation' },
];
for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify(action)); state = result.state; }
console.log(JSON.stringify({ fen, actions, expected: 'Confabulation and Coup both end; Prince becomes King again',
  effects: state.effects, pieces: state.pieces.filter(piece => piece.owner === 'white'),
  sentinel: 'CONFABULATION_COUP_CASCADE_DONE', groups: 1, ms: performance.now() - started }));
