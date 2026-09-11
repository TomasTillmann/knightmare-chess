import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { Color, GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

function moved(black = ['chaos']): GameState {
  return act(createGameState({ hands: { black } }), { type: 'move', from: 'e2', to: 'e4' });
}

function soleMove(cardId: string, mover: Color, hand: string[] = [], rook = false) {
  const responder: Color = mover === 'white' ? 'black' : 'white';
  const square = (value: string) => mover === 'white' ? value : `${value[0]}${9 - Number(value[1])}`;
  const board = `3k1K2/4p3/8/8/8/6r1/8/${rook ? 'R7' : '8'}`;
  const fen = mover === 'white' ? board : board.split('/').reverse().join('/').replace(/[a-z]/gi,
    piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
  const initial = createGameState({ fen: `${fen} ${mover[0]} - - 0 1`, hands: { [mover]: hand, [responder]: [cardId] }, decks: {} });
  const move: GameAction = { type: 'move', from: square('f8'), to: square('f7') };
  return { initial, state: act(initial, move), responder, square, move };
}

for (const cardId of ['chaos', 'knightmare', 'think-again']) {
  for (const mover of ['white', 'black'] as const) {
    test(`${cardId} draws when ${mover} has no replacement move`, () => {
      const { initial, state, responder } = soleMove(cardId, mover);
      const before = structuredClone(state);
      const next = act(state, { type: 'playCard', cardId });
      assert.deepEqual(next.outcome, { reason: 'stalemate' });
      assert.deepEqual(state, before);
      assert.deepEqual(next.pieces, initial.pieces);
      assert.deepEqual(next.players[responder].discard, initial.players[responder].hand);
      assert.deepEqual(next.players[mover], initial.players[mover]);
      assert.equal(next.history.at(-1)?.type, 'cardPlayed');
      assert.equal(isKingInCheck(next, mover), false);
    });

    test(`${cardId} draws only after ${mover} spends its last Vulture continuation`, () => {
      const { initial, state, responder, move } = soleMove(cardId, mover, ['vulture']);
      const canceled = act(state, { type: 'playCard', cardId });
      assert.equal(canceled.outcome, null);
      assert.deepEqual(cardPlayTargets(canceled, 'vulture'), [undefined]);
      assert.equal(legalDests(canceled).size, 0);
      const before = structuredClone(canceled);
      for (const action of [move, { type: 'endTurn' } as const]) {
        const rejected = applyAction(canceled, action);
        assert.equal(rejected.ok, false);
        assert.deepEqual(rejected.state, before);
      }
      const exhausted = act(canceled, { type: 'playCard', cardId: 'vulture' });
      assert.deepEqual(exhausted.outcome, { reason: 'stalemate' });
      assert.deepEqual(canceled, before);
      assert.deepEqual(exhausted.players[mover].hand, initial.players[responder].hand);
      assert.deepEqual(exhausted.players[mover].discard, initial.players[mover].hand);
      assert.deepEqual(exhausted.players[responder].discard, []);
      assert.equal(exhausted.turn.cardPlays[mover], 1);
      assert.equal(exhausted.turn.cardPlays[responder], 1);
      assert.equal(isKingInCheck(exhausted, mover), false);
    });

    test(`${cardId} keeps ${mover}'s alternate rook move after cancellation and Vulture`, () => {
      for (const hand of [[], ['vulture']]) {
        const { state, square, move } = soleMove(cardId, mover, hand, true);
        let next = act(state, { type: 'playCard', cardId });
        if (hand.length) next = act(next, { type: 'playCard', cardId: 'vulture' });
        assert.equal(next.outcome, null);
        assert.equal(applyAction(next, move).ok, false);
        next = act(next, { type: 'move', from: square('a1'), to: square('a2') });
        assert.equal(next.chaosForbidden, undefined);
        act(next, { type: 'endTurn' });
      }
    });
  }
}

for (const cardId of ['mystic-shield', 'dubbing', 'under-elf-hill', 'crab', 'haunting-memories']) {
  test(`cancellation considers actual ${cardId} continuations`, () => {
    const { state } = soleMove('chaos', 'white', [cardId]);
    let next = act(state, { type: 'playCard', cardId: 'chaos' });
    if (cardId === 'crab' || cardId === 'haunting-memories') {
      assert.deepEqual(next.outcome, { reason: 'stalemate' });
      return;
    }
    assert.equal(next.outcome, null);
    if (cardId === 'mystic-shield') {
      assert.deepEqual(cardPlayTargets(next, cardId), []);
      assert.equal(legalDests(next, false).size, 0);
      assert.ok(legalDests(next).size);
      next = act(next, { type: 'move', from: 'f8', to: 'g8' });
      assert.ok(next.pendingRescue);
      next = act(next, { type: 'playCard', cardId, target: 'g8' });
      assert.equal(next.pendingRescue, null);
    } else {
      const targets = cardPlayTargets(next, cardId);
      assert.ok(targets.length);
      next = act(next, { type: 'playCard', cardId, target: targets[0] });
    }
    act(next, { type: 'endTurn' });
  });
}

test('replacement stalemate expires Truce and reopens captures', () => {
  let state = createGameState({
    fen: '8/7k/8/8/7p/ppp5/PP5P/KP6 b - - 77 42',
    hands: { black: ['truce', 'chaos'] }, decks: {},
  });
  const truce = state.players.black.hand[0]!;
  state = act(state, { type: 'move', from: 'h7', to: 'h8' });
  state = act(state, { type: 'playCard', cardId: 'truce' });
  state = act(state, { type: 'endTurn' });
  assert.deepEqual([...legalDests(state)], [['h2', ['h3']]]);
  state = act(state, { type: 'move', from: 'h2', to: 'h3' });
  const before = structuredClone(state);
  const next = act(state, { type: 'playCard', cardId: 'chaos' });
  assert.deepEqual(state, before);
  assert.equal(next.outcome, null);
  assert.deepEqual(next.effects, []);
  assert.ok(next.players.black.discard.some(card => card.id === truce.id));
  assert.equal(next.fen.split(' ')[4], '0');
  assert.equal(applyAction(next, { type: 'move', from: 'h2', to: 'h3' }).ok, false);
  act(act(next, { type: 'move', from: 'a2', to: 'b3' }), { type: 'endTurn' });
});

test('retaining optional Truce still draws after its stalemate expiry', () => {
  let { state } = soleMove('chaos', 'white', ['truce']);
  const truce = state.players.white.hand[0]!;
  state = act(state, { type: 'playCard', cardId: 'truce' });
  assert.deepEqual(state.effects, [{ type: 'truce', owner: 'white', card: truce }]);
  const before = structuredClone(state);
  const next = act(state, { type: 'playCard', cardId: 'chaos', target: { returnCard: false } });
  assert.deepEqual(state, before);
  assert.deepEqual(next.outcome, { reason: 'stalemate' });
  assert.deepEqual(next.effects, []);
  assert.deepEqual(next.players.white.discard, [truce]);
  assert.equal(next.turn.cardPlays.white, 1);
  assert.equal(next.fen.split(' ')[4], '0');
});

function awaitingRescue(cardId: string, mover: Color, shield: boolean) {
  const responder: Color = mover === 'black' ? 'white' : 'black';
  const square = (value: string) => mover === 'black' ? value : `${value[0]}${9 - Number(value[1])}`;
  const fen = shield ? '4k3/8/6R1/8/7p/8/8/3K4' : 'k7/8/8/8/3n4/8/8/RR5K';
  const board = mover === 'black' ? fen : fen.split('/').reverse().join('/').replace(/[a-z]/gi,
    piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
  let state = createGameState({
    fen: `${board} ${mover[0]} - - 0 1`,
    hands: { [mover]: shield ? ['coup', 'mystic-shield'] : ['challenge', 'haunting-memories'], [responder]: [cardId] },
    decks: shield ? {} : { [mover]: ['crab', 'long-jump'], [responder]: ['dubbing'] },
  });
  state = act(state, { type: 'move', from: square(shield ? 'e8' : 'd4'), to: square(shield ? 'd8' : 'e6') });
  state = act(state, { type: 'playCard', cardId: shield ? 'coup' : 'challenge', target: square(shield ? 'h4' : 'b1') });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square(shield ? 'g6' : 'b1'), to: square(shield ? 'h6' : 'b2') });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square(shield ? 'h4' : 'e6'), to: square(shield ? 'h3' : 'd4') });
  const rescue: GameAction = { type: 'playCard', cardId: shield ? 'mystic-shield' : 'haunting-memories', target: square(shield ? 'h3' : 'b2') };
  const replacement: GameAction = { type: 'move', from: square(shield ? 'd8' : 'e6'), to: square(shield ? 'c8' : 'f4') };
  return { state, rescue, responder, replacement };
}

