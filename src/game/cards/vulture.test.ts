import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, Color, GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}

describe('ordinary optional discard at endTurn', () => {
  const discard = (discardCardInstanceId: unknown) => ({ type: 'endTurn', discardCardInstanceId }) as GameAction;
  const moved = (color: Color = 'white', hand = ['truce', 'truce'], deck = ['crab', 'pacifism']) => act(
    createGameState({ turn: color, hands: { [color]: hand }, decks: { [color]: deck } }),
    { type: 'move', from: color === 'white' ? 'g1' : 'g8', to: color === 'white' ? 'f3' : 'f6' },
  );
  function rejects(state: GameState, action: GameAction) {
    const before = structuredClone(state);
    const result = applyAction(state, action);
    assert.equal(result.ok, false, JSON.stringify(action));
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
  function exchanged(state: GameState, id = state.players[state.turn.color].hand[0].id) {
    const before = structuredClone(state);
    // The only difference from ordinary completion is this exact physical exchange.
    const expected = act(state, { type: 'endTurn' });
    const player = expected.players[state.turn.color];
    const index = player.hand.findIndex(card => card.id === id);
    assert.ok(index >= 0);
    player.discard.push(...player.hand.splice(index, 1));
    const drawn = player.deck.shift();
    if (drawn) player.hand.push(drawn);
    const next = act(state, discard(id));
    assert.deepEqual(next, expected);
    assert.deepEqual(state, before);
    conserve(next, state);
    return next;
  }
  test('replaces the selected physical hand card after an own turn with no card played', () => {
    let state = createGameState({
      hands: { white: ['truce', 'crab'] },
      decks: { white: ['pacifism'] },
    });
    const [discarded, kept] = state.players.white.hand;
    const [replacement] = state.players.white.deck;
    state = act(state, { type: 'move', from: 'e2', to: 'e4' });
    // Proposed public extension: endTurn.discardCardInstanceId selects a physical card.
    const action = { type: 'endTurn' as const, discardCardInstanceId: discarded.id };
    const next = act(state, action);
    assert.deepEqual(next.players.white.hand, [kept, replacement]);
    assert.deepEqual(next.players.white.discard, [discarded]);
    assert.deepEqual(next.players.white.deck, []);
    assert.equal(next.turn.color, 'black');
  });

  for (const color of ['white', 'black'] as const) {
    test(`${color}: selects the second duplicate card, draws the next card once, and preserves all other completion state`, () => {
      const state = moved(color);
      const next = exchanged(state, state.players[color].hand[1].id);
      assert.deepEqual(next.players[color].hand, [state.players[color].hand[0], state.players[color].deck[0]]);
      assert.deepEqual(next.players[color].deck, [state.players[color].deck[1]]);
    });
  }

  test('omitting the selector, including explicit undefined, never discards or draws', () => {
    const state = moved();
    const next = act(state, { type: 'endTurn' });
    assert.deepEqual(next.players, state.players);
    assert.deepEqual(next, act(state, discard(undefined)));
    assert.deepEqual(next.history, state.history);
    assert.deepEqual(next.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  });

  test('rejects malformed, unknown, card-type and duplicate selections atomically', () => {
    const state = moved();
    const id = state.players.white.hand[0].id;
    for (const value of [null, false, 0, '', 'missing', 'truce', {}, { id }, [id], [id, id]]) {
      rejects(state, discard(value));
    }
  });

  test('rejects foreign, undrawn, stale and repeated physical selections', () => {
    let state = createGameState({ hands: { white: ['truce'], black: ['crab'] }, decks: { white: ['pacifism'] } });
    const id = state.players.white.hand[0].id;
    state = act(state, { type: 'move', from: 'g1', to: 'f3' });
    rejects(state, discard(state.players.black.hand[0].id));
    rejects(state, discard(state.players.white.deck[0].id));
    state = exchanged(state, id);
    rejects(state, discard(id));
    state = act(act(state, { type: 'move', from: 'g8', to: 'f6' }), { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'f3', to: 'g1' });
    rejects(state, discard(id));
    assert.equal(state.players.white.discard.filter(card => card.id === id).length, 1);
  });

  test('rejects an ambiguous duplicate physical ID without discarding either card', () => {
    const state = moved();
    state.players.white.hand[1].id = state.players.white.hand[0].id;
    rejects(state, discard(state.players.white.hand[0].id));
  });

  test('cannot replace the regular move', () => {
    const state = createGameState({ hands: { white: ['truce'] }, decks: { white: ['crab'] } });
    rejects(state, discard(state.players.white.hand[0].id));
  });

  test('cannot cure a staged self-check by drawing a rescue card', () => {
    let state = createGameState({
      fen: '5r1k/8/8/8/8/8/8/4K3 w - - 0 1',
      hands: { white: ['mystic-shield'] }, decks: { white: ['disintegration'] },
    });
    state = act(state, { type: 'move', from: 'e1', to: 'f1' });
    assert.ok(state.pendingRescue);
    rejects(state, discard(state.players.white.hand[0].id));
  });

  test('pending Doomsayer and Abduction choices still block completion', () => {
    for (const cardId of ['doomsayer', 'abduction']) {
      let state = moved('white', [cardId, 'truce']);
      state = act(state, { type: 'playCard', cardId, ...(cardId === 'abduction' ? { target: 'a7' } : {}) });
      assert.ok(state.pendingDoomsayer || state.pendingAbduction);
      rejects(state, discard(state.players.white.hand[0].id));
      rejects(state, { type: 'endTurn' });
    }
  });

  test('requires the Elf return, then permits its legal turn without a move', () => {
    let state = createGameState({ fen: '7k/6n1/8/8/8/8/8/4K3 w - - 7 3',
      hands: { white: ['under-elf-hill', 'truce'] }, decks: { white: ['crab', 'pacifism'] } });
    for (const action of [
      { type: 'playCard', cardId: 'under-elf-hill' }, { type: 'endTurn' },
      { type: 'move', from: 'g7', to: 'f5' }, { type: 'endTurn' },
    ] as GameAction[]) state = act(state, action);
    const id = state.players.white.hand[0].id;
    rejects(state, discard(id));
    state = act(state, { type: 'returnKing', to: 'a1' });
    assert.equal(state.turn.moveMade, false);
    assert.equal(legalDests(state).size, 0);
    const next = exchanged(state, id);
    assert.deepEqual(next.fen.split(' ').slice(4), ['10', '4']);
  });

  test('playing a card consumes the ordinary discard allowance', () => {
    const state = act(moved('white', ['disintegration', 'truce']), { type: 'playCard', cardId: 'disintegration', target: 'a2' });
    assert.equal(state.turn.cardPlays.white, 1);
    rejects(state, discard(state.players.white.hand[0].id));
    assert.deepEqual(act(state, { type: 'endTurn' }).players, state.players);
  });

  test('an ineffective card still consumes the ordinary discard allowance', () => {
    let state = createGameState({ fen: 'k3r3/8/8/8/8/8/4P3/4K2N w - - 0 1',
      hands: { white: ['disintegration', 'truce'] }, decks: { white: ['crab'] } });
    state = act(state, { type: 'move', from: 'h1', to: 'f2' });
    state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'e2' });
    assert.equal(state.history.at(-1)?.type, 'cardFizzled');
    rejects(state, discard(state.players.white.hand[0].id));
    assert.equal(act(state, { type: 'endTurn' }).turn.color, 'black');
  });

  test('a previous opponent-turn reaction does not consume the next own-turn option', () => {
    let state = ready(['truce', 'crab', 'pacifism']);
    state = take(state);
    assert.equal(state.turn.cardPlays.black, 1);
    state = act(act(state, { type: 'move', from: 'g1', to: 'f3' }), { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'g8', to: 'f6' });
    assert.equal(state.turn.cardPlays.black, 0);
    exchanged(state);
  });

  test('ordinary discard supplies neither a Vulture response nor a last played card to copy', () => {
    let state = createGameState({ hands: { white: ['pacifism'], black: ['vulture', 'haunting-memories'] } });
    state = act(state, { type: 'move', from: 'g1', to: 'f3' });
    const next = exchanged(state);
    assert.deepEqual(next.playedCards, state.playedCards);
    assert.equal(next.cardResponse, undefined);
    rejects(next, { type: 'playCard', cardId: 'vulture' });
    rejects(next, { type: 'playCard', cardId: 'haunting-memories', target: 'f3' });
  });

  test('Haunting Memories keeps the previous real play across a later ordinary discard', () => {
    let state = createGameState({ hands: { white: ['pacifism', 'truce'], black: ['haunting-memories'] } });
    for (const action of [
      { type: 'playCard', cardId: 'pacifism', target: 'g1' }, { type: 'move', from: 'g1', to: 'f3' }, { type: 'endTurn' },
      { type: 'move', from: 'g8', to: 'f6' }, { type: 'endTurn' }, { type: 'move', from: 'b1', to: 'c3' },
    ] as GameAction[]) state = act(state, action);
    state = exchanged(state);
    state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: 'b8' });
    assert.equal(state.history.at(-1)?.copiedCardId, 'pacifism');
  });

  test('one remaining or no undrawn cards never reshuffles the discard pile', () => {
    for (const deck of [['crab'], []]) {
      const state = moved('white', ['truce'], deck);
      const next = exchanged(state);
      assert.deepEqual(next.players.white.deck, []);
      assert.equal(next.players.white.hand.length, deck.length);
      assert.deepEqual(next.players.white.discard, state.players.white.hand);
      const playing = act(act(next, { type: 'move', from: 'g8', to: 'f6' }), { type: 'endTurn' });
      assert.equal(playing.outcome, null);
      assert.equal(act(playing, { type: 'move', from: 'b1', to: 'c3' }).turn.moveMade, true);
    }
  });

  test('Chaos retains its existing pre-completion response and replacement-move obligations', () => {
    let state = createGameState({ hands: { white: ['truce'], black: ['chaos'] }, decks: { white: ['crab'] } });
    state = act(state, { type: 'move', from: 'g1', to: 'f3' });
    assert.ok(state.chaosCheckpoint);
    rejects(exchanged(state), { type: 'playCard', cardId: 'chaos' });
    state = act(state, { type: 'playCard', cardId: 'chaos' });
    rejects(state, discard(state.players.white.hand[0].id));
    state = act(state, { type: 'move', from: 'b1', to: 'c3' });
    exchanged(state);
  });

  test('ordinary discard preserves a completed move checkmate outcome and rejects further selection', () => {
    let state = createGameState({ fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1',
      hands: { white: ['truce'] }, decks: { white: ['crab'] } });
    state = act(state, { type: 'move', from: 'g6', to: 'g7' });
    const next = exchanged(state);
    assert.deepEqual(next.outcome, { winner: 'white', reason: 'checkmate' });
    rejects(next, discard(next.players.white.hand[0].id));
  });
});

