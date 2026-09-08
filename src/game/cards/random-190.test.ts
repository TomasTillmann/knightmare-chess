import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { applyAction, isKingInCheck, legalDests } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameAction, GameEvent, GameState, PieceState, SquareName } from '../types.js'
import { CARD_CATALOG } from './catalog.js'

// Reviewed in order against rules §§7, 11, 13.8–9, 16.1, 20 and 22.11;
// printed timings and descriptions are preserved in CARD_CATALOG and cards.md.
// Every row includes its exact command and an independently written rationale.
const reviewed = `
1 a2a3 | White Pawn advances one empty square.
2 end | White closes its safe completed move.
3 dubbing | Black a7 Pawn jumps in Knight geometry to empty c6; role remains Pawn.
4 end | Black closes its replacement move and restores allowances.
5 a3a4 | White a-Pawn advances one empty square.
6 end | White closes its safe completed move.
7 d7d5 | Black d-Pawn advances through empty d6 to d5; d6 opportunity has no White captor.
8 end | Black closes; the physical d6 opportunity survives for White.
9 f2f3 | White f-Pawn advances one square and expires d6.
10 end | White closes its safe completed move.
11 long-jump | Black b8 Knight jumps to empty c4 of opposite square color.
12 end | Black closes its replacement move.
13 g2g3 | White g-Pawn advances one square.
14 fortification | White installs the d5/d6 wall after its move; physical card stays in effect.
15 end | White closes; wall remains active.
16 c8g4 | Black Bishop follows clear d7/e6/f5 diagonal to g4; it never crosses d5/d6.
17 end | Black closes its safe completed move.
18 b2b4 | White b-Pawn advances through b3; Black has no a4/c4 Pawn to capture en passant.
19 end | White closes; b3 opportunity remains for Black.
20 g4h5 | Black Bishop moves one diagonal square and expires b3.
21 end | Black closes its safe completed move.
22 f3f4 | White f-Pawn advances one empty square.
23 end | White closes its safe completed move.
24 c4d2 | Black Knight captures White original d-Pawn by an L-jump.
25 end | Black closes the capture; capturedBy stays Black.
26 f1h3 | White Bishop moves through empty g2 to empty h3.
27 end | White closes its safe completed move.
28 d8d7 | Black Queen steps down to empty d7.
29 end | Black closes its safe completed move.
30 h3f1 | White Bishop returns through g2 to empty f1.
31 anathema | White swaps opposing h5 Bishop with h8 Rook after its move; identities and castling entitlement survive the non-move swap.
32 end | White closes; swapped pieces remain h8/h5.
33 g8f6 | Black Knight jumps to empty f6.
34 end | Black closes its safe completed move.
35 e2e4 | White e-Pawn advances through empty e3; no Black d4/f4 Pawn can take en passant.
36 end | White closes; e3 opportunity survives.
37 a8b8 | Black Rook steps to empty b8 and loses its queenside entitlement; e3 expires.
38 end | Black closes its safe completed move.
39 d1f3 | White Queen follows clear e2 diagonal to empty f3.
40 end | White closes its safe completed move.
41 h5h6 | Original Black h8 Rook steps to h6 and loses its remaining castling entitlement.
42 end | Black closes its safe completed move.
43 g1e2 | White Knight jumps to empty e2.
44 end | White closes its safe completed move.
45 d2c4 | Black Knight returns by L-jump to empty c4.
46 end | Black closes its safe completed move.
47 f3d3 | White Queen moves along clear e3 to d3.
48 end | White closes its safe completed move.
49 d7c8 | Black Queen steps diagonally to empty c8.
50 end | Black closes its safe completed move.
51 c1a3 | White Bishop follows clear b2 diagonal to a3.
52 end | White closes its safe completed move.
53 d5e4 | Black d-Pawn captures White e-Pawn diagonally; it does not cross the wall to d6.
54 end | Black closes the capture.
55 d3f3 | White Queen crosses empty e3 to f3.
56 end | White closes its safe completed move.
57 b7b6 | Black b-Pawn advances one square.
58 end | Black closes its safe completed move.
59 e1f2 | White King steps diagonally to safe f2 and loses both castling rights.
60 end | White closes with King safe on f2.
61 c6c5 | Original Black a-Pawn advances on its current c-file.
62 end | Black closes its safe completed move.
63 f3h5 | White Queen follows clear g4 diagonal to h5.
64 end | White closes its safe completed move.
65 pacifism | Black marks its b6 Pawn before moving; it can neither capture nor be captured and card remains active.
66 c8d8 | Black Queen steps horizontally; Pacifism does not consume the regular move.
67 end | Black closes and restores allowances while Pacifism persists.
68 b1c3 | White Knight jumps to empty c3.
69 end | White closes its safe completed move.
70 d8d6 | Black Queen follows clear d7 to d6, stopping before the d5/d6 wall.
71 end | Black closes its safe completed move.
72 h5h3 | White Queen moves through empty h4 to h3; Bog-eligible length records its previous FEN.
73 end | White closes its safe completed move.
74 d6f4 | Black Queen captures White f-Pawn through empty e5; the diagonal does not cross d5/d6.
75 end | Black closes; White is checked down the now clear f-file.
76 f2g2 | White King escapes the f4 Queen check to safe g2.
77 end | White closes its answered-check turn.
78 e7e6 | Black e-Pawn advances to empty e6.
79 end | Black closes its safe completed move.
80 g3f4 | White g-Pawn captures the Black Queen diagonally.
81 end | White closes the capture.
82 c5b4 | Black original a-Pawn captures White b-Pawn diagonally.
83 end | Black closes the capture.
84 c3a2 | White Knight jumps to empty a2.
85 end | White closes its safe completed move.
86 evangelists | Black swaps its h8 Bishop with White f1 Bishop instead of moving; f1 Bishop checks White g2 but is capturable by a1 Rook.
87 end | Black safely closes while White receives its turn in check.
88 a1f1 | White Rook captures the checking Bishop along clear b1/c1/d1/e1, answering check.
89 end | White closes the answered-check capture.
90 f8c5 | Black Bishop follows empty e7/d6 to c5.
91 end | Black closes its safe completed move.
92 a3b4 | White Bishop captures Black original a-Pawn diagonally.
93 hostage | Black immediately substitutes its unprotected h7 Pawn, restoring captured a-Pawn to h7; White remains the original captor.
94 end | White closes; Black reaction allowance resets for its upcoming move.
95 f6g8 | Black Knight returns to empty g8 by L-jump.
96 end | Black closes its safe completed move.
97 f1b1 | White Rook follows empty e1/d1/c1 to b1; Bog history retains the previous FEN.
98 end | White closes its safe completed move.
99 fanatic | Black g-Pawn advances through empty g6/g5 to g4; replacement move grants no en-passant opportunity.
100 end | Black closes its replacement move.
101 h3c3 | White Queen follows clear g3/f3/e3/d3 to c3; Bog history retains the previous FEN.
102 end | White closes its safe completed move.
103 h6f6 | Black Rook crosses empty g6 to f6.
104 end | Black closes its safe completed move.
105 h1g1 | White Rook steps to empty g1.
106 end | White closes its safe completed move.
107 e4e3 | Black original d-Pawn advances one empty square on its current e-file.
108 end | Black closes its safe completed move.
109 b1c1 | White Rook steps to empty c1.
110 end | White closes its safe completed move.
111 f6g6 | Black Rook steps to empty g6.
112 end | Black closes move fifty; both Kings are safe and no obligation remains.
`.trim().split('\n')

