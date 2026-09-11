import assert from "node:assert/strict";
import { it } from "node:test";

import { applyAction, cardPlayTargets, isKingInCheck, legalDests, positionFor } from "../reducer.js";
import { createGameState } from "../state.js";
import type { Color, GameAction, GameState, PieceState, SquareName } from "../types.js";

const square = /^[a-h][1-8]$/;
it("Peace Talks preserves Pacifism attached to the hidden original Confabulation component", () => {
  let state = createGameState({ fen: "4k1n1/8/8/8/8/R7/8/1N2K3 w - - 0 1",
    hands: { white: ["pacifism", "confabulation"], black: ["peace-talks"] } });
  const pacifism = state.players.white.hand[0];
  for (const action of [
    { type: "playCard", cardId: "pacifism", target: "b1" },
    { type: "move", from: "e1", to: "d1" }, { type: "endTurn" },
    { type: "move", from: "g8", to: "f6" }, { type: "endTurn" },
    { type: "playCard", cardId: "confabulation", target: [{ from: "b1", to: "a3" }] },
    { type: "endTurn" }, { type: "move", from: "f6", to: "g8" },
    { type: "playCard", cardId: "peace-talks", target: "white-hand-1-confabulation" },
  ] satisfies GameAction[]) state = compositeAction(state, action);
  // FAQ 18 preserves the original target's marker; it does not prescribe return placement.
  assert(state.effects.some(effect => {
    const marker = effect as { type: string; pieceId: string; card: { id: string } };
    return marker.type === "pacifism" && marker.pieceId === "white-knight-b1" && marker.card.id === pacifism.id;
  }));
  assert(!state.players.white.discard.some(card => card.id === pacifism.id));
});

it("Bog stops a rook-knight composite represented by its Knight after one square", () => {
  let state = createGameState({
    fen: "7k/8/8/8/N7/8/8/R6K w - - 0 1",
    hands: { white: ["confabulation"], black: ["bog"] },
  });
  const carrierId = state.pieces.find(piece => piece.square === "a4")!.id;
  for (const action of [
    { type: "playCard", cardId: "confabulation", target: [{ from: "a1", to: "a4" }] },
    { type: "endTurn" },
    { type: "move", from: "h8", to: "h7" },
    { type: "endTurn" },
    { type: "move", from: "a4", to: "a7" },
    { type: "playCard", cardId: "bog" },
  ] satisfies GameAction[]) {
    const before = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, before, "actions must not mutate their input");
    assert(result.ok, result.ok ? "" : result.error.message);
    state = result.state;
  }
  assert.equal(state.pieces.find(piece => piece.id === carrierId)!.square, "a5");
});

// Finding28: cards.md Confabulation; official FAQ pp. 12 and 18–19.
// Use public actions without the seeded suites' exhaustive legal-move checks.
function compositeAction(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, "public actions preserve their input");
  assert(result.ok, result.ok ? "" : `${JSON.stringify(action)}: ${result.error.message}`);
  return result.state;
}

function compositeFixture(color: Color, knightCarrier: boolean, reaction: "bog" | "toll", capture = false) {
  const opponent: Color = color === "white" ? "black" : "white";
  const at = (name: string) => (color === "white" ? name : `${name[0]}${9 - Number(name[1])}`) as SquareName;
  const board = reaction === "bog"
    ? knightCarrier ? `7k/${capture ? "p7" : "8"}/8/8/N7/8/8/R6K` : "7k/8/8/8/R7/2N5/8/7K"
    : knightCarrier ? "7k/8/8/8/8/2N5/2P5/7K" : "7k/8/8/8/8/2P5/8/1N5K";
  const mirrored = board.split("/").reverse().join("/").replace(/[a-z]/gi,
    value => value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase());
  let state = createGameState({
    fen: `${color === "white" ? board : mirrored} ${color[0]} - - 17 24`,
    hands: { [color]: ["confabulation", "pacifism", "coup"], [opponent]: ["crab", reaction, reaction] },
    decks: { [color]: ["panic", "dubbing"], [opponent]: ["panic", "dubbing"] },
  });
  const from = at(reaction === "bog" ? knightCarrier ? "a1" : "c3" : knightCarrier ? "c2" : "b1");
  const origin = at(reaction === "bog" ? "a4" : "c3");
  const destination = at(reaction === "bog" ? "a7" : "d5");
  const ids = [boardPiece(state, origin).id, boardPiece(state, from).id];
  state = compositeAction(state, { type: "playCard", cardId: "confabulation", target: [{ from, to: origin }] });
  state = compositeAction(state, { type: "endTurn" });
  state = compositeAction(state, { type: "move", from: at("h8"), to: at("h7") });
  if (capture) state = compositeAction(state, { type: "playCard", cardId: "crab", target: at("a7") });
  state = compositeAction(state, { type: "endTurn" });
  return { state, opponent, at, origin, destination, ids };
}

