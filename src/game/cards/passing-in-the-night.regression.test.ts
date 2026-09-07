import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer';
import { createGameState } from '../state';
import type { CardMove, GameState } from '../types';

const cardId = 'passing-in-the-night';
function fixture(fen = '7k/pp6/8/8/8/8/PP6/7K w - - 0 1'): GameState {
  const state = createGameState({ fen });
  state.players.white.hand = [{ id: 'passing-1', cardId }, { id: 'passing-2', cardId }];
  state.players.white.deck = [];
  return state;
}
function play(state: GameState, target: CardMove[]): GameState {
  const result = applyAction(state, { type: 'playCard', cardId, cardInstanceId: 'passing-1', target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

test('target oracle includes every one-pair selection', () => {
  const state = fixture();
  const targets = cardPlayTargets(state, cardId);
  for (const from of ['a2', 'b2']) for (const to of ['a7', 'b7']) {
    assert.ok(targets.some(target => JSON.stringify(target) === JSON.stringify([{ from, to }])));
  }
});

test('two physical card instances remain distinct after spending one', () => {
  const next = play(fixture(), [{ from: 'a2', to: 'a7' }]);
  assert.deepEqual(next.players.white.hand, [{ id: 'passing-2', cardId }]);
  assert.deepEqual(next.players.white.discard, [{ id: 'passing-1', cardId }]);
  assert.equal(next.turn.cardPlays.white, 1);
});

test('target oracle includes both complete two-pair matchings', () => {
  const targets = cardPlayTargets(fixture(), cardId) as CardMove[][];
  const normalized = targets.map(target => target.map(pair => `${pair.from}:${pair.to}`).sort().join(','));
  assert.ok(normalized.includes('a2:a7,b2:b7'));
  assert.ok(normalized.includes('a2:b7,b2:a7'));
  for (const target of targets) {
    assert.equal(new Set(target.flatMap(pair => [pair.from, pair.to])).size, target.length * 2);
  }
});

test('a previous card allowance blocks every oracle target and spends nothing', () => {
  const state = fixture();
  state.turn.cardPlays.white = 1;
  assert.deepEqual(cardPlayTargets(state, cardId), []);
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId, target: [{ from: 'a2', to: 'a7' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('an explicit physical instance is spent without selecting its sibling', () => {
  const state = fixture();
  const result = applyAction(state, { type: 'playCard', cardId, cardInstanceId: 'passing-2', target: [{ from: 'a2', to: 'b7' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.players.white.hand, [{ id: 'passing-1', cardId }]);
  assert.deepEqual(result.state.players.white.discard, [{ id: 'passing-2', cardId }]);
});

test('direct mate fizzles the atomic swap and consumes the replacement', () => {
  const state = fixture('p6k/8/6K1/8/8/8/R7/8 w - - 0 1');
  state.pieces.find(piece => piece.square === 'a2')!.originalRole = 'pawn';
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(isKingInCheck(state, 'black'), false);
  const proposal = structuredClone(state);
  proposal.pieces.find(piece => piece.square === 'a2')!.square = 'a8';
  proposal.pieces.find(piece => piece.owner === 'black' && piece.originalRole === 'pawn')!.square = 'a2';
  proposal.turn.color = 'black';
  assert.equal(isKingInCheck(proposal, 'black'), true);
  assert.equal([...legalDests(proposal, false).values()].flat().length, 0);
  const result = applyAction(state, { type: 'playCard', cardId, target: [{ from: 'a2', to: 'a8' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.equal(boardFen(result.state), boardFen(state));
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.players.white.discard.length, 1);
});

test('swapping away a checking Pawn answers check as the complete replacement', () => {
  const state = fixture('7k/8/8/8/8/8/P5p1/7K w - - 0 1');
  assert.equal(isKingInCheck(state, 'white'), true);
  const next = play(state, [{ from: 'a2', to: 'g2' }]);
  assert.equal(isKingInCheck(next, 'white'), false);
  assert.equal(next.turn.moveMade, true);
});

test('a failed swap starting in check retains a verified ordinary escape', () => {
  const state = fixture('7k/p7/8/8/8/8/P5p1/7K w - - 0 1');
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.ok(legalDests(state, false).get('h1')?.includes('g2'));
  const result = applyAction(state, { type: 'playCard', cardId, target: [{ from: 'a2', to: 'a7' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(result.state.turn.moveMade, false);
  assert.equal(boardFen(result.state), boardFen(state));
  const escape = applyAction(result.state, { type: 'move', from: 'h1', to: 'g2' });
  assert.equal(escape.ok, true);
  assert.equal(isKingInCheck(escape.state, 'white'), false);
});

test('Curse does not limit a transformed original Pawn non-move swap', () => {
  const state = fixture();
  const pawn = state.pieces.find(piece => piece.square === 'a2')!;
  pawn.role = 'rook';
  state.effects.push({ type: 'curse', owner: 'black', card: { id: 'curse-1', cardId: 'curse' }, pieceId: pawn.id });
  const next = play(state, [{ from: 'a2', to: 'b7' }]);
  assert.deepEqual(next.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: 'b7' });
  assert.deepEqual(next.effects, state.effects);
});

test('Haunting Memories copies both pairs while preserving Man-Trap and Crab', () => {
  const state = fixture();
  state.players.white.hand = [{ id: 'haunting-1', cardId: 'haunting-memories' }];
  state.history.push({ type: 'cardPlayed', cardId, player: 'black', deckOwner: 'black', target: [{ from: 'a7', to: 'a2' }] });
  const pawn = state.pieces.find(piece => piece.square === 'a2')!;
  state.effects.push(
    { type: 'man-trap', owner: 'black', card: { id: 'trap-1', cardId: 'man-trap' }, square: 'a7' },
    { type: 'crab', owner: 'white', card: { id: 'crab-1', cardId: 'crab' }, pieceId: pawn.id },
  );
  const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories', target: [{ from: 'a2', to: 'a7' }, { from: 'b2', to: 'b7' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.copiedCardId, cardId);
  assert.equal(result.state.turn.moveMade, true);
  for (const before of state.pieces.filter(piece => piece.originalRole === 'pawn')) {
    const to = ({ a2: 'a7', a7: 'a2', b2: 'b7', b7: 'b2' } as Record<string, string>)[before.square!];
    assert.deepEqual(result.state.pieces.find(piece => piece.id === before.id), { ...before, square: to });
  }
  assert.deepEqual(result.state.effects, state.effects);
});
