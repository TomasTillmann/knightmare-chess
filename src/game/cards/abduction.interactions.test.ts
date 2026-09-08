import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, Role } from '../types.js';

function act(state: GameState, action: unknown): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action as GameAction);
  assert.deepEqual(state, before, 'actions leave their input immutable');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}

function consistent(state: GameState): void {
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(board.every(piece => piece.square !== null));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  assert.ok(board.some(piece => piece.owner === 'white' && piece.royal));
  assert.ok(board.some(piece => piece.owner === 'black' && piece.royal));
  const fromFen = createGameState({ fen: state.fen }).pieces;
  const projection = (pieces: typeof board) => pieces.map(piece => `${piece.square}:${piece.owner}:${piece.role}`).sort();
  assert.deepEqual(projection(board), projection(fromFen));
}

for (let seed = 1; seed <= 20; seed += 1) {
  test(`Abduction seeded continuation ${seed} executes four legal plies`, () => {
    let state = createGameState({
      fen: '7k/6n1/1p4p1/8/8/8/1P4P1/R3K3 w - - 7 3',
      phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] },
    });
    const victim = structuredClone(state.pieces.find(piece => piece.square === 'b6')!);
    state = act(state, { type: 'playCard', cardId: 'abduction', target: 'b6' });
    state = act(state, { type: 'revealAbduction' });
    state = act(state, seed % 3 === 0 ? { type: 'abductionTimeout' } : {
      type: 'answerAbduction', player: 'black', owner: 'black', square: 'b6',
      role: seed % 3 === 1 ? 'pawn' : 'knight',
    });
    assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, seed % 3 === 1 ? 'board' : 'captured');
    consistent(state);
    state = act(state, { type: 'endTurn' });
    let random = seed;
    for (let ply = 0; ply < 4; ply += 1) {
      const choices = [...legalDests(state, false)].flatMap(([from, dests]) => [...dests].map(to => ({ from, to })));
      assert.ok(choices.length > 0);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = choices[random % choices.length]!;
      const moving = state.pieces.find(piece => piece.square === move.from)!;
      const promotion = moving.role === 'pawn' && (move.to.endsWith('1') || move.to.endsWith('8')) ? 'queen' : undefined;
      state = act(state, { type: 'move', ...move, ...(promotion ? { promotion } : {}) });
      consistent(state);
      state = act(state, { type: 'endTurn' });
      consistent(state);
    }
  });
}

const victims: Array<[Role, string]> = [
  ['pawn', 'p'], ['knight', 'n'], ['bishop', 'b'], ['rook', 'r'], ['queen', 'q'],
];

function resolve(state: GameState, square: string, correct = true): GameState {
  const victim = state.pieces.find(piece => piece.square === square)!;
  state = act(state, { type: 'playCard', cardId: 'abduction', target: square });
  state = act(state, { type: 'revealAbduction' });
  return act(state, {
    type: 'answerAbduction', player: state.turn.color === 'white' ? 'black' : 'white',
    role: correct ? victim.role : victim.role === 'pawn' ? 'knight' : 'pawn',
    owner: victim.owner, square, pieceId: victim.id,
  });
}

function prepared(card: 'pacifism' | 'truce' | 'crab' | 'coup' | 'confabulation'): GameState {
  const beforeMove = card === 'pacifism' || card === 'confabulation';
  let state = createGameState({
    fen: '7k/6n1/1r4p1/8/1n6/8/1P4P1/R3K3 b - - 7 3',
    phase: beforeMove ? 'beforeMove' : 'afterMove', moveMade: !beforeMove,
    hands: { black: [card], white: ['abduction'] },
  });
  const target = card === 'confabulation' ? [{ from: 'b6', to: 'b4' }]
    : card === 'crab' ? 'g6' : card === 'coup' ? 'g7' : card === 'pacifism' ? 'b6' : undefined;
  state = act(state, { type: 'playCard', cardId: card, target });
  if (card === 'pacifism') state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'endTurn' });
  return act(state, { type: 'move', from: 'a1', to: 'a2' });
}

