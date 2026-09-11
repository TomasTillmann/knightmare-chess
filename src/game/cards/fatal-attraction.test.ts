import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer';
import { CARD_CATALOG } from './catalog';
import { createGameState } from '../state';
import type { Color, FatalAttractionEffect, GameAction, GameState, SquareName } from '../types';

const setup = () => createGameState({ fen: '7k/6n1/8/4p3/3P4/8/1P6/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] }, decks: { white: ['sanctuary'] } });
const play = (state: GameState, target: SquareName = 'd4') => applyAction(state, { type: 'playCard', cardId: 'fatal-attraction', target });
const coherentFen = (state: GameState, color: Color = state.turn.color) => {
  const fields = state.fen.split(' ');
  fields[0] = boardFen(state).split(' ')[0];
  fields[1] = color === 'white' ? 'w' : 'b';
  return fields.join(' ');
};
const ready = (state: GameState, color: Color = 'white') => ({ ...state, fen: coherentFen(state, color), turn: { ...state.turn, color, phase: 'beforeMove' as const, moveMade: false } });
const installed = (state: GameState, target: SquareName = 'd4') => {
  const result = play(state, target);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
};

test('Fatal Attraction prevents Holy War from moving a frozen neighbor', () => {
  let state = createGameState({ fen: '7k/8/8/8/2NR4/8/6R1/5B1K w - - 0 1', hands: { white: ['fatal-attraction', 'holy-war'] } });
  const actions: GameAction[] = [
    { type: 'move', from: 'h1', to: 'g1' },
    { type: 'playCard', cardId: 'fatal-attraction', target: 'd4' },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'h7' },
    { type: 'endTurn' },
    { type: 'move', from: 'g1', to: 'h1' },
  ];
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, JSON.stringify(action));
    state = result.state;
  }
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'holy-war', target: { knight: 'c4', bishop: 'f1' } });
  assert.deepEqual(state, before);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

