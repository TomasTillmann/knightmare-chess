import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import type { GameState, PieceState } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Independently reviewed in order against rules §§8,11,13–19 and printed catalog timing.
const rationales = `
1. c2-c3 advances White pawn once, opens c2, resets clock; both Kings sheltered.
2. Figure Dance simultaneously cycles a1-h1-h8-a8-a1, preserves all four Rooks and revokes castling.
3. White ends the completed move; Figure Dance allowance resets for Black.
4. c7-c6 advances Black pawn once and increments fullmove to 2.
5. Black hands the unchanged board to White.
6. d2-d4 crosses empty d3; creates physical en-passant opportunity d3.
7. White ends with d3 opportunity preserved for Black.
8. a7-a5 crosses empty a6; replaces d3 opportunity with a6.
9. Black ends with a6 opportunity available to White.
10. c3-c4 is one quiet forward step and expires a6 opportunity.
11. White ends with no captures or card expenditure.
12. g8-h6 is an unobstructed Knight jump, increasing quiet clock.
13. Black ends and White receives a fresh card allowance.
14. h8-h7 Rook captures the physical black h7 Pawn; no royal threatened.
15. Black Think Again immediately restores Rook h8, Pawn h7, clocks and White move opportunity.
16. White Fog of War cancels that reaction, reinstates h8xh7 and spends both players allowances.
17. End closes the cancellation chain with captured h7 Pawn retained.
18. e7-e6 advances Black pawn into empty e6.
19. Black ends with capture still retained from White previous turn.
20. b1-d2 Knight jumps to vacated d2; c1 Bishop still screens invading a1 Rook.
21. White completes turn without exposing e1 King.
22. h6-g8 Knight returns to its vacated origin without capture.
23. Black ends with both Kings safe.
24. h7-h5 Rook slides through empty h6 to empty h5.
25. White ends with quiet clock 3.
26. d8-c7 Queen moves one diagonal onto vacated c7.
27. Black ends; d8 is now empty.
28. h5-h8 Rook traverses empty h6/h7; g8 Knight blocks attack on d8.
29. White ends with no royal attack created.
30. e8-d8 King steps to empty safe d8; g8 Knight blocks h8 Rook.
31. Black completes its royal move safely.
32. d1-c2 Queen enters vacated c2 diagonally.
33. White ends; c1 Bishop continues screening the a1 Rook.
34. f8-d6 Bishop passes through empty e7, ending on empty d6.
35. Black ends with quiet clock 8.
36. h2-h4 Pawn crosses empty h3, creates h3 en-passant opportunity.
37. White retains that opportunity through endTurn.
38. e6-e5 quiet Pawn advance expires h3 opportunity.
39. Fireball follows that noncapture, capturing e5 center plus adjacent d4 Pawn and d6 Bishop only.
40. Black ends after Fireball, all three physical victims remain captured.
41. h1-h3 White original a1 Rook crosses empty h2.
42. Black Knightmare rewinds h1-h3 and clock, requiring a different White move.
43. c2-h7 Queen takes clear d3/e4/f5/g6 diagonal, genuinely different from canceled Rook move.
44. White ends after legal replacement and Black reaction allowance resets.
45. b8-a6 Knight jumps to empty a6.
46. Black ends; no ongoing movement prohibition survives.
47. h7-g7 Queen captures the original g7 Pawn, resetting capture clock.
48. White ends with that Pawn captured.
49. Forced March simultaneously moves b7-a7 and c6-d6 sideways into initially empty squares; consumes Black move.
50. Black ends the replacement move, fullmove 12.
51. e2-e3 quiet Pawn advance opens e2.
52. White ends with e3 Pawn still nonroyal.
53. Dubbing lets a8 Rook jump like Knight to empty b6 without capture; consumes Black move.
54. Black ends, and Rook retains its Rook role.
55. b2-b3 Pawn advances quietly into empty b3.
56. Coup designates safe e3 Pawn as royal and makes e1 King a capturable Prince; identities and powers remain.
57. White ends; continuing Coup card remains beside board.
58. c7-c6 Queen steps straight; d5 blocks neither but e3 royal is not on its ray.
59. Black Man-Trap binds occupied friendly d8 square; stationary King does not spring it.
60. Black ends with hidden d8 trap still armed.
61. Pacifism marks owned nonroyal a2 Pawn before move, preserving the move and its physical identity.
62. g7-g3 Queen traverses empty g6/g5/g4; e3 royal remains safe.
63. White ends with Pacifism and Coup active.
64. a6-c7 Knight jumps to now-empty c7.
65. Black ends with d8 trap undisturbed.
66. g3-g4 Queen takes one empty straight square.
67. White ends safely, e3 royal still protected by its position.
68. c6-f3 Queen passes clear d5/e4, checking White royal e3 along rank three.
69. Black ends; White may answer the check on its own turn.
70. g1xf3 Knight captures checking Queen and cures e3 royal check.
71. White ends with Queen captured and royal safe.
72. a1xc1 Black Rook traverses empty b1 and captures Bishop; e1 is a Prince, not the royal.
73. Black ends; White need not answer an attack on its capturable Prince.
74. Irresistible Force pushes friendly Knight f3-f4, then Pawn f2-f3; no capture or royal displacement.
75. White ends replacement move with royal e3 protected.
76. Masquerade grants c8 Bishop Queen motion to empty b7, restoring Bishop powers after move.
77. Black ends replacement move with fullmove 18.
78. b3-b4 Pawn quietly advances one rank.
79. White ends; no en-passant generated by single step.
80. c1-b1 Black Rook slides one empty square.
81. Earthquake fizzles: clockwise promotion h4=Q would attack Black King d8 through g5/f6/e7; board and orientation restored, card spent.
82. Black ends after fizzle; no promotions persist.
83. c4-c5 Pawn quietly advances.
84. White ends; c4 is vacant.
85. b7-a8 Bishop steps diagonally onto empty a8.
86. Black ends with d8 royal safe behind g8 Knight.
87. f1-d3 Bishop passes empty e2; Prince e1 may remain attacked.
88. White ends with true royal e3 safe.
89. f7-f6 Pawn quietly advances; no en-passant available.
90. Black ends; f7 vacated.
91. h8-h6 Rook traverses empty h7 without capture.
92. White ends with true royal safe.
93. c7-b5 Knight makes quiet jump, leaving c7 empty.
94. Black ends, royal e3 not attacked.
95. Fanatic e3-e6 fizzles because the royal Pawn would enter d7 Pawn attack; safe initial position means replacement move is consumed.
96. White ends fizzle with e3 royal retained and halfmove increased once.
97. Lost Castle swaps physical black b6 Rook and white h1 Rook; no capture, consumes Black move.
98. Black ends swap; e1 Prince may be attacked from h1.
99. d2-f1 Knight jumps to empty f1 without affecting true royal e3.
100. White ends, no forced rescue for its Prince.
101. b1-b3 Rook passes empty b2; d3 Bishop screens e3 royal.
102. Treason swaps opponent Rook b6 and Knight f1; neither moves normally or captures.
103. Black ends swap with royal e3 still screened by d3 Bishop.
104. b6-c8 White Knight jumps to empty c8; does not attack d8 King.
105. Truce after the move forbids captures, remains active with no King in check.
106. White ends with Truce active and no discarded Truce card.
107. a8-d5 Bishop crosses empty b7/c6 without capture under Truce.
108. Black ends; Truce suppresses capture-based threats.
109. f4-h5 Knight jumps to empty h5 without capture.
110. White ends under continuing Truce.
111. h1-g1 Rook slides quietly, not capturing adjacent white f1 Rook.
112. Black ends with capture still forbidden.
113. g4-c4 Queen passes empty f4/e4/d4 to empty c4.
114. White ends; no stalemate, Black has quiet Rook moves.
115. b3-c3 Rook slides quietly; d3 Bishop remains uncaptured.
116. Black ends with Truce and armed d8 trap unchanged.
117. a2-a3 Pacifist Pawn moves normally without capture; marker follows identity.
118. White ends with its Pacifist at a3.
119. Tournament swaps black g8 Knight with white c8 Knight; swap is permitted under Truce and consumes move.
120. Black ends replacement move with fullmove 28.
121. h6-g6 Rook slides to empty g6, not capturing f6 Pawn.
122. White ends; no King check while Truce prohibits captures.
123. d5-a8 Bishop returns over empty c6/b7 without capture.
124. Black ends at fullmove 29; true royals e3/d8, four continuing effects and no pending rescue.
`.trim().split('\n')

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
function reaches(piece: PieceState, target: string, state: GameState): boolean {
  assert.ok(piece.square)
  const [x, y] = xy(piece.square), [tx, ty] = xy(target)
  const dx = tx - x, dy = ty - y
  if (piece.role === 'pawn') return Math.abs(dx) === 1 && dy === (piece.owner === 'white' ? 1 : -1)
  if (piece.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1
  if (!(piece.role !== 'bishop' && (dx === 0 || dy === 0) || piece.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false
  const distance = Math.max(Math.abs(dx), Math.abs(dy))
  return distance > 0 && !state.pieces.some(other => {
    if (!other.square || other.square === piece.square || other.square === target) return false
    const [ox, oy] = xy(other.square)
    for (let n = 1; n < distance; n++) if (ox === x + n * Math.sign(dx) && oy === y + n * Math.sign(dy)) return true
    return false
  })
}

test('iteration 029 deterministic semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/029.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860029)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.length, 124)
  let state = createGameState(trace.initial)
  const snapshots: GameState[] = [state]
  const pieceAt = (s: GameState, square: string) => s.pieces.find(piece => piece.square === square)
  const relocation: Record<number, Record<string, string>> = {
    2: { 'white-rook-a1': 'h1', 'white-rook-h1': 'h8', 'black-rook-a8': 'a1', 'black-rook-h8': 'a8' },
    49: { 'black-pawn-b7': 'a7', 'black-pawn-c7': 'd6' }, 53: { 'black-rook-h8': 'b6' },
    74: { 'white-pawn-f2': 'f3', 'white-knight-g1': 'f4' }, 76: { 'black-bishop-c8': 'b7' },
    97: { 'black-rook-h8': 'h1', 'white-rook-a1': 'b6' },
    102: { 'white-rook-a1': 'f1', 'white-knight-b1': 'b6' },
    119: { 'black-knight-g8': 'c8', 'white-knight-b1': 'g8' },
  }
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, before = state
    assert.ok(rationales[index]!.startsWith(`${n}. `))
    const result = applyAction(before, action)
    assert.ok(result.ok, rationales[index])
    state = result.state
    snapshots.push(state)
    assert.equal(state.orientation, 0)
    assert.ok(!state.pendingRescue && !state.pendingAbduction && !state.pendingDoomsayer)
    assert.equal(state.outcome, null)
    const actor = before.turn.color
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const mover = pieceAt(before, action.from), victim = pieceAt(before, action.to)
      assert.ok(mover)
      assert.equal(mover.owner, actor)
      const [x,y] = xy(action.from), [tx,ty] = xy(action.to)
      if (mover.role === 'pawn' && !victim) {
        assert.equal(tx, x)
        const forward = actor === 'white' ? 1 : -1
        assert.ok(ty-y === forward || ty-y === 2*forward && y === (actor === 'white' ? 1 : 6))
        if (Math.abs(ty-y) === 2) assert.ok(!pieceAt(before, `${action.from[0]}${y+forward+1}`))
      } else assert.ok(reaches(mover, action.to, before), rationales[index])
      assert.ok(!victim || victim.owner !== actor && !victim.royal)
      assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === mover.id ? { ...piece, square: action.to } : piece.id === victim?.id ? { ...piece, square: null, zone: 'captured', capturedBy: before.turn.color } : piece))
      assert.deepEqual(state.effects, before.effects)
      assert.deepEqual(state.players, before.players)
      assert.equal(state.turn.phase, 'afterMove')
      assert.equal(state.turn.color, actor)
      const clocks = before.fen.split(' '), afterClocks = state.fen.split(' ')
      assert.equal(Number(afterClocks[4]), mover.role === 'pawn' || victim ? 0 : Number(clocks[4])+1)
      assert.equal(Number(afterClocks[5]), Number(clocks[5])+(actor === 'black' ? 1 : 0))
      assert.deepEqual(state.enPassant, mover.role === 'pawn' && Math.abs(ty-y) === 2 ? [{ target: `${action.from[0]}${(y+ty)/2+1}`, pawnId: mover.id }] : [])
      if (n > 105) assert.ok(!victim, 'Truce forbids captures')
    } else if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.effects, before.effects)
      assert.deepEqual(state.players, before.players)
      assert.equal(state.fen, before.fen)
      assert.deepEqual(state.enPassant, before.enPassant)
      assert.deepEqual(state.turn, { color: actor === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } })
    } else if (action.type === 'playCard') {
      const owner = n === 15 || n === 42 ? 'black' : actor
      const opponent = owner === 'white' ? 'black' : 'white'
      const player = before.players[owner], next = state.players[owner]
      const card = player.hand.find(card => card.id === action.cardInstanceId)
      assert.ok(card)
      assert.equal(before.turn.cardPlays[owner], 0)
      assert.deepEqual(next.hand, [...player.hand.filter(item => item.id !== card.id), player.deck[0]])
      assert.deepEqual(next.deck, player.deck.slice(1))
      assert.deepEqual(state.players[opponent], before.players[opponent])
      const continuing = CARD_CATALOG[action.cardId]!.continuing && n !== 81
      assert.deepEqual(next.discard, continuing ? player.discard : [...player.discard, card])
      assert.equal(state.turn.cardPlays[owner], 1)
      if (relocation[n]) assert.deepEqual(state.pieces, before.pieces.map(piece => relocation[n]![piece.id] ? { ...piece, square: relocation[n]![piece.id] } : piece))
      if ([49,53,74,76,95,97,119].includes(n)) {
        assert.equal(state.turn.phase, 'afterMove')
        assert.equal(state.turn.moveMade, true)
        assert.deepEqual(state.enPassant, [])
      }
    }
    // This trace has no neutral pieces or movement-changing continuing effects.
    // Coup's physical royal, rather than the FEN King glyph, controls King safety.
    if (n < 105) for (const royal of state.pieces.filter(piece => piece.royal && piece.owner === actor)) {
      assert.ok(royal.square)
      assert.ok(!state.pieces.some(piece => piece.square && piece.owner !== actor && piece.id !== 'white-pawn-a2' && reaches(piece, royal.square!, state)), rationales[index])
    }
    if (n === 15) {
      assert.deepEqual(state.pieces, snapshots[13]!.pieces)
      assert.equal(state.fen, snapshots[13]!.fen)
      assert.equal(state.turn.moveMade, false)
    }
    if (n === 16) {
      assert.deepEqual(state.pieces, snapshots[14]!.pieces)
      assert.equal(state.fen, snapshots[14]!.fen)
      assert.deepEqual(state.turn.cardPlays, { white: 1, black: 1 })
    }
    if (n === 39) assert.deepEqual(state.pieces, before.pieces.map(piece => ['white-pawn-d2','black-pawn-e7','black-bishop-f8'].includes(piece.id) ? { ...piece, square: null, zone: 'captured', capturedBy: before.turn.color } : piece))
    if (n === 42) {
      assert.deepEqual(state.pieces, snapshots[40]!.pieces)
      assert.equal(state.fen, snapshots[40]!.fen)
      assert.equal(state.turn.moveMade, false)
      assert.ok(state.chaosForbidden)
    }
    if (n === 56) {
      assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === 'white-king-e1' ? { ...piece, royal: false } : piece.id === 'white-pawn-e2' ? { ...piece, royal: true } : piece))
      assert.deepEqual(state.effects, [{ type: 'coup', owner: 'white', card: { id: 'white-hand-2-coup', cardId: 'coup' }, princeId: 'white-king-e1', kingId: 'white-pawn-e2', princeRole: 'king' }])
    }
    if (n === 59) assert.deepEqual(state.effects, [...before.effects, { type: 'man-trap', owner: 'black', card: { id: 'black-deck-3-man-trap', cardId: 'man-trap' }, square: 'd8' }])
    if (n === 61) assert.deepEqual(state.effects, [...before.effects, { type: 'pacifism', owner: 'white', card: { id: 'white-hand-4-pacifism', cardId: 'pacifism' }, pieceId: 'white-pawn-a2' }])
    if (n === 81 || n === 95) {
      assert.deepEqual(state.pieces, before.pieces)
      assert.deepEqual(state.effects, before.effects)
      assert.equal(state.history.at(-1)?.type, 'cardFizzled')
      if (n === 81) assert.ok(reaches({ ...pieceAt(before, 'h4')!, role: 'queen' }, 'd8', before))
      else assert.ok(reaches(pieceAt(before, 'd7')!, 'e6', before))
    }
    if (n === 105) assert.deepEqual(state.effects, [...before.effects, { type: 'truce', owner: 'white', card: { id: 'white-deck-0-truce', cardId: 'truce' } }])
  }
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 18)
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e3')
  assert.equal(state.effects.length, 4)
  assert.deepEqual(state, replayTrace(trace))
})
