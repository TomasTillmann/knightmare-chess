import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Advance = { from: string; to: string };

const ANNEXATION = 'annexation';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';
const FORCED_MARCH = 'forced-march';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [ANNEXATION], black: [ANNEXATION] },
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
  if (result.ok) assert.fail(`expected ${code}`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state, 'rejection must return the exact input state');
  assert.deepEqual(state, snapshot, 'rejection must not mutate its input');
}

const annex = (state: State, target: Advance[], cardInstanceId?: string) =>
  applied(state, {
    type: 'playCard',
    cardId: ANNEXATION,
    target,
    ...(cardInstanceId ? { cardInstanceId } : {}),
  } as Action);
const fanatic = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: FANATIC, target } as Action);
const disintegrate = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: DISINTEGRATION, target } as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('one Annexation advance is the complete move for the turn', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1' });
  const pawnId = pieceAt(before, 'a2')?.id;
  const target = [{ from: 'a2', to: 'a4' }];
  const state = annex(before, target);

  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(pieceAt(state, 'a4')?.id, pawnId);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: ANNEXATION, target, movement: target, preservePreviousMove: false,
  }]);
});

test('two Annexation advances resolve together and retain both en-passant rights', () => {
  const before = game({ fen: '7k/8/8/8/1p1p4/8/P1P5/K7 w - - 0 1' });
  const aPawn = pieceAt(before, 'a2')?.id;
  const cPawn = pieceAt(before, 'c2')?.id;
  const state = annex(before, [
    { from: 'a2', to: 'a4' },
    { from: 'c2', to: 'c4' },
  ]);

  assert.equal(pieceAt(state, 'a4')?.id, aPawn);
  assert.equal(pieceAt(state, 'c4')?.id, cPawn);
  assert.deepEqual(
    state.enPassant.map(right => ({ target: right.target, pawnId: right.pawnId })).sort((a, b) => a.target.localeCompare(b.target)),
    [
      { target: 'a3', pawnId: aPawn },
      { target: 'c3', pawnId: cPawn },
    ],
  );
  assert.equal(state.fen.split(' ')[3], '-', 'multiple rights live in GameState, not the single FEN slot');
});

test('Annexation atomically rejects a move onto another selected Pawn\'s en-passant target', () => {
  const seeded = game({ fen: '7k/8/8/4p3/3p4/8/4P3/K7 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'e5' ? { ...piece, neutral: true } : piece),
  };

  rejected(
    before,
    {
      type: 'playCard',
      cardId: ANNEXATION,
      target: [{ from: 'e2', to: 'e4' }, { from: 'e5', to: 'e3' }],
    } as Action,
    'ILLEGAL_MOVE',
  );

  assert.equal(pieceAt(before, 'e2')?.id, 'white-pawn-e2');
  assert.equal(pieceAt(before, 'e5')?.id, 'black-pawn-e5');
  assert.equal(pieceAt(before, 'e3'), undefined);
  assert.equal(pieceAt(before, 'e4'), undefined);
  assert.deepEqual(before.enPassant, []);
  assert.equal(before.turn.phase, 'beforeMove');
  assert.equal(before.turn.cardPlays.white, 0);
  assert.equal(before.players.white.hand.some(card => card.cardId === ANNEXATION), true);
});

test('Annexation replaces the regular move and then hands play to the opponent', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1' });
  const advanced = annex(before, [{ from: 'a2', to: 'a4' }]);
  rejected(advanced, { type: 'move', from: 'a1', to: 'b1' } as Action, 'ILLEGAL_MOVE');

  const blackTurn = endTurn(advanced);
  assert.equal(blackTurn.turn.color, 'black');
  assert.deepEqual(blackTurn.turn.cardPlays, { white: 0, black: 0 });
  assert.equal(pieceAt(move(blackTurn, 'h8', 'h7'), 'h7')?.role, 'king');
});

test('orientation applies to both colors across consecutive Annexation turns', () => {
  let state: State = {
    ...game({ fen: '7k/8/5p2/8/8/2P5/8/K7 w - - 0 1' }),
    orientation: 90 as const,
  };
  state = endTurn(annex(state, [{ from: 'c3', to: 'e3' }]));
  state = annex(state, [{ from: 'f6', to: 'd6' }]);

  assert.equal(pieceAt(state, 'e3')?.owner, 'white');
  assert.equal(pieceAt(state, 'd6')?.owner, 'black');
  assert.equal(state.orientation, 90);
});

test('one blocked path rejects a two-Pawn Annexation atomically', () => {
  const before = game({ fen: '7k/8/8/8/8/N7/P1P5/K7 w - - 0 1' });
  rejected(
    before,
    {
      type: 'playCard',
      cardId: ANNEXATION,
      target: [{ from: 'a2', to: 'a4' }, { from: 'c2', to: 'c4' }],
    } as Action,
    'ILLEGAL_MOVE',
  );
});

