import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

describe('Forbidden City interactions', () => {
  it('keeps a no-marker Madman move legal', () => {
    const target = [{ from: 'c3', to: 'e5' }];
    const baseline = createGameState({
      fen: '7k/8/8/8/3r4/2P5/8/K7 w - - 0 1',
      hands: { white: ['madman'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'madman', target }).ok, true);

    const setup = createGameState({
      fen: '7k/8/8/8/3r4/2P5/8/K7 b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { white: ['madman'], black: ['forbidden-city'] },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: 'e5' });
    assert(marked.ok);
    const ended = applyAction(marked.state, { type: 'endTurn' });
    assert(ended.ok);

    const before = ended.state;
    const result = applyAction(before, { type: 'playCard', cardId: 'madman', target });
    assert.equal(result.ok, false);
    if (!result.ok) assert.strictEqual(result.state, before);
  });

  it('lets Rebirth ignore geometry but not enter the marked square', () => {
    const target = [{ from: 'd4', to: 'a8' }];
    const baseline = createGameState({
      fen: '8/8/8/2K2k2/3r4/8/8/8 w - - 0 1',
      phase: 'afterMove', moveMade: true,
      hands: { white: ['rebirth'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'rebirth', target }).ok, true);

    const setup = createGameState({
      fen: '8/8/8/2K2k2/3r4/8/8/8 b - - 0 1',
      phase: 'afterMove', moveMade: true,
      hands: { black: ['forbidden-city'], white: ['rebirth'] },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: 'a8' });
    assert(marked.ok);
    const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
    assert(whiteTurn.ok);
    const moved = applyAction(whiteTurn.state, { type: 'move', from: 'c5', to: 'c6' });
    assert(moved.ok);

    const before = moved.state;
    const result = applyAction(before, { type: 'playCard', cardId: 'rebirth', target });
    assert.equal(result.ok, false);
    if (!result.ok) assert.strictEqual(result.state, before);
  });

  it('blocks Squaring the Circle from entering the marked square', () => {
    const target = [{ from: 'e2', to: 'h1' }];
    const baseline = createGameState({
      fen: 'n3k2n/8/8/8/8/8/4B3/R3K3 w - - 5 9',
      hands: { white: ['squaring-the-circle'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'squaring-the-circle', target }).ok, true);

    const setup = createGameState({
      fen: 'n3k2n/8/8/8/8/8/4B3/R3K3 b - - 5 9',
      phase: 'afterMove',
      moveMade: true,
      hands: { black: ['forbidden-city'], white: ['squaring-the-circle'] },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: 'h1' });
    assert(marked.ok);
    const ended = applyAction(marked.state, { type: 'endTurn' });
    assert(ended.ok);

    const before = ended.state;
    const result = applyAction(before, { type: 'playCard', cardId: 'squaring-the-circle', target });
    assert.equal(result.ok, false);
    if (!result.ok) assert.strictEqual(result.state, before);
  });

  it('allows Dubbing to jump over the city but not enter it', () => {
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/8/R6K w - - 0 1',
      hands: { white: ['dubbing'] },
    });
    const baselineResult = applyAction(baseline, {
      type: 'playCard',
      cardId: 'dubbing',
      target: [{ from: 'a1', to: 'c2' }],
    });
    assert.equal(baselineResult.ok, true);

    const setup = (target: 'b2' | 'c2') => {
      const state = createGameState({
        fen: '7k/8/8/8/8/8/8/R6K b - - 0 1',
        phase: 'afterMove',
        moveMade: true,
        hands: {
          white: ['dubbing'],
          black: ['forbidden-city'],
        },
      });
      const marked = applyAction(state, {
        type: 'playCard',
        cardId: 'forbidden-city',
        target,
      });
      assert(marked.ok);
      const ended = applyAction(marked.state, { type: 'endTurn' });
      assert(ended.ok);
      return ended.state;
    };

    const over = applyAction(setup('b2'), {
      type: 'playCard',
      cardId: 'dubbing',
      target: [{ from: 'a1', to: 'c2' }],
    });
    assert.equal(over.ok, true);

    const enteringState = setup('c2')
    const entering = applyAction(enteringState, {
      type: 'playCard',
      cardId: 'dubbing',
      target: [{ from: 'a1', to: 'c2' }],
    });
    assert.equal(entering.ok, false);
    if (!entering.ok) assert.strictEqual(entering.state, enteringState);
  });

  it('blocks Cowardice from crossing or entering the marked square', () => {
    const target = [{ from: 'd4', to: 'd6' }];
    const baseline = createGameState({
      fen: '7k/8/8/8/3p4/8/4P3/K7 w - - 0 1',
      hands: { white: ['cowardice'] },
    });
    const baselineMoved = applyAction(baseline, { type: 'move', from: 'e2', to: 'e3' });
    assert(baselineMoved.ok);
    assert.equal(applyAction(baselineMoved.state, { type: 'playCard', cardId: 'cowardice', target }).ok, true);

    for (const marker of ['d5', 'd6'] as const) {
      const setup = createGameState({
        fen: '7k/8/8/8/3p4/8/4P3/K7 b - - 0 1',
        phase: 'afterMove', moveMade: true,
        hands: { black: ['forbidden-city'], white: ['cowardice'] },
      });
      const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: marker });
      assert(marked.ok);
      const ended = applyAction(marked.state, { type: 'endTurn' });
      assert(ended.ok);
      const moved = applyAction(ended.state, { type: 'move', from: 'e2', to: 'e3' });
      assert(moved.ok);
      const before = moved.state;
      const rejected = applyAction(before, { type: 'playCard', cardId: 'cowardice', target });
      assert.equal(rejected.ok, false);
      if (!rejected.ok) assert.strictEqual(rejected.state, before);
    }
  });

  it('blocks Heresy from entering the marked square', () => {
    const target = [{ from: 'd4', to: 'e4' }];
    const baseline = createGameState({
      fen: '8/7k/8/8/3B4/8/8/K7 w - - 0 1',
      phase: 'afterMove', moveMade: true,
      hands: { white: ['heresy'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'heresy', target }).ok, true);

    const setup = createGameState({
      fen: '8/7k/8/8/3B4/8/8/K7 b - - 0 1',
      phase: 'afterMove', moveMade: true,
      hands: { black: ['forbidden-city'], white: ['heresy'] },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: 'e4' });
    assert(marked.ok);
    const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
    assert(whiteTurn.ok);
    const moved = applyAction(whiteTurn.state, { type: 'move', from: 'a1', to: 'a2' });
    assert(moved.ok);

    const before = moved.state;
    const result = applyAction(before, { type: 'playCard', cardId: 'heresy', target });
    assert.equal(result.ok, false);
    if (!result.ok) assert.strictEqual(result.state, before);
  });

  it('blocks an otherwise legal sliding move that crosses the chosen empty square', () => {
    const baseline = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 0 1' });
    assert(legalDests(baseline).get('a1')?.includes('a4'));

    const afterMove = createGameState({
      fen: '7k/8/8/8/8/8/8/R6K b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { black: ['forbidden-city'] },
    });
    const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: 'a3' });
    assert(played.ok);
    const nextTurn = applyAction(played.state, { type: 'endTurn' });
    assert(nextTurn.ok);

    assert(!legalDests(nextTurn.state).get('a1')?.includes('a4'));
  });
});

