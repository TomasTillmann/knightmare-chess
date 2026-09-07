import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import {
  applyAction,
  cardPlayTargets,
  isKingInCheck,
  legalDests,
  positionFor,
} from '../reducer.js';
import { createGameState } from '../state.js';
import type {
  BoardOrientation,
  Color,
  GameAction,
  GameState,
  Role,
  SquareName,
} from '../types.js';

const WHITE_CRAB_FEN = '7k/8/8/8/3P4/8/8/K7 w - - 0 1';

function afterMoveState({
  fen = WHITE_CRAB_FEN,
  color = 'white',
  hand = ['crab'],
  deck = [],
  orientation = 0,
}: {
  fen?: string;
  color?: Color;
  hand?: string[];
  deck?: string[];
  orientation?: BoardOrientation;
} = {}): GameState {
  const state = createGameState({
    fen,
    turn: color,
    phase: 'afterMove',
    moveMade: true,
    hands: { [color]: hand },
    decks: { [color]: deck },
  });
  state.orientation = orientation;
  return state;
}

function expectOk(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function expectError(state: GameState, action: GameAction, code: string): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

function transformedCrab({
  fen = WHITE_CRAB_FEN,
  color = 'white',
  square = 'd4',
  orientation = 0,
  deck = [],
}: {
  fen?: string;
  color?: Color;
  square?: SquareName;
  orientation?: BoardOrientation;
  deck?: string[];
} = {}): GameState {
  const played = expectOk(afterMoveState({ fen, color, orientation, deck }), {
    type: 'playCard',
    cardId: 'crab',
    target: square,
  });
  return {
    ...played,
    turn: {
      ...played.turn,
      color,
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { ...played.turn.cardPlays, [color]: 0 },
    },
  };
}

function pieceAt(state: GameState, square: SquareName) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function crabEffect(state: GameState) {
  return state.effects.find(effect => (
    typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === 'crab'
  )) as undefined | {
    type: 'crab';
    owner: Color;
    card: { id: string; cardId: string };
    pieceId: string;
  };
}

test('Crab exposes its exact printed metadata', () => {
  assert.deepEqual(CARD_CATALOG.crab, {
    id: 'crab',
    name: 'Crab',
    points: 5,
    unique: false,
    image: '/KC7_card1.png',
    description: 'One of your Pawns becomes a Crab for the rest of the game. Place a marker underneath it as a reminder. A Crab moves and captures diagonally, like a Bishop, but only forward and only one square at a time. If a Crab reaches the last rank, it is promoted like a regular Pawn.',
    timing: ['afterMove'],
    continuing: true,
  });
});

test('playing Crab after your move attaches the physical card and draws a replacement', () => {
  const before = afterMoveState({ deck: ['toll'] });
  const snapshot = structuredClone(before);
  const card = before.players.white.hand[0]!;
  const pawn = pieceAt(before, 'd4')!;
  const state = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });

  assert.deepEqual(before, snapshot);
  assert.deepEqual(crabEffect(state), { type: 'crab', owner: 'white', card, pieceId: pawn.id });
  assert.deepEqual(state.players.white.hand.map(instance => instance.cardId), ['toll']);
  assert.deepEqual(state.players.white.deck, []);
  assert.deepEqual(state.players.white.discard, []);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardPlayed',
    cardId: 'crab',
    target: 'd4',
    movement: [],
    preservePreviousMove: true,
  });
});

test('Crab preserves the Pawn physical identity and both role identities', () => {
  const before = afterMoveState();
  const pawn = pieceAt(before, 'd4')!;
  const state = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });
  const transformed = pieceAt(state, 'd4')!;

  assert.equal(transformed.id, pawn.id);
  assert.equal(transformed.role, 'pawn');
  assert.equal(transformed.originalRole, 'pawn');
  assert.equal(transformed.promoted, false);
  assert.equal(crabEffect(state)?.pieceId, transformed.id);
});

test('only an owned on-board Pawn is a legal Crab target', () => {
  const ownPawn = afterMoveState({ fen: '7k/8/8/3p4/3P4/8/2N5/K7 w - - 0 1' });
  assert.deepEqual(cardPlayTargets(ownPawn, 'crab'), ['d4']);
  expectError(ownPawn, { type: 'playCard', cardId: 'crab', target: 'd5' }, 'WRONG_OWNER');
  expectError(ownPawn, { type: 'playCard', cardId: 'crab', target: 'c2' }, 'WRONG_ROLE');
  expectError(ownPawn, { type: 'playCard', cardId: 'crab', target: 'e4' }, 'INVALID_TARGET');
});

test('Crab resolves the selected physical copy when duplicate cards are held', () => {
  const before = afterMoveState({ hand: ['crab', 'crab'] });
  const selected = before.players.white.hand[1]!;
  const state = expectOk(before, {
    type: 'playCard',
    cardId: 'crab',
    cardInstanceId: selected.id,
    target: 'd4',
  });

  assert.equal(crabEffect(state)?.card.id, selected.id);
  assert.deepEqual(state.players.white.hand.map(card => card.id), [before.players.white.hand[0]!.id]);
});

