import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// In order, reviewed against rules §§6–11, 14.3, 15.1/15.3, 16.3, 17.1,
// 22.7 and cards.md; catalog supplies printed timing and classification.
const rationales = [
  '1. h2-h4: initial Pawn double step through empty h3; h3 EP opportunity.',
  '2. Coup after White move: f2 Pawn becomes royal; e1 becomes capturable Prince; retain effect and draw Think Again.',
  '3. End White turn: reset allowances, Black to move; preserve h3 EP.',
  '4. h7-h5: double step through empty h6; replace EP and advance Black fullmove.',
  '5. Think Again reacts: undo h7-h5 and its clocks/EP; White spends/draws Dark Mirror; Black must choose another move.',
  '6. g8-h6: Knight jump is different replacement; clear EP, increment quiet clock.',
  '7. End Black turn: White resumes with both card allowances reset.',
  '8. e2-e3: one forward Pawn step, empty destination; reset halfmove.',
  '9. Chaos reacts: restore e2 and preceding clocks; Black discards/draws Crusade; prohibit e2-e3 replacement.',
  '10. h4-h5: different Pawn advances to empty h5 and satisfies replacement restriction.',
  '11. End White turn: Black begins and allowances reset.',
  '12. c7-c5: initial double step through c6; establish c6 EP.',
  '13. End Black turn: White begins, c6 EP retained.',
  '14. a2-a4: initial double step through a3; replace EP with a3.',
  '15. End White turn: Black begins, a3 EP retained.',
  '16. h6-f5: Knight jump to empty square; clear EP.',
  '17. End Black turn: White begins without changing board or clocks.',
  '18. c2-c4: initial double step through empty c3; c3 EP.',
  '19. End White turn: Black begins, c3 EP retained.',
  '20. h8-g8: adjacent horizontal Rook move; revoke Black kingside castling.',
  '21. End Black turn: White begins; preserve remaining rights.',
  '22. a4-a5: quiet single Pawn advance; clear EP and reset halfmove.',
  '23. End White turn: Black begins.',
  '24. h7-h6: single Pawn step to empty h6; increment fullmove.',
  '25. End Black turn: White begins.',
  '26. e2-e4: double step through empty e3; e3 EP.',
  '27. End White turn: Black begins, e3 EP retained.',
  '28. b8-a6: Knight jump to empty a6; clear EP.',
  '29. End Black turn: White begins.',
  '30. b1-c3: Knight jump to empty c3; increment quiet clock.',
  '31. End White turn: Black begins.',
  '32. f5-d4: Knight jump to empty d4; no royal attacked.',
  '33. End Black turn: White begins.',
  '34. c3-a4: Knight jump to empty a4.',
  '35. Haunting Memories copies latest card Chaos, which is nonunique: undo c3-a4; spend physical copy and draw Truce.',
  '36. a1-a4: Rook traverses empty a2/a3; different replacement; revoke White queenside castling.',
  '37. Rebirth after White move: enemy a7 Pawn relocates to vacant legal initial Pawn square c7; no capture or clock advance; draw Mystic Shield.',
  '38. End White turn: Black begins; Rebirth relocation persists.',
  '39. b7-b5: double step through b6; a5 Pawn can capture EP, so FEN records b6.',
  '40. End Black turn: White begins, b6 EP retained.',
  '41. h1-h3: Rook traverses empty h2; revoke last White castling right and clear EP.',
  '42. End White turn: Black begins.',
  '43. d7-d6: single Pawn advance to vacant d6.',
  '44. End Black turn: White begins.',
  '45. h3-e3: Rook crosses empty g3/f3; no capture.',
  '46. End White turn: Black begins.',
  '47. a8-b8: adjacent Rook move; revoke final Black castling right.',
  '48. End Black turn: White begins; no castling rights remain.',
  '49. b2-b4: double step through empty b3; record b3 EP.',
  '50. Mystic Shield marks just-moved nonroyal b4 Pawn for next Black turn; discard/draw Forbidden City, preserve clocks and EP.',
  '51. End White turn: Black begins with b4 protected.',
  '52. c8-h3: Bishop crosses empty d7/e6/f5/g4; no capture of protected Pawn.',
  '53. End Black turn: Mystic Shield expires; White begins.',
  '54. e3-f3: adjacent Rook move to empty f3.',
  '55. End White turn: Black begins.',
  '56. f7-f5: double Pawn step through f6; f6 EP.',
  '57. End Black turn: White begins, f6 EP retained.',
  '58. a4-a1: Rook crosses empty a3/a2; old castling rights stay lost.',
  '59. End White turn: Black begins.',
  '60. e8-f7: King diagonal step to safe vacant f7; white Rook f3 ray stops at Black Pawn f5.',
  '61. End Black turn: White begins.',
  '62. f1-d3: Bishop traverses empty e2 to vacant d3.',
  '63. End White turn: Black begins.',
  '64. h3xg2: Bishop captures White g2 Pawn; physical victim capturedBy Black, clock reset.',
  '65. End Black turn: White begins with g2 Pawn captured.',
  '66. c1-b2: Bishop moves diagonally to vacant b2.',
  '67. Neutrality after White move: opposing nonroyal d6 Pawn becomes neutral without moving; retain card/draw Dungeon.',
  '68. End White turn: Black begins; neutral Pawn retains Black forward direction.',
  '69. d4-e2: Knight jumps to empty e2; e1 is a Prince, f2 is the royal Pawn.',
  '70. End Black turn: White begins.',
  '71. d1-b1: Queen crosses empty c1; no capture.',
  '72. End White turn: Black begins.',
  '73. b8-b7: Rook steps down to empty b7.',
  '74. End Black turn: White begins.',
  '75. a1-a2: Rook steps up to empty a2.',
  '76. End White turn: Black begins.',
  '77. g2-h3: Bishop returns diagonally to empty h3.',
  '78. End Black turn: White begins.',
  '79. f3-e3: Rook steps horizontally to empty e3.',
  '80. End White turn: Black begins.',
  '81. e2xc3: Knight captures White b1 physical Knight; victim capturedBy Black.',
  '82. End Black turn: White begins.',
  '83. b1-a1: Queen steps horizontally to empty a1.',
  '84. End White turn: Black begins.',
  '85. e7xd6: Black Pawn may capture neutral Black-owned Pawn; captor Black; expire/discard White Neutrality and clear neutral metadata.',
  '86. End Black turn: White begins; captured d7 Pawn stays Black-owned and nonneutral.',
  '87. Madman replaces move: White e4 Pawn jumps diagonally over own d3 Bishop to empty c2; Bishop survives; Pawn clock resets; draw Heresy.',
  '88. End White turn: Black begins after replacement move.',
  '89. h3-f1: Bishop traverses empty g2 to vacant f1.',
  '90. End Black turn: White begins.',
  '91. e3-e4: Rook steps forward to empty e4.',
  '92. End White turn: Black begins.',
  '93. c3-d1: Knight jump checks royal Pawn f2; e1 Prince is not the checked King.',
  '94. End Black turn: White receives its checked turn; Qa1xd1 is available.',
  '95. b4xc5: geometric Pawn capture leaves Knight d1 check; only provisional under §11.6 with pending same-turn rescue, never a completed legal turn.',
  '96. Forbidden City at empty d5 cannot stop jumping Nd1-f2: fizzle and spend/draw Curse; unsuccessful rescue takes back provisional b4xc5, including victim and clocks.',
  '97. a1xd1: Queen crosses empty b1/c1 and captures checking Knight; victim capturedBy White, royal f2 safe.',
  '98. End White turn: Black begins; failed rescue card stays spent.',
  '99. d8-c8: Queen steps horizontally to empty c8.',
  '100. End Black turn: White begins.',
  '101. g1-h3: Knight jumps to empty h3.',
  '102. End White turn: Black begins.',
  '103. g8-h8: Rook returns to empty h8 without recovering castling rights.',
  '104. End Black turn: White begins.',
  '105. e4-d4: Rook steps horizontally to empty d4; both royals safe.',
  '106. End White turn: Black begins; final halfmove 4/fullmove 24, no EP.',
]

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
function reaches(piece: PieceState, square: string, pieces: PieceState[]): boolean {
  assert.ok(piece.square)
  const [x, y] = xy(piece.square), [tx, ty] = xy(square)
  const dx = tx - x, dy = ty - y
  if (piece.role === 'pawn') return Math.abs(dx) === 1 && dy === (piece.owner === 'white' ? 1 : -1)
  if (piece.role === 'knight') return Math.abs(dx * dy) === 2
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0
  if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    if (pieces.some(p => p.square === `${String.fromCharCode(97 + x + n * Math.sign(dx))}${y + n * Math.sign(dy) + 1}`)) return false
  }
  return true
}