const swap = { type: 'playCard', cardId: 'holy-war', target: { knight: 'c4', bishop: 'f1' } } as const;
function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}
function swapState(target: SquareName = 'd4'): GameState {
  let state = installed(createGameState({ fen: '7k/8/8/8/2NR4/8/6R1/5B1K w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction', 'holy-war'] } }), target);
  for (const action of [{ type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' },
    { type: 'endTurn' }, { type: 'move', from: 'h1', to: 'g1' }] as GameAction[]) state = act(state, action);
  return state;
}
function blockedSwap(state: GameState, action: GameAction = swap): void {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

for (const color of ['white', 'black'] as const) {
  test(`Holy War moves a ${color} magnet, releases neighbors, and discards its exact card once`, () => {
    let state = swapState('c4');
    if (color === 'black') {
      for (const piece of state.pieces) piece.owner = piece.owner === 'white' ? 'black' : 'white';
      [state.players.white, state.players.black] = [state.players.black, state.players.white];
      (state.effects[0] as FatalAttractionEffect).owner = color;
      state.turn.color = color;
      state.fen = coherentFen(state, color);
    }
    const effect = state.effects[0] as FatalAttractionEffect;
    const first = state.pieces.find(piece => piece.square === 'c4')!;
    const second = state.pieces.find(piece => piece.square === 'f1')!;
    assert.ok((legalDests(ready(state, color), false).get('c4') ?? []).includes('b6'));
    const ordinary = act(ready(state, color), { type: 'move', from: 'c4', to: 'b6' });
    assert.equal(ordinary.effects.length, 0);
    const result = act(state, swap);
    assert.equal(result.history.at(-1)?.type, 'cardPlayed');
    assert.deepEqual(result.pieces.find(piece => piece.id === first.id), { ...first, square: 'f1' });
    assert.deepEqual(result.pieces.find(piece => piece.id === second.id), { ...second, square: 'c4' });
    assert.equal(result.effects.length, 0);
    assert.equal(result.players[color].discard.filter(card => card.id === effect.card.id).length, 1);
    assert.equal(result.players[color].discard.filter(card => card.cardId === 'holy-war').length, 1);
    assert.ok((legalDests(ready(result, color), false).get('d4') ?? []).length);
  });
}

// Public saved-position fixtures exercise every card in the common swap dispatcher.
for (const [cardId, firstField, firstRole, firstOwner, secondField, secondRole, secondOwner, replacesMove] of [
  ['holy-war', 'knight', 'knight', 'white', 'bishop', 'bishop', 'white', false],
  ['anathema', 'bishop', 'bishop', 'black', 'rook', 'rook', 'black', false],
  ['holy-quest', 'bishop', 'bishop', 'black', 'knight', 'knight', 'black', false],
  ['treason', 'rook', 'rook', 'black', 'knight', 'knight', 'black', false],
  ['cathedral', 'rook', 'rook', 'white', 'bishop', 'bishop', 'white', false],
  ['siege', 'knight', 'knight', 'white', 'rook', 'rook', 'white', false],
  ['evangelists', 'own', 'bishop', 'white', 'opponent', 'bishop', 'black', true],
  ['tournament', 'own', 'knight', 'white', 'opponent', 'knight', 'black', true],
  ['lost-castle', 'own', 'rook', 'white', 'opponent', 'rook', 'black', true],
] as const) {
  test(`${cardId} checks either exchanged participant against the original magnet, for both colors`, () => {
    for (const color of ['white', 'black'] as const) for (const frozen of ['c4', 'f1'] as const) {
      const state = swapState();
      state.pieces.find(piece => piece.square === 'g1')!.square = 'h3';
      const magnet = state.pieces.find(piece => piece.square === 'd4')!;
      magnet.square = frozen === 'c4' ? 'd4' : 'e2';
      for (const [square, role, owner] of [['c4', firstRole, firstOwner], ['f1', secondRole, secondOwner]] as const) {
        const piece = state.pieces.find(piece => piece.square === square)!;
        piece.role = piece.originalRole = role;
        piece.owner = owner;
      }
      state.players.white.hand = [{ id: 'selected-swap', cardId }];
      state.turn = { color: 'white', phase: replacesMove ? 'beforeMove' : 'afterMove', moveMade: !replacesMove,
        cardPlays: { white: 0, black: 0 } };
      if (color === 'black') {
        for (const piece of state.pieces) piece.owner = piece.owner === 'white' ? 'black' : 'white';
        [state.players.white, state.players.black] = [state.players.black, state.players.white];
        (state.effects[0] as FatalAttractionEffect).owner = color;
        state.turn.color = color;
      }
      state.fen = coherentFen(state, color);
      const target = { [firstField]: 'c4', [secondField]: 'f1' };
      const action = { type: 'playCard', cardId, target } as const;
      const plain = structuredClone(state);
      plain.effects = [];
      assert.equal(act(plain, action).history.at(-1)?.type, 'cardPlayed', 'plain swap needs no ordinary-move geometry');
      assert.equal((legalDests(ready(state, state.pieces.find(piece => piece.square === frozen)!.owner), false).get(frozen) ?? []).length, 0);
      blockedSwap(state, action);
      assert.ok(!cardPlayTargets(state, cardId).some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
    }
  });
}

test('A moving magnet cannot release its simultaneously swapped neighbor or another frozen magnet', () => {
  const state = swapState('c4');
  const bishop = state.pieces.find(piece => piece.square === 'f1')!;
  bishop.square = 'b3';
  state.fen = coherentFen(state);
  const action = { ...swap, target: { knight: 'c4', bishop: 'b3' } } as const;
  blockedSwap(state, action);
  state.effects.push({ type: 'fatal-attraction', owner: 'white', pieceId: bishop.id,
    card: { id: 'second-magnet', cardId: 'fatal-attraction' } });
  blockedSwap(state, action);
});

test('Swapping one magnet preserves a separate magnet and unrelated effects', () => {
  const state = swapState('c4');
  const other = { type: 'fatal-attraction', owner: 'white', pieceId: state.pieces.find(piece => piece.square === 'g2')!.id,
    card: { id: 'other-magnet', cardId: 'fatal-attraction' } } as const;
  const pacifism = { type: 'pacifism', owner: 'white', pieceId: state.pieces.find(piece => piece.square === 'c4')!.id,
    card: { id: 'pacifism-card', cardId: 'pacifism' } } as const;
  state.effects.push(other, pacifism);
  // Keep the remote Bishop outside the second magnet's neighborhood.
  state.pieces.find(piece => piece.square === 'f1')!.square = 'a1';
  state.fen = coherentFen(state);
  const result = act(state, { ...swap, target: { knight: 'c4', bishop: 'a1' } });
  assert.equal(result.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.effects, [other, pacifism]);
  assert.equal(result.players.white.discard.filter(card => card.cardId === 'fatal-attraction').length, 1);
});

for (const mode of ['frozen', 'royal', 'hidden-magnet'] as const) {
  test(`Swaps respect a composite's ${mode} physical component`, () => {
    const state = swapState(mode === 'hidden-magnet' ? 'c4' : 'd4');
    const carrier = state.pieces.find(piece => piece.square === 'c4')!;
    const hidden = state.pieces.find(piece => piece.square === 'g2')!;
    hidden.square = null;
    hidden.zone = 'away';
    if (mode === 'royal') {
      hidden.royal = true;
      state.pieces.find(piece => piece.square === 'g1')!.royal = false;
    }
    state.effects.push({ type: 'confabulation', owner: 'white', pieceIds: [carrier.id, hidden.id],
      card: { id: 'composite-card', cardId: 'confabulation' } });
    if (mode === 'hidden-magnet') (state.effects[0] as FatalAttractionEffect).pieceId = hidden.id;
    state.fen = coherentFen(state);
    if (mode === 'frozen') return blockedSwap(state);
    const result = act(state, swap);
    assert.equal(result.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.pieces.find(piece => piece.id === carrier.id)?.square, 'f1');
    assert.deepEqual(result.pieces.find(piece => piece.id === hidden.id), hidden);
    assert.equal(result.effects.some(effect => (effect as { type: string }).type === 'fatal-attraction'), mode === 'royal');
    assert.equal(result.effects.some(effect => (effect as { type: string }).type === 'confabulation'), true);
  });
}

test('Swapping a magnet expires it before safety checks and fizzles atomically when it releases check', () => {
  const state = swapState('c4');
  const enemy = state.pieces.find(piece => piece.square === 'd4')!;
  enemy.owner = 'black';
  enemy.square = 'd3';
  state.pieces.find(piece => piece.square === 'g1')!.square = 'h3';
  state.fen = coherentFen(state);
  assert.equal(isKingInCheck(state, 'white'), false);
  const result = act(state, swap);
  assert.equal(result.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.history.at(-1)?.reason, 'SELF_CHECK');
  assert.deepEqual(result.pieces, state.pieces);
  assert.deepEqual(result.effects, state.effects);
  assert.deepEqual(result.players.white.discard.map(card => card.cardId), ['holy-war']);
});

test('Passing in the Night and Man of Straw enforce and expire Fatal Attraction through their own swap paths', () => {
  for (const cardId of ['passing-in-the-night', 'man-of-straw'] as const) {
    for (const mode of ['frozen', 'magnet'] as const) {
      const state = createGameState({ fen: cardId === 'passing-in-the-night'
        ? '7k/8/8/8/2PR4/8/6R1/5p1K w - - 0 1'
        : 'k5r1/8/8/8/2PR4/8/8/6K1 w - - 0 1', hands: { white: [cardId] } });
      const pieceId = state.pieces.find(piece => piece.square === (mode === 'frozen' ? 'd4' : 'c4'))!.id;
      const effect = { type: 'fatal-attraction', owner: 'white', pieceId,
        card: { id: 'retained-magnet', cardId: 'fatal-attraction' } } as const;
      state.effects.push(effect);
      const target = cardId === 'passing-in-the-night' ? [{ from: 'c4', to: 'f1' }] : { king: 'g1', pawn: 'c4' };
      const action = { type: 'playCard', cardId, target } as const;
      if (mode === 'frozen') {
        blockedSwap(state, action);
        assert.deepEqual(cardPlayTargets(state, cardId), []);
      } else {
        const result = act(state, action);
        assert.equal(result.history.at(-1)?.type, 'cardPlayed');
        assert.deepEqual(result.effects, []);
        assert.deepEqual(result.players.white.discard.filter(card => card.id === effect.card.id), [effect.card]);
      }
    }
  }
});

test('A copied Fatal Attraction expires its physical Haunting Memories card when the magnet swaps', () => {
  let state = createGameState({ fen: '7k/8/8/8/2NR4/8/6R1/5B1K w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction', 'haunting-memories', 'holy-war'] } });
  state = installed(state, 'g2');
  for (const action of [{ type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' }, { type: 'endTurn' },
    { type: 'move', from: 'h1', to: 'g1' }, { type: 'playCard', cardId: 'haunting-memories', target: 'c4' },
    { type: 'endTurn' }, { type: 'move', from: 'h7', to: 'h8' }, { type: 'endTurn' },
    { type: 'move', from: 'g1', to: 'h1' }] as GameAction[]) state = act(state, action);
  const copied = state.effects.find(effect => (effect as FatalAttractionEffect).pieceId === 'white-knight-c4') as FatalAttractionEffect;
  assert.equal(copied.card.cardId, 'haunting-memories');
  // The Bishop is outside the independently retained original magnet's aura.
  state.pieces.find(piece => piece.square === 'f1')!.square = 'a1';
  state.fen = coherentFen(state);
  const result = act(state, { ...swap, target: { knight: 'c4', bishop: 'a1' } });
  assert.equal(result.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.players.white.discard.filter(card => card.id === copied.card.id), [copied.card]);
  assert.deepEqual(result.effects, state.effects.filter(effect => effect !== copied));
});

test('Fatal Attraction has its printed price, timing, and Continuing Effect status', () => {
  const card = CARD_CATALOG['fatal-attraction'];
  assert.ok(card);
  assert.equal(card.points, 8);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, true);
  assert.deepEqual(card.timing, ['afterMove']);
});

