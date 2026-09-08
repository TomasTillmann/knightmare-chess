import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { activeDoomsayers, applyAction, isKingInCheck } from '../reducer';
import { createGameState, type CreateGameOptions } from '../state';
import type { Color, GameAction, GameState } from '../types';

const cases = [
  { color: 'white', opponent: 'black', fen: '1k2q2n/8/8/8/8/8/R7/4K3 w - - 0 1', safeFen: '1k2q2n/8/8/8/8/8/4R3/4K3 w - - 0 1', from: 'a2', to: 'a3', queen: 'e8', knight: 'h8', replacement: 'e2' },
  { color: 'black', opponent: 'white', fen: '4k3/r7/8/8/8/8/8/1K2Q2N b - - 0 1', safeFen: '4k3/4r3/8/8/8/8/8/1K2Q2N b - - 0 1', from: 'a7', to: 'a6', queen: 'e1', knight: 'h1', replacement: 'e7' },
] as const;
type Fixture = typeof cases[number];

function act(state: GameState, action: GameAction): GameState {
  const original = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, original, 'public action must not mutate its input');
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

function start(f: Fixture): GameState {
  return createGameState({ fen: f.fen, hands: { [f.color]: ['doomsayer', 'fortification'] }, decks: { [f.color]: ['fanatic'] } });
}

function moved(f: Fixture): GameState {
  const before = start(f);
  assert.ok(isKingInCheck(before, f.color));
  assert.ok(!isKingInCheck(before, f.opponent));
  const result = act(before, { type: 'move', from: f.from, to: f.to });
  assert.ok(result.pendingRescue);
  assert.ok(isKingInCheck(result, f.color));
  return result;
}

function offered(f: Fixture): GameState {
  const state = moved(f);
  // Staged public-state fixture isolates the response handler from the known
  // premature offer fizzle; the actual reachable offer is tested separately.
  const result = act({ ...state, pendingRescue: null }, { type: 'playCard', cardId: 'doomsayer' });
  assert.equal(result.pendingDoomsayer?.player, f.opponent);
  return { ...result, pendingRescue: state.pendingRescue };
}

function spentOnce(state: GameState, color: Color): void {
  assert.equal(state.turn.cardPlays[color], 1);
  assert.equal(state.players[color].hand.filter(card => card.cardId === 'doomsayer').length, 0);
  assert.equal(state.players[color].hand.filter(card => card.cardId === 'fanatic').length, 1);
  assert.equal(state.players[color].deck.length, 0);
}

function rolledBack(state: GameState, f: Fixture): void {
  assert.deepEqual(state.pieces, start(f).pieces, 'failed complete rescue restores every piece');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.ok(!state.pendingRescue);
  assert.ok(!state.pendingDoomsayer);
  assert.equal(activeDoomsayers(state).length, 0);
  assert.equal(state.players[f.color].discard.filter(card => card.cardId === 'doomsayer').length, 1);
  spentOnce(state, f.color);
  assert.equal(state.outcome, null);
  const replacement = act(state, { type: 'move', from: f.from, to: f.replacement });
  assert.ok(!isKingInCheck(replacement, f.color));
  const ended = act(replacement, { type: 'endTurn' });
  assert.equal(ended.turn.color, f.opponent);
}

