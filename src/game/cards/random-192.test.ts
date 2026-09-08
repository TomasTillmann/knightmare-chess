import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–11, 16.3, 17.1, 20–22.
const rationales = `
1 e2-e4: White Pawn crosses empty e3; double step creates e3 opportunity.
2 knightmare: Black reacts to e2-e4, restores the starting position and prohibits that exact move this turn.
3 d2-d3: Different White Pawn advances one square; cancellation restriction is satisfied.
4 end: White completes the replacement move; Black receives fresh allowances.
5 c7-c5: Black Pawn crosses empty c6; fullmove becomes 2.
6 end: Black completes c7-c5; c6 opportunity survives.
7 e2-e4: White may now repeat the move canceled on its previous turn.
8 end: White completes e2-e4; e3 opportunity survives.
9 forced-march: Black c5-d5 and d7-c7 are simultaneous sideways Pawn steps to initially empty distinct squares.
10 end: Forced March has replaced Black's Regular Move.
11 g1-h3: White Knight makes a noncapturing L jump.
12 end: White completes Ng1-h3.
13 g8-h6: Black Knight makes a noncapturing L jump.
14 end: Black completes Ng8-h6.
15 f2-f4: White Pawn crosses empty f3, creating f3 opportunity.
16 cowardice: White moves the opposing d5 Pawn backwards through empty d6 to empty d7; completed move and f3 opportunity survive.
17 end: White completes the turn with Cowardice spent; raw f3 FEN is uncapturable.
18 h6-g4: Black Knight jumps to empty g4 and expires the f3 opportunity.
19 end: Black completes Nh6-g4.
20 bombard: White Ra1 jumps exactly the Pawn on a2 and lands on empty a3; a1 castling right is lost.
21 end: Bombard has replaced White's Regular Move.
22 g4-h2: Black Knight captures the White h2 Pawn with an L jump.
23 end: Black completes Ng4xh2.
24 b2-b3: White Pawn advances one square into empty b3.
25 end: White completes b2-b3.
26 tournament: Black h2 Knight swaps with White h3 Knight; non-move exchange consumes the Regular Move, with no Shield-eligible moved identity.
27 end: Black completes Tournament; no extra movement is allowed.
28 f4-f5: White Pawn advances to empty f5.
29 end: White completes f4-f5.
30 disintegration: Black e7 Pawn becomes dead, freeing e7 without consuming the Regular Move.
31 d8-h4: Black Queen slides diagonally through e7, f6, g5 to h4 and checks e1 along g3/f2.
32 end: Black completes Qd8-h4; White receives an escape turn.
33 h2-f3: Noncapturing White Knight jump leaves Qh4 checking e1 provisionally; held Charge can capture Qh4 immediately.
34 charge: Same White Knight jumps f3-h4 and captures the checking Queen; extra move cures check and spends Charge.
35 end: White safely completes the Charge rescue.
36 a7-a5: Black Pawn crosses empty a6, creating a6 opportunity.
37 end: Black completes a7-a5.
38 c1-g5: White Bishop slides through empty d2/e3/f4 to g5.
39 end: White completes Bc1-g5.
40 f8-a3: Black Bishop slides through e7/d6/c5/b4 and captures White Ra3.
41 end: Black completes Bf8xa3.
42 d3-d4: White Pawn advances to empty d4.
43 end: White completes d3-d4.
44 a3-d6: Black Bishop slides through empty b4/c5 to d6.
45 end: Black completes Ba3-d6.
46 e1-d2: White King moves one diagonal step into a safe square and loses remaining castling rights.
47 end: White completes Ke1-d2.
48 h8-f8: Black Rook slides through empty g8; kingside castling right is lost.
49 end: Black completes Rh8-f8.
50 d1-e2: White Queen moves diagonally one square to e2.
51 end: White completes Qd1-e2.
52 h7-h6: Black Pawn advances one square.
53 end: Black completes h7-h6.
54 h4-f3: White Knight jumps to empty f3.
55 end: White completes Nh4-f3.
56 f7-f6: Black Pawn advances one square to f6.
57 end: Black completes f7-f6.
58 a2-a4: White Pawn crosses empty a3 to a4, creating a3 opportunity.
59 end: White completes a2-a4; no adjacent Black Pawn can capture en passant.
60 b8-c6: Black Knight jumps to empty c6.
61 end: Black completes Nb8-c6.
62 e2-a6: White Queen slides through empty d3/c4/b5 to a6.
63 end: White completes Qe2-a6.
64 masquerade: Black non-Pawn Knight on c6 uses one Queen diagonal step to empty b5; no capture.
65 end: Masquerade has replaced Black's Regular Move.
66 breakthrough: White a4 Pawn captures the Black Pawn directly forward on a5.
67 end: Breakthrough has replaced White's Regular Move.
68 a8-a7: Black Rook steps to empty a7; final castling right is lost.
69 end: Black completes Ra8-a7.
70 b1-a3: White Knight jumps to empty a3.
71 end: White completes Nb1-a3.
72 b7-b6: Black Pawn advances into empty b6.
73 end: Black completes b7-b6.
74 e4-e5: White Pawn advances to empty e5.
75 end: White completes e4-e5.
76 c8-a6: Black Bishop passes empty b7 and captures White Qa6.
77 end: Black completes Bc8xa6.
78 c2-c4: White Pawn crosses empty c3; c3 opportunity has no adjacent Black captor.
79 end: White completes c2-c4.
80 e8-e7: Black King moves one square into safe e7.
81 end: Black completes Ke8-e7.
82 g2-g3: White Pawn advances one square into empty g3.
83 end: White completes g2-g3.
84 h6-h5: Black Pawn advances one square into empty h5.
85 end: Black completes h6-h5.
86 f3-h2: White Knight jumps to empty h2.
87 end: White completes Nf3-h2.
88 f8-d8: Black Rook slides through empty e8 to d8.
89 man-trap: After its move Black marks d6, occupied by its Bishop; retain exact card as square-bound effect and draw once.
90 end: Black completes the turn with the d6 trap active.
91 g5-f4: White Bishop steps diagonally to f4 without entering d6.
92 end: White completes Bg5-f4; trap remains.
93 d6-b4: Black Bishop crosses empty c5 and lands on b4, checking Kd2 through c3; vacating d6 does not remove its trap.
94 end: Black completes Bd6-b4 and White receives an escape turn.
95 d4-d5: White Pawn advances but leaves Kd2 in check provisionally; held Coup can make safe Pawn d5 royal.
96 coup: White d2 King becomes nonroyal Prince; d5 Pawn becomes royal without changing either movement role; safe new royal cures check.
97 end: White completes the Coup rescue with its royal Pawn safe on d5.
98 h3-f4: Black Knight captures White Bf4 with an L jump; White royal Pawn remains safe.
99 end: Black completes Nh3xf4.
100 g3-f4: White Pawn captures Black Nf4 one diagonal step forward.
101 end: White completes g3xf4.
102 a7-a8: Black Rook steps to empty a8; castling rights cannot return.
103 end: Black completes Ra7-a8.
104 a5-b6: White Pawn captures Black b6 Pawn diagonally forward.
105 revenge: Black reacts by capturing White nonroyal c4 Pawn; it does not move a piece or undo a5xb6.
106 end: White ends its turn with Black's Revenge spent.
107 g7-g6: Black Pawn advances one square into empty g6.
108 end: Black completes g7-g6.
109 h1-g1: White Rook steps to empty g1; Prince d2 need not be protected from check.
110 end: White completes Rh1-g1.
111 d8-b8: Black Rook slides through empty c8 to b8.
112 end: Black completes Rd8-b8.
113 h2-f3: White Knight jumps to empty f3.
114 end: White completes Nh2-f3.
115 a6-c8: Black Bishop slides through empty b7 to c8.
116 end: Black completes Ba6-c8; d6 trap and Coup remain active.
`.trim().split('\n');

