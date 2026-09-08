import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSquare, parseSquare } from 'chessops/util';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, SquareName } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Independently reviewed in order from rules §§8–13, 18.6, 19.3 and the five
// printed catalog entries. Every endTurn retains pieces, cards, effects and clocks.
const rationales = [
  '1 f2-f3: White Pawn advances one into vacancy.',
  '2 White completes f3; Black receives an unused move and card allowance.',
  '3 f7-f6: Black Pawn advances one into vacancy.',
  '4 Black completes f6; White receives the next turn.',
  '5 b2-b4: b3 and b4 empty; create b3 en-passant opportunity.',
  '6 White completes b4; preserve the opportunity for Black.',
  '7 g8-h6: Knight L-jump to empty h6; b3 opportunity expires.',
  '8 Charge: same Knight makes h6-g4 after noncapturing g8-h6; spend/draw once, clocks unchanged.',
  '9 Black completes Charge; White gets fresh allowance.',
  '10 a2-a3: one empty forward Pawn square.',
  '11 White completes a3.',
  '12 e8-f7: King steps diagonally into safe vacancy; revoke both Black rights.',
  '13 Black completes Kf7.',
  '14 e2-e4: e3/e4 empty; create e3 opportunity.',
  '15 White completes e4; preserve opportunity.',
  '16 h8-g8: Rook crosses one empty file; old opportunity expires.',
  '17 Black completes Rg8.',
  '18 a1-a2: Rook enters vacated Pawn square; revoke White queenside right.',
  '19 White completes Ra2.',
  '20 g7-g5: g6/g5 empty; create g6 opportunity.',
  '21 Black completes g5; preserve opportunity.',
  '22 f3-f4: Pawn advances one; old opportunity expires.',
  '23 White completes f4.',
  '24 e7-e6: Black Pawn advances one empty square.',
  '25 Black completes e6.',
  '26 b1-c3: Knight L-jump to empty c3.',
  '27 White completes Nc3.',
  '28 g4-e3: Black Knight L-jump into empty e3.',
  '29 Black completes Ne3.',
  '30 f1-b5: Bishop diagonal through empty e2,d3,c4.',
  '31 White completes Bb5.',
  '32 b7-b6: Black Pawn advances one into vacancy.',
  '33 Black completes b6.',
  '34 b5-d3: Bishop diagonal through empty c4.',
  '35 White completes Bd3.',
  '36 f7-e7: King enters safe empty adjacent square.',
  '37 Black completes Ke7.',
  '38 d2xe3: Pawn captures physical black-knight-g8; capturedBy white.',
  '39 White completes dxe3; captured Knight remains off-board.',
  '40 g8-h8: Rook moves one file; lost rights do not return.',
  '41 Black completes Rh8.',
  '42 d3-f1: Bishop diagonal through empty e2.',
  '43 White completes Bf1.',
  '44 Madman: c7-a5 jumps diagonally over occupied b6 to empty a5; b6 remains, no capture or promotion; consumes Black move.',
  '45 Black completes Madman replacement; fresh White turn.',
  '46 d1-d4: Queen straight path through empty d2,d3.',
  '47 White completes Qd4.',
  '48 d7-d6: Pawn advances one empty square.',
  '49 Black completes d6.',
  '50 e1-e2: King enters safe vacancy; revoke remaining White castling right.',
  '51 White completes Ke2.',
  '52 e6-e5: Pawn advances one empty square.',
  '53 Black completes e5.',
  '54 e2-f2: King enters safe adjacent vacancy.',
  '55 White completes Kf2.',
  '56 e7-f7: Black King enters safe adjacent vacancy.',
  '57 Black completes Kf7.',
  '58 c3-d5: Knight L-jump into vacant d5.',
  '59 Doomsayer: White after-move allowance; retain physical card, draw Anathema and offer Black immediate naming.',
  '60 Black declines immediate naming; no loss and Doomsayer stays active.',
  '61 White names Knight and loses owned d5 Knight; White effect owner is captor, discard Doomsayer, reset halfmove only.',
  '62 White completes naming; next Black turn has fresh allowances.',
  '63 c8-b7: Bishop enters vacated diagonal square.',
  '64 Black completes Bb7.',
  '65 d4-d2: Queen straight path through empty d3.',
  '66 White completes Qd2.',
  '67 d8-e7: Queen enters empty diagonal square.',
  '68 Black completes Qe7.',
  '69 f1-a6: Bishop diagonal through empty e2,d3,c4,b5.',
  '70 White completes Ba6.',
  '71 e7-e8: Queen enters adjacent empty file square.',
  '72 Black completes Qe8.',
  '73 d2xd6: Queen path d3,d4,d5 empty; captures physical black-pawn-d7 for White.',
  '74 White completes Qxd6.',
  '75 h8-g8: Rook enters adjacent vacant square.',
  '76 Black completes Rg8.',
  '77 f4xg5: Pawn forward-diagonal captures physical black-pawn-g7 for White.',
  '78 White completes fxg5.',
  '79 f6-f5: Pawn enters empty forward square.',
  '80 Fatal Attraction: owned f8 Bishop becomes magnet after Black move; freeze e8 Queen/g8 Rook, exempt royal f7 King, retain card and draw Masquerade.',
  '81 Black completes magnet activation; effect remains.',
  '82 g2-g3: Pawn advances well outside magnet neighborhood.',
  '83 White completes g3; magnet remains.',
  '84 b7xa6: Bishop outside magnet neighborhood captures physical white-bishop-f1 for Black.',
  '85 Black completes Bxa6.',
  '86 c2-c4: c3,c4 empty and outside magnet; create c3 opportunity.',
  '87 White completes c4; preserve opportunity.',
  '88 a6-b7: Bishop enters empty diagonal square outside magnet; old opportunity expires.',
  '89 Black completes Bb7.',
  '90 b4xa5: Pawn captures physical black-pawn-c7 relocated by Madman; captor White.',
  '91 White completes bxa5.',
  '92 f8-h6: magnet itself may move; g7 empty; discard Fatal Attraction and release e8/g8 before safety check.',
  '93 Black completes Bh6 with magnet expired.',
  '94 a3-a4: Pawn enters empty forward square.',
  '95 Curse: White after-move allowance marks opposing b7 Bishop; retain card, draw Chaos; board/clocks unchanged.',
  '96 White completes Curse; physical black-bishop-c8 retains marker.',
  '97 e8-d8: unmarked Queen enters adjacent vacancy; Curse stays on Bishop.',
  '98 Black completes Qd8.',
  '99 a5-a6: physical white-pawn-b2 advances one, no promotion.',
  '100 White completes a6.',
  '101 f7-g7: King steps into safe adjacent empty square.',
  '102 Black completes Kg7.',
  '103 g1-h3: Knight L-jump to vacant h3.',
  '104 White completes Nh3.',
  '105 d8-c8: Queen enters adjacent empty square; original c8 Bishop identity still at b7.',
  '106 Black completes Qc8.',
  '107 d6-d8: Queen file path through empty d7; safe White King, no capture.',
  '108 White completes fiftieth regular move; Curse remains and Black has the next turn.',
];

