import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState } from '../types.js'

// Independently reviewed in order against rules §§8–13, 15.3, 17.1, 19.2,
// 20–21, cards.md, and each played card's printed catalog timing.
const rationales = [
  '1. Nb1-a3 jumps to an empty square; neither King is exposed.',
  '2. White ends the completed Knight turn; board, clocks and hands stay fixed.',
  '3. h7-h6 is a clear one-square Black Pawn move; Pawn clock resets.',
  '4. White Knightmare immediately cancels h7-h6; restore h7 and prior clocks, draw Heresy, require a different Black move.',
  '5. Ng8-f6 is a distinct legal replacement; Knightmare allowance remains spent.',
  '6. Black ends the replacement turn; White opponent-card allowance resets.',
  '7. Ng1-f3 is an unobstructed Knight jump; White King remains screened.',
  '8. White ends Ng1-f3; Black becomes actor without a draw.',
  '9. c7-c5 crosses empty c6, creating the c6 en-passant target.',
  '10. End turn retains c6 en-passant for the White reply.',
  '11. g2-g4 crosses empty g3, replacing the expired c6 en-passant right with g3.',
  '12. End turn retains g3 for Black; no cards change.',
  '13. e7-e6 is clear; the old g3 en-passant opportunity expires.',
  '14. Black ends e7-e6; White receives a fresh card allowance.',
  '15. Annexation simultaneously advances c2-c4 and g4-g6 through empty c3/g5; only starting c2 grants en passant, and the card consumes the move.',
  '16. White ends the Annexation replacement turn; c3 en-passant survives for Black.',
  '17. Bf8-d6 travels through empty e7; en passant expires and Black King stays safe.',
  '18. Black ends the Bishop move; no board or hand changes.',
  '19. e2-e4 crosses empty e3 and establishes e3 en passant.',
  '20. Black Chaos cancels e2-e4 immediately, restoring e2, clocks and no en passant; White must choose differently.',
  '21. h2-h4 crosses empty h3 and is distinct from canceled e2-e4; h3 en passant replaces the old right.',
  '22. White ends its replacement move; Black card allowance resets.',
  '23. Qd8-e7 moves one diagonal square to the vacated e7; safe King.',
  '24. Black ends Qd8-e7; clocks and pieces remain unchanged.',
  '25. Nf3-g5 jumps legally without capture or exposing White King.',
  '26. White ends the Knight turn; no compulsory draw.',
  '27. Bd6-f4 crosses empty e5 and crosses the frontier toward White.',
  '28. White Toll accepts Black payment of the unprotected e6 Pawn; Bishop stays f4, Pawn is captured, clock resets, one replacement drawn.',
  '29. Black ends the paid Toll turn; no replay of its Bishop move.',
  '30. h4-h5 advances into an empty square; White King remains screened.',
  '31. White ends h4-h5 without card expenditure.',
  '32. Nf6-g8 returns by a Knight jump to an empty square.',
  '33. Black ends Nf6-g8; White starts with unused allowances.',
  '34. Na3-b5 jumps to empty b5; no capture or check on White.',
  '35. White ends Na3-b5; hands and board unchanged.',
  '36. Bf4-c7 crosses empty e5 and d6, ending on the vacated Pawn square.',
  '37. Black ends Bf4-c7; no en passant exists.',
  '38. Nb5-d6 gives ordinary Knight check on the e8 King.',
  '39. White ends the checking move; Black receives its escape turn.',
  '40. Ng8-h6 does not answer Nd6 check on e8; only a pending same-turn card rescue permits this provisional state (§11.6).',
  '41. Holy War b8/c7 cannot remove Nd6 check; it fizzles spent, rolls back provisional Ng8-h6, and leaves Black a regular escape move.',
  '42. Ke8-f8 escapes Nd6; f8 is unattacked, and Black loses castling rights.',
  '43. Black ends its legal King escape; spent Holy War does not consume the following turn.',
  '44. Nd6xb7 captures the Black b7 Pawn by a Knight jump; White King remains safe.',
  '45. Challenge names the movable c7 Bishop, neither King nor Queen, for Black next turn; draw Think Again.',
  '46. White ends turn while retaining the next-turn Bishop obligation.',
  '47. Bc7-a5 crosses empty b6, satisfying and clearing Challenge.',
  '48. Black ends the fulfilled Challenge turn.',
  '49. Qd1-b3 crosses empty c2; d2 still screens White King from Ba5.',
  '50. White ends Qd1-b3; no card changes.',
  '51. Bc8xb7 captures the White Knight on the adjacent diagonal.',
  '52. Black ends its Bishop capture; the Knight remains captured.',
  '53. Qb3xb7 passes empty b4,b5,b6 and captures that Black Bishop.',
  '54. White ends its Queen recapture; clocks remain zero.',
  '55. Qe7-d8 is a one-square diagonal retreat; Black King f8 remains safe.',
  '56. Black ends the Queen retreat with no draw.',
  '57. e2-e3 advances a Pawn one clear square; no en passant.',
  '58. White ends e2-e3; board and hands stay fixed.',
  '59. Qd8-c8 moves horizontally one empty square.',
  '60. White Chaos immediately restores Qd8, prior clocks and Black move availability; its own card remains spent.',
  '61. Kf8-e7 is a different replacement; d7 shields e7 from Qb7 and no other White piece attacks e7.',
  '62. Black ends the replacement King move; White card allowance resets.',
  '63. e3-e4 is a clear Pawn step, resetting the halfmove clock.',
  '64. White ends e3-e4 without changing either hand.',
  '65. d7-d6 exposes Qb7 along c7,d7 to Ke7; only the explicit pending rescue keeps this provisional move.',
  '66. White Think Again cancels that latest Pawn move, restoring d7 shielding Ke7 and the previous clock.',
  '67. Ghostwalk Qd8-d5 passes own d7 Pawn and empty d6 to empty d5 without capture; d7 still shields King, and the move differs from d7-d6.',
  '68. Black ends Ghostwalk, with both players cards already spent for this turn.',
  '69. Ke1-d1 is safe behind d2; White castling rights disappear.',
  '70. White ends its King move without a card.',
  '71. Winged Victory returns the same captured b7 Pawn on empty central d4, consumes Black move, resets Pawn clock and advances fullmove.',
  '72. Black ends the Pawn return; no second draw or move.',
  '73. Ng5-h3 is a legal Knight retreat; neither King is newly attacked.',
  '74. White ends Ng5-h3; hands unchanged.',
  '75. a7-a6 advances into empty a6 above own Ba5; King remains safe.',
  '76. Black ends a7-a6; White may play a replacement card.',
  '77. Passing in the Night swaps White h5 and Black c5 Pawns without capture, ownership change or promotion; consumes White move and resets Pawn clock.',
  '78. White ends the Pawn swap; both physical identities retain their new squares.',
  '79. Ra8-a7 moves to the square vacated by a7-a6; no capture.',
  '80. Black ends Ra8-a7; White starts fresh.',
  '81. g6xh7 captures Black h7 Pawn diagonally, leaving the White Pawn unpromoted on rank seven.',
  '82. White ends its Pawn capture; h7 remains the White Pawn.',
  '83. Ng8-f6 jumps away from the last rank; Black King e7 is safe.',
  '84. Coup makes Black h5 Pawn royal while Ke7 becomes a capturable Prince; h3 Knight blocks White h-file Rook, so h5 is safe; card stays active.',
  '85. Black ends Coup turn; the h5 Pawn keeps royal status and normal Pawn movement.',
  '86. Kd1-e2 steps safely: Black d4 Pawn attacks c3/e3, Qd5 is blocked toward e2, and Bb5 has not yet moved.',
  '87. White ends its King step; Coup persists.',
  '88. Rh8-f8 crosses empty g8; the true Black King at h5 stays safe.',
  '89. Black ends its Rook move; Prince e7 remains nonroyal.',
  '90. Rh1-g1 moves one empty square; h3 Knight continues blocking the h-file.',
  '91. White ends its Rook step; no effect expires.',
  '92. Qd5-c6 moves one diagonal square; c5 Pawn blocks its file toward White.',
  '93. Black ends Qd5-c6; no card or board changes.',
  '94. Ra1-b1 enters empty b1, with White King e2 still safe.',
  '95. Heresy moves every surviving Bishop to an empty orthogonal neighbor, Black a5-b5 first then White c1-d1/f1-e1; colors flip and neither royal is attacked.',
  '96. White ends Heresy; three Bishops keep their changed square colors.',
  '97. Rf8-g8 enters empty g8; h5 royal Pawn remains safe.',
  '98. Black ends Rf8-g8 with Coup still active.',
  '99. b2-b3 is a clear Pawn step; Black Bb5 remains blocked by White c4 toward e2.',
  '100. White ends b2-b3; no new en passant.',
  '101. Qc6-c8 crosses empty c7 to empty c8 without capturing.',
  '102. Black ends Qc6-c8; White gets a promotion opportunity.',
  '103. h7-h8 promotes the same original g2 Pawn to Queen, checks royal h5 down empty h7/h6, and is a regular move.',
  '104. Abduction conceals the opposing nonroyal Rook g8 in away zone after promotion, spends once, preserves clocks and omits hidden target from history.',
  '105. Reveal opens recall without moving pieces, advancing turn or drawing another card.',
  '106. Black correctly identifies its Rook and g8 square; restore that exact Rook and resolve the challenge, preserving promotion and expenditure.',
  '107. White ends resolved Abduction; Black must answer Qh8 check on royal h5.',
  '108. Onslaught h5-h4/d7-d6 cannot escape Qh8 file check: h4 remains attacked. Both Pawns stay put, card is spent, Black retains its regular escape move (§11.6).',
  '109. Rg8xh8 captures the promoted physical g2 Pawn, removes check on royal h5, and resets capture clock.',
  '110. Black ends the legal escape capture; Coup remains active.',
  '111. Rg1-g6 travels through empty g2,g3,g4,g5; White King remains safe and h5 is off the Rook line.',
  '112. White ends the long Rook move; all effects persist.',
  '113. Ra7xb7 captures the original White Queen adjacent on its rank; royal h5 remains safe.',
  '114. Black ends Queen capture; White has no on-board Queen remaining.',
  '115. Rg6-g4 crosses empty g5 and stops on empty g4; neither King is in check.',
  '116. White ends the fiftieth move command; Black begins with fresh allowances and the h5 royal Pawn intact.',
]

