import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'anathema';
const target = (bishop = 'c7', rook = 'b7') => ({ bishop, rook });

function game(options: Options = {}): State {
  return createGameState({
    fen: '4k3/1rb5/8/8/8/8/8/4K3 w - - 7 20',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, ...args: [selected?: unknown, cardInstanceId?: unknown]): Result {
  const selected = args.length ? args[0] : target();
  const cardInstanceId = args[1];
  return applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    ...(cardInstanceId === undefined ? {} : { cardInstanceId }),
    target: selected,
  } as unknown as Action);
}

function ok(result: Result): State {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(before: State, selected: unknown, code: string, cardInstanceId?: unknown): void {
  const snapshot = structuredClone(before);
  const result = play(before, selected, cardInstanceId);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before, 'rejection must return the input state');
  assert.deepEqual(before, snapshot, 'rejection must be atomic');
}

function pieceAt(state: State, square: string) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function updatePiece(state: State, square: string, changes: Partial<State['pieces'][number]>): State {
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === square ? { ...piece, ...changes } : piece),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Anathema contract and swap', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Anathema',
      points: 5,
      unique: false,
      image: '/KC6_card4.png',
      description: 'Swap the positions of a Bishop and a Rook belonging to your opponent.',
      timing: ['afterMove'],
      continuing: false,
    });
  });

  it('atomically swaps the opponent’s Bishop and Rook while preserving identities', () => {
    const before = game();
    const bishop = pieceAt(before, 'c7');
    const rook = pieceAt(before, 'b7');
    const selected = target();
    const after = ok(play(before, selected));

    assert.deepEqual(pieceAt(after, 'b7'), { ...bishop, square: 'b7' });
    assert.deepEqual(pieceAt(after, 'c7'), { ...rook, square: 'c7' });
    assert.deepEqual(after.history.at(-1), { type: 'cardPlayed', cardId: CARD, target: selected });
  });

  it('swaps White pieces when Black is acting', () => {
    const before = game({
      fen: '4k3/8/8/8/8/8/1RB5/4K3 b - - 9 31',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const bishop = pieceAt(before, 'c2');
    const rook = pieceAt(before, 'b2');
    const after = ok(play(before, target('c2', 'b2')));

    assert.deepEqual(pieceAt(after, 'b2'), { ...bishop, square: 'b2' });
    assert.deepEqual(pieceAt(after, 'c2'), { ...rook, square: 'c2' });
    assert.equal(after.turn.color, 'black');
  });

  it('uses original identities and carries transformations and markers with each piece', () => {
    const seeded = game();
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => {
        if (piece.square === 'c7') return { ...piece, role: 'pawn' as const, neutral: true };
        if (piece.square === 'b7') return { ...piece, role: 'queen' as const, royal: true };
        return piece;
      }),
    };
    const bishop = pieceAt(before, 'c7');
    const rook = pieceAt(before, 'b7');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'b7'), { ...bishop, square: 'b7' });
    assert.deepEqual(pieceAt(after, 'c7'), { ...rook, square: 'c7' });
  });

  it('accepts promoted Pawns and transformations currently named Bishop and Rook', () => {
    const seeded = game();
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => ['b7', 'c7'].includes(piece.square ?? '')
        ? { ...piece, originalRole: 'pawn' as const, promoted: true }
        : piece),
    };
    const after = ok(play(before));

    assert.equal(pieceAt(after, 'b7')?.role, 'bishop');
    assert.equal(pieceAt(after, 'c7')?.role, 'rook');
  });

  it('lets either player treat acting-owned neutral pieces as opposing targets', () => {
    const seeded = game({ fen: '4k3/8/8/8/8/8/1RB5/4K3 w - - 0 1' });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => ['b2', 'c2'].includes(piece.square ?? '')
        ? { ...piece, neutral: true }
        : piece),
    };
    const after = ok(play(before, target('c2', 'b2')));

    assert.equal(pieceAt(after, 'b2')?.role, 'bishop');
    assert.equal(pieceAt(after, 'c2')?.role, 'rook');
  });

  it('rejects a selection with neither the current nor original named role', () => {
    const before = updatePiece(game(), 'c7', { originalRole: 'knight', role: 'queen' });
    rejected(before, target(), 'WRONG_ROLE');
  });
});

