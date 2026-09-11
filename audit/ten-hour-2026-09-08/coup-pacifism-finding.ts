import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const attackedTarget of [false, true]) {
  const fen = attackedTarget ? '7k/8/8/8/3p4/2N5/8/K7 w - - 0 1' : '7k/8/8/8/4p3/2N5/8/K7 w - - 0 1';
  let state = createGameState({ fen, hands: { white: ['pacifism', 'coup'] } });
  const actions: GameAction[] = [
    { type: 'playCard', cardId: 'pacifism', target: 'c3' }, { type: 'move', from: 'a1', to: 'a2' },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' }, { type: 'endTurn' },
    { type: 'move', from: 'a2', to: 'a1' }, { type: 'playCard', cardId: 'coup', target: 'c3' },
  ];
  for (const action of actions) {
    const result = applyAction(state, action); assert.ok(result.ok); state = result.state;
  }
  console.log(JSON.stringify({ group: 'Coup on Pacifist Knight', attackedTarget, fen, actions,
    history: state.history.at(-1), check: isKingInCheck(state, 'white'),
    knight: state.pieces.find(piece => piece.id === 'white-knight-c3'), effects: state.effects }));
  if (!attackedTarget) {
    for (const action of [{ type: 'endTurn' }, { type: 'move', from: 'h7', to: 'h8' }, { type: 'endTurn' }] as GameAction[]) {
      const result = applyAction(state, action); assert.ok(result.ok); state = result.state;
    }
    const capture = applyAction(state, { type: 'move', from: 'c3', to: 'e4' });
    console.log(JSON.stringify({ group: 'Coup should suspend Pacifism so royal Knight may capture',
      offered: legalDests(state).get('c3'), result: capture.ok ? 'accepted' : capture.error }));
  }
}
console.log(JSON.stringify({ sentinel: 'COUP_PACIFISM_PROBES_DONE', groups: 2, ms: performance.now() - started }));
