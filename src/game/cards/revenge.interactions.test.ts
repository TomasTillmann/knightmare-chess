import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { activeDoomsayers, applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { ApplyResult, GameState, PieceState } from '../types.js';

function stateOf(result: ApplyResult): GameState {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function pieceAt(state: GameState, square: string): PieceState | undefined {
  return state.pieces.find(piece => piece.square === square);
}

function requiredPieceAt(state: GameState, square: string): PieceState {
  const piece = pieceAt(state, square);
  assert.ok(piece, `expected a piece on ${square}`);
  return piece;
}

function assertRejectedAtomically(result: ApplyResult, before: GameState): void {
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
}

function ordinaryPawnCapture(hands: { white?: string[]; black?: string[] } = {
  black: ['revenge'],
}): GameState {
  const before = createGameState({
    fen: '4k3/8/8/3p4/4P3/8/P7/4K3 w - - 0 1',
    hands,
  });
  return stateOf(applyAction(before, { type: 'move', from: 'e4', to: 'd5' }));
}

describe('Revenge interactions', () => {
  it('opens after an ordinary en-passant capture of the reactor pawn', () => {
    const before = createGameState({
      fen: '4k3/8/8/3pP3/8/8/P7/4K3 w - d6 0 1',
      hands: { black: ['revenge'] },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'e5', to: 'd6' }));
    const target = requiredPieceAt(moved, 'a2');

    const result = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'a2' });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === target.id)?.zone, 'captured');
  });

  it('No Quarter closes the immediate Revenge window after an ordinary capture', () => {
    const before = createGameState({
      fen: '4k3/8/8/3p4/4P3/8/P7/4K3 w - - 0 1',
      hands: { white: ['no-quarter'], black: ['revenge'] },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'e4', to: 'd5' }));
    const noQuarter = stateOf(applyAction(moved, { type: 'playCard', cardId: 'no-quarter' }));

    const result = applyAction(noQuarter, {
      type: 'playCard',
      cardId: 'revenge',
      target: 'a2',
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.state, noQuarter);
  });

  it('does not accept a forged card-play capture as capture without a card', () => {
    const state = createGameState({
      fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { black: ['revenge'] },
    });
    state.history.push({
      type: 'cardPlayed',
      cardId: 'assassin',
      player: 'white',
      capturedId: 'black-pawn-d7',
    });

    const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'a2' });

    assertRejectedAtomically(result, state);
  });

  it('Bog consumes the reactor allowance and closes the capture window it rewinds', () => {
    const before = createGameState({
      fen: '4k3/8/8/8/p7/8/1P6/R3K3 w - - 0 1',
      hands: { black: ['bog', 'revenge'] },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'a1', to: 'a4' }));
    const bogged = stateOf(applyAction(moved, { type: 'playCard', cardId: 'bog' }));
    assert.equal(pieceAt(bogged, 'a2')?.role, 'rook');
    assert.equal(pieceAt(bogged, 'a4')?.owner, 'black');

    const result = applyAction(bogged, { type: 'playCard', cardId: 'revenge', target: 'b2' });

    assertRejectedAtomically(result, bogged);
  });

  it('does not treat a Rebirth capture as an ordinary capture trigger', () => {
    const before = createGameState({
      fen: 'P3k2r/8/8/8/8/8/1P2P3/4K3 w - - 0 1',
      hands: { white: ['rebirth'], black: ['revenge'] },
    });
    const victim = requiredPieceAt(before, 'a8');
    const moved = stateOf(applyAction(before, { type: 'move', from: 'e2', to: 'e3' }));
    const reborn = stateOf(applyAction(moved, {
      type: 'playCard',
      cardId: 'rebirth',
      target: [{ from: 'h8', to: 'a8' }],
    }));
    assert.equal(reborn.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');

    const result = applyAction(reborn, { type: 'playCard', cardId: 'revenge', target: 'b2' });

    assertRejectedAtomically(result, reborn);
  });

  it('does not treat an Assassin capture as an ordinary capture trigger', () => {
    const before = createGameState({
      fen: '4k3/8/8/8/8/8/PP6/R3K3 w - - 0 1',
      hands: { white: ['assassin'], black: ['revenge'] },
    });
    const assassinated = stateOf(applyAction(before, {
      type: 'playCard',
      cardId: 'assassin',
      target: [{ from: 'a1', to: 'a2' }],
    }));
    assert.equal(requiredPieceAt(before, 'a2').zone, 'board');
    assert.equal(assassinated.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'captured');

    const result = applyAction(assassinated, {
      type: 'playCard',
      cardId: 'revenge',
      target: 'b2',
    });

    assertRejectedAtomically(result, assassinated);
  });

  it('does not treat a Doomsayer loss as an ordinary capture trigger', () => {
    const before = createGameState({
      fen: '4k3/3p4/8/8/8/8/P3P3/4K3 w - - 0 1',
      hands: { white: ['doomsayer'], black: ['revenge'] },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'e2', to: 'e3' }));
    const announced = stateOf(applyAction(moved, { type: 'playCard', cardId: 'doomsayer' }));
    const effect = activeDoomsayers(announced)[0];
    const pawn = requiredPieceAt(announced, 'd7');
    assert.ok(effect);
    const named = stateOf(applyAction(announced, {
      type: 'namePiece',
      speaker: 'black',
      name: 'pawn',
      losses: [{ effectId: effect.card.id, pieceId: pawn.id }],
    }));
    assert.equal(named.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');

    const result = applyAction(named, { type: 'playCard', cardId: 'revenge', target: 'a2' });

    assertRejectedAtomically(result, named);
  });

  for (const [name, effect] of [
    ['Pacifism', (pieceId: string): GameState['effects'][number] => ({
      type: 'pacifism',
      owner: 'white',
      card: { id: 'pacifism-effect', cardId: 'pacifism' },
      pieceId,
    })],
    ['Truce', (): GameState['effects'][number] => ({
      type: 'truce',
      owner: 'white',
      card: { id: 'truce-effect', cardId: 'truce' },
    })],
    ['Mystic Shield', (pieceId: string) => ({
      type: 'mysticShield',
      owner: 'white',
      card: { id: 'mystic-shield-effect', cardId: 'mystic-shield' },
      pieceId,
    } as unknown as GameState['effects'][number])],
  ] as const) {
    it(`respects ${name} capture protection`, () => {
      const moved = ordinaryPawnCapture();
      const target = requiredPieceAt(moved, 'a2');
      moved.effects.push(effect(target.id));
      const snapshot = structuredClone(moved);

      const result = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'a2' });

      assertRejectedAtomically(result, snapshot);
      assert.equal(requiredPieceAt(result.state, 'a2').zone, 'board');
    });
  }

  it('opens when the ordinary capture was compelled by Vendetta', () => {
    const before = createGameState({
      fen: '4k3/8/8/3p4/4P3/8/P7/4K3 w - - 0 1',
      hands: { black: ['revenge'] },
    });
    before.effects.push({
      type: 'vendetta',
      owner: 'black',
      card: { id: 'vendetta-effect', cardId: 'vendetta' },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'e4', to: 'd5' }));

    const result = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'a2' });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'captured');
  });

  for (const [name, role, promoted, allowed] of [
    ['unpromoted original Pawn transformed into a Knight', 'knight', false, true],
    ['promoted original Pawn transformed into a Queen', 'queen', true, false],
    ['promoted piece whose current role is Pawn', 'pawn', true, true],
  ] as const) {
    it(`${allowed ? 'opens' : 'stays closed'} after capturing a ${name}`, () => {
      const before = createGameState({
        fen: '4k3/8/8/3p4/4P3/8/P7/4K3 w - - 0 1',
        hands: { black: ['revenge'] },
      });
      Object.assign(requiredPieceAt(before, 'd5'), {
        role,
        originalRole: 'pawn',
        promoted,
      });
      const moved = stateOf(applyAction(before, { type: 'move', from: 'e4', to: 'd5' }));
      const target = requiredPieceAt(moved, 'a2');

      const result = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'a2' });

      if (allowed) {
        assert.equal(result.ok, true);
        if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === target.id)?.zone, 'captured');
      } else {
        assertRejectedAtomically(result, moved);
      }
    });
  }

  for (const [name, role, promoted, allowed] of [
    ['unpromoted transformed original Pawn', 'knight', false, true],
    ['promoted original Pawn no longer currently a Pawn', 'queen', true, false],
  ] as const) {
    it(`${allowed ? 'can' : 'cannot'} target an ${name}`, () => {
      const moved = ordinaryPawnCapture();
      const target = requiredPieceAt(moved, 'a2');
      Object.assign(target, { role, originalRole: 'pawn', promoted });
      const snapshot = structuredClone(moved);

      const result = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'a2' });

      if (allowed) {
        assert.equal(result.ok, true);
        if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === target.id)?.zone, 'captured');
      } else {
        assertRejectedAtomically(result, snapshot);
      }
    });
  }

  it('allows a neutral Pawn to supply both the trigger and the target', () => {
    const before = createGameState({
      fen: '4k3/8/8/3p4/4P3/8/p7/4K3 w - - 0 1',
      hands: { black: ['revenge'] },
    });
    requiredPieceAt(before, 'd5').neutral = true;
    requiredPieceAt(before, 'a2').neutral = true;
    const moved = stateOf(applyAction(before, { type: 'move', from: 'e4', to: 'd5' }));

    const result = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'a2' });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'black-pawn-a2')?.zone, 'captured');
  });

  it('uses fixed target squares after Earthquake changes Pawn orientation', () => {
    const before = createGameState({
      fen: '4k3/8/7p/4p3/3P4/8/P7/4K3 b - - 0 1',
      hands: { black: ['earthquake', 'revenge'] },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'h6', to: 'h5' }));
    const rotated = stateOf(applyAction(moved, {
      type: 'playCard',
      cardId: 'earthquake',
      target: { direction: 'counterclockwise', promotions: [] },
    }));
    const whiteTurn = stateOf(applyAction(rotated, { type: 'endTurn' }));
    const captured = stateOf(applyAction(whiteTurn, { type: 'move', from: 'd4', to: 'e5' }));

    const result = applyAction(captured, { type: 'playCard', cardId: 'revenge', target: 'a2' });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'captured');
  });

  it('selects the requested instance and uses only the reactor card allowance', () => {
    const before = createGameState({
      fen: '4k3/8/8/3p4/4P3/8/P7/4K3 w - - 0 1',
      hands: { black: ['revenge', 'revenge'] },
      decks: { black: ['pacifism'] },
      cardPlays: { white: 1 },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'e4', to: 'd5' }));
    const selected = moved.players.black.hand[1];

    const result = applyAction(moved, {
      type: 'playCard',
      cardId: 'revenge',
      cardInstanceId: selected.id,
      target: 'a2',
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.state.players.black.discard.some(card => card.id === selected.id));
    assert.ok(result.state.players.black.hand.some(card => card.id === 'black-hand-0-revenge'));
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.equal(result.state.turn.cardPlays.black, 1);
  });

  it('fizzles instead of directly checkmating the mover', () => {
    const before = createGameState({
      fen: '4k1rr/8/8/1p6/P7/8/7P/7K w - - 0 1',
      hands: { black: ['revenge'] },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'a4', to: 'b5' }));

    const result = stateOf(applyAction(moved, {
      type: 'playCard',
      cardId: 'revenge',
      target: 'h2',
    }));

    assert.equal(pieceAt(result, 'h2')?.zone, 'board');
    assert.deepEqual(result.history.at(-1), {
      type: 'cardFizzled',
      cardId: 'revenge',
      movement: [],
      preservePreviousMove: true,
      reason: 'DIRECT_MATE',
    });
  });

  it('fizzles rather than expose the reacting King to capture', () => {
    const before = createGameState({
      fen: '4k3/8/8/1p6/P3P3/8/8/4R2K w - - 0 1',
      hands: { black: ['revenge'] },
    });
    const moved = stateOf(applyAction(before, { type: 'move', from: 'a4', to: 'b5' }));

    const result = stateOf(applyAction(moved, {
      type: 'playCard',
      cardId: 'revenge',
      target: 'e4',
    }));

    assert.equal(pieceAt(result, 'e4')?.zone, 'board');
    assert.deepEqual(result.history.at(-1), {
      type: 'cardFizzled',
      cardId: 'revenge',
      movement: [],
      preservePreviousMove: true,
      reason: 'SELF_CHECK',
    });
  });

  it('preserves move history, phase and clocks until end turn closes the window', () => {
    const moved = ordinaryPawnCapture();
    const target = requiredPieceAt(moved, 'a2');
    const moveHistory = structuredClone(moved.history);
    const turn = structuredClone(moved.turn);
    const fenTail = moved.fen.split(' ').slice(1);
    const avenged = stateOf(applyAction(moved, {
      type: 'playCard',
      cardId: 'revenge',
      target: 'a2',
    }));
    assert.deepEqual(avenged.history.slice(0, moveHistory.length), moveHistory);
    assert.deepEqual(avenged.turn, { ...turn, cardPlays: { ...turn.cardPlays, black: 1 } });
    assert.deepEqual(avenged.fen.split(' ').slice(1), fenTail);
    assert.deepEqual(avenged.history.at(-1), {
      type: 'cardPlayed',
      cardId: 'revenge',
      target: 'a2',
      capturedId: target.id,
      movement: [],
      preservePreviousMove: true,
    });

    const anotherMove = ordinaryPawnCapture();
    const ended = stateOf(applyAction(anotherMove, { type: 'endTurn' }));
    const late = applyAction(ended, { type: 'playCard', cardId: 'revenge', target: 'a2' });
    assertRejectedAtomically(late, ended);
  });
});
