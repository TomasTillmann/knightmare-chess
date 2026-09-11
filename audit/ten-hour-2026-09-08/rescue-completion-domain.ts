import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, legalDests, isKingInCheck } from '../../src/game/reducer.js';
import type { GameState } from '../../src/game/types.js';
const started = performance.now();
const saved = JSON.parse(readFileSync(new URL('./random-9091013-failure.json', import.meta.url), 'utf8'));
const initial: GameState = saved.state.pendingRescue.before;
const advertised: Array<[string, string[]]> = JSON.parse(readFileSync(new URL('./rescue-profile.log', import.meta.url), 'utf8').trim()).result;
const ordinaryStarted = performance.now(), ordinary = legalDests(initial, false);
console.log(JSON.stringify({ operation: 'withoutAfterMoveRescue', destinations: [...ordinary], ms: performance.now() - ordinaryStarted }));
let moves = 0, rescued = 0, replies = 0;
for (const [from, destinations] of advertised) for (const to of destinations) {
  assert.ok(moves < 64, 'fixed advertised-move budget');
  const before = JSON.stringify(initial), result = applyAction(initial, { type: 'move', from, to });
  assert.ok(result.ok, JSON.stringify({ from, to, error: result.ok ? undefined : result.error }));
  assert.equal(JSON.stringify(initial), before);
  let state = result.state;
  if (state.pendingRescue) {
    const neutralKnight = state.pieces.find(p => p.id === 'white-knight-b1' && p.zone === 'board');
    const target = neutralKnight?.square ?? 'd5';
    const card = applyAction(state, { type: 'playCard', cardId: 'haunting-memories', target });
    assert.ok(card.ok, JSON.stringify({ from, to, target, error: card.ok ? undefined : card.error }));
    assert.equal(card.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(card.state.pendingRescue, null);
    assert.equal(isKingInCheck(card.state, 'white'), false);
    state = card.state; rescued++;
  } else assert.equal(isKingInCheck(state, 'white'), false);
  const ended = applyAction(state, { type: 'endTurn' }); assert.ok(ended.ok);
  state = ended.state;
  if (!state.outcome) {
    const [replyFrom, replyTos] = [...legalDests(state, false)][0] ?? [];
    assert.ok(replyFrom && replyTos?.length, JSON.stringify({ from, to, stage: 'black reply' }));
    const reply = applyAction(state, { type: 'move', from: replyFrom, to: replyTos[0] }); assert.ok(reply.ok);
    const next = applyAction(reply.state, { type: 'endTurn' }); assert.ok(next.ok); replies++;
  }
  moves++;
  console.log(JSON.stringify({ from, to, rescued: !!result.state.pendingRescue, moves, ms: performance.now() - started }));
}
console.log(JSON.stringify({ sentinel: 'RESCUE_COMPLETION_DOMAIN_OK', moves, rescued, replies, findings: 0, ms: performance.now() - started }));