function ready(decks: string[] = [], duplicates = 1): GameState {
  return act(createGameState({
    hands: { white: ['disintegration'], black: Array(duplicates).fill('vulture') },
    decks: { black: decks },
  }), { type: 'playCard', cardId: 'disintegration', target: 'a2' });
}

const take = (state: GameState, extra: Partial<Extract<GameAction, { type: 'playCard' }>> = {}) =>
  act(state, { type: 'playCard', cardId: 'vulture', ...extra });

function rejected(state: GameState, extra: Partial<Extract<GameAction, { type: 'playCard' }>> = {}) {
  const copy = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'vulture', ...extra });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, copy);
  assert.deepEqual(state, copy);
}

test('Vulture has its printed identity, price and artwork', () => {
  const card = CARD_CATALOG.vulture;
  assert.ok(card);
  assert.equal(card.name, 'Vulture');
  assert.equal(card.points, 5);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC9_card3.png');
});

test('takes the exact physical opponent card out of discard', () => {
  const state = ready();
  const stolen = state.players.white.discard[0];
  const next = take(state);
  assert.deepEqual(next.players.black.hand, [stolen]);
  assert.deepEqual(next.players.white.discard, []);
});

test('retrieves the immediately preceding Pacifism and retains its active proxy (FAQ 50)', () => {
  let state = createGameState({
    hands: { white: ['dubbing', 'pacifism'], black: ['vulture'] },
    decks: { black: ['fanatic', 'crab'] },
  });
  const [dubbing, pacifism] = state.players.white.hand;
  const [cost, replacement] = state.players.black.deck;
  const vulture = state.players.black.hand[0];
  for (const action of [
    { type: 'playCard', cardId: 'dubbing', target: [{ from: 'b1', to: 'c3' }] },
    { type: 'endTurn' },
    { type: 'move', from: 'g8', to: 'f6' },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'pacifism', target: 'g1' },
  ] as GameAction[]) state = act(state, action);
  const before = structuredClone(state);
  const next = take(state);
  assert.deepEqual(next.players.black.hand, [replacement, pacifism]);
  assert.deepEqual(next.players.white.discard, [dubbing]);
  assert.deepEqual(next.players.black.discard, [cost, vulture]);
  assert.deepEqual(next.players.black.deck, []);
  assert.equal(markers(next).filter(effect => effect.type === 'pacifism').length, 1);
  assert.deepEqual(state, before);
});

