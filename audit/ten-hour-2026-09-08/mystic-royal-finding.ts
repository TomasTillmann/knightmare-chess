import assert from 'node:assert/strict';
import { applyAction, cardPlayTargets } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
const started = performance.now();
const initial = createGameState({ fen: '5r1k/8/8/8/8/8/8/4K3 w - - 0 1', hands: { white: ['mystic-shield'] } });
const safeMove = applyAction(initial, { type: 'move', from: 'e1', to: 'd1' });
assert.ok(safeMove.ok);
const shield = applyAction(safeMove.state, { type: 'playCard', cardId: 'mystic-shield', target: 'd1' });
console.log(JSON.stringify({ group: 'shield a safely moved King', initialFen: initial.fen,
  actions: [{ type: 'move', from: 'e1', to: 'd1' }, { type: 'playCard', cardId: 'mystic-shield', target: 'd1' }],
  offered: cardPlayTargets(safeMove.state, 'mystic-shield'), result: shield.ok ? 'accepted' : shield.error }));
const staged = applyAction(initial, { type: 'move', from: 'e1', to: 'f1' });
console.log(JSON.stringify({ group: 'King enters check intending Mystic Shield', initialFen: initial.fen,
  action: { type: 'move', from: 'e1', to: 'f1' }, result: staged.ok ? { pendingRescue: staged.state.pendingRescue !== null } : staged.error }));
console.log(JSON.stringify({ sentinel: 'MYSTIC_ROYAL_PROBES_DONE', groups: 2, ms: performance.now() - started }));
