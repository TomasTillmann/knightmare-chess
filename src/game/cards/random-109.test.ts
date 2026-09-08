import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { parseFen } from 'chessops/fen';
import type { Color, PieceState, SquareName, GameState, CardInstance } from '../types.js';

// Rules §§8–13, 18.6 and cards.md; numbered review is deliberately hand-authored.
// Every endTurn preserves the entire physical model and resets only turn allowance.
const rationales = `
1 Nb1-c3 is a clear knight jump; no capture and White is safe.
2 White ends after Nc3; Black receives its normal move.
3 b7-b6 advances Black's pawn one vacant square.
4 Black marks its h7 pawn after moving: Fatal Attraction retains its card, draws Squaring the Circle, freezes g8/g7/h8 but not itself.
5 Black ends with h7 magnet and both hands intact.
6 Nc3-e4 is a knight jump outside the magnet neighborhood.
7 White ends after Ne4 with no card expenditure.
8 f7-f5 traverses empty f6; neither origin nor destination is adjacent to h7; creates f6 EP.
9 Black ends preserving the f6 EP opportunity.
10 d2-d4 traverses empty d3, replacing Black's EP opportunity with d3.
11 Treason swaps opponent Ra8 and Nb8 without capture; identity and unmoved rights survive a non-move swap; draw Curse and discard Treason.
12 White ends preserving both swapped identities and d3 EP.
13 f5-f4 advances one vacant square and expires d3 EP.
14 Black ends after f4 with no new effect.
15 Bc1-d2 enters the pawn's vacated square diagonally.
16 White ends after Bd2.
17 Assassin substitutes for Black's move: Bf8xe7 legally captures its own pawn, credited to Black; card discarded and Riposte drawn.
18 Black ends its replacement move; no additional regular move is granted.
19 Ne4-f6 is a knight jump giving check to e8; White remains safe.
20 White closes the check-giving move.
21 Be7xf6 captures the checking white knight, credited to Black, curing check.
22 Black ends after the capture with both captured pieces retained off-board.
23 g2-g3 advances onto a vacant square.
24 White ends after g3.
25 Ke8-e7 is an unattacked one-square step and revokes Black's castling rights.
26 Black ends after Ke7.
27 e2-e4 passes empty e3, creating e3 EP for the pawn f4.
28 White ends preserving e3 EP.
29 Ke7-f7 is an unattacked adjacent square; Black declines EP, which expires.
30 Black ends after Kf7.
31 Qd1-f3 follows the empty e2 diagonal.
32 White ends after Qf3.
33 Bc8-a6 traverses vacant b7.
34 Black ends after Ba6.
35 Bf1-b5 follows vacant e2,d3,c4; White remains safe.
36 White ends after Bb5.
37 Rb8-b7 enters the square vacated by b7's pawn; rook identity is still original a8.
38 Black ends after Rb7.
39 Qf3-a3 follows empty e3,d3,c3,b3 horizontally.
40 White ends after Qa3.
41 Qd8-c8 moves horizontally onto the bishop's vacated square.
42 Black ends after Qc8.
43 Bd2xf4 traverses empty e3 and captures Black's f-pawn, credited to White.
44 White ends after Bxf4.
45 Bf6-e5 moves diagonally away from the knight's former capture square.
46 Crab marks Black's own d7 pawn after its move, retains the physical card and draws Doomsayer; no board move occurs.
47 Black ends with h7 magnet and d7 Crab retained.
48 Qa3xa6 passes vacant a4,a5 and captures Black's original c8 bishop, credited to White.
49 White ends after Qxa6.
50 h7-h5 is the magnet's own allowed double step via h6: discard Fatal Attraction, release its neighbors, create h6 EP.
51 Black ends with Crab alone and h6 EP preserved.
52 Bb5-c6 is one diagonal step; the previous h6 EP expires.
53 White ends after Bc6.
54 Qc8-f8 follows vacant d8,e8 horizontally.
55 Black ends after Qf8.
56 Ke1-f1 enters a safe vacant square and revokes White's remaining castling rights.
57 Curse marks opposing Be5 after White's move, retains its card and draws Charge; bishop's future travel is limited to two squares.
58 White ends with Crab and Curse retained.
59 Kf7-g6 enters a safe adjacent square; no remaining magnet restricts nearby pieces.
60 Black ends after Kg6.
61 Qa6-a3 follows clear a5,a4.
62 White ends after Qa3.
63 Rh8-h6 passes empty h7; the expired magnet no longer freezes this rook.
64 Black ends after Rh6.
65 Qa3-c5 follows empty b4 diagonally.
66 White ends after Qc5.
67 Qf8-f5 follows vacant f7,f6 and stops before White's bishop f4.
68 Black ends after Qf5.
69 Ng1-f3 is a knight jump onto a vacant square.
70 White ends after Nf3.
71 Kg6-f6 is safe: Qc5 is not aligned with f6; Bc6's ray to f6 is horizontal, not diagonal.
72 Black ends after Kf6.
73 h2-h4 passes vacant h3 and creates h3 EP, although h5 cannot capture it en passant.
74 White ends preserving h3 EP.
75 Rh6-h7 steps onto a vacant square and expires h3 EP.
76 Black ends after Rh7.
77 Nf3-g1 returns by a legal knight jump.
78 White ends after Ng1.
79 Qf5-h3 traverses vacant g4 and crosses the frontier toward White without capture; Qh3 checks Kf1 through empty g2.
80 White reacts with Toll; Black pays its b6 pawn, captured by White; preserve Qh3's existing check for White's coming escape turn, reset halfmove clock, draw Madman.
81 Black ends; White's reaction allowance resets for its own turn.
82 Rh1xh3 passes empty h2 and captures Black's queen, credited to White.
83 White ends after Rxh3.
84 Rh7-h8 is a quiet vertical return.
85 Black ends after Rh8.
86 Bc6xb7 captures Black's original a8 rook, credited to White.
87 White ends after Bxb7.
88 Rh8-h7 moves one vacant square.
89 Black ends after Rh7.
90 Ng1-f3 is a legal knight jump.
91 White ends after Nf3.
92 Crab d7-e6 may move diagonally forward without capturing; identity stays a pawn and the clock resets.
93 Black ends after Crab e6 with its marker retained.
94 Qc5xa7 passes the newly emptied b6 and captures Black's a-pawn, credited to White.
95 White ends after Qxa7.
96 Crab e6-f5 advances diagonally to a vacant square; pawn clock resets again.
97 Black ends after Crab f5.
98 Bb7-c6 makes a legal diagonal return.
99 White ends after Bc6.
100 Kf6-e6 is a safe adjacent step; White's Bf4 ray toward e5 is blocked by the actual Be5, and Q a7 is unaligned.
101 Black ends after Ke6.
102 Qa7-a4 follows vacant a6,a5 vertically.
103 White ends after Qa4.
104 Rh7-h8 is a quiet vertical move.
105 Black ends after Rh8.
106 Nf3-g1 is the fiftieth regular move, a legal knight return.
107 White ends: Black has its normal next turn; Crab f5 and Curse Be5 persist.
`.trim().split('\n');

