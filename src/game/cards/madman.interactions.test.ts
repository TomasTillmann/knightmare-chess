import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Step = { from: string; to: string };

const MADMAN = 'madman';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [MADMAN], black: [MADMAN] },
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

const madman = (state: State, ...target: Step[]) => applied(state, {
  type: 'playCard', cardId: MADMAN, target,
} as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('Madman catalog data matches the physical card', () => {
  assert.deepEqual(CARD_CATALOG[MADMAN], {
    id: MADMAN,
    name: 'Madman',
    points: 3,
    unique: false,
    image: '/KC3_card2.png',
    description: 'For this move, one of your pawns can move like a King in a game of checkers, by jumping diagonally over pieces from either side. It may make as many jumps as it can, in any direction. However, the pieces it jumps are not captured.',
    timing: ['beforeMove'],
    continuing: false,
  });
});

test('Madman preserves every jumped piece and records the complete multi-jump path', () => {
  const before = game({ fen: '7k/2p1B3/8/2r3N1/8/2N3p1/1P6/K7 w - - 6 10' });
  const target = [
    { from: 'b2', to: 'd4' },
    { from: 'd4', to: 'b6' },
    { from: 'b6', to: 'd8' },
    { from: 'd8', to: 'f6' },
    { from: 'f6', to: 'h4' },
    { from: 'h4', to: 'f2' },
  ];
  const mover = structuredClone(pieceAt(before, 'b2'));
  const jumpedSquares = ['c3', 'c5', 'c7', 'e7', 'g5', 'g3'];
  const jumped = jumpedSquares.map(square => structuredClone(pieceAt(before, square)));

  const state = madman(before, ...target);

  assert.deepEqual(pieceAt(state, 'f2'), { ...mover, square: 'f2' });
  assert.deepEqual(jumpedSquares.map(square => pieceAt(state, square)), jumped);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardPlayed', cardId: MADMAN, target,
    movement: [{ from: 'b2', to: 'f2' }], preservePreviousMove: false,
  });
  assert.equal(state.turn.moveMade, true);
});

test('Madman works after ordinary prior turns without rewriting their history', () => {
  let state = game({ fen: '7k/8/8/8/3r4/2P5/7P/K7 w - - 0 1' });
  state = endTurn(move(state, 'h2', 'h3'));
  state = endTurn(move(state, 'h8', 'g8'));
  const history = structuredClone(state.history);

  state = madman(state, { from: 'c3', to: 'e5' });

  assert.deepEqual(state.history.slice(0, -1), history);
  assert.equal(pieceAt(state, 'd4')?.id, 'black-rook-d4');
});

test('Madman leaves active continuing effects and piece-bound markers untouched', () => {
  const before = game({ fen: '7k/8/8/8/3r4/2P5/8/K7 w - - 0 1' });
  const obstacle = pieceAt(before, 'd4')! as typeof before.pieces[number] & { pacifist?: boolean };
  obstacle.pacifist = true;
  before.effects.push({ type: 'pacifism', active: true, pieceId: obstacle.id, marker: 'red' });
  const effects = structuredClone(before.effects);
  const identity = structuredClone(obstacle);

  const state = madman(before, { from: 'c3', to: 'e5' });

  assert.deepEqual(state.effects, effects);
  assert.deepEqual(pieceAt(state, 'd4'), identity);
});

const implementedCardIds = [
  'assassin', 'disintegration', 'doomsayer', 'fanatic', 'annexation', 'forced-march',
  'guardian', 'heresy', 'cowardice', 'holy-war', 'pacifism', 'anathema', 'evangelists', 'tournament',
  'cathedral', 'lost-castle', 'siege', 'holy-quest', 'treason', 'onslaught', 'long-jump',
  'dubbing', 'squaring-the-circle', 'no-quarter',
] as const;

