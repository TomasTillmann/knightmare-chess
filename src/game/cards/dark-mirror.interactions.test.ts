import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, boardFen, cardPlayTargets, legalDests } from "../reducer.js";
import { createGameState } from "../state.js";

const play = (state: ReturnType<typeof createGameState>, cardId: string, target: unknown) =>
  applyAction(state, { type: "playCard", cardId, target });

test("Earthquake rotates Dark Mirror's backward capture", () => {
  const state = createGameState({ fen: "4k3/8/8/8/3P4/2p5/8/4K3 b - - 0 1", hands: { black: ["earthquake"], white: ["dark-mirror"] }, phase: "afterMove", moveMade: true });
  const earthquake = play(state, "earthquake", { direction: "clockwise", promotions: [] });
  assert.equal(earthquake.ok, true);
  const whiteTurn = applyAction(earthquake.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  assert.equal(whiteTurn.state.orientation, 90);
  assert.equal(whiteTurn.state.turn.color, "white");
  assert.deepEqual(cardPlayTargets(whiteTurn.state, "dark-mirror"), [[{ from: "d4", to: "c3" }]]);
  const mirrored = play(whiteTurn.state, "dark-mirror", [{ from: "d4", to: "c3" }]);
  assert.equal(mirrored.ok, true);
  assert.equal(boardFen(mirrored.state), "4k3/8/8/8/8/2P5/8/4K3");
});

test("Pacifism blocks both attacker and victim cases", () => {
  const attackerStart = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 w - - 0 1", hands: { white: ["pacifism", "dark-mirror"] } });
  const pacifiedAttacker = play(attackerStart, "pacifism", "c4");
  assert.equal(pacifiedAttacker.ok, true);
  const whiteMove = applyAction(pacifiedAttacker.state, { type: "move", from: "e1", to: "f1" });
  assert.equal(whiteMove.ok, true);
  const blackTurn = applyAction(whiteMove.state, { type: "endTurn" });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: "move", from: "e8", to: "f8" });
  assert.equal(blackMove.ok, true);
  const attackerTurn = applyAction(blackMove.state, { type: "endTurn" });
  assert.equal(attackerTurn.ok, true);
  assert.deepEqual(attackerTurn.state.turn, { color: "white", phase: "beforeMove", moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(attackerTurn.state.players.white.hand.map(card => card.cardId), ["dark-mirror"]);
  assert.deepEqual(cardPlayTargets(attackerTurn.state, "dark-mirror"), []);
  const attackerPlay = play(attackerTurn.state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(attackerPlay.ok, false);
  assert.equal(attackerPlay.error.code, "INVALID_TARGET");

  const victimStart = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 b - - 0 1", hands: { black: ["pacifism"], white: ["dark-mirror"] } });
  const pacifiedVictim = play(victimStart, "pacifism", "d3");
  assert.equal(pacifiedVictim.ok, true);
  const victimBlackMove = applyAction(pacifiedVictim.state, { type: "move", from: "e8", to: "f8" });
  assert.equal(victimBlackMove.ok, true);
  const victimTurn = applyAction(victimBlackMove.state, { type: "endTurn" });
  assert.equal(victimTurn.ok, true);
  assert.deepEqual(victimTurn.state.turn, { color: "white", phase: "beforeMove", moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(victimTurn.state.players.white.hand.map(card => card.cardId), ["dark-mirror"]);
  assert.deepEqual(cardPlayTargets(victimTurn.state, "dark-mirror"), []);
  const victimPlay = play(victimTurn.state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(victimPlay.ok, false);
  assert.equal(victimPlay.error.code, "INVALID_TARGET");
});

test("Crab Continuing Effect wins conflicting movement", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 w - - 0 1", hands: { white: ["crab", "dark-mirror"] }, phase: "afterMove", moveMade: true });
  const crab = play(state, "crab", "c4");
  assert.equal(crab.ok, true);
  const blackTurn = applyAction(crab.state, { type: "endTurn" });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: "move", from: "e8", to: "f8" });
  assert.equal(blackMove.ok, true);
  const ready = applyAction(blackMove.state, { type: "endTurn" });
  assert.equal(ready.ok, true);
  assert.deepEqual(ready.state.turn, { color: "white", phase: "beforeMove", moveMade: false, cardPlays: { white: 0, black: 0 } });
  assert.deepEqual(ready.state.players.white.hand.map(card => card.cardId), ["dark-mirror"]);
  assert.deepEqual(legalDests(ready.state).get("c4"), ["b5", "d5"]);
  assert.deepEqual(cardPlayTargets(ready.state, "dark-mirror"), []);
  const darkMirror = play(ready.state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(darkMirror.ok, false);
  assert.equal(darkMirror.error.code, "INVALID_TARGET");
});

test("Vendetta accepts Dark Mirror as the required capture", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/n7/R3K3 b - - 0 1", hands: { black: ["vendetta"], white: ["dark-mirror"] }, phase: "afterMove", moveMade: true });
  const vendettaCard = state.players.black.hand[0];
  assert.ok(vendettaCard);
  const vendetta = play(state, "vendetta", undefined);
  assert.equal(vendetta.ok, true);
  const vendettaEffect = vendetta.state.effects.find(effect => (effect as { type?: unknown }).type === "vendetta");
  assert.deepEqual(vendettaEffect, { type: "vendetta", owner: "black", card: vendettaCard });
  const whiteTurn = applyAction(vendetta.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  assert.deepEqual(cardPlayTargets(whiteTurn.state, "dark-mirror"), [[{ from: "c4", to: "d3" }]]);
  const mirrored = play(whiteTurn.state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.equal(boardFen(mirrored.state), "4k3/8/8/8/8/3P4/n7/R3K3");
  assert.deepEqual(mirrored.state.effects.find(effect => (effect as { type?: unknown }).type === "vendetta"), vendettaEffect);
});

test("Revenge can remove the Pawn that captured through Dark Mirror", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"], black: ["revenge"] } });
  const capturingPawn = state.pieces.find(piece => piece.square === "c4");
  const capturedPawn = state.pieces.find(piece => piece.square === "d3");
  const darkMirrorCard = state.players.white.hand[0];
  const revengeCard = state.players.black.hand[0];
  assert.ok(capturingPawn && capturedPawn && darkMirrorCard && revengeCard);
  const mirrored = play(state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  const revenge = play(mirrored.state, "revenge", "d3");
  assert.equal(revenge.ok, true);
  assert.equal(boardFen(revenge.state), "4k3/8/8/8/8/8/8/4K3");
  assert.deepEqual(revenge.state.pieces.find(piece => piece.id === capturingPawn.id), { ...capturingPawn, square: null, zone: "captured" });
  assert.deepEqual(revenge.state.pieces.find(piece => piece.id === capturedPawn.id), { ...capturedPawn, square: null, zone: "captured" });
  assert.deepEqual(revenge.state.players.white, { hand: [], deck: [], discard: [darkMirrorCard] });
  assert.deepEqual(revenge.state.players.black, { hand: [], deck: [], discard: [revengeCard] });
});

test("Dark Mirror does not create a Toll trigger across the frontier", () => {
  const state = createGameState({ fen: "4k3/8/8/2P5/3p4/8/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"], black: ["toll"] } });
  const mirrored = play(state, "dark-mirror", [{ from: "c5", to: "d4" }]);
  assert.equal(mirrored.ok, true);
  assert.equal(boardFen(mirrored.state), "4k3/8/8/8/3P4/8/8/4K3");
  assert.deepEqual(cardPlayTargets(mirrored.state, "toll"), []);
  const toll = play(mirrored.state, "toll", "d4");
  assert.equal(toll.ok, false);
  assert.equal(toll.error.code, "INVALID_TIMING");
  assert.deepEqual(toll.state, mirrored.state);
});

test("Dark Mirror does not disturb an active Doomsayer", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 b - - 0 1", hands: { black: ["doomsayer"], white: ["dark-mirror"] }, phase: "afterMove", moveMade: true });
  const doomsayer = play(state, "doomsayer", undefined);
  assert.equal(doomsayer.ok, true);
  const declined = applyAction(doomsayer.state, { type: "declineDoomsayer", player: "white" });
  assert.equal(declined.ok, true);
  const doomsayerEffect = declined.state.effects.find(effect => (effect as { type?: unknown }).type === "doomsayer");
  assert.ok(doomsayerEffect);
  const whiteTurn = applyAction(declined.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  const mirrored = play(whiteTurn.state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.equal(boardFen(mirrored.state), "4k3/8/8/8/8/3P4/8/4K3");
  assert.deepEqual(mirrored.state.effects.find(effect => (effect as { type?: unknown }).type === "doomsayer"), doomsayerEffect);
  assert.equal(mirrored.state.pieces.find(piece => piece.id === "white-pawn-c4")?.zone, "board");
});

test("Fanatic moves the same Pawn after its Dark Mirror capture", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] }, decks: { white: ["fanatic"] } });
  const capturingPawn = state.pieces.find(piece => piece.square === "c4");
  const capturedPawn = state.pieces.find(piece => piece.square === "d3");
  const darkMirrorCard = state.players.white.hand[0];
  const fanaticCard = state.players.white.deck[0];
  assert.ok(capturingPawn && capturedPawn && darkMirrorCard && fanaticCard);
  const mirrored = play(state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.deepEqual(mirrored.state.players.white, { hand: [fanaticCard], deck: [], discard: [darkMirrorCard] });
  const blackTurn = applyAction(mirrored.state, { type: "endTurn" });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: "move", from: "e8", to: "f8" });
  assert.equal(blackMove.ok, true);
  const whiteTurn = applyAction(blackMove.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  const fanatic = play(whiteTurn.state, "fanatic", "d3");
  assert.equal(fanatic.ok, true);
  assert.equal(boardFen(fanatic.state), "5k2/8/3P4/8/8/8/8/4K3");
  assert.deepEqual(fanatic.state.pieces.find(piece => piece.id === capturingPawn.id), { ...capturingPawn, square: "d6" });
  assert.deepEqual(fanatic.state.pieces.find(piece => piece.id === capturedPawn.id), { ...capturedPawn, square: null, zone: "captured" });
  assert.deepEqual(fanatic.state.players.white, { hand: [], deck: [], discard: [darkMirrorCard, fanaticCard] });
});

