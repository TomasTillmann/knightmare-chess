import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Numbered by action, including reactions, cancellations and mandatory choices.
const rationales = `
1 a2-a3 advances the white Pawn one empty square.
2 White closes its completed Pawn move.
3 c7-c5 crosses empty c6; no white Pawn can take en passant.
4 Black closes; c6 opportunity survives until White moves.
5 d2-d3 is a one-square Pawn advance and expires c6.
6 Mystic Shield protects precisely the just-moved d2 Pawn until Black finishes.
7 White closes without expiring its protection early.
8 Qd8-a5 follows empty c7,b6; the d3 Pawn remains protected.
9 Black closes and the Shield expires.
10 Disintegration kills White's own c2 Pawn, leaving its move available.
11 Bc1-d2 moves diagonally to the vacated square.
12 White closes.
13 Annexation moves black d7,h7 Pawns across empty d6,h6 to empty d5,h5; both EP tokens exist.
14 Black closes; no white Pawn is positioned to capture either passed Pawn.
15 Ng1-h3 jumps; Annexation EP opportunities expire.
16 White closes.
17 Qa5-b5 travels one clear rank square.
18 Black closes.
19 Qd1-c2 moves diagonally onto the square vacated by the dead Pawn.
20 White closes.
21 Qb5-d7 crosses empty c6.
22 Black closes.
23 Madman jumps e2-c4 over d3 and c4-e6 over d5; neither hurdle is captured.
24 White closes its replacement move.
25 Ng8-h6 jumps to an empty square.
26 Black closes.
27 f2-f4 crosses empty f3; no black Pawn can capture en passant.
28 White closes.
29 Qd7-c6 takes one diagonal step.
30 Black closes.
31 Bf1-e2 takes one diagonal step.
32 White closes.
33 Qc6-c7 moves along its clear file.
34 Black closes.
35 Qc2xc5 crosses c3,c4 and captures the black c7 Pawn.
36 White closes the capture.
37 Qc7-d7 moves along its clear rank.
38 Black closes.
39 Qc5xd5 captures the Annexation Pawn beside it.
40 Figure Dance relocates the four corner Rooks simultaneously counterclockwise; no capture.
41 Black Fog immediately cancels Figure Dance, restores Rooks and rights, retains Qxd5 and both spent cards.
42 White closes and the Fog card lock expires.
43 b7-b5 crosses empty b6; no white Pawn can take it en passant.
44 Black closes.
45 Nh3-g1 is a legal jump.
46 Black Chaos restores Nh3, the prior clocks and b6 EP token; h3-g1 cannot repeat this turn.
47 Qd5-f3 crosses empty e4, satisfying the different-move requirement.
48 White closes; Black's reaction allowance resets.
49 Qd7-d4 crosses empty d6,d5.
50 Black places Forbidden City on empty c6 after moving, retaining its physical card.
51 Black closes; c6 remains inaccessible.
52 Lost Castle exchanges White a1 and Black h8 Rooks instead of the move; ownership is unchanged.
53 White closes.
54 Bc8xe6 crosses d7 and captures the Madman Pawn.
55 Black closes.
56 Qf3-g3 moves one rank square.
57 White closes.
58 Qd4-d5 moves one file square.
59 Black closes.
60 Qg3-g5 crosses empty g4.
61 Treason swaps opposing Ra8 and Nh6; non-move exchange preserves dormant a8 entitlement, not a usable castle.
62 White closes.
63 Qd5-c5 moves one rank square without entering forbidden c6.
64 Black Holy Quest swaps opposing Be2 and Nb1 with identities intact.
65 Black closes.
66 Qg5xc5 crosses empty f5,e5,d5 and captures Black's Queen.
67 White closes.
68 g7-g6 advances one empty square.
69 Black closes.
70 Under Elf Hill removes White's King temporarily, consumes the move, and revokes White's rights.
71 White closes; its King remains away during Black's turn.
72 Ke8-d8 steps to an unattacked square and revokes Black's remaining entitlement.
73 Black closes; White must return its King before acting.
74 White returns on vacant safe edge square g1 and cannot move that physical King this turn.
75 g2-g4 crosses empty g3; the returned King stays g1.
76 White closes and its King's movement restriction expires.
77 g6-g5 advances the black Pawn one square.
78 Black closes.
79 Fanatic advances White a3-a6 over empty a4,a5,a6 without promotion or EP.
80 White closes the replacement move.
81 Rh6-g6 moves one rank square.
82 Black closes.
83 Long Jump takes Ne2-b6, an empty opposite-color square; forbidden c6 is not entered.
84 White closes the replacement move.
85 Be6-a2 follows empty d5,c4,b3.
86 Black closes.
87 Nb6-d7 jumps; it does not attack the King on d8.
88 White closes.
89 Black Plots preserves before-move eligibility: Split Knight can take d7,c5 from b8; Onslaught can advance e7 or f7.
90 Kd8-e8 steps safely, closing unused Plots allowances.
91 Black closes.
92 Hidden Passage relocates White Kg1-e3 to an empty safe square instead of its move.
93 White closes.
94 Na8-b6 jumps to an empty square.
95 Black Abduction conceals White Qc5 after moving; no capture has occurred yet.
96 Reveal advances only the mandatory recall phase.
97 Timeout captures the concealed Queen for Black, resets the halfmove clock, and reveals c5 in history.
98 Black closes after the mandatory recall resolves.
99 f4xg5 captures the black g7 Pawn diagonally.
100 White closes.
101 Ba2-d5 crosses empty b3,c4.
102 Black closes.
103 Bd2-a5 crosses empty c3,b4.
104 White closes.
105 Ra1-a2 moves one file square.
106 Black Figure Dance moves White Rh8-a8 and Rh1-h8 simultaneously; no capture.
107 Black closes.
108 Rh8-h7 moves one file square.
109 White closes.
110 Bd5-e4 moves diagonally one square.
111 Black closes.
112 Nd7xb8 captures Black's original b8 Knight.
113 White Curse binds Black's a2 Rook identity and retains its physical card.
114 White closes.
115 Be4xd3 captures White's original d2 Pawn; the old Mystic Shield has expired.
116 Black closes.
117 Rh7xf7 crosses g7 and captures Black's f7 Pawn.
118 White closes.
119 Rg6-e6 crosses f6 and gives check down e5,e4 to Ke3.
120 Black may close after giving check.
121 b2-b4 leaves White in check, provisionally legal only because held Dungeon can relocate checking Re6-a1.
122 Vendetta cannot cure the e-file check; it is spent and the provisional Pawn move is restored completely.
123 Ke3-f2 escapes the e-file and avoids Bd3's diagonal, with White's card allowance already consumed.
124 White closes safely.
125 Re6-e1 crosses e5,e4,e3,e2; White Kf2 is not on that file.
126 Black closes.
127 Nh3-f4 jumps to an empty square.
128 White closes its fiftieth sampled Regular Move.
`.trim().split('\n')

