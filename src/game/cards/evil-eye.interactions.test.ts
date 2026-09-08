import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import type { GameState, SquareName } from '../types.js';

const base = () => createGameState({ fen: '7k/6n1/8/8/R2n4/8/1P4P1/4K3 w - - 7 3', hands: { white: ['evil-eye'] } });
const at = (s: GameState, square: SquareName) => s.pieces.find(p => p.zone === 'board' && p.square === square)!;
const eye = (s: GameState, attacker: SquareName = 'a4', victim: SquareName = 'd4') => applyAction(s, { type: 'playCard', cardId: 'evil-eye', target: { attacker, victim } });
const played = (s: GameState) => {
  const result = eye(s);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'evil-eye');
  return result.state;
};

for (const [kind, square] of [['pacifism', 'a4'], ['pacifism', 'd4'], ['curse', 'a4']] as const) {
  test(`Evil Eye respects ${kind} on ${square}`, () => {
    const s = base();
    s.effects.push({ type: kind, owner: kind === 'pacifism' ? at(s, square).owner : 'black', card: { id: `effect-${kind}`, cardId: kind }, pieceId: at(s, square).id });
    const snapshot = structuredClone(s);
    assert.equal(eye(s).ok, false);
    assert.deepEqual(s, snapshot);
  });
}

for (const kind of ['crab', 'fatal-attraction'] as const) {
  test(`Evil Eye ${kind === 'crab' ? 'retains' : 'expires'} captured victim's ${kind}`, () => {
    const s = kind === 'crab' ? createGameState({ fen: '7k/6n1/8/8/R2p4/8/1P4P1/4K3 w - - 7 3', hands: { white: ['evil-eye'] } }) : base();
    s.effects.push({ type: kind, owner: 'black', card: { id: `effect-${kind}`, cardId: kind }, pieceId: at(s, 'd4').id });
    const next = played(s);
    if (kind === 'crab') {
      assert.deepEqual(next.effects, s.effects);
      assert.equal(next.pieces.find(p => p.id === at(s, 'd4').id)?.zone, 'captured');
      assert.equal(next.pieces.find(p => p.id === at(s, 'd4').id)?.square, null);
      assert.equal(next.players.black.discard.some(c => c.id === 'effect-crab'), false);
    } else {
      assert.equal(next.effects.some(e => (e as { type: string }).type === kind), false);
    }
    assert.equal(at(next, 'a4').id, at(s, 'a4').id);
});
}

function prepared(cardId: string, target?: unknown, fen = '7k/6n1/8/8/R2n4/8/1P4P1/4K3 b - - 7 3') {
  const beforeMove = cardId === 'pacifism';
  const start = createGameState({ fen, hands: { white: ['evil-eye'], black: [cardId] } });
  const move = (state: GameState) => {
    const result = applyAction(state, { type: 'move', from: 'g7', to: 'h5' });
    assert.equal(result.ok, true, `setup move ${cardId}`);
    assert.equal(result.state.history.at(-1)?.type, 'move');
    return result.state;
  };
  const setup = applyAction(beforeMove ? start : move(start), { type: 'playCard', cardId, target });
  assert.equal(setup.ok, true, `setup ${cardId}`);
  assert.equal(setup.state.history.at(-1)?.type, 'cardPlayed', `setup ${cardId} must resolve`);
  assert.equal(setup.state.history.at(-1)?.cardId, cardId);
  const end = applyAction(beforeMove ? move(setup.state) : setup.state, { type: 'endTurn' });
  assert.equal(end.ok, true);
  return end.state;
}

for (const [card, target] of [
  ['pacifism', 'd4'], ['curse', 'a4'], ['truce', undefined],
  ['fortification', { from: 'b4', to: 'c4' }], ['forbidden-city', 'b4'],
] as const) {
  test(`Evil Eye cannot bypass actual ${card}`, () => {
    const s = prepared(card, target);
    assert.equal(legalDests(s, false).get('a4')?.includes('d4') ?? false, false);
    const before = structuredClone(s);
    const result = eye(s);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(s, before);
  });
}

test('Evil Eye captures an actual magnet and discards its retained card', () => {
  const s = prepared('fatal-attraction', 'd4');
  assert.ok(legalDests(s, false).get('a4')?.includes('d4'));
  const next = played(s);
  assert.equal(next.effects.length, 0);
  assert.equal(next.players.black.discard.filter(c => c.cardId === 'fatal-attraction').length, 1);
});

test('Evil Eye leaves its own magnet attached', () => {
  const s = base();
  const marker = { type: 'fatal-attraction', owner: 'white', card: { id: 'white-magnet', cardId: 'fatal-attraction' }, pieceId: at(s, 'a4').id };
  s.effects.push(marker);
  const next = played(s);
  assert.ok(next.effects.some(e => (e as { pieceId: string }).pieceId === marker.pieceId));
  assert.equal(at(next, 'a4').id, marker.pieceId);
});

test('Evil Eye cannot use an attacker immobilized by an adjacent magnet', () => {
  const s = createGameState({ fen: '7k/6n1/8/1b6/R2n4/8/1P4P1/4K3 w - - 7 3', hands: { white: ['evil-eye'] } });
  s.effects.push({ type: 'fatal-attraction', owner: 'black', card: { id: 'black-magnet', cardId: 'fatal-attraction' }, pieceId: at(s, 'b5').id });
  assert.equal(legalDests(s, false).get('a4')?.includes('d4') ?? false, false);
  assert.equal(eye(s).ok, false);
});

test('Evil Eye does not spring a destination Man-Trap', () => {
  const s = prepared('man-trap', 'd4');
  const next = played(s);
  assert.equal(at(next, 'a4').id, at(s, 'a4').id);
  assert.deepEqual(next.effects, s.effects);
});

