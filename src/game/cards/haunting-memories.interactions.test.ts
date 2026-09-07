// Haunting Memories interactions and seeded moves, authored independently before implementation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

const HM = 'haunting-memories';
const FEN = '4k3/7p/r7/8/8/R7/7P/4K3 w - - 0 1';
function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions must not mutate input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}
function source(cardId: string, target: unknown): GameState {
  let state = createGameState({ fen: FEN, phase: 'afterMove', moveMade: true,
    hands: { white: [cardId, HM, 'peace-talks'], black: [HM, 'peace-talks'] } });
  state = act(state, { type: 'playCard', cardId, target });
  state = act(state, { type: 'endTurn' });
  return act(state, { type: 'move', from: 'h7', to: 'h6' });
}
for (const [card, target, copyTarget] of [
  ['curse', 'a6', 'a3'], ['forbidden-city', 'd4', 'd5'],
] as const) {
    test(`${card} copy preserves both physical identities, zones, targets, and phase`, () => {
      const state = source(card, target);
      const instance = state.players.black.hand.find(c => c.cardId === HM)!;
      const next = act(state, { type: 'playCard', cardId: HM, target: copyTarget });
      const effects = next.effects as Array<{ type: string; owner: string; card: { id: string; cardId: string } }>;
        assert.deepEqual(effects.find(e => e.owner === 'black')?.card, instance);
        assert.ok(!next.players.black.hand.some(c => c.id === instance.id) && !next.players.black.discard.some(c => c.id === instance.id));
      assert.ok(effects.some(e => e.owner === 'white' && e.card.cardId === card));
      assert.equal(effects.filter(e => e.type === card).length, 2);
      assert.ok(cardPlayTargets(state, HM).includes(copyTarget));
      assert.equal(boardFen(next), boardFen(state));
      assert.equal(next.turn.phase, 'afterMove');
    });
}

for (const [card, target, copyTarget] of [
  ['curse', 'a6', 'a3'], ['forbidden-city', 'd4', 'd5'],
] as const) {
  test(`Peace Talks cancels copied ${card} by its physical identity only`, () => {
    let state = source(card, target);
    const copy = state.players.black.hand.find(c => c.cardId === HM)!;
    state = act(state, { type: 'playCard', cardId: HM, target: copyTarget });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h2', to: 'h3' });
    state = act(state, { type: 'playCard', cardId: 'peace-talks', target: copy.id });
    assert.deepEqual(state.players.black.discard.find(c => c.id === copy.id), copy);
    assert.equal(state.effects.length, 1);
    assert.equal((state.effects[0] as { owner: string }).owner, 'white');
  });
}

for (const card of ['blessing', 'masquerade']) {
  test(`copied ${card} replaces the regular move and discards only its own card`, () => {
    let state = createGameState({ fen: FEN, hands: { white: [card], black: [HM] } });
    const sourceCard = state.players.white.hand[0];
    const copy = state.players.black.hand[0];
    const sourceTarget = [{ from: 'a3', to: 'b4' }];
    assert.ok(cardPlayTargets(state, card).some(t => JSON.stringify(t) === JSON.stringify(sourceTarget)));
    state = act(state, { type: 'playCard', cardId: card, target: sourceTarget });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'playCard', cardId: HM, target: [{ from: 'a6', to: 'b5' }] });
    assert.equal(state.pieces.find(p => p.id === 'black-rook-a6')?.square, 'b5');
    assert.equal(state.turn.moveMade, true);
    assert.equal(state.turn.phase, 'afterMove');
    assert.deepEqual(state.players.white.discard, [sourceCard]);
    assert.deepEqual(state.players.black.discard, [copy]);
    assert.equal(applyAction(state, { type: 'move', from: 'h7', to: 'h6' }).ok, false);
  });
}

