import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction, cardPlayTargets } from '../reducer';
import type { Color, GameAction, GameState, SquareName } from '../types';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'public actions do not mutate their input');
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

function captureWindow(reactor: Color, reaction: 'revenge' | 'toll') {
  const attacker: Color = reactor === 'white' ? 'black' : 'white';
  const from: SquareName = attacker === 'black' ? 'd8' : 'd1';
  const to: SquareName = attacker === 'black' ? 'd4' : 'd5';
  const payment: SquareName = attacker === 'black' ? 'a7' : 'a2';
  let state = createGameState({
    fen: attacker === 'black'
      ? '3r3k/p7/8/8/3P4/8/8/7K b - - 11 3'
      : '7k/8/8/3p4/8/8/P7/3R3K w - - 11 3',
    hands: { [reactor]: ['plots-within-plots', reaction, 'riposte'] },
  });
  state = act(state, { type: 'move', from, to });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: reactor } });
  return { state, reactor, attacker, reaction, to, payment,
    victimId: `${reactor}-pawn-${to}`, attackerId: `${attacker}-rook-${from}`, paymentId: `${attacker}-pawn-${payment}` };
}

// Rules 17.3 preserve the initial Plots response window while validating current
// targets; 18.4 restores Riposte's original victim and captures its attacker.
// Observed regression: an independent Revenge/Toll capture removes Riposte
// from the public query, and playing it reports INVALID_TIMING.
for (const reactor of ['white', 'black'] as const) {
  for (const reaction of ['revenge', 'toll'] as const) {
    test(`${reactor}: ${reaction} then Riposte preserves independent capture`, () => {
      const f = captureWindow(reactor, reaction);
      let state = act(f.state, { type: 'playCard', cardId: reaction, target: f.payment });
      state = act(state, { type: 'playCard', cardId: 'riposte' });
      assert.equal(state.pieces.find(p => p.id === f.victimId)?.zone, 'board');
      assert.equal(state.pieces.find(p => p.id === f.victimId)?.square, f.to);
      assert.equal(state.pieces.find(p => p.id === f.attackerId)?.zone, 'captured');
      assert.equal(state.pieces.find(p => p.id === f.paymentId)?.zone, 'captured');
      for (const cardId of ['plots-within-plots', reaction, 'riposte']) {
        assert.equal(state.players[reactor].discard.filter(c => c.cardId === cardId).length, 1);
      }
      assert.equal(state.riposteLostMoves?.filter(player => player === reactor).length, 1);
    });

    test(`${reactor}: Riposte remains offered after ${reaction}`, () => {
      const f = captureWindow(reactor, reaction);
      const state = act(f.state, { type: 'playCard', cardId: reaction, target: f.payment });
      assert.ok(cardPlayTargets(state, 'riposte').includes(undefined));
      assert.equal(state.pieces.find(p => p.id === f.attackerId)?.square, f.to);
      assert.equal(state.pieces.find(p => p.id === f.victimId)?.zone, 'captured');
    });

    test(`${reactor}: ${reaction} and immediate Riposte each work independently`, () => {
      const f = captureWindow(reactor, reaction);
      const reactionState = act(f.state, { type: 'playCard', cardId: reaction, target: f.payment });
      assert.equal(reactionState.pieces.find(p => p.id === f.paymentId)?.zone, 'captured');
      assert.equal(reactionState.pieces.find(p => p.id === f.attackerId)?.square, f.to);
      assert.equal(reactionState.pieces.find(p => p.id === f.victimId)?.zone, 'captured');
      const riposteState = act(f.state, { type: 'playCard', cardId: 'riposte' });
      assert.equal(riposteState.pieces.find(p => p.id === f.victimId)?.zone, 'board');
      assert.equal(riposteState.pieces.find(p => p.id === f.victimId)?.square, f.to);
      assert.equal(riposteState.pieces.find(p => p.id === f.attackerId)?.zone, 'captured');
      assert.equal(riposteState.pieces.find(p => p.id === f.paymentId)?.square, f.payment);
      assert.equal(riposteState.pieces.find(p => p.id === f.paymentId)?.zone, 'board');
      assert.equal(riposteState.riposteLostMoves?.filter(player => player === reactor).length, 1);
    });
  }
}
