import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

function ready() {
  const state = createGameState({ hands: { white: ['neutrality'] } });
  const result = applyAction(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(result.ok, true);
  return result.state;
}

function play(state: GameState, target: unknown) {
  return applyAction(state, { type: 'playCard', cardId: 'neutrality', target });
}

function advance(state: GameState, ...actions: GameAction[]): GameState {
  for (const action of actions) {
    const before = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, before, 'public actions preserve their input');
    assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
    state = result.state;
  }
  return state;
}

function promotionSquare(owner: Color, square: SquareName): SquareName {
  return owner === 'black' ? square : `${square[0]}${9 - Number(square[1])}` as SquareName;
}

for (const owner of ['black', 'white'] as const) {
  const opponent = owner === 'black' ? 'white' : 'black';
  const square = (value: SquareName) => promotionSquare(owner, value);
  for (const [promotion, destination] of [['queen', 'a3'], ['rook', 'a3'], ['bishop', 'b2'], ['knight', 'b3']] as const) {
    test(`Neutrality ${promotion === 'queen' ? 'suspends' : 'continues'} on ${owner} Pawn promotion to ${promotion}`, () => {
      let state = createGameState({
        fen: owner === 'black' ? '6k1/8/8/8/8/8/p7/5K2 w - - 0 1' : '5k2/P7/8/8/8/8/8/6K1 b - - 0 1',
        hands: { [opponent]: ['neutrality'] }, decks: { [opponent]: ['pacifism'] },
      });
      const pawn = state.pieces.find(piece => piece.square === square('a2'))!;
      const card = state.players[opponent].hand[0];
      state = advance(state,
        { type: 'move', from: square('f1'), to: square('f2') },
        { type: 'playCard', cardId: 'neutrality', target: square('a2') }, { type: 'endTurn' });
      const marked = state;
      state = advance(state, { type: 'move', from: square('a2'), to: square('a1'), promotion });
      assert.deepEqual(state.pieces.find(piece => piece.id === pawn.id), {
        ...pawn, square: square('a1'), role: promotion, promoted: true,
        neutral: promotion !== 'queen', neutralBeforeEffects: false,
      });
      assert.deepEqual(state.effects, marked.effects, 'retain the exact marker and physical card');
      assert.deepEqual(state.players, marked.players, 'promotion neither discards nor draws another card');
      assert.ok(JSON.stringify(state.effects).includes(card.id));
      state = advance(state, { type: 'endTurn' });
      const move: GameAction = { type: 'move', from: square('a1'), to: square(destination) };
      assert.equal(legalDests(state).get(square('a1'))?.includes(square(destination)) ?? false, promotion !== 'queen');
      const opposingMove = applyAction(state, move);
      assert.equal(opposingMove.ok, promotion !== 'queen');
      if (!opposingMove.ok) assert.deepEqual(opposingMove.state, state);
      state = advance(state, { type: 'move', from: square('f2'), to: square('f3') }, { type: 'endTurn' }, move);
      assert.equal(state.pieces.find(piece => piece.id === pawn.id)?.square, square(destination), 'original owner retains control');
    });
  }

  test(`${owner} promotion refreshes Neutrality before checking the acting King's safety`, () => {
    for (const ownPawn of [true, false]) for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
      const fen = ownPawn
        ? owner === 'black' ? '5K2/8/8/8/8/8/p7/2k5 w - - 0 1' : '2K5/P7/8/8/8/8/8/5k2 b - - 0 1'
        : owner === 'black' ? '6k1/8/8/8/8/8/p7/3K4 w - - 0 1' : '3k4/P7/8/8/8/8/8/6K1 b - - 0 1';
      let state = advance(createGameState({ fen, hands: { [opponent]: ['neutrality'] } }),
        { type: 'move', from: square(ownPawn ? 'f8' : 'd1'), to: square(ownPawn ? 'f7' : 'c1') },
        { type: 'playCard', cardId: 'neutrality', target: square('a2') }, { type: 'endTurn' });
      if (!ownPawn) state = advance(state,
        { type: 'move', from: square('g8'), to: square('h8') }, { type: 'endTurn' });
      const result = applyAction(state, { type: 'move', from: square('a2'), to: square('a1'), promotion });
      const allowed = promotion === 'queen' ? ownPawn : promotion !== 'rook';
      assert.equal(result.ok, allowed, `${promotion}, ownPawn=${ownPawn}`);
      if (result.ok) {
        assert.equal(isKingInCheck(result.state, state.turn.color), false);
        advance(result.state, { type: 'endTurn' });
      } else assert.deepEqual(result.state, state, 'unsafe promotion is atomic');
    }
  });
}

