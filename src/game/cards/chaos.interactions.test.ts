import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'input is immutable');
  assert.equal(result.ok, true, JSON.stringify(action));
  if (!result.ok) throw new Error('action failed');
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown): GameState {
  const card = [...state.players.white.hand, ...state.players.black.hand].find(card => card.cardId === cardId);
  assert.ok(card, `${cardId} is physically in hand`);
  const next = act(state, { type: 'playCard', cardId, cardInstanceId: card.id, ...(target === undefined ? {} : { target }) });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed', `${cardId} did not fizzle`);
  assert.equal(next.history.at(-1)?.cardId, cardId);
  return next;
}

function invalid(state: GameState, action: GameAction): void {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(state, before);
  assert.deepEqual(result.state, before);
}

function invariants(state: GameState, ids: string[]): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  const occupied = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(occupied.map(piece => piece.square)).size, occupied.length);
  assert.ok(occupied.every(piece => piece.square));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  const cards = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
}

test('Chaos restores an actual capture before the replacement opportunity', () => {
  const start = createGameState({ fen: '7k/8/8/8/8/8/p7/R6K w - - 0 1', hands: { black: ['chaos'] } });
  const moved = act(start, { type: 'move', from: 'a1', to: 'a2' });
  const restored = play(moved, 'chaos');
  assert.deepEqual(restored.pieces, start.pieces);
  assert.equal(boardFen(restored), boardFen(start));
  assert.equal(restored.history.at(-1)?.type, 'cardPlayed');
  assert.equal(restored.history.at(-1)?.cardId, 'chaos');
});

const replacements = [
  { card: 'dubbing', fen: '7k/8/8/8/8/8/P7/R6K w - - 3 8', moves: [{ from: 'a1', to: 'b3' }] },
  { card: 'blessing', fen: '7k/8/8/8/8/8/P7/R6K w - - 3 8', moves: [{ from: 'a1', to: 'c3' }] },
  { card: 'madman', fen: '7k/8/8/3p4/8/1p6/P7/7K w - - 3 8', moves: [{ from: 'a2', to: 'c4' }, { from: 'c4', to: 'e6' }] },
  { card: 'onslaught', fen: '7k/8/8/8/8/8/PP6/7K w - - 3 8', moves: [{ from: 'a2', to: 'a3' }, { from: 'b2', to: 'b3' }] },
] as const;

for (const fixture of replacements) {
  for (const choice of ['default', 'return', 'decline'] as const) {
    test(`Chaos cancels actual ${fixture.card}: ${choice} preserves physical draws and allowance`, () => {
      const initial = createGameState({ fen: fixture.fen, hands: { white: [fixture.card], black: ['chaos'] }, decks: { white: ['pacifism', 'crab'], black: ['blessing', 'dubbing'] } });
      const moved = play(initial, fixture.card, fixture.moves);
      assert.notEqual(boardFen(moved), boardFen(initial));
      const restored = play(moved, 'chaos', choice === 'default' ? undefined : { returnCard: choice === 'return' });
      assert.deepEqual(restored.pieces, initial.pieces);
      assert.equal(restored.fen, initial.fen);
      assert.equal(restored.turn.color, 'white');
      assert.equal(restored.turn.moveMade, false);
      assert.equal(restored.turn.cardPlays.white, choice === 'decline' ? 1 : 0);
      assert.deepEqual(restored.players.white, choice === 'decline' ? moved.players.white : initial.players.white);
      assert.deepEqual(restored.players.black.hand, initial.players.black.deck.slice(0, 1));
      assert.deepEqual(restored.players.black.deck, initial.players.black.deck.slice(1));
      assert.deepEqual(restored.players.black.discard, initial.players.black.hand);
      assert.equal(restored.turn.cardPlays.black, 1);
      if (choice !== 'decline') invalid(restored, { type: 'playCard', cardId: fixture.card, target: fixture.moves });
      const different = act(restored, { type: 'move', from: 'h1', to: 'g1' });
      assert.equal(isKingInCheck(different, 'white'), false);
      invariants(different, initial.pieces.map(piece => piece.id).sort());
    });
  }
}

for (const fixture of [
  { name: 'en passant victim and opportunity', fen: '7k/8/8/3pP3/8/8/8/7K w - d6 0 9', from: 'e5', to: 'd6' },
  { name: 'promotion identity and captured rook', fen: '1r5k/P7/8/8/8/8/8/7K w - - 0 9', from: 'a7', to: 'b8', promotion: 'queen' },
  { name: 'castling rook and rights', fen: 'k7/8/8/8/8/8/8/4K2R w K - 5 9', from: 'e1', to: 'g1' },
] as const) {
  test(`Chaos restores ${fixture.name}`, () => {
    const initial = createGameState({ fen: fixture.fen, hands: { black: ['chaos'] } });
    const moved = act(initial, { type: 'move', from: fixture.from, to: fixture.to, ...('promotion' in fixture ? { promotion: fixture.promotion } : {}) });
    const restored = play(moved, 'chaos');
    assert.deepEqual(restored.pieces, initial.pieces);
    assert.deepEqual(restored.enPassant, initial.enPassant);
    assert.equal(restored.fen, initial.fen);
    invalid(restored, { type: 'move', from: fixture.from, to: fixture.name === 'castling rook and rights' ? 'h1' : fixture.to, ...('promotion' in fixture ? { promotion: 'knight' } : {}) });
  });
}

