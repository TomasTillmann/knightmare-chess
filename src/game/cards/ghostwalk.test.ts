import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardMove, GameState } from '../types.js';

const target: CardMove = { from: 'a1', to: 'a4' };
const stateWithGhostwalk = (fen: string): GameState => createGameState({ fen, hands: { white: ['ghostwalk'] } });
const playGhostwalk = (state: GameState, move: CardMove = target) =>
  applyAction(state, { type: 'playCard', cardId: 'ghostwalk', target: [move] });
const hasGhostwalkTarget = (state: GameState, move: CardMove): boolean =>
  cardPlayTargets(state, 'ghostwalk').some(candidate => {
    const listed = (candidate as CardMove[])[0];
    return listed?.from === move.from && listed.to === move.to;
  });

for (const [color, fen, move] of [
  ['white', '7k/8/8/8/8/8/3P4/2B4K w - - 0 1', { from: 'c1', to: 'e3' }],
  ['white', '7k/8/8/8/8/2P5/2P5/7K w - - 0 1', { from: 'c2', to: 'c4' }],
  ['black', '2b4k/3p4/8/8/8/8/8/7K b - - 0 1', { from: 'c8', to: 'e6' }],
  ['black', '7k/2p5/2p5/8/8/8/8/7K b - - 0 1', { from: 'c7', to: 'c5' }],
] as const) {
  test(`Ghostwalk passes a Coup royal ${color} piece from ${move.from} through its friendly blocker`, () => {
    let state = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { [color]: ['coup', 'ghostwalk'] } });
    const royal = state.pieces.find(piece => piece.square === move.from)!;
    const coup = applyAction(state, { type: 'playCard', cardId: 'coup', target: move.from });
    assert.equal(coup.ok, true);
    state = coup.state;
    for (const action of [
      { type: 'endTurn' },
      { type: 'move', from: color === 'white' ? 'h8' : 'h1', to: color === 'white' ? 'g8' : 'g1' },
      { type: 'endTurn' },
    ] as const) {
      const result = applyAction(state, action);
      assert.equal(result.ok, true);
      state = result.state;
    }
    assert.equal(hasGhostwalkTarget(state, move), true);
    const result = playGhostwalk(state, move);
    assert.equal(result.ok, true);
    assert.equal(result.state.pieces.find(piece => piece.id === royal.id)?.square, move.to);
    assert.equal(result.state.pieces.find(piece => piece.id === royal.id)?.royal, true);
  });
}

test('publishes Ghostwalk metadata', () => {
  assert.deepEqual(CARD_CATALOG.ghostwalk, {
    id: 'ghostwalk',
    name: 'Ghostwalk',
    points: 5,
    unique: false,
    image: '/KC8_card1.png',
    description: 'On this move, one of your pieces gains the ability to pass through your own pieces. It may not pass through enemy pieces, and must end its move on an empty square, without capturing. Its move must be otherwise legal.',
    timing: ['beforeMove'],
    continuing: false,
  });
});

test('Ghostwalk lets a rook cross two friendly blockers', () => {
  const state = stateWithGhostwalk('7k/8/8/8/8/P7/P7/R6K w - - 0 1');
  assert.equal(hasGhostwalkTarget(state, target), true);

  const result = playGhostwalk(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.role === 'rook')?.square, 'a4');
  assert.deepEqual(result.state.pieces.filter(piece => piece.role === 'pawn').map(piece => piece.square).sort(), ['a2', 'a3']);
});

test('Ghostwalk lets a bishop cross a friendly diagonal blocker', () => {
  const state = stateWithGhostwalk('7k/8/8/8/8/8/3P4/2B4K w - - 0 1');
  const move: CardMove = { from: 'c1', to: 'f4' };
  assert.equal(hasGhostwalkTarget(state, move), true);

  const result = playGhostwalk(state, move);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.role === 'bishop')?.square, 'f4');
  assert.equal(result.state.pieces.find(piece => piece.role === 'pawn')?.square, 'd2');
});

