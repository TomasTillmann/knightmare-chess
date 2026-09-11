import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const FEN = '7k/6p1/8/8/8/8/3P4/RNBQK3 w - - 0 1';
const setup = (fen = FEN) => createGameState({
  fen, phase: 'afterMove', moveMade: true, hands: { white: ['coup'] },
});
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}
const coup = (state: GameState, target: unknown) => act(state, { type: 'playCard', cardId: 'coup', target });
const piece = (state: GameState, square: SquareName) => {
  const found = state.pieces.find(p => p.zone === 'board' && p.square === square);
  assert.ok(found, square);
  return found;
};
const turn = (state: GameState, color: 'white' | 'black'): GameState => ({
  ...state, turn: { color, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } },
});

for (const color of ['white', 'black'] as const) {
  const enemy = color === 'white' ? 'black' : 'white';
  const square = (white: SquareName): SquareName => color === 'white'
    ? white : `${white[0]}${9 - Number(white[1])}` as SquareName;
  function pacifistReady(attacked = false): GameState {
    let state = createGameState({
      fen: color === 'white'
        ? `7k/8/8/8/${attacked ? '3p4' : '4p3'}/2N5/8/K7 w - - 0 1`
        : `k7/8/2n5/${attacked ? '3P4' : '4P3'}/8/8/8/7K b - - 0 1`,
      hands: { [color]: ['pacifism', 'coup'], [enemy]: ['peace-talks', 'truce'] },
    });
    state = act(state, { type: 'playCard', cardId: 'pacifism', target: square('c3') });
    if (!attacked) {
      assert.equal(legalDests(state).get(square('c3'))?.includes(square('e4')), false);
      assert.equal(applyAction(state, { type: 'move', from: square('c3'), to: square('e4') }).ok, false);
    }
    state = act(state, { type: 'move', from: square('a1'), to: square('a2') });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: square('h8'), to: square('h7') });
    state = act(state, { type: 'endTurn' });
    return act(state, { type: 'move', from: square('a2'), to: square('a1') });
  }
  function reply(state: GameState): GameState {
    state = act(state, { type: 'endTurn' });
    return act(state, { type: 'move', from: square('h7'), to: square('h8') });
  }

  test(`Coup suspends ${color} Pacifism for capture while retaining the physical marker`, () => {
    const before = pacifistReady();
    const snapshot = structuredClone(before);
    const knight = piece(before, square('c3'));
    const victim = piece(before, square('e4'));
    const card = before.players[color].hand.find(card => card.cardId === 'coup')!;
    let state = coup(before, square('c3'));
    assert.deepEqual(before, snapshot);
    assert.deepEqual(state.effects[0], before.effects[0]);
    assert.deepEqual(state.effects[1], {
      type: 'coup', owner: color, card, princeId: piece(before, square('a1')).id,
      kingId: knight.id, princeRole: 'king',
    });
    assert.equal(state.players[color].discard.length, 0);
    state = act(reply(state), { type: 'endTurn' });
    assert.ok(legalDests(state).get(square('c3'))?.includes(square('e4')));
    state = act(state, { type: 'move', from: square('c3'), to: square('e4') });
    assert.equal(piece(state, square('e4')).id, knight.id);
    assert.equal(piece(state, square('e4')).royal, true);
    assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
    assert.deepEqual(state.effects[0], before.effects[0]);
  });

  test(`Coup on an attacked ${color} Pacifist fizzles because suspension exposes check`, () => {
    const before = pacifistReady(true);
    const snapshot = structuredClone(before);
    const card = before.players[color].hand.find(card => card.cardId === 'coup')!;
    assert.equal(cardPlayTargets(before, 'coup').includes(square('c3')), false);
    const after = coup(before, square('c3'));
    assert.deepEqual(before, snapshot);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: 'coup', reason: 'SELF_CHECK', movement: [], preservePreviousMove: true,
    });
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.effects, before.effects);
    assert.deepEqual(after.players[color].discard, [card]);
    assert.equal(after.players[color].hand.some(candidate => candidate.id === card.id), false);
    assert.equal(after.turn.cardPlays[color], 1);
    assert.equal(isKingInCheck(after, color), false);
  });

  test(`Pacifism resumes on the ${color} Knight after Peace Talks cancels Coup`, () => {
    const before = pacifistReady();
    const card = before.players[color].hand.find(card => card.cardId === 'coup')!;
    let state = reply(coup(before, square('c3')));
    assert.ok(cardPlayTargets(state, 'peace-talks').includes(card.id));
    const snapshot = structuredClone(state);
    const cancelled = act(state, { type: 'playCard', cardId: 'peace-talks', target: card.id });
    assert.deepEqual(state, snapshot);
    assert.deepEqual(cancelled.effects, before.effects);
    assert.deepEqual(cancelled.players[color].discard, [card]);
    assert.equal(piece(cancelled, square('a1')).royal, true);
    assert.equal(piece(cancelled, square('c3')).royal, false);
    state = act(cancelled, { type: 'endTurn' });
    assert.equal(legalDests(state).get(square('c3'))?.includes(square('e4')), false);
    const blocked = applyAction(state, { type: 'move', from: square('c3'), to: square('e4') });
    assert.equal(blocked.ok, false);
    assert.deepEqual(blocked.state, state);
  });

  test(`Truce still prohibits capture by the ${color} royal Pacifist`, () => {
    let state = reply(coup(pacifistReady(), square('c3')));
    state = act(state, { type: 'playCard', cardId: 'truce' });
    state = act(state, { type: 'endTurn' });
    assert.equal(legalDests(state).get(square('c3'))?.includes(square('e4')), false);
    assert.equal(applyAction(state, { type: 'move', from: square('c3'), to: square('e4') }).ok, false);
    assert.ok(legalDests(state).get(square('c3'))?.includes(square('b5')));
  });

  test(`A ${color} Prince remains eligible for active Pacifism`, () => {
    let state = createGameState({
      fen: color === 'white'
        ? '7k/8/8/8/8/2N5/1p6/K7 w - - 0 1'
        : 'k7/1P6/2n5/8/8/8/8/7K b - - 0 1',
      phase: 'afterMove', moveMade: true, hands: { [color]: ['coup', 'pacifism'] },
    });
    state = coup(state, square('c3'));
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: square('h8'), to: square('h7') });
    state = act(state, { type: 'endTurn' });
    assert.ok(cardPlayTargets(state, 'pacifism').includes(square('a1')));
    assert.equal(cardPlayTargets(state, 'pacifism').includes(square('c3')), false);
    assert.ok(legalDests(state).get(square('a1'))?.includes(square('b2')));
    state = act(state, { type: 'playCard', cardId: 'pacifism', target: square('a1') });
    assert.equal(legalDests(state).get(square('a1'))?.includes(square('b2')), false);
    assert.equal(applyAction(state, { type: 'move', from: square('a1'), to: square('b2') }).ok, false);
  });
}

