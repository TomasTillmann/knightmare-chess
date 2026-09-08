import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import type { Color, GameState, PieceState, SquareName } from '../types.js'

// Ordered human review of every generated action; printed artwork was inspected
// for all 16 distinct played cards. Rules §§8–11, 14–17 and card-specific text.
const rationales = `
1 Nb1-c3 is a noncapturing knight jump.
2 White ends the completed knight turn; no card changes.
3 b7-b5 crosses empty b6; b6 EP exists for one reply.
4 Black hands off with b6 EP intact.
5 Nc3-e4 is a knight jump; unused b6 EP expires.
6 White ends the quiet knight turn.
7 c7-c6 advances one empty square.
8 Black ends the pawn turn.
9 Ne4-d6 jumps and checks e8; White remains safe.
10 Black Think Again immediately cancels Nd6, restoring e4, clocks and White move; Black alone spends and draws.
11 d2-d3 is a different legal replacement, preserving Black reaction expenditure.
12 White Forbidden City marks empty d5 after its move; retain the card and draw once.
13 Handoff resets both allowances and keeps d5 prohibited.
14 h7-h5 crosses empty h6 and creates h6 EP.
15 Handoff preserves h6 EP.
16 White Plots spends and draws before moving; no captured piece or legal forward capture means no extra eligible card.
17 b2-b4 crosses empty b3; ordinary move closes Plots and replaces h6 EP with b3.
18 Handoff keeps b3 EP; unused Plots grants no future play.
19 f7-f6 is an ordinary pawn step and expires b3 EP.
20 Black Crab marks its f6 pawn after the move, retaining physical f7 identity and card.
21 Handoff keeps Crab and Forbidden City.
22 Ng1-f3 jumps without capture.
23 White Doomsayer retains the card, draws once and opens Black immediate naming choice.
24 Black declines; no loss or draw, effect remains.
25 Handoff now permitted with no mandatory choice.
26 e7-e5 crosses empty e6 and grants e6 EP.
27 Handoff preserves e6 EP.
28 g2-g4 crosses empty g3 and grants g3 EP.
29 Handoff preserves g3 EP.
30 Black names rook; White Doomsayer captures h8 rook, removes its castling right, discards itself, and preserves Black move and g3 EP.
31 Ng8-e7 jumps and expires g3 EP.
32 Black ends its knight turn.
33 Ke1-d2 enters a safe adjacent vacancy and loses both White castling rights.
34 White ends its King turn.
35 h5-h4 is a one-square forward pawn move.
36 Black ends its pawn turn.
37 g4-g5 is a one-square forward pawn move.
38 White ends its pawn turn.
39 Qd8-a5 follows empty c7,b6 diagonal, avoiding d5.
40 Black ends its Queen turn.
41 Nf3-d4 jumps without capture.
42 White ends its knight turn.
43 Qa5-a2 crosses empty a4,a3 and captures the original a2 pawn for Black.
44 Black ends its capture turn.
45 Nd4-b3 is a noncapturing knight jump.
46 White Cowardice moves opposing e5 pawn backward to vacant e6 after moving; clocks unchanged.
47 Handoff retains Cowardice expenditure only until turn resets.
48 Black Breakthrough replaces its move with b5xb4 forward capture of White b2 pawn.
49 Black ends the replacement turn; no second move.
50 f2-f3 advances one empty square.
51 White ends its pawn turn.
52 Bc8-b7 is a one-square diagonal move.
53 Black ends its bishop turn.
54 h2-h3 advances into empty h3 without capturing h4.
55 White ends its pawn turn.
56 Black Evil Eye replaces its move: Qa2 legally threatens Ra1, captures Ra1 for Black without moving Queen.
57 Black ends the Evil Eye replacement turn.
58 Qd1-e1 moves horizontally one empty square.
59 White ends its Queen turn.
60 Qa2xb3 diagonally captures White original g1 knight for Black.
61 Black ends its capture turn.
62 Ne4-c3 jumps without capture.
63 White ends its knight turn.
64 a7-a6 advances one empty square.
65 Black Fireball after quiet a6 removes a6 pawn and adjacent b7 bishop, both captured by Black; no other occupied neighbor.
66 Black ends its Fireball turn.
67 f3-f4 advances into empty f4.
68 White ends its pawn turn.
69 Ra8-a7 moves to vacancy and loses final Black castling right.
70 Black ends its rook turn.
71 Nc3-e4 jumps without capture.
72 White ends its knight turn.
73 Ke8-d8 moves safely one square.
74 Black ends its King turn.
75 g5-g6 advances into empty g6; g7 is not captured.
76 White ends its pawn turn.
77 Black Resurrection replaces move, returns its Fireball-captured c8 bishop to empty c8 and clears capturedBy.
78 Black ends the resurrection replacement turn.
79 Kd2-d1 enters safe adjacent d1; c2 blocks Qb3 diagonal.
80 White ends its King turn.
81 Black Irresistible Force replaces move: h4-h3 pushes White h3 pawn to empty h2; no capture or promotion.
82 Black ends its pushing turn.
83 White Resurrection replaces move and returns captured a2 pawn to empty g2, a valid pawn starting square; clears capturedBy.
84 White ends its resurrection turn.
85 Bc8-b7 is a quiet diagonal move.
86 Black Crusade uses the just-moved bishop for b7-a6 additional quiet move; one turn and unchanged clocks.
87 Black ends its bishop double-move turn.
88 c2-c4 vacates Qb3-c2-d1 diagonal, leaving White temporarily checked with Fortification rescue available; c3 EP is staged and Black b4xc3 would be legal.
89 White wall d3-e2 does not intersect checking b3-c2-d1 diagonal: fizzle, spend/draw, rewind c4 to c2 and clocks/EP, restore Regular Move.
90 e2-e3 is a safe replacement; c2 again blocks Qb3-d1.
91 White ends with failed Fortification spent.
92 Kd8-c7 moves safely one diagonal square.
93 Black ends its King turn.
94 Rh1-g1 moves one empty square.
95 White ends its rook turn.
96 Qb3xd3 crosses empty c3, captures d3 pawn for Black and checks Kd1 along d2.
97 Black Holy War swaps its e7 knight and a6 bishop after moving; neither captures, Queen check persists with Bf1xd3 escape.
98 Black hands off and White must answer Queen check.
99 Bf1xd3 crosses empty e2 and captures checking Queen for White, curing check.
100 White Vendetta retains card after its capture, draws once; captures mandatory while possible.
101 Handoff retains Vendetta because Black h3xg2 exists.
102 h3xg2 captures resurrected original a2 pawn for Black, satisfying Vendetta.
103 Handoff retains Vendetta because White Rg1xg2 exists.
104 Rg1xg2 captures Black h-pawn for White and satisfies Vendetta.
105 Black has no legal capture; discard White Vendetta and restore ordinary choice.
106 d7-d6 advances one empty square.
107 Black ends its pawn turn.
108 Ne4-d2 jumps without capture.
109 White ends its knight turn.
110 Kc7-b6 enters safe adjacent b6.
111 Black ends its King turn.
112 Nd2-e4 jumps without capture.
113 White ends its knight turn.
114 c6-c5 advances one empty square.
115 Black Coup transfers royal status from b6 King to g7 pawn, retaining both roles and physical identities; retain card and draw.
116 Black ends with g7 pawn royal and b6 Prince capturable.
117 Rg2-e2 crosses empty f2, keeping both royals safe.
118 White ends its rook turn.
119 Prince b6-c6 moves one square; royal g7 pawn remains safe.
120 Black ends its Prince turn.
121 Qe1-g1 crosses empty f1; g6 pawn blocks its file to royal g7.
122 White ends the fiftieth generated Regular Move command; Black to act, no pending choice.
`.trim().split('\n')

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white'
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const square = (s: string): SquareName => { assert.match(s, /^[a-h][1-8]$/); return s as SquareName }
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s)

