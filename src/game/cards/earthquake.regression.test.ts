import { test } from "node:test";
import assert from "node:assert/strict";
import { createGameState } from "../state.js";
import { applyAction, boardFen, cardPlayTargets, isPromotionSquare, legalDests } from "../reducer.js";
import type { EarthquakeTarget, GameAction, GameState, SquareName } from "../types.js";

const seeds = [0xea7, 0x90, 0x180, 0x270, 0xfa71c];
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const canonical = /^[a-h][1-8]$/;

function validate(after: GameState) {
  const ids = new Set<string>();
  const squares = new Set<string>();
  for (const piece of after.pieces) {
    assert(!ids.has(piece.id), `duplicate piece id ${piece.id}`);
    ids.add(piece.id);
    if (piece.zone === "board") {
      assert(piece.square, `board piece ${piece.id} has no square`);
      assert.match(piece.square, canonical);
      assert(!squares.has(piece.square), `duplicate occupied square ${piece.square}`);
      squares.add(piece.square);
    } else assert.equal(piece.square, null, `off-board piece ${piece.id} has a square`);
  }
  assert([0, 90, 180, 270].includes(after.orientation));
  const fields = after.fen.split(" ");
  assert.equal(fields.length, 6);
  assert.equal(boardFen(after), fields[0]);
  const fenColor = after.turn.moveMade ? (after.turn.color === "white" ? "b" : "w") :
    (after.turn.color === "white" ? "w" : "b");
  assert.equal(fields[1], fenColor);
  assert(Number.isInteger(Number(fields[4])) && Number(fields[4]) >= 0);
  assert(Number.isInteger(Number(fields[5])) && Number(fields[5]) > 0);
  for (const opportunity of after.enPassant) {
    assert.match(opportunity.target, canonical);
    assert(!squares.has(opportunity.target), `occupied en-passant target ${opportunity.target}`);
    const pawn = after.pieces.find(piece => piece.id === opportunity.pawnId);
    assert(pawn && pawn.zone === "board" && pawn.square && pawn.originalRole === "pawn" && !pawn.promoted,
      `invalid en-passant pawn ${opportunity.pawnId}`);
  }
  for (const [source, destinations] of legalDests(after)) {
    assert.match(source, canonical);
    const piece = after.pieces.find(candidate => candidate.zone === "board" && candidate.square === source);
    assert(piece, `legal source ${source} has no live piece`);
    const unique = new Set(destinations);
    assert.equal(unique.size, destinations.length, `duplicate legal destination from ${source}`);
    for (const destination of destinations) assert.match(destination, canonical);
  }
}

function play(state: GameState, action: GameAction) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(result.error.message);
  const next = result.state;
  validate(next);
  assert.deepEqual(state, before);
  return next;
}

function earthquakeTargets(state: GameState): EarthquakeTarget[] {
  return cardPlayTargets(state, "earthquake").map(target => {
    assert(target && typeof target === "object" && "direction" in target && "promotions" in target);
    return target as EarthquakeTarget;
  });
}

function pick<T>(values: T[], random: () => number): T {
  assert(values.length);
  return values[Math.floor(random() * values.length)];
}

function ready(fen: string, color: "white" | "black", cards: string[]): GameState {
  const state = createGameState({
    fen,
    turn: color,
    phase: "afterMove",
    moveMade: true,
    hands: { [color]: cards },
  });
  const fields = state.fen.split(" ");
  fields[1] = color === "white" ? "b" : "w";
  state.fen = fields.join(" ");
  return state;
}

function sampleMove(state: GameState, random: () => number): GameState {
  const choices = [...legalDests(state)].flatMap(([from, destinations]) =>
    state.pieces.some(piece => piece.zone === "board" && piece.square === from &&
      piece.originalRole === "pawn" && !piece.promoted)
      ? destinations.map(to => ({ from, to }))
      : []);
  const move = pick(choices, random);
  const piece = state.pieces.find(candidate => candidate.zone === "board" && candidate.square === move.from);
  assert(piece);
  return play(state, {
    type: "move",
    ...move,
    ...(piece.originalRole === "pawn" && !piece.promoted && isPromotionSquare(state, piece.owner, move.to)
      ? { promotion: "queen" }
      : {}),
  });
}

test("seeded Earthquakes rotate every starting orientation by exactly 90 degrees", () => {
  const fen = "4k3/8/8/8/3P4/8/8/4K3 w - - 7 12";
  for (const [index, orientation] of ([0, 90, 180, 270] as const).entries()) {
    const state = ready(fen, "white", ["earthquake"]);
    state.orientation = orientation;
    const pieces = state.pieces.map(piece => [piece.id, piece.square] as const);
    const target = pick(earthquakeTargets(state), rng(seeds[index]));
    const next = play(state, { type: "playCard", cardId: "earthquake", target });
    const delta = target.direction === "clockwise" ? 270 : 90;
    assert.equal(next.orientation, (orientation + delta) % 360);
    assert.deepEqual(next.pieces.map(piece => [piece.id, piece.square] as const), pieces);
  }
});

