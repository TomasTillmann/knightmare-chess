import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, PacifismEffect } from '../types.js';

function play(state: GameState, cardId: string, target?: unknown): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId, target });
  assert.deepEqual(state, before, 'card action preserves its input');
  assert.equal(result.ok, true, `${cardId} must be accepted`);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

for (const role of ['P', 'N', 'B', 'R', 'Q']) {
  const initial = () => createGameState({
    fen: `7k/6n1/8/8/8/8/1${role}4${role}1/R3K3 w - - 7 3`,
    hands: { white: ['plots-within-plots', 'pacifism', 'pacifism'] },
  });
  test(`Plots interactions: two retained Pacifisms on ${role}`, () => {
    let state = play(initial(), 'plots-within-plots');
    state = play(state, 'pacifism', 'b2');
    state = play(state, 'pacifism', 'g2');
    assert.equal(state.turn.cardPlays.white, 3);
    assert.equal(state.effects.filter(effect => (effect as PacifismEffect).type === 'pacifism').length, 2);
    assert.equal(state.players.white.hand.length, 0);
    assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['plots-within-plots']);
  });
  test(`Plots interactions: nonmoving ${role} cards retain the regular move`, () => {
    const before = initial();
    let state = play(before, 'plots-within-plots');
    state = play(state, 'pacifism', 'b2');
    state = play(state, 'pacifism', 'g2');
    assert.equal(state.fen, before.fen);
    assert.deepEqual(state.pieces, before.pieces);
    assert.equal(state.turn.moveMade, false);
    assert.equal(state.turn.phase, 'beforeMove');
    assert.ok(legalDests(state, false).size > 0);
  });
  test(`Plots interactions: invalid target preserves both ${role} allowances`, () => {
    let state = play(initial(), 'plots-within-plots');
    const invalid = applyAction(state, { type: 'playCard', cardId: 'pacifism', target: 'e1' });
    assert.equal(invalid.ok, false);
    assert.deepEqual(invalid.state, state);
    state = play(state, 'pacifism', 'b2');
    state = play(state, 'pacifism', 'g2');
    assert.equal(state.turn.cardPlays.white, 3);
  });
}

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}

function rejected(state: GameState, action: GameAction): void {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false, JSON.stringify(action));
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

