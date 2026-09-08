import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, PieceState, SquareName, GameState } from '../types.js'

// Independently reviewed against rules §§8–11, 13.12, 15.3, 21 and
// KC10_card4, KC11_card2, KC14_card4. Every row also checks both royal threats,
// exact physical identities/captors, all six FEN fields, and dormant obligations.
const rationales = `
1. White Ng1-f3 is an unobstructed knight jump; clocks become 1/1.
2. End White turn; Black receives its move, no card draw.
3. Black Nb8-c6 is a knight jump; fullmove becomes 2.
4. End Black turn; White receives its move.
5. Evangelists swaps White Bc1 with Black Bf8 without capture; replacement move, discard and draw Madman.
6. End White replacement turn; clear both card allowances.
7. Black d7-d5 crosses empty d6; physical EP d6 exists but no White pawn can use it.
8. End Black turn; retain that physical EP opportunity.
9. White g2-g3 is one forward square; old EP expires.
10. End White turn with unchanged board and clocks.
11. Black h7-h5 crosses h6; physical EP h6 is uncapturable.
12. End Black turn retaining EP until the move.
13. White h2-h4 crosses h3; physical EP h3 replaces h6 and remains uncapturable.
14. End White turn retaining h3 opportunity.
15. Black Bc8-f5 crosses empty d7/e6 diagonally; old EP expires.
16. After-move Coup makes Ng8 royal and Ke8 a capturable Prince; active card draws Betrayal, no move or clock change.
17. End Black turn; Coup persists and card allowance resets.
18. White Nb1-a3 is a knight jump; Black royal remains g8.
19. End White turn; no effect changes.
20. Black Qd8-b8 crosses vacated c8 horizontally.
21. End Black turn; both royal identities remain safe.
22. White Qd1-c1 captures the exchanged Black Bf8 identity; capturedBy White, halfmove resets.
23. End White turn; captured bishop remains captured.
24. Black Bf5-c8 returns through empty e6/d7 diagonally.
25. End Black turn without card draws.
26. White Rh1-h3 crosses vacated h2; White kingside right is lost.
27. End White turn; lost castling right stays lost.
28. Black Nc6-e5 is a knight jump.
29. End Black turn; Coup persists.
30. White Bf1-g2 moves one diagonal into its vacated pawn square.
31. End White turn; bishop identity retained.
32. Black Rh8-h6 crosses vacated h7; Black kingside right is lost.
33. End Black turn; Black queenside right remains dormant under Coup.
34. White Rh3-h2 moves one vertical square.
35. End White turn with no draw.
36. Black Bc8-h3 follows clear d7/e6/f5/g4 diagonal.
37. End Black turn with no capture or effect change.
38. White b2-b4 crosses b3; EP b3 has no legal Black captor.
39. End White turn retaining physical b3 opportunity.
40. Black f7-f5 crosses f6; replace EP with uncapturable f6.
41. End Black turn retaining f6 opportunity.
42. White g3-g4 advances one square, expiring EP.
43. End White turn; no card expenditure.
44. Black Ne5-c4 jumps without capture.
45. End Black turn; no pending choice.
46. White Rh2-h1 returns; castling right cannot be regained.
47. End White turn with unchanged clocks.
48. Black Nc4-e3 jumps into empty e3.
49. End Black turn; White royal e1 is not attacked by Ne3.
50. White Qc1-b1 moves one horizontal square.
51. End White turn; no capture or card draw.
52. Black h5xg4 is a forward-diagonal pawn capture of White g-pawn; capturedBy Black.
53. End Black turn; capture and zero halfmove persist.
54. White Nf3-e5 jumps into empty e5.
55. End White turn; g8 royal is safe.
56. Black Ne3-f1 is a knight jump, not a Prince or royal move.
57. End Black turn; White e1 is not attacked by Nf1.
58. White Qb1-b2 advances into its vacated pawn square.
59. End White turn; no card draw.
60. Black Prince e8-d8 moves one square; original King's remaining castling right is lost.
61. End Black turn; only White queenside right remains.
62. White d2-d3 advances one square, resetting halfmove.
63. End White turn; Coup remains unchanged.
64. Black Rh6-a6 crosses clear g6/f6/e6/d6/c6/b6 rank.
65. End Black turn; no capture occurs.
66. White c2-c3 advances one square.
67. End White turn with no mandatory choice.
68. Black Ra6-a5 advances one vertical square into empty a5.
69. End Black turn; both royals remain safe.
70. White e2-e4 crosses e3; EP e3 is physically recorded but has no legal captor.
71. End White turn retaining physical e3 opportunity.
72. Black Prince d8-e8 returns; no castling right restored and EP expires.
73. End Black turn; Ng8 remains the King.
74. Sanctuary replaces White move: clear e1-a1 line, Ra1-d1 and Ke1-c1, discard/draw Man of Straw; revoke White rights.
75. End White replacement turn; no pending rescue, allowances reset.
76. Black Bh3xg2 captures White Bf1 identity diagonally; capturedBy Black.
77. End Black turn; White royal c1 remains safe.
78. White Bf8xe7 captures Black e-pawn diagonally; capturedBy White.
79. End White turn; e7 bishop does not attack Black royal g8.
80. Black Prince e8-f8 moves onto a square attacked by Be7; legal because Prince is capturable and Ng8 stays safe.
81. End Black turn; Prince safety is not royal safety.
82. White h4-h5 advances into vacated h5.
83. End White turn; no promotion or EP.
84. Black a7-a6 advances one square, stopping above its rook a5.
85. End Black turn; no capture or card change.
86. White Rh1-g1 moves one horizontal square.
87. End White turn; Black royal g8 remains protected from the rook by its pawn g7.
88. Black Prince f8xe7 captures the White c1-bishop identity; capturedBy Black; Ng8 remains safe.
89. End Black turn; Prince remains nonroyal.
90. White e4xf5 captures Black f-pawn one forward diagonal; capturedBy White.
91. End White turn; no EP opportunity remains.
92. Black Prince e7-e8 moves one square, retaining its physical identity.
93. End Black turn; White royal remains c1.
94. White Na3-c4 is a knight jump.
95. End White turn; no new threat to g8.
96. Black Bg2-h1 moves one diagonal into empty h1.
97. End Black turn; White c1 remains safe.
98. White Qb2-a1 moves one diagonal into vacated rook square.
99. End White turn; no card allowance consumed.
100. Black Ra5-c5 crosses empty b5 horizontally.
101. End Black turn; knight c4 does not obstruct rank five.
102. White Rg1xf1 captures Black b8-knight identity; capturedBy White and halfmove reset.
103. End White turn; captured knight is not the Coup King.
104. Black royal Ng8-f6 makes a knight jump to a safe square; Prince e8 remains nonroyal.
105. End Black turn; White to move, halfmove 1 and fullmove 27.
`.trim().split('\n')

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white'
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.zone === 'board' && p.square === square)
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x, y] = xy(piece.square!), [tx, ty] = xy(to)
  const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy)
  if (!ax && !ay) return false
  if (piece.role === 'knight') return ax * ay === 2
  if (piece.role === 'king') return Math.max(ax, ay) === 1
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1
    if (capture) return ax === 1 && dy === forward
    if (ax) return false
    if (dy === forward) return !at(pieces, to)
    return dy === 2 * forward && (piece.owner === 'white' ? y <= 1 : y >= 6)
      && !at(pieces, to) && !at(pieces, `${String.fromCharCode(97 + x)}${y + forward + 1}`)
  }
  if (piece.role === 'bishop' && ax !== ay) return false
  if (piece.role === 'rook' && dx !== 0 && dy !== 0) return false
  if (piece.role === 'queen' && ax !== ay && dx !== 0 && dy !== 0) return false
  for (let i = 1; i < Math.max(ax, ay); i++) {
    if (at(pieces, `${String.fromCharCode(97 + x + Math.sign(dx) * i)}${y + Math.sign(dy) * i + 1}`)) return false
  }
  return true
}
function threatened(pieces: PieceState[], color: Color): boolean {
  const royal = pieces.find(p => p.owner === color && p.royal && p.zone === 'board')!
  assert.ok(royal)
  // This trace has no neutral pieces or capture restrictions; Coup preserves geometry.
  assert.ok(pieces.every(p => !p.neutral))
  return pieces.some(p => p.zone === 'board' && p.owner !== color && reaches(pieces, p, royal.square!, true))
}
function placement(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, i) => {
    let result = '', empty = 0
    for (let x = 0; x < 8; x++) {
      const p = at(pieces, `${String.fromCharCode(97 + x)}${8 - i}`)
      if (!p) { empty++; continue }
      if (empty) { result += empty; empty = 0 }
      const symbol = ({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' })[p.role]
      result += p.owner === 'white' ? symbol.toUpperCase() : symbol
    }
    return result + (empty || '')
  }).join('/')
}

