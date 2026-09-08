import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Reviewed against rules §§8–11,13,14.4,16.3,18.3,20,22 and the printed
// KC18/3,13/4,17/3,12/2,11/3,7/1,6/4,13/3,5/3,17/4,3/4,2/4 artwork.
const rationale = `
1. e2-e3 is one forward pawn step to empty e3; both Kings safe.
2. White completes e3; Black receives the move, unchanged board and clocks.
3. Nb8-a6 is a legal 1-by-2 jump to an empty square.
4. Black completes Na6; White receives the move.
5. Bf1-d3 passes through vacated e2 on a clear diagonal.
6. White completes Bd3; Black receives the move.
7. f7-f5 crosses empty f6; records f6 opportunity but no White pawn can capture it.
8. Black completes f5; its en-passant opportunity remains until White moves.
9. Ke1-f1 steps to the empty safe square and forfeits both White castling rights.
10. White completes Kf1; Black receives the move.
11. h7-h6 is one forward step; old en-passant expires.
12. Black completes h6; White receives the move.
13. Kf1-e2 is one diagonal King step to a safe square.
14. White completes Ke2; Black receives the move.
15. b7-b5 crosses empty b6; records b6 but no White pawn can capture.
16. Black completes b5; preserve its opportunity until White moves.
17. e3-e4 advances one square, expiring b6.
18. White completes e4; Black receives the move.
19. f5xe4 captures White's e-pawn diagonally; Black is its captor.
20. Black completes fxe4; no card or piece changes.
21. Nb1-c3 is a 1-by-2 jump to empty c3.
22. White completes Nc3; Black receives the move.
23. Ke8-f7 is a safe diagonal King step and removes Black castling rights.
24. Black completes Kf7; no castling rights remain.
25. f2-f4 crosses empty f3; Black e4xf3 en passant is presently possible.
26. Mystic Shield protects just-moved f-pawn; discard/draw once, raw f3 stays but protected capture is unavailable next turn.
27. White ends; Shield remains active during Black's turn.
28. Na6-b8 jumps back; Black declines en passant and the opportunity expires.
29. Black ends; Shield expires at the end of the protected turn.
30. Ng1-h3 is a legal Knight jump.
31. Fortification places the adjacent e7/f6 wall after the move; retain physical card and draw Hostage.
32. White ends; the wall persists without changing pieces or clocks.
33. Nb8-c6 jumps legally, unaffected by the remote wall.
34. Black ends; no other state changes.
35. Nc3xe4 jumps onto and captures Black's former f-pawn; White is captor.
36. White ends; Black receives the move.
37. Nc6-b4 is a legal Knight jump to an empty square.
38. Black ends; White receives the move.
39. Evil Eye uses Bd3's clear c4-b5 ray to capture b5 without moving the Bishop; consumes the move and draws Passing.
40. White ends the replacement move; Black receives its turn.
41. e7-e6 advances one square without crossing the e7/f6 diagonal wall.
42. Black ends; White receives its turn.
43. Passing swaps c2/e6 and g2/d7 simultaneously; no captures, pawn clock reset; e6 checks f7, which can capture e6.
44. White ends the replacement move; Black starts checked by e6.
45. Kf7xe6 captures that checking White pawn on a safe square.
46. Black ends after escaping check; White receives its turn.
47. Ke2-e3 is a safe vertical King step.
48. White ends; Black receives its turn.
49. Ng8-e7 is an unobstructed Knight jump, allowed over walls.
50. Black ends; White receives its turn.
51. Ne4-d6 is a legal Knight jump to empty d6.
52. White ends; Black receives its turn.
53. Haunting Memories copies last-card Passing: g2/a2 and g7/b2 exchange four Pawns; Black replacement move advances fullmove.
54. Black ends; White receives its turn after the simultaneous swaps.
55. Bd3-a6 crosses empty c4,b5 on its diagonal.
56. White ends; Black receives its turn.
57. Ne7-c6 jumps to empty c6.
58. Black ends; White receives its turn.
59. Nd6-e8 jumps to empty e8; no promotion is involved.
60. Crab marks White's original g-pawn at d7 after the move; retain card and draw Dark Mirror.
61. White ends; Crab's diagonal forward movement stays active.
62. Bf8xg7 captures White's original b-pawn diagonally; Black is captor.
63. Anathema swaps White Bc1/Rh1 without capture or movement geometry; clocks remain unchanged.
64. Black ends; White receives its turn.
65. Qd1-g1 slides through empty e1,f1.
66. White ends; Black receives its turn.
67. Black's original g-pawn advances b2-b1 and promotes to Queen; reset pawn clock.
68. Black ends; promotion and physical identity persist.
69. Ke3-f2 is a safe diagonal King step.
70. White ends; Black receives its turn.
71. Promoted Qb1-b2 moves one vertical square without capture.
72. Black ends; White receives its turn.
73. Nh3-g5 is a legal jump giving check on Ke6.
74. White ends; Black begins in Knight check.
75. Rh8xe8 crosses g8,f8 and captures Ne8; Ng5 still checks Ke6, so this is provisional with exact pre-move rescue state.
76. Dungeon moves the checking Ng5 to empty h8 and bans its next White-turn movement; Black's King is now safe.
77. Black ends; Dungeon's White-turn ban remains.
78. Rc1xc2 captures Black's former e-pawn; the restricted Knight stays on h8.
79. White ends; Dungeon's temporary movement ban expires.
80. Qb2-e5 slides through empty c3,d4 to empty e5.
81. Figure Dance cycles all four corner identities a1-h1-h8-a8-a1 simultaneously; no Pawn or capture, clocks unchanged.
82. Black ends; White receives its turn.
83. Rc2-b2 slides one horizontal square.
84. White ends; Black receives its turn.
85. Nb4xa6 captures White Bf1's physical identity; Black is captor.
86. Hostage immediately returns that Bishop to h2, capturing h2 Pawn instead with original captor Black; White spends its reaction only.
87. Black ends; White receives a fresh move and card allowance.
88. Rb2-c2 slides one horizontal square.
89. White ends; Black receives its turn.
90. Ke6-f6 enters a safe square across e6/f6, distinct from the e7/f6 wall.
91. Black ends; White receives its turn.
92. Rc2-c4 slides through empty c3.
93. White ends; Black receives its turn.
94. Re8-e7 steps vertically; it does not cross the e7/f6 wall.
95. Black ends; White receives its turn.
96. Rc4-a4 slides through empty b4.
97. White ends; Black receives its turn.
98. Ra1-b1 slides to the empty neighboring square.
99. Black ends; a1 is now the only vacant corner.
100. White's original a-pawn advances g2-g3 and resets the pawn clock.
101. White ends; Black receives its turn.
102. Squaring moves Bc8 to sole empty corner a1; a8,h8,h1 are occupied; replacement move advances Black's fullmove.
103. Black ends; White receives its turn.
104. f4xe5 captures Black's promoted g-pawn and checks Kf6 with the surviving White pawn.
105. White ends; Black begins in pawn check.
106. Qd8xa8 crosses empty c8,b8 and captures Na8, still leaving pawn e5 checking f6; held after-move Abduction can rescue by capturing e5 after a failed recall.
107. Heresy moves h8-h7,h2-g2 first and g7-g8 next; Ba1 has both color-changing exits occupied. Pawn e5 still checks, so Heresy fizzles and Qxa8 rolls back; Black keeps the spent card.
108. Nc6xe5 captures the checking White pawn, legally replacing the rolled-back move.
109. Black ends after escaping check; White receives its turn.
110. Kf2-e2 steps to a safe square; Ne5 does not attack e2.
111. White ends; Black receives its turn.
112. Ba1-d4 slides through empty b2,c3.
113. Black ends; White receives its turn.
114. Qg1xb1 crosses empty f1,e1,d1,c1 and captures Black's original a8 Rook.
115. White ends; Black receives move27, both Kings safe and all temporary obligations resolved.
`.trim().split('\n');