for (const card of ['pacifism', 'truce'] as const) {
  test(`Abduction cannot select a piece protected by actual ${card}`, () => {
    const state = prepared(card);
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'abduction', target: 'b6' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Abduction correct recall preserves an actual Crab and its marker', () => {
  const state = prepared('crab');
  const next = resolve(state, 'g6');
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.effects, state.effects);
});

test('Abduction requires the marked Crab physical identity', () => {
  let state = prepared('crab');
  state.players.black.hand.push({ id: 'abduction-crab-resurrection', cardId: 'resurrection' });
  const victim = state.pieces.find(piece => piece.square === 'g6')!;
  const marksVictim = (effect: unknown) => (effect as { pieceId?: string }).pieceId === victim.id;
  const crab = structuredClone(state.effects.find(marksVictim));
  assert.ok(crab);
  assert.equal((crab as { type?: string }).type, 'crab');
  state = act(state, { type: 'playCard', cardId: 'abduction', target: 'g6' });
  state = act(state, { type: 'revealAbduction' });
  state = act(state, { type: 'answerAbduction', player: 'black', role: victim.role, owner: victim.owner, square: 'g6', pieceId: 'black-rook-b6' });
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.deepEqual(state.effects.find(marksVictim), crab);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId: victim.id, to: 'a7' } });
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'board');
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.square, 'a7');
  assert.deepEqual(state.effects.find(marksVictim), crab);
});

test('Abduction can restore the non-royal Prince created by actual Coup', () => {
  const state = prepared('coup');
  assert.equal(state.pieces.find(piece => piece.square === 'h8')?.royal, false);
  const next = resolve(state, 'h8');
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.effects, state.effects);
});

for (const correct of [true, false]) {
  test(`Abduction actual Confabulation ${correct ? 'restores' : 'captures'} both components`, () => {
    const state = prepared('confabulation');
    const components = state.pieces.filter(piece => piece.id === 'black-knight-b4' || piece.id === 'black-rook-b6');
    assert.equal(components.filter(piece => piece.zone === 'board').length, 1);
    assert.equal(components.filter(piece => piece.zone === 'away').length, 1);
    const next = resolve(state, 'b4', correct);
    if (correct) {
      assert.deepEqual(next.pieces, state.pieces);
      assert.deepEqual(next.effects, state.effects);
    } else {
      for (const component of components) {
        const captured = next.pieces.find(piece => piece.id === component.id)!;
        assert.equal(captured.zone, 'captured');
        assert.equal(captured.square, null);
      }
      assert.ok(!next.effects.some(effect => (effect as { type?: string }).type === 'confabulation'));
    }
  });
}

test('Abduction capture revokes only the captured Rook castling right', () => {
  const state = createGameState({ fen: 'r3k2r/6n1/1p4p1/8/8/8/1P4P1/R3K3 w kq - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] } });
  const next = resolve(state, 'a8', false);
  assert.equal(next.fen.split(' ')[2], 'k');
  assert.equal(next.fen.split(' ')[4], '0');
  assert.equal(next.fen.split(' ')[5], '3');
});

for (const correct of [true, false]) {
  test(`Abduction ${correct ? 'preserves' : 'clears'} selected Pawn en-passant availability`, () => {
    const state = createGameState({ fen: '7k/6n1/6p1/1pP5/8/8/1P4P1/R3K3 w - b6 0 3', phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] } });
    assert.equal(state.enPassant.length, 1);
    const next = resolve(state, 'b5', correct);
    assert.deepEqual(next.enPassant, correct ? state.enPassant : []);
    assert.equal(next.fen.split(' ')[3], correct ? 'b6' : '-');
    assert.equal(next.fen.split(' ')[5], '3');
  });
}

