import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const mate of [false, true]) {
  const fen = mate ? '6k1/R5pp/8/8/8/8/8/7K w - - 0 1' : 'r6k/8/8/8/8/8/8/1K6 b - - 0 1';
  let state = createGameState({ fen, hands: { white: ['peace-talks'], black: [mate ? 'neutrality' : 'pacifism'] } });
  const actions: GameAction[] = mate ? [
    { type: 'move', from: 'h1', to: 'g1' }, { type: 'endTurn' }, { type: 'move', from: 'g8', to: 'h8' },
    { type: 'playCard', cardId: 'neutrality', target: 'a7' }, { type: 'endTurn' }, { type: 'move', from: 'a7', to: 'a8' },
  ] : [
    { type: 'playCard', cardId: 'pacifism', target: 'a8' }, { type: 'move', from: 'h8', to: 'h7' },
    { type: 'endTurn' }, { type: 'move', from: 'b1', to: 'a1' },
  ];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify(action)); state = result.state; }
  const card: GameAction = { type: 'playCard', cardId: 'peace-talks', target: `black-hand-0-${mate ? 'neutrality' : 'pacifism'}` };
  const result = applyAction(state, card); assert.ok(result.ok);
  const ended = applyAction(result.state, { type: 'endTurn' });
  console.log(JSON.stringify({ mate, fen, actions: [...actions, card], expected: mate ? 'DIRECT_MATE fizzle keeps Neutrality' : 'SELF_CHECK fizzle keeps Pacifism',
    history: result.state.history.at(-1), effects: result.state.effects, whiteChecked: isKingInCheck(result.state, 'white'),
    blackChecked: isKingInCheck(result.state, 'black'), endResult: ended.ok ? 'accepted' : ended.error, outcome: ended.state.outcome,
    blackDests: ended.ok ? [...legalDests(ended.state)] : undefined }));
}
console.log(JSON.stringify({ sentinel: 'PEACE_TALKS_SAFETY_PROBES_DONE', groups: 2, ms: performance.now() - started }));
