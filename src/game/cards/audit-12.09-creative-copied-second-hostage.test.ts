// Unfixed engine audit regression, 12.09.2026.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function piece(state: GameState, id: string) {
  const result = state.pieces.find(candidate => candidate.id === id);
  assert.ok(result, `Missing physical piece ${id}`);
  return result;
}

function fixture(color: Color, copy = true, knightFirst = false) {
  const opponent: Color = color === 'white' ? 'black' : 'white';
  const square = (value: string) => (color === 'white' ? value : value[0] + (9 - Number(value[1]))) as SquareName;
  const original = '4r2k/1p6/n7/8/4N3/3B4/2PP4/R6K';
  const board = color === 'white' ? original : original.split('/').reverse().join('/').replace(/[a-zA-Z]/g,
    character => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase());
  let state = createGameState({ fen: `${board} ${color === 'white' ? 'w' : 'b'} - - 0 1`,
    hands: { [color]: ['confabulation', 'plots-within-plots', 'hostage', copy ? 'haunting-memories' : 'hostage'],
      [opponent]: ['hostage'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: square('d3'), to: square('e4') }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('h8'), to: square('g8') });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('a1'), to: square('a6') });
  state = act(state, { type: 'playCard', cardId: 'hostage',
    target: { pieceId: `${opponent}-knight-${square('a6')}`, pawn: square('b7') } });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('e8'), to: square('e4') });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: color } });
  const bishopId = `${color}-bishop-${square('d3')}`;
  const knightId = `${color}-knight-${square('e4')}`;
  const firstId = knightFirst ? knightId : bishopId;
  const secondId = knightFirst ? bishopId : knightId;
  const firstAction: GameAction = { type: 'playCard', cardId: 'hostage', target: { pieceId: firstId, pawn: square('c2') } };
  const secondTarget = { pieceId: secondId, pawn: square('d2') };
  const secondAction: GameAction = { type: 'playCard', cardId: copy ? 'haunting-memories' : 'hostage', target: secondTarget };
  return { state, square, firstId, secondId, firstAction, secondAction, secondTarget,
    copyId: `${color}-hand-3-haunting-memories` };
}

for (const color of ['white', 'black'] as const) {
  for (const knightFirst of [false, true]) {
    // Observed: INVALID_TARGET, no eligible last card. Rules 17.3/22.7/22.11
    // preserve the capture window and permit the other physical component back.
    test(`${color}: copied second Hostage returns ${knightFirst ? 'Bishop' : 'Knight'}`, () => {
      const setup = fixture(color, true, knightFirst);
      const afterFirst = act(setup.state, setup.firstAction);
      const afterSecond = act(afterFirst, setup.secondAction);
      assert.equal(piece(afterSecond, setup.firstId).square, setup.square('c2'));
      assert.equal(piece(afterSecond, setup.secondId).square, setup.square('d2'));
      assert.equal(piece(afterSecond, setup.firstId).zone, 'board');
      assert.equal(piece(afterSecond, setup.secondId).zone, 'board');
    });
  }

  // The public query must advertise the same remaining-component move as play.
  test(`${color}: copied second Hostage advertises its remaining target`, () => {
    const setup = fixture(color);
    const afterFirst = act(setup.state, setup.firstAction);
    assert.ok(cardPlayTargets(afterFirst, 'haunting-memories').some(target =>
      target !== null && typeof target === 'object' && 'pieceId' in target && 'pawn' in target
      && target.pieceId === setup.secondTarget.pieceId && target.pawn === setup.secondTarget.pawn));
  });

  // Control: two physical Hostages can independently return captured components.
  test(`${color}: two ordinary Hostages return distinct composite components`, () => {
    const setup = fixture(color, false);
    const afterSecond = act(act(setup.state, setup.firstAction), setup.secondAction);
    assert.equal(piece(afterSecond, setup.firstId).square, setup.square('c2'));
    assert.equal(piece(afterSecond, setup.secondId).square, setup.square('d2'));
    assert.equal(piece(afterSecond, setup.firstId).zone, 'board');
    assert.equal(piece(afterSecond, setup.secondId).zone, 'board');
  });

  // Control: Plots recorded this physical copy card while a prior Hostage existed;
  // spending the first Hostage returns exactly one original physical component.
  test(`${color}: copy starts eligible and first Hostage leaves one component captured`, () => {
    const setup = fixture(color);
    assert.ok(setup.state.plotsAllowances?.some(allowance => allowance.eligibleCards.includes(setup.copyId)));
    const afterFirst = act(setup.state, setup.firstAction);
    assert.equal(piece(afterFirst, setup.firstId).square, setup.square('c2'));
    assert.equal(piece(afterFirst, setup.firstId).zone, 'board');
    assert.equal(piece(afterFirst, setup.secondId).zone, 'captured');
  });
}
