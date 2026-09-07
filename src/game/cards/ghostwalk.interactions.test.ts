import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type {
  CardMove,
  ConfabulationEffect,
  CrabEffect,
  DoomsayerEffect,
  ForbiddenCityEffect,
  GameState,
  PacifismEffect,
  PieceState,
  SquareName,
  VendettaEffect,
} from '../types.js';

const pieceAt = (state: GameState, square: SquareName): PieceState => {
  const piece = state.pieces.find((candidate) => candidate.zone === 'board' && candidate.square === square);
  assert.ok(piece);
  return piece;
};

const offers = (state: GameState, move: CardMove): boolean =>
  cardPlayTargets(state, 'ghostwalk').some((target) =>
    JSON.stringify(target) === JSON.stringify([move])
  );

function ghostwalk(state: GameState, move: CardMove) {
  return applyAction(state, {
    type: 'playCard',
    cardId: 'ghostwalk',
    target: [move],
  });
}

test('Ghostwalk preserves Pacifism while moving through friendly pieces', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const rook = pieceAt(state, 'a1');
  const pacifism: PacifismEffect = {
    type: 'pacifism',
    owner: 'white',
    card: { id: 'pacifism-effect', cardId: 'pacifism' },
    pieceId: rook.id,
  };
  state = { ...state, effects: [...state.effects, pacifism] };

  const move: CardMove = { from: 'a1', to: 'a4' };
  assert.equal(offers(state, move), true);
  const result = ghostwalk(state, move);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find((piece) => piece.id === rook.id)?.square, 'a4');
  assert.equal(pieceAt(result.state, 'a2').role, 'pawn');
  assert.equal(pieceAt(result.state, 'a3').role, 'pawn');
  assert.deepEqual(
    result.state.effects.find((effect) => {
      const candidate = effect as Partial<PacifismEffect>;
      return candidate.type === 'pacifism'
        && candidate.card?.id === pacifism.card.id
        && candidate.pieceId === rook.id;
    }),
    pacifism,
  );
});

test('Forbidden City still blocks a Ghostwalk route and rejects atomically', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const forbiddenCity: ForbiddenCityEffect = {
    type: 'forbidden-city',
    owner: 'black',
    card: { id: 'forbidden-city-effect', cardId: 'forbidden-city' },
    square: 'a3',
  };
  state = { ...state, effects: [...state.effects, forbiddenCity] };
  const before = structuredClone(state);
  const move: CardMove = { from: 'a1', to: 'a4' };

  assert.equal(offers(state, move), false);
  const result = ghostwalk(state, move);

  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('a Confabulation board Rook and away Bishop Ghostwalk through blockers and persist', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const rook = pieceAt(state, 'a1');
  const awayBishop: PieceState = {
    id: 'white-bishop-confabulation-away',
    owner: 'white',
    role: 'bishop',
    originalRole: 'bishop',
    square: null,
    zone: 'away',
    promoted: false,
    royal: false,
    neutral: false,
  };
  const confabulation: ConfabulationEffect = {
    type: 'confabulation',
    owner: 'white',
    card: { id: 'confabulation-effect', cardId: 'confabulation' },
    pieceIds: [rook.id, awayBishop.id],
  };
  state = {
    ...state,
    pieces: [...state.pieces, awayBishop],
    effects: [...state.effects, confabulation],
  };

  const result = ghostwalk(state, { from: 'a1', to: 'a4' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find((piece) => piece.id === rook.id)?.square, 'a4');
  assert.equal(result.state.pieces.find((piece) => piece.id === awayBishop.id)?.zone, 'away');
  assert.deepEqual(
    result.state.effects.find((effect) => {
      const candidate = effect as Partial<ConfabulationEffect>;
      return candidate.type === 'confabulation'
        && candidate.pieceIds?.[0] === rook.id
        && candidate.pieceIds?.[1] === awayBishop.id;
    }),
    confabulation,
  );
});

test('a Crab-marked Pawn uses its diagonal-forward geometry with Ghostwalk and keeps Crab', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/2P5/8/7K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const pawn = pieceAt(state, 'c3');
  const crab: CrabEffect = {
    type: 'crab',
    owner: 'white',
    card: { id: 'crab-effect', cardId: 'crab' },
    pieceId: pawn.id,
  };
  state = { ...state, effects: [...state.effects, crab] };
  const move: CardMove = { from: 'c3', to: 'd4' };

  assert.equal(offers(state, move), true);
  const result = ghostwalk(state, move);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find((piece) => piece.id === pawn.id)?.square, 'd4');
  assert.deepEqual(
    result.state.effects.find((effect) => {
      const candidate = effect as Partial<CrabEffect>;
      return candidate.type === 'crab'
        && candidate.card?.id === crab.card.id
        && candidate.pieceId === pawn.id;
    }),
    crab,
  );
});