test('one occupied destination rejects a two-Pawn Annexation atomically', () => {
  const before = game({ fen: '7k/8/8/8/N7/8/P1P5/K7 w - - 0 1' });
  rejected(
    before,
    {
      type: 'playCard',
      cardId: ANNEXATION,
      target: [{ from: 'a2', to: 'a4' }, { from: 'c2', to: 'c4' }],
    } as Action,
    'ILLEGAL_MOVE',
  );
});

test('Annexation preserves ordinary and neutral transformed Pawn identities', () => {
  const seeded = game({ fen: '7k/8/2p5/8/8/8/P7/K7 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece =>
      piece.square === 'c6' ? { ...piece, role: 'rook' as const, neutral: true } : piece,
    ),
  };
  const state = annex(before, [
    { from: 'a2', to: 'a4' },
    { from: 'c6', to: 'c4' },
  ]);

  assert.equal(pieceAt(state, 'a4')?.id, 'white-pawn-a2');
  assert.deepEqual(
    (({ id, owner, role, originalRole, promoted, neutral }) => ({ id, owner, role, originalRole, promoted, neutral }))(
      pieceAt(state, 'c4')!,
    ),
    {
      id: 'black-pawn-c6',
      owner: 'black',
      role: 'rook',
      originalRole: 'pawn',
      promoted: false,
      neutral: true,
    },
  );
});

test('Annexation can replace the move to block an existing check', () => {
  const before = game({
    fen: '7k/8/7b/8/8/8/8/2K1P3 w - - 0 1',
    hands: { white: [ANNEXATION], black: [] },
  });
  assert.equal(positionFor(before).isCheck(), true);

  const state = annex(before, [{ from: 'e1', to: 'e3' }]);
  assert.equal(pieceAt(state, 'e3')?.owner, 'white');
  assert.equal(positionFor(state, 'white').isCheck(), false);
});

