import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameAction, GameEvent, GameState, PieceState, Color, SquareName } from '../types.js'

// Independently read against rules §§8–14,19 and the fifteen relevant card artworks.
const rationales = `
1 Guardian advances e2 to empty e3 without its optional follower; replacement move, no EP.
2 White closes Guardian; Black receives fresh move and card allowances.
3 Black g7-g5 crosses empty g6; uncapturable g6 opportunity, pawn clock reset.
4 Black closes; no White pawn can capture on g6.
5 White Nb1-c3 is an unobstructed Knight jump.
6 Disintegration kills the owned e3 Pawn permanently and preserves the Knight move.
7 White closes after spending its card and drawing Fortification.
8 Black Nb8-a6 is a Knight jump to empty a6.
9 Heresy moves White Bc1-b1 first and Black Bc8-b8 second; f1/f8 Bishops have no empty orthogonal neighbor.
10 Black closes Heresy, preserving both Bishop identities.
11 Ghostwalk sends Rh1-h3 through owned h2 Pawn without capture and revokes K right.
12 White closes the replacement move.
13 Black d7-d6 is one clear forward Pawn step.
14 Black closes with pawn clock zero.
15 White f2-f3 is one clear forward Pawn step.
16 White closes with no card expenditure.
17 Black c7-c5 crosses empty c6 and records an uncapturable c6 EP opportunity.
18 Black closes while retaining the c6 opportunity for White.
19 White Rh3-h6 crosses empty h4/h5, clearing EP.
20 Mystic Shield protects exactly the just-moved h1 Rook at h6 through Black's next turn.
21 White closes; Shield remains during Black's turn.
22 Black f7-f5 crosses empty f6; Shield still protects h6 Rook.
23 Black closes; the Shield expires before White acts.
24 White Rh6-h3 crosses empty h5/h4.
25 White closes and leaves both hands untouched.
26 Black Ng8-h6 is a Knight jump to the vacated square.
27 Black closes the noncapture.
28 White Bf1-e2 slides one diagonal square.
29 White closes with Bishop identity intact.
30 Annexation sends Black d6-d4 through empty d5; d6 is not its starting square, so no EP.
31 Black closes Annexation; no additional regular move.
32 White Ke1-f1 enters an unattacked empty square and removes the Q castling right.
33 White closes; Black retains both original castling rights.
34 Black d4-d3 takes a clear forward step.
35 Black closes with d3 Pawn alive.
36 White Nc3-e4 jumps to an empty square.
37 White closes this quiet Knight move.
38 Black Qd8-a5 slides through c7 and b6, both empty.
39 Black closes the Queen move.
40 White Ne4-f6 gives Knight check to Black e8.
41 White closes; Black receives an escape turn in check.
42 Doppelganger Na6-c7 copies the last Knight geometry but leaves Nf6 checking e8; it fizzles, spends/draws, and preserves Black's escape move.
43 Black Ke8-d8 escapes Nf6 and revokes both castling rights.
44 Black closes with its King safe on d8.
45 White Rh3-h4 is a one-square clear file move.
46 White closes with both Kings safe.
47 Black Qa5-c3 crosses empty b4.
48 Black closes the Queen relocation.
49 White g2-g3 advances into an empty square.
50 White closes; no card was played.
51 Black Qc3-d4 is a clear one-square diagonal.
52 Black closes the noncapture.
53 White c2xd3 captures the Black d7 Pawn, credited to White.
54 White closes; Black's Riposte window is waived.
55 Black Na6-c7 is now safe because its King left e8.
56 Black closes this Knight move.
57 White Qd1-c1 slides to the emptied Bishop square.
58 Coup makes White's b1 Bishop royal and demotes f1 King to capturable Prince without changing movement roles.
59 White closes; the b1 Bishop is its sole royal piece.
60 Black Qd4-d6 crosses empty d5.
61 Black closes with White's b1 royal safe.
62 White b2-b3 takes one forward Pawn step.
63 White closes the Pawn move.
64 Black Qd6xd3 crosses d5/d4, captures White c2 Pawn and checks b1 along empty c2.
65 Black closes; White must answer the Queen check.
66 White Nf6-g8 leaves b1 checked provisionally; held Fortification d3-c2 is an independently executed cure.
67 Truce immediately ends on the raw d3-c2-b1 check; spend/draw it and roll back the provisional Knight move, preserving White's escape move.
68 White Qc1-c2 interposes on d3-c2-b1 and replaces the inert canceled Knight movement token.
69 White closes with the royal Bishop saved by c2 Queen.
70 Black Qd3-d4 slides one square away.
71 Black closes with no remaining check.
72 White Nf6-d5 is a legal empty-square jump.
73 Fortification creates the exact undirected b4-c3 wall; no pieces, clocks, or EP change.
74 White closes with Coup and wall retained.
75 Black Nh6-f7 jumps to an empty square.
76 Earthquake turns forward east/west; White h2 promotes to Queen first, Black a7 to Rook second; pieces and wall keep fixed coordinates.
77 Black closes; rotated Pawn movement remains active.
78 White Qc2-c4 crosses empty c3 without crossing the b4-c3 wall.
79 White closes this clear file move.
80 Black promoted Ra7-a3 crosses empty a6/a5/a4; promotion and original Pawn identity remain.
81 Black closes the promoted Rook move.
82 White Qc4-b4 moves horizontally and does not cross the diagonal wall.
83 White closes the Queen move.
84 Black Qd4-g7 crosses empty e5/f6.
85 Black closes this diagonal move.
86 White b3-c3 is forward after clockwise Earthquake and does not cross b4-c3.
87 White closes the rotated Pawn move.
88 Long Jump sends Black Nc7-c6 to the opposite square color; no capture, consumes move.
89 Black closes Long Jump and retains its drawn Evangelists.
90 White Be2-d1 is a clear one-square diagonal.
91 White closes the Bishop move.
92 Black Ra8-a7 slides to its empty neighbor.
93 Black closes the Rook move.
94 White Qb4xc5 captures Black c7 Pawn without crossing b4-c3; White is captor.
95 White closes the capture; Riposte cannot take the Queen.
96 Black Ra7-a8 returns along a clear file, without restoring castling rights.
97 Black closes the Rook return.
98 White royal Bb1-c2 follows Bishop geometry to a safe square.
99 White closes with the royal Bishop at c2.
100 Black promoted Ra3-b3 moves horizontally without capture.
101 Black closes; its b3 Rook does not attack c2 diagonally.
102 White Rh4-h3 is a clear file step.
103 White closes the Rook move.
104 Black Nc6-a7 makes a clear Knight jump.
105 Black closes the Knight move.
106 White Qc5-d6 slides diagonally and checks Black d8 through empty d7.
107 White closes; Black has an escape turn.
108 Black Na7-b5 provisionally leaves Qd6 check; held Charge b5xd6 is the concrete cure.
109 Charge repeats the same Knight's noncapturing first move with b5xd6, captures the checking Queen for Black, and clears rescue.
110 Black closes with King d8 safe.
111 White Rh3xh7 crosses empty h4/h5/h6 and captures Black h7 Pawn for White.
112 White closes this Rook capture.
113 Black Ra8-a5 crosses empty a7/a6.
114 Black closes with its Rook on a5.
115 White royal Bc2-b1 enters the b3-b2-b1 Rook ray provisionally; held Doomsayer and Black naming that Rook is an executed cure.
116 Curse on b8 Bishop leaves the b3 Rook check, so it fizzles/spends/draws and restores Bc2 plus the pre-move FEN/history.
`.trim().split('\n')

