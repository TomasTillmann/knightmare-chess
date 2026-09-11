import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import type { Color, GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown, cardInstanceId?: string): GameState {
  const next = act(state, { type: 'playCard', cardId, target, cardInstanceId });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, cardId);
  return next;
}

function pacifismWindow() {
  return play(createGameState({ hands: {
    white: ['pacifism'], black: ['fog-of-war', 'fog-of-war'],
  } }), 'pacifism', 'b1');
}

test('Fog preserves an uncanceled Vulture extra discard and its replacement sequence inside Plots', () => {
  const initial = createGameState({
    hands: { white: ['curse'], black: ['plots-within-plots', 'vulture', 'fog-of-war'] },
    decks: { white: [], black: ['crab', 'dubbing', 'assassin', 'long-jump', 'pacifism'] },
  });
  let state = act(initial, { type: 'move', from: 'g1', to: 'f3' });
  state = play(state, 'curse', 'a8');
  state = play(state, 'plots-within-plots', { player: 'black' });
  state = play(state, 'vulture');
  const snapshot = structuredClone(state);
  state = play(state, 'fog-of-war');
  assert.deepEqual(snapshot.players.black.discard, [initial.players.black.hand[0], initial.players.black.deck[1], initial.players.black.hand[1]]);
  assert.ok(state.players.black.discard.some(card => card.id === initial.players.black.deck[1].id));
  assert.deepEqual(state.players.black.hand.filter(card => card.id.startsWith('black-deck-')), [initial.players.black.deck[0], initial.players.black.deck[2], initial.players.black.deck[3]]);
  assert.deepEqual(state.players.black.deck, initial.players.black.deck.slice(4));
  assert.equal(hasEffect(state, 'curse'), false);
});

function vultureResponse(owner: Color, deck: string[]) {
  const reactor: Color = owner === 'white' ? 'black' : 'white';
  const initial = createGameState({ turn: owner,
    hands: { [owner]: ['curse'], [reactor]: ['plots-within-plots', 'vulture', 'fog-of-war'] },
    decks: { [owner]: [], [reactor]: deck },
  });
  let state = act(initial, { type: 'move', from: owner === 'white' ? 'g1' : 'g8', to: owner === 'white' ? 'f3' : 'f6' });
  state = play(state, 'curse', owner === 'white' ? 'a8' : 'a1');
  state = play(state, 'plots-within-plots', { player: reactor });
  return { state, initial, reactor };
}

function cardInventory(state: GameState) {
  const cards = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
  for (const effect of state.effects) {
    if (typeof effect === 'object' && effect !== null && 'card' in effect) {
      const card = effect.card as { id: string; proxy?: boolean };
      if (!card.proxy) cards.push(card as typeof cards[number]);
    }
  }
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'physical cards occur exactly once');
  return ids;
}

for (const owner of ['white', 'black'] as const) {
  for (const deck of [[], ['crab'], ['crab', 'dubbing'], ['crab', 'dubbing', 'assassin'],
    ['crab', 'dubbing', 'assassin', 'long-jump', 'pacifism'],
    ['crab', 'crab', 'crab', 'crab', 'crab']]) {
    test(`${owner}: uncanceled Vulture survives Fog with exact ${deck.join('/') || 'empty'} deck accounting`, () => {
      const { state, initial, reactor } = vultureResponse(owner, deck);
      const before = play(state, 'vulture');
      const snapshot = structuredClone(before);
      const next = play(before, 'fog-of-war');
      const original = initial.players[reactor];
      assert.deepEqual(before, snapshot);
      assert.deepEqual(next.players[reactor].discard, [original.hand[0], ...original.deck.slice(1, 2), original.hand[1], original.hand[2]]);
      assert.deepEqual(next.players[reactor].hand.filter(card => card.id.startsWith(`${reactor}-deck-`)),
        [...original.deck.slice(0, 1), ...original.deck.slice(2, 4)]);
      assert.deepEqual(next.players[reactor].deck, original.deck.slice(4));
      assert.deepEqual(cardInventory(next), cardInventory(initial));
      assert.equal(next.turn.cardPlays[reactor], 3);
      assert.equal(next.plotsAllowances?.find(allowance => allowance.player === reactor)?.remaining, 0);
      assert.equal(hasEffect(next, 'curse'), false);
    });
  }

  for (const order of ['fog-first', 'end-after-vulture'] as const) {
    test(`${owner}: ${order} retains Vulture cost without a cancellation refund`, () => {
      const { state, initial, reactor } = vultureResponse(owner, ['crab', 'dubbing', 'assassin', 'long-jump', 'pacifism']);
      const next = order === 'fog-first'
        ? play(play(state, 'fog-of-war'), 'vulture')
        : act(play(state, 'vulture'), { type: 'endTurn' });
      const original = initial.players[reactor];
      assert.deepEqual(next.players[reactor].deck, original.deck.slice(order === 'fog-first' ? 4 : 3));
      assert.deepEqual(next.players[reactor].discard,
        order === 'fog-first' ? [original.hand[0], original.hand[2], original.deck[2], original.hand[1]]
          : [original.hand[0], original.deck[1], original.hand[1]]);
      assert.deepEqual(cardInventory(next), cardInventory(initial));
    });
  }
}