test('Pacifism copies beforeMove and Peace Talks restores the copied piece', () => {
  let state = createGameState({ fen: FEN, hands: { white: ['pacifism', 'peace-talks'], black: [HM] } });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'a3' });
  state = act(state, { type: 'move', from: 'h2', to: 'h3' });
  state = act(state, { type: 'endTurn' });
  const copy = state.players.black.hand[0];
  state = act(state, { type: 'playCard', cardId: HM, target: 'a6' });
  assert.equal(state.turn.moveMade, false);
  assert.ok(!legalDests(state).get('a6')?.includes('a3'));
  state = act(state, { type: 'move', from: 'h7', to: 'h6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h3', to: 'h4' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: copy.id });
  assert.equal(state.effects.length, 1);
  assert.deepEqual(state.players.black.discard, [copy]);
});

test('a Haunting Memories copy of Haunting Memories retains the resolved text', () => {
  let state = source('forbidden-city', 'd4');
  state = act(state, { type: 'playCard', cardId: HM, target: 'd5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h2', to: 'h3' });
  const ownCopy = state.players.white.hand.find(c => c.cardId === HM)!;
  state = act(state, { type: 'playCard', cardId: HM, target: 'e5' });
  assert.equal(state.effects.length, 3);
  assert.ok(state.effects.some(e => (e as { card: { id: string } }).card.id === ownCopy.id));
});

test('after cancellation the latest declaration is Peace Talks, not the canceled Curse', () => {
  let state = source('curse', 'a6');
  const copy = state.players.black.hand.find(c => c.cardId === HM)!;
  const sourceId = (state.effects[0] as { card: { id: string } }).card.id;
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: sourceId });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h2', to: 'h3' });
  // The latest declaration is Peace Talks, whose target requires an active effect.
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: HM, target: sourceId }).ok, false);
  assert.deepEqual(state, before);
  assert.ok(state.players.black.hand.some(c => c.id === copy.id));
});

test('a unique Vendetta declared by the same owner cannot be copied', () => {
  let state = createGameState({ fen: FEN, phase: 'afterMove', moveMade: true,
    hands: { white: ['vendetta', HM] } });
  state = act(state, { type: 'playCard', cardId: 'vendetta' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a6', to: 'a3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h2', to: 'h3' });
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: HM }).ok, false);
  assert.deepEqual(state, before);
});

test('copied Curse obeys afterMove timing before any target is accepted', () => {
  let state = createGameState({ fen: FEN, phase: 'afterMove', moveMade: true,
    hands: { white: ['curse'], black: [HM] } });
  state = act(state, { type: 'playCard', cardId: 'curse', target: 'a6' });
  state = act(state, { type: 'endTurn' });
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: HM, target: 'a3' }).ok, false);
  assert.deepEqual(state, before);
});

test('copied Curse rejects its new owner\'s rook', () => {
  const state = source('curse', 'a6');
  assert.equal(applyAction(state, { type: 'playCard', cardId: HM, target: 'a6' }).ok, false);
});

test('copied Forbidden City blocks passage on a later regular move', () => {
  let state = source('forbidden-city', 'd4');
  state = act(state, { type: 'playCard', cardId: HM, target: 'c3' });
  state = act(state, { type: 'endTurn' });
  const dests = legalDests(state).get('a3')!;
  assert.ok(dests.includes('b3'));
  assert.ok(!dests.includes('c3'));
  assert.ok(!dests.includes('d3'));
});

test('capturing the copied Curse target discards Haunting Memories and retains the source', () => {
  let state = source('curse', 'a6');
  const copy = state.players.black.hand.find(c => c.cardId === HM)!;
  state = act(state, { type: 'playCard', cardId: HM, target: 'a3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a3', to: 'a5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a6', to: 'a5' });
  assert.deepEqual(state.players.black.discard, [copy]);
  assert.equal(state.effects.length, 1);
  assert.equal(state.pieces.find(p => p.id === 'white-rook-a3')?.zone, 'captured');
});

test('copied Blessing cannot move a pinned blocker and expose its King', () => {
  let state = createGameState({ fen: '4k3/4r2p/8/8/8/4R3/7P/4K3 w - - 0 1',
    hands: { white: ['blessing'], black: [HM] } });
  state = act(state, { type: 'playCard', cardId: 'blessing', target: [{ from: 'h2', to: 'g3' }] });
  state = act(state, { type: 'endTurn' });
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: HM, target: [{ from: 'e7', to: 'f6' }] });
  assert.ok(!result.ok || result.state.pieces.find(p => p.id === 'black-rook-e7')?.square === 'e7');
  assert.deepEqual(state, before);
});

