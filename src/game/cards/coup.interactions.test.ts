import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { CardInstance, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const original = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, original);
  assert.equal(result.ok, true, JSON.stringify(action));
  const occupied = result.state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
  assert.equal(new Set(occupied).size, occupied.length);
  assert.equal(boardFen(result.state), result.state.fen.split(' ')[0]);
  return result.state;
}

function crown(fen = '7k/8/8/8/3N4/8/8/K7 w - - 0 1', target = 'd4', extra: string[] = []): GameState {
  return act(createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['coup', ...extra], black: ['peace-talks', 'challenge'] } }), { type: 'playCard', cardId: 'coup', target });
}

function nextWhite(state: GameState): GameState {
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  return act(state, { type: 'endTurn' });
}

function cards(state: GameState): string[] {
  const result = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard].map(card => card.id));
  for (const effect of state.effects) {
    if (typeof effect === 'object' && effect !== null && 'card' in effect) result.push((effect.card as CardInstance).id);
  }
  return result.sort();
}

for (const target of ['a2', 'c3'] as const) {
  test(`Coup interaction: the moved position can crown ${target}`, () => {
    const initial = createGameState({ fen: '7k/8/8/8/8/8/P7/1N2K3 w - - 0 1', hands: { white: ['coup'] } });
    const moved = applyAction(initial, { type: 'move', from: 'b1', to: 'c3' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    const crowned = applyAction(moved.state, { type: 'playCard', cardId: 'coup', target });
    assert.equal(crowned.ok, true);
    if (!crowned.ok) return;
    assert.equal(applyAction(crowned.state, { type: 'endTurn' }).ok, true);
  });
}

test('Coup interaction: a royal Knight keeps Knight movement', () => {
  const state = createGameState({ fen: '7k/8/8/8/3N4/8/8/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['coup'], black: [] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'coup', target: 'd4' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(legalDests(nextWhite(result.state)).get('d4')?.includes('f5'));
});

test('Coup interaction: a royal Bishop keeps Bishop movement', () => {
  const state = createGameState({ fen: '7k/8/8/8/3B4/8/8/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['coup'], black: [] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'coup', target: 'd4' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(legalDests(nextWhite(result.state)).get('d4')?.includes('f6'));
});

test('Coup interaction: royal Pawn retains its initial double step', () => {
  const state = nextWhite(crown('7k/8/8/8/8/8/3P4/K7 w - - 0 1', 'd2'));
  assert.ok(legalDests(state).get('d2')?.includes('d4'));
  assert.ok(!legalDests(state).get('d2')?.includes('e3'));
});

test('Coup interaction: Prince retains one-square King movement', () => {
  const state = nextWhite(crown());
  assert.deepEqual(legalDests(state).get('a1')?.sort(), ['a2', 'b1', 'b2']);
});

test('Coup interaction: crowning does not grant another ordinary move', () => {
  assert.equal(legalDests(crown()).size, 0);
});

test('Coup interaction: royalty and physical identity travel with the Knight', () => {
  const state = nextWhite(crown());
  const knight = state.pieces.find(piece => piece.square === 'd4')!;
  const moved = act(state, { type: 'move', from: 'd4', to: 'f5' });
  assert.equal(moved.pieces.find(piece => piece.id === knight.id)?.square, 'f5');
  assert.equal(moved.pieces.find(piece => piece.id === knight.id)?.royal, true);
  assert.equal(moved.pieces.find(piece => piece.id === knight.id)?.role, 'knight');
  assert.equal(boardFen(moved), '8/7k/8/5N2/8/8/8/K7');
});

test('Coup interaction: Pacifism cannot newly mark the royal Knight', () => {
  const state = nextWhite(crown(undefined, undefined, ['pacifism']));
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'pacifism', target: 'd4' }).ok, false);
});

test('Coup interaction: Pacifism can mark the capturable Prince', () => {
  const state = nextWhite(crown(undefined, undefined, ['pacifism']));
  const marked = act(state, { type: 'playCard', cardId: 'pacifism', target: 'a1' });
  assert.equal(marked.pieces.find(piece => piece.square === 'a1')?.royal, false);
});

test('Coup interaction: a pre-existing Pacifism marker remains on its physical piece', () => {
  let state = createGameState({ fen: '7k/8/8/8/3N4/8/8/K7 w - - 0 1', hands: { white: ['pacifism', 'coup'] } });
  const knightId = state.pieces.find(piece => piece.square === 'd4')!.id;
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'd4' });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = nextWhite(state);
  state = act(state, { type: 'move', from: 'a2', to: 'a1' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'd4' });
  assert.ok(state.effects.some(effect => (effect as { type?: string; pieceId?: string }).type === 'pacifism' && (effect as { pieceId?: string }).pieceId === knightId));
  assert.equal(state.pieces.find(piece => piece.id === knightId)?.royal, true);
});

test('Coup interaction: a royal Crab keeps forward diagonal movement', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/3P4/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['crab', 'coup'] } });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'd2' });
  state = nextWhite(state);
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'd2' });
  const view = { ...state, turn: { ...state.turn, phase: 'beforeMove' as const, moveMade: false, cardPlays: { white: 0, black: 0 } } };
  assert.deepEqual(legalDests(view).get('d2')?.sort(), ['c3', 'e3']);
});

