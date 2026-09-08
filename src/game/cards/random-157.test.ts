import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Independent, ordered semantic review; no expected state is read from trace hashes.
const review = `
1 h2-h3 | White Pawn advances one empty square.
2 end | White finishes its quiet Pawn move.
3 g8-f6 | Black Knight jumps onto empty f6.
4 end | Black hands the move to White.
5 c2-c3 | White Pawn advances onto empty c3.
6 end | White finishes without a card.
7 e7-e5 | Black Pawn crosses empty e6; no White Pawn can take en passant.
8 end | Preserve the uncapturable e6 opportunity for White.
9 d1-b3 | White Queen crosses vacated c2 diagonally.
10 end | White finishes its Queen move.
11 h7-h5 | Black Pawn crosses empty h6; no White Pawn is on g5.
12 end | Preserve h6 for the prospective White reply.
13 b3-d1 | White Queen returns through empty c2 and expires h6.
14 end | White completes its Queen move.
15 f6-g4 | Black Knight jumps one file and two ranks.
16 end | Black completes the Knight jump.
17 b2-b4 | White Pawn crosses empty b3; Black has no adjacent EP captor.
18 end | Preserve b3 through the turn boundary.
19 f8-d6 | Black Bishop crosses empty e7 and expires b3.
20 heresy | White c1 Bishop must move first to c2; Black d6 Bishop moves to d5; f1 and c8 Bishops have no empty orthogonal neighbor.
21 end | Black finishes with Heresy spent and Knightmare drawn.
22 h3-g4 | White h2 Pawn captures Black g8 Knight diagonally.
23 end | White completes the capture with White credited.
24 tournament | Black swaps b8 Knight with White g1 Knight instead of moving; identities and ownership stay.
25 end | Black finishes the noncapturing swap.
26 c2-f5 | White Bishop crosses empty d3 and e4 diagonally.
27 end | White completes the Bishop move.
28 d7-d6 | Black Pawn advances onto the Bishop's vacated square.
29 end | Black finishes its Pawn move.
30 g4-h5 | White h2 Pawn captures Black h7 Pawn diagonally.
31 end | White completes the second capture by this Pawn.
32 dark-mirror | Black c7 Pawn captures White g1 Knight backward on b8; it remains an unpromoted Black Pawn.
33 end | Black finishes its replacement capture.
34 pacifism | Before moving White protects its nonroyal g2 Pawn; retain the effect and draw Bombard.
35 f5-c2 | White Bishop crosses empty e4 and d3 back to c2.
36 end | White finishes; Pacifism remains on g2.
37 g7-g5 | Black double-steps through g6; White h5 Pawn can legally capture en passant on g6.
38 end | White receives the live g6 capture opportunity.
39 d1-c1 | White Queen moves one file; declining EP expires g6.
40 end | White completes its Queen move.
41 d8-b6 | Black Queen crosses empty c7 diagonally.
42 end | Black completes the Queen move.
43 bombard | White Rook a1-a6 jumps exactly the a2 Pawn; a3 through a6 are empty; lose queenside rights.
44 end | White finishes the replacement Rook move.
45 masquerade | Black h8 Rook moves as a Queen to empty g8; lose kingside rights.
46 end | Black finishes its noncapturing replacement.
47 annexation | White f2 Pawn crosses empty f3 to f4; raw f3 EP is serialized despite no adjacent Black captor.
48 end | Preserve raw f3 serialization and the uncapturable opportunity.
49 c8-d7 | Black Bishop steps diagonally and expires the Annexation opportunity.
50 end | Black completes its Bishop move.
51 f4-f5 | White Pawn advances one empty square.
52 vendetta | White after-move card starts compulsory captures for both players; retain card.
53 end | Black has legal captures, so Vendetta stays active.
54 g1-e2 | Black Knight captures White e2 Pawn, satisfying Vendetta.
55 end | White has legal captures, keeping Vendetta active.
56 a6-a7 | White Rook captures Black a7 Pawn, satisfying Vendetta.
57 coup | White marks its safe c2 Bishop royal and makes e1 King a capturable Prince; Bishop movement stays unchanged.
58 end | Black receives a capture-required turn; White royal is c2.
59 e2-c3 | Black Knight captures White c2 Pawn on c3.
60 end | White must capture if able.
61 b1-c3 | White Knight captures Black b8 Knight, satisfying Vendetta.
62 chaos | Black cancels that capture, restores both Knights and clocks, and forbids the full captured-piece movement token.
63 a7-b7 | White chooses a different capture of Black b7 Pawn; Vendetta and Chaos are both satisfied.
64 end | End replacement turn and clear reaction allowance.
65 d5-a2 | Black Bishop crosses empty c4 and b3, capturing White a2 Pawn.
66 fatal-attraction | Black marks controlled d6 Pawn; adjacent Black e5 Pawn and d7 Bishop freeze; White f5 Pawn is two files away.
67 end | White still has a legal Knight capture, so Vendetta persists.
68 b1-c3 | White Knight legally repeats the formerly canceled capture on a later turn.
69 end | Black receives another capture-required turn.
70 b6-b4 | Black Queen crosses empty b5 and captures White b2 Pawn.
71 revenge | White reacts immediately to its b4 Pawn being captured by a Regular Move, capturing opposing d6 Pawn; remove Fatal Attraction and credit White.
72 end | White begins with available Rook and Knight captures.
73 b7-b8 | White Rook captures Black c7 Pawn and checks e8 along empty c8 and d8.
74 end | Black must answer the Rook check.
75 a8-b8 | Black Rook captures the checking White Rook; remove Black's last castling right.
76 end | White still has the Knight capture on a2.
77 c3-a2 | White Knight captures Black f8 Bishop.
78 riposte | Black restores its a2 Bishop and captures the attacking White Knight instead; its next move is forfeited.
79 end | Enter Black's skipped after-move turn; increment both clocks once, reset card allowances, consume penalty.
80 end | Black ends the skipped turn; White has no legal captures, so Vendetta is discarded.
81 fanatic | White h5 Pawn traverses empty h6,h7,h8; no promotion and no EP, as the card grants neither.
82 end | White completes the three-square replacement.
83 g8-g6 | Black Rook crosses empty g7 down its file.
84 end | Black completes its Rook move.
85 h1-h4 | White Rook crosses empty h2 and h3; remove White's remaining castling right.
86 end | White completes the Rook move.
87 onslaught | Black simultaneously advances e5-e4 and f7-f6 onto empty squares; one Pawn move clock update.
88 end | Black completes the multi-Pawn replacement.
89 h4-h1 | White Rook returns through empty h3 and h2 without restoring castling rights.
90 end | White finishes the Rook move.
91 b4-d2 | Black Queen crosses empty c3 and captures White d2 Pawn; it checks the royal Bishop on c2.
92 end | White receives the checked turn.
93 dubbing | g2-h4 is a quiet Knight jump, but leaves c2 royal under Queen d2 attack; spend card, restore board, retain move.
94 e1-d2 | White Prince captures the checking Queen diagonally, saving the c2 royal.
95 end | White finishes its legal check escape.
96 passing-in-the-night | Black swaps e4 Pawn with White f5 Pawn; preserve physical identity, no capture or promotion.
97 end | Black finishes the Pawn swap.
98 c1-d1 | White Queen steps one file onto empty d1.
99 end | White completes its Queen move.
100 b8-d8 | Black Rook crosses empty c8.
101 end | Black finishes its Rook move.
102 d2-e2 | White Prince steps horizontally to empty e2; only the c2 Bishop is royal.
103 rebirth | White relocates Black g6 Rook to empty original Rook square a8 after its move; clocks stay.
104 end | White completes the turn.
105 e8-e7 | Black King steps onto safe e7.
106 end | Black completes the royal move.
107 e4-e5 | White f2 Pawn advances from its swapped square.
108 end | White completes the Pawn advance.
109 f5-f4 | Black e7 Pawn advances on its swapped file.
110 end | Black completes the Pawn advance.
111 c2-d3 | White royal Bishop moves diagonally; Black d7 Bishop blocks the d8 Rook's file.
112 end | White finishes with its royal on safe d3.
113 d8-c8 | Black Rook moves one file onto empty c8.
114 end | Black completes the Rook move.
115 e2-f3 | White Prince steps diagonally; White's royal remains d3.
116 end | White completes the Prince move.
117 f6-f5 | Black f7 Pawn advances one empty square.
118 end | Black completes the Pawn move.
119 d1-e1 | White Queen steps horizontally to empty e1.
120 end | White completes the Queen move.
121 d7-e8 | Black Bishop steps diagonally; d3 royal is not on its diagonal.
122 end | Black completes the Bishop move.
123 e1-e3 | White Queen crosses vacated e2 on its file; White e5 Pawn blocks its line to Black e7 King.
124 end | White completes the Queen move.
125 e8-f7 | Black Bishop steps diagonally to empty f7; both royals remain safe.
126 end | Black completes the fiftieth move command; White receives a clear before-move turn.
`.trim().split('\n');

