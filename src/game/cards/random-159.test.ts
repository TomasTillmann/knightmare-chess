import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName, CardMove } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Reviewed against rules §§8–13,15–16,20 and all fourteen played card images.
// Every numbered row describes one action; the independent model below reconstructs
// physical identities, all FEN fields, card zones, effects, and royal threats.
const rationales = `
1 Guardian advances c2-c4 through empty c3; c1 Bishop follows to c3, preventing en passant; consumes move.
2 White ends its completed Guardian turn; Black receives fresh allowances.
3 Black Ng8-f6 is an empty knight jump.
4 Black ends; White receives the move.
5 White Bc3xf6 follows empty d4,e5 and captures the original g8 Knight.
6 White ends after its capture.
7 Black e7xf6 captures that Bishop one diagonal forward.
8 Black ends after the recapture.
9 White e2-e4 advances through empty e3; e3 opportunity has no adjacent Black captor.
10 Heresy moves f8-g8 orthogonally; c8 and f1 have no empty opposite-color adjacent square. Preserve e3 opportunity.
11 White ends; raw e3 FEN survives Heresy but Black has no legal en-passant capture.
12 Black d7-d6 advances one; prior en passant expires.
13 Black ends its Pawn move.
14 White h2-h4 traverses empty h3; no adjacent Black en-passant captor.
15 White ends; h3 opportunity remains for next move only.
16 Black f6-f5 advances the original e7 Pawn; h3 opportunity expires.
17 Black ends its Pawn move.
18 White g2-g3 advances into empty g3.
19 White ends its Pawn move.
20 Black Ke8-e7 steps safely; both Black castling rights are permanently lost.
21 Black ends with safe King on e7.
22 White Bf1-h3 follows empty g2 to empty h3.
23 White ends its Bishop move.
24 Black b7-b6 advances into empty b6.
25 Black ends its Pawn move.
26 White Qd1-e2 makes one diagonal noncapture.
27 White ends its Queen move.
28 Black Nb8-d7 jumps into empty d7.
29 Black ends its Knight move.
30 White Qe2-f1 makes one diagonal noncapture.
31 White ends its Queen move.
32 Annexation b6-b4 crosses empty b5; not from starting square, so no en passant; consumes Black move.
33 Black ends Annexation.
34 White Ng1-e2 jumps into empty e2.
35 White ends its Knight move.
36 Black h7-h5 traverses empty h6; h6 opportunity has no White captor.
37 Black ends; h6 opportunity survives until next move.
38 White Ne2-g1 jumps back; old en passant expires.
39 Neutrality marks opposing nonroyal Pawn g7; keeps owner and physical role, draws Madman, stays beside board.
40 White ends; neutrality persists.
41 Black f5xe4 captures White original e2 Pawn diagonally forward.
42 Black plays Truce after capture; neither royal has a raw attack, so continuing capture ban persists.
43 Black ends; raw royal safety leaves Truce active.
44 White d2-d3 advances without capture under Truce.
45 White ends; no raw check ends Truce.
46 Black Ke7-e8 makes one safe step, without restoring castling rights.
47 Black ends; Truce persists.
48 White Bh3-e6 follows empty g4,f5 without capture; no raw royal check.
49 Curse marks Black Rh8; continuing two-square maximum; no board movement.
50 White ends; Truce and Curse persist.
51 Black Bg8-h7 makes one diagonal noncapture under Truce.
52 Black ends; no raw check ends Truce.
53 White g3-g4 advances without capture under Truce.
54 Peace Talks removes exactly Black Truce to Black discard; White spends Peace Talks and draws Mystic Shield.
55 White ends; Neutrality and Curse remain, capture ban ends.
56 Black Nd7-c5 jumps into empty c5.
57 Black ends its Knight move.
58 Madman jumps White d3-b5 over its c4 Pawn, without capturing that jumped Pawn; consumes move.
59 White ends Madman.
60 Black h5xg4 captures White original g2 Pawn diagonally forward.
61 Black ends its capture.
62 White Nb1-a3 jumps into empty a3.
63 White ends its Knight move.
64 Black Bh7-f5 follows empty g6 into empty f5.
65 Coup makes neutral Black Pawn g7 royal and e8 King a capturable Prince; g7 is safe and keeps neutrality.
66 Black ends; royal identity remains on g7.
67 White f2-f3 advances into empty f3.
68 White ends its Pawn move.
69 Black b4-b3 advances into empty b3.
70 Black ends its Pawn move.
71 White castles long: b1,c1,d1 empty, e1,d1,c1 safe; King c1 and original a1 Rook d1, rights cleared.
72 Holy War swaps Na3 and Be6; Ne6 checks royal g7, which can escape by g7-g6, so no direct mate.
73 White ends; Black receives its checked royal Pawn turn.
74 Black Nc5-b7 leaves Ne6 checking g7 provisionally; held Dungeon e6-a1 removes the attacker and cures check.
75 Black uses that Dungeon witness: white nonroyal Ne6 relocates to empty a1 and is locked for White next turn.
76 Black ends with royal g7 safe and Dungeon still pending White turn.
77 White c4-c5 advances; immobilized Na1 stays put.
78 White ends; its Dungeon restriction expires.
79 Black Qd8-d7 makes one straight noncapture.
80 Black ends its Queen move.
81 White b5-b6 advances original d2 Pawn.
82 White ends its Pawn move.
83 Black Qd7-d8 returns one straight square.
84 Black ends its Queen move.
85 White Rd1-e1 makes one straight noncapture.
86 White ends its Rook move.
87 Black e4xf3 captures White original f2 Pawn diagonally forward.
88 Black ends its capture.
89 White Na1xb3 captures original Black b7 Pawn; Dungeon already expired.
90 White ends its Knight capture.
91 Black d6-d5 advances into empty d5.
92 Black ends its Pawn move.
93 White Re1-e6 travels through empty e2,e3,e4,e5; e8 is a Prince, not the royal King.
94 White ends with both royal identities safe.
95 Black c7xb6 captures White original d2 Pawn diagonally forward.
96 Black ends its capture.
97 White Qf1-d1 travels through empty e1.
98 White ends its Queen move.
99 Black Nb7-d6 jumps into empty d6.
100 Black ends its Knight move.
101 White Qd1-d3 travels through empty d2.
102 White ends its Queen move.
103 Black a7-a6 advances into empty a6.
104 Black ends its Pawn move.
105 Onslaught advances selected White c5-c6 and h4-h5 simultaneously into empty squares; no captures, consumes move.
106 White ends Onslaught.
107 Black g4-g3 advances original h7 Pawn.
108 Black ends its Pawn move.
109 White Qd3-e4 makes one diagonal noncapture.
110 White ends its Queen move.
111 Black g3-g2 advances original h7 Pawn without promotion yet.
112 Black ends its Pawn move.
113 Blessing moves White Pawn c6-b5 diagonally backward into empty b5, as a Bishop; consumes move.
114 White ends Blessing.
115 Breakthrough makes Black b6xb5 a forward capture of original White c2 Pawn; consumes move and draws Pacifism.
116 Black ends its replacement capture.
117 White Kc1-d2 steps diagonally onto safe d2.
118 White ends with King d2 safe.
119 Black Bf5-g4 makes one diagonal noncapture; neither royal threatened.
120 Black ends; White beforeMove, no pending choice or rescue, 50 regular moves complete.
`.trim().split('\n')

