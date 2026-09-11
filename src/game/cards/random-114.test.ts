import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck } from '../reducer.js'
import { createGameState } from '../state.js'
import type { CardInstance, Color, FatalAttractionEffect, DoomsayerEffect, GameState, PieceState, SquareName } from '../types.js'

// Individually reviewed against rules §§8–11, 18.6, 19.3, 20 and the printed catalog metadata.
// Finding43: rows after the forbidden action 104 describe an unreachable archived branch.
const rationale = `
1. White d2-d3 advances one empty square; no capture or check.
2. After-move Doomsayer retains White's card and offers Black the immediate naming choice.
3. Black declines the immediate choice; the continuing effect remains.
4. White names queen and loses its d1 queen to White's own Doomsayer; the effect is discarded.
5. White ends its completed turn; Black receives fresh card allowances.
6. Black a7-a5 crosses empty a6; establish the a6 en-passant opportunity.
7. Black ends; preserve that opportunity for White.
8. White b2-b3 advances one square and expires a6 en passant.
9. White ends its completed move and passes to Black.
10. Black f7-f5 crosses empty f6 and establishes f6 en passant.
11. Black ends and retains f6 for White's response move.
12. White g1-h3 is a knight jump to an empty square; f6 expires.
13. White ends its completed move and passes to Black.
14. Black e7-e6 advances a pawn and resets the halfmove clock.
15. Black's after-move Disintegration makes its c7 pawn dead, not captured; spend and replace.
16. Black ends without any remaining choice or rescue.
17. White bishop c1-g5 traverses vacant d2,e3,f4.
18. White ends; its king is safe.
19. Black a5-a4 is a one-square pawn advance.
20. Black ends; no card was spent this turn.
21. White a2-a3 is an empty one-square pawn advance.
22. White ends its completed move and passes to Black.
23. Black a4xb3 captures White's original b2 pawn; Black is the captor.
24. Black makes its g8 knight a magnet after moving; f8,h8,g7,h7 neighbors are frozen.
25. Black ends; the continuing magnet remains active.
26. White a3-a4 advances outside the g8 magnet.
27. White ends; Black may now move.
28. Black queen d8-a5 traverses c7,b6 and checks e1 along b4,c3,d2.
29. Black ends; checked White receives its response turn.
30. White bishop g5-c1 traverses f4,e3,d2 but leaves a5-e1 check; rescue must be pending.
31. Haunting Memories copies the last Fatal Attraction; White's a4 pawn freezes adjacent a5 queen and rescues e1.
32. White ends only after the magnet removed the check.
33. Black g8-h6 jumps away; its own magnet is discarded and releases the neighboring pieces.
34. Black ends; White's a4 magnet remains.
35. White f2-f4 crosses empty f3; the pawn action resets clocks and records f3 en passant.
36. Figure Dance simultaneously rotates a1-h1-h8-a8-a1 rooks counterclockwise; no captures, all castling rights lost.
37. White ends; Figure Dance preserved its completed pawn move and f3 opportunity.
38. Black rook a1xb1 captures White's knight, with c1 bishop still obstructing e1; f3 expires.
39. Black ends its capture turn.
40. White rook h8xh7 captures Black's h7 pawn.
41. White Disintegration removes its c2 pawn as dead without disturbing the completed capture.
42. White ends with c1 still obstructing Black's b1 rook.
43. Black rook a8-a7 advances along its clear file.
44. Black ends its completed move.
45. White e2-e3 advances into an empty square.
46. White ends; its king remains safe.
47. Black bishop f8-e7 moves diagonally to an empty square after its magnet expired.
48. Black ends its completed move.
49. White g2-g3 advances one empty square.
50. White ends its completed move.
51. Dubbing replaces Black's move: d7-f6 is a noncapturing knight jump by a pawn; reset pawn clock.
52. Black ends the replacement move.
53. White bishop c1-b2 exposes b1 rook's c1,d1,e1 ray; rescue must be pending.
54. Siege's h3/h7 swap cannot stop b1-e1 check: spend/discard/refill, undo the unsafe c1-b2 move and restore White's move.
55. White d3-d4 is the replacement legal pawn move; Siege's spent allowance remains one.
56. White ends its safe replacement move.
57. Black bishop e7-a3 traverses d6,c5,b4 and arrives beside a4 magnet, becoming frozen after arrival.
58. Black ends; the frozen a3 bishop cannot check or move.
59. Lost Castle replaces White's move by swapping h7 and a7 rooks, retaining ownership and identities.
60. White ends the rook-swap replacement move.
61. Black b8-d7 makes a knight jump to an empty square.
62. Black ends its completed move.
63. White bishop f1-a6 traverses e2,d3,c4,b5, all empty.
64. White ends its completed move.
65. Black king e8-f8 steps onto an unattacked empty square.
66. Black ends its completed move.
67. White bishop a6xb7 captures Black's b7 pawn.
68. White ends its completed capture.
69. Black knight h6-f7 jumps to an empty square.
70. Black ends its completed move.
71. Forced March replaces White's move with simultaneous d4-c4 and f4-g4 sideways pawn moves to empty squares.
72. White ends the two-pawn replacement move.
73. Black rook b1-b2 moves one square into an empty square, outside a4 magnet range.
74. Black ends its completed move.
75. Resurrection returns the captured original b2 pawn to vacant e2, a valid starting pawn square; clear capturedBy.
76. White ends its pawn-return replacement move.
77. Black knight f7-d8 jumps to an empty square.
78. Black ends its completed move.
79. White bishop b7-e4 traverses c6,d5, both empty.
80. White ends its completed move.
81. Black knight d8-c6 jumps to an empty square.
82. Black ends its completed move.
83. White rook a7xa5 crosses empty a6 and captures the frozen Black queen; arriving beside a4 freezes the rook.
84. White ends its capture turn; its a4 magnet remains.
85. Black rook h7-h5 crosses empty h6.
86. Black ends its completed move.
87. White bishop e4-g2 crosses empty f3.
88. After-move Anathema swaps Black's c8 bishop and h5 rook without captures or clock advancement.
89. White ends its completed move and swap.
90. Black knight c6-d8 jumps to an empty square.
91. Black ends its completed move.
92. White bishop g2-e4 crosses empty f3.
93. White ends its completed move.
94. Black rook c8-c6 crosses empty c7.
95. Black ends its completed move.
96. White bishop e4-f3 moves one diagonal square.
97. White ends its completed move.
98. Black rook b2xe2 crosses c2,d2 and captures the resurrected pawn, checking White's e1 king.
99. Black ends; White must answer the e2 rook check.
100. Masquerade replaces White's move by moving its king e1-f1 like a queen without capture, escaping check.
101. White ends the safe replacement move.
102. Black king f8-g8 moves to an unattacked empty square.
103. Black ends its completed move.
104. FAQ40 and Fatal Attraction forbid Evangelists: Black's a3 bishop is frozen by the copied a4 magnet; reject atomically.
105. White ends its bishop-swap replacement move; its a3 bishop is now frozen.
106. Black rook e2-d2 moves one empty square; the c1 bishop does not attack White's f1 king.
107. Black ends its completed move.
108. White pawn g4-g5 advances into an empty square.
109. White ends its completed move.
110. Black rook d2-e2 returns to an empty square.
111. Black ends its completed move.
112. White bishop f3-g4 moves one diagonal square.
113. White ends its completed move.
114. Black pawn g7-g6 advances one empty square.
115. Black ends its completed move.
116. White knight h3-f2 jumps to an empty square and obstructs the e2 rook along rank two.
117. White ends its completed move.
118. Black knight d8-b7 jumps to an empty square.
119. Black ends its completed move.
120. White king f1-g2 steps onto an unattacked square; f2 knight obstructs the e2 rook ray.
121. White ends; Black starts with both kings safe and the a4 magnet retained.
`.trim().split('\n')

