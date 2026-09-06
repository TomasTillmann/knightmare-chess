import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, doomsayerTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Effect = Record<string, unknown>;

const PACIFISM = 'pacifism';
const EXISTING_CARDS = [
  'assassin', 'disintegration', 'doomsayer', 'fanatic', 'annexation', 'forced-march',
  'guardian', 'heresy', 'cowardice', 'holy-war', 'madman', 'anathema', 'evangelists',
  'tournament', 'cathedral', 'lost-castle', 'siege', 'holy-quest', 'treason', 'onslaught',
  'long-jump', 'dubbing', 'squaring-the-circle', 'no-quarter',
] as const;

function game(options: Options = {}): GameState {
  return createGameState({
    hands: { white: [PACIFISM], black: [PACIFISM] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function applied(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(state: GameState, action: Action, code = 'ILLEGAL_MOVE'): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

const play = (state: GameState, cardId: string, target?: unknown) => applied(state, {
  type: 'playCard', cardId,
  cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
  ...(target === undefined ? {} : { target }),
} as Action);
const pacify = (state: GameState, target: string) => play(state, PACIFISM, target);
const move = (state: GameState, from: string, to: string) => applied(state, {
  type: 'move', from, to,
} as Action);
const endTurn = (state: GameState) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: GameState, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
const effects = (state: GameState) => state.effects.filter(effect =>
  effect && typeof effect === 'object' && (effect as Effect).type === PACIFISM,
) as Effect[];
const nextWhiteTurn = (state: GameState, whiteMove: [string, string], blackMove: [string, string]) =>
  endTurn(move(endTurn(move(state, ...whiteMove)), ...blackMove));

test('Pacifism catalog data matches the physical card', () => {
  assert.deepEqual(CARD_CATALOG[PACIFISM], {
    id: PACIFISM, name: 'Pacifism', points: 3, unique: false, image: '/KC3_card3.png',
    description: 'One of your pieces, except your King, becomes non-violent for the rest of the game. Place a marker on it. It can no longer capture another piece, nor may it be captured.',
    timing: ['beforeMove'], continuing: true,
  });
});

test('play binds the continuing card to physical identity without replacing the move', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1',
    hands: { white: [PACIFISM, PACIFISM], black: [] }, decks: { white: ['fanatic'], black: [] },
  });
  const target = pieceAt(before, 'e2')!;
  const selected = before.players.white.hand[1]!;
  const state = applied(before, {
    type: 'playCard', cardId: PACIFISM, cardInstanceId: selected.id, target: 'e2',
  } as Action);
  assert.deepEqual(effects(state), [{ type: PACIFISM, owner: 'white', card: selected, pieceId: target.id }]);
  assert.equal(state.players.white.discard.length, 0);
  assert.equal(state.players.white.hand.some(card => card.cardId === PACIFISM), true);
  assert.equal(state.players.white.hand.some(card => card.cardId === 'fanatic'), true);
  assert.equal(state.turn.moveMade, false);
  assert.equal(state.turn.cardPlays.white, 1);
  const event = state.history.at(-1);
  assert.equal(event?.type, 'cardPlayed');
  assert.equal(event?.cardId, PACIFISM);
  assert.equal(event?.target, 'e2');
  assert.deepEqual(event?.movement, []);
});

test('target, timing, ownership, King, and one-card gates are atomic', () => {
  const before = game({ fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' });
  rejected(before, { type: 'playCard', cardId: PACIFISM, target: 'z9' } as Action, 'INVALID_TARGET');
  rejected(before, { type: 'playCard', cardId: PACIFISM, target: 'e8' } as Action, 'WRONG_OWNER');
  rejected(before, { type: 'playCard', cardId: PACIFISM, target: 'e1' } as Action, 'INVALID_TARGET');
  rejected(game({ fen: '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1', phase: 'afterMove', moveMade: true }),
    { type: 'playCard', cardId: PACIFISM, target: 'e8' } as Action, 'INVALID_TIMING');
  rejected(game({ fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', cardPlays: { white: 1 } }),
    { type: 'playCard', cardId: PACIFISM, target: 'e2' } as Action, 'CARD_ALREADY_PLAYED');
});

test('ordinary non-captures carry the marker while captures fail in both directions', () => {
  const marked = pacify(game({ fen: '4k3/8/8/8/8/3p4/4P3/4K3 w - - 0 1' }), 'e2');
  const id = pieceAt(marked, 'e2')!.id;
  rejected(marked, { type: 'move', from: 'e2', to: 'd3' } as Action);
  const moved = move(marked, 'e2', 'e3');
  assert.equal(pieceAt(moved, 'e3')?.id, id);
  assert.equal(effects(moved)[0]?.pieceId, id);
  const blackTurn = endTurn(moved);
  rejected(blackTurn, { type: 'move', from: 'd3', to: 'e2' } as Action);
  assert.equal(legalDests(blackTurn).get('d3')?.includes('e2') ?? false, false);
});

test('Assassin cannot use a Pacifist as mover or friendly victim', async t => {
  for (const target of ['a1', 'a2']) await t.test(target === 'a1' ? 'mover' : 'victim', () => {
    let state = game({
      fen: '7k/8/8/8/8/8/P7/R3K3 w - - 0 1',
      hands: { white: [PACIFISM, 'assassin'], black: [] },
    });
    state = nextWhiteTurn(pacify(state, target), ['e1', 'd1'], ['h8', 'g8']);
    rejected(state, { type: 'playCard', cardId: 'assassin', target: [{ from: 'a1', to: 'a2' }] } as Action);
  });
});

test('Disintegration bypasses immunity as death and expires the piece-bound effect', () => {
  let state = game({
    fen: '7k/8/8/8/8/8/P7/4K3 w - - 0 1',
    hands: { white: [PACIFISM, 'disintegration'], black: [] },
  });
  const id = pieceAt(state, 'a2')!.id;
  state = nextWhiteTurn(pacify(state, 'a2'), ['e1', 'd1'], ['h8', 'g8']);
  state = play(state, 'disintegration', 'a2');
  assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'dead');
  assert.equal(effects(state).length, 0);
  assert.equal(state.players.white.discard.some(card => card.cardId === PACIFISM), true);
});

test('Doomsayer excludes a Pacifist but can remove another piece of that type', () => {
  let state = game({ hands: { white: [PACIFISM], black: ['doomsayer'] } });
  const protectedId = pieceAt(state, 'a2')!.id;
  state = endTurn(move(pacify(state, 'a2'), 'b2', 'b3'));
  state = play(move(state, 'h7', 'h6'), 'doomsayer');
  assert.equal(doomsayerTargets(state, 'white', 'pawn').some(piece => piece.id === protectedId), false);
  const victim = pieceAt(state, 'b3')!;
  const doom = state.effects.find(effect => (effect as Effect).type === 'doomsayer') as Effect;
  const card = doom.card as Effect;
  state = applied(state, {
    type: 'namePiece', speaker: 'white', name: 'pawn',
    losses: [{ effectId: card.id, pieceId: victim.id }],
  } as Action);
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(pieceAt(state, 'a2')?.id, protectedId);
});

test('non-capturing card movement preserves Pacifism on the physical piece', async t => {
  const cases = [
    { id: 'fanatic', fen: '7k/8/8/8/8/8/P7/4K3 w - - 0 1', at: 'a2', target: 'a2', to: 'a5' },
    { id: 'annexation', fen: '7k/8/8/8/8/8/P7/4K3 w - - 0 1', at: 'a2', target: [{ from: 'a2', to: 'a4' }], to: 'a4' },
    { id: 'forced-march', fen: '7k/8/8/8/8/2P5/8/4K3 w - - 0 1', at: 'c3', target: [{ from: 'c3', to: 'd3' }], to: 'd3' },
    { id: 'guardian', fen: '7k/8/8/8/8/8/P7/4K3 w - - 0 1', at: 'a2', target: [{ from: 'a2', to: 'a3' }], to: 'a3' },
    { id: 'onslaught', fen: '7k/8/8/8/8/8/P7/4K3 w - - 0 1', at: 'a2', target: [{ from: 'a2', to: 'a3' }], to: 'a3' },
    { id: 'dubbing', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', at: 'a1', target: [{ from: 'a1', to: 'b3' }], to: 'b3' },
    { id: 'long-jump', fen: '7k/8/8/8/8/8/8/1N2K3 w - - 0 1', at: 'b1', target: [{ from: 'b1', to: 'd4' }], to: 'd4' },
    {
      id: 'squaring-the-circle', fen: 'r6k/4p3/8/8/3P4/8/4P3/7K w - - 0 1',
      at: 'd4', target: [{ from: 'd4', to: 'a1' }], to: 'a1',
      whiteMove: ['e2', 'e3'], blackMove: ['e7', 'e6'],
    },
  ] as const;
  for (const fixture of cases) await t.test(fixture.id, () => {
    let state = game({ fen: fixture.fen, hands: { white: [PACIFISM, fixture.id], black: [] } });
    const id = pieceAt(state, fixture.at)!.id;
    state = nextWhiteTurn(
      pacify(state, fixture.at),
      'whiteMove' in fixture ? fixture.whiteMove : ['e1', 'd1'],
      'blackMove' in fixture ? fixture.blackMove : ['h8', 'g8'],
    );
    state = play(state, fixture.id, fixture.target);
    assert.equal(pieceAt(state, fixture.to)?.id, id);
    assert.equal(effects(state)[0]?.pieceId, id);
  });
});

test('Madman, Heresy, and a swap relocate the marked identity without capture', async t => {
  await t.test('Madman', () => {
    let state = game({
      fen: '7k/8/8/8/3r4/2P5/8/4K3 w - - 0 1', hands: { white: [PACIFISM, 'madman'], black: [] },
    });
    const id = pieceAt(state, 'c3')!.id;
    state = nextWhiteTurn(pacify(state, 'c3'), ['e1', 'f1'], ['h8', 'g8']);
    state = play(state, 'madman', [{ from: 'c3', to: 'e5' }]);
    assert.equal(pieceAt(state, 'e5')?.id, id);
    assert.equal(pieceAt(state, 'd4')?.id, 'black-rook-d4');
  });
  await t.test('Heresy', () => {
    let state = game({
      fen: '7k/8/8/8/8/8/8/2B1K3 w - - 0 1', hands: { white: [PACIFISM, 'heresy'], black: [] },
    });
    const id = pieceAt(state, 'c1')!.id;
    state = nextWhiteTurn(pacify(state, 'c1'), ['e1', 'd1'], ['h8', 'g8']);
    state = play(move(state, 'd1', 'e1'), 'heresy', [{ from: 'c1', to: 'c2' }]);
    assert.equal(pieceAt(state, 'c2')?.id, id);
  });
  await t.test('Holy War', () => {
    let state = game({
      fen: '7k/8/8/8/8/8/8/1N2KB2 w - - 0 1', hands: { white: [PACIFISM, 'holy-war'], black: [] },
    });
    const id = pieceAt(state, 'b1')!.id;
    state = nextWhiteTurn(pacify(state, 'b1'), ['e1', 'd1'], ['h8', 'g8']);
    state = play(move(state, 'd1', 'e1'), 'holy-war', { knight: 'b1', bishop: 'f1' });
    assert.equal(pieceAt(state, 'f1')?.id, id);
    assert.equal(effects(state)[0]?.pieceId, id);
  });
});

test('en-passant cannot be made by or against a Pacifist Pawn', async t => {
  await t.test('attacker', () => {
    const state = pacify(game({ fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 0 2' }), 'e5');
    rejected(state, { type: 'move', from: 'e5', to: 'd6' } as Action);
  });
  await t.test('victim', () => {
    let state = game({
      fen: '7k/3p4/8/4P3/8/8/8/K7 b - - 0 1', hands: { white: [], black: [PACIFISM] },
    });
    state = endTurn(move(pacify(state, 'd7'), 'd7', 'd5'));
    rejected(state, { type: 'move', from: 'e5', to: 'd6' } as Action);
  });
});

test('Pacifists create no threats or check, including a neutral check escape', () => {
  const checking = game({ fen: '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1' });
  assert.equal(isKingInCheck(checking, 'black'), true);
  assert.equal(isKingInCheck(pacify(checking, 'e2'), 'black'), false);
  const neutral = game({ fen: '4r2k/8/8/8/8/8/8/4K3 w - - 0 1' });
  pieceAt(neutral, 'e8')!.neutral = true;
  assert.equal(isKingInCheck(neutral, 'white'), true);
  const escaped = pacify(neutral, 'e8');
  assert.equal(isKingInCheck(escaped, 'white'), false);
  assert.equal(pieceAt(escaped, 'e8')?.owner, 'black');
  assert.equal(effects(escaped)[0]?.owner, 'white');
  assert.equal(move(escaped, 'e1', 'd1').turn.moveMade, true);
});

test('a forbidden Pacifist capture creates no No Quarter history or trigger', () => {
  let state = game({
    fen: '7k/8/8/8/8/8/p7/R3K3 w - - 0 1',
    hands: { white: [PACIFISM, 'no-quarter'], black: [] },
  });
  state = nextWhiteTurn(pacify(state, 'a1'), ['e1', 'd1'], ['h8', 'g8']);
  const history = structuredClone(state.history);
  rejected(state, { type: 'move', from: 'a1', to: 'a2' } as Action);
  assert.deepEqual(state.history, history);
  rejected(state, { type: 'playCard', cardId: 'no-quarter' } as Action, 'INVALID_TIMING');
});

test('Pacifism is not a false escape from ordinary checkmate or stalemate', async t => {
  const cases = [
    { name: 'checkmate', fen: '7k/5K2/8/6N1/5p2/8/8/7R w - - 0 1', outcome: { winner: 'white', reason: 'checkmate' } },
    { name: 'stalemate', fen: '8/8/8/8/8/6Q1/5K1p/7k w - - 0 1', outcome: { reason: 'stalemate' } },
  ] as const;
  for (const fixture of cases) await t.test(fixture.name, () => {
    const before = game({
      fen: fixture.fen, phase: 'afterMove', moveMade: true,
      hands: { white: [], black: [PACIFISM] },
    });
    assert.deepEqual(endTurn(before).outcome, fixture.outcome);
  });
});

test('transformation, neutrality, and multiple copies remain identity-based', () => {
  let state = game({
    fen: '7k/8/8/8/4p3/2b5/4P3/4K3 w - - 0 1', hands: { white: [PACIFISM, PACIFISM], black: [] },
  });
  const neutral = pieceAt(state, 'c3')!;
  neutral.neutral = true;
  const neutralId = neutral.id;
  state = nextWhiteTurn(pacify(state, 'c3'), ['e2', 'e3'], ['h8', 'g8']);
  const transformed = pieceAt(state, 'e3')!;
  transformed.role = 'queen';
  const transformedId = transformed.id;
  state = pacify(state, 'e3');
  assert.deepEqual(new Set(effects(state).map(effect => effect.pieceId)), new Set([neutralId, transformedId]));
  assert.deepEqual(effects(state).map(effect => effect.owner), ['white', 'white']);
  rejected(state, { type: 'move', from: 'e3', to: 'e4' } as Action);
});

test('Pacifism composes deterministically and immutably with every existing card', async t => {
  assert.equal(EXISTING_CARDS.length, 24);
  for (const cardId of EXISTING_CARDS) await t.test(cardId, () => {
    const initial = game({ fen: '7k/8/8/8/8/8/R7/4K3 w - - 9 4' });
    initial.history.push({ type: 'cardPlayed', cardId });
    if (CARD_CATALOG[cardId]?.continuing) {
      initial.effects.push({ type: cardId, owner: 'black', card: { id: `black-active-${cardId}`, cardId } });
    }
    const snapshot = structuredClone(initial);
    const action = { type: 'playCard', cardId: PACIFISM, target: 'a2' } as Action;
    const first = applyAction(initial, action);
    const second = applyAction(initial, action);
    assert.deepEqual(first, second);
    assert.deepEqual(initial, snapshot);
    if (!first.ok) assert.fail(`${first.error.code}: ${first.error.message}`);
    assert.deepEqual(first.state.effects.slice(0, snapshot.effects.length), snapshot.effects);
    assert.equal(first.state.history.at(-2)?.cardId, cardId);
    assert.equal(effects(first.state).at(-1)?.pieceId, pieceAt(initial, 'a2')!.id);
  });
});
