import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, PieceState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const CAPTURE_FEN = '4k3/p7/8/8/8/8/1P6/R3K3 w - - 0 1';

function afterPawnCapture(options: Parameters<typeof createGameState>[0] = {}): GameState {
  const initial = createGameState({
    fen: CAPTURE_FEN,
    hands: { black: ['revenge'] },
    ...options,
  });
  const result = applyAction(initial, { type: 'move', from: 'a1', to: 'a7' });
  if (!result.ok) assert.fail(result.error.message);
  return result.state;
}

function findPiece(state: GameState, id: string): PieceState {
  const piece = state.pieces.find(candidate => candidate.id === id);
  assert.ok(piece);
  return piece;
}

function assertRejectedAtomically(state: GameState, target: unknown): void {
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target });
  assert.equal(result.ok, false);
  assert.deepEqual(state, before);
  assert.deepEqual(result.state, before);
}

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  if (!result.ok) assert.fail(`${JSON.stringify(action)}: ${result.error.code}: ${result.error.message}`);
  return result.state;
}

test('Revenge is unavailable and atomically rejected after a Dark Mirror Pawn capture', () => {
  const state = act(createGameState({
    fen: '7k/8/8/8/3P4/2p5/4P3/7K w - - 0 1',
    hands: { white: ['dark-mirror'], black: ['revenge'] },
  }), { type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'd4', to: 'c3' }] });
  assert.equal(findPiece(state, 'black-pawn-c3').zone, 'captured');
  const before = structuredClone(state);
  const targets = cardPlayTargets(state, 'revenge');
  assertRejectedAtomically(state, 'e2');
  assert.deepEqual(targets, []);
  assert.deepEqual(state, before);
});

// KC6_card2 requires capture without a card; KC7_card2 replaces the move.
for (const color of ['white', 'black'] as const) {
  const reactor = color === 'white' ? 'black' : 'white';
  const movement = { white: { from: 'd4', to: 'c3' }, black: { from: 'f5', to: 'g6' } } as const;
  const target = color === 'white' ? 'e2' : 'e7';
  for (const copied of [false, true]) {
    for (const plots of [false, true]) {
      test(`${color} ${copied ? 'copied' : 'original'} Dark Mirror excludes Revenge${plots ? ' through Plots' : ''}`, () => {
        const cardId = copied ? 'haunting-memories' : 'dark-mirror';
        let state = createGameState({
          fen: `7k/4p3/6P1/5p2/3P4/2p5/4P3/7K ${(copied ? reactor : color) === 'white' ? 'w' : 'b'} - - 0 1`,
          hands: {
            [color]: [cardId, cardId],
            [reactor]: ['dark-mirror', 'revenge', 'revenge', 'plots-within-plots'],
          },
          decks: { white: ['assassin', 'toll', 'crab'], black: ['assassin', 'toll', 'crab'] },
        });
        if (copied) {
          state = act(state, { type: 'playCard', cardId: 'dark-mirror', target: [movement[reactor]] });
          state = act(state, { type: 'endTurn' });
        }
        const card = state.players[color].hand[1];
        const beforeCapture = structuredClone(state);
        state = act(state, { type: 'playCard', cardId, cardInstanceId: card.id, target: [movement[color]] });
        assert.equal(findPiece(state, `${reactor}-pawn-${movement[color].to}`).zone, 'captured');
        assert.equal(state.history.at(-1)?.cardId, cardId);
        assert.equal(state.history.at(-1)?.copiedCardId, copied ? 'dark-mirror' : undefined);
        assert.deepEqual(state.players[color], {
          hand: [...beforeCapture.players[color].hand.filter(candidate => candidate.id !== card.id), beforeCapture.players[color].deck[0]],
          deck: beforeCapture.players[color].deck.slice(1), discard: [...beforeCapture.players[color].discard, card],
        });
        assert.deepEqual(state.players[reactor], beforeCapture.players[reactor]);
        if (plots) state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: reactor } });
        const before = structuredClone(state);
        const targets = cardPlayTargets(state, 'revenge');
        for (const square of [target, movement[color].to]) assertRejectedAtomically(state, square);
        assert.deepEqual(targets, []);
        assert.deepEqual(state, before);
        if (plots) {
          const allowance = state.plotsAllowances!.at(-1)!;
          assert.equal(allowance.remaining, 2);
          assert.ok(state.players[reactor].hand.filter(candidate => candidate.cardId === 'revenge')
            .every(candidate => !allowance.eligibleCards.includes(candidate.id)));
        }
      });
    }
  }
}

