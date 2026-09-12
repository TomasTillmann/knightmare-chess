import assert from "node:assert/strict";
import test from "node:test";

import { CARD_CATALOG } from "./catalog.js";
import { applyAction, cardPlayTargets } from "../reducer.js";
import { createGameState } from "../state.js";
import type {
  ApplyResult,
  BoardOrientation,
  Color,
  GameState,
  Role,
  SquareName,
} from "../types.js";

const FILES = "abcdefgh";
const ROLES: readonly Role[] = ["pawn", "rook", "knight", "bishop", "queen", "king"];
const STARTS: Record<Color, Record<Role, readonly SquareName[]>> = {
  white: {
    pawn: ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2"],
    rook: ["a1", "h1"],
    knight: ["b1", "g1"],
    bishop: ["c1", "f1"],
    queen: ["d1"],
    king: ["e1"],
  },
  black: {
    pawn: ["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7"],
    rook: ["a8", "h8"],
    knight: ["b8", "g8"],
    bishop: ["c8", "f8"],
    queen: ["d8"],
    king: ["e8"],
  },
};
const SYMBOL: Record<Role, string> = {
  pawn: "p",
  rook: "r",
  knight: "n",
  bishop: "b",
  queen: "q",
  king: "k",
};

function fen(
  pieces: Record<string, string>,
  turn: Color = "white",
  suffix = "- - 0 1",
): string {
  const board = Array.from({ length: 8 }, (_, row) => {
    let rank = "";
    let empty = 0;
    for (const file of FILES) {
      const piece = pieces[`${file}${8 - row}`];
      if (!piece) empty += 1;
      else {
        if (empty) rank += empty;
        rank += piece;
        empty = 0;
      }
    }
    return rank + (empty || "");
  }).join("/");
  return `${board} ${turn === "white" ? "w" : "b"} ${suffix}`;
}

function cardState(position: string, actor: Color = "white"): GameState {
  return createGameState({
    fen: position,
    turn: actor,
    phase: "afterMove",
    moveMade: true,
    hands: { [actor]: ["rebirth"] },
    decks: { [actor]: ["bog"] },
  });
}

function play(state: GameState, target: unknown): ApplyResult {
  return applyAction(state, { type: "playCard", cardId: "rebirth", target });
}

