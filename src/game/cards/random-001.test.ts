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
  '97 BUG: Black escape turn has no move or saving card; a3/b4 controlled by Qb3, Kxb3 barred by a2 Pawn, a5/b5 occupied. Rules 11.5 require White checkmate, but outcome remains null.',
];

test('random campaign iteration 001: escape-less mate after 36 moves', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/001.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(reasons.length, trace.steps.length);
  let state = createGameState(trace.initial);
  for (const [index, step] of trace.steps.entries()) {
    const result = applyAction(state, step.action);
    assert.ok(result.ok, reasons[index]);
    checkState(result.state);
    if (index < trace.steps.length - 1) assert.equal(digest(result.state), step.expected, reasons[index]);
    state = result.state;
  }
  assert.equal(state.fen, trace.finalFen);
  assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' }, reasons.at(-1)!);
});
