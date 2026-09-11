import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const CARD = 'bog';

it('Bog relocates Fireball to the shortened endpoint and recomputes its victims', () => {
  assertBogControl();
  const before = createGameState({
    fen: '7k/8/1p6/8/8/8/1P6/R6K w - - 0 1',
    hands: { white: ['fireball'], black: [CARD] },
    decks: { white: ['panic'], black: ['panic'] },
  });
  const rook = before.pieces.find(piece => piece.square === 'a1')!;
  const oldVictim = before.pieces.find(piece => piece.square === 'b6')!;
  const newVictim = before.pieces.find(piece => piece.square === 'b2')!;
  const moved = bogCompositeAction(before, { type: 'move', from: 'a1', to: 'a5' });
  const exploded = bogCompositeAction(moved, { type: 'playCard', cardId: 'fireball', target: 'a5' });
  assert.equal(exploded.pieces.find(piece => piece.id === oldVictim.id)?.zone, 'captured');
  const snapshot = JSON.stringify(exploded);
  const stopped = bogCompositeAction(exploded, { type: 'playCard', cardId: CARD });
  assert.deepEqual(stopped.pieces.find(piece => piece.id === oldVictim.id), oldVictim);
  for (const victim of [rook, newVictim]) assert.equal(stopped.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  for (const color of ['white', 'black'] as const) {
    assert.deepEqual(stopped.players[color].hand.map(card => card.cardId), ['panic']);
    assert.deepEqual(stopped.players[color].deck, []);
    assert.deepEqual(stopped.players[color].discard, before.players[color].hand);
  }
  assert.equal(JSON.stringify(exploded), snapshot);
});

describe('Bog after Fireball (official FAQ pp. 12 and 28)', () => {
  const geometries = [
    ['rook', '7k/8/1p6/8/8/8/1P6/R6K w - - 17 24', 'a1', 'a5', 'b6', 'b2'],
    ['bishop', '7k/8/5p2/8/8/8/P7/B6K w - - 17 24', 'a1', 'e5', 'f6', 'a2'],
    ['queen', '7k/8/8/8/7K/8/1P3p2/Q7 w - - 17 24', 'a1', 'e1', 'f2', 'b2'],
  ] as const;
  for (const color of ['white', 'black'] as const) {
    for (const [role, fen, from, to, oldSquare, newSquare] of geometries) {
      it(`${color} ${role}: changes the physical victims and advances clocks only once`, () => {
        const opponent = color === 'white' ? 'black' : 'white';
        const square = (value: string) => (color === 'white' ? value : `${value[0]}${9 - Number(value[1])}`) as SquareName;
        const mirrored = fen.split(' ')[0].split('/').reverse().join('/').replace(/[a-z]/gi,
          value => value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase());
        const before = createGameState({
          fen: color === 'white' ? fen : `${mirrored} b - - 17 24`,
          hands: { [color]: ['fireball', 'fireball'], [opponent]: [CARD, CARD] },
          decks: { [color]: ['panic', 'crab'], [opponent]: ['panic', 'crab'] },
        });
        const center = before.pieces.find(piece => piece.square === square(from))!;
        const oldVictim = before.pieces.find(piece => piece.square === square(oldSquare))!;
        const newVictim = before.pieces.find(piece => piece.square === square(newSquare))!;
        const fireball = before.players[color].hand[1];
        const bog = before.players[opponent].hand[1];
        const moved = bogCompositeAction(before, { type: 'move', from: square(from), to: square(to) });
        const exploded = bogCompositeAction(moved, { type: 'playCard', cardId: 'fireball', cardInstanceId: fireball.id, target: square(to) });
        assert.equal(exploded.history.at(-1)?.type, 'cardPlayed');
        assert.equal(exploded.pieces.find(piece => piece.id === oldVictim.id)?.zone, 'captured');
        const frozen = JSON.stringify(exploded);
        const stopped = bogCompositeAction(exploded, { type: 'playCard', cardId: CARD, cardInstanceId: bog.id });
        assert.equal(stopped.history.at(-1)?.type, 'cardPlayed');
        assert.deepEqual(stopped.pieces.find(piece => piece.id === oldVictim.id), oldVictim);
        assert.deepEqual(stopped.pieces.filter(piece => piece.zone === 'captured').map(piece => piece.id).sort(), [center.id, newVictim.id].sort());
        for (const player of [color, opponent] as const) {
          assert.deepEqual(stopped.players[player].hand, [before.players[player].hand[0], before.players[player].deck[0]]);
          assert.deepEqual(stopped.players[player].deck, before.players[player].deck.slice(1));
          assert.deepEqual(stopped.players[player].discard, [before.players[player].hand[1]]);
          assert.equal(stopped.turn.cardPlays[player], 1);
        }
        assert.deepEqual(stopped.playedCards, [{ player: color, cardInstanceId: fireball.id }, { player: opponent, cardInstanceId: bog.id }]);
        assert.deepEqual(stopped.history.slice(0, -1), exploded.history);
        assert.deepEqual(stopped.fen.split(' ').slice(1), [opponent[0], '-', '-', '0', color === 'white' ? '24' : '25']);
        assert.equal(stopped.turn.moveMade, true);
        assert.equal(stopped.turn.phase, 'afterMove');
        assert.equal(JSON.stringify(exploded), frozen);
        bogCompositeAction(stopped, { type: 'endTurn' });
      });
    }
  }

  for (const effect of ['crab', 'confabulation'] as const) {
    it(`restores the old blast victim's ${effect} and retained physical card`, () => {
      let state = createGameState({
        fen: effect === 'crab' ? '7k/8/1p6/8/8/8/1P6/R6K b - - 0 1' : '2n4k/8/1r6/8/8/8/1P6/R6K b - - 0 1',
        hands: { white: ['fireball'], black: [effect, CARD] },
      });
      if (effect === 'crab') state = bogCompositeAction(state, { type: 'move', from: 'h8', to: 'g8' });
      state = bogCompositeAction(state, { type: 'playCard', cardId: effect,
        target: effect === 'crab' ? 'b6' : [{ from: 'c8', to: 'b6' }] });
      if (!state.turn.moveMade) state = bogCompositeAction(state, { type: 'move', from: 'h8', to: 'g8' });
      state = bogCompositeAction(state, { type: 'endTurn' });
      const before = state;
      state = bogCompositeAction(state, { type: 'move', from: 'a1', to: 'a5' });
      state = bogCompositeAction(state, { type: 'playCard', cardId: 'fireball', target: 'a5' });
      assert.equal(state.pieces.find(piece => piece.id === before.pieces.find(candidate => candidate.square === 'b6')!.id)?.zone, 'captured');
      if (effect === 'confabulation') assert.ok(state.players.black.discard.some(card => card.cardId === effect));
      state = bogCompositeAction(state, { type: 'playCard', cardId: CARD });
      assert.deepEqual(state.effects, before.effects);
      assert.deepEqual(state.pieces.filter(piece => piece.owner === 'black'), before.pieces.filter(piece => piece.owner === 'black'));
      assert.deepEqual(state.players.black.discard.map(card => card.cardId), [CARD]);
    });
  }

  for (const protection of ['pacifism', 'coup'] as const) {
    it(`the relocated blast preserves a publicly created ${protection === 'coup' ? 'Prince' : 'Pacifist'}`, () => {
      let state = createGameState({
        fen: protection === 'coup' ? '7k/8/1p6/8/8/8/7P/RK6 w - - 0 1' : '7k/8/1p6/8/8/8/1P6/R6K w - - 0 1',
        hands: { white: [protection, 'fireball'], black: [CARD] },
      });
      if (protection === 'coup') {
        state = bogCompositeAction(state, { type: 'move', from: 'h2', to: 'h3' });
        state = bogCompositeAction(state, { type: 'playCard', cardId: protection, target: 'h3' });
      } else {
        state = bogCompositeAction(state, { type: 'playCard', cardId: protection, target: 'b2' });
        state = bogCompositeAction(state, { type: 'move', from: 'h1', to: 'g1' });
      }
      state = bogCompositeAction(state, { type: 'endTurn' });
      state = bogCompositeAction(state, { type: 'move', from: 'h8', to: 'g8' });
      state = bogCompositeAction(state, { type: 'endTurn' });
      const before = state;
      state = bogCompositeAction(state, { type: 'move', from: 'a1', to: 'a5' });
      state = bogCompositeAction(state, { type: 'playCard', cardId: 'fireball', target: 'a5' });
      state = bogCompositeAction(state, { type: 'playCard', cardId: CARD });
      assert.deepEqual(state.effects, before.effects);
      for (const piece of before.pieces.filter(piece => piece.square !== 'a1')) {
        assert.deepEqual(state.pieces.find(candidate => candidate.id === piece.id), piece);
      }
    });
  }

  it('the complete relocated explosion rescues self-check without reviving a pending rescue', () => {
    const before = createGameState({ fen: '7k/8/8/8/8/3b4/4R3/5K2 w - - 0 1',
      hands: { white: ['fireball'], black: [CARD] } });
    const moved = bogCompositeAction(before, { type: 'move', from: 'e2', to: 'e4' });
    assert.ok(moved.pendingRescue);
    assert.equal(isKingInCheck(moved, 'white'), true);
    const exploded = bogCompositeAction(moved, { type: 'playCard', cardId: 'fireball', target: 'e4' });
    assert.equal(exploded.pendingRescue, null);
    const stopped = bogCompositeAction(exploded, { type: 'playCard', cardId: CARD });
    assert.equal(stopped.history.at(-1)?.type, 'cardPlayed');
    assert.equal(isKingInCheck(stopped, 'white'), false);
    assert.equal(stopped.pendingRescue, null);
    for (const id of ['white-rook-e2', 'black-bishop-d3']) assert.equal(stopped.pieces.find(piece => piece.id === id)?.zone, 'captured');
    bogCompositeAction(stopped, { type: 'endTurn' });
  });

  it('spends Bog but retains the original explosion when the new victims expose the mover King', () => {
    const before = createGameState({ fen: '1r5k/8/8/8/8/8/1P6/RK6 w - - 0 1',
      hands: { white: ['fireball'], black: [CARD] }, decks: { black: ['panic'] } });
    const moved = bogCompositeAction(before, { type: 'move', from: 'a1', to: 'a5' });
    const exploded = bogCompositeAction(moved, { type: 'playCard', cardId: 'fireball', target: 'a5' });
    assert.equal(exploded.history.at(-1)?.type, 'cardPlayed');
    const snapshot = JSON.stringify(exploded);
    const stopped = bogCompositeAction(exploded, { type: 'playCard', cardId: CARD });
    assert.equal(stopped.history.at(-1)?.type, 'cardFizzled');
    assert.equal(stopped.history.at(-1)?.reason, 'SELF_CHECK');
    assert.deepEqual(stopped.pieces, exploded.pieces);
    assert.deepEqual(stopped.effects, exploded.effects);
    assert.equal(stopped.fen, exploded.fen);
    assert.deepEqual(stopped.players.white, exploded.players.white);
    assert.deepEqual(stopped.players.black.discard, before.players.black.hand);
    assert.deepEqual(stopped.players.black.hand, before.players.black.deck);
    assert.equal(JSON.stringify(exploded), snapshot);
  });

  it('relocates a publicly copied Fireball while preserving Haunting Memories identity', () => {
    let state = createGameState({ fen: 'r6k/1p6/8/8/8/1P6/8/5N1K w - - 0 1',
      hands: { white: ['fireball', CARD], black: ['haunting-memories'] },
      decks: { white: ['panic', 'crab'], black: ['panic', 'crab'] } });
    state = bogCompositeAction(state, { type: 'move', from: 'f1', to: 'd2' });
    state = bogCompositeAction(state, { type: 'playCard', cardId: 'fireball', target: 'd2' });
    state = bogCompositeAction(state, { type: 'endTurn' });
    state = bogCompositeAction(state, { type: 'move', from: 'a8', to: 'a4' });
    const before = state;
    state = bogCompositeAction(state, { type: 'playCard', cardId: 'haunting-memories', target: 'a4' });
    assert.equal(state.history.at(-1)?.copiedCardId, 'fireball');
    assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b3')?.zone, 'captured');
    const exploded = state;
    state = bogCompositeAction(state, { type: 'playCard', cardId: CARD });
    assert.deepEqual(state.players.black, exploded.players.black);
    assert.deepEqual(state.players.black.discard, before.players.black.hand);
    assert.deepEqual(state.pieces.find(piece => piece.id === 'white-pawn-b3'), before.pieces.find(piece => piece.id === 'white-pawn-b3'));
    for (const id of ['black-rook-a8', 'black-pawn-b7']) assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'captured');
    assert.equal(state.playedCards?.length, 3);
    assert.deepEqual(state.history.slice(0, -1), exploded.history);
  });

  it('restores the old victim Rook castling right and revokes the new victim Rook right', () => {
    const before = createGameState({ fen: 'r3k3/8/8/8/8/8/8/RR2K3 w Qq - 0 1',
      hands: { white: ['fireball'], black: [CARD] } });
    const moved = bogCompositeAction(before, { type: 'move', from: 'b1', to: 'b7' });
    const exploded = bogCompositeAction(moved, { type: 'playCard', cardId: 'fireball', target: 'b7' });
    assert.equal(exploded.history.at(-1)?.type, 'cardPlayed');
    assert.equal(exploded.fen.split(' ')[2], 'Q');
    const stopped = bogCompositeAction(exploded, { type: 'playCard', cardId: CARD });
    assert.equal(stopped.history.at(-1)?.type, 'cardPlayed');
    assert.deepEqual(stopped.pieces.find(piece => piece.id === 'black-rook-a8'), before.pieces.find(piece => piece.id === 'black-rook-a8'));
    for (const id of ['white-rook-a1', 'white-rook-b1']) assert.equal(stopped.pieces.find(piece => piece.id === id)?.zone, 'captured');
    assert.equal(stopped.fen.split(' ')[2], 'q');
    for (const color of ['white', 'black'] as const) assert.equal(isKingInCheck(stopped, color), false);
  });
});

