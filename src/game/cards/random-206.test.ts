import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameEvent, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Explicitly reviewed commands and rationales; no rationale is produced from a digest.
const review = `
1 card Tournament exchanges white b1 and black g8 Knights; neither royal is attacked; non-move swap consumes White's move.
2 end White closes the exchange; Black receives a fresh allowance.
3 b1a3 Black's exchanged Knight jumps to empty a3.
4 end Black closes its quiet Knight move.
5 e2e3 White advances its Pawn one square into empty e3.
6 end White closes its Pawn move.
7 h7h5 Black advances two from its initial rank through empty h6; no White Pawn can capture en passant.
8 end Black passes the h6 opportunity to White.
9 b2b4 White advances through empty b3; no Black Pawn can capture en passant.
10 card White's drawn Challenge selects black g7 Pawn, which can legally advance to g6 or g5; b3 opportunity survives.
11 end White closes; Black must move the challenged physical Pawn.
12 g7g5 Black satisfies Challenge by advancing through empty g6; no en-passant captor exists.
13 end Black closes; Challenge has expired.
14 b4b5 White advances its Pawn one square.
15 end White closes its quiet Pawn move.
16 a3c4 Black Knight jumps to empty c4.
17 end Black closes its Knight move.
18 card White's Under Elf Hill removes its royal e1 identity to away, revokes castling and consumes the move.
19 end White closes its replacement; the King remains absent during Black's turn.
20 c4d6 Black Knight jumps to empty d6 while White's King is absent.
21 card Black plays Truce after its move; no on-board royal is attacked and captures become forbidden.
22 end Black closes; White's absent King now has a mandatory return.
23 return White returns the same King to empty safe edge e1, without restoring castling or moving a clock.
24 f1d3 White Bishop slides through empty e2 to d3; the returned King stays fixed.
25 end White closes and its returned-King restriction expires.
26 e7e5 Black Pawn advances through empty e6; no White Pawn can capture en passant and Truce remains.
27 end Black closes and preserves its uncapturable e6 opportunity.
28 a1b1 White Rook slides one square to empty b1.
29 end White closes its Rook move.
30 c7c6 Black Pawn advances one square to empty c6.
31 end Black closes its Pawn move.
32 b1b3 White Rook slides through empty b2.
33 end White closes its Rook move.
34 d8f6 Black Queen slides diagonally through vacated e7 to empty f6.
35 end Black closes its Queen move.
36 e1f1 White King steps to empty safe f1 after its return restriction expired.
37 end White closes its King move.
38 card Black Long Jump relocates its d6 Knight to empty opposite-color e2, consuming the move; it attacks neither King.
39 end Black closes the Long Jump replacement.
40 a2a3 White Pawn advances to empty a3.
41 end White closes its Pawn move.
42 f6f5 Black Queen slides to empty f5.
43 end Black closes its Queen move.
44 g2g3 White Pawn advances to empty g3.
45 end White closes its Pawn move.
46 h8h7 Black Rook slides to vacated h7, losing kingside castling.
47 card Black Earthquake rotates forward east for White and west for Black; White h2 promotes to Knight before Black a7 promotes to Bishop; no raw royal check ends Truce.
48 end Black closes after both compulsory promotions.
49 c1b2 White Bishop slides diagonally to empty b2.
50 end White closes its Bishop move.
51 e8d8 Black King steps to empty safe d8, losing its remaining castling right.
52 end Black closes its King move.
53 h2f3 White's promoted physical h2 Pawn uses Knight geometry to empty f3.
54 end White closes its promoted Knight move.
55 f8b4 Black Bishop slides through empty e7,d6,c5 to empty b4.
56 end Black closes its Bishop move.
57 d1e1 White Queen slides one square to empty e1.
58 end White closes its Queen move.
59 f7e7 Black Pawn advances west under Earthquake to empty e7.
60 end Black closes its rotated Pawn move.
61 b3c3 White Rook slides to empty c3.
62 end White closes its Rook move.
63 card Black Irresistible Force advances e7 Pawn west into occupied d7, pushing the d7 Pawn into empty c7; neither is captured under Truce.
64 end Black closes its two-Pawn replacement move.
65 f2g2 White Pawn advances east under Earthquake to empty g2.
66 end White closes its rotated Pawn move.
67 e2c1 Black Knight jumps to vacated c1.
68 end Black closes its Knight move.
69 h1h4 White Rook slides through empty h2,h3 to empty h4.
70 end White closes its Rook move.
71 c1b3 Black Knight jumps to vacated b3.
72 end Black closes its Knight move.
73 h4g4 White Rook slides to empty g4.
74 end White closes its Rook move.
75 f5g6 Black Queen slides diagonally to empty g6.
76 end Black closes its Queen move.
77 f3h2 White's promoted Knight jumps back to empty h2, retaining promotion.
78 end White closes its promoted Knight move.
79 g5f5 Black Pawn advances west to vacated f5.
80 end Black closes its rotated Pawn move.
81 c3c5 White Rook slides through empty c4 to empty c5.
82 end White closes its Rook move.
83 g6e6 Black Queen slides through empty f6 to empty e6.
84 end Black closes its Queen move.
85 f1e2 White King steps diagonally to empty safe e2.
86 end White closes its King move.
87 h7h6 Black Rook slides to empty h6.
88 card Black Forbidden City marks empty d5 after its move, keeping the physical card in the continuing effect.
89 end Black closes with d5 now impassable.
90 e2f2 White King steps to empty safe f2.
91 end White closes its King move.
92 d8e8 Black King returns to empty safe e8 without recovering castling.
93 end Black closes its King move.
94 b2c3 White Bishop slides to vacated c3.
95 end White closes its Bishop move.
96 e6d6 Black Queen slides to empty d6, avoiding forbidden d5.
97 end Black closes its Queen move.
98 e1c1 White Queen slides through empty d1 to empty c1.
99 card White Dungeon relocates black b3 Knight to empty corner a1, preserves the completed Queen move and forbids that identity next Black turn.
100 end White closes; Black's a1 Knight is now restricted.
101 d6g6 Black Queen slides through empty e6,f6; the Dungeon Knight stays put.
102 end Black closes and its Dungeon restriction expires.
103 f2f3 White King steps to empty safe f3.
104 end White closes its King move.
105 h6h7 Black Rook slides to empty h7.
106 end Black closes its Rook move.
107 g8e7 White's exchanged Knight jumps to vacated e7, without checking e8.
108 end White closes its Knight move.
109 g6h6 Black Queen slides to empty h6.
110 end Black closes its Queen move.
111 d3c4 White Bishop slides to empty c4, avoiding forbidden d5.
112 end White closes its Bishop move.
113 card Black's drawn Madman moves the c6 Pawn diagonally over White's b5 Pawn to empty a4; jumped Pawn remains and the move resets the clock.
114 end Black closes its Madman replacement.
115 c4f1 White Bishop slides through empty d3,e2 to empty f1; Black's newly drawn Bog has a multi-square rollback window with the complete prior FEN retained.
116 end White closes the fiftieth ordinary move; no royal attack or mandatory choice remains.
`.trim().split('\n');

