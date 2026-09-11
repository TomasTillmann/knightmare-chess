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

for (const color of ['white', 'black'] as const) for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
  test(`Coup interaction: ${color} royal Pawn promotion to ${promotion} preserves only eligible royalty`, () => {
    const white = color === 'white';
    const princeId = white ? 'white-king-a1' : 'black-king-a8';
    const pawnId = white ? 'white-pawn-c7' : 'black-pawn-c2';
    let state = createGameState({ fen: white ? '7k/2P5/8/8/8/8/8/K7 w - - 0 1' : 'k7/8/8/8/8/8/2p5/7K b - - 0 1', hands: { [color]: ['coup', 'under-elf-hill'] } });
    state = act(state, { type: 'move', from: white ? 'a1' : 'a8', to: white ? 'a2' : 'a7' });
    state = act(state, { type: 'playCard', cardId: 'coup', target: white ? 'c7' : 'c2' });
    const inventory = cards(state);
    const retained = structuredClone(state.effects);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: white ? 'h8' : 'h1', to: white ? 'h7' : 'h2' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: white ? 'c7' : 'c2', to: white ? 'c8' : 'c1', promotion });
    const suspended = promotion === 'queen' || promotion === 'rook';
    assert.equal(state.pieces.find(piece => piece.id === princeId)?.royal, suspended);
    const pawn = state.pieces.find(piece => piece.id === pawnId)!;
    assert.equal(pawn.royal, !suspended);
    assert.equal(pawn.owner, color);
    assert.equal(pawn.role, promotion);
    assert.equal(pawn.originalRole, 'pawn');
    assert.equal(pawn.promoted, true);
    assert.deepEqual(state.fen.split(' ').slice(4), ['0', white ? '2' : '3']);
    assert.deepEqual(cards(state), inventory);
    assert.deepEqual(state.effects.map(effect => (effect as { card: CardInstance }).card), retained.map(effect => (effect as { card: CardInstance }).card));
    assert.equal(state.players[color].discard.length, 0);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: white ? 'h7' : 'h2', to: white ? 'h6' : 'h3' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'playCard', cardId: 'under-elf-hill' });
    assert.equal(state.underElfHill?.at(-1)?.pieceId, suspended ? princeId : pawnId);
    assert.equal(state.pieces.find(piece => piece.id === (suspended ? princeId : pawnId))?.zone, 'away');
  });
}

for (const cardId of ['figure-dance', 'earthquake'] as const) {
  for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
    test(`Coup interaction: ${cardId} promotion to ${promotion} updates royalty atomically`, () => {
      const dance = cardId === 'figure-dance';
      let state = crown(dance ? '3k4/8/8/8/8/8/4K3/7P w - - 0 1' : '3k4/8/8/8/7P/8/4K3/8 w - - 0 1', dance ? 'h1' : 'h4', [cardId]);
      state = act(state, { type: 'endTurn' });
      state = act(state, { type: 'move', from: 'd8', to: 'd7' });
      state = act(state, { type: 'endTurn' });
      state = act(state, { type: 'move', from: 'e2', to: 'e3' });
      const target = dance ? [{ square: 'h8', role: promotion }] : { direction: 'counterclockwise', promotions: [{ square: 'h4', role: promotion }] };
      state = act(state, { type: 'playCard', cardId, target });
      assert.equal(state.history.at(-1)?.type, 'cardPlayed');
      const suspended = promotion === 'queen' || promotion === 'rook';
      assert.equal(state.pieces.find(piece => piece.id === 'white-king-e2')?.royal, suspended);
      assert.equal(state.pieces.find(piece => piece.id === (dance ? 'white-pawn-h1' : 'white-pawn-h4'))?.royal, !suspended);
    });
  }
}

for (const rescued of [false, true]) {
  test(`Coup interaction: promotion checks the restored King${rescued ? ' with an available rescue' : ''}`, () => {
    let state = nextWhite(crown('7k/2P5/8/8/3N4/8/8/Kr6 w - - 0 1', 'c7', rescued ? ['coup'] : []));
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'move', from: 'c7', to: 'c8', promotion: 'queen' });
    assert.deepEqual(state, before);
    assert.equal(result.ok, rescued);
    if (!result.ok) return;
    assert.ok(result.state.pendingRescue);
    assert.ok(isKingInCheck(result.state, 'white'));
    assert.equal(applyAction(result.state, { type: 'endTurn' }).ok, false);
    state = act(result.state, { type: 'playCard', cardId: 'coup', target: 'd4' });
    assert.equal(state.pieces.find(piece => piece.id === 'white-knight-d4')?.royal, true);
    assert.equal(state.pendingRescue, null);
  });
}

test('Coup interaction: Peace Talks removes suspended Coup without changing the promoted role', () => {
  let state = nextWhite(crown('7k/2P5/8/8/8/8/8/K7 w - - 0 1', 'c7'));
  state = act(state, { type: 'move', from: 'c7', to: 'c8', promotion: 'rook' });
  const effect = state.effects.find(effect => (effect as { card?: CardInstance }).card?.cardId === 'coup') as { card: CardInstance };
  const inventory = cards(state);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h6' });
  assert.ok(cardPlayTargets(state, 'peace-talks').includes(effect.card.id));
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: effect.card.id });
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-a1')?.royal, true);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c7')?.role, 'rook');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c7')?.royal, false);
  assert.deepEqual(cards(state), inventory);
  assert.ok(state.players.white.discard.some(card => card.id === effect.card.id));
});

