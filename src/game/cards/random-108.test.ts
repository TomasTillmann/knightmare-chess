import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import type { Color, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/108.json', import.meta.url), 'utf8')) as RandomTrace;

// Independently reviewed in order against rules §§8–11 and the printed catalog
// timing plus cards.md. These are semantic judgments, not generated hash labels.
const rationale = [
  '1. f2-f3 advances the white Pawn to empty f3; pawn clock resets.',
  '2. White ends its completed move; only turn and allowances reset.',
  '3. b7-b6 advances the black Pawn one square; fullmove becomes 2.',
  '4. Black hands the unchanged position to White.',
  '5. d2-d4 crosses empty d3 from the starting rank; create d3 EP.',
  '6. End turn preserves d3 EP and all pieces/cards.',
  '7. e7-e6 is a quiet Pawn step and expires d3 EP.',
  '8. Black ends; no draw or effect expires.',
  '9. c2-c4 crosses empty c3; create c3 EP.',
  '10. White ends, retaining the c3 EP opportunity.',
  '11. d7-d6 is a quiet Pawn step; c3 EP expires.',
  '12. Black ends with all physical records preserved.',
  '13. e2-e4 crosses empty e3; create e3 EP.',
  '14. End turn preserves e3 EP.',
  '15. Ng8-h6 is an unobstructed knight jump; e3 EP expires.',
  '16. Black ends; no card accounting changes.',
  '17. Nb1-a3 is a knight jump to an empty square.',
  '18. White ends its completed move.',
  '19. Black plays before-move Pacifism on its nonroyal h7 Pawn; effect retains the card, draw Neutrality.',
  '20. Ke8-d7 moves diagonally to safety; both black castling rights end.',
  '21. Black ends; Pacifism and its physical card persist.',
  '22. Ke1-d2 moves diagonally to empty safe d2; white castling rights end.',
  '23. White ends; board, effects, clocks and zones stay fixed.',
  '24. c7-c5 crosses empty c6; create c6 EP.',
  '25. Black ends, retaining c6 EP.',
  '26. Ng1-h3 jumps to empty h3; expire c6 EP.',
  '27. White ends; no physical change.',
  '28. Kd7-e7 is one safe horizontal king step.',
  '29. Black ends; all pieces/cards remain.',
  '30. Nh3-g5 makes a legal knight jump.',
  '31. White ends; effect on h7 persists.',
  '32. e6-e5 is a quiet black Pawn step.',
  '33. Black ends without drawing.',
  '34. Madman replaces White move: d4-f6-h4 jumps over occupied e5 and g5, preserving both jumped pieces; draw Evangelists.',
  '35. White ends after its replacement move; no additional move.',
  '36. Qd8-d7 is a one-square file move to empty d7.',
  '37. Black ends with its Queen at d7.',
  '38. Kd2-c2 is a safe adjacent move.',
  '39. White ends with its King at c2.',
  '40. Nh6-f5 jumps to empty f5.',
  '41. Black ends; clocks stay at their post-move values.',
  '42. Bf1-e2 is a one-square diagonal move.',
  '43. White ends; its bishop remains e2.',
  '44. Ke7-d8 is a safe diagonal retreat.',
  '45. Black ends, opening White before-move window.',
  '46. Bombard replaces White move: Rh1-h3 jumps precisely the h2 Pawn, lands empty, captures nobody; draw Holy Quest.',
  '47. White ends after Bombard without another regular move.',
  '48. Pacifist h7-h6 Pawn may move quietly; marker follows identity.',
  '49. Black ends; Pacifism remains on h6.',
  '50. Qd1-d4 slides through empty d2,d3.',
  '51. White ends; no card or board change.',
  '52. Bc8-a6 crosses empty b7.',
  '53. After-move Fatal Attraction marks Black Nb8; a8/a7 are frozen, Kings exempt; draw Charge.',
  '54. Black ends; magnet stays at b8.',
  '55. Qd4-d3 slides one square, outside magnet adjacency.',
  '56. White ends; Pacifism and magnet persist.',
  '57. Rh8-h7 moves vertically one square along the h-file to empty h7.',
  '58. Black ends with rook h7 and Pawn h6 distinct.',
  '59. Ng5-e6 jumps and checks Kd8 from e6.',
  '60. White ends; Black receives the check response.',
  '61. f7xe6 captures the checking white Ng1 identity; capturedBy is black; reset clock.',
  '62. Black ends with Kd8 safe.',
  '63. Na3-b5 jumps to empty b5.',
  '64. White ends; no capture/card change.',
  '65. Nf5-d4 jumps and checks White Kc2.',
  '66. Black ends, giving White a check response.',
  '67. Qd3-d1 crosses d2 but leaves Nd4 checking Kc2; §11.6 permits only a pending same-turn rescue.',
  '68. Holy Quest swaps opposing Bf8/Nd4 by identity; Bd4 does not attack c2, Nf8 no longer checks; draw Abduction.',
  '69. White may now end because Holy Quest cured its check.',
  '70. Qd7-e8 moves one diagonal square.',
  '71. Black ends; swap and card zones persist.',
  '72. a2-a4 crosses empty a3, creating a3 EP.',
  '73. White ends with a3 EP available.',
  '74. Bd4-f2 crosses empty e3; no capture and a3 EP expires.',
  '75. Black ends with bishop f2.',
  '76. Qd1-f1 crosses empty e1.',
  '77. After-move Abduction hides opposing nonroyal Nf8 as away, preserving identity; draw Lost Castle.',
  '78. Reveal starts the recall window; no physical or clock change.',
  '79. Recall timeout captures Ng8 identity for White; reset halfmove only, clear pending Abduction.',
  '80. White ends after resolved capture; no second draw.',
  '81. Kd8-d7 moves to a safe adjacent square.',
  '82. Black ends with King d7.',
  '83. Kc2-d1 is a safe diagonal king move.',
  '84. White ends with its King d1.',
  '85. Bf2xh4 crosses empty g3 and captures the original white d2 Pawn; capturedBy black.',
  '86. Black ends; captured d2 Pawn remains off-board.',
  '87. Bc1-f4 crosses empty d2,e3.',
  '88. White ends; bishop remains f4.',
  '89. g7-g6 advances one empty Pawn square.',
  '90. Black ends; both continuing effects persist.',
  '91. Nb5-c3 makes a legal knight jump.',
  '92. White ends without a card draw.',
  '93. d6-d5 advances one empty Pawn square.',
  '94. Black ends; Pawn remains d5.',
  '95. Nc3-a2 jumps to vacated a2.',
  '96. White ends, preserving every physical identity.',
  '97. d5xe4 captures the original white e2 Pawn; capturedBy black.',
  '98. Black after-move Neutrality marks opponent Rh3, retaining owner white; draw Abduction and keep effect card active.',
  '99. Black ends; neutral rook is controlled by either side, not an attack on either King here.',
  '100. b2-b4 crosses empty b3, creates b3 EP, leaves royal safety intact.',
  '101. White ends; neutral Rh3 and b3 EP persist.',
  '102. Ghostwalk replaces Black move Qe8-f8 to empty f8; no obstacle/capture needed; clear EP, draw Peace Talks.',
  '103. Black ends after replacement; no extra regular move.',
  '104. Qf1-e1 moves one horizontal square.',
  '105. White ends with Queen e1.',
  '106. Qf8-h8 crosses empty g8.',
  '107. Black ends; h8 Queen does not check Kd1.',
  '108. Be2-f1 moves one diagonal square to empty f1.',
  '109. White ends; neutral Rh3 remains stationary.',
  '110. Magnet Nb8-c6 moves legally; Fatal Attraction expires and its card enters Black discard after Ghostwalk.',
  '111. Black ends; only Pacifism and Neutrality persist.',
  '112. Ra1-b1 is a quiet rook step; every unaffected piece and card stays fixed.',
  '113. White ends move command 50; Black begins turn 27 with no pending rescue or recall.',
];

test('iteration 108 independently models every physical state and all 113 actions', () => {
  assert.equal(rationale.length, trace.steps.length);
  assert.equal(trace.moves, 50);
  let actual = createGameState(trace.initial);
  const expected = structuredClone(actual);
  let half = 0, full = 1, side: Color = 'white', rights = 'KQkq';
  const piece = (square: string) => expected.pieces.find(p => p.zone === 'board' && p.square === square);
  const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
  const square = (value: string): SquareName => { assert.match(value, /^[a-h][1-8]$/); return value as SquareName; };
  type Effect = { type: string; owner: Color; card: { id: string; cardId: string }; pieceId: string };
  const effects = () => expected.effects as Effect[];
  const pacifist = (p: PieceState) => effects().some(e => e.type === 'pacifism' && e.pieceId === p.id);
  const frozen = (p: PieceState) => !p.royal && effects().some(e => {
    const magnet = expected.pieces.find(q => e.type === 'fatal-attraction' && q.id === e.pieceId && q.square);
    if (!magnet?.square || !p.square || magnet.id === p.id) return false;
    const [a,b] = xy(magnet.square), [c,d] = xy(p.square);
    return Math.max(Math.abs(a-c), Math.abs(b-d)) === 1;
  });
  const reaches = (p: PieceState, to: string, capture: boolean) => {
    assert.ok(p.square);
    const [x,y] = xy(p.square), [tx,ty] = xy(to), dx = tx-x, dy = ty-y;
    if (!dx && !dy || frozen(p) || capture && pacifist(p)) return false;
    if (p.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
    if (p.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
    if (p.role === 'pawn') {
      const forward = p.owner === 'white' ? 1 : -1;
      if (capture) return Math.abs(dx) === 1 && dy === forward;
      return dx === 0 && (dy === forward || y === (p.owner === 'white' ? 1 : 6) && dy === 2*forward && !piece(`${p.square[0]}${y+forward+1}`));
    }
    const straight = dx === 0 || dy === 0, diagonal = Math.abs(dx) === Math.abs(dy);
    if (!(p.role === 'rook' ? straight : p.role === 'bishop' ? diagonal : straight || diagonal)) return false;
    for (let i=1; i<Math.max(Math.abs(dx),Math.abs(dy)); i++) {
      if (piece(`${String.fromCharCode(97+x+i*Math.sign(dx))}${y+1+i*Math.sign(dy)}`)) return false;
    }
    return true;
  };
  const inCheck = (color: Color) => {
    const king = expected.pieces.find(p => p.royal && p.owner === color)!;
    assert.ok(king.square);
    return expected.pieces.some(p => p.zone === 'board' && p.id !== king.id && (p.owner !== color || p.neutral) && reaches(p, king.square!, true));
  };
  const revoke = (p: PieceState) => {
    if (p.royal) rights = rights.replace(p.owner === 'white' ? /[KQ]/g : /[kq]/g, '');
    if (p.role === 'rook') { const flag = { a1:'Q', h1:'K', a8:'q', h8:'k' }[p.square as 'a1']; if (flag) rights = rights.replace(flag, ''); }
  };
  const relocate = (from: string, to: string, capture = false) => {
    const p = piece(from)!; assert.ok(p);
    const victim = piece(to);
    assert.equal(!!victim, capture);
    if (victim) {
      assert.ok(!victim.royal && !pacifist(victim));
      revoke(victim); victim.square = null; victim.zone = 'captured'; victim.capturedBy = expected.turn.color;
    }
    revoke(p); p.square = square(to);
    return p;
  };
  const moveClock = (p: PieceState, capture = false) => {
    half = p.originalRole === 'pawn' && !p.promoted || capture ? 0 : half+1;
    if (expected.turn.color === 'black') full++;
    side = expected.turn.color === 'white' ? 'black' : 'white';
    expected.turn.phase = 'afterMove'; expected.turn.moveMade = true;
  };
  const fen = () => {
    const roles = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
    const rows: string[] = [];
    for (let rank=8; rank>=1; rank--) {
      let row='', empty=0;
      for (const file of 'abcdefgh') { const p=piece(`${file}${rank}`); if (!p) empty++; else { if(empty) row+=empty; empty=0; row+=p.owner==='white'?roles[p.role].toUpperCase():roles[p.role]; } }
      if(empty) row+=empty; rows.push(row);
    }
    // Every recorded double-step has no opposing adjacent Pawn able to capture.
    for (const ep of expected.enPassant) {
      const victim=expected.pieces.find(p=>p.id===ep.pawnId)!;
      assert.ok(!expected.pieces.some(p=>p.zone==='board' && p.owner!==victim.owner && p.role==='pawn' && reaches(p,ep.target,true)));
    }
    return `${rows.join('/')} ${side[0]} ${rights || '-'} - ${half} ${full}`;
  };
  let reviewedMoves=0, reviewedCards=0;
  let abductionBefore: typeof expected | undefined;
  for (const [index,{action}] of trace.steps.entries()) {
    const step=index+1, message=rationale[index]!;
    assert.ok(message.startsWith(`${step}. `));
    const before = structuredClone(actual);
    const physicalBefore = structuredClone(expected);
    physicalBefore.fen = fen();
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.equal(action.promotion,undefined,message);
      const mover=piece(action.from)!; assert.ok(mover);
      assert.equal(mover.owner,expected.turn.color);
      assert.ok(!expected.turn.moveMade);
      const capture=!!piece(action.to);
      assert.ok(reaches(mover,action.to,capture),message);
      if(capture) assert.notEqual(piece(action.to)!.owner,mover.owner);
      expected.enPassant=[];
      if(mover.role==='pawn' && Math.abs(Number(action.to[1])-Number(action.from[1]))===2) {
        expected.enPassant=[{target:square(`${action.from[0]}${(Number(action.to[1])+Number(action.from[1]))/2}`),pawnId:mover.id}];
      }
      relocate(action.from,action.to,capture); moveClock(mover,capture); reviewedMoves++;
      if(step===110) {
        const effect=effects().find(e=>e.type==='fatal-attraction')!;
        expected.players.black.discard.push(effect.card);
        expected.effects=effects().filter(e=>e!==effect);
      }
    } else if(action.type==='endTurn') {
      assert.ok(expected.turn.moveMade); assert.equal(inCheck(expected.turn.color),false,message);
      expected.turn={color:expected.turn.color==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    } else if(action.type==='playCard') {
      reviewedCards++;
      const owner=expected.turn.color, player=expected.players[owner];
      assert.equal(expected.turn.cardPlays[owner],0);
      assert.ok(CARD_CATALOG[action.cardId]!.timing.includes(expected.turn.phase));
      const i=player.hand.findIndex(c=>c.id===action.cardInstanceId && c.cardId===action.cardId); assert.ok(i>=0);
      const [card]=player.hand.splice(i,1); assert.ok(card);
      if(!CARD_CATALOG[action.cardId]!.continuing) player.discard.push(card);
      player.hand.push(player.deck.shift()!); expected.turn.cardPlays[owner]++;
      switch(step) {
        case 19: case 53: case 98: {
          assert.ok(typeof action.target==='string'); const p=piece(action.target)!; assert.ok(p&&!p.royal);
          expected.effects.push({type:action.cardId,owner,card,pieceId:p.id});
          if(step===98) { assert.equal(p.owner,'white'); assert.equal(p.role,'rook'); p.neutralBeforeEffects=false; p.neutral=true; }
          else assert.equal(p.owner,owner);
          break;
        }
        case 34: {
          assert.deepEqual(action.target,[{from:'d4',to:'f6'},{from:'f6',to:'h4'}]);
          assert.equal(piece('e5')!.id,'black-pawn-e7'); assert.equal(piece('g5')!.id,'white-knight-g1');
          assert.equal(piece('f6'),undefined); assert.equal(piece('h4'),undefined);
          const p=relocate('d4','h4'); assert.equal(p.originalRole,'pawn'); expected.enPassant=[]; moveClock(p); break;
        }
        case 46: {
          assert.deepEqual(action.target,[{from:'h1',to:'h3'}]);
          assert.equal(piece('h2')!.id,'white-pawn-h2'); const p=relocate('h1','h3');
          assert.equal(p.role,'rook'); expected.enPassant=[]; moveClock(p); break;
        }
        case 68: {
          assert.deepEqual(action.target,{bishop:'f8',knight:'d4'});
          const bishop=piece('f8')!, knight=piece('d4')!;
          assert.equal(bishop.role,'bishop'); assert.equal(knight.role,'knight');
          assert.equal(bishop.owner,'black'); assert.equal(knight.owner,'black');
          bishop.square='d4'; knight.square='f8'; break;
        }
        case 77: { assert.equal(action.target,'f8'); abductionBefore=physicalBefore; const p=piece('f8')!; assert.equal(p.id,'black-knight-g8'); p.square=null; p.zone='away'; break; }
        case 102: { assert.deepEqual(action.target,[{from:'e8',to:'f8'}]); const p=piece('e8')!; assert.ok(reaches(p,'f8',false)); relocate('e8','f8'); expected.enPassant=[]; moveClock(p); break; }
        default: assert.fail(`Unreviewed card at ${step}`);
      }
      // No regular card here gives even check to the opposing King, let alone direct mate.
      if(!CARD_CATALOG[action.cardId]!.continuing) assert.equal(inCheck(owner==='white'?'black':'white'),false,message);
    } else if(action.type==='revealAbduction') {
      assert.equal(step,78);
    } else if(action.type==='abductionTimeout') {
      assert.equal(step,79); const p=expected.pieces.find(p=>p.id==='black-knight-g8')!;
      assert.equal(p.zone,'away'); p.zone='captured'; p.capturedBy='white'; half=0;
    } else assert.fail(`Unreviewed action ${step}`);

    const result=applyAction(actual,action);
    assert.deepEqual(actual,before,`${message}: full structuredClone input immutability`);
    assert.ok(result.ok,message); actual=result.state;
    assert.deepEqual(actual.pieces,expected.pieces,`${message}: all 32 physical piece records`);
    assert.deepEqual(actual.players,expected.players,`${message}: all hands/decks/discards including physical IDs`);
    assert.deepEqual(actual.effects,expected.effects,`${message}: complete effect records`);
    assert.deepEqual(actual.turn,expected.turn,message);
    assert.deepEqual(actual.enPassant,expected.enPassant,message);
    assert.equal(actual.fen,fen(),`${message}: independent board, castling, EP and clocks`);
    assert.equal(actual.orientation,0); assert.equal(actual.outcome,null);
    assert.equal(!!actual.pendingRescue,step===67,message);
    if(step===67) {
      assert.deepEqual(actual.pendingRescue!.pieces,physicalBefore.pieces,message);
      assert.equal(actual.pendingRescue!.fen,physicalBefore.fen,message);
      assert.deepEqual(actual.pendingRescue!.enPassant,physicalBefore.enPassant,message);
    }
    assert.equal(inCheck(expected.turn.color),step===60||step===66||step===67,message);
    if(step===77||step===78) {
      assert.ok(actual.pendingAbduction);
      assert.equal(actual.pendingAbduction.phase,step===77?'concealment':'recall');
      assert.equal(actual.pendingAbduction.pieceId,'black-knight-g8');
      assert.equal(actual.pendingAbduction.player,'black');
      assert.equal(actual.pendingAbduction.durationMs,10000);
      assert.deepEqual(actual.pendingAbduction.before.pieces,abductionBefore!.pieces,message);
      assert.deepEqual(actual.pendingAbduction.before.players,abductionBefore!.players,message);
      assert.deepEqual(actual.pendingAbduction.before.effects,abductionBefore!.effects,message);
      assert.equal(actual.pendingAbduction.before.fen,abductionBefore!.fen,message);
    } else assert.equal(!!actual.pendingAbduction,false,message);
    assert.equal(!!actual.pendingDoomsayer,false);
    assert.equal(!!actual.underElfHill?.length,false);
    assert.equal(!!actual.chaosForbidden,false,message);
  }
  assert.equal(reviewedMoves,50); assert.equal(reviewedCards,8);
  assert.equal(actual.fen,'r6q/p2k3r/bpn1p1pp/2p1p3/PPP1pB1b/5P1R/N5PP/1R1KQB2 b - - 6 27');
  assert.deepEqual(replayTrace(trace),actual);
});
