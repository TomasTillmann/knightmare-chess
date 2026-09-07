import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import type { GameAction, GameState, Role, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  if (!result.ok) throw new Error('action failed');
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, action.cardId);
  }
  return result.state;
}

const homes: [Role, SquareName, SquareName][] = [
  ['pawn', 'a2', 'h7'], ['pawn', 'h2', 'a7'],
  ['knight', 'b1', 'g8'], ['knight', 'g1', 'b8'],
  ['bishop', 'c1', 'f8'], ['bishop', 'f1', 'c8'],
  ['rook', 'a1', 'a8'],
];

for (const owner of ['white', 'black'] as const) {
  for (const [role, whiteHome, blackHome] of homes) {
    test(`Resurrection restores ${owner} ${role} physical identity at ${owner === 'white' ? whiteHome : blackHome}`, () => {
      let state = createGameState({ hands: { [owner]: ['resurrection'] }, turn: owner,
        fen: '7k/6n1/8/8/8/8/1P4P1/4K3 w - - 7 3' });
      const piece = { id: `${owner}-captured-${role}`, owner, role, originalRole: role,
        zone: 'captured' as const, square: null, promoted: false, royal: false, neutral: false };
      state.pieces.push(piece);
      const to = owner === 'white' ? whiteHome : blackHome;
      state = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: piece.id, to } });
      const returned = state.pieces.find(p => p.id === piece.id);
      assert.deepEqual(returned, { ...piece, zone: 'board', square: to });
      assert.equal(state.turn.moveMade, true);
      assert.equal(state.players[owner].discard.filter(c => c.cardId === 'resurrection').length, 1);
    });
  }
}

test('captured neutral physical identity returns for its original owner', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/r7/N7/1P4P1/4K3 b - - 7 3', hands: { white: ['resurrection'] } });
  state.pieces.find(p => p.id === 'white-knight-a3')!.neutral = true;
  state = act(state, { type: 'move', from: 'a4', to: 'a3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: 'white-knight-a3', to: 'b1' } });
  const returned = state.pieces.find(p => p.id === 'white-knight-a3')!;
  assert.equal(returned.square, 'b1');
  assert.equal(returned.owner, 'white');
  assert.equal(returned.neutral, true);
});

function capturedKnight(hands: { white?: string[]; black?: string[] } = { white: ['resurrection'] }): GameState {
  let state = createGameState({ fen: '7k/6n1/8/8/r7/N7/1P4P1/4K3 b - - 7 3', hands });
  state = act(state, { type: 'move', from: 'a4', to: 'a3' });
  return act(state, { type: 'endTurn' });
}

function restoreKnight(state: GameState, to: SquareName = 'b1'): GameState {
  const before = structuredClone(state);
  const next = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: 'white-knight-a3', to } });
  assert.deepEqual(state, before, 'Resurrection must not mutate its input');
  assert.equal(next.pieces.find(p => p.id === 'white-knight-a3')?.square, to);
  return next;
}

function invariant(state: GameState, ids: string[]): void {
  assert.deepEqual(state.pieces.map(p => p.id).sort(), ids);
  assert.equal(new Set(state.pieces.map(p => p.id)).size, ids.length);
  const occupied = state.pieces.filter(p => p.zone === 'board').map(p => p.square);
  assert.equal(new Set(occupied).size, occupied.length);
  assert.equal(occupied.includes(null), false);
  assert.ok(state.pieces.filter(p => p.zone !== 'board').every(p => p.square === null));
  assert.equal(state.fen.split(' ')[0], boardFen(state));
  const cards = Object.values(state.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]);
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Resurrection seeded legal four-ply continuation ${seed}`, () => {
    let state = capturedKnight();
    const ids = state.pieces.map(p => p.id).sort();
    state = restoreKnight(state, seed % 2 ? 'b1' : 'g1');
    invariant(state, ids);
    state = act(state, { type: 'endTurn' });
    let random = seed;
    let executed = 0;
    for (let ply = 0; ply < 4; ply++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const moves = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${ply}: actual continuation required`);
      const move = moves[random % moves.length]!;
      const piece = state.pieces.find(p => p.zone === 'board' && p.square === move.from)!;
      const actor = state.turn.color;
      const before = structuredClone(state);
      const promotion = piece.role === 'pawn' && !piece.promoted && isPromotionSquare(state, piece.owner, move.to) ? 'queen' : undefined;
      const next = act(state, { type: 'move', ...move, ...(promotion ? { promotion } : {}) });
      assert.deepEqual(state, before, 'ordinary continuation must not mutate its input');
      assert.equal(isKingInCheck(next, actor), false);
      invariant(next, ids);
      executed++;
      state = act(next, { type: 'endTurn' });
    }
    assert.equal(executed, 4);
    assert.equal(state.players.white.discard.filter(c => c.cardId === 'resurrection').length, 1);
  });
}

