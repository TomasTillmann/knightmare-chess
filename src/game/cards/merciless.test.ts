import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import type { Color, GameAction, GameState } from '../types.js';

const WHITE = '7k/8/8/8/8/8/8/R6K w - - 7 3';
const BLACK = 'r6k/8/8/8/8/8/8/7K b - - 7 3';
function game(fen = WHITE, color: Color = 'white') {
  return createGameState({ fen, hands: { [color]: ['merciless'] } });
}
function act(state: GameState, action: GameAction) {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}
function move(state: GameState, from: string, to: string, promotion?: string) {
  return act(state, { type: 'move', from, to, promotion });
}
function play(state: GameState, from: string, to: string, cardInstanceId?: string) {
  const next = act(state, { type: 'playCard', cardId: 'merciless', cardInstanceId, target: [{ from, to }] });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'merciless');
  return next;
}
function reject(state: GameState, target: unknown) {
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'merciless', target });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}
function piece(state: GameState, square: string) {
  return state.pieces.find((candidate) => candidate.zone === 'board' && candidate.square === square);
}

test('Merciless catalog matches the printed card', () => {
  const card = CARD_CATALOG.merciless;
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC18_card2.png');
  assert.deepEqual(card.timing, ['afterMove']);
});

for (const [color, fen, from, via, to, clocks] of [
  ['white', WHITE, 'a1', 'a3', 'c3', ['8', '3']],
  ['black', BLACK, 'a8', 'a6', 'c6', ['8', '4']],
] as const) {
  test(`Merciless moves the same ${color} Rook without a second clock increment`, () => {
    const start = game(fen, color);
    const id = piece(start, from)?.id;
    const first = move(start, from, via);
    const next = play(first, via, to);
    assert.equal(piece(next, to)?.id, id);
    assert.equal(piece(next, via), undefined);
    assert.deepEqual(next.fen.split(' ').slice(4), clocks);
    assert.equal(next.turn.color, color);
    assert.equal(next.turn.phase, 'afterMove');
    assert.equal(next.turn.moveMade, true);
    assert.equal(next.players[color].discard.filter((card) => card.cardId === 'merciless').length, 1);
  });
}

for (const [color, fen, kingFrom, kingTo, rookFrom, via, to] of [
  ['white', '4k3/8/8/8/8/8/8/R3K2R w KQ - 7 3', 'e1', 'g1', 'h1', 'f1', 'f3'],
  ['white', '4k3/8/8/8/8/8/8/R3K2R w KQ - 7 3', 'e1', 'c1', 'a1', 'd1', 'd3'],
  ['black', 'r3k2r/8/8/8/8/8/8/4K3 b kq - 7 3', 'e8', 'g8', 'h8', 'f8', 'f6'],
  ['black', 'r3k2r/8/8/8/8/8/8/4K3 b kq - 7 3', 'e8', 'c8', 'a8', 'd8', 'd6'],
] as const) {
  test(`Merciless follows the relocated Rook after ${color} castling to ${kingTo}`, () => {
    const start = game(fen, color);
    const rookId = piece(start, rookFrom)?.id;
    const first = move(start, kingFrom, kingTo);
    assert.equal(piece(first, via)?.id, rookId);
    const next = play(first, via, to);
    assert.equal(piece(next, to)?.id, rookId);
    assert.equal(piece(next, kingTo)?.role, 'king');
    assert.equal(next.fen.split(' ')[2], '-');
    assert.deepEqual(next.fen.split(' ').slice(4), first.fen.split(' ').slice(4));
  });
}

test('Merciless rejects malformed, multiple, extra-field, and stale-square targets atomically', () => {
  const state = move(game(), 'a1', 'a3');
  for (const target of [undefined, null, [], { from: 'a3', to: 'c3' }, [{ from: 'a3' }],
    [{ from: 'a3', to: 'c3', extra: true }], [{ from: 'a3', to: 'c3' }, { from: 'c3', to: 'd3' }],
    [{ from: 'a1', to: 'c1' }], [{ from: 'a3', to: 'a3' }], [{ from: 'a3', to: 'z9' }]]) {
    reject(state, target);
  }
});

test('Merciless requires a completed Regular Move', () => {
  reject(game(), [{ from: 'a1', to: 'a3' }]);
});

test('Merciless cannot follow a capturing Regular Move', () => {
  const first = move(game('7k/8/8/8/8/n7/8/R6K w - - 7 3'), 'a1', 'a3');
  reject(first, [{ from: 'a3', to: 'c3' }]);
});

test('Merciless cannot follow a different piece moving', () => {
  const first = move(game('7k/8/8/8/8/8/1N6/R6K w - - 7 3'), 'b2', 'c4');
  reject(first, [{ from: 'a1', to: 'a3' }]);
});

test('Merciless cannot select the second Rook after an ordinary move or castling', () => {
  const regular = move(game('7k/8/8/8/8/8/8/RR5K w - - 7 3'), 'a1', 'a3');
  reject(regular, [{ from: 'b1', to: 'b3' }]);
  const castle = move(game('4k3/8/8/8/8/8/8/R3K2R w KQ - 7 3'), 'e1', 'g1');
  reject(castle, [{ from: 'a1', to: 'a3' }]);
});

