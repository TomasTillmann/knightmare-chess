# Doppelganger Crab engine audit

Exactly one independent adversarial group: four rotated Crab candidates plus identity and immutable-input invariants. Initial audit attempt passed result envelope to checkState; corrected to inspect result.ok and result.state. Initial sandbox scaffold launch blocked by IPC permissions; escalated run executed scaffold successfully.

Measured process wall time: 341.8 ms. Exit code: 0.

```text
{"sentinel":"DOPPEL_PAWN_SCAFFOLD_OK","checks":62,"findings":0,"ms":26.181375000000003}
{"sentinel":"DOPPEL_PAWN_SCAFFOLD_OK","checks":145,"findings":0,"ms":34.945166}
{"sentinel":"DOPPEL_CRAB_AUDIT_DONE","checks":157,"findings":[],"observations":["g4: accepted=true, expected=true","g6: accepted=true, expected=true","e6: accepted=false, expected=false","f6: accepted=false, expected=false"],"wallTimeMs":35.703416000000004}

```

Full final harness:

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
for (const [to, expected] of [['g6', true], ['e6', true], ['f6', false], ['e4', false], ['h7', false]] as const) {
  const before = digest(crabReady);
  const result = applyAction(crabReady, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'f5', to }] });
  assert.equal(digest(crabReady), before); checks++;
  assert.equal(result.ok, expected); checks++;
  if (result.ok) { checkState(result.state); checks++; }
}
let rotatedCrabReady = createGameState({ fen: '6k1/5p2/8/8/3N4/8/8/1K6 b - - 0 1', hands: { black: ['crab'], white: ['earthquake', 'doppelganger'] } });
for (const action of [
  { type: 'move', from: 'f7', to: 'f6' },
  { type: 'playCard', cardId: 'crab', target: 'f6' },
  { type: 'endTurn' },
  { type: 'move', from: 'd4', to: 'f5' },
  { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] } },
  { type: 'endTurn' },
  { type: 'move', from: 'f6', to: 'e5' },
  { type: 'endTurn' },
] satisfies GameAction[]) rotatedCrabReady = act(rotatedCrabReady, action);
assert.equal(rotatedCrabReady.orientation, 90); checks++;
console.log(JSON.stringify({ sentinel: 'DOPPEL_PAWN_SCAFFOLD_OK', checks, findings: 0, ms: performance.now() - started }));

// Independent adversarial group: rotated Crab forward diagonals copied by Doppelganger.
const observations: string[] = [];
const findings: string[] = [];
const rotatedDigest = digest(rotatedCrabReady);
for (const [to, expected] of [['g4', true], ['g6', true], ['e6', false], ['f6', false]] as const) {
  let accepted = false;
  try {
    const result = applyAction(rotatedCrabReady, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'f5', to }] } as GameAction);
    accepted = result.ok;
    if (result.ok) { checkState(result.state); checks++;
      const beforeActor = rotatedCrabReady.pieces.find(p => p.square === 'f5')!;
      assert.deepEqual(result.state.pieces.find(p => p.id === beforeActor.id), { ...beforeActor, square: to }); checks++;
    }
  } catch (error) {
    observations.push(`${to}: rejected (${String(error)})`);
  }
  checks++;
  observations.push(`${to}: accepted=${accepted}, expected=${expected}`);
  if (accepted !== expected) findings.push(`Rotated Crab Doppelganger f5-${to}: accepted=${accepted}, expected=${expected}`);
  assert.equal(digest(rotatedCrabReady), rotatedDigest);
  checks++;
}
console.log(JSON.stringify({ sentinel: 'DOPPEL_CRAB_AUDIT_DONE', checks, findings, observations, wallTimeMs: performance.now() - started }));

```

DOPPEL_CRAB_AUDIT_DONE
