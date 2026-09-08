import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

// Independently reviewed in order against rules §§8–11, 13, 15, 17–21 and
// final_cards KC1, KC2, KC8–11, KC13, KC15, KC18, KC20 printed timing/text.
const rationales = [
  '1. a2-a3: White Pawn advances one to an empty square.',
  '2. End White turn; board and card zones stay fixed.',
  '3. h7-h5: Black Pawn crosses empty h6; h6 en-passant opportunity.',
  '4. End Black turn; preserve h6 opportunity for White.',
  '5. h2-h3: White Pawn advances one; old en passant expires.',
  '6. Neutrality after move marks opposing nonroyal Rook a8, retains card, draws Evangelists.',
  '7. End White turn; neutrality remains attached to the black physical Rook.',
  '8. b8-a6: Black Knight jumps one file and two ranks.',
  '9. Doomsayer after move retains its card; White gets immediate naming choice; draw Fanatic.',
  '10. White names Queen and loses its d1 Queen to Black; resolve/discard Doomsayer, reset capture clock.',
  '11. End Black turn after the naming choice; no additional draw.',
  '12. White controls neutral a8 Rook to capture black a7 Pawn; actual captor White, lose q right.',
  '13. End White turn with neutrality intact.',
  '14. g7-g6: Black Pawn advances one into vacant g6.',
  '15. End Black turn without card expenditure.',
  '16. Evangelists replaces White move, swapping f1/c8 Bishops without capture; draw Assassin.',
  '17. End White replacement turn; Bishop owners and identities remain unchanged.',
  '18. d7-d6: Black Pawn advances one and opens c8-f5 diagonal.',
  '19. End Black turn; swapped Bishops remain in place.',
  '20. c8-f5: White Bishop traverses empty d7/e6 diagonally.',
  '21. End White turn.',
  '22. f1-e2: Black Bishop captures White e2 Pawn diagonally; captor Black.',
  '23. End Black capture turn.',
  '24. a7-a8: White controls neutral Rook one square vertically; castling right does not return.',
  '25. End White turn.',
  '26. g6-f5: Black Pawn captures White Bishop one diagonal forward.',
  '27. End Black turn; captured Bishop retains physical identity.',
  '28. a8-c8: White controls neutral Rook across vacant b8 to vacant c8.',
  '29. End White turn; black Queen d8 blocks neutral Rook ray toward e8.',
  '30. f8-g7: Black Bishop moves one diagonal into vacant square.',
  '31. End Black turn.',
  '32. c2-c4: White Pawn crosses empty c3; creates c3 opportunity.',
  '33. End White turn; preserve c3 opportunity.',
  '34. e2-d3: Black Bishop moves one diagonal; old en passant expires.',
  '35. End Black turn.',
  '36. g2-g4: White Pawn crosses empty g3; creates g3 opportunity.',
  '37. End White turn; preserve g3 opportunity.',
  '38. d6-d5: Black Pawn advances one; old en passant expires.',
  '39. Challenge after Black move targets movable White h3 Pawn, which can advance h4; discard/draw Cathedral.',
  '40. End Black turn; Challenge remains due on White move.',
  '41. h3-h4: designated White Pawn advances and satisfies Challenge; remove obligation.',
  '42. End White turn after satisfying Challenge.',
  '43. g8-h6: Black Knight jumps one file and two ranks.',
  '44. Curse after move marks opposing h1 Rook; retain card and draw Abduction.',
  '45. End Black turn; Curse and Neutrality remain.',
  '46. a3-a4: White Pawn advances into empty a4.',
  '47. End White turn.',
  '48. g7-b2: Black Bishop traverses f6/e5/d4/c3 and captures White b2 Pawn.',
  '49. End Black capture turn.',
  '50. b1-a3: White Knight jumps to vacated a3.',
  '51. End White turn.',
  '52. Forced March replaces Black move: c7-d7 and d5-c5 are distinct sideways moves into initially empty squares; draw Think Again.',
  '53. End Black replacement turn; no en passant from sideways moves.',
  '54. f2-f4: White Pawn crosses empty f3; creates f3 opportunity.',
  '55. End White turn; preserve f3 opportunity.',
  '56. b2-a3: Black Bishop captures White Knight diagonally; clear en passant.',
  '57. End Black capture turn.',
  '58. g4-h5: White Pawn captures Black h7 Pawn diagonally forward.',
  '59. End White capture turn.',
  '60. h8-g8: Black Rook moves one file; Black kingside castling right expires.',
  '61. Cathedral after Black move swaps controlled neutral Rook c8 with Black Bishop d3; draw Onslaught.',
  '62. End Black turn; neutral marker follows Rook to d3.',
  '63. e1-f1: White King moves one square to safety; revoke White castling rights.',
  '64. White Cathedral would place neutral Rook c1 with clear d1/e1 ray to King f1: SELF_CHECK fizzle, spend/draw Lost Castle.',
  '65. End White turn with pre-Cathedral board restored.',
  '66. e7-e6: Black Pawn advances into empty e6.',
  '67. Abduction after Black move temporarily puts White f4 Pawn away, no capture; concealment, draw Riposte. Neither King f1/e8 is attacked: removing f4 opens no royal attack ray.',
  '68. Reveal Abduction changes only concealment to recall; both Kings f1/e8 remain safe on the unchanged temporary board.',
  '69. White correctly recalls its physical Pawn f2 on f4; restore it exactly, no second spend/draw.',
  '70. End Black turn after memory resolution.',
  '71. Assassin proposes White King f1 capturing own Knight g1, but Black Rook g8 attacks g1 along empty g-file: fizzle; safe-start replacement move consumed, draw Long Jump.',
  '72. End White replacement turn; Knight g1 survives the fizzle.',
  '73. d8-h4: Black Queen traverses e7/f6/g5 and captures White h4 Pawn.',
  '74. End Black capture turn.',
  '75. d3-h3: White controls neutral Rook along empty e3/f3/g3.',
  '76. End White turn.',
  '77. h3-d3: Black controls same neutral Rook along empty g3/f3/e3.',
  '78. End Black turn.',
  '79. c1-b2: White Bishop moves one diagonal to empty b2.',
  '80. End White turn.',
  '81. e8-e7: Black King advances one square to safety.',
  '82. End Black turn.',
  '83. a1-e1: White Rook crosses empty b1/c1/d1.',
  '84. End White turn.',
  '85. d3-d6: Black controls neutral Rook across empty d4/d5.',
  '86. End Black turn.',
  '87. e1-a1: White Rook returns across empty d1/c1/b1.',
  '88. End White turn.',
  '89. h4-f4: Black Queen crosses empty g4 and captures White f4 Pawn, checking King f1.',
  '90. End Black turn; White must answer the f-file check.',
  '91. f1-e2: White King escapes Queen f4 to a safe adjacent square.',
  '92. Think Again reacts immediately: restore King f1 and pre-move clocks, forbid identical f1-e2 transition; Black spends/draws Fog of War. Queen f4 checks White along vacant f3/f2; Black King e7 remains safe.',
  '93. g1-f3: White Knight jumps onto f-file, blocking Queen f4 from King f1; different replacement clears prohibition.',
  '94. End White turn and reset both players card allowances.',
  '95. Fanatic replaces Black move: e6-e3 traverses empty e5/e4/e3, no capture or en passant; draw Under Elf Hill.',
  '96. End Black replacement turn.',
  '97. Masquerade replaces White move: non-Pawn King f1-e2 uses Queen diagonal into empty safe e2; draw Vendetta.',
  '98. End White replacement turn.',
  '99. g8-e8: Black Rook crosses empty f8 to empty e8.',
  '100. End Black turn.',
  '101. b2-f6: White Bishop crosses empty c3/d4/e5 and checks Black King e7.',
  '102. Peace Talks after White move cancels Curse into Black discard; spend own card, draw Coup; h1 Rook regains full range.',
  '103. End White turn; Black remains required to answer Bishop f6 check.',
  '104. d6-f6: Black controls neutral Rook through empty e6 to capture checking Bishop; captor Black.',
  '105. End Black turn with King safe.',
  '106. f6-b6: White controls neutral Rook through empty e6/d6/c6.',
  '107. End White turn.',
  '108. b6-h6: Black controls neutral Rook through c6/d6/e6/f6/g6 and captures own Knight h6; captor Black.',
  '109. End Black turn; Neutrality explicitly permits either-color capture.',
  '110. e2-e3: White King captures Black Pawn but lands on Queen f4 diagonal; provisional move requires same-turn rescue.',
  '111. Coup after move makes e3 King a capturable Prince and safe Pawn a4 the royal piece; c4 Pawn blocks Queen f4-a4 ray; retain card/draw Betrayal and clear rescue.',
  '112. End White turn with royalty on a4 Pawn.',
  '113. a6-c7: Black Knight jumps two files and one rank.',
  '114. End Black turn.',
  '115. a1-f1: White Rook crosses empty b1/c1/d1/e1; royal Pawn remains safe.',
  '116. End White turn.',
  '117. f4-h4: Black Queen crosses empty g4 to empty h4; c4 Pawn still blocks ray to royal a4.',
  '118. End Black turn.',
  '119. d2-d3: White Pawn advances one; cannot expose royal Pawn a4.',
  '120. End White turn.',
  '121. h6-h7: Black controls neutral Rook one square; f7 Pawn blocks its rank ray to Black King e7.',
  '122. End Black turn; all pending choices closed and White begins next turn.',
];