const cards: Record<number, { id: string; instance: string; target?: unknown; replacement?: boolean }> = {
  1: { id: 'tournament', instance: 'white-hand-3-tournament', target: { own: 'b1', opponent: 'g8' }, replacement: true },
  10: { id: 'challenge', instance: 'white-deck-0-challenge', target: 'g7' },
  18: { id: 'under-elf-hill', instance: 'white-hand-4-under-elf-hill', replacement: true },
  21: { id: 'truce', instance: 'black-hand-4-truce' },
  38: { id: 'long-jump', instance: 'black-hand-0-long-jump', target: [{ from: 'd6', to: 'e2' }], replacement: true },
  47: { id: 'earthquake', instance: 'black-hand-3-earthquake', target: { direction: 'clockwise', promotions: [{ square: 'h2', role: 'knight' }, { square: 'a7', role: 'bishop' }] } },
  63: { id: 'irresistible-force', instance: 'black-hand-1-irresistible-force', target: [{ from: 'e7', to: 'd7' }], replacement: true },
  88: { id: 'forbidden-city', instance: 'black-hand-2-forbidden-city', target: 'd5' },
  99: { id: 'dungeon', instance: 'white-hand-0-dungeon', target: [{ from: 'b3', to: 'a1' }] },
  113: { id: 'madman', instance: 'black-deck-4-madman', target: [{ from: 'c6', to: 'a4' }], replacement: true },
};
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);

