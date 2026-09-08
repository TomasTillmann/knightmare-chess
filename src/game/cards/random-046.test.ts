import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently checked in order against rules §§8–13, 19.2, 20, 22.4 and cards.md.
const rationales = `
1. g2-g4 crosses vacant g3; initial pawn double move, King e1 safe, g3 en-passant.
2. White ends; Black starts with both allowances reset and g3 opportunity retained.
3. h7-h6 is an empty forward pawn square; previous g3 opportunity expires.
4. Black ends with unchanged board and clocks; White starts.
5. Nb1-c3 jumps to empty c3 without exposing e1; quiet clock increments.
6. White ends; no cards drawn without a play or discard.
7. a7-a5 crosses vacant a6; Black pawn double creates a6 opportunity.
8. Black ends and preserves a6 availability for White.
9. d2-d4 crosses vacant d3; replaces a6 with d3 opportunity.
10. White ends; d3 opportunity persists into Black turn.
11. Ra8-a6 crosses now-empty a7; loses Black queenside castling and expires d3.
12. Black ends; board and hand counts do not change.
13. Nc3-e4 is a quiet knight jump, with e1 still shielded.
14. White ends; Black receives an unused card allowance.
15. Nb8-c6 is a quiet jump; e8 remains safe behind its pawns.
16. Black ends; White may now move its King.
17. Ke1-d2 is adjacent and safe: Nc6 attacks d4/e5, not d2; White castling gone.
18. Figure Dance after the move cycles Ra1-h1, Rh1-h8, rh8-a8 simultaneously; no capture, Black castling gone, draw Sanctuary.
19. White ends after its spent card; no extra replacement draw.
20. e7-e5 crosses vacant e6 and creates e6 opportunity; e8 stays protected by f8/g8.
21. Black ends retaining e6 availability.
22. Ng1-h3 is a quiet knight jump; d2 remains safe.
23. White ends and expires no additional pieces or effects.
24. b7-b5 crosses vacant b6 and creates b6 en-passant.
25. Black ends retaining b6 opportunity.
26. Ne4-g5 jumps without capture; b6 opportunity expires and d2 remains safe.
27. White ends with unchanged board and cards.
28. Nc6xd4 captures the physical d2 Pawn; knight jump is legal and clock resets.
29. Black ends; captured Pawn remains captured, not dead.
30. e2-e3 moves forward into an empty square and threatens Nd4 without exposing Kd2.
31. White ends; Black gets the next move.
32. Bf8-c5 crosses empty e7/d6; quiet diagonal, King e8 remains safe.
33. Black ends with no replenishment.
34. Evil Eye replaces White move: e3 Pawn could capture Nd4 safely; Nd4 captured while Pawn stays e3; draw Under Elf Hill.
35. White ends its replacement move, resetting card allowances.
36. e5-e4 is an empty forward square before the e3 blocker; pawn clock resets.
37. Black ends; no effects or en-passant survive.
38. Ng5xe4 captures Black e7 Pawn by a knight jump; d2 remains safe.
39. White ends; both captured physical identities remain recorded.
40. Bc5-f8 crosses d6/e7, both empty, to an empty f8 square.
41. Black ends; White starts with no card spent.
42. Ne4-g5 is a quiet jump; d2 stays shielded by e3 and c2.
43. White ends and retains cards.
44. Qd8xg5 crosses e7/f6 empty and captures Nb1 identity at g5.
45. Black ends after capture; no automatic card draw.
46. Nh3-g1 is a quiet jump back; g1 vacant and Kd2 safe.
47. White ends; Black starts.
48. c7-c5 crosses c6 empty, creates c6 opportunity and resets clock.
49. Panic is legal after Black move; White next move has 15000ms, Black spends/draws Abduction.
50. Black ends; Panic remains pending for White and allowances reset.
51. Explicit Panic timeout skips White turn without moving pieces, expires en-passant and Panic, increments quiet clock.
52. Passing in the Night replaces Black move: swap a5/f2 and b5/b2 pawn pairs simultaneously, no capture/promotion; draw Hidden Passage.
53. Black ends the pawn replacement; White starts.
54. Kd2-e2 is safe: f2 pawn attacks e1/g1, Qg5 diagonal stops on e3.
55. White ends; e2 King remains safe.
56. Ra6-f6 crosses b6/c6/d6/e6 empty, no capture and no exposed Black King.
57. Black ends; White can capture the g8 knight.
58. Rh8xg8 captures the Black g8 Knight; f8 Bishop still shields Ke8.
59. White ends; no new check against e8 through occupied f8.
60. Ke8-e7 steps to empty safe e7, beyond the rook rank and blocked Queen e-file.
61. Black ends; White King still shielded on e2.
62. Qd1-e1 is a one-square quiet rank move; e2 King blocks any e-file attack.
63. White ends; Black replacement-card window opens.
64. Black Masquerade moves non-Pawn Rf6-f5 quietly as Queen, consuming move; draw Treason.
65. Black ends its replacement move.
66. White Masquerade moves Qe1-c3 across empty d2 with no capture; consumes move and draws Cathedral.
67. White ends; no extra Regular Move follows Masquerade.
68. Rf5-f3 passes empty f4 and stops before its own f2 Pawn; no check on Ke2.
69. Black ends; White starts safely.
70. Rg8xf8 captures the f8 Bishop; Ke7 is not on this rook rank/file.
71. White ends; Black has after-move saving cards available.
72. Ke7-d8 is provisional self-check from Rf8 through e8; Treason could swap f8/g1 to save it, so §11.6 opens rescue.
73. Treason instead selects h1/g1 and cannot stop Rf8; card fizzles/spends/draws Earthquake and invalid King move rewinds to e7 with old clocks.
74. Ra8-b8 is the legal replacement move after rewind; Black card allowance stays spent.
75. Black ends after the safe replacement; allowances reset.
76. h2-h3 is an empty pawn advance, leaving K e2 safe.
77. White ends with no card play.
78. Rf3xe3 captures the e2 Pawn and checks Ke2 down the file; captures are permitted to give check.
79. Black ends; White must answer the rook check.
80. Ke2-d1 escapes Re3: d1 is off its file/rank, outside Qg5 diagonal and f2 pawn attacks.
81. White ends only after restoring King safety.
82. Qg5-f6 is a one-square quiet diagonal; e7 King remains safe.
83. Black ends; White retains a normal move.
84. a2-a4 crosses a3 empty; own a5 Pawn lies beyond destination; create a3 opportunity.
85. White ends retaining a3 en-passant.
86. g7-g5 crosses g6 empty and stops before g4 enemy Pawn; replaces a3 with g6.
87. Black ends retaining g6 opportunity.
88. Bf1-d3 crosses empty e2; quiet diagonal, d1 King safe, en-passant expires.
89. White ends; Black starts.
90. Qf6-g6 moves quietly one square horizontally; no King exposure.
91. Black ends unchanged board and hands.
92. Qc3-c4 moves to empty c4 without exposing d1, quiet clock increments.
93. White ends; Black still has an after-move Abduction rescue option.
94. Ke7-e8 is provisional self-check from adjacent Rf8; Abduction could remove f8 if recall fails, so rescue is pending.
95. Earthquake rotation cannot remove adjacent rook threat; fizzle/spend/draw Irresistible Force, restore e7 and clocks, no promotions or continuing effect survive.
96. Rb8-b7 is a safe replacement move after rewind; Black card allowance remains spent.
97. Black ends; White starts with fresh allowance.
98. Bd3-e2 is a quiet diagonal; rook e3 is blocked by the bishop and King d1 remains safe.
99. White ends and Black begins.
100. Re3xh3 crosses f3/g3 empty, captures White h2 Pawn, resets clock.
101. White Revenge is legal after opposing move: Black a7 Pawn on f2 captured, no attacker movement; draw Cowardice.
102. Black Abduction after its own move conceals White c2 Pawn as away, spends/draws Figure Dance once; no capture yet.
103. Reveal Abduction changes concealment to recall only; no board/card/clock change.
104. White correctly names its physical c2 Pawn and c2 square; restore same Pawn, clear pending challenge, no extra draw.
105. Black ends once memory challenge resolves; both card allowances reset.
106. Under Elf Hill replaces White move, puts royal d1 King away without capture, consumes move, draws Winged Victory.
107. White ends; return is not yet due during Black turn.
108. Ke7xf8 captures undefended White rook: c4 Queen diagonal hits f7 Pawn, Be2 cannot attack f8, White King absent.
109. Black ends; White King return becomes mandatory at beginning of White turn.
110. Return King to empty edge f1: Qg6 blocked by g5 Pawn, Rh3 does not attack f1, Bc8 blocked by d7; no clocks/allowances spent, King frozen.
111. Qc4-d5 moves quietly; returned King stays f1 and cannot move this turn.
112. White ends; returned King restriction expires.
113. Qg6-e6 crosses empty f6; e6 Queen line toward f1 absent and f8 King stays safe.
114. Black ends with same physical board and card zones.
115. White original f2 Pawn advances a5-a6 into empty square; identity/owner preserved after prior swap, no promotion.
116. White ends, Black starts.
117. Qe6-e7 is a quiet one-square file move; f8 remains safe and halfmove becomes one.
118. Black ends at fullmove 28; White starts with both allowances zero and all mandatory effects resolved.
`.trim().split('\n');