const cardActions: Record<number, GameAction> = {
  2: { type: 'playCard', cardId: 'knightmare', cardInstanceId: 'black-hand-0-knightmare' },
  9: { type: 'playCard', cardId: 'forced-march', cardInstanceId: 'black-hand-4-forced-march', target: [{ from: 'c5', to: 'd5' }, { from: 'd7', to: 'c7' }] },
  16: { type: 'playCard', cardId: 'cowardice', cardInstanceId: 'white-hand-1-cowardice', target: [{ from: 'd5', to: 'd7' }] },
  20: { type: 'playCard', cardId: 'bombard', cardInstanceId: 'white-deck-0-bombard', target: [{ from: 'a1', to: 'a3' }] },
  26: { type: 'playCard', cardId: 'tournament', cardInstanceId: 'black-hand-2-tournament', target: { own: 'h2', opponent: 'h3' } },
  30: { type: 'playCard', cardId: 'disintegration', cardInstanceId: 'black-hand-1-disintegration', target: 'e7' },
  34: { type: 'playCard', cardId: 'charge', cardInstanceId: 'white-hand-2-charge', target: [{ from: 'f3', to: 'h4' }] },
  64: { type: 'playCard', cardId: 'masquerade', cardInstanceId: 'black-hand-3-masquerade', target: [{ from: 'c6', to: 'b5' }] },
  66: { type: 'playCard', cardId: 'breakthrough', cardInstanceId: 'white-deck-2-breakthrough', target: [{ from: 'a4', to: 'a5' }] },
  89: { type: 'playCard', cardId: 'man-trap', cardInstanceId: 'black-deck-2-man-trap', target: 'd6' },
  96: { type: 'playCard', cardId: 'coup', cardInstanceId: 'white-deck-3-coup', target: 'd5' },
  105: { type: 'playCard', cardId: 'revenge', cardInstanceId: 'black-deck-0-revenge', target: 'c4' },
};

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
function ray(pieces: PieceState[], from: string, to: string): PieceState[] {
  const [x, y] = xy(from), [u, v] = xy(to), dx = u - x, dy = v - y;
  assert.ok((dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && (dx || dy));
  const blockers: PieceState[] = [];
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    const p = at(pieces, `${String.fromCharCode(97 + x + n * Math.sign(dx))}${y + 1 + n * Math.sign(dy)}`);
    if (p) blockers.push(p);
  }
  return blockers;
}
function attacks(pieces: PieceState[], piece: PieceState, square: string): boolean {
  if (!piece.square) return false;
  const [x, y] = xy(piece.square), [u, v] = xy(square), dx = Math.abs(u - x), dy = Math.abs(v - y);
  switch (piece.role) {
    case 'pawn': return dx === 1 && v - y === (piece.owner === 'white' ? 1 : -1);
    case 'knight': return dx * dy === 2;
    case 'king': return Math.max(dx, dy) === 1;
    case 'bishop': return dx > 0 && dx === dy && !ray(pieces, piece.square, square).length;
    case 'rook': return !!(dx || dy) && (dx === 0 || dy === 0) && !ray(pieces, piece.square, square).length;
    case 'queen': return !!(dx || dy) && (dx === 0 || dy === 0 || dx === dy) && !ray(pieces, piece.square, square).length;
  }
}
function check(pieces: PieceState[], color: Color): boolean {
  const royal = pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(royal.square);
  // Only Man-Trap and Coup persist in this trace; neither suppresses geometric threats.
  return pieces.some(p => p.zone === 'board' && p.owner !== color && attacks(pieces, p, royal.square!));
}
function board(pieces: PieceState[]): string {
  const symbols = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, i) => {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const p = at(pieces, `${file}${8 - i}`);
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role];
    }
    return row + (empty || '');
  }).join('/');
}
function transition(before: GameState, action: GameAction, step: number): GameState {
  const e = structuredClone(before), actor = before.turn.color;
  let [, active, rights, ep, half, full] = before.fen.split(' ');
  const pieces = e.pieces;
  const move = (from: string, to: string, mode: 'ordinary' | 'sideways' | 'backward' | 'bombard' | 'queen' | 'forwardCapture' = 'ordinary') => {
    const p = at(pieces, from), victim = at(pieces, to);
    assert.ok(p, `step ${step}: ${from} occupied`);
    const [x, y] = xy(from), [u, v] = xy(to), dx = Math.abs(u - x), dy = Math.abs(v - y);
    if (mode !== 'backward') assert.equal(p.owner, actor);
    else assert.equal(p.owner, opposite(actor));
    if (victim) { assert.notEqual(victim.owner, actor); assert.equal(victim.royal, false); }
    if (mode === 'sideways') { assert.equal(p.role, 'pawn'); assert.equal(dx, 1); assert.equal(dy, 0); assert.equal(victim, undefined); }
    else if (mode === 'backward') {
      assert.equal(p.role, 'pawn'); assert.equal(dx, 0); assert.ok(dy === 1 || dy === 2);
      assert.equal(Math.sign(v - y), p.owner === 'white' ? -1 : 1); assert.equal(ray(pieces, from, to).length, 0); assert.equal(victim, undefined);
    } else if (mode === 'bombard') {
      assert.equal(p.role, 'rook'); assert.ok(dx === 0 || dy === 0); assert.ok(ray(pieces, from, to).length <= 1);
      assert.deepEqual(ray(pieces, from, to).map(q => q.id), ['white-pawn-a2']);
    } else if (mode === 'queen') {
      assert.notEqual(p.role, 'pawn'); assert.ok(dx === 0 || dy === 0 || dx === dy); assert.equal(ray(pieces, from, to).length, 0); assert.equal(victim, undefined);
    } else if (mode === 'forwardCapture') {
      assert.equal(p.role, 'pawn'); assert.equal(dx, 0); assert.equal(v - y, actor === 'white' ? 1 : -1); assert.ok(victim);
    } else if (p.role === 'pawn' && !victim) {
      assert.equal(dx, 0); const direction = actor === 'white' ? 1 : -1;
      assert.ok(v - y === direction || (y === (actor === 'white' ? 1 : 6) && v - y === 2 * direction));
      assert.equal(ray(pieces, from, to).length, 0);
    } else assert.ok(attacks(pieces, p, to), `step ${step}: legal ${p.role} geometry ${from}-${to}`);
    if (victim) { victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor; }
    assert.match(to, /^[a-h][1-8]$/); p.square = to as SquareName;
    if (p.role === 'king') rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '');
    for (const [sq, flag] of [['a1', 'Q'], ['h1', 'K'], ['a8', 'q'], ['h8', 'k']]) if (from === sq || to === sq) rights = rights.replace(flag, '');
    return { p, victim };
  };
  const complete = (pawnOrCapture: boolean, ids: string[]) => {
    active = actor === 'white' ? 'b' : 'w'; half = String(pawnOrCapture ? 0 : Number(half) + 1);
    full = String(Number(full) + (actor === 'black' ? 1 : 0)); ep = '-'; e.enPassant = [];
    e.turn.phase = 'afterMove'; e.turn.moveMade = true;
    e.shieldMove = { player: actor, pieceIds: ids, capturedOpponent: false };
  };
  if (action.type === 'endTurn') {
    assert.equal(before.turn.moveMade, true); assert.equal(check(pieces, actor), false);
    e.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    delete e.shieldMove; delete e.chaosForbidden;
  } else if (action.type === 'move') {
    assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
    const from = action.from, to = action.to;
    assert.equal(before.turn.moveMade, false); assert.equal(action.promotion, undefined);
    const { p, victim } = move(from, to);
    complete(p.role === 'pawn' || !!victim, [p.id]);
    e.shieldMove!.capturedOpponent = !!victim;
    if (p.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2) {
      e.enPassant = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }];
    }
    const event: GameEvent = { type: 'move', from: from as SquareName, to: to as SquareName };
    if (victim) event.capturedId = victim.id;
    if (actor === 'white') { event.movedPieceId = p.id; event.movedRoles = [p.role]; }
    e.history.push(event); delete e.chaosForbidden;
  } else {
    assert.equal(action.type, 'playCard');
    if (action.type !== 'playCard') throw Error('unreviewed action');
    assert.deepEqual(action, cardActions[step]);
    const owner: Color = step === 2 || step === 105 ? opposite(actor) : actor;
    const player = e.players[owner], card = player.hand.find(c => c.id === action.cardInstanceId)!;
    assert.ok(card); assert.equal(card.cardId, action.cardId); assert.equal(e.turn.cardPlays[owner], 0);
    const metadata = CARD_CATALOG[card.cardId];
    assert.ok(metadata.timing.includes(owner === actor ? before.turn.phase : 'afterOpponentMove'));
    if (owner !== actor) assert.equal(before.turn.moveMade, true);
    player.hand = player.hand.filter(c => c.id !== card.id);
    if (!metadata.continuing) player.discard.push(card);
    player.hand.push(player.deck.shift()!); e.turn.cardPlays[owner]++;
    e.playedCards ??= []; e.playedCards.push({ player: owner, cardInstanceId: card.id });
    let event: GameEvent = { type: 'cardPlayed', cardId: card.cardId, target: action.target as GameEvent['target'], movement: [], preservePreviousMove: before.turn.moveMade };
    switch (step) {
      case 2: {
        const p = at(pieces, 'e4')!; p.square = 'e2'; active = 'w'; half = '0'; full = '1'; ep = '-'; e.enPassant = [];
        e.turn.phase = 'beforeMove'; e.turn.moveMade = false; delete e.shieldMove;
        e.chaosForbidden = { player: 'white', movement: 'white-pawn-e2:e2:e4' };
        e.history = []; event = { type: 'cardPlayed', cardId: 'knightmare', player: 'black', movement: [{ from: 'e4', to: 'e2' }], preservePreviousMove: true }; break;
      }
      case 9: {
        assert.equal(at(pieces, 'd5'), undefined); assert.equal(at(pieces, 'c7'), undefined);
        const a = move('c5', 'd5', 'sideways'), b = move('d7', 'c7', 'sideways');
        complete(true, [a.p.id, b.p.id]); event.movement = [{ from: 'c5', to: 'd5' }, { from: 'd7', to: 'c7' }]; break;
      }
      case 16: move('d5', 'd7', 'backward'); ep = 'f3'; event.movement = [{ from: 'd5', to: 'd7' }]; break;
      case 20: { const { p } = move('a1', 'a3', 'bombard'); complete(false, [p.id]); event.movement = [{ from: 'a1', to: 'a3' }]; break; }
      case 26: {
        const a = at(pieces, 'h2')!, b = at(pieces, 'h3')!;
        assert.equal(a.role, 'knight'); assert.equal(a.owner, 'black'); assert.equal(b.role, 'knight'); assert.equal(b.owner, 'white');
        a.square = 'h3'; b.square = 'h2'; complete(false, []);
        event.movement = [{ from: 'h3', to: 'h2' }, { from: 'h2', to: 'h3' }]; break;
      }
      case 30: { const p = at(pieces, 'e7')!; assert.equal(p.role, 'pawn'); assert.equal(p.owner, 'black'); p.zone = 'dead'; p.square = null; break; }
      case 34: {
        assert.equal(before.shieldMove?.capturedOpponent, false); assert.deepEqual(before.shieldMove?.pieceIds, ['white-knight-g1']);
        const { p, victim } = move('f3', 'h4'); assert.equal(victim?.id, 'black-queen-d8');
        half = '0'; ep = '-'; e.enPassant = []; e.shieldMove = { player: actor, pieceIds: [p.id], capturedOpponent: true };
        event = { type: 'cardPlayed', cardId: 'charge', from: 'f3', to: 'h4', capturedId: victim!.id, movedPieceId: p.id, movedRoles: ['knight'], target: [{ from: 'f3', to: 'h4' }], movement: [{ from: 'f3', to: 'h4' }], preservePreviousMove: false }; break;
      }
      case 64: { const { p } = move('c6', 'b5', 'queen'); complete(false, [p.id]); event.movement = [{ from: 'c6', to: 'b5' }]; break; }
      case 66: {
        const { p, victim } = move('a4', 'a5', 'forwardCapture'); complete(true, [p.id]); e.shieldMove!.capturedOpponent = true;
        event.capturedId = victim!.id; event.movement = [{ from: 'a4', to: 'a5' }]; break;
      }
      case 89: assert.equal(at(pieces, 'd6')!.owner, owner); e.effects.push({ type: 'man-trap', owner, card, square: 'd6' }); delete event.target; break;
      case 96: {
        const prince = at(pieces, 'd2')!, king = at(pieces, 'd5')!;
        assert.equal(prince.royal, true); assert.equal(king.owner, owner); assert.equal(king.role, 'pawn');
        prince.royal = false; king.royal = true;
        e.effects.push({ type: 'coup', owner, card, princeId: prince.id, kingId: king.id, princeRole: 'king' }); break;
      }
      case 105: {
        const p = at(pieces, 'c4')!; assert.equal(p.owner, opposite(owner)); assert.equal(p.role, 'pawn'); assert.equal(p.royal, false);
        p.square = null; p.zone = 'captured'; p.capturedBy = owner; event.capturedId = p.id; break;
      }
      default: throw Error(`unreviewed card ${step}`);
    }
    e.history.push(event);
  }
  e.fen = `${board(pieces)} ${active} ${rights && rights !== '-' ? rights : '-'} ${ep} ${half} ${full}`;
  return e;
}

