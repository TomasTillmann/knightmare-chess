import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState } from '../types.js';
import { replayTrace, type RandomTrace } from './random-campaign.js';

// Read sequentially from the generated action rows, against rules §§8–14 and cards.md.
const rationales = [
  '1 h2-h3: White pawn advances one empty square; no capture or check.',
  '2 End White turn; h3 position and cards remain, Black acts next.',
  '3 h7-h6: Black pawn advances one empty square.',
  '4 End Black turn; White acts next with no pending obligation.',
  '5 a2-a3: White pawn advances to empty a3.',
  '6 End White turn without card spending.',
  '7 Masquerade: g8 Knight moves as Queen to empty h7; consumes Black move, discards and replaces card.',
  '8 End Black replacement move; clear allowances.',
  '9 d2-d3: White pawn advances into empty d3.',
  '10 End White turn, maintaining the board.',
  '11 c7-c6: Black pawn advances one square.',
  '12 End Black turn with no effects.',
  '13 b1-c3: White Knight jumps to empty c3.',
  '14 End White turn after Knight development.',
  '15 a7-a5: initial two-step crosses empty a6; record a6 en-passant opportunity.',
  '16 Figure Dance: four Rooks rotate a1-h1-h8-a8-a1 simultaneously; no captures, all castling rights lost, a6 right survives.',
  '17 End Black turn; Figure Dance preserves the prior pawn move and clocks.',
  '18 g2-g4: two-step crosses empty g3; old a6 right expires and g3 replaces it.',
  '19 End White turn; g3 opportunity remains for Black.',
  '20 Blessing: a5 pawn moves diagonally backward to empty b6, allowed Bishop geometry; no capture, consume move and expire g3.',
  '21 End Black replacement turn; Black King remains screened by f8 Bishop.',
  '22 c1-g5: Bishop crosses vacant d2,e3,f4; d1 Queen still blocks a1 Rook from White King.',
  '23 End White turn; no card played.',
  '24 g7-g6: pawn advances; h8 White Rook remains screened from e8 by f8 Bishop.',
  '25 Forbidden City: empty a5 gets permanent marker after Black move; retain card and refill hand.',
  '26 End Black turn; a5 barrier persists.',
  '27 c3-a2: Knight jumps to empty a2 without entering a5.',
  '28 End White turn; barrier unchanged.',
  '29 h7-f6: Knight jump to empty f6.',
  '30 Anathema: swap opposing Bishop f1 and Rook h1; no capture, same clocks and move allowance.',
  '31 End Black turn after the legal opposing-piece swap.',
  '32 d1-a1: Queen crosses c1,b1 and captures the Black Rook; White King stays safe.',
  '33 End White turn after capture; halfmove clock is zero.',
  '34 f6-d5: Knight jumps to empty d5.',
  '35 End Black turn with no effect changes.',
  '36 e1-d2: King steps to unattacked d2; d5 Knight does not attack it.',
  '37 End White turn; castling already unavailable.',
  '38 h6-g5: Black pawn captures White c1 Bishop diagonally forward.',
  '39 End Black capture turn; Bishop remains captured.',
  '40 e2-e3: pawn advances to empty e3.',
  '41 End White turn, preserving both Kings.',
  '42 d5-b4: Knight jumps to vacant b4.',
  '43 Crab: mark own e7 pawn after move; retain continuing card, identity and square unchanged.',
  '44 End Black turn; Crab and a5 marker persist.',
  '45 h3-h4: ordinary White pawn advances without capture.',
  '46 End White turn; no en-passant opportunity from a single step.',
  '47 b4-d3: Black Knight captures the d2 pawn at d3; d2 King is not attacked by that Knight.',
  '48 End Black capture turn; White King has no pending check.',
  '49 h1-d5: Bishop crosses empty g2,f3,e4 to vacant d5.',
  '50 End White turn; f8 continues blocking the h8 Rook.',
  '51 f7-f5: two-step crosses empty f6, creating f6 en-passant opportunity.',
  '52 End Black turn and retain f6 opportunity.',
  '53 d2-e2: King enters safe empty e2; d3 Knight does not attack it; expire f6.',
  '54 End White turn with King e2 safe.',
  '55 d3-e5: Knight jumps away from captured-pawn square.',
  '56 End Black turn; captured d2 pawn remains off-board.',
  '57 a2-b4: White Knight jumps to empty b4.',
  '58 End White turn; no card spending.',
  '59 d8-c7: Queen takes one empty diagonal step.',
  '60 End Black turn; Queen c7 has no line to e2 King.',
  '61 a1-e1: White Queen slides through b1,c1,d1 to empty e1.',
  '62 End White turn; two Rooks and the Queen keep their physical identities.',
  '63 e5-g4: Knight captures White g2 pawn at g4.',
  '64 End Black capture turn.',
  '65 Resurrection: return captured g2 pawn to empty d2, any legal starting pawn square; consumes move, card and draw.',
  '66 End White replacement turn; returned pawn is alive and unpromoted.',
  '67 c7-d8: Black Queen returns diagonally to empty d8.',
  '68 End Black turn; no check or marker changes.',
  '69 e2-d1: White King steps diagonally to empty safe d1.',
  '70 End White turn; d2 pawn screens the King.',
  '71 d8-c7: Black Queen moves to empty c7.',
  '72 End Black turn with White King still screened.',
  '73 b4-c6: White Knight captures c7 pawn; e8 Black King is not attacked.',
  '74 End White capture turn.',
  '75 g4-h6: Black Knight jumps to empty h6.',
  '76 Earthquake: clockwise orientation makes White forward west, Black east; lone White pawn on a-file at a3 promotes to Queen; retain card.',
  '77 End Black turn after orientation change; coordinates and barriers stay fixed.',
  '78 c6-b8: White Knight captures Black b8 Knight; rotation does not alter Knight geometry.',
  '79 End White capture turn; promoted a3 Queen remains White.',
  '80 c7-c5: Black Queen slides through empty c6 to c5.',
  '81 End Black turn; White King screened by c2 and d2 pawns.',
  '82 d1-c1: King enters safe empty c1, behind c2 pawn.',
  '83 Forbidden City: White marks empty a6 after moving; retain second independent fixed barrier.',
  '84 End White turn; a5 and a6 both forbidden.',
  '85 e7-f6: Crab takes one forward-east diagonal into empty f6 after rotation.',
  '86 End Black turn; Crab marker follows e7 identity to f6.',
  '87 c1-d1: King returns to safe d1.',
  '88 End White turn; a3 Queen and h8 Rook still do not check Black.',
  '89 Annexation: Black b6 pawn advances two east through empty c6 to d6; owner second rank qualifies for c6 en passant.',
  '90 End Black replacement turn; preserve c6 opportunity.',
  '91 d5-c6: Bishop enters empty c6, makes no en-passant capture, expires opportunity.',
  '92 End White turn; pawn d6 remains present.',
  '93 c5-c3: Queen slides through empty c4; d2 pawn blocks diagonal check on d1.',
  '94 End Black turn; Queen c3 is capturable by a3 Queen.',
  '95 c6-a4: Bishop crosses empty b5, avoiding a5/a6 barriers.',
  '96 End White turn; Bishop a4 ray toward e8 is blocked by d7 pawn.',
  '97 e8-d8: Black King enters empty safe d8; Bishop f8 still screens h8 Rook.',
  '98 End Black turn with King safe on d8.',
  '99 h4-g4: White pawn advances west under rotated orientation; no capture.',
  '100 End White turn; pawn keeps original h2 identity.',
  '101 f8-e7: Bishop vacates h8-g8-f8-e8-d8 Rook line, temporarily checking own King; §11.6 requires same-turn Crusade rescue.',
  '102 Crusade: noncapturing Bishop immediately returns e7-f8, blocks Rook line, clears rescue, spends card without another clock advance.',
  '103 End Black turn only after the successful rescue.',
  '104 a3-c3: promoted White pawn acts as Queen, crosses b3 and captures Black Queen.',
  '105 End White capture turn; original pawn identity remains promoted Queen.',
  '106 d8-c7: King enters c3 Queen file, temporary check requiring a saving card; cannot end turn here.',
  '107 Rebirth g1-h7 would not cure Queen c3 checking c7, so card fizzles and illegal underlying King move rolls back to d8; card spent, replacement move required.',
  '108 f6-g7: Crab moves east-forward diagonal to empty g7 on the replacement move, with Black King safe d8.',
  '109 End Black turn; spent Rebirth is not refunded.',
  '110 a4-d7: Bishop crosses b5,c6 and captures Black d7 pawn, leaving own King safe.',
  '111 End White turn; d7 Bishop does not attack d8 King.',
  '112 h6-g8: Black Knight jumps to empty g8; no capture.',
  '113 End Black turn; White Rook h8 can leave along clear h-file.',
  '114 h8-h3: White Rook slides through h7,h6,h5,h4, all vacant; no barrier or capture.',
  '115 End White turn; final Black turn ready, no pending rescue or outcome.',
];