test('Coup has its printed name and point value', () => {
  assert.equal(CARD_CATALOG.coup?.name, 'Coup');
  assert.equal(CARD_CATALOG.coup?.points, 6);
});

test('Coup is a nonunique continuing card played after moving', () => {
  assert.equal(CARD_CATALOG.coup?.unique, false);
  assert.equal(CARD_CATALOG.coup?.continuing, true);
  assert.deepEqual(CARD_CATALOG.coup?.timing, ['afterMove']);
});

for (const square of ['b1', 'c1', 'd2'] as const) {
  test(`Coup makes the own piece on ${square} royal without changing its identity or movement`, () => {
    const before = setup();
    const selected = piece(before, square);
    const after = coup(before, square);
    assert.deepEqual(piece(after, square), { ...selected, royal: true });
    assert.deepEqual(piece(after, 'e1'), { ...piece(before, 'e1'), royal: false });
    assert.equal(after.pieces.filter(p => p.owner === 'white' && p.royal).length, 1);
  });
}

for (const target of ['a1', 'd1', 'e1', 'g7', 'a4', 'z9', null, { square: 'b1' }]) {
  test(`Coup rejects ineligible target ${JSON.stringify(target)} without altering state`, () => {
    const before = setup();
    const snapshot = structuredClone(before);
    const result = applyAction(before, { type: 'playCard', cardId: 'coup', target });
    assert.equal(result.ok, false);
    assert.deepEqual(before, snapshot);
    assert.deepEqual(result.state, before);
  });
}