test('spends the explicitly selected duplicate Vulture', () => {
  const state = ready([], 2);
  const [kept, spent] = state.players.black.hand;
  const next = take(state, { cardInstanceId: spent.id });
  assert.ok(next.players.black.hand.some(card => card.id === kept.id));
  assert.deepEqual(next.players.black.discard, [spent]);
});

test('discards the top undrawn card before drawing the normal replacement', () => {
  const state = ready(['truce', 'crab', 'pacifism']);
  const [discarded, drawn, remaining] = state.players.black.deck;
  const next = take(state);
  assert.ok(next.players.black.discard.some(card => card.id === discarded.id));
  assert.ok(next.players.black.hand.some(card => card.id === drawn.id));
  assert.deepEqual(next.players.black.deck, [remaining]);
});

test('one remaining deck card is discarded without reshuffling', () => {
  const state = ready(['truce']);
  const next = take(state);
  assert.deepEqual(next.players.black.deck, []);
  assert.equal(next.players.black.hand.length, 1);
  assert.ok(next.players.black.discard.some(card => card.id === state.players.black.deck[0].id));
});

test('an exhausted deck still permits the card transfer', () => {
  const next = take(ready());
  assert.equal(next.players.black.hand[0].cardId, 'disintegration');
  assert.deepEqual(next.players.black.deck, []);
  assert.equal(next.players.black.discard.length, 1);
});

