import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets, masqueradeDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, Role, SquareName } from '../types.js';

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
    cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
    target: [{ from, to }],
  });
}

function pieceAt(state: GameState, square: SquareName) {
  const piece = state.pieces.find(candidate => candidate.square === square);
  assert(piece, `expected a piece on ${square}`);
  return piece;
}

function advance(state: GameState, ...actions: GameAction[]): GameState {
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
    state = result.state;
  }
  return state;
}

const promotionFixtures = [
  { color: 'white', opponent: 'black', fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', pawn: 'a7', from: 'a8', to: 'a5', king: 'h8', wait: 'h7' },
  { color: 'black', opponent: 'white', fen: '7k/8/8/8/8/8/p7/7K b - - 0 1', pawn: 'a2', from: 'a1', to: 'a4', king: 'h1', wait: 'h2' },
] as const;

function promotedGame(
  fixture: typeof promotionFixtures[number],
  role: Role = 'knight',
  options: Parameters<typeof createGameState>[0] = {},
) {
  return advance(createGameState({ fen: fixture.fen, hands: { [fixture.color]: [cardId] }, ...options }),
    { type: 'move', from: fixture.pawn, to: fixture.from, promotion: role },
    { type: 'endTurn' });
}

function waitingTurn(state: GameState, fixture: typeof promotionFixtures[number]) {
  return advance(state,
    { type: 'move', from: fixture.king, to: fixture.wait },
    { type: 'endTurn' });
}

describe('Masquerade ordinary promotion (finding44a)', () => {
  // Derived from rulebook Transformed Pieces / Terminology: retained original-type
  // targeting concerns Continuing Effects, not ordinary promotion. FAQ pp. 7–8
  // addresses physical accounting and Crab/Prince targeting, not a named Masquerade ruling.
  for (const fixture of promotionFixtures) {
    for (const role of ['queen', 'rook', 'bishop', 'knight'] as const) {
      it(`${fixture.color}: accepts an ordinarily promoted ${role} and preserves its identity and clocks`, () => {
        const state = waitingTurn(promotedGame(fixture, role), fixture);
        const before = structuredClone(state);
        const piece = pieceAt(state, fixture.from);
        assert.equal(piece.originalRole, 'pawn');
        assert.equal(piece.promoted, true);
        assert.equal(piece.role, role);
        assert(masqueradeDests(state, fixture.from).includes(fixture.to));
        const target = [{ from: fixture.from, to: fixture.to }];
        assert(cardPlayTargets(state, cardId).some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
        const result = play(state, fixture.from, fixture.to);
        assert.equal(result.ok, true);
        assert.deepStrictEqual(pieceAt(result.state, fixture.to), { ...piece, square: fixture.to });
        assert.deepStrictEqual(state, before);
        assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
        assert.equal(result.state.turn.moveMade, true);
        assert.equal(result.state.turn.cardPlays[fixture.color], 1);
        assert.deepStrictEqual(result.state.players[fixture.color].discard, state.players[fixture.color].hand);
        assert.deepStrictEqual(result.state.enPassant, []);
        const clocks = state.fen.split(' ').slice(4).map(Number);
        assert.deepStrictEqual(result.state.fen.split(' ').slice(4).map(Number),
          [clocks[0] + 1, clocks[1] + (fixture.color === 'black' ? 1 : 0)]);
        assert.equal(advance(result.state, { type: 'endTurn' }).turn.color, fixture.opponent);
      });
    }
  }

  it('keeps original Knights eligible for both colors', () => {
    for (const fixture of promotionFixtures) {
      const state = createGameState({
        fen: fixture.color === 'white' ? 'N6k/8/8/8/8/8/8/7K w - - 0 1' : '7k/8/8/8/8/8/8/n6K b - - 0 1',
        hands: { [fixture.color]: [cardId] },
      });
      assert.equal(pieceAt(state, fixture.from).promoted, false);
      assert.equal(play(state, fixture.from, fixture.to).ok, true);
    }
  });

  it('keeps ordinary Pawns and publicly created active Crabs excluded for both colors', () => {
    for (const fixture of promotionFixtures) {
      const pawn = fixture.color === 'white' ? 'd4' : 'd5';
      const to = fixture.color === 'white' ? 'd7' : 'd2';
      for (const crab of [false, true]) {
        let state = createGameState({
          fen: fixture.color === 'white' ? '7k/8/8/8/3P4/8/8/7K w - - 0 1' : '7k/8/8/3p4/8/8/8/7K b - - 0 1',
          hands: { [fixture.color]: crab ? ['crab', cardId] : [cardId] },
        });
        if (crab) {
          state = advance(state,
            { type: 'move', from: fixture.color === 'white' ? 'h1' : 'h8', to: fixture.color === 'white' ? 'g1' : 'g8' },
            { type: 'playCard', cardId: 'crab', target: pawn },
            { type: 'endTurn' });
          state = waitingTurn(state, fixture);
          assert.deepStrictEqual(state.effects, [{
            type: 'crab', owner: fixture.color, pieceId: pieceAt(state, pawn).id,
            card: { id: `${fixture.color}-hand-0-crab`, cardId: 'crab' },
          }]);
        }
        const before = structuredClone(state);
        assert.deepStrictEqual(masqueradeDests(state, pawn), []);
        assert(!cardPlayTargets(state, cardId).some(target => JSON.stringify(target).includes(`"from":"${pawn}"`)));
        const result = play(state, pawn, to);
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.error.code, 'WRONG_ROLE');
        assert.deepStrictEqual(result.state, before);
        assert.deepStrictEqual(state, before);
      }
    }
  });

  it('rejects malformed and occupied promoted-Knight moves atomically for both colors', () => {
    for (const fixture of promotionFixtures) {
      const state = waitingTurn(promotedGame(fixture), fixture);
      for (const [target, code] of [
        [[{ from: fixture.from, to: fixture.to, promotion: 'queen' }], 'INVALID_TARGET'],
        [[{ from: fixture.from, to: fixture.from }], 'ILLEGAL_MOVE'],
        [[{ from: fixture.from, to: fixture.color === 'white' ? 'h1' : 'h8' }], 'ILLEGAL_MOVE'],
      ] as const) {
        const before = structuredClone(state);
        const result = applyAction(state, { type: 'playCard', cardId, target });
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.error.code, code);
        assert.deepStrictEqual(result.state, before);
        assert.deepStrictEqual(state, before);
      }
    }
  });

  it('allows Haunting Memories to copy Masquerade onto an ordinary promoted Knight for both colors', () => {
    for (const fixture of promotionFixtures) {
      let state = promotedGame(fixture, 'knight', {
        hands: { [fixture.color]: ['haunting-memories'], [fixture.opponent]: [cardId] },
      });
      state = advance(state,
        { type: 'playCard', cardId, target: [{ from: fixture.king, to: fixture.wait }] },
        { type: 'endTurn' });
      const target = [{ from: fixture.from, to: fixture.to }];
      assert(cardPlayTargets(state, 'haunting-memories').some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
      const piece = pieceAt(state, fixture.from);
      const next = advance(state, { type: 'playCard', cardId: 'haunting-memories', target });
      assert.deepStrictEqual(pieceAt(next, fixture.to), { ...piece, square: fixture.to });
      assert.equal(next.history.at(-1)?.copiedCardId, cardId);
      assert.equal(next.players[fixture.color].discard.at(-1)?.cardId, 'haunting-memories');
    }
  });

  it('allows a Pawn carrier merged with an ordinarily promoted Knight for both colors', () => {
    for (const fixture of promotionFixtures) {
      const carrier = fixture.color === 'white' ? 'b6' : 'b3';
      const to = fixture.color === 'white' ? 'e6' : 'e3';
      let state = waitingTurn(promotedGame(fixture, 'knight', {
        fen: fixture.color === 'white' ? '7k/P7/1P6/8/8/8/8/7K w - - 0 1' : '7k/8/8/8/8/1p6/p7/7K b - - 0 1',
        hands: { [fixture.color]: ['confabulation', cardId] },
      }), fixture);
      const knight = pieceAt(state, fixture.from);
      state = advance(state,
        { type: 'playCard', cardId: 'confabulation', target: [{ from: fixture.from, to: carrier }] },
        { type: 'endTurn' },
        { type: 'move', from: fixture.wait, to: fixture.king },
        { type: 'endTurn' });
      assert.equal(state.pieces.find(piece => piece.id === knight.id)?.zone, 'away');
      const pawn = pieceAt(state, carrier);
      assert.equal(pawn.promoted, false);
      assert(masqueradeDests(state, carrier).includes(to));
      const next = advance(state, { type: 'playCard', cardId, target: [{ from: carrier, to }] });
      assert.deepStrictEqual(pieceAt(next, to), { ...pawn, square: to });
      assert.deepStrictEqual(next.pieces.find(piece => piece.id === knight.id), state.pieces.find(piece => piece.id === knight.id));
      assert.deepStrictEqual(next.effects, state.effects);
      assert.equal(next.fen.split(' ')[4], '0');
    }
  });
});

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

  it('excludes current Pawns and unpromoted original Pawn identities', () => {
    const rejectedCases: Array<[string, (piece: ReturnType<typeof pieceAt>) => void]> = [
      ['current Pawn', () => {}],
      ['original Pawn transformed to Knight', piece => { piece.role = 'knight'; }],
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
    const invalidTargets: Array<[string, unknown, string]> = [
      ['missing', undefined, 'INVALID_TARGET'],
      ['null', null, 'INVALID_TARGET'],
      ['bare move', { from: 'd4', to: 'd7' }, 'INVALID_TARGET'],
      ['empty list', [], 'INVALID_TARGET'],
      ['multiple moves', [{ from: 'd4', to: 'd7' }, { from: 'e1', to: 'e2' }], 'INVALID_TARGET'],
      ['non-move element', ['d4', 'd7'], 'INVALID_TARGET'],
      ['invalid square', [{ from: 'd4', to: 'd9' }], 'INVALID_TARGET'],
      ['same square', [{ from: 'd4', to: 'd4' }], 'ILLEGAL_MOVE'],
    ];
    for (const [label, target, code] of invalidTargets) {
      const state = game(baseFen);
      const snapshot = structuredClone(state);
      const result = applyAction(state, {
        type: 'playCard',
        cardId,
        cardInstanceId: state.players.white.hand[0]?.id,
        target,
      });
      assert.equal(result.ok, false, label);
      if (!result.ok) assert.equal(result.error.code, code, label);
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
