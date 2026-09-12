import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction, legalDests } from '../reducer';
import type { Color, GameAction, GameState, SquareName } from '../types';

type PawnCard = 'guardian' | 'annexation' | 'onslaught' | 'fanatic' | 'cowardice';
function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function compositeWindow(owner: Color, cardId: PawnCard, mixed = true) {
  const opponent: Color = owner === 'white' ? 'black' : 'white';
  const carrierOwner: Color = mixed ? opponent : owner;
  const from: SquareName = owner === 'white' ? 'c3' : 'c6';
  const pawnFrom: SquareName = owner === 'white' ? 'c2' : 'c7';
  const step = owner === 'white' ? 1 : -1;
  const forward = (distance: number) => `c${Number(from[1]) + distance * step}` as SquareName;
  let state = createGameState({
    fen: owner === 'white'
      ? `7k/8/8/8/8/2${mixed ? 'n' : 'N'}5/2P5/7K w - - 0 1`
      : `7k/2p5/2${mixed ? 'N' : 'n'}5/8/8/8/8/7K b - - 0 1`,
    hands: { [owner]: ['neutrality', 'confabulation', cardId] },
  });
  state = act(state, { type: 'move', from: owner === 'white' ? 'h1' : 'h8', to: owner === 'white' ? 'g1' : 'g8' });
  if (mixed) state = act(state, { type: 'playCard', cardId: 'neutrality', target: from });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: opponent === 'white' ? 'h1' : 'h8', to: opponent === 'white' ? 'g1' : 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: pawnFrom, to: from }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: opponent === 'white' ? 'g1' : 'g8', to: opponent === 'white' ? 'h1' : 'h8' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get(from)?.includes(forward(1)), 'ordinary movement retains the original Pawn direction');
  return { state, owner, carrierOwner, cardId, from, forward,
    pawnId: `${owner}-pawn-${pawnFrom}`, carrierId: `${carrierOwner}-knight-${from}` };
}

// REGRESSION_TESTS: Pawn powers keep the original Pawn component's direction after a mixed-owner merge.
// Sources: rules 13.4, 13.5, 13.7; Guardian's card text; rules 15.1 and 15.4.
// Symptom: these Pawn powers follow the carrier's color instead of the original Pawn's owner.
const distances: Record<PawnCard, number> = { guardian: 1, annexation: 2, onslaught: 1, fanatic: 3, cowardice: 1 };
for (const owner of ['white', 'black'] as const) {
  for (const cardId of ['guardian', 'annexation', 'onslaught', 'fanatic'] as const) {
    for (const mixed of [true, false]) {
      test(`${cardId}: ${owner} Pawn forward with ${mixed ? 'mixed' : 'same'}-owner carrier`, () => {
        const f = compositeWindow(owner, cardId, mixed);
        const before = structuredClone(f.state);
        const result = applyAction(f.state, { type: 'playCard', cardId,
          target: cardId === 'fanatic' ? f.from : [{ from: f.from, to: f.forward(distances[cardId]) }] });
        assert.deepEqual(f.state, before, 'the input remains unchanged');
        assert.ok(result.ok, result.ok ? '' : result.error.message);
        assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
        const carrier = result.state.pieces.find(piece => piece.id === f.carrierId);
        const pawn = result.state.pieces.find(piece => piece.id === f.pawnId);
        assert.ok(carrier);
        assert.ok(pawn);
        assert.equal(carrier.square, f.forward(distances[cardId]));
        assert.equal(carrier.zone, 'board');
        assert.equal(pawn.id, f.pawnId);
        assert.equal(pawn.owner, owner);
        assert.notEqual(pawn.zone, 'board', 'the Pawn remains a hidden component');
        assert.equal(pawn.square, null);
        assert.equal(result.state.fen.split(' ')[4], '0', 'a Pawn move resets the halfmove clock');
        assert.equal(result.state.turn.cardPlays[owner], before.turn.cardPlays[owner] + 1);
      });
    }
  }
  for (const cardId of ['guardian', 'annexation', 'onslaught'] as const) {
    test(`${cardId}: ${owner} Pawn rejects carrier-colored reverse movement`, () => {
      const f = compositeWindow(owner, cardId);
      const before = structuredClone(f.state);
      const result = applyAction(f.state, { type: 'playCard', cardId,
        target: [{ from: f.from, to: f.forward(-distances[cardId]) }] });
      assert.deepEqual(f.state, before, 'the input remains unchanged');
      assert.equal(result.ok, false, 'the original Pawn cannot move backward');
      assert.deepEqual(result.state, before, 'rejection is atomic');
    });
  }
}

// REGRESSION_TESTS: Cowardice must retreat according to the original Pawn owner's direction.
// Sources: rule 13.11 (backward movement), 15.1 (Neutrality), and 15.4 (composites).
// Symptom: a mixed-owner composite incorrectly retreats according to its carrier's color.
for (const owner of ['white', 'black'] as const) {
  test(`cowardice: ${owner} Pawn retreats with a mixed-owner carrier`, () => {
    const f = compositeWindow(owner, 'cowardice');
    let state = act(f.state, { type: 'move', from: owner === 'white' ? 'g1' : 'g8', to: owner === 'white' ? 'h1' : 'h8' });
    state = act(state, { type: 'playCard', cardId: 'cowardice', target: [{ from: f.from, to: f.forward(-1) }] });
    const carrier = state.pieces.find(piece => piece.id === f.carrierId);
    const pawn = state.pieces.find(piece => piece.id === f.pawnId);
    assert.ok(carrier);
    assert.ok(pawn);
    assert.equal(carrier.zone, 'board');
    assert.equal(carrier.square, f.forward(-1));
    assert.equal(pawn.owner, owner);
    assert.notEqual(pawn.zone, 'board', 'the Pawn remains a hidden component');
    assert.equal(pawn.square, null);
  });
}

test('cowardice: White retreats an ordinary Black Pawn in the Black backward direction', () => {
  let state = createGameState({ fen: '7k/8/8/2p5/8/8/8/7K w - - 0 1', hands: { white: ['cowardice'] } });
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  state = act(state, { type: 'playCard', cardId: 'cowardice', target: [{ from: 'c5', to: 'c6' }] });
  const pawn = state.pieces.find(piece => piece.id === 'black-pawn-c5');
  assert.ok(pawn);
  assert.equal(pawn.owner, 'black');
  assert.equal(pawn.zone, 'board');
  assert.equal(pawn.square, 'c6');
});