function immutableAction(state: GameState, action: GameAction): GameState {
  const original = structuredClone(state), payload = structuredClone(action);
  const result = applyAction(state, action);
  assert.deepEqual(state, original, 'action input state immutable'); assert.deepEqual(action, payload, 'action payload immutable');
  assert.ok(result.ok, JSON.stringify(action)); return result.state;
}
function verify(actual: GameState, expected: GameState, step: number) {
  for (const key of ['fen', 'pieces', 'players', 'turn', 'effects', 'history'] as const) assert.deepEqual(actual[key], expected[key], `step ${step}: independent ${key}`);
  assert.deepEqual(actual.playedCards ?? [], expected.playedCards ?? []);
  assert.deepEqual(actual.enPassant, expected.enPassant); assert.equal(actual.orientation, 0); assert.equal(actual.outcome, null);
  assert.deepEqual(actual.shieldMove, expected.shieldMove); assert.deepEqual(actual.chaosForbidden, expected.chaosForbidden);
  assert.equal(actual.plotsExecution, undefined); assert.deepEqual(actual.plotsAllowances ?? [], []); assert.deepEqual(actual.fogLocked ?? [], []);
  assert.deepEqual(actual.riposteLostMoves ?? [], []); assert.equal(actual.riposteSkipped, undefined); assert.equal(actual.riposteCheckDeferred, undefined);
  assert.equal(actual.pendingDoomsayer ?? null, null); assert.equal(actual.pendingAbduction ?? null, null); assert.deepEqual(actual.underElfHill ?? [], []);
  const original = structuredClone(actual);
  for (const color of ['white', 'black'] as const) assert.equal(isKingInCheck(actual, color), check(expected.pieces, color), `step ${step}: ${color} physical royal threats`);
  assert.deepEqual(actual, original, 'royal query immutable');
  // Every EP opportunity in this trace lacks a geometrically adjacent enemy Pawn.
  // Query from the prospective capturing player's before-move window, not the actor's after-move window.
  for (const opportunity of expected.enPassant) {
    const victim = expected.pieces.find(p => p.id === opportunity.pawnId)!;
    assert.ok(victim.square);
    const prospective = opposite(victim.owner);
    const candidates = expected.pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === prospective && attacks(expected.pieces, p, opportunity.target));
    assert.deepEqual(candidates, [], 'independent absence of en-passant captor');
    const probe = structuredClone(actual); probe.turn = { color: prospective, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    const fields = probe.fen.split(' '); fields[1] = prospective === 'white' ? 'w' : 'b'; probe.fen = fields.join(' ');
    const saved = structuredClone(probe), destinations = legalDests(probe);
    for (const p of probe.pieces.filter(p => p.owner === prospective && p.role === 'pawn' && p.square)) {
      if (p.square![0] !== opportunity.target[0]) assert.equal(destinations.get(p.square!)?.includes(opportunity.target) ?? false, false);
    }
    assert.deepEqual(probe, saved, 'en-passant query immutable');
  }
}

