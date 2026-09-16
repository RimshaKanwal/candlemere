import { useState } from "react";
import { socket } from "../socket";

export default function Lobby({ code, playerId, state }) {
  const [copied, setCopied] = useState(false);
  const self = state.players.find((p) => p.id === playerId);
  const canStart = self?.isHost && state.players.length >= state.minPlayers;
  const seatsLeft = state.maxPlayers - state.players.length;
  const humans = state.players.filter((p) => !p.isBot).length;
  const needed = state.minPlayers - state.players.length;

  function handleStart() {
    socket.emit("startGame", { code, playerId });
  }
  function addBot() {
    socket.emit("addBot", { code, playerId });
  }
  function removeBot(botId) {
    socket.emit("removeBot", { code, playerId, botId });
  }

  const joinLink = `${window.location.origin}/join/${code}`;

  async function copyLink() {
    try { await navigator.clipboard.writeText(joinLink); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <div className="card lobby-card">
      <span className="eyebrow">The guest list</span>
      <h2>A gathering of suspects.</h2>
      <div className="room-code-share">
        <span>Share this link:</span>
        <button className="code-chip link-chip" onClick={copyLink} title="Click to copy">{joinLink}</button>
      </div>
      <p className="hint">{copied ? "Link copied! Room code:" : "Or share the code:"} <strong>{code}</strong></p>

      <p className="hint">
        {state.players.length} / {state.maxPlayers} seated (needs at least {state.minPlayers} to start)
      </p>

      <ul className="player-list">
        {state.players.map((p) => (
          <li key={p.id} className={`player-row ${p.isBot ? "is-bot" : ""}`}>
            <span className="player-name">
              {p.name} {p.isHost && <span className="host-tag">HOST</span>}
              {p.id === playerId && <span className="you-tag">YOU</span>}
              {p.isBot && <span className="bot-tag">COMPUTER</span>}
            </span>
            {p.isBot && self?.isHost && (
              <button className="bot-remove" onClick={() => removeBot(p.id)} title={`Remove ${p.name}`} aria-label={`Remove ${p.name}`}>
                ×
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: Math.max(0, seatsLeft) }).map((_, i) => (
          <li key={`empty-${i}`} className="player-row empty">Waiting for player...</li>
        ))}
      </ul>

      {self?.isHost && (
        <div className="bot-controls">
          <button className="secondary" onClick={addBot} disabled={seatsLeft <= 0}>
            + Add a computer detective
          </button>
          <p className="hint">
            {humans === 1 && needed > 0
              ? `Playing alone? Add ${needed} to fill the table and start right away.`
              : "They deduce from the same clues you do — no peeking at the answer."}
          </p>
        </div>
      )}

      {self?.isHost ? (
        <button className="primary" disabled={!canStart} onClick={handleStart}>
          {canStart ? "Begin the mystery →" : `Need ${needed} more detective${needed === 1 ? "" : "s"}`}
        </button>
      ) : (
        <p className="hint">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}
