import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

const card = 'man-of-straw';
for (const color of ['white', 'black'] as const) {
  for (const selection of [...'abcdfgh', 'neutral']) {
    test(`Man of Straw ${color} preserves swap state for ${selection}`, () => {
      const neutral = selection === 'neutral';
      const kingSquare = color === 'white' ? 'e1' : 'e8';
      const pawnSquare = `${neutral ? 'a' : selection}${color === 'white' ? '2' : '7'}`;
      const fen = color === 'white'
        ? `4r2k/8/8/8/8/8/${neutral ? 'pPPP1PPP' : 'PPPP1PPP'}/4K3 w - - 7 3`
        : `4k3/${neutral ? 'Pppp1ppp' : 'pppp1ppp'}/8/8/8/8/8/4R2K b - - 7 3`;
      const state = createGameState({ fen, hands: { [color]: [card] }, decks: { [color]: ['crab'] } });
      const king = state.pieces.find(piece => piece.square === kingSquare)!;
      const pawn = state.pieces.find(piece => piece.square === pawnSquare)!;
      if (neutral) pawn.neutral = true;
      const before = structuredClone(state);
      assert.equal(isKingInCheck(state, color), true);
      const result = applyAction(state, { type: 'playCard', cardId: card, target: { king: kingSquare, pawn: pawnSquare } });
      assert.equal(result.ok, true);
      const next = result.state;
      assert.equal(next.history.at(-1)?.type, 'cardPlayed');
      assert.equal(next.history.at(-1)?.cardId, card);
      assert.deepEqual(next.pieces.find(piece => piece.id === king.id), { ...king, square: pawnSquare });
      assert.deepEqual(next.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: kingSquare });
      assert.equal(isKingInCheck(next, color), false);
      assert.equal(next.turn.color, color);
      assert.equal(next.turn.phase, 'beforeMove');
      assert.equal(next.turn.moveMade, false);
      assert.equal(next.turn.cardPlays[color], 1);
      assert.deepEqual(next.players[color].hand.map(item => item.cardId), ['crab']);
      assert.deepEqual(next.players[color].discard.map(item => item.cardId), [card]);
      assert.equal(next.players[color].deck.length, 0);
      assert.deepEqual(next.fen.split(' ').slice(4), ['7', '3']);
      assert.deepEqual(state, before);
    });
  }
}

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, action.cardId);
  }
  return result.state;
}

for (const effect of ['pacifism', 'crab', 'man-trap', 'fatal-attraction']) {
  test(`Man of Straw ${effect === 'fatal-attraction' ? 'expires' : 'preserves'} actual ${effect} continuing effect`, () => {
    let state = createGameState({
      fen: '5r1k/8/8/8/8/8/PP6/4K1N1 w - - 7 3',
      hands: { white: [effect, card] },
    });
    const playEffect: GameAction = { type: 'playCard', cardId: effect, target: 'a2' };
    if (effect === 'pacifism') state = act(state, playEffect);
    state = act(state, { type: 'move', from: 'g1', to: 'h3' });
    if (effect !== 'pacifism') state = act(state, playEffect);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'f8', to: 'e8' });
    state = act(state, { type: 'endTurn' });
    assert.equal(isKingInCheck(state, 'white'), true);
    const before = structuredClone(state);
    const king = state.pieces.find(piece => piece.square === 'e1')!;
    const pawn = state.pieces.find(piece => piece.square === 'a2')!;
    const next = act(state, { type: 'playCard', cardId: card, target: { king: 'e1', pawn: 'a2' } });
    assert.equal(next.history.at(-1)?.type, 'cardPlayed');
    assert.deepEqual(next.effects, effect === 'fatal-attraction' ? [] : before.effects);
    if (effect === 'fatal-attraction') {
      const retained = (before.effects[0] as { card: { id: string } }).card;
      assert.deepEqual(next.players.white.discard.filter(card => card.id === retained.id), [retained]);
    }
    assert.deepEqual(next.pieces.find(piece => piece.id === king.id), { ...king, square: 'a2' });
    assert.deepEqual(next.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: 'e1' });
    assert.equal(isKingInCheck(next, 'white'), false);
    assert.equal(next.turn.moveMade, false);
    assert.deepEqual(state, before);
  });
}

