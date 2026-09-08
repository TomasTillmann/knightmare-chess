import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Reviewed against rules §§6,8–13,16.2,17.1,17.3,19.3,20 and all thirteen artworks.
// Each statement is an independently reviewed action, including speech and endTurn.
const rationales = `
1. White a2-a4 traverses empty a3, leaves a3 en-passant opportunity but no black captor.
2. Black plays Plots in the opposing move window; none of its other four cards has that timing, so two empty-eligibility plays are offered.
3. White ends; unused Black Plots expires and both allowances reset.
4. Black g7-g5 traverses g6; replace a3 opportunity with g6, no adjacent white captor.
5. Black Truce follows its move; retain the card, draw Holy War, prohibit all captures and checks.
6. Black ends; Truce and g6 opportunity remain.
7. White c2-c3 advances one empty square and clears g6.
8. White Siege swaps physical g1 Knight and a1 Rook without capture or move clocks; preserve their identities and unmoved castling records.
9. White ends after Siege; Black receives one move.
10. Black a7-a5 traverses a6; a4 blocks further advance but not this move.
11. Black ends, retaining a6 opportunity with no legal capture under Truce.
12. White e2-e4 traverses empty e3; replaces a6 opportunity.
13. White Curse marks opposing Queen d8; retained physical card, Chaos drawn, clocks and e3 unchanged.
14. White ends; Truce and Queen distance limit remain.
15. Black c7-c5 traverses c6; replace e3 opportunity.
16. Black ends; c6 opportunity retained, Truce forbids capture.
17. White e4-e5 advances one empty square; c6 expires.
18. White ends after the pawn move.
19. Black b7-b5 traverses b6; new b6 opportunity, no legal captor.
20. Black Panic after its move gives White 15000ms next move; discard and draw Disintegration.
21. Black ends; White starts with Panic and ordinary move available.
22. White Bishop f1-d3 passes empty e2; timely move consumes Panic and clears b6.
23. White ends; Black has no Panic obligation.
24. Black Knight g8-h6 is a quiet 1-by-2 jump.
25. Black ends after the Knight jump.
26. White h2-h3 is one forward empty square; halfmove clock resets.
27. White ends after h3.
28. Black c5-c4 is one forward empty square; c3 remains occupied by White.
29. Black ends; captures remain prohibited by Truce.
30. White Queen d1-e2 takes one empty diagonal square.
31. White ends after Queen e2.
32. Black d7-d5 crosses d6; e5 Pawn gives raw FEN d6 target but Truce forbids actual en-passant capture.
33. Black ends; raw d6 and physical opportunity survive until White moves.
34. White original g1 Knight a1-b3 is a quiet 1-by-2 jump and expires d6.
35. White ends after b3.
36. Black King e8-d7 moves one diagonal square, loses both castling rights, remains safe under Truce.
37. Black Holy War swaps h6 Knight and f8 Bishop atomically, keeping physical identities and clocks.
38. Black ends after the Knight/Bishop swap.
39. White f2-f3 advances into an empty square.
40. White ends after f3.
41. Black Knight b8-a6 is a quiet 1-by-2 jump.
42. Black ends after a6.
43. White g2-g3 advances one empty square, freeing g2 for its Rook.
44. White ends after g3.
45. Black Rook a8-b8 moves one empty horizontal square; Black castling rights were already lost.
46. Black ends after Rook b8.
47. White Knight b1-a3 is a quiet 1-by-2 jump.
48. White Doomsayer after its move retains its card and opens Black immediate optional naming; draw Dark Mirror.
49. Black declines that immediate choice; no piece or card changes and no turn is consumed.
50. White ends with Doomsayer retained and no pending choice.
51. Black King d7-c7 moves one empty horizontal square.
52. Black says Knight; Truce protects both Knights, so no losses and Doomsayer remains.
53. Black ends after the protected naming event.
54. White original a1 Rook g1-g2 moves one empty square and loses its remaining original queenside right.
55. White says Bishop; Truce blocks every Doomsayer capture, retaining the effect.
56. White ends after Rook g2 and harmless naming.
57. Black says Rook before moving; Truce protects both Rooks, move remains available.
58. Black g5-g4 advances one empty square; g3 White Pawn is not captured.
59. Black ends after g4.
60. White Blessing replaces its move with b2-a1, one empty diagonal; Pawn remains an unpromoted physical Pawn and halfmove resets.
61. White ends after its replacement move; no extra regular move is available.
62. Black Rook b8-a8 moves one empty horizontal square without restoring rights.
63. Black ends after Rook a8.
64. White original g1 Knight b3-c5 is a quiet 1-by-2 jump.
65. White ends after c5; Truce still prevents checks.
66. Black says Bishop; Truce protects both Bishops and Doomsayer remains.
67. Black says Queen; Truce protects its cursed Queen, without consuming its move.
68. Black Bishop h6-g5 takes one empty diagonal square.
69. Black says Rook after moving; Truce again prevents any loss.
70. Black ends after g5 and the harmless naming.
71. White Long Jump replaces its move: Knight c5-b1 changes square color, lands empty, and cannot capture.
72. White ends after Long Jump; no third or ordinary additional move.
73. Black says Bishop before moving; Truce leaves Doomsayer active.
74. Black King c7-d7 is a quiet one-square move, temporarily advancing Black fullmove counter.
75. White Chaos immediately cancels c7-d7: restore King c7, all clocks and Black move opportunity; forbid exact black-king-e8:c7:d7 token; draw Fanatic.
76. Black substitutes b5-b4, a different physical move, clears cancellation restriction, advances Black clock once.
77. Black ends; White reaction allowance does not carry into its next turn.
78. White says Rook before moving; Truce prevents losses.
79. White says Bishop before moving; Truce prevents losses and retains Doomsayer.
80. White says Pawn before moving; Truce protects all Pawns.
81. White Queen e2-e4 traverses empty e3; no capture at e4.
82. White ends after Queen e4.
83. Black says Rook before moving; Truce blocks Doomsayer.
84. Black Pacifism before its move marks its nonroyal Bishop c8, retains the card and draws Fanatic.
85. Black King c7-b8 makes one diagonal quiet move; Pacifism does not move the Bishop.
86. Black says Rook after moving; Truce blocks all losses.
87. Black says Bishop; Truce protects both, and c8 also has Pacifism.
88. Black says Queen; Truce protects Queen d8.
89. Black ends after the harmless naming sequence.
90. White Bishop c1-b2 takes the now-empty adjacent diagonal square.
91. White ends after Bishop b2.
92. Black says Rook before moving; Truce prevents capture.
93. Black Bishop g5-f6 moves one empty diagonal square.
94. Black ends after Bishop f6.
95. White h3-h4 moves one empty forward square; g4 is not captured.
96. White ends after h4.
97. Black original g8 Knight f8-d7 makes a quiet 2-by-1 jump.
98. Black ends after Knight d7.
99. White Queen e4-f5 moves one empty diagonal square.
100. White says Queen after moving; Truce prevents loss of Queen f5.
101. White ends after Queen f5 and naming.
102. Black King b8-b7 makes one quiet vertical step.
103. Black says Bishop after moving; Truce and Pacifism preserve the board.
104. Black Figure Dance simultaneously rotates a1 Pawn to h1, h1 White Rook to h8, h8 Black Rook to a8, a8 Black Rook to a1; no capture or promotion, final White right revoked.
105. Black ends after Figure Dance; the corner Pawn remains a Pawn on its own first rank.
106. White f3-f4 advances one empty forward square.
107. White ends after f4.
108. Black b4-b3 advances one empty forward square, adjacent White pieces are not captured.
109. Black says Pawn; Truce prevents all Doomsayer captures.
110. Black ends after b3 and naming.
111. White says Queen before moving; Truce prevents capture.
112. White King e1-f2 moves one quiet diagonal square; all castling rights are already absent.
113. White ends after King f2.
114. Black cursed Queen d8-c7 moves one empty diagonal square, within Curse two-square limit.
115. Black ends after Queen c7.
116. White Rook h8-g8 moves one empty horizontal square.
117. White ends after Rook g8.
118. Black Knight a6-b8 makes a quiet 1-by-2 jump.
119. Black ends after Knight b8.
120. White original b1 Knight a3-c2 makes a quiet 2-by-1 jump.
121. White says Pawn after moving; Truce prevents all losses.
122. White ends after Knight c2.
123. Black says Rook before moving; Truce prevents losses.
124. Black says Pawn before moving; Truce still blocks Doomsayer.
125. Black Bishop f6-g7 takes one empty diagonal square.
126. Black Mystic Shield selects exactly the Bishop just moved to g7, protects it during White next turn, discards and draws Assassin.
127. Black ends; Shield remains for White upcoming turn.
128. White Queen f5-g6 takes one empty diagonal square; no capture of protected Bishop g7.
129. White says Pawn; Truce prevents losses while Shield remains active.
130. White ends; Black Bishop Shield expires after the protected opposing turn.
131. Black cursed Queen c7-c6 takes one empty vertical step within its two-square limit.
132. Black ends after Queen c6.
133. White Queen g6-h5 takes one empty diagonal square.
134. White says Pawn after moving; Truce prevents capture.
135. White says Knight after moving; Truce prevents capture and Doomsayer remains.
136. White ends after Queen h5 and both names.
137. Black original g8 Knight d7-b6 makes a quiet 2-by-1 jump.
138. Black says Bishop after moving; Truce prevents capture.
139. Black ends after Knight b6.
140. White original b1 Knight c2-e1 makes a quiet 2-by-1 jump, completing regular move command fifty.
141. White ends with both Kings safe, no outstanding choices, and Black next to act.
`.trim().split('\n');