test('Fog canceling the first Plots extra preserves the remaining committed card', () => {
  let state = createGameState({ hands: {
    white: ['plots-within-plots', 'crab', 'curse'], black: ['fog-of-war'],
  } });
  state = act(state, { type: 'move', from: 'g1', to: 'f3' });
  state = play(state, 'plots-within-plots');
  state = play(state, 'crab', 'e2');
  state = play(state, 'fog-of-war');
  state = play(state, 'curse', 'd8');
  assert.equal(hasEffect(state, 'crab'), false);
  assert.equal(hasEffect(state, 'curse'), true);
  assert.equal(state.turn.cardPlays.white, 3);
  assert.equal(state.turn.moveMade, true);
  assert.equal(legalDests(state).size, 0);
});

function hasEffect(state: GameState, type: string): boolean {
  return state.effects.some(effect => typeof effect === 'object' && effect !== null
    && 'type' in effect && effect.type === type);
}

function trio(owner: Color = 'white', late = true) {
  const reactor: Color = owner === 'white' ? 'black' : 'white';
  const initial = createGameState({ turn: owner,
    hands: { [owner]: ['plots-within-plots', 'crab', 'curse'], [reactor]: ['fog-of-war'] },
    decks: { [owner]: ['pacifism', 'crab', 'curse'], [reactor]: ['pacifism'] },
  });
  const moved = act(initial, { type: 'move', from: owner === 'white' ? 'g1' : 'g8', to: owner === 'white' ? 'f3' : 'f6' });
  const opened = play(moved, 'plots-within-plots');
  const first = play(opened, 'crab', owner === 'white' ? 'e2' : 'e7');
  return { initial, moved, opened, first, owner, reactor,
    state: late ? play(first, 'curse', owner === 'white' ? 'd8' : 'd1') : first };
}