function blackCaptureAndCard(cardId: string, target: unknown): GameState {
  let state = createGameState({ fen: '7k/6n1/8/8/r7/N7/1P4P1/4K3 b - - 7 3',
    hands: { white: ['resurrection'], black: [cardId] } });
  state = act(state, { type: 'move', from: 'a4', to: 'a3' });
  state = act(state, { type: 'playCard', cardId, target });
  return act(state, { type: 'endTurn' });
}

test('Earthquake changes owner-relative Resurrection homes', () => {
  const state = blackCaptureAndCard('earthquake', { direction: 'clockwise', promotions: [] });
  assert.equal(state.orientation, 90);
  const next = restoreKnight(state, 'a7');
  assert.equal(next.orientation, 90);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: 'white-knight-a3', to: 'b1' } }).ok, false);
});

test('Forbidden City rejects its destination atomically but allows the other Knight home', () => {
  const state = blackCaptureAndCard('forbidden-city', 'b1');
  const before = structuredClone(state);
  const invalid = applyAction(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: 'white-knight-a3', to: 'b1' } });
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.state, before);
  assert.deepEqual(state, before);
  restoreKnight(state, 'g1');
});

test('Fortification has no path to block during Resurrection placement', () => {
  const state = blackCaptureAndCard('fortification', { from: 'a1', to: 'b1' });
  const next = restoreKnight(state);
  assert.deepEqual(next.effects, state.effects);
});

test('Resurrection places a Knight next to a magnet and it remains immobilized', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/r7/N7/1r4P1/4K3 b - - 7 3',
    hands: { white: ['resurrection'], black: ['fatal-attraction'] } });
  state = act(state, { type: 'move', from: 'a4', to: 'a3' });
  state = act(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'b2' });
  state = act(state, { type: 'endTurn' });
  state = restoreKnight(state);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  assert.deepEqual(legalDests(state, false).get('b1') ?? [], []);
});

test('Peace Talks removes a Forbidden City before a later Resurrection', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/r7/N7/1P4P1/4K3 b - - 7 3',
    hands: { white: ['resurrection', 'peace-talks'], black: ['forbidden-city'] } });
  state = act(state, { type: 'move', from: 'a4', to: 'a3' });
  state = act(state, { type: 'playCard', cardId: 'forbidden-city', target: 'b1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g2', to: 'g3' });
  const targets = cardPlayTargets(state, 'peace-talks');
  assert.equal(targets.length, 1);
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: targets[0] });
  assert.equal(state.effects.length, 0);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  restoreKnight(state);
});

test('a captured Fatal Attraction marker stays discarded when its Knight returns', () => {
  let state = createGameState({ fen: '7k/6n1/8/r7/8/N7/1P4P1/4K3 w - - 7 3',
    hands: { white: ['fatal-attraction', 'resurrection'] } });
  state = act(state, { type: 'move', from: 'g2', to: 'g3' });
  state = act(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'a3' });
  state = act(state, { type: 'endTurn' });
  // The capturing Rook starts beyond the magnet's adjacent neighborhood.
  state = act(state, { type: 'move', from: 'a5', to: 'a3' });
  assert.equal(state.effects.length, 0);
  state = act(state, { type: 'endTurn' });
  state = restoreKnight(state);
  assert.equal(state.effects.length, 0);
  assert.equal(state.players.white.discard.filter(c => c.cardId === 'fatal-attraction').length, 1);
});

