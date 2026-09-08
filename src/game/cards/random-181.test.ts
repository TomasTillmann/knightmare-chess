import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, GameAction, GameEvent, PieceState, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

test('iteration 181 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/181.json', import.meta.url), 'utf8')) as RandomTrace;
  replayTrace(trace);
});

// Independently reviewed against rules §§8, 11.6–7, 13, 18.6, 19 and all fourteen
// printed card images identified in catalog.ts. No generated state is an oracle.
const rationales = `
1 White h2-h3 is a quiet single Pawn advance.
2 White closes a safe turn; cards and clocks stay fixed.
3 Black c7-c5 crosses empty c6; EP c6 has no adjacent White captor.
4 Black closes; the physical c5 EP opportunity lasts until White moves.
5 White c2-c3 advances one; old EP expires.
6 White closes its safe Pawn move.
7 Black Qd8-c7 slides one diagonal into the vacated Pawn square.
8 Black closes its safe Queen move.
9 White Ng1-f3 jumps to an empty square.
10 White closes its safe Knight move.
11 Black Qc7-e5 crosses empty d6 diagonally.
12 Black closes its safe Queen move.
13 White Bombard h1-g1 is an allowed straight Rook move with zero obstructions; consumes move and kingside rights.
14 White closes Bombard; allowance resets without a second clock advance.
15 Black c5-c4 advances to empty c4.
16 Black closes its safe Pawn move.
17 White Nf3-g5 jumps to empty g5.
18 White closes its safe Knight move.
19 Black Qe5xc3 crosses d4 and captures physical white-pawn-c2 for Black.
20 Black closes its capture.
21 White Ng5-e4 jumps to empty e4.
22 White retains Forbidden City on empty b4 after its move; draw one replacement.
23 White closes; b4 remains impassable.
24 Black d7-d5 crosses empty d6; no White EP captor exists.
25 Black closes; d6 opportunity persists.
26 White Guardian a2-a3 advances its Pawn; the optional Ra1 follower is omitted; replacement move prevents EP.
27 White closes Guardian.
28 Black g7-g5 crosses empty g6; no White EP captor exists.
29 Black closes its Pawn move.
30 White Disintegration kills its own f2 Pawn permanently; preserves move and clocks and raw g6 EP serialization.
31 White Ne4-f6 jumps, checking Ke8; f2 death does not alter Knight identity.
32 White closes a safe checking move; Black receives an escape turn.
33 Black Ng8-h6 provisionally leaves Nf6 checking Ke8; held Fatal Attraction on f7 can freeze Nf6.
34 Black instead marks h6, two files from f6; self-check remains, card is spent and underlying Ng8-h6 undone.
35 Black Ng8xf6 legally removes the checking Knight; stale shield token is replaced with capturedOpponent true.
36 Black closes after curing check by capture.
37 White Ra1-a2 moves one square and loses queenside castling rights.
38 White closes its Rook move.
39 Black d5-d4 advances one square.
40 Black closes its Pawn move.
41 White e2-e3 advances one square.
42 White closes its Pawn move.
43 Black Bc8-f5 crosses empty d7 and e6.
44 Black closes its Bishop move.
45 White Ghostwalk Ra2-a6 passes own Pa3, then empty a4/a5; cannot capture; consumes move.
46 White closes Ghostwalk.
47 Black Bf5-g6 slides one diagonal.
48 Black closes its Bishop move.
49 White Bf1-e2 enters the vacated Pawn square.
50 White closes its Bishop move.
51 Black Nb8-c6 jumps into empty c6.
52 Black closes its Knight move.
53 White Be2-h5 crosses empty f3 and g4.
54 White closes its Bishop move.
55 Black b7-b5 crosses b6; forbidden b4 is not crossed; no White EP captor exists.
56 Black closes its Pawn move.
57 White Ra6-a4 crosses empty a5 and avoids forbidden b4.
58 White Peace Talks discards the exact retained Forbidden City; b4 reopens with no illegal pieces.
59 White closes with both Peace Talks and the canceled effect discarded.
60 Black Nf6-g4 jumps into empty g4.
61 Black closes its Knight move.
62 White d2xc3 captures black-queen-d8 diagonally; captor is White.
63 White Panic after its capture gives Black fifteen seconds for the next move; no move clocks advance.
64 White closes; Panic remains due for Black.
65 Black e7-e5 crosses e6, completes Panic in time, and expires that obligation.
66 Black Abduction temporarily removes opposing nonroyal white-rook-a1 at a4 after moving.
67 Reveal changes concealment to recall; physical absence and all accounting remain unchanged.
68 White correctly names its Rook and a4; the same identity returns and the history target becomes public.
69 Black closes once mandatory recall is resolved.
70 White b2-b3 advances one square and expires e6 EP.
71 White closes its Pawn move.
72 Black Ke8-d7 steps to a safe empty square and revokes both Black castle rights.
73 Black closes its King move.
74 White Qd1-c2 slides one diagonal.
75 White closes its Queen move.
76 Black Ng4-f6 jumps to empty f6.
77 Black closes its Knight move.
78 White Qc2-d1 slides back one diagonal.
79 Figure Dance simultaneously sends black Ra8-a1 and Rh8-a8 counterclockwise; no captures or clock advances.
80 White closes; Nb1 still blocks Ra1 from Ke1.
81 Black Bf8-b4 crosses empty e7/d6/c5; b4 is no longer forbidden.
82 Black closes its Bishop move.
83 White Nb1-d2 jumps; Bc1 and Qd1 remain between Ra1 and Ke1.
84 White closes its Knight move.
85 Black Bb4-a5 slides one diagonal.
86 Black closes its Bishop move.
87 White Bc1-b2 slides one diagonal; Qd1 still blocks Ra1-e1.
88 White Man-Trap marks g2 occupied by its own Pawn; retain the physical card.
89 White closes with the secret g2 trap intact.
90 Black Kd7-d8 steps to a safe empty square.
91 Black closes its King move.
92 White b3-b4 advances to the reopened square.
93 White closes its Pawn move.
94 Black Nf6-g4 jumps to empty g4.
95 Black closes its Knight move.
96 White Nd2xc4 captures physical black-pawn-c7; captor White.
97 White closes its capture.
98 Black Doppelganger Ra1-b3 copies the preceding White Knight move type without capture; retains Rook identity.
99 White Knightmare cancels that replacement move, refunds Black physical card/draw/allowance, spends only its own card and forbids exact Ra1-b3 repetition.
100 Black Ra8-c8 crosses empty b8, a different piece and move; cancellation restriction expires.
101 Black closes its replacement ordinary move.
102 White Qd1-c2 provisionally exposes Ra1-e1; held Heresy can move Bb2-b1 to block the ray.
103 Selected Heresy Bb2-a2 fails to block rank one; all Bishop moves and Qd1-c2 roll back, card stays spent.
104 White Nc4xe5 captures Black e7 Pawn while Qd1 continues blocking Ra1.
105 White closes its capture.
106 Black Nc6xe5 captures physical white-knight-b1; captor Black.
107 Black closes its capture.
108 White Ra4xa5 captures physical black-bishop-f8; captor White.
109 White closes its capture.
110 Black a7-a6 advances one square.
111 Black closes its Pawn move.
112 White h3-h4 advances one square below its Bh5.
113 White closes its Pawn move.
114 Black Bg6-d3 crosses empty f5 and e4 diagonally.
115 Black closes its Bishop move.
116 White Qd1-b1 crosses empty c1, remaining between Ra1 and Ke1.
117 White closes its safe Queen move with no pending obligations.
`.trim().split('\n');

