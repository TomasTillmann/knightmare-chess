import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

function play(state: State, action: Action): State {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}

function setup(reaction: string, holder: 'white' | 'black' = 'white', copies = 1) {
  const opponent: 'white' | 'black' = holder === 'white' ? 'black' : 'white';
  const firstRank = holder === 'white' ? '2' : '7';
  const firstTo = holder === 'white' ? '4' : '5';
  const secondRank = holder === 'white' ? '7' : '2';
  const secondTo = holder === 'white' ? '5' : '4';
  let state = createGameState({
    fen: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR ${holder === 'white' ? 'w' : 'b'} KQkq - 0 1`,
    hands: { [holder]: Array(copies).fill('haunting-memories'), [opponent]: [reaction] },
  });
  const originals = structuredClone(state.players);
  state = play(state, { type: 'move', from: `e${firstRank}`, to: `e${firstTo}` });
  state = play(state, { type: 'playCard', cardId: reaction });
  state = play(state, { type: 'move', from: `d${firstRank}`, to: `d${firstTo}` });
  state = play(state, { type: 'endTurn' });
  const before = state;
  const canceled: Action = { type: 'move', from: `e${secondRank}`, to: `e${secondTo}` };
  state = play(state, canceled);
  return { state, before, originals, holder, opponent, canceled };
}

for (const reaction of ['chaos', 'knightmare']) {
  for (const holder of ['white', 'black'] as const) {
    test(`${holder} Haunting Memories copies opposing ${reaction} and restores the latest move`, () => {
      const fixture = setup(reaction, holder);
      let state = play(fixture.state, { type: 'playCard', cardId: 'haunting-memories' });
      const event = state.history.at(-1);
      assert.equal(event?.type, 'cardPlayed');
      assert.equal(event?.copiedCardId, reaction);
      assert.equal(event?.player, holder);
      assert.equal(state.fen, fixture.before.fen);
      assert.deepEqual(state.pieces, fixture.before.pieces);
      assert.deepEqual(state.players[holder].discard, fixture.originals[holder].hand);
      assert.deepEqual(state.players[fixture.opponent].discard, fixture.originals[fixture.opponent].hand);
      assert.equal(state.turn.color, fixture.opponent);
      assert.equal(state.turn.moveMade, false);
      assert.equal(state.turn.cardPlays[holder], 1);
      const repeat = applyAction(state, fixture.canceled);
      assert.equal(repeat.ok, false);
      assert.deepEqual(repeat.state, state);
      state = play(state, { type: 'move', from: holder === 'white' ? 'd7' : 'd2', to: holder === 'white' ? 'd5' : 'd4' });
      assert.equal(state.turn.moveMade, true);
    });
  }

  test(`copied ${reaction} spends the selected physical Haunting Memories only`, () => {
    const fixture = setup(reaction, 'white', 2);
    const [retained, selected] = fixture.originals.white.hand;
    const state = play(fixture.state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: selected.id });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.history.at(-1)?.copiedCardId, reaction);
    assert.deepEqual(state.players.white.hand, [retained]);
    assert.deepEqual(state.players.white.discard, [selected]);
    assert.deepEqual(state.players.black.discard, fixture.originals.black.hand);
    assert.equal(state.fen, fixture.before.fen);
  });
}

test('Haunting Memories copying Knightmare rejects an invalid cancellation payload atomically', () => {
  const { state } = setup('knightmare');
  const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories', target: { returnCard: 'yes' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('copied Knightmare charges its holder now and releases allowance on the following turn', () => {
  const fixture = setup('knightmare');
  let state = play(fixture.state, { type: 'playCard', cardId: 'haunting-memories', target: { returnCard: false } });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.turn.cardPlays.black, 0);
  state = play(state, { type: 'move', from: 'd7', to: 'd5' });
  state = play(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.cardPlays.white, 0);
  assert.deepEqual(state.players.white.discard, fixture.originals.white.hand);
});