test("Forced March moves the same Pawn after its Dark Mirror capture", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] }, decks: { white: ["forced-march"] } });
  const capturingPawn = state.pieces.find(piece => piece.square === "c4");
  const capturedPawn = state.pieces.find(piece => piece.square === "d3");
  const darkMirrorCard = state.players.white.hand[0];
  const forcedMarchCard = state.players.white.deck[0];
  assert.ok(capturingPawn && capturedPawn && darkMirrorCard && forcedMarchCard);
  const mirrored = play(state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.deepEqual(mirrored.state.players.white, { hand: [forcedMarchCard], deck: [], discard: [darkMirrorCard] });
  const blackTurn = applyAction(mirrored.state, { type: "endTurn" });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: "move", from: "e8", to: "f8" });
  assert.equal(blackMove.ok, true);
  const whiteTurn = applyAction(blackMove.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  const forcedMarch = play(whiteTurn.state, "forced-march", [{ from: "d3", to: "e3" }]);
  assert.equal(forcedMarch.ok, true);
  assert.equal(boardFen(forcedMarch.state), "5k2/8/8/8/8/4P3/8/4K3");
  assert.deepEqual(forcedMarch.state.pieces.find(piece => piece.id === capturingPawn.id), { ...capturingPawn, square: "e3" });
  assert.deepEqual(forcedMarch.state.pieces.find(piece => piece.id === capturedPawn.id), { ...capturedPawn, square: null, zone: "captured" });
  assert.deepEqual(forcedMarch.state.players.white, { hand: [], deck: [], discard: [darkMirrorCard, forcedMarchCard] });
});

