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

const blockedExtraMoveBogs = [
  ['white castling king', '4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1', 'f1', 'a1'],
  ['black castling king', '4k2r/8/8/8/8/8/8/4K3 b k - 0 1', 'e8', 'g8', 'f8', 'a8'],
  ['white pawn', '7k/8/8/8/8/8/1P6/R6K w - - 0 1', 'a1', 'a3', 'a3', 'c3'],
  ['black pawn', 'r6k/1p6/8/8/8/8/8/7K b - - 0 1', 'a8', 'a6', 'a6', 'c6'],
  ['white rook', '7k/8/8/8/8/8/1R6/R6K w - - 0 1', 'a1', 'a3', 'a3', 'c3'],
] as const;

for (const [name, fen, from, to, extraFrom, extraTo] of blockedExtraMoveBogs) {
  function blockedBog() {
    const owner: Color = fen.includes(' b ') ? 'black' : 'white';
    const reactor = other(owner);
    const before = game({ fen, hands: { [owner]: ['merciless'], [reactor]: [BOG] } });
    assert.equal(isKingInCheck(before, owner), false, 'initial fixture is legal');
    assert.equal(isKingInCheck(before, reactor), false, 'initial opponent is not in check');
    const actor = at(before, from)!;
    const first = move(before, from, to);
    assert.equal(at(first, to)?.id, actor.id, 'first move fixture is valid');
    const extraActor = at(first, extraFrom)!;
    const moved = applied(first, {
      type: 'playCard', cardId: 'merciless', target: [{ from: extraFrom, to: extraTo }],
    });
    assert.equal(at(moved, extraTo)?.id, extraActor.id, 'extra move fixture is valid');
    const input = structuredClone(moved);
    const result = applyAction(moved, {
      type: 'playCard', cardId: BOG, cardInstanceId: moved.players[reactor].hand[0]!.id,
    } as Action);
    return { input, moved, resolved: result.ok ? result.state : moved };
  }

  test(`Bog after Merciless cannot overlap ${name}: board identities stay unchanged`, () => {
    const { input, resolved } = blockedBog();
    assert.deepEqual(resolved.pieces, input.pieces);
    assert.equal(resolved.fen.split(' ')[0], input.fen.split(' ')[0]);
  });

  test(`Bog after Merciless cannot overlap ${name}: occupied squares remain unique and royals survive`, () => {
    const { input, resolved } = blockedBog();
    const board = resolved.pieces.filter(piece => piece.zone === 'board');
    assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
    assert.deepEqual(board.filter(piece => piece.role === 'king'),
      input.pieces.filter(piece => piece.zone === 'board' && piece.role === 'king'));
    assert.equal((resolved.fen.split(' ')[0].match(/[kK]/g) ?? []).length, 2);
  });

  test(`Bog after Merciless cannot overlap ${name}: attempted reaction leaves its input immutable`, () => {
    const { input, moved } = blockedBog();
    assert.deepEqual(moved, input);
  });
}

// Official FAQ p. 13: an extra move is part of the total turn displacement.
const extraMoveBogs = [
  ['Merciless north', '7k/8/8/8/8/8/8/R6K w - - 7 1', 'merciless', 'a1', 'a3', 'a6', 'a2'],
  ['Merciless capture', '7k/8/n7/8/8/8/8/R6K w - - 7 1', 'merciless', 'a1', 'a3', 'a6', 'a2'],
  ['Crusade northeast', '7k/8/8/8/8/8/8/2B4K w - - 7 1', 'crusade', 'c1', 'e3', 'g5', 'd2'],
  ['Crusade capture', '7k/8/8/6n1/8/8/8/2B4K w - - 7 1', 'crusade', 'c1', 'e3', 'g5', 'd2'],
  ['Merciless castling rook', '4k3/8/8/8/8/8/8/R3K3 w Q - 7 1', 'merciless', 'a1', 'd1', 'h1', 'b1'],
] as const;

