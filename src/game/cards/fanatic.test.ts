import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Piece = State['pieces'][number];

const CARD = 'fanatic';
const WHITE_PAWN = '4k3/8/8/8/8/8/P7/4K3 w - - 0 1';
const BLACK_PAWN = '4k3/p7/8/8/8/8/8/4K3 b - - 0 1';

function game(options: Options = {}): State {
  return createGameState({
    fen: WHITE_PAWN,
    turn: 'white',
    phase: 'beforeMove',
    moveMade: false,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, target: unknown = 'a2'): Result {
  return applyAction(state, { type: 'playCard', cardId: CARD, target } as unknown as Action);
}

function expectOk(result: Result): State {
  if (!result.ok) assert.fail(`Expected success, received ${result.error.code}: ${result.error.message}`);
  return result.state;
}

function expectRejected(before: State, target: unknown, code: string): void {
  const snapshot = structuredClone(before);
  const result = play(before, target);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before, 'a rejected play must return the exact input state');
  assert.deepEqual(before, snapshot, 'a rejected play must be atomic');
}

function expectActionRejected(before: State, action: unknown, code: string): void {
  const snapshot = structuredClone(before);
  const result = applyAction(before, action as Action);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before, 'a rejected play must return the exact input state');
  assert.deepEqual(before, snapshot, 'a rejected play must be atomic');
}

function pieceAt(state: State, square: string): Piece | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function updatePiece(state: State, square: string, patch: Partial<Piece>): State {
  const target = pieceAt(state, square);
  assert.ok(target, `Expected a piece on ${square}`);
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.id === target.id ? { ...piece, ...patch } : piece),
  };
}

function orient(state: State, orientation: 0 | 90 | 180 | 270): State {
  return { ...state, orientation };
}

function pawnFen(owner: 'white' | 'black', rank: number): string {
  const ranks = ['4k3', '8', '8', '8', '8', '8', '8', '4K3'];
  const pawn = owner === 'white' ? 'P' : 'p';
  ranks[8 - rank] = rank === 8 ? `${pawn}3k3` : rank === 1 ? `${pawn}3K3` : `${pawn}7`;
  return `${ranks.join('/')} ${owner === 'white' ? 'w' : 'b'} - - 0 1`;
}

function expectMove(before: State, from: string, to: string): State {
  const movedBefore = pieceAt(before, from);
  assert.ok(movedBefore, `Expected a piece on ${from}`);
  const after = expectOk(play(before, from));
  assert.equal(pieceAt(after, from), undefined);
  assert.deepEqual(pieceAt(after, to), { ...movedBefore, square: to });
  return after;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Fanatic metadata', () => {
  it('has the stable id and display name', () => {
    assert.equal(CARD_CATALOG.fanatic.id, 'fanatic');
    assert.equal(CARD_CATALOG.fanatic.name, 'Fanatic');
  });

  it('costs exactly 2 deck-construction points', () => {
    assert.equal(CARD_CATALOG.fanatic.points, 2);
  });

  it('is not unique because its printed value has no asterisk', () => {
    assert.equal(CARD_CATALOG.fanatic.unique, false);
  });

  it('uses the matching final card artwork', () => {
    assert.equal(CARD_CATALOG.fanatic.image, '/KC1_card4.png');
  });

  it('preserves the complete printed effect text', () => {
    assert.equal(
      CARD_CATALOG.fanatic.description,
      'Move one of your Pawns forward three squares, provided the path is clear. It may not capture on this move, or be captured *en passant*.',
    );
  });

  it('maps “Play instead of your move” to the before-move window only', () => {
    assert.deepEqual(CARD_CATALOG.fanatic.timing, ['beforeMove']);
  });

  it('is a regular card rather than a Continuing Effect', () => {
    assert.equal(CARD_CATALOG.fanatic.continuing, false);
  });
});

