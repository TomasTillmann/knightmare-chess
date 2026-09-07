import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function cancel(state: GameState, target?: unknown): GameState {
  const result = act(state, { type: 'playCard', cardId: 'think-again', target });
  assert.equal(result.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.history.at(-1)?.cardId, 'think-again');
  return result;
}

function opening() {
  const before = createGameState({ hands: { white: [], black: ['think-again'] } });
  return { before, moved: act(before, { type: 'move', from: 'e2', to: 'e4' }) };
}

function rejects(state: GameState, action: GameAction) {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
}

test('Think Again! has its own catalog identity', () => {
  const card = CARD_CATALOG['think-again'];
  assert.ok(card);
  assert.equal(card.name, 'Think Again!');
  assert.equal(card.points, 10);
  assert.equal(card.id, 'think-again');
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC20_card4.png');
  assert.deepEqual(card.timing, ['afterOpponentMove']);
});

test('Think Again! cancels the opponent move and requires a different replacement', () => {
  const start = createGameState({ hands: { white: [], black: ['think-again'] } });
  const move = applyAction(start, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(move.ok, true);
  const cancel = applyAction(move.state, { type: 'playCard', cardId: 'think-again' });
  assert.equal(cancel.ok, true);
  assert.deepEqual(cancel.state.pieces, start.pieces);
  assert.equal(cancel.state.turn.color, 'white');
  assert.equal(cancel.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(cancel.state.history.at(-1)?.cardId, 'think-again');
  assert.equal(applyAction(cancel.state, { type: 'move', from: 'e2', to: 'e4' }).ok, false);
  assert.equal(applyAction(cancel.state, { type: 'move', from: 'e2', to: 'e3' }).ok, true);
});

test('White may cancel Black without owning Chaos or Knightmare!', () => {
  const before = createGameState({ turn: 'black', hands: { white: ['think-again'], black: [] } });
  const restored = cancel(act(before, { type: 'move', from: 'e7', to: 'e5' }));
  assert.deepEqual(restored.pieces, before.pieces);
  assert.equal(restored.turn.color, 'black');
  assert.equal(restored.turn.phase, 'beforeMove');
  assert.equal(restored.turn.moveMade, false);
  rejects(restored, { type: 'move', from: 'e7', to: 'e5' });
  act(restored, { type: 'move', from: 'g8', to: 'f6' });
});

for (const fixture of [
  { label: 'capture', fen: '4k3/8/8/8/8/8/r7/R3K3 w Q - 17 23', from: 'a1', to: 'a2' },
  { label: 'en passant', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 8', from: 'e5', to: 'd6' },
  { label: 'promotion', fen: '7k/P7/8/8/8/8/8/4K3 w - - 2 9', from: 'a7', to: 'a8', promotion: 'queen' },
  { label: 'capture promotion', fen: '1r5k/P7/8/8/8/8/8/4K3 w - - 2 9', from: 'a7', to: 'b8', promotion: 'knight' },
  { label: 'king-side castling', fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 12 20', from: 'e1', to: 'g1' },
  { label: 'queen-side castling', fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 12 20', from: 'e1', to: 'c1' },
]) {
  test(`restores all physical pieces, FEN rights and clocks after ${fixture.label}`, () => {
    const before = createGameState({ fen: fixture.fen, hands: { black: ['think-again'] } });
    const moved = act(before, { type: 'move', from: fixture.from, to: fixture.to, promotion: fixture.promotion });
    assert.notDeepEqual(moved.pieces, before.pieces);
    const restored = cancel(moved);
    assert.deepEqual(restored.pieces, before.pieces);
    assert.equal(restored.fen, before.fen);
    assert.deepEqual(restored.enPassant, before.enPassant);
    assert.deepEqual(restored.effects, before.effects);
    assert.equal(restored.turn.phase, 'beforeMove');
    assert.equal(restored.turn.moveMade, false);
  });
}

for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
  test(`accepts the target contract ${JSON.stringify(target)}`, () => {
    const { before, moved } = opening();
    const restored = cancel(moved, target);
    assert.deepEqual(restored.pieces, before.pieces);
    assert.equal(restored.players.black.discard.filter(card => card.cardId === 'think-again').length, 1);
    assert.equal(restored.turn.cardPlays.black, 1);
  });
}

test('rejects every malformed target atomically', () => {
  const { moved } = opening();
  for (const target of [null, false, true, 0, 'e4', [], {}, { returnCard: 1 }, { returnCard: 'false' }, { returnCard: null }, { returnCard: false, extra: true }]) {
    rejects(moved, { type: 'playCard', cardId: 'think-again', target });
  }
});

test('spends only the selected physical Think Again! and draws once', () => {
  const start = createGameState({ hands: { black: ['think-again', 'think-again'] }, decks: { black: ['panic', 'crab'] } });
  const selected = start.players.black.hand[1]!;
  const next = act(act(start, { type: 'move', from: 'e2', to: 'e4' }), { type: 'playCard', cardId: 'think-again', cardInstanceId: selected.id });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'think-again');
  assert.deepEqual(next.players.black.discard, [selected]);
  assert.deepEqual(next.players.black.hand, [start.players.black.hand[0], start.players.black.deck[0]]);
  assert.deepEqual(next.players.black.deck, [start.players.black.deck[1]]);
  assert.equal(next.turn.cardPlays.black, 1);
});

test('rejects a nonexistent selected physical card', () => {
  rejects(opening().moved, { type: 'playCard', cardId: 'think-again', cardInstanceId: 'missing' });
});

test('rejects a fabricated after-move state even with invented history', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { black: ['think-again'] } });
  rejects(state, { type: 'playCard', cardId: 'think-again' });
  state.history.push({ type: 'move', color: 'white', from: 'e2', to: 'e4' });
  rejects(state, { type: 'playCard', cardId: 'think-again' });
});

