# Crab return audit — dcef98d

CRAB_RETURN_AUDIT_DONE

Findings: **0**. Exactly one independent adversarial group added; no production or test sources were read or changed.

Execution evidence:
- First tool action executed the parent scaffold: 198 checks, 0 findings, 58.505083 ms; process exit 0.
- Original scaffold SHA-256 verified: `6a7afede3583b7963aa07d2dc69a7a46b075f908eae739344dd5b8ef524d11d5`.
- A real `apply_patch` added the specified cancellation group, followed by exactly one rerun: 223 checks, 0 findings, 64.996208 ms; process exit 0 and sentinel `CRAB_RETURN_AUDIT_DONE`.
- Total executed assertions/invariant checks across both runs: 421. New group: 6 successful actions (18 action/invariant checks) plus 7 explicit outcome checks = 25 additional checks. Existing directed, randomized (up to 6 seeded plies), and multi-card probes were rerun unchanged.

Adversarial sequence: Black Peace Talks targets the physical Crab card ID during capturedReady afterMove; end Black turn; White Winged Victory returns `white-pawn-c3` to e4; end White turn; Black Kh8-h7; end Black turn.

Observed matched expected: original Crab effect absent; exact original Crab card appears once in White discard; original piece ID appears exactly once at e4; legal destinations from e4 are exactly `[e5]`; both kings are safe. No finding was masked.

Timing: initial execution completed in the first tool invocation (0.4 seconds for that invocation); patch and rerun completed in the second invocation. Elapsed from the first invocation's post-read timestamp to report preparation: 48.887 seconds; this excludes approximately 0.4 seconds for the first tool invocation. Timing deviation: saving the report and deleting the scaffold completed about 49.7 seconds after the initial tool invocation began, exceeding the 45-second total budget by about 4.7 seconds. The initial execution and patch gates were met; the patch plus final rerun had completed 13.651 seconds after the initial post-read timestamp. Correcting this timing disclosure took additional time. Final report timestamp: 2026-09-09T08:40:25.929547+00:00.

Final scaffold SHA-256: `2981c89865bd551ced51d9b3ee82486ad06ce65ec76d76b33a4b7a6e225c5579`.

The temporary scaffold was removed after saving this report. Recreate `.audit-crab-return.ts` in the repository root from the following complete source and run `node --import tsx .audit-crab-return.ts` to reproduce.

