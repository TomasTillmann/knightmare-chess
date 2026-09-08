import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/143.json', import.meta.url), 'utf8')) as RandomTrace

test('iteration 143 deterministic replay', () => {
  assert.ok(trace.steps.length > 0)
  replayTrace(trace)
})

// Reviewed against rules §§8–15,17.1,18.2,21 and the fourteen printed card
// artworks. Each numbered row has its own rationale; the model below reconstructs
// physical identities, captures, both royal threats, zones, clocks and obligations.
const rationales = [
  '1. g2-g4: initial Pawn double through empty g3; uncapturable g3 opportunity.',
  '2. Forbidden City: empty a5 marked after White move; retained card, draw Treason.',
  '3. White ends: safe King; Black allowance resets and g3 opportunity persists.',
  '4. Bombard: h8-h3 jumps exactly own h7 Pawn; empty h6/h5/h4/h3; replacement move.',
  '5. Black ends: safe King, Bombard spent; White starts.',
  '6. c2-c3: one empty forward square; expires g3 opportunity.',
  '7. Treason: opposing a8 Rook and g8 Knight exchange without capture; draw Fortification.',
  '8. White ends after swap; clocks unchanged.',
  '9. Ghostwalk: f7-f6 is an empty one-square Pawn move; consumes Black move.',
  '10. Black ends after Ghostwalk; White starts with both Kings safe.',
  '11. f1-h3: Bishop crosses empty g2 and captures black original h8 Rook for White.',
  '12. White ends after Bishop capture; no compulsory choice.',
  '13. g7-g5: initial double through g6; White g4 Pawn cannot capture en passant from rank four.',
  '14. Black ends retaining the uncapturable g6 opportunity.',
  '15. d1-c2: Queen moves one diagonal into vacated c2; expires g6 opportunity.',
  '16. White ends after quiet Queen move.',
  '17. c7-c6: empty forward Pawn step; Black completes its move.',
  '18. Knightmare: immediate White reaction restores c7 and both clocks; forbids black-pawn-c7:c7:c6.',
  '19. g8-h8: original a8 Rook makes a different quiet replacement; clears cancellation restriction.',
  '20. Black ends; White reaction allowance resets.',
  '21. h3-f1: Bishop reverses diagonal through empty g2.',
  '22. White ends with both Kings safe.',
  '23. e7-e5: initial double through e6; no opposing Pawn on d5/f5.',
  '24. Black ends preserving uncapturable e6 opportunity.',
  '25. b1-a3: Knight jumps to empty a3; expires e6.',
  '26. White ends after Knight development.',
  '27. d7-d5: initial double through d6; no eligible White en-passant Pawn.',
  '28. Black ends retaining d6 opportunity.',
  '29. Onslaught: b2-b3,d2-d3,e2-e3,h2-h3 are four distinct empty one-step Pawn moves; one replacement.',
  '30. White ends after Onslaught; d6 opportunity expired.',
  '31. a8-b6: original g8 Knight makes a legal jump.',
  '32. Black ends after quiet Knight move.',
  '33. f1-g2: Bishop moves one empty diagonal square.',
  '34. White ends after quiet Bishop move.',
  '35. c8-e6: Bishop crosses now-empty d7.',
  '36. Black ends after quiet Bishop move.',
  '37. g2-f3: Bishop moves one empty diagonal square.',
  '38. Curse: opposing f8 Bishop receives identity marker after move; retained card and draw Riposte.',
  '39. White ends; Curse persists.',
  '40. f8-h6: cursed Bishop moves exactly two squares through empty g7.',
  '41. Black ends after permissible cursed Bishop move.',
  '42. c2-b1: Queen moves one empty diagonal square.',
  '43. White ends after quiet Queen move.',
  '44. e8-d7: royal King moves one diagonal to a safe empty square.',
  '45. Black ends with King d7 safe.',
  '46. f3-e4: Bishop moves one empty diagonal square.',
  '47. White ends after quiet Bishop move.',
  '48. b8-a6: original b8 Knight jumps to empty a6.',
  '49. Curse: opposing h1 Rook receives second independent identity marker; draw Merciless.',
  '50. Black ends; both Curse cards remain beside board.',
  '51. d3-d4: Pawn advances one empty square.',
  '52. White ends after Pawn advance.',
  '53. d8-a8: Queen traverses empty c8 and b8.',
  '54. Black ends after quiet Queen slide.',
  '55. e4-f5: Bishop moves one empty diagonal square.',
  '56. White ends after quiet Bishop move.',
  '57. h8-c8: Rook crosses empty g8,f8,e8,d8; no capture.',
  '58. Merciless: same Rook immediately returns c8-h8 through clear rank; no second clock increment.',
  '59. Black ends after additional Rook move.',
  '60. h1-h2: cursed Rook moves one square; White kingside right expires.',
  '61. White ends after quiet Rook move.',
  '62. h8-d8: Rook slides over empty g8,f8,e8.',
  '63. Black ends after quiet Rook move.',
  '64. g1-e2: Knight jumps to empty e2.',
  '65. White ends after Knight development.',
  '66. b6-c8: original g8 Knight jumps to empty c8.',
  '67. Black ends after quiet Knight move.',
  '68. f5-g6: Bishop advances one empty diagonal square.',
  '69. White ends after quiet Bishop move.',
  '70. d8-g8: Rook crosses empty e8 and f8.',
  '71. Black ends after quiet Rook move.',
  '72. f2-f4: initial double through f3; Black e5 Pawn is one rank too far away for en passant.',
  '73. White ends retaining uncapturable f3 opportunity.',
  '74. c7-c5: initial double through c6; White d4 Pawn is one rank too far away for en passant.',
  '75. Black ends retaining uncapturable c6 opportunity.',
  '76. g6-e8: Bishop crosses empty f7 and directly checks royal d7.',
  '77. White ends; checked Black receives its escape turn under §11.5.',
  '78. a6-b4: Knight jump leaves Black in Bishop e8 check provisionally; available Heresy supplies same-turn rescue.',
  '79. Heresy: White c1-d1,e8-f8 first, then Black e6-d6,h6-g6; all four Bishops change square color into vacancies; d7 rescued.',
  '80. Black ends only after Heresy removed check; no rescue obligation remains.',
  '81. e1-d2: King makes safe one-square diagonal step; remaining White castling right expires.',
  '82. White ends with King d2 safe.',
  '83. g6-e8: cursed original f8 Bishop moves two squares through empty f7.',
  '84. Black ends after permissible cursed Bishop move.',
  '85. a3-b5: White Knight jumps to empty b5.',
  '86. White ends after quiet Knight move.',
  '87. a7-a6: Black Pawn steps forward; Forbidden City a5 is not entered.',
  '88. Black ends after Pawn advance.',
  '89. d4-e5: White Pawn captures original Black e7 Pawn diagonally; White is captor.',
  '90. Fortification: marks diagonal boundary a7-b8 after White move; no piece or clock change.',
  '91. White ends retaining wall and both Curse markers.',
  '92. Breakthrough: Black g5 Pawn captures White g4 Pawn straight forward as replacement move.',
  '93. Black ends after forward capture; no extra move.',
  '94. Evil Eye: White h3 Pawn threatens g4; captures Black g7 Pawn without moving attacker; replaces move.',
  '95. White ends after stationary capture.',
  '96. g8-g4: Black Rook crosses empty g7,g6,g5 into now-empty g4.',
  '97. Black ends after quiet Rook slide.',
  '98. h2-h1: cursed White Rook moves one empty square.',
  '99. White ends after quiet Rook move.',
  '100. d6-e5: Black Bishop captures White original d2 Pawn diagonally; Black is captor.',
  '101. Black ends after Bishop capture.',
  '102. h1-h2: cursed White Rook moves one empty square.',
  '103. Challenge: opposing movable c8 Knight is neither King nor Queen; Black must use that identity.',
  '104. White ends; Challenge remains due for Black.',
  '105. c8-a7: challenged Knight makes legal jump, may jump wall, and discharges obligation.',
  '106. Black ends after satisfying Challenge.',
  '107. c3-b4: White Pawn captures original Black b8 Knight diagonally.',
  '108. White ends after Pawn capture.',
  '109. d7-c8: Black King moves one diagonal into safe vacant c8.',
  '110. Black ends with King c8 safe.',
  '111. b1-c2: White Queen moves one empty diagonal square.',
  '112. White ends after quiet Queen move.',
  '113. a8-b8: Black Queen slides one horizontal square; does not cross wall a7-b8.',
  '114. Coup: Black a6 Pawn becomes royal while retaining Pawn geometry; original King c8 becomes capturable Prince.',
  '115. Black ends; royal a6 is safe and Prince remains on c8.',
  '116. a1-c1: White Rook traverses now-empty b1 into c1; a6 royal remains safe.',
  '117. White ends after quiet Rook slide.',
  '118. g4-g5: Black Rook moves one empty square; royal Pawn a6 remains safe.',
  '119. Black ends the fiftieth move command; all compulsory choices absent.',
]