const cards: Record<number, [string, unknown]> = {
  20: ['black-hand-3-heresy', [{from:'c1',to:'c2'},{from:'d6',to:'d5'}]],
  24: ['black-hand-0-tournament', {own:'b8',opponent:'g1'}],
  32: ['black-hand-2-dark-mirror', [{from:'c7',to:'b8'}]],
  34: ['white-hand-2-pacifism','g2'],
  43: ['white-deck-0-bombard',[{from:'a1',to:'a6'}]],
  45: ['black-hand-4-masquerade',[{from:'h8',to:'g8'}]],
  47: ['white-hand-4-annexation',[{from:'f2',to:'f4'}]],
  52: ['white-deck-1-vendetta',undefined], 57: ['white-deck-2-coup','c2'],
  62: ['black-deck-1-chaos',undefined],66:['black-deck-2-fatal-attraction','d6'],
  71: ['white-hand-3-revenge','d6'],78:['black-deck-5-riposte',undefined],
  81: ['white-hand-1-fanatic','h5'],
  87: ['black-deck-4-onslaught',[{from:'e5',to:'e4'},{from:'f7',to:'f6'}]],
  93: ['white-deck-6-dubbing',[{from:'g2',to:'h4'}]],
  96: ['black-hand-1-passing-in-the-night',[{from:'e4',to:'f5'}]],
  103: ['white-deck-7-rebirth',[{from:'g6',to:'a8'}]],
};
type Effect = { type: string; owner: Color; card: {id:string;cardId:string}; pieceId?:string; princeId?:string;kingId?:string;princeRole?:string };
const other = (c:Color):Color => c==='white'?'black':'white';
const xy = (s:string) => [s.charCodeAt(0)-97, Number(s[1])-1] as const;
const square = (x:number,y:number):string => String.fromCharCode(97+x)+(y+1);
const at = (ps:PieceState[],s:string) => ps.find(p=>p.zone==='board'&&p.square===s);
const adjacent = (a:string,b:string) => Math.max(Math.abs(xy(a)[0]-xy(b)[0]),Math.abs(xy(a)[1]-xy(b)[1]))===1;
function frozen(ps:PieceState[],p:PieceState,es:Effect[]):boolean {
  return !p.royal && es.some(e=>e.type==='fatal-attraction' && e.pieceId!==p.id &&
    ps.some(m=>m.id===e.pieceId&&m.zone==='board'&&adjacent(m.square!,p.square!)));
}
function geometry(ps:PieceState[],p:PieceState,to:string,capture:boolean,es:Effect[]):boolean {
  const [x,y]=xy(p.square!), [tx,ty]=xy(to),dx=tx-x,dy=ty-y,ax=Math.abs(dx),ay=Math.abs(dy);
  if ((!ax&&!ay)||frozen(ps,p,es)) return false;
  if(capture && es.some(e=>e.type==='pacifism'&&(e.pieceId===p.id||e.pieceId===at(ps,to)?.id)))return false;
  if(p.role==='pawn') { const f=p.owner==='white'?1:-1; return capture?ax===1&&dy===f:dx===0&&(dy===f||dy===2*f&&(p.owner==='white'?y<=1:y>=6)&&!at(ps,square(x,y+f))); }
  if(p.role==='knight')return ax*ay===2;
  if(p.role==='king')return Math.max(ax,ay)===1;
  if(!(p.role==='bishop'?ax===ay:p.role==='rook'?dx===0||dy===0:ax===ay||dx===0||dy===0))return false;
  for(let i=1;i<Math.max(ax,ay);i++)if(at(ps,square(x+i*Math.sign(dx),y+i*Math.sign(dy))))return false;
  return true;
}
function checked(ps:PieceState[],color:Color,es:Effect[]):boolean {
  const king=ps.find(p=>p.zone==='board'&&p.royal&&p.owner===color)!; assert.ok(king);
  return ps.some(p=>p.zone==='board'&&p.owner!==color&&geometry(ps,p,king.square!,true,es));
}
function availableCaptures(ps:PieceState[],color:Color,es:Effect[]):string[] {
  return ps.filter(p=>p.zone==='board'&&p.owner===color).flatMap(p=>ps.filter(v=>v.zone==='board'&&v.owner!==color&&!v.royal&&geometry(ps,p,v.square!,true,es)).flatMap(v=>{
    const next=structuredClone(ps),a=next.find(t=>t.id===p.id)!,b=next.find(t=>t.id===v.id)!;
    a.square=b.square;b.square=null;b.zone='captured';
    const remaining=es.filter(e=>e.pieceId!==v.id&&!(e.type==='fatal-attraction'&&e.pieceId===p.id));
    return checked(next,color,remaining)?[]:[p.square+'-'+v.square];
  }));
}
function boardFen(ps:PieceState[]):string {
  return Array.from({length:8},(_,i)=>{
    let row='',empty=0;
    for(let x=0;x<8;x++){const p=at(ps,square(x,7-i));if(!p){empty++;continue;}if(empty)row+=empty;empty=0;
      const s=({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'})[p.role];row+=p.owner==='white'?s.toUpperCase():s;}
    return row+(empty||'');
  }).join('/');
}
test('iteration 157 independent physical board, exact targets and obligations',()=>{
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/157.json',import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.seed,860157);assert.equal(trace.failure,undefined);assert.equal(review.length,126);assert.equal(trace.steps.length,126);
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,18);
  let state=createGameState(trace.initial),pieces:PieceState[]=[];
  for(const owner of ['white','black'] as const)for(let x=0;x<8;x++)for(const role of ['pawn',(['rook','knight','bishop','queen','king','bishop','knight','rook'] as const)[x]!] as const){
    const s=square(x,role==='pawn'?owner==='white'?1:6:owner==='white'?0:7) as SquareName;
    pieces.push({id:owner+'-'+role+'-'+s,owner,role,originalRole:role,square:s,zone:'board',promoted:false,royal:role==='king',neutral:false});
  }
  const players=Object.fromEntries((['white','black'] as const).map(c=>[c,{
    hand:trace.initial.hands![c]!.map((cardId,i)=>({id:c+'-hand-'+i+'-'+cardId,cardId})),
    deck:trace.initial.decks![c]!.map((cardId,i)=>({id:c+'-deck-'+i+'-'+cardId,cardId})),discard:[],
  }])) as unknown as GameState['players'];
  let effects:Effect[]=[],ep:GameState['enPassant']=[],actor:Color='white',active:Color='white',moved=false,half=0,full=1,rights='KQkq',rawEp='-',historyLength=0;
  let allowances={white:0,black:0},shield:GameState['shieldMove'],forbidden:GameState['chaosForbidden'];
  let lost:Color[]=[],skipped:Color|undefined;
  type Snapshot={pieces:PieceState[];effects:Effect[];ep:GameState['enPassant'];actor:Color;active:Color;moved:boolean;half:number;full:number;rights:string;rawEp:string;allowances:typeof allowances};
  let prior:Snapshot|undefined;
  const snapshot=():Snapshot=>structuredClone({pieces,effects,ep,actor,active,moved,half,full,rights,rawEp,allowances});
  const loseRights=(p:PieceState)=>{
    if(p.role==='king')rights=rights.replace(p.owner==='white'?/[KQ]/g:/[kq]/g,'');
    for(const [id,r]of [['white-rook-a1','Q'],['white-rook-h1','K'],['black-rook-a8','q'],['black-rook-h8','k']])if(p.id===id)rights=rights.replace(r!,'');
  };
  const expire=(id:string)=>{
    for(const e of effects.filter(e=>e.pieceId===id))players[e.owner].discard.push(e.card);
    effects=effects.filter(e=>e.pieceId!==id);
  };
  const capture=(p:PieceState,by:Color)=>{
    assert.equal(p.royal,false);assert.ok(!effects.some(e=>e.type==='pacifism'&&e.pieceId===p.id));
    loseRights(p);expire(p.id);p.zone='captured';p.square=null;p.capturedBy=by;
  };
  const complete=(pawn:boolean,captureMade=false)=>{
    half=pawn||captureMade?0:half+1;if(actor==='black')full++;active=other(actor);moved=true;forbidden=undefined;
  };
  const relocate=(from:string,to:string)=>{
    assert.match(to,/^[a-h][1-8]$/);const p=at(pieces,from)!;assert.ok(p);loseRights(p);
    if(effects.some(e=>e.type==='fatal-attraction'&&e.pieceId===p.id))expire(p.id);
    p.square=to as SquareName;return p;
  };
  for(const [i,step] of trace.steps.entries()){
    const n=i+1,action=step.action,[heading,reason]=review[i]!.split(' | '),[num,command]=heading!.split(' ');
    assert.equal(Number(num),n);assert.ok(reason);const original=structuredClone(state);
    if(action.type==='move'){
      assert.ok(typeof action.from==='string'&&typeof action.to==='string');const from=action.from,to=action.to;
      assert.equal(command,from+'-'+to);assert.equal(action.promotion,undefined);assert.equal(moved,false);
      prior=snapshot();const p=at(pieces,from)!,v=at(pieces,to);assert.ok(p);assert.equal(p.owner,actor);
      assert.ok(!v||v.owner!==actor);assert.ok(geometry(pieces,p,to,!!v,effects),n+': move geometry');
      if(effects.some(e=>e.type==='vendetta')){const captures=availableCaptures(pieces,actor,effects);assert.ok(captures.length);assert.ok(captures.includes(from+'-'+to));}
      const [x,y]=xy(from),[,ty]=xy(to);
      ep=p.role==='pawn'&&Math.abs(ty-y)===2?[{target:square(x,(y+ty)/2) as SquareName,pawnId:p.id}]:[];
      if(v)capture(v,actor);relocate(from,to);complete(p.role==='pawn',!!v);
      rawEp=n===37?'g6':'-';shield={player:actor,pieceIds:[p.id],capturedOpponent:!!v};historyLength++;
    }else if(action.type==='endTurn'){
      assert.equal(command,'end');assert.equal(moved,true);assert.equal(checked(pieces,actor,effects),false);
      actor=other(actor);moved=false;allowances={white:0,black:0};shield=undefined;forbidden=undefined;skipped=undefined;
      if(lost.includes(actor)){lost.splice(lost.indexOf(actor),1);skipped=actor;complete(false);ep=[];rawEp='-';}
      if(n===80){assert.deepEqual(availableCaptures(pieces,actor,effects),[]);const e=effects.find(e=>e.type==='vendetta')!;assert.ok(e);players[e.owner].discard.push(e.card);effects=effects.filter(x=>x!==e);}
      else if(!moved&&effects.some(e=>e.type==='vendetta'))assert.ok(availableCaptures(pieces,actor,effects).length);
    }else{
      assert.equal(action.type,'playCard');if(action.type!=='playCard')throw Error('unreviewed action');
      const [id,target]=cards[n]!;assert.equal(action.cardId,command);assert.equal(action.cardInstanceId,id);assert.deepEqual(action.target,target);
      const owner:Color=id.startsWith('white')?'white':'black',player=players[owner];
      assert.equal(allowances[owner],0);const ci=player.hand.findIndex(c=>c.id===id);assert.ok(ci>=0);const card=player.hand.splice(ci,1)[0]!;
      const reaction=[62,71,78].includes(n);assert.equal(owner,reaction?other(actor):actor);
      assert.equal(moved,reaction||[20,52,57,66,103].includes(n));
      const continuing=[34,52,57,66].includes(n);
      if(!continuing)player.discard.push(card);
      if(n===62){
        assert.ok(prior);assert.deepEqual(trace.steps[i-1]!.action,{type:'move',from:'b1',to:'c3'});
        ({pieces,effects,ep,actor,active,moved,half,full,rights,rawEp,allowances}=structuredClone(prior));
        forbidden={player:'white',movement:'black-knight-b8:c3:captured|white-knight-b1:b1:c3'};shield=undefined;
      }else{
        historyLength++;
        if(n===20){
          for(const [ownerColor,from,to]of [['white','c1','c2'],['black','d6','d5']] as const){
            const eligible=pieces.filter(p=>p.zone==='board'&&p.owner===ownerColor&&p.role==='bishop').filter(p=>{
              const [x,y]=xy(p.square!);return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].some(([a,b])=>a!>=0&&a!<8&&b!>=0&&b!<8&&!at(pieces,square(a!,b!)));
            });
            assert.deepEqual(eligible.map(p=>p.square),[from]);assert.equal(at(pieces,to),undefined);
            assert.equal(Math.abs(xy(from)[0]-xy(to)[0])+Math.abs(xy(from)[1]-xy(to)[1]),1);relocate(from,to);
          }
        }else if(n===24||n===96){
          const from=n===24?'b8':'e4',to=n===24?'g1':'f5',a=at(pieces,from)!,b=at(pieces,to)!;
          assert.equal(a.owner,owner);assert.equal(b.owner,other(owner));assert.equal(a.role,n===24?'knight':'pawn');assert.equal(b.role,a.role);
          a.square=to as SquareName;b.square=from as SquareName;ep=[];rawEp='-';complete(n===96);shield={player:owner,pieceIds:[],capturedOpponent:false};
        }else if(n===32){
          const p=at(pieces,'c7')!,v=at(pieces,'b8')!;assert.equal(p.role,'pawn');assert.equal(p.owner,'black');assert.equal(v.owner,'white');
          assert.equal(xy('b8')[1]-xy('c7')[1],1);capture(v,owner);relocate('c7','b8');complete(true,true);ep=[];rawEp='-';shield={player:owner,pieceIds:[p.id],capturedOpponent:true};
        }else if(n===34||n===66){
          const p=at(pieces,target as string)!;assert.equal(p.owner,owner);if(n===34)assert.equal(p.royal,false);
          effects.push({type:command!,owner,card,pieceId:p.id});
          if(n===66)assert.deepEqual(pieces.filter(x=>x.zone==='board'&&frozen(pieces,x,effects)).map(x=>x.id).sort(),['black-bishop-c8','black-pawn-e7']);
        }else if(n===52)effects.push({type:'vendetta',owner,card});
        else if(n===57){
          const p=at(pieces,'c2')!,king=at(pieces,'e1')!;assert.equal(p.role,'bishop');assert.equal(p.owner,'white');assert.equal(king.royal,true);
          p.royal=true;king.royal=false;effects.push({type:'coup',owner,card,princeId:king.id,kingId:p.id,princeRole:'king'});
        }else if(n===43||n===45||n===47||n===81||n===87){
          const movements=n===43?[['a1','a6']]:n===45?[['h8','g8']]:n===47?[['f2','f4']]:n===81?[['h5','h8']]:[['e5','e4'],['f7','f6']];
          const ids:string[]=[];ep=[];rawEp='-';
          for(const [from,to]of movements){
            const p=at(pieces,from!)!;assert.equal(p.owner,owner);assert.equal(frozen(pieces,p,effects),false);assert.equal(at(pieces,to!),undefined);
            if(n===43){assert.equal(p.role,'rook');assert.deepEqual([2,3,4,5].map(rank=>at(pieces,'a'+rank)?.id),['white-pawn-a2',undefined,undefined,undefined]);}
            else if(n===45){assert.notEqual(p.role,'pawn');assert.ok(geometry(pieces,{...p,role:'queen'},to!,false,effects));}
            else{
              assert.equal(p.role,'pawn');const [x,y]=xy(from!),[tx,ty]=xy(to!);const distance:number=n===47?2:n===81?3:1;assert.equal(tx,x);assert.equal(ty-y,(owner==='white'?1:-1)*distance);
              for(let d=1;d<=distance;d++)assert.equal(at(pieces,square(x,y+d*(owner==='white'?1:-1))),undefined);
            }
            ids.push(relocate(from!,to!).id);
          }
          if(n===47){ep=[{target:'f3',pawnId:'white-pawn-f2'}];rawEp='f3';}
          complete(n===47||n===81||n===87);shield={player:owner,pieceIds:ids,capturedOpponent:false};
        }else if(n===71){
          assert.deepEqual(trace.steps[i-1]!.action,{type:'move',from:'b6',to:'b4'});
          assert.equal(at(prior!.pieces,'b4')!.id,'white-pawn-b2');
          assert.equal(pieces.find(p=>p.id==='white-pawn-b2')!.capturedBy,'black');
          const p=at(pieces,'d6')!;assert.equal(p.role,'pawn');assert.equal(p.owner,other(owner));capture(p,owner);half=0;
        }
        else if(n===78){
          assert.ok(prior);assert.deepEqual(trace.steps[i-1]!.action,{type:'move',from:'c3',to:'a2'});
          const beforeBishop=prior.pieces.find(p=>p.id==='black-bishop-f8')!;assert.equal(beforeBishop.square,'a2');
          pieces=structuredClone(prior.pieces);capture(at(pieces,'c3')!,owner);assert.equal(at(pieces,'a2')!.id,beforeBishop.id);
          lost=['black'];shield=undefined;ep=[];rawEp='-';half=0;
        }else if(n===93){
          const pawn=at(pieces,'g2')!;assert.equal(pawn.role,'pawn');assert.equal(at(pieces,'h4'),undefined);
          assert.ok(geometry(pieces,{...pawn,role:'knight'},'h4',false,effects));
          const proposed=structuredClone(pieces);proposed.find(p=>p.id===pawn.id)!.square='h4';
          assert.equal(checked(proposed,owner,effects),true);assert.equal(checked(pieces,owner,effects),true);shield=undefined;
        }else if(n===103){
          const p=at(pieces,'g6')!;assert.equal(p.owner,'black');assert.equal(p.role,'rook');assert.equal(at(pieces,'a8'),undefined);relocate('g6','a8');
        }else throw Error('unreviewed card '+n);
      }
      player.hand.push(player.deck.shift()!);allowances[owner]++;
    }
    const result=applyAction(state,action);assert.deepEqual(state,original,n+': full input-state immutability');assert.ok(result.ok,n+': '+reason);state=result.state;
    const sorted=(ps:PieceState[])=>[...ps].sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(sorted(state.pieces),sorted(pieces),n+': independent physical identity, captures, royalty');
    assert.deepEqual(state.effects,effects,n+': complete effects');assert.deepEqual(state.players,players,n+': spending/drawing/discards');
    assert.deepEqual(state.turn,{color:actor,phase:moved?'afterMove':'beforeMove',moveMade:moved,cardPlays:allowances},n+': turn');
    assert.deepEqual(state.enPassant,ep);assert.equal(state.history.length,historyLength,n+': history count');
    assert.equal(state.orientation,0);assert.equal(state.outcome,null);assert.equal(state.pendingRescue??null,null);
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);assert.deepEqual(state.underElfHill??[],[]);
    assert.deepEqual(state.chaosForbidden,forbidden,n+': full cancellation token');assert.equal(state.plotsExecution,undefined);assert.deepEqual(state.plotsAllowances??[],[]);
    assert.deepEqual(state.fogLocked??[],[]);assert.deepEqual(state.riposteLostMoves??[],lost);assert.equal(state.riposteSkipped,skipped);assert.equal(state.riposteCheckDeferred,undefined);assert.deepEqual(state.shieldMove,shield,n+': movement identity');
    assert.ok(pieces.every(p=>!p.neutral)); // No neutral or Truce card is played in this iteration.
    for(const color of ['white','black'] as const){
      const expected=checked(pieces,color,effects);assert.equal(expected,color==='black'?[73,74].includes(n):[91,92,93].includes(n),n+': independent royal geometry');
      assert.equal(isKingInCheck(state,color),expected,n+': public royal threat');
    }
    const prospective=structuredClone(state);prospective.turn={color:active,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    const dests=ep.length?legalDests(prospective):new Map<SquareName,SquareName[]>();const legalEp:string[]=[];
    for(const opportunity of ep)for(const p of pieces.filter(p=>p.zone==='board'&&p.owner===active&&p.role==='pawn')){
      const board=structuredClone(pieces),a=board.find(x=>x.id===p.id)!,v=board.find(x=>x.id===opportunity.pawnId)!;
      const geometric=geometry(pieces,p,opportunity.target,true,effects)&&v.owner!==active&&!at(pieces,opportunity.target);
      a.square=opportunity.target;v.square=null;v.zone='captured';const allowed=geometric&&!checked(board,active,effects);
      assert.equal(dests.get(p.square!)?.includes(opportunity.target)??false,allowed,n+': prospective EP legality');if(allowed)legalEp.push(p.square+'-'+opportunity.target);
    }
    assert.deepEqual(legalEp,[37,38].includes(n)?['h5-g6']:[],n+': exact EP captures');
    assert.equal(state.fen,boardFen(pieces)+' '+active[0]+' '+(rights||'-')+' '+rawEp+' '+half+' '+full,n+': all six FEN fields');
  }
  assert.equal(state.fen,'r1r4P/4kb2/8/4Ppp1/5p2/3BQK2/b5P1/5B1R w - - 4 30');
});
test('iteration 157 deterministic replay',()=>{
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/157.json',import.meta.url),'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