function invariant(state: GameState, initial: GameState): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), initial.pieces.map(piece => piece.id).sort());
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  for (const piece of state.pieces) assert.equal(piece.square !== null, piece.zone === 'board');
  assert.equal(state.fen.split(' ')[0], boardFen(state));
  const fenColor = state.turn.moveMade ? (state.turn.color === 'white' ? 'black' : 'white') : state.turn.color;
  assert.equal(state.fen.split(' ')[1], fenColor[0]);
  assert.equal(state.fen.split(' ').length, 6);
  const cards = ['white', 'black'].flatMap(color => {
    const zones = state.players[color as 'white' | 'black'];
    return [...zones.hand, ...zones.deck, ...zones.discard].map(card => card.id);
  });
  for (const effect of state.effects as PacifismEffect[]) if (effect.card) cards.push(effect.card.id);
  assert.equal(new Set(cards).size, cards.length);
  assert.equal(cards.length, 3);
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Plots seeded integration ${seed}: real card effects and four legal plies`, () => {
    const role = ['P', 'N', 'B', 'R', 'Q'][seed % 5];
    const initial = createGameState({
      fen: `7k/1P4n1/8/8/8/8/1${role}4${role}1/R3K3 w - - 7 3`,
      hands: { white: ['plots-within-plots', 'pacifism', 'pacifism'] },
    });
    let state = play(initial, 'plots-within-plots');
    state = play(state, 'pacifism', 'b2');
    state = play(state, 'pacifism', 'g2');
    assert.equal(state.turn.cardPlays.white, 3);
    state = act(state, { type: 'move', from: 'a1', to: 'a2' });
    state = act(state, { type: 'endTurn' });
    let random = seed;
    let plies = 0;
    for (; plies < 4; plies++) {
      const moves = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(moves.length > 0, 'each seeded ply has a legal continuation');
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const promotionMove = seed % 5 === 0 ? moves.find(move => move.from === 'b7' && move.to === 'b8') : undefined;
      const move = promotionMove ?? moves[random % moves.length];
      const piece = state.pieces.find(candidate => candidate.square === move.from)!;
      const promotion = piece.role === 'pawn' && (move.to[1] === '1' || move.to[1] === '8') ? 'queen' : undefined;
      const actor = state.turn.color;
      state = act(state, { type: 'move', ...move, promotion });
      assert.equal(isKingInCheck(state, actor), false);
      if (promotion) assert.equal(state.pieces.find(candidate => candidate.id === piece.id)?.role, promotion);
      invariant(state, initial);
      state = act(state, { type: 'endTurn' });
      invariant(state, initial);
    }
    assert.equal(plies, 4);
    assert.equal(state.effects.length, 2);
  });
}

for (const color of ['white', 'black'] as const) {
  test(`Plots enables successive Long Jumps by the same ${color} Knight`, () => {
    const initial = createGameState({
      fen: color === 'white' ? '7k/6n1/8/8/8/8/1N4P1/R3K3 w - - 7 3' : '4k2r/1p4n1/8/8/8/8/1N6/K7 b - - 7 3',
      hands: { [color]: ['plots-within-plots', 'long-jump', 'long-jump'] },
    });
    let state = play(initial, 'plots-within-plots');
    const from = color === 'white' ? 'b2' : 'g7';
    const identity = state.pieces.find(piece => piece.square === from)!.id;
    state = play(state, 'long-jump', [{ from, to: 'd3' }]);
    state = play(state, 'long-jump', [{ from: 'd3', to: 'e3' }]);
    assert.equal(state.pieces.find(piece => piece.id === identity)?.square, 'e3');
    assert.equal(state.turn.cardPlays[color], 3);
    assert.equal(state.fen.split(' ')[4], '9');
    assert.equal(state.fen.split(' ')[5], color === 'white' ? '3' : '5');
    assert.equal(state.history.filter(event => event.cardId === 'long-jump' && event.movement?.length === 1).length, 2);
    rejected(state, { type: 'move', from: 'e3', to: 'f5' });
  });
}

for (const cardId of ['fatal-attraction', 'charge']) {
  test(`Plots does not manufacture ${cardId} timing from a nested Long Jump`, () => {
    let state = createGameState({ fen: '7k/6n1/8/8/8/8/1N4P1/R3K3 w - - 7 3', hands: { white: ['plots-within-plots', 'long-jump', cardId] } });
    state = play(state, 'plots-within-plots');
    state = play(state, 'long-jump', [{ from: 'b2', to: 'd3' }]);
    rejected(state, { type: 'playCard', cardId, target: cardId === 'fatal-attraction' ? 'd3' : [{ from: 'd3', to: 'f4' }] });
  });
}

test('Plots cannot create the first legal Squaring the Circle target', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/8/8/1N4P1/R3K3 w - - 7 3', hands: { white: ['plots-within-plots', 'long-jump', 'squaring-the-circle'] } });
  state = play(state, 'plots-within-plots');
  state = play(state, 'long-jump', [{ from: 'b2', to: 'a8' }]);
  rejected(state, { type: 'playCard', cardId: 'squaring-the-circle', target: [{ from: 'a1', to: 'h1' }] });
});

test('Plots eligibility follows physical hand cards, excluding identical replacement draws', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['plots-within-plots', 'pacifism'] }, decks: { white: ['pacifism', 'pacifism'] } });
  const original = state.players.white.hand[1].id;
  state = play(state, 'plots-within-plots');
  const drawn = state.players.white.hand.find(card => card.id !== original)!.id;
  rejected(state, { type: 'playCard', cardId: 'pacifism', cardInstanceId: drawn, target: 'b2' });
  state = act(state, { type: 'playCard', cardId: 'pacifism', cardInstanceId: original, target: 'b2' });
  assert.equal(state.turn.cardPlays.white, 2);
  rejected(state, { type: 'playCard', cardId: 'pacifism', cardInstanceId: drawn, target: 'g2' });
});

test('A nested physical Plots retains the unused outer play', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['plots-within-plots', 'plots-within-plots', 'pacifism', 'pacifism', 'pacifism'] } });
  state = play(state, 'plots-within-plots');
  state = play(state, 'plots-within-plots');
  for (const square of ['b2', 'g2', 'a1']) state = play(state, 'pacifism', square);
  assert.equal(state.turn.cardPlays.white, 5);
  assert.equal(state.effects.length, 3);
});

test('Plots waits for mandatory Abduction recall before the next eligible card', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['plots-within-plots', 'abduction', 'fatal-attraction'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = play(state, 'plots-within-plots');
  state = play(state, 'abduction', 'g7');
  rejected(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'a2' });
  rejected(state, { type: 'endTurn' });
  state = act(state, { type: 'revealAbduction' });
  state = act(state, { type: 'answerAbduction', player: 'black', owner: 'black', role: 'knight', square: 'g7' });
  state = play(state, 'fatal-attraction', 'a2');
  assert.equal(state.turn.cardPlays.white, 3);
  assert.ok(state.pieces.some(piece => piece.square === 'g7' && piece.zone === 'board'));
});

test('An ordinary move closes unused Plots plays instead of opening after-move permission', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['plots-within-plots', 'pacifism', 'fatal-attraction'] } });
  state = play(state, 'plots-within-plots');
  state = play(state, 'pacifism', 'b2');
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  rejected(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'a2' });
});

test('An opposing response Plots cannot pay for the active player', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['pacifism', 'fatal-attraction'], black: ['plots-within-plots'] } });
  state = play(state, 'pacifism', 'b2');
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = play(state, 'plots-within-plots', { player: 'black' });
  rejected(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'a2' });
  assert.equal(state.turn.cardPlays.black, 1);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'a2');
});
