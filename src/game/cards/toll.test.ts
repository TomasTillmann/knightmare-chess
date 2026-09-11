import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck } from '../reducer.js';
import type { BoardOrientation, Color, GameAction, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const description = 'Play this card when your opponent has just moved a piece toward you across the "frontier" - the line separating your half of the board from his. He must "pay" by choosing a Pawn to lose. If he does not wish to pay, his turn is canceled. He gets back any card he used, but he cannot make another move.';
const WHITE_FEN = '7k/8/8/8/R7/8/1P6/7K w - - 0 1';

function applied(state: GameState, action: GameAction, setup = 'action'): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${setup} failed: ${result.error.code} ${result.error.message}`);
  return result.state;
}

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';

test('Toll accepts an outward crossing followed by Merciless returning the same Rook home', () => {
  const initial = createGameState({
    fen: '7k/8/8/8/8/R7/1P6/7K w - - 0 1',
    hands: { white: ['merciless'], black: ['toll'] },
  });
  const moved = applied(initial, { type: 'move', from: 'a3', to: 'a6' });
  const returned = applied(moved, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a6', to: 'a3' }] });
  const paid = applied(returned, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(paid.pieces.find(piece => piece.id === pawnAt(initial, 'b2').id)?.zone, 'captured');
  assert.equal(pawnAt(paid, 'a3').role, 'rook');
});

test('Toll keeps the outward crossing through Plots Within Plots saved additional-move trigger', () => {
  const initial = createGameState({
    fen: '7k/8/8/8/8/R7/1P6/7K w - - 0 1',
    hands: { white: ['plots-within-plots', 'merciless', 'merciless'], black: ['toll'] },
    decks: { white: ['revenge', 'abduction'], black: ['revenge'] },
  });
  let state = applied(initial, { type: 'move', from: 'a3', to: 'a6' });
  state = applied(state, { type: 'playCard', cardId: 'plots-within-plots' });
  state = applied(state, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a6', to: 'a3' }] });
  const before = structuredClone(state);
  assert.deepEqual(cardPlayTargets(state, 'toll'), [undefined, 'b2']);
  const paid = applied(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(paid.pieces.find(piece => piece.id === pawnAt(initial, 'b2').id)?.zone, 'captured');
  assert.deepEqual(paid.players.white, state.players.white);
  const declined = applied(state, { type: 'playCard', cardId: 'toll' });
  assert.deepEqual(declined.pieces, initial.pieces);
  assert.deepEqual(declined.players.white, initial.players.white);
  assert.deepEqual(declined.players.black, { hand: initial.players.black.deck, deck: [], discard: initial.players.black.hand });
  assert.equal(declined.plotsAllowances, undefined);
  assert.equal(applyAction(declined, { type: 'move', from: 'a3', to: 'a6' }).ok, false);
  assert.deepEqual(state, before);

  let reaction = createGameState({
    fen: '7k/8/8/8/8/R7/1P6/7K w - - 0 1',
    hands: { white: ['merciless'], black: ['plots-within-plots', 'toll', 'toll'] },
  });
  reaction = applied(reaction, { type: 'move', from: 'a3', to: 'a6' });
  reaction = applied(reaction, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a6', to: 'a3' }] });
  reaction = applied(reaction, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
  const reactionBefore = structuredClone(reaction);
  assert.deepEqual(cardPlayTargets(reaction, 'toll'), [undefined, 'b2']);
  const reactionPaid = applied(reaction, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(reactionPaid.pieces.find(piece => piece.id === pawnAt(reaction, 'b2').id)?.zone, 'captured');
  assert.deepEqual(reaction, reactionBefore);
});

function crossedState({
  fen = WHITE_FEN,
  mover = 'white',
  from = 'a4',
  to = 'a5',
  orientation = 0,
}: {
  fen?: string;
  mover?: Color;
  from?: SquareName;
  to?: SquareName;
  orientation?: BoardOrientation;
} = {}) {
  const reactor = opposite(mover);
  const initial = createGameState({
    fen,
    hands: { [reactor]: ['toll'] },
    decks: { [reactor]: ['revenge'] },
  });
  initial.orientation = orientation;
  const moved = applied(initial, { type: 'move', from, to }, `${mover} ${from}-${to}`);
  return { initial, moved, mover, reactor };
}

function playToll(state: GameState, target?: unknown) {
  const reactor = opposite(state.turn.color);
  const toll = state.players[reactor].hand.find(card => card.cardId === 'toll');
  assert.ok(toll, `${reactor} Toll fixture`);
  return applyAction(state, {
    type: 'playCard', cardId: 'toll', cardInstanceId: toll.id, target,
  });
}

function pawnAt(state: GameState, square: SquareName): PieceState {
  const pawn = state.pieces.find(piece => piece.square === square);
  assert.ok(pawn, `piece at ${square}`);
  return pawn;
}

const returnCards = [
  { cardId: 'merciless', row: 'R7', from: 'a3', via: 'a6', home: 'a4' },
  { cardId: 'crusade', row: 'B7', from: 'a3', via: 'd6', home: 'b4' },
  { cardId: 'charge', row: '2N5', from: 'c3', via: 'd5', home: 'a4' },
] as const;

for (const mover of ['white', 'black'] as const) {
  const reactor = opposite(mover);
  const square = (value: SquareName): SquareName => mover === 'white' ? value
    : `${value[0]}${9 - Number(value[1])}` as SquareName;
  const fixture = ({ cardId, row }: typeof returnCards[number]) => createGameState({
    fen: mover === 'white' ? `7k/8/8/8/8/${row}/1P6/7K w - - 0 1`
      : `7k/1p6/${row.toLowerCase()}/8/8/8/8/7K b - - 0 1`,
    hands: { [mover]: [cardId], [reactor]: ['toll', 'toll'] },
    decks: { [mover]: ['revenge'], [reactor]: ['abduction', 'revenge'] },
  });
  const outward = (state: GameState, card: typeof returnCards[number]) =>
    applied(state, { type: 'move', from: square(card.from), to: square(card.via) });
  const homeward = (state: GameState, card: typeof returnCards[number]) =>
    applied(state, { type: 'playCard', cardId: card.cardId,
      target: [{ from: square(card.via), to: square(card.from) }] });

  for (const card of returnCards) {
    test(`${mover} ${card.cardId} return keeps Toll targets, payment, and exact physical draws`, () => {
      const initial = fixture(card);
      const moved = outward(initial, card);
      const control = playToll(moved, square('b2'));
      assert.equal(control.ok, true, 'outward-only control');
      assert.equal(control.state.pieces.find(piece => piece.id === pawnAt(initial, square('b2')).id)?.zone, 'captured');
      const returned = homeward(moved, card);
      const before = structuredClone(returned);
      assert.deepEqual(cardPlayTargets(returned, 'toll'), [undefined, square('b2')]);
      const selected = initial.players[reactor].hand[1];
      const paid = applied(returned, { type: 'playCard', cardId: 'toll', cardInstanceId: selected.id, target: square('b2') });
      assert.deepEqual(returned, before);
      assert.deepEqual(pawnAt(paid, square(card.from)), pawnAt(returned, square(card.from)));
      assert.deepEqual(paid.pieces.find(piece => piece.id === pawnAt(initial, square('b2')).id), {
        ...pawnAt(initial, square('b2')), square: null, zone: 'captured', capturedBy: reactor,
      });
      assert.deepEqual(paid.players[mover], {
        hand: initial.players[mover].deck, deck: [], discard: initial.players[mover].hand,
      });
      assert.deepEqual(paid.players[reactor], {
        hand: [initial.players[reactor].hand[0], initial.players[reactor].deck[0]],
        deck: [initial.players[reactor].deck[1]], discard: [selected],
      });
      assert.deepEqual(paid.effects, returned.effects);
      assert.deepEqual(paid.history.slice(0, -1), returned.history);
      assert.equal(paid.turn.cardPlays[mover], 1);
      assert.equal(paid.turn.cardPlays[reactor], 1);
      assert.equal(paid.turnCheckpoint, undefined);
      assert.equal(applied(paid, { type: 'endTurn' }).turn.color, reactor);
    });
  }

  test(`${mover} declining after each return restores the entire turn and forbids another move`, () => {
    for (const card of returnCards) {
      const initial = fixture(card);
      const returned = homeward(outward(initial, card), card);
      const before = structuredClone(returned);
      const selected = initial.players[reactor].hand[1];
      const declined = applied(returned, { type: 'playCard', cardId: 'toll', cardInstanceId: selected.id });
      assert.deepEqual(returned, before);
      assert.deepEqual(declined.pieces, initial.pieces);
      assert.deepEqual(declined.players[mover], initial.players[mover]);
      assert.deepEqual(declined.players[reactor], {
        hand: [initial.players[reactor].hand[0], initial.players[reactor].deck[0]],
        deck: [initial.players[reactor].deck[1]], discard: [selected],
      });
      assert.deepEqual(declined.effects, initial.effects);
      assert.deepEqual(declined.enPassant, initial.enPassant);
      assert.deepEqual(declined.fen.split(' ').slice(0, 4), [
        initial.fen.split(' ')[0], reactor === 'white' ? 'w' : 'b', '-', '-',
      ]);
      assert.deepEqual(declined.fen.split(' ').slice(4), ['1', mover === 'white' ? '1' : '2']);
      assert.equal(declined.history.length, 1);
      assert.equal(declined.history[0].cardId, 'toll');
      assert.equal(declined.turnCheckpoint, undefined);
      assert.deepEqual(declined.turn.cardPlays, { white: 1, black: 1 });
      assert.equal(applyAction(declined, { type: 'move', from: square(card.from), to: square(card.via) }).ok, false);
      assert.equal(applyAction(declined, { type: 'playCard', cardId: card.cardId,
        target: [{ from: square(card.from), to: square(card.via) }] }).ok, false);
      const ended = applied(declined, { type: 'endTurn' });
      assert.equal(ended.turn.color, reactor);
      assert.deepEqual(cardPlayTargets(ended, 'toll'), []);
    }
  });

  test(`${mover} homeward-only additional movement cannot reuse an earlier turn's crossing`, () => {
    for (const card of returnCards) {
      let state = applied(outward(fixture(card), card), { type: 'endTurn' });
      state = applied(state, { type: 'move', from: square('h8'), to: square('g8') });
      state = applied(state, { type: 'endTurn' });
      state = applied(state, { type: 'move', from: square(card.via), to: square(card.from) });
      assert.deepEqual(cardPlayTargets(state, 'toll'), []);
      state = applied(state, { type: 'playCard', cardId: card.cardId,
        target: [{ from: square(card.from), to: square(card.home) }] });
      const before = structuredClone(state);
      assert.deepEqual(cardPlayTargets(state, 'toll'), []);
      const rejected = playToll(state, square('b2'));
      assert.equal(rejected.ok, false);
      if (!rejected.ok) assert.equal(rejected.error.code, 'INVALID_TIMING');
      assert.deepEqual(rejected.state, before);
      assert.deepEqual(state, before);
    }
  });

  test(`${mover} Toll after each return still fizzles a payment exposing the mover's King`, () => {
    for (const card of returnCards) {
      const initial = createGameState({
        fen: mover === 'white' ? `4r2k/8/8/8/8/${card.row}/1P2P3/4K3 w - - 0 1`
          : `4k3/1p2p3/${card.row.toLowerCase()}/8/8/8/8/4R2K b - - 0 1`,
        hands: { [mover]: [card.cardId], [reactor]: ['toll'] },
        decks: { [mover]: ['revenge'], [reactor]: ['abduction'] },
      });
      const returned = homeward(outward(initial, card), card);
      const before = structuredClone(returned);
      const fizzled = applied(returned, { type: 'playCard', cardId: 'toll', target: square('e2') });
      assert.deepEqual(returned, before);
      assert.equal(fizzled.history.at(-1)?.type, 'cardFizzled');
      assert.equal(fizzled.history.at(-1)?.reason, 'SELF_CHECK');
      assert.deepEqual(fizzled.pieces, returned.pieces);
      assert.equal(fizzled.fen, returned.fen);
      assert.deepEqual(fizzled.players[mover], returned.players[mover]);
      assert.deepEqual(fizzled.players[reactor], {
        hand: initial.players[reactor].deck, deck: [], discard: initial.players[reactor].hand,
      });
      assert.equal(fizzled.turnCheckpoint, undefined);
      assert.equal(isKingInCheck(fizzled, mover), false);
      assert.equal(applied(fizzled, { type: 'endTurn' }).turn.color, reactor);
    }
  });
}

