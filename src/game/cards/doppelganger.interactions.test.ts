import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, isKingInCheck } from "../reducer.js";
import { createGameState } from "../state.js";
import type { GameAction, GameState } from "../types.js";

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? "expected action to succeed" : `${result.error.code}: ${result.error.message}`);
  return result.state;
}

function assertValid(state: GameState): void {
  const occupied = state.pieces.filter(piece => piece.zone === "board");
  assert.equal(new Set(occupied.map(piece => piece.square)).size, occupied.length);
  for (const piece of state.pieces) assert.equal(piece.square !== null, piece.zone === "board");
}

function reject(state: GameState, action: GameAction): void {
  const snapshot = JSON.stringify(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(state), snapshot);
}

const pawnCopyFixtures = [
  { name: "white knight", fen: "6k1/7p/8/8/3N4/8/8/K7 b - - 7 1", color: "white", pawnFrom: "h7", pawnTo: "h6", from: "d4", to: "d5" },
  { name: "black knight", fen: "k7/8/8/3n4/8/8/7P/6K1 w - - 7 1", color: "black", pawnFrom: "h2", pawnTo: "h3", from: "d5", to: "d4" },
  { name: "white last-rank knight", fen: "6k1/3N3p/8/8/8/8/8/K7 b - - 7 1", color: "white", pawnFrom: "h7", pawnTo: "h6", from: "d7", to: "d8" },
  { name: "white double-step knight", fen: "6k1/7p/8/8/8/8/3N4/K7 b - - 7 1", color: "white", pawnFrom: "h7", pawnTo: "h6", from: "d2", to: "d4" },
  { name: "black double-step bishop", fen: "k7/3b4/8/8/8/8/7P/6K1 w - - 7 1", color: "black", pawnFrom: "h2", pawnTo: "h3", from: "d7", to: "d5" },
] as const;

for (const fixture of pawnCopyFixtures) {
  for (const invariant of ["identity", "pawn status", "turn accounting"] as const) {
    test(`Doppelganger copying a Pawn preserves ${invariant}: ${fixture.name}`, () => {
      let state = createGameState({ fen: fixture.fen, hands: { white: fixture.color === "white" ? ["doppelganger"] : [], black: fixture.color === "black" ? ["doppelganger"] : [] }, decks: { white: [], black: [] } });
      assert.equal(isKingInCheck(state, "white"), false, "white fixture king starts safe");
      assert.equal(isKingInCheck(state, "black"), false, "black fixture king starts safe");
      state = apply(state, { type: "move", from: fixture.pawnFrom, to: fixture.pawnTo });
      state = apply(state, { type: "endTurn" });
      const before = state;
      const actor = state.pieces.find(piece => piece.square === fixture.from)!;
      assert.ok(actor);
      state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: fixture.from, to: fixture.to }] });
      if (invariant === "identity") {
        assert.deepEqual(state.pieces.find(piece => piece.id === actor.id), { ...actor, square: fixture.to });
        assert.equal(state.pieces.length, before.pieces.length);
        assertValid(state);
      } else if (invariant === "pawn status") {
        assert.equal(state.pieces.find(piece => piece.id === actor.id)?.role, actor.role);
        assert.deepEqual(state.enPassant, []);
        assert.equal(state.history.at(-1)?.promotion, undefined);
      } else {
        assert.equal(state.players[fixture.color].hand.length, 0);
        assert.equal(state.players[fixture.color].discard.length, 1);
        assert.equal(state.turn.cardPlays[fixture.color], 1);
        assert.equal(state.turn.moveMade, true);
        assert.equal(state.turn.color, fixture.color);
        assert.equal(Number(state.fen.split(" ")[4]), Number(before.fen.split(" ")[4]) + 1);
      }
    });
  }
}

test("Doppelganger copies Dubbing's rook base role after a knight move", () => {
  let state = createGameState({
    fen: "4k2r/8/8/8/8/8/8/R3K3 b - - 0 1",
    hands: { white: ["doppelganger"], black: ["dubbing"] },
    decks: { white: [], black: [] },
  });
  state = apply(state, { type: "playCard", cardId: "dubbing", target: [{ from: "h8", to: "f7" }] });
  state = apply(state, { type: "endTurn" });
  state = apply(state, {
    type: "playCard",
    cardId: "doppelganger",
    target: [{ from: "a1", to: "a3" }],
  });

  assert.equal(state.pieces.find(piece => piece.square === "a3")?.role, "rook");
  assert.equal(state.pieces.some(piece => piece.square === "a1"), false);
  assertValid(state);

  let rejected = createGameState({
    fen: "4k2r/8/8/8/8/8/8/R3K3 b - - 0 1",
    hands: { white: ["doppelganger"], black: ["dubbing"] },
    decks: { white: [], black: [] },
  });
  rejected = apply(rejected, { type: "playCard", cardId: "dubbing", target: [{ from: "h8", to: "f7" }] });
  rejected = apply(rejected, { type: "endTurn" });
  reject(rejected, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "b3" }] });
  assertValid(rejected);
});

