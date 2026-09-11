import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function moved(): GameState {
  return act(createGameState({
    fen: '7k/8/8/3p4/8/8/4P3/7K w - - 7 3',
    hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'e2', to: 'e4' });
}

test('Mystic Shield plays on the physical piece just moved', () => {
  const state = act(moved(), { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.history.at(-1)?.cardId, 'mystic-shield');
});

for (const target of ['e2', 'd5', 'h1', 'e5', 'z9', ['e4'], { square: 'e4' }, null, undefined]) {
  test(`Mystic Shield rejects invalid target ${JSON.stringify(target)}`, () => {
    assert.equal(applyAction(moved(), { type: 'playCard', cardId: 'mystic-shield', target }).ok, false);
  });
}

test('Mystic Shield has the printed regular-card metadata', () => {
  const card = CARD_CATALOG['mystic-shield'];
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC18_card3.png');
  assert.deepEqual(card.timing, ['afterMove']);
});

test('target enumeration contains exactly the moved occupied square', () => {
  assert.deepEqual(cardPlayTargets(moved(), 'mystic-shield'), ['e4']);
});

test('playing preserves board, identities, clocks, rights, en passant, and move status', () => {
  const before = moved();
  const state = act(before, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(state.fen, before.fen);
  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.enPassant, before.enPassant);
  assert.equal(state.turn.color, before.turn.color);
  assert.equal(state.turn.phase, before.turn.phase);
  assert.equal(state.turn.moveMade, before.turn.moveMade);
  assert.equal(state.turn.cardPlays.white, before.turn.cardPlays.white + 1);
});

test('spends only the selected physical card and draws one replacement', () => {
  let state = createGameState({
    fen: '7k/8/8/3p4/8/8/4P3/7K w - - 7 3',
    hands: { white: ['mystic-shield', 'mystic-shield'] },
    decks: { white: ['merciless', 'hostage'] },
  });
  const [first, selected] = state.players.white.hand;
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'mystic-shield', cardInstanceId: selected.id, target: 'e4' });
  assert.deepEqual(state.players.white.discard, [selected]);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['mystic-shield', 'merciless']);
  assert.equal(state.players.white.hand[0].id, first.id);
  assert.deepEqual(state.players.white.deck.map(card => card.cardId), ['hostage']);
});

test('a foreign physical card instance cannot spend the card', () => {
  assert.equal(applyAction(moved(), {
    type: 'playCard', cardId: 'mystic-shield', cardInstanceId: 'missing-instance', target: 'e4',
  }).ok, false);
});

test('the selected piece cannot be captured on the next opponent turn', () => {
  const baseline = act(moved(), { type: 'endTurn' });
  assert.equal(applyAction(baseline, { type: 'move', from: 'd5', to: 'e4' }).ok, true);
  const protectedTurn = act(act(moved(), { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }), { type: 'endTurn' });
  const rejected = applyAction(protectedTurn, { type: 'move', from: 'd5', to: 'e4' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, protectedTurn);
});

test('protection expires after that opponent turn', () => {
  let state = act(moved(), { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h1', to: 'g1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd5', to: 'e4' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.zone, 'captured');

  let mirrored = act(createGameState({
    fen: '7k/4p3/8/8/3P4/8/8/7K b - - 7 3',
    hands: { black: ['mystic-shield'] },
  }), { type: 'move', from: 'e7', to: 'e5' });
  const movedFen = mirrored.fen;
  mirrored = act(mirrored, { type: 'playCard', cardId: 'mystic-shield', target: 'e5' });
  assert.equal(mirrored.fen, movedFen);
  assert.equal(mirrored.turn.cardPlays.black, 1);
  assert.equal(mirrored.turn.cardPlays.white, 0);
  assert.deepEqual(mirrored.players.black.discard.map(card => card.cardId), ['mystic-shield']);
  mirrored = act(mirrored, { type: 'endTurn' });
  assert.equal(applyAction(mirrored, { type: 'move', from: 'd4', to: 'e5' }).ok, false);
  mirrored = act(mirrored, { type: 'move', from: 'h1', to: 'g1' });
  mirrored = act(mirrored, { type: 'endTurn' });
  mirrored = act(mirrored, { type: 'move', from: 'h8', to: 'g8' });
  mirrored = act(mirrored, { type: 'endTurn' });
  mirrored = act(mirrored, { type: 'move', from: 'd4', to: 'e5' });
  assert.equal(mirrored.pieces.find(piece => piece.id === 'black-pawn-e7')?.zone, 'captured');
});

test('an earlier turn cannot supply the moved-piece trigger', () => {
  let state = act(moved(), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }).ok, false);
});

test('a synthetic afterMove phase without a move supplies no trigger', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { white: ['mystic-shield'] } });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e2' }).ok, false);
});

