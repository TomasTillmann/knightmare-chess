import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { attacks, bishopAttacks } from 'chessops/attacks'
import { Board } from 'chessops/board'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, SquareName } from '../types.js'
import { checkState, digest, type RandomTrace } from './random-campaign.js'

// Rules §§8–11, 15.4; cards.md; catalog printed timings. No later action is approved.
const rationales = [
  '1. Bombard moves h1 rook to h6, jumping exactly the friendly h2 pawn; h3–h5 are empty. Replacement move, one draw, kingside right lost.',
  '2. White ends its completed replacement move; Black receives a fresh allowance.',
  '3. Black f7 pawn advances one square to empty f6; pawn clock resets.',
  '4. Black ends; White starts with the unchanged position.',
  '5. Confabulation moves c1 bishop diagonally onto friendly d2 pawn; both identities remain in the continuing composite, consuming the move.',
  '6. White ends with the d2 composite intact; Black starts.',
  '7. Black d7 pawn advances to empty d6.',
  '8. Black ends; White starts.',
  '9. Annexation advances composite d2–d4 and e2–e4 over empty d3/e3, without capture; both original second-rank pawns gain en-passant opportunities.',
  '10. White ends; both en-passant opportunities remain available for Black.',
  '11. Black bishop c8–g4 follows clear d7/e6/f5; the old en-passant opportunities expire.',
  '12. Black ends; White starts.',
  '13. White f2 pawn advances to empty f3.',
  '14. White ends; Black starts.',
  '15. Black bishop g4–h5 is a one-square diagonal move.',
  '16. Black ends; White starts.',
  '17. White rook h6–g6 moves one square horizontally.',
  '18. White ends; Black starts.',
  '19. Black h7 pawn captures the physical h1 rook diagonally on g6; rook enters captured zone.',
  '20. Black ends; White starts.',
  '21. The d4 composite uses bishop movement to f2 through empty e3, retaining its pawn and bishop identities; its pawn component resets the clock.',
  '22. White ends; Black starts.',
  '23. Black King e8–d7 moves diagonally one square, relinquishing both castling rights.',
  '24. Black ends; White starts.',
  '25. White knight b1–c3 uses an ordinary knight jump.',
  '26. White ends; Black starts.',
  '27. Black knight b8–c6 uses an ordinary knight jump.',
  '28. Black ends; White starts.',
  '29. White a2 pawn advances to empty a3.',
  '30. White ends; Black starts.',
  '31. Black rook h8–h7 moves one square down the file.',
  '32. After its move Black plays Anathema, swapping White bishop f1 and rook a1 without capture or another move; identities and composite remain intact.',
  '33. Black ends; White starts with fresh allowances.',
  '34. White knight c3–e2 makes an ordinary knight jump.',
  '35. White ends; Black starts.',
  '36. Black knight c6–e5 makes an ordinary knight jump.',
  '37. Black ends; White starts.',
  '38. White knight g1–h3 makes an ordinary knight jump.',
  '39. White ends; Black starts.',
  '40. Black knight e5–d3 jumps to an empty square and gives check on e1.',
  '41. Black ends its safe turn; White receives the checking position.',
  '42. White Queen d1 captures that knight on d3 through empty d2, resolving check and resetting the capture clock.',
  '43. White ends; Black starts.',
  '44. Black physical h7 pawn advances g6–g5.',
  '45. Black ends; White starts.',
  '46. White uses Assassin to move its Queen d3–f3 through empty e3, capturing its OWN physical pawn white-pawn-f2; this is not an opponent capture.',
  '47. White ends its replacement move; Black starts.',
  '48. Black King d7–c6 moves diagonally one square.',
  '49. Black ends; White starts.',
  '50. White g2 pawn advances to empty g3.',
  '51. White ends; Black starts.',
  '52. Black a7 pawn advances to empty a6.',
  '53. Black ends; White starts.',
  '54. White a3 pawn advances to empty a4.',
  '55. White ends; Black starts.',
  '56. Black Queen d8–e8 moves one square horizontally.',
  '57. White immediately plays Think Again: restore Black Queen to d8, board/clocks/effects/en-passant and Black move availability; White alone spends and draws.',
  '58. Black substitutes the distinct knight move g8–h6; it does not repeat the canceled Queen move.',
  '59. Black ends; White starts with its next-turn allowance restored.',
  '60. White knight e2–g1 makes an ordinary knight jump.',
  '61. White ends; Black starts.',
  '62. Black King c6–d7 moves diagonally one square.',
  '63. Black plays Figure Dance after moving: simultaneous a8 rook to a1 and a1 bishop to h1, without capture. Rook check on e1 is not mate because d2 is a safe King escape.',
  '64. Black ends; White starts in the rook check.',
  '65. White King e1–d2 escapes the a1 rook check and loses its remaining castling right.',
  '66. White ends safely; Black starts.',
  '67. Black bishop h5 captures White Queen f3 through empty g4.',
  '68. Black ends; White starts.',
  '69. White knight h3–f4 makes an ordinary knight jump.',
  '70. White ends; Black starts.',
  '71. Black physical h7 pawn captures White g1 knight diagonally from g5 to f4.',
  '72. Black ends; White starts.',
  '73. White composite f2–e1 uses its bishop component; no promotion, both identities persist, pawn clock resets.',
  '74. White ends; Black starts.',
  '75. Black knight h6–f5 makes an ordinary knight jump.',
  '76. Black ends; White starts.',
  '77. White h2 pawn advances to empty h3.',
  '78. White ends; Black starts.',
  '79. Black g7 pawn advances to empty g6.',
  '80. Black ends; White starts. The physical white-pawn-f2 remains captured solely by White Assassin at action 46.',
  '81. FINDING: Winged Victory must reject white-pawn-f2: its artwork requires a Pawn the opponent captured, but this pawn was captured by White itself. Board, hand, deck, discard, allowance and clocks must remain unchanged.',
]

