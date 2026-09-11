// Iteration 087: fresh independent review pending.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { PieceState, SquareName, Color, PlayerState, CardInstance } from '../types.js';

// Independent sequential review of rules §§8–11, 13, 15.3–5, 18.2, 19, 21.1,
// cards.md, and the printed timing metadata in CARD_CATALOG.
const rationales = `
1. Bombard replaces White's move: a1 rook jumps the sole obstruction a2, crosses empty a3–a6 and captures black a7 pawn; a2 survives. Both Kings safe.
2. End White's replacement turn; Black starts with fresh allowances, no extra move or draw.
3. Original g8 knight jumps to empty h6; e8 King remains sheltered.
4. End Black's turn; keep h6 knight and clocks, pass to White.
5. Original g2 pawn advances one to empty g3; no en passant.
6. End White's turn without altering board or hands.
7. Original a8 rook captures the Bombarding original a1 rook on a7; black queenside rights end.
8. End Black's capture turn; captured a1 rook stays captured.
9. Original e2 pawn advances to empty e3; capture clock resets.
10. End White's turn; no optional discard was requested.
11. Original c7 pawn advances to c6; black e8 remains safe.
12. End Black's turn preserving c6 pawn.
13. Original c2 pawn advances to c3; this pawn blocks the future a5–e1 diagonal.
14. End White's turn with c3 occupied and hands unchanged.
15. Original b7 pawn advances through empty b6 to b5; b6 en-passant opportunity begins.
16. After-move Coup makes original b8 knight royal and original e8 King a capturable Prince, preserving both movement roles; continuing card remains active.
17. End Black's Coup turn; b8 is the royal identity and b6 opportunity survives into White's turn.
18. Original a2 pawn advances to a3; foregoing en passant expires b6.
19. End White's turn; original a2 pawn stays a3.
20. Original e7 pawn advances to e6; royal b8 knight is unthreatened.
21. End Black's turn with Prince e8 and royal b8 distinct.
22. Guardian replaces move with original f2 pawn to f4 via empty f3; optional f1 follower stays; f3 en passant opens.
23. End White's Guardian turn, consuming the move and card exactly once.
24. Prince e8 steps to empty e7 with King movement, losing remaining black castling rights; b8 stays royal.
25. End Black's turn, with capturable Prince e7.
26. Confabulation uses b2 pawn's diagonal capture geometry onto friendly a3 pawn; original a2 represents composite, original b2 becomes away, neither captured.
27. End White's composite replacement turn; retain the continuing card and both component identities.
28. Original c8 bishop slides through vacant b7 to a6; royal b8 remains safe.
29. End Black's turn with bishop a6.
30. Original g1 knight jumps to empty e2; white e1 remains safe.
31. End White's knight turn; no effect or card changes.
32. Original c8 bishop returns one diagonal step a6–b7.
33. End Black's turn preserving bishop b7 and composite a3.
34. Original f2 pawn advances f4–f5; no capture or promotion.
35. End White's turn; f5 pawn stays original f2 identity.
36. Black queen d8 slides diagonally through c7 and b6 to a5; its e1 diagonal is blocked by occupied c3.
37. End Black's queen turn; e1 remains safe behind c3.
38. Original h2 pawn advances through empty h3 to h4; h3 en-passant opportunity begins.
39. End White's turn, preserving h3 opportunity for Black.
40. Original d7 pawn advances through d6 to d5; replace h3 opportunity with d6.
41. End Black's turn, retaining d6 opportunity for White.
42. Resurrection returns captured original a1 rook to vacant a1, consumes move and expires d6; lost castling rights do not return.
43. End White's Resurrection turn; a1 rook remains returned.
44. Black Resurrection returns captured original a7 pawn to vacant d7, a valid pawn starting rank; original d7 pawn remains d5.
45. End Black's replacement turn; keep the two distinct d-file pawns.
46. Original g2 pawn advances g3–g4; c3 still blocks a5 queen's diagonal toward e1.
47. End White's turn with no card spending.
48. Original b7 pawn advances b5–b4; no capture, royal b8 safe.
49. After-move Abduction temporarily removes original g2 pawn from g4 into away; Black spends and refills once, recall remains pending.
50. Reveal changes concealment to recall; no board, hand, or clock changes.
51. White names exact original g2 pawn, owner, role and g4 square; restore that pawn and clear pending recall, without refunding Black's card.
52. End Black's resolved Abduction turn; restored g4 pawn remains.
53. The restored original g2 pawn advances g4–g5, proving identity continuity.
54. End White's turn with original g2 pawn at g5.
55. Original g7 pawn advances to g6, directly in front of White's g5 pawn.
56. End Black's turn; no capture occurs between adjacent opposing pawns.
57. Original f1 bishop moves diagonally to vacated g2; White's e1 King stays safe.
58. End White's bishop turn with both composite identities unchanged.
59. Queen a5 moves through empty a4 to capture composite a3; BOTH original a2 and b2 pawns become captured and Confabulation expires to discard.
60. End Black's composite capture turn; neither captured component returns.
61. White royal e1 moves diagonally to empty f2; queen a3 is unaligned with f2, bishop b7 is blocked by occupied c6; white castling rights end.
62. End White's King turn; both colors now lack castling rights.
63. Queen a3 crosses vacant a2 and captures resurrected original a1 rook on a1; no revival remains.
64. End Black's rook-capture turn; a1 queen is unaligned with white f2.
65. White King f2 steps to g1; queen a1's rank is blocked by occupied b1 knight, bishop b7 diagonal by occupied c6 pawn.
66. End White's King turn, retaining original b1 knight as rank blocker.
67. Forced March simultaneously shifts resurrected original a7 pawn d7–c7 and original d7 pawn d5–c5 into distinct empty squares; original c7 pawn remains c6.
68. End Black's two-pawn replacement turn; retain all three distinct c-file pawns.
69. Original e2 pawn advances e3–e4; b7 bishop remains blocked by c6.
70. End White's pawn turn with e4 occupied.
71. Original f7 pawn advances to f6; royal b8 stays safe.
72. End Black's turn; f6 and f5 pawns are distinct opposing pieces.
73. Original g2 pawn captures diagonally g5–h6, taking original g8 knight, NOT royal original b8 knight.
74. End White's capture turn with h6 pawn and b8 royal both on board.
75. Original b7 pawn advances b4–b3; no promotion on rank three.
76. End Black's turn with b3 pawn unchanged.
77. White King g1 returns diagonally to f2; queen a1 is unaligned, bishop b7 diagonal meets occupied c6 first.
78. End White's King turn safely at f2.
79. Original a8 rook descends a7–a6 into empty square; black royal remains b8.
80. Black plays Forbidden City after moving on empty h3; continuing marker changes no piece or clock.
81. End Black's marker turn; h3 remains forbidden to entry or sliding passage.
82. Annexation moves original d2 pawn through empty d3 to d4 as a replacement; starting pawn gives d3 en-passant opportunity, no promotion.
83. End White's replacement turn retaining d3 opportunity.
84. Original e7 pawn advances e6–e5; expires unused d3 opportunity.
85. After-move Man-Trap marks h7 occupied by black original h7 pawn; no capture yet, continuing card remains active.
86. End Black's trap turn; h7 marker and h3 city persist.
87. Original h1 rook moves one square to h2; it never enters forbidden h3.
88. End White's rook turn; h2 rook remains original h1 identity.
89. Original g7 pawn captures original f2 pawn diagonally g6–f5; capture resets clock.
90. End Black's capture turn; no card or trap triggers at f5.
91. White King f2 steps to f1; queen a1 rank is blocked by occupied b1 knight; bishop b7 is unaligned with f1.
92. End White's safe King turn at f1.
93. Original e8 Prince moves e7–f7 one square; b8 knight retains royal status.
94. End Black's Prince turn, with no King-status change.
95. Original c1 bishop slides via empty d2,e3,f4 to g5; original f1 bishop stays g2.
96. End White's bishop turn; black b8 is unaligned with g5 bishop.
97. Original a8 rook slides a6–a4 through vacant a5; white f1 is unaligned with a4 rook.
98. End Black's rook turn with a4 rook unchanged.
99. Original d1 queen steps up to vacant d2; b1 knight still blocks black a1 queen from f1 King.
100. End White's queen turn; all effects persist.
101. Prince f7 moves to g7, which White h6 pawn attacks; legal because the Prince is capturable and the actual King remains b8.
102. End Black's Prince turn; attack on Prince is not check.
103. Original d2 pawn captures original e7 pawn diagonally d4–e5; original e2 pawn stays e4.
104. Black's after-opponent-move Revenge captures original g2 pawn on h6; neither King becomes checked, card spending does not advance move clocks.
105. End White's turn and reset Black's reaction allowance for its own turn.
106. Prince g7 returns horizontally to f7; royal b8 remains untouched.
107. End Black's Prince turn with no continuing effect changes.
108. White queen d2–e1 moves one diagonal step; b1 knight still shields King f1 from a1 queen.
109. White after-move Challenge names movable nonroyal black original h8 rook, which has vacant g8 available; record next-turn obligation and discard card.
110. End White's turn; Challenge persists into Black's next move.
111. Challenged original h8 rook moves h8–g8, fulfilling and expiring Challenge without affecting original a8 rook at a4.
112. End Black's fulfilled Challenge turn, with the marker gone.
113. Lost Castle swaps original h1 rook h2 with original h8 rook g8; no capture and no h3 traversal. Bishop f8 blocks new g8 rook's line to royal b8.
114. End White's swap replacement turn; black h2 rook is unaligned with white f1 King.
115. Original a8 rook slides a4–a6 via vacant a5; original h8 rook stays h2.
116. End Black's a-file rook turn with swapped identities preserved.
117. Original c1 bishop returns g5–d2 via empty f4,e3; original f1 bishop stays g2.
118. End White's bishop turn; g8 rook still cannot threaten b8 through occupied f8.
119. Capturable Prince f7 captures original h1 rook diagonally on g8; royal original b8 knight is not moved.
120. End Black's capture turn with both original white rooks captured.
121. Original g1 knight jumps e2–d4; original b1 knight remains shielding f1 from queen a1.
122. End White's knight turn; b1 still shields f1 and no card or effect changes.
123. Original h7 pawn advances via now-empty h6 to h5; grants h6 en passant. Leaving its own Man-Trap square does not trigger it.
124. End Black's final turn; White starts with h6 opportunity, persistent h3 city and h7 trap, and safe royal f1.
`.trim().split('\n');

