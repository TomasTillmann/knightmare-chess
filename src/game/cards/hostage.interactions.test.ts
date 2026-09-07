import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions preserve their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function fixture(owner: Color): GameState {
  const white = owner === 'white';
  const state = createGameState({
    fen: white ? '7k/6n1/8/r2N4/8/8/PPPPPPPP/7K b - - 7 3' : '7k/pppppppp/8/8/R2n4/8/6N1/7K w - - 7 3',
    hands: { [owner]: ['hostage'] },
    decks: { [owner]: ['crab'] },
  });
  return act(state, { type: 'move', from: white ? 'a5' : 'a4', to: white ? 'd5' : 'd4' });
}

function exchange(state: GameState, owner: Color, pawn: SquareName): GameState {
  const next = act(state, { type: 'playCard', cardId: 'hostage', target: {
    pieceId: `${owner}-knight-${owner === 'white' ? 'd5' : 'd4'}`, pawn,
  } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'hostage');
  const returned = next.pieces.find(piece => piece.id === `${owner}-knight-${owner === 'white' ? 'd5' : 'd4'}`)!;
  assert.equal(returned.zone, 'board');
  assert.equal(returned.square, pawn);
  assert.equal(next.pieces.find(piece => piece.id === `${owner}-pawn-${pawn}`)?.zone, 'captured');
  assert.deepEqual(next.turn, { ...state.turn, cardPlays: { ...state.turn.cardPlays, [owner]: 1 } });
  assert.equal(next.players[owner].discard.filter(card => card.cardId === 'hostage').length, 1);
  assert.equal(next.players[owner].hand.some(card => card.cardId === 'crab'), true);
  assert.equal(next.pieces.find(piece => piece.role === 'rook')?.square, owner === 'white' ? 'd5' : 'd4');
  assert.equal(next.fen.split(' ')[4], '0');
  assert.equal(next.fen.split(' ')[5], state.fen.split(' ')[5]);
  assert.equal(next.fen.split(' ')[1], state.fen.split(' ')[1]);
  assert.equal(boardFen(next), next.fen.split(' ')[0]);
  return next;
}

function withEffect(cardId: string): GameState {
  let state = createGameState({
    fen: '7k/pppppppp/8/8/R2n4/8/6N1/7K b - - 7 3',
    hands: { black: [cardId, 'hostage'] }, decks: { black: ['crab'] },
  });
  if (cardId === 'pacifism') state = act(state, { type: 'playCard', cardId, target: 'a7' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  if (cardId !== 'pacifism') state = act(state, { type: 'playCard', cardId, target: 'a7' });
  state = act(state, { type: 'endTurn' });
  return act(state, { type: 'move', from: 'a4', to: 'd4' });
}

for (const cardId of ['crab', 'fatal-attraction', 'man-trap']) {
  test(`Hostage interaction: substitute capture resolves ${cardId}`, () => {
    const before = withEffect(cardId);
    assert.equal(before.effects.length, 1, 'existing card was actually established');
    const after = exchange(before, 'black', 'a7');
    if (cardId === 'man-trap') assert.deepEqual(after.effects, before.effects, 'square marker persists');
    else assert.equal(after.effects.length, 0, 'capture expires the pawn-bound effect');
  });
}

test('Hostage interaction: Pacifism protects the proposed substitute', () => {
  const state = withEffect('pacifism');
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-knight-d4', pawn: 'a7' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

for (const cardId of ['evil-eye', 'bombard']) {
  test(`Hostage interaction: responds immediately to ${cardId}`, () => {
    let state = createGameState({
      fen: cardId === 'bombard' ? '7k/pppppppp/8/8/RB1n4/8/6N1/7K w - - 7 3' : '7k/pppppppp/8/8/R2n4/8/6N1/7K w - - 7 3',
      hands: { white: [cardId], black: ['hostage'] }, decks: { black: ['crab'] },
    });
    state = act(state, { type: 'playCard', cardId, target: cardId === 'evil-eye'
      ? { attacker: 'a4', victim: 'd4' } : [{ from: 'a4', to: 'd4' }] });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.pieces.find(piece => piece.id === 'black-knight-d4')?.zone, 'captured');
    const beforeTurn = structuredClone(state.turn);
    const rookSquare = state.pieces.find(piece => piece.id === 'white-rook-a4')?.square;
    const after = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-knight-d4', pawn: 'a7' } });
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(after.history.at(-1)?.cardId, 'hostage');
    assert.equal(after.pieces.find(piece => piece.id === 'black-knight-d4')?.square, 'a7');
    assert.equal(after.pieces.find(piece => piece.id === 'white-rook-a4')?.square, rookSquare);
    assert.deepEqual(after.turn, { ...beforeTurn, cardPlays: { ...beforeTurn.cardPlays, black: 1 } });
  });
}

for (const pieceId of ['black-knight-c6', 'black-pawn-d4']) {
  test(`Hostage interaction: returns only selected Confabulation component ${pieceId}`, () => {
    let state = createGameState({
      fen: '7k/pppppppp/2n5/8/R2p4/8/6N1/7K b - - 7 3',
      hands: { black: ['confabulation', 'hostage'] },
    });
    state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'c6', to: 'd4' }] });
    assert.equal(state.pieces.find(piece => piece.id === 'black-knight-c6')?.zone, 'away');
    assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.square, 'd4');
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'a4', to: 'd4' });
    const componentIds = ['black-knight-c6', 'black-pawn-d4'];
    for (const id of componentIds) assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'captured');
    state = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId, pawn: 'a7' } });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.history.at(-1)?.cardId, 'hostage');
    const returned = state.pieces.find(piece => piece.id === pieceId)!;
    assert.equal(returned.square, 'a7');
    assert.equal(returned.role, returned.originalRole);
    assert.equal(returned.promoted, false);
    assert.equal(state.pieces.find(piece => piece.id === componentIds.find(id => id !== pieceId))?.zone, 'captured');
    assert.equal(state.effects.length, 0);
  });
}

