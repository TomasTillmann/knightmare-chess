import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, legalDests, isKingInCheck } from '../../src/game/reducer.js';
import type { GameState } from '../../src/game/types.js';
const saved: GameState = JSON.parse(readFileSync(new URL('./random-9092081-failure.json', import.meta.url), 'utf8')).state;
const state = process.argv[2] === 'completion' ? saved : saved.pendingRescue!.before;
const started = performance.now(), before = JSON.stringify(state);
if (process.argv[2] === 'completion') {
  assert.equal(isKingInCheck(state, 'black'), true);
  const card = applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'g4', to: 'h1' }] });
  assert.ok(card.ok, JSON.stringify(card)); assert.equal(isKingInCheck(card.state, 'black'), false);
  assert.equal(card.state.pendingRescue, null);
  const end = applyAction(card.state, { type: 'endTurn' }); assert.ok(end.ok); assert.equal(end.state.turn.color, 'white');
  console.log(JSON.stringify({ sentinel: 'DUNGEON_RESCUE_COMPLETED', assertions: 6, findings: 0, ms: performance.now() - started, inputUnchanged: before === JSON.stringify(state) }));
} else {
  const result = process.argv[2] === 'destinations' ? legalDests(state) : applyAction(state, { type: 'move', from: 'c5', to: 'c4' });
  console.log(JSON.stringify({ sentinel: 'DUNGEON_RESCUE_TIMING_DONE', operation: process.argv[2] ?? 'move', result: result instanceof Map ? [...result] : { ok: result.ok, error: result.ok ? undefined : result.error, pendingRescue: !!result.state.pendingRescue }, ms: performance.now() - started, inputUnchanged: before === JSON.stringify(state) }));
}