const colors = ['white', 'black'] as const
const other = (c: Color): Color => c === 'white' ? 'black' : 'white'
const coord = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const square = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName
const at = (s: GameState, q: string) => s.pieces.find(p => p.zone === 'board' && p.square === q)
const effectType = (e: unknown) => (e as { type: string }).type
const copy = <T>(v: T): T => structuredClone(v)

function geometry(s: GameState, p: PieceState, to: string, capture: boolean, ghost = false): boolean {
  const [x,y] = coord(p.square!), [u,v] = coord(to), dx=u-x, dy=v-y
  if (!dx && !dy) return false
  if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2
  let distance = Math.max(Math.abs(dx), Math.abs(dy))
  if (p.role === 'pawn') {
    const sign = p.owner === 'white' ? 1 : -1
    const forward = s.orientation === 0 ? dy*sign : dx*sign
    const sideways = s.orientation === 0 ? dx : dy
    const rank = s.orientation === 0 ? (sign === 1 ? y : 7-y) : (sign === 1 ? x : 7-x)
    if (capture) { if (forward !== 1 || Math.abs(sideways) !== 1) return false }
    else if (sideways !== 0 || !(forward === 1 || forward === 2 && rank <= 1)) return false
  } else if (p.role === 'king') { if (distance !== 1) return false }
  else if (p.role === 'bishop') { if (Math.abs(dx) !== Math.abs(dy)) return false }
  else if (p.role === 'rook') { if (dx && dy) return false }
  else if (p.role === 'queen') { if (dx && dy && Math.abs(dx) !== Math.abs(dy)) return false }
  for (const e of s.effects) if (effectType(e) === 'curse' && (e as {pieceId:string}).pieceId === p.id && distance > 2) return false
  let prev = p.square!
  for (let n=1;n<=distance;n++) {
    const q = square(x+Math.sign(dx)*n,y+Math.sign(dy)*n)
    for (const e of s.effects) if (effectType(e) === 'fortification') {
      const wall=e as {from:string;to:string}
      if (wall.from===prev && wall.to===q || wall.to===prev && wall.from===q) return false
    }
    const occupant = at(s,q)
    if(n<distance && occupant && !(ghost && occupant.owner===p.owner)) return false
    prev=q
  }
  return true
}