test('iteration 140 deterministic campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/140.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.steps.length, 105)
  assert.equal(rationales.length, trace.steps.length)
  let state = createGameState(trace.initial)
  const pieces: PieceState[] = []
  const roles = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'] as const
  for (const owner of ['white', 'black'] as const) for (let file = 0; file < 8; file++) {
    for (const role of [roles[file]!, 'pawn'] as const) {
      const rank = owner === 'white' ? (role === 'pawn' ? 2 : 1) : (role === 'pawn' ? 7 : 8)
      const square = `${String.fromCharCode(97 + file)}${rank}` as SquareName
      pieces.push({ id: `${owner}-${role}-${square}`, owner, role, originalRole: role, square,
        zone: 'board', promoted: false, royal: role === 'king', neutral: false })
    }
  }
  const players = structuredClone(state.players)
  let turn: GameState['turn'] = { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
  let rights = 'KQkq', halfmove = 0, fullmove = 1, fenColor = 'w'
  let ep: GameState['enPassant'] = [], effects: unknown[] = []
  let shieldMove: GameState['shieldMove']
  let historyLength = 0, cardResponse: GameState['cardResponse']
  for (const [index, { action }] of trace.steps.entries()) {
    const row = index + 1, reason = rationales[index]!
    assert.ok(reason.startsWith(`${row}. `))
    const before = structuredClone(state), actor = turn.color
    if (action.type === 'move') {
      historyLength++; cardResponse = undefined
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/)
      assert.equal(turn.moveMade, false)
      const piece = at(pieces, from)!, victim = at(pieces, to)
      assert.ok(piece, reason); assert.equal(piece.owner, actor, reason)
      assert.ok(reaches(pieces, piece, to, !!victim), reason)
      shieldMove = { player: actor, pieceIds: [piece.id], capturedOpponent: !!victim }
      if (victim) {
        assert.notEqual(victim.owner, actor); assert.equal(victim.royal, false)
        victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor
      }
      if (piece.originalRole === 'king') rights = rights.replace(actor === 'white' ? /[KQ]/g : /[kq]/g, '')
      for (const [id, right] of [['white-rook-h1', 'K'], ['white-rook-a1', 'Q'], ['black-rook-h8', 'k'], ['black-rook-a8', 'q']]) {
        if (piece.id === id || victim?.id === id) rights = rights.replace(right!, '')
      }
      ep = []
      if (piece.role === 'pawn' && Math.abs(Number(from[1]) - Number(to[1])) === 2) {
        ep = [{ target: `${from[0]}${(Number(from[1]) + Number(to[1])) / 2}` as SquareName, pawnId: piece.id }]
      }
      halfmove = piece.role === 'pawn' || victim ? 0 : halfmove + 1
      piece.square = to as SquareName
      if (actor === 'black') fullmove++
      fenColor = actor === 'white' ? 'b' : 'w'
      turn.phase = 'afterMove'; turn.moveMade = true
    } else if (action.type === 'playCard') {
      historyLength++; cardResponse = { player: actor, historyLength }
      assert.equal(turn.cardPlays[actor], 0)
      const player = players[actor], position = player.hand.findIndex(c => c.id === action.cardInstanceId)
      assert.ok(position >= 0)
      const card = player.hand.splice(position, 1)[0]!
      assert.equal(card.cardId, action.cardId)
      if (row === 16) {
        assert.equal(action.cardId, 'coup'); assert.equal(turn.phase, 'afterMove'); assert.equal(action.target, 'g8')
        const prince = at(pieces, 'e8')!, king = at(pieces, 'g8')!
        assert.equal(prince.royal, true); assert.equal(king.role, 'knight')
        prince.royal = false; king.royal = true
        effects = [{ type: 'coup', owner: 'black', card, princeId: prince.id, kingId: king.id, princeRole: 'king' }]
      } else {
        assert.equal(turn.phase, 'beforeMove')
        if (row === 5) {
          assert.equal(action.cardId, 'evangelists'); assert.deepEqual(action.target, { own: 'c1', opponent: 'f8' })
          const own = at(pieces, 'c1')!, opponent = at(pieces, 'f8')!
          assert.equal(own.role, 'bishop'); assert.equal(opponent.role, 'bishop')
          assert.equal(own.owner, 'white'); assert.equal(opponent.owner, 'black')
          own.square = 'f8'; opponent.square = 'c1'
        } else {
          assert.equal(row, 74); assert.equal(action.cardId, 'sanctuary')
          assert.deepEqual(action.target, { king: 'e1', rook: 'a1' })
          for (const square of ['b1', 'c1', 'd1']) assert.equal(at(pieces, square), undefined)
          const king = at(pieces, 'e1')!, rook = at(pieces, 'a1')!
          assert.equal(king.royal, true); assert.equal(rook.role, 'rook')
          king.square = 'c1'; rook.square = 'd1'; rights = rights.replace(/[KQ]/g, '')
        }
        player.discard.push(card); halfmove++; ep = []; fenColor = 'b'
        shieldMove = { player: actor, capturedOpponent: false,
          pieceIds: row === 5 ? [] : ['white-rook-a1', 'white-king-e1'] }
        turn.moveMade = true; turn.phase = 'afterMove'
      }
      player.hand.push(player.deck.shift()!); turn.cardPlays[actor]++
    } else {
      assert.equal(action.type, 'endTurn'); assert.equal(turn.moveMade, true)
      turn = { color: opposite(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      shieldMove = undefined
      cardResponse = undefined
    }
    const result = applyAction(state, action)
    assert.deepEqual(state, before, `${reason}: input immutability`)
    assert.ok(result.ok, reason); state = result.state
    assert.deepEqual([...state.pieces].sort((a, b) => a.id.localeCompare(b.id)), [...pieces].sort((a, b) => a.id.localeCompare(b.id)), reason)
    assert.deepEqual(state.players, players, `${reason}: exact hand/deck/discard identities`)
    assert.deepEqual(state.turn, turn, reason); assert.deepEqual(state.effects, effects, reason)
    assert.equal(state.history.length, historyLength, `${reason}: action history`)
    assert.deepEqual(state.cardResponse, cardResponse, `${reason}: immediate card response window`)
    for (const color of ['white', 'black'] as const) {
      const check = threatened(pieces, color)
      assert.equal(check, false, `${reason}: independent ${color} royal safety`)
      assert.equal(isKingInCheck(state, color), check, reason)
    }
    // Physical EP records persist through endTurn; this trace never has a legal EP capture.
    const nextActor: Color = fenColor === 'w' ? 'white' : 'black'
    for (const opportunity of ep) {
      const candidates = pieces.filter(p => p.zone === 'board' && p.owner === nextActor && p.role === 'pawn'
        && reaches(pieces, p, opportunity.target, true))
      assert.deepEqual(candidates, [], `${reason}: independent legal EP availability`)
      if (!state.turn.moveMade) {
        const destinations = legalDests(state)
        for (const p of pieces.filter(p => p.zone === 'board' && p.owner === nextActor && p.role === 'pawn')) {
          assert.ok(!(destinations.get(p.square!) ?? []).includes(opportunity.target), reason)
        }
      }
    }
    assert.deepEqual(state.enPassant, ep, reason)
    assert.equal(state.fen, `${placement(pieces)} ${fenColor} ${rights || '-'} - ${halfmove} ${fullmove}`, `${reason}: six FEN fields`)
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null)
    assert.deepEqual(state.shieldMove, shieldMove, `${reason}: exact prior movement for reactions`)
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, `${reason}: ${key}`)
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves', 'underElfHill'] as const) assert.deepEqual(state[key] ?? [], [], `${reason}: ${key}`)
    for (const key of ['pendingRescue', 'pendingAbduction', 'pendingDoomsayer'] as const) assert.equal(state[key] ?? null, null, `${reason}: ${key}`)
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 3)
  assert.equal(state.fen, 'rq2k3/1pp3p1/p4n2/2rpNP1P/1PN3p1/2PP4/P4P2/Q1KR1R1b w - - 1 27')
  assert.deepEqual(replayTrace(trace), state)
})
