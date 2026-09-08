import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, Color, GameEvent, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Explicit action-by-action review. The adjacent assertions independently construct
// physical identities, cards, clocks, attacks and permissions from these commands.
const rationales = [
  '1. f2-f4: clear f3 and f4; initial double Pawn advance.',
  '2. Close White f4; retain f3 opportunity, no Black captor.',
  '3. h7-h5: clear h6 and h5; initial double Pawn advance.',
  '4. Close Black h5; retain h6 opportunity, no White captor.',
  '5. b2-b4: clear b3 and b4; initial double Pawn advance.',
  '6. Close White b4; retain b3 opportunity, no Black captor.',
  '7. Ng8-f6: unobstructed Knight jump to empty f6.',
  '8. Close Black Nf6, reset allowances.',
  '9. Nb1-c3: Knight jump to empty c3.',
  '10. Close White Nc3, reset allowances.',
  '11. h5-h4: single Black Pawn step to empty h4.',
  '12. Close Black h4, reset allowances.',
  '13. Nc3-b1: return Knight to empty b1.',
  '14. Close White Nb1, reset allowances.',
  '15. Nf6-g4: Knight jump to empty g4.',
  '16. Close Black Ng4, reset allowances.',
  '17. h2-h3: single White Pawn step to empty h3.',
  '18. Close White h3, reset allowances.',
  '19. a7-a5: clear a6 and a5; initial double Pawn advance.',
  '20. Close Black a5; a6 opportunity has no White captor on b5.',
  '21. b4xa5: White Pawn captures black-pawn-a7 diagonally.',
  '22. Close White bxa5; capture belongs to White.',
  '23. Rh8-h7: one empty vertical square; revoke Black kingside castling.',
  '24. Close Black Rh7, reset allowances.',
  '25. h3xg4: White Pawn captures black-knight-g8 diagonally.',
  '26. Close White hxg4; capture belongs to White.',
  '27. e7-e6: single Black Pawn step to empty e6.',
  '28. Close Black e6, reset allowances.',
  '29. g4-g5: single White Pawn step to empty g5.',
  '30. Close White g5, reset allowances.',
  '31. Ra8-a7: one empty vertical square; revoke Black queenside castling.',
  '32. Black Fatal Attraction after Ra7 marks own c7 Pawn; retain card, draw Shield.',
  '33. Close Black; c7 magnet continues freezing adjacent nonroyals.',
  '34. e2-e4: clear e3/e4, outside c7 magnet; double step.',
  '35. White Rebirth sends enemy f7 Pawn to vacant original Pawn square e7; e3 raw FEN target survives.',
  '36. Close White; e3 target still has no Black Pawn capture available.',
  '37. c7-c6: magnet itself can move; discard Fatal Attraction and release neighbors.',
  '38. Close Black c6; no magnet remains.',
  '39. c2-c3: single White Pawn advance to empty c3.',
  '40. Close White c3, reset allowances.',
  '41. Qd8-b6: diagonal through now-empty c7.',
  '42. Close Black Qb6, reset allowances.',
  '43. a5-a6: single White Pawn advance to empty a6.',
  '44. Close White a6, reset allowances.',
  '45. g7-g6: single Black Pawn advance to empty g6.',
  '46. Black Mystic Shield protects exactly the g7 physical Pawn just moved to g6.',
  '47. Close Black; Shield remains for White next turn.',
  '48. Ke1-e2: empty safe adjacent square; revoke White castling rights.',
  '49. Close White Ke2; Black Shield expires after protected opponent turn.',
  '50. Rh7-h8: one empty vertical square; castling rights stay revoked.',
  '51. Close Black Rh8, reset allowances.',
  '52. d2-d3: single White Pawn advance to empty d3.',
  '53. Close White d3, reset allowances.',
  '54. Bf8-h6: diagonal through vacant g7.',
  '55. Close Black Bh6, reset allowances.',
  '56. Rh1xh4: through empty h2/h3, capture black-pawn-h7.',
  '57. Close White Rxh4; capture belongs to White.',
  '58. Qb6-d4: diagonal through empty c5.',
  '59. Close Black Qd4, reset allowances.',
  '60. Rh4-h1: clear h3/h2 and empty h1.',
  '61. Close White Rh1, reset allowances.',
  '62. Qd4xd3: capture white-pawn-d2; Queen now checks Ke2 diagonally.',
  '63. Close Black Qxd3; White receives a check escape turn.',
  '64. Ke2-e1: safe empty adjacent square escapes Qd3 check.',
  '65. Close White Ke1; White King safe.',
  '66. Bh6-g7: single diagonal step to empty square.',
  '67. Black Panic after Bg7 imposes 15-second next White move obligation.',
  '68. Close Black; White Panic obligation starts.',
  '69. White Masquerade moves Qd1-f3 through e2 without capture; replacement move satisfies Panic.',
  '70. Close White replacement move; Panic consumed.',
  '71. Qd3-d2: one empty vertical square, checks Ke1 diagonally.',
  '72. Close Black Qd2; White receives check escape turn.',
  '73. Nb1xd2: Knight captures checking black Queen and cures check.',
  '74. Close White Nxd2; White King safe.',
  '75. Rh8-h7: one empty vertical square.',
  '76. Close Black Rh7, reset allowances.',
  '77. Nd2-c4: Knight jump to empty c4.',
  '78. Close White Nc4, reset allowances.',
  '79. Rh7-h8: one empty vertical square.',
  '80. Close Black Rh8, reset allowances.',
  '81. Nc4-a3: Knight jump to empty a3.',
  '82. Close White Na3, reset allowances.',
  '83. Ra7xa6: capture white-pawn-b2 directly below.',
  '84. Close Black Rxa6; capture belongs to Black.',
  '85. Qf3-d3: horizontal through empty e3.',
  '86. Close White Qd3, reset allowances.',
  '87. Rh8xh1: h7 through h2 empty; capture white-rook-h1.',
  '88. Close Black Rxh1; capture belongs to Black.',
  '89. Ke1-d1: empty safe adjacent square.',
  '90. Close White Kd1, reset allowances.',
  '91. Bg7-h8: one diagonal empty square.',
  '92. Close Black Bh8, reset allowances.',
  '93. Bc1-e3: diagonal through vacant d2.',
  '94. White Panic after Be3 imposes 15-second next Black move obligation.',
  '95. Close White; Black Panic obligation starts.',
  '96. Black Panic timeout forfeits turn, advances clocks, leaves board/history unchanged.',
  '97. Squaring the Circle: a1/h1/h8 occupied, a8 sole empty corner; c3 Pawn relocates without promotion.',
  '98. Close White relocation; a8 remains an unpromoted physical Pawn.',
  '99. Black Masquerade moves Ra6-a7 quietly, consuming the Regular Move.',
  '100. Close Black replacement move, reset allowances.',
  '101. White Evangelists swaps Bf1 with enemy Bc8; no capture, no actual moved-piece Shield permission.',
  '102. Close White exchange; both Bishop identities preserved.',
  '103. Bh8xa1: clear g7/f6/e5/d4/c3/b2; capture white-rook-a1.',
  '104. Close Black Bxa1; capture belongs to Black.',
  '105. g2-g3: single White Pawn step to vacant g3.',
  '106. Close White g3, reset allowances.',
  '107. Ba1-f6: clear b2/c3/d4/e5; empty f6.',
  '108. Close Black Bf6, reset allowances.',
  '109. Qd3-d5: clear d4; empty d5.',
  '110. Close White Qd5, reset allowances.',
  '111. Bf1-h3: clear g2; empty h3.',
  '112. Close Black Bh3, reset allowances.',
  '113. Qd5xd7: clear d6, captures black-pawn-d7 and checks Ke8 diagonally.',
  '114. Close White Qxd7; Black receives check escape turn.',
];

