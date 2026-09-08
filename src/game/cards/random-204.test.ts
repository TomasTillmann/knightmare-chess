import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Board } from 'chessops/board';
import { makeBoardFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, GameAction, PieceState, Color, SquareName, GameEvent } from '../types.js';
import { CARD_CATALOG } from './catalog.js';
import { type RandomTrace } from './random-campaign.js';

// Each numbered row was reviewed against rules §§8–15,17.1,18.1,20–21 and cards.md.
const rationale = [
  '1 Blessing: c2-a4 has empty b3 and a4, bishop geometry, no capture; replace White move.',
  '2 Close White replacement move and reset both card allowances.',
  '3 Lost Castle exchanges owned a8 and opposing a1 Rooks; no capture; Black replacement move.',
  '4 Close Black replacement and retain only kingside castling availability.',
  '5 Nb1-a3 is an empty knight jump.', '6 End White turn.',
  '7 h7-h5 has clear h6,h5; create h6 opportunity, no White Pawn can use it.', '8 End Black turn, retain h6 opportunity.',
  '9 Ng1-h3 is an empty knight jump and expires h6.', '10 End White turn.',
  '11 e7-e6 advances one empty square.', '12 End Black turn.',
  '13 Nh3-f4 is an empty knight jump.',
  '14 Vendetta after White move retains physical card; both players must capture while able.',
  '15 End White turn; Black has Ra1xa2.',
  '16 Ra1xa2 captures White original a-Pawn, satisfying Vendetta.',
  '17 Heresy moves both White Bishops sideways c1-b1,f1-g1 first; Black Bishops have no vacant orthogonal neighbor.',
  '18 End Black turn; White has Ra8xa7.',
  '19 Ra8xa7 takes Black original a-Pawn.', '20 End White turn.',
  '21 Ra2xb2 takes White original b-Pawn.', '22 End Black turn.',
  '23 Ra7xb7 takes Black original b-Pawn.',
  '24 White Man-Trap secretly binds occupied friendly a4; it does not capture its current occupant.',
  '25 End White turn; Black can capture.',
  '26 Rb2xd2 passes vacant c2, captures White d-Pawn.',
  '27 Think Again restores d-Pawn and Rb2, reverses clocks/history, forbids the exact canceled capture; White pays reaction.',
  '28 Bc8xb7 captures White Rook as a different legal capture.', '29 End Black turn and clear temporary restriction.',
  '30 Nf4xe6 captures Black original e-Pawn.', '31 End White turn.',
  '32 Rb2xb1 captures original c1 White Bishop.',
  '33 Black Forbidden City chooses empty b5, retaining its physical card.', '34 End Black turn.',
  '35 Ne6xg7 captures Black g-Pawn and checks Ke8 by a knight jump.', '36 End White turn; Black must answer the Knight check.',
  '37 Bf8xg7 captures White original g1 Knight.', '38 End Black turn.',
  '39 Qd1xb1 passes empty c1 and captures invading Rook.',
  '40 Knightmare restores Qd1 and Black Rb1; forbid that physical capture and spend Black reaction.',
  '41 Na3xb1 captures the Rook by a different move and satisfies Vendetta.', '42 End White turn.',
  '43 Bb7xg2 passes c6,d5,e4,f3, taking White g-Pawn.',
  '44 White has no legal capture: all Knight, Bishop, Queen and Pawn captures are blocked or empty; discard Vendetta.',
  '45 d2-d3 is an empty Pawn advance.', '46 End White turn.',
  '47 d7-d6 is an empty Pawn advance.', '48 End Black turn.',
  '49 Qd1-c1 is an empty one-square horizontal move.', '50 End White turn.',
  '51 Resurrection returns the captured Black e-Pawn to vacant starting-rank b7, clears capturedBy, replaces Black move.',
  '52 End Black turn.',
  '53 e2-e4 passes empty e3; e3 opportunity has no Black Pawn on d4/f4.', '54 End White turn and retain e3 opportunity.',
  '55 Bg7-a1 passes f6,e5,d4,c3,b2, all vacant; expires e3.', '56 End Black turn.',
  '57 Original c-Pawn leaves its own a4 trap for a5, without triggering it.', '58 End White turn.',
  '59 d6-d5 advances one empty square.', '60 End Black turn.',
  '61 Qc1-c3 passes vacant c2.', '62 End White turn.',
  '63 Madman d5-f3 jumps diagonally over White e4 Pawn, retaining that Pawn and replacing Black move.',
  '64 End Black turn.', '65 Nb1-a3 is an empty knight jump.', '66 End White turn.',
  '67 f7-f5 passes vacant f6; no White Pawn on e5/g5 can capture en passant.', '68 End Black turn.',
  '69 Qc3-d4 is an empty diagonal step, expires f6.', '70 End White turn.',
  '71 Ba1-b2 is an empty diagonal step.',
  '72 Anathema swaps opponent Bg1 and Rh1 without moving them; preserve h1 castling token, serialized H while Rook is elsewhere.',
  '73 End Black turn.', '74 Na3-b1 is an empty knight jump.', '75 End White turn.',
  '76 c7-c6 is an empty Pawn advance.', '77 End Black turn.',
  '78 Qd4-c4 is an empty horizontal step.', '79 End White turn.',
  '80 Ng8-h6 is an empty knight jump.', '81 End Black turn.',
  '82 Sanctuary: Ke1 and Rg1 have vacant f1 between them; King lands g1, Rook f1, White rights lost.',
  '83 End White turn.', '84 Nh6-g4 is an empty knight jump.', '85 End Black turn.',
  '86 Kg1xg2 captures Bishop but is checked by f3 Pawn; held Rebirth f3-f7 is a concrete legal cure.',
  '87 Cathedral f1/h1 does not remove f3 Pawn check; spend card, restore provisional King capture and all prior clocks/history.',
  '88 Qc4-c1 passes vacant c3,c2; replaces rolled-back move and inert King token.', '89 End White turn.',
  '90 Ng4-e3 is an empty knight jump.', '91 End Black turn.',
  '92 Nb1-d2 is a noncapturing knight jump enabling Charge.',
  '93 Charge moves the same Knight d2-b3, no capture; preserve clocks and completed move.',
  '94 End White turn.', '95 Ke8-f8 is an empty safe King step, revoke Black castling.', '96 End Black turn.',
  '97 Qc1-b1 is an empty horizontal step.', '98 End White turn.',
  '99 h5-h4 advances one empty square.',
  '100 Black Man-Trap binds friendly occupied d8; current Queen remains unharmed.', '101 End Black turn.',
  '102 Nb3-c1 is an empty knight jump.', '103 End White turn.',
  '104 Kf8-f7 is an empty safe King step.', '105 End Black turn.',
  '106 a5-a6 is an empty Pawn advance.', '107 End White turn.',
  '108 Qd8-g8 passes vacant e8,f8; leaving its own trap does not trigger it.', '109 End Black turn.',
  '110 h2-h3 advances one empty square.',
  '111 Neutrality binds enemy f3 Pawn; original Black owner/direction retained, neither royal checked by its e2/g2 captures.',
  '112 End White turn.',
  '113 Bg2xf1 takes White Rook and opens Qg8-g1 check; Black King remains safe.',
  '114 White receives its check-escape turn.',
  '115 Nc1-e2 leaves g-file check pending; held Rebirth g8-d8 relocates checking Queen and cures it.',
  '116 Rebirth f1-c8 moves the wrong attacker; g-file check persists, so card fizzles and Nc1-e2 is rolled back.',
  '117 Bh1-g2 blocks the checking g-file and replaces inert Knight token.', '118 End White turn with both Kings safe.',
];
const cardInstances: Record<number,string> = {
  1:'white-hand-1-blessing',3:'black-hand-4-lost-castle',14:'white-hand-0-vendetta',17:'black-hand-1-heresy',
  24:'white-hand-2-man-trap',27:'white-deck-2-think-again',33:'black-deck-1-forbidden-city',40:'black-deck-2-knightmare',
  51:'black-hand-3-resurrection',63:'black-deck-4-madman',72:'black-deck-5-anathema',82:'white-deck-3-sanctuary',
  87:'white-deck-0-cathedral',93:'white-deck-5-charge',100:'black-deck-0-man-trap',111:'white-hand-3-neutrality',116:'white-deck-4-rebirth',
};

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const at = (s: GameState, square: string) => s.pieces.find(p => p.zone === 'board' && p.square === square);
function board(s: GameState): string {
  const b = Board.empty();
  for (const p of s.pieces) if (p.square) b.set(parseSquare(p.square)!, { color: p.owner, role: p.role });
  return makeBoardFen(b);
}
function reaches(s: GameState, p: PieceState, to: string, capture: boolean): boolean {
  assert.ok(p.square);
  const x = p.square.charCodeAt(0), y = +p.square[1]!, dx = to.charCodeAt(0) - x, dy = +to[1]! - y;
  if (!dx && !dy || s.effects.some(e => (e as {type:string;square?:string}).type === 'forbidden-city' && (e as {square:string}).square === to)) return false;
  if (p.role === 'knight') return Math.abs(dx * dy) === 2;
  if (p.role === 'king') return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (p.role === 'pawn') {
    const forward = p.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === forward;
    if (dx || !(dy === forward || dy === 2 * forward && (p.owner === 'white' ? y <= 2 : y >= 7))) return false;
  } else if (!(p.role === 'bishop' && Math.abs(dx) === Math.abs(dy)
    || p.role === 'rook' && (!dx || !dy)
    || p.role === 'queen' && (!dx || !dy || Math.abs(dx) === Math.abs(dy)))) return false;
  for (let j = 1; j < Math.max(Math.abs(dx), Math.abs(dy)); j++) {
    const sq = String.fromCharCode(x + Math.sign(dx) * j) + (y + Math.sign(dy) * j);
    if (at(s, sq) || s.effects.some(e => (e as {type:string;square?:string}).type === 'forbidden-city' && (e as {square:string}).square === sq)) return false;
  }
  return true;
}
function checked(s: GameState, color: Color): boolean {
  const king = s.pieces.find(p => p.royal && p.owner === color)!;
  return s.pieces.some(p => p.square && p.id !== king.id && (p.owner !== color || p.neutral)
    && reaches(s, p, king.square!, true) && (!p.neutral || (() => {
      // Neutral attacks are legal only if the opposing controller's royal stays safe (§15.1).
      const q = structuredClone(s), moved = q.pieces.find(a => a.id === p.id)!;
      q.pieces = q.pieces.filter(a => a.id !== king.id); moved.square = king.square;
      const other = q.pieces.find(a => a.royal && a.owner !== color)!;
      return !q.pieces.some(a => a.square && a.owner === color && !a.neutral && reaches(q, a, other.square!, true));
    })()));
}
function movePiece(s: GameState, from: string, to: string, actor: Color, geometry = true): {id:string; capture?:string; pawn:boolean} {
  const p = at(s, from); assert.ok(p, from); const victim = at(s, to);
  if (geometry) { assert.ok(p.owner === actor || p.neutral); assert.ok(reaches(s, p, to, !!victim), `${p.id} ${from}-${to}`); }
  if (victim) { assert.ok(!victim.royal); assert.ok(victim.owner !== actor || victim.neutral); victim.square = null; victim.zone = 'captured'; victim.capturedBy = actor; }
  p.square = to as SquareName;
  return { id:p.id, capture:victim?.id, pawn:p.originalRole === 'pawn' && !p.promoted };
}
const immutable = (s: GameState, a: GameAction) => {
  const input = structuredClone(s), command = structuredClone(a), result = applyAction(s, a);
  assert.deepEqual(s, input, 'input state immutable'); assert.deepEqual(a, command, 'action payload immutable');
  assert.ok(result.ok, JSON.stringify(a)); return result.state;
};
const nullable = (x: unknown) => x ?? null;
function compare(actual: GameState, expected: GameState, row: number) {
  for (const key of ['fen','pieces','players','turn','effects','history','orientation','enPassant','outcome','shieldMove','chaosForbidden','cardResponse'] as const)
    assert.deepEqual(nullable(actual[key]), nullable(expected[key]), `row ${row}: ${key}`);
  assert.deepEqual(actual.playedCards ?? [], expected.playedCards ?? [], `row ${row}: physical played cards`);
  for (const key of ['plotsExecution','plotsAllowances','fogLocked','riposteLostMoves','riposteSkipped','riposteCheckDeferred','pendingAbduction','pendingDoomsayer','underElfHill'] as const)
    assert.deepEqual(Array.isArray(actual[key]) && actual[key].length === 0 ? null : actual[key] ?? null, null, `row ${row}: ${key}`);
  const queryInput=structuredClone(actual);
  for (const color of ['white','black'] as const) assert.equal(isKingInCheck(actual,color), checked(expected,color), `row ${row}: ${color} royal`);
  assert.deepEqual(actual,queryInput,`row ${row}: royal queries immutable`);
}

