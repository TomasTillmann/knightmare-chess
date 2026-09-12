import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';

type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
const FEN = '7k/8/8/8/8/3p4/4P3/4K3 w - - 0 1';
const card = (id: string, cardId = 'vendetta') => ({ id, cardId });
function game(options: Options = {}): GameState { return createGameState(options); }
function active(options: Options = {}, extraEffects: unknown[] = []): GameState {
  const state = game(options);
  return { ...state, effects: [...state.effects, { type: 'vendetta', owner: 'white', card: card('white-v') }, ...extraEffects as GameState['effects']] };
}
function result(state: GameState, action: Action) { return applyAction(state, action); }
function move(state: GameState, from: string, to: string, promotion?: 'queen' | 'rook' | 'bishop' | 'knight') {
  return result(state, { type: 'move', from, to, ...(promotion ? { promotion } : {}) });
}
function at(state: GameState, square: string) { return state.pieces.find(p => p.zone === 'board' && p.square === square)!; }
function rejected(state: GameState, action: Action) { const before = structuredClone(state); const r = result(state, action); assert.equal(r.ok, false); assert.deepEqual(state, before); return r; }
function expectExpired(r: ReturnType<typeof result>) { assert.equal(r.ok, true); if (r.ok) { assert.equal(r.state.effects.filter(e => (e as { type?: string }).type === 'vendetta').length, 0); assert.ok(r.state.players.white.discard.some(c => c.id === 'white-v')); } }