const xy = (square: string): [number, number] => {
  assert.match(square, /^[a-h][1-8]$/);
  return [square.charCodeAt(0) - 97, Number(square[1]) - 1];
};
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture = false): boolean {
  const [x, y] = xy(piece.square!); const [u, v] = xy(to);
  const dx = Math.abs(u - x), dy = Math.abs(v - y);
  if (!dx && !dy) return false;
  if (piece.role === 'knight') return dx * dy === 2;
  if (piece.role === 'king') return Math.max(dx, dy) === 1;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return dx === 1 && v - y === forward;
    if (dx || ![forward, 2 * forward].includes(v - y)) return false;
    if (dy === 2 && !(piece.owner === 'white' ? y <= 1 : y >= 6)) return false;
  } else if (!(piece.role === 'queen' && (!dx || !dy || dx === dy)
      || piece.role === 'rook' && (!dx || !dy) || piece.role === 'bishop' && dx === dy)) return false;
  const distance = Math.max(dx, dy);
  for (let k = 1; k < distance; k++) {
    const square = `${String.fromCharCode(97 + x + Math.sign(u - x) * k)}${y + Math.sign(v - y) * k + 1}`;
    if (pieces.some(p => p.zone === 'board' && p.square === square)) return false;
  }
  return true;
}
function boardFen(pieces: PieceState[]): string {
  const letters = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  return Array.from({ length: 8 }, (_, row) => {
    let text = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const square = `${String.fromCharCode(97 + file)}${8 - row}`;
      const piece = pieces.find(p => p.zone === 'board' && p.square === square);
      if (!piece) { empty++; continue; }
      if (empty) { text += empty; empty = 0; }
      text += piece.owner === 'white' ? letters[piece.role].toUpperCase() : letters[piece.role];
    }
    return text + (empty || '');
  }).join('/');
}