describe('Forbidden City movement interactions', () => {
  const whiteTurnWithCity = (target: 'e3' | 'f2') => {
    const setup = createGameState({
      fen: '7k/8/8/8/8/8/4P3/7K b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: {
        white: ['fanatic', 'annexation', 'forced-march', 'onslaught'],
        black: ['forbidden-city'],
      },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target });
    assert(marked.ok);
    const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
    assert(whiteTurn.ok);
    return whiteTurn.state;
  };

  it('blocks a bishop from crossing the marked square', () => {
    const before = createGameState({
      fen: '8/7k/8/8/8/8/8/B6K w - - 0 1',
    });
    assert.ok(legalDests(before).get('a1')?.includes('g7'));

    const afterMove = createGameState({
      fen: '8/7k/8/8/8/8/8/B6K b - - 0 1',
      hands: { black: ['forbidden-city'] },
      phase: 'afterMove',
      moveMade: true,
    });
    const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: 'd4' });
    assert(played.ok);
    const ended = applyAction(played.state, { type: 'endTurn' });
    assert(ended.ok);

    assert.ok(!legalDests(ended.state).get('a1')?.includes('g7'));
  });

  it('blocks castling when the king would cross the marked square', () => {
    const baseline = createGameState({ fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' });
    assert.ok(legalDests(baseline).get('e1')?.includes('g1'));

    const afterMove = createGameState({
      fen: '4k3/8/8/8/8/8/8/4K2R b K - 0 1',
      hands: { black: ['forbidden-city'] },
      phase: 'afterMove',
      moveMade: true,
    });
    const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: 'f1' });
    assert(played.ok);
    const ended = applyAction(played.state, { type: 'endTurn' });
    assert(ended.ok);

    assert.ok(!legalDests(ended.state).get('e1')?.includes('g1'));
  });

  it('keeps the marked square blocked after both players complete later turns', () => {
    const afterMove = createGameState({
      fen: '7k/7p/8/8/8/8/1P6/R6K b - - 0 1',
      hands: { black: ['forbidden-city'] },
      phase: 'afterMove',
      moveMade: true,
    });
    const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: 'a3' });
    assert(played.ok);
    const whiteTurn = applyAction(played.state, { type: 'endTurn' });
    assert(whiteTurn.ok);
    const whiteMove = applyAction(whiteTurn.state, { type: 'move', from: 'b2', to: 'b3' });
    assert(whiteMove.ok);
    const blackTurn = applyAction(whiteMove.state, { type: 'endTurn' });
    assert(blackTurn.ok);
    const blackMove = applyAction(blackTurn.state, { type: 'move', from: 'h7', to: 'h6' });
    assert(blackMove.ok);
    const nextWhiteTurn = applyAction(blackMove.state, { type: 'endTurn' });
    assert(nextWhiteTurn.ok);

    assert.ok(!legalDests(nextWhiteTurn.state).get('a1')?.includes('a4'));
  });

  it('blocks a rook from landing on the marked empty square', () => {
    const baseline = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 0 1' });
    assert.ok(legalDests(baseline).get('a1')?.includes('a3'));

    const afterMove = createGameState({
      fen: '7k/8/8/8/8/8/8/R6K b - - 0 1',
      hands: { black: ['forbidden-city'] },
      phase: 'afterMove',
      moveMade: true,
    });
    const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: 'a3' });
    assert(played.ok);
    const ended = applyAction(played.state, { type: 'endTurn' });
    assert(ended.ok);

    assert.ok(!legalDests(ended.state).get('a1')?.includes('a3'));
  });

  it('blocks a queen from crossing the marker along a rank or diagonal', () => {
    for (const { destination, marker } of [
      { destination: 'g1', marker: 'd1' },
      { destination: 'g7', marker: 'd4' },
    ] as const) {
      const baseline = createGameState({ fen: '8/7k/8/8/8/8/8/Q6K w - - 0 1' });
      assert.ok(legalDests(baseline).get('a1')?.includes(destination));

      const afterMove = createGameState({
        fen: '8/7k/8/8/8/8/8/Q6K b - - 0 1',
        hands: { black: ['forbidden-city'] },
        phase: 'afterMove',
        moveMade: true,
      });
      const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: marker });
      assert(played.ok);
      const ended = applyAction(played.state, { type: 'endTurn' });
      assert(ended.ok);

      assert.ok(!legalDests(ended.state).get('a1')?.includes(destination));
    }
  });

  it('lets a knight jump across the marker but not land on it', () => {
    const baseline = createGameState({ fen: '7k/8/8/8/8/8/8/1N5K w - - 0 1' });
    assert.ok(legalDests(baseline).get('b1')?.includes('c3'));

    for (const { marker, expected } of [
      { marker: 'b2', expected: true },
      { marker: 'c3', expected: false },
    ] as const) {
      const afterMove = createGameState({
        fen: '7k/8/8/8/8/8/8/1N5K b - - 0 1',
        hands: { black: ['forbidden-city'] },
        phase: 'afterMove',
        moveMade: true,
      });
      const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: marker });
      assert(played.ok);
      const ended = applyAction(played.state, { type: 'endTurn' });
      assert(ended.ok);

      assert.equal(legalDests(ended.state).get('b1')?.includes('c3'), expected);
    }
  });

  it('blocks kings and pawns from entering the marked square', () => {
    for (const { fen, from, marker } of [
      { fen: '7k/8/8/8/8/8/8/K7 w - - 0 1', from: 'a1', marker: 'a2' },
      { fen: '7k/8/8/8/8/8/P7/7K w - - 0 1', from: 'a2', marker: 'a3' },
    ] as const) {
      const baseline = createGameState({ fen });
      assert.ok(legalDests(baseline).get(from)?.includes(marker));

      const afterMove = createGameState({
        fen: fen.replace(' w ', ' b '),
        hands: { black: ['forbidden-city'] },
        phase: 'afterMove',
        moveMade: true,
      });
      const played = applyAction(afterMove, { type: 'playCard', cardId: 'forbidden-city', target: marker });
      assert(played.ok);
      const ended = applyAction(played.state, { type: 'endTurn' });
      assert(ended.ok);

      assert.ok(!legalDests(ended.state).get(from)?.includes(marker));
    }
  });

  it('lets Long Jump cross the city but not land on it', () => {
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/8/1N5K w - - 0 1',
      hands: { white: ['long-jump'] },
    });
    const baselineJump = applyAction(baseline, {
      type: 'playCard',
      cardId: 'long-jump',
      target: [{ from: 'b1', to: 'e3' }],
    });
    assert(baselineJump.ok);

    const withCity = (target: 'c2' | 'e3') => {
      const state = createGameState({
        fen: '7k/8/8/8/8/8/8/1N5K b - - 0 1',
        phase: 'afterMove',
        moveMade: true,
        hands: { white: ['long-jump'], black: ['forbidden-city'] },
      });
      const marked = applyAction(state, {
        type: 'playCard',
        cardId: 'forbidden-city',
        target,
      });
      assert(marked.ok);
      const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
      assert(whiteTurn.ok);
      return whiteTurn.state;
    };

    const crossed = applyAction(withCity('c2'), {
      type: 'playCard',
      cardId: 'long-jump',
      target: [{ from: 'b1', to: 'e3' }],
    });
    assert(crossed.ok);

    const landingState = withCity('e3');
    const landing = applyAction(landingState, {
      type: 'playCard',
      cardId: 'long-jump',
      target: [{ from: 'b1', to: 'e3' }],
    });
    assert.equal(landing.ok, false);
    if (!landing.ok) assert.strictEqual(landing.state, landingState);
  });

  it('blocks Crab from moving onto the marked square while preserving an otherwise legal Crab move', () => {
    const reachWhiteTurn = (withForbiddenCity: boolean) => {
      const initial = createGameState({
        fen: '7k/7p/8/8/8/8/P7/7K w - - 0 1',
        phase: 'afterMove',
        moveMade: true,
        hands: {
          white: ['crab'],
          black: withForbiddenCity ? ['forbidden-city'] : [],
        },
      });
      const crabbed = applyAction(initial, { type: 'playCard', cardId: 'crab', target: 'a2' });
      assert(crabbed.ok);
      const blackTurn = applyAction(crabbed.state, { type: 'endTurn' });
      assert(blackTurn.ok);
      const blackMove = applyAction(blackTurn.state, { type: 'move', from: 'h7', to: 'h6' });
      assert(blackMove.ok);
      if (!withForbiddenCity) {
        const whiteTurn = applyAction(blackMove.state, { type: 'endTurn' });
        assert(whiteTurn.ok);
        return whiteTurn.state;
      }
      const marked = applyAction(blackMove.state, {
        type: 'playCard',
        cardId: 'forbidden-city',
        target: 'b3',
      });
      assert(marked.ok);
      const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
      assert(whiteTurn.ok);
      return whiteTurn.state;
    };

    const unmarked = reachWhiteTurn(false);
    const allowed = applyAction(unmarked, { type: 'move', from: 'a2', to: 'b3' });
    assert(allowed.ok);

    const marked = reachWhiteTurn(true);
    const blocked = applyAction(marked, { type: 'move', from: 'a2', to: 'b3' });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.strictEqual(blocked.state, marked);
  });

  it('rejects Guardian when its pawn would cross and follower would enter Forbidden City', () => {
    const guardianTarget = [
      { from: 'e2', to: 'e4' },
      { from: 'e1', to: 'e3' },
    ];
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/4P3/4R2K w - - 0 1',
      hands: { white: ['guardian'] },
    });
    const allowed = applyAction(baseline, {
      type: 'playCard',
      cardId: 'guardian',
      target: guardianTarget,
    });
    assert.equal(allowed.ok, true);

    const blackAfterMove = createGameState({
      fen: '7k/8/8/8/8/8/4P3/4R2K b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { white: ['guardian'], black: ['forbidden-city'] },
    });
    const marked = applyAction(blackAfterMove, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'e3',
    });
    assert(marked.ok);
    const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
    assert(whiteTurn.ok);

    const blockedState = whiteTurn.state;
    const blocked = applyAction(blockedState, {
      type: 'playCard',
      cardId: 'guardian',
      target: guardianTarget,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.strictEqual(blocked.state, blockedState);
  });

  it('blocks rook check through the city when a king enters the square beyond it', () => {
    const baseline = createGameState({ fen: '1k6/8/8/8/8/8/8/R6K b - - 0 1' });
    assert.equal(legalDests(baseline).get('b8')?.includes('a8'), false);
    const exposed = applyAction(baseline, { type: 'move', from: 'b8', to: 'a8' });
    assert.equal(exposed.ok, false);
    if (!exposed.ok) assert.strictEqual(exposed.state, baseline);

    const afterMove = createGameState({
      fen: '1k6/8/8/8/8/8/8/R6K b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { black: ['forbidden-city'] },
    });
    const played = applyAction(afterMove, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'a4',
    });
    assert(played.ok);
    const whiteTurn = applyAction(played.state, { type: 'endTurn' });
    assert(whiteTurn.ok);
    const whiteMove = applyAction(whiteTurn.state, { type: 'move', from: 'h1', to: 'h2' });
    assert(whiteMove.ok);
    const blackTurn = applyAction(whiteMove.state, { type: 'endTurn' });
    assert(blackTurn.ok);

    assert.equal(legalDests(blackTurn.state).get('b8')?.includes('a8'), true);
    const sheltered = applyAction(blackTurn.state, { type: 'move', from: 'b8', to: 'a8' });
    assert(sheltered.ok);
    assert.equal(isKingInCheck(sheltered.state, 'black'), false);
  });

  it('blocks queenside castling when the marker obstructs the rook path', () => {
    const baseline = createGameState({ fen: '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1' });
    assert.ok(legalDests(baseline).get('e1')?.includes('c1'));
    const baselineCastle = applyAction(baseline, { type: 'move', from: 'e1', to: 'c1' });
    assert.equal(baselineCastle.ok, true);

    const setup = createGameState({
      fen: '4k3/8/8/8/8/8/8/R3K3 b Q - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { white: [], black: ['forbidden-city'] },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: 'b1' });
    assert(marked.ok);
    const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
    assert(whiteTurn.ok);

    assert.ok(!legalDests(whiteTurn.state).get('e1')?.includes('c1'));
    const blocked = applyAction(whiteTurn.state, { type: 'move', from: 'e1', to: 'c1' });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.strictEqual(blocked.state, whiteTurn.state);
  });

  it('blocks an otherwise legal en-passant capture through its marked destination', () => {
    const fen = '7k/3p4/8/4P3/8/8/8/7K b - - 0 1';

    const baselineMove = applyAction(createGameState({ fen }), {
      type: 'move',
      from: 'd7',
      to: 'd5',
    });
    assert(baselineMove.ok);
    const baselineTurn = applyAction(baselineMove.state, { type: 'endTurn' });
    assert(baselineTurn.ok);
    assert.ok(legalDests(baselineTurn.state).get('e5')?.includes('d6'));
    assert.equal(
      applyAction(baselineTurn.state, { type: 'move', from: 'e5', to: 'd6' }).ok,
      true,
    );

    const markedStart = createGameState({
      fen,
      hands: { black: ['forbidden-city'] },
    });
    const markedMove = applyAction(markedStart, {
      type: 'move',
      from: 'd7',
      to: 'd5',
    });
    assert(markedMove.ok);
    const markedCard = applyAction(markedMove.state, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'd6',
    });
    assert(markedCard.ok);
    const markedTurn = applyAction(markedCard.state, { type: 'endTurn' });
    assert(markedTurn.ok);
    assert.ok(!legalDests(markedTurn.state).get('e5')?.includes('d6'));
    const rejected = applyAction(markedTurn.state, {
      type: 'move',
      from: 'e5',
      to: 'd6',
    });
    assert.equal(rejected.ok, false);
    assert(!rejected.ok);
    assert.strictEqual(rejected.state, markedTurn.state);
  });

  it('blocks a pawn double-step that would pass through the forbidden city', () => {
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
    });
    assert.ok(legalDests(baseline).get('e2')?.includes('e4'));
    const baselineMoved = applyAction(baseline, { type: 'move', from: 'e2', to: 'e4' });
    assert.ok(baselineMoved.ok);

    const beforeCity = createGameState({
      fen: '7k/8/8/8/8/8/4P3/7K b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { white: [], black: ['forbidden-city'] },
    });
    const marked = applyAction(beforeCity, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'e3',
    });
    assert.ok(marked.ok);
    const whiteTurn = applyAction(marked.state, { type: 'endTurn' });
    assert.ok(whiteTurn.ok);
    assert.ok(!legalDests(whiteTurn.state).get('e2')?.includes('e4'));

    const rejected = applyAction(whiteTurn.state, { type: 'move', from: 'e2', to: 'e4' });
    assert.equal(rejected.ok, false);
    assert.ok(!rejected.ok);
    assert.strictEqual(rejected.state, whiteTurn.state);
  });

  it('rejects Fanatic atomically when its pawn would cross Forbidden City', () => {
    const target = 'e2';
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
      hands: { white: ['fanatic'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'fanatic', target }).ok, true);

    const marked = whiteTurnWithCity('e3');
    const rejected = applyAction(marked, {
      type: 'playCard',
      cardId: 'fanatic',
      target,
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.strictEqual(rejected.state, marked);
  });

  it('rejects Annexation atomically when its pawn would cross Forbidden City', () => {
    const target = [{ from: 'e2', to: 'e4' }];
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
      hands: { white: ['annexation'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'annexation', target }).ok, true);

    const marked = whiteTurnWithCity('e3');
    const rejected = applyAction(marked, {
      type: 'playCard',
      cardId: 'annexation',
      target,
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.strictEqual(rejected.state, marked);
  });

  it('rejects Forced March atomically when its pawn would enter Forbidden City', () => {
    const target = [{ from: 'e2', to: 'f2' }];
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
      hands: { white: ['forced-march'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'forced-march', target }).ok, true);

    const marked = whiteTurnWithCity('f2');
    const rejected = applyAction(marked, {
      type: 'playCard',
      cardId: 'forced-march',
      target,
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.strictEqual(rejected.state, marked);
  });

  it('rejects Onslaught atomically when its pawn would enter Forbidden City', () => {
    const target = [{ from: 'e2', to: 'e3' }];
    const baseline = createGameState({
      fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
      hands: { white: ['onslaught'] },
    });
    assert.equal(applyAction(baseline, { type: 'playCard', cardId: 'onslaught', target }).ok, true);

    const marked = whiteTurnWithCity('e3');
    const rejected = applyAction(marked, {
      type: 'playCard',
      cardId: 'onslaught',
      target,
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.strictEqual(rejected.state, marked);
  });

  it('applies Forbidden City to movement copied by Doppelganger', () => {
    const ready = (fen: string, from: 'a8' | 'b8', to: 'a7' | 'c6', marker?: 'a3' | 'b2' | 'b3') => {
      let state = createGameState({
        fen: marker ? fen.replace(' b ', ' w ') : fen,
        ...(marker && { phase: 'afterMove' as const, moveMade: true }),
        hands: { white: ['doppelganger', 'forbidden-city'] },
      });
      if (marker) {
        const marked = applyAction(state, { type: 'playCard', cardId: 'forbidden-city', target: marker });
        assert(marked.ok);
        const blackTurn = applyAction(marked.state, { type: 'endTurn' });
        assert(blackTurn.ok); state = blackTurn.state;
      }
      const moved = applyAction(state, { type: 'move', from, to });
      assert(moved.ok);
      const whiteTurn = applyAction(moved.state, { type: 'endTurn' });
      assert(whiteTurn.ok); return whiteTurn.state;
    };
    const play = (state: ReturnType<typeof ready>, to: 'a4' | 'b3') =>
      applyAction(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to }] });

    assert.equal(play(ready('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'a8', 'a7'), 'a4').ok, true);
    const crossed = ready('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'a8', 'a7', 'a3');
    const crossing = play(crossed, 'a4');
    assert.equal(crossing.ok, false); if (!crossing.ok) assert.strictEqual(crossing.state, crossed);
    assert.equal(play(ready('1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'b8', 'c6', 'b2'), 'b3').ok, true);
    const landed = ready('1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'b8', 'c6', 'b3');
    const landing = play(landed, 'b3');
    assert.equal(landing.ok, false); if (!landing.ok) assert.strictEqual(landing.state, landed);
  });

  it('rejects Figure Dance atomically when its corner move crosses Forbidden City', () => {
    const baseline = createGameState({
      fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', phase: 'afterMove', moveMade: true,
      hands: { white: ['figure-dance'] },
    });
    const danced = applyAction(baseline, { type: 'playCard', cardId: 'figure-dance', target: [] });
    assert.equal(danced.ok, true);
    if (danced.ok)
      assert.equal(danced.state.pieces.find(({ id }) => id === 'white-rook-a1')?.square, 'h1');

    const setup = createGameState({
      fen: '4k3/8/8/8/8/8/8/R3K3 b - - 0 1', phase: 'afterMove', moveMade: true,
      hands: { black: ['forbidden-city'], white: ['figure-dance'] },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: 'd1' });
    assert(marked.ok);
    const ended = applyAction(marked.state, { type: 'endTurn' });
    assert(ended.ok);
    const moved = applyAction(ended.state, { type: 'move', from: 'e1', to: 'e2' });
    assert(moved.ok);
    const before = moved.state;
    const rejected = applyAction(before, { type: 'playCard', cardId: 'figure-dance', target: [] });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.strictEqual(rejected.state, before);
  });

  it('keeps Forbidden City on board-attached coordinates through Earthquake', () => {
    const earthquake = { type: 'playCard' as const, cardId: 'earthquake', target: { direction: 'counterclockwise', promotions: [] } };
    const shake = (state: ReturnType<typeof createGameState>) => {
      const pawnMoved = applyAction(state, { type: 'move', from: 'h7', to: 'h6' });
      assert(pawnMoved.ok);
      const played = applyAction(pawnMoved.state, earthquake);
      assert(played.ok);
      const ended = applyAction(played.state, { type: 'endTurn' });
      assert(ended.ok);
      return ended.state;
    };

    const control = shake(createGameState({
      fen: '7k/7p/8/8/8/8/8/R6K b - - 0 1',
      hands: { black: ['earthquake'] },
    }));
    assert(legalDests(control).get('a1')?.includes('a4'));
    assert.equal(applyAction(control, { type: 'move', from: 'a1', to: 'a4' }).ok, true);

    const setup = createGameState({
      fen: '7k/7p/8/8/8/8/8/R6K w - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { white: ['forbidden-city'], black: ['earthquake'] },
    });
    const marked = applyAction(setup, { type: 'playCard', cardId: 'forbidden-city', target: 'a3' });
    assert(marked.ok);
    const blackTurn = applyAction(marked.state, { type: 'endTurn' });
    assert(blackTurn.ok);
    const afterEarthquake = shake(blackTurn.state);

    assert.deepEqual(afterEarthquake.effects[0], {
      type: 'forbidden-city', owner: 'white',
      card: { id: 'white-hand-0-forbidden-city', cardId: 'forbidden-city' },
      square: 'a3',
    });
    assert(!legalDests(afterEarthquake).get('a1')?.includes('a4'));
    const rejected = applyAction(afterEarthquake, { type: 'move', from: 'a1', to: 'a4' });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.strictEqual(rejected.state, afterEarthquake);
  });
});
