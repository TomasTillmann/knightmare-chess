import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState, PieceState } from '../types.js'

// Each numbered entry is an independent review of that action, in execution order.
// All quiet moves preserve identities and hands, clear old en-passant, and increment
// the halfmove clock; Pawn moves/captures reset it. Black moves increment fullmove.
// Each ordinary endTurn preserves the board/clocks/cards and resets both allowances.
const rationales = [
  '1. b2-b4 crosses empty b3; first-rank Pawn double gives b3 en-passant; e1 safe.',
  '2. White finishes b4; Black receives before-move with b3 opportunity intact.',
  '3. d7-d6 is an empty forward Pawn step; b3 opportunity expires; e8 safe.',
  '4. Black Panic follows d6; 15-second obligation for White, discard and replacement draw.',
  '5. Black ends; Panic persists into White turn without moving pieces.',
  '6. Ng1-f3 is an empty L jump, satisfies and removes Panic; White King stays screened.',
  '7. White closes Nf3; Black allowance resets.',
  '8. Bc8-h3 travels empty d7,e6,f5,g4; h3 empty, e8 remains screened.',
  '9. Black finishes Bh3; no card or board changes.',
  '10. Bc1-a3 travels vacated b2; a3 empty and White King safe.',
  '11. White finishes Ba3; Black may move.',
  '12. Bh3-c8 returns through g4,f5,e6,d7; all empty, no capture.',
  '13. Black closes Bc8; no expired effects remain.',
  '14. c2-c4 crosses empty c3; double-step creates c3 opportunity.',
  '15. White Curse selects enemy Qd8 after c4; mark that identity, retain card and draw Ghostwalk.',
  '16. White ends; Curse and c3 opportunity persist, allowances reset.',
  '17. a7-a5 crosses empty a6; replace c3 with a6 en-passant; Curse only limits Queen.',
  '18. Black closes a5, retaining a6 opportunity.',
  '19. Nf3-h4 jumps to empty h4; a6 expires, e1 safe.',
  '20. White closes Nh4; Curse remains attached to Qd8.',
  '21. b7-b6 empty forward step; Black King stays screened.',
  '22. Black closes b6, White receives ordinary turn.',
  '23. Qd1-c2 is one diagonal to emptied c2; no threat to own King.',
  '24. White closes Qc2 with no expenditure.',
  '25. a5xb4 is Black forward diagonal capture of physical white-pawn-b2; no promotion.',
  '26. Black closes axb4; captured b-Pawn remains captured.',
  '27. Qc2-a4 crosses empty b3; a4 is empty, e1 remains safe.',
  '28. White closes Qa4; no draw for merely ending turn.',
  '29. c7-c6 is an empty forward Pawn step; e8 safe.',
  '30. Black closes c6; Curse unchanged.',
  '31. h2-h3 advances to empty h3, does not displace Nh4.',
  '32. White ends h3 with all card allowances reset.',
  '33. h7-h5 crosses empty h6; h6 en-passant records physical h-Pawn.',
  '34. Black closes h5; h6 opportunity persists.',
  '35. Ba3-b2 is one empty diagonal; h6 opportunity expires.',
  '36. White closes Bb2; Black may act.',
  '37. Ng8-h6 jumps to empty h6; no capture or exposed Black King.',
  '38. Black Truce after Nh6 forbids captures; retained beside board, draw Holy Quest.',
  '39. Black ends; Truce and Curse persist.',
  '40. Qa4-a6 traverses empty a5; quiet move permitted under Truce.',
  '41. White ends Qa6; no King is geometrically checked.',
  '42. Evangelists exchanges Black Bf8 and White Bb2 without capture; ownership preserved; replacement Black move.',
  '43. Black closes Bishop swap; both effects remain, no extra move.',
  '44. Winged Victory returns captured physical White b-Pawn to empty central d5; consumes White move, resets Pawn clock.',
  '45. White closes Pawn return; no actual-move capture trigger.',
  '46. Lost Castle swaps Black Rh8 and White Ra1, preserving owners; revoke K-side Black and Q-side White castling.',
  '47. Black closes Rook swap; replacement move already advanced fullmove.',
  '48. Qa6-a3 passes empty a5,a4; quiet and safe under Truce.',
  '49. White closes Qa3; both Continuing cards remain.',
  '50. Bc8-g4 crosses d7,e6,f5 empty; quiet move does not check Kd1/e1.',
  '51. Black closes Bg4; Truce remains.',
  '52. Ke1-d1 enters empty safe d1; Nb1 blocks Ra1, remove remaining White castling.',
  '53. White closes Kd1; Black receives before-move.',
  '54. Bg4-f5 is one empty diagonal, no capture or check.',
  '55. Black finishes Bf5; Truce retained.',
  '56. Qa3-g3 travels b3,c3,d3,e3,f3 empty; quiet rank move.',
  '57. Plots Within Plots after Qg3 spends and draws once; no movement or clock change; optional extra cards unused.',
  '58. White ends immediately; unused Plots permission expires.',
  '59. Nh6-g4 is an empty L jump; Black King safe.',
  '60. Charge follows quiet move by same physical Knight: g4-e5 empty L jump; no extra clock increment.',
  '61. Black closes Charge; no third move, Truce persists.',
  '62. Rh1-h2 is one empty file step, blocked beyond by h3 but destination legal.',
  '63. White closes Rh2; all board identities unchanged.',
  '64. Bf5-c2 crosses e4,d3; c2 empty, gives check along c2-d1 and terminates Truce by its explicit condition.',
  '65. Black closes checking Bc2; White receives escape turn; Truce discarded without drawing.',
  '66. Kd1-e1 escapes Bc2 diagonal; e1 not attacked, castling does not return.',
  '67. White closes Ke1; Curse still limits Black Queen.',
  '68. Qd8-d7 is one empty file step, within Curse two-square limit; e8 stays safe.',
  '69. Black closes Qd7; Curse follows physical Queen.',
  '70. Rh8-h7 is one empty file step; Black g7-Pawn prevents rank check.',
  '71. White closes Rh7; no card costs.',
  '72. f7-f5 crosses empty f6; physical f-Pawn creates f6 en-passant.',
  '73. Black closes f5; f6 opportunity persists.',
  '74. Ghostwalk moves c4-c5 to empty square, ordinary forward Pawn geometry; no obstruction needed, consumes White move and clears f6.',
  '75. White closes Ghostwalk; card already discarded and Vendetta drawn.',
  '76. c6xd5 captures returned physical white-pawn-b2 by forward diagonal; no promotion.',
  '77. Cowardice moves opponent unpromoted d2-Pawn one backward to empty d1; no promotion, no extra clock change.',
  '78. Black closes Cowardice; White d-Pawn retains identity on first rank.',
  '79. Nh4-f3 is empty L jump; e1 safe even with Pawn now on d1.',
  '80. Fireball centered on just-moved Nf3 captures f3,g3,e2,f2,g2 occupants only; h3,Rh2,K e1 outside blast, own King remains safe.',
  '81. White closes Fireball; five physical victims remain captured and halfmove zero.',
  '82. b6-b5 advances to empty b5; other black Pawn b4 does not block destination.',
  '83. Black closes b5; no en-passant created for single step.',
  '84. Nb1-c3 is empty L jump; vacating b1 leaves d1 Pawn blocking Ra1 from Ke1.',
  '85. White closes Nc3; King shield on d1 still present.',
  '86. Ra1xd1 crosses vacant b1,c1 and captures white-pawn-d2; Black King safe, Rook checks Ke1.',
  '87. Riposte immediately restores physical d-Pawn at d1 and captures nonroyal non-Queen attacker Rh8; cures check and owes White one move.',
  '88. Black ends; White next Regular Move automatically forfeited, halfmove increments once, phase becomes afterMove and card allowances reset.',
  '89. White closes forfeiture without moving or playing a card; Black receives normal move.',
  '90. Bb2-c1 is one empty diagonal; Ke1 is not on its diagonals.',
  '91. Forbidden City selects now-empty g3 after Black move; marker retained and Peace Talks drawn.',
  '92. Black closes; g3 remains forbidden without changing FEN board.',
  '93. Bf8xe7 captures black-pawn-e7 by one diagonal; White King remains safe.',
  '94. White closes capture; captured e-Pawn stays captured.',
  '95. Bc2-b1 is one empty diagonal; no move through forbidden g3.',
  '96. Black closes Bb1; board safe for White to act.',
  '97. a2-a4 crosses empty a3; Black b4-Pawn can en-passant so FEN includes a3.',
  '98. White closes a4; a3 opportunity persists for Black.',
  '99. Qd7xe7 captures white-bishop-c1 one square horizontally, within Curse; a3 opportunity expires.',
  '100. Black closes Qxe7; Curse caps Queen threat so distant e1 not checked.',
  '101. Nc3-a2 jumps to emptied a2; no forbidden endpoint, own King safe.',
  '102. White closes Na2; Black may move.',
  '103. Ke8-f8 is one empty safe step, neither Rh7 nor Bf1 attacks f8; revoke Black remaining castling.',
  '104. Black closes Kf8; castling remains absent.',
  '105. Rh2-c2 crosses g2,f2,e2,d2 all empty; g3 wall is outside path.',
  '106. White closes Rc2; Black King remains safe.',
  '107. Kf8-e8 is one empty safe step; castling rights stay absent.',
  '108. Black closes Ke8; no board effect.',
  '109. Rh7-h6 is an empty file step, no own-King exposure.',
  '110. White closes Rh6; opponent allowance resets.',
  '111. Qe7-f7 is one empty horizontal step within Curse; no capture.',
  '112. Chaos immediately rewinds Qe7-f7, both clocks and Black before-move; White spends/draws once and exact rejected move cannot repeat.',
  '113. Ne5-g4 is a different legal L jump after Chaos; does not enter g3; Curse suppresses long Qe7-e1 check after e5 vacates.',
  '114. Black closes replacement Ng4; White response allowance resets.',
  '115. a4xb5 captures black-pawn-b7 one forward diagonal; c5 White Pawn unaffected.',
  '116. White closes axb5; no automatic draw.',
  '117. b4-b3 is one empty Black forward step; attacks a2,c2 but not Ke1.',
  '118. Black closes fiftieth regular command; White before-move, clocks 0/28, effects Curse and Forbidden City only.',
]