const moves = `g8f6 c3f6 e7f6 e2e4 d7d6 h2h4 f6f5 g2g3 e8e7 f1h3 b7b6 d1e2 b8d7 e2f1 g1e2 h7h5 e2g1 f5e4 d2d3 e7e8 h3e6 g8h7 g3g4 d7c5 h5g4 b1a3 h7f5 f2f3 b4b3 e1c1 c5b7 c4c5 d8d7 b5b6 d7d8 d1e1 e4f3 a1b3 d6d5 e1e6 c7b6 f1d1 b7d6 d1d3 a7a6 g4g3 d3e4 g3g2 c1d2 f5g4`.split(' ')
const cardRows: Record<number, [string, unknown, string]> = {
  1: ['guardian', [{ from: 'c2', to: 'c4' }, { from: 'c1', to: 'c3' }], 'white-hand-4-guardian'],
  10: ['heresy', [{ from: 'f8', to: 'g8' }], 'white-hand-1-heresy'],
  32: ['annexation', [{ from: 'b6', to: 'b4' }], 'black-hand-0-annexation'],
  39: ['neutrality', 'g7', 'white-deck-0-neutrality'],
  42: ['truce', undefined, 'black-deck-0-truce'],
  49: ['curse', 'h8', 'white-hand-3-curse'],
  54: ['peace-talks', 'black-deck-0-truce', 'white-deck-1-peace-talks'],
  58: ['madman', [{ from: 'd3', to: 'b5' }], 'white-deck-2-madman'],
  65: ['coup', 'g7', 'black-hand-1-coup'],
  72: ['holy-war', { knight: 'a3', bishop: 'e6' }, 'white-deck-3-holy-war'],
  75: ['dungeon', [{ from: 'e6', to: 'a1' }], 'black-hand-3-dungeon'],
  105: ['onslaught', [{ from: 'c5', to: 'c6' }, { from: 'h4', to: 'h5' }], 'white-deck-5-onslaught'],
  113: ['blessing', [{ from: 'c6', to: 'b5' }], 'white-deck-6-blessing'],
  115: ['breakthrough', [{ from: 'b6', to: 'b5' }], 'black-hand-4-breakthrough'],
}
const square = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName }
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white'
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s)
function clear(pieces: PieceState[], from: string, to: string): boolean {
  const [x,y] = xy(from), [tx,ty] = xy(to), dx = tx-x, dy = ty-y
  assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
  for (let d = 1; d < Math.max(Math.abs(dx), Math.abs(dy)); d++) {
    if (at(pieces, String.fromCharCode(97+x+Math.sign(dx)*d)+(y+Math.sign(dy)*d+1))) return false
  }
  return true
}
function attacks(pieces: PieceState[], p: PieceState, to: string, step: number): boolean {
  if (!p.square || p.square === to) return false
  const [x,y] = xy(p.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y
  const ax = Math.abs(dx), ay = Math.abs(dy)
  if (step >= 49 && p.id === 'black-rook-h8' && Math.max(ax,ay) > 2) return false
  if (step >= 75 && step < 78 && p.id === 'white-knight-b1') return false
  if (p.role === 'pawn') return ax === 1 && dy === (p.owner === 'white' ? 1 : -1)
  if (p.role === 'knight') return ax*ay === 2
  if (p.role === 'king') return Math.max(ax,ay) === 1
  const aligned = p.role === 'bishop' ? ax === ay : p.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0
  return aligned && clear(pieces,p.square,to)
}
function check(pieces: PieceState[], color: Color, step: number): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!
  assert.ok(king.square)
  return pieces.some(p => p.zone === 'board' && p.id !== king.id && (p.owner !== color || p.neutral) && attacks(pieces,p,king.square!,step))
}
function board(pieces: PieceState[]): string {
  const letters = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' }
  return Array.from({length:8},(_,row) => {
    let line = '', empty = 0
    for (let f=0;f<8;f++) { const p=at(pieces,String.fromCharCode(97+f)+(8-row)); if (!p) empty++; else { if(empty) line+=empty; empty=0; const c=letters[p.role]; line+=p.owner==='white'?c.toUpperCase():c } }
    return line+(empty||'')
  }).join('/')
}

