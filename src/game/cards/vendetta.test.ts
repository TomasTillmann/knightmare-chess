import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState } from '../types.js';

const CARD = 'vendetta';
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Result = ReturnType<typeof applyAction>;

function game(options: Options = {}): GameState {
  return createGameState({
    fen: '4k3/8/8/8/8/3p4/8/3RK3 w - - 0 1',
    phase: 'afterMove', moveMade: true,
    hands: { white: [CARD], black: [] }, decks: { white: [], black: [] }, ...options,
  });
}

function beforeMove(options: Options = {}): GameState {
  return game({ ...options, phase: 'beforeMove', moveMade: false });
}

function play(state: GameState, cardInstanceId?: unknown): Result {
  return applyAction(state, { type: 'playCard', cardId: CARD, ...(cardInstanceId === undefined ? {} : { cardInstanceId }) } as Action);
}

function move(state: GameState, from: string, to: string, promotion?: string): Result {
  return applyAction(state, { type: 'move', from, to, ...(promotion ? { promotion } : {}) });
}

function endTurn(state: GameState): Result {
  return applyAction(state, { type: 'endTurn' });
}

function ok(result: Result): GameState {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function pieceAt(state: GameState, square: string): PieceState | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function pieceId(state: GameState, square: string): string {
  const piece = pieceAt(state, square);
  assert.ok(piece, `Expected a piece on ${square}`);
  return piece.id;
}

function patchPiece(state: GameState, square: string, changes: Partial<PieceState>): GameState {
  const id = pieceId(state, square);
  return { ...state, pieces: state.pieces.map(piece => piece.id === id ? { ...piece, ...changes } : piece) };
}

function withVendetta(state: GameState, owner: 'white' | 'black' = 'white'): GameState {
  return { ...state, effects: [...state.effects, { type: CARD, owner, card: { id: `${owner}-vendetta`, cardId: CARD } }] };
}

function frozen<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) frozen(child);
  }
  return value;
}

describe('Vendetta metadata and activation', () => {
  it('has the printed unique continuing after-move metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD, name: 'Vendetta', points: 3, unique: true,
      image: '/KC4_card1.png',
      description: 'Each player must now use his move to capture one of his opponent\'s pieces, if he can do so. This effect lasts until one of the players cannot make a capture. You are not required to play a card to make a capture, even if you have a card that would let you capture.',
      timing: ['afterMove'], continuing: true,
    });
  });

  it('requires afterMove after the actor has moved and leaves the input unchanged on rejection', () => {
    for (const [phase, moveMade] of [['beforeMove', false], ['beforeMove', true], ['afterMove', false]] as const) {
      const before = game({ phase, moveMade });
      const snapshot = structuredClone(before);
      const result = play(before);
      assert.equal(result.ok, false);
      assert.equal(result.ok ? '' : result.error.code, 'INVALID_TIMING');
      assert.strictEqual(result.state, before); assert.deepEqual(before, snapshot);
    }
  });

  it('plays once, retains the effect card, and does not mutate the source', () => {
    const before = game(); const snapshot = structuredClone(before); const instance = before.players.white.hand[0]!;
    const after = ok(play(before, instance.id));
    assert.deepEqual(before, snapshot); assert.equal(after.players.white.hand.length, 0);
    assert.equal(after.players.white.discard.length, 0);
    assert.equal(after.effects.length, 1); assert.deepEqual(after.effects[0], { type: CARD, owner: 'white', card: instance });
  });
});

describe('Vendetta forced legal captures', () => {
  it('forces the next player to capture an opponent piece, rejecting non-captures', () => {
    const activated = ok(endTurn(ok(play(game({ fen: '3rk3/8/3P4/8/8/8/8/4K3 w - - 0 1' })))));
    const result = move(activated, 'e8', 'f7');
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error.message, /capture|Vendetta/i);
  });

  it('allows a legal opponent capture and keeps the effect alive for the next player', () => {
    const activated = ok(endTurn(ok(play(game({ fen: '3rk3/8/3P4/8/8/8/8/4K3 w - - 0 1' })))));
    const after = ok(move(activated, 'd8', 'd6'));
    assert.equal(pieceAt(after, 'd6')?.role, 'rook');
    assert.equal(pieceAt(after, 'd6')?.owner, 'black');
    assert.equal(after.pieces.some(piece => piece.owner === 'white' && piece.square === 'd6'), false);
    assert.equal(after.effects.length, 1);
  });

  it('expires and discards to the original effect owner when current player has no legal capture', () => {
    const activated = ok(endTurn(ok(play(game({ fen: '4k3/8/8/8/8/8/8/3R1K2 w - - 0 1' })))));
    const after = activated;
    assert.equal(after.effects.length, 0); assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
  });

  it('counts only legal captures and ignores a pinned pseudo-capture', () => {
    const activated = withVendetta(beforeMove({ fen: '4r1k1/8/8/8/3p4/8/4N3/4K3 w - - 0 1' }));
    assert.equal(legalDests(activated).get('e2')?.includes('d4') ?? false, false);
    const after = ok(move(activated, 'e1', 'f1'));
    assert.equal(after.effects.length, 0);
  });

  it('works for black and preserves the capture-only obligation', () => {
    const before = game({ turn: 'black', phase: 'afterMove', moveMade: true, hands: { white: [], black: [CARD] }, fen: '4k3/8/8/8/8/8/3p4/3RK3 b - - 0 1' });
    const activated = ok(endTurn(ok(play(before))));
    const result = move(activated, 'e1', 'f1');
    assert.equal(result.ok, false);
  });
});

describe('Vendetta boundaries and state integrity', () => {
  it('does not treat an actor-owned neutral victim as an opponent piece', () => {
    const state = patchPiece(withVendetta(beforeMove({ fen: '4k3/8/8/8/8/8/3p4/3RK3 w - - 0 1' })), 'd2', { neutral: true, owner: 'white' });
    const result = move(state, 'e1', 'f1');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.effects.length, 0);
  });

  it('rejects duplicate card use atomically', () => {
    const before = game(); const activated = ok(play(before));
    const again = play(activated);
    assert.equal(again.ok, false); assert.equal(again.ok ? '' : again.error.code, 'CARD_NOT_IN_HAND');
  });

  it('accepts immutable state inputs without mutating them', () => {
    const before = frozen(game()); const result = play(before);
    assert.equal(result.ok, true);
  });

  it('supports transformed pieces as ordinary legal movers and victims', () => {
    const activated = patchPiece(withVendetta(beforeMove({ fen: '4k3/8/8/8/8/3p4/8/3RK3 w - - 0 1' })), 'd1', { role: 'queen', originalRole: 'pawn', promoted: true });
    assert.equal(move(activated, 'd1', 'c1').ok, false);
    assert.equal(move(activated, 'd1', 'd3').ok, true);
  });
});
