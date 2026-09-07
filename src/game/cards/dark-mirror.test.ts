import assert from "node:assert/strict";
import test from "node:test";
import { CARD_CATALOG } from "./catalog.js";
import { applyAction, boardFen, cardPlayTargets, legalDests } from "../reducer.js";
import { createGameState } from "../state.js";

test("Dark Mirror exposes its printed metadata and replacement-move lifecycle", () => {
  assert.deepEqual(CARD_CATALOG["dark-mirror"], {
    id: "dark-mirror", name: "Dark Mirror", points: 5, unique: false,
    image: "/KC7_card2.png",
    description: "On this move, one of your Pawns can capture by moving diagonally backward instead of forward.",
    timing: ["beforeMove"], continuing: false,
  });
  const state = createGameState({ fen: "4k3/8/8/8/8/2P5/3p4/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  assert.deepEqual(cardPlayTargets(state, "dark-mirror"), [[{ from: "c3", to: "d2" }]]);
  const result = applyAction(state, { type: "playCard", cardId: "dark-mirror", target: [{ from: "c3", to: "d2" }] });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(boardFen(result.state), "4k3/8/8/8/8/8/3P4/4K3");
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.players.white.hand.length, 0);
  }
});

test("Dark Mirror permits a white pawn's occupied backward-diagonal capture", () => {
  const state = createGameState({ fen: "4k3/8/8/8/8/8/2P5/3nK3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  assert.deepEqual(cardPlayTargets(state, "dark-mirror"), [[{ from: "c2", to: "d1" }]]);
  assert.deepEqual(legalDests(state).get("c2"), ["c3", "c4"]);
});

test("Dark Mirror rejects empty and forward targets atomically", () => {
  const state = createGameState({ fen: "4k3/8/8/8/3p4/2P5/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  const before = structuredClone(state);
  for (const target of [[{ from: "c3", to: "b2" }], [{ from: "c3", to: "d4" }]]) {
    const result = applyAction(state, { type: "playCard", cardId: "dark-mirror", target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  }
});

test("Dark Mirror supports Black backward capture", () => {
  const s = createGameState({ fen: "4k3/3P4/2p5/8/8/8/8/4K3 b - - 0 1", hands: { black: ["dark-mirror"] } });
  assert.deepEqual(cardPlayTargets(s, "dark-mirror"), [[{ from: "c6", to: "d7" }]]);
});

test("Dark Mirror uses actual victims on every oriented backward diagonal", () => {
  const cases = [
    [0, "white", "4k3/8/8/8/3P4/2p1p3/8/4K3 w - - 0 1", ["c3", "e3"]],
    [90, "white", "4k3/8/8/2p5/3P4/2p5/8/4K3 w - - 0 1", ["c3", "c5"]],
    [180, "white", "4k3/8/8/2p1p3/3P4/8/8/4K3 w - - 0 1", ["c5", "e5"]],
    [270, "white", "4k3/8/8/4p3/3P4/4p3/8/4K3 w - - 0 1", ["e3", "e5"]],
    [0, "black", "4k3/8/8/2P1P3/3p4/8/8/4K3 b - - 0 1", ["c5", "e5"]],
    [90, "black", "4k3/8/8/4P3/3p4/4P3/8/4K3 b - - 0 1", ["e3", "e5"]],
    [180, "black", "4k3/8/8/8/3p4/2P1P3/8/4K3 b - - 0 1", ["c3", "e3"]],
    [270, "black", "4k3/8/8/2P5/3p4/2P5/8/4K3 b - - 0 1", ["c3", "c5"]],
  ] as const;
  for (const [orientation, actor, fen, destinations] of cases) {
    const state = createGameState({ fen, hands: { [actor]: ["dark-mirror"] } });
    state.orientation = orientation;
    assert.deepEqual(cardPlayTargets(state, "dark-mirror"), destinations.map(to => [{ from: "d4", to }]));
  }
});

test("Dark Mirror lets either actor use a neutral Pawn in its owner's direction", () => {
  for (const actor of ["white", "black"] as const) {
    const victims = actor === "white" ? "2n1n3" : "2N1N3";
    const state = createGameState({ fen: `4k3/8/8/8/3P4/${victims}/8/4K3 ${actor[0]} - - 0 1`, hands: { [actor]: ["dark-mirror"] } });
    state.pieces.find(piece => piece.square === "d4")!.neutral = true;
    assert.deepEqual(cardPlayTargets(state, "dark-mirror"), [[{ from: "d4", to: "c3" }], [{ from: "d4", to: "e3" }]]);
  }
});

test("Dark Mirror allows an unpromoted transformed original Pawn", () => {
  const state = createGameState({ fen: "4k3/8/8/8/3P4/2p5/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  Object.assign(state.pieces.find(piece => piece.square === "d4")!, { role: "rook", originalRole: "pawn", promoted: false });
  assert.deepEqual(cardPlayTargets(state, "dark-mirror"), [[{ from: "d4", to: "c3" }]]);
});

test("Dark Mirror rejects a promoted original Pawn", () => {
  const state = createGameState({ fen: "4k3/8/8/8/3P4/2p5/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  Object.assign(state.pieces.find(piece => piece.square === "d4")!, { role: "queen", originalRole: "pawn", promoted: true });
  assert.deepEqual(cardPlayTargets(state, "dark-mirror"), []);
});

test("Dark Mirror duplicate instance selection is atomic", () => {
  const state = createGameState({
    fen: "4k3/8/8/8/8/2P5/3p4/4K3 w - - 7 20",
    hands: { white: ["dark-mirror", "dark-mirror"] }, decks: { white: ["bog"] },
  });
  const result = applyAction(state, {
    type: "playCard", cardId: "dark-mirror", cardInstanceId: "white-hand-1-dark-mirror",
    target: [{ from: "c3", to: "d2" }],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.state.players.white.hand, [
      { id: "white-hand-0-dark-mirror", cardId: "dark-mirror" },
      { id: "white-deck-0-bog", cardId: "bog" },
    ]);
    assert.deepEqual(result.state.players.white.discard, [{ id: "white-hand-1-dark-mirror", cardId: "dark-mirror" }]);
    assert.equal(result.state.pieces.find(piece => piece.square === null && piece.owner === "black")?.zone, "captured");
    assert.equal(boardFen(result.state), "4k3/8/8/8/8/8/3P4/4K3");
    assert.equal(result.state.fen, "4k3/8/8/8/8/8/3P4/4K3 b - - 0 20");
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.cardPlays.white, 1);
    const event = result.state.history.at(-1)!;
    assert.equal(event.type, "cardPlayed");
    assert.equal(event.cardId, "dark-mirror");
    assert.deepEqual(event.target, [{ from: "c3", to: "d2" }]);
    assert.deepEqual(event.movement, [{ from: "c3", to: "d2" }]);
    assert.equal(event.preservePreviousMove, false);
  }
});
test("Dark Mirror rejects wrong timing and game-over atomically", () => {
  const cases = [
    [createGameState({ phase: "afterMove", hands: { white: ["dark-mirror"] } }), "INVALID_TIMING"],
    [createGameState({ cardPlays: { white: 1 }, hands: { white: ["dark-mirror"] } }), "CARD_ALREADY_PLAYED"],
    [createGameState(), "CARD_NOT_IN_HAND"],
    [Object.assign(createGameState({ hands: { white: ["dark-mirror"] } }), { outcome: { winner: "black", reason: "checkmate" as const } }), "GAME_OVER"],
  ] as const;
  for (const [state, code] of cases) {
    const before = structuredClone(state);
    const result = applyAction(state, { type: "playCard", cardId: "dark-mirror", target: [{ from: "c3", to: "d2" }] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, code);
    assert.deepEqual(result.state, before);
  }
});
test("Dark Mirror validates malformed owner role and friendly occupant", () => {
  const base = "4k3/8/8/8/8/2P5/3p4/4K3 w - - 0 1";
  for (const target of [null, {}, [], [{ from: "c3" }], [{ from: "c3", to: "d2" }, { from: "c3", to: "b2" }]]) {
    const state = createGameState({ fen: base, hands: { white: ["dark-mirror"] } });
    const before = structuredClone(state);
    const result = applyAction(state, { type: "playCard", cardId: "dark-mirror", target });
    assert.equal(result.ok, false); assert.deepEqual(result.state, before);
  }
  const wrongOwner = createGameState({ fen: "4k3/8/2p5/3P4/8/8/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  const nonPawn = createGameState({ fen: "4k3/8/8/8/8/2R5/3p4/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  const friendly = createGameState({ fen: "4k3/8/8/8/8/2P5/3P4/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  Object.assign(nonPawn.pieces.find(piece => piece.square === "c3")!, { role: "rook", originalRole: "bishop" });
  for (const [state, target] of [
    [wrongOwner, [{ from: "c6", to: "d5" }]],
    [nonPawn, [{ from: "c3", to: "d2" }]],
    [friendly, [{ from: "c3", to: "d2" }]],
  ] as const) {
    const before = structuredClone(state);
    const result = applyAction(state, { type: "playCard", cardId: "dark-mirror", target });
    assert.equal(result.ok, false); assert.deepEqual(result.state, before);
  }
});
test("Dark Mirror clears valid en-passant state after its capture resolves", () => {
  const state = createGameState({ fen: "4k3/8/8/6Pp/8/2P5/3p4/4K3 w - h6 7 20", hands: { white: ["dark-mirror"] } });
  assert.equal(state.enPassant.length, 1);
  const result = applyAction(state, { type: "playCard", cardId: "dark-mirror", target: [{ from: "c3", to: "d2" }] });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.state.enPassant, []);
    assert.equal(result.state.fen, "4k3/8/8/6Pp/8/8/3P4/4K3 b - - 0 20");
  }
});
test("Dark Mirror fizzle paths leave frozen input unchanged", () => {
  const cases = [
    ["SELF_CHECK", "4r2k/8/8/8/8/8/4P3/3nK3 w - - 9 20", { from: "e2", to: "d1" }],
    ["DIRECT_MATE", "8/8/3Q4/8/2P1k2N/3r4/4K3/8 w - - 0 1", { from: "c4", to: "d3" }],
  ] as const;
  for (const [reason, fen, move] of cases) {
    const state = createGameState({ fen, hands: { white: ["dark-mirror"] }, decks: { white: ["bog"] } });
    const originalBoard = boardFen(state);
    const result = applyAction(state, { type: "playCard", cardId: "dark-mirror", target: [move] });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(boardFen(result.state), originalBoard);
      assert.equal(result.state.turn.moveMade, true);
      assert.deepEqual(result.state.players.white.hand, [{ id: "white-deck-0-bog", cardId: "bog" }]);
      assert.equal(result.state.players.white.discard[0]?.cardId, "dark-mirror");
      const event = result.state.history.at(-1)!;
      assert.equal(event.type, "cardFizzled");
      assert.equal(event.cardId, "dark-mirror");
      assert.equal(event.reason, reason);
      assert.deepEqual(event.movement, []);
      assert.equal(event.preservePreviousMove, false);
    }
  }
});

test("Dark Mirror never mutates recursively frozen success or rejection inputs", () => {
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) freeze(child);
    }
  };
  const success = createGameState({ fen: "4k3/8/8/8/8/2P5/3p4/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  const rejection = createGameState({ fen: "4k3/8/8/8/8/2P5/3p4/4K3 w - - 0 1", hands: { white: ["dark-mirror"] } });
  const successBefore = structuredClone(success);
  const rejectionBefore = structuredClone(rejection);
  freeze(success); freeze(rejection);
  let successResult: ReturnType<typeof applyAction> | undefined;
  let rejectionResult: ReturnType<typeof applyAction> | undefined;
  assert.doesNotThrow(() => { successResult = applyAction(success, { type: "playCard", cardId: "dark-mirror", target: [{ from: "c3", to: "d2" }] }); });
  assert.doesNotThrow(() => { rejectionResult = applyAction(rejection, { type: "playCard", cardId: "dark-mirror", target: [] }); });
  assert.equal(successResult?.ok, true);
  assert.equal(rejectionResult?.ok, false);
  assert.deepEqual(success, successBefore);
  assert.deepEqual(rejection, rejectionBefore);
});
// Focused Dark Mirror geometry coverage.