function assertCompositeReactionAccounting(before: GameState, after: GameState, reactor: Color, cardId: string) {
  const selected = before.players[reactor].hand.filter(card => card.cardId === cardId).at(-1)!;
  assert.deepEqual(after.players[reactor].hand,
    [...before.players[reactor].hand.filter(card => card.id !== selected.id), before.players[reactor].deck[0]]);
  assert.deepEqual(after.players[reactor].deck, before.players[reactor].deck.slice(1));
  assert.deepEqual(after.players[reactor].discard, [...before.players[reactor].discard, selected]);
  assert.equal(after.turn.cardPlays[reactor], 1);
  assert.equal(after.turn.moveMade, true);
  assert.equal(after.turn.phase, "afterMove");
  assert.equal(after.history.at(-1)?.type, "cardPlayed");
  assert.equal(after.history.at(-1)?.cardId, cardId);
}

for (const color of ["white", "black"] as const) {
  for (const knightCarrier of [true, false]) {
    it(`Bog preserves ${color} composite identities, markers and clocks with ${knightCarrier ? "Knight" : "Rook"} carrier`, () => {
      const fixture = compositeFixture(color, knightCarrier, "bog");
      const { opponent, at, origin, destination, ids } = fixture;
      const marked = compositeAction(fixture.state, { type: "playCard", cardId: "pacifism", target: origin });
      const moved = compositeAction(marked, { type: "move", from: origin, to: destination });
      const selected = moved.players[opponent].hand.filter(card => card.cardId === "bog").at(-1)!;
      const stopped = compositeAction(moved, { type: "playCard", cardId: "bog", cardInstanceId: selected.id });
      assert.deepEqual(stopped.pieces, moved.pieces.map(piece => piece.id === ids[0] ? { ...piece, square: at("a5") } : piece));
      assert.deepEqual(stopped.effects, moved.effects);
      assert.deepEqual(stopped.players[color], moved.players[color]);
      assert.deepEqual(stopped.fen.split(" ").slice(1), moved.fen.split(" ").slice(1));
      assert.equal(Number(stopped.fen.split(" ")[4]), Number(marked.fen.split(" ")[4]) + 1);
      assertCompositeReactionAccounting(moved, stopped, opponent, "bog");
      compositeAction(stopped, { type: "endTurn" });
    });

    it(`Toll enumerates and captures both ${color} components with ${knightCarrier ? "Knight" : "Pawn"} carrier`, () => {
      const { state, opponent, origin, destination, ids } = compositeFixture(color, knightCarrier, "toll");
      const moved = compositeAction(state, { type: "move", from: origin, to: destination });
      const snapshot = structuredClone(moved);
      assert.deepEqual(cardPlayTargets(moved, "toll"), [undefined, destination]);
      assert.deepEqual(moved, snapshot);
      for (const action of [
        { type: "playCard", cardId: "toll", target: null },
        { type: "playCard", cardId: "toll", target: destination, cardInstanceId: "missing" },
      ] satisfies GameAction[]) {
        const rejected = applyAction(moved, action);
        assert.equal(rejected.ok, false);
        assert.deepEqual(rejected.state, snapshot);
        assert.deepEqual(moved, snapshot);
      }
      const selected = moved.players[opponent].hand.filter(card => card.cardId === "toll").at(-1)!;
      const paid = compositeAction(moved, { type: "playCard", cardId: "toll", cardInstanceId: selected.id, target: destination });
      for (const id of ids) assert.deepEqual(paid.pieces.find(piece => piece.id === id),
        { ...moved.pieces.find(piece => piece.id === id)!, zone: "captured", square: null, capturedBy: opponent });
      assert.equal(confabulations(paid).length, 0);
      assert.deepEqual(paid.players[color], { ...moved.players[color],
        discard: [...moved.players[color].discard, confabulations(moved)[0].card] });
      assert.deepEqual(paid.fen.split(" ").slice(1), moved.fen.split(" ").slice(1));
      assert.equal(paid.fen.split(" ")[4], "0");
      assertCompositeReactionAccounting(moved, paid, opponent, "toll");
      compositeAction(paid, { type: "endTurn" });
    });
  }

  it(`Bog restores an ordinary capture and its Crab marker for a ${color} Knight carrier`, () => {
    const { state, opponent, at, origin, destination, ids } = compositeFixture(color, true, "bog", true);
    const victim = boardPiece(state, destination);
    const moved = compositeAction(state, { type: "move", from: origin, to: destination });
    assert.equal(moved.pieces.find(piece => piece.id === victim.id)!.zone, "captured");
    const selected = moved.players[opponent].hand.filter(card => card.cardId === "bog").at(-1)!;
    const stopped = compositeAction(moved, { type: "playCard", cardId: "bog", cardInstanceId: selected.id });
    assert.deepEqual(stopped.pieces, state.pieces.map(piece => piece.id === ids[0] ? { ...piece, square: at("a5") } : piece));
    assert.deepEqual(stopped.effects, state.effects);
    assert.deepEqual(stopped.players[opponent].discard, [selected]);
    assert.deepEqual(stopped.players[opponent].hand,
      [...moved.players[opponent].hand.filter(card => card.id !== selected.id), moved.players[opponent].deck[0]]);
    assert.deepEqual(stopped.players[opponent].deck, moved.players[opponent].deck.slice(1));
    assert.equal(Number(stopped.fen.split(" ")[4]), Number(state.fen.split(" ")[4]) + 1);
    assert.equal(stopped.fen.split(" ")[5], moved.fen.split(" ")[5]);
    compositeAction(stopped, { type: "endTurn" });
  });
}

