import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { createGameState } from '../state.js'
import { applyAction } from '../reducer.js'
import { CARD_CATALOG } from './catalog.js'
import type { Color, PieceState, SquareName, Role } from '../types.js'

// Sequential semantic review from rules §§8–15, 18, 21–22 and the printed catalog.
const rationale = `
1. h2-h4 crosses empty h3; initial double step creates h3 en passant.
2. White yields; h3 opportunity survives until Black acts.
3. c7-c5 crosses empty c6 and replaces h3 with c6 en passant.
4. Black yields with c6 opportunity intact.
5. e2-e3 is a quiet pawn step; c6 opportunity expires.
6. White yields with both Kings safe.
7. Masquerade moves Queen d8-c7 diagonally to the vacant square, replaces Black move and draws Passing in the Night.
8. Black yields after the replacement move.
9. a2-a3 is one forward pawn step.
10. White yields after a3.
11. Queen c7-e5 traverses empty d6 diagonally.
12. Black yields after Qe5.
13. Bishop f1-c4 traverses vacant e2 and d3.
14. White yields after Bc4.
15. a7-a6 advances the Black pawn one square.
16. Black yields after a6.
17. g2-g4 crosses empty g3 and creates g3 en passant.
18. White yields; g3 opportunity remains.
19. Queen e5-f6 makes a quiet diagonal step and clears en passant.
20. Black yields after Qf6.
21. Tournament exchanges White b1 and Black b8 Knights without capture and consumes White move.
22. White yields after the Knight exchange.
23. Queen f6-g6 moves one file right.
24. Holy War swaps Black g8 Knight and c8 Bishop after the move, retaining both identities.
25. Black yields after the swap.
26. b2-b3 advances White pawn to a vacant square.
27. White yields after b3.
28. Queen g6-c2 traverses f5,e4,d3 and captures White c2 pawn for Black.
29. Black yields after Qxc2.
30. Passing in the Night swaps a3/e7 and e3/g7 pawn pairs simultaneously without promotion or capture.
31. White yields after the two swaps.
32. Black pawn a3-a2 advances toward rank one.
33. Black yields after a2.
34. White pawn e7xf8 captures the Black Bishop and legally promotes to Bishop by an ordinary move.
35. Legacy reacts to loss of a non-Pawn Bishop, recovers discarded Holy War, spends Legacy and additionally draws Coup.
36. Earthquake turns orientation clockwise: White moves east, Black west; a2,a6,h4 pawns promote to Rook,Queen,Rook respectively.
37. White yields with Earthquake retained as a continuing card.
38. Black Knight c8-e7 uses an ordinary 2-by-1 leap.
39. Black yields after Ne7.
40. White pawn d2-e2 moves east under Earthquake.
41. White yields after e2.
42. Black Queen c2-e4 traverses empty d3.
43. Recovered Holy War swaps Black b1 Knight with g8 Bishop, without capturing either.
44. Black yields after Holy War.
45. White pawn f2-g2 advances east into vacancy.
46. White yields after g2.
47. Black King e8-d8 takes a safe adjacent square and loses both castling rights.
48. Black yields after Kd8.
49. Bishop c1-a3 traverses empty b2 diagonally.
50. White yields after Ba3.
51. Promoted Black Rook a2-c2 traverses empty b2.
52. Black yields after Rc2.
53. White Rook a1xb1 captures the displaced Black Bishop and loses queenside castling.
54. Dungeon sends Black e3 pawn to vacant a1, without promotion, and freezes it for Black next turn.
55. White yields; Dungeon remains for Black turn.
56. Promoted Black Queen a6-a4 passes empty a5; imprisoned a1 pawn remains still.
57. Black yields; the completed restricted turn expires Dungeon.
58. White Rook b1-b2 takes the vacant adjacent square.
59. White yields after Rb2.
60. Promoted Black Rook c2-c3 takes the vacant adjacent square.
61. Black yields after Rc3.
62. White Queen d1xd7 traverses empty d2-d6, captures Black d7 pawn and checks King d8.
63. White yields, giving checked Black its escape turn.
64. Black Rook a8-a6 passes a7; the King still in check must be rescued before the turn ends (§11.6).
65. Coup rescues Black by transferring royalty from d8 Prince to safe g8 Knight; the Knight keeps its movement.
66. Black yields with the new King safe at g8.
67. White Queen d7xb7 passes c7 and captures Black b7 pawn.
68. White yields after Qxb7.
69. Black Queen e4-f3 moves one diagonal square.
70. Black yields after Qf3.
71. White Bishop c4-d5 makes a quiet diagonal step.
72. Treason swaps Black c3 Rook and royal g8 Knight; the royal marker follows the Knight to c3 safely.
73. White yields after Treason.
74. Black Queen f3xg2 captures White f2 pawn for Black.
75. Black yields after Qxg2.
76. Promoted White Rook h4xh7 crosses h5,h6 and captures Black h7 pawn.
77. Bog replaces the three-square move with h4-h5, restores the captured h7 pawn and clears its capturedBy; recompute the quiet-move clock.
78. White yields after the shortened Rook move.
79. Black Queen g2-f2 moves one square horizontally and checks White e1 diagonally.
80. Siege swaps Black royal c3 Knight and g8 Rook, preserving the royal identity and Queen check.
81. Black yields; White has a King escape move.
82. White King e1-d1 escapes the f2 Queen attack and loses remaining castling rights.
83. White yields after Kd1.
84. Black Passing in the Night exchanges c5/e2 and h7/b3 pawn pairs; h7 White pawn does not promote by this card; e2 Black pawn checks d1 west-diagonally.
85. Black yields, allowing White to answer the pawn check.
86. White Bishop d5-c4 is quiet but leaves pawn e2 checking King d1; the ensuing Crusade must rescue it.
87. Crusade moves that same Bishop c4xe2 via d3, captures the checking pawn and resets halfmove without a second fullmove increment.
88. White yields with King d1 rescued.
89. Black Rook a6-f6 traverses empty b6-e6.
90. Black yields after Rf6.
91. Long Jump relocates White g1 Knight to vacant opposite-color b5 and replaces the move.
92. White yields after Long Jump.
93. Promoted Black Queen a4-d4 crosses empty b4,c4 and checks White King along the d-file.
94. Black yields, allowing White its check response.
95. White pawn c5xd4 captures the checking Queen along its east-facing capture diagonal.
96. White yields with d-file check removed.
97. Black Rook h8xh7 captures the White b2 pawn that Passing placed there without promotion.
98. Disintegration makes Black f7 pawn irreversibly dead; no capturedBy is attached.
99. Black yields after Disintegration.
100. Promoted White Rook h5-h4 moves to an empty square.
101. White yields after Rh4.
102. Breakthrough lets Black b3 pawn capture straight west onto a3, capturing White c1 Bishop without promoting.
103. Black yields after the replacement capture.
104. White Bishop e2-d3 takes one diagonal step; Queen f2 is not aligned with King d1.
105. White yields after Bd3.
106. Black Rook f6-c6 traverses empty e6,d6.
107. Black yields after Rc6.
108. White Rook b2-b3 advances one square.
109. White yields after Rb3.
110. Black Queen f2xd4 traverses e3 and captures White d2 pawn; Bishop d3 blocks its ray to King d1.
111. Black yields after Qxd4.
112. Under Elf Hill removes White King d1 to away and consumes White move; no capture occurs.
113. White yields; its King remains away during Black turn.
114. Black Queen d4-c5 moves one diagonal square.
115. Black yields, triggering White King return at the start of White turn.
116. King returns to vacant safe edge square f1 without consuming the turn move; that King must stay put this turn.
117. White promoted Rook h4xh7 passes h5,h6 and captures Black h8 Rook; returned King f1 stays put.
118. White yields, ending the King movement prohibition.
119. Black Prince d8-c8 moves one square; it may occupy an attacked square because g8 Knight is the actual King.
120. Black yields with the actual g8 King safe.
121. White Queen b7xc8 captures the Prince legally; Black royal g8 Knight remains in play.
122. Figure Dance sends h1 Rook to h8 and a1 Black pawn to h1 simultaneously; Black last file is a so no pawn promotion; Black King g8 is checked with f6 escape.
123. White yields; Black must escape the h8 Rook attack.
124. Royal Black Knight g8-f6 leaps to a safe square and escapes the rook.
125. Black yields with royal Knight f6 safe.
126. White Rook h7-h4 passes empty h6,h5.
127. White yields after its fiftieth Regular Move command; all obligations resolved.
`.trim().split('\n')