for (const [color, reactor, fen, from, to, target, kingFrom, kingTo, otherKingFrom, otherKingTo] of [
  ['white', 'black', '7k/8/8/8/8/2p5/3PP3/7K w - - 0 1', 'd2', 'c3', 'e2', 'h8', 'g8', 'h1', 'g1'],
  ['black', 'white', '7k/3pp3/2P5/8/8/8/8/7K b - - 0 1', 'd7', 'c6', 'e7', 'h1', 'g1', 'h8', 'g8'],
] as const) {
  test(`${color} ordinary capture permits Revenge with exact expenditure but no stale reuse`, () => {
    const state = act(createGameState({ fen, hands: { [reactor]: ['revenge', 'revenge'] },
      decks: { [reactor]: ['assassin', 'toll'] },
    }), { type: 'move', from, to });
    const before = structuredClone(state);
    assert.deepEqual(new Set(cardPlayTargets(state, 'revenge')), new Set([to, target]));
    assert.deepEqual(state, before);
    const card = state.players[reactor].hand[1];
    const played = act(state, { type: 'playCard', cardId: 'revenge', cardInstanceId: card.id, target });
    assert.equal(findPiece(played, `${color}-pawn-${target}`).zone, 'captured');
    assert.deepEqual(played.players[reactor], {
      hand: [state.players[reactor].hand[0], state.players[reactor].deck[0]],
      deck: state.players[reactor].deck.slice(1), discard: [card],
    });
    assert.deepEqual(played.players[color], state.players[color]);
    let stale = act(state, { type: 'endTurn' });
    assert.deepEqual(cardPlayTargets(stale, 'revenge'), []);
    assertRejectedAtomically(stale, target);
    stale = act(stale, { type: 'move', from: kingFrom, to: kingTo });
    stale = act(stale, { type: 'endTurn' });
    stale = act(stale, { type: 'move', from: otherKingFrom, to: otherKingTo });
    assert.equal(findPiece(stale, `${reactor}-pawn-${to}`).zone, 'captured');
    assert.equal(stale.history.at(-1)?.capturedId, undefined);
    assert.deepEqual(cardPlayTargets(stale, 'revenge'), []);
    assertRejectedAtomically(stale, target);
  });
}

for (const [color, reactor, fen, pawn, carrier, kingFrom, kingTo, victim, target] of [
  ['white', 'black', '7k/8/8/8/4p3/2N5/P1P5/7K w - - 0 1', 'c2', 'c3', 'h8', 'g8', 'e4', 'a2'],
  ['black', 'white', '7k/p1p5/2n5/4P3/8/8/8/7K b - - 0 1', 'c7', 'c6', 'h1', 'g1', 'e5', 'a7'],
] as const) {
  test(`${color} ordinary capture using existing Confabulation powers still permits Revenge`, () => {
    let state = mergedForRevenge({ fen, hands: { [color]: ['confabulation'], [reactor]: ['revenge'] } }, pawn, carrier);
    state = act(state, { type: 'move', from: kingFrom, to: kingTo });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: carrier, to: victim });
    assert.equal(state.history.at(-1)?.type, 'move');
    assert.equal(findPiece(state, `${reactor}-pawn-${victim}`).zone, 'captured');
    assert.ok(cardPlayTargets(state, 'revenge').includes(target));
    const played = act(state, { type: 'playCard', cardId: 'revenge', target });
    assert.equal(findPiece(played, `${color}-pawn-${target}`).zone, 'captured');
    assert.deepEqual(played.effects, state.effects);
  });
}

