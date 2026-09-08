import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardMove, Color, GameAction, GameEvent, GameState, PieceState, Role, SquareName } from '../types.js';

// Reviewed against rules §§8–11, 13, 14.3, 15.3, 16.1, 19.2, 20–22
// and each played card's final_cards artwork (including printed timing).
const rationales = `
1 b2b3: Pawn advances one into empty b3.
2 end: White completes the quiet Pawn turn.
3 e7e6: Black Pawn advances one into empty e6.
4 end: Black completes its Pawn turn.
5 g1f3: Knight jumps to empty f3.
6 end: White completes its Knight turn.
7 c7c5: Pawn crosses empty c6; no White Pawn can capture c6 en passant.
8 end: Black closes; the physical c6 opportunity lasts for White's move.
9 b3b4: Pawn advances one; old en passant expires.
10 man-trap: White marks its occupied d2 after moving; retain the card.
11 end: White closes with d2 trap armed.
12 d7d6: Black Pawn advances one.
13 cathedral: Black swaps its a8 Rook and c8 Bishop after moving, without capture.
14 end: Black closes with the non-move swap preserved.
15 b1c3: Knight jumps to empty c3.
16 abduction: White conceals opposing Bishop f8 after moving, without capture yet.
17 reveal: Concealment ends; Black must answer the recall challenge.
18 timeout: Black fails recall; Bishop f8 is captured by White and the clock resets.
19 end: Resolved Abduction permits ending White's turn.
20 c8c7: The original a8 Rook moves one square; its remaining castling right expires.
21 end: Black closes its Rook turn.
22 b4c5: White Pawn captures the physical c7 Pawn diagonally.
23 toll: White crossed into Black's half; Black reacts and White pays h2 Pawn.
24 end: Paid Toll preserves White's completed capture.
25 d8g5: Queen follows empty e7 and f6 to g5.
26 end: Black closes its Queen turn.
27 passing-in-the-night: White swaps c5/f7 and e2/b7 Pawn pairs simultaneously; Pawn f7 checks e8 but King can escape d7.
28 end: The two-pair swap replaced White's move.
29 e8d7: Black King steps to safe d7 and loses both castling rights.
30 end: Black closes its King turn.
31 f7g8: White Pawn captures g8 Knight and promotes to Queen, retaining Pawn identity.
32 end: White closes the promotion turn.
33 g5d5: Black Queen slides through empty f5/e5.
34 end: Black closes its Queen turn.
35 g8f7: Promoted Queen steps diagonally and checks d7 along empty e7.
36 end: Black receives its escape turn from Queen f7 check.
37 h8g8: Provisional quiet Rook move; Fireball g8 can remove checking Queen f7.
38 holy-quest: c1/c3 swap does not cure Qf7 check; spend card, roll back Rook move.
39 d7d8: Black replaces the rolled-back move with a safe King step, retaining spent allowance.
40 end: Black closes after the legal replacement.
41 f7g7: Promoted White Queen captures Black g7 Pawn horizontally.
42 end: White closes its Queen capture.
43 a8b7: Black Bishop captures the original White e2 Pawn diagonally.
44 heresy: White Bishops c1-b1/f1-g1 move first; Black Bishop b7-b6 follows, all change color.
45 end: Black closes with all eligible Bishops relocated.
46 pacifism: White marks nonroyal Queen d1 before moving; retain the card and move allowance.
47 h1h6: Rook crosses empty h2–h5; kingside castling expires.
48 end: White completes its move after Pacifism.
49 forced-march: Black Pawns d6-c6/c5-b5 move sideways into initially empty squares.
50 end: Forced March consumed Black's move.
51 f3e5: White Knight jumps to empty e5.
52 end: White closes its Knight turn.
53 h8f8: Black Rook crosses empty g8.
54 end: Black closes its Rook turn.
55 h6h2: White Rook crosses empty h5/h4/h3.
56 forbidden-city: White marks empty b7 after moving; retain the wall card.
57 end: White closes with b7 forbidden.
58 c7f7: Black Rook crosses empty d7/e7; does not cross b7.
59 end: Black closes its Rook turn.
60 c3e2: White Knight captures Black's original b7 Pawn on e2.
61 end: White closes its Knight capture.
62 bombard: Black Rook f8-f5 jumps exactly its own f7 Rook; f6 and destination are empty.
63 end: Bombard consumed Black's move and leaves no permanent jumping power.
64 e2c1: White Knight jumps back to empty c1.
65 end: White closes its Knight turn.
66 d5g2: Black Queen crosses empty e4/f3 and captures g2 Pawn.
67 abduction: Black conceals opposing a2 Pawn after its capture.
68 reveal: White's recall window opens.
69 answer: White correctly names its physical a2 Pawn and original square; restore it exactly.
70 end: Correct recall ends the challenge with Black's card still spent.
71 d1g4: Pacifist Queen crosses empty e2/f3 without capture.
72 end: White closes; its Queen remains Pacifist.
73 f5f3: Black Rook crosses empty f4.
74 end: Black closes its Rook turn.
75 h2h5: White Rook crosses empty h3/h4.
76 treason: Swapping Black f3 Rook/b8 Knight puts Knight on f3 checking e1; fizzle and spend.
77 end: White closes with its pre-card board intact.
78 g2h2: Black Queen moves horizontally into empty h2.
79 end: Black closes its Queen turn.
80 g4g2: Pacifist Queen crosses empty g3 without capture.
81 end: White closes with the Pacifist identity preserved.
82 f3f4: Black Rook steps up one empty square.
83 end: Black closes its Rook turn.
84 a2a3: Restored White Pawn advances one square.
85 end: White closes its Pawn turn.
86 b6a5: Black Bishop moves one diagonal square.
87 end: Black closes its Bishop turn.
88 evil-eye: Promoted Qg7 legally threatens adjacent Rf7; capture only Rook, without moving Queen.
89 end: Evil Eye replaced White's move.
90 f4f2: Black Rook crosses empty f3 and captures White f2 Pawn.
91 end: Black closes its Rook capture.
92 c2c3: White Pawn advances one square.
93 end: White closes its Pawn turn.
94 h2h4: Black Queen crosses empty h3.
95 end: Black closes its Queen turn.
96 e1e2: Provisional King step enters Rf2 check; held Coup can make safe a3 Pawn royal.
97 coup: White a3 Pawn becomes royal; e2 King becomes capturable Prince, curing the check.
98 end: White closes with safe royal Pawn a3.
99 hidden-passage: Black King relocates d8-h3; Qg2 is Pacifist and Qh4 blocks Rh5's file.
100 end: Hidden Passage replaced Black's move.
101 doppelganger: White Rh5 moves h6 with the last-moved Black King's one-square power.
102 end: White closes the replacement move.
103 c6c5: Original Black d7 Pawn advances one square.
104 end: Black closes its Pawn turn.
105 b1g6: White Bishop crosses empty c2/d3/e4/f5.
106 end: White closes its Bishop turn.
107 f2f5: Black Rook crosses empty f3/f4; White's e2 Prince is not royal.
108 end: Black closes its Rook turn.
109 g6f7: White Bishop moves one diagonal square.
110 end: White closes its Bishop turn.
111 f5f7: Black Rook crosses empty f6 and captures White Bishop f7.
112 end: Black closes its Rook capture.
113 g7g6: Promoted White Queen moves one square down.
114 end: White closes its Queen turn.
115 h7g6: Black Pawn captures the promoted physical White b2 Pawn diagonally.
116 end: Black closes its Pawn capture; promotion remains recorded on the captured piece.
117 long-jump: White Knight e5-c4 changes square color and lands empty.
118 end: Long Jump replaced White's move.
119 a5d8: Black Bishop crosses empty b6/c7, avoiding forbidden b7.
120 end: Black closes its Bishop turn.
121 g1h2: White Bishop moves one diagonal square.
122 end: White closes its Bishop turn.
123 blessing: Black Rf7 moves diagonally to empty e8, without capture.
124 end: Blessing replaced Black's move; Rook powers return to ordinary.
125 h2f4: White Bishop crosses empty g3.
126 anathema: White swaps opposing Bishop d8/Rook e8; identities and markers persist.
127 end: White closes after its non-move swap.
128 d8d5: Black Rook crosses empty d7/d6.
129 end: Black closes its Rook turn.
130 bombard: White Ra1-b1 moves straight with zero jumps, which the card permits.
131 end: Bombard replaced White's move.
132 d5h5: Black Rook crosses empty e5/f5/g5.
133 end: Black closes the fiftieth move command; White's royal Pawn a3 remains safe.
`.trim().split('\n');