test('iteration 045 replays its deterministic trace', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/045.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860045)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.length, 116)
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 15)
  assert.ok(replayTrace(trace))
})

test('iteration 045 independently checks movement, bookkeeping and card semantics', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/045.json', import.meta.url), 'utf8')) as RandomTrace
  let state = createGameState(trace.initial)
  const snapshots: GameState[] = [state]
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    snapshots.push(state)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = before.pieces.find(piece => piece.square === action.from && piece.zone === 'board')!
      const victim = before.pieces.find(piece => piece.square === action.to && piece.zone === 'board')
      assert.equal(mover.owner, before.turn.color, rationales[index])
      const dx = action.to.charCodeAt(0) - action.from.charCodeAt(0)
      const dy = Number(action.to[1]) - Number(action.from[1])
      const ax = Math.abs(dx), ay = Math.abs(dy)
      if (mover.role === 'knight') assert.equal(ax * ay, 2, rationales[index])
      else if (mover.role === 'king') assert.equal(Math.max(ax, ay), 1, rationales[index])
      else if (mover.role === 'pawn') {
        const forward = mover.owner === 'white' ? 1 : -1
        assert.equal(dx === 0 ? !victim : ax === 1 && !!victim, true, rationales[index])
        assert.ok(dy === forward || dx === 0 && dy === 2 * forward && ['2', '7'].includes(action.from[1]!), rationales[index])
      } else {
        assert.ok(mover.role === 'bishop' ? ax === ay : mover.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0, rationales[index])
      }
      if (mover.role !== 'knight') {
        for (let distance = 1; distance < Math.max(ax, ay); distance++) {
          const square = String.fromCharCode(action.from.charCodeAt(0) + Math.sign(dx) * distance) + String(Number(action.from[1]) + Math.sign(dy) * distance)
          assert.ok(!before.pieces.some(piece => piece.zone === 'board' && piece.square === square), rationales[index])
        }
      }
      const moved = state.pieces.find(piece => piece.id === mover.id)!
      assert.deepEqual(moved, { ...mover, square: action.to, ...(action.promotion ? { role: action.promotion, promoted: true } : {}) }, rationales[index])
      if (victim) {
        assert.notEqual(victim.owner, mover.owner)
        assert.equal(victim.royal, false)
        assert.deepEqual(state.pieces.find(piece => piece.id === victim.id), { ...victim, square: null, zone: 'captured' })
      }
      assert.deepEqual(state.players, before.players)
      assert.equal(state.turn.moveMade, true)
      assert.equal(state.turn.color, before.turn.color)
      assert.equal(Number(state.fen.split(' ')[4]), mover.role === 'pawn' || victim ? 0 : Number(before.fen.split(' ')[4]) + 1)
      assert.equal(Number(state.fen.split(' ')[5]), Number(before.fen.split(' ')[5]) + (mover.owner === 'black' ? 1 : 0))
      assert.deepEqual(state.enPassant, mover.role === 'pawn' && ay === 2 ? [{ target: action.from[0] + String((Number(action.from[1]) + Number(action.to[1])) / 2), pawnId: mover.id }] : [])
      assert.equal(!!state.pendingRescue, step === 40 || step === 65)
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true)
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.players, before.players)
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white')
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 })
      assert.equal(state.turn.moveMade, false)
    } else if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black'
      assert.deepEqual(state.players[owner].hand.map(card => card.id), [...before.players[owner].hand.filter(card => card.id !== action.cardInstanceId).map(card => card.id), before.players[owner].deck[0]!.id])
      assert.deepEqual(state.players[owner].deck, before.players[owner].deck.slice(1))
      assert.equal(state.turn.cardPlays[owner], before.turn.cardPlays[owner] + 1)
      assert.equal(state.players[owner].discard.length, before.players[owner].discard.length + (action.cardId === 'coup' ? 0 : 1))
    }
  }
  const at = (step: number) => snapshots[step]!
  const piece = (step: number, id: string) => at(step).pieces.find(item => item.id === id)!
  for (const [cancel, original] of [[4, 2], [20, 18], [60, 58], [66, 64]]) {
    assert.equal(at(cancel!).fen, at(original!).fen)
    assert.deepEqual(at(cancel!).pieces, at(original!).pieces)
    assert.equal(at(cancel!).turn.moveMade, false)
  }
  assert.deepEqual(at(15).enPassant, [{ target: 'c3', pawnId: 'white-pawn-c2' }])
  assert.equal(piece(15, 'white-pawn-g2').square, 'g6')
  assert.equal(piece(28, 'black-pawn-e7').zone, 'captured')
  assert.equal(piece(28, 'black-bishop-f8').square, 'f4')
  assert.deepEqual(at(41).pieces, at(39).pieces)
  assert.equal(at(41).fen, at(39).fen)
  assert.equal(at(41).turn.moveMade, false)
  assert.equal(at(41).history.at(-1)?.type, 'cardFizzled')
  assert.deepEqual(at(45).effects, [{ type: 'challenge', owner: 'white', player: 'black', pieceId: 'black-bishop-f8' }])
  assert.deepEqual(at(47).effects, [])
  assert.equal(piece(67, 'black-queen-d8').square, 'd5')
  assert.equal(piece(67, 'black-pawn-d7').square, 'd7')
  assert.equal(piece(71, 'black-pawn-b7').square, 'd4')
  assert.equal(piece(71, 'black-pawn-b7').zone, 'board')
  assert.equal(piece(77, 'white-pawn-h2').square, 'c5')
  assert.equal(piece(77, 'black-pawn-c7').square, 'h5')
  assert.equal(piece(84, 'black-pawn-c7').royal, true)
  assert.equal(piece(84, 'black-pawn-c7').role, 'pawn')
  assert.equal(piece(84, 'black-king-e8').royal, false)
  assert.deepEqual(at(84).effects, [{ type: 'coup', owner: 'black', card: { id: 'black-deck-0-coup', cardId: 'coup' }, princeId: 'black-king-e8', kingId: 'black-pawn-c7', princeRole: 'king' }])
  for (const [id, square] of [['black-bishop-f8', 'b5'], ['white-bishop-c1', 'd1'], ['white-bishop-f1', 'e1']]) assert.equal(piece(95, id!).square, square)
  assert.equal(piece(103, 'white-pawn-g2').role, 'queen')
  assert.equal(piece(103, 'white-pawn-g2').promoted, true)
  assert.equal(piece(104, 'black-rook-h8').zone, 'away')
  assert.equal(at(104).pendingAbduction?.phase, 'concealment')
  assert.equal(at(105).pendingAbduction?.phase, 'recall')
  assert.deepEqual(at(105).pieces, at(104).pieces)
  assert.deepEqual(at(106).pieces, at(103).pieces)
  assert.equal(at(106).fen, at(103).fen)
  assert.deepEqual(at(106).players, at(104).players)
  assert.equal(at(106).pendingAbduction, null)
  assert.deepEqual(at(108).pieces, at(107).pieces)
  assert.equal(at(108).fen, at(107).fen)
  assert.equal(at(108).turn.moveMade, false)
  assert.equal(at(108).history.at(-1)?.type, 'cardFizzled')
  assert.equal(piece(109, 'white-pawn-g2').zone, 'captured')
  assert.equal(piece(113, 'white-queen-d1').zone, 'captured')
  assert.equal(piece(116, 'black-pawn-c7').royal, true)
  assert.equal(state.fen, '1nq4r/1r1pkpp1/p4n2/1bP4p/2PpP1R1/1P5N/P2PKP2/1R1BB3 b - - 1 25')
})
