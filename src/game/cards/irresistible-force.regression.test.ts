import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, boardFen, cardPlayTargets, legalDests, positionFor } from "../reducer.js";
import { createGameState } from "../state.js";
import type { BoardOrientation, Color, GameAction, GameState, SquareName } from "../types.js";

const SQUARE = /^[a-h][1-8]$/;

function assertCanonical(state: GameState): Map<SquareName, SquareName[]> {
  const board = state.pieces.filter((piece) => piece.zone === "board");
  const squares = board.map((piece) => piece.square);
  assert.ok(squares.every((square) => typeof square === "string" && SQUARE.test(square)));
  assert.equal(new Set(squares).size, squares.length);
  assert.ok(state.pieces.filter((piece) => piece.zone !== "board").every((piece) => piece.square === null));
  assert.equal(board.filter((piece) => piece.royal && piece.role === "king").length, 2);
  assert.equal(new Set(state.pieces.map((piece) => piece.id)).size, state.pieces.length);
  const cards = (["white", "black"] as const).flatMap((color) => [
    ...state.players[color].hand,
    ...state.players[color].deck,
    ...state.players[color].discard,
  ]);
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
  assert.equal(boardFen(state), state.fen.split(" ")[0]);
  assert.doesNotThrow(() => positionFor(state));
  const dests = legalDests(state);
  for (const [from, targets] of dests) {
    assert.match(from, SQUARE);
    assert.equal(new Set(targets).size, targets.length);
    for (const to of targets) assert.match(to, SQUARE);
  }
  for (const event of state.history) {
    if (event.from) assert.match(event.from, SQUARE);
    if (event.to) assert.match(event.to, SQUARE);
    for (const move of event.movement ?? []) {
      assert.match(move.from, SQUARE);
      assert.match(move.to, SQUARE);
    }
  }
  return dests;
}

function accepted(state: GameState, action: GameAction): readonly [GameState, Map<SquareName, SquareName[]>] {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, true);
  assert.deepEqual(state, before);
  return [result.state, assertCanonical(result.state)];
}

function ordinaryRollout(state: GameState, plies: number, initialSeed: number): GameState {
  let seed = initialSeed >>> 0;
  let dests = assertCanonical(state);
  for (let ply = 0; ply < plies; ply += 1) {
    const moves = [...dests].flatMap(([from, targets]) => targets.map((to) => ({ from, to })));
    assert.ok(moves.length > 0);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = moves[seed % moves.length];
    const mover = state.pieces.find((piece) => piece.zone === "board" && piece.square === move.from)!;
    [state] = accepted(state, {
      type: "move",
      ...move,
      ...((mover.role === "pawn" || (!mover.promoted && mover.originalRole === "pawn")) && /[18]$/.test(move.to)
        ? { promotion: "queen" }
        : {}),
    });
    if (state.outcome) break;
    [state, dests] = accepted(state, { type: "endTurn" });
  }
  return state;
}

test("a long chain captures only its terminal piece and survives a seeded 15-ply rollout", () => {
  const state = createGameState({
    fen: "n6k/r7/b7/q7/P7/8/8/K7 w - - 0 1",
    hands: { white: ["irresistible-force"] },
  });
  const before = structuredClone(state);
  const terminal = state.pieces.find((piece) => piece.square === "a8")!;
  const [pushed] = accepted(state, {
    type: "playCard",
    cardId: "irresistible-force",
    target: [{ from: "a4", to: "a5" }],
  });
  assert.deepEqual(state, before);
  assert.deepEqual(
    pushed.pieces.filter((piece) => piece.zone === "board").map((piece) => piece.square).sort(),
    ["a5", "a6", "a7", "a8", "a1", "h8"].sort(),
  );
  assert.equal(pushed.pieces.find((piece) => piece.id === terminal.id)?.zone, "captured");
  assert.equal(pushed.pieces.find((piece) => piece.id === terminal.id)?.square, null);
  assert.equal(pushed.history.at(-1)?.capturedId, terminal.id);

  const rolled = ordinaryRollout(
    createGameState({ fen: "6nk/8/8/8/8/8/8/KN6 w - - 0 1" }),
    15,
    0x15f0ce,
  );
  assert.equal(rolled.history.filter((event) => event.type === "move").length, 15);
});