const cardActions: Record<number, Extract<GameAction, {type: 'playCard'}>> = {};
for (const [n, cardId, id, target] of [
  [10, 'man-trap', 'white-hand-1-man-trap', 'd2'],
  [13, 'cathedral', 'black-hand-0-cathedral', {rook:'a8',bishop:'c8'}],
  [16, 'abduction', 'white-hand-0-abduction', 'f8'],
  [23, 'toll', 'black-hand-4-toll', 'h2'],
  [27, 'passing-in-the-night', 'white-deck-1-passing-in-the-night', [{from:'c5',to:'f7'},{from:'e2',to:'b7'}]],
  [38, 'holy-quest', 'black-hand-2-holy-quest', {bishop:'c1',knight:'c3'}],
  [44, 'heresy', 'black-hand-3-heresy', [{from:'c1',to:'b1'},{from:'f1',to:'g1'},{from:'b7',to:'b6'}]],
  [46, 'pacifism', 'white-hand-4-pacifism', 'd1'],
  [49, 'forced-march', 'black-deck-3-forced-march', [{from:'d6',to:'c6'},{from:'c5',to:'b5'}]],
  [56, 'forbidden-city', 'white-deck-3-forbidden-city', 'b7'],
  [62, 'bombard', 'black-deck-1-bombard', [{from:'f8',to:'f5'}]],
  [67, 'abduction', 'black-deck-5-abduction', 'a2'],
  [76, 'treason', 'white-deck-2-treason', {rook:'f3',knight:'b8'}],
  [88, 'evil-eye', 'white-deck-4-evil-eye', {attacker:'g7',victim:'f7'}],
  [97, 'coup', 'white-deck-0-coup', 'a3'],
  [99, 'hidden-passage', 'black-deck-4-hidden-passage', [{from:'d8',to:'h3'}]],
  [101, 'doppelganger', 'white-hand-3-doppelganger', [{from:'h5',to:'h6'}]],
  [117, 'long-jump', 'white-deck-8-long-jump', [{from:'e5',to:'c4'}]],
  [123, 'blessing', 'black-deck-2-blessing', [{from:'f7',to:'e8'}]],
  [126, 'anathema', 'white-deck-5-anathema', {bishop:'d8',rook:'e8'}],
  [130, 'bombard', 'white-hand-2-bombard', [{from:'a1',to:'b1'}]],
] as const) cardActions[n] = {type:'playCard', cardId, cardInstanceId:id, target};

