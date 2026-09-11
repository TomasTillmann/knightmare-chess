# Doppelganger pawn audit

Executed parent scaffold: 108 checks, zero findings. Added exactly one independent permanent Crab transformation group with two candidate actions, separately from immutable crabReady. Rule §21 predicts copying permanent Crab movement: f5-g6 allowed; f5-f6 rejected.

Total checks: 113; measured wall time: 32.63558400000001 ms. Findings: ['g6: expected ok=true, actual ok=false', 'f6: expected ok=false, actual ok=true']

Exact executed code and fixtures:
```typescript
import assert from 'node:assert/strict';
import { applyAction, legalDests } from './src/game/reducer.js';
import { createGameState } from './src/game/state.js';
import { checkState, digest } from './src/game/cards/random-campaign.js';
import type { GameAction, GameState } from './src/game/types.js';
const started = performance.now();
let checks = 0;
function act(state: GameState, action: GameAction): GameState {
  const frozen = digest(state), result = applyAction(state, action);
  assert.equal(digest(state), frozen); checks++;
  assert.ok(result.ok, result.ok ? '' : result.error.message); checks++;
  checkState(result.state); checks++;
  return result.state;
}
let state = createGameState({ fen: 'r6k/8/8/8/3N4/8/8/7K b - - 0 1', hands: { white: ['doppelganger'], black: ['ghostwalk'] } });
state = act(state, { type: 'move', from: 'a8', to: 'a6' });
state = act(state, { type: 'endTurn' });
state = act(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'd4', to: 'f4' }] });
assert.equal(state.pieces.find(p => p.id === 'white-knight-d4')?.square, 'f4'); checks++;
assert.equal(state.pieces.find(p => p.id === 'white-knight-d4')?.role, 'knight'); checks++;
state = act(state, { type: 'endTurn' });
state = act(state, { type: 'playCard', cardId: 'ghostwalk', target: [{ from: 'a6', to: 'a4' }] });
state = act(state, { type: 'endTurn' });
let seed = 908003;
for (let i = 0; i < 6 && !state.outcome; i++) {
  const moves = [...legalDests(state)].flatMap(([from, tos]) => tos.map(to => ({ type: 'move' as const, from, to })));
  assert.ok(moves.length); checks++;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  state = act(state, moves[seed % moves.length]!);
  if (!state.outcome) state = act(state, { type: 'endTurn' });
}
console.log(JSON.stringify({ sentinel: 'DOPPEL_PAWN_SCAFFOLD_OK', checks, findings: 0, ms: performance.now() - started }));
for (const [fen, color, pawnFrom, pawnTo, from, to] of [
  ['6k1/7p/8/8/3N4/8/8/K7 b - - 0 1', 'white', 'h7', 'h6', 'd4', 'd5'],
  ['k7/3b4/8/8/8/8/7P/6K1 w - - 0 1', 'black', 'h2', 'h3', 'd7', 'd5'],
] as const) {
  let position = createGameState({ fen, hands: { [color]: ['doppelganger'] } });
  const actor = structuredClone(position.pieces.find(p => p.square === from)!);
  position = act(position, { type: 'move', from: pawnFrom, to: pawnTo });
  position = act(position, { type: 'endTurn' });
  position = act(position, { type: 'playCard', cardId: 'doppelganger', target: [{ from, to }] });
  assert.deepEqual(position.pieces.find(p => p.id === actor.id), { ...actor, square: to }); checks++;
  assert.deepEqual(position.enPassant, []); checks++;
  assert.equal(position.players[color].discard.filter(c => c.cardId === 'doppelganger').length, 1); checks++;
}
let crabReady = createGameState({ fen: '6k1/5p2/8/8/3N4/8/8/1K6 b - - 0 1', hands: { black: ['crab'], white: ['doppelganger'] } });
for (const action of [
  { type: 'move', from: 'f7', to: 'f6' },
  { type: 'playCard', cardId: 'crab', target: 'f6' },
  { type: 'endTurn' },
  { type: 'move', from: 'd4', to: 'f5' },
  { type: 'endTurn' },
  { type: 'move', from: 'f6', to: 'e5' },
  { type: 'endTurn' },
] satisfies GameAction[]) crabReady = act(crabReady, action);
assert.equal(crabReady.effects.some(effect => (effect as { type: string }).type === 'crab'), true); checks++;
console.log(JSON.stringify({ sentinel: 'DOPPEL_PAWN_SCAFFOLD_OK', checks, findings: 0, ms: performance.now() - started }));
const observations: unknown[] = [], findings: string[] = [];
for (const [to, expected] of [['g6', true], ['f6', false]] as const) {
  const action: GameAction = { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'f5', to }] };
  const before = digest(crabReady), result = applyAction(crabReady, action);
  checks++; if (digest(crabReady) !== before) findings.push(`${to}: input mutated`);
  checks++; if (result.ok !== expected) findings.push(`${to}: expected ok=${expected}, actual ok=${result.ok}`);
  if (result.ok) { checks++; try { checkState(result.state); } catch (error) { findings.push(`${to}: ${error}`); } }
  observations.push({ action, expected, ok: result.ok, error: result.ok ? null : result.error, pieces: result.state.pieces });
}
console.log(JSON.stringify({ sentinel: 'DOPPEL_PAWN_AUDIT_DONE', checks, candidateActions: 2, ms: performance.now() - started, findings, observations }));
```

Actual observations (piece positions encode resulting board):
```json
{"sentinel":"DOPPEL_PAWN_SCAFFOLD_OK","checks":62,"findings":0,"ms":26.263875}
{"sentinel":"DOPPEL_PAWN_SCAFFOLD_OK","checks":108,"findings":0,"ms":31.885666999999998}
{"sentinel":"DOPPEL_PAWN_AUDIT_DONE","checks":113,"candidateActions":2,"ms":32.63558400000001,"findings":["g6: expected ok=true, actual ok=false","f6: expected ok=false, actual ok=true"],"observations":[{"action":{"type":"playCard","cardId":"doppelganger","target":[{"from":"f5","to":"g6"}]},"expected":true,"ok":false,"error":{"code":"ILLEGAL_MOVE","message":"Copy the last moved piece to an empty square."},"pieces":[{"id":"white-king-b1","owner":"white","role":"king","originalRole":"king","square":"b1","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"white-knight-d4","owner":"white","role":"knight","originalRole":"knight","square":"f5","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"e5","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-king-g8","owner":"black","role":"king","originalRole":"king","square":"g8","zone":"board","promoted":false,"royal":true,"neutral":false}]},{"action":{"type":"playCard","cardId":"doppelganger","target":[{"from":"f5","to":"f6"}]},"expected":false,"ok":true,"error":null,"pieces":[{"id":"white-king-b1","owner":"white","role":"king","originalRole":"king","square":"b1","zone":"board","promoted":false,"royal":true,"neutral":false},{"id":"white-knight-d4","owner":"white","role":"knight","originalRole":"knight","square":"f6","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-pawn-f7","owner":"black","role":"pawn","originalRole":"pawn","square":"e5","zone":"board","promoted":false,"royal":false,"neutral":false},{"id":"black-king-g8","owner":"black","role":"king","originalRole":"king","square":"g8","zone":"board","promoted":false,"royal":true,"neutral":false}]}]}
```

DOPPEL_PAWN_AUDIT_DONE