const coordinates = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const

// Independent geometry from the physical board; no reducer destinations or threat API.
function reaches(state: GameState, piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square)
  const [x, y] = coordinates(piece.square), [tx, ty] = coordinates(to)
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy)
  const effects = state.effects as Array<{ type: string; pieceId?: string; square?: string }>
  if (effects.some(e => e.type === 'forbidden-city' && e.square === to)) return false
  if (effects.some(e => e.type === 'curse' && e.pieceId === piece.id) && Math.max(ax, ay) > 2) return false
  const direction = piece.owner === 'white' ? 1 : -1
  const geometry = piece.role === 'pawn' ? capture ? ax === 1 && dy === direction
    : dx === 0 && (dy === direction || dy === 2 * direction && (y === 1 || y === 6))
    : piece.role === 'knight' ? ax * ay === 2
    : piece.role === 'king' ? Math.max(ax, ay) === 1
    : piece.role === 'bishop' ? ax === ay
    : piece.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0
  if (!geometry || !dx && !dy) return false
  if (piece.role === 'knight') return true
  for (let i = 1; i < Math.max(ax, ay); i++) {
    const sq = String.fromCharCode(97 + x + Math.sign(dx) * i) + (y + Math.sign(dy) * i + 1)
    if (state.pieces.some(p => p.square === sq) || effects.some(e => e.type === 'forbidden-city' && e.square === sq)) return false
  }
  return true
}

