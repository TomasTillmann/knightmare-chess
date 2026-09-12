import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const FEN = '7k/6n1/8/8/8/8/1P4P1/2B1K3 w - - 7 3';
function moved(fen = FEN, from: SquareName = 'c1', to: SquareName = 'd2', prepare?: (state: GameState) => void): GameState {
  const state = createGameState({ fen, hands: { white: ['crusade'], black: ['crusade'] } });
  prepare?.(state);
  const result = applyAction(state, { type: 'move', from, to });
  assert.equal(result.ok, true);
  return result.state;
}
function pieceEffect(state: GameState, type: 'pacifism' | 'curse' | 'fatal-attraction' | 'crab', square: SquareName) {
  const piece = state.pieces.find(piece => piece.square === square)!;
  const owner = type === 'curse' ? (piece.owner === 'white' ? 'black' : 'white') : piece.owner;
  state.effects.push({ type, owner, card: { id: `effect-${type}`, cardId: type }, pieceId: piece.id });
}
function locationEffect(state: GameState, type: 'forbidden-city' | 'fortification' | 'confabulation', location: { square: SquareName } | { from: SquareName; to: SquareName } | { pieceIds: [string, string] }) {
  state.effects.push({ type, owner: 'white', card: { id: `effect-${type}`, cardId: type }, ...location } as Extract<GameState['effects'][number], { type: 'forbidden-city' | 'fortification' | 'confabulation' }>);
}
function extra(state: GameState, to: SquareName, from: SquareName = 'd2') {
  return applyAction(state, { type: 'playCard', cardId: 'crusade', target: [{ from, to }] });
}
function played(state: GameState, to: SquareName, from: SquareName = 'd2') {
  const snapshot = structuredClone(state);
  const result = extra(state, to, from);
  assert.deepEqual(state, snapshot, 'Crusade must not mutate its input');
  assert.equal(result.ok, true);
  assert.equal(result.state.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'crusade').length, 1);
  assert.equal(result.state.history.some(event => event.type === 'cardFizzled'), false);
  assert.equal(result.state.pieces.find(piece => piece.square === to)?.id, state.pieces.find(piece => piece.square === from)?.id);
  return result.state;
}
function rejected(state: GameState, to: SquareName, from: SquareName = 'd2') {
  const snapshot = structuredClone(state);
  const result = extra(state, to, from);
  assert.equal(result.ok, false);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(result.state, snapshot);
}
describe('Crusade interactions', () => {
  for (const to of ['c1', 'c3', 'b4', 'a5', 'e3', 'f4', 'g5', 'h6'] as SquareName[]) it(`moves the physical Bishop to ${to}`, () => {
    const state = moved();
    const id = state.pieces.find(piece => piece.square === 'd2')!.id;
    const result = applyAction(state, { type: 'playCard', cardId: 'crusade', target: [{ from: 'd2', to }] });
    assert.equal(result.ok, true);
    assert.equal(result.state.history.some(event => event.type === 'cardPlayed'), true);
    assert.equal(result.state.pieces.find(piece => piece.id === id)?.square, to);
  });

  it('preserves Pacifism on a quiet extra move', () => {
    const state = moved(FEN, 'c1', 'd2', s => pieceEffect(s, 'pacifism', 'c1'));
    const after = played(state, 'e3');
    assert.deepEqual(after.effects, state.effects);
  });
  it('cannot capture with a Pacifist Bishop', () => {
    rejected(moved('7k/6n1/8/8/8/4p3/1P4P1/2B1K3 w - - 7 3', 'c1', 'd2', s => pieceEffect(s, 'pacifism', 'c1')), 'e3');
  });
  it('cannot capture a Pacifist victim', () => {
    rejected(moved('7k/6n1/8/8/8/4p3/1P4P1/2B1K3 w - - 7 3', 'c1', 'd2', s => pieceEffect(s, 'pacifism', 'e3')), 'e3');
  });
  for (const to of ['e3', 'f4'] as SquareName[]) it(`Curse permits extra move to ${to}`, () => {
    const state = moved(FEN, 'c1', 'd2', s => pieceEffect(s, 'curse', 'c1'));
    assert.deepEqual(played(state, to).effects, state.effects);
  });
  it('Curse forbids a three-square extra move', () => {
    rejected(moved(FEN, 'c1', 'd2', s => pieceEffect(s, 'curse', 'c1')), 'g5');
  });
  for (const square of ['e3', 'f4'] as SquareName[]) it(`Forbidden City blocks destination or transit at ${square}`, () => {
    rejected(moved(FEN, 'c1', 'd2', s => locationEffect(s, 'forbidden-city', { square })), 'f4');
  });
  it('an unrelated Forbidden City allows the move', () => {
    played(moved(FEN, 'c1', 'd2', s => locationEffect(s, 'forbidden-city', { square: 'd4' })), 'f4');
  });
  it('Fortification blocks the second move boundary', () => {
    rejected(moved(FEN, 'c1', 'd2', s => locationEffect(s, 'fortification', { from: 'd2', to: 'e3' })), 'f4');
  });
  it('an unrelated Fortification allows the second move', () => {
    played(moved(FEN, 'c1', 'd2', s => locationEffect(s, 'fortification', { from: 'd4', to: 'e5' })), 'f4');
  });
  it('a first move arriving beside a magnet cannot be followed by Crusade', () => {
    const state = moved('7k/6n1/8/8/8/4n3/1P4P1/2B1K3 w - - 7 3', 'c1', 'd2', s => pieceEffect(s, 'fatal-attraction', 'e3'));
    rejected(state, 'c3');
  });
  it('a moved magnet expires before Crusade', () => {
    const state = moved(FEN, 'c1', 'd2', s => pieceEffect(s, 'fatal-attraction', 'c1'));
    assert.equal(state.effects.length, 0);
    assert.equal(played(state, 'e3').effects.length, 0);
  });
  it('a Crab remains a Pawn despite its diagonal movement', () => {
    const state = moved('7k/6n1/8/8/8/8/1P4P1/4K3 w - - 7 3', 'b2', 'c3', s => pieceEffect(s, 'crab', 'b2'));
    rejected(state, 'd4', 'c3');
  });
  for (const role of ['rook', 'pawn'] as const) it(`a Bishop-${role} composite retains both identities`, () => {
    const fen = role === 'rook' ? '7k/6n1/8/8/8/8/1P4P1/R1B1K3 w - - 7 3' : FEN;
    const state = moved(fen, 'c1', 'd2', s => {
      const bishop = s.pieces.find(piece => piece.square === 'c1')!;
      const component = s.pieces.find(piece => piece.square === (role === 'rook' ? 'a1' : 'b2'))!;
      component.zone = 'away'; component.square = null;
      locationEffect(s, 'confabulation', { pieceIds: [bishop.id, component.id] });
      s.fen = `${boardFen(s)} ${s.fen.split(' ').slice(1).join(' ')}`;
    });
    const after = played(state, role === 'rook' ? 'd4' : 'e3');
    assert.deepEqual(after.pieces.map(piece => piece.id).sort(), state.pieces.map(piece => piece.id).sort());
    assert.equal(after.pieces.filter(piece => piece.zone === 'away').length, 1);
    assert.equal(after.fen.split(' ')[4], role === 'pawn' ? '0' : '8');
  });
  it('Plots preserves the qualifying move while opening its saved window', () => {
    const state = moved(FEN, 'c1', 'd2', s => s.players.white.hand.push({ id: 'plots-copy', cardId: 'plots-within-plots' }));
    const plots = applyAction(state, { type: 'playCard', cardId: 'plots-within-plots' });
    assert.equal(plots.ok, true);
    const after = played(plots.state, 'e3');
    assert.equal(after.turn.moveMade, true);
    assert.equal(applyAction(after, { type: 'move', from: 'e3', to: 'f4' }).ok, false);
  });
  it('Plots before the Regular Move does not make Crusade eligible', () => {
    const state = createGameState({ fen: FEN, hands: { white: ['plots-within-plots', 'crusade'] } });
    const plots = applyAction(state, { type: 'playCard', cardId: 'plots-within-plots' });
    assert.equal(plots.ok, true);
    rejected(plots.state, 'd2', 'c1');
  });
});

