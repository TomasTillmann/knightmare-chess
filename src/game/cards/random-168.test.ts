import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameEvent, GameState, PieceState, SquareName } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Reviewed against rules §§9–11,19.3,20,22.1,22.8 and all eight physical card images.
const rationales = `
1. a2-a4 crosses empty a3, establishes uncapturable a3 EP.
2. White finishes; a3 EP survives, no black pawn can use it.
3. f7-f6 is a single empty forward step; a3 EP expires.
4. Black finishes its completed pawn move.
5. h2-h4 crosses empty h3; no black pawn can use h3 EP.
6. White finishes and retains the h3 opportunity.
7. e7-e6 is an empty forward step, expiring h3 EP.
8. Black finishes the completed e-pawn move.
9. g1-h3 is an unobstructed Knight jump to an empty square.
10. White finishes the Knight move.
11. Black Madman g7-e5 jumps its f6 Pawn without capturing it; replaces the move.
12. Black finishes the replacement move with its card allowance consumed.
13. h3-g1 returns the same white Knight by its ordinary jump.
14. White finishes; Madman grants no continuing movement power.
15. g8-h6 is a black Knight jump to an empty square.
16. Black finishes the Knight move.
17. g2-g3 advances one empty square.
18. White finishes the g-pawn move.
19. f8-c5 follows empty e7,d6 diagonally.
20. Black finishes the Bishop move.
21. f1-g2 develops the white Bishop onto the vacated g2 square.
22. White finishes the Bishop move.
23. d8-e7 is an empty one-square Queen diagonal.
24. Black plays Doomsayer after moving; White receives the immediate naming choice.
25. White names Bishop and loses its f1 identity at g2 to Black; Doomsayer expires.
26. Black finishes after the mandatory naming choice is resolved.
27. e1-f1 moves the white King one safe square and irrevocably removes KQ rights.
28. White finishes its King move with no castling rights.
29. b8-c6 is a black Knight jump onto an empty square.
30. Black finishes the Knight move.
31. c2-c3 is one empty forward Pawn step.
32. White finishes the c-pawn move.
33. e7-d6 is an empty Queen diagonal.
34. Black finishes the Queen move.
35. g1-h3 repeats the legal white Knight jump.
36. White finishes the Knight move.
37. e8-f8 moves the black King safely and removes kq rights.
38. Black finishes; neither side retains castling rights.
39. f2-f4 passes empty f3; no black Pawn on e4/g4 can capture EP.
40. White finishes, retaining the uncapturable f3 opportunity.
41. f8-e7 is a safe adjacent King move and expires f3 EP.
42. Black finishes the King move.
43. d1-b3 follows the empty c2 diagonal.
44. White finishes the Queen move.
45. h6-f5 is a black Knight jump.
46. Black marks its h7 Pawn as Crab after moving; identity and square are unchanged.
47. Black finishes; Crab remains active on h7.
48. f1-e1 is an empty safe King step; castling rights stay lost.
49. White finishes the King move.
50. a7-a5 crosses empty a6; White has no b5 Pawn for EP.
51. Black finishes; a6 EP remains uncapturable.
52. e1-f1 is a safe King step; a6 EP expires.
53. White finishes the King move.
54. b7-b5 crosses empty b6; White has no a5/c5 Pawn for EP.
55. Black finishes; b6 EP remains uncapturable.
56. g3-g4 is an empty Pawn step and expires b6 EP.
57. White finishes the g-pawn move.
58. f5-e3 is a Knight jump giving ordinary check to White King f1.
59. Black Holy War swaps Knight c6 and Bishop c5; White remains checked by e3 Knight.
60. Black finishes; checked White receives its answering turn.
61. f1-g1 is a safe King step escaping the e3 Knight check.
62. White finishes with its King safe on g1.
63. e3-f1 is an empty black Knight jump; it does not attack g1.
64. Black finishes the Knight move.
65. b1-a3 develops White Knight by an ordinary jump.
66. White finishes the Knight move.
67. c6-d5 is the relocated black Bishop moving diagonally one square.
68. Black finishes the Bishop move.
69. a3-b5 captures Black b7 Pawn by a Knight jump; White is the captor.
70. White finishes the capture; halfmove clock stays zero.
71. e7-e8 is a safe King return; castling rights do not return.
72. Black finishes its King move.
73. h4-h5 is an empty Pawn step.
74. White finishes the Pawn move.
75. d6-a6 follows empty c6,b6 along the sixth rank.
76. Black Cathedral swaps Rook h8 and Bishop d5 without capture or a new move.
77. White Vulture immediately takes that exact Cathedral, discards Ghostwalk, draws Legacy.
78. Black finishes; both card allowances reset for White turn.
79. g1-g2 is a safe adjacent King move; f1 Knight attacks h2/g3, not g2.
80. White finishes its King move.
81. c7-c6 is an empty forward black Pawn step.
82. Black finishes the Pawn move.
83. b5-a3 returns White Knight with a jump and no capture.
84. White finishes the Knight move.
85. e8-f8 is a safe adjacent black King move.
86. Black finishes its King move.
87. b3-b7 follows empty b4,b5,b6 on the b-file.
88. White finishes the Queen move.
89. a6-d3 follows empty b5,c4 along a diagonal.
90. Black finishes the Queen move.
91. b7-b3 returns through empty b6,b5,b4.
92. White finishes the Queen move.
93. f6-f5 advances the original black f7 Pawn one empty square.
94. Black finishes the Pawn move.
95. a1-a2 is an empty Rook step.
96. White finishes the Rook move.
97. e5-e4 advances the Madman Pawn normally and crosses toward White over the frontier.
98. White Toll reacts to e5-e4; Black pays its c6 Pawn, captured by White, keeping its move.
99. Black finishes the paid turn; no cancellation or replacement obligation exists.
100. e2-e3 advances into the empty square, between the black Queen and white h3 Knight.
101. White finishes the Pawn move.
102. h8-f6 moves the relocated black Bishop through empty g7.
103. Black finishes the Bishop move.
104. h3-g1 returns White Knight to empty g1 without an opposing capture.
105. White Fireball at g1 captures that Knight, friendly h1 Rook and enemy f1 Knight; royal g2 survives.
106. White finishes with Fireball spent and no extra move.
107. c8-a6 follows empty b7 diagonally.
108. Black finishes the Bishop move.
109. g4-g5 advances into an empty square with the black f5 Pawn beside it; no EP from a single step.
110. White finishes the fiftieth regular move with both Kings safe.
`.trim().split('\n')

