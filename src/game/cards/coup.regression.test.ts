import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.equal(result.ok, true, JSON.stringify(action) + (result.ok ? '' : `: ${result.error.message}`));
  assert.ok(result.ok);
  return result.state;
}

test('Coup cancellation restores a surviving intermediate King after the original Prince is captured', () => {
  let state = createGameState({ fen: '4r2k/8/8/8/8/8/P7/1N2K3 w - - 0 1',
    hands: { white: ['coup', 'coup', 'peace-talks'], black: [] },
    decks: { white: ['crab', 'long-jump', 'dubbing'], black: [] } });
  for (const action of [
    { type: 'move', from: 'e1', to: 'd1' },
    { type: 'playCard', cardId: 'coup', target: 'a2' },
    { type: 'endTurn' },
    { type: 'move', from: 'e8', to: 'd8' },
    { type: 'endTurn' },
    { type: 'move', from: 'b1', to: 'c3' },
    { type: 'playCard', cardId: 'coup', target: 'c3' },
    { type: 'endTurn' },
    { type: 'move', from: 'd8', to: 'd1' },
    { type: 'endTurn' },
    { type: 'move', from: 'a2', to: 'a3' },
    { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-1-coup' },
  ] satisfies GameAction[]) state = act(state, action);
  assert.equal(state.pieces.find(piece => piece.square === 'a3')?.royal, true);
  state = act(state, { type: 'endTurn' });
  assert.equal(state.pieces.filter(piece => piece.owner === 'white' && piece.royal).length, 1);
});

for (const color of ['white', 'black'] as const) {
  const enemy = color === 'white' ? 'black' : 'white';
  const square = (at: SquareName): SquareName => color === 'white' ? at : `${at[0]}${9 - Number(at[1])}` as SquareName;
  const fen = (board: string, first = color) => `${color === 'white' ? board : board.split('/').reverse().join('/').replace(/[a-z]/gi, letter => letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase())} ${first[0]} - - 0 1`;
  const royalSquares = (state: GameState) => state.pieces.filter(piece => piece.owner === color && piece.zone === 'board' && piece.royal).map(piece => piece.square);
  const move = (from: SquareName, to: SquareName): GameAction => ({ type: 'move', from: square(from), to: square(to) });

  for (const copied of [false, true]) for (const captured of [false, true]) {
    test(`${color} cancelling later Coup restores retained ${copied ? 'Haunting Memories' : 'Coup'} with original Prince ${captured ? 'captured' : 'alive'}`, () => {
      const firstCard = copied ? 'haunting-memories' : 'coup';
      let state = createGameState({
        fen: fen(copied ? '4r2k/8/5n2/8/8/8/P7/1N2K3' : '4r2k/8/8/8/8/8/P7/1N2K3', copied ? enemy : color),
        hands: { [color]: [firstCard, 'coup', 'peace-talks'], [enemy]: copied ? ['coup'] : [] },
        decks: { [color]: ['crab', 'long-jump', 'dubbing'] },
      });
      if (copied) for (const action of [move('h8', 'h7'), { type: 'playCard', cardId: 'coup', target: square('f6') }, { type: 'endTurn' }] satisfies GameAction[]) state = act(state, action);
      for (const action of [
        move('e1', 'd1'), { type: 'playCard', cardId: firstCard, target: square('a2') }, { type: 'endTurn' },
        move('e8', 'd8'), { type: 'endTurn' }, move('b1', 'c3'),
        { type: 'playCard', cardId: 'coup', target: square('c3') }, { type: 'endTurn' },
        move('d8', captured ? 'd1' : 'd7'), { type: 'endTurn' }, move('a2', 'a3'),
      ] satisfies GameAction[]) state = act(state, action);
      const retainedId = `${color}-hand-0-${firstCard}`;
      const cancelledId = `${color}-hand-1-coup`;
      assert.ok(cardPlayTargets(state, 'peace-talks').includes(cancelledId));
      state = act(state, { type: 'playCard', cardId: 'peace-talks', target: cancelledId });
      assert.deepEqual(royalSquares(state), [square('a3')]);
      assert.equal(state.pieces.find(piece => piece.square === square('a3'))?.role, 'pawn');
      assert.ok(effectIds(state).includes(retainedId));
      assert.equal(effectIds(state).includes(cancelledId), false);
      assert.equal(state.players[color].discard.filter(card => card.id === cancelledId).length, 1);
      state = act(state, { type: 'endTurn' });
      assert.deepEqual(royalSquares(state), [square('a3')]);
      assert.equal(state.outcome, null);
    });
  }

  for (const [promotion, captured] of [['queen', true], ['rook', true], ['queen', false], ['bishop', true]] as const) {
    test(`${color} lone Coup ${promotion} promotion cannot cancel away its ${captured ? 'captured' : 'living'} Prince`, () => {
      let state = createGameState({ fen: fen('3r3k/P7/8/8/8/8/8/4K3'), hands: { [color]: ['coup', 'peace-talks'] } });
      for (const action of [move('e1', 'd1'), { type: 'playCard', cardId: 'coup', target: square('a7') }, { type: 'endTurn' },
        move('d8', captured ? 'd1' : 'c8'), { type: 'endTurn' }] satisfies GameAction[]) state = act(state, action);
      const before = structuredClone(state);
      const promoted = applyAction(state, { type: 'move', from: square('a7'), to: square('a8'), promotion });
      assert.deepEqual(state, before);
      if (!promoted.ok) {
        assert.ok(captured && promotion !== 'bishop');
        assert.deepEqual(promoted.state, state);
        return;
      }
      state = promoted.state;
      const effectId = `${color}-hand-0-coup`;
      assert.equal(cardPlayTargets(state, 'peace-talks').includes(effectId), !captured);
      const snapshot = structuredClone(state);
      const cancelled = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target: effectId });
      assert.deepEqual(state, snapshot);
      assert.equal(cancelled.ok, !captured);
      if (captured) {
        assert.deepEqual(cancelled.state, state);
        if (promotion !== 'bishop') {
          assert.ok(state.pendingRescue);
          assert.equal(applyAction(state, { type: 'endTurn' }).ok, false);
        } else assert.deepEqual(royalSquares(state), [square('a8')]);
      } else {
        state = act(cancelled.state, { type: 'endTurn' });
        assert.deepEqual(royalSquares(state), [square('d1')]);
      }
    });
  }

  for (const promotion of ['queen', 'rook'] as const) {
    test(`${color} saved ${promotion} promotion rescue cannot cancel the only suspended Coup`, () => {
      let state = createGameState({ fen: fen('3r3k/P7/8/8/8/8/8/4K3'), hands: { [color]: ['coup', 'peace-talks'] } });
      for (const action of [move('e1', 'd1'), { type: 'playCard', cardId: 'coup', target: square('a7') }, { type: 'endTurn' },
        move('d8', 'd1'), { type: 'endTurn' }] satisfies GameAction[]) state = act(state, action);
      // Exact persisted promotion state from the audited public sequence, before the illegal rescue is attempted.
      const before = structuredClone(state);
      const pawn = state.pieces.find(piece => piece.square === square('a7'))!;
      Object.assign(pawn, { square: square('a8'), role: promotion, promoted: true, royal: false });
      state.fen = fen(`${promotion === 'queen' ? 'Q' : 'R'}6k/8/8/8/8/8/8/3r4`, enemy)
        .replace(/ 1$/, ` ${Number(before.fen.split(' ')[5]) + Number(color === 'black')}`);
      state.turn.phase = 'afterMove';
      state.turn.moveMade = true;
      Object.assign(state.effects[0] as object, { suspended: true });
      state.history.push({ type: 'move', from: square('a7'), to: square('a8'), promotion });
      state.pendingRescue = { before, fen: before.fen, pieces: structuredClone(before.pieces), enPassant: [], historyLength: before.history.length, movedPieceIds: [pawn.id] };
      state.shieldMove = { player: color, pieceIds: [pawn.id], capturedOpponent: false };
      state.chaosCheckpoint = { before: structuredClone(before), movement: `${pawn.id}:${square('a7')}:${square('a8')}`, historyLength: state.history.length, card: undefined };
      const snapshot = structuredClone(state);
      const effectId = `${color}-hand-0-coup`;
      assert.deepEqual(royalSquares(state), []);
      assert.equal(cardPlayTargets(state, 'peace-talks').includes(effectId), false);
      const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target: effectId });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, snapshot);
      assert.deepEqual(state, snapshot);
      assert.equal(applyAction(state, { type: 'endTurn' }).ok, false);
    });
  }
}

