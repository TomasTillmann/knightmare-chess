import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function cardIds(state: GameState) {
  return [
    ...Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]),
    ...state.effects.flatMap(effect => {
      const card = (effect as { card?: { id: string } }).card;
      return card ? [card] : [];
    }),
  ].map(card => card.id).sort();
}

function validate(state: GameState) {
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  for (const piece of state.pieces) assert.equal(piece.square !== null, piece.zone === 'board');
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  const ids = cardIds(state);
  assert.equal(new Set(ids).size, ids.length);
  for (const value of [...state.fen.split(' ').slice(4).map(Number), ...Object.values(state.turn.cardPlays)]) {
    assert.ok(Number.isInteger(value) && value >= 0);
  }
}

function step(state: GameState, action: GameAction) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions must not mutate their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  validate(result.state);
  assert.deepEqual(cardIds(result.state), cardIds(state), 'physical cards are conserved');
  assert.deepEqual(result.state.pieces.map(piece => piece.id).sort(), state.pieces.map(piece => piece.id).sort());
  if (action.type === 'endTurn') assert.equal(isKingInCheck(result.state, state.turn.color), false);
  return result.state;
}

const scenarios: Array<{ name: string; fen: string; from: SquareName; to: SquareName; seed: number; pacifism?: boolean }> = [
  { name: 'rook movement and card lifecycle', fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1', from: 'a2', to: 'd5', seed: 17 },
  { name: 'castling rights after the home rook leaves', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 7 12', from: 'a1', to: 'c3', seed: 39 },
  { name: 'en passant expires after the replacement move', fen: '4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 8', from: 'd5', to: 'b7', seed: 71 },
  { name: 'last-rank pawn keeps its identity without promotion', fen: '4k3/6P1/8/8/8/8/8/4K3 w - - 0 1', from: 'g7', to: 'h8', seed: 103 },
  { name: 'continuing Pacifism marker follows the moved piece', fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1', from: 'a2', to: 'd5', seed: 137, pacifism: true },
];

for (const scenario of scenarios) test(`Blessing seeded integration: ${scenario.name}`, () => {
  let state = createGameState({
    fen: scenario.fen,
    hands: { white: ['blessing', ...(scenario.pacifism ? ['pacifism'] : [])], black: ['blessing'] },
    decks: { white: ['blessing', 'blessing'], black: ['blessing', 'blessing'] },
  });
  const original = structuredClone(state.pieces.find(piece => piece.square === scenario.from)!);
  if (scenario.pacifism) {
    const card = state.players.white.hand.pop()!;
    state.effects.push({ type: 'pacifism', owner: 'white', card, pieceId: original.id });
  }
  const effects = structuredClone(state.effects);
  state = step(state, { type: 'playCard', cardId: 'blessing', target: [{ from: scenario.from, to: scenario.to }] });
  assert.deepEqual(state.pieces.find(piece => piece.id === original.id), { ...original, square: scenario.to });
  assert.deepEqual(state.effects, effects);
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.players.white.discard.filter(card => card.cardId === 'blessing').length, 1);
  assert.equal(state.fen.split(' ')[1], 'b');
  assert.equal(state.fen.split(' ')[3], '-');
  assert.deepEqual(state.enPassant, []);
  if (scenario.from === 'a1') assert.equal(state.fen.split(' ')[2], 'Kkq');
  state = step(state, { type: 'endTurn' });
  let seed = scenario.seed;
  let plies = 0;
  for (; plies < 6 && !state.outcome; plies++) {
    const moves = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
    assert.ok(moves.length > 0);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = moves[seed % moves.length];
    const pawn = state.pieces.find(piece => piece.square === move.from);
    const promotion = pawn?.role === 'pawn' && move.to[1] === (pawn.owner === 'white' ? '8' : '1');
    state = step(state, { type: 'move', ...move, ...(promotion ? { promotion: 'queen' } : {}) });
    state = step(state, { type: 'endTurn' });
  }
  assert.equal(plies, 6, 'each seeded scenario executes its full bounded continuation');
});
