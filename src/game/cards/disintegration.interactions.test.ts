import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'disintegration';
const CAPTURE_FEN = '7k/8/8/3n4/4P3/8/8/KR6 w - - 0 1';
const EN_PASSANT_FEN = '7k/3p4/8/4P3/8/8/P7/K7 b - - 0 1';
const PROMOTION_FEN = '8/P6k/8/8/8/8/1P6/7K w - - 0 1';
const CHECK_FEN = 'k7/8/8/8/P7/8/8/R6K w - - 0 1';
const CHECK_REPLY_FEN = 'k7/7p/8/8/P7/8/8/R6K w - - 0 1';
const MATE_FEN = 'kr6/2K5/8/8/P7/8/8/R7 w - - 0 1';
const PIN_FEN = '4r2k/8/8/8/8/8/P3P3/4K3 w - - 0 1';
const PIN_CAPTURE_FEN = '4r2k/8/8/8/8/3p4/P3P3/4K3 w - - 0 1';
const IN_CHECK_FEN = '4r2k/8/8/8/8/8/P7/4K3 w - - 0 1';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [CARD], black: [CARD] },
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
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail(`expected ${code}`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state, 'rejection must return the exact input state');
}

const play = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: CARD, target } as Action);
const move = (state: State, from: string, to: string, promotion?: string) =>
  applied(state, { type: 'move', from, to, ...(promotion ? { promotion } : {}) } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const finishMove = (state: State, from: string, to: string) => endTurn(move(state, from, to));
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
const piecesIn = (state: State, zone: 'board' | 'captured' | 'dead' | 'away', owner?: 'white' | 'black') =>
  state.pieces.filter(piece => piece.zone === zone && (!owner || piece.owner === owner));

test('before-move play leaves the regular move available', () => {
  const state = play(game(), 'a2');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.equal(state.turn.cardPlays.white, 1);
});

test('a normal move can follow a before-move play', () => {
  const state = move(play(game(), 'a2'), 'e2', 'e4');
  assert.equal(pieceAt(state, 'e4')?.role, 'pawn');
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
});

test('removing a2 frees the a1 rook immediately', () => {
  const state = move(play(game(), 'a2'), 'a1', 'a2');
  assert.equal(pieceAt(state, 'a2')?.role, 'rook');
  assert.equal(piecesIn(state, 'dead', 'white').length, 1);
});

test('removing e2 frees the f1 bishop diagonal immediately', () => {
  const state = move(play(game(), 'e2'), 'f1', 'b5');
  assert.equal(pieceAt(state, 'b5')?.role, 'bishop');
  assert.equal(pieceAt(state, 'e2'), undefined);
});

test('play is legal after an ordinary move', () => {
  const state = play(move(game(), 'e2', 'e4'), 'a2');
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(pieceAt(state, 'e4')?.role, 'pawn');
  assert.equal(pieceAt(state, 'a2'), undefined);
});

test('the pawn that just moved can be disintegrated', () => {
  const state = play(move(game(), 'e2', 'e4'), 'e4');
  assert.equal(pieceAt(state, 'e4'), undefined);
  assert.equal(piecesIn(state, 'dead', 'white').length, 1);
});

test('a capturing pawn becomes dead while its victim remains captured', () => {
  const state = play(move(game({ fen: CAPTURE_FEN }), 'e4', 'd5'), 'd5');
  assert.equal(pieceAt(state, 'd5'), undefined);
  assert.equal(piecesIn(state, 'dead', 'white').length, 1);
  assert.equal(piecesIn(state, 'captured', 'black').length, 1);
});

test('an en-passant capturer can be disintegrated after the capture', () => {
  let state = game({ fen: EN_PASSANT_FEN, hands: { white: [CARD], black: [] } });
  state = finishMove(state, 'd7', 'd5');
  state = play(move(state, 'e5', 'd6'), 'd6');
  assert.equal(pieceAt(state, 'd6'), undefined);
  assert.equal(pieceAt(state, 'd5'), undefined);
  assert.equal(piecesIn(state, 'dead', 'white').length, 1);
  assert.equal(piecesIn(state, 'captured', 'black').length, 1);
});

test('promotion composes with disintegrating another pawn', () => {
  const state = play(move(game({ fen: PROMOTION_FEN }), 'a7', 'a8', 'queen'), 'b2');
  assert.equal(pieceAt(state, 'a8')?.role, 'queen');
  assert.equal(pieceAt(state, 'b2'), undefined);
});

test('a promoted Pawn is no longer a Disintegration target', () => {
  const state = move(game({ fen: PROMOTION_FEN }), 'a7', 'a8', 'queen');
  rejected(state, { type: 'playCard', cardId: CARD, target: 'a8' } as Action, 'WRONG_ROLE');
});

test('a cardless normal turn leaves both players card zones unchanged', () => {
  const before = game({ decks: { white: [CARD], black: [CARD] } });
  const players = structuredClone(before.players);
  const state = finishMove(before, 'e2', 'e4');
  assert.deepEqual(state.players, players);
});

test('card-before-move order can complete a turn', () => {
  const state = endTurn(move(play(game(), 'a2'), 'e2', 'e4'));
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});

test('move-before-card order can complete a turn', () => {
  const state = endTurn(play(move(game(), 'e2', 'e4'), 'a2'));
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});

test('both players can play it on consecutive turns', () => {
  let state = game();
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  state = endTurn(play(move(state, 'e7', 'e5'), 'a7'));
  assert.equal(state.turn.color, 'white');
  assert.equal(piecesIn(state, 'dead', 'white').length, 1);
  assert.equal(piecesIn(state, 'dead', 'black').length, 1);
});

test('the next player receives a fresh card allowance', () => {
  let state = game();
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });
  state = play(state, 'a7');
  assert.equal(state.turn.cardPlays.black, 1);
});

