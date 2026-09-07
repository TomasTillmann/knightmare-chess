import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

function game() {
  return createGameState({ fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 7 12', hands: { white: ['hidden-passage'] }, decks: { white: ['coup'] } });
}

function play(state: GameState, cardId: string, target?: unknown) {
  const result = applyAction(state, { type: 'playCard', cardId, target });
  assert.equal(result.ok, true, `${cardId}: ${JSON.stringify(result.ok ? null : result.error)}`);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, cardId);
  return result.state;
}

function passage(state: GameState, from: SquareName, to: SquareName) {
  const after = play(state, 'hidden-passage', [{ from, to }]);
  const id = state.pieces.find(p => p.square === from)?.id;
  assert.equal(after.pieces.find(p => p.id === id)?.square, to);
  return after;
}

function end(state: GameState) {
  const result = applyAction(state, { type: 'endTurn' });
  assert.equal(result.ok, true);
  return result.state;
}

for (const to of ['a3', 'g4'] as SquareName[]) {
  test(`Hidden Passage crosses its own pawn wall to ${to}`, () => {
    const before = game();
    const result = applyAction(before, { type: 'playCard', cardId: 'hidden-passage', target: [{ from: 'e1', to }] });
    assert.equal(result.ok, true);
    const after = result.state;
    assert.equal(after.pieces.find(p => p.id === 'white-king-e1')?.square, to);
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(isKingInCheck(after, 'white'), false);
    assert.deepEqual(after.pieces.map(p => p.id).sort(), before.pieces.map(p => p.id).sort());
    assert.equal(after.players.white.discard.filter(c => c.cardId === 'hidden-passage').length, 1);
    assert.equal(after.players.white.hand[0]?.cardId, 'coup');
    assert.equal(after.fen.split(' ')[4], '8');
    assert.equal(after.fen.split(' ')[5], '12');
  });
}

for (const [role, square] of [['knight', 'b1'], ['pawn', 'a2']] as const) {
  test(`Hidden Passage relocates the actual Coup ${role} and preserves its marker`, () => {
    let before = createGameState({ fen: '7k/p7/8/8/8/8/P7/1N2K3 w - - 7 12', hands: { white: ['coup', 'hidden-passage'] }, phase: 'afterMove', moveMade: true });
    before = play(before, 'coup', square);
    before = end(before);
    const move = applyAction(before, { type: 'move', from: 'a7', to: 'a6' });
    assert.equal(move.ok, true);
    before = end(move.state);
    const to = role === 'pawn' ? 'b8' : 'b4';
    const original = before.pieces.find(p => p.square === square)!;
    const after = passage(before, square, to);
    const relocated = after.pieces.find(p => p.id === original.id)!;
    for (const field of ['id', 'owner', 'role', 'originalRole', 'promoted', 'royal', 'neutral', 'zone'] as const) assert.equal(relocated[field], original[field]);
    assert.deepEqual(after.effects, before.effects);
    assert.equal(after.pieces.find(p => p.id === original.id)?.promoted, false);
    assert.equal(after.fen.split(' ')[4], role === 'pawn' ? '0' : '1');
  });
}

for (const square of ['c3', 'a5'] as SquareName[]) {
  test(`Forbidden City ${square === 'a5' ? 'blocks the destination' : 'does not block a distant jump'}`, () => {
    const before = game();
    before.effects.push({ type: 'forbidden-city', owner: 'black', card: { id: 'city', cardId: 'forbidden-city' }, square });
    if (square === 'a5') {
      const result = applyAction(before, { type: 'playCard', cardId: 'hidden-passage', target: [{ from: 'e1', to: 'a5' }] });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, before);
      assert.ok(!cardPlayTargets(before, 'hidden-passage').some(t => JSON.stringify(t) === JSON.stringify([{ from: 'e1', to: 'a5' }])));
    } else passage(before, 'e1', 'a5');
  });
}