test('Fatal Attraction is legal after the Regular Move', () => {
  assert.equal(play(setup()).ok, true);
});

for (const target of ['c3', 'd3', 'e3', 'c4', 'e4', 'c5', 'd5', 'e5'] as SquareName[]) {
  test(`Fatal Attraction freezes a non-King at ${target}`, () => {
    const state = setup();
    const knight = state.pieces.find(piece => piece.square === 'b2')!;
    knight.square = target;
    knight.role = knight.originalRole = 'knight';
    state.pieces = state.pieces.filter(piece => piece.id === knight.id || piece.square !== target);
    state.fen = coherentFen(state);
    assert.ok((legalDests(ready(state), false).get(target)?.length ?? 0) > 0);
    const result = installed(state);
    assert.equal(legalDests(ready(result), false).get(target)?.length ?? 0, 0);
  });
}

test('Fatal Attraction cannot be played before the Regular Move', () => {
  assert.equal(play(ready(setup())).ok, false);
});

test('Fatal Attraction retains the physical card, draws once, and preserves the input and completed move', () => {
  const state = setup();
  const before = structuredClone(state);
  const card = state.players.white.hand[0];
  const result = installed(state);
  assert.deepEqual(state, before);
  assert.deepEqual(result.pieces, before.pieces);
  assert.equal(result.fen, before.fen);
  assert.deepEqual(result.enPassant, before.enPassant);
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.phase, 'afterMove');
  assert.equal(result.turn.cardPlays.white, 1);
  assert.deepEqual(result.players.white.hand.map(item => item.cardId), ['sanctuary']);
  assert.equal(result.players.white.deck.length, 0);
  assert.equal(result.players.white.discard.length, 0);
  assert.equal(result.effects.length, 1);
  assert.ok(JSON.stringify(result.effects).includes(card.id));
  assert.ok(JSON.stringify(result.effects).includes(state.pieces.find(piece => piece.square === 'd4')!.id));
});