test('the same player may use another copy on a later turn', () => {
  let state = game({ hands: { white: [CARD, CARD], black: [] } });
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  state = play(state, 'b2');
  assert.equal(piecesIn(state, 'dead', 'white').length, 2);
  assert.equal(state.turn.cardPlays.white, 1);
});

test('three copies accumulate three distinct dead pawns', () => {
  let state = game({ hands: { white: [CARD, CARD, CARD], black: [] } });
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  state = endTurn(move(play(state, 'b2'), 'g1', 'f3'));
  state = finishMove(state, 'b8', 'c6');
  state = play(state, 'c2');
  const dead = piecesIn(state, 'dead', 'white');
  assert.equal(dead.length, 3);
  assert.equal(new Set(dead.map(piece => piece.id)).size, 3);
});

test('a dead pawn stays dead through later ordinary turns', () => {
  let state = game({ hands: { white: [CARD], black: [] } });
  const pawnId = pieceAt(state, 'a2')?.id;
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  state = finishMove(state, 'g1', 'f3');
  const pawn = state.pieces.find(piece => piece.id === pawnId);
  assert.equal(pawn?.zone, 'dead');
  assert.equal(pawn?.square, null);
});

test('the same empty target cannot kill a dead pawn twice', () => {
  let state = game({ hands: { white: [CARD, CARD], black: [] } });
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  rejected(state, { type: 'playCard', cardId: CARD, target: 'a2' } as Action, 'INVALID_TARGET');
});

test('occupying a dead pawn\'s old square does not resurrect it', () => {
  const before = game();
  const pawnId = pieceAt(before, 'a2')?.id;
  const state = move(play(before, 'a2'), 'a1', 'a2');
  assert.equal(pieceAt(state, 'a2')?.role, 'rook');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'dead');
});

test('successful play discards the exact hand instance', () => {
  const before = game();
  const instanceId = before.players.white.hand[0]?.id;
  const state = play(before, 'a2');
  assert.equal(state.players.white.discard.at(-1)?.id, instanceId);
  assert.equal(state.players.white.discard.at(-1)?.cardId, CARD);
});

