import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order against rules §§8–13 and each printed catalog timing.
const rationales = [
  '1 Fanatic sends c2 Pawn through empty c3,c4 to c5; no capture or en passant; replaces White move, draws Blessing.',
  '2 End White replacement move; Black receives fresh allowances with unchanged board and clocks.',
  '3 f7-f6 advances Black Pawn into empty square, clears en passant, resets halfmove and advances fullmove.',
  '4 End Black move; White starts with no card expenditure.',
  '5 a2-a4 passes empty a3; physical a2 Pawn offers a3 en passant, not a FEN target without a captor.',
  '6 End White turn preserves the new a3 opportunity for Black.',
  '7 g7-g6 is a clear single Pawn advance; old a3 opportunity expires.',
  '8 End Black turn after g6; pieces, hands and clocks unchanged.',
  '9 h2-h3 is an empty single step; White King remains behind its central pieces.',
  '10 End White turn after h3; reset both card allowances.',
  '11 b8-a6 is a Knight jump; a6 empty; neither royal exposed.',
  '12 Siege after Black move swaps physical g8 Knight and h8 Rook; neither captures; draw Riposte; non-move swap leaves clocks.',
  '13 End Black Siege turn; g8 holds h8 Rook and h8 holds g8 Knight.',
  '14 b2-b3 advances one empty square; reset halfmove.',
  '15 End White b3 turn with five cards retained.',
  '16 d7-d6 advances one empty square; White c5 Pawn now can capture it.',
  '17 End Black turn after d6; no delayed effects.',
  '18 c5xd6 captures physical black d7 Pawn with physical white c2 Pawn; neither promotes.',
  '19 End White capture turn; captured Pawn remains off board.',
  '20 c7-c6 advances one; d6 Pawn attacks c7/e7, not Black e8 King.',
  '21 End Black c6 turn; same captured inventory.',
  '22 Bombard replaces White move: a1-a2 Rook uses normal clear one-step ray, optional jump unused; revoke queenside right, draw Breakthrough.',
  '23 End White Bombard turn; no second regular move.',
  '24 h7-h6 is an empty one-step Black Pawn move.',
  '25 End Black h6 turn with board unchanged.',
  '26 b1-c3 is an empty Knight jump; White e1 remains protected.',
  '27 End White Knight turn; opponent last moved type is Knight.',
  '28 Doppelganger uses previous Knight type: original g8 Knight h8-f7 jumps to empty f7 without capture; replaces Black move, draws Vendetta.',
  '29 End Black Doppelganger turn; a6 Knight is a different physical piece.',
  '30 h3-h4 is a single Pawn advance to empty h4.',
  '31 End White h4 turn.',
  '32 d8xd6 Queen follows clear d7 to capture original white c2 Pawn; central pieces still shield both Kings.',
  '33 End Black Queen capture turn; white c2 Pawn remains captured.',
  '34 b3-b4 advances white b2 Pawn, no promotion or en passant.',
  '35 End White b4 turn.',
  '36 Bombard sends original h8 Rook from g8 to empty h8, no obstacle needed; physical Rook movement removes its remaining castling right; draw Dubbing.',
  '37 End Black Bombard turn; no regular move remains.',
  '38 b4-b5 is an empty forward Pawn step.',
  '39 End White b5 turn.',
  '40 a6-c7 Knight jump returns original b8 Knight inward; c7 empty.',
  '41 End Black Knight turn; f7 Knight remains separate.',
  '42 g2-g4 traverses empty g3; creates g3 en passant for physical g2 Pawn.',
  '43 End White g4 turn preserves g3 opportunity.',
  '44 Onslaught simultaneously advances e7-e6 and f6-f5 to empty squares; optional subset is legal, clears g3 and replaces Black move; draw Neutrality.',
  '45 End Black Onslaught turn with both physical Pawns retained.',
  '46 b5-b6 is an empty Pawn step; b7 remains occupied so ordinary advance stops there.',
  '47 End White b6 turn.',
  '48 e8-d8 King steps left to empty d8; no White piece attacks d8; revoke Black castling.',
  '49 End Black King move.',
  '50 h4-h5 advances into empty h5 immediately ahead of Black h6 Pawn.',
  '51 End White h5 turn.',
  '52 Irresistible Force pushes h5 White Pawn to empty h4 and moves h6 Black Pawn to h5; neither captured, Kings not pushed; draw Crusade.',
  '53 End Black replacement turn; both h-file Pawn identities survive.',
  '54 c1-b2 Bishop diagonal step enters now-empty b2.',
  '55 End White Bishop turn.',
  '56 g6-g5 advances Black Pawn one square; g4 occupied but no capture needed.',
  '57 End Black g5 turn.',
  '58 c3-b5 Knight jump to empty b5; b6 Pawn is a distinct piece.',
  '59 Figure Dance rotates h1 White Rook to h8, h8 Black Rook to a8, a8 Black Rook to a1; a1 originally empty. Simultaneous, no captures; d1 Queen blocks a1-e1 and f8 Bishop blocks h8-d8; draw Rebirth.',
  '60 End White Figure Dance turn; all three Rook identities preserved, all castling gone.',
  '61 f8-g7 Bishop move opens h8-g8-f8-e8-d8 Rook ray to Black King; temporary pending rescue is required under §11.6.',
  '62 Vendetta cannot cure that Rook check: card spent and draw Pacifism; illegal preliminary Bishop move rolls back to f8, clocks and Black move restored; no continuing Vendetta remains.',
  '63 c7xb5 original b8 Knight captures original white b1 Knight; f8 Bishop still blocks h8-d8 ray.',
  '64 End Black capture turn; Vendetta allowance resets without reviving effect.',
  '65 f1-g2 Bishop moves diagonally into empty g2.',
  '66 End White g2 turn.',
  '67 d6-c5 Queen moves one diagonal step; f8 still screens Black King.',
  '68 End Black c5 turn.',
  '69 e2-e3 advances empty square; e3 Pawn still screens e1 vertically.',
  '70 End White e3 turn.',
  '71 d8-e8 Black King steps right; f8 Bishop blocks h8 Rook attack on e8.',
  '72 End Black King turn.',
  '73 Breakthrough b6xb7 forward-captures physical black b7 Pawn; White b2 Pawn reaches seventh, not promotion; draw Tournament.',
  '74 End White replacement capture turn.',
  '75 a8-b8 original black h8 Rook moves to empty b8; not original a8 Rook now at a1.',
  '76 End Black Rook turn.',
  '77 Long Jump sends surviving g1 Knight to empty a6 of opposite square color; no capture, draw Mystic Shield.',
  '78 End White Long Jump turn; captured b1 Knight stays captured.',
  '79 e8-d8 King steps safely: f8 blocks h8 ray; a6 Knight attacks b8,c7,c5,b4, not d8.',
  '80 End Black King turn.',
  '81 a2xa1 White original a1 Rook captures Black original a8 Rook; the other Black Rook remains b8.',
  '82 Mystic Shield targets just-moved a1 Rook, no board change; protect through following Black turn and draw Betrayal.',
  '83 End White turn retains shield during Black next turn.',
  '84 c5-e5 Queen slides through empty d5; no shield capture, e3 Pawn blocks e5-e1.',
  '85 End Black turn expires White Rook shield exactly now.',
  '86 d1-c2 White Queen diagonal step; captured a1 attacker no longer exists.',
  '87 End White c2 turn.',
  '88 Pacifism targets owned nonroyal Queen e5 before move; physical card stays active, draw Holy Quest, regular move retained.',
  '89 c8-d7 Bishop moves one diagonal step; f8 Bishop still blocks h8-d8 rook check.',
  '90 End Black Bishop turn; Pacifism remains on original d8 Queen.',
  '91 h8xf8 White original h1 Rook crosses empty g8, captures original f8 Bishop, and checks d8 King through e8.',
  '92 End White checking turn; Black gets its legal reply.',
  '93 d7-e8 original c8 Bishop interposes on f8-e8-d8 Rook ray, curing check without capture.',
  '94 End Black turn after Bishop interposition.',
  '95 e1-d1 White King steps to unattacked d1; b5 Knight attacks c3/d4/a3/d6/c7/a7, not d1.',
  '96 End White King turn.',
  '97 b5-c3 Knight jump gives check to d1 King by c3-d1 geometry.',
  '98 End Black checking turn; White must cure the Knight check.',
  '99 c2xf5 White Queen traverses empty d3,e4 and captures original f7 Pawn, but leaves c3-d1 Knight check; temporary rescue only.',
  '100 Heresy moves enemy e8-e7 then own b2-a2,g2-g3 Bishops in proposal; none cures Knight check. Fizzle spends card/draws Passing in the Night and restores Queen c2, Pawn f5, Bishops and clocks before illegal move.',
  '101 d1-e1 King escapes c3 Knight (which attacks e2,e4,d5,b5,a4,a2,b1,d1); e3 Pawn blocks Queen e5 line, Pacifism also suppresses Queen captures.',
  '102 End White restored-and-replayed turn; spent Heresy remains discarded.',
  '103 c3-d5 Knight jump leaves Black King protected by Bishop e8; d5 attacks e3/f4/f6/e7/c7/b6/b4/c3.',
  '104 End Black Knight turn.',
  '105 f8xe8 Rook captures original c8 Bishop and checks adjacent d8 King; original f8 Bishop was captured earlier.',
  '106 End White checking turn.',
  '107 d8-d7 Black King escapes Rook e8 rank/file attack; a6 Knight does not attack d7, b7 Pawn attacks a8/c8, White Queen c2 is not aligned with d7.',
  '108 End Black escape turn.',
  '109 e8-g8 White Rook slides through empty f8; no capture and no check on d7.',
  '110 End White g8 turn.',
  '111 e5-e4 Pacifist Queen may move without capturing; empty e4, marker follows physical Queen, cannot give check.',
  '112 End Black Queen turn retains Pacifism.',
  '113 e1-d1 White King moves safely; d5/f7 Knights do not attack d1; Queen e4 is not aligned with d1.',
  '114 End White King turn.',
  '115 b8xg8 Black original h8 Rook passes empty c8,d8,e8,f8 and captures White original h1 Rook; White a1 Rook survives.',
  '116 End Black Rook capture turn.',
  '117 d1-c1 King steps safely; d5/f7 Knights do not attack c1, g8 Rook not aligned; Queen e4 also not aligned.',
  '118 End White c1 turn.',
  '119 e6-e5 Black original e7 Pawn advances to empty e5; e4 Queen is separate; no promotion, reset clock.',
  '120 End Black fiftieth regular command; White beforeMove, Pacifism persists and no pending rescue.',
];