const reviewedCards: Record<number, { owner: Color; id: string; cardId: string }> = {
  32: { owner: 'black', id: 'black-hand-4-fatal-attraction', cardId: 'fatal-attraction' },
  35: { owner: 'white', id: 'white-hand-2-rebirth', cardId: 'rebirth' },
  46: { owner: 'black', id: 'black-deck-0-mystic-shield', cardId: 'mystic-shield' },
  67: { owner: 'black', id: 'black-hand-3-panic', cardId: 'panic' },
  69: { owner: 'white', id: 'white-deck-0-masquerade', cardId: 'masquerade' },
  94: { owner: 'white', id: 'white-hand-1-panic', cardId: 'panic' },
  97: { owner: 'white', id: 'white-hand-4-squaring-the-circle', cardId: 'squaring-the-circle' },
  99: { owner: 'black', id: 'black-hand-0-masquerade', cardId: 'masquerade' },
  101: { owner: 'white', id: 'white-deck-2-evangelists', cardId: 'evangelists' },
};

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const coordinates = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const at = (pieces: PieceState[], square: string) => pieces.find(piece => piece.zone === 'board' && piece.square === square);
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  const [x,y] = coordinates(piece.square!), [tx,ty] = coordinates(to), dx = tx-x, dy = ty-y;
  if (!dx && !dy) return false;
  if (piece.role === 'pawn') {
    const forward = piece.owner === 'white' ? 1 : -1;
    return capture ? Math.abs(dx) === 1 && dy === forward : dx === 0 && (dy === forward
      || dy === 2*forward && (piece.owner === 'white' ? y <= 1 : y >= 6)
        && !at(pieces, `${String.fromCharCode(97+x)}${y+1+forward}`));
  }
  if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  const diagonal = Math.abs(dx) === Math.abs(dy), straight = dx === 0 || dy === 0;
  if (!(piece.role === 'queen' ? diagonal || straight : piece.role === 'bishop' ? diagonal : straight)) return false;
  for (let n=1;n<Math.max(Math.abs(dx),Math.abs(dy));n++) {
    if (at(pieces, `${String.fromCharCode(97+x+n*Math.sign(dx))}${y+1+n*Math.sign(dy)}`)) return false;
  }
  return true;
}
function threatened(pieces: PieceState[], color: Color, magnet: string | undefined): boolean {
  const king = pieces.find(piece => piece.royal && piece.owner === color)!;
  return pieces.some(piece => {
    if (piece.zone !== 'board' || piece.owner === color) return false;
    if (magnet && piece.id !== magnet && !piece.royal) {
      const m = pieces.find(item => item.id === magnet)!;
      const [x,y] = coordinates(piece.square!), [mx,my] = coordinates(m.square!);
      if (Math.max(Math.abs(x-mx),Math.abs(y-my)) <= 1) return false;
    }
    return geometry(pieces,piece,king.square!,true);
  });
}
function boardFen(pieces: PieceState[]): string {
  const letters = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' };
  return Array.from({length:8},(_,n) => {
    let text='', empty=0;
    for(let f=0;f<8;f++) {
      const p=at(pieces,`${String.fromCharCode(97+f)}${8-n}`);
      if(!p) empty++;
      else { if(empty) text+=empty; empty=0; text+=p.owner==='white'?letters[p.role].toUpperCase():letters[p.role]; }
    }
    return text+(empty||'');
  }).join('/');
}

