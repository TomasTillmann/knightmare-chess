import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { attacks } from 'chessops/attacks';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Reviewed in order against rules §§8–15, 17.1, 18.5, 20, 22.9–10 and printed catalog timing.
const rationales = `
1 Fanatic moves c2 Pawn through empty c3/c4 to c5; no en passant or promotion.
2 White finishes the replacement turn; Black receives fresh allowances.
3 Black g7 Pawn advances to empty g6.
4 Black finishes; White to move.
5 White Queen moves d1-c2 diagonally to the vacated square.
6 White finishes; Black to move.
7 Black Knight jumps g8-h6.
8 Black finishes; White to move.
9 White Queen moves c2-c4 through empty c3.
10 White finishes; Black to move.
11 Black e7 Pawn advances to e6.
12 Black finishes; White to move.
13 White Knight jumps g1-h3.
14 White finishes; Black to move.
15 Black Bishop travels f8-d6 through empty e7.
16 Black finishes; White to move.
17 White Queen slides c4-d4.
18 White finishes; Black to move.
19 Black Bishop captures the physical c2 Pawn on c5 from d6.
20 Black finishes; White to move.
21 Confabulation merges h1 Rook into the friendly h2 Pawn via a one-square rook move; both identities persist.
22 White finishes the merge move; Black to move.
23 Black b7 Pawn advances through b6 to b5; b6 en passant opportunity records its identity.
24 Black finishes without expiring its just-created en passant opportunity.
25 White Knight jumps b1-c3 and declines en passant.
26 White finishes; Black to move.
27 Black Bishop returns c5-e7 through empty d6.
28 Black finishes; White to move.
29 White Queen captures h8 Rook along d4-e5-f6-g7-h8 and checks e8 along rank eight.
30 White finishes; Black must answer check.
31 Dubbing f7-g5 has valid knight geometry but fails to answer the h8 Queen; spend card and retain checked Black regular move.
32 Black Bishop e7-f8 interposes on the h8-e8 Queen ray, curing check.
33 Black finishes; White to move.
34 Annexation advances b2-b4 and f2-f4 on initially empty paths; both starting Pawns grant en passant.
35 White finishes; both en passant opportunities survive into Black turn.
36 Black Queen d8-f6 passes empty e7 and declines en passant.
37 Black finishes; White to move.
38 White a2 Pawn advances to a3.
39 White finishes; Black to move.
40 Black Knight jumps b8-c6.
41 Black finishes; White to move.
42 White Knight jumps c3-d1.
43 White finishes; Black to move.
44 Black Queen f6-h4 passes empty g5.
45 Black finishes; White to move.
46 White g2 Pawn advances to g3.
47 White finishes; Black to move.
48 Black Queen h4-d8 retraces the clear g5/f6/e7 diagonal.
49 Black finishes; White to move.
50 White Queen h8-e5 slides through empty g7/f6.
51 White finishes; Black to move.
52 Breakthrough moves e6 Pawn forward to capture the White Queen on e5; consumes Black move.
53 Black finishes the replacement move; White to move.
54 White f4 Pawn advances to f5.
55 White finishes; Black to move.
56 Black g6 Pawn captures the physical f2 Pawn diagonally on f5.
57 Black finishes; White to move.
58 White d2 Pawn advances to d3.
59 White finishes; Black to move.
60 Annexation moves d7-d5 and f5-f3 simultaneously; only starting d7 Pawn grants en passant.
61 White Knightmare cancels both Annexation segments, restores clocks and Pawns, returns Black card/draw/allowance and requires a different move.
62 Black Knight c6 captures b4 Pawn as a genuinely different replacement.
63 No Quarter makes that exact captured b2 Pawn dead; no board movement or new move clock.
64 Black finishes; both players receive fresh allowances.
65 White a3 Pawn captures the Black b8 Knight on b4.
66 White finishes; Black to move.
67 Black Bishop f8-g7 is a quiet diagonal move.
68 Black finishes; White to move.
69 White Knight jumps h3-f4.
70 White finishes; Black to move.
71 Evangelists swaps Black g7 Bishop and White f1 Bishop without capture, consuming Black move.
72 Black finishes; White to move.
73 White g3 Pawn advances to g4.
74 White finishes; Black to move.
75 Black King e8-f8 temporarily enters White g7 Bishop attack; pending rescue must prevent ending the turn.
76 Anathema swaps White g7 Bishop with a1 Rook; f8 is no longer attacked and Black rescue clears.
77 Black finishes only after the rescue; White to move.
78 White Knight jumps d1-b2.
79 White finishes; Black to move.
80 Black Queen slides d8-e8.
81 Black finishes; White to move.
82 White Knight jumps f4-e6.
83 White finishes; Black to move.
84 Black f7 Pawn captures the physical g1 Knight diagonally on e6.
85 Black finishes; White to move.
86 Lost Castle exchanges White g7 Rook and Black a8 Rook; no capture and White move consumed.
87 White finishes; Black to move.
88 Black Queen moves e8-f7 diagonally.
89 Black finishes; White to move.
90 White Bishop captures h6 Knight along c1-d2-e3-f4-g5-h6.
91 White finishes; Black to move.
92 Black d7 Pawn advances to d6.
93 Black finishes; White to move.
94 White King steps e1-d2 to a safe square.
95 After moving, White transforms physical d2 Pawn on d3 into a Crab; keeps its original identity and active card.
96 White finishes; Black to move.
97 Black Bishop moves f1-g2 diagonally.
98 Black finishes; White to move.
99 White Rook captures Black a7 Pawn from a8.
100 White finishes; Black to move.
101 Black Bishop travels g2-c6 through empty f3/e4/d5.
102 Black finishes; White to move.
103 White Bishop captures Black a8 Rook on g7 from h6, checking f8.
104 White finishes; Black must answer Bishop check.
105 Black King f8-e8 escapes the g7 Bishop diagonal.
106 Black finishes; White to move.
107 White Bishop moves g7-f8 diagonally.
108 White finishes; Black to move.
109 Black Bishop moves c8-d7 diagonally.
110 Black finishes; White to move.
111 White Rook a7-c7 captures the c7 Pawn through empty b7.
112 White finishes; Black to move.
113 Black Bishop returns d7-c8 diagonally.
114 After the move Black plays Panic, imposing the next White turn fifteen-second deadline.
115 Black finishes; White begins with the Panic obligation.
116 White timeout forfeits its turn without movement, removes Panic and advances the quiet halfmove clock.
117 Black Bishop travels c6-h1 through empty d5/e4/f3/g2.
118 Black finishes; White to move.
119 Evil Eye uses h2 composite Rook powers to threaten h1 Bishop; removes only the Bishop, keeping both attacker components stationary.
120 White finishes the stationary capture replacement; Black to move.
121 Black King captures White physical c1 Bishop on f8 from e8; destination is safe.
122 Black finishes; White to move with fifty regular commands reviewed.
`.trim().split('\n');