test('iteration 084 independent semantic review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/084.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860084);
  assert.equal(rationales.length, 120);
  assert.equal(trace.steps.length, rationales.length);
  // Independently specified physical card displacements, including simultaneous swaps.
  const relocations: Record<number, Record<string, string | null>> = {
    1: { 'white-pawn-c2': 'c5' },
    12: { 'black-knight-g8': 'h8', 'black-rook-h8': 'g8' },
    22: { 'white-rook-a1': 'a2' },
    28: { 'black-knight-g8': 'f7' },
    36: { 'black-rook-h8': 'h8' },
    44: { 'black-pawn-e7': 'e6', 'black-pawn-f7': 'f5' },
    52: { 'white-pawn-h2': 'h4', 'black-pawn-h7': 'h5' },
    59: { 'white-rook-h1': 'h8', 'black-rook-h8': 'a8', 'black-rook-a8': 'a1' },
    73: { 'white-pawn-b2': 'b7', 'black-pawn-b7': null },
    77: { 'white-knight-g1': 'a6' },
  };
  let state = createGameState(trace.initial);
  const states = [state];
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const rationale = rationales[index]!;
    assert.ok(rationale.startsWith(`${step} `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, rationale);
    state = result.state;
    states.push(state);
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const position = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
      const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
      assert.equal(position.isLegal(move), ![61, 99].includes(step), rationale);
      position.play(move);
      assert.equal(makeBoardFen(position.board), state.fen.split(' ')[0], rationale);
      assert.deepEqual(state.players, before.players, rationale);
      const mover = before.pieces.find(piece => piece.square === action.from)!;
      const victim = before.pieces.find(piece => piece.square === action.to);
      const oldFen = before.fen.split(' ');
      const newFen = state.fen.split(' ');
      assert.equal(newFen[1], before.turn.color === 'white' ? 'b' : 'w', rationale);
      assert.equal(Number(newFen[4]), mover.role === 'pawn' || victim ? 0 : Number(oldFen[4]) + 1, rationale);
      assert.equal(Number(newFen[5]), Number(oldFen[5]) + (before.turn.color === 'black' ? 1 : 0), rationale);
      assert.deepEqual(state.pieces, before.pieces.map(piece => piece.id === mover.id
        ? { ...piece, square: action.to }
        : piece.id === victim?.id ? { ...piece, square: null, zone: 'captured', capturedBy: before.turn.color } : piece), rationale);
      assert.equal(!!state.pendingRescue, [61, 99].includes(step), rationale);
      assert.deepEqual(state.effects, before.effects, rationale);
    } else if (action.type === 'endTurn') {
      assert.deepEqual(state.pieces, before.pieces, rationale);
      assert.deepEqual(state.players, before.players, rationale);
      assert.equal(state.fen, before.fen, rationale);
      assert.deepEqual(state.turn, { color: before.turn.color === 'white' ? 'black' : 'white',
        phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } }, rationale);
      assert.deepEqual(state.effects, step === 85 ? [] : before.effects, rationale);
    } else if (action.type === 'playCard') {
      const owner = before.turn.color;
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(before.turn.phase), rationale);
      assert.equal(before.turn.cardPlays[owner], 0, rationale);
      const player = before.players[owner];
      const card = player.hand.find(item => item.id === action.cardInstanceId)!;
      assert.ok(card, rationale);
      assert.deepEqual(state.players[owner].hand, [...player.hand.filter(item => item.id !== card.id), player.deck[0]], rationale);
      assert.deepEqual(state.players[owner].deck, player.deck.slice(1), rationale);
      assert.deepEqual(state.players[owner].discard, step === 88 ? player.discard : [...player.discard, card], rationale);
      assert.deepEqual(state.players[owner === 'white' ? 'black' : 'white'], before.players[owner === 'white' ? 'black' : 'white'], rationale);
      assert.equal(state.turn.cardPlays[owner], 1, rationale);
      if ([62, 100].includes(step)) {
        assert.deepEqual(state.pieces, states[step - 2]!.pieces, rationale);
        assert.equal(state.fen, states[step - 2]!.fen, rationale);
        assert.equal(state.turn.moveMade, false, rationale);
        assert.equal(!!state.pendingRescue, false, rationale);
      } else {
        const changes = relocations[step] ?? {};
        assert.deepEqual(state.pieces, before.pieces.map(piece => Object.hasOwn(changes, piece.id)
          ? { ...piece, square: changes[piece.id], zone: changes[piece.id] === null ? 'captured' : 'board', ...(changes[piece.id] === null ? { capturedBy: owner } : {}) } : piece), rationale);
        assert.equal(state.turn.moveMade, step !== 88, rationale);
        if (before.turn.phase === 'beforeMove' && step !== 88) {
          assert.equal(Number(state.fen.split(' ')[4]), [1, 44, 52, 73].includes(step) ? 0 : Number(before.fen.split(' ')[4]) + 1, rationale);
          assert.equal(Number(state.fen.split(' ')[5]), Number(before.fen.split(' ')[5]) + (owner === 'black' ? 1 : 0), rationale);
        } else assert.deepEqual(state.fen.split(' ').slice(4), before.fen.split(' ').slice(4), rationale);
      }
      const expectedEffects = step === 82
        ? [{ type: 'mystic-shield', owner: 'white', player: 'white', pieceId: 'white-rook-a1' }]
        : step === 88 ? [{ type: 'pacifism', owner: 'black', card, pieceId: 'black-queen-d8' }]
          : before.effects;
      assert.deepEqual(state.effects, expectedEffects, rationale);
    } else assert.fail(`Unreviewed action ${step}`);
    assert.equal(state.orientation, 0, rationale);
    assert.deepEqual(state.enPassant, step === 5 || step === 6 ? [{ target: 'a3', pawnId: 'white-pawn-a2' }]
      : step === 42 || step === 43 ? [{ target: 'g3', pawnId: 'white-pawn-g2' }] : [], rationale);
  }
  assert.equal(trace.steps.filter(({ action }) => action.type === 'playCard').length, 14);
  assert.equal(state.fen, '6r1/pP1k1n2/N1p5/3npppp/P3q1PP/4P3/1BQP1PB1/R1K5 w - - 0 29');
  assert.deepEqual(replayTrace(trace), state);
});