test('successful play immediately draws the top deck instance', () => {
  const before = game({ decks: { white: [CARD, CARD], black: [] } });
  const topId = before.players.white.deck[0]?.id;
  const nextId = before.players.white.deck[1]?.id;
  const state = play(before, 'a2');
  assert.equal(state.players.white.hand.at(-1)?.id, topId);
  assert.equal(state.players.white.deck[0]?.id, nextId);
});

test('a replacement draw keeps hand size stable', () => {
  const before = game({ hands: { white: [CARD, CARD], black: [] }, decks: { white: [CARD], black: [] } });
  assert.equal(play(before, 'a2').players.white.hand.length, before.players.white.hand.length);
});

test('an exhausted deck makes the hand shrink', () => {
  const before = game({ hands: { white: [CARD, CARD], black: [] } });
  const state = play(before, 'a2');
  assert.equal(state.players.white.hand.length, 1);
  assert.equal(state.players.white.deck.length, 0);
});

test('an exhausted separate deck never reshuffles discard', () => {
  let state = game({ hands: { white: [CARD, CARD], black: [] } });
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  state = play(state, 'b2');
  assert.equal(state.players.white.hand.length, 0);
  assert.equal(state.players.white.deck.length, 0);
  assert.equal(state.players.white.discard.length, 2);
});

test('white card play leaves every black card zone untouched', () => {
  const before = game({ hands: { white: [CARD], black: [CARD, CARD] }, decks: { white: [CARD], black: [CARD] } });
  const black = structuredClone(before.players.black);
  assert.deepEqual(play(before, 'a2').players.black, black);
});

test('repeated plays preserve discard order by instance', () => {
  let state = game({ hands: { white: [CARD, CARD], black: [] } });
  const expected = state.players.white.hand.map(card => card.id);
  state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
  state = finishMove(state, 'e7', 'e5');
  state = play(state, 'b2');
  assert.deepEqual(state.players.white.discard.map(card => card.id), expected);
});

test('invalid play changes no hand, deck, or discard', () => {
  const state = game({ decks: { white: [CARD], black: [] } });
  const players = structuredClone(state.players);
  rejected(state, { type: 'playCard', cardId: CARD, target: 'a3' } as Action, 'INVALID_TARGET');
  assert.deepEqual(state.players, players);
});

test('removing a blocker may legally give direct check', () => {
  const state = play(game({ fen: CHECK_FEN }), 'a4');
  assert.equal(pieceAt(state, 'a4'), undefined);
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.outcome, null);
});

test('direct check may be created after the regular move', () => {
  const moved = move(game({ fen: CHECK_FEN }), 'h1', 'h2');
  const state = play(moved, 'a4');
  assert.equal(pieceAt(state, 'h2')?.role, 'king');
  assert.equal(pieceAt(state, 'a4'), undefined);
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
});

test('a before-move direct check does not consume the regular move', () => {
  const state = move(play(game({ fen: CHECK_FEN }), 'a4'), 'h1', 'h2');
  assert.equal(pieceAt(state, 'h2')?.role, 'king');
  assert.equal(state.turn.moveMade, true);
});

test('a card-created check never makes the enemy King capturable', () => {
  const state = play(game({ fen: CHECK_FEN }), 'a4');
  assert.equal(legalDests(state).get('a1')?.includes('a8'), false);
  rejected(state, { type: 'move', from: 'a1', to: 'a8' } as Action, 'ILLEGAL_MOVE');
  assert.equal(pieceAt(state, 'a8')?.role, 'king');
});

test('the checked player cannot answer with an unrelated pawn move', () => {
  let state = game({ fen: CHECK_REPLY_FEN, hands: { white: [CARD], black: [] } });
  state = endTurn(move(play(state, 'a4'), 'h1', 'h2'));
  rejected(state, { type: 'move', from: 'h7', to: 'h6' } as Action, 'ILLEGAL_MOVE');
});

test('the checked player can answer with a king escape', () => {
  let state = game({ fen: CHECK_FEN, hands: { white: [CARD], black: [] } });
  state = endTurn(move(play(state, 'a4'), 'h1', 'h2'));
  state = move(state, 'a8', 'b8');
  assert.equal(pieceAt(state, 'b8')?.role, 'king');
});