test('iteration 033 sequential rules review', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/033.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed, 860033);
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.steps.length, 115);
  let state = createGameState(trace.initial);
  const states = [state];
  const forbidden: string[] = [];
  const effects: unknown[] = [];
  const xy = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
  const fields = (pieces: PieceState[]) => pieces.map(({ capturedAtPly: _, capturedBy: _actor, ...piece }) => piece);
  // Independent geometry oracle for precisely the movement modes in this trace.
  const geometrical = (piece: PieceState, to: string, position: GameState, capture: boolean): boolean => {
    assert.ok(piece.square);
    const [x, y] = xy(piece.square), [tx, ty] = xy(to);
    const dx = tx - x, dy = ty - y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (forbidden.includes(to)) return false;
    if (piece.role === 'knight') return ax * ay === 2;
    if (piece.role === 'king') return Math.max(ax, ay) === 1;
    if (piece.role === 'pawn') {
      const sign = piece.owner === 'white' ? 1 : -1;
      const forward = position.orientation === 0 ? dy * sign : -dx * sign;
      const sideways = position.orientation === 0 ? ax : ay;
      if (piece.id === 'black-pawn-e7' && effects.length >= 2 || capture) return forward === 1 && sideways === 1;
      if (sideways !== 0 || forward < 1 || forward > 2) return false;
      if (forward === 2) {
        const rank = position.orientation === 0 ? (piece.owner === 'white' ? y : 7 - y) : (piece.owner === 'white' ? 7 - x : x);
        if (rank > 1) return false;
      }
    } else if (!(piece.role === 'queen' && (dx === 0 || dy === 0 || ax === ay)
      || piece.role === 'rook' && (dx === 0 || dy === 0)
      || piece.role === 'bishop' && ax === ay)) return false;
    const distance = Math.max(ax, ay);
    if (!distance) return false;
    for (let n = 1; n < distance; n++) {
      const square = String.fromCharCode(97 + x + Math.sign(dx) * n) + (y + Math.sign(dy) * n + 1);
      if (forbidden.includes(square) || position.pieces.some(p => p.zone === 'board' && p.square === square)) return false;
    }
    return true;
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const step = index + 1, before = state, actor = before.turn.color;
    assert.ok(rationales[index]!.startsWith(`${step} `));
    const result = applyAction(before, action);
    assert.ok(result.ok, rationales[index]);
    state = result.state;
    let expectedPieces = before.pieces.map(p => ({ ...p }));
    let expectedEp = before.enPassant;
    let half = Number(before.fen.split(' ')[4]), full = Number(before.fen.split(' ')[5]);
    const at = (square: string) => expectedPieces.find(p => p.zone === 'board' && p.square === square)!;
    const relocate = (from: string, to: string) => { at(from).square = to as PieceState['square']; };
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const piece = at(action.from), victim = at(action.to);
      assert.ok(piece);
      assert.equal(piece.owner, actor);
      assert.ok(!victim || victim.owner !== actor && !victim.royal);
      assert.ok(geometrical(piece, action.to, before, !!victim), rationales[index]);
      half = piece.role === 'pawn' || victim ? 0 : half + 1;
      full += actor === 'black' ? 1 : 0;
      expectedEp = [];
      if (piece.role === 'pawn' && Math.abs(Number(action.from[1]) - Number(action.to[1])) === 2 && before.orientation === 0) {
        expectedEp = [{ target: (action.from[0]! + (Number(action.from[1]) + Number(action.to[1])) / 2) as 'a6', pawnId: piece.id }];
      }
      if (victim) { victim.square = null; victim.zone = 'captured'; }
      piece.square = action.to as PieceState['square'];
      assert.deepEqual(state.turn, { ...before.turn, phase: 'afterMove', moveMade: true });
      assert.deepEqual(state.players, before.players);
    } else if (action.type === 'endTurn') {
      assert.equal(before.turn.moveMade, true);
      assert.ok(!before.pendingRescue);
      assert.deepEqual(state.turn, { color: actor === 'white' ? 'black' : 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
      assert.equal(state.fen, before.fen);
      assert.deepEqual(state.players, before.players);
    } else {
      assert.equal(action.type, 'playCard');
      if (action.type !== 'playCard') continue;
      const played = before.players[actor].hand.find(c => c.id === action.cardInstanceId)!;
      assert.ok(played);
      assert.equal(before.turn.cardPlays[actor], 0);
      const continuing = ['forbidden-city', 'crab', 'earthquake'].includes(action.cardId);
      assert.deepEqual(state.players[actor].hand, [...before.players[actor].hand.filter(c => c.id !== played.id), before.players[actor].deck[0]]);
      assert.deepEqual(state.players[actor].deck, before.players[actor].deck.slice(1));
      assert.deepEqual(state.players[actor].discard, [...before.players[actor].discard, ...(continuing ? [] : [played])]);
      assert.deepEqual(state.players[actor === 'white' ? 'black' : 'white'], before.players[actor === 'white' ? 'black' : 'white']);
      const replacement = [7, 20, 65, 89].includes(step);
      assert.equal(before.turn.phase, replacement ? 'beforeMove' : 'afterMove');
      assert.deepEqual(state.turn, { color: actor, phase: step === 107 ? 'beforeMove' : 'afterMove', moveMade: step !== 107, cardPlays: { ...before.turn.cardPlays, [actor]: 1 } });
      switch (step) {
        case 7: relocate('g8', 'h7'); half++; full++; expectedEp = []; break;
        case 16: {
          const corners: Record<string, string> = { a1: 'h1', h1: 'h8', h8: 'a8', a8: 'a1' };
          expectedPieces.forEach(p => { if (p.square && corners[p.square]) p.square = corners[p.square] as PieceState['square']; });
          break;
        }
        case 20: relocate('a5', 'b6'); half = 0; full++; expectedEp = []; break;
        case 25: case 83: {
          const square = step === 25 ? 'a5' : 'a6';
          assert.equal(at(square), undefined);
          forbidden.push(square);
          effects.push({ type: 'forbidden-city', owner: actor, card: played, square });
          break;
        }
        case 30: { const bishop = at('f1'), rook = at('h1'); bishop.square = 'h1'; rook.square = 'f1'; break; }
        case 43: effects.push({ type: 'crab', owner: actor, card: played, pieceId: 'black-pawn-e7' }); break;
        case 65: {
          const pawn = expectedPieces.find(p => p.id === 'white-pawn-g2')!;
          assert.equal(pawn.zone, 'captured'); assert.equal(at('d2'), undefined);
          pawn.zone = 'board'; pawn.square = 'd2'; half = 0; expectedEp = []; break;
        }
        case 76:
          at('a3').role = 'queen'; at('a3').promoted = true;
          effects.push({ type: 'earthquake', owner: actor, card: played, direction: 'clockwise', target: { direction: 'clockwise', promotions: [{ square: 'a3', role: 'queen' }] } });
          break;
        case 89: relocate('b6', 'd6'); half = 0; full++; expectedEp = [{ target: 'c6', pawnId: 'black-pawn-a7' }]; break;
        case 102: assert.ok(before.pendingRescue); relocate('e7', 'f8'); break;
        case 107:
          assert.ok(before.pendingRescue);
          expectedPieces = states[105]!.pieces.map(p => ({ ...p }));
          half = 0; full = 25; expectedEp = [];
          assert.equal(at('g1').role, 'knight'); assert.equal(at('h7'), undefined);
          break;
        default: assert.fail(`Unreviewed card step ${step}`);
      }
    }
    assert.deepEqual(fields(state.pieces), fields(expectedPieces), rationales[index]);
    assert.deepEqual(state.effects, effects, rationales[index]);
    assert.deepEqual(state.enPassant, expectedEp, rationales[index]);
    assert.equal(state.orientation, step < 76 ? 0 : 270);
    assert.deepEqual(state.fen.split(' ').slice(4), [String(half), String(full)], rationales[index]);
    assert.equal(state.fen.split(' ')[2], step < 16 ? 'KQkq' : '-');
    assert.equal(Boolean(state.pendingRescue), step === 101 || step === 106, rationales[index]);
    const king = state.pieces.find(p => p.royal && p.owner === actor)!;
    const attacked = state.pieces.filter(p => p.zone === 'board' && p.owner !== actor)
      .some(p => geometrical(p, king.square!, state, true));
    assert.equal(attacked, step === 101 || step === 106, `King safety: ${rationales[index]}`);
    assert.ok(!state.outcome);
    assert.ok(!state.pendingAbduction && !state.pendingDoomsayer);
    states.push(state);
  }
  assert.equal(trace.steps.filter(s => s.action.type === 'move').length, 50);
  assert.equal(trace.steps.filter(s => s.action.type === 'playCard').length, 12);
  assert.equal(state.fen, 'rNbk1bn1/1p1B2p1/3p2p1/5pp1/6P1/2Q1P2R/1PPP1P2/3KQRN1 b - - 2 27');
  assert.deepEqual(replayTrace(trace), state);
});
