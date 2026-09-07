import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, Role, SquareName } from '../types.js';

function magnet(state: GameState): GameState {
  const result = applyAction(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'd4' });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'fatal-attraction');
  return result.state;
}

function coherent(state: GameState): GameState {
  const fields = state.fen.split(' ');
  fields[0] = boardFen(state);
  fields[1] = state.turn.color === 'white' ? 'w' : 'b';
  return { ...state, fen: fields.join(' ') };
}

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions preserve their input');
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}

function invariants(state: GameState, ids: string[]): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  const occupied = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(occupied.map(piece => piece.square)).size, occupied.length);
  assert.ok(occupied.every(piece => piece.square !== null));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  const cards = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  assert.equal(state.pieces.filter(piece => piece.royal && piece.owner === 'white' && piece.zone === 'board').length, 1);
  assert.equal(state.pieces.filter(piece => piece.royal && piece.owner === 'black' && piece.zone === 'board').length, 1);
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Fatal Attraction seeded legal continuation ${seed}`, () => {
    let state = createGameState({ fen: '7k/6n1/8/4p3/3P4/8/1P6/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] } });
    const ids = state.pieces.map(piece => piece.id).sort();
    state = act(magnet(state), { type: 'endTurn' });
    let random = seed;
    for (let ply = 0; ply < 4; ply++) {
      const moves = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${ply} must execute a move`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = moves[random % moves.length];
      const mover = state.pieces.find(piece => piece.zone === 'board' && piece.square === move.from)!;
      const color = state.turn.color;
      const promotion = mover.role === 'pawn' && isPromotionSquare(state, mover.owner, move.to) ? 'queen' : undefined;
      state = act(state, { type: 'move', ...move, ...(promotion ? { promotion } : {}) });
      assert.equal(isKingInCheck(state, color), false);
      invariants(state, ids);
      state = act(state, { type: 'endTurn' });
      invariants(state, ids);
    }
  });
}