function checked(s: GameState,c:Color): boolean {
  const king=s.pieces.find(p=>p.zone==='board' && p.owner===c && p.royal)!
  assert.ok(king, 'one on-board royal for each color')
  return s.pieces.some(p=>p.zone==='board' && p.owner!==c && geometry(s,p,king.square!,true))
}

function boardFen(s: GameState): string {
  const letters={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}
  return Array.from({length:8},(_,i)=>{
    let row='',empty=0
    for(let x=0;x<8;x++) {
      const p=at(s,square(x,7-i))
      if(!p) {empty++;continue}
      if(empty) row+=empty
      empty=0
      row+=p.owner==='white'?letters[p.role].toUpperCase():letters[p.role]
    }
    return row+(empty||'')
  }).join('/')
}

function syncFen(s:GameState) { const fields=s.fen.split(' '); fields[0]=boardFen(s);s.fen=fields.join(' ') }
function advance(s:GameState,p:PieceState,captured:boolean,additional=false) {
  const f=s.fen.split(' ')
  if(!additional) { f[1]=s.turn.color==='white'?'b':'w';f[5]=String(Number(f[5])+(s.turn.color==='black'?1:0)) }
  f[4]=p.role==='pawn'||captured?'0':String(Number(f[4])+1)
  if(p.royal) f[2]=f[2]!.replace(p.owner==='white'?/[KQ]/g:/[kq]/g,'')||'-'
  if(p.role==='rook' && p.square==='h1') f[2]=f[2]!.replace('K','')||'-'
  f[3]='-';s.fen=f.join(' ')
  s.turn.phase='afterMove';s.turn.moveMade=true;s.enPassant=[]
}

