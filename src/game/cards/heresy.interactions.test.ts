import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Step = { from: string; to: string };

const HERESY = 'heresy';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [HERESY], black: [HERESY] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(state: State, action: Action, code: string): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

const play = (state: State, cardId: string, target?: unknown) => applied(state, {
  type: 'playCard',
  cardId,
  cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
  ...(target === undefined ? {} : { target }),
} as Action);
const heresy = (state: State, ...target: Step[]) => play(state, HERESY, target);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('Heresy catalog data matches the physical card', () => {
  assert.deepEqual(CARD_CATALOG[HERESY], {
    id: HERESY,
    name: 'Heresy',
    points: 3,
    unique: false,
    image: '/KC2_card4.png',
    description: 'Each Bishop that can do so must be moved to an adjacent empty square by its owner, thus changing the color of the squares it moves on. Your opponent must move his Bishops first.',
    timing: ['afterMove'],
    continuing: false,
  });
});

test('Heresy resolves opponent first, then re-evaluates every acting Bishop on the changed board', () => {
  const before = move(game({
    fen: '7k/8/8/8/Bb1b4/8/8/7K w - - 7 12',
    hands: { white: [HERESY], black: [] },
  }), 'h1', 'h2');
  const ids = before.pieces.map(piece => piece.id).sort();
  const target = [
    { from: 'b4', to: 'b3' },
    { from: 'd4', to: 'd5' },
    { from: 'a4', to: 'b4' },
  ];

  const state = heresy(before, ...target);

  assert.equal(pieceAt(state, 'b3')?.id, 'black-bishop-b4');
  assert.equal(pieceAt(state, 'd5')?.id, 'black-bishop-d4');
  assert.equal(pieceAt(state, 'b4')?.id, 'white-bishop-a4');
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardPlayed', cardId: HERESY, target,
    movement: target, preservePreviousMove: true,
  });
});

test('Heresy requires every eligible Bishop and rejects non-sequential or malformed plans atomically', async t => {
  const base = move(game({
    fen: '7k/8/8/8/Bb6/8/8/7K w - - 0 1',
    hands: { white: [HERESY], black: [] },
  }), 'h1', 'h2');
  const cases: Array<[string, unknown, string]> = [
    ['omitted newly eligible acting Bishop', [{ from: 'b4', to: 'b3' }], 'INVALID_TARGET'],
    ['actor before opponent', [{ from: 'a4', to: 'a3' }, { from: 'b4', to: 'b3' }], 'INVALID_TARGET'],
    ['diagonal adjacency keeps square color', [{ from: 'b4', to: 'c3' }, { from: 'a4', to: 'a3' }], 'ILLEGAL_MOVE'],
    ['collision', [{ from: 'b4', to: 'b3' }, { from: 'a4', to: 'b4' }, { from: 'b3', to: 'b4' }], 'INVALID_TARGET'],
    ['duplicate Bishop', [{ from: 'b4', to: 'b3' }, { from: 'b3', to: 'b2' }, { from: 'a4', to: 'b4' }], 'INVALID_TARGET'],
    ['non-array payload', { from: 'b4', to: 'b3' }, 'INVALID_TARGET'],
    ['bad coordinate', [{ from: 'z9', to: 'b3' }], 'INVALID_TARGET'],
  ];
  for (const [name, target, code] of cases) await t.test(name, () => rejected(base, {
    type: 'playCard', cardId: HERESY, target,
  } as Action, code));
});

test('Heresy preserves neutral, transformed, promoted, and royal physical identities', () => {
  const before = game({
    fen: 'r6k/b1b5/8/8/8/8/B1B5/R6K w Qq - 3 8',
    phase: 'afterMove', moveMade: true,
    hands: { white: [HERESY], black: [] },
  });
  Object.assign(pieceAt(before, 'a7')!, { neutral: true });
  Object.assign(pieceAt(before, 'c7')!, { royal: true });
  Object.assign(pieceAt(before, 'a2')!, { role: 'rook', originalRole: 'bishop' });
  Object.assign(pieceAt(before, 'c2')!, { originalRole: 'pawn', promoted: true });
  const tracked = ['a7', 'c7', 'a2', 'c2'].map(square => structuredClone(pieceAt(before, square)!));

  const state = heresy(before,
    { from: 'a7', to: 'a6' }, { from: 'c7', to: 'c6' },
    { from: 'a2', to: 'a3' }, { from: 'c2', to: 'c3' },
  );

  assert.deepEqual(['a6', 'c6', 'a3', 'c3'].map((square, index) => ({
    ...pieceAt(state, square), square: tracked[index].square,
  })), tracked);
  assert.equal(state.fen.split(' ')[2], 'Q', 'moving Black royal Bishop revokes Black castling only');
});

test('Heresy rescues a staged ordinary move, while self-check and direct mate fizzle atomically', async t => {
  await t.test('pending rescue', () => {
    const initial = game({
      fen: 'k3r3/8/8/8/8/8/4RB2/4K3 w - - 4 9',
      hands: { white: [HERESY], black: [] },
    });
    const staged = move(initial, 'e2', 'd2');
    assert.ok(staged.pendingRescue);
    const state = heresy(staged, { from: 'f2', to: 'e2' });
    assert.equal(state.pendingRescue, null);
    assert.equal(isKingInCheck(state, 'white'), false);
    assert.equal(pieceAt(state, 'e2')?.role, 'bishop');
  });

  for (const fixture of [
    {
      name: 'self-check', fen: '4r2k/8/8/8/8/8/P3B3/4K3 w - - 0 1',
      regular: ['a2', 'a3'], target: [{ from: 'e2', to: 'd2' }], reason: 'SELF_CHECK',
    },
    {
      name: 'direct mate', fen: '5N1k/5K2/6B1/8/8/8/P7/8 w - - 0 1',
      regular: ['a2', 'a3'], target: [{ from: 'g6', to: 'g7' }], reason: 'DIRECT_MATE',
    },
  ] as const) await t.test(fixture.name, () => {
    const before = move(game({ fen: fixture.fen, hands: { white: [HERESY], black: [] } }), ...fixture.regular);
    const state = heresy(before, ...fixture.target);
    assert.deepEqual(state.pieces, before.pieces);
    assert.deepEqual(state.history.at(-1), {
      type: 'cardFizzled', cardId: HERESY, reason: fixture.reason,
      movement: [], preservePreviousMove: true,
    });
  });
});

