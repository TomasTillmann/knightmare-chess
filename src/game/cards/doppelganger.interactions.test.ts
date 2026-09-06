import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

test('Doppelganger lets a rook move as the opponent bishop just moved', () => {
  let state = createGameState({
    fen: '4k3/8/8/8/8/8/8/R3K2b b - - 0 1',
    hands: { white: ['doppelganger'], black: [] },
    decks: { white: [], black: [] },
  });

  const moved = applyAction(state, { type: 'move', from: 'h1', to: 'g2' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  state = ended.state;

  const replay = applyAction(state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'b2' }],
  });
  assert.equal(replay.ok, true);
});

test('Doppelganger cannot copy a Pawn or capture with the copied move', () => {
  let state = createGameState({
    fen: '4k3/p7/8/8/8/8/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const moved = applyAction(state, { type: 'move', from: 'a7', to: 'a6' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  state = ended.state;
  const copied = applyAction(state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a2' }],
  });
  assert.equal(copied.ok, false);

  state = createGameState({
    fen: '4k3/8/8/8/8/1b6/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const bishop = applyAction(state, { type: 'move', from: 'b3', to: 'c2' });
  assert.equal(bishop.ok, true);
  if (!bishop.ok) return;
  const bishopEnded = applyAction(bishop.state, { type: 'endTurn' });
  assert.equal(bishopEnded.ok, true);
  if (!bishopEnded.ok) return;
  state = bishopEnded.state;
  const capture = applyAction(state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'c2' }],
  });
  assert.equal(capture.ok, false);
});

test('Doppelganger is available only before the mover acts', () => {
  const control = createGameState({ fen: '4k3/8/8/8/8/8/8/R3K2b b - - 0 1', hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] } });
  const controlMove = applyAction(control, { type: 'move', from: 'h1', to: 'g2' });
  assert.equal(controlMove.ok, true);
  if (!controlMove.ok) return;
  const controlTurn = applyAction(controlMove.state, { type: 'endTurn' });
  assert.equal(controlTurn.ok, true);
  if (!controlTurn.ok) return;
  assert.equal(applyAction(controlTurn.state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'b2' }] }).ok, true);
  const state = createGameState({
    fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const moved = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const replay = applyAction(moved.state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a2', to: 'b3' }],
  });
  assert.equal(replay.ok, false);
});

test('Doppelganger records a card play and consumes the turn allowance', () => {
  const state = createGameState({
    fen: '4k3/8/8/8/8/8/8/R3K2b b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const moved = applyAction(state, { type: 'move', from: 'h1', to: 'g2' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  const played = applyAction(ended.state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'b2' }],
  });
  assert.equal(played.ok, true);
  if (!played.ok) return;
  assert.equal(played.state.turn.moveMade, true);
  assert.equal(played.state.turn.cardPlays.white, 1);
  assert.equal(played.state.history.at(-1)?.type, 'cardPlayed');
});

test('Doppelganger does not mutate the prior state when rejected', () => {
  const state = createGameState({
    fen: '4k3/p7/8/8/8/8/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const moved = applyAction(state, { type: 'move', from: 'a7', to: 'a6' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  const snapshot = structuredClone(ended.state);
  const result = applyAction(ended.state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a2' }],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(ended.state, snapshot);
});

test('Doppelganger can follow a non-card opponent move and copy a knight', () => {
  const state = createGameState({
    fen: '1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const moved = applyAction(state, { type: 'move', from: 'b8', to: 'd7' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  const played = applyAction(ended.state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'c2' }],
  });
  assert.equal(played.ok, true);
});

test('Doppelganger works for the opposite color on consecutive turns', () => {
  let state = createGameState({
    fen: '4k2r/8/8/8/8/8/8/R3K3 w - - 0 1',
    hands: { white: [], black: ['doppelganger'] }, decks: { white: [], black: [] },
  });
  const white = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(white.ok, true);
  if (!white.ok) return;
  const blackTurn = applyAction(white.state, { type: 'endTurn' });
  assert.equal(blackTurn.ok, true);
  if (!blackTurn.ok) return;
  state = blackTurn.state;
  const played = applyAction(state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'h8', to: 'h6' }],
  });
  assert.equal(played.ok, true);
});

