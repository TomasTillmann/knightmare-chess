import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/146.json', import.meta.url), 'utf8')) as RandomTrace;

// Independently reviewed in order against rules §§8–11, 19.2, 22.3–22.8 and
// the printed timing/classification in catalog.ts. No generated deltas are oracles.
const rationales = `
1. White f2-f4 crosses vacant f3; double Pawn move records f3, with no Black captor.
2. End White turn; preserve f3 opportunity and clocks, enable Black.
3. Black d7-d6 advances one empty square; expires f3 and advances fullmove.
4. End Black turn; White receives its move, no card or board change.
5. White a2-a3 advances one empty square and resets halfmove.
6. End White turn with both Kings safe and no obligations.
7. Black e7-e5 crosses empty e6; e6 opportunity has no White captor.
8. End Black turn; keep e6 opportunity and all pieces.
9. Evangelists exchanges White c1 Bishop with Black f8 Bishop, retaining ownership; replacement move clears EP, spends/draws once.
10. End White replacement turn; Bishop swap persists and allowances reset.
11. Black f7-f6 advances to empty f6; no capture and Pawn clock reset.
12. After its move Black curses the opposing h1 Rook; effect card remains active, one replacement drawn, no movement or clock change.
13. End Black turn; Curse follows the physical h1 Rook and White may move.
14. White e2-e4 crosses empty e3; e3 opportunity is uncapturable.
15. End White turn preserving e3 opportunity and Curse.
16. Black f6-f5 advances one empty square, clearing e3.
17. End Black turn; neither King is attacked.
18. White h2-h4 crosses empty h3; h3 opportunity has no adjacent enemy Pawn.
19. End White turn preserving h3 opportunity and the active Curse.
20. Black Queen d8-g5 has clear diagonal e7,f6; no capture, EP expires.
21. End Black turn; Queen g5 gives no royal check.
22. White cursed Rook h1-h2 moves one square, within its two-square limit; loses K castling right.
23. End White turn; remaining Qkq rights persist.
24. Black Queen g5-h6 moves one diagonal square to an empty destination.
25. End Black turn with unchanged board and clocks.
26. White Queen d1-c1 captures the exchanged Black f8 Bishop; Black identity becomes capturedBy White.
27. End White turn retaining captured Bishop and Qkq rights.
28. Black Knight g8-f6 makes a legal 1-by-2 jump to an empty square.
29. End Black turn; White receives a fresh card allowance.
30. White c2-c4 crosses vacant c3; records uncapturable c3 opportunity.
31. End White turn preserving c3 until Black moves.
32. Black Knight f6-g8 jumps back; clears c3 and increments quiet clock.
33. End Black turn; Knight retains its physical g8 identity.
34. White cursed Rook h2-h1 moves one square; K castling right does not return.
35. White Peace Talks cancels the exact Black Curse, discards it to Black and itself to White, draws Masquerade; Rook is ordinarily legal.
36. End White turn; no continuing effects or correction obligations remain.
37. Black Knight g8-e7 jumps to an empty square.
38. End Black turn with both Kings safe.
39. White King e1-f2 moves one diagonal square to safety and revokes Q, leaving kq.
40. End White turn; the royal identity remains the original e1 King at f2.
41. Black g7-g6 advances to an empty square and resets the Pawn clock.
42. End Black turn with kq retained.
43. White b2-b4 crosses vacant b3; records b3 but no Black Pawn can capture it.
44. End White turn preserves that raw opportunity.
45. Black Masquerade moves its non-Pawn Queen h6-g5 one diagonal square without capture; replaces the move and clears EP.
46. End Black replacement turn; White may move and allowances reset.
47. White a3-a4 advances into an empty square.
48. End White turn; no Pawn promotion or capture occurs.
49. Black e5-f4 captures White original f2 Pawn by forward diagonal, recording Black captor.
50. End Black turn retaining the White Pawn in captured zone.
51. White Rook a1-a2 moves vertically to an empty square; already absent White castling rights stay absent.
52. End White turn with both Kings safe.
53. Black Knight e7-c6 makes a 2-by-1 jump into an empty square.
54. End Black turn; no card expenditure.
55. White Queen c1-e1 slides across empty d1 to empty e1.
56. End White turn with quiet clock three.
57. Black Queen g5-g4 slides one file square to an empty destination.
58. End Black turn; Queen g4 does not attack King f2.
59. White Bishop f8-d6 crosses now-empty e7 and captures Black original d7 Pawn; White is captor.
60. End White turn preserving captured Black d7 Pawn.
61. Black Knight c6-d8 jumps into empty d8.
62. End Black turn without moving or drawing.
63. White Bishop d6-e7 moves one diagonal square to an empty square.
64. End White turn; Black King e8 is not attacked by adjacent e7 Bishop.
65. Black g6-g5 advances one empty square.
66. End Black turn; White may use a replacement move.
67. Blessing moves White original b2 Pawn b4-c5 as a Bishop without capture; Pawn clock resets, no promotion, card spent and replaced.
68. End White replacement turn preserving c5 Pawn identity.
69. Black g5-h4 captures White original h2 Pawn by forward diagonal, recording Black captor.
70. End Black turn; the h2 Pawn is captured and eligible for later return.
71. White e4-f5 captures Black original f7 Pawn by forward diagonal; White captor and Pawn clock reset.
72. End White turn; all captured identities persist.
73. Black Tournament exchanges its b8 Knight with White b1 Knight without capture; retains both owners and replaces the move.
74. End Black replacement turn; White Knight now b8, Black original b8 Knight now b1.
75. White Queen e1-e5 slides through empty e2,e3,e4; its Bishop e7 still blocks its e-file attack on Black King e8.
76. White Abduction conceals opposing nonroyal h4 Pawn in away zone after moving; no capture, clocks unchanged, one draw and concealment obligation.
77. Reveal Abduction advances only its challenge from concealment to recall; retains original board checkpoint and ten-second timer.
78. Black exactly identifies its Pawn h4 and physical g7 identity; restores it without capture or further expenditure and clears the challenge.
79. End White turn after correct recall; no mandatory choice remains.
80. Black Knight d8-e6 jumps to an empty square.
81. End Black turn; White may return a captured Pawn.
82. White Winged Victory returns its captured h2 Pawn to vacant central d4; clears capturedBy, resets Pawn clock, replaces move, draws Lost Castle.
83. Black Vulture immediately takes that physical Winged Victory from White discard, discards top undrawn No Quarter, spends itself and draws Breakthrough; six-card hand.
84. End White turn; Vulture reaction consumes no upcoming Black move or allowance.
85. Black h7-h5 crosses empty h6; records h6 but no White Pawn can capture there.
86. End Black turn preserving h6 opportunity.
87. White Rook a2-c2 crosses empty b2 to empty c2; expires h6.
88. End White turn; no King is in check.
89. Black Knight e6-d4 captures the returned White h2 Pawn; same Pawn recaptured by Black.
90. End Black turn with the recaptured Pawn off-board.
91. White Bishop e7-g5 crosses empty f6; vacates e7, opening Queen e5-e8 through e6,e7 and checking Black King.
92. End White turn is legal with Black checked; Black must answer on its own turn.
93. Black King e8-f7 steps diagonally out of the e-file check onto unattacked f7 and revokes kq.
94. End Black turn; both Kings safe and castling rights absent.
95. White Queen e5-e4 moves one file square to empty e4.
96. End White turn with unchanged card zones.
97. Black King f7-f8 moves one safe square; castling rights remain absent.
98. End Black turn; White receives its Regular Move.
99. White Queen e4-e1 slides through empty e3,e2 to empty e1.
100. End White turn with quiet clock five.
101. Black original b8 Knight b1-c3 jumps to empty c3.
102. End Black turn; this Knight retains its exchanged identity.
103. White g2-g3 advances one empty square, resetting the Pawn clock.
104. End White turn; Black may play its acquired Winged Victory.
105. Black spends White-origin Winged Victory from its own hand to return its captured d7 Pawn at vacant central e4; clears White captor, draws Earthquake, advances fullmove.
106. End Black replacement turn; returned Pawn keeps Black original ownership.
107. White Queen e1-e2 slides one file square to an empty destination.
108. End White turn; neither King is attacked.
109. Black original b8 Knight c3-d1 makes a 1-by-2 jump to empty d1 and checks White King f2 by its d1-f2 Knight jump.
110. End Black turn retaining the checking Knight at d1; White must answer its check.
111. White Queen e2-d1 captures the checking Knight diagonally, removing White check and recording White as captor.
112. End White turn; captured Knight stays off-board.
113. Black original g8 Knight d4-f3 jumps to empty f3; it does not attack White King f2.
114. End Black turn with both Kings safe.
115. White g3-h4 captures Black original g7 Pawn by forward diagonal; no EP or promotion, White captor.
116. End White turn retaining the captured g7 Pawn off-board.
117. Black King f8-g8 moves horizontally one safe square; no castling rights return.
118. End Black turn; White to move at fullmove29, halfmove1, no outstanding obligations.
`.trim().split('\n');