test("Doppelganger copies Long Jump geometry", () => {
  let state = createGameState({
    fen: "1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1",
    hands: { white: ["doppelganger"], black: ["long-jump"] },
    decks: { white: [], black: [] },
  });
  state = apply(state, { type: "playCard", cardId: "long-jump", target: [{ from: "b8", to: "d7" }] });
  state = apply(state, { type: "endTurn" });
  state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "c2" }] });
  assert.equal(state.pieces.find(piece => piece.square === "c2")?.role, "rook");
  assertValid(state);
});

test("Doppelganger works symmetrically for black", () => {
  let state = createGameState({
    fen: "4k2r/8/8/8/8/8/8/1N2K3 w - - 0 1",
    hands: { white: ["long-jump"], black: ["doppelganger"] },
    decks: { white: [], black: [] },
  });
  state = apply(state, { type: "playCard", cardId: "long-jump", target: [{ from: "b1", to: "d2" }] });
  state = apply(state, { type: "endTurn" });
  state = { ...state, orientation: 90 };
  state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "h8", to: "f7" }] });
  assert.equal(state.pieces.find(piece => piece.square === "f7")?.role, "rook");
  assertValid(state);
});

test("Doppelganger rejects Madman movement by a base pawn", () => {
  let state = createGameState({
    fen: "4k3/8/8/8/3R4/2p5/8/R3K3 b - - 0 1",
    hands: { white: ["doppelganger"], black: ["madman"] },
    decks: { white: [], black: [] },
  });
  state = apply(state, { type: "playCard", cardId: "madman", target: [{ from: "c3", to: "e5" }] });
  state = apply(state, { type: "endTurn" });
  reject(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "c3" }] });
  assertValid(state);
});

test("Doppelganger rejects Holy War's two-piece movement", () => {
  let state = createGameState({
    fen: "1nb1k3/8/8/8/8/8/8/R3K3 b - - 0 1",
    hands: { white: ["doppelganger"], black: ["holy-war"] },
    decks: { white: [], black: [] },
  });
  state = apply(state, { type: "move", from: "e8", to: "e7" });
  state = apply(state, { type: "playCard", cardId: "holy-war", target: { knight: "b8", bishop: "c8" } });
  state = apply(state, { type: "endTurn" });
  reject(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "b2" }] });
  assertValid(state);
});

test("Doppelganger preserves a Pacifist rook's identity and marker", () => {
  let state = createGameState({
    fen: "1b2k3/8/8/8/8/8/8/R3K3 w - - 0 1",
    hands: { white: ["pacifism", "doppelganger"], black: [] },
    decks: { white: [], black: [] },
  });
  state = apply(state, { type: "playCard", cardId: "pacifism", target: "a1" });
  const rook = state.pieces.find(piece => piece.square === "a1");
  assert.ok(rook);
  const effect = state.effects.find(value => (value as { type?: string }).type === "pacifism") as { pieceId: string };
  assert.equal(effect.pieceId, rook.id);
  state = apply(state, { type: "move", from: "e1", to: "e2" });
  state = apply(state, { type: "endTurn" });
  state = apply(state, { type: "move", from: "b8", to: "c7" });
  state = apply(state, { type: "endTurn" });
  state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "b2" }] });
  const moved = state.pieces.find(piece => piece.square === "b2");
  assert.equal(moved?.id, rook.id);
  assert.equal(moved?.role, rook.role);
  assert.equal((state.effects.find(value => (value as { type?: string }).type === "pacifism") as { pieceId: string }).pieceId, rook.id);
  assertValid(state);
});

test("Doppelganger ignores a following Doomsayer event and copies the actual mover", () => {
  let state = createGameState({
    fen: "4k2r/8/8/8/8/8/8/R3K3 b - - 0 1",
    hands: { white: ["doppelganger"], black: ["doomsayer"] }, decks: { white: [], black: [] },
  });
  const actor = state.pieces.find(piece => piece.square === "a1")!;
  state = apply(state, { type: "move", from: "h8", to: "h7" });
  state = apply(state, { type: "playCard", cardId: "doomsayer" });
  state = apply(state, { type: "declineDoomsayer", player: "white" });
  state = apply(state, { type: "endTurn" });
  state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "a3" }] });
  assert.deepEqual(state.pieces.find(piece => piece.id === actor.id), { ...actor, square: "a3" });
  assertValid(state);
});

