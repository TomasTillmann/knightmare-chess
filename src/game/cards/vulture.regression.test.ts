import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.error));
  return result.state;
}

function cardIds(state: GameState): string[] {
  return [...Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]),
    ...state.effects.flatMap(effect => {
      const card = (effect as { card?: { id: string; proxy?: true } }).card;
      return card && !card.proxy ? [card] : [];
    })].map(card => card.id).sort();
}

function invariant(state: GameState, initial: GameState): void {
  assert.deepEqual(cardIds(state), cardIds(initial));
  assert.equal(new Set(cardIds(state)).size, cardIds(state).length);
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), initial.pieces.map(piece => piece.id).sort());
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  for (const piece of state.pieces) {
    if (piece.zone === 'board') assert.match(piece.square!, /^[a-h][1-8]$/);
    else assert.equal(piece.square, null);
  }
  for (const color of ['white', 'black'] as const) {
    assert.equal(board.filter(piece => piece.owner === color && piece.royal).length, 1);
    assert.ok(state.turn.cardPlays[color] >= 0 && state.turn.cardPlays[color] <= 1);
  }
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  const fenWhite = state.turn.moveMade ? state.turn.color === 'black' : state.turn.color === 'white';
  assert.equal(state.fen.split(' ')[1], fenWhite ? 'w' : 'b');
}

function finish(state: GameState, seed = 11): GameState {
  if (!state.turn.moveMade) {
    const choices = [...legalDests(state)].flatMap(([from, tos]) => tos.map(to => ({ from, to })));
    assert.ok(choices.length);
    state = act(state, { type: 'move', ...choices[seed % choices.length]! });
  }
  const color = state.turn.color;
  state = act(state, { type: 'endTurn' });
  assert.notEqual(state.turn.color, color);
  assert.equal(state.turn.moveMade, false);
  return state;
}

test('Vulture retains the physical identity and irreversible board effect of Disintegration', () => {
  const initial = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] }, decks: { black: ['bog', 'revenge'] } });
  let state = initial;
  const card = state.players.white.hand[0]!;
  state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'vulture' });
  assert.ok(state.players.black.hand.some(held => held.id === card.id));
  assert.ok(state.players.black.discard.some(held => held.id === initial.players.black.deck[0]!.id));
  assert.ok(state.players.black.hand.some(held => held.id === initial.players.black.deck[1]!.id));
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'dead');
  assert.equal(state.turn.cardPlays.black, 1);
  const replay = structuredClone(state);
  const run = (start: GameState) => {
    let current = start;
    let seed = 123;
    for (let ply = 0; ply < 4; ply++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      current = finish(current, seed);
      invariant(current, initial);
    }
    return current;
  };
  assert.deepEqual(run(state), run(replay));
});

test('selected duplicate is recovered after an earlier physical copy was discarded', () => {
  const initial = createGameState({ hands: { white: ['disintegration', 'disintegration'], black: ['vulture'] } });
  const [older, selected] = initial.players.white.hand;
  let state = act(initial, { type: 'playCard', cardId: 'disintegration', cardInstanceId: older!.id, target: 'a2' });
  state = finish(finish(state));
  state = act(state, { type: 'playCard', cardId: 'disintegration', cardInstanceId: selected!.id, target: 'c2' });
  state = act(state, { type: 'playCard', cardId: 'vulture' });
  assert.deepEqual(state.players.black.hand, [selected]);
  assert.deepEqual(state.players.white.discard, [older]);
  assert.equal(state.history.filter(event => event.cardId === 'disintegration').length, 2);
  invariant(state, initial);
});

test('a valid response expires after a move and stays expired across endTurn', () => {
  const initial = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] } });
  const ready = act(initial, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  assert.equal(applyAction(ready, { type: 'playCard', cardId: 'vulture' }).ok, true);
  let state = act(ready, { type: 'move', from: 'e2', to: 'e4' });
  for (let step = 0; step < 2; step++) {
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'vulture' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
    assert.deepEqual(state, before);
    invariant(state, initial);
    if (step === 0) state = act(state, { type: 'endTurn' });
  }
});

test('FAQ 50: Vulture retrieves the last active card, leaving its proxy and the older discard', () => {
  const initial = createGameState({ hands: { white: ['disintegration', 'pacifism'], black: ['vulture'] } });
  const recovered = initial.players.white.hand[0]!;
  const continuing = initial.players.white.hand[1]!;
  let state = act(initial, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  state = finish(finish(state));
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'c2' });
  state = act(state, { type: 'playCard', cardId: 'vulture' });
  assert.deepEqual(state.players.black.hand, [continuing]);
  assert.deepEqual(state.players.white.discard, [recovered]);
  assert.equal(state.effects.length, 1);
  const effect = state.effects[0] as { type: string; card: { id: string; proxy?: true } };
  assert.equal(effect.type, 'pacifism');
  assert.equal(effect.card.proxy, true);
  assert.notEqual(effect.card.id, continuing.id);
  invariant(state, initial);
});

test('own-turn response to Bog preserves its shortened move and spends the card allowance', () => {
  const initial = createGameState({ fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1', hands: { white: ['vulture', 'disintegration'], black: ['bog'] } });
  let state = act(initial, { type: 'move', from: 'a2', to: 'a5' });
  state = act(state, { type: 'playCard', cardId: 'bog' });
  const bog = initial.players.black.hand[0]!;
  state = act(state, { type: 'playCard', cardId: 'vulture' });
  assert.ok(state.players.white.hand.some(card => card.id === bog.id));
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a2')?.square, 'a3');
  assert.deepEqual(state.turn.cardPlays, { white: 1, black: 1 });
  assert.equal(state.history.at(-1)?.cardId, 'vulture');
  invariant(state, initial);
  state = finish(state);
  invariant(state, initial);
});