test('mate escape search stages an ordinary move for Heresy, but Heresy cannot escape stalemate', () => {
  let state = game({
    fen: '5N1k/5K2/7B/8/8/b7/8/8 w - - 0 1',
    hands: { white: [], black: [HERESY] },
  });
  state = endTurn(move(state, 'h6', 'g7'));
  assert.equal(positionFor(state).isCheckmate(), true);
  assert.equal(state.outcome, null);
  state = move(state, 'a3', 'b2');
  assert.ok(state.pendingRescue);
  state = heresy(state, { from: 'g7', to: 'g6' }, { from: 'b2', to: 'b1' });
  assert.equal(isKingInCheck(state, 'black'), false);

  const stalemate = game({
    fen: 'k7/8/1QK5/8/8/8/8/2B5 b - - 0 1',
    hands: { white: [], black: [HERESY] },
  });
  const settled = endTurn({ ...stalemate, turn: { ...stalemate.turn, moveMade: true, phase: 'afterMove' } });
  assert.deepEqual(settled.outcome, { reason: 'stalemate' });
});

test('Heresy preserves ordinary move state and en-passant unless it moves the victim', () => {
  const before = move(game({ hands: { white: [HERESY], black: [] } }), 'e2', 'e4');
  const previous = structuredClone(before.history);
  const state = heresy(before, { from: 'f1', to: 'e2' });

  assert.deepEqual(state.enPassant, before.enPassant);
  assert.equal(state.fen, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPBPPP/RNBQK1NR b KQkq e3 0 1');
  assert.deepEqual(state.history.slice(0, -1), previous);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);

  const movedVictim = structuredClone(before);
  Object.assign(pieceAt(movedVictim, 'e4')!, { role: 'bishop' });
  assert.deepEqual(heresy(movedVictim, { from: 'e4', to: 'd4' }, { from: 'f1', to: 'e2' }).enPassant, []);
});

test('Heresy respects timing, pending and outcome gates, and duplicate instances', async t => {
  const before = game({ hands: { white: [HERESY, HERESY], black: [] }, decks: { white: ['fanatic'], black: [] } });
  const moved = move(before, 'e2', 'e4');
  const selected = moved.players.white.hand[1]!;
  const state = applied(moved, {
    type: 'playCard', cardId: HERESY, cardInstanceId: selected.id,
    target: [{ from: 'f1', to: 'e2' }],
  } as Action);
  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [HERESY, 'fanatic']);

  const cases: Array<[string, State, Action, string]> = [
    ['before move', before, { type: 'playCard', cardId: HERESY, target: [] } as Action, 'INVALID_TIMING'],
    ['second card', { ...moved, turn: { ...moved.turn, cardPlays: { white: 1, black: 0 } } }, { type: 'playCard', cardId: HERESY, target: [{ from: 'f1', to: 'e2' }] } as Action, 'CARD_ALREADY_PLAYED'],
    ['forged instance', moved, { type: 'playCard', cardId: HERESY, cardInstanceId: 'forged', target: [{ from: 'f1', to: 'e2' }] } as Action, 'CARD_NOT_IN_HAND'],
    ['outcome', { ...moved, outcome: { winner: 'black', reason: 'checkmate' } }, { type: 'playCard', cardId: HERESY, target: [{ from: 'f1', to: 'e2' }] } as Action, 'GAME_OVER'],
  ];
  for (const [name, fixture, action, code] of cases) await t.test(name, () => rejected(fixture, action, code));
});

const interactionIds = [
  'assassin', 'disintegration', 'doomsayer', 'fanatic', 'annexation', 'forced-march',
  'guardian', 'cowardice', 'holy-war', 'anathema', 'evangelists', 'tournament',
  'cathedral', 'lost-castle', 'siege', 'holy-quest', 'treason', 'onslaught', 'long-jump',
  'dubbing', 'squaring-the-circle', 'no-quarter',
] as const;

test('Heresy composes deterministically with every implemented card/effect', async t => {
  assert.equal(interactionIds.length, 22);
  for (const id of interactionIds) await t.test(id, () => {
    const initial = game({
      fen: '4k3/8/8/8/8/8/4B3/4K3 w - - 11 20',
      phase: 'afterMove', moveMade: true,
      hands: { white: [HERESY], black: [] },
    });
    initial.effects.push({ type: id, active: true });
    initial.history.push({ type: 'cardPlayed', cardId: id });
    const snapshot = structuredClone(initial);
    const action = { type: 'playCard', cardId: HERESY, target: [{ from: 'e2', to: 'd2' }] } as Action;
    const first = applyAction(initial, action);
    const second = applyAction(initial, action);
    assert.deepEqual(first, second);
    assert.deepEqual(initial, snapshot);
    if (!first.ok) assert.fail(`${first.error.code}: ${first.error.message}`);
    assert.deepEqual(first.state.effects, snapshot.effects);
    assert.equal(first.state.history.at(-2)?.cardId, id);
  });
});
