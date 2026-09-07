import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, PieceState, SquareName } from '../types.js';

const victims: SquareName[] = ['b5', 'f5', 'c6', 'e6'];
const fixture = () => createGameState({
  fen: '7k/8/2p1p3/1p3p2/3N4/8/8/K7 w - - 11 3',
  hands: { white: ['split-knight'] },
});
const play = (state: GameState, targets: SquareName[]) =>
  applyAction(state, { type: 'playCard', cardId: 'split-knight', target: { knight: 'd4', targets } });

test('Split Knight discovers every legal subset of four victims', () => {
  const targets = cardPlayTargets(fixture(), 'split-knight');
  const expected = Array.from({ length: 16 }, (_, mask) => victims.filter((_, i) => mask & (1 << i)))
    .filter(squares => squares.length >= 2)
    .map(squares => squares.slice().sort().join(','));
  const actual = targets.map(target => {
    const selection = target as { knight: string; targets: SquareName[] };
    assert.equal(selection.knight, 'd4');
    return selection.targets.slice().sort().join(',');
  });
  assert.deepEqual(actual.sort(), expected.sort());
});

test('Split Knight records the physical capture IDs without an arrival move', () => {
  const state = fixture();
  const expectedIds = state.pieces.filter(piece => ['d4', 'b5', 'f5'].includes(piece.square ?? '')).map(piece => piece.id);
  const result = play(state, ['b5', 'f5']);
  assert.equal(result.ok, true);
  const event = result.state.history.at(-1)!;
  assert.equal(event.type, 'cardPlayed');
  assert.deepEqual(event.capturedIds?.slice().sort(), expectedIds.sort());
  assert.equal(event.movement?.length ?? 0, 0);
  assert.equal(event.movedPieceId, undefined);
});

for (const count of [2, 3, 4]) {
  test(`Split Knight accepts a ${count}-victim subset and preserves unselected identities`, () => {
    const state = fixture();
    const selected = victims.slice(0, count);
    const result = play(state, selected);
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    for (const piece of state.pieces) {
      const next: PieceState = result.state.pieces.find(candidate => candidate.id === piece.id)!;
      if (piece.square === 'd4' || selected.includes(piece.square!)) {
        assert.equal(next.zone, 'captured');
        assert.equal(next.square, null);
      } else assert.deepEqual(next, piece);
    }
  });
}

test('Split Knight rejects a pinned source before spending its card', () => {
  const state = createGameState({
    fen: '3r3k/8/8/1p3p2/3N4/8/8/3K4 w - - 0 1',
    hands: { white: ['split-knight'] },
  });
  assert.deepEqual(cardPlayTargets(state, 'split-knight'), []);
  const result = play(state, ['b5', 'f5']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Split Knight permits a neutral opposing Knight and neutral victim', () => {
  const state = fixture();
  const source = state.pieces.find(piece => piece.square === 'd4')!;
  source.neutral = true;
  source.owner = 'black';
  state.pieces.find(piece => piece.square === 'b5')!.neutral = true;
  state.fen = `${boardFen(state)} ${state.fen.split(' ').slice(1).join(' ')}`;
  const result = play(state, ['b5', 'f5']);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.pieces.find(piece => piece.id === source.id)?.zone, 'captured');
});

test('Split Knight rejects transformed royal source and victim identities atomically', () => {
  const royalSource = createGameState({
    fen: '7k/8/8/1p3p2/3K4/8/8/R7 w - - 0 1', hands: { white: ['split-knight'] },
  });
  royalSource.pieces.find(piece => piece.square === 'd4')!.role = 'knight';
  const royalVictim = createGameState({
    fen: '8/8/8/1k3p2/3N4/8/8/K7 w - - 0 1', hands: { white: ['split-knight'] },
  });
  royalVictim.pieces.find(piece => piece.square === 'b5')!.role = 'pawn';
  for (const state of [royalSource, royalVictim]) {
    state.fen = `${boardFen(state)} ${state.fen.split(' ').slice(1).join(' ')}`;
    const result = play(state, ['b5', 'f5']);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
});

test('Split Knight removes only the captured Rook castling right', () => {
  const state = createGameState({
    fen: 'r1b1k2r/8/1N6/8/8/8/8/4K3 w kq - 0 1', hands: { white: ['split-knight'] },
  });
  const result = applyAction(state, { type: 'playCard', cardId: 'split-knight', target: { knight: 'b6', targets: ['a8', 'c8'] } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.fen.split(' ')[2], 'k');
});

test('Split Knight captures both components of an actual Confabulation source', () => {
  let state = createGameState({
    fen: '7k/8/8/1p3p2/3N4/8/3R4/K7 w - - 0 1',
    hands: { white: ['confabulation', 'split-knight'] },
  });
  const componentIds = state.pieces.filter(piece => ['d2', 'd4'].includes(piece.square ?? '')).map(piece => piece.id);
  for (const action of [
    { type: 'playCard', cardId: 'confabulation', target: [{ from: 'd2', to: 'd4' }] },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'endTurn' },
  ] satisfies GameAction[]) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, JSON.stringify(action));
    state = result.state;
  }
  assert.equal(state.pieces.filter(piece => componentIds.includes(piece.id) && piece.zone === 'away').length, 1);
  assert.equal(state.pieces.filter(piece => componentIds.includes(piece.id) && piece.square === 'd4').length, 1);
  const result = play(state, ['b5', 'f5']);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  for (const id of componentIds) assert.equal(result.state.pieces.find(piece => piece.id === id)?.zone, 'captured');
  assert.equal(result.state.history.at(-1)?.capturedIds?.length, 4);
});

test('Split Knight spends once and resets the capture clock for a triple', () => {
  const result = play(fixture(), ['b5', 'f5', 'c6']);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.players.white.hand.length, 0);
  assert.equal(result.state.players.white.discard.length, 1);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.fen.split(' ')[4], '0');
});