function accepted(result: ApplyResult): GameState {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(state: GameState, target: unknown, code?: string): void {
  const before = structuredClone(state);
  const result = play(state, target);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail("Rebirth unexpectedly succeeded");
  if (code !== undefined) assert.equal(result.error.code, code);
  assert.deepEqual(result.state, before);
}

function pieceAt(state: GameState, square: SquareName) {
  const piece = state.pieces.find(candidate => candidate.zone === "board" && candidate.square === square);
  assert.ok(piece, `expected a piece on ${square}`);
  return piece;
}

function rotate(square: SquareName, orientation: BoardOrientation): SquareName {
  let x = FILES.indexOf(square[0]);
  let y = Number(square[1]) - 1;
  for (let turns = orientation / 90; turns > 0; turns -= 1) [x, y] = [y, 7 - x];
  return `${FILES[x]}${y + 1}` as SquareName;
}

function roleState(role: Role, actor: Color, orientation: BoardOrientation): GameState {
  const opponent: Color = actor === "white" ? "black" : "white";
  const own = actor === "white" ? (value: string) => value.toUpperCase() : (value: string) => value;
  const enemy = opponent === "white" ? (value: string) => value.toUpperCase() : (value: string) => value;
  const pieces: Record<string, string> = role === "king"
    ? { c5: own("k"), e4: enemy("k") }
    : {
        b4: own("p"), b5: own("p"), b6: own("p"),
        c4: own("p"), c5: own("k"), c6: own("p"),
        d4: own("p"), d5: own("p"), d6: own("p"),
        e4: enemy(SYMBOL[role]), f5: enemy("k"),
      };
  const state = cardState(fen(pieces, actor), actor);
  state.orientation = orientation;
  return state;
}

function rookState(a8?: string): GameState {
  return cardState(fen({ c5: "K", f5: "k", d4: "r", ...(a8 ? { a8 } : {}) }));
}

test("Rebirth metadata matches the physical card", () => {
  assert.deepEqual(CARD_CATALOG.rebirth, {
    id: "rebirth",
    name: "Rebirth",
    points: 4,
    unique: true,
    image: "/KC6_card1.png",
    description:
      "Move one enemy piece to any square it could have occupied at the beginning of the game. The square must be empty or contain one of your pieces. If one of your pieces is in the square, it is captured.",
    timing: ["afterMove"],
    continuing: false,
  });
});

test("cardPlayTargets exposes every orientation-adjusted home square for every original role and owner", () => {
  for (const actor of ["white", "black"] as const) {
    const owner = actor === "white" ? "black" : "white";
    for (const orientation of [0, 90, 180, 270] as const) {
      for (const role of ROLES) {
        const targets = cardPlayTargets(roleState(role, actor, orientation), "rebirth") as unknown[][];
        const actual = targets
          .filter(target => Array.isArray(target) && (target[0] as { from?: unknown } | undefined)?.from === "e4")
          .map(target => (target[0] as { to: SquareName }).to)
          .sort();
        const expected = STARTS[owner][role].map(square => rotate(square, orientation)).sort();
        assert.deepEqual(actual, expected, `${actor}/${role}/${orientation}`);
      }
    }
  }
});

test("Rebirth can move every original role and owner at every board orientation", () => {
  for (const actor of ["white", "black"] as const) {
    const owner = actor === "white" ? "black" : "white";
    for (const orientation of [0, 90, 180, 270] as const) {
      for (const role of ROLES) {
        const state = roleState(role, actor, orientation);
        const source = pieceAt(state, "e4");
        const to = rotate(STARTS[owner][role][0], orientation);
        const next = accepted(play(state, [{ from: "e4", to }]));
        const moved = pieceAt(next, to);
        assert.equal(moved.id, source.id, `${actor}/${role}/${orientation}`);
        assert.equal(moved.owner, owner);
        assert.equal(moved.originalRole, role);
      }
    }
  }
});

test("Rebirth moves a black rook from d4 to its empty original a8 square", () => {
  const state = rookState();
  const source = pieceAt(state, "d4");
  const next = accepted(play(state, [{ from: "d4", to: "a8" }]));
  assert.equal(pieceAt(next, "a8").id, source.id);
  assert.equal(next.pieces.some(piece => piece.zone === "board" && piece.square === "d4"), false);
});

test("Rebirth captures a white occupant on a8 while returning the black rook", () => {
  const state = rookState("B");
  const occupant = pieceAt(state, "a8");
  const next = accepted(play(state, [{ from: "d4", to: "a8" }]));
  assert.equal(pieceAt(next, "a8").owner, "black");
  assert.deepEqual(
    next.pieces.find(piece => piece.id === occupant.id),
    { ...occupant, square: null, zone: "captured", capturedBy: "white" },
  );
  assert.equal(next.history.at(-1)?.capturedId, occupant.id);
});

test("Rebirth rejects an enemy-owned destination on a8", () => {
  const state = rookState("b");
  const target = [{ from: "d4", to: "a8" }];
  assert.equal(JSON.stringify(cardPlayTargets(state, "rebirth")).includes(JSON.stringify(target)), false);
  rejected(state, target);
});

test("neutral sources and neutral destination occupants are valid", () => {
  const neutralSourceState = cardState(fen({ c5: "K", f5: "k", d4: "R" }));
  pieceAt(neutralSourceState, "d4").neutral = true;
  assert.equal(pieceAt(accepted(play(neutralSourceState, [{ from: "d4", to: "a1" }])), "a1").owner, "white");

  const neutralDestinationState = rookState("b");
  const occupant = pieceAt(neutralDestinationState, "a8");
  occupant.neutral = true;
  const next = accepted(play(neutralDestinationState, [{ from: "d4", to: "a8" }]));
  assert.equal(next.pieces.find(piece => piece.id === occupant.id)?.zone, "captured");
});

test("Rebirth rejects own, absent, and off-board sources atomically", () => {
  rejected(cardState(fen({ c5: "K", f5: "k", d4: "R" })), [{ from: "d4", to: "a1" }]);
  rejected(rookState(), [{ from: "e4", to: "a8" }]);
  for (const zone of ["captured", "dead", "away"] as const) {
    const state = rookState();
    const source = pieceAt(state, "d4");
    source.square = null;
    source.zone = zone;
    rejected(state, [{ from: "d4", to: "a8" }]);
  }
});

test("Rebirth requires an exact, dense, one-element plain move array", () => {
  class MoveList extends Array<unknown> {}
  const extraArray = [{ from: "d4", to: "a8" }] as unknown[] & { extra?: boolean };
  extraArray.extra = true;
  const malformed: unknown[] = [
    undefined,
    null,
    "d4",
    {},
    [],
    new Array(1),
    [{ from: "d4", to: "a8" }, { from: "d4", to: "h8" }],
    [{ from: "d4" }],
    [{ to: "a8" }],
    [{ from: "z9", to: "a8" }],
    [{ from: "d4", to: "z9" }],
    [{ from: "d4", to: "d4" }],
    [{ from: "d4", to: "a8", extra: true }],
    extraArray,
    new MoveList({ from: "d4", to: "a8" }),
  ];
  for (const target of malformed) rejected(rookState(), target);
});

test("Rebirth cannot capture royal or capture-immune destination occupants", () => {
  for (const kind of ["royal", "pacifist"] as const) {
    const state = rookState("B");
    const occupant = pieceAt(state, "a8");
    if (kind === "royal") occupant.royal = true;
    else state.effects.push({
      type: "pacifism",
      owner: "white",
      card: { id: "white-effect-pacifism", cardId: "pacifism" },
      pieceId: occupant.id,
    });
    rejected(state, [{ from: "d4", to: "a8" }]);
  }
});

test("Rebirth preserves physical identity, transformations, promotion state, and markers without promoting", () => {
  for (const promoted of [false, true]) {
    const state = cardState(fen({ c5: "K", f5: "k", d4: "p" }));
    state.orientation = 90;
    const source = pieceAt(state, "d4");
    source.role = "queen";
    source.promoted = promoted;
    state.effects.push({
      type: "pacifism",
      owner: "black",
      card: { id: "black-effect-pacifism", cardId: "pacifism" },
      pieceId: source.id,
    });
    const destination = promoted ? "h5" : "g8";
    const identity = { ...source, square: destination as SquareName };
    const effects = structuredClone(state.effects);
    const next = accepted(play(state, [{ from: "d4", to: destination }]));
    assert.deepEqual(pieceAt(next, destination), identity);
    assert.deepEqual(next.effects, effects);
  }
});

test("a successful Rebirth spends, discards, replaces, counts, and records the card exactly once", () => {
  const state = rookState();
  const card = state.players.white.hand[0];
  const next = accepted(play(state, [{ from: "d4", to: "a8" }]));
  assert.deepEqual(next.players.white.hand.map(item => item.cardId), ["bog"]);
  assert.deepEqual(next.players.white.deck, []);
  assert.deepEqual(next.players.white.discard, [card]);
  assert.equal(next.turn.cardPlays.white, 1);
  assert.equal(next.turn.color, "white");
  assert.equal(next.turn.phase, "afterMove");
  assert.equal(next.turn.moveMade, true);
  const event = next.history.at(-1);
  assert.equal(event?.type, "cardPlayed");
  assert.equal(event?.cardId, "rebirth");
  assert.deepEqual(event?.target, [{ from: "d4", to: "a8" }]);
});

test("Rebirth preserves FEN turn, castling, en-passant, and move clocks", () => {
  const state = cardState("r3k2r/8/8/4p3/3n4/8/8/R3K2R w KQkq e6 17 42");
  const enPassant = structuredClone(state.enPassant);
  const next = accepted(play(state, [{ from: "d4", to: "b8" }]));
  assert.deepEqual(next.fen.split(" ").slice(1), ["w", "KQkq", "e6", "17", "42"]);
  assert.deepEqual(next.enPassant, enPassant);
});

test("a Rebirth that leaves the acting royal in check fizzles atomically but spends the card", () => {
  const state = cardState("r6k/8/8/8/n7/8/8/K7 w - - 0 1");
  const source = pieceAt(state, "a4");
  const next = accepted(play(state, [{ from: "a4", to: "b8" }]));
  assert.equal(pieceAt(next, "a4").id, source.id);
  assert.equal(next.pieces.some(piece => piece.zone === "board" && piece.square === "b8"), false);
  assert.equal(next.players.white.hand[0]?.cardId, "bog");
  assert.equal(next.history.at(-1)?.type, "cardFizzled");
  assert.equal(next.history.at(-1)?.reason, "SELF_CHECK");
});

test("a direct-mating Rebirth fizzles, while the same relocation may give non-mating check", () => {
  const mating = cardState("k7/r1K5/8/8/8/8/8/R7 w - - 0 1");
  const fizzled = accepted(play(mating, [{ from: "a7", to: "h8" }]));
  assert.equal(pieceAt(fizzled, "a7").owner, "black");
  assert.equal(fizzled.history.at(-1)?.type, "cardFizzled");
  assert.equal(fizzled.history.at(-1)?.reason, "DIRECT_MATE");

  const checking = cardState("k7/r7/2K5/8/8/8/8/R7 w - - 0 1");
  const succeeded = accepted(play(checking, [{ from: "a7", to: "h8" }]));
  assert.equal(pieceAt(succeeded, "h8").owner, "black");
  assert.equal(succeeded.history.at(-1)?.type, "cardPlayed");
});

test("Rebirth enforces its after-move window and per-turn card allowance atomically", () => {
  const wrongTiming = rookState();
  wrongTiming.turn.phase = "beforeMove";
  wrongTiming.turn.moveMade = false;
  rejected(wrongTiming, [{ from: "d4", to: "a8" }], "INVALID_TIMING");

  const allowanceSpent = rookState();
  allowanceSpent.turn.cardPlays.white = 1;
  rejected(allowanceSpent, [{ from: "d4", to: "a8" }], "CARD_ALREADY_PLAYED");
});