test('iteration 112: independent ordered physical, card, clock and royal review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/112.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.steps.length, 106)
  assert.equal(rationales.length, trace.steps.length)
  rationales.forEach((reason, i) => assert.ok(reason.startsWith(`${i + 1}. `)))
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 9)
  let state = createGameState(trace.initial)
  const expected = structuredClone(state)
  const snapshots: GameState[] = []
  let rights = 'KQkq', halfmove = 0, fullmove = 1, active: Color = 'white'
  const clockSnapshots: Array<{ rights: string; halfmove: number; fullmove: number; active: Color }> = []
  const at = (square: string) => expected.pieces.find(p => p.square === square)!
  const spend = (owner: Color, id: string, retain: boolean) => {
    const player = expected.players[owner]
    const index = player.hand.findIndex(card => card.id === id)
    assert.ok(index >= 0)
    const [card] = player.hand.splice(index, 1)
    if (!retain) player.discard.push(card!)
    player.hand.push(player.deck.shift()!)
    expected.turn.cardPlays[owner]++
    return card!
  }
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1
    snapshots.push(structuredClone(expected))
    clockSnapshots.push({ rights, halfmove, fullmove, active })
    const actor = expected.turn.color
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.to, /^[a-h][1-8]$/)
      const piece = at(action.from), victim = at(action.to)
      assert.ok(piece && (piece.owner === actor || piece.neutral), rationales[index])
      const [x, y] = xy(action.from), [tx, ty] = xy(action.to)
      if (piece.role === 'pawn' && !victim) {
        assert.equal(x, tx)
        const distance = (ty - y) * (piece.owner === 'white' ? 1 : -1)
        assert.ok(distance === 1 || distance === 2 && y === (piece.owner === 'white' ? 1 : 6))
        if (distance === 2) assert.equal(at(`${action.from[0]}${(y + ty) / 2 + 1}`), undefined)
      } else assert.ok(reaches(piece, action.to, expected.pieces), rationales[index])
      if (victim) {
        assert.ok(!victim.royal && (victim.owner !== actor || victim.neutral))
        victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor
        if (n === 85) {
          victim.neutral = false; delete victim.neutralBeforeEffects
          expected.effects.pop()
          expected.players.white.discard.push({ id: 'white-hand-1-neutrality', cardId: 'neutrality' })
        }
      }
      expected.enPassant = piece.role === 'pawn' && x === tx && Math.abs(y - ty) === 2
        ? [{ target: `${action.from[0]}${(y + ty) / 2 + 1}` as SquareName, pawnId: piece.id }] : []
      piece.square = action.to as SquareName
      for (const [id, flag] of [['white-rook-a1', 'Q'], ['white-rook-h1', 'K'], ['black-rook-a8', 'q'], ['black-rook-h8', 'k']]) {
        if (piece.id === id || victim?.id === id) rights = rights.replace(flag!, '')
      }
      if (piece.royal && piece.originalRole === 'king') rights = rights.replace(piece.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      halfmove = piece.role === 'pawn' || victim ? 0 : halfmove + 1
      if (actor === 'black') fullmove++
      active = opposite(actor)
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
    } else if (action.type === 'endTurn') {
      expected.turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      if (n === 53) expected.effects.pop()
    } else {
      assert.equal(action.type, 'playCard')
      if (action.type !== 'playCard') throw new Error('unexpected action')
      assert.equal(typeof action.cardInstanceId, 'string')
      const owner: Color = (action.cardInstanceId as string).startsWith('white-') ? 'white' : 'black'
      const rewind = ({ 5: 4, 9: 8, 35: 34, 96: 95 } as Record<number, number>)[n]
      if (rewind) {
        const snapshot = snapshots[rewind - 1]!
        expected.pieces = structuredClone(snapshot.pieces)
        expected.effects = structuredClone(snapshot.effects)
        expected.enPassant = structuredClone(snapshot.enPassant)
        expected.turn.phase = 'beforeMove'; expected.turn.moveMade = false
        ;({ rights, halfmove, fullmove, active } = clockSnapshots[rewind - 1]!)
      }
      const card = spend(owner, action.cardInstanceId as string, n === 2 || n === 67)
      if (n === 2) {
        at('e1').royal = false; at('f2').royal = true
        expected.effects.push({ type: 'coup', owner, card, princeId: 'white-king-e1', kingId: 'white-pawn-f2', princeRole: 'king' })
      } else if (n === 37) {
        assert.equal(at('c7'), undefined); at('a7').square = 'c7'
      } else if (n === 50) {
        expected.effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'white-pawn-b2' })
      } else if (n === 67) {
        at('d6').neutral = true; at('d6').neutralBeforeEffects = false
        expected.effects.push({ type: 'neutrality', owner, card, pieceId: 'black-pawn-d7' })
      } else if (n === 87) {
        assert.equal(at('d3').id, 'white-bishop-f1'); assert.equal(at('c2'), undefined)
        at('e4').square = 'c2'; expected.enPassant = []; halfmove = 0; active = 'black'
        expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
      } else assert.ok(rewind, 'all card actions explicitly reviewed')
    }
    const rows: string[] = []
    for (let rank = 8; rank >= 1; rank--) {
      let row = '', empty = 0
      for (const file of 'abcdefgh') {
        const piece = at(`${file}${rank}`)
        if (!piece) { empty++; continue }
        if (empty) { row += empty; empty = 0 }
        const letter = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' } as const)[piece.role]
        row += piece.owner === 'white' ? letter.toUpperCase() : letter
      }
      rows.push(row + (empty || ''))
    }
    // Only b7-b5 has an adjacent enemy Pawn in this trace; other EP remains physical metadata.
    const ep = n === 39 || n === 40 ? 'b6' : '-'
    expected.fen = `${rows.join('/')} ${active[0]} ${rights || '-'} ${ep} ${halfmove} ${fullmove}`
    const before = structuredClone(state)
    const result = applyAction(state, action)
    assert.deepEqual(state, before, `action ${n}: complete input including capturedBy is immutable`)
    assert.ok(result.ok, rationales[index])
    state = result.state
    assert.deepEqual(state.pieces, expected.pieces, `action ${n}: complete physical records and capture actors`)
    assert.deepEqual(state.effects, expected.effects, `action ${n}: complete effects`)
    assert.deepEqual(state.players, expected.players, `action ${n}: all card identities and ordered zones`)
    assert.deepEqual(state.turn, expected.turn, `action ${n}: actor, phase, move and allowances`)
    assert.deepEqual(state.enPassant, expected.enPassant, `action ${n}: physical EP`)
    assert.equal(state.fen, expected.fen, `action ${n}: independently reconstructed FEN and clocks`)
    assert.equal(state.orientation, 0)
    assert.equal(state.outcome, null)
    assert.equal(!!state.pendingRescue, n === 95, `action ${n}: provisional rescue obligation`)
    assert.ok(!state.pendingAbduction && !state.pendingDoomsayer && !state.underElfHill?.length)
    for (const color of ['white', 'black'] as const) {
      const royals = expected.pieces.filter(p => p.royal && p.owner === color)
      assert.equal(royals.length, 1)
      const royal = royals[0]!
      const attackers = expected.pieces.filter(p => p.zone === 'board' && p.id !== royal.id
        && (p.owner !== color || p.neutral) && reaches(p, royal.square!, expected.pieces))
      // Neutral d6 has no geometric royal target throughout its lifetime; no pinned-neutral ambiguity.
      assert.deepEqual(attackers.map(p => p.id), color === 'white' && n >= 93 && n <= 96 ? ['black-knight-g8'] : [], `action ${n}: independent royal attacks`)
    }
  }
  assert.equal(state.fen, '2q2b1r/1rp2kp1/n2p3p/Ppp2p1P/1PPR4/3B3N/RBPP1P2/3QKb2 b - - 4 24')
  assert.equal(replayTrace(trace).fen, state.fen)
})