it("Bog rejects actual composite Knight moves and standalone Knights merely moving as Queens", () => {
  for (const color of ["white", "black"] as const) {
    for (const knightCarrier of [true, false]) {
      const { state, origin, at } = compositeFixture(color, knightCarrier, "bog");
      const moved = compositeAction(state, { type: "move", from: origin, to: at("b6") });
      const before = structuredClone(moved);
      const result = applyAction(moved, { type: "playCard", cardId: "bog" });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, before);
      assert.deepEqual(moved, before);
    }
    const state = createGameState({
      fen: color === "white" ? "7k/8/8/8/8/8/8/N6K w - - 17 24" : "n6k/8/8/8/8/8/8/7K b - - 17 24",
      hands: { [color]: ["masquerade"], [color === "white" ? "black" : "white"]: ["bog"] },
    });
    const moved = compositeAction(state, { type: "playCard", cardId: "masquerade",
      target: [{ from: color === "white" ? "a1" : "a8", to: color === "white" ? "a6" : "a3" }] });
    const before = structuredClone(moved);
    const result = applyAction(moved, { type: "playCard", cardId: "bog" });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(moved, before);
  }
});

for (const protection of ["pacifism", "coup"] as const) {
  it(`Toll excludes a ${protection} composite from enumeration and payment in either carrier order`, () => {
    for (const color of ["white", "black"] as const) {
      for (const knightCarrier of [true, false]) {
        const fixture = compositeFixture(color, knightCarrier, "toll");
        const { at, origin, destination } = fixture;
        let state = fixture.state;
        if (protection === "coup") state = compositeAction(state, { type: "move", from: at("h1"), to: at("g1") });
        state = compositeAction(state, { type: "playCard", cardId: protection, target: origin });
        if (protection === "coup") {
          state = compositeAction(state, { type: "endTurn" });
          state = compositeAction(state, { type: "move", from: at("h7"), to: at("h8") });
          state = compositeAction(state, { type: "endTurn" });
        }
        state = compositeAction(state, { type: "move", from: origin, to: destination });
        const before = structuredClone(state);
        assert.deepEqual(cardPlayTargets(state, "toll"), [undefined]);
        const result = applyAction(state, { type: "playCard", cardId: "toll", target: destination });
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.error.code, "INVALID_TARGET");
        assert.deepEqual(result.state, before);
        assert.deepEqual(state, before);
      }
    }
  });
}

it("Bog keeps the Pawn component's halfmove reset when a Rook carries it", () => {
  let state = createGameState({ fen: "7k/8/8/8/8/2R5/2P5/7K w - - 17 24",
    hands: { white: ["confabulation"], black: ["bog"] } });
  for (const action of [
    { type: "playCard", cardId: "confabulation", target: [{ from: "c2", to: "c3" }] },
    { type: "endTurn" }, { type: "move", from: "h8", to: "h7" }, { type: "endTurn" },
    { type: "move", from: "c3", to: "c6" }, { type: "playCard", cardId: "bog" },
  ] satisfies GameAction[]) state = compositeAction(state, action);
  assert.equal(boardPiece(state, "c4").role, "rook");
  assert.equal(state.fen.split(" ")[4], "0");
  assert.equal(state.fen.split(" ")[5], "25");
});

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