test('responds before the mover moves without consuming the regular move', () => {
  const next = take(ready());
  assert.equal(next.turn.color, 'white');
  assert.equal(next.turn.moveMade, false);
  assert.equal(next.turn.cardPlays.black, 1);
  assert.equal(act(next, { type: 'move', from: 'e2', to: 'e4' }).turn.moveMade, true);
});

test('responds immediately to an after-move card', () => {
  let state = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  const next = take(state);
  assert.equal(next.turn.color, 'white');
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.players.black.hand[0].cardId, 'disintegration');
});

test('a regular move or endTurn closes the previous card response window', () => {
  rejected(act(ready(), { type: 'move', from: 'e2', to: 'e4' }));
  let state = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  const ended = act(state, { type: 'endTurn' });
  assert.deepEqual(ended.history, state.history);
  rejected(ended);
});

test('no previous play or an unplayed discard does not enable Vulture', () => {
  const state = createGameState({ hands: { white: ['vulture'], black: ['vulture'] } });
  rejected(state);
  state.players.white.discard.push({ id: 'never-played', cardId: 'disintegration' });
  rejected(state);
});

test('the opponent alone may respond and their card allowance is enforced', () => {
  const state = ready();
  state.players.white.hand.push({ id: 'white-vulture', cardId: 'vulture' });
  rejected(state, { cardInstanceId: 'white-vulture' });
  state.turn.cardPlays.black = 1;
  rejected(state);
  const finished = ready();
  finished.outcome = { reason: 'stalemate' };
  rejected(finished);
});