const cards: Partial<Record<string, Extract<GameAction, { type: 'playCard' }>>> = {
  dubbing: { type: 'playCard', cardId: 'dubbing', cardInstanceId: 'black-hand-0-dubbing', target: [{ from: 'a7', to: 'c6' }] },
  'long-jump': { type: 'playCard', cardId: 'long-jump', cardInstanceId: 'black-hand-2-long-jump', target: [{ from: 'b8', to: 'c4' }] },
  fortification: { type: 'playCard', cardId: 'fortification', cardInstanceId: 'white-hand-2-fortification', target: { from: 'd5', to: 'd6' } },
  anathema: { type: 'playCard', cardId: 'anathema', cardInstanceId: 'white-hand-1-anathema', target: { bishop: 'h5', rook: 'h8' } },
  pacifism: { type: 'playCard', cardId: 'pacifism', cardInstanceId: 'black-deck-0-pacifism', target: 'b6' },
  evangelists: { type: 'playCard', cardId: 'evangelists', cardInstanceId: 'black-deck-1-evangelists', target: { own: 'h8', opponent: 'f1' } },
  hostage: { type: 'playCard', cardId: 'hostage', cardInstanceId: 'black-hand-4-hostage', target: { pieceId: 'black-pawn-a7', pawn: 'h7' } },
  fanatic: { type: 'playCard', cardId: 'fanatic', cardInstanceId: 'black-deck-3-fanatic', target: 'g7' },
}
const other = (c: Color): Color => c === 'white' ? 'black' : 'white'
const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const
const square = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}` as SquareName
const at = (s: GameState, q: string) => s.pieces.find(p => p.zone === 'board' && p.square === q)
const pacifist = (s: GameState, p: PieceState) => s.effects.some(e => (e as { type: string; pieceId?: string }).type === 'pacifism' && (e as { pieceId?: string }).pieceId === p.id)
function geometry(s: GameState, p: PieceState, to: string, attack = false): boolean {
  const [x, y] = xy(p.square!), [a, b] = xy(to), dx = a - x, dy = b - y
  if (!dx && !dy) return false
  const victim = at(s, to)
  if (victim?.owner === p.owner || victim && pacifist(s, victim)) return false
  if ((attack || victim) && pacifist(s, p)) return false
  if (p.role === 'knight') return Math.abs(dx * dy) === 2
  const forward = p.owner === 'white' ? 1 : -1
  if (p.role === 'pawn') {
    if (attack || victim) return Math.abs(dx) === 1 && dy === forward
    if (dx || !(dy === forward || dy === 2 * forward && y === (p.owner === 'white' ? 1 : 6))) return false
  } else if (p.role === 'king') {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false
  } else if (!(p.role === 'bishop' && Math.abs(dx) === Math.abs(dy)
    || p.role === 'rook' && (!dx || !dy)
    || p.role === 'queen' && (!dx || !dy || Math.abs(dx) === Math.abs(dy)))) return false
  let previous = p.square!
  for (let i = 1; i <= Math.max(Math.abs(dx), Math.abs(dy)); i++) {
    const q = square(x + Math.sign(dx) * i, y + Math.sign(dy) * i)
    if (s.effects.length && (previous === 'd5' && q === 'd6' || previous === 'd6' && q === 'd5')) return false
    if (q !== to && at(s, q)) return false
    previous = q
  }
  return true
}
function threatened(s: GameState, color: Color): boolean {
  const king = s.pieces.find(p => p.royal && p.owner === color)!
  return s.pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(s, p, king.square!, true))
}
function board(s: GameState): string {
  const chars = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
  return Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0
    for (let file = 0; file < 8; file++) {
      const p = at(s, square(file, 7 - rank))
      if (!p) empty++
      else { if (empty) row += empty; empty = 0; row += p.owner === 'white' ? chars[p.role].toUpperCase() : chars[p.role] }
    }
    return row + (empty || '')
  }).join('/')
}

test('iteration 190: independent complete ordered oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/190.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.moves, 50)
  assert.equal(trace.steps.length, reviewed.length)
  assert.equal(reviewed.length, 112)
  let actual = createGameState(trace.initial)
  const expected = structuredClone(actual)
  let half = 0, full = 1, active: Color = 'white'
  const rights = new Set(['white-rook-h1', 'white-rook-a1', 'black-rook-h8', 'black-rook-a8'])
  const played: NonNullable<GameState['playedCards']> = []
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, rationale = reviewed[index]!
    assert.ok(rationale.startsWith(`${n} `))
    const token = rationale.split(' ')[1]!
    const action: GameAction = token === 'end' ? { type: 'endTurn' } : cards[token]
      ?? { type: 'move', from: token.slice(0, 2), to: token.slice(2) }
    assert.deepEqual(step.action, action, rationale)
    const before = structuredClone(expected), actor = expected.turn.color
    const spend = (name: string, owner: Color) => {
      const player = expected.players[owner], a = cards[name]!
      const pos = player.hand.findIndex(c => c.id === a.cardInstanceId)
      assert.ok(pos >= 0, rationale)
      assert.equal(player.hand[pos]!.cardId, name)
      assert.equal(expected.turn.cardPlays[owner], 0)
      const timing = owner === actor ? expected.turn.phase : 'afterOpponentMove'
      assert.ok(CARD_CATALOG[name]!.timing.includes(timing))
      const card = player.hand.splice(pos, 1)[0]!
      if (!['pacifism', 'fortification'].includes(name)) player.discard.push(card)
      const draw = player.deck.shift(); if (draw) player.hand.push(draw)
      expected.turn.cardPlays[owner]++
      played.push({ player: owner, cardInstanceId: card.id })
      return card
    }
    const move = (from: string, to: SquareName, ordinary: boolean) => {
      const p = at(expected, from)!, victim = at(expected, to)
      assert.ok(p, rationale); assert.equal(p.owner, actor)
      if (ordinary) assert.ok(geometry(expected, p, to), rationale)
      if (victim) { assert.equal(victim.royal, false); victim.zone = 'captured'; victim.square = null; victim.capturedBy = actor }
      p.square = to
      if (p.royal) for (const id of [...rights]) if (id.startsWith(actor)) rights.delete(id)
      if (p.role === 'rook') rights.delete(p.id)
      if (victim) rights.delete(victim.id)
      half = p.role === 'pawn' || victim ? 0 : half + 1
      active = other(actor); if (actor === 'black') full++
      expected.enPassant = ordinary && p.role === 'pawn' && Math.abs(xy(from)[1] - xy(to)[1]) === 2
        ? [{ target: square(xy(from)[0], (xy(from)[1] + xy(to)[1]) / 2), pawnId: p.id }] : []
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
      expected.shieldMove = { player: actor, pieceIds: [p.id], capturedOpponent: !!victim }
      return victim
    }
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.to, /^[a-h][1-8]$/)
      assert.equal(expected.turn.moveMade, false)
      const victim = move(action.from, action.to as SquareName, true)
      const event: GameEvent = { type: 'move', from: action.from as SquareName, to: action.to as SquareName }
      if ([72, 88, 97, 101].includes(n)) event.previousFen = before.fen
      if (victim) event.capturedId = victim.id
      expected.history.push(event)
    } else if (action.type === 'endTurn') {
      assert.equal(expected.turn.moveMade, true)
      assert.equal(threatened(expected, actor), false, rationale)
      expected.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      delete expected.shieldMove
    } else if (action.type === 'playCard') {
      const owner: Color = ['fortification', 'anathema'].includes(action.cardId) ? 'white' : 'black'
      const card = spend(action.cardId, owner)
      const event = { type: 'cardPlayed', cardId: action.cardId, target: action.target } as GameEvent
      if (['dubbing', 'long-jump', 'fanatic'].includes(action.cardId)) {
        const [from, to] = action.cardId === 'dubbing' ? ['a7', 'c6'] : action.cardId === 'long-jump' ? ['b8', 'c4'] : ['g7', 'g4']
        assert.equal(at(expected, to!), undefined)
        const p = at(expected, from!)!
        if (action.cardId === 'dubbing') assert.equal(Math.abs((xy(from!)[0] - xy(to!)[0]) * (xy(from!)[1] - xy(to!)[1])), 2)
        if (action.cardId === 'long-jump') { assert.equal(p.role, 'knight'); assert.notEqual((xy(from!)[0] + xy(from!)[1]) % 2, (xy(to!)[0] + xy(to!)[1]) % 2) }
        if (action.cardId === 'fanatic') { assert.equal(p.role, 'pawn'); assert.equal(at(expected, 'g6'), undefined); assert.equal(at(expected, 'g5'), undefined) }
        move(from!, to as SquareName, false)
        event.movement = [{ from: from as SquareName, to: to as SquareName }]; event.preservePreviousMove = false
      } else if (action.cardId === 'fortification') {
        expected.effects.push({ type: 'fortification', owner, card, from: 'd5', to: 'd6' })
      } else if (action.cardId === 'pacifism') {
        expected.effects.push({ type: 'pacifism', owner, card, pieceId: 'black-pawn-b7' })
        assert.equal(at(expected, 'b6')!.id, 'black-pawn-b7')
        event.movement = []; event.preservePreviousMove = false
      } else if (action.cardId === 'anathema' || action.cardId === 'evangelists') {
        const from: SquareName = action.cardId === 'anathema' ? 'h5' : 'f1', to: SquareName = 'h8'
        const p = at(expected, from)!, q = at(expected, to)!
        assert.equal(p.role, 'bishop'); assert.equal(q.role, action.cardId === 'anathema' ? 'rook' : 'bishop')
        p.square = to; q.square = from
        event.movement = [{ from, to }, { from: to, to: from }]
        event.preservePreviousMove = action.cardId === 'anathema'
        if (action.cardId === 'evangelists') {
          half++; full++; active = 'white'; expected.enPassant = []
          expected.turn.phase = 'afterMove'; expected.turn.moveMade = true
          expected.shieldMove = { player: 'black', pieceIds: [], capturedOpponent: false }
        }
      } else if (action.cardId === 'hostage') {
        const restored = expected.pieces.find(p => p.id === 'black-pawn-a7')!, sacrifice = at(expected, 'h7')!
        assert.equal(expected.history.at(-1)!.capturedId, restored.id)
        assert.equal(restored.zone, 'captured'); assert.equal(sacrifice.id, 'black-pawn-h7')
        assert.equal(pacifist(expected, sacrifice), false)
        restored.square = 'h7'; restored.zone = 'board'; delete restored.capturedBy
        sacrifice.square = null; sacrifice.zone = 'captured'; sacrifice.capturedBy = 'white'; half = 0
        Object.assign(event, { player: 'black', capturedId: sacrifice.id, capturedIds: [sacrifice.id], movement: [], preservePreviousMove: true })
      } else assert.fail(`unreviewed card ${action.cardId}`)
      expected.history.push(event)
    } else assert.fail('unreviewed action')
    const castling = [
      rights.has('white-rook-h1') ? 'K' : '', rights.has('white-rook-a1') ? 'Q' : '',
      rights.has('black-rook-h8') ? (at(expected, 'h8')?.role === 'rook' ? 'k' : 'h') : '', rights.has('black-rook-a8') ? 'q' : '',
    ].join('') || '-'
    // All three double-step opportunities have no geometrically eligible enemy Pawn.
    for (const ep of expected.enPassant) {
      const victim = expected.pieces.find(p => p.id === ep.pawnId)!
      const [x, y] = xy(victim.square!)
      assert.equal(expected.pieces.some(p => p.zone === 'board' && p.owner !== victim.owner && p.role === 'pawn'
        && xy(p.square!)[1] === y && Math.abs(xy(p.square!)[0] - x) === 1), false)
    }
    expected.fen = `${board(expected)} ${active[0]} ${castling} - ${half} ${full}`
    const input = structuredClone(actual), payload = structuredClone(step.action)
    const result = applyAction(actual, step.action)
    assert.deepEqual(actual, input, `${n}: input immutable`)
    assert.deepEqual(step.action, payload, `${n}: payload immutable`)
    assert.equal(result.ok, true, rationale)
    actual = result.state
    assert.deepEqual(actual.pieces, expected.pieces, `${n}: complete physical identities`)
    assert.deepEqual(actual.players, expected.players, `${n}: exact physical card zones`)
    assert.deepEqual(actual.effects, expected.effects, `${n}: complete effects`)
    assert.deepEqual(actual.history, expected.history, `${n}: exact history`)
    assert.equal(actual.fen, expected.fen, `${n}: all six FEN fields`)
    assert.deepEqual(actual.turn, expected.turn, `${n}: move and card allowances`)
    assert.deepEqual(actual.enPassant, expected.enPassant)
    assert.deepEqual(actual.shieldMove, expected.shieldMove, `${n}: full actual movement token`)
    assert.deepEqual(actual.playedCards ?? [], played)
    assert.equal(actual.orientation, 0)
    assert.equal(actual.outcome, null)
    for (const key of ['pendingRescue', 'pendingAbduction', 'pendingDoomsayer', 'chaosForbidden', 'plotsExecution', 'riposteSkipped', 'riposteCheckDeferred'] as const) assert.equal(actual[key] ?? null, null, `${n}: ${key}`)
    for (const key of ['underElfHill', 'plotsAllowances', 'fogLocked', 'riposteLostMoves'] as const) assert.deepEqual(actual[key] ?? [], [], `${n}: ${key}`)
    const queryInput = structuredClone(actual)
    for (const color of ['white', 'black'] as const) {
      const check = threatened(expected, color)
      assert.equal(isKingInCheck(actual, color), check, `${n}: independent ${color} royal attacks`)
      assert.equal(check, color === 'white' && [74, 75, 86, 87].includes(n), `${n}: reviewed check sequence`)
    }
    assert.deepEqual(actual, queryInput, `${n}: royal queries immutable`)
    if (expected.enPassant.length) {
      const probe = structuredClone(actual)
      probe.turn = { color: active, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
      const frozen = structuredClone(probe), dests = legalDests(probe)
      for (const p of probe.pieces.filter(p => p.zone === 'board' && p.owner === active && p.role === 'pawn'))
        for (const ep of expected.enPassant) assert.equal(dests.get(p.square!)?.includes(ep.target) ?? false, false)
      assert.deepEqual(probe, frozen, `${n}: prospective en-passant query immutable`)
    }
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 8)
  assert.equal(actual.fen, '1r2k1nB/2p2p1p/1p2p1r1/2b5/PBn2Pp1/2Q1p3/N1P1N1KP/2R3R1 w - - 2 28')
})

test('iteration 190 deterministic replay core', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/190.json', import.meta.url), 'utf8')) as RandomTrace
  assert.ok(replayTrace(trace))
})
