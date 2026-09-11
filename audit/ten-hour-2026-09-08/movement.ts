import assert from 'node:assert/strict';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSquare, parseSquare } from 'chessops/util';
import { applyAction, isKingInCheck, legalDests } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction, GameState } from '../../src/game/types.js';

export const started = performance.now();
export let checks = 0;
export function eq(actual: unknown, expected: unknown, label: string): void {
  assert.deepEqual(actual, expected, label); checks++;
}
export function act(state: GameState, action: GameAction): GameState {
  const before = JSON.stringify(state), result = applyAction(state, action);
  eq(JSON.stringify(state), before, 'input immutable');
  assert.ok(result.ok, result.ok ? '' : `${JSON.stringify(action)}: ${result.error.message}`); checks++;
  const board = result.state.pieces.filter(p => p.zone === 'board');
  eq(new Set(board.map(p => p.square)).size, board.length, 'no overlapping physical carriers');
  for (const p of result.state.pieces) eq(p.square !== null, p.zone === 'board', 'piece zone agrees with square');
  return result.state;
}
export function reject(state: GameState, action: GameAction): void {
  const before = JSON.stringify(state), result = applyAction(state, action);
  eq(result.ok, false, 'invalid action rejected');
  eq(JSON.stringify(state), before, 'rejection input immutable');
  eq(JSON.stringify(result.state), before, 'rejection state atomic');
}
export { createGameState, isKingInCheck, legalDests };
export type { GameState, GameAction };

const initial = createGameState();
eq([...legalDests(initial)].reduce((n, [, ds]) => n + ds.length, 0), 20, 'standard opening has twenty moves');
reject(initial, { type: 'move', from: 'e2', to: 'e5' });
reject(initial, { type: 'move', from: 'e7', to: 'e5' });
let ep = createGameState({ fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 0 2' });
ep = act(ep, { type: 'move', from: 'e5', to: 'd6' });
eq(ep.pieces.find(p => p.id === 'black-pawn-d5')?.zone, 'captured', 'en passant removes physical victim');
eq(ep.pieces.find(p => p.id === 'white-pawn-e5')?.square, 'd6', 'en passant destination');
for (const role of ['queen', 'rook', 'bishop', 'knight'] as const) {
  const promoted = act(createGameState({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' }), { type: 'move', from: 'a7', to: 'a8', promotion: role });
  eq(promoted.pieces.find(p => p.id === 'white-pawn-a7')?.role, role, 'all four promotions');
}
let cards = createGameState({ fen: '7k/5p2/8/8/8/2P5/5P2/K7 w - - 0 1', hands: { white: ['crab'], black: ['pacifism'] } });
cards = act(cards, { type: 'move', from: 'a1', to: 'a2' });
cards = act(cards, { type: 'playCard', cardId: 'crab', target: 'c3' });
cards = act(cards, { type: 'endTurn' });
cards = act(cards, { type: 'playCard', cardId: 'pacifism', target: 'f7' });
cards = act(cards, { type: 'move', from: 'h8', to: 'h7' });
cards = act(cards, { type: 'endTurn' });
eq(legalDests(cards).get('c3')?.sort(), ['b4', 'd4'], 'Crab geometry with Pacifism active');

// Same-library differential check verifies the adapter, not chessops itself.
for (let seed = 1; seed <= 3; seed++) {
  let random = seed, state = createGameState();
  for (let ply = 0; ply < 12 && !state.outcome; ply++) {
    const oracle = Chess.fromSetup(parseFen(state.fen).unwrap()).unwrap();
    const expected = [...oracle.allDests()].flatMap(([from, dests]) => [...dests].map(to => `${makeSquare(from)}${makeSquare(to)}`)).sort();
    const actual = [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => `${from}${to}`)).sort();
    eq(actual, expected, `ordinary destinations seed ${seed} ply ${ply}`);
    if (!actual.length) break;
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const uci = actual[random % actual.length]!;
    const from = uci.slice(0, 2) as 'a1', to = uci.slice(2) as 'a1';
    const piece = oracle.board.get(parseSquare(from)!);
    const promotion = piece?.role === 'pawn' && (to[1] === '8' || to[1] === '1') ? 'queen' as const : undefined;
    oracle.play({ from: parseSquare(from)!, to: parseSquare(to)!, ...(promotion ? { promotion } : {}) });
    state = act(state, { type: 'move', from, to, ...(promotion ? { promotion } : {}) });
    eq(state.fen, makeFen(oracle.toSetup()), 'ordinary move full FEN');
    if (!state.outcome) state = act(state, { type: 'endTurn' });
  }
}
console.log(JSON.stringify({ sentinel: 'MOVEMENT_PARENT_OK', checks, findings: 0, ms: performance.now() - started }));