test('Toll retains an outward-and-return crossing after public Earthquake rotation', () => {
  let state = createGameState({
    fen: '7k/8/8/8/2R5/8/1P6/7K b - - 0 1',
    hands: { white: ['merciless'], black: ['earthquake', 'toll'] },
  });
  state = applied(state, { type: 'move', from: 'h8', to: 'g8' });
  state = applied(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'counterclockwise', promotions: [] } });
  state = applied(state, { type: 'endTurn' });
  state = applied(state, { type: 'move', from: 'c4', to: 'f4' });
  state = applied(state, { type: 'playCard', cardId: 'merciless', target: [{ from: 'f4', to: 'c4' }] });
  assert.equal(state.orientation, 90);
  assert.deepEqual(cardPlayTargets(state, 'toll'), [undefined, 'b2']);
  const paid = applied(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(paid.pieces.find(piece => piece.id === pawnAt(state, 'b2').id)?.zone, 'captured');
});

test('Toll recognizes public Haunting Memories copies of all three return moves', () => {
  for (const card of returnCards) {
    let state = createGameState({
      fen: `${card.row.toLowerCase()}/7k/8/8/8/${card.row}/1P5K/8 b - - 0 1`,
      hands: { black: [card.cardId, 'toll'], white: ['haunting-memories'] },
      decks: { white: ['revenge'], black: ['abduction'] },
    });
    const blackFrom = `${card.from[0]}8` as SquareName;
    const blackVia = card.cardId === 'charge' ? 'd6' : card.cardId === 'crusade' ? 'c6' : 'a6';
    state = applied(state, { type: 'move', from: blackFrom, to: blackVia });
    state = applied(state, { type: 'playCard', cardId: card.cardId, target: [{ from: blackVia, to: blackFrom }] });
    state = applied(state, { type: 'endTurn' });
    const initial = state;
    state = applied(state, { type: 'move', from: card.from, to: card.via });
    state = applied(state, { type: 'playCard', cardId: 'haunting-memories', target: [{ from: card.via, to: card.from }] });
    assert.equal(state.history.at(-1)?.copiedCardId, card.cardId);
    const before = structuredClone(state);
    assert.deepEqual(cardPlayTargets(state, 'toll'), [undefined, 'b2']);
    const paid = applied(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
    assert.equal(paid.pieces.find(piece => piece.id === pawnAt(initial, 'b2').id)?.zone, 'captured');
    assert.deepEqual(paid.players.white, { hand: initial.players.white.deck, deck: [], discard: initial.players.white.hand });
    const declined = applied(state, { type: 'playCard', cardId: 'toll' });
    assert.deepEqual(declined.pieces, initial.pieces);
    assert.deepEqual(declined.players.white, initial.players.white);
    assert.deepEqual(state, before);
  }
});

for (const mover of ['white', 'black'] as const) {
  const white = mover === 'white';
  const reactor = opposite(mover);
  const square = (value: SquareName): SquareName => white ? value : `${value[0]}${9 - Number(value[1])}` as SquareName;
  const fen = white ? '4r2k/8/8/8/8/2N5/1P2P3/4K3 w - - 0 1'
    : '4k3/1p2p3/2n5/8/8/8/8/4R2K b - - 0 1';

  for (const choice of ['checking payment', 'safe payment', 'decline'] as const) {
    test(`${mover} Toll ${choice} preserves end-of-turn King safety`, () => {
      const { initial, moved } = crossedState({ fen, mover, from: square('c3'), to: square('d5') });
      const before = structuredClone(moved);
      const target = choice === 'decline' ? undefined : square(choice === 'checking payment' ? 'e2' : 'b2');
      const result = playToll(moved, target);
      if (!result.ok) assert.fail(result.error.code);
      const resolved = result.state;
      assert.deepEqual(moved, before);
      assert.equal(isKingInCheck(resolved, mover), false);
      assert.equal(resolved.turn.moveMade, true);
      assert.equal(resolved.turn.cardPlays[reactor], 1);
      assert.deepEqual(resolved.players[reactor].discard, before.players[reactor].hand);
      assert.deepEqual(resolved.players[reactor].hand, before.players[reactor].deck);
      assert.deepEqual(resolved.players[reactor].deck, []);
      assert.deepEqual(resolved.players[mover], before.players[mover]);
      if (choice === 'checking payment') {
        assert.deepEqual(resolved.pieces, before.pieces);
        assert.equal(resolved.fen, before.fen);
        assert.deepEqual(resolved.effects, before.effects);
        assert.deepEqual(resolved.enPassant, before.enPassant);
        assert.equal(resolved.history.at(-1)?.type, 'cardFizzled');
        assert.equal(resolved.history.at(-1)?.reason, 'SELF_CHECK');
        assert.equal(resolved.turn.cardPlays[mover], before.turn.cardPlays[mover]);
        assert.equal(resolved.turnCheckpoint, undefined);
      } else if (choice === 'safe payment') {
        assert.equal(resolved.pieces.find(piece => piece.id === pawnAt(before, square('b2')).id)?.zone, 'captured');
        assert.equal(resolved.history.at(-1)?.type, 'cardPlayed');
      } else {
        assert.deepEqual(resolved.pieces, initial.pieces);
        assert.equal(resolved.history.at(-1)?.type, 'cardPlayed');
      }
      assert.equal(applied(resolved, { type: 'endTurn' }).turn.color, reactor);
    });
  }

  test(`${mover} Haunting Memories copying Toll fizzles the same checking payment`, () => {
    let state = createGameState({
      fen, hands: { [reactor]: ['toll', 'haunting-memories'] },
      decks: { [reactor]: ['revenge', 'abduction'] },
    });
    const prep: GameAction[] = [
      { type: 'move', from: square('c3'), to: square('d5') },
      { type: 'playCard', cardId: 'toll', target: square('b2') },
      { type: 'endTurn' },
      { type: 'move', from: square('h8'), to: square('g8') },
      { type: 'endTurn' },
      { type: 'move', from: square('d5'), to: square('c3') },
      { type: 'endTurn' },
      { type: 'move', from: square('g8'), to: square('h8') },
      { type: 'endTurn' },
      { type: 'move', from: square('c3'), to: square('d5') },
    ];
    for (const action of prep) state = applied(state, action);
    const before = structuredClone(state);
    const copy = state.players[reactor].hand.find(card => card.cardId === 'haunting-memories')!;
    const resolved = applied(state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: copy.id, target: square('e2') });
    assert.deepEqual(state, before);
    assert.deepEqual(resolved.pieces, before.pieces);
    assert.equal(resolved.fen, before.fen);
    assert.equal(resolved.history.at(-1)?.type, 'cardFizzled');
    assert.equal(resolved.history.at(-1)?.reason, 'SELF_CHECK');
    assert.equal(resolved.history.at(-1)?.cardId, 'haunting-memories');
    assert.equal(resolved.history.at(-1)?.copiedCardId, 'toll');
    assert.deepEqual(resolved.players[reactor].discard, [...before.players[reactor].discard, copy]);
    assert.deepEqual(resolved.players[reactor].hand, [
      ...before.players[reactor].hand.filter(card => card.id !== copy.id), before.players[reactor].deck[0],
    ]);
    assert.deepEqual(resolved.players[reactor].deck, []);
    assert.equal(resolved.turn.cardPlays[reactor], 1);
    assert.equal(isKingInCheck(resolved, mover), false);
    assert.equal(applied(resolved, { type: 'endTurn' }).turn.color, reactor);
  });

  test(`${mover} cannot end in check merely because the last event is Toll`, () => {
    const state = createGameState({
      fen: white ? '4r2k/8/8/3N4/8/8/8/4K3 w - - 0 1'
        : '4k3/8/8/8/3n4/8/8/4R2K b - - 0 1',
      phase: 'afterMove', moveMade: true,
    });
    state.history.push({ type: 'cardPlayed', cardId: 'toll', player: reactor });
    const before = structuredClone(state);
    assert.equal(isKingInCheck(state, mover), true);
    const result = applyAction(state, { type: 'endTurn' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'KING_IN_CHECK');
    assert.deepEqual(state, before);
    assert.deepEqual(result.state, before);
  });

  test(`${mover} declining Toll fizzles when rollback would restore the King's check`, () => {
    const { moved } = crossedState({
      fen: white ? '4r2k/8/8/8/4K3/8/1P6/8 w - - 0 1'
        : '8/1p6/8/4k3/8/8/8/4R2K b - - 0 1',
      mover, from: square('e4'), to: square('d5'),
    });
    const result = playToll(moved);
    if (!result.ok) assert.fail(result.error.code);
    assert.deepEqual(result.state.pieces, moved.pieces);
    assert.equal(result.state.fen, moved.fen);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
    assert.deepEqual(result.state.players[reactor].discard, moved.players[reactor].hand);
    assert.deepEqual(result.state.players[reactor].hand, moved.players[reactor].deck);
    assert.equal(applied(result.state, { type: 'endTurn' }).turn.color, reactor);
  });
}

test('prints Toll metadata', () => {
  const toll = CARD_CATALOG.toll;
  assert.ok(toll);
  assert.equal(toll.id, 'toll');
  assert.equal(toll.name, 'Toll');
  assert.equal(toll.points, 4);
  assert.equal(toll.unique, false);
  assert.equal(toll.image, '/KC6_card3.png');
  assert.equal(toll.description, description);
  assert.deepEqual(toll.timing, ['afterOpponentMove']);
  assert.equal(toll.continuing, false);
});

test('white crossing a4-a5 lets black collect b2 and preserves the move', () => {
  const { moved } = crossedState();
  const before = structuredClone(moved);
  const result = playToll(moved, 'b2');
  if (!result.ok) assert.fail(result.error.code);

  const paid = result.state;
  const captured = paid.pieces.find(piece => piece.id === 'white-pawn-b2');
  assert.deepEqual(captured, { ...pawnAt(before, 'b2'), square: null, zone: 'captured', capturedBy: 'black' });
  assert.equal(pawnAt(paid, 'a5').id, pawnAt(before, 'a5').id);
  const expectedFenFields = before.fen.split(' ').slice(1);
  expectedFenFields[3] = '0'; // Losing the Pawn is a capture, so the ordinary draw counter resets.
  assert.deepEqual(paid.fen.split(' ').slice(1), expectedFenFields);
  assert.deepEqual(paid.history.slice(0, -1), before.history);
  assert.equal(paid.history.at(-1)?.type, 'cardPlayed');
  assert.equal(paid.history.at(-1)?.cardId, 'toll');
  assert.equal(paid.history.at(-1)?.player, 'black');
  assert.equal(paid.history.at(-1)?.target, 'b2');
  assert.equal(paid.history.at(-1)?.capturedId, 'white-pawn-b2');
  assert.equal(paid.turn.cardPlays.white, 0);
  assert.equal(paid.turn.cardPlays.black, 1);
  assert.deepEqual(paid.players.black.hand.map(card => card.cardId), ['revenge']);
  assert.deepEqual(paid.players.black.discard.map(card => card.cardId), ['toll']);
  assert.deepEqual(moved, before, 'Toll must not mutate its input state');
});

test('omitting Toll target declines, loses the turn, and records only Toll', () => {
  const { initial, moved } = crossedState();
  const before = structuredClone(moved);
  const result = playToll(moved);
  if (!result.ok) assert.fail(result.error.code);

  const declined = result.state;
  assert.deepEqual(declined.pieces, initial.pieces);
  assert.equal(declined.fen, '7k/8/8/8/R7/8/1P6/7K b - - 1 1');
  assert.deepEqual(declined.turn, {
    color: 'white', phase: 'afterMove', moveMade: true,
    cardPlays: { white: 1, black: 1 },
  });
  assert.deepEqual(declined.players.white, initial.players.white);
  assert.deepEqual(declined.players.black.hand.map(card => card.cardId), ['revenge']);
  assert.deepEqual(declined.players.black.discard.map(card => card.cardId), ['toll']);
  assert.equal(declined.history.length, 1);
  assert.equal(declined.history[0]?.type, 'cardPlayed');
  assert.equal(declined.history[0]?.cardId, 'toll');
  assert.equal(declined.history[0]?.player, 'black');
  assert.equal(declined.history[0]?.preservePreviousMove, false);
  assert.deepEqual(moved, before, 'decline must not mutate its input state');

  const noSecondMove = applyAction(declined, { type: 'move', from: 'a4', to: 'a5' });
  assert.equal(noSecondMove.ok, false);
  const ended = applied(declined, { type: 'endTurn' }, 'end declined turn');
  assert.equal(ended.turn.color, 'black');
  assert.equal(ended.turn.phase, 'beforeMove');
});

test('black crossing a5-a4 lets white collect the black Pawn on b7', () => {
  const { moved } = crossedState({
    fen: '7k/1p6/8/r7/8/8/8/7K b - - 7 23',
    mover: 'black', from: 'a5', to: 'a4',
  });
  const result = playToll(moved, 'b7');
  if (!result.ok) assert.fail(result.error.code);
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-pawn-b7')?.zone, 'captured');
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.turn.cardPlays.black, 0);
  assert.equal(result.state.history.at(-1)?.player, 'white');
});

