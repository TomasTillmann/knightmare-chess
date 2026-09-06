import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color } from '../types.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const BOG = 'bog';
const game = (options: Options = {}) => createGameState(options);
function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
function withBog(state: State): State {
  const reactor = other(state.turn.color);
  return game({
    fen: state.fen,
    hands: { [reactor]: [BOG] },
    turn: state.turn.color,
  });
}
function bog(state: State): State {
  const reactor = other(state.turn.color);
  const cardInstanceId = state.players[reactor].hand.find(card => card.cardId === BOG)?.id;
  return applied(state, { type: 'playCard', cardId: BOG, cardInstanceId } as Action);
}
const at = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
const card = (id: string, cardId: string) => ({ id, cardId });

const slides = [
  ['white rook north', '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', 'a6', 'a2'],
  ['white rook west', '7k/8/8/8/8/8/8/3R3K w - - 0 1', 'd1', 'a1', 'c1'],
  ['white bishop northeast', '7k/8/8/8/8/8/8/2B4K w - - 0 1', 'c1', 'g5', 'd2'],
  ['white bishop southwest', '7k/8/8/5B2/8/8/8/7K w - - 0 1', 'f5', 'b1', 'e4'],
  ['white queen diagonal', '7k/8/8/8/8/8/8/3Q3K w - - 0 1', 'd1', 'h5', 'e2'],
  ['black queen south', '7k/3q4/8/8/8/8/8/7K b - - 0 1', 'd7', 'd2', 'd6'],
] as const;

test('Bog truncates long sliding moves to their first square in either direction', async t => {
  for (const [name, fen, from, to, stopped] of slides) await t.test(name, () => {
    const state = bog(move(withBog(game({ fen })), from, to));
    assert.equal(at(state, from), undefined);
    assert.equal(at(state, stopped)?.id, `${at(game({ fen }), from)?.id}`);
    assert.equal(at(state, to), undefined);
  });
});

const captures = [
  ['rook', '7k/8/8/8/8/8/8/R2r3K w - - 7 1', 'a1', 'd1', 'b1'],
  ['bishop', '7k/8/8/8/4p3/8/2B5/7K w - - 7 1', 'c2', 'e4', 'd3'],
  ['black queen', '7K/8/8/3Q4/8/8/3q4/7k b - - 7 1', 'd2', 'd5', 'd3'],
] as const;

test('Bog restores captures at the planned destination for every sliding role', async t => {
  for (const [name, fen, from, to, stopped] of captures) await t.test(name, () => {
    const before = withBog(game({ fen }));
    const actor = at(before, from)!;
    const victim = at(before, to)!;
    const moved = move(before, from, to);
    assert.equal(moved.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');

    const state = bog(moved);
    assert.equal(at(state, stopped)?.id, actor.id);
    assert.equal(at(state, to)?.id, victim.id);
    assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'board');
    assert.equal(state.fen.split(' ')[4], '8');
  });
});

test('Bog recomputes check from the truncated board', () => {
  const moved = move(withBog(game({ fen: '7k/8/8/8/8/8/8/R6K w - - 0 1' })), 'a1', 'a8');
  assert.equal(isKingInCheck(moved, 'black'), true);
  const state = bog(moved);
  assert.equal(isKingInCheck(state, 'black'), false);
  assert.equal(isKingInCheck(state, 'white'), false);
});

