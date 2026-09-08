import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, GameState, PieceState, SquareName } from '../types.js';

// Reviewed in order against rules §§8–11,14.4,15.3,22.7 and printed catalog timing.
const rationale = `
1. e2-e4 crosses empty e3; initial pawn double step creates e3 opportunity and resets clock.
2. White ends the safe move; Black receives its allowance, retaining e3 opportunity.
3. c7-c6 is an empty forward step; e3 opportunity expires, fullmove becomes 2.
4. Black ends safely without changing board, hands or clocks.
5. f2-f4 crosses empty f3; neither King is attacked; f3 opportunity replaces prior rights.
6. White ends safely; f3 opportunity remains until Black moves.
7. d7-d5 crosses empty d6; fullmove becomes 3 and d6 opportunity is recorded.
8. Black ends safely; White receives its move and card allowance.
9. Guardian moves h2-h4 via h3; optional h1 follower is omitted; no en passant, move consumed, Fog drawn.
10. Guardian replacement turn ends with unchanged pieces and both allowances reset.
11. Ke8-d7 is one diagonal; White pawn attacks reach only rank5, and Bishops have no open d7 ray; Black rights lost.
12. Black hands over safely, retaining only White castling rights.
13. Assassin lets Ke1 capture its own physical d2 Pawn; d2 is safe; White rights lost, capture clock reset, Disintegration drawn.
14. Assassin turn ends; captured d2 identity stays off board.
15. Qd8-e8 is an empty horizontal step; King d7 remains safe.
16. Black ends without changing cards, board or clocks.
17. Rh1-h3 crosses now-empty h2 and stops below h4 Pawn.
18. White ends; Black King d7 is not attacked.
19. g7-g5 crosses empty g6; fullmove6, g6 opportunity, no capture.
20. Black ends; g6 opportunity survives only this boundary.
21. Kd2-e1 is a safe adjacent return; Qe8 is blocked by black e7 and white e4; no restored castling.
22. White ends safely with no en passant.
23. Kd7-e6 is adjacent; f4 attacks e5 rather than e6, and White Queen d1 is not aligned with e6.
24. Black ends with safe King e6.
25. c2-c3 advances without capture, clearing c2 and resetting clock.
26. White ends; no hand or effect changes.
27. Nb8-d7 is a jumping 2-by-1 move to empty d7.
28. Black ends; Knight identity remains the original b8 Knight.
29. Qd1-d4 crosses empty d2,d3; Qd4 and Ke6 differ by 1 file and 2 ranks, so no check.
30. White ends safely after the Queen advance.
31. b7-b5 crosses b6; b6 en-passant opportunity and fullmove9.
32. Black Anathema swaps physical White Bf1 with Ra1; no path needed; no King attack changes; Guardian drawn, b6 retained.
33. Black ends; swapped identities and en-passant state remain intact.
34. Original h1 Rook moves h3-g3 one horizontal square; it is distinct from original a1 Rook now f1.
35. White ends safely; b6 opportunity has expired.
36. Ke6-e5 enters Qd4 and Pf4 attacks temporarily under §11.6; pending rescue required, endTurn unavailable.
37. Coup makes physical e7 Pawn royal and former e8 King a capturable Prince; e7 is safe, resolving rescue; continuing card retained, Haunting Memories drawn.
38. Black ends with royal Pawn e7 and Prince e5; original e8 piece is no longer royal.
39. Ph4xg5 captures physical black g7 Pawn diagonally; white e1 King stays safe.
40. White ends; Black royal remains the e7 Pawn.
41. Bf8-g7 is an empty diagonal step; Prince e5 need not be protected from capture.
42. Black ends; no new royal threat.
43. Qd4xe5 legally captures the nonroyal Prince and checks royal e7 along empty e6.
44. White ends while Black is checked; Black has the ordinary Bg7xe5 answer.
45. c6-c5 fails to answer Qe5-e7 check, creating provisional rescue; a Fortification wall on the e-file could save it.
46. Fortification c5-c6 blocks no e5-e7 ray; failed rescue spends the card, removes attempted wall and rolls back c6-c5 and its clocks; Holy Quest drawn.
47. Bg7xe5 crosses empty f6 and captures the checking Queen, curing royal e7 check with Black card allowance already consumed.
48. Black ends safely; White Queen remains captured and Prince is still captured.
49. Pe4xd5 captures original black d7 Pawn; no royal on d5, no promotion.
50. White ends; Black royal e7 remains safe.
51. h7-h6 advances one empty square, resetting clock and advancing fullmove13.
52. Haunting Memories copies last declared nonunique Fortification despite its fizzle; retains physical copy on b5-c4 boundary and draws Fireball.
53. Black ends; copied wall persists independent of occupying pieces.
54. Original h1 Rook g3-g4 moves one square without crossing b5-c4 wall.
55. White ends with no captures or card changes.
56. b5-b4 is a vertical step, not the wall boundary b5-c4; wall remains fixed.
57. Black ends; b4 Pawn cannot alter wall position.
58. Onslaught advances original e2 Pawn d5-d6 and f2 Pawn f4-f5 into empty squares; d6 Pawn checks royal e7, which can capture it; Think Again drawn.
59. White replacement turn ends; Black receives legal exd6 check response.
60. Royal e7 Pawn captures d6 diagonally with Pawn powers, taking physical white e2 Pawn; d6 is safe from f5/g5 Pawns and White Bishop paths.
61. Black ends with the same royal identity on d6.
62. a2-a4 crosses empty a3; Black b4 Pawn has a potential en-passant capture at a3.
63. White ends preserving physical a2 Pawn en-passant opportunity.
64. a7-a6 chooses an ordinary step instead of en passant; opportunity expires.
65. Black ends; safe d6 royal and fixed wall unchanged.
66. f5-f6 advances original f2 Pawn; its attacks e7,g7 miss royal d6.
67. Disintegration kills White original a2 Pawn on a4; it is dead rather than captured; no board ray to either royal opens, Curse drawn.
68. White ends preserving permanent death and card allowance reset.
69. Original h8 Rook moves h8-h7 into empty h7; royal d6 is safe.
70. Black ends with no effect or hand changes.
71. Original h1 Rook g4-h4 moves horizontally; no wall crossing.
72. Curse targets physical black f8 Bishop on e5, limiting it to two squares; Black c8 Bishop is unaffected; Truce drawn and Curse retained.
73. White ends with all three continuing records intact.
74. Original a8 Rook a8-a7 enters square vacated by a7 Pawn.
75. Black ends; two Black Rooks keep distinct identities on a7,h7.
76. Ke1-f2 is safe: Be5 is not aligned with f2, Qe8 is not aligned, and black c8 diagonal stops at own d7 Knight.
77. White ends at f2 with no attack from the cursed e5 Bishop.
78. Original h8 Rook h7-h8 returns one square; castling remains revoked.
79. Black ends safely with no card changes.
80. Original h1 Rook h4-c4 crosses g4,f4,e4,d4, all empty; endpoint c4 does not itself cross wall b5-c4.
81. White ends with fixed wall and Rook on c4.
82. Cursed original f8 Bishop e5-d4 moves one diagonal square and checks White f2 through empty e3, within two-square Curse reach.
83. Black ends giving check; White can interpose Be3.
84. Original c1 Bishop c1-e3 crosses empty d2 and blocks d4-e3-f2 checking diagonal.
85. White ends safely with e3 blocker; original f1 Bishop remains at a1.
86. Original g8 Knight g8xf6 captures original White f2 Pawn with a jump; Black royal d6 remains safe.
87. Black ends; f6 Knight differs from original b8 Knight on d7.
88. Original h1 Rook c4-c5 makes a vertical step without traversing wall b5-c4; c5 is not aligned with royal d6.
89. White ends; no royal check or new en passant.
90. Original g8 Knight f6-d5 jumps to empty d5; fullmove22, no capture.
91. White Think Again immediately rewinds that Knight to f6 and clocks to before step90, forbids repeating f6-d5, draws Toll, leaves Black move available.
92. Black chooses different physical Pawn b4-b3; no wall crossed, clock reset; White reaction allowance remains consumed.
93. Black ends; White gets fresh own-turn allowance despite its previous reaction.
94. Original a1 Rook f1-d1 crosses empty e1; original h1 Rook stays c5 and White King stays screened at f2 by Be3.
95. White ends with no board or effect changes.
96. Original g8 Knight f6-g4 jumps to empty g4 and checks White f2 by Knight geometry.
97. Black ends giving check; White has safe e2 escape.
98. Kf2-e2 evades Ng4; Qe8-e2 ray is blocked by White Be3, and Bd4 is not aligned with e2.
99. White ends safely on e2.
100. Original b8 Knight d7-f6 jumps to square vacated by other Knight; original g8 Knight remains g4.
101. Black ends; newly opened c8 diagonal passes through d7,e6,f5 and stops at Black original g8 Knight on g4; royal d6 is not aligned.
102. Ke2-d3 is adjacent and safe: Bd4 shares a file, not diagonal; Ng4,Nf6 do not attack d3; royal Pd6 attacks c5,e5.
103. White ends with King d3 and unchanged continuing records.
104. a6-a5 advances original a7 Pawn into empty a5; does not attack King d3.
105. Black ends with no card changes or en-passant opportunity.
106. Original c1 Bishop e3-f2 moves one diagonal; removing e3 blocker does not expose King d3 to Qe8 or Bd4, neither aligned.
107. White ends safely at d3 with Bishop f2.
108. Uncursed original c8 Bishop c8-e6 crosses empty d7; cursed original f8 Bishop stays d4; e6 is not aligned with King d3.
109. Black ends with royal Pawn d6 safe and both Bishop identities distinct.
110. Original a1 Rook d1-e1 moves one horizontal square; royal d6 is not aligned with e1.
111. White ends the fiftieth regular command; Black to move, both royals safe, three continuing effects retained.
`.trim().split('\n');

