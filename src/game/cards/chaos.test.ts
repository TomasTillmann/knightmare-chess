import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';
import type { Color, SquareName } from 'chessops/types';

function step(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'public actions must not mutate their input');
  assert.equal(result.ok, true, result.ok ? 'Expected accepted action' : result.error.message);
  return result.state;
}
const initial = () => createGameState({ hands: { black: ['chaos'] }, decks: { black: ['chaos'] } });
const moved = () => step(initial(), { type: 'move', from: 'e2', to: 'e4' });
// The local extra-move clock rule also applies when cancellation reopens that slot.
const extraClockMoves = [
  ['charge', 'N', 29, 39, 46],
  ['crusade', 'B', 28, 46, 37],
  ['merciless', 'R', 27, 43, 29],
] as const;
function extraClockFixture(
  color: Color, canceler: string, moves: readonly [string, string, number, number, number], additions: [number, string][] = [],
) {
  const [card, role, via, extra, redo] = moves;
  const other: Color = color === 'white' ? 'black' : 'white';
  const mirror = (n: number) => color === 'white' ? n : n ^ 56;
  const square = (n: number) => {
    const index = mirror(n);
    return ('abcdefgh'[index % 8] + String(1 + Math.floor(index / 8))) as SquareName;
  };
  const board = new Map([...new Map<number, string>([[7, 'K'], [63, 'k'], [19, role], ...additions])]
    .map(([n, p]) => [mirror(n), color === 'white' ? p : p === p.toUpperCase() ? p.toLowerCase() : p.toUpperCase()]));
  const fen = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, f) =>
    board.get((7 - r) * 8 + f) ?? '1').join('').replace(/1+/g, x => String(x.length))).join('/')
    + ` ${color === 'white' ? 'w' : 'b'} - - 11 7`;
  const initial = createGameState({ fen, hands: { [color]: [card], [other]: [canceler] },
    decks: { [color]: ['crab'], [other]: ['panic'] } });
  const first = step(initial, { type: 'move', from: square(19), to: square(via) });
  const added = step(first, { type: 'playCard', cardId: card, target: [{ from: square(via), to: square(extra) }] });
  return { initial, first, added, square, other, card, via, extra, redo };
}
function rejectedClockMove(state: GameState, action: GameAction) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}
for (const canceler of ['chaos', 'knightmare', 'think-again']) for (const moves of extraClockMoves) {
  test(`${canceler} replacement of ${moves[0]} preserves the first move clocks and exact cards`, () => {
    for (const color of ['white', 'black'] as const) for (const returnCard of [true, false]) {
      const f = extraClockFixture(color, canceler, moves);
      assert.deepEqual(f.first.fen.split(' ').slice(4), ['12', color === 'white' ? '7' : '8']);
      assert.deepEqual(f.added.fen.split(' ').slice(4), f.first.fen.split(' ').slice(4));
      let state = step(f.added, { type: 'playCard', cardId: canceler, target: { returnCard } });
      assert.equal(state.fen, f.first.fen);
      assert.deepEqual(state.pieces, f.first.pieces);
      assert.deepEqual(state.history[0], f.first.history[0]);
      assert.equal(state.turn.color, color);
      assert.equal(state.turn.phase, 'beforeMove');
      assert.equal(state.turn.moveMade, false);
      assert.deepEqual(state.players[color], (returnCard ? f.first : f.added).players[color]);
      assert.deepEqual(state.players[f.other], {
        ...f.initial.players[f.other], hand: f.initial.players[f.other].deck,
        deck: [], discard: f.initial.players[f.other].hand,
      });
      assert.equal(state.turn.cardPlays[color], returnCard ? 0 : 1);
      assert.equal(state.turn.cardPlays[f.other], 1);
      assert.equal(state.history.at(-1)?.cardId, canceler);
      rejectedClockMove(state, { type: 'move', from: f.square(f.via), to: f.square(f.extra) });
      rejectedClockMove(state, { type: 'playCard', cardId: f.card,
        target: [{ from: f.square(f.via), to: f.square(f.redo) }] });
      assert.ok(legalDests(state, false).get(f.square(f.via))?.includes(f.square(f.redo)));
      const players = structuredClone(state.players);
      state = step(state, { type: 'move', from: f.square(f.via), to: f.square(f.redo) });
      assert.deepEqual(state.fen.split(' ').slice(4), f.first.fen.split(' ').slice(4));
      assert.deepEqual(state.players, players);
      assert.equal(state.turn.phase, 'afterMove');
      assert.equal(state.turn.moveMade, true);
      assert.equal(state.chaosForbidden, undefined);
      rejectedClockMove(state, { type: 'move', from: f.square(f.redo), to: f.square(f.via) });
      const clocks = state.fen.split(' ').slice(4);
      state = step(state, { type: 'endTurn' });
      assert.equal(state.turn.color, f.other);
      assert.deepEqual(state.fen.split(' ').slice(4), clocks);
    }
  });
}
for (const reset of ['capture', 'pawn'] as const) {
  test(`Canceled extra replacements retain the ${reset} halfmove reset for both colors`, () => {
    for (const [i, moves] of extraClockMoves.entries()) for (const color of ['white', 'black'] as const) {
      const canceler = ['chaos', 'knightmare', 'think-again'][i];
      // Keep the Bishop's e4-g6 extra path clear; its replacement captures on c6.
      const redo = moves[0] === 'crusade' ? 42 : moves[4];
      const f = extraClockFixture(color, canceler, [moves[0], moves[1], moves[2], moves[3], redo],
        reset === 'capture' ? [[redo, 'p']] : [[8, 'P']]);
      let state = step(f.added, { type: 'playCard', cardId: canceler, target: { returnCard: reset === 'pawn' } });
      state = step(state, { type: 'move', from: f.square(reset === 'pawn' ? 8 : f.via),
        to: f.square(reset === 'pawn' ? 16 : f.redo) });
      assert.deepEqual(state.fen.split(' ').slice(4), ['0', color === 'white' ? '7' : '8']);
      assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, reset === 'capture' ? 1 : 0);
      assert.equal(step(state, { type: 'endTurn' }).turn.color, f.other);
    }
  });
}
test('Ordinary cancellations still advance replacement clocks exactly once', () => {
  for (const canceler of ['chaos', 'knightmare', 'think-again']) for (const color of ['white', 'black'] as const) {
    const f = extraClockFixture(color, canceler, extraClockMoves[0]);
    let state = step(f.first, { type: 'playCard', cardId: canceler });
    assert.equal(state.fen, f.initial.fen);
    state = step(state, { type: 'move', from: f.square(19), to: f.square(36) });
    assert.deepEqual(state.fen.split(' ').slice(4), ['12', color === 'white' ? '7' : '8']);
    assert.equal(step(state, { type: 'endTurn' }).turn.color, f.other);
  }
});
test('Successive cancellations preserve cards and end the extra clock policy with its turn', () => {
  for (const color of ['white', 'black'] as const) {
    const f = extraClockFixture(color, 'plots-within-plots', extraClockMoves[0]);
    const initial = createGameState({ fen: f.initial.fen,
      hands: { [color]: ['charge', 'knightmare'], [f.other]: ['plots-within-plots', 'chaos', 'think-again'] } });
    const first = step(initial, { type: 'move', from: f.square(19), to: f.square(f.via) });
    let state = step(first, { type: 'playCard', cardId: 'charge', target: [{ from: f.square(f.via), to: f.square(f.extra) }] });
    state = step(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: f.other } });
    state = step(state, { type: 'playCard', cardId: 'chaos', target: { returnCard: false } });
    state = step(state, { type: 'move', from: f.square(f.via), to: f.square(f.redo) });
    assert.deepEqual(state.fen.split(' ').slice(4), first.fen.split(' ').slice(4));
    rejectedClockMove(state, { type: 'playCard', cardId: 'think-again' });
    assert.equal(state.plotsAllowances, undefined);
    const nextTurn = step(state, { type: 'endTurn' });
    state = step(nextTurn, { type: 'move', from: f.square(63), to: f.square(62) });
    state = step(state, { type: 'playCard', cardId: 'knightmare' });
    assert.equal(state.fen, nextTurn.fen);
    state = step(state, { type: 'move', from: f.square(63), to: f.square(55) });
    assert.deepEqual(state.fen.split(' ').slice(4), ['13', '8']);
    assert.deepEqual(state.players[f.other].discard, initial.players[f.other].hand.slice(0, 2));
    assert.deepEqual(state.players[color].discard, initial.players[color].hand);
    assert.equal(step(state, { type: 'endTurn' }).turn.color, color);
  }
});
test('Castling replacement preserves extra clocks and still revokes castling rights', () => {
  for (const color of ['white', 'black'] as const) {
    const f = extraClockFixture(color, 'chaos', extraClockMoves[0]);
    let state = createGameState({ fen: color === 'white'
      ? 'k7/8/8/8/8/3N4/8/4K2R w K - 11 7' : '4k2r/8/3n4/8/8/8/8/K7 b k - 11 7',
    hands: { [color]: ['charge'], [f.other]: ['chaos'] } });
    const first = step(state, { type: 'move', from: f.square(19), to: f.square(f.via) });
    state = step(first, { type: 'playCard', cardId: 'charge', target: [{ from: f.square(f.via), to: f.square(f.extra) }] });
    state = step(state, { type: 'playCard', cardId: 'chaos' });
    state = step(state, { type: 'move', from: f.square(4), to: f.square(6) });
    assert.deepEqual(state.fen.split(' ').slice(2), ['-', '-', '12', color === 'white' ? '7' : '8']);
    assert.equal(state.pieces.find(piece => piece.owner === color && piece.role === 'rook')?.square, f.square(5));
    assert.equal(step(state, { type: 'endTurn' }).turn.color, f.other);
  }
});
test('Pawn double-step replacement keeps usable en passant without an extra fullmove', () => {
  for (const color of ['white', 'black'] as const) {
    const f = extraClockFixture(color, 'chaos', extraClockMoves[0], [[8, 'P'], [25, 'p']]);
    let state = step(f.added, { type: 'playCard', cardId: 'chaos' });
    state = step(state, { type: 'move', from: f.square(8), to: f.square(24) });
    assert.deepEqual(state.fen.split(' ').slice(3), [f.square(16), '0', color === 'white' ? '7' : '8']);
    assert.equal(state.enPassant.length, 1);
    state = step(state, { type: 'endTurn' });
    state = step(state, { type: 'move', from: f.square(25), to: f.square(16) });
    assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 1);
    assert.deepEqual(state.fen.split(' ').slice(3), ['-', '0', '8']);
  }
});
test('Plots separate replacement moves retain ordinary clock advancement', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/P7/R6K w - - 11 7',
    hands: { white: ['plots-within-plots', 'dubbing', 'blessing'], black: ['chaos'] } });
  state = step(state, { type: 'playCard', cardId: 'plots-within-plots' });
  const first = step(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'a1', to: 'b3' }] });
  state = step(first, { type: 'playCard', cardId: 'blessing', target: [{ from: 'b3', to: 'c4' }] });
  assert.deepEqual(state.fen.split(' ').slice(4), ['13', '7']);
  state = step(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(state.fen, first.fen);
  state = step(state, { type: 'move', from: 'b3', to: 'b4' });
  assert.deepEqual(state.fen.split(' ').slice(4), ['13', '7']);
  assert.equal(step(state, { type: 'endTurn' }).turn.color, 'black');
});
test('A copied extra movement retains the same replacement clock policy', () => {
  for (const color of ['white', 'black'] as const) {
    const f = extraClockFixture(color, 'chaos', extraClockMoves[0], [[57, 'n']]);
    let state = createGameState({ fen: f.initial.fen.replace(` ${color === 'white' ? 'w' : 'b'} `,
      ` ${color === 'white' ? 'b' : 'w'} `),
    hands: { [color]: ['haunting-memories'], [f.other]: ['charge', 'chaos'] } });
    state = step(state, { type: 'move', from: f.square(57), to: f.square(42) });
    state = step(state, { type: 'playCard', cardId: 'charge', target: [{ from: f.square(42), to: f.square(32) }] });
    state = step(state, { type: 'endTurn' });
    const first = step(state, { type: 'move', from: f.square(19), to: f.square(f.via) });
    state = step(first, { type: 'playCard', cardId: 'haunting-memories', target: [{ from: f.square(f.via), to: f.square(f.extra) }] });
    assert.equal(state.history.at(-1)?.copiedCardId, 'charge');
    state = step(state, { type: 'playCard', cardId: 'chaos' });
    assert.deepEqual(state.players[color], first.players[color]);
    state = step(state, { type: 'move', from: f.square(f.via), to: f.square(f.redo) });
    assert.deepEqual(state.fen.split(' ').slice(4), first.fen.split(' ').slice(4));
    assert.equal(step(state, { type: 'endTurn' }).turn.color, f.other);
  }
});
test('Replacement cards and repeated cancellations preserve the same extra movement clocks', () => {
  for (const color of ['white', 'black'] as const) for (const moves of extraClockMoves) {
    for (const replacement of ['dubbing', 'masquerade']) {
      const f = extraClockFixture(color, 'chaos', moves);
      const initial = createGameState({ fen: f.initial.fen,
        hands: { [color]: [f.card, replacement], [f.other]: ['plots-within-plots', 'chaos', 'knightmare'] } });
      const first = step(initial, { type: 'move', from: f.square(19), to: f.square(f.via) });
      let state = step(first, { type: 'playCard', cardId: f.card, target: [{ from: f.square(f.via), to: f.square(f.extra) }] });
      state = step(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: f.other } });
      state = step(state, { type: 'playCard', cardId: 'chaos' });
      const target = [{ from: f.square(f.via), to: f.square(replacement === 'dubbing' ? f.via + 15 : 24) }];
      state = step(state, { type: 'playCard', cardId: replacement, target });
      assert.deepEqual(state.fen.split(' ').slice(4), first.fen.split(' ').slice(4));
      assert.equal(state.turn.moveMade, true);
      rejectedClockMove(state, { type: 'move', from: target[0].to, to: f.square(f.via) });
      state = step(state, { type: 'playCard', cardId: 'knightmare' });
      assert.equal(state.fen, first.fen);
      assert.deepEqual(state.players[color], initial.players[color]);
      assert.deepEqual(state.players[f.other].discard, initial.players[f.other].hand);
      rejectedClockMove(state, { type: 'playCard', cardId: replacement, target });
      state = step(state, { type: 'move', from: f.square(f.via), to: f.square(f.redo) });
      assert.deepEqual(state.fen.split(' ').slice(4), first.fen.split(' ').slice(4));
      assert.equal(step(state, { type: 'endTurn' }).turn.color, f.other);
    }
  }
});
test('Chaos responds after the mover optional Crab and reopens a replacement move', () => {
  let state = createGameState({ hands: { white: ['crab'], black: ['chaos'] } });
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  state = step(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-g1')?.square, 'g1');
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});
function cancel(state: GameState, target?: unknown): GameState {
  const next = step(state, { type: 'playCard', cardId: 'chaos', ...(target === undefined ? {} : { target }) });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'chaos');
  return next;
}