const opposite = (c: Color): Color => c === 'white' ? 'black' : 'white';
const at = (pieces: PieceState[], square: string) => pieces.find(p => p.square === square && p.zone === 'board');
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1])] as const;
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean, role = piece.role): boolean {
  const [x, y] = xy(piece.square!); const [tx, ty] = xy(to);
  const dx = tx - x; const dy = ty - y; const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (!distance) return false;
  if (role === 'knight') return Math.abs(dx) * Math.abs(dy) === 2;
  if (role === 'king') return distance === 1;
  if (role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    if (capture) return Math.abs(dx) === 1 && dy === forward;
    return dx === 0 && (dy === forward || dy === 2 * forward && (piece.owner === 'white' ? y <= 2 : y >= 7)
      && !at(pieces, `${piece.square![0]}${y + forward}`));
  }
  const diagonal = Math.abs(dx) === Math.abs(dy); const straight = dx === 0 || dy === 0;
  if (!(role === 'bishop' ? diagonal : role === 'rook' ? straight : diagonal || straight)) return false;
  for (let d = 1; d < distance; d++) if (at(pieces, `${String.fromCharCode(97 + x + Math.sign(dx) * d)}${y + Math.sign(dy) * d}`)) return false;
  return true;
}
function unsafe(pieces: PieceState[], color: Color, curse: boolean, challenge: boolean): boolean {
  const king = pieces.find(p => p.owner === color && p.royal)!;
  assert.ok(king.square);
  return pieces.some(p => {
    if (p.zone !== 'board' || p.id === king.id || p.owner === color && !p.neutral) return false;
    if (challenge && opposite(color) === 'white' && p.id !== 'white-pawn-h2') return false;
    if (curse && p.id === 'white-rook-h1') {
      const [x,y] = xy(p.square!); const [tx,ty] = xy(king.square!);
      if (Math.max(Math.abs(tx-x),Math.abs(ty-y)) > 2) return false;
    }
    if (!geometry(pieces,p,king.square!,true)) return false;
    if (!p.neutral) return true;
    // §11.7/15.1: a neutral capture must preserve the acting controller's King.
    const hypothetical = structuredClone(pieces).filter(q => q.id !== king.id);
    hypothetical.find(q => q.id === p.id)!.square = king.square;
    const controllerKing = hypothetical.find(q => q.owner === opposite(color) && q.royal)!;
    return !hypothetical.some(q => q.zone === 'board' && q.owner === color && !q.neutral
      && geometry(hypothetical,q,controllerKing.square!,true));
  });
}

