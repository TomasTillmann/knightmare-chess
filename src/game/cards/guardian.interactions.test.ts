import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Step = { from: string; to: string };

const GUARDIAN = 'guardian';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [GUARDIAN], black: [GUARDIAN] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(state: State, action: Action, code?: string): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) return;
  if (code) assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

const play = (state: State, cardId: string, target?: unknown) => applied(state, {
  type: 'playCard',
  cardId,
  cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
  ...(target === undefined ? {} : { target }),
} as Action);
const guard = (state: State, ...target: Step[]) => play(state, GUARDIAN, target);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('Guardian resolves the Pawn and optional follower simultaneously without losing material', () => {
  const before = game({
    fen: '4k3/8/8/8/8/8/4P3/R3K3 w Q - 7 12',
    hands: { white: [GUARDIAN, GUARDIAN], black: [] },
    decks: { white: ['fanatic'], black: [] },
  });
  const selected = before.players.white.hand[1]!;
  const target = [{ from: 'e2', to: 'e4' }, { from: 'e1', to: 'e3' }];
  const ids = before.pieces.map(piece => piece.id).sort();
  const result = applyAction(before, {
    type: 'playCard', cardId: GUARDIAN, cardInstanceId: selected.id, target,
  } as Action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  const state = result.state;

  assert.equal(pieceAt(state, 'e4')?.id, 'white-pawn-e2');
  assert.equal(pieceAt(state, 'e3')?.id, 'white-king-e1');
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), ids);
  assert.equal(state.pieces.every(piece => piece.zone === 'board'), true);
  assert.deepEqual(state.turn, {
    color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 0 },
  });
  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [GUARDIAN, 'fanatic']);
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen, '4k3/8/8/8/4P3/4K3/8/R7 b - - 0 12');
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: GUARDIAN, target,
    movement: [{ from: 'e1', to: 'e3' }, { from: 'e2', to: 'e4' }],
    preservePreviousMove: false,
  }]);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('Guardian expires old en-passant and never offers its double-step Pawn en passant', () => {
  let state = game({
    fen: '7k/8/8/3pP3/1p6/8/P7/4K3 w - d6 9 2',
    hands: { white: [GUARDIAN], black: [] },
  });
  state = guard(state, { from: 'a2', to: 'a4' });
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen.split(' ')[3], '-');
  assert.equal(state.fen.split(' ')[4], '0');
  state = endTurn(state);
  assert.equal(legalDests(state).get('b4')?.includes('a3') ?? false, false);
});

test('Guardian follows owner-relative direction while preserving transformed and neutral identities', () => {
  const before = game({ fen: '7k/2B5/2r5/8/8/8/8/K7 w - - 4 1' });
  const pawn = pieceAt(before, 'c6')!;
  pawn.originalRole = 'pawn';
  pawn.neutral = true;
  const follower = pieceAt(before, 'c7')!;
  follower.neutral = true;
  const identities = [pawn, follower].map(({ id, owner, role, originalRole, promoted, royal, neutral }) =>
    ({ id, owner, role, originalRole, promoted, royal, neutral }));

  const state = guard(before, { from: 'c6', to: 'c5' }, { from: 'c7', to: 'c6' });
  assert.equal(pieceAt(state, 'c5')?.id, pawn.id);
  assert.equal(pieceAt(state, 'c6')?.id, follower.id);
  assert.deepEqual([pieceAt(state, 'c5'), pieceAt(state, 'c6')].map(piece => {
    const { id, owner, role, originalRole, promoted, royal, neutral } = piece!;
    return { id, owner, role, originalRole, promoted, royal, neutral };
  }), identities);
});

test('Guardian can block check, but self-check and direct mate fizzle atomically', async t => {
  await t.test('final simultaneous position blocks check', () => {
    const before = game({ fen: '7k/8/7b/8/8/8/4P3/2K1R3 w - - 0 1' });
    assert.equal(isKingInCheck(before, 'white'), true);
    const state = guard(before, { from: 'e2', to: 'e3' }, { from: 'e1', to: 'e2' });
    assert.equal(isKingInCheck(state, 'white'), false);
  });

  for (const fixture of [
    { name: 'self-check', fen: '7b/7k/8/8/8/2P5/8/K7 w - - 3 1', from: 'c3', to: 'c4', reason: 'SELF_CHECK' },
    { name: 'direct mate', fen: '7k/8/6Q1/8/3P4/8/8/B3K3 w - - 3 1', from: 'd4', to: 'd5', reason: 'DIRECT_MATE' },
  ]) await t.test(fixture.name, () => {
    const before = game({ fen: fixture.fen, hands: { white: [GUARDIAN], black: [] } });
    const state = guard(before, { from: fixture.from, to: fixture.to });
    assert.deepEqual(state.pieces, before.pieces);
    assert.deepEqual(state.history.at(-1), {
      type: 'cardFizzled', cardId: GUARDIAN, reason: fixture.reason,
      movement: [], preservePreviousMove: false,
    });
    assert.equal(state.players.white.discard.at(-1)?.cardId, GUARDIAN);
  });
});