const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const sq = (x: number, y: number) => `${String.fromCharCode(97+x)}${y+1}` as SquareName
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white'
function attacks(p: PieceState, target: string, board: PieceState[], effects: unknown[], frozenKing = false): boolean {
  if (!p.square || p.zone !== 'board' || frozenKing && p.id === 'white-king-e1') return false
  const [x,y] = xy(p.square), [tx,ty] = xy(target), dx=tx-x, dy=ty-y
  if (!dx && !dy) return false
  if (effects.some(e => (e as {type:string;pieceId?:string}).type === 'curse' && (e as {pieceId:string}).pieceId === p.id) && Math.max(Math.abs(dx),Math.abs(dy))>2) return false
  if (p.role === 'pawn') return Math.abs(dx)===1 && dy===(p.owner==='white'?1:-1)
  if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy)===2
  if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy))===1
  const diagonal=Math.abs(dx)===Math.abs(dy), straight=dx===0||dy===0
  if (!(p.role==='bishop'?diagonal:p.role==='rook'?straight:diagonal||straight)) return false
  for(let n=1;n<Math.max(Math.abs(dx),Math.abs(dy));n++) {
    const s=sq(x+n*Math.sign(dx),y+n*Math.sign(dy))
    if(board.some(p=>p.square===s) || effects.some(e=>(e as {type:string;square?:string}).type==='forbidden-city'&&(e as {square:string}).square===s)) return false
  }
  return !effects.some(e=>(e as {type:string;square?:string}).type==='forbidden-city'&&(e as {square:string}).square===target)
}
function check(board: PieceState[], effects: unknown[], color: Color, frozenKing=false): boolean {
  const king=board.find(p=>p.royal&&p.owner===color&&p.zone==='board')
  return !!king && board.some(p=>p.owner!==color&&attacks(p,king.square!,board,effects,frozenKing))
}
function boardFen(pieces: PieceState[]): string {
  const symbol={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}
  return Array.from({length:8},(_,i)=>{
    let row='',empty=0
    for(let x=0;x<8;x++) { const p=pieces.find(p=>p.square===sq(x,7-i)); if(!p)empty++;else {if(empty)row+=empty;empty=0;const c=symbol[p.role];row+=p.owner==='white'?c.toUpperCase():c} }
    return row+(empty||'')
  }).join('/')
}
function immutableAction(state: GameState, action: GameAction) {
  const before=structuredClone(state), input=structuredClone(action), result=applyAction(state,action)
  assert.deepEqual(state,before,'action input state immutable');assert.deepEqual(action,input,'action payload immutable')
  return result
}
const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/188.json',import.meta.url),'utf8')) as RandomTrace
const physicalCards: Record<number,string>={
  6:'white-hand-3-mystic-shield',10:'white-hand-4-disintegration',13:'black-hand-3-annexation',23:'white-hand-1-madman',
  40:'white-deck-2-figure-dance',41:'black-hand-0-fog-of-war',46:'black-hand-4-chaos',50:'black-deck-0-forbidden-city',
  52:'white-deck-0-lost-castle',61:'white-hand-2-treason',64:'black-hand-1-holy-quest',70:'white-hand-0-under-elf-hill',
  79:'white-deck-5-fanatic',83:'white-deck-6-long-jump',89:'black-deck-1-plots-within-plots',92:'white-deck-1-hidden-passage',
  95:'black-deck-5-abduction',106:'black-deck-3-figure-dance',113:'white-deck-9-curse',122:'white-deck-10-vendetta',
}