test('iteration 159: independently reviewed deterministic engine regression', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/159.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed,860159)
  assert.equal(trace.steps.length,120)
  assert.equal(rationales.length,120)
  let state = createGameState(trace.initial)
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players)
  let color: Color = 'white', moved = false, plays = {white:0,black:0}, moveCount=0, half=0, full=1, rights='KQkq', fenTurn='w', ep='-'
  let opportunities: GameState['enPassant'] = [], effects: unknown[] = []
  let shieldMove: GameState['shieldMove']
  const history: GameState['history'] = []
  for (const [index,{action}] of trace.steps.entries()) {
    const n=index+1, label=rationales[index]!
    assert.ok(label.startsWith(`${n} `))
    const before = structuredClone(state), unchanged = JSON.stringify(state)
    const expectedBefore = structuredClone(pieces)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from=action.from,to=action.to
      assert.equal(from+to,moves[moveCount++],label)
      assert.equal(action.promotion,undefined)
      assert.equal(moved,false)
      const p=at(pieces,from)!, victim=at(pieces,to)
      assert.ok(p && (p.owner === color || p.neutral),label)
      const [x,y]=xy(from),[tx,ty]=xy(to)
      if(n===71) {
        assert.equal(rights.includes('Q'),true)
        for(const s of ['b1','c1','d1']) assert.equal(at(pieces,s),undefined)
        for(const s of ['e1','d1','c1']) { const probe=structuredClone(pieces); probe.find(q=>q.id===p.id)!.square=square(s); assert.equal(check(probe,'white',n),false) }
        at(pieces,'a1')!.square='d1'
      } else if(p.role==='pawn') {
        const forward: number=p.owner==='white'?1:-1
        if(victim) assert.ok(Math.abs(tx-x)===1 && ty-y===forward)
        else { assert.equal(tx,x); assert.ok(ty-y===forward || ty-y===2*forward && (y===1 || y===6)); assert.ok(clear(pieces,from,to)) }
      } else assert.ok(attacks(pieces,p,to,n),label)
      if(victim) { assert.equal(victim.royal,false); assert.ok(victim.owner!==color || victim.neutral); assert.ok(!(n>=42&&n<54)); victim.zone='captured'; victim.square=null; victim.capturedBy=color }
      if(p.royal && p.role==='king') rights=rights.replace(color==='white'?/[KQ]/g:/[kq]/g,'')
      p.square=square(to)
      half=p.role==='pawn'||victim?0:half+1; if(color==='black') full++
      ep='-'; opportunities=[]
      if(p.role==='pawn' && Math.abs(ty-y)===2) opportunities=[{target:square(from[0]!+(y+(ty-y)/2+1)),pawnId:p.id}]
      moved=true; fenTurn=color==='white'?'b':'w'
      shieldMove={player:color,pieceIds:pieces.filter(q=>q.zone==='board'&&q.square!==expectedBefore.find(old=>old.id===q.id)!.square).map(q=>q.id),capturedOpponent:!!victim&&victim.owner!==color}
      history.push({type:'move',from:square(from),to:square(to),...(victim?{capturedId:victim.id}:{})})
    } else if(action.type==='playCard') {
      const row=cardRows[n]; assert.ok(row,label)
      assert.deepEqual([action.cardId,action.target,action.cardInstanceId],row,label)
      const [id,target,instance]=row, catalog=CARD_CATALOG[id]!
      assert.equal(plays[color],0); assert.ok(catalog.timing.includes(moved?'afterMove':'beforeMove'))
      const hand: GameState['players']['white']['hand']=players[color].hand
      const ci: number=hand.findIndex(c=>c.id===instance); assert.ok(ci>=0)
      const card: GameState['players']['white']['hand'][number]=hand.splice(ci,1)[0]!; assert.ok(card)
      plays[color]++
      if(!catalog.continuing) players[color].discard.push(card)
      hand.push(players[color].deck.shift()!)
      let movement: CardMove[]=[]; let capturedId: string|undefined
      if(Array.isArray(target)) {
        movement=target as CardMove[]
        const selected=movement.map(m=>({m,p:at(pieces,m.from)!}))
        for(const {m,p} of selected) {
          assert.ok(p)
          if(n!==115) assert.equal(at(pieces,m.to),undefined)
          if(n===1) { assert.ok(['white-pawn-c2','white-bishop-c1'].includes(p.id)); if(p.role==='pawn') assert.ok(clear(pieces,m.from,m.to)) }
          if(n===10) { assert.equal(p.role,'bishop'); assert.equal(Math.abs(xy(m.to)[0]-xy(m.from)[0])+Math.abs(xy(m.to)[1]-xy(m.from)[1]),1) }
          if(n===32) { assert.equal(p.role,'pawn'); assert.equal(xy(m.to)[1]-xy(m.from)[1],-2); assert.ok(clear(pieces,m.from,m.to)) }
          if(n===58) { assert.equal(p.role,'pawn'); assert.equal(at(pieces,'c4')!.id,'white-pawn-c2') }
          if(n===75) { assert.equal(p.id,'white-knight-b1'); assert.equal(p.royal,false) }
          if(n===105) { assert.equal(p.role,'pawn'); assert.equal(xy(m.to)[1]-xy(m.from)[1],1) }
          if(n===113) { assert.equal(Math.abs(xy(m.to)[0]-xy(m.from)[0]),Math.abs(xy(m.to)[1]-xy(m.from)[1])); assert.ok(clear(pieces,m.from,m.to)) }
          if(n===115) { const victim=at(pieces,m.to)!; assert.equal(victim.id,'white-pawn-c2'); assert.equal(p.id,'black-pawn-c7'); victim.zone='captured'; victim.square=null; victim.capturedBy='black'; capturedId=victim.id }
        }
        for(const {m,p} of selected) p.square=m.to
        if(n===1) movement=[movement[1]!,movement[0]!]
      }
      if(n===10) { for(const s of ['c8','f1']) { const [x,y]=xy(s); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const a=x+dx!,b=y+dy!; if(a>=0&&a<8&&b>=0&&b<8) assert.ok(at(pieces,String.fromCharCode(97+a)+(b+1))) } } ep='e3' }
      if(n===39) { const p=at(pieces,'g7')!; p.neutral=true;p.neutralBeforeEffects=false; effects.push({type:'neutrality',owner:color,card,pieceId:p.id}) }
      if(n===42) effects.push({type:'truce',owner:color,card})
      if(n===49) effects.push({type:'curse',owner:color,card,pieceId:'black-rook-h8'})
      if(n===54) { effects=effects.filter(e=>(e as {type:string}).type!=='truce'); players.black.discard.push({id:'black-deck-0-truce',cardId:'truce'}) }
      if(n===65) { at(pieces,'e8')!.royal=false;at(pieces,'g7')!.royal=true; effects.push({type:'coup',owner:'black',card,princeId:'black-king-e8',kingId:'black-pawn-g7',princeRole:'king'}) }
      if(n===72) { const knight=at(pieces,'a3')!, bishop=at(pieces,'e6')!;knight.square='e6';bishop.square='a3';movement=[{from:'a3',to:'e6'},{from:'e6',to:'a3'}]; const escape=structuredClone(pieces);at(escape,'g7')!.square='g6';assert.equal(check(escape,'black',n),false,'g7-g6 witnesses nonmate') }
      if(n===75) effects.push({type:'dungeon',owner:'black',player:'white',pieceId:'white-knight-b1'})
      const replaces=[1,32,58,105,113,115].includes(n)
      if(replaces) { assert.equal(moved,false);moved=true;fenTurn=color==='white'?'b':'w';half=0;if(color==='black')full++;ep='-';opportunities=[] }
      if(replaces) shieldMove={player:color,pieceIds:pieces.filter(q=>q.zone==='board'&&q.square!==expectedBefore.find(old=>old.id===q.id)!.square).map(q=>q.id),capturedOpponent:capturedId!==undefined}
      history.push({type:'cardPlayed',cardId:id,...(target!==undefined&&n!==54?{target:target as CardMove[]} : {}),...(capturedId?{capturedId}:{}),movement,preservePreviousMove:!replaces})
    } else {
      assert.equal(action.type,'endTurn',label);assert.equal(moved,true);assert.equal(check(pieces,color,n),false)
      if(n===78)effects=effects.filter(e=>(e as {type:string}).type!=='dungeon')
      color=opposite(color);moved=false;plays={white:0,black:0}
      shieldMove=undefined
    }
    const result=applyAction(state,action)
    assert.equal(JSON.stringify(state),unchanged,`${label}: immutable input`)
    assert.ok(result.ok,label);state=result.state
    assert.deepEqual(state.pieces,pieces,`${label}: complete physical oracle including capturedBy`)
    assert.equal(state.fen,`${board(pieces)} ${fenTurn} ${rights||'-'} ${ep} ${half} ${full}`,label)
    assert.deepEqual(state.players,players,label)
    assert.deepEqual(state.turn,{color,phase:moved?'afterMove':'beforeMove',moveMade:moved,cardPlays:plays},label)
    assert.deepEqual(state.effects,effects,label)
    assert.deepEqual(state.history,history,label)
    assert.deepEqual(state.enPassant,opportunities,label)
    assert.deepEqual(state.shieldMove,shieldMove,`${label}: exact latest moved identities and capture actor`)
    assert.equal(state.orientation,0);assert.equal(state.outcome,null)
    for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const) assert.equal(state[key],undefined,label)
    for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const) assert.deepEqual(state[key]??[],[],label)
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null)
    for(const owner of ['white','black'] as const) {
      const expected=owner==='black'&&n>=72&&n<=74
      assert.equal(check(pieces,owner,n),expected,`${label}: independently scanned raw royal threat`)
      assert.equal(isKingInCheck(state,owner),expected,label)
    }
    // The sole neutral stays g7 and attacks only f6/h6, neither a royal square.
    // Therefore no legal-capture pin filter is needed for this trace's neutral attacks.
    if(n>=39) for(const p of pieces.filter(p=>p.royal)) assert.ok(!['f6','h6'].includes(p.square!))
    if(n===74) {
      assert.ok(state.pendingRescue)
      assert.deepEqual(state.pendingRescue.pieces,expectedBefore)
      assert.equal(state.pendingRescue.fen,before.fen)
      assert.deepEqual(state.pendingRescue.enPassant,[])
      assert.equal(state.pendingRescue.historyLength,history.length-1)
      assert.deepEqual(state.history.slice(0,state.pendingRescue.historyLength),before.history)
      assert.deepEqual(state.pendingRescue.movedPieceIds,['black-knight-b8'])
      assert.deepEqual(state.pendingRescue.before,before)
      assert.ok(players.black.hand.some(c=>c.id==='black-hand-3-dungeon'))
      const witness=structuredClone(pieces);assert.equal(at(witness,'a1'),undefined);at(witness,'e6')!.square='a1'
      assert.equal(check(witness,'black',75),false,'held Dungeon e6-a1 cures provisional self-check')
      assert.equal(check(witness,'white',75),false,'rescue creates no opposing check or mate')
      const witnessInput=JSON.stringify(state)
      const saved=applyAction(state,{type:'playCard',cardId:'dungeon',cardInstanceId:'black-hand-3-dungeon',target:[{from:'e6',to:'a1'}]})
      assert.equal(JSON.stringify(state),witnessInput,'rescue witness leaves provisional input unchanged')
      assert.ok(saved.ok);assert.equal(saved.state.pendingRescue??null,null);assert.deepEqual(saved.state.pieces,witness)
    } else assert.equal(state.pendingRescue??null,null,label)
    // Test availability in the prospective capturing player's before-move window.
    if(opportunities.length) {
      const prospective=structuredClone(state);prospective.turn={color:fenTurn==='w'?'white':'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
      const destinations=legalDests(prospective)
      for(const opportunity of opportunities) {
        const candidates=pieces.filter(p=>p.zone==='board'&&p.role==='pawn'&&p.owner===prospective.turn.color&&attacks(pieces,p,opportunity.target,n))
        assert.equal(candidates.length,0,'no adjacent correctly oriented en-passant captor')
        for(const p of pieces.filter(p=>p.zone==='board'&&p.role==='pawn'&&p.owner===prospective.turn.color)) assert.equal(destinations.get(p.square!)?.includes(opportunity.target)??false,false)
      }
    }
  }
  assert.equal(moveCount,50)
  assert.equal(Object.keys(cardRows).length,14)
  assert.equal(state.fen,'r1bqk2r/5pp1/p2nR3/1p1p3P/4Q1b1/BN3p2/PP1K2p1/6NR w - - 2 29')
  assert.equal(replayTrace(trace).fen,state.fen)
})