test("targets follow owner, orientation, neutrality, and transformed Pawn identity", () => {
  const cases: Array<{
    fen: string;
    turn: Color;
    orientation: BoardOrientation;
    from: SquareName;
    to: SquareName;
    pushedTo: SquareName;
    neutral?: boolean;
    transformed?: boolean;
  }> = [
    { fen: "7k/8/8/8/8/4n3/4P3/K7 w - - 0 1", turn: "white", orientation: 0, from: "e2", to: "e3", pushedTo: "e4" },
    { fen: "7k/8/8/8/3Qn3/8/8/K7 w - - 0 1", turn: "white", orientation: 90, from: "d4", to: "e4", pushedTo: "f4", transformed: true },
    { fen: "7k/8/8/3N4/3p4/8/8/K7 b - - 0 1", turn: "black", orientation: 180, from: "d4", to: "d5", pushedTo: "d6" },
    { fen: "7k/8/8/8/3pN3/8/8/K7 w - - 0 1", turn: "white", orientation: 270, from: "d4", to: "e4", pushedTo: "f4", neutral: true },
  ];

  for (const entry of cases) {
    const state = createGameState({
      fen: entry.fen,
      hands: entry.turn === "white"
        ? { white: ["irresistible-force"] }
        : { black: ["irresistible-force"] },
    });
    state.orientation = entry.orientation;
    const mover = state.pieces.find((piece) => piece.square === entry.from)!;
    if (entry.neutral) mover.neutral = true;
    if (entry.transformed) mover.originalRole = "pawn";
    const before = structuredClone(state);
    const target = [{ from: entry.from, to: entry.to }];

    assert.deepEqual(cardPlayTargets(state, "irresistible-force"), [target]);
    assert.deepEqual(state, before);
    const result = applyAction(state, { type: "playCard", cardId: "irresistible-force", target });
    assert.equal(result.ok, true);
    assert.deepEqual(state, before);
    assert.equal(result.state.pieces.find((piece) => piece.id === mover.id)?.square, entry.to);
    assert.ok(result.state.pieces.some((piece) => piece.square === entry.pushedTo));
    assertCanonical(result.state);
  }
});

test("29 seeded malformed, stale, and unsafe plays reject atomically", () => {
  const chain = () => createGameState({
    fen: "7k/8/8/8/4n3/4r3/4P3/K7 w - - 0 1",
    hands: { white: ["irresistible-force"] },
  });
  const edge = () => createGameState({
    fen: "n6k/r7/P7/8/8/8/8/K7 w - - 0 1",
    hands: { white: ["irresistible-force"] },
  });
  const play = (target: unknown, state = chain(), cardId = "irresistible-force", cardInstanceId?: unknown) =>
    [state, { type: "playCard", cardId, target, ...(cardInstanceId === undefined ? {} : { cardInstanceId }) } as GameAction] as const;
  const move = [{ from: "e2", to: "e3" }];
  const edgeMove = [{ from: "a6", to: "a7" }];
  const attempts: Array<() => readonly [GameState, GameAction]> = [
    ...[undefined, null, {}, [], [null], ["e2"], [{ from: "e2" }], [{ to: "e3" }], [{ from: "z9", to: "e3" }], [{ from: "e2", to: "z9" }]]
      .map((target) => () => play(target)),
    () => play([move[0], move[0]]),
    () => play([{ ...move[0], extra: true }]),
    () => {
      const target = [...move] as unknown[] & { extra?: boolean };
      target.extra = true;
      return play(target);
    },
    () => play([Object.assign(Object.create(null), move[0])]),
    () => play([{ from: "a2", to: "a3" }]),
    () => play([{ from: "e3", to: "e4" }]),
    () => play([{ from: "e2", to: "e4" }]),
    () => play([{ from: "e2", to: "d3" }]),
    () => play(move, chain(), "irresistible-force", "stale-card-instance"),
    () => play(move, chain(), "irresistible-force-stale"),
    () => play(move, createGameState({ fen: "8/8/8/8/8/4k3/4P3/K7 w - - 0 1", hands: { white: ["irresistible-force"] } })),
    () => play(move, createGameState({ fen: "8/8/8/4k3/4n3/4r3/4P3/K7 w - - 0 1", hands: { white: ["irresistible-force"] } })),
    () => {
      const state = edge();
      const terminal = state.pieces.find((piece) => piece.square === "a8")!;
      state.effects.push({ type: "pacifism", owner: "black", card: { id: "pac", cardId: "pacifism" }, pieceId: terminal.id });
      return play(edgeMove, state);
    },
    () => {
      const state = edge();
      state.effects.push({ type: "pacifism", target: "a8", active: true });
      return play(edgeMove, state);
    },
    () => {
      const state = edge();
      state.effects.push({ type: "truce", owner: "black", card: { id: "truce", cardId: "truce" } });
      return play(edgeMove, state);
    },
    () => {
      const state = edge();
      Object.assign(state.pieces.find((piece) => piece.square === "a8")!, { captureImmune: true });
      return play(edgeMove, state);
    },
    () => {
      const state = edge();
      Object.assign(state.pieces.find((piece) => piece.square === "a8")!, { mysticShield: true });
      return play(edgeMove, state);
    },
    () => {
      const state = edge();
      const terminal = state.pieces.find((piece) => piece.square === "a8")!;
      state.effects.push({ type: "mystic-shield", card: { id: "shield", cardId: "mystic-shield" }, pieceId: terminal.id });
      return play(edgeMove, state);
    },
    () => {
      const state = edge();
      Object.assign(state.pieces.find((piece) => piece.square === "a6")!, { pacifist: true });
      return play(edgeMove, state);
    },
  ];
  assert.equal(attempts.length, 29);
  let seed = 0x1f0ace;
  for (let index = attempts.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swap = seed % (index + 1);
    [attempts[index], attempts[swap]] = [attempts[swap], attempts[index]];
  }

  for (const build of attempts) {
    const [state, action] = build();
    const before = structuredClone(state);
    assertCanonical(state);
    const result = applyAction(state, action);
    assert.equal(result.ok, false);
    assert.strictEqual(result.state, state);
    assert.deepEqual(result.state, before);
    assertCanonical(result.state);
  }
});