describe('Bog responds to card-generated slider moves', () => {
  const cases = [
    ['bombard', '7k/8/8/8/8/8/P7/R6K w - - 0 1', 'a1', 'a6', 'a3', 'rook', true],
    ['bombard', '7k/8/8/8/P7/8/8/R6K w - - 0 1', 'a1', 'a6', 'a2', 'rook', true],
    ['bombard', '7k/8/8/8/8/8/8/Rn5K w - - 0 1', 'a1', 'f1', 'c1', 'rook', true],
    ['ghostwalk', '7k/8/8/8/8/P7/P7/R6K w - - 0 1', 'a1', 'a6', 'a4', 'rook', true],
    ['ghostwalk', '7k/8/8/8/8/8/P7/R6K w - - 0 1', 'a1', 'a6', 'a3', 'rook', true],
    ['ghostwalk', '7k/8/8/8/8/2P5/1P6/B6K w - - 0 1', 'a1', 'f6', 'd4', 'bishop', true],
    ['ghostwalk', '6k1/8/8/8/P7/8/8/Q6K w - - 0 1', 'a1', 'a6', 'a2', 'queen', true],
    ['masquerade', '6k1/8/8/8/8/8/8/B6K w - - 0 1', 'a1', 'a6', 'a2', 'bishop', true],
    ['masquerade', '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', 'f6', 'b2', 'rook', true],
    ['masquerade', '6k1/8/8/8/8/8/8/Q6K w - - 0 1', 'a1', 'f6', 'b2', 'queen', true],
    ['masquerade', '7k/8/8/8/8/8/8/N6K w - - 0 1', 'a1', 'a6', 'a1', 'knight', false],
    ['masquerade', '6k1/8/8/8/8/8/8/B6K w - - 0 1', 'a1', 'a2', 'a1', 'bishop', false],
    ['masquerade', '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', 'b2', 'a1', 'rook', false],
    ['ghostwalk', '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', 'a2', 'a1', 'rook', false],
    ['ghostwalk', '7k/8/8/8/8/8/P7/7K w - - 0 1', 'a2', 'a4', 'a2', 'pawn', false],
  ] as const;
  for (const [cardId, fen, from, to, first, role, playable] of cases) {
    it(`${cardId}: ${role} ${from}-${to}, ${playable ? `stops at ${first}` : 'ineligible'}`, () => {
      if (!playable) assertBogControl();
      const safeFen = fen.replace(/^[^/]+\/8\/8\//, '8/8/7k/');
      const initial = createGameState({ fen: safeFen, hands: { white: [cardId], black: [CARD] }, decks: { white: [], black: [] } });
      assert.equal(isKingInCheck(initial, 'white'), false, 'White fixture King starts safe');
      assert.equal(isKingInCheck(initial, 'black'), false, 'Black fixture King starts safe');
      const mover = initial.pieces.find(piece => piece.square === from)!;
      const moved = bogCompositeAction(initial, { type: 'playCard', cardId, target: [{ from, to }] });
      assert.equal(moved.pieces.find(piece => piece.id === mover.id)?.square, to, 'movement card must actually move the fixture');
      const snapshot = JSON.stringify(moved);
      const result = applyAction(moved, { type: 'playCard', cardId: CARD });
      assert.equal(result.ok, playable);
      assert.equal(JSON.stringify(moved), snapshot);
      if (!result.ok) return;
      assert.equal(result.state.pieces.find(piece => piece.id === mover.id)?.square, first);
      assert.equal(result.state.pieces.find(piece => piece.id === mover.id)?.role, role);
      assert.deepEqual(result.state.players.white.hand, []);
      assert.deepEqual(result.state.players.black.hand, []);
      assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), [cardId]);
      assert.deepEqual(result.state.players.black.discard.map(card => card.cardId), [CARD]);
      const next = bogCompositeAction(result.state, { type: 'endTurn' });
      assert.equal(applyAction(next, { type: 'move', from: 'h6', to: 'h7' }).ok, true);
    });
  }
});