function safe(state: GameState, color: 'white' | 'black'): boolean {
  if (state.effects.some(e => (e as { type: string }).type === 'truce')) return true
  const king = state.pieces.find(p => p.owner === color && p.royal)!
  return !state.pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(state, p, king.square!, true))
}

test('iteration 042 independently reviewed random campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/042.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860042)
  assert.equal(rationales.length, 118)
  assert.equal(trace.steps.length, rationales.length)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 14)
  let state = createGameState(trace.initial)
  const states = [state]
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, reason = rationales[index]!
    assert.ok(reason.startsWith(`${step}.`))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, reason)
    state = result.state
    const expectedPieces = structuredClone(before.pieces)
    const relocate = (id: string, square: string | null) => {
      const p = expectedPieces.find(p => p.id === id)!
      if (square !== null) assert.match(square, /^[a-h][1-8]$/)
      p.square = square as PieceState['square']; p.zone = square === null ? 'captured' : 'board'
      if (square === null) p.capturedBy = step === 87 ? 'white' : before.turn.color
      else delete p.capturedBy
    }
    let half = Number(before.fen.split(' ')[4]), full = Number(before.fen.split(' ')[5])
    let fenColor = before.fen.split(' ')[1], rights = before.fen.split(' ')[2]
    let ep: Array<{ target: string; pawnId: string }> = structuredClone(before.enPassant)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      const mover = before.pieces.find(p => p.square === from)!
      const victim = before.pieces.find(p => p.square === to)
      assert.equal(mover.owner, before.turn.color, reason)
      assert.ok(reaches(before, mover, to, !!victim), reason)
      if (victim) {
        assert.notEqual(victim.owner, mover.owner, reason)
        assert.equal(victim.royal, false, reason)
        assert.ok(!before.effects.some(e => (e as { type: string }).type === 'truce'), reason)
        relocate(victim.id, null)
      }
      relocate(mover.id, to)
      half = mover.role === 'pawn' || victim ? 0 : half + 1
      full += mover.owner === 'black' ? 1 : 0
      fenColor = mover.owner === 'white' ? 'b' : 'w'
      ep = mover.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2
        ? [{ target: from[0]! + (Number(from[1]) + Number(to[1])) / 2, pawnId: mover.id }] : []
      if (mover.royal) rights = mover.owner === 'white' ? rights!.replace(/[KQ]/g, '') : rights!.replace(/[kq]/g, '')
    }
    if (step === 42) { relocate('white-bishop-c1', 'f8'); relocate('black-bishop-f8', 'b2'); half++; full++; fenColor = 'w'; ep = [] }
    if (step === 44) { relocate('white-pawn-b2', 'd5'); half = 0; fenColor = 'b'; ep = [] }
    if (step === 46) { relocate('white-rook-a1', 'h8'); relocate('black-rook-h8', 'a1'); half++; full++; fenColor = 'w'; rights = 'Kq'; ep = [] }
    if (step === 60) relocate('black-knight-g8', 'e5')
    if (step === 74) { relocate('white-pawn-c2', 'c5'); half = 0; fenColor = 'b'; ep = [] }
    if (step === 77) relocate('white-pawn-d2', 'd1')
    if (step === 80) {
      for (const id of ['white-queen-d1', 'white-knight-g1', 'white-pawn-e2', 'white-pawn-f2', 'white-pawn-g2']) relocate(id, null)
      half = 0
    }
    if (step === 87) { relocate('white-pawn-d2', 'd1'); relocate('black-rook-h8', null); half = 0; ep = [] }
    if (step === 88) { half++; fenColor = 'b'; ep = [] }
    if (step === 112) {
      relocate('black-queen-d8', 'e7')
      half = 5; full = 26; fenColor = 'b'; ep = []
      assert.deepEqual(expectedPieces, states[110]!.pieces, reason)
    }
    assert.deepEqual(state.pieces, expectedPieces, reason)
    assert.equal(state.fen.split(' ').slice(1).filter((_, i) => i !== 2).join(' '), [fenColor, rights || '-', half, full].join(' '), reason)
    assert.deepEqual(state.enPassant, ep, reason)
    const effects: unknown[] = []
    if (step >= 4 && step < 6) effects.push({ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 })
    if (step >= 15) effects.push({ type: 'curse', owner: 'white', card: { id: 'white-hand-3-curse', cardId: 'curse' }, pieceId: 'black-queen-d8' })
    if (step >= 38 && step < 64) effects.push({ type: 'truce', owner: 'black', card: { id: 'black-hand-2-truce', cardId: 'truce' } })
    if (step >= 91) effects.push({ type: 'forbidden-city', owner: 'black', card: { id: 'black-deck-3-forbidden-city', cardId: 'forbidden-city' }, square: 'g3' })
    assert.deepEqual(state.effects, effects, reason)
    for (const color of ['white', 'black'] as const) {
      const player = structuredClone(before.players[color])
      if (action.type === 'playCard') {
        const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId)
        if (cardIndex >= 0) {
          const [card] = player.hand.splice(cardIndex, 1)
          assert.equal(before.turn.cardPlays[color], 0, reason)
          player.hand.push(player.deck.shift()!)
          if (!['curse', 'truce', 'forbidden-city'].includes(action.cardId)) player.discard.push(card!)
        }
      }
      if (step === 64 && color === 'black') player.discard.push({ id: 'black-hand-2-truce', cardId: 'truce' })
      assert.deepEqual(state.players[color], player, reason)
    }
    const expectedTurn = structuredClone(before.turn)
    if (action.type === 'endTurn') {
      expectedTurn.color = before.turn.color === 'white' ? 'black' : 'white'
      expectedTurn.phase = step === 88 ? 'afterMove' : 'beforeMove'
      expectedTurn.moveMade = step === 88
      expectedTurn.cardPlays = { white: 0, black: 0 }
    } else if (action.type === 'move' || [42,44,46,74].includes(step)) {
      expectedTurn.phase = 'afterMove'; expectedTurn.moveMade = true
    }
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      expectedTurn.cardPlays[owner]++
      if (step === 112) { expectedTurn.phase = 'beforeMove'; expectedTurn.moveMade = false }
    }
    assert.deepEqual(state.turn, expectedTurn, reason)
    if (action.type === 'move' || action.type === 'playCard') assert.ok(safe(state, before.turn.color), reason)
    assert.ok(!state.pendingRescue && !state.outcome, reason)
    states.push(state)
  }
  assert.equal(state.fen, 'rn2k3/4q1p1/3p3R/1PPp1p1p/6n1/1p5P/N1R5/1bbPKB2 w - - 0 28')
  assert.equal(replayTrace(trace).fen, state.fen)
})