test("Dark Mirror uses the same Pawn identity after Rebirth relocates it", () => {
  const state = createGameState({ fen: "4k3/8/8/2P5/8/8/8/3nK3 b - - 0 1", hands: { black: ["rebirth"], white: ["dark-mirror"] }, phase: "afterMove", moveMade: true });
  const pawn = state.pieces.find(piece => piece.square === "c5");
  const victim = state.pieces.find(piece => piece.square === "d1");
  const rebirthCard = state.players.black.hand[0];
  const darkMirrorCard = state.players.white.hand[0];
  assert.ok(pawn && victim && rebirthCard && darkMirrorCard);
  const rebirth = play(state, "rebirth", [{ from: "c5", to: "c2" }]);
  assert.equal(rebirth.ok, true);
  assert.deepEqual(rebirth.state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: "c2" });
  assert.deepEqual(rebirth.state.players.black, { hand: [], deck: [], discard: [rebirthCard] });
  const whiteTurn = applyAction(rebirth.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  const mirrored = play(whiteTurn.state, "dark-mirror", [{ from: "c2", to: "d1" }]);
  assert.equal(mirrored.ok, true);
  assert.equal(boardFen(mirrored.state), "4k3/8/8/8/8/8/8/3PK3");
  assert.deepEqual(mirrored.state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: "d1" });
  assert.deepEqual(mirrored.state.pieces.find(piece => piece.id === victim.id), { ...victim, square: null, zone: "captured" });
  assert.deepEqual(mirrored.state.players.white, { hand: [], deck: [], discard: [darkMirrorCard] });
});

