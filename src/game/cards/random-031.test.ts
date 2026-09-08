import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeBoardFen, parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { PieceState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Sequential review against rules §§8–17, 22.10 and the printed catalog timings.
const rationales = [
  '1 White e2-e4 crosses empty e3; Pawn double step creates e3 en passant.',
  '2 White ends; Black receives the move and the e3 opportunity survives.',
  '3 Black e7-e5 crosses empty e6; replaces the previous en-passant opportunity.',
  '4 Black ends; White receives the move without another clock increment.',
  '5 Ng1-e2 jumps onto the emptied Pawn square; expires en passant.',
  '6 White ends safely; no card draw is due without expenditure.',
  '7 Guardian moves f7-f6 and its immediately trailing Bishop f8-f7; no capture, no en passant.',
  '8 Black ends its replacement move; card allowance resets.',
  '9 Ne2-f4 is an unobstructed Knight jump to an empty square.',
  '10 White ends; both Kings remain screened.',
  '11 d7-d5 crosses empty d6 and creates the d6 opportunity.',
  '12 Black ends while retaining that opportunity for White.',
  '13 c2-c3 is a single empty forward step, declining en passant.',
  '14 White ends without changing the board.',
  '15 Evangelists exchanges Black Bc8 and White Bf1, preserving owners and identities; neither King is checked.',
  '16 Black ends the Bishop-swap replacement turn.',
  '17 h2-h3 is a legal empty forward step; Bf1 does not attack e1.',
  '18 White ends and resets allowances.',
  '19 Madman jumps the f6 Pawn over occupied e5 to empty d4; e5 is not captured.',
  '20 Black ends its Pawn replacement move.',
  '21 Evil Eye uses White Bc8 legal adjacent capture threat on b7, removes only that Pawn, and leaves the Bishop stationary.',
  '22 White ends the stationary-capture replacement turn.',
  '23 Qd8-d7 slides one square to the vacated Pawn square.',
  '24 Black ends; Queen on d7 does not expose its King.',
  '25 Breakthrough lets the White e4 Pawn capture the opposing e5 Pawn straight forward.',
  '26 White ends after the forward capture; no promotion or en passant.',
  '27 Under Elf Hill sends Black Ke8 away, consumes the move, and removes Black castling rights.',
  '28 Black ends; the King stays away through White turn.',
  '29 White Bc8-a6 traverses b7, emptied by Evil Eye; the away King is not captured.',
  '30 White ends and opens the mandatory Black King-return obligation.',
  '31 Black King returns to empty, safe edge square e8; its next regular move remains available but the King is immobilized.',
  '32 Black Bf1-d3 crosses empty e2; it does not move the returned King.',
  '33 Truce follows the Bishop move, retains its physical card, and changes no clocks or pieces.',
  '34 Black ends; return immobilization ends while Truce remains active.',
  '35 Long Jump relocates White Nb1 to empty opposite-color d8; no capture during Truce.',
  '36 White ends the Long Jump turn; Truce remains.',
  '37 Black Qd7-b5 crosses empty c6, capturing nothing.',
  '38 Black ends under unchanged Truce.',
  '39 White Qd1-g4 traverses empty e2 and f3, capturing nothing.',
  '40 White ends under unchanged Truce.',
  '41 Black Qb5-c5 slides to an empty neighboring square.',
  '42 Black ends; no geometric King check ends Truce.',
  '43 White Nf4-h5 jumps without capture.',
  '44 White ends; h5 Knight does not attack e8.',
  '45 Black Nb8-c6 jumps to an empty square.',
  '46 Black ends without drawing or spending.',
  '47 White Nh5-f6 now attacks Ke8; this noncapture ends and discards Truce.',
  '48 White ends checking Black, which receives an escape turn.',
  '49 Black Nc6-b4 leaves Ke8 checked by Nf6; §11.6 permits only a pending same-turn rescue.',
  '50 Challenge names movable White a2 Pawn; §11.7 suppresses other White capture threats, curing the f6 Knight check.',
  '51 Black can end after that rescue; Challenge binds White next move.',
  '52 White a2-a4 fulfills Challenge through empty a3, expires the restriction, and restores the Knight check on Black.',
  '53 White ends; Black must answer the restored Nf6 check.',
  '54 Black Ng8xf6 captures that checking physical Knight and restores King safety.',
  '55 Black ends; unused Legacy reaction expires.',
  '56 White Rh1-g1 moves to an empty square and revokes its kingside castling right.',
  '57 White ends retaining only queenside castling rights.',
  '58 Black Bd3xa6 crosses empty c4 and b5, capturing the swapped White Bishop.',
  '59 Black ends; captured Bishop remains off board.',
  '60 White Qg4-d1 crosses empty f3 and e2.',
  '61 White ends without a card play.',
  '62 Black Ba6-c8 crosses empty b7; ownership never changed during Evangelists.',
  '63 Black ends with Bishop safely returned to c8.',
  '64 White g2-g3 moves one empty forward square.',
  '65 White ends; no en-passant right arose.',
  '66 Forced March moves Black c7 Pawn sideways into empty b7; no capture, no promotion.',
  '67 Black ends the replacement Pawn move.',
  '68 White f2-f4 crosses empty f3 and creates the f3 opportunity.',
  '69 White ends retaining that opportunity for Black.',
  '70 Black Ra8-b8 moves one empty square and expires en passant.',
  '71 Black ends; its previously revoked rights stay revoked.',
  '72 Lost Castle swaps White Ra1 and Black Rb8; Bc1 screens White King from the new enemy Ra1; White loses last castling right.',
  '73 White ends the safe Rook-swap replacement move.',
  '74 Black Qc5-c7 crosses empty c6 to the square emptied by Forced March.',
  '75 Black ends without changing pieces.',
  '76 White Rb8xb7 captures the relocated physical c7 Pawn.',
  '77 White ends; no Hostage reaction was used.',
  '78 Black Bf7-h5 crosses empty g6 without capture.',
  '79 Black ends; White King is still safe.',
  '80 White Rg1-g2 enters its vacated Pawn square.',
  '81 White ends without changing rights or cards.',
  '82 Black Ke8xd8 takes White Knight on a safe adjacent square; White Rb7 does not attack d8.',
  '83 Black ends; no Legacy reaction was used.',
  '84 White c3xd4 captures the physical f7 Pawn previously relocated by Madman.',
  '85 White ends; no Hostage reaction was used.',
  '86 Black Nb4-a2 jumps to the square vacated by Challenge-bound Pawn.',
  '87 Black ends; Knight on a2 does not check e1.',
  '88 White Rb7-b5 crosses empty b6.',
  '89 White ends without a card.',
  '90 Black Qc7-c3 crosses empty c6, c5, c4; White d2 still blocks its diagonal to Ke1.',
  '91 Black ends with no check on White.',
  '92 White Ke1-f1 enters a safe adjacent empty square.',
  '93 White ends; all castling rights remain absent.',
  '94 Black Nf6-d7 jumps to an empty square.',
  '95 Vendetta is played after that move and retained as a Continuing Effect; White has legal captures.',
  '96 Black ends, transferring the compulsory capture obligation to White.',
  '97 White Qd1xh5 crosses empty e2,f3,g4 and captures Black Bishop, satisfying Vendetta.',
  '98 White ends; Black has legal captures so Vendetta persists.',
  '99 Black Qc3xd4 captures the White physical c2 Pawn and satisfies Vendetta.',
  '100 Black ends; White still has a legal capture.',
  '101 White Rb5xd5 crosses empty c5 and captures Black d7 Pawn, satisfying Vendetta.',
  '102 White ends; Black has legal captures.',
  '103 Black Qd4xf4 crosses empty e4 and captures White f2 Pawn, checking Kf1 down empty f3,f2.',
  '104 Black ends; White may capture the checking Queen.',
  '105 White g3xf4 takes Black Queen, satisfies Vendetta, and removes check.',
  '106 White ends; Black still has Ra1xc1.',
  '107 Black Ra1xc1 crosses empty b1 and captures White Bishop, checking Kf1 down d1,e1.',
  '108 Black ends; no White legal capture cures this Rook check, so Vendetta expires and is discarded.',
  '109 White Rd5-c5 is a quiet move that leaves Rook check; it must retain pending rescue.',
  '110 Dungeon relocates the checking nonroyal Black Rc1 to empty corner a8 and locks it for Black next turn; White check is cured.',
  '111 White ends after Dungeon rescue; Black Rook remains locked.',
  '112 Black g7-g5 crosses empty g6; moving this Pawn obeys Dungeon and creates g6 en passant.',
  '113 Black ends; Dungeon lock expires and g6 opportunity survives.',
  '114 Blessing moves White Rc5 diagonally via empty b4 to empty a3; consumes the move and expires en passant.',
  '115 White ends the Bishop-geometry Rook move; the piece is still a Rook.',
  '116 Black Kd8-c7 moves diagonally onto a safe empty square.',
  '117 Black ends safely.',
  '118 White Qh5-f3 crosses empty g4 without capture.',
  '119 White ends with no card draw due.',
  '120 Black h7-h6 makes a single empty forward Pawn step.',
  '121 Black ends without creating an en-passant opportunity.',
  '122 White Rg2-g3 moves onto the square vacated by its capturing Pawn.',
  '123 White ends safely; no effects remain.',
  '124 Black Rh8-h7 enters the square vacated by its Pawn; fiftieth regular move command.',
  '125 Black ends; White starts with both Kings on board and no pending obligations.',
];

test('iteration 031: 125 independently reviewed actions and 50 regular moves', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/031.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860031);
  assert.equal(trace.failure, undefined);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 125);
  const placements: Record<number, Record<string, string | null>> = {
    7: { 'black-pawn-f7': 'f6', 'black-bishop-f8': 'f7' },
    15: { 'white-bishop-f1': 'c8', 'black-bishop-c8': 'f1' },
    19: { 'black-pawn-f7': 'd4' },
    21: { 'black-pawn-b7': null },
    25: { 'white-pawn-e2': 'e5', 'black-pawn-e7': null },
    27: { 'black-king-e8': null },
    31: { 'black-king-e8': 'e8' },
    35: { 'white-knight-b1': 'd8' },
    66: { 'black-pawn-c7': 'b7' },
    72: { 'white-rook-a1': 'b8', 'black-rook-a8': 'a1' },
    110: { 'black-rook-a8': 'a8' },
    114: { 'white-rook-a1': 'a3' },
  };
  let state = createGameState(trace.initial);
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1;
    const why = rationales[index]!;
    assert.ok(why.startsWith(`${step} `));
    const before = state;
    const result = applyAction(before, action);
    assert.ok(result.ok, why);
    state = result.state;
    const changes = { ...placements[step] };
    let pawnMove = false;
    let captured = step === 21 || step === 25;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const piece = before.pieces.find(item => item.square === action.from)!;
      assert.equal(piece.owner, before.turn.color, why);
      changes[piece.id] = action.to;
      const victim = before.pieces.find(item => item.square === action.to);
      if (victim) { changes[victim.id] = null; captured = true; }
      pawnMove = piece.originalRole === 'pawn';
      // 29 has an away King; 49/109 deliberately await a saving card;
      // 52 begins with a geometric check suppressed by Challenge (§11.7).
      if (![29, 49, 52, 109].includes(step)) {
        const chess = Chess.fromSetup(parseFen(before.fen).unwrap()).unwrap();
        const move = { from: parseSquare(action.from)!, to: parseSquare(action.to)! };
        assert.ok(chess.isLegal(move), why);
        chess.play(move);
        assert.equal(makeBoardFen(chess.board), state.fen.split(' ')[0], why);
      }
      assert.deepEqual(state.players, step === 47 ? {
        ...before.players,
        black: { ...before.players.black, discard: [...before.players.black.discard,
          { id: 'black-hand-1-truce', cardId: 'truce' }] },
      } : before.players, why);
      assert.equal(state.turn.color, before.turn.color, why);
      assert.equal(state.turn.moveMade, true, why);
    } else if (action.type === 'playCard') {
      const player = before.turn.color;
      const prior = before.players[player];
      const card = prior.hand.find(item => item.id === action.cardInstanceId)!;
      assert.ok(card, why);
      assert.equal(before.turn.cardPlays[player], 0, why);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(before.turn.phase), why);
      assert.deepEqual(state.players[player].hand,
        [...prior.hand.filter(item => item.id !== card.id), prior.deck[0]], why);
      assert.deepEqual(state.players[player].deck, prior.deck.slice(1), why);
      assert.deepEqual(state.players[player].discard,
        CARD_CATALOG[card.cardId]!.continuing ? prior.discard : [...prior.discard, card], why);
      const opponent = player === 'white' ? 'black' : 'white';
      assert.deepEqual(state.players[opponent], before.players[opponent], why);
      assert.equal(state.turn.cardPlays[player], 1, why);
      assert.equal(state.turn.moveMade, true, why);
      pawnMove = [7, 19, 25, 66].includes(step);
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true, why);
      assert.ok(!before.pendingRescue, why);
      assert.equal(state.turn.color, before.turn.color === 'white' ? 'black' : 'white', why);
      assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 }, why);
      assert.equal(state.turn.phase, 'beforeMove', why);
      assert.equal(state.turn.moveMade, false, why);
      assert.equal(state.fen, before.fen, why);
      assert.deepEqual(state.players.white, before.players.white, why);
      if (step !== 108) assert.deepEqual(state.players.black, before.players.black, why);
      else assert.deepEqual(state.players.black, {
        ...before.players.black, discard: [...before.players.black.discard,
          { id: 'black-deck-4-vendetta', cardId: 'vendetta' }],
      }, why);
    }
    const expectedPieces = before.pieces.map(piece => {
      if (!(piece.id in changes)) return piece;
      const square = changes[piece.id] as PieceState['square'];
      return { ...piece, square, zone: square ? 'board' : step === 27 ? 'away' : 'captured', ...(!square && step !== 27 ? { capturedBy: before.turn.color } : {}) };
    });
    assert.deepEqual(state.pieces, expectedPieces, why);
    assert.equal(state.orientation, 0, why);
    assert.equal(state.outcome, null, why);
    assert.equal(Boolean(state.pendingRescue), step === 49 || step === 109, why);
    const effects = step >= 33 && step <= 46
      ? [{ type: 'truce', owner: 'black', card: { id: 'black-hand-1-truce', cardId: 'truce' } }]
      : step >= 50 && step <= 51
        ? [{ type: 'challenge', owner: 'black', player: 'white', pieceId: 'white-pawn-a2' }]
        : step >= 95 && step <= 107
          ? [{ type: 'vendetta', owner: 'black', card: { id: 'black-deck-4-vendetta', cardId: 'vendetta' } }]
          : step >= 110 && step <= 112
            ? [{ type: 'dungeon', owner: 'white', player: 'black', pieceId: 'black-rook-a8' }] : [];
    assert.deepEqual(state.effects, effects, why);
    const ep = step <= 2 ? [{ target: 'e3', pawnId: 'white-pawn-e2' }]
      : step <= 4 ? [{ target: 'e6', pawnId: 'black-pawn-e7' }]
        : step >= 11 && step <= 12 ? [{ target: 'd6', pawnId: 'black-pawn-d7' }]
          : step >= 52 && step <= 53 ? [{ target: 'a3', pawnId: 'white-pawn-a2' }]
            : step >= 68 && step <= 69 ? [{ target: 'f3', pawnId: 'white-pawn-f2' }]
              : step >= 112 && step <= 113 ? [{ target: 'g6', pawnId: 'black-pawn-g7' }] : [];
    assert.deepEqual(state.enPassant, ep, why);
    if (step >= 27 && step <= 33) assert.deepEqual(state.underElfHill, [{
      pieceId: 'black-king-e8', player: 'black', returning: step >= 30,
      ...(step >= 31 ? { returned: true } : {}),
    }], why);
    else assert.deepEqual(state.underElfHill ?? [], [], why);
    const isTurnMove = action.type === 'move' || action.type === 'playCard' && before.turn.phase === 'beforeMove';
    const oldFen = before.fen.split(' '), newFen = state.fen.split(' ');
    assert.equal(Number(newFen[4]), isTurnMove ? pawnMove || captured ? 0 : Number(oldFen[4]) + 1 : Number(oldFen[4]), why);
    assert.equal(Number(newFen[5]), Number(oldFen[5]) + (isTurnMove && before.turn.color === 'black' ? 1 : 0), why);
    assert.equal(newFen[2], step < 27 ? 'KQkq' : step < 56 ? 'KQ' : step < 72 ? 'Q' : '-', why);
  }
  assert.equal(trace.steps.filter(step => step.action.type === 'playCard').length, 14);
  assert.equal(state.fen, 'r1b5/p1kn3r/7p/4P1p1/P4P2/R4QRP/nP1P4/5K2 w - - 2 31');
  assert.deepEqual(state, replayTrace(trace));
});
