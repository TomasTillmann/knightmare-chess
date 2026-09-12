import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction, cardPlayTargets } from '../reducer';
import type { Color, GameAction, GameState } from '../types';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

function neutralSplitWindow(color: Color): GameState {
  const opponent = color === 'white' ? 'black' : 'white';
  let state = createGameState({
    fen: color === 'white'
      ? '7k/8/3p1p2/2P5/4N3/2P5/8/7K b - - 0 1'
      : '7k/8/3P1P2/2p5/4n3/2p5/8/7K w - - 0 1',
    hands: { [color]: ['split-knight'], [opponent]: ['neutrality'] },
  });
  state = act(state, { type: 'move', from: opponent === 'black' ? 'h8' : 'h1', to: opponent === 'black' ? 'g8' : 'g1' });
  state = act(state, { type: 'playCard', cardId: 'neutrality', target: 'e4' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, color);
  assert.equal(state.pieces.find(piece => piece.id === `${color}-knight-e4`)?.neutral, true);
  return state;
}

for (const color of ['white', 'black'] as const) {
  // Split Knight and rules 22.3 require opponent victims even when rules 15.1
  // let the neutral attacker capture either color during an ordinary move.
  for (const targets of [['c5', 'd6'], ['c3', 'c5']]) {
    test(`${color}: neutral Split Knight rejects friendly victims ${targets.join(',')}`, () => {
      const state = neutralSplitWindow(color);
      const original = structuredClone(state);
      const result = applyAction(state, {
        type: 'playCard', cardId: 'split-knight', target: { knight: 'e4', targets },
      });
      assert.deepEqual(state, original, 'the input state is immutable');
      assert.equal(result.ok, false, 'Split Knight cannot choose friendly victims');
      assert.deepEqual(result.state, original, 'rejection preserves the original state');
    });
  }

  test(`${color}: neutral Split Knight query excludes friendly victims`, () => {
    const state = neutralSplitWindow(color);
    const targets = cardPlayTargets(state, 'split-knight');
    assert.ok(targets.length > 0, 'the genuine opponent pair remains available');
    for (const target of targets) {
      const split = target as { knight: string; targets: string[] };
      assert.equal(split.targets.some(square => square === 'c3' || square === 'c5'), false);
    }
  });

  test(`${color}: neutral Split Knight captures opponent pair and preserves friendly pawns`, () => {
    const state = neutralSplitWindow(color);
    const next = act(state, {
      type: 'playCard', cardId: 'split-knight',
      target: { knight: 'e4', targets: ['d6', 'f6'] },
    });
    const opponent = color === 'white' ? 'black' : 'white';
    for (const square of ['d6', 'f6']) {
      assert.equal(next.pieces.find(piece => piece.id === `${opponent}-pawn-${square}`)?.zone, 'captured');
    }
    for (const square of ['c3', 'c5']) {
      assert.deepEqual(
        next.pieces.find(piece => piece.id === `${color}-pawn-${square}`),
        state.pieces.find(piece => piece.id === `${color}-pawn-${square}`),
      );
    }
  });

  test(`${color}: ordinary neutral Knight capture still permits a friendly pawn`, () => {
    const state = neutralSplitWindow(color);
    const next = act(state, { type: 'move', from: 'e4', to: 'c5' });
    assert.equal(next.pieces.find(piece => piece.id === `${color}-pawn-c5`)?.zone, 'captured');
    assert.equal(next.pieces.find(piece => piece.id === `${color}-knight-e4`)?.square, 'c5');
  });
}
