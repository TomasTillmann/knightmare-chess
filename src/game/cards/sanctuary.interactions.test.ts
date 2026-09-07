import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, legalDests, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function play(state: GameState, king: SquareName, rook: SquareName): GameState {
  const result = applyAction(state, { type: 'playCard', cardId: 'sanctuary', target: { king, rook } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

const positions: Array<[string, SquareName, SquareName, SquareName, SquareName]> = [
  ['6k1/8/8/8/8/8/8/K6R w - - 0 1', 'a1', 'h1', 'c1', 'b1'],
  ['7k/8/8/8/8/8/8/R6K w - - 0 1', 'h1', 'a1', 'f1', 'g1'],
  ['R7/8/7k/8/8/8/8/K7 w - - 0 1', 'a1', 'a8', 'a3', 'a2'],
  ['K6k/8/8/8/8/8/8/R7 w - - 0 1', 'a8', 'a1', 'a6', 'a7'],
  ['7k/8/8/8/8/8/8/KR6 w - - 0 1', 'a1', 'b1', 'c1', 'b1'],
  ['6k1/8/8/8/8/8/8/K1R5 w - - 0 1', 'a1', 'c1', 'c1', 'b1'],
  ['r6k/8/8/8/8/8/4K3/8 b - - 0 1', 'h8', 'a8', 'f8', 'g8'],
];

for (const [index, [fen, king, rook, kingTo, rookTo]] of positions.entries()) {
    test(`Sanctuary geometry ${index}: preserves identities, zones and input`, () => {
      const color = fen.split(' ')[1] === 'b' ? 'black' : 'white';
      const state = createGameState({ fen, hands: { [color]: ['sanctuary'] } });
      const before = structuredClone(state);
      const next = play(state, king, rook);
      assert.equal(next.pieces.find(piece => piece.id === state.pieces.find(piece => piece.square === king)!.id)?.square, kingTo);
      assert.equal(next.pieces.find(piece => piece.id === state.pieces.find(piece => piece.square === rook)!.id)?.square, rookTo);
      assert.deepEqual(next.pieces.map(piece => piece.id).sort(), state.pieces.map(piece => piece.id).sort());
      assert.ok(next.pieces.every(piece => piece.zone === 'board' && piece.square));
      assert.deepEqual(state, before);
    });
}

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'action mutated its input');
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}

function effectBeforeSanctuary(cardId: string, target: unknown, row = 'K6R'): GameState {
  const initial = createGameState({
    fen: `6k1/8/8/8/8/8/8/${row} b - - 0 1`,
    hands: { black: [cardId], white: ['sanctuary'] }, phase: 'afterMove', moveMade: true,
  });
  const marked = act(initial, { type: 'playCard', cardId, target });
  assert.equal(marked.history.at(-1)?.type, 'cardPlayed', 'existing-card preflight');
  assert.equal(marked.history.at(-1)?.cardId, cardId);
  return act(marked, { type: 'endTurn' });
}

for (const [name, cardId, target, row, rook, allowed] of [
  ['wall blocks rook walk', 'fortification', { from: 'g1', to: 'h1' }, 'K6R', 'h1', false],
  ['king jumps its wall', 'fortification', { from: 'a1', to: 'b1' }, 'K6R', 'h1', true],
  ['adjacent rook does not cross wall', 'fortification', { from: 'b1', to: 'c1' }, 'KR6', 'b1', true],
  ['forbidden king destination', 'forbidden-city', 'c1', 'K6R', 'h1', false],
  ['forbidden rook destination', 'forbidden-city', 'b1', 'K6R', 'h1', false],
  ['curse rejects six-square rook walk', 'curse', 'h1', 'K6R', 'h1', false],
  ['curse permits two-square rook walk', 'curse', 'd1', 'K2R4', 'd1', true],
  ['curse permits stationary rook', 'curse', 'b1', 'KR6', 'b1', true],
] as const) {
  test(`Sanctuary interaction: ${name}`, () => {
    const state = effectBeforeSanctuary(cardId, target, row);
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'sanctuary', target: { king: 'a1', rook } });
    assert.deepEqual(state, before);
    assert.equal(result.ok, allowed);
    if (allowed) {
      assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
      assert.equal(result.state.pieces.find(piece => piece.royal && piece.owner === 'white')?.square, 'c1');
      assert.deepEqual(result.state.effects, state.effects, 'retained effects survive atomic relocation');
    } else assert.deepEqual(result.state, state);
  });
}

test('Sanctuary uses a real Coup royal Pawn, preserves Prince and resets pawn clock', () => {
  let state = createGameState({ fen: '6k1/8/8/8/8/8/P6R/K7 w - - 17 1', hands: { white: ['coup', 'sanctuary'] }, phase: 'afterMove', moveMade: true });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'a2' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed', 'Coup preflight');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g8', to: 'f8' });
  state = act(state, { type: 'endTurn' });
  const effects = structuredClone(state.effects);
  const next = play(state, 'a2', 'h2');
  const royal = next.pieces.find(piece => piece.owner === 'white' && piece.royal)!;
  assert.equal(royal.square, 'c2');
  assert.equal(royal.role, 'pawn');
  assert.equal(royal.promoted, false);
  assert.equal(next.pieces.find(piece => piece.originalRole === 'king' && piece.owner === 'white')?.square, 'a1');
  assert.deepEqual(next.effects, effects);
  assert.equal(next.fen.split(' ')[4], '0');
});

