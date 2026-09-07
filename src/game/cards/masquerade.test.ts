import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

const cardId = 'masquerade';

function game(fen: string): GameState {
  return createGameState({
    fen,
    hands: { white: [cardId] },
    decks: { white: ['bog'] },
  });
}

function play(state: GameState, from: SquareName, to: SquareName) {
  return applyAction(state, {
    type: 'playCard',
    cardId,
    cardInstanceId: state.players.white.hand[0]?.id,
    target: [{ from, to }],
  });
}

function pieceAt(state: GameState, square: SquareName) {
  const piece = state.pieces.find(candidate => candidate.square === square);
  assert(piece, `expected a piece on ${square}`);
  return piece;
}

describe('Masquerade', () => {
  it('publishes the printed card metadata', () => {
    const card = CARD_CATALOG[cardId];

    assert(card);
    assert.deepStrictEqual({
      id: card.id,
      name: card.name,
      points: card.points,
      unique: card.unique,
      continuing: card.continuing,
      timing: card.timing,
      description: card.description,
    }, {
      id: 'masquerade',
      name: 'Masquerade',
      points: 5,
      unique: false,
      continuing: false,
      timing: ['beforeMove'],
      description: 'Move one of your pieces, except a Pawn, as if it were a Queen. You cannot capture a piece with this move.',
    });
  });

  it('uses unobstructed Queen rays and rejects blockers or occupied destinations', () => {
    const legal: Array<[string, string, SquareName, SquareName]> = [
      ['orthogonal Knight', '7k/8/8/8/3N4/8/8/4K3 w - - 7 12', 'd4', 'd7'],
      ['diagonal Rook', '7k/8/8/8/3R4/8/8/4K3 w - - 0 1', 'd4', 'g7'],
      ['royal piece', '7k/8/8/8/3K4/8/8/8 w - - 0 1', 'd4', 'a4'],
    ];
    for (const [label, fen, from, to] of legal) {
      const result = play(game(fen), from, to);
      assert.equal(result.ok, true, label);
      if (!result.ok) continue;
      assert.equal(result.state.pieces.find(piece => piece.square === to)?.id.includes(from), true, label);
      assert.equal(result.state.history.at(-1)?.type, 'cardPlayed', label);
    }

    const illegal: Array<[string, string, SquareName, SquareName]> = [
      ['friendly blocker', '7k/8/3B4/8/3N4/8/8/4K3 w - - 0 1', 'd4', 'd7'],
      ['enemy blocker', '7k/8/5p2/8/3N4/8/8/4K3 w - - 0 1', 'd4', 'g7'],
      ['friendly destination', '7k/3B4/8/8/3N4/8/8/4K3 w - - 0 1', 'd4', 'd7'],
      ['enemy destination', '7k/3b4/8/8/3N4/8/8/4K3 w - - 0 1', 'd4', 'd7'],
    ];
    for (const [label, fen, from, to] of illegal) {
      const state = game(fen);
      const result = play(state, from, to);
      assert.equal(result.ok, false, label);
      assert.deepStrictEqual(result.state, state, label);
    }
  });

  it('changes movement geometry without changing physical identity', () => {
    const cases: Array<[string, SquareName, SquareName]> = [
      ['7k/8/8/8/3N4/8/8/4K3 w - - 0 1', 'd4', 'd7'],
      ['7k/8/8/8/3B4/8/8/4K3 w - - 0 1', 'd4', 'a4'],
      ['7k/8/8/8/3R4/8/8/4K3 w - - 0 1', 'd4', 'g7'],
      ['7k/8/8/8/3Q4/8/8/4K3 w - - 0 1', 'd4', 'a7'],
      ['7k/8/8/8/3K4/8/8/8 w - - 0 1', 'd4', 'a4'],
    ];
    for (const [fen, from, to] of cases) {
      const state = game(fen);
      const before = pieceAt(state, from);
      const identity = {
        id: before.id,
        owner: before.owner,
        role: before.role,
        originalRole: before.originalRole,
        promoted: before.promoted,
        royal: before.royal,
        neutral: before.neutral,
      };
      const result = play(state, from, to);
      assert.equal(result.ok, true, before.role);
      if (!result.ok) continue;
      const after = result.state.pieces.find(piece => piece.id === before.id);
      assert(after);
      assert.deepStrictEqual({
        id: after.id,
        owner: after.owner,
        role: after.role,
        originalRole: after.originalRole,
        promoted: after.promoted,
        royal: after.royal,
        neutral: after.neutral,
      }, identity);
      assert.equal(after.square, to);
    }
  });

  it('excludes any current or original Pawn identity', () => {
    const rejectedCases: Array<[string, (piece: ReturnType<typeof pieceAt>) => void]> = [
      ['current Pawn', () => {}],
      ['original Pawn transformed to Knight', piece => { piece.role = 'knight'; }],
      ['promoted original Pawn', piece => { piece.role = 'queen'; piece.promoted = true; }],
      ['original non-Pawn transformed to current Pawn', piece => {
        piece.role = 'pawn';
        piece.originalRole = 'knight';
      }],
    ];
    for (const [label, mutate] of rejectedCases) {
      const state = game('7k/8/8/8/3P4/8/8/4K3 w - - 0 1');
      mutate(pieceAt(state, 'd4'));
      const result = play(state, 'd4', 'd7');
      assert.equal(result.ok, false, label);
      assert.deepStrictEqual(result.state, state, label);
    }

    const eligible = game('7k/8/8/8/3B4/8/8/4K3 w - - 0 1');
    pieceAt(eligible, 'd4').role = 'rook';
    assert.equal(play(eligible, 'd4', 'd7').ok, true);
  });

  it('allows a neutral enemy piece but not an uncontrolled enemy piece', () => {
    const neutral = game('7k/8/8/8/3n4/8/8/4K3 w - - 0 1');
    pieceAt(neutral, 'd4').neutral = true;
    const moved = play(neutral, 'd4', 'd7');
    assert.equal(moved.ok, true);
    if (moved.ok) {
      assert.deepStrictEqual(
        { ...pieceAt(moved.state, 'd7'), square: null },
        { ...pieceAt(neutral, 'd4'), square: null },
      );
    }

    const enemy = game('7k/8/8/8/3n4/8/8/4K3 w - - 0 1');
    const rejected = play(enemy, 'd4', 'd7');
    assert.equal(rejected.ok, false);
    assert.deepStrictEqual(rejected.state, enemy);
  });

  it('requires the canonical payload, current card instance, timing, and allowance', () => {
    const baseFen = '7k/8/8/8/3N4/8/8/4K3 w - - 0 1';
    const invalidTargets: Array<[string, unknown]> = [
      ['missing', undefined],
      ['null', null],
      ['bare move', { from: 'd4', to: 'd7' }],
      ['empty list', []],
      ['multiple moves', [{ from: 'd4', to: 'd7' }, { from: 'e1', to: 'e2' }]],
      ['non-move element', ['d4', 'd7']],
      ['invalid square', [{ from: 'd4', to: 'd9' }]],
      ['same square', [{ from: 'd4', to: 'd4' }]],
    ];
    for (const [label, target] of invalidTargets) {
      const state = game(baseFen);
      const snapshot = structuredClone(state);
      const result = applyAction(state, {
        type: 'playCard',
        cardId,
        cardInstanceId: state.players.white.hand[0]?.id,
        target,
      });
      assert.equal(result.ok, false, label);
      if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET', label);
      assert.deepStrictEqual(result.state, snapshot, label);
      assert.deepStrictEqual(state, snapshot, label);
    }

    const wrongInstance = createGameState({
      fen: baseFen,
      hands: { white: [cardId, 'bog'] },
    });
    const rejectedActions: Array<[string, GameState, Parameters<typeof applyAction>[1], string]> = [
      ['unknown instance', game(baseFen), { type: 'playCard', cardId, cardInstanceId: 'missing', target: [{ from: 'd4', to: 'd7' }] }, 'CARD_NOT_IN_HAND'],
      ['mismatched instance', wrongInstance, { type: 'playCard', cardId, cardInstanceId: wrongInstance.players.white.hand[1]?.id, target: [{ from: 'd4', to: 'd7' }] }, 'CARD_NOT_IN_HAND'],
      ['after-move phase', createGameState({ fen: baseFen, phase: 'afterMove', hands: { white: [cardId] } }), { type: 'playCard', cardId, cardInstanceId: 'white-hand-0-masquerade', target: [{ from: 'd4', to: 'd7' }] }, 'INVALID_TIMING'],
      ['move already made', createGameState({ fen: baseFen, moveMade: true, hands: { white: [cardId] } }), { type: 'playCard', cardId, cardInstanceId: 'white-hand-0-masquerade', target: [{ from: 'd4', to: 'd7' }] }, 'INVALID_TIMING'],
      ['allowance spent', createGameState({ fen: baseFen, cardPlays: { white: 1 }, hands: { white: [cardId] } }), { type: 'playCard', cardId, cardInstanceId: 'white-hand-0-masquerade', target: [{ from: 'd4', to: 'd7' }] }, 'CARD_ALREADY_PLAYED'],
    ];
    for (const [label, state, action, code] of rejectedActions) {
      const snapshot = structuredClone(state);
      const result = applyAction(state, action);
      assert.equal(result.ok, false, label);
      if (!result.ok) assert.equal(result.error.code, code, label);
      assert.deepStrictEqual(result.state, snapshot, label);
      assert.deepStrictEqual(state, snapshot, label);
    }
  });

  it('enumerates only canonical legal non-capturing targets', () => {
    const state = game('7k/6r1/3B4/8/3N4/8/2P5/4K3 w - - 0 1');
    const snapshot = structuredClone(state);
    const targets = cardPlayTargets(state, cardId);
    const serialized = targets.map(target => JSON.stringify(target));

    assert(serialized.includes(JSON.stringify([{ from: 'd4', to: 'a4' }])));
    assert(!serialized.includes(JSON.stringify([{ from: 'd4', to: 'd7' }])));
    assert(!serialized.includes(JSON.stringify([{ from: 'd4', to: 'g7' }])));
    assert(!serialized.some(target => target.includes('"from":"c2"')));
    for (const target of targets) {
      assert(Array.isArray(target));
      assert.equal(target.length, 1);
      assert.deepStrictEqual(Object.keys(target[0] as object).sort(), ['from', 'to']);
    }
    assert.deepStrictEqual(state, snapshot);
  });

  it('consumes the replacement move and performs the normal card lifecycle once', () => {
    const state = game('7k/8/8/8/3N4/8/8/4K3 w - - 7 12');
    const playedCard = state.players.white.hand[0];
    assert(playedCard);
    const snapshot = structuredClone(state);
    const result = play(state, 'd4', 'd7');

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepStrictEqual(state, snapshot);
    assert.deepStrictEqual(result.state.turn, {
      color: 'white',
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    assert.deepStrictEqual(result.state.players.white.hand.map(card => card.cardId), ['bog']);
    assert.deepStrictEqual(result.state.players.white.deck, []);
    assert.deepStrictEqual(result.state.players.white.discard, [playedCard]);
    assert.deepStrictEqual(result.state.players.black, state.players.black);
    assert.deepStrictEqual(result.state.effects, []);
    const event = result.state.history.at(-1);
    assert.equal(event?.type, 'cardPlayed');
    assert.equal(event.cardId, cardId);
    assert.deepStrictEqual(event.target, [{ from: 'd4', to: 'd7' }]);
    assert.deepStrictEqual(event.movement, [{ from: 'd4', to: 'd7' }]);
    assert.equal(event.preservePreviousMove, false);
  });

  it('updates the board clocks while clearing en-passant without unrelated history damage', () => {
    const state = game('7k/8/8/3p4/3N4/8/8/4K3 w - d6 17 23');
    state.history.push({ type: 'move', from: 'd7', to: 'd5' });
    const prefix = structuredClone(state.history);
    const result = play(state, 'd4', 'a4');

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.fen, '7k/8/8/3p4/N7/8/8/4K3 b - - 18 23');
    assert.deepStrictEqual(result.state.enPassant, []);
    assert.deepStrictEqual(result.state.history.slice(0, -1), prefix);
    assert.equal(pieceAt(result.state, 'a4').id, 'white-knight-d4');
  });

  it('revokes only castling rights belonging to the masquerading royal piece or Rook', () => {
    const cases: Array<[string, SquareName, SquareName, string]> = [
      ['4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'a1', 'b2', 'K'],
      ['4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1', 'e3', '-'],
    ];
    for (const [fen, from, to, rights] of cases) {
      const result = play(game(fen), from, to);
      assert.equal(result.ok, true, from);
      if (result.ok) assert.equal(result.state.fen.split(' ')[2], rights, from);
    }
  });

  it('fizzles self-check atomically but spends the card and consumes an initially-safe replacement move', () => {
    const state = game('4r2k/8/8/8/8/8/4R3/4K3 w - - 4 9');
    const pieces = structuredClone(state.pieces);
    const playedCard = state.players.white.hand[0];
    assert(playedCard);
    const result = play(state, 'e2', 'd2');

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepStrictEqual(result.state.pieces, pieces);
    assert.equal(result.state.fen.split(' ')[0], state.fen.split(' ')[0]);
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.phase, 'afterMove');
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.deepStrictEqual(result.state.players.white.discard, [playedCard]);
    assert.deepStrictEqual(result.state.players.white.hand.map(card => card.cardId), ['bog']);
    assert.deepStrictEqual(result.state.history.at(-1), {
      type: 'cardFizzled',
      cardId,
      reason: 'SELF_CHECK',
      movement: [],
      preservePreviousMove: false,
    });
  });

  it('can escape existing check while an unsafe failed attempt leaves the Regular Move available', () => {
    const escaping = game('4r2k/8/8/8/8/8/N7/4K3 w - - 4 9');
    const escaped = play(escaping, 'a2', 'e2');
    assert.equal(escaped.ok, true);
    if (escaped.ok) {
      assert.equal(pieceAt(escaped.state, 'e2').id, 'white-knight-a2');
      assert.equal(escaped.state.history.at(-1)?.type, 'cardPlayed');
      assert.equal(escaped.state.turn.moveMade, true);
    }

    const unsafe = game('4r2k/8/8/8/8/8/N7/4K3 w - - 4 9');
    const pieces = structuredClone(unsafe.pieces);
    const failed = play(unsafe, 'a2', 'a5');
    assert.equal(failed.ok, true);
    if (!failed.ok) return;
    assert.deepStrictEqual(failed.state.pieces, pieces);
    assert.equal(failed.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(failed.state.history.at(-1)?.reason, 'SELF_CHECK');
    assert.equal(failed.state.turn.moveMade, false);
    assert.equal(failed.state.turn.phase, 'beforeMove');
    assert.equal(failed.state.turn.cardPlays.white, 1);
    assert.deepStrictEqual(failed.state.players.white.hand.map(card => card.cardId), ['bog']);
    assert.deepStrictEqual(failed.state.players.white.discard.map(card => card.cardId), [cardId]);
  });

  it('fizzles newly-created direct checkmate while restoring the board and spending the card', () => {
    const state = game('7k/R7/6K1/3B4/8/8/8/8 w - - 0 1');
    const pieces = structuredClone(state.pieces);
    const result = play(state, 'a7', 'h7');

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepStrictEqual(result.state.pieces, pieces);
    assert.equal(result.state.fen.split(' ')[0], state.fen.split(' ')[0]);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.deepStrictEqual(result.state.players.white.hand.map(card => card.cardId), ['bog']);
    assert.deepStrictEqual(result.state.players.white.discard.map(card => card.cardId), [cardId]);
  });
});