test('random campaign iteration 204', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/204.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed,860204);
  assert.equal(rationale.length, 118); assert.equal(trace.steps.length, 118);
  let actual = createGameState(trace.initial), expected = structuredClone(actual);
  const beforeMove = new Map<number, GameState>();
  let moves = 0, cards = 0;
  for (const [index, step] of trace.steps.entries()) {
    const n = index + 1, a = step.action, prior = structuredClone(expected), actor = expected.turn.color;
    assert.ok(rationale[index]!.startsWith(`${n} `));
    let fields = prior.fen.split(' '), event: GameEvent | undefined;
    if (a.type === 'move') {
      assert.ok(typeof a.from === 'string' && typeof a.to === 'string');
      const from = a.from, to = a.to;
      beforeMove.set(n, structuredClone(expected)); moves++;
      assert.equal(expected.turn.moveMade, false);
      const moved = movePiece(expected, from, to, actor);
      if (n >= 16 && n <= 43) assert.ok(moved.capture, 'Vendetta requires this capture');
      expected.enPassant = moved.pawn && Math.abs(+from[1]! - +to[1]!) === 2
        ? [{target:(from[0]! + ((+from[1]! + +to[1]!) / 2)) as SquareName,pawnId:moved.id}] : [];
      fields[1] = opposite(actor)[0]!; fields[3] = '-'; fields[4] = moved.capture || moved.pawn ? '0' : String(+fields[4]!+1);
      if (actor === 'black') fields[5] = String(+fields[5]!+1);
      if (moved.id === 'black-king-e8') fields[2] = '-';
      expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
      expected.shieldMove = {player:actor,pieceIds:[moved.id],capturedOpponent:!!moved.capture}; delete expected.chaosForbidden;
      event = {type:'move',from:from as SquareName,to:to as SquareName,...(moved.capture ? {capturedId:moved.capture} : {})};
      if (n === 88 || n === 92) Object.assign(event,{movedPieceId:moved.id,movedRoles:[at(expected,to)!.role]});
    } else if (a.type === 'endTurn') {
      assert.equal(expected.turn.moveMade,true); assert.equal(checked(expected,actor),false);
      expected.turn = {color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      delete expected.shieldMove; delete expected.chaosForbidden; delete expected.cardResponse;
      if (n === 44) {
        for (const p of expected.pieces.filter(p => p.square && p.owner === 'white'))
          for (const victim of expected.pieces.filter(p => p.square && p.owner === 'black')) {
            if (!reaches(expected,p,victim.square!,true)) continue;
            const trial = structuredClone(expected); movePiece(trial,p.square!,victim.square!,'white');
            assert.equal(checked(trial,'white'),true,'Vendetta expires only without legal capture');
          }
        expected.effects = expected.effects.filter(e => (e as {type:string}).type !== 'vendetta');
        expected.players.white.discard.push({id:'white-hand-0-vendetta',cardId:'vendetta'});
      }
    } else {
      assert.equal(a.type,'playCard'); if (a.type !== 'playCard') throw new Error('unreviewed action'); cards++;
      assert.equal(a.cardInstanceId,cardInstances[n],`row ${n}: exact declared physical card`);
      if ([14,27,40].includes(n)) assert.equal(a.target,undefined);
      const owner:Color = String(a.cardInstanceId).startsWith('white-') ? 'white' : 'black';
      const player = expected.players[owner], physical = player.hand.find(c => c.id === a.cardInstanceId);
      assert.ok(physical); assert.equal(physical.cardId,a.cardId); assert.equal(expected.turn.cardPlays[owner],0);
      const catalog = CARD_CATALOG[a.cardId]!;
      assert.ok(catalog.timing.includes(owner === actor ? expected.turn.phase : 'afterOpponentMove'));
      player.hand.splice(player.hand.indexOf(physical),1); player.hand.push(player.deck.shift()!);
      expected.turn.cardPlays[owner]++;
      expected.playedCards = [...expected.playedCards ?? [],{player:owner,cardInstanceId:physical.id}];
      const fizzled = n === 87 || n === 116;
      if (fizzled) {
        const proposed=structuredClone(prior);
        if (n===87) {
          assert.deepEqual(a.target,{rook:'f1',bishop:'h1'});
          const rook=at(proposed,'f1')!,bishop=at(proposed,'h1')!;
          assert.equal(rook.id,'white-rook-h1'); assert.equal(bishop.id,'white-bishop-f1');
          rook.square='h1'; bishop.square='f1';
          assert.equal(at(proposed,'f3')!.id,'black-pawn-d7');
          assert.ok(reaches(proposed,at(proposed,'f3')!,'g2',true));
        } else {
          assert.deepEqual(a.target,[{from:'f1',to:'c8'}]);
          assert.equal(at(proposed,'f1')!.id,'black-bishop-c8'); assert.equal(at(proposed,'c8'),undefined);
          movePiece(proposed,'f1','c8','white',false);
          assert.ok(reaches(proposed,at(proposed,'g8')!,'g1',true));
        }
        assert.equal(checked(proposed,'white'),true,'proposed effect fails to cure the actual check');
        assert.equal(checked(proposed,'black'),false);
      }
      if (!catalog.continuing || fizzled) player.discard.push(physical);
      event = {type:'cardPlayed',cardId:a.cardId,...(a.target === undefined ? {} : {target:structuredClone(a.target) as GameEvent['target']})};
      if (a.cardId === 'man-trap') { assert.equal(a.target,n===24?'a4':'d8'); assert.equal(at(expected,String(a.target))!.owner,owner); delete event.target; }
      if (n===33) { assert.equal(a.target,'b5'); assert.equal(at(expected,'b5'),undefined); }
      if (n===111) assert.equal(a.target,'f3');
      let movement: Array<{from:SquareName;to:SquareName}> = [];
      if (n === 1) { assert.deepEqual(a.target,[{from:'c2',to:'a4'}]); assert.equal(at(expected,'b3'),undefined); movePiece(expected,'c2','a4',owner,false); movement = [{from:'c2',to:'a4'}]; }
      if (n === 3) { assert.deepEqual(a.target,{own:'a8',opponent:'a1'}); at(expected,'a1')!.square='a8'; expected.pieces.find(p=>p.id==='black-rook-a8')!.square='a1'; movement=[{from:'a1',to:'a8'},{from:'a8',to:'a1'}]; fields[2]='Kk'; }
      if (n === 17) {
        assert.deepEqual(a.target,[{from:'c1',to:'b1'},{from:'f1',to:'g1'}]);
        movePiece(expected,'c1','b1','white',false); movePiece(expected,'f1','g1','white',false);
        for (const square of ['b8','d8','c7','e8','g8','f7']) assert.ok(at(expected,square),'Black Bishops cannot move to an empty adjacent opposite-color square');
        movement=[{from:'c1',to:'b1'},{from:'f1',to:'g1'}];
      }
      if ([14,24,33,100,111].includes(n)) {
        const extra = a.cardId === 'man-trap' || a.cardId === 'forbidden-city' ? {square:a.target}
          : n === 111 ? {pieceId:'black-pawn-d7'} : {};
        expected.effects.push({type:a.cardId,owner,card:physical,...extra});
        if (n === 111) Object.assign(at(expected,'f3')!,{neutral:true,neutralBeforeEffects:false});
      }
      if (n === 51) { assert.deepEqual(a.target,{pieceId:'black-pawn-e7',to:'b7'}); const p=expected.pieces.find(p=>p.id==='black-pawn-e7')!; assert.equal(p.zone,'captured'); assert.equal(at(expected,'b7'),undefined); p.zone='board'; p.square='b7'; delete p.capturedBy; }
      if (n === 63) { assert.deepEqual(a.target,[{from:'d5',to:'f3'}]); assert.equal(at(expected,'e4')!.id,'white-pawn-e2'); movePiece(expected,'d5','f3',owner,false); movement=[{from:'d5',to:'f3'}]; }
      if (n === 72) { assert.deepEqual(a.target,{bishop:'g1',rook:'h1'}); at(expected,'g1')!.square='h1'; expected.pieces.find(p=>p.id==='white-rook-h1')!.square='g1'; movement=[{from:'g1',to:'h1'},{from:'h1',to:'g1'}]; fields[2]='Hk'; }
      if (n === 82) { assert.deepEqual(a.target,{king:'e1',rook:'g1'}); assert.equal(at(expected,'f1'),undefined); at(expected,'g1')!.square='f1'; at(expected,'e1')!.square='g1'; movement=[{from:'e1',to:'g1'},{from:'g1',to:'f1'}]; fields[2]='k'; }
      if (n === 93) { assert.deepEqual(a.target,[{from:'d2',to:'b3'}]); assert.equal(prior.history.at(-1)!.capturedId,undefined); movePiece(expected,'d2','b3',owner); movement=[{from:'d2',to:'b3'}]; Object.assign(event,{from:'d2',to:'b3',movedPieceId:'white-knight-b1',movedRoles:['knight']}); expected.shieldMove={player:owner,pieceIds:['white-knight-b1'],capturedOpponent:false}; }
      if ([1,3,51,63,82].includes(n)) {
        assert.equal(prior.turn.phase,'beforeMove'); expected.turn.moveMade=true; expected.turn.phase='afterMove'; expected.enPassant=[];
        fields[1]=opposite(owner)[0]!; fields[3]='-'; fields[4]=[1,51,63].includes(n)?'0':String(+fields[4]!+1); if(owner==='black') fields[5]=String(+fields[5]!+1);
        expected.shieldMove={player:owner,capturedOpponent:false,pieceIds:n===3||n===51?[]:n===82?['white-king-e1','white-rook-h1']:n===1?['white-pawn-c2']:['black-pawn-d7']};
      }
      if (n === 27 || n === 40 || fizzled) {
        const restore = beforeMove.get(n-1)!; assert.ok(restore);
        expected.pieces=structuredClone(restore.pieces); expected.enPassant=structuredClone(restore.enPassant); expected.history=structuredClone(restore.history); fields=restore.fen.split(' ');
        expected.turn.phase='beforeMove'; expected.turn.moveMade=false;
        if (!fizzled) {
          delete expected.shieldMove;
          expected.chaosForbidden={player:actor,movement:n===27?'black-rook-a8:b2:d2|white-pawn-d2:d2:captured':'black-rook-a8:b1:captured|white-queen-d1:d1:b1'};
          delete event.target; event.player=owner; movement=n===27?[{from:'d2',to:'b2'}]:[{from:'b1',to:'d1'}];
        } else event={type:'cardFizzled',cardId:a.cardId,reason:'SELF_CHECK'};
      }
      if (n !== 33) Object.assign(event,{movement,preservePreviousMove:[14,17,24,27,40,72,100,111].includes(n)});
    }
    if (event) expected.history.push(event);
    fields[0]=board(expected); expected.fen=fields.join(' ');
    if (a.type==='playCard') expected.cardResponse={player:String(a.cardInstanceId).startsWith('white-')?'white':'black',historyLength:expected.history.length};
    const input = structuredClone(actual); actual=immutable(actual,a);
    compare(actual,expected,n);
    assert.equal(checked(expected,'black'),[35,36].includes(n),`row ${n}: independently reviewed Black threat`);
    assert.equal(checked(expected,'white'),[86,113,114,115,116].includes(n),`row ${n}: independently reviewed White threat`);
    if (n===86 || n===115) {
      const pending=actual.pendingRescue; assert.ok(pending);
      assert.deepEqual(pending,{before:input,fen:prior.fen,pieces:prior.pieces,enPassant:prior.enPassant,historyLength:prior.history.length,movedPieceIds:[n===86?'white-king-e1':'white-knight-b1']});
      rescue(actual,expected,n);
    } else assert.equal(actual.pendingRescue??null,null,`row ${n}: no pending rescue`);
    if (n===27||n===40) { const retry=structuredClone(trace.steps[n-2]!.action), clone=structuredClone(actual), actionClone=structuredClone(retry); assert.equal(applyAction(actual,retry).ok,false); assert.deepEqual(actual,clone); assert.deepEqual(retry,actionClone); }
    if (n===87||n===116) { const probe=structuredClone(actual); probe.turn.cardPlays.white=0; const c=probe.players.white.hand.find(c=>c.cardId===(n===87?'rebirth':'challenge'))!; const action:GameAction={type:'playCard',cardId:c.cardId,cardInstanceId:c.id,target:c.cardId==='rebirth'?[{from:'f3',to:'f7'}]:'e3'}; const clone=structuredClone(probe), command=structuredClone(action); const result=applyAction(probe,action); assert.equal(result.ok,false,`row ${n}: inert shieldMove cannot grant after-move permission`); if (!result.ok) assert.equal(result.error.code,'INVALID_TIMING'); assert.deepEqual(probe,clone); assert.deepEqual(action,command); }
    // Each retained double-step opportunity is uncapturable in these fixtures.
    for (const ep of expected.enPassant) {
      const prospective=opposite(expected.pieces.find(p=>p.id===ep.pawnId)!.owner);
      const probe=structuredClone(actual); probe.turn={color:prospective,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const queryInput=structuredClone(probe), destinations=legalDests(probe); assert.deepEqual(probe,queryInput,'en-passant query immutable');
      for (const pawn of expected.pieces.filter(p=>p.square&&p.owner===prospective&&p.role==='pawn')) {
        assert.equal(reaches(expected,pawn,ep.target,true),false,'no adjacent prospective en-passant captor');
        assert.equal(destinations.get(pawn.square!)?.includes(ep.target)??false,false);
      }
    }
  }
  assert.equal(moves,50); assert.equal(cards,17); assert.equal(actual.fen,'1n4qr/1p3k2/P1p5/5p2/4P2p/3Pnp1P/1b3PB1/1QN2bK1 b - - 1 26');
});

