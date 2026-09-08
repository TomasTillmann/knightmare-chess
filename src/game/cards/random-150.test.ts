import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, PieceState, SquareName, GameState } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/150.json', import.meta.url), 'utf8')) as RandomTrace;

// Independently reviewed in order against rules §§8–15,18.2,19.3,20 and artwork metadata.
// A Prince is no longer the royal King (§15.3), so §15.4 permits the merger at 61.
const rationales = `
1. e2-e4 advances two through empty e3; no Black pawn can capture e3.
2. White closes its completed move; Black receives fresh allowances.
3. b7-b5 advances two through b6; no White pawn can capture b6.
4. Black closes; the fullmove already advanced to 2.
5. h2-h4 advances through empty h3, with no adjacent opposing pawn.
6. White closes and retains the uncapturable h3 opportunity record.
7. d7-d6 is an empty forward step and expires h3.
8. Black closes after d6; both royals are safe.
9. d2-d4 advances through d3; no Black pawn can capture d3.
10. White closes without spending a card.
11. f7-f5 advances through f6; no White pawn is on e5 or g5.
12. Black closes; f6 remains an opportunity but is unavailable.
13. Bishop f1-d3 follows the now-empty e2 diagonal.
14. White closes after the Bishop move.
15. d6-d5 advances one square without capture.
16. Black closes; the Pawn move reset the clock.
17. f2-f4 crosses empty f3; no Black pawn is on e4 or g4.
18. White closes; the f3 record survives without legal EP capture.
19. g7-g5 crosses empty g6; White f4/h4 are too far back for EP.
20. Black closes; both royal identities remain safe.
21. Queen d1-g4 follows empty e2,f3 diagonally.
22. White closes its quiet Queen move.
23. a7-a5 crosses empty a6; no White pawn is on b5.
24. Black closes and keeps its unspent card allowance reset for next turn.
25. a2-a3 is an empty forward Pawn step.
26. White closes; no card-zone changes occur.
27. Bishop f8-h6 passes empty g7.
28. Black closes the quiet Bishop move.
29. King e1-d1 moves to a safe adjacent square; White loses both castling rights.
30. White closes with only Black castling rights remaining.
31. King e8-f8 moves to a safe adjacent square; Black loses both rights.
32. Black closes; castling rights are now permanently absent.
33. b2-b3 advances one square without capture.
34. Coup after the move marks Pawn a3 royal and makes d1 a capturable Prince; draw Haunting Memories and retain Coup.
35. White closes; the royal identity is now white-pawn-a2.
36. c7-c6 advances one square and does not attack the royal a3 Pawn.
37. Siege swaps Black Knight b8 and Rook h8 without geometry; spend Siege and draw Evil Eye.
38. Black closes the completed move and swap.
39. Bishop c1-e3 passes empty d2.
40. White closes with the royal Pawn still safe on a3.
41. b5-b4 is legal and checks the new royal Pawn a3 diagonally.
42. Black closes while giving check; White must answer on its turn.
43. Queen g4-e2 follows empty f3 but does not cure b4-a3 check; stage a rescue with the exact pre-move position.
44. Doomsayer opens Black's naming choice; removing b4 could rescue, so retain the pending Queen move and draw Man of Straw.
45. Black names Pawn h7, which cannot cure b4-a3; fizzle Doomsayer, restore h7 and Queen g4, restore clocks and move availability, keep card spent.
46. Royal Pawn a3-a4 escapes the b4 Pawn attack with a normal forward step.
47. White closes its safe replacement move; its Doomsayer allowance was already consumed.
48. Rook a8-a6 passes empty a7; a5 blocks its file toward a4.
49. Black plays Doomsayer after the Rook move; draw Masquerade and open White's naming choice.
50. White names Bishop f1 currently d3; capture it for Black, reset clock, discard the resolved Doomsayer without another draw.
51. Black closes after the resolved naming choice.
52. Knight g1-f3 is an empty L jump.
53. White closes with neither royal threatened.
54. Rook b8-a8 moves one empty file step.
55. Black closes its quiet Rook move.
56. Queen g4-h3 is an empty diagonal step.
57. Holy War swaps White Knight f3 and Bishop e3; spend and draw Confabulation.
58. White closes after the swap; physical identities stay attached.
59. Queen d8-b6 passes empty c7.
60. Black closes the quiet Queen move.
61. Confabulation uses the Prince's King step d1-c2 to merge with the friendly Pawn; a4 remains royal, c2 gains both movements and cannot promote; draw Charge.
62. White closes the replacement move; the Prince component stays away inside the composite.
63. g5xf4 is a forward diagonal Pawn capture; White f2 Pawn enters captured with Black captor.
64. Black closes after the capture and clock reset.
65. Rook h1-d1 travels through empty g1,f1,e1.
66. White closes the quiet Rook move.
67. Queen b6-d8 passes empty c7.
68. Black closes with a1,a8,h8 occupied and h1 empty.
69. Squaring the Circle relocates Bishop f3 to the sole empty fixed corner h1; consume move and draw Doppelganger.
70. White closes its replacement move.
71. Bishop c8-b7 is an empty diagonal step.
72. Black closes the quiet Bishop move.
73. Irresistible Force pushes Black Pawn d5 to empty d6 while White d4 enters d5; no capture or promotion; draw Treason.
74. White closes its replacement Pawn move.
75. Rook a8-b8 is an empty horizontal step.
76. Black closes after the Rook move.
77. Knight b1-c3 is an empty L jump.
78. White closes; no royal is checked.
79. Long Jump sends Black Knight g8 to empty opposite-color e5; consume move and draw Knightmare.
80. Black closes after the replacement jump.
81. d5xc6 captures Black c7 Pawn with a forward diagonal Pawn move; White is captor.
82. White closes after its capture.
83. Bishop b7xc6 captures the White d2 Pawn and checks royal a4 along empty b5; Black is captor.
84. Black closes while checking White royal a4 along c6-b5-a4.
85. Knight c3-b5 is a legal L jump and screens the c6 Bishop's diagonal to royal a4.
86. White closes its safe Knight move.
87. Knight e5-d3 is an empty L jump.
88. Black closes with Bishop c6 still screened by White Knight b5.
89. Knight b5-d4 exposes c6-b5-a4; stage this quiet first jump for an after-move Charge rescue.
90. Charge moves the same Knight d4xc6, capturing the checking Bishop; second jump may capture, clocks reset, draw Challenge.
91. White closes after the successful Charge rescue.
92. Knight d3-c1 is an empty L jump.
93. Black closes after its quiet Knight move.
94. Knight e3-d5 is an empty L jump.
95. Treason swaps Black Rook a6 and Knight h8, preserving identities and clocks; draw Winged Victory.
96. White closes its completed move and swap.
97. Bishop h6-g7 moves diagonally to an empty square.
98. Black closes after the Bishop move.
99. Composite c2-d2 uses its Prince component's sideways King step; the Pawn body resets the clock and remains nonroyal.
100. Challenge names movable Black Knight a6; forbid other Black movers on its next move and draw Assassin.
101. White closes; Black must use the challenged Knight.
102. Knight a6-c5 satisfies Challenge, expiring it, and checks royal Pawn a4 by an L attack.
103. Black closes while checking White royal a4.
104. Knight c6-a7 does not cure c5-a4; stage a rescue with exact pre-move state.
105. Haunting Memories copies the last card Challenge and names movable Rook b8; the c5 Knight cannot capture under this restriction, curing check; draw Holy Quest.
106. White closes; the raw c5 attack is suppressed by the b8 Challenge.
107. Rook b8-b6 passes empty b7 and satisfies Challenge; expiry restores the c5 Knight's check on a4.
108. Black closes while checking the royal Pawn.
109. Queen h3-c3 crosses g3,f3,e3,d3 but leaves c5-a4 check; stage rescue.
110. Holy Quest swaps Black Bishop g7 and Knight c5; the resulting Bishop c5 does not attack a4, curing check; draw Fanatic.
111. White closes after its swap rescue.
112. Knight c1-a2 is an empty L jump.
113. Black closes after its quiet Knight move.
114. Knight d5-c7 is an empty L jump.
115. White closes without spending a card.
116. e7-e5 crosses empty e6; no White Pawn is on d5 or f5 to capture EP.
117. Black closes; e6 opportunity record survives but legal EP remains unavailable.
118. Knight c7-a8 is an empty L jump and expires e6.
119. White closes move command 50; Black receives a safe turn at fullmove 27.
`.trim().split('\n');