for (const cardId of ['figure-dance', 'earthquake'] as const) {
  test(`Neutrality refreshes for actual ${cardId} promotions`, () => {
    for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
      const dance = cardId === 'figure-dance';
      let state = createGameState({
        fen: dance ? 'p7/8/6k1/8/8/8/5K2/8 w - - 0 1' : '6k1/8/8/8/p7/8/5K2/8 w - - 0 1',
        hands: { white: ['neutrality'], black: [cardId] },
      });
      state = advance(state, { type: 'move', from: 'f2', to: 'f3' },
        { type: 'playCard', cardId: 'neutrality', target: dance ? 'a8' : 'a4' }, { type: 'endTurn' },
        { type: 'move', from: dance ? 'g6' : 'g8', to: dance ? 'g5' : 'g7' });
      const marker = structuredClone(state.effects[0]);
      state = advance(state, { type: 'playCard', cardId,
        target: dance ? [{ square: 'a1', role: promotion }] : { direction: 'counterclockwise', promotions: [{ square: 'a4', role: promotion }] } });
      assert.equal(state.history.at(-1)?.type, 'cardPlayed');
      const pawn = state.pieces.find(piece => piece.id === `black-pawn-${dance ? 'a8' : 'a4'}`)!;
      assert.equal(pawn.role, promotion);
      assert.equal(pawn.neutral, promotion !== 'queen');
      assert.deepEqual(state.effects[0], marker);
      assert.deepEqual(state.players.white.discard, []);
    }
  });
}

test('Neutrality on a Knight component is retained but suspended in a Queen composite', () => {
  let state = advance(createGameState({ fen: '6k1/8/8/8/4q3/2n5/8/5K2 w - - 0 1',
    hands: { white: ['neutrality'], black: ['confabulation'] } }),
  { type: 'move', from: 'f1', to: 'f2' }, { type: 'playCard', cardId: 'neutrality', target: 'c3' },
  { type: 'endTurn' });
  const marker = structuredClone(state.effects[0]);
  state = advance(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'c3', to: 'e4' }] });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pieces.find(piece => piece.id === 'black-queen-e4')?.neutral, false);
  assert.deepEqual(state.effects[0], marker);
  assert.deepEqual(state.players.white.discard, [], 'suspension retains the physical card');
  state = advance(state, { type: 'endTurn' });
  assert.equal(legalDests(state).get('e4')?.includes('e5') ?? false, false);
  const opposingMove = applyAction(state, { type: 'move', from: 'e4', to: 'e5' });
  assert.equal(opposingMove.ok, false, 'the opposing player cannot control the Queen composite');
  assert.deepEqual(opposingMove.state, state);
  state = advance(state, { type: 'move', from: 'f2', to: 'f1' }, { type: 'endTurn' },
    { type: 'move', from: 'e4', to: 'e5' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-queen-e4')?.square, 'e5', 'original owner retains control');
  assert.equal(state.pieces.find(piece => piece.id === 'black-queen-e4')?.neutral, false);
  assert.deepEqual(state.effects[0], marker);
  assert.deepEqual(state.players.white.discard, []);
});