for (const color of ["white", "black"] as const) {
  for (const marker of ["pacifism", "neutrality"] as const) {
    for (const hidden of [false, true]) for (const order of ["before", "after", "mixed"] as const) {
      it(`cancels only postmerge ${marker}: ${color}, ${order}, ${hidden ? "hidden" : "visible"} original target`, () => {
        const opponent = color === "white" ? "black" : "white";
        const markerOwner = marker === "pacifism" ? color : opponent;
        const at = (name: string) => color === "white" ? name : `${name[0]}${9 - Number(name[1])}`;
        const hands = { [color]: ["confabulation"], [opponent]: ["peace-talks"] };
        hands[markerOwner].push(...Array<string>(order === "mixed" ? 4 : 1).fill(marker));
        let state = createGameState({
          fen: color === "white"
            ? "4k1n1/8/8/8/8/R7/7B/1N2K3 w - - 0 1"
            : "1n2k3/7b/r7/8/8/8/8/4K1N1 b - - 0 1",
          hands,
        });
        const confabulation = state.players[color].hand[0];
        const markers = state.players[markerOwner].hand.filter(card => card.cardId === marker);
        const carrierId = boardPiece(state, at("a3")).id;
        const originalId = boardPiece(state, at(hidden ? "b1" : "a3")).id;
        const unrelatedId = boardPiece(state, at("h2")).id;
        const step = (action: GameAction) => {
          const result = apply(state, action);
          assert(result.ok, result.ok ? "" : `${JSON.stringify(action)}: ${result.error.message}`);
          state = result.state;
        };
        const waitingMove = () => {
          if (state.turn.moveMade) return;
          const ownTurn = state.turn.color === color;
          const from = ownTurn
            ? state.pieces.find(piece => piece.owner === color && piece.royal)!.square!
            : state.pieces.find(piece => piece.owner === opponent && piece.role === "knight")!.square!;
          const ends = ownTurn ? [at("e1"), at("d1")] : [at("g8"), at("f6")];
          step({ type: "move", from, to: ends.find(end => end !== from)! });
        };
        const nextTurn = () => {
          waitingMove();
          step({ type: "endTurn" });
        };
        const addMarker = (index: number, target: string) => {
          if (state.turn.color !== markerOwner || state.turn.cardPlays[state.turn.color]) nextTurn();
          if (state.turn.color !== markerOwner) nextTurn();
          if (marker === "neutrality") waitingMove();
          step({ type: "playCard", cardId: marker, cardInstanceId: markers[index].id, target: at(target) });
        };
        if (order !== "after") addMarker(0, hidden ? "b1" : "a3");
        if (order === "mixed") addMarker(1, "h2");
        if (state.turn.color !== color || state.turn.cardPlays[state.turn.color]) nextTurn();
        if (state.turn.color !== color) nextTurn();
        step({ type: "playCard", cardId: "confabulation", target: [{ from: at("b1"), to: at("a3") }] });
        if (order !== "before") addMarker(order === "mixed" ? 2 : 0, "a3");
        if (order === "mixed") addMarker(3, "h2");
        if (state.turn.color !== opponent || state.turn.cardPlays[state.turn.color]) nextTurn();
        if (state.turn.color !== opponent) nextTurn();
        waitingMove();
        assert(cardPlayTargets(state, "peace-talks").includes(confabulation.id));
        step({ type: "playCard", cardId: "peace-talks", target: confabulation.id });

        const retained = (id: string) => state.effects.filter(effect =>
          (effect as { card?: { id?: string } } | null)?.card?.id === id);
        const discarded = (id: string) => Object.values(state.players)
          .flatMap(player => player.discard).filter(card => card.id === id);
        const checkMarkers = () => {
          assert.equal(retained(confabulation.id).length, 0);
          assert.equal(discarded(confabulation.id).length, 1, "discard the physical Confabulation once");
          for (const [index, card] of markers.entries()) {
            const survives = order === "before" || (order === "mixed" && index !== 2);
            assert.equal(retained(card.id).length, Number(survives), `${card.id}: retain only its original target`);
            assert.equal(discarded(card.id).length, Number(!survives), `${card.id}: discard exactly once`);
            if (survives) assert.equal((retained(card.id)[0] as { pieceId: string }).pieceId,
              order === "mixed" && index % 2 ? unrelatedId : originalId);
            if (survives) assert.deepEqual((retained(card.id)[0] as { card: unknown }).card, card);
            assert.equal(Object.values(state.players).flatMap(player => [...player.hand, ...player.deck])
              .filter(candidate => candidate.id === card.id).length, 0);
          }
          if (marker === "neutrality") {
            assert.equal(state.pieces.find(piece => piece.id === originalId)!.neutral, order !== "after");
            if (hidden) assert.equal(state.pieces.find(piece => piece.id === carrierId)!.neutral, false);
            assert.equal(state.pieces.find(piece => piece.id === unrelatedId)!.neutral, order === "mixed");
          }
        };
        checkMarkers();
        // Harmless subsequent turns must not expire an original component's attachment.
        for (let turn = 0; turn < 3; turn++) {
          nextTurn();
          checkMarkers();
        }
      });
    }
  }
}

