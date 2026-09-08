import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameEvent, GameState, PieceState, SquareName } from '../types.js';

// Explicit sequential review; suffixes describe the physical rule, not reducer acceptance.
const rationales = `
1 d2-d4: initial Pawn double step across empty d3.
2 End White turn; d3 opportunity survives, no adjacent Black captor.
3 a7-a6: Black Pawn advances one empty square.
4 End Black turn; no residual en-passant opportunity.
5 d4-d5: White Pawn advances one empty square.
6 End White turn with both royals safe.
7 b7-b5: Black Pawn double step through empty b6.
8 End Black turn; White has no Pawn on a5 or c5 to capture en passant.
9 Assassin: h1 Rook captures owned h2 Pawn; White is captor, kingside rights expire.
10 End replacement-move turn; Assassin allowance resets.
11 g8-f6: Knight jumps to an empty square.
12 Challenge names movable opposing b2 Pawn after Black move.
13 Challenge persists into White turn and constrains physical b2 Pawn.
14 b2-b3: challenged Pawn moves one square, satisfying obligation.
15 Think Again restores b2 Pawn, clock, and Challenge; forbids exactly b2-b3.
16 b2-b4: different double step satisfies restored Challenge; b3 remains prohibited only until completion.
17 End White turn; no Black Pawn adjacent to b4 for en passant.
18 c7-c6: Black Pawn advances one square.
19 End Black turn with clocks unchanged.
20 g1-f3: Knight jumps to empty f3.
21 Curse binds opposing c8 Bishop after White move; limits it to two squares.
22 End White turn, retaining Curse physical card beside board.
23 Evil Eye: f6 Knight legally threatens d5 Pawn; capture only d5 Pawn, Knight stays f6.
24 End Black replacement turn with no check.
25 Fanatic: c2 Pawn travels c3,c4,c5, all empty; no en passant created.
26 End White replacement turn.
27 a6-a5: Black Pawn advances one square.
28 Heresy: White Bishops c1-c2/f1-g1 first, then Black c8-c7/f8-g8; all adjacent empty opposite colors.
29 End Black turn; Bishop identities and Curse preserved.
30 b1-d2: Knight jump to empty d2.
31 End White turn.
32 d7-d6: Black Pawn advances one square.
33 End Black turn.
34 Irresistible Force: f2 Pawn pushes own f3 Knight into empty f4, then occupies f3.
35 End White replacement turn; no capture or en passant.
36 a5-b4: Black Pawn diagonally captures physical White b2 Pawn.
37 End Black capture turn.
38 g2-g3: White Pawn advances one square.
39 End White turn.
40 a8-a4: Rook traverses vacant a7,a6,a5; Black queenside rights expire.
41 Mystic Shield names that exact moved a4 Rook for the next opposing turn.
42 End Black turn; Rook protection persists during White turn.
43 f4-d5: Knight jumps to empty d5; protected Rook is not captured.
44 End White turn; Mystic Shield protection expires.
45 a4-a5: Rook moves one vacant square.
46 End Black turn.
47 h2-g2: Rook moves one vacant square.
48 End White turn.
49 a5-a4: Rook moves one vacant square.
50 Fortification puts one wall across d5-e5, preserving completed Rook move.
51 End Black turn; wall persists.
52 Breakthrough c5-c6 captures the opposing c7 Pawn directly ahead; wall is elsewhere.
53 End White replacement capture turn.
54 b8-a6: Knight jump to vacant a6.
55 End Black turn.
56 Split Knight: d5 Knight threatens b4 Pawn and f6 Knight by legal jumps; all three captured by White.
57 End White replacement capture turn.
58 a6-c5: Knight jumps to vacant c5.
59 End Black turn.
60 c2-b3: Bishop travels one vacant diagonal square.
61 End White turn.
62 Confabulation: d8 Queen moves diagonally onto owned e7 Pawn; Pawn anchors, Queen remains attached away.
63 End Black replacement turn; combined Pawn/Queen powers retained.
64 d2-c4: Knight jump to vacant c4.
65 End White turn.
66 c7-a5: cursed Bishop travels two diagonals through empty b6.
67 End Black turn.
68 c4-a3: Knight jump to vacant a3.
69 End White turn.
70 a4-g4: Rook passes vacant b4,c4,d4,e4,f4; wall is on rank five.
71 End Black turn.
72 b3-e6: Bishop passes vacant c4,d5; diagonal d5-e6 does not cross d5-e5 wall.
73 End White turn.
74 g4-a4: Rook passes empty f4,e4,d4,c4,b4.
75 End Black turn.
76 e6-f5: Bishop moves one vacant diagonal square.
77 End White turn.
78 a5-c7: cursed Bishop moves two squares through empty b6.
79 End Black turn.
80 d1-c2: Queen moves one vacant diagonal square.
81 End White turn.
82 a4-d4: Rook passes empty b4,c4.
83 End Black turn.
84 c2-c3: Queen moves one vacant file square.
85 End White turn.
86 e7-e3: Pawn/Queen composite uses Queen file power through empty e6,e5,e4; Pawn clock resets.
87 End Black turn; White e2 Pawn blocks composite file threat to e1 King.
88 a1-b1: Rook moves one vacant square; White queenside rights expire.
89 End White turn.
90 Tournament swaps Black c5 Knight and White a3 Knight, consuming move without an arrival trigger.
91 End Black replacement turn.
92 c5-a4: White Knight jumps to vacant a4.
93 End White turn.
94 a3-c2: Black Knight jumps to vacant c2 and checks e1 King.
95 End Black turn; White must answer c2 Knight check.
96 Disintegration makes owned c6 Pawn dead, not captured; pre-existing Knight check remains for the available Regular Move.
97 e1-f1: King escapes c2 Knight check onto safe f1; no promotion or castling.
98 End White turn after its available ordinary move.
99 e3-d3: Pawn/Queen composite uses Queen rank power one square, resetting Pawn clock.
100 End Black turn.
101 c3-a5: Queen passes vacant b4 to empty a5.
102 End White turn.
103 c2-a3: Knight jumps to vacant a3.
104 End Black turn.
105 f5-g4: Bishop moves one vacant diagonal square.
106 End White turn.
107 a3-c2: Knight jumps to vacant c2.
108 End Black turn.
109 a4-c3: Knight jumps to vacant c3.
110 Haunting Memories copies latest nonunique Disintegration, killing owned f3 Pawn after move; clocks preserved.
111 End White turn; both discarded physical cards remain distinct.
112 c7-a5: cursed Bishop crosses empty b6 and captures White Queen, within two-square limit.
113 End Black capture turn.
114 Passing in the Night swaps a2/f7 and g3/d6 Pawn pairs simultaneously; f7 Pawn checks e8, whose d8 escape is safe.
115 End White replacement turn; Black is checked but has d8 escape.
116 e8-d8: Black King escapes f7 Pawn check, revoking last castling right.
117 End Black escape turn.
118 d6-d7: White Pawn advances one empty square, without promotion.
119 End White turn; d7 Pawn attacks c8/e8, not d8 King.
120 d3-e3: composite uses Queen rank power; e2 Pawn still blocks e-file attack.
121 End Black turn.
122 g1-f2: White Bishop moves one vacant diagonal square; e3 composite attacks Bishop, not f1 King.
123 End White turn.
124 d4-f4: Black Rook crosses vacant e4, stopping before g4 Bishop.
125 End Black turn; f2 Bishop blocks Rook file attack on f1 King.
`.trim().split('\n');