for (const owner of ['white', 'black'] as const) {
  test(`${owner}: Fog leaves exactly one originally eligible extra play`, () => {
    const { state, initial } = trio(owner, false);
    const canceled = play(state, 'fog-of-war');
    assert.equal(canceled.plotsAllowances?.[0].remaining, 1);
    const drawn = canceled.players[owner].hand.find(card => card.id === initial.players[owner].deck[0].id)!;
    const invalid = applyAction(canceled, { type: 'playCard', cardId: drawn.cardId, cardInstanceId: drawn.id, target: owner === 'white' ? 'a2' : 'a7' });
    assert.equal(invalid.ok, false);
    assert.deepEqual(invalid.state, canceled);
    const finished = play(canceled, 'curse', owner === 'white' ? 'd8' : 'd1');
    assert.equal(finished.turn.cardPlays[owner], 3);
    assert.equal(finished.plotsAllowances?.[0].remaining, 0);
    assert.equal(applyAction(finished, { type: 'playCard', cardId: 'pacifism', target: owner === 'white' ? 'a2' : 'a7' }).ok, false);
  });

  test(`${owner}: selecting earlier Crab preserves committed Curse and exact draws`, () => {
    const { state, initial, moved, reactor } = trio(owner);
    const before = structuredClone(state);
    const result = play(state, 'fog-of-war', initial.players[owner].hand[1].id);
    assert.deepEqual(state, before);
    assert.equal(hasEffect(result, 'crab'), false);
    assert.equal(hasEffect(result, 'curse'), true);
    assert.equal(result.fen, moved.fen);
    assert.deepEqual(result.players[owner].hand, state.players[owner].hand);
    assert.deepEqual(result.players[owner].deck, state.players[owner].deck);
    assert.deepEqual(result.players[owner].discard, initial.players[owner].hand.slice(0, 2));
    assert.deepEqual(result.players[reactor].hand, initial.players[reactor].deck);
    assert.equal(result.turn.cardPlays[owner], 3);
    assert.equal(result.turn.cardPlays[reactor], 1);
    assert.equal(legalDests(result).size, 0);
  });

  test(`${owner}: public Fog targets enumerate exactly the live trio and default`, () => {
    const { state, initial } = trio(owner);
    assert.deepEqual(new Set(cardPlayTargets(state, 'fog-of-war')),
      new Set([undefined, ...initial.players[owner].hand.map(card => card.id)]));
  });

  test(`${owner}: default late Fog cancels only latest Curse`, () => {
    const { state } = trio(owner);
    const result = play(state, 'fog-of-war');
    assert.equal(hasEffect(result, 'crab'), true);
    assert.equal(hasEffect(result, 'curse'), false);
    assert.equal(result.turn.cardPlays[owner], 3);
    assert.equal(result.plotsAllowances?.[0].remaining, 0);
  });

  test(`${owner}: selecting Plots backs up its extras and replacement draws`, () => {
    const { state, initial, moved } = trio(owner);
    const result = play(state, 'fog-of-war', initial.players[owner].hand[0].id);
    assert.equal(result.fen, moved.fen);
    assert.deepEqual(result.effects, []);
    assert.deepEqual(result.players[owner].hand, [...initial.players[owner].hand.slice(1), initial.players[owner].deck[0]]);
    assert.deepEqual(result.players[owner].deck, initial.players[owner].deck.slice(1));
    assert.deepEqual(result.players[owner].discard, initial.players[owner].hand.slice(0, 1));
    assert.equal(result.turn.cardPlays[owner], 1);
    assert.ok(!result.plotsAllowances?.length);
    assert.equal(applyAction(result, { type: 'playCard', cardId: 'curse', target: owner === 'white' ? 'd8' : 'd1' }).ok, false);
  });

  test(`${owner}: invalid and stale selected physical IDs reject atomically`, () => {
    const { state, initial } = trio(owner);
    for (const target of ['crab', 'missing', initial.players[owner].deck[0].id, `${owner === 'white' ? 'black' : 'white'}-hand-0-fog-of-war`, {}, 0]) {
      const snapshot = structuredClone(state);
      const result = applyAction(state, { type: 'playCard', cardId: 'fog-of-war', target });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, snapshot);
      assert.deepEqual(state, snapshot);
    }
    const ended = act(state, { type: 'endTurn' });
    assert.deepEqual(cardPlayTargets(ended, 'fog-of-war'), []);
    assert.equal(applyAction(ended, { type: 'playCard', cardId: 'fog-of-war', target: initial.players[owner].hand[1].id }).ok, false);
  });
}

test('canceling Plots immediately spends only Plots and grants no extra card', () => {
  const { opened } = trio();
  const result = play(opened, 'fog-of-war');
  assert.equal(result.turn.cardPlays.white, 1);
  assert.ok(!result.plotsAllowances?.length);
  assert.equal(applyAction(result, { type: 'playCard', cardId: 'crab', target: 'e2' }).ok, false);
});

test('before-move continuation preserves the ordinary move and closes selection on moving', () => {
  let state = createGameState({ hands: { white: ['plots-within-plots', 'pacifism', 'pacifism'], black: ['fog-of-war'] } });
  state = play(play(state, 'plots-within-plots'), 'pacifism', 'a2');
  const canceled = play(state, 'fog-of-war');
  const finished = play(canceled, 'pacifism', 'h2');
  assert.equal(finished.turn.moveMade, false);
  const moved = act(finished, { type: 'move', from: 'e2', to: 'e4' });
  assert.deepEqual(cardPlayTargets(moved, 'fog-of-war'), []);
});