test('Vendetta rejects Ghostwalk when an opponent capture is available', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P1p5/PP6/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const vendetta: VendettaEffect = {
    type: 'vendetta',
    owner: 'black',
    card: { id: 'black-vendetta-effect', cardId: 'vendetta' },
  };
  state = { ...state, effects: [...state.effects, vendetta] };
  const before = structuredClone(state);

  const result = ghostwalk(state, { from: 'a1', to: 'a4' });

  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('an opposing Vendetta expires to its owner discard when White has no capture', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const vendetta: VendettaEffect = {
    type: 'vendetta',
    owner: 'black',
    card: { id: 'black-vendetta-effect', cardId: 'vendetta' },
  };
  state = { ...state, effects: [...state.effects, vendetta] };

  const result = ghostwalk(state, { from: 'a1', to: 'a4' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(pieceAt(result.state, 'a4').role, 'rook');
  assert.equal(result.state.effects.includes(vendetta), false);
  assert.deepEqual(result.state.players.black.discard, [vendetta.card]);
  assert.equal(result.state.players.white.discard.some((card) => card.id === vendetta.card.id), false);
});

test('an active Truce remains exact after a noncapturing, nonchecking Ghostwalk', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const truce = {
    type: 'truce',
    owner: 'black',
    card: { id: 'black-truce-effect', cardId: 'truce' },
  } as const;
  state = { ...state, effects: [...state.effects, truce] };

  const result = ghostwalk(state, { from: 'a1', to: 'a4' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(pieceAt(result.state, 'a4').role, 'rook');
  assert.deepEqual(
    result.state.effects.find((effect) => {
      const candidate = effect as { type?: unknown; card?: { id?: unknown } };
      return candidate.type === 'truce' && candidate.card?.id === truce.card.id;
    }),
    truce,
  );
  assert.equal(result.state.players.black.discard.some((card) => card.id === truce.card.id), false);
});

test('a neutral black-owned Rook is controlled by White and stays neutral after Ghostwalk', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const rook = pieceAt(state, 'a1');
  state = {
    ...state,
    pieces: state.pieces.map((piece) =>
      piece.id === rook.id ? { ...piece, owner: 'black', neutral: true } : piece
    ),
  };

  const result = ghostwalk(state, { from: 'a1', to: 'a4' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const moved = result.state.pieces.find((piece) => piece.id === rook.id);
  assert.equal(moved?.square, 'a4');
  assert.equal(moved?.owner, 'black');
  assert.equal(moved?.neutral, true);
  assert.equal(pieceAt(result.state, 'a2').owner, 'white');
  assert.equal(pieceAt(result.state, 'a3').owner, 'white');
});

test('a promoted Pawn acting as Queen keeps its fields after Ghostwalking through a blocker', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/2PP4/8/7K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const pawn = pieceAt(state, 'c3');
  state = {
    ...state,
    pieces: state.pieces.map((piece) =>
      piece.id === pawn.id
        ? { ...piece, role: 'queen', originalRole: 'pawn', promoted: true }
        : piece
    ),
  };

  const result = ghostwalk(state, { from: 'c3', to: 'g3' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const promotedPawn = result.state.pieces.find((piece) => piece.id === pawn.id);
  assert.equal(promotedPawn?.square, 'g3');
  assert.equal(promotedPawn?.role, 'queen');
  assert.equal(promotedPawn?.originalRole, 'pawn');
  assert.equal(promotedPawn?.promoted, true);
  assert.equal(pieceAt(result.state, 'd3').owner, 'white');
});

test('Pacifism protects an enemy destination and direct Ghostwalk rejects atomically', () => {
  let state = createGameState({
    fen: '7k/8/8/8/b7/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const bishop = pieceAt(state, 'a4');
  const pacifism: PacifismEffect = {
    type: 'pacifism',
    owner: 'black',
    card: { id: 'black-pacifism-effect', cardId: 'pacifism' },
    pieceId: bishop.id,
  };
  state = { ...state, effects: [...state.effects, pacifism] };
  const before = structuredClone(state);
  const move: CardMove = { from: 'a1', to: 'a4' };

  assert.equal(offers(state, move), false);
  const result = ghostwalk(state, move);

  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
  assert.deepEqual(state.effects.find((effect) => effect === pacifism), pacifism);
  assert.deepEqual(state.players.white.hand, before.players.white.hand);
});

test('Ghostwalk crossing the frontier records movement for an immediate opposing Toll', () => {
  const initial = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: ['toll'] },
  });
  const pawn = pieceAt(initial, 'a2');
  const move: CardMove = { from: 'a1', to: 'a5' };
  const initialBefore = structuredClone(initial);

  const walked = ghostwalk(initial, move);

  assert.equal(walked.ok, true);
  if (!walked.ok) return;
  assert.deepEqual(walked.state.history.at(-1)?.movement, [move]);
  assert.deepEqual(initial, initialBefore);
  const walkedBefore = structuredClone(walked.state);

  const tolled = applyAction(walked.state, {
    type: 'playCard',
    cardId: 'toll',
    target: 'a2',
  });

  assert.equal(tolled.ok, true);
  if (!tolled.ok) return;
  const capturedPawn = tolled.state.pieces.find((piece) => piece.id === pawn.id);
  assert.equal(capturedPawn?.square, null);
  assert.equal(capturedPawn?.zone, 'captured');
  assert.deepEqual(initial, initialBefore);
  assert.deepEqual(walked.state, walkedBefore);
});

test('Revenge rejects after noncapturing Ghostwalk despite an older captured move', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: ['revenge'] },
  });
  state = {
    ...state,
    history: [
      ...state.history,
      {
        type: 'move',
        from: 'b2',
        to: 'c3',
        capturedId: 'older-captured-piece',
        player: 'white',
      },
    ],
  };

  const walked = ghostwalk(state, { from: 'a1', to: 'a4' });
  assert.equal(walked.ok, true);
  if (!walked.ok) return;
  assert.equal(walked.state.history.at(-1)?.capturedId, undefined);
  const beforeRevenge = structuredClone(walked.state);

  const revenge = applyAction(walked.state, {
    type: 'playCard',
    cardId: 'revenge',
    target: [],
  });

  assert.equal(revenge.ok, false);
  assert.deepEqual(revenge.state, beforeRevenge);
  assert.deepEqual(walked.state, beforeRevenge);
});

