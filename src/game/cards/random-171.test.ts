import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck as isInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/171.stalled.json', import.meta.url), 'utf8')) as RandomTrace
// Numbered, independently reviewed action rationales. The terminal sampler limitation
// is preserved explicitly; this 35-move trace is not represented as a 50-move pass.
const rationales = [
  '1 b2-b4: initial Pawn double step through empty b3; no adjacent black captor.',
  '2 End White turn, preserving b3 opportunity but no legal en passant.',
  '3 Tournament exchanges black Ng8 and white Nb1; replacement, no captures.',
  '4 End Black replacement turn.',
  '5 g2-g3: one forward into empty square.',
  '6 Figure Dance simultaneously cycles all four corner Rooks counterclockwise; revoke all castling.',
  '7 End White turn after Figure Dance.',
  '8 g7-g6: black Pawn one forward.',
  '9 End Black turn.',
  '10 Hidden Passage relocates royal e1 to empty e5; replacement, ignores paths.',
  '11 End White replacement turn.',
  '12 d7-d6: forward Pawn gives check to Ke5.',
  '13 End Black checking turn; White has a legal Masquerade escape.',
  '14 Masquerade e5-f4: non-Pawn royal moves one unobstructed Queen diagonal and escapes Pd6.',
  '15 End White replacement turn.',
  '16 Bc8-f5: diagonal d7/e6 clear.',
  '17 End Black turn.',
  '18 Kf4-e5: provisional Pd6 check; held Fortification boundary d6-e5 is a concrete cure.',
  '19 Fortification a5-b4 does not stop Pd6-e5: spend card and rewind illegal K move.',
  '20 Qd1-e1: empty horizontal step, legal replacement without another card.',
  '21 End White replacement turn.',
  '22 e7-e6: one forward black Pawn.',
  '23 End Black turn.',
  '24 Kf4-e4: provisional Bf5 check; held Fatal Attraction on e4 immobilizes Bf5.',
  '25 Fatal Attraction marks royal e4; neighboring Bf5 cannot capture and check is cured.',
  '26 End White turn with magnet retained.',
  '27 b7-b6: one forward outside magnet neighborhood.',
  '28 Fireball follows quiet b7-b6: captures b6 and adjacent a7/c7, all by Black.',
  '29 End Black turn after explosion.',
  '30 d2-d3: forward arrival into magnet neighborhood is legal; Pawn becomes frozen.',
  '31 End White turn.',
  '32 h7-h6: one forward.',
  '33 Crab attaches to owned original Pawn e6; board identity and clocks preserved.',
  '34 End Black turn.',
  '35 Ghostwalk a2-a3: ordinary Pawn geometry, empty destination, no obstruction needed.',
  '36 End White replacement turn.',
  '37 Bf8-e7: empty diagonal.',
  '38 End Black turn.',
  '39 Ng1-h3: ordinary knight jump.',
  '40 End White turn.',
  '41 Nb8-d7: knight jump.',
  '42 End Black turn.',
  '43 c2-c3: Pawn advances one, outside e4 neighborhood.',
  '44 End White turn.',
  '45 Ra8-a4: a7/a6/a5 empty after Fireball.',
  '46 End Black turn.',
  '47 Breakthrough a3xa4: forward capture of black physical Rook originally h8.',
  '48 End White replacement turn.',
  '49 Nb1-a3: knight jump to square vacated by Breakthrough.',
  '50 End Black turn.',
  '51 Rh8-h7: empty vertical step.',
  '52 End White turn.',
  '53 g6-g5: one forward black Pawn.',
  '54 End Black turn.',
  '55 Bc1-f4: d2/e3 empty; arrival becomes frozen, which does not forbid arrival.',
  '56 Black Chaos cancels c1-f4, restores clocks and Bishop, forbids that exact movement.',
  '57 Ng8-f6: different physical move, gives check to Ke8, clears Chaos prohibition.',
  '58 End White checking turn.',
  '59 Be7xf6 captures checking white Knight originally b1 and rescues Black.',
  '60 End Black turn.',
  '61 f2-f3: forward arrival next to magnet is allowed, becomes frozen.',
  '62 End White turn.',
  '63 Lost Castle exchanges black Ra1 and white Rh1 as non-move swap replacement.',
  '64 End Black replacement turn.',
  '65 Nh3-f2: knight jump to square vacated by Pawn.',
  '66 Panic imposes 15000ms on Blacks upcoming move and is discarded normally.',
  '67 End White turn; Panic survives into Black turn.',
  '68 Panic timeout consumes Blacks turn, advances clocks once, removes timer.',
  '69 g3-g4: one forward, neither square adjacent to e4.',
  '70 End White turn.',
  '71 h6-h5: one forward black Pawn.',
  '72 End Black turn.',
  '73 Bc1xa3 through empty b2 captures black Knight originally g8.',
  '74 End White turn.',
  '75 Bf6-h8 through empty g7.',
  '76 End Black turn.',
  '77 e2-e3: allowed forward arrival, then frozen by own magnet.',
  '78 End White turn.',
  '79 Bh8xc3 through empty g7/f6/e5/d4 captures white Pawn originally c2.',
  '80 End Black turn.',
  '81 Qe1-e2: empty vertical step.',
  '82 End White turn.',
  '83 Qd8-c7: empty diagonal step.',
  '84 End Black turn.',
  '85 Qe2-e1: empty vertical step.',
  '86 End White turn.',
  '87 Qc7-b7: checks Ke4 along clear c6/d5; magnet does not freeze Qb7.',
  '88 Black Doomsayer opens Whites immediate naming option and retains its physical card.',
  '89 White names Bishop, chooses owned Bf1; Black captures it and Doomsayer resolves.',
  '90 White Legacy retrieves physical discarded Panic after Bf1 capture, plus ordinary replacement draw.',
]
const moves: Record<number, string> = {1:'b2 b4',5:'g2 g3',8:'g7 g6',12:'d7 d6',16:'c8 f5',18:'f4 e5',20:'d1 e1',22:'e7 e6',24:'f4 e4',27:'b7 b6',30:'d2 d3',32:'h7 h6',37:'f8 e7',39:'g1 h3',41:'b8 d7',43:'c2 c3',45:'a8 a4',49:'b1 a3',51:'h8 h7',53:'g6 g5',55:'c1 f4',57:'g8 f6',59:'e7 f6',61:'f2 f3',65:'h3 f2',69:'g3 g4',71:'h6 h5',73:'c1 a3',75:'f6 h8',77:'e2 e3',79:'h8 c3',81:'e1 e2',83:'d8 c7',85:'e2 e1',87:'c7 b7'}
const cards: Record<number, [Color, string, string, unknown?]> = {
  3:['black','tournament','black-hand-0-tournament',{own:'g8',opponent:'b1'}],
  6:['white','figure-dance','white-hand-3-figure-dance',[]],
  10:['white','hidden-passage','white-deck-0-hidden-passage',[{from:'e1',to:'e5'}]],
  14:['white','masquerade','white-hand-4-masquerade',[{from:'e5',to:'f4'}]],
  19:['white','fortification','white-deck-1-fortification',{from:'a5',to:'b4'}],
  25:['white','fatal-attraction','white-hand-0-fatal-attraction','e4'],
  28:['black','fireball','black-hand-2-fireball','b6'],
  33:['black','crab','black-deck-0-crab','e6'],
  35:['white','ghostwalk','white-deck-4-ghostwalk',[{from:'a2',to:'a3'}]],
  47:['white','breakthrough','white-deck-2-breakthrough',[{from:'a3',to:'a4'}]],
  56:['black','chaos','black-deck-1-chaos'],
  63:['black','lost-castle','black-hand-4-lost-castle',{own:'a1',opponent:'h1'}],
  66:['white','panic','white-hand-2-panic'],
  88:['black','doomsayer','black-deck-4-doomsayer'],
  90:['white','legacy','white-deck-3-legacy','white-hand-2-panic'],
}
const xy = (square: string) => [square.charCodeAt(0)-97, Number(square[1])-1] as const
const square = (x:number,y:number): SquareName => `${String.fromCharCode(97+x)}${y+1}` as SquareName
const at = (pieces: PieceState[], s: string) => pieces.find(p=>p.zone==='board' && p.square===s)
function geometry(pieces: PieceState[], p: PieceState, to: string, capture:boolean, crab=false) {
  const [x,y]=xy(p.square!), [u,v]=xy(to), dx=u-x,dy=v-y
  if(p.role==='knight') return Math.abs(dx)*Math.abs(dy)===2
  if(p.royal) return Math.max(Math.abs(dx),Math.abs(dy))===1
  if(p.role==='pawn') {
    const f=p.owner==='white'?1:-1
    return crab || capture ? Math.abs(dx)===1 && dy===f : dx===0 && (dy===f || y===(p.owner==='white'?1:6) && dy===2*f && !at(pieces,square(x,y+f)))
  }
  const diagonal=Math.abs(dx)===Math.abs(dy),straight=dx===0||dy===0
  if(!(dx||dy) || !(p.role==='queen'?diagonal||straight:p.role==='rook'?straight:diagonal)) return false
  for(let i=1;i<Math.max(Math.abs(dx),Math.abs(dy));i++) if(at(pieces,square(x+i*Math.sign(dx),y+i*Math.sign(dy)))) return false
  return true
}
function frozen(pieces:PieceState[], p:PieceState, magnet:boolean) {
  if(!magnet||p.royal||p.zone!=='board') return false
  const k=pieces.find(q=>q.id==='white-king-e1')!, [x,y]=xy(p.square!),[u,v]=xy(k.square!)
  return Math.max(Math.abs(x-u),Math.abs(y-v))===1
}
function threats(pieces:PieceState[], color:Color, magnet:boolean, crab:boolean, raw=false) {
  const royal=pieces.find(p=>p.owner===color&&p.royal)!
  return pieces.filter(p=>p.owner!==color&&p.zone==='board'&&(raw||!frozen(pieces,p,magnet))&&geometry(pieces,p,royal.square!,true,crab&&p.id==='black-pawn-e7')).map(p=>p.id)
}
function boardFen(pieces:PieceState[]) {
  const symbols={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}
  return Array.from({length:8},(_,row)=>{
    let line='',empty=0
    for(let x=0;x<8;x++){const p=at(pieces,square(x,7-row)); if(!p){empty++;continue}if(empty){line+=empty;empty=0}const c=symbols[p.role];line+=p.owner==='white'?c.toUpperCase():c}
    return line+(empty||'')
  }).join('/')
}