function mergedForRevenge(
  options: Parameters<typeof createGameState>[0] = {}, from = 'c2', to = 'c3',
): GameState {
  let state = createGameState({
    fen: '7k/8/5b1p/8/8/2N5/2P5/7K w - - 0 1',
    hands: { white: ['confabulation', 'revenge'] },
    ...options,
  });
  state = act(state, {
    type: 'playCard', cardId: 'confabulation', target: [{ from, to }],
  });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  return act(state, { type: 'endTurn' });
}

// KC6_card2: a Pawn captured without a card; KC7_card4: either component's eligibility.
for (const [color, carrier, fen, from, to, attacker, target] of [
  ['white', 'knight', '7k/8/5b1p/8/8/2N5/2P5/7K w - - 0 1', 'c2', 'c3', 'f6', 'h6'],
  ['white', 'pawn', '7k/8/5b1p/8/8/2P5/8/1N5K w - - 0 1', 'b1', 'c3', 'f6', 'h6'],
  ['black', 'knight', '7k/2p5/2n5/8/8/5B1P/8/7K b - - 0 1', 'c7', 'c6', 'f3', 'h3'],
  ['black', 'pawn', '1n5k/8/2p5/8/8/5B1P/8/7K b - - 0 1', 'b8', 'c6', 'f3', 'h3'],
] as const) {
  test(`Revenge recognizes a captured ${color} Pawn with a ${carrier} carrier`, () => {
    const ready = mergedForRevenge({ fen, hands: { [color]: ['confabulation', 'revenge'] } }, from, to);
    const ids = [`${color}-${carrier}-${to}`, `${color}-${carrier === 'knight' ? 'pawn' : 'knight'}-${from}`];
    const state = act(ready, { type: 'move', from: attacker, to });
    assert.equal(state.history.at(-1)?.capturedId, ids[0]);
    assert.deepEqual(state.history.at(-1)?.capturedIds, ids);
    for (const id of ids) assert.equal(findPiece(state, id).zone, 'captured');
    const before = structuredClone(state);
    assert.deepEqual(cardPlayTargets(state, 'revenge'), [target]);
    assert.deepEqual(state, before);
    const played = act(state, { type: 'playCard', cardId: 'revenge', target });
    const victim = state.pieces.find(piece => piece.square === target)!;
    assert.deepEqual(findPiece(played, victim.id), { ...victim, square: null, zone: 'captured', capturedBy: color });
    for (const id of ids) assert.deepEqual(findPiece(played, id), findPiece(state, id));
    assert.deepEqual(played.history.slice(0, -1), state.history);
  });
}

