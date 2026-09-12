import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, rejectPendingCancellation, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, CoupEffect, CurseEffect, GameAction, GameState, PieceState, SquareName } from '../types.js';

// Read in order against rules §§8–13, 15.3, 17.1–2, 20–21, 22.3/7 and
// artwork KC17/1, KC11/1, KC20/4, KC8/3, KC11/3, KC10/4, KC8/1, KC15/2, KC19/2.
const rationales = `
1 b2-b3: White Pawn advances one into empty b3.
2 Close White's completed move; reset both card allowances.
3 h7-h5: initial double step through empty h6; raw EP h6, no White captor.
4 Black Treason swaps opposing Rook h1 and Knight g1 after moving, preserving identities.
5 Close Black turn with the swap and physical h-Pawn EP retained.
6 b1-c3: Knight jumps to vacant c3; h-Pawn EP expires.
7 Close White turn after the Knight jump.
8 h5-h4: Black Pawn advances one empty square.
9 Close Black turn after h4.
10 c3-d5: Knight jumps to vacant d5.
11 Close White turn after d5.
12 f7-f5: clear f6 double step; no adjacent White EP captor.
13 Black Curse marks the opposing Queen d1 after moving; retain the physical card.
14 Close Black turn; Curse remains attached to Queen identity.
15 d5xc7: White Knight captures Black c-Pawn and checks e8.
16 White may end while the opposing e8 King is checked.
17 g7-g5: temporary Black self-check from c7 Knight; held Coup can crown safe Bishop c8.
18 White Think Again cancels g7-g5, restoring all movement consequences and forbidding its repeat.
19 Black Masquerade moves checked King e8-f7-g6 along a clear diagonal instead of its move.
20 Close Black turn after the safe g6 replacement; both card allowances reset.
21 f2-f4: clear f3 double step; no Black Pawn on e4/g4 for EP.
22 Close White turn with f3 raw opportunity retained.
23 g6-h7: royal King takes one safe diagonal step.
24 Close Black turn after h7.
25 c7-e6: Knight jumps to empty e6.
26 Close White turn after e6.
27 d7-d6: Black Pawn advances to empty d6.
28 Close Black turn after d6.
29 e6xd8: Knight captures Black Queen with its normal jump.
30 Close White turn after the Queen capture.
31 a7-a6: Black Pawn advances one.
32 Close Black turn after a6.
33 e2-e4: empty e3/e4 double step, no Black d4/f4 EP captor.
34 Close White turn after e4.
35 b7-b5: clear b6/b5 double step, no White a5/c5 EP captor.
36 Close Black turn after b5.
37 a2-a3: White Pawn advances one.
38 Close White turn after a3.
39 h7-h6: royal King moves one square safely.
40 Close Black turn after h6.
41 c2-c4: clear c3/c4 double step; no Black b4/d4 EP captor.
42 Close White turn after c4.
43 d6-d5: Black Pawn advances to empty d5.
44 Close Black turn after d5.
45 c1-b2: Bishop moves one diagonal square, vacated by b-Pawn.
46 Close White turn after b2.
47 h6-h5: King advances one safe square.
48 Close Black turn after h5.
49 White Haunting Memories copies latest Masquerade: Rook a1-a2 is an empty Queen-line replacement.
50 Close White turn after copied replacement; a-Rook castling right is lost.
51 b8-d7: Knight jumps to vacated d7.
52 Close Black turn after d7.
53 c4xb5: White Pawn captures Black b-Pawn diagonally.
54 Close White turn after b5 capture.
55 f5xe4: Black Pawn captures White e-Pawn diagonally.
56 Close Black turn after e4 capture.
57 d1-f3: cursed Queen moves exactly two diagonal squares via empty e2, checking h5.
58 White ends with Black King checked by f3 Queen through g4.
59 h4-h3: temporary Black self-check from f3 Queen; held Coup c8 cures it.
60 Black Coup demotes h5 King to capturable Prince and crowns safe c8 Bishop without relocating.
61 Close Black turn with c8 royal Bishop safe; h5 Prince may be attacked.
62 g2-g4: clear g3/g4 double step; Black h3 Pawn is on wrong rank to capture EP.
63 Close White turn after g4.
64 Black Ghostwalk moves Bishop f8-h6 through friendly g7 Pawn to empty h6 instead of moving.
65 Close Black turn after Ghostwalk; no ongoing jumping power remains.
66 f3xh3: cursed Queen captures h-Pawn two squares horizontally via empty g3.
67 Close White turn after h3 capture.
68 g7-g5: clear g6/g5 double step; no White Pawn on f5/h5 to capture EP.
69 Close Black turn; raw g6 FEN does not imply a legal EP capture.
70 b2-f6: Bishop diagonal path c3/d4/e5 is clear.
71 Close White turn after f6.
72 e4-e3: Black f-Pawn advances one from its capture square.
73 Close Black turn after e3.
74 d8-b7: Knight jumps to empty b7.
75 Close White turn after b7.
76 h5-h4: capturable Prince takes one King-like step; safety belongs to c8 Bishop.
77 Close Black turn with royal Bishop safe.
78 f4-f5: White Pawn advances one; earlier g-Pawn EP has expired.
79 Close White turn after f5.
80 g8xf6: Black Knight captures White Bishop by normal jump.
81 Close Black turn after f6 capture.
82 g1-g3: White Rook follows clear g2 file; its historical h1 castling right is lost.
83 Close White turn after g3.
84 h8-d8: Black Rook traverses clear g8/f8/e8 squares.
85 Close Black turn after d8.
86 a2-b2: White Rook moves one empty horizontal square.
87 Close White turn after b2.
88 a6-a5: Black Pawn advances one.
89 Close Black turn after a5.
90 a3-a4: White Pawn advances one before the opposing a5 Pawn.
91 Close White turn after a4.
92 d7-b6: Black Knight jumps to empty b6.
93 Close Black turn after b6.
94 h3-g2: cursed Queen moves one diagonal square.
95 Close White turn after g2.
96 b6-d7: Black Knight returns by a normal jump.
97 Close Black turn after d7.
98 White Split Knight sacrifices b7 Knight and captures a5 Pawn/d8 Rook, both independently legal Knight captures.
99 Black Fog immediately cancels Split Knight: restore all three identities and White move, keep both cards spent.
100 h2-h3: White makes its restored Regular Move, with both card allowances consumed.
101 Close White turn; Fog lock and both allowances reset.
102 a8-b8: Black Rook moves one empty horizontal square.
103 Close Black turn after b8.
104 f1-d3: Bishop diagonal path through empty e2 is clear.
105 Close White turn after d3.
106 h4-h5: Prince moves one square; c8 remains the protected royal identity.
107 Close Black turn after h5.
108 g2-e2: cursed Queen moves two horizontally through empty f2.
109 Close White turn after e2.
110 d5-d4: Black Pawn advances one empty square.
111 Close Black turn after the fiftieth sampled move.
`.trim().split('\n');