test('iteration 145: independent semantics for every action', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/145.json', import.meta.url), 'utf8'));
  assert.equal(trace.seed, 860145);
  assert.equal(rationales.length, 141);
  assert.equal(trace.steps.length, rationales.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players);
  let turn = structuredClone(state.turn), ep: GameState['enPassant'] = [];
  let half = 0, full = 1, active: Color = 'white';
  const effects: unknown[] = [];
  const cardDeclarations: Record<number, [string, unknown]> = {
    2:['plots-within-plots',{player:'black'}], 5:['truce',undefined],
    8:['siege',{knight:'g1',rook:'a1'}], 13:['curse','d8'], 20:['panic',undefined],
    37:['holy-war',{knight:'h6',bishop:'f8'}], 48:['doomsayer',undefined],
    60:['blessing',[{from:'b2',to:'a1'}]], 71:['long-jump',[{from:'c5',to:'b1'}]],
    75:['chaos',undefined], 84:['pacifism','c8'], 104:['figure-dance',[]], 126:['mystic-shield','g7'],
  };
  assert.deepEqual(players.black.hand.map(c=>c.cardId),['figure-dance','truce','plots-within-plots','panic','evil-eye']);
  // Their printed own-turn timing cannot fit Black's reaction to White a2-a4.
  for (const id of ['figure-dance','truce','panic','evil-eye']) {
    const timing=CARD_CATALOG[id]!.timing;
    assert.ok(!timing.includes('afterOpponentMove')&&!timing.includes('afterOpponentCard'));
  }
  const at = (square: string) => { const p = pieces.find(p => p.square === square); assert.ok(p); return p; };
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, label = rationales[index]!;
    assert.ok(label.startsWith(`${n}. `));
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from = action.from, to = action.to, piece = at(from);
      assert.equal(turn.moveMade, false, label);
      assert.equal(piece.owner, turn.color, label);
      assert.ok(!pieces.some(p => p.square === to), `${label}: quiet destination`);
      assert.ok(geometry(pieces, piece, to), `${label}: independent path/geometry`);
      if (piece.id === 'black-queen-d8') {
        const [x,y] = xy(from), [u,v] = xy(to);
        assert.ok(Math.max(Math.abs(x-u), Math.abs(y-v)) <= 2, label);
      }
      if (n === 76) assert.notEqual(`${piece.id}:${from}:${to}`, 'black-king-e8:c7:d7');
      const [,y] = xy(from), [,v] = xy(to);
      ep = piece.role === 'pawn' && Math.abs(v-y) === 2
        ? [{target: `${from[0]}${(y+v)/2+1}` as SquareName, pawnId: piece.id}] : [];
      piece.square = to as SquareName;
      half = piece.role === 'pawn' ? 0 : half + 1;
      if (turn.color === 'black') full++;
      active = turn.color === 'white' ? 'black' : 'white';
      turn.phase = 'afterMove'; turn.moveMade = true;
      if (n === 22) effects.pop(); // Panic is consumed by White's timely move.
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label);
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false,
        cardPlays: {white: 0, black: 0} };
      if (n === 130) effects.pop();
    } else if (action.type === 'namePiece') {
      assert.equal(action.speaker, turn.color, label);
      assert.deepEqual(action.losses, [], label);
      assert.ok(n > 48, label); // Doomsayer is active but Truce prevents its captures.
    } else if (action.type === 'declineDoomsayer') {
      assert.equal(n, 49); assert.equal(action.player, 'black');
    } else {
      assert.equal(action.type, 'playCard', label);
      if (action.type !== 'playCard') throw new Error(label);
      assert.deepEqual([action.cardId,action.target],cardDeclarations[n],`${label}: exact declared effect and target`);
      const owner: Color = n === 2 ? 'black' : n === 75 ? 'white' : turn.color;
      const player = players[owner], card = player.hand.find(c => c.id === action.cardInstanceId);
      assert.ok(card, label); assert.equal(card.cardId, action.cardId, label);
      assert.equal(turn.cardPlays[owner], 0, label);
      if ([60,71,84].includes(n)) assert.equal(turn.phase, 'beforeMove', label);
      else assert.equal(turn.phase, 'afterMove', label);
      player.hand.splice(player.hand.indexOf(card), 1);
      const next = player.deck.shift(); assert.ok(next); player.hand.push(next);
      turn.cardPlays[owner]++;
      if (![5,13,48,84].includes(n)) player.discard.push(card);
      if (n === 5) effects.push({type:'truce', owner, card});
      else if (n === 8) { const a=at('g1'), b=at('a1'); a.square='a1'; b.square='g1'; }
      else if (n === 13) effects.push({type:'curse', owner, card, pieceId:'black-queen-d8'});
      else if (n === 20) effects.push({type:'panic', owner, player:'white', durationMs:15000});
      else if (n === 37) { const a=at('h6'), b=at('f8'); a.square='f8'; b.square='h6'; }
      else if (n === 48) effects.push({type:'doomsayer', owner, card});
      else if (n === 60 || n === 71) {
        const from = n === 60 ? 'b2' : 'c5', to = n === 60 ? 'a1' : 'b1';
        const piece=at(from); assert.ok(!pieces.some(p=>p.square===to));
        const [x,y]=xy(from), [u,v]=xy(to);
        if (n === 60) assert.equal(Math.abs(x-u), Math.abs(y-v));
        else { assert.equal(piece.role,'knight'); assert.notEqual((x+y)%2,(u+v)%2); }
        assert.deepEqual(action.target,[{from,to}],label);
        piece.square=to; half = n === 60 ? 0 : half+1; active='black'; ep=[];
        turn.phase='afterMove'; turn.moveMade=true;
      } else if (n === 75) {
        assert.equal(at('d7').id,'black-king-e8'); at('d7').square='c7';
        half=4; full=15; active='black'; ep=[]; turn.phase='beforeMove'; turn.moveMade=false;
      } else if (n === 84) effects.push({type:'pacifism',owner,card,pieceId:'black-bishop-c8'});
      else if (n === 104) {
        const corners: Record<string, SquareName> = {a1:'h1',h1:'h8',h8:'a8',a8:'a1'};
        for (const piece of pieces) if (piece.square && corners[piece.square]) piece.square=corners[piece.square]!;
        assert.equal(at('h1').id,'white-pawn-b2'); assert.equal(at('h1').promoted,false);
      } else if (n === 126) effects.push({type:'mystic-shield',owner,player:owner,pieceId:'black-bishop-f8'});
      else assert.equal(n,2,label);
    }
    const input=JSON.stringify(state);
    const result=applyAction(state,action); assert.ok(result.ok,label);
    assert.equal(JSON.stringify(state),input,`${label}: input immutability`);
    state=result.state;
    assert.deepEqual(state.pieces,pieces,`${label}: exact physical identity, zones and absent capturedBy`);
    assert.deepEqual(state.players,players,`${label}: exact physical hand/deck/discard accounting`);
    assert.deepEqual(state.effects,effects,`${label}: complete retained effects`);
    assert.deepEqual(state.turn,turn,label);
    const rights=n<8?'KQkq':n<36?'KAkq':n<54?'KA':n<104?'K':'-';
    const rawEp=n===32||n===33?'d6':'-';
    assert.equal(state.fen,`${boardFen(pieces)} ${active==='white'?'w':'b'} ${rights} ${rawEp} ${half} ${full}`,`${label}: all six FEN fields`);
    assert.deepEqual(state.enPassant,ep,label);
    for (const opportunity of ep) {
      const victim=pieces.find(p=>p.id===opportunity.pawnId)!;
      const candidates=pieces.filter(p=>p.role==='pawn'&&p.owner!==victim.owner&&p.square
        && geometry(pieces,p,opportunity.target,true));
      if (n<5) assert.equal(candidates.length,0,`${label}: initial double pushes have no adjacent captor`);
      else assert.ok(effects.some(e=>(e as {type:string}).type==='truce'),`${label}: every later EP capture is Truce-barred`);
      const prospective=structuredClone(state);
      prospective.turn={color:victim.owner==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      for (const candidate of candidates) assert.ok(!legalDests(prospective).get(candidate.square!)?.includes(opportunity.target),
        `${label}: prospective capturing player's legal destinations respect Truce`);
    }
    // Truce suppresses every capture after row5, including d6 EP although its raw FEN survives.
    if (n===32||n===33) {
      assert.equal(at('e5').id,'white-pawn-e2'); assert.equal(at('d5').id,'black-pawn-d7');
      assert.ok(!pieces.some(p=>p.square==='d6'));
      assert.ok(geometry(pieces,at('e5'),'d6',true),'e5 Pawn geometrically reaches the EP destination');
      assert.deepEqual(ep,[{target:'d6',pawnId:'black-pawn-d7'}]);
      assert.ok(effects.some(e=>(e as {type:string}).type==='truce'),'Truce prevents otherwise valid EP capture');
    }
    for (const color of ['white','black'] as const) {
      const king=pieces.find(p=>p.royal&&p.owner===color)!;
      const rawThreat=pieces.some(p=>p.owner!==color && p.square && geometry(pieces,p,king.square!,true)
        && !(n>=84 && p.id==='black-bishop-c8')
        && !(n>=13 && p.id==='black-queen-d8' && Math.max(...xy(p.square).map((v,i)=>Math.abs(v-xy(king.square!)[i]!)))>2));
      assert.equal(rawThreat,false,`${label}: no geometric royal threat ending Truce`);
      const independentlyChecked=n>=5 ? false : rawThreat;
      assert.equal(independentlyChecked,false,label);
      assert.equal(isKingInCheck(state,color),independentlyChecked,`${label}: ${color} royal threat`);
    }
    assert.equal(state.orientation,0,label); assert.equal(state.outcome,null,label);
    assert.equal(state.pendingRescue??null,null,label); assert.equal(state.pendingAbduction??null,null,label);
    assert.deepEqual(state.underElfHill??[],[],label);
    assert.deepEqual(state.pendingDoomsayer??null,n===48?{player:'black',cardInstanceId:'white-hand-4-doomsayer'}:null,label);
    assert.deepEqual(state.chaosForbidden??null,n===75?{player:'black',movement:'black-king-e8:c7:d7'}:null,label);
    assert.equal(state.plotsExecution,undefined,label);
    assert.deepEqual(state.plotsAllowances??[],n===2?[{player:'black',remaining:2,eligibleCards:[],window:{
      phase:'afterMove',moveMade:true,capture:undefined,cardResponse:undefined,fogCheckpoint:undefined,legacyCapture:undefined,
      shieldMove:{player:'white',pieceIds:['white-pawn-a2'],capturedOpponent:false},
      reaction:{type:'move',from:'a2',to:'a4'}}}]:[],label);
    assert.deepEqual(state.fogLocked??[],[],label); assert.deepEqual(state.riposteLostMoves??[],[],label);
    assert.equal(state.riposteSkipped,undefined,label); assert.equal(state.riposteCheckDeferred,undefined,label);
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,13);
  assert.equal(state.fen,'rnb3R1/1k2ppbp/1nq5/p2pP2Q/P1p2PpP/1pPB2P1/1B1P1KR1/rN2N2P b - - 11 26');
});

test('iteration 145 deterministic trace replays', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/145.json', import.meta.url), 'utf8'));
  assert.ok(replayTrace(trace));
});
