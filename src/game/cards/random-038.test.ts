import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { CARD_CATALOG } from './catalog.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Independently reviewed sequentially against rules §§8–13,17 and the named cards.
const rationales = [
  '1. g2-g3 advances into empty g3; King remains screened; pawn clock resets.',
  '2. White ends its completed move; Black receives a fresh allowance.',
  '3. e7-e6 opens e7 without exposing e8; no en-passant right.',
  '4. Black ends; White receives the move, board and hands unchanged.',
  '5. e2-e4 crosses empty e3; e3 en-passant opportunity belongs to this physical pawn.',
  '6. White ends; the e3 opportunity remains available for Black.',
  '7. e8-e7 enters the vacated safe square, revokes Black castling, expires en passant.',
  '8. Black ends safely; White begins with both card allowances reset.',
  '9. Masquerade moves the Queen d1-f3 through empty e2 without capture; consumes the move and draws Vulture.',
  '10. White ends after the replacement move; no second regular move is granted.',
  '11. g8-f6 is a Knight jump to empty f6; Black King remains safe.',
  '12. Black ends; no card or physical piece changes.',
  '13. f3-c3 crosses empty e3,d3; Queen identity is preserved.',
  '14. White ends; Black begins, clock unchanged.',
  '15. g7-g5 crosses empty g6 and creates the g6 en-passant opportunity.',
  '16. Black ends; g6 opportunity survives into the opposing turn.',
  '17. c3-d4 is an empty diagonal Queen step; old en passant expires.',
  '18. White ends safely, without a card draw.',
  '19. d7-d6 is a single empty forward pawn step, resetting the clock.',
  '20. Black ends; same pieces, cards and clock.',
  '21. f1-c4 traverses empty e2,d3; Bishop cannot attack through e6 to King e7.',
  '22. White ends, card allowances reset for Black.',
  '23. b7-b5 crosses empty b6, creating a b6 opportunity.',
  '24. Black ends; the new en-passant opportunity survives.',
  '25. e1-f1 reaches a safe vacated square, removes White castling and expires en passant.',
  '26. White ends safely; all castling rights are now gone.',
  '27. Ghostwalk lets a8-g8 cross own b8,c8,d8,f8 pieces to an empty square; replacement move and draw.',
  '28. White Think Again rewinds that rook and clock, refunds Ghostwalk and its draw, but spends White card.',
  '29. Reused Ghostwalk a8-a4 crosses own a7 Pawn to empty a4; differs from canceled a8-g8.',
  '30. Black ends after its replacement; both allowances refresh.',
  '31. Queen d4xf6 crosses empty e5 and captures the g8 Knight, checking e7.',
  '32. White ends with check permitted; Black receives its escape move.',
  '33. King e7xf6 captures the unprotected Queen and escapes check; c4 Bishop attacks e6, not f6.',
  '34. Black ends safely with both captured identities retained off-board.',
  '35. d2-d3 is an empty pawn step; resets clock.',
  '36. White ends; no compulsory draw when no card was played.',
  '37. f8-g7 develops the Bishop to the square vacated by its pawn.',
  '38. Black ends; board and hands persist.',
  '39. g3-g4 is one forward empty square; g5 blocks further advance but does not forbid this one.',
  '40. White ends safely.',
  '41. King f6-e5 is safe: d3 Pawn attacks e4 and e4 Pawn attacks d5/f5.',
  '42. Black ends; White has the regular move.',
  '43. Bishop c1-d2 enters vacated d2 and leaves its King safe.',
  '44. White ends with no board change.',
  '45. f7-f6 is a single empty pawn step, leaving King e5 safe.',
  '46. Black ends and resets allowances.',
  '47. Knight g1-h3 jumps to empty h3 without exposing f1.',
  '48. White ends safely.',
  '49. Queen d8-e8 is an empty horizontal step; e6 Pawn blocks its file.',
  '50. Black ends; White receives its move.',
  '51. Knight b1-a3 jumps to empty a3; the a4 rook may attack it without checking f1.',
  '52. White ends safely with the Knight on a3.',
  '53. Queen e8-d8 returns one square horizontally.',
  '54. Black ends; same board, cards and clock.',
  '55. Rook a1-d1 crosses empty b1,c1; no capture.',
  '56. Black Think Again restores a1 and the pre-move clock, spends/draws once, requires another move.',
  '57. Knight a3xb5 captures the b7 pawn, a genuinely different replacement.',
  '58. White ends with Black reaction allowance spent only for the completed turn.',
  '59. Queen d8-e8 is an empty horizontal step with no self-check.',
  '60. Black ends safely.',
  '61. Rook a1-d1 is legal on this later turn; the earlier canceled-move prohibition has expired.',
  '62. White ends; no card movement.',
  '63. Queen e8-c6 crosses empty d7 to empty c6.',
  '64. Black ends; White has a fresh move.',
  '65. d3-d4 gives pawn check to e5 while leaving f1 safe.',
  '66. White ends; Black must remove pawn check.',
  '67. Queen c6-a6 crosses empty b6 but leaves pawn check: provisional §11.6 rescue state, not a completed legal turn.',
  '68. Vendetta cannot remove d4 Pawn check; it fizzles/spends, and the unsaved Queen move and clocks rewind.',
  '69. King e5xe4 captures the Pawn on a safe square; d4 Pawn attacks e5, not e4.',
  '70. Black ends after a legal replacement with Vendetta still discarded.',
  '71. Bishop d2-e3 is an empty diagonal step without exposing f1.',
  '72. White ends; board and hands remain unchanged.',
  '73. King e4-d5 enters the c4 Bishop diagonal: only a provisional move awaiting a rescue card.',
  '74. Fortification b4-c5 cannot block c4-d5 attack, so fizzles/spends and the illegal King move rewinds.',
  '75. Rook h8-e8 crosses empty g8,f8 as a legal replacement; King e4 stays safe.',
  '76. Black ends safely; failed wall is absent.',
  '77. f2-f3 pushes one square; f1 remains safe with Kings two ranks apart.',
  '78. White ends; no en-passant opportunity.',
  '79. King e4xf3 captures the unprotected f2 Pawn; White King f1 is two ranks away.',
  '80. Black ends safely after capture.',
  '81. Knight b5xa7 captures the a7 Pawn by a legal jump.',
  '82. White ends; no reaction chosen.',
  '83. Bishop c8-d7 enters empty d7; f3 King remains safe.',
  '84. Black ends safely.',
  '85. Knight a7xc6 captures the Queen; no promotion or identity change.',
  '86. White Man-Trap selects own occupied c2 after its move, retains its physical card and draws once.',
  '87. White ends; trap stays on c2 and does not fire on its current occupant.',
  '88. Forced March shifts original c7 Pawn sideways to empty b7, consuming Black move, without promotion or en passant.',
  '89. Black ends; trap c2 remains armed.',
  '90. Bishop e3-c1 crosses empty d2; neither endpoint is c2, so trap does not trigger.',
  '91. White ends safely with trap unchanged.',
  '92. Relocated Pawn b7-b5 may double from owner second rank (§13.1), crossing b6; en passant uses original c7 identity.',
  '93. Black ends; b6 opportunity remains for White.',
  '94. Bishop c1-e3 crosses empty d2 and expires en passant; trap remains dormant.',
  '95. White ends safely.',
  '96. Rook a4-a3 moves into empty a3, not the trapped c2.',
  '97. Black ends; trap and cards unchanged.',
  '98. Rook d1-a1 crosses empty c1,b1 without self-check.',
  '99. White ends safely.',
  '100. Rook a3-d3 crosses empty b3,c3; Bishop e3 blocks its line toward f3.',
  '101. Black Peace Talks removes the retained c2 Man-Trap to White discard, spends/draws Black card once.',
  '102. Black ends with no continuing effects.',
  '103. Rook a1-d1 crosses empty b1,c1; d4 Pawn blocks the opposing rook file.',
  '104. White ends safely.',
  '105. Rook d3-c3 enters empty c3 without checking White King f1.',
  '106. Black ends safely.',
  '107. King f1-g1 enters empty safe g1; King f3 attacks only ranks two through four.',
  '108. White ends safely with no castling rights.',
  '109. e6-e5 advances one square; c6 Knight does not attack f3 King.',
  '110. Black ends; White begins move 26, no pending rescue or effects.',
]

