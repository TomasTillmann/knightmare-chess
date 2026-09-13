import { activeDoomsayers, applyAction, doomsayerTargets, underElfHillReturnSquares } from './game/reducer.js';
import type { CardInstance, Color, DoomsayerRole, GameAction, GameState, Role, SquareName } from './game/types.js';
import type { CardInteraction, CardPick } from './cardInteractions.js';

export interface GameSelection extends CardInteraction {
  title: string;
  card?: CardInstance;
  picked: string[];
  required?: boolean;
  confirm?: string;
  minPicked?: number;
  resolve?: (picked: string[]) => { choices: CardPick[]; action?: GameAction; summary: CardPick[] };
}

const title = (value: string) => value[0].toUpperCase() + value.slice(1);
const choice = (id: string, prompt: string, label = title(id)): CardPick => ({ id, label, prompt });
const square = (id: SquareName, prompt: string): CardPick => ({ id, label: id, square: id, prompt });
const squares = Array.from({ length: 64 }, (_, i) => `${'abcdefgh'[i % 8]}${1 + Math.floor(i / 8)}` as SquareName);

export function doomsayerSelection(state: GameState): GameSelection {
  const effects = activeDoomsayers(state);
  const immediate = state.pendingDoomsayer?.player;
  return {
    title: 'Name a piece', prompts: [], options: [], picked: immediate ? [immediate] : [], minPicked: immediate ? 1 : 0, confirm: 'Name piece',
    resolve(picked) {
      const summary: CardPick[] = [];
      if (!picked.length) return { choices: ['white', 'black'].map(id => choice(id, 'Who named the piece?')), summary };
      const speaker = picked[0] as Color;
      summary.push(choice(speaker, ''));
      const names: DoomsayerRole[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'crab', 'prince'];
      if (picked.length === 1) return { choices: names.map(id => choice(id, 'Name a piece type')), summary };
      const name = picked[1] as DoomsayerRole;
      summary.push(choice(name, ''));
      const candidates = doomsayerTargets(state, speaker, name);
      const selected = picked.slice(2);
      const required = Math.min(effects.length, candidates.length);
      summary.push(...selected.map(id => square(candidates.find(piece => piece.id === id)!.square!, '')));
      if (selected.length < required) return {
        choices: candidates.filter(piece => !selected.includes(piece.id)).map(piece => ({
          ...square(piece.square!, `Choose ${title(speaker)}'s ${name} to lose (${selected.length + 1}/${required})`), id: piece.id,
        })), summary,
      };
      return { choices: [], summary, action: { type: 'namePiece', speaker, name,
        losses: selected.map((pieceId, index) => ({ effectId: effects[index].card.id, pieceId })) } };
    },
  };
}

export function requiredSelection(state: GameState): GameSelection | null {
  const returns = underElfHillReturnSquares(state);
  if (returns.length) return {
    title: 'Return your King', required: true, confirm: 'Return King', picked: [],
    prompts: ['Choose a safe edge square'],
    options: returns.map(to => ({ picks: [square(to, 'Choose a safe edge square')], action: { type: 'returnKing', to } })),
  };
  const pending = state.pendingAbduction;
  if (pending?.phase !== 'recall') return null;
  return {
    title: `${title(pending.player)}: recall the missing piece`, required: true, confirm: 'Answer', picked: [], prompts: [], options: [],
    resolve(picked) {
      const summary: CardPick[] = [];
      if (!picked.length) return { choices: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].map(id => choice(id, 'Which piece is missing?')), summary };
      const role = picked[0] as Role;
      summary.push(choice(role, ''));
      if (picked.length === 1) return { choices: ['white', 'black'].map(id => choice(id, 'Which color was it?')), summary };
      const owner = picked[1] as Color;
      summary.push(choice(owner, ''));
      if (picked.length === 2) return { choices: squares.map(id => square(id, 'Where was the missing piece?')), summary };
      const at = picked[2] as SquareName;
      summary.push(square(at, ''));
      if (pending.requiresPieceId && picked.length === 3) {
        const pieces = pending.before.pieces.filter(piece => piece.owner === owner && piece.role === role);
        return { choices: pieces.map(piece => choice(piece.id, 'Identify the physical piece', `${title(owner)} ${role} · ${piece.id.split('-').at(-1)}`)), summary };
      }
      if (picked[3]) summary.push(choice(picked[3], '', `Original ${picked[3].split('-').at(-1)}`));
      return { choices: [], summary, action: { type: 'answerAbduction', player: pending.player, role, owner, square: at,
        ...(picked[3] ? { pieceId: picked[3] } : {}) } };
    },
  };
}

// Probe the public applier: Crab promotion and optional en passant need real choices too.
export function moveChoices(state: GameState, from: SquareName, to: SquareName): GameSelection['options'] {
  const options = new Map<string, GameSelection['options'][number]>();
  for (const promotion of [undefined, 'queen', 'rook', 'bishop', 'knight'] as const) {
    for (const enPassant of [undefined, false] as const) {
      const action: GameAction = { type: 'move', from, to, ...(promotion ? { promotion } : {}), ...(enPassant === false ? { enPassant } : {}) };
      const result = applyAction(state, action);
      if (!result.ok) continue;
      const key = JSON.stringify(result.state.pieces);
      if (options.has(key)) continue;
      const captures = result.state.pieces.some(piece => piece.zone === 'captured' && state.pieces.some(before => before.id === piece.id && before.zone === 'board'));
      const label = [promotion ? title(promotion) : '', captures ? 'Capture' : 'Move without capturing'].filter(Boolean).join(' · ');
      options.set(key, { picks: [choice(key, 'Choose how to move', label)], action });
    }
  }
  return [...options.values()];
}