const cards: Record<number, [string, string, unknown, boolean]> = {
  9: ['assassin', 'white-hand-4-assassin', [{from:'h1',to:'h2'}], true],
  12: ['challenge', 'black-hand-1-challenge', 'b2', false],
  15: ['think-again', 'black-deck-0-think-again', undefined, false],
  21: ['curse', 'white-hand-2-curse', 'c8', false],
  23: ['evil-eye', 'black-hand-2-evil-eye', {attacker:'f6',victim:'d5'}, true],
  25: ['fanatic', 'white-hand-3-fanatic', 'c2', true],
  28: ['heresy', 'black-deck-2-heresy', [{from:'c1',to:'c2'},{from:'f1',to:'g1'},{from:'c8',to:'c7'},{from:'f8',to:'g8'}], false],
  34: ['irresistible-force', 'white-hand-0-irresistible-force', [{from:'f2',to:'f3'}], true],
  41: ['mystic-shield', 'black-hand-4-mystic-shield', 'a4', false],
  50: ['fortification', 'black-deck-4-fortification', {from:'d5',to:'e5'}, false],
  52: ['breakthrough', 'white-deck-2-breakthrough', [{from:'c5',to:'c6'}], true],
  56: ['split-knight', 'white-deck-3-split-knight', {knight:'d5',targets:['b4','f6']}, true],
  62: ['confabulation', 'black-hand-3-confabulation', [{from:'d8',to:'e7'}], true],
  90: ['tournament', 'black-deck-5-tournament', {own:'c5',opponent:'a3'}, true],
  96: ['disintegration', 'white-deck-0-disintegration', 'c6', false],
  110: ['haunting-memories', 'white-deck-4-haunting-memories', 'f3', false],
  114: ['passing-in-the-night', 'white-deck-5-passing-in-the-night', [{from:'a2',to:'f7'},{from:'g3',to:'d6'}], true],
};