test('a captured composite without a Pawn cannot trigger Revenge', () => {
  const ready = mergedForRevenge({ fen: '7k/8/5b1p/8/8/2N5/2R5/7K w - - 0 1' });
  const state = act(ready, { type: 'move', from: 'f6', to: 'c3' });
  assert.equal(state.history.at(-1)?.capturedIds?.length, 2);
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('an uncaptured off-board Pawn component cannot trigger Revenge after a noncapture', () => {
  const state = act(mergedForRevenge(), { type: 'move', from: 'f6', to: 'e5' });
  assert.equal(findPiece(state, 'white-pawn-c2').zone, 'away');
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('a stale composite capture cannot trigger Revenge after a later Knight capture', () => {
  let state = mergedForRevenge({ fen: '7k/8/5b1p/8/8/2N5/2P1N3/7K w - - 0 1' });
  for (const action of [
    { type: 'move', from: 'f6', to: 'c3' }, { type: 'endTurn' },
    { type: 'move', from: 'e2', to: 'd4' }, { type: 'endTurn' },
    { type: 'move', from: 'c3', to: 'd4' },
  ] as const) state = act(state, action);
  assert.equal(state.history.at(-1)?.capturedId, 'white-knight-e2');
  assert.equal(findPiece(state, 'white-pawn-c2').zone, 'captured');
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('ending the capture turn expires a composite Revenge trigger', () => {
  const captured = act(mergedForRevenge(), { type: 'move', from: 'f6', to: 'c3' });
  const state = act(captured, { type: 'endTurn' });
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('No Quarter closes Revenge after the composite is made dead', () => {
  let state = mergedForRevenge({ hands: { white: ['confabulation', 'revenge'], black: ['no-quarter'] } });
  state = act(state, { type: 'move', from: 'f6', to: 'c3' });
  state = act(state, { type: 'playCard', cardId: 'no-quarter' });
  assert.equal(findPiece(state, 'white-pawn-c2').zone, 'dead');
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('restoring the captured Pawn component with Hostage closes Revenge', () => {
  let state = mergedForRevenge({
    fen: '7k/8/5b1p/8/8/2N5/2P4P/7K w - - 0 1',
    hands: { white: ['confabulation', 'hostage', 'revenge'] },
  });
  state = act(state, { type: 'move', from: 'f6', to: 'c3' });
  state = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'white-pawn-c2', pawn: 'h2' } });
  assert.equal(findPiece(state, 'white-pawn-c2').square, 'h2');
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('Revenge preserves target protection after a composite capture', () => {
  let state = mergedForRevenge({ hands: { white: ['confabulation', 'revenge'], black: ['pacifism'] } });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'h6' });
  state = act(state, { type: 'move', from: 'f6', to: 'c3' });
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('composite Revenge spends the selected physical card and draws exactly once', () => {
  const ready = mergedForRevenge({
    hands: { white: ['confabulation', 'revenge', 'revenge'] },
    decks: { white: ['assassin', 'crab', 'toll'] },
  });
  const state = act(ready, { type: 'move', from: 'f6', to: 'c3' });
  const card = state.players.white.hand.find(candidate => candidate.id === 'white-hand-2-revenge')!;
  const played = act(state, { type: 'playCard', cardId: 'revenge', cardInstanceId: card.id, target: 'h6' });
  assert.deepEqual(played.players.white, {
    hand: [...state.players.white.hand.filter(candidate => candidate.id !== card.id), state.players.white.deck[0]],
    deck: state.players.white.deck.slice(1), discard: [...state.players.white.discard, card],
  });
  assert.deepEqual(played.players.black, state.players.black);
  assert.deepEqual(played.turn, { ...state.turn, cardPlays: { ...state.turn.cardPlays, white: 1 } });
  assert.deepEqual(played.fen.split(' ').slice(1), state.fen.split(' ').slice(1));
  assert.deepEqual(played.enPassant, state.enPassant);
});

test('composite Revenge rejects an unowned physical card without consuming anything', () => {
  const state = act(mergedForRevenge(), { type: 'move', from: 'f6', to: 'c3' });
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'revenge', cardInstanceId: 'missing-revenge', target: 'h6' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

for (const [color, opponent, fen, kingFrom, kingTo, pawn, square, bishop, waiting, target] of [
  ['white', 'black', '7k/8/5b1p/8/2p5/2N5/8/7K w - - 0 1', 'h1', 'g1', 'c4', 'c3', 'f6', 'e5', 'h6'],
  ['black', 'white', '7k/8/2n5/2P5/8/5B1P/8/7K b - - 0 1', 'h8', 'g8', 'c5', 'c6', 'f3', 'e4', 'h3'],
] as const) {
  test(`Revenge remembers ${color}'s control of the captured opposing neutral Pawn component`, () => {
    let state = createGameState({ fen, hands: { [color]: ['neutrality', 'confabulation', 'revenge'] } });
    for (const action of [
      { type: 'move', from: kingFrom, to: kingTo },
      { type: 'playCard', cardId: 'neutrality', target: pawn }, { type: 'endTurn' },
      { type: 'move', from: bishop, to: waiting }, { type: 'endTurn' },
      { type: 'playCard', cardId: 'confabulation', target: [{ from: pawn, to: square }] },
      { type: 'endTurn' }, { type: 'move', from: waiting, to: square },
    ] as const) state = act(state, action);
    const id = `${opponent}-pawn-${pawn}`;
    assert.equal(state.history.at(-1)?.capturedId, `${color}-knight-${square}`);
    assert.ok(state.history.at(-1)?.capturedIds?.includes(id));
    assert.equal(findPiece(state, id).zone, 'captured');
    assert.equal(findPiece(state, id).neutral, false); // Neutrality expires on capture.
    assert.deepEqual(cardPlayTargets(state, 'revenge'), [target]);
    const played = act(state, { type: 'playCard', cardId: 'revenge', target });
    assert.equal(findPiece(played, `${opponent}-pawn-${target}`).zone, 'captured');
    assert.deepEqual(findPiece(played, id), findPiece(state, id));
  });
}

test('Revenge has the printed catalog metadata', () => {
  assert.deepEqual(CARD_CATALOG.revenge, {
    id: 'revenge',
    name: 'Revenge',
    points: 4,
    unique: false,
    image: '/KC6_card2.png',
    description: "Remove one of your opponent's Pawns from the chessboard. It is regarded as captured.",
    timing: ['afterOpponentMove'],
    continuing: false,
  });
});

for (const second of [false, true]) {
  test(`Plots preserves neutral capture control for Revenge as the ${second ? 'second' : 'first'} extra card`, () => {
    let state = createGameState({
      fen: '7k/8/8/8/8/P7/1PP5/R6K b - - 0 1',
      hands: { black: ['neutrality', 'revenge', 'plots-within-plots', 'revenge'] },
    });
    for (const action of [
      { type: 'move', from: 'h8', to: 'h7' },
      { type: 'playCard', cardId: 'neutrality', target: 'a3' }, { type: 'endTurn' },
      { type: 'move', from: 'a1', to: 'a3' },
    ] as const) state = act(state, action);
    assert.deepEqual(cardPlayTargets(state, 'revenge'), ['b2', 'c2']);
    state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
    if (second) state = act(state, { type: 'playCard', cardId: 'revenge', target: 'c2' });
    assert.deepEqual(cardPlayTargets(state, 'revenge'), second ? ['b2'] : ['b2', 'c2']);
    const played = act(state, { type: 'playCard', cardId: 'revenge', target: 'b2' });
    assert.equal(findPiece(played, 'white-pawn-b2').zone, 'captured');
    assert.deepEqual(findPiece(played, 'white-pawn-a3'), findPiece(state, 'white-pawn-a3'));
  });
}

test('Plots cannot reuse a composite Pawn component already returned by Hostage', () => {
  let state = mergedForRevenge({
    fen: '7k/8/5b1p/8/8/2N5/2P4P/7K w - - 0 1',
    hands: { white: ['confabulation', 'plots-within-plots', 'hostage', 'revenge'] },
  });
  for (const action of [
    { type: 'move', from: 'f6', to: 'c3' },
    { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'white' } },
    { type: 'playCard', cardId: 'hostage', target: { pieceId: 'white-pawn-c2', pawn: 'h2' } },
  ] as const) state = act(state, action);
  assert.equal(findPiece(state, 'white-pawn-c2').square, 'h2');
  assert.deepEqual(cardPlayTargets(state, 'revenge'), []);
  assertRejectedAtomically(state, 'h6');
});

test('reacts to an ordinary pawn capture and captures one opposing pawn', () => {
  const moved = afterPawnCapture({ decks: { black: ['assassin'] } });
  const before = structuredClone(moved);
  const targetBefore = structuredClone(findPiece(moved, 'white-pawn-b2'));
  const played = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'b2' });
  if (!played.ok) assert.fail(played.error.message);

  assert.deepEqual(findPiece(played.state, targetBefore.id), {
    ...targetBefore,
    square: null,
    zone: 'captured',
    capturedBy: 'black',
  });
  assert.deepEqual(findPiece(played.state, 'black-pawn-a7'), findPiece(before, 'black-pawn-a7'));
  assert.deepEqual(played.state.turn, {
    ...before.turn,
    cardPlays: { white: 0, black: 1 },
  });
  assert.deepEqual(played.state.fen.split(' ').slice(1), before.fen.split(' ').slice(1));
  assert.deepEqual(played.state.players.white, before.players.white);
  assert.deepEqual(played.state.players.black.hand.map(card => card.cardId), ['assassin']);
  assert.deepEqual(played.state.players.black.deck, []);
  assert.equal(played.state.players.black.discard[0]?.cardId, 'revenge');
  assert.deepEqual(played.state.history.slice(0, -1), before.history);
  assert.deepEqual(played.state.history.at(-1), {
    type: 'cardPlayed',
    cardId: 'revenge',
    target: 'b2',
    capturedId: 'white-pawn-b2',
    movement: [],
    preservePreviousMove: true,
  });
});

test('rejects atomically when the last ordinary move made no capture', () => {
  const initial = createGameState({
    fen: '4k3/8/8/8/8/8/1P6/R3K3 w - - 0 1',
    hands: { black: ['revenge'] },
  });
  const moved = applyAction(initial, { type: 'move', from: 'a1', to: 'a2' });
  if (!moved.ok) assert.fail(moved.error.message);
  assert.equal(moved.state.history.at(-1)?.capturedId, undefined);
  assertRejectedAtomically(moved.state, 'b2');
});

test('rejects once the opponent-capture reaction window has passed', () => {
  const moved = afterPawnCapture();
  const ended = applyAction(moved, { type: 'endTurn' });
  if (!ended.ok) assert.fail(ended.error.message);
  assert.equal(ended.state.turn.phase, 'beforeMove');
  assertRejectedAtomically(ended.state, 'b2');
});

test('a capture recorded by a card cannot trigger Revenge', () => {
  const state = afterPawnCapture();
  state.history.push({
    type: 'cardPlayed',
    cardId: 'assassin',
    player: 'white',
    target: 'a7',
    capturedId: 'black-pawn-a7',
  });
  assertRejectedAtomically(state, 'b2');
});

test('the triggering victim must still be a captured Pawn controlled by the reactor', async t => {
  const cases: Array<[string, Partial<PieceState>]> = [
    ['dead', { zone: 'dead' }],
    ['away', { zone: 'away' }],
    ['back on the board', { zone: 'board', square: 'a7' }],
    ['owned only by the mover', { owner: 'white', neutral: false }],
    ['never a Pawn', { role: 'rook', originalRole: 'rook' }],
    ['a promoted original Pawn acting as a Queen', { role: 'queen', originalRole: 'pawn', promoted: true }],
  ];

  for (const [name, patch] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'black-pawn-a7'), patch);
      assertRejectedAtomically(state, 'b2');
    });
  }
});

test('current, unpromoted original, and neutral Pawns can satisfy the trigger', async t => {
  const cases: Array<[string, Partial<PieceState>]> = [
    ['current Pawn', { role: 'pawn', originalRole: 'rook', promoted: true }],
    ['unpromoted original Pawn', { role: 'rook', originalRole: 'pawn', promoted: false }],
    ['neutral Pawn', { owner: 'white', neutral: true }],
  ];

  for (const [name, patch] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'black-pawn-a7'), patch);
      const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'b2' });
      assert.equal(result.ok, true);
    });
  }
});