test('Merciless additional move may capture and resets the halfmove clock', () => {
  const start = game('7k/8/8/8/8/2n5/8/R6K w - - 7 3');
  const victimId = piece(start, 'c3')?.id;
  const next = play(move(start, 'a1', 'a3'), 'a3', 'c3');
  assert.equal(piece(next, 'c3')?.role, 'rook');
  assert.equal(next.pieces.find((candidate) => candidate.id === victimId)?.zone, 'captured');
  assert.deepEqual(next.fen.split(' ').slice(4), ['0', '3']);
});

test('Merciless rejects blocked paths, occupied friendly destinations, and non-Rook geometry', () => {
  const first = move(game('7k/8/8/8/8/1N6/8/R6K w - - 7 3'), 'a1', 'a3');
  for (const to of ['c3', 'b3', 'b4']) reject(first, [{ from: 'a3', to }]);
});

test('Merciless accepts an already-promoted Rook and preserves its identity metadata', () => {
  const start = game();
  const rook = piece(start, 'a1')!;
  rook.originalRole = 'pawn';
  rook.promoted = true;
  const next = play(move(start, 'a1', 'a3'), 'a3', 'c3');
  assert.deepEqual(piece(next, 'c3'), { ...rook, square: 'c3' });
});

test('Merciless accepts an unpromoted original Rook using its current movement', () => {
  const start = game('8/7k/8/8/8/8/8/B6K w - - 7 3');
  piece(start, 'a1')!.originalRole = 'rook';
  const next = play(move(start, 'a1', 'c3'), 'c3', 'd4');
  assert.equal(piece(next, 'd4')?.role, 'bishop');
  assert.equal(piece(next, 'd4')?.originalRole, 'rook');
});

test('Merciless rejects a Pawn promoted to Rook on the triggering move', () => {
  const first = move(game('8/P6k/8/8/8/8/8/7K w - - 7 3'), 'a7', 'a8', 'rook');
  reject(first, [{ from: 'a8', to: 'c8' }]);
});

test('Merciless spends the selected physical copy and draws exactly one replacement', () => {
  const start = createGameState({ fen: WHITE, hands: { white: ['merciless', 'merciless'] }, decks: { white: ['crab', 'crab'] } });
  const [kept, spent] = start.players.white.hand;
  const next = play(move(start, 'a1', 'a3'), 'a3', 'c3', spent!.id);
  assert.equal(next.players.white.hand.length, 2);
  assert.ok(next.players.white.hand.some((card) => card.id === kept!.id));
  assert.ok(!next.players.white.hand.some((card) => card.id === spent!.id));
  assert.deepEqual(next.players.white.discard.map((card) => card.id), [spent!.id]);
  assert.equal(next.players.white.deck.length, 1);
});

test('Merciless cannot spend an invalid physical copy', () => {
  const first = move(game(), 'a1', 'a3');
  const result = applyAction(first, { type: 'playCard', cardId: 'merciless', cardInstanceId: 'absent', target: [{ from: 'a3', to: 'c3' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, first);
});

test('Merciless grants neither a third ordinary move nor a second card allowance', () => {
  const start = createGameState({ fen: WHITE, hands: { white: ['merciless', 'merciless'] } });
  const next = play(move(start, 'a1', 'a3'), 'a3', 'c3');
  assert.equal(applyAction(next, { type: 'move', from: 'c3', to: 'd3' }).ok, false);
  reject(next, [{ from: 'c3', to: 'd3' }]);
});

test('Merciless self-check fizzles, retaining the first move and spending the card', () => {
  const first = move(game('k6r/8/8/8/8/8/7R/7K w - - 7 3'), 'h2', 'h3');
  const next = act(first, { type: 'playCard', cardId: 'merciless', target: [{ from: 'h3', to: 'g3' }] });
  assert.equal(next.history.at(-1)?.type, 'cardFizzled');
  assert.equal(next.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(next.fen, first.fen);
  assert.deepEqual(next.pieces, first.pieces);
  assert.equal(next.players.white.discard.filter((card) => card.cardId === 'merciless').length, 1);
  assert.equal(next.turn.moveMade, true);
});

test('Merciless cannot use a Rook move from an older turn', () => {
  let state = move(game(), 'a1', 'a3');
  state = act(state, { type: 'endTurn' });
  state = move(state, 'h8', 'g8');
  state = act(state, { type: 'endTurn' });
  reject(state, [{ from: 'a3', to: 'c3' }]);
});

test('Merciless direct mate fizzles, retaining the first move and spending the card', () => {
  const start = game('7k/5K2/8/8/8/8/8/R7 w - - 7 3');
  assert.equal(isKingInCheck(start, 'white'), false);
  assert.equal(isKingInCheck(start, 'black'), false);
  const first = move(start, 'a1', 'a6');
  assert.equal(isKingInCheck(first, 'white'), false);
  assert.equal(isKingInCheck(first, 'black'), false);
  const next = act(first, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a6', to: 'h6' }] });
  assert.equal(next.history.at(-1)?.type, 'cardFizzled');
  assert.equal(next.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.equal(next.fen, first.fen);
  assert.deepEqual(next.pieces, first.pieces);
  assert.equal(next.players.white.discard.filter((card) => card.cardId === 'merciless').length, 1);
  assert.equal(next.turn.phase, 'afterMove');
  assert.equal(next.turn.moveMade, true);
});