test('an existing opponent capture is mandatory', () => { rejected(active({ fen: FEN }), { type: 'move', from: 'e2', to: 'e3' }); });
test('the qualifying capture succeeds and Vendetta remains active', () => {
  rejected(active({ fen: FEN }), { type: 'move', from: 'e2', to: 'e3' });
  const r = move(active({ fen: FEN }), 'e2', 'd3'); assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.state.effects.some(e => (e as { type?: string }).type === 'vendetta'), true);
});
test('Pacifism on attacker removes the capture', () => {
  const base = game({ fen: FEN }); const s: GameState = { ...base, effects: [{ type: 'vendetta', owner: 'white', card: card('white-v') }, { type: 'pacifism', owner: 'white', card: card('p', 'pacifism'), pieceId: at(base, 'e2').id }] };
  expectExpired(move(s, 'e2', 'e3'));
});
test('playing Pacifism on the attacker expires an opponent Vendetta immediately', () => {
  const base = game({ fen: FEN, hands: { white: ['pacifism'], black: [] } });
  const state: GameState = { ...base, effects: [{ type: 'vendetta', owner: 'black', card: card('black-v') }] };
  const before = structuredClone(state);
  const pacifism = state.players.white.hand[0]!;
  const r = result(state, { type: 'playCard', cardId: 'pacifism', cardInstanceId: pacifism.id, target: 'e2' } as Action);
  assert.equal(r.ok, true);
  assert.deepEqual(state, before);
  if (r.ok) {
    assert.equal(r.state.effects.some(e => (e as { type?: string }).type === 'vendetta'), false);
    assert.ok(r.state.effects.some(e => (e as { type?: string; card?: { id?: string } }).card?.id === pacifism.id));
    assert.deepEqual(r.state.players.black.discard.map(c => c.id), ['black-v']);
    assert.equal(r.state.players.white.discard.some(c => c.id === 'black-v'), false);
  }
});
test('Pacifism on victim removes the capture', () => {
  const base = game({ fen: FEN }); const p = at(base, 'd3'); const s = active({ fen: FEN }, [{ type: 'pacifism', owner: 'black', card: card('p', 'pacifism'), pieceId: p.id }]); expectExpired(move(s, 'e2', 'e3'));
});
test('Mystic Shield on victim removes the capture', () => {
  const base = game({ fen: FEN }); const p = at(base, 'd3'); const s = active({ fen: FEN }, [{ type: 'mysticshield', owner: 'black', card: card('m', 'mysticshield'), pieceId: p.id }]); expectExpired(move(s, 'e2', 'e3'));
});
test('Truce between owners removes the capture', () => { expectExpired(move(active({ fen: FEN }, [{ type: 'truce', owner: 'white', card: card('t', 'truce') }]), 'e2', 'e3')); });
test('neutral victim is excluded but an opponent-owned neutral victim is included', () => {
  const base = game({ fen: FEN }); const neutral: GameState = { ...active({ fen: FEN }), pieces: base.pieces.map(p => p.square === 'd3' ? { ...p, neutral: true, owner: 'white' as const } : p) }; expectExpired(move(neutral, 'e2', 'e3'));
  const opponent: GameState = { ...base, pieces: base.pieces.map(p => p.square === 'd3' ? { ...p, neutral: true, owner: 'black' as const } : p), effects: [{ type: 'vendetta', owner: 'white', card: card('white-v') }] }; assert.equal(move(opponent, 'e2', 'd3').ok, true);
});
test('a neutral mover may capture an opponent', () => { rejected(active({ fen: FEN }), { type: 'move', from: 'e2', to: 'e3' }); const base = game({ fen: FEN }); const s: GameState = { ...active({ fen: FEN }), pieces: base.pieces.map(p => p.square === 'e2' ? { ...p, neutral: true } : p) }; assert.equal(move(s, 'e2', 'd3').ok, true); });
test('transformed mover still has the capture obligation', () => { const base = game({ fen: '7k/8/8/8/8/2p5/4P3/4K3 w - - 0 1' }); const s: GameState = { ...base, pieces: base.pieces.map(p => p.square === 'e2' ? { ...p, role: 'knight' as const } : p), effects: [{ type: 'vendetta', owner: 'white', card: card('white-v') }] }; rejected(s, { type: 'move', from: 'e2', to: 'g1' }); });
test('multiple Vendetta effects survive a qualifying capture', () => { rejected(active({ fen: FEN }), { type: 'move', from: 'e2', to: 'e3' }); const s = active({ fen: FEN }, [{ type: 'vendetta', owner: 'black', card: card('black-v') }]); const r = move(s, 'e2', 'd3'); assert.equal(r.ok, true); if (r.ok) assert.equal(r.state.effects.filter(e => (e as { type?: string }).type === 'vendetta').length, 2); });
test('multiple effects discard exact owner cards when no capture exists', () => { const s = game({ fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1' }); const w = card('white-v'), b = card('black-v'); const state: GameState = { ...s, effects: [{ type: 'vendetta', owner: 'white', card: w }, { type: 'vendetta', owner: 'black', card: b }] }; const r = move(state, 'e2', 'e3'); assert.equal(r.ok, true); if (r.ok) { assert.ok(r.state.players.white.discard.some(c => c.id === w.id)); assert.ok(r.state.players.black.discard.some(c => c.id === b.id)); } });
test('no legal capture lets an ordinary move expire Vendetta with cards in hand', () => { const r = move(active({ fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1', hands: { white: ['fanatic'] } }), 'e2', 'e3'); assert.equal(r.ok, true); if (r.ok) { assert.equal(r.state.effects.some(e => (e as { type?: string }).type === 'vendetta'), false); assert.ok(r.state.players.white.discard.some(c => c.id === 'white-v')); } });
test('self-check pseudo-capture is not legal', () => { const s = active({ fen: '4r1k1/8/8/8/3p4/8/4N3/4K3 w - - 0 1' }); assert.equal(isKingInCheck(s, 'white'), false); assert.equal(legalDests(s).get('e2')?.includes('d4') ?? false, false); expectExpired(move(s, 'e1', 'f1')); });
test('en passant is a qualifying capture', () => { rejected(active({ fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 0 2' }), { type: 'move', from: 'e5', to: 'e6' }); assert.equal(move(active({ fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 0 2' }), 'e5', 'd6').ok, true); });
test('promotion capture is a qualifying capture', () => { rejected(active({ fen: '3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1' }), { type: 'move', from: 'e7', to: 'e8', promotion: 'queen' }); assert.equal(move(active({ fen: '3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1' }), 'e7', 'd8', 'queen').ok, true); });
test('Assassin own capture/replacement cannot bypass an opponent capture', () => { rejected(active({ fen: '7k/8/8/8/8/3p4/P3P3/R3K3 w - - 0 1', hands: { white: ['assassin'] } }), { type: 'playCard', cardId: 'assassin', target: [{ from: 'a1', to: 'a2' }] } as Action); });
test('Fanatic replacement cannot bypass Vendetta', () => { rejected(active({ fen: '7k/8/8/8/8/3p4/P3P3/4K3 w - - 0 1', hands: { white: ['fanatic'] } }), { type: 'playCard', cardId: 'fanatic', target: 'a2' } as Action); });
test('check still requires a legal capture escape', () => { const s = active({ fen: '7k/8/8/8/8/8/4r3/R3K3 w - - 0 1' }); assert.equal(isKingInCheck(s, 'white'), true); rejected(s, { type: 'move', from: 'e1', to: 'f1' }); assert.equal(move(s, 'e1', 'e2').ok, true); });
