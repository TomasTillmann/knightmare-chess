import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { createGameState } from '../state.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import type { GameState, PieceState, SquareName, Color } from '../types.js'

// Read in order from the physical board and rules §§11, 13, 17, 18, 19, 21, 22.
const rationales = `
1. b2-b3 is a white Pawn single step into an empty square.
2. White closes its completed move; Black receives a fresh allowance.
3. c7-c6 is a black Pawn single step.
4. Black closes the move; fullmove already advanced to 2.
5. g2-g4 crosses empty g3; g3 is an opportunity but no black Pawn can take it.
6. EndTurn preserves that opportunity until Black moves.
7. g8-f6 is an unobstructed Knight jump and expires g3.
8. Cathedral exchanges Black Ra8 and Bc8 after the move, preserving identities and clocks.
9. EndTurn resets Cathedral's allowance; no movement is added.
10. Bf1-h3 follows empty g2 on its diagonal.
11. White ends its completed Bishop move.
12. d7-d6 is a black Pawn single step.
13. Black ends its completed Pawn move.
14. Ng1-f3 is a Knight jump to empty f3.
15. White ends its completed Knight move.
16. Nb8-a6 is a Knight jump to empty a6.
17. Black ends its completed Knight move.
18. Nf3-e5 is a Knight jump to empty e5.
19. White ends its completed Knight move.
20. h7-h6 advances Black's Pawn into an empty square.
21. Black ends its completed Pawn move.
22. Rh1-g1 moves one file and loses White's kingside right.
23. Holy Quest exchanges opposing Bf8 and Na6 after White's move without captures.
24. White ends with the same clocks and exchanged identities.
25. Masquerade moves Black Nf6 as a Queen through f5 and f4 to empty f3; it checks Ke1.
26. Black ends its replacement move; White must answer the Knight's check.
27. e2xf3 captures that black Knight diagonally and clears check; White is the captor.
28. White closes its capture and Black receives the turn.
29. Rh8-h7 moves one rank and removes Black's kingside right.
30. Black closes its Rook move.
31. Rg1-h1 returns without restoring castling rights.
32. White closes its Rook move.
33. Nf8-e6 is a Knight jump after Holy Quest's exchange.
34. Black closes its Knight move.
35. Ne5-g6 is a Knight jump into an empty square.
36. White closes its Knight move.
37. b7-b5 crosses empty b6; no White Pawn can take en passant.
38. EndTurn preserves b6 until White's move.
39. Ke1-e2 enters the vacated Pawn square and revokes White's remaining right.
40. White closes the King move; b6 has expired.
41. Ba6-b7 moves diagonally into the vacated Pawn square.
42. Abduction selects White's nonroyal Pawn g4; concealment is temporary absence, not capture.
43. Reveal opens recall without another card expenditure or board change.
44. White names the exact Pawn and g4 correctly, restoring its complete identity.
45. Black closes the restored Abduction position.
46. Qd1-g1 crosses empty e1 and f1.
47. White closes its Queen move.
48. Rc8-b8 moves the original a8 Rook and extinguishes the remaining castling right.
49. Black closes its Rook move.
50. The original e2 Pawn advances f3-f4 without capture.
51. White closes its Pawn move.
52. Ne6-d4 is a Knight jump checking White Ke2.
53. Black ends; White receives the checked position.
54. Ke2-d3 escapes the Knight's attack by one diagonal step.
55. White closes its safe King move.
56. Ke8-d7 is one diagonal step into a safe empty square.
57. Black closes its King move.
58. Hidden Passage relocates White Kd3 to empty safe g3 and consumes its move.
59. White closes the replacement move with no additional clock advance.
60. Black's Plots grants two immediate plays. Held Disintegration can remove Black Pa7 safely; Peace Talks has no Continuing Effect to cancel, Toll has no immediate frontier-crossing trigger after White ended its turn, and Fireball has no completed Black move this turn. Plots itself is spent, and newly drawn Bog was not in the saved hand, so only Disintegration qualifies.
61. b5-b4 is a normal Pawn step and closes all unused Plots plays.
62. Black closes its move and resets the allowance.
63. Kg3-h4 is one safe diagonal step.
64. White closes its King move.
65. a7-a6 is a noncapturing Pawn move.
66. Fireball centers on that moved Pawn a6; only a6 and adjacent Bb7 are occupied in its blast.
67. Black closes with both friendly victims captured by Black, not dead.
68. Qg1-f1 moves one file without capture.
69. White closes its Queen move.
70. Nd4-f3 is a Knight jump into empty f3 and checks White Kh4.
71. Black closes its checking Knight move.
72. Kh4-h5 escapes Nf3; the h6 Pawn attacks g5, not h5.
73. White closes its King move.
74. Nf3-e5 is a Knight jump into empty e5.
75. Black closes its Knight move.
76. Assassin allows White Ra1 to capture its own Nb1 using Rook geometry, consuming the move.
77. White closes with its Knight captured by White and no restored rights.
78. Ne5xg6 captures White's other Knight; Black is the captor.
79. Black ends the immediate capture window without Hostage.
80. g4-g5 advances a Pawn and opens Bh3-g4-f5-e6-d7 check against Black.
81. White closes the checking Pawn move.
82. Qd8-g8 crosses e8 and f8 but leaves Kd7 checked; §11.6 requires a saving card.
83. Challenge names movable White Rb1; §11.7 suppresses the other white pieces' captures and saves Kd7.
84. Black ends with White bound to use the original a1 Rook.
85. Rb1-a1 satisfies Challenge; expiry restores Bh3's check against Black Kd7.
86. White closes its Rook move; Black must answer the restored check.
87. f7-f5 crosses f6 and blocks Bh3's diagonal; g5xf6 en passant is available and safe.
88. Black ends, preserving the f6 opportunity for White.
89. Evil Eye uses Bh3 through g4 to threaten and capture Black Pf5 without moving the Bishop; check is allowed, mate is not.
90. White ends its stationary replacement capture; Black must answer Bh3's check.
91. e7-e6 blocks the h3-d7 diagonal and answers the check.
92. Black closes its Pawn block.
93. f4-f5 advances White's original e2 Pawn.
94. White closes its Pawn move.
95. Ng6-e5 is a Knight jump into an empty square.
96. Black closes its Knight move.
97. f2-f4 crosses empty f3; no black Pawn can capture en passant there.
98. White ends; f3 opportunity survives until Black's reply.
99. Rb8-c8 moves one file and expires f3.
100. Black closes its Rook move.
101. d2-d4 crosses empty d3; no black Pawn can capture en passant there.
102. White closes its Pawn move while retaining d3 availability.
103. Kd7-e7 moves to a safe neighboring square and expires d3.
104. Black closes its King move.
105. Qf1-g2 moves one diagonal step.
106. Black's immediate Chaos returns Qg2 to f1 and restores White's pre-move clocks and opportunity; f1-g2 is forbidden.
107. Ra1-b1 is a different physical movement and ends the Chaos prohibition.
108. White closes its replacement choice; Black's next allowance resets.
109. Rc8-b8 moves one file into an empty square.
110. Black closes its Rook move.
111. a2-a3 advances White's Pawn one square.
112. White closes its Pawn move.
113. Qg8-e8 crosses empty f8 and checks Kh5 through f7 and g6.
114. Black closes its checking Queen move.
115. g5-g6 blocks Qe8's diagonal to Kh5 without capture or promotion.
116. White ends the fiftieth move command; Black is next with no unresolved obligation.
`.trim().split('\n')