const coords = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
type Marker = { type: string; owner: Color; card: CardInstance; pieceId: string };

// This oracle uses only physical geometry and the three effects present in this trace.
function geometry(pieces: PieceState[], effects: Marker[], mover: PieceState, to: SquareName, capture: boolean): boolean {
  assert.ok(mover.square);
  const [x, y] = coords(mover.square), [u, v] = coords(to);
  const dx = u - x, dy = v - y, distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (!mover.royal && effects.some(e => {
    const magnet = pieces.find(p => p.id === e.pieceId && p.zone === 'board');
    if (e.type !== 'fatal-attraction' || !magnet?.square || magnet.id === mover.id) return false;
    const [a, b] = coords(magnet.square);
    return Math.max(Math.abs(x - a), Math.abs(y - b)) === 1;
  })) return false;
  if (effects.some(e => e.type === 'curse' && e.pieceId === mover.id) && distance > 2) return false;
  if (mover.role === 'knight') return Math.abs(dx * dy) === 2;
  if (mover.role === 'king') return distance === 1;
  if (mover.role === 'pawn') {
    const forward = mover.owner === 'white' ? 1 : -1;
    if (capture || effects.some(e => e.type === 'crab' && e.pieceId === mover.id)) return Math.abs(dx) === 1 && dy === forward;
    if (dx !== 0 || dy !== forward && !(dy === 2 * forward && y === (mover.owner === 'white' ? 1 : 6))) return false;
  } else {
    const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
    if (mover.role === 'bishop' ? !diagonal : mover.role === 'rook' ? !straight : !diagonal && !straight) return false;
  }
  for (let i = 1; i < distance; i++) {
    const square = `${String.fromCharCode(97 + x + Math.sign(dx) * i)}${y + Math.sign(dy) * i + 1}`;
    if (pieces.some(p => p.zone === 'board' && p.square === square)) return false;
  }
  return distance > 0;
}

