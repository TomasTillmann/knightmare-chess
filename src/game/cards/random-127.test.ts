import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction, isKingInCheck } from '../reducer.js'
import { createGameState } from '../state.js'
import type { Color, GameState, PieceState, SquareName } from '../types.js'
import { replayTrace, type RandomTrace } from './random-campaign.js'

// Read rules §§6–11,13.1,14.3, cards.md, catalog metadata and all thirteen
// corresponding final_cards artworks. Each line is one independently reviewed action.
const rationales = `
1 e2-e3: white Pawn advances one into an empty square.
2 End white turn; black receives a fresh move and both card allowances reset.
3 h7-h5: black Pawn crosses empty h6; h6 en passant opportunity opens.
4 End black turn; h6 opportunity remains for white.
5 f2-f3: white Pawn advances one; unused h6 opportunity expires.
6 End white turn with no board or card movement.
7 e7-e5: black Pawn crosses empty e6; e6 opportunity opens.
8 End black turn preserving e6 opportunity.
9 Madman replaces white move: d2 jumps over white e3 to f4, then black e5 to d6; neither jumped Pawn is captured.
10 End white turn after Madman, clearing card allowances.
11 c7-c6: black Pawn advances one to empty c6.
12 End black turn without drawing a card.
13 f1-d3: white Bishop follows empty e2 to empty d3.
14 End white turn; the last moved role is Bishop.
15 Doppelganger replaces black move: Queen d8-e7 copies that Bishop, with an empty diagonal destination and no capture.
16 End black turn after replacement move.
17 Lost Castle replaces white move: swap white a1 and black a8 Rooks, preserving their owners and identities; both queenside rights are lost.
18 End white turn; neither swapped Rook is captured.
19 e7-f6: black Queen moves one diagonal square into empty f6.
20 End black turn with kings safe.
21 d1-d2: white Queen advances along file into the square vacated by Madman.
22 End white turn with no card draw.
23 f6-e7: black Queen returns along one diagonal.
24 End black turn without state changes beyond turn allowances.
25 d2-a5: white Queen traverses empty c3,b4 diagonally.
26 End white turn; black King remains safe.
27 f7-f6: black Pawn advances one and resets the quiet clock.
28 End black turn without a card.
29 f3-f4: white Pawn advances one to empty f4.
30 End white turn; no en passant opportunity for a single step.
31 h8-h7: black Rook advances to empty h7; black kingside castling right expires.
32 End black turn preserving white kingside right only.
33 f4-f5: white Pawn advances to empty f5.
34 End white turn without drawing.
35 e7xd6: black Queen captures the original white d2 Pawn; capturedBy is black.
36 End black turn; d2 Pawn stays captured.
37 a5-d8: white Queen crosses empty b6,c7 and checks black King e8 horizontally.
38 End white turn; black has a legal King capture of the checking Queen.
39 e8xd8: black King captures the white Queen; d8 is not defended, and b8 Knight blocks white a8 Rook.
40 End black turn with neither King checked.
41 Disintegration before white move kills own e3 Pawn permanently; this is dead, not captured, and grants no capture actor.
42 e1-f1: white King moves to empty safe f1 and loses final castling right.
43 End white turn; all castling rights are gone.
44 f8-e7: black Bishop moves one diagonal square into empty e7.
45 End black turn without spending a card.
46 d3-a6: white Bishop crosses empty c4,b5 to empty a6.
47 End white turn; black King is safe.
48 g7-g6: black Pawn advances one to empty g6.
49 End black turn with no two-square opportunity.
50 g2-g3: white Pawn advances one into empty g3.
51 End white turn with no card change.
52 h7-f7: black Rook crosses empty g7 to empty f7.
53 End black turn without new castling rights.
54 b2-b4: white Pawn crosses empty b3; b3 en passant opportunity opens.
55 End white turn preserving that opportunity.
56 g6xf5: black Pawn captures white f2 Pawn diagonally; capturedBy black, and b3 opportunity expires.
57 End black turn with white f2 Pawn remaining captured.
58 c1-b2: white Bishop moves to the Pawn-vacated b2 square.
59 End white turn with kings safe.
60 c6-c5: black Pawn advances one to empty c5.
61 End black turn without an en passant right.
62 a6-d3: white Bishop returns through empty b5,c4.
63 End white turn with no card movement.
64 b8-c6: black Knight jumps in its normal L shape to empty c6.
65 End black turn; c8 Bishop blocks white a8 Rook from black d8 King.
66 a8xa7: white Rook captures black a7 Pawn directly below; capturedBy white.
67 Holy Quest after white move swaps black c8 Bishop with black g8 Knight, retaining both identities and roles.
68 End white turn after the permitted single card.
69 Winged Victory replaces black move: return captured black a7 Pawn to empty central e4, clearing capturedBy.
70 End black turn; returned Pawn keeps its original identity.
71 Ghostwalk replaces white move: Rook h1-h4 passes through own h2 Pawn and empty h3; empty destination, no capture.
72 End white turn; h2 Pawn remains on board.
73 c6xb4: black Knight captures white b2 Pawn in an L jump; capturedBy black.
74 End black turn preserving that capture.
75 a7-a3: white Rook crosses empty a6,a5,a4.
76 End white turn; a2 Pawn remains between the two a-file Rooks.
77 Evil Eye replaces black move: a1 Rook legally threatens a2 Pawn; remove only white a2 Pawn, capturedBy black, leaving attacker a1.
78 End black turn after Evil Eye.
79 a3-a8: white Rook traverses empty a4,a5,a6,a7.
80 End white turn; black c8 Knight shields black d8 King along rank eight.
81 d6-d5: black Queen moves one file step to empty d5.
82 Think Again reacts immediately: restore Queen d6 and pre-move clocks; spend white reaction card and require black to make a different move.
83 g8-h7: black Bishop makes a different legal move, satisfying the canceled-move restriction.
84 End black turn clearing the reaction allowance and canceled-move restriction.
85 f1-f2: white King moves one file step to empty safe f2.
86 Forbidden City after white move marks empty e1; card stays active instead of entering discard.
87 End white turn; e1 remains impassable.
88 d6-b6: black Queen crosses empty c6 to b6, never touching e1.
89 End black turn with Forbidden City unchanged.
90 b1-a3: white Knight makes an L jump to empty a3.
91 Rebirth after white move relocates enemy e4 Pawn to empty black starting square a7; preserves Pawn identity and ordinary move clocks.
92 End white turn after Rebirth; returned a7 Pawn is not captured.
93 b6-d6: black Queen crosses empty c6 back to d6.
94 End black turn with both Kings safe.
95 a8xc8: white Rook crosses b8, captures black g8 Knight now on c8, and checks adjacent black d8 King.
96 End white turn; black can capture the checking Rook.
97 d8xc8: black King captures that undefended white a1 Rook and escapes check.
98 End black turn; capturedBy black remains on the white Rook.
99 h4-e4: white Rook crosses empty g4,f4 to the square vacated by Rebirth.
100 End white turn with no capture.
101 f7-g7: black Rook moves horizontally one square to empty g7.
102 End black turn without effects changes.
103 a3-b5: white Knight jumps to empty b5.
104 Knightmare immediately cancels that jump: restore Knight a3 and clocks, spend black card, require a different white move.
105 e4-f4: white Rook moves one square, differing from canceled Knight move.
106 End white turn clearing the canceled-move restriction.
107 b4-a2: black Knight makes an L jump into the empty square left by Evil Eye.
108 End black turn; black Knight remains on a2.
109 g1-h3: white Knight makes an L jump to empty h3.
110 Truce after white move forbids captures; neither King is checked, so retain the continuing card and refill hand.
111 End white turn retaining both continuing cards.
112 a7-a5: returned black Pawn may double-step from its starting rank under §13.1, crossing empty a6 and opening a6 en passant opportunity.
113 End black turn retaining Truce and a6 opportunity.
114 d3-f1: white Bishop crosses empty e2 to f1; no capture and no crossing of forbidden e1.
115 End white turn retaining Truce; neither King is checked.
116 d6-d1: black Queen crosses empty d5,d4,d3,d2; no capture, no e1 crossing, and neither royal is attacked.
117 End black turn at move fifty; white has a fresh turn, both continuing cards remain, no pending choices.
`.trim().split('\n')