test('copied Curse constrains a later regular move without changing the piece identity', () => {
  let state = source('curse', 'a6');
  state = act(state, { type: 'playCard', cardId: HM, target: 'a3' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a3')?.includes('a4'));
  assert.ok(!legalDests(state).get('a3')?.includes('a6'));
  state = act(state, { type: 'move', from: 'a3', to: 'a4' });
  assert.equal(state.pieces.find(p => p.id === 'white-rook-a3')?.square, 'a4');
});

test('copied Forbidden City cannot target the existing forbidden square', () => {
  const state = source('forbidden-city', 'd4');
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: HM, target: 'd4' }).ok, false);
  assert.deepEqual(state, before);
});

test('opponent unique Vendetta is copyable even after the source effect expires', () => {
  let state = createGameState({ fen: FEN, phase: 'afterMove', moveMade: true,
    hands: { white: ['vendetta'], black: [HM] } });
  state = act(state, { type: 'playCard', cardId: 'vendetta' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a6')?.includes('a3'));
  state = act(state, { type: 'move', from: 'a6', to: 'a3' });
  const copy = state.players.black.hand[0];
  state = act(state, { type: 'playCard', cardId: HM });
  assert.ok(!state.players.black.hand.some(c => c.id === copy.id));
  const physical = [...state.players.black.discard, ...state.effects.flatMap(e => {
    const effect = e as { card?: { id: string; cardId: string } };
    return effect.card ? [effect.card] : [];
  })];
  assert.deepEqual(physical.find(c => c.id === copy.id), copy);
});

function invariants(state: GameState, initial: GameState) {
  assert.deepEqual(state.pieces.map(p => p.id).sort(), initial.pieces.map(p => p.id).sort());
  const board = state.pieces.filter(p => p.zone === 'board');
  assert.equal(new Set(board.map(p => p.square)).size, board.length);
  for (const p of state.pieces) {
    assert.equal(p.square !== null, p.zone === 'board');
    const original = initial.pieces.find(x => x.id === p.id)!;
    assert.equal(p.owner, original.owner);
    assert.equal(p.originalRole, original.originalRole);
  }
  for (const color of ['white', 'black'] as const) assert.equal(board.filter(p => p.owner === color && p.royal).length, 1);
  const fenBoard = createGameState({ fen: boardFen(state) }).pieces.map(p => [p.owner, p.role, p.square].join(':')).sort();
  assert.deepEqual(fenBoard, board.map(p => [p.owner, p.role, p.square].join(':')).sort());
  const cards = ['white', 'black'].flatMap(color => {
    const player = state.players[color as 'white' | 'black'];
    return [...player.hand, ...player.deck, ...player.discard];
  });
  cards.push(...state.effects.flatMap(e => {
    const effect = e as { card?: { id: string; cardId: string } };
    return effect.card ? [effect.card] : [];
  }));
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
  const initialCards = Object.values(initial.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]);
  initialCards.push(...initial.effects.flatMap(e => [(e as { card: { id: string; cardId: string } }).card]));
  assert.deepEqual(cards.map(c => c.id).sort(), initialCards.map(c => c.id).sort());
}

for (let seed = 1; seed <= 20; seed++) {
  test(`seed ${seed}: copied continuing effect with four actual randomized legal plies`, () => {
    const curse = seed % 2 === 0;
    let state = source(curse ? 'curse' : 'forbidden-city', curse ? 'a6' : 'd4');
    const initial = structuredClone(state);
    state = act(state, { type: 'playCard', cardId: HM, target: curse ? 'a3' : 'd5' });
    invariants(state, initial);
    state = act(state, { type: 'endTurn' });
    let random = seed;
    for (let ply = 0; ply < 4; ply++) {
      assert.equal(state.outcome, null, `seed ${seed}, ply ${ply} must be live`);
      const choices = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => ({ type: 'move' as const, from, to })));
      assert.ok(choices.length > 0, `seed ${seed}, ply ${ply} has legal moves`);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      state = act(state, choices[random % choices.length]);
      invariants(state, initial);
      if (ply < 3) state = act(state, { type: 'endTurn' });
    }
  });
}
