import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently read all rows, rules §§8–11, 14.4, 15.4, 17.1, 19.1,
// 22.12 and each played card's artwork. Numbering includes provisional moves.
const rationale = `
1. e2-e4 crosses empty e3; initial double step, e3 en-passant opportunity, pawn clock reset.
2. White finishes e4 with Ke1 safe; Black starts, retaining e3 opportunity.
3. d7-d6 is Black forward into empty d6; clears prior en passant and advances fullmove.
4. Black finishes d6 safely; White starts with unchanged board and clocks.
5. h2-h3 is one empty forward square; pawn clock resets, Ke1 remains safe.
6. White finishes h3; Black starts without drawing or changing clocks.
7. Bc8-g4 crosses d7,e6,f5, all empty; no capture and Ke8 stays safe.
8. White Think Again immediately cancels Bg4, restores c8 and 0/2 clocks, draws Man-Trap; Black must differ.
9. Bc8-d7 uses empty adjacent diagonal and differs from canceled g4 destination.
10. Black ends Bd7; both card allowances reset, White regains own-turn allowance.
11. Disintegration kills owned f2 pawn, no capture or move; draw Curse, preserve clocks.
12. Bf1-d3 crosses empty e2; no capture, current Black bishop d7 is not aligned with Ke1.
13. White ends Bd3; Black starts with no extra card draw.
14. Bd7xh3 crosses e6,f5,g4 empty and captures white h-pawn; reset clock.
15. Black ends capture; Bh3 diagonal to e0 never aligns with Ke1, so no check.
16. e4-e5 is empty forward advance; no exposure of Ke1.
17. White ends e5; Black starts with clocks unchanged.
18. d6xe5 captures white e-pawn on forward diagonal; reset clock, fullmove 5.
19. Black ends pawn capture; White starts with both royal identities intact.
20. Bd3-a6 crosses c4,b5 empty; no capture, Ke1 safe.
21. After move Man-Trap selects friendly Pg2; retain physical effect, draw Rebirth, no clock change.
22. White ends Ba6; g2 trap persists without triggering on its original occupant.
23. Qd8-d4 crosses empty d7,d6,d5; Ke8 safe, d4 does not align with Ke1.
24. Black ends Qd4; trap remains and White starts.
25. d2-d3 enters empty square despite enemy Qd4 ahead; Ke1 is not aligned with Qd4.
26. After move Curse marks enemy Rh8; retain card and draw Blessing, board/clocks unchanged.
27. White ends d3; g2 trap and Rh8 Curse persist.
28. Bh3-e6 crosses empty g4,f5; no capture or trap arrival.
29. Black ends Be6 safely; White starts, no clock advance.
30. Blessing replaces move: Pa2-d5 follows empty b3,c4,d5 diagonal without capture; pawn reset, draw Legacy.
31. White ends replacement move with King safe; Black starts.
32. Be6xd5 captures the blessed a-pawn; Bishop keeps original identity and Black clock advances.
33. Black ends Bxd5; White starts with g2 trap untouched.
34. Ra1-a2 is one empty file step; revoke White queenside castling, increment halfmove.
35. White ends Ra2; Black starts with White K and Black kq castling rights retained.
36. Qd4-e4 is empty adjacent rank step, checking Ke1 along e3,e2.
37. Black can end while giving check; White receives its escape turn.
38. Rh1-h3 crosses empty h2 but leaves Qe4-e3-e2-Ke1 check; provisional rescue required, cannot end turn.
39. Rebirth Bd5-c8 cannot block Qe4-e1; spend/draw Onslaught, fizzle and roll back provisional Rh3 including clocks/right.
40. Ke1-d2 escapes Qe4 file; Qe4 differs by one file/two ranks and Bd5 shares a file, so neither attacks d2.
41. White ends safe Kd2; White castling rights are both lost.
42. Confabulation Ra8-a7 merges with owned Pa7 by one rook step; Ke8 safe, revoke queenside, retain effect, draw Disintegration.
43. Black ends replacement merge; both component identities survive on composite at a7.
44. Rh1-h3 passes empty h2; now Kd2 is off Qe4 file and safe.
45. White ends Rh3; Black starts with persistent composite and markers.
46. Bd5-c6 is an empty diagonal step; no King exposure.
47. Black ends Bc6; White starts without other changes.
48. Ra2-a4 passes empty a3; no capture and Kd2 safe.
49. After move Fortification creates d3-e3 adjacent boundary, even though d3 occupied; draw Neutrality, preserve clocks.
50. White ends Ra4; wall remains fixed between d3 and e3.
51. Ng8-h6 is an empty knight jump, unaffected by Curse on Rh8.
52. Black ends Nh6; White starts with all effects retained.
53. d3-d4 moves forward into empty square without crossing d3-e3 wall; reset clock.
54. White ends d4; Kd2 is not on Qe4 file or diagonal.
55. Qe4-e2 crosses empty e3; this uses e3-e2, not wall d3-e3, and checks adjacent Kd2.
56. Black ends Qe2+; White must answer rank check.
57. Ba6xe2 crosses b5,c4,d3 empty, capturing checking Queen and curing Kd2 check.
58. White ends capture safely; captured Queen remains nonroyal and off-board.
59. Composite a7-a6 moves one forward as its pawn component; rook travels with it, pawn clock reset.
60. Black ends composite advance; White starts, Ke8 still safe.
61. Kd2-e1 is an unattacked adjacent square; Bc6 diagonal goes d5,e4,f3,g2, not e1.
62. White ends Ke1; castling rights do not return.
63. Lost Castle swaps own composite rook at a6 with enemy Rh3; components travel to h3, no arrival trap, draw Sanctuary.
64. Black ends replacement swap safely; Ke1 is not aligned with rook h3.
65. Qd1-d3 crosses empty d2; wall d3-e3 is not crossed, no capture.
66. White ends Qd3; composite Rh3 cannot cross wall into d3 and neither rook axis reaches Ke1.
67. Bc6xa4 crosses empty b5 and captures white a-rook; Ke8 stays safe.
68. Immediate Legacy retrieves white physical Think Again after non-Pawn rook capture, draws Sanctuary, six-card hand; board/clocks unchanged.
69. Black ends capture; Legacy reaction allowance resets for White own turn.
70. Ng1xh3 knight capture removes both black pawn/rook composite components and discards Confabulation.
71. White ends composite capture; trap at g2 remains untouched.
72. c7-c5 crosses empty c6; legal initial double step records c6 en passant and resets clock.
73. Black ends c5; c6 opportunity persists for White response.
74. Ke1-f2 is safe adjacent move; Ba4 diagonal b3,c2 is blocked by white c-pawn and never reaches f2.
75. White ends Kf2; old c6 en passant cleared by King's move.
76. Nh6-f5 is empty knight jump, not a Curse-limited rook move.
77. Black ends Nf5; White starts with King f2 outside knight attack set.
78. Be2-f1 is one empty diagonal step; Kf2 remains safe.
79. White ends Bf1; Black starts normally.
80. Passing swaps Pb7/Pg2 and Ph7/Pb2; non-move swap does not spring g2 trap, preserves identities and resets pawn clock.
81. Black ends replacement swap; none of new pawns attacks either King.
82. Onslaught chooses only Pc2-c3, one legal empty forward step; subset allowed, replacement move, draw Lost Castle.
83. White ends Onslaught; original b-pawn on h7 and g-pawn on b7 do not promote early.
84. Black original h-pawn b2xc1 captures white c-bishop and promotes to Queen on last rank, reset clock.
85. Black ends promotion; Qc1 is not aligned with Kf2, preserving escape-free turn.
86. Nb1-a3 is empty knight jump; King f2 safe and no wall crossing restriction.
87. White ends Na3; Black starts with promoted Queen identity preserved.
88. Qc1-d2 is diagonal into empty square, now checking Kf2 across empty e2.
89. Black ends Qd2+; White must address direct rank check.
90. Bf1-e2 interposes between Qd2 and Kf2; legal noncapture and safe end position.
91. White ends Be2; the physical Bishop blocks d2-e2-f2 Queen line.
92. Cursed Rh8xh7 captures original white b-pawn within one-square cap; revoke Black kingside, reset clock.
93. Black ends Rxh7; no castling rights remain.
94. Na3-b5 is empty knight jump; Be2 continues shielding Kf2 from Qd2.
95. White ends Nb5; all persistent markers remain.
96. c5-c4 is one empty forward square; no capture and reset clock.
97. Black ends c4; white d4/c3 pawns remain distinct and unmoved.
98. Ra6-h6 crosses b6,c6,d6,e6,f6,g6 empty; no capture, Kf2 shield unchanged.
99. White ends Rh6; Black starts with cursed rook still h7.
100. Ba4-c2 crosses empty b3; no capture, Kf2 not on bishop diagonal.
101. After move Disintegration kills owned Pe5; no move/capture clock advance, draw Fatal Attraction, Ke8 safe.
102. Black ends Bc2 plus death; White starts with e5 pawn permanently dead.
103. Rh6-c6 crosses g6,f6,e6,d6 empty; no capture or wall crossing.
104. White ends Rc6; Be2 still blocks Qd2-f2 line.
105. Nb8-a6 is legal empty knight jump; Ke8 remains safe.
106. Retrieved Think Again reacts immediately: return knight to b8 and 3/24 clocks, spend/draw Fatal Attraction once.
107. Bc2-b3 is a different replacement move, one empty diagonal step; canceled Nb8-a6 cannot repeat.
108. Black ends replacement Bb3; White gets fresh card allowance.
109. Be2-h5 crosses empty f3,g4 but exposes Qd2-e2-Kf2; provisional rescue required.
110. Heresy moves enemy bishops first b3-b2,f8-g8 then own h5-h6, but Qd2-f2 remains clear; spend/draw Vulture, roll back provisional Bishop move.
111. Rc6-g6 crosses empty d6,e6,f6; restored Be2 blocks Qd2-f2, so legal replacement move.
112. White ends Rg6; Black starts without repeating the failed bishop move.
113. Cursed Rh7-h5 crosses empty h6 in two squares, exactly its allowed maximum; increment clock.
114. Black ends Rh5; White starts with Kf2 still protected by Be2.
115. Nh3-f4 is empty knight jump; no effect blocks it and Be2 remains in Queen line.
116. White ends Nf4; Black to move, both Kings safe, 50 regular move commands fully reviewed.
`.trim().split('\n');