// Physical-board geometry, including rotated Pawns and forbidden square paths.
// Truce is deliberately ignored here: a raw royal attack would terminate it.
function reaches(pieces: PieceState[], piece: PieceState, to: string, rotated: boolean, forbidden: boolean, capture: boolean): boolean {
  if (!piece.square || piece.zone !== 'board' || piece.square === to || forbidden && to === 'd5') return false;
  const [x, y] = xy(piece.square), [tx, ty] = xy(to), dx = tx - x, dy = ty - y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (piece.role === 'knight') return ax * ay === 2;
  if (piece.role === 'king') return Math.max(ax, ay) === 1;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    const forward = (rotated ? dx : dy) * direction, side = rotated ? ay : ax;
    if (capture) return forward === 1 && side === 1;
    if (side || forward < 1 || forward > 2) return false;
    if (forward === 1) return true;
    if (rotated || y !== (piece.owner === 'white' ? 1 : 6)) return false;
    return !at(pieces, `${String.fromCharCode(97 + x)}${y + 1 + direction}`);
  }
  if (piece.role === 'bishop' && ax !== ay || piece.role === 'rook' && dx !== 0 && dy !== 0
    || piece.role === 'queen' && ax !== ay && dx !== 0 && dy !== 0) return false;
  for (let k = 1; k < Math.max(ax, ay); k++) {
    const square = `${String.fromCharCode(97 + x + k * Math.sign(dx))}${y + 1 + k * Math.sign(dy)}`;
    if (at(pieces, square) || forbidden && square === 'd5') return false;
  }
  return true;
}

function rawCheck(pieces: PieceState[], color: Color, n: number): boolean {
  const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  if (!king?.square) return false;
  return pieces.some(p => p.owner !== color
    && !(n >= 23 && n <= 24 && p.id === 'white-king-e1')
    && !(n >= 100 && n <= 101 && p.id === 'black-knight-g8')
    && reaches(pieces, p, king.square!, n >= 47, n >= 88, true));
}

function placement(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = at(pieces, `${String.fromCharCode(97 + file)}${8 - rank}`);
      if (!p) { empty++; continue; }
      if (empty) row += empty;
      empty = 0;
      row += p.owner === 'white' ? letters[p.role].toUpperCase() : letters[p.role];
    }
    return row + (empty || '');
  }).join('/');
}