for (const f of cases) {
  for (const beginsChecked of [true, false]) {
    test(`${f.color}: Doomsayer alone permits and completes a move ${beginsChecked ? 'remaining in' : 'exposing'} check`, () => {
      const before = createGameState({ fen: beginsChecked ? f.fen : f.safeFen, hands: { [f.color]: ['doomsayer'] }, decks: { [f.color]: ['fanatic'] } });
      assert.equal(isKingInCheck(before, f.color), beginsChecked);
      assert.ok(!isKingInCheck(before, f.opponent));
      const movedState = act(before, { type: 'move', from: beginsChecked ? f.from : f.replacement, to: beginsChecked ? f.to : f.color === 'white' ? 'd2' : 'd7' });
      assert.ok(movedState.pendingRescue);
      const offer = act(movedState, { type: 'playCard', cardId: 'doomsayer' });
      assert.equal(offer.pendingDoomsayer?.player, f.opponent);
      const queen = offer.pieces.find(piece => piece.square === f.queen)!;
      const rescued = act(offer, { type: 'namePiece', speaker: f.opponent, name: 'queen', losses: [{ effectId: offer.pendingDoomsayer!.cardInstanceId, pieceId: queen.id }] });
      assert.ok(!isKingInCheck(rescued, f.color));
      assert.ok(!rescued.pendingRescue);
      spentOnce(rescued, f.color);
      assert.equal(act(rescued, { type: 'endTurn' }).turn.color, f.opponent);
    });
  }

  test(`${f.color}: ordinary safe offer remains optional and continuing`, () => {
    const state = createGameState({ fen: f.safeFen, hands: { [f.color]: ['doomsayer'] }, decks: { [f.color]: ['fanatic'] } });
    state.turn.phase = 'afterMove';
    state.turn.moveMade = true;
    const result = act(state, { type: 'playCard', cardId: 'doomsayer' });
    assert.equal(result.pendingDoomsayer?.player, f.opponent);
    assert.equal(activeDoomsayers(result).length, 1);
    const declined = act(result, { type: 'declineDoomsayer', player: f.opponent });
    assert.ok(!declined.pendingDoomsayer);
    assert.equal(activeDoomsayers(declined).length, 1);
    assert.deepEqual(declined.pieces, state.pieces);
    spentOnce(declined, f.color);
    assert.equal(act(declined, { type: 'endTurn' }).turn.color, f.opponent);
  });

  test(`${f.color}: provisional checked move keeps its offered response`, () => {
    const state = moved(f);
    const result = act(state, { type: 'playCard', cardId: 'doomsayer' });
    assert.equal(result.pendingDoomsayer?.player, f.opponent);
    assert.ok(result.pendingRescue);
    assert.deepEqual(result.pieces, state.pieces);
    assert.equal(result.history.some(event => event.type === 'cardFizzled'), false);
    assert.equal(result.turn.phase, 'afterMove');
    spentOnce(result, f.color);
  });

  test(`${f.color}: loss of checking queen completes rescue and allows endTurn`, () => {
    const state = offered(f);
    const queen = state.pieces.find(piece => piece.square === f.queen)!;
    const result = act(state, { type: 'namePiece', speaker: f.opponent, name: 'queen', losses: [{ effectId: state.pendingDoomsayer!.cardInstanceId, pieceId: queen.id }] });
    assert.equal(result.pieces.find(piece => piece.id === queen.id)?.zone, 'captured');
    assert.equal(result.pieces.find(piece => piece.id === queen.id)?.capturedBy, f.color);
    assert.equal(result.pieces.find(piece => piece.id === queen.id)?.square, null);
    assert.deepEqual(result.pieces.filter(piece => piece.id !== queen.id), state.pieces.filter(piece => piece.id !== queen.id));
    assert.ok(!isKingInCheck(result, f.color));
    assert.ok(!result.pendingRescue);
    assert.ok(!result.pendingDoomsayer);
    assert.equal(activeDoomsayers(result).length, 0);
    spentOnce(result, f.color);
    assert.equal(act(result, { type: 'endTurn' }).turn.color, f.opponent);
  });

  test(`${f.color}: declining a necessary rescue restores a replacement move and spends the card`, () => {
    rolledBack(act(offered(f), { type: 'declineDoomsayer', player: f.opponent }), f);
  });

  test(`${f.color}: unrelated valid loss cannot cure check and is restored with the move`, () => {
    const state = offered(f);
    const knight = state.pieces.find(piece => piece.square === f.knight)!;
    rolledBack(act(state, { type: 'namePiece', speaker: f.opponent, name: 'knight', losses: [{ effectId: state.pendingDoomsayer!.cardInstanceId, pieceId: knight.id }] }), f);
  });

  test(`${f.color}: malformed role and identity preserve the offered choice for retry`, () => {
    const state = offered(f);
    const queen = state.pieces.find(piece => piece.square === f.queen)!;
    for (const choice of [{ name: 'rook', pieceId: queen.id }, { name: 'queen', pieceId: 'missing-piece' }] as const) {
      const original = structuredClone(state);
      const result = applyAction(state, { type: 'namePiece', speaker: f.opponent, name: choice.name, losses: [{ effectId: state.pendingDoomsayer!.cardInstanceId, pieceId: choice.pieceId }] });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, original);
      assert.deepEqual(state, original);
    }
    const retried = act(state, { type: 'namePiece', speaker: f.opponent, name: 'queen', losses: [{ effectId: state.pendingDoomsayer!.cardInstanceId, pieceId: queen.id }] });
    assert.ok(!retried.pendingDoomsayer);
    assert.ok(!isKingInCheck(retried, f.color));
  });
}

test('Doomsayer offers its immediate response before settling the checked Regular Move', () => {
  const replay = JSON.parse(readFileSync(new URL('../../../campaign/iterations/116.json', import.meta.url), 'utf8')) as { initial: CreateGameOptions; steps: { action: GameAction }[] };
  let before = createGameState(replay.initial);
  for (const { action } of replay.steps.slice(0, 77)) before = act(before, action);
  const moved = applyAction(before, { type: 'move', from: 'd8', to: 'd7' });
  assert.ok(moved.ok);
  const result = applyAction(moved.state, { type: 'playCard', cardId: 'doomsayer' });
  assert.ok(result.ok);
  assert.equal(result.state.pendingDoomsayer?.player, 'white');
});