test('frontier follows all four board orientations', () => {
  const cases: Array<[BoardOrientation, string, SquareName, SquareName]> = [
    [0, WHITE_FEN, 'a4', 'a5'],
    [90, '7k/8/8/8/3R4/8/1P6/7K w - - 0 1', 'd4', 'e4'],
    [180, '7k/8/8/R7/8/8/1P6/7K w - - 0 1', 'a5', 'a4'],
    [270, '7k/8/8/8/4R3/8/1P6/7K w - - 0 1', 'e4', 'd4'],
  ];
  for (const [orientation, fen, from, to] of cases) {
    const { moved } = crossedState({ fen, from, to, orientation });
    assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined, 'b2'], `${orientation}°`);
  }
});

test('sideways, backward, own-half, and already-across moves do not trigger', () => {
  const cases: Array<[string, SquareName, SquareName]> = [
    [WHITE_FEN, 'a4', 'b4'],
    ['7k/8/8/R7/8/8/1P6/7K w - - 0 1', 'a5', 'a4'],
    ['7k/8/8/8/8/R7/1P6/7K w - - 0 1', 'a3', 'a4'],
    ['7k/8/8/R7/8/8/1P6/7K w - - 0 1', 'a5', 'a6'],
  ];
  for (const [fen, from, to] of cases) {
    const { moved } = crossedState({ fen, from, to });
    const before = structuredClone(moved);
    assert.deepEqual(cardPlayTargets(moved, 'toll'), [], `${from}-${to}`);
    const result = playToll(moved, 'b2');
    assert.equal(result.ok, false, `${from}-${to}`);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
    assert.deepEqual(result.state, before);
  }
});