test('Chaos preserves an independent Continuing Effect played before the canceled move', () => {
  const initial = createGameState({ hands: { white: ['pacifism'], black: ['chaos'] } });
  const marked = play(initial, 'pacifism', 'b1');
  assert.equal(marked.effects.length, 1);
  const moved = act(marked, { type: 'move', from: 'e2', to: 'e4' });
  const restored = play(moved, 'chaos');
  assert.deepEqual(restored.effects, marked.effects);
  assert.deepEqual(restored.players.white, marked.players.white);
  assert.equal(restored.turn.cardPlays.white, 1);
  assert.deepEqual(restored.pieces, marked.pieces);
});

test('Chaos restores a captured Crab and its physical Continuing Effect card', () => {
  const initial = createGameState({ fen: '7k/p7/8/8/8/8/8/R6K b - - 0 1', hands: { black: ['crab', 'chaos'] } });
  const movedKing = act(initial, { type: 'move', from: 'h8', to: 'g8' });
  const marked = play(movedKing, 'crab', 'a7');
  const beforeCapture = act(marked, { type: 'endTurn' });
  const captured = act(beforeCapture, { type: 'move', from: 'a1', to: 'a7' });
  assert.equal(captured.effects.length, 0);
  const restored = play(captured, 'chaos');
  assert.deepEqual(restored.pieces, beforeCapture.pieces);
  assert.deepEqual(restored.effects, beforeCapture.effects);
  assert.equal(restored.players.black.discard.some(card => card.cardId === 'crab'), false);
});

test('Chaos returns only the latest replacement under Plots Within Plots', () => {
  const initial = createGameState({ fen: '7k/8/8/8/8/8/P7/R6K w - - 0 1', hands: { white: ['plots-within-plots', 'dubbing', 'blessing'], black: ['chaos'] }, decks: { white: ['crab', 'pacifism', 'madman'] } });
  const plots = play(initial, 'plots-within-plots');
  const first = play(plots, 'dubbing', [{ from: 'a1', to: 'b3' }]);
  const second = play(first, 'blessing', [{ from: 'b3', to: 'c4' }]);
  assert.equal(second.turn.cardPlays.white, 3);
  const restored = play(second, 'chaos');
  assert.deepEqual(restored.pieces, first.pieces);
  assert.deepEqual(restored.players.white, first.players.white);
  assert.equal(restored.turn.cardPlays.white, 2);
  assert.ok(restored.history.some(event => event.cardId === 'plots-within-plots'));
  assert.ok(restored.history.some(event => event.cardId === 'dubbing'));
  const different = play(restored, 'blessing', [{ from: 'b3', to: 'c2' }]);
  assert.equal(different.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'c2');
  invalid(different, { type: 'move', from: 'h1', to: 'g1' });
});

test('Chaos response allowance does not consume the following own turn allowance', () => {
  const initial = createGameState({ hands: { black: ['chaos', 'pacifism'] } });
  const moved = act(initial, { type: 'move', from: 'e2', to: 'e4' });
  const restored = play(moved, 'chaos');
  const different = act(restored, { type: 'move', from: 'd2', to: 'd4' });
  const next = act(different, { type: 'endTurn' });
  assert.equal(next.turn.cardPlays.black, 0);
  const marked = play(next, 'pacifism', 'b8');
  assert.equal(marked.effects.length, 1);
});

for (let seed = 1; seed <= 20; seed++) {
  test(`Chaos seeded integration ${seed}: genuine replacement and four actual legal plies`, () => {
    let random = seed;
    const pick = (length: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % length; };
    let state = createGameState({ fen: 'r5nk/pp6/8/8/8/8/PP6/R5NK w - - 0 1', hands: { white: ['chaos'], black: ['chaos'] }, decks: { white: ['pacifism'], black: ['pacifism'] } });
    const ids = state.pieces.map(piece => piece.id).sort();
    const options = (position: GameState): Array<{ from: SquareName; to: SquareName }> => [...legalDests(position, false)].flatMap(([from, tos]) => tos.map(to => ({ from, to })));
    const move = (position: GameState, selection: { from: SquareName; to: SquareName }): GameState => {
      const piece = position.pieces.find(piece => piece.zone === 'board' && piece.square === selection.from)!;
      const next = act(position, { type: 'move', ...selection, ...(piece.role === 'pawn' && isPromotionSquare(position, piece.owner, selection.to) ? { promotion: 'queen' } : {}) });
      assert.equal(isKingInCheck(next, position.turn.color), false);
      invariants(next, ids);
      return next;
    };
    for (let ply = 0; ply < seed % 3; ply++) {
      const candidates = options(state);
      assert.ok(candidates.length > 1);
      state = act(move(state, candidates[pick(candidates.length)]!), { type: 'endTurn' });
    }
    const before = state;
    const candidates = options(before);
    assert.ok(candidates.length > 1);
    const canceled = candidates[pick(candidates.length)]!;
    const moved = move(before, canceled);
    const reactor = before.turn.color === 'white' ? 'black' : 'white';
    const chaos = moved.players[reactor].hand.find(card => card.cardId === 'chaos')!;
    state = act(moved, { type: 'playCard', cardId: 'chaos', cardInstanceId: chaos.id });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.history.at(-1)?.cardId, 'chaos');
    assert.deepEqual(state.pieces, before.pieces);
    assert.equal(state.fen, before.fen);
    invariants(state, ids);
    const replacements = options(state);
    assert.equal(replacements.some(move => move.from === canceled.from && move.to === canceled.to), false);
    assert.ok(replacements.length > 0);
    const replacement = replacements[pick(replacements.length)]!;
    assert.notDeepEqual(replacement, canceled);
    state = act(move(state, replacement), { type: 'endTurn' });
    for (let ply = 0; ply < 4; ply++) {
      const legal = options(state);
      assert.ok(legal.length > 0, `seed ${seed}, actual continuation ply ${ply}`);
      state = act(move(state, legal[pick(legal.length)]!), { type: 'endTurn' });
    }
    invariants(state, ids);
  });
}
