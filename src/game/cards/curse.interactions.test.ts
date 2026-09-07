// Curse interaction and seeded move tests, authored independently before implementation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function step(state: GameState, action: GameAction): GameState {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, snapshot, 'actions do not mutate their input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  assert.equal(boardFen(result.state), result.state.fen.split(' ')[0]);
  const onboard = result.state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(onboard.map(piece => piece.square)).size, onboard.length);
  assert.equal(new Set(result.state.pieces.map(piece => piece.id)).size, result.state.pieces.length);
  assert.deepEqual(result.state.pieces.map(piece => piece.id).sort(), snapshot.pieces.map(piece => piece.id).sort());
  assert.equal(onboard.filter(piece => piece.royal).length, 2);
  for (const piece of result.state.pieces) {
    assert.equal(piece.square !== null, piece.zone === 'board');
    const prior = snapshot.pieces.find(prior => prior.id === piece.id)!;
    for (const key of ['owner', 'role', 'originalRole', 'promoted', 'neutral'] as const) {
      assert.equal(piece[key], prior[key], `physical identity field ${key}`);
    }
  }
  return result.state;
}

function curse(fen = '7k/8/8/3r4/8/8/8/K7 w - - 0 1', black: string[] = [], effects: unknown[] = []): GameState {
  const state = createGameState({ fen, phase: 'afterMove', moveMade: true,
    hands: { white: ['curse'], black } });
  state.effects = effects;
  return step(step(state, { type: 'playCard', cardId: 'curse', target: 'd5' }), { type: 'endTurn' });
}

for (const [symbol, short, long] of [
  ['r', ['d6', 'd7', 'd4', 'd3', 'c5', 'b5', 'e5', 'f5'], ['d8', 'd2', 'd1', 'a5', 'g5', 'h5']],
  ['b', ['c6', 'b7', 'e6', 'f7', 'c4', 'b3', 'e4', 'f3'], ['a8', 'g8', 'a2', 'g2', 'h1']],
  ['q', ['d6', 'd7', 'b7', 'f3'], ['d8', 'a8', 'g2']],
] as const) {
  const fen = `7k/8/8/3${symbol}4/8/8/8/K7 w - - 0 1`;
  test(`Curse allows short ${symbol} movement in all sampled directions`, () => {
    const before = createGameState({ fen, turn: 'black' });
    for (const to of short) assert.ok(legalDests(before).get('d5')?.includes(to));
    const state = curse(fen);
    for (const to of short) {
      assert.ok(legalDests(state).get('d5')?.includes(to));
      step(state, { type: 'move', from: 'd5', to });
    }
  });
  test(`Curse removes otherwise legal long ${symbol} moves`, () => {
    const before = createGameState({ fen, turn: 'black' });
    for (const to of long) assert.ok(legalDests(before).get('d5')?.includes(to));
    const state = curse(fen);
    const snapshot = structuredClone(state);
    for (const to of long) {
      assert.ok(!legalDests(state).get('d5')?.includes(to));
      assert.equal(applyAction(state, { type: 'move', from: 'd5', to }).ok, false);
    }
    assert.deepEqual(state, snapshot);
  });
}

test('Curse marker follows the physical rook across turns', () => {
  let state = curse();
  state = step(state, { type: 'move', from: 'd5', to: 'd7' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'a1', to: 'a2' });
  state = step(state, { type: 'endTurn' });
  assert.ok(!legalDests(state).get('d7')?.includes('d3'));
  assert.ok(legalDests(state).get('d7')?.includes('d5'));
});

for (const [cardId, to, allowed] of [
  ['masquerade', 'f7', true], ['masquerade', 'g8', false],
  ['blessing', 'f7', true], ['blessing', 'g8', false],
] as const) {
  test(`Curse with ${cardId} ${allowed ? 'allows' : 'rejects'} d5-${to}`, () => {
    const action: GameAction = { type: 'playCard', cardId, target: [{ from: 'd5', to }] };
    step(createGameState({ fen: '7k/8/8/3r4/8/8/8/K7 b - - 0 1',
      hands: { black: [cardId] } }), action);
    const state = curse(undefined, [cardId]);
    if (allowed) step(state, action);
    else {
      const snapshot = structuredClone(state);
      assert.equal(applyAction(state, action).ok, false);
      assert.deepEqual(state, snapshot);
    }
  });
}

for (const blocked of ['d6', 'd7'] as const) {
  test(`Curse obeys Forbidden City ${blocked === 'd6' ? 'path' : 'destination'} exclusion`, () => {
    const state = curse(undefined, [], [{ type: 'forbidden-city', owner: 'white',
      card: { id: 'existing-forbidden-city', cardId: 'forbidden-city' }, square: blocked }]);
    assert.ok(!legalDests(state).get('d5')?.includes('d7'));
    assert.equal(applyAction(state, { type: 'move', from: 'd5', to: 'd7' }).ok, false);
    step(state, { type: 'move', from: 'd5', to: 'f5' });
  });
}