test("Doppelganger ignores No Quarter after an ordinary capture and copies the capturer", () => {
  let state = createGameState({
    fen: "4k2r/8/8/8/8/8/R3K3/7N b - - 0 1",
    hands: { white: ["doppelganger"], black: ["no-quarter"] }, decks: { white: [], black: [] },
  });
  const actor = state.pieces.find(piece => piece.square === "a2")!;
  state = apply(state, { type: "move", from: "h8", to: "h1" });
  state = apply(state, { type: "playCard", cardId: "no-quarter" });
  state = apply(state, { type: "endTurn" });
  state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a2", to: "a4" }] });
  assert.deepEqual(state.pieces.find(piece => piece.id === actor.id), { ...actor, square: "a4" });
  assertValid(state);
});

test("Doppelganger rejects Annexation's two-piece movement", () => {
  let state = createGameState({ fen: "4k3/pp6/8/8/8/8/8/R3K3 b - - 0 1", hands: { white: ["doppelganger"], black: ["annexation"] }, decks: { white: [], black: [] } });
  state = apply(state, { type: "playCard", cardId: "annexation", target: [{ from: "a7", to: "a5" }, { from: "b7", to: "b5" }] });
  state = apply(state, { type: "endTurn" });
  reject(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "a3" }] });
  assertValid(state);
});

test("Doppelganger rejects Forced March's two-piece movement", () => {
  let state = createGameState({ fen: "4k3/2p1p3/8/8/8/8/8/R3K3 b - - 0 1", hands: { white: ["doppelganger"], black: ["forced-march"] }, decks: { white: [], black: [] } });
  state = apply(state, { type: "playCard", cardId: "forced-march", target: [{ from: "c7", to: "b7" }, { from: "e7", to: "d7" }] });
  state = apply(state, { type: "endTurn" });
  reject(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "a3" }] });
  assertValid(state);
});

test("Doppelganger rejects Onslaught's multi-piece movement", () => {
  let state = createGameState({ fen: "4k3/pp6/8/8/8/8/8/R3K3 b - - 0 1", hands: { white: ["doppelganger"], black: ["onslaught"] }, decks: { white: [], black: [] } });
  state = apply(state, { type: "playCard", cardId: "onslaught", target: [{ from: "a7", to: "a6" }, { from: "b7", to: "b6" }] });
  state = apply(state, { type: "endTurn" });
  reject(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "a3" }] });
  assertValid(state);
});

test("Doppelganger rejects Heresy's multi-piece history", () => {
  let state = createGameState({ fen: "2b4k/7r/8/8/8/8/8/R1B1K3 b - - 0 1", hands: { white: ["doppelganger"], black: ["heresy"] }, decks: { white: [], black: [] } });
  state = apply(state, { type: "move", from: "h7", to: "h6" });
  state = apply(state, { type: "playCard", cardId: "heresy", target: [{ from: "c1", to: "b1" }, { from: "c8", to: "b8" }] });
  state = apply(state, { type: "endTurn" });
  reject(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "a3" }] });
  assertValid(state);
});

test("Doppelganger copies a pawn's promoted current kind", () => {
  let state = createGameState({ fen: "4k3/8/8/8/8/8/1p6/R3K3 b - - 0 1", hands: { white: ["doppelganger"], black: [] }, decks: { white: [], black: [] } });
  const actor = state.pieces.find(piece => piece.square === "a1")!;
  state = apply(state, { type: "move", from: "b2", to: "b1", promotion: "knight" });
  state = apply(state, { type: "endTurn" });
  state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "c2" }] });
  assert.deepEqual(state.pieces.find(piece => piece.id === actor.id), { ...actor, square: "c2" });
  assertValid(state);
});

test("Doppelganger survives a JSON round-trip of the preceding move history", () => {
  let state = createGameState({ fen: "1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1", hands: { white: ["doppelganger"], black: [] }, decks: { white: [], black: [] } });
  const actor = state.pieces.find(piece => piece.square === "a1")!;
  state = apply(state, { type: "move", from: "b8", to: "c6" });
  state = apply(state, { type: "endTurn" });
  state = JSON.parse(JSON.stringify(state)) as GameState;
  state = apply(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "b3" }] });
  assert.deepEqual(state.pieces.find(piece => piece.id === actor.id), { ...actor, square: "b3" });
  assertValid(state);
});

test("Doppelganger rejects a pre-used one-card allowance without mutating state", () => {
  let state = createGameState({ fen: "1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1", hands: { white: ["doppelganger"], black: [] }, decks: { white: [], black: [] } });
  state = apply(state, { type: "move", from: "b8", to: "c6" });
  state = apply(state, { type: "endTurn" });
  state = { ...state, turn: { ...state.turn, cardPlays: { ...state.turn.cardPlays, white: 1 } } };
  reject(state, { type: "playCard", cardId: "doppelganger", target: [{ from: "a1", to: "b3" }] });
  assertValid(state);
});
