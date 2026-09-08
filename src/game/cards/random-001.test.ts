import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkState, digest, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

// Sequential semantic review: square geometry, unchanged pieces, King safety and
// card disposition were compared with rules.md and printed catalog metadata.
const reasons = [
  '1 f2-f3: white Pawn advances one onto empty f3; e1 remains shielded.',
  '2 White ends its completed turn; board unchanged, Black allowance resets.',
  '3 Under Elf Hill replaces Black move: e8 King goes away, not captured; castling rights removed, card spent and refilled.',
  '4 Black ends replacement move; absent King waits through White turn.',
  '5 h2-h4: both forward squares empty; White King remains safe, no promotion.',
  '6 White ends; beginning Black turn makes mandatory King return available.',
  '7 King returns a4: vacant edge, outside White attacks; cannot move this turn, regular move remains available.',
  '8 b7-b5: b6/b5 empty; returned King stays a4, no exposed attack.',
  '9 Black ends: returned King movement restriction expires, no board change.',
  '10 Rh1-h3: h2 clear; no capture, h1 castling right lost, e1 safe.',
  '11 White ends rook move, Black begins with fresh allowances.',
  '12 Masquerade Nb8-b6: Queen-like file through empty b7, empty destination; replacement move, no capture or King attack.',
  '13 Black ends Masquerade; card already spent/refilled, board unchanged.',
  '14 Rh3-g3: adjacent file movement onto empty square, e1 safe.',
  '15 White ends; no pending effects or captures to resolve.',
  '16 e7-e6: Black Pawn advances one down its file, does not expose a4.',
  '17 Black ends pawn move; White gets its regular move.',
  '18 Ng1-h3: legal knight jump to empty h3, no King exposed.',
  '19 Rebirth after White move: enemy c7 Pawn relocates to vacant e7 starting Pawn square, no capture or promotion; card spent/refilled.',
  '20 White ends after one regular move and one after-move card.',
  '21 f7-f5: f6/f5 empty, normal two-square Black Pawn move, King safe.',
  '22 Figure Dance after Black move: a1 Rook to h1, a8 Rook to a1, h8 Rook to a8 simultaneously counterclockwise; no captures, remaining castling right lost.',
  '23 Black ends; rook a1 is blocked by b1 Knight from checking e1.',
  '24 Rh1-g1: empty adjacent square; f1 Bishop and b1 Knight still shield e1.',
  '25 White ends; physical identities and hands unchanged.',
  '26 d7-d6: Black Pawn one forward to empty d6; a4 safe.',
  '27 Black ends; White turn begins, board unchanged.',
  '28 b2-b3: empty forward square; White Pawn at b3 attacks a4 and c4, giving check on the Black King legally.',
  '29 White ends with Black checked by b3 Pawn; escape turn permitted.',
  '30 Bc8-b7: Bishop diagonal onto empty b7 does not itself cure b3 Pawn check, but after-move Dungeon saves Black this same turn.',
  '31 Dungeon relocates checking enemy b3 Pawn to empty corner h8; removes a4 check, no promotion because Dungeon does not authorize it, following-turn movement barred.',
  '32 Black ends after check cured; Dungeon restriction persists for White turn.',
  '33 Rg1-h1: empty square; restricted h8 Pawn remains still, e1 safe.',
  '34 White ends; Dungeon prohibition expires exactly after the affected turn.',
  '35 Nb6-d7: ordinary knight jump to vacated d7, a4 safe.',
  '36 Black ends knight move, board unchanged.',
  '37 Annexation e2-e4: e3/e4 empty; replaces move, card spent/refilled, Pawn remains Pawn, starting-square en-passant opportunity registered.',
  '38 White ends Annexation; Black reply may exercise available en-passant geometry.',
  '39 a7-a6: one forward into empty a6, passes and expires Annexation en-passant opportunity.',
  '40 Black ends; all pieces retain their identities.',
  '41 Madman h4-f2: diagonal checker jump over occupied g3 Rook to empty f2; jumped Rook survives, Pawn untransformed, replaces move.',
  '42 White ends Madman; no additional regular move granted.',
  '43 Bb7-d5: diagonal through clear c6 to empty d5, a4 remains safe.',
  '44 Black ends Bishop move; no card or board changes.',
  '45 Pacifism on own c2 Pawn: continuing marker, no relocation, card retained as effect and refilled; regular move available.',
  '46 d2-d4: d3/d4 empty, ordinary double advance; c2 Pacifist unchanged and e1 safe.',
  '47 White ends; Pacifism remains and allowances reset.',
  '48 Evangelists swaps Black f8 and White f1 Bishops atomically; both retain ownership, no captures, replaces Black move, neither King left in check.',
  '49 Black ends swap; f1 Bishop does not attack adjacent e1 horizontally.',
  '50 e4-e5: White Pawn advances to vacant e5, own King remains shielded.',
  '51 White ends Pawn move; Pacifism persists.',
  '52 Bd5-b3: c4 clear, b3 vacant since Dungeon; diagonal Bishop move, a4 safe.',
  '53 Black ends; White e1 is not attacked by b3 Bishop, c2 Pawn blocks its line.',
  '54 Bc1-d2: adjacent empty diagonal; b1 Knight blocks hostile a1 Rook, e1 safe.',
  '55 Doomsayer after White move: continuing effect activated and card refilled, no piece named/lost yet, Black optional declaration pending.',
  '56 Black declines immediate Doomsayer naming; no loss, continuing effect remains.',
  '57 White ends after Doomsayer choice; board unchanged.',
  '58 Tournament swaps Black d7 and White b1 Knights atomically, replaces move, no capture; b1 Knight blocks a1 Rook and a4 remains safe.',
  '59 Knightmare reacts to replacement move: Knights restored, Black Tournament returned and replacement draw rewound, White cancellation spent/refilled, Black must choose different move.',
  '60 Nd7-f6: ordinary alternative knight jump distinct from canceled Tournament swap, empty f6 and King safe.',
  '61 Black ends replacement attempt; reaction allowance clears for next turn.',
  '62 e5xd6: forward diagonal capture of Black d6 Pawn; victim captured not dead, White Pawn stays unpromoted, e1 safe.',
  '63 White ends capture, no rescue card played.',
  '64 e7xd6: Black Pawn originally c7 captures White Pawn on forward diagonal; retains original identity, a4 safe.',
  '65 Black ends recapture; White captured Pawn remains returnable.',
  '66 Bf8xd6: e7 now clear, diagonal capture of Black Pawn on d6; White Bishop retains its identity, e1 safe.',
  '67 White ends capture; no transformations or pending rescue.',
  '68 Ra8-c8: b8/c8 clear, horizontal noncapture; a4 safe.',
  '69 Black ends rook move; continuing markers unchanged.',
  '70 c2-c3: Pacifism permits noncapturing forward move; marker follows physical Pawn, which cannot capture or be captured.',
  '71 White ends; b3 Bishop cannot take Pacifist c3 and does not attack e1 along its diagonal.',
  '72 f5-f4: Black Pawn moves one into empty f4, a4 safe.',
  '73 Black ends; f4 Pawn is capturable normally.',
  '74 Bd6xf4: e5 clear, diagonal captures Black Pawn, no promotion; White King safe.',
  '75 White ends Bishop capture; captured Black Pawn remains returnable.',
  '76 Nf6-d7: knight jump into empty d7, a4 safe.',
  '77 Black ends; board and effects unchanged.',
  '78 Rg3-g4: empty g4, regular vertical move; f4 Bishop blocks horizontal attack on a4.',
  '79 White ends rook move; no card consumed.',
  '80 Tournament d7/h3 Knights swap and retain colors; replacement move, neither King attacked by resulting Knights, card spent/refilled again after earlier cancellation.',
  '81 Black ends Tournament; White regular move becomes available.',
  '82 d4-d5: empty d5; Pawn advances and vacates d4, White King safe.',
  '83 Forbidden City after White move marks vacant e4; no relocation, continuing card held and refilled, future traversal/entry barred.',
  '84 White ends; Forbidden City and Pacifism persist.',
  '85 a6-a5: Black Pawn advances into vacant a5 and shields its King from no new line; a4 remains occupied by King.',
  '86 Black ends Pawn move; board unchanged.',
  '87 Blessing f2-b6: bishop-like path e3,d4,c5 empty, avoids forbidden e4, destination empty; Pawn moves without capture/promotion and replaces regular move.',
  '88 White ends Blessing; transformed movement is not a persistent Pawn transformation.',
  '89 Qd8-h4: diagonal e7,f6,g5 clear, empty h4; e4 wall not crossed, a4 safe.',
  '90 Black ends Queen move; White King e1 is checked along h4-g3-f2-e1 and must answer.',
  '91 Ke1xf1: adjacent capture of Black Bishop; f1 is outside Queen h4 and Knight h3 attacks, b1 Knight blocks a1 Rook; King safely answers check.',
  '92 White ends safe King capture; Black Bishop captured not dead.',
  '93 Ng8-h6: knight jump to empty h6; does not expose a4 King.',
  '94 Black ends; White turn begins with no check.',
  '95 Qd1xb3: clear c2 diagonal, captures Black Bishop, gives adjacent diagonal check on a4; ordinary move may mate, f1 remains safe.',
  '96 Neutrality on enemy h6 Knight: eligible nonroyal nonqueen, continuing marker and refill; Knight stays h6, can be controlled by either player, no new King attack.',
  '97 Black begins its escape turn: Doomsayer permits naming Pawn to remove its a5 Pawn, then Ka4-a5 escapes Qb3, so rules 19.3/11.5 do not require checkmate.',
  '98 Black intentionally names Pawn and selects its a5 Pawn: rules 19.3 captures that physical Pawn and resolves/discards Doomsayer; no move, card allowance or refill is consumed.',
  '99 Ka4-a5: adjacent square emptied by Doomsayer, outside Qb3 diagonals and all White attacks; Black escapes check and advances the move clock.',
  '100 Black ends with King safe on a5; White receives its normal turn, Doomsayer stays discarded.',
  '101 Rg4xg7: g5/g6 clear, captures Black g7 Pawn; Qh4 cannot attack f1 and b1 Knight shields a1 Rook, so White remains safe.',
  '102 White ends capture; g7 Pawn stays captured, surviving continuing effects and hands unchanged.',
  '103 Qh4-f6: diagonal through vacant g5, empty f6; no forbidden square crossed and a5 King safe.',
  '104 Black ends Queen move; White f1 King remains shielded on f-file by f4 Bishop/f3 Pawn.',
  '105 Nd7-e5: legal knight jump to empty e5; no King attack exposed, no capture or effect change.',
  '106 White ends Knight move, Black regular move and card allowances reset.',
  '107 Bombard Rc8-c4: empty c7,c6,c5 path needs no optional jump; legal replacement move onto empty c4, e4 wall not crossed, a5 safe; card spent/refilled.',
  '108 Black ends Bombard replacement; Rc4 cannot attack f1, no second regular move available.',
  '109 d5xe6: White Pawn captures Black e6 Pawn on forward diagonal, remains Pawn on sixth rank; f1 safe and capture clock resets.',
  '110 White ends Pawn capture; black-pawn-e7 remains captured, no rescue or en-passant opportunity.',
  '111 Qf6-g5: adjacent diagonal into vacant g5; a5 King unaffected, no Forbidden City traversal.',
  '112 Black ends Queen move; no check on f1, all continuing effects persist.',
  '113 g2xh3: White Pawn forward-diagonally captures Black original b8 Knight, distinct from neutral h6 Knight; f1 safe, no promotion.',
  '114 White ends Pawn capture; neutral h6 Knight and its marker remain intact.',
  '115 Qg5xf4: adjacent diagonal capture of White original f1 Bishop; f3 Pawn still blocks the Queen from f1 King, Black a5 safe.',
  '116 Black ends Bishop capture; no extra card or rescue, captured Bishop remains returnable.',
  '117 Bd2-e3: adjacent empty diagonal, e4 forbidden square not visited; b1 Knight/f3 Pawn still protect White f1.',
  '118 White ends Bishop move; board/effects remain stable, Black allowance resets.',
  '119 Rc4-c8: c5,c6,c7 empty, c8 vacant; ordinary noncapturing rook move, a5 safe.',
  '120 Black ends rook move; c3 Pacifist still cannot be captured along the c-file.',
  '121 h3-h4: White original g2 Pawn advances one into vacant h4, f1 remains safe; Pawn clock resets.',
  '122 White ends Pawn advance; no double move or en-passant right created.',
  '123 Irresistible Force h7-h6: Black Pawn pushes occupied neutral Knight h6-h5, where chain ends on empty h5; no King/obstruction/capture, marker follows Knight, replacement card spent/refilled.',
  '124 Black ends push; h5 neutral Knight attacks neither a5 nor f1 King, and Black has completed its replacement move.',
  '125 Ne5-g4: legal knight jump into vacant g4, avoids e4 wall; f3 Pawn shields f1 King, neutral h5 Knight untouched.',
  '126 White ends Knight move; neither King checked, continuing markers persist.',
  '127 Qf4xg4: adjacent horizontal capture of White original g1 Knight; e4 wall lies behind origin and is not traversed, a5 safe.',
  '128 Black ends capture; White f1 King unthreatened, White receives normal move allowance.',
  '129 Kf1-f2: adjacent empty f2 outside Qg4 and neutral Nh5 attacks; Black King distant, no capture, fifty regular moves reached.',
  '130 White ends its fiftieth regular move with f2 King safe; Black begins beforeMove, no pending rescue or King return, hands and three continuing effects unchanged.',
];

