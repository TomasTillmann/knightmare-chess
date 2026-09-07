import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function step(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'action must not mutate its input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  valid(result.state, inventory(state));
  assert.deepEqual(result.state.pieces.map(piece => piece.id).sort(), state.pieces.map(piece => piece.id).sort());
  return result.state;
}

function inventory(state: GameState) {
  return ['white', 'black'].flatMap(owner => {
    const player = state.players[owner as 'white' | 'black'];
    return [...player.hand, ...player.deck, ...player.discard].map(card => `${owner}:${card.id}`);
  }).concat(state.effects.flatMap(effect => {
    const item = effect as { owner: string; card?: { id: string } };
    return item.card ? [`${item.owner}:${item.card.id}`] : [];
  })).sort();
}

function valid(state: GameState, cards: string[]) {
  assert.deepEqual(inventory(state), cards);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  for (const piece of board) assert.match(piece.square!, /^[a-h][1-8]$/);
  for (const owner of ['white', 'black']) {
    assert.equal(board.filter(piece => piece.owner === owner && piece.royal).length, 1);
  }
  for (const piece of state.pieces.filter(piece => piece.zone !== 'board')) assert.equal(piece.square, null);
  assert.equal(state.fen.split(' ')[0], boardFen(state).split(' ')[0]);
  if (!state.turn.moveMade) assert.equal(state.fen.split(' ')[1], state.turn.color[0]);
}

function randomTurns(state: GameState, seed: number, count: number, cards: string[]) {
  for (let i = 0; i < count && !state.outcome; i++) {
    const choices = [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => ({ type: 'move' as const, from, to })));
    assert.ok(choices.length);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const ordered = choices.slice(seed % choices.length).concat(choices.slice(0, seed % choices.length));
    let completed: GameState | undefined;
    for (const move of ordered) {
      const moved = step(state, move);
      const ended = applyAction(moved, { type: 'endTurn' });
      if (ended.ok) {
        assert.equal(isKingInCheck(ended.state, state.turn.color), false);
        completed = step(moved, { type: 'endTurn' });
        break;
      }
    }
    assert.ok(completed, 'a complete legal turn exists');
    state = completed;
    valid(state, cards);
  }
  return state;
}

test('seeded ordinary play preserves physical cards, board invariants and legal completed turns', () => {
  let state = createGameState({ hands: { white: ['truce'] }, decks: { white: ['pacifism'] } });
  const cards = inventory(state);
  state = step(state, { type: 'move', from: 'a2', to: 'a3' });
  state = step(state, { type: 'playCard', cardId: 'truce' });
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.history.at(-1)?.cardId, 'truce');
  state = step(state, { type: 'endTurn' });
  randomTurns(state, 0x74727563, 4, cards);
});

test('checking move expires Truce and allows a legal capturing response', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/6R1/K7 w - - 0 1', hands: { white: ['truce'] } });
  const cards = inventory(state);
  state = step(state, { type: 'move', from: 'a1', to: 'a2' });
  state = step(state, { type: 'playCard', cardId: 'truce' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'h8', to: 'h7' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'g2', to: 'g7' });
  assert.equal(state.effects.length, 0);
  assert.equal(isKingInCheck(state, 'black'), true);
  state = step(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('h7')?.includes('g7'));
  state = step(state, { type: 'move', from: 'h7', to: 'g7' });
  state = step(state, { type: 'endTurn' });
  valid(state, cards);
});

test('two physical Truces cancel independently through Peace Talks', () => {
  let state = createGameState({ hands: { white: ['truce', 'peace-talks', 'pacifism'], black: ['truce'] } });
  const pacifism = state.players.white.hand.pop()!;
  state.effects.push({ type: 'pacifism', owner: 'white', card: pacifism, pieceId: state.pieces.find(piece => piece.square === 'h2')!.id });
  const cards = inventory(state);
  const whiteTruce = state.players.white.hand[0]!.id;
  state = step(state, { type: 'move', from: 'a2', to: 'a3' });
  state = step(state, { type: 'playCard', cardId: 'truce' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'a7', to: 'a6' });
  state = step(state, { type: 'playCard', cardId: 'truce' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'b2', to: 'b3' });
  assert.ok(cardPlayTargets(state, 'peace-talks').includes(whiteTruce));
  state = step(state, { type: 'playCard', cardId: 'peace-talks', target: whiteTruce });
  assert.equal(state.effects.length, 2);
  assert.ok(state.effects.some(effect => (effect as { card: { id: string } }).card.id === pacifism.id));
  assert.ok(state.players.white.discard.some(card => card.id === whiteTruce));
  state = step(state, { type: 'endTurn' });
  randomTurns(state, 71, 2, cards);
});

test('Truce prohibits capture but permits Disintegration death', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/1p6/R1P5/K7 w - - 0 1', hands: { white: ['truce'], black: ['disintegration'] } });
  const cards = inventory(state);
  state = step(state, { type: 'move', from: 'c2', to: 'c3' });
  state = step(state, { type: 'playCard', cardId: 'truce' });
  state = step(state, { type: 'endTurn' });
  assert.equal(legalDests(state).get('b3')?.includes('a2') ?? false, false);
  const withoutTruce = structuredClone(state);
  withoutTruce.effects = [];
  assert.ok(legalDests(withoutTruce).get('b3')?.includes('a2'));
  const beforeCapture = structuredClone(state);
  const rejected = applyAction(state, { type: 'move', from: 'b3', to: 'a2' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(state, beforeCapture);
  assert.deepEqual(rejected.state, beforeCapture);
  const pawnId = state.pieces.find(piece => piece.square === 'b3')!.id;
  state = step(state, { type: 'playCard', cardId: 'disintegration', target: 'b3' });
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'dead');
  assert.equal(state.effects.length, 1);
  randomTurns(state, 99, 4, cards);
});

test('a regular card cannot expose immediate mate when ending Truce', () => {
  let state = createGameState({ fen: 'k7/2K5/8/8/8/8/P7/R7 w - - 0 1', hands: { white: ['disintegration'] } });
  state.effects = [{ type: 'truce', owner: 'black', card: { id: 'probe-truce', cardId: 'truce' } }];
  const cards = inventory(state);
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  assert.deepEqual(state, before);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
  state = result.state;
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.effects, before.effects);
  assert.equal(state.players.white.hand.length, 0);
  assert.equal(state.players.white.discard.length, 1);
  assert.equal(state.turn.cardPlays.white, 1);
  valid(state, cards);
  state = step(state, { type: 'move', from: 'c7', to: 'c6' });
  state = step(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(state, 'white'), false);
});