const copy = <T,>(value:T):T => structuredClone(value);
const opposite = (color:Color):Color => color === 'white' ? 'black' : 'white';
const at = (s:GameState, square:string) => s.pieces.find(p => p.zone === 'board' && p.square === square);
const xy = (square:string) => [square.charCodeAt(0)-97, Number(square[1])-1] as const;
const square = (x:number,y:number) => `${String.fromCharCode(97+x)}${y+1}` as SquareName;
const pacifist = (s:GameState,p:PieceState) => s.effects.some(e => (e as {type:string;pieceId?:string}).type === 'pacifism' && (e as {pieceId?:string}).pieceId === p.id);
const forbidden = (s:GameState,q:string) => s.effects.some(e => (e as {type:string;square?:string}).type === 'forbidden-city' && (e as {square?:string}).square === q);

// Physical geometry oracle: no reducer destination or attack helper participates.
function geometry(s:GameState, p:PieceState, to:string, capture:boolean, role:Role=p.role, jumps=0):boolean {
  if (!p.square || p.square === to || forbidden(s,to)) return false;
  if (capture && (pacifist(s,p) || !!at(s,to) && pacifist(s,at(s,to)!))) return false;
  const [x,y]=xy(p.square),[tx,ty]=xy(to),dx=tx-x,dy=ty-y,ax=Math.abs(dx),ay=Math.abs(dy);
  if(role==='knight') return ax*ay===2;
  if(role==='king') return Math.max(ax,ay)===1;
  if(role==='pawn') {
    const dir=p.owner==='white'?1:-1;
    if(capture) return ax===1 && dy===dir;
    if(dx!==0 || at(s,to)) return false;
    return dy===dir || dy===2*dir && (p.owner==='white'?y<=1:y>=6) && !at(s,square(x,y+dir)) && !forbidden(s,square(x,y+dir));
  }
  if(!(role==='queen' && (ax===ay || dx===0 || dy===0) || role==='rook' && (dx===0 || dy===0) || role==='bishop' && ax===ay)) return false;
  let blockers=0;
  for(let i=1;i<Math.max(ax,ay);i++) {const q=square(x+i*Math.sign(dx),y+i*Math.sign(dy));if(at(s,q)||forbidden(s,q))blockers++;}
  return blockers<=jumps;
}
function checked(s:GameState,color:Color):boolean {
  const king=s.pieces.find(p=>p.owner===color && p.royal && p.zone==='board');
  assert.ok(king?.square);
  return s.pieces.some(p=>p.zone==='board' && p.owner!==color && geometry(s,p,king.square!,true));
}
function boardFen(s:GameState):string {
  const chars:Record<Role,string>={king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'};
  return Array.from({length:8},(_,row)=>{
    let rank='',empty=0;
    for(let x=0;x<8;x++){const p=at(s,square(x,7-row));if(!p){empty++;continue;}if(empty){rank+=empty;empty=0;}const c=chars[p.role];rank+=p.owner==='white'?c.toUpperCase():c;}
    return rank+(empty||'');
  }).join('/');
}
function refresh(s:GameState, metadata=s.fen.split(' ').slice(1)) {s.fen=[boardFen(s),...metadata].join(' ');}
function completeMove(s:GameState,pawnOrCapture:boolean){
  const fields=s.fen.split(' ').slice(1);
  fields[0]=s.turn.color==='white'?'b':'w';fields[2]='-';fields[3]=String(pawnOrCapture?0:Number(fields[3])+1);
  fields[4]=String(Number(fields[4])+(s.turn.color==='black'?1:0));
  s.enPassant=[];s.turn.phase='afterMove';s.turn.moveMade=true;refresh(s,fields);
}
function capture(p:PieceState,by:Color){assert.equal(p.royal,false);p.zone='captured';p.square=null;p.capturedBy=by;}
function spend(s:GameState,a:Extract<GameAction,{type:'playCard'}>,owner:Color,retained=false){
  const player=s.players[owner],index=player.hand.findIndex(c=>c.id===a.cardInstanceId);
  assert.ok(index>=0);assert.equal(player.hand[index]!.cardId,a.cardId);assert.equal(s.turn.cardPlays[owner],0);
  const [card]=player.hand.splice(index,1);if(!retained)player.discard.push(card!);
  const draw=player.deck.shift();if(draw)player.hand.push(draw);s.turn.cardPlays[owner]++;
  return card!;
}
function invoke(s:GameState,a:GameAction):GameState {
  const snapshot=copy(s),payload=copy(a),r=applyAction(s,a);
  assert.deepEqual(s,snapshot,'public reducer input immutability');assert.deepEqual(a,payload,'action payload immutability');
  assert.ok(r.ok,JSON.stringify(a));return r.state;
}
function assertState(actual:GameState,expected:GameState,label:string){
  for(const key of ['pieces','players','effects','history','fen','turn','enPassant','orientation','outcome'] as const) assert.deepEqual(actual[key],expected[key],`${label}: ${key}`);
  assert.deepEqual(actual.shieldMove,expected.shieldMove,`${label}: exact moved identities and capture flag`);
  for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const) assert.equal(actual[key],undefined,`${label}: ${key}`);
  for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const) assert.deepEqual(actual[key]??[],[],`${label}: ${key}`);
  assert.equal(actual.pendingDoomsayer??null,null);
  assert.equal(!!actual.pendingRescue,!!expected.pendingRescue);
  const immutable=copy(actual);
  for(const color of ['white','black'] as const) assert.equal(isKingInCheck(actual,color),checked(expected,color),`${label}: independent ${color} royal threat`);
  assert.deepEqual(actual,immutable,'royal-query immutability');
  // Examine en passant from the prospective capturing player's before-move context.
  for(const ep of expected.enPassant){
    const victim=expected.pieces.find(p=>p.id===ep.pawnId)!;
    const prospect=copy(actual);prospect.turn={color:opposite(victim.owner),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    const snapshot=copy(prospect),dests=legalDests(prospect);
    for(const p of expected.pieces.filter(p=>p.owner===prospect.turn.color && p.role==='pawn' && p.zone==='board')){
      let legal=geometry(expected,p,ep.target,true);
      if(legal){const simulated=copy(expected);capture(simulated.pieces.find(q=>q.id===ep.pawnId)!,p.owner);simulated.pieces.find(q=>q.id===p.id)!.square=ep.target;legal=!checked(simulated,p.owner);}
      assert.equal(dests.get(p.square!)?.includes(ep.target)??false,legal,`${label}: prospective en passant ${p.square}`);
    }
    assert.deepEqual(prospect,snapshot,'prospective-en-passant query input');
  }
}