function checked(state: GameState, color: Color): boolean {
  const setup = parseFen(state.fen).unwrap();
  const king = state.pieces.find(p => p.royal && p.owner === color)!;
  const square = parseSquare(king.square!)!;
  return state.pieces.some(p => {
    if (p.zone !== 'board' || p.owner === color) return false;
    const roles = [p.role];
    // The sole composite in this trace retains the h1 Rook's capture power at h2.
    if (p.id === 'white-pawn-h2' && state.pieces.find(x => x.id === 'white-rook-h1')?.zone === 'away') roles.push('rook');
    return roles.some(role => attacks({ color: p.owner, role }, parseSquare(p.square!)!, setup.board.occupied).has(square));
  });
}

test('iteration 088 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/088.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 122);
  let state = createGameState(trace.initial);
  const states = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    assert.ok(rationales[index]!.startsWith(`${n} `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    const expected = structuredClone(before.pieces);
    const relocate = (id: string, square: SquareName | null, zone: PieceState['zone'] = 'board') => {
      const piece = expected.find(p => p.id === id)!;
      assert.ok(piece, `${n}: physical identity ${id}`);
      piece.square = square; piece.zone = zone;
      if (zone === 'captured') piece.capturedBy = before.turn.color;
      else delete piece.capturedBy;
    };
    let halfmoves = Number(before.fen.split(' ')[4]);
    let fullmoves = Number(before.fen.split(' ')[5]);
    let ep = structuredClone(before.enPassant);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = parseSquare(action.from)!; const to = parseSquare(action.to)!;
      const piece = expected.find(p => p.square === action.from && p.zone === 'board')!;
      const victim = expected.find(p => p.square === action.to && p.zone === 'board');
      assert.equal(piece.owner, before.turn.color);
      const board = parseFen(before.fen).unwrap().board;
      if (piece.role === 'pawn') {
        const direction = piece.owner === 'white' ? 8 : -8;
        if (victim) assert.ok(attacks({ color: piece.owner, role: 'pawn' }, from, board.occupied).has(to));
        else {
          assert.ok(to - from === direction || to - from === 2 * direction);
          if (to - from === 2 * direction) {
            assert.equal(action.from[1], piece.owner === 'white' ? '2' : '7');
            assert.equal(board.get(from + direction), undefined);
          }
        }
      } else assert.ok(attacks({ color: piece.owner, role: piece.role }, from, board.occupied).has(to), rationales[index]);
      if (victim) { assert.notEqual(victim.owner, piece.owner); assert.equal(victim.royal, false); relocate(victim.id, null, 'captured'); }
      relocate(piece.id, action.to as SquareName);
      halfmoves = victim || piece.role === 'pawn' ? 0 : halfmoves + 1;
      fullmoves += before.turn.color === 'black' ? 1 : 0;
      ep = piece.role === 'pawn' && Math.abs(to - from) === 16
        ? [{ pawnId: piece.id, target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName }] : [];
      assert.equal(state.turn.moveMade, true);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.effects, before.effects);
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true);
      assert.equal(checked(before, before.turn.color), false, rationales[index]);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.effects, before.effects);
      assert.equal(state.fen, before.fen);
    } else if (action.type === 'playCard') {
      const owner: Color = action.cardId === 'knightmare' ? 'white' : before.turn.color;
      const player = before.players[owner];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(card); assert.equal(card.cardId, action.cardId);
      assert.equal(before.turn.cardPlays[owner], 0);
      const ongoing = ['confabulation', 'crab'].includes(action.cardId);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== card.id), player.deck[0]!]);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1));
      assert.deepEqual(state.players[owner].discard, ongoing ? player.discard : [...player.discard, card]);
      const effects = [...before.effects];
      if (n === 1) relocate('white-pawn-c2', 'c5');
      if (n === 21) { relocate('white-rook-h1', null, 'away'); effects.push({ type: 'confabulation', owner: 'white', card, pieceIds: ['white-pawn-h2', 'white-rook-h1'] }); }
      if (n === 31) { assert.equal(checked(before, 'black'), true); assert.equal(state.turn.moveMade, false); assert.equal(state.history.at(-1)?.type, 'cardFizzled'); }
      if (n === 34) { relocate('white-pawn-b2', 'b4'); relocate('white-pawn-f2', 'f4'); }
      if (n === 52) { relocate('black-pawn-e7', 'e5'); relocate('white-queen-d1', null, 'captured'); }
      if (n === 60) { relocate('black-pawn-d7', 'd5'); relocate('black-pawn-g7', 'f3'); }
      if (n === 61) {
        expected.splice(0, expected.length, ...structuredClone(states[59]!.pieces));
        assert.equal(state.fen, states[59]!.fen);
        assert.deepEqual(state.players.black, states[59]!.players.black);
        assert.deepEqual(state.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 1, black: 0 } });
        assert.ok(state.chaosForbidden);
        halfmoves = 0; fullmoves = 15; ep = [];
      }
      if (n === 63) { assert.equal(before.pieces.find(p => p.id === 'white-pawn-b2')!.zone, 'captured'); relocate('white-pawn-b2', null, 'dead'); }
      if (n === 71) { relocate('white-bishop-f1', 'g7'); relocate('black-bishop-f8', 'f1'); }
      if (n === 76) { assert.ok(before.pendingRescue); relocate('white-bishop-f1', 'a1'); relocate('white-rook-a1', 'g7'); }
      if (n === 86) { relocate('white-rook-a1', 'a8'); relocate('black-rook-a8', 'g7'); }
      if (n === 95) effects.push({ type: 'crab', owner: 'white', card, pieceId: 'white-pawn-d2' });
      if (n === 114) effects.push({ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 });
      if (n === 119) {
        assert.equal(before.pieces.find(p => p.id === 'white-pawn-h2')!.square, 'h2');
        assert.equal(before.pieces.find(p => p.id === 'white-rook-h1')!.zone, 'away');
        assert.equal(before.pieces.find(p => p.id === 'black-bishop-f8')!.square, 'h1');
        relocate('black-bishop-f8', null, 'captured');
      }
      assert.deepEqual(state.effects, effects);
      if ([1,21,34,52,60,71,86,119].includes(n)) {
        assert.equal(before.turn.phase, 'beforeMove'); assert.equal(before.turn.moveMade, false);
        assert.equal(state.turn.moveMade, true);
        fullmoves += owner === 'black' ? 1 : 0;
        halfmoves = [1,34,52,60,119].includes(n) ? 0 : halfmoves + 1;
        ep = n === 34 ? [{ target: 'b3', pawnId: 'white-pawn-b2' }, { target: 'f3', pawnId: 'white-pawn-f2' }]
          : n === 60 ? [{ target: 'd6', pawnId: 'black-pawn-d7' }] : [];
      }
      if ([63,76,95,114].includes(n)) assert.equal(before.turn.phase, 'afterMove');
      assert.equal(state.turn.cardPlays[owner], 1);
    } else if (action.type === 'panicTimeout') {
      assert.equal(n, 116);
      assert.equal(before.turn.color, 'white'); assert.equal(before.turn.moveMade, false);
      assert.equal(checked(before, 'white'), false);
      assert.deepEqual(state.effects, before.effects.slice(0, 2));
      assert.deepEqual(state.players, before.players);
      assert.equal(state.turn.color, 'black'); assert.equal(state.turn.moveMade, false);
      halfmoves++;
    } else assert.fail(`unreviewed action ${n}`);
    assert.deepEqual(state.pieces, expected, `${n}: independent physical-piece transition`);
    assert.deepEqual(state.enPassant, ep, `${n}: en passant identity and lifetime`);
    assert.equal(Number(state.fen.split(' ')[4]), halfmoves, `${n}: halfmove clock`);
    assert.equal(Number(state.fen.split(' ')[5]), fullmoves, `${n}: fullmove clock`);
    assert.equal(!!state.pendingRescue, n === 75, `${n}: rescue obligation`);
    if (state.turn.moveMade) assert.equal(checked(state, state.turn.color), n === 75, `${n}: independent royal safety`);
    assert.equal(state.orientation, 0);
    assert.equal(state.outcome, null);
    states.push(state);
  }
  assert.equal(trace.moves, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 14);
  assert.deepEqual(replayTrace(trace), state);
});