describe('Fanatic three-square geometry', () => {
  it('moves a White Pawn exactly three squares from every on-board source rank', () => {
    for (const rank of [1, 2, 3, 4, 5]) {
      const before = game({ fen: pawnFen('white', rank) });
      const after = expectMove(before, `a${rank}`, `a${rank + 3}`);
      assert.equal(pieceAt(after, `a${rank + 3}`)?.role, 'pawn');
      assert.equal(pieceAt(after, `a${rank + 3}`)?.promoted, false);
    }
  });

  it('moves a Black Pawn exactly three squares from every on-board source rank', () => {
    for (const rank of [8, 7, 6, 5, 4]) {
      const before = game({
        fen: pawnFen('black', rank),
        turn: 'black',
        hands: { white: [], black: [CARD] },
      });
      const after = expectMove(before, `a${rank}`, `a${rank - 3}`);
      assert.equal(pieceAt(after, `a${rank - 3}`)?.role, 'pawn');
      assert.equal(pieceAt(after, `a${rank - 3}`)?.promoted, false);
    }
  });

  it('rejects every White source rank that has fewer than three forward squares', () => {
    for (const rank of [6, 7, 8]) {
      expectRejected(game({ fen: pawnFen('white', rank) }), `a${rank}`, 'ILLEGAL_MOVE');
    }
  });

  it('rejects every Black source rank that has fewer than three forward squares', () => {
    for (const rank of [3, 2, 1]) {
      const before = game({
        fen: pawnFen('black', rank),
        turn: 'black',
        hands: { white: [], black: [CARD] },
      });
      expectRejected(before, `a${rank}`, 'ILLEGAL_MOVE');
    }
  });

  const blocked: Array<{ name: string; fen: string; target: string; turn: 'white' | 'black' }> = [
    {
      name: 'rejects a friendly piece on White’s first intermediate square',
      fen: '4k3/8/8/8/8/N7/P7/4K3 w - - 0 1',
      target: 'a2',
      turn: 'white',
    },
    {
      name: 'rejects an enemy piece on White’s second intermediate square',
      fen: '4k3/8/8/8/n7/8/P7/4K3 w - - 0 1',
      target: 'a2',
      turn: 'white',
    },
    {
      name: 'rejects an enemy piece on White’s destination instead of capturing it',
      fen: '4k3/8/8/r7/8/8/P7/4K3 w - - 0 1',
      target: 'a2',
      turn: 'white',
    },
    {
      name: 'rejects a friendly piece on Black’s first intermediate square',
      fen: '4k3/7p/7n/8/8/8/8/4K3 b - - 0 1',
      target: 'h7',
      turn: 'black',
    },
    {
      name: 'rejects an enemy piece on Black’s second intermediate square',
      fen: '4k3/7p/8/7N/8/8/8/4K3 b - - 0 1',
      target: 'h7',
      turn: 'black',
    },
    {
      name: 'rejects a friendly piece on Black’s destination',
      fen: '4k3/7p/8/8/7r/8/8/4K3 b - - 0 1',
      target: 'h7',
      turn: 'black',
    },
  ];

  for (const fixture of blocked) {
    it(fixture.name, () => {
      const before = game({
        fen: fixture.fen,
        turn: fixture.turn,
        hands: fixture.turn === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
      });
      expectRejected(before, fixture.target, 'ILLEGAL_MOVE');
    });
  }
});

