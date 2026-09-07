import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const id = 'man-of-straw';
const fen = '4r2k/8/8/8/8/8/PP6/4K3 w - - 7 3';
const fresh = (position = fen) => createGameState({ fen: position, hands: { white: [id], black: [id] }, decks: { white: ['crab'], black: ['crab'] } });
const play = (state: GameState, target: unknown = { king: 'e1', pawn: 'a2' }) => applyAction(state, { type: 'playCard', cardId: id, target });
function success(state: GameState, target?: unknown) {
  const result = play(state, target);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

test('Man of Straw has its printed nine point definition', () => {
  const definition = CARD_CATALOG[id];
  assert.ok(definition);
  assert.equal(definition.name, 'Man of Straw');
  assert.equal(definition.points, 9);
  assert.equal(definition.unique, false);
  assert.equal(definition.continuing, false);
  assert.equal(definition.image, '/KC18_card1.png');
  assert.deepEqual(definition.timing, ['beforeMove']);
});

for (const [color, position, king, pawn] of [
  ['white', fen, 'e1', 'a2'],
  ['black', '4k3/pp6/8/8/8/8/8/4R2K b - - 7 3', 'e8', 'a7'],
] as const) {
  test(`checked ${color} swaps identities and retains its regular move`, () => {
    const state = fresh(position);
    assert.equal(isKingInCheck(state, color), true);
    const originals = structuredClone(state.pieces);
    const after = success(state, { king, pawn });
    assert.deepEqual(after.pieces, originals.map(piece => ({ ...piece, square: piece.square === king ? pawn : piece.square === pawn ? king : piece.square })));
    assert.equal(isKingInCheck(after, color), false);
    assert.equal(after.turn.color, color);
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.moveMade, false);
    assert.deepEqual(after.fen.split(' ').slice(4), ['7', '3']);
    assert.equal(after.players[color].discard.filter(card => card.cardId === id).length, 1);
    assert.deepEqual(after.players[color].hand.map(card => card.cardId), ['crab']);
  });
}

for (const target of [undefined, null, 'a2', { king: 'e1' }, { pawn: 'a2' }, { king: 'e1', pawn: 'e1' }, { king: 'e1', pawn: 'a3' }, { king: 'e1', pawn: 'a2', extra: true }]) {
  test(`reject malformed target ${JSON.stringify(target)}`, () => {
    const state = fresh();
    const result = applyAction(state, { type: 'playCard', cardId: id, target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

test('a safe King cannot play it preemptively', () => {
  const state = fresh('7k/8/8/8/8/8/PP6/4K3 w - - 7 3');
  assert.equal(play(state).ok, false);
});

test('it cannot be played after the Regular Move', () => {
  const moved = applyAction(fresh(), { type: 'move', from: 'e1', to: 'd1' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.turn.moveMade, true);
  assert.equal(play(moved.state, { king: 'd1', pawn: 'a2' }).ok, false);
});

for (const change of ['opponent', 'promoted', 'royal', 'nonPawn'] as const) {
  test(`ineligible ${change} target is rejected without spending`, () => {
    const state = fresh(change === 'opponent'
      ? '4r2k/8/8/8/8/8/pP6/4K3 w - - 7 3'
      : change === 'promoted' || change === 'nonPawn'
        ? '4r2k/8/8/8/8/8/NP6/4K3 w - - 7 3'
        : fen);
    const pawn = state.pieces.find(piece => piece.square === 'a2')!;
    if (change === 'promoted') {
      pawn.originalRole = 'pawn';
      pawn.promoted = true;
    }
    if (change === 'royal') pawn.royal = true;
    const result = play(state);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

test('a transformed original Pawn retains its current powers', () => {
  const state = fresh('4r2k/8/8/8/8/8/NP6/4K3 w - - 7 3');
  state.pieces.find(piece => piece.square === 'a2')!.originalRole = 'pawn';
  const after = success(state);
  const pawn = after.pieces.find(piece => piece.square === 'e1')!;
  assert.equal(pawn.role, 'knight');
  assert.equal(pawn.originalRole, 'pawn');
});

test('a neutral opponent Pawn is controlled and keeps its ownership', () => {
  const state = fresh('4r2k/8/8/8/8/8/pP6/4K3 w - - 7 3');
  const pawn = state.pieces.find(piece => piece.square === 'a2')!;
  pawn.neutral = true;
  const after = success(state);
  assert.deepEqual(after.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: 'e1' });
});

test('a capturable Prince cannot be the selected King', () => {
  const state = fresh();
  state.pieces.find(piece => piece.square === 'e1')!.royal = false;
  assert.equal(play(state).ok, false);
});

test('an opponent royal cannot be the selected King', () => {
  const state = fresh();
  assert.equal(play(state, { king: 'h8', pawn: 'a2' }).ok, false);
});

test('relocation revokes both of the acting King castling rights', () => {
  const state = fresh('4r2k/8/8/8/8/8/PP6/R3K2R w KQ - 7 3');
  const after = success(state);
  assert.equal(after.fen.split(' ')[2], '-');
  assert.deepEqual(after.fen.split(' ').slice(4), ['7', '3']);
});

test('unsafe destination fizzles, restoring the board and retaining the move', () => {
  const state = fresh('r3r2k/8/8/8/8/8/PP6/4K3 w - - 7 3');
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.equal(result.state.fen, state.fen);
  assert.equal(result.state.turn.moveMade, false);
  assert.equal(result.state.players.white.discard.filter(card => card.cardId === id).length, 1);
});

test('a normal move can actually follow the swap', () => {
  const after = success(fresh());
  const result = applyAction(after, { type: 'move', from: 'b2', to: 'b3' });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'move');
  assert.equal(result.state.turn.moveMade, true);
});