test('Madman composes deterministically after every implemented card/effect', async t => {
  assert.deepEqual(
    [...implementedCardIds].sort(),
    Object.keys(CARD_CATALOG).filter(id => id !== MADMAN).sort(),
  );
  assert.equal(implementedCardIds.length, 24);
  for (const id of implementedCardIds) await t.test(id, () => {
    const initial = game({ fen: '7k/8/8/8/3r4/2P5/8/K7 w - - 11 20' });
    initial.history.push({ type: 'cardPlayed', cardId: id });
    if (CARD_CATALOG[id].continuing) {
      initial.effects.push(id === 'pacifism'
        ? {
          type: id, owner: 'white',
          card: { id: `white-active-${id}`, cardId: id },
          pieceId: pieceAt(initial, 'c3')!.id,
        }
        : { type: id, active: true, marker: `${id}-marker` });
    }
    const snapshot = structuredClone(initial);
    const action = {
      type: 'playCard', cardId: MADMAN, target: [{ from: 'c3', to: 'e5' }],
    } as Action;
    const first = applyAction(initial, action);
    const second = applyAction(initial, action);
    assert.deepEqual(first, second);
    assert.deepEqual(initial, snapshot);
    if (!first.ok) assert.fail(`${first.error.code}: ${first.error.message}`);
    assert.deepEqual(first.state.effects, snapshot.effects);
    assert.equal(first.state.history.at(-2)?.cardId, id);
    assert.equal(pieceAt(first.state, 'd4')?.id, 'black-rook-d4');
  });
});

test('Madman preserves transformed and neutral Pawn identity but rejects promoted Pawns', () => {
  const transformed = game({ fen: '7k/8/8/8/3r4/2P5/8/K7 w - - 7 4' });
  Object.assign(pieceAt(transformed, 'c3')!, { role: 'rook' });
  const transformedIdentity = structuredClone(pieceAt(transformed, 'c3'));
  const afterTransform = madman(transformed, { from: 'c3', to: 'e5' });
  assert.deepEqual(pieceAt(afterTransform, 'e5'), { ...transformedIdentity, square: 'e5' });
  assert.equal(afterTransform.fen.split(' ')[4], '0');

  const neutral = game({ fen: '7k/8/8/8/3R4/2p5/8/K7 w - - 0 1' });
  Object.assign(pieceAt(neutral, 'c3')!, { neutral: true });
  const neutralIdentity = structuredClone(pieceAt(neutral, 'c3'));
  const afterNeutral = madman(neutral, { from: 'c3', to: 'e5' });
  assert.deepEqual(pieceAt(afterNeutral, 'e5'), { ...neutralIdentity, square: 'e5' });

  const promoted = game({ fen: '7k/8/8/8/3r4/2P5/8/K7 w - - 0 1' });
  Object.assign(pieceAt(promoted, 'c3')!, { role: 'queen', promoted: true });
  rejected(promoted, {
    type: 'playCard', cardId: MADMAN, target: [{ from: 'c3', to: 'e5' }],
  } as Action, 'WRONG_ROLE');
});

test('Madman can jump into a line to escape an existing check', () => {
  const before = game({ fen: '4r2k/8/8/8/8/3b4/2P5/4K3 w - - 0 1' });
  assert.equal(isKingInCheck(before, 'white'), true);

  const state = madman(before, { from: 'c2', to: 'e4' });

  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(pieceAt(state, 'd3')?.id, 'black-bishop-d3');
  assert.equal(endTurn(state).turn.color, 'black');
});

test('Madman fizzle restores the mover and every jumped piece atomically', async t => {
  await t.test('self-check', () => {
    const before = game({ fen: '4r2k/8/8/8/8/3b4/4P3/4K3 w - - 0 1' });
    const pieces = structuredClone(before.pieces);
    const state = madman(before, { from: 'e2', to: 'c4' });
    assert.deepEqual(state.pieces, pieces);
    assert.deepEqual(state.history.at(-1), {
      type: 'cardFizzled', cardId: MADMAN, reason: 'SELF_CHECK',
      movement: [], preservePreviousMove: false,
    });
    assert.equal(state.turn.moveMade, true);
  });

  await t.test('direct mate', () => {
    const before = game({ fen: '7k/5KN1/7P/8/8/8/8/7R w - - 0 1' });
    const pieces = structuredClone(before.pieces);
    const state = madman(before, { from: 'h6', to: 'f8' });
    assert.deepEqual(state.pieces, pieces);
    assert.deepEqual(state.history.at(-1), {
      type: 'cardFizzled', cardId: MADMAN, reason: 'DIRECT_MATE',
      movement: [], preservePreviousMove: false,
    });
    assert.equal(state.turn.moveMade, true);
  });
});