test('an active Continuing Effect is retrieved with a proxy under FAQ 50', () => {
  let state = createGameState({ hands: { white: ['truce'], black: ['vulture'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'truce' });
  assert.equal(state.effects.length, 1);
  const physical = markers(state)[0].card;
  const next = take(state);
  assert.deepEqual(next.players.black.hand, [physical]);
  assert.equal(markers(next)[0].type, 'truce');
  assert.notEqual(markers(next)[0].card.id, physical.id);
});

function markers(state: GameState) {
  return state.effects as { type: string; owner: Color; card: CardInstance; pieceId?: string }[];
}

function physicalCards(state: GameState): CardInstance[] {
  const piles = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
  // FAQ 50 adds a marker, never another physical card. Every original ID must occur exactly once.
  return [...piles, ...markers(state).flatMap(effect => effect.card ? [effect.card] : [])];
}

function conserve(state: GameState, initial: GameState) {
  const cards = physicalCards(state);
  for (const original of physicalCards(initial)) {
    assert.deepEqual(cards.filter(card => card.id === original.id), [original]);
  }
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  const originalIds = new Set(physicalCards(initial).map(card => card.id));
  for (const player of Object.values(state.players)) {
    assert.ok([...player.hand, ...player.deck, ...player.discard].every(card => originalIds.has(card.id)));
  }
}

const play = (state: GameState, cardId: string, target?: unknown) => act(state, { type: 'playCard', cardId, target });
const move = (state: GameState, from: string, to: string) => act(state, { type: 'move', from, to });
const end = (state: GameState) => act(state, { type: 'endTurn' });

for (const owner of ['white', 'black'] as const) {
  const taker = owner === 'white' ? 'black' : 'white';
  const square = owner === 'white' ? 'g1' : 'g8';
  const moved = owner === 'white' ? 'f3' : 'f6';
  const initial = () => createGameState({ turn: owner,
    hands: { [owner]: ['pacifism', 'peace-talks'], [taker]: ['vulture', 'peace-talks'] },
    decks: { [taker]: ['fanatic', 'crab'] },
  });

  test(`${taker} retrieves direct active Pacifism with exact cost, replacement and immutable input`, () => {
    const start = initial();
    const state = play(start, 'pacifism', square);
    const snapshot = structuredClone(state);
    assert.deepEqual(cardPlayTargets(state, 'vulture'), [undefined]);
    const next = take(state);
    assert.deepEqual(next.players[taker].hand, [start.players[taker].hand[1], start.players[taker].deck[1], start.players[owner].hand[0]]);
    assert.deepEqual(next.players[taker].discard, [start.players[taker].deck[0], start.players[taker].hand[0]]);
    assert.deepEqual(next.players[owner].discard, []);
    assert.deepEqual(next.turn, { ...state.turn, cardPlays: { white: 1, black: 1 } });
    assert.deepEqual(legalDests(next), legalDests(state));
    assert.deepEqual(next.pieces, state.pieces);
    assert.deepEqual(state, snapshot);
    conserve(next, start);
  });

  test(`${taker} can Peace Talk the original proxy without discarding the retrieved physical card`, () => {
    const start = initial();
    let state = take(play(start, 'pacifism', square));
    const proxy = markers(state)[0].card.id;
    state = end(move(state, square, moved));
    state = move(state, owner === 'white' ? 'g8' : 'g1', owner === 'white' ? 'f6' : 'f3');
    assert.deepEqual(cardPlayTargets(state, 'peace-talks'), [proxy]);
    state = play(state, 'peace-talks', proxy);
    assert.deepEqual(state.effects, []);
    assert.ok(state.players[taker].hand.some(card => card.id === start.players[owner].hand[0].id));
    conserve(state, start);
  });
}

test('White also takes the last Black Pacifism instead of an older Dubbing', () => {
  const initial = createGameState({ turn: 'black', hands: { black: ['dubbing', 'pacifism'], white: ['vulture'] } });
  let state = end(play(initial, 'dubbing', [{ from: 'b8', to: 'c6' }]));
  state = end(move(state, 'g1', 'f3'));
  state = take(play(state, 'pacifism', 'g8'));
  assert.deepEqual(state.players.white.hand, [initial.players.black.hand[1]]);
  assert.deepEqual(state.players.black.discard, [initial.players.black.hand[0]]);
  conserve(state, initial);
});

for (const cancelOriginal of [true, false]) {
  test(`physical replay and original proxy remain independent when canceling ${cancelOriginal ? 'original' : 'replay'} first`, () => {
    const initial = createGameState({ hands: { white: ['pacifism', 'peace-talks', 'peace-talks'], black: ['vulture'] } });
    let state = take(play(initial, 'pacifism', 'g1'));
    const proxy = markers(state)[0].card.id;
    state = end(move(state, 'g1', 'f3'));
    state = move(play(state, 'pacifism', 'b8'), 'g8', 'f6');
    const physical = initial.players.white.hand[0].id;
    state = move(end(state), 'f3', 'g1');
    assert.notEqual(proxy, physical);
    assert.deepEqual(cardPlayTargets(state, 'peace-talks'), [proxy, physical]);
    assert.deepEqual(cardPlayTargets(structuredClone(state), 'peace-talks'), [proxy, physical]);
    const first = cancelOriginal ? proxy : physical;
    const last = cancelOriginal ? physical : proxy;
    state = play(state, 'peace-talks', first);
    assert.deepEqual(markers(state).map(effect => effect.card.id), [last]);
    assert.equal(state.players.black.discard.filter(card => card.id === physical).length, cancelOriginal ? 0 : 1);
    conserve(state, initial);
    state = move(end(move(end(state), 'f6', 'g8')), 'g1', 'f3');
    assert.deepEqual(cardPlayTargets(state, 'peace-talks'), [last]);
    const stale = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target: first });
    assert.equal(stale.ok, false);
    assert.deepEqual(stale.state, state);
    state = play(state, 'peace-talks', last);
    assert.deepEqual(state.effects, []);
    assert.deepEqual(state.players.black.discard.filter(card => card.id === physical), [initial.players.white.hand[0]]);
    conserve(state, initial);
  });
}

