import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/153.json', import.meta.url), 'utf8')) as RandomTrace

test('iteration 153 deterministic replay', () => {
  assert.ok(replayTrace(trace))
})

// Every row was reviewed in order against rules §§8–11, 15.3, 15.5, 16.1–3.
const rationale = `
1 d2-d3: Pawn advances one empty square.
2 Cathedral swaps a1 Rook and c1 Bishop; neither is a move; preserve clocks and rights.
3 End White turn, reset both allowances; no board change.
4 h7-h5: Pawn passes vacant h6; no White Pawn can capture en passant.
5 End Black turn; retain h6 opportunity.
6 c2-c3: Pawn advances one empty square; old opportunity expires.
7 End White turn.
8 h5-h4: Pawn advances one empty square.
9 End Black turn.
10 Madman b2-d4 jumps own Pawn at c3 without capturing it; replaces move.
11 End White turn after Madman.
12 g7-g5: Pawn passes vacant g6; no White Pawn on f5 or h5.
13 End Black turn; retain g6 opportunity.
14 g2-g4: Pawn passes g3; Black h4 Pawn can capture en passant at g3.
15 End White turn; g3 remains legal for Black.
16 f7-f5: Pawn passes f6; White g4 cannot capture en passant from rank four.
17 End Black turn; retain f6 opportunity.
18 Pacifism marks owned nonroyal h2 Pawn before move; retain f6 and board.
19 g4-f5: Pawn captures Black f7 identity diagonally; captor White.
20 End White turn; replenish card allowance only.
21 c7-c6: Pawn advances one empty square.
22 End Black turn.
23 b1-d2: Knight jumps to vacant d2.
24 End White turn.
25 Resurrection returns captured Black f7 Pawn to vacant starting square f7; clears captor; replaces move.
26 End Black turn after Resurrection.
27 f5-f6: Pawn advances one empty square.
28 End White turn.
29 c6-c5: Pawn advances one empty square.
30 End Black turn.
31 a2-a4: Pawn passes vacant a3; no Black Pawn can capture en passant.
32 End White turn; retain a3 opportunity.
33 h8-h5: Rook slides through empty h7,h6; loses Black kingside right.
34 End Black turn.
35 f6-e7: Pawn captures Black e7 identity diagonally; no promotion at rank seven.
36 End White turn.
37 b7-b6: Pawn advances one empty square; e7 Pawn attacks d8/f8, not e8 King.
38 End Black turn.
39 d2-e4: Knight jumps to vacant e4.
40 End White turn.
41 Dubbing gives d7 Pawn a noncapturing Knight jump to vacant e5; replaces move.
42 End Black turn after Dubbing.
43 e1-d2: King steps to safe vacant square; both White castling rights expire.
44 End White turn.
45 a7-a6: Pawn advances one empty square.
46 End Black turn.
47 f2-f4: Pawn passes f3; no Black Pawn on e4 or g4 can take en passant.
48 End White turn; retain f3 opportunity.
49 b6-b5: Pawn advances one empty square.
50 End Black turn.
51 f4-f5: Pawn advances one empty square.
52 End White turn.
53 g5-g4: Pawn advances one empty square.
54 End Black turn.
55 c3-c4: Pawn advances one empty square.
56 End White turn.
57 b5-b4: Pawn advances one empty square.
58 End Black turn.
59 a4-a5: Pawn advances one empty square.
60 End White turn.
61 c5-d4: Pawn captures original White b2 Pawn; captor Black.
62 Revenge responds immediately by capturing Black f7 Pawn, captor White; White spends reaction allowance.
63 End Black turn; White reaction allowance resets.
64 d2-c2: King steps to safe vacant c2.
65 End White turn.
66 e8-e7: King captures White g2 Pawn on safe e7; remaining Black castling right expires.
67 End Black turn.
68 f1-h3: Bishop slides through vacant g2.
69 End White turn.
70 a8-a7: Rook slides one square to vacant a7.
71 Coup designates nonroyal c8 Bishop as King; e7 original King becomes capturable Prince; no role changes.
72 End Black turn; royal identity remains Bishop c8.
73 e4-d6: Knight jumps to d6 and checks new royal Bishop at c8.
74 End White turn; Black begins in Knight check.
75 c8-e6: Royal Bishop slides through d7 but White f5 Pawn attacks e6; provisional rescue required.
76 Truce cannot rescue: raw f5-e6 attack ends Truce immediately; spend it and rewind entire move to step 74.
77 d8-d6: Queen slides through d7 and captures checking Knight; Black royal c8 is safe.
78 End Black turn after legal replacement move; Truce remains spent.
79 c2-b1: King steps diagonally to safe vacant b1.
80 End White turn.
81 h5-h7: Rook slides through vacant h6.
82 End Black turn.
83 f5-f6: Pawn advances; e7 Prince is attacked but is no longer royal.
84 End White turn.
85 b8-c6: Knight jumps to vacant c6.
86 End Black turn.
87 h3-f1: Bishop slides through vacant g2.
88 End White turn.
89 h4-h3: Pawn advances to empty h3; h2 Pacifist remains protected.
90 Mystic Shield selects just-moved nonroyal h3 Pawn, protects it during upcoming White turn.
91 End Black turn; retain Shield for White turn.
92 f6-e7: White Pawn captures nonroyal Prince; Black King is still c8 Bishop.
93 End White turn; temporary Shield expires.
94 a7-e7: Rook crosses vacant b7,c7,d7 to capture White f2 Pawn.
95 End Black turn.
96 d1-b3: Queen slides diagonally through empty c2.
97 End White turn.
98 d6-d7: Queen slides one square to vacant d7.
99 End Black turn.
100 b1-c2: King steps diagonally to safe vacant c2.
101 End White turn.
102 d7-e6: Queen slides diagonally to vacant e6.
103 End Black turn.
104 g1-h3: Knight captures Black h7 Pawn; Shield expired at step 93.
105 End White turn.
106 f8-g7: Bishop slides diagonally to vacant g7.
107 End Black turn.
108 h3-g5: Knight jumps to vacant g5.
109 End White turn.
110 g7-f6: Bishop slides diagonally to vacant f6.
111 End Black turn; 50 commands include one rewound command, plus three card replacement moves.
`.trim().split('\n')

