import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { createGameState } from '../state.js'
import { applyAction, isKingInCheck, legalDests, underElfHillReturnSquares } from '../reducer.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'

// Rules §§8–15, 17.1, 18.2, 22.4; cards.md and artwork KC1/4, KC3/2,4,
// KC7/4, KC8/1, KC9/4, KC10/2, KC5/3, KC19/1, KC15/3 reviewed directly.
const rationale = [
  '1. f2-f3 advances White Pawn one empty square; resets halfmove clock.',
  '2. End White turn after f3; board and all clocks stay fixed.',
  '3. a7-a6 advances Black Pawn one empty square; fullmove becomes 2.',
  '4. End Black turn; White receives unused allowances.',
  '5. a2-a4 crosses empty a3; physical EP a3 exists, no Black captor.',
  '6. End White turn retains the uncapturable a3 opportunity.',
  '7. Nb8-c6 is a 1-by-2 jump; expires a3 EP.',
  '8. End Black turn after Nc6; no card draw.',
  '9. a4-a5 is one empty forward step.',
  '10. End White turn after a5; a6 Black Pawn is not captured.',
  '11. e7-e5 crosses empty e6; physical EP e6, no White captor.',
  '12. End Black turn retains e6 EP but FEN has dash.',
  '13. g2-g3 is one forward step; expires e6 EP.',
  '14. End White turn after g3 with both card allowances fresh.',
  '15. Ng8-e7 is a 2-by-1 jump onto a vacated square.',
  '16. End Black turn after Ne7; no spending.',
  '17. e2-e4 crosses empty e3; physical EP e3, no Black captor.',
  '18. End White turn retains uncapturable e3 EP.',
  '19. Ne7-f5 is a 1-by-2 jump; expires e3 EP.',
  '20. End Black turn after Nf5; clocks unchanged.',
  '21. Bf1-d3 slides diagonally through vacated e2.',
  '22. End White turn after Bd3.',
  '23. Qd8-e7 moves one diagonal square.',
  '24. End Black turn after Qe7.',
  '25. Bd3-c4 moves one diagonal square.',
  '26. End White turn after Bc4.',
  '27. Rh8-g8 moves horizontally; permanently removes Black kingside castling.',
  '28. End Black turn after Rg8.',
  '29. d2-d3 advances into the square vacated by the Bishop.',
  '30. End White turn after d3.',
  '31. Squaring the Circle: a1,a8,h1 occupied, h8 alone empty; Rg8-h8 replaces Black move, no restored castling; discard/draw once.',
  '32. End replacement turn; fullmove already 9.',
  '33. Ra1-a3 slides through empty a2; removes White queenside castling provisionally.',
  '34. Immediate opposing Chaos restores Ra1, Q right, White move, halfmove 1/fullmove 9; Black spends/draws once and a1-a3 is forbidden.',
  '35. Bc1-h6 slides through empty d2,e3,f4,g5; different replacement clears Chaos prohibition.',
  '36. End White replacement turn resets Black reaction allowance.',
  '37. Qe7-e6 moves vertically one empty square.',
  '38. End Black turn after Qe6.',
  '39. Madman jumps h2-f4-d6-b8 over g3,e5,c7; all landings empty; crossed pieces survive, b8 Pawn never promotes; replaces move.',
  '40. End White Madman turn; no further move or draw.',
  '41. Fanatic b7-b4 crosses empty b6,b5,b4; no capture or EP; replaces Black move and draws once.',
  '42. End Black Fanatic turn.',
  '43. Rh1-h2 enters Pawn-vacated square; White kingside castling expires.',
  '44. End White turn after Rh2.',
  '45. Nf5-d6 is a 2-by-1 jump.',
  '46. End Black turn after Nd6.',
  '47. Rh2-h1 returns without restoring castling.',
  '48. End White turn after Rh1.',
  '49. f7-f6 advances one empty square.',
  '50. End Black turn after f6.',
  '51. Confabulation f3-e4 uses Pawn capture geometry onto owned nonroyal Pawn; e2 component leads, f2 component becomes attached/away, neither captured; continuing card retained, replacement drawn.',
  '52. End White merge turn; combined Pawn has ordinary Pawn powers.',
  '53. Nd6xc4 jumps onto White f1 Bishop; physical victim capturedBy Black.',
  '54. End Black capture turn closes immediate Legacy window.',
  '55. Ghostwalk Qd1-g4 uses diagonal e2,f3, both empty; no capture; replaces move and draws once.',
  '56. End White Ghostwalk turn.',
  '57. Qe6-f5 moves one diagonal square.',
  '58. End Black turn after Qf5.',
  '59. Qg4-f4 moves one horizontal square.',
  '60. End White turn after Qf4.',
  '61. Rh8-g8 moves horizontally; no castling restoration.',
  '62. End Black turn after Rg8.',
  '63. Qf4-f2 passes through f3 vacated by merger.',
  '64. End White turn after Qf2.',
  '65. Qf5-e6 moves one diagonal square.',
  '66. After-move Challenge selects White b2 Pawn, which can legally move b3; preserves position/clocks and obligates that physical Pawn; discard/draw once.',
  '67. End Black turn retains White upcoming Challenge obligation.',
  '68. b2-b3 advances one empty square and satisfies/removes Challenge.',
  '69. End White turn after required b3.',
  '70. g7xh6 captures White c1 Bishop diagonally; capturedBy Black.',
  '71. After-move Figure Dance simultaneously rotates a1-h1,h1-h8,a8-a1; g8 Rook stays; no Pawn corner promotion or capture; all castling gone, clocks unchanged.',
  '72. End Black turn after Figure Dance.',
  '73. Ng1-f3 is a 1-by-2 jump; a1 Rook ray still has b1 Knight.',
  '74. End White turn after Nf3.',
  '75. Nc6-e7 is a 2-by-1 jump.',
  '76. End Black turn after Ne7.',
  '77. Original a1 Rook now h1-h2 moves vertically one square.',
  '78. End White turn after Rh2.',
  '79. Nc4-a3 is a 2-by-1 jump.',
  '80. End Black turn after Na3.',
  '81. Blessing moves combined Pawn e4-c6 as Bishop via empty d5; retains both components, no capture/promotion; pawn clock resets and replacement drawn.',
  '82. End White Blessing turn.',
  '83. h6-h5 advances Black original g7 Pawn one square.',
  '84. End Black turn after h5.',
  '85. Ke1-f1 moves one safe horizontal square; a1 Rook remains blocked by b1 Knight.',
  '86. End White turn after Kf1.',
  '87. Qe6-d6 moves one horizontal square.',
  '88. End Black turn after Qd6.',
  '89. Rh2xh5 passes empty h3,h4; original g7 Pawn capturedBy White.',
  '90. End White capture turn.',
  '91. Rg8-g4 passes empty g7,g6,g5; f8 Bishop still separates Rh8 from Ke8.',
  '92. End Black turn after Rg4.',
  '93. Nf3-h2 is a 2-by-1 jump.',
  '94. End White turn after Nh2.',
  '95. Ne7-g8 is a 2-by-1 jump.',
  '96. End Black turn after Ng8.',
  '97. Kf1-e2 is one safe diagonal step.',
  '98. End White turn after Ke2.',
  '99. Rg4-c4 passes empty f4,e4,d4.',
  '100. End Black turn after Rc4.',
  '101. Qf2-g1 moves one diagonal square.',
  '102. End White turn after Qg1.',
  '103. Ra1xb1 captures original b1 Knight; capturedBy Black, halfmove resets.',
  '104. End Black capture turn closes immediate Legacy response.',
  '105. Qg1-d1 passes empty f1,e1.',
  '106. End White turn after Qd1.',
  '107. Ng8-h6 is a 1-by-2 jump.',
  '108. End Black turn after Nh6.',
  '109. d3-d4 advances White Pawn one empty square.',
  '110. End White turn after d4.',
  '111. d7xc6 captures both e2/f2 merged components; both capturedBy Black, Confabulation expires to White discard without another draw.',
  '112. End Black capture turn.',
  '113. Under Elf Hill removes White royal e2 to away, neither captured nor dead; replaces White move, consumes/draws once, clocks 1/28.',
  '114. End White turn; King remains away through Black turn.',
  '115. Ke8-d7 is one safe diagonal step; c6 white Pawn pair was captured, no remaining Pawn threat.',
  '116. End Black turn opens mandatory White royal return before optional actions; clocks 2/29.',
  '117. Return same White King to vacant safe edge f1; Qd1 blocks Rb1 ray, no clock/draw/allowance use; returned King cannot move or threaten this turn.',
]

