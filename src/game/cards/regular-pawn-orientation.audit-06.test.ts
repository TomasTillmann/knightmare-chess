import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

function oriented(fen: string, orientation: 90 | 180 | 270): State {
  return { ...createGameState({ fen }), orientation };
}

function move(state: State, from: string, to: string, promotion?: string): State {
  const result = applyAction(state, {
    type: 'move',
    from,
    to,
    ...(promotion ? { promotion } : {}),
  } as Action);
  if (!result.ok) assert.fail(`${from}-${to}: ${result.error.code}: ${result.error.message}`);
  return result.state;
}

function endTurn(state: State): State {
  const result = applyAction(state, { type: 'endTurn' });
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

test('ordinary Pawn direction rotates for both colors', () => {
  const cases = [
    { orientation: 90, fen: '7k/8/8/8/1P6/8/8/K7 w - - 0 1', from: 'b4', to: 'c4', stale: 'b5' },
    { orientation: 90, fen: '7k/8/8/8/6p1/8/8/K7 b - - 0 1', from: 'g4', to: 'f4', stale: 'g3' },
    { orientation: 180, fen: '7k/8/8/3P4/8/8/8/K7 w - - 0 1', from: 'd5', to: 'd4', stale: 'd6' },
    { orientation: 180, fen: '7k/8/8/8/3p4/8/8/K7 b - - 0 1', from: 'd4', to: 'd5', stale: 'd3' },
    { orientation: 270, fen: '7k/8/8/8/6P1/8/8/K7 w - - 0 1', from: 'g4', to: 'f4', stale: 'g5' },
    { orientation: 270, fen: '7k/8/8/8/1p6/8/8/K7 b - - 0 1', from: 'b4', to: 'c4', stale: 'b3' },
  ] as const;

  for (const fixture of cases) {
    const state = oriented(fixture.fen, fixture.orientation);
    const destinations = legalDests(state).get(fixture.from) ?? [];
    assert.equal(destinations.includes(fixture.to), true, JSON.stringify(fixture));
    assert.equal(destinations.includes(fixture.stale), false, JSON.stringify(fixture));
    assert.equal(applyAction(state, { type: 'move', from: fixture.from, to: fixture.to }).ok, true);
    assert.equal(applyAction(state, { type: 'move', from: fixture.from, to: fixture.stale }).ok, false);
  }
});

test('rotated starting-line double steps require both squares to be empty', () => {
  const blockedIntermediate = oriented('7k/8/8/8/1PN5/8/8/K7 w - - 0 1', 90);
  const blockedDestination = oriented('7k/8/8/8/1P1N4/8/8/K7 w - - 0 1', 90);

  assert.equal(legalDests(blockedIntermediate).get('b4')?.includes('c4') ?? false, false);
  assert.equal(legalDests(blockedIntermediate).get('b4')?.includes('d4') ?? false, false);
  assert.equal(applyAction(blockedIntermediate, { type: 'move', from: 'b4', to: 'c4' }).ok, false);
  assert.equal(applyAction(blockedIntermediate, { type: 'move', from: 'b4', to: 'd4' }).ok, false);

  assert.equal(legalDests(blockedDestination).get('b4')?.includes('c4'), true);
  assert.equal(legalDests(blockedDestination).get('b4')?.includes('d4') ?? false, false);
  assert.equal(applyAction(blockedDestination, { type: 'move', from: 'b4', to: 'c4' }).ok, true);
  assert.equal(applyAction(blockedDestination, { type: 'move', from: 'b4', to: 'd4' }).ok, false);
});

test('rotated Pawns capture one square diagonally forward', () => {
  const state = oriented('7k/8/8/8/1P6/2p5/8/K7 w - - 0 1', 90);
  assert.equal(legalDests(state).get('b4')?.includes('c3'), true);

  const after = move(state, 'b4', 'c3');
  assert.equal(after.pieces.find(piece => piece.square === 'c3')?.owner, 'white');
  assert.equal(after.pieces.some(piece => piece.zone === 'captured' && piece.owner === 'black'), true);
});

test('rotated ordinary Pawn attacks govern check and king legality', () => {
  const cases = [
    {
      name: 'rotated diagonal is attacked',
      checkedFen: '7K/8/8/8/1P6/2k5/8/8 b - - 0 1',
      moveFen: '7K/8/8/8/1P6/3k4/8/8 b - - 0 1',
      from: 'd3',
      to: 'c3',
      attacked: true,
    },
    {
      name: 'unrotated diagonal is not attacked',
      checkedFen: '7K/8/8/k7/1P6/8/8/8 b - - 0 1',
      moveFen: '7K/8/k7/8/1P6/8/8/8 b - - 0 1',
      from: 'a6',
      to: 'a5',
      attacked: false,
    },
  ] as const;

  for (const fixture of cases) {
    assert.equal(isKingInCheck(oriented(fixture.checkedFen, 90), 'black'), fixture.attacked, fixture.name);
    const state = oriented(fixture.moveFen, 90);
    assert.equal(legalDests(state).get(fixture.from)?.includes(fixture.to) ?? false, !fixture.attacked, fixture.name);
    assert.equal(applyAction(state, { type: 'move', from: fixture.from, to: fixture.to }).ok, !fixture.attacked, fixture.name);
  }
});

test('rotated last lines allow ordinary promotion', () => {
  const state = oriented('k7/8/8/8/6P1/8/8/K7 w - - 0 1', 90);
  assert.equal(legalDests(state).get('g4')?.includes('h4'), true);

  const after = move(state, 'g4', 'h4', 'queen');
  assert.deepEqual(
    (({ role, originalRole, promoted }) => ({ role, originalRole, promoted }))(
      after.pieces.find(piece => piece.square === 'h4')!,
    ),
    { role: 'queen', originalRole: 'pawn', promoted: true },
  );
});

test('rotated double steps create a rotated en-passant capture', () => {
  const state = oriented('7k/8/8/3p4/1P6/8/8/K7 w - - 0 1', 90);
  const advanced = move(state, 'b4', 'd4');
  const replyResult = applyAction(advanced, { type: 'endTurn' });
  if (!replyResult.ok) assert.fail(`${replyResult.error.code}: ${replyResult.error.message}`);
  const reply = replyResult.state;

  assert.equal(legalDests(reply).get('d5')?.includes('c4'), true);
  const captured = move(reply, 'd5', 'c4');
  assert.equal(captured.pieces.some(piece => piece.square === 'd4'), false);
  assert.equal(captured.pieces.find(piece => piece.square === 'c4')?.owner, 'black');
});

test('rotated ordinary double steps keep first- and second-rank en-passant rights authoritative', () => {
  const cases = [
    {
      name: 'White first rank',
      fen: '7k/8/8/8/8/8/3p4/KP6 w - - 0 1',
      from: 'b1',
      to: 'd1',
      target: 'c1',
      capturer: 'd2',
      capturerOwner: 'black',
    },
    {
      name: 'Black second rank',
      fen: '7k/8/8/8/8/8/6p1/K3P3 b - - 0 1',
      from: 'g2',
      to: 'e2',
      target: 'f2',
      capturer: 'e1',
      capturerOwner: 'white',
    },
  ] as const;

  for (const fixture of cases) {
    const before = oriented(fixture.fen, 90);
    const pawnId = before.pieces.find(piece => piece.square === fixture.from)!.id;
    const advanced = move(before, fixture.from, fixture.to);

    assert.deepEqual(advanced.enPassant, [{ target: fixture.target, pawnId }], fixture.name);
    assert.equal(advanced.fen.split(' ')[3], '-', fixture.name);

    const reply = endTurn(advanced);
    assert.equal(legalDests(reply).get(fixture.capturer)?.includes(fixture.target), true, fixture.name);
    const captured = move(reply, fixture.capturer, fixture.target);
    assert.equal(captured.pieces.find(piece => piece.square === fixture.to), undefined, fixture.name);
    assert.equal(
      captured.pieces.find(piece => piece.square === fixture.target)?.owner,
      fixture.capturerOwner,
      fixture.name,
    );
    assert.deepEqual(captured.enPassant, [], fixture.name);
  }
});