test('iteration 087 replay', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/087.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(rationales.length, 124);
  assert.equal(trace.steps.length, rationales.length);
  rationales.forEach((line, index) => assert.ok(line.startsWith(`${index + 1}. `)));
  assert.ok(replayTrace(trace));
});

test('iteration 087 independently models every identity, move, card, clock and royal position', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/087.json', import.meta.url), 'utf8')) as RandomTrace;
  let state = createGameState(trace.initial);
  const pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  let effects: unknown[] = [];
  let ep: typeof state.enPassant = [];
  let half = 0, full = 1;
  let actor: Color = 'white';
  let made = false;
  let allowances = { white: 0, black: 0 };
  let rights = 'KQkq';
  const piece = (id: string) => { const p = pieces.find(p => p.id === id); assert.ok(p, id); return p; };
  const at = (square: string) => pieces.find(p => p.zone === 'board' && p.square === square);
  const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
  const relocate = (id: string, square: string | null, zone: PieceState['zone'] = square ? 'board' : 'captured') => {
    if (square) assert.match(square, /^[a-h][1-8]$/);
    Object.assign(piece(id), { square: square as SquareName | null, zone });
  };
  const projection = (list: PieceState[]) => list.map(({ capturedAtPly: _ply, capturedBy: _actor, ...p }) => p);
  const blocks = (from: string, to: string) => {
    const [x,y] = xy(from), [tx,ty] = xy(to);
    const dx = tx-x, dy = ty-y;
    assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), `${from}-${to}: aligned ray`);
    const result: string[] = [];
    for (let n=1; n<Math.max(Math.abs(dx),Math.abs(dy)); n++) {
      const square: string = String.fromCharCode(97+x+n*Math.sign(dx)) + (y+n*Math.sign(dy)+1);
      if (at(square) || effects.some(e => JSON.stringify(e).includes('forbidden-city') && JSON.stringify(e).includes(`"square":"${square}"`))) result.push(square);
    }
    return result;
  };
  const safe = (color: Color) => {
    const king = pieces.find(p => p.owner === color && p.royal)!;
    assert.equal(king.zone, 'board');
    const [kx,ky] = xy(king.square!);
    for (const enemy of pieces.filter(p => p.zone === 'board' && p.owner !== color)) {
      const [x,y] = xy(enemy.square!); const dx=kx-x, dy=ky-y;
      let attacks = false;
      if (enemy.role === 'pawn') attacks = Math.abs(dx) === 1 && dy === (enemy.owner === 'white' ? 1 : -1);
      else if (enemy.role === 'knight') attacks = Math.abs(dx)*Math.abs(dy) === 2;
      else if (enemy.role === 'king') attacks = Math.max(Math.abs(dx),Math.abs(dy)) === 1;
      else {
        const aligned = enemy.role === 'rook' ? dx===0 || dy===0
          : enemy.role === 'bishop' ? Math.abs(dx)===Math.abs(dy)
          : dx===0 || dy===0 || Math.abs(dx)===Math.abs(dy);
        attacks = aligned && blocks(enemy.square!, king.square!).length === 0;
      }
      // No neutral/immunity effects occur here. This stricter raw attack check also
      // passes during Challenge, when additional enemy captures are suppressed.
      assert.equal(attacks, false, `${enemy.id}@${enemy.square} attacks ${king.id}@${king.square}`);
    }
  };
  const coup = { type:'coup', owner:'black', card:{id:'black-hand-1-coup',cardId:'coup'}, princeId:'black-king-e8',kingId:'black-knight-b8',princeRole:'king' };
  const confab = { type:'confabulation', owner:'white', card:{id:'white-hand-4-confabulation',cardId:'confabulation'}, pieceIds:['white-pawn-a2','white-pawn-b2'] };
  const city = { type:'forbidden-city', owner:'black', card:{id:'black-deck-1-forbidden-city',cardId:'forbidden-city'}, square:'h3' };
  const trap = { type:'man-trap', owner:'black', card:{id:'black-deck-4-man-trap',cardId:'man-trap'}, square:'h7' };
  const challenge = {type:'challenge', owner:'white',player:'black',pieceId:'black-rook-h8'};
  const replacementSteps = new Set([1,22,26,42,44,67,82,113]);
  const pawnReplacementSteps = new Set([22,26,44,67,82]);
  const continuing = new Set(['coup','confabulation','forbidden-city','man-trap']);
  let recalledPieces: PieceState[] | undefined;
  let recalledFen: string | undefined;
  for (const [index, step] of trace.steps.entries()) {
    const n = index+1, action = step.action;
    const oldFen = state.fen;
    if (action.type === 'move') {
      assert.ok(typeof action.from === 'string' && typeof action.to === 'string');
      assert.match(action.from, /^[a-h][1-8]$/); assert.match(action.to, /^[a-h][1-8]$/);
      assert.equal(made, false);
      const mover = at(action.from)!; assert.ok(mover); assert.equal(mover.owner, actor);
      const victim = at(action.to);
      if (victim) { assert.notEqual(victim.owner, actor); assert.equal(victim.royal, false); }
      const [x,y]=xy(action.from), [tx,ty]=xy(action.to), dx=tx-x,dy=ty-y;
      if (mover.role === 'pawn') {
        const direction: number = actor === 'white' ? 1 : -1;
        if (victim) assert.ok(Math.abs(dx)===1 && dy===direction);
        else {
          assert.equal(dx,0);
          assert.ok(dy===direction || dy===2*direction && y===(actor==='white'?1:6));
          assert.deepEqual(blocks(action.from,action.to),[]);
        }
      } else if (mover.role === 'knight') assert.equal(Math.abs(dx)*Math.abs(dy),2);
      else if (mover.role === 'king') assert.equal(Math.max(Math.abs(dx),Math.abs(dy)),1);
      else {
        assert.ok(mover.role==='queen' ? dx===0 || dy===0 || Math.abs(dx)===Math.abs(dy)
          : mover.role==='rook' ? dx===0 || dy===0 : Math.abs(dx)===Math.abs(dy));
        assert.deepEqual(blocks(action.from,action.to),[]);
      }
      if (n>=80) assert.notEqual(action.to,'h3');
      if (n===111) { assert.equal(mover.id,'black-rook-h8'); effects=[coup,city,trap]; }
      if (victim) relocate(victim.id,null);
      if (n===59) {
        assert.equal(victim?.id,'white-pawn-a2');
        relocate('white-pawn-b2',null); effects=[coup]; players.white.discard.push(confab.card);
      }
      relocate(mover.id,action.to);
      half=mover.role==='pawn'||victim ? 0 : half+1;
      ep=mover.role==='pawn'&&Math.abs(dy)===2 ? [{target:(action.from[0]!+(y+dy/2+1)) as SquareName,pawnId:mover.id}] : [];
      if (mover.id==='black-rook-a8') rights=rights.replace('q','');
      if (mover.id==='black-king-e8') rights=rights.replace('k','').replace('q','');
      if (mover.id==='white-king-e1') rights=rights.replace('K','').replace('Q','');
      made=true; if(actor==='black') full++;
    } else if (action.type === 'playCard') {
      const owner: Color = n===104 ? 'black' : actor;
      const cards: PlayerState=players[owner];
      const ix: number=cards.hand.findIndex(c => c.id===action.cardInstanceId);
      assert.ok(ix>=0); assert.equal(allowances[owner],0);
      const card: CardInstance | undefined=cards.hand.splice(ix,1)[0]; assert.ok(card); assert.equal(card.cardId,action.cardId);
      if (!continuing.has(action.cardId)) cards.discard.push(card);
      cards.hand.push(cards.deck.shift()!); allowances[owner]++;
      switch(n) {
        case 1: assert.deepEqual(blocks('a1','a7'),['a2']); relocate('black-pawn-a7',null); relocate('white-rook-a1','a7'); rights=rights.replace('Q',''); break;
        case 16: piece('black-king-e8').royal=false; piece('black-knight-b8').royal=true; effects=[coup]; break;
        case 22: assert.equal(at('f3'),undefined); assert.equal(at('f4'),undefined); relocate('white-pawn-f2','f4'); break;
        case 26: assert.equal(at('a3')?.id,'white-pawn-a2'); relocate('white-pawn-b2',null,'away'); effects=[coup,confab]; break;
        case 42: assert.equal(piece('white-rook-a1').zone,'captured'); assert.equal(at('a1'),undefined); relocate('white-rook-a1','a1'); break;
        case 44: assert.equal(piece('black-pawn-a7').zone,'captured'); assert.equal(at('d7'),undefined); relocate('black-pawn-a7','d7'); break;
        case 49: recalledPieces=structuredClone(pieces); recalledFen=oldFen; relocate('white-pawn-g2',null,'away'); break;
        case 67: assert.equal(at('c7'),undefined); assert.equal(at('c5'),undefined); relocate('black-pawn-a7','c7'); relocate('black-pawn-d7','c5'); break;
        case 80: assert.equal(at('h3'),undefined); effects=[coup,city]; break;
        case 82: assert.equal(at('d3'),undefined); assert.equal(at('d4'),undefined); relocate('white-pawn-d2','d4'); break;
        case 85: assert.equal(at('h7')?.id,'black-pawn-h7'); effects=[coup,city,trap]; break;
        case 104: assert.equal(at('h6')?.id,'white-pawn-g2'); relocate('white-pawn-g2',null); break;
        case 109: assert.equal(at('h8')?.id,'black-rook-h8'); assert.equal(at('g8'),undefined); effects=[coup,city,trap,challenge]; break;
        case 113: assert.equal(at('h2')?.id,'white-rook-h1'); assert.equal(at('g8')?.id,'black-rook-h8'); relocate('white-rook-h1','g8'); relocate('black-rook-h8','h2'); break;
        default: assert.fail(`Unreviewed card step ${n}`);
      }
      if (replacementSteps.has(n)) {
        assert.equal(made,false); made=true;
        half=n===1||pawnReplacementSteps.has(n)?0:half+1;
        ep=n===22?[{target:'f3',pawnId:'white-pawn-f2'}]:n===82?[{target:'d3',pawnId:'white-pawn-d2'}]:[];
        if(actor==='black')full++;
      } else assert.equal(made,true);
    } else if (action.type==='answerAbduction') {
      assert.equal(n,51); assert.equal(action.pieceId,'white-pawn-g2');
      relocate('white-pawn-g2','g4');
      assert.deepEqual(projection(pieces),projection(recalledPieces!));
    } else if (action.type==='revealAbduction') assert.equal(n,50);
    else if (action.type==='endTurn') {
      assert.equal(made,true); actor=actor==='white'?'black':'white'; made=false; allowances={white:0,black:0};
    } else assert.fail(`Unreviewed action ${n}`);
    const result=applyAction(state,action); assert.ok(result.ok,rationales[index]); state=result.state;
    assert.deepEqual(projection(state.pieces),projection(pieces),`step ${n} physical identities`);
    assert.deepEqual(state.players,players,`step ${n} exact physical card zones`);
    assert.deepEqual(state.effects,effects,`step ${n} complete effect records`);
    assert.deepEqual(state.enPassant,ep,`step ${n} en-passant identity and expiration`);
    assert.deepEqual(state.turn,{color:actor,phase:made?'afterMove':'beforeMove',moveMade:made,cardPlays:allowances});
    assert.deepEqual(state.fen.split(' ').slice(4),[String(half),String(full)],`step ${n} clocks`);
    assert.equal(state.fen.split(' ')[2],rights||'-');
    assert.equal(state.fen.split(' ')[1],(made?(actor==='white'?'black':'white'):actor)==='white'?'w':'b');
    assert.equal(!!state.pendingRescue,false);
    assert.equal(state.outcome,null);
    assert.equal(state.orientation,0);
    if(n===49||n===50) {
      assert.equal(state.pendingAbduction?.phase,n===49?'concealment':'recall');
      assert.equal(state.pendingAbduction?.pieceId,'white-pawn-g2');
      assert.equal(state.pendingAbduction?.player,'white');
      assert.equal(state.pendingAbduction?.durationMs,10000);
    } else assert.equal(!!state.pendingAbduction,false);
    if(n===51)assert.equal(state.fen,recalledFen,'recall restores exact board and clocks');
    if(action.type==='endTurn'||n===50)assert.equal(state.fen,oldFen);
    safe('white'); safe('black');
  }
  assert.equal(trace.steps.filter(s=>s.action.type==='move').length,50);
  assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,14);
  assert.equal(state.fen,'1n3bk1/1bp5/r1p2p2/2p1Pp1p/3NP2P/1pP5/3B2Br/qN2QK2 w - - 0 30');
});