test('Hostage interaction: Plots preserves the composite capture for two distinct returns', () => {
  let state = createGameState({
    fen: '7k/pppppppp/2n5/8/R2p4/8/6N1/7K b - - 7 3',
    hands: { black: ['confabulation', 'plots-within-plots', 'hostage', 'hostage'] },
  });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'c6', to: 'd4' }] });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.history.at(-1)?.cardId, 'confabulation');
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-c6')?.zone, 'away');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a4', to: 'd4' });
  for (const id of ['black-knight-c6', 'black-pawn-d4']) {
    assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'captured');
  }
  assert.equal(state.history.at(-1)?.type, 'move');
  assert.equal(state.history.at(-1)?.capturedId, 'black-pawn-d4');
  assert.ok(state.players.black.hand.some(card => card.id === 'black-hand-1-plots-within-plots'));
  assert.equal(state.players.black.hand.filter(card => card.cardId === 'hostage').length, 2);
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots', cardInstanceId: 'black-hand-1-plots-within-plots', target: { player: 'black' } });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.history.at(-1)?.cardId, 'plots-within-plots');
  const originalTurn = structuredClone(state.turn);
  for (const [pieceId, pawn] of [['black-knight-c6', 'a7'], ['black-pawn-d4', 'b7']] as const) {
    state = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId, pawn } });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.history.at(-1)?.cardId, 'hostage');
    assert.equal(state.pieces.find(piece => piece.id === pieceId)?.square, pawn);
    assert.equal(state.pieces.find(piece => piece.id === `black-pawn-${pawn}`)?.zone, 'captured');
  }
  assert.deepEqual(state.turn, { ...originalTurn, cardPlays: { white: 0, black: 3 } });
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a4')?.square, 'd4');
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-c6')?.square, 'a7');
  assert.equal(state.players.black.discard.filter(card => card.cardId === 'hostage').length, 2);
});

test('Hostage interaction: answers Revenge during the captured owner\'s completed move', () => {
  let state = createGameState({
    fen: '7k/1p4p1/8/8/R2p4/8/1P4P1/7K w - - 7 3',
    hands: { white: ['hostage'], black: ['revenge'] },
  });
  state = act(state, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.zone, 'captured');
  state = act(state, { type: 'playCard', cardId: 'revenge', target: 'g2' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.history.at(-1)?.cardId, 'revenge');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-g2')?.zone, 'captured');
  const originalTurn = structuredClone(state.turn);
  state = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'white-pawn-g2', pawn: 'b2' } });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.history.at(-1)?.cardId, 'hostage');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-g2')?.square, 'b2');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b2')?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a4')?.square, 'd4');
  assert.deepEqual(state.turn, { ...originalTurn, cardPlays: { white: 1, black: 1 } });
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
});

function invariant(state: GameState, ids: string[]): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  const squares = state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
  assert.equal(new Set(squares).size, squares.length);
  for (const piece of state.pieces) assert.equal(piece.square !== null, piece.zone === 'board');
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (const file of 'abcdefgh') {
      const piece = state.pieces.find(item => item.zone === 'board' && item.square === `${file}${rank}`);
      if (!piece) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      const symbol = symbols[piece.role];
      row += piece.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  assert.equal(ranks.join('/'), state.fen.split(' ')[0]);
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Hostage seeded integration ${seed}: exchange then four legal plies`, () => {
    const owner: Color = seed % 2 ? 'black' : 'white';
    const pawn = `${'abcdefgh'[(seed * 5) % 8]}${owner === 'white' ? 2 : 7}` as SquareName;
    let state = fixture(owner);
    const ids = state.pieces.map(piece => piece.id).sort();
    state = exchange(state, owner, pawn);
    invariant(state, ids);
    let random = seed;
    let plies = 0;
    while (plies < 4) {
      if (state.turn.moveMade) state = act(state, { type: 'endTurn' });
      const mover = state.turn.color;
      const moves = [...legalDests(state, false)].flatMap(([from, dests]) => dests.map(to => ({ from, to })));
      assert.ok(moves.length, 'seed must have a legal continuation');
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = moves[random % moves.length]!;
      const piece = state.pieces.find(item => item.zone === 'board' && item.square === move.from)!;
      const action: GameAction = { type: 'move', ...move,
        ...(piece.role === 'pawn' && isPromotionSquare(state, piece.owner, move.to) ? { promotion: 'queen' } : {}),
      };
      state = act(state, action);
      assert.equal(isKingInCheck(state, mover), false);
      invariant(state, ids);
      plies++;
    }
    assert.equal(plies, 4);
  });
}

for (const owner of ['white', 'black'] as const) {
  for (const file of 'abcdefgh') {
    const pawn = `${file}${owner === 'white' ? 2 : 7}` as SquareName;
    test(`Hostage interaction: ${owner} return to ${pawn}`, () => {
      exchange(fixture(owner), owner, pawn);
    });
  }
}