test('ending the affected turn closes the cancellation window', () => {
  const ended = act(opening().moved, { type: 'endTurn' });
  rejects(ended, { type: 'playCard', cardId: 'think-again' });
  assert.deepEqual(cardPlayTargets(ended, 'think-again'), []);
});

test('cannot be played before any move', () => {
  const state = opening().before;
  rejects(state, { type: 'playCard', cardId: 'think-again' });
  assert.deepEqual(cardPlayTargets(state, 'think-again'), []);
});

test('requires Think Again! in the reacting hand', () => {
  const state = act(createGameState({ hands: { black: ['chaos', 'knightmare'] } }), { type: 'move', from: 'e2', to: 'e4' });
  rejects(state, { type: 'playCard', cardId: 'think-again' });
});

test('cannot cancel its owner’s own move', () => {
  const state = act(createGameState({ hands: { white: ['think-again'] } }), { type: 'move', from: 'e2', to: 'e4' });
  rejects(state, { type: 'playCard', cardId: 'think-again' });
});

test('legal destinations exclude the repeat while retaining different moves', () => {
  const restored = cancel(opening().moved);
  assert.ok(!legalDests(restored).get('e2')?.includes('e4'));
  assert.ok(legalDests(restored).get('e2')?.includes('e3'));
  rejects(restored, { type: 'move', from: 'e2', to: 'e4' });
  act(restored, { type: 'move', from: 'g1', to: 'f3' });
});

test('changing only the promotion declaration does not evade the repeat prohibition', () => {
  const before = createGameState({ fen: '7k/P7/8/8/8/8/8/4K3 w - - 0 1', hands: { black: ['think-again'] } });
  const restored = cancel(act(before, { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' }));
  for (const promotion of ['queen', 'rook', 'bishop', 'knight']) rejects(restored, { type: 'move', from: 'a7', to: 'a8', promotion });
  act(restored, { type: 'move', from: 'e1', to: 'e2' });
});

test('changing the castling alias does not evade the repeat prohibition', () => {
  const before = createGameState({ fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', hands: { black: ['think-again'] } });
  const restored = cancel(act(before, { type: 'move', from: 'e1', to: 'g1' }));
  for (const to of ['g1', 'h1']) rejects(restored, { type: 'move', from: 'e1', to });
  act(restored, { type: 'move', from: 'e1', to: 'c1' });
});

test('the prohibition and reaction allowance do not leak to following turns', () => {
  let state = cancel(opening().moved);
  state = act(state, { type: 'move', from: 'g1', to: 'f3' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.cardPlays.black, 0);
  state = act(state, { type: 'move', from: 'a7', to: 'a6' });
  state = act(state, { type: 'endTurn' });
  act(state, { type: 'move', from: 'e2', to: 'e4' });
});

test('fizzles when forbidding the only check escape would directly create mate', () => {
  const before = createGameState({ fen: 'r7/8/8/8/8/2k5/7P/K7 w - - 0 1', hands: { black: ['think-again'] }, decks: { black: ['panic'] } });
  assert.equal(isKingInCheck(before, 'white'), true);
  const moved = act(before, { type: 'move', from: 'a1', to: 'b1' });
  const fizzled = act(moved, { type: 'playCard', cardId: 'think-again' });
  assert.equal(fizzled.history.at(-1)?.type, 'cardFizzled');
  assert.equal(fizzled.history.at(-1)?.cardId, 'think-again');
  assert.equal(fizzled.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.deepEqual(fizzled.pieces, moved.pieces);
  assert.equal(fizzled.fen, moved.fen);
  assert.deepEqual(fizzled.players.black.discard, before.players.black.hand);
  assert.deepEqual(fizzled.players.black.hand, before.players.black.deck);
});