test('iteration 137 deterministic campaign replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/137.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})

test('iteration 137 independent physical, geometry, safety, cards and six-field FEN oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/137.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, 117)
  assert.equal(trace.steps.length, rationale.length)
  assert.equal(trace.steps.filter(({ action }) => action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(({ action }) => action.type === 'playCard').length, 10)
  let state = createGameState(trace.initial)
  let pieces = structuredClone(state.pieces)
  const players = structuredClone(state.players)
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
  let active = 'w', rights = 'KQkq', half = 0, full = 1
  let ep: GameState['enPassant'] = []
  let effects: unknown[] = []
  let hill: GameState['underElfHill']
  let checkpoint: { pieces: PieceState[]; rights: string; half: number; full: number } | undefined
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square)
  const byId = (id: string) => { const p = pieces.find(p => p.id === id); assert.ok(p); return p }
  const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
  const square = (x: number, y: number): SquareName => {
    const s = String.fromCharCode(97 + x) + (y + 1)
    assert.match(s, /^[a-h][1-8]$/)
    return s as SquareName
  }
  const path = (from: string, to: string) => {
    const [x,y] = xy(from), [tx,ty] = xy(to), dx = tx-x, dy = ty-y
    assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
    return Array.from({ length: Math.max(Math.abs(dx), Math.abs(dy))-1 }, (_, i) => square(x+Math.sign(dx)*(i+1), y+Math.sign(dy)*(i+1)))
  }
  const reaches = (p: PieceState, to: string, capture: boolean) => {
    assert.ok(p.square)
    const [x,y] = xy(p.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y
    if (!dx && !dy) return false
    if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2
    if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1
    if (p.role === 'pawn') {
      const forward = p.owner === 'white' ? 1 : -1
      if (capture) return Math.abs(dx) === 1 && dy === forward
      return dx === 0 && (dy === forward || dy === 2*forward && y === (p.owner === 'white' ? 1 : 6) && !at(square(x,y+forward)))
    }
    const aligned = p.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
      : p.role === 'rook' ? dx === 0 || dy === 0 : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)
    return aligned && path(p.square,to).every(s => !at(s))
  }
  const attackers = (color: Color, destination?: string) => {
    const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board')
    const target = destination ?? king?.square
    if (!target) return []
    return pieces.filter(p => p.zone === 'board' && p.owner !== color
      && !(hill?.some(h => h.pieceId === p.id && h.returned))
      && !(effects.some(e => { const v = e as {type?: string; player?: Color; pieceId?: string}; return v.type === 'challenge' && v.player === p.owner && v.pieceId !== p.id }))
      && reaches(p,target,true)).map(p => p.id)
  }
  const boardFen = () => Array.from({length:8}, (_, row) => {
    let result = '', empty = 0
    for (let x=0;x<8;x++) {
      const p = at(square(x,7-row))
      if (!p) { empty++; continue }
      if (empty) { result += empty; empty = 0 }
      const token = ({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'} as const)[p.role]
      result += p.owner === 'white' ? token.toUpperCase() : token
    }
    return result + (empty || '')
  }).join('/')
  const removeRights = (p: PieceState, from: string) => {
    const lost = p.royal ? (p.owner === 'white' ? 'KQ' : 'kq')
      : p.role === 'rook' ? ({a1:'Q',h1:'K',a8:'q',h8:'k'} as Record<string,string>)[from] ?? '' : ''
    rights = [...rights].filter(c => !lost.includes(c)).join('')
  }
  const consumeMove = (pawn: boolean, capture = false) => {
    half = pawn || capture ? 0 : half + 1
    if (turn.color === 'black') full++
    active = turn.color === 'white' ? 'b' : 'w'
    turn.phase = 'afterMove'; turn.moveMade = true; ep = []
  }
  const reject = (action: Parameters<typeof applyAction>[1]) => {
    const before = structuredClone(state), result = applyAction(state,action)
    assert.equal(result.ok,false,JSON.stringify(action))
    assert.deepEqual(state,before)
    assert.deepEqual(result.state,before)
  }
  for (const [i, {action}] of trace.steps.entries()) {
    const n = i+1, label = rationale[i]!
    assert.ok(label.startsWith(`${n}. `))
    if (n === 33) checkpoint = { pieces: structuredClone(pieces), rights, half, full }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.from,/^[a-h][1-8]$/); assert.match(action.to,/^[a-h][1-8]$/)
      const p = at(action.from), victim = at(action.to)
      assert.ok(p,label); assert.equal(p.owner,turn.color,label)
      assert.equal(turn.moveMade,false,label)
      assert.ok(reaches(p,action.to,!!victim),label)
      assert.equal(action.promotion,undefined,label)
      if (n === 68) assert.equal(p.id,'white-pawn-b2')
      if (victim) {
        assert.notEqual(victim.owner,p.owner,label); assert.equal(victim.royal,false,label)
        removeRights(victim,action.to)
        victim.zone = 'captured'; victim.square = null; victim.capturedBy = turn.color
        if (n === 111) {
          const companion = byId('white-pawn-f2')
          companion.zone = 'captured'; companion.capturedBy = 'black'
          players.white.discard.push({id:'white-hand-4-confabulation',cardId:'confabulation'})
          effects = []
        }
      }
      removeRights(p,action.from)
      const double = p.role === 'pawn' && Math.abs(xy(action.to)[1]-xy(action.from)[1]) === 2
      p.square = action.to as SquareName
      consumeMove(p.role === 'pawn',!!victim)
      if (double) ep = [{target:square(xy(action.from)[0], (xy(action.from)[1]+xy(action.to)[1])/2),pawnId:p.id}]
      if (n === 68) effects = effects.filter(e => (e as {type?:string}).type !== 'challenge')
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade,true,label)
      turn = {color:turn.color === 'white' ? 'black' : 'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
      if (n === 116) hill = [{pieceId:'white-king-e1',player:'white',returning:true}]
    } else if (action.type === 'playCard') {
      const owner = (['white','black'] as const).find(c => players[c].hand.some(card => card.id === action.cardInstanceId))
      assert.ok(owner,label); assert.equal(turn.cardPlays[owner],0,label)
      const index = players[owner].hand.findIndex(c => c.id === action.cardInstanceId)
      const card = players[owner].hand.splice(index,1)[0]!
      assert.equal(card.cardId,action.cardId,label)
      const drawn = players[owner].deck.shift(); assert.ok(drawn); players[owner].hand.push(drawn)
      if (action.cardId !== 'confabulation') players[owner].discard.push(card)
      turn.cardPlays[owner]++
      if (n === 34) {
        assert.equal(owner,'black'); assert.equal(turn.color,'white'); assert.equal(turn.moveMade,true)
        assert.ok(checkpoint); pieces = structuredClone(checkpoint.pieces)
        rights = checkpoint.rights; half = checkpoint.half; full = checkpoint.full; active = 'w'
        turn.phase = 'beforeMove'; turn.moveMade = false
        assert.equal(action.target,undefined)
      } else if (n === 66) {
        assert.equal(action.target,'b2'); assert.equal(turn.phase,'afterMove')
        const pawn = at('b2'); assert.ok(pawn); assert.ok(reaches(pawn,'b3',false)); assert.equal(at('b3'),undefined)
        effects.push({type:'challenge',owner:'black',player:'white',pieceId:'white-pawn-b2'})
      } else if (n === 71) {
        assert.equal(turn.phase,'afterMove'); assert.deepEqual(action.target,[])
        const rotations = [['a1','h1'],['h1','h8'],['a8','a1']] as const
        const sources = rotations.map(([from,to]) => {const p = at(from); assert.ok(p); return {p,from,to}})
        assert.equal(at('h8'),undefined)
        for (const {p,from,to} of sources) { removeRights(p,from); p.square=to }
      } else {
        assert.equal(owner,turn.color); assert.equal(turn.phase,'beforeMove'); assert.equal(turn.moveMade,false)
        if (n === 113) {
          assert.equal(action.target,undefined)
          const king = byId('white-king-e1'); assert.equal(king.square,'e2')
          king.zone='away'; king.square=null
          hill=[{pieceId:king.id,player:'white',returning:false}]
          consumeMove(false)
        } else {
          const movements: Record<number, readonly [SquareName,SquareName]> = {31:['g8','h8'],39:['h2','b8'],41:['b7','b4'],51:['f3','e4'],55:['d1','g4'],81:['e4','c6']}
          const [from,to] = movements[n]!
          const p=at(from); assert.ok(p); assert.equal(p.owner,owner)
          if (n===31) {
            assert.deepEqual(['a1','h1','a8','h8'].filter(s=>at(s)),['a1','h1','a8'])
          } else if (n===39) {
            assert.deepEqual(action.target,[{from:'h2',to:'f4'},{from:'f4',to:'d6'},{from:'d6',to:'b8'}])
            for (const s of ['g3','e5','c7']) assert.ok(at(s))
            for (const s of ['f4','d6','b8']) assert.equal(at(s),undefined)
          } else if (n===41) {
            assert.equal(action.target,'b7'); for (const s of ['b6','b5','b4']) assert.equal(at(s),undefined)
          } else if (n===51) {
            assert.ok(reaches(p,to,true)); assert.equal(at(to)?.owner,'white')
            effects=[{type:'confabulation',owner:'white',card,pieceIds:['white-pawn-e2','white-pawn-f2']}]
          } else {
            assert.deepEqual(action.target,[{from,to}])
            const [x,y]=xy(from),[tx,ty]=xy(to); assert.equal(Math.abs(tx-x),Math.abs(ty-y))
            assert.ok(path(from,to).every(s=>!at(s))); assert.equal(at(to),undefined)
          }
          removeRights(p,from)
          if(n===51) {p.square=null;p.zone='away'} else p.square=to
          consumeMove(p.role==='pawn')
        }
      }
    } else if (action.type === 'returnKing') {
      assert.equal(n,117); assert.equal(action.to,'f1')
      const safeEdges: string[]=[]
      for(let y=0;y<8;y++) for(let x=0;x<8;x++) if(x===0||x===7||y===0||y===7) {
        const s=square(x,y)
        if(!at(s)&&attackers('white',s).length===0) safeEdges.push(s)
      }
      assert.deepEqual([...underElfHillReturnSquares(state)].sort(),safeEdges.sort(),'exact mandatory return choices')
      reject({type:'move',from:'d4',to:'d5'})
      reject({type:'playCard',cardId:'doomsayer'})
      reject({type:'endTurn'})
      const king=byId('white-king-e1'); king.square='f1';king.zone='board'
      hill=[{pieceId:king.id,player:'white',returning:true,returned:true}]
    } else assert.fail(`unreviewed action ${label}`)

    const original=structuredClone(state), result=applyAction(state,action)
    assert.deepEqual(state,original,`${label}: complete input immutability`)
    assert.ok(result.ok,label); state=result.state
    assert.deepEqual(state.pieces,pieces,`${label}: all physical identities, roles, zones and capturedBy`)
    assert.deepEqual(state.players,players,`${label}: every card ID and zone`)
    assert.deepEqual(state.turn,turn,`${label}: exact phase, owner, move and card allowances`)
    assert.deepEqual(state.effects,effects,`${label}: complete effects`)
    assert.deepEqual(state.underElfHill,hill,`${label}: exact return obligation`)
    assert.deepEqual(state.enPassant,ep,`${label}: physical EP opportunity`)
    assert.equal(state.fen,`${boardFen()} ${active} ${rights||'-'} - ${half} ${full}`,`${label}: all six FEN fields`)
    // All three double steps have no adjacent opposing Pawn; no raw FEN target
    // is retained across cards in this trace. Test capture availability separately.
    for(const opportunity of ep) {
      const victim=byId(opportunity.pawnId)
      assert.equal(pieces.filter(p=>p.zone==='board'&&p.owner!==victim.owner&&p.role==='pawn'&&reaches(p,opportunity.target,true)).length,0,label)
    }
    assert.equal(state.orientation,0,label)
    for (const color of ['white','black'] as const) {
      assert.deepEqual(attackers(color),[],`${label}: independently safe ${color} royal`)
      assert.equal(isKingInCheck(state,color),false,`${label}: public threat state`)
    }
    assert.ok(pieces.every(p=>!p.neutral&&p.role===p.originalRole&&!p.promoted),label)
    assert.ok(!state.pendingRescue&&!state.pendingAbduction&&!state.pendingDoomsayer,label)
    assert.equal(state.outcome,null,label)
    assert.equal(state.plotsAllowances?.length??0,0,label)
    assert.equal(state.plotsExecution,undefined,label)
    assert.equal(state.fogLocked,undefined,label)
    assert.equal(state.riposteLostMoves?.length??0,0,label)
    assert.equal(state.riposteSkipped,undefined,label)
    assert.equal(state.riposteCheckDeferred,undefined,label)
    if(n===34) {
      assert.deepEqual(state.chaosForbidden,{player:'white',movement:'white-rook-a1:a1:a3'},label)
      reject({type:'move',from:'a1',to:'a3'})
      assert.ok(!legalDests(state).get('a1')?.includes('a3'))
    } else assert.equal(state.chaosForbidden,undefined,label)
    if(n===67) reject({type:'move',from:'h1',to:'h2'})
    if(n===117) {
      assert.equal(legalDests(state).has('f1'),false)
      reject({type:'move',from:'f1',to:'e1'})
    }
  }
  assert.equal(state.fen,'1Pb2b1R/2pk3p/p1pq1p1n/P3p2R/1prP4/nP4P1/2P4N/1r1Q1K2 w - - 2 29')
})
