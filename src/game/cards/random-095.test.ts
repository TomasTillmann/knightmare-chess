import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { attacks } from 'chessops/attacks'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState } from '../types.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

const rationale = [
  '1. h2-h3: white pawn advances into empty h3; reset pawn clock.',
  '2. White closes its move; Black begins, board and cards unchanged.',
  '3. f7-f5: starting pawn traverses empty f6; f6 en-passant opportunity.',
  '4. Black closes; f6 opportunity survives for White.',
  '5. b2-b4: empty b3 and b4; replace old opportunity with b3.',
  '6. White closes; Black receives b3 opportunity.',
  '7. h7-h6: single forward step; previous en-passant expires.',
  '8. Black closes with no card expenditure.',
  '9. f2-f4: clear f3 and f4; record f3 opportunity.',
  '10. White closes; board and f3 opportunity preserved.',
  '11. d7-d6: empty forward square; clear f3 opportunity.',
  '12. Black closes; no physical change.',
  '13. a2-a4: empty a3 and a4; new a3 opportunity.',
  '14. White closes; preserve a3 opportunity.',
  '15. c8-d7: bishop diagonal into vacated pawn square; expire en-passant.',
  '16. Black closes; no physical change.',
  '17. Dubbing: g2-e3 is a Knight jump to empty e3, pawn identity retained; replace move, discard and draw Neutrality.',
  '18. White closes; reset card allowances for Black.',
  '19. g7-g5: empty g6 and g5; new g6 opportunity.',
  '20. Black closes; retain g6 opportunity.',
  '21. d2-d4: empty d3 and d4; replace opportunity with d3.',
  '22. Neutrality after move marks opposing a8 rook; retain card, draw Long Jump, preserve d3 and clocks.',
  '23. White closes; neutral marker persists.',
  '24. e7-e6: single empty forward square; clear d3 opportunity.',
  '25. Black closes without another change.',
  '26. c1-b2: bishop diagonal into empty b2.',
  '27. White closes without another change.',
  '28. e6-e5: pawn advances to empty e5.',
  '29. Black closes without another change.',
  '30. White controls neutral a8 rook to capture black b8 Knight; captor White, revoke black queenside castling.',
  '31. Panic after White move targets Black next move for 15000 ms; discard and draw Lost Castle.',
  '32. White closes; Panic remains due on Black.',
  '33. Panic timeout skips Black turn, removes timer, increments halfmove and fullmove once.',
  '34. Long Jump b1-c3 changes square color and lands empty; replace move, discard and draw Riposte.',
  '35. White closes; Black receives normal move.',
  '36. b7-b6: empty forward square.',
  '37. Black Neutrality may target already-neutral b8 rook; second independent marker retained, draw Squaring the Circle.',
  '38. Black closes; both neutral markers remain.',
  '39. c3-d5: ordinary Knight jump to empty d5.',
  '40. White closes without changes.',
  '41. g5xf4: black pawn captures white f-pawn diagonally; captor Black.',
  '42. Riposte reacts to ordinary capture: restore f-pawn on f4 without captor, capture g-pawn for White; draw Fortification, owe White next move.',
  '43. Black closes; consume White forfeited move once, open afterMove and increment halfmove.',
  '44. White closes forfeited turn; Black gets normal move.',
  '45. Fanatic c7-c4: c6,c5,c4 empty; no capture or en-passant, discard and draw Guardian.',
  '46. Black closes after replacement move.',
  '47. d1-d2: queen steps to empty d2.',
  '48. White closes without change.',
  '49. Squaring the Circle: a1,h1,h8 occupied, a8 empty; move f8 bishop to a8, discard and draw Chaos.',
  '50. Black closes replacement move.',
  '51. d2-c1: queen diagonal to empty c1.',
  '52. White closes without change.',
  '53. b6-b5: pawn forward into empty b5.',
  '54. Crab after move transforms own b5 pawn movement; retain physical card, draw Forbidden City.',
  '55. Black closes; Crab persists.',
  '56. a1-a2: rook steps to empty a2 and loses White queenside castling.',
  '57. White closes without change.',
  '58. a7-a5: starting pawn traverses empty a6; record a6 opportunity.',
  '59. Black closes; a6 remains available.',
  '60. Irresistible Force pushes d4 pawn,d5 Knight,d6 pawn,d7 bishop upward; d8 Queen pushed off and captured by White, clears en-passant, draws Haunting Memories; Knight checks e8.',
  '61. White closes; checked Black receives reply.',
  '62. e8-e7: King escapes Knight d6 attack to unattacked e7; revoke Black castling.',
  '63. Black closes safely.',
  '64. Haunting Memories copies last nonunique Irresistible Force: f4 pawn pushes f5 pawn to empty f6; no capture, draw Earthquake.',
  '65. White closes replacement move.',
  '66. b5xa4: black Crab takes one forward diagonal and captures white a-pawn for Black.',
  '67. Black closes; Crab follows physical pawn to a4.',
  '68. d6-e8: Knight jump into empty e8.',
  '69. White closes without change.',
  '70. e7-f7: King steps to unattacked f7.',
  '71. Anathema after move swaps opposing b2 bishop and a2 rook without capture; draw Dungeon, preserve clocks.',
  '72. Black closes safely.',
  '73. d5-d6: pawn advances into empty d6.',
  '74. White closes without change.',
  '75. Black controls neutral b8-b6 rook through empty b7; neither royal attacked.',
  '76. Black closes without change.',
  '77. White controls neutral b6-b5 rook into empty b5.',
  '78. White closes without change.',
  '79. f7-g6 enters white f5 pawn attack; provisional move opens same-turn rescue under 11.6.',
  '80. Forbidden City h4 cannot prevent f5xg6: spend/discard/draw Panic, no wall; rewind illegal King move to f7 and restore pre-move clocks.',
  '81. a8-e4: bishop traverses empty b7,c6,d5, lands empty e4; spent card allowance persists.',
  '82. Black closes legal replacement move.',
  '83. b2-b3: white rook steps into empty b3.',
  '84. White closes without change.',
  '85. e4-d5: black bishop steps diagonally into empty d5.',
  '86. Black closes without change.',
  '87. c1-a3: queen traverses empty b2 to empty a3; eligible two-square slider response.',
  '88. Bog truncates queen move to first square b2; no capture, retain completed move clocks, discard and draw Toll.',
  '89. White closes after Bog response.',
  '90. Guardian h6-h5 replaces move; h7 has no follower and h5 is empty; clear en-passant, discard and draw Cathedral.',
  '91. Black closes replacement move.',
  '92. White controls neutral b5-c5 rook into empty c5.',
  '93. White closes without change.',
  '94. Black controls neutral c5xa5 through b5; captures own a-pawn, actual captor Black.',
  '95. Cathedral after move swaps neutral a5 rook with own d5 bishop; marker follows rook, no capture, draw Man of Straw.',
  '96. Black closes without change.',
  '97. Lost Castle replaces White move: exchange white b3 rook and black h8 rook preserving identities; draw Resurrection.',
  '98. White closes replacement move.',
  '99. f7-g6 again enters f5 pawn attack; pending same-turn rescue.',
  '100. Dungeon relocates opposing attacking f5 pawn to empty corner a1, curing g6 check; pawn frozen through White turn, discard and draw Breakthrough.',
  '101. Black closes safe King position; Dungeon remains.',
  '102. h3-h4: unrelated white pawn moves forward while a1 pawn remains frozen.',
  '103. Chaos cancels h3-h4: restore h3 and clocks, keep Dungeon, forbid same move this turn, discard and draw Knightmare.',
  '104. Resurrection uses White free card/move allowance: captured a-pawn returns to empty starting rank d2, clears captor, draw Vulture.',
  '105. White closes; Dungeon restriction expires after exactly White turn.',
  '106. b3-d3: black rook traverses empty c3 to empty d3.',
  '107. Black closes without change.',
  '108. c2xd3: white pawn captures black rook diagonally; captor White.',
  '109. White closes without change.',
  '110. g8-e7: black Knight jumps to empty e7.',
  '111. Black closes without change.',
  '112. h3-h4: white pawn advance is legal on later turn; Chaos prohibition has expired.',
  '113. White closes without change.',
  '114. a5xb4: black bishop captures white b-pawn on adjacent diagonal; captor Black.',
  '115. Black closes; d2 pawn blocks b4-c3-d2-e1 bishop ray.',
  '116. e1-d1: King moves to safe d1; d3 and d2 pawns block neutral rook d5 along file; revoke White castling.',
  '117. White closes safe King move.',
  '118. d8-c7: black bishop diagonal to empty c7.',
  '119. Black closes without change.',
  '120. b2-c3: white queen diagonal to empty c3.',
  '121. White closes without change.',
  '122. b4-c5: black bishop diagonal to empty c5.',
  '123. Black closes without change.',
  '124. White controls neutral d5xd6 rook and captures own d-pawn for White; f6 black pawn blocks rook d6-e6-f6-g6 royal ray.',
  '125. White closes without change.',
  '126. c7-a5: black bishop crosses empty b6 and lands empty a5.',
  '127. Black closes without change.',
  '128. f1-h3: bishop passes empty g2 to empty h3; neither royal endangered.',
  '129. White closes fiftieth regular move; Black beforeMove, three continuing cards remain.',
]

