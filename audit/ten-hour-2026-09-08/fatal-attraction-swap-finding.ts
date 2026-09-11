import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
const fen = '7k/8/8/8/2NR4/8/6R1/5B1K w - - 0 1';
for (const mode of ['frozen-neighbor', 'magnet'] as const) {
  let state = createGameState({ fen, hands: { white: ['fatal-attraction', 'holy-war'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'h1', to: 'g1' },
    { type: 'playCard', cardId: 'fatal-attraction', target: mode === 'magnet' ? 'c4' : 'd4' }, { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'h7' }, { type: 'endTurn' }];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ mode, action, error: result.ok ? undefined : result.error })); state = result.state; }
  const ordinary = applyAction(state, { type: 'move', from: 'c4', to: 'b6' });
  if (mode === 'frozen-neighbor') assert.equal(ordinary.ok, false);
  else { assert.ok(ordinary.ok); assert.equal(ordinary.state.effects.filter(e => e.type === 'fatal-attraction').length, 0); }
  const quiet: GameAction = { type: 'move', from: 'g1', to: 'h1' }, move = applyAction(state, quiet); assert.ok(move.ok); state = move.state;
  const swap: GameAction = { type: 'playCard', cardId: 'holy-war', target: { knight: 'c4', bishop: 'f1' } };
  const result = applyAction(state, swap);
  console.log(JSON.stringify({ mode, fen, actions: [...actions, quiet, swap], result: result.ok ? 'accepted' : result.error,
    knight: result.state.pieces.find(p => p.id === 'white-knight-c4'), effects: result.state.effects,
    ordinaryControl: mode === 'frozen-neighbor' ? 'Knight move correctly rejected' : 'Knight move accepted and magnet correctly discarded',
    classification: 'Local rules18.6 explicitly allow this; publisher FAQ40 counts swaps as movement. Fatal Attraction-specific application is inferred.' }));
}
let control = createGameState({ fen, hands: { white: ['holy-war'] } });
for (const action of [{ type: 'move', from: 'h1', to: 'g1' }, { type: 'playCard', cardId: 'holy-war', target: { knight: 'c4', bishop: 'f1' } }] as GameAction[]) {
  const result = applyAction(control, action); assert.ok(result.ok); control = result.state;
}
assert.equal(control.pieces.find(p => p.id === 'white-knight-c4')?.square, 'f1');
console.log(JSON.stringify({ sentinel: 'FATAL_ATTRACTION_SWAP_DONE', groups: 2, plainSwapControl: true, ms: performance.now() - started }));
