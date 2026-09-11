import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { CardInstance, GameState, PieceState, SquareName } from '../types.js'

// Independently read in order against rules §§8–14,18,20–21 and printed catalog timing.
const rationales = `
1. Ng1-f3 jumps to an empty square; White remains safe.
2. White closes the completed move; Black receives fresh allowances.
3. Ng8-f6 is a quiet Knight jump.
4. Black closes; White acts next.
5. Blessing sends c2-f5 along empty d3/e4 without capture; Pawn clock resets.
6. Blessing consumed White's move; handoff changes no board or clock.
7. d7-d6 advances one empty square.
8. Cathedral exchanges owned Rh8/Bc8 after the move; identities and clocks survive the non-move swap.
9. Black closes its move and Cathedral window.
10. e2-e4 crosses empty e3 and creates e3 en-passant availability.
11. Challenge names c7, which can advance; it preserves the move and e3 opportunity.
12. Black receives the obligation to use the c7 Pawn.
13. Passing in the Night swaps c7/f2 and d6/e4 simultaneously; using c7 satisfies Challenge, f2 gives check but White can escape.
14. Black closes the replacement move; White must answer the f2 Pawn's check.
15. Nf3-d4 leaves e1 attacked by f2; this is provisional pending a saving card.
16. Fatal Attraction at d2 cannot immobilize f2, two files away; fizzle spends card and rewinds the unresolved Knight move.
17. Ke1-e2 escapes the f2 Pawn's e1/g1 attacks and revokes White castling.
18. White closes with its King safe at e2.
19. Rc8xc7 captures the physical white f2 Pawn; Black is the captor.
20. Black closes the capture; White acts next.
21. Dark Mirror f5xe4 is a backward Pawn capture of the original d7 Pawn by White.
22. White closes its replacement capture.
23. Nf6-g4 is a quiet jump.
24. Black closes; no card or clock change.
25. Nf3-d4 is now safe because the King moved to e2.
26. White closes; Black acts next.
27. g7-g6 advances one empty square.
28. Black closes its Pawn move.
29. Nd4-b5 is an empty Knight landing.
30. White closes its Knight move.
31. h7-h5 crosses empty h6 and creates h6 en-passant availability.
32. Black closes; h6 remains available for this White reply.
33. b2-b4 crosses b3; the old h6 opportunity expires and b3 replaces it.
34. White closes; b3 remains available to Black.
35. e7-e6 advances; b3 opportunity expires.
36. Black closes its Pawn move.
37. Fanatic a2-a5 traverses empty a3/a4/a5, makes no capture and no en-passant opportunity.
38. White closes the Fanatic replacement move.
39. Bf8-g7 takes one empty diagonal step.
40. Black closes its Bishop move.
41. Ghostwalk d6-d7 is an ordinary empty Pawn advance; the special pass-through power need not be used.
42. White closes; d7 Pawn checks e8.
43. Ng4-f6 is a noncapturing first jump, provisionally leaving Black checked by d7.
44. Charge uses that same Knight f6xd7 to remove the checking Pawn, crediting Black; only the capture clock resets.
45. Black closes after the completed two-jump rescue.
46. e4-e5 is one empty forward Pawn step.
47. Fortification marks adjacent e8/f7 as a continuing undirected wall, retaining its physical card.
48. White closes; the wall persists.
49. Nd7-f8 jumps and does not cross a forbidden non-jumping boundary.
50. Black closes its Knight move.
51. g2-g4 traverses empty g3 and creates g3 en-passant availability.
52. White closes; g3 remains available for Black's reply.
53. Nf8-d7 jumps; old g3 opportunity expires.
54. Black closes; the wall remains.
55. Nb5xc7 captures the original h8 Rook for White and checks e8 by Knight geometry.
56. White closes; Black receives check.
57. Ke8-f8 escapes the Knight's attack; this boundary differs from e8/f7, and Black loses castling rights.
58. Black closes with King safe on f8.
59. Rh1-g1 slides one empty square.
60. White closes its Rook move.
61. f7-f6 is an empty Pawn advance, not a crossing of e8/f7.
62. Black closes its Pawn move.
63. Ke2xf2 captures the original c7 Pawn for White; f2 is safe.
64. White closes its King capture.
65. Nb8-a6 is an empty Knight jump.
66. Black closes its Knight move.
67. Ra1-a3 passes through empty a2.
68. White closes its Rook move.
69. g6-g5 advances into an empty square.
70. Black closes its Pawn move.
71. Kf2-f3 is a safe neighboring landing.
72. White closes with King f3 safe.
73. Bg7-h6 is a quiet diagonal step.
74. Black closes its Bishop move.
75. d2-d3 advances to an empty square.
76. White closes its Pawn move.
77. b7-b6 is a quiet Pawn advance.
78. Dungeon relocates opposing Nc7 to empty corner a1; no capture, clocks unchanged, one-turn restriction attaches to its identity.
79. Black closes; White inherits the a1 Knight restriction.
80. Onslaught advances d3-d4 and h2-h3 simultaneously into empty squares; the detained Knight remains still.
81. White closes its replacement move, expiring Dungeon while Fortification persists.
82. Na6xb4 captures White's original b2 Pawn for Black.
83. Black closes its capture.
84. Bc1-d2 is one empty diagonal step.
85. White closes its Bishop move.
86. Breakthrough e6xe5 captures directly forward, removing the original white c2 Pawn for Black.
87. Black closes its replacement capture.
88. h3-h4 advances into an empty square.
89. White closes its Pawn move.
90. Nd7-c5 jumps to empty c5.
91. Black closes its Knight move.
92. Bd2-e1 is a quiet diagonal step.
93. White closes its Bishop move.
94. Bh6-g7 is a quiet diagonal step.
95. Black closes its Bishop move.
96. a5-a6 advances to empty a6; a7 remains occupied.
97. White closes its Pawn move.
98. f6-f5 is a quiet Pawn advance.
99. Black closes its Pawn move.
100. Qd1-d3 passes through now-empty d2.
101. White closes its Queen move.
102. Nc5-a4 jumps to empty a4.
103. Black closes its Knight move.
104. Qd3-d2 slides one square without capture.
105. White closes its Queen move.
106. Bg7-h6 is an empty diagonal landing.
107. Black closes its Bishop move.
108. Qd2-c3 is a quiet diagonal step.
109. Disintegration kills White's original g2 Pawn at g4; death is not capture and does not reset the move clock.
110. White closes; the dead Pawn cannot return.
111. Bh6-g7 is a quiet diagonal step.
112. Black closes its Bishop move.
113. Kf3-e4 is provisional because the f5 Pawn currently attacks e4.
114. Earthquake clockwise changes White forward to west and Black to east; h5 promotes to Black Bishop before a6 to White Queen, removing f5's e4 attack without moving pieces or clocks.
115. White closes its rescued King move; fixed wall coordinates persist.
116. Promoted Bh5-f7 traverses empty g6; the wall only forbids f7/e8, beyond this landing.
117. Black closes its promoted Bishop move.
118. Bf1-e2 is a quiet diagonal step; orientation changes only Pawn directions.
119. White closes its Bishop move.
120. Lost Castle swaps Black Ra8 and White Rg1 as one noncapturing replacement; Black's Queen d8 blocks the new Ra8 ray to f8.
121. Black closes its replacement move with no added clock increment.
122. Ke4-e3 is an empty safe neighboring square under eastward Black Pawn attacks.
123. White closes move command 50; Black acts next with both Kings present and no pending rescue.
`.trim().split('\n')