test('iteration 127: every action has independent physical, card, clock and royal expectations', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/127.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860127)
  assert.equal(trace.steps.length, 117)
  assert.equal(rationales.length, trace.steps.length)
  let state = createGameState(trace.initial)
  let pieces = structuredClone(state.pieces)
  const players = structuredClone(state.players)
  const effects: unknown[] = []
  let turn = structuredClone(state.turn)
  let ep: GameState['enPassant'] = []
  let half = 0, full = 1, fenTurn: Color = 'white', rights = 'KQkq'
  let rewind: { pieces: PieceState[]; half: number; full: number; fenTurn: Color; ep: GameState['enPassant'] } | undefined
  const at = (square: string) => pieces.find(piece => piece.square === square && piece.zone === 'board')
  const place = (piece: PieceState, square: SquareName) => { piece.square = square; piece.zone = 'board'; delete piece.capturedBy }
  const take = (piece: PieceState, owner: Color) => { piece.square = null; piece.zone = 'captured'; piece.capturedBy = owner }
  const royalAttackers = (color: Color, step: number) => {
    const royal = pieces.find(piece => piece.owner === color && piece.royal)!
    const [x, y] = [royal.square!.charCodeAt(0), Number(royal.square![1])]
    return pieces.filter(piece => {
      if (piece.zone !== 'board' || piece.owner === color) return false
      const [px, py] = [piece.square!.charCodeAt(0), Number(piece.square![1])]
      const dx = x - px, dy = y - py, ax = Math.abs(dx), ay = Math.abs(dy)
      if (piece.role === 'pawn') return ax === 1 && dy === (piece.owner === 'white' ? 1 : -1)
      if (piece.role === 'knight') return ax * ay === 2
      if (piece.role === 'king') return Math.max(ax, ay) === 1
      const diagonal = ax === ay && ax > 0
      const straight = (dx === 0) !== (dy === 0)
      if (!(piece.role === 'bishop' ? diagonal : piece.role === 'rook' ? straight : diagonal || straight)) return false
      for (let n = 1; n < Math.max(ax, ay); n++) {
        const square = `${String.fromCharCode(px + Math.sign(dx) * n)}${py + Math.sign(dy) * n}`
        if (at(square) || step >= 86 && square === 'e1') return false
      }
      return true
    }).map(piece => piece.id).sort()
  }
  const advance = (reset: boolean) => { half = reset ? 0 : half + 1; if (turn.color === 'black') full++; fenTurn = turn.color === 'white' ? 'black' : 'white'; ep = []; turn.phase = 'afterMove'; turn.moveMade = true }
  const boardFen = () => Array.from({ length: 8 }, (_, rank) => {
    let row = '', empty = 0
    for (const file of 'abcdefgh') {
      const p = at(`${file}${8 - rank}`)
      if (!p) { empty++; continue }
      if (empty) { row += empty; empty = 0 }
      const symbol = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[p.role]
      row += p.owner === 'white' ? symbol.toUpperCase() : symbol
    }
    return row + (empty || '')
  }).join('/')

  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1
    assert.ok(rationales[index]!.startsWith(`${step} `))
    const label = rationales[index]!
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/)
      const p = at(action.from)!
      assert.equal(p.owner, turn.color, label)
      const ordinary: Chess = Chess.fromSetup(parseFen(`${boardFen()} ${fenTurn === 'white' ? 'w' : 'b'} ${rights || '-'} - ${half} ${full}`).unwrap()).unwrap()
      assert.ok(ordinary.isLegal({ from: parseSquare(action.from)!, to: parseSquare(action.to)! }), label)
      rewind = { pieces: structuredClone(pieces), half, full, fenTurn, ep: structuredClone(ep) }
      const victim = at(action.to)
      if (step >= 110) assert.equal(victim, undefined, 'Truce prohibits captures')
      if (step >= 86) assert.notEqual(action.to, 'e1', 'Forbidden City cannot be entered')
      if (victim) take(victim, turn.color)
      if (action.from === 'h8') rights = rights.replace('k', '')
      if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '')
      const double = p.role === 'pawn' && Math.abs(Number(action.to[1]) - Number(action.from[1])) === 2
      place(p, action.to as SquareName)
      advance(p.role === 'pawn' || !!victim)
      if (double) ep = [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}` as SquareName, pawnId: p.id }]
    } else if (action.type === 'endTurn') {
      assert.equal(turn.moveMade, true, label)
      turn = { color: turn.color === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }
    } else {
      assert.equal(action.type, 'playCard', label)
      if (action.type !== 'playCard') throw new Error('Unexpected choice action')
      assert.equal(typeof action.cardInstanceId, 'string')
      const owner: Color = (action.cardInstanceId as string).startsWith('white-') ? 'white' : 'black'
      const player = players[owner]
      assert.equal(turn.cardPlays[owner], 0, label)
      const card = player.hand.find(c => c.id === action.cardInstanceId)!
      assert.ok(card, label)
      player.hand.splice(player.hand.indexOf(card), 1)
      if (step === 86) effects.push({ type: 'forbidden-city', owner: 'white', card: structuredClone(card), square: 'e1' })
      else if (step === 110) effects.push({ type: 'truce', owner: 'white', card: structuredClone(card) })
      else player.discard.push(card)
      player.hand.push(player.deck.shift()!)
      turn.cardPlays[owner]++
      switch (step) {
        case 9:
          assert.equal(action.cardId, 'madman'); assert.equal(at('e3')!.role, 'pawn'); assert.equal(at('e5')!.role, 'pawn')
          assert.equal(at('f4'), undefined); assert.equal(at('d6'), undefined); place(at('d2')!, 'd6'); advance(true); break
        case 15: assert.equal(action.cardId, 'doppelganger'); place(at('d8')!, 'e7'); advance(false); break
        case 17: {
          assert.equal(action.cardId, 'lost-castle'); const white = at('a1')!, black = at('a8')!
          place(white, 'a8'); place(black, 'a1'); rights = 'Kk'; advance(false); break
        }
        case 41: { assert.equal(action.cardId, 'disintegration'); const pawn = at('e3')!; pawn.zone = 'dead'; pawn.square = null; delete pawn.capturedBy; break }
        case 67: {
          assert.equal(action.cardId, 'holy-quest'); const bishop = at('c8')!, knight = at('g8')!
          place(bishop, 'g8'); place(knight, 'c8'); break
        }
        case 69: {
          assert.equal(action.cardId, 'winged-victory'); const pawn = pieces.find(p => p.id === 'black-pawn-a7')!
          assert.equal(pawn.zone, 'captured'); assert.equal(pawn.capturedBy, 'white'); assert.equal(at('e4'), undefined)
          place(pawn, 'e4'); advance(true); break
        }
        case 71: assert.equal(action.cardId, 'ghostwalk'); assert.equal(at('h2')!.owner, 'white'); place(at('h1')!, 'h4'); advance(false); break
        case 77: assert.equal(action.cardId, 'evil-eye'); assert.equal(at('a1')!.owner, 'black'); take(at('a2')!, 'black'); advance(true); break
        case 82: case 104:
          assert.equal(action.cardId, step === 82 ? 'think-again' : 'knightmare'); assert.ok(rewind)
          pieces = structuredClone(rewind.pieces); half = rewind.half; full = rewind.full; fenTurn = rewind.fenTurn; ep = structuredClone(rewind.ep)
          turn.moveMade = false; turn.phase = 'beforeMove'; break
        case 86: assert.equal(action.cardId, 'forbidden-city'); assert.equal(at('e1'), undefined); break
        case 91: assert.equal(action.cardId, 'rebirth'); assert.equal(at('a7'), undefined); place(at('e4')!, 'a7'); break
        case 110: assert.equal(action.cardId, 'truce'); break
        default: throw new Error(`Unreviewed card at ${step}`)
      }
    }
    const input = structuredClone(state)
    const result = applyAction(state, action)
    assert.deepEqual(state, input, `${label}: complete input immutability`)
    assert.ok(result.ok, label)
    state = result.state
    assert.deepEqual(state.pieces, pieces, `${label}: all physical identities, roles, zones and capture owners`)
    assert.deepEqual(state.players, players, `${label}: complete card zones and draw order`)
    assert.deepEqual(state.effects, effects, `${label}: complete continuing records`)
    assert.deepEqual(state.turn, turn, `${label}: timing and allowance`)
    assert.deepEqual(state.enPassant, ep, `${label}: en passant`)
    assert.equal(state.fen, `${boardFen()} ${fenTurn === 'white' ? 'w' : 'b'} ${rights || '-'} - ${half} ${full}`, `${label}: independent board and clocks`)
    assert.equal(state.orientation, 0)
    assert.equal(state.pendingRescue ?? null, null, label)
    assert.equal(state.pendingAbduction ?? null, null, label)
    assert.equal(state.pendingDoomsayer ?? null, null, label)
    assert.deepEqual(state.underElfHill ?? [], [], label)
    assert.deepEqual(state.plotsAllowances ?? [], [], `${label}: no Plots allowances`)
    assert.deepEqual(state.chaosForbidden, step === 82
      ? { player: 'black', movement: 'black-queen-d8:d6:d5' }
      : step === 104 ? { player: 'white', movement: 'white-knight-b1:a3:b5' } : undefined,
    `${label}: exact canceled-move obligation`)
    assert.equal(state.outcome, null, label)
    assert.deepEqual(royalAttackers('white', step), [], `${label}: independent white royal attack list`)
    assert.deepEqual(royalAttackers('black', step), [37, 38].includes(step) ? ['white-queen-d1']
      : [95, 96].includes(step) ? ['white-rook-a1'] : [], `${label}: independent black royal attack list`)
    assert.equal(isKingInCheck(state, 'white'), false, `${label}: white royal safe`)
    assert.equal(isKingInCheck(state, 'black'), [37, 38, 95, 96].includes(step), `${label}: black royal`)
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50)
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 13)
  assert.equal(state.fen, '2k5/1p1pb1rb/5p2/p1p1pp1p/5R2/N5PN/nBP2K1P/r2q1B2 w - - 2 28')
  assert.equal(replayTrace(trace).fen, state.fen)
})