test('an actual captured Confabulation returns its two physical components separately', () => {
  let state = createGameState({ fen: '7k/6n1/8/8/r7/B7/1P4P1/1N2K3 w - - 7 3',
    hands: { white: ['confabulation', 'resurrection', 'resurrection'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'a3' }] });
  const components = ['white-knight-b1', 'white-bishop-a3'];
  assert.equal(state.pieces.filter(p => components.includes(p.id) && p.zone === 'board').length, 1);
  assert.equal(state.pieces.filter(p => components.includes(p.id) && p.zone === 'away' && p.square === null).length, 1);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a4', to: 'a3' });
  assert.ok(state.pieces.filter(p => components.includes(p.id)).every(p => p.zone === 'captured' && p.square === null));
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: components[0], to: 'b1' } });
  assert.equal(state.pieces.find(p => p.id === components[0])?.square, 'b1');
  assert.equal(state.pieces.find(p => p.id === components[1])?.zone, 'captured');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: components[1], to: 'c1' } });
  assert.equal(state.pieces.find(p => p.id === components[1])?.role, 'bishop');
  assert.equal(state.pieces.find(p => p.id === components[1])?.square, 'c1');
  assert.equal(state.pieces.find(p => p.id === components[0])?.square, 'b1');
});

test('Plots Within Plots permits two independently eligible Resurrection placements', () => {
  let state = capturedKnight({ white: ['plots-within-plots', 'resurrection', 'resurrection'] });
  state.pieces.push({ id: 'white-captured-bishop', owner: 'white', role: 'bishop', originalRole: 'bishop',
    zone: 'captured', square: null, promoted: false, royal: false, neutral: false });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots' });
  state = restoreKnight(state);
  state = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: 'white-captured-bishop', to: 'c1' } });
  assert.equal(state.pieces.find(p => p.id === 'white-captured-bishop')?.square, 'c1');
  assert.equal(state.pieces.find(p => p.id === 'white-knight-a3')?.square, 'b1');
  assert.equal(state.turn.cardPlays.white, 3);
  assert.equal(state.players.white.discard.length, 3);
  assert.equal(applyAction(state, { type: 'move', from: 'g2', to: 'g3' }).ok, false);
});

for (const delayed of [false, true]) {
  test(`${delayed ? 'late' : 'immediate'} Resurrection ${delayed ? 'restores' : 'retains'} a captured Pawn-to-Knight transformation`, () => {
    let state = createGameState({ fen: '7k/6n1/8/8/r7/N7/1P4P1/4K3 b - - 7 3',
      hands: { white: ['resurrection'] } });
    const transformed = state.pieces.find(p => p.id === 'white-knight-a3')!;
    transformed.id = 'white-transformed-pawn';
    transformed.originalRole = 'pawn';
    state = act(state, { type: 'move', from: 'a4', to: 'a3' });
    state = act(state, { type: 'endTurn' });
    if (delayed) {
      state = act(state, { type: 'move', from: 'b2', to: 'b3' });
      state = act(state, { type: 'endTurn' });
      state = act(state, { type: 'move', from: 'g7', to: 'f5' });
      state = act(state, { type: 'endTurn' });
    }
    state = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: 'white-transformed-pawn', to: 'd2' } });
    assert.equal(state.pieces.find(p => p.id === 'white-transformed-pawn')?.square, 'd2');
    assert.equal(state.pieces.find(p => p.id === 'white-transformed-pawn')?.role, delayed ? 'pawn' : 'knight');
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h8', to: 'h7' });
    state = act(state, { type: 'endTurn' });
    const destinations = legalDests(state, false).get('d2') ?? [];
    assert.equal(destinations.includes('d3'), delayed);
    assert.equal(destinations.includes('c4'), !delayed);
  });
}
