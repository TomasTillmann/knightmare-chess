import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

const fen = '7k/8/8/8/n7/8/8/R6K w - - 7 12';
const setup = () => createGameState({ fen, hands: { black: ['riposte'] } });
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}
const capture = (state = setup()) => act(state, { type: 'move', from: 'a1', to: 'a4' });
const riposte = (state: GameState) => act(state, { type: 'playCard', cardId: 'riposte' });

test('Riposte has its printed regular reaction metadata', () => {
  const card = CARD_CATALOG.riposte;
  assert.ok(card);
  assert.equal(card.points, 10);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['afterOpponentMove']);
});

test('Riposte restores the captured defender and removes its attacker', () => {
  const initial = setup();
  const moved = applyAction(initial, { type: 'move', from: 'a1', to: 'a4' });
  assert.equal(moved.ok, true);
  const result = applyAction(moved.state, { type: 'playCard', cardId: 'riposte' });
  assert.equal(result.ok, true);
  assert.ok(result.state.pieces.some(p => p.owner === 'black' && p.role === 'knight' && p.square === 'a4' && p.zone === 'board'));
  assert.ok(result.state.pieces.some(p => p.owner === 'white' && p.role === 'rook' && p.zone === 'captured'));
});

test('Riposte cannot react before an actual capture', () => {
  const initial = setup();
  const result = applyAction(initial, { type: 'playCard', cardId: 'riposte' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, initial);
});

for (const target of ['a4', {}, ['a4'], null]) {
  test(`Riposte rejects an unsolicited target ${JSON.stringify(target)} atomically`, () => {
    const state = capture();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'riposte', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

for (const [symbol, role] of [['p', 'pawn'], ['b', 'bishop'], ['r', 'rook'], ['q', 'queen']] as const) {
  test(`Riposte restores the same physical ${role}`, () => {
    const initial = createGameState({ fen: `7k/8/8/8/${symbol}7/8/8/R6K w - - 7 12`, hands: { black: ['riposte'] } });
    const defender = initial.pieces.find(p => p.square === 'a4')!;
    const attacker = initial.pieces.find(p => p.square === 'a1')!;
    const result = riposte(capture(initial));
    assert.deepEqual(result.pieces.find(p => p.id === defender.id), defender);
    assert.equal(result.pieces.find(p => p.id === attacker.id)?.zone, 'captured');
  });
}

test('Riposte works with White reacting to a Black capture', () => {
  const initial = createGameState({ fen: 'r6k/8/8/N7/8/8/8/7K b - - 9 12', hands: { white: ['riposte'] } });
  const moved = act(initial, { type: 'move', from: 'a8', to: 'a5' });
  const result = riposte(moved);
  assert.equal(result.pieces.find(p => p.id === initial.pieces.find(p => p.square === 'a5')!.id)?.square, 'a5');
  assert.equal(result.pieces.find(p => p.id === initial.pieces.find(p => p.square === 'a8')!.id)?.zone, 'captured');
  assert.deepEqual(result.fen.split(' ').slice(1), [moved.fen.split(' ')[1], '-', '-', '0', '13']);
});

for (const [position, from] of [
  ['7k/8/8/8/n7/8/8/Q6K w - - 0 1', 'a1'],
  ['7k/8/8/8/n7/K7/8/8 w - - 0 1', 'a3'],
] as const) {
  test(`Riposte rejects the prohibited attacker at ${from} in ${position}`, () => {
    const initial = createGameState({ fen: position, hands: { black: ['riposte'] } });
    const moved = act(initial, { type: 'move', from, to: 'a4' });
    const result = applyAction(moved, { type: 'playCard', cardId: 'riposte' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, moved);
  });
}

test('Riposte restores an en-passant victim on its occupied square', () => {
  const initial = createGameState({ fen: '7k/8/8/3pP3/8/8/8/7K w - d6 0 12', hands: { black: ['riposte'] } });
  const victim = initial.pieces.find(p => p.square === 'd5')!;
  const attacker = initial.pieces.find(p => p.square === 'e5')!;
  const result = riposte(act(initial, { type: 'move', from: 'e5', to: 'd6' }));
  assert.deepEqual(result.pieces.find(p => p.id === victim.id), victim);
  assert.equal(result.pieces.find(p => p.id === attacker.id)?.zone, 'captured');
  assert.equal(result.fen.split(' ')[3], '-');
});

test('Riposte reverses a promotion capture in the attacking pawn original form', () => {
  const initial = createGameState({ fen: 'n6k/1P6/8/8/8/8/8/7K w - - 0 12', hands: { black: ['riposte'] } });
  const pawn = initial.pieces.find(p => p.square === 'b7')!;
  const result = riposte(act(initial, { type: 'move', from: 'b7', to: 'a8', promotion: 'queen' }));
  const capturedPawn = result.pieces.find(p => p.id === pawn.id)!;
  assert.equal(capturedPawn.role, 'pawn');
  assert.equal(capturedPawn.promoted, false);
  assert.equal(capturedPawn.zone, 'captured');
  assert.ok(result.pieces.some(p => p.square === 'a8' && p.role === 'knight' && p.zone === 'board'));
});

test('Riposte spends only the selected physical card and draws once', () => {
  const initial = createGameState({ fen, hands: { black: ['riposte', 'riposte'] }, decks: { black: ['peace-talks', 'fog-of-war'] } });
  const selected = initial.players.black.hand[1]!;
  const unselected = initial.players.black.hand[0]!;
  const top = initial.players.black.deck[0]!;
  const result = act(capture(initial), { type: 'playCard', cardId: 'riposte', cardInstanceId: selected.id });
  assert.equal(result.players.black.discard.filter(c => c.id === selected.id).length, 1);
  assert.ok(result.players.black.hand.some(c => c.id === unselected.id));
  assert.ok(result.players.black.hand.some(c => c.id === top.id));
  assert.equal(result.players.black.deck.length, 1);
  assert.deepEqual(result.players.white, initial.players.white);
});

test('Riposte preserves the completed capturing turn and resets its capture clock', () => {
  const moved = capture();
  const result = riposte(moved);
  assert.equal(result.turn.color, 'white');
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.phase, 'afterMove');
  assert.deepEqual(result.fen.split(' ').slice(1), [moved.fen.split(' ')[1], '-', '-', '0', '12']);
});

test('Riposte forfeits precisely the next move and advances Black clocks once', () => {
  const reacted = riposte(capture());
  const skipped = act(reacted, { type: 'endTurn' });
  assert.equal(skipped.turn.color, 'black');
  assert.equal(skipped.turn.moveMade, true);
  assert.equal(skipped.turn.phase, 'afterMove');
  assert.equal(skipped.turn.cardPlays.black, 0);
  assert.deepEqual(skipped.fen.split(' ').slice(4), ['1', '13']);
  assert.equal(applyAction(skipped, { type: 'move', from: 'a4', to: 'b6' }).ok, false);
  const white = act(skipped, { type: 'endTurn' });
  const whiteMoved = act(white, { type: 'move', from: 'h1', to: 'g1' });
  const black = act(whiteMoved, { type: 'endTurn' });
  assert.equal(black.turn.moveMade, false);
  assert.equal(applyAction(black, { type: 'move', from: 'a4', to: 'b6' }).ok, true);
});

test('Riposte self-check fizzle keeps the capture, spends once, and imposes no penalty', () => {
  const initial = createGameState({ fen: '7k/8/8/8/8/2Rn4/8/B6K w - - 0 1', hands: { black: ['riposte'] } });
  const moved = act(initial, { type: 'move', from: 'c3', to: 'd3' });
  const result = riposte(moved);
  assert.equal(result.fen, moved.fen);
  assert.deepEqual(result.pieces, moved.pieces);
  assert.ok(result.history.some(e => e.type === 'cardFizzled' && e.cardId === 'riposte'));
  assert.equal(result.players.black.discard.filter(c => c.cardId === 'riposte').length, 1);
  const next = act(result, { type: 'endTurn' });
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.moveMade, false);
});

test('Riposte restores a defending rook castling right', () => {
  const initial = createGameState({ fen: 'r3k3/8/8/8/8/8/8/R6K w q - 0 1', hands: { black: ['riposte'] } });
  const result = riposte(act(initial, { type: 'move', from: 'a1', to: 'a8' }));
  assert.equal(result.fen.split(' ')[2], 'q');
});

test('Riposte cannot react to an ordinary quiet move', () => {
  const moved = act(setup(), { type: 'move', from: 'a1', to: 'a2' });
  const result = applyAction(moved, { type: 'playCard', cardId: 'riposte' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, moved);
});

test('Riposte rejects a fabricated capture history without actual move provenance', () => {
  const actual = capture();
  const fabricated = createGameState({ fen: actual.fen, turn: actual.turn.color, phase: actual.turn.phase, moveMade: true, hands: { black: ['riposte'] } });
  fabricated.history = structuredClone(actual.history);
  fabricated.pieces = structuredClone(actual.pieces);
  const before = structuredClone(fabricated);
  const result = applyAction(fabricated, { type: 'playCard', cardId: 'riposte' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(fabricated, before);
});

test('Riposte fizzles when its reversal would directly mate the capturing King', () => {
  const initial = createGameState({ fen: '8/8/8/8/r7/2k5/R1b5/K7 w - - 0 1', hands: { black: ['riposte'] } });
  const moved = act(initial, { type: 'move', from: 'a2', to: 'a4' });
  assert.equal(moved.outcome, null);
  const result = riposte(moved);
  assert.equal(result.fen, moved.fen);
  assert.deepEqual(result.pieces, moved.pieces);
  assert.ok(result.history.some(e => e.type === 'cardFizzled' && e.cardId === 'riposte' && e.reason === 'DIRECT_MATE'));
  assert.equal(result.players.black.discard.filter(c => c.cardId === 'riposte').length, 1);
  const next = act(result, { type: 'endTurn' });
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.moveMade, false);
});