function relocate(s:GameState,from:string,to:string,additional=false,ghost=false) {
  const p=at(s,from)!; assert.ok(p);assert.equal(p.owner,s.turn.color)
  const victim=at(s,to);assert.ok(!victim||victim.owner!==p.owner)
  assert.ok(geometry(s,p,to,!!victim,ghost),`${p.id} ${from}-${to}: independent movement geometry`)
  if(victim) {assert.equal(victim.royal,false);victim.zone='captured';victim.square=null;victim.capturedBy=p.owner}
  const original=copy(p);advance(s,p,!!victim,additional);p.square=to as SquareName
  const [x,y]=coord(from),[u,v]=coord(to)
  if(original.role==='pawn' && Math.max(Math.abs(x-u),Math.abs(y-v))===2) s.enPassant=[{target:square((x+u)/2,(y+v)/2),pawnId:p.id}]
  s.shieldMove={player:s.turn.color,pieceIds:[p.id],capturedOpponent:!!victim}
  syncFen(s)
  return {p:original,victim}
}

function spend(s:GameState,a:Extract<GameAction,{type:'playCard'}>,retain:boolean) {
  const owner=s.turn.color,p=s.players[owner]
  const card=p.hand.find(c=>c.id===a.cardInstanceId && c.cardId===a.cardId)
  assert.ok(card,`${a.cardId}: exact physical card held by actor`)
  assert.equal(s.turn.cardPlays[owner],0)
  p.hand=p.hand.filter(c=>c.id!==card.id)
  if(!retain) p.discard.push(card)
  const drawn=p.deck.shift();if(drawn)p.hand.push(drawn)
  s.turn.cardPlays[owner]++
  s.playedCards=[...(s.playedCards??[]),{player:owner,cardInstanceId:card.id}]
  return card
}

function publicAssert(actual:GameState,expected:GameState,label:string) {
  for(const key of ['pieces','players','turn','effects','history','fen','enPassant','orientation','outcome','shieldMove'] as const)
    assert.deepEqual(actual[key],expected[key],`${label}: ${key}`)
  assert.deepEqual(actual.playedCards??[],expected.playedCards??[],`${label}: played physical cards`)
  assert.deepEqual(actual.cardResponse,expected.cardResponse,`${label}: response window`)
  for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const) assert.equal(actual[key],undefined,`${label}: ${key}`)
  for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const) assert.deepEqual(actual[key]??[],[],`${label}: ${key}`)
  assert.equal(actual.pendingAbduction??null,null);assert.equal(actual.pendingDoomsayer??null,null)
  const before=copy(actual)
  for(const c of colors) assert.equal(isKingInCheck(actual,c),checked(expected,c),`${label}: independent ${c} royal threat`)
  assert.deepEqual(actual,before,`${label}: royal queries immutable`)
  // All trace EP targets lack any geometrically eligible captor. Query from the
  // prospective reply player's before-move window, not the prior actor's reaction window.
  if(expected.enPassant.length) {
    const q=copy(actual),reply=actual.fen.split(' ')[1]==='w'?'white':'black'
    q.turn={color:reply,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
    const snapshot=copy(q),dests=legalDests(q)
    for(const ep of expected.enPassant) for(const p of expected.pieces.filter(p=>p.zone==='board'&&p.role==='pawn'&&p.owner===reply)) {
      assert.equal(geometry(expected,p,ep.target,true),false,`${label}: no prospective EP geometry ${p.square}-${ep.target}`)
      assert.equal(dests.get(p.square!)?.includes(ep.target)??false,false)
    }
    assert.deepEqual(q,snapshot,`${label}: prospective EP query immutable`)
  }
}

test('iteration 187 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/187.json', import.meta.url), 'utf8')) as RandomTrace
  replayTrace(trace)
})

