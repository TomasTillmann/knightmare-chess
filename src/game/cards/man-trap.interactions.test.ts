import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFen } from 'chessops/fen';
import { makeSquare } from 'chessops/util';
import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions preserve their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  if (action.type === 'playCard') {
    assert.ok(result.state.history.slice(state.history.length).some(event => event.type === 'cardPlayed'), 'setup card must take effect rather than fizzle');
  }
  return result.state;
}

function fixture(white = ['man-trap'], black: string[] = []): GameState {
  return createGameState({
    fen: '7k/pp6/8/3r4/3N4/8/PP6/K7 w - - 0 1',
    hands: { white, black }, phase: 'afterMove', moveMade: true,
  });
}

function arm(state = fixture(), square = 'd4'): GameState {
  return act(state, { type: 'playCard', cardId: 'man-trap', target: square });
}

test('Man-Trap retains its physical card until an enemy capture springs it', () => {
  let state = arm();
  const id = state.pieces.find(piece => piece.square === 'd5')!.id;
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd5', to: 'd4' });
  assert.equal(state.pieces.find(piece => piece.id === id)!.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-d4')!.zone, 'captured');
  assert.equal(state.players.white.discard.filter(card => card.cardId === 'man-trap').length, 1);
});

function move(state: GameState, from: string, to: string): GameState {
  assert.ok(legalDests(state).get(from as never)?.includes(to as never), `${from}-${to} must be legal`);
  return act(state, { type: 'move', from, to });
}

function turn(state: GameState): GameState {
  return act(state, { type: 'endTurn' });
}

function vacated(black: string[] = []): GameState {
  let state = turn(arm(fixture(['man-trap'], black)));
  state = turn(move(state, 'a7', 'a6'));
  return turn(move(state, 'd4', 'f3'));
}

function traps(state: GameState): Array<{ card: { id: string; cardId: string }; square?: string }> {
  return state.effects.filter(effect => (effect as { type?: string }).type === 'man-trap') as ReturnType<typeof traps>;
}

function zone(state: GameState, id: string): string {
  return state.pieces.find(piece => piece.id === id)!.zone;
}

test('Peace Talks cancels the trap and restores ordinary capture', () => {
  let state = turn(arm(fixture(['man-trap'], ['peace-talks'])));
  const trapCard = traps(state)[0]!.card.id;
  state = move(state, 'a7', 'a6');
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: trapCard });
  assert.equal(traps(state).length, 0);
  state = turn(state);
  state = turn(move(state, 'a2', 'a3'));
  state = move(state, 'd5', 'd4');
  assert.equal(zone(state, 'black-rook-d5'), 'board');
  assert.equal(zone(state, 'white-knight-d4'), 'captured');
  assert.equal(state.players.white.discard.filter(card => card.id === trapCard).length, 1);
});

test('Haunting Memories creates an independently owned trap with its own physical card', () => {
  let state = turn(arm(fixture(['man-trap'], ['haunting-memories'])));
  state = move(state, 'a7', 'a6');
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: 'd5' });
  assert.equal(traps(state).length, 2);
  assert.deepEqual(traps(state).map(effect => effect.card.cardId).sort(), ['haunting-memories', 'man-trap']);
  state = turn(state);
  state = turn(move(state, 'a2', 'a3'));
  state = move(state, 'd5', 'd4');
  assert.equal(zone(state, 'black-rook-d5'), 'captured');
  assert.equal(traps(state).length, 1);
  assert.equal(traps(state)[0]!.card.cardId, 'haunting-memories');
});

for (const destination of ['d3', 'd2']) {
  test(`ordinary sliding through d4 to ${destination} leaves the trap armed`, () => {
    const state = move(vacated(), 'd5', destination);
    assert.equal(zone(state, 'black-rook-d5'), 'board');
    assert.equal(traps(state).length, 1);
  });
}

test('the first opposing move onto a vacated square consumes the trap', () => {
  const state = move(vacated(), 'd5', 'd4');
  assert.equal(zone(state, 'black-rook-d5'), 'captured');
  assert.equal(zone(state, 'white-knight-d4'), 'board');
  assert.equal(traps(state).length, 0);
});