test('Bog fizzles when truncation would leave only the mover in check', () => {
  const before = withBog(game({ fen: 'r6R/8/7k/8/8/8/8/K7 w - - 0 1' }));
  assert.equal(isKingInCheck(before, 'white'), true);
  const moved = move(before, 'h8', 'a8');
  assert.equal(isKingInCheck(moved, 'white'), false);
  assert.equal(isKingInCheck(moved, 'black'), false);
  const reactor = other(moved.turn.color);
  const input = structuredClone(moved);
  const result = applyAction(moved, {
    type: 'playCard', cardId: BOG, cardInstanceId: moved.players[reactor].hand[0]?.id,
  } as Action);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.fen, moved.fen);
  assert.equal(at(result.state, 'a8')?.id, at(moved, 'a8')?.id);
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-a8')?.zone, 'captured');
  assert.deepEqual(moved, input);
  const instance = moved.players[reactor].hand[0]!;
  assert.equal(result.state.players[reactor].hand.some(item => item.id === instance.id), false);
  assert.equal(result.state.players[reactor].discard.some(item => item.id === instance.id), true);
  assert.deepEqual(result.state.history.at(-1), {
    type: 'cardFizzled', cardId: BOG, reason: 'SELF_CHECK',
  });
});

test('Bog is discarded by the reacting opponent without consuming or changing the mover turn', () => {
  const moved = move(withBog(game({ fen: '7k/8/8/8/8/8/8/R6K w - - 0 1' })), 'a1', 'a4');
  const reactor = other(moved.turn.color);
  const instance = moved.players[reactor].hand[0]!;
  const state = bog(moved);
  assert.equal(state.players[reactor].hand.some(item => item.id === instance.id), false);
  assert.equal(state.players[reactor].discard.some(item => item.id === instance.id), true);
  assert.deepEqual(state.turn, {
    color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 1 },
  });
  assert.equal(state.history.at(-1)?.cardId, BOG);
});

test('Bog composes with an active Vendetta after the original capture satisfied it', () => {
  const seeded = withBog(game({ fen: '7k/8/8/8/8/8/8/R2r3K w - - 0 1' }));
  const state: State = {
    ...seeded,
    effects: [{ type: 'vendetta', owner: 'white', card: card('vendetta-1', 'vendetta') }],
  };
  const moved = move(state, 'a1', 'd1');
  const resolved = bog(moved);
  assert.equal(at(resolved, 'd1')?.owner, 'black');
  assert.equal(resolved.effects.some(effect => (effect as { type?: string }).type === 'vendetta'), true);
});

test('Bog preserves or expires reachable capture protections after a legal quiet move', async t => {
  const cases = [
    ['Pacifism', { type: 'pacifism', owner: 'white', card: card('pacifism-1', 'pacifism'), pieceId: 'white-rook-a1' }, true],
    ['Truce', { type: 'truce', owner: 'black', card: card('truce-1', 'truce') }, true],
  ] as const;
  for (const [name, effect, survives] of cases) await t.test(name, () => {
    const seeded = withBog(game({ fen: '7k/8/8/8/8/8/8/R6K w - - 0 1' }));
    const state: State = { ...seeded, effects: [effect] };
    const moved = move(state, 'a1', 'a4');
    assert.equal(at(moved, 'a4')?.id, 'white-rook-a1');
    const resolved = bog(moved);
    assert.equal(at(resolved, 'a2')?.id, 'white-rook-a1');
    assert.equal(resolved.effects.some(item => (item as { card?: { id?: string } }).card?.id === effect.card.id), survives);
  });
});

test('deterministic two-ply Bog sequences work for both mover colors', async t => {
  const cases = [
    ['white then black', '7k/3q4/8/8/8/8/8/R6K w - - 0 1', 'a1', 'a4', 'a2', 'd7', 'd4', 'd6'],
    ['black then white', '7k/8/8/8/8/8/3Q4/r6K b - - 0 1', 'a1', 'a4', 'a2', 'd2', 'd5', 'd3'],
  ] as const;
  for (const [name, fen, from1, to1, stopped1, from2, to2, stopped2] of cases) await t.test(name, () => {
    let state = bog(move(withBog(game({ fen })), from1, to1));
    assert.ok(at(state, stopped1));
    state = applied(state, { type: 'endTurn' });
    const reactor = other(state.turn.color);
    state.players[reactor].hand = [...state.players[reactor].hand, card(`${reactor}-bog-2`, BOG)];
    state = bog(move(state, from2, to2));
    assert.ok(at(state, stopped2));
  });
});