test('Crab is illegal before the move and failed play is atomic', () => {
  const before = createGameState({ fen: WHITE_CRAB_FEN, hands: { white: ['crab'] } });
  expectError(before, { type: 'playCard', cardId: 'crab', target: 'd4' }, 'INVALID_TIMING');
});

test('white and black Crabs move and capture one square diagonally forward', () => {
  const cases: Array<{ color: Color; fen: string; square: SquareName; expected: SquareName[] }> = [
    { color: 'white', fen: WHITE_CRAB_FEN, square: 'd4', expected: ['c5', 'e5'] },
    { color: 'black', fen: '7k/8/8/3p4/8/8/8/K7 b - - 0 1', square: 'd5', expected: ['c4', 'e4'] },
  ];
  for (const { color, fen, square, expected } of cases) {
    const state = transformedCrab({ color, fen, square });
    assert.deepEqual([...(legalDests(state).get(square) ?? [])].sort(), expected);
  }
});

test('Crab forward diagonals rotate with all four board orientations', () => {
  const cases: Array<[BoardOrientation, SquareName[]]> = [
    [0, ['c5', 'e5']],
    [90, ['e3', 'e5']],
    [180, ['c3', 'e3']],
    [270, ['c3', 'c5']],
  ];
  for (const [orientation, expected] of cases) {
    const state = transformedCrab({ orientation });
    assert.deepEqual([...(legalDests(state).get('d4') ?? [])].sort(), expected);
  }
});

test('Crab forbids straight, sideways, backward-diagonal, and distant moves', () => {
  const state = transformedCrab();
  const legal = new Set(legalDests(state).get('d4') ?? []);
  for (const square of ['d5', 'd3', 'c4', 'e4', 'c3', 'e3', 'b6', 'f6'] as SquareName[]) {
    assert.equal(legal.has(square), false, `${square} must be illegal`);
  }
  expectError(state, { type: 'move', from: 'd4', to: 'b6' }, 'ILLEGAL_MOVE');
});

test('friendly occupancy blocks either forward diagonal', () => {
  const state = transformedCrab({ fen: '7k/8/8/2N1N3/3P4/8/8/K7 w - - 0 1' });
  assert.deepEqual(legalDests(state).get('d4') ?? [], []);
});

test('enemy occupancy is capturable only on one-step forward diagonals', () => {
  const state = transformedCrab({
    fen: '7k/8/1n6/2n1n3/3P4/2n1n3/8/K7 w - - 0 1',
  });
  assert.deepEqual([...(legalDests(state).get('d4') ?? [])].sort(), ['c5', 'e5']);
});

test('moving a Crab relocates the same physical Pawn and carries its effect', () => {
  const state = transformedCrab();
  const pawn = pieceAt(state, 'd4')!;
  const moved = expectOk(state, { type: 'move', from: 'd4', to: 'c5' });

  assert.equal(pieceAt(moved, 'c5')?.id, pawn.id);
  assert.equal(pieceAt(moved, 'c5')?.originalRole, 'pawn');
  assert.equal(crabEffect(moved)?.pieceId, pawn.id);
  assert.deepEqual(moved.players.white.discard, []);
});