const cards: Record<number, { cardId: string; target?: unknown }> = {
  8: { cardId: 'cathedral', target: { rook: 'a8', bishop: 'c8' } },
  23: { cardId: 'holy-quest', target: { bishop: 'f8', knight: 'a6' } },
  25: { cardId: 'masquerade', target: [{ from: 'f6', to: 'f3' }] },
  42: { cardId: 'abduction', target: 'g4' },
  58: { cardId: 'hidden-passage', target: [{ from: 'd3', to: 'g3' }] },
  60: { cardId: 'plots-within-plots', target: { player: 'black' } },
  66: { cardId: 'fireball', target: 'a6' },
  76: { cardId: 'assassin', target: [{ from: 'a1', to: 'b1' }] },
  83: { cardId: 'challenge', target: 'b1' },
  89: { cardId: 'evil-eye', target: { attacker: 'h3', victim: 'f5' } },
  106: { cardId: 'chaos' },
}
const moves = `b2b3 c7c6 g2g4 g8f6 f1h3 d7d6 g1f3 b8a6 f3e5 h7h6 h1g1 e2f3 h8h7 g1h1 f8e6 e5g6 b7b5 e1e2 a6b7 d1g1 c8b8 f3f4 e6d4 e2d3 e8d7 b5b4 g3h4 a7a6 g1f1 d4f3 h4h5 f3e5 e5g6 g4g5 d8g8 b1a1 f7f5 e7e6 f4f5 g6e5 f2f4 b8c8 d2d4 d7e7 f1g2 a1b1 c8b8 a2a3 g8e8 g5g6`.split(' ')
// Actor, turn owner, printed timing window: Chaos alone responds during the opponent's turn.
const cardWindows: Record<number, [Color, Color, 'beforeMove' | 'afterMove']> = {
  8: ['black', 'black', 'afterMove'], 23: ['white', 'white', 'afterMove'],
  25: ['black', 'black', 'beforeMove'], 42: ['black', 'black', 'afterMove'],
  58: ['white', 'white', 'beforeMove'], 60: ['black', 'black', 'beforeMove'],
  66: ['black', 'black', 'afterMove'], 76: ['white', 'white', 'beforeMove'],
  83: ['black', 'black', 'afterMove'], 89: ['white', 'white', 'beforeMove'],
  106: ['black', 'white', 'afterMove'],
}