test('Pacifism and Curse both restrict the same rook', () => {
  const state = curse('7k/8/3N4/3r4/8/8/8/K7 w - - 0 1', [], [{
    type: 'pacifism', owner: 'black', card: { id: 'existing-pacifism', cardId: 'pacifism' },
    pieceId: 'black-rook-d5',
  }]);
  assert.ok(!legalDests(state).get('d5')?.includes('d6'));
  assert.ok(!legalDests(state).get('d5')?.includes('h5'));
  step(state, { type: 'move', from: 'd5', to: 'f5' });
});

test('Curse preserves a Pacifist target immunity from capture', () => {
  let state = curse('7k/8/8/3r4/8/8/3R4/K7 w - - 0 1', [], [{
    type: 'pacifism', owner: 'black', card: { id: 'existing-pacifism', cardId: 'pacifism' },
    pieceId: 'black-rook-d5',
  }]);
  state = step(state, { type: 'move', from: 'h8', to: 'h7' });
  state = step(state, { type: 'endTurn' });
  assert.ok(!legalDests(state).get('d2')?.includes('d5'));
  assert.equal(applyAction(state, { type: 'move', from: 'd2', to: 'd5' }).ok, false);
});

test('Capturing the cursed piece expires and discards Curse', () => {
  let state = curse('7k/8/8/3r4/8/8/3R4/K7 w - - 0 1');
  state = step(state, { type: 'move', from: 'h8', to: 'h7' });
  state = step(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('d2')?.includes('d5'));
  state = step(state, { type: 'move', from: 'd2', to: 'd5' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-rook-d5')?.zone, 'captured');
  assert.equal(state.effects.length, 0);
  assert.ok(state.players.white.discard.some(card => card.cardId === 'curse'));
});

test('Unmarked friendly slider retains its full range', () => {
  const state = curse('7k/8/8/3r4/8/8/7r/K7 w - - 0 1');
  assert.ok(legalDests(state).get('h2')?.includes('b2'));
  step(state, { type: 'move', from: 'h2', to: 'b2' });
});

test('Peace Talks discards Curse and restores the marked rook range', () => {
  let state = curse(undefined, ['peace-talks']);
  state = step(state, { type: 'move', from: 'h8', to: 'h7' });
  state = step(state, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-curse' });
  assert.equal(state.effects.length, 0);
  assert.ok(state.players.white.discard.some(card => card.cardId === 'curse'));
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'a1', to: 'b1' });
  state = step(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('d5')?.includes('d8'));
  step(state, { type: 'move', from: 'd5', to: 'd8' });
});

test('Curse restricts a Bishop made royal by Coup without changing royal identity', () => {
  let state = createGameState({ fen: '7k/8/8/3b4/8/8/8/K7 b - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { black: ['coup'], white: ['curse'] } });
  state = step(state, { type: 'playCard', cardId: 'coup', target: 'd5' });
  state = step(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a1')?.includes('b1'));
  state = step(state, { type: 'move', from: 'a1', to: 'b1' });
  state = step(state, { type: 'playCard', cardId: 'curse', target: 'd5' });
  state = step(state, { type: 'endTurn' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-bishop-d5')?.royal, true);
  assert.ok(!legalDests(state).get('d5')?.includes('a8'));
  assert.ok(legalDests(state).get('d5')?.includes('b7'));
  step(state, { type: 'move', from: 'd5', to: 'b7' });
});

function distance(from: SquareName, to: SquareName): number {
  return Math.max(Math.abs(from.charCodeAt(0) - to.charCodeAt(0)), Math.abs(Number(from[1]) - Number(to[1])));
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Curse seeded legal-move integration ${seed}`, () => {
    let rng = seed;
    const pick = (length: number) => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng % length;
    };
    const symbol = ['r', 'b', 'q'][pick(3)];
    let state = curse(`7k/8/8/3${symbol}4/8/8/7P/K7 w - - 0 1`);
    const affectedId = state.pieces.find(piece => piece.square === 'd5')!.id;
    for (let ply = 0; ply < 4; ply++) {
      const legal = legalDests(state);
      const affected = state.pieces.find(piece => piece.id === affectedId)!;
      if (affected.zone === 'board' && affected.owner === state.turn.color) {
        for (const to of legal.get(affected.square!) ?? []) {
          assert.ok(distance(affected.square!, to) <= 2, `seed ${seed}: cursed move exceeds two squares`);
        }
      }
      const candidates = [...legal].flatMap(([from, dests]) => dests.map(to => ({ from, to })));
      const choices = ply === 0 ? candidates.filter(move => move.from === 'd5') : candidates;
      assert.ok(choices.length > 0, `seed ${seed}, ply ${ply}: live fixture`);
      state = step(state, { type: 'move', ...choices[pick(choices.length)] });
      state = step(state, { type: 'endTurn' });
    }
    assert.equal(state.history.filter(event => event.type === 'move').length, 4);
  });
}