test('a move-producing card event triggers, but a later nonmovement event makes it stale', () => {
  const { moved } = crossedState();
  const move = moved.history.at(-1)!;
  const cardMovement: GameState = structuredClone(moved);
  cardMovement.history = [{
    ...move, type: 'cardPlayed', cardId: 'fanatic', player: 'white',
    from: undefined, to: undefined, movement: [{ from: 'a4', to: 'a5' }],
  }];
  assert.deepEqual(cardPlayTargets(cardMovement, 'toll'), [undefined, 'b2']);

  const stale = structuredClone(cardMovement);
  stale.history.push({ type: 'cardPlayed', cardId: 'pacifism', player: 'white', target: 'b2' });
  assert.deepEqual(cardPlayTargets(stale, 'toll'), []);
  const result = playToll(stale, 'b2');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
});

test('targets put decline first and include current, original, and neutral Pawns', () => {
  const { moved } = crossedState({
    fen: '7k/6p1/8/8/R7/8/1PB5/7K w - - 0 1',
  });
  const currentPawn = pawnAt(moved, 'g7');
  currentPawn.originalRole = 'bishop';
  currentPawn.promoted = true;
  currentPawn.neutral = true;
  const originalPawn = pawnAt(moved, 'c2');
  originalPawn.originalRole = 'pawn';
  originalPawn.role = 'bishop';
  assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined, 'b2', 'c2', 'g7']);
});

