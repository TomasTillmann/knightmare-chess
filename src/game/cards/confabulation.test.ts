import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';

// Confabulation focused lifecycle, timing, and king-safety coverage.
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

const game = (options: any = {}) => createGameState(options);
const play = (state: any, target: any) => applyAction(state, { type: 'playCard', cardId: 'confabulation', target });
const accepted = (result: any) => { assert.equal(result.ok, true); return result.state; };
const rejected = (state: any, target: any) => { const before = structuredClone(state); const result = play(state, target); assert.equal(result.ok, false); assert.strictEqual(result.state, state); assert.deepEqual(state, before); };

describe('Confabulation continuing-effect direct mate (§11.4)', () => {
  for (const fixture of [
    { color: 'white', previous: 'black', fen: 'k6B/pp6/8/8/3n4/5p2/8/3K3R b - - 0 1', setupFrom: 'd4', setupTo: 'f3', from: 'h1', to: 'h8' },
    { color: 'black', previous: 'white', fen: '3k3r/8/5P2/3N4/8/8/PP6/K6b w - - 0 1', setupFrom: 'd5', setupTo: 'f6', from: 'h8', to: 'h1' },
  ] as const) {
    it(`${fixture.color}: Haunting Memories retains copied Confabulation through direct mate`, () => {
      const state = game({ fen: fixture.fen, hands: { [fixture.previous]: ['confabulation'], [fixture.color]: ['haunting-memories'] }, decks: { white: [], black: [] } });
      const copied = state.players[fixture.color].hand[0];
      const previous = accepted(play(state, [{ from: fixture.setupFrom, to: fixture.setupTo }]));
      const ready = accepted(applyAction(previous, { type: 'endTurn' }));
      const played = accepted(applyAction(ready, { type: 'playCard', cardId: 'haunting-memories', target: [{ from: fixture.from, to: fixture.to }] }));
      assert.equal(played.history.at(-1)?.type, 'cardPlayed');
      const ended = accepted(applyAction(played, { type: 'endTurn' }));
      assert.deepEqual(ended.outcome, { winner: fixture.color, reason: 'checkmate' });
      assert.deepEqual(ended.effects.find((effect: any) => effect.type === 'confabulation' && effect.owner === fixture.color)?.card, copied);
      assert.equal(ended.players[fixture.color].discard.some((card: any) => card.id === copied.id), false);
    });
  }

  for (const fixture of [
    { color: 'white', fen: 'k6B/pp6/8/8/8/8/8/4K2R w - - 0 1', queenFen: 'k6Q/pp6/8/8/8/8/8/4K3 b - - 0 1', from: 'h1', to: 'h8' },
    { color: 'black', fen: '4k2r/8/8/8/8/8/PP6/K6b b - - 0 1', queenFen: '4k3/8/8/8/8/8/PP6/K6q w - - 0 2', from: 'h8', to: 'h1' },
  ] as const) {
    const prepared = () => game({ fen: fixture.fen, hands: { white: [], black: [], [fixture.color]: ['confabulation'] }, decks: { white: [], black: [] } });
    const target = [{ from: fixture.from, to: fixture.to }];

    it(`${fixture.color}: independently establishes queen-equivalent checkmate`, () => {
      const position = Chess.fromSetup(parseFen(fixture.queenFen).unwrap()).unwrap();
      assert.equal(position.isCheck(), true);
      assert.equal(position.isCheckmate(), true);
      assert.equal(position.outcome()?.winner, fixture.color);
    });

    it(`${fixture.color}: allows the mating merge and records a successful card play`, () => {
      const state = prepared();
      const next = accepted(play(state, target));
      assert.equal(next.history.at(-1)?.type, 'cardPlayed');
      assert.equal(next.history.at(-1)?.reason, undefined);
      assert.equal(next.turn.moveMade, true);
      assert.equal(cardPlayTargets(state, 'confabulation').some((candidate: any) => JSON.stringify(candidate) === JSON.stringify(target)), true);
    });

    it(`${fixture.color}: retains both physical identities and the continuing effect through mate`, () => {
      const state = prepared();
      const rook = state.pieces.find((piece: any) => piece.square === fixture.from)!;
      const bishop = state.pieces.find((piece: any) => piece.square === fixture.to)!;
      const card = state.players[fixture.color].hand[0];
      const played = accepted(play(state, target));
      const ended = accepted(applyAction(played, { type: 'endTurn' }));
      for (const next of [played, ended]) {
        assert.deepEqual(next.pieces.find((piece: any) => piece.id === bishop.id), bishop);
        assert.deepEqual(next.pieces.find((piece: any) => piece.id === rook.id), { ...rook, square: null, zone: 'away' });
        assert.deepEqual(next.effects, [{ type: 'confabulation', owner: fixture.color, card, pieceIds: [bishop.id, rook.id] }]);
        assert.equal(next.players[fixture.color].discard.some((discarded: any) => discarded.id === card.id), false);
        assert.equal(next.players[fixture.color].hand.some((held: any) => held.id === card.id), false);
      }
      assert.deepEqual(ended.outcome, { winner: fixture.color, reason: 'checkmate' });
    });
  }

  for (const fixture of [
    { color: 'white', fen: 'k6B/1p6/8/8/8/8/8/4K2R w - - 0 1', queenFen: 'k6Q/1p6/8/8/8/8/8/4K3 b - - 0 1', from: 'h1', to: 'h8', escapeFrom: 'a8', escapeTo: 'a7' },
    { color: 'black', fen: '4k2r/8/8/8/8/8/1P6/K6b b - - 0 1', queenFen: '4k3/8/8/8/8/8/1P6/K6q w - - 0 2', from: 'h8', to: 'h1', escapeFrom: 'a1', escapeTo: 'a2' },
  ] as const) {
    it(`${fixture.color}: retains a checking merge when the opposing King has an escape`, () => {
      const position = Chess.fromSetup(parseFen(fixture.queenFen).unwrap()).unwrap();
      assert.equal(position.isCheck(), true);
      assert.equal(position.isCheckmate(), false);
      const state = game({ fen: fixture.fen, hands: { white: [], black: [], [fixture.color]: ['confabulation'] }, decks: { white: [], black: [] } });
      const played = accepted(play(state, [{ from: fixture.from, to: fixture.to }]));
      assert.equal(played.history.at(-1)?.type, 'cardPlayed');
      const ended = accepted(applyAction(played, { type: 'endTurn' }));
      assert.equal(ended.outcome, null);
      assert.deepEqual(ended.effects, played.effects);
      assert.equal(ended.effects.length, 1);
      assert.equal((legalDests(ended).get(fixture.escapeFrom) ?? []).includes(fixture.escapeTo), true);
      accepted(applyAction(ended, { type: 'move', from: fixture.escapeFrom, to: fixture.escapeTo }));
    });
  }

  for (const fixture of [
    { color: 'white', fen: 'k6B/pp6/8/8/8/8/2n5/4K2R w - - 0 1', from: 'h1', to: 'h8' },
    { color: 'black', fen: '4k2r/2N5/8/8/8/8/PP6/K6b b - - 0 1', from: 'h8', to: 'h1' },
  ] as const) {
    it(`${fixture.color}: the mate exception does not excuse leaving its own King in check`, () => {
      assert.equal(Chess.fromSetup(parseFen(fixture.fen).unwrap()).unwrap().isCheck(), true);
      const state = game({ fen: fixture.fen, hands: { white: [], black: [], [fixture.color]: ['confabulation'] }, decks: { white: [], black: [] } });
      const before = structuredClone(state);
      const card = state.players[fixture.color].hand[0];
      const next = accepted(play(state, [{ from: fixture.from, to: fixture.to }]));
      assert.deepEqual(state, before);
      assert.deepEqual(next.pieces, before.pieces);
      assert.deepEqual(next.effects, before.effects);
      assert.equal(next.history.at(-1)?.type, 'cardFizzled');
      assert.equal(next.history.at(-1)?.reason, 'SELF_CHECK');
      assert.deepEqual(next.players[fixture.color].discard, [card]);
      assert.equal(next.players[fixture.color].hand.length, 0);
      assert.equal(next.turn.moveMade, false);
      assert.equal(next.outcome, null);
    });
  }
});

