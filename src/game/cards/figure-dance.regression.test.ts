import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, boardFen, cardPlayTargets, isPromotionSquare, legalDests } from "../reducer.js";
import { createGameState } from "../state.js";
import type { GameState } from "../types.js";

const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
  return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
};

const assertValid = (state: GameState) => {
  assert.equal(state.fen.split(" ")[0], boardFen(state));
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  const board = state.pieces.filter(piece => piece.zone === "board");
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  for (const piece of state.pieces) {
    if (piece.zone === "board") assert.notEqual(piece.square, null);
    else assert.equal(piece.square, null);
  }
  assert.equal([0, 90, 180, 270].includes(state.orientation), true);
  assert.equal(state.turn.phase, state.turn.moveMade ? "afterMove" : "beforeMove");
  for (const count of Object.values(state.turn.cardPlays)) assert.equal(Number.isInteger(count) && count >= 0 && count <= 1, true);
  const cards = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
};

test("Figure Dance follows a seeded regular move without mutating either input", () => {
  const random = seeded(0x11f1);
  const fresh = createGameState({
    hands: { white: ["figure-dance"] },
    decks: { white: ["pacifism"] },
  });
  const untouchedFresh = structuredClone(fresh);
  const moves = [...legalDests(fresh)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
  const move = moves[Math.floor(random() * moves.length)];
  assert.ok(move);
  const moved = applyAction(fresh, { type: "move", ...move });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.deepEqual(fresh, untouchedFresh);
  const untouchedMoved = structuredClone(moved.state);
  const card = moved.state.players.white.hand[0]!;
  const targets = cardPlayTargets(moved.state, card.cardId);
  const target = targets[Math.floor(random() * targets.length)]!;

  const result = applyAction(moved.state, {
    type: "playCard",
    cardId: card.cardId,
    cardInstanceId: card.id,
    target,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(moved.state, untouchedMoved);
  assert.equal(result.state.turn.phase, "afterMove");
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.history.length, 2);
  assert.equal(result.state.history[0]?.type, "move");
  assert.equal(result.state.history[1]?.type, "cardPlayed");
  assert.equal(result.state.history[1]?.cardId, "figure-dance");
  assert.notEqual(moved.state.fen, fresh.fen);
  assert.notEqual(result.state.fen, moved.state.fen);
  assertValid(result.state);
});

test("Figure Dance permutes identities simultaneously without captures", () => {
  const choices = [
    "r6B/4k3/8/8/8/8/4K3/R6b w - - 0 1",
    "b6R/4k3/8/8/8/8/4K3/B6r w - - 0 1",
  ];
  const pick = Math.floor(seeded(0x11f2)() * choices.length);
  const state = createGameState({
    fen: choices[pick]!,
    phase: "afterMove",
    moveMade: true,
    hands: { white: ["figure-dance"] },
    decks: { white: ["pacifism"] },
  });
  const untouched = structuredClone(state);
  const before = new Map(state.pieces.map(piece => [piece.id, structuredClone(piece)]));
  const destinations = { a8: "a1", h8: "a8", a1: "h1", h1: "h8" } as const;
  const card = state.players.white.hand[0]!;
  const target = cardPlayTargets(state, card.cardId)[0]!;
  const result = applyAction(state, { type: "playCard", cardId: card.cardId, cardInstanceId: card.id, target });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(state, untouched);
  assert.equal(result.state.pieces.length, state.pieces.length);
  for (const piece of result.state.pieces) {
    const prior = before.get(piece.id)!;
    const expectedSquare = prior.square && prior.square in destinations
      ? destinations[prior.square as keyof typeof destinations]
      : prior.square;
    assert.equal(piece.square, expectedSquare);
    assert.deepEqual({ ...piece, square: prior.square }, prior);
  }
  assert.deepEqual(result.state.effects, state.effects);
  assert.deepEqual(result.state.enPassant, state.enPassant);
  assert.equal(result.state.orientation, state.orientation);
  assert.equal(result.state.outcome, state.outcome);
  assert.equal(result.state.players.white.hand.some(candidate => candidate.id === card.id), false);
  assert.equal(result.state.players.white.discard.some(candidate => candidate.id === card.id), true);
  assert.equal(result.state.history.at(-1)?.cardId, "figure-dance");
  assertValid(result.state);
});

test("Figure Dance offers orientation-aware promotions", () => {
  const random = seeded(0x11f3);
  const orientations = [0, 90, 180, 270] as const;
  const roles = ["queen", "rook", "bishop", "knight"] as const;
  const orientation = orientations[Math.floor(random() * orientations.length)]!;
  const role = roles[Math.floor(random() * roles.length)]!;
  const state = createGameState({
    fen: "P6R/4k3/8/8/8/8/4K3/P6Q w - - 0 1",
    phase: "afterMove",
    moveMade: true,
    hands: { white: ["figure-dance"] },
  });
  state.orientation = orientation;
  const transformed = state.pieces.find(piece => piece.square === "h8")!;
  transformed.originalRole = "pawn";
  const promoted = state.pieces.find(piece => piece.square === "h1")!;
  promoted.originalRole = "pawn";
  promoted.promoted = true;
  const untouched = structuredClone(state);
  const before = new Map(state.pieces.map(piece => [piece.id, structuredClone(piece)]));

  const destinations = { a8: "a1", h8: "a8", a1: "h1", h1: "h8" } as const;
  const eligible = state.pieces.filter(piece =>
    piece.square && piece.square in destinations
    && piece.originalRole === "pawn"
    && !piece.promoted
    && isPromotionSquare(state, piece.owner, destinations[piece.square as keyof typeof destinations]),
  );
  const card = state.players.white.hand[0]!;
  const targets = cardPlayTargets(state, card.cardId) as Array<Array<{ square: string; role: typeof role }>>;
  assert.equal(targets.length, 4 ** eligible.length);
  for (const target of targets) {
    assert.deepEqual(new Set(target.map(entry => entry.square)), new Set(eligible.map(piece => destinations[piece.square as keyof typeof destinations])));
  }
  const target = targets.find(candidate => candidate.every(entry => entry.role === role));
  assert.ok(target);
  const result = applyAction(state, { type: "playCard", cardId: card.cardId, cardInstanceId: card.id, target });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(state, untouched);
  const eligibleIds = new Set(eligible.map(piece => piece.id));
  for (const piece of result.state.pieces) {
    const prior = before.get(piece.id)!;
    if (eligibleIds.has(piece.id)) {
      assert.equal(piece.role, role);
      assert.equal(piece.promoted, true);
    } else {
      assert.equal(piece.role, prior.role);
      assert.equal(piece.promoted, prior.promoted);
    }
  }
  assert.deepEqual(
    new Set(result.state.pieces.filter(piece => before.get(piece.id)?.promoted === false && piece.promoted).map(piece => piece.id)),
    eligibleIds,
  );
  assert.equal(result.state.pieces.find(piece => piece.id === promoted.id)!.role, "queen");
  assertValid(result.state);
});

test("Figure Dance fizzles when acting royal safety forbids every result", () => {
  const fixtures = [
    "K7/4k3/8/8/8/8/8/1r6 w - - 0 1",
    "7K/8/8/3k4/r7/8/8/8 w - - 0 1",
  ];
  const fixture = fixtures[Math.floor(seeded(0x11f4)() * fixtures.length)]!;
  const state = createGameState({
    fen: fixture,
    phase: "afterMove",
    moveMade: true,
    hands: { white: ["figure-dance"] },
    decks: { white: ["pacifism"] },
  });
  const untouched = structuredClone(state);
  const card = state.players.white.hand[0]!;
  const target = cardPlayTargets(state, card.cardId)[0]!;
  const result = applyAction(state, { type: "playCard", cardId: card.cardId, cardInstanceId: card.id, target });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(state, untouched);
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.equal(result.state.fen, state.fen);
  assert.equal(result.state.players.white.hand.some(candidate => candidate.id === card.id), false);
  assert.equal(result.state.players.white.discard.some(candidate => candidate.id === card.id), true);
  assert.equal(result.state.turn.cardPlays.white, state.turn.cardPlays.white + 1);
  const event = result.state.history.at(-1);
  assert.equal(event?.type, "cardFizzled");
  assert.equal(event?.cardId, "figure-dance");
  assert.equal(event?.reason, "SELF_CHECK");
  assertValid(result.state);
});

test("Figure Dance survives seeded multi-turn card contexts", () => {
  const random = seeded(0x11f5);
  const contexts = random() < 0.5
    ? ["pacifism", "earthquake"] as const
    : ["earthquake", "pacifism"] as const;

  for (const context of contexts) {
    let state = createGameState({
      hands: { white: [context] },
      decks: { white: ["figure-dance"] },
    });
    const move = () => {
      const choices = [...legalDests(state)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      const choice = choices[Math.floor(random() * choices.length)];
      assert.ok(choice);
      const result = applyAction(state, { type: "move", ...choice });
      assert.equal(result.ok, true);
      if (result.ok) {
        state = result.state;
        assertValid(state);
      }
    };
    const play = (cardId: string) => {
      const card = state.players[state.turn.color].hand.find(candidate => candidate.cardId === cardId);
      assert.ok(card);
      const targets = cardPlayTargets(state, cardId);
      const target = targets[Math.floor(random() * targets.length)];
      assert.notEqual(target, undefined);
      const result = applyAction(state, { type: "playCard", cardId, cardInstanceId: card.id, target });
      assert.equal(result.ok, true);
      if (result.ok) {
        state = result.state;
        assertValid(state);
      }
    };

    if (context === "pacifism") {
      play(context);
      move();
    } else {
      move();
      play(context);
    }
    const contextOrientation = state.orientation;
    let result = applyAction(state, { type: "endTurn" });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    state = result.state;
    assertValid(state);
    move();
    result = applyAction(state, { type: "endTurn" });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    state = result.state;
    assertValid(state);
    move();
    play("figure-dance");

    assert.equal(state.history.at(-1)?.type, "cardPlayed");
    assert.equal(state.history.at(-1)?.cardId, "figure-dance");
    assert.equal(state.history.filter(event => event.type === "cardPlayed").some(event => event.cardId === context), true);
    if (context === "earthquake") assert.equal(state.orientation, contextOrientation);
    else assert.equal(state.effects.some(effect => (effect as { type?: string }).type === "pacifism"), true);
  }
});