test('promoted original Pawns and enemy-controlled Pawns are not payment', () => {
  const { moved } = crossedState({
    fen: '7k/6p1/8/8/R7/8/1PQ5/7K w - - 0 1',
  });
  const promoted = pawnAt(moved, 'c2');
  promoted.originalRole = 'pawn';
  promoted.promoted = true;
  assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined, 'b2']);
});

test('royal, capture-immune, Pacifist, shielded, and Truce Pawns are protected', () => {
  const fixtures: Array<[string, (state: GameState, pawn: PieceState) => void]> = [
    ['royal', (_state, pawn) => { pawn.royal = true; }],
    ['captureImmune', (_state, pawn) => { Object.assign(pawn, { captureImmune: true }); }],
    ['pacifism', (state, pawn) => { state.effects = [{
      type: 'pacifism', owner: 'white', card: { id: 'p', cardId: 'pacifism' }, pieceId: pawn.id,
    }]; }],
    ['mystic shield', (state, pawn) => { state.effects = [{
      type: 'mystic-shield', owner: 'white', card: { id: 's', cardId: 'mystic-shield' }, pieceId: pawn.id,
    }]; }],
    ['truce', (state) => { state.effects = [{
      type: 'truce', owner: 'white', card: { id: 't', cardId: 'truce' },
    }]; }],
  ];
  for (const [label, protect] of fixtures) {
    const { moved } = crossedState();
    protect(moved, pawnAt(moved, 'b2'));
    assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined], label);
    const before = structuredClone(moved);
    const result = playToll(moved, 'b2');
    assert.equal(result.ok, false, label);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET', label);
    assert.deepEqual(result.state, before, label);
  }
});

