import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { replayTrace, type RandomTrace } from './random-campaign.js'
import { Castles, Chess } from 'chessops/chess'
import { makeBoardFen, parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { applyAction } from '../reducer.js'
import { createGameState } from '../state.js'
import { CARD_CATALOG } from './catalog.js'
import type { GameState, PieceZone } from '../types.js'

// Independently reviewed in sequence against rules §§8–13, 17, 19, 20 and 22,
// cards.md and the printed catalog timing. Each numbered entry reviews one action.
const rationales = [
  '1 Annexation: e2-e4 and h2-h4 traverse empty e3/h3; simultaneous own pawns, safe kings, both EP targets, move spent and Betrayal drawn.',
  '2 White closes the Annexation turn; Black receives its move, both EP opportunities survive until that move.',
  '3 b7-b6 is one empty forward pawn step; no check exposure, pawn clock zero, Annexation EP expires.',
  '4 Black closes b6, White starts, no card or board change.',
  '5 Ke1-e2 enters the square vacated by Annexation, no enemy attack reaches it; White castling rights end.',
  '6 White closes Ke2; Black starts with unchanged clocks and hands.',
  '7 d7-d5 crosses empty d6, pawn two-step from rank seven; d6 EP becomes available.',
  '8 Black closes d5; White can answer, d6 EP remains.',
  '9 e4xd5 captures black original d7 pawn diagonally, not EP; pawn/capture clock zero and EP expires.',
  '10 White closes the capture, preserving the captured pawn and handing Black the turn.',
  '11 c7-c6 is clear one-step pawn movement, safe e8 king, clock zero.',
  '12 Black closes c6 without drawing or discarding.',
  '13 Ke2-d3 moves diagonally to an empty safe square; d5 pawn blocks the d-file queen.',
  '14 White closes Kd3; no stale EP or card allowance.',
  '15 Bc8-a6 passes empty b7 to empty a6; diagonal two-square move, no self-check.',
  '16 White Bog reacts to the two-square bishop move: bishop stops at b7, keeps identity, Black move remains spent; Dark Mirror drawn.',
  '17 Black closes the shortened bishop move; both card allowances reset.',
  '18 Nb1-a3 is a clear knight jump; d3 king remains safe.',
  '19 White closes Na3, Black starts without board change.',
  '20 a7-a6 advances into the square vacated by Bog, no capture or EP.',
  '21 Black closes a6, White starts with pawn clock zero.',
  '22 Kd3-e4 is safe: c6 pawn attacks d5, and b7 bishop is blocked by c6.',
  '23 White closes Ke4, Black starts with unchanged hands.',
  '24 f7-f6 is an empty pawn step; f8 bishop and e8 king remain protected.',
  '25 Black closes f6, White starts without any card expenditure.',
  '26 Qd1-e1 is a one-square horizontal move into the departed king square.',
  '27 White Rebirth after its move relocates enemy e7 pawn to empty a7, a legal black pawn starting square; Cathedral drawn, move clocks unchanged.',
  '28 White closes Rebirth, Black starts; pawn remains a7 with original e7 identity.',
  '29 b6-b5 advances one empty square, no king exposure.',
  '30 Black closes b5, White starts; no refill because no card was played.',
  '31 Na3-c4 is a knight jump into empty c4; own king e4 remains safe.',
  '32 White closes Nc4, Black starts.',
  '33 Nb8-d7 jumps into the vacant original pawn square without capture.',
  '34 Black closes Nd7, White starts.',
  '35 h4-h5 advances its Annexation pawn one square, zero pawn clock.',
  '36 White closes h5, Black starts.',
  '37 Nd7-b8 returns by a legal knight jump; no castling rights are restored or lost.',
  '38 Black closes Nb8, White starts.',
  '39 a2-a4 crosses empty a3, sets a3 EP, and resets pawn clock.',
  '40 White closes a4; Black receives the EP window although no pawn can use it.',
  '41 b5-b4 advances into empty b4; a3 EP expires, white king e4 remains safe.',
  '42 Black closes b4, White starts.',
  '43 Passing in the Night swaps f2/h7 and h5/a6 simultaneously, preserves all four pawn owners and identities, captures none; replaces White move, draws Holy Quest.',
  '44 White closes both pawn swaps; Black starts, no EP created.',
  '45 Qd8-d6 traverses empty d7; d5 white pawn blocks the queen below d6, own king e8 is safe.',
  '46 Black Holy War swaps its g8 knight and b7 bishop after the move without capture; no new king attack, No Quarter drawn.',
  '47 Black closes the Holy War turn; White starts.',
  '48 Qe1-e2 is one clear forward queen step; f2 black pawn attacks e1/g1, not e2.',
  '49 White closes Qe2, Black starts.',
  '50 Qd6-c5 is one empty diagonal step; c5-d5 is blocked, so the white king e4 is not checked.',
  '51 Black closes Qc5, White starts.',
  '52 Ke4-f5 is safe: f6 pawn attacks e5/g5, and white d5 pawn blocks queen c5 across the rank.',
  '53 White closes Kf5, Black starts.',
  '54 Qc5-e7 passes empty d6 to empty e7; its e-file is blocked only by White queen e2, so neither king is attacked.',
  '55 Black closes Qe7, White starts.',
  '56 d2-d3 advances one empty square and opens the c1 bishop diagonal; no self-check.',
  '57 White closes d3, Black starts.',
  '58 Nb8-d7 jumps to an empty square; king e8 remains safe.',
  '59 Black closes Nd7, White starts.',
  '60 Bc1-h6 traverses d2/e3/f4/g5, all empty; destination empty and Kf5 safe.',
  '61 Black Knightmare cancels Bc1-h6, restores bishop c1 and prior clocks, requires a different White move; Black spends and draws Treason.',
  '62 Qe2xe7 traverses empty e3/e4/e5/e6, captures enemy queen and checks e8; differs from canceled bishop move.',
  '63 White closes the checking queen capture; Black receives its escape turn.',
  '64 Bf8xe7 captures the checking queen one diagonal step and removes check on e8.',
  '65 Black Treason swaps White a1 rook and g1 knight after its capture; same identities, no capture, no self-check; Dark Mirror drawn.',
  '66 Black closes Treason; White starts with its rook g1 and knight a1.',
  '67 Nc4-a3 is a noncapturing knight jump; Kf5 remains safe.',
  '68 White closes Na3, Black starts.',
  '69 Nd7-f8 jumps into the bishop-vacated square; no self-check.',
  '70 Black closes Nf8, White starts.',
  '71 Kf5-g6 is provisional under §11.6 because Nf8 attacks g6; Holy Quest could swap g8 bishop/f8 knight to cure it, so turn must remain pending rescue.',
  '72 Chosen Holy Quest g8/b7 does not remove Nf8 attack on g6; card fizzles and stays spent, illegal king move rewinds to f5, same White turn reopens; Long Jump drawn.',
  '73 Na3-c4 is a different legal ordinary move after failed rescue; no second card is permitted.',
  '74 White closes Nc4; Black starts and allowances reset.',
  '75 Nb7-d6 jumps into empty d6; no current attack on own e8 king.',
  '76 Black closes Nd6, White starts.',
  '77 Nc4xd6 captures the original g8 knight and checks e8 by knight geometry; normal capture resets clock.',
  '78 White closes the check; Black must be given its legal Man of Straw escape.',
  '79 Black Man of Straw swaps checked Ke8 with own b4 pawn: b4 safe, pawn e8 unpromoted on its own back rank; revoke black castling, keep regular move, Abduction drawn.',
  '80 Bg8xh7 captures original White f2 pawn diagonally and checks Kf5 along h7-g6-f5; Black b4 king safe.',
  '81 Black closes the bishop check, White begins in check.',
  '82 Long Jump d6-b5 has opposite square colors and empty destination but fails to cure Bh7-g6-f5 check; spend card, restore knight, preserve checked White regular move, Anathema drawn.',
  '83 Kf5-f4 leaves bishop diagonal and all black attacks; legal escape after fizzle.',
  '84 White closes Kf4, Black starts.',
  '85 c6-c5 is one empty forward pawn step; b4 black king safe.',
  '86 Black closes c5, White starts.',
  '87 Kf4-f5 reenters Bh7 diagonal provisionally; Anathema could swap h7 bishop/a8 rook to remove that attack.',
  '88 Chosen Anathema e7/a8 leaves Bh7 checking f5, so fizzle spends card and rewinds king to f4 and clock zero; Think Again drawn.',
  '89 a4-a5 is a legal empty pawn step after rescue rollback; White king f4 remains safe.',
  '90 White closes a5, Black starts.',
  '91 Nf8-e6 is a knight jump that checks White Kf4; own Kb4 is safe.',
  '92 Black closes the knight check, White receives an escape turn.',
  '93 Kf4-f3 leaves Ne6 attack, and f2 black pawn only attacks e1/g1; f3 is safe.',
  '94 White closes Kf3, Black starts.',
  '95 Ra8-c8 crosses empty b8 to empty c8; no attack is exposed on b4.',
  '96 Black closes Rc8, White starts.',
  '97 White Betrayal before moving kills black original h7 pawn on f2, in White half; returns captured White original f2 pawn there, no movement or clock advance; Curse drawn.',
  '98 Na1-b3 jumps into empty b3, preserves the physical original g1 knight; Kf3 safe.',
  '99 White closes Nb3, Black starts.',
  '100 Black Evangelists replaces its move with Bh7/Bf1 simultaneous cross-owner swap; neither king checked, no capture, halfmove five/fullmove23; Assassin drawn.',
  '101 Black closes Evangelists, White starts.',
  '102 Nb3-a1 is a legal returning jump; Kf3 stays safe.',
  '103 White closes Na1, Black starts.',
  '104 Black Assassin Rc8xc5 traverses empty c7/c6 and captures its own pawn c5, as explicitly allowed; replaces move, zero capture clock/fullmove24; Plots drawn.',
  '105 Black closes Assassin; White starts, black c-pawn remains captured not dead.',
  '106 Nd6-f7 is an empty knight jump, Kf3 safe.',
  '107 White closes Nf7, Black starts.',
  '108 Ne6-d8 jumps to empty d8, preserving own king safety.',
  '109 Black closes Nd8, White starts.',
  '110 Bh7-e4 traverses empty g6/f5 to empty e4; no capture and Kf3 safe.',
  '111 White closes Be4, Black starts.',
  '112 Bf1xd3 traverses empty e2, captures White d3 pawn, own Kb4 remains safe; zero capture clock.',
  '113 Black Abduction after move removes opposing nonroyal Nf7 temporarily to away, hides target in history, spends once and draws Hostage; no new capture or clock change.',
  '114 Reveal Abduction opens recall; piece remains away, no second spending, move or clock change.',
  '115 White correctly names its original b1 knight at f7; exact piece restored, no capture, pending challenge clears, Abduction remains spent.',
  '116 Black closes resolved Abduction, White starts with original Nf7 restored.',
  '117 g2-g3 advances to empty g3, no king exposure, pawn clock resets; fiftieth regular move command.',
  '118 White closes g3; Black begins safe, all responses resolved, no extra cards or moves.',
]

function ordinaryPosition(state: GameState): Chess {
  const setup = parseFen(state.fen).unwrap()
  // Man of Straw legally leaves Black pawn e8 on its own back rank (§22.5).
  // Construct the public chessops position without its standard-setup rejection.
  const position = Chess.default()
  position.board = setup.board
  position.turn = setup.turn
  position.castles = Castles.fromSetup(setup)
  position.epSquare = setup.epSquare
  position.halfmoves = setup.halfmoves
  position.fullmoves = setup.fullmoves
  return position
}

test('iteration 050 independently reviewed campaign', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/050.json', import.meta.url), 'utf8')) as RandomTrace
  assert.equal(trace.seed, 860050)
  assert.equal(trace.steps.length, 118)
  assert.equal(rationales.length, trace.steps.length)
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 15)
  let state = createGameState(trace.initial)
  const states = [state]
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1
    const why = rationales[index]!
    assert.ok(why.startsWith(`${step} `))
    const before = state
    const result = applyAction(before, action)
    assert.ok(result.ok, why)
    state = result.state
    states.push(state)
    assert.deepEqual(state.effects, [], why)
    assert.equal(state.orientation, 0, why)
    assert.equal(Boolean(state.pendingRescue), [71, 87].includes(step), why)
    assert.equal(Boolean(state.pendingAbduction), [113, 114].includes(step), why)
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string')
      const position = ordinaryPosition(before)
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! }
      if ([71, 87].includes(step)) {
        assert.equal(position.board.get(move.from)?.role, 'king', why)
        assert.equal(Math.max(Math.abs(move.from % 8 - move.to % 8), Math.abs((move.from >> 3) - (move.to >> 3))), 1, why)
        assert.equal(position.isLegal(move), false, why)
      } else assert.ok(position.isLegal(move), why)
      position.play(move)
      assert.equal(state.fen.split(' ')[0], makeBoardFen(position.board), why)
      assert.equal(parseFen(state.fen).unwrap().halfmoves, position.halfmoves, why)
      assert.equal(parseFen(state.fen).unwrap().fullmoves, position.fullmoves, why)
      const mover = before.pieces.find(piece => piece.square === action.from && piece.zone === 'board')!
      const doublePawn = mover.role === 'pawn' && Math.abs(move.from - move.to) === 16
      assert.deepEqual(state.enPassant, doublePawn ? [{ target: `${action.from[0]}${(Number(action.from[1]) + Number(action.to[1])) / 2}`, pawnId: mover.id }] : [], why)
      const victim = before.pieces.find(piece => piece.square === action.to && piece.zone === 'board')
      for (const piece of before.pieces) {
        const after = state.pieces.find(item => item.id === piece.id)!
        assert.deepEqual(after, { ...piece, ...(piece.id === mover.id ? { square: action.to } : {}),
          ...(piece.id === victim?.id ? { square: null, zone: 'captured', capturedBy: before.turn.color } : {}) }, why)
      }
    }
    if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true, why)
      assert.deepEqual(state.pieces, before.pieces, why)
      assert.equal(state.fen, before.fen, why)
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', why)
      assert.equal(state.turn.phase, 'beforeMove', why)
      assert.equal(state.turn.moveMade, false, why)
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, why)
      const position = ordinaryPosition(before)
      position.turn = before.turn.color
      assert.equal(position.isCheck(), false, why)
    }
    for (const color of ['white', 'black'] as const) {
      const prior = before.players[color]
      const after = state.players[color]
      if (action.type === 'playCard' && prior.hand.some(card => card.id === action.cardInstanceId)) {
        assert.equal(before.turn.cardPlays[color], 0, why)
        const card = prior.hand.find(item => item.id === action.cardInstanceId)!
        assert.equal(CARD_CATALOG[card.cardId]!.continuing, false, why)
        assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(color === before.turn.color ? before.turn.phase : 'afterOpponentMove'), why)
        assert.deepEqual(after.hand, [...prior.hand.filter(item => item.id !== card.id), prior.deck[0]], why)
        assert.deepEqual(after.deck, prior.deck.slice(1), why)
        assert.deepEqual(after.discard, [...prior.discard, card], why)
        assert.equal(state.turn.cardPlays[color], 1, why)
      } else assert.deepEqual(after, prior, why)
    }
  }

  const pieceAt = (step: number, id: string, square: string | null, zone: PieceZone = 'board') => {
    const piece = states[step]!.pieces.find(item => item.id === id)!
    assert.equal(piece.square, square, rationales[step - 1])
    assert.equal(piece.zone, zone, rationales[step - 1])
    assert.equal(piece.promoted, false)
    assert.equal(piece.neutral, false)
  }
  for (const [step, id, square, zone] of [
    [1, 'white-pawn-e2', 'e4'], [1, 'white-pawn-h2', 'h4'],
    [16, 'black-bishop-c8', 'b7'], [27, 'black-pawn-e7', 'a7'],
    [43, 'white-pawn-f2', 'h7'], [43, 'black-pawn-h7', 'f2'],
    [43, 'white-pawn-h2', 'a6'], [43, 'black-pawn-a7', 'h5'],
    [46, 'black-knight-g8', 'b7'], [46, 'black-bishop-c8', 'g8'],
    [61, 'white-bishop-c1', 'c1'],
    [65, 'white-rook-a1', 'g1'], [65, 'white-knight-g1', 'a1'],
    [72, 'white-king-e1', 'f5'], [72, 'black-bishop-c8', 'g8'], [72, 'black-knight-g8', 'b7'],
    [79, 'black-king-e8', 'b4'], [79, 'black-pawn-b7', 'e8'],
    [82, 'white-knight-b1', 'd6'], [88, 'white-king-e1', 'f4'],
    [97, 'white-pawn-f2', 'f2'], [97, 'black-pawn-h7', null, 'dead'],
    [100, 'white-bishop-f1', 'h7'], [100, 'black-bishop-c8', 'f1'],
    [104, 'black-rook-a8', 'c5'], [104, 'black-pawn-c7', null, 'captured'],
    [113, 'white-knight-b1', null, 'away'], [114, 'white-knight-b1', null, 'away'],
    [115, 'white-knight-b1', 'f7'],
  ] as const) pieceAt(step, id, square, zone)
  assert.deepEqual(states[1]!.enPassant, [{ target: 'e3', pawnId: 'white-pawn-e2' }, { target: 'h3', pawnId: 'white-pawn-h2' }])
  for (const step of [61, 72, 88]) {
    const original = states[step === 61 ? 59 : step - 2]!
    assert.equal(states[step]!.fen, original.fen)
    assert.deepEqual(states[step]!.pieces, original.pieces)
    assert.equal(states[step]!.turn.moveMade, false)
  }
  for (const step of [72, 82, 88]) assert.equal(states[step]!.history.at(-1)?.type, 'cardFizzled')
  assert.equal(states[82]!.fen, states[81]!.fen)
  assert.deepEqual(states[82]!.pieces, states[81]!.pieces)
  assert.equal(states[79]!.turn.moveMade, false)
  assert.equal(states[79]!.fen.split(' ')[2], '-')
  assert.equal(states[97]!.turn.moveMade, false)
  for (const [step, turn, halfmoves, fullmoves] of [
    [1, 'black', 0, 1], [16, 'white', 2, 5], [27, 'black', 1, 7], [43, 'black', 0, 11],
    [46, 'white', 1, 12], [61, 'white', 1, 15], [65, 'white', 0, 16], [72, 'white', 2, 17],
    [79, 'black', 0, 18], [82, 'white', 0, 19], [88, 'white', 0, 20], [97, 'white', 3, 22],
    [100, 'white', 5, 23], [104, 'white', 0, 24], [113, 'white', 0, 26],
  ] as const) {
    const setup = parseFen(states[step]!.fen).unwrap()
    assert.deepEqual([setup.turn, setup.halfmoves, setup.fullmoves], [turn, halfmoves, fullmoves], rationales[step - 1])
    if (step !== 113) {
      const position = ordinaryPosition(states[step]!)
      const action = trace.steps[step - 1]!.action
      assert.equal(action.type, 'playCard')
      if (action.type !== 'playCard') throw new Error('expected card')
      const actor = states[step - 1]!.players.white.hand.some(card => card.id === action.cardInstanceId) ? 'white' : 'black'
      position.turn = actor
      assert.equal(position.isCheck(), step === 82, rationales[step - 1])
      position.turn = actor === 'white' ? 'black' : 'white'
      assert.equal(position.isCheckmate(), false, rationales[step - 1])
    }
  }
  // The two provisional moves have a real available rescue, not just card presence.
  for (const [step, a, b] of [[71, 'g8', 'f8'], [87, 'h7', 'a8']] as const) {
    const position = ordinaryPosition(states[step]!)
    position.turn = 'white'
    assert.equal(position.isCheck(), true)
    const first = parseSquare(a)!, second = parseSquare(b)!
    const firstPiece = position.board.get(first)!, secondPiece = position.board.get(second)!
    position.board.set(first, secondPiece)
    position.board.set(second, firstPiece)
    assert.equal(position.isCheck(), false, `step ${step}: independent alternative rescue`)
  }
  for (const step of [1, 43, 100, 104]) assert.equal(states[step]!.turn.moveMade, true)
  assert.equal(states[113]!.pendingAbduction?.phase, 'concealment')
  assert.equal(states[114]!.pendingAbduction?.phase, 'recall')
  assert.deepEqual(states[115]!.pieces, states[112]!.pieces)
  assert.equal(states[115]!.fen, states[112]!.fen)
  assert.deepEqual(state.enPassant, [])
  assert.equal(state.fen, '3np2r/p3bNp1/P4p2/P1rP3p/1k2B3/3b1KP1/1PP2P2/N1B3RR b - - 0 26')
  assert.equal(replayTrace(trace).fen, state.fen)
})
