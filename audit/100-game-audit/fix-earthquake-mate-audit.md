# Earthquake mate engine audit

Production baseline supplied by parent: `ef7747b`, 5,407/5,407 engine tests and typecheck passing.

First action executed the parent scaffold successfully: **93 checks, 0 findings, 55.480417 ms**. Parent-supplied scaffold SHA256: `76f201d449be3658e51e56ae0d224c293bed88c82fce236e7c4520d9bec24d25`.

Added exactly one independent adversarial group using the validated `selfCheckMateReady` fixture. Clockwise Earthquake with no promotions is accepted and atomically fizzles with `SELF_CHECK`: orientation remains 0; pieces and effects remain unchanged; the physical Earthquake leaves White's hand and enters White's discard; outcome remains null.

Final harness executed once after the patch: **103 checks, 0 findings, 56.019792 ms** measured internally with `performance.now()`; command wall time **71.920458 ms**. The new group contributes 10 checks, including the existing action helper's 3 checks. The retained scaffold covers directed promotion/mate probes, a bounded seeded random continuation (up to 6 moves), and two independent card-bearing mate scenarios. The added adversarial probe performs 1 card action. No test sources were inspected and no production files were changed.

Final harness SHA256: `9ff3fcc98f3cf23065c061a812c286a3fcd8ddb686ad15f9d132527c206f1663`.

## Full executed final harness

```typescript
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from './src/game/reducer.js';
import { createGameState } from './src/game/state.js';
import { checkState, digest } from './src/game/cards/random-campaign.js';
import type { GameAction, GameState } from './src/game/types.js';
const started = performance.now();
let checks = 0;
function act(state: GameState, action: GameAction): GameState {
  const before = digest(state), result = applyAction(state, action);
  assert.equal(digest(state), before); checks++;
  assert.ok(result.ok, result.ok ? '' : result.error.message); checks++;
  checkState(result.state); checks++;
  return result.state;
}
let state = createGameState({ fen: '2R5/k6P/pp6/8/8/8/8/4K1N1 w - - 0 1', hands: { white: ['earthquake'] } });
state = act(state, { type: 'move', from: 'g1', to: 'f3' });
state = act(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [{ square: 'a6', role: 'knight' }, { square: 'h7', role: 'queen' }] } });
assert.equal(state.orientation, 90); checks++;
assert.equal(isKingInCheck(state, 'black'), true); checks++;
state = act(state, { type: 'endTurn' });
state = act(state, { type: 'move', from: 'a6', to: 'c7' });
assert.equal(isKingInCheck(state, 'black'), false); checks++;
state = act(state, { type: 'endTurn' });
let seed = 908004;
for (let i = 0; i < 6 && !state.outcome; i++) {
  const moves = [...legalDests(state)].flatMap(([from, tos]) => tos.map(to => ({ type: 'move' as const, from, to })));
  assert.ok(moves.length); checks++;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  state = act(state, moves[seed % moves.length]!);
  if (!state.outcome) state = act(state, { type: 'endTurn' });
}
for (const role of ['queen', 'rook'] as const) {
  let mating = createGameState({ fen: '2R5/k6P/pp6/8/8/8/8/4K1N1 w - - 0 1', hands: { white: ['earthquake'] } });
  mating = act(mating, { type: 'move', from: 'g1', to: 'f3' });
  mating = act(mating, { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [{ square: 'a6', role: 'rook' }, { square: 'h7', role }] } });
  assert.equal(mating.orientation, 90); checks++;
  assert.equal(isKingInCheck(mating, 'black'), true); checks++;
  assert.equal(isKingInCheck(mating, 'white'), false); checks++;
  assert.equal(mating.effects.length, 1); checks++;
  mating = act(mating, { type: 'endTurn' });
  assert.deepEqual(mating.outcome, { winner: 'white', reason: 'checkmate' }); checks++;
}
const selfCheckMateReady = createGameState({ fen: '6P1/5KPk/6p1/8/8/8/8/8 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['earthquake'] } });
checkState(selfCheckMateReady); checks++;
assert.equal(isKingInCheck(selfCheckMateReady, 'white'), false); checks++;
assert.equal(isKingInCheck(selfCheckMateReady, 'black'), false); checks++;
const doubleCheckReference = structuredClone(selfCheckMateReady);
doubleCheckReference.orientation = 90;
assert.equal(isKingInCheck(doubleCheckReference, 'white'), true); checks++;
assert.equal(isKingInCheck(doubleCheckReference, 'black'), true); checks++;
// Independent adversarial group: simultaneous opponent mate and acting-king self-check.
const after = act(selfCheckMateReady, { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] } });
assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK'); checks++;
assert.equal(after.orientation, 0); checks++;
assert.deepEqual(after.pieces, selfCheckMateReady.pieces); checks++;
assert.deepEqual(after.effects, selfCheckMateReady.effects); checks++;
assert.deepEqual(after.players.white.hand, []); checks++;
assert.deepEqual(after.players.white.discard, [...selfCheckMateReady.players.white.discard, ...selfCheckMateReady.players.white.hand]); checks++;
assert.equal(after.outcome, null); checks++;
console.log(JSON.stringify({ sentinel: 'EARTHQUAKE_AUDIT_OK', checks, findings: 0, ms: performance.now() - started }));
```

Temporary harness deleted after successful execution and report creation.

EARTHQUAKE_AUDIT_DONE
