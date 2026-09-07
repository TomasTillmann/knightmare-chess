import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameState, PieceState } from '../types.js';

const central = ['d4', 'e4', 'd5', 'e5'] as const;
function fixture(overrides: Partial<PieceState> = {}, fen = '7k/p7/8/8/8/8/P7/K7 w - - 19 6') {
  const state = createGameState({ fen, hands: { white: ['winged-victory'], black: ['winged-victory'] }, decks: { white: ['crab'], black: ['crab'] } });
  state.pieces.push({ id: 'rescued-pawn', owner: state.turn.color, role: 'pawn', originalRole: 'pawn', square: null, zone: 'captured', promoted: false, royal: false, neutral: false, ...overrides });
  return state;
}
function play(state: GameState, target: unknown = { pieceId: 'rescued-pawn', to: 'd4' }) {
  return applyAction(state, { type: 'playCard', cardId: 'winged-victory', target });
}
function restored(state: GameState, to: string) {
  const result = play(state, { pieceId: 'rescued-pawn', to });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.pieces.find(piece => piece.id === 'rescued-pawn')?.square, to);
  return result.state;
}

test('Winged Victory matches printed metadata', () => {
  const card = CARD_CATALOG['winged-victory'];
  assert.ok(card);
  assert.equal(card.name, 'Winged Victory');
  assert.equal(card.points, 6);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
});

for (const to of central) test(`Winged Victory returns the same physical Pawn to ${to}`, () => {
  const before = fixture();
  assert.equal(before.pieces.some(piece => piece.zone === 'board' && piece.square === to), false);
  const after = restored(before, to);
  assert.deepEqual(after.pieces.find(piece => piece.id === 'rescued-pawn'), { ...before.pieces.at(-1), zone: 'board', square: to });
  assert.equal(after.pieces.length, before.pieces.length);
  assert.equal(after.pieces.filter(piece => piece.zone === 'captured').length, 0);
  assert.equal(before.pieces.at(-1)?.zone, 'captured');
});

const ineligible: Array<[string, Partial<PieceState>]> = [
  ['dead Pawn', { zone: 'dead' }],
  ['away Pawn', { zone: 'away' }],
  ['on-board Pawn', { zone: 'board', square: 'b2' }],
  ['enemy Pawn', { owner: 'black' }],
  ['enemy neutral Pawn', { owner: 'black', neutral: true }],
  ['promoted Pawn', { promoted: true, role: 'queen' }],
  ['captured Rook', { originalRole: 'rook', role: 'rook' }],
  ['Rook transformed into Pawn', { originalRole: 'rook', role: 'pawn' }],
];
for (const [label, overrides] of ineligible) test(`Winged Victory rejects ${label}`, () => {
  const before = fixture(overrides);
  const snapshot = structuredClone(before);
  const result = play(before);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(cardPlayTargets(before, 'winged-victory'), []);
});

test('Winged Victory accepts an originally owned neutral captured Pawn', () => {
  const after = restored(fixture({ neutral: true }), 'd4');
  assert.equal(after.pieces.find(piece => piece.id === 'rescued-pawn')?.neutral, true);
  assert.equal(after.pieces.find(piece => piece.id === 'rescued-pawn')?.owner, 'white');
});

test('Winged Victory enumerates exactly the four empty central targets', () => {
  assert.deepEqual(cardPlayTargets(fixture(), 'winged-victory').map(target => JSON.stringify(target)).sort(), central.map(to => JSON.stringify({ pieceId: 'rescued-pawn', to })).sort());
});

test('Winged Victory never replaces or captures an occupant', () => {
  const before = fixture({}, '7k/p7/8/3r4/3P4/8/P7/K7 w - - 19 6');
  for (const to of ['d4', 'd5']) {
    const result = play(before, { pieceId: 'rescued-pawn', to });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  }
  assert.deepEqual(cardPlayTargets(before, 'winged-victory').map(target => JSON.stringify(target)).sort(), ['e4', 'e5'].map(to => JSON.stringify({ pieceId: 'rescued-pawn', to })).sort());
});

test('Winged Victory rejects malformed or off-center targets without spending', () => {
  for (const target of [null, 'd4', {}, { pieceId: 'missing', to: 'd4' }, { pieceId: 'rescued-pawn', to: 'a1' }, { pieceId: 'rescued-pawn', to: 'd6' }, { pieceId: 'rescued-pawn', to: 'e8' }, { pieceId: 'rescued-pawn', to: 27 }]) {
    const before = fixture();
    const result = play(before, target);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  }
});

test('Winged Victory consumes the move and one card, discards and replaces once', () => {
  const after = restored(fixture(), 'd4');
  assert.equal(after.turn.phase, 'afterMove');
  assert.equal(after.turn.moveMade, true);
  assert.equal(after.turn.cardPlays.white, 1);
  assert.deepEqual(after.players.white.discard.map(card => card.cardId), ['winged-victory']);
  assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['crab']);
  assert.equal(after.players.white.deck.length, 0);
  assert.equal(applyAction(after, { type: 'move', from: 'a2', to: 'a3' }).ok, false);
});

test('Winged Victory cannot be played after the Regular Move', () => {
  const before = fixture();
  const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a3' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const result = play(moved.state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, moved.state);
});

test('Winged Victory clears en passant and resets the Pawn halfmove clock', () => {
  const before = fixture({}, '7k/p7/8/4pP2/8/8/P7/K7 w - e6 19 6');
  assert.equal(before.enPassant.length, 1);
  const after = restored(before, 'd4');
  assert.deepEqual(after.enPassant, []);
  assert.deepEqual(after.fen.split(' ').slice(3), ['-', '0', '6']);
});

test('Winged Victory increments fullmove after Black and keeps the Pawn unpromoted', () => {
  const after = restored(fixture({}, '7k/p7/8/8/8/8/P7/K7 b - - 19 6'), 'e5');
  assert.deepEqual(after.fen.split(' ').slice(3), ['-', '0', '7']);
  assert.equal(after.pieces.find(piece => piece.id === 'rescued-pawn')?.promoted, false);
  assert.equal(after.turn.cardPlays.black, 1);
});

test('Winged Victory restores a Pawn captured on the preceding move', () => {
  let state = createGameState({ fen: '7k/p7/8/8/4P2r/8/P7/K7 b - - 0 1', hands: { white: ['winged-victory'] } });
  const capture = applyAction(state, { type: 'move', from: 'h4', to: 'e4' });
  assert.equal(capture.ok, true);
  if (!capture.ok) return;
  state = capture.state;
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e4')?.zone, 'captured');
  const end = applyAction(state, { type: 'endTurn' });
  assert.equal(end.ok, true);
  if (!end.ok) return;
  const result = applyAction(end.state, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-e4', to: 'd4' } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-e4')?.square, 'd4');
});