test('selected earlier replacement preserves an independent later replacement without a third move', () => {
  let state = createGameState({ hands: { white: ['plots-within-plots', 'dubbing', 'dubbing'], black: ['fog-of-war'] } });
  state = play(play(state, 'plots-within-plots'), 'dubbing', [{ from: 'a2', to: 'b4' }]);
  state = play(state, 'dubbing', [{ from: 'h2', to: 'g4' }]);
  const result = play(state, 'fog-of-war', 'white-hand-1-dubbing');
  assert.equal(result.pieces.find(piece => piece.id === 'white-pawn-a2')?.square, 'a2');
  assert.equal(result.pieces.find(piece => piece.id === 'white-pawn-h2')?.square, 'g4');
  assert.equal(result.turn.cardPlays.white, 3);
  assert.equal(legalDests(result).size, 0);
});

test('canceling first replacement still permits its committed second replacement', () => {
  let state = createGameState({ hands: { white: ['plots-within-plots', 'dubbing', 'dubbing'], black: ['fog-of-war'] } });
  state = play(play(state, 'plots-within-plots'), 'dubbing', [{ from: 'a2', to: 'b4' }]);
  state = play(state, 'fog-of-war');
  assert.equal(state.turn.moveMade, false);
  const result = play(state, 'dubbing', [{ from: 'h2', to: 'g4' }], 'white-hand-2-dubbing');
  assert.equal(result.turn.cardPlays.white, 3);
  assert.equal(legalDests(result).size, 0);
});

test('selecting one duplicate extra cancels its exact physical effect', () => {
  let state = createGameState({ hands: { white: ['plots-within-plots', 'pacifism', 'pacifism'], black: ['fog-of-war', 'fog-of-war'] } });
  state = play(play(state, 'plots-within-plots'), 'pacifism', 'a2', 'white-hand-2-pacifism');
  state = play(state, 'pacifism', 'h2', 'white-hand-1-pacifism');
  const result = play(state, 'fog-of-war', 'white-hand-2-pacifism', 'black-hand-1-fog-of-war');
  assert.deepEqual(result.players.white.discard.map(card => card.id), ['white-hand-0-plots-within-plots', 'white-hand-2-pacifism']);
  assert.deepEqual(result.players.black.hand.map(card => card.id), ['black-hand-0-fog-of-war']);
  assert.equal(result.effects.length, 1);
  const effect = result.effects[0];
  assert.ok(typeof effect === 'object' && effect !== null && 'card' in effect);
  assert.deepEqual(effect.card, { id: 'white-hand-1-pacifism', cardId: 'pacifism' });
});

test('opposing Plots plus two Fogs cancels both extras in either order without restoring either', () => {
  for (const order of [['crab', 'curse'], ['curse', 'crab']]) {
    let state = createGameState({ hands: {
      white: ['plots-within-plots', 'crab', 'curse'], black: ['plots-within-plots', 'fog-of-war', 'fog-of-war'],
    } });
    state = act(state, { type: 'move', from: 'g1', to: 'f3' });
    state = play(play(play(state, 'plots-within-plots'), 'crab', 'e2'), 'curse', 'd8');
    state = play(state, 'plots-within-plots', { player: 'black' });
    for (const [index, cardId] of order.entries()) {
      const target = `white-hand-${cardId === 'crab' ? 1 : 2}-${cardId}`;
      state = play(state, 'fog-of-war', target);
      assert.equal(hasEffect(state, cardId), false);
      assert.equal(cardPlayTargets(state, 'fog-of-war').includes(target), false);
      assert.equal(state.turn.cardPlays.black, index + 2);
    }
    assert.deepEqual(state.effects, []);
    assert.equal(state.players.white.discard.length, 3);
    assert.equal(state.players.black.discard.length, 3);
    assert.equal(state.turn.cardPlays.white, 3);
    assert.equal(legalDests(state).size, 0);
  }
});

test('a remaining committed extra updates the opposing Plots Fog window between cancellations', () => {
  for (const target of [undefined, 'white-hand-2-curse']) {
    let state = createGameState({ hands: {
      white: ['plots-within-plots', 'crab', 'curse'], black: ['plots-within-plots', 'fog-of-war', 'fog-of-war'],
    } });
    state = act(state, { type: 'move', from: 'g1', to: 'f3' });
    state = play(play(state, 'plots-within-plots'), 'crab', 'e2');
    state = play(state, 'plots-within-plots', { player: 'black' });
    state = play(state, 'fog-of-war', 'white-hand-1-crab');
    state = play(state, 'curse', 'd8');
    assert.ok(cardPlayTargets(state, 'fog-of-war').includes('white-hand-2-curse'));
    state = play(state, 'fog-of-war', target);
    assert.deepEqual(state.effects, []);
    assert.equal(state.players.white.discard.length, 3);
    assert.equal(state.players.black.discard.length, 3);
    assert.equal(state.turn.cardPlays.white, 3);
    assert.equal(state.turn.cardPlays.black, 3);
    assert.equal(legalDests(state).size, 0);
  }
});