test('Guardian participates in apparent-mate escape search through original Pawn identity', () => {
  let state = game({
    fen: '8/5N1k/8/4b1Q1/8/3P4/8/KB6 w - - 0 1',
    hands: { white: [], black: [GUARDIAN] },
  });
  pieceAt(state, 'e5')!.originalRole = 'pawn';
  state = endTurn(move(state, 'd3', 'd4'));
  assert.equal(positionFor(state).isCheckmate(), true);
  assert.equal(state.outcome, null);
  state = guard(state, { from: 'e5', to: 'e4' });
  assert.equal(isKingInCheck(state, 'black'), false);
});

test('Guardian rejects timing, outcome, forged identity, and malformed movement atomically', async t => {
  const base = game({ fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' });
  const cases: Array<{ name: string; state: State; action: Action; code?: string }> = [
    {
      name: 'after the regular move', state: move(base, 'e2', 'e3'),
      action: { type: 'playCard', cardId: GUARDIAN, target: [{ from: 'e3', to: 'e4' }] } as Action,
      code: 'INVALID_TIMING',
    },
    {
      name: 'after another card',
      state: game({ fen: base.fen, cardPlays: { white: 1 } }),
      action: { type: 'playCard', cardId: GUARDIAN, target: [{ from: 'e2', to: 'e3' }] } as Action,
      code: 'CARD_ALREADY_PLAYED',
    },
    {
      name: 'forged card instance', state: base,
      action: { type: 'playCard', cardId: GUARDIAN, cardInstanceId: 'forged', target: [{ from: 'e2', to: 'e3' }] } as Action,
      code: 'CARD_NOT_IN_HAND',
    },
    {
      name: 'malformed non-array target', state: base,
      action: { type: 'playCard', cardId: GUARDIAN, target: { from: 'e2', to: 'e3' } } as Action,
      code: 'INVALID_TARGET',
    },
    {
      name: 'three movements', state: base,
      action: { type: 'playCard', cardId: GUARDIAN, target: [
        { from: 'e2', to: 'e3' }, { from: 'e1', to: 'e2' }, { from: 'e3', to: 'e4' },
      ] } as Action,
      code: 'INVALID_TARGET',
    },
    {
      name: 'non-Pawn lead movement', state: base,
      action: { type: 'playCard', cardId: GUARDIAN, target: [{ from: 'e1', to: 'e2' }] } as Action,
      code: 'WRONG_ROLE',
    },
    {
      name: 'outcome gate', state: { ...base, outcome: { winner: 'black', reason: 'checkmate' } },
      action: { type: 'playCard', cardId: GUARDIAN, target: [{ from: 'e2', to: 'e3' }] } as Action,
      code: 'GAME_OVER',
    },
  ];
  for (const fixture of cases) await t.test(fixture.name, () =>
    rejected(fixture.state, fixture.action, fixture.code));
});

test('Guardian cannot replace a staged move awaiting an after-move rescue', () => {
  const before = game({
    fen: 'k6r/8/8/8/1b6/8/P7/4K3 w - - 0 1',
    hands: { white: ['anathema', GUARDIAN], black: [] },
  });
  const staged = move(before, 'a2', 'a3');
  assert.ok(staged.pendingRescue);
  rejected(staged, {
    type: 'playCard', cardId: GUARDIAN, target: [{ from: 'a3', to: 'a4' }],
  } as Action, 'INVALID_TIMING');
});

interface CardFixture {
  id: string;
  fen?: string;
  play: (state: State) => State;
  guardian?: Step[];
}

const afterMoveCard = (state: State, id: string, target: unknown) => play(move(state, 'e2', 'e4'), id, target);
const fixtures: CardFixture[] = [
  { id: 'assassin', play: state => play(state, 'assassin', [{ from: 'b1', to: 'd2' }]) },
  { id: 'disintegration', play: state => move(play(state, 'disintegration', 'a2'), 'e2', 'e4') },
  { id: 'doomsayer', play: state => applied(play(move(state, 'e2', 'e4'), 'doomsayer'), { type: 'declineDoomsayer', player: 'black' } as Action) },
  { id: 'fanatic', play: state => play(state, 'fanatic', 'a2') },
  { id: 'annexation', play: state => play(state, 'annexation', [{ from: 'a2', to: 'a4' }]) },
  {
    id: 'forced-march', fen: 'rnbqkbnr/p1pppppp/8/8/8/8/P1PPPPPP/RNBQKBNR w KQkq - 0 1',
    play: state => play(state, 'forced-march', [{ from: 'a2', to: 'b2' }]),
  },
  {
    id: 'cowardice', fen: '1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kk - 0 1',
    play: state => afterMoveCard(state, 'cowardice', [{ from: 'a7', to: 'a8' }]),
  },
  { id: 'holy-war', play: state => afterMoveCard(state, 'holy-war', { knight: 'b1', bishop: 'c1' }) },
  { id: 'anathema', play: state => afterMoveCard(state, 'anathema', { bishop: 'c8', rook: 'a8' }) },
  { id: 'evangelists', play: state => play(state, 'evangelists', { own: 'c1', opponent: 'c8' }) },
  { id: 'tournament', play: state => play(state, 'tournament', { own: 'b1', opponent: 'b8' }) },
  { id: 'cathedral', play: state => afterMoveCard(state, 'cathedral', { rook: 'a1', bishop: 'c1' }) },
  { id: 'lost-castle', play: state => play(state, 'lost-castle', { own: 'a1', opponent: 'a8' }) },
  { id: 'siege', play: state => afterMoveCard(state, 'siege', { knight: 'b1', rook: 'a1' }) },
  { id: 'holy-quest', play: state => afterMoveCard(state, 'holy-quest', { bishop: 'c8', knight: 'b8' }) },
  { id: 'treason', play: state => afterMoveCard(state, 'treason', { rook: 'a8', knight: 'b8' }) },
  { id: 'onslaught', play: state => play(state, 'onslaught', [{ from: 'a2', to: 'a3' }, { from: 'b2', to: 'b3' }]) },
  { id: 'long-jump', play: state => play(state, 'long-jump', [{ from: 'b1', to: 'a3' }]) },
  { id: 'dubbing', play: state => play(state, 'dubbing', [{ from: 'a2', to: 'b4' }]) },
  {
    id: 'squaring-the-circle', fen: 'r5k1/6p1/8/8/8/4B3/3P4/R3K2R w - - 0 1',
    play: state => play(state, 'squaring-the-circle', [{ from: 'e3', to: 'h8' }]),
    guardian: [{ from: 'g7', to: 'g6' }, { from: 'g8', to: 'g7' }],
  },
  {
    id: 'no-quarter', fen: '7k/1p6/8/3pp3/3PP3/8/A7/7K w - - 0 1'.replace('A', 'P'),
    play: state => play(move(state, 'e4', 'd5'), 'no-quarter'),
    guardian: [{ from: 'b7', to: 'b6' }],
  },
];

test('Guardian composes after every implemented card and preserves active effects', async t => {
  assert.equal(fixtures.length, 21);
  for (const fixture of fixtures) await t.test(fixture.id, () => {
    let state = game({
      ...(fixture.fen ? { fen: fixture.fen } : {}),
      hands: { white: [fixture.id], black: [GUARDIAN] },
    });
    state = endTurn(fixture.play(state));
    const effects = structuredClone(state.effects);
    state = guard(state, ...(fixture.guardian ?? [
      { from: 'h7', to: 'h6' }, { from: 'h8', to: 'h7' },
    ]));

    assert.equal(state.history.some(event => event.type === 'cardPlayed' && event.cardId === fixture.id), true);
    assert.equal(state.history.at(-1)?.cardId, GUARDIAN);
    assert.deepEqual(state.effects, effects);
    assert.equal(state.turn.cardPlays.black, 1);
  });
});

test('Guardian reduction is immutable and deterministic', () => {
  const initial = game({ fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' });
  const snapshot = structuredClone(initial);
  const action = {
    type: 'playCard', cardId: GUARDIAN,
    cardInstanceId: initial.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e4' }, { from: 'e1', to: 'e3' }],
  } as Action;
  const first = applyAction(initial, action);
  const second = applyAction(initial, action);
  assert.deepEqual(first, second);
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(first.state, initial);
});