const cardRows: Record<number, { cardId:string; cardInstanceId:string; target?:unknown }> = {
  1:{cardId:'guardian',cardInstanceId:'white-hand-2-guardian',target:[{from:'e2',to:'e3'}]},
  6:{cardId:'disintegration',cardInstanceId:'white-hand-1-disintegration',target:'e3'},
  9:{cardId:'heresy',cardInstanceId:'black-hand-4-heresy',target:[{from:'c1',to:'b1'},{from:'c8',to:'b8'}]},
  11:{cardId:'ghostwalk',cardInstanceId:'white-hand-3-ghostwalk',target:[{from:'h1',to:'h3'}]},
  20:{cardId:'mystic-shield',cardInstanceId:'white-hand-4-mystic-shield',target:'h6'},
  30:{cardId:'annexation',cardInstanceId:'black-hand-2-annexation',target:[{from:'d6',to:'d4'}]},
  42:{cardId:'doppelganger',cardInstanceId:'black-hand-3-doppelganger',target:[{from:'a6',to:'c7'}]},
  58:{cardId:'coup',cardInstanceId:'white-deck-0-coup',target:'b1'},
  67:{cardId:'truce',cardInstanceId:'white-hand-0-truce'},
  73:{cardId:'fortification',cardInstanceId:'white-deck-1-fortification',target:{from:'b4',to:'c3'}},
  76:{cardId:'earthquake',cardInstanceId:'black-deck-2-earthquake',target:{direction:'clockwise',promotions:[{square:'h2',role:'queen'},{square:'a7',role:'rook'}]}},
  88:{cardId:'long-jump',cardInstanceId:'black-deck-3-long-jump',target:[{from:'c7',to:'c6'}]},
  109:{cardId:'charge',cardInstanceId:'black-deck-1-charge',target:[{from:'b5',to:'d6'}]},
  116:{cardId:'curse',cardInstanceId:'white-deck-5-curse',target:'b8'},
}

function immutableAction(s:GameState,a:GameAction) {
  const before=copy(s),payload=copy(a),r=applyAction(s,a)
  assert.deepEqual(s,before,'action input state immutable, including captors/checkpoints')
  assert.deepEqual(a,payload,'action payload immutable')
  assert.ok(r.ok,JSON.stringify(a))
  return r.state
}

function closeOracle(s:GameState) {
  assert.equal(checked(s,s.turn.color),false,'cannot close an unresolved royal attack')
  const actor=s.turn.color
  s.effects=s.effects.filter(e=>!(effectType(e)==='mystic-shield'&&(e as {owner:Color}).owner!==actor))
  s.turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
  delete s.shieldMove;delete s.cardResponse
}

