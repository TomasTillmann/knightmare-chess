import assert from "node:assert/strict";
import { it } from "node:test";

import { applyAction, cardPlayTargets, isKingInCheck, legalDests, positionFor } from "../reducer.js";
import { createGameState } from "../state.js";
import type { GameAction, GameState, PieceState } from "../types.js";

const square = /^[a-h][1-8]$/;
let transitions = 0;

const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0);
const pick = <T>(random: () => number, values: readonly T[]) => values[random() % values.length];
const boardPiece = (state: GameState, name: string) => state.pieces.find(piece => piece.square === name)!;
const confabulations = (state: GameState) => state.effects.filter((effect): effect is {
  type: "confabulation";
  owner: "white" | "black";
  card: { id: string; cardId: string };
  pieceIds: [string, string];
} => {
  const value = effect as Record<string, unknown>;
  return value?.type === "confabulation";
});

function assertState(state: GameState): void {
  const squares = new Set<string>();
  for (const piece of state.pieces) {
    if (piece.zone === "board") {
      assert.match(piece.square ?? "", square);
      assert(!squares.has(piece.square!), `duplicate board square ${piece.square}`);
      squares.add(piece.square!);
    } else assert.equal(piece.square, null);
  }
  if (!state.outcome) {
    for (const color of ["white", "black"] as const) {
      assert(state.pieces.some(piece => piece.owner === color && piece.royal));
    }
  }
  assert.doesNotThrow(() => positionFor(state));
  for (const [from, dests] of legalDests(state)) {
    assert(state.pieces.some(piece => piece.zone === "board" && piece.square === from));
    for (const to of dests) assert.match(to, square);
  }
  for (const effect of confabulations(state)) {
    const [carrierId, partnerId] = effect.pieceIds;
    assert.notEqual(carrierId, partnerId);
    const carrier = state.pieces.find(piece => piece.id === carrierId);
    const partner = state.pieces.find(piece => piece.id === partnerId);
    assert(carrier && partner);
    assert.notEqual(carrier.role, "king");
    assert.notEqual(partner.role, "king");
    assert.equal(carrier.zone, "board");
    assert.match(carrier.square ?? "", square);
    assert.equal(partner.zone, "away");
    assert.equal(partner.square, null);
    assert.equal(carrier.owner, effect.owner);
    assert.equal(partner.owner, effect.owner);
    assert.equal(effect.card.cardId, "confabulation");
    assert(!state.players[effect.owner].hand.some(card => card.id === effect.card.id));
    assert(!state.players[effect.owner].discard.some(card => card.id === effect.card.id));
    for (const component of [carrier, partner]) {
      if (component.originalRole === "pawn") assert.equal(component.promoted, false);
    }
  }
}

function apply(state: GameState, action: GameAction) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, "actions must not mutate their input");
  transitions += 1;
  assertState(result.state);
  return result;
}

function finish(state: GameState): GameState {
  const result = apply(state, { type: "endTurn" });
  assert(result.ok, result.ok ? "" : result.error.message);
  return result.state;
}

function legalMoves(state: GameState): Array<{ from: string; to: string }> {
  return [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => ({ from, to })));
}

function moveRandomly(state: GameState, random: () => number): GameState {
  const moves = legalMoves(state);
  assert(moves.length, "expected a legal move");
  const result = apply(state, { type: "move", ...pick(random, moves) });
  assert(result.ok, result.ok ? "" : result.error.message);
  return finish(result.state);
}

function play(state: GameState, cardId: string, random: () => number): GameState | undefined {
  if (!state.players[state.turn.color].hand.some(card => card.cardId === cardId)) return undefined;
  const targets = cardPlayTargets(state, cardId);
  if (!targets.length) return undefined;
  const result = apply(state, { type: "playCard", cardId, target: pick(random, targets) });
  return result.ok ? result.state : undefined;
}

function merge(state: GameState, from: string, to: string): GameState {
  const result = apply(state, { type: "playCard", cardId: "confabulation", target: [{ from, to }] });
  assert(result.ok, result.ok ? "" : result.error.message);
  assert.equal(confabulations(result.state).length, 1);
  return result.state;
}

it("keeps a rook-knight Confabulation composite coherent through seeded moves", () => {
  const random = seeded(1);
  let state = merge(createGameState({
    fen: "4k3/8/8/8/8/8/4K3/1N5R w - - 0 1",
    hands: { white: ["confabulation"] },
  }), "h1", "b1");
  state = finish(state);
  state = moveRandomly(state, random);
  for (const to of ["b4", "c6"]) {
    const from = boardPiece(state, state.pieces.find(piece => piece.id === confabulations(state)[0].pieceIds[0])!.square!).square!;
    const result = apply(state, { type: "move", from, to });
    assert(result.ok, result.ok ? "" : result.error.message);
    state = finish(result.state);
    state = moveRandomly(state, random);
  }
  for (let ply = 0; ply < 20 && !state.outcome; ply += 1) {
    void isKingInCheck(state, state.turn.color);
    state = moveRandomly(state, random);
  }
});

