import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, boardFen } from '../reducer.js';
import { createGameState } from '../state.js';
import type {
  ApplyResult,
  BoardOrientation,
  GameAction,
  GameState,
  PacifismEffect,
  PieceState,
  SquareName,
} from '../types.js';

const FOUR_PAWNS = 'p6P/8/8/3k4/8/4K3/8/p6P w - - 0 1';
const SPARSE_CORNERS = '7b/8/8/3k4/8/4K3/8/R7 w - - 0 1';
type PromotionRole = 'queen' | 'rook' | 'bishop' | 'knight';
type Promotion = { square: SquareName; role: PromotionRole };

function afterMove(fen = SPARSE_CORNERS, orientation: BoardOrientation = 0): GameState {
  const state = createGameState({
    fen,
    phase: 'afterMove',
    moveMade: true,
    hands: { white: ['figure-dance'] },
  });
  state.orientation = orientation;
  return state;
}

function dance(state: GameState, target: Promotion[] | unknown = []): ApplyResult {
  const action: GameAction = {
    type: 'playCard',
    cardId: 'figure-dance',
    target,
  };
  return applyAction(state, action);
}

function accepted(result: ApplyResult): GameState {
  if (!result.ok) assert.fail(result.error.message);
  return result.state;
}

function rejected(result: ApplyResult, code = 'INVALID_TARGET'): GameState {
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('expected Figure Dance to be rejected');
  assert.equal(result.error.code, code);
  return result.state;
}

function on(state: GameState, square: SquareName): PieceState | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

test('cycles occupied corners counterclockwise without captures', () => {
  const state = accepted(dance(afterMove()));
  assert.equal(boardFen(state), 'b7/8/8/3k4/8/4K3/8/7R');
  assert.equal(on(state, 'a8')?.id, 'black-bishop-h8');
  assert.equal(on(state, 'h1')?.id, 'white-rook-a1');
});

test('cycles all four corners simultaneously', () => {
  const state = accepted(dance(afterMove(FOUR_PAWNS), [
    { square: 'h8', role: 'queen' },
    { square: 'a8', role: 'rook' },
    { square: 'h1', role: 'bishop' },
    { square: 'a1', role: 'knight' },
  ]));
  assert.equal(boardFen(state), 'R6Q/8/8/3k4/8/4K3/8/n6b');
  assert.deepEqual(state.pieces.filter(piece => piece.zone !== 'board'), []);
});

test('uses the orientation-90 last files for promotion', () => {
  const state = accepted(dance(afterMove(FOUR_PAWNS, 90), [
    { square: 'h8', role: 'queen' },
    { square: 'a1', role: 'knight' },
  ]));
  assert.equal(boardFen(state), 'P6Q/8/8/3k4/8/4K3/8/n6p');
});

test('orientation 180 moves the pawns without promoting them', () => {
  const state = accepted(dance(afterMove(FOUR_PAWNS, 180)));
  assert.equal(boardFen(state), 'P6P/8/8/3k4/8/4K3/8/p6p');
  assert.equal(state.pieces.filter(piece => piece.promoted).length, 0);
});

test('uses the orientation-270 last files for promotion', () => {
  const state = accepted(dance(afterMove(FOUR_PAWNS, 270), [
    { square: 'a8', role: 'rook' },
    { square: 'h1', role: 'bishop' },
  ]));
  assert.equal(boardFen(state), 'R6P/8/8/3k4/8/4K3/8/p6b');
});

test('promotes a transformed unpromoted original Pawn', () => {
  const state = afterMove('8/8/8/3k4/8/4K3/8/7P w - - 0 1');
  const pawn = on(state, 'h1')!;
  pawn.role = 'bishop';
  const result = accepted(dance(state, [{ square: 'h8', role: 'knight' }]));
  assert.deepEqual(on(result, 'h8'), { ...pawn, square: 'h8', role: 'knight', promoted: true });
});

