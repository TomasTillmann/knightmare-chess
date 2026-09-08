import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck } from '../reducer.js'
import { createGameState } from '../state.js'
import type { CardInstance, Color, GameState, PieceState, Role, SquareName } from '../types.js'

// Reviewed in order against rules §§7–11, 16.2, 18.5, 19.1/3, 20, 22.8,
// cards.md, and final_cards KC9/2, KC3/2, KC8/2, KC14/2, KC4/4, KC11/4,
// KC1/3, KC8/4, KC9/3, KC2/3, KC3/1, KC9/1 (page/card numbers).
// Each numbered row is an explicit review, not generated from reducer output.
const rationale = `
1. Ng1-h3 jumps to an empty square; neither royal is attacked.
2. White closes its completed knight move; Black receives the move.
3. a7-a5 crosses empty a6; a6 EP opportunity belongs to the a7 pawn.
4. Black closes; a6 EP survives into White's turn.
5. Nb1-a3 jumps quietly and expires a6 EP.
6. White closes; Black receives an unused allowance.
7. g7-g6 advances the black pawn one empty square.
8. Black closes after its pawn move.
9. Rh1-g1 moves one square and permanently loses White kingside castling.
10. White closes; queenside and both black rights remain.
11. b7-b6 advances quietly; pawn move resets the halfmove clock.
12. Black plays Truce after moving; retain its card and draw Madman; neither King has a raw attack that would expire Truce.
13. Black closes; Truce remains active.
14. Rg1-h1 returns quietly; lost kingside rights do not return.
15. White closes with Truce unchanged.
16. Madman replaces Black's move: f7-h5 jumps the g6 pawn without taking it; draw Holy War.
17. Black closes its replacement move; no second ordinary move.
18. Irresistible Force replaces White's move: a2-a3 pushes the a3 knight to empty a4; draw Doomsayer.
19. White closes; pushing captured nothing and left identities intact.
20. e7-e6 advances one empty square under Truce.
21. Black closes the completed pawn move.
22. Nh3-g1 jumps quietly to its emptied original square.
23. White closes; original square grants no new rights.
24. Long Jump replaces Black's move: g8 and h4 have opposite colors; h4 is empty; draw Resurrection.
25. Black closes the replacement and cannot add a regular move.
26. b2-b3 advances White's pawn one square.
27. White closes its pawn move.
28. Ke8-f7 steps into the square vacated by Madman; revoke both black castling rights.
29. Black closes; neither King has a raw attack, so Truce persists.
30. Doppelganger uses Black's last King movement: White Bc1-b2 takes one diagonal step; remains a Bishop; draw Vulture.
31. White closes its replacement move.
32. Ra8-a7 moves into the empty square; black castling rights stay absent.
33. Black closes after moving the rook.
34. Bb2-d4 travels through empty c3 without capture.
35. White sets Man-Trap on its occupied d2 square after moving; retain card and draw Abduction.
36. White closes; d2 trap and Truce persist.
37. Bc8-a6 follows the clear b7 diagonal.
38. Black closes its Bishop move.
39. Bd4-c5 moves one diagonal step without capture.
40. White closes; no enemy ended on d2.
41. Ra7-a8 returns quietly; no castling rights are restored.
42. Black closes its rook move.
43. Ng1-f3 jumps to an empty square.
44. White retains Doomsayer after moving, draws Holy War, and opens Black's immediate naming choice.
45. Black declines its immediate choice; Doomsayer remains and the choice closes.
46. White names Queen; Truce protects its Queen, so no loss and no Doomsayer expiry.
47. White repeats Queen; Truce again forbids loss, with all clocks unchanged.
48. White closes after the protected announcements.
49. g6-g5 is one black forward step to empty g5.
50. Black closes its pawn move.
51. e2-e3 advances quietly and resets the halfmove clock.
52. White closes its pawn move.
53. Black names Pawn; all black Pawns are protected by Truce.
54. Kf7-g7 steps horizontally to empty g7.
55. Black closes; neither King has a raw attack that would end Truce.
56. White names Pawn; Truce prevents a loss.
57. White names Bishop; Truce protects both Bishops.
58. b3-b4 advances quietly into empty b4.
59. White closes after the pawn move.
60. Qd8-e8 moves horizontally into the vacated King square.
61. Black closes the Queen move.
62. Ra1-c1 passes empty b1; White's last queenside castling right is revoked.
63. White closes; all castling rights are now permanently absent.
64. Black names Pawn; Truce prevents Doomsayer capture.
65. Kg7-f6 steps diagonally to an empty square.
66. Black closes with Truce and both white retained cards unchanged.
67. White names Knight; Truce protects both physical Knights.
68. Nf3-d4 is an unobstructed Knight jump into an empty square.
69. White names Queen; Truce prevents loss.
70. White repeats Queen without changing the physical board or clocks.
71. White closes its turn.
72. Nh4-f5 jumps quietly; the original g8 Knight retains identity.
73. Black names Bishop; neither Bishop may be captured during Truce.
74. Black plays Panic after moving, draws Guardian, and gives White a 15000 ms next-move limit.
75. White immediately plays Vulture: discard top undrawn Madman, replace Vulture with Man of Straw, and take Black's physical Panic; existing timer remains.
76. Black closes; White's turn starts with the Panic timer still armed.
77. Rc1-b1 makes White's legal next move and clears Black's Panic timer.
78. White names Knight; Truce prevents any loss.
79. White names Bishop; both remain protected.
80. White names Pawn; all eight remain protected.
81. White names Knight again; no capture or clock advance.
82. White names Pawn again; Doomsayer remains active.
83. White plays the stolen physical Panic after moving; its new owner is White, Black receives the timer, and White draws Breakthrough.
84. White closes; Black starts under the new 15000 ms timer.
85. Nf5-d6 makes Black's legal next move, clearing White's Panic timer.
86. Black names Knight; Truce prevents loss.
87. Black repeats Knight; both physical Knights remain on the board.
88. Black closes its completed move.
89. Nd4-b5 jumps quietly into empty b5.
90. White closes the Knight move.
91. g5-g4 advances Black's pawn one empty square.
92. Black closes its pawn move.
93. Nb5-d4 returns by a legal Knight jump.
94. White closes the return move.
95. Black names Pawn; Truce protects every Pawn.
96. Black names Bishop; Truce protects both Bishops.
97. Nd6-b5 jumps to the square White just vacated.
98. Black closes the Knight move.
99. f2-f3 advances the pawn into the square the Knight vacated earlier.
100. White closes its pawn move.
101. Black names Rook; Truce prevents its removal.
102. Black names Queen; Truce prevents its removal too.
103. Guardian replaces Black's move with e6-e5; e7 is empty, so no follower; no EP, draw Dungeon.
104. Black closes the replacement move with no ordinary move remaining.
105. Rb1-b2 moves one empty square vertically.
106. White names Bishop; Doomsayer cannot capture through Truce.
107. White closes its rook move.
108. Black names Bishop; no loss or Doomsayer expiry.
109. Bf8-e7 moves one empty diagonal square.
110. Black closes the Bishop move.
111. Bf1-d3 slides through empty e2 to empty d3.
112. White names Bishop; the just-moved Bishop and its companion stay protected.
113. White closes its Bishop move.
114. Black names Bishop; Truce protects both identities.
115. Ba6-c8 returns through empty b7.
116. Black names Rook; both remain protected by Truce.
117. Black closes its Bishop move.
118. White names Queen; Truce prevents its capture.
119. e3-e4 advances into empty e4; it does not capture the e5 Pawn.
120. White closes its pawn move.
121. h7-h6 advances one empty square; the f7-origin pawn stays on h5.
122. Black names Knight; Truce protects both Knights.
123. Black names Bishop; Truce protects both Bishops.
124. Black closes its pawn move.
125. Bd3-c4 moves one diagonal square without capture.
126. White names Bishop; Truce prevents either Bishop being lost.
127. White closes its Bishop move.
128. Kf6-g6 steps to an empty adjacent square.
129. Black closes its King move.
130. White names Knight; Truce prevents any capture.
131. Bc4-f1 follows empty d3 and e2 back to f1.
132. White Holy War swaps its a4 Knight and f1 Bishop simultaneously; no clock advance; draw Bog.
133. White closes; both swapped pieces retain their original identities and powers.
134. Kg6-f7 returns diagonally to an empty square.
135. Black closes the King move.
136. d2-d3 moves the Pawn off its trap square; the trap stays at d2.
137. White names Queen; Truce prevents loss.
138. White closes; vacating d2 did not spring the trap.
139. Black names Knight; both Knights are protected.
140. Black names Bishop; both Bishops are protected.
141. Black repeats Bishop; no board or clock change.
142. Black names Pawn; all Pawns remain protected.
143. Qe8-f8 moves one empty square horizontally.
144. Black Holy War swaps b8 Knight and e7 Bishop; preserve identities and clocks, draw Peace Talks.
145. Black closes after the simultaneous swap.
146. White names Rook; Truce prevents capture.
147. c2-c4 advances across empty c3; create c3 EP for the original c2 Pawn, though Truce prevents capture.
148. White closes; c3 EP survives into Black's turn.
149. g4-g3 advances quietly and expires the unrelated c3 EP.
150. Black closes the pawn move.
151. Nd4-f5 jumps into empty f5.
152. White names Knight; both Knights stay protected.
153. White names Bishop; both Bishops stay protected.
154. White closes the Knight move.
155. Qf8-g8 slides one empty square horizontally.
156. Black Peace Talks cancels the d2 Man-Trap, returning its card to White's discard; draw Masquerade; Truce and Doomsayer remain.
157. Black closes; there is no pending correction or choice after trap removal.
158. Ba4-c2 slides through empty b3; no capture or trap interaction.
159. White closes its fiftieth regular move; Black begins move 28 with no raw attack on either King and Truce still active.
`.trim().split('\n')

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'
const cardMoves: Record<number, Array<[SquareName, SquareName]>> = {
  16: [['f7', 'h5']], 18: [['a3', 'a4'], ['a2', 'a3']],
  24: [['g8', 'h4']], 30: [['c1', 'b2']], 103: [['e6', 'e5']],
  132: [['a4', 'f1'], ['f1', 'a4']], 144: [['b8', 'e7'], ['e7', 'b8']],
}
const replacements = new Set([16, 18, 24, 30, 103])

