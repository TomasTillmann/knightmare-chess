import assert from "node:assert/strict";
import test from "node:test";
import { CARD_CATALOG } from './catalog.js';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import type { GameState, GameAction, Color } from '../types.js';

function success(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? 'action succeeds' : result.error.message);
  return result.state;
}

function ready(owner: Color = 'white') {
  return createGameState({ turn: owner, phase: 'afterMove', moveMade: true,
    hands: { [owner]: ['truce', 'truce'] }, decks: { [owner]: ['panic'] } });
}

function active(fen: string, owner: Color = 'white'): GameState {
  const played = success(ready(owner), { type: 'playCard', cardId: 'truce' });
  return { ...createGameState({ fen }), effects: played.effects,
    players: played.players };
}

function rejected(state: GameState, action: GameAction, code?: string) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (!result.ok && code) assert.equal(result.error.code, code);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

test("Truce costs 5 points", () => {
  assert.equal(CARD_CATALOG.truce?.points, 5);
  assert.equal(CARD_CATALOG.truce?.id, 'truce');
  assert.equal(CARD_CATALOG.truce?.name, 'Truce');
  assert.equal(CARD_CATALOG.truce?.image, '/KC9_card2.png');
});

test("Truce is continuing and not unique", () => {
  assert.equal(CARD_CATALOG.truce?.unique, false);
  assert.equal(CARD_CATALOG.truce?.continuing, true);
  assert.deepEqual(CARD_CATALOG.truce?.timing, ['afterMove']);
});

test("Truce may be played after a move", () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { white: ['truce'] } });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'truce' }).ok, true);
});

test('Truce rejects before-move and inconsistent timing atomically', () => {
  for (const [phase, moveMade] of [['beforeMove', false], ['beforeMove', true], ['afterMove', false]] as const) {
    const state = createGameState({ phase, moveMade, hands: { white: ['truce'] } });
    rejected(state, { type: 'playCard', cardId: 'truce' }, 'INVALID_TIMING');
  }
});

test('Truce consumes the acting player card allowance', () => {
  for (const owner of ['white', 'black'] as const) {
    const state = ready(owner);
    const played = success(state, { type: 'playCard', cardId: 'truce' });
    assert.equal(played.turn.cardPlays[owner], 1);
    rejected(played, { type: 'playCard', cardId: 'truce' }, 'CARD_ALREADY_PLAYED');
  }
});

test('Truce validates exact physical card ownership and presence atomically', () => {
  const state = ready();
  for (const cardInstanceId of ['missing', 'black-hand-0-truce', 3, null]) {
    rejected(state, { type: 'playCard', cardId: 'truce', cardInstanceId });
  }
  const absent = createGameState({ phase: 'afterMove', moveMade: true });
  rejected(absent, { type: 'playCard', cardId: 'truce' }, 'CARD_NOT_IN_HAND');
});

test('Truce rejects target payloads atomically', () => {
  for (const target of ['e4', ['a1'], { square: 'e4' }, 1]) {
    rejected(ready(), { type: 'playCard', cardId: 'truce', target }, 'INVALID_TARGET');
  }
});

test('Truce forbids ordinary captures by either owner while allowing quiet moves', () => {
  for (const owner of ['white', 'black'] as const) {
    for (const [fen, from, capture, quiet] of [
      ['7k/8/8/8/8/p7/R7/7K w - - 0 1', 'a2', 'a3', 'b2'],
      ['7k/r7/P7/8/8/8/8/7K b - - 0 1', 'a7', 'a6', 'b7'],
    ] as const) {
      const state = active(fen, owner);
      assert.ok(!legalDests(state).get(from)?.includes(capture));
      assert.ok(legalDests(state).get(from)?.includes(quiet));
      rejected(state, { type: 'move', from, to: capture }, 'ILLEGAL_MOVE');
      assert.equal(success(state, { type: 'move', from, to: quiet }).pieces.filter(p => p.zone === 'captured').length, 0);
    }
  }
});

