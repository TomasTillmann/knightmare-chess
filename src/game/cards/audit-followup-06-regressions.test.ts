import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;

function neutralize(state: State, square: string): State {
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === square ? { ...piece, neutral: true } : piece),
  };
}

describe('follow-up adversarial audit regressions', () => {
  it('rejects nullish public actions atomically', () => {
    for (const action of [null, undefined]) {
      const state = createGameState();
      const snapshot = structuredClone(state);
      const result = applyAction(state, action as never);

      assert.equal(result.ok, false);
      assert.deepEqual(result.state, snapshot);
      assert.deepEqual(state, snapshot);
    }
  });

  it('rejects playCard-shaped actions without the playCard discriminator', () => {
    const options = {
      fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1',
      hands: { white: ['disintegration'], black: [] },
      decks: { white: [], black: [] },
    };

    for (const action of [
      { type: 'unknown', cardId: 'disintegration', target: 'a2' },
      { cardId: 'disintegration', target: 'a2' },
    ]) {
      const state = createGameState(options);
      const snapshot = structuredClone(state);
      const result = applyAction(state, action as never);

      assert.equal(result.ok, false);
      assert.strictEqual(result.state, state);
      assert.deepEqual(result.state, snapshot);
      assert.deepEqual(state, snapshot);
    }

    const result = applyAction(createGameState(options), {
      type: 'playCard', cardId: 'disintegration', target: 'a2',
    });
    if (!result.ok) assert.fail(result.error.code);
    assert.equal(result.ok, true);
    assert.equal(result.state.players.white.hand.length, 0);
    assert.equal(result.state.pieces.find(piece => piece.square === 'a2'), undefined);
  });

  it('uses the Coup replacement as royal and treats the original King as an ordinary Prince', () => {
    const seeded = createGameState({ fen: '4r2k/8/8/8/8/8/1P6/R3K3 w - - 0 1' });
    const state: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'e1'
        ? { ...piece, royal: false }
        : piece.square === 'a1' ? { ...piece, royal: true } : piece),
    };

    assert.deepEqual({
      legal: legalDests(state).get('b2')?.includes('b3') ?? false,
      moved: applyAction(state, { type: 'move', from: 'b2', to: 'b3' }).ok,
    }, { legal: true, moved: true });
  });

  it('does not treat a pinned neutral piece as checking a King', () => {
    const state = neutralize(createGameState({
      fen: '2K1k3/4N3/8/8/8/8/8/4R3 w - - 0 1',
      phase: 'afterMove',
      moveMade: true,
    }), 'e7');

    const result = applyAction(state, { type: 'endTurn' });
    assert.equal(result.ok, true);
  });

  it('allows castling through a square attacked by a neutral piece when the King lands safely', () => {
    const state = neutralize(
      createGameState({ fen: '4k3/8/8/8/8/8/3N4/4K2R w K - 0 1' }),
      'd2',
    );
    const result = applyAction(state, { type: 'move', from: 'e1', to: 'g1' });

    assert.deepEqual({
      listed: legalDests(state).get('e1')?.includes('g1') ?? false,
      moved: result.ok,
      error: result.ok ? undefined : result.error.code,
    }, { listed: true, moved: true, error: undefined });
    assert.equal(applyAction(result.state, { type: 'endTurn' }).ok, true);
  });

  it('rotates ordinary Pawn movement with the board orientation', () => {
    const state: State = {
      ...createGameState({ fen: '7k/8/8/8/1P6/8/8/K7 w - - 0 1' }),
      orientation: 90,
    };
    const destinations = legalDests(state).get('b4') ?? [];
    const rotated = applyAction(state, { type: 'move', from: 'b4', to: 'c4' });
    const unrotated = applyAction(state, { type: 'move', from: 'b4', to: 'b5' });

    assert.deepEqual({
      rotatedListed: destinations.includes('c4'),
      unrotatedListed: destinations.includes('b5'),
      rotatedMoved: rotated.ok,
      unrotatedMoved: unrotated.ok,
    }, {
      rotatedListed: true,
      unrotatedListed: false,
      rotatedMoved: true,
      unrotatedMoved: false,
    });
  });
});
