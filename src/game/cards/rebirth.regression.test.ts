import assert from 'node:assert/strict';
import test from 'node:test';

import { makeBoardFen, parseFen } from 'chessops/fen';

import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardMove, GameState } from '../types.js';

function rng(seed: number): () => number {
  return () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)) >>> 0) / 2 ** 32;
}

function assertState(state: GameState): void {
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(board.every(piece => piece.square !== null));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  for (const owner of ['white', 'black'] as const) {
    assert.equal(board.filter(piece => piece.owner === owner && piece.royal).length, 1);
  }
  const cards = Object.values(state.players).flatMap(player => [player.hand, player.deck, player.discard].flat());
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  assert.equal(makeBoardFen(parseFen(state.fen).unwrap().board), boardFen(state));
}

function pick<T>(items: readonly T[], random: () => number): T {
  assert.ok(items.length > 0);
  return items[Math.floor(random() * items.length)]!;
}

test('seeded orientation and target preserve the relocated enemy physical identity', () => {
  const random = rng(0x11);
  const state = createGameState({
    fen: '8/8/8/2K2k2/3n4/8/8/8 w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: ['rebirth'] },
  });
  state.orientation = pick([0, 90, 180, 270] as const, random);
  const target = pick(cardPlayTargets(state, 'rebirth') as CardMove[][], random);
  const moved = state.pieces.find(piece => piece.square === target[0]!.from)!;
  const result = applyAction(state, { type: 'playCard', cardId: 'rebirth', target });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === moved.id)?.square, target[0]!.to);
  assertState(result.state);
});

test('seeded occupied home target captures exactly the selected actor-owned bishop', () => {
  const random = rng(0x22);
  const state = createGameState({
    fen: 'B3k2B/8/8/8/3r4/8/8/4K3 w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: ['rebirth'] },
  });
  const target = pick((cardPlayTargets(state, 'rebirth') as CardMove[][]).filter(
    moves => moves[0]!.from === 'd4' && ['a8', 'h8'].includes(moves[0]!.to),
  ), random);
  const captured = state.pieces.find(piece => piece.square === target[0]!.to)!;
  const survivor = state.pieces.find(piece => piece.role === 'bishop' && piece.id !== captured.id)!;
  const card = state.players.white.hand[0]!;
  const result = applyAction(state, { type: 'playCard', cardId: 'rebirth', target });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === captured.id)?.zone, 'captured');
  assert.equal(result.state.pieces.find(piece => piece.id === survivor.id)?.zone, 'board');
  assert.equal(result.state.history.at(-1)?.capturedId, captured.id);
  assert.ok(result.state.players.white.discard.some(item => item.id === card.id));
  assert.equal(result.state.players.white.hand.some(item => item.id === card.id), false);
  assertState(result.state);
});

test('seeded promoted and neutral sources retain their physical metadata', () => {
  const random = rng(0x33);
  for (const neutral of [false, true]) {
    const state = createGameState({
      fen: '8/8/8/2K2k2/3p4/8/8/8 w - - 0 1',
      phase: 'afterMove', moveMade: true, hands: { white: ['rebirth'] },
    });
    state.orientation = pick([0, 90, 180, 270] as const, random);
    const pawn = state.pieces.find(piece => piece.square === 'd4')!;
    Object.assign(pawn, { role: 'queen', promoted: true, neutral });
    state.fen = `${boardFen(state)} w - - 0 1`;
    const candidates = (cardPlayTargets(state, 'rebirth') as CardMove[][]).filter(
      moves => moves[0]!.from === 'd4',
    );
    const target = pick(candidates.filter(candidate => {
      const trial = applyAction(state, { type: 'playCard', cardId: 'rebirth', target: candidate });
      return trial.ok
        && trial.state.pieces.find(piece => piece.id === pawn.id)?.square === candidate[0]!.to;
    }), random);
    const result = applyAction(state, { type: 'playCard', cardId: 'rebirth', target });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const reborn = result.state.pieces.find(piece => piece.id === pawn.id)!;
    assert.deepEqual(
      { id: reborn.id, owner: reborn.owner, originalRole: reborn.originalRole, role: reborn.role,
        promoted: reborn.promoted, neutral: reborn.neutral, square: reborn.square },
      { id: pawn.id, owner: 'black', originalRole: 'pawn', role: 'queen',
        promoted: true, neutral, square: target[0]!.to },
    );
    assertState(result.state);
  }
});

