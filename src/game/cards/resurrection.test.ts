import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../reducer';
import { createGameState } from '../state';
import type { GameState } from '../types';
import { CARD_CATALOG } from './catalog';

function captured(symbol = 'N'): GameState {
  let state = createGameState({ fen: `7k/6n1/8/8/r7/${symbol}7/1P4P1/4K3 b - - 7 3`, hands: { white: ['resurrection'] }, decks: { white: ['sanctuary'] } });
  const capture = applyAction(state, { type: 'move', from: 'a4', to: 'a3' });
  assert.equal(capture.ok, true);
  state = capture.state;
  const end = applyAction(state, { type: 'endTurn' });
  assert.equal(end.ok, true);
  return end.state;
}

const revive = (state: GameState, pieceId: string, to: string) => applyAction(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId, to } });

for (const [symbol, role, squares] of [
  ['P', 'pawn', ['a2', 'h2']],
  ['N', 'knight', ['b1', 'g1']],
  ['B', 'bishop', ['c1', 'f1']],
  ['R', 'rook', ['a1', 'h1']],
] as const) {
  for (const to of squares) test(`Resurrection returns captured ${role} to ${to}`, () => {
    const result = revive(captured(symbol), `white-${role}-a3`, to);
    assert.equal(result.ok, true);
    const piece = result.state.pieces.find(piece => piece.id === `white-${role}-a3`);
    assert.equal(piece?.zone, 'board');
    assert.equal(piece?.square, to);
    assert.equal(piece?.role, role);
  });
}

for (const to of ['a2', 'c1', 'b8']) test(`Resurrection rejects Knight destination ${to}`, () => {
  const state = captured();
  const result = revive(state, 'white-knight-a3', to);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('A direct-mating Resurrection restores the board while spending the card and move', () => {
  const start = createGameState({ fen: '7k/5K2/8/4p3/3R4/8/8/8 b - - 7 3', hands: { white: ['resurrection'] }, decks: { white: ['sanctuary'] } });
  const capture = applyAction(start, { type: 'move', from: 'e5', to: 'd4' });
  assert.equal(capture.ok, true);
  const end = applyAction(capture.state, { type: 'endTurn' });
  assert.equal(end.ok, true);
  const result = revive(end.state, 'white-rook-d4', 'h1');
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.pieces, end.state.pieces);
  assert.equal(result.state.fen.split(' ')[0], end.state.fen.split(' ')[0]);
  assert.equal(result.state.fen.split(' ')[4], '1');
  assert.equal(result.state.fen.split(' ')[5], '4');
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.players.white.discard[0]?.cardId, 'resurrection');
  assert.equal(result.state.players.white.hand[0]?.cardId, 'sanctuary');
  assert.equal(result.state.turn.cardPlays.white, 1);
});

test('Resurrection has the printed regular replacement-card metadata', () => {
  const card = CARD_CATALOG.resurrection;
  assert.ok(card);
  assert.equal(card.points, 8);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
  assert.equal(card.image, '/KC16_card4.png');
});