const xy = (square: string) => {
  assert.match(square, /^[a-h][1-8]$/)
  return [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const
}
function reaches(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square)
  const [x, y] = xy(piece.square), [a, b] = xy(to), dx = a - x, dy = b - y
  if (!dx && !dy) return false
  const occupied = (f: number, r: number) => pieces.some(p => p.zone === 'board' && p.square === `${String.fromCharCode(97 + f)}${r + 1}`)
  if (piece.role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2
  if (piece.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1
    if (capture) return Math.abs(dx) === 1 && dy === forward
    return dx === 0 && !occupied(a, b) && (dy === forward || dy === forward * 2
      && y === (piece.owner === 'white' ? 1 : 6) && !occupied(x, y + forward))
  }
  const straight = dx === 0 || dy === 0, diagonal = Math.abs(dx) === Math.abs(dy)
  if (!(piece.role === 'rook' ? straight : piece.role === 'bishop' ? diagonal : straight || diagonal)) return false
  for (let j = 1; j < Math.max(Math.abs(dx), Math.abs(dy)); j++) {
    if (occupied(x + Math.sign(dx) * j, y + Math.sign(dy) * j)) return false
  }
  return true
}
function threatened(pieces: PieceState[], color: Color, challenge = false): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!
  assert.ok(king.square)
  return pieces.some(p => p.zone === 'board' && p.owner !== color
    && (!challenge || p.owner !== 'white' || p.id === 'white-rook-a1')
    && reaches(pieces, p, king.square!, true))
}
function board(pieces: PieceState[]): string {
  return Array.from({ length: 8 }, (_, i) => {
    let rank = '', empty = 0
    for (let file = 0; file < 8; file++) {
      const p = pieces.find(p => p.zone === 'board' && p.square === `${String.fromCharCode(97 + file)}${8 - i}`)
      if (!p) { empty++; continue }
      if (empty) { rank += empty; empty = 0 }
      const letter = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[p.role]
      rank += p.owner === 'white' ? letter.toUpperCase() : letter
    }
    return rank + (empty || '')
  }).join('/')
}