const cards: Record<number, [Color, string, unknown]> = {
  2: ['white', 'cathedral', { rook: 'a1', bishop: 'c1' }],
  10: ['white', 'madman', [{ from: 'b2', to: 'd4' }]],
  18: ['white', 'pacifism', 'h2'],
  25: ['black', 'resurrection', { pieceId: 'black-pawn-f7', to: 'f7' }],
  41: ['black', 'dubbing', [{ from: 'd7', to: 'e5' }]],
  62: ['white', 'revenge', 'f7'],
  71: ['black', 'coup', 'c8'],
  76: ['black', 'truce', undefined],
  90: ['black', 'mystic-shield', 'h3'],
}
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const square = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName
const other = (c: Color): Color => c === 'white' ? 'black' : 'white'

test('iteration 153 independently reviewed physical-state oracle', () => {
  assert.equal(trace.seed, 860153)
  assert.equal(trace.steps.length, 111)
  assert.equal(rationale.length, 111)
  let actual = createGameState(trace.initial)
  let pieces = structuredClone(actual.pieces)
  const players = structuredClone(actual.players)
  let turn = structuredClone(actual.turn)
  let ep: GameState['enPassant'] = []
  const effects: unknown[] = []
  let rights = 'KQkq', active = 'w', half = 0, full = 1, fenEp = '-'
  let saved: { pieces: PieceState[]; fen: string; history: GameState['history']; before: GameState } | undefined
  const at = (s: string) => pieces.find(p => p.zone === 'board' && p.square === s)
  const pawnProtected = (p: PieceState) => effects.some(e => (e as { type?: string; pieceId?: string }).type === 'pacifism' && (e as { pieceId?: string }).pieceId === p.id)
  const geometric = (p: PieceState, dest: string, capture: boolean) => {
    const [x, y] = xy(p.square!), [tx, ty] = xy(dest)
    const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy)
    if (p.role === 'knight') return ax * ay === 2
    if (p.role === 'king') return Math.max(ax, ay) === 1
    if (p.role === 'pawn') {
      const forward = p.owner === 'white' ? 1 : -1
      return capture ? ax === 1 && dy === forward : dx === 0 && !at(dest) &&
        (dy === forward || dy === 2 * forward && y === (p.owner === 'white' ? 1 : 6) && !at(square(x, y + forward)))
    }
    const aligned = p.role === 'bishop' ? ax === ay : p.role === 'rook' ? dx === 0 || dy === 0 : ax === ay || dx === 0 || dy === 0
    if (!aligned || !Math.max(ax, ay)) return false
    for (let d = 1; d < Math.max(ax, ay); d++) if (at(square(x + d * Math.sign(dx), y + d * Math.sign(dy)))) return false
    return true
  }
  const threatened = (color: Color) => {
    const royal = pieces.find(p => p.owner === color && p.royal && p.zone === 'board')!
    return pieces.some(p => p.zone === 'board' && p.owner !== color && !pawnProtected(p) && geometric(p, royal.square!, true))
  }
  const epLegal = (pawn: PieceState, target: SquareName, victim: PieceState) => {
    if (pawn.zone !== 'board' || pawn.role !== 'pawn' || pawn.owner === victim.owner || pawnProtected(pawn) || pawnProtected(victim) || !geometric(pawn, target, true)) return false
    const from = pawn.square, victimSquare = victim.square
    pawn.square = target; victim.square = null; victim.zone = 'captured'
    const safe = !threatened(pawn.owner)
    pawn.square = from; victim.square = victimSquare; victim.zone = 'board'
    return safe
  }
  const boardFen = () => {
    const role = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
    return Array.from({ length: 8 }, (_, row) => {
      let rank = '', empty = 0
      for (let x = 0; x < 8; x++) {
        const p = at(square(x, 7 - row))
        if (!p) { empty++; continue }
        if (empty) rank += empty
        empty = 0
        rank += p.owner === 'white' ? role[p.role].toUpperCase() : role[p.role]
      }
      return rank + (empty || '')
    }).join('/')
  }
  const fen = () => `${boardFen()} ${active} ${rights || '-'} ${fenEp} ${half} ${full}`
  const capture = (p: PieceState, owner: Color) => {
    assert.equal(p.royal, false)
    assert.equal(pawnProtected(p), false)
    p.square = null; p.zone = 'captured'; p.capturedBy = owner
  }
  const completeMove = (pawn: boolean, captured = false) => {
    half = pawn || captured ? 0 : half + 1
    if (turn.color === 'black') full++
    active = turn.color === 'white' ? 'b' : 'w'
    turn.phase = 'afterMove'; turn.moveMade = true
    ep = []; fenEp = '-'
  }
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, action = step.action, label = rationale[index]!
    assert.ok(label.startsWith(`${n} `))
    const input = structuredClone(actual)
    if (n === 75) saved = { pieces: structuredClone(pieces), fen: fen(), history: structuredClone(actual.history), before: structuredClone(actual) }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const from = action.from, to = action.to
      assert.match(from, /^[a-h][1-8]$/); assert.match(to, /^[a-h][1-8]$/)
      assert.ok(label.startsWith(`${n} ${from}-${to}:`))
      assert.equal(action.promotion, undefined)
      const p = at(from)!, victim = at(to)
      assert.equal(p.owner, turn.color)
      assert.equal(turn.phase, 'beforeMove')
      assert.ok(geometric(p, to, !!victim), label)
      if (victim) { assert.equal(victim.owner, other(turn.color)); capture(victim, turn.color) }
      const [x, y] = xy(from), [, ty] = xy(to)
      p.square = to as SquareName
      if (p.id === 'white-king-e1') rights = rights.replace(/[KQA]/g, '')
      if (p.id === 'black-king-e8') rights = rights.replace(/[kq]/g, '')
      if (from === 'h8') rights = rights.replace('k', '')
      completeMove(p.role === 'pawn', !!victim)
      if (p.role === 'pawn' && Math.abs(ty - y) === 2) {
        const target = square(x, (y + ty) / 2)
        ep = [{ target, pawnId: p.id }]
        if (pieces.some(q => epLegal(q, target, p))) fenEp = target
      }
    } else if (action.type === 'playCard') {
      const [owner, cardId, target] = cards[n]!
      assert.equal(action.cardId, cardId); assert.deepEqual(action.target, target)
      assert.equal(owner, n === 62 ? other(turn.color) : turn.color, `${label}: exact actor`)
      assert.equal(turn.phase, [10, 18, 25, 41].includes(n) ? 'beforeMove' : 'afterMove', `${label}: printed timing`)
      assert.equal(turn.moveMade, ![10, 18, 25, 41].includes(n), `${label}: move trigger`)
      assert.equal(turn.cardPlays[owner], 0)
      const player = players[owner], ci = player.hand.findIndex(c => c.id === action.cardInstanceId)
      assert.ok(ci >= 0)
      const card = player.hand.splice(ci, 1)[0]!
      assert.equal(card.cardId, cardId)
      player.hand.push(player.deck.shift()!)
      turn.cardPlays[owner]++
      if (![18, 71].includes(n)) player.discard.push(card)
      if (n === 2) {
        assert.equal(turn.phase, 'afterMove')
        const rook = at('a1')!, bishop = at('c1')!
        assert.equal(rook.role, 'rook'); assert.equal(bishop.role, 'bishop')
        rook.square = 'c1'; bishop.square = 'a1'; rights = rights.replace('Q', 'A')
      }
      if (n === 10) { assert.equal(at('c3')!.id, 'white-pawn-c2'); assert.equal(at('d4'), undefined); at('b2')!.square = 'd4'; completeMove(true) }
      if (n === 18) effects.push({ type: 'pacifism', owner, card, pieceId: 'white-pawn-h2' })
      if (n === 25) {
        const pawn = pieces.find(p => p.id === 'black-pawn-f7')!
        assert.equal(pawn.zone, 'captured'); assert.equal(at('f7'), undefined)
        pawn.square = 'f7'; pawn.zone = 'board'; delete pawn.capturedBy
        completeMove(true)
      }
      if (n === 41) { assert.equal(at('e5'), undefined); at('d7')!.square = 'e5'; completeMove(true) }
      if (n === 62) { assert.equal(input.history.at(-1)?.type, 'move'); capture(at('f7')!, 'white'); half = 0 }
      if (n === 71) {
        at('c8')!.royal = true; at('e7')!.royal = false
        effects.push({ type: 'coup', owner, card, princeId: 'black-king-e8', kingId: 'black-bishop-c8', princeRole: 'king' })
      }
      if (n === 76) {
        assert.ok(threatened('black'), 'Truce ends on raw royal attack from f5')
        pieces = structuredClone(saved!.pieces)
        active = 'b'; half = 3; full = 18; fenEp = '-'; ep = []
        turn.phase = 'beforeMove'; turn.moveMade = false
      }
      if (n === 90) effects.push({ type: 'mystic-shield', owner, player: owner, pieceId: 'black-pawn-h7' })
    } else {
      assert.equal(action.type, 'endTurn')
      assert.match(label, new RegExp(`^${n} End `))
      assert.equal(turn.moveMade, true)
      turn = { color: other(turn.color), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      if (n === 93) effects.pop()
    }
    const result = applyAction(actual, action)
    assert.deepEqual(actual, input, `${label}: input immutability`)
    assert.equal(result.ok, true, label)
    actual = result.state
    assert.deepEqual(actual.pieces, pieces, `${label}: physical identities and captors`)
    assert.equal(actual.fen, fen(), `${label}: all six FEN fields`)
    assert.deepEqual(actual.players, players, `${label}: exact hand/deck/discard identities`)
    assert.deepEqual(actual.turn, turn, `${label}: owner, phase, allowance`)
    assert.deepEqual(actual.effects, effects, `${label}: complete effects`)
    assert.deepEqual(actual.enPassant, ep, `${label}: opportunities`)
    for (const opportunity of ep) {
      const victim = pieces.find(p => p.id === opportunity.pawnId)!
      const prospective = other(victim.owner)
      const context = structuredClone(actual)
      context.turn = { color: prospective, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      context.fen = context.fen.replace(/ [wb] /, prospective === 'white' ? ' w ' : ' b ')
      const dests = legalDests(context, false)
      const independent = pieces.filter(p => p.zone === 'board' && p.owner === prospective && p.role === 'pawn')
      for (const pawn of independent) assert.equal(dests.get(pawn.square!)?.includes(opportunity.target) ?? false,
        epLegal(pawn, opportunity.target, victim), `${label}: prospective ${pawn.id} en passant and royal safety`)
      assert.equal(independent.some(p => epLegal(p, opportunity.target, victim)), [14, 15].includes(n), `${label}: independently expected en passant availability`)
    }
    assert.equal(actual.orientation, 0)
    assert.equal(actual.outcome, null, label)
    assert.equal(actual.pendingDoomsayer ?? null, null, label)
    assert.equal(actual.pendingAbduction ?? null, null, label)
    assert.deepEqual(actual.underElfHill ?? [], [], label)
    const checks = { white: false, black: [73, 74, 75, 76].includes(n) }
    for (const color of ['white', 'black'] as const) {
      assert.equal(threatened(color), checks[color], `${label}: independent ${color} royal threat`)
      assert.equal(isKingInCheck(actual, color), checks[color], `${label}: public ${color} royal threat`)
    }
    if (n === 75) {
      const pending = actual.pendingRescue!
      assert.ok(pending)
      assert.equal(pending.fen, saved!.fen)
      assert.deepEqual(pending.pieces, saved!.pieces)
      assert.deepEqual(pending.enPassant, [])
      assert.equal(pending.historyLength, 39)
      assert.deepEqual(pending.movedPieceIds, ['black-bishop-c8'])
      assert.deepEqual(pending.before?.pieces, saved!.pieces)
      assert.equal(pending.before?.fen, saved!.fen)
      assert.deepEqual(pending.before?.history, saved!.history)
      assert.deepEqual(pending.before?.turn, saved!.before.turn)
      assert.deepEqual(pending.before?.enPassant, [])
      assert.deepEqual(pending.before, saved!.before, `${label}: full pre-move checkpoint`)
    } else assert.equal(actual.pendingRescue ?? null, null, label)
    assert.equal(actual.chaosForbidden, undefined, label)
    assert.equal(actual.plotsExecution, undefined, label)
    assert.deepEqual(actual.plotsAllowances ?? [], [], label)
    assert.equal(actual.fogLocked, undefined, label)
    assert.deepEqual(actual.riposteLostMoves ?? [], [], label)
    assert.deepEqual(actual.riposteSkipped ?? [], [], label)
    assert.equal(actual.riposteCheckDeferred, undefined, label)
  }
  assert.equal(trace.moves, 50)
  assert.equal(Object.keys(cards).length, 9)
  assert.equal(fen(), '2b3n1/4r2r/p1n1qb2/P3p1N1/1pPp2p1/1Q1P4/2K1P2P/B1R2B1R w - - 3 27')
})