function rescue(actual:GameState, reviewed:GameState, n:number) {
  const before=structuredClone(actual), expected=structuredClone(reviewed);
  const from=n===86?'f3':'g8',to=n===86?'f7':'d8';
  const card=expected.players.white.hand.find(c=>c.id==='white-deck-4-rebirth')!; assert.ok(card);
  assert.equal(at(expected,to),undefined); movePiece(expected,from,to,'white',false);
  const p=expected.players.white; p.hand.splice(p.hand.findIndex(c=>c.id===card.id),1); p.hand.push(p.deck.shift()!); p.discard.push(card);
  expected.turn.cardPlays.white=1; expected.playedCards=[...expected.playedCards??[],{player:'white',cardInstanceId:card.id}];
  expected.history.push({type:'cardPlayed',cardId:'rebirth',target:[{from:from as SquareName,to:to as SquareName}],movement:[{from:from as SquareName,to:to as SquareName}],preservePreviousMove:true});
  expected.cardResponse={player:'white',historyLength:expected.history.length};
  expected.fen=[board(expected),...expected.fen.split(' ').slice(1)].join(' ');
  const action:GameAction={type:'playCard',cardId:'rebirth',cardInstanceId:card.id,target:[{from,to}]};
  const cured=immutable(actual,action); compare(cured,expected,n); assert.equal(cured.pendingRescue??null,null); assert.equal(checked(expected,'white'),false); assert.equal(checked(expected,'black'),false);
  expected.turn={color:'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}}; delete expected.shieldMove; delete expected.cardResponse;
  compare(immutable(cured,{type:'endTurn'}),expected,n); assert.deepEqual(actual,before,'rescue branch never mutates trace checkpoint');
}