for (const role of ['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[]) {
  for (const ownership of ['white', 'black', 'neutral'] as const) {
    test(`Fatal Attraction freezes adjacent ${ownership} ${role}`, () => {
      const state = createGameState({ fen: '7k/6n1/8/4p3/3P4/8/1P6/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] } });
      const piece = state.pieces.find(piece => piece.square === 'e5')!;
      piece.role = role;
      piece.originalRole = role;
      piece.owner = ownership === 'neutral' ? 'black' : ownership;
      piece.neutral = ownership === 'neutral';
      state.fen = coherent(state).fen;
      const before = structuredClone(state);
      const active = magnet(state);
      assert.deepEqual(state, before);
      const moving = coherent({ ...active, turn: { ...active.turn, color: piece.owner, phase: 'beforeMove' as const, moveMade: false } });
      assert.deepEqual(legalDests(moving, false).get('e5' as SquareName) ?? [], []);
      assert.ok((legalDests(coherent({ ...moving, turn: { ...moving.turn, color: 'black' } }), false).get('g7') ?? []).length > 0);
    });
  }
}

function setup(card: string, fen = '7k/6n1/8/4p3/3P4/8/1P6/R3K3 w - - 7 3', black = false): GameState {
  return magnet(createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction', ...(!black ? [card] : [])], black: black ? [card] : [] } }));
}

function blackAfterMove(state: GameState): GameState {
  return act(act(state, { type: 'endTurn' }), { type: 'move', from: 'g7', to: 'h5' });
}

function whiteBeforeMove(state: GameState): GameState {
  return act(blackAfterMove(state), { type: 'endTurn' });
}

function whiteAfterMove(state: GameState): GameState {
  return act(whiteBeforeMove(state), { type: 'move', from: 'b2', to: 'b3' });
}

function destinations(state: GameState, square: SquareName) {
  const piece = state.pieces.find(piece => piece.square === square)!;
  return legalDests(coherent({ ...state, turn: { ...state.turn, color: piece.owner, phase: 'beforeMove', moveMade: false } }), false).get(square) ?? [];
}

function play(state: GameState, cardId: string, target?: unknown): GameState {
  const result = act(state, { type: 'playCard', cardId, target });
  assert.equal(result.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.history.at(-1)?.cardId, cardId);
  return result;
}

test('Dubbing cannot move an immobilized neighbor', () => {
  const state = whiteBeforeMove(setup('dubbing', '7k/6n1/8/4P3/3P4/8/1P6/R3K3 w - - 7 3'));
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'e5', to: 'f7' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Dubbing moving the magnet discards Fatal Attraction and releases neighbors', () => {
  const state = play(whiteBeforeMove(setup('dubbing')), 'dubbing', [{ from: 'd4', to: 'f5' }]);
  assert.ok(state.players.white.discard.some(card => card.cardId === 'fatal-attraction'));
  assert.ok(destinations(state, 'e5').includes('e4'));
});

test('Holy War swaps a frozen Bishop and the magnet without expiring its marker', () => {
  let state = setup('holy-war', '7k/6n1/8/4B3/3N4/8/1P6/R3K3 w - - 7 3');
  const id = state.pieces.find(piece => piece.square === 'd4')!.id;
  state = play(whiteAfterMove(state), 'holy-war', { knight: 'd4', bishop: 'e5' });
  assert.equal(state.pieces.find(piece => piece.id === id)?.square, 'e5');
  assert.deepEqual(destinations(state, 'd4'), []);
  assert.equal(state.players.white.discard.some(card => card.cardId === 'fatal-attraction'), false);
});

test('Anathema swaps an opposing frozen Bishop with a remote Rook', () => {
  let state = setup('anathema', '7k/6nr/8/4b3/3P4/8/1P6/R3K3 w - - 7 3');
  const bishopId = state.pieces.find(piece => piece.square === 'e5')!.id;
  state = play(whiteAfterMove(state), 'anathema', { bishop: 'e5', rook: 'h7' });
  assert.equal(state.pieces.find(piece => piece.id === bishopId)?.square, 'h7');
  assert.deepEqual(destinations(state, 'e5'), []);
});

test('Crab transformation preserves the physical magnet and its aura', () => {
  let state = setup('crab');
  const id = state.pieces.find(piece => piece.square === 'd4')!.id;
  state = play(whiteAfterMove(state), 'crab', 'd4');
  assert.equal(state.pieces.find(piece => piece.id === id)?.square, 'd4');
  assert.deepEqual(destinations(state, 'e5'), []);
  assert.equal(state.players.white.discard.some(card => card.cardId === 'fatal-attraction'), false);
});

test('Coup exempts the new royal Knight while the adjacent former King freezes', () => {
  let state = setup('coup', '7k/6n1/8/4N3/3P4/2K5/1P6/R7 w - - 7 3');
  state = play(whiteAfterMove(state), 'coup', 'e5');
  assert.equal(state.pieces.find(piece => piece.square === 'e5')?.royal, true);
  assert.equal(state.pieces.find(piece => piece.square === 'c3')?.royal, false);
  assert.ok(destinations(state, 'e5').length > 0);
  assert.deepEqual(destinations(state, 'c3'), []);
});

test('Peace Talks cancels the retained magnet and restores movement', () => {
  let state = blackAfterMove(setup('peace-talks', undefined, true));
  const targets = cardPlayTargets(state, 'peace-talks');
  assert.equal(targets.length, 1);
  state = play(state, 'peace-talks', targets[0]);
  assert.ok(state.players.white.discard.some(card => card.cardId === 'fatal-attraction'));
  assert.ok(destinations(state, 'e5').includes('e4'));
});

for (const correct of [true, false]) {
  test(`Abduction ${correct ? 'restores' : 'captures'} the same marked magnet after temporary absence`, () => {
    let state = blackAfterMove(setup('abduction', undefined, true));
    const id = state.pieces.find(piece => piece.square === 'd4')!.id;
    state = play(state, 'abduction', 'd4');
    assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'away');
    assert.equal(state.players.white.discard.some(card => card.cardId === 'fatal-attraction'), false);
    state = act(state, { type: 'revealAbduction' });
    state = act(state, { type: 'answerAbduction', player: 'white', role: 'pawn', owner: 'white', square: correct ? 'd4' : 'a4', pieceId: id });
    assert.equal(state.pieces.find(piece => piece.id === id)?.zone, correct ? 'board' : 'captured');
    assert.equal(state.players.white.discard.some(card => card.cardId === 'fatal-attraction'), !correct);
    if (correct) assert.deepEqual(destinations(state, 'e5'), []);
    else assert.ok(destinations(state, 'e5').includes('e4'));
  });
}