const colors = ['white', 'black'] as const;
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const sq = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
const at = (s: GameState, q: string) => s.pieces.find(p => p.zone === 'board' && p.square === q);
const copy = <T>(v: T): T => structuredClone(v);
type Effect = { type: string; square?: string; pieceId?: string; owner?: Color; card?: {id: string; cardId: string} };
const effects = (s: GameState) => s.effects as Effect[];

function geometry(s: GameState, p: PieceState, to: string, capture: boolean): boolean {
  assert.ok(p.square);
  const [x,y] = xy(p.square), [u,v] = xy(to), dx = Math.abs(x-u), dy = Math.abs(y-v);
  if (!dx && !dy || effects(s).some(e => e.type === 'forbidden-city' && e.square === to)) return false;
  if (!p.royal && effects(s).some(e => {
    const m = s.pieces.find(q => q.id === e.pieceId && q.zone === 'board');
    if (e.type !== 'fatal-attraction' || !m?.square || m.id === p.id) return false;
    const [a,b] = xy(m.square); return Math.max(Math.abs(a-x),Math.abs(b-y)) === 1;
  })) return false;
  if (p.role === 'knight') return dx*dy === 2;
  if (p.role === 'king') return Math.max(dx,dy) === 1;
  if (p.role === 'pawn') {
    const d = p.owner === 'white' ? 1 : -1;
    return capture ? dx === 1 && v-y === d : dx === 0 && !at(s,to)
      && (v-y === d || y === (d === 1 ? 1 : 6) && v-y === 2*d && !at(s,sq(x,y+d)));
  }
  if (!(p.role === 'bishop' ? dx === dy : p.role === 'rook' ? dx === 0 || dy === 0 : dx === dy || dx === 0 || dy === 0)) return false;
  const a=Math.sign(u-x), b=Math.sign(v-y);
  for(let i=1;i<Math.max(dx,dy);i++) {
    const q=sq(x+a*i,y+b*i);
    if(at(s,q) || effects(s).some(e=>e.type==='forbidden-city'&&e.square===q)) return false;
  }
  return true;
}
function checked(s: GameState, color: Color): boolean {
  const king=s.pieces.find(p=>p.royal&&p.owner===color&&p.zone==='board'); assert.ok(king?.square);
  return s.pieces.some(p=>p.zone==='board'&&p.owner!==color&&geometry(s,p,king.square!,true));
}
function boardFen(s: GameState): string {
  const names={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,i)=>{
    let row='',empty=0;
    for(let x=0;x<8;x++){const p=at(s,sq(x,7-i));if(!p){empty++;continue;}if(empty){row+=empty;empty=0;}const c=names[p.role];row+=p.owner==='white'?c.toUpperCase():c;}
    return row+(empty||'');
  }).join('/');
}
function refresh(s: GameState) {const f=s.fen.split(' ');f[0]=boardFen(s);s.fen=f.join(' ');}
function safeApply(s: GameState,a: GameAction) {
  const original=copy(s),payload=copy(a),r=applyAction(s,a);assert.deepEqual(s,original,'action input is immutable');assert.deepEqual(a,payload,'action payload is immutable');assert.ok(r.ok,JSON.stringify(a));return r.state;
}
function spend(s: GameState, owner: Color, id: string, retained=false) {
  assert.equal(s.turn.cardPlays[owner],0);const p=s.players[owner],index=p.hand.findIndex(c=>c.id===id);assert.ok(index>=0);
  const card=p.hand.splice(index,1)[0]!;if(!retained)p.discard.push(card);const drawn=p.deck.shift();if(drawn)p.hand.push(drawn);s.turn.cardPlays[owner]++;return card;
}
function regular(s: GameState,from: string,to: string,roleOverride?: 'knight',ghost=false) {
  const p=at(s,from)!;assert.ok(p);assert.equal(p.owner,s.turn.color);const victim=at(s,to);
  if(ghost){assert.equal(p.role,'rook');assert.equal(from,'a2');assert.equal(to,'a6');assert.equal(at(s,'a3')?.owner,'white');assert.ok(!at(s,'a4')&&!at(s,'a5')&&!victim);}
  else assert.ok(geometry(s,roleOverride?{...p,role:roleOverride}:p,to,!!victim),`${p.id} ${from}-${to} geometry`);
  if(victim){assert.notEqual(victim.owner,p.owner);assert.equal(victim.royal,false);victim.square=null;victim.zone='captured';victim.capturedBy=p.owner;}
  const [x,y]=xy(from),[,v]=xy(to),f=s.fen.split(' ');
  s.enPassant=p.role==='pawn'&&Math.abs(v-y)===2?[{target:sq(x,(y+v)/2),pawnId:p.id}]:[];
  p.square=to as SquareName;
  if(p.role==='king')f[2]=f[2]!.replace(p.owner==='white'?/[KQ]/g:/[kq]/g,'');
  const rights:Record<string,string>={a1:'Q',h1:'K',a8:'q',h8:'k'};
  if(p.role==='rook'&&rights[from])f[2]=f[2]!.replace(rights[from]!, '');
  if(victim?.role==='rook'&&rights[to])f[2]=f[2]!.replace(rights[to]!, '');
  f[2]||='-';f[1]=p.owner==='white'?'b':'w';f[3]='-';f[4]=String(p.role==='pawn'||victim?0:Number(f[4])+1);f[5]=String(Number(f[5])+(p.owner==='black'?1:0));s.fen=f.join(' ');refresh(s);
  s.turn.phase='afterMove';s.turn.moveMade=true;s.shieldMove={player:p.owner,pieceIds:[p.id],capturedOpponent:!!victim};delete s.chaosForbidden;
  s.effects=s.effects.filter(e=>(e as Effect).type!=='panic');
  return {p,victim};
}
function verify(actual: GameState, expected: GameState, label: string) {
  for(const key of ['pieces','players','turn','effects','history','fen','enPassant','orientation','outcome'] as const) assert.deepEqual(actual[key],expected[key],`${label} ${key}`);
  for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred','shieldMove'] as const)assert.deepEqual(actual[key],expected[key],`${label} ${key}`);
  for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(actual[key]??[],expected[key]??[],`${label} ${key}`);
  assert.equal(actual.pendingDoomsayer??null,null);
  const royalInput=copy(actual);
  for(const c of colors)assert.equal(isKingInCheck(actual,c),checked(expected,c),`${label} independent ${c} royal attacks`);
  assert.deepEqual(actual,royalInput,'royal queries preserve input');
  // Query the next capturing side before its move; no trace EP opportunity has a legal captor.
  const query=copy(actual);query.turn={color:actual.fen.split(' ')[1]==='w'?'white':'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
  const original=copy(query);
  const destinations=expected.enPassant.length?legalDests(query):new Map<SquareName,SquareName[]>();
  for(const ep of expected.enPassant) for(const p of expected.pieces.filter(p=>p.zone==='board'&&p.role==='pawn'&&p.owner===query.turn.color)) {
    let legal=false;
    if(geometry(expected,p,ep.target,true)&&!at(expected,ep.target)){
      const probe=copy(expected),mover=probe.pieces.find(q=>q.id===p.id)!,victim=probe.pieces.find(q=>q.id===ep.pawnId)!;
      mover.square=ep.target;victim.square=null;victim.zone='captured';legal=!checked(probe,p.owner);
    }
    assert.equal(destinations.get(p.square!)?.includes(ep.target)??false,legal,`${label} prospective EP ${p.square}`);
  }
  assert.deepEqual(query,original,'prospective EP queries preserve input');
}

function closeExpected(s: GameState) {
  assert.equal(s.turn.moveMade,true);assert.equal(checked(s,s.turn.color),false);
  s.turn={color:opposite(s.turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};delete s.shieldMove;delete s.chaosForbidden;
}
function witness(actual: GameState, expected: GameState, n: number) {
  const next=copy(expected), owner=expected.turn.color;
  const a: GameAction=n===33
    ?{type:'playCard',cardId:'fatal-attraction',cardInstanceId:'black-hand-1-fatal-attraction',target:'f7'}
    :{type:'playCard',cardId:'heresy',cardInstanceId:'white-deck-9-heresy',target:[{from:'g6',to:'f6'},{from:'a5',to:'a6'},{from:'b2',to:'b1'},{from:'h5',to:'h4'}]};
  const card=spend(next,owner,a.cardInstanceId as string,n===33);
  if(n===33){
    assert.equal(at(next,'f7')?.id,'black-pawn-f7');assert.equal(at(next,'f6')?.id,'white-knight-g1');
    next.effects.push({type:'fatal-attraction',owner,card,pieceId:'black-pawn-f7'});
    next.history.push({type:'cardPlayed',cardId:a.cardId,target:'f7',movement:[],preservePreviousMove:true});
  }else{
    const moves=a.target as Array<{from:SquareName;to:SquareName}>;
    assert.deepEqual(next.pieces.filter(p=>p.zone==='board'&&p.role==='bishop').map(p=>p.square).sort(),['a5','b2','g6','h5']);
    for(const m of moves){const p=at(next,m.from)!;assert.equal(p.role,'bishop');assert.ok(!at(next,m.to));const [x,y]=xy(m.from),[u,v]=xy(m.to);assert.equal(Math.abs(x-u)+Math.abs(y-v),1);p.square=m.to;}
    next.history.push({type:'cardPlayed',cardId:'heresy',target:moves,movement:moves,preservePreviousMove:true});refresh(next);
    assert.equal(at(next,'b1')?.id,'white-bishop-c1');
  }
  assert.equal(checked(next,owner),false,'independent complete cure royal safety');
  const cured=safeApply(actual,a);verify(cured,next,`rescue ${n}`);assert.equal(cured.pendingRescue??null,null);
  const closed=safeApply(cured,{type:'endTurn'});closeExpected(next);verify(closed,next,`rescue ${n} closure`);assert.equal(closed.pendingRescue??null,null);
}

test('iteration 181: 117 numbered actions, independent board/cards/royals/obligations',()=>{
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/181.json',import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.seed,860181);assert.equal(trace.steps.length,117);assert.equal(rationales.length,117);
  let actual=createGameState(trace.initial), expected=copy(actual);
  const checkpoints=new Map<number,GameState>(), inputs=new Map<number,GameState>();
  let moveCount=0,cardCount=0;
  for(const [index,{action}] of trace.steps.entries()){
    const n=index+1,label=rationales[index]!;assert.ok(label.startsWith(`${n} `));
    checkpoints.set(n,copy(expected));inputs.set(n,actual);
    let expectedPending: GameState['pendingRescue']=null;
    if(action.type==='move'){
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to;assert.match(from,/^[a-h][1-8]$/);assert.match(to,/^[a-h][1-8]$/);assert.equal(action.promotion,undefined);
      assert.equal(expected.turn.phase,'beforeMove');assert.equal(expected.turn.moveMade,false);
      const previous=copy(expected),{p,victim}=regular(expected,from,to);moveCount++;
      const event:GameEvent={type:'move',from:from as SquareName,to:to as SquareName};
      if(victim)event.capturedId=victim.id;
      if(p.owner==='black'){event.movedPieceId=p.id;event.movedRoles=[p.role];}
      expected.history.push(event);
      if(n===33||n===102)expectedPending={fen:previous.fen,pieces:previous.pieces,enPassant:previous.enPassant,historyLength:previous.history.length,movedPieceIds:[p.id]};
      else assert.equal(checked(expected,p.owner),false,label);
    }else if(action.type==='endTurn'){
      assert.equal(actual.pendingAbduction??null,null);assert.equal(actual.pendingRescue??null,null);closeExpected(expected);
    }else if(action.type==='playCard'){
      cardCount++;
      const owner:Color=n===99?'white':expected.turn.color;
      assert.equal(expected.turn.phase,[13,26,30,45,98].includes(n)?'beforeMove':'afterMove');
      const card=expected.players[owner].hand.find(c=>c.id===action.cardInstanceId);assert.ok(card);assert.equal(card.cardId,action.cardId);
      const known:Record<number,[string,string,unknown]>={
        13:['bombard','white-hand-2-bombard',[{from:'h1',to:'g1'}]],
        22:['forbidden-city','white-hand-1-forbidden-city','b4'],
        26:['guardian','white-deck-0-guardian',[{from:'a2',to:'a3'}]],
        30:['disintegration','white-deck-2-disintegration','f2'],
        34:['fatal-attraction','black-hand-1-fatal-attraction','h6'],
        45:['ghostwalk','white-hand-4-ghostwalk',[{from:'a2',to:'a6'}]],
        58:['peace-talks','white-hand-0-peace-talks','white-hand-1-forbidden-city'],
        63:['panic','white-deck-5-panic',undefined],66:['abduction','black-hand-0-abduction','a4'],
        79:['figure-dance','white-deck-3-figure-dance',[]],88:['man-trap','white-hand-3-man-trap','g2'],
        98:['doppelganger','black-hand-4-doppelganger',[{from:'a1',to:'b3'}]],99:['knightmare','white-deck-8-knightmare',undefined],
        103:['heresy','white-deck-9-heresy',[{from:'g6',to:'f6'},{from:'a5',to:'a6'},{from:'b2',to:'a2'},{from:'h5',to:'h4'}]],
      };
      assert.deepEqual([action.cardId,action.cardInstanceId,action.target],known[n],label);
      spend(expected,owner,card.id,n===22||n===88);
      if([13,26,45,98].includes(n)){
        const moves=action.target as Array<{from:SquareName;to:SquareName}>;
        if(n===13)assert.equal(at(expected,'h1')?.role,'rook');
        if(n===26)assert.equal(at(expected,'a2')?.role,'pawn');
        if(n===98){assert.equal(at(expected,'a1')?.role,'rook');assert.equal(expected.history.at(-1)?.type,'move');assert.equal(at(expected,'c4')?.role,'knight');}
        regular(expected,moves[0]!.from,moves[0]!.to,n===98?'knight':undefined,n===45);expected.enPassant=[];
        expected.history.push({type:'cardPlayed',cardId:card.cardId,target:moves,movement:moves,preservePreviousMove:false});
      }else if(n===22){
        assert.ok(!at(expected,'b4'));expected.effects.push({type:'forbidden-city',owner,card,square:'b4'});expected.history.push({type:'cardPlayed',cardId:card.cardId,target:'b4'});
      }else if(n===30){
        const p=at(expected,'f2')!;assert.equal(p.owner,'white');assert.equal(p.role,'pawn');p.zone='dead';p.square=null;delete p.capturedBy;
        const f=expected.fen.split(' ');f[3]='g6';expected.fen=f.join(' ');refresh(expected);delete expected.shieldMove;
        expected.history.push({type:'cardPlayed',cardId:card.cardId,target:'f2',movement:[],preservePreviousMove:false});
      }else if(n===34||n===103){
        const spent=expected.players,shield=expected.shieldMove,plays=expected.turn.cardPlays;
        // These targets do not cure: h6 is not adjacent to f6; a2 does not block rank one.
        if(n===34){const probe=copy(expected);probe.effects.push({type:'fatal-attraction',owner,card,pieceId:'black-knight-g8'});assert.equal(checked(probe,'black'),true);}
        else{const probe=copy(expected);for(const m of action.target as Array<{from:string;to:SquareName}>){const p=at(probe,m.from)!;assert.equal(p.role,'bishop');assert.ok(!at(probe,m.to));const [x,y]=xy(m.from),[u,v]=xy(m.to);assert.equal(Math.abs(x-u)+Math.abs(y-v),1);p.square=m.to;}assert.equal(checked(probe,'white'),true);}
        expected=copy(checkpoints.get(n-1)!);expected.players=spent;expected.turn.cardPlays=plays;expected.shieldMove=shield;
        expected.history.push({type:'cardFizzled',cardId:card.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false});
      }else if(n===58){
        const effect=effects(expected).find(e=>e.card?.id==='white-hand-1-forbidden-city')!;assert.equal(effect.type,'forbidden-city');expected.players.white.discard.push(effect.card!);expected.effects=[];
        expected.history.push({type:'cardPlayed',cardId:card.cardId,movement:[],preservePreviousMove:true});
      }else if(n===63){
        expected.effects.push({type:'panic',owner:'white',player:'black',durationMs:15000});expected.history.push({type:'cardPlayed',cardId:card.cardId,movement:[],preservePreviousMove:true});
      }else if(n===66){
        const p=at(expected,'a4')!;assert.equal(p.id,'white-rook-a1');assert.equal(p.royal,false);p.zone='away';p.square=null;refresh(expected);
        expected.history.push({type:'cardPlayed',cardId:card.cardId,movement:[],preservePreviousMove:true});
      }else if(n===79){
        const a=at(expected,'a8')!,h=at(expected,'h8')!;assert.equal(a.id,'black-rook-a8');assert.equal(h.id,'black-rook-h8');assert.ok(!at(expected,'a1')&&!at(expected,'h1'));a.square='a1';h.square='a8';refresh(expected);
        expected.history.push({type:'cardPlayed',cardId:card.cardId,target:[],movement:[{from:'a8',to:'a1'},{from:'h8',to:'a8'}],preservePreviousMove:true});
      }else if(n===88){
        assert.equal(at(expected,'g2')?.owner,'white');expected.effects.push({type:'man-trap',owner,card,square:'g2'});expected.history.push({type:'cardPlayed',cardId:card.cardId,movement:[],preservePreviousMove:true});
      }else if(n===99){
        const white=expected.players.white;expected=copy(checkpoints.get(98)!);expected.players.white=white;expected.turn.cardPlays.white=1;
        expected.chaosForbidden={player:'black',movement:'black-rook-a8:a1:b3'};delete expected.shieldMove;
        expected.history.push({type:'cardPlayed',cardId:'knightmare',player:'white',movement:[{from:'b3',to:'a1'}],preservePreviousMove:true});
      }else assert.fail(`unreviewed card ${n}`);
    }else if(action.type==='revealAbduction'){
      assert.equal(n,67);assert.equal(actual.pendingAbduction?.phase,'concealment');
    }else if(action.type==='answerAbduction'){
      assert.equal(n,68);assert.deepEqual(action,{type:'answerAbduction',player:'white',owner:'white',role:'rook',square:'a4',pieceId:'white-rook-a1'});
      const p=expected.pieces.find(p=>p.id==='white-rook-a1')!;assert.equal(p.zone,'away');p.zone='board';p.square='a4';refresh(expected);expected.history.at(-1)!.target='a4';
    }else assert.fail(`unreviewed action ${n}`);
    const before=actual;actual=safeApply(actual,action);verify(actual,expected,label);
    if(expectedPending){
      assert.deepEqual({...actual.pendingRescue,before:undefined},{...expectedPending,before:undefined},label);
      assert.deepEqual(actual.pendingRescue!.before,before);witness(actual,expected,n);
    }else assert.equal(actual.pendingRescue??null,null,label);
    if(n===66||n===67){
      const pending=actual.pendingAbduction!;assert.deepEqual({...pending,before:undefined},{phase:n===66?'concealment':'recall',player:'white',durationMs:10000,pieceId:'white-rook-a1',requiresPieceId:false,before:undefined});
      assert.deepEqual(pending.before,inputs.get(66));
    }else assert.equal(actual.pendingAbduction??null,null,label);
    if(n===34||n===103){
      // A historical shield token must not itself authorize an after-move card.
      const probe=copy(actual);probe.turn.cardPlays[probe.turn.color]=0;
      probe.players[probe.turn.color].hand.push({id:'timing-probe',cardId:'mystic-shield'});
      const target=n===34?'g8':'d1';assert.equal(at(probe,target)?.id,probe.shieldMove!.pieceIds[0]);
      const a:GameAction={type:'playCard',cardId:'mystic-shield',cardInstanceId:'timing-probe',target};
      const original=copy(probe),payload=copy(a),r=applyAction(probe,a);
      assert.deepEqual(probe,original);assert.deepEqual(a,payload);assert.equal(r.ok,false,'inert movement token does not reopen afterMove permission');
      if(!r.ok)assert.equal(r.error.code,'INVALID_TIMING');
    }
  }
  assert.equal(moveCount,50);assert.equal(cardCount,14);
  assert.equal(actual.fen,'2rk4/5p1p/p7/Rp2n1pB/1P1p2nP/P1PbP3/1B4P1/rQ2K1R1 b - - 2 26');
});