test('a Crab captures on its forward diagonal and remains transformed', () => {
  const state = transformedCrab({ fen: '7k/8/8/2n5/3P4/8/8/K7 w - - 0 1' });
  const crab = pieceAt(state, 'd4')!;
  const victim = pieceAt(state, 'c5')!;
  const moved = expectOk(state, { type: 'move', from: 'd4', to: 'c5' });

  assert.equal(pieceAt(moved, 'c5')?.id, crab.id);
  assert.equal(moved.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(crabEffect(moved)?.pieceId, crab.id);
});

test('capture ends Crab and moves its Continuing Effect card to discard', () => {
  const played = expectOk(afterMoveState({
    fen: '7k/3r4/8/8/3P4/8/8/K7 w - - 0 1',
  }), { type: 'playCard', cardId: 'crab', target: 'd4' });
  const crab = pieceAt(played, 'd4')!;
  const blackTurn = expectOk(played, { type: 'endTurn' });
  const captured = expectOk(blackTurn, { type: 'move', from: 'd7', to: 'd4' });

  assert.equal(captured.pieces.find(piece => piece.id === crab.id)?.zone, 'captured');
  assert.equal(crabEffect(captured), undefined);
  assert.deepEqual(captured.players.white.discard.map(card => card.cardId), ['crab']);
});

test('a Crab promotes to every ordinary Pawn promotion choice and keeps its identity', () => {
  for (const role of ['queen', 'rook', 'bishop', 'knight'] as Role[]) {
    const state = transformedCrab({
      fen: '8/3P4/7k/8/8/8/8/K7 w - - 0 1',
      square: 'd7',
    });
    const crab = pieceAt(state, 'd7')!;
    const promoted = expectOk(state, {
      type: 'move',
      from: 'd7',
      to: 'c8',
      promotion: role,
    });
    const piece = pieceAt(promoted, 'c8')!;

    assert.equal(piece.id, crab.id);
    assert.equal(piece.role, role);
    assert.equal(piece.originalRole, 'pawn');
    assert.equal(piece.promoted, true);
    assert.equal(crabEffect(promoted), undefined);
    assert.deepEqual(promoted.players.white.discard.map(card => card.cardId), ['crab']);
  }
});

test('a transformed Crab remains eligible for cards that name a Pawn', () => {
  const cases: Array<{ cardId: string; target: unknown; destination: SquareName }> = [
    { cardId: 'fanatic', target: 'd4', destination: 'd7' },
    { cardId: 'forced-march', target: [{ from: 'd4', to: 'c4' }], destination: 'c4' },
    { cardId: 'onslaught', target: [{ from: 'd4', to: 'd5' }], destination: 'd5' },
  ];
  for (const { cardId, target, destination } of cases) {
    const state = transformedCrab({ deck: [cardId] });
    const crab = pieceAt(state, 'd4')!;
    const targets = cardPlayTargets(state, cardId);
    assert.ok(targets.some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
    const moved = expectOk(state, { type: 'playCard', cardId, target });
    assert.equal(pieceAt(moved, destination)?.id, crab.id);
    assert.equal(crabEffect(moved)?.pieceId, crab.id);
  }
});

test('a neutral Pawn may become a Crab for either player but keeps its original owner direction', () => {
  const before = afterMoveState({ fen: '7k/8/8/8/3p4/8/8/K7 w - - 0 1' });
  const pawn = pieceAt(before, 'd4')!;
  pawn.neutral = true;

  assert.deepEqual(cardPlayTargets(before, 'crab'), ['d4']);
  const played = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });
  assert.equal(crabEffect(played)?.owner, 'white');
  assert.equal(crabEffect(played)?.pieceId, pawn.id);

  const moveState: GameState = {
    ...played,
    turn: {
      ...played.turn,
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { ...played.turn.cardPlays, white: 0 },
    },
  };
  assert.deepEqual([...(legalDests(moveState).get('d4') ?? [])].sort(), ['c3', 'e3']);
});

test('Crab targets original Pawn identity and its later effect overrides transformed Bishop range', () => {
  const before = afterMoveState({ fen: '8/7k/8/8/3P4/8/8/K7 w - - 0 1' });
  const pawn = pieceAt(before, 'd4')!;
  pawn.role = 'bishop';
  const identity = {
    id: pawn.id,
    owner: pawn.owner,
    role: pawn.role,
    originalRole: pawn.originalRole,
    promoted: pawn.promoted,
  };

  assert.deepEqual(cardPlayTargets(before, 'crab'), ['d4']);
  const played = expectOk(before, { type: 'playCard', cardId: 'crab', target: 'd4' });
  const transformed = pieceAt(played, 'd4')!;
  assert.deepEqual({
    id: transformed.id,
    owner: transformed.owner,
    role: transformed.role,
    originalRole: transformed.originalRole,
    promoted: transformed.promoted,
  }, identity);
  assert.equal(crabEffect(played)?.pieceId, pawn.id);

  const moveState: GameState = {
    ...played,
    turn: {
      ...played.turn,
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { ...played.turn.cardPlays, white: 0 },
    },
  };
  assert.deepEqual([...(legalDests(moveState).get('d4') ?? [])].sort(), ['c5', 'e5']);
});

test('Crab movement cannot expose its own King to check', () => {
  const state = transformedCrab({
    fen: '3r3k/8/8/8/8/8/3P4/3K4 w - - 0 1',
    square: 'd2',
  });

  assert.deepEqual(legalDests(state).get('d2') ?? [], []);
  expectError(state, { type: 'move', from: 'd2', to: 'c3' }, 'ILLEGAL_MOVE');
});

test('a Crab Regular Move may give check', () => {
  const state = transformedCrab({
    fen: '8/8/1k6/8/3P4/8/8/K7 w - - 0 1',
  });
  const moved = expectOk(state, { type: 'move', from: 'd4', to: 'c5' });

  assert.equal(isKingInCheck(moved, 'black'), true);
  assert.equal(crabEffect(moved)?.pieceId, pieceAt(moved, 'c5')?.id);
});

test('a Crab Continuing Effect may participate in checkmate', () => {
  const state = transformedCrab({
    fen: 'k7/2K5/2P5/2B5/8/8/8/8 w - - 0 1',
    square: 'c6',
  });
  const moved = expectOk(state, { type: 'move', from: 'c6', to: 'b7' });

  assert.equal(positionFor(moved, 'black').isCheckmate(), true);
  assert.equal(crabEffect(moved)?.pieceId, pieceAt(moved, 'b7')?.id);
});
