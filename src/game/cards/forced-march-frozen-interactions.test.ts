import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { CardMove, Color, GameState } from '../types.js';

function fixture(color: Color = 'white'): GameState {
  const state = createGameState({
    fen: color === 'white' ? '7k/8/8/8/4K3/3P1P2/P1q5/8 w - - 0 1' : '7K/8/8/8/4k3/3p1p2/p1Q5/8 b - - 0 1',
    hands: { [color]: ['forced-march'] },
  });
  return state;
}

const left: CardMove = { from: 'd3', to: 'c3' };
const right: CardMove = { from: 'f3', to: 'g3' };
const free: CardMove = { from: 'a2', to: 'b2' };

function addMagnet(state: GameState, square: string): void {
  const piece = state.pieces.find(piece => piece.square === square)!;
  state.effects.push({ type: 'fatal-attraction', owner: piece.owner,
    card: { id: 'magnet-card', cardId: 'fatal-attraction' }, pieceId: piece.id });
}

function assertRejected(state: GameState, targets: CardMove[]): void {
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'forced-march', target: targets });
  assert.equal(result.ok, false, 'restricted movement must reject before self-check fizzle');
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

for (const color of ['white', 'black'] as const) {
  for (const targets of [[left], [left, right], [right, left]]) {
    test(`${color} rejects frozen targets ${JSON.stringify(targets)} beside own royal magnet`, () => {
      const state = fixture(color);
      addMagnet(state, 'e4');
      assertRejected(state, targets);
    });
  }
}

for (const targets of [[left], [left, free], [free, left]]) {
  test(`opponent nonroyal magnet rejects ${JSON.stringify(targets)} atomically before bishop self-check`, () => {
    const state = createGameState({
      fen: '7k/8/8/8/2b1r3/3P4/P7/5K2 w - - 0 1',
      hands: { white: ['forced-march'] },
    });
    addMagnet(state, 'e4');
    assertRejected(state, targets);
  });
}

for (const targets of [[left, free], [free, left], [right]]) {
  test(`own magnet rejects restricted/free selection ${JSON.stringify(targets)} without card spend`, () => {
    const state = fixture();
    addMagnet(state, 'e4');
    assertRejected(state, targets);
  });
}

for (const targets of [[left], [left, right], [right, left]]) {
  test(`otherwise legal targets ${JSON.stringify(targets)} expend card on self-check`, () => {
    const state = fixture();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'forced-march', target: targets });
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.pieces, before.pieces);
    assert.equal(result.state.players.white.hand.length, 0);
    assert.equal(result.state.players.white.discard.at(-1)?.cardId, 'forced-march');
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
    assert.deepEqual(state, before);
  });
}