test('Ghostwalk rejects an enemy blocker atomically', () => {
  const state = stateWithGhostwalk('7k/8/8/8/8/8/p7/R6K w - - 0 1');
  const before = structuredClone(state);
  assert.equal(hasGhostwalkTarget(state, target), false);

  const result = playGhostwalk(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Ghostwalk rejects occupied friendly and enemy destinations without capture', () => {
  for (const fen of [
    '7k/8/8/8/P7/8/8/R6K w - - 0 1',
    '7k/8/8/8/p7/8/8/R6K w - - 0 1',
  ]) {
    const state = stateWithGhostwalk(fen);
    const before = structuredClone(state);
    assert.equal(hasGhostwalkTarget(state, target), false);

    const result = playGhostwalk(state);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  }
});

test('Ghostwalk supports Pawn passage but rejects illegal geometry and Knight or King sources', () => {
  const pawnMove: CardMove = { from: 'a2', to: 'a4' };
  const pawnState = stateWithGhostwalk('7k/8/8/8/8/P7/P7/7K w - - 0 1');
  assert.equal(hasGhostwalkTarget(pawnState, pawnMove), true);
  const pawnResult = playGhostwalk(pawnState, pawnMove);
  assert.equal(pawnResult.ok, true);
  assert.deepEqual(
    pawnResult.state.pieces.filter(piece => piece.role === 'pawn').map(piece => piece.square).sort(),
    ['a3', 'a4'],
  );

  const cases: Array<{ fen: string; move: CardMove }> = [
    { fen: '7k/8/8/8/8/8/8/R6K w - - 0 1', move: { from: 'a1', to: 'b2' } },
    { fen: '7k/8/8/8/8/8/8/1N5K w - - 0 1', move: { from: 'b1', to: 'c3' } },
    { fen: '7k/8/8/8/8/8/8/K7 w - - 0 1', move: { from: 'a1', to: 'b1' } },
  ];

  for (const { fen, move } of cases) {
    const state = stateWithGhostwalk(fen);
    const before = structuredClone(state);
    assert.equal(hasGhostwalkTarget(state, move), false);
    const result = playGhostwalk(state, move);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  }
});

test('Ghostwalk remains blocked by Forbidden City on its path or destination', () => {
  const moves: CardMove[] = [target, { from: 'a1', to: 'a2' }];

  for (const move of moves) {
    const state = stateWithGhostwalk('7k/8/8/8/8/P7/8/R6K w - - 0 1');
    state.effects.push({
      type: 'forbidden-city',
      owner: 'white',
      card: { id: 'marker', cardId: 'forbidden-city' },
      square: 'a2',
    });
    const before = structuredClone(state);
    assert.equal(hasGhostwalkTarget(state, move), false);
    const result = playGhostwalk(state, move);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  }
});

test('Ghostwalk fizzles on self-check or direct checkmate with restored-board spending semantics', () => {
  const cases: Array<{ fen: string; move: CardMove; reason: 'SELF_CHECK' | 'DIRECT_MATE' }> = [
    {
      fen: '4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1',
      move: { from: 'e2', to: 'h2' },
      reason: 'SELF_CHECK',
    },
    {
      fen: '7k/8/5KP1/6Q1/8/8/8/8 w - - 0 1',
      move: { from: 'g5', to: 'g7' },
      reason: 'DIRECT_MATE',
    },
  ];

  for (const { fen, move, reason } of cases) {
    const state = createGameState({
      fen,
      hands: { white: ['ghostwalk'] },
      decks: { white: ['bombard'] },
    });
    const before = structuredClone(state);
    const spent = state.players.white.hand[0];
    const replacement = state.players.white.deck[0];
    const result = playGhostwalk(state, move);

    assert.equal(result.ok, true);
    assert.deepEqual(state, before);
    assert.equal(result.state.fen.split(' ')[0], before.fen.split(' ')[0]);
    assert.deepEqual(result.state.pieces, before.pieces);
    assert.deepEqual(result.state.players.white.hand, [replacement]);
    assert.deepEqual(result.state.players.white.deck, []);
    assert.deepEqual(result.state.players.white.discard, [spent]);
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.phase, 'afterMove');
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.equal(result.state.outcome, null);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.cardId, 'ghostwalk');
    assert.equal(result.state.history.at(-1)?.reason, reason);
  }
});