test('Coup interaction: Challenge cannot select the replacement King', () => {
  let state = act(crown(), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'd4' }).ok, false);
});

test('Coup interaction: Challenge can select a mobile Prince', () => {
  let state = act(crown(), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'playCard', cardId: 'challenge', target: 'a1' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a1')?.length);
  assert.equal(legalDests(state).get('d4')?.length ?? 0, 0);
});

test('Coup interaction: Charge still recognizes a royal Knight', () => {
  let state = nextWhite(crown(undefined, undefined, ['charge']));
  state = act(state, { type: 'move', from: 'd4', to: 'f5' });
  state = act(state, { type: 'playCard', cardId: 'charge', target: [{ from: 'f5', to: 'd6' }] });
  assert.equal(state.pieces.find(piece => piece.square === 'd6')?.royal, true);
});

test('Coup interaction: Peace Talks restores the living Prince and discards Coup', () => {
  let state = act(crown(), { type: 'endTurn' });
  const inventory = cards(state);
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  const targets = cardPlayTargets(state, 'peace-talks');
  assert.equal(targets.length, 1);
  const effect = state.effects.find(effect => (effect as { card?: CardInstance }).card?.cardId === 'coup') as { card: CardInstance };
  assert.deepEqual(targets, [effect.card.id]);
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: effect.card.id });
  assert.equal(state.pieces.find(piece => piece.square === 'a1')?.royal, true);
  assert.equal(state.pieces.find(piece => piece.square === 'd4')?.royal, false);
  assert.ok(state.players.white.discard.some(card => card.cardId === 'coup'));
  assert.deepEqual(cards(state), inventory);
});

test('Coup interaction: captured Prince cannot be restored by Peace Talks', () => {
  let state = act(crown('k3r3/8/8/8/3N4/8/8/4K3 w - - 0 1'), { type: 'endTurn' });
  const prince = state.pieces.find(piece => piece.square === 'e1')!;
  const effect = state.effects.find(effect => (effect as { card?: CardInstance }).card?.cardId === 'coup') as { card: CardInstance };
  state = act(state, { type: 'move', from: 'e8', to: 'e1' });
  assert.equal(state.pieces.find(piece => piece.id === prince.id)?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.square === 'd4')?.royal, true);
  assert.equal(state.outcome, null);
  assert.equal(cardPlayTargets(state, 'peace-talks').length, 0);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'peace-talks', target: effect.card.id }).ok, false);
});

for (let seed = 1; seed <= 20; seed += 1) {
  test(`Coup seeded interaction ${seed}: four legal plies preserve identity, royal safety, and cards`, () => {
    let random = seed;
    const pick = (length: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % length; };
    let state = createGameState({ fen: '7k/6p1/8/8/8/8/P7/1N2K3 w - - 0 1', hands: { white: ['coup'], black: [] } });
    const inventory = cards(state);
    const identities = state.pieces.map(piece => piece.id).sort();
    state = act(state, { type: 'move', from: 'b1', to: 'c3' });
    state = act(state, { type: 'playCard', cardId: 'coup', target: 'c3' });
    state = act(state, { type: 'endTurn' });
    for (let ply = 0; ply < 4; ply += 1) {
      const choices: Array<[SquareName, SquareName]> = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => [from, to] as [SquareName, SquareName]));
      assert.ok(choices.length > 0);
      const [from, to] = choices[pick(choices.length)]!;
      const mover = state.turn.color;
      state = act(state, { type: 'move', from, to });
      assert.equal(isKingInCheck(state, mover), false);
      assert.deepEqual(state.pieces.map(piece => piece.id).sort(), identities);
      assert.deepEqual(cards(state), inventory);
      for (const owner of ['white', 'black'] as const) assert.equal(state.pieces.filter(piece => piece.owner === owner && piece.zone === 'board' && piece.royal).length, 1);
      assert.equal(state.pieces.find(piece => piece.id === 'white-knight-b1')?.royal, true);
      state = act(state, { type: 'endTurn' });
    }
  });
}