test('seed-shuffled illegal Rebirth plays are atomic', () => {
  const random = rng(0x44);
  const base = (fen = '8/8/8/2K2k2/3r4/8/8/8 w - - 0 1') => createGameState({
    fen, phase: 'afterMove', moveMade: true, hands: { white: ['rebirth'] },
  });
  const cases: Array<() => { state: GameState; target: unknown }> = [
    () => ({ state: base(), target: { from: 'd4', to: 'a8' } }),
    () => ({
      state: base('8/8/8/2K2k2/3R4/8/8/8 w - - 0 1'),
      target: [{ from: 'd4', to: 'a1' }],
    }),
    () => ({
      state: base('b7/8/8/2K2k2/3r4/8/8/8 w - - 0 1'),
      target: [{ from: 'd4', to: 'a8' }],
    }),
    () => {
      const state = base('B7/8/8/2K2k2/3r4/8/8/8 w - - 0 1');
      const bishop = state.pieces.find(piece => piece.square === 'a8')!;
      state.effects.push({ type: 'pacifism', owner: 'white',
        card: { id: 'white-effect-pacifism', cardId: 'pacifism' }, pieceId: bishop.id });
      return { state, target: [{ from: 'd4', to: 'a8' }] };
    },
    () => {
      const state = base('B7/8/8/2K2k2/3r4/8/8/8 w - - 0 1');
      state.effects.push({ type: 'truce', owner: 'white',
        card: { id: 'white-effect-truce', cardId: 'truce' } });
      return { state, target: [{ from: 'd4', to: 'a8' }] };
    },
    () => {
      const state = base('8/8/8/2K2k2/8/8/8/8 w - - 0 1');
      state.pieces.push({ id: 'black-rook-d4', owner: 'black', role: 'rook', originalRole: 'rook',
        square: null, zone: 'dead', promoted: false, royal: false, neutral: false });
      state.history.push({ type: 'move', capturedId: 'black-rook-d4' });
      state.history.push({ type: 'cardPlayed', cardId: 'no-quarter' });
      return { state, target: [{ from: 'd4', to: 'a8' }] };
    },
  ];
  for (let index = cases.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [cases[index], cases[swap]] = [cases[swap]!, cases[index]!];
  }
  for (const makeCase of cases) {
    const { state, target } = makeCase();
    assertState(state);
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'rebirth', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assertState(result.state);
  }
});

test('ordinary seeded move preserves prior Earthquake state before seeded Rebirth', () => {
  const random = rng(0x55);
  const state = createGameState({
    fen: '5k2/8/8/2K5/3r4/8/8/1N6 w - - 0 1',
    hands: { white: ['rebirth'] }, decks: { white: ['rebirth'] },
  });
  state.orientation = 90;
  const earthquake: GameState['effects'][number] = {
    type: 'earthquake', owner: 'white',
    card: { id: 'earthquake-effect', cardId: 'earthquake' },
    direction: 'clockwise', target: { direction: 'clockwise', promotions: [] },
  };
  state.effects.push(earthquake);
  state.history.push({ type: 'cardPlayed', cardId: 'earthquake' });
  const priorHistory = structuredClone(state.history);
  const moveTo = pick(legalDests(state).get('b1') ?? [], random);
  const moved = applyAction(state, { type: 'move', from: 'b1', to: moveTo });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assertState(moved.state);
  assert.deepEqual(moved.state.effects[0], earthquake);
  assert.deepEqual(moved.state.history.slice(0, priorHistory.length), priorHistory);

  const card = moved.state.players.white.hand[0]!;
  const deckCard = moved.state.players.white.deck[0]!;
  const historyBeforeCard = structuredClone(moved.state.history);
  const target = pick(cardPlayTargets(moved.state, 'rebirth') as CardMove[][], random);
  const reborn = applyAction(moved.state, { type: 'playCard', cardId: 'rebirth', target });
  assert.equal(reborn.ok, true);
  if (!reborn.ok) return;
  assert.deepEqual(reborn.state.effects[0], earthquake);
  assert.deepEqual(reborn.state.history.slice(0, historyBeforeCard.length), historyBeforeCard);
  assert.ok(reborn.state.players.white.discard.some(item => item.id === card.id));
  assert.equal(reborn.state.players.white.hand.some(item => item.id === card.id), false);
  assert.ok(reborn.state.players.white.hand.some(item => item.id === deckCard.id));
  assert.equal(reborn.state.players.white.deck.some(item => item.id === deckCard.id), false);
  assertState(reborn.state);
});
