import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const FANATIC = 'fanatic';
const DISINTEGRATION = 'disintegration';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [FANATIC], black: [FANATIC] },
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

const fanatic = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: FANATIC, target } as Action);
const disintegrate = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: DISINTEGRATION, target } as Action);
const move = (state: State, from: string, to: string, promotion?: string) =>
  applied(state, { type: 'move', from, to, ...(promotion ? { promotion } : {}) } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const finishMove = (state: State, from: string, to: string, promotion?: string) =>
  endTurn(move(state, from, to, promotion));
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
const piecesIn = (state: State, zone: 'board' | 'captured' | 'dead' | 'away') =>
  state.pieces.filter(piece => piece.zone === zone);

test('Fanatic is the move for the turn rather than a setup for a regular move', () => {
  const before = game();
  const pawnId = pieceAt(before, 'a2')?.id;
  const state = fanatic(before, 'a2');
  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(pieceAt(state, 'a5')?.id, pawnId);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
});

test('a successful Fanatic move can end the turn immediately', () => {
  const state = endTurn(fanatic(game(), 'a2'));
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});

test('Fanatic leaves no regular chess destinations in the same turn', () => {
  assert.equal(legalDests(fanatic(game(), 'a2')).size, 0);
});

test('a regular move cannot follow Fanatic in the same turn', () => {
  const state = fanatic(game(), 'a2');
  rejected(state, { type: 'move', from: 'e2', to: 'e4' } as Action, 'ILLEGAL_MOVE');
});

test('Fanatic cannot follow a regular move because it replaces that move', () => {
  const state = move(game(), 'e2', 'e4');
  rejected(state, { type: 'playCard', cardId: FANATIC, target: 'a2' } as Action, 'INVALID_TIMING');
});

test('Disintegration before Fanatic consumes the shared own-turn card allowance', () => {
  const state = disintegrate(game({ hands: { white: [DISINTEGRATION, FANATIC], black: [] } }), 'a2');
  rejected(state, { type: 'playCard', cardId: FANATIC, target: 'b2' } as Action, 'CARD_ALREADY_PLAYED');
  assert.equal(pieceAt(state, 'b2')?.role, 'pawn');
});

test('Disintegration cannot follow Fanatic in the same turn', () => {
  const state = fanatic(game({ hands: { white: [FANATIC, DISINTEGRATION], black: [] } }), 'a2');
  rejected(state, { type: 'playCard', cardId: DISINTEGRATION, target: 'b2' } as Action, 'CARD_ALREADY_PLAYED');
  assert.equal(pieceAt(state, 'b2')?.role, 'pawn');
});

test('a Disintegration drawn by Fanatic is unavailable until a later turn', () => {
  const state = fanatic(game({ hands: { white: [FANATIC], black: [] }, decks: { white: [DISINTEGRATION], black: [] } }), 'a2');
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [DISINTEGRATION]);
  rejected(state, { type: 'playCard', cardId: DISINTEGRATION, target: 'b2' } as Action, 'CARD_ALREADY_PLAYED');
});

test('a Fanatic drawn by Disintegration is unavailable in the same turn', () => {
  const state = disintegrate(game({ hands: { white: [DISINTEGRATION], black: [] }, decks: { white: [FANATIC], black: [] } }), 'a2');
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [FANATIC]);
  rejected(state, { type: 'playCard', cardId: FANATIC, target: 'b2' } as Action, 'CARD_ALREADY_PLAYED');
});

test('ending a Fanatic turn refreshes both card counters for the next player', () => {
  const state = endTurn(fanatic(game(), 'a2'));
  assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
});

test('the opponent may play Fanatic on the immediately following turn', () => {
  let state = endTurn(fanatic(game(), 'a2'));
  state = fanatic(state, 'b7');
  assert.equal(pieceAt(state, 'b4')?.owner, 'black');
  assert.equal(state.turn.cardPlays.black, 1);
});

test('the opponent may use Disintegration and then make a regular move', () => {
  let state = game({ hands: { white: [FANATIC], black: [DISINTEGRATION] } });
  state = endTurn(fanatic(state, 'a2'));
  state = disintegrate(state, 'a7');
  state = move(state, 'e7', 'e5');
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(piecesIn(state, 'dead').some(piece => piece.owner === 'black'), true);
});