test('Coup is unavailable before the regular move', () => {
  const before = turn(setup(), 'white');
  const result = applyAction(before, { type: 'playCard', cardId: 'coup', target: 'b1' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
});

test('Coup exposes exactly the eligible own pieces as square targets', () => {
  assert.deepEqual(cardPlayTargets(setup(), 'coup').sort(), ['b1', 'c1', 'd2']);
});

test('Coup keeps the board locations and does not provide an extra regular move', () => {
  const before = setup();
  const after = coup(before, 'b1');
  assert.equal(boardFen(after), boardFen(before));
  assert.equal(after.turn.moveMade, true);
  assert.equal(after.turn.phase, 'afterMove');
  assert.equal(after.turn.cardPlays.white, 1);
  assert.equal(legalDests(after).size, 0);
});

test('Coup remains in play rather than being discarded after resolution', () => {
  const after = coup(setup(), 'b1');
  assert.equal(after.players.white.hand.some(card => card.cardId === 'coup'), false);
  assert.equal(after.players.white.discard.some(card => card.cardId === 'coup'), false);
  assert.equal(after.effects.length, 1);
  assert.equal(after.history.at(-1)?.cardId, 'coup');
});

test('The marked Knight keeps Knight destinations and its marker follows a regular move', () => {
  const after = turn(coup(setup(), 'b1'), 'white');
  assert.deepEqual((legalDests(after).get('b1') ?? []).sort(), ['a3', 'c3']);
  const moved = act(after, { type: 'move', from: 'b1', to: 'c3' });
  assert.equal(piece(moved, 'c3').id, piece(after, 'b1').id);
  assert.equal(piece(moved, 'c3').royal, true);
  assert.equal(piece(moved, 'c3').role, 'knight');
});

test('The marked Bishop keeps sliding movement', () => {
  const after = turn(coup(setup('7k/6p1/8/8/8/8/8/2B1K3 w - - 0 1'), 'c1'), 'white');
  assert.ok(legalDests(after).get('c1')?.includes('g5'));
  assert.equal(legalDests(after).get('c1')?.includes('h6'), false);
  assert.equal(legalDests(after).get('c1')?.includes('c2'), false);
});

test('The marked Pawn keeps its ordinary forward movement', () => {
  const after = turn(coup(setup(), 'd2'), 'white');
  assert.deepEqual((legalDests(after).get('d2') ?? []).sort(), ['d3', 'd4']);
});

test('An attack on the Prince no longer gives check', () => {
  const after = coup(setup('r6k/6p1/8/8/8/8/2N5/K7 w - - 0 1'), 'c2');
  assert.equal(isKingInCheck(after, 'white'), false);
  assert.equal(piece(after, 'a1').royal, false);
});

test('The opponent may capture the Prince without ending the game', () => {
  const after = turn(coup(setup('r6k/6p1/8/8/8/8/2N5/K7 w - - 0 1'), 'c2'), 'black');
  const princeId = piece(after, 'a1').id;
  assert.ok(legalDests(after).get('a8')?.includes('a1'));
  const captured = act(after, { type: 'move', from: 'a8', to: 'a1' });
  assert.equal(captured.pieces.find(p => p.id === princeId)?.zone, 'captured');
  assert.equal(piece(captured, 'c2').royal, true);
  assert.equal(captured.outcome, null);
});

test('The Prince retains one-square movement and may move onto an attacked square', () => {
  const after = turn(coup(setup('1r5k/6p1/8/8/8/8/2N5/K7 w - - 0 1'), 'c2'), 'white');
  assert.ok(legalDests(after).get('a1')?.includes('b1'));
  assert.equal(legalDests(after).get('a1')?.includes('a3'), false);
  const moved = act(after, { type: 'move', from: 'a1', to: 'b1' });
  assert.equal(piece(moved, 'b1').royal, false);
  assert.equal(isKingInCheck(moved, 'white'), false);
});

test('The marked Knight may not move into an attacked square', () => {
  const after = turn(coup(setup('r6k/6p1/8/8/8/8/8/1N2K3 w - - 0 1'), 'b1'), 'white');
  assert.equal(legalDests(after).get('b1')?.includes('a3'), false);
  assert.equal(applyAction(after, { type: 'move', from: 'b1', to: 'a3' }).ok, false);
  assert.ok(legalDests(after).get('b1')?.includes('c3'));
});