test('expiry of a moving Fatal Attraction proxy leaves the physical card in hand', () => {
  const initial = createGameState({ phase: 'afterMove', moveMade: true,
    hands: { white: ['fatal-attraction'], black: ['vulture'] } });
  let state = take(play(initial, 'fatal-attraction', 'g1'));
  state = end(move(end(state), 'g8', 'f6'));
  state = move(state, 'g1', 'f3');
  assert.deepEqual(state.effects, []);
  assert.deepEqual(state.players.black.hand, initial.players.white.hand);
  conserve(state, initial);
});

test('expiry of the original Fatal Attraction proxy preserves an independently replayed effect', () => {
  const initial = createGameState({ phase: 'afterMove', moveMade: true,
    hands: { white: ['fatal-attraction'], black: ['vulture'] } });
  let state = take(play(initial, 'fatal-attraction', 'g1'));
  state = play(move(end(state), 'g8', 'f6'), 'fatal-attraction', 'b8');
  state = move(end(state), 'g1', 'f3');
  assert.deepEqual(markers(state).map(effect => effect.card), initial.players.white.hand);
  assert.equal(markers(state)[0].pieceId, 'black-knight-b8');
  conserve(state, initial);
});

test('Doomsayer pending prompt follows its proxy and consumption never discards that proxy', () => {
  const initial = createGameState({ phase: 'afterMove', moveMade: true,
    hands: { white: ['doomsayer'], black: ['vulture'] } });
  let state = take(play(initial, 'doomsayer'));
  const proxy = markers(state)[0].card.id;
  assert.equal(state.pendingDoomsayer?.cardInstanceId, proxy);
  state = act(state, { type: 'namePiece', speaker: 'black', name: 'pawn', losses: [{ effectId: proxy, pieceId: 'black-pawn-a7' }] });
  assert.equal(state.pendingDoomsayer, null);
  assert.deepEqual(state.effects, []);
  assert.deepEqual(state.players.black.hand, initial.players.white.hand);
  conserve(state, initial);
});

