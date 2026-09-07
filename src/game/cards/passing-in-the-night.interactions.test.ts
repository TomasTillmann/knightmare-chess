import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const cardId = 'passing-in-the-night';
const fen = '7k/pp6/8/8/8/8/PP6/7K w - - 0 1';
function fixture(): GameState {
  return createGameState({ fen, hands: { white: [cardId] } });
}

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'public actions leave their input immutable');
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') {
    assert.ok(result.state.history.slice(state.history.length).some(event =>
      event.type === 'cardPlayed' && event.cardId === action.cardId));
  }
  return result.state;
}

function conserved(state: GameState, initial: GameState): void {
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), initial.pieces.map(piece => piece.id).sort());
  const onBoard = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(onBoard.map(piece => piece.square)).size, onBoard.length);
  assert.ok(onBoard.every(piece => piece.square !== null));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  for (const royal of initial.pieces.filter(piece => piece.royal)) {
    const current = state.pieces.find(piece => piece.id === royal.id)!;
    assert.equal(current.royal, true);
    assert.equal(current.zone, 'board');
  }
  const cards = (value: GameState) => Object.values(value.players).flatMap(player =>
    [...player.hand, ...player.deck, ...player.discard].map(card => card.id)).sort();
  assert.deepEqual(cards(state), cards(initial));
  assert.equal(state.fen.split(' ')[0], boardFen(state));
}

function prepared(effect: 'pacifism' | 'crab' | 'man-trap' | 'earthquake'): GameState {
  const owner = effect === 'man-trap' ? 'black' : 'white';
  let state = createGameState({
    fen: effect === 'earthquake' ? '7k/1pp5/8/8/8/8/1PP5/7K w - - 0 1' : fen,
    turn: owner,
    phase: effect === 'pacifism' ? 'beforeMove' : 'afterMove',
    moveMade: effect !== 'pacifism',
    hands: { white: [cardId, ...(owner === 'white' ? [effect] : [])], black: owner === 'black' ? [effect] : [] },
  });
  state = act(state, { type: 'playCard', cardId: effect, target: effect === 'earthquake'
    ? { direction: 'clockwise', promotions: [] } : owner === 'black' ? 'a7' : 'a2' });
  if (effect === 'pacifism') state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  state = act(state, { type: 'endTurn' });
  if (owner === 'white') {
    state = act(state, { type: 'move', from: 'h8', to: 'g8' });
    state = act(state, { type: 'endTurn' });
  }
  return state;
}

test('public fixture preflight: existing cards resolve and continuation geometry is available', () => {
  for (const effect of ['pacifism', 'crab', 'man-trap', 'earthquake'] as const) {
    const state = prepared(effect);
    assert.equal(state.turn.color, 'white');
    assert.equal(state.turn.moveMade, false);
    assert.equal(state.outcome, null);
    assert.ok(legalDests(state).size > 0);
    if (effect === 'crab') assert.ok(legalDests(state).get('a2')?.includes('b3'));
    if (effect === 'pacifism' || effect === 'man-trap') assert.ok(legalDests(state).get('a2')?.includes('a3'));
    assert.equal(state.history.filter(event => event.type === 'cardPlayed' && event.cardId === effect).length, 1);
  }
});

for (const effect of ['pacifism', 'crab', 'man-trap', 'earthquake'] as const) {
  test(`${effect}: a real preceding card keeps its effect through the non-capturing swap`, () => {
    const state = prepared(effect);
    const before = structuredClone(state.effects);
    const next = effect === 'earthquake' ? swap(state, 'b2', 'b7') : swap(state);
    assert.deepEqual(next.effects, before);
    assert.equal(next.orientation, state.orientation);
    assert.ok(next.pieces.every(piece => piece.zone === 'board'));
    const opponent = state.pieces.find(piece => piece.square === (effect === 'earthquake' ? 'b7' : 'a7'))!;
    assert.equal(next.pieces.find(piece => piece.id === opponent.id)?.square, effect === 'earthquake' ? 'b2' : 'a2');
    assert.equal(next.history.at(-1)?.capturedId, undefined);
  });
}

test('Coup-style original Pawn carries royal status and its former King stays nonroyal', () => {
  const state = fixture();
  state.pieces.find(piece => piece.square === 'h1')!.royal = false;
  state.pieces.find(piece => piece.square === 'a2')!.royal = true;
  const next = swap(state);
  for (const owner of ['white', 'black']) assert.equal(next.pieces.filter(piece => piece.owner === owner && piece.royal).length, 1);
  assert.equal(next.pieces.find(piece => piece.square === 'a7')!.royal, true);
  assert.equal(next.pieces.find(piece => piece.square === 'h1')!.royal, false);
});