test('Resurrection invalid target forms fail atomically', () => {
  for (const target of [undefined, null, 'a3', {}, { pieceId: 'missing', to: 'b1' }, { pieceId: 'white-knight-a3', to: 'z9' }, { pieceId: 1, to: 'b1' }]) {
    const state = captured();
    const result = applyAction(state, { type: 'playCard', cardId: 'resurrection', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test('Resurrection only accepts the captured zone', () => {
  for (const zone of ['board', 'dead', 'away'] as const) {
    const state = captured();
    const piece = state.pieces.find(piece => piece.id === 'white-knight-a3')!;
    if (zone === 'board') {
      const result = revive(state, 'white-pawn-b2', 'a2');
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, state);
    } else {
      piece.zone = zone;
      const result = revive(state, piece.id, 'b1');
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, state);
    }
  }
});

test('Resurrection rejects opposing ownership even for a neutral captured piece', () => {
  for (const neutral of [false, true]) {
    const state = captured();
    const piece = state.pieces.find(piece => piece.id === 'white-knight-a3')!;
    piece.owner = 'black';
    piece.neutral = neutral;
    const result = revive(state, piece.id, 'b8');
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test('Resurrection rejects royal and current or original King/Queen identities', () => {
  for (const change of [{ royal: true }, { role: 'queen' }, { role: 'king' }, { originalRole: 'queen' }, { originalRole: 'king' }] as const) {
    const state = captured();
    Object.assign(state.pieces.find(piece => piece.id === 'white-knight-a3')!, change);
    const result = revive(state, 'white-knight-a3', 'b1');
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test('Resurrection requires a vacant starting square', () => {
  const state = captured('P');
  const result = revive(state, 'white-pawn-a3', 'b2');
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Resurrection preserves physical identity and replaces exactly the played card', () => {
  const state = captured();
  const original = state.pieces.find(piece => piece.id === 'white-knight-a3')!;
  const card = state.players.white.hand[0]!;
  const replacement = state.players.white.deck[0]!;
  const result = revive(state, original.id, 'g1');
  assert.equal(result.ok, true);
  const returned = result.state.pieces.find(piece => piece.id === original.id)!;
  assert.deepEqual([returned.owner, returned.originalRole, returned.promoted, returned.neutral], [original.owner, original.originalRole, original.promoted, original.neutral]);
  assert.equal(result.state.pieces.length, state.pieces.length);
  assert.deepEqual(result.state.players.white.discard, [card]);
  assert.deepEqual(result.state.players.white.hand, [replacement]);
  assert.deepEqual(result.state.players.white.deck, []);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'resurrection');
});

test('Resurrection consumes the Regular Move and cannot be followed by an ordinary move', () => {
  const result = revive(captured(), 'white-knight-a3', 'b1');
  assert.equal(result.ok, true);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.phase, 'afterMove');
  const extra = applyAction(result.state, { type: 'move', from: 'g2', to: 'g3' });
  assert.equal(extra.ok, false);
  assert.deepEqual(extra.state, result.state);
});

test('Resurrection cannot replace an already completed move', () => {
  const state = captured();
  const move = applyAction(state, { type: 'move', from: 'g2', to: 'g3' });
  assert.equal(move.ok, true);
  const result = revive(move.state, 'white-knight-a3', 'b1');
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, move.state);
});

test('White Resurrection resets the Pawn clock and increments the other piece clocks', () => {
  for (const [symbol, role, to, halfmove] of [['P', 'pawn', 'a2', '0'], ['N', 'knight', 'b1', '10'], ['B', 'bishop', 'c1', '10'], ['R', 'rook', 'a1', '10']] as const) {
    const state = captured(symbol);
    const fields = state.fen.split(' ');
    fields[4] = '9';
    state.fen = fields.join(' ');
    const result = revive(state, `white-${role}-a3`, to);
    assert.equal(result.ok, true);
    assert.equal(result.state.fen.split(' ')[4], halfmove);
    assert.equal(result.state.fen.split(' ')[5], fields[5]);
  }
});

test('Black Resurrection uses Black starting squares and advances the fullmove once', () => {
  const start = createGameState({ fen: '4k3/1p4p1/n7/R7/8/8/6N1/7K w - - 7 3', hands: { black: ['resurrection'] } });
  const capture = applyAction(start, { type: 'move', from: 'a5', to: 'a6' });
  assert.equal(capture.ok, true);
  const end = applyAction(capture.state, { type: 'endTurn' });
  assert.equal(end.ok, true);
  const result = revive(end.state, 'black-knight-a6', 'b8');
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-knight-a6')?.square, 'b8');
  assert.equal(result.state.fen.split(' ')[4], '1');
  assert.equal(result.state.fen.split(' ')[5], '4');
  const finish = applyAction(result.state, { type: 'endTurn' });
  assert.equal(finish.ok, true);
  assert.equal(finish.state.fen.split(' ')[5], '4');
});

test('Resurrection clears all en-passant opportunities', () => {
  const state = createGameState({ fen: '7k/6n1/8/3pP3/8/8/1P4P1/4K3 w - d6 0 4', hands: { white: ['resurrection'] } });
  state.pieces.push({ ...captured().pieces.find(piece => piece.id === 'white-knight-a3')! });
  assert.equal(state.enPassant.length, 1);
  const result = revive(state, 'white-knight-a3', 'b1');
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.enPassant, []);
  assert.equal(result.state.fen.split(' ')[3], '-');
});

test('A Resurrection that leaves an existing check fizzles, spends the card and leaves a reply move', () => {
  const start = createGameState({ fen: '7k/6n1/8/8/r7/N3K3/1P4P1/8 b - - 7 3', hands: { white: ['resurrection'] }, decks: { white: ['sanctuary'] } });
  const capture = applyAction(start, { type: 'move', from: 'a4', to: 'a3' });
  assert.equal(capture.ok, true);
  const end = applyAction(capture.state, { type: 'endTurn' });
  assert.equal(end.ok, true);
  const result = revive(end.state, 'white-knight-a3', 'b1');
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.pieces, end.state.pieces);
  assert.equal(result.state.fen, end.state.fen);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(result.state.turn.moveMade, false);
  assert.equal(result.state.players.white.discard[0]?.cardId, 'resurrection');
  assert.equal(result.state.players.white.hand[0]?.cardId, 'sanctuary');
  assert.equal(result.state.turn.cardPlays.white, 1);
});
