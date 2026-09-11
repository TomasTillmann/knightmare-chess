import assert from 'node:assert/strict';
import { applyAction, legalDests, isKingInCheck } from './src/game/reducer.js';
import { createGameState } from './src/game/state.js';
import { checkState, digest } from './src/game/cards/random-campaign.js';
import type { GameState, GameAction } from './src/game/types.js';
const started = performance.now();
let checks = 0;
function act(state: GameState, action: GameAction): GameState {
  const before = digest(state), result = applyAction(state, action);
  assert.equal(digest(state), before); checks++;
  assert.ok(result.ok, result.ok ? '' : result.error.message); checks++;
  checkState(result.state); checks++;
  return result.state;
}
const initial = createGameState({ fen: '7k/7p/8/8/8/N7/8/R6K w - - 0 1', hands: { white: ['confabulation'] } });
const invalid = applyAction(initial, { type: 'playCard', cardId: 'confabulation', target: [] });
assert.equal(invalid.ok, false); checks++;
assert.deepEqual(invalid.state, initial); checks++;
let state = act(initial, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a1', to: 'a3' }] });
assert.equal(state.effects.length, 1); checks++;
assert.equal(state.players.white.discard.length, 0); checks++;
state = act(state, { type: 'endTurn' });
state = act(state, { type: 'move', from: 'h7', to: 'h6' });
state = act(state, { type: 'endTurn' });
assert.ok(legalDests(state).get('a3')?.includes('b5')); checks++;
assert.ok(legalDests(state).get('a3')?.includes('a6')); checks++;
state = act(state, { type: 'move', from: 'a3', to: 'b5' });
state = act(state, { type: 'endTurn' });
let seed = 909007;
for (let i = 0; i < 6 && !state.outcome; i++) {
  const moves = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => ({ type: 'move' as const, from, to })));
  assert.ok(moves.length); checks++;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  state = act(state, moves[seed % moves.length]!);
  if (!state.outcome) state = act(state, { type: 'endTurn' });
}
const shielded = createGameState({ fen: '4r2k/8/8/8/8/8/4R2B/4K3 w - - 0 1', hands: { white: ['confabulation'] } });
assert.equal(isKingInCheck(shielded, 'white'), false); checks++;
const unsafe = act(shielded, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'e2', to: 'h2' }] });
assert.equal(unsafe.history.at(-1)?.reason, 'SELF_CHECK'); checks++;
assert.deepEqual(unsafe.pieces, shielded.pieces); checks++;
assert.equal(unsafe.effects.length, 0); checks++;
const mateCases = [
  { owner: 'white', defender: 'black', fen: 'k6B/pp6/8/8/8/8/8/4K2R w - - 0 1', from: 'h1', to: 'h8', king: 'a8', escape: 'a7' },
  { owner: 'black', defender: 'white', fen: '4k2r/8/8/8/8/8/PP6/K6b b - - 0 1', from: 'h8', to: 'h1', king: 'a1', escape: 'a2' },
] as const;
for (const fixture of mateCases) {
  for (const rescue of [false, true]) {
    let position = createGameState({ fen: fixture.fen, hands: { [fixture.owner]: ['confabulation'], [fixture.defender]: rescue ? ['disintegration'] : [] } });
    const card = position.players[fixture.owner].hand[0]!;
    const carrier = position.pieces.find(piece => piece.square === fixture.to)!;
    const mover = position.pieces.find(piece => piece.square === fixture.from)!;
    position = act(position, { type: 'playCard', cardId: 'confabulation', target: [{ from: fixture.from, to: fixture.to }] });
    assert.equal(position.history.at(-1)?.type, 'cardPlayed'); checks++;
    assert.equal(isKingInCheck(position, fixture.defender), true); checks++;
    assert.equal(position.outcome, null); checks++;
    assert.deepEqual(position.effects, [{ type: 'confabulation', owner: fixture.owner, card, pieceIds: [carrier.id, mover.id] }]); checks++;
    assert.deepEqual(position.pieces.find(piece => piece.id === mover.id), { ...mover, square: null, zone: 'away' }); checks++;
    position = act(position, { type: 'endTurn' });
    if (rescue) {
      assert.equal(position.outcome, null); checks++;
      position = act(position, { type: 'playCard', cardId: 'disintegration', target: fixture.escape });
      position = act(position, { type: 'move', from: fixture.king, to: fixture.escape });
      position = act(position, { type: 'endTurn' });
      assert.equal(position.outcome, null); checks++;
      assert.equal(isKingInCheck(position, fixture.defender), false); checks++;
    } else {
      assert.deepEqual(position.outcome, { winner: fixture.owner, reason: 'checkmate' }); checks++;
    }
    assert.equal(position.effects.some(effect => (effect as { card?: { id: string } }).card?.id === card.id), true); checks++;
    assert.equal(position.players[fixture.owner].discard.some(discarded => discarded.id === card.id), false); checks++;
  }
}
console.log(JSON.stringify({ sentinel: 'CONFAB_MATE_SCAFFOLD_OK', checks, findings: 0, ms: performance.now() - started }));