test('an invalidated third target keeps the same physical card committed for a legal target', () => {
  let state = createGameState({ hands: {
    white: ['plots-within-plots', 'dubbing', 'dubbing', 'pacifism'], black: ['fog-of-war'],
  } });
  state = play(play(state, 'plots-within-plots'), 'dubbing', [{ from: 'a2', to: 'b4' }]);
  state = play(state, 'dubbing', [{ from: 'b4', to: 'c6' }]);
  state = play(state, 'fog-of-war', 'white-hand-1-dubbing');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-a2')?.square, 'a2');
  assert.equal(state.turn.cardPlays.white, 2);
  const rejected = applyAction(state, { type: 'playCard', cardId: 'pacifism', target: 'h2' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);
  const result = play(state, 'dubbing', [{ from: 'a2', to: 'b4' }], 'white-hand-2-dubbing');
  assert.equal(result.turn.cardPlays.white, 3);
  assert.equal(legalDests(result).size, 0);
});

test('a copied Plots root is selectable by its physical Haunting Memories ID', () => {
  let state = createGameState({ turn: 'black', hands: {
    black: ['plots-within-plots', 'fog-of-war'], white: ['haunting-memories', 'crab', 'curse'],
  } });
  state = play(state, 'plots-within-plots');
  state = act(state, { type: 'move', from: 'g8', to: 'f6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g1', to: 'f3' });
  const moved = state;
  state = play(play(play(state, 'haunting-memories'), 'crab', 'e2'), 'curse', 'd8');
  assert.ok(cardPlayTargets(state, 'fog-of-war').includes('white-hand-0-haunting-memories'));
  const result = play(state, 'fog-of-war', 'white-hand-0-haunting-memories');
  assert.equal(result.fen, moved.fen);
  assert.deepEqual(result.effects, []);
  assert.deepEqual(result.players.white.hand, moved.players.white.hand.slice(1));
  assert.deepEqual(result.players.white.discard, moved.players.white.hand.slice(0, 1));
  assert.equal(result.turn.cardPlays.white, 1);
});

test('selecting the earlier extra preserves completed Abduction while latest Fog can still cancel it', () => {
  for (const response of ['correct', 'wrong', 'timeout']) {
    let state = createGameState({ hands: { white: ['plots-within-plots', 'crab', 'abduction'], black: ['fog-of-war'] } });
    state = act(state, { type: 'move', from: 'g1', to: 'f3' });
    state = play(play(play(state, 'plots-within-plots'), 'crab', 'e2'), 'abduction', 'a7');
    state = act(state, { type: 'revealAbduction' });
    state = act(state, response === 'timeout' ? { type: 'abductionTimeout' }
      : { type: 'answerAbduction', player: 'black', role: response === 'correct' ? 'pawn' : 'bishop', owner: 'black', square: 'a7' });
    const latest = play(state, 'fog-of-war');
    assert.equal(latest.pieces.find(piece => piece.id === 'black-pawn-a7')?.zone, 'board');
    const result = play(state, 'fog-of-war', 'white-hand-1-crab');
    assert.equal(result.pendingAbduction, null);
    assert.equal(result.pieces.find(piece => piece.id === 'black-pawn-a7')?.zone, response === 'correct' ? 'board' : 'captured');
    assert.equal(hasEffect(result, 'crab'), false);
    assert.equal(result.turn.cardPlays.white, 3);
  }
});

test('Fog has no window before any real opposing card play', () => {
  const state = createGameState({ hands: { black: ['fog-of-war'] } });
  assert.deepEqual(cardPlayTargets(state, 'fog-of-war'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'fog-of-war' }).ok, false);
});

