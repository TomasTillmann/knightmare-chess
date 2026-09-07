import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction, isKingInCheck, legalDests } from '../reducer';
import type { GameAction, GameState } from '../types';

function verifyBombard(before: GameState, after: GameState, captured: boolean) {
  const rook = before.pieces.find(piece => piece.square === 'a1')!;
  const jumped = before.pieces.find(piece => piece.square === 'a3')!;
  assert.deepEqual(after.pieces.find(piece => piece.id === rook.id), { ...rook, square: 'a4' });
  assert.deepEqual(after.pieces.find(piece => piece.id === jumped.id), jumped);
  assert.equal(after.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'bombard').length, 1);
  assert.equal(after.history.some(event => event.type === 'cardFizzled'), false);
  assert.equal(after.turn.moveMade, true);
  assert.equal(after.turn.cardPlays.white, 1);
  assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['sanctuary']);
  assert.equal(after.players.white.deck.length, 0);
  assert.deepEqual(after.players.white.discard, before.players.white.hand);
  assert.deepEqual(after.enPassant, []);
  assert.deepEqual(after.fen.split(' ').slice(3), ['-', captured ? '0' : '8', '3']);
  assert.equal(new Set(after.pieces.map(piece => piece.id)).size, after.pieces.length);
  const board = after.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(after.pieces.every(piece => (piece.zone === 'board') === (piece.square !== null)));
  if (captured) {
    const victim = before.pieces.find(piece => piece.square === 'a4')!;
    const gone = after.pieces.find(piece => piece.id === victim.id)!;
    assert.equal(gone.zone, 'captured');
    assert.equal(gone.square, null);
    assert.equal(gone.role, victim.role);
  }
}

function invariants(state: GameState) {
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(state.pieces.every(piece => (piece.zone === 'board') === (piece.square !== null)));
  const setup = parseFen(state.fen).unwrap();
  assert.equal(setup.board.occupied.size(), board.length);
  for (const piece of board) {
    const rendered = setup.board.get(parseSquare(piece.square!)!);
    assert.equal(rendered?.role, piece.role);
    assert.equal(rendered?.color, piece.owner);
  }
}

function act(state: GameState, action: GameAction) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  assert.deepEqual(state, before, 'actions leave their input immutable');
  return result.state;
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Bombard followed by four actual legal plies, seed ${seed}`, () => {
    let state = createGameState({ fen: '7k/6n1/8/8/8/P7/1P6/R3K3 w - - 7 3', hands: { white: ['bombard'] }, decks: { white: ['sanctuary'] } });
    const before = structuredClone(state);
    state = act(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
    verifyBombard(before, state, false);
    invariants(state);
    state = act(state, { type: 'endTurn' });
    let random = seed;
    let executed = 0;
    for (let ply = 0; ply < 4; ply++) {
      const moves = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${ply} has a legal continuation`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = moves[random % moves.length];
      const moving = state.pieces.find(piece => piece.square === move.from)!;
      const promotion = moving.role === 'pawn' && move.to[1] === (moving.owner === 'white' ? '8' : '1') ? 'queen' : undefined;
      const actor = state.turn.color;
      state = act(state, { type: 'move', ...move, ...(promotion ? { promotion } : {}) });
      executed++;
      invariants(state);
      assert.equal(isKingInCheck(state, actor), false);
      assert.deepEqual(state.pieces.map(piece => piece.id).sort(), before.pieces.map(piece => piece.id).sort());
      state = act(state, { type: 'endTurn' });
      invariants(state);
    }
    assert.equal(executed, 4);
    assert.equal(state.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'bombard').length, 1);
  });
}

function withBlackCard(cardId: string, target: unknown, row3 = 'P7', row4 = '8') {
  let state = createGameState({ fen: `7k/6n1/8/8/${row4}/${row3}/1P6/R3K3 b - - 7 3`, hands: { black: [cardId], white: ['bombard'] }, decks: { white: ['sanctuary'] } });
  if (cardId === 'pacifism') state = act(state, { type: 'playCard', cardId, target });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  if (cardId !== 'pacifism') state = act(state, { type: 'playCard', cardId, target });
  assert.equal(state.history.some(event => event.type === 'cardPlayed' && event.cardId === cardId), true);
  return act(state, { type: 'endTurn' });
}