function rescueWitness(actual:GameState,expected:GameState,step:number) {
  let probe=copy(actual),oracle=copy(expected)
  assert.equal(checked(oracle,oracle.turn.color),true)
  const original=copy(probe),endPayload:GameAction={type:'endTurn'},endSnapshot=copy(endPayload)
  assert.equal(applyAction(probe,endPayload).ok,false,'pending rescue prevents premature endTurn')
  assert.deepEqual(probe,original);assert.deepEqual(endPayload,endSnapshot)
  if(step===66) {
    // Qd3 checks the royal Bb1 via c2; the wall intersects that exact ray.
    assert.equal(at(oracle,'d3')?.id,'black-queen-d8');assert.equal(at(oracle,'c2'),undefined)
    const a:GameAction={type:'playCard',cardId:'fortification',cardInstanceId:'white-deck-1-fortification',target:{from:'d3',to:'c2'}}
    const card=spend(oracle,a,true)
    oracle.effects.push({type:'fortification',owner:'white',card,from:'d3',to:'c2'})
    oracle.history.push({type:'cardPlayed',cardId:'fortification',target:{from:'d3',to:'c2'}})
    oracle.cardResponse={player:'white',historyLength:oracle.history.length}
    probe=immutableAction(probe,a)
  } else if(step===108) {
    assert.equal(at(oracle,'d6')?.id,'white-queen-d1');assert.equal(at(oracle,'d7'),undefined)
    const a:GameAction={type:'playCard',...cardRows[109]!}
    spend(oracle,a,false)
    relocate(oracle,'b5','d6',true)
    oracle.history.push({type:'cardPlayed',from:'b5',to:'d6',capturedId:'white-queen-d1',movedPieceId:'black-knight-b8',movedRoles:['knight'],cardId:'charge',target:[{from:'b5',to:'d6'}],preservePreviousMove:false,movement:[{from:'b5',to:'d6'}]})
    oracle.cardResponse={player:'black',historyLength:oracle.history.length}
    probe=immutableAction(probe,a)
  } else {
    // Promoted Ra7 now on b3 checks the royal Bb1 through empty b2.
    assert.equal(at(oracle,'b3')?.id,'black-pawn-a7');assert.equal(at(oracle,'b2'),undefined)
    const a:GameAction={type:'playCard',cardId:'doomsayer',cardInstanceId:'white-deck-6-doomsayer'}
    const card=spend(oracle,a,true)
    oracle.history.push({type:'cardPlayed',cardId:'doomsayer',movement:[],preservePreviousMove:true})
    oracle.cardResponse={player:'white',historyLength:oracle.history.length}
    probe=immutableAction(probe,a)
    assert.deepEqual(probe.pendingDoomsayer,{player:'black',cardInstanceId:card.id})
    assert.deepEqual(probe.pieces,oracle.pieces)
    assert.deepEqual(probe.players,oracle.players)
    assert.deepEqual(probe.history,oracle.history)
    assert.equal(probe.fen,oracle.fen)
    assert.deepEqual(probe.effects,[...oracle.effects,{type:'doomsayer',owner:'white',card}])
    assert.ok(probe.pendingRescue)
    const a2:GameAction={type:'namePiece',speaker:'black',name:'rook',losses:[{effectId:card.id,pieceId:'black-pawn-a7'}]}
    const victim=at(oracle,'b3')!;victim.zone='captured';victim.square=null;victim.capturedBy='white'
    oracle.players.white.discard.push(card)
    oracle.history.push({type:'pieceNamed',speaker:'black',name:'rook',capturedIds:['black-pawn-a7'],resolvedEffectIds:[card.id]})
    const f=oracle.fen.split(' ');f[4]='0';oracle.fen=f.join(' ');syncFen(oracle)
    probe=immutableAction(probe,a2)
  }
  assert.equal(probe.pendingRescue??null,null)
  publicAssert(probe,oracle,`rescue ${step}`)
  closeOracle(oracle)
  probe=immutableAction(probe,{type:'endTurn'})
  publicAssert(probe,oracle,`rescue ${step} closed`)
}