describe('Fanatic clockwise board orientation', () => {
  const vectors: Array<{
    name: string;
    orientation: 0 | 90 | 180 | 270;
    color: 'white' | 'black';
    fen: string;
    from: string;
    to: string;
  }> = [
    { name: 'White moves north at 0°', orientation: 0, color: 'white', fen: '7k/8/8/8/8/3P4/8/K7 w - - 0 1', from: 'd3', to: 'd6' },
    { name: 'Black moves south at 0°', orientation: 0, color: 'black', fen: '7k/8/3p4/8/8/8/8/K7 b - - 0 1', from: 'd6', to: 'd3' },
    { name: 'White moves east at 90°', orientation: 90, color: 'white', fen: '7k/8/8/8/1P6/8/8/K7 w - - 0 1', from: 'b4', to: 'e4' },
    { name: 'Black moves west at 90°', orientation: 90, color: 'black', fen: '7k/8/8/8/6p1/8/8/K7 b - - 0 1', from: 'g4', to: 'd4' },
    { name: 'White moves south at 180°', orientation: 180, color: 'white', fen: '7k/8/3P4/8/8/8/8/K7 w - - 0 1', from: 'd6', to: 'd3' },
    { name: 'Black moves north at 180°', orientation: 180, color: 'black', fen: '7k/8/8/8/8/3p4/8/K7 b - - 0 1', from: 'd3', to: 'd6' },
    { name: 'White moves west at 270°', orientation: 270, color: 'white', fen: '7k/8/8/8/6P1/8/8/K7 w - - 0 1', from: 'g4', to: 'd4' },
    { name: 'Black moves east at 270°', orientation: 270, color: 'black', fen: '7k/8/8/8/1p6/8/8/K7 b - - 0 1', from: 'b4', to: 'e4' },
  ];

  for (const fixture of vectors) {
    it(fixture.name, () => {
      const seeded = game({
        fen: fixture.fen,
        turn: fixture.color,
        hands: fixture.color === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
      });
      const before = orient(seeded, fixture.orientation);
      const after = expectMove(before, fixture.from, fixture.to);
      assert.equal(after.orientation, fixture.orientation);
    });
  }

  it('a neutral Black Pawn follows Black’s west vector when White acts at 90°', () => {
    const seeded = game({ fen: '7k/8/8/8/6p1/8/8/K7 w - - 0 1' });
    const before = updatePiece(orient(seeded, 90), 'g4', { neutral: true });
    const after = expectMove(before, 'g4', 'd4');
    assert.equal(pieceAt(after, 'd4')?.owner, 'black');
    assert.equal(pieceAt(after, 'd4')?.neutral, true);
  });

  it('a neutral White Pawn follows White’s east vector when Black acts at 90°', () => {
    const seeded = game({
      fen: '7k/8/8/8/1P6/8/8/K7 b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const before = updatePiece(orient(seeded, 90), 'b4', { neutral: true });
    const after = expectMove(before, 'b4', 'e4');
    assert.equal(pieceAt(after, 'e4')?.owner, 'white');
    assert.equal(pieceAt(after, 'e4')?.neutral, true);
  });

  const rotatedBlockers: Array<{
    name: string;
    orientation: 90 | 180 | 270;
    color: 'white' | 'black';
    fen: string;
    target: string;
  }> = [
    {
      name: '90° checks the first eastward intermediate square',
      orientation: 90,
      color: 'white',
      fen: '7k/8/8/8/1Pn5/8/8/K7 w - - 0 1',
      target: 'b4',
    },
    {
      name: '180° checks the second northward intermediate square',
      orientation: 180,
      color: 'black',
      fen: '7k/8/8/3N4/8/3p4/8/K7 b - - 0 1',
      target: 'd3',
    },
    {
      name: '270° checks the westward destination square',
      orientation: 270,
      color: 'white',
      fen: '7k/8/8/8/3r2P1/8/8/K7 w - - 0 1',
      target: 'g4',
    },
  ];

  for (const fixture of rotatedBlockers) {
    it(fixture.name, () => {
      const seeded = game({
        fen: fixture.fen,
        turn: fixture.color,
        hands: fixture.color === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
      });
      expectRejected(orient(seeded, fixture.orientation), fixture.target, 'ILLEGAL_MOVE');
    });
  }

  const rotatedEdges: Array<{
    name: string;
    orientation: 90 | 180 | 270;
    color: 'white' | 'black';
    fen: string;
    target: string;
  }> = [
    { name: '90° does not wrap White eastward past h-file', orientation: 90, color: 'white', fen: '7k/8/8/8/5P2/8/8/K7 w - - 0 1', target: 'f4' },
    { name: '90° does not wrap Black westward past a-file', orientation: 90, color: 'black', fen: '7k/8/8/8/2p5/8/8/K7 b - - 0 1', target: 'c4' },
    { name: '180° does not move White south below rank one', orientation: 180, color: 'white', fen: '7k/8/8/8/8/3P4/8/K7 w - - 0 1', target: 'd3' },
    { name: '180° does not move Black north above rank eight', orientation: 180, color: 'black', fen: '7k/8/3p4/8/8/8/8/K7 b - - 0 1', target: 'd6' },
    { name: '270° does not wrap White westward past a-file', orientation: 270, color: 'white', fen: '7k/8/8/8/2P5/8/8/K7 w - - 0 1', target: 'c4' },
    { name: '270° does not wrap Black eastward past h-file', orientation: 270, color: 'black', fen: '7k/8/8/8/5p2/8/8/K7 b - - 0 1', target: 'f4' },
  ];

  for (const fixture of rotatedEdges) {
    it(fixture.name, () => {
      const seeded = game({
        fen: fixture.fen,
        turn: fixture.color,
        hands: fixture.color === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
      });
      expectRejected(orient(seeded, fixture.orientation), fixture.target, 'ILLEGAL_MOVE');
    });
  }

  it('landing on the orientation-defined last file does not promote', () => {
    const before = orient(game({ fen: '7k/8/8/8/4P3/8/8/K7 w - - 0 1' }), 90);
    const after = expectMove(before, 'e4', 'h4');
    assert.equal(pieceAt(after, 'h4')?.role, 'pawn');
    assert.equal(pieceAt(after, 'h4')?.promoted, false);
  });
});

describe('Fanatic target identity and zone rules', () => {
  it('rejects a non-neutral Black Pawn during White’s turn', () => {
    expectRejected(game({ fen: '4k3/p7/8/8/8/8/8/4K3 w - - 0 1' }), 'a7', 'WRONG_OWNER');
  });

  it('rejects a non-neutral White Pawn during Black’s turn', () => {
    const before = game({
      fen: '4k3/8/8/8/8/8/P7/4K3 b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    expectRejected(before, 'a2', 'WRONG_OWNER');
  });

  it('lets White move a neutral Black Pawn in that Pawn owner’s forward direction', () => {
    const before = updatePiece(
      game({ fen: '4k3/p7/8/8/8/8/8/4K3 w - - 0 1' }),
      'a7',
      { neutral: true },
    );
    const after = expectMove(before, 'a7', 'a4');
    assert.equal(pieceAt(after, 'a4')?.owner, 'black');
    assert.equal(pieceAt(after, 'a4')?.neutral, true);
  });

  it('lets Black move a neutral White Pawn in that Pawn owner’s forward direction', () => {
    const before = updatePiece(
      game({ turn: 'black', hands: { white: [], black: [CARD] } }),
      'a2',
      { neutral: true },
    );
    const after = expectMove(before, 'a2', 'a5');
    assert.equal(pieceAt(after, 'a5')?.owner, 'white');
    assert.equal(pieceAt(after, 'a5')?.neutral, true);
  });

  it('moves a White Pawn that is currently transformed while retaining the transformation', () => {
    const before = updatePiece(game(), 'a2', { role: 'knight' });
    const after = expectMove(before, 'a2', 'a5');
    assert.equal(pieceAt(after, 'a5')?.role, 'knight');
    assert.equal(pieceAt(after, 'a5')?.originalRole, 'pawn');
  });

  it('moves a Black Pawn that is currently transformed while retaining the transformation', () => {
    const before = updatePiece(
      game({ fen: BLACK_PAWN, turn: 'black', hands: { white: [], black: [CARD] } }),
      'a7',
      { role: 'bishop' },
    );
    const after = expectMove(before, 'a7', 'a4');
    assert.equal(pieceAt(after, 'a4')?.role, 'bishop');
    assert.equal(pieceAt(after, 'a4')?.originalRole, 'pawn');
  });

  it('rejects a promoted White Pawn even though its original role is Pawn', () => {
    const before = updatePiece(game(), 'a2', { role: 'queen', promoted: true });
    expectRejected(before, 'a2', 'WRONG_ROLE');
  });

  it('rejects a promoted Black Pawn even though its original role is Pawn', () => {
    const before = updatePiece(
      game({ fen: BLACK_PAWN, turn: 'black', hands: { white: [], black: [CARD] } }),
      'a7',
      { role: 'rook', promoted: true },
    );
    expectRejected(before, 'a7', 'WRONG_ROLE');
  });

  it('moves a safe royal White Pawn and carries its King status to the destination', () => {
    const seeded = game({ fen: '7k/8/8/8/8/7r/P7/4K3 w - - 0 1' });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => {
        if (piece.square === 'a2') return { ...piece, royal: true };
        if (piece.square === 'e1') return { ...piece, royal: false };
        return piece;
      }),
    };
    const after = expectMove(before, 'a2', 'a5');
    assert.equal(pieceAt(after, 'a5')?.royal, true);
  });

  it('moves a safe royal Black Pawn and carries its King status to the destination', () => {
    const seeded = game({
      fen: '4k3/p7/7R/8/8/8/8/7K b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => {
        if (piece.square === 'a7') return { ...piece, royal: true };
        if (piece.square === 'e8') return { ...piece, royal: false };
        return piece;
      }),
    };
    const after = expectMove(before, 'a7', 'a4');
    assert.equal(pieceAt(after, 'a4')?.royal, true);
  });

  for (const zone of ['captured', 'dead', 'away'] as const) {
    it(`cannot move a Pawn in the ${zone} zone`, () => {
      const before = updatePiece(game(), 'a2', { zone, square: null });
      expectRejected(before, 'a2', 'INVALID_TARGET');
    });
  }

  it('rejects every own piece whose original and current identity are not Pawn', () => {
    const fixtures = [
      ['Knight', '4k3/8/8/8/8/8/N7/4K3 w - - 0 1'],
      ['Bishop', '4k3/8/8/8/8/8/B7/4K3 w - - 0 1'],
      ['Rook', '4k3/8/8/8/8/8/R7/4K3 w - - 0 1'],
      ['Queen', '4k3/8/8/8/8/8/Q7/4K3 w - - 0 1'],
      ['King', '4k3/8/8/8/8/8/K7/8 w - - 0 1'],
    ] as const;
    for (const [name, fen] of fixtures) {
      assert.ok(name);
      expectRejected(game({ fen }), 'a2', 'WRONG_ROLE');
    }
  });

  it('rejects an empty source square', () => {
    expectRejected(game(), 'h4', 'INVALID_TARGET');
  });
});

describe('Fanatic card lifecycle and replacement-move semantics', () => {
  it('moves only the selected identity and preserves every unrelated piece', () => {
    const before = game({ fen: '4k3/7p/8/8/8/8/PP6/R3K3 w - - 0 1' });
    const selected = pieceAt(before, 'b2');
    assert.ok(selected);
    const unrelated = before.pieces.filter(piece => piece.id !== selected.id);
    const after = expectMove(before, 'b2', 'b5');
    assert.deepEqual(after.pieces.find(piece => piece.id === selected.id), { ...selected, square: 'b5' });
    assert.deepEqual(after.pieces.filter(piece => piece.id !== selected.id), unrelated);
  });

  it('spends the exact selected card instance and appends it to discard', () => {
    const before = game({ hands: { white: ['assassin', CARD, 'guardian'], black: [] } });
    const priorDiscard = { id: 'white-old-discard', cardId: 'disintegration' };
    const withDiscard: State = {
      ...before,
      players: {
        ...before.players,
        white: { ...before.players.white, discard: [priorDiscard] },
      },
    };
    const used = withDiscard.players.white.hand[1];
    const after = expectOk(play(withDiscard));
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['assassin', 'guardian']);
    assert.deepEqual(after.players.white.discard.map(card => card.id), [priorDiscard.id, used.id]);
  });

  it('draws the top deck instance, preserves deck order, and appends the draw to hand', () => {
    const before = game({
      hands: { white: ['assassin', CARD, 'guardian'], black: [] },
      decks: { white: ['disintegration', 'heresy', 'annexation'], black: [] },
    });
    const drawn = before.players.white.deck[0];
    const remaining = before.players.white.deck.slice(1);
    const after = expectOk(play(before));
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['assassin', 'guardian', 'disintegration']);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, remaining);
  });

  it('does not reshuffle discard when the separate deck is empty', () => {
    const seeded = game({ hands: { white: ['disintegration', CARD], black: [] } });
    const [oldCard, used] = seeded.players.white.hand;
    const before: State = {
      ...seeded,
      players: {
        ...seeded.players,
        white: { hand: [used], deck: [], discard: [oldCard] },
      },
    };
    const after = expectOk(play(before));
    assert.deepEqual(after.players.white.hand, []);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.players.white.discard.map(card => card.id), [oldCard.id, used.id]);
  });

  it('spends only the first matching instance when the hand contains duplicates', () => {
    const before = game({ hands: { white: [CARD, CARD], black: [] } });
    const [first, second] = before.players.white.hand;
    const after = expectOk(play(before));
    assert.equal(after.players.white.discard.at(-1)?.id, first.id);
    assert.deepEqual(after.players.white.hand.map(card => card.id), [second.id]);
  });

  it('spends the exact duplicate selected by cardInstanceId', () => {
    const before = game({ hands: { white: [CARD, 'disintegration', CARD], black: [] } });
    const [first, neighbour, selected] = before.players.white.hand;
    const after = expectOk(applyAction(before, {
      type: 'playCard',
      cardId: CARD,
      cardInstanceId: selected.id,
      target: 'a2',
    } as unknown as Action));
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.deepEqual(after.players.white.hand.map(card => card.id), [first.id, neighbour.id]);
  });

  it('spends the exact selected duplicate when the card effect fizzles', () => {
    const before = game({
      fen: '7k/8/8/8/3b4/8/1P6/K7 w - - 0 1',
      hands: { white: [CARD, CARD], black: [] },
    });
    const [first, selected] = before.players.white.hand;
    const after = expectOk(applyAction(before, {
      type: 'playCard',
      cardId: CARD,
      cardInstanceId: selected.id,
      target: 'b2',
    } as unknown as Action));
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.deepEqual(after.players.white.hand.map(card => card.id), [first.id]);
  });

  it('atomically rejects a cardInstanceId belonging to a different card', () => {
    const before = game({ hands: { white: [CARD, 'disintegration'], black: [] } });
    const mismatched = before.players.white.hand[1];
    expectActionRejected(before, {
      type: 'playCard',
      cardId: CARD,
      cardInstanceId: mismatched.id,
      target: 'a2',
    }, 'CARD_NOT_IN_HAND');
  });

  it('atomically rejects instance IDs outside the acting hand', () => {
    const seeded = game({
      hands: { white: [CARD], black: [CARD] },
      decks: { white: [CARD], black: [] },
    });
    const discarded = { id: 'white-discarded-fanatic', cardId: CARD };
    const before: State = {
      ...seeded,
      players: {
        ...seeded.players,
        white: { ...seeded.players.white, discard: [discarded] },
      },
    };
    const inaccessible = [
      'missing-fanatic-instance',
      before.players.white.deck[0].id,
      before.players.white.discard[0].id,
      before.players.black.hand[0].id,
    ];
    for (const cardInstanceId of inaccessible) {
      expectActionRejected(before, {
        type: 'playCard',
        cardId: CARD,
        cardInstanceId,
        target: 'a2',
      }, 'CARD_NOT_IN_HAND');
    }
  });

  it('atomically rejects malformed cardInstanceId values without coercion', () => {
    const before = game();
    for (const cardInstanceId of [null, 42, true, {}, [], new String(before.players.white.hand[0].id)]) {
      expectActionRejected(before, {
        type: 'playCard',
        cardId: CARD,
        cardInstanceId,
        target: 'a2',
      }, 'CARD_NOT_IN_HAND');
    }
  });

  it('increments only the acting player’s card allowance', () => {
    const before = game({ cardPlays: { black: 1 } });
    const after = expectOk(play(before));
    assert.deepEqual(after.turn.cardPlays, { white: 1, black: 1 });
  });

  it('leaves the opponent’s card zones, active effects, orientation, and outcome unchanged', () => {
    const seeded = game({
      hands: { white: [CARD], black: ['disintegration', CARD] },
      decks: { white: [], black: ['guardian'] },
    });
    const marker = { cardId: 'pacifism', target: 'h7' };
    const before: State = { ...seeded, effects: [marker as unknown as State['effects'][number]] };
    const after = expectOk(play(before));
    assert.deepEqual(after.players.black, before.players.black);
    assert.deepEqual(after.effects, before.effects);
    assert.equal(after.orientation, before.orientation);
    assert.equal(after.outcome, null);
  });

  it('records one card event with the source target and no synthetic regular-move event', () => {
    const before = game();
    const after = expectOk(play(before));
    assert.deepEqual(after.history, [
      ...before.history,
      {
        type: 'cardPlayed', cardId: CARD, target: 'a2',
        movement: [{ from: 'a2', to: 'a5' }], preservePreviousMove: false,
      },
    ]);
    assert.equal(after.history.some(event => event.type === 'move'), false);
  });

  it('consumes the regular move while keeping the acting color active until end turn', () => {
    const after = expectOk(play(game()));
    assert.equal(after.turn.color, 'white');
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('does not permit an ordinary move after Fanatic replaced it', () => {
    const after = expectOk(play(game()));
    const result = applyAction(after, { type: 'move', from: 'e1', to: 'd1' });
    if (result.ok) assert.fail('Expected ILLEGAL_MOVE, received success');
    assert.equal(result.error.code, 'ILLEGAL_MOVE');
    assert.strictEqual(result.state, after);
  });

  it('cannot be played after an ordinary move', () => {
    const before = game();
    const moved = applyAction(before, { type: 'move', from: 'e1', to: 'd1' });
    const afterMove = expectOk(moved);
    expectRejected(afterMove, 'a2', 'INVALID_TIMING');
  });

  it('rejects both inconsistent turn-phase combinations', () => {
    expectRejected(game({ phase: 'afterMove', moveMade: false }), 'a2', 'INVALID_TIMING');
    expectRejected(game({ phase: 'beforeMove', moveMade: true }), 'a2', 'INVALID_TIMING');
  });

  it('ends normally after replacing the move and resets both turn allowances', () => {
    const played = expectOk(play(game({ cardPlays: { black: 1 } })));
    const ended = expectOk(applyAction(played, { type: 'endTurn' }));
    assert.deepEqual(ended.turn, {
      color: 'black',
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { white: 0, black: 0 },
    });
  });

  it('requires the acting player to hold the card, not merely deck or opponent access', () => {
    expectRejected(game({ hands: { white: [], black: [] } }), 'a2', 'CARD_NOT_IN_HAND');
    expectRejected(
      game({ hands: { white: [], black: [] }, decks: { white: [CARD], black: [] } }),
      'a2',
      'CARD_NOT_IN_HAND',
    );
    expectRejected(game({ hands: { white: [], black: [CARD] } }), 'a2', 'CARD_NOT_IN_HAND');
  });

  it('rejects an already-used own-turn card allowance, including corrupted higher counts', () => {
    expectRejected(game({ cardPlays: { white: 1 } }), 'a2', 'CARD_ALREADY_PLAYED');
    expectRejected(game({ cardPlays: { white: 2 } }), 'a2', 'CARD_ALREADY_PLAYED');
  });

  it('rejects Fanatic after the game has an outcome', () => {
    const active = game();
    const before = { ...active, outcome: { winner: 'black', reason: 'checkmate' } } as State;
    expectRejected(before, 'a2', 'GAME_OVER');
  });
});