test('iteration 129 independent physical, card, phase, and clock oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/129.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(rationale.length, 159)
  assert.equal(trace.steps.length, rationale.length)
  const pieces: PieceState[] = []
  const back: Role[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
  for (const [rank, owner] of [[1, 'white'], [2, 'white'], [7, 'black'], [8, 'black']] as const) {
    for (const [file, role] of (rank === 2 || rank === 7 ? Array<Role>(8).fill('pawn') : back).entries()) {
      const square = `${'abcdefgh'[file]}${rank}` as SquareName
      pieces.push({ id: `${owner}-${role}-${square}`, owner, role, originalRole: role,
        square, zone: 'board', promoted: false, royal: role === 'king', neutral: false })
    }
  }
  const instances = (color: Color, zone: 'hand' | 'deck', ids: string[] = []): CardInstance[] =>
    ids.map((cardId, index) => ({ id: `${color}-${zone}-${index}-${cardId}`, cardId }))
  const players = Object.fromEntries((['white', 'black'] as const).map(color => [color, {
    hand: instances(color, 'hand', trace.initial.hands?.[color]),
    deck: instances(color, 'deck', trace.initial.decks?.[color]), discard: [] as CardInstance[],
  }])) as GameState['players']
  let effects: Array<{ type: string; owner: Color; card?: CardInstance; square?: SquareName; player?: Color; durationMs?: number }> = []
  let actor: Color = 'white', fenActor: Color = 'white'
  let made = false, half = 0, full = 1, rights = 'KQkq'
  const allowance = { white: 0, black: 0 }
  let ep: GameState['enPassant'] = []
  let state = createGameState(trace.initial)
  assert.deepEqual(state.pieces, pieces, 'standard physical setup independently constructed')
  const at = (square: string) => pieces.find(p => p.square === square)
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, why = rationale[index]!
    assert.ok(why.startsWith(`${n}. `))
    const action = step.action
    const input = structuredClone(state)
    let relocations = cardMoves[n] ?? []
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/)
      assert.equal(made, false, why)
      const piece = at(action.from)!
      assert.ok(piece); assert.equal(piece.owner, actor); assert.equal(at(action.to), undefined)
      const dx = action.to.charCodeAt(0) - action.from.charCodeAt(0)
      const dy = Number(action.to[1]) - Number(action.from[1])
      if (piece.role === 'knight') assert.equal(Math.abs(dx * dy), 2, why)
      else if (piece.role === 'king') assert.equal(Math.max(Math.abs(dx), Math.abs(dy)), 1, why)
      else if (piece.role === 'pawn') {
        assert.equal(dx, 0); assert.ok([1, 2].includes(dy * (actor === 'white' ? 1 : -1)))
        if (Math.abs(dy) === 2) {
          assert.equal(action.from[1], actor === 'white' ? '2' : '7')
          assert.equal(at(`${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`), undefined)
        }
      } else {
        assert.ok(piece.role === 'bishop' ? Math.abs(dx) === Math.abs(dy)
          : piece.role === 'rook' ? dx === 0 || dy === 0 : dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
        for (let k = 1; k < Math.max(Math.abs(dx), Math.abs(dy)); k++)
          assert.equal(at(`${String.fromCharCode(action.from.charCodeAt(0) + k * Math.sign(dx))}${Number(action.from[1]) + k * Math.sign(dy)}`), undefined, why)
      }
      relocations = [[action.from as SquareName, action.to as SquareName]]
    }
    const moving = relocations.map(([from, to]) => { const piece = at(from)!; assert.ok(piece, why); return { piece, to } })
    for (const { piece, to } of moving) piece.square = to
    if (action.type === 'move' || replacements.has(n)) {
      assert.equal(made, false, why)
      half = moving.some(({ piece }) => piece.role === 'pawn') ? 0 : half + 1
      if (actor === 'black') full++
      made = true; fenActor = opposite(actor); ep = []
      if (n === 3) ep = [{ target: 'a6', pawnId: 'black-pawn-a7' }]
      if (n === 147) ep = [{ target: 'c3', pawnId: 'white-pawn-c2' }]
      if (n === 9) rights = 'Qkq'
      if (n === 28) rights = 'Q'
      if (n === 62) rights = ''
      effects = effects.filter(e => !(e.type === 'panic' && e.player === actor))
    }
    if (action.type === 'playCard') {
      const owner: Color = n === 75 ? 'white' : actor
      assert.equal(allowance[owner], 0, why)
      const player: GameState['players'][Color] = players[owner]
      const cardIndex = player.hand.findIndex(c => c.id === action.cardInstanceId)
      assert.ok(cardIndex >= 0, why)
      const [card] = player.hand.splice(cardIndex, 1)
      assert.equal(card!.cardId, action.cardId)
      if (n === 75) player.discard.push(player.deck.shift()!)
      if ([12, 35, 44].includes(n)) effects.push({ type: action.cardId, owner, card: card!, ...(n === 35 ? { square: 'd2' as const } : {}) })
      else player.discard.push(card!)
      player.hand.push(player.deck.shift()!)
      if (n === 75) {
        const stolen: CardInstance = players.black.discard.pop()!
        assert.equal(stolen.id, 'black-hand-1-panic'); player.hand.push(stolen)
      }
      if (n === 74 || n === 83) effects.push({ type: 'panic', owner, player: opposite(owner), durationMs: 15000 })
      if (n === 156) {
        const trap = effects.find(e => e.type === 'man-trap')!
        players.white.discard.push(trap.card!); effects = effects.filter(e => e !== trap)
      }
      allowance[owner]++
    }
    if (action.type === 'namePiece') {
      assert.deepEqual(action.losses, [], why)
      assert.ok(effects.some(e => e.type === 'truce') && effects.some(e => e.type === 'doomsayer'))
    }
    if (action.type === 'endTurn') {
      assert.equal(made, true, why)
      actor = opposite(actor); made = false; allowance.white = 0; allowance.black = 0
    }
    const result = applyAction(state, action)
    assert.deepEqual(state, input, `${why}: complete structuredClone input immutability`)
    assert.ok(result.ok, why)
    state = result.state
    assert.deepEqual(state.pieces, pieces, `${why}: every physical identity, role, zone, flags, and absent capturedBy`)
    assert.deepEqual(state.players, players, `${why}: exact physical hand/deck/discard order`)
    assert.deepEqual(state.effects, effects, why)
    assert.deepEqual(state.turn, { color: actor, phase: made ? 'afterMove' : 'beforeMove', moveMade: made, cardPlays: allowance }, why)
    assert.deepEqual(state.enPassant, ep, why)
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 44 ? { player: 'black', cardInstanceId: 'white-deck-0-doomsayer' } : null, why)
    assert.equal(state.pendingRescue ?? null, null, why)
    assert.equal(state.pendingAbduction ?? null, null, why)
    assert.deepEqual(state.underElfHill ?? [], [], why)
    assert.equal(state.chaosForbidden, undefined, why)
    assert.deepEqual(state.fogLocked ?? [], [], why)
    assert.deepEqual(state.plotsAllowances ?? [], [], why)
    assert.equal(state.orientation, 0, why); assert.equal(state.outcome, null, why)
    for (const color of ['white', 'black'] as const) {
      const king = pieces.find(p => p.royal && p.owner === color)!
      // This oracle deliberately ignores Truce: a raw check would end it.
      // All pieces here have their original role, owner and ordinary movement.
      const rawThreats = pieces.filter(p => {
        if (p.owner === color || !p.square || p.zone !== 'board') return false
        const from = p.square, to = king.square!
        const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1])
        if (p.role === 'pawn') return Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1)
        if (p.role === 'knight') return Math.abs(dx * dy) === 2
        if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1
        const diagonal = Math.abs(dx) === Math.abs(dy)
        const straight = dx === 0 || dy === 0
        if (!(p.role === 'bishop' ? diagonal : p.role === 'rook' ? straight : diagonal || straight)) return false
        for (let k = 1; k < Math.max(Math.abs(dx), Math.abs(dy)); k++) {
          const between = `${String.fromCharCode(from.charCodeAt(0) + k * Math.sign(dx))}${Number(from[1]) + k * Math.sign(dy)}`
          if (at(between)) return false
        }
        return true
      }).map(p => p.id)
      assert.deepEqual(rawThreats, [], `${why}: independent ${color} raw threats; any attacker would expire Truce`)
      assert.equal(isKingInCheck(state, color), false, `${why}: ${color} royal safety`)
    }
    const symbols: Record<Role, string> = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
    const board = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, file) => {
      const p = at(`${'abcdefgh'[file]}${8 - row}`)
      return p ? (p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role]) : '1'
    }).join('').replace(/1+/g, run => String(run.length))).join('/')
    // Neither double-step in this trace has an adjacent enemy Pawn, so FEN EP is '-'.
    assert.equal(state.fen, `${board} ${fenActor[0]} ${rights || '-'} - ${half} ${full}`, why)
    if (replacements.has(n)) {
      const beforeRejectedMove = structuredClone(state)
      const rejected = applyAction(state, { type: 'move', from: actor === 'white' ? 'g2' : 'c7', to: actor === 'white' ? 'g3' : 'c6' })
      assert.equal(rejected.ok, false, `${why}: replacement forbids another ordinary move`)
      assert.deepEqual(state, beforeRejectedMove); assert.deepEqual(rejected.state, beforeRejectedMove)
    }
    if (n === 44) {
      const saved = structuredClone(state)
      const rejected = applyAction(state, { type: 'endTurn' })
      assert.equal(rejected.ok, false, 'Doomsayer immediate choice must resolve before closing')
      assert.deepEqual(state, saved); assert.deepEqual(rejected.state, saved)
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 14)
  assert.equal(state.fen, 'rbb3qr/2ppnk2/1p5p/pnB1pN1p/1PP1P3/P2P1Pp1/1RB3PP/3QKN1R b - - 3 28')
})

test('iteration 129 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/129.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})