```typescript
import assert from 'node:assert/strict';
import { applyAction, legalDests, isKingInCheck } from './src/game/reducer.js';
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
let played = createGameState({ fen: '7k/8/8/8/1p6/2P5/5P2/K7 w - - 0 1', hands: { white: ['crab', 'hostage', 'winged-victory', 'betrayal'], black: ['peace-talks'] } });
const crabCard = played.players.white.hand.find(card => card.cardId === 'crab')!;
played = act(played, { type: 'move', from: 'a1', to: 'a2' });
played = act(played, { type: 'playCard', cardId: 'crab', target: 'c3' });
played = act(played, { type: 'endTurn' });
let capturedReady = act(played, { type: 'move', from: 'b4', to: 'c3' });
assert.equal(capturedReady.pieces.find(piece => piece.id === 'white-pawn-c3')?.zone, 'captured'); checks++;
assert.equal(isKingInCheck(capturedReady, 'white'), false); checks++;
assert.equal(isKingInCheck(capturedReady, 'black'), false); checks++;
let state = act(played, { type: 'move', from: 'h8', to: 'h7' });
state = act(state, { type: 'endTurn' });
state = act(state, { type: 'move', from: 'c3', to: 'd4' });
state = act(state, { type: 'endTurn' });
let seed = 908006;
for (let i = 0; i < 6 && !state.outcome; i++) {
  const moves = [...legalDests(state)].flatMap(([from, tos]) => tos.map(to => ({ type: 'move' as const, from, to })));
  assert.ok(moves.length); checks++;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  state = act(state, moves[seed % moves.length]!);
  if (!state.outcome) state = act(state, { type: 'endTurn' });
}
let hostage = act(capturedReady, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'white-pawn-c3', pawn: 'f2' } });
hostage = act(hostage, { type: 'endTurn' });
assert.deepEqual(legalDests(hostage).get('f2')?.sort(), ['e3', 'g3']); checks++;
for (const delayed of [false, true]) {
  let returned = act(capturedReady, { type: 'endTurn' });
  if (delayed) {
    returned = act(returned, { type: 'move', from: 'a2', to: 'a1' });
    returned = act(returned, { type: 'endTurn' });
    returned = act(returned, { type: 'move', from: 'h8', to: 'h7' });
    returned = act(returned, { type: 'endTurn' });
  }
  returned = act(returned, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-c3', to: 'e4' } });
  returned = act(returned, { type: 'endTurn' });
  returned = act(returned, { type: 'move', from: delayed ? 'h7' : 'h8', to: delayed ? 'h8' : 'h7' });
  returned = act(returned, { type: 'endTurn' });
  assert.deepEqual(legalDests(returned).get('e4')?.sort(), delayed ? ['e5'] : ['d5', 'f5']); checks++;
}
let betrayed = act(capturedReady, { type: 'endTurn' });
betrayed = act(betrayed, { type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-c3', to: 'c3' } });
assert.deepEqual(legalDests(betrayed).get('c3')?.sort(), ['b4', 'd4']); checks++;
assert.equal(capturedReady.effects.some(effect => (effect as { card?: { id: string } }).card?.id === crabCard.id), true); checks++;
for (const color of ['white', 'black'] as const) {
  const black = color === 'black', opponent = black ? 'white' : 'black';
  let riposte = createGameState({
    fen: black ? '7k/8/8/8/8/8/p7/1R2K3 b - - 0 1' : '1r2k3/P7/8/8/8/8/8/7K w - - 0 1',
    hands: { [color]: ['crab'], [opponent]: ['riposte'] },
  });
  const card = riposte.players[color].hand[0]!;
  riposte = act(riposte, { type: 'move', from: black ? 'h8' : 'h1', to: black ? 'g8' : 'g1' });
  riposte = act(riposte, { type: 'playCard', cardId: 'crab', target: black ? 'a2' : 'a7' });
  riposte = act(riposte, { type: 'endTurn' });
  riposte = act(riposte, { type: 'move', from: black ? 'e1' : 'e8', to: black ? 'f1' : 'f8' });
  riposte = act(riposte, { type: 'endTurn' });
  riposte = act(riposte, { type: 'move', from: black ? 'a2' : 'a7', to: black ? 'b1' : 'b8', promotion: 'knight' });
  riposte = act(riposte, { type: 'playCard', cardId: 'riposte' });
  const captured = riposte.pieces.find(piece => piece.id === `${color}-pawn-${black ? 'a2' : 'a7'}`)!;
  assert.equal(captured.capturedAtPly, black ? 3 : 2); checks++;
  assert.equal(captured.promoted, false); checks++;
  assert.equal(captured.zone, 'captured'); checks++;
  riposte = act(riposte, { type: 'endTurn' });
  assert.equal(riposte.turn.phase, 'afterMove'); checks++;
  assert.equal(riposte.effects.some(effect => (effect as { card?: { id: string } }).card?.id === card.id), true); checks++;
  assert.equal(riposte.players[color].discard.some(c => c.id === card.id), false); checks++;
  riposte = act(riposte, { type: 'endTurn' });
  assert.equal(riposte.effects.some(effect => (effect as { card?: { id: string } }).card?.id === card.id), false); checks++;
  assert.equal(riposte.players[color].discard.filter(c => c.id === card.id).length, 1); checks++;
}
// Independent adversarial group: explicit cancellation survives capture and return.
let cancelled = act(capturedReady, { type: 'playCard', cardId: 'peace-talks', target: crabCard.id });
cancelled = act(cancelled, { type: 'endTurn' });
cancelled = act(cancelled, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-c3', to: 'e4' } });
cancelled = act(cancelled, { type: 'endTurn' });
cancelled = act(cancelled, { type: 'move', from: 'h8', to: 'h7' });
cancelled = act(cancelled, { type: 'endTurn' });
assert.equal(cancelled.effects.some(effect => (effect as { card?: { id: string } }).card?.id === crabCard.id), false); checks++;
assert.equal(cancelled.players.white.discard.filter(card => card.id === crabCard.id).length, 1); checks++;
assert.equal(cancelled.pieces.filter(piece => piece.id === 'white-pawn-c3').length, 1); checks++;
assert.equal(cancelled.pieces.find(piece => piece.id === 'white-pawn-c3')?.square, 'e4'); checks++;
assert.deepEqual(legalDests(cancelled).get('e4')?.sort(), ['e5']); checks++;
assert.equal(isKingInCheck(cancelled, 'white'), false); checks++;
assert.equal(isKingInCheck(cancelled, 'black'), false); checks++;
console.log(JSON.stringify({ sentinel: 'CRAB_RETURN_AUDIT_DONE', checks, findings: 0, ms: performance.now() - started }));
```
