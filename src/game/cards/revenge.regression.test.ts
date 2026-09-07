import assert from "node:assert/strict";
import test from "node:test";

import { applyAction, boardFen, cardPlayTargets, legalDests } from "../reducer.js";
import { createGameState } from "../state.js";
import type { ApplyResult, GameState } from "../types.js";

const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const next = (result: ApplyResult): GameState => {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
};

const invariant = (state: GameState): void => {
  assert.equal(new Set(state.pieces.map(({ id }) => id)).size, state.pieces.length);
  const onBoard = state.pieces.filter(({ square }) => square !== null);
  assert.equal(new Set(onBoard.map(({ square }) => square)).size, onBoard.length);
  for (const piece of state.pieces) assert.equal(piece.zone === "board", piece.square !== null);
  for (const owner of ["white", "black"] as const)
    assert.equal(onBoard.filter((piece) => piece.owner === owner && piece.royal).length, 1);
  assert.equal(state.turn.phase, state.turn.moveMade ? "afterMove" : "beforeMove");
  for (const count of Object.values(state.turn.cardPlays)) {
    assert.equal(Number.isInteger(count), true);
    assert.ok(count >= 0 && count <= 1);
  }
  const cards = Object.values(state.players).flatMap(({ hand, deck, discard }) => [
    ...hand,
    ...deck,
    ...discard,
  ]);
  assert.equal(new Set(cards.map(({ id }) => id)).size, cards.length);
  assert.equal(boardFen(state), state.fen.split(" ")[0]);
};

test("Revenge follows an ordinary capture and selects a seeded eligible pawn", () => {
  let state = createGameState({
    fen: "4k3/8/8/3p4/4P3/8/PPP5/4K3 w - - 7 20",
    hands: { black: ["revenge"] },
  });
  invariant(state);
  state = next(applyAction(state, { type: "move", from: "e4", to: "d5" }));
  invariant(state);

  const eligible = cardPlayTargets(state, "revenge") as string[];
  assert.deepEqual([...eligible].sort(), ["a2", "b2", "c2", "d5"]);
  const target = eligible[Math.floor(seeded(7)() * eligible.length)];
  const targetPiece = state.pieces.find((piece) => piece.zone === "board" && piece.square === target);
  assert.ok(targetPiece);
  state = next(applyAction(state, { type: "playCard", cardId: "revenge", target }));
  invariant(state);
  const captured = state.pieces.find(({ id }) => id === targetPiece.id);
  assert.equal(captured?.zone, "captured");
  assert.equal(captured?.square, null);
  state = next(applyAction(state, { type: "endTurn" }));
  invariant(state);
  const moves = [...legalDests(state)].flatMap(([from, dests]) => [...dests].map((to) => ({ from, to })));
  const move = moves[Math.floor(seeded(11)() * moves.length)];
  assert.ok(move);
  state = next(applyAction(state, { type: "move", ...move }));
  invariant(state);
});

test("Revenge follows a seeded en-passant capture without reviving its trigger", () => {
  let state = createGameState({
    fen: "4k3/8/8/3pP3/8/8/P7/4K3 w - d6 0 1",
    hands: { black: ["revenge"] },
  });
  invariant(state);
  const trigger = state.pieces.find((piece) => piece.square === "d5");
  assert.ok(trigger);
  const moveInput = structuredClone(state);
  const moveResult = applyAction(state, { type: "move", from: "e5", to: "d6" });
  assert.deepEqual(state, moveInput);
  state = next(moveResult);
  invariant(state);
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.zone, "captured");
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.square, null);
  assert.equal(state.history.at(-1)?.capturedId, trigger.id);

  const target = state.pieces.find((piece) => piece.square === "a2");
  assert.ok(target);
  const handBefore = state.players.black.hand.length;
  const discardBefore = state.players.black.discard.length;
  const historyBefore = state.history.length;
  const cardInput = structuredClone(state);
  const cardResult = applyAction(state, { type: "playCard", cardId: "revenge", target: "a2" });
  assert.deepEqual(state, cardInput);
  state = next(cardResult);
  invariant(state);
  assert.equal(state.pieces.find(({ id }) => id === target.id)?.zone, "captured");
  assert.equal(state.pieces.find(({ id }) => id === target.id)?.square, null);
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.zone, "captured");
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.square, null);
  assert.equal(state.players.black.hand.length, handBefore - 1);
  assert.equal(state.players.black.discard.length, discardBefore + 1);
  assert.equal(state.history.length, historyBefore + 1);

  const endInput = structuredClone(state);
  const endResult = applyAction(state, { type: "endTurn" });
  assert.deepEqual(state, endInput);
  state = next(endResult);
  invariant(state);
  const moves = [...legalDests(state)].flatMap(([from, dests]) => [...dests].map((to) => ({ from, to })));
  const move = moves[Math.floor(seeded(23)() * moves.length)];
  assert.ok(move);
  const replyInput = structuredClone(state);
  const replyResult = applyAction(state, { type: "move", ...move });
  assert.deepEqual(state, replyInput);
  state = next(replyResult);
  invariant(state);
});