test('iteration 171: independently reviewed 90-action terminal prefix', () => {
  assert.equal(rationales.length,90)
  rationales.forEach((r,i)=>assert.ok(r.startsWith(`${i+1} `)))
  assert.equal(trace.steps.length,90)
  let actual=createGameState(trace.initial)
  let pieces=structuredClone(actual.pieces), players=structuredClone(actual.players), turn=structuredClone(actual.turn)
  let effects:unknown[]=[], history:GameEvent[]=[], half=0,full=1,active='w',rights='KQkq'
  let shield:GameState['shieldMove'], ep:GameState['enPassant']=[]
  let magnet=false,crab=false
  const snapshots=new Map<number,{pieces:PieceState[],fen:string,history:GameEvent[],half:number,full:number,active:string}>()
  const relocate=(from:string,to:string,owner:Color) => {
    const p=at(pieces,from)!;assert.ok(p,from)
    const victim=at(pieces,to)
    if(victim){assert.notEqual(victim.owner,owner);victim.zone='captured';victim.square=null;victim.capturedBy=owner}
    p.square=to as SquareName
    return {p,victim}
  }
  for(const [index,{action}] of trace.steps.entries()) {
    const n=index+1,label=rationales[index]!, input=structuredClone(actual)
    snapshots.set(n,{pieces:structuredClone(pieces),fen:actual.fen,history:structuredClone(history),half,full,active})
    let expected:GameAction={type:'endTurn'}
    if(moves[n]){const [from,to]=moves[n]!.split(' ');expected={type:'move',from,to}}
    if(cards[n]){const [,cardId,cardInstanceId,target]=cards[n]!;expected={type:'playCard',cardId,cardInstanceId,...(target===undefined?{}:{target})}}
    if(n===68) expected={type:'panicTimeout'}
    if(n===89) expected={type:'namePiece',speaker:'white',name:'bishop',losses:[{effectId:'black-deck-4-doomsayer',pieceId:'white-bishop-f1'}]}
    assert.deepEqual(action,expected,label)
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from=action.from,to=action.to,p=at(pieces,from)!,victim=at(pieces,to)
      assert.equal(turn.phase,'beforeMove');assert.equal(p.owner,turn.color)
      assert.equal(frozen(pieces,p,magnet),false,label)
      assert.ok(geometry(pieces,p,to,!!victim,crab&&p.id==='black-pawn-e7'),label)
      relocate(from,to,turn.color)
      half=p.role==='pawn'||victim?0:half+1; if(turn.color==='black')full++
      active=turn.color==='white'?'b':'w';turn.phase='afterMove';turn.moveMade=true
      ep=n===1?[{target:'b3',pawnId:'white-pawn-b2'}]:[]
      shield={player:turn.color,pieceIds:[p.id],capturedOpponent:!!victim}
      history.push({type:'move',from:from as SquareName,to:to as SquareName,...(victim?{capturedId:victim.id}:{}),...(n>=39&&turn.color==='white'?{movedPieceId:p.id,movedRoles:[p.role]}:{})})
    } else if(action.type==='playCard') {
      const [owner,id,instance,target]=cards[n]!, definition=CARD_CATALOG[id]!,held=players[owner].hand.find(c=>c.id===instance)
      assert.deepEqual(held,{id:instance,cardId:id});assert.equal(turn.cardPlays[owner],0,label)
      const timing=n===56?'afterOpponentMove':n===90?'afterOpponentCard':turn.phase
      assert.ok(definition.timing.includes(timing),label)
      players[owner].hand=players[owner].hand.filter(c=>c.id!==instance)
      if(n===90){const retrieved=players.white.discard.find(c=>c.id==='white-hand-2-panic')!;assert.ok(retrieved);players.white.discard=players.white.discard.filter(c=>c!==retrieved);players.white.hand.push(retrieved)}
      players[owner].hand.push(players[owner].deck.shift()!)
      turn.cardPlays[owner]++
      if(![25,33,88].includes(n))players[owner].discard.push(held!)
      let movement:Array<{from:SquareName,to:SquareName}>=[],capturedId:string|undefined
      if(n===3||n===63){
        const pair=n===3?['b1','g8']:['h1','a1'],a=at(pieces,pair[0]!)!,b=at(pieces,pair[1]!)!
        assert.equal(a.role,n===3?'knight':'rook');assert.equal(b.role,a.role)
        const old=a.square!;a.square=b.square;b.square=old
        movement=[{from:old,to:a.square!},{from:a.square!,to:old}]
        shield={player:owner,pieceIds:[],capturedOpponent:false}
      }
      if(n===6){const cycle:Record<string,SquareName>={a1:'h1',h1:'h8',h8:'a8',a8:'a1'};for(const p of pieces){if(p.square&&cycle[p.square]){movement.push({from:p.square,to:cycle[p.square]!});p.square=cycle[p.square]!}}rights='-'}
      if([10,14,35,47].includes(n)){
        const [m]=(target as Array<{from:SquareName,to:SquareName}>);assert.ok(m)
        const {p,victim}=relocate(m.from,m.to,owner);capturedId=victim?.id;movement=[m]
        shield={player:owner,pieceIds:[p.id],capturedOpponent:!!victim}
      }
      if([3,10,14,35,47,63].includes(n)){
        half=n===35||n===47?0:half+1;if(owner==='black')full++
        active=owner==='white'?'b':'w';turn.phase='afterMove';turn.moveMade=true;ep=[]
      }
      if(n===19||n===56){const saved=snapshots.get(n===19?18:55)!;pieces=structuredClone(saved.pieces);half=saved.half;full=saved.full;active=saved.active;history=structuredClone(saved.history);turn.phase='beforeMove';turn.moveMade=false;if(n===56)shield=undefined}
      if(n===25){magnet=true;effects.push({type:'fatal-attraction',owner,card:held,pieceId:'white-king-e1'})}
      if(n===28){for(const s of ['a7','b6','c7']){const p=at(pieces,s)!;assert.equal(p.role,'pawn');p.square=null;p.zone='captured';p.capturedBy='black'}half=0}
      if(n===33){crab=true;effects.push({type:'crab',owner,card:held,pieceId:'black-pawn-e7'})}
      if(n===66)effects.push({type:'panic',owner:'white',player:'black',durationMs:15000})
      if(n===88)effects.push({type:'doomsayer',owner,card:held})
      if(n===19)history.push({type:'cardFizzled',cardId:id,reason:'SELF_CHECK',movement:[],preservePreviousMove:false})
      else if(n===56)history.push({type:'cardPlayed',cardId:id,player:'black',movement:[{from:'f4',to:'c1'}],preservePreviousMove:true})
      else if(n===90)history.push({type:'cardPlayed',cardId:id,player:'white',movement:[],preservePreviousMove:true})
      else history.push({type:'cardPlayed',cardId:id,...(target===undefined?{}:{target:target as GameEvent['target']}),...(capturedId?{capturedId}:{}),...(n===28?{capturedIds:['black-pawn-a7','black-pawn-b7','black-pawn-c7'],player:'black' as Color}:{}),movement,preservePreviousMove:![3,10,14,35,47,63].includes(n)})
    } else if(action.type==='namePiece') {
      const p=pieces.find(p=>p.id==='white-bishop-f1')!;assert.equal(p.square,'f1');p.zone='captured';p.square=null;p.capturedBy='black';half=0
      effects=effects.slice(0,2);players.black.discard.push({id:'black-deck-4-doomsayer',cardId:'doomsayer'})
      history.push({type:'pieceNamed',speaker:'white',name:'bishop',capturedIds:[p.id],resolvedEffectIds:['black-deck-4-doomsayer']})
    } else {
      assert.equal(threats(pieces,turn.color,magnet,crab).length,0,label)
      if(n===68){assert.equal(turn.color,'black');half++;full++;active='w';effects=effects.slice(0,2)}
      else assert.equal(turn.moveMade,true)
      turn={color:turn.color==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};shield=undefined
    }
    const result=applyAction(actual,action)
    assert.deepEqual(actual,input,`${label}: immutable input`);assert.ok(result.ok,label);actual=result.state
    assert.deepEqual(actual.pieces,pieces,`${label}: full physical identities/captors`)
    assert.deepEqual(actual.players,players,`${label}: physical card zones and ordered draw`)
    assert.deepEqual(actual.effects,effects,label);assert.deepEqual(actual.history,history,label);assert.deepEqual(actual.turn,turn,label)
    assert.equal(actual.fen,`${boardFen(pieces)} ${active} ${rights} - ${half} ${full}`,`${label}: six FEN fields`)
    assert.deepEqual(actual.enPassant,ep,label)
    if(n===1||n===2){
      // Serialize the physical b3 opportunity independently from whether Black
      // has an eligible captor on a4/c4 in its prospective before-move context.
      assert.deepEqual(ep,[{target:'b3',pawnId:'white-pawn-b2'}])
      assert.equal(at(pieces,'b4')?.id,'white-pawn-b2');assert.equal(at(pieces,'b3'),undefined)
      const captors=pieces.filter(p=>p.zone==='board'&&p.owner==='black'&&p.originalRole==='pawn'&&!p.promoted&&['a4','c4'].includes(p.square!))
      assert.deepEqual(captors,[])
      const prospective=structuredClone(actual)
      prospective.turn={color:'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
      const before=structuredClone(prospective),destinations=legalDests(prospective)
      assert.deepEqual(prospective,before,`${label}: immutable prospective EP check`)
      assert.deepEqual([...destinations].filter(([from,to])=>['a4','c4'].includes(from)&&to.includes('b3')),[])
    }
    assert.equal(actual.orientation,0)
    assert.deepEqual(actual.shieldMove??null,shield??null,label)
    assert.deepEqual(actual.chaosForbidden??null,n===56?{player:'white',movement:'white-bishop-c1:c1:f4'}:null,label)
    for(const key of ['plotsExecution','fogLocked','riposteCheckDeferred'] as const)assert.equal(actual[key]??null,null,label)
    for(const key of ['plotsAllowances','riposteLostMoves','riposteSkipped'] as const)assert.deepEqual(actual[key]??[],[],label)
    assert.deepEqual(actual.pendingDoomsayer??null,n===88?{player:'white',cardInstanceId:'black-deck-4-doomsayer'}:null,label)
    assert.equal(actual.pendingAbduction??null,null);assert.deepEqual(actual.underElfHill??[],[])
    assert.equal(actual.outcome,null,label)
    for(const color of ['white','black'] as const){
      const attackers=threats(pieces,color,magnet,crab),raw=threats(pieces,color,magnet,crab,true)
      const expectedRaw=color==='black'?(n===57||n===58?['white-knight-b1']:[]):([12,13,18].includes(n)?['black-pawn-d7']:n>=24?['black-bishop-c8',...(n>=87?['black-queen-d8']:[])]:[])
      assert.deepEqual(raw,expectedRaw,`${label}: independent raw royal rays`)
      assert.equal(isInCheck(actual,color),attackers.length>0,`${label}: ${color} variant check; raw ${raw.join(',')}`)
    }
    if(n===18||n===24){
      const saved=snapshots.get(n)!,pending=actual.pendingRescue!;assert.ok(pending,label)
      assert.equal(pending.fen,saved.fen);assert.deepEqual(pending.pieces,saved.pieces);assert.deepEqual(pending.enPassant,[])
      assert.equal(pending.historyLength,saved.history.length);assert.deepEqual(pending.history??actual.history.slice(0,pending.historyLength),saved.history)
      assert.deepEqual(pending.movedPieceIds,['white-king-e1']);if(pending.before)assert.deepEqual(pending.before,input)
      const cure:GameAction=n===18?{type:'playCard',cardId:'fortification',cardInstanceId:'white-deck-1-fortification',target:{from:'d6',to:'e5'}}:{type:'playCard',cardId:'fatal-attraction',cardInstanceId:'white-hand-0-fatal-attraction',target:'e4'}
      const checkpoint=structuredClone(actual),probe=applyAction(actual,cure);assert.deepEqual(actual,checkpoint);assert.ok(probe.ok)
      assert.equal(probe.state.pendingRescue??null,null);assert.equal(isInCheck(probe.state,'white'),false)
      assert.deepEqual(probe.state.pieces,pieces);assert.equal(probe.state.fen,actual.fen)
      assert.deepEqual(threats(pieces,'white',false,false),n===18?['black-pawn-d7']:['black-bishop-c8'])
      const card=n===18?{id:'white-deck-1-fortification',cardId:'fortification'}:{id:'white-hand-0-fatal-attraction',cardId:'fatal-attraction'}
      const expectedPlayers=structuredClone(players)
      expectedPlayers.white.hand=expectedPlayers.white.hand.filter(c=>c.id!==card.id)
      expectedPlayers.white.hand.push(expectedPlayers.white.deck.shift()!)
      assert.deepEqual(probe.state.players,expectedPlayers,`${label}: cure spends exact held card and draws once`)
      const cureEffect=n===18?{type:'fortification',owner:'white',card,from:'d6',to:'e5'}:{type:'fatal-attraction',owner:'white',card,pieceId:'white-king-e1'}
      assert.deepEqual(probe.state.effects,[...effects,cureEffect])
      assert.deepEqual(probe.state.turn,{color:'white',phase:'afterMove',moveMade:true,cardPlays:{white:1,black:0}})
      assert.deepEqual(probe.state.history,[...history,{type:'cardPlayed',cardId:card.cardId,target:n===18?{from:'d6',to:'e5'}:'e4',...(n===24?{movement:[],preservePreviousMove:true}:{})}])
      assert.deepEqual(probe.state.enPassant,[]);assert.deepEqual(probe.state.shieldMove,shield)
      if(n===18){
        assert.equal(at(pieces,'d6')?.id,'black-pawn-d7');assert.equal(at(pieces,'e5')?.id,'white-king-e1')
        assert.deepEqual(xy('e5').map((v,i)=>v-xy('d6')[i]!),[1,-1])
        // The sole threat crosses exactly the newly retained wall boundary.
      }else{
        assert.equal(at(pieces,'f5')?.id,'black-bishop-c8');assert.equal(at(pieces,'e4')?.id,'white-king-e1')
        assert.equal(frozen(pieces,at(pieces,'f5')!,true),true)
        assert.deepEqual(threats(pieces,'white',true,false),[])
      }
      const rescued=structuredClone(probe.state),ended=applyAction(probe.state,{type:'endTurn'})
      assert.deepEqual(probe.state,rescued,`${label}: immutable cured endTurn`);assert.ok(ended.ok)
      assert.deepEqual(ended.state.turn,{color:'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}})
      assert.deepEqual(ended.state.pieces,pieces);assert.deepEqual(ended.state.players,expectedPlayers)
      assert.deepEqual(ended.state.effects,probe.state.effects);assert.deepEqual(ended.state.history,probe.state.history)
      assert.equal(ended.state.fen,actual.fen);assert.deepEqual(ended.state.enPassant,[])
      assert.equal(ended.state.pendingRescue??null,null);assert.equal(ended.state.outcome,null)
      assert.equal(isInCheck(ended.state,'white'),false);assert.equal(isInCheck(ended.state,'black'),false)
    }else assert.equal(actual.pendingRescue??null,null,label)
  }
  assert.equal(trace.moves,35);assert.equal(Object.keys(cards).length,15)
  assert.equal(actual.fen,'4k3/1q1n1p1R/3pp3/5bpp/PP2K1P1/B1bPPP2/5N1P/R3Q2r w - - 0 21')
  assert.deepEqual(threats(pieces,'white',true,true),['black-queen-d8'])
  // Independently exhaust ordinary movement, including releasing the magnet when
  // the royal moves. No piece can capture Qb7 or interpose on c6/d5.
  const escapes:string[]=[]
  for(const p of pieces.filter(p=>p.owner==='white'&&p.zone==='board'&&!frozen(pieces,p,true))){
    for(let x=0;x<8;x++)for(let y=0;y<8;y++){
      const to=square(x,y),victim=at(pieces,to)
      if(victim?.owner==='white'||victim?.royal||!geometry(pieces,p,to,!!victim))continue
      const board=structuredClone(pieces),mover=board.find(q=>q.id===p.id)!
      if(victim){const captured=board.find(q=>q.id===victim.id)!;captured.square=null;captured.zone='captured'}
      mover.square=to
      if(!threats(board,'white',!p.royal,true).length)escapes.push(`${p.square}-${to}`)
    }
  }
  assert.deepEqual(escapes,[])
  assert.deepEqual(players.white.hand.map(c=>c.cardId),['confabulation','crusade','holy-war','betrayal','panic','forced-march'])
  // Confabulation must merge on an occupied friendly square, whereas the entire
  // checking ray is empty. Betrayal has no enemy Pawn on Whites half. The only
  // Bishop is a3 (opposite color to b7/c6/d5/e4), so neither its Crusade extension
  // nor a Holy War swap following a provisional move can block this checking ray.
  for(const s of ['b7','c6','d5'])assert.notEqual(at(pieces,s)?.owner,'white')
  assert.deepEqual(pieces.filter(p=>p.owner==='black'&&p.role==='pawn'&&p.square&&Number(p.square[1])<=4),[])
  assert.deepEqual(pieces.filter(p=>p.owner==='white'&&p.role==='bishop'&&p.square).map(p=>p.square),['a3'])
  assert.equal((xy('a3')[0]+xy('a3')[1])%2,0)
  for(const s of ['b7','c6','d5','e4'])assert.equal((xy(s)[0]+xy(s)[1])%2,1)
  // Panic cannot remove the existing attack. Holy War has only Knight f2 and
  // Bishop a3; neither can reach a checking-ray square in its first regular move.
  const knight=at(pieces,'f2')!,bishop=at(pieces,'a3')!
  for(const s of ['b7','c6','d5']){assert.equal(geometry(pieces,knight,s,!!at(pieces,s)),false);assert.equal(geometry(pieces,bishop,s,!!at(pieces,s)),false)}
  // Forced March (§13.6) moves one or two Pawns one square SIDEWAYS.
  // Enumerate destinations against the initial board, then test every legal
  // single and simultaneous pair; no such placement stops Qb7-c6-d5-e4.
  const lateral:Array<{id:string,from:SquareName,to:SquareName}>=[]
  for(const p of pieces.filter(p=>p.owner==='white'&&p.originalRole==='pawn'&&!p.promoted&&p.zone==='board'&&!frozen(pieces,p,true))){
    const [x,y]=xy(p.square!)
    for(const dx of [-1,1])if(x+dx>=0&&x+dx<8){const to=square(x+dx,y);if(!at(pieces,to))lateral.push({id:p.id,from:p.square!,to})}
  }
  assert.deepEqual(lateral.map(m=>`${m.from}-${m.to}`),['b4-c4','g4-f4','g4-h4','h2-g2'])
  const marches=lateral.map(m=>[m])
  for(let i=0;i<lateral.length;i++)for(let j=i+1;j<lateral.length;j++){
    const a=lateral[i]!,b=lateral[j]!
    if(a.id!==b.id&&a.to!==b.to)marches.push([a,b])
  }
  assert.equal(marches.length,9)
  for(const march of marches){const board=structuredClone(pieces);for(const m of march)board.find(p=>p.id===m.id)!.square=m.to;assert.deepEqual(threats(board,'white',true,true),['black-queen-d8'])}
  // Terminal state is accepted by endTurn, but generateTrace rejects all terminal
  // candidates before 50 moves. This explains the stall without a fabricated PASS.
  const input=structuredClone(actual),ended=applyAction(actual,{type:'endTurn'});assert.deepEqual(actual,input);assert.ok(ended.ok)
  assert.deepEqual(ended.state.outcome,{winner:'black',reason:'checkmate'})
  assert.match(trace.failure??'',/No continuing action at step 91/)
})