test('random campaign iteration 001: legal trace with available Doomsayer escape', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/001.json', import.meta.url), 'utf8')) as RandomTrace;
  const initial = JSON.parse(readFileSync(new URL('../../../campaign/iterations/001.initial.json', import.meta.url), 'utf8')) as RandomTrace;
  const beforeFinish = JSON.parse(readFileSync(new URL('../../../campaign/iterations/001.pre-finish.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.deepEqual(trace.steps.slice(0, 97).map(step => step.action), initial.steps.map(step => step.action));
  assert.deepEqual(trace.steps.slice(0, 129).map(step => step.action), beforeFinish.steps.map(step => step.action));
  assert.equal(reasons.length, trace.steps.length);
  assert.equal(trace.steps.length, 130);
  assert.equal(trace.steps.filter(step => step.action.type === 'move').length, 50);
  assert.equal(trace.moves, 50);
  let state = createGameState(trace.initial);
  for (const [index, step] of trace.steps.entries()) {
    const result = applyAction(state, step.action);
    assert.ok(result.ok, reasons[index]);
    checkState(result.state);
    assert.equal(digest(result.state, 1), step.expected, reasons[index]);
    state = result.state;
    if (index === 96) {
      assert.equal(state.outcome, null, 'rules 11.5: a Doomsayer escape is still available');
      const named = applyAction(state, { type: 'namePiece', speaker: 'black', name: 'pawn', losses: [{ effectId: 'white-hand-2-doomsayer', pieceId: 'black-pawn-a7' }] });
      assert.ok(named.ok, 'rules 19.3: voluntarily name Pawn and select the owned a5 Pawn');
      assert.equal(named.state.pieces.find(piece => piece.id === 'black-pawn-a7')?.zone, 'captured');
      assert.equal(named.state.effects.length, state.effects.length - 1, 'resolved Doomsayer leaves play');
      const escaped = applyAction(named.state, { type: 'move', from: 'a4', to: 'a5' });
      assert.ok(escaped.ok, 'Ka4-a5 escapes through the vacated square');
      const ended = applyAction(escaped.state, { type: 'endTurn' });
      assert.ok(ended.ok, 'Black can finish its escape turn legally');
      assert.equal(ended.state.outcome, null);
    }
  }
  assert.equal(state.fen, trace.finalFen);
  assert.equal(state.fen, '2r4P/6R1/1P2P2p/kp5n/6qP/1QP1BP2/P4K2/rN5R b - - 1 30');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.ok(!state.pendingRescue);
  assert.equal(state.underElfHill?.length ?? 0, 0);
  assert.equal(state.outcome, null, reasons.at(-1)!);
});