it("keeps an edge rook-pawn composite unpromoted through seeded public plays", () => {
  const random = seeded(2);
  let state = merge(createGameState({
    fen: "4k3/8/8/8/8/8/4K3/P6R w - - 0 1",
    hands: { white: ["confabulation", "earthquake"], black: ["earthquake"] },
  }), "h1", "a1");
  state = finish(state);
  let publicPlays = 0;
  for (let ply = 0; ply < 22 && !state.outcome; ply += 1) {
    const moved = legalMoves(state);
    assert(moved.length);
    const result = apply(state, { type: "move", ...pick(random, moved) });
    assert(result.ok, result.ok ? "" : result.error.message);
    state = result.state;
    const earthquake = play(state, "earthquake", random);
    if (earthquake) {
      state = earthquake;
      publicPlays += 1;
    }
    state = finish(state);
  }
  assert(publicPlays > 0);
  for (const piece of state.pieces.filter(piece => piece.originalRole === "pawn")) assert.equal(piece.promoted, false);
});

it("does not split a black reverse-carrier composite under role-targeting cards", () => {
  const random = seeded(3);
  let state = merge(createGameState({
    fen: "1n5r/4k3/8/8/8/8/8/4K3 b - - 0 1",
    hands: {
      black: ["confabulation", "long-jump", "heresy", "rebirth", "holy-war"],
      white: ["heresy", "rebirth", "holy-war"],
    },
    turn: "black",
  }), "h8", "b8");
  state = finish(state);
  let rolePlays = 0;
  for (let ply = 0; ply < 24 && !state.outcome; ply += 1) {
    const beforeMove = play(state, "long-jump", random);
    if (beforeMove) {
      state = finish(beforeMove);
      rolePlays += 1;
    } else {
      const moved = apply(state, { type: "move", ...pick(random, legalMoves(state)) });
      assert(moved.ok, moved.ok ? "" : moved.error.message);
      state = moved.state;
      for (const cardId of ["heresy", "rebirth", "holy-war"]) {
        const next = play(state, cardId, random);
        if (next) {
          state = next;
          rolePlays += 1;
          break;
        }
      }
      state = finish(state);
    }
    assert.equal(confabulations(state).length, 1);
  }
  assert(rolePlays > 0);
});

it("cleans up a composite and its continuing card after capture pressure", () => {
  const random = seeded(4);
  let state = merge(createGameState({
    fen: "1r2k3/8/8/8/8/8/4K3/1N5R w - - 0 1",
    hands: { white: ["confabulation"] },
  }), "h1", "b1");
  const effect = confabulations(state)[0];
  state = finish(state);
  const pressure = legalMoves(state).filter(move => move.to === "b1");
  const result = apply(state, { type: "move", ...pick(random, pressure) });
  assert(result.ok, result.ok ? "" : result.error.message);
  state = finish(result.state);
  assert.equal(confabulations(state).length, 0);
  const components = effect.pieceIds.map(id => state.pieces.find(piece => piece.id === id) as PieceState);
  assert(components.every(piece => piece.square === null && piece.zone === "captured"));
  assert(state.players[effect.owner].discard.some(card => card.id === effect.card.id));
});

it("rejects malformed Confabulation payloads atomically across seeded rollouts", () => {
  for (const seed of [5, 17, 29, 41]) {
    const random = seeded(seed);
    let state = createGameState({
      fen: "4k3/8/8/8/8/8/4K3/1N5R w - - 0 1",
      hands: { white: ["confabulation", "forbidden-city"], black: ["forbidden-city"] },
    });
    const malformed = [{ from: "h1", to: "b1", extra: true }];
    const first = apply(state, { type: "playCard", cardId: "confabulation", target: malformed });
    const second = apply(structuredClone(state), { type: "playCard", cardId: "confabulation", target: malformed });
    assert(!first.ok && !second.ok);
    assert.deepEqual(first, second);
    state = merge(state, "h1", "b1");
    state = finish(state);
    for (let ply = 0; ply < 12 && !state.outcome; ply += 1) {
      const moved = apply(state, { type: "move", ...pick(random, legalMoves(state)) });
      assert(moved.ok, moved.ok ? "" : moved.error.message);
      state = moved.state;
      const city = play(state, "forbidden-city", random);
      state = finish(city ?? state);
    }
  }
  assert(transitions >= 100, `expected 100 transitions, saw ${transitions}`);
});