test('iteration 111 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/111.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(replayTrace(trace))
})

test('iteration 111 independent physical, card, clock, and royal review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/111.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, trace.steps.length)
  let actual = createGameState(trace.initial)
  const pieces = structuredClone(actual.pieces)
  const players = structuredClone(actual.players)
  let effects: unknown[] = []
  let orientation = 0
  let turn = structuredClone(actual.turn)
  let ep: typeof actual.enPassant = []
  let rights = 'KQkq', half = 0, full = 1, fenColor: Color = 'white'
  let hill: typeof actual.underElfHill
  const pieceAt = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square)!
  const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
  const other = (color: Color): Color => color === 'white' ? 'black' : 'white'
  const clear = (from: string, to: string) => {
    const [x,y] = xy(from), [u,v] = xy(to), dx = Math.sign(u-x), dy = Math.sign(v-y)
    for (let a=x+dx,b=y+dy;a!==u||b!==v;a+=dx,b+=dy) assert.equal(pieceAt(String.fromCharCode(97+a)+(b+1)), undefined, `blocked ${from}-${to}`)
  }
  const attacks = (piece: PieceState, square: string) => {
    const [x,y]=xy(piece.square!), [u,v]=xy(square), dx=u-x,dy=v-y
    if (piece.role === 'pawn') return orientation === 0 ? Math.abs(dx)===1 && dy===(piece.owner==='white'?1:-1) : Math.abs(dy)===1 && dx===(piece.owner==='white'?1:-1)
    if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy)===2
    if (piece.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy))===1
    const aligned = piece.role==='rook' ? dx===0||dy===0 : piece.role==='bishop' ? Math.abs(dx)===Math.abs(dy) : dx===0||dy===0||Math.abs(dx)===Math.abs(dy)
    if (!aligned) return false
    for(let a=x+Math.sign(dx),b=y+Math.sign(dy);a!==u||b!==v;a+=Math.sign(dx),b+=Math.sign(dy)) if(pieceAt(String.fromCharCode(97+a)+(b+1))) return false
    return true
  }
  const checked = (color: Color) => {
    const king=pieces.find(p=>p.owner===color&&p.royal&&p.zone==='board')
    return !!king && pieces.some(p=>p.zone==='board'&&p.owner!==color&&attacks(p,king.square!))
  }
  const move = (from: string, to: string, actor: Color, promotion?: unknown, geometry=true) => {
    const p=pieceAt(from), victim=pieceAt(to)
    assert.ok(p,from); assert.equal(p.owner,actor)
    const [x,y]=xy(from),[u,v]=xy(to)
    if(geometry) {
      if(p.role==='pawn'&&!victim) {
        const distance=orientation===0?Math.abs(v-y):Math.abs(u-x)
        assert.equal(orientation===0?u-x:v-y,0)
        assert.equal(Math.sign(orientation===0?v-y:u-x),actor==='white'?1:-1)
        assert.ok(distance===1||distance===2)
        if(distance===2) assert.ok((orientation===0?y:x)===(actor==='white'?1:6))
        clear(from,to)
      } else assert.ok(attacks(p,to),`${from}-${to}: movement geometry`)
    }
    if(victim) { assert.equal(victim.owner,other(actor)); assert.equal(victim.royal,false); victim.square=null;victim.zone='captured';victim.capturedBy=actor }
    const pawn=p.role==='pawn'
    if(p.role==='king'&&p.royal) rights=rights.replace(actor==='white'?/[KQ]/g:/[kq]/g,'')
    for(const [sq,right] of [['a1','Q'],['h1','K'],['a8','q'],['h8','k']]) if(from===sq||to===sq) rights=rights.replace(right!,'')
    assert.match(to,/^[a-h][1-8]$/);p.square=to as SquareName
    if(promotion) { assert.ok(['queen','rook','bishop','knight'].includes(String(promotion)));p.role=promotion as Role;p.promoted=true }
    ep=[]
    if(pawn&&Math.abs(v-y)===2&&orientation===0) ep=[{target:(from[0]+String((y+v)/2+1)) as SquareName,pawnId:p.id}]
    return pawn||!!victim
  }
  const swap=(a:string,b:string)=>{const p=pieceAt(a),q=pieceAt(b);assert.ok(p&&q);[p.square,q.square]=[q.square,p.square]}
  const boardFen=()=>{
    const roles: Record<Role,string>={pawn:'p',rook:'r',knight:'n',bishop:'b',queen:'q',king:'k'}
    return Array.from({length:8},(_,i)=>{let row='',empty=0;for(let x=0;x<8;x++){const p=pieceAt(String.fromCharCode(97+x)+(8-i));if(!p){empty++;continue}if(empty){row+=empty;empty=0}const c=roles[p.role];row+=p.owner==='white'?c.toUpperCase():c}return row+(empty||'')}).join('/')
  }
  for(const [index,{action}] of trace.steps.entries()) {
    const n=index+1, label=rationale[index]!
    assert.ok(label.startsWith(`${n}. `))
    const before=structuredClone(actual), actor=turn.color
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.equal(turn.moveMade,false)
      half=move(action.from,action.to,actor,action.promotion)?0:half+1
      if(actor==='black')full++
      fenColor=other(actor);turn.phase='afterMove';turn.moveMade=true
    } else if(action.type==='endTurn') {
      assert.equal(checked(actor),false,`${label}: cannot end in check`)
      turn={color:other(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
      if(n===57) effects=effects.filter(e=>(e as {type:string}).type!=='dungeon')
      if(n===115) hill=[{pieceId:'white-king-e1',player:'white',returning:true}]
      if(n===118) hill=[]
    } else if(action.type==='returnKing') {
      assert.equal(n,116);assert.equal(pieceAt('f1'),undefined)
      const p=pieces.find(p=>p.royal&&p.owner==='white')!;p.square='f1';p.zone='board'
      hill=[{pieceId:p.id,player:'white',returning:true,returned:true}]
    } else if(action.type==='playCard') {
      const owner: Color=players.white.hand.some(c=>c.id===action.cardInstanceId)?'white':'black'
      const player=players[owner],at=player.hand.findIndex(c=>c.id===action.cardInstanceId)
      assert.ok(at>=0);const card=player.hand.splice(at,1)[0]!
      assert.equal(card.cardId,action.cardId)
      assert.equal(turn.cardPlays[owner],0,label)
      const meta=CARD_CATALOG[card.cardId]!
      assert.ok(meta.timing.includes(owner===actor?turn.phase:'afterOpponentMove'),label)
      turn.cardPlays[owner]++
      if(!meta.continuing)player.discard.push(card)
      if(n===35){const i=player.discard.findIndex(c=>c.id==='black-hand-4-holy-war');assert.ok(i>=0);player.hand.push(player.discard.splice(i,1)[0]!)}
      player.hand.push(player.deck.shift()!)
      let replacement=false,pawnOrCapture=false
      switch(n) {
        case 7: move('d8','c7',owner);replacement=true;break
        case 21: swap('b1','b8');replacement=true;break
        case 24: swap('g8','c8');break
        case 30: swap('a3','e7');swap('e3','g7');replacement=true;pawnOrCapture=true;break
        case 35: break
        case 36:
          orientation=90
          for(const [sq,role] of [['a2','rook'],['a6','queen'],['h4','rook']] as const){const p=pieceAt(sq);assert.equal(p.role,'pawn');p.role=role;p.promoted=true}
          effects.push({type:'earthquake',owner,card,direction:'clockwise',target:{direction:'clockwise',promotions:[{square:'a2',role:'rook'},{square:'a6',role:'queen'},{square:'h4',role:'rook'}]}})
          break
        case 43:swap('b1','g8');break
        case 54:{const p=pieceAt('e3');p.square='a1';effects.push({type:'dungeon',owner,player:'black',pieceId:p.id});break}
        case 65:
          pieceAt('d8').royal=false;pieceAt('g8').royal=true
          effects.push({type:'coup',owner,card,princeId:'black-king-e8',kingId:'black-knight-b8',princeRole:'king'});break
        case 72:swap('c3','g8');break
        case 77:{
          const p=pieceAt('h7');assert.equal(p.id,'white-pawn-h2');p.square='h5'
          const restored=pieces.find(p=>p.id==='black-pawn-h7')!;restored.zone='board';restored.square='h7';delete restored.capturedBy
          half=1;break
        }
        case 80:swap('c3','g8');break
        case 84:swap('c5','e2');swap('h7','b3');replacement=true;pawnOrCapture=true;break
        case 87:assert.equal(move('c4','e2',owner),true);half=0;break
        case 91:assert.equal((xy('g1')[0]+xy('g1')[1])%2!== (xy('b5')[0]+xy('b5')[1])%2,true);move('g1','b5',owner,undefined,false);replacement=true;break
        case 98:{const p=pieceAt('f7');p.zone='dead';p.square=null;delete p.capturedBy;break}
        case 102:assert.equal(orientation,90);assert.equal(pieceAt('b3').role,'pawn');assert.equal(move('b3','a3',owner,undefined,false),true);replacement=true;pawnOrCapture=true;break
        case 112:{const p=pieceAt('d1');assert.equal(p.royal,true);p.square=null;p.zone='away';hill=[{pieceId:p.id,player:'white',returning:false}];replacement=true;break}
        case 122:{const a=pieceAt('a1'),h=pieceAt('h1');assert.equal(pieceAt('a8'),undefined);assert.equal(pieceAt('h8'),undefined);a.square='h1';h.square='h8';break}
        default:assert.fail(`unreviewed card ${n}`)
      }
      if(replacement){half=pawnOrCapture?0:half+1;if(actor==='black')full++;fenColor=other(actor);ep=[];turn.phase='afterMove';turn.moveMade=true}
    } else assert.fail(`unreviewed action ${n}`)
    const result=applyAction(actual,action)
    assert.deepEqual(actual,before,`${label}: complete input immutability`)
    assert.equal(result.ok,true,label);actual=result.state
    assert.deepEqual(actual.pieces,pieces,`${label}: complete physical records including capturedBy`)
    assert.deepEqual(actual.players,players,`${label}: all card zones`)
    assert.deepEqual(actual.effects,effects,`${label}: all continuing and temporary effects`)
    assert.deepEqual(actual.turn,turn,`${label}: turn and card allowances`)
    assert.deepEqual(actual.enPassant,ep,`${label}: en passant`)
    assert.equal(actual.orientation,orientation,label)
    assert.deepEqual(actual.underElfHill??[],hill??[],`${label}: King absence/return obligation`)
    assert.equal(actual.fen,`${boardFen()} ${fenColor==='white'?'w':'b'} ${rights||'-'} - ${half} ${full}`,`${label}: complete FEN and clocks`)
    assert.equal(checked(actor),n===64||n===86,`${label}: independent acting royal safety`)
    assert.equal(!!actual.pendingRescue,n===64||n===86,`${label}: rescue obligation`)
    assert.ok(!actual.pendingAbduction&&!actual.pendingDoomsayer,`${label}: no unrelated pending choice`)
    if(n===122){
      const royal=pieceAt('g8');assert.equal(royal.royal,true);assert.equal(royal.role,'knight')
      assert.equal(pieceAt('f6'),undefined);assert.ok(attacks(royal,'f6'))
      royal.square='f6';assert.equal(checked('black'),false,'Figure Dance permits a legal Knight escape, so is not direct mate');royal.square='g8'
    }
    assert.equal(actual.outcome,null,label)
  }
  assert.equal(trace.moves,50)
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,19)
  assert.equal(actual.fen,'1NQ2B1R/4n1P1/2r2n2/1Nq5/6PR/pRrB4/8/5K1p b - - 2 29')
})