test('Ghostwalk target enumeration is legal, filtered, and stale-safe', () => {
  const legal = stateWithGhostwalk('7k/8/8/8/8/P7/P7/R6K w - - 0 1');
  const excluded: Array<{ state: GameState; move: CardMove }> = [
    { state: stateWithGhostwalk('7k/8/8/8/8/8/p7/R6K w - - 0 1'), move: target },
    { state: stateWithGhostwalk('7k/8/8/8/P7/8/8/R6K w - - 0 1'), move: target },
    {
      state: stateWithGhostwalk('7k/8/8/8/8/8/8/1N5K w - - 0 1'),
      move: { from: 'b1', to: 'c3' },
    },
  ];

  assert.equal(hasGhostwalkTarget(legal, target), true);
  for (const entry of excluded) assert.equal(hasGhostwalkTarget(entry.state, entry.move), false);

  const enumerated = cardPlayTargets(legal, 'ghostwalk').find(candidate => {
    const listed = (candidate as CardMove[])[0];
    return listed?.from === target.from && listed.to === target.to;
  }) as CardMove[] | undefined;
  assert.ok(enumerated);
  const stale = stateWithGhostwalk('7k/8/8/8/8/8/p7/R6K w - - 0 1');
  const before = structuredClone(stale);
  const result = applyAction(stale, { type: 'playCard', cardId: 'ghostwalk', target: enumerated });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);

  const malformed: Array<{ state: GameState; target: unknown }> = [
    { state: stateWithGhostwalk('7k/8/8/8/8/P7/P7/R6K w - - 0 1'), target },
    { state: stateWithGhostwalk('7k/8/8/8/8/P7/P7/R6K w - - 0 1'), target: [] },
    {
      state: stateWithGhostwalk('7k/8/8/8/8/P7/P7/R6K w - - 0 1'),
      target: [{ ...target, extra: true }],
    },
    {
      state: createGameState({
        fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
        phase: 'afterMove',
        hands: { white: ['ghostwalk'] },
      }),
      target: enumerated,
    },
    {
      state: createGameState({
        fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
        moveMade: true,
        hands: { white: ['ghostwalk'] },
      }),
      target: enumerated,
    },
  ];

  for (const entry of malformed) {
    const snapshot = structuredClone(entry.state);
    const rejected = applyAction(entry.state, {
      type: 'playCard',
      cardId: 'ghostwalk',
      target: entry.target,
    });
    assert.equal(rejected.ok, false);
    assert.deepEqual(rejected.state, snapshot);
  }
});

test('Ghostwalk success is immutable and records its complete one-shot lifecycle', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'] },
    decks: { white: ['bombard'] },
  });
  const before = structuredClone(state);
  const spent = state.players.white.hand[0];
  const replacement = state.players.white.deck[0];
  const result = playGhostwalk(state);

  assert.equal(result.ok, true);
  assert.deepEqual(state, before);
  assert.equal(result.state.pieces.find(piece => piece.role === 'rook')?.square, 'a4');
  assert.deepEqual(result.state.players.white.hand, [replacement]);
  assert.deepEqual(result.state.players.white.deck, []);
  assert.deepEqual(result.state.players.white.discard, [spent]);
  assert.deepEqual(result.state.effects, before.effects);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'ghostwalk');
  assert.deepEqual(result.state.history.at(-1)?.target, [target]);
  assert.deepEqual(result.state.history.at(-1)?.movement, [target]);
});
