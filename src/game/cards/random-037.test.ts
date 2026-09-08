import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { createGameState } from '../state.js'
import { applyAction } from '../reducer.js'
import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import type { GameState, PieceState, SquareName } from '../types.js'

// Reviewed sequentially against rules §§8–11, 14–18 and cards.md; these are
// explicit decisions, independent of the generated hashes and acceptance.
const rationales = [
  '1. Ng1-f3 jumps to empty f3; both Kings remain safe.',
  '2. White ends its completed move; Black receives a fresh allowance.',
  '3. Before moving, Black marks its nonroyal g8 Knight Pacifist; retain card and draw Dungeon.',
  '4. e7-e6 advances one empty forward square; reset pawn clock.',
  '5. Black ends; Pacifism persists and allowances reset.',
  '6. e2-e4 crosses empty e3; create physical e3 en-passant opportunity.',
  '7. Mystic Shield selects exactly the just-moved e4 Pawn; discard and draw Sanctuary.',
  '8. End White; Shield begins its protected Black turn and e3 opportunity survives.',
  '9. a7-a6 is clear; unused e3 opportunity expires.',
  '10. End Black; Mystic Shield expires at the protected turn end.',
  '11. Nf3-d4 jumps to empty d4 without capture.',
  '12. End White; Black has its normal move and card allowance.',
  '13. Tournament swaps owned g8 and opposing b1 Knights without capture; Pacifism follows g8 identity.',
  '14. End replacement move; Black fullmove increment occurred once.',
  '15. e4-e5 advances to empty e5, stopping before e6 Pawn.',
  '16. End White; no effect expires.',
  '17. h7-h5 crosses clear h6; record h6 en passant.',
  '18. End Black; h6 opportunity remains available to White.',
  '19. Qd1-e2 uses the vacated adjacent diagonal square; h6 opportunity expires.',
  '20. Rebirth relocates opposing g7 Pawn to empty starting-rank a7; no capture or clock advance.',
  '21. End White; relocated g7 physical identity remains Black.',
  '22. Bf8-a3 passes e7,d6,c5,b4, all empty.',
  '23. End Black; bishop does not check through occupied d2.',
  '24. h2-h3 advances to empty h3, no capture.',
  '25. End White; h4 is still empty ahead of its Pawn.',
  '26. f7-f6 advances one empty square and resets pawn clock.',
  '27. End Black; White King remains shielded by its pieces.',
  '28. Rh1-g1 slides one empty square and permanently loses White kingside castling.',
  '29. End White; queenside castling right alone remains for White.',
  '30. h5-h4 advances to empty h4, stopping before White h3 Pawn.',
  '31. End Black; neither blocked h-Pawn can advance ordinarily.',
  '32. White Tournament exchanges g8 and b1 Knights back; Pacifism still belongs to Black g8 Knight.',
  '33. End White replacement move; no additional regular move allowed.',
  '34. Ba3-c5 crosses empty b4; d4 Knight lies beyond destination.',
  '35. End Black; c5 bishop line toward e1 is not a diagonal.',
  '36. Nd4-b5 jumps to empty b5; Knight is not Pacifist.',
  '37. End White; Black King is not attacked by b5 Knight.',
  '38. a6-a5 advances to empty a5; relocated g7 Pawn stays a7.',
  '39. End Black; cards and effects unchanged.',
  '40. Qe2-d3 moves one empty diagonal square.',
  '41. End White; queen does not expose its King.',
  '42. Rh8-h6 crosses empty h7 and loses Black kingside castling.',
  '43. End Black; rook h6 does not check e1.',
  '44. Nb5-a3 jumps back to vacant a3.',
  '45. End White; the a3 Knight is safely distinct from b1 Knight.',
  '46. Ke8-e7 steps onto unattacked e7; revoke remaining Black castling.',
  '47. Neutrality marks opposing nonroyal non-Queen b1 Knight, retaining owner and physical identity.',
  '48. End Black; neutral Knight can now be controlled by either player.',
  '49. White moves neutral Nb1-c3; its destination attacks neither King.',
  '50. End White; neutral marker follows to c3.',
  '51. Bc5xf2 passes empty d4,e3 and captures White f2 Pawn, checking e1.',
  '52. End Black; White starts checked but holds an Anathema escape.',
  '53. e5xf6 captures Black f6 Pawn while White remains checked; §11.6 requires same-turn rescue.',
  '54. Black immediately plays Knightmare: restore both Pawns, clocks and White move; forbid e5-f6 repeat.',
  '55. Qd3-g3 crosses empty e3,f3; different replacement remains temporarily checked pending Anathema.',
  '56. Anathema swaps enemy Bf2/Rh6; Rf2 cannot check e1 diagonally, so rescue succeeds.',
  '57. End rescued White turn; both players card allowances reset.',
  '58. Ke7-f7 moves onto safe f7; f6 Pawn blocks the White Queen line.',
  '59. End Black; no rights are restored.',
  '60. Bf1-e2 steps diagonally to vacant e2.',
  '61. End White; f2 Rook attacks bishop e2 but not King e1.',
  '62. b7-b5 crosses empty b6; create b6 opportunity.',
  '63. Dungeon relocates enemy Rg1 to empty h1 and freezes it through White next turn; preserve b6 opportunity.',
  '64. End Black; Dungeon restriction begins for White.',
  '65. Be2-d3 moves a different piece; the h1 Rook stays frozen.',
  '66. End White; Dungeon expires after that turn.',
  '67. c7-c6 advances to empty c6.',
  '68. End Black; White has a fresh card allowance.',
  '69. Breakthrough permits h3xh4 forward capture of Black h-Pawn, consuming the move and resetting clock.',
  '70. End White replacement move; captured h-Pawn remains captured.',
  '71. Bh6xd2 crosses clear g5,f4,e3 and captures White d-Pawn, checking e1.',
  '72. End Black; White may use same-turn Heresy to answer check.',
  '73. Qg3-f3 is clear but leaves Bd2 check; temporary rescue obligation is correct.',
  '74. Heresy moves all four Bishops to empty opposite-color adjacent squares, Black first; Bd2-e2 removes check.',
  '75. End White after successful rescue; Heresy does not add a move.',
  '76. Be2-d3 is a normal diagonal move from its new square color.',
  '77. End Black; d3 Bishop does not check e1.',
  '78. Bd4-e3 is a normal clear diagonal step.',
  '79. End White; no remaining temporary restriction.',
  '80. Rf2xc2 crosses empty e2,d2 and captures White c-Pawn.',
  '81. End Black; Rc2 is blocked from e1 diagonally.',
  '82. Rh1-h2 is legal now Dungeon expired; h2 is vacant.',
  '83. End White; kingside rights remain lost despite rook return.',
  '84. f6-f5 advances to empty f5.',
  '85. End Black; f4 remains empty.',
  '86. Qf3-e4 steps to clear diagonal e4.',
  '87. End White; e6 Pawn blocks queen diagonal toward f7.',
  '88. Qd8-f8 crosses empty e8 and lands empty f8.',
  '89. End Black; g8 Pacifist Knight remains unmoved.',
  '90. Qe4-c4 crosses empty d4 and lands c4.',
  '91. End White; no direct King attack emerges.',
  '92. Black controls neutral Nc3xb5, legally capturing its own-colored b5 Pawn; Knight owner stays White.',
  '93. End Black; neutral b5 Knight attacks neither King.',
  '94. Qc4-a4 crosses empty b4, stopping below Black a5 Pawn.',
  '95. End White; no capture was made.',
  '96. f5-f4 advances to empty f4 and resets clock.',
  '97. End Black; White Bishop e3 is attacked but King is safe.',
  '98. Qa4-b4 slides to adjacent empty b4.',
  '99. End White; Qb4 line toward f8 is blocked by e7/f8 geometry and Black pieces.',
  '100. Black controls neutral Nb5-c3, returning without capture; both Kings safe.',
  '101. End Black; neutrality persists on c3 identity.',
  '102. Be3-d2 moves to empty d2, escaping f4 Pawn attack.',
  '103. End White; neutral c3 does not threaten King e1.',
  '104. Bd3-h7 crosses clear e4,f5,g6; all vacated earlier.',
  '105. Fortification marks adjacent boundary e2-f2 after Black move; no board or clock change.',
  '106. End Black; boundary persists independently of pieces.',
  '107. h4-h5 advances empty square without crossing e2-f2 wall.',
  '108. End White; Pawn has not reached promotion rank.',
  '109. Qf8-d6 crosses empty e7 and lands d6.',
  '110. End Black; d6 Queen does not expose f7 King.',
  '111. Ra1-b1 slides to empty b1 and loses final White castling right.',
  '112. Forbidden City marks empty d4 after White move; retain card and draw Man of Straw.',
  '113. End White; d4 becomes forbidden while e2-f2 wall persists.',
  '114. Black controls neutral Nc3xb1, capturing White rook; Knight jump avoids d4 and e2-f2 wall.',
  '115. End Black after fiftieth move command; White begins safe with four persistent effects.',
]