test('Madman participates in checkmate and stalemate escape search', async t => {
  await t.test('checkmate', () => {
    const before = game({
      fen: '7k/5K2/8/6N1/5p2/8/8/7R w - - 0 1',
      phase: 'afterMove', moveMade: true, hands: { white: [], black: [MADMAN] },
    });
    const offered = endTurn(before);
    assert.equal(positionFor(offered).isCheckmate(), true);
    assert.equal(offered.outcome, null);
    const escaped = madman(offered, { from: 'f4', to: 'h6' });
    assert.equal(isKingInCheck(escaped, 'black'), false);
    assert.equal(pieceAt(escaped, 'g5')?.id, 'white-knight-g5');
  });

  await t.test('stalemate', () => {
    const before = game({
      fen: '8/8/8/8/8/6Q1/5K1p/7k w - - 0 1',
      phase: 'afterMove', moveMade: true, hands: { white: [], black: [MADMAN] },
    });
    const offered = endTurn(before);
    assert.equal(positionFor(offered).isStalemate(), true);
    assert.equal(offered.outcome, null);
    const escaped = madman(offered, { from: 'h2', to: 'f4' });
    assert.equal(pieceAt(escaped, 'f4')?.id, 'black-pawn-h2');
    assert.equal(pieceAt(escaped, 'g3')?.id, 'white-queen-g3');
  });
});

test('Madman shares timing and allowance gates and spends the selected duplicate', () => {
  const before = game({
    fen: '7k/8/8/8/3r4/2P5/8/K7 w - - 0 1',
    hands: { white: [MADMAN, 'disintegration', MADMAN], black: [] },
    decks: { white: ['fanatic'], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = applied(before, {
    type: 'playCard', cardId: MADMAN, cardInstanceId: selected.id,
    target: [{ from: 'c3', to: 'e5' }],
  } as Action);
  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [MADMAN, 'disintegration', 'fanatic']);
  rejected(game({
    fen: '7k/8/8/8/3r4/2P5/8/K7 b - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: [], black: [MADMAN] },
  }), { type: 'playCard', cardId: MADMAN, target: [{ from: 'c3', to: 'e5' }] } as Action, 'INVALID_TIMING');
  rejected(game({
    fen: '7k/8/8/8/3r4/2P5/8/K7 w - - 0 1', cardPlays: { white: 1 },
  }), { type: 'playCard', cardId: MADMAN, target: [{ from: 'c3', to: 'e5' }] } as Action, 'CARD_ALREADY_PLAYED');
});

test('Madman expires en-passant without disturbing its victim or jumped piece', () => {
  const before = game({ fen: '7k/8/8/3pP3/8/1r6/P7/K7 w - d6 9 2' });
  const mover = structuredClone(pieceAt(before, 'a2'));
  const victim = structuredClone(pieceAt(before, 'd5'));
  const jumped = structuredClone(pieceAt(before, 'b3'));

  const state = madman(before, { from: 'a2', to: 'c4' }, { from: 'c4', to: 'e6' });

  assert.deepEqual(state.enPassant, []);
  assert.deepEqual(pieceAt(state, 'e6'), { ...mover, square: 'e6' });
  assert.deepEqual(pieceAt(state, 'd5'), victim);
  assert.deepEqual(pieceAt(state, 'b3'), jumped);
  assert.equal(state.fen, '7k/8/4P3/3pP3/8/1r6/8/K7 b - - 0 2');
});

test('multi-jump replay is deterministic and never mutates its input', () => {
  const make = () => game({ fen: '7k/8/8/4b3/8/2r5/1P6/K7 w - - 4 7' });
  const target = [{ from: 'b2', to: 'd4' }, { from: 'd4', to: 'f6' }];
  const initial = make();
  const snapshot = structuredClone(initial);
  const once = madman(initial, ...target);
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);
  assert.deepEqual(madman(make(), ...target), madman(make(), ...target));
});