const physical = (state: GameState) => state.pieces.map(({ capturedAtPly: _ply, capturedBy: _actor, ...piece }) => piece);
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;

// Independent geometry for this trace's ordinary roles, one fixed wall and Curse.
function reaches(state: GameState, piece: PieceState, destination: string): boolean {
  assert.ok(piece.square);
  const [x,y] = xy(piece.square), [tx,ty] = xy(destination);
  const dx = tx-x, dy = ty-y, distance = Math.max(Math.abs(dx), Math.abs(dy));
  const cursed = state.effects.some(effect => (effect as { type?: string; pieceId?: string }).type === 'curse'
    && (effect as { pieceId?: string }).pieceId === piece.id);
  if (cursed && distance > 2) return false;
  if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  const geometry = piece.role === 'pawn' ? Math.abs(dx) === 1 && dy === (piece.owner === 'white' ? 1 : -1)
    : piece.role === 'king' ? distance === 1
    : piece.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
    : piece.role === 'rook' ? dx === 0 || dy === 0
    : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
  if (!geometry || !distance) return false;
  let previous: string = piece.square;
  for (let step=1; step<=distance; step++) {
    const square: string = String.fromCharCode(97+x+Math.sign(dx)*step)+(y+Math.sign(dy)*step+1);
    if (state.effects.some(effect => {
      const wall = effect as { type?: string; from?: string; to?: string };
      return wall.type === 'fortification' && (wall.from === previous && wall.to === square || wall.to === previous && wall.from === square);
    })) return false;
    if (step < distance && state.pieces.some(p => p.zone === 'board' && p.square === square)) return false;
    previous = square;
  }
  return true;
}