test('iteration 107: every action has an independent physical and accounting oracle', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/107.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const other = (color: Color): Color => color === 'white' ? 'black' : 'white';
  for (const [index, { action }] of trace.steps.entries()) {
    const label = rationales[index]!;
    assert.ok(label.startsWith(`${index + 1} `));
    const input = structuredClone(state);
    const expected = structuredClone(state);
    const actor = state.turn.color;
    const setup = parseFen(state.fen).unwrap();
    const at = (square: string) => expected.pieces.find(p => p.zone === 'board' && p.square === square)!;
    const spend = (cardId: string, retained: boolean) => {
      const player = expected.players[actor];
      const card = player.hand.find(c => c.cardId === cardId)!;
      assert.ok(card, label);
      assert.equal(expected.turn.cardPlays[actor], 0, label);
      assert.equal(action.type === 'playCard' && action.cardInstanceId, card.id, label);
      player.hand = player.hand.filter(c => c.id !== card.id);
      player.hand.push(player.deck.shift()!);
      if (!retained) player.discard.push(card);
      expected.turn.cardPlays[actor]++;
      return card;
    };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/);
      assert.match(action.to, /^[a-h][1-8]$/);
      const from = parseSquare(action.from)!;
      const to = parseSquare(action.to)!;
      const mover = at(action.from);
      const victim = at(action.to);
      assert.equal(mover.owner, actor, label);
      assert.equal(state.turn.phase, 'beforeMove', label);
      assert.equal(state.turn.moveMade, false, label);
      assert.equal(action.promotion, undefined, label);
      for (const raw of state.effects) {
        const effect = raw as { type: string; pieceId?: string };
        if (effect.type === 'curse' && effect.pieceId === mover.id)
          assert.ok(Math.max(Math.abs(from % 8 - to % 8), Math.abs((from >> 3) - (to >> 3))) <= 2, label);
        if (effect.type === 'fatal-attraction' && effect.pieceId !== mover.id && !mover.royal) {
          const magnet = state.pieces.find(p => p.id === effect.pieceId)!;
          const square = parseSquare(magnet.square!)!;
          assert.ok(Math.max(Math.abs(from % 8 - square % 8), Math.abs((from >> 3) - (square >> 3))) > 1, label);
        }
      }
      // All actual moves also meet ordinary chess safety, a stronger requirement
      // here: Curse/Fatal Attraction only suppress attacks in this trace.
      const chess = Chess.fromSetup(setup).unwrap();
      assert.ok(chess.isLegal({ from, to }), label);
      chess.play({ from, to });
      expected.fen = makeFen(chess.toSetup());
      mover.square = action.to as SquareName;
      if (victim) {
        assert.equal(victim.owner, other(actor), label);
        assert.equal(victim.royal, false, label);
        victim.square = null;
        victim.zone = 'captured';
        victim.capturedBy = actor;
      }
      expected.enPassant = mover.role === 'pawn' && Math.abs(to - from) === 16
        ? [{ target: makeSquare((from + to) / 2), pawnId: mover.id }] : [];
      expected.turn.phase = 'afterMove';
      expected.turn.moveMade = true;
      if (index + 1 === 92) {
        expected.effects = [];
        expected.players.black.discard.push({ id: 'black-hand-1-fatal-attraction', cardId: 'fatal-attraction' });
      }
    } else if (action.type === 'endTurn') {
      assert.equal(state.turn.moveMade, true, label);
      expected.turn = { color: other(actor), phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
    } else if (action.type === 'playCard') {
      if (action.cardId === 'charge' || action.cardId === 'madman') {
        const charge = action.cardId === 'charge';
        assert.deepEqual(action.target, charge ? [{ from: 'h6', to: 'g4' }] : [{ from: 'c7', to: 'a5' }], label);
        assert.equal(state.turn.phase, charge ? 'afterMove' : 'beforeMove', label);
        const from = charge ? 'h6' : 'c7';
        const to = charge ? 'g4' : 'a5';
        const mover = at(from);
        assert.equal(mover.id, charge ? 'black-knight-g8' : 'black-pawn-c7', label);
        assert.equal(at(to), undefined, label);
        if (charge) {
          assert.deepEqual(trace.steps[index - 1]!.action, { type: 'move', from: 'g8', to: 'h6' }, label);
          const previous = parseFen(state.fen).unwrap();
          previous.turn = actor;
          assert.ok(Chess.fromSetup(previous).unwrap().isLegal({ from: parseSquare(from)!, to: parseSquare(to)! }), label);
        } else assert.equal(at('b6').id, 'black-pawn-b7', label);
        mover.square = to;
        const piece = setup.board.take(parseSquare(from)!)!;
        setup.board.set(parseSquare(to)!, piece);
        if (!charge) {
          setup.turn = 'white'; setup.halfmoves = 0; setup.fullmoves++;
          expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
        }
        setup.epSquare = undefined;
        expected.enPassant = [];
        expected.fen = makeFen(setup);
        spend(action.cardId, false);
        assert.equal(Chess.fromSetup(setup).unwrap().isCheckmate(), false, label);
      } else {
        assert.equal(state.turn.phase, 'afterMove', label);
        const card = spend(action.cardId, true);
        if (action.cardId === 'doomsayer') {
          assert.equal(actor, 'white', label);
          expected.effects.push({ type: 'doomsayer', owner: actor, card });
          expected.pendingDoomsayer = { player: 'black', cardInstanceId: card.id };
        } else {
          assert.ok(action.cardId === 'fatal-attraction' || action.cardId === 'curse', label);
          const magnet = action.cardId === 'fatal-attraction';
          assert.equal(action.target, magnet ? 'f8' : 'b7', label);
          const piece = at(magnet ? 'f8' : 'b7');
          assert.equal(piece.owner, magnet ? actor : other(actor), label);
          assert.equal(piece.role, 'bishop', label);
          expected.effects.push({ type: action.cardId, owner: actor, card, pieceId: piece.id });
        }
      }
    } else if (action.type === 'declineDoomsayer') {
      assert.deepEqual(state.pendingDoomsayer, { player: 'black', cardInstanceId: 'white-hand-1-doomsayer' }, label);
      assert.equal(action.player, 'black', label);
      expected.pendingDoomsayer = null;
    } else {
      assert.equal(action.type, 'namePiece', label);
      assert.deepEqual(action, { type: 'namePiece', speaker: 'white', name: 'knight', losses: [{ effectId: 'white-hand-1-doomsayer', pieceId: 'white-knight-b1' }] }, label);
      const knight = at('d5');
      assert.equal(knight.id, 'white-knight-b1', label);
      assert.equal(knight.role, 'knight', label);
      knight.zone = 'captured'; knight.square = null; knight.capturedBy = 'white';
      setup.board.take(parseSquare('d5')!); setup.halfmoves = 0;
      expected.fen = makeFen(setup);
      expected.effects = [];
      expected.players.white.discard.push({ id: 'white-hand-1-doomsayer', cardId: 'doomsayer' });
    }
    // Build the complete expected physical state before calling the engine.
    const result = applyAction(state, action);
    assert.deepEqual(state, input, `${label}: entire input immutable, including capturedBy`);
    assert.ok(result.ok, label);
    assert.deepEqual(result.state.pieces, expected.pieces, `${label}: all physical identities and lifecycles`);
    assert.equal(result.state.fen, expected.fen, `${label}: board, rights, active color and clocks`);
    assert.deepEqual(result.state.enPassant, expected.enPassant, label);
    assert.deepEqual(result.state.players, expected.players, `${label}: physical card accounting`);
    assert.deepEqual(result.state.effects, expected.effects, label);
    assert.deepEqual(result.state.turn, expected.turn, label);
    assert.deepEqual(result.state.pendingDoomsayer, expected.pendingDoomsayer, label);
    assert.equal(result.state.orientation, 0, label);
    assert.equal(result.state.pendingRescue ?? null, null, label);
    assert.equal(result.state.pendingAbduction ?? null, null, label);
    assert.equal(result.state.underElfHill?.length ?? 0, 0, label);
    assert.equal(result.state.outcome, null, label);
    const safety = parseFen(result.state.fen).unwrap();
    safety.turn = actor;
    assert.equal(Chess.fromSetup(safety).unwrap().isCheck(), false, `${label}: ordinary royal safety also proves restricted safety`);
    state = result.state;
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 5);
  assert.equal(state.fen, trace.finalFen);
  assert.equal(replayTrace(trace).fen, state.fen);
});