test('random campaign iteration 207', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/207.json', import.meta.url), 'utf8')) as RandomTrace;
  replayTrace(trace);
});

test('207 independently reviewed physical state, cards, history, threats and permissions', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/207.json', import.meta.url),'utf8')) as RandomTrace;
  assert.equal(trace.seed,860207);
  assert.equal(trace.steps.length,114);
  assert.equal(rationales.length,trace.steps.length);
  let state=createGameState(trace.initial);
  const pieces=structuredClone(state.pieces), players=structuredClone(state.players);
  const history: GameEvent[]=[], playedCards: NonNullable<GameState['playedCards']>=[];
  let color: Color='white', phase: 'beforeMove'|'afterMove'='beforeMove', made=false;
  let plays={white:0,black:0}, rights='KQkq', half=0, full=1, fenColor='w', ep='-';
  let opportunities: GameState['enPassant']=[], effects: GameState['effects']=[];
  let shield: GameState['shieldMove'], response: GameState['cardResponse'];
  let moveCount=0, cardCount=0;
  for(const [index,step] of trace.steps.entries()) {
    const n=index+1, action=step.action, label=rationales[index]!;
    assert.ok(label.startsWith(`${n}. `));
    const savedState=structuredClone(state), savedAction=structuredClone(action);
    // Public read queries must preserve the entire state and command payload.
    if(action.type==='playCard') cardPlayTargets(state,action.cardId);
    assert.deepEqual(state,savedState,`${label}: query immutability`);
    let magnet=n>=32 && n<37?'black-pawn-c7':undefined;
    if(action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from, to=action.to;
      assert.equal(phase,'beforeMove'); assert.equal(made,false);
      const piece=at(pieces,from)!; assert.ok(piece,label); assert.equal(piece.owner,color);
      const victim=at(pieces,to);
      assert.ok(geometry(pieces,piece,to,!!victim),label);
      assert.ok(!victim || victim.owner!==color && !victim.royal,label);
      if(magnet && !piece.royal && piece.id!==magnet) {
        const [x,y]=coordinates(from), [mx,my]=coordinates(pieces.find(p=>p.id===magnet)!.square!);
        assert.ok(Math.max(Math.abs(x-mx),Math.abs(y-my))>1,label);
      }
      const event: GameEvent={type:'move',from:from as SquareName,to:to as SquareName};
      if(victim) { victim.square=null; victim.zone='captured'; victim.capturedBy=color; event.capturedId=victim.id; }
      // Optional descriptive move identity fields are absent on the early Black rows.
      if(color==='white' || n>=50) { event.movedPieceId=piece.id; event.movedRoles=[piece.role]; }
      history.push(event);
      opportunities=[];
      if(piece.role==='pawn' && Math.abs(Number(to[1])-Number(from[1]))===2)
        opportunities=[{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName,pawnId:piece.id}];
      half=piece.role==='pawn'||victim?0:half+1;
      if(color==='black') full++;
      if(piece.royal) rights=rights.replace(color==='white'?/[KQ]/g:/[kq]/g,'');
      const revoked: Record<string,string>={a1:'Q',h1:'K',a8:'q',h8:'k'};
      if(piece.role==='rook') rights=rights.replace(revoked[from]??'!','');
      piece.square=to as SquareName;
      if(n===37) { players.black.discard.push({id:'black-hand-4-fatal-attraction',cardId:'fatal-attraction'}); effects=[]; magnet=undefined; }
      shield={player:color,pieceIds:[piece.id],capturedOpponent:!!victim};
      response=undefined; fenColor=color==='white'?'b':'w'; ep='-'; phase='afterMove'; made=true; moveCount++;
    } else if(action.type==='playCard') {
      cardCount++;
      const card: CardInstance=players[color].hand.find(c=>c.id===action.cardInstanceId)!;
      assert.ok(card,label); assert.equal(card.cardId,action.cardId); assert.equal(plays[color],0);
      assert.deepEqual({owner:color,id:action.cardInstanceId,cardId:action.cardId},reviewedCards[n],`${label}: exact reviewed physical card`);
      assert.ok(CARD_CATALOG[card.cardId]!.timing.includes(phase),label);
      players[color].hand=players[color].hand.filter(c=>c.id!==card.id);
      players[color].hand.push(players[color].deck.shift()!);
      if(card.cardId!=='fatal-attraction') players[color].discard.push(card);
      plays[color]++; playedCards.push({player:color,cardInstanceId:card.id});
      const event: GameEvent={type:'cardPlayed',cardId:card.cardId,...(action.target===undefined?{}:{target:action.target as GameEvent['target']}),movement:[],preservePreviousMove:phase==='afterMove'};
      if(n===32) { assert.equal(action.target,'c7'); effects=[{type:'fatal-attraction',owner:'black',card,pieceId:'black-pawn-c7'}]; }
      else if(n===35) {
        assert.deepEqual(action.target,[{from:'f7',to:'e7'}]);
        const pawn=at(pieces,'f7')!; assert.equal(pawn.owner,'black'); assert.equal(pawn.role,'pawn'); assert.equal(at(pieces,'e7'),undefined);
        pawn.square='e7'; event.movement=[{from:'f7',to:'e7'}]; ep='e3';
      } else if(n===46) {
        assert.equal(action.target,'g6'); assert.deepEqual(shield?.pieceIds,['black-pawn-g7']);
        effects=[{type:'mystic-shield',owner:'black',player:'black',pieceId:'black-pawn-g7'}]; event.player='black';
      } else if(n===67 || n===94) effects=[{type:'panic',owner:color,player:opposite(color),durationMs:15000}];
      else if(n===69 || n===97 || n===99) {
        const [from,to]=n===69?['d1','f3']:n===97?['c3','a8']:['a6','a7'];
        assert.deepEqual(action.target,[{from,to}]);
        const piece=at(pieces,from)!; assert.equal(piece.owner,color); assert.equal(at(pieces,to),undefined);
        if(n===97) assert.deepEqual(['a1','h1','a8','h8'].filter(s=>!at(pieces,s)),['a8']);
        else { assert.notEqual(piece.role,'pawn'); assert.ok(geometry(pieces,{...piece,role:'queen'},to,false)); }
        piece.square=to as SquareName; half=piece.role==='pawn'?0:half+1;
        if(color==='black') full++;
        event.movement=[{from:from as SquareName,to:to as SquareName}];
        shield={player:color,pieceIds:[piece.id],capturedOpponent:false};
        phase='afterMove'; made=true; fenColor=color==='white'?'b':'w'; opportunities=[]; ep='-'; effects=[];
      } else if(n===101) {
        assert.equal(card.cardId,'evangelists'); assert.deepEqual(action.target,{own:'f1',opponent:'c8'});
        const own=at(pieces,'f1')!, enemy=at(pieces,'c8')!;
        assert.equal(own.owner,'white'); assert.equal(enemy.owner,'black');
        assert.equal(own.role,'bishop'); assert.equal(enemy.role,'bishop');
        own.square='c8'; enemy.square='f1';
        event.movement=[{from:'f1',to:'c8'},{from:'c8',to:'f1'}];
        shield={player:color,pieceIds:[],capturedOpponent:false};
        phase='afterMove'; made=true; half++; fenColor='b'; opportunities=[]; ep='-';
      } else assert.fail(`Unreviewed card ${n}`);
      history.push(event); response={player:color,historyLength:history.length};
      // None of these nine regular/continuing card plays creates check; direct mate cannot arise.
      assert.equal(threatened(pieces,opposite(color),magnet),false,`${label}: card does not give check`);
    } else if(action.type==='endTurn' || action.type==='panicTimeout') {
      if(action.type==='endTurn') { assert.equal(made,true); assert.equal(threatened(pieces,color,magnet),false); }
      else {
        assert.equal(n,96); assert.equal(made,false); assert.equal(color,'black');
        assert.deepEqual(effects,[{type:'panic',owner:'white',player:'black',durationMs:15000}]);
        half++; full++; fenColor='w'; effects=[]; opportunities=[]; ep='-';
      }
      if(n===49) effects=[];
      color=opposite(color); phase='beforeMove'; made=false; plays={white:0,black:0}; shield=undefined; response=undefined;
    } else assert.fail(`Unreviewed action ${n}`);
    const result=applyAction(state,action);
    assert.deepEqual(state,savedState,`${label}: input state unchanged`);
    assert.deepEqual(action,savedAction,`${label}: command unchanged`);
    assert.ok(result.ok,label); state=result.state;
    assert.deepEqual(state.pieces,pieces,`${label}: complete physical pieces and capture actors`);
    assert.deepEqual(state.players,players,`${label}: exact physical hands, decks, discards`);
    assert.deepEqual(state.history,history,`${label}: complete history`);
    assert.deepEqual(state.effects,effects,`${label}: complete effects`);
    assert.deepEqual(state.turn,{color,phase,moveMade:made,cardPlays:plays},`${label}: turn`);
    assert.equal(state.fen,`${boardFen(pieces)} ${fenColor} ${rights||'-'} ${ep} ${half} ${full}`,`${label}: six FEN fields`);
    assert.deepEqual(state.enPassant,opportunities,label);
    assert.deepEqual(state.shieldMove,shield,`${label}: exact movement token`);
    assert.deepEqual(state.cardResponse,response,label);
    assert.deepEqual(state.playedCards??[],playedCards,label);
    for(const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const) assert.equal(state[key],undefined,`${label}: ${key}`);
    for(const key of ['plotsAllowances','fogLocked','riposteLostMoves','underElfHill'] as const) assert.deepEqual(state[key]??[],[],`${label}: ${key}`);
    for(const key of ['pendingRescue','pendingAbduction','pendingDoomsayer'] as const) assert.equal(state[key]??null,null,`${label}: ${key}`);
    assert.equal(state.orientation,0); assert.equal(state.outcome,null);
    for(const royal of ['white','black'] as const) {
      const check=threatened(pieces,royal,magnet);
      assert.equal(check,royal==='white'?[62,63,71,72].includes(n):n>=113,`${label}: independently expected ${royal} check`);
      const snapshot=structuredClone(state);
      assert.equal(isKingInCheck(state,royal),check,label);
      assert.deepEqual(state,snapshot,`${label}: check query immutability`);
    }
    // Every double-step opportunity here lacks an adjacent opposing Pawn. Raw
    // serialization at 35/36 is therefore distinct from legal EP availability.
    if(opportunities.length) {
      const prospective=structuredClone(state);
      const victim=pieces.find(p=>p.id===opportunities[0]!.pawnId)!;
      const captorColor=opposite(victim.owner);
      prospective.turn={color:captorColor,phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      prospective.fen=prospective.fen.replace(/ [wb] /,` ${captorColor==='white'?'w':'b'} `);
      const savedProspective=structuredClone(prospective);
      const destinations=legalDests(prospective);
      assert.deepEqual(prospective,savedProspective,`${label}: prospective EP query immutability`);
      for(const opportunity of opportunities) {
        for(const pawn of pieces.filter(p=>p.zone==='board' && p.role==='pawn' && p.owner===captorColor))
          assert.ok(!destinations.get(pawn.square!)?.includes(opportunity.target),`${label}: no prospective EP destination`);
      }
    }
    for(const opportunity of opportunities) {
      const target=coordinates(opportunity.target);
      const pawn=pieces.find(p=>p.id===opportunity.pawnId)!;
      const captors=pieces.filter(p=>p.zone==='board' && p.role==='pawn' && p.owner!==pawn.owner
        && geometry(pieces,p,opportunity.target,true));
      assert.equal(captors.length,0,`${label}: no geometric en-passant captor at ${target}`);
    }
  }
  assert.equal(moveCount,50); assert.equal(cardCount,9);
  assert.equal(state.fen,'PnB1k3/rp1Qp3/2p1pbp1/6P1/4PP2/N3B1Pb/P7/3K2Nr b - - 0 28');
});