test('moving a King creates a legal Mystic Shield target', () => {
  const state = act(createGameState({
    fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'h1', to: 'g1' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), ['g1']);
  assert.equal(act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'g1' }).history.at(-1)?.type, 'cardPlayed');
});

test('castling permits either the relocated King or Rook', () => {
  const state = act(createGameState({
    fen: 'k7/8/8/8/8/8/8/4K2R w K - 4 3', hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'e1', to: 'g1' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield').sort(), ['f1', 'g1']);
  const shielded = act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'f1' });
  assert.equal(shielded.history.at(-1)?.type, 'cardPlayed');
  assert.equal(act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'g1' }).history.at(-1)?.type, 'cardPlayed');
});

test('a promoted pawn remains the moved physical piece', () => {
  const state = act(createGameState({
    fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'a7', to: 'a8', promotion: 'knight' });
  assert.equal(state.pieces.find(piece => piece.square === 'a8')?.id, 'white-pawn-a7');
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), ['a8']);
  assert.equal(act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'a8' }).history.at(-1)?.type, 'cardPlayed');
});

test('a controlled neutral piece qualifies despite its original owner', () => {
  const initial = createGameState({
    fen: '7k/8/8/8/8/8/4r3/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  });
  initial.pieces.find(piece => piece.square === 'e2')!.neutral = true;
  const state = act(initial, { type: 'move', from: 'e2', to: 'e4' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), ['e4']);
  const shielded = act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(shielded.history.at(-1)?.type, 'cardPlayed');
  assert.equal(shielded.pieces.find(piece => piece.square === 'e4')?.owner, 'black');
});

test('a moved royal Pawn also qualifies for Mystic Shield', () => {
  const initial = createGameState({
    fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1', hands: { white: ['mystic-shield'] },
  });
  initial.pieces.find(piece => piece.square === 'e2')!.royal = true;
  const state = act(initial, { type: 'move', from: 'e2', to: 'e4' });
  assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), ['e4']);
  assert.equal(act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }).history.at(-1)?.type, 'cardPlayed');
});

for (const [color, opponent, fen, from, to, safe, waitFrom, waitTo] of [
  ['white', 'black', '5r1k/8/8/8/8/8/8/4K3 w - - 0 1', 'e1', 'f1', 'd1', 'h8', 'h7'],
  ['black', 'white', '4k3/8/8/8/8/8/8/5R1K b - - 0 1', 'e8', 'f8', 'd8', 'h1', 'h2'],
] as const) {
  test(`${color} King may enter check, play Shield, and becomes checked again after expiry (FAQ page 5)`, () => {
    const initial = createGameState({ fen, hands: { [color]: ['mystic-shield', 'mystic-shield'] }, decks: { [color]: ['merciless'] } });
    const snapshot = structuredClone(initial);
    const [retained, selected] = initial.players[color].hand;
    assert.ok(legalDests(initial).get(from)?.includes(to));
    assert.equal(legalDests(initial, false).get(from)?.includes(to) ?? false, false);
    let state = act(initial, { type: 'move', from, to });
    assert.ok(state.pendingRescue);
    assert.equal(isKingInCheck(state, color), true);
    assert.equal(applyAction(state, { type: 'endTurn' }).ok, false);
    assert.deepEqual(cardPlayTargets(state, 'mystic-shield'), [to]);
    const beforeShield = structuredClone(state);
    state = act(state, { type: 'playCard', cardId: 'mystic-shield', cardInstanceId: selected.id, target: to });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.pendingRescue, null);
    assert.equal(isKingInCheck(state, color), false);
    assert.deepEqual(state.pieces, beforeShield.pieces);
    assert.equal(state.fen, beforeShield.fen);
    assert.deepEqual(state.players[color].discard, [selected]);
    assert.equal(state.players[color].hand[0]?.id, retained.id);
    assert.deepEqual(state.players[color].hand.map(card => card.cardId), ['mystic-shield', 'merciless']);
    assert.equal(state.turn.cardPlays[color], 1);
    state = act(state, { type: 'endTurn' });
    assert.equal(state.turn.color, opponent);
    assert.equal(isKingInCheck(state, color), false);
    state = act(state, { type: 'move', from: waitFrom, to: waitTo });
    assert.equal(isKingInCheck(state, color), false);
    state = act(state, { type: 'endTurn' });
    assert.equal(isKingInCheck(state, color), true);
    assert.equal(state.outcome, null);
    assert.deepEqual(initial, snapshot);
  });

  test(`${color} King can be shielded after a safe move`, () => {
    const initial = createGameState({ fen, hands: { [color]: ['mystic-shield'] } });
    const movedKing = act(initial, { type: 'move', from, to: safe });
    assert.deepEqual(cardPlayTargets(movedKing, 'mystic-shield'), [safe]);
    assert.equal(act(movedKing, { type: 'playCard', cardId: 'mystic-shield', target: safe }).history.at(-1)?.type, 'cardPlayed');
  });

  test(`${color} cannot enter check without an available Shield card`, () => {
    for (const hand of [[], ['fireball']] as string[][]) {
      const state = createGameState({ fen, hands: { [color]: hand } });
      const snapshot = structuredClone(state);
      assert.equal(legalDests(state).get(from)?.includes(to) ?? false, false);
      const rejected = applyAction(state, { type: 'move', from, to });
      assert.equal(rejected.ok, false);
      assert.deepEqual(rejected.state, snapshot);
      assert.deepEqual(state, snapshot);
    }
  });
}