test("Revenge captures the selected physical piece without rewriting its identity", () => {
  let state = createGameState({
    fen: "4k3/8/8/3p4/4P3/8/PPP5/4K3 w - - 0 1",
    hands: { black: ["revenge"] },
  });
  const trigger = state.pieces.find((piece) => piece.square === "d5");
  assert.ok(trigger);
  state = next(applyAction(state, { type: "move", from: "e4", to: "d5" }));

  const random = seeded(37);
  const targetSquare = ["a2", "b2", "c2"][Math.floor(random() * 3)];
  const variant = [
    { role: "knight", originalRole: "pawn", promoted: false },
    { role: "pawn", originalRole: "rook", promoted: true },
  ][Math.floor(random() * 2)];
  const target = state.pieces.find((piece) => piece.square === targetSquare);
  assert.ok(target);
  Object.assign(target, variant);
  if (random() < 0.5) target.neutral = true;
  state.fen = boardFen(state) + " " + state.fen.split(" ").slice(1).join(" ");
  invariant(state);

  const targetSnapshot = structuredClone(target);
  const handBefore = state.players.black.hand.length;
  const discardBefore = state.players.black.discard.length;
  const historyBefore = state.history.length;
  const input = structuredClone(state);
  const result = applyAction(state, { type: "playCard", cardId: "revenge", target: targetSquare });
  assert.deepEqual(state, input);
  state = next(result);
  invariant(state);

  const captured = state.pieces.find(({ id }) => id === targetSnapshot.id);
  assert.equal(captured?.zone, "captured");
  assert.equal(captured?.square, null);
  assert.deepEqual(captured, { ...targetSnapshot, zone: "captured", square: null });
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.zone, "captured");
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.square, null);
  assert.equal(state.players.black.hand.length, handBefore - 1);
  assert.equal(state.players.black.discard.length, discardBefore + 1);
  assert.equal(state.history.length, historyBefore + 1);
});