function bogCompositeAction(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  if (!result.ok) throw new Error('Composite fixture action failed');
  return result.state;
}

describe('Bog reverses a capture of a Confabulated piece', () => {
  const sliders = [
    { role: 'rook', fen: '1n5k/8/r7/8/8/8/R7/7K b - - 0 1', from: 'a2', first: 'a3' },
    { role: 'queen', fen: '1n5k/8/r7/8/8/8/Q7/7K b - - 0 1', from: 'a2', first: 'a3' },
    { role: 'bishop', fen: '1n5k/8/r7/8/8/3B4/8/7K b - - 0 1', from: 'd3', first: 'c4' },
  ] as const;
  for (const slider of sliders) {
    for (const check of ['identities', 'effect', 'rook movement', 'knight movement', 'accounting and immutability']) {
      it(`${slider.role}: restores ${check}`, () => {
        const initial = createGameState({ fen: slider.fen, hands: { white: [], black: ['confabulation', CARD] }, decks: { white: [], black: [] } });
        const merged = bogCompositeAction(initial, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b8', to: 'a6' }] });
        const before = bogCompositeAction(merged, { type: 'endTurn' });
        const victims = before.pieces.filter(piece => piece.owner === 'black' && !piece.royal);
        assert.equal(victims.length, 2);
        assert.equal(before.effects.length, 1);
        const captured = bogCompositeAction(before, { type: 'move', from: slider.from, to: 'a6' });
        for (const victim of victims) assert.equal(captured.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
        const snapshot = JSON.stringify(captured);
        const stopped = bogCompositeAction(captured, { type: 'playCard', cardId: CARD });
        assert.equal(stopped.pieces.find(piece => piece.square === slider.first)?.role, slider.role);
        if (check === 'identities') {
          assert.deepEqual(stopped.pieces.filter(piece => victims.some(victim => victim.id === piece.id)), victims);
        } else if (check === 'effect') {
          assert.deepEqual(stopped.effects, before.effects);
        } else if (check.endsWith('movement')) {
          const ready = bogCompositeAction(stopped, { type: 'endTurn' });
          const destination = check === 'rook movement' ? 'b6' : 'c5';
          const moved = bogCompositeAction(ready, { type: 'move', from: 'a6', to: destination });
          assert.deepEqual(moved.pieces.filter(piece => victims.some(victim => victim.id === piece.id)), victims.map(piece => piece.square === 'a6' ? { ...piece, square: destination } : piece));
          assert.deepEqual(moved.effects, before.effects);
        } else {
          assert.equal(JSON.stringify(captured), snapshot);
          assert.deepEqual(stopped.players.black.hand, []);
          assert.deepEqual(stopped.players.black.discard.map(card => card.cardId), [CARD]);
          assert.equal(stopped.pieces.length, before.pieces.length);
        }
      });
    }
  }
});

function assertBogControl() {
  const before = createGameState({
    fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
    hands: { white: [], black: [CARD] },
    decks: { white: [], black: [] },
  });
  const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(applyAction(moved.state, { type: 'playCard', cardId: CARD }).ok, true);
}

describe('Bog', () => {
  it('matches the printed card', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Bog',
      points: 4,
      unique: false,
      image: '/KC4_card2.png',
      description: 'Play this card after your opponent moves a Rook, Bishop or Queen two squares or more. His piece cannot make the planned move; it stops after moving one square in the chosen direction.',
      timing: ['afterOpponentMove'],
      continuing: false,
    });
  });

  it('stops an opposing long Rook move after one square', () => {
    const before = createGameState({
      fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
      hands: { white: [], black: [CARD] },
      decks: { white: [], black: [] },
    });
    const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;

    const result = applyAction(moved.state, { type: 'playCard', cardId: CARD });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.pieces.find(piece => piece.square === 'a3')?.role, 'rook');
  });

  it('enforces Bog edge cases', () => {
    const cases = [
      ['bishop', 'c1', 'h6', 'd2', true],
      ['queen', 'd1', 'd5', 'd2', true],
      ['rook', 'a2', 'a3', 'a2', false],
      ['knight', 'b1', 'c3', 'b1', false],
      ['king', 'e1', 'e2', 'e1', false],
      ['pawn', 'a2', 'a4', 'a2', false],
    ] as const;
    for (const [role, from, to, first, playable] of cases) {
      it(`${role} ${from}-${to}`, () => {
      if (!playable) assertBogControl();
      const fen = role === 'bishop' ? '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1' : role === 'queen' ? '4k3/8/8/8/8/8/8/3QK3 w - - 0 1' : role === 'knight' ? '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1' : role === 'king' ? '4k3/8/8/8/8/8/8/4K3 w - - 0 1' : role === 'pawn' ? '4k3/8/8/8/8/8/P7/4K3 w - - 0 1' : '4k3/8/8/8/8/8/R7/4K3 w - - 0 1';
      const before = createGameState({ fen, hands: { white: [], black: [CARD] }, decks: { white: [], black: [] } });
      const moved = applyAction(before, { type: 'move', from, to });
      assert.equal(moved.ok, true);
      if (!moved.ok) return;
      const result = applyAction(moved.state, { type: 'playCard', cardId: CARD });
      assert.equal(result.ok, playable);
      if (playable && result.ok) assert.equal(result.state.pieces.find(piece => piece.square === first)?.role, role);
      });
    }
  });

  it('rejects an incomplete move', () => {
    assertBogControl();
    const base = createGameState({ fen: '4k3/8/8/8/8/8/R6n/4K3 w - - 0 1', hands: { white: [CARD], black: [] }, decks: { white: [], black: [] } });
    const noMove = applyAction(base, { type: 'playCard', cardId: CARD });
    assert.equal(noMove.ok, false);
  });

  it("rejects a move by the card owner's opponent and leaves the card unavailable", () => {
    assertBogControl();
    const before = createGameState({ fen: '4k3/8/8/8/8/8/R6n/4K3 w - - 0 1', hands: { white: [CARD], black: [] }, decks: { white: [], black: [] } });
    const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    const snapshot = JSON.stringify(moved.state);
    const wrong = applyAction(moved.state, { type: 'playCard', cardId: CARD });
    assert.equal(wrong.ok, false);
    assert.equal(JSON.stringify(moved.state), snapshot);
  });

  it('accepts a clean frozen-input success', () => {
    const before = createGameState({
      fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
      hands: { white: [], black: [CARD] },
      decks: { white: [], black: [] },
    });
    const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    const snapshot = JSON.stringify(moved.state);
    const result = applyAction(moved.state, { type: 'playCard', cardId: CARD });
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(moved.state), snapshot);
  });
});