test('Peace Talks cancels the retained Neutrality card after Queen promotion', () => {
  let state = advance(createGameState({ fen: '6k1/8/8/8/8/8/p7/5K2 w - - 0 1',
    hands: { white: ['neutrality'], black: ['peace-talks'] } }),
  { type: 'move', from: 'f1', to: 'f2' }, { type: 'playCard', cardId: 'neutrality', target: 'a2' },
  { type: 'endTurn' }, { type: 'move', from: 'a2', to: 'a1', promotion: 'queen' });
  assert.equal(state.pieces.find(piece => piece.square === 'a1')?.neutral, false);
  assert.ok(cardPlayTargets(state, 'peace-talks').includes('white-hand-0-neutrality'));
  state = advance(state, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-neutrality' });
  assert.equal(state.effects.length, 0);
  assert.deepEqual(state.players.white.discard, [{ id: 'white-hand-0-neutrality', cardId: 'neutrality' }]);
  assert.equal(state.pieces.find(piece => piece.square === 'a1')?.neutral, false);
  state = advance(state, { type: 'endTurn' });
  assert.equal(applyAction(state, { type: 'move', from: 'a1', to: 'a3' }).ok, false);
});

test('Neutrality requires the completed Regular Move', () => {
  const state = createGameState({ hands: { white: ['neutrality'] } });
  assert.equal(play(state, 'b8').ok, false);
});

for (const target of ['a7', 'b8', 'c8', 'a8']) {
  test(`Neutrality accepts opposing piece on ${target}`, () => {
    const state = ready();
    const before = state.pieces.find(piece => piece.square === target)!;
    const result = play(state, target);
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    const after = result.state.pieces.find(piece => piece.id === before.id)!;
    for (const [key, value] of Object.entries(before)) {
      assert.deepEqual(after[key as keyof typeof after], key === 'neutral' ? true : value);
    }
  });
}

for (const target of ['d8', 'e8', 'b1', 'e5', 'z9', null, { square: 'b8' }]) {
  test(`Neutrality rejects excluded target ${JSON.stringify(target)}`, () => {
    const state = ready();
    assert.equal(play(state, target).ok, false);
    assert.equal(state.pieces.some(piece => piece.neutral), false);
  });
}

test('Neutrality target enumeration excludes royals, queens, friendly pieces, and empty squares', () => {
  const targets = cardPlayTargets(ready(), 'neutrality');
  assert.deepEqual(new Set(targets), new Set(['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'a8', 'b8', 'c8', 'f8', 'g8', 'h8']));
});

test('Neutrality metadata agrees with printed artwork', () => {
  const card = CARD_CATALOG.neutrality;
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, true);
  assert.deepEqual(card.timing, ['afterMove']);
  assert.ok(card.image.endsWith('/KC18_card4.png'));
});

for (const [label, properties, allowed] of [
  ['royal Knight', { royal: true }, false],
  ['transformed Queen', { originalRole: 'queen' }, false],
  ['transformed King', { originalRole: 'king' }, false],
  ['promoted Knight', { originalRole: 'pawn', promoted: true }, true],
] as const) {
  test(`Neutrality respects ${label} identity`, () => {
    const state = ready();
    const piece = state.pieces.find(piece => piece.square === 'b8')!;
    Object.assign(piece, properties);
    const result = play(state, 'b8');
    assert.equal(result.ok, allowed);
    assert.equal(cardPlayTargets(state, 'neutrality').includes('b8'), allowed);
    if (allowed) {
      assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
      const after = result.state.pieces.find(candidate => candidate.id === piece.id)!;
      for (const [key, value] of Object.entries(piece)) {
        assert.deepEqual(after[key as keyof typeof after], key === 'neutral' ? true : value);
      }
    }
  });
}

test('An already-neutral originally friendly Knight is an eligible opposing target', () => {
  const state = ready();
  state.pieces.find(piece => piece.square === 'b1')!.neutral = true;
  assert.ok(cardPlayTargets(state, 'neutrality').includes('b1'));
  const result = play(state, 'b1');
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
});

test('A Pawn promoted to Queen is excluded by its current type', () => {
  const state = ready();
  Object.assign(state.pieces.find(piece => piece.square === 'd8')!, { originalRole: 'pawn', promoted: true });
  assert.equal(play(state, 'd8').ok, false);
  assert.equal(cardPlayTargets(state, 'neutrality').includes('d8'), false);
});

test('Resolution preserves completed move, clocks, castling rights, and en-passant', () => {
  const state = ready();
  const result = play(state, 'b8');
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.fen, state.fen);
  assert.deepEqual(result.state.enPassant, state.enPassant);
  assert.deepEqual(result.state.history.slice(0, -1), state.history);
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(applyAction(result.state, { type: 'move', from: 'd2', to: 'd4' }).ok, false);
});

test('The selected physical card is retained and exactly one replacement drawn', () => {
  const initial = createGameState({ hands: { white: ['neutrality', 'neutrality'] }, decks: { white: ['pacifism', 'truce'] } });
  const moved = applyAction(initial, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(moved.ok, true);
  const state = moved.state;
  const [unplayed, selected] = state.players.white.hand;
  const result = applyAction(state, { type: 'playCard', cardId: 'neutrality', cardInstanceId: selected.id, target: 'b8' });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.players.white.hand, [unplayed, state.players.white.deck[0]]);
  assert.deepEqual(result.state.players.white.deck, state.players.white.deck.slice(1));
  assert.deepEqual(result.state.players.white.discard, []);
  assert.equal(result.state.effects.length, 1);
  assert.ok(JSON.stringify(result.state.effects).includes(selected.id));
});