for (const earthquake of [false, true]) for (const [promotion, captured] of [['queen', true], ['rook', true], ['queen', false], ['bishop', true]] as const) {
  test(`${earthquake ? 'Earthquake' : 'ordinary'} ${promotion} promotion restores the retained Coup with original Prince ${captured ? 'captured' : 'alive'}`, () => {
    let state = createGameState({ fen: '4rk2/7P/8/8/8/8/8/1N2K3 w - - 0 1', hands: { white: ['coup', 'coup'], black: earthquake ? ['earthquake'] : [] } });
    for (const action of [
      { type: 'move', from: 'e1', to: 'd1' }, { type: 'playCard', cardId: 'coup', target: 'b1' }, { type: 'endTurn' },
      { type: 'move', from: 'e8', to: 'd8' }, { type: 'endTurn' }, { type: 'move', from: 'b1', to: 'c3' },
      { type: 'playCard', cardId: 'coup', target: 'h7' }, { type: 'endTurn' },
      { type: 'move', from: 'd8', to: captured ? 'd1' : 'd7' },
    ] satisfies GameAction[]) state = act(state, action);
    const cards = effectIds(state);
    if (earthquake) state = act(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'counterclockwise', promotions: [{ square: 'h7', role: promotion }] } });
    else {
      state = act(state, { type: 'endTurn' });
      state = act(state, { type: 'move', from: 'h7', to: 'h8', promotion });
    }
    assert.deepEqual(royals(state), [promotion === 'bishop' ? earthquake ? 'h7' : 'h8' : 'c3']);
    assert.deepEqual(effectIds(state).slice(0, 2), cards);
    assert.equal(Boolean((state.effects[1] as { suspended?: boolean }).suspended), promotion !== 'bishop');
    assert.equal(state.pendingRescue, null);
    assert.equal(state.outcome, null);
  });
}