const cardRows: Record<number, [string, unknown]> = {
  34: ['coup', 'a3'], 37: ['siege', { knight: 'b8', rook: 'h8' }],
  44: ['doomsayer', undefined], 49: ['doomsayer', undefined],
  57: ['holy-war', { knight: 'f3', bishop: 'e3' }],
  61: ['confabulation', [{ from: 'd1', to: 'c2' }]],
  69: ['squaring-the-circle', [{ from: 'f3', to: 'h1' }]],
  73: ['irresistible-force', [{ from: 'd4', to: 'd5' }]],
  79: ['long-jump', [{ from: 'g8', to: 'e5' }]],
  90: ['charge', [{ from: 'd4', to: 'c6' }]],
  95: ['treason', { rook: 'a6', knight: 'h8' }], 100: ['challenge', 'a6'],
  105: ['haunting-memories', 'b8'], 110: ['holy-quest', { bishop: 'g7', knight: 'c5' }],
};

const xy = (s: string): [number, number] => [s.charCodeAt(0) - 97, Number(s[1]) - 1];
const square = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';
const at = (ps: PieceState[], s: string) => ps.find(p => p.zone === 'board' && p.square === s);
const body = (p: PieceState) => { const { capturedAtPly: _ply, ...rest } = p; return rest; };