test('iteration 192 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/192.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, rationales.length); assert.equal(rationales.length, 116);
  let state = createGameState(trace.initial), model = structuredClone(state), reviewed = 0, rescues = 0;
  assert.equal(state.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(state.pieces.length, 32);
  assert.deepEqual(state.effects, []); assert.deepEqual(state.history, []);
  for (const [index, entry] of trace.steps.entries()) {
    const n = index + 1, rationale = rationales[index], before = state, modelBefore = model;
    assert.ok(rationale.startsWith(`${n} `));
    const label = rationale.split(' ')[1].split(':')[0];
    if (entry.action.type === 'move') assert.deepEqual(entry.action, { type: 'move', from: label.slice(0, 2), to: label.slice(3, 5) });
    else if (entry.action.type === 'endTurn') assert.equal(label, 'end');
    else assert.deepEqual(entry.action, cardActions[n]);
    model = transition(model, entry.action, n); state = immutableAction(before, entry.action);
    verify(state, model, n);
    const pending = n === 33 || n === 95;
    assert.equal(!!state.pendingRescue, pending);
    assert.equal(check(model.pieces, before.turn.color), pending, `step ${n}: acting royal must be safe except witnessed provisional moves`);
    if (entry.action.type === 'playCard') assert.equal(check(model.pieces, opposite(before.turn.color)), false, 'no card directly creates checkmate');
    if (n === 2) {
      const saved = structuredClone(state), repeated: GameAction = { type: 'move', from: 'e2', to: 'e4' }, payload = structuredClone(repeated);
      const result = applyAction(state, repeated);
      assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
      assert.deepEqual(state, saved); assert.deepEqual(result.state, saved); assert.deepEqual(repeated, payload);
    }
    if (n === 26) {
      // §16.3: a non-move swap supplies no Shield target, even with an otherwise available card allowance.
      const probe = structuredClone(state);
      probe.turn.cardPlays.black = 0;
      probe.players.black.hand.push({ id: 'iteration-192-shield-probe', cardId: 'mystic-shield' });
      const saved = structuredClone(probe);
      assert.deepEqual(cardPlayTargets(probe, 'mystic-shield'), []); assert.deepEqual(probe, saved);
      for (const target of ['h3', 'h2']) {
        const action: GameAction = { type: 'playCard', cardId: 'mystic-shield', cardInstanceId: 'iteration-192-shield-probe', target };
        const payload = structuredClone(action), result = applyAction(probe, action);
        assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
        assert.deepEqual(result.state, saved); assert.deepEqual(probe, saved); assert.deepEqual(action, payload);
      }
    }
    if (pending) {
      const token = state.pendingRescue!;
      assert.equal(check(model.pieces, 'white'), true);
      assert.equal(token.fen, before.fen); assert.deepEqual(token.pieces, before.pieces); assert.deepEqual(token.enPassant, before.enPassant);
      assert.equal(token.historyLength, before.history.length); assert.deepEqual(token.history ?? before.history, before.history);
      assert.deepEqual(token.movedPieceIds, [n === 33 ? 'white-knight-g1' : 'white-pawn-d2']);
      assert.ok(token.before); verify(token.before, modelBefore, n);
      const cure = cardActions[n + 1];
      assert.ok(cure && cure.type === 'playCard');
      assert.ok(state.players.white.hand.some(c => c.id === cure.cardInstanceId));
      const expectedCure = transition(model, cure, n + 1), cured = immutableAction(state, cure);
      verify(cured, expectedCure, n + 1); assert.equal(cured.pendingRescue ?? null, null);
      assert.equal(check(expectedCure.pieces, 'white'), false);
      assert.equal(expectedCure.turn.moveMade, true); assert.equal(expectedCure.turn.cardPlays.white, 1);
      const expectedEnd = transition(expectedCure, { type: 'endTurn' }, n + 2), ended = immutableAction(cured, { type: 'endTurn' });
      verify(ended, expectedEnd, n + 2); assert.equal(ended.turn.color, 'black');
      rescues++;
    }
    reviewed++;
  }
  assert.equal(reviewed, rationales.length); assert.equal(rescues, 2);
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 12);
  assert.equal(state.fen, 'rrb5/2ppk3/1P3pp1/1n1PPP1p/1b3P2/NP3N2/3K4/5BR1 w - - 4 28');
  assert.equal(replayTrace(trace).fen, state.fen);
});
