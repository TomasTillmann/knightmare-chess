import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyAction, isKingInCheck, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const fen = '7k/6n1/8/8/8/8/1P4P1/2B1K3 w - - 7 3';
const initial = (position = fen) => createGameState({ fen: position, hands: { white: ['crusade'] }, decks: { white: ['pacifism'] } });
function moved(state = initial(), from = 'c1', to = 'd2'): GameState {
  const result = applyAction(state, { type: 'move', from, to });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'move');
  return result.state;
}
function play(state: GameState, target: unknown = [{ from: 'd2', to: 'e3' }]) {
  return applyAction(state, { type: 'playCard', cardId: 'crusade', target });
}
function successful(state: GameState, target?: unknown): GameState {
  const result = play(state, target);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'crusade');
  return result.state;
}
function rejected(state: GameState, target?: unknown) {
  const snapshot = structuredClone(state);
  const result = play(state, target);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
}

describe('Crusade focused rules', () => {
  it('has the printed nine-point regular after-move metadata', () => {
    const card = CARD_CATALOG.crusade;
    assert.ok(card);
    assert.equal(card.points, 9);
    assert.equal(card.unique, false);
    assert.equal(card.continuing, false);
    assert.deepEqual(card.timing, ['afterMove']);
  });
  it('moves the same Bishop again after its quiet Regular Move', () => {
    const before = moved();
    const bishop = before.pieces.find(piece => piece.square === 'd2')!;
    assert.equal(successful(before).pieces.find(piece => piece.id === bishop.id)?.square, 'e3');
  });
  it('spends and replaces the physical card once', () => {
    const before = moved();
    const physical = before.players.white.hand[0];
    const after = successful(before);
    assert.deepEqual(after.players.white.discard, [physical]);
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['pacifism']);
    assert.deepEqual(after.players.white.deck, []);
    assert.equal(after.turn.cardPlays.white, 1);
  });
  it('keeps the completed move phase and grants no third Regular Move', () => {
    const after = successful(moved());
    assert.equal(after.turn.color, 'white');
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    const third = applyAction(after, { type: 'move', from: 'e3', to: 'f4' });
    assert.equal(third.ok, false);
    assert.deepEqual(third.state, after);
  });
  it('does not advance either clock twice for a quiet extra move', () => {
    const before = moved();
    assert.deepEqual(before.fen.split(' ').slice(4), ['8', '3']);
    assert.deepEqual(successful(before).fen.split(' ').slice(4), ['8', '3']);
  });
  it('allows capture on the extra ordinary move and resets its clock', () => {
    const before = moved(initial('7k/6n1/8/8/8/4n3/1P4P1/2B1K3 w - - 7 3'));
    const victim = before.pieces.find(piece => piece.square === 'e3')!;
    const after = successful(before);
    assert.equal(after.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
    assert.deepEqual(after.fen.split(' ').slice(4), ['0', '3']);
  });
  it('rejects a play before any Regular Move atomically', () => {
    const before = initial();
    rejected(before, [{ from: 'c1', to: 'd2' }]);
  });
  it('rejects a capturing first move atomically', () => {
    const before = moved(initial('7k/6n1/8/8/8/8/1P1n2P1/2B1K3 w - - 7 3'));
    rejected(before);
  });
  it('rejects a different Bishop than the physical first mover', () => {
    const before = moved(initial('7k/6n1/8/8/8/8/1P4P1/2B1KB2 w - - 7 3'));
    rejected(before, [{ from: 'f1', to: 'e2' }]);
  });
  it('rejects a non-Bishop quiet first mover', () => {
    const before = moved(initial(), 'b2', 'b3');
    rejected(before, [{ from: 'b3', to: 'b4' }]);
  });
  it('accepts a Bishop promoted before the first move', () => {
    const state = initial();
    const bishop = state.pieces.find(piece => piece.square === 'c1')!;
    bishop.originalRole = 'pawn';
    bishop.promoted = true;
    const after = successful(moved(state));
    assert.equal(after.pieces.find(piece => piece.id === bishop.id)?.square, 'e3');
  });
  it('rejects a Pawn which became a Bishop on the first move', () => {
    const state = initial('7k/P5n1/8/8/8/8/1P4P1/4K3 w - - 7 3');
    const first = applyAction(state, { type: 'move', from: 'a7', to: 'a8', promotion: 'bishop' });
    assert.equal(first.ok, true);
    assert.equal(first.state.pieces.find(piece => piece.square === 'a8')?.role, 'bishop');
    rejected(first.state, [{ from: 'a8', to: 'b7' }]);
  });
  it('rejects a different physical Bishop substituted onto the first destination', () => {
    const before = moved();
    before.pieces.find(piece => piece.square === 'd2')!.id = 'replacement-bishop';
    rejected(before);
  });
  it('rejects a blocked ordinary diagonal atomically', () => {
    const before = moved(initial('7k/6n1/8/8/8/4P3/1P4P1/2B1K3 w - - 7 3'));
    rejected(before, [{ from: 'd2', to: 'f4' }]);
  });
  it('allows a long unobstructed ordinary diagonal', () => {
    const before = moved();
    const after = successful(before, [{ from: 'd2', to: 'h6' }]);
    assert.equal(after.pieces.find(piece => piece.square === 'h6')?.role, 'bishop');
  });
  it('does not advance Black fullmove or halfmove clocks twice', () => {
    const state = createGameState({
      fen: '2b1k3/1p4p1/8/8/8/8/6N1/7K b - - 7 3', hands: { black: ['crusade'] },
    });
    const before = moved(state, 'c8', 'd7');
    const after = successful(before, [{ from: 'd7', to: 'e6' }]);
    assert.deepEqual(before.fen.split(' ').slice(4), ['8', '4']);
    assert.deepEqual(after.fen.split(' ').slice(4), ['8', '4']);
    assert.equal(after.turn.color, 'black');
    assert.equal(after.turn.moveMade, true);
  });
  it('spends the card and preserves the first move when the extra move directly mates', () => {
    const before = moved(initial('7k/5K1p/8/8/5B2/8/8/8 w - - 7 3'), 'f4', 'h6');
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const candidate = structuredClone(before);
    candidate.pieces.find(piece => piece.square === 'h6')!.square = 'g7';
    assert.equal(positionFor(candidate, 'black').isCheckmate(), true);
    const result = play(before, [{ from: 'h6', to: 'g7' }]);
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
    assert.deepEqual(result.state.pieces, before.pieces);
    assert.equal(result.state.fen, before.fen);
    assert.deepEqual(result.state.fen.split(' ').slice(4), ['8', '3']);
    assert.deepEqual(result.state.players.white.discard, before.players.white.hand);
    assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['pacifism']);
    assert.equal(result.state.turn.cardPlays.white, 1);
  });
  it('spends the card and preserves the first move when the extra move exposes own King', () => {
    const before = moved(initial('4r2k/6n1/8/8/8/8/1P1B2P1/4K3 w - - 7 3'), 'd2', 'e3');
    assert.equal(isKingInCheck(before, 'white'), false);
    const candidate = structuredClone(before);
    candidate.pieces.find(piece => piece.square === 'e3')!.square = 'f4';
    assert.equal(isKingInCheck(candidate, 'white'), true);
    const result = play(before, [{ from: 'e3', to: 'f4' }]);
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
    assert.deepEqual(result.state.pieces, before.pieces);
    assert.equal(result.state.fen, before.fen);
    assert.deepEqual(result.state.fen.split(' ').slice(4), ['8', '3']);
    assert.deepEqual(result.state.players.white.discard, before.players.white.hand);
    assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['pacifism']);
    assert.equal(result.state.turn.cardPlays.white, 1);
  });
  for (const target of [
    undefined, [], { from: 'd2', to: 'e3' }, [{ from: 'd2', to: 'e3' }, { from: 'e3', to: 'f4' }],
    [{ from: 'd2', to: 'd3' }], [{ from: 'd2', to: 'b2' }], [{ from: 'd2', to: 'z9' }],
  ]) it(`rejects malformed or nonordinary extra movement ${JSON.stringify(target)}`, () => {
    const before = moved();
    const result = applyAction(before, { type: 'playCard', cardId: 'crusade', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });
});