test('iteration 120 independently derived physical state and obligations for every action', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/120.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, trace.steps.length);
  assert.equal(trace.moves, 50);
  let state = createGameState(trace.initial);
  const expected = structuredClone(state);
  const saved = new Map<number, GameState>();
  let half = 0; let full = 1; let fenColor = 'w'; let rights = 'KQkq';
  const byId = (id: string) => { const p = expected.pieces.find(p => p.id === id); assert.ok(p); return p; };
  const relocate = (from: string, to: SquareName) => { const p=at(expected.pieces,from); assert.ok(p); p.square=to; };
  const capture = (p: PieceState, actor: Color) => { assert.equal(p.royal,false); p.square=null; p.zone='captured'; p.capturedBy=actor; };
  const finishMove = (pawnOrCapture: boolean) => {
    half=pawnOrCapture?0:half+1; full+=expected.turn.color==='black'?1:0;
    fenColor=expected.turn.color==='white'?'b':'w'; expected.turn.phase='afterMove'; expected.turn.moveMade=true; expected.enPassant=[];
  };
  for (const [index, { action }] of trace.steps.entries()) {
    const n=index+1; const message=rationales[index]!; assert.ok(message.startsWith(`${n}.`));
    const before=structuredClone(state); saved.set(n,before); const actor=expected.turn.color;
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.to,/^[a-h][1-8]$/); assert.equal(action.promotion,undefined);
      const p=at(expected.pieces,action.from); assert.ok(p,message);
      const victim=at(expected.pieces,action.to); assert.ok(p.owner===actor||p.neutral,message);
      if(victim) assert.ok(p.neutral||victim.neutral||victim.owner!==actor,message);
      assert.ok(geometry(expected.pieces,p,action.to,!!victim),message);
      if(n===41) { assert.equal(p.id,'white-pawn-h2'); expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='challenge'); }
      if(p.id==='black-rook-a8') rights=rights.replace('q','');
      if(p.id==='black-rook-h8') rights=rights.replace('k','');
      if(p.id==='white-king-e1') rights=rights.replace(/[KQ]/g,'');
      if(victim) capture(victim,actor);
      finishMove(p.role==='pawn'||!!victim);
      if(p.role==='pawn'&&Math.abs(Number(action.to[1])-Number(action.from[1]))===2) expected.enPassant=[{target:`${action.from[0]}${(Number(action.to[1])+Number(action.from[1]))/2}` as SquareName,pawnId:p.id}];
      p.square=action.to as SquareName;
    } else if(action.type==='endTurn') {
      assert.equal(expected.turn.moveMade,true,message);
      expected.turn={color:opposite(actor),phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
    } else if(action.type==='namePiece') {
      assert.equal(n,10); assert.equal(action.speaker,'white'); assert.equal(action.name,'queen');
      assert.deepEqual(action.losses,[{effectId:'black-hand-1-doomsayer',pieceId:'white-queen-d1'}]);
      capture(byId('white-queen-d1'),'black'); half=0;
      expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='doomsayer');
      expected.players.black.discard.push({id:'black-hand-1-doomsayer',cardId:'doomsayer'});
    } else if(action.type==='revealAbduction') { assert.equal(n,68); }
    else if(action.type==='answerAbduction') {
      assert.equal(n,69); assert.deepEqual(action,{type:'answerAbduction',player:'white',owner:'white',role:'pawn',square:'f4',pieceId:'white-pawn-f2'});
      Object.assign(byId('white-pawn-f2'),{zone:'board',square:'f4'});
    } else if(action.type==='playCard') {
      const owner:Color=n===92?'black':actor; const player=expected.players[owner];
      const card=player.hand.find(c=>c.id===action.cardInstanceId); assert.ok(card,message);
      assert.equal(expected.turn.cardPlays[owner],0,message);
      const replacement=['evangelists','forced-march','assassin','fanatic','masquerade'].includes(card.cardId);
      assert.equal(expected.turn.phase,replacement?'beforeMove':'afterMove',message);
      player.hand=player.hand.filter(c=>c.id!==card.id); player.hand.push(player.deck.shift()!);
      expected.turn.cardPlays[owner]++;
      if(!['neutrality','doomsayer','curse','coup'].includes(card.cardId)) player.discard.push(card);
      switch(card.cardId) {
        case 'neutrality': assert.equal(action.target,'a8'); Object.assign(byId('black-rook-a8'),{neutral:true,neutralBeforeEffects:false}); expected.effects.push({type:'neutrality',owner,card,pieceId:'black-rook-a8'}); break;
        case 'doomsayer': expected.effects.push({type:'doomsayer',owner,card}); break;
        case 'evangelists': assert.deepEqual(action.target,{own:'f1',opponent:'c8'}); byId('white-bishop-f1').square='c8'; byId('black-bishop-c8').square='f1'; finishMove(false); break;
        case 'challenge': assert.equal(action.target,'h3'); assert.ok(geometry(expected.pieces,byId('white-pawn-h2'),'h4',false)); expected.effects.push({type:'challenge',owner,player:'white',pieceId:'white-pawn-h2'}); break;
        case 'curse': assert.equal(action.target,'h1'); expected.effects.push({type:'curse',owner,card,pieceId:'white-rook-h1'}); break;
        case 'forced-march': assert.deepEqual(action.target,[{from:'c7',to:'d7'},{from:'d5',to:'c5'}]); assert.equal(at(expected.pieces,'d7'),undefined); assert.equal(at(expected.pieces,'c5'),undefined); relocate('c7','d7'); relocate('d5','c5'); finishMove(true); break;
        case 'cathedral': {
          const [rook,bishop]=n===61?['c8','d3']:['d3','c1']; assert.deepEqual(action.target,{rook,bishop});
          const r=at(expected.pieces,rook)!; const b=at(expected.pieces,bishop)!; assert.equal(r.role,'rook');assert.equal(b.role,'bishop');
          r.square=bishop as SquareName;b.square=rook as SquareName;
          if(n===64) { assert.ok(unsafe(expected.pieces,'white',true,false),message); r.square=rook as SquareName;b.square=bishop as SquareName; }
          break;
        }
        case 'abduction': assert.equal(action.target,'f4'); Object.assign(byId('white-pawn-f2'),{zone:'away',square:null}); break;
        case 'assassin': {
          assert.deepEqual(action.target,[{from:'f1',to:'g1'}]); const hypothetical=structuredClone(expected.pieces);
          const victim=at(hypothetical,'g1')!;capture(victim,'white');at(hypothetical,'f1')!.square='g1';
          assert.ok(unsafe(hypothetical,'white',true,false),message);finishMove(false);break;
        }
        case 'think-again': expected.pieces=structuredClone(saved.get(91)!.pieces); half=0;fenColor='w';expected.turn.phase='beforeMove';expected.turn.moveMade=false;expected.enPassant=[];break;
        case 'fanatic': assert.equal(action.target,'e6'); for(const sq of ['e5','e4','e3']) assert.equal(at(expected.pieces,sq),undefined);relocate('e6','e3');finishMove(true);break;
        case 'masquerade': assert.deepEqual(action.target,[{from:'f1',to:'e2'}]);assert.equal(at(expected.pieces,'e2'),undefined);assert.ok(geometry(expected.pieces,byId('white-king-e1'),'e2',false,'queen'));relocate('f1','e2');finishMove(false);break;
        case 'peace-talks': assert.equal(action.target,'black-hand-4-curse');expected.effects=expected.effects.filter(e=>(e as {type:string}).type!=='curse');expected.players.black.discard.push({id:'black-hand-4-curse',cardId:'curse'});break;
        case 'coup': assert.equal(action.target,'a4');byId('white-king-e1').royal=false;byId('white-pawn-a2').royal=true;expected.effects.push({type:'coup',owner,card,princeId:'white-king-e1',kingId:'white-pawn-a2',princeRole:'king'});break;
        default: assert.fail(`unreviewed card ${card.cardId}`);
      }
    } else assert.fail(`unreviewed action ${action.type}`);
    const result=applyAction(state,action);assert.deepEqual(state,before,`${message}: complete input immutability`);assert.ok(result.ok,message);state=result.state;
    assert.deepEqual(state.pieces,expected.pieces,`${message}: all physical pieces, including unchanged identities and captors`);
    assert.deepEqual(state.players,expected.players,`${message}: complete card zones and deck order`);
    assert.deepEqual(state.effects,expected.effects,`${message}: full effect records`);
    assert.deepEqual(state.turn,expected.turn,`${message}: actor, allowance and phase`);
    assert.deepEqual(state.enPassant,expected.enPassant,message);
    const encoded=state.fen.split(' ');assert.deepEqual(encoded.slice(1),[fenColor,rights||'-','-',String(half),String(full)],`${message}: FEN metadata`);
    const symbols={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
    const board=Array.from({length:8},(_,rank)=>Array.from({length:8},(_,file)=>{
      const piece=at(expected.pieces,`${String.fromCharCode(97+file)}${8-rank}`);if(!piece)return '1'; const s=symbols[piece.role];return piece.owner==='white'?s.toUpperCase():s;
    }).join('').replace(/1+/g,s=>String(s.length))).join('/');assert.equal(encoded[0],board,message);
    assert.equal(state.orientation,0);assert.equal(state.outcome,null);
    assert.equal(state.underElfHill,undefined,`${message}: no pending King return`);
    assert.deepEqual(state.plotsAllowances??[],[],`${message}: no additional card allowance`);
    assert.equal(state.plotsExecution,undefined,`${message}: no pending Plots execution`);
    // Panic is represented by an effect in the public API, not a pendingPanic field.
    assert.equal(state.effects.some(e=>typeof e==='object'&&e!==null&&'type' in e&&e.type==='panic'),false,`${message}: no Panic obligation`);
    assert.equal(!!state.pendingRescue,n===110,message);
    if(n===110) { assert.deepEqual(state.pendingRescue,{before,fen:before.fen,pieces:before.pieces,enPassant:[],movedPieceIds:['white-king-e1'],historyLength:before.history.length}); }
    assert.deepEqual(state.pendingDoomsayer??null,n===9?{player:'white',cardInstanceId:'black-hand-1-doomsayer'}:null,message);
    if(n===67||n===68) {
      const pending=state.pendingAbduction;assert.ok(pending);assert.deepEqual(pending,{phase:n===67?'concealment':'recall',player:'white',durationMs:10000,pieceId:'white-pawn-f2',requiresPieceId:false,before:saved.get(67)},message);
    } else assert.equal(state.pendingAbduction??null,null,message);
    assert.deepEqual(state.chaosForbidden,n===92?{player:'white',movement:'white-king-e1:f1:e2'}:undefined,message);
    if(n===67||n===68||n===92) {
      assert.equal(unsafe(expected.pieces,'white',true,false),n===92,`${message}: White royal check status`);
      assert.equal(unsafe(expected.pieces,'black',true,false),false,`${message}: Black royal check status`);
    } else assert.equal(unsafe(expected.pieces,actor,n>=44&&n<102,n>=39&&n<41),n===110,`${message}: independent royal safety`);
    if(n===64||n===71) assert.ok(state.history.some(e=>e.type==='cardFizzled'&&e.reason==='SELF_CHECK'),message);
  }
  assert.equal(state.fen,'2b1r3/1pnpkp1r/8/2p2p1P/P1P4q/b2PKN2/8/5R1R w - - 1 28');
});

test('iteration 120 deterministic replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/120.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.moves, 50);
  assert.ok(replayTrace(trace));
});
