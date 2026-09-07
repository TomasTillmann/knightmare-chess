import assert from 'node:assert/strict';
import test from 'node:test';
import * as engine from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const initial = () => createGameState({ fen: '7k/6n1/8/8/8/8/1P6/R3K3 w - - 7 3', hands: { white: ['under-elf-hill'] }, decks: { white: ['panic', 'crab'] } });
function act(state: GameState, action: unknown): GameState {
  const result = engine.applyAction(state, action as GameAction);
  assert.equal(result.ok, true);
  return result.state;
}
function depart(state = initial()): GameState {
  const next = act(state, { type: 'playCard', cardId: 'under-elf-hill' });
  assert.ok(next.history.some(event => event.type === 'cardPlayed' && event.cardId === 'under-elf-hill'));
  return next;
}
function due(): GameState {
  let state = act(depart(), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  return act(state, { type: 'endTurn' });
}
function choices(state: GameState): SquareName[] {
  const fn = (engine as unknown as { underElfHillReturnSquares?: (s: GameState) => SquareName[] }).underElfHillReturnSquares;
  assert.equal(typeof fn, 'function');
  return fn!(state);
}
function rejected(state: GameState, action: unknown): void {
  const snapshot = structuredClone(state);
  const result = engine.applyAction(state, action as GameAction);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
}

test('Under Elf Hill has the printed regular-card metadata', () => {
  const card = CARD_CATALOG['under-elf-hill'];
  assert.ok(card);
  assert.equal(card.points, 7);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
  assert.equal(card.image, '/KC15_card3.png');
});

test('Under Elf Hill removes the same royal piece without capture', () => {
  const state = initial();
  const king = state.pieces.find(p => p.royal && p.owner === 'white')!;
  const next = depart(state);
  assert.deepEqual(next.pieces.find(p => p.id === king.id), { ...king, square: null, zone: 'away' });
  assert.deepEqual(next.pieces.filter(p => p.id !== king.id), state.pieces.filter(p => p.id !== king.id));
});
test('Under Elf Hill consumes one move and replaces exactly one card', () => {
  const next = depart();
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.turn.cardPlays.white, 1);
  assert.deepEqual(next.players.white.hand.map(c => c.cardId), ['panic']);
  assert.deepEqual(next.players.white.deck.map(c => c.cardId), ['crab']);
  assert.deepEqual(next.players.white.discard.map(c => c.cardId), ['under-elf-hill']);
  assert.deepEqual(next.fen.split(' ').slice(4), ['8', '3']);
});
test('Black departure advances the halfmove and fullmove clocks once', () => {
  const state = createGameState({ fen: '4k3/6p1/8/8/8/8/1P6/4K3 b - - 7 3', hands: { black: ['under-elf-hill'] } });
  const next = depart(state);
  assert.equal(next.turn.moveMade, true);
  assert.deepEqual(next.fen.split(' ').slice(4), ['8', '4']);
});
test('Under Elf Hill rejects use after the regular move', () => {
  rejected(act(initial(), { type: 'move', from: 'b2', to: 'b3' }), { type: 'playCard', cardId: 'under-elf-hill' });
});
test('return choices are empty before departure and during the opponent turn', () => {
  assert.deepEqual(choices(initial()), []);
  assert.deepEqual(choices(depart()), []);
  assert.deepEqual(choices(act(depart(), { type: 'endTurn' })), []);
});
test('return choices contain safe vacant edges but no occupied or interior squares', () => {
  const squares = choices(due());
  assert.ok(squares.includes('c1'));
  assert.ok(!squares.includes('a1'));
  assert.ok(!squares.includes('h8'));
  assert.ok(!squares.includes('d4'));
  assert.ok(squares.every(s => s[0] === 'a' || s[0] === 'h' || s[1] === '1' || s[1] === '8'));
});
test('a return restores physical identity without using resources or clocks', () => {
  const state = due();
  const king = state.pieces.find(p => p.owner === 'white' && p.royal)!;
  const next = act(state, { type: 'returnKing', to: 'c1' });
  assert.deepEqual(next.pieces.find(p => p.id === king.id), { ...king, square: 'c1', zone: 'board' });
  assert.deepEqual(next.players, state.players);
  assert.deepEqual(next.turn, state.turn);
  assert.deepEqual(next.fen.split(' ').slice(4), state.fen.split(' ').slice(4));
  assert.deepEqual(choices(next), []);
});
test('invalid return placements preserve the pending return', () => {
  const state = due();
  for (const to of ['a1', 'd4', 'h8', 'z9', null]) rejected(state, { type: 'returnKing', to });
  assert.ok(choices(state).includes('c1'));
});
test('return is rejected before the next owner turn', () => {
  for (const state of [initial(), depart(), act(depart(), { type: 'endTurn' })]) rejected(state, { type: 'returnKing', to: 'c1' });
});
test('mandatory return blocks other actions before placement', () => {
  const state = due();
  for (const action of [{ type: 'move', from: 'b2', to: 'b3' }, { type: 'endTurn' }, { type: 'playCard', cardId: 'panic' }]) rejected(state, action);
});
test('returned King cannot move but another piece may use the regular move', () => {
  const state = act(due(), { type: 'returnKing', to: 'c1' });
  rejected(state, { type: 'move', from: 'c1', to: 'd1' });
  assert.equal(act(state, { type: 'move', from: 'b2', to: 'b3' }).turn.moveMade, true);
});
test('departure answers an existing check without ending the game', () => {
  const next = depart(createGameState({ fen: '4r2k/6n1/8/8/8/8/1P6/R3K3 w - - 0 1', hands: { white: ['under-elf-hill'] } }));
  assert.equal(next.outcome, null);
  assert.equal(act(next, { type: 'endTurn' }).turn.color, 'black');
});
test('departure selects royal status and leaves the capturable Prince on board', () => {
  const state = createGameState({ fen: '7k/6n1/8/8/8/8/1P6/R2QK3 w - - 7 3', hands: { white: ['under-elf-hill'] } });
  const prince = state.pieces.find(p => p.square === 'e1')!;
  const royal = state.pieces.find(p => p.square === 'd1')!;
  prince.royal = false;
  royal.royal = true;
  const next = depart(state);
  assert.deepEqual(next.pieces.find(p => p.id === prince.id), prince);
  assert.deepEqual(next.pieces.find(p => p.id === royal.id), { ...royal, square: null, zone: 'away' });
});
test('an unpromoted original Pawn King resets the halfmove clock', () => {
  const state = initial();
  const king = state.pieces.find(p => p.owner === 'white' && p.royal)!;
  king.originalRole = 'pawn';
  assert.deepEqual(depart(state).fen.split(' ').slice(4), ['0', '3']);
});
test('a promoted original Pawn King increments the halfmove clock', () => {
  const state = initial();
  const king = state.pieces.find(p => p.owner === 'white' && p.royal)!;
  king.originalRole = 'pawn';
  king.promoted = true;
  assert.deepEqual(depart(state).fen.split(' ').slice(4), ['8', '3']);
});
test('departure expires en passant and only the acting King castling rights', () => {
  const state = createGameState({ fen: 'r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 7 3', hands: { white: ['under-elf-hill'] } });
  assert.equal(state.enPassant.length, 1);
  const next = depart(state);
  assert.deepEqual(next.enPassant, []);
  assert.deepEqual(next.fen.split(' ').slice(2, 4), ['kq', '-']);
});
test('new direct mate from departure fizzles while spending the card and move', () => {
  const state = createGameState({ fen: 'kr6/1p6/8/8/K7/8/8/R7 w - - 7 3', hands: { white: ['under-elf-hill'] }, decks: { white: ['panic'] } });
  assert.equal(engine.isKingInCheck(state, 'black'), false);
  const removed = structuredClone(state);
  const king = removed.pieces.find(p => p.owner === 'white' && p.royal)!;
  king.square = null;
  king.zone = 'away';
  removed.turn.color = 'black';
  removed.fen = engine.boardFen(removed);
  assert.equal(engine.isKingInCheck(removed, 'black'), true);
  assert.ok([...engine.legalDests(removed).values()].every(destinations => destinations.length === 0));
  const next = act(state, { type: 'playCard', cardId: 'under-elf-hill' });
  assert.deepEqual(next.pieces, state.pieces);
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.history.at(-1)?.type, 'cardFizzled');
  assert.equal(next.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.deepEqual(next.players.white.hand.map(c => c.cardId), ['panic']);
  assert.equal(next.outcome, null);
});
test('no legal return square ends the game in stalemate at the start of the owner turn', () => {
  const initialState = createGameState({ fen: 'pppppppk/p6p/p2n3p/p6p/p2K3p/p1N4p/p6p/pppppppp w - - 0 1', hands: { white: ['under-elf-hill'] } });
  assert.equal(engine.isKingInCheck(initialState, 'white'), false);
  const reply = createGameState({ fen: initialState.fen, turn: 'black' });
  assert.ok(engine.legalDests(reply).get('d6')?.includes('f5'));
  let state = act(depart(initialState), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd6', to: 'f5' });
  const next = act(state, { type: 'endTurn' });
  assert.deepEqual(next.outcome, { reason: 'stalemate' });
});
test('the physical King can move again after its return turn ends', () => {
  let state = act(due(), { type: 'returnKing', to: 'c1' });
  state = act(state, { type: 'move', from: 'b2', to: 'b3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'f5', to: 'g7' });
  state = act(state, { type: 'endTurn' });
  const next = act(state, { type: 'move', from: 'c1', to: 'd1' });
  assert.ok(next.pieces.some(p => p.owner === 'white' && p.royal && p.square === 'd1'));
});
test('a missing hand card, exhausted card allowance, or ended game rejects departure', () => {
  const noCard = initial();
  noCard.players.white.hand = [];
  const used = initial();
  used.turn.cardPlays.white = 1;
  const ended = initial();
  ended.outcome = { reason: 'stalemate' };
  for (const state of [noCard, used, ended]) rejected(state, { type: 'playCard', cardId: 'under-elf-hill' });
});