test('does not re-promote an already-promoted original Pawn', () => {
  const state = afterMove('8/8/8/3k4/8/4K3/8/7P w - - 0 1');
  const pawn = on(state, 'h1')!;
  pawn.role = 'queen';
  pawn.promoted = true;
  const result = accepted(dance(state));
  assert.equal(on(result, 'h8')?.role, 'queen');
  assert.equal(on(result, 'h8')?.promoted, true);
});

test('does not promote a current Pawn whose original role was not Pawn', () => {
  const state = afterMove('8/8/8/3k4/8/4K3/8/7B w - - 0 1');
  const bishop = on(state, 'h1')!;
  bishop.role = 'pawn';
  const result = accepted(dance(state));
  assert.equal(on(result, 'h8')?.role, 'pawn');
  assert.equal(on(result, 'h8')?.originalRole, 'bishop');
  assert.equal(on(result, 'h8')?.promoted, false);
});

test('carries neutral, royal, and Pacifism identity with the moved piece', () => {
  const state = afterMove();
  const rook = on(state, 'a1')!;
  rook.neutral = true;
  rook.royal = true;
  const pacifism: PacifismEffect = {
    type: 'pacifism',
    owner: 'white',
    card: { id: 'white-pacifism', cardId: 'pacifism' },
    pieceId: rook.id,
  };
  state.effects = [pacifism];
  const result = accepted(dance(state));
  assert.equal(on(result, 'h1')?.neutral, true);
  assert.equal(on(result, 'h1')?.royal, true);
  assert.deepEqual(result.effects, [pacifism]);
});

test('keeps a Forbidden City marker bound to its fixed corner square', () => {
  const state = afterMove('7b/8/8/3k4/8/4K3/8/8 w - - 0 1');
  const forbiddenCity: GameState['effects'][number] = {
    type: 'forbidden-city',
    owner: 'black',
    card: { id: 'black-forbidden-city', cardId: 'forbidden-city' },
    square: 'a1',
  };
  state.effects = [forbiddenCity];
  const result = accepted(dance(state));
  assert.equal(on(result, 'a8')?.id, 'black-bishop-h8');
  assert.deepEqual(result.effects, [forbiddenCity]);
});

test('does not rewrite fixed-coordinate history from prior movement cards', () => {
  const state = afterMove();
  const prior = [
    {
      type: 'cardPlayed' as const,
      cardId: 'squaring-the-circle',
      target: 'a1' as const,
      movement: [{ from: 'e4' as const, to: 'a1' as const }],
    },
    {
      type: 'cardPlayed' as const,
      cardId: 'dubbing',
      movement: [{ from: 'b3' as const, to: 'a1' as const }],
    },
  ];
  state.history.push(...structuredClone(prior));
  const result = accepted(dance(state));
  assert.deepEqual(result.history.slice(0, 2), prior);
});

test('leaves non-corner pieces and their identities unchanged', () => {
  const state = afterMove();
  const before = state.pieces.find(piece => piece.square === 'e3')!;
  const result = accepted(dance(state));
  assert.deepEqual(result.pieces.find(piece => piece.id === before.id), before);
});

test('preserves en-passant and move clocks while synchronizing FEN', () => {
  const fen = '7b/8/8/3k1pP1/8/4K3/8/R7 w - f6 7 12';
  const state = afterMove(fen);
  const enPassant = structuredClone(state.enPassant);
  const result = accepted(dance(state));
  assert.equal(result.fen, 'b7/8/8/3k1pP1/8/4K3/8/7R w - f6 7 12');
  assert.deepEqual(result.enPassant, enPassant);
});

test('records one simultaneous card event after the previous move', () => {
  const state = afterMove();
  state.history.push({ type: 'move', from: 'e2', to: 'e4' });
  const result = accepted(dance(state));
  assert.equal(result.history.length, 2);
  assert.deepEqual(result.history[1], {
    type: 'cardPlayed',
    cardId: 'figure-dance',
    target: [],
    movement: [{ from: 'a1', to: 'h1' }, { from: 'h8', to: 'a8' }],
    preservePreviousMove: true,
  });
});

