import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { CARD_CATALOG } from './catalog.js'

// Independently reviewed in order against rules §§8–15 and the printed catalog.
// Quiet turns retain cards/effects/clocks; endTurn resets both card allowances.
const rationale = [
  '1. c2-c3 advances into empty c3; e1 remains screened and pawn clock resets.',
  '2. White ends the completed move; Black starts with the same board.',
  '3. d7-d6 advances one empty square; e8 safe; fullmove becomes 2.',
  '4. Black ends; White begins; neither player draws without a card.',
  '5. f2-f4 traverses empty f3; f3 en-passant right belongs to the same pawn.',
  '6. Ending White preserves the f3 response opportunity.',
  '7. c7-c5 traverses empty c6; c6 replaces the expired f3 opportunity.',
  '8. Ending Black preserves c6 en passant and advances no further clock.',
  '9. Nb1-a3 jumps onto empty a3; e1 safe; c6 right expires.',
  '10. White finishes the knight move, handing play to Black.',
  '11. Bc8-h3 crosses empty d7,e6,f5,g4; Bh3 has no ray to Ke1; g2 blocks its southwest ray.',
  '12. Black finishes; h3 bishop remains on board.',
  '13. d2-d3 advances into vacancy; moving the pawn leaves no line to e1.',
  '14. White finishes with both original royal identities safe.',
  '15. d6-d5 is an empty forward step; no en passant.',
  '16. Black finishes; White receives a fresh card allowance.',
  '17. Dubbing jumps Qd1-f2 as a knight without capture; consumes the move, discards and draws Masquerade.',
  '18. White ends the Dubbing replacement move; no extra regular move.',
  '19. Ng8-h6 jumps into vacancy; e8 remains safe.',
  '20. Black finishes with no card changes.',
  '21. Ng1xh3 captures the c8 bishop; same knight survives and capture resets clock.',
  '22. White ends; captured bishop stays captured.',
  '23. g7-g5 crosses empty g6, setting g6 en passant.',
  '24. Black ends with the g6 opportunity preserved.',
  '25. f4-f5 advances empty; choosing no en-passant capture expires g6.',
  '26. Mystic Shield targets exactly the f-pawn just moved; discard/draw Dungeon; protect next Black turn.',
  '27. Shield survives into Black turn with no board change.',
  '28. g5-g4 is an empty pawn step, unrelated to protected f5.',
  '29. Black finishes its protected-opponent turn; Mystic Shield expires.',
  '30. Nh3-f4 jumps without capture; both kings remain screened.',
  '31. Fireball after the quiet knight move captures f4,f5,g4 only; d5/d3 lie two files away; draw Irresistible Force.',
  '32. White ends after explosion; three physical identities remain captured.',
  '33. Qd8-c8 moves one clear file; e8 safe.',
  '34. Black ends; no replacement cards drawn.',
  '35. Rh1-g1 uses empty g1; permanently loses White kingside castling.',
  '36. Neutrality after move makes opposing b7 pawn neutral; keep owner/role and continuing card; draw Hidden Passage.',
  '37. White ends; b7 neutral can threaten a6/c6, neither royal square.',
  '38. a7-a5 crosses empty a6; pawn clock zero and a6 en passant.',
  '39. Black finishes; a6 en passant survives.',
  '40. Masquerade moves Ke1-d2 along a clear queen diagonal; d2 safe; all White castling lost; draw Cowardice.',
  '41. White ends the replacement move with royal identity now d2.',
  '42. Qc8-c7 enters the vacated pawn square; no exposed attack on e8.',
  '43. Black finishes; neutral b7 remains immobile.',
  '44. Irresistible Force pushes own Na3 to empty a4 and Pa2 to a3; no king pushed; draw Under Elf Hill.',
  '45. White ends the push replacement move; pawn clock zero.',
  '46. Ke8-d7 enters a safe adjacent vacancy; Na4 cannot attack d7; Black castling lost.',
  '47. Black ends; both sides now lack castling rights.',
  '48. Qf2-e1 moves one diagonal; d2 King stays behind its d3 pawn.',
  '49. White ends the queen move without spending a card.',
  '50. Kd7-e6 enters vacancy; white e2 pawn blocks Qe1 on the e-file.',
  '51. Black finishes at e6; neutral b7 attacks no king.',
  '52. Under Elf Hill removes the actual d2 King to away, consumes move; draw Passing in the Night.',
  '53. White ends while King is away; it is not due back on Black turn.',
  '54. Qc7-c6 moves one square; e6 remains unthreatened.',
  '55. Black ends and White return obligation starts before any move.',
  '56. Return King to vacant edge h5; Nh6 attacks f5/f7/g4/g8, not h5; Rh8 blocked by h7/h6.',
  '57. Bc1-e3 crosses vacant d2; returned King stays h5 as required.',
  '58. White ends its return turn; King movement restriction now expires.',
  '59. Blessing moves black Pc5-b4 on an empty diagonal without capturing Na4; draw Tournament.',
  '60. Black ends the Blessing replacement move.',
  '61. d3-d4 advances into empty d4; d5 opposing pawn does not occupy destination.',
  '62. White finishes; h5 remains safe.',
  '63. b4xc3 captures the original white c-pawn diagonally forward.',
  '64. Black ends; white c-pawn captured, black c-pawn now c3.',
  '65. Qe1-g3 crosses vacant f2; h5 King safe.',
  '66. Dungeon relocates opposing d5 pawn to vacant corner h1; no promotion by relocation; draw Doppelganger.',
  '67. Dungeon restriction persists through next Black turn.',
  '68. Qc6-f3 crosses now-empty d5,e4 and checks Kh5 through g4; Black e6 safe.',
  '69. Black ends; Dungeon expires, White must answer Qf3 check.',
  '70. Ra1-a2 fails to cure Qf3-g4-h5, so only a pending same-turn rescue permits this provisional move.',
  '71. Cowardice a5-a6 cannot cure the check; spend/discard/draw Chaos, restore pawn and provisional rook move/clocks.',
  '72. Kh5-h4 cures Qf3 check; f3 is not aligned with h4; spent allowance remains consumed.',
  '73. White can finish safely at h4 after replacing the illegal provisional move.',
  '74. f7-f6 advances empty; e6 King not exposed by the pawn departure.',
  '75. Black finishes; White has its next fresh card allowance.',
  '76. Kh4-h5 again enters Qf3 check and requires a pending rescue.',
  '77. Coup makes safe own Pa3 royal and h5 King a capturable Prince; c3 pawn blocks Qf3 to a3; draw Charge.',
  '78. White finishes with royal a3 safe; attacks on the h5 Prince do not check.',
  '79. Nb8-c6 jumps to empty c6; e6 King stays safe.',
  '80. Black ends; c6 knight does not threaten royal a3.',
  '81. Be3xh6 crosses f4,g5; captures knight; Qf3 still blocked toward royal a3 by black c3 pawn.',
  '82. White finishes with the h6 captured knight removed.',
  '83. Rh8-g8 moves to empty g8; castling already unavailable.',
  '84. Black ends; most recent moved role is rook.',
  '85. Doppelganger copies that rook for Qg3-h3, noncapturing; royal a3 safe; draw Winged Victory.',
  '86. White ends the replacement move with queen on h3.',
  '87. Qf3xh3 traverses empty g3 and captures White queen; c3 pawn still screens royal a3.',
  '88. Black finishes; queen is captured, not dead.',
  '89. Passing swaps Pe2/Ph1 and neutral Pb7/black Pf6 simultaneously; identities persist, no promotion; draw Revenge.',
  '90. White ends with royal a3 untouched; neutral f6 attacks e5/g5, not either royal.',
  '91. Pacifism selects own nonroyal Ra8 before move; keep continuing card and regular move; draw Crab.',
  '92. Qh3-d3 traverses g3,f3,e3; own c3 pawn blocks its line to royal a3.',
  '93. Black ends; pacifist a8 rook remains immune and unable to capture.',
  '94. Bh6xf8 crosses empty g7; captures original black bishop, royal a3 stays screened.',
  '95. White ends after capture; halfmove remains zero.',
  '96. Pe7xf6 legally captures the neutral b7 pawn despite shared encoded owner; Neutrality ends and discards.',
  '97. Crab targets actual f7 pawn now on b7, not captured original b7 identity; draw Mystic Shield.',
  '98. Black ends; Crab and Pacifism both persist.',
  '99. Prince h5-h4 is a one-square king-shaped move; royal pawn a3 unchanged.',
  '100. White finishes with royal a3 safe and Prince h4.',
  '101. Tournament swaps black Nc6/white Na4; neither king attacked by the new knight positions; draw Assassin.',
  '102. Black ends the noncapturing swap; card clock increases once.',
  '103. g2-g3 advances empty; a3 royal unaffected.',
  '104. White ends; Pawn move reset clock.',
  '105. Pacifist Ra8-e8 crosses empty b8,c8,d8; quiet movement remains allowed.',
  '106. Black ends with Pacifism marker following the e8 rook.',
  '107. Prince h4-h3 steps into vacancy; a3 remains the protected King identity.',
  '108. White ends with the same royal square.',
  '109. Nonpacifist Rg8xf8 captures white bishop; e8 pacifist rook is not the mover.',
  '110. Black ends the capture, preserving both distinct rook identities.',
  '111. Ra1-d1 crosses empty b1,c1; royal a3 remains safe behind c3 pawn.',
  '112. White ends; no extra move or card drawn.',
  '113. Confabulation Qd3-h7 crosses empty e4,f5,g6 and merges with own pawn; queen away, h7 composite gains queen powers; draw Man of Straw.',
  '114. Black ends the merge move; no pawn was captured or promoted.',
  '115. b2-b4 crosses empty b3 and sets b3 en passant; royal a3 stays safe.',
  '116. White ends retaining b3 right for Black.',
  '117. Pe2xf1 captures bishop and promotes to knight, keeping original d7 identity; b3 right expires.',
  '118. Black ends with a promoted knight at f1.',
  '119. Rg1xf1 captures that promoted knight; no recapture restriction applies.',
  '120. White ends with rook on f1 and d7 pawn identity captured.',
  '121. Na4-c5 jumps to vacancy; knight does not attack a3 royal.',
  '122. Black ends; White can play a replacement card.',
  '123. Hidden Passage moves actual royal Pa3-e1, not Prince h3; e1 safe from Pacifist Re8 and blocked normal Rf8; draw Bombard.',
  '124. White ends with royal identity at e1, retaining pawn role and Coup.',
  '125. Composite Ph7/Q moves h7-d3 through g6,f5,e4 using queen powers; pawn constituent resets clock.',
  '126. Black ends; d3 composite does not attack e1; c3 pawn attacks b2/d2.',
  '127. Nc6-a7 is a normal empty knight jump; royal e1 remains safe.',
  '128. White ends the fiftieth regular move; Black starts, allowances reset, no unresolved rescue.',
]

