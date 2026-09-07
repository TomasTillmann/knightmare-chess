import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

function step(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? 'Expected accepted action' : result.error.message);
  return result.state;
}
const initial = () => createGameState({ hands: { black: ['chaos'] }, decks: { black: ['chaos'] } });
const moved = () => step(initial(), { type: 'move', from: 'e2', to: 'e4' });
function cancel(state: GameState, target?: unknown): GameState {
  const next = step(state, { type: 'playCard', cardId: 'chaos', ...(target === undefined ? {} : { target }) });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'chaos');
  return next;
}

test('Chaos restores the actual pre-move board', () => {
  assert.equal(boardFen(cancel(moved())), boardFen(initial()));
});
test('Chaos restores the moving player opportunity', () => {
  const state = cancel(moved());
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});
test('Chaos is discarded and replaced exactly once', () => {
  const state = cancel(moved());
  assert.equal(state.players.black.discard.length, 1);
  assert.equal(state.players.black.hand.length, 1);
  assert.equal(state.players.black.deck.length, 0);
  assert.equal(state.turn.cardPlays.black, 1);
});
test('Chaos erases double-step en-passant state', () => {
  assert.deepEqual(cancel(moved()).enPassant, initial().enPassant);
});
test('Chaos rejects repeating the canceled movement atomically', () => {
  const state = cancel(moved());
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});
test('Chaos permits another move by the same piece', () => {
  const state = step(cancel(moved()), { type: 'move', from: 'e2', to: 'e3' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e3');
});
test('Chaos permits another piece to move', () => {
  const state = step(cancel(moved()), { type: 'move', from: 'd2', to: 'd4' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-d2')?.square, 'd4');
});
for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
  test(`Chaos accepts its strict optional target ${JSON.stringify(target)}`, () => {
    assert.equal(cancel(moved(), target).turn.moveMade, false);
  });
}
test('Chaos rejects a fabricated after-move position', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { black: ['chaos'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Chaos has the documented metadata', () => {
  const card = CARD_CATALOG.chaos;
  assert.ok(card);
  assert.equal(card.points, 10);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['afterOpponentMove']);
  assert.ok(card.image.endsWith('/KC19_card1.png'));
});

test('Chaos rejects every malformed target without spending or changing state', () => {
  for (const target of [null, true, false, [], 'e4', {}, { returnCard: 1 }, { returnCard: 'true' }, { returnCard: true, extra: 1 }]) {
    const state = moved();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'chaos', target });
    assert.equal(result.ok, false, JSON.stringify(target));
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('Chaos cannot respond before a move, to its own move, or after endTurn', () => {
  const own = step(createGameState({ hands: { white: ['chaos'] } }), { type: 'move', from: 'e2', to: 'e4' });
  for (const state of [initial(), own, step(moved(), { type: 'endTurn' })]) {
    const result = applyAction(state, { type: 'playCard', cardId: 'chaos' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test('Chaos filters the canceled ordinary move from legal destinations', () => {
  const dests = legalDests(cancel(moved()));
  assert.equal(dests.get('e2')?.includes('e4'), false);
  assert.equal(dests.get('e2')?.includes('e3'), true);
});

const restorations: Array<[string, string, GameAction]> = [
  ['capture', '4k3/8/8/3p4/4P3/8/8/4K3 w - - 12 18', { type: 'move', from: 'e4', to: 'd5' }],
  ['en-passant capture', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 8 20', { type: 'move', from: 'e5', to: 'd6' }],
  ['promotion', '4k3/P7/8/8/8/8/8/4K3 w - - 4 9', { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' }],
  ['castling', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 5 8', { type: 'move', from: 'e1', to: 'g1' }],
];
for (const [name, fen, action] of restorations) {
  test(`Chaos restores all physical state and FEN fields after ${name}`, () => {
    const before = createGameState({ fen, hands: { black: ['chaos'] } });
    const state = cancel(step(before, action));
    assert.deepEqual(state.pieces, before.pieces);
    assert.equal(state.fen, before.fen);
    assert.deepEqual(state.enPassant, before.enPassant);
    assert.deepEqual(state.shieldMove, before.shieldMove);
  });
}

test('Chaos repeat prohibition treats castling aliases as the same movement', () => {
  const state = cancel(step(createGameState({ fen: restorations[3]![1], hands: { black: ['chaos'] } }), restorations[3]![2]));
  for (const to of ['g1', 'h1']) {
    const result = applyAction(state, { type: 'move', from: 'e1', to });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
    assert.equal(legalDests(state).get('e1')?.includes(to as 'g1' | 'h1'), false);
  }
});

test('Chaos repeat prohibition cannot be bypassed by changing promotion', () => {
  const state = cancel(step(createGameState({ fen: restorations[2]![1], hands: { black: ['chaos'] } }), restorations[2]![2]));
  for (const promotion of ['queen', 'rook', 'bishop', 'knight', undefined]) {
    const result = applyAction(state, { type: 'move', from: 'a7', to: 'a8', promotion });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test('Chaos repeat prohibition expires and reaction does not spend the following turn allowance', () => {
  let state = step(cancel(moved()), { type: 'move', from: 'd2', to: 'd4' });
  state = step(state, { type: 'endTurn' });
  assert.equal(state.turn.cardPlays.black, 0);
  state = step(state, { type: 'move', from: 'e7', to: 'e5' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e4');
});

test('Chaos works symmetrically after a black move and restores clocks', () => {
  const before = createGameState({ fen: '4k3/7p/8/8/8/8/P7/4K3 b - - 9 14', hands: { white: ['chaos'] } });
  const state = cancel(step(before, { type: 'move', from: 'h7', to: 'h5' }));
  assert.equal(state.turn.color, 'black');
  assert.equal(state.fen, before.fen);
  assert.equal(state.turn.cardPlays.white, 1);
});

test('Chaos fizzles when restoration and the repeat ban would directly create mate', () => {
  const before = createGameState({ fen: '7r/8/8/8/8/6k1/8/7K w - - 7 3', hands: { black: ['chaos'] }, decks: { black: ['chaos'] } });
  assert.deepEqual([...legalDests(before)], [['h1', ['g1']]]);
  const movedState = step(before, { type: 'move', from: 'h1', to: 'g1' });
  const state = step(movedState, { type: 'playCard', cardId: 'chaos' });
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.equal(state.fen, movedState.fen);
  assert.deepEqual(state.pieces, movedState.pieces);
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.black.discard.length, 1);
  assert.equal(state.players.black.hand.length, 1);
  assert.equal(state.players.black.deck.length, 0);
});