// Independent geometry: this trace only retains Forbidden City, Crab, Doomsayer,
// Vendetta and Coup. No production attack or destination API is consulted.
function reaches(pieces: PieceState[], p: PieceState, to: string, capture: boolean, n: number): boolean {
  if (!p.square || p.square === to || n >= 12 && to === 'd5') return false
  const [x,y] = xy(p.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y
  const ax = Math.abs(dx), ay = Math.abs(dy)
  if (p.role === 'knight') return ax * ay === 2
  if (p.role === 'king') return Math.max(ax, ay) === 1
  const direction = p.owner === 'white' ? 1 : -1
  if (p.role === 'pawn') {
    if (capture || n >= 20 && p.id === 'black-pawn-f7') return ax === 1 && dy === direction
    if (dx || at(pieces,to)) return false
    return dy === direction || dy === 2*direction && (p.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, `${p.square[0]}${y+direction+1}`)
  }
  if (!(p.role === 'queen' && (dx === 0 || dy === 0 || ax === ay)
    || p.role === 'rook' && (dx === 0 || dy === 0) || p.role === 'bishop' && ax === ay)) return false
  for (let i=1; i<Math.max(ax,ay); i++) {
    const s = `${String.fromCharCode(97+x+Math.sign(dx)*i)}${y+Math.sign(dy)*i+1}`
    if (at(pieces,s) || n >= 12 && s === 'd5') return false
  }
  return true
}
function checked(pieces: PieceState[], color: Color, n: number): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!
  assert.equal(king.zone,'board')
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces,p,king.square!,true,n))
}
function captures(pieces: PieceState[], color: Color, n: number): number {
  let count = 0
  for (const p of pieces.filter(p => p.zone === 'board' && p.owner === color)) {
    for (const q of pieces.filter(p => p.zone === 'board' && p.owner !== color && !p.royal)) {
      if (!reaches(pieces,p,q.square!,true,n)) continue
      const candidate = structuredClone(pieces)
      candidate.find(v => v.id === p.id)!.square = q.square
      Object.assign(candidate.find(v => v.id === q.id)!, { square:null, zone:'captured' })
      if (!checked(candidate,color,n)) count++
    }
  }
  return count
}

