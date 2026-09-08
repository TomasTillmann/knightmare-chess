import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkState, digest, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

// Independently reviewed in order against rules.md and cards.md, through the first finding.
const review = [
  '1 Assassin: Qd1-e2 is one diagonal step, captures the friendly e2 Pawn, consumes the move and replaces the spent card; both Kings remain screened.',
  '2 End White turn: board unchanged; Black receives fresh move/card allowances.',
  '3 a7-a6: Black Pawn advances one empty square; no capture, King remains screened.',
  '4 End Black turn: White receives the move; no board or hand change.',
  '5 Qe2-g4: f3 and g4 empty, diagonal clear; e1 King remains safe.',
  '6 End White turn: Black receives the move with board unchanged.',
  '7 b7-b5: b6 and b5 empty; initial double-step establishes b6 en passant, clock resets.',
  '8 End Black turn: White gets the single-turn b6 en-passant opportunity.',
  '9 Evangelists: White Bc1 and Black Bc8 exchange identity-preserving squares without capture; d2/f2/e7 shield Kings; replacement move expires b6.',
  '10 End White turn after replacement move: Black allowances reset.',
  '11 Annexation: d7-d5 and h7-h5 each traverse two empty forward squares, simultaneous and noncapturing; both initial Pawns establish en passant.',
  '12 End Black turn: d6 and h6 en-passant possibilities remain for White.',
  '13 Qg4-e2: f3 empty diagonal, no capture; expires both Annexation opportunities.',
  '14 End White turn: unchanged board and Black to act.',
  '15 Qd8-d7: vacated d7 is empty, one straight step; e8 remains screened.',
  '16 End Black turn: White to act, no material changes.',
  '17 Bc8xa6: b7 clear; captures only Black Pawn a6; White King remains protected.',
  '18 End White turn: Black to act with captured Pawn retained as captured, not dead.',
  '19 Ng8-f6: legal one-by-two jump to empty square, no King exposure.',
  '20 End Black turn: White allowances reset.',
  '21 Haunting Memories copies last played Annexation, a nonunique opposing card; d2-d4 and g2-g4 paths clear and both en-passant targets recorded; only copy spent.',
  '22 End White replacement turn: Black gets d3/g3 opportunities.',
  '23 Nf6-g8: empty destination and legal jump; expires both unused en-passant opportunities.',
  '24 End Black turn: White to act.',
  '25 Qe2xe7: e3-e6 clear, captures Black e7 Pawn; gives check on Ke8, which may respond.',
  '26 End White turn: checked Black receives escape turn, no premature mate declaration.',
  '27 h5xg4: ordinary diagonal capture of White Pawn but does not answer Qe7 check; remains provisional pending same-turn rescue (§11.6).',
  '28 Heresy cannot cure Qe7 check: attempted Bishop relocations would leave Ke8 attacked; spends/replaces card and rewinds provisional Pawn capture, restoring g4/h5.',
  '29 Qd7xe7: horizontal capture removes checking White Queen, resolves Black King danger with already-spent card allowance.',
  '30 End Black turn: White now faces Qe7 on open e-file.',
  '31 b2-b4: empty two-square Pawn path but leaves Ke1 in check; provisional, with b3 en passant subject to rollback.',
  '32 Treason swapping Ra8/Nb8 cannot cure e-file check; card spent and replaced, no swap persists, b2 Pawn and prior en-passant state restored.',
  '33 Ke1-d1: adjacent empty square outside Qe7 lines and Bc1 diagonals; White castling rights lost.',
  '34 End White turn: Black to act, King safe.',
  '35 Nb8-c6: legal jump to empty destination; Black King safe.',
  '36 End Black turn: White to act.',
  '37 c2-c3: one empty forward step, no capture; White King d1 not exposed.',
  '38 End White turn: Black to act.',
  '39 Qe7-d6: one diagonal step to empty d6; no capture or royal exposure.',
  '40 End Black turn: White to act.',
  '41 Bf1-c4: e2 and d3 empty, c4 empty; legal diagonal, d1 King safe.',
  '42 Coup: c3 Pawn becomes White royal and keeps Pawn movement; old Kd1 becomes capturable Prince; c3 is safe and card retained/replaced once.',
  '43 End White turn: Black to act against new royal c3.',
  '44 Qd6-g3: e5/f4 empty diagonal; Queen on g3 now checks royal c3 along f3/e3/d3.',
  '45 End Black turn: White receives the checked-royal escape turn.',
  '46 Bc4-b3: legal geometry but does not block g3-c3 line; provisional pending rescue.',
  '47 Holy War Nb1/Ba6 swap cannot block that line; swap fails, card spent, Bc4 restored by provisional-move rewind.',
  '48 f2xg3: forward diagonal capture removes checking Queen; royal c3 safe, Queen captured and clock reset.',
  '49 End White turn: Black to act; royal identity stays c3.',
  '50 Nc6-e5: legal knight jump to empty e5; does not attack c3 and Black King remains safe.',
  '51 End Black turn: White to act.',
  '52 Ng1-h3: legal jump to empty h3; royal c3 stays safe.',
  '53 End White turn: Black to act.',
  '54 f7-f6: Black Pawn advances one empty square; no en passant and no exposure of Ke8.',
  '55 End Black turn: White to act.',
  '56 Bc4-e2: d3 clear diagonal, e2 empty; no royal exposure.',
  '57 End White turn: Black to act.',
  '58 Ne5-g6: legal jump, empty destination, no capture.',
  '59 End Black turn: White to act.',
  '60 Be2-c4: d3 clear diagonal, c4 empty; kings remain safe.',
  '61 End White turn: Black to act with kq castling rights intact.',
  '62 Queenside castle e8/a8: b8/c8/d8 empty and d8 safe, but c8 attacked by Ba6 through b7; castle is provisional pending a same-turn rescue.',
  '63 Man-Trap f6 cannot remove Ba6 check on c8. Failed rescue must spend/replace the card, rewind King/Rook and castling rights, and leave NO newly created trap marker. Actual engine wrongly retains the marker.',
];

test('random iteration 002: failed Man-Trap rescue must not retain its effect', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/002.json', import.meta.url), 'utf8')) as RandomTrace;
  const reviewed = trace.steps.slice(0, 63);
  assert.equal(review.length, reviewed.length);
  let state = createGameState(trace.initial);
  for (const [index, step] of reviewed.entries()) {
    const result = applyAction(state, step.action);
    assert.ok(result.ok, review[index]);
    state = result.state;
    checkState(state);
    if (index < 62) assert.equal(digest(state, 1), step.expected, review[index]);
  }
  assert.equal(state.fen, 'r3kbnr/2p3p1/B4pn1/1p1p3p/2BP2P1/2P3PN/PP5P/RNbK3R b kq - 3 14');
  assert.equal(state.effects.some(effect => typeof effect === 'object' && effect !== null
    && 'type' in effect && effect.type === 'man-trap'), false, review[62]);
  assert.ok(state.players.black.discard.some(card => card.id === 'black-hand-1-man-trap'));
  assert.equal(state.players.black.hand.length, 5);
  assert.equal(state.turn.cardPlays.black, 1);
});