const coords = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
const other = (color: Color): Color => color === 'white' ? 'black' : 'white';

test('iteration 146: independent physical, geometry, royal, FEN, card and obligation oracle', () => {
  assert.equal(trace.seed, 860146);
  assert.equal(trace.steps.length, 118);
  assert.equal(rationales.length, trace.steps.length);
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  const turn = structuredClone(state.turn);
  let effects: unknown[] = [];
  let ep: GameState['enPassant'] = [];
  let rights = 'KQkq', active: Color = 'white', half = 0, full = 1;
  let pending: GameState['pendingAbduction'] = null;
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
  const byId = (id: string) => { const p = pieces.find(p => p.id === id); assert.ok(p); return p; };
  const geometry = (piece: PieceState, destination: string, capture: boolean, role = piece.role): boolean => {
    assert.ok(piece.square);
    const [x,y] = coords(piece.square), [u,v] = coords(destination);
    const dx = u-x, dy = v-y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (!ax && !ay) return false;
    if (effects.length && piece.id === 'white-rook-h1' && Math.max(ax, ay) > 2) return false;
    if (role === 'knight') return ax * ay === 2;
    if (role === 'king') return Math.max(ax,ay) === 1;
    if (role === 'pawn') {
      const direction = piece.owner === 'white' ? 1 : -1;
      if (capture) return ax === 1 && dy === direction;
      if (dx !== 0 || at(destination)) return false;
      if (dy === direction) return true;
      return y === (piece.owner === 'white' ? 1 : 6) && dy === 2*direction
        && !at(`${String.fromCharCode(x+97)}${y+direction+1}`);
    }
    const aligned = role === 'bishop' ? ax === ay : role === 'rook' ? !dx || !dy : ax === ay || !dx || !dy;
    if (!aligned) return false;
    for (let i=1; i<Math.max(ax,ay); i++) {
      if (at(`${String.fromCharCode(x+97+i*Math.sign(dx))}${y+1+i*Math.sign(dy)}`)) return false;
    }
    return true;
  };
  const threatened = (color: Color) => {
    const king = pieces.find(p => p.owner === color && p.royal)!;
    assert.ok(king.square);
    return pieces.some(p => p.zone === 'board' && p.owner !== color && geometry(p, king.square!, true));
  };
  const boardFen = () => Array.from({length:8}, (_,r) => {
    let empty=0, line='';
    for (let f=0;f<8;f++) {
      const p=at(`${String.fromCharCode(97+f)}${8-r}`);
      if (!p) {empty++;continue;}
      if (empty) {line+=empty;empty=0;}
      const symbol={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}[p.role];
      line+=p.owner==='white'?symbol.toUpperCase():symbol;
    }
    return line+(empty||'');
  }).join('/');
  const completeMove = (pawn: boolean, capture = false) => {
    half=pawn||capture?0:half+1;
    if (turn.color==='black') full++;
    active=other(turn.color); turn.phase='afterMove'; turn.moveMade=true; ep=[];
  };
  for (const [i, {action}] of trace.steps.entries()) {
    const step=i+1, label=rationales[i]!;
    assert.ok(label.startsWith(`${step}. `));
    if (action.type==='move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      const from=action.from, to=action.to;
      assert.match(to,/^[a-h][1-8]$/);
      assert.equal(action.promotion,undefined);
      assert.equal(turn.moveMade,false,label);
      const piece=at(from), victim=at(to);
      assert.ok(piece,label); assert.equal(piece.owner,turn.color,label);
      assert.ok(geometry(piece,to,!!victim),label);
      if (victim) {
        assert.notEqual(victim.owner,piece.owner,label); assert.equal(victim.royal,false);
        victim.zone='captured';victim.square=null;victim.capturedBy=turn.color;
      }
      const [x,y]=coords(from), [,v]=coords(to);
      completeMove(piece.role==='pawn',!!victim);
      if (piece.role==='pawn' && Math.abs(v-y)===2) ep=[{target:`${String.fromCharCode(x+97)}${(v+y)/2+1}` as SquareName,pawnId:piece.id}];
      if (piece.royal) rights=rights.replace(piece.owner==='white'?/[KQ]/g:/[kq]/g,'');
      if (piece.id==='white-rook-h1') rights=rights.replace('K','');
      if (piece.id==='white-rook-a1') rights=rights.replace('Q','');
      piece.square=to as SquareName;
    } else if (action.type==='endTurn') {
      assert.ok(turn.moveMade,label); assert.equal(pending,null,label);
      assert.equal(threatened(turn.color),false,label);
      turn.color=other(turn.color);turn.phase='beforeMove';turn.moveMade=false;
      turn.cardPlays={white:0,black:0};
    } else if (action.type==='playCard') {
      const owner: Color=step===83?'black':turn.color;
      const player=players[owner];
      const cardIndex=player.hand.findIndex(c=>c.id===action.cardInstanceId);
      assert.ok(cardIndex>=0,label);
      const card=player.hand.splice(cardIndex,1)[0]!;
      assert.equal(card.cardId,action.cardId);assert.equal(turn.cardPlays[owner],0,label);
      turn.cardPlays[owner]++;
      if (step===83) {
        assert.equal(action.target,undefined);
        assert.deepEqual(trace.steps[i-1]!.action,{type:'playCard',cardId:'winged-victory',cardInstanceId:'white-deck-2-winged-victory',target:{pieceId:'white-pawn-h2',to:'d4'}});
        assert.equal(turn.color,'white');assert.equal(turn.moveMade,true);
        player.discard.push(player.deck.shift()!);
      }
      if (action.cardId!=='curse') player.discard.push(card);
      player.hand.push(player.deck.shift()!);
      if (action.cardId==='curse') {
        assert.equal(turn.phase,'afterMove');assert.equal(action.target,'h1');
        assert.equal(at('h1')?.role,'rook');assert.equal(at('h1')?.owner,'white');
        effects=[{type:'curse',owner:'black',card,pieceId:'white-rook-h1'}];
      } else if (action.cardId==='peace-talks') {
        assert.equal(turn.phase,'afterMove');assert.equal(action.target,'black-hand-1-curse');
        players.black.discard.push({id:'black-hand-1-curse',cardId:'curse'});effects=[];
      } else if (action.cardId==='vulture') {
        const stolen=players.white.discard.pop()!;
        assert.deepEqual(stolen,{id:'white-deck-2-winged-victory',cardId:'winged-victory'});
        player.hand.push(stolen);
      } else if (action.cardId==='abduction') {
        assert.equal(turn.phase,'afterMove');assert.equal(action.target,'h4');
        const piece=at('h4')!;assert.equal(piece.id,'black-pawn-g7');assert.equal(piece.royal,false);
        pending={phase:'concealment',player:'black',durationMs:10000,pieceId:piece.id,requiresPieceId:false,before:structuredClone(state)};
        piece.square=null;piece.zone='away';
      } else {
        assert.equal(turn.phase,'beforeMove');assert.equal(turn.moveMade,false);
        if (action.cardId==='evangelists'||action.cardId==='tournament') {
          const own=action.cardId==='evangelists'?'c1':'b8', opponent=action.cardId==='evangelists'?'f8':'b1';
          assert.deepEqual(action.target,{own,opponent});
          const a=at(own)!,b=at(opponent)!;
          assert.equal(a.owner,owner);assert.equal(b.owner,other(owner));
          assert.equal(a.role,action.cardId==='evangelists'?'bishop':'knight');assert.equal(b.role,a.role);
          [a.square,b.square]=[b.square,a.square];completeMove(false);
        } else if (action.cardId==='blessing'||action.cardId==='masquerade') {
          const from=action.cardId==='blessing'?'b4':'h6',to=action.cardId==='blessing'?'c5':'g5';
          assert.deepEqual(action.target,[{from,to}]);
          const piece=at(from)!;assert.equal(piece.owner,owner);assert.equal(at(to),undefined);
          assert.ok(geometry(piece,to,false,action.cardId==='blessing'?'bishop':'queen'));
          if(action.cardId==='masquerade')assert.notEqual(piece.originalRole,'pawn');
          completeMove(piece.originalRole==='pawn');piece.square=to;
        } else if(action.cardId==='winged-victory') {
          const pieceId=step===82?'white-pawn-h2':'black-pawn-d7',to=step===82?'d4':'e4';
          assert.deepEqual(action.target,{pieceId,to});
          const piece=byId(pieceId);assert.equal(piece.owner,owner);assert.equal(piece.zone,'captured');
          assert.equal(piece.capturedBy,other(owner));
          assert.equal(piece.originalRole,'pawn');assert.equal(piece.promoted,false);assert.equal(at(to),undefined);
          piece.zone='board';piece.square=to;delete piece.capturedBy;completeMove(true);
        } else assert.fail(`Unreviewed card: ${action.cardId}`);
      }
    } else if(action.type==='revealAbduction') {
      assert.ok(pending);assert.equal(pending.phase,'concealment');pending.phase='recall';
    } else if(action.type==='answerAbduction') {
      assert.ok(pending);assert.equal(pending.phase,'recall');
      assert.deepEqual(action,{type:'answerAbduction',player:'black',owner:'black',role:'pawn',square:'h4',pieceId:'black-pawn-g7'});
      const piece=byId('black-pawn-g7');piece.zone='board';piece.square='h4';pending=null;
    } else assert.fail(`Unreviewed action: ${action.type}`);

    const inputSnapshot: GameState=structuredClone(state);
    const result=applyAction(state,action);
    assert.deepEqual(state,inputSnapshot,`${label}: input immutability`);
    assert.ok(result.ok,label);state=result.state;
    assert.deepEqual(state.pieces,pieces,`${label}: physical identities/captors`);
    assert.deepEqual(state.players,players,`${label}: all physical card zones`);
    assert.deepEqual(state.turn,turn,`${label}: timing and allowances`);
    assert.deepEqual(state.effects,effects,`${label}: complete continuing records`);
    assert.deepEqual(state.enPassant,ep,`${label}: raw EP opportunities`);
    // Every double-step in this trace has no adjacent eligible capturing Pawn.
    for(const opportunity of ep) assert.equal(pieces.some(p=>p.zone==='board'&&p.owner===active&&p.role==='pawn'&&geometry(p,opportunity.target,true)),false,label);
    assert.equal(state.fen,`${boardFen()} ${active[0]} ${rights||'-'} - ${half} ${full}`,`${label}: all six FEN fields`);
    assert.deepEqual(state.pendingAbduction??null,pending,`${label}: full challenge checkpoint`);
    assert.equal(state.pendingRescue??null,null,label);assert.equal(state.pendingDoomsayer??null,null,label);
    assert.deepEqual(state.underElfHill??[],[],label);
    assert.equal(state.chaosForbidden??null,null,label);assert.equal(state.plotsExecution??null,null,label);
    assert.deepEqual(state.plotsAllowances??[],[],label);assert.equal(state.fogLocked??false,false,label);
    assert.deepEqual(state.riposteLostMoves??[],[],label);assert.equal(state.riposteSkipped??null,null,label);
    assert.equal(state.riposteCheckDeferred??null,null,label);
    assert.equal(state.orientation,0);assert.equal(state.outcome,null);
    for(const color of ['white','black'] as const) {
      const expectedCheck=color==='black'?(step===91||step===92):(step===109||step===110);
      assert.equal(threatened(color),expectedCheck,`${label}: independent ${color} royal geometry`);
      assert.equal(isKingInCheck(state,color),expectedCheck,`${label}: engine ${color} check agrees`);
    }
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,10);
  assert.equal(state.fen,'rNb3kr/ppp5/8/2P2PBp/P1P1ppqP/5n2/2RP1K2/3Q1BNR w - - 1 29');
});

test('iteration 146: deterministic replay', () => {
  assert.ok(replayTrace(trace));
});