test('the opponent may make an ordinary move after Fanatic ends', () => {
  let state = endTurn(fanatic(game(), 'a2'));
  state = move(state, 'e7', 'e5');
  assert.equal(pieceAt(state, 'e5')?.owner, 'black');
});

test('the same player may use another Fanatic on a later turn', () => {
  let state = game({ hands: { white: [FANATIC, FANATIC], black: [] } });
  state = endTurn(fanatic(state, 'a2'));
  state = finishMove(state, 'e7', 'e5');
  state = fanatic(state, 'b2');
  assert.equal(pieceAt(state, 'a5')?.owner, 'white');
  assert.equal(pieceAt(state, 'b5')?.owner, 'white');
});

test('Fanatic may be used on a later turn after Disintegration', () => {
  let state = game({ hands: { white: [DISINTEGRATION, FANATIC], black: [] } });
  state = endTurn(move(disintegrate(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  state = fanatic(state, 'b2');
  assert.equal(pieceAt(state, 'b5')?.owner, 'white');
  assert.equal(piecesIn(state, 'dead').some(piece => piece.owner === 'white'), true);
});

test('Fanatic records one card event and no separate regular-move event', () => {
  const state = fanatic(game(), 'a2');
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: FANATIC, target: 'a2',
    movement: [{ from: 'a2', to: 'a5' }], preservePreviousMove: false,
  }]);
  assert.equal(state.fen.split(' ')[0], 'rnbqkbnr/pppppppp/8/P7/8/8/1PPPPPPP/RNBQKBNR');
});

test('Fanatic discards its exact instance and draws the top deck instance', () => {
  const before = game({
    hands: { white: [DISINTEGRATION, FANATIC], black: [] },
    decks: { white: [DISINTEGRATION, FANATIC], black: [] },
  });
  const used = before.players.white.hand[1];
  const drawn = before.players.white.deck[0];
  const state = fanatic(before, 'a2');
  assert.equal(state.players.white.discard.at(-1)?.id, used?.id);
  assert.equal(state.players.white.hand.at(-1)?.id, drawn?.id);
  assert.equal(state.players.white.deck.length, 1);
});

test('a White Fanatic move leaves every Black card zone untouched', () => {
  const before = game({
    hands: { white: [FANATIC], black: [FANATIC, DISINTEGRATION] },
    decks: { white: [], black: [DISINTEGRATION] },
  });
  const black = structuredClone(before.players.black);
  assert.deepEqual(fanatic(before, 'a2').players.black, black);
});

test('having Fanatic only in the deck does not make it playable', () => {
  const state = game({ hands: { white: [DISINTEGRATION], black: [] }, decks: { white: [FANATIC], black: [] } });
  rejected(state, { type: 'playCard', cardId: FANATIC, target: 'a2' } as Action, 'CARD_NOT_IN_HAND');
});

test('a Pawn advanced by Fanatic can be made dead by Disintegration on a later turn', () => {
  let state = game({ hands: { white: [FANATIC, DISINTEGRATION], black: [] } });
  const pawnId = pieceAt(state, 'a2')?.id;
  state = endTurn(fanatic(state, 'a2'));
  state = finishMove(state, 'e7', 'e5');
  state = disintegrate(state, 'a5');
  const pawn = state.pieces.find(piece => piece.id === pawnId);
  assert.equal(pawn?.zone, 'dead');
  assert.equal(pawn?.square, null);
  assert.equal(piecesIn(state, 'captured').some(piece => piece.id === pawnId), false);
});

test('the opponent cannot Disintegrate the Pawn advanced by Fanatic', () => {
  let state = game({ hands: { white: [FANATIC], black: [DISINTEGRATION] } });
  state = endTurn(fanatic(state, 'a2'));
  rejected(state, { type: 'playCard', cardId: DISINTEGRATION, target: 'a5' } as Action, 'WRONG_OWNER');
  assert.equal(pieceAt(state, 'a5')?.owner, 'white');
});