for (const target of ['a1', 'e1', 'g7'] as SquareName[]) {
  test(`Fatal Attraction accepts any controlled role, including royal or neutral ${target}`, () => {
    const state = setup();
    if (target === 'g7') state.pieces.find(piece => piece.square === target)!.neutral = true;
    assert.equal(installed(state, target).effects.length, 1);
  });
}

for (const color of ['black', 'neutral'] as const) {
  test(`Fatal Attraction freezes an adjacent ${color} piece`, () => {
    const state = setup();
    const piece = state.pieces.find(item => item.square === 'e5')!;
    if (color === 'neutral') piece.neutral = true;
    const result = installed(state);
    const turn = ready(result, color === 'black' ? 'black' : 'white');
    assert.equal(legalDests(turn, false).get('e5')?.length ?? 0, 0);
    assert.equal(applyAction(turn, { type: 'move', from: 'e5', to: 'd4' }).ok, false);
  });
}

test('The magnet can move and its move discards the retained card and releases neighbors', () => {
  const blackTurn = applyAction(installed(setup()), { type: 'endTurn' });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: 'move', from: 'g7', to: 'f5' });
  assert.equal(blackMove.ok, true);
  const whiteTurn = applyAction(blackMove.state, { type: 'endTurn' });
  assert.equal(whiteTurn.ok, true);
  assert.ok(legalDests(whiteTurn.state, false).get('d4')?.includes('d5'));
  const moved = applyAction(whiteTurn.state, { type: 'move', from: 'd4', to: 'd5' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.effects.length, 0);
  assert.equal(moved.state.players.white.discard.filter(card => card.cardId === 'fatal-attraction').length, 1);
  const nextTurn = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(nextTurn.ok, true);
  assert.ok(legalDests(nextTurn.state, false).get('e5')?.includes('e4'));
});