for (const [name, fen, extra, origin, middle, destination, stopped] of extraMoveBogs) {
  function resolvedExtraMove() {
    const before = game({ fen, hands: { white: [extra], black: [BOG] } });
    const actor = at(before, origin)!;
    const victim = at(before, destination);
    const first = origin === 'a1' && middle === 'd1'
      ? move(before, 'e1', 'c1') : move(before, origin, middle);
    assert.equal(at(first, middle)?.id, actor.id, 'first move fixture is valid');
    const doubled = applied(first, {
      type: 'playCard', cardId: extra, target: [{ from: middle, to: destination }],
    });
    assert.equal(at(doubled, destination)?.id, actor.id, 'extra move fixture is valid');
    if (victim) assert.equal(doubled.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
    return { before, actor, victim, doubled, resolved: bog(doubled) };
  }

  test(`Bog after ${name}: stops one square from the turn origin`, () => {
    const { actor, resolved } = resolvedExtraMove();
    assert.equal(at(resolved, stopped)?.id, actor.id);
    assert.equal(at(resolved, middle), undefined);
    if (middle === 'd1') assert.equal(at(resolved, 'c1')?.role, 'king');
  });

  test(`Bog after ${name}: preserves physical victims and clocks`, () => {
    const { before, victim, resolved } = resolvedExtraMove();
    if (victim) assert.deepEqual(resolved.pieces.find(piece => piece.id === victim.id), victim);
    else assert.equal(at(resolved, destination), undefined);
    assert.equal(resolved.pieces.filter(piece => piece.zone === 'board').length,
      before.pieces.filter(piece => piece.zone === 'board').length);
    assert.equal(resolved.fen.split(' ')[4], '8');
    assert.equal(resolved.fen.split(' ')[5], '1');
  });

  test(`Bog after ${name}: spends both cards once and grants no third move`, () => {
    const { resolved } = resolvedExtraMove();
    assert.equal(resolved.players.white.hand.some(item => item.cardId === extra), false);
    assert.equal(resolved.players.white.discard.filter(item => item.cardId === extra).length, 1);
    assert.equal(resolved.players.black.discard.filter(item => item.cardId === BOG).length, 1);
    assert.deepEqual(resolved.turn, {
      color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 1 },
    });
    assert.equal(applyAction(resolved, { type: 'move', from: stopped, to: middle } as Action).ok, false);
  });
}

const compositeCaptures = [
  ['white rook east', '7k/8/8/8/8/3r4/7K/R2n4 b - - 0 1', 'd3', 'd1', 'a1', 'b1', 'f2', 'd4'],
  ['white bishop northeast', '7k/8/4r3/8/4n3/8/2B5/7K b - - 0 1', 'e6', 'e4', 'c2', 'd3', 'g5', 'e6'],
  ['black queen north', '7K/8/8/3N1R2/8/8/3q3k/8 w - - 0 1', 'f5', 'd5', 'd2', 'd3', 'f6', 'a5'],
] as const;