test("seeded rotated Pawns expose and execute a legal move", () => {
  const random = rng(seeds[1]);
  let state = ready("4k3/8/5p2/8/8/1P6/8/4K3 w - - 7 12", "white", ["earthquake"]);
  const target = pick(earthquakeTargets(state), random);
  state = play(state, { type: "playCard", cardId: "earthquake", target });
  const movable = structuredClone(state);
  movable.turn.phase = "beforeMove";
  movable.turn.moveMade = false;
  assert([...legalDests(movable)].some(([source, destinations]) =>
    destinations.length > 0 && movable.pieces.some(piece => piece.square === source && piece.role === "pawn")));
  state = sampleMove(movable, random);
  validate(state);
});

test("black Earthquake promotes opponent before actor using the enumerated roles", () => {
  const state = ready("4k3/8/8/8/p6P/8/8/4K3 b - - 7 12", "black", ["earthquake"]);
  const counterclockwise = earthquakeTargets(state).filter(target => target.direction === "counterclockwise");
  const target = pick(counterclockwise, rng(seeds[2]));
  assert.deepEqual(target.promotions.map(promotion => promotion.square), ["h4", "a4"]);
  const next = play(state, { type: "playCard", cardId: "earthquake", target });
  for (const promotion of target.promotions) {
    const pawn = next.pieces.find(piece => piece.square === promotion.square);
    assert.equal(pawn?.role, promotion.role);
    assert.equal(pawn?.promoted, true);
  }

  const sparseState = ready("4k3/8/8/8/p6P/8/8/4K3 b - - 7 12", "black", ["earthquake"]);
  const sparsePromotions = Array<EarthquakeTarget["promotions"][number]>(target.promotions.length);
  for (const [index, promotion] of target.promotions.entries()) {
    if (index !== 0) sparsePromotions[index] = promotion;
  }
  const sparseTarget = { ...target, promotions: sparsePromotions };
  const sparseBefore = structuredClone(sparseState);
  const sparseAction = { type: "playCard", cardId: "earthquake", target: sparseTarget } as const;
  const sparseActionBefore = structuredClone(sparseAction);
  let sparseResult: ReturnType<typeof applyAction> | undefined;
  assert.doesNotThrow(() => { sparseResult = applyAction(sparseState, sparseAction); });
  assert(sparseResult);
  assert.equal(sparseResult.ok, false);
  if (!sparseResult.ok) assert.equal(sparseResult.error.code, "INVALID_TARGET");
  assert.deepEqual(sparseState, sparseBefore);
  assert.deepEqual(sparseAction, sparseActionBefore);
});

test("Fanatic, turn change, black move, and seeded Earthquake preserve history and FEN", () => {
  const random = rng(seeds[3]);
  let state = createGameState({
    fen: "4k3/3p4/8/8/8/8/1P6/4K3 w - - 0 1",
    hands: { white: ["fanatic"], black: ["earthquake"] },
  });
  state = play(state, { type: "playCard", cardId: "fanatic", target: "b2" });
  assert.equal(state.history.at(-1)?.cardId, "fanatic");
  state = play(state, { type: "endTurn" });
  state = play(state, { type: "move", from: "d7", to: "d6" });
  assert.equal(state.history.at(-1)?.type, "move");
  state = play(state, { type: "playCard", cardId: "earthquake", target: pick(earthquakeTargets(state), random) });
  assert.equal(state.history.at(-1)?.cardId, "earthquake");
  assert.equal(boardFen(state), state.fen.split(" ")[0]);
});

test("inverse Earthquakes restore orientation without disturbing existing effects or history", () => {
  const random = rng(seeds[4]);
  let state = ready("4k3/8/8/8/3P4/8/8/4K3 w - - 7 12", "white", ["earthquake", "earthquake"]);
  const doomsayer = { type: "doomsayer", owner: "black", card: { id: "old-doomsayer", cardId: "doomsayer" } };
  const vendetta = { type: "vendetta", owner: "black", card: { id: "old-vendetta", cardId: "vendetta" } };
  state.effects.push(doomsayer, vendetta);
  state.history.push({ type: "cardPlayed", cardId: "doomsayer" }, { type: "cardPlayed", cardId: "vendetta" });
  const oldHistory = structuredClone(state.history);
  const first = pick(earthquakeTargets(state), random);
  state = play(state, { type: "playCard", cardId: "earthquake", target: first });
  state.turn.cardPlays.white = 0;
  const inverse = first.direction === "clockwise" ? "counterclockwise" : "clockwise";
  const second = pick(earthquakeTargets(state).filter(target => target.direction === inverse), random);
  state = play(state, { type: "playCard", cardId: "earthquake", target: second });
  assert.equal(state.orientation, 0);
  assert.deepEqual(state.effects.slice(0, 2), [doomsayer, vendetta]);
  assert.deepEqual(state.history.slice(0, oldHistory.length), oldHistory);
  assert.equal(state.effects.filter(effect =>
    typeof effect === "object" && effect !== null && "type" in effect && effect.type === "earthquake").length, 2);
  validate(state);
});
