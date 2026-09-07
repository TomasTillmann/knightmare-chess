import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { applyAction, boardFen, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, SquareName } from '../types.js';

function position(king: SquareName = 'd4', rook: SquareName = 'h4', color: Color = 'white', extra: Record<string, string> = {}) {
  const squares: Record<string, string> = { [king]: color === 'white' ? 'K' : 'k', [rook]: color === 'white' ? 'R' : 'r', a8: color === 'white' ? 'k' : 'K', ...extra };
  const board = Array.from({ length: 8 }, (_, index) => {
    let row = '';
    let empty = 0;
    for (const file of 'abcdefgh') {
      const piece = squares[`${file}${8 - index}`];
      if (!piece) empty++;
      else { if (empty) row += empty; empty = 0; row += piece; }
    }
    return row + (empty || '');
  }).join('/');
  return createGameState({ fen: `${board} ${color === 'white' ? 'w' : 'b'} - - 12 9`, hands: { [color]: ['sanctuary'] }, decks: { [color]: ['sanctuary'] } });
}

function play(state: GameState, king: unknown = 'd4', rook: unknown = 'h4') {
  return applyAction(state, { type: 'playCard', cardId: 'sanctuary', target: { king, rook } });
}

function success(state: GameState, king: SquareName, rook: SquareName) {
  const result = play(state, king, rook);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'sanctuary').length, 1);
  assert.equal(result.state.history.some(event => event.type === 'cardFizzled'), false);
  return result.state;
}

test('Sanctuary metadata matches artwork and the documented timing ruling', () => {
  const card = Object.values(CARD_CATALOG).find(entry => entry.name === 'Sanctuary');
  assert.ok(card);
  assert.equal(card.points, 7);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
  assert.equal(card.image, '/KC14_card4.png');
});

for (const [rook, kingEnd, rookEnd] of [
  ['e4', 'f4', 'e4'], ['f4', 'f4', 'e4'], ['h4', 'f4', 'e4'],
  ['c4', 'b4', 'c4'], ['b4', 'b4', 'c4'], ['a4', 'b4', 'c4'],
  ['d5', 'd6', 'd5'], ['d6', 'd6', 'd5'], ['d8', 'd6', 'd5'],
  ['d3', 'd2', 'd3'], ['d2', 'd2', 'd3'], ['d1', 'd2', 'd3'],
] as const) {
  test(`Sanctuary castles d4/${rook} to ${kingEnd}/${rookEnd} without castling rights`, () => {
    const state = position('d4', rook);
    const next = success(state, 'd4', rook);
    for (const [start, end] of [['d4', kingEnd], [rook, rookEnd]]) {
      const original = state.pieces.find(piece => piece.square === start)!;
      assert.deepEqual(next.pieces.find(piece => piece.id === original.id), { ...original, square: end });
    }
    assert.equal(next.turn.moveMade, true);
    assert.equal(next.turn.phase, 'afterMove');
    assert.equal(next.turn.color, 'white');
    assert.equal(next.fen.split(' ').slice(-2).join(' '), '13 9');
  });
}

for (const rook of ['h4', 'd1'] as const) {
  test(`Sanctuary supports Black toward ${rook} and advances fullmove exactly once`, () => {
    const next = success(position('d4', rook, 'black'), 'd4', rook);
    assert.equal(next.fen.split(' ').slice(-2).join(' '), '13 10');
    assert.equal(next.turn.color, 'black');
    assert.equal(next.turn.moveMade, true);
  });
}