test('a Pawn killed by Disintegration stays dead through a later Fanatic move', () => {
  let state = game({ hands: { white: [DISINTEGRATION, FANATIC], black: [] } });
  const deadId = pieceAt(state, 'a2')?.id;
  state = endTurn(move(disintegrate(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  state = fanatic(state, 'b2');
  assert.deepEqual(state.pieces.find(piece => piece.id === deadId), {
    ...game({ hands: { white: [DISINTEGRATION, FANATIC], black: [] } }).pieces.find(piece => piece.id === deadId),
    square: null,
    zone: 'dead',
  });
});

test('a previously captured Pawn stays captured through an opponent Fanatic move', () => {
  let state = game({
    fen: '7k/pp6/8/8/8/8/8/R6K w - - 0 1',
    hands: { white: [], black: [FANATIC] },
  });
  const capturedId = pieceAt(state, 'a7')?.id;
  state = endTurn(move(state, 'a1', 'a7'));
  state = fanatic(state, 'b7');
  const captured = state.pieces.find(piece => piece.id === capturedId);
  assert.equal(captured?.zone, 'captured');
  assert.equal(captured?.square, null);
  assert.equal(pieceAt(state, 'b4')?.owner, 'black');
});

test('a Pawn moved by Fanatic enters captured, not dead, when normally captured later', () => {
  let state = game({
    fen: '7k/8/3p4/8/8/8/4P3/7K w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  const pawnId = pieceAt(state, 'e2')?.id;
  state = endTurn(fanatic(state, 'e2'));
  state = move(state, 'd6', 'e5');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
  assert.equal(piecesIn(state, 'dead').some(piece => piece.id === pawnId), false);
});

test('a dead Pawn cannot be selected by Fanatic on a later turn', () => {
  let state = game({ hands: { white: [DISINTEGRATION, FANATIC], black: [] } });
  state = endTurn(move(disintegrate(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  rejected(state, { type: 'playCard', cardId: FANATIC, target: 'a2' } as Action, 'INVALID_TARGET');
  assert.equal(piecesIn(state, 'dead').some(piece => piece.owner === 'white'), true);
});

test('a captured Pawn cannot be selected by Fanatic', () => {
  let state = game({
    fen: '7k/3p4/8/4P3/8/8/8/K7 b - - 0 1',
    hands: { white: [], black: [FANATIC] },
  });
  state = finishMove(state, 'd7', 'd5');
  state = finishMove(state, 'e5', 'd6');
  rejected(state, { type: 'playCard', cardId: FANATIC, target: 'd5' } as Action, 'INVALID_TARGET');
  assert.equal(piecesIn(state, 'captured').some(piece => piece.owner === 'black'), true);
});

test('Fanatic clears an existing en-passant opportunity because it is the move', () => {
  const state = fanatic(game({
    fen: '7k/8/8/3pP3/8/8/P7/K7 w - d6 0 2',
    hands: { white: [FANATIC], black: [] },
  }), 'a2');
  assert.equal(state.fen.split(' ')[3], '-');
});

test('the stale en-passant capture does not reappear on the next own turn', () => {
  let state = game({
    fen: '7k/8/8/3pP3/8/8/P7/K7 w - d6 0 2',
    hands: { white: [FANATIC], black: [] },
  });
  state = endTurn(fanatic(state, 'a2'));
  state = finishMove(state, 'h8', 'h7');
  assert.equal(legalDests(state).get('e5')?.includes('d6'), false);
});

test('a White Pawn moved three squares by Fanatic cannot be captured en passant', () => {
  let state = game({
    fen: '7k/8/8/3p4/8/8/4P3/7K w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  const pawnId = pieceAt(state, 'e2')?.id;
  state = endTurn(fanatic(state, 'e2'));
  rejected(state, { type: 'move', from: 'd5', to: 'e4' } as Action, 'ILLEGAL_MOVE');
  assert.equal(pieceAt(state, 'e5')?.id, pawnId);
});

test('a Black Pawn moved three squares by Fanatic cannot be captured en passant', () => {
  let state = game({
    fen: '7k/4p3/8/8/3P4/8/8/7K b - - 0 1',
    hands: { white: [], black: [FANATIC] },
  });
  const pawnId = pieceAt(state, 'e7')?.id;
  state = endTurn(fanatic(state, 'e7'));
  rejected(state, { type: 'move', from: 'd4', to: 'e5' } as Action, 'ILLEGAL_MOVE');
  assert.equal(pieceAt(state, 'e4')?.id, pawnId);
});

test('a White Pawn reaching rank eight through Fanatic does not promote', () => {
  const before = game({ fen: '7k/8/8/4P3/8/8/8/K7 w - - 0 1', hands: { white: [FANATIC], black: [] } });
  const pawnId = pieceAt(before, 'e5')?.id;
  const state = fanatic(before, 'e5');
  const pawn = pieceAt(state, 'e8');
  assert.equal(pawn?.id, pawnId);
  assert.equal(pawn?.role, 'pawn');
  assert.equal(pawn?.originalRole, 'pawn');
  assert.equal(pawn?.promoted, false);
});

test('a Black Pawn reaching rank one through Fanatic does not promote', () => {
  const before = game({ fen: '7k/8/8/8/3p4/8/8/K7 b - - 0 1', hands: { white: [], black: [FANATIC] } });
  const pawnId = pieceAt(before, 'd4')?.id;
  const state = fanatic(before, 'd4');
  const pawn = pieceAt(state, 'd1');
  assert.equal(pawn?.id, pawnId);
  assert.equal(pawn?.role, 'pawn');
  assert.equal(pawn?.originalRole, 'pawn');
  assert.equal(pawn?.promoted, false);
});

test('a non-promoted last-rank Fanatic Pawn remains a Disintegration target', () => {
  let state = game({
    fen: '7k/8/8/4P3/8/8/8/K7 w - - 0 1',
    hands: { white: [FANATIC, DISINTEGRATION], black: [] },
  });
  const pawnId = pieceAt(state, 'e5')?.id;
  state = endTurn(fanatic(state, 'e5'));
  state = finishMove(state, 'h8', 'h7');
  state = disintegrate(state, 'e8');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'dead');
});

test('a Pawn may still promote normally on a later turn after a shorter Fanatic advance', () => {
  let state = game({
    fen: '7k/8/8/8/1P6/8/8/K7 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  const pawnId = pieceAt(state, 'b4')?.id;
  state = endTurn(fanatic(state, 'b4'));
  state = finishMove(state, 'h8', 'g8');
  state = move(state, 'b7', 'b8', 'queen');
  const pawn = pieceAt(state, 'b8');
  assert.equal(pawn?.id, pawnId);
  assert.equal(pawn?.role, 'queen');
  assert.equal(pawn?.promoted, true);
});

test('Fanatic may replace the move to block an existing check', () => {
  const before = game({
    fen: '7b/7k/8/8/8/8/4P3/K7 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  assert.equal(positionFor(before).isCheck(), true);
  const state = fanatic(before, 'e2');
  assert.equal(pieceAt(state, 'e5')?.owner, 'white');
  assert.equal(positionFor(state).isCheck(), false);
});

test('an unrelated Fanatic fizzles in check but leaves the regular move available', () => {
  const before = game({
    fen: '4r2k/8/8/8/8/8/P7/4K3 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
    decks: { white: [DISINTEGRATION], black: [] },
  });
  const state = fanatic(before, 'a2');
  assert.equal(pieceAt(state, 'a2')?.role, 'pawn');
  assert.equal(pieceAt(state, 'a5'), undefined);
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [DISINTEGRATION]);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: FANATIC, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.outcome, null);
  assert.equal(pieceAt(move(state, 'e1', 'd1'), 'd1')?.role, 'king');
});

test('a self-pinning Fanatic fizzles and consumes the replacement move', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/K2P3r/8 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  assert.equal(positionFor(before).isCheck(), false);
  const state = fanatic(before, 'd2');
  assert.equal(pieceAt(state, 'd2')?.role, 'pawn');
  assert.equal(pieceAt(state, 'd5'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.white.discard.at(-1)?.cardId, FANATIC);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: FANATIC, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a self-check-fizzled Fanatic turn prevents premature stalemate', () => {
  let state = game({
    fen: '8/7p/8/8/2b5/8/2k5/K3P2r b - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  state = finishMove(state, 'h7', 'h6');

  assert.equal(legalDests(state).size, 0, 'White has no ordinary chess move');
  assert.equal(state.outcome, null, 'the legal replacement-card turn prevents stalemate');

  state = fanatic(state, 'e1');
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: FANATIC, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.outcome, null);
});

test('a self-check fizzle adjudicates mate when the original check has no regular escape', () => {
  const before = game({
    fen: 'rnb1kbnr/pppp1ppp/8/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    hands: { white: [FANATIC], black: [] },
  });
  assert.equal(positionFor(before).isCheckmate(), true);
  const state = fanatic(before, 'a2');
  assert.equal(pieceAt(state, 'a2')?.role, 'pawn');
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: FANATIC, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.deepEqual(state.outcome, { winner: 'black', reason: 'checkmate' });
});

test('Fanatic may uncover check when the resulting position is not mate', () => {
  const state = fanatic(game({
    fen: 'K7/8/8/8/8/8/R2P3k/8 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  }), 'd2');
  const defender = positionFor(state, 'black');
  assert.equal(defender.isCheck(), true);
  assert.equal(defender.isCheckmate(), false);
  assert.equal(state.outcome, null);
});

test('a Fanatic-created check exposes legal replies when the defender turn begins', () => {
  let state = game({
    fen: 'K7/8/8/8/8/8/R2P3k/8 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  state = endTurn(fanatic(state, 'd2'));
  assert.equal(state.turn.color, 'black');
  assert.equal(positionFor(state).isCheck(), true);
  assert.ok((legalDests(state).get('h2')?.length ?? 0) > 0);
});

test('a Fanatic move that directly creates checkmate fizzles and restores the Pawn', () => {
  const before = game({
    fen: '7k/8/6Q1/8/3P4/8/8/B3K3 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  const state = fanatic(before, 'd4');
  assert.deepEqual(state.pieces, before.pieces);
  assert.equal(pieceAt(state, 'd4')?.role, 'pawn');
  assert.equal(pieceAt(state, 'd7'), undefined);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: FANATIC, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
  });
});

test('a mate-fizzled Fanatic still consumes both the card and the move', () => {
  const before = game({
    fen: '7k/8/6Q1/8/3P4/8/8/B3K3 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
    decks: { white: [DISINTEGRATION], black: [] },
  });
  const usedId = before.players.white.hand[0]?.id;
  const state = fanatic(before, 'd4');
  assert.equal(state.players.white.discard.at(-1)?.id, usedId);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [DISINTEGRATION]);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  rejected(state, { type: 'playCard', cardId: DISINTEGRATION, target: 'd4' } as Action, 'CARD_ALREADY_PLAYED');
});

test("the defender's cards do not make a direct-mate Fanatic effect legal", () => {
  const before = game({
    fen: '7k/8/6Q1/8/3P4/8/8/B3K3 w - - 0 1',
    hands: { white: [FANATIC], black: [FANATIC, DISINTEGRATION] },
  });
  const state = fanatic(before, 'd4');
  assert.equal(pieceAt(state, 'd4')?.role, 'pawn');
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.outcome, null);
});

test('a mate-fizzled Fanatic turn can end without ending the game', () => {
  let state = game({
    fen: '7k/p7/6Q1/8/3P4/8/8/B3K3 w - - 0 1',
    hands: { white: [FANATIC], black: [] },
  });
  state = endTurn(fanatic(state, 'd4'));
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.outcome, null);
});

const APPARENT_MATE_FEN = '8/4pN1k/8/6Q1/8/3P4/8/KB6 w - - 0 1';

test('apparent mate waits when the defender can escape with Fanatic', () => {
  let state = game({
    fen: APPARENT_MATE_FEN,
    hands: { white: [], black: [FANATIC] },
  });
  state = endTurn(move(state, 'd3', 'd4'));
  assert.equal(state.turn.color, 'black');
  assert.equal(state.outcome, null);
  assert.equal(positionFor(state).isCheckmate(), true);
  state = fanatic(state, 'e7');
  assert.equal(pieceAt(state, 'e4')?.owner, 'black');
  assert.equal(positionFor(state).isCheck(), false);
});

test('apparent-mate escape search continues past an unusable earlier card', () => {
  let state = game({
    fen: APPARENT_MATE_FEN,
    hands: { white: [], black: [DISINTEGRATION, FANATIC] },
  });
  state = endTurn(move(state, 'd3', 'd4'));
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), [DISINTEGRATION, FANATIC]);
  assert.equal(state.outcome, null);

  const unusable = disintegrate(state, 'e7');
  assert.deepEqual(unusable.outcome, { winner: 'white', reason: 'checkmate' });

  const escaped = fanatic(state, 'e7');
  assert.equal(pieceAt(escaped, 'e4')?.owner, 'black');
  assert.equal(positionFor(escaped).isCheck(), false);
});

test('Fanatic in the deck does not postpone apparent mate', () => {
  let state = game({
    fen: APPARENT_MATE_FEN,
    hands: { white: [], black: [] },
    decks: { white: [], black: [FANATIC] },
  });
  state = endTurn(move(state, 'd3', 'd4'));
  assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
});

test('an unusable Fanatic in hand does not postpone apparent mate', () => {
  let state = game({
    fen: '8/4pN1k/8/4N1Q1/8/3P4/8/KB6 w - - 0 1',
    hands: { white: [], black: [FANATIC] },
  });
  state = endTurn(move(state, 'd3', 'd4'));
  assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
});

test('a Fanatic apparent-mate escape is the whole defending move', () => {
  let state = game({
    fen: APPARENT_MATE_FEN,
    hands: { white: [], black: [FANATIC] },
  });
  state = endTurn(move(state, 'd3', 'd4'));
  state = fanatic(state, 'e7');
  assert.equal(legalDests(state).size, 0);
  state = endTurn(state);
  assert.equal(state.turn.color, 'white');
  assert.equal(state.outcome, null);
});

test('replaying a mixed Fanatic and Disintegration sequence is deterministic', () => {
  const replay = () => {
    let state = game({
      hands: {
        white: [FANATIC, DISINTEGRATION],
        black: [DISINTEGRATION, FANATIC],
      },
    });
    state = endTurn(fanatic(state, 'a2'));
    state = endTurn(move(disintegrate(state, 'a7'), 'e7', 'e5'));
    state = endTurn(move(disintegrate(state, 'b2'), 'g1', 'f3'));
    return fanatic(state, 'b7');
  };
  const state = replay();
  assert.deepEqual(state, replay());
  assert.equal(state.fen, 'rnbqkbnr/2pp1ppp/8/P3p3/1p6/5N2/2PPPPPP/RNBQKB1R w KQkq - 0 3');
  assert.deepEqual(state.turn, {
    color: 'black',
    phase: 'afterMove',
    moveMade: true,
    cardPlays: { white: 0, black: 1 },
  });
  assert.deepEqual(state.history, [
    {
      type: 'cardPlayed', cardId: FANATIC, target: 'a2',
      movement: [{ from: 'a2', to: 'a5' }], preservePreviousMove: false,
    },
    {
      type: 'cardPlayed', cardId: DISINTEGRATION, target: 'a7',
      movement: [], preservePreviousMove: false,
    },
    { type: 'move', from: 'e7', to: 'e5' },
    {
      type: 'cardPlayed', cardId: DISINTEGRATION, target: 'b2',
      movement: [], preservePreviousMove: false,
    },
    { type: 'move', from: 'g1', to: 'f3' },
    {
      type: 'cardPlayed', cardId: FANATIC, target: 'b7',
      movement: [{ from: 'b7', to: 'b4' }], preservePreviousMove: false,
    },
  ]);
  assert.deepEqual(state.players.white.hand, []);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), [FANATIC, DISINTEGRATION]);
  assert.deepEqual(state.players.black.hand, []);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), [DISINTEGRATION, FANATIC]);
  assert.deepEqual(
    piecesIn(state, 'dead').map(piece => ({ id: piece.id, square: piece.square })).sort((a, b) => a.id.localeCompare(b.id)),
    [
      { id: 'black-pawn-a7', square: null },
      { id: 'white-pawn-b2', square: null },
    ],
  );
  assert.equal(pieceAt(state, 'a5')?.id, 'white-pawn-a2');
  assert.equal(pieceAt(state, 'b4')?.id, 'black-pawn-b7');
  assert.equal(pieceAt(state, 'e5')?.id, 'black-pawn-e7');
  assert.equal(pieceAt(state, 'f3')?.id, 'white-knight-g1');
});

test('a successful Fanatic reduction never mutates its input state', () => {
  const before = game({ decks: { white: [DISINTEGRATION], black: [] } });
  const snapshot = structuredClone(before);
  const state = fanatic(before, 'a2');
  assert.deepEqual(before, snapshot);
  assert.notStrictEqual(state, before);
  assert.notStrictEqual(state.pieces, before.pieces);
  assert.notStrictEqual(state.players.white, before.players.white);
});
