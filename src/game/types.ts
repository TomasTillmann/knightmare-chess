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

export interface HolyWarTarget {
  knight: SquareName;
  bishop: SquareName;
}

export interface AnathemaTarget {
  bishop: SquareName;
  rook: SquareName;
}

export interface PlayerState {
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
}

export interface GameEvent {
  type: 'move' | 'cardPlayed' | 'cardFizzled';
  cardId?: CardId;
  target?: SquareName | CardMove[] | HolyWarTarget | AnathemaTarget;
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
  outcome: { winner?: Color; reason: 'checkmate' | 'stalemate' } | null;
}

export type GameAction =
  | { type: 'move'; from: unknown; to: unknown; promotion?: unknown }
  | { type: 'playCard'; cardId: CardId; cardInstanceId?: unknown; target?: unknown }
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