for (const cardId of ['chaos', 'knightmare', 'think-again']) {
  for (const mover of ['black', 'white'] as const) {
    for (const shield of [false, true]) {
      test(`${cardId} waits for ${mover}'s ${shield ? 'Mystic Shield' : 'Haunting Memories'} rescue`, () => {
        const { state, rescue, responder, replacement } = awaitingRescue(cardId, mover, shield);
        assert.ok(state.pendingRescue);
        assert.equal(isKingInCheck(state, mover), true);
        const before = structuredClone(state);
        const card = state.players[responder].hand.find(candidate => candidate.cardId === cardId)!;
        for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
          for (const cardInstanceId of [undefined, card.id]) {
            const action: GameAction = { type: 'playCard', cardId, target, cardInstanceId };
            const input = structuredClone(action);
            const result = applyAction(state, action);
            assert.equal(result.ok, false, JSON.stringify(action));
            if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
            assert.deepEqual(result.state, before);
            assert.deepEqual(state, before);
            assert.deepEqual(action, input);
          }
        }
        assert.deepEqual(cardPlayTargets(state, cardId), []);
        assert.ok(cardPlayTargets(state, rescue.cardId).includes(rescue.target));
        assert.deepEqual(state, before);
        const saved = act(state, rescue);
        assert.equal(saved.pendingRescue, null);
        assert.equal(isKingInCheck(saved, mover), false);
        act(saved, { type: 'endTurn' });
        for (const target of [undefined, { returnCard: true }]) {
          const late = act(saved, { type: 'playCard', cardId, target, cardInstanceId: card.id });
          assert.equal(late.history.at(-1)?.type, 'cardFizzled');
          assert.equal(late.history.at(-1)?.reason, 'DIRECT_MATE');
          assert.deepEqual(late.pieces, saved.pieces);
          assert.deepEqual(late.effects, saved.effects);
          assert.deepEqual(late.players[mover], saved.players[mover]);
          assert.equal(late.players[responder].discard.filter(candidate => candidate.id === card.id).length, 1);
          assert.equal(late.pendingRescue, null);
          act(late, { type: 'endTurn' });
        }
        const retained = act(saved, { type: 'playCard', cardId, target: { returnCard: false } });
        assert.equal(retained.history.at(-1)?.type, 'cardPlayed');
        assert.deepEqual(retained.effects, saved.effects);
        assert.equal(isKingInCheck(retained, mover), false);
        act(act(retained, replacement), { type: 'endTurn' });
      });
    }
    test(`${cardId} still cancels ${mover}'s completed safe move`, () => {
      const responder = mover === 'black' ? 'white' : 'black';
      const before = createGameState({ turn: mover, hands: { [responder]: [cardId] } });
      const state = act(before, { type: 'move', from: mover === 'black' ? 'e7' : 'e2', to: mover === 'black' ? 'e5' : 'e4' });
      assert.equal(state.pendingRescue, null);
      assert.deepEqual(cardPlayTargets(state, cardId), [undefined]);
      for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
        const next = act(state, { type: 'playCard', cardId, target });
        assert.equal(next.history.at(-1)?.type, 'cardPlayed');
        assert.equal(boardFen(next), boardFen(before));
        assert.equal(next.turn.color, mover);
        assert.equal(next.turn.moveMade, false);
      }
    });
  }
}