test('iteration 074 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/074.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, trace.steps.length)
  rationale.forEach((reason, i) => assert.ok(reason.startsWith(`${i + 1}. `)))
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 18)
  const states = [createGameState(trace.initial)]
  for (const [i, { action }] of trace.steps.entries()) {
    const before = states.at(-1)!
    const result = applyAction(before, action)
    assert.ok(result.ok, rationale[i])
    const after = result.state
    states.push(after)
    if (action.type === 'endTurn') {
      assert.equal(after.fen, before.fen, rationale[i])
      assert.deepEqual(after.pieces, before.pieces, rationale[i])
      assert.deepEqual(after.players, before.players, rationale[i])
      assert.deepEqual(after.turn.cardPlays, { white: 0, black: 0 })
      assert.equal(after.turn.moveMade, false)
      assert.notEqual(after.turn.color, before.turn.color)
    }
    if (action.type === 'playCard') {
      const owner = (['white', 'black'] as const).find(c => before.players[c].hand.some(card => card.id === action.cardInstanceId))!
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(before.turn.phase))
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.equal(after.turn.cardPlays[owner], 1)
      assert.equal(after.players[owner].deck.length, before.players[owner].deck.length - 1)
      assert.deepEqual(after.players[owner].hand, [...before.players[owner].hand.filter(card => card.id !== action.cardInstanceId), before.players[owner].deck[0]])
      assert.equal(after.players[owner].discard.some(card => card.id === action.cardInstanceId), !CARD_CATALOG[action.cardId]!.continuing)
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = before.pieces.find(p => p.square === action.from)!
      const victim = before.pieces.find(p => p.square === action.to)
      const moved = after.pieces.find(p => p.id === mover.id)!
      assert.equal(moved.square, action.to, rationale[i])
      assert.equal(moved.owner, mover.owner)
      assert.equal(moved.royal, mover.royal)
      assert.equal(moved.originalRole, mover.originalRole)
      if (victim) {
        assert.ok(!victim.royal)
        assert.ok(victim.owner !== mover.owner || victim.neutral)
        assert.equal(after.pieces.find(p => p.id === victim.id)!.zone, 'captured')
      }
      assert.deepEqual(after.players.white.hand, before.players.white.hand)
      assert.deepEqual(after.players.black.hand, before.players.black.hand)
      const dx = action.to.charCodeAt(0) - action.from.charCodeAt(0)
      const dy = Number(action.to[1]) - Number(action.from[1])
      const role = i === 124 ? 'queen' : mover.role // h7 is the reviewed Pawn/Queen composite.
      if (role === 'knight') assert.equal(Math.abs(dx) * Math.abs(dy), 2)
      else if (role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1)
      else if (role === 'pawn') {
        assert.equal(dy / Math.abs(dy), mover.owner === 'white' ? 1 : -1)
        assert.equal(Math.abs(dx), victim ? 1 : 0)
        assert.ok(Math.abs(dy) === 1 || !victim && Math.abs(dy) === 2 && /[27]$/.test(action.from))
      } else {
        assert.ok(role === 'bishop' ? Math.abs(dx) === Math.abs(dy) : role === 'rook' ? dx === 0 || dy === 0 : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
      }
      if (role !== 'knight') for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
        const square: string = String.fromCharCode(action.from.charCodeAt(0) + n * Math.sign(dx)) + (Number(action.from[1]) + n * Math.sign(dy))
        assert.ok(!before.pieces.some(p => p.square === square), `${rationale[i]} blocked at ${square}`)
      }
      const clock = before.fen.split(' ')
      assert.equal(Number(after.fen.split(' ')[4]), mover.role === 'pawn' || victim ? 0 : Number(clock[4]) + 1)
      assert.equal(Number(after.fen.split(' ')[5]), Number(clock[5]) + (before.turn.color === 'black' ? 1 : 0))
    }
  }
  const piece = (step: number, id: string) => states[step]!.pieces.find(p => p.id === id)!
  assert.deepEqual(states[26]!.effects, [{ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-pawn-f2' }])
  assert.equal(states[29]!.effects.length, 0)
  for (const id of ['white-knight-g1', 'white-pawn-f2', 'black-pawn-g7']) assert.equal(piece(31, id).zone, 'captured')
  assert.equal(piece(36, 'black-pawn-b7').neutral, true)
  assert.equal(piece(44, 'white-knight-b1').square, 'a4')
  assert.equal(piece(52, 'white-king-e1').zone, 'away')
  assert.equal(piece(56, 'white-king-e1').square, 'h5')
  assert.equal(piece(57, 'white-king-e1').square, 'h5')
  assert.equal(piece(66, 'black-pawn-d7').role, 'pawn')
  assert.equal(piece(66, 'black-pawn-d7').promoted, false)
  assert.ok(states[70]!.pendingRescue)
  assert.deepEqual(states[71]!.pieces, states[69]!.pieces)
  assert.equal(states[71]!.fen, states[69]!.fen)
  assert.ok(states[76]!.pendingRescue)
  assert.equal(piece(77, 'white-king-e1').royal, false)
  assert.equal(piece(77, 'white-pawn-a2').royal, true)
  assert.equal(states[77]!.pendingRescue, null)
  assert.equal(piece(89, 'black-pawn-b7').square, 'f6')
  assert.equal(piece(89, 'black-pawn-b7').neutral, true)
  assert.equal(piece(96, 'black-pawn-b7').zone, 'captured')
  assert.ok(states[96]!.players.white.discard.some(c => c.cardId === 'neutrality'))
  assert.equal(piece(113, 'black-queen-d8').zone, 'away')
  assert.equal(piece(113, 'black-pawn-h7').square, 'h7')
  assert.equal(piece(117, 'black-pawn-d7').role, 'knight')
  assert.equal(piece(117, 'black-pawn-d7').promoted, true)
  assert.equal(piece(119, 'black-pawn-d7').zone, 'captured')
  assert.equal(piece(123, 'white-pawn-a2').square, 'e1')
  assert.equal(piece(123, 'white-pawn-a2').royal, true)
  assert.equal(piece(125, 'black-pawn-h7').square, 'd3')
  assert.equal(piece(125, 'black-queen-d8').zone, 'away')
  const final = replayTrace(trace)
  assert.equal(final.fen, '4rr2/Np6/4kp2/p1n5/1P1P4/2pp2PK/7P/3RPR1P b - - 1 30')
})
