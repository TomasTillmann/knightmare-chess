import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function cancel(state: GameState): GameState {
  const result = act(state, { type: 'playCard', cardId: 'knightmare' });
  assert.equal(result.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.history.at(-1)?.cardId, 'knightmare');
  return result;
}

for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
  test(`Knightmare cancels an ordinary move with target ${JSON.stringify(target)}`, () => {
    const initial = createGameState({ hands: { black: ['knightmare'] } });
    const moved = applyAction(initial, { type: 'move', from: 'e2', to: 'e4' });
    assert.equal(moved.ok, true);
    const result = applyAction(moved.state, { type: 'playCard', cardId: 'knightmare', target });
    assert.equal(result.ok, true);
    assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e2');
    assert.equal(result.state.turn.color, 'white');
    assert.equal(result.state.turn.moveMade, false);
    assert.equal(result.state.players.black.discard.at(-1)?.cardId, 'knightmare');
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, 'knightmare');
  });
}

for (const target of [null, [], true, {}, { returnCard: 'true' }, { returnCard: true, unknown: true }]) {
  test(`Knightmare rejects malformed payload ${JSON.stringify(target)}`, () => {
    const initial = createGameState({ hands: { black: ['knightmare'] } });
    const moved = applyAction(initial, { type: 'move', from: 'e2', to: 'e4' });
    assert.equal(moved.ok, true);
    const result = applyAction(moved.state, { type: 'playCard', cardId: 'knightmare', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, moved.state);
  });
}

test('Knightmare has its own ten-point regular reaction definition', () => {
  const card = CARD_CATALOG.knightmare;
  assert.equal(card.id, 'knightmare');
  assert.equal(card.name, 'Knightmare!');
  assert.equal(card.points, 10);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['afterOpponentMove']);
  assert.equal(card.image, '/KC20_card1.png');
});

test('White reacts to a Black move and leaves Black active', () => {
  const initial = createGameState({ turn: 'black', hands: { white: ['knightmare'] } });
  const moved = act(initial, { type: 'move', from: 'd7', to: 'd5' });
  const restored = cancel(moved);
  assert.equal(restored.fen, initial.fen);
  assert.deepEqual(restored.pieces, initial.pieces);
  assert.equal(restored.turn.color, 'black');
  assert.equal(restored.turn.moveMade, false);
  assert.equal(restored.players.white.discard[0]?.cardId, 'knightmare');
});

const restorations: Array<{ name: string; fen: string; move: GameAction }> = [
  { name: 'capture and captured-piece identity', fen: '4k3/n7/8/8/8/8/8/R3K3 w - - 11 19', move: { type: 'move', from: 'a1', to: 'a7' } },
  { name: 'en passant victim and opportunity', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 12', move: { type: 'move', from: 'e5', to: 'd6' } },
  { name: 'promotion role and marker', fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 7', move: { type: 'move', from: 'a7', to: 'a8', promotion: 'knight' } },
  { name: 'castling positions and rights', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 9 23', move: { type: 'move', from: 'e1', to: 'g1' } },
  { name: 'quiet-move clocks', fen: '4k3/8/8/8/8/8/8/4K1N1 w - - 33 29', move: { type: 'move', from: 'g1', to: 'f3' } },
  { name: 'double-step en passant creation', fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 17 4', move: { type: 'move', from: 'e2', to: 'e4' } },
];
for (const { name, fen, move } of restorations) {
  test(`Knightmare restores ${name}`, () => {
    const initial = createGameState({ fen, hands: { black: ['knightmare'] } });
    const restored = cancel(act(initial, move));
    assert.equal(restored.fen, initial.fen);
    assert.deepEqual(restored.pieces, initial.pieces);
    assert.deepEqual(restored.enPassant, initial.enPassant);
  });
}

test('Knightmare spends the selected physical card and draws exactly once', () => {
  const initial = createGameState({ hands: { black: ['chaos', 'knightmare', 'knightmare'] }, decks: { black: ['fireball', 'chaos'] } });
  const chosen = initial.players.black.hand[2]!;
  const moved = act(initial, { type: 'move', from: 'e2', to: 'e4' });
  const result = act(moved, { type: 'playCard', cardId: 'knightmare', cardInstanceId: chosen.id });
  assert.equal(result.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.history.at(-1)?.cardId, 'knightmare');
  assert.deepEqual(result.players.black.discard, [chosen]);
  assert.deepEqual(result.players.black.hand.map(card => card.id), [initial.players.black.hand[0]!.id, initial.players.black.hand[1]!.id, initial.players.black.deck[0]!.id]);
  assert.equal(result.players.black.deck.length, 1);
  assert.equal(result.turn.cardPlays.black, 1);
});

for (const timing of ['before a move', 'fabricated after-move state', 'after endTurn']) {
  test(`Knightmare rejects ${timing}`, () => {
    let state = createGameState({ hands: { black: ['knightmare'] }, ...(timing === 'fabricated after-move state' ? { phase: 'afterMove' as const, moveMade: true } : {}) });
    if (timing === 'after endTurn') {
      state = act(act(state, { type: 'move', from: 'e2', to: 'e4' }), { type: 'endTurn' });
    }
    const result = applyAction(state, { type: 'playCard', cardId: 'knightmare' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
    assert.deepEqual(cardPlayTargets(state, 'knightmare'), []);
  });
}

test('The canceled movement is absent from legal destinations and an attempted repeat is atomic', () => {
  const initial = createGameState({ hands: { black: ['knightmare'] } });
  const restored = cancel(act(initial, { type: 'move', from: 'e2', to: 'e4' }));
  assert.equal(legalDests(restored).get('e2')?.includes('e4'), false);
  assert.equal(legalDests(restored).get('e2')?.includes('e3'), true);
  const repeated = applyAction(restored, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(repeated.ok, false);
  assert.deepEqual(repeated.state, restored);
  assert.equal(act(restored, { type: 'move', from: 'e2', to: 'e3' }).turn.moveMade, true);
});

test('A different physical piece may make the replacement move', () => {
  const initial = createGameState({ hands: { black: ['knightmare'] } });
  const restored = cancel(act(initial, { type: 'move', from: 'e2', to: 'e4' }));
  const replaced = act(restored, { type: 'move', from: 'g1', to: 'f3' });
  assert.equal(replaced.pieces.find(piece => piece.id === 'white-knight-g1')?.square, 'f3');
  assert.equal(replaced.turn.moveMade, true);
});

test('Cancellation fizzles when the replacement prohibition would directly create checkmate', () => {
  const initial = createGameState({ fen: '8/8/8/8/8/1k6/r7/K7 w - - 0 1', hands: { black: ['knightmare'] }, decks: { black: ['fireball'] } });
  assert.deepEqual([...legalDests(initial).values()].flat(), ['b1']);
  const moved = act(initial, { type: 'move', from: 'a1', to: 'b1' });
  const result = act(moved, { type: 'playCard', cardId: 'knightmare' });
  assert.equal(result.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.history.at(-1)?.cardId, 'knightmare');
  assert.equal(result.fen, moved.fen);
  assert.deepEqual(result.pieces, moved.pieces);
  assert.equal(result.players.black.discard[0]?.cardId, 'knightmare');
  assert.equal(result.players.black.hand[0]?.cardId, 'fireball');
});
