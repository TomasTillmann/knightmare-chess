import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions do not mutate their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function neutral(fen = '7k/8/8/8/3n4/8/P7/7K w - - 7 3', target = 'd4') {
  let state = createGameState({ fen, hands: { white: ['neutrality', 'pacifism', 'disintegration', 'dubbing', 'crab'], black: ['peace-talks', 'neutrality'] } });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'playCard', cardId: 'neutrality', target });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pieces.find(piece => piece.square === target)?.neutral, true);
  return state;
}

function nextPlayer(state: GameState, player: 'white' | 'black') {
  state = act(state, { type: 'endTurn' });
  if (player === 'white') {
    state = act(state, { type: 'move', from: 'h8', to: 'g8' });
    state = act(state, { type: 'endTurn' });
  }
  return state;
}

for (const player of ['white', 'black'] as const) {
  test(`Neutrality allows ${player} to move the same black Knight`, () => {
    let state = nextPlayer(neutral(), player);
    state = act(state, { type: 'move', from: 'd4', to: 'c6' });
    assert.equal(state.pieces.find(piece => piece.id === 'black-knight-d4')?.square, 'c6');
    assert.equal(state.pieces.find(piece => piece.id === 'black-knight-d4')?.neutral, true);
    assert.equal(state.effects.length, 1);
  });

  for (const pawn of ['P', 'p']) {
    test(`Neutrality allows ${player} to capture ${pawn === 'P' ? 'white' : 'black'} with a black Knight`, () => {
      let state = nextPlayer(neutral(`7k/8/2${pawn}5/8/3n4/8/P7/7K w - - 7 3`), player);
      const victim = state.pieces.find(piece => piece.square === 'c6')!.id;
      state = act(state, { type: 'move', from: 'd4', to: 'c6' });
      assert.equal(state.pieces.find(piece => piece.id === victim)?.zone, 'captured');
      assert.equal(state.pieces.find(piece => piece.id === 'black-knight-d4')?.neutral, true);
    });
  }

  test(`Neutral Pawn retains black forward direction when moved by ${player}`, () => {
    let state = nextPlayer(neutral('7k/8/8/8/3p4/8/P7/7K w - - 7 3'), player);
    assert.ok(legalDests(state, false).get('d4')?.includes('d3'));
    assert.ok(!legalDests(state, false).get('d4')?.includes('d5'));
    state = act(state, { type: 'move', from: 'd4', to: 'd3' });
    assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.owner, 'black');
  });
}

test('Peace Talks actually cancels Neutrality after its piece moves', () => {
  let state = nextPlayer(neutral(), 'black');
  state = act(state, { type: 'move', from: 'd4', to: 'c6' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-neutrality' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-d4')?.neutral, false);
  assert.equal(state.effects.length, 0);
  assert.ok(state.players.white.discard.some(card => card.id === 'white-hand-0-neutrality'));
  state = act(state, { type: 'endTurn' });
  assert.equal(legalDests(state, false).has('c6'), false);
});

test('Capturing a neutral physical piece expires and discards its marker', () => {
  let state = nextPlayer(neutral('7k/8/8/8/3n4/8/P7/3R3K w - - 7 3'), 'white');
  state = act(state, { type: 'move', from: 'd1', to: 'd4' });
  const piece = state.pieces.find(candidate => candidate.id === 'black-knight-d4')!;
  assert.equal(piece.zone, 'captured');
  assert.equal(piece.owner, 'black');
  assert.equal(piece.neutral, false);
  assert.equal(state.effects.length, 0);
  assert.ok(state.players.white.discard.some(card => card.id === 'white-hand-0-neutrality'));
});

test('Disintegration accepts a controlled neutral Pawn and expires Neutrality on death', () => {
  let state = nextPlayer(neutral('7k/8/8/8/3p4/8/P7/7K w - - 7 3'), 'white');
  state = act(state, { type: 'move', from: 'a3', to: 'a4' });
  state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'd4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.zone, 'dead');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.neutral, false);
  assert.equal(state.effects.length, 0);
});

test('Friendly Pacifism can target the neutral opponent-owned Knight', () => {
  let state = nextPlayer(neutral('7k/8/2p5/8/3n4/8/P7/7K w - - 7 3'), 'white');
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'd4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.effects.length, 2);
  assert.ok(!legalDests(state, false).get('d4')?.includes('c6'));
});

test('Dubbing relocates a neutral Pawn without losing its marker', () => {
  let state = nextPlayer(neutral('7k/8/8/8/3p4/8/P7/7K w - - 7 3'), 'white');
  state = act(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'd4', to: 'c6' }] });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.square, 'c6');
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.neutral, true);
  assert.equal(state.effects.length, 1);
});

test('Crab transformation preserves the neutral physical Pawn marker', () => {
  let state = nextPlayer(neutral('7k/8/8/8/3p4/8/P7/7K w - - 7 3'), 'white');
  state = act(state, { type: 'move', from: 'a3', to: 'a4' });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'd4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.effects.length, 2);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd4', to: 'e3' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-d4')?.neutral, true);
});

test('Neutrality may stack on an already neutral originally friendly piece', () => {
  let state = nextPlayer(neutral(), 'black');
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'playCard', cardId: 'neutrality', target: 'd4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.effects.length, 2);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a3', to: 'a4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g8', to: 'h8' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-neutrality' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.effects.length, 1);
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-d4')?.neutral, true);
});

for (let seed = 1; seed <= 20; seed++) {
  test(`Neutrality seeded legal integration ${seed}`, () => {
    let state = neutral();
    const ids = state.pieces.map(piece => piece.id).sort();
    let random = seed;
    for (let ply = 0; ply < 4; ply++) {
      state = act(state, { type: 'endTurn' });
      const choices = [...legalDests(state, false)].flatMap(([from, dests]) => dests.map(to => ({ from, to })));
      assert.ok(choices.length > 0);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const move = choices[random % choices.length]!;
      const piece = state.pieces.find(candidate => candidate.square === move.from)!;
      const acting = state.turn.color;
      state = act(state, { type: 'move', ...move, ...(piece.role === 'pawn' && isPromotionSquare(state, piece.owner, move.to) ? { promotion: 'queen' } : {}) });
      assert.equal(isKingInCheck(state, acting), false);
      assert.deepEqual(state.pieces.map(candidate => candidate.id).sort(), ids);
      const board = state.pieces.filter(candidate => candidate.zone === 'board');
      assert.equal(new Set(board.map(candidate => candidate.square)).size, board.length);
      assert.ok(state.pieces.every(candidate => (candidate.zone === 'board') === (candidate.square !== null)));
      assert.equal(boardFen(state), state.fen.split(' ')[0]);
    }
  });
}
