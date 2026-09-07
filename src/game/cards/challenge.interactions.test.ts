import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { CardId, GameAction, GameState, SquareName } from '../types.js';

const FEN = '4k3/1p4p1/8/8/8/8/1P4P1/4K3 w - - 0 1';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions must not mutate their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function ready(black: CardId[] = [], fen = FEN): GameState {
  return createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['challenge'], black } });
}

function challenged(black: CardId[] = [], state = ready(black), target: SquareName = 'b7'): GameState {
  return act(act(state, { type: 'playCard', cardId: 'challenge', target }), { type: 'endTurn' });
}

function piece(state: GameState, square: SquareName) {
  const found = state.pieces.find(p => p.square === square && p.zone === 'board');
  assert.ok(found, `piece on ${square}`);
  return found;
}

test('Challenge follows the opponent through the turn boundary', () => {
  const state = challenged();
  assert.equal(state.turn.color, 'black');
  assert.deepEqual([...legalDests(state).keys()], ['b7']);
});

for (const cardId of ['dubbing', 'fanatic', 'annexation', 'forced-march']) {
  test(`Challenge is fulfilled by the named actor using ${cardId}`, () => {
    const baseline = createGameState({ fen: FEN, turn: 'black', hands: { black: [cardId] } });
    const baselineTarget = cardPlayTargets(baseline, cardId).find(value => JSON.stringify(value)?.includes('b7'));
    assert.notEqual(baselineTarget, undefined, 'replacement fixture has a legal move without Challenge');
    const baselineMoved = act(baseline, { type: 'playCard', cardId, target: baselineTarget });
    assert.notEqual(baselineMoved.pieces.find(p => p.id === piece(baseline, 'b7').id)!.square, 'b7');
    const state = challenged([cardId]);
    const id = piece(state, 'b7').id;
    const targets = cardPlayTargets(state, cardId);
    const target = targets.find(value => JSON.stringify(value)?.includes('b7'));
    assert.notEqual(target, undefined, 'named actor has a replacement move');
    const moved = act(state, { type: 'playCard', cardId, target });
    assert.notEqual(moved.pieces.find(p => p.id === id)!.square, 'b7');
    assert.equal(moved.turn.moveMade, true);
    assert.equal(act(moved, { type: 'endTurn' }).turn.color, 'white');
  });
}

test('Dubbing cannot move an unrelated actor under Challenge', () => {
  const state = challenged(['dubbing']);
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'g7', to: 'e6' }] });
  assert.deepEqual(state, before);
  assert.equal(piece(result.state, 'g7').id, piece(state, 'g7').id);
  assert.equal(result.state.pieces.some(p => p.square === 'e6'), false);
});

test('Pacifism on the named pawn does not fulfill Challenge', () => {
  const state = challenged(['pacifism']);
  const marked = act(state, { type: 'playCard', cardId: 'pacifism', target: 'b7' });
  assert.equal(marked.turn.moveMade, false);
  assert.equal(legalDests(marked).has('g7'), false);
  assert.equal(piece(marked, 'b7').id, piece(state, 'b7').id);
});

test('A challenged pawn may make its quiet move after receiving Pacifism', () => {
  const marked = act(challenged(['pacifism']), { type: 'playCard', cardId: 'pacifism', target: 'b7' });
  const moved = act(marked, { type: 'move', from: 'b7', to: 'b6' });
  assert.equal(piece(moved, 'b6').id, piece(marked, 'b7').id);
  assert.equal(moved.turn.moveMade, true);
});

test('Crab changes the challenged physical pawn movement without freeing other pieces', () => {
  const state = ready();
  state.effects.push({ type: 'crab', owner: 'black', card: { id: 'crab', cardId: 'crab' }, pieceId: piece(state, 'b7').id });
  const marked = challenged([], state);
  assert.equal(legalDests(marked).has('g7'), false);
  assert.ok(legalDests(marked).get('b7')?.includes('a6'));
  const moved = act(marked, { type: 'move', from: 'b7', to: 'a6' });
  assert.equal(piece(moved, 'a6').id, piece(marked, 'b7').id);
});

test('Forbidden City after selection immobilizes the pawn and preserves forfeiture', () => {
  const blocked = challenged();
  blocked.effects.push({ type: 'forbidden-city', owner: 'white', card: { id: 'later-city', cardId: 'forbidden-city' }, square: 'b6' });
  assert.equal(legalDests(blocked).size, 0);
  const ended = act(blocked, { type: 'endTurn' });
  assert.equal(ended.turn.color, 'white');
  assert.equal(boardFen(ended), boardFen(blocked));
  assert.equal(ended.outcome, null);
});

test('A pre-existing Forbidden City excludes an immobile target', () => {
  const state = ready();
  state.effects.push({ type: 'forbidden-city', owner: 'white', card: { id: 'city', cardId: 'forbidden-city' }, square: 'b6' });
  assert.equal(cardPlayTargets(state, 'challenge').includes('b7'), false);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'b7' }).ok, false);
});