test('Truce expiry on check cannot discard a physical card held by Vulture', () => {
  const initial = createGameState({ fen: '4k3/7p/8/8/8/8/R7/4K3 w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['truce'], black: ['vulture'] } });
  let state = take(play(initial, 'truce'));
  state = end(move(end(state), 'h7', 'h6'));
  state = move(state, 'a2', 'e2');
  assert.deepEqual(state.effects, []);
  conserve(state, initial);
});

test('taking a copied Continuing Effect restores physical Haunting Memories and retains the copied ancestry', () => {
  const initial = createGameState({ hands: { white: ['pacifism', 'vulture'], black: ['haunting-memories'] } });
  let state = end(move(play(initial, 'pacifism', 'g1'), 'b1', 'c3'));
  state = take(play(state, 'haunting-memories', 'g8'));
  assert.deepEqual(state.players.white.hand, [initial.players.black.hand[0]]);
  assert.deepEqual(markers(state).map(effect => effect.type), ['pacifism', 'pacifism']);
  assert.equal(markers(state)[1].card.cardId, 'haunting-memories');
  assert.notEqual(markers(state)[1].card.id, initial.players.black.hand[0].id);
  conserve(state, initial);
});

for (const location of ['hand', 'deck', 'missing'] as const) {
  test(`the genuine last card in ${location} never causes fallback to an older discard`, () => {
    const initial = createGameState({ hands: { white: ['dubbing', 'pacifism'], black: ['vulture'] } });
    let state = end(play(initial, 'dubbing', [{ from: 'b1', to: 'c3' }]));
    state = play(end(move(state, 'g8', 'f6')), 'pacifism', 'g1');
    const card = markers(state)[0].card;
    state.effects = [];
    if (location !== 'missing') state.players.white[location].push(card);
    rejected(state);
    assert.deepEqual(cardPlayTargets(state, 'vulture'), []);
  });
}

test('last regular card stays authoritative when its resolution discards an older owned effect', () => {
  const initial = createGameState({ hands: { white: ['fatal-attraction', 'disintegration'], black: ['vulture'] } });
  let state = end(play(move(initial, 'b1', 'c3'), 'fatal-attraction', 'a2'));
  state = end(move(state, 'g8', 'f6'));
  state = play(state, 'disintegration', 'a2');
  assert.equal(state.players.white.discard.at(-1)?.cardId, 'fatal-attraction');
  state = take(state);
  assert.deepEqual(state.players.black.hand, [initial.players.white.hand[1]]);
  assert.deepEqual(state.players.white.discard, [initial.players.white.hand[0]]);
  conserve(state, initial);
});

for (const cardId of ['pacifism', 'neutrality'] as const) {
  test(`${cardId} proxy disposal after its marked Pawn dies conserves the retrieved card`, () => {
    const initial = createGameState({ hands: { white: [cardId, 'disintegration'], black: ['vulture', 'disintegration'] } });
    let state = cardId === 'pacifism'
      ? take(play(initial, cardId, 'a2'))
      : take(play(move(initial, 'g1', 'f3'), cardId, 'a7'));
    if (cardId === 'pacifism') state = end(move(end(move(state, 'g1', 'f3')), 'g8', 'f6'));
    else state = end(state);
    state = play(state, 'disintegration', cardId === 'pacifism' ? 'a2' : 'a7');
    assert.deepEqual(state.effects, []);
    assert.ok(state.players.black.hand.some(card => card.id === initial.players.white.hand[0].id));
    conserve(state, initial);
  });
}

test('springing a Man-Trap proxy captures normally and never discards the retrieved card', () => {
  const initial = createGameState({ fen: '3r3k/8/8/8/3N4/8/8/7K w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['man-trap'], black: ['vulture'] } });
  let state = take(play(initial, 'man-trap', 'd4'));
  state = move(end(state), 'd8', 'd4');
  assert.deepEqual(state.effects, []);
  assert.equal(state.pieces.find(piece => piece.id === 'black-rook-d8')?.zone, 'captured');
  conserve(state, initial);
});

test('capturing a Confabulation proxy carrier preserves physical card ownership', () => {
  const initial = createGameState({ fen: '3r3k/8/8/8/3N4/8/3R4/7K w - - 0 1',
    hands: { white: ['confabulation'], black: ['vulture'] } });
  let state = take(play(initial, 'confabulation', [{ from: 'd2', to: 'd4' }]));
  state = move(end(state), 'd8', 'd4');
  assert.deepEqual(state.effects, []);
  assert.equal(state.pieces.filter(piece => piece.owner === 'white' && piece.zone === 'captured').length, 2);
  conserve(state, initial);
});

test('Vendetta proxy expires without a capture and replay preserves original unique deck ancestry', () => {
  const initial = createGameState({ phase: 'afterMove', moveMade: true,
    hands: { white: ['vendetta', 'haunting-memories'], black: ['vulture'] } });
  let state = end(take(play(initial, 'vendetta')));
  assert.deepEqual(state.effects, []);
  conserve(state, initial);
  state = play(move(state, 'g8', 'f6'), 'vendetta');
  state = move(end(state), 'g1', 'f3');
  assert.deepEqual(cardPlayTargets(state, 'haunting-memories'), []);
  const snapshot = structuredClone(state);
  const copy = applyAction(state, { type: 'playCard', cardId: 'haunting-memories' });
  assert.equal(copy.ok, false);
  assert.deepEqual(copy.state, snapshot);
  conserve(state, initial);
});

test('retrieved Haunting Memories can copy a new effect without changing the original proxy ancestry', () => {
  const initial = createGameState({ hands: { white: ['pacifism', 'vulture'], black: ['haunting-memories', 'fatal-attraction'] } });
  let state = end(move(play(initial, 'pacifism', 'g1'), 'b1', 'c3'));
  state = take(play(state, 'haunting-memories', 'g8'));
  const proxy = markers(state)[1].card.id;
  state = end(move(state, 'b8', 'c6'));
  state = end(move(state, 'c3', 'b1'));
  state = end(play(move(state, 'c6', 'b8'), 'fatal-attraction', 'b8'));
  state = play(move(state, 'b1', 'c3'), 'haunting-memories', 'c3');
  assert.equal(markers(state).find(effect => effect.card.id === proxy)?.type, 'pacifism');
  const replay = markers(state).find(effect => effect.card.id === initial.players.black.hand[0].id)!;
  assert.equal(replay.type, 'fatal-attraction');
  assert.equal(replay.card.cardId, 'haunting-memories');
  conserve(state, initial);
});

test('repeated retrieval and replay of one physical card creates distinct stable proxies', () => {
  const initial = createGameState({ hands: { white: ['pacifism', 'vulture', 'peace-talks'], black: ['vulture'] } });
  let state = take(play(initial, 'pacifism', 'g1'));
  const first = markers(state)[0].card.id;
  state = end(move(state, 'b1', 'c3'));
  state = take(play(state, 'pacifism', 'g8'));
  const second = markers(state)[1].card.id;
  assert.notEqual(first, second);
  assert.deepEqual(state.players.white.hand.filter(card => card.cardId === 'pacifism'), [initial.players.white.hand[0]]);
  state = end(move(state, 'b8', 'c6'));
  state = move(play(state, 'pacifism', 'c3'), 'g1', 'f3');
  assert.deepEqual(markers(state).map(effect => effect.card.id), [first, second, initial.players.white.hand[0].id]);
  state = move(end(move(end(state), 'c6', 'b8')), 'f3', 'g1');
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), [first, second, initial.players.white.hand[0].id]);
  conserve(state, initial);
});

test('malformed targets reject atomically', () => {
  for (const target of ['a1', [], { cardId: 'disintegration' }, 7]) rejected(ready(), { target });
});

test('missing and malformed physical instance selectors reject atomically', () => {
  for (const cardInstanceId of ['absent', 7, {}, null]) rejected(ready(), { cardInstanceId });
});

test('preserves board, input and physical card uniqueness while recording the play', () => {
  const state = ready(['truce', 'crab']);
  const copy = structuredClone(state);
  const next = take(state);
  assert.deepEqual(state, copy);
  assert.equal(boardFen(next), boardFen(state));
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.history.slice(0, -1), state.history);
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'vulture');
  const cards = Object.values(next.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  assert.equal(cards.length, 4);
});