test('Coup interaction: Peace Talks can remove suspended Coup after the promoted piece is captured', () => {
  let state = createGameState({ fen: 'r6k/2P5/8/8/8/8/8/K7 w - - 0 1', hands: { white: ['coup'], black: ['peace-talks'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'b1' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'c7' });
  const card = structuredClone((state.effects[0] as { card: CardInstance }).card);
  state = nextWhite(state);
  state = act(state, { type: 'move', from: 'c7', to: 'c8', promotion: 'queen' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a8', to: 'c8' });
  const pieces = structuredClone(state.pieces);
  const inventory = cards(state);
  assert.ok(cardPlayTargets(state, 'peace-talks').includes(card.id));
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: card.id });
  assert.deepEqual(state.pieces, pieces);
  assert.deepEqual(cards(state), inventory);
  assert.ok(state.players.white.discard.some(candidate => candidate.id === card.id));
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c7')?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-a1')?.royal, true);
});

test('Coup interaction: cancelling inactive Coup preserves an independent King whose Prince was captured', () => {
  let state = createGameState({ fen: 'r6k/2P5/8/8/3N4/8/8/K7 w - - 0 1', hands: { white: ['coup', 'coup'], black: ['peace-talks'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'b1' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'c7' });
  const inactive = structuredClone((state.effects[0] as { card: CardInstance }).card);
  state = nextWhite(state);
  state = act(state, { type: 'move', from: 'c7', to: 'c8', promotion: 'queen' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a8', to: 'b8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b1', to: 'b2' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'd4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b8', to: 'b2' });
  const pieces = structuredClone(state.pieces);
  const active = structuredClone(state.effects[1]);
  const inventory = cards(state);
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), [inactive.id]);
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: inactive.id });
  assert.deepEqual(state.pieces, pieces);
  assert.deepEqual(state.effects, [active]);
  assert.deepEqual(cards(state), inventory);
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-d4')?.royal, true);
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-a1')?.zone, 'captured');
});

for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
  test(`Coup interaction: promotion to ${promotion} cannot restore a captured Prince`, () => {
    let state = crown('k6r/2P5/8/8/8/8/8/7K w - - 0 1', 'c7');
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h8', to: 'h1' });
    state = act(state, { type: 'endTurn' });
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'move', from: 'c7', to: 'c8', promotion });
    assert.deepEqual(state, before);
    assert.equal(result.ok, promotion === 'bishop' || promotion === 'knight');
    assert.equal(result.state.pieces.find(piece => piece.id === 'white-king-h1')?.zone, 'captured');
    assert.equal(result.state.pieces.find(piece => piece.id === 'white-king-h1')?.royal, false);
  });
}

for (const marker of ['pacifism', 'neutrality'] as const) for (const promotion of ['queen', 'rook'] as const) {
  test(`Coup interaction: ${marker} resumes only when eligible after ${promotion} promotion`, () => {
    let state = createGameState({ fen: '7k/2P5/8/2p5/8/8/8/K7 w - - 0 1', hands: { white: marker === 'pacifism' ? [marker, 'coup'] : ['coup'], black: marker === 'neutrality' ? [marker] : [] } });
    if (marker === 'pacifism') state = act(state, { type: 'playCard', cardId: marker, target: 'c7' });
    state = act(state, { type: 'move', from: 'a1', to: 'a2' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h8', to: 'h7' });
    if (marker === 'neutrality') state = act(state, { type: 'playCard', cardId: marker, target: 'c7' });
    const markerCard = structuredClone((state.effects[0] as { card: CardInstance }).card);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'a2', to: 'a1' });
    state = act(state, { type: 'playCard', cardId: 'coup', target: 'c7' });
    assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c7')?.neutral, false);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h7', to: 'h6' });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'c7', to: 'c8', promotion });
    assert.deepEqual((state.effects.find(effect => (effect as { type?: string }).type === marker) as { card: CardInstance }).card, markerCard);
    assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c7')?.neutral, marker === 'neutrality' && promotion === 'rook');
    state = act(state, { type: 'endTurn' });
    assert.equal(Boolean(legalDests(state).get('c8')?.length), marker === 'neutrality' && promotion === 'rook');
    if (marker === 'pacifism') {
      state = act(state, { type: 'move', from: 'h6', to: 'h5' });
      state = act(state, { type: 'endTurn' });
      assert.equal(applyAction(state, { type: 'move', from: 'c8', to: 'c5' }).ok, false);
    }
  });
}

test('Coup interaction: suspending the later Coup restores the earlier replacement and its Knight role', () => {
  let state = crown('7k/2P5/8/8/3N4/8/8/K7 w - - 0 1', 'd4', ['coup']);
  state = nextWhite(state);
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'c7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'c7', to: 'c8', promotion: 'queen' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-d4')?.royal, true);
  assert.equal(state.pieces.find(piece => piece.id === 'white-knight-d4')?.role, 'knight');
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-a1')?.royal, false);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c7')?.royal, false);
  assert.equal(state.effects.length, 2);
  const earlier = (state.effects[0] as { card: CardInstance }).card;
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h6', to: 'h5' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: earlier.id });
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-a1')?.royal, true);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c7')?.royal, false);
  assert.equal(state.effects.length, 1);
});

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

// FAQ p.20's Paladin -> Coup ruling, applied to Crab by the general conflict rule.
test('Coup interaction: later Coup restores a Crab underlying Pawn movement', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/3P4/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['crab', 'coup'] } });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'd2' });
  state = nextWhite(state);
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'd2' });
  const view = { ...state, turn: { ...state.turn, phase: 'beforeMove' as const, moveMade: false, cardPlays: { white: 0, black: 0 } } };
  assert.deepEqual(legalDests(view).get('d2')?.sort(), ['d3', 'd4']);
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
