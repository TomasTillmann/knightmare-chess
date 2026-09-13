import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, legalDests, isKingInCheck, activeDoomsayers } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

for (const color of ['black', 'white'] as const) {
  test(`${color}: Vendetta includes a capture rescued by Coup changing the King`, () => {
    const { state, from, to, at } = ready(color, 'pawn', 'coup');
    assert.ok(legalDests(state).get(at('h6'))?.includes(at('h8')));
    let next = act(state, { type: 'move', from, to });
    assert.ok(next.pendingRescue);
    assert.ok(isKingInCheck(next, color));
    next = act(next, { type: 'playCard', cardId: 'coup', target: to });
    assert.equal(isKingInCheck(next, color), false);
    assert.equal(next.pendingRescue, null);
    assert.equal(next.outcome, null);
    act(next, { type: 'endTurn' });
    assert.ok(legalDests(state).get(from)?.includes(to));
  });
}

for (const color of ['white', 'black'] as const) {
  for (const rescue of ['fortification', 'mystic-shield', 'challenge'] as const) {
  test(`${color}: Vendetta includes a King capture into check rescued by ${rescue}`, () => {
    const opponent = color === 'white' ? 'black' : 'white';
    const at = (square: string) => (color === 'white' ? square : square[0] + (9 - Number(square[1]))) as SquareName;
    let board = '2r4k/8/8/1p6/P7/8/2n5/3K4';
    if (color === 'black') board = board.split('/').reverse().join('/').replace(/[a-z]/gi,
      piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
    let state = createGameState({ fen: board + ' ' + opponent[0] + ' - - 0 1',
      hands: { [opponent]: ['vendetta'], [color]: [rescue] } });
    state = act(state, { type: 'move', from: at('h8'), to: at('g8') });
    state = act(state, { type: 'playCard', cardId: 'vendetta' });
    state = act(state, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('a4'))?.includes(at('b5')));
    let next = act(state, { type: 'move', from: at('d1'), to: at('c2') });
    assert.ok(next.pendingRescue);
    assert.ok(isKingInCheck(next, color));
    next = act(next, { type: 'playCard', cardId: rescue,
      target: rescue === 'challenge' ? at('b5')
        : rescue === 'mystic-shield' ? at('c2') : { from: at('c2'), to: at('c3') } });
    assert.equal(isKingInCheck(next, color), false);
    assert.equal(next.pendingRescue, null);
    assert.equal(next.outcome, null);
    act(next, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('d1'))?.includes(at('c2')));
  });
  }
}

for (const color of ['black', 'white'] as const) {
  test(`${color}: Vendetta includes a capture rescued by Fatal Attraction freezing the checker`, () => {
    const opponent = color === 'black' ? 'white' : 'black';
    const at = (square: string) => (color === 'black' ? square : square[0] + (9 - Number(square[1]))) as SquareName;
    let board = '4k3/6Qr/8/8/p7/1N6/8/3K4';
    if (color === 'white') board = board.split('/').reverse().join('/').replace(/[a-z]/gi,
      piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
    let state = createGameState({ fen: board + ' ' + opponent[0] + ' - - 0 1',
      hands: { [opponent]: ['vendetta'], [color]: ['fatal-attraction'] } });
    state = act(state, { type: 'move', from: at('g7'), to: at('h8') });
    state = act(state, { type: 'playCard', cardId: 'vendetta' });
    state = act(state, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('h7'))?.includes(at('h8')));
    let next = act(state, { type: 'move', from: at('a4'), to: at('b3') });
    assert.ok(next.pendingRescue);
    assert.ok(isKingInCheck(next, color));
    next = act(next, { type: 'playCard', cardId: 'fatal-attraction', target: at('h7') });
    assert.equal(isKingInCheck(next, color), false);
    assert.equal(next.pendingRescue, null);
    act(next, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('a4'))?.includes(at('b3')));
  });
}

for (const color of ['black', 'white'] as const) {
  test(`${color}: Vendetta includes a capture rescued by Anathema swapping the checker`, () => {
    const opponent = color === 'black' ? 'white' : 'black';
    const at = (square: string) => (color === 'black' ? square : square[0] + (9 - Number(square[1]))) as SquareName;
    let board = '4k3/1p1n4/2B5/4P3/8/8/8/2R4K';
    if (color === 'white') board = board.split('/').reverse().join('/').replace(/[a-z]/gi,
      piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
    let state = createGameState({ fen: board + ' ' + opponent[0] + ' - - 0 1',
      hands: { [opponent]: ['vendetta'], [color]: ['anathema'] } });
    state = act(state, { type: 'move', from: at('c1'), to: at('d1') });
    state = act(state, { type: 'playCard', cardId: 'vendetta' });
    state = act(state, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('b7'))?.includes(at('c6')));
    let next = act(state, { type: 'move', from: at('d7'), to: at('e5') });
    assert.ok(next.pendingRescue);
    assert.ok(isKingInCheck(next, color));
    next = act(next, { type: 'playCard', cardId: 'anathema', target: { bishop: at('c6'), rook: at('d1') } });
    assert.equal(isKingInCheck(next, color), false);
    assert.equal(next.pendingRescue, null);
    act(next, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('d7'))?.includes(at('e5')));
  });
}

