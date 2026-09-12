import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

function game(fen = '4k3/8/8/r7/8/8/8/4K3 w - - 0 1') {
  return createGameState({
    fen,
    turn: 'white',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: ['rebirth'] },
  });
}

function play(state: ReturnType<typeof game>, from: string, to: string) {
  return applyAction(state, { type: 'playCard', cardId: 'rebirth', target: [{ from, to }] });
}

describe('Rebirth interactions', () => {
  it('uses orientation 90 when deciding original home squares', () => {
    const state = game('8/8/8/2K2k2/3r4/8/8/8 w - - 0 1');
    state.orientation = 90;

    const result = play(state, 'd4', 'h8');

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-d4')?.square, 'h8');
  });

  it('uses orientation 180 when deciding original home squares', () => {
    const state = game('8/8/8/2K2k2/3r4/8/8/8 w - - 0 1');
    state.orientation = 180;

    const result = play(state, 'd4', 'h1');

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-d4')?.square, 'h1');
  });

  it('uses orientation 270 when deciding original home squares', () => {
    const state = game('8/8/8/2K2k2/3r4/8/8/8 w - - 0 1');
    state.orientation = 270;

    const result = play(state, 'd4', 'a1');

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-d4')?.square, 'a1');
  });

  it('uses original role and owner for a neutral source whose current role changed', () => {
    const state = game('4k3/8/8/8/8/8/4K3/7r w - - 0 1');
    const rook = state.pieces.find(piece => piece.square === 'h1')!;
    rook.role = 'bishop';
    rook.neutral = true;

    const result = play(state, 'h1', 'a8');

    assert.equal(result.ok, true);
    if (result.ok) {
      const moved = result.state.pieces.find(piece => piece.id === rook.id)!;
      assert.deepEqual(
        { square: moved.square, owner: moved.owner, role: moved.role, originalRole: moved.originalRole, neutral: moved.neutral },
        { square: 'a8', owner: 'black', role: 'bishop', originalRole: 'rook', neutral: true },
      );
    }
  });

  it('does not capture an actor-owned destination protected by Pacifism', () => {
    const state = game('N3k3/8/8/r7/8/8/8/4K3 w - - 0 1');
    const protectedPiece = state.pieces.find(piece => piece.square === 'a8')!;
    state.effects.push({ type: 'pacifism', owner: 'white', card: { id: 'p', cardId: 'pacifism' }, pieceId: protectedPiece.id });
    const before = structuredClone(state);

    const result = play(state, 'a5', 'a8');

    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });

  it('cannot select a captured source piece', () => {
    const state = game('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    state.pieces.push({ id: 'captured-rook', owner: 'black', role: 'rook', originalRole: 'rook', square: null, zone: 'captured', promoted: false, royal: false, neutral: false });
    const before = structuredClone(state);

    const result = play(state, 'a5', 'a8');

    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });

  it('uses a promoted pawn\'s promoted role and preserves its identity and state', () => {
    const state = game('4k3/8/8/8/3p4/8/4K3/8 w - - 0 1');
    const pawn = state.pieces.find(piece => piece.square === 'd4')!;
    pawn.role = 'queen';
    pawn.promoted = true;
    const before = { ...pawn };

    const result = play(state, 'd4', 'd8');

    assert.equal(result.ok, true);
    if (result.ok) {
      const moved = result.state.pieces.find(piece => piece.id === pawn.id);
      assert.deepEqual(moved, { ...before, square: 'd8' });
      assert.equal(moved?.role, 'queen');
      assert.equal(moved?.promoted, true);
    }
  });

  it('rejects a Truce-blocked capture atomically', () => {
    const state = game('N3k3/8/8/r7/8/8/8/4K3 w - - 0 1');
    state.effects.push({ type: 'truce', owner: 'black', card: { id: 'truce-card', cardId: 'truce' } });
    const before = structuredClone(state);

    const result = play(state, 'a5', 'a8');

    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });

  it('can select a neutral actor-owned source and move it home', () => {
    const state = game('4k3/8/8/R7/8/8/8/4K3 w - - 0 1');
    const rook = state.pieces.find(piece => piece.square === 'a5')!;
    rook.neutral = true;

    const result = play(state, 'a5', 'a1');

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === rook.id)?.square, 'a1');
  });

  it('can capture a neutral black destination occupant', () => {
    const state = game('n3k3/8/8/r7/8/8/8/4K3 w - - 0 1');
    const source = state.pieces.find(piece => piece.square === 'a5')!;
    const occupant = state.pieces.find(piece => piece.square === 'a8')!;
    occupant.neutral = true;

    const result = play(state, 'a5', 'a8');

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.state.pieces.find(piece => piece.id === source.id)?.square, 'a8');
      assert.deepEqual(
        result.state.pieces.find(piece => piece.id === occupant.id),
        { ...occupant, square: null, zone: 'captured', capturedBy: 'white' },
      );
    }
  });

  it('cannot select a source made dead by No Quarter and rejects atomically', () => {
    const state = game();
    const rook = state.pieces.find(piece => piece.square === 'a5')!;
    rook.square = null;
    rook.zone = 'dead';
    const before = structuredClone(state);

    const result = play(state, 'a5', 'a8');

    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });

  it('does not let Vendetta constrain this after-move card', () => {
    const state = game();
    state.effects.push({ type: 'vendetta', owner: 'black', card: { id: 'vendetta-card', cardId: 'vendetta' } });

    const result = play(state, 'a5', 'a8');

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-a5')?.square, 'a8');
  });

  it('cannot capture an actor-owned destination marked royal', () => {
    const state = game('N3k3/8/8/r7/8/8/8/4K3 w - - 0 1');
    state.pieces.find(piece => piece.square === 'a8')!.royal = true;
    const before = structuredClone(state);

    const result = play(state, 'a5', 'a8');

    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });

  it('fizzles and spends the card without moving pieces for safety violations', () => {
    for (const [fen, from, to, reason] of [
      ['r6k/8/8/8/n7/8/8/K7 w - - 0 1', 'a4', 'b8', 'SELF_CHECK'],
      ['k7/r1K5/8/8/8/8/8/R7 w - - 0 1', 'a7', 'h8', 'DIRECT_MATE'],
    ] as const) {
      const state = game(fen);
      const before = structuredClone(state);

      const result = play(state, from, to);

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.deepEqual(result.state.pieces, before.pieces);
        assert.equal(result.state.fen, before.fen);
        assert.equal(result.state.players.white.hand.length, 0);
        assert.equal(result.state.players.white.discard.at(-1)?.cardId, 'rebirth');
        assert.deepEqual(
          { type: result.state.history.at(-1)?.type, reason: result.state.history.at(-1)?.reason },
          { type: 'cardFizzled', reason },
        );
      }
    }
  });

  it('appends its history while preserving an Earthquake effect and prior history', () => {
    const state = game();
    state.orientation = 90;
    const effect = { type: 'earthquake', owner: 'white', card: { id: 'earthquake-card', cardId: 'earthquake' } } as const;
    state.effects.push(effect);
    state.history.push({ type: 'cardPlayed', cardId: 'earthquake' });
    const priorHistory = structuredClone(state.history);

    const result = play(state, 'a5', 'h8');

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-a5')?.square, 'h8');
      assert.deepEqual(result.state.effects, [effect]);
      assert.deepEqual(result.state.history.slice(0, -1), priorHistory);
      assert.deepEqual(
        { type: result.state.history.at(-1)?.type, cardId: result.state.history.at(-1)?.cardId },
        { type: 'cardPlayed', cardId: 'rebirth' },
      );
    }
  });
});
