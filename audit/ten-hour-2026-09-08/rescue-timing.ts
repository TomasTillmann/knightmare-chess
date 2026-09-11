import { readFileSync } from 'node:fs';
import { applyAction, legalDests, isKingInCheck } from '../../src/game/reducer.js';
import type { GameState } from '../../src/game/types.js';
const saved = JSON.parse(readFileSync(new URL('./random-9091013-failure.json', import.meta.url), 'utf8'));
const state: GameState = saved.state.pendingRescue.before;
const action = { type: 'move' as const, from: 'c1', to: 'b2' };
const before = JSON.stringify(state), started = performance.now();
const result = process.argv[2] === 'destinations' ? legalDests(state) : applyAction(state, action);
console.log(JSON.stringify({ sentinel: 'RESCUE_TIMING_DONE', operation: process.argv[2] ?? 'move',
  result: result instanceof Map ? [...result] : { ok: result.ok, error: result.ok ? undefined : result.error, pendingRescue: !!result.state.pendingRescue },
  ms: performance.now() - started, inputUnchanged: before === JSON.stringify(state), checked: isKingInCheck(state, 'white') }));
