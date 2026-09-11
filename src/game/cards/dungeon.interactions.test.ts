import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions must not mutate their input');
  assert.equal(result.ok, true, JSON.stringify({ action, error: result.ok ? undefined : result.error }));
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed', `${action.cardId} must resolve, not fizzle`);
  }
  return result.state;
}

function fixture(role = 'n', black: string[] = [], white = ['dungeon']): GameState {
  return createGameState({
    fen: `4k3/8/5n2/3${role}4/8/2N5/8/4K3 w - - 12 9`,
    phase: 'afterMove', moveMade: true, hands: { white, black },
  });
}

function imprison(state: GameState, from: SquareName = 'd5', to: SquareName = 'a8'): GameState {
  const piece = state.pieces.find(p => p.square === from)!;
  const moved = act(state, { type: 'playCard', cardId: 'dungeon', target: [{ from, to }] });
  assert.deepEqual(moved.pieces.find(p => p.id === piece.id), { ...piece, square: to });
  assert.equal(moved.players.white.discard.filter(c => c.cardId === 'dungeon').length, 1);
  return moved;
}

function opponent(state: GameState): GameState {
  const next = act(state, { type: 'endTurn' });
  assert.equal(next.turn.color, 'black');
  return next;
}

// Install effects through the public card action, then reach White's after-move phase normally.
function prior(cardId: string, target: unknown, role = 'n'): GameState {
  let state = createGameState({
    fen: `4k3/8/5n2/3${role}4/8/2N5/8/4K3 b - - 12 9`,
    hands: { black: [cardId], white: ['dungeon'] },
  });
  if (cardId === 'pacifism') state = act(state, { type: 'playCard', cardId, target });
  state = act(state, { type: 'move', from: 'e8', to: 'f8' });
  if (cardId !== 'pacifism') state = act(state, { type: 'playCard', cardId, target });
  state = act(state, { type: 'endTurn' });
  return act(state, { type: 'move', from: 'c3', to: 'b5' });
}

for (const [cardId, role] of [['pacifism', 'n'], ['crab', 'p']] as const) {
  test(`Dungeon preserves a real ${cardId} effect and forbids the marked piece's move`, () => {
    const state = prior(cardId, 'd5', role);
    const moved = imprison(state);
    for (const effect of state.effects) assert.ok(moved.effects.some(item => JSON.stringify(item) === JSON.stringify(effect)));
    assert.deepEqual(legalDests(opponent(moved)).get('a8') ?? [], []);
  });
}

test('Dungeon obeys an existing Curse movement limit', () => {
  let state = createGameState({ fen: '4k3/8/5n2/3r4/8/2N5/8/4K3 b - - 0 1', hands: { black: ['curse'], white: ['dungeon'] } });
  // Curse must name an opposing slider, so use a neutral Rook, which qualifies for both players.
  state.pieces.find(p => p.square === 'd5')!.neutral = true;
  state = act(state, { type: 'move', from: 'e8', to: 'f8' });
  state = act(state, { type: 'playCard', cardId: 'curse', target: 'd5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'c3', to: 'b5' });
  const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd5', to: 'a8' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Dungeon cannot enter a corner occupied by Forbidden City', () => {
  const state = prior('forbidden-city', 'a8');
  const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd5', to: 'a8' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Dungeon relocation is legal during an actual Truce and retains Truce', () => {
  const state = prior('truce', undefined);
  const moved = imprison(state);
  for (const effect of state.effects) assert.ok(moved.effects.some(item => JSON.stringify(item) === JSON.stringify(effect)));
  assert.deepEqual(legalDests(opponent(moved)).get('a8') ?? [], []);
});

test('Dungeon uses fixed corners after a real Earthquake', () => {
  const state = prior('earthquake', { direction: 'counterclockwise', promotions: [] });
  assert.equal(state.orientation, 90);
  const moved = imprison(state);
  assert.equal(moved.orientation, state.orientation);
  assert.deepEqual(legalDests(opponent(moved)).get('a8') ?? [], []);
});

for (const [cardId, to] of [['dubbing', 'c7'], ['masquerade', 'a6'], ['blessing', 'c6'], ['figure-dance', undefined]] as const) {
  test(`a later ${cardId} overrides Dungeon for its authorized movement`, () => {
    let control = createGameState({ fen: 'n3k3/8/5n2/8/8/2N5/8/4K3 b - - 0 1', hands: { black: [cardId] } });
    if (cardId === 'figure-dance') control = act(control, { type: 'move', from: 'f6', to: 'g4' });
    act(control, { type: 'playCard', cardId, target: to ? [{ from: 'a8', to }] : [] });
    let state = opponent(imprison(fixture('n', [cardId])));
    if (cardId === 'figure-dance') state = act(state, { type: 'move', from: 'f6', to: 'g4' });
    const result = act(state, { type: 'playCard', cardId, target: to ? [{ from: 'a8', to }] : [] });
    assert.equal(result.pieces.find(piece => piece.id === 'black-knight-d5')?.square, to ?? 'a1');
    assert.deepEqual(result.effects, state.effects, 'the ordinary-move ban remains until turn end');
  });
}

test('Dungeon suppresses regular moves and permits a spare piece to complete the turn', () => {
  let state = opponent(imprison(fixture()));
  assert.deepEqual(legalDests(state).get('a8') ?? [], []);
  assert.equal(applyAction(state, { type: 'move', from: 'a8', to: 'b6' }).ok, false);
  state = act(state, { type: 'move', from: 'f6', to: 'g4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'c3', to: 'b5' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a8')?.includes('b6'));
  act(state, { type: 'move', from: 'a8', to: 'b6' });
});

test('Dungeon does not expose a retained effect to Peace Talks', () => {
  let state = opponent(imprison(fixture('n', ['peace-talks'])));
  assert.deepEqual(legalDests(state).get('a8') ?? [], []);
  state = act(state, { type: 'move', from: 'f6', to: 'g4' });
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'peace-talks' }).ok, false);
});

test('Peace Talks can remove Pacifism without removing the independent Dungeon ban', () => {
  let state = prior('pacifism', 'd5');
  state.players.black.hand.push({ id: 'black-peace', cardId: 'peace-talks' });
  let control = opponent(state);
  control = act(control, { type: 'move', from: 'f6', to: 'g4' });
  act(control, { type: 'playCard', cardId: 'peace-talks', target: cardPlayTargets(control, 'peace-talks')[0] });
  state = opponent(imprison(state));
  assert.deepEqual(legalDests(state).get('a8') ?? [], []);
  state = act(state, { type: 'move', from: 'f6', to: 'g4' });
  const targets = cardPlayTargets(state, 'peace-talks');
  assert.equal(targets.length, 1);
  const independentEffects = state.effects.filter(effect => (effect as { type: string }).type !== 'pacifism');
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: targets[0] });
  assert.deepEqual(state.effects, independentEffects);
});

