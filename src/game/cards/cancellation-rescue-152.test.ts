import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.ok(result.ok, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function fixture(cardId: string, color: Color = 'black') {
  const white = color === 'white';
  const rook: SquareName = white ? 'h1' : 'h8';
  const destination: SquareName = white ? 'h2' : 'h7';
  const king: SquareName = white ? 'd1' : 'd8';
  const unsafe: SquareName = white ? 'c1' : 'c8';
  let state = createGameState({
    fen: white ? '7k/8/8/8/8/b7/8/3K3R w - - 0 1' : '3k3r/8/B7/8/8/8/8/7K b - - 0 1',
    hands: { [color]: ['fortification'], [white ? 'black' : 'white']: [cardId] },
  });
  state = act(state, { type: 'move', from: rook, to: destination });
  state = act(state, { type: 'playCard', cardId });
  return { state, rook, destination, king, unsafe, color };
}

for (const cardId of ['chaos', 'knightmare', 'think-again']) {
  for (const color of ['white', 'black'] as const) {
    test(`${cardId}: failed ${color} Fortification rescue preserves canceled rook prohibition`, () => {
      const f = fixture(cardId, color);
      const forbidden = structuredClone(f.state.chaosForbidden);
      assert.ok(forbidden);
      assert.equal(forbidden.player, color);
      const originalFen = f.state.fen;
      const originalAllowances = structuredClone(f.state.turn.cardPlays);
      let state = act(f.state, { type: 'move', from: f.king, to: f.unsafe });
      assert.ok(state.pendingRescue);
      state = act(state, { type: 'playCard', cardId: 'fortification', target: { from: 'f3', to: 'f4' } });
      assert.equal(state.pieces.find(piece => piece.royal && piece.owner === color)?.square, f.king);
      assert.equal(state.turn.moveMade, false);
      assert.equal(state.fen, originalFen);
      assert.deepEqual(state.turn.cardPlays, { ...originalAllowances, [color]: originalAllowances[color] + 1 });
      assert.deepEqual(state.chaosForbidden, forbidden);
      assert.ok(!legalDests(state).get(f.rook)?.includes(f.destination));
      const repeat = applyAction(state, { type: 'move', from: f.rook, to: f.destination });
      assert.equal(repeat.ok, false);
      assert.deepEqual(repeat.state, state);
    });

    test(`${cardId}: successful ${color} wall rescue completes a different replacement`, () => {
      const f = fixture(cardId, color);
      let state = act(f.state, { type: 'move', from: f.king, to: f.unsafe });
      state = act(state, { type: 'playCard', cardId: 'fortification', target: color === 'white' ? { from: 'b2', to: 'c1' } : { from: 'b7', to: 'c8' } });
      assert.equal(state.pieces.find(piece => piece.royal && piece.owner === color)?.square, f.unsafe);
      assert.ok(!state.pendingRescue);
      assert.equal(state.turn.moveMade, true);
      assert.equal(state.players[color].hand.some(card => card.cardId === 'fortification'), false);
      assert.equal(act(state, { type: 'endTurn' }).turn.color, color === 'white' ? 'black' : 'white');
    });
  }

  test(`${cardId}: malformed rescue leaves pending replacement unchanged`, () => {
    const f = fixture(cardId);
    const state = act(f.state, { type: 'move', from: f.king, to: f.unsafe });
    const invalid = applyAction(state, { type: 'playCard', cardId: 'fortification', target: { from: 'f3', to: 'f3' } });
    assert.equal(invalid.ok, false);
    assert.deepEqual(invalid.state, state);
    assert.ok(invalid.state.pendingRescue);
    assert.ok(invalid.state.players.black.hand.some(card => card.cardId === 'fortification'));
  });
}