const cards: Record<number, [Color, string, string, unknown]> = {
  11: ['black', 'madman', 'black-hand-0-madman', [{ from: 'g7', to: 'e5' }]],
  24: ['black', 'doomsayer', 'black-hand-4-doomsayer', undefined],
  46: ['black', 'crab', 'black-deck-1-crab', 'h7'],
  59: ['black', 'holy-war', 'black-deck-2-holy-war', { knight: 'c6', bishop: 'c5' }],
  76: ['black', 'cathedral', 'black-hand-1-cathedral', { rook: 'h8', bishop: 'd5' }],
  77: ['white', 'vulture', 'white-hand-3-vulture', undefined],
  98: ['white', 'toll', 'white-hand-0-toll', 'c6'],
  105: ['white', 'fireball', 'white-hand-4-fireball', 'g1'],
}

const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const at = (pieces: PieceState[], s: string) => pieces.find(p => p.zone === 'board' && p.square === s)
const other = (c: Color): Color => c === 'white' ? 'black' : 'white'
function attacks(pieces: PieceState[], p: PieceState, to: string): boolean {
  const [x, y] = xy(p.square!), [tx, ty] = xy(to), dx = tx - x, dy = ty - y
  if (!dx && !dy) return false
  if (p.role === 'pawn') return Math.abs(dx) === 1 && dy === (p.owner === 'white' ? 1 : -1)
  if (p.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1
  if (!(p.role !== 'bishop' && (!dx || !dy) || p.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false
  for (let n = 1; n < Math.max(Math.abs(dx), Math.abs(dy)); n++) {
    const s = String.fromCharCode(97 + x + Math.sign(dx) * n) + (y + Math.sign(dy) * n + 1)
    if (at(pieces, s)) return false
  }
  return true
}
function checked(pieces: PieceState[], color: Color): boolean {
  const royal = pieces.find(p => p.royal && p.owner === color)!
  assert.equal(royal.zone, 'board')
  // Crab has ordinary forward diagonal capture geometry; no capture-suppressing effects occur here.
  return pieces.some(p => p.zone === 'board' && p.owner !== color && attacks(pieces, p, royal.square!))
}
function board(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, f) => {
    const p = at(pieces, String.fromCharCode(97 + f) + (8 - i))
    if (!p) return '1'
    const letter = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[p.role]
    return p.owner === 'white' ? letter.toUpperCase() : letter
  }).join('').replace(/1+/g, s => String(s.length))).join('/')
}

