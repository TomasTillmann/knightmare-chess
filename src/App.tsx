import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';

import { ChessBoard } from './ChessBoard.js';
import { BoardEffects } from './BoardEffects.js';
import { cardInteractions, type CardInteraction } from './cardInteractions.js';
import { createDebugGame, practiceCards } from './debugGame.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import { applyAction, isPromotionSquare } from './game/reducer.js';
import type { CardInstance, Color, GameAction, SquareName } from './game/types.js';

export default function App() {
  const practice = new URLSearchParams(window.location.search).get('practice') ?? '';
  const [game, setGame] = useState(() => createDebugGame(practice));
  const [preview, setPreview] = useState<string | null>(null);
  const [selection, setSelection] = useState<(CardInteraction & { card: CardInstance; picked: string[] }) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const interactions = useMemo(() => new Map(Object.values(game.players).flatMap(player =>
    player.hand.map(card => [card.id, cardInteractions[card.cardId]?.(game, card)] as const))), [game]);

  const dispatch = useCallback((action: GameAction) => {
    const result = applyAction(game, action);
    if (!result.ok) {
      setMessage(result.error.message);
      return false;
    }
    flushSync(() => {
      setGame(result.state);
      setSelection(null);
      setPreview(null);
      setMessage(result.state.history.at(-1)?.type === 'cardFizzled'
        ? 'Card spent without effect.'
        : null);
    });
    return true;
  }, [game]);

  function selectCard(card: CardInstance) {
    const interaction = interactions.get(card.id);
    if (!interaction) return;
    if (!interaction.options.length) {
      setMessage(`${CARD_CATALOG[card.cardId].name} cannot be played now.`);
      return;
    }
    setMessage(null);
    setSelection({ ...interaction, card, picked: [] });
  }

  const move = useCallback((from: SquareName, to: SquareName) => {
    const moving = game.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    const promotes = moving?.role === 'pawn' && isPromotionSquare(game, moving.owner, to);
    const promotion = promotes
      ? window.prompt('Promote to queen, rook, bishop, or knight:', 'queen')
      : undefined;
    if (promotion === null) return false;

    return dispatch({ type: 'move', from, to, ...(promotion ? { promotion } : {}) });
  }, [game, dispatch]);

  function hand(color: Color) {
    const active = game.turn.color === color && !game.outcome;
    return (
      <section className="hand-area" data-player={color} aria-label={`${color} cards`}>
        <div className="hand" data-active={active}>
          {game.players[color].hand.map((instance, index) => {
            const card = CARD_CATALOG[instance.cardId];
            const position = game.players[color].hand.length > 1
              ? index / (game.players[color].hand.length - 1) * 2 - 1 : 0;
            const playable = Boolean(interactions.get(instance.id)?.options.length);
            return (
              <button
                key={instance.id}
                type="button"
                className="hand-card"
                style={{ '--fan-angle': `${position * 7}deg`, '--fan-drop': `${position * position * 12}px` } as CSSProperties}
                disabled={!playable}
                aria-pressed={selection?.card.id === instance.id}
                data-playable={playable}
                aria-label={`${card.name}: ${card.description}`}
                onClick={() => selectCard(instance)}
                onPointerEnter={() => setPreview(instance.cardId)}
                onPointerLeave={() => setPreview(null)}
                onFocus={() => setPreview(instance.cardId)}
                onBlur={() => setPreview(null)}
              >
                <img src={card.image} alt={card.name} width="898" height="1500" draggable={false} />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const previewId = selection?.card.cardId ?? preview;
  const options = selection?.options.filter(option => selection.picked.every((id, index) => option.picks[index]?.id === id)) ?? [];
  const chosen = options.find(option => option.picks.length === selection?.picked.length);
  const nextPicks = [...new Map(options.flatMap(option => {
    const pick = option.picks[selection?.picked.length ?? 0];
    return pick ? [[pick.id, pick] as const] : [];
  })).values()];
  const pick = (id: string) => selection && setSelection({ ...selection, picked: [...selection.picked, id] });
  const selectedPicks = options[0]?.picks.slice(0, selection?.picked.length) ?? [];
  const turnName = game.turn.color === 'white' ? 'White' : 'Black';
  const reactor = Object.entries(game.players).find(([color, player]) => color !== game.turn.color
    && player.hand.some(card => interactions.get(card.id)?.options.length));
  const status = message ?? (selection
    ? nextPicks.length ? selection.prompts[selection.picked.length] : `Play ${CARD_CATALOG[selection.card.cardId].name}`
    : reactor ? `${reactor[0] === 'white' ? 'White' : 'Black'} can respond`
      : game.outcome ? 'Game over.' : game.turn.moveMade ? `${turnName} · Move complete` : `${turnName} to move`);

  return (
    <main className="table" data-mode="debug" data-selecting={Boolean(selection)} aria-label="Knightmare Chess, debug table"
      onKeyDown={event => {
        if (event.key === 'Escape') { setSelection(null); setPreview(null); setMessage(null); }
      }}>
      {hand('black')}
      <div className="board-center">
        <ChessBoard onMove={move} state={game} interactive={!selection} />
        <BoardEffects state={game} onPreview={setPreview} />
        {selection && (
          <div className="board-targets" role="group" aria-label="Card destinations">
            {nextPicks.filter(choice => choice.square).map(choice => (
              <button key={choice.id} className="square-target" type="button"
                style={{ left: `${(choice.square!.charCodeAt(0) - 97) * 12.5}%`, top: `${(8 - Number(choice.square![1])) * 12.5}%` }}
                aria-label={`Choose ${choice.square}`} onClick={() => pick(choice.id)} />
            ))}
            {selectedPicks.filter(choice => choice.square).map((choice, index) => (
              <span key={index} className="square-selection" style={{ left: `${(choice.square!.charCodeAt(0) - 97) * 12.5}%`, top: `${(8 - Number(choice.square![1])) * 12.5}%` }} />
            ))}
          </div>
        )}
        <aside className="card-preview" data-active={previewId !== null} aria-label="Card preview">
          {previewId ? (
            <img className="preview-image" src={CARD_CATALOG[previewId].image} alt={CARD_CATALOG[previewId].name} />
          ) : (
            <div className="card-back" role="img" aria-label="Knightmare Chess card back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v5m-2.5-2.5h5M6 19h12M7 16h10l2-7-4 2-3-3-3 3-4-2 2 7Z" />
              </svg>
              <span>Knightmare<br />Chess</span>
            </div>
          )}
        </aside>
        <div className="turn-controls">
          <p className="turn-status" role="status">{status}</p>
          {selectedPicks.length > 0 && <p className="selection-summary">{selectedPicks.map(pick => pick.label).join(' → ')}</p>}
          {nextPicks.some(choice => !choice.square) && <div className="choice-options">
            {nextPicks.filter(choice => !choice.square).map(choice => (
              <button key={choice.id} className="action-button" type="button" onClick={() => pick(choice.id)}>{choice.label}</button>
            ))}
          </div>}
          <div className="turn-actions">
            {selection ? <>
              {selection.picked.length > 0 && <button className="action-button" type="button"
                onClick={() => setSelection({ ...selection, picked: selection.picked.slice(0, -1) })}>Back</button>}
              <button className="action-button" type="button" onClick={() => { setSelection(null); setPreview(null); setMessage(null); }}>Cancel</button>
              <button className="action-button" data-primary="true" type="button" disabled={!chosen}
                onClick={() => chosen && dispatch(chosen.action)}>Play card</button>
            </> : game.turn.moveMade && !game.outcome && (
              <button className="action-button" data-primary="true" type="button"
                onClick={() => dispatch({ type: 'endTurn' })}>End turn</button>
            )}
          </div>
          {!selection && <select className="practice-select" aria-label="Practice card" value={practice}
            onChange={event => { window.location.search = event.target.value ? `?practice=${event.target.value}` : ''; }}>
            <option value="">Practice a card…</option>
            {practiceCards.map(id => <option key={id} value={id}>{CARD_CATALOG[id].name}</option>)}
          </select>}
        </div>
      </div>
      {hand('white')}
      <p className="sr-only" id="board-position">{game.pieces.filter(piece => piece.zone === 'board').map(piece => `${piece.owner} ${piece.role} on ${piece.square}`).join(', ')}.</p>
      <p className="sr-only" id="off-board-position">{game.pieces.filter(piece => piece.zone !== 'board').map(piece => `${piece.owner} ${piece.role} ${piece.zone}`).join(', ')}.</p>
    </main>
  );
}