test('null and non-Pawn targets are malformed and rejected atomically', () => {
  for (const [target, expected] of [
    [null, 'INVALID_TARGET'],
    ['a5', 'WRONG_ROLE'],
    ['b3', 'INVALID_TARGET'],
  ] as const) {
    const { moved } = crossedState();
    const before = structuredClone(moved);
    const result = playToll(moved, target);
    assert.equal(result.ok, false, String(target));
    if (!result.ok) assert.equal(result.error.code, expected);
    assert.deepEqual(result.state, before);
  }
});

test('only the opposite player may spend Toll and its response allowance', () => {
  const { moved } = crossedState();
  moved.players.white.hand.push({ id: 'white-toll', cardId: 'toll' });
  const before = structuredClone(moved);
  const wrongOwner = applyAction(moved, {
    type: 'playCard', cardId: 'toll', cardInstanceId: 'white-toll', target: 'b2',
  });
  assert.equal(wrongOwner.ok, false);
  if (!wrongOwner.ok) assert.ok(['CARD_NOT_IN_HAND', 'WRONG_OWNER'].includes(wrongOwner.error.code));
  assert.deepEqual(wrongOwner.state, before);

  moved.turn.cardPlays.black = 1;
  const alreadyPlayed = playToll(moved, 'b2');
  assert.equal(alreadyPlayed.ok, false);
  if (!alreadyPlayed.ok) assert.equal(alreadyPlayed.error.code, 'CARD_ALREADY_PLAYED');
});

