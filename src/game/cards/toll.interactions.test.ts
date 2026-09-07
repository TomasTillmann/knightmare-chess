import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { ApplyResult, GameState } from '../types.js';

const game = (fen: string, hands: Record<string, string[]>): GameState =>
  createGameState({ fen, hands } as never);

const apply = (state: GameState, action: object): GameState => {
  const result = applyAction(state, action as never) as ApplyResult;
  assert.equal(result.ok, true);
  return (result as { ok: true; state: GameState }).state;
};

test('Toll uses the rotated frontier after clockwise Earthquake', () => {
    let state = game('4k3/8/8/8/3R4/8/1P6/4K3 b - - 0 1', {
      black: ['earthquake', 'toll'],
      white: [],
    });
    state = apply(state, { type: 'move', from: 'e8', to: 'e7' });
    state = apply(state, {
      type: 'playCard',
      cardId: 'earthquake',
      target: { direction: 'clockwise', promotions: [] },
    });
    state = apply(state, { type: 'endTurn' });
    assert.ok(legalDests(state).get('d4')?.includes('e4'));
    state = apply(state, { type: 'move', from: 'd4', to: 'e4' });

    const targets = cardPlayTargets(state, 'toll' as never);
    assert.ok(targets.includes(undefined));
    assert.ok(targets.includes('b2' as never));
});

test('declining Toll rewinds a Dubbing replacement move and returns Dubbing', () => {
    const before = game('4k3/8/8/8/8/2R5/1P6/4K3 w - - 0 1', {
      white: ['dubbing'],
      black: ['toll'],
    });
    let state = apply(before, {
      type: 'playCard',
      cardId: 'dubbing',
      target: [{ from: 'c3', to: 'd5' }],
    });
    state = apply(state, { type: 'playCard', cardId: 'toll' });

    assert.equal(boardFen(state), boardFen(before));
    assert.equal(state.turn.color, 'white');
    assert.equal(state.turn.phase, 'afterMove');
    assert.equal(state.turn.moveMade, true);
    assert.equal(state.turn.cardPlays.white, 1);
    assert.equal(state.turn.cardPlays.black, 1);
    assert.ok(state.players.white.hand.some((card) => card.cardId === 'dubbing'));
    assert.ok(!state.players.black.hand.some((card) => card.cardId === 'toll'));
    assert.ok(state.players.black.discard.some((card) => card.cardId === 'toll'));
    state = apply(state, { type: 'endTurn' });
    assert.equal(state.turn.color, 'black');
});

test('Toll is rejected after No Quarter closes the response window', () => {
    let state = game('4k3/8/8/3p4/4P3/8/P7/4K3 w - - 0 1', {
      white: ['no-quarter'],
      black: ['toll'],
    });
    state = apply(state, { type: 'move', from: 'e4', to: 'd5' });
    state = apply(state, { type: 'playCard', cardId: 'no-quarter' });

    const result = applyAction(state, {
      type: 'playCard',
      cardId: 'toll',
    } as never) as ApplyResult;
    assert.equal(result.ok, false);
});

test('Toll uses the rotated frontier after counterclockwise Earthquake', () => {
  let state = game('k7/8/8/8/4R3/8/1P6/4K3 b - - 0 1', {
    black: ['earthquake', 'toll'],
    white: [],
  });
  state = apply(state, { type: 'move', from: 'a8', to: 'a7' });
  state = apply(state, {
    type: 'playCard',
    cardId: 'earthquake',
    target: { direction: 'counterclockwise', promotions: [] },
  });
  state = apply(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('e4')?.includes('d4'));
  state = apply(state, { type: 'move', from: 'e4', to: 'd4' });
  assert.ok(cardPlayTargets(state, 'toll').includes(undefined));
  assert.ok(cardPlayTargets(state, 'toll').includes('b2'));
});