for (const [name, fen, mergeFrom, destination, from, stopped, knightTo, rookTo] of compositeCaptures) {
  function restoredComposite() {
    const owner: Color = fen.includes(' b ') ? 'black' : 'white';
    let before = game({ fen, hands: { [owner]: ['confabulation', BOG] } });
    const victimIds = [at(before, mergeFrom)!.id, at(before, destination)!.id];
    before = applied(before, {
      type: 'playCard', cardId: 'confabulation', target: [{ from: mergeFrom, to: destination }],
    });
    before = applied(before, { type: 'endTurn' });
    const victims = before.pieces.filter(piece => victimIds.includes(piece.id));
    assert.equal(victims.length, 2, 'public Confabulation must merge both components');
    assert.equal(before.effects.length, 1, 'Confabulation must be active before the capture');
    assert.equal(at(before, mergeFrom), undefined);
    const moved = move(before, from, destination);
    assert.equal(moved.pieces.filter(piece => victims.some(victim => victim.id === piece.id) && piece.zone === 'captured').length, 2);
    const resolved = bog(moved);
    return { before, victims, resolved, owner };
  }

  test(`Bog composite capture: ${name} restores every physical component and capture metadata`, () => {
    const { before, victims, resolved } = restoredComposite();
    for (const victim of victims) assert.deepEqual(resolved.pieces.find(piece => piece.id === victim.id), victim);
    assert.equal(at(resolved, stopped)?.id, at(before, from)?.id);
    assert.equal(at(resolved, from), undefined);
    assert.equal(resolved.pieces.filter(piece => piece.zone === 'board').length, before.pieces.filter(piece => piece.zone === 'board').length);
  });

  test(`Bog composite capture: ${name} restores the live merger and its retained card`, () => {
    const { before, resolved, owner } = restoredComposite();
    assert.deepEqual(resolved.effects, before.effects);
    assert.deepEqual(resolved.players[owner].discard.filter(item => item.cardId === 'confabulation'), []);
    assert.equal(resolved.players[owner].discard.filter(item => item.cardId === BOG).length, 1);
  });

  for (const [mode, to] of [['knight', knightTo], ['rook', rookTo]] as const) {
    test(`Bog composite capture: ${name} retains ${mode} movement for both components`, () => {
      const { resolved, victims } = restoredComposite();
      const next = move(applied(resolved, { type: 'endTurn' }), destination, to);
      assert.equal(at(next, destination), undefined);
      for (const victim of victims) {
        const component = next.pieces.find(piece => piece.id === victim.id)!;
        assert.equal(component.zone, victim.zone);
        assert.equal(component.square, victim.zone === 'board' ? to : victim.square);
      }
      assert.equal(next.effects.some(effect => (effect as { type?: string }).type === 'confabulation'), true);
    });
  }

  test(`Bog composite capture: ${name} preserves the restored object under a second capture`, () => {
    const { resolved, victims } = restoredComposite();
    let next = applied(resolved, { type: 'endTurn' });
    const king = next.pieces.find(piece => piece.owner === next.turn.color && piece.role === 'king')!;
    next = move(next, king.square!, king.square === 'h8' ? 'g8' : 'g2');
    next = applied(next, { type: 'endTurn' });
    next = move(next, stopped, destination);
    const capture = next.history.at(-1)!;
    assert.deepEqual([...(capture.capturedIds ?? [capture.capturedId])].sort(), victims.map(piece => piece.id).sort());
    for (const victim of victims) assert.equal(next.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
    assert.equal(next.effects.some(effect => (effect as { type?: string }).type === 'confabulation'), false);
  });
}

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
  ['rook', '7k/8/8/8/8/8/7K/R2r4 w - - 7 1', 'a1', 'd1', 'b1'],
  ['bishop', '7k/8/8/8/4p3/8/2B5/7K w - - 7 1', 'c2', 'e4', 'd3'],
  ['black queen', '7K/8/8/3Q4/8/8/3q3k/8 b - - 7 1', 'd2', 'd5', 'd3'],
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
  const event = result.state.history.at(-1)!;
  assert.equal(event.type, 'cardFizzled');
  assert.equal(event.cardId, BOG);
  assert.equal(event.reason, 'SELF_CHECK');
});

test('Bog fizzles when truncation would checkmate the reactor', () => {
  const before = withBog(game({ fen: '8/8/8/5B2/5K2/4BB2/7k/R7 w - - 0 1' }));
  const moved = move(before, 'a1', 'a4');
  assert.equal(isKingInCheck(moved, 'black'), false);
  const reactor = other(moved.turn.color);
  const input = structuredClone(moved);
  const instance = moved.players[reactor].hand[0]!;
  const result = applyAction(moved, { type: 'playCard', cardId: BOG, cardInstanceId: instance.id } as Action);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.fen, moved.fen);
  assert.equal(at(result.state, 'a4')?.id, at(moved, 'a4')?.id);
  assert.deepEqual(moved, input);
  assert.equal(result.state.players[reactor].hand.some(item => item.id === instance.id), false);
  assert.equal(result.state.players[reactor].discard.some(item => item.id === instance.id), true);
  const event = result.state.history.at(-1)!;
  assert.equal(event.type, 'cardFizzled');
  assert.equal(event.cardId, BOG);
  assert.equal(event.reason, 'DIRECT_MATE');
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
  const seeded = withBog(game({ fen: '7k/8/8/8/8/8/7K/R2r4 w - - 0 1' }));
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
