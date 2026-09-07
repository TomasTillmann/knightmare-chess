import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'public action must not mutate input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, action.cardId);
  }
  return result.state;
}

function play(state: GameState, cardId: string, target: unknown): GameState {
  return act(state, { type: 'playCard', cardId, target });
}

function cardCount(state: GameState): number {
  return Object.values(state.players).reduce((sum, p) => sum + p.hand.length + p.deck.length + p.discard.length, 0)
    + state.effects.filter(effect => !!(effect as { card?: unknown }).card).length;
}

function invariant(state: GameState, initial: GameState) {
  assert.deepEqual(state.pieces.map(p => p.id).sort(), initial.pieces.map(p => p.id).sort());
  assert.equal(new Set(state.pieces.map(p => p.id)).size, state.pieces.length);
  for (const piece of state.pieces) assert.equal(piece.square !== null, piece.zone === 'board');
  const ranks: string[] = [];
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  for (let rank = 8; rank >= 1; rank--) {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const piece = state.pieces.find(p => p.zone === 'board' && p.square === `${file}${rank}`);
      if (!piece) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      row += piece.owner === 'white' ? symbols[piece.role].toUpperCase() : symbols[piece.role];
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  assert.equal(boardFen(state), ranks.join('/'));
  assert.equal(state.fen.split(' ')[0], ranks.join('/'));
  for (const color of ['white', 'black'] as const) {
    assert.equal(state.pieces.filter(p => p.owner === color && p.royal && p.zone === 'board').length, 1);
  }
  assert.equal(cardCount(state), cardCount(initial));
}

function opponentWall(fen: string, card: string, wall: { from: string; to: string }): GameState {
  const state = createGameState({ fen, turn: 'black', phase: 'afterMove', moveMade: true,
    hands: { black: ['fortification'], white: [card] } });
  return act(play(state, 'fortification', wall), { type: 'endTurn' });
}

for (const [from, to] of [
  ['a1', 'a2'], ['a2', 'a3'], ['a3', 'a4'], ['a4', 'a5'], ['a5', 'a6'],
  ['a6', 'a7'], ['a7', 'a8'], ['a2', 'b2'], ['b2', 'c2'], ['c2', 'd2'],
  ['d2', 'e2'], ['e2', 'f2'], ['f2', 'g2'], ['g2', 'h2'], ['c3', 'd4'],
]) {
  test(`Fortification retains an independent physical card at ${from}-${to}`, () => {
    const state = createGameState({
      fen: '7k/8/8/8/8/8/8/R6K w - - 0 1', phase: 'afterMove', moveMade: true,
      hands: { white: ['fortification'] }, decks: { white: ['crab'] },
    });
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'fortification', target: { from, to } });
    assert.equal(result.ok, true);
    assert.deepEqual(state, before);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, 'fortification');
    assert.equal(result.state.fen, state.fen);
    assert.deepEqual(result.state.pieces, state.pieces);
    assert.equal(result.state.effects.length, 1);
    assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['crab']);
    assert.equal(result.state.players.white.discard.length, 0);
  });
}

for (const fixture of [
  { card: 'ghostwalk', fen: '7k/8/8/8/8/P7/R7/7K w - - 0 1', from: 'a2', to: 'a6', wall: { from: 'a3', to: 'a4' }, allowed: false },
  { card: 'dubbing', fen: '7k/8/8/8/8/8/R7/7K w - - 0 1', from: 'a2', to: 'b4', wall: { from: 'a2', to: 'a3' }, allowed: true },
  { card: 'long-jump', fen: '7k/8/8/8/8/8/N7/7K w - - 0 1', from: 'a2', to: 'a5', wall: { from: 'a3', to: 'a4' }, allowed: true },
  { card: 'confabulation', fen: '7k/8/8/8/N7/8/R7/7K w - - 0 1', from: 'a2', to: 'a4', wall: { from: 'a2', to: 'a3' }, allowed: false },
]) {
  test(`${fixture.card} uses its actual movement permission at a Fortification`, () => {
    const action: GameAction = { type: 'playCard', cardId: fixture.card, target: [{ from: fixture.from, to: fixture.to }] };
    const control = createGameState({ fen: fixture.fen, hands: { white: [fixture.card] } });
    const controlResult = act(control, action);
    if (fixture.card === 'confabulation') {
      assert.equal(controlResult.effects.length, 1);
      assert.equal(controlResult.pieces.filter(p => p.zone === 'away').length, 1);
      assert.equal(controlResult.pieces.filter(p => p.zone === 'board' && p.square === fixture.to).length, 1);
    } else assert.equal(controlResult.pieces.find(p => p.id === control.pieces.find(p => p.square === fixture.from)?.id)?.square, fixture.to);
    const state = opponentWall(fixture.fen, fixture.card, fixture.wall);
    const before = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, before);
    assert.equal(result.ok, fixture.allowed);
    if (fixture.allowed) {
      assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
      assert.equal(result.state.history.at(-1)?.cardId, fixture.card);
      assert.equal(result.state.pieces.find(p => p.id === control.pieces.find(p => p.square === fixture.from)?.id)?.square, fixture.to);
      assert.equal(result.state.effects.length, 1);
    } else assert.deepEqual(result.state, state);
  });
}

test('Crab diagonal movement respects the wall while its other diagonal remains open', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/3P4/8/7K w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['crab'], black: ['fortification'] } });
  state = play(state, 'crab', 'd3');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  assert.equal(legalDests({ ...state, turn: { ...state.turn, color: 'white', phase: 'beforeMove', moveMade: false } }).get('d3')?.includes('e4'), true);
  state = play(state, 'fortification', { from: 'd3', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  assert.equal(legalDests(state).get('d3')?.includes('e4'), false);
  state = act(state, { type: 'move', from: 'd3', to: 'c4' });
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-d3')?.square, 'c4');
  assert.equal(state.effects.length, 2);
});