for (const cardId of ['masquerade', 'ghostwalk']) {
  for (const to of ['d4', 'd3']) {
    test(`${cardId} ${to === 'd4' ? 'ending on' : 'passing through'} the trap`, () => {
      const state = act(vacated([cardId]), {
        type: 'playCard', cardId, target: [{ from: 'd5', to }],
      });
      assert.equal(zone(state, 'black-rook-d5'), to === 'd4' ? 'captured' : 'board');
      assert.equal(traps(state).length, to === 'd4' ? 0 : 1);
    });
  }
}

for (const trapFirst of [false, true]) {
  test(`Curse ${trapFirst ? 'after' : 'before'} Man-Trap preserves both independent effects`, () => {
    let state = fixture(trapFirst ? ['man-trap', 'curse'] : ['curse', 'man-trap']);
    state = act(state, { type: 'playCard', cardId: trapFirst ? 'man-trap' : 'curse', target: trapFirst ? 'd4' : 'd5' });
    state = turn(state);
    state = turn(move(state, 'a7', 'a6'));
    state = move(state, 'a2', 'a3');
    state = act(state, { type: 'playCard', cardId: trapFirst ? 'curse' : 'man-trap', target: trapFirst ? 'd5' : 'd4' });
    state = turn(state);
    assert.ok(!legalDests(state).get('d5')?.includes('h5'));
    state = move(state, 'd5', 'd4');
    assert.equal(zone(state, 'black-rook-d5'), 'captured');
    assert.equal(traps(state).length, 0);
  });
}

for (const trapFirst of [false, true]) {
  test(`Pacifism ${trapFirst ? 'after' : 'before'} Man-Trap prevents capture and triggering (FAQ 40/46)`, () => {
    let state: GameState;
    if (trapFirst) {
      state = vacated(['pacifism']);
      state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'd5' });
    } else {
      state = createGameState({
        fen: '7k/pp6/8/3r4/3N4/8/PP6/K7 b - - 0 1',
        hands: { white: ['man-trap'], black: ['pacifism'] },
      });
      state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'd5' });
      state = turn(move(state, 'a7', 'a6'));
      state = move(state, 'a2', 'a3');
      state = turn(arm(state));
      state = turn(move(state, 'b7', 'b6'));
      state = turn(move(state, 'd4', 'f3'));
    }
    state = move(state, 'd5', 'd4');
    assert.equal(zone(state, 'black-rook-d5'), 'board');
    assert.equal(traps(state).length, 1, 'a Pacifist does not set off the trap');
  });
}

for (const royalArrives of [false, true]) {
  test(`Coup makes the ${royalArrives ? 'new royal immune' : 'former King capturable'} by Man-Trap`, () => {
    let state = createGameState({
      fen: royalArrives
        ? '7k/pp6/8/5n2/3P4/8/PP6/K7 b - - 0 1'
        : '8/pp3n2/8/4k3/3N4/8/PP6/K7 b - - 0 1',
      hands: { white: ['man-trap'], black: ['coup'] }, phase: 'afterMove', moveMade: true,
    });
    const from = royalArrives ? 'f5' : 'e5';
    const mover = state.pieces.find(piece => piece.square === from)!.id;
    state = act(state, { type: 'playCard', cardId: 'coup', target: royalArrives ? 'f5' : 'f7' });
    state = turn(state);
    state = move(state, 'a2', 'a3');
    state = turn(arm(state));
    state = move(state, from, 'd4');
    assert.equal(zone(state, mover), royalArrives ? 'board' : 'captured');
    assert.equal(traps(state).length, royalArrives ? 1 : 0);
    assert.equal(zone(state, royalArrives ? 'white-pawn-d4' : 'white-knight-d4'), 'captured');
  });
}

test('Earthquake preserves the sealed table coordinate', () => {
  let state = createGameState({
    fen: '7k/5pp1/8/3r4/3N4/8/1PP5/K7 w - - 0 1',
    hands: { white: ['man-trap'], black: ['earthquake'] }, phase: 'afterMove', moveMade: true,
  });
  state = turn(arm(state));
  state = move(state, 'f7', 'f6');
  state = act(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] } });
  assert.equal(traps(state)[0]!.square, 'd4');
  assert.equal(zone(state, 'black-rook-d5'), 'board');
});

