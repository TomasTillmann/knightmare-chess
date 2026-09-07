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
