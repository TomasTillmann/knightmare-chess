// Man-Trap focused behavior, authored independently before implementation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer';
import { createGameState } from '../state';
import { CARD_CATALOG } from './catalog';
import type { GameAction, GameState, SquareName } from '../types';

const FEN = '3r3k/8/8/8/3N4/8/8/7K w - - 0 1';
function setup(fen = FEN) {
  return createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['man-trap'] } });
}
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}
function trap(state = setup(), target: unknown = 'd4') {
  return act(state, { type: 'playCard', cardId: 'man-trap', target });
}
function move(state: GameState, from: SquareName, to: SquareName) {
  assert.ok(legalDests(state).get(from)?.includes(to), `${from}-${to} must be legal`);
  return act(state, { type: 'move', from, to });
}
function end(state: GameState) { return act(state, { type: 'endTurn' }); }
function at(state: GameState, square: SquareName) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

test('Man-Trap has the printed metadata and timing', () => {
  const card = CARD_CATALOG['man-trap'];
  assert.ok(card);
  assert.equal(card.name, 'Man-Trap');
  assert.equal(card.points, 6);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, true);
  assert.deepEqual(card.timing, ['afterMove']);
});

for (const [name, target] of [['friendly knight', 'd4'], ['friendly King', 'h1']] as const) {
  test(`Man-Trap accepts a square occupied by a ${name}`, () => {
    const state = setup();
    const next = trap(state, target);
    assert.equal(boardFen(next), boardFen(state));
    assert.equal(next.players.white.hand.length, 0);
    assert.equal(next.players.white.discard.length, 0);
    assert.equal(next.effects.length, state.effects.length + 1);
  });
}

for (const target of ['d5', 'd8', 'h8', 'z9', null, { square: 'd4' }]) {
  test(`Man-Trap rejects an ineligible target ${JSON.stringify(target)}`, () => {
    const state = setup();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'man-trap', target });
    assert.equal(result.ok, false);
    assert.deepEqual(state, before);
  });
}

test('Man-Trap legal target oracle includes exactly the friendly occupied squares', () => {
  const state = setup();
  const accepted = cardPlayTargets(state, 'man-trap').filter(target =>
    applyAction(state, { type: 'playCard', cardId: 'man-trap', target }).ok);
  assert.deepEqual(accepted.sort(), ['d4', 'h1']);
});

test('Man-Trap captures the arriving enemy after its capture, preserving both identities', () => {
  const initial = setup();
  const victim = at(initial, 'd4')!;
  const attacker = at(initial, 'd8')!;
  const armed = trap(initial);
  const snapshot = structuredClone(armed);
  const result = move(end(armed), 'd8', 'd4');
  for (const original of [victim, attacker]) {
    const piece = result.pieces.find(piece => piece.id === original.id)!;
    assert.equal(piece.zone, 'captured');
    assert.equal(piece.square, null);
    assert.equal(piece.owner, original.owner);
    assert.equal(piece.role, original.role);
  }
  assert.equal(at(result, 'd4'), undefined);
  assert.equal(boardFen(result), '7k/8/8/8/8/8/8/7K');
  assert.equal(result.fen.split(' ')[0], boardFen(result));
  assert.equal(result.effects.length, 0);
  assert.equal(result.players.white.discard.filter(card => card.cardId === 'man-trap').length, 1);
  assert.deepEqual(armed, snapshot);
});

test('The trap remains on a vacated square and captures a noncapturing arrival', () => {
  let state = end(trap());
  state = end(move(state, 'h8', 'g8'));
  state = end(move(state, 'd4', 'f5'));
  const attackerId = at(state, 'd8')!.id;
  state = move(state, 'd8', 'd4');
  assert.equal(state.pieces.find(piece => piece.id === attackerId)!.zone, 'captured');
  assert.ok(at(state, 'f5'));
});