test('iteration 168 independent physical, card, turn and royal oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/168.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860168)
  assert.equal(trace.steps.length, 110)
  assert.equal(rationales.length, trace.steps.length)
  let state = createGameState(trace.initial)
  const pieces = structuredClone(state.pieces), players = structuredClone(state.players)
  const history: GameEvent[] = [], playedCards: NonNullable<GameState['playedCards']> = []
  let turn = structuredClone(state.turn), ep: GameState['enPassant'] = [], effects: unknown[] = []
  let shield: GameState['shieldMove'], response: GameState['cardResponse']
  let side: Color = 'white', rights = 'KQkq', half = 0, full = 1
  const capture = (square: string, captor: Color) => {
    const p = at(pieces, square)!
    assert.ok(p && !p.royal)
    p.square = null; p.zone = 'captured'; p.capturedBy = captor
    half = 0
    return p.id
  }
  for (const [index, { action }] of trace.steps.entries()) {
    const n = index + 1, why = rationales[index]!
    assert.ok(why.startsWith(`${n}. `))
    const before = structuredClone(state), beforePieces = structuredClone(pieces)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/)
      const p = at(pieces, from)!, victim = at(pieces, to)
      assert.ok(p); assert.equal(p.owner, turn.color); assert.equal(turn.moveMade, false)
      assert.equal(action.promotion, undefined)
      const [x, y] = xy(from), [tx, ty] = xy(to), dy = ty - y
      if (p.role === 'pawn' && !victim) {
        assert.equal(tx, x)
        assert.ok(dy === (p.owner === 'white' ? 1 : -1) || dy === (p.owner === 'white' ? 2 : -2) && y === (p.owner === 'white' ? 1 : 6))
        if (Math.abs(dy) === 2) assert.equal(at(pieces, from[0] + String((y + ty) / 2 + 1)), undefined)
      } else assert.ok(attacks(pieces, p, to), why)
      if (victim) { assert.notEqual(victim.owner, p.owner); capture(to, p.owner) }
      p.square = to as SquareName
      half = victim || p.role === 'pawn' ? 0 : half + 1
      ep = p.role === 'pawn' && Math.abs(dy) === 2 ? [{ target: (from[0] + String((y + ty) / 2 + 1)) as SquareName, pawnId: p.id }] : []
      if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      if (turn.color === 'black') full++
      side = other(turn.color); turn.phase = 'afterMove'; turn.moveMade = true
      history.push({ type: 'move', from: from as SquareName, to: to as SquareName, ...(victim ? { capturedId: victim.id } : {}) })
      shield = { player: turn.color, pieceIds: [p.id], capturedOpponent: !!victim }
      response = undefined
      assert.equal(checked(pieces, turn.color), false, `${why}: no provisional self-check`)
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true)
      assert.equal(checked(pieces, turn.color), false, why)
      turn = { color: other(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      shield = undefined; response = undefined
    } else if (action.type === 'namePiece') {
      assert.equal(n, 25)
      assert.deepEqual(action, { type: 'namePiece', speaker: 'white', name: 'bishop', losses: [{ effectId: 'black-hand-4-doomsayer', pieceId: 'white-bishop-f1' }] })
      assert.deepEqual(state.pendingDoomsayer, { player: 'white', cardInstanceId: 'black-hand-4-doomsayer' })
      assert.equal(at(pieces, 'g2')!.role, 'bishop')
      capture('g2', 'black'); effects = []
      players.black.discard.push({ id: 'black-hand-4-doomsayer', cardId: 'doomsayer' })
      history.push({ type: 'pieceNamed', speaker: 'white', name: 'bishop', capturedIds: ['white-bishop-f1'], resolvedEffectIds: ['black-hand-4-doomsayer'] })
      // Naming advances history, so the retained card response token is stale.
      assert.ok(response && response.historyLength < history.length)
    } else {
      assert.equal(action.type, 'playCard')
      if (action.type !== 'playCard') throw new Error('unreviewed action')
      const [owner, id, instance, target] = cards[n]!
      assert.deepEqual(action, { type: 'playCard', cardId: id, cardInstanceId: instance, ...(target === undefined ? {} : { target }) })
      const timing = n === 11 ? 'beforeMove' : n === 77 ? 'afterOpponentCard' : n === 98 ? 'afterOpponentMove' : 'afterMove'
      assert.ok(CARD_CATALOG[id]!.timing.includes(timing))
      assert.equal(turn.phase, n === 11 ? 'beforeMove' : 'afterMove')
      assert.equal(turn.color, n === 77 || n === 98 ? other(owner) : owner)
      if (n === 77) assert.deepEqual(response, { player: 'black', historyLength: history.length })
      assert.equal(turn.cardPlays[owner], 0)
      const handIndex = players[owner].hand.findIndex(c => c.id === instance)
      assert.ok(handIndex >= 0)
      const card = players[owner].hand.splice(handIndex, 1)[0]!
      assert.equal(card.cardId, id)
      if (n === 77) {
        const top = players.white.deck.shift()!
        assert.deepEqual(top, { id: 'white-deck-0-ghostwalk', cardId: 'ghostwalk' })
        players.white.discard.push(top)
      }
      players[owner].hand.push(players[owner].deck.shift()!)
      if (n !== 24 && n !== 46) players[owner].discard.push(card)
      turn.cardPlays[owner]++
      const event: GameEvent = { type: 'cardPlayed', cardId: id, ...(target === undefined ? {} : { target: target as GameEvent['target'] }), movement: [], preservePreviousMove: n !== 11 }
      if (n === 11) {
        assert.equal(at(pieces, 'g7')!.role, 'pawn'); assert.ok(at(pieces, 'f6')); assert.equal(at(pieces, 'e5'), undefined)
        at(pieces, 'g7')!.square = 'e5'; event.movement = [{ from: 'g7', to: 'e5' }]
        turn.phase = 'afterMove'; turn.moveMade = true; half = 0; full++; side = 'white'; ep = []
        shield = { player: 'black', pieceIds: ['black-pawn-g7'], capturedOpponent: false }
      }
      if (n === 24) effects = [{ type: 'doomsayer', owner, card }]
      if (n === 46) { assert.equal(at(pieces, 'h7')!.id, 'black-pawn-h7'); effects = [{ type: 'crab', owner, card, pieceId: 'black-pawn-h7' }] }
      if (n === 59 || n === 76) {
        const a = at(pieces, n === 59 ? 'c6' : 'd5')!, b = at(pieces, n === 59 ? 'c5' : 'h8')!
        assert.equal(a.owner, owner); assert.equal(b.owner, owner)
        assert.equal(a.role, n === 59 ? 'knight' : 'bishop'); assert.equal(b.role, n === 59 ? 'bishop' : 'rook')
        const sa = a.square!, sb = b.square!; a.square = sb; b.square = sa
        event.movement = [{ from: sa, to: sb }, { from: sb, to: sa }]
      }
      if (n === 77) {
        const taken = players.black.discard.pop()!
        assert.deepEqual(taken, { id: 'black-hand-1-cathedral', cardId: 'cathedral' })
        players.white.hand.push(taken); event.player = 'white'
      }
      if (n === 98) {
        assert.deepEqual(history.at(-1), { type: 'move', from: 'e5', to: 'e4' })
        assert.equal(at(pieces, 'c6')!.role, 'pawn')
        event.player = 'white'; event.capturedId = capture('c6', 'white')
      }
      if (n === 105) {
        assert.deepEqual(shield, { player: 'white', pieceIds: ['white-knight-g1'], capturedOpponent: false })
        const center = at(pieces, 'g1')!, [cx, cy] = xy(center.square!)
        const blast = pieces.filter(p => p.square && !p.royal && Math.max(Math.abs(xy(p.square)[0] - cx), Math.abs(xy(p.square)[1] - cy)) <= 1)
        assert.deepEqual(blast.map(p => p.id), ['white-knight-g1', 'white-rook-h1', 'black-knight-g8'])
        event.capturedIds = blast.map(p => capture(p.square!, 'white')); event.player = 'white'
        assert.equal(at(pieces, 'g2')!.royal, true)
      }
      assert.equal(checked(pieces, owner), false, why)
      history.push(event); playedCards.push({ player: owner, cardInstanceId: instance })
      response = { player: owner, historyLength: history.length }
    }
    const result = applyAction(state, action)
    assert.deepEqual(state, before, `${why}: complete input immutability`)
    assert.equal(result.ok, true, why)
    state = result.state
    assert.deepEqual(state.pieces, pieces, `${why}: full physical identities and captors`)
    assert.deepEqual(state.players, players, `${why}: exact physical card zones`)
    assert.deepEqual(state.turn, turn, why)
    assert.deepEqual(state.history, history, `${why}: complete events`)
    assert.deepEqual(state.playedCards ?? [], playedCards)
    assert.deepEqual(state.cardResponse, response)
    assert.deepEqual(state.shieldMove, shield, `${why}: physical move token`)
    assert.deepEqual(state.effects, effects)
    assert.deepEqual(state.enPassant, ep)
    assert.equal(state.fen, `${board(pieces)} ${side[0]} ${rights || '-'} - ${half} ${full}`, `${why}: six FEN fields`)
    assert.equal(state.orientation, 0); assert.equal(state.outcome, null)
    assert.equal(state.pendingRescue ?? null, null)
    assert.equal(state.pendingAbduction ?? null, null)
    assert.deepEqual(state.pendingDoomsayer ?? null, n === 24 ? { player: 'white', cardInstanceId: 'black-hand-4-doomsayer' } : null)
    assert.deepEqual(state.underElfHill ?? [], [])
    for (const key of ['chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(state[key], undefined, `${why}: ${key}`)
    for (const key of ['plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(state[key] ?? [], [], `${why}: ${key}`)
    for (const color of ['white', 'black'] as const) {
      const saved = structuredClone(state)
      assert.equal(isKingInCheck(state, color), checked(pieces, color), `${why}: independent ${color} attacks`)
      assert.deepEqual(state, saved, 'royal probe is immutable')
    }
    assert.equal(checked(pieces, 'white'), n >= 58 && n <= 60)
    assert.equal(checked(pieces, 'black'), false)
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!, captor = other(victim.owner)
      const candidates = pieces.filter(p => p.zone === 'board' && p.owner === captor && p.role === 'pawn' && attacks(pieces, p, opportunity.target))
      // The five double advances all lack an adjacent enemy Pawn; raw EP records are not legal captures.
      assert.deepEqual(candidates, [])
      const probe = structuredClone(state)
      probe.turn = { color: captor, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      const saved = structuredClone(probe), destinations = legalDests(probe)
      for (const p of pieces.filter(p => p.square && p.owner === captor && p.role === 'pawn')) {
        if (destinations.get(p.square!)?.includes(opportunity.target)) {
          const hypothetical = structuredClone(pieces), moving = hypothetical.find(q => q.id === p.id)!, passed = hypothetical.find(q => q.id === victim.id)!
          assert.ok(attacks(hypothetical, moving, opportunity.target))
          moving.square = opportunity.target; passed.square = null; passed.zone = 'captured'; passed.capturedBy = captor
          assert.equal(checked(hypothetical, captor), false)
          assert.fail('unexpected en-passant capture in reviewed trace')
        }
      }
      assert.deepEqual(probe, saved, 'EP probe input immutability')
    }
    if (action.type === 'endTurn' || action.type === 'playCard' && [24, 46, 77].includes(n)) assert.deepEqual(pieces, beforePieces)
    if (n === 25) {
      const saved = structuredClone(state)
      const staleReaction = applyAction(state, { type: 'playCard', cardId: 'vulture', cardInstanceId: 'white-hand-3-vulture' })
      assert.equal(staleReaction.ok, false, 'naming closed the opposing-card response window')
      assert.deepEqual(state, saved, 'stale response probe input immutability')
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(playedCards.length, 8)
  assert.equal(state.fen, 'r4k2/3p3p/b3pb2/p1nr1pPP/P3pP2/NQPqP3/RP1P2K1/2B5 b - - 0 26')
})

test('iteration 168 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/168.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})