test('apparent mate waits for a Disintegration escape turn', () => {
  let state = game({
    fen: '6rk/6pp/3N4/8/8/8/8/K7 w - - 0 1',
    hands: { white: [], black: [CARD] },
  });
  state = finishMove(state, 'd6', 'f7');
  assert.equal(state.outcome, null);
  assert.equal(state.turn.color, 'black');
  state = move(play(state, 'h7'), 'h8', 'h7');
  assert.equal(pieceAt(state, 'h7')?.role, 'king');
});

test('wasting the apparent-mate escape ends the game instead of getting stuck', () => {
  let state = game({
    fen: 'rnb1kbnr/pppp1ppp/8/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    hands: { white: [CARD], black: [] },
  });
  state = play(state, 'a2');
  assert.deepEqual(state.outcome, { winner: 'black', reason: 'checkmate' });
  assert.equal(legalDests(state).size, 0);
});

test('a before-move card that leaves no legal continuation records stalemate', () => {
  const state = play(game({
    fen: 'k7/7p/1QK4R/8/8/8/8/8 b - - 0 1',
    hands: { white: [], black: [CARD] },
  }), 'h7');
  assert.deepEqual(state.outcome, { reason: 'stalemate' });
});

test('after-move card play does not adjudicate the actor as if they moved again', () => {
  let state = game({
    fen: '8/8/8/8/1p6/6q1/PP3k2/7K w - - 0 1',
    hands: { white: [CARD], black: [] },
  });
  state = play(move(state, 'b2', 'b3'), 'a2');
  assert.equal(state.outcome, null);
});

test('a before-move direct mate fizzles without killing the pawn', () => {
  const before = game({ fen: MATE_FEN });
  const state = play(before, 'a4');
  assert.deepEqual(state.pieces, before.pieces);
  assert.equal(pieceAt(state, 'a4')?.role, 'pawn');
  assert.equal(state.turn.phase, 'beforeMove');
});

test('the regular move remains available after a mate fizzle', () => {
  const state = move(play(game({ fen: MATE_FEN }), 'a4'), 'c7', 'c6');
  assert.equal(pieceAt(state, 'c6')?.role, 'king');
  assert.equal(state.turn.moveMade, true);
});

test('an after-move direct mate fizzle preserves the completed move', () => {
  const moved = move(game({ fen: MATE_FEN }), 'c7', 'c6');
  const state = play(moved, 'a4');
  assert.deepEqual(state.pieces, moved.pieces);
  assert.equal(pieceAt(state, 'c6')?.role, 'king');
  assert.equal(pieceAt(state, 'a4')?.role, 'pawn');
});

test('a mate-fizzled card is discarded and replaced', () => {
  const before = game({ fen: MATE_FEN, decks: { white: [CARD], black: [] } });
  const playedId = before.players.white.hand[0]?.id;
  const drawnId = before.players.white.deck[0]?.id;
  const state = play(before, 'a4');
  assert.equal(state.players.white.discard.at(-1)?.id, playedId);
  assert.equal(state.players.white.hand.at(-1)?.id, drawnId);
  assert.equal(state.players.white.deck.length, 0);
});

test('a mate fizzle consumes the own-turn card allowance', () => {
  const state = play(game({ fen: MATE_FEN, decks: { white: [CARD], black: [] } }), 'a4');
  assert.equal(state.turn.cardPlays.white, 1);
  rejected(state, { type: 'playCard', cardId: CARD, target: 'a4' } as Action, 'CARD_ALREADY_PLAYED');
});

test('a mate fizzle records its reason without ending the game', () => {
  const state = play(game({ fen: MATE_FEN }), 'a4');
  const event = state.history.at(-1);
  assert.equal(event?.type, 'cardFizzled');
  if (event?.type !== 'cardFizzled') assert.fail('missing cardFizzled event');
  assert.equal(event.cardId, CARD);
  assert.equal(event.reason, 'DIRECT_MATE');
  assert.equal(state.outcome, null);
});

