import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function waiting(): GameState {
  let state = createGameState({ fen: '7k/6n1/1p4p1/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['under-elf-hill'] } });
  state = act(state, { type: 'playCard', cardId: 'under-elf-hill' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  return act(state, { type: 'endTurn' });
}

function returnKing(state: GameState, to: SquareName): GameState {
  return act(state, { type: 'returnKing', to } as unknown as GameAction);
}

function invariants(state: GameState, ids: string[]): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  const squares = state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
  assert.equal(new Set(squares).size, squares.length);
  for (const piece of state.pieces) {
    assert.equal(piece.square !== null, piece.zone === 'board');
  }
  for (const owner of ['white', 'black']) {
    assert.equal(state.pieces.filter(piece => piece.owner === owner && piece.royal && ['board', 'away'].includes(piece.zone)).length, 1);
  }
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Under Elf Hill survives four actual legal plies, seed ${seed}`, () => {
    let state = waiting();
    const ids = state.pieces.map(piece => piece.id).sort();
    invariants(state, ids);
    const clocks = state.fen.split(' ').slice(4);
    state = returnKing(state, seed % 2 ? 'b1' : 'a8');
    assert.deepEqual(state.fen.split(' ').slice(4), clocks);
    assert.equal(legalDests(state, false).has(seed % 2 ? 'b1' : 'a8'), false);
    let random = seed;
    for (let ply = 0; ply < 4; ply++) {
      const moves = [...legalDests(state, false)].flatMap(([from, tos]) => tos.map(to => ({ from, to })));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${ply}`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = moves[random % moves.length];
      const piece = state.pieces.find(item => item.zone === 'board' && item.square === move.from)!;
      const promotion = piece.role === 'pawn' && move.to[1] === (piece.owner === 'white' ? '8' : '1') ? 'queen' : undefined;
      state = act(state, { type: 'move', ...move, ...(promotion ? { promotion } : {}) });
      invariants(state, ids);
      state = act(state, { type: 'endTurn' });
      invariants(state, ids);
    }
  });
}

function depart(white: string[] = [], black: string[] = []): GameState {
  const initial = createGameState({ fen: '7k/6n1/1p4p1/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['under-elf-hill', ...white], black } });
  return act(act(initial, { type: 'playCard', cardId: 'under-elf-hill' }), { type: 'endTurn' });
}

test('Under Elf Hill return safety respects an actually played Pacifism', () => {
  let state = depart([], ['pacifism']);
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'g7' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = returnKing(state, 'h4');
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'h4');
  assert.ok(state.effects.some(effect => (effect as { type?: string }).type === 'pacifism'));
});

test('Under Elf Hill cannot return into an actually played Forbidden City', () => {
  let state = depart([], ['forbidden-city']);
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'playCard', cardId: 'forbidden-city', target: 'a8' });
  state = act(state, { type: 'endTurn' });
  const snapshot = structuredClone(state);
  const rejected = applyAction(state, { type: 'returnKing', to: 'a8' } as unknown as GameAction);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, snapshot);
  state = returnKing(state, 'b8');
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'b8');
});

test('Under Elf Hill placement does not cross an actually played Fortification', () => {
  let state = depart([], ['fortification']);
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'playCard', cardId: 'fortification', target: { from: 'a7', to: 'a8' } });
  state = act(state, { type: 'endTurn' });
  state = returnKing(state, 'a8');
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'a8');
});

test('Under Elf Hill freezes the returned piece against Dubbing but permits another piece', () => {
  let state = depart(['dubbing']);
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = returnKing(state, 'b1');
  const snapshot = structuredClone(state);
  const rejected = applyAction(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'b1', to: 'a3' }] });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, snapshot);
  state = act(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'a1', to: 'b3' }] });
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'b3');
});

test('Haunting Memories independently copies Under Elf Hill with both Kings away', () => {
  let state = depart([], ['haunting-memories']);
  state = act(state, { type: 'playCard', cardId: 'haunting-memories' });
  assert.equal(state.pieces.filter(piece => piece.royal && piece.zone === 'away').length, 2);
  state = act(state, { type: 'endTurn' });
  state = returnKing(state, 'b1');
  assert.equal(state.pieces.find(piece => piece.id === 'black-king-h8')?.zone, 'away');
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'endTurn' });
  state = returnKing(state, 'h8');
  assert.equal(state.pieces.filter(piece => piece.royal && piece.zone === 'board').length, 2);
});

test('Coup and Pacifism stay attached to the physical Pawn through absence and last-rank return', () => {
  let state = createGameState({ fen: '7k/6n1/1p4p1/8/8/8/1P4P1/R3K3 w - - 7 3', hands: { white: ['pacifism', 'coup', 'under-elf-hill'] } });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'b2' });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'b2' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'f5', to: 'g7' });
  state = act(state, { type: 'endTurn' });
  const pawn = structuredClone(state.pieces.find(piece => piece.id === 'white-pawn-b2')!);
  const effects = structuredClone(state.effects);
  state = act(state, { type: 'playCard', cardId: 'under-elf-hill' });
  assert.deepEqual(state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: null, zone: 'away' });
  assert.deepEqual(state.effects.filter(effect => ['pacifism', 'coup'].includes((effect as { type: string }).type)), effects);
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-e1')?.zone, 'board');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = returnKing(state, 'a8');
  assert.deepEqual(state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: 'a8', zone: 'board' });
  assert.deepEqual(state.effects.filter(effect => ['pacifism', 'coup'].includes((effect as { type: string }).type)), effects);
});

for (const to of ['b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'a2', 'a3', 'a4', 'c8', 'a6', 'a7', 'a8', 'b8'] as SquareName[]) {
  test(`Under Elf Hill returns after an opponent move to safe edge ${to}`, () => {
    const before = waiting();
    const king = before.pieces.find(piece => piece.id === 'white-king-e1')!;
    assert.equal(king.zone, 'away');
    const state = act(before, { type: 'returnKing', to } as unknown as GameAction);
    assert.equal(state.pieces.find(piece => piece.id === king.id)?.square, to);
    assert.equal(state.pieces.find(piece => piece.id === king.id)?.zone, 'board');
    assert.equal(state.turn.moveMade, false);
    assert.equal(state.turn.cardPlays.white, 0);
  });
}

test('Under Elf Hill rejects an edge square attacked by an opposing Pawn', () => {
  const state = waiting();
  const snapshot = structuredClone(state);
  const rejected = applyAction(state, { type: 'returnKing', to: 'a5' } as unknown as GameAction);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, snapshot);
});