test('iteration 038 deterministic replay', () => {
  const trace: RandomTrace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/038.json', import.meta.url), 'utf8'))
  assert.equal(trace.seed, 860038)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.length, 110)
  assert.equal(trace.steps.filter(({ action }) => action.type === 'playCard').length, 10)
  let state = createGameState(trace.initial)
  const states = [state]
  const trap = { type: 'man-trap', owner: 'white', card: { id: 'white-deck-1-man-trap', cardId: 'man-trap' }, square: 'c2' }
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    assert.ok(rationales[index]!.startsWith(`${n}. `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    assert.deepEqual(state.effects, n >= 86 && n < 101 ? [trap] : [], `step ${n}: retained effects`)
    assert.equal(Boolean(state.pendingRescue), n === 67 || n === 73)
    assert.equal(state.outcome, null)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = parseSquare(action.from)!
      const to = parseSquare(action.to)!
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap()
      const move = { from, to }
      assert.equal(position.isLegal(move), n !== 67 && n !== 73, rationales[index])
      position.play(move)
      assert.equal(state.fen, makeFen(position.toSetup()), `step ${n}: independent board and clocks`)
      position.turn = before.turn.color
      assert.equal(position.isCheck(), Boolean(state.pendingRescue), `step ${n}: independent King safety`)
      const mover = before.pieces.find(piece => piece.square === action.from)!
      const victim = before.pieces.find(piece => piece.square === action.to)
      for (const piece of before.pieces) {
        const after = state.pieces.find(item => item.id === piece.id)!
        if (piece.id === mover.id) assert.deepEqual(after, { ...piece, square: action.to })
        else if (piece.id === victim?.id) {
          assert.equal(after.zone, 'captured')
          assert.equal(after.square, null)
          assert.equal(after.owner, piece.owner)
          assert.equal(after.role, piece.role)
        } else assert.deepEqual(after, piece)
      }
      const double = mover.role === 'pawn' && Math.abs(to - from) === 16
      const target = `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`
      assert.deepEqual(state.enPassant, double ? [{ target, pawnId: mover.id }] : [])
      assert.deepEqual(state.players, before.players)
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true })
    } else if (action.type === 'endTurn') {
      assert.equal(Boolean(before.pendingRescue), false)
      assert.equal(before.turn.moveMade, true)
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.players, before.players)
      assert.deepEqual(state.enPassant, before.enPassant)
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black'
      const player = before.players[owner]
      const selected = player.hand.find(card => card.id === action.cardInstanceId)!
      assert.ok(selected)
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(owner === before.turn.color ? before.turn.phase : 'afterOpponentMove'))
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(card => card.id !== selected.id), player.deck[0]!])
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1))
      assert.deepEqual(state.players[owner].discard, action.cardId === 'man-trap' ? player.discard : [...player.discard, selected])
      assert.equal(state.turn.cardPlays[owner], 1)
      const checkpoint = ({ 28: 26, 56: 54, 68: 66, 74: 72 } as Record<number, number>)[n]
      if (checkpoint !== undefined) {
        assert.equal(state.fen, states[checkpoint]!.fen)
        assert.deepEqual(state.pieces, states[checkpoint]!.pieces)
        assert.deepEqual(state.enPassant, states[checkpoint]!.enPassant)
        assert.equal(state.turn.moveMade, false)
        if (n === 28) assert.deepEqual(state.players.black, states[26]!.players.black)
        if (n === 68 || n === 74) assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK')
      } else if (n === 86 || n === 101) {
        assert.equal(state.fen, before.fen)
        assert.deepEqual(state.pieces, before.pieces)
        assert.equal(state.turn.moveMade, true)
        if (n === 86) assert.equal(before.pieces.find(piece => piece.square === 'c2')?.owner, 'white')
        if (n === 101) assert.deepEqual(state.players.white.discard, [...before.players.white.discard, trap.card])
      } else {
        const relocation = ({ 9: ['d1', 'f3'], 27: ['a8', 'g8'], 29: ['a8', 'a4'], 88: ['c7', 'b7'] } as Record<number, string[]>)[n]!
        assert.deepEqual(action.target, [{ from: relocation[0], to: relocation[1] }])
        assert.deepEqual(state.pieces, before.pieces.map(piece => piece.square === relocation[0] ? { ...piece, square: relocation[1] } : piece))
        assert.equal(state.turn.moveMade, true)
        assert.deepEqual(state.enPassant, [])
        const fields = before.fen.split(' ')
        assert.deepEqual(state.fen.split(' ').slice(1), [owner === 'white' ? 'b' : 'w', fields[2], '-', String(n === 88 ? 0 : Number(fields[4]) + 1), String(Number(fields[5]) + (owner === 'black' ? 1 : 0))])
      }
    } else assert.fail(`unreviewed action ${n}`)
    states.push(state)
  }
  assert.equal(state.fen, '1n2r3/3b2bp/2Np1p2/1p2p1p1/2BP2P1/2r1Bk1N/PPP4P/3R2KR w - - 0 26')
  assert.deepEqual(replayTrace(trace), state)
})