test('spends, discards, and replaces the card without leaving afterMove', () => {
  const state = afterMove();
  state.players.white.deck.push({ id: 'replacement', cardId: 'fanatic' });
  const result = accepted(dance(state));
  assert.deepEqual(result.players.white.hand.map(card => card.cardId), ['fanatic']);
  assert.deepEqual(result.players.white.discard.map(card => card.cardId), ['figure-dance']);
  assert.equal(result.players.white.deck.length, 0);
  assert.equal(result.turn.phase, 'afterMove');
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.cardPlays.white, 1);
});

test('fizzles and spends after the complete dance leaves an acting royal in check', () => {
  const state = afterMove('8/8/8/3k4/7r/4K3/8/R7 w - - 0 1');
  on(state, 'a1')!.royal = true;
  const before = boardFen(state);
  const result = accepted(dance(state));
  assert.equal(boardFen(result), before);
  assert.deepEqual(result.players.white.hand, []);
  assert.deepEqual(result.players.white.discard.map(card => card.cardId), ['figure-dance']);
  assert.deepEqual(result.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'figure-dance',
    reason: 'SELF_CHECK',
    movement: [],
    preservePreviousMove: true,
  });
});

test('fizzles and spends when the completed dance would directly checkmate', () => {
  const state = afterMove('7R/k1N5/2K5/8/8/8/8/8 w - - 0 1');
  const before = boardFen(state);
  const result = accepted(dance(state));
  assert.equal(boardFen(result), before);
  assert.deepEqual(result.players.white.hand, []);
  assert.deepEqual(result.players.white.discard.map(card => card.cardId), ['figure-dance']);
  assert.deepEqual(result.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'figure-dance',
    reason: 'DIRECT_MATE',
    movement: [],
    preservePreviousMove: true,
  });
});

test('rejects play before the regular move without spending the card', () => {
  const state = createGameState({ fen: SPARSE_CORNERS, hands: { white: ['figure-dance'] } });
  const before = structuredClone(state);
  assert.deepEqual(rejected(dance(state), 'INVALID_TIMING'), before);
});

test('rejects an afterMove phase that has no completed move', () => {
  const state = createGameState({
    fen: SPARSE_CORNERS,
    phase: 'afterMove',
    moveMade: false,
    hands: { white: ['figure-dance'] },
  });
  const before = structuredClone(state);
  assert.deepEqual(rejected(dance(state), 'INVALID_TIMING'), before);
});

test('requires every and only eligible promotion choice atomically', () => {
  const state = afterMove(FOUR_PAWNS);
  const before = structuredClone(state);
  const result = dance(state, [{ square: 'h8', role: 'queen' }]);
  assert.deepEqual(rejected(result), before);
  assert.deepEqual(state, before);
});

test('rejects promotion choices when no moved Pawn promotes', () => {
  const state = afterMove();
  const before = structuredClone(state);
  assert.deepEqual(rejected(dance(state, [{ square: 'a8', role: 'queen' }])), before);
});

test('rejects malformed promotion roles, squares, duplicates, and order atomically', () => {
  const valid: Promotion[] = [
    { square: 'h8', role: 'queen' },
    { square: 'a8', role: 'rook' },
    { square: 'h1', role: 'bishop' },
    { square: 'a1', role: 'knight' },
  ];
  const targets: unknown[] = [
    null,
    { promotions: valid },
    valid.map((choice, index) => index === 0 ? { ...choice, role: 'king' } : choice),
    valid.map((choice, index) => index === 0 ? { ...choice, square: 'e4' } : choice),
    [valid[0], valid[0], valid[2], valid[3]],
  ];
  for (const target of targets) {
    const state = afterMove(FOUR_PAWNS);
    const before = structuredClone(state);
    assert.deepEqual(rejected(dance(state, target)), before);
    assert.deepEqual(state, before);
  }
});
