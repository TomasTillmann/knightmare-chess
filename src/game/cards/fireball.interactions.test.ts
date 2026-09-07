import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, legalDests, isKingInCheck } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${JSON.stringify(action)}: ${result.error.message}`);
  if (action.type === 'playCard' && action.cardId !== 'fireball') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed', `${action.cardId} fixture must resolve`);
  }
  return result.state;
}

for (const card of ['pacifism', 'truce']) {
  test(`Fireball respects actual ${card} protection on its center`, () => {
    let state = createGameState({ fen: '7k/8/8/8/8/8/R7/K7 w - - 0 1', hands: { white: [card, 'fireball'] } });
    if (card === 'pacifism') state = act(state, { type: 'playCard', cardId: card, target: 'a2' });
    state = act(state, { type: 'move', from: 'a2', to: 'd2' });
    if (card === 'truce') state = act(state, { type: 'playCard', cardId: card });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h8', to: 'g8' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'd2', to: 'd4' });
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'fireball', target: 'd4' }).ok, false);
    assert.ok(state.pieces.some(piece => piece.square === 'd4' && piece.zone === 'board'));
  });
}

function fire(state: GameState, target: string): GameState {
  const next = act(state, { type: 'playCard', cardId: 'fireball', target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed', 'Fireball must resolve, not fizzle');
  assert.equal(next.history.at(-1)?.cardId, 'fireball');
  return next;
}

function nextTurn(state: GameState): GameState {
  return act(state, { type: 'endTurn' });
}

function moved(fen: string, from: string, to: string, black: string[] = []): GameState {
  return act(createGameState({ fen, hands: { white: ['fireball'], black } }), { type: 'move', from, to });
}

test('Fireball preserves an adjacent actual Pacifist while capturing an unprotected neighbor', () => {
  let state = createGameState({ fen: '7k/8/8/8/2p1P3/8/R7/K7 w - - 0 1', hands: { white: ['pacifism', 'fireball'] } });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'e4' });
  state = act(state, { type: 'move', from: 'a2', to: 'd2' });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'd2', to: 'd4' });
  state = fire(state, 'd4');
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-e4')?.zone, 'board');
  assert.equal(state.pieces.find(p => p.id === 'white-rook-a2')?.zone, 'captured');
  assert.equal(state.pieces.find(p => p.id === 'black-pawn-c4')?.zone, 'captured');
});

test('Fireball respects Mystic Shield on the immediately opposing turn', () => {
  let state = createGameState({ fen: '7k/8/8/4p3/8/R7/8/K7 b - - 0 1', hands: { white: ['fireball'], black: ['mystic-shield'] } });
  state = act(state, { type: 'move', from: 'e5', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'a3', to: 'd3' });
  state = fire(state, 'd3');
  assert.equal(state.pieces.find(p => p.id === 'black-pawn-e5')?.zone, 'board');
});

test('Fireball captures an actual Crab and expires its piece-bound effect', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1', hands: { white: ['crab', 'fireball'] } });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'a3' });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'a3', to: 'b4' });
  state = fire(state, 'b4');
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-a2')?.zone, 'captured');
  assert.equal(state.effects.length, 0);
});

test('Fireball captures both physical components of an actual Confabulation', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/RN6/K7 w - - 0 1', hands: { white: ['confabulation', 'fireball'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a2', to: 'b2' }] });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'b2', to: 'd2' });
  state = fire(state, 'd2');
  for (const id of ['white-rook-a2', 'white-knight-b2']) assert.equal(state.pieces.find(p => p.id === id)?.zone, 'captured');
  assert.equal(state.effects.length, 0);
});

test('Hostage can replace an opposing Fireball victim with an owned pawn', () => {
  let state = moved('7k/p7/8/8/4n3/8/R7/K7 w - - 0 1', 'a2', 'd2', ['hostage']);
  // Move the blast next to the victim on the following turn.
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = nextTurn(state);
  state = act(state, { type: 'move', from: 'd2', to: 'd4' });
  state = fire(state, 'd4');
  state = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-knight-e4', pawn: 'a7' } });
  assert.equal(state.pieces.find(p => p.id === 'black-knight-e4')?.square, 'a7');
  assert.equal(state.pieces.find(p => p.id === 'black-pawn-a7')?.zone, 'captured');
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.moveMade, true);
});

test('Fog of War restores the blast but preserves the already completed move', () => {
  const before = moved('7k/8/8/8/8/8/R7/K7 w - - 0 1', 'a2', 'd2', ['fog-of-war']);
  let state = fire(before, 'd2');
  state = act(state, { type: 'playCard', cardId: 'fog-of-war' });
  assert.deepEqual(state.pieces, before.pieces);
  assert.equal(state.fen, before.fen);
  assert.equal(state.turn.moveMade, true);
  for (const color of ['white', 'black'] as const) assert.equal(state.players[color].discard.length, 1);
});

test('Fog cancellation of Fireball restores lost rook castling rights', () => {
  const before = moved('4k3/8/8/8/8/8/8/R3KN1R w KQ - 0 1', 'f1', 'h2', ['fog-of-war']);
  let state = fire(before, 'h2');
  assert.equal(state.fen.split(' ')[2], 'Q');
  state = act(state, { type: 'playCard', cardId: 'fog-of-war' });
  assert.equal(state.fen, before.fen);
});

test('Plots permits Fireball in its saved after-move window after Mystic Shield', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/R7/K7 w - - 0 1', hands: { white: ['plots-within-plots', 'mystic-shield', 'fireball'] } });
  state = act(state, { type: 'move', from: 'a2', to: 'd2' });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots' });
  state = act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'd2' });
  state = fire(state, 'd2');
  assert.equal(state.pieces.find(p => p.id === 'white-rook-a2')?.zone, 'captured', 'Shield is not active on its own turn');
  assert.equal(state.turn.cardPlays.white, 3);
});

test('Plots played before movement cannot manufacture a Fireball after-move trigger', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1', hands: { white: ['plots-within-plots', 'fanatic', 'fireball'] } });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots' });
  state = act(state, { type: 'playCard', cardId: 'fanatic', target: 'a2' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'fireball', target: 'a5' }).ok, false);
});

test('castling rook may explode while its adjacent royal king survives', () => {
  let state = moved('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1');
  state = fire(state, 'f1');
  assert.equal(state.pieces.find(p => p.id === 'white-rook-h1')?.zone, 'captured');
  assert.equal(state.pieces.find(p => p.id === 'white-king-e1')?.square, 'g1');
});

test('newly promoted pawn explodes with its physical identity and promotion intact', () => {
  let state = createGameState({ fen: '7k/P7/8/8/8/8/8/K7 w - - 0 1', hands: { white: ['fireball'] } });
  state = act(state, { type: 'move', from: 'a7', to: 'a8', promotion: 'knight' });
  state = fire(state, 'a8');
  const pawn = state.pieces.find(p => p.id === 'white-pawn-a7');
  assert.equal(pawn?.zone, 'captured');
  assert.equal(pawn?.promoted, true);
  assert.equal(pawn?.role, 'knight');
});

test('en passant capture cannot trigger Fireball', () => {
  const state = moved('7k/8/8/3pP3/8/8/8/K7 w - d6 0 1', 'e5', 'd6');
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'fireball', target: 'd6' }).ok, false);
});

test('Fireball invalidates en passant when its moved double-step pawn explodes', () => {
  let state = moved('7k/8/8/8/3p4/8/4P3/K7 w - - 0 1', 'e2', 'e4');
  assert.equal(state.enPassant.length, 1);
  state = fire(state, 'e4');
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen.split(' ')[3], '-');
});

test('Fireball self-check fizzle keeps the completed move and spends exactly one card', () => {
  const before = moved('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e2', 'e3');
  const state = act(before, { type: 'playCard', cardId: 'fireball', target: 'e3' });
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.deepEqual(state.pieces, before.pieces);
  assert.equal(state.fen, before.fen);
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.white.discard.length, 1);
});

test('simultaneous blast removes both a king blocker and the checking attacker safely', () => {
  let state = moved('7k/8/8/8/8/2r5/4R3/2K5 w - - 0 1', 'e2', 'c2');
  state = fire(state, 'c2');
  assert.equal(state.pieces.find(p => p.id === 'black-rook-c3')?.zone, 'captured');
  assert.equal(isKingInCheck(state, 'white'), false);
});

for (let seed = 1; seed <= 20; seed++) {
  test(`seed ${seed}: successful Fireball followed by four actual randomized legal plies`, () => {
    let random = seed;
    const pick = (length: number) => {
      random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
      return (random >>> 0) % length;
    };
    const starts = [{ from: 'b1', to: 'a3' }, { from: 'b1', to: 'c3' }, { from: 'g1', to: 'f3' }, { from: 'g1', to: 'h3' }];
    const start = starts[pick(starts.length)]!;
    let state = act(createGameState({ hands: { white: ['fireball'] } }), { type: 'move', ...start });
    const pieceIds = state.pieces.map(piece => piece.id).sort();
    const cardIds = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]).map(card => card.id).sort();
    const conserved = () => {
      assert.deepEqual(state.pieces.map(piece => piece.id).sort(), pieceIds);
      assert.deepEqual(Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]).map(card => card.id).sort(), cardIds);
      const board = state.pieces.filter(piece => piece.zone === 'board');
      assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
      assert.equal(board.filter(piece => piece.royal).length, 2);
      for (const piece of state.pieces) assert.equal(piece.square === null, piece.zone !== 'board');
    };
    const centerId = state.pieces.find(p => p.square === start.to)!.id;
    state = fire(state, start.to);
    assert.equal(state.pieces.find(p => p.id === centerId)?.zone, 'captured');
    assert.equal(Number(state.fen.split(' ')[4]), 0);
    conserved();
    for (let ply = 0; ply < 4; ply++) {
      state = nextTurn(state);
      const moves = [...legalDests(state, false)].flatMap(([from, targets]) => targets.map(to => ({ from, to })));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${ply}: no legal continuation`);
      const move = moves[pick(moves.length)]!;
      const player = state.turn.color;
      const fullmove = Number(state.fen.split(' ')[5]);
      const halfmove = Number(state.fen.split(' ')[4]);
      const pawnMove = state.pieces.find(piece => piece.square === move.from)?.role === 'pawn';
      const capturedBefore = state.pieces.filter(piece => piece.zone === 'captured').length;
      state = act(state, { type: 'move', ...move });
      const capturedAfter = state.pieces.filter(piece => piece.zone === 'captured').length;
      assert.equal(isKingInCheck(state, player), false);
      assert.equal(Number(state.fen.split(' ')[5]), fullmove + (player === 'black' ? 1 : 0));
      assert.equal(Number(state.fen.split(' ')[4]), pawnMove || capturedAfter > capturedBefore ? 0 : halfmove + 1);
      assert.equal(state.pieces.find(p => p.id === centerId)?.zone, 'captured');
      conserved();
    }
    assert.equal(state.history.filter(event => event.type === 'move').length, 5);
  });
}