describe('Fanatic King safety and the Checkmate Rule', () => {
  it('fizzles and spends a White play that would expose its own King', () => {
    const before = game({
      fen: '7k/8/8/8/3b4/8/1P6/K7 w - - 0 1',
      decks: { white: ['guardian'], black: [] },
    });
    const used = before.players.white.hand[0];
    const drawn = before.players.white.deck[0];
    const after = expectOk(play(before, 'b2'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.players.white.hand.some(card => card.id === drawn.id), true);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.outcome, null);
  });

  it('fizzles and spends a Black play that would expose its own King', () => {
    const before = game({
      fen: 'k7/1p6/8/3B4/8/8/8/7K b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
      decks: { white: [], black: ['guardian'] },
    });
    const used = before.players.black.hand[0];
    const drawn = before.players.black.deck[0];
    const after = expectOk(play(before, 'b7'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.black.discard.at(-1)?.id, used.id);
    assert.equal(after.players.black.hand.some(card => card.id === drawn.id), true);
    assert.equal(after.turn.cardPlays.black, 1);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.outcome, null);
  });

  it('can replace White’s move by blocking a check with the three-square Pawn move', () => {
    const before = game({ fen: '7k/8/5b2/8/8/8/4P3/K7 w - - 0 1' });
    assert.equal(positionFor(before, 'white').isCheck(), true);
    const after = expectMove(before, 'e2', 'e5');
    assert.equal(positionFor(after, 'white').isCheck(), false);
  });

  it('can replace Black’s move by blocking a check with the three-square Pawn move', () => {
    const before = game({
      fen: 'k7/4p3/8/8/8/5B2/8/7K b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    assert.equal(positionFor(before, 'black').isCheck(), true);
    const after = expectMove(before, 'e7', 'e4');
    assert.equal(positionFor(after, 'black').isCheck(), false);
  });

  it('allows a discovered check that is not checkmate', () => {
    const before = game({ fen: '7k/8/8/8/8/8/1P6/B6K w - - 0 1' });
    const after = expectMove(before, 'b2', 'b5');
    assert.equal(positionFor(after, 'black').isCheck(), true);
    assert.equal(positionFor(after, 'black').isCheckmate(), false);
    assert.equal(after.outcome, null);
  });

  it('fizzles direct checkmate for either color while spending the replacing move', () => {
    const fixtures: Array<{ fen: string; turn: 'white' | 'black'; source: string }> = [
      { fen: '5N1k/5K2/8/8/8/8/1P6/B7 w - - 0 1', turn: 'white', source: 'b2' },
      { fen: 'b7/1p6/8/8/6n1/8/5k2/7K b - - 0 1', turn: 'black', source: 'b7' },
    ];

    for (const fixture of fixtures) {
      const before = game({
        fen: fixture.fen,
        turn: fixture.turn,
        hands: fixture.turn === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
        decks: fixture.turn === 'white' ? { white: ['guardian'], black: [] } : { white: [], black: ['guardian'] },
      });
      const used = before.players[fixture.turn].hand[0];
      const drawn = before.players[fixture.turn].deck[0];
      const after = expectOk(play(before, fixture.source));
      assert.deepEqual(after.pieces, before.pieces, 'the mating board effect must be rolled back');
      assert.deepEqual(after.history.at(-1), {
        type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
      });
      assert.equal(after.players[fixture.turn].discard.at(-1)?.id, used.id);
      assert.equal(after.players[fixture.turn].hand.some(card => card.id === drawn.id), true);
      assert.equal(after.turn.cardPlays[fixture.turn], 1);
      assert.equal(after.turn.phase, 'afterMove');
      assert.equal(after.turn.moveMade, true);
      assert.equal(after.outcome, null);
    }
  });

  it('fizzles and spends moving a royal Pawn onto an attacked destination', () => {
    const seeded = game({ fen: '7k/8/8/7r/8/8/P7/4K3 w - - 0 1' });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => {
        if (piece.square === 'a2') return { ...piece, royal: true };
        if (piece.square === 'e1') return { ...piece, royal: false };
        return piece;
      }),
    };
    const after = expectOk(play(before, 'a2'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('SELF_CHECK-fizzles when a moved neutral Black Pawn attacks Black’s own King', () => {
    const seeded = game({
      fen: '8/4p3/8/8/8/3k4/8/7K b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const before = updatePiece(seeded, 'e7', { neutral: true });
    const used = before.players.black.hand[0];
    const after = expectOk(play(before, 'e7'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.black.discard.at(-1)?.id, used.id);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('SELF_CHECK-fizzles when a moved neutral transformed White Pawn attacks White’s own King', () => {
    const seeded = game({ fen: '1K5k/8/8/8/8/8/4P3/8 w - - 0 1' });
    const before = updatePiece(seeded, 'e2', { neutral: true, role: 'bishop' });
    const used = before.players.white.hand[0];
    const after = expectOk(play(before, 'e2'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('keeps the regular move available when an in-check position makes Fanatic fizzle', () => {
    const before = game({ fen: '7k/8/5b2/8/8/8/7P/K7 w - - 0 1' });
    assert.equal(positionFor(before, 'white').isCheck(), true);
    const after = expectOk(play(before, 'h2'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.moveMade, false);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(after.outcome, null);
  });

  it('adjudicates mate after spending an in-check Fanatic that cannot provide an escape', () => {
    const before = game({
      fen: 'rnb1kbnr/pppp1ppp/8/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    });
    assert.equal(positionFor(before, 'white').isCheckmate(), true);
    const after = expectOk(play(before, 'a2'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.moveMade, false);
    assert.deepEqual(after.outcome, { winner: 'black', reason: 'checkmate' });
  });

  it('gives direct-mate fizzle precedence when the proposed move would also self-check', () => {
    const before = game({
      fen: '5N2/8/N1k5/K4N2/8/8/3P4/1R1Rb3 w - - 0 1',
    });
    assert.equal(positionFor(before, 'white').isCheck(), false);
    assert.equal(positionFor(before, 'black').isCheck(), false);
    const after = expectOk(play(before, 'd2'));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(after.outcome, null);
  });
});

describe('Fanatic FEN, clocks, castling, and en-passant state', () => {
  it('serializes the White three-square move and next FEN side exactly', () => {
    const after = expectMove(game(), 'a2', 'a5');
    assert.equal(after.fen, '4k3/8/8/P7/8/8/8/4K3 b - - 0 1');
  });

  it('serializes the Black three-square move and next FEN side exactly', () => {
    const before = game({ fen: BLACK_PAWN, turn: 'black', hands: { white: [], black: [CARD] } });
    const after = expectMove(before, 'a7', 'a4');
    assert.equal(after.fen, '4k3/8/8/8/p7/8/8/4K3 w - - 0 2');
  });

  it('clears a pre-existing valid en-passant target after White uses Fanatic', () => {
    const before = game({ fen: 'r3k2r/8/8/4p3/8/8/P7/R3K2R w KQkq e6 17 42' });
    const after = expectMove(before, 'a2', 'a5');
    assert.equal(after.fen.split(' ')[3], '-');
  });

  it('resets the halfmove clock and updates the fullmove clock exactly like a Pawn move', () => {
    const white = expectOk(play(game({ fen: 'r3k2r/8/8/4p3/8/8/P7/R3K2R w KQkq e6 17 42' })));
    assert.deepEqual(white.fen.split(' ').slice(4), ['0', '42']);

    const blackBefore = game({
      fen: 'r3k2r/p7/8/8/4P3/8/8/R3K2R b KQkq e3 23 57',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const black = expectOk(play(blackBefore, 'a7'));
    assert.deepEqual(black.fen.split(' ').slice(4), ['0', '58']);
  });

  it('preserves all castling rights while changing no rook or King squares', () => {
    const before = game({ fen: 'r3k2r/8/8/4p3/8/8/P7/R3K2R w KQkq e6 17 42' });
    const protectedPieces = before.pieces.filter(piece => piece.role === 'king' || piece.role === 'rook');
    const after = expectOk(play(before));
    assert.equal(after.fen, 'r3k2r/8/8/P3p3/8/8/8/R3K2R b KQkq - 0 42');
    assert.deepEqual(
      after.pieces.filter(piece => piece.role === 'king' || piece.role === 'rook'),
      protectedPieces,
    );
  });

  it('never exposes the Fanatic Pawn to en passant on the reply', () => {
    const before = game({ fen: '4k3/8/8/3p4/8/8/4P3/4K3 w - - 0 1' });
    const played = expectMove(before, 'e2', 'e5');
    assert.equal(played.fen.split(' ')[3], '-');
    const reply = expectOk(applyAction(played, { type: 'endTurn' }));
    const enPassant = applyAction(reply, { type: 'move', from: 'd5', to: 'e4' });
    if (enPassant.ok) assert.fail('Fanatic expressly forbids en-passant capture');
    assert.equal(enPassant.error.code, 'ILLEGAL_MOVE');
    assert.equal(pieceAt(reply, 'e5')?.owner, 'white');
  });
});

describe('Fanatic malformed input and immutable serialization', () => {
  it('rejects a playCard action with no target', () => {
    const before = game();
    const snapshot = structuredClone(before);
    const result = applyAction(before, { type: 'playCard', cardId: CARD } as unknown as Action);
    if (result.ok) assert.fail('Expected INVALID_TARGET, received success');
    assert.equal(result.error.code, 'INVALID_TARGET');
    assert.strictEqual(result.state, before);
    assert.deepEqual(before, snapshot);
  });

  it('rejects every non-string target without coercion', () => {
    const before = game();
    const snapshot = structuredClone(before);
    const explicitUndefined = applyAction(
      before,
      { type: 'playCard', cardId: CARD, target: undefined } as unknown as Action,
    );
    if (explicitUndefined.ok) assert.fail('Expected INVALID_TARGET, received success');
    assert.equal(explicitUndefined.error.code, 'INVALID_TARGET');
    assert.strictEqual(explicitUndefined.state, before);
    assert.deepEqual(before, snapshot);

    for (const target of [null, 42, true, {}, [], ['a2'], new String('a2')]) {
      expectRejected(game(), target, 'INVALID_TARGET');
    }
  });

  it('rejects malformed and non-canonical square strings', () => {
    for (const target of ['', 'a0', 'a9', 'i2', 'aa2', 'A2', ' a2', 'a2 ', 'a2-a5']) {
      expectRejected(game(), target, 'INVALID_TARGET');
    }
  });

  it('does not mutate a deeply frozen successful input and returns a new state tree', () => {
    const before = deepFreeze(game({
      hands: { white: ['disintegration', CARD], black: ['guardian'] },
      decks: { white: ['heresy'], black: ['annexation'] },
    }));
    const snapshot = structuredClone(before);
    const after = expectOk(play(before));
    assert.deepEqual(before, snapshot);
    assert.notStrictEqual(after, before);
    assert.notStrictEqual(after.pieces, before.pieces);
    assert.notStrictEqual(after.players, before.players);
    assert.notStrictEqual(after.turn, before.turn);
    assert.notStrictEqual(after.history, before.history);
  });

  it('keeps all card zones and history untouched on a rejected frozen input', () => {
    const before = deepFreeze(game({ decks: { white: ['guardian'], black: [] } }));
    const players = structuredClone(before.players);
    const history = structuredClone(before.history);
    expectRejected(before, 'a3', 'INVALID_TARGET');
    assert.deepEqual(before.players, players);
    assert.deepEqual(before.history, history);
  });

  it('produces a plain JSON-round-trippable state after a successful card move', () => {
    const after = expectOk(play(game({ decks: { white: ['guardian'], black: [] } })));
    assert.deepEqual(JSON.parse(JSON.stringify(after)), after);
  });
});