test('Peace Talks discards one physical wall and reopens its crossing', () => {
  let control = createGameState({ fen: '7k/8/8/8/8/3P4/8/7K w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['crab'], black: ['peace-talks'] } });
  control = play(control, 'crab', 'd3');
  const crabCard = (control.effects[0] as { card: { id: string } }).card.id;
  control = act(control, { type: 'endTurn' });
  control = act(control, { type: 'move', from: 'h8', to: 'g8' });
  assert.equal(play(control, 'peace-talks', crabCard).effects.length, 0);
  let state = opponentWall('7k/8/8/8/8/8/R7/7K w - - 0 1', 'peace-talks', { from: 'a3', to: 'a4' });
  assert.equal(legalDests(state).get('a2')?.includes('a5'), false);
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  const wallCard = (state.effects[0] as { card: { id: string } }).card.id;
  state = play(state, 'peace-talks', wallCard);
  assert.equal(state.effects.length, 0);
  assert.equal(state.players.black.discard.some(card => card.id === wallCard), true);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a5' });
  assert.equal(state.pieces.find(p => p.id === 'white-rook-a2')?.square, 'a5');
});

test('Earthquake leaves a wall on its fixed coordinates', () => {
  const fen = '7k/8/8/8/8/8/R7/7K w - - 0 1';
  const target = { direction: 'clockwise', promotions: [] };
  const control = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['earthquake'] } });
  assert.notEqual(play(control, 'earthquake', target).orientation, 0);
  let state = opponentWall(fen, 'earthquake', { from: 'a3', to: 'a4' });
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  const wall = structuredClone(state.effects[0]);
  state = play(state, 'earthquake', target);
  assert.deepEqual(state.effects[0], wall);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  assert.equal(legalDests(state).get('a2')?.includes('a5'), false);
  assert.equal(legalDests(state).get('a2')?.includes('b2'), true);
});

test('Fortification as a Continuing Effect may close the final escape and participate in mate', () => {
  const fen = '8/8/8/8/R7/1NK5/8/k7 w - - 0 1';
  const control = createGameState({ fen, turn: 'black' });
  assert.equal(isKingInCheck(control, 'black'), true);
  assert.deepEqual(legalDests(control).get('a1'), ['b1']);
  const initial = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['fortification'] } });
  const state = play(initial, 'fortification', { from: 'a1', to: 'b1' });
  assert.equal(state.effects.length, 1);
  assert.equal(isKingInCheck(state, 'black'), true);
  const blackTurn = { ...state, turn: { ...state.turn, color: 'black' as const, phase: 'beforeMove' as const, moveMade: false } };
  assert.equal(legalDests(blackTurn).get('a1')?.length ?? 0, 0);
  assert.equal(state.players.white.discard.length, 0);
});

test('Haunting Memories retains its own physical card as a second wall', () => {
  let control = createGameState({ fen: '7k/8/8/8/8/8/R7/7K w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['earthquake'], black: ['haunting-memories'] } });
  const rotation = { direction: 'clockwise', promotions: [] };
  control = play(control, 'earthquake', rotation);
  control = act(control, { type: 'endTurn' });
  control = act(control, { type: 'move', from: 'h8', to: 'g8' });
  assert.equal(play(control, 'haunting-memories', rotation).history.at(-1)?.copiedCardId, 'earthquake');
  let state = opponentWall('7k/8/8/8/8/8/R7/7K w - - 0 1', 'haunting-memories', { from: 'a3', to: 'a4' });
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  const copiedCard = state.players.white.hand[0].id;
  state = play(state, 'haunting-memories', { from: 'a4', to: 'a3' });
  assert.equal(state.effects.length, 2);
  assert.equal(state.effects.some(effect => (effect as { card: { id: string } }).card.id === copiedCard), true);
  assert.equal(state.players.white.discard.length, 0);
  assert.equal(state.history.at(-1)?.copiedCardId, 'fortification');
});

function fourPlies(state: GameState, initial: GameState, next: (length: number) => number, walls: number): GameState {
  invariant(state, initial);
  state = act(state, { type: 'endTurn' });
  let plies = 0;
  for (; plies < 4; plies++) {
    const choices = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
    assert.ok(choices.length > 0, 'every seeded trace must reach all four plies');
    const move = choices[next(choices.length)];
    const mover = state.turn.color;
    state = act(state, { type: 'move', from: move.from, to: move.to });
    assert.equal(state.history.at(-1)?.type, 'move');
    assert.equal(isKingInCheck(state, mover), false);
    assert.equal(state.effects.length, walls);
    invariant(state, initial);
    state = act(state, { type: 'endTurn' });
    invariant(state, initial);
  }
  assert.equal(plies, 4);
  assert.equal(state.history.filter(event => event.type === 'move').length, 4);
  return state;
}

for (let seed = 1; seed <= 20; seed++) {
  test(`seed ${seed}: four actual plies conserve state after Fortification`, () => {
    let random = seed;
    const next = (length: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % length; };
    const initial = createGameState({ fen: 'r5nk/8/8/8/8/8/8/R5NK w - - 0 1', phase: 'afterMove', moveMade: true,
      hands: { white: ['fortification', 'crab'], black: ['dubbing'] }, decks: { white: ['ghostwalk'], black: ['long-jump'] } });
    const file = 'abcdefgh'[next(8)];
    const rank = 2 + next(4);
    const savedRandom = random;
    fourPlies(initial, initial, next, 0);
    random = savedRandom;
    const state = play(initial, 'fortification', { from: `${file}${rank}`, to: `${file}${rank + 1}` });
    fourPlies(state, initial, next, 1);
  });
}