for (const target of [null, {}, Object.create({ returnCard: false }), { returnCard: true, [Symbol('extra')]: true }]) {
  test(`Chaos rejects malformed target ${String(target)}`, () => {
    const state = moved();
    const result = applyAction(state, { type: 'playCard', cardId: 'chaos', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
  test(`Chaos accepts return choice ${JSON.stringify(target)}`, () => {
    const state = moved();
    const next = act(state, { type: 'playCard', cardId: 'chaos', target });
    assert.equal(next.history.at(-1)?.type, 'cardPlayed');
    assert.equal(boardFen(next), boardFen(createGameState()));
    assert.equal(next.turn.color, 'white');
    assert.equal(next.turn.cardPlays.black, 1);
  });
}

test('Chaos spends the selected physical copy', () => {
  const state = moved(['chaos', 'chaos']);
  const [first, second] = state.players.black.hand;
  const next = act(state, { type: 'playCard', cardId: 'chaos', cardInstanceId: second!.id });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(next.players.black.hand, [first]);
  assert.deepEqual(next.players.black.discard, [second]);
});

test('the mover optional passive card keeps the Chaos window open (publisher FAQ pp.16/37)', () => {
  let state = createGameState({ hands: { white: ['fatal-attraction'], black: ['chaos'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'e4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(cardPlayTargets(state, 'chaos'), [undefined]);
  const restored = act(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(boardFen(restored), boardFen(createGameState()));
  assert.deepEqual(restored.effects, []);
  assert.equal(restored.players.white.hand[0]?.cardId, 'fatal-attraction');
});

test('reaction Plots preserves Chaos timing and remains spent after cancellation', () => {
  let state = moved(['plots-within-plots', 'chaos']);
  const plots = state.players.black.hand[0]!;
  const chaos = state.players.black.hand[1]!;
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  const next = act(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(boardFen(next), boardFen(createGameState()));
  assert.deepEqual(next.players.black.discard, [plots, chaos]);
  assert.equal(next.turn.cardPlays.black, 2);
});