test('Coup suspends existing Neutrality while retaining its physical card', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/2N5/8/K7 w - - 0 1', hands: { white: ['coup'], black: ['neutrality'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'playCard', cardId: 'neutrality', target: 'c3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a1' });
  const neutrality = structuredClone(state.effects);
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'c3' });
  assert.equal(state.pieces.find(piece => piece.square === 'c3')?.royal, true);
  assert.equal(state.pieces.find(piece => piece.square === 'c3')?.neutral, false);
  assert.deepEqual(state.effects.slice(0, 1), neutrality);
  state = act(state, { type: 'endTurn' });
  assert.equal(applyAction(state, { type: 'move', from: 'c3', to: 'b5' }).ok, false);
});

for (const color of ['white', 'black'] as const) {
  const enemy = color === 'white' ? 'black' : 'white';
  const square = (white: SquareName): SquareName => color === 'white'
    ? white : `${white[0]}${9 - Number(white[1])}` as SquareName;
  const piece = (state: GameState, at: SquareName) => {
    const found = state.pieces.find(candidate => candidate.square === square(at));
    assert.ok(found);
    return found;
  };
  function ready(opposing = false, neutral = true): GameState {
    let state = createGameState({
      fen: color === 'white'
        ? opposing ? '7k/8/2n5/8/8/8/8/K7 w - - 0 1' : '7k/8/8/8/8/2N5/8/K7 w - - 0 1'
        : opposing ? 'k7/8/8/8/8/2N5/8/7K b - - 0 1' : 'k7/8/2n5/8/8/8/8/7K b - - 0 1',
      hands: { [color]: ['coup', 'neutrality', 'peace-talks'], [enemy]: ['neutrality', 'peace-talks', 'fog-of-war'] },
      decks: { [color]: ['curse', 'crab'], [enemy]: ['curse'] },
    });
    state = act(state, { type: 'move', from: square('a1'), to: square('a2') });
    if (opposing && neutral) state = act(state, { type: 'playCard', cardId: 'neutrality', target: square('c6') });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: square('h8'), to: square('h7') });
    if (!opposing && neutral) state = act(state, { type: 'playCard', cardId: 'neutrality', target: square('c3') });
    state = act(state, { type: 'endTurn' });
    return act(state, { type: 'move', from: square('a2'), to: square('a1') });
  }
  const coup = (state: GameState, opposing = false) => act(state, {
    type: 'playCard', cardId: 'coup', target: square(opposing ? 'c6' : 'c3'),
  });
  function reply(state: GameState): GameState {
    return act(act(state, { type: 'endTurn' }), { type: 'move', from: square('h7'), to: square('h8') });
  }

  test(`${color} Coup suspends Neutrality, preserves ownership and cards, and removes opponent control`, () => {
    const before = ready();
    const snapshot = structuredClone(before);
    const card = before.players[color].hand.find(candidate => candidate.cardId === 'coup')!;
    assert.ok(cardPlayTargets(before, 'coup').includes(square('c3')));
    let state = coup(before);
    assert.deepEqual(before, snapshot);
    assert.deepEqual(piece(state, 'c3'), { ...piece(before, 'c3'), royal: true, neutral: false });
    assert.deepEqual(state.effects, [...before.effects, {
      type: 'coup', owner: color, card, princeId: piece(before, 'a1').id,
      kingId: piece(before, 'c3').id, princeRole: 'king',
    }]);
    assert.deepEqual(state.players[color].discard, []);
    assert.deepEqual(state.players[color].hand, [...before.players[color].hand.filter(candidate => candidate.id !== card.id), before.players[color].deck[0]]);
    assert.deepEqual(state.players[color].deck, before.players[color].deck.slice(1));
    assert.deepEqual(state.players[enemy], before.players[enemy]);
    state = act(state, { type: 'endTurn' });
    assert.equal(legalDests(state).has(square('c3')), false);
    const rejected = applyAction(state, { type: 'move', from: square('c3'), to: square('b5') });
    assert.equal(rejected.ok, false);
    assert.deepEqual(rejected.state, state);
  });

  test(`${color} Neutrality resumes with the same marker after Peace Talks cancels Coup`, () => {
    const before = ready();
    const card = before.players[color].hand.find(candidate => candidate.cardId === 'coup')!;
    let state = reply(coup(before));
    assert.ok(cardPlayTargets(state, 'peace-talks').includes(card.id));
    const pending = state;
    const snapshot = structuredClone(state);
    state = act(state, { type: 'playCard', cardId: 'peace-talks', target: card.id });
    assert.deepEqual(pending, snapshot);
    assert.deepEqual(state.effects, before.effects);
    assert.deepEqual(piece(state, 'c3'), piece(before, 'c3'));
    assert.equal(piece(state, 'a1').royal, true);
    assert.deepEqual(state.players[color].discard, [card]);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: square('a1'), to: square('b2') });
    state = act(state, { type: 'endTurn' });
    assert.ok(legalDests(state).get(square('c3'))?.includes(square('b5')));
    state = act(state, { type: 'move', from: square('c3'), to: square('b5') });
    assert.equal(piece(state, 'b5').owner, color);
    assert.deepEqual(state.effects, before.effects);
  });

  test(`${color} Peace Talks can remove suspended Neutrality without reviving it after Coup ends`, () => {
    const before = ready();
    const card = before.players[color].hand.find(candidate => candidate.cardId === 'coup')!;
    const marker = before.effects[0] as { card: { id: string; cardId: string } };
    let state = reply(coup(before));
    state = act(state, { type: 'playCard', cardId: 'peace-talks', target: marker.card.id });
    assert.equal(piece(state, 'c3').neutral, false);
    assert.equal(piece(state, 'c3').royal, true);
    assert.equal(state.players[enemy].discard.filter(candidate => candidate.id === marker.card.id).length, 1);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: square('a1'), to: square('a2') });
    state = act(state, { type: 'playCard', cardId: 'peace-talks', target: card.id });
    assert.equal(piece(state, 'c3').neutral, false);
    assert.equal(piece(state, 'c3').royal, false);
    assert.deepEqual(state.effects, []);
  });

  test(`${color} may surrender with Coup on an opposing neutral piece`, () => {
    const before = ready(true);
    const snapshot = structuredClone(before);
    const card = before.players[color].hand.find(candidate => candidate.cardId === 'coup')!;
    assert.ok(cardPlayTargets(before, 'coup').includes(square('c6')));
    const state = coup(before, true);
    assert.deepEqual(before, snapshot);
    assert.deepEqual(piece(state, 'c6'), { ...piece(before, 'c6'), royal: true, neutral: false });
    assert.equal(piece(state, 'c6').owner, enemy);
    assert.equal(piece(state, 'a1').royal, false);
    assert.deepEqual(state.outcome, { winner: enemy, reason: 'surrender' });
    assert.deepEqual(state.effects, [...before.effects, {
      type: 'coup', owner: color, card, princeId: piece(before, 'a1').id,
      kingId: piece(before, 'c6').id, princeRole: 'king',
    }]);
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(legalDests(state).size, 0);
    assert.deepEqual(cardPlayTargets(state, 'coup'), []);
    const blocked = applyAction(state, { type: 'endTurn' });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.error.code, 'GAME_OVER');
  });

  test(`${color} surrendering Coup retains the normal Fog of War response`, () => {
    const before = ready(true);
    const coupCard = before.players[color].hand.find(candidate => candidate.cardId === 'coup')!;
    const state = coup(before, true);
    const snapshot = structuredClone(state);
    assert.deepEqual(cardPlayTargets(state, 'fog-of-war'), [undefined]);
    const cancelled = act(state, { type: 'playCard', cardId: 'fog-of-war' });
    assert.deepEqual(state, snapshot);
    assert.deepEqual(cancelled.pieces, before.pieces);
    assert.deepEqual(cancelled.effects, before.effects);
    assert.equal(cancelled.outcome, null);
    assert.deepEqual(cancelled.players[color].discard, [coupCard]);
  });

  test(`${color} nonneutral Coup targets still obey ownership`, () => {
    const own = ready(false, false);
    assert.ok(cardPlayTargets(own, 'coup').includes(square('c3')));
    assert.equal(coup(own).outcome, null);
    const opposing = ready(true, false);
    const snapshot = structuredClone(opposing);
    assert.equal(cardPlayTargets(opposing, 'coup').includes(square('c6')), false);
    const rejected = applyAction(opposing, { type: 'playCard', cardId: 'coup', target: square('c6') });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.equal(rejected.error.code, 'WRONG_OWNER');
    assert.deepEqual(opposing, snapshot);
    assert.deepEqual(rejected.state, opposing);
  });
}