for (const color of ["white", "black"] as const) {
  it(`preserves ${color} premerge Crab and Curse on either component until explicitly cancelled`, () => {
    for (const marker of ["crab", "curse"] as const) for (const hidden of [true, false]) {
      const opponent = color === "white" ? "black" : "white";
      const markerOwner = marker === "crab" ? color : opponent;
      const at = (name: string) => (color === "white" ? name : `${name[0]}${9 - Number(name[1])}`) as SquareName;
      const role = marker === "crab" ? "P" : "B";
      const board = hidden ? `4k1n1/8/8/8/8/2N5/1${role}6/4K3` : `4k1n1/8/8/8/8/2${role}5/8/1N2K3`;
      const mirrored = board.split("/").reverse().join("/").replace(/[a-z]/gi,
        value => value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase());
      const hands = { [color]: ["confabulation"], [opponent]: ["peace-talks", "peace-talks"] };
      hands[markerOwner].push(marker);
      let state = createGameState({ fen: `${color === "white" ? board : mirrored} ${color[0]} - - 0 1`, hands });
      const originalId = boardPiece(state, at(hidden ? "b2" : "c3")).id;
      const confabulation = state.players[color].hand[0];
      const card = state.players[markerOwner].hand.find(candidate => candidate.cardId === marker)!;
      const peaceTalks = state.players[opponent].hand.filter(candidate => candidate.cardId === "peace-talks");
      const step = (action: GameAction) => { state = compositeAction(state, action); };
      const waitingMove = () => {
        if (state.turn.moveMade) return;
        const own = state.turn.color === color;
        const from = state.pieces.find(piece => piece.owner === state.turn.color &&
          (own ? piece.royal : piece.role === "knight"))!.square!;
        step({ type: "move", from, to: (own ? [at("e1"), at("d1")] : [at("g8"), at("f6")])
          .find(to => to !== from)! });
      };
      const nextTurn = () => { waitingMove(); step({ type: "endTurn" }); };
      if (state.turn.color !== markerOwner) nextTurn();
      waitingMove();
      step({ type: "playCard", cardId: marker, target: at(hidden ? "b2" : "c3") });
      nextTurn();
      if (state.turn.color !== color) nextTurn();
      step({ type: "playCard", cardId: "confabulation", target: [{ from: at(hidden ? "b2" : "b1"), to: at("c3") }] });
      nextTurn();
      waitingMove();
      step({ type: "playCard", cardId: "peace-talks", cardInstanceId: peaceTalks[0].id, target: confabulation.id });
      for (let turn = 0; turn < 3; turn++) {
        const retained = state.effects.filter(effect => (effect as { card?: { id: string } }).card?.id === card.id);
        assert.equal(retained.length, 1, `${marker}, hidden=${hidden}`);
        assert.equal((retained[0] as { pieceId: string }).pieceId, originalId);
        assert.deepEqual((retained[0] as { card: unknown }).card, card);
        assert(!state.players[markerOwner].discard.some(candidate => candidate.id === card.id));
        nextTurn();
      }
      if (state.turn.color !== opponent) nextTurn();
      waitingMove();
      assert(cardPlayTargets(state, "peace-talks").includes(card.id));
      step({ type: "playCard", cardId: "peace-talks", cardInstanceId: peaceTalks[1].id, target: card.id });
      assert(!state.effects.some(effect => (effect as { card?: { id: string } }).card?.id === card.id));
      assert.deepEqual(state.players[markerOwner].discard.filter(candidate => candidate.id === card.id), [card]);
      assert.deepEqual(state.players[color].discard.filter(candidate => candidate.id === confabulation.id), [confabulation]);
      for (const peace of peaceTalks) assert.deepEqual(state.players[opponent].discard.filter(candidate => candidate.id === peace.id), [peace]);
    }
  });
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