test('iteration 085: independently reviewed deterministic campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/085.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860085);
  assert.equal(trace.steps.length, 111);
  assert.equal(rationale.length, trace.steps.length);
  rationale.forEach((line,index) => assert.ok(line.startsWith(`${index+1}. `)));
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 10);
  const states = [createGameState(trace.initial)];
  for (const [index,{action}] of trace.steps.entries()) {
    const n = index+1, before = states[index]!;
    const result = applyAction(before,action);
    assert.ok(result.ok, rationale[index]);
    const after = result.state;
    const expected = structuredClone(physical(before));
    const relocate = (id: string, square: SquareName | null, zone: PieceState['zone'] = 'board') => {
      const piece = expected.find(p => p.id === id)!;
      assert.ok(piece, `physical identity ${id}`); piece.square = square; piece.zone = zone;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from;
      assert.match(action.to,/^[a-h][1-8]$/);
      const piece = before.pieces.find(p => p.square === action.from && p.zone === 'board')!;
      const victim = before.pieces.find(p => p.square === action.to && p.zone === 'board');
      assert.equal(piece.owner,before.turn.color);
      if (piece.role === 'pawn' && !victim) {
        const [x,y] = xy(action.from),[tx,ty] = xy(action.to), direction = piece.owner === 'white' ? 1 : -1;
        assert.equal(tx,x); assert.ok(ty-y === direction || y === (direction===1?1:6) && ty-y === 2*direction);
        for (let r=y+direction;r!==ty;r+=direction) assert.ok(!before.pieces.some(p=>p.square===`${from[0]}${r+1}`));
      } else assert.ok(reaches(before,piece,action.to),`step${n} movement geometry`);
      if (victim) { assert.notEqual(victim.owner,piece.owner); assert.equal(victim.royal,false); relocate(victim.id,null,'captured'); }
      relocate(piece.id,action.to as SquareName);
      assert.equal(after.turn.moveMade,true); assert.equal(after.turn.phase,'afterMove');
      const oldClock = before.fen.split(' '), newClock = after.fen.split(' ');
      assert.equal(Number(newClock[4]),piece.role==='pawn'||victim?0:Number(oldClock[4])+1);
      assert.equal(Number(newClock[5]),Number(oldClock[5])+(piece.owner==='black'?1:0));
      assert.deepEqual(after.enPassant, piece.role==='pawn' && Math.abs(Number(action.to[1])-Number(action.from[1]))===2
        ? [{target:`${action.from[0]}${(Number(action.to[1])+Number(action.from[1]))/2}`,pawnId:piece.id}] : []);
    }
    if (n===9) relocate('white-pawn-h2','h4');
    if (n===13) { relocate('white-king-e1','d2'); relocate('white-pawn-d2',null,'captured'); }
    if (n===32) { relocate('white-rook-a1','f1'); relocate('white-bishop-f1','a1'); }
    if (n===37) { expected.find(p=>p.id==='black-pawn-e7')!.royal=true; expected.find(p=>p.id==='black-king-e8')!.royal=false; }
    if (n===46 || n===91) expected.splice(0,expected.length,...physical(states[n===46?44:89]!));
    if (n===58) { relocate('white-pawn-e2','d6'); relocate('white-pawn-f2','f5'); }
    if (n===67) relocate('white-pawn-a2',null,'dead');
    assert.deepEqual(physical(after),expected,`step${n}: independently expected physical board`);
    if (action.type==='endTurn') {
      assert.equal(after.fen,before.fen); assert.deepEqual(after.enPassant,before.enPassant);
      assert.deepEqual(after.turn,{color:before.turn.color==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}});
    }
    if (action.type==='playCard') {
      const owner = n===91?'white':before.turn.color;
      for (const color of ['white','black'] as const) {
        const old = before.players[color], next = after.players[color];
        if (color!==owner) assert.deepEqual(next,old);
        else {
          const card: CardInstance=old.hand.find(c=>c.id===action.cardInstanceId)!;
          assert.ok(card); assert.equal(before.turn.cardPlays[color],0);
          assert.deepEqual(next.hand,[...old.hand.filter(c=>c.id!==card.id),old.deck[0]]);
          assert.deepEqual(next.deck,old.deck.slice(1));
          assert.deepEqual(next.discard,[...old.discard,...([37,52,72].includes(n)?[]:[card])]);
          assert.equal(after.turn.cardPlays[color],1);
        }
      }
      if ([9,13,58].includes(n)) { assert.equal(after.turn.moveMade,true); assert.deepEqual(after.enPassant,[]); }
      else if ([46,91].includes(n)) { assert.equal(after.fen,states[n===46?44:89]!.fen); assert.equal(after.turn.moveMade,false); }
      else { assert.equal(after.turn.phase,before.turn.phase); assert.deepEqual(after.fen.split(' ').slice(4),before.fen.split(' ').slice(4)); assert.deepEqual(after.enPassant,before.enPassant); }
    } else assert.deepEqual(after.players,before.players,`step${n}: no card expenditure`);
    const effects: unknown[] = [];
    if (n>=37) effects.push({type:'coup',owner:'black',card:{id:'black-hand-4-coup',cardId:'coup'},princeId:'black-king-e8',kingId:'black-pawn-e7',princeRole:'king'});
    if (n>=52) effects.push({type:'fortification',owner:'black',card:{id:'black-deck-1-haunting-memories',cardId:'haunting-memories'},from:'b5',to:'c4'});
    if (n>=72) effects.push({type:'curse',owner:'white',card:{id:'white-deck-3-curse',cardId:'curse'},pieceId:'black-bishop-f8'});
    assert.deepEqual(after.effects,effects);
    assert.equal(!!after.pendingRescue,[36,45].includes(n));
    for (const color of ['white','black'] as const) {
      const king=after.pieces.find(p=>p.owner===color && p.royal)!;
      const attackers=after.pieces.filter(p=>p.zone==='board'&&p.owner!==color&&reaches(after,p,king.square!));
      assert.equal(attackers.length>0,(color==='black'?[36,43,44,45,46,58,59]:[82,83,96,97]).includes(n),`step${n} ${color} royal attack geometry`);
    }
    assert.equal(after.orientation,0); assert.equal(after.outcome,null);
    states.push(after);
  }
  assert.equal(states.at(-1)!.fen,'4q2r/r4p2/2ppbn1p/p1R3P1/3b2n1/1pPK4/1P3BP1/BN2R1N1 b - - 3 26');
  assert.deepEqual(replayTrace(trace),states.at(-1));
});