const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
const boardFen = (pieces: PieceState[]) => Array.from({ length: 8 }, (_, r) => {
  let text = '', empty = 0;
  for (let f = 0; f < 8; f++) {
    const p = at(pieces, `${String.fromCharCode(97 + f)}${8 - r}`);
    if (!p) { empty++; continue; }
    if (empty) { text += empty; empty = 0; }
    const symbol = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[p.role];
    text += p.owner === 'white' ? symbol.toUpperCase() : symbol;
  }
  return text + (empty || '');
}).join('/');

// Independent physical geometry: only Curse and Coup persist in this trace.
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, cursed: boolean, role = piece.role, ghost = false): boolean {
  assert.ok(piece.square);
  const [x, y] = xy(piece.square), [u, v] = xy(to), dx = u - x, dy = v - y;
  const ax = Math.abs(dx), ay = Math.abs(dy), distance = Math.max(ax, ay);
  if (!distance || cursed && piece.id === 'white-queen-d1' && distance > 2) return false;
  if (role === 'knight') return ax * ay === 2;
  if (role === 'king') return distance === 1;
  if (role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    return capture ? ax === 1 && dy === direction : dx === 0 &&
      (dy === direction || dy === 2 * direction && y === (piece.owner === 'white' ? 1 : 6)
        && !at(pieces, `${String.fromCharCode(97 + x)}${y + direction + 1}`));
  }
  if (!(role === 'queen' && (dx === 0 || dy === 0 || ax === ay)
    || role === 'bishop' && ax === ay || role === 'rook' && (dx === 0 || dy === 0))) return false;
  for (let k = 1; k < distance; k++) {
    const blocker = at(pieces, `${String.fromCharCode(97 + x + Math.sign(dx) * k)}${y + Math.sign(dy) * k + 1}`);
    if (blocker && (!ghost || blocker.owner !== piece.owner)) return false;
  }
  return true;
}
function checked(pieces: PieceState[], color: Color, cursed: boolean): boolean {
  const royal = pieces.find(p => p.royal && p.owner === color && p.zone === 'board');
  assert.ok(royal?.square);
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces, p, royal.square!, true, cursed));
}
function immutableAction(state: GameState, action: GameAction) {
  const snapshot = structuredClone(state), payload = structuredClone(action);
  const result = applyAction(state, action);
  assert.deepEqual(state, snapshot, 'action input is immutable');
  assert.deepEqual(action, payload, 'action payload is immutable');
  assert.ok(result.ok, JSON.stringify(action));
  return result.state;
}
function spend(expected: GameState, owner: Color, cardId: string, instance: string, continuing = false) {
  const player = expected.players[owner];
  const card = player.hand.find(c => c.id === instance);
  assert.deepEqual(card, { id: instance, cardId });
  assert.equal(expected.turn.cardPlays[owner], 0);
  player.hand.splice(player.hand.indexOf(card!), 1);
  if (!continuing) player.discard.push(card!);
  player.hand.push(player.deck.shift()!);
  expected.turn.cardPlays[owner]++;
}
const curse: CurseEffect = { type: 'curse', owner: 'black', card: { id: 'black-hand-1-curse', cardId: 'curse' }, pieceId: 'white-queen-d1' };
const coup: CoupEffect = { type: 'coup', owner: 'black', card: { id: 'black-hand-0-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-bishop-c8', princeRole: 'king' };
function crown(expected: GameState) {
  spend(expected, 'black', 'coup', 'black-hand-0-coup', true);
  expected.pieces.find(p => p.id === 'black-king-e8')!.royal = false;
  expected.pieces.find(p => p.id === 'black-bishop-c8')!.royal = true;
  expected.effects.push(structuredClone(coup));
  expected.history.push({ type: 'cardPlayed', cardId: 'coup', target: 'c8', movement: [], preservePreviousMove: true });
}
function compare(actual: GameState, expected: GameState, n: number) {
  for (const key of ['pieces', 'players', 'turn', 'effects', 'history', 'enPassant', 'fen'] as const)
    assert.deepEqual(actual[key], expected[key], `${n}: ${key}`);
  assert.equal(actual.orientation, 0);
  assert.equal(actual.outcome, null);
  for (const key of ['plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(actual[key], undefined, `${n}: ${key}`);
  for (const key of ['plotsAllowances', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(actual[key] ?? [], [], `${n}: ${key}`);
  assert.equal(actual.pendingAbduction ?? null, null);
  assert.equal(actual.pendingDoomsayer ?? null, null);
  const snapshot = structuredClone(actual);
  for (const color of ['white', 'black'] as const) assert.equal(isKingInCheck(actual, color), checked(expected.pieces, color, expected.effects.length > 0), `${n}: ${color} royal geometry`);
  assert.deepEqual(actual, snapshot, 'royal queries are immutable');
}

// F4 / FAQ p.16: only actions 1–17 are a legal prefix. Later artifact actions
// depend on the rejected cancellation at action 18; original artifact hashes remain unchanged.
test('iteration 185 independently reviewed physical, temporal and card oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/185.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, 111);
  assert.equal(trace.steps.length, rationales.length);
  assert.equal(trace.seed, 860185);
  let actual = createGameState(trace.initial), expected = structuredClone(actual);
  assert.equal(expected.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const saved = new Map<number, GameState>();
  let shield: GameState['shieldMove'];
  let moves = 0, cards = 0, rescueProbes = 0;
  for (const [i, step] of trace.steps.slice(0, 17).entries()) {
    const n = i + 1, action = step.action;
    assert.ok(rationales[i]!.startsWith(`${n} `));
    const before = structuredClone(expected), actor = expected.turn.color;
    const beforeActual = structuredClone(actual);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to;
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/);
      assert.ok(rationales[i]!.includes(`${from}-${to}`) || rationales[i]!.includes(`${from}x${to}`));
      assert.equal(action.promotion, undefined);
      assert.equal(expected.turn.moveMade, false);
      const p = at(expected.pieces, from)!, victim = at(expected.pieces, to);
      assert.ok(p); assert.equal(p.owner, actor);
      assert.ok(reaches(expected.pieces, p, to, !!victim, n > 13), `${n}: move geometry`);
      if (victim) { assert.equal(victim.owner, other(actor)); assert.equal(victim.royal, false); victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor; }
      p.square = to as SquareName;
      expected.history.push({ type: 'move', from: from as SquareName, to: to as SquareName, ...(victim ? { capturedId: victim.id } : {}) });
      expected.enPassant = p.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2
        ? [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: p.id }] : [];
      const fields = before.fen.split(' ');
      if (n === 82) fields[2] = '-';
      fields[0] = boardFen(expected.pieces); fields[1] = other(actor)[0]!;
      fields[3] = n === 17 || n === 68 ? 'g6' : '-';
      fields[4] = String(p.role === 'pawn' || victim ? 0 : Number(fields[4]) + 1);
      fields[5] = String(Number(fields[5]) + (actor === 'black' ? 1 : 0));
      expected.fen = fields.join(' ');
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      shield = { player: actor, pieceIds: [p.id], capturedOpponent: !!victim };
      moves++;
    } else if (action.type === 'endTurn') {
      assert.equal(expected.turn.moveMade, true);
      assert.equal(checked(expected.pieces, actor, n > 13), false, `${n}: safe turn closure`);
      expected.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      shield = undefined;
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') throw Error('unexpected action');
      cards++;
      const specs: Record<number, [Color, string, string, unknown]> = {
        4: ['black', 'treason', 'black-hand-2-treason', { rook: 'h1', knight: 'g1' }],
        13: ['black', 'curse', 'black-hand-1-curse', 'd1'],
        18: ['white', 'think-again', 'white-hand-3-think-again', undefined],
        19: ['black', 'masquerade', 'black-deck-1-masquerade', [{ from: 'e8', to: 'g6' }]],
        49: ['white', 'haunting-memories', 'white-hand-1-haunting-memories', [{ from: 'a1', to: 'a2' }]],
        60: ['black', 'coup', 'black-hand-0-coup', 'c8'],
        64: ['black', 'ghostwalk', 'black-deck-2-ghostwalk', [{ from: 'f8', to: 'h6' }]],
        98: ['white', 'split-knight', 'white-hand-4-split-knight', { knight: 'b7', targets: ['a5', 'd8'] }],
        99: ['black', 'fog-of-war', 'black-deck-3-fog-of-war', undefined],
      };
      const [owner, id, instance, target] = specs[n]!;
      assert.deepEqual([action.cardId, action.cardInstanceId, action.target], [id, instance, target]);
      if ([4, 13, 60].includes(n)) { assert.equal(owner, actor); assert.equal(expected.turn.phase, 'afterMove'); }
      if ([19, 49, 64, 98].includes(n)) { assert.equal(owner, actor); assert.equal(expected.turn.phase, 'beforeMove'); }
      if (n === 18) { assert.equal(owner, other(actor)); assert.equal(before.turn.moveMade, true); }
      if (n === 99) assert.equal(expected.history.at(-1)?.cardId, 'split-knight');
      if (n !== 60) spend(expected, owner, id, instance, n === 13);
      if (n === 4) {
        at(expected.pieces, 'h1')!.square = 'g1';
        expected.pieces.find(p => p.id === 'white-knight-g1')!.square = 'h1';
        expected.fen = `${boardFen(expected.pieces)} w HQkq h6 0 2`;
        expected.history.push({ type: 'cardPlayed', cardId: id, target: { rook: 'h1', knight: 'g1' }, movement: [{ from: 'g1', to: 'h1' }, { from: 'h1', to: 'g1' }], preservePreviousMove: true });
      } else if (n === 13) {
        expected.effects.push(structuredClone(curse));
        expected.history.push({ type: 'cardPlayed', cardId: id, target: 'd1', movement: [], preservePreviousMove: true });
      } else if (n === 18) {
        const restore = saved.get(16)!;
        expected.pieces = structuredClone(restore.pieces); expected.fen = restore.fen;
        expected.enPassant = structuredClone(restore.enPassant); expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false;
        expected.history = [...structuredClone(restore.history), { type: 'cardPlayed', cardId: id, player: owner, movement: [{ from: 'g5', to: 'g7' }], preservePreviousMove: true }];
        shield = undefined;
      } else if ([19, 49, 64].includes(n)) {
        const [{ from, to }] = target as [{ from: SquareName; to: SquareName }];
        const p = at(expected.pieces, from)!;
        assert.equal(p.owner, owner); assert.equal(at(expected.pieces, to), undefined);
        assert.ok(reaches(expected.pieces, p, to, false, true, n === 64 ? p.role : 'queen', n === 64));
        p.square = to;
        expected.history.push({ type: 'cardPlayed', cardId: id, target: [{ from, to }], ...(n === 49 ? { copiedCardId: 'masquerade', player: owner } : {}), movement: [{ from, to }], preservePreviousMove: false });
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true; expected.enPassant = [];
        const fields = before.fen.split(' ');
        fields[0] = boardFen(expected.pieces); fields[1] = other(owner)[0]!; fields[3] = '-';
        fields[4] = String(Number(fields[4]) + 1); fields[5] = String(Number(fields[5]) + (owner === 'black' ? 1 : 0));
        if (n === 19) fields[2] = 'HQ'; if (n === 49) fields[2] = 'H';
        expected.fen = fields.join(' '); shield = { player: owner, capturedOpponent: false, pieceIds: [p.id] };
      } else if (n === 60) crown(expected);
      else if (n === 98) {
        const knight = at(expected.pieces, 'b7')!;
        for (const to of ['a5', 'd8']) {
          assert.ok(reaches(expected.pieces, knight, to, true, true));
          const simulated = structuredClone(expected.pieces), victim = at(simulated, to)!;
          victim.zone = 'captured'; victim.square = null;
          simulated.find(p => p.id === knight.id)!.square = to as SquareName;
          assert.equal(checked(simulated, 'white', true), false, 'Split victim is a legal capture');
        }
        for (const square of ['b7', 'a5', 'd8']) { const p = at(expected.pieces, square)!; assert.equal(p.royal, false); p.zone = 'captured'; p.square = null; p.capturedBy = 'white'; }
        expected.history.push({ type: 'cardPlayed', cardId: id, target: { knight: 'b7', targets: ['a5', 'd8'] }, capturedIds: ['black-pawn-a7', 'black-rook-h8', 'white-knight-b1'], movement: [], preservePreviousMove: false });
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true; expected.enPassant = [];
        expected.fen = `${boardFen(expected.pieces)} b - - 0 24`;
        shield = { player: 'white', capturedOpponent: true, pieceIds: [] };
      } else if (n === 99) {
        const restore = saved.get(97)!;
        expected.pieces = structuredClone(restore.pieces); expected.fen = restore.fen; expected.enPassant = [];
        expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false;
        expected.history.push({ type: 'cardPlayed', cardId: id, player: 'black', movement: [], preservePreviousMove: true });
        shield = undefined;
      }
    }
    actual = immutableAction(actual, action);
    compare(actual, expected, n);
    assert.deepEqual(actual.shieldMove, shield, `${n}: full move token`);
    assert.deepEqual(actual.chaosForbidden, n === 18 ? { player: 'black', movement: 'black-pawn-g7:g7:g5' } : undefined);
    assert.deepEqual(actual.fogLocked ?? [], n === 99 || n === 100 ? ['white'] : []);
    if (n === 17 || n === 59) {
      assert.deepEqual(actual.pendingRescue, { before: beforeActual, fen: before.fen, pieces: before.pieces, enPassant: before.enPassant, historyLength: before.history.length, movedPieceIds: shield!.pieceIds });
      const witness = structuredClone(expected); crown(witness);
      assert.equal(checked(witness.pieces, 'black', true), false, 'c8 is independently safe');
      const cured = immutableAction(actual, { type: 'playCard', cardId: 'coup', cardInstanceId: 'black-hand-0-coup', target: 'c8' });
      compare(cured, witness, n); assert.equal(cured.pendingRescue ?? null, null);
      assert.deepEqual(cured.shieldMove, shield);
      witness.turn = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      const closed = immutableAction(cured, { type: 'endTurn' }); compare(closed, witness, n);
      assert.equal(closed.shieldMove, undefined); rescueProbes++;
    } else assert.equal(actual.pendingRescue ?? null, null, `${n}: no pending rescue`);
    // EP is tested for the prospective capturing player, independently of FEN serialization.
    if (expected.enPassant.length) {
      const query = structuredClone(actual), pawn = expected.pieces.find(p => p.id === expected.enPassant[0]!.pawnId)!;
      query.turn = { color: other(pawn.owner), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
      query.pendingRescue = null; query.shieldMove = undefined;
      query.fen = query.fen.replace(/ [wb] /, ` ${query.turn.color[0]} `);
      const snapshot = structuredClone(query), destinations = legalDests(query);
      assert.deepEqual(query, snapshot, 'prospective EP query is immutable');
      for (const ep of expected.enPassant) for (const captor of expected.pieces.filter(p => p.zone === 'board' && p.role === 'pawn' && p.owner === query.turn.color)) {
        let possible = reaches(expected.pieces, captor, ep.target, true, true)
          && Number(captor.square![1]) === Number(pawn.square![1]);
        if (possible) {
          const simulation = structuredClone(expected.pieces);
          simulation.find(p => p.id === captor.id)!.square = ep.target;
          const passed = simulation.find(p => p.id === ep.pawnId)!; passed.zone = 'captured'; passed.square = null;
          possible = !checked(simulation, captor.owner, true);
        }
        assert.equal(destinations.get(captor.square!)?.includes(ep.target) ?? false, possible, `${n}: EP ${captor.square}-${ep.target}`);
      }
    }
    saved.set(n, structuredClone(expected));
  }
  rejectPendingCancellation(actual, trace.steps[17]!.action, [{"type":"playCard","cardId":"coup","cardInstanceId":"black-hand-0-coup","target":"a7"}]);
});

test('iteration 185 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/185.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace);
  rejectPendingCancellation(replayTrace(trace, 18), trace.steps[17]!.action, [{"type":"playCard","cardId":"coup","cardInstanceId":"black-hand-0-coup","target":"a7"}]);
});