test('Doomsayer remains exactly active when Ghostwalk speaks no piece name', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const doomsayer: DoomsayerEffect = {
    type: 'doomsayer',
    owner: 'black',
    card: { id: 'black-doomsayer-effect', cardId: 'doomsayer' },
  };
  state = { ...state, effects: [...state.effects, doomsayer] };

  const result = ghostwalk(state, { from: 'a1', to: 'a4' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.effects, [doomsayer]);
  assert.equal(result.state.pendingDoomsayer, null);
});

test('a replacement-move card cannot follow Ghostwalk in the same turn', async (t) => {
  const followUps = [
    { cardId: 'dubbing', move: { from: 'a4', to: 'b6' } },
    { cardId: 'fanatic', move: { from: 'a2', to: 'a5' } },
    { cardId: 'forced-march', move: { from: 'a2', to: 'b2' } },
  ] as const;

  for (const followUp of followUps) {
    await t.test(followUp.cardId, () => {
      const initial = createGameState({
        fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
        hands: { white: ['ghostwalk', followUp.cardId], black: [] },
      });
      const walked = ghostwalk(initial, { from: 'a1', to: 'a4' });
      assert.equal(walked.ok, true);
      if (!walked.ok) return;
      const beforeFollowUp = structuredClone(walked.state);

      const result = applyAction(walked.state, {
        type: 'playCard',
        cardId: followUp.cardId,
        target: [followUp.move],
      });

      assert.equal(result.ok, false);
      assert.deepEqual(result.state, beforeFollowUp);
      assert.deepEqual(walked.state, beforeFollowUp);
    });
  }
});

test('self-check Ghostwalk fizzles, restores the board, and preserves Pacifism', () => {
  let state = createGameState({
    fen: '4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1',
    hands: { white: ['ghostwalk'], black: [] },
  });
  const rook = pieceAt(state, 'e2');
  const pacifism: PacifismEffect = {
    type: 'pacifism',
    owner: 'white',
    card: { id: 'white-pacifism-shield', cardId: 'pacifism' },
    pieceId: rook.id,
  };
  state = { ...state, effects: [...state.effects, pacifism] };
  const boardBefore = structuredClone(state.pieces);
  const ghostwalkCard = state.players.white.hand.find((card) => card.cardId === 'ghostwalk');
  assert.ok(ghostwalkCard);

  const result = ghostwalk(state, { from: 'e2', to: 'h2' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.pieces, boardBefore);
  assert.deepEqual(result.state.effects, [pacifism]);
  assert.equal(result.state.players.white.hand.some((card) => card.id === ghostwalkCard.id), false);
  assert.deepEqual(result.state.players.white.discard, [ghostwalkCard]);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
});