test("Pacifism, Truce, Forbidden City, Earthquake, Crab, and Confabulation interact safely", () => {
  const rejectForce = (state: GameState, from: SquareName, to: SquareName) => {
    const before = structuredClone(state);
    assertCanonical(state);
    const result = applyAction(state, {
      type: "playCard",
      cardId: "irresistible-force",
      target: [{ from, to }],
    });
    assert.equal(result.ok, false);
    assert.strictEqual(result.state, state);
    assert.deepEqual(state, before);
    assertCanonical(state);
  };

  let pacifism = createGameState({
    fen: "n6k/r7/P7/8/8/8/8/7K b - - 0 1",
    hands: { white: ["irresistible-force"], black: ["pacifism"] },
  });
  [pacifism] = accepted(pacifism, { type: "playCard", cardId: "pacifism", target: "a8" });
  [pacifism] = accepted(pacifism, { type: "move", from: "h8", to: "g8" });
  [pacifism] = accepted(pacifism, { type: "endTurn" });
  rejectForce(pacifism, "a6", "a7");

  const truce = createGameState({
    fen: "n6k/r7/P7/8/8/8/8/K7 w - - 0 1",
    hands: { white: ["irresistible-force"] },
  });
  truce.effects.push({ type: "truce", owner: "black", card: { id: "truce-effect", cardId: "truce" } });
  rejectForce(truce, "a6", "a7");

  let city = createGameState({
    fen: "7k/8/8/8/4n3/4r3/4P3/K7 b - - 0 1",
    hands: { white: ["irresistible-force"], black: ["forbidden-city"] },
  });
  [city] = accepted(city, { type: "move", from: "h8", to: "g8" });
  [city] = accepted(city, { type: "playCard", cardId: "forbidden-city", target: "e5" });
  [city] = accepted(city, { type: "endTurn" });
  // Official FAQ 1354–1362 overrides the old no-spend rejection expectation.
  const cityBefore = structuredClone(city);
  const [blocked] = accepted(city, { type: "playCard", cardId: "irresistible-force", target: [{ from: "e2", to: "e3" }] });
  assert.deepEqual(blocked.pieces, cityBefore.pieces);
  assert.deepEqual(blocked.effects, cityBefore.effects);
  assert.deepEqual(blocked.players.white.discard, cityBefore.players.white.hand);
  assert.equal(blocked.turn.cardPlays.white, 1);
  assert.equal(blocked.turn.moveMade, true);
  assert.equal(blocked.history.at(-1)?.type, "cardFizzled");
  assert.deepEqual(city, cityBefore);

  let earthquake = createGameState({
    fen: "6nk/8/8/8/2Np4/8/8/KN6 w - - 0 1",
    hands: { white: ["earthquake"], black: ["irresistible-force"] },
  });
  [earthquake] = accepted(earthquake, { type: "move", from: "b1", to: "a3" });
  [earthquake] = accepted(earthquake, {
    type: "playCard",
    cardId: "earthquake",
    target: { direction: "counterclockwise", promotions: [] },
  });
  [earthquake] = accepted(earthquake, { type: "endTurn" });
  [earthquake] = accepted(earthquake, {
    type: "playCard",
    cardId: "irresistible-force",
    target: [{ from: "d4", to: "c4" }],
  });
  assert.ok(earthquake.pieces.some((piece) => piece.square === "b4"));

  let crab = createGameState({
    fen: "6nk/8/8/8/8/3r4/3P4/KN6 w - - 0 1",
    hands: { white: ["crab", "irresistible-force"] },
  });
  [crab] = accepted(crab, { type: "move", from: "b1", to: "a3" });
  [crab] = accepted(crab, { type: "playCard", cardId: "crab", target: "d2" });
  [crab] = accepted(crab, { type: "endTurn" });
  [crab] = accepted(crab, { type: "move", from: "g8", to: "h6" });
  [crab] = accepted(crab, { type: "endTurn" });
  [crab] = accepted(crab, {
    type: "playCard",
    cardId: "irresistible-force",
    target: [{ from: "d2", to: "d3" }],
  });
  assert.ok(crab.effects.some((effect) => (effect as { type?: unknown }).type === "crab"));

  let confabulation = createGameState({
    fen: "6nk/8/8/8/8/3r4/3P4/KN6 w - - 0 1",
    hands: { white: ["confabulation", "irresistible-force"] },
  });
  [confabulation] = accepted(confabulation, {
    type: "playCard",
    cardId: "confabulation",
    target: [{ from: "b1", to: "d2" }],
  });
  [confabulation] = accepted(confabulation, { type: "endTurn" });
  [confabulation] = accepted(confabulation, { type: "move", from: "g8", to: "h6" });
  [confabulation] = accepted(confabulation, { type: "endTurn" });
  [confabulation] = accepted(confabulation, {
    type: "playCard",
    cardId: "irresistible-force",
    target: [{ from: "d2", to: "d3" }],
  });
  assert.ok(confabulation.effects.some((effect) => (effect as { type?: unknown }).type === "confabulation"));
});