test('before moving, a pawn may be removed even if that temporarily exposes its king', () => {
  const state = play(game({ fen: PIN_FEN }), 'e2');
  assert.equal(pieceAt(state, 'e2'), undefined);
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
});

test('moving the king away makes after-move removal of its shield legal', () => {
  const state = play(move(game({ fen: PIN_FEN }), 'e1', 'd1'), 'e2');
  assert.equal(pieceAt(state, 'd1')?.role, 'king');
  assert.equal(pieceAt(state, 'e2'), undefined);
});

test('rejected after-move removal preserves the earlier move', () => {
  const moved = move(game({ fen: PIN_FEN }), 'a2', 'a3');
  rejected(moved, { type: 'playCard', cardId: CARD, target: 'e2' } as Action, 'KING_IN_CHECK');
  assert.equal(pieceAt(moved, 'a3')?.role, 'pawn');
  assert.equal(moved.turn.phase, 'afterMove');
});

test('king-safety rejection leaves the card allowance available', () => {
  const state = move(game({ fen: PIN_FEN }), 'a2', 'a3');
  rejected(state, { type: 'playCard', cardId: CARD, target: 'e2' } as Action, 'KING_IN_CHECK');
  const next = play(state, 'a3');
  assert.equal(next.turn.cardPlays.white, 1);
  assert.equal(pieceAt(next, 'e2')?.role, 'pawn');
});

test('a rejected pinned-pawn capture does not prevent card play', () => {
  const state = game({ fen: PIN_CAPTURE_FEN });
  rejected(state, { type: 'move', from: 'e2', to: 'd3' } as Action, 'ILLEGAL_MOVE');
  const next = play(state, 'a2');
  assert.equal(pieceAt(next, 'a2'), undefined);
  assert.equal(pieceAt(next, 'e2')?.role, 'pawn');
});

test('an unrelated before-move play may precede the move that cures an existing check', () => {
  const played = play(game({ fen: IN_CHECK_FEN }), 'a2');
  const state = move(played, 'e1', 'd1');
  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(pieceAt(state, 'd1')?.role, 'king');
});

test('an illegal move after a successful card preserves the card result', () => {
  const state = play(game(), 'a2');
  rejected(state, { type: 'move', from: 'e2', to: 'e5' } as Action, 'ILLEGAL_MOVE');
  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(state.players.white.discard.length, 1);
});

test('an enemy pawn target is rejected atomically', () => {
  const state = game();
  rejected(state, { type: 'playCard', cardId: CARD, target: 'a7' } as Action, 'WRONG_OWNER');
});

test('an own non-pawn target is rejected atomically', () => {
  const state = game();
  rejected(state, { type: 'playCard', cardId: CARD, target: 'a1' } as Action, 'WRONG_ROLE');
});

test('a second successful play in one own turn is rejected', () => {
  const state = play(game({ hands: { white: [CARD, CARD], black: [] } }), 'a2');
  rejected(state, { type: 'playCard', cardId: CARD, target: 'b2' } as Action, 'CARD_ALREADY_PLAYED');
});

test('replaying the same mixed sequence is deterministic', () => {
  const options: Options = {
    hands: { white: [CARD], black: [CARD] },
    decks: { white: [CARD], black: [CARD] },
  };
  const replay = () => {
    let state = game(options);
    state = endTurn(move(play(state, 'a2'), 'e2', 'e4'));
    state = endTurn(play(move(state, 'e7', 'e5'), 'a7'));
    return state;
  };
  assert.deepEqual(replay(), replay());
});

test('successful reduction never mutates its input state', () => {
  const before = game({ decks: { white: [CARD], black: [] } });
  const snapshot = structuredClone(before);
  const after = play(before, 'a2');
  assert.deepEqual(before, snapshot);
  assert.notStrictEqual(after, before);
  assert.notStrictEqual(after.pieces, before.pieces);
  assert.notStrictEqual(after.players.white, before.players.white);
});