for (const cardId of ['fortification', 'forbidden-city']) {
  for (const occupied of [false, true]) {
    test(`Bombard with actual ${cardId} and ${occupied ? 'two obstructions' : 'one obstruction'}`, () => {
      const state = withBlackCard(cardId, cardId === 'fortification' ? { from: 'a2', to: 'a3' } : 'a2', occupied ? 'P7' : '8');
      const before = structuredClone(state);
      const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
      assert.equal(result.ok, !occupied);
      assert.deepEqual(state, before);
      if (occupied) assert.deepEqual(result.state, before);
      else {
        assert.equal(result.state.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'bombard').length, 1);
        assert.equal(result.state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'a4');
        assert.deepEqual(result.state.effects, before.effects);
        invariants(result.state);
      }
    });
  }
}

for (const to of ['a3', 'a4'] as const) {
  test(`Bombard obeys actual Curse at ${to === 'a3' ? 'two' : 'three'} squares`, () => {
    const state = withBlackCard('curse', 'a1', '8');
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to }] });
    assert.equal(result.ok, to === 'a3');
    assert.deepEqual(state, before);
    if (to === 'a4') assert.deepEqual(result.state, before);
    else {
      assert.equal(result.state.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'bombard').length, 1);
      assert.equal(result.state.pieces.find(piece => piece.square === to)?.role, 'rook');
      assert.deepEqual(result.state.effects, state.effects);
    }
  });
}

for (const cardId of ['pacifism', 'truce']) {
  test(`Bombard cannot capture under actual ${cardId}`, () => {
    const state = withBlackCard(cardId, cardId === 'pacifism' ? 'a4' : undefined, 'P7', 'p7');
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Bombard resolves an actual Man-Trap after the destination capture', () => {
  const state = withBlackCard('man-trap', 'a4', 'P7', 'p7');
  const rook = state.pieces.find(piece => piece.square === 'a1')!;
  const victim = state.pieces.find(piece => piece.square === 'a4')!;
  const jumped = state.pieces.find(piece => piece.square === 'a3')!;
  const after = act(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
  assert.equal(after.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'bombard').length, 1);
  for (const piece of [rook, victim]) {
    assert.equal(after.pieces.find(item => item.id === piece.id)?.zone, 'captured');
    assert.equal(after.pieces.find(item => item.id === piece.id)?.square, null);
  }
  assert.deepEqual(after.pieces.find(piece => piece.id === jumped.id), jumped);
  assert.equal(after.effects.length, 0);
  invariants(after);
});

test('Bombard preserves a neutral jumped physical piece', () => {
  const state = createGameState({ fen: '7k/6n1/8/8/8/P7/1P6/R3K3 w - - 7 3', hands: { white: ['bombard'] }, decks: { white: ['sanctuary'] } });
  state.pieces.find(piece => piece.square === 'a3')!.neutral = true;
  const before = structuredClone(state);
  const after = act(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
  verifyBombard(before, after, false);
});

for (const blocker of ['P', 'N', 'B', 'R', 'Q', 'p', 'n', 'b', 'r', 'q']) {
  test(`Bombard preserves jumped ${blocker}`, () => {
    const state = createGameState({ fen: `7k/6n1/8/8/8/${blocker}7/1P6/R3K3 w - - 7 3`, hands: { white: ['bombard'] }, decks: { white: ['sanctuary'] } });
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
    assert.equal(result.ok, true);
    verifyBombard(before, result.state, false);
    assert.deepEqual(state, before);
  });
}

for (const victim of ['p', 'n', 'b', 'r', 'q']) {
  test(`Bombard jumps before capturing ${victim}`, () => {
    const state = createGameState({ fen: `7k/6n1/8/8/${victim}7/P7/1P6/R3K3 w - - 7 3`, hands: { white: ['bombard'] }, decks: { white: ['sanctuary'] } });
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
    assert.equal(result.ok, true);
    verifyBombard(before, result.state, true);
    assert.deepEqual(state, before);
  });
}