test('Chaos restores the actual pre-move board', () => {
  assert.equal(boardFen(cancel(moved())), boardFen(initial()));
});
test('Chaos restores the moving player opportunity', () => {
  const state = cancel(moved());
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});
test('Chaos is discarded and replaced exactly once', () => {
  const state = cancel(moved());
  assert.equal(state.players.black.discard.length, 1);
  assert.equal(state.players.black.hand.length, 1);
  assert.equal(state.players.black.deck.length, 0);
  assert.equal(state.turn.cardPlays.black, 1);
});
test('Chaos erases double-step en-passant state', () => {
  assert.deepEqual(cancel(moved()).enPassant, initial().enPassant);
});
test('Chaos rejects repeating the canceled movement atomically', () => {
  const state = cancel(moved());
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});
test('Chaos permits another move by the same piece', () => {
  const state = step(cancel(moved()), { type: 'move', from: 'e2', to: 'e3' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e3');
});
test('Chaos permits another piece to move', () => {
  const state = step(cancel(moved()), { type: 'move', from: 'd2', to: 'd4' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-d2')?.square, 'd4');
});
for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
  test(`Chaos accepts its strict optional target ${JSON.stringify(target)}`, () => {
    assert.equal(cancel(moved(), target).turn.moveMade, false);
  });
}
test('Chaos rejects a fabricated after-move position', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { black: ['chaos'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Chaos has the documented metadata', () => {
  const card = CARD_CATALOG.chaos;
  assert.ok(card);
  assert.equal(card.points, 10);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['afterOpponentMove']);
  assert.ok(card.image.endsWith('/KC19_card1.png'));
});

test('Chaos rejects every malformed target without spending or changing state', () => {
  for (const target of [null, true, false, [], 'e4', {}, { returnCard: 1 }, { returnCard: 'true' }, { returnCard: true, extra: 1 }]) {
    const state = moved();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'chaos', target });
    assert.equal(result.ok, false, JSON.stringify(target));
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('Chaos cannot respond before a move, to its own move, or after endTurn', () => {
  const own = step(createGameState({ hands: { white: ['chaos'] } }), { type: 'move', from: 'e2', to: 'e4' });
  for (const state of [initial(), own, step(moved(), { type: 'endTurn' })]) {
    const result = applyAction(state, { type: 'playCard', cardId: 'chaos' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test('Chaos filters the canceled ordinary move from legal destinations', () => {
  const dests = legalDests(cancel(moved()));
  assert.equal(dests.get('e2')?.includes('e4'), false);
  assert.equal(dests.get('e2')?.includes('e3'), true);
});

const restorations: Array<[string, string, GameAction]> = [
  ['capture', '4k3/8/8/3p4/4P3/8/8/4K3 w - - 12 18', { type: 'move', from: 'e4', to: 'd5' }],
  ['en-passant capture', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 8 20', { type: 'move', from: 'e5', to: 'd6' }],
  ['promotion', '4k3/P7/8/8/8/8/8/4K3 w - - 4 9', { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' }],
  ['castling', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 5 8', { type: 'move', from: 'e1', to: 'g1' }],
];
for (const [name, fen, action] of restorations) {
  test(`Chaos restores all physical state and FEN fields after ${name}`, () => {
    const before = createGameState({ fen, hands: { black: ['chaos'] } });
    const state = cancel(step(before, action));
    assert.deepEqual(state.pieces, before.pieces);
    assert.equal(state.fen, before.fen);
    assert.deepEqual(state.enPassant, before.enPassant);
    assert.deepEqual(state.shieldMove, before.shieldMove);
  });
}

test('Chaos repeat prohibition treats castling aliases as the same movement', () => {
  const state = cancel(step(createGameState({ fen: restorations[3]![1], hands: { black: ['chaos'] } }), restorations[3]![2]));
  for (const to of ['g1', 'h1']) {
    const result = applyAction(state, { type: 'move', from: 'e1', to });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
    assert.equal(legalDests(state).get('e1')?.includes(to as 'g1' | 'h1'), false);
  }
});

test('Chaos permits a different ordinary promotion at the same destination (FAQ board-state rule)', () => {
  const before = createGameState({ fen: '1r6/P7/8/8/K6k/8/8/8 w - - 0 1', hands: { black: ['chaos'] } });
  const state = cancel(step(before, { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' }));
  const replaced = step(state, { type: 'move', from: 'a7', to: 'a8', promotion: 'knight' });
  assert.equal(replaced.pieces.find(piece => piece.square === 'a8')?.role, 'knight');
});

test('Knightmare permits a different ordinary promotion at the same destination (FAQ board-state rule)', () => {
  const before = createGameState({ fen: '1r6/P7/8/8/K6k/8/8/8 w - - 0 1', hands: { black: ['knightmare'] } });
  const moved = step(before, { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' });
  const state = step(moved, { type: 'playCard', cardId: 'knightmare' });
  const replaced = step(state, { type: 'move', from: 'a7', to: 'a8', promotion: 'knight' });
  assert.equal(replaced.pieces.find(piece => piece.square === 'a8')?.role, 'knight');
});

test('Chaos rejects the identical promotion and an omitted declaration', () => {
  const state = cancel(step(createGameState({ fen: restorations[2]![1], hands: { black: ['chaos'] } }), restorations[2]![2]));
  for (const promotion of ['queen', undefined]) {
    const result = applyAction(state, { type: 'move', from: 'a7', to: 'a8', promotion });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

// FAQ p.50's board-state criterion applies to the on-board promoted role;
// this is a derived application, not a published promotion-specific example.
const promotionFixtures = [
  { color: 'white', opponent: 'black', fen: '1r6/P7/8/8/K6k/8/8/8 w - - 7 12', from: 'a7', to: 'a8', capture: 'b8' },
  { color: 'black', opponent: 'white', fen: '8/8/8/k6K/8/8/p7/1R6 b - - 7 12', from: 'a2', to: 'a1', capture: 'b1' },
] as const;
const promotionRoles = ['queen', 'rook', 'bishop', 'knight'] as const;
function rejectedPromotion(state: GameState, action: GameAction): void {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false, JSON.stringify(action));
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}
for (const cardId of ['chaos', 'knightmare', 'think-again']) {
  for (const fixture of promotionFixtures) {
    test(`${cardId}: ${fixture.color} permits exactly the different ordinary promotion results`, () => {
      const before = createGameState({ fen: fixture.fen, hands: { [fixture.opponent]: [cardId] } });
      for (const original of promotionRoles) {
        const state = step(step(before, { type: 'move', from: fixture.from, to: fixture.to, promotion: original }), { type: 'playCard', cardId });
        assert.deepEqual(state.pieces, before.pieces);
        assert.equal(state.fen, before.fen);
        for (const promotion of promotionRoles) {
          const action = { type: 'move', from: fixture.from, to: fixture.to, promotion } as const;
          if (promotion === original) { rejectedPromotion(state, action); continue; }
          const expected = step(before, action);
          const replaced = step(state, action);
          assert.deepEqual(replaced.pieces, expected.pieces);
          assert.equal(replaced.fen, expected.fen);
          assert.deepEqual(replaced.enPassant, expected.enPassant);
          assert.equal(replaced.pendingRescue ?? null, null);
          assert.equal(step(replaced, { type: 'endTurn' }).turn.color, fixture.opponent);
        }
        assert.ok(legalDests(state).get(fixture.from)?.includes(fixture.to));
        rejectedPromotion(state, { type: 'move', from: fixture.from, to: fixture.to });
      }
    });
  }
  test(`${cardId}: capture underpromotion and different-destination controls preserve physical identity`, () => {
    for (const fixture of promotionFixtures) {
      const before = createGameState({ fen: fixture.fen, hands: { [fixture.opponent]: [cardId] } });
      const action = { type: 'move', from: fixture.from, to: fixture.capture, promotion: 'queen' } as const;
      const restored = step(step(before, action), { type: 'playCard', cardId });
      assert.deepEqual(restored.pieces, before.pieces);
      rejectedPromotion(restored, action);
      for (const promotion of ['rook', 'bishop', 'knight']) {
        const replacement = { ...action, promotion };
        const next = step(restored, replacement);
        assert.deepEqual(next.pieces, step(before, replacement).pieces);
        assert.equal(next.pieces.find(piece => piece.square === fixture.capture)?.promoted, true);
      }
      const quiet = step(step(before, { ...action, to: fixture.to }), { type: 'playCard', cardId });
      assert.deepEqual(step(quiet, action).pieces, step(before, action).pieces);
    }
  });
  test(`${cardId}: invalid and stale promotion choices reject atomically`, () => {
    for (const fixture of promotionFixtures) {
      const before = createGameState({ fen: fixture.fen, hands: { [fixture.opponent]: [cardId] } });
      const action = { type: 'move', from: fixture.from, to: fixture.to, promotion: 'queen' } as const;
      const state = step(step(before, action), { type: 'playCard', cardId });
      for (const promotion of [undefined, null, false, 1, '', 'king', 'pawn', 'Queen', {}, ['knight']]) {
        rejectedPromotion(state, { ...action, promotion });
      }
      rejectedPromotion(state, { ...action, from: fixture.to, promotion: 'knight' });
      rejectedPromotion(state, { ...action, to: fixture.from, promotion: 'knight' });
      const replaced = step(state, { ...action, promotion: 'knight' });
      rejectedPromotion(replaced, { ...action, promotion: 'rook' });
    }
  });
}
test('a promotion token cannot authorize repeating an ordinary nonpromotion', () => {
  const state = cancel(moved());
  for (const promotion of promotionRoles) rejectedPromotion(state, { type: 'move', from: 'e2', to: 'e4', promotion });
});
test('keeping or returning optional Panic preserves the promotion result prohibition', () => {
  const before = createGameState({ fen: promotionFixtures[0].fen, hands: { white: ['panic'], black: ['chaos'] } });
  const action = { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' } as const;
  const played = step(step(before, action), { type: 'playCard', cardId: 'panic' });
  for (const returnCard of [true, false]) {
    const state = cancel(played, { returnCard });
    rejectedPromotion(state, action);
    const replaced = step(state, { ...action, promotion: 'knight' });
    assert.deepEqual(replaced.effects, state.effects);
    assert.equal(replaced.players.white.hand.some(card => card.cardId === 'panic'), returnCard);
  }
});
test('a changed promotion retains pending rescue and cannot end with its King in check', () => {
  const before = createGameState({ fen: 'rn6/P7/8/8/K6k/8/8/8 w - - 7 12', hands: { white: ['fatal-attraction'], black: ['chaos'] } });
  const action = { type: 'move', from: 'a7', to: 'b8', promotion: 'queen' } as const;
  const promoted = step(before, action);
  assert.ok(promoted.pendingRescue);
  const saved = step(promoted, { type: 'playCard', cardId: 'fatal-attraction', target: 'b8' });
  const restored = cancel(saved);
  const replaced = step(restored, { ...action, promotion: 'knight' });
  assert.ok(replaced.pendingRescue);
  assert.equal(isKingInCheck(replaced, 'white'), true);
  rejectedPromotion(replaced, { type: 'endTurn' });
  const rescued = step(replaced, { type: 'playCard', cardId: 'fatal-attraction', target: 'b8' });
  assert.equal(isKingInCheck(rescued, 'white'), false);
  step(rescued, { type: 'endTurn' });
});
test('changed promotion still applies Coup royalty consequences', () => {
  const before = createGameState({ fen: '8/P7/8/8/K6k/8/8/8 w - - 7 12', phase: 'afterMove', moveMade: true, hands: { white: ['coup'], black: ['chaos'] } });
  let royal = step(before, { type: 'playCard', cardId: 'coup', target: 'a7' });
  royal = step(royal, { type: 'endTurn' });
  royal = step(royal, { type: 'move', from: 'h4', to: 'h3' });
  royal = step(royal, { type: 'endTurn' });
  const action = { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' } as const;
  const restored = cancel(step(royal, action));
  const replaced = step(restored, { ...action, promotion: 'knight' });
  assert.deepEqual(replaced.pieces, step(royal, { ...action, promotion: 'knight' }).pieces);
  assert.equal(replaced.pieces.find(piece => piece.square === 'a8')?.royal, true);
  assert.equal(replaced.pieces.find(piece => piece.square === 'a4')?.royal, false);
});

test('Chaos repeat prohibition expires and reaction does not spend the following turn allowance', () => {
  let state = step(cancel(moved()), { type: 'move', from: 'd2', to: 'd4' });
  state = step(state, { type: 'endTurn' });
  assert.equal(state.turn.cardPlays.black, 0);
  state = step(state, { type: 'move', from: 'e7', to: 'e5' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e4');
});

test('Chaos works symmetrically after a black move and restores clocks', () => {
  const before = createGameState({ fen: '4k3/7p/8/8/8/8/P7/4K3 b - - 9 14', hands: { white: ['chaos'] } });
  const state = cancel(step(before, { type: 'move', from: 'h7', to: 'h5' }));
  assert.equal(state.turn.color, 'black');
  assert.equal(state.fen, before.fen);
  assert.equal(state.turn.cardPlays.white, 1);
});

test('Chaos fizzles when restoration and the repeat ban would directly create mate', () => {
  const before = createGameState({ fen: '7r/8/8/8/8/6k1/8/7K w - - 7 3', hands: { black: ['chaos'] }, decks: { black: ['chaos'] } });
  assert.deepEqual([...legalDests(before)], [['h1', ['g1']]]);
  const movedState = step(before, { type: 'move', from: 'h1', to: 'g1' });
  const state = step(movedState, { type: 'playCard', cardId: 'chaos' });
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.equal(state.fen, movedState.fen);
  assert.deepEqual(state.pieces, movedState.pieces);
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.black.discard.length, 1);
  assert.equal(state.players.black.hand.length, 1);
  assert.equal(state.players.black.deck.length, 0);
});

// Publisher FAQ pp.16/37 includes the optional card in the canceled turn;
// pp.17/38/50 still require a different board displacement on replay.
for (const alias of ['chaos', 'knightmare', 'think-again']) {
  for (const optional of ['crab', 'curse', 'panic']) {
    test(`${alias} after ${optional}: both colors, physical return choices and effects`, () => {
      for (const color of ['white', 'black'] as const) {
        const opponent = color === 'white' ? 'black' : 'white';
        for (const returnCard of [undefined, true, false]) {
          const before = createGameState({
            fen: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR ${color === 'white' ? 'w' : 'b'} KQkq - 0 1`,
            hands: { [color]: [optional], [opponent]: [alias] },
            decks: { [color]: ['pacifism', 'crab'], [opponent]: ['blessing', 'panic'] },
          });
          const move = { type: 'move', from: color === 'white' ? 'g1' : 'g8', to: color === 'white' ? 'f3' : 'f6' } as const;
          const target = optional === 'crab' ? color === 'white' ? 'e2' : 'e7'
            : optional === 'curse' ? color === 'white' ? 'd8' : 'd1' : undefined;
          const played = step(step(before, move), { type: 'playCard', cardId: optional, target });
          assert.equal(played.effects.length, 1);
          assert.deepEqual(cardPlayTargets(played, alias), [undefined]);
          let state = step(played, { type: 'playCard', cardId: alias,
            ...(returnCard === undefined ? {} : { target: { returnCard } }) });
          assert.equal(state.history.at(-1)?.type, 'cardPlayed');
          assert.deepEqual(state.pieces, before.pieces);
          assert.equal(state.fen, before.fen);
          assert.deepEqual(state.effects, returnCard === false ? played.effects : before.effects);
          assert.equal(state.turn.color, color);
          assert.equal(state.turn.phase, 'beforeMove');
          assert.equal(state.turn.moveMade, false);
          assert.deepEqual(state.players[color], returnCard === false ? played.players[color] : before.players[color]);
          assert.equal(state.turn.cardPlays[color], returnCard === false ? 1 : 0);
          assert.deepEqual(state.players[opponent], {
            hand: before.players[opponent].deck.slice(0, 1), deck: before.players[opponent].deck.slice(1),
            discard: before.players[opponent].hand,
          });
          const rejected = applyAction(state, move);
          assert.equal(rejected.ok, false);
          assert.deepEqual(rejected.state, state);
          if (color === 'white' && returnCard === undefined) {
            assert.equal(legalDests(state).get(move.from)?.includes(move.to), false);
          }
          state = step(state, { type: 'move', from: color === 'white' ? 'g1' : 'g8', to: color === 'white' ? 'h3' : 'h6' });
          assert.equal(isKingInCheck(state, color), false);
          state = step(state, { type: 'endTurn' });
          assert.equal(state.turn.color, opponent);
          assert.equal(state.turn.cardPlays[opponent], 0);
        }
      }
    });
  }
}

test('changing or omitting the optional card cannot legalize the identical board move', () => {
  let state = createGameState({ hands: { white: ['crab', 'pacifism'], black: ['chaos'] } });
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  state = cancel(state);
  state = step(state, { type: 'playCard', cardId: 'pacifism', target: 'b1' });
  const repeat = applyAction(state, { type: 'move', from: 'g1', to: 'f3' });
  assert.equal(repeat.ok, false);
  assert.deepEqual(repeat.state, state);
  assert.equal(step(state, { type: 'move', from: 'g1', to: 'h3' }).turn.moveMade, true);
});

test('optional card cancellation returns the selected physical copy only', () => {
  const before = createGameState({ hands: { white: ['crab', 'crab'], black: ['chaos', 'chaos'] }, decks: { white: ['panic'] } });
  let state = step(before, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'crab', cardInstanceId: before.players.white.hand[1]!.id, target: 'e2' });
  state = step(state, { type: 'playCard', cardId: 'chaos', cardInstanceId: before.players.black.hand[1]!.id, target: { returnCard: false } });
  assert.deepEqual(state.players.white.hand, [before.players.white.hand[0], before.players.white.deck[0]]);
  assert.deepEqual(state.players.white.discard, []);
  assert.deepEqual(state.players.black.hand, [before.players.black.hand[0]]);
  assert.deepEqual(state.players.black.discard, [before.players.black.hand[1]]);
  assert.deepEqual((state.effects as Array<{ card: unknown }>).map(effect => effect.card), [before.players.white.hand[1]]);
});

test('Chaos returns an optional Haunting Memories copy as its original physical card', () => {
  let state = createGameState({ hands: { white: ['crab', 'chaos'], black: ['haunting-memories'] }, decks: { black: ['panic'] } });
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  const before = step(state, { type: 'endTurn' });
  state = step(before, { type: 'move', from: 'g8', to: 'f6' });
  state = step(state, { type: 'playCard', cardId: 'haunting-memories', target: 'e7' });
  assert.equal(state.history.at(-1)?.copiedCardId, 'crab');
  state = cancel(state);
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.effects, before.effects);
  assert.deepEqual(state.players.black, before.players.black);
});

test('reaction Plots keeps its independent expenditure and allowance after optional-card cancellation', () => {
  let state = createGameState({ hands: { white: ['crab'], black: ['plots-within-plots', 'chaos', 'knightmare'] } });
  const before = state;
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  state = step(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
  state = cancel(state);
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.effects, before.effects);
  assert.deepEqual(state.players.white, before.players.white);
  assert.deepEqual(state.players.black.discard, before.players.black.hand.slice(0, 2));
  assert.equal(state.turn.cardPlays.black, 2);
  assert.equal(state.plotsAllowances?.find(allowance => allowance.player === 'black')?.remaining, 1);
});

test('successive cancellations preserve the previous turn optional effect and response expenditure', () => {
  let state = createGameState({ hands: { white: ['crab', 'knightmare'], black: ['chaos', 'curse'] } });
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  state = cancel(state);
  state = step(state, { type: 'move', from: 'g1', to: 'h3' });
  state = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  const before = step(state, { type: 'endTurn' });
  state = step(before, { type: 'move', from: 'g8', to: 'f6' });
  state = step(state, { type: 'playCard', cardId: 'curse', target: 'd1' });
  state = step(state, { type: 'playCard', cardId: 'knightmare' });
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.effects, before.effects);
  assert.deepEqual(state.players.black, before.players.black);
});

test('Fog restores the optional card and completed move when it counters Chaos', () => {
  let state = createGameState({ hands: { white: ['crab', 'fog-of-war'], black: ['chaos'] }, decks: { white: ['panic'] } });
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  const played = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  state = step(cancel(played), { type: 'playCard', cardId: 'fog-of-war' });
  assert.deepEqual(state.pieces, played.pieces);
  assert.deepEqual(state.effects, played.effects);
  assert.equal(state.fen, played.fen);
  assert.equal(state.turn.moveMade, true);
  assert.deepEqual(state.players.white.hand, played.players.white.hand.filter(card => card.cardId !== 'fog-of-war'));
  assert.equal(state.players.black.discard.filter(card => card.cardId === 'chaos').length, 1);
});

test('an ended optional-card turn cannot be canceled during the next turn', () => {
  let state = createGameState({ hands: { white: ['crab', 'chaos'], black: ['chaos'] } });
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'crab', target: 'e2' });
  state = step(state, { type: 'endTurn' });
  const result = applyAction(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('ordinary end-turn discard creates no played card or new cancellation window', () => {
  let state = createGameState({ hands: { white: ['crab', 'chaos'], black: ['chaos'] }, decks: { white: ['panic'] } });
  const discarded = state.players.white.hand[0]!;
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'endTurn', discardCardInstanceId: discarded.id });
  assert.deepEqual(state.players.white.discard, [discarded]);
  assert.equal(state.history.some(event => event.type === 'cardPlayed'), false);
  assert.deepEqual(cardPlayTargets(state, 'chaos'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'chaos' }).ok, false);
});

test('unrelated opponent Vulture does not become a cancelable move under reaction Plots', () => {
  let state = createGameState({ hands: { white: ['panic'], black: ['plots-within-plots', 'vulture', 'chaos'] } });
  state = step(state, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'panic' });
  state = step(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
  state = step(state, { type: 'playCard', cardId: 'vulture' });
  const result = applyAction(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('optional Fireball restores the original mover and captures without changing the banned move', () => {
  const before = createGameState({ hands: { white: ['fireball'], black: ['chaos'] } });
  let state = step(before, { type: 'move', from: 'g1', to: 'f3' });
  state = step(state, { type: 'playCard', cardId: 'fireball', target: 'f3' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-g1')?.zone, 'captured');
  state = cancel(state);
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.players.white, before.players.white);
  assert.equal(applyAction(state, { type: 'move', from: 'g1', to: 'f3' }).ok, false);
});

test('Chaos after a saving optional card restores the pre-capture position and escape opportunity', () => {
  const before = createGameState({ fen: '7k/8/8/8/8/6nr/7P/7K w - - 7 3', hands: { white: ['fatal-attraction'], black: ['chaos'] } });
  let state = step(before, { type: 'move', from: 'h2', to: 'g3' });
  assert.ok(state.pendingRescue);
  state = step(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'g3' });
  assert.equal(isKingInCheck(state, 'white'), false);
  state = cancel(state);
  assert.deepEqual(state.pieces, before.pieces);
  assert.equal(state.pendingRescue ?? null, null);
  assert.equal(isKingInCheck(state, 'white'), isKingInCheck(before, 'white'));
  assert.equal(applyAction(state, { type: 'move', from: 'h2', to: 'g3' }).ok, false);
  assert.equal(isKingInCheck(step(state, { type: 'move', from: 'h1', to: 'g1' }), 'white'), false);
});

test('Chaos after optional Panic still fizzles if the replacement ban directly mates the mover', () => {
  let state = createGameState({ fen: '7r/8/8/8/8/6k1/8/7K w - - 7 3', hands: { white: ['panic'], black: ['chaos'] } });
  state = step(state, { type: 'move', from: 'h1', to: 'g1' });
  const played = step(state, { type: 'playCard', cardId: 'panic' });
  state = step(played, { type: 'playCard', cardId: 'chaos' });
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.deepEqual(state.pieces, played.pieces);
  assert.deepEqual(state.effects, played.effects);
  assert.deepEqual(state.players.white, played.players.white);
  assert.equal(state.players.black.discard.length, 1);
});

for (const optional of ['crab', 'coup']) {
  test(`declining optional ${optional} preserves physical attributes while undoing the move`, () => {
    const before = createGameState({ hands: { white: [optional], black: ['chaos'] }, decks: { white: ['panic'] } });
    const from = optional === 'crab' ? 'e2' : 'g1';
    const to = optional === 'crab' ? 'e4' : 'f3';
    let state = step(before, { type: 'move', from, to });
    const played = step(state, { type: 'playCard', cardId: optional, target: optional === 'crab' ? 'e4' : 'c2' });
    const expectedPieces = structuredClone(played.pieces);
    expectedPieces.find(piece => piece.square === to)!.square = from;
    state = cancel(played, { returnCard: false });
    assert.deepEqual(state.pieces, expectedPieces);
    assert.deepEqual(state.effects, played.effects);
    assert.deepEqual(state.players.white, played.players.white);
    state = step(state, { type: 'move', from: 'g1', to: 'h3' });
    assert.equal(step(state, { type: 'endTurn' }).turn.color, 'black');
  });
}

test('declining optional Earthquake retains orientation and clears the old en-passant opportunity', () => {
  const before = createGameState({ fen: '7k/8/8/3pP3/8/8/4P3/6NK w - d6 0 1', hands: { white: ['earthquake'], black: ['chaos'] } });
  assert.equal(before.enPassant.length, 1);
  let state = step(before, { type: 'move', from: 'g1', to: 'f3' });
  const played = step(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] } });
  state = cancel(played, { returnCard: false });
  assert.equal(state.orientation, played.orientation);
  assert.deepEqual(state.enPassant, played.enPassant);
  assert.deepEqual(state.effects, played.effects);
  assert.deepEqual(state.players.white, played.players.white);
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-g1')?.square, 'g1');
  state = step(state, { type: 'move', from: 'g1', to: 'h3' });
  assert.equal(step(state, { type: 'endTurn' }).turn.color, 'black');
});

test('optional Doomsayer retains its immediate declaration only when retrieval is declined', () => {
  for (const returnCard of [true, false]) {
    let state = createGameState({ hands: { white: ['doomsayer'], black: ['chaos'] } });
    state = step(state, { type: 'move', from: 'g1', to: 'f3' });
    const played = step(state, { type: 'playCard', cardId: 'doomsayer' });
    assert.ok(played.pendingDoomsayer);
    state = cancel(played, { returnCard });
    assert.deepEqual(state.pendingDoomsayer ?? null, returnCard ? null : played.pendingDoomsayer);
    if (!returnCard) state = step(state, { type: 'declineDoomsayer' });
    state = step(state, { type: 'move', from: 'g1', to: 'h3' });
    assert.equal(step(state, { type: 'endTurn' }).turn.color, 'black');
  }
});

test('completed optional Abduction callbacks preserve the original cancellation window', () => {
  for (const returnCard of [true, false]) for (const correct of [true, false]) {
    const before = createGameState({ hands: { white: ['abduction'], black: ['chaos'] }, decks: { white: ['panic'] } });
    let state = step(before, { type: 'move', from: 'g1', to: 'f3' });
    state = step(state, { type: 'playCard', cardId: 'abduction', target: 'a7' });
    const premature = applyAction(state, { type: 'playCard', cardId: 'chaos' });
    assert.equal(premature.ok, false);
    assert.deepEqual(premature.state, state);
    state = step(state, { type: 'revealAbduction' });
    const completed = step(state, correct
      ? { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'a7' }
      : { type: 'abductionTimeout' });
    state = cancel(completed, { returnCard });
    assert.equal(state.pendingAbduction ?? null, null);
    assert.equal(state.pieces.find(piece => piece.id === 'white-knight-g1')?.square, 'g1');
    assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-a7')?.zone, returnCard || correct ? 'board' : 'captured');
    assert.deepEqual(state.players.white, returnCard ? before.players.white : completed.players.white);
    state = step(state, { type: 'move', from: 'g1', to: 'h3' });
    assert.equal(step(state, { type: 'endTurn' }).turn.color, 'black');
  }
});