test('iteration 187: every action has an independent semantic oracle and rescue witnesses',()=>{
  const trace=JSON.parse(readFileSync(new URL('../../../campaign/iterations/187.json',import.meta.url),'utf8')) as RandomTrace
  assert.equal(trace.steps.length,116);assert.equal(rationales.length,trace.steps.length)
  assert.equal(trace.moves,50);assert.equal(trace.failure,undefined)
  let actual=createGameState(trace.initial),expected=createGameState(trace.initial)
  let beforeMove=copy(expected),moves=0,cards=0
  for(const [index,{action}] of trace.steps.entries()) {
    const n=index+1,label=rationales[index]!
    assert.ok(label.startsWith(`${n} `))
    const beforeActual=copy(actual),beforeExpected=copy(expected)
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from=action.from,to=action.to
      assert.equal(expected.turn.phase,'beforeMove');assert.equal(expected.turn.moveMade,false)
      beforeMove=copy(expected)
      const {p,victim}=relocate(expected,from,to)
      const event:GameEvent={type:'move',from:from as SquareName,to:to as SquareName}
      if(victim)event.capturedId=victim.id
      // Toll needs physical identity after the turn changes, unlike ordinary notation.
      if(p.owner==='black'&&n>=13){event.movedPieceId=p.id;event.movedRoles=[p.role]}
      expected.history.push(event);moves++
    } else if(action.type==='endTurn') {
      assert.equal(expected.turn.moveMade,true)
      closeOracle(expected)
    } else if(action.type==='playCard') {
      cards++
      assert.deepEqual(action,{type:'playCard',...cardRows[n]!},`${label}: independently reviewed exact card payload`)
      const replacement=[1,11,30,42,88].includes(n)
      assert.equal(expected.turn.phase,replacement?'beforeMove':'afterMove')
      assert.equal(expected.turn.moveMade,!replacement)
      const owner=expected.turn.color,retain=[58,73,76].includes(n)
      const card=spend(expected,action,retain)
      let event:GameEvent={type:'cardPlayed',cardId:action.cardId,...(action.target===undefined?{}:{target:action.target as GameEvent['target']})}
      if(n===1) {
        relocate(expected,'e2','e3');expected.enPassant=[]
        event.movement=[{from:'e2',to:'e3'}];event.preservePreviousMove=false
      } else if(n===6) {
        const pawn=at(expected,'e3')!;assert.equal(pawn.id,'white-pawn-e2');pawn.zone='dead';pawn.square=null
        delete pawn.capturedBy;syncFen(expected);event.movement=[];event.preservePreviousMove=true
      } else if(n===9) {
        // Both f-file Bishops are surrounded at their four color-changing neighbors.
        for(const from of ['f1','f8']) {
          const [x,y]=coord(from)
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const u=x+dx!,v=y+dy!
            if(u>=0&&u<8&&v>=0&&v<8)assert.ok(at(expected,square(u,v)))
          }
        }
        for(const [from,to] of [['c1','b1'],['c8','b8']]) {assert.equal(at(expected,to!),undefined);at(expected,from!)!.square=to as SquareName}
        syncFen(expected);event.movement=[{from:'c1',to:'b1'},{from:'c8',to:'b8'}];event.preservePreviousMove=true
      } else if(n===11) {
        relocate(expected,'h1','h3',false,true)
        event.movement=[{from:'h1',to:'h3'}];event.preservePreviousMove=false
      } else if(n===20) {
        assert.deepEqual(expected.shieldMove,{player:'white',pieceIds:['white-rook-h1'],capturedOpponent:false})
        expected.effects.push({type:'mystic-shield',owner:'white',player:'white',pieceId:'white-rook-h1'})
        event.player='white';event.movement=[];event.preservePreviousMove=true
      } else if(n===30) {
        const p=at(expected,'d6')!;assert.equal(p.role,'pawn')
        assert.equal(at(expected,'d5'),undefined);assert.equal(at(expected,'d4'),undefined)
        advance(expected,p,false);p.square='d4';expected.enPassant=[]
        expected.shieldMove={player:'black',pieceIds:[p.id],capturedOpponent:false};syncFen(expected)
        event.movement=[{from:'d6',to:'d4'}];event.preservePreviousMove=false
      } else if(n===42) {
        assert.equal(checked(expected,'black'),true)
        assert.equal(at(expected,'f6')?.role,'knight')
        const staged=copy(expected);relocate(staged,'a6','c7')
        assert.equal(checked(staged,'black'),true)
        event={type:'cardFizzled',cardId:'doppelganger',reason:'SELF_CHECK',movement:[],preservePreviousMove:false}
        delete expected.shieldMove
      } else if(n===58) {
        at(expected,'f1')!.royal=false;at(expected,'b1')!.royal=true
        expected.effects.push({type:'coup',owner:'white',card,princeId:'white-king-e1',kingId:'white-bishop-c1',princeRole:'king'})
        event.movement=[];event.preservePreviousMove=true
      } else if(n===67||n===116) {
        assert.equal(checked(expected,'white'),true)
        // Truce ends on raw check; Curse limits b8 Bishop, not the checking b3 Rook.
        if(n===116){const staged=copy(expected);staged.effects.push({type:'curse',owner:'white',card,pieceId:'black-bishop-c8'});assert.equal(checked(staged,'white'),true)}
        expected.pieces=copy(beforeMove.pieces);expected.fen=beforeMove.fen;expected.enPassant=copy(beforeMove.enPassant)
        expected.history=copy(beforeMove.history);expected.turn.phase='beforeMove';expected.turn.moveMade=false
        event={type:'cardFizzled',cardId:action.cardId,reason:'SELF_CHECK',movement:[],preservePreviousMove:false}
      } else if(n===73) {
        expected.effects.push({type:'fortification',owner,card,from:'b4',to:'c3'})
      } else if(n===76) {
        expected.orientation=90
        const white=at(expected,'h2')!,black=at(expected,'a7')!
        assert.equal(white.role,'pawn');assert.equal(black.role,'pawn')
        white.role='queen';white.promoted=true;black.role='rook';black.promoted=true
        expected.effects.push({type:'earthquake',owner,card,direction:'clockwise',target:copy(action.target)})
        syncFen(expected);event.movement=[];event.preservePreviousMove=true
      } else if(n===88) {
        const p=at(expected,'c7')!;assert.equal(p.role,'knight');assert.equal(at(expected,'c6'),undefined)
        assert.notEqual((2+6)%2,(2+5)%2)
        advance(expected,p,false);p.square='c6';syncFen(expected)
        expected.shieldMove={player:'black',pieceIds:[p.id],capturedOpponent:false}
        event.movement=[{from:'c7',to:'c6'}];event.preservePreviousMove=false
      } else if(n===109) {
        assert.deepEqual(expected.shieldMove,{player:'black',pieceIds:['black-knight-b8'],capturedOpponent:false})
        const {p,victim}=relocate(expected,'b5','d6',true)
        assert.equal(victim?.id,'white-queen-d1')
        event={...event,from:'b5',to:'d6',capturedId:victim!.id,movedPieceId:p.id,movedRoles:['knight'],preservePreviousMove:false,movement:[{from:'b5',to:'d6'}]}
      } else assert.fail(`unreviewed card at ${n}`)
      expected.history.push(event)
      expected.cardResponse={player:owner,historyLength:expected.history.length}
    } else assert.fail(`unreviewed action ${action.type}`)
    actual=immutableAction(actual,action)
    publicAssert(actual,expected,label)
    const rescue=[66,108,115].includes(n)
    if(rescue) {
      assert.deepEqual(actual.pendingRescue,{before:beforeActual,fen:beforeExpected.fen,pieces:beforeExpected.pieces,enPassant:beforeExpected.enPassant,historyLength:beforeExpected.history.length,movedPieceIds:expected.shieldMove!.pieceIds},`${label}: complete rescue checkpoint`)
      rescueWitness(actual,expected,n)
    } else assert.equal(actual.pendingRescue??null,null,`${label}: no pending rescue`)
    if(n===67||n===116) {
      // A restored board may keep an inert move token. Reset card allowance to
      // distinguish genuine timing rejection from CARD_ALREADY_PLAYED.
      const probe=copy(actual)
      probe.turn.cardPlays.white=0
      probe.players.white.hand.push({id:'probe-shield',cardId:'mystic-shield'})
      const snapshot=copy(probe),a:GameAction={type:'playCard',cardId:'mystic-shield',cardInstanceId:'probe-shield',target:n===67?'f6':'c2'},payload=copy(a)
      const r=applyAction(probe,a)
      assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error.code,'INVALID_TIMING')
      assert.deepEqual(probe,snapshot);assert.deepEqual(a,payload)
    }
  }
  assert.equal(moves,50);assert.equal(cards,14)
  assert.equal(actual.fen,'1b1k1b1r/1p2pnqR/3n4/r2N1pp1/8/1rP2PP1/P1BP3Q/R2B1KN1 w - - 1 27')
})
