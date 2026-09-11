import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'holy-war';
const target = (knight = 'b1', bishop = 'c1') => ({ knight, bishop });

function game(options: Options = {}): State {
  return createGameState({
    fen: '4k3/8/8/8/8/8/8/1NB1K3 w - - 7 20',
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

describe('Holy War contract and swap', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Holy War',
      points: 3,
      unique: false,
      image: '/KC3_card1.png',
      description: 'Swap the positions of one of your Knights and one of your Bishops.',
      timing: ['afterMove'],
      continuing: false,
    });
  });

  it('atomically swaps one White Knight and Bishop while preserving identities', () => {
    const before = game();
    const knight = pieceAt(before, 'b1');
    const bishop = pieceAt(before, 'c1');
    const selected = target();
    const after = ok(play(before, selected));

    assert.deepEqual(pieceAt(after, 'c1'), { ...knight, square: 'c1' });
    assert.deepEqual(pieceAt(after, 'b1'), { ...bishop, square: 'b1' });
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: CARD, target: selected,
      movement: [{ from: selected.knight, to: selected.bishop }, { from: selected.bishop, to: selected.knight }],
      preservePreviousMove: true,
    });
  });

  it('swaps Black pieces on Black’s turn', () => {
    const before = game({
      fen: '1nb1k3/8/8/8/8/8/8/4K3 b - - 9 31',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const knight = pieceAt(before, 'b8');
    const bishop = pieceAt(before, 'c8');
    const after = ok(play(before, target('b8', 'c8')));

    assert.deepEqual(pieceAt(after, 'c8'), { ...knight, square: 'c8' });
    assert.deepEqual(pieceAt(after, 'b8'), { ...bishop, square: 'b8' });
    assert.equal(after.turn.color, 'black');
  });

  it('uses original identities and carries transformations and markers with each piece', () => {
    const seeded = game();
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => {
        if (piece.square === 'b1') return { ...piece, role: 'pawn' as const, neutral: true };
        if (piece.square === 'c1') return { ...piece, role: 'queen' as const, royal: true };
        return piece;
      }),
    };
    const knight = pieceAt(before, 'b1');
    const bishop = pieceAt(before, 'c1');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'c1'), { ...knight, square: 'c1' });
    assert.deepEqual(pieceAt(after, 'b1'), { ...bishop, square: 'b1' });
  });

  it('lets the acting player select opponent-owned neutral original pieces', () => {
    const seeded = game({ fen: '4k3/8/n6b/8/8/8/8/4K3 w - - 0 1' });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => ['a6', 'h6'].includes(piece.square ?? '')
        ? { ...piece, neutral: true }
        : piece),
    };
    const knight = pieceAt(before, 'a6');
    const bishop = pieceAt(before, 'h6');
    const after = ok(play(before, target('a6', 'h6')));

    assert.deepEqual(pieceAt(after, 'h6'), { ...knight, square: 'h6' });
    assert.deepEqual(pieceAt(after, 'a6'), { ...bishop, square: 'a6' });
  });

  it('accepts promoted Pawns and transformations currently named Knight and Bishop', () => {
    const seeded = game();
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => ['b1', 'c1'].includes(piece.square ?? '')
        ? { ...piece, originalRole: 'pawn' as const, promoted: true }
        : piece),
    };
    const after = ok(play(before));
    assert.equal(pieceAt(after, 'c1')?.role, 'knight');
    assert.equal(pieceAt(after, 'b1')?.role, 'bishop');
  });

  it('rejects a selection with neither the current nor original named role', () => {
    const before = updatePiece(game(), 'c1', { originalRole: 'rook', role: 'queen' });
    rejected(before, target(), 'WRONG_ROLE');
  });
});