test('iteration 095 independent sequential review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/095.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, 129)
  assert.equal(rationale.length, trace.steps.length)
  let state = createGameState(trace.initial)
  const captures: Record<number, [string, 'white' | 'black']> = {
    30: ['black-knight-b8', 'white'], 41: ['white-pawn-f2', 'black'],
    42: ['black-pawn-g7', 'white'], 60: ['black-queen-d8', 'white'],
    66: ['white-pawn-a2', 'black'], 94: ['black-pawn-a7', 'black'],
    108: ['black-rook-h8', 'white'], 114: ['white-pawn-b2', 'black'],
    124: ['white-pawn-d2', 'white'],
  }
  const cardPieces: Record<number, Record<string, Partial<GameState['pieces'][number]>>> = {
    17: { 'white-pawn-g2': { square: 'e3' } },
    22: { 'black-rook-a8': { neutral: true, neutralBeforeEffects: false } },
    31: {},
    34: { 'white-knight-b1': { square: 'c3' } },
    37: {},
    42: { 'white-pawn-f2': { square: 'f4', zone: 'board' },
      'black-pawn-g7': { square: null, zone: 'captured', capturedBy: 'white' } },
    45: { 'black-pawn-c7': { square: 'c4' } },
    49: { 'black-bishop-f8': { square: 'a8' } },
    54: {},
    60: { 'white-pawn-d2': { square: 'd5' }, 'white-knight-b1': { square: 'd6' },
      'black-pawn-d7': { square: 'd7' }, 'black-bishop-c8': { square: 'd8' },
      'black-queen-d8': { square: null, zone: 'captured', capturedBy: 'white' } },
    64: { 'white-pawn-f2': { square: 'f5' }, 'black-pawn-f7': { square: 'f6' } },
    71: { 'white-bishop-c1': { square: 'a2' }, 'white-rook-a1': { square: 'b2' } },
    80: { 'black-king-e8': { square: 'f7' } },
    88: { 'white-queen-d1': { square: 'b2' } },
    90: { 'black-pawn-h7': { square: 'h5' } },
    95: { 'black-rook-a8': { square: 'd5' }, 'black-bishop-f8': { square: 'a5' } },
    97: { 'white-rook-a1': { square: 'h8' }, 'black-rook-h8': { square: 'b3' } },
    100: { 'white-pawn-f2': { square: 'a1' } },
    103: { 'white-pawn-h2': { square: 'h3' } },
    104: { 'white-pawn-a2': { square: 'd2', zone: 'board' } },
  }
  let expectedEffects: unknown[] = []
  const at = (s: GameState, square: string) => s.pieces.find(p => p.zone === 'board' && p.square === square)
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1
    const reason = rationale[index]!
    assert.ok(reason.startsWith(`${step}. `))
    const before = state
    const immutableInput = structuredClone(before)
    const result = applyAction(before, action)
    assert.deepEqual(before, immutableInput, `full input immutability including capturedBy: ${reason}`)
    assert.ok(result.ok, reason)
    state = result.state
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const piece = at(before, action.from)!
      assert.ok(piece.owner === before.turn.color || piece.neutral, reason)
      const from = parseSquare(action.from)!, to = parseSquare(action.to)!
      const occupied = parseFen(before.fen).unwrap().board.occupied
      const target = at(before, action.to)
      if (piece.role === 'pawn' && !target) {
        const advance = piece.owner === 'white' ? 8 : -8
        assert.ok(to - from === advance || to - from === 2 * advance, reason)
        if (to - from === 2 * advance) {
          assert.equal(Math.floor(from / 8), piece.owner === 'white' ? 1 : 6, reason)
          assert.ok(!occupied.has(from + advance), reason)
        }
      } else {
        assert.ok(attacks({ role: piece.role, color: piece.owner }, from, occupied).has(to), reason)
      }
      assert.equal(at(state, action.to)?.id, piece.id, reason)
      assert.ok(!at(state, action.from), reason)
      if (target) assert.ok(target.owner !== before.turn.color || piece.neutral || target.neutral, reason)
      const expected = before.pieces.map(p => p.id === piece.id ? { ...p, square: action.to }
        : p.id === target?.id ? { ...p, square: null, zone: 'captured', capturedBy: before.turn.color } : p)
      assert.deepEqual(state.pieces, expected, reason)
      assert.equal(state.turn.color, before.turn.color, reason)
      assert.equal(state.turn.phase, 'afterMove', reason)
      const oldClock = before.fen.split(' '), newClock = state.fen.split(' ')
      assert.equal(Number(newClock[4]), piece.role === 'pawn' || target ? 0 : Number(oldClock[4]) + 1, reason)
      assert.equal(Number(newClock[5]), Number(oldClock[5]) + (before.turn.color === 'black' ? 1 : 0), reason)
      assert.equal(newClock[1], before.turn.color === 'white' ? 'b' : 'w', reason)
      assert.deepEqual(state.enPassant, piece.role === 'pawn' && Math.abs(to - from) === 16
        ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: piece.id }] : [], reason)
    }
    if (action.type === 'playCard') {
      const owner = before.players.white.hand.some(c => c.id === action.cardInstanceId) ? 'white' : 'black'
      const oldPlayer = before.players[owner], newPlayer = state.players[owner]
      assert.equal(newPlayer.hand.length, 5, reason)
      assert.deepEqual(newPlayer.hand, [...oldPlayer.hand.filter(c => c.id !== action.cardInstanceId), oldPlayer.deck[0]], reason)
      assert.deepEqual(newPlayer.deck, oldPlayer.deck.slice(1), reason)
      const retained = ['neutrality', 'crab'].includes(action.cardId)
      assert.deepEqual(newPlayer.discard, retained ? oldPlayer.discard
        : [...oldPlayer.discard, oldPlayer.hand.find(c => c.id === action.cardInstanceId)!], reason)
      assert.equal(state.turn.cardPlays[owner], 1, reason)
      assert.ok(Object.hasOwn(cardPieces, step), reason)
      assert.deepEqual(state.pieces, before.pieces.map(piece => {
        const expected = { ...piece, ...cardPieces[step]![piece.id] }
        if (step === 42 && piece.id === 'white-pawn-f2'
          || step === 104 && piece.id === 'white-pawn-a2') delete expected.capturedBy
        return expected
      }), reason)
      const replacementMove = [17, 34, 45, 49, 60, 64, 90, 97, 104].includes(step)
      const rewind = step === 80 || step === 103
      assert.deepEqual(state.turn, {
        ...before.turn,
        ...(replacementMove ? { phase: 'afterMove', moveMade: true } : {}),
        ...(rewind ? { phase: 'beforeMove', moveMade: false } : {}),
        cardPlays: { ...before.turn.cardPlays, [owner]: 1 },
      }, reason)
    } else {
      assert.deepEqual(state.players, before.players, reason)
    }
    if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces, reason)
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', reason)
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, reason)
      if (step !== 43) assert.equal(state.fen, before.fen, reason)
    }
    if (step === 22) expectedEffects.push({ type: 'neutrality', owner: 'white',
      card: { id: 'white-deck-0-neutrality', cardId: 'neutrality' }, pieceId: 'black-rook-a8' })
    if (step === 31) expectedEffects.push({ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 })
    if (step === 33) {
      expectedEffects.pop()
      assert.deepEqual(state.pieces, before.pieces, reason)
      assert.deepEqual(state.turn, { color: 'white', phase: 'beforeMove', moveMade: false,
        cardPlays: { white: 0, black: 0 } }, reason)
      assert.equal(state.fen, '1r1qkbnr/pppb4/3p3p/4ppp1/PP1P1P2/4P2P/1BP1P3/RN1QKBNR w KQk - 1 9', reason)
      assert.deepEqual(state.enPassant, [], reason)
    }
    if (step === 37) expectedEffects.push({ type: 'neutrality', owner: 'black',
      card: { id: 'black-hand-1-neutrality', cardId: 'neutrality' }, pieceId: 'black-rook-a8' })
    if (step === 54) expectedEffects.push({ type: 'crab', owner: 'black',
      card: { id: 'black-hand-0-crab', cardId: 'crab' }, pieceId: 'black-pawn-b7' })
    if (step === 100) expectedEffects.push({ type: 'dungeon', owner: 'black', player: 'white', pieceId: 'white-pawn-f2' })
    if (step === 105) expectedEffects.pop()
    assert.deepEqual(state.effects, expectedEffects, reason)
    if (captures[step]) {
      const [id, owner] = captures[step]!
      const p = state.pieces.find(p => p.id === id)!
      assert.equal(p.zone, 'captured', reason)
      assert.equal(p.capturedBy, owner, reason)
    }
    for (const p of state.pieces) if (p.zone !== 'captured') assert.equal(p.capturedBy, undefined, reason)
    // All transformations in this trace retain ordinary attack geometry: Crab captures as a pawn.
    // No neutral rook has a royal ray in these reviewed boards, so no pinned-controller exception is needed.
    const setup = parseFen(state.fen).unwrap()
    const king = state.pieces.find(p => p.owner === before.turn.color && p.royal)!
    const threats = state.pieces.filter(p => p.zone === 'board' && p.id !== king.id
      && (p.owner !== king.owner || p.neutral)
      && attacks({ role: p.role, color: p.owner }, parseSquare(p.square!)!, setup.board.occupied).has(parseSquare(king.square!)!))
    assert.equal(threats.length > 0, step === 79 || step === 99, reason)
    if (step === 42) assert.equal(at(state, 'f4')?.id, 'white-pawn-f2')
    if (step === 60) assert.deepEqual(['d5', 'd6', 'd7', 'd8'].map(s => at(state, s)?.id),
      ['white-pawn-d2', 'white-knight-b1', 'black-pawn-d7', 'black-bishop-c8'])
    if (step === 80) {
      assert.equal(at(state, 'f7')?.id, 'black-king-e8')
      assert.equal(state.fen, 'b2bN1nr/3p1k2/3P1p1p/pr2pP2/pPp5/4P2P/BRP1P3/2Q1KBNR b K - 2 19')
      assert.equal(state.effects.length, 3)
      assert.equal(state.turn.moveMade, false)
    }
    if (step === 88) assert.equal(at(state, 'b2')?.id, 'white-queen-d1')
    if (step === 100) assert.equal(at(state, 'a1')?.id, 'white-pawn-f2')
    if (step === 103) assert.equal(at(state, 'h3')?.id, 'white-pawn-h2')
    if (step === 104) assert.equal(at(state, 'd2')?.id, 'white-pawn-a2')
    if (step === 105) assert.equal(state.effects.length, 3)
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 20)
  assert.equal(state.fen, '4N2R/3pn3/3r1pk1/b1b1p2p/p1p4P/2QPP2B/B2PP3/P2K2NR b - - 2 30')
  assert.equal(replayTrace(trace).fen, state.fen)
})