test('188 independent physical, card, royal, history and six-field FEN oracle',()=>{
  assert.equal(rationales.length,128);assert.equal(trace.steps.length,128)
  let state=createGameState(trace.initial), pieces=structuredClone(state.pieces), players=structuredClone(state.players)
  let effects: unknown[]=[], history: GameEvent[]=[], ep: GameState['enPassant']=[], shield: GameState['shieldMove']
  let half=0,full=1,active: Color='white',turn: GameState['turn']=structuredClone(state.turn),rights='KQkq'
  const states: GameState[]=[structuredClone(state)]
  const replacements=[13,23,52,70,79,83,92]
  for(const [index,{action}] of trace.steps.entries()) {
    const n=index+1;assert.ok(rationales[index]!.startsWith(`${n} `))
    const before=state,actor=turn.color,originalPieces=structuredClone(pieces)
    const at=(s:string)=>{const p=pieces.find(p=>p.square===s);assert.ok(p,`${n}: occupied ${s}`);return p}
    const move=(from:string,to:SquareName)=>{const p=at(from);assert.ok(!pieces.some(q=>q.square===to));p.square=to;return p}
    const exchange=(a:string,b:string)=>{const p=at(a),q=at(b);[p.square,q.square]=[q.square,p.square]}
    let event: GameEvent|undefined
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from=action.from,to=action.to;assert.match(from,/^[a-h][1-8]$/);assert.match(to,/^[a-h][1-8]$/)
      const p=at(from),victim=pieces.find(p=>p.square===to),[x,y]=xy(from),[tx,ty]=xy(to)
      assert.equal(p.owner,actor);assert.equal(turn.moveMade,false)
      if(p.role==='pawn'&&!victim){assert.equal(tx,x);assert.ok(ty-y===(actor==='white'?1:-1)||[1,6].includes(y)&&Math.abs(ty-y)===2);assert.ok(!pieces.some(p=>p.square===sq(x,y+Math.sign(ty-y))))}
      else assert.ok(attacks(p,to,pieces,effects,n===75),`${n} geometry`)
      if(victim){assert.equal(victim.owner,opposite(actor));assert.equal(victim.royal,false);victim.square=null;victim.zone='captured';victim.capturedBy=actor}
      p.square=to as SquareName
      ep=p.role==='pawn'&&Math.abs(ty-y)===2?[{target:sq(x,(y+ty)/2),pawnId:p.id}]:[]
      half=p.role==='pawn'||victim?0:half+1;if(actor==='black')full++;active=opposite(actor)
      turn.phase='afterMove';turn.moveMade=true;shield={player:actor,pieceIds:[p.id],capturedOpponent:!!victim}
      event={type:'move',from:from as SquareName,to:to as SquareName,...(victim?{capturedId:victim.id}:{})}
      if(n>=87&&actor==='white'){event.movedPieceId=p.id;event.movedRoles=[p.role]}
      if(n===72)rights='-'
    } else if(action.type==='playCard') {
      assert.equal(action.cardInstanceId,physicalCards[n],`${n} exact reviewed physical card`)
      const owner: Color=[41,46].includes(n)?'black':actor
      const card=players[owner].hand.find(c=>c.id===action.cardInstanceId);assert.ok(card);assert.equal(card.cardId,action.cardId)
      assert.equal(turn.cardPlays[owner],0)
      const def=CARD_CATALOG[card.cardId]!;assert.ok(def.timing.includes(owner===actor?turn.phase:n===41?'afterOpponentCard':'afterOpponentMove'))
      players[owner].hand=players[owner].hand.filter(c=>c.id!==card.id);players[owner].hand.push(players[owner].deck.shift()!)
      if(!def.continuing||n===122)players[owner].discard.push(card)
      turn.cardPlays[owner]++
      event={type:'cardPlayed',cardId:card.cardId,...(action.target!==undefined?{target:action.target as GameEvent['target']}:{})}
      let movement: NonNullable<GameEvent['movement']>=[]
      if(n===6){assert.equal(action.target,'d3');effects.push({type:'mystic-shield',owner:'white',player:'white',pieceId:'white-pawn-d2'});event.player='white'}
      if(n===10){assert.equal(action.target,'c2');const p=at('c2');p.square=null;p.zone='dead'}
      if(n===13){assert.deepEqual(action.target,[{from:'d7',to:'d5'},{from:'h7',to:'h5'}]);move('d7','d5');move('h7','h5');movement=[{from:'d7',to:'d5'},{from:'h7',to:'h5'}];ep=[{target:'d6',pawnId:'black-pawn-d7'},{target:'h6',pawnId:'black-pawn-h7'}]}
      if(n===23){assert.deepEqual(action.target,[{from:'e2',to:'c4'},{from:'c4',to:'e6'}]);at('d3');at('d5');assert.ok(!pieces.some(p=>p.square==='c4'));move('e2','e6');movement=[{from:'e2',to:'e6'}]}
      if(n===40||n===106){assert.deepEqual(action.target,[]);const corners:Record<string,SquareName>={a1:'h1',h1:'h8',h8:'a8',a8:'a1'};for(const p of pieces){if(p.square&&corners[p.square]){movement.push({from:p.square,to:corners[p.square]!});p.square=corners[p.square]!}}if(n===40)rights='-'}
      if(n===41){assert.equal(action.target,undefined);pieces=structuredClone(states[39]!.pieces);rights='KQkq';movement=[{from:'h1',to:'a1'},{from:'h8',to:'h1'},{from:'a1',to:'a8'},{from:'a8',to:'h8'}];event.player='black'}
      if(n===46){assert.equal(action.target,undefined);pieces=structuredClone(states[44]!.pieces);half=0;full=11;active='white';ep=[{target:'b6',pawnId:'black-pawn-b7'}];turn.phase='beforeMove';turn.moveMade=false;shield=undefined;history.pop();movement=[{from:'g1',to:'h3'}];event.player='black'}
      if(n===50){assert.equal(action.target,'c6');assert.ok(!pieces.some(p=>p.square==='c6'));effects.push({type:'forbidden-city',owner,card,square:'c6'})}
      if(n===52){assert.deepEqual(action.target,{own:'a1',opponent:'h8'});exchange('a1','h8');movement=[{from:'a1',to:'h8'},{from:'h8',to:'a1'}];rights='Kq'}
      if(n===61){assert.deepEqual(action.target,{rook:'a8',knight:'h6'});exchange('a8','h6');movement=[{from:'a8',to:'h6'},{from:'h6',to:'a8'}];rights='Ka'}
      if(n===64){assert.deepEqual(action.target,{bishop:'e2',knight:'b1'});exchange('b1','e2');movement=[{from:'b1',to:'e2'},{from:'e2',to:'b1'}]}
      if(n===70){assert.equal(action.target,undefined);const p=at('e1');p.square=null;p.zone='away';rights='a'}
      if(n===79){assert.equal(action.target,'a3');for(const s of ['a4','a5','a6'])assert.ok(!pieces.some(p=>p.square===s));move('a3','a6');movement=[{from:'a3',to:'a6'}]}
      if(n===83){assert.deepEqual(action.target,[{from:'e2',to:'b6'}]);assert.notEqual((4+1)%2,(1+5)%2);move('e2','b6');movement=[{from:'e2',to:'b6'}]}
      if(n===89){assert.deepEqual(action.target,{player:'black'});delete event.target;event.player='black'}
      if(n===92){assert.deepEqual(action.target,[{from:'g1',to:'e3'}]);move('g1','e3');movement=[{from:'g1',to:'e3'}]}
      if(n===95){assert.equal(action.target,'c5');const p=at('c5');p.square=null;p.zone='away';delete event.target}
      if(n===113){assert.equal(action.target,'a2');effects.push({type:'curse',owner,card,pieceId:'black-rook-h8'})}
      if(n===122){assert.equal(action.target,undefined);pieces=structuredClone(states[120]!.pieces);ep=[];half=1;full=27;active='white';turn.phase='beforeMove';turn.moveMade=false;history.pop();event={type:'cardFizzled',cardId:'vendetta',reason:'SELF_CHECK'}}
      if(n!==50){event.movement=movement;event.preservePreviousMove=![10,13,23,52,70,79,83,92,122].includes(n)}
      if(replacements.includes(n)){
        half=[13,23,79].includes(n)?0:half+1;if(actor==='black')full++;active=opposite(actor);turn.phase='afterMove';turn.moveMade=true
        if(n!==13)ep=[]
        shield={player:actor,capturedOpponent:false,pieceIds:[52,70].includes(n)?[]:movement.map(m=>originalPieces.find(p=>p.square===m.from)!.id)}
      }
    } else if(action.type==='endTurn') {
      assert.ok(turn.moveMade);assert.equal(check(pieces,effects,actor,n===76),false)
      turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};shield=undefined
      if(n===9)effects=[]
    } else if(action.type==='returnKing') {
      assert.equal(n,74);assert.equal(action.to,'g1');const p=pieces.find(p=>p.id==='white-king-e1')!;assert.equal(p.zone,'away');p.zone='board';p.square='g1'
    } else if(action.type==='revealAbduction') assert.equal(n,96)
    else if(action.type==='abductionTimeout') {
      assert.equal(n,97);const p=pieces.find(p=>p.id==='white-queen-d1')!;assert.equal(p.zone,'away');p.zone='captured';p.capturedBy='black';half=0
      Object.assign(history.at(-1)!,{target:'c5',capturedIds:[p.id],capturedId:p.id})
    } else assert.fail(`unreviewed action ${n}`)
    if(event)history.push(event)
    const result=immutableAction(before,action);assert.ok(result.ok,`${n}: ${rationales[index]}`);state=result.state
    assert.deepEqual(state.pieces,pieces,`${n} complete physical identity/captor oracle`)
    assert.deepEqual(state.players,players,`${n} physical card spend/draw/retention oracle`)
    assert.deepEqual(state.effects,effects,`${n} complete effects`);assert.deepEqual(state.turn,turn,`${n} allowance`);assert.deepEqual(state.history,history,`${n} history`)
    const fen: string=`${boardFen(pieces)} ${active[0]} ${rights} ${n===121?'b3':'-'} ${half} ${full}`
    assert.equal(state.fen,fen,`${n} six FEN fields`);assert.deepEqual(state.enPassant,ep,`${n} EP records`)
    assert.equal(state.orientation,0);assert.equal(state.outcome,null);assert.equal(state.pendingDoomsayer??null,null)
    assert.deepEqual(state.shieldMove,shield,`${n} full actual-movement token`)
    assert.deepEqual(state.chaosForbidden,n===46?{player:'white',movement:'white-knight-g1:h3:g1'}:undefined)
    assert.deepEqual(state.fogLocked??[],n===41?['white']:[])
    assert.equal(state.plotsExecution,undefined);assert.deepEqual(state.riposteLostMoves??[],[]);assert.equal(state.riposteSkipped,undefined);assert.equal(state.riposteCheckDeferred,undefined)
    assert.deepEqual(state.plotsAllowances??[],n===89?[{player:'black',remaining:2,eligibleCards:['black-hand-2-split-knight','black-deck-2-onslaught'],window:{phase:'beforeMove',moveMade:false,reaction:history.at(-2),capture:undefined,cardResponse:undefined,fogCheckpoint:undefined,legacyCapture:undefined,shieldMove:undefined}}]:[])
    assert.deepEqual(state.underElfHill??[],n>=70&&n<=75?[{pieceId:'white-king-e1',player:'white',returning:n>=73,...(n>=74?{returned:true}:{})}]:[])
    if(n===95||n===96){assert.deepEqual(state.pendingAbduction,{phase:n===95?'concealment':'recall',player:'white',durationMs:10000,pieceId:'white-queen-d1',requiresPieceId:false,before:states[94]})}
    else assert.equal(state.pendingAbduction??null,null)
    const querySnapshot=structuredClone(state)
    for(const color of ['white','black'] as const)assert.equal(isKingInCheck(state,color),check(pieces,effects,color,n>=74&&n<=75),`${n}: independent ${color} royal rays`)
    if(action.type==='playCard'&&n!==122)assert.equal(check(pieces,effects,opposite(actor)),false,`${n}: no card-created checkmate because opponent is not checked`)
    assert.deepEqual(state,querySnapshot,'queries immutable')
    const capturing=structuredClone(state);capturing.turn={color:active,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};capturing.pendingRescue=null
    const capturingSnapshot=structuredClone(capturing),destinations=ep.length||n===46||n===61?legalDests(capturing):new Map<SquareName,SquareName[]>()
    for(const opportunity of ep)for(const pawn of pieces.filter(p=>p.zone==='board'&&p.owner===active&&p.role==='pawn')){
      if(!attacks(pawn,opportunity.target,pieces,effects))continue
      const simulated=structuredClone(pieces),p=simulated.find(p=>p.id===pawn.id)!,victim=simulated.find(p=>p.id===opportunity.pawnId)!
      p.square=opportunity.target;victim.square=null;victim.zone='captured'
      assert.equal(!!destinations.get(pawn.square!)?.includes(opportunity.target),!check(simulated,effects,active),`${n} prospective legal EP`)
    }
    assert.deepEqual(capturing,capturingSnapshot,'prospective EP query immutable')
    if(n===61){assert.ok(!destinations.get('e8')?.includes('a8'));assert.ok(!destinations.get('e8')?.includes('c8'))}
    if(n===46){assert.equal(immutableAction(state,{type:'move',from:'h3',to:'g1'}).ok,false);assert.ok(!destinations.get('h3')?.includes('g1'))}
    if(n===121){
      assert.deepEqual(state.pendingRescue,{before:states[120],fen:states[120]!.fen,pieces:states[120]!.pieces,enPassant:[],historyLength:history.length-1,movedPieceIds:['white-pawn-b2']})
      assert.equal(immutableAction(state,{type:'endTurn'}).ok,false)
      const rescueAction:GameAction={type:'playCard',cardId:'dungeon',cardInstanceId:'white-deck-4-dungeon',target:[{from:'e6',to:'a1'}]}
      const saved=immutableAction(state,rescueAction);assert.ok(saved.ok,'held Dungeon cures Re6 check')
      const expected=structuredClone(pieces);expected.find(p=>p.id==='black-rook-a8')!.square='a1'
      assert.equal(check(expected,effects,'white'),false)
      assert.deepEqual(saved.state.pieces,expected)
      const savedPlayers=structuredClone(players),dungeon=savedPlayers.white.hand.find(c=>c.id==='white-deck-4-dungeon')!
      savedPlayers.white.hand=savedPlayers.white.hand.filter(c=>c.id!==dungeon.id);savedPlayers.white.discard.push(dungeon);savedPlayers.white.hand.push(savedPlayers.white.deck.shift()!)
      assert.deepEqual(saved.state.players,savedPlayers)
      const savedEffects=[...effects,{type:'dungeon',owner:'white',player:'black',pieceId:'black-rook-a8'}]
      assert.deepEqual(saved.state.effects,savedEffects)
      assert.deepEqual(saved.state.history,[...history,{type:'cardPlayed',cardId:'dungeon',target:[{from:'e6',to:'a1'}],movement:[{from:'e6',to:'a1'}],preservePreviousMove:true}])
      assert.equal(saved.state.fen,`${boardFen(expected)} b - b3 0 27`);assert.deepEqual(saved.state.enPassant,ep);assert.equal(saved.state.pendingRescue??null,null)
      assert.deepEqual(saved.state.turn,{...turn,cardPlays:{white:1,black:0}});assert.deepEqual(saved.state.shieldMove,shield)
      const ended=immutableAction(saved.state,{type:'endTurn'});assert.ok(ended.ok);assert.deepEqual(ended.state.pieces,expected);assert.deepEqual(ended.state.players,savedPlayers);assert.deepEqual(ended.state.effects,savedEffects);assert.deepEqual(ended.state.history,saved.state.history);assert.equal(ended.state.fen,saved.state.fen);assert.deepEqual(ended.state.enPassant,ep);assert.deepEqual(ended.state.turn,{color:'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}})
    } else assert.equal(state.pendingRescue??null,null)
    if(n===122){const reset=structuredClone(state);reset.turn.cardPlays.white=0;assert.equal(immutableAction(reset,{type:'playCard',cardId:'dungeon',cardInstanceId:'white-deck-4-dungeon',target:[{from:'e6',to:'a1'}]}).ok,false,'inert moved token grants no after-move timing')}
    states.push(structuredClone(state))
  }
  assert.equal(trace.moves,50);assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,20)
})

test('iteration 188 independently reviewed replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/188.json', import.meta.url), 'utf8')) as RandomTrace
  replayTrace(trace)
})