const sq = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName; };
const xy = (s: string) => [s.charCodeAt(0)-97, Number(s[1])-1] as const;
const other = (c: Color): Color => c === 'white' ? 'black' : 'white';

// Independent geometry supports exactly the powers present in this trace.
function reaches(pieces: PieceState[], p: PieceState, to: string, step: number, capture: boolean): boolean {
  const [x,y]=xy(p.square!), [tx,ty]=xy(to), dx=tx-x, dy=ty-y;
  const ax=Math.abs(dx), ay=Math.abs(dy), at=(s:string)=>pieces.find(q=>q.square===s && q.zone==='board');
  if (!ax && !ay) return false;
  if (step>=21 && p.id==='black-bishop-c8' && Math.max(ax,ay)>2) return false;
  const role=step>=62 && p.id==='black-pawn-e7' ? 'queen' : p.role;
  if(role==='knight') return ax*ay===2;
  if(role==='king') return Math.max(ax,ay)===1;
  if(role==='pawn') {
    const d=p.owner==='white'?1:-1;
    if(capture) return ax===1 && dy===d;
    return dx===0 && !at(to) && (dy===d || dy===2*d && y===(d===1?1:6) && !at(String.fromCharCode(x+97)+(y+d+1)));
  }
  if (!(role==='rook' && (dx===0||dy===0) || role==='bishop' && ax===ay || role==='queen' && (dx===0||dy===0||ax===ay))) return false;
  let prev=p.square!;
  for(let n=1;n<=Math.max(ax,ay);n++) {
    const s=String.fromCharCode(x+Math.sign(dx)*n+97)+(y+Math.sign(dy)*n+1);
    if(step>=50 && ((prev==='d5'&&s==='e5')||(prev==='e5'&&s==='d5'))) return false;
    if(s!==to && at(s)) return false;
    prev=sq(s);
  }
  return true;
}
function check(pieces: PieceState[], color: Color, step: number): boolean {
  const king=pieces.find(p=>p.royal && p.owner===color)!;
  return pieces.some(p=>p.zone==='board' && p.owner!==color
    && !([12,13,15].includes(step) && p.owner==='white' && p.id!=='white-pawn-b2')
    && reaches(pieces,p,king.square!,step,true));
}
function boardFen(pieces: PieceState[]): string {
  const symbols={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  return Array.from({length:8},(_,rank)=>{
    let row='',empty=0;
    for(let file=0;file<8;file++) {
      const p=pieces.find(p=>p.zone==='board'&&p.square===String.fromCharCode(97+file)+(8-rank));
      if(!p) empty++; else { if(empty) row+=empty; empty=0; const ch=symbols[p.role];row+=p.owner==='white'?ch.toUpperCase():ch; }
    }
    return row+(empty||'');
  }).join('/');
}

test('iteration 175 independently reviews every action and physical consequence', () => {
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/175.json',import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.steps.length,125); assert.equal(trace.moves,50); assert.equal(rationales.length,125);
  let state=createGameState(trace.initial), expected=structuredClone(state);
  let rights='KQkq', half=0, full=1, active='w';
  let rollback: GameState | undefined;
  const at=(square:string)=>{const p=expected.pieces.find(p=>p.square===square&&p.zone==='board');assert.ok(p,square);return p;};
  const move=(from:string,to:string)=>{const p=at(from);p.square=sq(to);return p;};
  const remove=(square:string,zone:'dead'|'captured',captor?:Color)=>{const p=at(square);p.square=null;p.zone=zone;if(captor)p.capturedBy=captor;else delete p.capturedBy;return p;};
  for(const [i,{action}] of trace.steps.entries()) {
    const n=i+1, reason=rationales[i]!; assert.ok(reason.startsWith(`${n} `));
    const old=structuredClone(state), actor=expected.turn.color;
    let event: GameEvent | undefined, consumed=false, reset=false;
    let moved: string[] | undefined, capture=false;
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from,to=action.to,p=at(from),victim=expected.pieces.find(q=>q.square===to&&q.zone==='board');
      assert.ok(reason.startsWith(`${n} ${from}-${to}:`)); assert.equal(p.owner,actor);
      assert.ok(reaches(expected.pieces,p,to,n-1,!!victim),reason);
      if([14,16].includes(n)) assert.equal(p.id,'white-pawn-b2');
      assert.equal(action.promotion,undefined);
      if(n===14) rollback=structuredClone(expected);
      if(victim){assert.equal(victim.owner,other(actor));remove(to,'captured',actor);capture=true;}
      moved=[p.id]; if(n>=62&&p.id==='black-pawn-e7')moved.push('black-queen-d8');
      event={type:'move',from:sq(from),to:sq(to),...(victim?{capturedId:victim.id}:{})};
      if(actor==='black')Object.assign(event,{movedPieceId:p.id,movedRoles:moved.map(id=>expected.pieces.find(q=>q.id===id)!.role)});
      const [x,y]=xy(from),[,ty]=xy(to);
      expected.enPassant=p.role==='pawn' && Math.abs(ty-y)===2 && from[0]===to[0]
        ? [{target:sq(String.fromCharCode(x+97)+(y+Math.sign(ty-y)+1)),pawnId:p.id}]:[];
      reset=p.role==='pawn'||capture; move(from,to);consumed=true;
      if(n===40)rights=rights.replace('q','');if(n===88)rights=rights.replace('Q','');if(n===116)rights=rights.replace('k','');
      if([14,16].includes(n))expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='challenge');
      delete expected.chaosForbidden;
    } else if(action.type==='playCard') {
      const [id,instance,target,replaces]=cards[n]!;
      assert.deepEqual(action,{type:'playCard',cardId:id,cardInstanceId:instance,...(target===undefined?{}:{target})});
      const owner:Color=instance.startsWith('white')?'white':'black';
      assert.equal(expected.turn.cardPlays[owner],0);
      assert.equal(owner,n===15?other(actor):actor);
      assert.equal(expected.turn.phase,[12,15,21,28,41,50,110].includes(n)?'afterMove':'beforeMove');
      const player=expected.players[owner],card=player.hand.find(c=>c.id===instance);assert.ok(card);assert.equal(card.cardId,id);
      player.hand=player.hand.filter(c=>c.id!==instance);player.hand.push(player.deck.shift()!);
      if(![21,50,62].includes(n))player.discard.push(card);
      expected.turn.cardPlays[owner]++;
      event={type:'cardPlayed',cardId:id,...(target===undefined?{}:{target:target as GameEvent['target']})};
      const movement: Array<{from:SquareName;to:SquareName}>=[];
      const relocate=(from:string,to:string)=>{movement.push({from:sq(from),to:sq(to)});return move(from,to);};
      switch(n) {
        case 9: remove('h2','captured','white');moved=[relocate('h1','h2').id];event.capturedId='white-pawn-h2';rights=rights.replace('K','');reset=true;break;
        case 12: expected.effects.push({type:'challenge',owner:'black',player:'white',pieceId:'white-pawn-b2'});break;
        case 15: {
          assert.ok(rollback); expected.pieces=structuredClone(rollback.pieces);expected.effects=structuredClone(rollback.effects);
          expected.enPassant=structuredClone(rollback.enPassant);expected.history=structuredClone(rollback.history);
          expected.turn.phase='beforeMove';expected.turn.moveMade=false;half=1;active='w';
          expected.chaosForbidden={player:'white',movement:'white-pawn-b2:b2:b3'};delete expected.shieldMove;
          movement.push({from:'b3',to:'b2'});event.player='black';break;
        }
        case 21:expected.effects.push({type:'curse',owner:'white',card,pieceId:'black-bishop-c8'});break;
        case 23:assert.ok(reaches(expected.pieces,at('f6'),'d5',n,true));remove('d5','captured','black');event.capturedId='white-pawn-d2';event.capturedIds=['white-pawn-d2'];moved=[];capture=true;reset=true;break;
        case 25: for(const square of ['c3','c4','c5'])assert.ok(!expected.pieces.some(p=>p.square===square));moved=[relocate('c2','c5').id];reset=true;break;
        case 28: for(const [from,to] of [['c1','c2'],['f1','g1'],['c8','c7'],['f8','g8']]){assert.equal(at(from!).role,'bishop');assert.ok(!expected.pieces.some(p=>p.square===to));relocate(from!,to!);}break;
        case 34:moved=[relocate('f3','f4').id,relocate('f2','f3').id];reset=true;break;
        case 41:assert.deepEqual(expected.shieldMove,{player:'black',pieceIds:['black-rook-a8'],capturedOpponent:false});expected.effects.push({type:'mystic-shield',owner:'black',player:'black',pieceId:'black-rook-a8'});event.player='black';break;
        case 50:expected.effects.push({type:'fortification',owner:'black',card,from:'d5',to:'e5'});break;
        case 52:remove('c6','captured','white');moved=[relocate('c5','c6').id];event.capturedId='black-pawn-c7';capture=true;reset=true;break;
        case 56:for(const square of ['b4','f6'])assert.ok(reaches(expected.pieces,at('d5'),square,n,true));event.capturedIds=['black-pawn-a7','black-knight-g8','white-knight-g1'];for(const square of ['b4','f6','d5'])remove(square,'captured','white');moved=[];capture=true;reset=true;break;
        case 62: {const q=at('d8');assert.ok(reaches(expected.pieces,q,'e7',n-1,false));q.square=null;q.zone='away';expected.effects.push({type:'confabulation',owner:'black',card,pieceIds:['black-pawn-e7','black-queen-d8']});movement.push({from:'d8',to:'e7'});moved=[q.id];break;}
        case 90: {const white=at('a3'),black=at('c5');white.square='c5';black.square='a3';movement.push({from:'a3',to:'c5'},{from:'c5',to:'a3'});moved=[];break;}
        case 96:remove('c6','dead');break;
        case 110:remove('f3','dead');event.copiedCardId='disintegration';event.player='white';assert.equal(expected.history.filter(e=>e.type==='cardPlayed').at(-1)!.cardId,'disintegration');break;
        case 114: {const a=at('a2'),g=at('g3'),d=at('d6'),f=at('f7');a.square='f7';g.square='d6';d.square='g3';f.square='a2';movement.push({from:'a2',to:'f7'},{from:'g3',to:'d6'},{from:'d6',to:'g3'},{from:'f7',to:'a2'});moved=[];reset=true;break;}
        default:assert.fail(`unreviewed card ${n}`);
      }
      if(n!==50)Object.assign(event,{movement,preservePreviousMove:[12,15,21,28,41,110].includes(n)});
      consumed=replaces;if(replaces)expected.enPassant=[];
    } else {
      assert.equal(action.type,'endTurn');assert.ok(expected.turn.moveMade);assert.equal(check(expected.pieces,actor,n),false,reason);
      expected.turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      delete expected.shieldMove;if(n===44)expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='mystic-shield');
    }
    if(consumed){expected.turn.phase='afterMove';expected.turn.moveMade=true;half=reset?0:half+1;if(actor==='black')full++;active=actor==='white'?'b':'w';}
    if(moved)expected.shieldMove={player:actor,pieceIds:moved,capturedOpponent:capture};
    if(event)expected.history.push(event);
    expected.fen=`${boardFen(expected.pieces)} ${active} ${rights||'-'} - ${half} ${full}`;
    const result=applyAction(state,action);assert.deepEqual(state,old,`${n} input immutability`);assert.ok(result.ok,reason);state=result.state;
    assert.deepEqual(state.pieces,expected.pieces,`${n} exact physical pieces and captors`);
    assert.equal(state.fen,expected.fen,`${n} six FEN fields`);assert.deepEqual(state.turn,expected.turn,`${n} turn and allowances`);
    assert.deepEqual(state.players,expected.players,`${n} exact physical card zones`);assert.deepEqual(state.effects,expected.effects,`${n} full effects`);
    assert.deepEqual(state.history,expected.history,`${n} full history including cancellation`);assert.deepEqual(state.enPassant,expected.enPassant,`${n} en passant`);
    assert.deepEqual(state.shieldMove,expected.shieldMove,`${n} moved identities and capture flag`);assert.deepEqual(state.chaosForbidden,expected.chaosForbidden);
    for(const key of ['plotsExecution','riposteSkipped','riposteCheckDeferred'] as const)assert.equal(state[key],undefined,`${n} ${key}`);
    for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const)assert.deepEqual(state[key]??[],[],`${n} ${key}`);
    assert.equal(state.pendingRescue??null,null,`${n} no provisional check`);assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);assert.equal(state.orientation,0);assert.equal(state.outcome,null);
    for(const color of ['white','black'] as const){const threat=check(expected.pieces,color,n);assert.equal(threat,color==='black'?[114,115].includes(n):[94,95,96].includes(n),`${n} independently enumerated royal attacks`);assert.equal(isKingInCheck(state,color),threat,`${n} public check agrees`);}
    // Every stored opportunity is uncapturable in this trace: inspect prospective captors before querying the API.
    for(const ep of expected.enPassant){const victim=expected.pieces.find(p=>p.id===ep.pawnId)!;const prospective=other(victim.owner);const attackers=expected.pieces.filter(p=>p.zone==='board'&&p.owner===prospective&&p.role==='pawn'&&reaches(expected.pieces,p,ep.target,n,true));assert.deepEqual(attackers,[]);const context=structuredClone(state);context.turn={color:prospective,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};const beforeQuery=structuredClone(context);const dests=legalDests(context);assert.deepEqual(context,beforeQuery,`${n} en-passant query immutability`);for(const p of expected.pieces.filter(p=>p.zone==='board'&&p.owner===prospective&&p.role==='pawn'))assert.ok(!dests.get(p.square!)?.includes(ep.target));}
    if(n===15){const beforeQuery=structuredClone(state);assert.ok(!legalDests(state).get('b2')?.includes('b3'));assert.deepEqual(state,beforeQuery,'15 cancellation query immutability');const beforeProbe=structuredClone(state);const probe=applyAction(state,{type:'move',from:'b2',to:'b3'});assert.equal(probe.ok,false);assert.deepEqual(state,beforeProbe);}
    if(n===114){const escape=structuredClone(expected.pieces);escape.find(p=>p.id==='black-king-e8')!.square='d8';assert.equal(check(escape,'black',n),false,'card gives check, not direct mate: d8 escape');}
  }
  assert.equal(state.fen,'3k2br/3P1Ppp/8/bp6/5rB1/2N1p1p1/p1n1PBR1/1R3K2 w - - 2 30');
});

test('iteration 175 replays its deterministic action trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/175.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(trace.steps.length > 0);
  replayTrace(trace);
});