const at = (state: GameState, square: string) => state.pieces.find(p => p.square === square && p.zone === 'board')
const coordinates = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const

// Geometry oracle uses physical board records, never reducer move enumeration.
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  const [x,y] = coordinates(piece.square!), [tx,ty] = coordinates(to)
  const dx = tx-x, dy = ty-y
  if (!dx && !dy) return false
  if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1
    if (state.orientation === 270) return capture ? dx === -forward && Math.abs(dy) === 1 : dx === -forward && dy === 0
    if (capture) return Math.abs(dx) === 1 && dy === forward
    return dx === 0 && (dy === forward || dy === 2*forward && y === (forward === 1 ? 1 : 6) && !at(state, `${piece.square![0]}${y+1+forward}`))
  }
  if (piece.role === 'king' && Math.max(Math.abs(dx),Math.abs(dy)) !== 1) return false
  if (piece.role === 'bishop' && Math.abs(dx) !== Math.abs(dy)) return false
  if (piece.role === 'rook' && dx !== 0 && dy !== 0) return false
  if (piece.role === 'queen' && dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false
  const count = Math.max(Math.abs(dx),Math.abs(dy))
  let previous = piece.square!
  for (let n=1;n<=count;n++) {
    const square = `${String.fromCharCode(97+x+n*Math.sign(dx))}${y+1+n*Math.sign(dy)}` as SquareName
    if (state.effects.some(e => { const wall = e as {type?:string;from?:string;to?:string}; return wall.type === 'fortification' && (wall.from === previous && wall.to === square || wall.to === previous && wall.from === square) })) return false
    if (n<count && at(state,square)) return false
    previous = square
  }
  return true
}