test('iteration 186 independently reviews every action and both complete rescue witnesses',()=>{
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/186.json',import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.steps.length,133);assert.equal(rationales.length,133);
  let actual=createGameState(trace.initial),expected=copy(actual),rescueBefore:GameState|undefined,abductionBefore:GameState|undefined;
  let rescueCount=0,moveCount=0,cardCount=0;
  for(const [index,step] of trace.steps.entries()){
    const n=index+1,a=step.action,before=copy(expected),actualBefore=copy(actual),reason=rationales[index]!;
    assert.ok(reason.startsWith(`${n} `));
    const moveText=reason.match(/^\d+ ([a-h][1-8])([a-h][1-8]):/);
    if(moveText){assert.deepEqual(a,{type:'move',from:moveText[1],to:moveText[2],...(n===31?{promotion:'queen'}:{})});}
    else if(cardActions[n])assert.deepEqual(a,cardActions[n]);
    else if([17,68].includes(n))assert.deepEqual(a,{type:'revealAbduction'});
    else if(n===18)assert.deepEqual(a,{type:'abductionTimeout'});
    else if(n===69)assert.deepEqual(a,{type:'answerAbduction',player:'white',owner:'white',role:'pawn',square:'a2',pieceId:'white-pawn-a2'});
    else assert.deepEqual(a,{type:'endTurn'});
    if(a.type==='move'){
      assert.ok(typeof a.from==='string' && typeof a.to==='string');const from=a.from,to=a.to;
      const p=at(expected,from)!,victim=at(expected,to);assert.ok(p);assert.equal(p.owner,expected.turn.color);
      assert.equal(expected.turn.moveMade,false);assert.ok(geometry(expected,p,to,!!victim),reason);
      if(victim){assert.notEqual(victim.owner,p.owner);capture(victim,p.owner);}
      p.square=to as SquareName;const pawn=p.role==='pawn';
      if(n===31){p.role='queen';p.promoted=true;}
      completeMove(expected,pawn||!!victim);
      const rights:Record<number,string>={20:'KQk',29:'KQ',47:'Q',96:'-'};
      if(rights[n]){const fields=expected.fen.split(' ').slice(1);fields[1]=rights[n]!;refresh(expected,fields);}
      if(n===7)expected.enPassant=[{target:'c6',pawnId:'black-pawn-c7'}];
      expected.history.push({type:'move',from:from as SquareName,to:to as SquareName,...(n===31?{promotion:'queen' as const}:{}),...(victim?{capturedId:victim.id}:{}),...([71,75,80,105,125].includes(n)?{previousFen:before.fen}:{})});
      expected.shieldMove={player:p.owner,pieceIds:[p.id],capturedOpponent:!!victim};
      if([37,96].includes(n)){rescueBefore=before;expected.pendingRescue={fen:before.fen,pieces:copy(before.pieces),enPassant:copy(before.enPassant),historyLength:before.history.length,movedPieceIds:[p.id]};}
      else assert.equal(checked(expected,p.owner),false,reason);
      moveCount++;
    }else if(a.type==='playCard'){
      cardCount++;const owner:Color=n===23?'black':expected.turn.color;
      const retained=['man-trap','pacifism','forbidden-city','coup'].includes(a.cardId);
      const replacement=[27,49,62,88,99,101,117,123,130].includes(n);
      assert.equal(before.turn.phase,replacement||n===46?'beforeMove':'afterMove');
      const card=spend(expected,a,owner,retained);
      let movement:CardMove[]=[],event:GameEvent={type:'cardPlayed',cardId:a.cardId,target:a.target as GameEvent['target'],movement,preservePreviousMove:!replacement&&n!==46};
      if(n===10){assert.equal(at(expected,'d2')?.owner,'white');expected.effects.push({type:'man-trap',owner,card,square:'d2'});delete event.target;}
      if(n===13 || n===126){const pair=n===13?['a8','c8']:['d8','e8'];const p=at(expected,pair[0]!)!,q=at(expected,pair[1]!)!;assert.equal(p.owner,'black');assert.equal(q.owner,'black');[p.square,q.square]=[q.square,p.square];movement.push({from:pair[0] as SquareName,to:pair[1] as SquareName},{from:pair[1] as SquareName,to:pair[0] as SquareName});if(n===13){const fields=expected.fen.split(' ').slice(1);fields[1]='KQka';refresh(expected,fields);}}
      if(n===16 || n===67){abductionBefore=actualBefore;const p=at(expected,n===16?'f8':'a2')!;assert.equal(p.owner,opposite(owner));assert.equal(p.royal,false);assert.equal(pacifist(expected,p),false);p.zone='away';p.square=null;delete event.target;}
      if(n===23){assert.deepEqual(before.history.at(-1),{type:'move',from:'b4',to:'c5',capturedId:'black-pawn-c7'});const p=at(expected,'h2')!;capture(p,'black');Object.assign(event,{player:'black',capturedId:p.id});}
      if(n===27){for(const [from,to] of [['c5','f7'],['e2','b7']] as const){const p=at(expected,from)!,q=at(expected,to)!;assert.equal(p.role,'pawn');assert.equal(q.role,'pawn');assert.equal(p.owner,'white');assert.equal(q.owner,'black');[p.square,q.square]=[q.square,p.square];}movement.push({from:'c5',to:'f7'},{from:'e2',to:'b7'},{from:'b7',to:'e2'},{from:'f7',to:'c5'});}
      if(n===38){assert.ok(rescueBefore);const candidate=copy(expected);[at(candidate,'c1')!.square,at(candidate,'c3')!.square]=['c3','c1'];assert.equal(checked(candidate,'black'),true);expected.pieces=copy(rescueBefore.pieces);expected.fen=rescueBefore.fen;expected.enPassant=copy(rescueBefore.enPassant);expected.history=copy(rescueBefore.history);expected.turn.phase='beforeMove';expected.turn.moveMade=false;expected.pendingRescue=null;event={type:'cardFizzled',cardId:a.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false};}
      if(n===44){for(const m of a.target as CardMove[]){const p=at(expected,m.from)!;assert.equal(p.role,'bishop');assert.equal(at(expected,m.to),undefined);const [x,y]=xy(m.from),[tx,ty]=xy(m.to);assert.equal(Math.abs(x-tx)+Math.abs(y-ty),1);p.square=m.to;movement.push(m);}assert.equal(expected.pieces.filter(p=>p.role==='bishop'&&p.zone==='board').length,3);}
      if(n===46){const p=at(expected,'d1')!;assert.equal(p.owner,'white');assert.equal(p.royal,false);expected.effects.push({type:'pacifism',owner,card,pieceId:p.id});}
      if(n===56){assert.equal(at(expected,'b7'),undefined);expected.effects.push({type:'forbidden-city',owner,card,square:'b7'});event={type:'cardPlayed',cardId:a.cardId,target:'b7'};}
      if(n===76){const candidate=copy(expected);[at(candidate,'f3')!.square,at(candidate,'b8')!.square]=['b8','f3'];assert.equal(checked(candidate,'white'),true);event={type:'cardFizzled',cardId:a.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:true};}
      if(n===88){const p=at(expected,'g7')!,q=at(expected,'f7')!;assert.equal(p.promoted,true);assert.ok(geometry(expected,p,'f7',true));const simulated=copy(expected);capture(at(simulated,'f7')!,'white');at(simulated,'g7')!.square='f7';assert.equal(checked(simulated,'white'),false);capture(q,'white');Object.assign(event,{capturedId:q.id,capturedIds:[q.id]});}
      if(n===97){at(expected,'e2')!.royal=false;at(expected,'a3')!.royal=true;expected.effects.push({type:'coup',owner,card,princeId:'white-king-e1',kingId:'white-pawn-a2',princeRole:'king'});expected.pendingRescue=null;}
      if([49,62,99,101,117,123,130].includes(n)){
        for(const m of a.target as CardMove[]){const p=at(expected,m.from)!;assert.equal(p.owner,owner);assert.equal(at(expected,m.to),undefined);
          if(n===49){assert.equal(p.role,'pawn');const [x,y]=xy(m.from),[tx,ty]=xy(m.to);assert.equal(y,ty);assert.equal(Math.abs(x-tx),1);}
          else if(n===99)assert.equal(p.royal,true);
          else if(n===117){assert.equal(p.role,'knight');const [x,y]=xy(m.from),[tx,ty]=xy(m.to);assert.notEqual((x+y)%2,(tx+ty)%2);}
          else {const role=n===101?'king':n===123?'bishop':'rook';assert.ok(geometry(expected,p,m.to,false,role,n===62?1:0));}
          p.square=m.to;movement.push(m);
        }
      }
      if(replacement){completeMove(expected,n===27||n===49||n===88);expected.shieldMove={player:owner,pieceIds:n===27||n===88?[]:movement.map(m=>at(expected,m.to)!.id),capturedOpponent:n===88};}
      refresh(expected);expected.history.push(event);
      if(n!==38)assert.equal(checked(expected,owner),false,reason);
      // The Pawn swap gives check, but the concrete d7 King escape excludes direct mate.
      if(n===27){const escape=copy(expected),king=at(escape,'e8')!;assert.ok(geometry(escape,king,'d7',false));assert.equal(at(escape,'d7'),undefined);king.square='d7';assert.equal(checked(escape,'black'),false);}
      else if(!retained && n!==38 && n!==76 && n!==16 && n!==67)assert.equal(checked(expected,opposite(owner)),false,reason);
    }else if(a.type==='endTurn'){
      assert.equal(expected.turn.moveMade,true);assert.equal(checked(expected,expected.turn.color),false);
      expected.turn={color:opposite(expected.turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};delete expected.shieldMove;
    }else if(a.type==='abductionTimeout'){
      const p=expected.pieces.find(p=>p.id==='black-bishop-f8')!;assert.equal(p.zone,'away');capture(p,'white');
      Object.assign(expected.history.at(-1)!,{target:'f8',capturedIds:[p.id],capturedId:p.id});const fields=expected.fen.split(' ').slice(1);fields[3]='0';refresh(expected,fields);
    }else if(a.type==='answerAbduction'){
      assert.ok(abductionBefore);expected.pieces=copy(abductionBefore.pieces);Object.assign(expected.history.at(-1)!,{target:'a2'});refresh(expected);
    }
    actual=invoke(actual,a);assertState(actual,expected,reason);
    if([16,17,67,68].includes(n)){assert.ok(actual.pendingAbduction);assert.deepEqual(actual.pendingAbduction,{phase:[16,67].includes(n)?'concealment':'recall',player:n<20?'black':'white',durationMs:10000,pieceId:n<20?'black-bishop-f8':'white-pawn-a2',requiresPieceId:false,before:abductionBefore});}
    else assert.equal(actual.pendingAbduction??null,null);
    if([37,96].includes(n)){
      assert.ok(actual.pendingRescue);assert.deepEqual(actual.pendingRescue,{...expected.pendingRescue,before:actualBefore});
      assert.equal(checked(expected,expected.turn.color),true);
      const rescue=copy(expected),owner=expected.turn.color;
      const cure:Extract<GameAction,{type:'playCard'}>=n===37?{type:'playCard',cardId:'fireball',cardInstanceId:'black-deck-0-fireball',target:'g8'}:cardActions[97]!;
      const card=spend(rescue,cure,owner,n===96);
      if(n===37){
        const victims=rescue.pieces.filter(p=>p.zone==='board' && p.square && Math.max(Math.abs(xy(p.square)[0]-6),Math.abs(xy(p.square)[1]-7))<=1 && !p.royal);
        assert.deepEqual(victims.map(p=>p.id).sort(),['white-pawn-b2','black-pawn-g7','black-pawn-h7','black-rook-h8'].sort());
        for(const p of victims)capture(p,'black');
        rescue.history.push({type:'cardPlayed',cardId:'fireball',target:'g8',capturedIds:victims.map(p=>p.id),player:'black',movement:[],preservePreviousMove:true});
        const fields=rescue.fen.split(' ').slice(1);fields[3]='0';refresh(rescue,fields);
      }else{
        at(rescue,'e2')!.royal=false;at(rescue,'a3')!.royal=true;
        rescue.effects.push({type:'coup',owner,card,princeId:'white-king-e1',kingId:'white-pawn-a2',princeRole:'king'});
        rescue.history.push({type:'cardPlayed',cardId:'coup',target:'a3',movement:[],preservePreviousMove:true});
      }
      rescue.pendingRescue=null;assert.equal(checked(rescue,owner),false);assert.equal(checked(rescue,opposite(owner)),false);
      const cured=invoke(actual,cure);assertState(cured,rescue,`${n}: complete independent cure`);
      rescue.turn={color:opposite(owner),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};delete rescue.shieldMove;
      assertState(invoke(cured,{type:'endTurn'}),rescue,`${n}: cured turn ends immutably`);rescueCount++;
    }
    if(n===38){
      // A retained historical shield token cannot authorize a post-move card after rollback.
      const probe=copy(actual);probe.turn.cardPlays.black=0;
      for(const id of ['mystic-shield','fireball']){
        const card=probe.players.black.hand.find(c=>c.cardId===id)!;const payload:GameAction={type:'playCard',cardId:id,cardInstanceId:card.id,target:'h8'},snap=copy(probe),saved=copy(payload),r=applyAction(probe,payload);
        assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,'INVALID_TIMING');assert.deepEqual(probe,snap);assert.deepEqual(payload,saved);
      }
    }
  }
  assert.deepEqual({moveCount,cardCount,rescueCount},{moveCount:50,cardCount:21,rescueCount:2});
  assert.equal(actual.fen,'1n2b3/p7/4p1pR/1pp4r/2N2B1q/P1P4k/3PK1Q1/1RN5 w - - 8 30');
});

test('iteration 186 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/186.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace);
  replayTrace(trace);
});