const pacifism = { type: 'pacifism', owner: 'black', card: { id: 'black-hand-2-pacifism', cardId: 'pacifism' }, pieceId: 'black-knight-g8' }
const neutrality = { type: 'neutrality', owner: 'black', card: { id: 'black-hand-4-neutrality', cardId: 'neutrality' }, pieceId: 'white-knight-b1' }
const relocate = (pieces: PieceState[], from: string, to: string, actor: 'white' | 'black') => {
  const piece = pieces.find(p => p.square === from && p.zone === 'board')!
  assert.ok(piece)
  const victim = pieces.find(p => p.square === to && p.zone === 'board')
  if (victim) { victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor }
  piece.square = to as SquareName
}
const cardMoves: Record<number, [string, string][]> = {
  13: [['b1', 'g8'], ['g8', 'b1']], 20: [['g7', 'a7']],
  32: [['g8', 'b1'], ['b1', 'g8']], 56: [['f2', 'h6'], ['h6', 'f2']],
  63: [['g1', 'h1']], 69: [['h3', 'h4']],
  74: [['c8', 'c7'], ['d2', 'e2'], ['c1', 'd1'], ['d3', 'd4']],
}

test('iteration 037 deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/037.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860037)
  assert.equal(trace.moves, 50)
  assert.equal(trace.steps.length, 115)
  assert.equal(rationales.length, trace.steps.length)
  const replayed = replayTrace(trace)
  let state = createGameState(trace.initial)
  let restored: GameState | undefined
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1
    assert.ok(rationales[index]!.startsWith(`${step}. `))
    const before = state
    if (step === 53) restored = before
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    let expectedPieces = structuredClone(before.pieces)
    const actor = before.turn.color
    const oldFen = before.fen.split(' ')
    const newFen = state.fen.split(' ')
    let halfmove = Number(oldFen[4])
    let fullmove = Number(oldFen[5])
    let expectedEp = before.enPassant
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = parseSquare(action.from)!, to = parseSquare(action.to)!
      const piece = before.pieces.find(p => p.square === action.from && p.zone === 'board')!
      const victim = before.pieces.find(p => p.square === action.to && p.zone === 'board')
      assert.ok(piece.owner === actor || piece.neutral)
      assert.notEqual(piece.id, pacifism.pieceId, 'Pacifist Knight never moves in this trace')
      if (victim) {
        assert.ok(victim.owner !== actor || piece.neutral || victim.neutral)
        assert.ok(!victim.royal)
        assert.notEqual(victim.id, pacifism.pieceId)
      }
      const dx = to % 8 - from % 8, dy = Math.floor(to / 8) - Math.floor(from / 8)
      if (piece.role === 'knight') assert.equal(Math.abs(dx) * Math.abs(dy), 2)
      else if (piece.role === 'pawn') {
        const forward = piece.owner === 'white' ? 1 : -1
        assert.equal(dx, victim ? Math.sign(dx) : 0)
        assert.equal(Math.abs(dx), victim ? 1 : 0)
        assert.ok(dy === forward || (!victim && dy === 2 * forward && action.from[1] === (piece.owner === 'white' ? '2' : '7')))
        const crossed = `${action.from[0]}${Number(action.from[1]) + forward}`
        if (Math.abs(dy) === 2) assert.ok(!before.pieces.some(p => p.square === crossed))
      } else if (piece.role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1)
      else {
        assert.ok(piece.role === 'rook' ? dx === 0 || dy === 0 : piece.role === 'bishop' ? Math.abs(dx) === Math.abs(dy) : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
        for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
          const square = from + n * (Math.sign(dx) + 8 * Math.sign(dy))
          assert.ok(!before.pieces.some(p => p.square && parseSquare(p.square) === square), 'sliding path is empty')
        }
      }
      relocate(expectedPieces, action.from, action.to, actor)
      halfmove = piece.role === 'pawn' || victim ? 0 : halfmove + 1
      fullmove += actor === 'black' ? 1 : 0
      expectedEp = piece.role === 'pawn' && Math.abs(dy) === 2 ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: piece.id }] : []
      assert.equal(state.turn.phase, 'afterMove')
      assert.equal(state.turn.moveMade, true)
      assert.deepEqual(state.players, before.players)
    } else if (action.type === 'playCard') {
      const owner = (['white', 'black'] as const).find(color => before.players[color].hand.some(c => c.id === action.cardInstanceId))!
      assert.ok(owner)
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.equal(state.turn.cardPlays[owner], 1)
      const player = before.players[owner], card = player.hand.find(c => c.id === action.cardInstanceId)!
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(c => c !== card), player.deck[0]])
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1))
      assert.deepEqual(state.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white'])
      assert.deepEqual(state.players[owner].discard, [3, 47, 105, 112].includes(step) ? player.discard : [...player.discard, card])
      assert.equal(before.turn.phase, [3, 13, 32, 69].includes(step) ? 'beforeMove' : 'afterMove')
      if (step === 54) {
        assert.ok(restored)
        expectedPieces = restored.pieces
        halfmove = Number(restored.fen.split(' ')[4]); fullmove = Number(restored.fen.split(' ')[5])
        assert.equal(state.chaosForbidden?.player, 'white')
        assert.equal(applyAction(state, { type: 'move', from: 'e5', to: 'f6' }).ok, false, 'Knightmare forbids repeating the captured movement')
        assert.equal(state.turn.phase, 'beforeMove')
        assert.equal(state.turn.moveMade, false)
      } else {
        const moves = cardMoves[step]
        if (moves) {
          if ([13, 32, 56].includes(step)) {
            for (const [from, to] of moves) expectedPieces.find(p => p.id === before.pieces.find(q => q.square === from)!.id)!.square = to as SquareName
          } else for (const [from, to] of moves) relocate(expectedPieces, from, to, owner)
        }
        if (step === 47) Object.assign(expectedPieces.find(p => p.id === neutrality.pieceId)!, { neutral: true, neutralBeforeEffects: false })
        if ([13, 32, 69].includes(step)) {
          halfmove = step === 69 ? 0 : halfmove + 1
          fullmove += actor === 'black' ? 1 : 0
          expectedEp = []
          assert.equal(state.turn.moveMade, true)
        } else assert.equal(state.turn.moveMade, before.turn.moveMade)
      }
    } else {
      assert.equal(action.type, 'endTurn')
      assert.equal(before.turn.moveMade, true)
      assert.equal(state.turn.color, actor === 'white' ? 'black' : 'white')
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 })
      assert.equal(state.turn.moveMade, false)
      assert.equal(state.turn.phase, 'beforeMove')
      assert.deepEqual(state.players, before.players)
    }
    assert.deepEqual(state.pieces, expectedPieces, rationales[index])
    assert.deepEqual(state.enPassant, expectedEp, `step ${step}: physical en passant`)
    assert.equal(Number(newFen[4]), halfmove, `step ${step}: halfmove`)
    assert.equal(Number(newFen[5]), fullmove, `step ${step}: fullmove`)
    const expectedRights = step < 28 ? 'KQkq' : step < 42 ? 'Qkq' : step < 46 ? 'Qq' : step < 111 ? 'Q' : '-'
    assert.equal(newFen[2], expectedRights)
    const effects: unknown[] = step >= 3 ? [pacifism] : []
    if (step >= 7 && step < 10) effects.push({ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-pawn-e2' })
    if (step >= 47) effects.push(neutrality)
    if (step >= 63 && step < 66) effects.push({ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-rook-h1' })
    if (step >= 105) effects.push({ type: 'fortification', owner: 'black', card: { id: 'black-hand-1-fortification', cardId: 'fortification' }, from: 'e2', to: 'f2' })
    if (step >= 112) effects.push({ type: 'forbidden-city', owner: 'white', card: { id: 'white-deck-3-forbidden-city', cardId: 'forbidden-city' }, square: 'd4' })
    assert.deepEqual(state.effects, effects, `step ${step}: exact effect lifetimes`)
    assert.equal(!!state.pendingRescue, [53, 55, 73].includes(step))
    assert.ok(!state.pendingAbduction && !state.pendingDoomsayer)
    assert.equal(state.orientation, 0)
    assert.equal(state.outcome, null)
    // In this trace the neutral Knight never geometrically attacks either King;
    // Pacifist g8 likewise never targets an opposing royal. Ordinary check is
    // therefore a valid independent oracle after explicitly checking that fact.
    for (const knight of state.pieces.filter(p => p.neutral && p.square)) {
      const n = parseSquare(knight.square!)!
      for (const king of state.pieces.filter(p => p.royal)) {
        const k = parseSquare(king.square!)!
        assert.notEqual(Math.abs(n % 8 - k % 8) * Math.abs(Math.floor(n / 8) - Math.floor(k / 8)), 2)
      }
    }
    const chess = Chess.default()
    chess.board = parseFen(state.fen).unwrap().board
    chess.turn = state.turn.color
    assert.equal(chess.isCheck(), [52, 53, 54, 55, 72, 73].includes(step), `step ${step}: independent royal safety`)
  }
  assert.deepEqual(state, replayed)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13)
  assert.equal(state.fen, 'rn4n1/p1bp1k1b/2pqp3/p3P2P/1Q3p2/N7/PPrB2PR/1N1BK3 w - - 0 27')
})