test('the selected physical Toll instance alone is discarded and replaced', () => {
  const { moved } = crossedState();
  moved.players.black.hand.push({ id: 'black-extra-toll', cardId: 'toll' });
  const result = applyAction(moved, {
    type: 'playCard', cardId: 'toll', cardInstanceId: 'black-extra-toll', target: 'b2',
  });
  if (!result.ok) assert.fail(result.error.code);
  assert.deepEqual(result.state.players.black.hand.map(card => card.id), [
    'black-hand-0-toll', 'black-deck-0-revenge',
  ]);
  assert.deepEqual(result.state.players.black.discard.map(card => card.id), ['black-extra-toll']);
});

test('payment that checks the mover fizzles even when it does not directly mate', () => {
  const { moved } = crossedState({
    fen: '1r5k/8/8/8/R7/8/1P6/1K6 w - - 0 1',
  });
  const before = structuredClone(moved);
  const result = playToll(moved, 'b2');
  if (!result.ok) assert.fail(result.error.code);
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.fen, before.fen);
  assert.equal(result.state.turn.cardPlays.black, 1);
  assert.deepEqual(result.state.players.black.hand.map(card => card.cardId), ['revenge']);
  assert.deepEqual(result.state.players.black.discard.map(card => card.cardId), ['toll']);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(result.state.history.at(-1)?.cardId, 'toll');
});

