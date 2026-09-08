import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests, cardPlayTargets } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameAction, GameState, PieceState, SquareName, GameEvent } from '../types.js'

// Independently reviewed action ledger, including every reaction-window closure.
const reasons = [
  '1 Nb1-a3 jumps to an empty square.',
  '2 White Anathema exchanges opposing Bf8 and Rh8 after Na3; identities survive.',
  '3 Close White turn and reset both allowances.',
  '4 Black g7-g6 advances one empty square.',
  '5 Close Black turn.',
  '6 White g2-g4 traverses empty g3; no black Pawn can take g3 en passant.',
  '7 Close White turn, retaining physical g3 opportunity.',
  '8 Black Bh8-g7 diagonal quiet move expires g3.',
  '9 Close Black turn.',
  '10 White Bf1-g2 diagonal into the vacated Pawn square.',
  '11 Close White turn.',
  '12 Black e7-e6 advances one.',
  '13 Close Black turn.',
  '14 White Bg2xb7 through f3 e4 d5 c6 captures black original b7 Pawn.',
  '15 Close White turn.',
  '16 Black Ke8-e7 moves safely and forfeits both castling rights.',
  '17 Close Black turn.',
  '18 White e2-e3 advances one.',
  '19 Close White turn.',
  '20 Black Ke7-e8 returns without restoring rights.',
  '21 Close Black turn.',
  '22 White d2-d4 traverses d3; no black adjacent captor exists.',
  '23 Close White turn, retaining d3 opportunity.',
  '24 Black Bg7-e5 via empty f6 expires d3.',
  '25 Close Black turn.',
  '26 White Ra1-b1 moves quietly and loses queenside right.',
  '27 Close White turn.',
  '28 Black h7-h5 via h6; white g4 is not on the en-passant capturing rank.',
  '29 Close Black turn; h6 opportunity remains uncapturable.',
  '30 White Ng1-h3 jumps, expiring h6.',
  '31 Close White turn.',
  '32 Black Be5-g3 through f4.',
  '33 Black Fortification retains physical card at diagonal boundary a4/b5 after its move.',
  '34 Close Black turn; wall persists.',
  '35 White Bb7xc8 captures original black c8 Bishop.',
  '36 Close White turn.',
  '37 Black h5xg4 captures original white g2 Pawn.',
  '38 Black Rebirth sends enemy c2 Pawn to empty starting-rank d2 after capture; no extra move.',
  '39 Close Black turn.',
  '40 White Qd1-c2 diagonal into vacated square.',
  '41 Close White turn.',
  '42 Black Bg3xf2 captures original white f2 Pawn and checks Ke1.',
  '43 Close Black turn; White receives check-escape turn.',
  '44 White Qc2-b3 leaves Bf2 check provisionally; held Fatal Attraction on Ke1 can freeze Bf2.',
  '45 Fatal Attraction b1 cannot freeze f2; spend it and restore Qc2, clocks, and pre-move history.',
  '46 White Ke1-d1 answers Bf2 check without another card.',
  '47 Close White turn.',
  '48 Black Ng8-h6 jumps.',
  '49 Close Black turn.',
  '50 White Pacifism before move protects physical h2 Pawn and prevents its captures.',
  '51 White Qc2-c5 via c3 c4; Pacifism remains.',
  '52 Close White turn.',
  '53 Black Qd8-f6 via e7.',
  '54 Close Black turn.',
  '55 White b2-b3 advances one.',
  '56 Close White turn.',
  '57 Black Ke8-e7 enters Qc5 diagonal check provisionally; held Challenge c8 forces another attacker.',
  '58 Black Challenge names movable white Bc8; mandatory Bishop move suppresses Queen capture/check.',
  '59 Close Black turn; White must move that Bishop.',
  '60 White Bc8-b7 satisfies Challenge and removes its temporary restriction.',
  '61 Close White turn.',
  '62 Black d7-d6 advances one.',
  '63 Close Black turn.',
  '64 White Fanatic moves b3-b6 through empty b4 b5, replacing move with no en-passant right.',
  '65 Close White turn after replacement move.',
  '66 Black Rf8-e8 quietly moves original h8 Rook.',
  '67 Close Black turn.',
  '68 White Qc5-d5 horizontal quiet move.',
  '69 Close White turn.',
  '70 Black Ke7-d7 is safe; d6 Pawn blocks Qd5 ray.',
  '71 Close Black turn.',
  '72 White Blessing moves Qd5-b3 as Bishop via c4 without capture; replaces move.',
  '73 Close White turn.',
  '74 Black Bf2-g3 diagonal quiet move.',
  '75 Close Black turn.',
  '76 White Qb3-b5 via b4; it does not cross diagonal a4/b5 wall.',
  '77 Close White turn.',
  '78 Black Betrayal kills enemy b6 Pawn on black half and returns captured original b7 Pawn there.',
  '79 Black c7-c6 regular advance remains available after Betrayal.',
  '80 Close Black turn.',
  '81 White Qb5-f1 via c4 d3 e2; wall not crossed.',
  '82 Close White turn.',
  '83 Black Lost Castle swaps its e8 Rook and enemy b1 Rook, replacing move without capture.',
  '84 Close Black turn.',
  '85 White Bb7xa8 captures black original a8 Rook.',
  '86 Close White turn.',
  '87 Black Kd7-d8 enters Re8 check provisionally; held Abduction e8, reveal, timeout can capture the checking Rook.',
  '88 Black Abduction conceals white Qf1; defer rescue until memory resolution; it cannot remove Re8 check.',
  '89 Reveal Abduction advances only concealment to recall.',
  '90 White correctly names Qf1 identity; restore Queen, fizzle Abduction, rewind Kd8 to d7.',
  '91 Black a7-a5 through a6 uses restored move; no white en-passant captor exists.',
  '92 Close Black turn retaining uncapturable a6 opportunity.',
  '93 White Qf1-g1 expires a6.',
  '94 Close White turn.',
  '95 Black Qf6-h4 via g5.',
  '96 Close Black turn.',
  '97 White Re8xb8 via d8 c8 captures original black b8 Knight.',
  '98 Close White turn.',
  '99 Black Kd7-c7 moves safely.',
  '100 Close Black turn.',
  '101 White Lost Castle swaps original h1 Rook with black Rb1, replacing move.',
  '102 Close White turn.',
  '103 Black Bg3-f2 diagonal quiet move.',
  '104 Close Black turn.',
  '105 White Rb8-e8 via c8 d8.',
  '106 Close White turn.',
  '107 Black Kc7-d7 safely moves horizontally.',
  '108 Close Black turn.',
  '109 White Qg1-g3 exposes Rh1-Kd1 ray; held Fortification g1/h1 supplies legal rescue.',
  '110 White wall a1/b1 misses checking ray; spend card, rewind Queen and clocks, retain existing wall.',
  '111 White Ba8xc6 via b7 captures original c7 Pawn and checks Kd7.',
  '112 Close White turn; Black gets escape turn.',
  '113 Black Kd7-c7 answers Bc6 check safely.',
  '114 Close Black turn.',
  '115 White e3-e4 advances one without exposing Kd1.',
  '116 Close White turn; 50 move commands reviewed with every intervening action.',
]