test('paying Toll preserves a Dubbing replacement move', () => {
  let state = game('4k3/8/8/8/8/2R5/1P6/4K3 w - - 0 1', {
    white: ['dubbing'],
    black: ['toll'],
  });
  state = apply(state, {
    type: 'playCard',
    cardId: 'dubbing',
    target: [{ from: 'c3', to: 'd5' }],
  });
  state = apply(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(boardFen(state), '4k3/8/8/3R4/8/8/8/4K3');
  assert.ok(state.players.white.discard.some((card) => card.cardId === 'dubbing'));
  assert.ok(state.players.black.discard.some((card) => card.cardId === 'toll'));
});

test('paying Toll preserves a Figure Dance crossing', () => {
  let state = game('8/3k4/8/8/8/8/PP6/4K2R w - - 0 1', {
    white: ['figure-dance'],
    black: ['toll'],
  });
  state = apply(state, { type: 'move', from: 'a2', to: 'a3' });
  state = apply(state, { type: 'playCard', cardId: 'figure-dance', target: [] });
  state = apply(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(boardFen(state), '7R/3k4/8/8/8/P7/8/4K3');
});

test('declining Toll rolls back the regular move and Figure Dance', () => {
  const before = game('8/3k4/8/8/8/8/PP6/4K2R w - - 0 1', {
    white: ['figure-dance'],
    black: ['toll'],
  });
  let state = apply(before, { type: 'move', from: 'a2', to: 'a3' });
  state = apply(state, { type: 'playCard', cardId: 'figure-dance', target: [] });
  state = apply(state, { type: 'playCard', cardId: 'toll' });
  assert.equal(boardFen(state), boardFen(before));
  assert.ok(state.players.white.hand.some((card) => card.cardId === 'figure-dance'));
  assert.equal(state.turn.color, 'white');
  state = apply(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'black');
});

test('Pacifism protects a Pawn from Toll payment', () => {
  let state = game('4k3/8/8/8/4P3/8/1P6/4K3 w - - 0 1', {
    white: ['pacifism'],
    black: ['toll'],
  });
  state = apply(state, { type: 'playCard', cardId: 'pacifism', target: 'b2' });
  state = apply(state, { type: 'move', from: 'e4', to: 'e5' });
  const targets = cardPlayTargets(state, 'toll');
  assert.ok(targets.includes(undefined));
  assert.ok(targets.includes('e5'));
  assert.ok(!targets.includes('b2'));
});

test('declining Toll rolls back Pacifism and returns its card', () => {
  const before = game('4k3/8/8/8/4P3/8/1P6/4K3 w - - 0 1', {
    white: ['pacifism'],
    black: ['toll'],
  });
  let state = apply(before, { type: 'playCard', cardId: 'pacifism', target: 'b2' });
  state = apply(state, { type: 'move', from: 'e4', to: 'e5' });
  state = apply(state, { type: 'playCard', cardId: 'toll' });
  assert.equal(boardFen(state), boardFen(before));
  assert.equal(state.effects.length, 0);
  assert.ok(state.players.white.hand.some((card) => card.cardId === 'pacifism'));
});

test('Truce blocks every Toll payment but keeps decline', () => {
  let state = game('4k3/8/8/8/4P3/8/1P6/4K3 w - - 0 1', {
    white: [],
    black: ['toll'],
  });
  state.effects = [
    { type: 'truce', owner: 'white', card: { id: 'fixture-truce', cardId: 'truce' } },
  ];
  state = apply(state, { type: 'move', from: 'e4', to: 'e5' });
  assert.deepEqual(cardPlayTargets(state, 'toll'), [undefined]);
});

test('Mystic Shield protects its Pawn from Toll payment', () => {
  let state = game('4k3/8/8/8/4P3/8/1P6/4K3 w - - 0 1', {
    white: [],
    black: ['toll'],
  });
  const pawn = state.pieces.find((piece) => piece.square === 'b2')!;
  state.effects = [
    {
      type: 'mystic-shield',
      owner: 'white',
      card: { id: 'fixture-shield', cardId: 'mystic-shield' },
      pieceId: pawn.id,
    },
  ];
  state = apply(state, { type: 'move', from: 'e4', to: 'e5' });
  const targets = cardPlayTargets(state, 'toll');
  assert.ok(targets.includes(undefined));
  assert.ok(targets.includes('e5'));
  assert.ok(!targets.includes('b2'));
});

test('Revenge consumes the opponent response allowance before Toll', () => {
  let state = game('7k/8/8/p7/R7/8/1P6/7K w - - 0 1', {
    white: [],
    black: ['revenge', 'toll'],
  });
  state = apply(state, { type: 'move', from: 'a4', to: 'a5' });
  state = apply(state, { type: 'playCard', cardId: 'revenge', target: 'b2' });
  const result = applyAction(state, { type: 'playCard', cardId: 'toll' } as never);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'CARD_ALREADY_PLAYED');
});

test('declining Toll restores a captured frontier Pawn', () => {
  const before = game('4k3/8/8/3p4/4P3/8/P7/4K3 w - - 0 1', {
    white: [],
    black: ['toll'],
  });
  let state = apply(before, { type: 'move', from: 'e4', to: 'd5' });
  state = apply(state, { type: 'playCard', cardId: 'toll' });
  assert.equal(boardFen(state), boardFen(before));
  assert.ok(state.pieces.some((piece) => piece.owner === 'black' && piece.square === 'd5'));
});

test('declining Toll reverses Figure Dance promotion', () => {
  const before = game('8/3k4/8/8/8/8/PP6/4K2P w - - 0 1', {
    white: ['figure-dance'],
    black: ['toll'],
  });
  let state = apply(before, { type: 'move', from: 'a2', to: 'a3' });
  state = apply(state, {
    type: 'playCard',
    cardId: 'figure-dance',
    target: [{ square: 'h8', role: 'queen' }],
  });
  state = apply(state, { type: 'playCard', cardId: 'toll' });
  assert.equal(boardFen(state), boardFen(before));
  const pawn = state.pieces.find((piece) => piece.square === 'h1')!;
  assert.equal(pawn.role, 'pawn');
  assert.equal(pawn.promoted, false);
});

test('a neutral Pawn can pay Toll', () => {
  let state = game('4k3/8/8/8/3R4/8/1P6/4K3 w - - 0 1', {
    white: [],
    black: ['toll'],
  });
  const pawn = state.pieces.find((piece) => piece.square === 'b2')!;
  pawn.neutral = true;
  state = apply(state, { type: 'move', from: 'd4', to: 'd5' });
  assert.ok(cardPlayTargets(state, 'toll').includes('b2'));
  state = apply(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(state.pieces.find((piece) => piece.id === pawn.id)?.zone, 'captured');
});

test('ending a Toll-declined turn advances to the responder', () => {
  let state = game('4k3/8/8/8/3R4/8/1P6/4K3 w - - 0 1', {
    white: [],
    black: ['toll'],
  });
  state = apply(state, { type: 'move', from: 'd4', to: 'd5' });
  state = apply(state, { type: 'playCard', cardId: 'toll' });
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'afterMove');
  state = apply(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'black');
});