test('Evil Eye leaves an unrelated wall in place', () => {
  const s = prepared('fortification', { from: 'a1', to: 'b1' });
  assert.deepEqual(played(s).effects, s.effects);
});

test('Evil Eye respects Crab capture powers without moving its Pawn', () => {
  const s = createGameState({ fen: '7k/6n1/8/3n4/2P5/8/1P4P1/4K3 w - - 7 3', hands: { white: ['evil-eye'] } });
  const pawn = at(s, 'c4');
  s.effects.push({ type: 'crab', owner: 'white', card: { id: 'white-crab', cardId: 'crab' }, pieceId: pawn.id });
  assert.ok(legalDests(s, false).get('c4')?.includes('d5'));
  const result = eye(s, 'c4', 'd5');
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(at(result.state, 'c4'), pawn);
  assert.deepEqual(result.state.effects, s.effects);
});

function composite(victim: boolean) {
  const s = createGameState({ fen: victim ? '7k/6n1/8/4b3/R2n4/8/1P4P1/4K3 w - - 7 3' : '7k/6n1/8/8/R2n4/2B5/1P4P1/4K3 w - - 7 3', hands: { white: ['evil-eye'] } });
  const carrier = at(s, victim ? 'd4' : 'a4');
  const component = at(s, victim ? 'e5' : 'c3');
  component.zone = 'away';
  component.square = null;
  s.effects.push({ type: 'confabulation', owner: carrier.owner, card: { id: 'merge', cardId: 'confabulation' }, pieceIds: [carrier.id, component.id] });
  s.fen = [boardFen(s), ...s.fen.split(' ').slice(1)].join(' ');
  return { s, carrier, component };
}

test('Evil Eye captures both physical components of a composite victim', () => {
  const { s, carrier, component } = composite(true);
  const next = played(s);
  for (const id of [carrier.id, component.id]) {
    assert.equal(next.pieces.find(p => p.id === id)?.zone, 'captured');
    assert.equal(next.pieces.find(p => p.id === id)?.square, null);
  }
  assert.equal(next.effects.length, 0);
});

test('Evil Eye preserves its composite attacker and component identities', () => {
  const { s, carrier, component } = composite(false);
  const next = played(s);
  assert.deepEqual(at(next, 'a4'), carrier);
  assert.deepEqual(next.pieces.find(p => p.id === component.id), component);
  assert.deepEqual(next.effects, s.effects);
});

test('Evil Eye cannot select a composite containing a royal component', () => {
  const { s, component } = composite(true);
  component.royal = true;
  at(s, 'h8').royal = false;
  assert.equal(eye(s).ok, false);
});

test('Plots enables two distinct physical Evil Eyes with no extra ordinary move', () => {
  let s = createGameState({ fen: '7k/6n1/8/8/R2n1n2/8/1P4P1/4K3 w - - 7 3', hands: { white: ['plots-within-plots', 'evil-eye', 'evil-eye'] } });
  const plots = applyAction(s, { type: 'playCard', cardId: 'plots-within-plots' });
  assert.equal(plots.ok, true);
  assert.equal(plots.state.history.at(-1)?.type, 'cardPlayed');
  s = played(plots.state);
  const second = eye(s, 'a4', 'f4');
  assert.equal(second.ok, true);
  assert.equal(second.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(second.state.history.at(-1)?.cardId, 'evil-eye');
  assert.equal(second.state.turn.cardPlays.white, 3);
  assert.equal(second.state.players.white.discard.filter(c => c.cardId === 'evil-eye').length, 2);
  assert.equal(applyAction(second.state, { type: 'move', from: 'a4', to: 'b4' }).ok, false);
});

function invariant(s: GameState, ids: string[]) {
  assert.deepEqual(s.pieces.map(p => p.id).sort(), ids);
  const occupied = s.pieces.filter(p => p.zone === 'board');
  assert.equal(new Set(occupied.map(p => p.square)).size, occupied.length);
  for (const p of s.pieces) assert.equal(p.square !== null, p.zone === 'board');
  assert.equal(boardFen(s), s.fen.split(' ')[0]);
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Evil Eye seeded integration ${seed}: four legal subsequent plies`, () => {
    let rng = seed;
    const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng; };
    const input = base();
    let s = input;
    const ids = s.pieces.map(p => p.id).sort();
    const before = structuredClone(s);
    assert.ok(legalDests(s, false).get('a4')?.includes('d4'));
    s = played(s);
    assert.deepEqual(input, before);
    invariant(s, ids);
    assert.equal(isKingInCheck(s, 'white'), false);
    let plies = 0;
    for (; plies < 4; plies++) {
      const end = applyAction(s, { type: 'endTurn' });
      assert.equal(end.ok, true);
      s = end.state;
      const choices = [...legalDests(s, false)].flatMap(([from, dests]) => dests.map(to => ({ from, to })));
      assert.ok(choices.length > 0, `seed ${seed}, ply ${plies}`);
      const selected = choices[random() % choices.length]!;
      const mover = at(s, selected.from);
      const promotion = mover.role === 'pawn' && isPromotionSquare(s, mover.owner, selected.to) ? 'queen' : undefined;
      const original = structuredClone(s);
      const move = applyAction(s, { type: 'move', ...selected, ...(promotion ? { promotion } : {}) });
      assert.equal(move.ok, true, `seed ${seed}, ply ${plies}`);
      assert.deepEqual(s, original);
      s = move.state;
      assert.equal(s.history.at(-1)?.type, 'move');
      assert.equal(isKingInCheck(s, mover.owner), false);
      invariant(s, ids);
    }
    assert.equal(plies, 4);
  });
}
