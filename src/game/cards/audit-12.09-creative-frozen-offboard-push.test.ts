import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction } from '../reducer';
import type { Color, GameAction, GameState, SquareName } from '../types';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions preserve their input');
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function pushWindow(owner: Color, magnetFile: 'a' | 'c', frozen: boolean, royal = true) {
  const opponent: Color = owner === 'white' ? 'black' : 'white';
  const backRank = magnetFile === 'a' ? 'nn5k' : '1nn4k';
  const from: SquareName = owner === 'white' ? 'b7' : 'b2';
  const to: SquareName = owner === 'white' ? 'b8' : 'b1';
  const magnet = `${magnetFile}${owner === 'white' ? '8' : '1'}` as SquareName;
  let state = createGameState({
    fen: owner === 'white'
      ? `${backRank}/1P6/8/8/8/8/8/7K w - - 0 1`
      : `7k/8/8/8/8/8/1p6/${backRank.toUpperCase()} b - - 0 1`,
    hands: { [owner]: ['coup', 'irresistible-force'], [opponent]: ['fatal-attraction'] },
  });
  state = act(state, { type: 'move', from: owner === 'white' ? 'h1' : 'h8', to: owner === 'white' ? 'g1' : 'g8' });
  if (royal) state = act(state, { type: 'playCard', cardId: 'coup', target: from });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: opponent === 'white' ? 'h1' : 'h8', to: opponent === 'white' ? 'g1' : 'g8' });
  if (frozen) state = act(state, { type: 'playCard', cardId: 'fatal-attraction', target: magnet });
  state = act(state, { type: 'endTurn' });
  return { state, owner, opponent, from, to, magnet,
    pawnId: `${owner}-pawn-${from}`, victimId: `${opponent}-knight-${to}`,
    push: { type: 'playCard', cardId: 'irresistible-force', target: [{ from, to }] } satisfies GameAction };
}

// An offboard capture still moves the pushed piece: a royal initiator's exemption
// from Fatal Attraction must not exempt a frozen nonroyal piece in its chain.
for (const owner of ['white', 'black'] as const) {
  for (const magnetFile of ['a', 'c'] as const) {
    test(`${owner}: royal Pawn cannot push a frozen Knight offboard beside ${magnetFile}`, () => {
      const { state, push, pawnId, victimId, from, to } = pushWindow(owner, magnetFile, true);
      const before = structuredClone(state);
      const result = applyAction(state, push);
      assert.deepEqual(state, before, 'rejected push preserves its input');
      assert.equal(result.ok, false, 'offboard capture cannot bypass the pushed Knight’s freeze');
      assert.deepEqual(result.state, before, 'rejected push is atomic and retains cards');
      assert.equal(result.state.pieces.find(piece => piece.id === pawnId)?.square, from);
      assert.equal(result.state.pieces.find(piece => piece.id === victimId)?.square, to);
    });

    test(`${owner}: royal Pawn pushes an unfrozen Knight offboard beside ${magnetFile}`, () => {
      const { state, push, pawnId, victimId, to } = pushWindow(owner, magnetFile, false);
      const next = act(state, push);
      const victim = next.pieces.find(piece => piece.id === victimId);
      const pawn = next.pieces.find(piece => piece.id === pawnId);
      assert.equal(victim?.zone, 'captured');
      assert.equal(victim?.square, null);
      assert.equal(pawn?.square, to);
      assert.equal(pawn?.royal, true);
    });
  }

  test(`${owner}: a frozen nonroyal Pawn cannot initiate an offboard push`, () => {
    const { state, push, pawnId, from } = pushWindow(owner, 'c', true, false);
    const before = structuredClone(state);
    const result = applyAction(state, push);
    assert.deepEqual(state, before, 'rejected push preserves its input');
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before, 'rejected push is atomic and retains cards');
    assert.equal(result.state.pieces.find(piece => piece.id === pawnId)?.square, from);
  });
}

function returnedPawnWindow(owner: Color, expired: boolean) {
  const opponent: Color = owner === 'white' ? 'black' : 'white';
  const royalFrom: SquareName = owner === 'white' ? 'c2' : 'c7';
  const from: SquareName = owner === 'white' ? 'b7' : 'b2';
  const to: SquareName = owner === 'white' ? 'b8' : 'b1';
  const ownHome: SquareName = owner === 'white' ? 'h1' : 'h8';
  const ownWait: SquareName = owner === 'white' ? 'g1' : 'g8';
  const enemyHome: SquareName = owner === 'white' ? 'h8' : 'h1';
  const enemyWait: SquareName = owner === 'white' ? 'g8' : 'g1';
  let state = createGameState({
    fen: owner === 'white' ? '7k/1P6/8/8/8/8/2P5/7K w - - 0 1' : '7k/2p5/8/8/8/8/1p6/7K b - - 0 1',
    hands: { [owner]: ['coup', 'under-elf-hill', 'irresistible-force'], [opponent]: ['peace-talks'] },
  });
  state = act(state, { type: 'move', from: ownHome, to: ownWait });
  state = act(state, { type: 'playCard', cardId: 'coup', target: royalFrom });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: enemyHome, to: enemyWait });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'under-elf-hill' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: enemyWait, to: enemyHome });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: `${owner}-hand-0-coup` });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'returnKing', to });
  if (expired) {
    state = act(state, { type: 'move', from: ownWait, to: ownHome });
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: enemyHome, to: enemyWait });
    state = act(state, { type: 'endTurn' });
  }
  return { state, to, returnedId: `${owner}-pawn-${royalFrom}`, pawnId: `${owner}-pawn-${from}`,
    push: { type: 'playCard', cardId: 'irresistible-force', target: [{ from, to }] } satisfies GameAction };
}

// UNDER_ELF_HILL_REGRESSIONS
// Returning through Under Elf Hill forbids movement for this owner turn even
// after Peace Talks removes Coup: pushing that physical piece offboard moves it.
for (const owner of ['white', 'black'] as const) {
  test(`${owner}: a newly returned Pawn cannot be pushed offboard after losing royal status`, () => {
    const f = returnedPawnWindow(owner, false);
    const returned = f.state.pieces.find(piece => piece.id === f.returnedId);
    assert.equal(returned?.zone, 'board');
    assert.equal(returned?.square, f.to);
    assert.equal(returned?.royal, false);
    const before = structuredClone(f.state);
    const result = applyAction(f.state, f.push);
    assert.deepEqual(f.state, before, 'rejected push preserves its input');
    assert.equal(result.ok, false, 'offboard capture cannot bypass the returned piece’s movement ban');
    assert.deepEqual(result.state, before, 'rejected push is atomic and retains cards');
  });

  test(`${owner}: a returned Pawn can be pushed offboard after its return-turn ban expires`, () => {
    const f = returnedPawnWindow(owner, true);
    const next = act(f.state, f.push);
    const returned = next.pieces.find(piece => piece.id === f.returnedId);
    const pawn = next.pieces.find(piece => piece.id === f.pawnId);
    assert.equal(returned?.zone, 'captured');
    assert.equal(returned?.square, null);
    assert.equal(pawn?.zone, 'board');
    assert.equal(pawn?.square, f.to);
  });
}