for (const owner of ['white', 'black'] as const) {
  test(`Fog cancels ${owner}'s real continuing card without consuming the regular move`, () => {
    const reactor: Color = owner === 'white' ? 'black' : 'white';
    const initial = createGameState({ turn: owner,
      hands: { [owner]: ['pacifism'], [reactor]: ['fog-of-war'] },
      decks: { [owner]: ['crab'], [reactor]: ['curse'] },
    });
    const pending = play(initial, 'pacifism', owner === 'white' ? 'b1' : 'b8');
    assert.ok(cardPlayTargets(pending, 'fog-of-war').length > 0);
    const result = play(pending, 'fog-of-war');
    assert.equal(result.history.at(-1)?.player, reactor);
    assert.equal(boardFen(result), boardFen(initial));
    assert.equal(result.effects.length, 0);
    assert.equal(result.turn.moveMade, false);
    assert.ok(legalDests(result).size > 0);
    assert.deepEqual(result.players[owner].discard.map(card => card.cardId), ['pacifism']);
    assert.deepEqual(result.players[reactor].discard.map(card => card.cardId), ['fog-of-war']);
    assert.deepEqual(result.players[owner].hand.map(card => card.cardId), ['crab']);
    assert.deepEqual(result.players[reactor].hand.map(card => card.cardId), ['curse']);
  });
}

for (const target of ['b1', {}, { player: 'black' }]) {
  test(`Fog rejects supplied payload ${JSON.stringify(target)} atomically`, () => {
    const state = pacifismWindow();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'fog-of-war', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Fog spends the selected second physical copy and preserves the first', () => {
  const state = pacifismWindow();
  const [first, second] = state.players.black.hand;
  const result = play(state, 'fog-of-war', undefined, second.id);
  assert.deepEqual(result.players.black.hand, [first]);
  assert.deepEqual(result.players.black.discard, [second]);
});

test('Fog rejects unknown and opposing physical card IDs without losing the valid window', () => {
  const state = pacifismWindow();
  for (const cardInstanceId of ['missing-card', 'white-hand-0-pacifism']) {
    const result = applyAction(state, { type: 'playCard', cardId: 'fog-of-war', cardInstanceId });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
  assert.equal(play(state, 'fog-of-war').effects.length, 0);
});

test('reaction Plots Within Plots remains spent when its allowance counters the original card', () => {
  const initial = createGameState({ hands: {
    white: ['pacifism'], black: ['plots-within-plots', 'fog-of-war'],
  }, decks: { black: ['curse', 'crab'] } });
  const pacifism = play(initial, 'pacifism', 'b1');
  const plots = play(pacifism, 'plots-within-plots', { player: 'black' });
  const result = play(plots, 'fog-of-war');
  assert.equal(result.effects.length, 0);
  assert.equal(boardFen(result), boardFen(initial));
  assert.deepEqual(result.players.black.discard.map(card => card.cardId), ['plots-within-plots', 'fog-of-war']);
  assert.deepEqual(result.players.black.hand.map(card => card.cardId), ['curse', 'crab']);
  assert.equal(result.turn.cardPlays.black, 2);
  assert.equal(result.turn.cardPlays.white, 1);
});

test('canceling Merciless restores its preceding completed ordinary rook move', () => {
  const initial = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 4 1',
    hands: { white: ['merciless'], black: ['fog-of-war'] } });
  const moved = act(initial, { type: 'move', from: 'a1', to: 'a2' });
  const extra = play(moved, 'merciless', [{ from: 'a2', to: 'a3' }]);
  const result = play(extra, 'fog-of-war');
  assert.equal(result.fen, moved.fen);
  assert.deepEqual(result.pieces, moved.pieces);
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.phase, 'afterMove');
  assert.equal(legalDests(result).size, 0);
});

test('Fog can cancel a fizzled replacement while leaving both physical cards spent', () => {
  const initial = createGameState({ fen: 'k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1',
    hands: { white: ['long-jump'], black: ['fog-of-war'] } });
  const fizzled = act(initial, { type: 'playCard', cardId: 'long-jump', target: [{ from: 'e2', to: 'a3' }] });
  assert.ok(fizzled.history.some(event => event.type === 'cardFizzled' && event.cardId === 'long-jump'));
  assert.equal(boardFen(fizzled), boardFen(initial));
  const result = play(fizzled, 'fog-of-war');
  assert.equal(boardFen(result), boardFen(initial));
  assert.deepEqual(result.players.white.discard.map(card => card.cardId), ['long-jump']);
  assert.deepEqual(result.players.black.discard.map(card => card.cardId), ['fog-of-war']);
  assert.equal(result.turn.moveMade, false);
  assert.ok(legalDests(result).size > 0);
});