for (const [color, fen, from, to] of [
  ['white', 'k5r1/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1'],
  ['black', '4k2r/8/8/8/8/8/8/K5R1 b k - 0 1', 'e8', 'g8'],
] as const) {
  test(`${color} castled King can use Mystic Shield to rescue its attacked destination`, () => {
    const initial = createGameState({ fen, hands: { [color]: ['mystic-shield'] } });
    assert.ok(legalDests(initial).get(from)?.includes(to));
    const movedKing = act(initial, { type: 'move', from, to });
    assert.ok(movedKing.pendingRescue);
    const shielded = act(movedKing, { type: 'playCard', cardId: 'mystic-shield', target: to });
    assert.equal(shielded.history.at(-1)?.type, 'cardPlayed');
    assert.equal(shielded.pendingRescue, null);
    assert.equal(isKingInCheck(shielded, color), false);
    assert.equal(act(shielded, { type: 'endTurn' }).turn.color, color === 'white' ? 'black' : 'white');
  });
}

test('a Coup royal Knight may enter check and rescue itself with Mystic Shield', () => {
  let state = createGameState({ fen: '5r1k/8/8/8/8/8/4N3/K7 w - - 0 1', hands: { white: ['coup', 'mystic-shield'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'b1' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'e2' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('e2')?.includes('f4'));
  state = act(state, { type: 'move', from: 'e2', to: 'f4' });
  assert.equal(state.pieces.find(piece => piece.square === 'f4')?.royal, true);
  assert.ok(state.pendingRescue);
  const before = structuredClone(state);
  const wrongTarget = applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'b1' });
  assert.equal(wrongTarget.ok, false);
  assert.deepEqual(wrongTarget.state, before);
  state = act(state, { type: 'playCard', cardId: 'mystic-shield', target: 'f4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pendingRescue, null);
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(act(state, { type: 'endTurn' }).turn.color, 'black');
});

test('one regular card consumes the whole normal card allowance', () => {
  const before = moved();
  before.players.white.hand.push({ id: 'white-second-shield', cardId: 'mystic-shield' });
  const state = act(before, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'mystic-shield', target: 'e4' }).ok, false);
});

test('shielding the checking Rook fizzles when its future protection would force direct mate', () => {
  const movedState = act(createGameState({
    fen: '7k/5BR1/8/8/8/8/8/K7 w - - 7 3',
    hands: { white: ['mystic-shield'] },
  }), { type: 'move', from: 'g7', to: 'h7' });
  const baseline = act(movedState, { type: 'endTurn' });
  assert.equal(applyAction(baseline, { type: 'move', from: 'h8', to: 'h7' }).ok, true);

  let state = act(movedState, { type: 'playCard', cardId: 'mystic-shield', target: 'h7' });
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.deepEqual(state.pieces, movedState.pieces);
  assert.equal(state.fen, movedState.fen);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['mystic-shield']);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-g7')?.zone, 'captured');
});