// Derived from FAQ p. 7: Annexation does not explicitly exempt first-rank advances.
test('a first-rank Annexation advance grants en passant', () => {
  const before = game({ fen: '7k/8/8/8/8/3p4/8/K3P3 w - - 0 1' });
  const advanced = annex(before, [{ from: 'e1', to: 'e3' }]);

  const pawnId = pieceAt(before, 'e1')!.id;
  assert.deepEqual(advanced.enPassant, [{ target: 'e2', pawnId }]);
  assert.equal(advanced.fen.split(' ')[3], 'e2');
  const reply = endTurn(advanced);
  assert.equal(legalDests(reply).get('d3')?.includes('e2'), true);
  const captured = move(reply, 'd3', 'e2');
  assert.equal(captured.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
  assert.equal(pieceAt(captured, 'e3'), undefined);
});

test('an unrelated Annexation fizzles in check and leaves the regular move available', () => {
  const before = game({
    fen: '7k/8/7b/8/8/8/P7/2K5 w - - 0 1',
    hands: { white: [ANNEXATION], black: [] },
  });
  const state = annex(before, [{ from: 'a2', to: 'a4' }]);

  assert.equal(pieceAt(state, 'a2')?.role, 'pawn');
  assert.equal(pieceAt(state, 'a4'), undefined);
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: ANNEXATION, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(pieceAt(move(state, 'c1', 'b1'), 'b1')?.role, 'king');
});

test('a self-uncovering Annexation fizzles and consumes the replacement move', () => {
  const before = game({
    fen: '7b/7k/8/8/8/2P5/8/K7 w - - 0 1',
    hands: { white: [ANNEXATION], black: [] },
  });
  assert.equal(positionFor(before).isCheck(), false);
  const state = annex(before, [{ from: 'c3', to: 'c5' }]);

  assert.equal(pieceAt(state, 'c3')?.role, 'pawn');
  assert.equal(pieceAt(state, 'c5'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: ANNEXATION, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(endTurn(state).turn.color, 'black');
});

test('an Annexation that directly creates checkmate fizzles in full', () => {
  const before = game({
    fen: '7k/8/6Q1/8/3P4/8/8/B3K3 w - - 0 1',
    hands: { white: [ANNEXATION], black: [] },
  });
  const state = annex(before, [{ from: 'd4', to: 'd6' }]);

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: ANNEXATION, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.white.discard.at(-1)?.cardId, ANNEXATION);
});

test('Annexation shares the one-card allowance with the implemented mixed hand', () => {
  const options: Options = {
    fen: '7k/8/8/8/8/8/P1P5/K7 w - - 0 1',
    hands: { white: [DISINTEGRATION, ANNEXATION, FANATIC, FORCED_MARCH], black: [] },
  };
  const afterDisintegration = disintegrate(game(options), 'c2');
  rejected(
    afterDisintegration,
    { type: 'playCard', cardId: ANNEXATION, target: [{ from: 'a2', to: 'a4' }] } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const afterAnnexation = annex(game(options), [{ from: 'a2', to: 'a4' }]);
  rejected(afterAnnexation, { type: 'playCard', cardId: FANATIC, target: 'c2' } as Action, 'CARD_ALREADY_PLAYED');
});

test('Annexation discards the exact selected duplicate and draws once', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1',
    hands: { white: [ANNEXATION, DISINTEGRATION, ANNEXATION], black: [] },
    decks: { white: [FANATIC], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = annex(before, [{ from: 'a2', to: 'a4' }], selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [ANNEXATION, DISINTEGRATION, FANATIC]);
  assert.equal(state.players.white.deck.length, 0);
});

test('a mixed four-card Annexation replay is deterministic', () => {
  const replay = () => {
    let state = game({
      fen: '7k/p1p1p3/8/8/8/8/P1P1P3/K7 w - - 0 1',
      hands: {
        white: [ANNEXATION, DISINTEGRATION],
        black: [FANATIC, ANNEXATION],
      },
    });
    state = endTurn(annex(state, [{ from: 'a2', to: 'a4' }, { from: 'c2', to: 'c4' }]));
    state = endTurn(fanatic(state, 'e7'));
    state = endTurn(move(disintegrate(state, 'e2'), 'a1', 'a2'));
    return annex(state, [{ from: 'a7', to: 'a5' }, { from: 'c7', to: 'c5' }]);
  };

  const state = replay();
  assert.deepEqual(state, replay());
  assert.equal(state.fen.split(' ')[0], '7k/8/8/p1p5/P1P1p3/8/K7/8');
  assert.deepEqual(state.history, [
    {
      type: 'cardPlayed',
      cardId: ANNEXATION,
      target: [{ from: 'a2', to: 'a4' }, { from: 'c2', to: 'c4' }],
      movement: [{ from: 'a2', to: 'a4' }, { from: 'c2', to: 'c4' }],
      preservePreviousMove: false,
    },
    {
      type: 'cardPlayed', cardId: FANATIC, target: 'e7',
      movement: [{ from: 'e7', to: 'e4' }], preservePreviousMove: false,
    },
    {
      type: 'cardPlayed', cardId: DISINTEGRATION, target: 'e2',
      movement: [], preservePreviousMove: false,
    },
    { type: 'move', from: 'a1', to: 'a2' },
    {
      type: 'cardPlayed',
      cardId: ANNEXATION,
      target: [{ from: 'a7', to: 'a5' }, { from: 'c7', to: 'c5' }],
      movement: [{ from: 'a7', to: 'a5' }, { from: 'c7', to: 'c5' }],
      preservePreviousMove: false,
    },
  ]);
});

test('apparent orthodox mate waits for an Annexation escape in a mixed hand', () => {
  let state = game({
    fen: 'R7/7k/4p3/6Q1/8/3P4/8/KB6 w - - 0 1',
    hands: { white: [], black: [DISINTEGRATION, FANATIC, FORCED_MARCH, ANNEXATION] },
  });
  state = endTurn(move(state, 'd3', 'd4'));

  assert.equal(state.turn.color, 'black');
  assert.equal(positionFor(state).isCheckmate(), true);
  assert.equal(state.outcome, null);

  state = annex(state, [{ from: 'e6', to: 'e4' }]);
  assert.equal(pieceAt(state, 'e4')?.owner, 'black');
  assert.equal(positionFor(state, 'black').isCheck(), false);
});

test('a starting-square Annexation advance can be captured en passant on the reply', () => {
  let state = game({
    fen: '7k/8/8/8/p7/8/1P6/K7 w - - 0 1',
    hands: { white: [ANNEXATION], black: [] },
  });
  const pawnId = pieceAt(state, 'b2')?.id;
  state = annex(state, [{ from: 'b2', to: 'b4' }]);

  assert.deepEqual(state.enPassant, [{ target: 'b3', pawnId }]);
  assert.equal(state.fen.split(' ')[3], 'b3');

  state = endTurn(state);
  state = move(state, 'a4', 'b3');
  assert.equal(pieceAt(state, 'b3')?.id, 'black-pawn-a4');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
  assert.deepEqual(state.enPassant, []);
});

test('an en-passant reply prevents Annexation from being treated as direct mate', () => {
  const state = game({
    fen: '8/6B1/8/5K1k/7p/8/6P1/8 w - - 0 1',
    hands: { white: ['annexation'], black: [] },
  });
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'annexation',
    target: [{ from: 'g2', to: 'g4' }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  const reply = applied(result.state, { type: 'endTurn' });
  assert.deepEqual(legalDests(reply).get('h4'), ['g3']);
});

test('an unclaimed Annexation en-passant right expires on the reply move', () => {
  let state = game({
    fen: '7k/8/8/8/p7/8/1P6/K7 w - - 0 1',
    hands: { white: [ANNEXATION], black: [] },
  });
  state = endTurn(annex(state, [{ from: 'b2', to: 'b4' }]));
  assert.equal(state.enPassant.length, 1);

  state = move(state, 'h8', 'h7');
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen.split(' ')[3], '-');
});