test('Sanctuary rejects malformed, occupied, blocked, diagonal and offboard targets atomically', () => {
  const cases: Array<[GameState, unknown, unknown]> = [
    [position(), 'd4', 'd4'], [position(), 'z9', 'h4'], [position(), null, 'h4'],
    [position(), 'd4', 'g4'], [position('d4', 'e5'), 'd4', 'e5'],
    [position('d4', 'h4', 'white', { g4: 'n' }), 'd4', 'h4'],
    [position('d4', 'e4', 'white', { f4: 'N' }), 'd4', 'e4'],
    [position('d4', 'e4', 'white', { f4: 'n' }), 'd4', 'e4'],
    [position('g4', 'h4'), 'g4', 'h4'],
  ];
  for (const [state, king, rook] of cases) {
    const before = structuredClone(state);
    const result = play(state, king, rook);
    assert.equal(result.ok, false, `${String(king)}/${String(rook)}`);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('Sanctuary admits original/current Rooks and transformed royalty but rejects Prince or hostile Rook', () => {
  for (const mode of ['originalRook', 'currentRook', 'transformedKing', 'prince', 'hostileRook'] as const) {
    const state = position();
    const king = state.pieces.find(piece => piece.square === 'd4')!;
    const rook = state.pieces.find(piece => piece.square === 'h4')!;
    if (mode === 'originalRook') rook.role = 'bishop';
    if (mode === 'currentRook') { rook.originalRole = 'pawn'; rook.promoted = true; }
    if (mode === 'transformedKing') king.role = 'knight';
    if (mode === 'prince') king.royal = false;
    if (mode === 'hostileRook') rook.owner = 'black';
    if (mode === 'prince' || mode === 'hostileRook') assert.equal(play(state).ok, false, mode);
    else {
      const next = success(state, 'd4', 'h4');
      assert.deepEqual(next.pieces.find(piece => piece.id === king.id), { ...king, square: 'f4' });
      assert.deepEqual(next.pieces.find(piece => piece.id === rook.id), { ...rook, square: 'e4' });
    }
  }
});

test('Sanctuary requires the before-move window, a card in hand and an unused allowance', () => {
  for (const mode of ['afterMove', 'moveMade', 'allowance', 'absent'] as const) {
    const state = position();
    if (mode === 'afterMove') { state.turn.phase = 'afterMove'; state.turn.moveMade = true; }
    if (mode === 'moveMade') state.turn.moveMade = true;
    if (mode === 'allowance') state.turn.cardPlays.white = 1;
    if (mode === 'absent') state.players.white.hand = [];
    const result = play(state);
    assert.equal(result.ok, false, mode);
    assert.deepEqual(result.state, state);
  }
});

test('Sanctuary consumes the selected physical card and replaces it exactly once', () => {
  const state = position();
  state.players.white.hand.push({ id: 'second-sanctuary', cardId: 'sanctuary' });
  const original = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'sanctuary', cardInstanceId: 'second-sanctuary', target: { king: 'd4', rook: 'h4' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.filter(event => event.type === 'cardPlayed').length, 1);
  assert.deepEqual(result.state.players.white.discard, [{ id: 'second-sanctuary', cardId: 'sanctuary' }]);
  assert.deepEqual(result.state.players.white.hand, [original.players.white.hand[0], original.players.white.deck[0]]);
  assert.equal(result.state.players.white.deck.length, 0);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(applyAction(result.state, { type: 'move', from: 'f4', to: 'g4' }).ok, false);
  assert.deepEqual(state, original);
});

test('Sanctuary clears en passant and revokes both royal castling rights', () => {
  const state = createGameState({ fen: 'k7/8/8/3pP3/8/8/8/R3K2R w KQ d6 12 9', hands: { white: ['sanctuary'] } });
  assert.equal(state.enPassant.length, 1);
  const next = success(state, 'e1', 'h1');
  assert.equal(next.fen.split(' ')[2], '-');
  assert.equal(next.fen.split(' ')[3], '-');
  assert.deepEqual(next.enPassant, []);
});

test('Sanctuary resets the clock only when an unpromoted original Pawn physically moves', () => {
  for (const [rook, promoted, halfmoves] of [['h4', false, '0'], ['e4', false, '13'], ['h4', true, '13']] as const) {
    const state = position('d4', rook);
    const piece = state.pieces.find(item => item.square === rook)!;
    piece.originalRole = 'pawn';
    piece.promoted = promoted;
    const next = success(state, 'd4', rook);
    assert.equal(next.fen.split(' ')[4], halfmoves);
    assert.equal(next.pieces.find(item => item.id === piece.id)?.promoted, promoted);
  }
});

test('Sanctuary may leave check and jump past an attacked intermediate square', () => {
  for (const attacker of ['d8', 'e8']) {
    const state = position('d4', 'h4', 'white', { [attacker]: 'r' });
    assert.equal(isKingInCheck(state, 'white'), attacker === 'd8');
    const next = success(state, 'd4', 'h4');
    assert.equal(isKingInCheck(next, 'white'), false);
    assert.equal(next.pieces.find(piece => piece.royal && piece.owner === 'white')?.square, 'f4');
  }
});

for (const startsInCheck of [false, true]) {
  test(`Sanctuary self-check fizzle restores pieces and ${startsInCheck ? 'preserves' : 'consumes'} the Regular Move`, () => {
    const state = position('d4', 'h4', 'white', { f8: 'r', ...(startsInCheck ? { d8: 'r' } : {}) });
    assert.equal(isKingInCheck(state, 'white'), startsInCheck);
    const result = play(state);
    assert.equal(result.ok, true);
    assert.equal(boardFen(result.state), boardFen(state));
    assert.deepEqual(result.state.pieces, state.pieces);
    assert.equal(result.state.history.filter(event => event.type === 'cardFizzled' && event.reason === 'SELF_CHECK').length, 1);
    assert.equal(result.state.players.white.discard.length, 1);
    assert.equal(result.state.players.white.hand.length, 1);
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.equal(result.state.turn.moveMade, !startsInCheck);
  });
}

test('Sanctuary rejects an unrelated non-Rook even when the path and royal target are valid', () => {
  const state = position();
  const piece = state.pieces.find(item => item.square === 'h4')!;
  piece.role = 'queen';
  piece.originalRole = 'queen';
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});
