import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function moved(): GameState {
  return act(createGameState({
    fen: '7k/8/8/3p4/8/8/4P3/7K w - - 7 3',
    hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'e2', to: 'e4' });
}

test('Mystic Shield plays on the physical piece just moved', () => {
  const state = act(moved(), { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.history.at(-1)?.cardId, 'mystic-shield');
});

for (const target of ['e2', 'd5', 'h1', 'e5', 'z9', ['e4'], { square: 'e4' }, null, undefined]) {
  test(`Mystic Shield rejects invalid target ${JSON.stringify(target)}`, () => {
    assert.equal(applyAction(moved(), { type: 'playCard', cardId: 'mystic-shield', target }).ok, false);
  });
}

test('Mystic Shield has the printed regular-card metadata', () => {
  const card = CARD_CATALOG['mystic-shield'];
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC18_card3.png');
  assert.deepEqual(card.timing, ['afterMove']);
});

test('target enumeration contains exactly the moved occupied square', () => {
  assert.deepEqual(cardPlayTargets(moved(), 'mystic-shield'), ['e4']);
});

test('playing preserves board, identities, clocks, rights, en passant, and move status', () => {
  const before = moved();
  const state = act(before, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(state.fen, before.fen);
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.enPassant, before.enPassant);
  assert.equal(state.turn.color, before.turn.color);
  assert.equal(state.turn.phase, before.turn.phase);
  assert.equal(state.turn.moveMade, before.turn.moveMade);
  assert.equal(state.turn.cardPlays.white, before.turn.cardPlays.white + 1);
});

test('spends only the selected physical card and draws one replacement', () => {
  let state = createGameState({
    fen: '7k/8/8/3p4/8/8/4P3/7K w - - 7 3',
    hands: { white: ['mystic-shield', 'mystic-shield'] },
    decks: { white: ['merciless', 'hostage'] },
  });
  const [first, selected] = state.players.white.hand;
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'mystic-shield', cardInstanceId: selected.id, target: 'e4' });
  assert.deepEqual(state.players.white.discard, [selected]);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['mystic-shield', 'merciless']);
  assert.equal(state.players.white.hand[0].id, first.id);
  assert.deepEqual(state.players.white.deck.map(card => card.cardId), ['hostage']);
});

test('a foreign physical card instance cannot spend the card', () => {
  assert.equal(applyAction(moved(), {
    type: 'playCard', cardId: 'mystic-shield', cardInstanceId: 'missing-instance', target: 'e4',
  }).ok, false);
});

test('the selected piece cannot be captured on the next opponent turn', () => {
  const baseline = act(moved(), { type: 'endTurn' });
  assert.equal(applyAction(baseline, { type: 'move', from: 'd5', to: 'e4' }).ok, true);
  const protectedTurn = act(act(moved(), { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }), { type: 'endTurn' });
  const rejected = applyAction(protectedTurn, { type: 'move', from: 'd5', to: 'e4' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, protectedTurn);
});

test('protection expires after that opponent turn', () => {
  let state = act(moved(), { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd5', to: 'e4' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.zone, 'captured');

  let mirrored = act(createGameState({
    fen: '7k/4p3/8/8/3P4/8/8/7K b - - 7 3',
    hands: { black: ['mystic-shield'] },
  }), { type: 'move', from: 'e7', to: 'e5' });
  const movedFen = mirrored.fen;
  mirrored = act(mirrored, { type: 'playCard', cardId: 'mystic-shield', target: 'e5' });
  assert.equal(mirrored.fen, movedFen);
  assert.equal(mirrored.turn.cardPlays.black, 1);
  assert.equal(mirrored.turn.cardPlays.white, 0);
  assert.deepEqual(mirrored.players.black.discard.map(card => card.cardId), ['mystic-shield']);
  mirrored = act(mirrored, { type: 'endTurn' });
  assert.equal(applyAction(mirrored, { type: 'move', from: 'd4', to: 'e5' }).ok, false);
  mirrored = act(mirrored, { type: 'move', from: 'h1', to: 'g1' });
  mirrored = act(mirrored, { type: 'endTurn' });
  mirrored = act(mirrored, { type: 'move', from: 'h8', to: 'g8' });
  mirrored = act(mirrored, { type: 'endTurn' });
  mirrored = act(mirrored, { type: 'move', from: 'd4', to: 'e5' });
  assert.equal(mirrored.pieces.find(piece => piece.id === 'black-pawn-e7')?.zone, 'captured');
});

test('an earlier turn cannot supply the moved-piece trigger', () => {
  let state = act(moved(), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }).ok, false);
});

test('a synthetic afterMove phase without a move supplies no trigger', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { white: ['mystic-shield'] } });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e2' }).ok, false);
});

test('moving a King does not create a legal target', () => {
  const state = act(createGameState({
    fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'h1', to: 'g1' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'g1' }).ok, false);
});

test('castling permits the relocated Rook, but not the King', () => {
  const state = act(createGameState({
    fen: 'k7/8/8/8/8/8/8/4K2R w K - 4 3', hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'e1', to: 'g1' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), ['f1']);
  const shielded = act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'f1' });
  assert.equal(shielded.history.at(-1)?.type, 'cardPlayed');
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'g1' }).ok, false);
});

test('a promoted pawn remains the moved physical piece', () => {
  const state = act(createGameState({
    fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'a7', to: 'a8', promotion: 'knight' });
  assert.equal(state.pieces.find(piece => piece.square === 'a8')?.id, 'white-pawn-a7');
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), ['a8']);
  assert.equal(act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'a8' }).history.at(-1)?.type, 'cardPlayed');
});

test('a controlled neutral piece qualifies despite its original owner', () => {
  const initial = createGameState({
    fen: '7k/8/8/8/8/8/4r3/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  });
  initial.pieces.find(piece => piece.square === 'e2')!.neutral = true;
  const state = act(initial, { type: 'move', from: 'e2', to: 'e4' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), ['e4']);
  const shielded = act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(shielded.history.at(-1)?.type, 'cardPlayed');
  assert.equal(shielded.pieces.find(piece => piece.square === 'e4')?.owner, 'black');
});

test('nonroyal role does not permit shielding a royal physical piece', () => {
  const initial = createGameState({
    fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  });
  initial.pieces.find(piece => piece.square === 'e2')!.royal = true;
  const state = act(initial, { type: 'move', from: 'e2', to: 'e4' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }).ok, false);
});

test('one regular card consumes the whole normal card allowance', () => {
  const before = moved();
  before.players.white.hand.push({ id: 'white-second-shield', cardId: 'mystic-shield' });
  const state = act(before, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }).ok, false);
});

test('shielding the checking Rook fizzles when its future protection would force direct mate', () => {
  const movedState = act(createGameState({
    fen: '7k/5BR1/8/8/8/8/8/K7 w - - 7 3',
    hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'g7', to: 'h7' });
  const baseline = act(movedState, { type: 'endTurn' });
  assert.equal(applyAction(baseline, { type: 'move', from: 'h8', to: 'h7' }).ok, true);

  let state = act(movedState, { type: 'playCard', cardId: 'mystic-shield', target: 'h7' });
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.deepEqual(state.pieces, movedState.pieces);
  assert.equal(state.fen, movedState.fen);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['mystic-shield']);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-g7')?.zone, 'captured');
});
