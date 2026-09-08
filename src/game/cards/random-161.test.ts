import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { replayTrace, type RandomTrace } from './random-campaign.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

// Each row was read in order against rules §§8–11,13,15.3,19.2–3,20,21.1,22.4.
// Explicit action ledger: neither trace hashes nor generated deltas supply this oracle.
const reviewed = `
1 b1c3: Knight leaps to empty c3.
2 end: White yields with both Kings safe.
3 c7c5: Pawn double through empty c6; no adjacent White en-passant captor.
4 end: White receives c6 opportunity, still uncapturable.
5 a2a4: Pawn double through a3; expires c6 opportunity.
6 end: Black receives uncapturable a3 opportunity.
7 e7e5: Pawn double through e6; expires a3 opportunity.
8 end: White receives uncapturable e6 opportunity.
9 a4a5: Pawn advances one empty square, ending en-passant.
10 end: Black begins safely.
11 d7d6: Pawn advances into empty d6.
12 vendetta: Black after-move continuing card; draw Siege.
13 end: White has no capture; Vendetta expires to Black discard.
14 g1h3: Knight leap to empty h3.
15 end: Black begins safely.
16 d8e7: Queen diagonal to vacated e7.
17 siege: Swap owned g8 Knight and a8 Rook without capture or clock change.
18 end: White begins; swap keeps movement rights dormant at original rook square.
19 c3a2: Knight leap to vacated a2.
20 doomsayer: White after-move continuing card; mandatory Black response opens.
21 name: Black names Rook and loses h8 Rook to White-owned Doomsayer; discard effect.
22 end: Black begins after fulfilled naming choice.
23 h7h5: Pawn double through h6; no White pawn can capture en passant.
24 end: White receives h6 opportunity.
25 bombard: White Rook a1 jumps exactly one blocker, its Knight a2, passes a3 to a4; replacement move.
26 end: Black begins; Bombard expired en-passant and a1 castling right.
27 b7b5: Pawn double through b6; White a5 pawn can capture en passant.
28 end: White retains legal a5xb6 en-passant option.
29 a4d4: Rook crosses empty b4,c4; White declines en-passant.
30 vendetta: White after-move continuing effect; draw Split Knight.
31 end: Black can capture d4 Rook with e5 pawn, so Vendetta remains.
32 e5d4: Mandatory diagonal pawn capture of White a1 Rook; Black is captor.
33 end: White has no capture, so Vendetta expires to White discard.
34 g2g3: Pawn advances to empty g3.
35 end: Black begins safely.
36 f7f5: Pawn double through empty f6; no White en-passant captor.
37 end: White receives uncapturable f6 opportunity.
38 under-elf-hill: White King e1 becomes away; replacement move clears en-passant and White castling.
39 end: Black acts while White King is absent.
40 a8c7: Swapped g8 Knight leaps to empty c7.
41 end: White must return its King before acting.
42 return: King returns on empty edge h7, safe; g7 pawn attacks h6, not h7; King cannot move this turn.
43 a2b4: White uses its other Knight, respecting the returned King's immobility.
44 end: Returned King's restriction expires.
45 g7g5: Pawn double through g6 opens Queen e7-f7-g7-h7 check; no White en-passant captor.
46 end: White begins in Queen check on h7.
47 h7g8: King escapes the Queen ray and captures relocated Black a8 Rook; last Black castling right expires.
48 end: Black begins safely.
49 h5h4: Pawn advances to empty h4.
50 end: White begins safely.
51 b4d5: Knight leap to empty d5.
52 end: Black begins safely.
53 a7a6: Pawn advances to empty a6.
54 end: White begins safely.
55 f2f3: Pawn advances to empty f3.
56 end: Black begins safely.
57 e7e6: Queen steps down and checks White g8 along e6-f7-g8.
58 end: White receives a checked turn.
59 g8h7: King steps diagonally off the Queen ray to safe h7.
60 end: Black begins safely.
61 e6e5: Queen steps to empty e5.
62 end: White begins safely.
63 h3f4: Knight leap to empty f4.
64 end: Black begins safely.
65 e5h8: Queen crosses empty f6,g7 and checks h7 vertically.
66 end: White receives a checked turn.
67 h7h8: King captures the checking Queen on undefended h8.
68 end: Black begins safely.
69 c5c4: Pawn advances to empty c4.
70 end: White begins safely.
71 d5c7: Knight captures Black g8 Knight and checks e8.
72 end: Black receives a checked turn with Abduction in hand.
73 b8c6: Provisional Knight move leaves c7 Knight checking e8; Abduction c7 plus timeout is a concrete cure.
74 abduction: Black chooses h2 pawn instead; temporary concealment defers safety, spends card and draws Coup.
75 reveal: Exact same h2 pawn stays away while White's recall window opens.
76 answer: Correct pawn/h2/White identity restores pawn; uncured e8 check rewinds b8-c6, keeping Abduction spent. Historical shield token is inert beforeMove and overwritten by replacement.
77 e8d7: Replacement King move cures c7 Knight check; Abduction allowance stays consumed.
78 end: White begins; allowances reset.
79 g3h4: White pawn diagonally captures Black h7 pawn.
80 end: Black begins safely.
81 g5h4: Black pawn diagonally captures White g2 pawn.
82 end: White begins safely.
83 f4d3: Knight leap to empty d3.
84 end: Black begins safely.
85 c8b7: Bishop diagonal to vacated b7.
86 end: White begins safely.
87 d3b4: Knight leap to empty b4.
88 end: Black begins safely.
89 b7f3: Bishop passes empty c6,d5,e4 and captures White f2 pawn.
90 coup: Black names safe c4 pawn as royal; old e8 King at d7 becomes capturable Prince; powers unchanged.
91 end: White begins with Black's royal pawn at c4.
92 c7e8: Knight leap to empty e8; no check of royal c4 pawn.
93 end: Black begins safely.
94 d4d3: Original e7 pawn advances one; not the royal c4 pawn.
95 end: White begins safely.
96 c2c3: Pawn advances to c3; pawns attack diagonally and do not check royal c4.
97 end: Black begins safely.
98 f8g7: Bishop steps diagonally and checks White h8.
99 end: White receives checked turn.
100 h8g8: King steps off Bishop diagonal to safe g8.
101 end: Black begins safely.
102 d7c6: Capturable Prince steps diagonally; royal c4 remains safe even though c6 is attacked by b4 Knight.
103 end: White begins safely.
104 f1h3: Bishop crosses empty g2 to empty h3.
105 end: Black begins safely.
106 g7e5: Bishop crosses empty f6 to empty e5.
107 end: White begins safely.
108 h1g1: Rook steps onto empty g1.
109 end: Black begins safely.
110 e5h2: Bishop crosses empty f4,g3 and captures White h2 pawn.
111 end: White begins safely.
112 g1g2: Rook advances to empty g2.
113 end: Black begins safely; fifty regular move commands reviewed.
`.trim().split('\n');

