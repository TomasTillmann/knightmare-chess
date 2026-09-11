import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { CardId, GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const mode of ['en-passant', 'dark-mirror'] as const) for (const crabs of [0, 1, 2]) {
  const fen = mode === 'en-passant' ? '7k/3p4/8/4P3/3P4/8/8/7K w - - 0 1' : '7k/8/8/4Pn2/3P4/8/8/7K w - - 0 1';
  const hand: CardId[] = [...Array(crabs).fill('crab'), 'confabulation', ...(mode === 'dark-mirror' ? ['dark-mirror' as const] : [])];
  let state = createGameState({ fen, hands: { white: hand } });
  const actions: GameAction[] = [];
  for (let i = 0; i < crabs; i++) actions.push(
    { type: 'move', from: i ? 'g1' : 'h1', to: i ? 'h1' : 'g1' },
    { type: 'playCard', cardId: 'crab', target: i ? 'e5' : 'd4' }, { type: 'endTurn' },
    { type: 'move', from: i ? 'g8' : 'h8', to: i ? 'h8' : 'g8' }, { type: 'endTurn' });
  actions.push({ type: 'playCard', cardId: 'confabulation', target: [{ from: 'd4', to: 'e5' }] }, { type: 'endTurn' },
    mode === 'en-passant' ? { type: 'move', from: 'd7', to: 'd5' } : { type: 'move', from: 'f5', to: 'd4' }, { type: 'endTurn' });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ mode, crabs, action, error: result.ok ? undefined : result.error })); state = result.state; }
  assert.equal(state.effects.filter(e => e.type === 'crab').length, crabs);
  assert.equal(state.effects.filter(e => e.type === 'confabulation').length, 1);
  const action: GameAction = mode === 'en-passant' ? { type: 'move', from: 'e5', to: 'd6' }
    : { type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'e5', to: 'd4' }] };
  const result = applyAction(state, action), victimId = mode === 'en-passant' ? 'black-pawn-d7' : 'black-knight-f5';
  const victimZone = result.state.pieces.find(p => p.id === victimId)?.zone;
  if (crabs === 0) { assert.ok(result.ok); assert.equal(victimZone, 'captured'); }
  if (crabs === 2 && mode === 'en-passant') assert.equal(victimZone, 'board');
  console.log(JSON.stringify({ mode, crabs, fen, actions: [...actions, action], result: result.ok ? 'accepted' : result.error, victimZone,
    expected: crabs === 1 ? 'Plain Pawn component retains its powers; Crab effect applies only to the transformed component (FAQ18)' : crabs === 0 ? 'Positive control: ordinary Pawn powers' : mode === 'en-passant' ? 'Negative control: Crabs cannot capture en passant (FAQ21)' : 'Observed only: standalone Crab interaction with Dark Mirror is a separate source question',
    qualification: mode === 'en-passant' && crabs === 1 ? 'Crab noncapture to d6 is itself legal, but public move action exposes no mode to select the missing en-passant capture' : undefined }));
}
console.log(JSON.stringify({ sentinel: 'CRAB_COMPOSITE_PAWN_POWERS_DONE', groups: 6, ms: performance.now() - started }));
