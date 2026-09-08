import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction, cardPlayTargets } from '../reducer';
import type { GameAction, GameState } from '../types';

function play(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  return result.state;
}

function pendingRescue(): GameState {
  const repro = JSON.parse(readFileSync(new URL('../../../campaign/iterations/148.json', import.meta.url), 'utf8'));
  let state = createGameState(repro.initial);
  for (const step of repro.steps.slice(0, 49)) state = play(state, step.action);
  assert.equal(state.fen, 'r1bk2R1/2p1pppn/R3p3/4p2b/8/1P1P1N2/n1P2P1P/2BQKBr1 w - - 1 12');
  assert.ok(state.pendingRescue);
  return state;
}

const plots: GameAction = {
  type: 'playCard', cardId: 'plots-within-plots',
  cardInstanceId: 'black-deck-2-plots-within-plots', target: { player: 'black' },
};
const dungeon = (to: 'a1' | 'h1'): Extract<GameAction, { type: 'playCard' }> => ({
  type: 'playCard', cardId: 'dungeon', cardInstanceId: 'black-deck-0-dungeon',
  target: [{ from: 'g8', to }],
});

test('iteration 148: the already-held Dungeon can cure the temporary check directly', () => {
  const before = pendingRescue();
  assert.ok(cardPlayTargets(before, 'dungeon').some(target => JSON.stringify(target) === JSON.stringify(dungeon('h1').target)));
  const after = play(before, dungeon('h1'));
  assert.equal(after.pendingRescue, null);
  assert.equal(after.fen, 'r1bk4/2p1pppn/R3p3/4p2b/8/1P1P1N2/n1P2P1P/2BQKBrR w - - 1 12');
  assert.equal(play(after, { type: 'endTurn' }).turn.color, 'white');
});

test('iteration 148: Plots spends once and retains the board and rescue while opening its immediate allowance', () => {
  const before = pendingRescue();
  const after = play(before, plots);
  assert.equal(after.players.black.hand.some(card => card.id === plots.cardInstanceId), false);
  assert.deepEqual(after.players.black.deck, before.players.black.deck.slice(1));
  assert.deepEqual(after.players.black.discard, [...before.players.black.discard,
    before.players.black.hand.find(card => card.id === plots.cardInstanceId)]);
  assert.deepEqual(after.players.black.hand, [...before.players.black.hand.filter(card => card.id !== plots.cardInstanceId), before.players.black.deck[0]]);
  assert.equal(after.turn.cardPlays.black, 1);
  // §11.6 removes unsafe board effects; §17.3 Plots changes no board square and
  // opens an immediate sequence whose already-eligible Dungeon can cure check.
  assert.equal(after.fen, before.fen);
  assert.deepEqual(after.pieces, before.pieces);
  assert.deepEqual(after.pendingRescue, before.pendingRescue);
  assert.equal(after.turn.phase, 'afterMove');
  assert.equal(after.turn.moveMade, true);
  assert.deepEqual(after.plotsAllowances?.map(({ player, remaining, eligibleCards }) => ({ player, remaining, eligibleCards })),
    [{ player: 'black', remaining: 2, eligibleCards: ['black-deck-0-dungeon'] }]);
});

for (const to of ['a1', 'h1'] as const) {
  test(`iteration 148: Plots then Dungeon to ${to} cures check and permits the turn to end`, () => {
    const before = pendingRescue();
    const direct = play(before, dungeon(to));
    const afterPlots = play(before, plots);
    const afterDungeon = play(afterPlots, dungeon(to));
    assert.equal(afterDungeon.fen, direct.fen);
    assert.equal(afterDungeon.pendingRescue, null);
    assert.equal(afterDungeon.turn.cardPlays.black, 2);
    assert.equal(afterDungeon.players.black.discard.filter(card => card.id === 'black-deck-0-dungeon').length, 1);
    assert.deepEqual(afterDungeon.players.black.deck, before.players.black.deck.slice(2));
    assert.equal(afterDungeon.plotsAllowances?.[0]?.remaining, 1);
    const ended = play(afterDungeon, { type: 'endTurn' });
    assert.equal(ended.turn.color, 'white');
    assert.equal(ended.outcome, null);
  });
}