const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1] as const;
function geometry(pieces: PieceState[], piece: PieceState, to: string, capture: boolean): boolean {
  assert.ok(piece.square);
  const [x,y] = xy(piece.square), [u,v] = xy(to), dx = u-x, dy = v-y;
  if (!dx && !dy) return false;
  const occupied = (x: number,y: number) => pieces.some(p => p.zone === 'board' && p.square === `${'abcdefgh'[x]}${y+1}`);
  if (piece.role === 'knight') return Math.abs(dx)*Math.abs(dy) === 2;
  if (piece.role === 'king') return Math.max(Math.abs(dx),Math.abs(dy)) === 1;
  if (piece.role === 'pawn') {
    const direction = piece.owner === 'white' ? 1 : -1;
    return capture ? Math.abs(dx) === 1 && dy === direction
      : dx === 0 && (dy === direction || dy === 2*direction && (piece.owner === 'white' ? y <= 1 : y >= 6) && !occupied(x,y+direction));
  }
  if (!(piece.role !== 'bishop' && (dx === 0 || dy === 0) || piece.role !== 'rook' && Math.abs(dx) === Math.abs(dy))) return false;
  for (let k = 1; k < Math.max(Math.abs(dx),Math.abs(dy)); k++) if (occupied(x+k*Math.sign(dx),y+k*Math.sign(dy))) return false;
  return true;
}
function threats(pieces: PieceState[], color: Color, frozen: string[] = []): string[] {
  const king = pieces.find(p => p.owner === color && p.royal && p.zone === 'board');
  return king?.square ? pieces.filter(p => p.zone === 'board' && p.owner !== color && !frozen.includes(p.id) && geometry(pieces,p,king.square!,true)).map(p => p.id) : [];
}
function boardFen(pieces: PieceState[]): string {
  const symbols = { pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k' };
  return Array.from({length:8},(_,i) => {
    let row = '';
    for (const file of 'abcdefgh') {
      const p = pieces.find(p => p.zone === 'board' && p.square === `${file}${8-i}`);
      row += p ? p.owner === 'white' ? symbols[p.role].toUpperCase() : symbols[p.role] : '1';
    }
    return row.replace(/1+/g,s => String(s.length));
  }).join('/');
}

test('iteration 161 independently accounts for every physical action', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/161.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.equal(trace.seed,860161);
  assert.equal(reviewed.length,113);
  assert.equal(trace.steps.length,reviewed.length);
  let state = createGameState(trace.initial);
  let pieces = structuredClone(state.pieces);
  const players = structuredClone(state.players);
  let turn = structuredClone(state.turn), side = 'w', rights = 'KQkq', ep = '-', half = 0, full = 1;
  let opportunities: GameState['enPassant'] = [];
  let effects: unknown[] = [];
  let checkpoint: GameState | undefined;
  let elf: NonNullable<GameState['underElfHill']> = [];
  let pendingDoom: GameState['pendingDoomsayer'] = null;
  let shield: GameState['shieldMove'];
  let abductedFrom: GameState | undefined;
  let historyLength=0;
  const cardInstances: Record<number,string>={12:'black-hand-0-vendetta',17:'black-deck-0-siege',20:'white-hand-1-doomsayer',25:'white-hand-0-bombard',30:'white-deck-1-vendetta',38:'white-hand-2-under-elf-hill',74:'black-deck-1-abduction',90:'black-deck-2-coup'};
  const at = (square: string) => { const p = pieces.find(p => p.zone === 'board' && p.square === square); assert.ok(p,square); return p; };
  const lose = (p: PieceState, captor: Color) => { assert.equal(p.royal,false); p.zone = 'captured'; p.square = null; p.capturedBy = captor; };
  const advance = (pawnOrCapture: boolean) => { half = pawnOrCapture ? 0 : half+1; if (turn.color === 'black') full++; side = turn.color === 'white' ? 'b' : 'w'; turn.phase='afterMove'; turn.moveMade=true; opportunities=[]; ep='-'; };
  for (const [index,step] of trace.steps.entries()) {
    const n=index+1, a=step.action, rationale=reviewed[index]!;
    assert.ok(rationale.startsWith(`${n} `));
    const token=rationale.split(':')[0]!.split(' ')[1];
    const immutable=JSON.stringify(state);
    if (a.type==='move'||a.type==='playCard'||a.type==='namePiece') historyLength++;
    if (a.type === 'move') {
      assert.ok(typeof a.from === 'string' && typeof a.to === 'string');
      const from=a.from,to=a.to;
      assert.equal(`${from}${to}`,token);
      assert.equal(a.promotion,undefined);
      const p=at(from), victim=pieces.find(p => p.zone==='board' && p.square===to);
      assert.equal(p.owner,turn.color); assert.equal(turn.moveMade,false);
      assert.ok(geometry(pieces,p,to,!!victim),rationale);
      assert.ok(!elf.some(e => e.pieceId===p.id && e.returned));
      if (n===73) checkpoint=structuredClone(state);
      shield={player:turn.color,pieceIds:[p.id],capturedOpponent:!!victim};
      if (victim) { assert.notEqual(victim.owner,turn.color); lose(victim,turn.color); }
      advance(p.role==='pawn'||!!victim);
      if (p.role==='pawn' && Math.abs(Number(to[1])-Number(from[1]))===2) opportunities=[{target:`${from[0]}${(Number(from[1])+Number(to[1]))/2}` as SquareName,pawnId:p.id}];
      if (n===27) ep='b6';
      p.square=to as SquareName;
      if (n===47) rights='-';
    } else if (a.type === 'endTurn') {
      assert.equal(token,'end'); assert.equal(turn.moveMade,true);
      assert.equal(threats(pieces,turn.color,elf.filter(e=>e.returned).map(e=>e.pieceId)).length,0);
      turn={color:turn.color==='white'?'black':'white',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      shield=undefined;
      if (n===13 || n===33) {
        // Inspect every capture independently before retiring Vendetta.
        assert.equal(pieces.filter(p=>p.zone==='board' && p.owner===turn.color).some(p=>pieces.some(q=>q.zone==='board'&&q.owner!==turn.color&&geometry(pieces,p,q.square!,true))),false);
        const owner=n===13?'black':'white';
        players[owner].discard.push({id:n===13?'black-hand-0-vendetta':'white-deck-1-vendetta',cardId:'vendetta'}); effects=[];
      }
      if (n===41) elf[0]!.returning=true;
      if (n===44) elf=[];
    } else if (a.type === 'playCard') {
      assert.equal(a.cardId,token);
      assert.equal(a.cardInstanceId,cardInstances[n],`${n}: exact played physical card`);
      const owner=turn.color, pl=players[owner], ci=pl.hand.findIndex(c=>c.id===a.cardInstanceId);
      assert.ok(ci>=0); assert.equal(turn.cardPlays[owner],0);
      assert.ok(CARD_CATALOG[a.cardId]!.timing.includes(turn.phase));
      const [card]=pl.hand.splice(ci,1); assert.ok(card);
      pl.hand.push(pl.deck.shift()!); turn.cardPlays[owner]++;
      if (!CARD_CATALOG[a.cardId]!.continuing) pl.discard.push(card);
      if (a.cardId==='vendetta' || a.cardId==='doomsayer') {
        assert.equal(a.target,undefined); effects=[{type:a.cardId,owner,card}];
        if (n===20) pendingDoom={player:'black',cardInstanceId:card.id};
      } else if (a.cardId==='siege') {
        assert.deepEqual(a.target,{knight:'g8',rook:'a8'});
        const knight=at('g8'),rook=at('a8'); assert.equal(knight.role,'knight'); assert.equal(rook.role,'rook');
        knight.square='a8';rook.square='g8';rights='KQka';
      } else if (a.cardId==='bombard') {
        assert.deepEqual(a.target,[{from:'a1',to:'a4'}]); assert.equal(at('a2').role,'knight');
        assert.equal(pieces.some(p=>p.zone==='board'&&(p.square==='a3'||p.square==='a4')),false);
        at('a1').square='a4';advance(false);rights='Ka';
        shield={player:'white',pieceIds:['white-rook-a1'],capturedOpponent:false};
      } else if (a.cardId==='under-elf-hill') {
        assert.equal(a.target,undefined);const king=at('e1');assert.equal(king.royal,true);king.square=null;king.zone='away';
        elf=[{pieceId:king.id,player:'white',returning:false}];advance(false);rights='a';
        shield={player:'white',pieceIds:[],capturedOpponent:false};
      } else if (a.cardId==='abduction') {
        abductedFrom=structuredClone(state);
        assert.equal(a.target,'h2');const pawn=at('h2');assert.equal(pawn.royal,false);pawn.square=null;pawn.zone='away';
      } else if (a.cardId==='coup') {
        assert.equal(a.target,'c4');assert.equal(at('c4').role,'pawn');at('c4').royal=true;at('d7').royal=false;
        effects=[{type:'coup',owner:'black',card,princeId:'black-king-e8',kingId:'black-pawn-c7',princeRole:'king'}];
      } else assert.fail('unreviewed card');
    } else if (a.type==='namePiece') {
      assert.deepEqual(a,{type:'namePiece',speaker:'black',name:'rook',losses:[{effectId:'white-hand-1-doomsayer',pieceId:'black-rook-h8'}]});
      lose(at('h8'),'white');half=0;rights='KQa';effects=[];pendingDoom=null;
      players.white.discard.push({id:'white-hand-1-doomsayer',cardId:'doomsayer'});
    } else if (a.type==='returnKing') {
      assert.equal(a.to,'h7');assert.equal(token,'return');
      const king=pieces.find(p=>p.id==='white-king-e1')!;king.square='h7';king.zone='board';elf[0]!.returned=true;
    } else if (a.type==='revealAbduction') assert.equal(n,75);
    else if (a.type==='answerAbduction') {
      assert.equal(n,76);assert.deepEqual(a,{type:'answerAbduction',player:'white',owner:'white',role:'pawn',square:'h2',pieceId:'white-pawn-h2'});
      assert.ok(checkpoint);pieces=structuredClone(checkpoint.pieces);opportunities=structuredClone(checkpoint.enPassant);
      // Remove the provisional move and retain the spent card as one fizzle event.
      historyLength--;
      side='b';rights='-';ep='-';half=0;full=17;turn.phase='beforeMove';turn.moveMade=false;
      // The retained historical token grants no before-move card timing; the next move replaces it.
    } else assert.fail('unreviewed action');
    const result=applyAction(state,a);assert.equal(JSON.stringify(state),immutable,`${n}: no input mutation`);assert.ok(result.ok,rationale);state=result.state;
    assert.equal(state.history.length,historyLength,`${n}: independently counted history events`);
    if (n===76) {
      assert.ok(checkpoint);
      assert.deepEqual(state.history,[...checkpoint.history,{type:'cardFizzled',cardId:'abduction',reason:'SELF_CHECK',movement:[],preservePreviousMove:false}], 'rewind preserves every prior event and retains only the Abduction fizzle');
    }
    assert.deepEqual(state.pieces,pieces,`${n}: complete physical identity and captor oracle`);
    assert.equal(state.fen,`${boardFen(pieces)} ${side} ${rights} ${ep} ${half} ${full}`,`${n}: all six FEN fields`);
    assert.deepEqual(state.players,players,`${n}: exact cards in every zone`);
    assert.deepEqual(state.turn,turn,`${n}: turn and allowances`);assert.deepEqual(state.effects,effects);
    assert.deepEqual(state.enPassant,opportunities);assert.deepEqual(state.underElfHill??[],elf);assert.deepEqual(state.pendingDoomsayer??null,pendingDoom);
    assert.equal(state.orientation,0);assert.equal(state.outcome,null);
    for (const key of ['chaosForbidden','plotsExecution','riposteSkipped','riposteCheckDeferred'] as const) assert.equal(state[key],undefined,`${n}: ${key}`);
    for (const key of ['plotsAllowances','fogLocked','riposteLostMoves'] as const) assert.deepEqual(state[key]??[],[],`${n}: ${key}`);
    const expectedWhite=[45,46,57,58,65,66,98,99].includes(n)?[n<67?'black-queen-d8':'black-bishop-f8']:[];
    const expectedBlack=n>=71&&n<=76?['white-knight-b1']:[];
    const frozen=elf.filter(e=>e.returned).map(e=>e.pieceId);
    assert.deepEqual(threats(pieces,'white',frozen),expectedWhite,`${n}: independent White threats`);
    assert.deepEqual(threats(pieces,'black',frozen),expectedBlack,`${n}: independent Black threats`);
    assert.equal(isKingInCheck(state,'white'),expectedWhite.length>0);assert.equal(isKingInCheck(state,'black'),expectedBlack.length>0);
    // En-passant is tested in the future captor's before-move context.
    if (opportunities.length) {
      const prospective=structuredClone(state);prospective.turn={color:side==='w'?'white':'black',phase:'beforeMove',moveMade:false,cardPlays:{white:0,black:0}};
      const opportunity=opportunities[0]!;
      const candidates=pieces.filter(p=>p.zone==='board'&&p.owner===prospective.turn.color&&p.role==='pawn'&&geometry(pieces,p,opportunity.target,true));
      assert.deepEqual(candidates.map(p=>p.square),n===27||n===28?['a5']:[]);
      for (const p of candidates) {
        const capturedBoard=structuredClone(pieces), captor=capturedBoard.find(q=>q.id===p.id)!, victim=capturedBoard.find(q=>q.id===opportunity.pawnId)!;
        assert.equal(captor.square,'a5');assert.equal(victim.square,'b5');assert.equal(victim.owner,'black');
        assert.equal(capturedBoard.some(q=>q.zone==='board'&&q.square===opportunity.target),false);
        captor.square=opportunity.target;victim.square=null;victim.zone='captured';victim.capturedBy='white';
        assert.deepEqual(threats(capturedBoard,'white'),[],`${n}: en-passant removal leaves White King safe`);
        assert.deepEqual(threats(capturedBoard,'black'),[],`${n}: en-passant final Black royal threat state`);
        assert.ok(legalDests(prospective).get(p.square!)?.includes(opportunity.target));
      }
    }
    if (n>=73&&n<=75) {
      assert.ok(checkpoint);assert.ok(state.pendingRescue);
      assert.equal(state.pendingRescue.fen,checkpoint.fen);assert.deepEqual(state.pendingRescue.pieces,checkpoint.pieces);
      assert.deepEqual(state.pendingRescue.enPassant,checkpoint.enPassant);assert.equal(state.pendingRescue.historyLength,checkpoint.history.length);
      assert.deepEqual(state.pendingRescue.movedPieceIds,['black-knight-b8']);
      assert.deepEqual(state.pendingRescue.before,checkpoint);
    } else assert.equal(state.pendingRescue??null,null);
    if (n===74||n===75) {
      assert.ok(state.pendingAbduction);const {before: saved,...pending}=state.pendingAbduction;
      assert.deepEqual(pending,{phase:n===74?'concealment':'recall',player:'white',durationMs:10000,pieceId:'white-pawn-h2',requiresPieceId:false});
      assert.ok(abductedFrom);assert.deepEqual(saved,abductedFrom);
    } else assert.equal(state.pendingAbduction??null,null);
    if (n===73) {
      // Concrete held-card cure, independently checked after its mandatory timeout.
      let witness=structuredClone(state);
      const held=witness.players.black.hand.find(c=>c.cardId==='abduction');assert.ok(held);
      for (const action of [{type:'playCard',cardId:'abduction',cardInstanceId:held.id,target:'c7'},{type:'revealAbduction'},{type:'abductionTimeout'}] as const) {
        const original=JSON.stringify(witness);
        const cured=applyAction(witness,action);assert.equal(JSON.stringify(witness),original,`${action.type}: witness input immutable`);assert.ok(cured.ok);witness=cured.state;
      }
      const expected=structuredClone(pieces), knight=expected.find(p=>p.id==='white-knight-b1')!;
      knight.zone='captured';knight.square=null;knight.capturedBy='black';
      assert.deepEqual(witness.pieces,expected);assert.equal(witness.pendingRescue??null,null);
      assert.deepEqual(threats(expected,'black'),[]);assert.deepEqual(threats(expected,'white'),[]);
      const original=JSON.stringify(witness);
      assert.ok(applyAction(witness,{type:'endTurn'}).ok);assert.equal(JSON.stringify(witness),original,'witness endTurn input immutable');
    }
    if (n===76) {
      const probe=structuredClone(state);
      probe.players.black.hand.push({id:'probe-shield',cardId:'mystic-shield'});
      probe.turn.cardPlays.black=0;
      const original=JSON.stringify(probe);
      const stale=applyAction(probe,{type:'playCard',cardId:'mystic-shield',cardInstanceId:'probe-shield',target:'b8'});
      assert.equal(JSON.stringify(probe),original,'rejected stale-shield probe input immutable');
      assert.equal(stale.ok,false,'historical shield token cannot qualify a card before replacement move');
    }
    assert.deepEqual(state.shieldMove,shield,`${n}: exact movement token, including inert rollback history`);
  }
  assert.equal(trace.moves,50);assert.equal(trace.steps.filter(s=>s.action.type==='playCard').length,8);
  assert.equal(state.fen,'1n2N1K1/8/p1kp4/Pp3p2/1Np4p/2Pp1b1B/1P1PP1Rb/2BQ4 b - - 1 26');
});

test('iteration 161 deterministic trace replays', () => {
  const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/161.json', import.meta.url), 'utf8')) as RandomTrace;
  assert.ok(replayTrace(trace));
});