function fixture() {
  return createGameState({
    fen: '7k/8/8/8/8/8/P7/1NB1K3 w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['coup', 'coup', 'peace-talks'], black: ['peace-talks'] },
  });
}

function twice() {
  let state = act(fixture(), { type: 'playCard', cardId: 'coup', target: 'b1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  return act(state, { type: 'playCard', cardId: 'coup', target: 'c1' });
}

function nextWhite(state: GameState) {
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h8' });
  return act(state, { type: 'endTurn' });
}

function effectIds(state: GameState) {
  return state.effects.map(effect => (effect as { card: { id: string } }).card.id);
}

function cancel(state: GameState, index: number) {
  const id = effectIds(state)[index];
  assert.ok(id);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h8' });
  return act(state, { type: 'playCard', cardId: 'peace-talks', target: id });
}

function royals(state: GameState) {
  return state.pieces.filter(piece => piece.owner === 'white' && piece.zone === 'board' && piece.royal).map(piece => piece.square);
}

for (const target of ['b1', 'c1'] as const) {
  test(`Coup independently marks the ${target} replacement`, () => {
    const state = createGameState({ fen: '7k/8/8/8/8/8/P7/1NB1K3 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['coup'] } });
    const result = applyAction(state, { type: 'playCard', cardId: 'coup', target });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.pieces.find(piece => piece.square === target)?.royal, true);
    assert.equal(result.state.pieces.find(piece => piece.square === 'e1')?.royal, false);
  });
}

test('two nonunique Coups coexist and the latest replacement is the sole King', () => {
  const state = twice();
  assert.equal(state.effects.length, 2);
  assert.deepEqual(royals(state), ['c1']);
});

test('a replacement Knight demoted by the next Coup moves one square as a Prince', () => {
  const state = nextWhite(twice());
  const moved = act(state, { type: 'move', from: 'b1', to: 'b2' });
  assert.equal(moved.pieces.find(piece => piece.square === 'b2')?.royal, false);
});

test('a replacement Knight demoted by the next Coup loses Knight movement', () => {
  const result = applyAction(nextWhite(twice()), { type: 'move', from: 'b1', to: 'c3' });
  assert.equal(result.ok, false);
});

test('the latest Bishop King retains its unobstructed diagonal move', () => {
  const moved = act(nextWhite(twice()), { type: 'move', from: 'c1', to: 'f4' });
  assert.deepEqual(royals(moved), ['f4']);
});

test('cancelling the earlier Coup preserves exactly the latest King', () => {
  const state = cancel(twice(), 0);
  assert.equal(state.effects.length, 1);
  assert.deepEqual(royals(state), ['c1']);
});

test('cancelling the later Coup restores exactly the earlier King', () => {
  const state = cancel(twice(), 1);
  assert.equal(state.effects.length, 1);
  assert.deepEqual(royals(state), ['b1']);
});

test('the restored earlier King regains its retained Knight movement', () => {
  let state = cancel(twice(), 1);
  state = act(state, { type: 'endTurn' });
  const moved = act(state, { type: 'move', from: 'b1', to: 'c3' });
  assert.deepEqual(royals(moved), ['c3']);
});

test('cancelling both Coups in reverse order restores the original King', () => {
  let state = cancel(twice(), 1);
  const remainingId = effectIds(state)[0];
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a3', to: 'a4' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: remainingId });
  assert.equal(state.effects.length, 0);
  assert.deepEqual(royals(state), ['e1']);
});