test('iteration 046 independently reviewed random campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/046.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860046);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 118);
  let state = createGameState(trace.initial);
  const states: GameState[] = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const number = index + 1;
    assert.ok(rationales[index]!.startsWith(`${number}. `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    states.push(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const piece = before.pieces.find(p => p.square === action.from && p.zone === 'board')!;
      const victim = before.pieces.find(p => p.square === action.to && p.zone === 'board');
      assert.deepEqual(state.pieces.find(p => p.id === piece.id), { ...piece, square: action.to });
      for (const other of before.pieces.filter(p => p.id !== piece.id && p.id !== victim?.id)) {
        assert.deepEqual(state.pieces.find(p => p.id === other.id), other);
      }
      if (victim) {
        assert.equal(state.pieces.find(p => p.id === victim.id)?.zone, 'captured');
        assert.equal(state.pieces.find(p => p.id === victim.id)?.square, null);
      }
      if (![72, 94, 108].includes(number)) {
        const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
        assert.ok(chess.isLegal({ from: parseSquare(action.from)!, to: parseSquare(action.to)! }), rationales[index]);
      }
      assert.equal(!!state.pendingRescue, number === 72 || number === 94);
      const fen = before.fen.split(' ');
      const expectedClock = piece.role === 'pawn' || victim ? 0 : Number(fen[4]) + 1;
      assert.equal(Number(state.fen.split(' ')[4]), expectedClock);
      assert.equal(Number(state.fen.split(' ')[5]), Number(fen[5]) + (piece.owner === 'black' ? 1 : 0));
      const double = piece.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2;
      assert.deepEqual(state.enPassant, double ? [{ target: `${action.from[0]}${(Number(action.to[1]) + Number(action.from[1])) / 2}`, pawnId: piece.id }] : []);
      assert.deepEqual(state.players, before.players);
    } else if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces);
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.players, before.players);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const opponent = owner === 'white' ? 'black' : 'white';
      const player = before.players[owner];
      const card = player.hand.find(c => c.id === action.cardInstanceId)!;
      assert.equal(card.cardId, action.cardId);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c.id !== card.id), player.deck[0]]);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1));
      assert.deepEqual(state.players[owner].discard, [...player.discard, card]);
      assert.deepEqual(state.players[opponent], before.players[opponent]);
      assert.equal(state.turn.cardPlays[owner], 1);
    }
    assert.equal(state.orientation, 0, 'Earthquake fizzles before orientation/promotion can persist');
    assert.deepEqual(state.effects, number === 49 || number === 50 ? [{ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 }] : []);
  }
  const square = (step: number, id: string) => states[step]!.pieces.find(p => p.id === id)?.square;
  assert.deepEqual(['white-rook-a1', 'white-rook-h1', 'black-rook-h8'].map(id => square(18, id)), ['h1', 'h8', 'a8']);
  assert.equal(square(34, 'white-pawn-e2'), 'e3');
  assert.equal(states[34]!.pieces.find(p => p.id === 'black-knight-b8')?.zone, 'captured');
  assert.deepEqual(states[51]!.pieces, states[50]!.pieces);
  assert.equal(states[51]!.fen, 'r1b1kbnR/3p1pp1/r6p/ppp3q1/6P1/4P3/PPPK1P1P/2BQ1BNR b - - 1 13');
  assert.deepEqual(['white-pawn-b2', 'white-pawn-f2', 'black-pawn-a7', 'black-pawn-b7'].map(id => square(52, id)), ['b5', 'a5', 'f2', 'b2']);
  assert.equal(square(64, 'black-rook-a8'), 'f5');
  assert.equal(square(66, 'white-queen-d1'), 'c3');
  for (const [failed, original] of [[73, 71], [95, 93]]) {
    assert.deepEqual(states[failed!]!.pieces, states[original!]!.pieces);
    assert.equal(states[failed!]!.fen, states[original!]!.fen);
    assert.equal(states[failed!]!.pendingRescue, null);
    assert.equal(states[failed!]!.turn.moveMade, false);
  }
  assert.equal(states[101]!.pieces.find(p => p.id === 'black-pawn-a7')?.zone, 'captured');
  assert.equal(states[102]!.pieces.find(p => p.id === 'white-pawn-c2')?.zone, 'away');
  assert.equal(states[102]!.pendingAbduction?.phase, 'concealment');
  assert.equal(states[103]!.pendingAbduction?.phase, 'recall');
  assert.deepEqual(states[104]!.pieces, states[101]!.pieces);
  assert.equal(states[104]!.pendingAbduction, null);
  assert.equal(states[106]!.pieces.find(p => p.id === 'white-king-e1')?.zone, 'away');
  assert.deepEqual(states[109]!.underElfHill, [{ pieceId: 'white-king-e1', player: 'white', returning: true }]);
  assert.equal(square(110, 'white-king-e1'), 'f1');
  assert.equal(states[110]!.turn.moveMade, false);
  assert.equal(legalDests(states[110]!).has('f1'), false, 'returned King cannot move');
  assert.deepEqual(states[112]!.underElfHill, []);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11);
  assert.equal(state.fen, '2b2k2/1r1pqp2/P6p/1PpQ2p1/P5P1/7r/1pP1B3/2B2KNR w - - 1 28');
  assert.deepEqual(replayTrace(trace), state);
});