test('iteration 154 independently reviewed physical and rules oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/154.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860154)
  assert.equal(trace.steps.length, rationales.length)
  let actual = createGameState(trace.initial)
  let pieces = structuredClone(actual.pieces), players = structuredClone(actual.players), turn = structuredClone(actual.turn)
  let active = 'w', rights = 'KQkq', half = 0, full = 1
  let enPassant: GameState['enPassant'] = []
  let snapshot: { pieces: PieceState[]; active: string; half: number; full: number } | undefined
  let abductionBefore: GameState | undefined
  let moveIndex = 0
  const at = (square: string) => { const p = pieces.find(p => p.square === square && p.zone === 'board'); assert.ok(p, square); return p }
  const capture = (p: PieceState, color: Color) => { assert.equal(p.royal, false); p.square = null; p.zone = 'captured'; p.capturedBy = color }
  const move = (from: string, to: string, ownCapture = false, queen = false, teleport = false) => {
    const p = at(from), victim = pieces.find(p => p.zone === 'board' && p.square === to)
    assert.equal(p.owner, turn.color)
    assert.ok(teleport || reaches(pieces, queen ? { ...p, role: 'queen' } : p, to, !!victim), `${from}-${to} geometry`)
    if (victim) { assert.equal(victim.owner === p.owner, ownCapture); capture(victim, turn.color) }
    p.square = to as SquareName
    enPassant = []
    if (p.role === 'pawn' && Math.abs(Number(to[1]) - Number(from[1])) === 2) {
      enPassant = [{ target: `${from[0]}${(Number(to[1]) + Number(from[1])) / 2}` as SquareName, pawnId: p.id }]
    }
    half = p.originalRole === 'pawn' || victim ? 0 : half + 1
    full += turn.color === 'black' ? 1 : 0
    active = turn.color === 'white' ? 'b' : 'w'
    turn.phase = 'afterMove'; turn.moveMade = true
  }
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, before = actual, original = structuredClone(before)
    assert.ok(rationales[index]!.startsWith(`${n}. `))
    if (n === 105) snapshot = { pieces: structuredClone(pieces), active, half, full }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      assert.equal(from + to, moves[moveIndex++], `step ${n}: reviewed movement payload`)
      assert.equal(action.promotion, undefined)
      assert.equal(turn.phase, 'beforeMove')
      if (n === 85) assert.equal(at(from).id, 'white-rook-a1')
      if (n === 107) assert.notEqual(`${at(from).id}:${from}:${to}`, 'white-queen-d1:f1:g2')
      move(from, to)
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true)
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
    } else if (action.type === 'playCard') {
      assert.deepEqual({ cardId: action.cardId, ...(action.target === undefined ? {} : { target: action.target }) }, cards[n])
      const owner = n === 106 ? 'black' : turn.color, hand = players[owner].hand
      assert.deepEqual([owner, turn.color, turn.phase], cardWindows[n], `step ${n}: actor and card timing`)
      assert.equal(turn.moveMade, cardWindows[n]![2] === 'afterMove')
      if (n === 106) assert.deepEqual(before.history.at(-1), { type: 'move', from: 'f1', to: 'g2', movedPieceId: 'white-queen-d1', movedRoles: ['queen'] }, 'Chaos immediately answers the opposing actual move')
      if (n === 60) assert.deepEqual(hand.map(c => c.cardId), ['peace-talks', 'disintegration', 'toll', 'fireball', 'plots-within-plots'], 'saved Plots hand underlying rationale 60')
      assert.equal(turn.cardPlays[owner], 0)
      const card = hand.find(c => c.id === action.cardInstanceId && c.cardId === action.cardId)
      assert.ok(card)
      if (n === 42) abductionBefore = structuredClone(before)
      players[owner].hand = hand.filter(c => c !== card)
      players[owner].discard.push(card)
      players[owner].hand.push(players[owner].deck.shift()!)
      turn.cardPlays[owner]++
      if (n === 8 || n === 23) {
        assert.equal(turn.phase, 'afterMove')
        const [a, b] = n === 8 ? [at('a8'), at('c8')] : [at('f8'), at('a6')]
        assert.equal(a.role, n === 8 ? 'rook' : 'bishop'); assert.equal(b.role, n === 8 ? 'bishop' : 'knight')
        assert.equal(a.owner, 'black'); assert.equal(b.owner, 'black')
        ;[a.square, b.square] = [b.square, a.square]
      } else if (n === 25) { assert.equal(at('f6').role, 'knight'); assert.ok(!pieces.some(p => p.square === 'f3')); move('f6', 'f3', false, true) }
      else if (n === 42) { const p = at('g4'); assert.equal(p.owner, 'white'); assert.equal(p.royal, false); p.square = null; p.zone = 'away' }
      else if (n === 58) { assert.equal(at('d3').royal, true); move('d3', 'g3', false, false, true) }
      else if (n === 66) {
        assert.deepEqual(pieces.filter(p => p.square && Math.abs(xy(p.square)[0] - 0) <= 1 && Math.abs(xy(p.square)[1] - 5) <= 1).map(p => p.id).sort(), ['black-bishop-f8', 'black-pawn-a7'])
        capture(at('a6'), 'black'); capture(at('b7'), 'black'); half = 0
      } else if (n === 76) move('a1', 'b1', true)
      else if (n === 89) {
        const attacker = at('h3'), victim = at('f5')
        assert.equal(attacker.role, 'bishop'); assert.equal(victim.owner, 'black')
        assert.ok(reaches(pieces, attacker, 'f5', true))
        const hypothetical = structuredClone(pieces)
        hypothetical.find(p => p.id === victim.id)!.zone = 'captured'
        hypothetical.find(p => p.id === victim.id)!.square = null
        hypothetical.find(p => p.id === attacker.id)!.square = 'f5'
        assert.equal(threatened(hypothetical, 'white'), false)
        capture(victim, 'white'); enPassant = []; half = 0; active = 'b'; turn.phase = 'afterMove'; turn.moveMade = true
      } else if (n === 106) {
        assert.ok(snapshot)
        pieces = structuredClone(snapshot.pieces); active = snapshot.active; half = snapshot.half; full = snapshot.full
        turn.phase = 'beforeMove'; turn.moveMade = false
      }
    } else if (n === 43) assert.equal(action.type, 'revealAbduction')
    else if (n === 44) {
      assert.deepEqual(action, { type: 'answerAbduction', player: 'white', owner: 'white', role: 'pawn', square: 'g4', pieceId: 'white-pawn-g2' })
      const p = pieces.find(p => p.id === 'white-pawn-g2')!; p.square = 'g4'; p.zone = 'board'
    } else assert.fail(`unreviewed action ${n}`)
    if (n === 8) rights = 'KQka'
    if (n === 22) rights = 'Qka'
    if (n === 29) rights = 'Qa'
    if (n === 39) rights = 'a'
    if (n === 48) rights = '-'
    const result = applyAction(before, action)
    assert.deepEqual(before, original, `step ${n}: complete immutable input including capturedBy`)
    assert.ok(result.ok, rationales[index])
    actual = result.state
    assert.deepEqual(actual.pieces, pieces, `step ${n}: every physical piece and captor`)
    assert.deepEqual(actual.players, players, `step ${n}: physical hand/deck/discard accounting`)
    assert.deepEqual(actual.turn, turn, `step ${n}: turn and allowances`)
    assert.equal(actual.fen, `${board(pieces)} ${active} ${rights} ${n === 87 || n === 88 ? 'f6' : '-'} ${half} ${full}`, `step ${n}: all six FEN fields`)
    assert.deepEqual(actual.enPassant, enPassant)
    assert.equal(actual.orientation, 0)
    assert.equal(actual.outcome, null)
    assert.deepEqual(actual.effects, n === 83 || n === 84 ? [{ type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-rook-a1' }] : [])
    for (const color of ['white', 'black'] as const) {
      const raw = threatened(pieces, color), constrained = threatened(pieces, color, n === 83 || n === 84)
      assert.equal(raw, color === 'white' ? [25, 26, 52, 53, 70, 71, 113, 114].includes(n) : [80, 81, 82, 83, 84, 85, 86, 89, 90].includes(n), `step ${n}: independently expected raw ${color} attacks`)
      assert.equal(isKingInCheck(actual, color), constrained, `step ${n}: legal ${color} royal threats`)
    }
    assert.deepEqual(actual.chaosForbidden ?? null, n === 106 ? { player: 'white', movement: 'white-queen-d1:f1:g2' } : null)
    assert.equal(actual.plotsExecution, undefined)
    assert.deepEqual(actual.plotsAllowances ?? [], n === 60 ? [{ player: 'black', remaining: 2, eligibleCards: ['black-hand-1-disintegration'], window: { phase: 'beforeMove', moveMade: false, capture: undefined, cardResponse: undefined, fogCheckpoint: undefined, legacyCapture: undefined, shieldMove: undefined, reaction: { type: 'cardPlayed', cardId: 'hidden-passage', target: [{ from: 'd3', to: 'g3' }], movement: [{ from: 'd3', to: 'g3' }], preservePreviousMove: false } } }] : [])
    assert.deepEqual(actual.fogLocked ?? [], [])
    assert.deepEqual(actual.riposteLostMoves ?? [], [])
    assert.equal(actual.riposteSkipped, undefined)
    assert.equal(actual.riposteCheckDeferred, undefined)
    assert.deepEqual(actual.underElfHill ?? [], [])
    assert.equal(actual.pendingDoomsayer ?? null, null)
    if (n === 42 || n === 43) {
      assert.deepEqual(actual.pendingAbduction, { phase: n === 42 ? 'concealment' : 'recall', player: 'white', durationMs: 10000, pieceId: 'white-pawn-g2', requiresPieceId: false, before: abductionBefore })
    } else assert.equal(actual.pendingAbduction ?? null, null)
    if (n === 82) {
      assert.ok(actual.pendingRescue)
      assert.deepEqual(actual.pendingRescue, { before, fen: before.fen, pieces: before.pieces, enPassant: [], historyLength: 42, movedPieceIds: ['black-queen-d8'] })
    } else assert.equal(actual.pendingRescue ?? null, null)
    // Independent prospective capture context: only the f7-f5 reply has an adjacent enemy Pawn.
    const capturer: Color = active === 'w' ? 'white' : 'black'
    const epCaptures = enPassant.flatMap(ep => pieces.filter(p => p.owner === capturer && p.role === 'pawn' && p.zone === 'board' && reaches(pieces, p, ep.target, true)))
    assert.deepEqual(epCaptures.map(p => p.id), n === 87 || n === 88 ? ['white-pawn-g2'] : [])
    const prospective: GameState = {
      ...actual,
      turn: { color: capturer, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } },
    }
    const publicDests = enPassant.length ? legalDests(prospective, false) : new Map<SquareName, SquareName[]>()
    const publicEpCaptures = enPassant.flatMap(ep => pieces.filter(p => p.owner === capturer
      && p.role === 'pawn' && p.zone === 'board' && p.square
      && p.square[0] !== ep.target[0] && publicDests.get(p.square)?.includes(ep.target)))
    assert.deepEqual(publicEpCaptures.map(p => p.id), epCaptures.map(p => p.id), `step ${n}: prospective public en-passant availability`)
    if (n === 87 || n === 88) {
      const hypothetical = structuredClone(pieces)
      const victim = hypothetical.find(p => p.id === 'black-pawn-f7')!
      victim.square = null; victim.zone = 'captured'
      hypothetical.find(p => p.id === 'white-pawn-g2')!.square = 'f6'
      assert.equal(threatened(hypothetical, 'white'), false, 'prospective g5xf6 en passant preserves Kh5 safety')
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(moveIndex, moves.length)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 11)
  assert.equal(actual.fen, 'br2q3/4k1pr/2ppp1Pp/4nP1K/1p1P1P2/PP5B/2P4P/1RB2Q1R b - - 0 27')
})

test('iteration 154 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/154.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(trace)
  replayTrace(trace)
})