function invariants(state: GameState, ids: string[]) {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  for (const piece of state.pieces) assert.equal(piece.square !== null, piece.zone === 'board');
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
}
describe('Crusade seeded integration', () => {
  for (let seed = 1; seed <= 20; seed++) it(`seed ${seed}: four real legal plies after successful Crusade`, () => {
    let random = seed;
    const pick = (length: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % length; };
    let state = moved();
    const ids = state.pieces.map(piece => piece.id).sort();
    state = played(state, (['e3', 'f4', 'g5', 'c3'] as SquareName[])[pick(4)]!);
    invariants(state, ids);
    assert.equal(isKingInCheck(state, 'white'), false);
    let plies = 0;
    for (; plies < 4; plies++) {
      const ended = applyAction(state, { type: 'endTurn' });
      assert.equal(ended.ok, true, `seed ${seed}, ply ${plies}: endTurn`);
      state = ended.state;
      const choices = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(choices.length > 0, `seed ${seed}, ply ${plies}: legal continuation`);
      const { from, to } = choices[pick(choices.length)]!;
      const piece = state.pieces.find(piece => piece.zone === 'board' && piece.square === from)!;
      const actor = state.turn.color;
      const action: GameAction = { type: 'move', from, to, ...(piece.role === 'pawn' && isPromotionSquare(state, piece.owner, to) ? { promotion: 'queen' } : {}) };
      const snapshot = structuredClone(state);
      const result = applyAction(state, action);
      assert.equal(result.ok, true, `seed ${seed}, ply ${plies}: chosen legal move`);
      assert.deepEqual(state, snapshot);
      state = result.state;
      invariants(state, ids);
      assert.equal(isKingInCheck(state, actor), false);
    }
    assert.equal(plies, 4);
  });
});