const other = (c: Color): Color => c === 'white' ? 'black' : 'white'
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const square = (x: number, y: number): SquareName => {
  const s = `${String.fromCharCode(97 + x)}${y + 1}`
  assert.match(s, /^[a-h][1-8]$/)
  return s as SquareName
}

test('iteration 143 independent rule and physical-state oracle: all 119 actions', () => {
  assert.equal(rationales.length, 119)
  assert.equal(trace.steps.length, rationales.length)
  let state = createGameState(trace.initial)
  const roles = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'] as const
  let pieces: PieceState[] = []
  for (const owner of ['white', 'black'] as const) for (let file = 0; file < 8; file++) {
    for (const [role, rank] of [[roles[file]!, owner === 'white' ? 0 : 7], ['pawn', owner === 'white' ? 1 : 6]] as const) {
      const s = square(file, rank)
      pieces.push({ id: `${owner}-${role}-${s}`, owner, role, originalRole: role, square: s,
        zone: 'board', promoted: false, royal: role === 'king', neutral: false })
    }
  }
  const sorted = (p: PieceState[]) => [...p].sort((a,b) => a.id.localeCompare(b.id))
  assert.deepEqual(sorted(state.pieces), sorted(pieces))
  const players = structuredClone(state.players)
  let effects: unknown[] = []
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: {white: 0, black: 0} }
  let active = 'w', rights = 'KQkq', half = 0, full = 1
  let ep: GameState['enPassant'] = []
  let canceled: { pieces: PieceState[]; half: number; full: number; ep: GameState['enPassant'] } | undefined
  let city = false, wall = false, curseBishop = false, curseRook = false, challenge = false
  const at = (s: string) => pieces.find(p => p.square === s && p.zone === 'board')
  const geometry = (p: PieceState, to: string, capture: boolean): boolean => {
    assert.ok(p.square)
    const [x,y] = xy(p.square), [u,v] = xy(to), dx = u-x, dy = v-y
    const distance = Math.max(Math.abs(dx), Math.abs(dy))
    if (!distance || city && to === 'a5') return false
    if ((curseBishop && p.id === 'black-bishop-f8' || curseRook && p.id === 'white-rook-h1') && distance > 2) return false
    if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2
    if (p.role === 'pawn') {
      const forward = p.owner === 'white' ? 1 : -1
      if (capture ? Math.abs(dx) !== 1 || dy !== forward
        : dx !== 0 || !(dy === forward || dy === 2*forward && (p.owner === 'white' ? y <= 1 : y >= 6))) return false
    } else if (p.role === 'king') { if (distance !== 1) return false }
    else if (!(p.role !== 'bishop' && (!dx || !dy) || p.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false
    let previous: string = p.square
    for (let n=1;n<=distance;n++) {
      const next = square(x+Math.sign(dx)*n,y+Math.sign(dy)*n)
      if (city && next === 'a5' || wall && [previous,next].sort().join(':') === 'a7:b8') return false
      if (n < distance && at(next)) return false
      previous = next
    }
    return true
  }
  const checked = (color: Color) => {
    const royal = pieces.find(p => p.royal && p.owner === color)!
    assert.ok(royal?.square)
    return pieces.some(p => p.zone === 'board' && p.owner !== color
      && !(challenge && p.owner === 'black' && p.id !== 'black-knight-g8')
      && geometry(p, royal.square!, true))
  }
  const relocate = (from: string, to: string, captor: Color, mode = 'ordinary') => {
    assert.match(to, /^[a-h][1-8]$/)
    const mover = at(from)!, victim = at(to)
    assert.ok(mover, `${from}: physical mover`)
    if (mode === 'ordinary') assert.ok(geometry(mover,to,!!victim), `${from}-${to}: geometry`)
    if (victim) {
      assert.equal(victim.owner, other(captor)); assert.equal(victim.royal,false)
      victim.zone='captured';victim.square=null;victim.capturedBy=captor
    }
    mover.square=to as SquareName
    return {mover, capture: !!victim}
  }
  const clockMove = (pawnOrCapture: boolean) => {
    half = pawnOrCapture ? 0 : half+1
    if (turn.color === 'black') full++
    active = turn.color === 'white' ? 'b' : 'w'
    ep=[];turn.phase='afterMove';turn.moveMade=true
  }
  for (const [index, {action}] of trace.steps.entries()) {
    const n = index+1, label = rationales[index]!
    assert.ok(label.startsWith(`${n}.`))
    const before = state, immutable = structuredClone(before)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      assert.equal(turn.moveMade,false,label)
      if(n === 17) canceled={pieces:structuredClone(pieces),half,full,ep:structuredClone(ep)}
      const p = at(from)!;assert.equal(p.owner,turn.color)
      if(challenge)assert.equal(p.id,'black-knight-g8')
      const {mover,capture} = relocate(from,to,turn.color)
      if(mover.royal)rights=rights.replace(turn.color==='white'?/[KQ]/g:/[kqa]/g,'')
      if(mover.id==='black-rook-a8')rights=rights.replace(/[qa]/g,'')
      if(mover.id==='white-rook-h1')rights=rights.replace('K','')
      if(mover.id==='white-rook-a1')rights=rights.replace('Q','')
      clockMove(mover.role==='pawn'||capture)
      if(mover.role==='pawn' && Math.abs(Number(from[1])-Number(to[1]))===2) {
        ep=[{target:square(xy(from)[0],(xy(from)[1]+xy(to)[1])/2),pawnId:mover.id}]
      }
      if(challenge){challenge=false;effects=effects.filter(e=>(e as {type:string}).type!=='challenge')}
    } else if(action.type === 'endTurn') {
      assert.equal(turn.moveMade,true,label)
      assert.equal(checked(turn.color),false,label)
      turn={color:other(turn.color),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}
    } else {
      assert.equal(action.type,'playCard',label)
      if(action.type!=='playCard')throw Error('unexpected choice')
      const owner:Color=n===18?'white':turn.color
      assert.equal(turn.cardPlays[owner],0)
      const player=players[owner], i=player.hand.findIndex(c=>c.id===action.cardInstanceId)
      assert.ok(i>=0,label)
      const card=player.hand.splice(i,1)[0]!
      assert.equal(card.cardId,action.cardId)
      const continuing=['forbidden-city','curse','fortification','coup'].includes(card.cardId)
      if(!continuing)player.discard.push(card)
      player.hand.push(player.deck.shift()!)
      turn.cardPlays[owner]++
      if(['bombard','ghostwalk','onslaught','breakthrough','evil-eye'].includes(card.cardId))assert.equal(turn.phase,'beforeMove')
      else assert.equal(turn.phase,'afterMove')
      switch(card.cardId) {
        case 'forbidden-city': assert.equal(action.target,'a5');assert.equal(at('a5'),undefined);city=true;effects.push({type:card.cardId,owner,card,square:'a5'});break
        case 'bombard':
          assert.deepEqual(action.target,[{from:'h8',to:'h3'}]);assert.equal(at('h7')!.id,'black-pawn-h7')
          for(const s of ['h6','h5','h4','h3'])assert.equal(at(s),undefined)
          relocate('h8','h3',owner,'bombard');rights=rights.replace('k','');clockMove(false);break
        case 'treason': {
          assert.deepEqual(action.target,{rook:'a8',knight:'g8'})
          const rook=at('a8')!,knight=at('g8')!;assert.equal(rook.role,'rook');assert.equal(knight.role,'knight')
          rook.square='g8';knight.square='a8';rights=rights.replace('q','a');break
        }
        case 'ghostwalk':assert.deepEqual(action.target,[{from:'f7',to:'f6'}]);relocate('f7','f6',owner);clockMove(true);break
        case 'knightmare':
          assert.equal(action.target,undefined);assert.ok(canceled)
          pieces=structuredClone(canceled.pieces);half=canceled.half;full=canceled.full;ep=structuredClone(canceled.ep)
          active='b';turn.phase='beforeMove';turn.moveMade=false;break
        case 'onslaught': {
          const moves=[{from:'b2',to:'b3'},{from:'d2',to:'d3'},{from:'e2',to:'e3'},{from:'h2',to:'h3'}]
          assert.deepEqual(action.target,moves)
          for(const m of moves){assert.equal(at(m.to),undefined);relocate(m.from,m.to,owner)}
          clockMove(true);break
        }
        case 'curse': {
          const target=n===38?'f8':'h1';assert.equal(action.target,target)
          const piece=at(target)!;assert.equal(piece.owner,other(owner))
          effects.push({type:'curse',owner,card,pieceId:piece.id})
          if(n===38)curseBishop=true;else curseRook=true;break
        }
        case 'merciless':assert.deepEqual(action.target,[{from:'c8',to:'h8'}]);relocate('c8','h8',owner);break
        case 'heresy': {
          const moves=[{from:'c1',to:'d1'},{from:'e8',to:'f8'},{from:'e6',to:'d6'},{from:'h6',to:'g6'}]
          assert.deepEqual(action.target,moves);assert.equal(pieces.filter(p=>p.zone==='board'&&p.role==='bishop').length,4)
          for(const m of moves){assert.equal(at(m.from)!.role,'bishop');assert.equal(at(m.to),undefined);assert.equal(Math.abs(xy(m.to)[0]-xy(m.from)[0])+Math.abs(xy(m.to)[1]-xy(m.from)[1]),1);relocate(m.from,m.to,owner,'heresy')}
          break
        }
        case 'fortification':assert.deepEqual(action.target,{from:'a7',to:'b8'});wall=true;effects.push({type:card.cardId,owner,card,from:'a7',to:'b8'});break
        case 'breakthrough':assert.deepEqual(action.target,[{from:'g5',to:'g4'}]);assert.equal(at('g5')!.role,'pawn');relocate('g5','g4',owner,'breakthrough');clockMove(true);break
        case 'evil-eye': {
          assert.deepEqual(action.target,{attacker:'h3',victim:'g4'});assert.ok(geometry(at('h3')!,'g4',true))
          const victim=at('g4')!;assert.equal(victim.owner,'black');victim.square=null;victim.zone='captured';victim.capturedBy=owner;clockMove(true);break
        }
        case 'challenge':assert.equal(action.target,'c8');assert.equal(at('c8')!.id,'black-knight-g8');assert.ok(geometry(at('c8')!,'a7',false));challenge=true;effects.push({type:'challenge',owner,player:'black',pieceId:'black-knight-g8'});break
        case 'coup':assert.equal(action.target,'a6');at('a6')!.royal=true;at('c8')!.royal=false;effects.push({type:'coup',owner,card,princeId:'black-king-e8',kingId:'black-pawn-a7',princeRole:'king'});break
        default:throw Error(`unreviewed card ${card.cardId}`)
      }
    }
    const result=applyAction(before,action)
    assert.deepEqual(before,immutable,`${label}: immutable input including capturedBy`)
    assert.ok(result.ok,label);state=result.state
    assert.deepEqual(sorted(state.pieces),sorted(pieces),`${label}: independent physical identities and captors`)
    assert.deepEqual(state.players,players,`${label}: every card zone and draw order`)
    assert.deepEqual(state.turn,turn,label);assert.deepEqual(state.effects,effects,label)
    assert.equal(state.orientation,0);assert.equal(state.outcome,null)
    const letters={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}
    const board=[]
    for(let y=7;y>=0;y--){let row='';for(let x=0;x<8;x++){const p=at(square(x,y));row+=p?(p.owner==='white'?letters[p.role].toUpperCase():letters[p.role]):'1'}board.push(row.replace(/1+/g,s=>String(s.length)))}
    // All observed doubles lack a geometrically adjacent eligible captor.
    const legalEp=ep.flatMap(e=>pieces.filter(p=>p.zone==='board'&&p.role==='pawn'&&p.owner!==pieces.find(q=>q.id===e.pawnId)!.owner&&geometry(p,e.target,true)).map(p=>({from:p.square,to:e.target})))
    assert.deepEqual(legalEp,[],`${label}: legal EP assessed independently from serialized target`)
    assert.deepEqual(state.enPassant,ep,label)
    assert.deepEqual(state.fen.split(' '),[board.join('/'),active,rights||'-','-',String(half),String(full)],`${label}: all six FEN fields`)
    for(const color of ['white','black'] as const){const threat=checked(color);assert.equal(threat,color==='black'&&n>=76&&n<=78,`${label}: independent ${color} threat`);assert.equal(isKingInCheck(state,color),threat,label)}
    assert.deepEqual(state.chaosForbidden,n===18?{player:'black',movement:'black-pawn-c7:c7:c6'}:undefined,label)
    assert.equal(state.plotsExecution,undefined);assert.deepEqual(state.plotsAllowances??[],[])
    assert.deepEqual(state.fogLocked??[],[]);assert.deepEqual(state.riposteLostMoves??[],[])
    assert.equal(state.riposteSkipped,undefined);assert.equal(state.riposteCheckDeferred,undefined)
    assert.equal(state.pendingAbduction??null,null);assert.equal(state.pendingDoomsayer??null,null);assert.deepEqual(state.underElfHill??[],[])
    if(n===78){
      assert.ok(state.pendingRescue)
      assert.deepEqual(state.pendingRescue,{before,fen:'q1n1B1r1/pp1k3p/n3bp1b/2ppp1p1/3P1PP1/NPP1P2P/P3N2R/RQB1K3 b Q - 1 18',pieces:before.pieces,enPassant:[],historyLength:41,movedPieceIds:['black-knight-b8']})
      const refuse=applyAction(state,{type:'endTurn'});assert.equal(refuse.ok,false,'checked provisional move cannot end turn')
    }else assert.equal(state.pendingRescue??null,null,label)
    if(n===18){assert.equal(legalDests(state).get('c7')?.includes('c6')??false,false);const retry=applyAction(state,{type:'move',from:'c7',to:'c6'});assert.equal(retry.ok,false)}
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50)
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,15)
  assert.equal(state.fen,'1qk1bB2/np5p/p4p2/1Nppb1r1/1P3P2/1P2P2P/P1QKN2R/2RB4 w - - 5 28')
})
