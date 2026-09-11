import assert from 'node:assert/strict';
import test from 'node:test';

import {
  annexationDests,
  applyAction,
  dubbingDests,
  guardianDests,
  isKingInCheck,
  legalDests,
  longJumpDests,
  onslaughtDests,
  squaringTheCircleDests,
} from '../reducer.js';
import { createGameState } from '../state.js';
import type { BoardOrientation, GameState, Role, SquareName } from '../types.js';

type Direction = 'clockwise' | 'counterclockwise';
type Promotion = { square: SquareName; role: Exclude<Role, 'pawn' | 'king'> };

const make = (fen: string, turn: 'white' | 'black' = 'white') =>
  createGameState({ fen, turn, phase: 'afterMove', moveMade: true, hands: { [turn]: ['earthquake'] } });

const beforeMove = (state: GameState): GameState => {
  const copy = structuredClone(state);
  copy.turn.phase = 'beforeMove';
  copy.turn.moveMade = false;
  return copy;
};

function earthquake(state: GameState, direction: Direction, promotions: Promotion[] = []): GameState {
  const result = applyAction(state, { type: 'playCard', cardId: 'earthquake', target: { direction, promotions } });
  assert.equal(result.ok, true, result.ok ? '' : `${result.error.code}: ${result.error.message}`);
  return result.state;
}

const at = (state: GameState, square: SquareName) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('rotates orientation while keeping fixed coordinates and piece identities', () => {
  const before = make('4k3/8/8/8/8/2P5/8/4K3 w - - 7 12');
  const ids = before.pieces.map(piece => [piece.id, piece.square]);
  const after = earthquake(before, 'clockwise');
  assert.equal(after.orientation, 270);
  assert.deepEqual(after.pieces.map(piece => [piece.id, piece.square]), ids);
});

test('applies both rotation directions from every orientation', () => {
  for (const [start, direction, expected] of [
    [0, 'clockwise', 270], [90, 'clockwise', 0], [180, 'clockwise', 90], [270, 'clockwise', 180],
    [0, 'counterclockwise', 90], [270, 'counterclockwise', 0], [180, 'counterclockwise', 270], [90, 'counterclockwise', 180],
  ] as const) {
    const state = make('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    state.orientation = start as BoardOrientation;
    assert.equal(earthquake(state, direction).orientation, expected);
  }
});

test('promotes opponent first, then actor, in fixed-square order', () => {
  const state = make('4k3/8/8/8/p6P/8/8/4K3 w - - 0 1');
  const after = earthquake(state, 'counterclockwise', [
    { square: 'a4', role: 'rook' },
    { square: 'h4', role: 'knight' },
  ]);
  assert.equal(at(after, 'a4')?.role, 'rook');
  assert.equal(at(after, 'h4')?.role, 'knight');
});

test('accepts an empty promotion list when no pawn reaches a new last rank', () => {
  assert.equal(earthquake(make('4k3/8/8/8/3P4/8/8/4K3 w - - 0 1'), 'counterclockwise').orientation, 90);
});

for (const [name, promotions] of [
  ['missing', [{ square: 'a4', role: 'rook' }]],
  ['duplicate', [{ square: 'a4', role: 'rook' }, { square: 'a4', role: 'queen' }, { square: 'h4', role: 'knight' }]],
  ['actor-before-opponent', [{ square: 'h4', role: 'knight' }, { square: 'a4', role: 'rook' }]],
] as const) {
  test(`rejects ${name} promotion declarations atomically`, () => {
    const state = make('4k3/8/8/8/p6P/8/8/4K3 w - - 0 1');
    const snapshot = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'counterclockwise', promotions } });
    assert.equal(result.ok, false);
    assert.deepEqual(state, snapshot);
  });
}

test('post-rotation pawns move and capture along the rotated axis', () => {
  const state = beforeMove(earthquake(make('4k3/8/8/8/3p4/2P5/3p4/4K3 w - - 0 1'), 'counterclockwise'));
  assert.deepEqual(legalDests(state).get('c3')?.sort(), ['d2', 'd3', 'd4']);
});

test('post-rotation pawns double only from the rotated starting line', () => {
  const state = beforeMove(earthquake(make('4k3/8/8/8/8/1P3P2/8/4K3 w - - 0 1'), 'counterclockwise'));
  assert.deepEqual(legalDests(state).get('b3')?.sort(), ['c3', 'd3']);
  assert.deepEqual(legalDests(state).get('f3'), ['g3']);
});

test('pawn movement cards share the rotated forward direction', () => {
  const state = earthquake(make('4k3/8/8/8/8/1P6/8/4K3 w - - 0 1'), 'counterclockwise');
  assert.deepEqual(guardianDests(state, 'b3').sort(), ['c3', 'd3']);
  assert.deepEqual(annexationDests(state, 'b3'), ['d3']);
  assert.deepEqual(onslaughtDests(state, 'b3'), ['c3']);
});