test('Passing through the vacated trap does not spring it', () => {
  let state = end(trap());
  state = end(move(state, 'h8', 'g8'));
  state = end(move(state, 'd4', 'f5'));
  state = move(state, 'd8', 'd2');
  assert.equal(at(state, 'd2')?.role, 'rook');
  assert.equal(state.effects.length, 1);
  assert.equal(state.players.white.discard.length, 0);
});

test('A friendly piece can return to the trap without springing it', () => {
  let state = end(trap());
  state = end(move(state, 'd8', 'a8'));
  state = end(move(state, 'd4', 'f5'));
  state = end(move(state, 'a8', 'b8'));
  state = move(state, 'f5', 'd4');
  assert.equal(at(state, 'd4')?.owner, 'white');
  assert.equal(state.effects.length, 1);
});

test('An enemy King captures normally and exhausts the trap unharmed', () => {
  const initial = setup('8/8/8/4k3/3N4/8/8/7K w - - 0 1');
  const king = at(initial, 'e5')!;
  const victim = at(initial, 'd4')!;
  const result = move(end(trap(initial)), 'e5', 'd4');
  assert.equal(at(result, 'd4')?.id, king.id);
  assert.equal(result.pieces.find(piece => piece.id === victim.id)!.zone, 'captured');
  assert.equal(result.effects.length, 0);
  assert.equal(result.players.white.discard.filter(card => card.cardId === 'man-trap').length, 1);
});

test('Only the first opposing arrival is captured', () => {
  let state = end(trap(setup('3r3k/8/8/8/r2N4/8/8/7K w - - 0 1')));
  state = end(move(state, 'd8', 'd4'));
  state = end(move(state, 'h1', 'h2'));
  state = move(state, 'a4', 'd4');
  assert.equal(at(state, 'd4')?.owner, 'black');
  assert.equal(state.effects.length, 0);
  assert.equal(state.players.white.discard.length, 1);
});

test('Arming the trap does not publish its secret coordinate in card history', () => {
  const state = setup();
  const result = trap(state);
  const events = result.history.slice(state.history.length);
  assert.ok(events.some(event => event.type === 'cardPlayed' && event.cardId === 'man-trap'));
  assert.equal(JSON.stringify(events).includes('d4'), false);
});

test('Arming is immutable and a rejected replacement cannot change the sealed square', () => {
  const state = setup();
  const before = structuredClone(state);
  const armed = trap(state);
  assert.deepEqual(state, before);
  const snapshot = structuredClone(armed);
  const rejected = applyAction(armed, { type: 'playCard', cardId: 'man-trap', target: 'h1' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(armed, snapshot);
  const result = move(end(armed), 'd8', 'd4');
  assert.equal(at(result, 'd4'), undefined);
});

test('Man-Trap rejects a friendly occupied target before the regular move', () => {
  const state = createGameState({ hands: { white: ['man-trap'] } });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'man-trap', target: 'e2' }).ok, false);
});

test('Positive movement fixtures are independently legal without a trap', () => {
  const cases: Array<[string, Array<[SquareName, SquareName]>]> = [
    [FEN, [['d8', 'd4']]],
    [FEN, [['h8', 'g8'], ['d4', 'f5'], ['d8', 'd4']]],
    [FEN, [['h8', 'g8'], ['d4', 'f5'], ['d8', 'd2']]],
    [FEN, [['d8', 'a8'], ['d4', 'f5'], ['a8', 'b8'], ['f5', 'd4']]],
    ['8/8/8/4k3/3N4/8/8/7K b - - 0 1', [['e5', 'd4']]],
    ['3r3k/8/8/8/r2N4/8/8/7K b - - 0 1', [['d8', 'd4'], ['h1', 'h2']]],
    ['7k/8/8/8/r7/8/7K/8 b - - 0 1', [['a4', 'd4']]],
  ];
  for (const [fen, moves] of cases) {
    let state = createGameState({ fen, turn: 'black' });
    for (const [from, to] of moves) state = end(move(state, from, to));
  }
});