test("capture history and card lifecycle stay canonical across reactive-card boundaries", () => {
  const state = createGameState({
    fen: "p6k/r7/b7/q7/P7/8/8/K7 w - - 0 1",
    hands: { white: ["irresistible-force"], black: ["toll", "revenge"] },
    decks: { white: ["no-quarter"] },
  });
  const before = structuredClone(state);
  const spentId = state.players.white.hand[0].id;
  const terminal = state.pieces.find((piece) => piece.square === "a8")!;
  const [resolved] = accepted(state, {
    type: "playCard",
    cardId: "irresistible-force",
    target: [{ from: "a4", to: "a5" }],
  });

  assert.deepEqual(state, before);
  assert.equal(resolved.pieces.find((piece) => piece.id === terminal.id)?.zone, "captured");
  assert.deepEqual(resolved.players.white.hand.map((card) => card.cardId), ["no-quarter"]);
  assert.deepEqual(resolved.players.white.discard.map((card) => card.id), [spentId]);
  const event = resolved.history.at(-1)!;
  assert.equal(event.cardId, "irresistible-force");
  assert.equal(event.capturedId, terminal.id);
  assert.deepEqual(new Set(event.movement?.map((move) => `${move.from}-${move.to}`)), new Set([
    "a4-a5",
    "a5-a6",
    "a6-a7",
    "a7-a8",
  ]));
  assert.ok(!resolved.effects.some((effect) => (effect as { type?: unknown }).type === "irresistible-force"));
  assertCanonical(resolved);
});