for (const royal of [true, false]) {
  test(`Adjacent King-movement piece is ${royal ? 'exempt when physically royal' : 'frozen when a capturable Prince'}`, () => {
    const state = setup();
    const piece = state.pieces.find(item => item.square === 'b2')!;
    piece.square = 'c3';
    piece.role = 'king';
    piece.royal = royal;
    if (royal) {
      piece.originalRole = 'king';
      state.pieces = state.pieces.filter(item => item.square !== 'e1');
    }
    state.fen = coherentFen(state);
    const result = installed(state);
    assert.equal((legalDests(ready(result), false).get('c3')?.length ?? 0) > 0, royal);
  });
}

test('Freezing an adjacent enemy suppresses its check and allows the after-move rescue', () => {
  const state = createGameState({ fen: '7k/6n1/8/4r3/3P4/8/1P6/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] }, decks: { white: ['sanctuary'] } });
  assert.equal(isKingInCheck(state, 'white'), true);
  const result = installed(state);
  assert.equal(isKingInCheck(result, 'white'), false);
  assert.equal(result.effects.length, 1);
});

for (const target of ['e5', 'c6'] as SquareName[]) {
  test(`Fatal Attraction rejects uncontrolled or vacant ${target}`, () => {
    assert.equal(play(setup(), target).ok, false);
  });
}