for (const final of ['d4', 'b2']) {
  test(`Madman ${final === 'd4' ? 'ends on' : 'continues beyond'} the trapped intermediate landing`, () => {
    let state = createGameState({
      fen: final === 'd4' ? '8/p6k/5p2/4B3/3N4/8/P7/K7 w - - 0 1' : '8/p6k/5p2/4B3/3N4/2B5/P7/K7 w - - 0 1',
      hands: { white: ['man-trap'], black: ['madman'] }, phase: 'afterMove', moveMade: true,
    });
    state = turn(arm(state));
    state = turn(move(state, 'a7', 'a6'));
    state = turn(move(state, 'd4', 'f3'));
    state = act(state, { type: 'playCard', cardId: 'madman', target: [
      { from: 'f6', to: 'd4' }, ...(final === 'b2' ? [{ from: 'd4', to: 'b2' }] : []),
    ] });
    assert.equal(zone(state, 'black-pawn-f6'), final === 'd4' ? 'captured' : 'board');
    assert.equal(traps(state).length, final === 'd4' ? 0 : 1);
    assert.equal(zone(state, 'white-bishop-e5'), 'board');
    if (final === 'b2') assert.equal(zone(state, 'white-bishop-c3'), 'board');
  });
}

test('existing movement-card fixtures are valid without the new trap effect', () => {
  for (const cardId of ['masquerade', 'ghostwalk', 'pacifism', 'earthquake']) {
    let state = turn(fixture([], [cardId]));
    if (cardId === 'earthquake') {
      state = createGameState({
        fen: '7k/5pp1/8/3r4/3N4/8/1PP5/K7 b - - 0 1', hands: { black: ['earthquake'] },
      });
      state = move(state, 'f7', 'f6');
      act(state, { type: 'playCard', cardId, target: { direction: 'clockwise', promotions: [] } });
      continue;
    }
    state = turn(move(state, 'a7', 'a6'));
    state = turn(move(state, 'd4', 'f3'));
    if (cardId === 'pacifism') {
      state = act(state, { type: 'playCard', cardId, target: 'd5' });
      move(state, 'd5', 'd4');
    } else {
      act(state, { type: 'playCard', cardId, target: [{ from: 'd5', to: 'd4' }] });
    }
  }
  for (const to of ['d4', 'b2']) {
    const state = createGameState({
      fen: to === 'd4' ? '8/p6k/5p2/4B3/8/5N2/P7/K7 b - - 0 1' : '8/p6k/5p2/4B3/8/2B2N2/P7/K7 b - - 0 1', hands: { black: ['madman'] },
    });
    act(state, { type: 'playCard', cardId: 'madman', target: [
      { from: 'f6', to: 'd4' }, ...(to === 'b2' ? [{ from: 'd4', to: 'b2' }] : []),
    ] });
  }
});

function physicalCards(state: GameState): string[] {
  return [
    ...Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]),
    ...state.effects.flatMap(effect => {
      const card = (effect as { card?: { id: string } }).card;
      return card ? [card] : [];
    }),
  ].map(card => card.id).sort();
}

function invariant(state: GameState, initial: GameState): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), initial.pieces.map(piece => piece.id).sort());
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(board.every(piece => piece.square !== null));
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  for (const color of ['white', 'black']) {
    assert.equal(board.filter(piece => piece.owner === color && piece.royal).length, 1);
  }
  const fenBoard = [...parseFen(state.fen).unwrap().board].map(([square, piece]) => `${makeSquare(square)}:${piece.color}:${piece.role}`).sort();
  assert.deepEqual(fenBoard, board.map(piece => `${piece.square}:${piece.owner}:${piece.role}`).sort());
  assert.deepEqual(physicalCards(state), physicalCards(initial));
}

for (let seed = 1; seed <= 20; seed++) {
  test(`seeded actual legal move sequence ${seed}: four plies preserve state invariants`, () => {
    const initial = fixture();
    let state = turn(arm(initial));
    let random = seed;
    for (let ply = 0; ply < 4; ply++) {
      const choices = [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => ({ from, to })));
      assert.ok(choices.length > 0, 'sparse fixture remains mobile for four plies');
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const selected = choices[random % choices.length]!;
      state = act(state, { type: 'move', ...selected });
      invariant(state, initial);
      if (ply < 3) state = turn(state);
    }
  });
}