test("Revenge rejections leave state reusable for a later valid play", () => {
  const captureState = () => {
    const initial = createGameState({
      fen: "4k3/8/8/3p4/4P3/8/PPP5/4K3 w - - 0 1",
      hands: { black: ["revenge"] },
    });
    return next(applyAction(initial, { type: "move", from: "e4", to: "d5" }));
  };
  const random = seeded(53);
  const state = captureState();
  const target = state.pieces.find((piece) => piece.square === "a2");
  assert.ok(target);
  const protection = [
    { type: "pacifism", owner: "white", card: { id: "guard", cardId: "pacifism" }, pieceId: target.id },
    { type: "truce", owner: "white", card: { id: "guard", cardId: "truce" } },
    { type: "mysticShield", owner: "white", card: { id: "guard", cardId: "mystic-shield" }, pieceId: target.id },
  ][Math.floor(random() * 3)];
  state.effects.push(protection);
  invariant(state);

  const malformed = [undefined, null, {}, [], "a9"][Math.floor(random() * 5)];
  for (const rejectedTarget of ["a2", malformed]) {
    const snapshot = structuredClone(state);
    const hand = structuredClone(state.players.black.hand);
    const history = structuredClone(state.history);
    const cardPlays = structuredClone(state.turn.cardPlays);
    const result = applyAction(state, {
      type: "playCard",
      cardId: "revenge",
      target: rejectedTarget as never,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(state, snapshot);
    assert.deepEqual(result.state, snapshot);
    assert.deepEqual(result.state.players.black.hand, hand);
    assert.deepEqual(result.state.history, history);
    assert.deepEqual(result.state.turn.cardPlays, cardPlays);
    invariant(result.state);
  }

  const fresh = captureState();
  const eligible = cardPlayTargets(fresh, "revenge") as string[];
  const selected = eligible[Math.floor(random() * eligible.length)];
  const selectedPiece = fresh.pieces.find((piece) => piece.square === selected);
  assert.ok(selectedPiece);
  const result = applyAction(fresh, { type: "playCard", cardId: "revenge", target: selected });
  assert.equal(result.ok, true);
  const played = next(result);
  assert.equal(played.pieces.find(({ id }) => id === selectedPiece.id)?.zone, "captured");
  assert.equal(played.pieces.find(({ id }) => id === selectedPiece.id)?.square, null);
  invariant(played);
});

test("Revenge preserves a Vendetta-triggering move while resolving its seeded victim", () => {
  let state = createGameState({
    fen: "4k3/8/8/3p4/4P3/8/PPP5/4K3 w - - 0 1",
    hands: { black: ["revenge"] },
  });
  state.effects.push({
    type: "vendetta",
    owner: "black",
    card: { id: "vendetta-regression", cardId: "vendetta" },
  });
  invariant(state);

  const trigger = state.pieces.find((piece) => piece.square === "d5");
  assert.ok(trigger);
  const moveInput = structuredClone(state);
  const moveResult = applyAction(state, { type: "move", from: "e4", to: "d5" });
  assert.deepEqual(state, moveInput);
  state = next(moveResult);
  invariant(state);
  assert.equal(state.history.at(-1)?.type, "move");
  assert.equal(state.history.at(-1)?.capturedId, trigger.id);
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.zone, "captured");
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.square, null);

  const targets = cardPlayTargets(state, "revenge") as string[];
  const target = targets[Math.floor(seeded(71)() * targets.length)];
  assert.ok(target);
  const victim = state.pieces.find((piece) => piece.square === target);
  const revenge = state.players.black.hand.find(({ cardId }) => cardId === "revenge");
  assert.ok(victim);
  assert.ok(revenge);
  const priorHistory = structuredClone(state.history);
  const cardInput = structuredClone(state);
  const cardResult = applyAction(state, { type: "playCard", cardId: "revenge", target });
  assert.deepEqual(state, cardInput);
  state = next(cardResult);
  invariant(state);

  assert.equal(state.pieces.find(({ id }) => id === victim.id)?.zone, "captured");
  assert.equal(state.pieces.find(({ id }) => id === victim.id)?.square, null);
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.zone, "captured");
  assert.equal(state.pieces.find(({ id }) => id === trigger.id)?.square, null);
  assert.deepEqual(state.history.slice(0, -1), priorHistory);
  const event = state.history.at(-1);
  assert.equal(event?.type, "cardPlayed");
  assert.equal(event?.cardId, "revenge");
  assert.equal(event?.target, target);
  assert.equal(event?.capturedId, victim.id);
  assert.equal(event?.preservePreviousMove, true);

  const expectedPieces = structuredClone(cardInput.pieces);
  Object.assign(expectedPieces.find(({ id }) => id === victim.id)!, { zone: "captured", square: null });
  assert.deepEqual(state.pieces, expectedPieces);
  const expectedBlack = structuredClone(cardInput.players.black);
  expectedBlack.hand.splice(
    expectedBlack.hand.findIndex(({ id }) => id === revenge.id),
    1,
  );
  expectedBlack.discard.push(revenge);
  assert.deepEqual(state.players.black, expectedBlack);
  assert.deepEqual(state.players.white, cardInput.players.white);
  assert.deepEqual(state.effects, cardInput.effects);
  assert.deepEqual(state.turn, {
    ...cardInput.turn,
    cardPlays: { ...cardInput.turn.cardPlays, black: cardInput.turn.cardPlays.black + 1 },
  });

  state = next(applyAction(state, { type: "endTurn" }));
  invariant(state);
  const moves = [...legalDests(state)].flatMap(([from, dests]) => [...dests].map((to) => ({ from, to })));
  const reply = moves[Math.floor(seeded(73)() * moves.length)];
  assert.ok(reply);
  state = next(applyAction(state, { type: "move", ...reply }));
  invariant(state);
});