test('iteration 122 independent physical, card, timing and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/122.json', import.meta.url),'utf8')) as RandomTrace
  assert.equal(rationales.length,trace.steps.length)
  assert.equal(trace.moves,50)
  let state = createGameState(trace.initial)
  let pieces = structuredClone(state.pieces)
  const players = structuredClone(state.players)
  let effects: unknown[] = []
  let turn = structuredClone(state.turn)
  let ep: GameState['enPassant'] = []
  let half = 0, full = 1, fenColor: Color = 'white', rights = 'KQkq'
  let saved: {pieces:PieceState[]; half:number; full:number; ep:GameState['enPassant'];rights:string} | undefined
  const capture = (id: string, color: Color) => {
    const p = pieces.find(p=>p.id === id)!
    assert.equal(p.zone,'board'); assert.equal(p.royal,false)
    Object.assign(p,{square:null,zone:'captured',capturedBy:color})
  }
  const relocate = (from: string,to: string) => { const p=at(pieces,from)!; assert.ok(p,from); p.square=square(to) }
  const returnPiece = (id:string,to:string) => {
    const p=pieces.find(p=>p.id===id)!; assert.equal(p.zone,'captured'); assert.equal(at(pieces,to),undefined)
    Object.assign(p,{zone:'board',square:square(to)}); delete p.capturedBy; delete p.capturedAtPly
  }
  for (const [i,step] of trace.steps.entries()) {
    const n=i+1, action=step.action, before=state, actor=turn.color
    assert.ok(rationales[i]!.startsWith(`${n} `))
    const input=structuredClone(before)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.equal(turn.moveMade,false)
      const p=at(pieces,action.from)!, q=at(pieces,action.to)
      assert.ok(p); assert.equal(p.owner,actor)
      assert.ok(reaches(pieces,p,action.to,!!q,n),`${n}: movement geometry`)
      saved={pieces:structuredClone(pieces),half,full,ep:structuredClone(ep),rights}
      if (q) { assert.equal(q.owner,opposite(actor)); capture(q.id,actor) }
      const reset=p.role==='pawn'||!!q
      if (n>=100 && n<=104) assert.ok(q,'Vendetta move must capture')
      if (p.role==='king' && p.royal) rights=rights.replace(actor==='white'?/[KQ]/g:/[kq]/g,'')
      if(p.id==='black-rook-a8') rights=rights.replace('q','')
      ep=[]
      if (p.role==='pawn' && Math.abs(Number(action.to[1])-Number(action.from[1]))===2)
        ep=[{target:square(`${action.from[0]}${(Number(action.to[1])+Number(action.from[1]))/2}`),pawnId:p.id}]
      relocate(action.from,action.to)
      half=reset?0:half+1; if(actor==='black') full++
      fenColor=opposite(actor); turn.phase='afterMove'; turn.moveMade=true
    } else if(action.type === 'endTurn') {
      assert.equal(turn.moveMade,true)
      assert.equal(checked(pieces,actor,n),false,`${n}: cannot end in check`)
      turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
      if(n===101||n===103) assert.ok(captures(pieces,turn.color,n)>0)
      if(n===105) {
        assert.equal(captures(pieces,'black',n),0,'Vendetta expires only without legal capture')
        effects=effects.filter(e=>(e as {type:string}).type!=='vendetta')
        players.white.discard.push({id:'white-deck-3-vendetta',cardId:'vendetta'})
      }
    } else if(action.type === 'namePiece') {
      assert.equal(n,30)
      assert.deepEqual(action.losses,[{effectId:'white-hand-1-doomsayer',pieceId:'black-rook-h8'}])
      capture('black-rook-h8','white'); rights=rights.replace('k','')
      effects=effects.filter(e=>(e as {type:string}).type!=='doomsayer')
      players.white.discard.push({id:'white-hand-1-doomsayer',cardId:'doomsayer'})
    } else if(action.type === 'declineDoomsayer') {
      assert.equal(n,24); assert.equal(action.player,'black')
    } else if(action.type === 'playCard') {
      const owner:Color=n===10?'black':actor
      const zone=players[owner]
      const ci=zone.hand.findIndex(c=>c.id===action.cardInstanceId)
      assert.ok(ci>=0); assert.equal(turn.cardPlays[owner],0)
      const card=zone.hand.splice(ci,1)[0]!
      assert.equal(card.cardId,action.cardId)
      zone.hand.push(zone.deck.shift()!)
      turn.cardPlays[owner]++
      if(![12,20,23,100,115].includes(n)) zone.discard.push(card)
      const ce=(type:string,extra:object={})=>effects.push({type,owner,card,...extra})
      if(n===10 || n===89) {
        assert.ok(saved)
        pieces=structuredClone(saved.pieces); half=saved.half; full=saved.full; ep=structuredClone(saved.ep); rights=saved.rights
        turn.phase='beforeMove';turn.moveMade=false;fenColor=actor
      } else if(n===12) { assert.equal(at(pieces,'d5'),undefined); ce('forbidden-city',{square:'d5'}) }
      else if(n===16) { assert.equal(turn.phase,'beforeMove') }
      else if(n===20) ce('crab',{pieceId:'black-pawn-f7'})
      else if(n===23) ce('doomsayer')
      else if(n===46) { assert.equal(at(pieces,'e6'),undefined);relocate('e5','e6') }
      else if(n===48) { capture('white-pawn-b2','black');relocate('b5','b4') }
      else if(n===56) { assert.ok(reaches(pieces,at(pieces,'a2')!,'a1',true,n));capture('white-rook-a1','black') }
      else if(n===65) {
        const neighbors=pieces.filter(p=>p.square && Math.max(Math.abs(xy(p.square)[0]-0),Math.abs(xy(p.square)[1]-5))<=1)
        assert.deepEqual(neighbors.map(p=>p.id).sort(),['black-bishop-c8','black-pawn-a7'])
        capture('black-pawn-a7','black');capture('black-bishop-c8','black')
      } else if(n===77) returnPiece('black-bishop-c8','c8')
      else if(n===81) { assert.equal(at(pieces,'h2'),undefined);relocate('h3','h2');relocate('h4','h3') }
      else if(n===83) returnPiece('white-pawn-a2','g2')
      else if(n===86) { assert.ok(reaches(pieces,at(pieces,'b7')!,'a6',false,n));relocate('b7','a6') }
      else if(n===97) { const b=at(pieces,'a6')!,k=at(pieces,'e7')!;b.square='e7';k.square='a6' }
      else if(n===100) ce('vendetta')
      else if(n===115) {
        pieces.find(p=>p.id==='black-king-e8')!.royal=false;pieces.find(p=>p.id==='black-pawn-g7')!.royal=true
        ce('coup',{princeId:'black-king-e8',kingId:'black-pawn-g7',princeRole:'king'})
      } else assert.fail(`unreviewed card at ${n}`)
      if([48,56,77,81,83].includes(n)) {
        assert.equal(turn.moveMade,false);turn.moveMade=true;turn.phase='afterMove';fenColor=opposite(actor)
        half=n===77?half+1:0;if(actor==='black')full++;ep=[]
      }
    } else assert.fail(`unreviewed action ${n}`)
    const result=applyAction(before,action)
    assert.deepEqual(before,input,`${n}: full input including capturedBy remains immutable`)
    assert.ok(result.ok,`${n}: ${rationales[i]}`)
    state=result.state
    assert.deepEqual(state.pieces,pieces,`${n}: every physical record including unchanged identities`)
    assert.deepEqual(state.players,players,`${n}: full ordered physical card zones`)
    assert.deepEqual(state.effects,effects,`${n}: complete effect records`)
    assert.deepEqual(state.turn,turn,`${n}: turn/allowances`)
    assert.deepEqual(state.enPassant,ep,`${n}: all EP rights`)
    const legalEp: string[] = []
    for (const opportunity of ep) {
      for (const pawn of pieces.filter(p=>p.zone==='board' && p.role==='pawn' && p.owner===fenColor)) {
        if (!reaches(pieces,pawn,opportunity.target,true,n)) continue
        const victim=pieces.find(p=>p.id===opportunity.pawnId)!
        if (victim.owner===pawn.owner || victim.zone!=='board' || victim.royal) continue
        const candidate=structuredClone(pieces)
        candidate.find(p=>p.id===pawn.id)!.square=opportunity.target
        Object.assign(candidate.find(p=>p.id===victim.id)!,{square:null,zone:'captured'})
        if (!checked(candidate,pawn.owner,n)) legalEp.push(`${pawn.id}:${opportunity.target}`)
      }
    }
    assert.deepEqual(legalEp,n===88?['black-pawn-b7:c3']:[],`${n}: independent legal en-passant captures`)
    // Ordinary-move FEN suppresses uncapturable EP. Doomsayer's non-move board
    // refresh at 30 retains the raw, still-current g3 target (legal FEN syntax).
    assert.equal(state.fen.split(' ')[3],n===30?'g3':n===88?'c3':'-',`${n}: FEN EP serialization`)
    assert.deepEqual(state.chaosForbidden??null,n===10?{player:'white',movement:'white-knight-b1:e4:d6'}:null,`${n}: canceled move restriction`)
    const fen=parseFen(state.fen).unwrap()
    assert.equal(fen.turn,fenColor,`${n}: FEN actor`);assert.equal(fen.halfmoves,half,`${n}: halfmove clock`);assert.equal(fen.fullmoves,full,`${n}: fullmove clock`)
    assert.equal(state.fen.split(' ')[2],rights||'-',`${n}: castling rights`)
    for(const p of pieces.filter(p=>p.square)) assert.deepEqual(fen.board.get(parseSquare(p.square!)!),{role:p.role,color:p.owner,promoted:false})
    assert.equal(fen.board.occupied.size(),pieces.filter(p=>p.zone==='board').length)
    assert.equal(state.orientation,0);assert.equal(state.outcome,null)
    assert.equal(!!state.pendingRescue,n===88,`${n}: pending rescue`)
    if(n===88) {
      assert.deepEqual(state.pendingRescue!.pieces,saved!.pieces)
      assert.deepEqual(state.pendingRescue!.enPassant,saved!.ep)
      assert.deepEqual(state.pendingRescue!.movedPieceIds,['white-pawn-c2'])
    }
    assert.deepEqual(state.pendingDoomsayer??null,n===23?{player:'black',cardInstanceId:'white-hand-1-doomsayer'}:null)
    assert.equal(state.pendingAbduction??null,null);assert.deepEqual(state.underElfHill??[],[])
    const expectedWhiteCheck=[88,96,97,98].includes(n), expectedBlackCheck=n===9
    assert.equal(checked(pieces,'white',n),expectedWhiteCheck,`${n}: independent White royal safety`)
    assert.equal(checked(pieces,'black',n),expectedBlackCheck,`${n}: independent Black royal safety`)
    if(n===97) assert.ok(reaches(pieces,at(pieces,'f1')!,'d3',true,n),'Holy War leaves Bxd3 escape; no direct mate')
    if(n===16) assert.deepEqual((state.plotsAllowances??[]).map(p=>({player:p.player,remaining:p.remaining,eligibleCards:p.eligibleCards})),[{player:'white',remaining:2,eligibleCards:[]}])
    if(n!==16) assert.deepEqual(state.plotsAllowances??[],[],`${n}: no stale Plots allowance`)
  }
  assert.equal(state.fen,'1n3b2/r3b1p1/n1kpppP1/2p5/1p2NP2/3BP3/2P1R2P/2BK2Q1 b - - 3 27')
})

test('deterministic campaign iteration 122', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/122.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})