const square = (value: string): SquareName => { assert.match(value, /^[a-h][1-8]$/); return value as SquareName; };
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s);

// Independent physical geometry, including this trace's Fortification, Crab and Dungeon.
function reaches(pieces: PieceState[], p: PieceState, to: string, capture: boolean, step: number): boolean {
  assert.ok(p.square);
  const [x,y] = xy(p.square), [u,v] = xy(to), dx = u-x, dy = v-y;
  const ax = Math.abs(dx), ay = Math.abs(dy), dir = p.owner === 'white' ? 1 : -1;
  if (!ax && !ay) return false;
  if (step >= 76 && step < 79 && p.id === 'white-knight-g1') return false;
  if (p.role === 'knight') return ax * ay === 2;
  if (p.role === 'king' && Math.max(ax,ay) !== 1) return false;
  if (p.role === 'pawn') {
    const crab = step >= 60 && p.id === 'white-pawn-g2';
    if (capture || crab) { if (ax !== 1 || dy !== dir) return false; }
    else if (dx || !(dy === dir || dy === 2*dir && (p.owner === 'white' ? y <= 1 : y >= 6))) return false;
  }
  if (p.role === 'bishop' && ax !== ay) return false;
  if (p.role === 'rook' && dx && dy) return false;
  if (p.role === 'queen' && dx && dy && ax !== ay) return false;
  let previous: string = p.square;
  for (let i = 1; i <= Math.max(ax,ay); i++) {
    const next: string = String.fromCharCode(97+x+Math.sign(dx)*i) + (y+Math.sign(dy)*i+1);
    if (step >= 31 && [previous,next].sort().join('/') === 'e7/f6') return false;
    if (i < Math.max(ax,ay) && at(pieces,next)) return false;
    previous = next;
  }
  return true;
}