describe('Holy War target validation', () => {
  it('requires a target object containing both selections', () => {
    const before = game();
    for (const selected of [undefined, null, [], 'b1-c1', {}, { knight: 'b1' }, { bishop: 'c1' }]) {
      rejected(before, selected, 'INVALID_TARGET');
    }
  });

  it('rejects non-string and non-canonical squares without coercion', () => {
    const before = game();
    for (const selected of [
      { knight: 1, bishop: 'c1' },
      { knight: 'b1', bishop: false },
      target('B1', 'c1'),
      target('b1', 'i1'),
    ]) rejected(before, selected, 'INVALID_TARGET');
  });

  it('requires two distinct squares', () => {
    rejected(game(), target('b1', 'b1'), 'INVALID_TARGET');
  });

  it('rejects an empty or off-board-zone selection', () => {
    rejected(game(), target('a1', 'c1'), 'INVALID_TARGET');

    const captured = updatePiece(game(), 'b1', { square: null, zone: 'captured' });
    rejected(captured, target(), 'INVALID_TARGET');

    const dead = updatePiece(game(), 'c1', { square: null, zone: 'dead' });
    rejected(dead, target(), 'INVALID_TARGET');
  });

  it('requires the Knight and Bishop in their named target fields', () => {
    rejected(game(), target('c1', 'b1'), 'WRONG_ROLE');
    rejected(game({ fen: '4k3/8/8/8/8/8/8/1NR1K3 w - - 0 1' }), target(), 'WRONG_ROLE');
  });

  it('rejects either opposing non-neutral piece', () => {
    rejected(
      game({ fen: '4k3/8/8/8/8/8/8/1nB1K3 w - - 0 1' }),
      target(),
      'WRONG_OWNER',
    );
    rejected(
      game({ fen: '4k3/8/8/8/8/8/8/1Nb1K3 w - - 0 1' }),
      target(),
      'WRONG_OWNER',
    );
  });
});

describe('Holy War timing and lifecycle', () => {
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
      fen: 'r3k2r/8/8/4p3/8/8/1NB5/R3K2R w KQkq e6 17 42',
    });
    const after = ok(play(before, target('b2', 'c2')));

    assert.equal(after.fen, 'r3k2r/8/8/4p3/8/8/1BN5/R3K2R w KQkq e6 17 42');
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.equal(after.turn.color, before.turn.color);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });
});

describe('Holy War King safety and checkmate rule', () => {
  it('allows a swap that gives non-mating check', () => {
    const before = game({ fen: '7k/6N1/8/8/8/B7/8/K7 w - - 0 1' });
    const after = ok(play(before, target('g7', 'a3')));

    assert.equal(positionFor(after, 'black').isCheck(), true);
    assert.equal(positionFor(after, 'black').isCheckmate(), false);
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
  });

  it('fizzles a swap that leaves a royal selected piece attacked', () => {
    const seeded = game({
      fen: '2r4k/8/8/8/8/2B5/8/1N2K3 w - - 11 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const before = updatePiece(seeded, 'b1', { royal: true });
    const used = before.players.white.hand[0]!;
    const after = ok(play(before, target('b1', 'c3')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: true,
    });
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('fizzles when a relocated neutral piece attacks the acting King', () => {
    const seeded = game({ fen: 'k7/7b/8/8/8/3N4/4K3/8 w - - 0 1' });
    const before = updatePiece(seeded, 'h7', { neutral: true });
    const after = ok(play(before, target('d3', 'h7')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: true,
    });
  });

  it('fizzles a directly created mate, restores both pieces, and prioritizes mate over self-check', () => {
    const seeded = game({
      fen: 'r6k/5KN1/5N2/8/8/B7/8/8 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const before = updatePiece(seeded, 'g7', { royal: true });
    const after = ok(play(before, target('g7', 'a3')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: true,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    // §§8.5/11.5: the restored extra royal remains checked, with move and card allowance spent.
    assert.deepEqual(after.outcome, { winner: 'black', reason: 'checkmate' });
  });

  it('does not blame Holy War for a checkmate already present before the swap', () => {
    const before = game({ fen: '7k/6Q1/5K2/8/8/8/8/N1B5 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), true);
    const after = ok(play(before, target('a1', 'c1')));

    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(positionFor(after, 'black').isCheckmate(), true);
  });
});

describe('Holy War immutability', () => {
  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, target('a1', 'c1'), 'INVALID_TARGET');
  });
});