test('Man of Straw swaps a Confabulation Pawn carrier with its Knight component intact', () => {
  let state = createGameState({
    fen: '5r1k/8/8/8/8/2N5/PP6/4K3 w - - 7 3',
    hands: { white: ['confabulation', card] },
  });
  const knightId = state.pieces.find(piece => piece.square === 'c3')!.id;
  const pawnId = state.pieces.find(piece => piece.square === 'a2')!.id;
  const kingId = state.pieces.find(piece => piece.square === 'e1')!.id;
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'c3', to: 'a2' }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'f8', to: 'e8' });
  state = act(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(state, 'white'), true);
  const before = structuredClone(state);
  const knight = before.pieces.find(piece => piece.id === knightId)!;
  const pawn = before.pieces.find(piece => piece.id === pawnId)!;
  const king = before.pieces.find(piece => piece.id === kingId)!;
  assert.equal(knight.zone, 'away');
  assert.equal(knight.square, null);
  assert.equal(before.effects.length, 1);
  const next = act(state, { type: 'playCard', cardId: card, target: { king: 'e1', pawn: 'a2' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(next.pieces.find(piece => piece.id === kingId), { ...king, square: 'a2' });
  assert.deepEqual(next.pieces.find(piece => piece.id === pawnId), { ...pawn, square: 'e1' });
  assert.deepEqual(next.pieces.find(piece => piece.id === knightId), knight);
  assert.deepEqual(next.effects, before.effects);
  assert.equal(next.pieces.filter(piece => piece.zone === 'captured').length, 0);
  assert.equal(next.turn.phase, 'beforeMove');
  assert.equal(next.turn.moveMade, false);
  assert.equal(isKingInCheck(next, 'white'), false);
  assert.deepEqual(state, before);
});

test('Man of Straw remains available after an opponent delivers ordinary board mate', () => {
  let state = createGameState({
    fen: '8/8/8/8/8/5kq1/PP6/7K b - - 7 3',
    hands: { white: [card] },
  });
  state = act(state, { type: 'move', from: 'g3', to: 'g2' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.outcome, null);
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.equal([...legalDests(state, false).values()].flat().length, 0);
  state = act(state, { type: 'playCard', cardId: card, target: { king: 'h1', pawn: 'a2' } });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(state.turn.moveMade, false);
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  assert.equal(isKingInCheck(state, 'white'), false);
});

for (let seed = 1; seed <= 20; seed++) {
  test(`Man of Straw seeded continuation ${seed}`, () => {
    let state = createGameState({
      fen: '4r2k/8/8/8/8/8/PPPP1PPP/4K3 w - - 7 3',
      hands: { white: [card] },
    });
    const before = structuredClone(state);
    state = act(state, { type: 'playCard', cardId: card, target: { king: 'e1', pawn: 'a2' } });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.history.at(-1)?.cardId, card);
    let random = seed;
    for (let ply = 0; ply < 4; ply++) {
      const choices = [...legalDests(state, false)].flatMap(([from, targets]) => targets.map(to => ({ from, to })));
      assert.ok(choices.length > 0);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = choices[random % choices.length]!;
      const actor = state.turn.color;
      const previous = structuredClone(state);
      const mover = state.pieces.find(piece => piece.square === move.from)!;
      const promotion = mover.role === 'pawn' && isPromotionSquare(state, mover.owner, move.to)
        ? { promotion: 'queen' }
        : {};
      const moved = act(state, { type: 'move', ...move, ...promotion });
      assert.deepEqual(state, previous);
      assert.equal(isKingInCheck(moved, actor), false);
      const occupied = moved.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
      assert.equal(new Set(occupied).size, occupied.length);
      assert.equal(new Set(moved.pieces.map(piece => piece.id)).size, moved.pieces.length);
      assert.equal(boardFen(moved), moved.fen.split(' ')[0]);
      for (const piece of moved.pieces) assert.equal(piece.square !== null, piece.zone === 'board');
      for (const original of before.pieces) {
        const piece = moved.pieces.find(candidate => candidate.id === original.id)!;
        assert.equal(piece.owner, original.owner);
        assert.equal(piece.originalRole, original.originalRole);
        assert.equal(piece.promoted, false);
      }
      state = act(moved, { type: 'endTurn' });
    }
  });
}