const cardRows: Record<number, [string, string, unknown]> = {
  2: ['anathema', 'white-hand-1-anathema', { bishop: 'f8', rook: 'h8' }],
  33: ['fortification', 'black-hand-2-fortification', { from: 'a4', to: 'b5' }],
  38: ['rebirth', 'black-hand-1-rebirth', [{ from: 'c2', to: 'd2' }]],
  45: ['fatal-attraction', 'white-hand-4-fatal-attraction', 'b1'],
  50: ['pacifism', 'white-hand-3-pacifism', 'h2'],
  58: ['challenge', 'black-deck-0-challenge', 'c8'],
  64: ['fanatic', 'white-deck-1-fanatic', 'b3'],
  72: ['blessing', 'white-deck-2-blessing', [{ from: 'd5', to: 'b3' }]],
  78: ['betrayal', 'black-deck-2-betrayal', { pieceId: 'black-pawn-b7', to: 'b6' }],
  83: ['lost-castle', 'black-hand-0-lost-castle', { own: 'e8', opponent: 'b1' }],
  88: ['abduction', 'black-deck-4-abduction', 'f1'],
  101: ['lost-castle', 'white-deck-4-lost-castle', { own: 'h1', opponent: 'b1' }],
  110: ['fortification', 'white-deck-3-fortification', { from: 'a1', to: 'b1' }],
}