for (const magnet of ['e1', 'd1'] as SquareName[]) {
  test(`Fatal Attraction ${magnet === 'e1' ? 'expires when the royal magnet moves' : 'does not immobilize a neighboring royal'}`, () => {
    const before = game();
    if (magnet === 'd1') before.pieces.find(p => p.square === 'a1')!.square = 'd1';
    before.effects.push({ type: 'fatal-attraction', owner: 'white', card: { id: 'magnet', cardId: 'fatal-attraction' }, pieceId: before.pieces.find(p => p.square === magnet)!.id });
    const after = passage(before, 'e1', 'a3');
    assert.equal(after.effects.length, magnet === 'e1' ? 0 : 1);
    assert.equal(after.players.white.discard.filter(c => c.cardId === 'fatal-attraction').length, magnet === 'e1' ? 1 : 0);
  });
}

test('Hidden Passage arrival on a Man-Trap square leaves the royal safe', () => {
  const before = game();
  before.effects.push({ type: 'man-trap', owner: 'black', card: { id: 'trap', cardId: 'man-trap' }, square: 'a3' });
  const after = passage(before, 'e1', 'a3');
  assert.equal(after.pieces.find(p => p.id === 'white-king-e1')?.zone, 'board');
  assert.equal(isKingInCheck(after, 'white'), false);
});

for (const returnCard of [true, false]) {
  test(`Chaos restores Hidden Passage with returnCard=${returnCard}`, () => {
    const before = game();
    before.players.black.hand.push({ id: 'chaos', cardId: 'chaos' });
    const moved = passage(before, 'e1', 'a3');
    const after = play(moved, 'chaos', { returnCard });
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, before.fen);
    assert.equal(after.turn.moveMade, false);
    assert.equal(after.players.white.hand.some(c => c.cardId === 'hidden-passage'), returnCard);
    assert.equal(after.players.white.discard.some(c => c.cardId === 'hidden-passage'), !returnCard);
    assert.equal(after.turn.cardPlays.white, returnCard ? 0 : 1);
    assert.ok(!cardPlayTargets(after, 'hidden-passage').some(t => JSON.stringify(t) === JSON.stringify([{ from: 'e1', to: 'a3' }])));
    if (returnCard) {
      const repeat = applyAction(after, { type: 'playCard', cardId: 'hidden-passage', target: [{ from: 'e1', to: 'a3' }] });
      assert.equal(repeat.ok, false);
      assert.deepEqual(repeat.state, after);
      passage(after, 'e1', 'b3');
    }
  });
}

test('Fog of War restores the move and clocks while both cards stay spent', () => {
  const before = game();
  before.players.black.hand.push({ id: 'fog', cardId: 'fog-of-war' });
  const after = play(passage(before, 'e1', 'a3'), 'fog-of-war');
  assert.deepEqual(after.pieces, before.pieces);
  assert.equal(after.fen, before.fen);
  assert.equal(after.turn.moveMade, false);
  assert.equal(after.players.white.discard[0]?.cardId, 'hidden-passage');
  assert.equal(after.players.black.discard[0]?.cardId, 'fog-of-war');
  assert.equal(after.turn.cardPlays.white, 1);
  assert.equal(after.turn.cardPlays.black, 1);
  const replacement = applyAction(after, { type: 'move', from: 'a2', to: 'a3' });
  assert.equal(replacement.ok, true);
});

test('Plots Within Plots permits two saved Hidden Passages and no third ordinary move', () => {
  const before = game();
  before.players.white.hand.push({ id: 'plots', cardId: 'plots-within-plots' }, { id: 'second-passage', cardId: 'hidden-passage' });
  let after = play(before, 'plots-within-plots');
  after = passage(after, 'e1', 'a3');
  after = passage(after, 'a3', 'b3');
  assert.equal(after.players.white.discard.filter(c => c.cardId === 'hidden-passage').length, 2);
  assert.equal(after.fen.split(' ')[4], '9');
  assert.equal(after.turn.moveMade, true);
  const third = applyAction(after, { type: 'move', from: 'b3', to: 'c3' });
  assert.equal(third.ok, false);
  assert.deepEqual(third.state, after);
});