test('Truce forbids en-passant captures in both directions', () => {
  for (const [fen, from, to] of [
    ['7k/8/8/3pP3/8/8/8/7K w - d6 0 1', 'e5', 'd6'],
    ['7k/8/8/8/3Pp3/8/8/7K b - d3 0 1', 'e4', 'd3'],
  ] as const) {
    const state = active(fen);
    assert.equal(state.enPassant.length, 1);
    assert.ok(!legalDests(state).get(from)?.includes(to));
    rejected(state, { type: 'move', from, to }, 'ILLEGAL_MOVE');
  }
});

test('Active Truce suppresses geometrical threats against both Kings', () => {
  const state = active('r6k/8/8/8/8/8/8/K6R w - - 0 1');
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(isKingInCheck(state, 'black'), false);
});

test('Truce survives a quiet move and normal turn boundary', () => {
  const state = active('7k/8/8/8/8/8/R7/7K w - - 0 1');
  const moved = success(state, { type: 'move', from: 'a2', to: 'b2' });
  const ended = success(moved, { type: 'endTurn' });
  assert.deepEqual(ended.effects, state.effects);
  assert.equal(ended.turn.color, 'black');
  assert.equal(ended.turn.phase, 'beforeMove');
  assert.equal(ended.outcome, null);
});

test('Truce played after a checking move immediately expires to its owner discard', () => {
  for (const owner of ['white', 'black'] as const) {
    const fen = owner === 'white'
      ? '7k/8/8/8/8/8/8/K6R w - - 0 1'
      : 'r6k/8/8/8/8/8/8/K7 b - - 0 1';
    const state = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { [owner]: ['truce'] } });
    const card = state.players[owner].hand[0]!;
    const played = success(state, { type: 'playCard', cardId: 'truce' });
    assert.deepEqual(played.effects, []);
    assert.deepEqual(played.players[owner].discard, [card]);
    assert.equal(isKingInCheck(played, owner === 'white' ? 'black' : 'white'), true);
  }
});

test('Stalemate discards Truce, resets counting, and reopens legal captures', () => {
  const state = active('7k/8/8/8/8/ppp5/PP6/KP6 b - - 77 42', 'black');
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
  const effect = state.effects[0] as { card: { id: string; cardId: string } };
  const ended = success(state, { type: 'endTurn' });
  assert.deepEqual(ended.effects, []);
  assert.ok(ended.players.black.discard.some(card => card.id === effect.card.id));
  assert.equal(ended.fen.split(' ')[4], '0');
  assert.equal(ended.outcome, null);
  assert.ok(legalDests(ended).get('a2')?.includes('b3'));
});

test('Truce retains the selected duplicate in play and draws one replacement', () => {
  for (const owner of ['white', 'black'] as const) {
    const state = ready(owner);
    const [retained, selected] = state.players[owner].hand;
    const replacement = state.players[owner].deck[0]!;
    const played = success(state, { type: 'playCard', cardId: 'truce', cardInstanceId: selected!.id });
    assert.deepEqual(played.players[owner].hand, [retained, replacement]);
    assert.deepEqual(played.players[owner].deck, []);
    assert.deepEqual(played.players[owner].discard, []);
    assert.equal(played.effects.length, 1);
    assert.deepEqual(played.effects[0], { type: 'truce', owner, card: selected });
  }
});

test('Truce leaves input immutable and preserves board, turn, and previous history', () => {
  const state = success(createGameState({ hands: { white: ['truce'] } }), { type: 'move', from: 'e2', to: 'e4' });
  const before = structuredClone(state);
  const played = success(state, { type: 'playCard', cardId: 'truce' });
  assert.deepEqual(state, before);
  assert.equal(played.fen, before.fen);
  assert.deepEqual(played.pieces, before.pieces);
  assert.deepEqual(played.enPassant, before.enPassant);
  assert.equal(played.turn.color, before.turn.color);
  assert.equal(played.turn.phase, 'afterMove');
  assert.equal(played.turn.moveMade, true);
  assert.deepEqual(played.history.slice(0, -1), before.history);
  assert.equal(played.history.at(-1)?.type, 'cardPlayed');
  assert.equal(played.history.at(-1)?.cardId, 'truce');
});