test('target must be exactly one on-board square string', () => {
  for (const target of [undefined, null, {}, [], ['b2'], '', 'b9', 'b2 ', 42]) {
    assertRejectedAtomically(afterPawnCapture(), target);
  }
});

test('target must be a non-royal, capturable Pawn controlled by the mover', async t => {
  const cases: Array<[string, Partial<PieceState>, boolean]> = [
    ['reactor-owned', { owner: 'black', neutral: false }, false],
    ['never a Pawn', { role: 'rook', originalRole: 'rook' }, false],
    ['promoted original Pawn', { role: 'queen', originalRole: 'pawn', promoted: true }, false],
    ['already captured', { zone: 'captured', square: null }, false],
    ['royal', { royal: true }, false],
    ['Pacifist', {}, true],
  ];

  for (const [name, patch, pacifist] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'white-pawn-b2'), patch);
      if (pacifist) {
        state.effects.push({
          type: 'pacifism',
          owner: 'white',
          card: { id: 'white-effect-pacifism', cardId: 'pacifism' },
          pieceId: 'white-pawn-b2',
        });
      }
      assertRejectedAtomically(state, 'b2');
    });
  }
});

test('current, unpromoted original, and neutral Pawns are valid targets', async t => {
  const cases: Array<[string, Partial<PieceState>]> = [
    ['current Pawn', { role: 'pawn', originalRole: 'rook', promoted: true }],
    ['unpromoted original Pawn', { role: 'rook', originalRole: 'pawn', promoted: false }],
    ['neutral Pawn', { owner: 'black', neutral: true }],
  ];

  for (const [name, patch] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'white-pawn-b2'), patch);
      const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'b2' });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.deepEqual(findPiece(result.state, 'white-pawn-b2'), {
        ...findPiece(state, 'white-pawn-b2'),
        square: null,
        zone: 'captured',
        capturedBy: 'black',
      });
    });
  }
});