test('A Coup Prince is not an eligible Hidden Passage target', () => {
  let before = createGameState({ fen: '7k/p7/8/8/8/8/P7/1N2K3 w - - 7 12', hands: { white: ['coup', 'hidden-passage'] }, phase: 'afterMove', moveMade: true });
  before = end(play(before, 'coup', 'b1'));
  const move = applyAction(before, { type: 'move', from: 'a7', to: 'a6' });
  assert.equal(move.ok, true);
  before = end(move.state);
  const result = applyAction(before, { type: 'playCard', cardId: 'hidden-passage', target: [{ from: 'e1', to: 'a3' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Hidden Passage preserves a physical Pacifism marker during quiet relocation', () => {
  const before = game();
  before.effects.push({ type: 'pacifism', owner: 'white', card: { id: 'peace', cardId: 'pacifism' }, pieceId: 'white-king-e1' });
  const after = passage(before, 'e1', 'a3');
  assert.deepEqual(after.effects, before.effects);
});

function cardIds(state: GameState) {
  return Object.values(state.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]).map(c => c.id).sort();
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Hidden Passage seeded integration ${seed}: four actual advertised legal plies`, () => {
    let rng = seed;
    const choose = (length: number) => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng % length;
    };
    const before = game();
    const ids = before.pieces.map(p => p.id).sort();
    const cards = cardIds(before);
    const invariant = (state: GameState) => {
      assert.deepEqual(state.pieces.map(p => p.id).sort(), ids);
      assert.deepEqual(cardIds(state), cards);
      const occupied = state.pieces.filter(p => p.zone === 'board').map(p => p.square);
      assert.equal(new Set(occupied).size, occupied.length);
      assert.ok(occupied.every(s => s !== null));
      assert.ok(state.pieces.filter(p => p.zone !== 'board').every(p => p.square === null));
      assert.equal(state.pieces.filter(p => p.royal && p.zone === 'board').length, 2);
      assert.equal(state.players.white.discard.filter(c => c.cardId === 'hidden-passage').length, 1);
    };
    const destinations = ['a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3', 'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4'] as SquareName[];
    const to = destinations[choose(destinations.length)]!;
    assert.ok(cardPlayTargets(before, 'hidden-passage').some(target => JSON.stringify(target) === JSON.stringify([{ from: 'e1', to }])));
    let state = passage(before, 'e1', to);
    invariant(state);
    assert.equal(state.fen.split(' ')[4], '8');
    assert.equal(state.fen.split(' ')[5], '12');
    assert.equal(isKingInCheck(state, 'white'), false);
    let executed = 0;
    for (let ply = 0; ply < 4; ply++) {
      state = end(state);
      invariant(state);
      const available = [...legalDests(state, false)].flatMap(([from, tos]) => tos.map(to => ({ from, to })));
      assert.ok(available.length > 0, `seed ${seed}, ply ${ply}: no advertised continuation`);
      const move = available[choose(available.length)]!;
      const mover = state.pieces.find(p => p.square === move.from)!;
      const color = state.turn.color;
      const oldHalf = Number(state.fen.split(' ')[4]);
      const oldFull = Number(state.fen.split(' ')[5]);
      const boardCount = state.pieces.filter(p => p.zone === 'board').length;
      const result = applyAction(state, { type: 'move', ...move });
      assert.equal(result.ok, true, `seed ${seed}, ply ${ply}: advertised ${JSON.stringify(move)} must execute`);
      state = result.state;
      executed++;
      assert.equal(state.history.at(-1)?.type, 'move');
      assert.equal(isKingInCheck(state, color), false);
      invariant(state);
      const captured = state.pieces.filter(p => p.zone === 'board').length < boardCount;
      const pawnMoved = mover.originalRole === 'pawn' && !mover.promoted;
      assert.equal(Number(state.fen.split(' ')[4]), captured || pawnMoved ? 0 : oldHalf + 1);
      assert.equal(Number(state.fen.split(' ')[5]), oldFull + (color === 'black' ? 1 : 0));
      assert.equal(state.turn.moveMade, true);
    }
    assert.equal(executed, 4);
  });
}