function royalSafe(state: GameState, color: Color): boolean {
  const board = Board.empty()
  for (const p of state.pieces.filter(p => p.zone === 'board')) board.set(parseSquare(p.square!)!, { role: p.role, color: p.owner })
  const king = state.pieces.find(p => p.royal && p.owner === color)!
  const square = parseSquare(king.square!)!
  return state.pieces.filter(p => p.zone === 'board' && p.owner !== color).every(p => {
    const from = parseSquare(p.square!)!
    const ordinary = attacks({ role: p.role, color: p.owner }, from, board.occupied)
    const composite = state.effects.length > 0 && p.id === 'white-pawn-d2'
    return !ordinary.has(square) && !(composite && bishopAttacks(from, board.occupied).has(square))
  })
}

test('iteration 090 independent semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/090.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationales.length, 81)
  rationales.forEach((r, i) => assert.ok(r.startsWith(`${i + 1}. `)))
  let state = createGameState(trace.initial)
  let beforeCanceledMove: GameState | undefined
  let captureByAssassin: GameState | undefined
  for (const [index, step] of trace.steps.slice(0, 80).entries()) {
    const n = index + 1
    const before = state
    const action = step.action
    const expected = structuredClone(before)
    const actor = before.turn.color
    const movePiece = (from: SquareName, to: SquareName) => {
      const moving = expected.pieces.find(p => p.square === from)!
      assert.ok(moving, `${n}: physical mover at ${from}`)
      const victim = expected.pieces.find(p => p.square === to)
      if (victim) { assert.equal(victim.royal, false); victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor }
      moving.square = to
    }
    let resetClock = false
    let consumeMove = false
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = parseSquare(action.from)!, to = parseSquare(action.to)!
      assert.match(action.from, /^[a-h][1-8]$/)
      assert.match(action.to, /^[a-h][1-8]$/)
      const moving = before.pieces.find(p => p.square === action.from)!
      const victim = before.pieces.find(p => p.square === action.to)
      assert.equal(moving.owner, actor)
      if (victim) assert.notEqual(victim.owner, actor)
      const board = parseFen(before.fen).unwrap().board
      if (moving.role === 'pawn' && !victim && moving.id !== 'white-pawn-d2') {
        assert.equal(to - from, actor === 'white' ? 8 : -8, `${n}: single forward pawn step`)
      } else {
        const reach = attacks({ role: moving.role, color: actor }, from, board.occupied)
        assert.ok(reach.has(to) || moving.id === 'white-pawn-d2' && bishopAttacks(from, board.occupied).has(to), `${n}: independent move geometry`)
      }
      movePiece(action.from as SquareName, action.to as SquareName)
      resetClock = moving.originalRole === 'pawn' || !!victim
      consumeMove = true
      expected.enPassant = []
      if (n === 56) beforeCanceledMove = before
    } else if (action.type === 'playCard') {
      const owner: Color = n === 57 ? 'white' : actor
      const player = expected.players[owner]
      const card = player.hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(card, `${n}: actual physical card in hand`)
      assert.equal(before.turn.cardPlays[owner], 0)
      player.hand = player.hand.filter(c => c.id !== card.id)
      player.hand.push(player.deck.shift()!)
      if (n !== 5) player.discard.push(card)
      expected.turn.cardPlays[owner] = 1
      consumeMove = [1, 5, 9, 46].includes(n)
      if (consumeMove) assert.equal(before.turn.phase, 'beforeMove')
      else assert.equal(before.turn.phase, 'afterMove')
      if (n === 1) {
        assert.deepEqual(before.pieces.filter(p => p.square?.[0] === 'h' && Number(p.square[1]) > 1 && Number(p.square[1]) < 6).map(p => p.square), ['h2'])
        movePiece('h1', 'h6')
      } else if (n === 5) {
        const bishop = expected.pieces.find(p => p.id === 'white-bishop-c1')!
        bishop.square = null; bishop.zone = 'away'
        expected.effects = [{ type: 'confabulation', owner: 'white', card, pieceIds: ['white-pawn-d2', 'white-bishop-c1'] }]
      } else if (n === 9) {
        for (const square of ['d3', 'd4', 'e3', 'e4']) assert.ok(!before.pieces.some(p => p.square === square))
        movePiece('d2', 'd4'); movePiece('e2', 'e4')
        expected.enPassant = [{ target: 'd3', pawnId: 'white-pawn-d2' }, { target: 'e3', pawnId: 'white-pawn-e2' }]
        resetClock = true
      } else if (n === 32) {
        expected.pieces.find(p => p.id === 'white-rook-a1')!.square = 'f1'
        expected.pieces.find(p => p.id === 'white-bishop-f1')!.square = 'a1'
      } else if (n === 46) {
        assert.equal(before.pieces.find(p => p.square === 'f3')!.id, 'white-pawn-f2')
        assert.equal(before.pieces.find(p => p.square === 'd3')!.owner, 'white')
        assert.ok(!before.pieces.some(p => p.square === 'e3'))
        movePiece('d3', 'f3'); resetClock = true
      } else if (n === 57) {
        assert.ok(beforeCanceledMove)
        expected.pieces = structuredClone(beforeCanceledMove.pieces)
        expected.enPassant = structuredClone(beforeCanceledMove.enPassant)
        expected.effects = structuredClone(beforeCanceledMove.effects)
        expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false
      } else if (n === 63) {
        expected.pieces.find(p => p.id === 'black-rook-a8')!.square = 'a1'
        expected.pieces.find(p => p.id === 'white-bishop-f1')!.square = 'h1'
      } else assert.fail(`${n}: unreviewed card`)
    } else {
      assert.equal(action.type, 'endTurn')
      assert.equal(before.turn.moveMade, true)
      expected.turn = { color: actor === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
    }
    if (consumeMove) { expected.turn.phase = 'afterMove'; expected.turn.moveMade = true }
    const inputDigest = digest(before)
    const result = applyAction(before, action)
    assert.equal(digest(before), inputDigest, `${n}: immutable input`)
    assert.ok(result.ok, `${n}: ${rationales[index]}`)
    state = result.state
    checkState(state)
    assert.deepEqual(state.pieces, expected.pieces, `${n}: complete independent physical identities`)
    assert.deepEqual(state.players, expected.players, `${n}: card identities and all three zones`)
    assert.deepEqual(state.effects, expected.effects, `${n}: complete effect identities`)
    assert.deepEqual(state.enPassant, expected.enPassant, `${n}: en-passant lifecycle`)
    assert.deepEqual(state.turn, expected.turn, `${n}: phase, owner and allowance`)
    assert.equal(state.orientation, 0)
    assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer && !state.underElfHill?.length)
    assert.equal(state.outcome, null)
    const priorFen = parseFen(before.fen).unwrap(), afterFen = parseFen(state.fen).unwrap()
    assert.equal(afterFen.halfmoves, n === 57 ? parseFen(beforeCanceledMove!.fen).unwrap().halfmoves : consumeMove ? resetClock ? 0 : priorFen.halfmoves + 1 : priorFen.halfmoves, `${n}: halfmove clock`)
    assert.equal(afterFen.fullmoves, n === 57 ? priorFen.fullmoves - 1 : priorFen.fullmoves + Number(consumeMove && actor === 'black'), `${n}: fullmove clock`)
    assert.equal(afterFen.turn, state.turn.moveMade ? actor === 'white' ? 'black' : 'white' : state.turn.color)
    assert.equal(state.fen.split(' ')[2], n < 23 ? 'Qkq' : n < 32 ? 'Q' : n < 65 ? 'A' : '-', `${n}: historical castling rights through relocations and King moves`)
    assert.ok(royalSafe(state, actor), `${n}: independent acting King safety, including composite bishop attacks`)
    if (n === 63) {
      assert.equal(royalSafe(state, 'white'), false)
      const escape = structuredClone(state)
      assert.ok(!escape.pieces.some(p => p.square === 'd2'))
      escape.pieces.find(p => p.id === 'white-king-e1')!.square = 'd2'
      assert.ok(royalSafe(escape, 'white'), 'Figure Dance check has the independently safe d2 escape')
    }
    assert.equal(digest(state), step.expected, `${n}: generated state unchanged`)
    if (n === 46) captureByAssassin = state
  }
  assert.equal(trace.steps.slice(0, 80).filter(s => s.action.type === 'move').length, 35)
  assert.equal(trace.steps.slice(0, 80).filter(s => s.action.type === 'playCard').length, 7)
  assert.ok(captureByAssassin)
  assert.deepEqual(state.pieces.find(p => p.id === 'white-pawn-f2'), captureByAssassin.pieces.find(p => p.id === 'white-pawn-f2'))
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-f2')!.zone, 'captured')
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-f2')!.capturedBy, 'white')
  assert.equal(state.fen, '3q1b2/1ppkp2r/p2p1pp1/5n2/P3Pp2/5bPP/1PPK4/r3PRNB w - - 0 20')
  assert.deepEqual(trace.steps[80]!.action, { type: 'playCard', cardId: 'winged-victory', cardInstanceId: 'white-deck-2-winged-victory', target: { pieceId: 'white-pawn-f2', to: 'e5' } })
  const original = structuredClone(state)
  const result = applyAction(state, trace.steps[80]!.action)
  assert.equal(result.ok, false, rationales[80])
  assert.deepEqual(result.state, original, 'ineligible Winged Victory must not spend/draw, move, or change clocks')
  assert.deepEqual(state, original, 'ineligible request must not mutate its input')
})
