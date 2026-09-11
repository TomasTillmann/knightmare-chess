import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, SquareName } from '../types.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

const rescue = (state: State) => applied(state, {
  type: 'playCard',
  cardId: 'cowardice',
  target: [{ from: 'd4', to: 'e4' }],
});

function checkedTurn(color: Color, hand = ['pacifism', 'hidden-passage'], ordinaryEscape = false) {
  const opponent = color === 'black' ? 'white' : 'black';
  const square = (value: string) => (color === 'black' ? value : value[0] + String(9 - Number(value[1]))) as SquareName;
  const fen = color === 'black'
    ? ordinaryEscape ? 'k7/2Q5/8/2K5/7r/8/8/8 w - - 0 1' : 'k7/2Q5/2K5/8/7r/8/8/8 w - - 0 1'
    : ordinaryEscape ? '8/8/8/7R/2k5/8/2q5/K7 b - - 0 1' : '8/8/8/7R/8/2k5/2q5/K7 b - - 0 1';
  let state = createGameState({
    fen, hands: { [color]: hand, [opponent]: ['fog-of-war'] },
    decks: { [color]: ['hidden-passage', 'pacifism'] },
  });
  state = applied(state, { type: 'move', from: square('c7'), to: square('b7') });
  state = applied(state, { type: 'endTurn' });
  assert.equal(state.outcome, null);
  assert.equal(isKingInCheck(state, color), true);
  const escape: Action = { type: 'playCard', cardId: 'hidden-passage', target: [{ from: square('a8'), to: square('h8') }] };
  const spend: Action = { type: 'playCard', cardId: 'pacifism', target: square('h4') };
  return { state, opponent, square, escape, spend };
}

for (const color of ['black', 'white'] as const) {
  test(`${color}: apparent mate stays live while Hidden Passage can rescue`, () => {
    const { state, opponent, escape } = checkedTurn(color);
    assert.equal(legalDests(state, false).size, 0);
    assert.ok(cardPlayTargets(state, 'hidden-passage').length > 0);
    const rescued = applied(state, escape);
    assert.equal(rescued.outcome, null);
    assert.equal(isKingInCheck(rescued, color), false);
    assert.equal(applied(rescued, { type: 'endTurn' }).turn.color, opponent);
  });

  test(`${color}: spending the last rescue allowance mates and retains the resolved card`, () => {
    const { state, opponent, spend, escape } = checkedTurn(color);
    const before = structuredClone(state);
    const card = state.players[color].hand.find(held => held.cardId === 'pacifism')!;
    const spent = applied(state, spend);
    assert.deepEqual(state, before);
    assert.deepEqual(spent.outcome, { winner: opponent, reason: 'checkmate' });
    assert.equal(isKingInCheck(spent, color), true);
    assert.equal(legalDests(spent, false).size, 0);
    assert.equal(spent.turn.cardPlays[color], 1);
    assert.deepEqual(spent.pieces, before.pieces);
    assert.equal(spent.fen, before.fen);
    assert.deepEqual(spent.players[color].hand, [...before.players[color].hand.filter(held => held.id !== card.id), before.players[color].deck[0]]);
    assert.deepEqual(spent.players[color].deck, before.players[color].deck.slice(1));
    assert.deepEqual(spent.players[color].discard, before.players[color].discard);
    assert.deepEqual(spent.effects, [...before.effects, {
      type: 'pacifism', owner: color, card,
      pieceId: before.pieces.find(piece => piece.square === spend.target)!.id,
    }]);
    assert.equal(spent.history.at(-1)?.type, 'cardPlayed');
    assert.equal(spent.playedCards?.filter(played => played.cardInstanceId === card.id).length, 1);
    assert.equal(applyAction(spent, escape).ok, false);
    assert.equal(applyAction(spent, { type: 'endTurn' }).ok, false);
  });

  test(`${color}: spending a card preserves an ordinary escape from a nonmating check`, () => {
    const { state, spend, square, opponent } = checkedTurn(color, undefined, true);
    const spent = applied(state, spend);
    assert.equal(spent.outcome, null);
    assert.ok(legalDests(spent, false).get(square('a8'))?.includes(square('b7')));
    const moved = applied(spent, { type: 'move', from: square('a8'), to: square('b7') });
    assert.equal(applied(moved, { type: 'endTurn' }).turn.color, opponent);
  });

  test(`${color}: remaining Plots allowance keeps a genuine card rescue live`, () => {
    const { state, spend, escape, opponent } = checkedTurn(color, ['plots-within-plots', 'pacifism', 'hidden-passage']);
    const plots = applied(state, { type: 'playCard', cardId: 'plots-within-plots' });
    assert.equal(plots.outcome, null);
    const spent = applied(plots, spend);
    assert.equal(spent.outcome, null);
    assert.equal(spent.plotsAllowances?.[0].remaining, 1);
    const rescued = applied(spent, escape);
    assert.equal(isKingInCheck(rescued, color), false);
    assert.equal(applied(rescued, { type: 'endTurn' }).turn.color, opponent);
  });

  test(`${color}: exhausting Plots also mates despite rescue cards remaining in hand`, () => {
    const { state, spend, opponent } = checkedTurn(color, ['plots-within-plots', 'pacifism', 'pacifism', 'hidden-passage']);
    const plots = applied(state, { type: 'playCard', cardId: 'plots-within-plots' });
    const first = applied(plots, spend);
    assert.equal(first.outcome, null);
    const spent = applied(first, spend);
    assert.equal(spent.plotsAllowances?.[0].remaining, 0);
    assert.equal(spent.turn.cardPlays[color], 3);
    assert.deepEqual(spent.outcome, { winner: opponent, reason: 'checkmate' });
  });

  test(`${color}: the public Coup fixture mates when its last card allowance is wasted`, () => {
    const square = (value: string) => (color === 'black' ? value : value[0] + String(9 - Number(value[1]))) as SquareName;
    let state = createGameState({
      fen: color === 'black' ? 'Qnk5/8/1r6/4p3/8/8/8/4K3 b - - 0 1' : '4k3/8/8/8/4P3/1R6/8/qNK5 w - - 0 1',
      hands: { [color]: ['coup', 'pacifism', 'hidden-passage'] },
    });
    for (const action of [
      { type: 'move', from: square('c8'), to: square('d8') },
      { type: 'playCard', cardId: 'coup', target: square('e5') },
      { type: 'endTurn' },
      { type: 'move', from: square('a8'), to: square('d5') },
      { type: 'endTurn' },
    ] satisfies Action[]) state = applied(state, action);
    assert.equal(state.outcome, null);
    assert.equal(isKingInCheck(state, color), true);
    assert.equal(legalDests(state, false).size, 0);
    const rescued = applied(state, { type: 'playCard', cardId: 'hidden-passage', target: [{ from: square('e5'), to: square('h7') }] });
    assert.equal(isKingInCheck(rescued, color), false);
    assert.equal(applied(rescued, { type: 'endTurn' }).turn.color, color === 'black' ? 'white' : 'black');
    const spent = applied(state, { type: 'playCard', cardId: 'pacifism', target: square('b6') });
    assert.deepEqual(spent.outcome, { winner: color === 'black' ? 'white' : 'black', reason: 'checkmate' });
  });
}