test('Haunting Memories copies actual Sanctuary on the following turn', () => {
  let state = createGameState({ fen: 'r6k/7p/8/8/8/8/8/K6R w - - 0 1', hands: { white: ['sanctuary'], black: ['haunting-memories'] } });
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.equal(isKingInCheck(state, 'black'), false);
  state = play(state, 'a1', 'h1');
  state = act(state, { type: 'endTurn' });
  const next = act(state, { type: 'playCard', cardId: 'haunting-memories', target: { king: 'h8', rook: 'a8' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.copiedCardId, 'sanctuary');
  assert.equal(next.pieces.find(piece => piece.owner === 'black' && piece.royal)?.square, 'f8');
  assert.equal(next.pieces.find(piece => piece.owner === 'black' && piece.originalRole === 'rook')?.square, 'g8');
});

test('a neutral Pacifist Rook is controlled and retains its actual Pacifism marker', () => {
  let state = createGameState({ fen: '6k1/8/8/8/8/8/8/K6R w - - 0 1', hands: { white: ['pacifism', 'sanctuary'] } });
  const rookId = state.pieces.find(piece => piece.square === 'h1')!.id;
  state.pieces.find(piece => piece.id === rookId)!.neutral = true;
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'h1' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed', 'Pacifism preflight');
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g8', to: 'f8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'f8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  const effects = structuredClone(state.effects);
  const next = play(state, 'a1', 'h1');
  assert.equal(next.pieces.find(piece => piece.id === rookId)?.square, 'b1');
  assert.equal(next.pieces.find(piece => piece.id === rookId)?.neutral, true);
  assert.deepEqual(next.effects, effects);
  assert.equal(isKingInCheck(next, 'white'), false);
});

function invariants(state: GameState, ids: string[], cards: string[]): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  const squares = state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
  assert.equal(new Set(squares).size, squares.length);
  assert.ok(squares.every(Boolean));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  for (const color of ['white', 'black'] as const) assert.equal(state.pieces.filter(piece => piece.owner === color && piece.royal && piece.zone === 'board').length, 1);
  assert.deepEqual(Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]).map(card => card.id).sort(), cards);
}

test('Sanctuary direct rook mate fizzles atomically and spends the replacement move and card', () => {
  const state = createGameState({ fen: 'R1K4k/6pp/8/8/8/8/8/8 w - - 13 1', hands: { white: ['sanctuary'] }, decks: { white: ['curse'] } });
  const proposed = createGameState({ fen: 'KR5k/6pp/8/8/8/8/8/8 b - - 14 1' });
  assert.equal(isKingInCheck(state, 'black'), false, 'initial King blocks its Rook line');
  assert.equal(isKingInCheck(proposed, 'black'), true, 'atomic result newly exposes the Rook line');
  assert.equal([...legalDests(proposed, false).values()].flat().length, 0, 'proposed final position is direct mate');
  const next = act(state, { type: 'playCard', cardId: 'sanctuary', target: { king: 'c8', rook: 'a8' } });
  assert.equal(next.history.at(-1)?.type, 'cardFizzled');
  assert.equal(next.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.equal(boardFen(next), boardFen(state));
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.enPassant, state.enPassant);
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.turn.phase, 'afterMove');
  assert.deepEqual(next.players.white.discard, state.players.white.hand);
  assert.deepEqual(next.players.white.hand, state.players.white.deck);
  assert.equal(next.players.white.deck.length, 0);
  assert.equal(next.outcome, null);
});

for (let seed = 1; seed <= 20; seed++) {
  test(`Sanctuary seeded continuation ${seed}: four actual ordinary plies conserve state`, () => {
    let state = createGameState({ fen: '6k1/n4n2/8/8/8/8/4NN2/K6R w - - 0 1', hands: { white: ['sanctuary'] }, decks: { white: ['curse', 'coup'], black: ['pacifism'] } });
    const ids = state.pieces.map(piece => piece.id).sort();
    const cards = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck]).map(card => card.id).sort();
    let random = seed;
    state = play(state, 'a1', 'h1');
    invariants(state, ids, cards);
    state = act(state, { type: 'endTurn' });
    let plies = 0;
    while (plies < 4) {
      const candidates = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(candidates.length, `seed ${seed}, ply ${plies}: must have an ordinary legal move`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const candidate = candidates[random % candidates.length]!;
      const actor = state.turn.color;
      state = act(state, { type: 'move', ...candidate });
      assert.equal(state.history.at(-1)?.type, 'move');
      assert.equal(isKingInCheck(state, actor), false);
      invariants(state, ids, cards);
      plies++;
      state = act(state, { type: 'endTurn' });
    }
    assert.equal(plies, 4);
  });
}