describe('Anathema target validation', () => {
  it('requires a target object containing both selections', () => {
    const before = game();
    for (const selected of [undefined, null, [], 'c7-b7', {}, { bishop: 'c7' }, { rook: 'b7' }]) {
      rejected(before, selected, 'INVALID_TARGET');
    }
  });

  it('rejects non-string and non-canonical squares without coercion', () => {
    const before = game();
    for (const selected of [
      { bishop: 1, rook: 'b7' },
      { bishop: 'c7', rook: false },
      target('C7', 'b7'),
      target('c7', 'i7'),
    ]) rejected(before, selected, 'INVALID_TARGET');
  });

  it('requires two distinct squares', () => {
    rejected(game(), target('c7', 'c7'), 'INVALID_TARGET');
  });

  it('rejects an empty or off-board-zone selection', () => {
    rejected(game(), target('a1', 'b7'), 'INVALID_TARGET');

    const captured = updatePiece(game(), 'c7', { square: null, zone: 'captured' });
    rejected(captured, target(), 'INVALID_TARGET');

    const dead = updatePiece(game(), 'b7', { square: null, zone: 'dead' });
    rejected(dead, target(), 'INVALID_TARGET');
  });

  it('requires the Bishop and Rook in their named target fields', () => {
    rejected(game(), target('b7', 'c7'), 'WRONG_ROLE');
    rejected(game({ fen: '4k3/1rn5/8/8/8/8/8/4K3 w - - 0 1' }), target(), 'WRONG_ROLE');
  });

  it('rejects either acting-owned non-neutral piece', () => {
    rejected(
      game({ fen: '4k3/1rB5/8/8/8/8/8/4K3 w - - 0 1' }),
      target(),
      'WRONG_OWNER',
    );
    rejected(
      game({ fen: '4k3/1Rb5/8/8/8/8/8/4K3 w - - 0 1' }),
      target(),
      'WRONG_OWNER',
    );
  });
});

describe('Anathema timing and lifecycle', () => {
  it('is legal only after the regular move', () => {
    for (const [phase, moveMade] of [
      ['beforeMove', false],
      ['beforeMove', true],
      ['afterMove', false],
    ] as const) {
      rejected(game({ phase, moveMade }), target(), 'INVALID_TIMING');
    }
    assert.equal(play(game()).ok, true);
  });

  it('rejects a spent card allowance and a finished game', () => {
    rejected(game({ cardPlays: { white: 1 } }), target(), 'CARD_ALREADY_PLAYED');
    const active = game();
    const finished = { ...active, outcome: { winner: 'black', reason: 'checkmate' } } as State;
    rejected(finished, target(), 'GAME_OVER');
  });

  it('requires the card in the acting player’s hand', () => {
    rejected(game({ hands: { white: [], black: [] } }), target(), 'CARD_NOT_IN_HAND');
    rejected(
      game({ hands: { white: [], black: [CARD] }, decks: { white: [CARD], black: [] } }),
      target(),
      'CARD_NOT_IN_HAND',
    );
  });

  it('spends the exact selected duplicate, draws once, and preserves turn progress', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    });
    const selected = before.players.white.hand[2]!;
    const retained = before.players.white.hand[0]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, target(), selected.id));

    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === retained.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });
  });

  it('atomically rejects missing, mismatched, and malformed exact instances', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [] } });
    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, target(), 'CARD_NOT_IN_HAND', cardInstanceId);
    }
  });

  it('preserves FEN turn, castling, en-passant, and clocks while changing only the board', () => {
    const before = game({
      fen: 'r3k2r/8/8/4p3/8/8/1rb5/R3K2R w KQkq e6 17 42',
    });
    const after = ok(play(before, target('c2', 'b2')));

    assert.equal(after.fen, 'r3k2r/8/8/4p3/8/8/1br5/R3K2R w KQkq e6 17 42');
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.equal(after.turn.color, before.turn.color);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });
});

describe('Anathema King safety and checkmate rule', () => {
  it('fizzles a swap that leaves the acting King in check', () => {
    const before = game({
      fen: '7k/8/8/8/8/r3b3/8/4K3 w - - 11 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const used = before.players.white.hand[0]!;
    const after = ok(play(before, target('e3', 'a3')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK' });
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('fizzles a newly created direct mate, restores both pieces, and prioritizes mate', () => {
    const before = game({
      fen: '8/8/8/8/8/8/1r6/kQKb4 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const after = ok(play(before, target('d1', 'b2')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE' });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.outcome, null);
  });

  it('does not blame Anathema for a checkmate already present before the swap', () => {
    const before = game({ fen: '7k/6Q1/5K2/8/rb6/8/8/8 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), true);
    const after = ok(play(before, target('b4', 'a4')));

    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(positionFor(after, 'black').isCheckmate(), true);
  });
});

describe('Anathema immutability', () => {
  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, target('a1', 'b7'), 'INVALID_TARGET');
  });
});