test('Haunting Memories copies Dungeon relocation and its following-turn restriction', () => {
  let state = opponent(imprison(fixture('n', ['haunting-memories'])));
  state = act(state, { type: 'move', from: 'f6', to: 'g4' });
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: [{ from: 'c3', to: 'h1' }] });
  assert.equal(state.history.at(-1)?.copiedCardId, 'dungeon');
  state = act(state, { type: 'endTurn' });
  assert.deepEqual(legalDests(state).get('h1') ?? [], []);
});

test('Dungeon allows the opponent to swap its prisoner using Holy War', () => {
  let control = createGameState({ fen: 'n3k3/8/5b2/8/8/2N5/8/4K3 b - - 0 1', hands: { black: ['holy-war'] } });
  control = act(control, { type: 'move', from: 'e8', to: 'f8' });
  act(control, { type: 'playCard', cardId: 'holy-war', target: { knight: 'a8', bishop: 'f6' } });
  let state = createGameState({ fen: '4k3/8/5b2/3n4/8/2N5/8/4K3 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['dungeon'], black: ['holy-war'] } });
  const id = state.pieces.find(p => p.square === 'd5')!.id;
  state = opponent(imprison(state));
  state = act(state, { type: 'move', from: 'e8', to: 'f8' });
  state = act(state, { type: 'playCard', cardId: 'holy-war', target: { knight: 'a8', bishop: 'f6' } });
  assert.equal(state.pieces.find(p => p.id === id)?.square, 'f6');
});

test('Dungeon permits capture of the prisoner by an ordinary opposing piece', () => {
  let state = createGameState({ fen: '4k3/8/5n2/3n4/8/8/8/R3K3 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['dungeon'] } });
  const id = state.pieces.find(p => p.square === 'd5')!.id;
  state = opponent(imprison(state));
  state = act(state, { type: 'move', from: 'f6', to: 'g4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a8' });
  assert.equal(state.pieces.find(p => p.id === id)?.zone, 'captured');
});

test('Dungeon suppresses a neutral prisoner only for the named opponent', () => {
  let state = fixture();
  state.pieces.find(p => p.square === 'd5')!.neutral = true;
  state = opponent(imprison(state));
  assert.deepEqual(legalDests(state).get('a8') ?? [], []);
  state = act(state, { type: 'move', from: 'f6', to: 'g4' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a8')?.includes('b6'));
  act(state, { type: 'move', from: 'a8', to: 'b6' });
});

test('Dungeon preserves clocks while revoking moved Rook castling eligibility', () => {
  const state = createGameState({ fen: 'r3k3/8/8/8/8/2N5/8/4K3 w q - 17 23', phase: 'afterMove', moveMade: true, hands: { white: ['dungeon'] } });
  const moved = imprison(state, 'a8', 'h8');
  assert.deepEqual(moved.fen.split(' ').slice(4), ['17', '23']);
  assert.equal(moved.fen.split(' ')[2], '-');
});

for (let seed = 1; seed <= 20; seed++) {
  test(`Dungeon seeded integration ${seed} completes four ordinary plies with invariants`, () => {
    let random = seed;
    const next = (length: number) => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) % length);
    const corner = (['a1', 'a8', 'h1', 'h8'] as const)[next(4)]!;
    let state = fixture();
    const ids = state.pieces.map(p => p.id).sort();
    const cardIds = Object.values(state.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]).map(c => c.id).sort();
    state = opponent(imprison(state, 'd5', corner));
    for (let ply = 0; ply < 4; ply++) {
      if (ply === 0) assert.deepEqual(legalDests(state).get(corner) ?? [], []);
      const moves = [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => ({ from, to })))
        .filter(move => !state.pieces.some(p => p.zone === 'board' && p.square === move.to));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${ply}: spare mobility`);
      const move = moves[next(moves.length)]!;
      state = act(state, { type: 'move', ...move });
      assert.deepEqual(state.pieces.map(p => p.id).sort(), ids);
      assert.equal(state.pieces.filter(p => p.royal && p.zone === 'board').length, 2);
      const squares = state.pieces.filter(p => p.zone === 'board').map(p => p.square);
      assert.equal(new Set(squares).size, squares.length);
      assert.equal(squares.includes(null), false);
      assert.deepEqual(Object.values(state.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]).map(c => c.id).sort(), cardIds);
      assert.equal(boardFen(state), state.fen.split(' ')[0]);
      assert.doesNotThrow(() => createGameState({ fen: state.fen }));
      state = act(state, { type: 'endTurn' });
    }
    assert.equal(state.history.filter(e => e.type === 'move').length, 4);
  });
}
