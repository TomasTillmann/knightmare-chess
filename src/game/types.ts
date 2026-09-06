import type { Color, Role, SquareName } from 'chessops/types';

export type { Color, Role, SquareName };

export type CardId = string;
export type TurnPhase = 'beforeMove' | 'afterMove';
export type PieceZone = 'board' | 'captured' | 'dead' | 'away';
export type BoardOrientation = 0 | 90 | 180 | 270;

export interface PieceState {
  id: string;
  owner: Color;
  role: Role;
  originalRole: Role;
  square: SquareName | null;
  zone: PieceZone;
  promoted: boolean;
  royal: boolean;
  neutral: boolean;
}

export interface CardInstance {
  id: string;
  cardId: CardId;
}

export interface CardMove {
  from: SquareName;
  to: SquareName;
}

export interface EnPassantOpportunity {
  target: SquareName;
  pawnId: string;
}

export interface PendingRescueState {
  fen: string;
  pieces: PieceState[];
  enPassant: EnPassantOpportunity[];
  historyLength: number;
  history?: GameEvent[];
  movedPieceIds: string[];
}

export interface HolyWarTarget {
  knight: SquareName;
  bishop: SquareName;
}

export interface AnathemaTarget {
  bishop: SquareName;
  rook: SquareName;
}

export interface SiegeTarget {
  knight: SquareName;
  rook: SquareName;
}

export interface EvangelistsTarget {
  own: SquareName;
  opponent: SquareName;
}

export type DoomsayerRole = Exclude<Role, 'king'>;

export interface DoomsayerEffect {
  type: 'doomsayer';
  owner: Color;
  card: CardInstance;
}

export interface PacifismEffect {
  type: 'pacifism';
  owner: Color;
  card: CardInstance;
  pieceId: string;
}

export interface VendettaEffect {
  type: 'vendetta';
  owner: Color;
  card: CardInstance;
}

export interface PendingDoomsayerState {
  player: Color;
  cardInstanceId: string;
}

export interface DoomsayerLoss {
  effectId: string;
  pieceId: string;
}

export interface PlayerState {
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
}

export interface GameEvent {
  type: 'move' | 'cardPlayed' | 'cardFizzled' | 'pieceNamed' | 'doomsayerDeclined';
  cardId?: CardId;
  capturedId?: string;
  capturedIds?: string[];
  effectIds?: string[];
  resolvedEffectIds?: string[];
  player?: Color;
  color?: Color;
  speaker?: Color;
  role?: DoomsayerRole;
  name?: DoomsayerRole;
  immediate?: boolean;
  movement?: CardMove[];
  preservePreviousMove?: boolean;
  target?: SquareName | CardMove[] | HolyWarTarget | AnathemaTarget | SiegeTarget | EvangelistsTarget;
  reason?: 'DIRECT_MATE' | 'SELF_CHECK';
  from?: SquareName;
  to?: SquareName;
  promotion?: Role;
}

export interface GameState {
  fen: string;
  pieces: PieceState[];
  players: Record<Color, PlayerState>;
  turn: {
    color: Color;
    phase: TurnPhase;
    moveMade: boolean;
    cardPlays: Record<Color, number>;
  };
  effects: unknown[];
  history: GameEvent[];
  orientation: BoardOrientation;
  enPassant: EnPassantOpportunity[];
  pendingRescue?: PendingRescueState | null;
  pendingDoomsayer?: PendingDoomsayerState | null;
  outcome: { winner?: Color; reason: 'checkmate' | 'stalemate' } | null;
}

export type GameAction =
  | { type: 'move'; from: unknown; to: unknown; promotion?: unknown }
  | { type: 'playCard'; cardId: CardId; cardInstanceId?: unknown; target?: unknown }
  | { type: 'namePiece'; speaker: Color; name: DoomsayerRole; losses: DoomsayerLoss[] }
  | { type: 'declineDoomsayer'; player?: unknown; color?: unknown }
  | { type: 'endTurn' };

export type GameErrorCode =
  | 'CARD_NOT_IN_HAND'
  | 'CARD_ALREADY_PLAYED'
  | 'INVALID_TIMING'
  | 'INVALID_TARGET'
  | 'WRONG_OWNER'
  | 'WRONG_ROLE'
  | 'ILLEGAL_MOVE'
  | 'KING_IN_CHECK'
  | 'GAME_OVER';

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: { code: GameErrorCode; message: string } };
