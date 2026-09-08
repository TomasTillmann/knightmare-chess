import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, PieceState, SquareName, GameState, CardInstance } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Each numbered statement records a human review of that exact action, including
// temporary self-check and the failed saving card; generated hashes are secondary.
const rationales = `
1. Ng1-h3 is an empty-destination knight jump.
2. White ends its quiet move; Black receives fresh card allowances.
3. a7-a6 is a clear one-square black pawn advance.
4. Black closes the pawn move; White starts.
5. Nh3-g1 returns to the vacant starting square.
6. White ends; the halfmove counter stays one.
7. c7-c6 is a clear forward pawn move.
8. Black ends without spending a card.
9. Ng1-h3 repeats a legal knight jump.
10. White closes the move with both kings safe.
11. Ng8-f6 jumps to an empty square.
12. Black ends and White starts move four.
13. f2-f3 advances the pawn without capture.
14. White ends without an optional discard.
15. h7-h6 advances one empty square.
16. Black ends; pawn movement keeps the halfmove clock zero.
17. Nh3-g1 is another empty knight jump.
18. White ends and refreshes allowances.
19. Black plays before-move Pacifism on its nonroyal c8 bishop; marker persists and replacement is Fog of War.
20. Nf6-g4 is a legal knight jump; Pacifism does not constrain this knight.
21. Black ends after one card and one regular move.
22. Ke1-f2 is adjacent but attacked by Ng4; §11.6 stages it with a complete rescue checkpoint and revokes White castling.
23. White Holy Quest swaps enemy Bf8/Ng4; Ng4 becomes Nf8 and Bg4 has no diagonal to f2, curing check.
24. White can now close its rescued move.
25. Black Madman jumps d7-b5 over the occupied c6 pawn without capture, replacing its move.
26. Black ends the Madman replacement move.
27. h2-h3 is a clear pawn step.
28. White ends with its king safe on f2.
29. Ra8-a7 is clear and permanently consumes Black queenside castling rights.
30. Black ends; the Madman pawn remains on b5.
31. a2-a4 traverses vacant a3; track a3 EP internally, but b5 cannot capture it en passant.
32. White ends; the uncapturable internal a3 opportunity persists for Black.
33. f7-f6 advances and expires the old a3 opportunity.
34. Black closes the move.
35. Kf2-e1 returns adjacent to safety without restoring castling.
36. White Anathema swaps enemy Bg4/Rh8, preserving physical identity; unmoved h-rook right is serialized h while a bishop occupies h8.
37. White ends after the swap.
38. h6-h5 is a clear pawn step.
39. Black ends and White may play a before-move card.
40. Onslaught advances b2,c2,d2,f3,g2,h3 each one vacant forward square simultaneously, replacing the move without EP.
41. White ends the six-pawn replacement move.
42. Qd8xd3 follows clear d7,d6,d5,d4 and captures the white d-pawn, attributed to Black.
43. Black ends with the queen on d3.
44. a4xb5 captures the original black d7 pawn diagonally, attributed to White.
45. White ends; the captured pawn stays captured.
46. Nf8-g6 is an ordinary empty knight jump.
47. Black closes its move.
48. Bc1-d2 is a one-square diagonal to a vacant square.
49. White ends; neither king is checked.
50. Qd3xe2 captures the white e-pawn and checks Ke1 directly along the file.
51. Black ends a legal checking move; White must answer.
52. Bf1xe2 captures the checking queen diagonally and restores White safety.
53. White ends its check escape.
54. Ra7-a8 returns along one empty square; lost queenside castling stays lost.
55. Black ends after the quiet rook move.
56. Ke1-f2 is adjacent and safe now that Ng4 is absent.
57. White ends the king move.
58. Ng6-f8 is an empty knight jump.
59. Black ends and White starts move fifteen.
60. Kf2-g2 is adjacent; the white pawn on g3 shields it from Rg4.
61. White ends with no card spent.
62. Rg4-g5 is clear; the physical h8 rook finally moves and loses its remaining right.
63. Black ends with all castling rights absent.
64. Confabulation legally moves Qd1 onto friendly Be2, merging without capture; queen component is away, continuing card remains active.
65. Black immediately counters with Fog: restores Qd1/Be2, pre-card clocks and Regular Move, discards both cards and locks White card play.
66. Ra1-a2 is a legal replacement move while both card allowances are spent.
67. White ends; Fog restriction expires with the turn.
68. Rg5-c5 crosses clear f5,e5,d5 without capture.
69. Black ends after the rook slide.
70. Kg2-f2 is an adjacent safe move.
71. White closes the king move.
72. Ra8-a7 is clear without restoring castling.
73. Black ends the rook move.
74. Ra2-a5 crosses empty a3,a4; the a6 pawn limits its forward ray.
75. White ends the quiet rook slide.
76. f6-f5 advances a black pawn one square.
77. Black plays Vendetta after its move; subsequent Regular Moves must capture whenever legally possible.
78. Black ends; White has the legal Ra5xa6 capture so Vendetta remains active.
79. Ra5xa6 takes the black a-pawn and satisfies Vendetta.
80. White ends; Black has legal Rc5xc3, preserving Vendetta.
81. Rc5xc3 crosses vacant c4 and captures the white c-pawn, satisfying Vendetta.
82. Black ends; White has legal Be2xh5, preserving Vendetta.
83. Be2xh5 crosses empty f3,g4, captures the h-pawn and checks Ke8 along h5-g6-f7-e8.
84. Siege swaps friendly Nb1/Ra6 without capture; Bh5 still checks Ke8.
85. White ends; Black has no capture curing Bh5 check, so Vendetta expires to Black discard.
86. Pacifist Bc8-d7 is geometrically legal but does not answer Bh5 check; Black stages an after-move rescue.
87. Black Holy Quest on Bd2/Ng1 cannot cure Bh5 check; §11.6 spends the failed card and rewinds Bc8-d7, restoring a Regular Move.
88. Nf8-g6 interposes on Bh5-g6-f7-e8 and cures Black check.
89. Black ends its replacement escape with Holy Quest still spent.
90. Rb1-b2 is a vacant one-square rook move.
91. White ends with the Siege identities preserved.
92. b7xa6 captures White original b1 knight diagonally, attributed to Black.
93. Black ends the capture.
94. Bh5-g4 retreats one clear diagonal square.
95. White Curse marks the opposing c8 bishop; it remains Pacifist and is additionally limited to two squares.
96. White ends; both continuing markers persist on c8 identity.
97. Ke8-f7 is an adjacent empty-square king move; no opposing piece has a capturing ray to f7.
98. Black ends the king move.
99. Qd1-e2 moves diagonally onto its now-vacant former merge square.
100. White ends the queen move.
101. Kf7-f8 is adjacent and safe.
102. Black ends with both kings on board.
103. Kf2-g2 is an empty adjacent move.
104. White Rebirth relocates enemy e7 pawn to empty d7, a valid black pawn starting square; no capture or move-clock advance.
105. White ends after Rebirth.
106. d7-d5 traverses empty d6; §13.1 permits this relocated pawn double step, with internal d6 EP but no adjacent White captor.
107. Black ends; the internal d6 opportunity remains while raw FEN omits uncapturable EP.
108. Rh1-h3 crosses empty h2 and expires d6 EP.
109. White ends the rook move.
110. a6-a5 advances the original black b7 pawn into an empty square.
111. Black ends after its pawn move.
112. White Fanatic sends h4-h7 through empty h5,h6,h7, replacing its move, without capture, EP, or promotion.
113. White ends its Fanatic replacement move.
114. Ng6-h4 is an empty knight jump checking White Kg2; the f5 pawn continues blocking Bg4's diagonal toward e6.
115. Black ends the fiftieth regular move; White receives the turn in knight check with no pending choices.
`.trim().split('\n')

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square)
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x,y] = xy(piece.square!), [u,v] = xy(to), dx = u-x, dy = v-y, a = Math.abs(dx), b = Math.abs(dy)
  if (!a && !b) return false
  if (piece.role === 'knight') return a*b === 2
  if (piece.role === 'king') return Math.max(a,b) === 1
  if (piece.role === 'pawn') {
    const d = piece.owner === 'white' ? 1 : -1
    return capture ? a === 1 && dy === d : dx === 0 && (dy === d || dy === 2*d && (piece.owner === 'white' ? y <= 1 : y >= 6) && !at(pieces, `${piece.square![0]}${y+d+1}`))
  }
  if (!(piece.role === 'bishop' ? a === b : piece.role === 'rook' ? dx === 0 || dy === 0 : a === b || dx === 0 || dy === 0)) return false
  for (let k=1; k<Math.max(a,b); k++) if (at(pieces, `${String.fromCharCode(97+x+k*Math.sign(dx))}${y+k*Math.sign(dy)+1}`)) return false
  return true
}
function checked(pieces: PieceState[], color: Color, step: number): boolean {
  const king = pieces.find(p => p.royal && p.owner === color)!
  return pieces.some(p => p.zone === 'board' && p.owner !== color
    && !(step >= 19 && p.id === 'black-bishop-c8') && geometry(pieces,p,king.square!,true))
}
function captures(pieces: PieceState[], color: Color, step: number) {
  return pieces.flatMap(p => pieces.filter(v => p.zone === 'board' && p.owner === color && v.zone === 'board'
    && v.owner !== color && !v.royal && p.id !== 'black-bishop-c8' && v.id !== 'black-bishop-c8'
    && geometry(pieces,p,v.square!,true)).filter(v => {
      const copy = structuredClone(pieces), mover = copy.find(q=>q.id===p.id)!, victim=copy.find(q=>q.id===v.id)!
      mover.square=victim.square; victim.square=null; victim.zone='captured'
      return !checked(copy,color,step)
    }).map(v=>`${p.square}-${v.square}`))
}
function boardFen(pieces: PieceState[]) {
  return Array.from({length:8},(_,rank)=> {
    let result='', empty=0
    for (const file of 'abcdefgh') {
      const p=at(pieces,`${file}${8-rank}`)
      if (!p) { empty++; continue }
      if(empty) { result+=empty; empty=0 }
      const letter=({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'} as const)[p.role]
      result+=p.owner==='white'?letter.toUpperCase():letter
    }
    return result+(empty||'')
  }).join('/')
}

test('iteration 144 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/144.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed,860144)
  assert.equal(rationales.length,115)
  assert.equal(trace.steps.length,rationales.length)
  let state=createGameState(trace.initial)
  // Starting identities are assembled from standard chess, independently of state output.
  let pieces: PieceState[]=[]
  for(const owner of ['white','black'] as const) for(const [i,file] of [...'abcdefgh'].entries()) {
    for(const [role,rank] of [[(['rook','knight','bishop','queen','king','bishop','knight','rook'] as const)[i]!,owner==='white'?1:8],['pawn',owner==='white'?2:7]] as const) {
      const square=`${file}${rank}` as SquareName
      pieces.push({id:`${owner}-${role}-${square}`,owner,role,originalRole:role,square,zone:'board',promoted:false,royal:role==='king',neutral:false})
    }
  }
  const players=Object.fromEntries((['white','black'] as const).map(color=>[color,{
    hand: trace.initial.hands![color]!.map((cardId,i)=>({id:`${color}-hand-${i}-${cardId}`,cardId})),
    deck: trace.initial.decks![color]!.map((cardId,i)=>({id:`${color}-deck-${i}-${cardId}`,cardId})),discard:[] as CardInstance[],
  }])) as GameState['players']
  let actor:Color='white', made=false, plays={white:0,black:0}, half=0, full=1, active='w'
  let ep:GameState['enPassant']=[], effects:unknown[]=[]
  let saved: {pieces:PieceState[]; half:number; full:number; active:string}|undefined
  const sort=(ps:PieceState[])=>ps.map(({capturedAtPly:_,...p})=>p).sort((a,b)=>a.id.localeCompare(b.id))
  const relocate=(from:string,to:string)=>{ const p=at(pieces,from)!; assert.ok(p,from); assert.match(to,/^[a-h][1-8]$/); p.square=to as SquareName }
  const swap=(from:string,to:string)=>{const p=at(pieces,from)!,q=at(pieces,to)!; assert.ok(p&&q); [p.square,q.square]=[q.square,p.square]}
  for(const [index,{action}] of trace.steps.entries()) {
    const n=index+1, before=state
    const input=structuredClone(before)
    assert.ok(rationales[index]!.startsWith(`${n}. `))
    const beforePieces=structuredClone(pieces)
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from=action.from,to=action.to,p=at(pieces,from)!,v=at(pieces,to)
      assert.ok(p && p.owner===actor)
      assert.ok(!v || v.owner!==actor && !v.royal && v.id!=='black-bishop-c8')
      assert.ok(geometry(pieces,p,to,!!v),`${n}: independent move geometry`)
      if(n===86) assert.ok(p.role==='bishop' && Math.max(...xy(to).map((q,i)=>Math.abs(q-xy(from)[i]!)))===1)
      if(n>=79&&n<=83) assert.ok(v,`${n}: Vendetta requires capture`)
      if(n===86) saved={pieces:structuredClone(pieces),half,full,active}
      ep=[]
      if(p.role==='pawn'&&Math.abs(Number(to[1])-Number(from[1]))===2) ep=[{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName,pawnId:p.id}]
      if(v) {v.square=null;v.zone='captured';v.capturedBy=actor}
      half=p.role==='pawn'||v?0:half+1
      relocate(from,to); full+=actor==='black'?1:0; active=actor==='white'?'b':'w'; made=true
    } else if(action.type==='endTurn') {
      assert.ok(made)
      assert.equal(checked(pieces,actor,n),false,`${n}: endTurn royal safety`)
      actor=opposite(actor);made=false;plays={white:0,black:0}
      if(n===78||n===80||n===82) assert.ok(captures(pieces,actor,n).length>0)
      if(n===85) {
        assert.deepEqual(captures(pieces,actor,n),[],'Vendetta expires because no legal capture answers check')
        effects=effects.filter(e=>(e as {type:string}).type!=='vendetta')
        players.black.discard.push({id:'black-hand-2-vendetta',cardId:'vendetta'})
      }
    } else {
      assert.equal(action.type,'playCard');if(action.type!=='playCard') throw Error('Unexpected action')
      const owner:Color=n===65?'black':actor
      const player:GameState['players'][Color]=players[owner]
      const card:CardInstance=player.hand.find(c=>c.id===action.cardInstanceId)!
      assert.ok(card&&card.cardId===action.cardId);assert.equal(plays[owner],0)
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(n===65?'afterOpponentCard':made?'afterMove':'beforeMove'))
      player.hand.splice(player.hand.indexOf(card),1);player.hand.push(player.deck.shift()!);plays[owner]++
      if(!CARD_CATALOG[card.cardId]!.continuing) player.discard.push(card)
      switch(n) {
        case 19: effects.push({type:'pacifism',owner,card,pieceId:'black-bishop-c8'});break
        case 23: assert.deepEqual(action.target,{bishop:'f8',knight:'g4'});swap('f8','g4');break
        case 25: assert.deepEqual(action.target,[{from:'d7',to:'b5'}]);assert.ok(at(pieces,'c6'));assert.ok(!at(pieces,'b5'));relocate('d7','b5');half=0;full++;active='w';made=true;ep=[];break
        case 36: assert.deepEqual(action.target,{bishop:'g4',rook:'h8'});swap('g4','h8');break
        case 40: {
          const moves=[['b2','b3'],['c2','c3'],['d2','d3'],['f3','f4'],['g2','g3'],['h3','h4']]
          assert.deepEqual(action.target,moves.map(([from,to])=>({from,to})))
          for(const [from,to] of moves) {assert.equal(at(pieces,from!)!.role,'pawn');assert.ok(!at(pieces,to!));relocate(from!,to!)}
          half=0;active='b';made=true;ep=[];break
        }
        case 64: {
          assert.deepEqual(action.target,[{from:'d1',to:'e2'}]);saved={pieces:structuredClone(pieces),half,full,active}
          const q=at(pieces,'d1')!;assert.ok(geometry(pieces,q,'e2',false));q.square=null;q.zone='away'
          effects.push({type:'confabulation',owner,card,pieceIds:['white-bishop-f1','white-queen-d1']});half++;active='b';made=true;break
        }
        case 65: {
          assert.equal(action.target,undefined);assert.ok(saved)
          pieces=structuredClone(saved.pieces);half=saved.half;full=saved.full;active=saved.active;made=false
          effects=effects.filter(e=>(e as {type:string}).type!=='confabulation')
          players.white.discard.push({id:'white-deck-0-confabulation',cardId:'confabulation'});break
        }
        case 77: effects.push({type:'vendetta',owner,card});break
        case 84: assert.deepEqual(action.target,{knight:'b1',rook:'a6'});swap('b1','a6');break
        case 87: {
          assert.deepEqual(action.target,{bishop:'d2',knight:'g1'});assert.ok(saved)
          swap('d2','g1');assert.equal(checked(pieces,'black',n),true,'selected rescue fails to answer Bh5')
          pieces=structuredClone(saved.pieces);half=saved.half;full=saved.full;active=saved.active;made=false;break
        }
        case 95: effects.push({type:'curse',owner,card,pieceId:'black-bishop-c8'});break
        case 104: assert.deepEqual(action.target,[{from:'e7',to:'d7'}]);assert.ok(!at(pieces,'d7'));assert.equal(at(pieces,'e7')!.role,'pawn');relocate('e7','d7');break
        case 112: assert.equal(action.target,'h4');for(const sq of ['h5','h6','h7']) assert.ok(!at(pieces,sq));relocate('h4','h7');half=0;active='b';made=true;ep=[];break
        default: throw Error(`Unreviewed card ${n}`)
      }
    }
    const result=applyAction(before,action);assert.ok(result.ok,`${n}: ${rationales[index]}`);state=result.state
    assert.deepEqual(before,input,`${n}: action input remains immutable`)
    assert.deepEqual(sort(state.pieces),sort(pieces),`${n}: physical identities and capture actors`)
    assert.deepEqual(state.players,players,`${n}: exact card zones and draws`)
    assert.deepEqual(state.effects,effects,`${n}: complete effects`)
    assert.deepEqual(state.turn,{color:actor,phase:made?'afterMove':'beforeMove',moveMade:made,cardPlays:plays})
    const rights=n<22?'KQkq':n<29?'kq':n<36?'k':n<62?'h':'-'
    assert.equal(state.fen,`${boardFen(pieces)} ${active} ${rights} - ${half} ${full}`,`${n}: all six FEN fields`)
    assert.deepEqual(state.enPassant,ep)
    for(const opportunity of ep) {
      const victim=pieces.find(p=>p.id===opportunity.pawnId)!
      assert.equal(pieces.some(p=>p.zone==='board'&&p.role==='pawn'&&p.owner!==victim.owner&&geometry(pieces,p,opportunity.target,true)),false,'internal EP has no available captor; FEN target omitted')
    }
    for(const color of ['white','black'] as const) {
      const expected=color==='white'?[22,50,51,114,115].includes(n):n>=83&&n<=87
      assert.equal(checked(pieces,color,n),expected,`${n}: independently derived ${color} threat`)
      assert.equal(isKingInCheck(state,color),expected,`${n}: engine ${color} threat`)
    }
    if(n===22||n===86) {
      assert.ok(state.pendingRescue)
      assert.deepEqual(sort(state.pendingRescue.pieces),sort(beforePieces))
      assert.deepEqual(state.pendingRescue,{before,fen:before.fen,pieces:before.pieces,enPassant:before.enPassant,historyLength:before.history.length,movedPieceIds:[n===22?'white-king-e1':'black-bishop-c8']})
      assert.ok(players[actor].hand.some(card=>card.cardId==='holy-quest'))
      assert.equal(plays[actor],0,'held Holy Quest retains its after-move allowance')
      const rescue=structuredClone(pieces)
      const bishop=at(rescue,n===22?'f8':'h5')!,knight=at(rescue,n===22?'g4':'g1')!
      assert.equal(bishop.owner,opposite(actor));assert.equal(bishop.role,'bishop')
      assert.equal(knight.owner,opposite(actor));assert.equal(knight.role,'knight')
      ;[bishop.square,knight.square]=[knight.square,bishop.square]
      assert.equal(checked(rescue,actor,n),false,'held Holy Quest has an independent legal saving swap')
      assert.equal(checked(rescue,opposite(actor),n),false,'saving swap does not give direct mate')
      assert.equal(applyAction(state,{type:'endTurn'}).ok,false,'pending rescue cannot close the turn')
    } else assert.equal(state.pendingRescue??null,null)
    assert.equal(state.chaosForbidden,undefined)
    assert.equal(state.plotsExecution,undefined)
    assert.deepEqual(state.plotsAllowances??[],[])
    assert.deepEqual(state.fogLocked??[],n===65||n===66?['white']:[])
    assert.deepEqual(state.riposteLostMoves??[],[])
    assert.equal(state.riposteSkipped,undefined);assert.equal(state.riposteCheckDeferred,undefined)
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null)
    assert.deepEqual(state.underElfHill??[],[]);assert.equal(state.orientation,0);assert.equal(state.outcome,null)
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50)
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,13)
  assert.equal(state.fen,'1nb2k1b/r5pP/2p5/pP1p1p2/5PBn/1Pr3PR/1R1BQ1K1/6N1 w - - 1 27')
  assert.equal(replayTrace(trace).fen,state.fen)
})