test('Fanatic follows rotated forward without promoting at the edge', () => {
  let state = earthquake(make('4k3/8/8/8/8/4P3/8/4K3 w - - 0 1'), 'counterclockwise');
  state.players.white.hand.push({ id: 'fanatic', cardId: 'fanatic' });
  state.turn.cardPlays.white = 0;
  state.turn.phase = 'beforeMove';
  state.turn.moveMade = false;
  const result = applyAction(state, { type: 'playCard', cardId: 'fanatic', cardInstanceId: 'fanatic', target: 'e3' });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(at(result.state, 'h3')?.role, 'pawn');
});

test('coordinate-based movement cards remain square-stable through rotation', () => {
  const before = make('4k3/8/8/8/8/2N1B3/8/R3K3 w - - 0 1');
  const long = longJumpDests(before, 'c3');
  const dub = dubbingDests(before, 'e3');
  const square = squaringTheCircleDests(before, 'e3');
  const after = earthquake(before, 'counterclockwise');
  assert.deepEqual(longJumpDests(after, 'c3'), long);
  assert.deepEqual(dubbingDests(after, 'e3'), dub);
  assert.deepEqual(squaringTheCircleDests(after, 'e3'), square);
});

test('rotation preserves Doppelganger history coordinates', () => {
  const state = make('4k3/8/8/8/8/2N5/8/3QK3 w - - 0 1');
  state.history.push({ type: 'move', from: 'a1', to: 'c3' });
  const after = earthquake(state, 'clockwise');
  assert.deepEqual(after.history[0], { type: 'move', from: 'a1', to: 'c3' });
});

test('promotion and rotation clear stale en-passant rights', () => {
  const state = make('4k3/8/8/8/pP6/8/8/4K3 w - b3 0 1');
  const after = earthquake(state, 'counterclockwise', [{ square: 'a4', role: 'queen' }]);
  assert.deepEqual(after.enPassant, []);
  assert.equal(at(after, 'a4')?.promoted, true);
});

test('neutral and royal markers survive rotation and promotion', () => {
  const state = make('4k3/8/8/8/7P/8/8/4K3 w - - 0 1');
  Object.assign(at(state, 'h4')!, { neutral: true, royal: true });
  const after = earthquake(state, 'counterclockwise', [{ square: 'h4', role: 'bishop' }]);
  assert.equal(at(after, 'h4')?.neutral, true);
  assert.equal(at(after, 'h4')?.royal, true);
});

test('Doomsayer, Vendetta, and pending speech state survive unchanged', () => {
  const state = make('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  state.effects = [
    { type: 'doomsayer', owner: 'black', card: { id: 'd', cardId: 'doomsayer' } },
    { type: 'vendetta', owner: 'black', card: { id: 'v', cardId: 'vendetta' } },
  ];
  state.pendingDoomsayer = { player: 'white', cardInstanceId: 'd' };
  const after = earthquake(state, 'clockwise');
  assert.deepEqual(after.effects.slice(0, state.effects.length), state.effects);
  assert.deepEqual(after.pendingDoomsayer, state.pendingDoomsayer);
});

test('castling flags, clocks, turn window, and prior history remain valid', () => {
  const state = make('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 17 42');
  state.history.push({ type: 'move', from: 'a1', to: 'a2' });
  const after = earthquake(state, 'clockwise');
  assert.match(after.fen, / KQkq - 17 42$/);
  assert.deepEqual(after.history[0], state.history[0]);
  assert.equal(after.turn.color, 'white');
  assert.equal(after.turn.moveMade, true);
});

test('inverse rotations restore orientation and pawn destinations', () => {
  const initial = make('4k3/8/8/8/8/1P6/8/4K3 w - - 0 1');
  const rotated = earthquake(initial, 'clockwise');
  rotated.players.white.hand.push({ id: 'earthquake-2', cardId: 'earthquake' });
  rotated.turn.cardPlays.white = 0;
  const restored = earthquake(rotated, 'counterclockwise');
  assert.equal(restored.orientation, 0);
  assert.deepEqual(legalDests(beforeMove(restored)).get('b3'), legalDests(beforeMove(initial)).get('b3'));
});

test('can rescue the actor king from check by rotating attack geometry', () => {
  const state = make('k7/8/8/8/8/8/3p4/4K3 w - - 0 1');
  assert.equal(isKingInCheck(state, 'white'), true);
  const reference = structuredClone(state);
  reference.orientation = 90;
  assert.equal(isKingInCheck(reference, 'white'), false);
  assert.equal(earthquake(state, 'counterclockwise').orientation, 90);
});

test('continuing rotation may cause mate without mutating the input', () => {
  const state = make('6P1/5KPk/8/8/8/8/8/8 w - - 0 1');
  assert.equal(isKingInCheck(state, 'black'), false);
  const initialBlackTurn = beforeMove(structuredClone(state));
  initialBlackTurn.turn.color = 'black';
  assert.deepEqual(legalDests(initialBlackTurn).get('h7'), ['h6']);
  const reference = beforeMove(structuredClone(state));
  reference.orientation = 90;
  reference.turn.color = 'black';
  assert.equal(isKingInCheck(reference, 'black'), true);
  assert.equal([...legalDests(reference).values()].flat().length, 0);
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'counterclockwise', promotions: [] } });
  assert.deepEqual(state, snapshot);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.state.orientation, 90);
    assert.notEqual(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
    assert.equal(isKingInCheck(result.state, 'black'), true);
    assert.equal(isKingInCheck(result.state, 'white'), false);
  }
});