test('iteration 078 deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/078.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860078);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((line, index) => assert.ok(line.startsWith(`${index + 1}. `)));
  const snapshots: GameState[] = [createGameState(trace.initial)];
  const trap = { type: 'man-trap', owner: 'white', card: { id: 'white-deck-0-man-trap', cardId: 'man-trap' }, square: 'g2' };
  const curse = { type: 'curse', owner: 'white', card: { id: 'white-deck-1-curse', cardId: 'curse' }, pieceId: 'black-rook-h8' };
  const merge = { type: 'confabulation', owner: 'black', card: { id: 'black-hand-0-confabulation', cardId: 'confabulation' }, pieceIds: ['black-pawn-a7', 'black-rook-a8'] };
  const wall = { type: 'fortification', owner: 'white', card: { id: 'white-hand-2-fortification', cardId: 'fortification' }, from: 'd3', to: 'e3' };
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1;
    const before = snapshots[index]!;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationale[index]);
    const after = result.state;
    snapshots.push(after);
    assert.equal(after.orientation, 0);
    assert.equal(Boolean(after.pendingRescue), n === 38 || n === 109);
    assert.deepEqual(after.effects, [n >= 21 && trap, n >= 26 && curse, n >= 42 && n < 70 && merge, n >= 49 && wall].filter(Boolean));
    assert.deepEqual(after.enPassant, n <= 2 ? [{ target: 'e3', pawnId: 'white-pawn-e2' }] : n >= 72 && n <= 73 ? [{ target: 'c6', pawnId: 'black-pawn-c7' }] : []);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)!, ...(n === 84 ? { promotion: 'queen' as const } : {}) };
      assert.equal(chess.isLegal(move), n !== 38 && n !== 109, rationale[index]);
      chess.play(move);
      assert.equal(makeBoardFen(chess.board), after.fen.split(' ')[0], rationale[index]);
      assert.equal(parseFen(after.fen).unwrap().halfmoves, chess.halfmoves);
      assert.equal(parseFen(after.fen).unwrap().fullmoves, chess.fullmoves);
      const moving = before.pieces.find(p => p.square === action.from)!;
      const moved = after.pieces.find(p => p.id === moving.id)!;
      assert.equal(moved.square, action.to);
      assert.equal(moved.owner, moving.owner);
      assert.equal(moved.originalRole, moving.originalRole);
      assert.equal(moved.role, n === 84 ? 'queen' : moving.role);
      assert.equal(moved.promoted, n === 84 || moving.promoted);
      if (moving.id === 'black-rook-h8') assert.ok(Math.abs(Number(action.from[1]) - Number(action.to[1])) <= 2);
      const captured = before.pieces.find(p => p.square === action.to);
      if (captured) assert.equal(after.pieces.find(p => p.id === captured.id)!.zone, 'captured');
      assert.equal(after.turn.color, before.turn.color);
      assert.equal(after.turn.moveMade, true);
      assert.equal(after.turn.phase, 'afterMove');
    } else if (action.type === 'endTurn') {
      assert.deepEqual(after.pieces, before.pieces);
      assert.equal(after.fen, before.fen);
      assert.deepEqual(after.players, before.players);
      assert.equal(after.turn.color, before.turn.color === 'white' ? 'black' : 'white');
      assert.equal(after.turn.moveMade, false);
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 });
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black';
      const other = owner === 'white' ? 'black' : 'white';
      const old = before.players[owner];
      const next = after.players[owner];
      const card = old.hand.find(c => c.id === action.cardInstanceId)!;
      assert.equal(before.turn.cardPlays[owner], 0);
      assert.equal(after.turn.cardPlays[owner], 1);
      assert.deepEqual(next.deck, old.deck.slice(1));
      const retrieved = n === 68 ? old.discard.find(c => c.id === 'white-hand-1-think-again')! : undefined;
      assert.deepEqual(next.hand, [...old.hand.filter(c => c.id !== card.id), ...(retrieved ? [retrieved] : []), old.deck[0]!]);
      assert.deepEqual(after.players[other], before.players[other]);
      assert.deepEqual(next.discard, [...old.discard.filter(c => c.id !== retrieved?.id), ...([21, 26, 42, 49].includes(n) ? [] : [card])]);
      if ([8, 39, 106, 110].includes(n)) {
        const restored = snapshots[n - 2]!;
        assert.equal(after.fen, restored.fen);
        assert.deepEqual(after.pieces, restored.pieces);
        assert.equal(after.turn.moveMade, false);
      } else if ([21, 26, 49, 68].includes(n)) {
        assert.equal(after.fen, before.fen);
        assert.deepEqual(after.pieces, before.pieces);
      } else {
        const expected = structuredClone(before.pieces);
        const piece = (id: string) => expected.find(p => p.id === id)!;
        if (n === 11 || n === 101) {
          Object.assign(piece(n === 11 ? 'white-pawn-f2' : 'black-pawn-d7'), { square: null, zone: 'dead' });
          assert.equal(after.fen.split(' ').slice(1).join(' '), before.fen.split(' ').slice(1).join(' '));
          assert.deepEqual(after.turn, { ...before.turn, cardPlays: { ...before.turn.cardPlays, [owner]: 1 } });
        }
        if (n === 30) piece('white-pawn-a2').square = 'd5';
        if (n === 42) Object.assign(piece('black-rook-a8'), { square: null, zone: 'away' });
        if (n === 63) { piece('black-pawn-a7').square = 'h3'; piece('white-rook-h1').square = 'a6'; }
        if (n === 80) {
          piece('black-pawn-b7').square = 'g2'; piece('white-pawn-g2').square = 'b7';
          piece('black-pawn-h7').square = 'b2'; piece('white-pawn-b2').square = 'h7';
        }
        if (n === 82) piece('white-pawn-c2').square = 'c3';
        assert.deepEqual(after.pieces, expected, rationale[index]);
        const clocks: Record<number, string> = { 30: 'b KQkq - 0 7', 42: 'w k - 4 10', 63: 'w k - 2 15', 80: 'w k - 0 19', 82: 'b k - 0 19' };
        if (clocks[n]) {
          assert.equal(after.fen.split(' ').slice(1).join(' '), clocks[n]);
          assert.equal(after.turn.moveMade, true);
          assert.equal(after.turn.color, before.turn.color);
        }
      }
    }
  }
  const at = (n: number, id: string) => snapshots[n]!.pieces.find(p => p.id === id)!;
  assert.equal(at(11, 'white-pawn-f2').zone, 'dead');
  assert.equal(at(30, 'white-pawn-a2').square, 'd5');
  assert.equal(at(42, 'black-pawn-a7').square, 'a7');
  assert.equal(at(42, 'black-rook-a8').zone, 'away');
  assert.equal(at(63, 'black-pawn-a7').square, 'h3');
  assert.equal(at(63, 'white-rook-h1').square, 'a6');
  assert.equal(at(70, 'black-pawn-a7').zone, 'captured');
  assert.equal(at(70, 'black-rook-a8').zone, 'captured');
  assert.deepEqual(snapshots[70]!.players.black.discard.map(c => c.cardId), ['lost-castle', 'confabulation']);
  assert.deepEqual(['black-pawn-b7', 'white-pawn-g2', 'black-pawn-h7', 'white-pawn-b2'].map(id => at(80, id).square), ['g2', 'b7', 'b2', 'h7']);
  assert.equal(at(82, 'white-pawn-c2').square, 'c3');
  assert.equal(at(101, 'black-pawn-d7').zone, 'dead');
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 15);
  assert.equal(replayTrace(trace).fen, '1n2kb2/1P2ppp1/6R1/1N3n1r/2pP1N2/1bPQ4/3qBKp1/8 b - - 7 26');
});