describe('Confabulation', () => {
  it('publishes the card metadata', () => {
    assert.deepEqual(CARD_CATALOG.confabulation, {
      id: 'confabulation',
      name: 'Confabulation',
      points: 5,
      unique: false,
      image: '/KC7_card4.png',
      description:
        'Make a legal move which puts two of your pieces (other than Kings) on the same square. These two pieces "merge" into a new piece. It can move, capture, and be affected by cards like either one of them. Move the two pieces together. Confabulated Pawns cannot promote.',
      timing: ['beforeMove'],
      continuing: true,
    });
  });
});

describe('Confabulation behavior', () => {
  it('merges two moving pieces', () => {
    const state = game({ fen: '7k/8/8/8/8/N7/8/R6K w - - 0 1', hands: { white: ['confabulation'] }, decks: { white: [], black: [] } });
    const knight = state.pieces.find((p: any) => p.square === 'a3')!;
    const rook = state.pieces.find((p: any) => p.square === 'a1')!;
    const result: any = play(state, [{ from: 'a1', to: 'a3' }]);
    const next = accepted(result);
    assert.equal(next.pieces.find((p: any) => p.square === 'a3')?.id, knight.id);
    assert.equal(next.pieces.some((p: any) => p.id === rook.id && p.square === 'a1'), false);
    assert.equal(next.history.at(-1).preservePreviousMove, false);
  });
  it('rejects malformed targets atomically', () => {
    for (const target of [undefined, 'a1', {}, [], [{ from: 'a1', to: 'a3' }, { from: 'a1', to: 'a4' }], [{ from: 'A1', to: 'a3' }], [{ from: 'a1', to: 'a3', extra: 1 }], [{ from: 'a1', to: 'a3', extra: 1 }], [{ from: 'a1', to: 'a1' }]]) rejected(game({ hands: { white: ['confabulation'] } }), target);
  });
  it('rejects illegal occupied, blocked, and royal merges atomically', () => {
    for (const [fen, target] of [
      ['7k/8/8/N7/8/8/8/R6K w - - 0 1', [{ from: 'a1', to: 'a3' }]],
      ['7k/8/8/8/8/8/P7/R6K w - - 0 1', [{ from: 'a1', to: 'a3' }]],
      ['7k/8/8/8/8/8/1N6/R6K w - - 0 1', [{ from: 'a1', to: 'b2' }]],
      ['7k/8/8/8/8/8/4n3/4K3 w - - 0 1', [{ from: 'e1', to: 'e2' }]],
      ['7k/8/8/8/8/8/4N3/4K3 w - - 0 1', [{ from: 'e1', to: 'e2' }]],
      ['7k/8/8/8/8/8/k7/R6K w - - 0 1', [{ from: 'a1', to: 'a2' }]],
    ]) rejected(game({ fen, hands: { white: ['confabulation'] } }), target);
  });
  it('moves by the union of both component geometries', () => {
    const prepared = () => {
      let state = game({ fen: '7k/7p/8/8/8/N7/8/R6K w - - 0 1', hands: { white: ['confabulation'], black: [] }, decks: { white: [], black: [] } });
      state = accepted(play(state, [{ from: 'a1', to: 'a3' }]));
      state = accepted(applyAction(state, { type: 'endTurn' }));
      return accepted(applyAction(state, { type: 'move', from: 'h7', to: 'h6' }));
    };
    const state = accepted(applyAction(prepared(), { type: 'endTurn' }));
    const destinations = legalDests(state).get('a3') ?? [];
    assert.equal(destinations.includes('a6'), true);
    assert.equal(destinations.includes('b5'), true);
    for (const to of ['a6', 'b5']) {
      const fresh = accepted(applyAction(prepared(), { type: 'endTurn' }));
      const moved = accepted(applyAction(fresh, { type: 'move', from: 'a3', to }));
      assert.equal(moved.pieces.find((p: any) => p.square === to)?.id, fresh.pieces.find((p: any) => p.square === 'a3')?.id);
    }
  });
  it('captures as a composite and loses both original carriers', () => {
    let rookCapture = game({ fen: '7k/p7/8/8/8/N7/8/R6K w - - 0 1', hands: { white: ['confabulation'], black: [] }, decks: { white: [], black: [] } });
    const pawn = rookCapture.pieces.find((p: any) => p.square === 'a7')!;
    rookCapture = accepted(play(rookCapture, [{ from: 'a1', to: 'a3' }]));
    rookCapture = accepted(applyAction(rookCapture, { type: 'endTurn' }));
    rookCapture = accepted(applyAction(rookCapture, { type: 'move', from: 'h8', to: 'g8' }));
    rookCapture = accepted(applyAction(rookCapture, { type: 'endTurn' }));
    rookCapture = accepted(applyAction(rookCapture, { type: 'move', from: 'a3', to: 'a7' }));
    assert.equal(rookCapture.pieces.some((p: any) => p.square === 'a7' && p.owner === 'white'), true);
    assert.equal(rookCapture.pieces.find((p: any) => p.id === pawn.id)?.zone, 'captured');
    assert.equal(rookCapture.pieces.find((p: any) => p.id === pawn.id)?.square, null);

    let state = game({ fen: '7k/8/8/2b5/8/N7/8/R6K w - - 0 1', hands: { white: ['confabulation'], black: [] }, decks: { white: [], black: [] } });
    const card = state.players.white.hand[0];
    const knight = state.pieces.find((p: any) => p.square === 'a3')!;
    const rook = state.pieces.find((p: any) => p.square === 'a1')!;
    state = accepted(play(state, [{ from: 'a1', to: 'a3' }]));
    state = accepted(applyAction(state, { type: 'endTurn' }));
    state = accepted(applyAction(state, { type: 'move', from: 'c5', to: 'a3' }));
    assert.equal(state.pieces.find((p: any) => p.id === knight.id)?.square, null);
    assert.equal(state.pieces.find((p: any) => p.id === rook.id)?.square, null);
    assert.equal(state.pieces.find((p: any) => p.id === knight.id)?.zone, 'captured');
    assert.equal(state.pieces.find((p: any) => p.id === rook.id)?.zone, 'captured');
    assert.equal(state.effects.some((e: any) => e.type === 'confabulation'), false);
    assert.equal(state.players.white.discard.some((discarded) => discarded.id === card.id), true);
  });
  it('keeps a confabulated Pawn unpromoted', () => {
    const prepared = () => {
      let state = game({ fen: '7k/P7/8/8/8/8/8/R6K w - - 0 1', hands: { white: ['confabulation'], black: [] }, decks: { white: [], black: [] } });
      state = accepted(play(state, [{ from: 'a1', to: 'a7' }]));
      state = accepted(applyAction(state, { type: 'endTurn' }));
      return accepted(applyAction(state, { type: 'move', from: 'h8', to: 'g8' }));
    };
    let state = accepted(applyAction(prepared(), { type: 'endTurn' }));
    state = accepted(applyAction(state, { type: 'move', from: 'a7', to: 'a8' }));
    const pawn = state.pieces.find((p: any) => p.square === 'a8');
    assert.equal(pawn.role, 'pawn');
    assert.equal(pawn.promoted, false);
    const promotion = prepared();
    const ended = accepted(applyAction(promotion, { type: 'endTurn' }));
    const beforeEnded = structuredClone(ended);
    const result = applyAction(ended, { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' });
    assert.equal(result.ok, false);
    assert.strictEqual(result.state, ended);
    assert.deepEqual(ended, beforeEnded);
  });

  it('publishes the exact successful lifecycle and history contract', () => {
    const state = game({ fen: '7k/8/8/8/8/N7/8/R6K w - - 0 1', hands: { white: ['confabulation'] }, decks: { white: [], black: [] } });
    const card = state.players.white.hand[0];
    const knight = state.pieces.find((p: any) => p.square === 'a3')!;
    const rook = state.pieces.find((p: any) => p.square === 'a1')!;
    const next = accepted(play(state, [{ from: 'a1', to: 'a3' }]));
    assert.deepEqual(next.pieces.find((p: any) => p.id === knight.id), { ...knight, square: 'a3' });
    assert.deepEqual(next.pieces.find((p: any) => p.id === rook.id), { ...rook, square: null, zone: 'away' });
    assert.equal(next.players.white.hand.some((c: any) => c.cardId === 'confabulation'), false);
    assert.equal(next.turn.moveMade, true);
    assert.equal(next.turn.cardPlays.white, 1);
    const effect = next.effects.find((e: any) => e.type === 'confabulation');
    assert.deepEqual(effect, { type: 'confabulation', owner: 'white', card, pieceIds: [knight.id, rook.id] });
    assert.deepEqual(next.history.at(-1), { type: 'cardPlayed', cardId: 'confabulation', target: [{ from: 'a1', to: 'a3' }], movement: [{ from: 'a1', to: 'a3' }], preservePreviousMove: false });
  });

  it('enumerates only legal before-move targets and rejects stale timing/cards atomically', () => {
    const state = game({ fen: '7k/8/8/8/8/N7/8/R6K w - - 0 1', hands: { white: ['confabulation'] }, decks: { white: [], black: [] } });
    assert.deepEqual(cardPlayTargets(state, 'confabulation'), [[{ from: 'a1', to: 'a3' }]]);
    assert.equal(cardPlayTargets(state, 'confabulation').some((t: any) => JSON.stringify(t).includes('h1')), false);
    const moved = accepted(applyAction(state, { type: 'move', from: 'a3', to: 'b5' }));
    rejected(moved, [{ from: 'a1', to: 'a3' }]);
    const unavailable = game({ fen: '7k/8/8/8/8/N7/8/R6K w - - 0 1', hands: { white: [] }, decks: { white: [], black: [] } });
    rejected(unavailable, [{ from: 'a1', to: 'a3' }]);
  });

  it('fizzles pinned king-exposing merges while consuming the replacement move', () => {
    const state = game({ fen: '4r2k/8/8/8/8/8/N3R3/4K3 w - - 0 1', hands: { white: ['confabulation'] }, decks: { white: [], black: [] } });
    const before = structuredClone(state);
    const card = state.players.white.hand[0];
    const target = [{ from: 'e2', to: 'a2' }];
    assert.equal(cardPlayTargets(state, 'confabulation').some((t: any) => JSON.stringify(t) === JSON.stringify(target)), false);
    const result = play(state, target);
    assert.equal(result.ok, true);
    assert.strictEqual(result.state !== state, true);
    assert.deepEqual(state, before);
    assert.deepEqual(result.state.pieces, before.pieces);
    assert.deepEqual(result.state.effects, before.effects);
    assert.deepEqual(result.state.players.white.discard, [card]);
    assert.equal(result.state.players.white.hand.some((c: any) => c.id === card.id), false);
    assert.deepEqual(result.state.turn, { ...before.turn, phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 0 } });
    assert.deepEqual(result.state.history.at(-1), { type: 'cardFizzled', cardId: 'confabulation', reason: 'SELF_CHECK', movement: [], preservePreviousMove: false });
  });
});