test('decline restores a capture made while crossing', () => {
  const { initial, moved } = crossedState({
    fen: '7k/8/8/n7/R7/8/1P6/7K w - - 0 1',
  });
  assert.equal(moved.pieces.find(piece => piece.id === 'black-knight-a5')?.zone, 'captured');
  const result = playToll(moved);
  if (!result.ok) assert.fail(result.error.code);
  assert.deepEqual(result.state.pieces, initial.pieces);
  assert.equal(pawnAt(result.state, 'a5').id, 'black-knight-a5');
});

test('decline returns a mover-used card and undoes its continuing effect and draw', () => {
  const initial = createGameState({
    fen: WHITE_FEN,
    hands: { white: ['pacifism'], black: ['toll'] },
    decks: { white: ['revenge'], black: ['revenge'] },
  });
  const pacifism = initial.players.white.hand[0]!;
  const marked = applied(initial, {
    type: 'playCard', cardId: 'pacifism', cardInstanceId: pacifism.id, target: 'b2',
  }, 'Pacifism prerequisite');
  const moved = applied(marked, { type: 'move', from: 'a4', to: 'a5' }, 'cross after Pacifism');
  const result = playToll(moved);
  if (!result.ok) assert.fail(result.error.code);
  assert.deepEqual(result.state.pieces, initial.pieces);
  assert.deepEqual(result.state.players.white, initial.players.white);
  assert.deepEqual(result.state.effects, initial.effects);
  assert.equal(result.state.orientation, initial.orientation);
  assert.equal(result.state.history.length, 1);
  assert.equal(result.state.history[0]?.cardId, 'toll');
  assert.equal(result.state.history[0]?.preservePreviousMove, false);
});