for (const color of ['white', 'black'] as const) {
  test(`${color}: Vendetta includes a King capture with a legal voluntary Doomsayer rescue`, () => {
    const opponent = color === 'white' ? 'black' : 'white';
    const at = (square: string) => (color === 'white' ? square : square[0] + (9 - Number(square[1]))) as SquareName;
    let board = '2r4k/8/8/1p6/P7/8/2n5/3K4';
    if (color === 'black') board = board.split('/').reverse().join('/').replace(/[a-z]/gi,
      piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
    let state = createGameState({ fen: board + ' ' + opponent[0] + ' - - 0 1',
      hands: { [opponent]: ['vendetta'], [color]: ['doomsayer'] } });
    state = act(state, { type: 'move', from: at('h8'), to: at('g8') });
    state = act(state, { type: 'playCard', cardId: 'vendetta' });
    state = act(state, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('a4'))?.includes(at('b5')));
    let next = act(state, { type: 'move', from: at('d1'), to: at('c2') });
    assert.ok(next.pendingRescue);
    assert.ok(isKingInCheck(next, color));
    next = act(next, { type: 'playCard', cardId: 'doomsayer' });
    // The opponent voluntarily names the checking Rook: one legal completion suffices.
    next = act(next, { type: 'namePiece', speaker: opponent, name: 'rook',
      losses: [{ effectId: activeDoomsayers(next)[0].card.id, pieceId: `${opponent}-rook-${at('c8')}` }] });
    assert.equal(isKingInCheck(next, color), false);
    assert.equal(next.pendingRescue, null);
    act(next, { type: 'endTurn' });
    assert.ok(legalDests(state).get(at('d1'))?.includes(at('c2')));
  });
}

const layouts = {
  pawn: ['8/p7/1N6/8/3K4', 'a4'],
  bishop: ['8/b7/1N6/8/3K4', 'a4'],
  rook: ['8/8/rN6/8/3K4', 'a3'],
  knight: ['n7/8/1N6/8/3K4', 'a5'],
  queen: ['8/q7/1N6/8/3K4', 'a4'],
} as const;

function ready(color: Color = 'black', role: keyof typeof layouts = 'pawn', rescue: string | null = 'fortification', vendetta = true) {
  const opponent = color === 'black' ? 'white' : 'black';
  const at = (square: string) => (color === 'black' ? square : square[0] + (9 - Number(square[1]))) as SquareName;
  let board = '4k3/6Q1/7r/' + layouts[role][0];
  if (color === 'white') board = board.split('/').reverse().join('/').replace(/[a-z]/gi,
    piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
  let state = createGameState({ fen: board + ' ' + opponent[0] + ' - - 0 1',
    hands: { [opponent]: vendetta ? ['vendetta'] : [], [color]: rescue ? [rescue] : [] } });
  state = act(state, { type: 'move', from: at('g7'), to: at('h8') });
  if (vendetta) state = act(state, { type: 'playCard', cardId: 'vendetta' });
  state = act(state, { type: 'endTurn' });
  return { state, color, at, from: at(layouts[role][1]), to: at('b3') };
}

for (const color of ['black', 'white'] as const) {
  test(`${color}: Vendetta includes a capture that Fortification can rescue`, () => {
    const { state, from, to, at } = ready(color);
    assert.ok(legalDests(state).get(at('h6'))?.includes(at('h8')));
    let next = act(state, { type: 'move', from, to });
    assert.ok(isKingInCheck(next, color));
    next = act(next, { type: 'playCard', cardId: 'fortification', target: { from: at('e8'), to: at('f8') } });
    assert.equal(isKingInCheck(next, color), false);
    act(next, { type: 'endTurn' });
    assert.ok(legalDests(state).get(from)?.includes(to));
  });

  test(`${color}: Fortification rescue capture is generated without Vendetta`, () => {
    const { state, from, to } = ready(color, 'pawn', 'fortification', false);
    assert.ok(legalDests(state).get(from)?.includes(to));
    act(state, { type: 'move', from, to });
  });

  for (const [label, rescue, spent] of [
    ['no rescue card', null, false],
    ['before-move Man of Straw only', 'man-of-straw', false],
    ['already spent card allowance', 'fortification', true],
  ] as const) {
    test(`${color}: Vendetta excludes unsafe capture with ${label}`, () => {
      const prepared = ready(color, 'pawn', rescue);
      const { from, to, at } = prepared;
      const state = structuredClone(prepared.state);
      if (spent) state.turn.cardPlays[color] = 1;
      assert.ok(legalDests(state).get(at('h6'))?.includes(at('h8')));
      assert.equal(legalDests(state).get(from)?.includes(to) ?? false, false);
      const before = structuredClone(state);
      assert.equal(applyAction(state, { type: 'move', from, to }).ok, false);
      assert.deepEqual(state, before);
    });
  }
}
