import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';

import { ChessBoard } from './ChessBoard.js';
import { BoardEffects } from './BoardEffects.js';
import { cardInteractions, matchingCardOptions } from './cardInteractions.js';
import { doomsayerSelection, moveChoices, requiredSelection, type GameSelection } from './gameInteractions.js';
import { createDebugGame, practiceCards } from './debugGame.js';
import { CARD_CATALOG } from './game/cards/catalog.js';
import { activeDoomsayers, applyAction } from './game/reducer.js';
import type { CardInstance, Color, GameAction, SquareName } from './game/types.js';

export default function App() {
  const practice = new URLSearchParams(window.location.search).get('practice') ?? '';
  const variant = new URLSearchParams(window.location.search).get('variant') ?? '';
  const [game, setGame] = useState(() => createDebugGame(practice, variant));
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [selection, setSelection] = useState<GameSelection | null>(() => requiredSelection(game));
  const [message, setMessage] = useState<string | null>(null);
  const interactions = useMemo(() => new Map(Object.values(game.players).flatMap(player =>
    player.hand.map(card => [card.id, cardInteractions[card.cardId]?.(game, card)] as const))), [game]);
  const canEnd = useMemo(() => applyAction(game, { type: 'endTurn' }).ok, [game]);

  const dispatch = useCallback((action: GameAction) => {
    const result = applyAction(game, action);
    if (!result.ok) {
      setMessage(result.error.message);
      return false;
    }
    flushSync(() => {
      setGame(result.state);
      setSelection(requiredSelection(result.state));
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
      setReading(card.cardId);
      return;
    }
    setMessage(null);
    setSelection({ ...interaction, card, title: CARD_CATALOG[card.cardId].name, picked: [] });
  }

  const move = useCallback((from: SquareName, to: SquareName) => {
    const options = moveChoices(game, from, to);
    if (options.length <= 1) return dispatch(options[0]?.action ?? { type: 'move', from, to });
    setSelection({ title: `${from} → ${to}`, prompts: ['Choose how to move'], options, picked: [], confirm: 'Move' });
    return false;
  }, [game, dispatch]);

  function hand(color: Color) {
    const active = game.turn.color === color && !game.outcome;
    return (
      <section className="hand-area" data-player={color} aria-label={`${color} cards`}>
        <div className="hand" data-active={active} style={{ '--hand-count': game.players[color].hand.length } as CSSProperties}>
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
                aria-pressed={selection?.card?.id === instance.id}
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

  const previewId = selection?.card?.cardId ?? preview;
  const options = selection ? matchingCardOptions(selection.options, selection.picked) : [];
  const resolved = selection?.resolve?.(selection.picked);
  const chosen = resolved?.action ?? options.find(option => option.picks.length === selection?.picked.length)?.action;
  const nextPicks = resolved?.choices ?? [...new Map(options.flatMap(option => {
    const pick = option.picks[selection?.picked.length ?? 0];
    return pick ? [[pick.id, pick] as const] : [];
  })).values()];
  const pick = (id: string) => selection && setSelection({ ...selection, picked: [...selection.picked, id] });
  const selectedPicks = resolved?.summary ?? options[0]?.picks.slice(0, selection?.picked.length) ?? [];
  const turnName = game.turn.color === 'white' ? 'White' : 'Black';
  const reactor = Object.entries(game.players).find(([color, player]) => color !== game.turn.color
    && player.hand.some(card => interactions.get(card.id)?.options.length));
  const pendingAbduction = game.pendingAbduction;
  const panic = game.effects.find(effect => effect.type === 'panic' && effect.player === game.turn.color && !game.turn.moveMade);
  const status = message ?? (selection
    ? nextPicks.length ? nextPicks[0]?.prompt ?? selection.prompts[selection.picked.length] : `${selection.confirm ?? 'Play'} ${selection.title}`
    : pendingAbduction ? `${pendingAbduction.player === 'white' ? 'White' : 'Black'}, look away while the piece is removed`
      : game.pendingDoomsayer ? `${game.pendingDoomsayer.player === 'white' ? 'White' : 'Black'} may name a piece or decline`
      : game.pendingRescue ? `${turnName}: use a card to save your King`
    : reactor ? `${reactor[0] === 'white' ? 'White' : 'Black'} can respond`
      : game.outcome ? `${game.outcome.winner ? `${game.outcome.winner === 'white' ? 'White' : 'Black'} wins` : 'Draw'} · ${game.outcome.reason}`
        : game.riposteSkipped ? `${turnName} · Move forfeited` : game.turn.moveMade ? `${turnName} · Move complete` : `${turnName} to move`);
  const cancel = () => { setSelection(requiredSelection(game)); setPreview(null); setMessage(null); };
  const timer = pendingAbduction ? {
    key: `abduction-${game.history.length}-${pendingAbduction.phase}`, ms: pendingAbduction.durationMs,
    action: { type: pendingAbduction.phase === 'concealment' ? 'revealAbduction' : 'abductionTimeout' } as GameAction,
    label: pendingAbduction.phase === 'concealment' ? 'Look away' : 'Recall',
  } : panic ? { key: `panic-${game.turn.color}`, ms: 15000, action: { type: 'panicTimeout' } as GameAction, label: `${turnName} to move` } : null;

  return (
    <><main className="table" data-mode="debug" data-selecting={Boolean(selection)} aria-label="Knightmare Chess, debug table"
      onKeyDown={event => {
        if (event.key === 'Escape') cancel();
      }}>
      {hand('black')}
      <div className="board-center">
        <ChessBoard onMove={move} state={game} interactive={!selection && !pendingAbduction} />
        <BoardEffects state={game} onPreview={setPreview} />
        {pendingAbduction?.phase === 'concealment' && <div className="board-concealment" role="note">Look away<br /><small>The board returns after 10 seconds</small></div>}
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
          {timer && <Countdown key={timer.key} ms={timer.ms} label={timer.label} onExpire={() => dispatch(timer.action)} />}
          {!selection && (game.plotsAllowances ?? []).filter(allowance => allowance.remaining > 0).map((allowance, index) =>
            <p className="selection-summary" key={index}>{allowance.player === 'white' ? 'White' : 'Black'} · {allowance.remaining} extra cards available</p>)}
          {selectedPicks.length > 0 && <p className="selection-summary">{selectedPicks.map(pick => pick.label).join(' → ')}</p>}
          {nextPicks.some(choice => !choice.square) && <div className="choice-options">
            {nextPicks.filter(choice => !choice.square).map(choice => (
              <button key={choice.id} className="action-button" type="button" onClick={() => pick(choice.id)}>{choice.label}</button>
            ))}
          </div>}
          <div className="turn-actions">
            {selection ? <>
              {selection.card && <button className="action-button mobile-read-card" type="button" onClick={() => setReading(selection.card!.cardId)}>Read card</button>}
              {selection.picked.length > (selection.minPicked ?? 0) && <button className="action-button" type="button"
                onClick={() => setSelection({ ...selection, picked: selection.picked.slice(0, -1) })}>Back</button>}
              {!selection.required && <button className="action-button" type="button" onClick={cancel}>Cancel</button>}
              <button className="action-button" data-primary="true" type="button" disabled={!chosen}
                onClick={() => chosen && dispatch(chosen)}>{selection.confirm ?? 'Play card'}</button>
            </> : <>
            {activeDoomsayers(game).length > 0 && !pendingAbduction && !game.outcome && <button className="action-button" type="button"
              onClick={() => setSelection(doomsayerSelection(game))}>Name a piece</button>}
            {game.pendingDoomsayer && <button className="action-button" type="button"
              onClick={() => dispatch({ type: 'declineDoomsayer', player: game.pendingDoomsayer!.player })}>Decline</button>}
            {canEnd && <>
              <button className="action-button" data-primary="true" type="button"
                onClick={() => dispatch({ type: 'endTurn' })}>End turn</button>
              {game.turn.cardPlays[game.turn.color] === 0 && game.players[game.turn.color].hand.length > 0 && <button className="action-button" type="button"
                onClick={() => setSelection({ title: 'Exchange a card', confirm: 'Exchange & end', picked: [], prompts: ['Choose a card to discard'],
                  options: game.players[game.turn.color].hand.map(card => ({ picks: [{ id: card.id, label: CARD_CATALOG[card.cardId].name }],
                    action: { type: 'endTurn', discardCardInstanceId: card.id } })) })}>Exchange card</button>}
            </>}
            </>}
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
    </main>{reading && <CardReader cardId={reading} onClose={() => setReading(null)} />}</>
  );
}

function Countdown({ ms, label, onExpire }: { ms: number; label: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(ms);
  const callback = useRef(onExpire);
  callback.current = onExpire;
  useEffect(() => {
    const deadline = Date.now() + ms;
    const interval = window.setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (!left) { window.clearInterval(interval); callback.current(); }
    }, 100);
    return () => window.clearInterval(interval);
  }, [ms]);
  return <p className="turn-timer" role="timer" aria-label={`${label}, ${Math.ceil(remaining / 1000)} seconds`}>{label} · {Math.ceil(remaining / 1000)}s</p>;
}

function CardReader({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const card = CARD_CATALOG[cardId];
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="card-reader" aria-label={card.name} onClose={onClose} onCancel={onClose}>
    <img src={card.image} alt={card.name} />
    <p>{card.description}</p>
    <button className="action-button" type="button" autoFocus onClick={() => dialog.current?.close()}>Close card</button>
  </dialog>;
}