const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const square = (x: number, y: number) => `${String.fromCharCode(97+x)}${y+1}` as SquareName
const other = (c: Color): Color => c === 'white' ? 'black' : 'white'
const at = (ps: PieceState[], s: string) => ps.find(p => p.zone === 'board' && p.square === s)
type Effect = { type: string; pieceId?: string; player?: Color; from?: string; to?: string }

// Geometry and capture restrictions are computed from physical records, never legalDests.
function reaches(ps: PieceState[], p: PieceState, to: string, capture: boolean, effects: unknown[], raw = false): boolean {
  assert.ok(p.square)
  const [x,y] = xy(p.square), [tx,ty] = xy(to), dx=tx-x, dy=ty-y
  const es = effects as Effect[]
  if (!raw && capture && es.some(e => e.type === 'pacifism' && (e.pieceId === p.id || e.pieceId === at(ps,to)?.id))) return false
  if (!raw && es.some(e => e.type === 'challenge' && e.player === p.owner && e.pieceId !== p.id)) return false
  if (!raw && !p.royal && es.some(e => {
    if(e.type !== 'fatal-attraction' || e.pieceId === p.id) return false
    const m=ps.find(q => q.id === e.pieceId && q.zone === 'board')
    if(!m?.square) return false
    const [mx,my]=xy(m.square)
    return Math.max(Math.abs(mx-x),Math.abs(my-y)) === 1
  })) return false
  if(p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2
  if(p.role === 'king' && Math.max(Math.abs(dx),Math.abs(dy)) !== 1) return false
  if(p.role === 'pawn') {
    const dir=p.owner === 'white' ? 1 : -1
    if(capture ? Math.abs(dx)!==1 || dy!==dir : dx!==0 || !(dy===dir || dy===2*dir && (p.owner==='white' ? y<=1 : y>=6))) return false
  } else if(p.role === 'bishop' ? Math.abs(dx)!==Math.abs(dy) : p.role === 'rook' ? dx!==0 && dy!==0 : p.role === 'queen' ? dx!==0 && dy!==0 && Math.abs(dx)!==Math.abs(dy) : false) return false
  if(!dx&&!dy) return false
  let prev=p.square
  for(let i=1;i<=Math.max(Math.abs(dx),Math.abs(dy));i++) {
    const next=square(x+Math.sign(dx)*i,y+Math.sign(dy)*i)
    if(!raw && es.some(e=>e.type==='fortification' && (e.from===prev&&e.to===next || e.to===prev&&e.from===next))) return false
    if(next!==to && at(ps,next)) return false
    prev=next
  }
  return true
}
function checked(ps: PieceState[], c: Color, effects: unknown[], raw=false): boolean {
  const king=ps.find(p=>p.owner===c&&p.royal)
  assert.ok(king?.square)
  return ps.some(p=>p.zone==='board'&&p.owner!==c&&reaches(ps,p,king.square!,true,effects,raw))
}
function boardFen(ps: PieceState[]): string {
  return Array.from({length:8},(_,i)=> {
    let line='',empty=0
    for(let x=0;x<8;x++) {
      const p=at(ps,square(x,7-i))
      if(!p){empty++;continue}
      if(empty){line+=empty;empty=0}
      const letter={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}[p.role]
      line+=p.owner==='white'?letter.toUpperCase():letter
    }
    return line+(empty||'')
  }).join('/')
}
function immutableApply(s: GameState,a: GameAction): GameState {
  const stateSnapshot=structuredClone(s),actionSnapshot=structuredClone(a)
  const result=applyAction(s,a)
  assert.deepEqual(s,stateSnapshot,'action mutated state')
  assert.deepEqual(a,actionSnapshot,'action mutated payload')
  assert.ok(result.ok,JSON.stringify(a))
  return result.state
}
function query<T>(s: GameState, fn:()=>T): T {
  const snapshot=structuredClone(s),result=fn()
  assert.deepEqual(s,snapshot,'public query mutated input')
  return result
}

test('iteration 176 independent board, clocks, identity, obligations, card ledger and rescue witnesses', () => {
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/176.json',import.meta.url),'utf8')) as RandomTrace
  assert.equal(reasons.length,116)
  assert.equal(trace.steps.length,reasons.length)
  assert.deepEqual(trace.steps.flatMap(({action},i)=>action.type==='move'?[`${i+1}:${action.from}-${action.to}`]:[]),
    ('1:b1-a3 4:g7-g6 6:g2-g4 8:h8-g7 10:f1-g2 12:e7-e6 14:g2-b7 16:e8-e7 18:e2-e3 20:e7-e8 '+
    '22:d2-d4 24:g7-e5 26:a1-b1 28:h7-h5 30:g1-h3 32:e5-g3 35:b7-c8 37:h5-g4 40:d1-c2 42:g3-f2 '+
    '44:c2-b3 46:e1-d1 48:g8-h6 51:c2-c5 53:d8-f6 55:b2-b3 57:e8-e7 60:c8-b7 62:d7-d6 66:f8-e8 '+
    '68:c5-d5 70:e7-d7 74:f2-g3 76:b3-b5 79:c7-c6 81:b5-f1 85:b7-a8 87:d7-d8 91:a7-a5 93:f1-g1 '+
    '95:f6-h4 97:e8-b8 99:d7-c7 103:g3-f2 105:b8-e8 107:c7-d7 109:g1-g3 111:a8-c6 113:d7-c7 115:e3-e4').split(' '))
  let actual=createGameState(trace.initial)
  let ps=structuredClone(actual.pieces),players=structuredClone(actual.players),effects: unknown[]=[],history: GameEvent[]=[]
  let turn=structuredClone(actual.turn),ep: GameState['enPassant']=[],shield: GameState['shieldMove']
  let rights='KQkq',active='w',half=0,full=1
  let rescueBefore: GameState|undefined,rollback: {ps:PieceState[];history:GameEvent[];rights:string;active:string;half:number;full:number;ep:GameState['enPassant']}|undefined
  let pending: GameState['pendingRescue']=null,pendingAbduction: GameState['pendingAbduction']
  const played: NonNullable<GameState['playedCards']>=[]
  const fen=()=>`${boardFen(ps)} ${active} ${rights||'-'} - ${half} ${full}`
  const relocate=(from: string,to: string)=>{const p=at(ps,from);assert.ok(p);assert.match(to,/^[a-h][1-8]$/);p.square=to as SquareName;return p}
  for(const [index,step] of trace.steps.entries()) {
    const n=index+1,a=step.action
    assert.ok(reasons[index]!.startsWith(`${n} `))
    const before=actual
    if(a.type==='move') {
      assert.ok(typeof a.from === 'string' && typeof a.to === 'string')
      const from=a.from,to=a.to,p=at(ps,from),victim=at(ps,to)
      assert.ok(p);assert.equal(p.owner,turn.color);assert.equal(turn.moveMade,false)
      assert.ok(reaches(ps,p,to,!!victim,effects),reasons[index])
      if(victim){assert.equal(victim.owner,other(turn.color));assert.equal(victim.royal,false)}
      rescueBefore=before
      rollback={ps:structuredClone(ps),history:structuredClone(history),rights,active,half,full,ep:structuredClone(ep)}
      ep=[]
      if(p.role==='pawn'&&Math.abs(xy(to)[1]-xy(from)[1])===2) ep=[{target:square(xy(from)[0],(xy(to)[1]+xy(from)[1])/2),pawnId:p.id}]
      if(victim){victim.zone='captured';victim.square=null;victim.capturedBy=turn.color}
      relocate(from,to)
      if(p.royal)rights=rights.replace(p.owner==='white'?/[KQ]/g:/[khq]/g,'')
      if(p.id==='white-rook-a1')rights=rights.replace('Q','')
      if(p.id==='white-rook-h1')rights=rights.replace('K','')
      half=p.role==='pawn'||victim?0:half+1
      if(turn.color==='black')full++
      active=turn.color==='white'?'b':'w'
      history.push({type:'move',from:from as SquareName,to:to as SquareName,...(victim?{capturedId:victim.id}:{})})
      shield={player:turn.color,pieceIds:[p.id],capturedOpponent:!!victim}
      effects=effects.filter(e=>(e as Effect).type!=='challenge')
      turn.phase='afterMove';turn.moveMade=true
      pending=[44,57,87,109].includes(n)?{before:rescueBefore,fen:rescueBefore.fen,pieces:structuredClone(rollback.ps),enPassant:structuredClone(rollback.ep),historyLength:rollback.history.length,movedPieceIds:[p.id]}:null
    } else if(a.type==='endTurn') {
      assert.equal(turn.moveMade,true);assert.equal(pending,null)
      assert.equal(checked(ps,turn.color,effects),false,reasons[index])
      turn={color:other(turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
      shield=undefined
    } else if(a.type==='playCard') {
      const spec=cardRows[n];assert.ok(spec)
      assert.deepEqual(a,{type:'playCard',cardId:spec[0],cardInstanceId:spec[1],target:spec[2]})
      const owner=spec[1].startsWith('white')?'white':'black'
      assert.equal(owner,turn.color);assert.equal(turn.cardPlays[owner],0)
      const beforeMove=[50,64,72,78,83,101].includes(n)
      assert.equal(turn.phase,beforeMove?'beforeMove':'afterMove')
      const player=players[owner],card=player.hand.find(c=>c.id===spec[1]);assert.ok(card);assert.equal(card.cardId,spec[0])
      player.hand=player.hand.filter(c=>c.id!==card.id)
      const replacement=player.deck.shift();assert.ok(replacement);player.hand.push(replacement)
      if(![33,50].includes(n))player.discard.push(card)
      played.push({player:owner,cardInstanceId:card.id});turn.cardPlays[owner]++
      let movement: {from:SquareName;to:SquareName}[]=[],preserve=!beforeMove
      if(n===2){at(ps,'f8')!.square='h8';ps.find(p=>p.id==='black-rook-h8')!.square='f8';rights='KQhq';movement=[{from:'f8',to:'h8'},{from:'h8',to:'f8'}]}
      if(n===33)effects.push({type:'fortification',owner,card,from:'a4',to:'b5'})
      if(n===38){relocate('c2','d2');movement=[{from:'c2',to:'d2'}]}
      if(n===50)effects.push({type:'pacifism',owner,card,pieceId:'white-pawn-h2'})
      if(n===58){effects.push({type:'challenge',owner,player:'white',pieceId:'white-bishop-f1'});pending=null}
      if(n===64){assert.ok(['b4','b5','b6'].every(s=>!at(ps,s)));relocate('b3','b6');movement=[{from:'b3',to:'b6'}]}
      if(n===72){assert.equal(at(ps,'c4'),undefined);relocate('d5','b3');movement=[{from:'d5',to:'b3'}]}
      if(n===78){const dead=at(ps,'b6')!;assert.equal(dead.id,'white-pawn-b2');dead.zone='dead';dead.square=null;delete dead.capturedBy;const returned=ps.find(p=>p.id==='black-pawn-b7')!;assert.equal(returned.zone,'captured');returned.zone='board';returned.square='b6';delete returned.capturedBy}
      if(n===83){const w=at(ps,'b1')!,b=at(ps,'e8')!;assert.equal(w.id,'white-rook-a1');assert.equal(b.id,'black-rook-h8');w.square='e8';b.square='b1';movement=[{from:'b1',to:'e8'},{from:'e8',to:'b1'}]}
      if(n===101){const w=at(ps,'h1')!,b=at(ps,'b1')!;assert.equal(w.id,'white-rook-h1');assert.equal(b.id,'black-rook-h8');w.square='b1';b.square='h1';movement=[{from:'h1',to:'b1'},{from:'b1',to:'h1'}]}
      if([64,72,83,101].includes(n)){
        half=n===64?0:half+1;if(owner==='black')full++;active=owner==='white'?'b':'w';ep=[];turn.phase='afterMove';turn.moveMade=true
        // A swap is not an actual arrival move, so has no Mystic Shield candidate.
        shield={player:owner,capturedOpponent:false,pieceIds:n===64?['white-pawn-b2']:n===72?['white-queen-d1']:[]}
      }
      if(n===88){const p=at(ps,'f1')!;assert.equal(p.id,'white-queen-d1');p.zone='away';p.square=null;pendingAbduction={phase:'concealment',player:'white',durationMs:10000,pieceId:p.id,requiresPieceId:false,before}}
      if([45,110].includes(n)){
        assert.ok(rollback);({ps,history,rights,active,half,full,ep}=structuredClone(rollback));pending=null;turn.phase='beforeMove';turn.moveMade=false
        history.push({type:'cardFizzled',cardId:a.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false})
      } else {
        history.push({type:'cardPlayed',cardId:a.cardId,...(n===88?{}:{target:spec[2] as GameEvent['target']}),...(n===33?{}:{movement,preservePreviousMove:preserve})})
      }
      if(![45,88,110].includes(n))assert.equal(checked(ps,other(owner),effects),false,'regular card does not directly mate')
    } else if(a.type==='revealAbduction') {
      assert.equal(n,89);assert.ok(pendingAbduction);pendingAbduction={...pendingAbduction,phase:'recall'}
    } else if(a.type==='answerAbduction') {
      assert.equal(n,90);assert.deepEqual(a,{type:'answerAbduction',player:'white',owner:'white',role:'queen',square:'f1',pieceId:'white-queen-d1'})
      assert.ok(rollback);({ps,history,rights,active,half,full,ep}=structuredClone(rollback));pending=null;pendingAbduction=null
      turn.phase='beforeMove';turn.moveMade=false
      history.push({type:'cardFizzled',cardId:'abduction',reason:'SELF_CHECK',movement:[],preservePreviousMove:false})
    } else assert.fail(`unreviewed ${n}`)
    actual=immutableApply(before,a)
    assert.deepEqual(actual.pieces,ps,`step ${n} exact physical identities and captors`)
    assert.equal(actual.fen,fen(),`step ${n} all six FEN fields`)
    assert.deepEqual(actual.players,players,`step ${n} exact card zones`)
    assert.deepEqual(actual.history,history,`step ${n} complete history`)
    assert.deepEqual(actual.effects,effects,`step ${n} exact retained effects and obligations`)
    assert.deepEqual(actual.turn,turn,`step ${n} timing and allowances`)
    assert.deepEqual(actual.enPassant,ep)
    assert.deepEqual(actual.playedCards??[],played)
    assert.deepEqual(actual.shieldMove,shield,`step ${n} shield movement provenance`)
    assert.equal(actual.chaosForbidden,undefined);assert.equal(actual.plotsExecution,undefined)
    assert.deepEqual(actual.plotsAllowances??[],[]);assert.deepEqual(actual.fogLocked??[],[])
    assert.deepEqual(actual.riposteLostMoves??[],[]);assert.equal(actual.riposteSkipped,undefined);assert.equal(actual.riposteCheckDeferred,undefined)
    assert.equal(actual.pendingDoomsayer??null,null);assert.deepEqual(actual.underElfHill??[],[])
    assert.equal(actual.orientation,0);assert.equal(actual.outcome,null)
    if(pending){
      assert.ok(actual.pendingRescue);assert.equal(actual.pendingRescue.fen,pending.fen)
      assert.deepEqual(actual.pendingRescue.pieces,pending.pieces);assert.deepEqual(actual.pendingRescue.enPassant,pending.enPassant)
      assert.equal(actual.pendingRescue.historyLength,pending.historyLength);assert.deepEqual(actual.pendingRescue.movedPieceIds,pending.movedPieceIds)
      assert.deepEqual(actual.pendingRescue.before,rescueBefore)
    } else assert.equal(actual.pendingRescue??null,null)
    assert.deepEqual(actual.pendingAbduction??null,pendingAbduction??null)
    for(const color of ['white','black'] as const){
      const raw=checked(ps,color,[],true),effective=checked(ps,color,effects)
      assert.equal(query(actual,()=>isKingInCheck(actual,color)),effective,`step ${n} independent ${color} royal safety`)
      if([58,59].includes(n)&&color==='black'){assert.equal(raw,true);assert.equal(effective,false)}
    }
    // Every physical EP record in this trace has no prospective capturing Pawn.
    for(const opportunity of ep){
      const victim=ps.find(p=>p.id===opportunity.pawnId)!;const capturing=other(victim.owner)
      const candidates=ps.filter(p=>p.zone==='board'&&p.owner===capturing&&p.role==='pawn'&&reaches(ps,p,opportunity.target,true,effects))
      assert.deepEqual(candidates,[],'independent prospective EP geometry')
      const context=structuredClone(actual);context.turn={color:capturing,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
      context.fen=context.fen.replace(/ [wb] /,capturing==='white'?' w ':' b ')
      const dests=query(context,()=>legalDests(context))
      for(const p of ps.filter(p=>p.role==='pawn'&&p.owner===capturing&&p.square)) assert.ok(!dests.get(p.square!)?.includes(opportunity.target))
    }
    if([44,57,87,109].includes(n)) {
      const cure: GameAction=n===44?{type:'playCard',cardId:'fatal-attraction',cardInstanceId:'white-hand-4-fatal-attraction',target:'e1'}:
        n===57?{type:'playCard',cardId:'challenge',cardInstanceId:'black-deck-0-challenge',target:'c8'}:
        n===87?{type:'playCard',cardId:'abduction',cardInstanceId:'black-deck-4-abduction',target:'e8'}:
        {type:'playCard',cardId:'fortification',cardInstanceId:'white-deck-3-fortification',target:{from:'g1',to:'h1'}}
      assert.equal(cure.type,'playCard');if(cure.type!=='playCard')assert.fail()
      const cureCard=actual.players[turn.color].hand.find(c=>c.id===cure.cardInstanceId&&c.cardId===cure.cardId)
      assert.ok(cureCard)
      const curePlayers=structuredClone(players),curePlayer=curePlayers[turn.color]
      curePlayer.hand=curePlayer.hand.filter(c=>c.id!==cureCard.id)
      const cureDraw=curePlayer.deck.shift();assert.ok(cureDraw);curePlayer.hand.push(cureDraw)
      if(n===57||n===87)curePlayer.discard.push(cureCard)
      const cureTurn=structuredClone(turn);cureTurn.cardPlays[turn.color]++
      const cureHistory: GameEvent[]=[...structuredClone(history),{
        type:'cardPlayed',cardId:cure.cardId,target:cure.target as GameEvent['target'],
        ...(n===109?{}:{movement:[],preservePreviousMove:true}),
        ...(n===87?{capturedIds:['white-rook-a1'],capturedId:'white-rook-a1'}:{}),
      }]
      let cured=immutableApply(actual,cure)
      const curePieces=structuredClone(ps),cureEffects=structuredClone(effects)
      if(n===44)cureEffects.push({type:'fatal-attraction',owner:turn.color,card:cureCard,pieceId:'white-king-e1'})
      if(n===57)cureEffects.push({type:'challenge',owner:turn.color,player:'white',pieceId:'white-bishop-f1'})
      if(n===87){
        cured=immutableApply(cured,{type:'revealAbduction'})
        cured=immutableApply(cured,{type:'abductionTimeout'})
        const captured=curePieces.find(p=>p.id==='white-rook-a1')!
        captured.square=null;captured.zone='captured';captured.capturedBy='black'
      }
      if(n===109)cureEffects.push({type:'fortification',owner:turn.color,card:cureCard,from:'g1',to:'h1'})
      assert.deepEqual(cured.pieces,curePieces);assert.equal(checked(curePieces,turn.color,cureEffects),false)
      const cureFen=`${boardFen(curePieces)} ${active} ${rights||'-'} - ${n===87?0:half} ${full}`
      assert.equal(cured.fen,cureFen);assert.deepEqual(cured.enPassant,ep)
      assert.deepEqual(cured.players,curePlayers);assert.deepEqual(cured.effects,cureEffects)
      assert.deepEqual(cured.turn,cureTurn);assert.deepEqual(cured.history,cureHistory)
      assert.deepEqual(cured.playedCards,[...played,{player:turn.color,cardInstanceId:cureCard.id}])
      assert.deepEqual(cured.shieldMove,shield);assert.equal(cured.pendingAbduction??null,null)
      assert.equal(cured.pendingRescue??null,null);assert.equal(cured.turn.moveMade,true)
      assert.equal(query(cured,()=>isKingInCheck(cured,turn.color)),false)
      const ended=immutableApply(cured,{type:'endTurn'})
      assert.equal(ended.fen,cureFen);assert.deepEqual(ended.enPassant,ep)
      assert.deepEqual(ended.pieces,curePieces);assert.deepEqual(ended.players,curePlayers)
      assert.deepEqual(ended.effects,cureEffects);assert.deepEqual(ended.history,cureHistory)
      assert.deepEqual(ended.turn,{color:other(turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}})
      assert.equal(ended.shieldMove,undefined);assert.equal(ended.pendingRescue??null,null);assert.equal(ended.outcome,null)
    }
    if([45,90,110].includes(n)){
      const restricted=structuredClone(actual);restricted.players[turn.color].hand.push({id:'probe-shield',cardId:'mystic-shield'})
      restricted.turn.cardPlays[turn.color]=0
      assert.deepEqual(query(restricted,()=>cardPlayTargets(restricted,'mystic-shield')),[],'inert rollback shield cannot authorize a card')
    }
  }
  assert.equal(trace.moves,50);assert.equal(Object.keys(cardRows).length,13)
  assert.equal(actual.fen,'4R3/2k2p2/1pBpp1pn/p7/3PP1pq/N6N/P2P1b1P/1RBK2Qr b - - 0 26')
})

test('iteration 176 deterministic replay core', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/176.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})