test('Doppelganger rejects an empty or malformed movement target', () => {
  const state = createGameState({
    fen: '4k3/8/8/8/8/8/8/R3K2b b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const moved = applyAction(state, { type: 'move', from: 'h1', to: 'g2' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  assert.equal(applyAction(ended.state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'b2' }] }).ok, true);
  assert.equal(applyAction(ended.state, { type: 'playCard', cardId: 'doppelganger', target: [] }).ok, false);
});

test('Doppelganger retains moved-piece identity through JSON roundtrip', () => {
  const state = createGameState({ fen: '4k2r/8/8/8/8/8/8/R3K3 b - - 0 1', hands: { white: ['doppelganger'], black: ['dubbing'] }, decks: { white: [], black: [] } });
  const dubbed = applyAction(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'h8', to: 'f7' }] });
  assert.equal(dubbed.ok, true);
  if (!dubbed.ok) return;
  const ended = applyAction(dubbed.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  const restored = JSON.parse(JSON.stringify(ended.state));
  assert.equal(applyAction(restored, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a3' }] }).ok, true);
});

test('An earlier pre-move card consumes the allowance before Doppelganger', () => {
  const state = createGameState({ fen: '4k2r/8/8/8/8/8/8/RN2K3 b - - 0 1', hands: { white: ['doppelganger', 'long-jump'], black: ['dubbing'] }, decks: { white: [], black: [] } });
  const dubbed = applyAction(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'h8', to: 'f7' }] });
  assert.equal(dubbed.ok, true);
  if (!dubbed.ok) return;
  const ended = applyAction(dubbed.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  const prior = applyAction(ended.state, { type: 'playCard', cardId: 'long-jump', target: [{ from: 'b1', to: 'd2' }] });
  assert.equal(prior.ok, true);
  if (!prior.ok) return;
  assert.equal(applyAction(prior.state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a3' }] }).ok, false);
});

test('Doppelganger copies Dubbing\'s preserved rook role, not knight geometry', () => {
  const setup = () => createGameState({
    fen: '4k2r/8/8/8/8/8/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: ['dubbing'] }, decks: { white: [], black: [] },
  });
  const afterDubbing = (state: ReturnType<typeof createGameState>) => {
    const dubbed = applyAction(state, {
      type: 'playCard', cardId: 'dubbing', target: [{ from: 'h8', to: 'f7' }],
    });
    assert.equal(dubbed.ok, true);
    if (!dubbed.ok) return undefined;
    const ended = applyAction(dubbed.state, { type: 'endTurn' });
    assert.equal(ended.ok, true);
    return ended.ok ? ended.state : undefined;
  };
  const valid = afterDubbing(setup());
  assert.ok(valid);
  assert.equal(applyAction(valid, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a3' }],
  }).ok, true);

  const invalid = afterDubbing(setup());
  assert.ok(invalid);
  assert.equal(applyAction(invalid, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'b3' }],
  }).ok, false);
});

test('Doppelganger copies a transformed unpromoted Pawn current rook geometry', () => {
  let state = createGameState({
    fen: '4k3/p7/8/8/8/8/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const transformed = state.pieces.find(piece => piece.square === 'a7');
  assert.ok(transformed);
  transformed.role = 'rook';
  assert.equal(transformed.originalRole, 'pawn');
  assert.equal(transformed.promoted, false);

  const moved = applyAction(state, { type: 'move', from: 'a7', to: 'a6' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  state = ended.state;

  const copied = applyAction(state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a3' }],
  });
  assert.equal(copied.ok, true);
  if (!copied.ok) return;
  const actor = copied.state.pieces.find(piece => piece.square === 'a3');
  assert.equal(actor?.role, 'rook');
  assert.equal(actor?.originalRole, 'rook');
});

test('Doppelganger keeps a transformed rook identity after a legal pawn move', () => {
  let state = createGameState({
    fen: '1p2k3/8/8/8/8/8/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: [] }, decks: { white: [], black: [] },
  });
  const transformed = state.pieces.find(piece => piece.square === 'b8');
  assert.ok(transformed);
  transformed.role = 'rook';
  assert.equal(transformed.originalRole, 'pawn');
  assert.equal(transformed.promoted, false);

  const moved = applyAction(state, { type: 'move', from: 'b8', to: 'b7' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  state = ended.state;

  const copied = applyAction(state, {
    type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a3' }],
  });
  assert.equal(copied.ok, true);
  if (!copied.ok) return;
  const actor = copied.state.pieces.find(piece => piece.square === 'a3');
  assert.equal(actor?.role, 'rook');
  assert.equal(actor?.originalRole, 'rook');
});

test('Doppelganger follows Long Jump while preserving the moved knight kind', () => {
  let state = createGameState({
    fen: '1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: ['long-jump'] }, decks: { white: [], black: [] },
  });
  const jumped = applyAction(state, { type: 'playCard', cardId: 'long-jump', target: [{ from: 'b8', to: 'd7' }] });
  assert.equal(jumped.ok, true);
  if (!jumped.ok) return;
  const ended = applyAction(jumped.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  state = ended.state;
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'c2' }] }).ok, true);
});

test('Doppelganger rejects copying a Madman-moved pawn', () => {
  let state = createGameState({
    fen: '4k3/8/8/8/3R4/2p5/8/R3K3 b - - 0 1',
    hands: { white: ['doppelganger'], black: ['madman'] }, decks: { white: [], black: [] },
  });
  const mad = applyAction(state, { type: 'playCard', cardId: 'madman', target: [{ from: 'c3', to: 'e5' }] });
  assert.equal(mad.ok, true);
  if (!mad.ok) return;
  const ended = applyAction(mad.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  state = ended.state;
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a2' }] }).ok, false);
});