test('iteration 114 independent oracle through the forbidden Fatal Attraction swap', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/114.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, trace.steps.length)
  let state = createGameState(trace.initial)
  // Seed expectations from standard chess identities and the input decks, never from reducer output.
  const pieces: PieceState[] = []
  const roles = ['rook','knight','bishop','queen','king','bishop','knight','rook'] as const
  for (const owner of ['white', 'black'] as const) for (let rank = 1; rank <= 8; rank++) for (let file = 0; file < 8; file++) {
    if (!(owner === 'white' ? rank === 1 || rank === 2 : rank === 7 || rank === 8)) continue
    const square = `${'abcdefgh'[file]}${rank}` as SquareName
    const role = rank === 2 || rank === 7 ? 'pawn' : roles[file]!
    pieces.push({ id: `${owner}-${role}-${square}`, owner, role, originalRole: role, square, zone: 'board', promoted: false, royal: role === 'king', neutral: false })
  }
  const makeCards = (owner: Color, zone: 'hand'|'deck') => (zone === 'hand' ? trace.initial.hands : trace.initial.decks)![owner]!.map((cardId, i) => ({id: `${owner}-${zone}-${i}-${cardId}`, cardId}))
  const players = { white: {hand:makeCards('white','hand'),deck:makeCards('white','deck'),discard:[] as CardInstance[]}, black: {hand:makeCards('black','hand'),deck:makeCards('black','deck'),discard:[] as CardInstance[]} }
  let effects: Array<FatalAttractionEffect | DoomsayerEffect> = []
  let turn = {color:'white' as Color, phase:'beforeMove' as 'beforeMove'|'afterMove', moveMade:false, cardPlays:{white:0,black:0}}
  let half = 0, full = 1, fenColor: Color = 'white', rights = 'KQkq'
  let ep: Array<{target:SquareName; pawnId:string}> = []
  const at = (square: string) => pieces.find(p => p.square === square && p.zone === 'board')
  const byId = (id: string) => { const p = pieces.find(p=>p.id===id); assert.ok(p); return p }
  const coords = (s:string) => [s.charCodeAt(0)-97, Number(s[1])-1] as const
  const frozen = (piece: PieceState) => !piece.royal && effects.some(e => {
    if(e.type !== 'fatal-attraction') return false
    const magnet = byId(e.pieceId)
    if(!magnet.square || !piece.square || magnet.id === piece.id) return false
    const [x,y]=coords(piece.square), [a,b]=coords(magnet.square)
    return Math.max(Math.abs(x-a),Math.abs(y-b)) === 1
  })
  const geometry = (piece:PieceState, to:string, capture:boolean) => {
    assert.ok(piece.square)
    const [x,y]=coords(piece.square), [a,b]=coords(to), dx=a-x, dy=b-y
    if(piece.role==='knight') return Math.abs(dx)*Math.abs(dy)===2
    if(piece.role==='king') return Math.max(Math.abs(dx),Math.abs(dy))===1
    if(piece.role==='pawn') {
      const forward=piece.owner==='white'?1:-1
      return capture ? Math.abs(dx)===1 && dy===forward : dx===0 && (dy===forward || dy===2*forward && y===(piece.owner==='white'?1:6) && !at(`${'abcdefgh'[x]}${y+forward+1}`))
    }
    const diagonal=Math.abs(dx)===Math.abs(dy), straight=dx===0 || dy===0
    if(!(piece.role==='bishop'?diagonal:piece.role==='rook'?straight:diagonal||straight)) return false
    for(let n=1;n<Math.max(Math.abs(dx),Math.abs(dy));n++) if(at(`${'abcdefgh'[x+Math.sign(dx)*n]}${y+Math.sign(dy)*n+1}`)) return false
    return true
  }
  const checked = (owner:Color) => {
    const king = pieces.find(p=>p.owner===owner && p.royal)!; assert.ok(king.square)
    return pieces.some(p=>p.zone==='board' && p.owner!==owner && !frozen(p) && geometry(p,king.square!,true))
  }
  const consumeMove = (pawn:boolean, capture=false) => { half=pawn||capture?0:half+1; if(turn.color==='black') full++; fenColor=turn.color==='white'?'black':'white';turn.phase='afterMove';turn.moveMade=true; ep=[] }
  const relocate = (id:string,to:SquareName) => { const p=byId(id);p.square=to;p.zone='board';delete p.capturedBy }
  const swap = (a:string,b:string) => { const p=at(a)!,q=at(b)!;[p.square,q.square]=[q.square,p.square] }
  let pending: {player:Color;cardInstanceId:string}|null=null
  let moves=0,cards=0
  for(const [index,{action}] of trace.steps.slice(0, 103).entries()) {
    const n=index+1, label=rationale[index]!
    assert.ok(label.startsWith(`${n}. `))
    const actor=turn.color
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.to,/^[a-h][1-8]$/)
      const p=at(action.from);assert.ok(p,label);assert.equal(p.owner,actor,label);assert.equal(frozen(p),false,label)
      const victim=at(action.to);assert.ok(!victim || victim.owner!==actor,label)
      assert.ok(geometry(p,action.to,!!victim),label)
      if(victim){assert.equal(victim.royal,false);victim.square=null;victim.zone='captured';victim.capturedBy=actor}
      const from=p.square!;p.square=action.to as SquareName
      consumeMove(p.role==='pawn',!!victim)
      if(p.role==='pawn' && Math.abs(Number(from[1])-Number(action.to[1]))===2) ep=[{target:`${from[0]}${(Number(from[1])+Number(action.to[1]))/2}` as SquareName,pawnId:p.id}]
      if(n===33){const effect=effects.find(e=>e.type==='fatal-attraction'&&e.pieceId===p.id)!;players.black.discard.push(effect.card);effects=effects.filter(e=>e!==effect)}
      moves++
    } else if(action.type==='endTurn') {
      assert.equal(checked(actor),false,label);assert.equal(turn.moveMade,true,label)
      turn={color:actor==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
    } else if(action.type==='declineDoomsayer') {
      assert.deepEqual(pending,{player:'black',cardInstanceId:'white-hand-3-doomsayer'});pending=null
    } else if(action.type==='namePiece') {
      assert.deepEqual(action,{type:'namePiece',speaker:'white',name:'queen',losses:[{effectId:'white-hand-3-doomsayer',pieceId:'white-queen-d1'}]})
      const queen=byId('white-queen-d1');queen.square=null;queen.zone='captured';queen.capturedBy='white'
      players.white.discard.push(effects[0]!.card);effects=[]
    } else if(action.type==='playCard') {
      const zone=players[actor], i=zone.hand.findIndex(c=>c.id===action.cardInstanceId);assert.ok(i>=0,label)
      const card=zone.hand.splice(i,1)[0]!;assert.equal(card.cardId,action.cardId);assert.equal(turn.cardPlays[actor],0,label)
      turn.cardPlays[actor]++;cards++
      if(n===2){effects.push({type:'doomsayer',owner:actor,card});pending={player:'black',cardInstanceId:card.id}}
      else if(n===24 || n===31) effects.push({type:'fatal-attraction',owner:actor,card,pieceId:n===24?'black-knight-g8':'white-pawn-a2'})
      else {
        zone.discard.push(card)
        if(n===15 || n===41){const p=byId(n===15?'black-pawn-c7':'white-pawn-c2');p.square=null;p.zone='dead';delete p.capturedBy}
        else if(n===36){relocate('white-rook-a1','h1');relocate('white-rook-h1','h8');relocate('black-rook-a8','a1');relocate('black-rook-h8','a8');rights='-'}
        else if(n===51){relocate('black-pawn-d7','f6');consumeMove(true)}
        else if(n===54){relocate('white-bishop-c1','c1');half=0;full=12;fenColor='white';turn.phase='beforeMove';turn.moveMade=false;ep=[]}
        else if(n===59){swap('h7','a7');consumeMove(false)}
        else if(n===71){relocate('white-pawn-d2','c4');relocate('white-pawn-f2','g4');consumeMove(true)}
        else if(n===75){assert.equal(byId('white-pawn-b2').zone,'captured');assert.equal(at('e2'),undefined);relocate('white-pawn-b2','e2');consumeMove(true)}
        else if(n===88) swap('c8','h5')
        else if(n===100){relocate('white-king-e1','f1');consumeMove(false)}
        else assert.fail(`Unreviewed card at ${n}`)
      }
      zone.hand.push(zone.deck.shift()!)
    } else assert.fail(`Unreviewed action at ${n}`)
    const original: GameState=structuredClone(state)
    const result=applyAction(state,action)
    assert.deepEqual(state,original,`${label}: complete input immutable`)
    assert.equal(result.ok,true,label)
    state=result.state
    const sorted=(p:PieceState[])=>[...p].sort((a,b)=>a.id.localeCompare(b.id))
    assert.deepEqual(sorted(state.pieces),sorted(pieces),`${label}: complete physical identity and captor`)
    assert.deepEqual(state.players,players,`${label}: complete card zones`)
    assert.deepEqual(state.effects,effects,`${label}: complete effects`)
    assert.deepEqual(state.turn,turn,`${label}: turn and allowances`)
    assert.deepEqual(state.enPassant,ep,`${label}: en passant`)
    assert.deepEqual(state.pendingDoomsayer??null,pending,`${label}: naming choice`)
    assert.equal(!!state.pendingRescue,n===30||n===53,`${label}: rescue iff needed`)
    assert.equal(state.pendingAbduction??null,null,label)
    assert.deepEqual(state.underElfHill??[],[],label)
    assert.equal(state.orientation,0,label)
    assert.equal(state.outcome,null,label)
    for(const owner of ['white','black'] as const) assert.equal(isKingInCheck(state,owner),checked(owner),`${label}: independent ${owner} royal safety`)
    if(turn.moveMade) assert.equal(checked(turn.color),n===30||n===53,`${label}: actor royal safety`)
    const symbols={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}
    const ranks=[]
    for(let r=8;r>=1;r--){let rank='',empty=0;for(const f of 'abcdefgh'){const p=at(`${f}${r}`);if(!p){empty++;continue}if(empty){rank+=empty;empty=0}const ch=symbols[p.role];rank+=p.owner==='white'?ch.toUpperCase():ch}if(empty)rank+=empty;ranks.push(rank)}
    const fenEp=n>=35&&n<=37?'f3':'-'
    assert.equal(state.fen,`${ranks.join('/')} ${fenColor[0]} ${rights} ${fenEp} ${half} ${full}`,`${label}: complete independently constructed FEN`)
  }
  assert.equal(moves,42)
  assert.equal(cards,13)
  assert.equal(state.fen,'3n2k1/3n2p1/2r1pp2/R4p1b/P1P3P1/bp2PBPN/4r2P/2B2K1R w - - 2 24')
  assert.equal(frozen(at('a3')!),true)
  const before = structuredClone(state)
  assert.deepEqual(trace.steps[103].action, { type:'playCard', cardId:'evangelists',
    cardInstanceId:'white-deck-8-evangelists', target:{own:'c1',opponent:'a3'} })
  const rejected = applyAction(state, trace.steps[103].action)
  assert.equal(rejected.ok,false,rationale[103])
  assert.deepEqual(rejected.state,before)
  assert.deepEqual(state,before)
})

test('iteration 114 deterministic replay preserves every valid prefix hash', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/114.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  const steps = trace.steps.slice(0, 103)
  replayTrace({ ...trace, steps, moves:steps.filter(step => step.action.type === 'move').length,
    finalFen:'3n2k1/3n2p1/2r1pp2/R4p1b/P1P3P1/bp2PBPN/4r2P/2B2K1R w - - 2 24' })
})