test('Pacifism curing the actual check leaves a playable turn', () => {
  let state = createGameState({
    fen: '7k/6p1/8/8/8/8/R7/K7 b - - 0 1',
    hands: { white: ['pacifism'], black: ['neutrality'] },
  });
  state = applied(state, { type: 'move', from: 'g7', to: 'g6' });
  state = applied(state, { type: 'playCard', cardId: 'neutrality', target: 'a2' });
  state = applied(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(state, 'white'), true);
  const cured = applied(state, { type: 'playCard', cardId: 'pacifism', target: 'a2' });
  assert.equal(isKingInCheck(cured, 'white'), false);
  assert.equal(cured.outcome, null);
  const moved = applied(cured, { type: 'move', from: 'a1', to: 'b1' });
  assert.equal(applied(moved, { type: 'endTurn' }).turn.color, 'black');
});

test('a pending Doomsayer choice is resolved before exhausted-rescue adjudication', () => {
  let state = createGameState({
    fen: '1k2q2n/8/8/8/8/8/R7/4K3 w - - 0 1', hands: { white: ['doomsayer'] },
  });
  state = applied(state, { type: 'move', from: 'a2', to: 'a3' });
  state = applied(state, { type: 'playCard', cardId: 'doomsayer' });
  assert.equal(state.outcome, null);
  assert.ok(state.pendingRescue);
  assert.equal(state.pendingDoomsayer?.player, 'black');
  const queen = state.pieces.find(piece => piece.square === 'e8')!;
  state = applied(state, { type: 'namePiece', speaker: 'black', name: 'queen', losses: [{ effectId: state.pendingDoomsayer!.cardInstanceId, pieceId: queen.id }] });
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});

test('Fog can still counter the just-played card after exhausted-rescue mate', () => {
  const { state, spend } = checkedTurn('black');
  const spent = applied(state, spend);
  assert.deepEqual(spent.outcome, { winner: 'white', reason: 'checkmate' });
  const countered = applied(spent, { type: 'playCard', cardId: 'fog-of-war' });
  assert.deepEqual(countered.effects, state.effects);
  assert.equal(countered.turn.cardPlays.black, 1);
  assert.equal(countered.turn.cardPlays.white, 1);
  assert.deepEqual(countered.outcome, { winner: 'white', reason: 'checkmate' });
});

test('a fizzled after-move card cannot hard-lock a staged self-check turn', () => {
  let staged = createGameState({
    fen: '4r2k/8/8/8/3p4/8/P3B3/4K3 w - - 0 1',
    hands: { white: ['cowardice', 'disintegration'], black: [] },
  });
  staged.orientation = 90;
  staged = applied(staged, { type: 'move', from: 'e2', to: 'f3' });

  const nonRescue = applyAction(staged, {
    type: 'playCard',
    cardId: 'disintegration',
    target: 'a2',
  });

  if (!nonRescue.ok) {
    assert.equal(applied(rescue(staged), { type: 'endTurn' }).turn.color, 'black');
    return;
  }

  assert.equal(nonRescue.state.turn.moveMade, false, 'accepted fizzle must roll back the conditional move');
  const moved = applied(nonRescue.state, { type: 'move', from: 'e1', to: 'd1' });
  assert.equal(applied(moved, { type: 'endTurn' }).turn.color, 'black');
});