test('A pre-existing Pacifism still permits challenging a quiet-moving pawn', () => {
  const state = ready();
  state.effects.push({ type: 'pacifism', owner: 'black', card: { id: 'peace', cardId: 'pacifism' }, pieceId: piece(state, 'b7').id });
  const next = challenged([], state);
  assert.ok(legalDests(next).get('b7')?.includes('b6'));
  assert.equal(legalDests(next).has('g7'), false);
});

test('Truce allows the challenged quiet move and keeps its capture prohibition', () => {
  const state = ready([], '4k3/1p4p1/2P5/8/8/8/6P1/4K3 w - - 0 1');
  state.effects.push({ type: 'truce', owner: 'white', card: { id: 'truce', cardId: 'truce' } });
  const next = challenged([], state);
  assert.ok(legalDests(next).get('b7')?.includes('b6'));
  assert.equal(legalDests(next).get('b7')?.includes('c6'), false);
  act(next, { type: 'move', from: 'b7', to: 'b6' });
});

test('Vendetta and Challenge both apply to the challenged legal capture', () => {
  const state = ready([], '4k3/1p4p1/2P5/8/8/8/6P1/4K3 w - - 0 1');
  state.effects.push({ type: 'vendetta', owner: 'white', card: { id: 'vendetta', cardId: 'vendetta' } });
  const next = challenged([], state);
  assert.deepEqual(legalDests(next).get('b7'), ['c6']);
  const victim = piece(next, 'c6').id;
  const moved = act(next, { type: 'move', from: 'b7', to: 'c6' });
  assert.equal(moved.pieces.find(p => p.id === victim)!.zone, 'captured');
});

for (const orientation of [0, 90, 180, 270] as const) {
  test(`Challenge follows knight identity at orientation ${orientation}`, () => {
    const state = ready([], '4k3/1n4p1/8/8/8/8/6P1/4K3 w - - 0 1');
    state.orientation = orientation;
    const next = challenged([], state);
    assert.deepEqual([...legalDests(next).keys()], ['b7']);
    const moved = act(next, { type: 'move', from: 'b7', to: 'a5' });
    assert.equal(piece(moved, 'a5').id, piece(state, 'b7').id);
    assert.equal(moved.orientation, orientation);
  });
}

test('Forfeiting Challenge changes the turn without moving or capturing pieces', () => {
  const state = challenged();
  const ended = act(state, { type: 'endTurn' });
  assert.equal(ended.turn.color, 'white');
  assert.deepEqual(ended.pieces, state.pieces);
  assert.equal(ended.outcome, null);
});

test('Fulfilled Challenge expires before the opponent next turn', () => {
  let state = act(challenged(), { type: 'move', from: 'b7', to: 'b6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g2', to: 'g3' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'black');
  assert.ok(legalDests(state).has('g7'));
});

test('Challenge rejects a royal knight selected as the opponent king', () => {
  const state = ready([], '4k3/1n4p1/8/8/8/8/6P1/4K3 w - - 0 1');
  piece(state, 'e8').royal = false;
  piece(state, 'b7').royal = true;
  assert.equal(cardPlayTargets(state, 'challenge').includes('b7'), false);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'b7' }).ok, false);
});

function rng(seed: number) {
  let value = seed >>> 0;
  return (length: number) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value % length;
  };
}

function invariants(state: GameState, identities: string[], cardIds: string[]) {
  assert.deepEqual(state.pieces.map(p => p.id).sort(), identities);
  const board = state.pieces.filter(p => p.zone === 'board');
  assert.equal(new Set(board.map(p => p.square)).size, board.length);
  assert.ok(board.every(p => p.square && /^[a-h][1-8]$/.test(p.square)));
  assert.ok(state.pieces.filter(p => p.zone !== 'board').every(p => p.square === null));
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  assert.deepEqual(Object.values(state.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]).map(c => c.id).sort(), cardIds);
  for (const color of ['white', 'black'] as const) assert.equal(board.filter(p => p.owner === color && p.royal).length, 1);
}

for (let seed = 1; seed <= 20; seed += 1) {
  test(`seeded legal Challenge integration ${seed}`, () => {
    const random = rng(seed);
    let state = createGameState({ phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
    const identities = state.pieces.map(p => p.id).sort();
    const cardIds = state.players.white.hand.map(c => c.id).sort();
    const targets = cardPlayTargets(state, 'challenge') as SquareName[];
    assert.ok(targets.length > 0);
    const target = targets[random(targets.length)]!;
    const actor = piece(state, target).id;
    state = challenged([], state, target);
    for (let ply = 0; ply < 6; ply += 1) {
      const moves = [...legalDests(state)].flatMap(([from, tos]) => tos.map(to => ({ from, to })));
      assert.ok(moves.length > 0);
      if (ply === 0) assert.ok(moves.every(move => move.from === target));
      const move = moves[random(moves.length)]!;
      const color = state.turn.color;
      const before = structuredClone(state);
      state = act(state, { type: 'move', ...move });
      assert.equal(isKingInCheck(state, color), false);
      if (ply === 0) assert.equal(piece(state, move.to).id, actor);
      assert.equal(before.pieces.find(p => p.square === move.from)?.zone, 'board');
      invariants(state, identities, cardIds);
      state = act(state, { type: 'endTurn' });
      invariants(state, identities, cardIds);
    }
  });
}