function inCheck(state: GameState, color: 'white'|'black'): boolean {
  const king = state.pieces.find(p=>p.royal && p.owner===color)!
  return state.pieces.some(p=>p.zone==='board' && p.owner!==color && reaches(state,p,king.square!,true))
}

test('iteration 093: independent semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/093.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(replayTrace(trace))
  assert.equal(rationales.length,123)
  assert.equal(trace.steps.length,rationales.length)
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,16)
  let state = createGameState(trace.initial)
  let beforeUnresolved: GameState | undefined
  for (const [index,{action}] of trace.steps.entries()) {
    const n=index+1, before=state, expected=structuredClone(before.pieces)
    assert.ok(rationales[index]!.startsWith(`${n}. `))
    const move = (from:string,to:string,capture=false) => {
      const mover = expected.find(p=>p.square===from && p.zone==='board')!
      assert.ok(mover, `${n}: physical mover at ${from}`)
      const victim = expected.find(p=>p.square===to && p.zone==='board')
      if (capture) {
        assert.ok(victim && !victim.royal && victim.owner!==before.turn.color)
        victim.square=null; victim.zone='captured'; victim.capturedBy=before.turn.color
      } else assert.equal(victim,undefined,`${n}: empty destination`)
      mover.square=to as SquareName
    }
    const swap = (a:string,b:string) => {
      const first=expected.find(p=>p.square===a)!, second=expected.find(p=>p.square===b)!
      assert.ok(first && second)
      first.square=b as SquareName; second.square=a as SquareName
    }
    let reset=false, advances=false
    if (action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover=at(before,action.from)!, capture=!!at(before,action.to)
      assert.equal(mover.owner,before.turn.color)
      assert.ok(reaches(before,mover,action.to,capture),`${n}: independently valid path`)
      move(action.from,action.to,capture)
      reset=mover.role==='pawn'||capture; advances=true
    } else if (action.type==='playCard') {
      switch(n) {
        case 5: move('c2','f5'); reset=true; advances=true; break
        case 8: swap('h8','c8'); break
        case 11: assert.equal(at(before,'c7')!.id,'black-pawn-c7'); assert.equal(at(before,'c6'),undefined); break
        case 13: swap('c7','f2'); swap('d6','e4'); reset=true; advances=true; break
        case 16: assert.ok(beforeUnresolved); expected.splice(0,expected.length,...structuredClone(beforeUnresolved.pieces)); break
        case 21: move('f5','e4',true); reset=true; advances=true; break
        case 37: for(const s of ['a3','a4','a5']) assert.equal(at(before,s),undefined); move('a2','a5'); reset=true; advances=true; break
        case 41: move('d6','d7'); reset=true; advances=true; break
        case 44: assert.ok(reaches(before,at(before,'f6')!,'d7',true)); move('f6','d7',true); reset=true; break
        case 47: break
        case 78: move('c7','a1'); break
        case 80: move('d3','d4'); move('h2','h3'); reset=true; advances=true; break
        case 86: move('e6','e5',true); reset=true; advances=true; break
        case 109: { const pawn=expected.find(p=>p.id==='white-pawn-g2')!; assert.equal(pawn.square,'g4'); pawn.zone='dead'; pawn.square=null; break }
        case 114: for(const [id,role] of [['black-pawn-h7','bishop'],['white-pawn-a2','queen']] as const) { const pawn=expected.find(p=>p.id===id)!; pawn.role=role; pawn.promoted=true } break
        case 120: swap('a8','g1'); advances=true; break
        default: assert.fail(`unreviewed card at ${n}`)
      }
    } else assert.equal(action.type,'endTurn')
    const result=applyAction(before,action)
    assert.ok(result.ok,`${n}: action accepted`)
    state=result.state
    // Capture timestamps are engine bookkeeping; actual capture actor is asserted in the complete physical comparison.
    const physical=(pieces:PieceState[])=>pieces.map(({capturedAtPly:_,...p})=>p)
    assert.deepEqual(physical(state.pieces),physical(expected),`${n}: independently expected pieces/capture actors`)
    const clocks=before.fen.split(' ').slice(4).map(Number)
    if(n===16) assert.equal(state.fen,beforeUnresolved!.fen,'failed saving card rewinds board, rights and clocks')
    else assert.deepEqual(state.fen.split(' ').slice(4).map(Number),[reset?0:clocks[0]!+(advances?1:0),clocks[1]!+(advances&&before.turn.color==='black'?1:0)],`${n}: clocks`)
    assert.equal(state.orientation,n>=114?270:0)
    assert.equal(!!state.pendingRescue,[15,43,113].includes(n),`${n}: independently known rescue window`)
    if([15,43,113].includes(n)) { assert.ok(inCheck(state,before.turn.color)); beforeUnresolved=before }
    else if(action.type!=='endTurn' && n!==16) assert.equal(inCheck(state,before.turn.color),false,`${n}: acting King safe`)
    if(action.type==='endTurn') {
      assert.equal(inCheck(before,before.turn.color),false,`${n}: safe to close turn`)
      assert.equal(state.turn.color,before.turn.color==='white'?'black':'white')
      assert.equal(state.turn.phase,'beforeMove'); assert.equal(state.turn.moveMade,false)
      assert.deepEqual(state.turn.cardPlays,{white:0,black:0})
    }
    const effects:unknown[]=[]
    if(n===11||n===12) effects.push({type:'challenge',owner:'white',player:'black',pieceId:'black-pawn-c7'})
    if(n>=47) effects.push({type:'fortification',owner:'white',card:{id:'white-deck-4-fortification',cardId:'fortification'},from:'e8',to:'f7'})
    if(n>=78&&n<=80) effects.push({type:'dungeon',owner:'black',player:'white',pieceId:'white-knight-g1'})
    if(n>=114) effects.push({type:'earthquake',owner:'white',card:{id:'white-deck-8-earthquake',cardId:'earthquake'},direction:'clockwise',target:{direction:'clockwise',promotions:[{square:'h5',role:'bishop'},{square:'a6',role:'queen'}]}})
    assert.deepEqual(state.effects,effects,`${n}: exact effect identities and duration`)
    let ep:unknown[]=[]
    if(n>=10&&n<=12) ep=[{target:'e3',pawnId:'white-pawn-e2'}]
    if(n>=31&&n<=32) ep=[{target:'h6',pawnId:'black-pawn-h7'}]
    if(n>=33&&n<=34) ep=[{target:'b3',pawnId:'white-pawn-b2'}]
    if(n>=51&&n<=52) ep=[{target:'g3',pawnId:'white-pawn-g2'}]
    assert.deepEqual(state.enPassant,ep,`${n}: exact en-passant lifetime`)
    for(const color of ['white','black'] as const) {
      const player=before.players[color]
      if(action.type==='playCard' && player.hand.some(c=>c.id===action.cardInstanceId)) {
        const card: CardInstance=player.hand.find(c=>c.id===action.cardInstanceId)!
        assert.equal(color,before.turn.color)
        assert.equal(before.turn.cardPlays[color],0)
        assert.deepEqual(state.players[color].hand,[...player.hand.filter(c=>c.id!==card.id),player.deck[0]!])
        assert.deepEqual(state.players[color].deck,player.deck.slice(1))
        assert.deepEqual(state.players[color].discard,[...player.discard,...([47,114].includes(n)?[]:[card])])
        assert.equal(state.turn.cardPlays[color],1)
      } else assert.deepEqual(state.players[color],player,`${n}: other card identities unchanged`)
    }
  }
  assert.equal(state.fen,'R2q1k1b/p4bb1/Qp6/4ppp1/nn1P3P/R1Q1K3/4B3/NN2B1r1 b - - 11 29')
})