for (const role of ['queen', 'rook'] as const) {
  for (const lifecycle of ['geometry', 'accounting', 'immutable input', 'end turn'] as const) {
    test(`mate with h7 ${role}: ${lifecycle}`, () => {
      const initial = createGameState({
        fen: '2R5/k6P/pp6/8/8/8/8/4K1N1 w - - 0 1',
        hands: { white: ['earthquake'] },
      });
      initial.players.white.deck = [{ id: 'replacement', cardId: 'earthquake' }];
      initial.players.black.hand = [];
      initial.players.black.deck = [];
      const moved = applyAction(initial, { type: 'move', from: 'g1', to: 'f3' });
      assert.equal(moved.ok, true);
      const state = moved.state;
      const snapshot = structuredClone(state);
      const card = state.players.white.hand[0];
      if (lifecycle === 'geometry') {
        const reference = beforeMove(state);
        reference.orientation = 90;
        reference.turn.color = 'black';
        Object.assign(at(reference, 'a6')!, { role: 'rook', promoted: true });
        Object.assign(at(reference, 'h7')!, { role, promoted: true });
        assert.equal(isKingInCheck(reference, 'white'), false);
        assert.equal(isKingInCheck(reference, 'black'), true);
        assert.equal([...legalDests(reference).values()].flat().length, 0);
      }
      const after = earthquake(state, 'counterclockwise', [
        { square: 'a6', role: 'rook' }, { square: 'h7', role },
      ]);

      if (lifecycle === 'geometry') {
        assert.equal(after.orientation, 90);
        assert.equal(isKingInCheck(after, 'white'), false);
        assert.equal(isKingInCheck(after, 'black'), true);
        const defender = beforeMove(after);
        defender.turn.color = 'black';
        assert.equal([...legalDests(defender).values()].flat().length, 0);
        assert.equal(after.outcome, null, 'mate adjudication waits for the defending turn');
      } else if (lifecycle === 'accounting') {
        assert.equal(after.effects.length, state.effects.length + 1);
        assert.ok(after.effects.some(effect =>
          (effect as { card?: { id: string } }).card?.id === card.id));
        assert.deepEqual(after.players.white.discard, state.players.white.discard);
        assert.deepEqual(after.players.white.hand, [{ id: 'replacement', cardId: 'earthquake' }]);
        assert.deepEqual(after.players.white.deck, []);
        assert.deepEqual(after.turn, {
          ...state.turn, cardPlays: { ...state.turn.cardPlays, white: state.turn.cardPlays.white + 1 },
        });
        assert.deepEqual(after.history[0], state.history[0]);
        assert.equal(at(after, 'f3')?.id, at(state, 'f3')?.id);
        assert.equal(after.history.at(-1)?.type, 'cardPlayed');
      } else if (lifecycle === 'immutable input') {
        assert.deepEqual(state, snapshot);
        for (const [square, promotedRole] of [['a6', 'rook'], ['h7', role]] as const) {
          assert.equal(at(state, square)?.role, 'pawn');
          assert.equal(at(after, square)?.id, at(state, square)?.id);
          assert.equal(at(after, square)?.role, promotedRole);
          assert.equal(at(after, square)?.promoted, true);
        }
      } else {
        const ended = applyAction(after, { type: 'endTurn' });
        assert.equal(ended.ok, true);
        assert.deepEqual(ended.state.outcome, { winner: 'white', reason: 'checkmate' });
        assert.equal(ended.state.orientation, 90);
        assert.equal(at(ended.state, 'a6')?.role, 'rook');
        assert.equal(at(ended.state, 'h7')?.role, role);
        assert.deepEqual(ended.state.effects, after.effects);
        assert.deepEqual(ended.state.players.white, after.players.white);
      }
    });
  }
}

test('rotation that exposes the actor king still fizzles and spends the card', () => {
  const state = make('k7/8/8/8/4K3/5p2/8/8 w - - 0 1');
  const snapshot = structuredClone(state);
  assert.equal(isKingInCheck(state, 'white'), false);
  const reference = structuredClone(state);
  reference.orientation = 90;
  assert.equal(isKingInCheck(reference, 'white'), true);
  const after = earthquake(state, 'counterclockwise');
  assert.deepEqual(state, snapshot);
  assert.equal(after.orientation, state.orientation);
  assert.deepEqual(after.pieces, state.pieces);
  assert.deepEqual(after.effects, state.effects);
  assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(after.players.white.discard.some(card => card.id === state.players.white.hand[0].id), true);
});

test('rejects malformed targets atomically', () => {
  const state = make('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'left', promotions: [] } });
  assert.equal(result.ok, false);
  assert.deepEqual(state, snapshot);
});