// This oracle uses physical identities, plain coordinate geometry, and the two
// movement-affecting variants actually present: Confabulation and Challenge.
function geometry(ps: PieceState[], p: PieceState, to: string, capture: boolean, composite: boolean): boolean {
  assert.ok(p.square);
  const [x,y] = xy(p.square), [u,v] = xy(to), dx = u-x, dy = v-y;
  if (!dx && !dy) return false;
  if (composite && p.id === 'white-pawn-c2' && Math.max(Math.abs(dx), Math.abs(dy)) === 1) return true;
  if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const forward = p.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === forward;
    return dx === 0 && (dy === forward || dy === 2*forward
      && (p.owner === 'white' ? y <= 1 : y >= 6) && !at(ps,square(x,y+forward)));
  }
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
  if (!(p.role === 'bishop' ? diagonal : p.role === 'rook' ? straight : diagonal || straight)) return false;
  for (let n=1; n<Math.max(Math.abs(dx),Math.abs(dy)); n++) {
    if (at(ps,square(x+n*Math.sign(dx),y+n*Math.sign(dy)))) return false;
  }
  return true;
}

function threatened(ps: PieceState[], color: Color, composite: boolean, challenged?: string): boolean {
  const king = ps.find(p => p.royal && p.owner === color && p.zone === 'board');
  assert.ok(king?.square);
  return ps.some(p => p.zone === 'board' && p.owner !== color
    && !(challenged && p.owner === 'black' && p.id !== challenged)
    && geometry(ps,p,king.square!,true,composite));
}

function boardFen(ps: PieceState[]): string {
  const symbols = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
  return Array.from({length:8},(_,r) => {
    let row='', empty=0;
    for(let f=0;f<8;f++) {
      const p=at(ps,square(f,7-r));
      if(!p) { empty++; continue; }
      if(empty) { row+=empty; empty=0; }
      const symbol=symbols[p.role]; row+=p.owner==='white'?symbol.toUpperCase():symbol;
    }
    return row+(empty||'');
  }).join('/');
}