test("Dark Mirror uses the same Pawn identity after Cowardice relocates it", () => {
  const state = createGameState({ fen: "4k3/8/8/2P5/8/3p4/8/4K3 b - - 0 1", hands: { black: ["cowardice"], white: ["dark-mirror"] }, phase: "afterMove", moveMade: true });
  const pawn = state.pieces.find(piece => piece.square === "c5");
  const victim = state.pieces.find(piece => piece.square === "d3");
  const cowardiceCard = state.players.black.hand[0];
  const darkMirrorCard = state.players.white.hand[0];
  assert.ok(pawn && victim && cowardiceCard && darkMirrorCard);
  const cowardice = play(state, "cowardice", [{ from: "c5", to: "c4" }]);
  assert.equal(cowardice.ok, true);
  assert.deepEqual(cowardice.state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: "c4" });
  assert.deepEqual(cowardice.state.players.black, { hand: [], deck: [], discard: [cowardiceCard] });
  const whiteTurn = applyAction(cowardice.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  const mirrored = play(whiteTurn.state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.equal(boardFen(mirrored.state), "4k3/8/8/8/8/3P4/8/4K3");
  assert.deepEqual(mirrored.state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: "d3" });
  assert.deepEqual(mirrored.state.pieces.find(piece => piece.id === victim.id), { ...victim, square: null, zone: "captured" });
  assert.deepEqual(mirrored.state.players.white, { hand: [], deck: [], discard: [darkMirrorCard] });
});

test("Annexation moves the same Pawn after its Dark Mirror capture", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] }, decks: { white: ["annexation"] } });
  const capturingPawn = state.pieces.find(piece => piece.square === "c4");
  const capturedPawn = state.pieces.find(piece => piece.square === "d3");
  const darkMirrorCard = state.players.white.hand[0];
  const annexationCard = state.players.white.deck[0];
  assert.ok(capturingPawn && capturedPawn && darkMirrorCard && annexationCard);
  const mirrored = play(state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.deepEqual(mirrored.state.players.white, { hand: [annexationCard], deck: [], discard: [darkMirrorCard] });
  const blackTurn = applyAction(mirrored.state, { type: "endTurn" });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: "move", from: "e8", to: "f8" });
  assert.equal(blackMove.ok, true);
  const whiteTurn = applyAction(blackMove.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  const annexation = play(whiteTurn.state, "annexation", [{ from: "d3", to: "d5" }]);
  assert.equal(annexation.ok, true);
  assert.equal(boardFen(annexation.state), "5k2/8/8/3P4/8/8/8/4K3");
  assert.deepEqual(annexation.state.pieces.find(piece => piece.id === capturingPawn.id), { ...capturingPawn, square: "d5" });
  assert.deepEqual(annexation.state.pieces.find(piece => piece.id === capturedPawn.id), { ...capturedPawn, square: null, zone: "captured" });
  assert.deepEqual(annexation.state.players.white, { hand: [], deck: [], discard: [darkMirrorCard, annexationCard] });
});