test('the capturing mover cannot spend their own Revenge in the reaction window', () => {
  const state = afterPawnCapture({ hands: { white: ['revenge'] } });
  assertRejectedAtomically(state, 'b2');
  assert.equal(state.players.white.hand[0]?.cardId, 'revenge');
});

test('cardPlayTargets exposes only eligible squares while the trigger is live', () => {
  const state = afterPawnCapture({
    fen: '4k3/p7/8/8/8/3pp3/1PP5/R3K3 w - - 0 1',
  });
  Object.assign(findPiece(state, 'white-pawn-c2'), { role: 'queen', promoted: true });
  Object.assign(findPiece(state, 'black-pawn-e3'), { neutral: true });

  assert.deepEqual(new Set(cardPlayTargets(state, 'revenge')), new Set(['b2', 'e3']));
});

test('cardPlayTargets is empty after the trigger expires', () => {
  const state = afterPawnCapture();
  const ended = applyAction(state, { type: 'endTurn' });
  if (!ended.ok) assert.fail(ended.error.message);
  assert.deepEqual(cardPlayTargets(ended.state, 'revenge'), []);
});

test('direct checkmate fizzles the removal but still spends Revenge', () => {
  const initial = createGameState({
    fen: '4k1rr/8/8/1p6/P7/8/7P/7K w - - 0 1',
    hands: { black: ['revenge'] },
  });
  const moved = applyAction(initial, { type: 'move', from: 'a4', to: 'b5' });
  if (!moved.ok) assert.fail(moved.error.message);
  const beforePawn = structuredClone(findPiece(moved.state, 'white-pawn-h2'));
  const result = applyAction(moved.state, { type: 'playCard', cardId: 'revenge', target: 'h2' });

  if (!result.ok) assert.fail(result.error.message);
  assert.deepEqual(findPiece(result.state, 'white-pawn-h2'), beforePawn);
  assert.equal(result.state.players.black.hand.length, 0);
  assert.equal(result.state.players.black.discard[0]?.cardId, 'revenge');
  assert.deepEqual(result.state.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'revenge',
    reason: 'DIRECT_MATE',
    movement: [],
    preservePreviousMove: true,
  });
});

test('exposing the reacting King fizzles the removal but still spends Revenge', () => {
  const state = afterPawnCapture({
    fen: '4k3/p3P3/8/8/8/8/8/R3R2K w - - 0 1',
  });
  const beforePawn = structuredClone(findPiece(state, 'white-pawn-e7'));
  const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'e7' });

  if (!result.ok) assert.fail(result.error.message);
  assert.deepEqual(findPiece(result.state, 'white-pawn-e7'), beforePawn);
  assert.equal(result.state.players.black.hand.length, 0);
  assert.equal(result.state.players.black.discard[0]?.cardId, 'revenge');
  assert.deepEqual(result.state.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'revenge',
    reason: 'SELF_CHECK',
    movement: [],
    preservePreviousMove: true,
  });
});