test('iteration 150: 119 independently reasoned actions including 50 move commands', () => {
  assert.equal(trace.seed,860150);
  assert.equal(trace.steps.length,119);
  assert.equal(rationales.length,trace.steps.length);
  assert.equal(Object.keys(cardRows).length,14);
  let state=createGameState(trace.initial);
  let pieces=structuredClone(state.pieces), players=structuredClone(state.players);
  let turn=structuredClone(state.turn), ep: GameState['enPassant']=[];
  let half=0, full=1, rights='KQkq', active: Color='white', composite=false;
  let effects: unknown[]=[], challenged: string|undefined;
  let pending: { before: GameState; pieces: PieceState[]; half: number; full: number; rights: string; ep: GameState['enPassant']; history: number; mover: string }|undefined;
  let history=0, moves=0;
  const advance=(pawnOrCapture: boolean) => {
    half=pawnOrCapture?0:half+1; if(turn.color==='black') full++;
    active=other(turn.color); turn.phase='afterMove'; turn.moveMade=true; ep=[];
  };
  const relocate=(from:string,to:string) => { const p=at(pieces,from); assert.ok(p); p.square=to as SquareName; };
  const swap=(a:string,b:string) => { const p=at(pieces,a),q=at(pieces,b); assert.ok(p&&q); [p.square,q.square]=[q.square,p.square]; };
  const capture=(p:PieceState, captor:Color) => { assert.equal(p.royal,false); p.square=null; p.zone='captured'; p.capturedBy=captor; };
  for(const [i,step] of trace.steps.entries()) {
    const n=i+1, action=step.action, label=rationales[i]!;
    assert.ok(label.startsWith(`${n}. `));
    const before=structuredClone(state), immutable=structuredClone(state);
    const priorPieces=structuredClone(pieces), priorHalf=half, priorFull=full, priorRights=rights, priorEP=structuredClone(ep);
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from, to=action.to;
      assert.match(from,/^[a-h][1-8]$/); assert.match(to,/^[a-h][1-8]$/);
      const p=at(pieces,from), victim=at(pieces,to); assert.ok(p);
      assert.equal(p.owner,turn.color,label); assert.equal(turn.moveMade,false,label);
      assert.ok(!victim || victim.owner!==p.owner,label);
      assert.ok(geometry(pieces,p,to,!!victim,composite),label);
      if(challenged) assert.equal(p.id,challenged,label);
      if(victim) capture(victim,turn.color);
      p.square=to as SquareName;
      if(p.role==='king') rights=rights.replace(p.owner==='white'?/[KQ]/g:/[kq]/g,'');
      advance(p.role==='pawn'||!!victim);
      const [x,y]=xy(from),[,v]=xy(to);
      if(p.role==='pawn'&&Math.abs(v-y)===2) ep=[{target:square(x,(y+v)/2),pawnId:p.id}];
      if(challenged) { effects=effects.filter(e=>(e as {type:string}).type!=='challenge'); challenged=undefined; }
      if([43,89,104,109].includes(n)) pending={before,pieces:priorPieces,half:priorHalf,full:priorFull,rights:priorRights,ep:priorEP,history,mover:p.id};
      moves++; history++;
    } else if(action.type==='endTurn') {
      assert.equal(turn.moveMade,true,label); assert.equal(pending,undefined,label);
      assert.equal(threatened(pieces,turn.color,composite,challenged),false,label);
      turn={color:other(turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    } else if(action.type==='playCard') {
      assert.deepEqual([action.cardId,action.target],cardRows[n],label);
      const hand=players[turn.color].hand, index=hand.findIndex(c=>c.id===action.cardInstanceId);
      assert.ok(index>=0,label); const card=hand[index]!;
      assert.equal(card.cardId,action.cardId,label);
      assert.equal(turn.cardPlays[turn.color],0,label);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(turn.phase),label);
      hand.splice(index,1); const draw=players[turn.color].deck.shift(); assert.ok(draw); hand.push(draw);
      turn.cardPlays[turn.color]++;
      if(!CARD_CATALOG[card.cardId]!.continuing) players[turn.color].discard.push(card);
      if(n===34) {
        at(pieces,'d1')!.royal=false; at(pieces,'a3')!.royal=true;
        effects.push({type:'coup',owner:'white',card,princeId:'white-king-e1',kingId:'white-pawn-a2',princeRole:'king'});
      } else if(n===37) swap('b8','h8');
      else if(n===44||n===49) effects.push({type:'doomsayer',owner:turn.color,card});
      else if(n===57) swap('f3','e3');
      else if(n===61) {
        const prince=at(pieces,'d1')!, pawn=at(pieces,'c2')!;
        assert.equal(prince.royal,false); assert.equal(pawn.royal,false);
        assert.ok(geometry(pieces,prince,'c2',false,false));
        prince.square=null; prince.zone='away'; composite=true;
        effects.push({type:'confabulation',owner:'white',card,pieceIds:['white-pawn-c2','white-king-e1']});
        advance(false);
      } else if(n===69) {
        assert.deepEqual(['a1','a8','h1','h8'].filter(s=>!at(pieces,s)),['h1']);
        relocate('f3','h1'); advance(false);
      } else if(n===73) {
        assert.equal(at(pieces,'d6'),undefined); assert.equal(at(pieces,'d5')!.royal,false);
        relocate('d5','d6'); relocate('d4','d5'); advance(true);
      } else if(n===79) {
        assert.equal(at(pieces,'e5'),undefined); assert.notEqual((6+7)%2,(4+4)%2);
        relocate('g8','e5'); advance(false);
      } else if(n===90) {
        assert.equal(pending?.mover,'white-knight-b1'); assert.ok(geometry(pieces,at(pieces,'d4')!,'c6',true,composite));
        capture(at(pieces,'c6')!,'white'); relocate('d4','c6'); half=0; ep=[]; pending=undefined;
      } else if(n===95) swap('a6','h8');
      else if(n===100||n===105) {
        const target=n===100?'a6':'b8', p=at(pieces,target)!;
        assert.equal(p.owner,'black'); assert.equal(p.royal,false);
        assert.ok(geometry(pieces,p,n===100?'c5':'b6',false,composite));
        challenged=p.id; effects.push({type:'challenge',owner:'white',player:'black',pieceId:p.id});
        if(n===105) { assert.equal(CARD_CATALOG.challenge!.unique,false); pending=undefined; }
      } else if(n===110) { swap('g7','c5'); pending=undefined; }
      else assert.fail(`unreviewed card ${n}`);
      history++;
    } else if(action.type==='namePiece') {
      assert.deepEqual(action,n===45
        ? {type:'namePiece',speaker:'black',name:'pawn',losses:[{effectId:'white-hand-2-doomsayer',pieceId:'black-pawn-h7'}]}
        : {type:'namePiece',speaker:'white',name:'bishop',losses:[{effectId:'black-hand-3-doomsayer',pieceId:'white-bishop-f1'}]});
      const owner=n===45?'white':'black', effect=effects.pop() as {card:{id:string;cardId:string}};
      players[owner].discard.push(effect.card);
      if(n===45) {
        assert.ok(pending); pieces=structuredClone(pending.pieces); half=pending.half; full=pending.full;
        rights=pending.rights; ep=structuredClone(pending.ep); history=pending.history+1;
        active='white'; turn.phase='beforeMove'; turn.moveMade=false; pending=undefined;
      } else { capture(at(pieces,'d3')!,'black'); half=0; history++; }
    } else assert.fail(`unreviewed action ${n}`);

    const result=applyAction(state,action);
    assert.deepEqual(state,immutable,`${label}: input immutable`);
    assert.ok(result.ok,label); state=result.state;
    assert.deepEqual(state.pieces.map(body),pieces.map(body),`${label}: independent physical identities/captors`);
    assert.deepEqual(state.players,players,`${label}: exact physical card zones and draw order`);
    assert.deepEqual(state.effects,effects,`${label}: exact effects`);
    assert.deepEqual(state.turn,turn,`${label}: turn/card allowances`);
    assert.equal(state.orientation,0,label); assert.equal(state.outcome,null,label);
    assert.equal(state.history.length,history,`${label}: independent history position`);
    assert.deepEqual(state.enPassant,ep,label);
    // Every double move in this trace has zero prospective EP capturers; the
    // independent calculation below also verifies that fact after endTurn.
    for(const chance of ep) {
      const victim=pieces.find(p=>p.id===chance.pawnId)!;
      assert.equal(pieces.filter(p=>p.owner!==victim.owner&&p.role==='pawn'&&p.zone==='board'
        && geometry(pieces,p,chance.target,true,composite)).length,0,label);
      const prospective={...state,turn:{...state.turn,color:other(victim.owner),phase:'beforeMove' as const,moveMade:false}};
      const destinations=legalDests(prospective);
      for(const p of pieces.filter(p=>p.owner!==victim.owner&&p.role==='pawn'&&p.zone==='board')) {
        assert.equal(destinations.get(p.square!)?.includes(chance.target)??false,false,label);
      }
    }
    assert.equal(state.fen,`${boardFen(pieces)} ${active==='white'?'w':'b'} ${rights||'-'} - ${half} ${full}`,`${label}: all six FEN fields`);
    for(const color of ['white','black'] as const) {
      const threat=threatened(pieces,color,composite,challenged);
      assert.equal(isKingInCheck(state,color),threat,`${label}: independently computed ${color} royal threat`);
      assert.equal(threat,color==='white'&&[41,42,43,44,45,83,84,89,102,103,104,107,108,109].includes(n),`${label}: reviewed royal threat`);
    }
    if(n===105||n===106) assert.equal(threatened(pieces,'white',composite),true,'raw Knight attack suppressed by Challenge');
    if(pending) {
      assert.ok(state.pendingRescue,label);
      assert.equal(state.pendingRescue.fen,pending.before.fen,label);
      assert.deepEqual(state.pendingRescue.pieces.map(body),pending.pieces.map(body),label);
      assert.deepEqual(state.pendingRescue.enPassant,pending.ep,label);
      assert.equal(state.pendingRescue.historyLength,pending.history,label);
      assert.deepEqual(state.pendingRescue.movedPieceIds,[pending.mover],label);
      assert.deepEqual(state.pendingRescue.before,pending.before,label);
      if(state.pendingRescue.history) assert.deepEqual(state.pendingRescue.history,pending.before.history,label);
    } else assert.equal(state.pendingRescue??null,null,label);
    assert.deepEqual(state.pendingDoomsayer??null,n===44?{player:'black',cardInstanceId:'white-hand-2-doomsayer'}:n===49?{player:'white',cardInstanceId:'black-hand-3-doomsayer'}:null,label);
    assert.equal(state.pendingAbduction??null,null,label);
    assert.deepEqual(state.underElfHill??[],[],label);
    assert.equal(state.chaosForbidden,undefined,label);
    assert.equal(state.plotsExecution,undefined,label);
    assert.deepEqual(state.plotsAllowances??[],[],label);
    assert.deepEqual(state.fogLocked??[],[],label);
    assert.deepEqual(state.riposteLostMoves??[],[],label);
    assert.equal(state.riposteSkipped,undefined,label);
    assert.equal(state.riposteCheckDeferred,undefined,label);
  }
  assert.equal(moves,50);
  assert.equal(state.fen,'N2q1k1r/N5np/1r1p4/p1b1pp2/Pp2Pp1P/1PQ5/n2P2P1/R2R3B b - - 1 27');
  assert.equal(replayTrace(trace).fen,state.fen);
});