function safe(pieces: PieceState[], effects: Marker[], color: Color): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!;
  assert.ok(king.square);
  return !pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(pieces, effects, p, king.square!, true));
}

test('iteration 109 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/109.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length, 107);
  assert.equal(rationales.length, trace.steps.length);
  rationales.forEach((r, i) => assert.ok(r.startsWith(`${i + 1} `)));
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 6);
  const pieces: PieceState[] = [];
  const back: PieceState['role'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (const rank of [1, 2, 7, 8]) for (let file = 0; file < 8; file++) {
    const owner = rank < 3 ? 'white' : 'black';
    const role = rank === 2 || rank === 7 ? 'pawn' : back[file]!;
    const square = `${String.fromCharCode(97 + file)}${rank}` as SquareName;
    pieces.push({ id: `${owner}-${role}-${square}`, owner, role, originalRole: role, square, zone: 'board', promoted: false, royal: role === 'king', neutral: false });
  }
  const cards = (owner: Color, zone: 'hand' | 'deck') => (trace.initial[zone === 'hand' ? 'hands' : 'decks']?.[owner] ?? [])
    .map((cardId, i) => ({ id: `${owner}-${zone}-${i}-${cardId}`, cardId }));
  const players: GameState['players'] = {
    white: { hand: cards('white', 'hand'), deck: cards('white', 'deck'), discard: [] },
    black: { hand: cards('black', 'hand'), deck: cards('black', 'deck'), discard: [] },
  };
  let effects: Marker[] = [], enPassant: GameState['enPassant'] = [];
  let actor: Color = 'white', fenActor: Color = 'white', moved = false, half = 0, full = 1;
  let plays = { white: 0, black: 0 };
  const rights = new Set([0, 7, 56, 63]);
  let state = createGameState(trace.initial);
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
  const capture = (victim: PieceState, captor: Color) => {
    assert.equal(victim.royal, false);
    victim.square = null; victim.zone = 'captured'; victim.capturedBy = captor;
  };
  const completeMove = (pawnOrCapture: boolean) => {
    moved = true; fenActor = opposite(actor); enPassant = [];
    half = pawnOrCapture ? 0 : half + 1;
    if (actor === 'black') full++;
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const label = rationales[index]!;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(moved, false, label);
      const mover = at(action.from)!; assert.ok(mover, label);
      const target = at(action.to);
      assert.equal(mover.owner, actor, label);
      if (target) assert.equal(target.owner, opposite(actor), label);
      assert.ok(geometry(pieces, effects, mover, action.to as SquareName, !!target), label);
      completeMove(mover.role === 'pawn' || !!target);
      if (target) capture(target, actor);
      if (mover.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2) {
        const targetSquare = `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName;
        enPassant = [{ target: targetSquare, pawnId: mover.id }];
      }
      if (mover.royal) for (const s of actor === 'white' ? [0, 7] : [56, 63]) rights.delete(s);
      if (mover.role === 'rook') { const [x, y] = coords(action.from); rights.delete(y * 8 + x); }
      mover.square = action.to as SquareName;
      effects = effects.filter(effect => {
        if (effect.type !== 'fatal-attraction' || effect.pieceId !== mover.id) return true;
        players[effect.owner].discard.push(effect.card); return false;
      });
    } else if (action.type === 'endTurn') {
      assert.ok(moved, label); assert.ok(safe(pieces, effects, actor), label);
      actor = opposite(actor); moved = false; plays = { white: 0, black: 0 };
    } else if (action.type === 'playCard') {
      const owner: Color = action.cardId === 'toll' ? opposite(actor) : actor;
      const player: GameState['players'][Color] = players[owner];
      assert.equal(plays[owner], 0, label);
      const cardIndex: number = player.hand.findIndex(c => c.id === action.cardInstanceId);
      assert.ok(cardIndex >= 0, label);
      const card: CardInstance = player.hand.splice(cardIndex, 1)[0]!; assert.ok(card);
      assert.equal(card.cardId, action.cardId, label);
      plays[owner]++;
      const drawn = player.deck.shift(); assert.ok(drawn); player.hand.push(drawn);
      if (['fatal-attraction', 'crab', 'curse'].includes(action.cardId)) {
        assert.ok(moved, label); assert.equal(typeof action.target, 'string');
        const victim: PieceState = at(action.target as string)!; assert.ok(victim, label);
        assert.equal(victim.owner, action.cardId === 'curse' ? opposite(owner) : owner, label);
        if (action.cardId === 'crab') assert.equal(victim.role, 'pawn');
        if (action.cardId === 'curse') assert.ok(['queen', 'rook', 'bishop'].includes(victim.role));
        effects.push({ type: card.cardId, owner, card, pieceId: victim.id });
      } else {
        player.discard.push(card);
        if (action.cardId === 'treason') {
          assert.ok(moved, label);
          assert.deepEqual(action.target, { rook: 'a8', knight: 'b8' });
          const rook = at('a8')!, knight = at('b8')!;
          assert.equal(rook.role, 'rook'); assert.equal(knight.role, 'knight');
          assert.equal(rook.owner, opposite(owner)); assert.equal(knight.owner, opposite(owner));
          rook.square = 'b8'; knight.square = 'a8';
        } else if (action.cardId === 'assassin') {
          assert.equal(moved, false); assert.deepEqual(action.target, [{ from: 'f8', to: 'e7' }]);
          const bishop = at('f8')!, pawn = at('e7')!;
          assert.equal(bishop.owner, owner); assert.equal(pawn.owner, owner);
          assert.ok(geometry(pieces, effects, bishop, 'e7', true));
          capture(pawn, owner); bishop.square = 'e7'; completeMove(true);
        } else {
          assert.equal(action.cardId, 'toll'); assert.ok(moved);
          assert.deepEqual(trace.steps[index - 1]!.action, { type: 'move', from: 'f5', to: 'h3' });
          assert.equal(action.target, 'b6'); const pawn = at('b6')!;
          assert.equal(pawn.owner, actor); assert.equal(pawn.role, 'pawn');
          capture(pawn, owner); half = 0;
        }
      }
      if (owner === actor) assert.ok(safe(pieces, effects, owner), label);
      else assert.equal(safe(pieces, effects, owner), false, 'Toll preserves the existing Qh3 check; Rh1xh3 cures it next turn');
    } else assert.fail(`Unreviewed action: ${label}`);
    if (action.type !== 'endTurn') assert.ok(safe(pieces, effects, actor), label);
    const original = structuredClone(state);
    const result = applyAction(state, action);
    assert.deepEqual(state, original, `${label}: complete input immutability`);
    assert.ok(result.ok, label);
    state = result.state;
    assert.deepEqual(state.pieces, pieces, `${label}: every physical piece including unaffected/captured pieces`);
    assert.deepEqual(state.players, players, `${label}: all card identities and zone order`);
    assert.deepEqual(state.effects, effects, `${label}: full retained effects`);
    assert.deepEqual(state.enPassant, enPassant, `${label}: EP opportunity`);
    assert.deepEqual(state.turn, { color: actor, phase: moved ? 'afterMove' : 'beforeMove', moveMade: moved, cardPlays: plays }, label);
    const fen = parseFen(state.fen).unwrap();
    assert.equal(fen.turn, fenActor, label); assert.equal(fen.halfmoves, half, label); assert.equal(fen.fullmoves, full, label);
    // Treason preserves the raw d3 opportunity when serializing its swap; e3 is
    // capturable by Black's f4 pawn. Other double steps have no eligible captor.
    const expectedFenEp = index === 10 || index === 11 ? 19 : index === 26 || index === 27 ? 20 : undefined;
    assert.equal(fen.epSquare, expectedFenEp, `${label}: serialized FEN en-passant`);
    assert.deepEqual([...fen.castlingRights], [...rights].sort((a, b) => a - b), label);
    assert.equal(fen.board.occupied.size(), pieces.filter(p => p.zone === 'board').length, label);
    for (const p of pieces.filter(p => p.zone === 'board')) {
      const [x, y] = coords(p.square!);
      assert.deepEqual(fen.board.get(y * 8 + x), { role: p.role, color: p.owner, promoted: false }, label);
    }
    assert.equal(state.orientation, 0, label); assert.equal(state.outcome, null, label);
    assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer && !state.underElfHill?.length, label);
  }
  assert.equal(state.fen, 'n5nr/2p3p1/2B1k3/4bp1p/Q2PPB1P/6PR/PPP2P2/R4KN1 b - - 5 26');
  assert.equal(replayTrace(trace).fen, state.fen);
});