for (const [reason, fen, square] of [
  ['direct mate', 'kr6/1p6/8/8/p7/8/8/R3K3 w - - 7 3', 'a4'],
  ['self check', '4r2k/8/8/8/4p3/8/8/R3K3 w - - 7 3', 'e4'],
]) {
  test(`Abduction final capture fizzles on ${reason}`, () => {
    const state = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] } });
    const next = resolve(state, square!, false);
    assert.deepEqual(next.pieces, state.pieces);
    assert.deepEqual(next.effects, state.effects);
    assert.equal(next.fen, state.fen);
    assert.ok(!next.players.white.hand.some(card => card.cardId === 'abduction'));
    assert.equal(next.outcome, null);
    assert.equal(next.history.at(-1)?.type, 'cardFizzled');
    assert.equal(next.history.at(-1)?.reason, reason === 'direct mate' ? 'DIRECT_MATE' : 'SELF_CHECK');
  });
}

for (const correct of [true, false]) {
  test(`Abduction pending illegal Regular Move ${correct ? 'rolls back on recall' : 'is rescued by capture'}`, () => {
    let state = createGameState({ fen: '4r2k/6n1/6p1/8/8/8/1P4P1/R2K4 w - - 7 3', hands: { white: ['abduction'] } });
    const kingId = state.pieces.find(piece => piece.square === 'd1')!.id;
    state = act(state, { type: 'move', from: 'd1', to: 'e1' });
    assert.ok(state.pendingRescue);
    state = resolve(state, 'e8', correct);
    assert.equal(state.pieces.find(piece => piece.id === kingId)?.square, correct ? 'd1' : 'e1');
    assert.equal(state.pieces.find(piece => piece.id === 'black-rook-e8')?.zone, correct ? 'board' : 'captured');
    assert.ok(!state.pendingRescue);
    assert.ok(!state.players.white.hand.some(card => card.cardId === 'abduction'));
  });
}

test('Haunting Memories repeats a resolved Abduction for the next player', () => {
  let state = createGameState({ fen: '7k/6n1/1p4p1/8/8/8/1P4P1/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['abduction'], black: ['haunting-memories'] } });
  state = resolve(state, 'b6');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  const victim = structuredClone(state.pieces.find(piece => piece.square === 'b2')!);
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: 'b2' });
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'away');
  state = act(state, { type: 'revealAbduction' });
  state = act(state, { type: 'answerAbduction', player: 'white', role: 'pawn', owner: 'white', square: 'b2' });
  assert.deepEqual(state.pieces.find(piece => piece.id === victim.id), victim);
  assert.ok(!state.players.black.hand.some(card => card.cardId === 'haunting-memories'));
});

for (const [role, letter] of victims) {
  for (const outcome of ['correct', 'wrong', 'timeout'] as const) {
    test(`Abduction ${role}: ${outcome} answer preserves or captures the selected identity`, () => {
      let state = createGameState({
        fen: `7k/6n1/1${letter}4p1/8/8/8/1P4P1/R3K3 w - - 7 3`,
        phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] },
      });
      const victim = structuredClone(state.pieces.find(piece => piece.square === 'b6')!);
      const others = structuredClone(state.pieces.filter(piece => piece.id !== victim.id));
      state = act(state, { type: 'playCard', cardId: 'abduction', target: 'b6' });
      assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'away');
      assert.equal(state.pieces.find(piece => piece.id === victim.id)?.square, null);
      assert.ok(state.history.some(event => event.type === 'cardPlayed'));
      state = act(state, { type: 'revealAbduction' });
      state = act(state, outcome === 'timeout'
        ? { type: 'abductionTimeout' }
        : {
            type: 'answerAbduction', player: 'black',
            role: outcome === 'correct' ? role : role === 'pawn' ? 'knight' : 'pawn',
            owner: 'black', square: 'b6',
          });
      const resolved = state.pieces.find(piece => piece.id === victim.id);
      assert.ok(resolved);
      if (outcome === 'correct') {
        assert.deepEqual(resolved, victim);
      } else {
        assert.equal(resolved.zone, 'captured');
        assert.equal(resolved.square, null);
        assert.equal(resolved.owner, victim.owner);
        assert.equal(resolved.role, victim.role);
        assert.equal(resolved.originalRole, victim.originalRole);
      }
      assert.deepEqual(state.pieces.filter(piece => piece.id !== victim.id), others);
    });
  }
}