test("Onslaught moves the same Pawn after its Dark Mirror capture", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/8/4K3 w - - 0 1", hands: { white: ["dark-mirror"] }, decks: { white: ["onslaught"] } });
  const capturingPawn = state.pieces.find(piece => piece.square === "c4");
  const capturedPawn = state.pieces.find(piece => piece.square === "d3");
  const darkMirrorCard = state.players.white.hand[0];
  const onslaughtCard = state.players.white.deck[0];
  assert.ok(capturingPawn && capturedPawn && darkMirrorCard && onslaughtCard);
  const mirrored = play(state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.deepEqual(mirrored.state.players.white, { hand: [onslaughtCard], deck: [], discard: [darkMirrorCard] });
  const blackTurn = applyAction(mirrored.state, { type: "endTurn" });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: "move", from: "e8", to: "f8" });
  assert.equal(blackMove.ok, true);
  const whiteTurn = applyAction(blackMove.state, { type: "endTurn" });
  assert.equal(whiteTurn.ok, true);
  const onslaught = play(whiteTurn.state, "onslaught", [{ from: "d3", to: "d4" }]);
  assert.equal(onslaught.ok, true);
  assert.equal(boardFen(onslaught.state), "5k2/8/8/8/3P4/8/8/4K3");
  assert.deepEqual(onslaught.state.pieces.find(piece => piece.id === capturingPawn.id), { ...capturingPawn, square: "d4" });
  assert.deepEqual(onslaught.state.pieces.find(piece => piece.id === capturedPawn.id), { ...capturedPawn, square: null, zone: "captured" });
  assert.deepEqual(onslaught.state.players.white, { hand: [], deck: [], discard: [darkMirrorCard, onslaughtCard] });
});

test("Dark Mirror consumes the own-turn card allowance", () => {
  const state = createGameState({ fen: "4k3/8/8/8/2P5/3p4/P7/4K3 w - - 0 1", hands: { white: ["dark-mirror", "disintegration"] } });
  const mirrored = play(state, "dark-mirror", [{ from: "c4", to: "d3" }]);
  assert.equal(mirrored.ok, true);
  assert.equal(boardFen(mirrored.state), "4k3/8/8/8/8/3P4/P7/4K3");
  assert.deepEqual(mirrored.state.players.white.hand.map(card => card.cardId), ["disintegration"]);
  const beforeRejectedPlay = structuredClone(mirrored.state);
  const disintegration = play(mirrored.state, "disintegration", "a2");
  assert.equal(disintegration.ok, false);
  assert.equal(disintegration.error.code, "CARD_ALREADY_PLAYED");
  assert.deepEqual(disintegration.state, beforeRejectedPlay);
  assert.deepEqual(mirrored.state, beforeRejectedPlay);
});

test("Earthquake, Dark Mirror, and Revenge replay deterministically", () => {
  const seed = createGameState({ fen: "4k3/8/8/8/3P4/2p5/8/4K3 b - - 0 1", hands: { black: ["earthquake", "revenge"], white: ["dark-mirror"] }, phase: "afterMove", moveMade: true });
  const firstInput = structuredClone(seed);
  const secondInput = structuredClone(seed);
  const firstBefore = structuredClone(firstInput);
  const secondBefore = structuredClone(secondInput);
  const run = (input: typeof seed) => {
    const earthquake = play(input, "earthquake", { direction: "clockwise", promotions: [] });
    assert.equal(earthquake.ok, true);
    const whiteTurn = applyAction(earthquake.state, { type: "endTurn" });
    assert.equal(whiteTurn.ok, true);
    const mirrored = play(whiteTurn.state, "dark-mirror", [{ from: "d4", to: "c3" }]);
    assert.equal(mirrored.ok, true);
    const revenge = play(mirrored.state, "revenge", "c3");
    assert.equal(revenge.ok, true);
    return revenge.state;
  };
  const firstOutput = run(firstInput);
  const secondOutput = run(secondInput);
  assert.deepEqual(firstInput, firstBefore);
  assert.deepEqual(secondInput, secondBefore);
  assert.deepEqual(firstOutput, secondOutput);
  assert.equal(firstOutput.orientation, 90);
  assert.equal(boardFen(firstOutput), "4k3/8/8/8/8/8/8/4K3");
  assert.deepEqual(firstOutput.players.white.hand, []);
  assert.deepEqual(firstOutput.players.black.hand, []);
});