function checked(pieces: PieceState[], color: Color, step: number): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(king.square);
  assert.ok(pieces.every(p => !p.neutral), 'this trace has no neutral controller overrides');
  return pieces.some(p => p.owner !== color && p.zone === 'board' && reaches(pieces,p,king.square!,true,step));
}

function boardFen(pieces: PieceState[]): string {
  const symbols = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
  return Array.from({length:8}, (_,row) => {
    let line = '', empty = 0;
    for (let file=0; file<8; file++) {
      const p=at(pieces,String.fromCharCode(97+file)+(8-row));
      if (!p) { empty++; continue; }
      if (empty) line += empty;
      empty=0; const symbol=symbols[p.role]; line += p.owner === 'white' ? symbol.toUpperCase() : symbol;
    }
    return line+(empty || '');
  }).join('/');
}

test('iteration 142 replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/142.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace.steps.length > 0);
  replayTrace(trace);
});

test('iteration 142 independently reviewed physical, timing, capture and obligation oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/142.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.steps.length,115); assert.equal(rationale.length,115);
  let state=createGameState(trace.initial), pieces=structuredClone(state.pieces), players=structuredClone(state.players);
  let turn=structuredClone(state.turn), active='w', rights='KQkq', half=0, full=1, rawEp='-';
  let ep: GameState['enPassant']=[], historyLength=0;
  let checkpoint: {pieces:PieceState[]; fen:string; ep:GameState['enPassant']; historyLength:number; state:GameState} | undefined;
  const fen=() => `${boardFen(pieces)} ${active} ${rights || '-'} ${rawEp} ${half} ${full}`;
  const capture=(p:PieceState, captor:Color) => { p.square=null; p.zone='captured'; p.capturedBy=captor; };
  const move=(from:string,to:string) => { const p=at(pieces,from); assert.ok(p,from); p.square=square(to); };
  const swap=(a:string,b:string) => { const p=at(pieces,a),q=at(pieces,b); assert.ok(p&&q); p.square=square(b); q.square=square(a); };
  const complete=(pawnOrCapture:boolean) => { half=pawnOrCapture?0:half+1; if(turn.color==='black')full++; active=turn.color==='white'?'b':'w'; turn.phase='afterMove';turn.moveMade=true;ep=[];rawEp='-'; };
  const cards: Record<number,[Color,string]> = {26:['white','mystic-shield'],31:['white','fortification'],39:['white','evil-eye'],43:['white','passing-in-the-night'],53:['black','haunting-memories'],60:['white','crab'],63:['black','anathema'],76:['black','dungeon'],81:['black','figure-dance'],86:['white','hostage'],102:['black','squaring-the-circle'],107:['black','heresy']};
  for(const [index,{action}] of trace.steps.entries()) {
    const n=index+1, why=rationale[index]!;assert.ok(why.startsWith(`${n}. `));
    const input=structuredClone(state), beforeFen=fen(), beforePieces=structuredClone(pieces), beforeEp=structuredClone(ep), priorHistory=historyLength;
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to, p=at(pieces,from),victim=at(pieces,to);
      assert.ok(p,why); assert.equal(p.owner,turn.color,why);assert.equal(turn.moveMade,false,why);
      assert.ok(!victim || victim.owner!==p.owner && !victim.royal,why);
      assert.ok(reaches(pieces,p,to,!!victim,n-1),why);
      const pawn=p.role==='pawn', delta=Math.abs(xy(to)[1]-xy(from)[1]);
      if(p.royal) rights=rights.replace(p.owner==='white'?/[KQ]/g:/[kq]/g,'');
      if(victim)capture(victim,turn.color);p.square=square(to);
      if(action.promotion) { assert.equal(p.role,'pawn');assert.equal(to,'b1');assert.equal(action.promotion,'queen');p.role='queen';p.promoted=true; }
      complete(pawn||!!victim);
      if(pawn && delta===2) {const target=square(from[0]!+((Number(from[1])+Number(to[1]))/2));ep=[{target,pawnId:p.id}];if(n===25)rawEp=target;}
      historyLength++;
      if(n===75||n===106)checkpoint={pieces:beforePieces,fen:beforeFen,ep:beforeEp,historyLength:priorHistory,state:input};
    } else if(action.type==='endTurn') {
      assert.equal(turn.moveMade,true,why);assert.equal(checked(pieces,turn.color,n-1),false,why);
      turn={color:other(turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    } else {
      assert.equal(action.type,'playCard',why);if(action.type!=='playCard')throw Error(why);
      const [owner,id]=cards[n]!;assert.equal(action.cardId,id,why);assert.equal(turn.cardPlays[owner],0,why);
      assert.equal(turn.phase,[39,43,53,102].includes(n)?'beforeMove':'afterMove',why);
      const player=players[owner], i=player.hand.findIndex(c=>c.id===action.cardInstanceId);assert.ok(i>=0,why);
      const [card]=player.hand.splice(i,1);assert.ok(card);assert.equal(card.cardId,id);
      if(![31,60].includes(n))player.discard.push(card);
      const drawn=player.deck.shift();assert.ok(drawn);player.hand.push(drawn);turn.cardPlays[owner]++;historyLength++;
      switch(n) {
        case 26: assert.equal(action.target,'f4');break;
        case 31: assert.deepEqual(action.target,{from:'e7',to:'f6'});break;
        case 39: {
          assert.deepEqual(action.target,{attacker:'d3',victim:'b5'});const attacker=at(pieces,'d3')!,victim=at(pieces,'b5')!;
          assert.ok(reaches(pieces,attacker,'b5',true,n));const trial=structuredClone(pieces);capture(at(trial,'b5')!,'white');at(trial,'d3')!.square='b5';assert.equal(checked(trial,'white',n),false);
          capture(victim,'white');complete(true);break;
        }
        case 43: assert.deepEqual(action.target,[{from:'c2',to:'e6'},{from:'g2',to:'d7'}]);swap('c2','e6');swap('g2','d7');complete(true);break;
        case 53: assert.deepEqual(action.target,[{from:'g2',to:'a2'},{from:'g7',to:'b2'}]);swap('g2','a2');swap('g7','b2');complete(true);break;
        case 60: assert.equal(action.target,'d7');break;
        case 63: assert.deepEqual(action.target,{bishop:'c1',rook:'h1'});swap('c1','h1');break;
        case 76: assert.deepEqual(action.target,[{from:'g5',to:'h8'}]);assert.equal(at(pieces,'h8'),undefined);move('g5','h8');break;
        case 81: {
          assert.deepEqual(action.target,[]);const corners:Record<string,SquareName>={a1:'h1',h1:'h8',h8:'a8',a8:'a1'};
          for(const p of pieces)if(p.square&&corners[p.square])p.square=corners[p.square]!;break;
        }
        case 86: {
          assert.deepEqual(action.target,{pieceId:'white-bishop-f1',pawn:'h2'});const bishop=pieces.find(p=>p.id==='white-bishop-f1')!;
          assert.equal(bishop.zone,'captured');assert.equal(bishop.capturedBy,'black');capture(at(pieces,'h2')!,'black');bishop.zone='board';bishop.square='h2';delete bishop.capturedBy;half=0;break;
        }
        case 102: assert.deepEqual(action.target,[{from:'c8',to:'a1'}]);assert.deepEqual(['a1','a8','h1','h8'].filter(s=>!at(pieces,s)),['a1']);move('c8','a1');complete(false);break;
        case 107: {
          assert.deepEqual(action.target,[{from:'h8',to:'h7'},{from:'h2',to:'g2'},{from:'g7',to:'g8'}]);
          const trial=structuredClone(pieces);for(const [from,to] of [['h8','h7'],['h2','g2'],['g7','g8']]) {assert.equal(at(trial,to!),undefined);at(trial,from!)!.square=square(to!);}
          assert.ok(at(trial,'a2')&&at(trial,'b1'),'Ba1 cannot change square color');assert.equal(checked(trial,'black',n),true,'Heresy does not remove the checking pawn');
          assert.ok(checkpoint);pieces=structuredClone(checkpoint.pieces);ep=structuredClone(checkpoint.ep);[active,rights,rawEp]=checkpoint.fen.split(' ').slice(1,4) as [string,string,string];half=0;full=25;turn.phase='beforeMove';turn.moveMade=false;historyLength=checkpoint.historyLength+1;break;
        }
        default:throw Error(why);
      }
    }
    const result=applyAction(state,action);assert.deepEqual(state,input,`${why}: input immutability`);assert.ok(result.ok,why);state=result.state;
    assert.deepEqual(state.pieces,pieces,`${why}: independent physical identities/captors`);
    assert.deepEqual(state.fen.split(' '),fen().split(' '),`${why}: all six FEN fields`);
    assert.deepEqual(state.enPassant,ep,`${why}: physical EP opportunity`);
    assert.deepEqual(state.players,players,`${why}: exact cards in all zones`);assert.deepEqual(state.turn,turn,`${why}: timing/allowances`);
    assert.equal(state.history.length,historyLength,`${why}: history position`);
    const effects:unknown[]=[];
    if(n>=26&&n<29)effects.push({type:'mystic-shield',owner:'white',player:'white',pieceId:'white-pawn-f2'});
    if(n>=31)effects.push({type:'fortification',owner:'white',card:{id:'white-hand-0-fortification',cardId:'fortification'},from:'e7',to:'f6'});
    if(n>=60)effects.push({type:'crab',owner:'white',card:{id:'white-deck-3-crab',cardId:'crab'},pieceId:'white-pawn-g2'});
    if(n>=76&&n<79)effects.push({type:'dungeon',owner:'black',player:'white',pieceId:'white-knight-g1'});
    assert.deepEqual(state.effects,effects,why);assert.equal(state.orientation,0);assert.equal(state.outcome,null);
    const blackChecked=[43,44,73,74,75,104,105,106,107].includes(n);
    for(const color of ['white','black'] as const) {const expected=color==='black'&&blackChecked;assert.equal(checked(pieces,color,n),expected,`${why}: independent ${color} threats`);assert.equal(isKingInCheck(state,color),expected,`${why}: engine ${color} threats`);}
    for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.equal(state[key],undefined,`${why}: ${key}`);
    for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(state[key]??[],[],`${why}: ${key}`);
    assert.equal(state.pendingAbduction??null,null,why);assert.equal(state.pendingDoomsayer??null,null,why);
    if(n===75||n===106) {
      assert.ok(state.pendingRescue&&checkpoint);const rescue=state.pendingRescue;
      assert.deepEqual(rescue.pieces,checkpoint.pieces);assert.equal(rescue.fen,checkpoint.fen);assert.deepEqual(rescue.enPassant,checkpoint.ep);assert.equal(rescue.historyLength,checkpoint.historyLength);
      assert.deepEqual(rescue.movedPieceIds,[n===75?'black-rook-h8':'black-queen-d8']);assert.deepEqual(rescue.before,checkpoint.state);assert.deepEqual(rescue.history??rescue.before?.history,checkpoint.state.history);
      const saved=structuredClone(pieces);
      if(n===75) {assert.ok(players.black.hand.some(c=>c.cardId==='dungeon'));assert.equal(at(saved,'h8'),undefined);at(saved,'g5')!.square='h8';}
      else {
        assert.ok(players.black.hand.some(c=>c.cardId==='abduction'));capture(at(saved,'e5')!,'black');
        const abduct=applyAction(state,{type:'playCard',cardId:'abduction',target:'e5'});assert.ok(abduct.ok);
        const reveal=applyAction(abduct.state,{type:'revealAbduction'});assert.ok(reveal.ok);
        const timeout=applyAction(reveal.state,{type:'abductionTimeout'});assert.ok(timeout.ok);
        assert.deepEqual(timeout.state.pieces,saved);assert.equal(timeout.state.pendingRescue??null,null);
      }
      assert.equal(checked(saved,'black',n),false,'a presently held after-move card can cure the provisional check');
      assert.equal(applyAction(state,{type:'endTurn'}).ok,false,'unresolved rescue forbids ending');
    } else assert.equal(state.pendingRescue??null,null,why);
    // Serialization and legal EP are distinct: only row25 has an unprotected e4xf3 opportunity.
    if(ep.length) {
      const controller:Color=active==='w'?'white':'black';
      const trial={...state,turn:{...state.turn,color:controller,phase:'beforeMove' as const,moveMade:false}};
      const trialInput=structuredClone(trial);
      const publicDests=legalDests(trial,false), independent:string[]=[], publicEp:string[]=[], geometric:string[]=[];
      for(const opportunity of ep) {
        const victim=pieces.find(p=>p.id===opportunity.pawnId)!;
        assert.equal(victim.zone,'board');assert.equal(victim.role,'pawn');assert.equal(victim.owner,other(controller));
        assert.ok(victim.square);assert.equal(at(pieces,opportunity.target),undefined);
        for(const pawn of pieces.filter(p=>p.zone==='board'&&p.role==='pawn'&&p.owner===controller)) {
          assert.ok(pawn.square);
          const [x,y]=xy(pawn.square), [u,v]=xy(opportunity.target), [vx,vy]=xy(victim.square);
          if(Math.abs(u-x)!==1||v-y!==(controller==='white'?1:-1)||vx!==u||vy!==y)continue;
          const token=`${pawn.square}${opportunity.target}`;geometric.push(token);
          const simulated=structuredClone(pieces);
          capture(simulated.find(p=>p.id===victim.id)!,controller);
          simulated.find(p=>p.id===pawn.id)!.square=opportunity.target;
          const shielded=n>=26&&n<29&&controller==='black'&&victim.id==='white-pawn-f2';
          const royalSafe=!checked(simulated,controller,n);
          if(n>=25&&n<=27) {
            assert.equal(token,'e4f3');assert.equal(royalSafe,true,'e4xf3 leaves Black Kf7 safe');
            assert.equal(shielded,n!==25,'Shield alone forbids the otherwise safe EP capture in rows26–27');
          }
          if(!shielded&&royalSafe&&reaches(pieces,pawn,opportunity.target,true,n))independent.push(token);
          if(publicDests.get(pawn.square)?.includes(opportunity.target))publicEp.push(token);
        }
      }
      assert.deepEqual(geometric,n>=25&&n<=27?['e4f3']:[],`${why}: independent geometric EP candidates`);
      assert.deepEqual(independent,n===25?['e4f3']:[],`${why}: independent EP capture and royal-safety simulation`);
      assert.deepEqual(publicEp,independent,`${why}: public EP legality versus independent oracle`);
      assert.deepEqual(trial,trialInput,`${why}: EP enumeration preserves input`);
    }
  }
  assert.equal(fen(),'N2q3B/p1pPr1b1/n4k1p/4n3/R2b4/6P1/p2PK2B/1Q5R b - - 0 27');
  assert.equal(trace.steps.filter(x=>x.action.type==='move').length,50);assert.equal(trace.steps.filter(x=>x.action.type==='playCard').length,12);
});