test('two pairs roll back together when the exchanged Coup-style royal would be checked', () => {
  const state = createGameState({ fen: 'r6k/pp6/8/8/8/8/PP6/7K w - - 0 1', hands: { white: [cardId] } });
  state.pieces.find(piece => piece.square === 'h1')!.royal = false;
  state.pieces.find(piece => piece.square === 'a2')!.royal = true;
  assert.equal(isKingInCheck(state, 'white'), false, 'the royal starts safe');
  const proposed = structuredClone(state);
  const exchanges = new Map<SquareName, SquareName>([['a2', 'a7'], ['a7', 'a2'], ['b2', 'b7'], ['b7', 'b2']]);
  for (const piece of proposed.pieces) piece.square = exchanges.get(piece.square!) ?? piece.square;
  assert.equal(isKingInCheck(proposed, 'white'), true, 'the complete proposed exchange checks the royal');
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId, target: [{ from: 'a2', to: 'a7' }, { from: 'b2', to: 'b7' }] });
  assert.deepEqual(state, before);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  const next = result.state;
  assert.deepEqual(next.pieces, state.pieces);
  assert.equal(next.turn.moveMade, true);
  assert.ok(next.history.some(event => event.type === 'cardFizzled' && event.reason === 'SELF_CHECK'));
  assert.equal(next.players.white.discard.filter(card => card.cardId === cardId).length, 1);
});

for (const effect of ['crab', 'man-trap'] as const) {
  test(`${effect}: two pairs exchange simultaneously and preserve every identity and marker`, () => {
    const state = prepared(effect);
    const next = act(state, { type: 'playCard', cardId, target: [{ from: 'a2', to: 'b7' }, { from: 'b2', to: 'a7' }] });
    assert.ok(!next.history.some(event => event.type === 'cardFizzled'));
    const exchanges = new Map([['a2', 'b7'], ['b7', 'a2'], ['b2', 'a7'], ['a7', 'b2']]);
    for (const piece of state.pieces) {
      assert.deepEqual(next.pieces.find(current => current.id === piece.id), {
        ...piece, square: exchanges.get(piece.square!) ?? piece.square,
      });
    }
    assert.deepEqual(next.effects, state.effects);
  });
}

test('Haunting Memories copies the exchange on the following turn', () => {
  const initial = createGameState({ fen, hands: { white: [cardId], black: ['haunting-memories'] } });
  let state = swap(initial);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: [{ from: 'a2', to: 'a7' }] });
  assert.equal(boardFen(state), fen.split(' ')[0]);
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.history.at(-1)?.copiedCardId, cardId);
  conserved(state, initial);
});

for (let seed = 1; seed <= 20; seed += 1) {
  test(`seed ${seed}: swapped Pawns permit four legal continuation plies with invariants`, () => {
    const initial = createGameState({
      fen: '7k/ppp5/8/8/8/8/PPP5/7K w - - 0 1',
      hands: { white: [cardId] }, decks: { white: ['crab', 'pacifism'] },
    });
    const from = (seed % 2 ? 'a2' : 'b2') as SquareName;
    const to = (seed % 3 ? 'a7' : 'b7') as SquareName;
    let state = swap(initial, from, to);
    conserved(state, initial);
    let random = seed;
    let plies = 0;
    for (; plies < 4; plies += 1) {
      state = act(state, { type: 'endTurn' });
      const choices = [...legalDests(state)].flatMap(([source, destinations]) =>
        destinations.map(destination => ({ from: source, to: destination })));
      assert.ok(choices.length > 0, `seed ${seed}, ply ${plies}: expected a legal move`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = choices[random % choices.length]!;
      const piece = state.pieces.find(piece => piece.square === move.from)!;
      const promotes = piece.role === 'pawn' && move.to[1] === (piece.owner === 'white' ? '8' : '1');
      state = act(state, promotes ? { type: 'move', ...move, promotion: 'queen' } : { type: 'move', ...move });
      assert.equal(state.history.at(-1)?.type, 'move');
      conserved(state, initial);
    }
    assert.equal(plies, 4);
  });
}
function swap(state: GameState, from: SquareName = 'a2', to: SquareName = 'a7'): GameState {
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId, target: [{ from, to }] });
  assert.deepEqual(state, snapshot, 'card application leaves its input immutable');
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  assert.ok(result.state.history.some(event => event.type === 'cardPlayed' && event.cardId === cardId));
  assert.ok(!result.state.history.some(event => event.type === 'cardFizzled'));
  return result.state;
}

for (const role of ['pawn', 'knight', 'bishop', 'rook', 'queen'] as const) {
  for (const neutral of [false, true]) {
    test(`original Pawn retains ${role} powers and neutral=${neutral} across exchange`, () => {
      const state = fixture();
      const piece = state.pieces.find(piece => piece.square === 'a2')!;
      piece.role = role;
      piece.neutral = neutral;
      const before = structuredClone(piece);
      const next = swap(state);
      assert.deepEqual(next.pieces.find(p => p.id === piece.id), { ...before, square: 'a7' });
      assert.equal(next.pieces.length, state.pieces.length);
    });
  }
}