test('random campaign iteration 206: independent physical, timing, card and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/206.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860206);
  assert.equal(review.length, trace.steps.length);
  assert.equal(trace.steps.length, 116);
  let state = createGameState(trace.initial);
  const expected = structuredClone(state);
  assert.equal(placement(expected.pieces), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  assert.equal(expected.pieces.length, 32);
  for (const p of expected.pieces) assert.deepEqual(p, {
    id: `${p.owner}-${p.role}-${p.square}`, owner: p.owner, role: p.role, originalRole: p.role,
    square: p.square, zone: 'board', promoted: false, royal: p.role === 'king', neutral: false,
  });
  for (const color of ['white', 'black'] as const) for (const zone of ['hand', 'deck'] as const) {
    assert.deepEqual(expected.players[color][zone], (zone === 'hand' ? trace.initial.hands![color]! : trace.initial.decks![color]!).map((cardId, i) => ({ id: `${color}-${zone}-${i}-${cardId}`, cardId })));
  }
  let half = 0, full = 1, rights = 'KQkq', fenColor: Color = 'white';
  let moveCount = 0, cardCount = 0;
  const relocate = (from: string, to: SquareName) => {
    const piece = at(expected.pieces, from); assert.ok(piece, from); assert.equal(at(expected.pieces, to), undefined, to);
    piece.square = to; return piece;
  };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, label = review[index]!;
    assert.equal(Number(label.split(' ')[0]), n);
    const command = label.split(' ')[1]!;
    const actor = expected.turn.color, before = structuredClone(state), action = structuredClone(step.action), originalAction = structuredClone(action);
    let movement: Array<{ from: SquareName; to: SquareName }> = [];
    let moved: string[] = [];
    if (/^[a-h][1-8][a-h][1-8]$/.test(command)) {
      const from = command.slice(0, 2) as SquareName, to = command.slice(2) as SquareName;
      assert.deepEqual(action, { type: 'move', from, to }, label);
      assert.equal(expected.turn.moveMade, false);
      const p = at(expected.pieces, from)!;
      assert.equal(p.owner, actor, label);
      assert.ok(reaches(expected.pieces, p, to, n >= 47, n >= 88, false), label);
      assert.equal(at(expected.pieces, to), undefined, 'every reviewed move is a non-capture');
      assert.ok(!(n >= 23 && n <= 24 && p.royal), 'returned royal cannot move');
      assert.ok(!(n >= 100 && n <= 101 && p.id === 'black-knight-g8'), 'Dungeon identity cannot move');
      if (n === 12) assert.equal(p.id, 'black-pawn-g7');
      const input = structuredClone(state); const query = structuredClone(input);
      assert.ok(legalDests(query).get(from)?.includes(to), label);
      assert.deepEqual(query, input, 'legal destination query is immutable');
      half = p.originalRole === 'pawn' && !p.promoted ? 0 : half + 1;
      if (p.royal) rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '');
      if (p.id === 'black-rook-h8') rights = rights.replace('k', '');
      relocate(from, to); moved = [p.id]; movement = [{ from, to }];
      expected.enPassant = p.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2
        ? [{ pawnId: p.id, target: `${from[0]}${(Number(to[1]) + Number(from[1])) / 2}` as SquareName }] : [];
      if (n === 12) expected.effects = [];
      expected.history.push({ type: 'move', from, to, ...(n === 115 ? { previousFen: expected.fen } : {}) });
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      expected.shieldMove = { player: actor, pieceIds: moved, capturedOpponent: false };
      delete expected.cardResponse;
      full += Number(actor === 'black'); fenColor = opposite(actor); moveCount++;
    } else if (command === 'end') {
      assert.deepEqual(action, { type: 'endTurn' }, label);
      assert.equal(expected.turn.moveMade, true);
      expected.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      delete expected.shieldMove; delete expected.cardResponse;
      if (n === 22) expected.underElfHill![0]!.returning = true;
      if (n === 25) expected.underElfHill = [];
      if (n === 102) expected.effects.pop();
    } else if (command === 'return') {
      assert.deepEqual(action, { type: 'returnKing', to: 'e1' }, label);
      assert.deepEqual(expected.underElfHill, [{ pieceId: 'white-king-e1', player: 'white', returning: true }]);
      const p = expected.pieces.find(p => p.id === 'white-king-e1')!;
      assert.equal(at(expected.pieces, 'e1'), undefined); assert.equal(p.zone, 'away');
      p.square = 'e1'; p.zone = 'board'; expected.underElfHill![0]!.returned = true;
    } else {
      assert.equal(command, 'card');
      const spec = cards[n]!; assert.ok(spec, label);
      assert.deepEqual(action, { type: 'playCard', cardId: spec.id, cardInstanceId: spec.instance, ...(spec.target === undefined ? {} : { target: spec.target }) }, label);
      assert.equal(expected.turn.phase, spec.replacement ? 'beforeMove' : 'afterMove');
      assert.equal(expected.turn.cardPlays[actor], 0);
      assert.ok(CARD_CATALOG[spec.id]!.timing.includes(expected.turn.phase));
      const hand = expected.players[actor].hand, i = hand.findIndex(c => c.id === spec.instance);
      assert.ok(i >= 0, 'exact physical card held by acting owner');
      const card = hand.splice(i, 1)[0]!; assert.equal(card.cardId, spec.id);
      const continuing = ['truce', 'earthquake', 'forbidden-city'].includes(spec.id);
      assert.equal(CARD_CATALOG[spec.id]!.continuing, continuing);
      if (!continuing) expected.players[actor].discard.push(card);
      hand.push(expected.players[actor].deck.shift()!);
      expected.playedCards ??= []; expected.playedCards.push({ player: actor, cardInstanceId: card.id });
      expected.turn.cardPlays[actor] = 1;
      if (n === 1) {
        at(expected.pieces, 'b1')!.square = 'g8';
        expected.pieces.find(p => p.id === 'black-knight-g8')!.square = 'b1';
        movement = [{ from: 'b1', to: 'g8' }, { from: 'g8', to: 'b1' }];
      }
      if (n === 10) expected.effects.push({ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-pawn-g7' });
      if (n === 18) {
        const king = at(expected.pieces, 'e1')!; king.square = null; king.zone = 'away'; rights = 'kq';
        expected.underElfHill = [{ pieceId: king.id, player: 'white', returning: false }];
      }
      if (n === 21) expected.effects.push({ type: 'truce', owner: actor, card });
      if (n === 38) {
        const [x, y] = xy('d6'), [tx, ty] = xy('e2'); assert.notEqual((x + y) % 2, (tx + ty) % 2);
        assert.equal(at(expected.pieces, 'd6')!.role, 'knight');
        moved = [relocate('d6', 'e2').id]; movement = [{ from: 'd6', to: 'e2' }];
      }
      if (n === 47) {
        expected.orientation = 90;
        const white = at(expected.pieces, 'h2')!, black = at(expected.pieces, 'a7')!;
        assert.equal(white.originalRole, 'pawn'); assert.equal(black.originalRole, 'pawn');
        white.role = 'knight'; white.promoted = true; black.role = 'bishop'; black.promoted = true;
        expected.effects.push({ type: 'earthquake', owner: actor, card, direction: 'clockwise', target: spec.target });
      }
      if (n === 63) {
        assert.equal(at(expected.pieces, 'e7')!.id, 'black-pawn-f7');
        assert.equal(at(expected.pieces, 'd7')!.id, 'black-pawn-d7');
        moved = [relocate('d7', 'c7').id, relocate('e7', 'd7').id];
        movement = [{ from: 'd7', to: 'c7' }, { from: 'e7', to: 'd7' }];
      }
      if (n === 88) {
        assert.equal(at(expected.pieces, 'd5'), undefined);
        expected.effects.push({ type: 'forbidden-city', owner: actor, card, square: 'd5' });
      }
      if (n === 99) {
        assert.equal(at(expected.pieces, 'b3')!.id, 'black-knight-g8'); relocate('b3', 'a1');
        movement = [{ from: 'b3', to: 'a1' }];
        expected.effects.push({ type: 'dungeon', owner: actor, player: 'black', pieceId: 'black-knight-g8' });
      }
      if (n === 113) {
        assert.equal(at(expected.pieces, 'b5')!.id, 'white-pawn-b2');
        assert.equal(at(expected.pieces, 'c6')!.id, 'black-pawn-c7');
        moved = [relocate('c6', 'a4').id]; movement = [{ from: 'c6', to: 'a4' }];
      }
      const event: GameEvent = { type: 'cardPlayed', cardId: spec.id, ...(spec.target === undefined ? {} : { target: structuredClone(spec.target) as GameEvent['target'] }) };
      if (n !== 88) { event.movement = movement; event.preservePreviousMove = !spec.replacement; }
      expected.history.push(event);
      expected.cardResponse = { player: actor, historyLength: expected.history.length };
      if (spec.replacement) {
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true; expected.enPassant = [];
        expected.shieldMove = { player: actor, pieceIds: moved, capturedOpponent: false };
        half = [63, 113].includes(n) ? 0 : half + 1;
        full += Number(actor === 'black'); fenColor = opposite(actor);
      }
      cardCount++;
    }
    // Every en-passant opportunity in this trace lacks even a geometric captor.
    for (const ep of expected.enPassant) {
      const victim = expected.pieces.find(p => p.id === ep.pawnId)!;
      assert.equal(expected.pieces.some(p => p.owner !== victim.owner && p.role === 'pawn'
        && reaches(expected.pieces, p, ep.target, n >= 47, n >= 88, true)), false, label);
      const query = structuredClone(before); query.pieces = structuredClone(expected.pieces); query.enPassant = structuredClone(expected.enPassant);
      query.turn = { color: opposite(victim.owner), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      query.fen = `${placement(expected.pieces)} ${victim.owner === 'white' ? 'b' : 'w'} ${rights || '-'} - ${half} ${full}`;
      delete query.shieldMove; delete query.cardResponse;
      const untouched = structuredClone(query); const dests = legalDests(query);
      for (const p of query.pieces.filter(p => p.owner !== victim.owner && p.role === 'pawn' && p.square)) {
        assert.equal(dests.get(p.square!)?.includes(ep.target) ?? false, false, 'no en-passant capture available');
      }
      assert.deepEqual(query, untouched, 'en-passant query immutable');
    }
    expected.fen = `${placement(expected.pieces)} ${fenColor === 'white' ? 'w' : 'b'} ${rights || '-'} - ${half} ${full}`;
    // All regular cards leave both royals raw-safe; none needs a hidden-hand or direct-mate escape exception.
    for (const color of ['white', 'black'] as const) assert.equal(rawCheck(expected.pieces, color, n), false, `${label}: raw ${color} safety`);
    const result = applyAction(state, action);
    assert.deepEqual(state, before, `${label}: state input immutable`);
    assert.deepEqual(action, originalAction, `${label}: command input immutable`);
    assert.ok(result.ok, label); state = result.state;
    for (const key of ['fen', 'pieces', 'players', 'turn', 'effects', 'history', 'orientation', 'enPassant', 'outcome'] as const) {
      assert.deepEqual(state[key], expected[key], `${label}: ${key}`);
    }
    for (const key of ['playedCards', 'underElfHill', 'plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) {
      assert.deepEqual(state[key] ?? [], expected[key] ?? [], `${label}: ${key}`);
    }
    for (const key of ['cardResponse', 'shieldMove', 'chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred',
      'pendingRescue', 'pendingDoomsayer', 'pendingAbduction', 'legacyCapture', 'turnCheckpoint'] as const) {
      assert.deepEqual(state[key] ?? null, expected[key] ?? null, `${label}: ${key}`);
    }
    for (const color of ['white', 'black'] as const) {
      const query = structuredClone(state), untouched = structuredClone(query);
      assert.equal(isKingInCheck(query, color), false, `${label}: public ${color} check`);
      assert.deepEqual(query, untouched, 'royal query immutable');
    }
    if (command === 'card') {
      const card = cards[n]!;
      assert.deepEqual(state.fogCheckpoint, { before, player: actor, card: { id: card.instance, cardId: card.id }, historyLength: expected.history.length });
    } else assert.equal(state.fogCheckpoint, undefined);
    if (movement.length && (action.type === 'move' || cards[n]?.replacement)) {
      const signature = movement.map(move => `${at(before.pieces, move.from)!.id}:${move.from}:${move.to}`).sort().join('|');
      assert.deepEqual(state.chaosCheckpoint, { before, movement: signature, historyLength: expected.history.length,
        card: cards[n] ? { id: cards[n]!.instance, cardId: cards[n]!.id } : undefined });
    } else if (n === 18) {
      assert.deepEqual(state.chaosCheckpoint, { before, movement: 'white-king-e1:e1:away', historyLength: expected.history.length,
        card: { id: 'white-hand-4-under-elf-hill', cardId: 'under-elf-hill' } });
    } else assert.equal(state.chaosCheckpoint, undefined);
  }
  assert.equal(moveCount, 50); assert.equal(cardCount, 10);
  assert.equal(state.fen, 'rnb1k3/bpppN2r/7q/1PR1pp1p/pb4R1/P1B1PKP1/2PP2PN/n1Q2BN1 b - - 1 28');
  assert.equal(trace.finalFen, state.fen);
  replayTrace(trace);
});
